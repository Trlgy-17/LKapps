import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buatDb, schema, type Db } from "@/db";
import { AKSI, boleh, wajib, DilarangError } from "@/lib/permissions";
import { cocokKataSandi, hashKataSandi } from "@/lib/password";
import { bacaToken, buatToken } from "@/lib/session-token";
import { aktifkanDraf, bukaDraf, daftarAturan, ruleSetAktif, tambahAturan } from "@/lib/aturan";
import { cariMaterial, tambahMaterial } from "@/lib/material";
import { formatAngka } from "@/lib/format";
import { ATURAN_AWAL, seed } from "@/lib/seed";

describe("peran dan hak akses (PRD §2)", () => {
  it("purchasing hanya baca proyek dan unduh hasil", () => {
    const izin = AKSI.filter((a) => boleh("purchasing", a));
    expect(izin.sort()).toEqual(["hasil.unduh", "proyek.baca"]);
  });
  it("estimator tidak boleh menyetujui estimasi, input real, atau kelola aturan", () => {
    for (const a of ["estimasi.setujui", "real.input", "aturan.kelola", "aturan.setujui", "pengguna.kelola"] as const) {
      expect(boleh("estimator", a)).toBe(false);
    }
    expect(boleh("estimator", "proyek.ubah")).toBe(true);
  });
  it("kepala produksi menyetujui dan input real, tapi tidak mengelola aturan", () => {
    expect(boleh("kepala_produksi", "estimasi.setujui")).toBe(true);
    expect(boleh("kepala_produksi", "real.input")).toBe(true);
    expect(boleh("kepala_produksi", "aturan.setujui")).toBe(false);
  });
  it("admin boleh semua", () => {
    expect(AKSI.every((a) => boleh("admin", a))).toBe(true);
  });
  it("wajib melempar DilarangError", () => {
    expect(() => wajib("purchasing", "proyek.ubah")).toThrow(DilarangError);
  });
});

describe("kata sandi dan sesi", () => {
  it("hash berbeda tiap panggilan tetapi keduanya cocok", async () => {
    const a = await hashKataSandi("rahasia-uji");
    const b = await hashKataSandi("rahasia-uji");
    expect(a).not.toBe(b);
    expect(await cocokKataSandi("rahasia-uji", a)).toBe(true);
    expect(await cocokKataSandi("salah", a)).toBe(false);
  });
  it("token valid, kedaluwarsa, dan dipalsukan", () => {
    const rahasia = "rahasia-uji-yang-panjang";
    const t = buatToken("u1", rahasia, 1_000_000_000_000);
    expect(bacaToken(t, rahasia, 1_000_000_000_000)?.uid).toBe("u1");
    expect(bacaToken(t, rahasia, 1_000_000_000_000 + 13 * 3600 * 1000)).toBeNull();
    expect(bacaToken(t, "rahasia-lain-yang-panjang", 1_000_000_000_000)).toBeNull();
    expect(bacaToken(t.slice(0, -2) + "xx", rahasia, 1_000_000_000_000)).toBeNull();
    expect(bacaToken(undefined, rahasia)).toBeNull();
  });
  it("menolak rahasia pendek", () => {
    expect(() => buatToken("u1", "pendek")).toThrow();
  });
});

describe("format angka Indonesia", () => {
  it("titik ribuan, koma desimal", () => {
    expect(formatAngka(1320)).toBe("1.320");
    expect(formatAngka(6.05)).toBe("6,05");
    expect(formatAngka(4200)).toBe("4.200");
  });
});

describe("pustaka aturan, katalog, audit (DB)", () => {
  let db: Db;
  let wsId: string;
  let admin: { id: string; peran: "admin" };
  const estimator = { id: "00000000-0000-0000-0000-000000000001", peran: "estimator" as const };

  beforeAll(async () => {
    db = await buatDb({ memori: true });
    const s = await seed(db, { adminEmail: "admin@contoh.test", adminKataSandi: "kata-sandi-uji" });
    wsId = s.workspace.id;
    admin = { id: s.admin.id, peran: "admin" };
  });

  it("seed membuat RuleSet v1 aktif berisi semua aturan PRD", async () => {
    const aktif = await ruleSetAktif(db, wsId);
    expect(aktif?.versi).toBe(1);
    expect((await daftarAturan(db, aktif!.id)).length).toBe(ATURAN_AWAL.length);
  });

  it("estimator tidak boleh membuka draf aturan", async () => {
    await expect(bukaDraf(db, estimator, wsId)).rejects.toThrow(DilarangError);
  });

  it("aturan baru tidak aktif sebelum admin mengaktifkan; RuleSet lama tetap utuh", async () => {
    const draf = await bukaDraf(db, admin, wsId);
    expect(draf.status).toBe("draf");
    await tambahAturan(db, admin, draf.id, {
      kategori: "sekrup", kunci: "uji_baru", nama: "Aturan uji", isi: "x", sumber: "uji", keyakinan: "perkiraan",
    });
    const sebelum = await ruleSetAktif(db, wsId);
    expect(sebelum?.versi).toBe(1);
    expect((await daftarAturan(db, sebelum!.id)).some((a) => a.kunci === "uji_baru")).toBe(false);

    await aktifkanDraf(db, admin, draf.id);
    const sesudah = await ruleSetAktif(db, wsId);
    expect(sesudah?.versi).toBe(2);
    expect((await daftarAturan(db, sesudah!.id)).length).toBe(ATURAN_AWAL.length + 1);
    const lama = await db.select().from(schema.ruleSet).where(eq(schema.ruleSet.versi, 1));
    expect(lama[0].status).toBe("arsip");
    expect((await daftarAturan(db, lama[0].id)).length).toBe(ATURAN_AWAL.length);
  });

  it("hanya admin yang mengaktifkan draf", async () => {
    const draf = await bukaDraf(db, admin, wsId);
    await expect(aktifkanDraf(db, estimator, draf.id)).rejects.toThrow(DilarangError);
  });

  it("katalog: alias dicari tanpa membedakan huruf besar/kecil (FR-41)", async () => {
    await tambahMaterial(db, admin, {
      workspaceId: wsId, nama: "Multi min 18", tebal: "18", alias: ["multimin", "multi min"],
    });
    expect((await cariMaterial(db, wsId, "MULTIMIN"))?.nama).toBe("Multi min 18");
    expect((await cariMaterial(db, wsId, "Multi Min"))?.nama).toBe("Multi min 18");
    expect(await cariMaterial(db, wsId, "tidak ada")).toBeNull();
  });

  it("katalog menolak ukuran bukan angka dan peran tanpa izin", async () => {
    await expect(tambahMaterial(db, admin, { workspaceId: wsId, nama: "X", tebal: "abc" })).rejects.toThrow();
    await expect(tambahMaterial(db, estimator, { workspaceId: wsId, nama: "Y" })).rejects.toThrow(DilarangError);
  });

  it("setiap perubahan tercatat di audit dengan pengguna dan nilai", async () => {
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entitas, "material"));
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].penggunaId).toBe(admin.id);
    expect(log[0].nilaiBaru).toBeTruthy();
    expect(log[0].waktu).toBeInstanceOf(Date);
  });
});
