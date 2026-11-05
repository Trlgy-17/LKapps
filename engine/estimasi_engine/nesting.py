"""Nesting guillotine (potong lurus tembus) — PRD §6.1, FR-22.

Deterministik: part diurutkan (luas turun, id), pemilihan posisi memakai
tie-break tetap, tanpa random. Urutan input tidak memengaruhi hasil.

Sumbu: x sepanjang lebar lembar (1200), y sepanjang panjang lembar (2400).
Part tidak diputar: lebar sejajar x, panjang sejajar y. Serat "bebas" boleh diputar.
"""
from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal
from typing import Iterable, Sequence

from .params import Parameter


class PartTidakMuat(ValueError):
    """Part lebih besar dari area pakai lembar (setelah trim)."""


@dataclass(frozen=True)
class Part:
    id: str
    bahan: str
    panjang: int | Decimal
    lebar: int | Decimal
    serat: str = "bebas"  # "tetap" | "bebas"
    status_ukuran: str = "gambar"  # gambar | skala | asumsi (PRD §6.5)

    def __post_init__(self):
        if self.serat not in ("tetap", "bebas"):
            raise ValueError(f"serat tidak dikenal: {self.serat}")
        if Decimal(self.panjang) <= 0 or Decimal(self.lebar) <= 0:
            raise ValueError(f"ukuran part {self.id} harus positif")


@dataclass(frozen=True)
class Penempatan:
    part_id: str
    x: Decimal
    y: Decimal
    w: Decimal
    h: Decimal
    diputar: bool


@dataclass(frozen=True)
class Lembar:
    nomor: int
    lebar: Decimal
    panjang: Decimal
    penempatan: tuple[Penempatan, ...]

    @property
    def isi_persen(self) -> Decimal:
        terpakai = sum((p.w * p.h for p in self.penempatan), Decimal(0))
        return (terpakai * 100 / (self.lebar * self.panjang)).quantize(Decimal("0.01"))


@dataclass(frozen=True)
class HasilNesting:
    lembar: tuple[Lembar, ...]
    tidak_muat: tuple[str, ...] = ()   # id part yang lebih besar dari area pakai (hanya bila tandai_tidak_muat)

    @property
    def jumlah_lembar(self) -> int:
        return len(self.lembar)


def perbesar_hpl(part: Part, kelebihan: int | Decimal = 10) -> Part:
    """HPL +10 mm pada panjang dan lebar untuk trim setelah lapis (PRD §6.1)."""
    k = Decimal(kelebihan)
    return replace(part, panjang=Decimal(part.panjang) + k, lebar=Decimal(part.lebar) + k)


def _dec(v) -> Decimal:
    return v if isinstance(v, Decimal) else Decimal(str(v))


def nest(
    parts: Sequence[Part],
    lembar: tuple = (1200, 2400),
    kerf="3.2",
    trim=0,
    tandai_tidak_muat: bool = False,
) -> HasilNesting:
    """Jalankan penempatan dengan dua strategi orientasi (part serat bebas) dan ambil yang
    memakai lembar paling sedikit. Tie -> strategi pertama. Tetap deterministik."""
    a = _nest(parts, lembar, kerf, trim, False, tandai_tidak_muat)
    if all(p.serat == "tetap" or _dec(p.lebar) == _dec(p.panjang) for p in parts):
        return a
    b = _nest(parts, lembar, kerf, trim, True, tandai_tidak_muat)
    def nilai(h: HasilNesting):
        # lebih sedikit lembar lebih baik; bila sama, lembar terakhir yang lebih kosong (sisa lebih terkumpul)
        return (h.jumlah_lembar, h.lembar[-1].isi_persen if h.lembar else Decimal(0))

    return b if nilai(b) < nilai(a) else a


