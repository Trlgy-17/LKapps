/** Nama tampilan dan pengelompokan item hasil mesin (DESIGN §5.4: tab Papan dan HPL, Hardware, Sekrup dan bantu, Listrik, Finishing). */
export type Tab = "papan" | "hardware" | "sekrup" | "listrik" | "finishing";
export const NAMA_TAB: Record<Tab, string> = {
  papan: "Papan dan HPL", hardware: "Hardware", sekrup: "Sekrup dan bantu", listrik: "Listrik", finishing: "Finishing",
};

export type Baris = { opsional?: boolean; kunci: string; kelompok: "standar" | "hardware" | "sekrup" | "pintu_asumsi"; item: string; untuk: string; tab: Tab };

export const BARIS: Baris[] = [
  { kunci: "material_18", kelompok: "standar", item: "Material 18 mm", untuk: "Badan, pintu, sekat (tarif per meter)", tab: "papan" },
  { kunci: "material_6", kelompok: "standar", item: "Material 6 mm", untuk: "Bilik, belakang (tarif per meter)", tab: "papan" },
  { kunci: "aica", kelompok: "standar", item: "AICA Cerarl 935 x 2455 x 3 mm", untuk: "Top kabinet bawah (ukuran keseluruhan)", tab: "papan" },
  { kunci: "papan18_multipleks", kelompok: "standar", item: "Multi min 18 mm", untuk: "Unit multipleks (badan, pintu, sekat)", tab: "papan", opsional: true },
  { kunci: "papan6_multipleks", kelompok: "standar", item: "Multi 6 mm", untuk: "Bilik unit multipleks", tab: "papan", opsional: true },
  { kunci: "papan18_blockboard", kelompok: "standar", item: "BB 18 min", untuk: "Unit blockboard (badan, pintu, sekat)", tab: "papan", opsional: true },
  { kunci: "papan6_blockboard", kelompok: "standar", item: "Multi 6 mm (unit blockboard)", untuk: "Bilik unit blockboard", tab: "papan", opsional: true },
  { kunci: "papan18_pvc", kelompok: "standar", item: "PVC 18 mm", untuk: "Badan kabinet PVC", tab: "papan", opsional: true },
  { kunci: "papan6_pvc", kelompok: "standar", item: "PVC 6 mm", untuk: "Bilik dan alas laci kabinet PVC", tab: "papan", opsional: true },
  { kunci: "papan18_tidak_diketahui", kelompok: "standar", item: "Material 18 mm (bahan unit belum terbaca)", untuk: "Unit tanpa bahan utama tertulis", tab: "papan", opsional: true },
  { kunci: "papan6_tidak_diketahui", kelompok: "standar", item: "Material 6 mm (bahan unit belum terbaca)", untuk: "Unit tanpa bahan utama tertulis", tab: "papan", opsional: true },
  { kunci: "pintu_bawah_lembar", kelompok: "standar", item: "Material 18 mm: pintu bawah", untuk: "Pintu kitchen bawah 60 x 70 cm; kapasitas dari ukuran lembar 2,40 x 1,20 m", tab: "papan", opsional: true },
  { kunci: "pintu_atas_lembar", kelompok: "standar", item: "Material 18 mm: pintu atas", untuk: "Pintu kitchen atas 40 x 70 cm; kapasitas dari ukuran lembar 2,40 x 1,20 m", tab: "papan", opsional: true },
  { kunci: "pintu_lembar", kelompok: "standar", item: "Material 18 mm: total pintu", untuk: "Belum dijumlahkan ke papan per meter (perlu konfirmasi)", tab: "papan", opsional: true },
  { kunci: "hpl_pintu", kelompok: "standar", item: "HPL (muka pintu)", untuk: "1 muka HPL per pintu, +10 mm, serat tetap", tab: "papan" },
  { kunci: "engsel", kelompok: "hardware", item: "Engsel", untuk: "1 psg per pintu", tab: "hardware" },
  { kunci: "engsel_full_tekuk", kelompok: "hardware", item: "Engsel full tekuk", untuk: "Pintu inset lemari", tab: "hardware" },
  { kunci: "engsel_robot", kelompok: "hardware", item: "Engsel robot", untuk: "1 psg per sudut", tab: "hardware" },
  { kunci: "Rel 50", kelompok: "hardware", item: "Rel 50", untuk: "1 psg per laci/rak tarik kabinet", tab: "hardware" },
  { kunci: "Rel 45", kelompok: "hardware", item: "Rel 45", untuk: "1 psg per laci lemari", tab: "hardware" },
  { kunci: "hidrolik", kelompok: "hardware", item: "Hidrolik", untuk: "Pintu rak piring", tab: "hardware" },
  { kunci: "ventilasi", kelompok: "hardware", item: "Ventilasi", untuk: "Pintu sink dan gas", tab: "hardware" },
  { kunci: "rak_sendok", kelompok: "hardware", item: "Rak sendok", untuk: "Laci atas kabinet bawah", tab: "hardware" },
  { kunci: "handle", kelompok: "standar", item: "Handle", untuk: "1 per pintu", tab: "hardware" },
  { kunci: "hanger", kelompok: "standar", item: "Hanger lemari", untuk: "1 per lemari", tab: "hardware" },
  { kunci: "sekrup_5cm", kelompok: "standar", item: "Sekrup 5 cm", untuk: "Per meter kabinet", tab: "sekrup" },
  { kunci: "sekrup_4cm", kelompok: "standar", item: "Sekrup 4 cm", untuk: "Per meter kabinet", tab: "sekrup" },
  { kunci: "sekrup_3cm", kelompok: "standar", item: "Sekrup 3 cm", untuk: "Per meter kabinet", tab: "sekrup" },
  { kunci: "sekrup_5_8_standar", kelompok: "standar", item: "Sekrup 5/8", untuk: "Per meter kabinet", tab: "sekrup" },
  { kunci: "silen", kelompok: "standar", item: "Silen", untuk: "Per meter kabinet", tab: "sekrup" },
  { kunci: "tahanan_hambalan", kelompok: "standar", item: "Tahanan hambalan", untuk: "Per meter kabinet", tab: "sekrup" },
  { kunci: "sekrup_5_8", kelompok: "sekrup", item: "Sekrup 5/8 (rumus PRD, pembanding)", untuk: "Engsel x 4 + pasang rel x 14", tab: "sekrup" },
  { kunci: "sekrup_7_fisher", kelompok: "sekrup", item: "Sekrup 7 dan fisher (rumus PRD, pembanding)", untuk: "Meter kabinet gantung x 3", tab: "sekrup" },
  { kunci: "gp3", kelompok: "sekrup", item: "GP 3 (rumus PRD, pembanding)", untuk: "Titik sambungan x 1,3 dibagi 1 : 1", tab: "sekrup" },
  { kunci: "gp5", kelompok: "sekrup", item: "GP 5 (rumus PRD, pembanding)", untuk: "Titik sambungan x 1,3 dibagi 1 : 1", tab: "sekrup" },
  { kunci: "led_strip", kelompok: "standar", item: "LED strip", untuk: "1 roll 5 m per 2 meter kitchen", tab: "listrik" },
  { kunci: "amplas_100", kelompok: "standar", item: "Amplas 100", untuk: "Per meter kabinet", tab: "finishing" },
  { kunci: "amplas_120", kelompok: "standar", item: "Amplas 120", untuk: "Per meter kabinet", tab: "finishing" },
  { kunci: "cat_min", kelompok: "standar", item: "Cat Min (tusir)", untuk: "1 ons per meter kabinet", tab: "finishing" },
  { kunci: "cat_hpl", kelompok: "standar", item: "Cat HPL", untuk: "1 ons per meter kabinet", tab: "finishing" },
  { kunci: "lem_galon", kelompok: "standar", item: "Lem", untuk: "1 galon 2,5 kg per 3 lembar HPL", tab: "finishing" },
];

