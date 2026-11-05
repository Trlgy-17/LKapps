import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const PERAN = ["estimator", "kepala_produksi", "purchasing", "admin"] as const;
export type Peran = (typeof PERAN)[number];

export const workspace = pgTable("workspace", {
  id: uuid("id").primaryKey().defaultRandom(),
  nama: text("nama").notNull(),
  pengaturan: jsonb("pengaturan").$type<Record<string, unknown>>().notNull().default({}),
});

export const brand = pgTable("brand", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspace.id),
  nama: text("nama").notNull(),
  logoUrl: text("logo_url"),
  warna: text("warna"),
});

export const pengguna = pgTable(
  "pengguna",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id),
    nama: text("nama").notNull(),
    email: text("email").notNull(),
    kataSandi: text("kata_sandi").notNull(),
    peran: text("peran").$type<Peran>().notNull(),
    aktif: integer("aktif").notNull().default(1),
  },
  (t) => [uniqueIndex("pengguna_email_uq").on(sql`lower(${t.email})`)],
);

export const material = pgTable(
  "material",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id),
    brandId: uuid("brand_id").references(() => brand.id),
    nama: text("nama").notNull(),
    // ukuran dalam mm sebagai teks desimal agar tidak ada float
    lembarLebar: text("lembar_lebar").notNull().default("1200"),
    lembarPanjang: text("lembar_panjang").notNull().default("2400"),
    tebal: text("tebal"),
    satuan: text("satuan").notNull().default("lembar"),
    seratTetap: integer("serat_tetap").notNull().default(0),
  },
  (t) => [uniqueIndex("material_nama_uq").on(t.workspaceId, sql`lower(${t.nama})`)],
);

export const materialAlias = pgTable(
  "material_alias",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    materialId: uuid("material_id").notNull().references(() => material.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
  },
  (t) => [uniqueIndex("material_alias_uq").on(sql`lower(${t.alias})`)],
);

export const RULESET_STATUS = ["draf", "aktif", "arsip"] as const;
export const ruleSet = pgTable(
  "rule_set",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id),
    versi: integer("versi").notNull(),
    status: text("status").$type<(typeof RULESET_STATUS)[number]>().notNull().default("draf"),
    penyetujuId: uuid("penyetuju_id").references(() => pengguna.id),
    dibuat: timestamp("dibuat", { withTimezone: true }).notNull().defaultNow(),
    disetujui: timestamp("disetujui", { withTimezone: true }),
  },
  (t) => [uniqueIndex("rule_set_versi_uq").on(t.workspaceId, t.versi)],
);

export const KATEGORI_ATURAN = ["bahan", "hardware", "sekrup", "parameter"] as const;
export const KEYAKINAN = ["terkalibrasi", "perkiraan", "perlu_konfirmasi"] as const;
export const aturan = pgTable(
  "aturan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleSetId: uuid("rule_set_id").notNull().references(() => ruleSet.id, { onDelete: "cascade" }),
    kategori: text("kategori").$type<(typeof KATEGORI_ATURAN)[number]>().notNull(),
    kunci: text("kunci").notNull(),
    nama: text("nama").notNull(),
    isi: text("isi").notNull(),
    sumber: text("sumber").notNull(),
    keyakinan: text("keyakinan").$type<(typeof KEYAKINAN)[number]>().notNull(),
  },
  (t) => [uniqueIndex("aturan_kunci_uq").on(t.ruleSetId, t.kategori, t.kunci), index("aturan_set_idx").on(t.ruleSetId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waktu: timestamp("waktu", { withTimezone: true }).notNull().defaultNow(),
    penggunaId: uuid("pengguna_id").references(() => pengguna.id),
    entitas: text("entitas").notNull(),
    entitasId: text("entitas_id").notNull(),
    aksi: text("aksi").notNull(),
    nilaiLama: jsonb("nilai_lama"),
    nilaiBaru: jsonb("nilai_baru"),
  },
  (t) => [index("audit_entitas_idx").on(t.entitas, t.entitasId)],
);

export const ruleSetRelations = relations(ruleSet, ({ many }) => ({ aturan: many(aturan) }));
export const aturanRelations = relations(aturan, ({ one }) => ({
  ruleSet: one(ruleSet, { fields: [aturan.ruleSetId], references: [ruleSet.id] }),
}));

