import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BARIS, BELUM_ADA_RUMUS, KARTU } from "./hasil-label";
import type { HasilItem, HasilMesin, SkuKomponen } from "./estimasi";
import type { FieldMasukan, MasukanWeb } from "./estimasi-masukan";
import { formatAngka } from "./format";
import { hitungStatus, NAMA_KESIAPAN, NAMA_STATUS_PROYEK } from "./status-proyek";

/** Data yang dibutuhkan PDF. Dirakit di server dari database; pembangun HTML ini murni. */
export type DataPdf = {
  proyek: { klien: string; lokasi: string; pekerjaan: string; surveyor: string; tanggalGambar: string | null };
  estimasi: { versi: number; ruleSetVersi: number | null; hasil: HasilMesin; masukan: MasukanWeb; dibuat: Date };
  units: { nama: string; jenis: string; bahanUtama: string | null; halaman: number[]; lebarMm: number | null; pintu: number; laci: number }[];
  spek: { kunci: string; nilai: string; unit: string | null; halaman: number }[];
  halamanGagal?: number[];
  gambar: { halaman: number; jenis: string; lembarTercetak: string | null; uri: string }[];
  konflik: { deskripsi: string; terjawab: boolean }[];
  aturanBahan: { nama: string; isi: string }[];
};

/** Angka desimal ber-titik dari mesin (6.66) jadi format Indonesia (6,66). Angka ribuan tidak dihasilkan mesin. */
export const rumusId = (s: string) => s.replace(/(\d)\.(\d)/g, "$1,$2");

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const NAMA_JENIS: Record<string, string> = {
  kabinet_atas: "Kabinet atas", kabinet_bawah: "Kabinet bawah", box: "Box", lemari: "Lemari", wallpanel: "Wallpanel", lainnya: "Lainnya",
};
const NAMA_SPEK: Record<string, string> = {
  bahan_utama: "Bahan utama", finishing: "Finishing", kode_hpl: "Kode HPL", rel: "Rel", engsel: "Engsel", lainnya: "Lainnya",
};
const NAMA_STATUS: Record<string, string> = {
  gambar: "gambar", skala: "skala", asumsi: "asumsi", terkalibrasi: "terkalibrasi", perkiraan: "perkiraan",
};

function tanggalId(iso: string | null): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function aset(rel: string, tipe: string): string {
  try {
    return `data:${tipe};base64,${fs.readFileSync(path.join(process.cwd(), rel)).toString("base64")}`;
  } catch {
    return "";
  }
}

