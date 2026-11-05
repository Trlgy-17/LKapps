import { schema, type Db } from "@/db";
import type { AturanBaru } from "./aturan";
import { hashKataSandi } from "./password";

/**
 * Aturan awal — hanya yang tertulis di PRD §6.2–6.4. Tidak ada rumus tambahan.
 * keyakinan mengikuti PRD: "perlu konfirmasi" bila PRD menulisnya, selain itu perkiraan
 * (PRD §6.4: dikalibrasi dari dua proyek, belum cukup untuk status terkalibrasi).
 */
export const ATURAN_AWAL: AturanBaru[] = [
  { kategori: "bahan", kunci: "badan_pintu", nama: "Badan dan pintu", isi: "18 mm satu muka: melamin ke dalam, sisi polos untuk HPL", sumber: "Aulia, Septi", keyakinan: "perkiraan" },
  { kategori: "bahan", kunci: "sekat_ambalan", nama: "Sekat dan ambalan", isi: "18 mm dua muka, termasuk lemari", sumber: "Septi", keyakinan: "perkiraan" },
  { kategori: "bahan", kunci: "bilik_kayu", nama: "Bilik unit kayu", isi: "Multi 6", sumber: "Aulia, Septi", keyakinan: "perkiraan" },
  { kategori: "bahan", kunci: "bilik_pvc", nama: "Bilik kabinet PVC", isi: "PVC 6", sumber: "Septi", keyakinan: "perkiraan" },
  { kategori: "bahan", kunci: "backsplash", nama: "Backsplash", isi: "Multi polos 6 + HPL TH 009 D", sumber: "Septi", keyakinan: "perlu_konfirmasi" },
  { kategori: "bahan", kunci: "dudukan_top", nama: "Dudukan top dan lis tepi", isi: "Multi polos 9", sumber: "Septi (baru menjelaskan 2 dari 3 lembar)", keyakinan: "perlu_konfirmasi" },

  { kategori: "hardware", kunci: "engsel", nama: "Engsel", isi: "1 pasang per pintu", sumber: "Aulia, Septi", keyakinan: "perkiraan" },
  { kategori: "hardware", kunci: "engsel_full_tekuk", nama: "Engsel full tekuk", isi: "Pintu inset lemari", sumber: "Septi", keyakinan: "perlu_konfirmasi" },
  { kategori: "hardware", kunci: "engsel_robot", nama: "Engsel robot", isi: "1 pasang per sudut", sumber: "Septi", keyakinan: "perkiraan" },
  { kategori: "hardware", kunci: "rel", nama: "Rel", isi: "1 pasang per unit tarik", sumber: "Aulia, Septi", keyakinan: "perkiraan" },
  { kategori: "hardware", kunci: "ukuran_rel", nama: "Ukuran rel", isi: "Kabinet Rel 50, laci lemari Rel 45", sumber: "Septi (Aulia berbeda)", keyakinan: "perlu_konfirmasi" },
  { kategori: "hardware", kunci: "hidrolik", nama: "Hidrolik", isi: "1 pasang untuk pintu rak piring", sumber: "Septi", keyakinan: "perlu_konfirmasi" },
  { kategori: "hardware", kunci: "ventilasi", nama: "Ventilasi", isi: "Pintu sink dan pintu gas", sumber: "Aulia, Septi", keyakinan: "perkiraan" },
  { kategori: "hardware", kunci: "rak_sendok", nama: "Rak sendok", isi: "Laci atas kabinet bawah", sumber: "Aulia, Septi", keyakinan: "perkiraan" },

  { kategori: "sekrup", kunci: "sekrup_5_8", nama: "Sekrup 5/8", isi: "Jumlah engsel x 4 + pasang rel x 14", sumber: "Septi: 300 = 300", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "sekrup_7_fisher", nama: "Sekrup 7 dan fisher", isi: "Meter kabinet gantung x 3", sumber: "Septi: 20 = 20", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "gp", nama: "GP 3 + GP 5", isi: "Titik sambungan x 1,3, dibagi 1 : 1", sumber: "Septi: 1.002 vs real 1.000", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "minimum_kecil", nama: "Minimum proyek kecil", isi: "500 pcs total", sumber: "Aulia memakai 500", keyakinan: "perlu_konfirmasi" },

  { kategori: "bahan", kunci: "std_material_18", nama: "Standar: Material 18 mm", isi: "1 meter kabinet = 2 lembar (blockboard), tinggi standar", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "bahan", kunci: "std_material_6", nama: "Standar: Material 6 mm", isi: "1 meter kabinet = 1/2 lembar, ukuran lembar sama dengan 18 mm", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "hardware", kunci: "std_handle", nama: "Standar: Handle", isi: "1 pintu 1 handle (laci belum dipastikan)", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perlu_konfirmasi" },
  { kategori: "hardware", kunci: "std_hanger", nama: "Standar: Hanger lemari", isi: "1 lemari 1 hanger", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "hardware", kunci: "std_led", nama: "Standar: LED strip", isi: "1 roll 5 meter untuk 2 meter kitchen", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perlu_konfirmasi" },
  { kategori: "sekrup", kunci: "std_sekrup_5cm", nama: "Standar: Sekrup 5 cm", isi: "25 pcs per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_sekrup_3cm", nama: "Standar: Sekrup 3 cm", isi: "10 pcs per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_sekrup_4cm", nama: "Standar: Sekrup 4 cm", isi: "15 pcs per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_sekrup_5_8", nama: "Standar: Sekrup 5/8", isi: "30 pcs per meter kabinet (catatan asli: 1 meter / 3 pintu 30 pcs)", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perlu_konfirmasi" },
  { kategori: "sekrup", kunci: "std_lem", nama: "Standar: Lem", isi: "3 lembar HPL (2,40 x 1,20) = 1 galon 2,5 kg", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perlu_konfirmasi" },
  { kategori: "sekrup", kunci: "std_silen", nama: "Standar: Silen", isi: "1 pcs per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perlu_konfirmasi" },
  { kategori: "sekrup", kunci: "std_amplas_100", nama: "Standar: Amplas 100", isi: "1 per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_amplas_120", nama: "Standar: Amplas 120", isi: "1 per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_cat_min", nama: "Standar: Cat Min (tusir)", isi: "1 ons per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_cat_hpl", nama: "Standar: Cat HPL", isi: "1 ons per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "sekrup", kunci: "std_tahanan_hambalan", nama: "Standar: Tahanan hambalan", isi: "12 pcs per meter kabinet", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },

  { kategori: "bahan", kunci: "std_pintu_sop", nama: "Standar: lembar untuk pintu kitchen", isi: "Lembar 2,40 x 1,20 m. Kapasitas pintu per lembar dihitung dari ukuran lembar: bawah 60 x 70 cm teoritis 6 (realistis 5–6), atas 40 x 70 cm teoritis 9 (realistis 8–9). Realistis = teoritis dikurangi 1 sampai teoritis. Jumlah lembar utama memakai batas realistis terendah.", sumber: "SOP pengguna (logika perhitungan bahan pintu)", keyakinan: "perlu_konfirmasi" },
  { kategori: "parameter", kunci: "pintu_bawah_asumsi", nama: "Pintu kitchen bawah (asumsi)", isi: "60 x 70 cm bila lembar kerja tidak mencantumkan ukuran; jumlah pintu mengikuti lembar kerja; lebar 40–60 cm, tinggi standar 70–80 cm; material 18 mm, serat tetap; lembar teoritis 240 x 120 cm tanpa tebal potong", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },
  { kategori: "parameter", kunci: "pintu_atas_asumsi", nama: "Pintu kitchen atas (asumsi)", isi: "40 x 70 cm bila gambar tidak mencantumkan ukuran", sumber: "Standar workshop (catatan 5 Nov 2026)", keyakinan: "perkiraan" },

  { kategori: "parameter", kunci: "ukuran_lembar", nama: "Ukuran papan dan HPL", isi: "1200 x 2400 mm (2,40 x 1,20 m), bisa diubah per material", sumber: "PRD §6.1", keyakinan: "perkiraan" },
  { kategori: "parameter", kunci: "aica", nama: "AICA Cerarl", isi: "935 x 2455 x 3 mm (XKAF 14165 ZMN)", sumber: "Daftar produk", keyakinan: "perkiraan" },
  { kategori: "parameter", kunci: "tebal_potong", nama: "Tebal potong", isi: "3,2 mm (mata 10 inci; tebal aktual belum diukur)", sumber: "PRD §6.1", keyakinan: "perlu_konfirmasi" },
  { kategori: "parameter", kunci: "trim_tepi", nama: "Trim tepi lembar", isi: "0 mm (uji perubahan memakai 10 mm)", sumber: "PRD §6.1", keyakinan: "perkiraan" },
  { kategori: "parameter", kunci: "kelebihan_hpl", nama: "Kelebihan HPL per part", isi: "+10 mm untuk trim setelah lapis", sumber: "PRD §6.1", keyakinan: "perkiraan" },
  { kategori: "parameter", kunci: "metode_nesting", nama: "Metode nesting", isi: "Potong lurus tembus, sesuai meja gergaji", sumber: "PRD §6.1", keyakinan: "perkiraan" },
  { kategori: "parameter", kunci: "arah_serat", nama: "Arah serat", isi: "HPL kayu tidak diputar; HPL polos boleh diputar", sumber: "PRD §6.1", keyakinan: "perkiraan" },
];

/** Buat workspace, RuleSet v1 aktif, dan satu admin. Kata sandi dari pemanggil (env), tidak ada default. */
export async function seed(db: Db, opsi: { adminEmail: string; adminKataSandi: string; adminNama?: string }) {
  const [ws] = await db.insert(schema.workspace).values({ nama: "Putra Corporation" }).returning();
  await db.insert(schema.brand).values({ workspaceId: ws.id, nama: "Putra Corporation" });
  const [admin] = await db
    .insert(schema.pengguna)
    .values({
      workspaceId: ws.id,
      nama: opsi.adminNama ?? "Admin",
      email: opsi.adminEmail,
      kataSandi: await hashKataSandi(opsi.adminKataSandi),
      peran: "admin",
    })
    .returning();
  const [rs] = await db
    .insert(schema.ruleSet)
    .values({ workspaceId: ws.id, versi: 1, status: "aktif", penyetujuId: admin.id, disetujui: new Date() })
    .returning();
  await db.insert(schema.aturan).values(ATURAN_AWAL.map((a) => ({ ...a, ruleSetId: rs.id })));
  return { workspace: ws, admin, ruleSet: rs };
}
