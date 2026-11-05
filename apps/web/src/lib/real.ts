import { spawn } from "node:child_process";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { schema, type Db } from "@/db";
import { BASIS_REAL } from "@/db/schema";
import { catat, type Aktor } from "./audit";
import { estimasiTerbaru, pythonEngine } from "./estimasi";
import { wajib } from "./permissions";

const FOLDER_ENGINE = path.join(process.cwd(), "..", "..", "engine");

export type ItemReal = { kunci: string; nama: string; kategori: string; satuan: string | null; basis: string; jumlah: number | null; raw_row_ids: string[] };
export type Rekon = {
  kelompok: string; satuan: string; real: number | null; estimasi: number | null;
  status: "cocok" | "kurang" | "lebih" | "baru"; selisih: number | null; selisih_persen: number | null;
  comparable: "ya" | "tidak" | "belum_jelas"; catatan: string[];
};
export type HasilReal = {
  item: ItemReal[]; total: { kategori: string; satuan: string | null; jumlah: number }[];
  peringatan: string[]; galat: { baris: string; teks: string; pesan: string }[]; rekon: Rekon[];
};

function jalankanReal(masuk: unknown): Promise<HasilReal> {
  return new Promise((resolve, reject) => {
    const p = spawn(pythonEngine(), [path.join(FOLDER_ENGINE, "run_real.py")], { cwd: FOLDER_ENGINE, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString()));
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", (e) => reject(new Error(`Mesin data real tidak bisa dijalankan: ${e.message}`)));
    p.on("close", () => {
      try {
        const j = JSON.parse(out);
        if (j.galat_fatal) reject(new Error(j.galat_fatal));
        else resolve(j as HasilReal);
      } catch {
        reject(new Error(`Keluaran mesin data real tidak valid. ${err.slice(-300)}`));
      }
    });
    p.stdin.end(JSON.stringify(masuk));
  });
}

/** FR-40: teks tempelan "nama : jumlah satuan" per baris. Baris kosong dilewati; baris salah dilaporkan. */
export async function simpanDataReal(
  db: Db, aktor: Aktor, workspaceId: string, proyekId: string, teks: string, basis: (typeof BASIS_REAL)[number],
) {
  wajib(aktor.peran, "real.input");
  if (!BASIS_REAL.includes(basis)) throw new Error("Basis tidak dikenal");
  const [pr] = await db.select().from(schema.proyek).where(and(eq(schema.proyek.id, proyekId), eq(schema.proyek.workspaceId, workspaceId)));
  if (!pr) throw new Error("Proyek tidak ditemukan");
  const baris = teks.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((t, i) => [`R${i + 1}`, t] as [string, string]);
  if (baris.length === 0) throw new Error("Tempel minimal satu baris data real");
  const e = await estimasiTerbaru(db, proyekId);
  const hasil = await jalankanReal({ baris, basis, sumber: `Data real proyek ${proyekId}`, hasil: e?.hasil ?? {} });
  const [terakhir] = await db.select({ v: schema.dataReal.versi }).from(schema.dataReal).where(eq(schema.dataReal.proyekId, proyekId)).orderBy(desc(schema.dataReal.versi)).limit(1);
  const [baru] = await db
    .insert(schema.dataReal)
    .values({ proyekId, versi: (terakhir?.v ?? 0) + 1, teks, basis, estimasiId: e?.id ?? null, hasil: hasil as unknown as Record<string, unknown>, dibuatOleh: aktor.id })
    .returning();
  await catat(db, aktor, "data_real", baru.id, "tambah", null, { versi: baru.versi, baris: baris.length, basis });
  return baru;
}

export async function dataRealTerbaru(db: Db, proyekId: string) {
  const [d] = await db.select().from(schema.dataReal).where(eq(schema.dataReal.proyekId, proyekId)).orderBy(desc(schema.dataReal.versi)).limit(1);
  return d ?? null;
}
