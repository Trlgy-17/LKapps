"""Aturan hardware — PRD §6.3. Jumlah dihitung dari daftar pintu/unit; tiap hasil menyebut rumus.

Antarmuka (usulan):
    Pintu(unit_id, jenis)       jenis: "lurus" | "inset_lemari" | "sink" | "gas" | "rak_piring"
    UnitTarik(unit_id, jenis)   jenis: "kabinet" | "laci_lemari" | "laci_atas_kabinet_bawah"
    engsel(pintu) -> dict[str, Hasil]      kunci: "engsel", "engsel_full_tekuk"
    engsel_robot(jumlah_sudut) -> Hasil
    rel(unit_tarik) -> dict[str, Hasil]    kunci: "Rel 50", "Rel 45"
    hidrolik(pintu) -> Hasil
    ventilasi(pintu) -> Hasil
    rak_sendok(unit_tarik) -> Hasil
Hasil punya .jumlah, .satuan, .rumus, .perlu_konfirmasi (bool).
"""
from estimasi_engine.hardware import (
    Pintu, UnitTarik, engsel, engsel_robot, rel, hidrolik, ventilasi, rak_sendok,
)


def test_engsel_satu_pasang_per_pintu():
    pintu = [Pintu("K1", "lurus"), Pintu("K1", "lurus"), Pintu("K2", "lurus")]
    h = engsel(pintu)["engsel"]
    assert h.jumlah == 3
    assert h.satuan == "psg"
    assert h.rumus  # tidak kosong


def test_engsel_full_tekuk_untuk_pintu_inset_lemari_perlu_konfirmasi():
    pintu = [Pintu("L1", "inset_lemari"), Pintu("L1", "inset_lemari"), Pintu("K1", "lurus")]
    hasil = engsel(pintu)
    assert hasil["engsel_full_tekuk"].jumlah == 2
    assert hasil["engsel"].jumlah == 1
    assert hasil["engsel_full_tekuk"].perlu_konfirmasi is True  # PRD §6.3


def test_engsel_robot_satu_pasang_per_sudut():
    assert engsel_robot(jumlah_sudut=3).jumlah == 3


def test_rel_satu_pasang_per_unit_tarik_dengan_ukuran():
    unit = [
        UnitTarik("K1", "kabinet"),
        UnitTarik("K2", "kabinet"),
        UnitTarik("L1", "laci_lemari"),
    ]
    h = rel(unit)
    assert h["Rel 50"].jumlah == 2   # kabinet Rel 50 (Septi)
    assert h["Rel 45"].jumlah == 1   # laci lemari Rel 45 (Septi)
    assert h["Rel 50"].satuan == "psg"


def test_hidrolik_satu_pasang_untuk_pintu_rak_piring_perlu_konfirmasi():
    pintu = [Pintu("A1", "rak_piring"), Pintu("A2", "lurus")]
    h = hidrolik(pintu)
    assert h.jumlah == 1
    assert h.perlu_konfirmasi is True


def test_ventilasi_untuk_pintu_sink_dan_gas():
    pintu = [Pintu("B1", "sink"), Pintu("B2", "gas"), Pintu("B3", "lurus")]
    assert ventilasi(pintu).jumlah == 2


def test_rak_sendok_untuk_laci_atas_kabinet_bawah():
    unit = [
        UnitTarik("B1", "laci_atas_kabinet_bawah"),
        UnitTarik("B2", "kabinet"),
    ]
    assert rak_sendok(unit).jumlah == 1
