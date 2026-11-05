import json
import subprocess
import sys
from pathlib import Path

import pymupdf

RAIZ = Path(__file__).resolve().parent.parent
ALAT = RAIZ / "pdf_tools.py"


def _pdf(path: Path, halaman: int):
    d = pymupdf.open()
    for i in range(halaman):
        p = d.new_page(width=842, height=595)
        p.insert_text((50, 50), f"Halaman {i + 1}")
    d.save(path)


def _jalan(*args):
    return subprocess.run([sys.executable, str(ALAT), *args], capture_output=True, text=True)


def test_proses_17_halaman(tmp_path):
    pdf = tmp_path / "septi.pdf"
    _pdf(pdf, 17)
    r = _jalan("proses", str(pdf), str(tmp_path / "out"))
    assert r.returncode == 0
    baris = [json.loads(x) for x in r.stdout.splitlines()]
    assert baris[0] == {"jenis": "info", "halaman": 17}
    assert [b["nomor"] for b in baris if b["jenis"] == "halaman"] == list(range(1, 18))
    assert baris[-1] == {"jenis": "selesai", "halaman": 17}
    for i in (1, 17):
        assert (tmp_path / "out" / f"thumb_{i}.png").stat().st_size > 0
        assert (tmp_path / "out" / f"besar_{i}.png").stat().st_size > 0


def test_bukan_pdf_gagal_dengan_pesan(tmp_path):
    f = tmp_path / "x.pdf"
    f.write_text("bukan pdf")
    r = _jalan("proses", str(f), str(tmp_path / "out"))
    assert r.returncode == 1
    assert json.loads(r.stdout.splitlines()[-1])["jenis"] == "galat"
