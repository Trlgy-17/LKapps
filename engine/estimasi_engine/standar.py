"""Hitungan standar workshop: bahan, hardware, sekrup, dan bahan bantu per meter kabinet.

Sumber: catatan pengguna 5 November 2026 ("ukuran standard & konsep minimalist").
Semua tarif berlaku dengan CATATAN TINGGI STANDAR. Bila tinggi tidak standar, hasil diberi
perlu_konfirmasi. Status angka: ASUMSI (PRD §6.5: "diisi dari standar proyek").

Dasar hitung ("meter") = meter lari kabinet, kecuali LED strip yang memakai meter kitchen.
Pembulatan barang yang dibeli utuh (lembar, roll, galon, pcs) adalah KE ATAS pada total proyek,
bukan per unit. Ini asumsi (PLAN P3); rumus menulis nilai sebelum dibulatkan.

Item yang belum punya tarif (mis. rumah lampu) tidak dihitung dan tidak ditebak.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING

from .status import Hasil, Status


@dataclass(frozen=True)
class TarifStandar:
    material_18_lembar_per_meter: Decimal = Decimal(2)      # blockboard 18 mm: 1 meter = 2 lembar
    material_6_lembar_per_meter: Decimal = Decimal("0.5")   # 1 meter = 1/2 lembar, ukuran lembar sama dengan 18 mm
    handle_per_pintu: int = 1
    hanger_per_lemari: int = 1
    led_roll_per_meter_kitchen: Decimal = Decimal("0.5")    # 1 roll 5 m untuk 2 meter kitchen
    sekrup_5cm_per_meter: int = 25
    sekrup_3cm_per_meter: int = 10
    sekrup_4cm_per_meter: int = 15
    sekrup_5_8_per_meter: int = 30                          # "1 meter (cabinet) / 3 pintu 30pc" — makna belum pasti
    lembar_hpl_per_galon: int = 3                           # 3 lembar HPL 2,40 x 1,20
    kg_per_galon: Decimal = Decimal("2.5")
    silen_per_meter: int = 1
    amplas_100_per_meter: int = 1
    amplas_120_per_meter: int = 1
    cat_min_ons_per_meter: int = 1
    cat_hpl_ons_per_meter: int = 1
    tahanan_hambalan_per_meter: int = 12


TARIF_BAWAAN = TarifStandar()

SUMBER_SOP = "SOP pengguna 5 Nov 2026: tarif per meter kabinet, tinggi standar 70–80 cm, konsep minimalis. Belum dikalibrasi dengan data real."

TINGGI_STANDAR_MIN_MM = 700   # tinggi standar 70–80 cm
TINGGI_STANDAR_MAX_MM = 800


def tinggi_standar(tinggi_mm) -> bool:
    """True bila tinggi (mm) termasuk standar 70–80 cm."""
    return TINGGI_STANDAR_MIN_MM <= Decimal(str(tinggi_mm)) <= TINGGI_STANDAR_MAX_MM


@dataclass(frozen=True)
class MasukanStandar:
    meter_kabinet: Decimal | int | str
    jumlah_pintu: int | None = None               # None = belum diketahui (bukan nol)
    jumlah_lemari: int | None = None
    jumlah_lembar_hpl: int | None = None          # dari nesting bahan HPL; None = belum diketahui (bukan nol)
    meter_kitchen: Decimal | int | str | None = None   # bila None, LED strip tidak dihitung
    tinggi_standar: bool = True


def _dec(v) -> Decimal:
    d = Decimal(str(v))
    if d < 0:
        raise ValueError("ukuran tidak boleh negatif")
    return d


def _atas(d: Decimal) -> int:
    return int(d.to_integral_value(rounding=ROUND_CEILING))


def _fmt(d: Decimal) -> str:
    return format(d.normalize(), "f")


def hitung_standar(m: MasukanStandar, tarif: TarifStandar = TARIF_BAWAAN) -> dict[str, Hasil]:
    meter = _dec(m.meter_kabinet)
    non_standar = not m.tinggi_standar
    hasil: dict[str, Hasil] = {}

    def tambah(kunci, jumlah, satuan, rumus, konfirmasi=False):
        hasil[kunci] = Hasil(
            jumlah, satuan, Status.ASUMSI,
            rumus + (" [tinggi tidak standar]" if non_standar else ""),
            perlu_konfirmasi=konfirmasi or non_standar,
            sumber=SUMBER_SOP, asal_override="catalog_stated",
        )

    def per_meter(kunci, tarif_per_meter, satuan, nama, konfirmasi=False):
        mentah = meter * Decimal(tarif_per_meter)
        jumlah = _atas(mentah)
        rumus = f"{_fmt(meter)} m x {_fmt(Decimal(tarif_per_meter))} {nama}/m = {_fmt(mentah)}"
        if mentah != jumlah:
            rumus += f", dibulatkan ke atas menjadi {jumlah}"
        tambah(kunci, jumlah, satuan, rumus, konfirmasi)

    per_meter("material_18", tarif.material_18_lembar_per_meter, "lembar", "lembar")
    per_meter("material_6", tarif.material_6_lembar_per_meter, "lembar", "lembar")
    per_meter("sekrup_5cm", tarif.sekrup_5cm_per_meter, "pcs", "pcs")
    per_meter("sekrup_3cm", tarif.sekrup_3cm_per_meter, "pcs", "pcs")
    per_meter("sekrup_4cm", tarif.sekrup_4cm_per_meter, "pcs", "pcs")
    per_meter("sekrup_5_8_standar", tarif.sekrup_5_8_per_meter, "pcs", "pcs", konfirmasi=True)
    per_meter("silen", tarif.silen_per_meter, "pcs", "pcs", konfirmasi=True)
    per_meter("amplas_100", tarif.amplas_100_per_meter, "lembar", "lembar")
    per_meter("amplas_120", tarif.amplas_120_per_meter, "lembar", "lembar")
    per_meter("cat_min", tarif.cat_min_ons_per_meter, "ons", "ons")
    per_meter("cat_hpl", tarif.cat_hpl_ons_per_meter, "ons", "ons")
    per_meter("tahanan_hambalan", tarif.tahanan_hambalan_per_meter, "pcs", "pcs")

    if m.jumlah_pintu is not None:
        tambah("handle", m.jumlah_pintu * tarif.handle_per_pintu, "pcs",
               f"{m.jumlah_pintu} pintu x {tarif.handle_per_pintu} handle", konfirmasi=True)
    if m.jumlah_lemari is not None:
        tambah("hanger", m.jumlah_lemari * tarif.hanger_per_lemari, "pcs",
               f"{m.jumlah_lemari} lemari x {tarif.hanger_per_lemari} hanger")

    if m.meter_kitchen is not None:
        kitchen = _dec(m.meter_kitchen)
        mentah = kitchen * tarif.led_roll_per_meter_kitchen
        roll = _atas(mentah)
        rumus = f"{_fmt(kitchen)} m kitchen x 1 roll (5 m) / 2 m = {_fmt(mentah)}"
        if mentah != roll:
            rumus += f", dibulatkan ke atas menjadi {roll}"
        tambah("led_strip", roll, "roll", rumus, konfirmasi=True)

    # Lem: 3 lembar HPL (2,40 x 1,20) = 1 galon 2,5 kg. Jumlah HPL tidak diketahui -> lem tidak dihitung.
    if m.jumlah_lembar_hpl is None:
        return hasil
    galon_mentah = Decimal(m.jumlah_lembar_hpl) / tarif.lembar_hpl_per_galon
    kg = Decimal(m.jumlah_lembar_hpl) * tarif.kg_per_galon / tarif.lembar_hpl_per_galon
    galon = _atas(galon_mentah)
    tambah(
        "lem_galon", galon, "galon",
        f"{m.jumlah_lembar_hpl} lembar HPL / {tarif.lembar_hpl_per_galon} lembar per galon = "
        f"{_fmt(galon_mentah.quantize(Decimal('0.01')))} galon "
        f"({_fmt(kg.quantize(Decimal('0.01')))} kg), dibulatkan ke atas menjadi {galon}",
        konfirmasi=True,
    )
    return hasil


DASAR_PAPAN = ("MULTIPLEKS", "BLOCKBOARD", "PVC", "TIDAK_DIKETAHUI")


def papan_per_bahan(meter_per_dasar: dict, tarif: TarifStandar = TARIF_BAWAAN, tinggi_ok: bool = True) -> dict[str, Hasil]:
    """Pecah kebutuhan papan per meter menurut bahan utama unit (aturan bahan: multipleks -> Multi min 18 / Multi 6,
    blockboard -> BB 18 min / Multi 6, PVC -> PVC 18 / PVC 6). Tiap SKU dibulatkan ke atas pada totalnya sendiri.

    Catatan: sekat dan ambalan (Multi double 18) belum dipisahkan dari angka 2 lembar per meter.
    Kunci: papan18_<dasar>, papan6_<dasar> (dasar huruf kecil).
    """
    hasil: dict[str, Hasil] = {}
    for dasar in DASAR_PAPAN:
        if dasar not in meter_per_dasar:
            continue
        m = _dec(meter_per_dasar[dasar])
        if m == 0:
            continue
        for tebal, rate in (("18", tarif.material_18_lembar_per_meter), ("6", tarif.material_6_lembar_per_meter)):
            mentah = m * rate
            n = _atas(mentah)
            rumus = f"{_fmt(m)} m {dasar.lower().replace('_', ' ')} x {_fmt(rate)} lembar/m = {_fmt(mentah)}"
            if mentah != n:
                rumus += f", dibulatkan ke atas menjadi {n}"
            if not tinggi_ok:
                rumus += " [tinggi tidak standar]"
            hasil[f"papan{tebal}_{dasar.lower()}"] = Hasil(
                n, "lembar", Status.ASUMSI, rumus,
                perlu_konfirmasi=(dasar == "TIDAK_DIKETAHUI") or not tinggi_ok,
            )
    return hasil
