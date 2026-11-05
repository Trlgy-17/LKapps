# DESIGN Web App Estimasi Material Interior

| Dokumen | Nilai |
| --- | --- |
| Versi | 1.0 |
| Tanggal | 5 November 2026 |
| Status | Draf untuk tim internal |
| Pasangan dokumen | `PRD.md` |

Dokumen ini adalah acuan tampilan untuk tim internal. Semua nilai warna, ukuran, dan perilaku di bawah diambil dari tujuh layar di kanvas Desain UI Estimasi Material Interior.

## 1. Arah desain

Tampilan mengikuti papan kerja estimator: bersih, padat data, dan mudah dipindai. Warna utama adalah grafit dengan amber dari logo Putra Corporation.

**Prinsip:**

- Angka adalah isi utama, jadi semua jumlah memakai font mono.
- Setiap angka menampilkan statusnya: gambar, skala, asumsi, terkalibrasi, atau perkiraan.
- Warna status berbeda terang dan gelapnya, bukan hanya berbeda warna.
- Satu layar punya satu aksi utama berwarna gelap.
- Pengguna tidak bisa melanjutkan sebelum konflik dan konfirmasi dijawab.

## 2. Design tokens

```css
:root {
  /* Dasar */
  --color-ground: #F3F4F1;
  --color-surface: #FFFFFF;
  --color-ink: #1A2023;
  --color-text-muted: #5B666B;
  --color-text-secondary: #3C474C;
  --color-line: #DDE1DD;
  --color-line-soft: #EDEFEC;
  --color-border-input: #AEB8BB;

  /* Sidebar */
  --color-sidebar: #1A2023;
  --color-sidebar-active: #2B3337;
  --color-sidebar-text: #C9D1D3;
  --color-sidebar-subtext: #AEB8BB;
  --color-accent: #F5A800;

  /* Tautan dan pilihan */
  --color-link: #134E8E;
  --color-link-hover: #0D3A6B;
  --color-selected-bg: #E3EEFA;
  --color-selected-border: #134E8E;

  /* Status */
  --color-info-bg: #E3EEFA;
  --color-info-text: #134E8E;
  --color-warn-bg: #FDF0D5;
  --color-warn-text: #6F4300;
  --color-strong-bg: #FBE3CC;
  --color-strong-text: #7A3B00;
  --color-neutral-bg: #ECEFEC;
  --color-neutral-text: #3C474C;

  /* Gambar kerja dan nesting */
  --color-highlight: #C96A00;
  --color-part-fill: #D8E4F2;
  --color-part-border: #134E8E;
  --color-disabled-bg: #DDE1DD;

  /* Font */
  --font-sans: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;

  /* Radius */
  --radius-small: 4px;
  --radius-control: 8px;
  --radius-card: 10px;
  --radius-pill: 999px;

  /* Ukuran */
  --control-height: 44px;
  --sidebar-width: 232px;
}
```

### Tipografi

| Peran | Font | Ukuran | Berat |
| --- | --- | --- | --- |
| Judul halaman | IBM Plex Sans | 28 px | 700 |
| Judul proyek | IBM Plex Sans | 24 px | 700 |
| Judul bagian | IBM Plex Sans | 16 px | 600 |
| Judul kartu | IBM Plex Sans | 15 px | 600 |
| Isi | IBM Plex Sans | 14 px | 400 |
| Teks pendukung | IBM Plex Sans | 13 px | 400 |
| Chip dan kepala tabel | IBM Plex Sans | 12 px | 600 |
| Angka ringkasan | IBM Plex Mono | 24 s.d. 28 px | 600 |
| Angka tabel | IBM Plex Mono | 14 px | 500 s.d. 600 |

Tinggi baris isi adalah 1,45.

### Spasi

| Pemakaian | Nilai |
| --- | --- |
| Celah antarbagian | 20 s.d. 24 px |
| Celah antarkartu | 12 s.d. 16 px |
| Padding kartu | 16 s.d. 20 px |
| Padding sel tabel | 8 s.d. 16 px vertikal, 12 s.d. 20 px horizontal |
| Padding halaman daftar | 32 px atas, 40 px samping, 48 px bawah |
| Padding halaman proyek | 24 px atas, 32 px samping, 40 px bawah |

## 3. Struktur layar

Semua layar memakai sidebar gelap di kiri dan konten di kanan. Layar proyek menambahkan kepala proyek dan tab tahap.

