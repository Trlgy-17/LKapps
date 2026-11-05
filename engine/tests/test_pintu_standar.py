"""Pintu kitchen set berukuran asumsi (60 x 70 cm bawah, 40 x 70 cm atas), bahan Material 18 mm, serat tetap.

Teoritis = lembar nominal 1200 x 2400 mm, tanpa tebal potong, tanpa trim:
  bawah 600 x 700: 1200/600 = 2 kolom; 2400/700 = 3,43 -> 3 baris -> 6 pintu
  atas  400 x 700: 1200/400 = 3 kolom; 3 baris -> 9 pintu
Realistis = lembar sama (1200 x 2400), tebal potong 3,2 mm, trim 0:
  bawah: 600 + 3,2 + 600 = 1203,2 > 1200 -> 1 kolom; 3 x 700 + 2 x 3,2 = 2106,4 <= 2400 -> 3 baris -> 3
  atas : 3 x 400 + 2 x 3,2 = 1206,4 > 1200 -> 2 kolom; 3 baris -> 6
Catatan pengguna menulis atas = 8 (teoritis); mesin menghasilkan 9. Lihat PLAN.
"""
from decimal import Decimal

import pytest

from estimasi_engine.nesting import nest
from estimasi_engine.params import Parameter
from estimasi_engine.pintu_standar import kapasitas_per_lembar, part_pintu_asumsi
from estimasi_engine.ruleset import MasukanEstimasi, RuleSet, hitung
from estimasi_engine.status import Status


def test_kapasitas_teoritis_lembar_nominal_tanpa_kerf():
    assert kapasitas_per_lembar("bawah").jumlah == 6
    assert kapasitas_per_lembar("atas").jumlah == 9


def test_kapasitas_realistis_pakai_parameter_ruleset():
    assert kapasitas_per_lembar("bawah", Parameter()).jumlah == 3
    assert kapasitas_per_lembar("atas", Parameter()).jumlah == 6


def test_kapasitas_status_asumsi_dan_rumus():
    h = kapasitas_per_lembar("bawah", Parameter())
    assert h.status is Status.ASUMSI and h.satuan == "pintu/lembar"
    assert "60 x 70 cm" in h.rumus and "3.2" in h.rumus and h.jumlah == 3


def test_kerf_pada_lembar_nominal_menjatuhkan_kapasitas():
    # 2 x 600 + 3,2 = 1203,2 > 1200: hanya 1 kolom. Itu sebabnya hitungan teoritis tanpa kerf.
    p = Parameter(lembar_lebar=Decimal(1200), lembar_panjang=Decimal(2400))
    assert kapasitas_per_lembar("bawah", p).jumlah == 3


def test_trim_10_mengurangi_kapasitas():
    # area pakai 1180 x 2380: bawah 1 kolom x 3 baris = 3; atas 2 kolom x 3 baris = 6 (sama seperti trim 0)
    p = Parameter(trim=Decimal(10))
    assert kapasitas_per_lembar("bawah", p, "tetap").jumlah == 3
    assert kapasitas_per_lembar("atas", p, "tetap").jumlah == 6


def test_serat_bebas_boleh_diputar_dan_memuat_lebih_banyak():
    # lembar 1220 x 2440, trim 10 (area 1200 x 2420): diputar 700 x 600 -> 1 kolom x 4 baris
    # (4 x 600 + 3 x 3,2 = 2409,6 <= 2420) = 4; tanpa putar hanya 3. Strategi rotasi bekerja.
    p = Parameter(lembar_lebar=Decimal(1220), lembar_panjang=Decimal(2440), trim=Decimal(10))
    assert kapasitas_per_lembar("bawah", p, "tetap").jumlah == 3
    assert kapasitas_per_lembar("bawah", p, "bebas").jumlah == 4


def test_tinggi_pintu_70_sampai_80():
    assert part_pintu_asumsi("bawah", 1, tinggi_mm=800)[0].panjang == 800
    with pytest.raises(ValueError):
        part_pintu_asumsi("bawah", 1, tinggi_mm=850)
    with pytest.raises(ValueError):
        part_pintu_asumsi("bawah", 1, tinggi_mm=650)
    assert kapasitas_per_lembar("bawah", tinggi_mm=800).jumlah == 6   # 2400/800 = 3 baris


def test_bahan_pintu_bawaan_material_18():
    assert part_pintu_asumsi("atas", 1)[0].bahan == "Material 18 mm"


def test_jumlah_lembar_dari_jumlah_pintu():
    def lembar(jenis, n):
        return nest(part_pintu_asumsi(jenis, n)).jumlah_lembar
    # kapasitas realistis: bawah 3 per lembar, atas 6 per lembar
    assert lembar("bawah", 3) == 1
    assert lembar("bawah", 4) == 2
    assert lembar("bawah", 12) == 4
    assert lembar("atas", 6) == 1
    assert lembar("atas", 7) == 2


def test_part_bertanda_asumsi_dan_ukuran():
    ps = part_pintu_asumsi("atas", 2)
    assert [p.id for p in ps] == ["pintu_atas_1", "pintu_atas_2"]
    assert all(p.status_ukuran == "asumsi" and p.panjang == 700 and p.lebar == 400 for p in ps)


def test_lebar_di_luar_40_sampai_60_cm_ditolak():
    with pytest.raises(ValueError):
        part_pintu_asumsi("bawah", 1, lebar_mm=650)
    with pytest.raises(ValueError):
        part_pintu_asumsi("atas", 1, lebar_mm=350)
    assert part_pintu_asumsi("bawah", 1, lebar_mm=500)[0].lebar == 500


