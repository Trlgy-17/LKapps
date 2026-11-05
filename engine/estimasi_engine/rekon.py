"""Rekonsiliasi data real terhadap hasil estimasi (SYSTEM_PROMPT §16), tingkat kelompok.

Estimasi per meter belum menurunkan SKU yang sama dengan daftar real (mis. Multi min 18 vs Multi double 18),
sehingga perbandingan dilakukan per KELOMPOK dan diberi catatan. Satuan berbeda tidak dibandingkan.
Selisih = real - estimasi; persen None bila estimasi 0 atau tidak ada.
"""
from __future__ import annotations

import json
import sys
from decimal import Decimal

from .data_real import BASIS, gabung, parse_baris, total_per_kategori_satuan
from .validasi import keterbandingan

# (nama kelompok, satuan, predikat kunci real, kunci estimasi [(grup, kunci)], catatan)
KELOMPOK = [
    ("Papan 18 mm", "lembar", lambda k: k.endswith("_18") and k.split("_")[0] in ("MULTIPLEKS", "BLOCKBOARD", "PVC"),
     [("standar", "material_18")], "Estimasi per meter belum memisahkan Multi min, Multi double, BB, dan PVC"),
    ("Papan 6 mm", "lembar", lambda k: k.endswith("_6") and k.split("_")[0] in ("MULTIPLEKS", "BLOCKBOARD", "PVC"),
     [("standar", "material_6")], "Estimasi per meter belum memisahkan jenis bahan"),
    ("Papan 9 mm", "lembar", lambda k: k.endswith("_9") and k.split("_")[0] in ("MULTIPLEKS", "BLOCKBOARD", "PVC"),
     [], "Belum ada aturan estimasi untuk tebal 9 mm (dudukan top, lis tepi)"),
    ("HPL", "lembar", lambda k: k.startswith("HPL"), [("standar", "hpl_pintu")],
     "Estimasi baru memuat muka pintu; badan, top, backsplash belum dihitung"),
    ("AICA", "lembar", lambda k: k.startswith("AICA"), [("standar", "aica")], ""),
    ("Engsel", "psg", lambda k: k.startswith("ENGSEL"),
     [("hardware", "engsel"), ("hardware", "engsel_full_tekuk"), ("hardware", "engsel_robot")], ""),
    ("Rel", "psg", lambda k: k.startswith("REL_"), [("hardware", "Rel 50"), ("hardware", "Rel 45")], ""),
    ("Hidrolik", "psg", lambda k: k.startswith("HIDROLIK"), [("hardware", "hidrolik")], ""),
    ("Ventilasi", "psg", lambda k: k.startswith("VENTILASI"), [("hardware", "ventilasi")], ""),
    ("Sekrup", "pcs", lambda k: k.startswith("SEKRUP_"),
     [("standar", "sekrup_5cm"), ("standar", "sekrup_4cm"), ("standar", "sekrup_3cm"), ("standar", "sekrup_5_8_standar")],
     "Ringkasan lintas SKU: ukuran sekrup real (GP 3, GP 5, 5/8, 7) tidak sama dengan ukuran estimasi (5, 4, 3 cm, 5/8)"),
    ("Silen", "pcs", lambda k: k.startswith("SILEN"), [("standar", "silen")], ""),
    ("Hanger", "pcs", lambda k: k.startswith("HANGER"), [("standar", "hanger")], ""),
    ("Handle", "pcs", lambda k: k.startswith("HANDLE"), [("standar", "handle")], ""),
    ("LED strip", "roll", lambda k: k.startswith("LED_STRIP"), [("standar", "led_strip")], ""),
    ("Amplas", "m", lambda k: k.startswith("AMPLAS"), [],
     "Estimasi amplas dalam lembar, real dalam meter: satuan berbeda tidak dikonversi"),
]