```text
+--------------+------------------------------------------+
| Logo + nama  | Kepala halaman                  Aksi     |
|              +------------------------------------------+
| Proyek       | Lembar Kerja | Hasil | Pola Potong | Real|
| Pustaka      +------------------------------------------+
| Aturan       | Konten utama          | Panel samping    |
+--------------+------------------------------------------+
```

- Lebar dasar sidebar 232 px.
- Konten memakai `flex: 999 1 560px` agar sidebar turun ke atas saat layar sempit.
- Tabel lebar berada di kotak `overflow-x: auto`.
- Grid ringkasan memakai `repeat(auto-fit, minmax(150px, 1fr))` atau 200 px.

## 4. Komponen

| Komponen | Spesifikasi |
| --- | --- |
| Tombol utama | Tinggi 44 px, latar ink, teks putih, berat 600, radius 8 px |
| Tombol sekunder | Tinggi 44 px, latar putih, garis `--color-border-input`, teks ink |
| Tombol nonaktif | Latar `--color-disabled-bg`, teks `--color-text-secondary`, kursor not-allowed |
| Tab kategori | Tombol 44 px. Aktif berlatar ink, tidak aktif berlatar putih |
| Tab tahap proyek | Tautan dengan garis bawah 2 px saat aktif |
| Kartu | Latar putih, garis 1 px `--color-line`, radius 10 px |
| Kartu ringkasan | Angka mono di atas, label 13 px di bawah |
| Tabel | Kepala 12 px muted, baris dipisah garis `--color-line-soft` |
| Chip status | Bentuk pill, padding 2 x 8 px, 12 px, berat 600 |
| Input | Tinggi 44 px, garis `--color-border-input`, radius 8 px, label di atas |
| Pilihan konflik | Tombol penuh satu baris. Terpilih bergaris 2 px biru dan berlatar biru muda |
| Checkbox konfirmasi | 20 x 20 px, warna aksen biru, judul dan keterangan di sampingnya |
| Zona upload | Garis putus 1,5 px, radius 10 px |
| Sorotan gambar | Garis 2 px `--color-highlight` di atas gambar kerja |
| Part nesting | Latar `--color-part-fill`, garis 1 px biru, label jika part cukup besar |

### Status

| Status | Latar | Teks | Dipakai di |
| --- | --- | --- | --- |
| Gambar | `#E3EEFA` | `#134E8E` | Hasil baca |
| Skala | `#ECEFEC` | `#3C474C` | Hasil baca |
| Asumsi | `#FDF0D5` | `#6F4300` | Hasil baca |
| Terkalibrasi | `#E3EEFA` | `#134E8E` | Hasil, aturan |
| Perkiraan | `#FDF0D5` | `#6F4300` | Hasil, aturan |
| Perlu konfirmasi | `#FBE3CC` | `#7A3B00` | Aturan |
| Cocok | `#E3EEFA` | `#134E8E` | Data real |
| Kurang | `#FDF0D5` | `#6F4300` | Data real |
| Lebih | `#ECEFEC` | `#3C474C` | Data real |
| Baru | `#FBE3CC` | `#7A3B00` | Data real |
| Selesai | `#E3EEFA` | `#134E8E` | Daftar proyek |
| Kalibrasi | `#FDF0D5` | `#6F4300` | Daftar proyek |

## 5. Layar

| No | Layar | File kanvas | Kebutuhan PRD |
| --- | --- | --- | --- |
| 1 | Daftar Proyek | `Main.dc.html` | FR-01, FR-32 |
| 2 | Proyek Baru | `ProyekBaru.dc.html` | FR-01 s.d. FR-03 |
| 3 | Review Lembar Kerja | `Review.dc.html` | FR-10 s.d. FR-14, FR-20 |
| 4 | Hasil Estimasi | `Hasil.dc.html` | FR-23, FR-24, FR-30 s.d. FR-33 |
| 5 | Pola Potong | `PolaPotong.dc.html` | FR-21, FR-22, FR-25 |
| 6 | Data Real | `DataReal.dc.html` | FR-40 s.d. FR-44 |
| 7 | Pustaka Aturan | `Aturan.dc.html` | FR-50, FR-51 |

### 5.1 Daftar Proyek

