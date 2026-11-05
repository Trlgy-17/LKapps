# PLAN — Estimasi Material (MVP)

Status: Tahap 1 sampai 4 dikerjakan (lihat §7). Tahap 5 dan seterusnya menunggu persetujuan.

## 1. Kondisi awal

- Folder hanya berisi `PRD.md` dan `DESIGN.md`. Bukan repo git.
- Tool tersedia: Node 24.21, npm 11.19, Python 3.14.7, git 2.56. Tidak ada: pnpm, Docker.
- DESIGN.md menyebut file kanvas (`Main.dc.html`, `Review.dc.html`, dst.). File itu tidak ada di folder. Tampilan akan mengikuti teks DESIGN.md saja.
- Tidak ada contoh PDF lembar kerja (Aulia, Septi) maupun PDF hasil. Dibutuhkan mulai Tahap 4 dan 7.

## 2. Stack usulan

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Mesin hitung | Python 3.12+, stdlib untuk inti, pytest | PRD §8 sudah menunjuk worker Python untuk nesting. Satu bahasa untuk nesting, hardware, dan sekrup mencegah dua implementasi yang bisa berbeda angka. Dipisah dari web agar bisa dites tanpa DB. Pakai 3.12+ (3.14 terpasang, tapi pin versi yang didukung library). |
| Aritmetika | Bilangan bulat satuan 0,1 mm atau `Decimal` | Tebal potong 3,2 mm. Float bisa membuat hasil beda antarmesin; aturan 2 melarang. |
| Nesting | Guillotine (potong lurus tembus), urutan part dan tie-break tetap | Sesuai PRD §6.1 dan meja gergaji. Tanpa random, jadi deterministik. |
| Web | Next.js (App Router) + TypeScript | Ditunjuk PRD §8. |
| Gaya | CSS variables dari DESIGN.md §2 + CSS Modules, font IBM Plex | Token sudah lengkap; tanpa library UI yang menimpa token. |
| Database | PostgreSQL + Drizzle ORM | PRD §8. Drizzle dekat dengan SQL, migrasi tertulis, mudah diaudit. |
| Antrean | Tabel Postgres (`FOR UPDATE SKIP LOCKED`) | PRD §10: pekerjaan jalan saat browser ditutup. Cukup untuk beberapa estimator; tanpa Redis. |
| File | Penyimpanan objek kompatibel S3, enkripsi saat simpan; MinIO untuk lokal | PRD §8 dan §10 (keamanan). |
| Pembaca gambar | Claude API vision, keluaran JSON terstruktur, tiap nilai membawa halaman + posisi + keyakinan | FR-10..12. Render halaman PDF ke gambar dengan PyMuPDF. Pastikan syarat data tidak dipakai melatih model (PRD §10). |
| Pembuat PDF | HTML → PDF (WeasyPrint atau Playwright), diputuskan di Tahap 7 setelah lihat PDF contoh | Butuh contoh format Aulia/Septi dulu. |
| Auth | Auth.js, peran sesuai PRD §2 | FR-53. Detail tampilan login belum didesain (DESIGN §9). |
| Tes | pytest, Vitest, Playwright; AI direkam sebagai fixture | Aturan 2 dan CI tanpa biaya API. |

Pilihan "bisa berubah mengikuti tim developer" (PRD §8) — ubah di sini bila tim punya preferensi lain.

## 3. Struktur repo

```
engine/                  Python: mesin hitung murni
  estimasi_engine/
    status.py            Status angka + objek Hasil(jumlah, satuan, status, rumus)
    units.py             konversi mm/0,1 mm, format
    params.py            parameter dasar PRD §6.1
    screws.py            rumus sekrup §6.4
    hardware.py          aturan hardware §6.3
    materials.py         aturan bahan §6.2 → daftar potongan
    nesting.py           guillotine, CutSheet
    ruleset.py           RuleSet versi, pemuatan aturan
  tests/
  fixtures/
apps/web/                Next.js (layar DESIGN.md §5)
workers/                 baca PDF (AI), jalankan engine, ekspor PDF
packages/db/             skema + migrasi
docs/
```

## 4. Tahapan

Aturan umum tiap tahap: selesai hanya bila tes otomatis hijau dan pengguna menyetujui sebelum tahap berikutnya.

### Tahap 1 — Mesin hitung (Fase 0 roadmap)