/** Item yang belum punya rumus; tampil sebagai baris "belum dihitung" agar tidak terlihat nol. */
export const BELUM_ADA_RUMUS: { item: string; alasan: string; tab: Tab }[] = [
  { item: "HPL badan, top, backsplash", alasan: "Belum ada rumus (butuh daftar muka yang dilapisi HPL); hanya muka pintu dihitung", tab: "papan" },
  { item: "Rumah lampu", alasan: "Tarif belum diberikan", tab: "listrik" },
  { item: "Kabel, saklar, stop kontak, lampu", alasan: "Belum ada rumus; butuh jalur dan titik dari lembar kerja", tab: "listrik" },
];

export const KARTU = [
  { judul: "Papan", kunci: ["material_18", "material_6"], dari: "standar", satuan: "lembar" },
  { judul: "HPL", kunci: ["hpl_pintu"], dari: "standar", satuan: "lembar" },
  { judul: "AICA", kunci: ["aica"], dari: "standar", satuan: "lembar" },
  { judul: "Engsel", kunci: ["engsel", "engsel_full_tekuk", "engsel_robot"], dari: "hardware", satuan: "psg" },
  { judul: "Rel", kunci: ["Rel 50", "Rel 45"], dari: "hardware", satuan: "psg" },
  { judul: "Sekrup", kunci: ["sekrup_5cm", "sekrup_4cm", "sekrup_3cm", "sekrup_5_8_standar"], dari: "standar", satuan: "pcs" },
] as const;
