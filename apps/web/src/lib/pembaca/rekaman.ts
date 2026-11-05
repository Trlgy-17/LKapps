import type { HasilBacaHalaman, PembacaGambar } from "./skema";
import { SkemaHalaman } from "./skema";

export const HALAMAN_KOSONG: HasilBacaHalaman = {
  jenis_halaman: "lainnya",
  lembar_tercetak: null,
  jumlah_sudut_robot: null,
  title_block: null,
  unit: [],
  pintu: [],
  laci: [],
  part: [],
  spek: [],
  ukuran: [],
  ukuran_hilang: [],
  catatan: [],
};

/** Pembaca untuk tes: mengembalikan hasil rekaman per nomor halaman, divalidasi skema. Tanpa jaringan. */
export function buatPembacaRekaman(
  rekaman: Record<number, unknown>,
  bawaan: HasilBacaHalaman = HALAMAN_KOSONG,
): PembacaGambar & { dipanggil: number[] } {
  const dipanggil: number[] = [];
  return {
    dipanggil,
    async bacaHalaman(_png, info) {
      dipanggil.push(info.nomor);
      return SkemaHalaman.parse(rekaman[info.nomor] ?? bawaan);
    },
  };
}
