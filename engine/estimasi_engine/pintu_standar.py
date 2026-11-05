"""Ukuran pintu kitchen set standar (asumsi) — catatan pengguna.

Dipakai HANYA bila lembar kerja tidak mencantumkan ukuran pintu. Ukuran gambar selalu menang.
Jumlah pintu mengikuti lembar kerja; yang diasumsikan hanya ukurannya.
Asumsi: lebar pintu 40–60 cm, tinggi standar 70–80 cm (bawaan 70 cm).
  - Kabinet bawah: 60 x 70 cm
  - Kabinet atas : 40 x 70 cm
Bahan: material 18 mm, serat tetap. Part bertanda status_ukuran="asumsi".

Jumlah pintu per lembar DIHITUNG oleh nesting, tidak ditulis tangan. Dua angka dilaporkan:
  - teoritis : lembar nominal 240 x 120 cm, tanpa tebal potong, tanpa trim (cara hitung cepat workshop)
  - realistis: parameter RuleSet (lembar 1200 x 2400, tebal potong, trim)
Referensi pengguna: bawah 6 teoritis, atas 8 teoritis. Mesin memberi atas 9; selisih dicatat di PLAN.
"""
from __future__ import annotations

from decimal import Decimal

from .nesting import Part, nest
from .params import Parameter
from .status import Hasil, Status

TINGGI_PINTU_MM = 700            # bawaan
TINGGI_MIN_MM = 700              # tinggi standar 70–80 cm
TINGGI_MAX_MM = 800
LEBAR_PINTU_MIN_MM = 400
LEBAR_PINTU_MAX_MM = 600
LEBAR_BAWAH_MM = 600
LEBAR_ATAS_MM = 400
JENIS = ("bawah", "atas")
BAHAN_PINTU_BAWAAN = "Material 18 mm"   # nama katalog belum dipetakan (lihat PLAN)
PARAM_TEORITIS = Parameter(
    lembar_lebar=Decimal(1200), lembar_panjang=Decimal(2400), kerf=Decimal(0), trim=Decimal(0)
)


def _lebar(jenis: str, lebar_mm: int | None) -> int:
    if jenis not in JENIS:
        raise ValueError(f"jenis pintu tidak dikenal: {jenis}")
    w = lebar_mm if lebar_mm is not None else (LEBAR_BAWAH_MM if jenis == "bawah" else LEBAR_ATAS_MM)
    if not LEBAR_PINTU_MIN_MM <= w <= LEBAR_PINTU_MAX_MM:
        raise ValueError(f"lebar pintu asumsi harus {LEBAR_PINTU_MIN_MM}–{LEBAR_PINTU_MAX_MM} mm, bukan {w}")
    return w


def _tinggi(tinggi_mm: int | None) -> int:
    t = tinggi_mm if tinggi_mm is not None else TINGGI_PINTU_MM
    if not TINGGI_MIN_MM <= t <= TINGGI_MAX_MM:
        raise ValueError(f"tinggi pintu asumsi harus {TINGGI_MIN_MM}–{TINGGI_MAX_MM} mm, bukan {t}")
    return t


def part_pintu_asumsi(
    jenis: str,
    jumlah: int,
    bahan: str = BAHAN_PINTU_BAWAAN,
    serat: str = "tetap",
    lebar_mm: int | None = None,
    tinggi_mm: int | None = None,
) -> list[Part]:
    """Part pintu berukuran asumsi. Panjang = tinggi pintu (sejajar sisi panjang lembar)."""
    if jumlah < 0:
        raise ValueError("jumlah pintu tidak boleh negatif")
    w = _lebar(jenis, lebar_mm)
    t = _tinggi(tinggi_mm)
    return [
        Part(f"pintu_{jenis}_{i}", bahan, t, w, serat, status_ukuran="asumsi")
        for i in range(1, jumlah + 1)
    ]


