import type { Peran } from "@/db/schema";

/** Hak akses per peran — PRD §2 dan FR-53. */
export const AKSI = [
  "proyek.baca",
  "proyek.ubah",
  "estimasi.hitung",
  "estimasi.setujui",
  "real.input",
  "hasil.unduh",
  "katalog.baca",
  "katalog.kelola",
  "aturan.baca",
  "aturan.kelola",
  "aturan.setujui",
  "pengguna.kelola",
  "audit.baca",
] as const;
export type Aksi = (typeof AKSI)[number];

const IZIN: Record<Peran, readonly Aksi[]> = {
  estimator: ["proyek.baca", "proyek.ubah", "estimasi.hitung", "hasil.unduh", "katalog.baca", "aturan.baca"],
  kepala_produksi: [
    "proyek.baca", "proyek.ubah", "estimasi.hitung", "estimasi.setujui", "real.input",
    "hasil.unduh", "katalog.baca", "aturan.baca",
  ],
  purchasing: ["proyek.baca", "hasil.unduh"],
  admin: AKSI,
};

export function boleh(peran: Peran, aksi: Aksi): boolean {
  return IZIN[peran].includes(aksi);
}

export class DilarangError extends Error {
  constructor(peran: Peran, aksi: Aksi) {
    super(`Peran ${peran} tidak boleh ${aksi}`);
  }
}

export function wajib(peran: Peran, aksi: Aksi): void {
  if (!boleh(peran, aksi)) throw new DilarangError(peran, aksi);
}

export const NAMA_PERAN: Record<Peran, string> = {
  estimator: "Estimator",
  kepala_produksi: "Kepala produksi",
  purchasing: "Purchasing",
  admin: "Admin",
};
