import type { OpsiKonflik, Posisi } from "@/db/schema";
import { formatAngka } from "@/lib/format";

/**
 * Deteksi konflik gambar (FR-13) oleh KODE, bukan AI. Murni dan deterministik.
 * Dua jenis (contoh PRD): ukuran item yang sama berbeda antarhalaman (kulkas 70 x 177,5 vs 92 x 179),
 * dan rantai ukuran yang jumlahnya tidak sama (52 + 85 tidak sama dengan 134).
 */
export type UkuranBaca = {
  halaman: number;
  item: string;
  sumbu: "panjang" | "lebar" | "tinggi" | "tebal" | "kedalaman";
  nilaiMm: number;
  kelompok: string | null;
  peran: "tunggal" | "bagian" | "total";
  posisi: Posisi | null;
};

export type KonflikBaru = {
  jenis: "jumlah_tidak_sama" | "ukuran_berbeda";
  item: string;
  deskripsi: string;
  opsi: OpsiKonflik[];
};

const persepuluh = (mm: number) => Math.round(mm * 10); // aritmetika bilangan bulat, tanpa selisih float
const mm = (p: number) => formatAngka(p / 10);
export const normalisasiNama = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

const URUT_SUMBU = ["lebar", "tinggi", "kedalaman", "panjang", "tebal"] as const;

export function deteksiKonflik(ukuran: UkuranBaca[]): KonflikBaru[] {
  return [...rantai(ukuran), ...berbeda(ukuran)];
}

function rantai(ukuran: UkuranBaca[]): KonflikBaru[] {
  const grup = new Map<string, UkuranBaca[]>();
  for (const u of ukuran) {
    if (u.kelompok === null || u.peran === "tunggal") continue;
    const k = `${u.halaman}\u0000${u.kelompok}`;
    grup.set(k, [...(grup.get(k) ?? []), u]);
  }
  const hasil: KonflikBaru[] = [];
  for (const [, isi] of [...grup].sort(([a], [b]) => a.localeCompare(b))) {
    const bagian = isi.filter((u) => u.peran === "bagian");
    const total = isi.filter((u) => u.peran === "total");
    if (bagian.length < 2 || total.length !== 1) continue;
    const jumlah = bagian.reduce((s, u) => s + persepuluh(u.nilaiMm), 0);
    const t = persepuluh(total[0].nilaiMm);
    if (jumlah === t) continue;
    const hal = total[0].halaman;
    const rumus = `${bagian.map((u) => mm(persepuluh(u.nilaiMm))).join(" + ")} = ${mm(jumlah)}`;
    hasil.push({
      jenis: "jumlah_tidak_sama",
      item: total[0].item,
      deskripsi: `Pada ${total[0].item} (hal. ${hal}), ${rumus} mm, tetapi tertulis total ${mm(t)} mm.`,
      opsi: [
        { label: `Bagian benar: jumlah ${mm(jumlah)} mm`, halaman: hal, posisi: bagian[0].posisi, nilai: { total: jumlah / 10 } },
        { label: `Total benar: ${mm(t)} mm`, halaman: hal, posisi: total[0].posisi, nilai: { total: t / 10 } },
      ],
    });
  }
  return hasil;
}

function berbeda(ukuran: UkuranBaca[]): KonflikBaru[] {
  const perItem = new Map<string, { nama: string; baris: UkuranBaca[] }>();
  for (const u of ukuran) {
    if (u.peran !== "tunggal") continue;
    const k = normalisasiNama(u.item);
    if (!k) continue;
    const e = perItem.get(k) ?? { nama: u.item, baris: [] };
    e.baris.push(u);
    perItem.set(k, e);
  }
  const hasil: KonflikBaru[] = [];
  for (const [, { nama, baris }] of [...perItem].sort(([a], [b]) => a.localeCompare(b))) {
    // nilai berbeda pada sumbu yang sama?
    const nilaiPerSumbu = new Map<string, Set<number>>();
    for (const u of baris) {
      const s = nilaiPerSumbu.get(u.sumbu) ?? new Set<number>();
      s.add(persepuluh(u.nilaiMm));
      nilaiPerSumbu.set(u.sumbu, s);
    }
    if (![...nilaiPerSumbu.values()].some((s) => s.size > 1)) continue;

    // Satu opsi per kombinasi nilai yang berbeda. Urut halaman agar stabil.
    const opsiMap = new Map<string, OpsiKonflik & { hal: number[] }>();
    const urut = [...baris].sort((a, b) => a.halaman - b.halaman || a.sumbu.localeCompare(b.sumbu));
    const halamanUnik = [...new Set(urut.map((u) => u.halaman))];
    for (const h of halamanUnik) {
      const dihalaman = urut.filter((u) => u.halaman === h);
      const tinggiMaks = Math.max(...URUT_SUMBU.map((s) => dihalaman.filter((u) => u.sumbu === s).length));
      for (let k = 0; k < tinggiMaks; k++) {
        const nilai: Record<string, number> = {};
        let posisi: Posisi | null = null;
        for (const s of URUT_SUMBU) {
          const d = dihalaman.filter((u) => u.sumbu === s);
          const pilih = d[Math.min(k, d.length - 1)];
          if (pilih) {
            nilai[s] = persepuluh(pilih.nilaiMm) / 10;
            posisi ??= pilih.posisi;
          }
        }
        const kunci = JSON.stringify(nilai);
        const ada = opsiMap.get(kunci);
        if (ada) ada.hal.push(h);
        else opsiMap.set(kunci, { label: "", halaman: h, posisi, nilai, hal: [h] });
      }
    }
    const opsi = [...opsiMap.values()].map(({ hal, ...o }) => ({
      ...o,
      label: `${URUT_SUMBU.filter((s) => s in o.nilai).map((s) => `${s} ${formatAngka(o.nilai[s])}`).join(" x ")} mm (hal. ${hal.join(", ")})`,
    }));
    hasil.push({
      jenis: "ukuran_berbeda",
      item: nama,
      deskripsi: `${nama} tertulis dengan ukuran berbeda: ${opsi.map((o) => o.label).join(" ; ")}.`,
      opsi,
    });
  }
  return hasil;
}
