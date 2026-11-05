import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ambilDb } from "@/db";
import { boleh } from "@/lib/permissions";
import { ambilProyek, cobaLagi, halamanLembar, lembarKerjaTerbaru, ubahDataProyek } from "@/lib/proyek";
import { wajibMasuk } from "@/lib/sesi";
import { StatusBaca } from "./status-baca";

async function simpanData(formData: FormData) {
  "use server";
  const p = await wajibMasuk("proyek.ubah");
  const id = String(formData.get("id"));
  const teks = (k: string) => String(formData.get(k) ?? "").trim();
  await ubahDataProyek(await ambilDb(), { id: p.id, peran: p.peran }, p.workspaceId, id, {
    klien: teks("klien"), lokasi: teks("lokasi"), pekerjaan: teks("pekerjaan"), surveyor: teks("surveyor"),
    tanggalGambar: teks("tanggal_gambar") || null,
  });
  revalidatePath(`/proyek/${id}/unggah`);
}

export default async function ProyekBaruLayar({ params }: { params: Promise<{ id: string }> }) {
  const p = await wajibMasuk("proyek.baca");
  const { id } = await params;
  const db = await ambilDb();
  const pr = /^[0-9a-f-]{36}$/.test(id) ? await ambilProyek(db, p.workspaceId, id) : null;
  if (!pr) notFound();
  const lk = await lembarKerjaTerbaru(db, id);
  if (!lk) notFound();
  const hal = await halamanLembar(db, lk.id);
  const bolehUbah = boleh(p.peran, "proyek.ubah");
  const siap = lk.status === "selesai";

  async function ulangBaca() {
    "use server";
    const u = await wajibMasuk("proyek.ubah");
    await cobaLagi(await ambilDb(), { id: u.id, peran: u.peran }, u.workspaceId, id);
  }

  return (
    <>
      <div className="kepala">
        <h1>Proyek Baru</h1>
        {siap ? (
          <Link href={`/proyek/${id}/hasil`} className="tombol">Lihat hasil estimasi</Link>
        ) : (
          <button className="tombol" disabled aria-disabled="true">Lihat hasil estimasi</button>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 420px", minWidth: 0 }}>
          <StatusBaca
            proyekId={id}
            bolehUbah={bolehUbah}
            cobaLagi={ulangBaca}
            awal={{
              status: lk.status, galat: lk.galat, namaFile: lk.namaFile, ukuranByte: lk.ukuranByte,
              totalHalaman: lk.halaman, tahap: lk.tahap, halamanDibaca: lk.halamanDibaca,
              halaman: hal.map((h) => ({ nomor: h.nomor, lebar: h.lebarPx, tinggi: h.tinggiPx })),
              lembarKerjaId: lk.id,
            }}
          />
        </div>
        <form action={simpanData} className="kartu" style={{ flex: "1 1 280px" }}>
          <h2>Data proyek</h2>
          <p className="muted">Terisi otomatis dari title block bila terbaca. Bisa diubah.</p>
          <input type="hidden" name="id" value={id} />
          {([
            ["klien", "Klien", pr.klien], ["lokasi", "Lokasi", pr.lokasi],
            ["pekerjaan", "Pekerjaan", pr.pekerjaan], ["surveyor", "Surveyor", pr.surveyor],
          ] as const).map(([k, label, v]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <label htmlFor={k}>{label}</label>
              <input id={k} name={k} defaultValue={v} readOnly={!bolehUbah} />
            </div>
          ))}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="tanggal_gambar">Tanggal gambar</label>
            <input id="tanggal_gambar" name="tanggal_gambar" type="date" defaultValue={pr.tanggalGambar ?? ""} readOnly={!bolehUbah} />
          </div>
          {bolehUbah && <button className="tombol sekunder">Simpan data</button>}
        </form>
      </div>
    </>
  );
}
