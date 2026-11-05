import { normalisasiNama } from "./pembaca/konflik";
import { asumsiPintu } from "./pembaca/simpan";

/**
 * Menurunkan masukan mesin hitung dari hasil baca. Murni dan deterministik.
 * Aturan: yang tidak terbaca = null (belum diketahui), BUKAN nol. Setiap field membawa asal dan catatan
 * supaya pengguna tahu dari mana angkanya dan apa yang perlu dicek.
 */
export type BidangBaca = {
  jenis: string; kunci: string; nilai: string; halaman: number; unitNama: string | null;
  data: Record<string, unknown>;
};
export type UnitBaca = { nama: string; jenis: string; halamanSemua: number[]; bahanUtama?: string | null };

export type KomponenWeb = {
  id: string; unit: string; unit_jenis: string; bahan_unit: string | null; nama: string; fungsi: string;
  panjang: number; lebar: number; jumlah: number; status_ukuran: string; hpl_muka: boolean | null; kode_hpl: string | null;
};

export type FieldMasukan<T> = { nilai: T | null; asal: "baca" | "pengguna" | "asumsi" | "tidak_ada"; catatan: string[] };

export type MasukanWeb = {
  meter_bawah: FieldMasukan<number>;     // m, jumlah lebar unit kabinet bawah
  meter_atas: FieldMasukan<number>;      // m, jumlah lebar unit kabinet atas (kabinet gantung)
  meter_kabinet: FieldMasukan<number>;   // dasar tarif per meter
  meter_kitchen: FieldMasukan<number>;   // dasar LED strip
  aica_kedalaman_mm: FieldMasukan<number>; // kedalaman top AICA kabinet bawah (mm)
  jumlah_lemari: FieldMasukan<number>;
  tinggi_standar: FieldMasukan<boolean>;
  pintu: FieldMasukan<{ unit_id: string; jenis: string }[]>;
  pintu_bawah_asumsi: number;
  pintu_atas_asumsi: number;
  unit_tarik: FieldMasukan<{ unit_id: string; jenis: string }[]>;
  jumlah_sudut_robot: FieldMasukan<number>;
  titik_sambungan: FieldMasukan<number>;
  parts: { id: string; bahan: string; panjang: number; lebar: number; serat: string; status_ukuran: string }[];
  hpl_pintu: boolean;                    // 1 muka HPL per pintu (PRD §6.2)
  komponen: KomponenWeb[];                // daftar potongan per unit dari lembar kerja
  kode_hpl_bawaan: string | null;
  meter_per_bahan: Record<string, number>; // meter kabinet per bahan utama unit: MULTIPLEKS | BLOCKBOARD | PVC | TIDAK_DIKETAHUI
  catatan: string[];
};

const kosong = <T>(catatan: string): FieldMasukan<T> => ({ nilai: null, asal: "tidak_ada", catatan: [catatan] });
const baca = <T>(nilai: T, catatan: string[] = []): FieldMasukan<T> => ({ nilai, asal: "baca", catatan });

const mm = (v: unknown) => (typeof v === "number" ? v : Number(v));

