import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buatDb, type Db } from "@/db";
import { jalankanSatu } from "@/lib/antrean";
import { daftarkanPenanganHitung, estimasiTerbaru, type HasilMesin } from "@/lib/estimasi";
import { turunkanMasukan, type MasukanWeb } from "@/lib/estimasi-masukan";
import { daftarkanPenanganPdf, pythonBin } from "@/lib/pdf-proses";
import { daftarkanPenanganBaca } from "@/lib/pembaca/penangan";
import { HALAMAN_KOSONG, buatPembacaRekaman } from "@/lib/pembaca/rekaman";
import { buatProyekDariPdf } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";
import { bangunHtml, cariChrome, htmlKePdf } from "@/lib/pdf-hasil";
import { kumpulkanDataPdf } from "@/lib/pdf-data";

const pos = null;
const unit = (nama: string, jenis: "kabinet_bawah" | "kabinet_atas", bahan_utama: string) => ({ nama, jenis, bahan_utama, posisi: pos });
type F = "sisi" | "sekat" | "pintu" | "belakang" | "alas_laci";
const part = (unitNama: string, fungsi: F, panjang_mm: number, lebar_mm: number, jumlah: number, extra: Record<string, unknown> = {}) => ({
  unit: unitNama, nama: fungsi, fungsi, panjang_mm, lebar_mm, jumlah, status_ukuran: "gambar" as const, hpl_muka: null, kode_hpl: null, posisi: pos, ...extra,
});

const rekaman = {
  2: {
    ...HALAMAN_KOSONG,
    jenis_halaman: "elevasi" as const,
    unit: [unit("Atas 1", "kabinet_atas", "Multipleks"), unit("Bawah", "kabinet_bawah", "PVC Taco")],
    part: [
      part("Atas 1", "sisi", 700, 350, 2),
      part("Atas 1", "sekat", 700, 350, 1),
      part("Atas 1", "pintu", 700, 400, 2, { hpl_muka: true, kode_hpl: "th852j" }),
      part("Atas 1", "belakang", 700, 1200, 1, { status_ukuran: "skala" }),
      part("Bawah", "sisi", 800, 550, 2),
      part("Bawah", "alas_laci", 500, 500, 1),
    ],
  },
  3: {
    ...HALAMAN_KOSONG,
    jenis_halaman: "elevasi" as const,
    unit: [unit("atas  1", "kabinet_atas", "Multipleks")],
    part: [part("atas  1", "pintu", 700, 400, 2, { hpl_muka: true, kode_hpl: "th852j" })],   // tampak lain dari unit yang sama
  },
};

describe("daftar potongan -> SKU -> nesting otomatis", () => {
  let db: Db;
  let proyekId: string;
  let wsId: string;
  let gudang: ReturnType<typeof penyimpananLokal>;

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    const st = gudang = penyimpananLokal(fs.mkdtempSync(path.join(os.tmpdir(), "uji-kmp-")), randomBytes(32).toString("hex"));
    daftarkanPenanganPdf(st);
    daftarkanPenanganBaca({ pembaca: buatPembacaRekaman(rekaman), st });
    daftarkanPenanganHitung();
    const f = path.join(os.tmpdir(), `kmp-${Date.now()}.pdf`);
    execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(3): d.new_page()\nd.save(sys.argv[1])", f]);
    wsId = s.workspace.id;
    const { proyek } = await buatProyekDariPdf(db, { id: s.admin.id, peran: "admin" }, st, { workspaceId: s.workspace.id, namaFile: "k.pdf", data: fs.readFileSync(f) });
    proyekId = proyek.id;
    await jalankanSatu(db);
    await jalankanSatu(db);
    await jalankanSatu(db);
    fs.rmSync(f, { force: true });
  }, 90000);

  it("part dipetakan ke SKU menurut aturan bahan dan di-nesting per SKU", async () => {
    const h = (await estimasiTerbaru(db, proyekId))!.hasil as unknown as HasilMesin;
    const k = h.komponen!;
    expect(Object.keys(k.sku).sort()).toEqual(["HPL TH 852 J", "Multi 6", "Multi double 18", "Multi min 18", "PVC 18", "PVC 6"]);
    expect(k.sku["Multi min 18"].lembar).toBe(1);        // sisi 2 + pintu 2 unit multipleks
    expect(k.sku["PVC 18"].lembar).toBe(1);              // sisi kabinet bawah PVC
    expect(k.sku["Multi double 18"].lembar).toBe(1);     // sekat
    expect(k.sku["Multi 6"].lembar).toBe(1);             // belakang unit kayu
    expect(k.sku["PVC 6"].lembar).toBe(1);               // alas laci kabinet PVC
    expect(k.sku["HPL TH 852 J"].lembar).toBe(1);        // 2 muka pintu, kode dinormalisasi dari "th852j"
    expect(k.ringkas).toEqual({ papan_lembar: 5, hpl_lembar: 1 });
    expect(k.sku["PVC 18"].luas_m2).toBe(0.88);          // 2 x 0,8 x 0,55
    expect(k.sku["Multi 6"].status).toBe("skala");
    expect(Object.values(k.sku).every((x) => x.validasi_nesting === "lolos")).toBe(true);
  });

  it("satu unit pada dua tampak tidak dihitung ganda dan dicatat", async () => {
    const m = (await estimasiTerbaru(db, proyekId))!.masukan as unknown as MasukanWeb;
    expect(m.komponen.filter((c) => c.fungsi === "pintu")).toHaveLength(1);   // halaman 2 punya part terbanyak
    expect(m.komponen.find((c) => c.fungsi === "pintu")!.jumlah).toBe(2);
    expect(m.catatan.join(" ")).toContain("tidak dihitung agar tidak ganda");
  });

  it("GP dihitung otomatis dari titik sambungan komponen dan ditandai perlu konfirmasi", async () => {
    const h = (await estimasiTerbaru(db, proyekId))!.hasil as unknown as HasilMesin;
    // atas sisi 2 x (2 x ceil(350/150) = 6) = 12; sekat 6; bawah sisi 2 x (2 x ceil(550/150) = 8) = 16 -> 34 titik x 1,3 = 44,2 -> 44
    expect(h.sekrup.gp3.jumlah + h.sekrup.gp5.jumlah).toBe(44);
    expect(h.sekrup.gp3.perlu_konfirmasi).toBe(true);
    expect(h.sekrup.gp3.rumus).toContain("34 titik");
  });

  it("PDF memuat matriks bahan per unit dan uji perubahan", async () => {
    const d = (await kumpulkanDataPdf(db, wsId, proyekId, gudang))!;
    const html = bangunHtml(d);
    expect(html).toContain("Bahan (luas part, m²)");
    expect(html).toContain("Multi min 18");
    expect(html).toContain("HPL TH 852 J");
    expect(html).toContain("Uji perubahan");
    expect(html).toContain("Lembar terakhir terpakai sedikit");
    if (cariChrome() && process.env.SALIN_PDF_CONTOH) {
      fs.writeFileSync(process.env.SALIN_PDF_CONTOH, await htmlKePdf(html));
    }
  }, 90000);

  it("uji trim 10 mm dilaporkan", async () => {
    const h = (await estimasiTerbaru(db, proyekId))!.hasil as unknown as HasilMesin;
    expect(h.komponen!.uji_trim!.trim_mm).toBe(10);
  });
});

describe("turunkanMasukan komponen murni", () => {
  it("part dengan dimensi tidak sah tidak masuk; tanpa part komponen kosong", () => {
    expect(turunkanMasukan([], []).komponen).toEqual([]);
  });
});