**Hasil yang bisa dites:** paket `engine` yang menerima daftar unit/part/pintu/rel (data murni) dan RuleSet, lalu mengeluarkan daftar lembar, CutSheet, hardware, sekrup, masing-masing dengan rumus dan status. Dijalankan lewat `python -m pytest`; tanpa DB, web, atau AI.

**FR:** FR-22, FR-23, FR-24 (sisi mesin), dasar FR-21 (struktur daftar potongan), FR-25 (sisi mesin: parameter trim/kerf bisa diubah). Parameter §6.1, aturan §6.2–6.5. Gerbang Fase 0 (§12).

**Cakupan:**
1. Tipe Hasil + 5 status (gambar, skala, asumsi, terkalibrasi, perkiraan).
2. Nesting guillotine: kerf 3,2 mm, trim 0 mm (bisa 10 mm), ukuran lembar per material, HPL +10 mm per part, HPL kayu tidak diputar, HPL polos boleh diputar, AICA 935 x 2455 x 3 mm.
3. Aturan hardware: engsel, engsel full tekuk, engsel robot, rel (+ ukuran), hidrolik, ventilasi, rak sendok.
4. Rumus sekrup: 5/8, sekrup 7 + fisher, GP 3 + GP 5, minimum proyek kecil.
5. RuleSet berversi; hasil mencatat versi.
6. Harness validasi: jalankan engine pada fixture proyek (Aulia, Septi, +3 lagi) dan laporkan selisih lembar vs real.

**Kriteria selesai:**
- Semua tes di `engine/tests` hijau; tes yang menunggu data tertulis `skip` dengan alasan.
- Tes invarian nesting lulus untuk input acak berbenih tetap: tidak ada part tumpang tindih, semua part di area pakai, tiap part tercatat tepat sekali.
- Tes determinisme: 100 kali jalan, hasil identik byte demi byte; urutan input diacak tetap hasil sama.
- Fixture Aulia: 2 + 1 + 1 + 1 lembar bahan lembaran cocok persis (butuh daftar potongan — pertanyaan P1).
- Fixture Septi: 26 vs 25 lembar bahan 18 mm tercatat sebagai selisih yang diketahui; Multi min 18, Multi double 18, PVC 18, BB 18 min cocok persis; sekrup 300 / 20 / ±1.000 sesuai tabel §6.4 (butuh input — pertanyaan P2, P3).
- Fase 0: selisih total papan dan HPL pada 5 proyek ≤ 1 lembar per 10 lembar (PRD §11), atau selisih dijelaskan dan masuk daftar aturan baru.

### Tahap 2 — Fondasi app, katalog, pustaka aturan

**Hasil:** web app jalan lokal, login, peran, katalog material, pustaka aturan (versi, sumber, keyakinan), audit log. Engine dimuat dari RuleSet di DB.
**FR:** FR-50, FR-51, FR-53; non-fungsional audit dan keamanan file.
**Selesai:** peran membatasi akses sesuai PRD §2 (tes otomatis per peran); RuleSet berversi dan aturan "diajukan" tidak dipakai engine; setiap perubahan angka tercatat; layar Pustaka Aturan sesuai DESIGN §5.7; `.env.example` ada, tidak ada rahasia di git.

### Tahap 3 — Proyek dan upload

**Hasil:** buat proyek, upload PDF ≤ 50 MB, thumbnail tiap halaman dengan zoom, progres, state kosong/mengunggah/membaca/selesai/gagal.
**FR:** FR-01, FR-02, FR-03 (FR-04 P1 ditunda). Layar Daftar Proyek dan Proyek Baru.
**Selesai:** PDF 17 halaman terunggah tanpa gagal; PDF > 50 MB ditolak dengan pesan jelas; file hanya terbuka bagi anggota workspace; Playwright menguji alur unggah.

### Tahap 4 — Pembaca gambar AI

**Hasil:** worker membaca PDF per halaman → ExtractedField (nilai, halaman, posisi, status, keyakinan), Unit, Conflict. Jalan di latar belakang, progres per halaman.
**FR:** FR-10, FR-11, FR-12, FR-13, FR-14; isi otomatis title block untuk FR-01.
**Selesai:** keluaran lolos validasi skema; tiap nilai punya halaman sumber; ukuran tanpa sumber ditandai "belum ada", bukan ditebak; konflik contoh (kulkas 70 x 177,5 vs 92 x 179; 52 + 85 ≠ 134) terdeteksi pada PDF Septi; tes memakai rekaman AI; PDF 17 halaman < 3 menit. Butuh PDF contoh (P5).