function css(): string {
  const f = (file: string, fam: string, bobot: number) => {
    const uri = aset(`node_modules/@fontsource/${fam}/files/${file}.woff2`, "font/woff2");
    return uri ? `@font-face{font-family:"${fam === "ibm-plex-sans" ? "IBM Plex Sans" : "IBM Plex Mono"}";font-weight:${bobot};src:url(${uri}) format("woff2")}` : "";
  };
  return `
${f("ibm-plex-sans-latin-400-normal", "ibm-plex-sans", 400)}
${f("ibm-plex-sans-latin-600-normal", "ibm-plex-sans", 600)}
${f("ibm-plex-sans-latin-700-normal", "ibm-plex-sans", 700)}
${f("ibm-plex-mono-latin-500-normal", "ibm-plex-mono", 500)}
${f("ibm-plex-mono-latin-600-normal", "ibm-plex-mono", 600)}
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"IBM Plex Sans",sans-serif;font-size:11px;line-height:1.4;color:#1A2023;background:#FAF8F4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hal{position:relative;width:297mm;height:210mm;overflow:hidden;page-break-after:always;padding:0 14mm}
.hal:last-child{page-break-after:auto}
.kepala1{margin:0 -14mm;background:#26211D;color:#fff;padding:9mm 14mm 7mm;display:flex;justify-content:space-between;align-items:flex-end}
.merek{display:flex;gap:10px;align-items:center}
.merek img{height:16mm}
.merek b{letter-spacing:.08em;font-size:12px}
.merek small{display:block;color:#D5CFC6;font-size:10px;margin-top:2px}
.kepala1 h1{margin:6px 0 0;font-size:30px;line-height:1.1;font-weight:700}
.kepala1 .sub{color:#E3B97E;font-size:14px;text-align:right}
.draf{display:inline-block;margin-top:6px;border:1px solid #E8890C;color:#E8890C;border-radius:999px;padding:1px 9px;font-size:10px;font-weight:600}
.kepala2{display:flex;justify-content:space-between;align-items:flex-end;padding:9mm 0 3mm;border-bottom:1.5px solid #26211D}
.kepala2 .merek img{height:11mm}
.kepala2 h2{margin:0;font-size:22px;text-align:right}
.kepala2 .ket{color:#5B666B;text-align:right;font-size:11px}
.kartu{background:#fff;border:1px solid #E4DFD6;border-radius:9px}
.ring{display:grid;grid-template-columns:repeat(6,1fr);gap:9px;margin:6mm 0 5mm}
.ring .kartu{padding:8px 12px}
.ring .a{font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:21px}
.ring .l{color:#5B666B;font-size:10.5px}
.kolom3{display:grid;grid-template-columns:repeat(3,1fr);gap:9mm}
.bag h3{display:flex;align-items:center;gap:7px;font-size:13px;margin:0 0 4px}
.bag h3 i{font-style:normal;background:#26211D;color:#fff;border-radius:50%;width:17px;height:17px;display:inline-flex;align-items:center;justify-content:center;font-size:10px}
.tag{border:1px solid #E8890C;color:#C96A00;border-radius:999px;padding:0 7px;font-size:9px;font-weight:600}
.it{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #E4DFD6}
.it b{display:block;font-size:11.5px}
.it small{display:block;color:#5B666B;font-size:9.5px}
.it .n{font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:17px;text-align:right;white-space:nowrap}
.it .n em{font-style:normal;font-family:"IBM Plex Sans",sans-serif;font-weight:400;font-size:9.5px;color:#5B666B;margin-left:2px}
.it .n.kosong{color:#8A9296}
.st{display:inline-block;border-radius:999px;padding:0 6px;font-size:8.5px;font-weight:600;margin-top:2px}
.st.asumsi,.st.perkiraan{background:#FDF0D5;color:#6F4300}
.st.gambar,.st.terkalibrasi{background:#E3EEFA;color:#134E8E}
.st.skala{background:#ECEFEC;color:#3C474C}
.st.konf{background:#FBE3CC;color:#7A3B00}
.st.belum{background:#ECEFEC;color:#3C474C}
.kaki{position:absolute;left:14mm;right:14mm;bottom:6mm;border-top:1px solid #D9D3C8;padding-top:3mm;display:flex;justify-content:space-between;color:#5B666B;font-size:9.5px}
.dua{display:grid;grid-template-columns:2fr 1fr;gap:6mm;margin-top:5mm}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}
.uc{padding:8px 11px}
.uc b{font-size:12px}.uc small{display:block;color:#5B666B;font-size:10px}
h4{font-size:13px;margin:0 0 6px}
table{border-collapse:collapse;width:100%}
th{background:#26211D;color:#fff;text-align:left;font-size:9.5px;padding:5px 8px}
td{padding:4px 8px;border-top:1px solid #E4DFD6;font-size:10px;vertical-align:top}
td.n{font-family:"IBM Plex Mono",monospace;font-weight:600;text-align:right;white-space:nowrap}
.aturan .kartu{padding:7px 11px;margin-bottom:6px}
.aturan b{font-size:11px}.aturan p{margin:2px 0 0;color:#5B666B;font-size:10px}
.nomor{display:flex;gap:9px;padding:6px 0;border-bottom:1px solid #E4DFD6}
.nomor i{font-style:normal;flex:none;background:#E8890C;color:#fff;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;margin-top:1px}
.nomor b{font-size:11px}.nomor p{margin:1px 0 0;color:#5B666B;font-size:10px}
.cat{color:#5B666B;font-size:10px}
.peta{display:grid;grid-template-columns:2fr 1fr;gap:5mm;margin-top:4mm}
.gbr{padding:7px 10px}.gbr h4{margin:0 0 4px;font-size:11px}
.bingkai{height:104mm;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden}
.bingkai img{max-width:100%;max-height:100%;object-fit:contain}
.kecil .bingkai{height:50mm}
.sisi{display:flex;flex-direction:column;gap:4mm}
.sp{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-top:1px solid #E4DFD6;font-size:10px}
.belum{margin:6px 0 0;color:#5B666B;font-size:9.5px;border-top:1px solid #E4DFD6;padding-top:5px}
.kol2{columns:2;column-gap:9mm}
.kol2 .nomor{break-inside:avoid}
ul.p{margin:3px 0 0;padding-left:15px;font-size:10px}
`;
}

