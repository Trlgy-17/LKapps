import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { ambilDb, schema } from "@/db";
import { estimasiTerbaru, ubahMasukan, type HasilItem, type HasilMesin, type Perubahan } from "@/lib/estimasi";
import type { FieldMasukan, MasukanWeb } from "@/lib/estimasi-masukan";
import { formatAngka } from "@/lib/format";
import { boleh } from "@/lib/permissions";
import { ambilProyek, lembarKerjaTerbaru } from "@/lib/proyek";
import { wajibMasuk } from "@/lib/sesi";
import { hitungStatus, NAMA_KESIAPAN, NAMA_STATUS_PROYEK } from "@/lib/status-proyek";
import { dataRealTerbaru } from "@/lib/real";
import { BARIS, BELUM_ADA_RUMUS, KARTU, NAMA_TAB, type Tab } from "@/lib/hasil-label";
import { Segarkan } from "./segarkan";

const KELAS_STATUS: Record<string, string> = {
  gambar: "info", skala: "neutral", asumsi: "warn", terkalibrasi: "info", perkiraan: "warn",
};
const NAMA_STATUS: Record<string, string> = {
  gambar: "Gambar", skala: "Skala", asumsi: "Asumsi", terkalibrasi: "Terkalibrasi", perkiraan: "Perkiraan",
};

const angka = (s: FormDataEntryValue | null): number | null | undefined => {
  if (s === null) return undefined;
  const t = String(s).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

async function simpanMasukan(formData: FormData) {
  "use server";
  const p = await wajibMasuk("estimasi.hitung");
  const id = String(formData.get("id"));
  const bulat = (k: string) => {
    const v = angka(formData.get(k));
    return v === undefined ? undefined : v === null ? null : Math.round(v);
  };
  const perubahan: Perubahan = {
    meter_kabinet: angka(formData.get("meter_kabinet")),
    meter_kitchen: angka(formData.get("meter_kitchen")),
    meter_atas: angka(formData.get("meter_atas")),
    aica_kedalaman_mm: angka(formData.get("aica_kedalaman_mm")),
    jumlah_lemari: bulat("jumlah_lemari"),
    jumlah_sudut_robot: bulat("jumlah_sudut_robot"),
    titik_sambungan: bulat("titik_sambungan"),
    tinggi_standar: formData.get("tinggi_standar") === "ya",
    pintu_bawah_asumsi: bulat("pintu_bawah_asumsi") ?? undefined,
    pintu_atas_asumsi: bulat("pintu_atas_asumsi") ?? undefined,
  };
  await ubahMasukan(await ambilDb(), { id: p.id, peran: p.peran }, p.workspaceId, id, perubahan as Perubahan);
  revalidatePath(`/proyek/${id}/hasil`);
}

function nilai(h: HasilMesin, kelompok: string, kunci: string): HasilItem | undefined {
  return (h[kelompok as "standar" | "hardware" | "sekrup" | "pintu_asumsi"] ?? {})[kunci];
}

function Isian({ id, label, f, desimal }: { id: string; label: string; f: FieldMasukan<number | boolean>; desimal?: boolean }) {
  const v = typeof f.nilai === "number" ? String(f.nilai).replace(".", ",") : "";
  const asal = f.asal === "pengguna" ? "diisi pengguna" : f.asal === "baca" ? "dari lembar kerja" : f.asal === "asumsi" ? "asumsi" : "belum diketahui";
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} inputMode={desimal ? "decimal" : "numeric"} defaultValue={v} placeholder="belum diketahui" />
      <div className="muted">{asal}</div>
    </div>
  );
}