### Tahap 5 — Review lembar kerja

**Hasil:** layar dua panel; klik nilai menyorot lokasi di PDF; tab Konflik, Spek, Unit, Ukuran; tambah/gabung/hapus unit; menjawab konflik; menerima asumsi.
**FR:** FR-11, FR-13, FR-14, FR-20.
**Selesai:** tombol "Hitung material" tidak ada sampai semua konflik dijawab dan teks "N konflik belum dijawab" tampil; ukuran kosong menahan hitung sampai diisi atau asumsi diterima; setiap edit tercatat di audit; aksesibilitas dasar (aria-pressed, role=tab).

### Tahap 6 — Hitung, hasil, pola potong, persetujuan

**Hasil:** tombol Hitung material menjalankan engine; layar Hasil Estimasi (5 kartu ringkasan, 5 tab, daftar konfirmasi); layar Pola Potong; editor daftar potongan per baris; alur status draf → review → disetujui → belanja → selesai.
**FR:** FR-21, FR-22, FR-23, FR-24, FR-30, FR-31, FR-32.
**Selesai:** angka di web sama persis dengan keluaran engine (tes kontrak); tiap jumlah menampilkan rumus dan status; "Setujui estimasi" nonaktif sampai semua konfirmasi selesai; ubah setelah disetujui membuat revisi baru; Hasil terbaca di ponsel (uji viewport); peta nesting `role="img"` dengan `aria-label`.

### Tahap 7 — Ekspor PDF

**Hasil:** PDF daftar belanja dan pola potong dengan logo/warna brand.
**FR:** FR-33.
**Selesai:** format cocok dengan PDF Aulia dan Septi (disetujui pengguna setelah melihat contoh); angka PDF = angka layar (tes otomatis); format angka Indonesia. Butuh PDF contoh (P5).

### Tahap 8 — Data real dan kalibrasi dasar

**Hasil:** tempel teks data real → parse → cocokkan katalog/alias → tabel selisih → alasan → usulan aturan → persetujuan admin → RuleSet baru.
**FR:** FR-40, FR-41, FR-42, FR-43, FR-44. Proyek tidak bisa ditutup tanpa data real (PRD §13).
**Selesai:** `multi min 18 : 11 lembar` terbaca; alias `multimin`, `multi min`, `multi 6` tersimpan; status cocok/kurang/lebih/baru benar; usulan tidak aktif sebelum admin setuju; estimasi lama tetap bisa diulang dengan RuleSet lamanya (tes).

### Di luar MVP (jangan dikerjakan)

P1: FR-04, FR-25 (UI uji perubahan), FR-34, FR-45, FR-52. Harga, RAB, purchase order, impor SketchUp, CNC, optimasi lintas proyek (PRD §4, §12 Fase 3). Login/katalog/editor yang belum didesain (DESIGN §9) dibuat sederhana mengikuti token, tanpa desain baru yang mengarang.

## 5. Tes Tahap 1 yang sudah ditulis

Lokasi: `engine/tests/`. Modul `estimasi_engine` belum ada, jadi tes sekarang gagal pada import (merah dulu, sengaja). Antarmuka di tes adalah usulan; boleh disesuaikan saat Tahap 1 dengan persetujuan.

| Tes | Sumber angka |
| --- | --- |
| `test_screws.py` rumus 5/8 | PRD §6.4: engsel x 4 + pasang rel x 14. Nilai tes dihitung tangan, dicatat di komentar. |
| rumus sekrup 7 + fisher | PRD §6.4: meter kabinet gantung x 3 |
| rumus GP | PRD §6.4: titik x 1,3, dibagi 1 : 1. 771 titik → 1.002 pcs (turunan dari "hasil Septi 1.002"; titik asli tidak ada di PRD) |
| minimum proyek kecil | PRD §6.4: 500 pcs total — di-skip, makna "total" belum jelas (P4) |
| Septi 300 / 20 / 1.002 | di-skip: jumlah engsel, pasang rel, meter gantung Septi tidak tertulis (P2) |
| `test_hardware.py` | PRD §6.3 (satu pasang per pintu / unit tarik / sudut, dst.) |
| `test_nesting.py` | PRD §6.1: lembar 1220 x 2440, kerf 3,2, trim 0, HPL +10, HPL kayu tidak diputar. Hitungan tangan di komentar. |
| `test_determinism.py` | Aturan 2 |
| Aulia 2+1+1+1, Septi 26 vs 25 | di-skip: daftar potongan tidak ada (P1) |

