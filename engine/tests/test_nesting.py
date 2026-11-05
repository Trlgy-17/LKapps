"""Nesting — PRD §6.1 dan FR-22.

Parameter awal: lembar 1200 x 2400 mm (2,40 x 1,20 m), tebal potong 3,2 mm, trim 0 mm,
HPL +10 mm per part, potong lurus tembus (guillotine), HPL kayu tidak diputar.

Antarmuka (usulan):
    Part(id, bahan, panjang, lebar, serat)   serat: "tetap" | "bebas"; ukuran mm
    perbesar_hpl(part) -> Part               +10 mm pada panjang dan lebar (tafsiran "+10 mm per part", PLAN P7)
    nest(parts, lembar=(1200, 2400), kerf="3.2", trim=0) -> HasilNesting
    HasilNesting.jumlah_lembar, .lembar[i].nomor, .lembar[i].penempatan -> Penempatan(part_id, x, y, w, h, diputar)
    Lembar.isi_persen
    PartTidakMuat (exception)
Sumbu: x sepanjang 1200 (lebar lembar), y sepanjang 2400 (panjang lembar).
"""
import random
from decimal import Decimal

import pytest

from estimasi_engine.nesting import Part, nest, perbesar_hpl, PartTidakMuat

KERF = Decimal("3.2")


def _p(i, panjang, lebar, serat="bebas", bahan="Multi min 18"):
    return Part(id=f"p{i}", bahan=bahan, panjang=panjang, lebar=lebar, serat=serat)


def test_satu_part_penuh_satu_lembar():
    r = nest([_p(1, 2400, 1200)])
    assert r.jumlah_lembar == 1
    assert r.lembar[0].isi_persen == 100


def test_isi_persen_berdasarkan_luas():
    # 1200 x 600 = 25% dari 1200 x 2400; hitung tangan: 600*1200 / (1200*2400) = 0,25
    r = nest([_p(1, 1200, 600)])
    assert r.lembar[0].isi_persen == 25


def test_dua_part_600_muat_satu_lembar_karena_kerf():
    # 590 + 3,2 + 590 = 1183,2 <= 1200 (dua part 600 tidak muat: 1203,2 > 1200)
    r = nest([_p(1, 2400, 590), _p(2, 2400, 590)])
    assert r.jumlah_lembar == 1


def test_tiga_part_600_butuh_dua_lembar():
    # 3 x 590 + 2 x 3,2 = 1776,4 > 1200; panjang 2400 penuh sehingga tak bisa ditumpuk
    r = nest([_p(i, 2400, 590) for i in range(3)])
    assert r.jumlah_lembar == 2


def test_part_lebih_besar_dari_area_pakai_ditolak():
    # trim 10 mm per sisi -> area pakai 1180 x 2380; part lebar 1190 muat di trim 0, tidak di trim 10
    assert nest([_p(1, 2000, 1190)], trim=0).jumlah_lembar == 1
    with pytest.raises(PartTidakMuat):
        nest([_p(1, 2000, 1190)], trim=10)


def test_hpl_diperbesar_10_mm_per_part():
    asli = Part(id="h1", bahan="HPL TH 009 D", panjang=700, lebar=500, serat="tetap")
    besar = perbesar_hpl(asli)
    assert (besar.panjang, besar.lebar) == (710, 510)


def test_hpl_penuh_lembar_tidak_muat_setelah_ditambah_10_mm():
    # 1200 x 2400 + 10 = 1210 x 2410 > lembar
    h = Part(id="h1", bahan="HPL polos", panjang=2400, lebar=1200, serat="bebas")
    with pytest.raises(PartTidakMuat):
        nest([perbesar_hpl(h)])


def test_serat_tetap_tidak_diputar():
    parts = [_p(i, 1000, 600, serat="tetap", bahan="HPL kayu") for i in range(8)]
    r = nest(parts)
    for lb in r.lembar:
        for pen in lb.penempatan:
            assert pen.diputar is False


def _tumpang_tindih_dengan_celah(a, b, kerf):
    # dua persegi panjang aman bila terpisah >= kerf pada salah satu sumbu
    pisah_x = a.x + a.w + kerf <= b.x or b.x + b.w + kerf <= a.x
    pisah_y = a.y + a.h + kerf <= b.y or b.y + b.h + kerf <= a.y
    return not (pisah_x or pisah_y)


def test_invarian_nesting_input_acak_berbenih():
    rng = random.Random(20261105)
    parts = [
        _p(i, rng.randrange(100, 2400, 5), rng.randrange(100, 1200, 5))
        for i in range(60)
    ]
    r = nest(parts, kerf=KERF, trim=0)
    ditempatkan = []
    for lb in r.lembar:
        pens = lb.penempatan
        for pen in pens:
            assert pen.x >= 0 and pen.y >= 0
            assert pen.x + pen.w <= 1200 and pen.y + pen.h <= 2400  # di dalam area pakai
        for i, a in enumerate(pens):
            for b in pens[i + 1:]:
                assert not _tumpang_tindih_dengan_celah(a, b, KERF)
        ditempatkan += [pen.part_id for pen in pens]
    assert sorted(ditempatkan) == sorted(p.id for p in parts)  # tiap part tepat sekali


@pytest.mark.skip(reason="Butuh daftar potongan Ibu Aulia (PLAN P1). Target: 2 + 1 + 1 + 1 lembar.")
def test_aulia_kabinet_bawah_2_1_1_1():
    ...


@pytest.mark.skip(reason="Butuh daftar potongan Ibu Septi (PLAN P1). Target: 26 hitung vs 25 real (bahan 18 mm).")
def test_septi_bahan_18_mm():
    ...
