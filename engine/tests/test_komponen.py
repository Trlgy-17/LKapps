"""Komponen per unit -> SKU -> nesting (SKILL §3–§5). Hitungan tangan di komentar. Lembar 1200 x 2400, kerf 3,2, HPL +10."""
from estimasi_engine.komponen import Komponen, hitung_komponen, sku_papan, titik_sambungan
from estimasi_engine.ruleset import MasukanEstimasi, RuleSet, hitung


def K(id, fungsi, p, l, n=1, unit="Atas 1", jenis="kabinet_atas", bahan="MULTIPLEKS", st="gambar", **kw):
    return Komponen(id, unit, jenis, bahan, id, fungsi, p, l, n, st, **kw)


UNIT_ATAS = [
    K("sisi", "sisi", 700, 350, 2),
    K("sekat", "sekat", 700, 350, 1),
    K("pintu", "pintu", 700, 400, 2, kode_hpl="TH 852 J"),
    K("blk", "belakang", 700, 1200, 1),
]


def test_pemetaan_bahan_sesuai_tabel_aturan():
    assert sku_papan(K("a", "sisi", 1, 1)) == "Multi min 18"                       # badan unit multipleks
    assert sku_papan(K("a", "pintu", 1, 1, bahan="BLOCKBOARD")) == "BB 18 min"       # unit blockboard
    assert sku_papan(K("a", "sisi", 1, 1, bahan="PVC")) == "PVC 18"                  # badan kabinet PVC
    assert sku_papan(K("a", "sekat", 1, 1, bahan="PVC")) == "Multi double 18"        # sekat dan ambalan, termasuk lemari
    assert sku_papan(K("a", "ambalan", 1, 1, bahan="BLOCKBOARD")) == "Multi double 18"
    assert sku_papan(K("a", "bilik", 1, 1)) == "Multi 6"                             # bilik unit kayu
    assert sku_papan(K("a", "alas_laci", 1, 1, bahan="PVC")) == "PVC 6"              # bilik/alas laci kabinet PVC
    assert sku_papan(K("a", "backsplash", 1, 1)) == "Multi polos 6"
    assert sku_papan(K("a", "dudukan_top", 1, 1)) == "Multi polos 9"
    assert "belum terbaca" in sku_papan(K("a", "sisi", 1, 1, bahan=None))


def test_nesting_per_sku_dan_ringkas():
    r = hitung_komponen(UNIT_ATAS, uji_trim=None)
    s = r["sku"]
    assert s["Multi min 18"]["lembar"] == 1 and s["Multi double 18"]["lembar"] == 1 and s["Multi 6"]["lembar"] == 1
    assert s["HPL TH 852 J"]["lembar"] == 1 and s["HPL TH 852 J"]["hpl"] is True       # 2 pintu +10 mm
    assert r["ringkas"] == {"papan_lembar": 3, "hpl_lembar": 1}
    # luas Multi min 18: sisi 2 x 0,7 x 0,35 = 0,49 + pintu 2 x 0,7 x 0,4 = 0,56 -> 1,05 m2
    assert s["Multi min 18"]["luas_m2"] == 1.05
    assert s["Multi min 18"]["luas_per_unit"] == {"Atas 1": 1.05}
    assert s["Multi min 18"]["validasi_nesting"] == "lolos"
    assert s["Multi min 18"]["batas_minimum_luas"] == 1                                # ceil(1,05 / 2,88)


def test_hpl_pintu_dengan_kode_dan_backsplash_bawaan():
    r = hitung_komponen([K("p", "pintu", 700, 400, 1, kode_hpl="TH 852 J"), K("b", "backsplash", 700, 600, 1)], uji_trim=None)
    assert "HPL TH 852 J" in r["sku"] and "HPL TH 009 D" in r["sku"]
    r2 = hitung_komponen([K("p", "pintu", 700, 400, 1)], uji_trim=None, kode_hpl_bawaan="TH 009 D")
    assert "HPL TH 009 D" in r2["sku"]
    r3 = hitung_komponen([K("p", "pintu", 700, 400, 1)], uji_trim=None)
    assert "HPL (kode belum ditetapkan)" in r3["sku"]


def test_hpl_bisa_ditolak_atau_diminta_eksplisit():
    r = hitung_komponen(
        [K("p", "pintu", 700, 400, 1, hpl_muka=False), K("s", "sisi", 700, 400, 1, hpl_muka=True)],
        uji_trim=None, kode_hpl_bawaan="X",
    )
    assert [k for k in r["sku"] if k.startswith("HPL")] == ["HPL X"]
    assert r["sku"]["HPL X"]["jumlah_part"] == 1


def test_panel_lebih_besar_dari_lembar_ditandai_bukan_diperkecil():
    r = hitung_komponen([K("tinggi", "sisi", 3120, 600, 1)], uji_trim=None)
    d = r["sku"]["Multi min 18"]
    assert d["tidak_muat"] == ["tinggi"] and d["lembar"] == 0


def test_uji_trim_10_melaporkan_perubahan():
    # panel 1200 x 1200 muat di trim 0 (tidak bisa diputar agar muat), tidak muat di trim 10 (area 1180): dilaporkan
    r = hitung_komponen([K("blk", "belakang", 1200, 1200, 1)], uji_trim=10)
    assert r["uji_trim"]["tidak_muat"] == {"Multi 6": ["blk"]}


def test_status_terburuk_menentukan_status_sku():
    r = hitung_komponen([K("a", "sisi", 700, 300, 1, st="gambar"), K("b", "sisi", 700, 300, 1, st="skala")], uji_trim=None)
    assert r["sku"]["Multi min 18"]["status"] == "skala"
    r = hitung_komponen([K("a", "sisi", 700, 300, 1, st="gambar"), K("b", "sisi", 700, 300, 1, st="asumsi")], uji_trim=None)
    assert r["sku"]["Multi min 18"]["status"] == "asumsi"


def test_titik_sambungan():
    # sisi lebar 350: 2 x ceil(350/150) = 2 x 3 = 6 per part x 2 = 12; sekat 6; penguat 700: ceil(700/300) = 3; box laci 2 x 2 = 4
    t, rumus = titik_sambungan(UNIT_ATAS + [K("pg", "penguat", 700, 50, 1), K("bl", "box_laci", 400, 100, 2)])
    assert t == 12 + 6 + 3 + 4
    assert "kotak laci 4" in rumus


def test_hitung_memakai_komponen_dan_gp_otomatis():
    e = hitung(MasukanEstimasi(komponen=UNIT_ATAS), RuleSet("v1"))
    assert e.komponen["ringkas"]["papan_lembar"] == 3
    # titik: sisi 12 + sekat 6 = 18 -> x 1,3 = 23,4 -> 23 -> GP 3 + GP 5 = 23
    assert e.sekrup["gp3"].jumlah + e.sekrup["gp5"].jumlah == 23
    assert e.sekrup["gp3"].perlu_konfirmasi is True
    assert hitung(MasukanEstimasi(), RuleSet("v1")).komponen is None


def test_deterministik():
    a = hitung_komponen(UNIT_ATAS)
    b = hitung_komponen(list(reversed(UNIT_ATAS)))
    assert a["sku"] == b["sku"]
