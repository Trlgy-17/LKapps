"""Rekonsiliasi data real (fixture Septi) terhadap hasil estimasi, tingkat kelompok."""
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FIXTURE = json.loads((RAIZ / "fixtures" / "septi_real.json").read_text(encoding="utf-8"))


def _jalan(masuk):
    r = subprocess.run([sys.executable, str(RAIZ / "run_real.py")], input=json.dumps(masuk), capture_output=True, text=True, cwd=RAIZ)
    return json.loads(r.stdout)


def _h(jumlah, satuan):
    return {"jumlah": jumlah, "satuan": satuan}


HASIL = {
    "standar": {"material_18": _h(28, "lembar"), "material_6": _h(12, "lembar"), "hpl_pintu": _h(6, "lembar"),
                "sekrup_5cm": _h(100, "pcs"), "sekrup_4cm": _h(80, "pcs"), "hanger": _h(1, "pcs")},
    "hardware": {"engsel": _h(18, "psg"), "engsel_robot": _h(2, "psg"), "Rel 50": _h(8, "psg"), "Rel 45": _h(2, "psg")},
}


def test_total_dan_peringatan():
    k = _jalan({"baris": FIXTURE["baris"], "hasil": HASIL})
    assert len(k["item"]) == 34 and k["galat"] == []
    tot = {(t["kategori"], t["satuan"]): t["jumlah"] for t in k["total"]}
    assert tot[("sekrup", "pcs")] == 1320 and tot[("hpl", "lembar")] == 18


def test_rekon_kelompok():
    k = _jalan({"baris": FIXTURE["baris"], "hasil": HASIL})
    r = {x["kelompok"]: x for x in k["rekon"]}
    assert r["Papan 18 mm"]["real"] == 25 and r["Papan 18 mm"]["estimasi"] == 28
    assert r["Papan 18 mm"]["status"] == "lebih" and r["Papan 18 mm"]["selisih"] == -3     # real - estimasi
    assert r["Papan 6 mm"]["real"] == 13 and r["Papan 6 mm"]["status"] == "kurang"
    assert r["Papan 9 mm"]["status"] == "baru" and r["Papan 9 mm"]["real"] == 3
    assert r["Engsel"]["real"] == 20 and r["Engsel"]["estimasi"] == 20 and r["Engsel"]["status"] == "cocok"
    assert r["Rel"]["real"] == 10 and r["Rel"]["status"] == "cocok"
    assert r["HPL"]["real"] == 18 and r["HPL"]["estimasi"] == 6
    assert r["Ventilasi"]["real"] == 3 and r["Ventilasi"]["estimasi"] is None
    assert r["Sekrup"]["real"] == 1320 and r["Sekrup"]["estimasi"] == 180


def test_amplas_satuan_berbeda_tidak_dikonversi():
    k = _jalan({"baris": FIXTURE["baris"], "hasil": HASIL})
    a = {x["kelompok"]: x for x in k["rekon"]}["Amplas"]
    assert a["real"] == 8 and a["estimasi"] is None


def test_basis_pembelian_tidak_setara():
    k = _jalan({"baris": FIXTURE["baris"], "hasil": HASIL, "basis": "pembelian"})
    r = {x["kelompok"]: x for x in k["rekon"]}["Papan 18 mm"]
    assert r["comparable"] == "tidak" and r["selisih"] is None and r["selisih_persen"] is None


def test_baris_salah_format_dilaporkan_bukan_diabaikan():
    k = _jalan({"baris": [["X1", "ngawur"], ["X2", "pvc 18 : 7 lembar"]], "hasil": {}})
    assert len(k["galat"]) == 1 and k["galat"][0]["baris"] == "X1"
    assert [i["kunci"] for i in k["item"]] == ["PVC_18"]


def test_estimasi_nol_persen_none():
    k = _jalan({"baris": [["A", "hanger : 2 pcs"]], "hasil": {"standar": {"hanger": _h(0, "pcs")}}, "basis": "pemakaian_bersih"})
    r = k["rekon"][0]
    assert r["real"] == 2 and r["selisih"] == 2 and r["selisih_persen"] is None