export function turunkanMasukan(units: UnitBaca[], bidang: BidangBaca[], halamanGagal: number[] = []): MasukanWeb {
  const catatan: string[] = [];
  if (halamanGagal.length) {
    catatan.push(`Halaman PDF ${halamanGagal.join(", ")} tidak terbaca; hasil bisa kurang dari kebutuhan sebenarnya. Klik Baca ulang di layar unggah.`);
  }
  const ukuran = bidang.filter((b) => b.jenis === "ukuran" && b.data.peran === "tunggal");

  // Lebar keseluruhan unit: ukuran bersumbu "lebar" yang bernama sama dengan unit.
  function lebarUnit(u: UnitBaca): { mm: number | null; ada: string } {
    const k = normalisasiNama(u.nama);
    const cocok = ukuran
      .filter((b) => b.unitNama && normalisasiNama(b.unitNama) === k && b.data.sumbu === "lebar")
      .sort((a, b) => a.halaman - b.halaman);
    if (cocok.length === 0) return { mm: null, ada: "" };
    const unik = [...new Set(cocok.map((b) => mm(b.data.nilaiMm)))];
    return { mm: unik[0], ada: unik.length > 1 ? `lebar ${u.nama} berbeda antarhalaman (${unik.join(" / ")} mm); dipakai ${unik[0]} mm` : "" };
  }

  function jumlahMeter(jenis: string, nama: string): FieldMasukan<number> {
    const us = units.filter((u) => u.jenis === jenis);
    if (us.length === 0) return kosong(`Tidak ada unit ${nama} terbaca`);
    const cat: string[] = [];
    let total = 0;
    let lengkap = true;
    for (const u of us) {
      const l = lebarUnit(u);
      if (l.mm === null) {
        lengkap = false;
        cat.push(`Lebar ${u.nama} belum terbaca; tidak ikut dihitung`);
      } else {
        total += l.mm;
        if (l.ada) cat.push(l.ada);
      }
    }
    if (total === 0) return { nilai: null, asal: "tidak_ada", catatan: cat };
    return baca(total / 1000, lengkap ? cat : [...cat, "Meter belum lengkap"]);
  }

  const meterBawah = jumlahMeter("kabinet_bawah", "kabinet bawah");
  const meterAtas = jumlahMeter("kabinet_atas", "kabinet atas");
  const adaMeter = meterBawah.nilai !== null || meterAtas.nilai !== null;
  const meterKabinet: FieldMasukan<number> = adaMeter
    ? baca((meterBawah.nilai ?? 0) + (meterAtas.nilai ?? 0), [
        "Dasar meter = lebar kabinet bawah + kabinet atas (perlu konfirmasi dasar meter)",
      ])
    : kosong("Lebar unit kabinet belum terbaca");
  const meterKitchen: FieldMasukan<number> =
    meterBawah.nilai !== null
      ? baca(meterBawah.nilai, ["Meter kitchen = lebar kabinet bawah (perlu konfirmasi)"])
      : kosong("Meter kitchen belum diketahui");

  // Tinggi: semua tinggi unit yang terbaca harus 700–800 mm.
  const tinggiUnit = units.flatMap((u) => {
    const k = normalisasiNama(u.nama);
    return ukuran
      .filter((b) => b.unitNama && normalisasiNama(b.unitNama) === k && b.data.sumbu === "tinggi")
      .map((b) => ({ nama: u.nama, mm: mm(b.data.nilaiMm) }));
  });
  const diluar = tinggiUnit.filter((t) => t.mm < 700 || t.mm > 800);
  const tinggiStandar: FieldMasukan<boolean> =
    tinggiUnit.length === 0
      ? { nilai: true, asal: "asumsi", catatan: ["Tinggi unit tidak terbaca; dianggap standar (70–80 cm), perlu dicek"] }
      : baca(diluar.length === 0, diluar.map((t) => `Tinggi ${t.nama} ${t.mm} mm di luar standar 700–800 mm`));

  // Pintu
  const pintuBaca = bidang.filter((b) => b.jenis === "pintu");
  let bawahAsumsi = 0;
  let atasAsumsi = 0;
  const parts: MasukanWeb["parts"] = [];
  const daftarPintu: { unit_id: string; jenis: string }[] = [];
  pintuBaca.forEach((b, i) => {
    const d = b.data as { letak?: string; fungsi?: string | null; inset?: boolean | null; jumlah?: number; lebarMm?: number | null; tinggiMm?: number | null };
    const n = d.jumlah ?? 0;
    const jenis = d.fungsi === "sink" || d.fungsi === "gas" || d.fungsi === "rak_piring" ? d.fungsi : d.inset && d.letak === "lemari" ? "inset_lemari" : "lurus";
    for (let k = 0; k < n; k++) daftarPintu.push({ unit_id: b.unitNama ?? `pintu${i + 1}`, jenis });
    const ukuranAda = d.lebarMm != null && d.tinggiMm != null;
    if (d.letak === "bawah" || d.letak === "atas") {
      if (ukuranAda) {
        for (let k = 0; k < n; k++) {
          parts.push({ id: `pintu_${d.letak}_${i + 1}_${k + 1}`, bahan: "Material 18 mm", panjang: d.tinggiMm!, lebar: d.lebarMm!, serat: "tetap", status_ukuran: "gambar" });
        }
      } else if (asumsiPintu(d.letak)) {
        if (d.letak === "bawah") bawahAsumsi += n;
        else atasAsumsi += n;
      }
    }
  });
  const pintu: FieldMasukan<{ unit_id: string; jenis: string }[]> =
    pintuBaca.length === 0
      ? kosong("Pintu belum terbaca dari lembar kerja")
      : baca(daftarPintu, [
          ...(bawahAsumsi || atasAsumsi
            ? [`Ukuran ${bawahAsumsi + atasAsumsi} pintu tidak tertulis; ukuran asumsi dipakai (bawah 60 x 70 cm, atas 40 x 70 cm)`]
            : []),
        ]);

  // Laci / rel
  const laciBaca = bidang.filter((b) => b.jenis === "laci");
  const unitTarik: { unit_id: string; jenis: string }[] = [];
  laciBaca.forEach((b, i) => {
    const d = b.data as { letak?: string; urutan?: string | null; jumlah?: number };
    const n = d.jumlah ?? 0;
    for (let k = 0; k < n; k++) {
      const jenis = d.letak === "lemari" ? "laci_lemari" : d.letak === "kabinet_bawah" && d.urutan === "paling_atas" && k === 0 ? "laci_atas_kabinet_bawah" : "kabinet";
      unitTarik.push({ unit_id: b.unitNama ?? `laci${i + 1}`, jenis });
    }
  });

  // AICA mengikuti ukuran keseluruhan kabinet bawah: panjang = jumlah lebar unit bawah, kedalaman dari gambar.
  const kedalaman = units
    .filter((u) => u.jenis === "kabinet_bawah")
    .flatMap((u) => ukuran.filter((b) => b.unitNama && normalisasiNama(b.unitNama) === normalisasiNama(u.nama) && b.data.sumbu === "kedalaman"))
    .sort((a, b) => a.halaman - b.halaman)[0];
  const aicaKedalaman: FieldMasukan<number> = kedalaman
    ? baca(mm(kedalaman.data.nilaiMm), ["Kedalaman top dari gambar; bentuk bersudut dihitung sebagai bentang x kedalaman"])
    : { nilai: 600, asal: "asumsi", catatan: ["Kedalaman top tidak terbaca dari gambar; dipakai standar 60 cm (asumsi)"] };

  // Meter menurut bahan utama unit (aturan bahan: multipleks, blockboard, PVC). Hanya unit yang ikut meter kabinet.
  const dasarBahan = (t: string | null | undefined) =>
    !t ? "TIDAK_DIKETAHUI" : /pvc/i.test(t) ? "PVC" : /multi/i.test(t) ? "MULTIPLEKS" : /block|\bbb\b/i.test(t) ? "BLOCKBOARD" : "TIDAK_DIKETAHUI";
  const meterPerBahan: Record<string, number> = {};
  for (const u of units.filter((x) => x.jenis === "kabinet_bawah" || x.jenis === "kabinet_atas")) {
    const l = lebarUnit(u);
    if (l.mm === null) continue;
    const d = dasarBahan(u.bahanUtama);
    meterPerBahan[d] = (meterPerBahan[d] ?? 0) + l.mm / 1000;
  }
  // Komponen per unit. Satu kabinet pada beberapa tampak: ambil part dari halaman dengan part terbanyak untuk unit itu.
  const partBaca = bidang.filter((b) => b.jenis === "part");
  const perUnit = new Map<string, BidangBaca[]>();
  for (const b of partBaca) {
    const k = normalisasiNama(b.unitNama ?? "tanpa unit");
    perUnit.set(k, [...(perUnit.get(k) ?? []), b]);
  }
  const komponen: KomponenWeb[] = [];
  for (const [kunciUnit, isi] of [...perUnit].sort(([a], [b]) => a.localeCompare(b))) {
    const jumlahPerHalaman = new Map<number, number>();
    for (const b of isi) jumlahPerHalaman.set(b.halaman, (jumlahPerHalaman.get(b.halaman) ?? 0) + Number(b.nilai));
    const [halamanDipakai] = [...jumlahPerHalaman].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    if (jumlahPerHalaman.size > 1) {
      catatan.push(`Komponen ${isi[0].unitNama ?? "tanpa unit"} diambil dari halaman PDF ${halamanDipakai}; halaman lain (${[...jumlahPerHalaman.keys()].filter((h) => h !== halamanDipakai).join(", ")}) tidak dihitung agar tidak ganda`);
    }
    const unit = units.find((u) => normalisasiNama(u.nama) === kunciUnit);
    isi.filter((b) => b.halaman === halamanDipakai).forEach((b, i) => {
      const d = b.data as { nama?: string; fungsi?: string; panjangMm?: number; lebarMm?: number; jumlah?: number; statusUkuran?: string; hplMuka?: boolean | null; kodeHpl?: string | null };
      komponen.push({
        id: `${kunciUnit.replace(/\s+/g, "_")}_${i + 1}`, unit: unit?.nama ?? b.unitNama ?? "Tanpa unit", unit_jenis: unit?.jenis ?? "lainnya",
        bahan_unit: unit ? dasarBahan(unit.bahanUtama) === "TIDAK_DIKETAHUI" ? null : dasarBahan(unit.bahanUtama) : null,
        nama: d.nama ?? b.kunci, fungsi: d.fungsi ?? "lainnya", panjang: Number(d.panjangMm), lebar: Number(d.lebarMm), jumlah: Number(d.jumlah),
        status_ukuran: d.statusUkuran ?? "asumsi", hpl_muka: d.hplMuka ?? null, kode_hpl: d.kodeHpl ?? null,
      });
    });
  }
  const kodeHpl = [...new Set(bidang.filter((b) => b.jenis === "spek" && b.kunci === "kode_hpl").map((b) => b.nilai))];
  const sudut = bidang.filter((b) => b.jenis === "sudut_robot").map((b) => Number(b.nilai)).filter((n) => Number.isFinite(n));
  const lemari = units.filter((u) => u.jenis === "lemari").length;
  return {
    meter_bawah: meterBawah,
    meter_atas: meterAtas,
    meter_kabinet: meterKabinet,
    meter_kitchen: meterKitchen,
    aica_kedalaman_mm: aicaKedalaman,
    jumlah_lemari: units.length === 0 ? kosong("Unit belum terbaca") : baca(lemari),
    tinggi_standar: tinggiStandar,
    pintu,
    pintu_bawah_asumsi: bawahAsumsi,
    pintu_atas_asumsi: atasAsumsi,
    unit_tarik: laciBaca.length === 0 ? kosong("Laci/rak tarik belum terbaca dari lembar kerja") : baca(unitTarik),
    jumlah_sudut_robot: sudut.length ? baca(Math.max(...sudut), ["Dari catatan lembar kerja"]) : kosong("Sudut engsel robot tidak disebut di lembar kerja"),
    titik_sambungan: kosong("Opsional: hanya untuk rumus GP PRD (pembanding)"),
    hpl_pintu: parts.length > 0 || bawahAsumsi + atasAsumsi > 0,
    meter_per_bahan: meterPerBahan,
    komponen,
    kode_hpl_bawaan: kodeHpl.length === 1 ? kodeHpl[0] : null,
    parts,
    catatan,
  };
}

