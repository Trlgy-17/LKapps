import { spawn } from "node:child_process";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { schema, type Db } from "@/db";
import { daftarkanPenangan } from "./antrean";
import { catat, type Aktor } from "./audit";
import { ruleSetAktif } from "./aturan";
import { keMesin, turunkanMasukan, type FieldMasukan, type MasukanWeb } from "./estimasi-masukan";
import { wajib } from "./permissions";

const FOLDER_ENGINE = path.join(process.cwd(), "..", "..", "engine");

export function pythonEngine(): string {
  if (process.env.ENGINE_PYTHON) return process.env.ENGINE_PYTHON;
  return process.platform === "win32"
    ? path.join(FOLDER_ENGINE, ".venv", "Scripts", "python.exe")
    : path.join(FOLDER_ENGINE, ".venv", "bin", "python");
}

export type HasilItem = {
  jumlah: number; satuan: string; status: string; rumus: string; perlu_konfirmasi: boolean; asal_bukti: string; sumber?: string | null;
};
export type SkuKomponen = {
  lembar: number; batas_minimum_luas: number; luas_m2: number; luas_per_unit: Record<string, number>;
  isi_terakhir_persen: number; tidak_muat: string[]; validasi_nesting: string; galat_validasi: string[];
  jumlah_part: number; status: "gambar" | "skala" | "asumsi"; hpl: boolean;
};
export type HasilKomponen = {
  sku: Record<string, SkuKomponen>; unit: string[]; ringkas: { papan_lembar: number; hpl_lembar: number };
  parameter: { lembar_mm: number[]; tebal_potong_mm: number; trim_mm: number; kelebihan_hpl_mm: number };
  uji_trim?: { trim_mm: number; berubah: { sku: string; lembar: number; lembar_trim: number }[]; tidak_muat: Record<string, string[]> };
};
export type HasilMesin = {
  komponen?: HasilKomponen | null;
  versi_ruleset: string;
  standar: Record<string, HasilItem>;
  hardware: Record<string, HasilItem>;
  sekrup: Record<string, HasilItem>;
  pintu_asumsi: Record<string, HasilItem>;
  lembar_per_bahan: Record<string, number>;
};

export function jalankanMesin(masuk: unknown): Promise<HasilMesin> {
  return new Promise((resolve, reject) => {
    const p = spawn(pythonEngine(), [path.join(FOLDER_ENGINE, "run_estimasi.py")], {
      cwd: FOLDER_ENGINE,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString()));
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", (e) => reject(new Error(`Mesin hitung tidak bisa dijalankan: ${e.message}`)));
    p.on("close", () => {
      try {
        const j = JSON.parse(out);
        if (j.galat) reject(new Error(`Mesin hitung: ${j.galat}`));
        else resolve(j as HasilMesin);
      } catch {
        reject(new Error(`Keluaran mesin hitung tidak valid. ${err.slice(-300)}`));
      }
    });
    p.stdin.end(JSON.stringify(masuk));
  });
}

async function simpan(db: Db, aktor: Aktor | null, lk: { id: string; proyekId: string }, masukan: MasukanWeb, ket: string) {
  const [workspaceRow] = await db
    .select({ ws: schema.proyek.workspaceId })
    .from(schema.proyek)
    .where(eq(schema.proyek.id, lk.proyekId));
  const rs = await ruleSetAktif(db, workspaceRow.ws);
  const hasil = await jalankanMesin(keMesin(masukan, String(rs?.versi ?? "?")));
  const [terakhir] = await db
    .select({ v: schema.estimasi.versi })
    .from(schema.estimasi)
    .where(eq(schema.estimasi.proyekId, lk.proyekId))
    .orderBy(desc(schema.estimasi.versi))
    .limit(1);
  const [baru] = await db
    .insert(schema.estimasi)
    .values({
      proyekId: lk.proyekId, lembarKerjaId: lk.id, versi: (terakhir?.v ?? 0) + 1,
      ruleSetId: rs?.id ?? null, ruleSetVersi: rs?.versi ?? null,
      masukan: masukan as unknown as Record<string, unknown>, hasil: hasil as unknown as Record<string, unknown>,
      dibuatOleh: aktor?.id ?? null,
    })
    .returning();
  await catat(db, aktor, "estimasi", baru.id, ket, null, { versi: baru.versi, ruleSetVersi: baru.ruleSetVersi });
  return baru;
}

