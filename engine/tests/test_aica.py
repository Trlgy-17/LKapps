"""AICA mengikuti ukuran keseluruhan kabinet bawah. Lembar 935 x 2455 mm = 2,295425 m2."""
import pytest

from estimasi_engine.aica import hitung_aica
from estimasi_engine.ruleset import MasukanEstimasi, RuleSet, hitung
from estimasi_engine.status import Status


def test_satu_lembar_bila_luas_kecil():
    # 2000 x 600 = 1,2 m2 -> ceil(1,2 / 2,295425) = 1
    h = hitung_aica(2000, 600)
    assert h.jumlah == 1 and h.satuan == "lembar" and h.status is Status.ASUMSI
    assert h.perlu_konfirmasi is True


def test_luas_3_m2_dua_lembar_dan_sambungan_dilaporkan():
    # 5000 x 600 = 3,0 m2 -> ceil(1,307) = 2; panjang 5000 > 2455 -> ceil(5000/2455) - 1 = 2 sambungan
    h = hitung_aica(5000, 600)
    assert h.jumlah == 2
    assert "2 sambungan" in h.rumus


def test_panjang_di_atas_lembar_ada_sambungan():
    # 3330 x 600 = 1,998 m2 -> 1 lembar menurut luas, tetapi 3330 > 2455 -> 1 sambungan
    h = hitung_aica(3330, 600)
    assert h.jumlah == 1
    assert "1 sambungan" in h.rumus


def test_muat_satu_lembar_tanpa_sambungan():
    assert "sambungan" not in hitung_aica(2400, 900).rumus


def test_di_hitung_hanya_bila_ukuran_diketahui():
    e = hitung(MasukanEstimasi(aica_panjang_mm="3330"), RuleSet("v1"))
    assert "aica" not in e.standar                       # kedalaman tidak diketahui -> tidak dihitung
    e = hitung(MasukanEstimasi(aica_panjang_mm="3330", aica_kedalaman_mm="600"), RuleSet("v1"))
    assert e.standar["aica"].jumlah == 1


def test_ukuran_negatif_ditolak():
    with pytest.raises(ValueError):
        hitung_aica(-1, 600)
