import { eq } from "drizzle-orm";
import { schema, type Db } from "@/db";
import { daftarAturan, ruleSetAktif } from "./aturan";
import { estimasiTerbaru, type HasilMesin } from "./estimasi";
import type { MasukanWeb } from "./estimasi-masukan";
import { halamanLembar, lembarKerjaTerbaru } from "./proyek";
import { ambilPenyimpanan, type Penyimpanan } from "./storage";
import type { DataPdf } from "./pdf-hasil";
import { normalisasiNama } from "./pembaca/konflik";

/** Rakit data PDF dari database. Hanya anggota workspace pemilik proyek yang sampai ke sini (dicek pemanggil). */
export async function kumpulkanDataPdf(
  db: Db, workspaceId: string, proyekId: string, st?: Penyimpanan,
): Promise<DataPdf | null> {
  const [pr] = await db.select().from(schema.proyek).where(eq(schema.proyek.id, proyekId));
  if (!pr || pr.workspaceId !== workspaceId) return null;
  const e = await estimasiTerbaru(db, proyekId);
  if (!e) return null;
  const lk = await lembarKerjaTerbaru(db, proyekId);
  const units = lk ? await db.select().from(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lk.id)) : [];
  const bidang = lk ? await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.lembarKerjaId, lk.id)) : [];
  const konflik = lk ? await db.select().from(schema.konflik).where(eq(schema.konflik.lembarKerjaId, lk.id)) : [];
  const rs = await ruleSetAktif(db, workspaceId);
  const aturan = rs ? (await daftarAturan(db, rs.id)).filter((a) => a.kategori === "bahan") : [];

  // Gambar dari lembar kerja yang diunggah tim: denah dulu, lalu tampak depan, lalu detail; maksimal dua.
  const hal = lk ? await halamanLembar(db, lk.id) : [];
  const urut = ["denah", "elevasi", "detail"];
  const pilih = [
    ...urut.flatMap((j) => hal.filter((h) => h.jenis === j).slice(0, 1)),
  ].slice(0, 2);
  if (pilih.length === 0 && hal.length) pilih.push(hal[0]);
  const gudang = st ?? ambilPenyimpanan();
  const gambar: DataPdf["gambar"] = [];
  for (const h of pilih) {
    try {
      const png = await gudang.baca(h.kunciBesar);
      gambar.push({ halaman: h.nomor, jenis: h.jenis ?? "lainnya", lembarTercetak: h.lembarTercetak, uri: `data:image/png;base64,${png.toString("base64")}` });
    } catch {
      /* gambar gagal dibaca: PDF tetap dibuat tanpa gambar itu */
    }
  }

  const milik = (b: { unitNama: string | null }, nama: string) => !!b.unitNama && normalisasiNama(b.unitNama) === normalisasiNama(nama);
  return {
    proyek: { klien: pr.klien, lokasi: pr.lokasi, pekerjaan: pr.pekerjaan, surveyor: pr.surveyor, tanggalGambar: pr.tanggalGambar },
    estimasi: {
      versi: e.versi, ruleSetVersi: e.ruleSetVersi, dibuat: e.dibuat,
      hasil: e.hasil as unknown as HasilMesin, masukan: e.masukan as unknown as MasukanWeb,
    },
    units: units.map((u) => {
      const lebar = bidang.find((b) => b.jenis === "ukuran" && milik(b, u.nama) && b.data.sumbu === "lebar" && b.data.peran === "tunggal");
      return {
        nama: u.nama, jenis: u.jenis, bahanUtama: u.bahanUtama, halaman: u.halamanSemua.length ? u.halamanSemua : [u.halaman],
        lebarMm: lebar ? Number(lebar.data.nilaiMm) : null,
        pintu: bidang.filter((b) => b.jenis === "pintu" && milik(b, u.nama)).reduce((s, b) => s + Number(b.nilai), 0),
        laci: bidang.filter((b) => b.jenis === "laci" && milik(b, u.nama)).reduce((s, b) => s + Number(b.nilai), 0),
      };
    }),
    spek: bidang.filter((b) => b.jenis === "spek").sort((a, b) => a.halaman - b.halaman).map((b) => ({ kunci: b.kunci, nilai: b.nilai, unit: b.unitNama, halaman: b.halaman })),
    gambar,
    halamanGagal: lk?.halamanGagal ?? [],
    konflik: konflik.map((k) => ({ deskripsi: k.deskripsi, terjawab: !!k.jawaban })),
    aturanBahan: aturan.map((a) => ({ nama: a.nama, isi: a.isi })),
  };
}

export function namaBerkasPdf(klien: string): string {
  const aman = (klien || "Proyek").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  return `Estimasi_Material_${aman || "Proyek"}.pdf`;
}
