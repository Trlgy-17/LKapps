import { revalidatePath } from "next/cache";
import { ambilDb, schema } from "@/db";
import { boleh } from "@/lib/permissions";
import { daftarMaterial, tambahMaterial } from "@/lib/material";
import { wajibMasuk } from "@/lib/sesi";

async function aksiTambah(formData: FormData) {
  "use server";
  const p = await wajibMasuk("katalog.kelola");
  const db = await ambilDb();
  const teks = (k: string) => String(formData.get(k) ?? "").trim().replace(",", ".");
  await tambahMaterial(db, { id: p.id, peran: p.peran }, {
    workspaceId: p.workspaceId,
    nama: String(formData.get("nama") ?? ""),
    tebal: teks("tebal") || null,
    lembarLebar: teks("lebar") || undefined,
    lembarPanjang: teks("panjang") || undefined,
    satuan: String(formData.get("satuan") ?? "lembar"),
    seratTetap: formData.get("serat") === "tetap",
    alias: String(formData.get("alias") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  });
  revalidatePath("/katalog");
}

export default async function Katalog() {
  const p = await wajibMasuk("katalog.baca");
  const db = await ambilDb();
  const daftar = await daftarMaterial(db, p.workspaceId);
  const alias = await db.select().from(schema.materialAlias);
  const aliasPer = new Map<string, string[]>();
  for (const a of alias) aliasPer.set(a.materialId, [...(aliasPer.get(a.materialId) ?? []), a.alias]);

  return (
    <>
      <div className="kepala"><h1>Katalog Material</h1></div>
      <div className="kartu bungkus-tabel">
        <table>
          <thead>
            <tr><th>Nama</th><th>Alias</th><th>Tebal (mm)</th><th>Ukuran lembar (mm)</th><th>Satuan</th><th>Serat</th></tr>
          </thead>
          <tbody>
            {daftar.length === 0 && <tr><td colSpan={6} className="kosong">Belum ada material.</td></tr>}
            {daftar.map((m) => (
              <tr key={m.id}>
                <td>{m.nama}</td>
                <td>{(aliasPer.get(m.id) ?? []).join(", ") || "-"}</td>
                <td className="angka">{m.tebal ?? "-"}</td>
                <td className="angka">{m.lembarLebar} x {m.lembarPanjang}</td>
                <td>{m.satuan}</td>
                <td>{m.seratTetap ? "Tidak diputar" : "Boleh diputar"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {boleh(p.peran, "katalog.kelola") && (
        <form action={aksiTambah} className="kartu">
          <h2>Tambah material</h2>
          <div className="baris-form">
            <div><label htmlFor="nama">Nama (sesuai katalog)</label><input id="nama" name="nama" required /></div>
            <div><label htmlFor="alias">Alias (pisah koma)</label><input id="alias" name="alias" placeholder="multimin, multi min" /></div>
            <div><label htmlFor="tebal">Tebal (mm)</label><input id="tebal" name="tebal" inputMode="decimal" /></div>
          </div>
          <div className="baris-form">
            <div><label htmlFor="lebar">Lebar lembar (mm)</label><input id="lebar" name="lebar" inputMode="decimal" placeholder="1200" /></div>
            <div><label htmlFor="panjang">Panjang lembar (mm)</label><input id="panjang" name="panjang" inputMode="decimal" placeholder="2400" /></div>
            <div><label htmlFor="satuan">Satuan</label>
              <select id="satuan" name="satuan"><option>lembar</option><option>pcs</option><option>psg</option><option>mtr</option></select></div>
            <div><label htmlFor="serat">Arah serat</label>
              <select id="serat" name="serat"><option value="bebas">Boleh diputar</option><option value="tetap">Tidak diputar</option></select></div>
          </div>
          <button className="tombol">Simpan material</button>
        </form>
      )}
    </>
  );
}