/** Hitung otomatis dari hasil baca. Dipanggil job setelah pembacaan gambar selesai. */
export async function hitungOtomatis(db: Db, lembarKerjaId: string) {
  const [lk] = await db.select().from(schema.lembarKerja).where(eq(schema.lembarKerja.id, lembarKerjaId));
  if (!lk) throw new Error("Lembar kerja tidak ditemukan");
  const units = await db.select().from(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lembarKerjaId));
  const bidang = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.lembarKerjaId, lembarKerjaId));
  const masukan = turunkanMasukan(
    units.map((u) => ({ nama: u.nama, jenis: u.jenis, halamanSemua: u.halamanSemua, bahanUtama: u.bahanUtama })),
    bidang.map((b) => ({ jenis: b.jenis, kunci: b.kunci, nilai: b.nilai, halaman: b.halaman, unitNama: b.unitNama, data: b.data })),
    lk.halamanGagal,
  );
  return simpan(db, null, lk, masukan, "hitung_otomatis");
}

export type Perubahan = Partial<{
  meter_kabinet: number | null; meter_kitchen: number | null; meter_atas: number | null; aica_kedalaman_mm: number | null;
  jumlah_lemari: number | null; jumlah_sudut_robot: number | null; titik_sambungan: number | null;
  tinggi_standar: boolean; pintu_bawah_asumsi: number; pintu_atas_asumsi: number;
}>;

/** Pengguna mengubah masukan -> estimasi versi baru; versi lama tetap utuh dan bisa diulang. */
export async function ubahMasukan(db: Db, aktor: Aktor, workspaceId: string, proyekId: string, p: Perubahan) {
  wajib(aktor.peran, "estimasi.hitung");
  const [pr] = await db.select().from(schema.proyek).where(and(eq(schema.proyek.id, proyekId), eq(schema.proyek.workspaceId, workspaceId)));
  if (!pr) throw new Error("Proyek tidak ditemukan");
  const lama = await estimasiTerbaru(db, proyekId);
  if (!lama) throw new Error("Belum ada estimasi");
  const m = structuredClone(lama.masukan) as unknown as MasukanWeb;
  m.aica_kedalaman_mm ??= { nilai: null, asal: "tidak_ada", catatan: [] }; // estimasi lama
  const set = (k: keyof MasukanWeb, v: number | boolean | null | undefined) => {
    if (v === undefined) return;
    const f = m[k] as FieldMasukan<number | boolean>;
    f.nilai = v;
    f.asal = v === null ? "tidak_ada" : "pengguna";
    f.catatan = v === null ? ["Dikosongkan pengguna"] : ["Diisi pengguna"];
  };
  for (const k of ["meter_kabinet", "meter_kitchen", "jumlah_lemari", "jumlah_sudut_robot", "titik_sambungan", "tinggi_standar", "aica_kedalaman_mm"] as const) {
    set(k, p[k]);
  }
  set("meter_atas", p.meter_atas);
  if (p.pintu_bawah_asumsi !== undefined) m.pintu_bawah_asumsi = p.pintu_bawah_asumsi;
  if (p.pintu_atas_asumsi !== undefined) m.pintu_atas_asumsi = p.pintu_atas_asumsi;
  const [lk] = await db.select().from(schema.lembarKerja).where(eq(schema.lembarKerja.id, lama.lembarKerjaId));
  const baru = await simpan(db, aktor, lk, m, "ubah_masukan");
  await catat(db, aktor, "estimasi_masukan", proyekId, "ubah", { versi: lama.versi }, { versi: baru.versi, perubahan: p });
  return baru;
}

export async function estimasiTerbaru(db: Db, proyekId: string) {
  const [e] = await db
    .select()
    .from(schema.estimasi)
    .where(eq(schema.estimasi.proyekId, proyekId))
    .orderBy(desc(schema.estimasi.versi))
    .limit(1);
  return e ?? null;
}

export function daftarkanPenanganHitung() {
  daftarkanPenangan("hitung_estimasi", async (k) => {
    await hitungOtomatis(k.db, String(k.job.payload.lembarKerjaId));
  });
}
