"""Rumus sekrup — PRD §6.4. Semua berstatus PERKIRAAN (dikalibrasi dari satu proyek).

ASUMSI yang belum dikonfirmasi (PLAN P3): hasil pecahan dibulatkan ke bawah.
Dasarnya hanya 771 x 1,3 = 1002,3 -> 1.002 (PRD §6.4). Ubah lewat argumen `pembulatan`.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP, ROUND_UP

from .status import Hasil, Status

PEMBULATAN = {"bawah": ROUND_DOWN, "atas": ROUND_UP, "terdekat": ROUND_HALF_UP}
FAKTOR_ENGSEL = 4
FAKTOR_REL = 14
FAKTOR_METER_GANTUNG = 3
FAKTOR_GP = Decimal("1.3")


def _bulat(nilai: Decimal, pembulatan: str) -> int:
    return int(nilai.to_integral_value(rounding=PEMBULATAN[pembulatan]))


def sekrup_5_8(jumlah_engsel: int, pasang_rel: int) -> Hasil:
    jumlah = jumlah_engsel * FAKTOR_ENGSEL + pasang_rel * FAKTOR_REL
    rumus = (
        f"jumlah engsel ({jumlah_engsel}) x {FAKTOR_ENGSEL} + "
        f"pasang rel ({pasang_rel}) x {FAKTOR_REL} = {jumlah}"
    )
    return Hasil(jumlah, "pcs", Status.PERKIRAAN, rumus)


def sekrup_7_fisher(meter_kabinet_gantung: int | Decimal, pembulatan: str = "bawah") -> Hasil:
    m = Decimal(str(meter_kabinet_gantung))
    mentah = m * FAKTOR_METER_GANTUNG
    jumlah = _bulat(mentah, pembulatan)
    rumus = f"meter kabinet gantung ({m}) x {FAKTOR_METER_GANTUNG} = {mentah}"
    if mentah != jumlah:
        rumus += f", dibulatkan {pembulatan} menjadi {jumlah} (asumsi)"
    return Hasil(jumlah, "pcs", Status.PERKIRAAN, rumus)


@dataclass(frozen=True)
class HasilGP:
    total: int
    gp3: int
    gp5: int
    status: Status
    rumus: str
    satuan: str = "pcs"


def gp(titik_sambungan: int, pembulatan: str = "bawah") -> HasilGP:
    mentah = Decimal(titik_sambungan) * FAKTOR_GP
    total = _bulat(mentah, pembulatan)
    gp5 = total // 2           # dibagi 1 : 1; sisa ganjil masuk GP 3 (asumsi, PLAN P3)
    gp3 = total - gp5
    rumus = f"titik sambungan ({titik_sambungan}) x {FAKTOR_GP} = {mentah}"
    if mentah != total:
        rumus += f", dibulatkan {pembulatan} menjadi {total} (asumsi)"
    rumus += f"; dibagi 1 : 1 -> GP 3 = {gp3}, GP 5 = {gp5}"
    return HasilGP(total, gp3, gp5, Status.PERKIRAAN, rumus)