/** Bentuk JSON untuk mesin hitung Python. null = belum diketahui. */
export function keMesin(m: MasukanWeb, rulesetVersi: string) {
  const d = (f: FieldMasukan<number>) => (f.nilai === null ? null : String(f.nilai));
  return {
    ruleset_versi: rulesetVersi,
    parts: m.parts,
    hpl: [] as string[],
    pintu: m.pintu.nilai,
    unit_tarik: m.unit_tarik.nilai,
    jumlah_sudut_robot: m.jumlah_sudut_robot.nilai,
    meter_kabinet: d(m.meter_kabinet),
    meter_kitchen: d(m.meter_kitchen),
    meter_kabinet_gantung: d(m.meter_atas),
    jumlah_lemari: m.jumlah_lemari.nilai,
    tinggi_standar: m.tinggi_standar.nilai ?? true,
    titik_sambungan: m.titik_sambungan.nilai,
    pintu_bawah_asumsi: m.pintu_bawah_asumsi,
    pintu_atas_asumsi: m.pintu_atas_asumsi,
    tinggi_pintu_mm: 700,
    hpl_pintu: m.hpl_pintu ?? false,
    meter_per_bahan: Object.keys(m.meter_per_bahan ?? {}).length ? m.meter_per_bahan : null,
    komponen: (m.komponen ?? []).length ? m.komponen : null,
    kode_hpl_bawaan: m.kode_hpl_bawaan ?? null,
    aica_panjang_mm: m.meter_bawah.nilai === null ? null : String(Math.round(m.meter_bawah.nilai * 1000)),
    aica_kedalaman_mm: m.aica_kedalaman_mm ? d(m.aica_kedalaman_mm) : null,
  };
}
