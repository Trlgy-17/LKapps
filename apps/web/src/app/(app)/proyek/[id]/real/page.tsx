import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ambilDb } from "@/db";
import { BASIS_REAL } from "@/db/schema";
import { formatAngka } from "@/lib/format";
import { boleh } from "@/lib/permissions";
import { ambilProyek } from "@/lib/proyek";
import { dataRealTerbaru, simpanDataReal, type HasilReal } from "@/lib/real";
import { wajibMasuk } from "@/lib/sesi";

const NAMA_BASIS: Record<(typeof BASIS_REAL)[number], string> = {
  real_belum_dijelaskan: "Belum dijelaskan",
  kebutuhan_disahkan: "Kebutuhan disahkan",
  pembelian: "Pembelian",
  keluar_gudang: "Keluar gudang",
  pemakaian_bersih: "Pemakaian bersih",
  retur: "Retur",
};
const CHIP: Record<string, { teks: string; kelas: string }> = {
  cocok: { teks: "Cocok", kelas: "info" }, kurang: { teks: "Kurang", kelas: "warn" },
  lebih: { teks: "Lebih", kelas: "neutral" }, baru: { teks: "Baru", kelas: "strong" },
};
const KETERBANDINGAN: Record<string, string> = { ya: "Setara", tidak: "Tidak setara basis", belum_jelas: "Basis belum jelas" };

async function bandingkan(formData: FormData) {
  "use server";
  const p = await wajibMasuk("real.input");
  const id = String(formData.get("id"));
  const basis = String(formData.get("basis")) as (typeof BASIS_REAL)[number];
  try {
    await simpanDataReal(await ambilDb(), { id: p.id, peran: p.peran }, p.workspaceId, id, String(formData.get("teks") ?? ""), basis);
  } catch {
    /* pesan galat ditampilkan lewat keadaan kosong; masukan tetap di kotak */
  }
  revalidatePath(`/proyek/${id}/real`);
}

const n = (v: number | null) => (v === null ? "—" : formatAngka(v));

export default async function DataReal({ params }: { params: Promise<{ id: string }> }) {
  const p = await wajibMasuk("proyek.baca");
  const { id } = await params;
  const db = await ambilDb();
  const pr = /^[0-9a-f-]{36}$/.test(id) ? await ambilProyek(db, p.workspaceId, id) : null;
  if (!pr) notFound();
  const d = await dataRealTerbaru(db, id);
  const h = d?.hasil as unknown as HasilReal | undefined;

  return (
    <>
      <div className="kepala">
        <div>
          <h1>Data Real</h1>
          <p className="muted">{pr.klien || "Klien belum diisi"} · selisih = real − estimasi</p>
        </div>
        <Link href={`/proyek/${id}/hasil`} className="tombol sekunder">Kembali ke hasil</Link>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {boleh(p.peran, "real.input") ? (
          <form action={bandingkan} className="kartu" style={{ flex: "1 1 340px" }}>
            <h2>Tempel data real</h2>
            <p className="muted">Satu baris satu item, contoh <span className="mono">multi min 18 : 11 lembar</span>.</p>
            <input type="hidden" name="id" value={id} />
            <label htmlFor="teks">Data real</label>
            <textarea id="teks" name="teks" rows={14} required defaultValue={d?.teks ?? ""} style={{ fontFamily: "var(--font-mono)" }} />
            <label htmlFor="basis" style={{ marginTop: 10 }}>Basis jumlah</label>
            <select id="basis" name="basis" defaultValue={d?.basis ?? "real_belum_dijelaskan"}>
              {BASIS_REAL.map((b) => <option key={b} value={b}>{NAMA_BASIS[b]}</option>)}
            </select>
            <button className="tombol" style={{ marginTop: 12 }}>Bandingkan</button>
          </form>
        ) : (
          <div className="kartu" style={{ flex: "1 1 340px" }}><p className="muted">Hanya kepala produksi dan admin yang menginput data real.</p></div>
        )}

        <div style={{ flex: "2 1 560px", minWidth: 0 }}>
          {!h && <div className="kartu"><p className="kosong">Belum ada data real. Tempel daftar lalu klik Bandingkan.</p></div>}
          {h && (
            <>
              {h.galat.length > 0 && (
                <div className="galat" role="alert">
                  {h.galat.length} baris tidak terbaca: {h.galat.map((g) => `"${g.teks}"`).join(", ")}
                </div>
              )}
              {h.peringatan.map((w, i) => <div key={i} className="galat" role="status">{w}</div>)}
              <h2>Selisih estimasi dan real</h2>
              <div className="kartu bungkus-tabel">
                <table>
                  <thead><tr><th>Kelompok</th><th style={{ textAlign: "right" }}>Estimasi</th><th style={{ textAlign: "right" }}>Real</th><th>Status</th><th>Alasan / catatan</th></tr></thead>
                  <tbody>
                    {h.rekon.map((r) => (
                      <tr key={r.kelompok}>
                        <td>{r.kelompok} <span className="muted">({r.satuan})</span></td>
                        <td className="angka">{n(r.estimasi)}</td>
                        <td className="angka">{n(r.real)}</td>
                        <td>
                          <span className={`chip ${CHIP[r.status].kelas}`}>{CHIP[r.status].teks}</span>
                          <div className="muted mono">{r.selisih === null ? "selisih —" : `selisih ${r.selisih > 0 ? "+" : ""}${formatAngka(r.selisih)}`}{r.selisih_persen !== null && ` (${formatAngka(r.selisih_persen, 1)}%)`}</div>
                          <div className="muted">{KETERBANDINGAN[r.comparable]}</div>
                        </td>
                        <td className="muted">{r.catatan.join(" · ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2 style={{ marginTop: 20 }}>Item real ternormalisasi ({h.item.length})</h2>
              <div className="kartu bungkus-tabel">
                <table>
                  <thead><tr><th>Item</th><th>Kunci</th><th style={{ textAlign: "right" }}>Jumlah</th><th>Baris asal</th></tr></thead>
                  <tbody>
                    {h.item.map((i) => (
                      <tr key={i.kunci + i.satuan}>
                        <td>{i.nama}</td><td className="mono">{i.kunci}</td>
                        <td className="angka">{n(i.jumlah)} <span className="muted">{i.satuan}</span></td>
                        <td className="muted">{i.raw_row_ids.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ marginTop: 12 }}>
                Subtotal hanya per satuan yang sama: {h.total.map((t) => `${t.kategori} ${formatAngka(t.jumlah)} ${t.satuan ?? ""}`).join(" · ")}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
