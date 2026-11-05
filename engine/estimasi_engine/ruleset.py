"""RuleSet berversi dan orkestrasi hitung. Hasil selalu mencatat versi RuleSet (PRD §7)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from . import hardware as hw
from . import screws
from dataclasses import replace

from .komponen import Komponen, hitung_komponen, titik_sambungan
from .nesting import HasilNesting, Part, nest_per_bahan, perbesar_hpl
from .aica import hitung_aica
from .params import UKURAN_LEMBAR_KHUSUS, Parameter
from .pintu_standar import SUMBER_PINTU_SOP, BAHAN_PINTU_BAWAAN, kapasitas_per_lembar, lembar_pintu_sop, part_pintu_asumsi
from .standar import papan_per_bahan, MasukanStandar, TARIF_BAWAAN, TarifStandar, hitung_standar
from .status import Hasil, Status

BAHAN_HPL_PINTU = "HPL muka pintu"

# Aturan bahan PRD §6.2 sebagai data (bukan rumus turunan ukuran: PRD tidak memberi rumusnya).
ATURAN_BAHAN = (
    ("Badan dan pintu", "18 mm satu muka: melamin ke dalam, sisi polos untuk HPL", "Aulia, Septi", False),
    ("Sekat dan ambalan", "18 mm dua muka, termasuk lemari", "Septi", False),
    ("Bilik unit kayu", "Multi 6", "Aulia, Septi", False),
    ("Bilik kabinet PVC", "PVC 6", "Septi", False),
    ("Backsplash", "Multi polos 6 + HPL TH 009 D", "Septi", True),
    ("Dudukan top dan lis tepi", "Multi polos 9", "Septi (baru 2 dari 3 lembar)", True),
)


@dataclass(frozen=True)
class RuleSet:
    versi: str
    parameter: Parameter = field(default_factory=Parameter)


@dataclass(frozen=True)
class MasukanEstimasi:
    parts: Sequence[Part] = ()
    hpl: frozenset[str] = frozenset()          # nama bahan yang bertipe HPL (part diperbesar)
    # None = belum diketahui. Item yang bergantung padanya tidak dihitung (bukan dihitung sebagai nol).
    pintu: Sequence[hw.Pintu] | None = None
    unit_tarik: Sequence[hw.UnitTarik] | None = None
    jumlah_sudut_robot: int | None = None
    meter_kabinet_gantung: object | None = None
    titik_sambungan: int | None = None
    # Hitungan standar per meter (opsional). jumlah_lembar_hpl diisi otomatis dari nesting bahan HPL.
    meter_kabinet: object | None = None
    meter_kitchen: object | None = None
    jumlah_lemari: int | None = None
    tinggi_standar: bool = True
    tarif: TarifStandar = TARIF_BAWAAN
    # Pintu kitchen set yang ukurannya tidak ada di gambar (asumsi 60 x 70 bawah, 40 x 70 atas).
    pintu_bawah_asumsi: int = 0
    pintu_atas_asumsi: int = 0
    bahan_pintu: str = BAHAN_PINTU_BAWAAN      # material 18 mm
    serat_pintu: str = "tetap"
    tinggi_pintu_mm: int = 700
    # AICA: panjang keseluruhan kabinet bawah x kedalaman top (mm). None = belum diketahui.
    aica_panjang_mm: object | None = None
    aica_kedalaman_mm: object | None = None
    # HPL muka pintu: PRD §6.2 "badan dan pintu 18 mm satu muka ... sisi polos untuk HPL" -> 1 muka HPL per pintu.
    hpl_pintu: bool = False
    # Meter kabinet menurut bahan utama unit, mis. {"MULTIPLEKS": 3.3, "PVC": 3.3}. None = tidak dipecah.
    meter_per_bahan: dict | None = None
    # Daftar komponen per unit dari lembar kerja (SKILL §3). None = tidak ada.
    komponen: Sequence[Komponen] | None = None
    kode_hpl_bawaan: str | None = None


@dataclass(frozen=True)
class Estimasi:
    versi_ruleset: str
    nesting: dict[str, HasilNesting]
    lembar_per_bahan: dict[str, int]
    hardware: dict[str, Hasil]
    sekrup: dict[str, Hasil]
    standar: dict[str, Hasil]
    pintu_asumsi: dict[str, Hasil]
    komponen: dict | None = None


def hitung(masukan: MasukanEstimasi, ruleset: RuleSet) -> Estimasi:
    p = ruleset.parameter
    parts = [
        perbesar_hpl(x, p.kelebihan_hpl) if x.bahan in masukan.hpl else x
        for x in masukan.parts
    ]
    pintu_asumsi: dict[str, Hasil] = {}
    if masukan.pintu_bawah_asumsi or masukan.pintu_atas_asumsi:
        for jenis, n in (("bawah", masukan.pintu_bawah_asumsi), ("atas", masukan.pintu_atas_asumsi)):
            if n:
                t = masukan.tinggi_pintu_mm
                parts += part_pintu_asumsi(jenis, n, masukan.bahan_pintu, masukan.serat_pintu, tinggi_mm=t)
                pintu_asumsi[f"pintu_{jenis}_teoritis"] = kapasitas_per_lembar(
                    jenis, None, masukan.serat_pintu, tinggi_mm=t
                )
                pintu_asumsi[f"pintu_{jenis}_realistis"] = kapasitas_per_lembar(
                    jenis, p, masukan.serat_pintu, tinggi_mm=t
                )
    hpl_set = set(masukan.hpl)
    n_pintu_hpl = 0
    if masukan.hpl_pintu:
        pintu_parts = [x for x in parts if x.id.startswith("pintu_")]
        n_pintu_hpl = len(pintu_parts)
        if pintu_parts:
            parts += [
                perbesar_hpl(replace(x, id=f"hpl_{x.id}", bahan=BAHAN_HPL_PINTU, serat="tetap"), p.kelebihan_hpl)
                for x in pintu_parts
            ]
            hpl_set.add(BAHAN_HPL_PINTU)
    nesting = nest_per_bahan(parts, UKURAN_LEMBAR_KHUSUS, p)

    hardware: dict[str, Hasil] = {}
    if masukan.pintu is not None:
        pintu = list(masukan.pintu)
        hardware.update(hw.engsel(pintu))
        hardware["hidrolik"] = hw.hidrolik(pintu)
        hardware["ventilasi"] = hw.ventilasi(pintu)
    if masukan.jumlah_sudut_robot is not None:
        hardware["engsel_robot"] = hw.engsel_robot(masukan.jumlah_sudut_robot)
    if masukan.unit_tarik is not None:
        tarik = list(masukan.unit_tarik)
        hardware.update(hw.rel(tarik))
        hardware["rak_sendok"] = hw.rak_sendok(tarik)

    sekrup: dict[str, Hasil] = {}
    if masukan.pintu is not None and masukan.unit_tarik is not None:
        engsel_total = hardware["engsel"].jumlah + hardware["engsel_full_tekuk"].jumlah
        pasang_rel = hardware["Rel 50"].jumlah + hardware["Rel 45"].jumlah
        sekrup["sekrup_5_8"] = screws.sekrup_5_8(engsel_total, pasang_rel)
    if masukan.meter_kabinet_gantung is not None:
        sekrup["sekrup_7_fisher"] = screws.sekrup_7_fisher(masukan.meter_kabinet_gantung)
    titik = masukan.titik_sambungan
    rumus_titik = ""
    if titik is None and masukan.komponen:
        titik, rumus_titik = titik_sambungan(list(masukan.komponen))
    if titik is not None:
        g = screws.gp(titik)
        ket = f"{rumus_titik}; " if rumus_titik else ""
        sekrup["gp3"] = Hasil(g.gp3, "pcs", g.status, ket + g.rumus, perlu_konfirmasi=bool(rumus_titik))
        sekrup["gp5"] = Hasil(g.gp5, "pcs", g.status, ket + g.rumus, perlu_konfirmasi=bool(rumus_titik))
    standar: dict[str, Hasil] = {}
    if masukan.meter_kabinet is not None:
        lembar_hpl = sum(r.jumlah_lembar for b, r in nesting.items() if b in hpl_set) if hpl_set else None
        standar = hitung_standar(
            MasukanStandar(
                meter_kabinet=masukan.meter_kabinet,
                jumlah_pintu=len(masukan.pintu) if masukan.pintu is not None else None,
                jumlah_lemari=masukan.jumlah_lemari,
                jumlah_lembar_hpl=lembar_hpl,
                meter_kitchen=masukan.meter_kitchen,
                tinggi_standar=masukan.tinggi_standar,
            ),
            masukan.tarif,
        )
    lp = {j: lembar_pintu_sop(j, n) for j, n in (("bawah", masukan.pintu_bawah_asumsi), ("atas", masukan.pintu_atas_asumsi))}
    lp = {j: h for j, h in lp.items() if h is not None}
    for j, h in lp.items():
        standar[f"pintu_{j}_lembar"] = h
    if lp:
        total = sum(h.jumlah for h in lp.values())
        standar["pintu_lembar"] = Hasil(
            total, "lembar", Status.ASUMSI,
            " + ".join(f"pintu {j} {h.jumlah}" for j, h in lp.items()) + f" = {total} lembar Material 18 mm. "
            "Belum dijumlahkan ke papan per meter: belum jelas apakah 2 lembar per meter sudah memuat pintu",
            perlu_konfirmasi=True, sumber=SUMBER_PINTU_SOP, asal_override="catalog_stated",
        )
    if masukan.meter_per_bahan:
        standar.update(papan_per_bahan(masukan.meter_per_bahan, masukan.tarif, masukan.tinggi_standar))
    if n_pintu_hpl:
        k = nesting[BAHAN_HPL_PINTU].jumlah_lembar
        standar["hpl_pintu"] = Hasil(
            k, "lembar", Status.ASUMSI,
            f"{n_pintu_hpl} muka pintu (1 muka HPL per pintu), ukuran +{p.kelebihan_hpl} mm, serat tetap, "
            f"lembar {p.lembar_lebar} x {p.lembar_panjang} mm, tebal potong {p.kerf} mm: {k} lembar. "
            "Hanya muka pintu; sisi badan, top, dan backsplash belum dihitung",
            perlu_konfirmasi=True,
        )
    if masukan.aica_panjang_mm is not None and masukan.aica_kedalaman_mm is not None:
        standar["aica"] = hitung_aica(masukan.aica_panjang_mm, masukan.aica_kedalaman_mm)
    return Estimasi(
        versi_ruleset=ruleset.versi,
        nesting=nesting,
        lembar_per_bahan={b: r.jumlah_lembar for b, r in nesting.items()},
        hardware=hardware,
        sekrup=sekrup,
        standar=standar,
        pintu_asumsi=pintu_asumsi,
        komponen=hitung_komponen(list(masukan.komponen), p, masukan.kode_hpl_bawaan) if masukan.komponen else None,
    )
