"""Kamus material (SYSTEM_PROMPT §3). Parser deterministik, tanpa pencocokan kemiripan.

Aturan tetap: "multi" saja = multipleks POLOS. Angka 6/9/18 dalam nama bahan = tebal mm.
"doblemin" dicocokkan SEBELUM "min". Nama di luar kamus tidak dipaksa cocok (kembali None
untuk parse_material; kunci_umum dipakai untuk barang non-papan).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

POLOS = "POLOS"
MELAMIN_1 = "MELAMIN_1_SISI"
DOBLEMIN_2 = "DOBLEMIN_2_SISI"

_KODE_PERMUKAAN = {POLOS: "POLOS", MELAMIN_1: "MELAMIN1", DOBLEMIN_2: "DOBLEMIN2"}
_NAMA_PERMUKAAN = {POLOS: "polos", MELAMIN_1: "min", DOBLEMIN_2: "doblemin"}
_NAMA_DASAR = {"MULTIPLEKS": "Multi", "BLOCKBOARD": "Blockboard", "PVC": "PVC"}

_DOBLE = re.compile(r"doblemin|doublemin|duoblemin|dobelmin|\bdouble\b|\bduoble\b|\bdoble\b|\b2 sisi\b")
_MIN = re.compile(r"min|melamin")          # setelah _DOBLE dikeluarkan
_SATU_SISI = re.compile(r"\b1 sisi\b")
_HPL_KODE = re.compile(r"\bth\s*(\d{3})\s*([a-z])?\b")
_ANGKA = re.compile(r"(?<![\w/])\d+(?:[.,]\d+)?(?![\w/])")


@dataclass(frozen=True)
class Material:
    kunci: str
    dasar: str                     # MULTIPLEKS | BLOCKBOARD | PVC | HPL
    kategori: str                  # papan | hpl
    tebal_mm: Decimal | None
    permukaan: str | None
    kode_dekor: str | None
    nama_tampil: str


def _bersih(teks: str) -> str:
    t = teks.lower().strip()
    t = re.sub(r"[^a-z0-9/.,]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def parse_material(teks: str, default_blockboard: str | None = None) -> Material | None:
    """Kembalikan Material bila nama termasuk kamus (multipleks, blockboard, PVC, HPL), selain itu None.

    default_blockboard: permukaan bawaan katalog untuk blockboard tanpa keterangan.
    Tanpa itu, permukaan blockboard tanpa keterangan = None (belum diketahui).
    """
    t = _bersih(teks)
    if not t:
        return None

    if re.search(r"\bhpl\b", t):
        m = _HPL_KODE.search(t)
        if m:
            kode = f"TH {m.group(1)}" + (f" {m.group(2).upper()}" if m.group(2) else "")
            kunci = "HPL_" + kode.replace(" ", "")
        else:
            kode, kunci = None, "HPL"
        return Material(kunci, "HPL", "hpl", None, None, kode, f"HPL {kode}" if kode else "HPL")

    if re.search(r"\bpvc\b", t):
        tebal = _tebal(t)
        kunci = "PVC" + (f"_{tebal}" if tebal is not None else "")
        return Material(kunci, "PVC", "papan", tebal, None, None, "PVC" + (f" {tebal}" if tebal is not None else ""))

    if "multi" in t:
        dasar = "MULTIPLEKS"
    elif re.search(r"\bbb\b|block", t):
        dasar = "BLOCKBOARD"
    else:
        return None

    permukaan: str | None
    if _DOBLE.search(t):
        permukaan = DOBLEMIN_2
        sisa = _DOBLE.sub(" ", t)
    else:
        sisa = t
        if _MIN.search(sisa) or _SATU_SISI.search(sisa):
            permukaan = MELAMIN_1
        elif "polos" in sisa:
            permukaan = POLOS
        elif dasar == "MULTIPLEKS":
            permukaan = POLOS                      # aturan tetap: multi = polos
        else:
            permukaan = default_blockboard         # None = belum diketahui
    tebal = _tebal(sisa)
    kode_p = _KODE_PERMUKAAN.get(permukaan, "TBD") if permukaan else "TBD"
    kunci = f"{dasar}_{kode_p}" + (f"_{tebal}" if tebal is not None else "")
    nama = _NAMA_DASAR[dasar]
    if permukaan:
        nama += f" {_NAMA_PERMUKAAN[permukaan]}"
    if tebal is not None:
        nama += f" {tebal}"
    return Material(kunci, dasar, "papan", tebal, permukaan, None, nama)


def _tebal(t: str) -> Decimal | None:
    t = re.sub(r"\b[12] sisi\b", " ", t)           # "2 sisi" bukan tebal
    angka = _ANGKA.findall(t)
    if len(angka) != 1:
        return None
    return Decimal(angka[0].replace(",", ".")).normalize()


_TYPO = {"rell": "rel", "rakpir": "rak piring", "raksendok": "rak sendok"}


def kunci_umum(teks: str) -> str:
    """Kunci stabil untuk barang di luar papan/HPL: huruf besar, spasi jadi garis bawah, 5/8 -> 5PER8."""
    t = _bersih(teks)
    t = " ".join(_TYPO.get(w, w) for w in t.split())
    t = re.sub(r"(\d)/(\d)", r"\1per\2", t)
    return re.sub(r"[^A-Z0-9]+", "_", t.upper()).strip("_")


def kunci_material(teks: str, default_blockboard: str | None = None) -> tuple[str, str, Material | None]:
    """(kunci, kategori, material) untuk sembarang baris. Kategori turunan dari kamus/awalan kunci."""
    m = parse_material(teks, default_blockboard)
    if m:
        return m.kunci, m.kategori, m
    k = kunci_umum(teks)
    return k, kategori_umum(k), None


def kategori_umum(kunci: str) -> str:
    if kunci.startswith(("ENGSEL", "REL_", "RAK_", "HIDROLIK", "VENTILASI")):
        return "hardware"
    if kunci.startswith("SEKRUP_"):
        return "sekrup"
    if kunci.startswith("FISHER"):
        return "pengikat_lain"
    if kunci.startswith(("LEM", "PAKU", "AMPLAS")):
        return "bahan_habis"
    if kunci.startswith(("BATANG_LED", "LAMPU", "SAKLAR", "STOP_KONTAK", "KABEL")):
        return "listrik"
    return "lainnya"
