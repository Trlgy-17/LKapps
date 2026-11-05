import { and, asc, eq } from "drizzle-orm";
import { schema, type Db } from "@/db";

/**
 * Antrean pekerjaan di tabel Postgres. Pekerjaan jalan di sisi server, jadi tetap berlanjut
 * saat browser ditutup (PRD §10). Pekerjaan yang terputus saat server mati diantrekan ulang.
 */
export type Job = typeof schema.job.$inferSelect;
export type Konteks = {
  db: Db;
  job: Job;
  lapor: (progres: number, total?: number) => Promise<void>;
};
export type Penangan = (k: Konteks) => Promise<void>;

const penangan = new Map<string, Penangan>();
export function daftarkanPenangan(jenis: string, fn: Penangan) {
  penangan.set(jenis, fn);
}

export async function antre(db: Db, jenis: string, payload: Record<string, unknown>) {
  const [j] = await db.insert(schema.job).values({ jenis, payload }).returning();
  return j;
}

export async function pulihkanJob(db: Db) {
  await db.update(schema.job).set({ status: "antre" }).where(eq(schema.job.status, "jalan"));
}

/** Ambil satu job antre tertua dan jalankan. Mengembalikan job-nya, atau null bila antrean kosong. */
export async function jalankanSatu(db: Db): Promise<Job | null> {
  const [calon] = await db
    .select()
    .from(schema.job)
    .where(eq(schema.job.status, "antre"))
    .orderBy(asc(schema.job.dibuat))
    .limit(1);
  if (!calon) return null;
  const [diambil] = await db
    .update(schema.job)
    .set({ status: "jalan", mulai: new Date() })
    .where(and(eq(schema.job.id, calon.id), eq(schema.job.status, "antre")))
    .returning();
  if (!diambil) return null;
  const fn = penangan.get(diambil.jenis);
  try {
    if (!fn) throw new Error(`Penangan untuk '${diambil.jenis}' belum terdaftar`);
    await fn({
      db,
      job: diambil,
      lapor: async (progres, total) => {
        await db
          .update(schema.job)
          .set(total === undefined ? { progres } : { progres, total })
          .where(eq(schema.job.id, diambil.id));
      },
    });
    await db.update(schema.job).set({ status: "selesai", selesai: new Date() }).where(eq(schema.job.id, diambil.id));
  } catch (e) {
    await db
      .update(schema.job)
      .set({ status: "gagal", galat: e instanceof Error ? e.message : String(e), selesai: new Date() })
      .where(eq(schema.job.id, diambil.id));
  }
  return diambil;
}

export function mulaiPenjalan(db: Db, selangMs = 1500): () => void {
  let sibuk = false;
  const t = setInterval(async () => {
    if (sibuk) return;
    sibuk = true;
    try {
      while (await jalankanSatu(db)) {
        /* kuras antrean */
      }
    } finally {
      sibuk = false;
    }
  }, selangMs);
  return () => clearInterval(t);
}
