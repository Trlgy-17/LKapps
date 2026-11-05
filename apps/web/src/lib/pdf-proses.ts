import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { antre, daftarkanPenangan, type Konteks } from "./antrean";
import { ambilPenyimpanan, type Penyimpanan } from "./storage";

const FOLDER_WORKERS = path.join(process.cwd(), "..", "..", "workers");

export function pythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === "win32"
    ? path.join(FOLDER_WORKERS, ".venv", "Scripts", "python.exe")
    : path.join(FOLDER_WORKERS, ".venv", "bin", "python");
}

type Baris =
  | { jenis: "info"; halaman: number }
  | { jenis: "halaman"; nomor: number; lebar: number; tinggi: number; thumb: string; besar: string }
  | { jenis: "selesai"; halaman: number }
  | { jenis: "galat"; pesan: string };

/** Jalankan pdf_tools.py dan teruskan tiap baris JSON. Mengembalikan pesan galat bila gagal. */
function jalankanAlat(pdf: string, keluar: string, saatBaris: (b: Baris) => Promise<void>): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const anak = spawn(pythonBin(), [path.join(FOLDER_WORKERS, "pdf_tools.py"), "proses", pdf, keluar], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let sisa = "";
    let galat: string | null = null;
    let rantai: Promise<void> = Promise.resolve();
    let stderr = "";
    anak.stdout.on("data", (d: Buffer) => {
      sisa += d.toString();
      const baris = sisa.split("\n");
      sisa = baris.pop() ?? "";
      for (const b of baris.filter(Boolean)) {
        const obj = JSON.parse(b) as Baris;
        if (obj.jenis === "galat") galat = obj.pesan;
        rantai = rantai.then(() => saatBaris(obj));
      }
    });
    anak.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    anak.on("error", reject);
    anak.on("close", (kode) => {
      rantai.then(() => {
        if (kode === 0) resolve(null);
        else resolve(galat ?? `Pembaca PDF berhenti dengan kode ${kode}. ${stderr.slice(-300)}`);
      }, reject);
    });
  });
}

export async function prosesLembarKerja(k: Konteks, st: Penyimpanan = ambilPenyimpanan()) {
  const lkId = String(k.job.payload.lembarKerjaId);
  const [lk] = await k.db.select().from(schema.lembarKerja).where(eq(schema.lembarKerja.id, lkId));
  if (!lk) throw new Error("Lembar kerja tidak ditemukan");
  const [pr] = await k.db.select().from(schema.proyek).where(eq(schema.proyek.id, lk.proyekId));

  await k.db.delete(schema.halamanLembar).where(eq(schema.halamanLembar.lembarKerjaId, lkId));
  await k.db.update(schema.lembarKerja).set({ status: "membaca", galat: null }).where(eq(schema.lembarKerja.id, lkId));

  const kerja = await fs.mkdtemp(path.join(os.tmpdir(), "estimasi-"));
  try {
    const pdf = path.join(kerja, "sumber.pdf");
    await fs.writeFile(pdf, await st.baca(lk.kunciFile));
    const keluar = path.join(kerja, "out");
    const galat = await jalankanAlat(pdf, keluar, async (b) => {
      if (b.jenis === "info") await k.lapor(0, b.halaman);
      if (b.jenis === "halaman") {
        const dasar = `${pr.workspaceId}/${pr.id}/${lkId}`;
        const kThumb = `${dasar}/thumb-${b.nomor}-${randomUUID()}.png`;
        const kBesar = `${dasar}/besar-${b.nomor}-${randomUUID()}.png`;
        await st.simpan(kThumb, await fs.readFile(path.join(keluar, b.thumb)));
        await st.simpan(kBesar, await fs.readFile(path.join(keluar, b.besar)));
        await k.db.insert(schema.halamanLembar).values({
          lembarKerjaId: lkId, nomor: b.nomor, kunciThumb: kThumb, kunciBesar: kBesar,
          lebarPx: b.lebar, tinggiPx: b.tinggi,
        });
        await k.lapor(b.nomor);
      }
      if (b.jenis === "selesai") {
        // Render selesai; status baru "selesai" setelah pembaca gambar selesai (job baca_ai).
        await k.db
          .update(schema.lembarKerja)
          .set({ halaman: b.halaman, tahap: "baca", halamanDibaca: 0 })
          .where(eq(schema.lembarKerja.id, lkId));
        await antre(k.db, "baca_ai", { lembarKerjaId: lkId });
      }
    });
    if (galat) {
      await k.db.update(schema.lembarKerja).set({ status: "gagal", galat }).where(eq(schema.lembarKerja.id, lkId));
      throw new Error(galat);
    }
  } catch (e) {
    await k.db
      .update(schema.lembarKerja)
      .set({ status: "gagal", galat: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.lembarKerja.id, lkId));
    throw e;
  } finally {
    await fs.rm(kerja, { recursive: true, force: true }); // salinan PDF klien tidak dibiarkan di temp
  }
}

export function daftarkanPenanganPdf(st?: Penyimpanan) {
  daftarkanPenangan("baca_pdf", (k) => prosesLembarKerja(k, st ?? ambilPenyimpanan()));
}