Status "Perkiraan" untuk semua rumus sekrup (PRD §6.4: dikalibrasi dari satu proyek).

## 6. Pertanyaan yang menghalangi (urut paling penting)

**P1. (Dijawab: data akan diberikan nanti, dipakai untuk uji. Tidak menghalangi implementasi nesting; hanya menahan tes Aulia/Septi dan gerbang Fase 0.)** Daftar potongan Ibu Aulia dan Ibu Septi (nama bahan, panjang, lebar, jumlah, arah serat per part). Tanpa ini nesting tidak bisa divalidasi terhadap 2+1+1+1 dan 26 vs 25 lembar, yang menjadi gerbang Fase 0. Juga 3 proyek tambahan untuk "uji di 5 proyek".

**P2. Input di balik rumus sekrup Septi:** jumlah engsel (pcs atau pasang?), jumlah pasang rel, dan meter kabinet gantung. Dengan 300 = engsel x 4 + rel x 14 ada banyak pasangan yang cocok (mis. 19 dan 16, atau 33 dan 12), jadi tidak bisa ditebak. Untuk 20 = meter x 3, meter yang dipakai (≈ 6,67?) dan aturan pembulatannya tidak tertulis.

**P3. Aturan pembulatan:** sekrup 7/fisher, GP, dan lembar (bulat ke atas?). Saya asumsikan 771 titik sambungan untuk 1.002 pcs GP (1,3 x 771 = 1.002,3 dibulatkan ke bawah/terdekat); konfirmasi titik sebenarnya dan arah pembulatan.

**P4. Arti "Minimum proyek kecil 500 pcs total":** 500 pcs total untuk semua sekrup, atau per jenis? Definisi "proyek kecil" (batas lembar atau unit)? Cara membagi 500 antar jenis sekrup?

**P5. PDF contoh:** lembar kerja Aulia dan Septi (input) dan PDF hasil Aulia/Septi (format keluaran FR-33), plus file kanvas desain `*.dc.html` bila ada. Dibutuhkan sebelum Tahap 4 dan 7.

**P6. Definisi "titik sambungan"** (untuk GP) dan "pasang rel" dalam bentuk yang bisa dihitung dari Part/Unit: titik sambungan dihitung dari apa (jumlah sambungan antar part? per unit?). Tanpa ini rumus GP tidak bisa dihitung dari daftar potongan, hanya dari angka jadi.

**P7. Tebal potong mata gergaji 10 inci** (PRD §13). Sementara 3,2 mm sebagai parameter yang bisa diubah, status "perkiraan". Konfirmasi juga arti "HPL +10 mm per part": saya tafsirkan +10 mm pada panjang dan pada lebar (710 x 510 untuk part 700 x 500), bukan +10 mm per sisi.

**P8. Pertanyaan bahan terbuka PRD §13:** (a) bagian apa saja memakai Multi polos 6 dan 9; (b) 1 lembar PVC 6 dan 1 lembar HPL TH 852 J tambahan untuk apa; (c) pintu mana yang bukan engsel lurus (gambar 22 psg vs real 16 psg); (d) apakah AICA, kaca, hanger tarik dibeli terpisah. Mesin akan memberi status "perkiraan"/"perlu konfirmasi" pada bagian ini sampai dijawab.

**P9. Aturan ukuran rel:** Kabinet Rel 50, laci lemari Rel 45 (Septi), Aulia berbeda — Aulia pakai apa? Engsel full tekuk, hidrolik rak piring, backsplash masih "perlu konfirmasi" di PRD; terima sebagai perkiraan dulu?

**P10. Lingkungan:** `pytest` belum terpasang (tes baru dicek sintaksnya, belum dijalankan). Boleh `pip install pytest` di virtualenv `engine/.venv`? Boleh `git init` di folder ini? Pakai npm (pnpm tidak terpasang) dan Python lokal tanpa Docker (Postgres/MinIO dipasang manual atau layanan cloud)? Bahasa dokumen internal: Indonesia (default).

**P11. Akun Anthropic dan kebijakan data:** API key tersedia (disimpan di env), dan konfirmasi kebijakan tidak melatih model dengan data klien (PRD §10). Dibutuhkan sebelum Tahap 4.

