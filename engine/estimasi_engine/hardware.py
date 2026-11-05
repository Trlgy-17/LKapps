"""Aturan hardware — PRD §6.3.

Status semua PERKIRAAN: PRD baru punya dua proyek dan belum menandai satu pun aturan
sebagai terkalibrasi. Admin menaikkan status lewat RuleSet nanti.
Aturan yang di PRD bertanda "perlu konfirmasi" membawa perlu_konfirmasi=True.
"""
from __future__ import annotations

from dataclasses import dataclass

from .status import Hasil, Status

JENIS_PINTU = ("lurus", "inset_lemari", "sink", "gas", "rak_piring")
JENIS_TARIK = ("kabinet", "laci_lemari", "laci_atas_kabinet_bawah")


@dataclass(frozen=True)
class Pintu:
    unit_id: str
    jenis: str

    def __post_init__(self):
        if self.jenis not in JENIS_PINTU:
            raise ValueError(f"jenis pintu tidak dikenal: {self.jenis}")


@dataclass(frozen=True)
class UnitTarik:
    unit_id: str
    jenis: str

    def __post_init__(self):
        if self.jenis not in JENIS_TARIK:
            raise ValueError(f"jenis unit tarik tidak dikenal: {self.jenis}")


def _h(jumlah, satuan, rumus, konfirmasi=False) -> Hasil:
    return Hasil(jumlah, satuan, Status.PERKIRAAN, rumus, konfirmasi)


def engsel(pintu: list[Pintu]) -> dict[str, Hasil]:
    inset = sum(1 for p in pintu if p.jenis == "inset_lemari")
    biasa = len(pintu) - inset
    return {
        "engsel": _h(biasa, "psg", f"1 psg x {biasa} pintu bukan inset lemari"),
        "engsel_full_tekuk": _h(inset, "psg", f"1 psg x {inset} pintu inset lemari", konfirmasi=True),
    }


def engsel_robot(jumlah_sudut: int) -> Hasil:
    return _h(jumlah_sudut, "psg", f"1 psg x {jumlah_sudut} sudut")


def rel(unit_tarik: list[UnitTarik]) -> dict[str, Hasil]:
    r45 = sum(1 for u in unit_tarik if u.jenis == "laci_lemari")
    r50 = len(unit_tarik) - r45
    return {
        # Ukuran rel: Septi kabinet 50 / laci lemari 45; Aulia berbeda (PLAN P9)
        "Rel 50": _h(r50, "psg", f"1 psg x {r50} unit tarik kabinet", konfirmasi=True),
        "Rel 45": _h(r45, "psg", f"1 psg x {r45} laci lemari", konfirmasi=True),
    }


def hidrolik(pintu: list[Pintu]) -> Hasil:
    n = sum(1 for p in pintu if p.jenis == "rak_piring")
    return _h(n, "psg", f"1 psg x {n} pintu rak piring", konfirmasi=True)


def ventilasi(pintu: list[Pintu]) -> Hasil:
    n = sum(1 for p in pintu if p.jenis in ("sink", "gas"))
    return _h(n, "psg", f"1 psg x {n} pintu sink dan gas")


def rak_sendok(unit_tarik: list[UnitTarik]) -> Hasil:
    n = sum(1 for u in unit_tarik if u.jenis == "laci_atas_kabinet_bawah")
    return _h(n, "pcs", f"{n} laci atas kabinet bawah")
