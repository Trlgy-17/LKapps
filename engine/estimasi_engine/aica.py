"""AICA (top table): hitungan mengikuti ukuran keseluruhan kabinet bawah (catatan pengguna).

Luas top = panjang keseluruhan kabinet bawah x kedalaman top. Lembar AICA = batas minimum luas
(ceil(luas / luas lembar), SYSTEM_PROMPT §10), BUKAN susunan potongan. Ukuran lembar AICA
935 x 2455 x 3 mm (PRD §6.1). Bila panjang melebihi sisi panjang lembar, top perlu disambung:
jumlah sambungan dilaporkan, tidak disembunyikan, dan hasil ditandai perlu konfirmasi.

Bentuk bersudut (mis. denah L) belum punya definisi lintasan; hasil memakai panjang x kedalaman
yang diberikan dan selalu ditandai perlu konfirmasi.
"""
from __future__ import annotations

from decimal import Decimal
from math import ceil

from .luas import batas_minimum_luas, luas_panel_m2
from .params import UKURAN_LEMBAR_KHUSUS
from .status import Hasil, Status

PANJANG_LEMBAR_MM = UKURAN_LEMBAR_KHUSUS["AICA Cerarl"][1]   # 2455
LEBAR_LEMBAR_MM = UKURAN_LEMBAR_KHUSUS["AICA Cerarl"][0]     # 935


def hitung_aica(panjang_mm, kedalaman_mm) -> Hasil:
    p, k = Decimal(str(panjang_mm)), Decimal(str(kedalaman_mm))
    luas = luas_panel_m2(p, k, 1)
    n = batas_minimum_luas(luas, PANJANG_LEMBAR_MM, LEBAR_LEMBAR_MM)
    n = max(n, 1)
    rumus = (
        f"top {p} x {k} mm = {format(float(luas), '.3f')} m2; lembar AICA "
        f"{LEBAR_LEMBAR_MM} x {PANJANG_LEMBAR_MM} mm; batas minimum luas = {n} lembar"
    )
    # panel harus muat pada lembar: sisi panjang <= 2455 dan sisi lain <= 935 (boleh diputar)
    panjang_maks, pendek_maks = max(p, k), min(p, k)
    sambungan = 0
    if panjang_maks > PANJANG_LEMBAR_MM or pendek_maks > LEBAR_LEMBAR_MM:
        sisi = panjang_maks if panjang_maks > PANJANG_LEMBAR_MM else None
        if sisi is not None:
            sambungan = ceil(sisi / PANJANG_LEMBAR_MM) - 1
        rumus += f"; ukuran melebihi satu lembar: top perlu {sambungan} sambungan"
    # Kuantitas dibulatkan ke atas pada total (belum divalidasi susunan potongan)
    return Hasil(n, "lembar", Status.ASUMSI, rumus, perlu_konfirmasi=True)
