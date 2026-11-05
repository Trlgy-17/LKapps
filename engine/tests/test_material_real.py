"""Kamus material, data real, dan kasus uji penerimaan SYSTEM_PROMPT §3, §5, §20, §21."""
import json
from decimal import Decimal
from pathlib import Path

import pytest

from estimasi_engine.data_real import (
    AngkaAmbigu, gabung, koreksi, parse_angka, parse_baris, total_per_kategori_satuan,
)
from estimasi_engine.material import kunci_material, parse_material

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "septi_real.json"


# --- kamus (§3) -------------------------------------------------------------
@pytest.mark.parametrize("teks,kunci", [
    ("multi", "MULTIPLEKS_POLOS"),
    ("multipleks polos", "MULTIPLEKS_POLOS"),
    ("multi 6", "MULTIPLEKS_POLOS_6"),
    ("multi polos 6", "MULTIPLEKS_POLOS_6"),
    ("multi polos 9", "MULTIPLEKS_POLOS_9"),
    ("multi min 18", "MULTIPLEKS_MELAMIN1_18"),
    ("multimin 18", "MULTIPLEKS_MELAMIN1_18"),
    ("multipleks melamin 1 sisi 18", "MULTIPLEKS_MELAMIN1_18"),
    ("multi duoble 18", "MULTIPLEKS_DOBLEMIN2_18"),
    ("multi doublemin 18", "MULTIPLEKS_DOBLEMIN2_18"),
    ("multipleks melamin 2 sisi 18", "MULTIPLEKS_DOBLEMIN2_18"),
    ("bb 18 min", "BLOCKBOARD_MELAMIN1_18"),
    ("blockmin 18", "BLOCKBOARD_MELAMIN1_18"),
    ("bb polos 18", "BLOCKBOARD_POLOS_18"),
    ("bb double 18", "BLOCKBOARD_DOBLEMIN2_18"),
    ("pvc 18", "PVC_18"),
    ("pvc 6", "PVC_6"),
    ("hpl th009d", "HPL_TH009D"),
    ("HPL TH 009 D", "HPL_TH009D"),
    ("hpl th 852 j", "HPL_TH852J"),
])
def test_kamus(teks, kunci):
    assert parse_material(teks).kunci == kunci


def test_doblemin_bukan_melamin_satu_sisi():
    assert parse_material("multi doblemin 18").permukaan == "DOBLEMIN_2_SISI"
    assert parse_material("multi min 18").permukaan == "MELAMIN_1_SISI"


def test_tebal_adalah_mm_dari_nama_bahan():
    m = parse_material("multi 6")
    assert m.tebal_mm == Decimal(6) and m.permukaan == "POLOS" and m.dasar == "MULTIPLEKS"


def test_blockboard_tanpa_keterangan_belum_diketahui_kecuali_katalog():
    assert parse_material("blockboard 18").permukaan is None
    assert parse_material("blockboard 18", default_blockboard="MELAMIN_1_SISI").permukaan == "MELAMIN_1_SISI"


def test_hpl_th009d_tidak_sama_dengan_th009j():
    assert parse_material("hpl th 009 j").kunci != parse_material("hpl th 009 d").kunci


def test_pvc_tidak_jadi_multipleks_atau_melamin():
    m = parse_material("pvc 18")
    assert m.dasar == "PVC" and m.permukaan is None


def test_nama_asing_tidak_dipaksa_cocok():
    assert parse_material("papan partikel 18") is None
    assert parse_material("engsel lurus") is None
    assert kunci_material("engsel lurus")[0] == "ENGSEL_LURUS"


# --- angka dan satuan (§4) --------------------------------------------------
def test_parse_angka():
    assert parse_angka("1/2") == Decimal("0.5")
    assert parse_angka("6,05") == Decimal("6.05")
    assert parse_angka("500") == 500
    with pytest.raises(AngkaAmbigu):
        parse_angka("1.500")


def test_satuan_tidak_dikonversi_diam_diam():
    b = parse_baris("X1", "ventilasi : 3 psg")
    assert (b.jumlah, b.satuan) == (3, "psg")           # tetap psg, bukan pcs
    assert parse_baris("X2", "lem kuning : 1 blk").satuan == "blk"
    assert parse_baris("X3", "amplas 100 : 2 mtr").satuan == "m"
    assert parse_baris("X4", "paku jalosi : 1/2 kg").jumlah == Decimal("0.5")


def test_format_baris_tak_dikenal_ditolak():
    with pytest.raises(ValueError):
        parse_baris("X", "ngawur tanpa angka")