export const STATUS_PROYEK = ["draf", "review", "disetujui", "belanja", "selesai"] as const;
export const proyek = pgTable(
  "proyek",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspace.id),
    brandId: uuid("brand_id").references(() => brand.id),
    klien: text("klien").notNull().default(""),
    lokasi: text("lokasi").notNull().default(""),
    pekerjaan: text("pekerjaan").notNull().default(""),
    surveyor: text("surveyor").notNull().default(""),
    tanggalGambar: text("tanggal_gambar"), // YYYY-MM-DD
    status: text("status").$type<(typeof STATUS_PROYEK)[number]>().notNull().default("draf"),
    dibuatOleh: uuid("dibuat_oleh").references(() => pengguna.id),
    dibuat: timestamp("dibuat", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("proyek_ws_idx").on(t.workspaceId)],
);

export const STATUS_LEMBAR_KERJA = ["diunggah", "membaca", "selesai", "gagal"] as const;
export const lembarKerja = pgTable("lembar_kerja", {
  id: uuid("id").primaryKey().defaultRandom(),
  proyekId: uuid("proyek_id").notNull().references(() => proyek.id, { onDelete: "cascade" }),
  versi: integer("versi").notNull().default(1),
  namaFile: text("nama_file").notNull(),
  ukuranByte: integer("ukuran_byte").notNull(),
  kunciFile: text("kunci_file").notNull(),
  halaman: integer("halaman"),
  tahap: text("tahap").$type<"render" | "baca">().notNull().default("render"),
  halamanDibaca: integer("halaman_dibaca").notNull().default(0),
  halamanGagal: jsonb("halaman_gagal").$type<number[]>().notNull().default([]), // halaman yang tidak terbaca setelah percobaan ulang
  status: text("status").$type<(typeof STATUS_LEMBAR_KERJA)[number]>().notNull().default("diunggah"),
  galat: text("galat"),
  dibuat: timestamp("dibuat", { withTimezone: true }).notNull().defaultNow(),
});

export const halamanLembar = pgTable(
  "halaman_lembar",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lembarKerjaId: uuid("lembar_kerja_id").notNull().references(() => lembarKerja.id, { onDelete: "cascade" }),
    nomor: integer("nomor").notNull(),
    kunciThumb: text("kunci_thumb").notNull(),
    kunciBesar: text("kunci_besar").notNull(),
    lebarPx: integer("lebar_px").notNull(),
    tinggiPx: integer("tinggi_px").notNull(),
    lembarTercetak: text("lembar_tercetak"), // nomor lembar tercetak; beda dari nomor halaman PDF
    jenis: text("jenis"), // denah | elevasi | detail | title_block | lainnya (dari pembaca)
  },
  (t) => [uniqueIndex("halaman_uq").on(t.lembarKerjaId, t.nomor)],
);

export const STATUS_JOB = ["antre", "jalan", "selesai", "gagal"] as const;
export const job = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jenis: text("jenis").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<(typeof STATUS_JOB)[number]>().notNull().default("antre"),
    progres: integer("progres").notNull().default(0), // halaman selesai
    total: integer("total"),
    galat: text("galat"),
    dibuat: timestamp("dibuat", { withTimezone: true }).notNull().defaultNow(),
    mulai: timestamp("mulai", { withTimezone: true }),
    selesai: timestamp("selesai", { withTimezone: true }),
  },
  (t) => [index("job_status_idx").on(t.status, t.dibuat)],
);

export const STATUS_NILAI = ["gambar", "skala", "asumsi", "belum_ada"] as const;
export const JENIS_FIELD = ["title_block", "spek", "ukuran", "catatan", "ukuran_hilang", "pintu", "laci", "sudut_robot", "part"] as const;
export type Posisi = { x: number; y: number; w: number; h: number }; // pecahan 0..1 dari halaman

/** Nilai hasil baca (FR-10..12). Selalu menunjuk halaman dan posisi sumbernya. */
export const bidangTerbaca = pgTable(
  "bidang_terbaca",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lembarKerjaId: uuid("lembar_kerja_id").notNull().references(() => lembarKerja.id, { onDelete: "cascade" }),
    halaman: integer("halaman").notNull(),
    jenis: text("jenis").$type<(typeof JENIS_FIELD)[number]>().notNull(),
    kunci: text("kunci").notNull(),
    nilai: text("nilai").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    status: text("status").$type<(typeof STATUS_NILAI)[number]>().notNull(),
    keyakinan: integer("keyakinan").notNull(), // persen 0..100, dari pembaca
    posisi: jsonb("posisi").$type<Posisi | null>(),
    unitNama: text("unit_nama"),
  },
  (t) => [index("bidang_lk_idx").on(t.lembarKerjaId, t.jenis)],
);

