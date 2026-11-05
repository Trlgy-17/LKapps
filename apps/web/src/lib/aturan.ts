import { and, desc, eq } from "drizzle-orm";
import { schema, type Db } from "@/db";
import { catat, type Aktor } from "./audit";
import { wajib } from "./permissions";

type Aturan = typeof schema.aturan.$inferSelect;
export type AturanBaru = Pick<Aturan, "kategori" | "kunci" | "nama" | "isi" | "sumber" | "keyakinan">;

/** Hanya RuleSet aktif yang boleh dipakai mesin hitung (FR-44, PRD §5.5). */
export async function ruleSetAktif(db: Db, workspaceId: string) {
  const [rs] = await db
    .select()
    .from(schema.ruleSet)
    .where(and(eq(schema.ruleSet.workspaceId, workspaceId), eq(schema.ruleSet.status, "aktif")));
  return rs ?? null;
}

export async function ruleSetDraf(db: Db, workspaceId: string) {
  const [rs] = await db
    .select()
    .from(schema.ruleSet)
    .where(and(eq(schema.ruleSet.workspaceId, workspaceId), eq(schema.ruleSet.status, "draf")));
  return rs ?? null;
}

export async function daftarAturan(db: Db, ruleSetId: string) {
  return db
    .select()
    .from(schema.aturan)
    .where(eq(schema.aturan.ruleSetId, ruleSetId))
    .orderBy(schema.aturan.kategori, schema.aturan.nama);
}

async function versiTerakhir(db: Db, workspaceId: string): Promise<number> {
  const [r] = await db
    .select({ versi: schema.ruleSet.versi })
    .from(schema.ruleSet)
    .where(eq(schema.ruleSet.workspaceId, workspaceId))
    .orderBy(desc(schema.ruleSet.versi))
    .limit(1);
  return r?.versi ?? 0;
}

/** Buat draf baru sebagai salinan RuleSet aktif. Bila draf sudah ada, kembalikan yang itu. */
export async function bukaDraf(db: Db, aktor: Aktor, workspaceId: string) {
  wajib(aktor.peran, "aturan.kelola");
  const ada = await ruleSetDraf(db, workspaceId);
  if (ada) return ada;
  const aktif = await ruleSetAktif(db, workspaceId);
  const versi = (await versiTerakhir(db, workspaceId)) + 1;
  const [baru] = await db.insert(schema.ruleSet).values({ workspaceId, versi, status: "draf" }).returning();
  if (aktif) {
    const asal = await daftarAturan(db, aktif.id);
    if (asal.length) {
      await db.insert(schema.aturan).values(
        asal.map(({ id: _id, ruleSetId: _r, ...sisa }) => ({ ...sisa, ruleSetId: baru.id })),
      );
    }
  }
  await catat(db, aktor, "rule_set", baru.id, "buka_draf", null, { versi, salinDari: aktif?.versi ?? null });
  return baru;
}

export async function tambahAturan(db: Db, aktor: Aktor, ruleSetId: string, data: AturanBaru) {
  wajib(aktor.peran, "aturan.kelola");
  const [rs] = await db.select().from(schema.ruleSet).where(eq(schema.ruleSet.id, ruleSetId));
  if (!rs || rs.status !== "draf") throw new Error("Aturan hanya bisa ditambah ke RuleSet draf");
  const [baru] = await db.insert(schema.aturan).values({ ...data, ruleSetId }).returning();
  await catat(db, aktor, "aturan", baru.id, "tambah", null, data);
  return baru;
}

/** Aktifkan draf: hanya admin (aturan.setujui). RuleSet lama diarsip, tetap utuh untuk mengulang hasil lama. */
export async function aktifkanDraf(db: Db, aktor: Aktor, ruleSetId: string) {
  wajib(aktor.peran, "aturan.setujui");
  const [rs] = await db.select().from(schema.ruleSet).where(eq(schema.ruleSet.id, ruleSetId));
  if (!rs || rs.status !== "draf") throw new Error("Hanya RuleSet draf yang bisa diaktifkan");
  const lama = await ruleSetAktif(db, rs.workspaceId);
  if (lama) await db.update(schema.ruleSet).set({ status: "arsip" }).where(eq(schema.ruleSet.id, lama.id));
  await db
    .update(schema.ruleSet)
    .set({ status: "aktif", penyetujuId: aktor.id, disetujui: new Date() })
    .where(eq(schema.ruleSet.id, ruleSetId));
  await catat(db, aktor, "rule_set", ruleSetId, "aktifkan", { aktif: lama?.versi ?? null }, { aktif: rs.versi });
}