**P12. Jumlah estimator bulan pertama** (PRD §13), mempengaruhi pilihan antrean dan hosting. Prioritas rendah.

## 7. Status pengerjaan

### Tahap 1 — Mesin hitung: selesai sebagian
30 tes lulus, 5 di-skip (menunggu data P1, P2, P4). Nesting guillotine, hardware, sekrup, RuleSet, harness validasi ada. Belum: gerbang Fase 0 (butuh daftar potongan 5 proyek), aturan bahan yang menurunkan part dari ukuran unit (PRD tidak memberi rumusnya), minimum 500 pcs. Nesting memakai best-area-fit; belum dioptimasi, dan efisiensinya belum diuji terhadap hasil nyata.

### Tahap 2 — Fondasi: selesai
Login, 4 peran, katalog + alias, pustaka aturan berversi (draf → aktif oleh admin, lama diarsip), audit log. Selisih dari rencana: kode DB di `apps/web/src/db` (bukan `packages/db`); DB lokal PGlite karena Postgres tidak terpasang; auth buatan sendiri (scrypt + cookie HMAC) alih-alih Auth.js. Belum: halaman kelola pengguna (FR-53 baru berupa peran di DB dan pemeriksaan hak akses), tampilan audit.

### Tahap 3 — Proyek dan upload: selesai
Unggah PDF ≤ 50 MB (divalidasi ekstensi, tanda %PDF-, ukuran), simpan terenkripsi, render thumbnail + gambar besar, progres, zoom, state gagal + coba lagi, daftar proyek. PDF 17 halaman diuji dengan PDF sintetis. Selisih: file disimpan di disk lokal terenkripsi; S3/MinIO belum.

### Tahap 4 — Pembaca gambar AI: kode selesai, BELUM diuji dengan API sungguhan
Skema keluaran, klien Claude, deteksi konflik oleh kode (kulkas dan 52+85 dari PRD lulus tes dengan data sintetis), ukuran hilang ditandai `belum_ada`, isi otomatis data proyek dari title block, tes dengan rekaman. Belum terbukti: akurasi baca pada PDF Septi/Aulia asli, waktu < 3 menit untuk 17 halaman, apakah gambar 1600 px cukup untuk angka kecil. Butuh P5 (PDF) dan P11 (API key). Pencocokan nama item antarhalaman memakai nama persis setelah dinormalisasi; "Kulkas" dan "Kulkas 2 pintu" tidak dianggap sama.

### Tambahan: hitungan standar dan pintu asumsi (revisi pengguna, 5 Nov 2026)
- `engine/estimasi_engine/standar.py`: tarif per meter kabinet (status asumsi). `pintu_standar.py`: pintu kitchen bawah 60 x 70 cm, atas 40 x 70 cm, lebar 40–60 cm, tinggi standar 70–80 cm, Material 18 mm, serat tetap. Jumlah pintu mengikuti lembar kerja (pembaca AI mengisi `pintu`); ukuran asumsi hanya untuk pintu kitchen bawah/atas yang ukurannya tidak tertulis, ditahan sebagai `ukuran_hilang` sampai pengguna mengisi atau menerima asumsi (layar Review, Tahap 5).
- Kapasitas per lembar dilaporkan dua: teoritis (lembar 240 x 120 cm, tanpa tebal potong) dan realistis (parameter RuleSet). Hasil mesin bawah 6, atas 9. Angka pengguna untuk atas teoritis = 8: belum terjelaskan.
- Nama katalog "Material 18 mm" belum dipetakan ke material katalog (Multi min 18, BB 18 min, dst.).

### Revisi mengikuti SYSTEM_PROMPT v1.0 (5 Nov 2026)
Dikerjakan:
- `material.py`: kamus material dan kunci stabil. `data_real.py`: baris mentah, normalisasi satuan, gabung, koreksi (menggantikan, bukan menambah), peringatan duplikat, subtotal per kategori dan satuan. `luas.py`: luas, batas minimum luas, waste dua definisi, kekurangan, kemasan, luas HPL (Fraction, eksak). `nesting`: `tandai_tidak_muat` dan `validasi_nesting`. `validasi.py`: selisih = real - estimasi, persen None, keterbandingan basis. `Hasil.asal_bukti` (document_stated, calculated, assumed).
- Fixture Septi (35 baris) lulus semua angka kontrol §20: 34 item, polos 6 = 10 (B01+B04), papan 41 (13/3/25 per tebal), HPL 18, engsel 20 psg, rel 10 psg, sekrup 1.320 pcs, fisher terpisah, amplas 8 m, kabel 40 m.
- Pembaca gambar memuat isi antara BEGIN/END dari dokumen sebagai system prompt (di-cache), plus adendum yang melarang AI menghitung. Skema baca bertambah: `lembar_tercetak`; unit lintas tampak digabung; kode HPL dinormalisasi dengan teks asli tersimpan.