- **Isi:** empat kartu ringkasan dan tabel proyek.
- **Kolom:** klien, pekerjaan, tanggal gambar, papan, HPL, konfirmasi, status.
- **Aksi utama:** Proyek baru.
- **Interaksi:** klik nama klien membuka Hasil.

### 5.2 Proyek Baru

- **Kiri:** kartu file PDF, progres pembacaan, dan kartu tiap halaman.
- **Kanan:** data proyek yang terisi dari title block dan bisa diubah.
- **Aksi utama:** Lanjut review.
- **State yang perlu dibuat:** kosong, mengunggah, membaca, selesai, gagal.

### 5.3 Review Lembar Kerja

- **Kiri:** gambar kerja dengan sorotan pada lokasi konflik.
- **Kanan:** tab Konflik, Spek, Unit, dan Ukuran.
- **Konflik:** tiap konflik menampilkan pilihan jawaban.
- **Aksi utama:** Hitung material, hanya muncul setelah semua konflik dijawab.
- **State terkunci:** tampilkan teks seperti `2 konflik belum dijawab`.
- **Interaksi PRD:** klik nilai membuka lokasinya di PDF.

### 5.4 Hasil Estimasi

- **Atas:** lima kartu ringkasan: papan, HPL, engsel, rel, sekrup.
- **Kiri:** tab Papan dan HPL, Hardware, Sekrup dan bantu, Listrik, Finishing.
- **Kolom tabel:** item, dipakai untuk, jumlah, status.
- **Kanan:** daftar konfirmasi sebelum belanja.
- **Aksi:** Ekspor PDF dan Setujui estimasi.
- **Aturan:** Setujui estimasi nonaktif sampai semua konfirmasi selesai.

### 5.5 Pola Potong

- **Kiri atas:** peta lembar dengan rasio 2 : 1 dan posisi part dalam persen.
- **Kiri bawah:** grafik isi tiap lembar. Lembar di bawah 20% memakai warna `--color-highlight`.
- **Kanan:** daftar bahan dan uji perubahan.
- **Aksi:** Ekspor pola potong.
- **Catatan:** isi peta di kanvas memakai hasil nesting awal PVC 18 sebagai contoh.

### 5.6 Data Real

- **Kiri:** kotak tempel teks dengan font mono dan tombol Bandingkan.
- **Kanan:** tabel selisih: item, estimasi, real, status, alasan.
- **Bawah:** kartu usulan aturan dengan tombol Setujui dan Tolak.
- **Aturan:** usulan aktif hanya setelah disetujui admin.

### 5.7 Pustaka Aturan

- **Tab:** Bahan, Hardware, Sekrup, Parameter.
- **Kolom:** aturan, isi, sumber, keyakinan.
- **Aksi utama:** Tambah aturan.

## 6. Responsif

| Lebar | Perilaku |
| --- | --- |
| Desktop 1280 px ke atas | Sidebar dan konten berdampingan |
| Tablet | Panel samping turun ke bawah konten utama |
| Ponsel | Sidebar berada di atas, tabel bergulir di dalam kotaknya |

Review dan Pola Potong dioptimalkan untuk desktop. Hasil Estimasi harus tetap terbaca di ponsel untuk purchasing.

## 7. Aksesibilitas

- Target sentuh minimal 44 px.
- Kontras teks minimal 4,5 : 1.
- Gunakan elemen asli: `button`, `a`, `input`, `select`, `label`, dan `table`.
- Tab memakai `role="tab"` dan `aria-selected`.
- Pilihan konflik memakai `aria-pressed`.
- Gambar kerja wajib punya `alt`, dan peta nesting memakai `role="img"` dengan `aria-label`.
- Warna status selalu disertai teks.

## 8. Aturan teks

- Bahasa Indonesia, singkat, dan langsung.
- Satuan ditulis konsisten: mm, cm, lembar, psg, pcs, mtr.
- Angka memakai format Indonesia: `1.320` dan `6,05`.
- Tulis nama bahan sesuai katalog: `Multi min 18`, `Multi double 18`, `BB 18 min`.
- Jangan tampilkan angka tanpa status.
- Teks tombol memakai kata kerja: Hitung material, Setujui estimasi, Ekspor PDF.

## 9. Belum didesain

- State kosong, loading, dan error di semua layar.
- Login dan pengelolaan pengguna.
- Katalog material dan pengaturan brand.
- Editor daftar potongan per baris.
- Riwayat revisi estimasi.
