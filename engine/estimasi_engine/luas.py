"""Luas, batas minimum, waste, kekurangan, kemasan, dan luas HPL (SYSTEM_PROMPT §10–§12).

Semua aritmetika memakai Fraction (eksak) agar tidak ada selisih kumulatif; pembulatan hanya di akhir.
"""
from __future__ import annotations

from fractions import Fraction
from math import ceil


def _f(x) -> Fraction:
    return Fraction(str(x)) if not isinstance(x, Fraction) else x


def luas_panel_m2(panjang_mm, lebar_mm, jumlah=1) -> Fraction:
    p, l, n = _f(panjang_mm), _f(lebar_mm), _f(jumlah)
    if p <= 0 or l <= 0 or n < 0:
        raise ValueError("dimensi harus positif dan jumlah tidak negatif")
    return p * l * n / 1_000_000


def batas_minimum_luas(total_luas_m2, panjang_lembar_mm, lebar_lembar_mm) -> int:
    """N_min_luas = ceil(total_luas / A_lembar). BUKAN kebutuhan final: tidak membuktikan susunan muat."""
    a = _f(panjang_lembar_mm) * _f(lebar_lembar_mm) / 1_000_000
    if a <= 0:
        raise ValueError("ukuran lembar harus positif")
    return ceil(_f(total_luas_m2) / a)


def luas_kotor(bersih_m2, *, w=None, r=None) -> Fraction:
    """Waste sebagai bagian bahan kotor (w): bersih / (1 - w). Tambahan relatif (r): bersih x (1 + r).

    Tepat satu dari w atau r. Keduanya TIDAK sama; tidak ada nilai bawaan.
    """
    if (w is None) == (r is None):
        raise ValueError("isi tepat satu: w (bagian bahan kotor) atau r (tambahan relatif)")
    b = _f(bersih_m2)
    if w is not None:
        w = _f(w)
        if not 0 <= w < 1:
            raise ValueError("w harus 0 <= w < 1")
        return b / (1 - w)
    r = _f(r)
    if r < 0:
        raise ValueError("r harus >= 0")
    return b * (1 + r)


def kekurangan(kebutuhan_final, cadangan_disahkan, stok_tersedia_kompatibel) -> Fraction:
    """max(0, kebutuhan + cadangan - stok). Stok harus diketahui; None -> ValueError (bukan nol)."""
    if stok_tersedia_kompatibel is None or kebutuhan_final is None:
        raise ValueError("stok dan kebutuhan harus diketahui; stok tidak diketahui bukan stok nol")
    return max(Fraction(0), _f(kebutuhan_final) + _f(cadangan_disahkan or 0) - _f(stok_tersedia_kompatibel))


def jumlah_kemasan(kekurangan_qty, isi_per_kemasan) -> int:
    isi = _f(isi_per_kemasan)
    if isi <= 0:
        raise ValueError("isi per kemasan harus positif")
    return ceil(_f(kekurangan_qty) / isi)


def luas_muka_hpl_m2(panjang_mm, lebar_mm, jumlah_panel, jumlah_muka_hpl) -> Fraction:
    """Hanya muka yang DITETAPKAN menerima HPL; bukan jumlah papan."""
    return luas_panel_m2(panjang_mm, lebar_mm, jumlah_panel) * _f(jumlah_muka_hpl)


def luas_tepi_hpl_m2(total_panjang_tepi_mm, lebar_strip_potong_mm) -> Fraction:
    """Lebar strip mengikuti metode kerja yang ditetapkan (termasuk allowance), bukan otomatis tebal papan."""
    return _f(total_panjang_tepi_mm) * _f(lebar_strip_potong_mm) / 1_000_000
