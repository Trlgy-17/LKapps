"""Hitungan standar per meter kabinet — catatan pengguna 5 November 2026.

Angka di bawah dihitung tangan dari catatan itu (komentar menunjukkan hitungannya).
"""
import pytest

from estimasi_engine.standar import MasukanStandar, hitung_standar
from estimasi_engine.status import Status
from estimasi_engine.ruleset import MasukanEstimasi, RuleSet, hitung


def _h(**kw):
    return hitung_standar(MasukanStandar(**kw))


def test_per_meter_3_meter():
    h = _h(meter_kabinet=3)
    assert h["material_18"].jumlah == 6        # 3 x 2 lembar
    assert h["material_6"].jumlah == 2         # 3 x 1/2 = 1,5 -> 2 lembar (dibulatkan ke atas)
    assert h["sekrup_5cm"].jumlah == 75        # 3 x 25
    assert h["sekrup_3cm"].jumlah == 30        # 3 x 10
    assert h["sekrup_4cm"].jumlah == 45        # 3 x 15
    assert h["sekrup_5_8_standar"].jumlah == 90   # 3 x 30
    assert h["silen"].jumlah == 3
    assert h["amplas_100"].jumlah == 3
    assert h["amplas_120"].jumlah == 3
    assert h["cat_min"].jumlah == 3 and h["cat_min"].satuan == "ons"
    assert h["cat_hpl"].jumlah == 3 and h["cat_hpl"].satuan == "ons"
    assert h["tahanan_hambalan"].jumlah == 36  # 3 x 12


def test_meter_pecahan():
    h = _h(meter_kabinet="2.5")
    assert h["material_18"].jumlah == 5        # 2,5 x 2
    assert h["material_6"].jumlah == 2         # 1,25 -> 2
    assert h["sekrup_5cm"].jumlah == 63        # 62,5 -> 63
    assert "dibulatkan" in h["sekrup_5cm"].rumus


def test_satuan_dan_status_asumsi():
    h = _h(meter_kabinet=1, jumlah_pintu=1, jumlah_lemari=1, meter_kitchen=2, jumlah_lembar_hpl=3)
    assert all(x.status is Status.ASUMSI for x in h.values())
    assert all(x.rumus for x in h.values())
    assert h["material_18"].satuan == "lembar"
    assert h["led_strip"].satuan == "roll"
    assert h["lem_galon"].satuan == "galon"


def test_handle_dan_hanger():
    h = _h(meter_kabinet=1, jumlah_pintu=7, jumlah_lemari=2)
    assert h["handle"].jumlah == 7             # 1 pintu 1 handle
    assert h["hanger"].jumlah == 2             # 1 lemari 1 hanger


def test_led_strip_roll_per_meter_kitchen():
    assert _h(meter_kabinet=1, meter_kitchen=4)["led_strip"].jumlah == 2   # 4 / 2
    assert _h(meter_kabinet=1, meter_kitchen=5)["led_strip"].jumlah == 3   # 2,5 -> 3
    assert "led_strip" not in _h(meter_kabinet=1)                          # meter kitchen tidak diisi -> tidak ditebak


def test_lem_per_3_lembar_hpl():
    assert _h(meter_kabinet=1, jumlah_lembar_hpl=3)["lem_galon"].jumlah == 1   # 3 lembar = 1 galon 2,5 kg
    h = _h(meter_kabinet=1, jumlah_lembar_hpl=4)["lem_galon"]
    assert h.jumlah == 2                                                      # 4/3 = 1,33 galon -> 2
    assert "3,33 kg" in h.rumus.replace(".", ",")                             # 4 x 2,5 / 3 = 3,33 kg
    assert _h(meter_kabinet=1, jumlah_lembar_hpl=0)["lem_galon"].jumlah == 0


def test_tinggi_tidak_standar_minta_konfirmasi():
    h = _h(meter_kabinet=2, jumlah_pintu=2, tinggi_standar=False)
    assert all(x.perlu_konfirmasi for x in h.values())
    assert "tidak standar" in h["material_18"].rumus


def test_item_pasti_tidak_minta_konfirmasi_saat_tinggi_standar():
    h = _h(meter_kabinet=2)
    assert h["material_18"].perlu_konfirmasi is False
    assert h["sekrup_5cm"].perlu_konfirmasi is False
    assert h["sekrup_5_8_standar"].perlu_konfirmasi is True   # makna "/ 3 pintu 30pc" belum pasti


def test_masukan_negatif_ditolak():
    with pytest.raises(ValueError):
        _h(meter_kabinet=-1)


def test_rumah_lampu_tanpa_tarif_tidak_dihitung():
    assert "rumah_lampu" not in _h(meter_kabinet=3)


def test_tinggi_standar_70_sampai_80_cm():
    from estimasi_engine.standar import tinggi_standar
    assert tinggi_standar(700) and tinggi_standar(800) and tinggi_standar(750)
    assert not tinggi_standar(699) and not tinggi_standar(801)


def test_papan_dipecah_menurut_bahan_utama_unit():
    from estimasi_engine.standar import papan_per_bahan
    h = papan_per_bahan({"MULTIPLEKS": "3.33", "PVC": "3.33", "BLOCKBOARD": "1"})
    assert h["papan18_multipleks"].jumlah == 7        # 3,33 x 2 = 6,66 -> 7
    assert h["papan6_multipleks"].jumlah == 2         # 3,33 x 0,5 = 1,665 -> 2
    assert h["papan18_pvc"].jumlah == 7
    assert h["papan6_pvc"].jumlah == 2
    assert h["papan18_blockboard"].jumlah == 2        # 1 x 2
    assert h["papan6_blockboard"].jumlah == 1         # 0,5 -> 1
    assert "papan18_tidak_diketahui" not in h


def test_bahan_tidak_diketahui_perlu_konfirmasi():
    from estimasi_engine.standar import papan_per_bahan
    h = papan_per_bahan({"TIDAK_DIKETAHUI": 2})
    assert h["papan18_tidak_diketahui"].perlu_konfirmasi is True


def test_pecah_ikut_dihitung_di_hitung():
    e = hitung(MasukanEstimasi(meter_kabinet=6, meter_per_bahan={"MULTIPLEKS": 3, "PVC": 3}), RuleSet("v1"))
    assert e.standar["material_18"].jumlah == 12
    assert e.standar["papan18_multipleks"].jumlah == 6 and e.standar["papan18_pvc"].jumlah == 6
