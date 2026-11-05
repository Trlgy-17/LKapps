import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema, type Db } from "@/db";
import { jalankanSatu } from "@/lib/antrean";
import { daftarkanPenanganPdf, pythonBin } from "@/lib/pdf-proses";
import { daftarkanPenanganBaca } from "@/lib/pembaca/penangan";
import { deteksiKonflik, type UkuranBaca } from "@/lib/pembaca/konflik";
import { HALAMAN_KOSONG, buatPembacaRekaman } from "@/lib/pembaca/rekaman";
import { SkemaHalaman } from "@/lib/pembaca/skema";
import { buatProyekDariPdf, lembarKerjaTerbaru } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

const u = (p: Partial<UkuranBaca> & Pick<UkuranBaca, "halaman" | "item" | "sumbu" | "nilaiMm">): UkuranBaca => ({
  kelompok: null, peran: "tunggal", posisi: null, ...p,
});

describe("deteksi konflik oleh kode (FR-13)", () => {
  it("kulkas 70 x 177,5 vs 92 x 179 terdeteksi sebagai satu konflik dengan dua opsi", () => {
    const k = deteksiKonflik([
      u({ halaman: 3, item: "Kulkas", sumbu: "lebar", nilaiMm: 700 }),
      u({ halaman: 3, item: "Kulkas", sumbu: "tinggi", nilaiMm: 1775 }),
      u({ halaman: 7, item: "kulkas", sumbu: "lebar", nilaiMm: 920 }),
      u({ halaman: 7, item: "kulkas", sumbu: "tinggi", nilaiMm: 1790 }),
    ]);
    expect(k).toHaveLength(1);
    expect(k[0].jenis).toBe("ukuran_berbeda");
    expect(k[0].opsi.map((o) => o.nilai)).toEqual([
      { lebar: 700, tinggi: 1775 },
      { lebar: 920, tinggi: 1790 },
    ]);
    expect(k[0].opsi[0].label).toContain("hal. 3");
    expect(k[0].opsi[0].label).toContain("1.775");
  });

  it("52 + 85 tidak sama dengan 134 terdeteksi", () => {
    const k = deteksiKonflik([
      u({ halaman: 5, item: "Sekat", sumbu: "lebar", nilaiMm: 520, kelompok: "a", peran: "bagian" }),
      u({ halaman: 5, item: "Sekat", sumbu: "lebar", nilaiMm: 850, kelompok: "a", peran: "bagian" }),
      u({ halaman: 5, item: "Sekat", sumbu: "lebar", nilaiMm: 1340, kelompok: "a", peran: "total" }),
    ]);
    expect(k).toHaveLength(1);
    expect(k[0].jenis).toBe("jumlah_tidak_sama");
    expect(k[0].deskripsi).toContain("520 + 850 = 1.370");
    expect(k[0].deskripsi).toContain("1.340");
  });

  it("rantai yang jumlahnya cocok dan ukuran yang sama antarhalaman tidak jadi konflik", () => {
    const k = deteksiKonflik([
      u({ halaman: 5, item: "Sekat", sumbu: "lebar", nilaiMm: 520, kelompok: "a", peran: "bagian" }),
      u({ halaman: 5, item: "Sekat", sumbu: "lebar", nilaiMm: 820, kelompok: "a", peran: "bagian" }),
      u({ halaman: 5, item: "Sekat", sumbu: "lebar", nilaiMm: 1340, kelompok: "a", peran: "total" }),
      u({ halaman: 1, item: "Kulkas", sumbu: "lebar", nilaiMm: 700 }),
      u({ halaman: 2, item: "Kulkas", sumbu: "lebar", nilaiMm: 700 }),
      u({ halaman: 2, item: "Kulkas", sumbu: "tinggi", nilaiMm: 1775 }), // sumbu hanya di satu halaman
    ]);
    expect(k).toEqual([]);
  });

  it("hasil sama untuk urutan masukan berbeda (deterministik)", () => {
    const data = [
      u({ halaman: 3, item: "Kulkas", sumbu: "lebar", nilaiMm: 700 }),
      u({ halaman: 7, item: "Kulkas", sumbu: "lebar", nilaiMm: 920 }),
      u({ halaman: 2, item: "Oven", sumbu: "lebar", nilaiMm: 600 }),
      u({ halaman: 4, item: "Oven", sumbu: "lebar", nilaiMm: 590 }),
    ];
    expect(deteksiKonflik([...data].reverse())).toEqual(deteksiKonflik(data));
  });
});

