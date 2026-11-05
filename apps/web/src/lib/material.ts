import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "@/db";
import { catat, type Aktor } from "./audit";
import { wajib } from "./permissions";

export type MaterialBaru = {
  workspaceId: string;
  nama: string;
  lembarLebar?: string;
  lembarPanjang?: string;
  tebal?: string | null;
  satuan?: string;
  seratTetap?: boolean;
  alias?: string[];
};

const ANGKA = /^\d+(\.\d+)?$/;

export async function tambahMaterial(db: Db, aktor: Aktor, m: MaterialBaru) {
  wajib(aktor.peran, "katalog.kelola");
  const nama = m.nama.trim();
  if (!nama) throw new Error("Nama material wajib diisi");
  for (const v of [m.lembarLebar, m.lembarPanjang, m.tebal]) {
    if (v && !ANGKA.test(v)) throw new Error(`Ukuran tidak valid: ${v}`);
  }
  const [baru] = await db
    .insert(schema.material)
    .values({
      workspaceId: m.workspaceId,
      nama,
      lembarLebar: m.lembarLebar ?? "1200",
      lembarPanjang: m.lembarPanjang ?? "2400",
      tebal: m.tebal ?? null,
      satuan: m.satuan ?? "lembar",
      seratTetap: m.seratTetap ? 1 : 0,
    })
    .returning();
  for (const a of m.alias ?? []) await tambahAlias(db, aktor, baru.id, a);
  await catat(db, aktor, "material", baru.id, "tambah", null, { ...m });
  return baru;
}

export async function tambahAlias(db: Db, aktor: Aktor, materialId: string, alias: string) {
  wajib(aktor.peran, "katalog.kelola");
  const a = alias.trim();
  if (!a) throw new Error("Alias kosong");
  await db.insert(schema.materialAlias).values({ materialId, alias: a });
  await catat(db, aktor, "material_alias", materialId, "tambah", null, { alias: a });
}

/** Cari material dari nama atau alias, tanpa membedakan huruf besar/kecil (FR-41). */
export async function cariMaterial(db: Db, workspaceId: string, teks: string) {
  const t = teks.trim().toLowerCase();
  const [langsung] = await db
    .select()
    .from(schema.material)
    .where(sql`${schema.material.workspaceId} = ${workspaceId} and lower(${schema.material.nama}) = ${t}`);
  if (langsung) return langsung;
  const [lewatAlias] = await db
    .select({ m: schema.material })
    .from(schema.materialAlias)
    .innerJoin(schema.material, eq(schema.material.id, schema.materialAlias.materialId))
    .where(sql`lower(${schema.materialAlias.alias}) = ${t} and ${schema.material.workspaceId} = ${workspaceId}`);
  return lewatAlias?.m ?? null;
}

export async function daftarMaterial(db: Db, workspaceId: string) {
  return db
    .select()
    .from(schema.material)
    .where(eq(schema.material.workspaceId, workspaceId))
    .orderBy(schema.material.nama);
}
