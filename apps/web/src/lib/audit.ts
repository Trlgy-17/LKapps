import { schema, type Db } from "@/db";
import type { Peran } from "@/db/schema";

export type Aktor = { id: string; peran: Peran };

/** Jejak audit: pengguna, waktu, nilai lama, nilai baru (PRD §10). */
export async function catat(
  db: Db,
  aktor: Aktor | null,
  entitas: string,
  entitasId: string,
  aksi: string,
  nilaiLama: unknown,
  nilaiBaru: unknown,
) {
  await db.insert(schema.auditLog).values({
    penggunaId: aktor?.id ?? null,
    entitas,
    entitasId,
    aksi,
    nilaiLama: nilaiLama ?? null,
    nilaiBaru: nilaiBaru ?? null,
  });
}