def kapasitas_per_lembar(
    jenis: str,
    param: Parameter | None = None,
    serat: str = "tetap",
    lebar_mm: int | None = None,
    tinggi_mm: int | None = None,
) -> Hasil:
    """Jumlah pintu yang muat di satu lembar, dari nesting nyata. Tanpa param = hitungan teoritis."""
    param = param or PARAM_TEORITIS
    w = _lebar(jenis, lebar_mm)
    t = _tinggi(tinggi_mm)
    luas_lembar = param.lembar_lebar * param.lembar_panjang
    n = int(luas_lembar / (Decimal(w) * t)) + 2   # cukup banyak agar sampai lembar kedua
    parts = part_pintu_asumsi(jenis, n, "uji", serat, lebar_mm, tinggi_mm)
    r = nest(parts, lembar=(param.lembar_lebar, param.lembar_panjang), kerf=param.kerf, trim=param.trim)
    jumlah = len(r.lembar[0].penempatan)
    rumus = (
        f"pintu {jenis} {w // 10} x {t // 10} cm (asumsi), lembar "
        f"{param.lembar_lebar} x {param.lembar_panjang} mm, tebal potong {param.kerf} mm, trim {param.trim} mm, "
        f"serat {serat}: {jumlah} pintu per lembar"
    )
    return Hasil(jumlah, "pintu/lembar", Status.ASUMSI, rumus)


# --- Logika bahan pintu kitchen set dari pengguna -------------------------------------------------
# Kapasitas per lembar mengikuti UKURAN LEMBAR (2,40 x 1,20 m = 2400 x 1200 mm), bukan angka tetap:
#   teoritis  = jumlah pintu yang muat di satu lembar (nesting tanpa tebal potong dan trim)
#   realistis = antara (teoritis - 1) dan teoritis, mengikuti pola catatan pengguna (6 -> 5–6, 8 -> 7–8)
# Jumlah lembar utama memakai batas realistis terendah (aman untuk belanja); minimum teoritis dilaporkan.
SUMBER_PINTU_SOP = (
    "SOP pengguna: pintu kitchen set standar lebar 40–60 cm, tinggi 70 cm; lembar 2,40 x 1,20 m; "
    "kapasitas per lembar dihitung dari ukuran lembar; realistis = teoritis dikurangi 1 sampai teoritis."
)


def lembar_pintu_sop(jenis: str, jumlah: int, tinggi_mm: int | None = None) -> Hasil | None:
    """Lembar bahan untuk pintu berukuran asumsi. 0 pintu -> None (bukan nol palsu)."""
    if jenis not in JENIS:
        raise ValueError(f"jenis pintu tidak dikenal: {jenis}")
    if jumlah < 0:
        raise ValueError("jumlah pintu tidak boleh negatif")
    if jumlah == 0:
        return None
    teoritis = kapasitas_per_lembar(jenis, None, "tetap", tinggi_mm=tinggi_mm).jumlah   # PARAM_TEORITIS: 1200 x 2400, kerf 0
    realistis_min = max(1, teoritis - 1)
    w = _lebar(jenis, None)
    t = _tinggi(tinggi_mm)
    minimum = -(-jumlah // teoritis)
    aman = -(-jumlah // realistis_min)
    rumus = (
        f"{jumlah} pintu {jenis} {w // 10} x {t // 10} cm (asumsi); lembar {PARAM_TEORITIS.lembar_panjang} x "
        f"{PARAM_TEORITIS.lembar_lebar} mm memuat teoritis {teoritis}, realistis {realistis_min}–{teoritis} pintu; "
        f"minimum teoritis {minimum} lembar, dipakai {aman} lembar (kapasitas {realistis_min} per lembar)"
    )
    return Hasil(aman, "lembar", Status.ASUMSI, rumus, perlu_konfirmasi=True, sumber=SUMBER_PINTU_SOP, asal_override="catalog_stated")