export default async function HasilEstimasi({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const p = await wajibMasuk("proyek.baca");
  const { id } = await params;
  const { tab: t } = await searchParams;
  const tab = (Object.keys(NAMA_TAB) as Tab[]).includes(t as Tab) ? (t as Tab) : "papan";
  const db = await ambilDb();
  const pr = /^[0-9a-f-]{36}$/.test(id) ? await ambilProyek(db, p.workspaceId, id) : null;
  if (!pr) notFound();
  const lk = await lembarKerjaTerbaru(db, id);
  const e = await estimasiTerbaru(db, id);

  if (!e) {
    const menunggu = lk && (lk.status === "diunggah" || lk.status === "membaca" || lk.status === "selesai");
    return (
      <>
        <div className="kepala"><h1>Hasil Estimasi</h1></div>
        <div className="kartu">
          {menunggu ? (
            <>
              <p role="status">Lembar kerja sedang diproses. Hasil keluar otomatis setelah pembacaan selesai.</p>
              <Segarkan />
            </>
          ) : (
            <p>Belum ada hasil. Pembacaan lembar kerja gagal atau belum dimulai.</p>
          )}
          <Link href={`/proyek/${id}/unggah`} className="tombol sekunder">Lihat progres</Link>
        </div>
      </>
    );
  }

  const h = e.hasil as unknown as HasilMesin;
  const m = e.masukan as unknown as MasukanWeb;
  const konflik = lk ? await db.select().from(schema.konflik).where(eq(schema.konflik.lembarKerjaId, lk.id)) : [];
  const belumJawab = konflik.filter((k) => !k.jawaban).length;

  const baris = BARIS.filter((b) => b.tab === tab).map((b) => ({ b, v: nilai(h, b.kelompok, b.kunci) })).filter((x) => !(x.b.opsional && !x.v));
  const belum = BELUM_ADA_RUMUS.filter((x) => x.tab === tab);
  const lembarPintu = h.lembar_per_bahan["Material 18 mm"];

  // Konfirmasi: item yang perlu dicek, catatan masukan, ukuran asumsi, konflik.
  const konfirmasi: { judul: string; ket: string }[] = [];
  for (const b of BARIS) {
    const v = nilai(h, b.kelompok, b.kunci);
    if (v?.perlu_konfirmasi) konfirmasi.push({ judul: b.item, ket: v.rumus });
  }
  for (const [k, f] of Object.entries(m) as [string, unknown][]) {
    const ff = f as FieldMasukan<unknown>;
    if (ff && typeof ff === "object" && !Array.isArray(ff) && "catatan" in ff && ff.catatan.length && ff.asal !== "pengguna" && ff.asal !== "tidak_ada") {
      for (const c of ff.catatan) konfirmasi.push({ judul: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "), ket: c });
    }
  }
  for (const c of m.catatan ?? []) konfirmasi.unshift({ judul: "Halaman tidak terbaca", ket: c });

  const adaReal = !!(await dataRealTerbaru(db, id));
  const unitN = lk ? (await db.select().from(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lk.id))).length : 0;
  const st = hitungStatus({
    adaEstimasi: true, konflikTerbuka: belumJawab, itemPerluKonfirmasi: konfirmasi.length,
    halamanGagal: lk?.halamanGagal.length ?? 0, adaDataReal: adaReal, unitTerbaca: unitN,
  });

  const kmp = h.komponen ?? null;
  const kartu = KARTU.map((k) => {
    if (kmp && k.judul === "Papan") return { judul: "Papan (daftar potongan)", jumlah: kmp.ringkas.papan_lembar, satuan: k.satuan, lengkap: true };
    if (kmp && k.judul === "HPL") return { judul: "HPL (daftar potongan)", jumlah: kmp.ringkas.hpl_lembar, satuan: k.satuan, lengkap: true };
    const v = k.kunci.map((x) => nilai(h, k.dari, x)).filter((x): x is HasilItem => !!x);
    return { judul: k.judul, jumlah: v.length ? v.reduce((s, x) => s + x.jumlah, 0) : null, satuan: k.satuan, lengkap: v.length === k.kunci.length };
  });

  return (
    <>
      <div className="kepala">
        <div>
          <h1>Hasil Estimasi</h1>
          <p className="muted">
            {pr.klien || "Klien belum diisi"} · estimasi versi <span className="mono">{e.versi}</span> · RuleSet versi{" "}
            <span className="mono">{e.ruleSetVersi ?? "-"}</span> · <span className="chip warn">Draf</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {boleh(p.peran, "hasil.unduh") && (
            <a className="tombol sekunder" href={`/api/proyek/${id}/pdf`} download>Ekspor PDF</a>
          )}
          <button className="tombol" disabled aria-disabled="true"
            title={belumJawab ? `${belumJawab} konflik belum dijawab` : `${konfirmasi.length} item perlu dikonfirmasi`}>
            Setujui estimasi
          </button>
        </div>
      </div>
      <p className="muted" role="status">
        Status: <strong>{NAMA_STATUS_PROYEK[st.status]}</strong> · Kesiapan pembelian: <strong>{NAMA_KESIAPAN[st.kesiapanPembelian]}</strong>
        {" "}· <Link href={`/proyek/${id}/real`}>Data real</Link>
        <br />{st.alasanBlokir.join(" · ")}
      </p>
      {(belumJawab > 0 || konfirmasi.length > 0) && (
        <p className="galat" role="status">
          {belumJawab > 0 && <>{belumJawab} konflik gambar belum dijawab. </>}
          {konfirmasi.length} item perlu konfirmasi. Angka di bawah adalah draf: bukan untuk belanja sebelum dikonfirmasi.
        </p>
      )}

      <div className="ringkasan">
        {kartu.map((k) => (
          <div key={k.judul} className="kartu">
            <div className="angka">{k.jumlah === null ? "—" : formatAngka(k.jumlah)}</div>
            <div className="muted">{k.judul}{k.jumlah !== null && ` (${k.satuan})`}{k.jumlah !== null && !k.lengkap && " · sebagian"}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: "2 1 520px", minWidth: 0 }}>
          <div className="tab" role="tablist" aria-label="Kategori hasil">
            {(Object.keys(NAMA_TAB) as Tab[]).map((k) => (
              <Link key={k} href={`/proyek/${id}/hasil?tab=${k}`} role="tab" aria-selected={k === tab}>{NAMA_TAB[k]}</Link>
            ))}
          </div>
          {tab === "papan" && kmp && (
            <div className="kartu bungkus-tabel" style={{ marginBottom: 16 }}>
              <table>
                <caption style={{ textAlign: "left", padding: "12px 16px 0", fontWeight: 600 }}>
                  Papan dari daftar potongan · lembar {formatAngka(kmp.parameter.lembar_mm[1])} x {formatAngka(kmp.parameter.lembar_mm[0])} mm, tebal potong {formatAngka(kmp.parameter.tebal_potong_mm, 1)} mm
                </caption>
                <thead><tr><th>Bahan</th><th style={{ textAlign: "right" }}>Part</th><th style={{ textAlign: "right" }}>Luas (m²)</th><th style={{ textAlign: "right" }}>Min. luas</th><th style={{ textAlign: "right" }}>Lembar</th><th>Lembar terakhir</th><th>Status</th></tr></thead>
                <tbody>
                  {Object.entries(kmp.sku).map(([nama, x]) => (
                    <tr key={nama}>
                      <td>{nama}{x.tidak_muat.length > 0 && <div className="muted">{x.tidak_muat.length} part lebih besar dari lembar (tidak diperkecil)</div>}</td>
                      <td className="angka">{formatAngka(x.jumlah_part)}</td>
                      <td className="angka">{formatAngka(x.luas_m2, 2)}</td>
                      <td className="angka">{formatAngka(x.batas_minimum_luas)}</td>
                      <td className="angka">{formatAngka(x.lembar)}</td>
                      <td className="angka">{formatAngka(x.isi_terakhir_persen, 1)}%</td>
                      <td>
                        <span className={`chip ${KELAS_STATUS[x.status] ?? "neutral"}`}>{NAMA_STATUS[x.status] ?? x.status}</span>
                        {x.validasi_nesting !== "lolos" && <> <span className="chip strong">Validasi gagal</span></>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ padding: "0 16px 12px" }}>
                Min. luas = batas minimum berdasarkan luas (bukan kebutuhan final). Lembar = hasil nesting yang sudah diperiksa tanpa tumpang tindih.
                {kmp.uji_trim && ` Uji trim ${kmp.uji_trim.trim_mm} mm: ${kmp.uji_trim.berubah.length ? kmp.uji_trim.berubah.map((u) => `${u.sku} ${u.lembar} jadi ${u.lembar_trim}`).join(", ") : "tidak ada bahan yang berubah"}.`}
              </p>
            </div>
          )}
          {tab === "papan" && kmp && <h2>Pembanding: tarif per meter (SOP)</h2>}
          <div className="kartu bungkus-tabel">
            <table>
              <thead><tr><th>Item</th><th>Dipakai untuk</th><th style={{ textAlign: "right" }}>Jumlah</th><th>Status</th></tr></thead>
              <tbody>
                {baris.map(({ b, v }) => (
                  <tr key={b.kunci}>
                    <td>{b.item}</td>
                    <td>
                      {b.untuk}
                      {v && <div className="muted">{v.rumus}</div>}
                      {!v && <div className="muted">Belum dihitung: masukan belum diketahui</div>}
                    </td>
                    <td className="angka">{v ? <>{formatAngka(v.jumlah)} <span className="muted">{v.satuan}</span></> : "—"}</td>
                    <td>
                      {v ? (
                        <>
                          <span className={`chip ${KELAS_STATUS[v.status] ?? "neutral"}`}>{NAMA_STATUS[v.status] ?? v.status}</span>
                          {v.perlu_konfirmasi && <> <span className="chip strong">Perlu konfirmasi</span></>}
                        </>
                      ) : <span className="chip neutral">Belum dihitung</span>}
                    </td>
                  </tr>
                ))}
                {belum.map((x) => (
                  <tr key={x.item}><td>{x.item}</td><td className="muted">{x.alasan}</td><td className="angka">—</td><td><span className="chip neutral">Belum ada rumus</span></td></tr>
                ))}
                {tab === "papan" && lembarPintu !== undefined && (
                  <tr>
                    <td>Pembanding nesting mesin: pintu</td>
                    <td>Hasil nesting mesin (lembar 1200 x 2400 mm, tebal potong 3,2 mm). Angka utama memakai SOP pengguna; baris ini hanya pembanding.</td>
                    <td className="angka">{formatAngka(lembarPintu)} <span className="muted">lembar</span></td>
                    <td><span className="chip warn">Asumsi</span></td>
                  </tr>
                )}
                {tab === "papan" && Object.entries(h.pintu_asumsi).map(([k, v]) => (
                  <tr key={k}><td>Pembanding nesting: kapasitas {k.replace(/_/g, " ")}</td><td className="muted">{v.rumus}</td><td className="angka">{formatAngka(v.jumlah)} <span className="muted">{v.satuan}</span></td><td><span className="chip warn">Asumsi</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside style={{ flex: "1 1 300px", minWidth: 0 }} aria-label="Konfirmasi dan masukan hitung">
          <section className="kartu">
            <h2>Konfirmasi sebelum belanja</h2>
            {konflik.length > 0 && (
              <>
                <p className="muted">{belumJawab} dari {konflik.length} konflik gambar belum dijawab (dijawab di layar Review, Tahap 5).</p>
                <ul>{konflik.map((k) => <li key={k.id}>{k.deskripsi}</li>)}</ul>
              </>
            )}
            {konfirmasi.length === 0 && konflik.length === 0 && <p className="muted">Tidak ada.</p>}
            <ul style={{ paddingLeft: 18 }}>
              {konfirmasi.map((k, i) => <li key={i}><strong>{k.judul}</strong>: <span className="muted">{k.ket}</span></li>)}
            </ul>
          </section>
          {boleh(p.peran, "estimasi.hitung") && (
            <form action={simpanMasukan} className="kartu">
              <h2>Masukan hitung</h2>
              <p className="muted">Terisi dari lembar kerja. Ubah lalu hitung ulang; versi lama tetap tersimpan.</p>
              <input type="hidden" name="id" value={id} />
              <div style={{ display: "grid", gap: 10 }}>
                <Isian id="meter_kabinet" label="Meter kabinet (m)" f={m.meter_kabinet} desimal />
                <Isian id="meter_kitchen" label="Meter kitchen untuk LED (m)" f={m.meter_kitchen} desimal />
                <Isian id="meter_atas" label="Meter kabinet gantung (m)" f={m.meter_atas} desimal />
                <Isian id="aica_kedalaman_mm" label="Kedalaman top AICA (mm)" f={m.aica_kedalaman_mm ?? { nilai: null, asal: "tidak_ada", catatan: [] }} />
                <Isian id="jumlah_lemari" label="Jumlah lemari" f={m.jumlah_lemari} />
                <Isian id="jumlah_sudut_robot" label="Sudut engsel robot" f={m.jumlah_sudut_robot} />
                <Isian id="titik_sambungan" label="Titik sambungan (GP)" f={m.titik_sambungan} />
                <div>
                  <label htmlFor="pintu_bawah_asumsi">Pintu bawah berukuran asumsi (60 x 70 cm)</label>
                  <input id="pintu_bawah_asumsi" name="pintu_bawah_asumsi" inputMode="numeric" defaultValue={m.pintu_bawah_asumsi} />
                </div>
                <div>
                  <label htmlFor="pintu_atas_asumsi">Pintu atas berukuran asumsi (40 x 70 cm)</label>
                  <input id="pintu_atas_asumsi" name="pintu_atas_asumsi" inputMode="numeric" defaultValue={m.pintu_atas_asumsi} />
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" name="tinggi_standar" value="ya" defaultChecked={m.tinggi_standar.nilai !== false} style={{ width: 20, minHeight: 20 }} />
                  Tinggi standar (70–80 cm)
                </label>
                {m.tinggi_standar.catatan.map((c, i) => <div key={i} className="muted">{c}</div>)}
              </div>
              <button className="tombol" style={{ marginTop: 12 }}>Hitung ulang</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
