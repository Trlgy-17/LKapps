import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema, type Db } from "@/db";
import { jalankanSatu } from "@/lib/antrean";
import { DilarangError } from "@/lib/permissions";
import { daftarkanPenanganHitung, estimasiTerbaru, ubahMasukan, type HasilMesin } from "@/lib/estimasi";
import { turunkanMasukan } from "@/lib/estimasi-masukan";
import { daftarkanPenanganPdf, pythonBin } from "@/lib/pdf-proses";
import { daftarkanPenanganBaca } from "@/lib/pembaca/penangan";
import { HALAMAN_KOSONG, buatPembacaRekaman } from "@/lib/pembaca/rekaman";
import { buatProyekDariPdf } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

const pos = null;
const uk = (item: string, sumbu: "lebar" | "tinggi", nilai_mm: number) => ({
  item, sumbu, nilai_mm, tertulis: String(nilai_mm), status: "gambar" as const, kelompok: null, peran: "tunggal" as const, keyakinan: 90, posisi: pos,
});
const unit = (nama: string, jenis: "kabinet_bawah" | "kabinet_atas" | "lemari", bahan_utama: string | null = null) => ({ nama, jenis, bahan_utama, posisi: pos });

const rekaman = {
  2: {
    ...HALAMAN_KOSONG,
    jenis_halaman: "elevasi",
    unit: [unit("Kabinet bawah", "kabinet_bawah", "PVC Taco"), unit("Kabinet atas", "kabinet_atas", "Multipleks"), unit("Lemari", "lemari", "Blockboard")],
    ukuran: [uk("Kabinet bawah", "lebar", 3330), uk("Kabinet atas", "lebar", 3330), uk("Lemari", "lebar", 1000)],
    pintu: [
      { unit: "Kabinet bawah", letak: "bawah", fungsi: null, inset: null, jumlah: 4, lebar_mm: null, tinggi_mm: null, posisi: pos },
      { unit: "Kabinet bawah", letak: "bawah", fungsi: "sink", inset: null, jumlah: 1, lebar_mm: null, tinggi_mm: null, posisi: pos },
      { unit: "Kabinet atas", letak: "atas", fungsi: null, inset: null, jumlah: 3, lebar_mm: 450, tinggi_mm: 720, posisi: pos },
    ],
    laci: [
      { unit: "Kabinet bawah", letak: "kabinet_bawah", urutan: "paling_atas", jumlah: 3, posisi: pos },
      { unit: "Lemari", letak: "lemari", urutan: null, jumlah: 2, posisi: pos },
    ],
  },
};