Pertentangan antar-dokumen yang saya selesaikan sendiri (koreksi bila salah):
1. Status angka: PRD (gambar/skala/asumsi/terkalibrasi/perkiraan) tetap untuk tampilan; SYSTEM_PROMPT (user_confirmed/document_stated/catalog_stated/calculated/assumed/unknown) disimpan sebagai `asal_bukti` turunan.
2. SYSTEM_PROMPT §14 dan §16 melarang koefisien universal. Tarif per meter dan pintu asumsi dari pengguna tetap dipakai sebagai profil SOP berstatus asumsi dengan sumber dan batas (tinggi standar 70–80 cm, minimalis). Koefisien dari Septi saja tetap berstatus perkiraan, tidak pernah terkalibrasi.
3. Ukuran lembar 1220 x 2440 dari PRD §6.1 diperlakukan sebagai asumsi awal; SYSTEM_PROMPT melarang menganggap semua lembar sama. Ukuran per material harus datang dari katalog.
4. Tanda selisih di PRD (estimasi - real) diganti real - estimasi.

Belum dikerjakan dari SYSTEM_PROMPT: kontrak JSON penuh §19 (struktur `bill_of_materials` dengan kolom real/estimasi/terverifikasi/pembelian terpisah), daftar komponen §9 (rumus turunan ukuran potong butuh profil konstruksi), stok sisa dan skenario pembelian, status proyek/kesiapan pembelian per modul, parser baris real di sisi web (FR-40, Tahap 8; saat ini hanya di engine).

### Hasil otomatis (tujuan produk, dikonfirmasi pengguna)
Upload LK -> render -> baca AI -> **hitung otomatis** (job `hitung_estimasi`) -> layar `/proyek/[id]/hasil`. Mesin hitung Python dipanggil lewat `engine/run_estimasi.py` (JSON stdin/stdout). Tiap angka membawa status, rumus, dan penanda perlu konfirmasi. Masukan yang tidak terbaca = tidak diketahui, item terkait tidak dihitung (bukan nol). Pengguna bisa mengisi masukan lalu hitung ulang: versi baru, versi lama utuh, tercatat di audit.
Penyimpangan sadar dari CLAUDE.md "tidak bisa dihitung sebelum konflik dijawab": hasil keluar otomatis sebagai DRAF; persetujuan, ekspor, dan belanja tetap terkunci sampai konflik dan konfirmasi selesai (Tahap 5 dan 7).
Batas saat ini: (1) tarif di Pustaka Aturan hanya dokumentasi; angka mesin memakai `TarifStandar` di kode, edit aturan belum mengubah hasil. (2) HPL, kabel, saklar, stop kontak, rumah lampu belum punya rumus. (3) Dasar meter (kabinet bawah + atas; kitchen = bawah) adalah tebakan terdokumentasi yang bisa diubah di panel Masukan hitung. (4) Dua model sekrup tampil berdampingan: per meter (dihitung ke kartu Sekrup) dan rumus PRD (pembanding).

### Ekspor PDF (FR-33)
`GET /api/proyek/[id]/pdf` (tombol Ekspor PDF di halaman Hasil; purchasing boleh). HTML dirakit di `apps/web/src/lib/pdf-hasil.ts` lalu dicetak Chrome headless (A4 lanskap, 4 halaman) mengikuti `PDF Estimasi Hasil/Estimasi_Material_Ibu_Septi.pdf`: 1 Ringkasan (kartu + kolom A/B/C), 2 Unit Pekerjaan, 3 Dasar Hitungan (rumus + status tiap angka), 4 Konfirmasi Sebelum Belanja. Header berlabel DRAF sampai persetujuan (Tahap 5/6) ada.
Beda dari PDF contoh: tidak ada peta denah dan matriks pemakaian per unit (mesin belum menghitung per unit dan denah tidak bisa diturunkan dari hasil baca), tidak ada kartu AICA, tidak ada uji perubahan (FR-25, P1). Butuh Chrome/Chromium di server (`CHROME_PATH`).

