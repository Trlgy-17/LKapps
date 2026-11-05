import { z } from "zod";

/**
 * Keluaran pembaca gambar untuk SATU halaman. AI hanya membaca apa yang tertulis/terlihat;
 * tidak menjumlah, tidak memutuskan konflik, tidak mengisi ukuran yang tidak ada (aturan 1 dan 4).
 */
const Posisi = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
const Keyakinan = z.number().int(); // 0..100, dibatasi di kode (skema JSON tidak mendukung min/max)

export const JENIS_HALAMAN = ["title_block", "denah", "elevasi", "detail", "lainnya"] as const;
export const FUNGSI_PART = ["sisi", "top", "bottom", "sekat", "ambalan", "belakang", "bilik", "alas_laci", "pintu", "muka_laci", "box_laci", "rak_tarik", "panel_tampak", "penguat", "soko", "filler", "lis", "backsplash", "dudukan_top", "rangka_wallpanel", "lainnya"] as const;
export const SUMBU = ["panjang", "lebar", "tinggi", "tebal", "kedalaman"] as const;
export const KUNCI_SPEK = ["bahan_utama", "finishing", "kode_hpl", "rel", "engsel", "lainnya"] as const;
export const JENIS_UNIT_BACA = ["kabinet_atas", "kabinet_bawah", "box", "lemari", "wallpanel", "lainnya"] as const;

export const SkemaHalaman = z.object({
  jenis_halaman: z.enum(JENIS_HALAMAN),
  jumlah_sudut_robot: z.number().int().nullable(), // jumlah sudut engsel robot yang disebut di halaman ini; null bila tidak disebut
  lembar_tercetak: z.string().nullable(), // nomor lembar yang tercetak di gambar (beda dari halaman PDF); null bila tidak ada
  title_block: z
    .object({
      klien: z.string().nullable(),
      lokasi: z.string().nullable(),
      pekerjaan: z.string().nullable(),
      surveyor: z.string().nullable(),
      tanggal_gambar: z.string().nullable(), // YYYY-MM-DD bila terbaca utuh, selain itu null
      keyakinan: Keyakinan,
      posisi: Posisi.nullable(),
    })
    .nullable(),
  unit: z.array(
    z.object({
      nama: z.string(),
      jenis: z.enum(JENIS_UNIT_BACA),
      bahan_utama: z.string().nullable(),
      posisi: Posisi.nullable(),
    }),
  ),
  pintu: z.array(
    z.object({
      unit: z.string().nullable(),
      letak: z.enum(["bawah", "atas", "lemari", "lainnya"]), // kabinet bawah / atas kitchen, lemari, lain
      fungsi: z.enum(["biasa", "sink", "gas", "rak_piring"]).nullable(), // pintu sink/gas/rak piring bila tertulis
      inset: z.boolean().nullable(), // true bila pintu inset; null bila tidak terlihat
      jumlah: z.number().int(), // jumlah daun pintu yang terhitung di gambar
      lebar_mm: z.number().nullable(), // null bila ukuran tidak tertulis
      tinggi_mm: z.number().nullable(),
      posisi: Posisi.nullable(),
    }),
  ),
  laci: z.array(
    z.object({
      unit: z.string().nullable(),
      letak: z.enum(["kabinet_bawah", "kabinet_atas", "lemari", "lainnya"]),
      urutan: z.enum(["paling_atas", "lainnya"]).nullable(), // laci teratas pada kabinet bawah = rak sendok
      jumlah: z.number().int(), // jumlah laci/rak tarik yang terlihat atau tertulis
      posisi: Posisi.nullable(),
    }),
  ),
  part: z.array(
    z.object({
      unit: z.string().nullable(),
      nama: z.string(),
      fungsi: z.enum(FUNGSI_PART),
      panjang_mm: z.number(),
      lebar_mm: z.number(),
      jumlah: z.number().int(),
      status_ukuran: z.enum(["gambar", "skala", "asumsi"]), // gambar = ukuran tertulis; skala = diukur dari skala; asumsi = diturunkan
      hpl_muka: z.boolean().nullable(), // true bila muka luar part dilapis HPL menurut gambar/spek; null bila tidak tertulis
      kode_hpl: z.string().nullable(),
      posisi: Posisi.nullable(),
    }),
  ),
  spek: z.array(
    z.object({
      kunci: z.enum(KUNCI_SPEK),
      unit: z.string().nullable(),
      nilai: z.string(),
      keyakinan: Keyakinan,
      posisi: Posisi.nullable(),
    }),
  ),
  ukuran: z.array(
    z.object({
      item: z.string(),
      sumbu: z.enum(SUMBU),
      nilai_mm: z.number(),
      tertulis: z.string(), // teks persis seperti di gambar, mis. "177,5"
      status: z.enum(["gambar", "skala"]),
      kelompok: z.string().nullable(), // penanda rantai ukuran yang sama di halaman ini
      peran: z.enum(["tunggal", "bagian", "total"]),
      keyakinan: Keyakinan,
      posisi: Posisi.nullable(),
    }),
  ),
  ukuran_hilang: z.array(
    z.object({
      item: z.string(),
      sumbu: z.enum(SUMBU),
      alasan: z.string(),
      posisi: Posisi.nullable(),
    }),
  ),
  catatan: z.array(
    z.object({
      teks: z.string(),
      unit: z.string().nullable(),
      keyakinan: Keyakinan,
      posisi: Posisi.nullable(),
    }),
  ),
});
export type HasilBacaHalaman = z.infer<typeof SkemaHalaman>;

export interface PembacaGambar {
  bacaHalaman(png: Buffer, info: { nomor: number; total: number }): Promise<HasilBacaHalaman>;
}

export function jepitKeyakinan(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
