import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ambilDb, schema } from "@/db";
import { KATEGORI_ATURAN, KEYAKINAN } from "@/db/schema";
import { aktifkanDraf, bukaDraf, daftarAturan, ruleSetAktif, ruleSetDraf, tambahAturan } from "@/lib/aturan";
import { boleh } from "@/lib/permissions";
import { wajibMasuk } from "@/lib/sesi";

const NAMA_TAB: Record<(typeof KATEGORI_ATURAN)[number], string> = {
  bahan: "Bahan", hardware: "Hardware", sekrup: "Sekrup", parameter: "Parameter",
};
const NAMA_KEYAKINAN: Record<(typeof KEYAKINAN)[number], { teks: string; kelas: string }> = {
  terkalibrasi: { teks: "Terkalibrasi", kelas: "info" },
  perkiraan: { teks: "Perkiraan", kelas: "warn" },
  perlu_konfirmasi: { teks: "Perlu konfirmasi", kelas: "strong" },
};

async function aksiBukaDraf() {
  "use server";
  const p = await wajibMasuk("aturan.kelola");
  const db = await ambilDb();
  await bukaDraf(db, { id: p.id, peran: p.peran }, p.workspaceId);
  revalidatePath("/aturan");
}

async function aksiTambah(formData: FormData) {
  "use server";
  const p = await wajibMasuk("aturan.kelola");
  const db = await ambilDb();
  const draf = await bukaDraf(db, { id: p.id, peran: p.peran }, p.workspaceId);
  const kategori = String(formData.get("kategori")) as (typeof KATEGORI_ATURAN)[number];
  const keyakinan = String(formData.get("keyakinan")) as (typeof KEYAKINAN)[number];
  if (!KATEGORI_ATURAN.includes(kategori) || !KEYAKINAN.includes(keyakinan)) return;
  const nama = String(formData.get("nama") ?? "").trim();
  const kunci = String(formData.get("kunci") ?? "").trim() || nama.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!nama) return;
  await tambahAturan(db, { id: p.id, peran: p.peran }, draf.id, {
    kategori, kunci, nama, keyakinan,
    isi: String(formData.get("isi") ?? "").trim(),
    sumber: String(formData.get("sumber") ?? "").trim() || "Input admin",
  });
  revalidatePath("/aturan");
}

async function aksiAktifkan(formData: FormData) {
  "use server";
  const p = await wajibMasuk("aturan.setujui");
  const db = await ambilDb();
  await aktifkanDraf(db, { id: p.id, peran: p.peran }, String(formData.get("id")));
  revalidatePath("/aturan");
}

export default async function PustakaAturan({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const p = await wajibMasuk("aturan.baca");
  const { tab } = await searchParams;
  const kategori = (KATEGORI_ATURAN as readonly string[]).includes(tab ?? "")
    ? (tab as (typeof KATEGORI_ATURAN)[number])
    : "bahan";
  const db = await ambilDb();
  const aktif = await ruleSetAktif(db, p.workspaceId);
  const draf = await ruleSetDraf(db, p.workspaceId);
  const tampil = aktif ?? draf;
  const semua = tampil ? await daftarAturan(db, tampil.id) : [];
  const baris = semua.filter((a) => a.kategori === kategori);
  const adminKelola = boleh(p.peran, "aturan.kelola");
  const jumlahDraf = draf ? (await daftarAturan(db, draf.id)).length : 0;

  return (
    <>
      <div className="kepala">
        <div>
          <h1>Pustaka Aturan</h1>
          <p className="muted">
            {aktif ? `RuleSet versi ${aktif.versi} · aktif` : "Belum ada RuleSet aktif"}
            {draf && ` · draf versi ${draf.versi} (${jumlahDraf} aturan) menunggu persetujuan admin`}
          </p>
        </div>
        {adminKelola && !draf && (
          <form action={aksiBukaDraf}><button className="tombol">Tambah aturan</button></form>
        )}
        {draf && boleh(p.peran, "aturan.setujui") && (
          <form action={aksiAktifkan}>
            <input type="hidden" name="id" value={draf.id} />
            <button className="tombol">Aktifkan draf versi {draf.versi}</button>
          </form>
        )}
      </div>

      <div className="tab" role="tablist" aria-label="Kategori aturan">
        {KATEGORI_ATURAN.map((k) => (
          <Link key={k} href={`/aturan?tab=${k}`} role="tab" aria-selected={k === kategori}>{NAMA_TAB[k]}</Link>
        ))}
      </div>

      <div className="kartu bungkus-tabel">
        <table>
          <thead>
            <tr><th>Aturan</th><th>Isi</th><th>Sumber</th><th>Keyakinan</th></tr>
          </thead>
          <tbody>
            {baris.length === 0 && (
              <tr><td colSpan={4} className="kosong">Belum ada aturan di kategori ini.</td></tr>
            )}
            {baris.map((a) => (
              <tr key={a.id}>
                <td>{a.nama}</td>
                <td>{a.isi}</td>
                <td>{a.sumber}</td>
                <td><span className={`chip ${NAMA_KEYAKINAN[a.keyakinan].kelas}`}>{NAMA_KEYAKINAN[a.keyakinan].teks}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adminKelola && (
        <form action={aksiTambah} className="kartu">
          <h2>Tambah aturan ke draf</h2>
          <p className="muted">Aturan baru baru dipakai mesin hitung setelah draf diaktifkan admin.</p>
          <div className="baris-form">
            <div><label htmlFor="kategori">Kategori</label>
              <select id="kategori" name="kategori" defaultValue={kategori}>
                {KATEGORI_ATURAN.map((k) => <option key={k} value={k}>{NAMA_TAB[k]}</option>)}
              </select></div>
            <div><label htmlFor="nama">Nama aturan</label><input id="nama" name="nama" required /></div>
            <div><label htmlFor="keyakinan">Keyakinan</label>
              <select id="keyakinan" name="keyakinan" defaultValue="perkiraan">
                {KEYAKINAN.map((k) => <option key={k} value={k}>{NAMA_KEYAKINAN[k].teks}</option>)}
              </select></div>
          </div>
          <div className="baris-form">
            <div><label htmlFor="isi">Isi / rumus</label><input id="isi" name="isi" required /></div>
            <div><label htmlFor="sumber">Sumber proyek</label><input id="sumber" name="sumber" /></div>
          </div>
          <button className="tombol">Simpan ke draf</button>
        </form>
      )}
    </>
  );
}