type Item = { nama: string; untuk: string; jumlah: number | null; satuan: string; status: string; konf: boolean; rumus: string };

function ambil(h: HasilMesin, k: string, kunci: string): HasilItem | undefined {
  return (h[k as "standar" | "hardware" | "sekrup" | "pintu_asumsi"] ?? {})[kunci];
}

function itemTab(h: HasilMesin, tabs: string[]): Item[] {
  // Halaman ringkas: tanpa pembanding rumus PRD dan tanpa item berjumlah 0 (tetap ada di halaman Dasar Hitungan).
  return BARIS.filter((b) => tabs.includes(b.tab) && b.kelompok !== "sekrup" && !(b.opsional && !ambil(h, b.kelompok, b.kunci))).map((b) => {
    const v = ambil(h, b.kelompok, b.kunci);
    return {
      nama: b.item, untuk: b.untuk, jumlah: v ? v.jumlah : null, satuan: v?.satuan ?? "",
      status: v ? v.status : "belum", konf: !!v?.perlu_konfirmasi, rumus: v?.rumus ?? "Belum dihitung: masukan belum diketahui",
    };
  });
}

function barisItem(i: Item): string {
  const konf = i.konf ? ' <span class="st konf">Perlu konfirmasi</span>' : "";
  return `<div class="it"><div><b>${esc(i.nama)}${konf}</b><small>${esc(i.untuk)} · ${esc(NAMA_STATUS[i.status] ?? i.status)}</small></div><span class="n">${formatAngka(i.jumlah!)}<em>${esc(i.satuan)}</em></span></div>`;
}

/** Hanya item yang punya angka dan jumlah > 0; sisanya diringkas jadi satu baris "Belum dihitung". */
function kolom(items: Item[], tambahan: string[] = []): string {
  const ada = items.filter((i) => i.jumlah !== null && i.jumlah > 0);
  const belum = [...items.filter((i) => i.jumlah === null).map((i) => i.nama), ...tambahan];
  return ada.map(barisItem).join("") + (belum.length ? `<p class="belum"><b>Belum dihitung:</b> ${esc(belum.join(", "))}</p>` : "");
}

function kaki(n: number, teks: string): string {
  return `<div class="kaki"><span>${esc(teks)}</span><span>${n} / 5</span></div>`;
}

function kepala2(d: DataPdf, logo: string, judul: string, sub: string): string {
  return `<div class="kepala2"><div class="merek"><img src="${logo}" alt=""><div><b>PUTRA CORPORATION</b><small style="color:#5B666B">${esc(d.proyek.klien || "Klien belum diisi")} · ${esc(d.proyek.lokasi)} · ${esc(d.proyek.pekerjaan)}</small></div></div><div><h2>${esc(judul)}</h2><div class="ket">${esc(sub)}</div></div></div>`;
}

