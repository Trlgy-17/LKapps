"""Daftar komponen (part) per unit -> SKU bahan -> nesting per bahan (SKILL estimasi-material-interior §3–§5).

Ukuran part DIBACA dari lembar kerja (status gambar), diturunkan dari skala (skala), atau asumsi. Kode tidak
menciptakan ukuran. Pemetaan bahan mengikuti tabel aturan bahan; nesting guillotine pada lembar 2,40 x 1,20 m,
tebal potong 3,2 mm, trim 0, HPL +10 mm dan tidak diputar (kayu).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from fractions import Fraction
from math import ceil

from .luas import batas_minimum_luas, luas_panel_m2
from .nesting import HasilNesting, Part, nest, perbesar_hpl, validasi_nesting
from .params import Parameter

FUNGSI = (
    "sisi", "top", "bottom", "sekat", "ambalan", "belakang", "bilik", "alas_laci", "pintu", "muka_laci",
    "box_laci", "rak_tarik", "panel_tampak", "penguat", "soko", "filler", "lis", "backsplash",
    "dudukan_top", "rangka_wallpanel", "lainnya",
)
BADAN = {"sisi", "top", "bottom"}
STRUKTUR = {"sisi", "top", "bottom", "sekat", "ambalan"}
STRIP = {"penguat", "lis", "soko", "rangka_wallpanel"}
HPL_BAWAAN = {"pintu", "muka_laci", "panel_tampak", "backsplash"}   # permukaan luar yang dilapis HPL
STATUS_URUT = {"gambar": 0, "skala": 1, "asumsi": 2}

SKU_18 = {"MULTIPLEKS": "Multi min 18", "BLOCKBOARD": "BB 18 min", "PVC": "PVC 18"}
SKU_TIDAK_DIKETAHUI = "Material 18 mm (bahan unit belum terbaca)"
SKU_TAKDIPETAKAN = "Material (fungsi belum dipetakan)"


@dataclass(frozen=True)
class Komponen:
    id: str
    unit: str
    unit_jenis: str
    bahan_unit: str | None      # MULTIPLEKS | BLOCKBOARD | PVC | None
    nama: str
    fungsi: str
    panjang: int | float | Decimal
    lebar: int | float | Decimal
    jumlah: int
    status_ukuran: str = "asumsi"
    hpl_muka: bool | None = None
    kode_hpl: str | None = None


def sku_papan(k: Komponen) -> str:
    f = k.fungsi
    if f not in FUNGSI:
        raise ValueError(f"fungsi komponen tidak dikenal: {f}")
    if f in BADAN or f in {"pintu", "muka_laci", "box_laci", "rak_tarik", "panel_tampak", "penguat", "soko", "filler", "rangka_wallpanel"}:
        return SKU_18.get(k.bahan_unit or "", SKU_TIDAK_DIKETAHUI)
    if f in {"sekat", "ambalan"}:
        return "Multi double 18"
    if f in {"bilik", "belakang", "alas_laci"}:
        return "PVC 6" if k.bahan_unit == "PVC" else "Multi 6"
    if f == "backsplash":
        return "Multi polos 6"
    if f in {"dudukan_top", "lis"}:
        return "Multi polos 9"
    return SKU_TAKDIPETAKAN


def sku_hpl(k: Komponen, kode_bawaan: str | None) -> str | None:
    if k.hpl_muka is False:
        return None
    if k.hpl_muka is True or k.fungsi in HPL_BAWAAN:
        kode = k.kode_hpl or ("TH 009 D" if k.fungsi == "backsplash" else kode_bawaan)
        return f"HPL {kode}" if kode else "HPL (kode belum ditetapkan)"
    return None


def _status(k: Komponen) -> int:
    return STATUS_URUT.get(k.status_ukuran, 2)


def _nama_status(n: int) -> str:
    return {0: "gambar", 1: "skala", 2: "asumsi"}[n]


def _nest_semua(komponen: list[Komponen], param: Parameter, kode_bawaan: str | None):
    """Kembalikan (part per SKU, metadata id -> (unit, komponen))."""
    per_sku: dict[str, list[Part]] = {}
    meta: dict[str, tuple[str, Komponen]] = {}
    for k in komponen:
        if k.jumlah < 1:
            continue
        p, l = Decimal(str(k.panjang)), Decimal(str(k.lebar))
        for i in range(1, k.jumlah + 1):
            pid = f"{k.id}#{i}"
            sku = sku_papan(k)
            per_sku.setdefault(sku, []).append(Part(pid, sku, p, l, "bebas", k.status_ukuran))
            meta[pid] = (k.unit, k)
            hpl = sku_hpl(k, kode_bawaan)
            if hpl:
                hid = f"hpl_{pid}"
                per_sku.setdefault(hpl, []).append(
                    perbesar_hpl(Part(hid, hpl, p, l, "tetap", k.status_ukuran), param.kelebihan_hpl)
                )
                meta[hid] = (k.unit, k)
    return per_sku, meta


def hitung_komponen(
    komponen: list[Komponen], param: Parameter | None = None, kode_hpl_bawaan: str | None = None,
    uji_trim: int | None = 10,
) -> dict:
    param = param or Parameter()
    keluar = _hitung(komponen, param, kode_hpl_bawaan)
    if uji_trim:
        p2 = Parameter(
            lembar_lebar=param.lembar_lebar, lembar_panjang=param.lembar_panjang, kerf=param.kerf,
            trim=Decimal(uji_trim), kelebihan_hpl=param.kelebihan_hpl,
        )
        alt = _hitung(komponen, p2, kode_hpl_bawaan)
        berubah = []
        for sku, d in alt["sku"].items():
            asal = keluar["sku"].get(sku)
            if asal and asal["lembar"] != d["lembar"]:
                berubah.append({"sku": sku, "lembar": asal["lembar"], "lembar_trim": d["lembar"]})
        keluar["uji_trim"] = {"trim_mm": uji_trim, "berubah": berubah, "tidak_muat": {s: d["tidak_muat"] for s, d in alt["sku"].items() if d["tidak_muat"]}}
    return keluar


def _hitung(komponen: list[Komponen], param: Parameter, kode_hpl_bawaan: str | None) -> dict:
    per_sku, meta = _nest_semua(komponen, param, kode_hpl_bawaan)
    unit_urut = []
    for k in komponen:
        if k.unit not in unit_urut:
            unit_urut.append(k.unit)
    hasil: dict[str, dict] = {}
    for sku in sorted(per_sku):
        parts = per_sku[sku]
        r: HasilNesting = nest(parts, lembar=(param.lembar_lebar, param.lembar_panjang), kerf=param.kerf, trim=param.trim, tandai_tidak_muat=True)
        galat = validasi_nesting(r, parts, param.kerf, param.trim)
        luas_unit: dict[str, Fraction] = {}
        luas_total = Fraction(0)
        st = 0
        for p in parts:
            unit, k = meta[p.id]
            a = luas_panel_m2(p.panjang, p.lebar, 1)
            luas_unit[unit] = luas_unit.get(unit, Fraction(0)) + a
            luas_total += a
            st = max(st, _status(k))
        terakhir = r.lembar[-1].isi_persen if r.lembar else Decimal(0)
        hasil[sku] = {
            "lembar": r.jumlah_lembar,
            "batas_minimum_luas": batas_minimum_luas(luas_total, param.lembar_panjang, param.lembar_lebar),
            "luas_m2": float(round(luas_total, 3)),
            "luas_per_unit": {u: float(round(luas_unit[u], 3)) for u in unit_urut if u in luas_unit},
            "isi_terakhir_persen": float(terakhir),
            "tidak_muat": sorted(i.split("#")[0].removeprefix("hpl_") for i in r.tidak_muat),
            "validasi_nesting": "lolos" if not galat else "gagal",
            "galat_validasi": galat[:5],
            "jumlah_part": len(parts),
            "status": _nama_status(st),
            "hpl": sku.startswith("HPL"),
        }
    papan = sum(d["lembar"] for d in hasil.values() if not d["hpl"])
    hpl = sum(d["lembar"] for d in hasil.values() if d["hpl"])
    return {
        "sku": hasil,
        "unit": unit_urut,
        "ringkas": {"papan_lembar": papan, "hpl_lembar": hpl},
        "parameter": {
            "lembar_mm": [float(param.lembar_lebar), float(param.lembar_panjang)], "tebal_potong_mm": float(param.kerf),
            "trim_mm": float(param.trim), "kelebihan_hpl_mm": float(param.kelebihan_hpl),
        },
    }


def titik_sambungan(komponen: list[Komponen]) -> tuple[int, str]:
    """Titik sambungan GP (SKILL §7): 1 sekrup per 15 cm dari ujung papan struktur, strip 1 per 30 cm,
    2 per part kotak laci. TAFSIRAN: ujung papan struktur = kedua sisi lebar (2 x ceil(lebar / 150 mm))."""
    total = 0
    rincian = {"struktur": 0, "strip": 0, "kotak_laci": 0}
    for k in komponen:
        n = max(0, k.jumlah)
        if k.fungsi in STRUKTUR:
            t = 2 * ceil(Decimal(str(k.lebar)) / 150) * n
            rincian["struktur"] += t
        elif k.fungsi in STRIP:
            t = ceil(Decimal(str(k.panjang)) / 300) * n
            rincian["strip"] += t
        elif k.fungsi == "box_laci":
            t = 2 * n
            rincian["kotak_laci"] += t
        else:
            continue
        total += t
    rumus = (
        f"struktur {rincian['struktur']} (2 ujung x ceil(lebar/150 mm)) + strip {rincian['strip']} (ceil(panjang/300 mm)) "
        f"+ kotak laci {rincian['kotak_laci']} (2 per part) = {total} titik"
    )
    return total, rumus