describe("hasil keluar otomatis setelah lembar kerja dibaca", () => {
  let db: Db;
  let proyekId: string;
  let ws: string;
  let admin: { id: string; peran: "admin" };

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    ws = s.workspace.id;
    admin = { id: s.admin.id, peran: "admin" };
    const st = penyimpananLokal(fs.mkdtempSync(path.join(os.tmpdir(), "uji-est-")), randomBytes(32).toString("hex"));
    daftarkanPenanganPdf(st);
    daftarkanPenanganBaca({ pembaca: buatPembacaRekaman(rekaman), st });
    daftarkanPenanganHitung();
    const f = path.join(os.tmpdir(), `est-${Date.now()}.pdf`);
    execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(3): d.new_page()\nd.save(sys.argv[1])", f]);
    const { proyek } = await buatProyekDariPdf(db, admin, st, { workspaceId: ws, namaFile: "k.pdf", data: fs.readFileSync(f) });
    proyekId = proyek.id;
    await jalankanSatu(db); // render
    await jalankanSatu(db); // baca
    await jalankanSatu(db); // hitung otomatis
    fs.rmSync(f, { force: true });
  }, 60000);

  it("estimasi versi 1 tercipta otomatis dan mencatat versi RuleSet", async () => {
    const e = (await estimasiTerbaru(db, proyekId))!;
    expect(e.versi).toBe(1);
    expect(e.ruleSetVersi).toBe(1);
    expect(e.status).toBe("draf");
  });

  it("angka mengikuti rumus yang diberikan (hitungan tangan)", async () => {
    const h = (await estimasiTerbaru(db, proyekId))!.hasil as unknown as HasilMesin;
    // meter kabinet = 3,33 + 3,33 = 6,66 m
    expect(h.standar.material_18.jumlah).toBe(14);        // 6,66 x 2 = 13,32 -> 14
    expect(h.standar.material_6.jumlah).toBe(4);          // 6,66 x 0,5 = 3,33 -> 4
    expect(h.standar.sekrup_5cm.jumlah).toBe(167);        // 6,66 x 25 = 166,5 -> 167
    expect(h.standar.tahanan_hambalan.jumlah).toBe(80);   // 6,66 x 12 = 79,92 -> 80
    expect(h.standar.led_strip.jumlah).toBe(2);           // meter kitchen 3,33 x 0,5 = 1,665 -> 2
    expect(h.standar.handle.jumlah).toBe(8);              // 4 + 1 + 3 pintu
    expect(h.standar.hanger.jumlah).toBe(1);              // 1 lemari
    expect(h.hardware.engsel.jumlah).toBe(8);
    expect(h.hardware.ventilasi.jumlah).toBe(1);          // pintu sink
    expect(h.hardware["Rel 50"].jumlah).toBe(3);
    expect(h.hardware["Rel 45"].jumlah).toBe(2);
    expect(h.hardware.rak_sendok.jumlah).toBe(1);
    expect(h.sekrup.sekrup_5_8.jumlah).toBe(8 * 4 + 5 * 14);   // engsel 8 psg, rel 5 psg
    expect(h.sekrup.sekrup_7_fisher.jumlah).toBe(9);      // 3,33 x 3 = 9,99 -> 9 (dibulatkan ke bawah, asumsi)
  });

  it("pintu tanpa ukuran memakai ukuran asumsi dan ditandai; yang berukuran memakai ukuran gambar", async () => {
    const e = (await estimasiTerbaru(db, proyekId))!;
    const m = e.masukan as unknown as ReturnType<typeof turunkanMasukan>;
    expect(m.pintu_bawah_asumsi).toBe(5);
    expect(m.pintu_atas_asumsi).toBe(0);
    expect(m.parts).toHaveLength(3);
    expect(m.parts[0]).toMatchObject({ panjang: 720, lebar: 450, status_ukuran: "gambar" });
    const h = e.hasil as unknown as HasilMesin;
    expect(h.pintu_asumsi.pintu_bawah_teoritis.status).toBe("asumsi");
  });

  it("yang tidak diketahui tidak dihitung sebagai nol", async () => {
    const h = (await estimasiTerbaru(db, proyekId))!.hasil as unknown as HasilMesin;
    expect(h.sekrup.gp3).toBeUndefined();                  // titik sambungan belum diisi
    expect(h.hardware.engsel_robot).toBeUndefined();       // sudut robot belum diisi
    // logika bahan pintu (SOP pengguna): 5 pintu bawah tanpa ukuran -> ceil(5 / 5) = 1 lembar; pintu atas berukuran gambar -> tidak ada
    expect(h.standar.pintu_bawah_lembar.jumlah).toBe(1);
    expect(h.standar.pintu_bawah_lembar.asal_bukti).toBe("catalog_stated");
    expect(h.standar.pintu_atas_lembar).toBeUndefined();
    // papan dipecah menurut bahan utama unit: bawah PVC 3,33 m, atas multipleks 3,33 m
    expect(h.standar.papan18_pvc.jumlah).toBe(7);          // 3,33 x 2 = 6,66 -> 7
    expect(h.standar.papan18_multipleks.jumlah).toBe(7);
    expect(h.standar.papan6_pvc.jumlah).toBe(2);           // 3,33 x 0,5 = 1,665 -> 2
    expect(h.standar.papan6_multipleks.jumlah).toBe(2);
    expect(h.standar.papan18_tidak_diketahui).toBeUndefined();
    // HPL muka pintu kini dihitung otomatis dari 8 pintu (1 muka per pintu), sehingga lem ikut dihitung
    expect(h.standar.hpl_pintu.jumlah).toBeGreaterThanOrEqual(1);
    expect(h.standar.lem_galon.jumlah).toBe(Math.ceil(h.standar.hpl_pintu.jumlah / 3));
    // AICA: panjang = lebar kabinet bawah 3330 mm; kedalaman tidak terbaca -> standar 60 cm (asumsi, perlu konfirmasi)
    expect(h.standar.aica.jumlah).toBe(1);
    expect(h.standar.aica.perlu_konfirmasi).toBe(true);
  });

  it("pengguna mengisi masukan -> versi baru; versi lama tetap utuh; perubahan tercatat", async () => {
    const baru = await ubahMasukan(db, admin, ws, proyekId, { titik_sambungan: 100, jumlah_sudut_robot: 2 });
    expect(baru.versi).toBe(2);
    const h2 = baru.hasil as unknown as HasilMesin;
    expect(h2.sekrup.gp3.jumlah).toBe(65);                 // 100 x 1,3 = 130 / 2
    expect(h2.hardware.engsel_robot.jumlah).toBe(2);
    expect(h2.standar.material_18.jumlah).toBe(14);        // tidak berubah
    const semua = await db.select().from(schema.estimasi).where(eq(schema.estimasi.proyekId, proyekId));
    expect(semua).toHaveLength(2);
    const v1 = semua.find((x) => x.versi === 1)!.hasil as unknown as HasilMesin;
    expect(v1.sekrup.gp3).toBeUndefined();
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.aksi, "ubah"));
    expect(log.some((l) => l.entitas === "estimasi_masukan")).toBe(true);
  });

  it("purchasing tidak boleh mengubah masukan", async () => {
    await expect(ubahMasukan(db, { id: admin.id, peran: "purchasing" }, ws, proyekId, { titik_sambungan: 1 })).rejects.toThrow(DilarangError);
  });
});

describe("turunkanMasukan murni", () => {
  it("tanpa data baca: semua null/tidak_ada, bukan nol", () => {
    const m = turunkanMasukan([], []);
    expect(m.meter_kabinet.nilai).toBeNull();
    expect(m.pintu.nilai).toBeNull();
    expect(m.unit_tarik.nilai).toBeNull();
    expect(m.jumlah_lemari.nilai).toBeNull();
  });
  it("tinggi unit di luar 70–80 cm menandai tidak standar", () => {
    const m = turunkanMasukan(
      [{ nama: "Kabinet atas", jenis: "kabinet_atas", halamanSemua: [1] }],
      [
        { jenis: "ukuran", kunci: "x", nilai: "820", halaman: 1, unitNama: "Kabinet atas", data: { sumbu: "tinggi", nilaiMm: 820, peran: "tunggal" } },
        { jenis: "ukuran", kunci: "y", nilai: "3330", halaman: 1, unitNama: "Kabinet atas", data: { sumbu: "lebar", nilaiMm: 3330, peran: "tunggal" } },
      ],
    );
    expect(m.tinggi_standar.nilai).toBe(false);
    expect(m.tinggi_standar.catatan[0]).toContain("820");
    expect(m.meter_atas.nilai).toBeCloseTo(3.33);
  });
});
