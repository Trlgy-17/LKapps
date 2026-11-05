"""Rekonsiliasi estimasi vs data real (SYSTEM_PROMPT §16; FR-42).

selisih = real - estimasi (positif = real lebih besar; belum membuktikan pemborosan).
selisih_persen = selisih / estimasi x 100, hanya bila estimasi > 0, selain itu None (bukan 0, bukan tak hingga).
Status tampilan: cocok, kurang (estimasi < real), lebih (estimasi > real), baru (ada di real, tidak di estimasi).

Keterbandingan basis:
  ya          : real berbasis kebutuhan_disahkan / pemakaian_bersih (setara kebutuhan estimasi)
  tidak       : pembelian / keluar_gudang / retur -> selisih utama None; hanya selisih_aritmetis (belum setara basis)
  belum_jelas : real_belum_dijelaskan -> selisih ditampilkan sebagai indikatif sampai basis dijelaskan
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

SETARA = {"kebutuhan_disahkan", "pemakaian_bersih"}
TIDAK_SETARA = {"pembelian", "keluar_gudang", "retur"}


@dataclass(frozen=True)
class Selisih:
    item: str
    estimasi: Decimal | int | None
    real: Decimal | int
    status: str
    selisih: Decimal | int | None
    selisih_persen: Decimal | None
    comparable: str
    selisih_aritmetis: Decimal | int | None = None


def keterbandingan(basis_real: str) -> str:
    if basis_real in SETARA:
        return "ya"
    if basis_real in TIDAK_SETARA:
        return "tidak"
    return "belum_jelas"


def bandingkan(estimasi: dict, real: dict, basis_real: str = "real_belum_dijelaskan") -> list[Selisih]:
    comparable = keterbandingan(basis_real)
    hasil = []
    for item in sorted(real):
        r = real[item]
        if item not in estimasi or estimasi[item] is None:
            status, e, aritm = "baru", None, None
        else:
            e = estimasi[item]
            status = "cocok" if e == r else ("kurang" if e < r else "lebih")
            aritm = r - e
        utama = None if comparable == "tidak" else aritm
        persen = None
        if utama is not None and e is not None and e > 0:
            persen = Decimal(utama) / Decimal(e) * 100
        hasil.append(Selisih(item, e, r, status, utama, persen, comparable, aritm))
    return hasil


def dalam_target(estimasi_total: int, real_total: int) -> bool:
    """PRD §11: selisih maksimal 1 lembar per 10 lembar real."""
    return abs(estimasi_total - real_total) * 10 <= real_total