def test_masuk_ke_hitung_estimasi():
    m = MasukanEstimasi(pintu_bawah_asumsi=7, pintu_atas_asumsi=9)   # bahan bawaan: Material 18 mm
    e = hitung(m, RuleSet("v1"))
    # 16 pintu satu bahan dinesting bersama. Lembar = 3 baris setinggi 70 cm; satu baris memuat
    # 1 bawah saja, 2 atas, atau 1 bawah + 1 atas (600+3,2+400 = 1003,2). 7 bawah + 9 atas butuh
    # 7 baris (bawah+atas) + 1 baris (2 atas sisa) = 8 baris -> ceil(8/3) = 3 lembar.
    assert e.lembar_per_bahan["Material 18 mm"] == 3
    assert e.pintu_asumsi["pintu_bawah_teoritis"].jumlah == 6
    assert e.pintu_asumsi["pintu_atas_teoritis"].jumlah == 9
    assert e.pintu_asumsi["pintu_bawah_realistis"].jumlah == 3
    assert e.pintu_asumsi["pintu_atas_realistis"].jumlah == 6
    assert hitung(m, RuleSet("v1")) == e


def test_tanpa_pintu_asumsi_tidak_ada_hasil():
    assert hitung(MasukanEstimasi(), RuleSet("v1")).pintu_asumsi == {}


def test_hpl_muka_pintu_dan_lem_otomatis():
    # 7 bawah (600 x 700) + 9 atas (400 x 700) -> +10 mm: 610 x 710 dan 410 x 710, lembar 1200 x 2400 serat tetap.
    # Satu baris setinggi 710 memuat 1 bawah + 1 atas (610+3,2+410 = 1023,2) atau 2 atas atau 1 bawah; 3 baris per lembar
    # (3 x 710 + 2 x 3,2 = 2136,4 <= 2400). Hasil dihitung mesin; tes memeriksa konsistensi dan lem dari HPL.
    m = MasukanEstimasi(pintu_bawah_asumsi=7, pintu_atas_asumsi=9, hpl_pintu=True)
    e = hitung(m, RuleSet("v1"))
    h = e.standar["hpl_pintu"]
    assert h.satuan == "lembar" and h.perlu_konfirmasi and h.status is Status.ASUMSI
    assert h.jumlah == e.lembar_per_bahan["HPL muka pintu"] >= 1
    assert "16 muka pintu" in h.rumus and "belum dihitung" in h.rumus


def test_hpl_pintu_memicu_lem_bila_meter_diketahui():
    m = MasukanEstimasi(pintu_bawah_asumsi=7, pintu_atas_asumsi=9, hpl_pintu=True, meter_kabinet=3)
    e = hitung(m, RuleSet("v1"))
    k = e.standar["hpl_pintu"].jumlah
    assert e.standar["lem_galon"].jumlah == -(-k // 3)        # 1 galon per 3 lembar HPL, ke atas


def test_tanpa_pintu_tidak_ada_hpl():
    assert "hpl_pintu" not in hitung(MasukanEstimasi(hpl_pintu=True), RuleSet("v1")).standar


# --- Kapasitas dari ukuran lembar 2400 x 1200 mm: bawah 600 x 700 -> 2 x 3 = 6; atas 400 x 700 -> 3 x 3 = 9.
# Realistis = (teoritis - 1) sampai teoritis: bawah 5–6, atas 8–9. Lembar utama memakai kapasitas realistis terendah.
def test_lembar_pintu_sop_bawah():
    from estimasi_engine.pintu_standar import lembar_pintu_sop
    assert lembar_pintu_sop("bawah", 5).jumlah == 1      # ceil(5/5)
    assert lembar_pintu_sop("bawah", 6).jumlah == 2      # ceil(6/5); minimum teoritis ceil(6/6) = 1
    assert lembar_pintu_sop("bawah", 12).jumlah == 3     # ceil(12/5); minimum teoritis 2
    assert "minimum teoritis 2" in lembar_pintu_sop("bawah", 12).rumus
    assert "2400 x 1200" in lembar_pintu_sop("bawah", 1).rumus


def test_lembar_pintu_sop_atas():
    from estimasi_engine.pintu_standar import lembar_pintu_sop
    assert lembar_pintu_sop("atas", 8).jumlah == 1       # ceil(8/8)
    assert lembar_pintu_sop("atas", 9).jumlah == 2       # ceil(9/8); minimum teoritis ceil(9/9) = 1
    assert lembar_pintu_sop("atas", 17).jumlah == 3      # ceil(17/8); minimum teoritis 2
    assert "teoritis 9" in lembar_pintu_sop("atas", 1).rumus


def test_lembar_pintu_sop_nol_pintu_bukan_nol_palsu_dan_label():
    from estimasi_engine.pintu_standar import lembar_pintu_sop
    assert lembar_pintu_sop("bawah", 0) is None
    h = lembar_pintu_sop("atas", 3)
    assert h.asal_bukti == "catalog_stated" and h.perlu_konfirmasi and "SOP pengguna" in h.sumber


def test_sop_ikut_di_hitung_dan_tidak_dijumlah_ke_papan_per_meter():
    e = hitung(MasukanEstimasi(pintu_bawah_asumsi=7, pintu_atas_asumsi=9, meter_kabinet=3), RuleSet("v1"))
    assert e.standar["pintu_bawah_lembar"].jumlah == 2   # ceil(7/5)
    assert e.standar["pintu_atas_lembar"].jumlah == 2    # ceil(9/8)
    assert e.standar["pintu_lembar"].jumlah == 4
    assert e.standar["material_18"].jumlah == 6          # per meter tidak berubah (3 m x 2)
