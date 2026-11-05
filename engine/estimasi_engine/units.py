"""Format angka Indonesia (DESIGN §8): titik ribuan, koma desimal."""
from __future__ import annotations

from decimal import Decimal


def format_angka(nilai: int | Decimal | str, desimal: int | None = None) -> str:
    d = Decimal(str(nilai))
    if desimal is not None:
        d = d.quantize(Decimal(1).scaleb(-desimal))
    teks = format(d, "f")
    bulat, _, pecahan = teks.partition(".")
    negatif = bulat.startswith("-")
    bulat = bulat.lstrip("-")
    bulat = f"{int(bulat):,}".replace(",", ".")
    hasil = ("-" if negatif else "") + bulat
    return f"{hasil},{pecahan}" if pecahan else hasil
