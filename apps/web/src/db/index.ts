import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

const MIGRASI = path.join(process.cwd(), "drizzle");

/**
 * DATABASE_URL (postgres://...) untuk produksi. Tanpa itu: PGlite (Postgres tertanam)
 * di folder .data/pglite untuk pengembangan, atau memori bila `memori` true (tes).
 */
export async function buatDb(opsi: { url?: string; memori?: boolean } = {}): Promise<Db> {
  const url = opsi.memori ? undefined : (opsi.url ?? process.env.DATABASE_URL);
  if (url) {
    const db = drizzlePg(new Pool({ connectionString: url }), { schema });
    await migratePg(db, { migrationsFolder: MIGRASI });
    return db as unknown as Db;
  }
  const lokasi = path.join(process.cwd(), ".data", "pglite");
  if (!opsi.memori) fs.mkdirSync(path.dirname(lokasi), { recursive: true });
  const klien = opsi.memori ? new PGlite() : new PGlite(lokasi);
  const db = drizzlePglite(klien, { schema });
  await migratePglite(db, { migrationsFolder: MIGRASI });
  return db;
}

const g = globalThis as unknown as { __db?: Promise<Db> };
export function ambilDb(): Promise<Db> {
  g.__db ??= buatDb();
  return g.__db;
}
export { schema };