export function bangunHtml(d: DataPdf): string {
  const h = d.estimasi.hasil;
  const logo = aset("src/assets/putra-logo.png", "image/png");
  const p = d.proyek;

  // --- konfirmasi (dipakai halaman 1 dan 4) ---
  const konfirmasi: { judul: string; ket: string }[] = [];
  const itemKonf = BARIS.filter((b) => {
    const v = ambil(h, b.kelompok, b.kunci);
    return v?.perlu_konfirmasi && v.jumlah > 0;
  }).map((b) => b.item);
  if (itemKonf.length) {
    konfirmasi.push({ judul: "Aturan yang masih perlu konfirmasi", ket: `${itemKonf.join(", ")}. Aturan ini belum terkalibrasi; lihat Pustaka Aturan.` });
  }
  for (const [k, f] of Object.entries(d.estimasi.masukan) as [string, unknown][]) {
    const ff = f as FieldMasukan<unknown>;
    if (ff && typeof ff === "object" && !Array.isArray(ff) && "catatan" in ff && ff.catatan.length && ff.asal !== "pengguna" && ff.asal !== "tidak_ada") {
      for (const c of ff.catatan) konfirmasi.push({ judul: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "), ket: rumusId(c) });
    }
  }
  for (const c of d.estimasi.masukan.catatan ?? []) konfirmasi.unshift({ judul: "Halaman tidak terbaca", ket: c });
  const konflikTerbuka = d.konflik.filter((k) => !k.terjawab);
  const adaKonfirmasi = konflikTerbuka.length + konfirmasi.length > 0;

  // --- halaman 1: ringkasan ---
  const kartu = KARTU.map((k) => {
    const v = k.kunci.map((x) => ambil(h, k.dari, x)).filter((x): x is HasilItem => !!x);
    return { judul: k.judul === "Papan" ? "Lembar papan" : k.judul === "AICA" ? "Lembar AICA" : k.judul === "HPL" ? "Lembar HPL (muka pintu)" : k.judul, jumlah: v.length ? v.reduce((s2, x) => s2 + x.jumlah, 0) : null, satuan: k.satuan };
  });
  const kmp = h.komponen ?? null;
  const ring = kmp
    ? kartu.map((k) =>
        k.judul === "Lembar papan" ? { ...k, jumlah: kmp.ringkas.papan_lembar }
        : k.judul.startsWith("Lembar HPL") ? { ...k, judul: "Lembar HPL", jumlah: kmp.ringkas.hpl_lembar }
        : k)
    : kartu;
  const ringHtml = ring
    .map((k) => `<div class="kartu"><div class="a">${k.jumlah === null ? "—" : formatAngka(k.jumlah)}${k.jumlah !== null && k.satuan !== "lembar" ? `<span style="font-size:11px;font-weight:400;color:#5B666B"> ${esc(k.satuan)}</span>` : ""}</div><div class="l">${esc(k.judul)}${k.jumlah === null ? " · belum dihitung" : ""}</div></div>`)
    .join("");

  const skuItem = (nama: string, d: SkuKomponen): Item => ({
    nama,
    untuk: `${d.jumlah_part} part · ${formatAngka(d.luas_m2, 2)} m²${d.tidak_muat.length ? ` · ${d.tidak_muat.length} part tidak muat` : ""}`,
    jumlah: d.lembar, satuan: "lembar", status: d.status, konf: d.tidak_muat.length > 0 || d.validasi_nesting !== "lolos",
    rumus: "",
  });
  const papanMeter = itemTab(h, ["papan"]);
  const papan = kmp
    ? [
        ...Object.entries(kmp.sku).filter(([, d]) => !d.hpl).map(([n, d]) => skuItem(n, d)),
        ...Object.entries(kmp.sku).filter(([, d]) => d.hpl).map(([n, d]) => skuItem(n, d)),
        ...papanMeter.filter((i) => i.nama.startsWith("AICA")),
      ]
    : papanMeter;
  const hardware = itemTab(h, ["hardware", "listrik"]);
  const rakit = itemTab(h, ["sekrup", "finishing"]);
  const tanpaRumus = (tab: string) => BELUM_ADA_RUMUS.filter((x) => x.tab === tab).map((x) => x.item);

  const status = hitungStatus({
    adaEstimasi: true, konflikTerbuka: konflikTerbuka.length, itemPerluKonfirmasi: konfirmasi.length,
    halamanGagal: d.halamanGagal?.length ?? 0, adaDataReal: false, unitTerbaca: d.units.length,
  });
  const hal1 = `<section class="hal">
<div class="kepala1"><div><div class="merek"><img src="${logo}" alt=""><div><b>PUTRA CORPORATION</b><small>Gambar kerja ${esc(tanggalId(p.tanggalGambar))}${p.surveyor ? ` · Surveyor ${esc(p.surveyor)}` : ""}</small></div></div><h1>Estimasi Belanja Material</h1></div>
<div><div class="sub">${esc(p.pekerjaan || "Pekerjaan belum diisi")} · ${esc(p.klien || "Klien belum diisi")}${p.lokasi ? `, ${esc(p.lokasi)}` : ""}</div><div style="text-align:right"><span class="draf">DRAF · belum disetujui</span><div style="color:#D5CFC6;font-size:10px;margin-top:4px">Status: ${esc(NAMA_STATUS_PROYEK[status.status])} · Pembelian: ${esc(NAMA_KESIAPAN[status.kesiapanPembelian])}</div></div></div></div>
<div class="ring">${ringHtml}</div>
<div class="kolom3">
<div class="bag"><h3><i>A</i>Papan &amp; HPL</h3>${kolom(papan, tanpaRumus("papan"))}</div>
<div class="bag"><h3><i>B</i>Hardware &amp; Aksesori</h3>${kolom(hardware, tanpaRumus("listrik"))}</div>
<div class="bag"><h3><i>C</i>Perakitan &amp; Finishing <span class="tag">asumsi</span></h3>${kolom(rakit)}</div>
</div>
${kaki(1, adaKonfirmasi ? "Estimasi dari lembar kerja. Baca halaman 4 sebelum belanja: ada hal yang perlu dikonfirmasi." : "Estimasi dari lembar kerja.")}
</section>`;

  // --- halaman 2: peta area kerja (gambar dari lembar kerja tim) ---
  const NAMA_GAMBAR: Record<string, string> = { denah: "Denah", elevasi: "Tampak depan", detail: "Detail", lainnya: "Lembar kerja", title_block: "Lembar kerja" };
  const kapsyen = (g: DataPdf["gambar"][number]) =>
    `${NAMA_GAMBAR[g.jenis] ?? "Lembar kerja"} · halaman PDF ${g.halaman}${g.lembarTercetak ? ` · lembar ${esc(g.lembarTercetak)}` : ""}`;
  const [g1, g2] = d.gambar;
  const gambarHtml = g1
    ? `<div class="kartu gbr"><h4>${kapsyen(g1)}</h4><div class="bingkai"><img src="${g1.uri}" alt="${esc(kapsyen(g1))}"></div></div>`
    : `<div class="kartu gbr"><h4>Gambar lembar kerja</h4><p class="cat">Gambar halaman tidak tersedia.</p></div>`;
  const gambar2Html = g2
    ? `<div class="kartu gbr kecil"><h4>${kapsyen(g2)}</h4><div class="bingkai"><img src="${g2.uri}" alt="${esc(kapsyen(g2))}"></div></div>`
    : "";
  const unitHtml = d.units.length
    ? d.units.map((u) => `<div class="kartu uc"><b>${esc(u.nama)}</b><small>${esc(NAMA_JENIS[u.jenis] ?? u.jenis)}${u.bahanUtama ? ` · ${esc(u.bahanUtama)}` : ""}</small><small>${u.lebarMm !== null ? `lebar ${formatAngka(u.lebarMm)} mm · ` : "lebar belum terbaca · "}${u.pintu} pintu · ${u.laci} laci</small></div>`).join("")
    : `<div class="kartu uc"><b>Belum ada unit terbaca</b></div>`;
  const spekHtml = d.spek.length
    ? d.spek.map((s) => `<div class="sp"><span>${esc(NAMA_SPEK[s.kunci] ?? s.kunci)}${s.unit ? ` (${esc(s.unit)})` : ""}</span><b>${esc(s.nilai)}</b></div>`).join("")
    : `<p class="cat">Tidak ada spesifikasi terbaca.</p>`;
  const hal2 = `<section class="hal">
${kepala2(d, logo, "Peta Area Kerja", "Gambar dari lembar kerja dan unit terbaca")}
<div class="peta">
${gambarHtml}
<div class="sisi">${gambar2Html}<div><h4>Spesifikasi</h4>${spekHtml}</div></div>
</div>
<div class="grid3" style="margin-top:4mm">${unitHtml}</div>
${kaki(2, "Gambar apa adanya dari lembar kerja yang diunggah, bukan untuk ukuran potong. Unit dan spesifikasi hasil baca; tiap nilai menunjuk halaman PDF sumbernya.")}
</section>`;

  // --- halaman 3: logika pemakaian material (bahan per unit) ---
  const semua = BARIS.map((b) => ({ b, v: ambil(h, b.kelompok, b.kunci) })).filter((x) => x.v);
  const sumberSop = [...new Set(semua.map(({ v }) => v!.sumber).filter((x): x is string => !!x))];
  const aturanHtml = d.aturanBahan.map((a2) => `<div class="kartu"><b>${esc(a2.nama)}</b><p>${esc(a2.isi)}</p></div>`).join("");
  let matriks: string;
  if (kmp) {
    const units = kmp.unit;
    const baris = (hplFlag: boolean) =>
      Object.entries(kmp.sku).filter(([, x]) => x.hpl === hplFlag).map(([n, x]) =>
        `<tr><td><b>${esc(n)}</b></td>${units.map((u) => `<td class="n" style="text-align:center">${x.luas_per_unit[u] !== undefined ? formatAngka(x.luas_per_unit[u], 1) : "–"}</td>`).join("")}<td class="n" style="background:#F0EBDD;text-align:center">${formatAngka(x.lembar)} lembar</td></tr>`).join("");
    matriks = `<div class="kartu" style="padding:0;overflow:hidden"><table><thead><tr><th>Bahan (luas part, m²)</th>${units.map((u) => `<th style="text-align:center">${esc(u)}</th>`).join("")}<th style="text-align:center">Belanja</th></tr></thead><tbody>${baris(false)}${baris(true)}</tbody></table></div>
<p class="cat" style="margin-top:3mm">Luas belum termasuk sisa potong. Jumlah lembar berasal dari nesting lembar ${formatAngka(kmp.parameter.lembar_mm[1])} x ${formatAngka(kmp.parameter.lembar_mm[0])} mm, tebal potong ${formatAngka(kmp.parameter.tebal_potong_mm, 1)} mm, trim ${formatAngka(kmp.parameter.trim_mm)} mm; HPL +${formatAngka(kmp.parameter.kelebihan_hpl_mm)} mm dan tidak diputar. Ukuran part dibaca dari lembar kerja; status gambar, skala, atau asumsi. Alokasi per unit belum diverifikasi sebagai pemakaian fisik.</p>`;
  } else {
    const papanRumus = semua.filter(({ b }) => b.tab === "papan")
      .map(({ b, v }) => `<tr><td><b>${esc(b.item)}</b></td><td>${esc(rumusId(v!.rumus))}</td><td class="n">${formatAngka(v!.jumlah)} ${esc(v!.satuan)}</td></tr>`).join("");
    matriks = `<div class="kartu" style="padding:0;overflow:hidden"><table><thead><tr><th>Item</th><th>Rumus</th><th style="text-align:right">Jumlah</th></tr></thead><tbody>${papanRumus || '<tr><td colspan="3" class="cat">Belum ada hitungan papan.</td></tr>'}</tbody></table></div>
<p class="cat" style="margin-top:3mm">Daftar komponen tidak terbaca dari lembar kerja, sehingga papan dihitung dari tarif per meter kabinet (SOP pengguna).</p>`;
  }
  const hal3 = `<section class="hal">
${kepala2(d, logo, "Logika Pemakaian Material", "Kebutuhan dibagi per unit")}
<div class="dua" style="grid-template-columns:2.4fr 1fr">
<div>${matriks}</div>
<div class="aturan"><h4>Aturan pilih bahan (RuleSet versi ${d.estimasi.ruleSetVersi ?? "-"})</h4>${aturanHtml}</div>
</div>
${kaki(3, "Estimasi versi " + d.estimasi.versi + ". Masukan dan versi aturan yang sama menghasilkan angka yang sama.")}
</section>`;

  // --- halaman 4: konfirmasi ---
  const daftar: { judul: string; ket: string }[] = [
    ...konflikTerbuka.map((k) => ({ judul: "Konflik gambar belum dijawab", ket: rumusId(k.deskripsi) })),
    ...konfirmasi,
  ];
  const konfHtml = daftar.length
    ? daftar.map((k, i) => `<div class="nomor"><i>${i + 1}</i><div><b>${esc(k.judul)}</b><p>${esc(k.ket)}</p></div></div>`).join("")
    : `<p class="cat">Tidak ada item yang perlu dikonfirmasi.</p>`;
  const asumsi = [
    "Ukuran pintu yang tidak tertulis memakai ukuran asumsi: bawah 60 x 70 cm, atas 40 x 70 cm.",
    "Tarif per meter kabinet adalah standar workshop yang diberikan pengguna (status asumsi), berlaku untuk tinggi standar 70–80 cm.",
    "Lembar 1200 x 2400 mm, tebal potong 3,2 mm. Barang yang dibeli utuh dibulatkan ke atas pada total proyek.",
    ...Object.values(d.estimasi.masukan).flatMap((f) => {
      const ff = f as FieldMasukan<unknown>;
      return ff && typeof ff === "object" && !Array.isArray(ff) && "asal" in ff && ff.asal === "asumsi" ? ff.catatan : [];
    }),
  ];
  const tidak = ["HPL, kabel, saklar, stop kontak, lampu, dan rumah lampu (belum ada rumus)", "AICA, kaca, dan hanger tarik (kebijakan pembelian belum ditetapkan)", "Harga, RAB, dan purchase order (di luar cakupan)"];
  const uji = kmp?.uji_trim;
  const ujiHtml = !kmp
    ? '<p class="cat">Tersedia bila daftar komponen terbaca.</p>'
    : `<p class="cat"><b>Trim ${uji?.trim_mm ?? 10} mm per tepi</b>: ${
        uji && (uji.berubah.length || Object.keys(uji.tidak_muat).length)
          ? [
              ...uji.berubah.map((x) => `${esc(x.sku)} jadi ${x.lembar_trim} (sebelumnya ${x.lembar})`),
              ...Object.entries(uji.tidak_muat).map(([s2, ids]) => `${esc(s2)}: ${ids.length} part tidak muat`),
            ].join("; ")
          : "tidak ada bahan yang berubah"
      }</p>`;
  const rendah = kmp
    ? Object.entries(kmp.sku).filter(([, x]) => x.lembar > 0).sort((a1, b1) => a1[1].isi_terakhir_persen - b1[1].isi_terakhir_persen).slice(0, 4)
    : [];
  const isiHtml = rendah.length
    ? `<h4 style="margin-top:12px">Lembar terakhir terpakai sedikit</h4>${rendah.map(([n2, x]) => `<div style="display:flex;align-items:center;gap:8px;font-size:10px;margin:3px 0"><span style="width:38%">${esc(n2)}</span><span style="flex:1;background:#EDE7DA;border-radius:4px;height:8px"><i style="display:block;height:8px;border-radius:4px;background:#E8890C;width:${Math.min(100, x.isi_terakhir_persen)}%"></i></span><b class="n" style="width:12%;text-align:right">${formatAngka(x.isi_terakhir_persen, 1)}%</b></div>`).join("")}<p class="cat">Bahan ini bisa turun 1 lembar bila ukuran final sedikit lebih kecil.</p>`
    : "";
  const hal4 = `<section class="hal">
${kepala2(d, logo, "Konfirmasi Sebelum Belanja", "Hal yang bisa mengubah jumlah")}
<div class="dua" style="grid-template-columns:1.6fr 1fr;gap:9mm">
<div><h4>Perlu dikonfirmasi</h4><div class="kol2">${konfHtml}</div></div>
<div><h4>Asumsi utama</h4><ul class="p">${asumsi.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
<h4 style="margin-top:12px">Tidak termasuk belanja</h4><ul class="p">${tidak.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
<h4 style="margin-top:12px">Uji perubahan</h4>${ujiHtml}${isiHtml}</div>
</div>
${kaki(4, `Estimasi versi ${d.estimasi.versi} · RuleSet versi ${d.estimasi.ruleSetVersi ?? "-"} · dibuat ${d.estimasi.dibuat.toISOString().slice(0, 10)}`)}
</section>`;

  // --- halaman 5: dasar hitungan ---
  const rumusHtml = semua
    .map(({ b, v }) => `<tr><td><b>${esc(b.item)}</b></td><td>${esc(rumusId(v!.rumus))}</td><td class="n">${formatAngka(v!.jumlah)} ${esc(v!.satuan)}</td><td>${esc(NAMA_STATUS[v!.status] ?? v!.status)} · ${esc(v!.asal_bukti)}</td></tr>`)
    .join("");
  const hal5 = `<section class="hal">
${kepala2(d, logo, "Dasar Hitungan", "Rumus dan status tiap angka")}
<div class="kartu" style="padding:0;overflow:hidden;margin-top:4mm"><table><thead><tr><th>Item</th><th>Rumus</th><th style="text-align:right">Jumlah</th><th>Status · asal bukti</th></tr></thead><tbody>${rumusHtml || '<tr><td colspan="4" class="cat">Belum ada angka yang bisa dihitung.</td></tr>'}</tbody></table></div>
${sumberSop.length ? `<p class="cat" style="margin:3mm 0 0">Sumber koefisien (catalog_stated): ${esc(sumberSop.join(" "))}</p>` : ""}
${kaki(5, "Rumus per meter dan hardware dari SOP pengguna; komponen dan nesting menurut daftar potongan hasil baca.")}
</section>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Estimasi Belanja Material - ${esc(p.klien)}</title><style>${css()}</style></head><body>${hal1}${hal2}${hal3}${hal4}${hal5}</body></html>`;
}

// ---------------------------------------------------------------- Chrome → PDF
export function cariChrome(): string | null {
  const kandidat = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean) as string[];
  return kandidat.find((k) => fs.existsSync(k)) ?? null;
}

export async function htmlKePdf(html: string): Promise<Buffer> {
  const chrome = cariChrome();
  if (!chrome) throw new Error("Chrome/Chromium tidak ditemukan. Pasang Chrome atau isi CHROME_PATH di .env.local.");
  const kerja = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-"));
  try {
    const berkas = path.join(kerja, "hasil.html");
    const keluar = path.join(kerja, "hasil.pdf");
    fs.writeFileSync(berkas, html, "utf-8");
    await new Promise<void>((resolve, reject) => {
      const p = spawn(
        chrome,
        ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer", `--user-data-dir=${path.join(kerja, "profil")}`, `--print-to-pdf=${keluar}`, pathToFileURL(berkas).href],
        { stdio: "ignore" },
      );
      const t = setTimeout(() => { p.kill(); reject(new Error("Pembuatan PDF melebihi 60 detik.")); }, 60000);
      p.on("error", (e) => { clearTimeout(t); reject(e); });
      p.on("close", () => { clearTimeout(t); resolve(); });
    });
    if (!fs.existsSync(keluar)) throw new Error("Chrome tidak menghasilkan PDF.");
    return fs.readFileSync(keluar);
  } finally {
    fs.rmSync(kerja, { recursive: true, force: true });
  }
}
