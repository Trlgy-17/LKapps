"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BATAS = 50 * 1024 * 1024;

type Keadaan =
  | { s: "kosong" }
  | { s: "mengunggah"; nama: string; persen: number }
  | { s: "gagal"; pesan: string };

export function UnggahForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [k, setK] = useState<Keadaan>({ s: "kosong" });

  function kirim(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) return setK({ s: "gagal", pesan: "File harus berformat PDF." });
    if (file.size > BATAS) return setK({ s: "gagal", pesan: "File melebihi batas 50 MB." });
    setK({ s: "mengunggah", nama: file.name, persen: 0 });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/proyek");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setK({ s: "mengunggah", nama: file.name, persen: Math.round((e.loaded / e.total) * 100) });
    };
    xhr.onload = () => {
      let isi: { id?: string; galat?: string } = {};
      try { isi = JSON.parse(xhr.responseText); } catch { /* respons bukan JSON */ }
      if (xhr.status === 200 && isi.id) router.push(`/proyek/${isi.id}/unggah`);
      else setK({ s: "gagal", pesan: isi.galat ?? "Unggah gagal. Coba lagi." });
    };
    xhr.onerror = () => setK({ s: "gagal", pesan: "Koneksi terputus saat mengunggah. Coba lagi." });
    const f = new FormData();
    f.append("file", file);
    xhr.send(f);
  }

  return (
    <div className="kartu">
      {k.s === "gagal" && <div className="galat" role="alert">{k.pesan}</div>}
      {k.s === "mengunggah" ? (
        <div>
          <div>{k.nama}</div>
          <progress value={k.persen} max={100} aria-label="Progres unggah" style={{ width: "100%" }} />
          <div className="muted">Mengunggah {k.persen}%</div>
        </div>
      ) : (
        <div
          style={{ border: "1.5px dashed var(--color-border-input)", borderRadius: 10, padding: 40, textAlign: "center" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) kirim(f);
          }}
        >
          <p><strong>Tarik PDF lembar kerja ke sini</strong></p>
          <p className="muted">Hanya PDF, maksimal 50 MB.</p>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            aria-label="Pilih file PDF"
            onChange={(e) => e.target.files?.[0] && kirim(e.target.files[0])}
          />
          <button type="button" className="tombol sekunder" onClick={() => input.current?.click()}>Pilih file PDF</button>
        </div>
      )}
    </div>
  );
}