def rekonsiliasi(item: list[dict], hasil: dict, basis: str) -> list[dict]:
    comparable = keterbandingan(basis)
    keluar = []
    terpakai: set[str] = set()
    for nama, satuan, pred, kunci_est, catatan in KELOMPOK:
        real_item = [i for i in item if pred(i["kunci"])]
        terpakai.update(i["kunci"] for i in real_item)
        real_cocok = [i for i in real_item if i["satuan"] == satuan and i["jumlah"] is not None]
        beda_satuan = [i for i in real_item if i["satuan"] != satuan]
        real = sum((Decimal(str(i["jumlah"])) for i in real_cocok), Decimal(0)) if real_cocok else None
        ada = [hasil.get(g, {}).get(k) for g, k in kunci_est]
        ada = [a for a in ada if a]
        est = sum((Decimal(a["jumlah"]) for a in ada if a["satuan"] == satuan), Decimal(0)) if ada else None
        if real is None and not beda_satuan:
            continue
        c = list(filter(None, [catatan]))
        if beda_satuan:
            c.append("Satuan real berbeda dari estimasi: " + ", ".join(f"{i['kunci']} ({i['satuan']})" for i in beda_satuan))
        if real is None:
            status, selisih, persen = "baru", None, None
        elif est is None:
            status, selisih, persen = "baru", None, None
        else:
            status = "cocok" if est == real else ("kurang" if est < real else "lebih")
            aritm = real - est
            selisih = None if comparable == "tidak" else aritm
            persen = (aritm / est * 100) if (selisih is not None and est > 0) else None
        keluar.append({
            "kelompok": nama, "satuan": satuan,
            "real": None if real is None else float(real), "estimasi": None if est is None else float(est),
            "status": status, "selisih": None if selisih is None else float(selisih),
            "selisih_persen": None if persen is None else float(round(persen, 2)),
            "comparable": comparable, "catatan": c,
        })
    sisa = sorted(i["kunci"] for i in item if i["kunci"] not in terpakai)
    if sisa:
        keluar.append({
            "kelompok": "Item lain (belum ada estimasi)", "satuan": "-", "real": None, "estimasi": None,
            "status": "baru", "selisih": None, "selisih_persen": None, "comparable": comparable,
            "catatan": [", ".join(sisa)],
        })
    return keluar


def jalankan(masuk: dict) -> dict:
    basis = masuk.get("basis", "real_belum_dijelaskan")
    if basis not in BASIS:
        raise ValueError(f"basis tidak dikenal: {basis}")
    baris, galat = [], []
    for i, (rid, teks) in enumerate(masuk.get("baris", [])):
        try:
            baris.append(parse_baris(str(rid), teks, sumber=masuk.get("sumber"), basis=basis))
        except ValueError as e:
            galat.append({"baris": rid, "teks": teks, "pesan": str(e)})
    g = gabung(baris)
    item = [
        {"kunci": x.kunci, "nama": x.nama, "kategori": x.kategori, "satuan": x.satuan, "basis": x.basis,
         "jumlah": None if x.jumlah is None else float(x.jumlah), "raw_row_ids": list(x.raw_row_ids)}
        for x in g.item
    ]
    total = [
        {"kategori": k, "satuan": s, "jumlah": float(v)} for (k, s), v in sorted(total_per_kategori_satuan(g.item).items(), key=lambda kv: (kv[0][0], str(kv[0][1])))
    ]
    return {
        "item": item, "total": total, "peringatan": list(g.peringatan), "galat": galat,
        "rekon": rekonsiliasi(item, masuk.get("hasil", {}), basis),
    }


def main() -> int:
    try:
        keluar = jalankan(json.load(sys.stdin))
    except Exception as ex:
        sys.stdout.write(json.dumps({"galat_fatal": f"{type(ex).__name__}: {ex}"}, ensure_ascii=False))
        return 1
    sys.stdout.write(json.dumps(keluar, ensure_ascii=False))
    return 0
