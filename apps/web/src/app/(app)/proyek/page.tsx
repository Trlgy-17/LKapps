import Link from "next/link";
import { ambilDb } from "@/db";
import { STATUS_PROYEK } from "@/db/schema";
import { boleh } from "@/lib/permissions";
import { daftarProyek } from "@/lib/proyek";
import { wajibMasuk } from "@/lib/sesi";

const NAMA_STATUS: Record<(typeof STATUS_PROYEK)[number], { teks: string; kelas: string }> = {
  draf: { teks: "Draf", kelas: "neutral" },
  review: { teks: "Review", kelas: "warn" },
  disetujui: { teks: "Disetujui", kelas: "info" },
  belanja: { teks: "Belanja", kelas: "warn" },
  selesai: { teks: "Selesai", kelas: "info" },
};

function tanggalId(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function DaftarProyek() {
  const p = await wajibMasuk("proyek.baca");
  const db = await ambilDb();
  const daftar = await daftarProyek(db, p.workspaceId);
  const hitung = (s: (typeof STATUS_PROYEK)[number]) => daftar.filter((x) => x.status === s).length;

  return (
    <>
      <div className="kepala">
        <h1>Daftar Proyek</h1>
        {boleh(p.peran, "proyek.ubah") && <Link href="/proyek/baru" className="tombol">Proyek baru</Link>}
      </div>

      <div className="ringkasan">
        <div className="kartu"><div className="angka">{daftar.length}</div><div className="muted">Semua proyek</div></div>
        <div className="kartu"><div className="angka">{hitung("draf")}</div><div className="muted">Draf</div></div>
        <div className="kartu"><div className="angka">{hitung("review")}</div><div className="muted">Review</div></div>
        <div className="kartu"><div className="angka">{hitung("selesai")}</div><div className="muted">Selesai</div></div>
      </div>

      <div className="kartu bungkus-tabel">
        <table>
          <thead>
            <tr>
              <th>Klien</th><th>Pekerjaan</th><th>Tanggal gambar</th>
              <th>Papan</th><th>HPL</th><th>Konfirmasi</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {daftar.length === 0 && (
              <tr><td colSpan={7} className="kosong">Belum ada proyek. Unggah PDF lembar kerja untuk memulai.</td></tr>
            )}
            {daftar.map((x) => (
              <tr key={x.id}>
                <td><Link href={`/proyek/${x.id}/hasil`}>{x.klien || "(klien belum diisi)"}</Link></td>
                <td>{x.pekerjaan || "-"}</td>
                <td className="mono">{tanggalId(x.tanggalGambar)}</td>
                {/* Papan, HPL, dan konfirmasi terisi setelah mesin hitung tersambung (Tahap 6) */}
                <td className="angka">-</td><td className="angka">-</td><td className="angka">-</td>
                <td><span className={`chip ${NAMA_STATUS[x.status].kelas}`}>{NAMA_STATUS[x.status].teks}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
