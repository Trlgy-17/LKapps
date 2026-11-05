import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema } from "@/db";
import { HALAMAN_KOSONG } from "@/lib/pembaca/rekaman";
import { simpanHasilBaca } from "@/lib/pembaca/simpan";
import { buatProyekDariPdf } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

it("satu kabinet pada tiga tampak tetap satu unit; kode HPL dinormalisasi dengan teks asli tersimpan", async () => {
  const db = await buatDb({ memori: true });
  const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
  const st = penyimpananLokal(fs.mkdtempSync(path.join(os.tmpdir(), "uji-dd-")), randomBytes(32).toString("hex"));
  const { lembarKerja } = await buatProyekDariPdf(db, { id: s.admin.id, peran: "admin" }, st, {
    workspaceId: s.workspace.id, namaFile: "k.pdf", data: Buffer.from("%PDF-1.4 uji"),
  });
  const u = (nama: string) => ({ nama, jenis: "kabinet_atas" as const, bahan_utama: null, posisi: null });
  await simpanHasilBaca(db, lembarKerja.id, [
    { ...HALAMAN_KOSONG, unit: [u("Kabinet atas 1")] },
    { ...HALAMAN_KOSONG, unit: [u("kabinet atas  1"), u("Kabinet atas 2")] },
    {
      ...HALAMAN_KOSONG,
      unit: [u("Kabinet atas 1")],
      spek: [{ kunci: "kode_hpl", unit: null, nilai: "th009d", keyakinan: 90, posisi: null }],
    },
  ]);
  const units = await db.select().from(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lembarKerja.id));
  expect(units).toHaveLength(2);
  expect(units.find((x) => x.nama === "Kabinet atas 1")?.halamanSemua).toEqual([1, 2, 3]);
  const [hpl] = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.kunci, "kode_hpl"));
  expect(hpl.nilai).toBe("TH 009 D");
  expect(hpl.data).toEqual({ asli: "th009d" });
});
