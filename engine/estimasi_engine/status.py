"""Status angka (PRD §6.5) dan objek hasil."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Status(str, Enum):
    GAMBAR = "gambar"
    SKALA = "skala"
    ASUMSI = "asumsi"
    TERKALIBRASI = "terkalibrasi"
    PERKIRAAN = "perkiraan"


# Asal bukti (SYSTEM_PROMPT §17) diturunkan dari status tampilan PRD §6.5.
# user_confirmed hanya untuk data yang dinyatakan pengguna (mis. data real), bukan hasil hitung.
ASAL_BUKTI = {
    Status.GAMBAR: "document_stated",
    Status.SKALA: "calculated",
    Status.ASUMSI: "assumed",
    Status.TERKALIBRASI: "calculated",
    Status.PERKIRAAN: "assumed",
}


@dataclass(frozen=True)
class Hasil:
    """Satu angka hasil hitung: selalu membawa satuan, status, dan rumus."""
    jumlah: int
    satuan: str
    status: Status
    rumus: str
    perlu_konfirmasi: bool = False
    sumber: str | None = None            # sumber koefisien (SOP/katalog) bila ada
    asal_override: str | None = None     # mis. catalog_stated untuk koefisien SOP dari pengguna

    @property
    def asal_bukti(self) -> str:
        return self.asal_override or ASAL_BUKTI[self.status]
