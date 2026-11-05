import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** Penyimpanan file terenkripsi saat disimpan (PRD §10). AES-256-GCM: iv(12) | tag(16) | data. */
export interface Penyimpanan {
  simpan(kunci: string, data: Buffer): Promise<void>;
  baca(kunci: string): Promise<Buffer>;
  hapus(kunci: string): Promise<void>;
}

const KUNCI_VALID = /^[A-Za-z0-9_\-]+(\/[A-Za-z0-9_\-]+)*(\.[A-Za-z0-9]+)?$/;

export function penyimpananLokal(akar: string, kunciHex: string): Penyimpanan {
  if (!/^[0-9a-fA-F]{64}$/.test(kunciHex)) {
    throw new Error("FILE_ENCRYPTION_KEY harus 64 karakter heksadesimal (32 byte).");
  }
  const kunciEnkripsi = Buffer.from(kunciHex, "hex");
  const lokasi = (kunci: string) => {
    if (!KUNCI_VALID.test(kunci)) throw new Error(`Kunci berkas tidak valid: ${kunci}`);
    return path.join(akar, ...kunci.split("/"));
  };
  return {
    async simpan(kunci, data) {
      const iv = randomBytes(12);
      const c = createCipheriv("aes-256-gcm", kunciEnkripsi, iv);
      const isi = Buffer.concat([c.update(data), c.final()]);
      const f = lokasi(kunci);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, Buffer.concat([iv, c.getAuthTag(), isi]));
    },
    async baca(kunci) {
      const mentah = await fs.readFile(lokasi(kunci));
      const d = createDecipheriv("aes-256-gcm", kunciEnkripsi, mentah.subarray(0, 12));
      d.setAuthTag(mentah.subarray(12, 28));
      return Buffer.concat([d.update(mentah.subarray(28)), d.final()]);
    },
    async hapus(kunci) {
      await fs.rm(lokasi(kunci), { force: true });
    },
  };
}

let _bawaan: Penyimpanan | undefined;
/** Lokal untuk pengembangan. Penyimpanan objek S3 menyusul sebelum produksi (lihat PLAN). */
export function ambilPenyimpanan(): Penyimpanan {
  if (!_bawaan) {
    const kunci = process.env.FILE_ENCRYPTION_KEY;
    if (!kunci) throw new Error("FILE_ENCRYPTION_KEY belum diisi. Lihat .env.example.");
    _bawaan = penyimpananLokal(process.env.BERKAS_DIR ?? path.join(process.cwd(), ".data", "berkas"), kunci);
  }
  return _bawaan;
}
