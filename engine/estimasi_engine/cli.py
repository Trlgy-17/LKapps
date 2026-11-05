"""Antarmuka JSON untuk web: baca satu objek JSON dari stdin, tulis satu objek JSON ke stdout.

Masukan (semua opsional; null/absen = belum diketahui, BUKAN nol):
{
  "ruleset_versi": "1",
  "parts": [{"id","bahan","panjang","lebar","serat","status_ukuran"}],
  "hpl": ["nama bahan HPL", ...],
  "pintu": [{"unit_id","jenis"}] | null,
  "unit_tarik": [{"unit_id","jenis"}] | null,
  "jumlah_sudut_robot": int | null,
  "meter_kabinet": "3.5" | null, "meter_kitchen": "..." | null, "meter_kabinet_gantung": "..." | null,
  "jumlah_lemari": int | null, "tinggi_standar": bool, "aica_panjang_mm": "3330" | null, "aica_kedalaman_mm": "600" | null, "titik_sambungan": int | null,
  "pintu_bawah_asumsi": int, "pintu_atas_asumsi": int, "tinggi_pintu_mm": int
}
Deterministik: masukan sama -> keluaran sama.
"""
from __future__ import annotations

import json
import sys
from decimal import Decimal

from .hardware import Pintu, UnitTarik
from .komponen import Komponen
from .nesting import Part
from .ruleset import MasukanEstimasi, RuleSet, hitung
from .status import Hasil


def _hasil(h: Hasil) -> dict:
    return {
        "jumlah": h.jumlah, "satuan": h.satuan, "status": h.status.value, "rumus": h.rumus,
        "perlu_konfirmasi": h.perlu_konfirmasi, "asal_bukti": h.asal_bukti, "sumber": h.sumber,
    }


def _daftar(d: dict[str, Hasil]) -> dict:
    return {k: _hasil(v) for k, v in sorted(d.items())}


def jalankan(masuk: dict) -> dict:
    parts = [
        Part(p["id"], p["bahan"], Decimal(str(p["panjang"])), Decimal(str(p["lebar"])),
             p.get("serat", "bebas"), p.get("status_ukuran", "gambar"))
        for p in masuk.get("parts", [])
    ]
    pintu = None if masuk.get("pintu") is None else [Pintu(x["unit_id"], x["jenis"]) for x in masuk["pintu"]]
    tarik = None if masuk.get("unit_tarik") is None else [UnitTarik(x["unit_id"], x["jenis"]) for x in masuk["unit_tarik"]]
    m = MasukanEstimasi(
        parts=parts,
        hpl=frozenset(masuk.get("hpl", [])),
        pintu=pintu,
        unit_tarik=tarik,
        jumlah_sudut_robot=masuk.get("jumlah_sudut_robot"),
        meter_kabinet_gantung=masuk.get("meter_kabinet_gantung"),
        titik_sambungan=masuk.get("titik_sambungan"),
        meter_kabinet=masuk.get("meter_kabinet"),
        meter_kitchen=masuk.get("meter_kitchen"),
        jumlah_lemari=masuk.get("jumlah_lemari"),
        tinggi_standar=masuk.get("tinggi_standar", True),
        pintu_bawah_asumsi=masuk.get("pintu_bawah_asumsi", 0),
        pintu_atas_asumsi=masuk.get("pintu_atas_asumsi", 0),
        tinggi_pintu_mm=masuk.get("tinggi_pintu_mm", 700),
        komponen=[Komponen(**k) for k in masuk["komponen"]] if masuk.get("komponen") else None,
        kode_hpl_bawaan=masuk.get("kode_hpl_bawaan"),
        hpl_pintu=bool(masuk.get("hpl_pintu", False)),
        meter_per_bahan=masuk.get("meter_per_bahan"),
        aica_panjang_mm=masuk.get("aica_panjang_mm"),
        aica_kedalaman_mm=masuk.get("aica_kedalaman_mm"),
    )
    e = hitung(m, RuleSet(str(masuk.get("ruleset_versi", "?"))))
    return {
        "versi_ruleset": e.versi_ruleset,
        "standar": _daftar(e.standar),
        "hardware": _daftar(e.hardware),
        "sekrup": _daftar(e.sekrup),
        "pintu_asumsi": _daftar(e.pintu_asumsi),
        "lembar_per_bahan": dict(sorted(e.lembar_per_bahan.items())),
        "komponen": e.komponen,
    }


def main() -> int:
    try:
        keluar = jalankan(json.load(sys.stdin))
    except Exception as ex:  # galat masukan ditampilkan apa adanya
        sys.stdout.write(json.dumps({"galat": f"{type(ex).__name__}: {ex}"}, ensure_ascii=False))
        return 1
    sys.stdout.write(json.dumps(keluar, ensure_ascii=False, sort_keys=True))
    return 0
