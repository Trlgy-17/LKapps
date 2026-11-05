"""Orkestrasi, RuleSet, format angka, harness validasi."""
from decimal import Decimal

from estimasi_engine.hardware import Pintu, UnitTarik
from estimasi_engine.nesting import Part
from estimasi_engine.ruleset import MasukanEstimasi, RuleSet, hitung
from estimasi_engine.units import format_angka
from estimasi_engine.validasi import bandingkan, dalam_target
from estimasi_engine.params import Parameter


def _masukan():
    return MasukanEstimasi(
        parts=[
            Part("a", "Multi min 18", 2400, 590),
            Part("b", "Multi min 18", 2400, 590),
            Part("d", "HPL TH 009 D", 700, 500, "tetap"),
        ],
        hpl=frozenset({"HPL TH 009 D"}),
        pintu=[Pintu("K1", "lurus"), Pintu("K1", "lurus"), Pintu("L1", "inset_lemari")],
        unit_tarik=[UnitTarik("K1", "kabinet")],
        jumlah_sudut_robot=1,
        meter_kabinet_gantung=10,
        titik_sambungan=100,
    )


def test_hitung_mencatat_versi_dan_menjumlah_lembar():
    e = hitung(_masukan(), RuleSet("v1"))
    assert e.versi_ruleset == "v1"
    assert e.lembar_per_bahan == {"HPL TH 009 D": 1, "Multi min 18": 1}
    # engsel total 3 psg x 4 + 1 psg rel x 14 = 26
    assert e.sekrup["sekrup_5_8"].jumlah == 26
    assert e.sekrup["sekrup_7_fisher"].jumlah == 30
    assert (e.sekrup["gp3"].jumlah, e.sekrup["gp5"].jumlah) == (65, 65)


def test_hasil_sama_untuk_input_dan_ruleset_sama():
    assert hitung(_masukan(), RuleSet("v1")) == hitung(_masukan(), RuleSet("v1"))


def test_parameter_trim_mengubah_hasil_dan_tercatat_di_ruleset():
    rs = RuleSet("uji-trim", Parameter(trim=Decimal(10)))
    m = MasukanEstimasi(parts=[Part("a", "Multi min 18", 2000, 600)])
    e = hitung(m, rs)
    assert e.versi_ruleset == "uji-trim"
    assert e.nesting["Multi min 18"].lembar[0].penempatan[0].x == 10


def test_format_angka_indonesia():
    assert format_angka(1320) == "1.320"
    assert format_angka("6.05") == "6,05"
    assert format_angka(1234567) == "1.234.567"
    assert format_angka(Decimal("0.5"), 2) == "0,50"


def test_bandingkan_status():
    h = {s.item: s for s in bandingkan({"a": 5, "b": 3, "c": 9}, {"a": 5, "b": 4, "c": 8, "d": 1})}
    assert h["a"].status == "cocok"
    assert h["b"].status == "kurang" and h["b"].selisih == 1      # selisih = real - estimasi
    assert h["c"].status == "lebih"
    assert h["d"].status == "baru" and h["d"].estimasi is None


def test_target_satu_lembar_per_sepuluh():
    assert dalam_target(40, 41) is True       # selisih 1 per 41 lembar
    assert dalam_target(33, 41) is False      # baseline Septi papan: 33 vs 41 di luar target
    assert dalam_target(14, 18) is False      # baseline Septi HPL


def test_standar_ikut_dihitung_dan_lem_dari_nesting_hpl():
    m = MasukanEstimasi(
        parts=[Part("h", "HPL TH 009 D", 700, 500, "tetap")],
        hpl=frozenset({"HPL TH 009 D"}),
        pintu=[Pintu("K1", "lurus"), Pintu("K1", "lurus")],
        meter_kabinet=3,
        jumlah_lemari=1,
    )
    e = hitung(m, RuleSet("v1"))
    assert e.standar["material_18"].jumlah == 6
    assert e.standar["handle"].jumlah == 2
    assert e.standar["hanger"].jumlah == 1
    assert e.standar["lem_galon"].jumlah == 1      # 1 lembar HPL -> 1/3 galon -> 1
    assert hitung(MasukanEstimasi(), RuleSet("v1")).standar == {}   # tanpa meter, tidak ditebak
