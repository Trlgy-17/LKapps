# CLAUDE.md — Estimasi Material (Putra Corporation)

Acuan: `PRD.md` (fitur, aturan hitung), `DESIGN.md` (tampilan), `SYSTEM_PROMPT_APLIKASI_ESTIMATOR_LK_INTERIOR_v1_0.md` (aturan AI, kamus material, kontrak data real; dimuat apa adanya oleh pembaca gambar), `PLAN.md` (tahapan, pertanyaan terbuka).
Kalau ketiganya bertentangan dengan catatan ini, PRD.md menang untuk fitur dan rumus, DESIGN.md menang untuk tampilan.

## Produk

Web app internal untuk tim interior. Alur: upload PDF lembar kerja → AI membaca gambar → estimator review dan jawab konflik → kode menghitung material → estimasi disetujui → PDF belanja dan pola potong → data produksi real masuk → aturan dikalibrasi (aktif hanya setelah disetujui admin).
Peran: Estimator, Kepala produksi, Purchasing, Admin (PRD §2).

## Aturan wajib

1. AI hanya membaca gambar. Jumlah material dihitung kode deterministik dan aturan.
2. Input dan versi aturan yang sama selalu menghasilkan angka yang sama (tanpa random, tanpa waktu, tanpa urutan hash tak tentu).
3. Setiap angka punya status: gambar, skala, asumsi, terkalibrasi, atau perkiraan.
4. Jangan mengarang data, ukuran, atau rumus. Tidak ada di dokumen → tanya pengguna.
5. Antarmuka bahasa Indonesia, angka format Indonesia (`1.320`, `6,05`). Satuan: mm, cm, lembar, psg, pcs, mtr.
6. Hanya cakupan MVP. Harga, RAB, purchase order tidak dikerjakan.
7. Rahasia (API key, kredensial DB, kunci storage) hanya di environment variable. `.env` masuk `.gitignore`; yang di-commit hanya `.env.example` tanpa nilai asli.

Dari SYSTEM_PROMPT (ikut wajib):
- Kamus material di `engine/estimasi_engine/material.py`: "multi" = multipleks POLOS (tidak ditanyakan lagi); doblemin dicocokkan sebelum min; angka 6/9/18 dalam nama bahan = tebal mm; nama asing tidak dipaksa cocok.
- Unknown tetap unknown, bukan nol. Satuan tidak dikonversi diam-diam (psg tetap psg, blk tetap blk). Hanya satuan kompatibel yang dijumlahkan.
- Data real, estimasi, batas minimum luas, kebutuhan terverifikasi, dan pembelian adalah kolom berbeda. Tidak ada waste bawaan.
- Selisih = real - estimasi; persen None bila estimasi 0. Kasus Septi hanya fixture uji (`engine/fixtures/septi_real.json`), bukan koefisien.
- Nomor halaman PDF dan nomor lembar tercetak dibedakan. Satu kabinet pada beberapa tampak = satu unit.
- Tarif per meter dan ukuran pintu asumsi adalah profil SOP dari pengguna (status asumsi), bukan koefisien universal.
- Maksimal 3 pertanyaan penting per respons.

Turunan yang ikut wajib:
- Ukuran dihitung dalam bilangan bulat satuan 0,1 mm (atau `Decimal`), bukan float.
- Hasil hitung menyimpan versi RuleSet yang dipakai.
- Perubahan angka mencatat pengguna, waktu, nilai lama, nilai baru (audit).
- Aturan baru dari kalibrasi tidak aktif sebelum disetujui admin.
- Estimasi tidak bisa dihitung sebelum semua konflik dijawab; tidak bisa disetujui sebelum semua konfirmasi selesai.

## Stack (terpasang)

- Mesin hitung: Python (stdlib saja), pytest. Venv: `engine/.venv`.
- Web: Next.js 16 (App Router) + TypeScript, CSS variables dari DESIGN.md, Vitest.
- Database: PostgreSQL + Drizzle ORM. Tanpa `DATABASE_URL` memakai PGlite (Postgres tertanam) di `apps/web/.data/pglite`. Migrasi di `apps/web/drizzle`.
- Antrean pekerjaan: tabel `job` di Postgres, dijalankan proses Next (`src/instrumentation.ts`), pekerjaan terputus diantrekan ulang saat start.
- File: enkripsi AES-256-GCM di disk lokal (`FILE_ENCRYPTION_KEY`). Penyimpanan objek S3 belum dibuat (antarmuka `Penyimpanan` siap).
- PDF: PyMuPDF di `workers/pdf_tools.py` (venv `workers/.venv`), dipanggil sebagai subproses.
- Pembaca gambar: Gemini (`@google/genai`, bawaan, env `PEMBACA_AI=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL` bawaan `gemini-pro-latest`) atau Claude (`PEMBACA_AI=claude`, `ANTHROPIC_API_KEY`). Keduanya memakai skema zod yang sama dan system prompt dari dokumen; hasil divalidasi zod. Antarmuka `PembacaGambar` di `src/lib/pembaca/skema.ts`.
- Auth: kata sandi scrypt + cookie sesi bertanda tangan HMAC (`SESSION_SECRET`).

## Struktur folder

```
engine/                  Mesin hitung murni (estimasi_engine/, tests/, fixtures/)
workers/                 pdf_tools.py (render PDF), tests/
apps/web/
  src/db/                Skema Drizzle + koneksi
  src/lib/               permissions, aturan, material, proyek, antrean, storage, pdf-proses
  src/lib/pembaca/       skema zod, klien Claude, rekaman (tes), konflik (kode), simpan, penangan
  src/app/               Halaman dan route API
  tests/                 Vitest
  scripts/               migrate.ts, seed.ts
PRD.md  DESIGN.md  PLAN.md  CLAUDE.md
```

## Menjalankan tes

```
cd engine && .venv/Scripts/python -m pytest        # mesin hitung
cd workers && .venv/Scripts/python -m pytest       # render PDF
cd apps/web && npx vitest run                      # web, DB, antrean, pembaca (rekaman)
```
Tes yang butuh data yang belum diberikan memakai `skip` dengan alasan; jangan diisi angka karangan.
Menjalankan app: salin `apps/web/.env.example` ke `.env.local`, isi, lalu `npm run db:seed` dan `npm run dev` di `apps/web`.

## Cara bekerja

- Kerjakan per tahap di PLAN.md; jangan lompat. Tahap berikutnya mulai setelah kriteria selesai tahap sekarang terpenuhi dan pengguna setuju.
- Tes ditulis lebih dulu untuk mesin hitung. Angka tes harus bisa ditunjuk ke PRD atau hitungan tangan yang ditulis di komentar tes.
- Panggilan AI di tes memakai rekaman (fixture); CI tidak memanggil API sungguhan.
