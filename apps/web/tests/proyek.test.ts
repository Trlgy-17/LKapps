import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema, type Db } from "@/db";
import { daftarkanPenanganPdf, pythonBin } from "@/lib/pdf-proses";
import { daftarkanPenanganBaca } from "@/lib/pembaca/penangan";
import { buatPembacaRekaman } from "@/lib/pembaca/rekaman";
import { jalankanSatu, pulihkanJob } from "@/lib/antrean";
import { DilarangError } from "@/lib/permissions";
import {
  BATAS_BYTE, UnggahDitolak, ambilProyek, buatProyekDariPdf, cobaLagi, halamanLembar,
  lembarKerjaTerbaru, periksaPdf, ubahDataProyek,
} from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uji-estimasi-"));
const kunci = randomBytes(32).toString("hex");

function buatPdf(file: string, halaman: number) {
  const skrip = `import pymupdf,sys\nd=pymupdf.open()\nfor i in range(${halaman}):\n p=d.new_page(width=842,height=595); p.insert_text((50,50),'Halaman %d'%(i+1))\nd.save(sys.argv[1])`;
  execFileSync(pythonBin(), ["-c", skrip, file]);
}

describe("penyimpanan terenkripsi", () => {
  const st = penyimpananLokal(path.join(tmp, "enk"), kunci);
  it("bolak-balik sama dan file di disk bukan teks asli", async () => {
    await st.simpan("a/b/c.bin", Buffer.from("rahasia klien"));
    expect((await st.baca("a/b/c.bin")).toString()).toBe("rahasia klien");
    expect(fs.readFileSync(path.join(tmp, "enk", "a", "b", "c.bin")).includes("rahasia klien")).toBe(false);
  });
  it("file yang diubah terdeteksi", async () => {
    await st.simpan("x/y.bin", Buffer.from("isi"));
    const f = path.join(tmp, "enk", "x", "y.bin");
    const b = fs.readFileSync(f);
    b[b.length - 1] ^= 1;
    fs.writeFileSync(f, b);
    await expect(st.baca("x/y.bin")).rejects.toThrow();
  });
  it("menolak kunci berbahaya dan kunci enkripsi salah", async () => {
    await expect(st.simpan("../keluar", Buffer.from("x"))).rejects.toThrow();
    expect(() => penyimpananLokal(tmp, "pendek")).toThrow();
  });
});

describe("validasi unggah (FR-02)", () => {
  it("menolak bukan PDF, kosong, isi palsu, dan di atas 50 MB", () => {
    expect(() => periksaPdf("a.txt", Buffer.from("%PDF-"))).toThrow(UnggahDitolak);
    expect(() => periksaPdf("a.pdf", Buffer.alloc(0))).toThrow(UnggahDitolak);
    expect(() => periksaPdf("a.pdf", Buffer.from("halo dunia"))).toThrow(UnggahDitolak);
    const besar = Buffer.alloc(BATAS_BYTE + 1);
    besar.write("%PDF-");
    expect(() => periksaPdf("a.pdf", besar)).toThrow(/50 MB/);
  });
  it("menerima PDF tepat 50 MB", () => {
    const b = Buffer.alloc(BATAS_BYTE);
    b.write("%PDF-");
    expect(() => periksaPdf("a.pdf", b)).not.toThrow();
  });
});

