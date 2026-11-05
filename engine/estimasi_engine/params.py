"""Parameter dasar — PRD §6.1. Semua bisa diubah lewat RuleSet."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Parameter:
    lembar_lebar: Decimal = Decimal(1200)       # mm, sumbu x
    lembar_panjang: Decimal = Decimal(2400)     # mm, sumbu y
    kerf: Decimal = Decimal("3.2")              # tebal potong; aktual belum diukur (PLAN P7)
    trim: Decimal = Decimal(0)                  # per sisi; uji perubahan memakai 10
    kelebihan_hpl: Decimal = Decimal(10)        # ditambah pada panjang dan lebar (tafsiran, PLAN P7)


# Ukuran lembar khusus per material (PRD §6.1)
UKURAN_LEMBAR_KHUSUS = {
    "AICA Cerarl": (Decimal(935), Decimal(2455)),   # tebal 3 mm; XKAF 14165 ZMN
}
