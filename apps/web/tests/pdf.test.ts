import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buatDb, type Db } from "@/db";
import { jalankanSatu } from "@/lib/antrean";
import { daftarkanPenanganHitung } from "@/lib/estimasi";
import { daftarkanPenanganPdf, pythonBin } from "@/lib/pdf-proses";
import { daftarkanPenanganBaca } from "@/lib/pembaca/penangan";
import { HALAMAN_KOSONG, buatPembacaRekaman } from "@/lib/pembaca/rekaman";
import { bangunHtml, cariChrome, htmlKePdf } from "@/lib/pdf-hasil";
import { kumpulkanDataPdf, namaBerkasPdf } from "@/lib/pdf-data";
import { buatProyekDariPdf, ubahDataProyek } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

const pos = null;
const uk = (item: string, sumbu: "lebar" | "tinggi" | "kedalaman", nilai_mm: number) => ({
  item, sumbu, nilai_mm, tertulis: String(nilai_mm), status: "gambar" as const, kelompok: null, peran: "tunggal" as const, keyakinan: 90, posisi: pos,
});
const unit = (nama: string, jenis: "kabinet_bawah" | "kabinet_atas" | "lemari") => ({ nama, jenis, bahan_utama: "Multipleks", posisi: pos });
const rekaman = {
  2: {
    ...HALAMAN_KOSONG,
    jenis_halaman: "denah" as const,
    lembar_tercetak: "01",
    unit: [unit("Kabinet bawah", "kabinet_bawah"), unit("Kabinet atas", "kabinet_atas"), unit("Lemari", "lemari")],
    ukuran: [
      uk("Kabinet bawah", "lebar", 3330), uk("Kabinet bawah", "kedalaman", 600), uk("Kabinet atas", "lebar", 3330), uk("Lemari", "lebar", 1000),
      uk("Kulkas", "lebar", 700), uk("Kulkas", "tinggi", 1775),
    ],
    spek: [{ kunci: "kode_hpl" as const, unit: null, nilai: "th852j", keyakinan: 90, posisi: pos }],
    pintu: [
      { unit: "Kabinet bawah", letak: "bawah" as const, fungsi: null, inset: null, jumlah: 4, lebar_mm: null, tinggi_mm: null, posisi: pos },
      { unit: "Kabinet atas", letak: "atas" as const, fungsi: null, inset: null, jumlah: 3, lebar_mm: 450, tinggi_mm: 720, posisi: pos },
    ],
    laci: [{ unit: "Kabinet bawah", letak: "kabinet_bawah" as const, urutan: "paling_atas" as const, jumlah: 3, posisi: pos }],
  },
  3: { ...HALAMAN_KOSONG, ukuran: [uk("Kulkas", "lebar", 920)] },
};

const adaChrome = cariChrome() !== null;

describe.skipIf(!adaChrome)("PDF hasil estimasi", () => {
  let db: Db;
  let ws: string;
  let proyekId: string;
  let st: ReturnType<typeof penyimpananLokal>;

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    ws = s.workspace.id;
    const admin = { id: s.admin.id, peran: "admin" as const };
    st = penyimpananLokal(fs.mkdtempSync(path.join(os.tmpdir(), "uji-pdf-")), randomBytes(32).toString("hex"));
    daftarkanPenanganPdf(st);
    daftarkanPenanganBaca({ pembaca: buatPembacaRekaman(rekaman), st });
    daftarkanPenanganHitung();
    const f = path.join(os.tmpdir(), `pdf-${Date.now()}.pdf`);
    execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(3): d.new_page()\nd.save(sys.argv[1])", f]);
    const { proyek } = await buatProyekDariPdf(db, admin, st, { workspaceId: ws, namaFile: "k.pdf", data: fs.readFileSync(f) });
    proyekId = proyek.id;
    await ubahDataProyek(db, admin, ws, proyekId, { klien: "Ibu <Septi> & Co", lokasi: "Sukabumi", pekerjaan: "Kitchenset & Lemari", surveyor: "Luki", tanggalGambar: "2026-10-27" });
    await jalankanSatu(db);
    await jalankanSatu(db);
    await jalankanSatu(db);
    fs.rmSync(f, { force: true });
  }, 90000);

  it("HTML memuat angka, status, konflik, dan meloloskan karakter khusus", async () => {
    const d = (await kumpulkanDataPdf(db, ws, proyekId, st))!;
    const html = bangunHtml(d);
    expect(html).toContain("Estimasi Belanja Material");
    expect(html).toContain("Ibu &lt;Septi&gt; &amp; Co");        // escape
    expect(html).not.toContain("Ibu <Septi>");
    expect(html).toContain("Konfirmasi Sebelum Belanja");
    expect(html).toContain("DRAF");
    expect(html).toContain(">14<");                              // material 18 mm: 6,66 m x 2 -> 14 lembar
    expect(html).toContain("27/10/2026");
    expect(html).toContain("Kulkas");                            // deskripsi konflik
  });

  it("PDF 5 halaman A4 lanskap dengan isi yang benar", async () => {
    const d = (await kumpulkanDataPdf(db, ws, proyekId, st))!;
    const pdf = await htmlKePdf(bangunHtml(d));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const f = path.join(os.tmpdir(), `hasil-${Date.now()}.pdf`);
    fs.writeFileSync(f, pdf);
    const ref = process.env.SALIN_PDF_CONTOH;
    if (ref) fs.writeFileSync(ref, pdf);
    const out = execFileSync(pythonBin(), ["-I", "-c",
      "import pymupdf,sys,json\nd=pymupdf.open(sys.argv[1])\nprint(json.dumps({'n':d.page_count,'w':round(d[0].rect.width),'h':round(d[0].rect.height),'t':[p.get_text() for p in d],'img':[len(p.get_images()) for p in d]}))", f]).toString();
    fs.rmSync(f, { force: true });
    const j = JSON.parse(out) as { n: number; w: number; h: number; t: string[]; img: number[] };
    expect(j.n).toBe(5);
    expect([j.w, j.h]).toEqual([842, 595]);                      // A4 lanskap
    expect(j.t[0]).toContain("Estimasi Belanja Material");
    expect(j.t[0]).toContain("Material 18 mm");
    expect(j.t[3]).toContain("Konfirmasi Sebelum Belanja");
    expect(j.t[4]).toContain("Dasar Hitungan");
    expect(j.t[0]).toContain("1 / 5");
    expect(j.t[0]).toContain("AICA");                            // AICA ikut ukuran keseluruhan kabinet bawah
    expect(j.img[1]).toBeGreaterThanOrEqual(2);                  // logo + gambar denah dari lembar kerja
    expect(j.t[1]).toContain("Denah");
    expect(j.t[1]).toContain("lembar 01");
  }, 90000);

  it("nama berkas aman", () => {
    expect(namaBerkasPdf("Ibu Septi / Sukabumi")).toBe("Estimasi_Material_Ibu_Septi_Sukabumi.pdf");
    expect(namaBerkasPdf("")).toBe("Estimasi_Material_Proyek.pdf");
  });
});
