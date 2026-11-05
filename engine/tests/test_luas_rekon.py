"""Luas, waste, kemasan, HPL, nesting tandai/validasi, rekonsiliasi — SYSTEM_PROMPT §10–§16, §21."""
from fractions import Fraction

import pytest

from estimasi_engine.luas import (
    batas_minimum_luas, jumlah_kemasan, kekurangan, luas_kotor, luas_muka_hpl_m2, luas_panel_m2, luas_tepi_hpl_m2,
)
from estimasi_engine.nesting import Part, nest, validasi_nesting
from estimasi_engine.standar import MasukanStandar, hitung_standar
from estimasi_engine.status import Hasil, Status
from estimasi_engine.validasi import bandingkan


def test_luas_panel_dan_batas_minimum():
    # 2440 x 600 x 3 = 4,392 m2; lembar 2440 x 1220 = 2,9768 m2 -> ceil(1,4754) = 2
    a = luas_panel_m2(2440, 600, 3)
    assert a == Fraction(4392, 1000)
    assert batas_minimum_luas(a, 2440, 1220) == 2


def test_dimensi_nol_atau_negatif_error_bukan_dikoreksi():
    with pytest.raises(ValueError):
        luas_panel_m2(0, 600, 1)
    with pytest.raises(ValueError):
        luas_panel_m2(-5, 600, 1)


def test_waste_dua_definisi_berbeda():
    assert luas_kotor(10, w="0.1") == Fraction(100, 9)        # 11,111... m2
    assert float(luas_kotor(10, w="0.1")) == pytest.approx(11.1111111)
    assert luas_kotor(10, r="0.1") == 11                      # 11 m2


def test_waste_tidak_punya_bawaan_dan_batas():
    with pytest.raises(ValueError):
        luas_kotor(10)
    with pytest.raises(ValueError):
        luas_kotor(10, w="0.1", r="0.1")
    with pytest.raises(ValueError):
        luas_kotor(10, w=1)
    with pytest.raises(ValueError):
        luas_kotor(10, r=-1)


def test_kekurangan_dan_kemasan():
    k = kekurangan(23, 2, 5)                                   # 23 + 2 - 5 = 20
    assert k == 20
    assert jumlah_kemasan(k, 6) == 4                           # ceil(20/6)
    assert kekurangan(3, 0, 10) == 0                           # tidak negatif


def test_stok_tidak_diketahui_bukan_nol():
    with pytest.raises(ValueError):
        kekurangan(23, 0, None)


def test_luas_hpl_hanya_muka_yang_ditetapkan():
    # 2 panel 700 x 500, 1 muka HPL = 0,7 m2
    assert luas_muka_hpl_m2(700, 500, 2, 1) == Fraction(7, 10)
    assert luas_muka_hpl_m2(700, 500, 2, 0) == 0
    # tepi 4000 mm, strip 20 mm = 0,08 m2
    assert luas_tepi_hpl_m2(4000, 20) == Fraction(8, 100)


def test_panel_3120_pada_lembar_2440_tanpa_rotasi_tandai_tidak_muat():
    p = Part("tinggi", "BB", 3120, 600, "tetap")
    r = nest([p, Part("ok", "BB", 700, 600, "tetap")], tandai_tidak_muat=True)
    assert r.tidak_muat == ("tinggi",)
    assert sum(len(lb.penempatan) for lb in r.lembar) == 1     # tidak diperkecil, tidak disambung diam-diam


def test_validasi_nesting_lolos_dan_menangkap_pelanggaran():
    parts = [Part(f"p{i}", "M", 700, 600, "tetap") for i in range(7)]
    r = nest(parts)
    assert validasi_nesting(r, parts) == []
    # rusak sengaja: hilangkan satu part dari daftar yang diklaim
    assert validasi_nesting(r, parts + [Part("hilang", "M", 100, 100)])


def test_lem_tidak_dihitung_bila_jumlah_hpl_tidak_diketahui():
    assert "lem_galon" not in hitung_standar(MasukanStandar(meter_kabinet=2))


def test_asal_bukti_dari_status():
    assert Hasil(1, "pcs", Status.ASUMSI, "x").asal_bukti == "assumed"
    assert Hasil(1, "pcs", Status.GAMBAR, "x").asal_bukti == "document_stated"


# --- rekonsiliasi (§16) -----------------------------------------------------
def test_selisih_real_dikurangi_estimasi_dan_persen():
    s = bandingkan({"a": 8}, {"a": 10}, basis_real="pemakaian_bersih")[0]
    assert s.selisih == 2 and s.comparable == "ya"
    assert s.selisih_persen == 25                              # 2 / 8 x 100


def test_estimasi_nol_dengan_real_positif_persen_none():
    s = bandingkan({"a": 0}, {"a": 5}, basis_real="pemakaian_bersih")[0]
    assert s.selisih == 5 and s.selisih_persen is None


def test_estimasi_tidak_ada_status_baru_tanpa_selisih():
    s = bandingkan({}, {"x": 3})[0]
    assert s.status == "baru" and s.selisih is None and s.selisih_persen is None


def test_basis_pembelian_vs_estimasi_tidak_setara():
    s = bandingkan({"a": 8}, {"a": 10}, basis_real="pembelian")[0]
    assert s.comparable == "tidak" and s.selisih is None and s.selisih_aritmetis == 2


def test_basis_belum_dijelaskan_diberi_label():
    assert bandingkan({"a": 8}, {"a": 10})[0].comparable == "belum_jelas"
