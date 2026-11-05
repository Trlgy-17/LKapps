import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema } from "@/db";
import { jalankanSatu } from "@/lib/antrean";
import { daftarkanPenanganPdf, pythonBin } from "@/lib/pdf-proses";
import { daftarkanPenanganBaca, pesanGalat } from "@/lib/pembaca/penangan";
import { HALAMAN_KOSONG } from "@/lib/pembaca/rekaman";
import { buatProyekDariPdf, cobaLagi, lembarKerjaTerbaru } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

it("galat kunci API diterjemahkan jadi pesan yang bisa ditindaklanjuti", () => {
  const m = pesanGalat(new Error("Could not resolve authentication method. Expected one of apiKey"));
  expect(m).toContain("ANTHROPIC_API_KEY");
  expect(m).toContain("Coba lagi");
  expect(pesanGalat(new Error("fetch failed"))).toContain("koneksi");
  expect(pesanGalat(new Error("lain"))).toBe("lain");
});

it("baca AI gagal: coba lagi hanya mengulang pembacaan, halaman tidak dirender ulang", async () => {
  const db = await buatDb({ memori: true });
  const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
  const st = penyimpananLokal(fs.mkdtempSync(path.join(os.tmpdir(), "uji-cl-")), randomBytes(32).toString("hex"));
  const admin = { id: s.admin.id, peran: "admin" as const };
  const f = path.join(os.tmpdir(), `cl-${Date.now()}.pdf`);
  execFileSync(pythonBin(), ["-c", "import pymupdf,sys\nd=pymupdf.open()\nfor i in range(2): d.new_page()\nd.save(sys.argv[1])", f]);

  daftarkanPenanganPdf(st);
  daftarkanPenanganBaca({
    st,
    pembaca: { bacaHalaman: async () => { throw new Error("Could not resolve authentication method"); } },
  });
  const { proyek } = await buatProyekDariPdf(db, admin, st, { workspaceId: s.workspace.id, namaFile: "k.pdf", data: fs.readFileSync(f) });
  await jalankanSatu(db); // render
  await jalankanSatu(db); // baca -> gagal
  const gagal = (await lembarKerjaTerbaru(db, proyek.id))!;
  expect(gagal.status).toBe("gagal");
  expect(gagal.galat).toContain("ANTHROPIC_API_KEY");
  const hal1 = await db.select().from(schema.halamanLembar).where(eq(schema.halamanLembar.lembarKerjaId, gagal.id));
  expect(hal1).toHaveLength(2);

  await cobaLagi(db, admin, s.workspace.id, proyek.id);
  daftarkanPenanganBaca({ st, pembaca: { bacaHalaman: async () => HALAMAN_KOSONG } });
  const job = await jalankanSatu(db);
  expect(job?.jenis).toBe("baca_ai");                         // bukan baca_pdf
  const ok = (await lembarKerjaTerbaru(db, proyek.id))!;
  expect(ok.status).toBe("selesai");
  const hal2 = await db.select().from(schema.halamanLembar).where(eq(schema.halamanLembar.lembarKerjaId, ok.id));
  expect(hal2.map((h) => h.id).sort()).toEqual(hal1.map((h) => h.id).sort());   // halaman yang sama, tidak dibuat ulang
  fs.rmSync(f, { force: true });
}, 60000);