describe("skema keluaran pembaca", () => {
  it("menolak keluaran yang tidak sesuai skema", () => {
    expect(() => SkemaHalaman.parse({ ...HALAMAN_KOSONG, ukuran: [{ item: "x" }] })).toThrow();
    expect(() => SkemaHalaman.parse({ ...HALAMAN_KOSONG, jenis_halaman: "ngawur" })).toThrow();
    expect(SkemaHalaman.parse(HALAMAN_KOSONG)).toEqual(HALAMAN_KOSONG);
  });
});

describe("alur baca dengan rekaman AI (tanpa jaringan)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uji-baca-"));
  const st = penyimpananLokal(path.join(tmp, "berkas"), randomBytes(32).toString("hex"));
  let db: Db;
  let ws: string;
  let admin: { id: string; peran: "admin" };

  const pos = { x: 0.1, y: 0.2, w: 0.1, h: 0.05 };
  const rekaman = {
    1: {
      ...HALAMAN_KOSONG,
      jenis_halaman: "title_block",
      title_block: {
        klien: "Ibu Septi", lokasi: "Surabaya", pekerjaan: "Kitchen set", surveyor: "Budi",
        tanggal_gambar: "2026-10-20", keyakinan: 90, posisi: pos,
      },
    },
    2: {
      ...HALAMAN_KOSONG,
      jenis_halaman: "elevasi",
      unit: [{ nama: "Kabinet bawah", jenis: "kabinet_bawah", bahan_utama: "Multi min 18", posisi: pos }],
      spek: [{ kunci: "rel", unit: "Kabinet bawah", nilai: "Rel 50", keyakinan: 85, posisi: pos }],
      ukuran: [
        { item: "Kulkas", sumbu: "lebar", nilai_mm: 700, tertulis: "70", status: "gambar", kelompok: null, peran: "tunggal", keyakinan: 90, posisi: pos },
        { item: "Kulkas", sumbu: "tinggi", nilai_mm: 1775, tertulis: "177,5", status: "gambar", kelompok: null, peran: "tunggal", keyakinan: 90, posisi: pos },
      ],
      ukuran_hilang: [{ item: "Kabinet bawah", sumbu: "tinggi", alasan: "Tinggi tidak tertulis", posisi: null }],
    },
    3: {
      ...HALAMAN_KOSONG,
      jenis_halaman: "elevasi",
      ukuran: [
        { item: "kulkas", sumbu: "lebar", nilai_mm: 920, tertulis: "92", status: "gambar", kelompok: null, peran: "tunggal", keyakinan: 80, posisi: pos },
        { item: "Sekat", sumbu: "lebar", nilai_mm: 520, tertulis: "52", status: "gambar", kelompok: "k", peran: "bagian", keyakinan: 80, posisi: pos },
        { item: "Sekat", sumbu: "lebar", nilai_mm: 850, tertulis: "85", status: "gambar", kelompok: "k", peran: "bagian", keyakinan: 80, posisi: pos },
        { item: "Sekat", sumbu: "lebar", nilai_mm: 1340, tertulis: "134", status: "gambar", kelompok: "k", peran: "total", keyakinan: 80, posisi: pos },
      ],
    },
  };

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    ws = s.workspace.id;
    admin = { id: s.admin.id, peran: "admin" };
    daftarkanPenanganPdf(st);
    daftarkanPenanganBaca({ pembaca: buatPembacaRekaman(rekaman), st });
  });

  it("menyimpan nilai dengan halaman, menandai ukuran hilang, mendeteksi dua konflik, mengisi title block", async () => {
    const f = path.join(tmp, "x.pdf");
    execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(3): d.new_page()\nd.save(sys.argv[1])", f]);
    const { proyek } = await buatProyekDariPdf(db, admin, st, { workspaceId: ws, namaFile: "x.pdf", data: fs.readFileSync(f) });
    await jalankanSatu(db); // render
    await jalankanSatu(db); // baca
    await jalankanSatu(db); // job hitung_estimasi yang menyusul (penangan tidak terdaftar di berkas ini)

    const lk = (await lembarKerjaTerbaru(db, proyek.id))!;
    expect(lk.status).toBe("selesai");

    const bidang = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.lembarKerjaId, lk.id));
    expect(bidang.every((b) => b.halaman >= 1 && b.halaman <= 3)).toBe(true); // tiap nilai menunjuk halaman
    const hilang = bidang.filter((b) => b.jenis === "ukuran_hilang");
    expect(hilang).toHaveLength(1);
    expect(hilang[0].status).toBe("belum_ada");
    expect(hilang[0].nilai).toBe(""); // tidak ditebak
    const rel = bidang.find((b) => b.jenis === "spek" && b.kunci === "rel")!;
    expect(rel.halaman).toBe(2);
    expect(rel.posisi).toEqual(pos);

    const units = await db.select().from(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lk.id));
    expect(units.map((x) => x.nama)).toEqual(["Kabinet bawah"]);

    const ks = await db.select().from(schema.konflik).where(eq(schema.konflik.lembarKerjaId, lk.id));
    expect(ks.map((k) => k.jenis).sort()).toEqual(["jumlah_tidak_sama", "ukuran_berbeda"]);
    expect(ks.every((k) => k.jawaban === null)).toBe(true);

    const [p] = await db.select().from(schema.proyek).where(eq(schema.proyek.id, proyek.id));
    expect([p.klien, p.lokasi, p.tanggalGambar]).toEqual(["Ibu Septi", "Surabaya", "2026-10-20"]);
  });

  it("satu halaman gagal tidak menggagalkan lembar kerja: hasil tetap keluar, halaman gagal dicatat", async () => {
    const f = path.join(tmp, "y.pdf");
    execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(2): d.new_page()\nd.save(sys.argv[1])", f]);
    daftarkanPenanganBaca({
      st,
      pembaca: { bacaHalaman: async (_p, i) => { if (i.nomor === 2) throw new Error("jaringan putus"); return HALAMAN_KOSONG; } },
    });
    const { proyek } = await buatProyekDariPdf(db, admin, st, { workspaceId: ws, namaFile: "y.pdf", data: fs.readFileSync(f) });
    await jalankanSatu(db);
    await jalankanSatu(db);
    const lk = (await lembarKerjaTerbaru(db, proyek.id))!;
    expect(lk.status).toBe("selesai");
    expect(lk.halamanGagal).toEqual([2]);
    expect(lk.galat).toContain("Halaman 2");
  });

  it("semua halaman gagal: status gagal", async () => {
    await jalankanSatu(db); // kuras job hitung_estimasi sisa tes sebelumnya
    const f = path.join(tmp, "z.pdf");
    execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(2): d.new_page()\nd.save(sys.argv[1])", f]);
    daftarkanPenanganBaca({ st, pembaca: { bacaHalaman: async () => { throw new Error("jaringan putus"); } } });
    const { proyek } = await buatProyekDariPdf(db, admin, st, { workspaceId: ws, namaFile: "z.pdf", data: fs.readFileSync(f) });
    await jalankanSatu(db);
    await jalankanSatu(db);
    const lk = (await lembarKerjaTerbaru(db, proyek.id))!;
    expect(lk.status).toBe("gagal");
    expect(lk.galat).toContain("Semua halaman gagal");
    const bidang = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.lembarKerjaId, lk.id));
    expect(bidang).toHaveLength(0);
  });
}, 120000);