### AICA dan gambar sumber di PDF (jawaban pengguna)
- AICA mengikuti ukuran keseluruhan kabinet bawah: `engine/estimasi_engine/aica.py`. Luas top = jumlah lebar unit kabinet bawah x kedalaman top (dibaca dari gambar, sumbu "kedalaman", atau diisi manual). Lembar = batas minimum luas pada lembar 935 x 2455 mm (bukan susunan potongan). Panjang di atas 2455 mm dilaporkan sebagai jumlah sambungan. Selalu perlu konfirmasi. Bentuk bersudut (mis. L) belum punya definisi lintasan: dihitung sebagai bentang x kedalaman.
- PDF halaman 2 memuat gambar apa adanya dari lembar kerja yang diunggah (halaman berjenis denah, lalu tampak depan, lalu detail; maksimal dua) menggantikan denah gambar-ulang di PDF contoh.

### Penyedia AI: Gemini (permintaan pengguna)
Pembaca gambar kini bisa memakai Gemini (`src/lib/pembaca/gemini.ts`), dipilih lewat `PEMBACA_AI` (bawaan gemini). Keluaran JSON dipaksa lewat `responseJsonSchema` dari skema zod, lalu divalidasi ulang; 429/5xx/JSON rusak diulang (jeda tetap 2, 6, 15 detik). Belum diuji dengan API Gemini sungguhan: kepatuhan skema, akurasi baca angka dari gambar, dan batas laju (turunkan `PEMBACA_PARALEL`) harus dicoba pada LK asli.

### Otomatisasi lebih jauh (keluhan: masih manual)
- Setelah pembacaan selesai, halaman unggah langsung membuka Hasil Estimasi (tanpa klik). Halaman yang gagal dibaca tidak lagi menggagalkan seluruh lembar kerja: hasil keluar dari halaman yang terbaca, halaman gagal tercatat (`lembar_kerja.halaman_gagal`) dan muncul di Konfirmasi; hanya bila semua halaman gagal status gagal.
- Otomatis dari pengetahuan yang diberikan: HPL muka pintu (1 muka per pintu, +10 mm, serat tetap, nesting 1200 x 2400) dan lem dari HPL itu; sudut engsel robot dari catatan LK; kedalaman top AICA bawaan 60 cm (asumsi, perlu konfirmasi) bila tidak terbaca; papan dipecah per bahan utama unit (multipleks: Multi min 18 / Multi 6, blockboard: BB 18 min / Multi 6, PVC: PVC 18 / PVC 6).
- Tidak lagi membanjiri konfirmasi dengan "isi manual"; titik sambungan GP hanya opsional (pembanding rumus PRD).
- Belum otomatis (butuh daftar potongan per unit): titik sambungan GP dari ujung papan (1 sekrup per 15 cm, strip per 30 cm, 2 per kotak laci), nesting per bahan dari part, Multi double 18 untuk sekat dan ambalan, HPL badan/top/backsplash, minimum proyek kecil 500 pcs (makna belum jelas), kabel/saklar/stop kontak/lampu.

### Penyelarasan ke SYSTEM_PROMPT (permintaan "ikuti ini")
Teks yang ditempel pengguna identik dengan `SYSTEM_PROMPT_APLIKASI_ESTIMATOR_LK_INTERIOR_v1_0.md` (tidak berubah sejak 13:37). Yang ditambahkan:
- Status proyek per §17 (`src/lib/status-proyek.ts`): incomplete_inputs / estimated / reconciled (tidak pernah calculated otomatis), kesiapan pembelian blocked/not_assessed (tidak pernah ready_for_review otomatis: stok, isi kemasan, validasi susunan potongan belum ada), status per modul dan finishing partial. Tampil di Hasil dan PDF.
- Asal bukti koefisien SOP = `catalog_stated` dengan sumber dan batas tertulis (SOP pengguna 5 Nov 2026, tinggi 70–80 cm, minimalis); tampil di PDF halaman 3.
- Data Real (§5, §16; FR-40..42): `/proyek/[id]/real`, tempel teks, basis jumlah, normalisasi kamus material, rekonsiliasi per kelompok (selisih = real − estimasi, persen null bila estimasi 0, basis pembelian/retur tidak dianggap setara, satuan berbeda tidak dikonversi). Mesin: `engine/estimasi_engine/rekon.py`.
Konflik yang belum selesai: §1 dan §13 meminta hitungan dari KOMPONEN per unit, bukan dari meter lari. Tarif per meter dari pengguna dipertahankan sebagai SOP berlabel sampai ada profil konstruksi (aturan ukuran potong per bagian kabinet). Komponen, nesting per bahan, GP dari titik ikat, HPL badan/top, dan stok sisa menunggu profil itu.