def _nest(parts, lembar, kerf, trim, prefer_rotasi: bool, tandai_tidak_muat: bool = False) -> HasilNesting:
    kerf = _dec(kerf)
    trim = _dec(trim)
    lebar_l, panjang_l = _dec(lembar[0]), _dec(lembar[1])
    area_w = lebar_l - 2 * trim
    area_h = panjang_l - 2 * trim

    ids = [p.id for p in parts]
    if len(set(ids)) != len(ids):
        raise ValueError("id part harus unik")

    tidak_muat: list[str] = []
    urut = sorted(parts, key=lambda p: (-(_dec(p.lebar) * _dec(p.panjang)), p.id))

    # sheets[i] = (daftar free rect (x,y,w,h), daftar penempatan)
    sheets: list[tuple[list[tuple[Decimal, Decimal, Decimal, Decimal]], list[Penempatan]]] = []

    def orientasi(p: Part):
        w, h = _dec(p.lebar), _dec(p.panjang)
        opsi = [(w, h, False)]
        if p.serat == "bebas" and w != h:
            opsi.append((h, w, True))
        return opsi

    for p in urut:
        opsi = orientasi(p)
        if not any(w <= area_w and h <= area_h for w, h, _ in opsi):
            if tandai_tidak_muat:
                tidak_muat.append(p.id)   # tidak diperkecil dan tidak disambung diam-diam
                continue
            raise PartTidakMuat(
                f"part {p.id} ({p.panjang} x {p.lebar}) tidak muat di area pakai {area_h} x {area_w}"
            )
        terbaik = None  # (sisa_luas, idx_lembar, idx_rect, idx_orientasi)
        for si, (frees, _) in enumerate(sheets):
            for ri, (fx, fy, fw, fh) in enumerate(frees):
                for oi, (w, h, _) in enumerate(opsi):
                    if w <= fw and h <= fh:
                        kunci = (fw * fh - w * h, si, ri, -oi if prefer_rotasi else oi)
                        if terbaik is None or kunci < terbaik[0]:
                            terbaik = (kunci, oi)
        if terbaik is None:
            sheets.append(([(trim, trim, area_w, area_h)], []))
            si = len(sheets) - 1
            ri = 0
            oi = next(
                i for i, (w, h, _) in sorted(
                    enumerate(opsi), key=lambda t: -t[0] if prefer_rotasi else t[0]
                ) if w <= area_w and h <= area_h
            )
        else:
            (_, si, ri, _), oi = terbaik
        frees, pens = sheets[si]
        fx, fy, fw, fh = frees.pop(ri)
        w, h, diputar = opsi[oi]
        pens.append(Penempatan(p.id, fx, fy, w, h, diputar))
        # Dua pilihan potongan tembus; pilih yang menyisakan persegi panjang terbesar.
        a_kanan = (fx + w + kerf, fy, fw - w - kerf, fh)
        a_bawah = (fx, fy + h + kerf, w, fh - h - kerf)
        b_kanan = (fx + w + kerf, fy, fw - w - kerf, h)
        b_bawah = (fx, fy + h + kerf, fw, fh - h - kerf)

        def terbesar(*rs):
            return max((r[2] * r[3] for r in rs if r[2] > 0 and r[3] > 0), default=Decimal(0))

        pilih = (a_kanan, a_bawah) if terbesar(a_kanan, a_bawah) >= terbesar(b_kanan, b_bawah) else (b_kanan, b_bawah)
        for r in pilih:
            if r[2] > 0 and r[3] > 0:
                frees.append(r)

    hasil = tuple(
        Lembar(i + 1, lebar_l, panjang_l, tuple(pens)) for i, (_, pens) in enumerate(sheets)
    )
    return HasilNesting(hasil, tuple(tidak_muat))


def validasi_nesting(hasil: HasilNesting, parts: Sequence[Part], kerf="3.2", trim=0) -> list[str]:
    """Periksa ulang hasil: di dalam batas, tidak overlap (celah >= tebal potong), lengkap, serat benar.
    Daftar kosong = lolos. Bukan bukti optimalitas."""
    kerf, trim = _dec(kerf), _dec(trim)
    galat: list[str] = []
    ditempatkan: list[str] = []
    serat = {p.id: p.serat for p in parts}
    for lb in hasil.lembar:
        for p in lb.penempatan:
            if p.x < trim or p.y < trim or p.x + p.w > lb.lebar - trim or p.y + p.h > lb.panjang - trim:
                galat.append(f"{p.part_id} di luar area pakai lembar {lb.nomor}")
            if serat.get(p.part_id) == "tetap" and p.diputar:
                galat.append(f"{p.part_id} serat tetap tetapi diputar")
            ditempatkan.append(p.part_id)
        for i, a in enumerate(lb.penempatan):
            for b in lb.penempatan[i + 1:]:
                pisah_x = a.x + a.w + kerf <= b.x or b.x + b.w + kerf <= a.x
                pisah_y = a.y + a.h + kerf <= b.y or b.y + b.h + kerf <= a.y
                if not (pisah_x or pisah_y):
                    galat.append(f"{a.part_id} dan {b.part_id} tumpang tindih pada lembar {lb.nomor}")
    harus = sorted(p.id for p in parts if p.id not in hasil.tidak_muat)
    if sorted(ditempatkan) != harus:
        galat.append("daftar part yang ditempatkan tidak sama dengan daftar part")
    return galat


def nest_per_bahan(
    parts: Iterable[Part],
    ukuran_lembar: dict[str, tuple] | None = None,
    param: Parameter | None = None,
) -> dict[str, HasilNesting]:
    """Nesting terpisah per bahan; bahan diurutkan nama agar hasil stabil."""
    param = param or Parameter()
    ukuran_lembar = ukuran_lembar or {}
    per_bahan: dict[str, list[Part]] = {}
    for p in parts:
        per_bahan.setdefault(p.bahan, []).append(p)
    return {
        bahan: nest(
            per_bahan[bahan],
            lembar=ukuran_lembar.get(bahan, (param.lembar_lebar, param.lembar_panjang)),
            kerf=param.kerf,
            trim=param.trim,
        )
        for bahan in sorted(per_bahan)
    }
