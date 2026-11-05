import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def _jalan(masuk):
    r = subprocess.run([sys.executable, str(RAIZ / "run_estimasi.py")], input=json.dumps(masuk),
                       capture_output=True, text=True, cwd=RAIZ)
    return r.returncode, json.loads(r.stdout)


def test_cli_hitung_dan_deterministik():
    masuk = {
        "ruleset_versi": "7",
        "meter_kabinet": "3", "meter_kitchen": "4", "jumlah_lemari": 1,
        "pintu": [{"unit_id": "K1", "jenis": "lurus"}, {"unit_id": "K1", "jenis": "sink"}],
        "unit_tarik": [{"unit_id": "K1", "jenis": "kabinet"}],
        "pintu_bawah_asumsi": 2,
    }
    k1, a = _jalan(masuk)
    k2, b = _jalan(masuk)
    assert k1 == 0 and a == b
    assert a["versi_ruleset"] == "7"
    assert a["standar"]["material_18"]["jumlah"] == 6
    assert a["standar"]["material_18"]["status"] == "asumsi"
    assert a["hardware"]["engsel"]["jumlah"] == 2 and a["hardware"]["ventilasi"]["jumlah"] == 1
    assert a["sekrup"]["sekrup_5_8"]["jumlah"] == 2 * 4 + 1 * 14
    assert "gp3" not in a["sekrup"]                        # titik sambungan tidak diketahui -> tidak dihitung
    assert "sekrup_7_fisher" not in a["sekrup"]
    assert a["pintu_asumsi"]["pintu_bawah_teoritis"]["jumlah"] == 6


def test_cli_semua_tidak_diketahui_tidak_menghasilkan_nol():
    k, a = _jalan({})
    assert k == 0
    assert a["standar"] == {} and a["hardware"] == {} and a["sekrup"] == {}


def test_cli_galat_masukan():
    k, a = _jalan({"pintu": [{"unit_id": "x", "jenis": "ngawur"}]})
    assert k == 1 and "galat" in a
