"""Data real: baris mentah, normalisasi, penggabungan, koreksi (SYSTEM_PROMPT §4, §5).

Prinsip:
  - Teks asli dan nilai asli selalu disimpan; nilai normalisasi terpisah.
  - Hanya satuan kompatibel yang dijumlahkan. psg tidak jadi pcs, blk tidak jadi kg, dst.
  - Koreksi menggantikan nilai efektif pada revisi baru (bukan ditambahkan); histori tetap.
  - Duplikasi sumber tidak ditambahkan. Dua baris dari sumber sama dengan isi identik hanya DIPERINGATKAN,
    tidak dibuang otomatis.
  - Angka ambigu ("1.500") tidak ditebak.
  - Kuantitas kosong tidak menjadi nol.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from decimal import Decimal
from fractions import Fraction

from .material import kunci_material

BASIS = (
    "kebutuhan_disahkan", "pembelian", "keluar_gudang", "pemakaian_bersih", "retur", "real_belum_dijelaskan",
)

_SATUAN = {
    "lbr": "lembar", "lembar": "lembar", "pcs": "pcs", "pc": "pcs", "buah": "pcs", "biji": "pcs",
    "psg": "psg", "pasang": "psg", "set": "set", "batang": "batang", "btg": "batang",
    "m": "m", "mtr": "m", "meter": "m", "kg": "kg", "blk": "blk", "kaleng": "kaleng", "roll": "roll",
    "galon": "galon", "gallon": "galon", "ons": "ons", "dus": "dus", "box": "box", "pak": "pak",
}


class AngkaAmbigu(ValueError):
    """Angka seperti '1.500' tidak bisa dipastikan ribuan atau desimal."""


def parse_angka(teks: str) -> Decimal:
    t = teks.strip()
    if not t:
        raise ValueError("angka kosong")
    if "/" in t:
        a, _, b = t.partition("/")
        f = Fraction(a.replace(",", ".")) / Fraction(b.replace(",", "."))
        return Decimal(f.numerator) / Decimal(f.denominator)
    if "," in t and "." in t:
        raise AngkaAmbigu(f"angka ambigu: {teks}")
    if "." in t and re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        raise AngkaAmbigu(f"angka ambigu (ribuan atau desimal?): {teks}")
    return Decimal(t.replace(",", "."))


def normalisasi_satuan(teks: str | None) -> str | None:
    if not teks:
        return None
    return _SATUAN.get(teks.strip().lower().rstrip("."), teks.strip().lower())


@dataclass(frozen=True)
class BarisReal:
    raw_row_id: str
    raw_text: str
    nama: str
    kunci: str
    kategori: str
    jumlah: Decimal | None
    jumlah_asli: str
    satuan: str | None
    satuan_asli: str
    basis: str = "real_belum_dijelaskan"
    sumber: str | None = None
    revisi: str | None = None
    efektif: bool = True
    material_tampil: str | None = None


_BARIS = re.compile(r"^\s*(?P<nama>.+?)\s*[:=]\s*(?P<qty>[\d.,/]+)\s*(?P<sat>[A-Za-z²]+)?\s*$")


def parse_baris(
    raw_row_id: str, teks: str, sumber: str | None = None, revisi: str | None = None,
    basis: str = "real_belum_dijelaskan", default_blockboard: str | None = None,
) -> BarisReal:
    """'multi min 18 : 11 lembar' -> BarisReal. Menolak format tak dikenal dan angka ambigu."""
    m = _BARIS.match(teks)
    if not m:
        raise ValueError(f"format baris tidak dikenal: {teks!r}")
    if basis not in BASIS:
        raise ValueError(f"basis tidak dikenal: {basis}")
    kunci, kategori, mat = kunci_material(m["nama"], default_blockboard)
    return BarisReal(
        raw_row_id=raw_row_id, raw_text=teks, nama=m["nama"].strip(), kunci=kunci, kategori=kategori,
        jumlah=parse_angka(m["qty"]), jumlah_asli=m["qty"], satuan=normalisasi_satuan(m["sat"]),
        satuan_asli=m["sat"] or "", basis=basis, sumber=sumber, revisi=revisi,
        material_tampil=mat.nama_tampil if mat else None,
    )


@dataclass(frozen=True)
class ItemReal:
    kunci: str
    nama: str
    kategori: str
    satuan: str | None
    basis: str
    jumlah: Decimal | None
    raw_row_ids: tuple[str, ...]


@dataclass(frozen=True)
class HasilGabung:
    item: tuple[ItemReal, ...]
    peringatan: tuple[str, ...]


def gabung(baris: list[BarisReal]) -> HasilGabung:
    """Jumlahkan baris EFEKTIF dengan kunci, satuan, dan basis sama. Urutan keluaran stabil."""
    kelompok: dict[tuple, list[BarisReal]] = {}
    for b in baris:
        if b.efektif:
            kelompok.setdefault((b.kunci, b.satuan, b.basis), []).append(b)
    item = []
    peringatan = []
    for (kunci, satuan, basis), isi in sorted(kelompok.items(), key=lambda kv: tuple(str(x) for x in kv[0])):
        total = None
        for b in isi:
            if b.jumlah is not None:
                total = (total or Decimal(0)) + b.jumlah
        item.append(ItemReal(
            kunci=kunci, nama=isi[0].material_tampil or isi[0].nama, kategori=isi[0].kategori,
            satuan=satuan, basis=basis, jumlah=total, raw_row_ids=tuple(b.raw_row_id for b in isi),
        ))
        # baris identik dari sumber yang sama: mungkin unggah ulang, bukan kontribusi tambahan
        terlihat: dict[tuple, str] = {}
        for b in isi:
            k = (b.jumlah, b.sumber)
            if b.sumber is not None and k in terlihat:
                peringatan.append(
                    f"{b.raw_row_id} identik dengan {terlihat[k]} dari sumber {b.sumber}: "
                    f"tambahan atau unggah ulang? Dijumlahkan sampai dikonfirmasi."
                )
            terlihat.setdefault(k, b.raw_row_id)
    return HasilGabung(tuple(item), tuple(peringatan))


def koreksi(baris: list[BarisReal], raw_row_id: str, jumlah_baru: Decimal | str, revisi: str) -> list[BarisReal]:
    """Nilai baru MENGGANTIKAN nilai efektif baris lama; baris lama tetap ada (efektif=False)."""
    hasil: list[BarisReal] = []
    lama = None
    for b in baris:
        if b.raw_row_id == raw_row_id and b.efektif:
            lama = b
            hasil.append(replace(b, efektif=False))
        else:
            hasil.append(b)
    if lama is None:
        raise KeyError(f"baris efektif {raw_row_id} tidak ditemukan")
    hasil.append(replace(
        lama, raw_row_id=f"{raw_row_id}@{revisi}", jumlah=Decimal(str(jumlah_baru)),
        jumlah_asli=str(jumlah_baru), revisi=revisi, efektif=True,
        raw_text=f"{lama.raw_text} [koreksi {revisi}: {jumlah_baru}]",
    ))
    return hasil


def total_per_kategori_satuan(item: tuple[ItemReal, ...]) -> dict[tuple[str, str | None], Decimal]:
    """Subtotal per (kategori, satuan). Tidak pernah menjumlah satuan berbeda."""
    t: dict[tuple[str, str | None], Decimal] = {}
    for i in item:
        if i.jumlah is not None:
            t[(i.kategori, i.satuan)] = t.get((i.kategori, i.satuan), Decimal(0)) + i.jumlah
    return t
