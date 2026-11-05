"""Aturan 2: input dan versi aturan sama -> angka sama (PRD §6, §10)."""
import random

from estimasi_engine.nesting import Part, nest


def _parts():
    rng = random.Random(7)
    return [
        Part(id=f"p{i}", bahan="Multi min 18",
             panjang=rng.randrange(100, 2400, 5), lebar=rng.randrange(100, 1200, 5), serat="bebas")
        for i in range(40)
    ]


def _ringkas(r):
    return [
        (lb.nomor, [(p.part_id, p.x, p.y, p.w, p.h, p.diputar) for p in lb.penempatan])
        for lb in r.lembar
    ]


def test_jalan_berulang_hasil_identik():
    parts = _parts()
    pertama = _ringkas(nest(parts))
    for _ in range(20):
        assert _ringkas(nest(parts)) == pertama


def test_urutan_input_tidak_mengubah_hasil():
    parts = _parts()
    acuan = _ringkas(nest(parts))
    rng = random.Random(99)
    for _ in range(10):
        acak = parts[:]
        rng.shuffle(acak)
        assert _ringkas(nest(acak)) == acuan
