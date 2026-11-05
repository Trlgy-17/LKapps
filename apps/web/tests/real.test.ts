import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buatDb, schema, type Db } from "@/db";
import { DilarangError } from "@/lib/permissions";
import { dataRealTerbaru, simpanDataReal, type HasilReal } from "@/lib/real";
import { hitungStatus } from "@/lib/status-proyek";
import { seed } from "@/lib/seed";

const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "..", "..", "engine", "fixtures", "septi_real.json"), "utf-8")) as { baris: [string, string][] };
const teksSepti = fixture.baris.map(([, t]) => t).join("\n");

describe("data real (FR-40..42)", () => {
  let db: Db;
  let ws: string;
  let proyekId: string;
  let admin: { id: string; peran: "admin" };

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "a@uji.test", adminKataSandi: "kata-sandi-uji" });
    ws = s.workspace.id;
    admin = { id: s.admin.id, peran: "admin" };
    const [pr] = await db.insert(schema.proyek).values({ workspaceId: ws, klien: "Uji" }).returning();
    proyekId = pr.id;
  }, 60000);

  it("tempel teks -> 34 item ternormalisasi, polos 6 digabung 10, sekrup 1.320", async () => {
    const d = await simpanDataReal(db, admin, ws, proyekId, teksSepti, "real_belum_dijelaskan");
    const h = d.hasil as unknown as HasilReal;
    expect(h.item).toHaveLength(34);
    expect(h.item.find((i) => i.kunci === "MULTIPLEKS_POLOS_6")?.jumlah).toBe(10);
    expect(h.item.find((i) => i.kunci === "MULTIPLEKS_POLOS_6")?.raw_row_ids).toEqual(["R1", "R4"]);
    expect(h.total.find((t) => t.kategori === "sekrup")?.jumlah).toBe(1320);
    expect(h.galat).toEqual([]);
    // tanpa estimasi: semua kelompok berstatus baru, tanpa selisih
    expect(h.rekon.every((r) => r.status === "baru" && r.selisih === null)).toBe(true);
  }, 60000);

  it("versi baru tersimpan, teks asli utuh, tercatat di audit", async () => {
    const d2 = await simpanDataReal(db, admin, ws, proyekId, "multi min 18 : 10 lembar\nngawur", "pemakaian_bersih");
    expect(d2.versi).toBe(2);
    expect(d2.teks).toContain("ngawur");
    expect(((d2.hasil as unknown as HasilReal).galat)).toHaveLength(1);
    expect((await dataRealTerbaru(db, proyekId))?.versi).toBe(2);
    const log = await db.select().from(schema.auditLog);
    expect(log.some((l) => l.entitas === "data_real")).toBe(true);
  }, 60000);

  it("hanya peran dengan real.input", async () => {
    await expect(simpanDataReal(db, { id: admin.id, peran: "estimator" }, ws, proyekId, "pvc 18 : 7 lembar", "pembelian")).rejects.toThrow(DilarangError);
    await expect(simpanDataReal(db, admin, ws, proyekId, "   \n  ", "pembelian")).rejects.toThrow();
  });
});

describe("status proyek (SYSTEM_PROMPT §17)", () => {
  const dasar = { adaEstimasi: true, konflikTerbuka: 0, itemPerluKonfirmasi: 0, halamanGagal: 0, adaDataReal: false, unitTerbaca: 3 };
  it("tanpa estimasi: incomplete_inputs dan not_assessed", () => {
    const s = hitungStatus({ ...dasar, adaEstimasi: false });
    expect(s.status).toBe("incomplete_inputs");
    expect(s.kesiapanPembelian).toBe("not_assessed");
  });
  it("estimasi berasumsi: estimated, pembelian blocked (stok dan kemasan tidak diketahui)", () => {
    const s = hitungStatus(dasar);
    expect(s.status).toBe("estimated");
    expect(s.kesiapanPembelian).toBe("blocked");
    expect(s.alasanBlokir.join(" ")).toContain("Stok");
  });
  it("halaman gagal atau tanpa unit: incomplete_inputs; data real: reconciled", () => {
    expect(hitungStatus({ ...dasar, halamanGagal: 2 }).status).toBe("incomplete_inputs");
    expect(hitungStatus({ ...dasar, unitTerbaca: 0 }).status).toBe("incomplete_inputs");
    expect(hitungStatus({ ...dasar, adaDataReal: true }).status).toBe("reconciled");
  });
  it("tidak pernah calculated atau ready_for_review otomatis; listrik tetap belum lengkap", () => {
    const s = hitungStatus({ ...dasar, adaDataReal: true });
    expect(s.status).not.toBe("calculated");
    expect(s.kesiapanPembelian).not.toBe("ready_for_review");
    expect(s.modul.listrik).toBe("incomplete_inputs");
    expect(s.finishing).toBe("partial");
  });
});
