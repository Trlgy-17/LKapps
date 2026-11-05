import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { schema, type Db } from "@/db";
import { antre } from "./antrean";
import { catat, type Aktor } from "./audit";
import { wajib } from "./permissions";
import type { Penyimpanan } from "./storage";

export const BATAS_BYTE = 50 * 1024 * 1024; // FR-02: 50 MB

export class UnggahDitolak extends Error {}

export type UnggahPdf = { workspaceId: string; namaFile: string; data: Buffer };

export function periksaPdf(namaFile: string, data: Buffer) {
  if (!namaFile.toLowerCase().endsWith(".pdf")) throw new UnggahDitolak("File harus berformat PDF.");
  if (data.length === 0) throw new UnggahDitolak("File kosong.");
  if (data.length > BATAS_BYTE) {
    throw new UnggahDitolak(`File melebihi batas 50 MB (${(data.length / 1048576).toFixed(1).replace(".", ",")} MB).`);
  }
  if (data.subarray(0, 5).toString("latin1") !== "%PDF-") throw new UnggahDitolak("Isi file bukan PDF.");
}

/** FR-01, FR-02: buat proyek dari PDF, simpan terenkripsi, antrekan pembacaan. */
export async function buatProyekDariPdf(db: Db, aktor: Aktor, st: Penyimpanan, u: UnggahPdf) {
  wajib(aktor.peran, "proyek.ubah");
  periksaPdf(u.namaFile, u.data);
  const [pr] = await db
    .insert(schema.proyek)
    .values({ workspaceId: u.workspaceId, dibuatOleh: aktor.id })
    .returning();
  const kunci = `${u.workspaceId}/${pr.id}/${randomUUID()}`;
  await st.simpan(kunci, u.data);
  const [lk] = await db
    .insert(schema.lembarKerja)
    .values({ proyekId: pr.id, namaFile: u.namaFile.slice(0, 200), ukuranByte: u.data.length, kunciFile: kunci })
    .returning();
  await antre(db, "baca_pdf", { lembarKerjaId: lk.id });
  await catat(db, aktor, "proyek", pr.id, "buat", null, { namaFile: lk.namaFile, ukuranByte: lk.ukuranByte });
  return { proyek: pr, lembarKerja: lk };
}

/** Semua akses data proyek lewat sini agar workspace selalu diperiksa. */
export async function ambilProyek(db: Db, workspaceId: string, id: string) {
  const [p] = await db
    .select()
    .from(schema.proyek)
    .where(and(eq(schema.proyek.id, id), eq(schema.proyek.workspaceId, workspaceId)));
  return p ?? null;
}

export type DataProyek = {
  klien: string; lokasi: string; pekerjaan: string; surveyor: string; tanggalGambar: string | null;
};

export async function ubahDataProyek(db: Db, aktor: Aktor, workspaceId: string, id: string, baru: Partial<DataProyek>) {
  wajib(aktor.peran, "proyek.ubah");
  const lama = await ambilProyek(db, workspaceId, id);
  if (!lama) throw new Error("Proyek tidak ditemukan");
  if (baru.tanggalGambar && !/^\d{4}-\d{2}-\d{2}$/.test(baru.tanggalGambar)) throw new Error("Tanggal gambar tidak valid");
  const sebelum: Record<string, unknown> = {};
  const sesudah: Record<string, unknown> = {};
  for (const k of ["klien", "lokasi", "pekerjaan", "surveyor", "tanggalGambar"] as const) {
    if (baru[k] !== undefined && baru[k] !== lama[k]) {
      sebelum[k] = lama[k];
      sesudah[k] = baru[k];
    }
  }
  if (Object.keys(sesudah).length === 0) return lama;
  const [p] = await db.update(schema.proyek).set(sesudah).where(eq(schema.proyek.id, id)).returning();
  await catat(db, aktor, "proyek", id, "ubah", sebelum, sesudah);
  return p;
}

export async function daftarProyek(db: Db, workspaceId: string) {
  return db.select().from(schema.proyek).where(eq(schema.proyek.workspaceId, workspaceId)).orderBy(desc(schema.proyek.dibuat));
}

export async function lembarKerjaTerbaru(db: Db, proyekId: string) {
  const [lk] = await db
    .select()
    .from(schema.lembarKerja)
    .where(eq(schema.lembarKerja.proyekId, proyekId))
    .orderBy(desc(schema.lembarKerja.versi), desc(schema.lembarKerja.dibuat))
    .limit(1);
  return lk ?? null;
}

export async function halamanLembar(db: Db, lembarKerjaId: string) {
  return db
    .select()
    .from(schema.halamanLembar)
    .where(eq(schema.halamanLembar.lembarKerjaId, lembarKerjaId))
    .orderBy(schema.halamanLembar.nomor);
}

/** Antrekan ulang pembacaan setelah gagal. */
export async function cobaLagi(db: Db, aktor: Aktor, workspaceId: string, proyekId: string) {
  wajib(aktor.peran, "proyek.ubah");
  const p = await ambilProyek(db, workspaceId, proyekId);
  if (!p) throw new Error("Proyek tidak ditemukan");
  const lk = await lembarKerjaTerbaru(db, proyekId);
  if (!lk || (lk.status !== "gagal" && lk.halamanGagal.length === 0)) return;
  const sudahDirender = lk.halaman !== null && (await halamanLembar(db, lk.id)).length === lk.halaman;
  await db
    .update(schema.lembarKerja)
    .set({ status: sudahDirender ? "membaca" : "diunggah", galat: null, ...(sudahDirender ? { tahap: "baca" as const, halamanDibaca: 0 } : {}) })
    .where(eq(schema.lembarKerja.id, lk.id));
  // Halaman sudah ter-render: ulangi hanya pembacaan gambar, tidak render PDF lagi.
  await antre(db, sudahDirender ? "baca_ai" : "baca_pdf", { lembarKerjaId: lk.id });
  await catat(db, aktor, "lembar_kerja", lk.id, "coba_lagi", { status: "gagal" }, { status: "diunggah" });
}