describe("proyek dari PDF", () => {
  let db: Db;
  let ws: string;
  const st = penyimpananLokal(path.join(tmp, "berkas"), kunci);
  let admin: { id: string; peran: "admin" };

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    ws = s.workspace.id;
    admin = { id: s.admin.id, peran: "admin" };
    daftarkanPenanganPdf(st);
    daftarkanPenanganBaca({ pembaca: buatPembacaRekaman({}), st });
  });

  it("PDF 17 halaman terbaca tanpa gagal, tiap halaman punya thumbnail dan progres", async () => {
    const f = path.join(tmp, "septi.pdf");
    buatPdf(f, 17);
    const { proyek, lembarKerja } = await buatProyekDariPdf(db, admin, st, {
      workspaceId: ws, namaFile: "septi.pdf", data: fs.readFileSync(f),
    });
    expect(lembarKerja.status).toBe("diunggah");

    const job = await jalankanSatu(db);
    expect(job?.jenis).toBe("baca_pdf");
    expect((await lembarKerjaTerbaru(db, proyek.id))?.status).toBe("membaca"); // render selesai, baca belum
    expect((await jalankanSatu(db))?.jenis).toBe("baca_ai");
    expect((await jalankanSatu(db))?.jenis).toBe("hitung_estimasi"); // menyusul otomatis

    const lk = await lembarKerjaTerbaru(db, proyek.id);
    expect(lk?.status).toBe("selesai");
    expect(lk?.halamanDibaca).toBe(17);
    expect(lk?.halaman).toBe(17);
    const hal = await halamanLembar(db, lk!.id);
    expect(hal.map((h) => h.nomor)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    const png = await st.baca(hal[16].kunciThumb);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    const [j] = await db.select().from(schema.job).where(eq(schema.job.id, job!.id));
    expect(j.status).toBe("selesai");
    expect([j.progres, j.total]).toEqual([17, 17]);
  });

  it("PDF rusak gagal dengan pesan jelas, lalu bisa dicoba lagi", async () => {
    const { proyek } = await buatProyekDariPdf(db, admin, st, {
      workspaceId: ws, namaFile: "rusak.pdf", data: Buffer.from("%PDF-1.4\nrusak total"),
    });
    await jalankanSatu(db);
    const lk = await lembarKerjaTerbaru(db, proyek.id);
    expect(lk?.status).toBe("gagal");
    expect(lk?.galat).toBeTruthy();
    await cobaLagi(db, admin, ws, proyek.id);
    expect((await lembarKerjaTerbaru(db, proyek.id))?.status).toBe("diunggah");
    expect((await jalankanSatu(db))?.jenis).toBe("baca_pdf");
  });

  it("job yang terputus saat server mati diantrekan ulang", async () => {
    const f = path.join(tmp, "kecil.pdf");
    buatPdf(f, 1);
    await buatProyekDariPdf(db, admin, st, { workspaceId: ws, namaFile: "kecil.pdf", data: fs.readFileSync(f) });
    const [j] = await db.select().from(schema.job).where(eq(schema.job.status, "antre"));
    await db.update(schema.job).set({ status: "jalan" }).where(eq(schema.job.id, j.id));
    await pulihkanJob(db);
    const [sesudah] = await db.select().from(schema.job).where(eq(schema.job.id, j.id));
    expect(sesudah.status).toBe("antre");
    await jalankanSatu(db);
  });

  it("purchasing tidak boleh membuat proyek", async () => {
    await expect(
      buatProyekDariPdf(db, { id: admin.id, peran: "purchasing" }, st, {
        workspaceId: ws, namaFile: "x.pdf", data: Buffer.from("%PDF-1.4"),
      }),
    ).rejects.toThrow(DilarangError);
  });

  it("proyek tidak terbaca dari workspace lain", async () => {
    const [p] = await db.select().from(schema.proyek).limit(1);
    expect(await ambilProyek(db, ws, p.id)).not.toBeNull();
    expect(await ambilProyek(db, "00000000-0000-0000-0000-000000000000", p.id)).toBeNull();
  });

  it("ubah data proyek tercatat: nilai lama dan baru", async () => {
    const [p] = await db.select().from(schema.proyek).limit(1);
    await ubahDataProyek(db, admin, ws, p.id, { klien: "Ibu Septi", lokasi: "Surabaya" });
    await ubahDataProyek(db, admin, ws, p.id, { klien: "Ibu Septi Rahayu" });
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entitasId, p.id));
    const ubah = log.filter((l) => l.aksi === "ubah");
    expect(ubah.length).toBe(2);
    expect(ubah[1].nilaiLama).toEqual({ klien: "Ibu Septi" });
    expect(ubah[1].nilaiBaru).toEqual({ klien: "Ibu Septi Rahayu" });
  });
}, 120000);
