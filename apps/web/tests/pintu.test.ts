import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema, type Db } from "@/db";
import { HALAMAN_KOSONG } from "@/lib/pembaca/rekaman";
import { asumsiPintu } from "@/lib/pembaca/simpan";
import { simpanHasilBaca } from "@/lib/pembaca/simpan";
import { buatProyekDariPdf } from "@/lib/proyek";
import { seed } from "@/lib/seed";
import { penyimpananLokal } from "@/lib/storage";

describe("jumlah pintu dari lembar kerja, ukuran asumsi hanya bila kosong", () => {
  let db: Db;
  let lkId: string;

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    const st = penyimpananLokal(fs.mkdtempSync(path.join(os.tmpdir(), "uji-pintu-")), randomBytes(32).toString("hex"));
    const { lembarKerja } = await buatProyekDariPdf(db, { id: s.admin.id, peran: "admin" }, st, {
      workspaceId: s.workspace.id, namaFile: "k.pdf", data: Buffer.from("%PDF-1.4 uji"),
    });
    lkId = lembarKerja.id;
    await simpanHasilBaca(db, lkId, [
      {
        ...HALAMAN_KOSONG,
        jenis_halaman: "elevasi",
        pintu: [
          { unit: "Kabinet bawah", letak: "bawah", fungsi: null, inset: null, jumlah: 4, lebar_mm: null, tinggi_mm: null, posisi: null },
          { unit: "Kabinet atas", letak: "atas", fungsi: null, inset: null, jumlah: 3, lebar_mm: 450, tinggi_mm: 720, posisi: null },
          { unit: "Lemari", letak: "lemari", fungsi: null, inset: null, jumlah: 2, lebar_mm: null, tinggi_mm: null, posisi: null },
          { unit: "X", letak: "atas", fungsi: null, inset: null, jumlah: 0, lebar_mm: null, tinggi_mm: null, posisi: null },
        ],
      },
    ]);
  });

  it("jumlah pintu mengikuti lembar kerja", async () => {
    const p = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.jenis, "pintu"));
    expect(p.map((x) => [x.kunci, x.nilai]).sort()).toEqual([
      ["pintu_atas", "3"], ["pintu_bawah", "4"], ["pintu_lemari", "2"],
    ]);
  });

  it("pintu kitchen tanpa ukuran ditahan (ukuran_hilang) dan menawarkan asumsi 60 x 70", async () => {
    const h = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.jenis, "ukuran_hilang"));
    expect(h).toHaveLength(1);
    expect(h[0].status).toBe("belum_ada");
    expect(h[0].data).toMatchObject({ jumlah: 4, letak: "bawah", asumsi: { lebarMm: 600, tinggiMm: 700 } });
  });

  it("pintu yang ukurannya tertulis dan pintu lemari tidak diberi asumsi", async () => {
    const h = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.jenis, "ukuran_hilang"));
    expect(h.some((x) => (x.data as { letak?: string }).letak === "atas")).toBe(false);
    expect(h.some((x) => (x.data as { letak?: string }).letak === "lemari")).toBe(false);
  });

  it("asumsi: bawah 60 x 70, atas 40 x 70, lainnya tidak ada", () => {
    expect(asumsiPintu("bawah")).toEqual({ lebarMm: 600, tinggiMm: 700 });
    expect(asumsiPintu("atas")).toEqual({ lebarMm: 400, tinggiMm: 700 });
    expect(asumsiPintu("lemari")).toBeNull();
  });
});
