"""Rumus sekrup — PRD §6.4. Semua rumus berstatus PERKIRAAN (dikalibrasi dari satu proyek).

Antarmuka (usulan, belum ada implementasi):
    sekrup_5_8(jumlah_engsel: int, pasang_rel: int) -> Hasil
    sekrup_7_fisher(meter_kabinet_gantung: int) -> Hasil
    gp(titik_sambungan: int) -> HasilGP  (.total, .gp3, .gp5, .status, .rumus)
Hasil punya: .jumlah (int), .satuan, .status (Status), .rumus (str).
"""
import pytest

from estimasi_engine.status import Status
from estimasi_engine.screws import sekrup_5_8, sekrup_7_fisher, gp


# --- Sekrup 5/8 = engsel x 4 + pasang rel x 14 -------------------------------
def test_sekrup_5_8_rumus():
    # 10 x 4 + 4 x 14 = 40 + 56 = 96
    h = sekrup_5_8(jumlah_engsel=10, pasang_rel=4)
    assert h.jumlah == 96
    assert h.satuan == "pcs"


def test_sekrup_5_8_hanya_engsel_dan_hanya_rel():
    assert sekrup_5_8(jumlah_engsel=1, pasang_rel=0).jumlah == 4
    assert sekrup_5_8(jumlah_engsel=0, pasang_rel=1).jumlah == 14


def test_sekrup_5_8_status_perkiraan_dan_rumus_tertulis():
    h = sekrup_5_8(jumlah_engsel=10, pasang_rel=4)
    assert h.status is Status.PERKIRAAN
    assert "4" in h.rumus and "14" in h.rumus


@pytest.mark.skip(reason="Butuh jumlah engsel dan pasang rel Septi (PLAN P2). Target: 300 pcs.")
def test_sekrup_5_8_septi_300():
    ...


# --- Sekrup 7 dan fisher = meter kabinet gantung x 3 -------------------------
def test_sekrup_7_fisher_rumus():
    # 10 x 3 = 30
    h = sekrup_7_fisher(meter_kabinet_gantung=10)
    assert h.jumlah == 30
    assert h.status is Status.PERKIRAAN


@pytest.mark.skip(reason="Butuh meter kabinet gantung Septi dan aturan pembulatan (PLAN P2, P3). Target: 20 pcs.")
def test_sekrup_7_fisher_septi_20():
    ...


# --- GP 3 + GP 5 = titik sambungan x 1,3, dibagi 1 : 1 -----------------------
def test_gp_rumus_dibagi_sama():
    # 100 x 1,3 = 130 -> GP 3 = 65, GP 5 = 65
    h = gp(titik_sambungan=100)
    assert h.total == 130
    assert (h.gp3, h.gp5) == (65, 65)
    assert h.status is Status.PERKIRAAN


def test_gp_septi_1002():
    # PRD §6.4: hasil Septi 1.002 pcs. Titik sambungan Septi tidak tertulis di PRD;
    # 771 x 1,3 = 1002,3 -> 1.002 adalah turunan, bukan data. Konfirmasi di PLAN P3.
    h = gp(titik_sambungan=771)
    assert h.total == 1002
    assert (h.gp3, h.gp5) == (501, 501)


# --- Minimum proyek kecil ----------------------------------------------------
@pytest.mark.skip(reason="Makna 'minimum 500 pcs total' dan batas proyek kecil belum jelas (PLAN P4).")
def test_minimum_proyek_kecil_500():
    ...