# --- penggabungan dan revisi (§5) -------------------------------------------
def _fixture_baris():
    d = json.loads(FIXTURE.read_text(encoding="utf-8"))
    return [parse_baris(i, t, sumber="Septi") for i, t in d["baris"]]


def test_multi_polos_6_dan_multi_6_digabung_10_dengan_raw_row_terlacak():
    h = gabung(_fixture_baris())
    polos6 = next(i for i in h.item if i.kunci == "MULTIPLEKS_POLOS_6")
    assert polos6.jumlah == 10
    assert polos6.raw_row_ids == ("B01", "B04")


def test_multi_min_dan_doblemin_terpisah_dan_blockmin_bukan_multipleks():
    h = {i.kunci: i for i in gabung(_fixture_baris()).item}
    assert h["MULTIPLEKS_MELAMIN1_18"].jumlah == 11
    assert h["MULTIPLEKS_DOBLEMIN2_18"].jumlah == 4          # tetap 4, bukan 8
    assert h["BLOCKBOARD_MELAMIN1_18"].jumlah == 3


def test_kontrol_fixture_septi():
    h = gabung(_fixture_baris())
    assert len(_fixture_baris()) == 35
    assert len(h.item) == 34
    papan = [i for i in h.item if i.kategori == "papan"]
    assert sum(i.jumlah for i in papan if i.kunci.startswith("MULTIPLEKS")) == 28
    assert sum(i.jumlah for i in papan if i.kunci.startswith("PVC")) == 10
    assert sum(i.jumlah for i in papan if i.kunci.startswith("BLOCKBOARD")) == 3
    assert sum(i.jumlah for i in papan) == 41
    # tebal (mm) per kunci
    tebal = {}
    for i in papan:
        t = i.kunci.rsplit("_", 1)[-1]
        tebal[t] = tebal.get(t, 0) + i.jumlah
    assert tebal == {"6": 13, "9": 3, "18": 25}
    t = total_per_kategori_satuan(h.item)
    assert t[("hpl", "lembar")] == 18
    assert sum(i.jumlah for i in h.item if i.kunci.startswith("HPL_TH009D")) == 4
    assert sum(i.jumlah for i in h.item if i.kunci.startswith("HPL_TH852J")) == 14
    assert sum(i.jumlah for i in h.item if i.kunci.startswith("ENGSEL")) == 20
    assert sum(i.jumlah for i in h.item if i.kunci.startswith("REL_")) == 10
    assert t[("sekrup", "pcs")] == 1320                        # GP3 + GP5 + 5/8 + 7
    assert t[("pengikat_lain", "pcs")] == 20                   # fisher tidak ikut sekrup
    assert t[("bahan_habis", "m")] == 8                        # amplas 2 + 2 + 4
    assert t[("listrik", "m")] == 40                           # kabel
    kunci = {i.kunci: i.jumlah for i in h.item}
    assert kunci["BATANG_LED"] == 5 and kunci["LAMPU_LED"] == 3  # tetap berbeda


def test_satuan_berbeda_tidak_dijumlahkan():
    t = total_per_kategori_satuan(gabung(_fixture_baris()).item)
    assert ("hardware", "psg") in t and ("hardware", "pcs") in t
    assert t[("hardware", "psg")] == 16 + 2 + 2 + 8 + 2 + 1 + 3   # engsel + rel + hidrolik + ventilasi
    assert t[("hardware", "pcs")] == 2                            # rak piring + rak sendok


def test_koreksi_menggantikan_bukan_menambah():
    b = [parse_baris("R1", "multi min 18 : 10 lembar")]
    b2 = koreksi(b, "R1", 8, "rev2")
    h = gabung(b2)
    assert h.item[0].jumlah == 8                                 # bukan 18
    assert len(b2) == 2 and b2[0].jumlah == 10 and b2[0].efektif is False   # histori tersimpan


def test_proyek_baru_tanpa_daftar_real_tidak_menyalin_fixture():
    assert gabung([]).item == ()


def test_baris_identik_dari_sumber_sama_diperingatkan():
    b = [parse_baris("A", "pvc 18 : 7 lembar", sumber="S"), parse_baris("B", "pvc 18 : 7 lembar", sumber="S")]
    h = gabung(b)
    assert h.peringatan and "B" in h.peringatan[0]


def test_nama_berubah_tidak_mengubah_jumlah():
    h = gabung([parse_baris("A", "multi 6 : 6 lembar"), parse_baris("B", "multipleks polos 6 : 0 lembar")])
    assert h.item[0].jumlah == 6
