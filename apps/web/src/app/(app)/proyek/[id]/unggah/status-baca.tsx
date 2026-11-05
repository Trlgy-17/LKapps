"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = {
  status: "diunggah" | "membaca" | "selesai" | "gagal";
  galat: string | null;
  namaFile: string;
  ukuranByte: number;
  totalHalaman: number | null;
  halamanGagal?: number[];
  tahap: "render" | "baca";
  halamanDibaca: number;
  halaman: { nomor: number; lebar: number; tinggi: number }[];
  lembarKerjaId: string;
};

const NAMA: Record<Status["status"], { teks: string; kelas: string }> = {
  diunggah: { teks: "Menunggu dibaca", kelas: "neutral" },
  membaca: { teks: "Membaca", kelas: "warn" },
  selesai: { teks: "Selesai", kelas: "info" },
  gagal: { teks: "Gagal", kelas: "strong" },
};

function mb(b: number) {
  return (b / 1048576).toFixed(1).replace(".", ",");
}

export function StatusBaca({
  proyekId, awal, cobaLagi, bolehUbah,
}: {
  proyekId: string;
  awal: Status;
  cobaLagi: () => Promise<void>;
  bolehUbah: boolean;
}) {
  const [s, setS] = useState<Status>(awal);
  const [zoom, setZoom] = useState<{ nomor: number; skala: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  // Hasil estimasi keluar otomatis: setelah pembacaan selesai, langsung buka halaman Hasil.
  useEffect(() => {
    if (s.status !== "selesai") return;
    const t = setTimeout(() => router.push(`/proyek/${proyekId}/hasil`), 1200);
    return () => clearTimeout(t);
  }, [s.status, proyekId, router]);

  useEffect(() => {
    if (s.status === "selesai" || s.status === "gagal") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/proyek/${proyekId}/status`, { cache: "no-store" });
      if (r.ok) setS(await r.json());
    }, 1500);
    return () => clearInterval(t);
  }, [proyekId, s.status]);

  useEffect(() => {
    if (zoom) dialog.current?.showModal();
    else dialog.current?.close();
  }, [zoom]);

  const total = s.totalHalaman ?? 0;
  const sedangBaca = s.tahap === "baca";
  const baca = sedangBaca ? s.halamanDibaca : s.halaman.length;

  return (
    <section aria-label="Hasil unggah dan pembacaan PDF">
      <div className="kartu">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong>{s.namaFile}</strong>
            <div className="muted"><span className="mono">{mb(s.ukuranByte)}</span> MB{total ? <> · <span className="mono">{total}</span> halaman</> : null}</div>
          </div>
          <span className={`chip ${NAMA[s.status].kelas}`}>{NAMA[s.status].teks}</span>
        </div>
        {(s.status === "membaca" || s.status === "diunggah") && (
          <div style={{ marginTop: 12 }}>
            <progress value={baca} max={total || 1} aria-label="Progres pembacaan halaman" style={{ width: "100%" }} />
            <div className="muted" role="status">
              {sedangBaca ? "Membaca isi gambar: halaman " : "Menyiapkan halaman "}
              <span className="mono">{baca}</span>{total ? <> dari <span className="mono">{total}</span></> : null}
            </div>
          </div>
        )}
        {s.status === "gagal" && (
          <div style={{ marginTop: 12 }}>
            <div className="galat" role="alert">{s.galat ?? "Pembacaan gagal."}</div>
            {bolehUbah && (
              <form action={async () => { await cobaLagi(); setS({ ...s, status: "membaca", galat: null }); }}>
                <button className="tombol sekunder">Coba lagi</button>
              </form>
            )}
          </div>
        )}
      </div>

      {s.halaman.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
          {s.halaman.map((h) => (
            <li key={h.nomor} className="kartu" style={{ padding: 8 }}>
              <button
                type="button"
                onClick={() => setZoom({ nomor: h.nomor, skala: 1 })}
                aria-label={`Buka halaman ${h.nomor} dengan zoom`}
                style={{ all: "unset", cursor: "zoom-in", display: "block", minHeight: 44, width: "100%" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/halaman/${s.lembarKerjaId}/${h.nomor}`}
                  alt={`Halaman ${h.nomor} lembar kerja`}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </button>
              <div className="muted" style={{ textAlign: "center" }}>Halaman <span className="mono">{h.nomor}</span></div>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialog}
        onClose={() => setZoom(null)}
        aria-label="Halaman lembar kerja diperbesar"
        style={{ width: "min(96vw, 1200px)", maxHeight: "92vh", padding: 12, border: "1px solid var(--color-line)", borderRadius: 10 }}
      >
        {zoom && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>Halaman {zoom.nomor}</strong>
              <button type="button" className="tombol sekunder" onClick={() => setZoom({ ...zoom, skala: Math.max(0.5, zoom.skala - 0.5) })} aria-label="Perkecil">−</button>
              <span className="mono">{Math.round(zoom.skala * 100)}%</span>
              <button type="button" className="tombol sekunder" onClick={() => setZoom({ ...zoom, skala: Math.min(3, zoom.skala + 0.5) })} aria-label="Perbesar">+</button>
              <button type="button" className="tombol" style={{ marginLeft: "auto" }} onClick={() => setZoom(null)}>Tutup</button>
            </div>
            <div style={{ overflow: "auto", maxHeight: "78vh" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/halaman/${s.lembarKerjaId}/${zoom.nomor}?u=besar`}
                alt={`Halaman ${zoom.nomor} lembar kerja, ukuran besar`}
                style={{ width: `${zoom.skala * 100}%`, maxWidth: "none", height: "auto", display: "block" }}
              />
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
