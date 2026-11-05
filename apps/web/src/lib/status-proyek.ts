/**
 * Status proyek dan kesiapan pembelian (SYSTEM_PROMPT §17). Murni.
 * Status bukan urutan mutu. `calculated` tidak pernah dipakai di sini karena belum ada validasi susunan potongan
 * atau pemetaan mekanisme. Persetujuan pembelian adalah status eksternal; aplikasi tidak menyetujui sendiri.
 */
export type StatusProyek = "incomplete_inputs" | "estimated" | "calculated" | "reconciled";
export type KesiapanPembelian = "not_assessed" | "blocked" | "ready_for_review";
export type StatusFinishing = "unknown" | "pending" | "partial" | "complete";

export type MasukanStatus = {
  adaEstimasi: boolean;
  konflikTerbuka: number;
  itemPerluKonfirmasi: number;
  halamanGagal: number;
  adaDataReal: boolean;
  unitTerbaca: number;
};

export type HasilStatus = {
  status: StatusProyek;
  kesiapanPembelian: KesiapanPembelian;
  finishing: StatusFinishing;
  modul: Record<"papan" | "hardware" | "sekrup" | "listrik" | "finishing", StatusProyek>;
  alasanBlokir: string[];
};

export function hitungStatus(m: MasukanStatus): HasilStatus {
  const alasan: string[] = [];
  if (!m.adaEstimasi) alasan.push("Belum ada estimasi");
  if (m.halamanGagal > 0) alasan.push(`${m.halamanGagal} halaman lembar kerja tidak terbaca`);
  if (m.unitTerbaca === 0) alasan.push("Tidak ada unit terbaca");
  if (m.konflikTerbuka > 0) alasan.push(`${m.konflikTerbuka} konflik gambar belum dijawab`);
  if (m.itemPerluKonfirmasi > 0) alasan.push(`${m.itemPerluKonfirmasi} item perlu konfirmasi`);
  alasan.push("Stok, isi kemasan, dan validasi susunan potongan belum ada");

  const kurang = !m.adaEstimasi || m.halamanGagal > 0 || m.unitTerbaca === 0;
  const status: StatusProyek = kurang ? "incomplete_inputs" : m.adaDataReal ? "reconciled" : "estimated";
  const modulDasar: StatusProyek = kurang ? "incomplete_inputs" : "estimated";
  return {
    status,
    // ready_for_review tidak pernah dicapai otomatis: stok dan isi kemasan tidak diketahui
    kesiapanPembelian: m.adaEstimasi ? "blocked" : "not_assessed",
    finishing: m.adaEstimasi ? "partial" : "unknown",
    modul: {
      papan: modulDasar, hardware: modulDasar, sekrup: modulDasar,
      listrik: "incomplete_inputs",       // kabel, saklar, stop kontak, lampu belum punya rumus
      finishing: m.adaEstimasi ? "estimated" : "incomplete_inputs",
    },
    alasanBlokir: alasan,
  };
}

export const NAMA_STATUS_PROYEK: Record<StatusProyek, string> = {
  incomplete_inputs: "Input belum lengkap", estimated: "Estimasi", calculated: "Terhitung", reconciled: "Direkonsiliasi",
};
export const NAMA_KESIAPAN: Record<KesiapanPembelian, string> = {
  not_assessed: "Belum dinilai", blocked: "Tertahan", ready_for_review: "Siap ditinjau",
};