### Logika bahan pintu (SOP pengguna, diulang 5 Nov 2026)
Pintu kitchen standar lebar 40–60 cm, tinggi 70 cm, lembar 240 x 120 cm. Bawah 60 x 70: 6 teoritis, 5–6 realistis per lembar. Atas 40 x 70: 8 teoritis, 7–8 realistis. `engine/.../pintu_standar.py: lembar_pintu_sop`: lembar utama = ceil(pintu / batas realistis terendah) (bawah 5, atas 7); minimum teoritis dilaporkan di rumus. Dipakai untuk pintu yang ukurannya tidak tertulis di LK. Nesting mesin (atas 9) tetap tampil sebagai pembanding. Hasil pintu belum dijumlahkan ke papan per meter (2 lembar/m): belum jelas apakah sudah memuat pintu.

### Kapasitas pintu mengikuti ukuran lembar (koreksi 5 Nov 2026)
Lembar bahan 2,40 x 1,20 m. Kapasitas per lembar dihitung dari ukuran lembar, bukan angka tetap: bawah 60 x 70 -> 2 x 3 = 6, atas 40 x 70 -> 3 x 3 = 9 (angka 8 di catatan pengguna tidak sesuai geometri). Realistis = (teoritis - 1) sampai teoritis, mengikuti pola catatan pengguna (6 -> 5–6). Lembar utama = ceil(pintu / realistis terendah): bawah 5, atas 8. Pola "teoritis - 1" adalah ekstrapolasi dari dua contoh, berstatus asumsi. RuleSet aktif disinkronkan lewat `npm run db:sinkron` (versi baru, versi lama utuh).

### Alur SKILL estimasi-material-interior: daftar potongan -> SKU -> nesting
- Pembaca AI sekarang juga membaca `part[]` per unit (nama, fungsi, panjang/lebar potong mm, jumlah, status ukuran gambar/skala/asumsi, HPL muka, kode HPL) mengikuti SKILL §3. Satu unit pada beberapa tampak: part diambil dari halaman dengan part terbanyak, halaman lain dicatat dan tidak dihitung.
- Mesin (`engine/estimasi_engine/komponen.py`): pemetaan bahan sesuai tabel SKILL §5 (badan/pintu: Multi min 18, BB 18 min, PVC 18 menurut bahan unit; sekat dan ambalan: Multi double 18; bilik: Multi 6 atau PVC 6; backsplash: Multi polos 6 + HPL TH 009 D; dudukan top dan lis: Multi polos 9), HPL +10 mm tidak diputar, nesting guillotine per SKU pada lembar 2,40 x 1,20 m, tebal potong 3,2 mm, trim 0, validasi tanpa tumpang tindih, panel lebih besar dari lembar ditandai (tidak diperkecil), luas per unit per SKU, batas minimum luas, lembar terakhir terpakai, uji trim 10 mm.
- GP dari titik sambungan komponen (SKILL §7): 2 x ceil(lebar/150 mm) per part struktur, ceil(panjang/300 mm) per strip, 2 per part kotak laci. Tafsiran "ujung papan = kedua sisi lebar"; selalu perlu konfirmasi.
- PDF jadi 5 halaman: Ringkasan, Peta Area Kerja, Logika Pemakaian (matriks bahan per unit), Konfirmasi (uji trim, lembar terakhir), Dasar Hitungan.
- Beda dari SKILL: lembar 2,40 x 1,20 m (SKILL menulis 1220 x 2440; pengguna menetapkan 2,40 x 1,20). Solver deterministik (urut tetap dan dua strategi orientasi), jadi tidak perlu beberapa seed.
- Risiko: akurasi part sepenuhnya bergantung pada pembacaan AI dari gambar; model lite kemungkinan lemah untuk ukuran. Semua part berstatus gambar/skala/asumsi dan hasil ditandai perlu konfirmasi. Tarif per meter tetap tampil sebagai pembanding.
