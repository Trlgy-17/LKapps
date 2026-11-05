"""Alat PDF (PyMuPDF). Dipanggil oleh antrean pekerjaan web sebagai subproses.

    python pdf_tools.py proses <input.pdf> <folder_keluar>

Keluaran (stdout), satu objek JSON per baris:
    {"jenis": "info", "halaman": N}
    {"jenis": "halaman", "nomor": i, "lebar": px, "tinggi": px, "thumb": "thumb_i.png", "besar": "besar_i.png"}
    {"jenis": "selesai", "halaman": N}
Gagal: kode keluar 1 dan satu baris {"jenis": "galat", "pesan": "..."}.
Tidak ada AI di sini: hanya render.
"""
from __future__ import annotations

import json
import os
import sys

LEBAR_THUMB = 240
LEBAR_BESAR = 1600
MAKS_HALAMAN = 200


def kirim(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def render_lebar(halaman, lebar_target: int, path: str) -> tuple[int, int]:
    import pymupdf

    skala = lebar_target / halaman.rect.width
    pix = halaman.get_pixmap(matrix=pymupdf.Matrix(skala, skala), alpha=False)
    pix.save(path)
    return pix.width, pix.height


def proses(sumber: str, keluar: str) -> int:
    import pymupdf

    os.makedirs(keluar, exist_ok=True)
    try:
        dok = pymupdf.open(sumber)
    except Exception as e:  # PDF rusak / bukan PDF
        kirim({"jenis": "galat", "pesan": f"File tidak bisa dibuka sebagai PDF: {e}"})
        return 1
    with dok:
        if dok.needs_pass:
            kirim({"jenis": "galat", "pesan": "PDF terkunci kata sandi."})
            return 1
        n = dok.page_count
        if n == 0:
            kirim({"jenis": "galat", "pesan": "PDF tidak punya halaman."})
            return 1
        if n > MAKS_HALAMAN:
            kirim({"jenis": "galat", "pesan": f"PDF {n} halaman, batas {MAKS_HALAMAN}."})
            return 1
        kirim({"jenis": "info", "halaman": n})
        for i in range(n):
            h = dok[i]
            render_lebar(h, LEBAR_THUMB, os.path.join(keluar, f"thumb_{i + 1}.png"))
            w, t = render_lebar(h, LEBAR_BESAR, os.path.join(keluar, f"besar_{i + 1}.png"))
            kirim({
                "jenis": "halaman", "nomor": i + 1, "lebar": w, "tinggi": t,
                "thumb": f"thumb_{i + 1}.png", "besar": f"besar_{i + 1}.png",
            })
        kirim({"jenis": "selesai", "halaman": n})
    return 0


def main(argv: list[str]) -> int:
    if len(argv) == 4 and argv[1] == "proses":
        return proses(argv[2], argv[3])
    sys.stderr.write("pemakaian: pdf_tools.py proses <input.pdf> <folder_keluar>\n")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