export const JENIS_UNIT = ["kabinet_atas", "kabinet_bawah", "box", "lemari", "wallpanel", "lainnya"] as const;
export const unitTerbaca = pgTable(
  "unit_terbaca",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lembarKerjaId: uuid("lembar_kerja_id").notNull().references(() => lembarKerja.id, { onDelete: "cascade" }),
    nama: text("nama").notNull(),
    jenis: text("jenis").$type<(typeof JENIS_UNIT)[number]>().notNull(),
    bahanUtama: text("bahan_utama"),
    halaman: integer("halaman").notNull(),
    halamanSemua: jsonb("halaman_semua").$type<number[]>().notNull().default([]), // semua tampak satu unit
    posisi: jsonb("posisi").$type<Posisi | null>(),
  },
  (t) => [index("unit_lk_idx").on(t.lembarKerjaId)],
);

export const JENIS_KONFLIK = ["jumlah_tidak_sama", "ukuran_berbeda"] as const;
export type OpsiKonflik = { label: string; halaman: number; posisi: Posisi | null; nilai: Record<string, number> };
export type JawabanKonflik = { pilihan: number } | { manual: Record<string, number> };
export const konflik = pgTable(
  "konflik",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lembarKerjaId: uuid("lembar_kerja_id").notNull().references(() => lembarKerja.id, { onDelete: "cascade" }),
    jenis: text("jenis").$type<(typeof JENIS_KONFLIK)[number]>().notNull(),
    item: text("item").notNull(),
    deskripsi: text("deskripsi").notNull(),
    opsi: jsonb("opsi").$type<OpsiKonflik[]>().notNull(),
    jawaban: jsonb("jawaban").$type<JawabanKonflik | null>(),
    dijawabOleh: uuid("dijawab_oleh").references(() => pengguna.id),
    dijawabPada: timestamp("dijawab_pada", { withTimezone: true }),
  },
  (t) => [index("konflik_lk_idx").on(t.lembarKerjaId)],
);

export const estimasi = pgTable(
  "estimasi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proyekId: uuid("proyek_id").notNull().references(() => proyek.id, { onDelete: "cascade" }),
    lembarKerjaId: uuid("lembar_kerja_id").notNull().references(() => lembarKerja.id),
    versi: integer("versi").notNull(),
    ruleSetId: uuid("rule_set_id").references(() => ruleSet.id),
    ruleSetVersi: integer("rule_set_versi"),
    status: text("status").$type<"draf">().notNull().default("draf"),
    /** Masukan yang dipakai mesin, tiap field membawa nilai, asal (baca/pengguna), dan catatan. */
    masukan: jsonb("masukan").$type<Record<string, unknown>>().notNull(),
    /** Keluaran mesin apa adanya; angka di layar = angka di sini. */
    hasil: jsonb("hasil").$type<Record<string, unknown>>().notNull(),
    dibuat: timestamp("dibuat", { withTimezone: true }).notNull().defaultNow(),
    dibuatOleh: uuid("dibuat_oleh").references(() => pengguna.id),
  },
  (t) => [uniqueIndex("estimasi_versi_uq").on(t.proyekId, t.versi)],
);

export const BASIS_REAL = ["kebutuhan_disahkan", "pembelian", "keluar_gudang", "pemakaian_bersih", "retur", "real_belum_dijelaskan"] as const;
export const dataReal = pgTable(
  "data_real",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proyekId: uuid("proyek_id").notNull().references(() => proyek.id, { onDelete: "cascade" }),
    versi: integer("versi").notNull(),
    teks: text("teks").notNull(), // teks asli tempelan pengguna
    basis: text("basis").$type<(typeof BASIS_REAL)[number]>().notNull(),
    estimasiId: uuid("estimasi_id").references(() => estimasi.id),
    hasil: jsonb("hasil").$type<Record<string, unknown>>().notNull(), // keluaran run_real.py
    dibuat: timestamp("dibuat", { withTimezone: true }).notNull().defaultNow(),
    dibuatOleh: uuid("dibuat_oleh").references(() => pengguna.id),
  },
  (t) => [uniqueIndex("data_real_versi_uq").on(t.proyekId, t.versi)],
);
