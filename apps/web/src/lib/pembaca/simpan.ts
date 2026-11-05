import { and, eq } from "drizzle-orm";
import { schema, type Db } from "@/db";
import type { Posisi } from "@/db/schema";
import { catat } from "@/lib/audit";
import { deteksiKonflik, normalisasiNama, type UkuranBaca } from "./konflik";
import { jepitKeyakinan, type HasilBacaHalaman } from "./skema";

/** Ukuran pintu asumsi kitchen set (mm), sinkron dengan engine/pintu_standar.py. Hanya bawah dan atas. */
export const PINTU_ASUMSI = {
  bawah: { lebarMm: 600, tinggiMm: 700 },
  atas: { lebarMm: 400, tinggiMm: 700 },
} as const;
export function asumsiPintu(letak: string) {
  return letak === "bawah" || letak === "atas" ? PINTU_ASUMSI[letak] : null;
}

/** th009d / TH 009 D / th 009 d -> "TH 009 D". Angka nol awal dan suffix dipertahankan; kode kabur dikembalikan null. */
export function normalisasiKodeHpl(teks: string): string | null {
  const m = /(?:^|[^a-z0-9])th\s*(\d{3})\s*([a-z])?(?![a-z0-9])/i.exec(teks);
  if (!m) return null;
  return `TH ${m[1]}` + (m[2] ? ` ${m[2].toUpperCase()}` : "");
}

/** 27/10/2026 atau 27-10-2026 -> 2026-10-27; YYYY-MM-DD dipertahankan; selain itu undefined (tidak ditebak). */
export function isoTanggal(t: string | undefined | null): string | undefined {
  if (!t) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.trim());
  const id = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t.trim());
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : id ? [id[3], id[2].padStart(2, "0"), id[1].padStart(2, "0")] : [];
  if (!y) return undefined;
  const tgl = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return tgl.getUTCFullYear() === Number(y) && tgl.getUTCMonth() + 1 === Number(m) && tgl.getUTCDate() === Number(d) ? `${y}-${m}-${d}` : undefined;
}

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

function posisiValid(p: Posisi | null): Posisi | null {
  if (!p) return null;
  const ok = [p.x, p.y, p.w, p.h].every((v) => Number.isFinite(v)) && p.w > 0 && p.h > 0;
  if (!ok) return null;
  const x = Math.min(1, Math.max(0, p.x));
  const y = Math.min(1, Math.max(0, p.y));
  return { x, y, w: Math.min(p.w, 1 - x), h: Math.min(p.h, 1 - y) };
}

/**
 * Simpan hasil baca seluruh halaman. Menghapus hasil baca lama lembar kerja ini (baca ulang),
 * mendeteksi konflik dengan kode, dan mengisi data proyek yang masih kosong dari title block.
 */
export async function simpanHasilBaca(db: Db, lembarKerjaId: string, perHalaman: HasilBacaHalaman[]) {
  // perHalaman[i] = halaman i+1
  await db.delete(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.lembarKerjaId, lembarKerjaId));
  await db.delete(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lembarKerjaId));
  await db.delete(schema.konflik).where(eq(schema.konflik.lembarKerjaId, lembarKerjaId));

  const bidang: (typeof schema.bidangTerbaca.$inferInsert)[] = [];
  const unit: (typeof schema.unitTerbaca.$inferInsert)[] = [];
  const ukuran: UkuranBaca[] = [];

  perHalaman.forEach((h, i) => {
    const halaman = i + 1;
    const dasar = { lembarKerjaId, halaman };
    for (const u of h.unit) {
      // Beberapa tampak dari satu kabinet tetap satu unit (SYSTEM_PROMPT §8.3): gabung menurut nama + jenis.
      const k = `${normalisasiNama(u.nama)}|${u.jenis}`;
      const ada = unit.find((x) => `${normalisasiNama(x.nama)}|${x.jenis}` === k);
      if (ada) {
        ada.halamanSemua = [...new Set([...(ada.halamanSemua ?? []), halaman])];
        ada.bahanUtama ??= u.bahan_utama;
      } else {
        unit.push({
          ...dasar, nama: u.nama, jenis: u.jenis, bahanUtama: u.bahan_utama,
          halamanSemua: [halaman], posisi: posisiValid(u.posisi),
        });
      }
    }
    if (h.title_block) {
      const t = h.title_block;
      for (const [kunci, nilai] of [
        ["klien", t.klien], ["lokasi", t.lokasi], ["pekerjaan", t.pekerjaan],
        ["surveyor", t.surveyor], ["tanggal_gambar", t.tanggal_gambar],
      ] as const) {
        if (nilai) {
          bidang.push({
            ...dasar, jenis: "title_block", kunci, nilai, status: "gambar",
            keyakinan: jepitKeyakinan(t.keyakinan), posisi: posisiValid(t.posisi),
          });
        }
      }
    }
    for (const d of h.pintu) {
      if (!Number.isInteger(d.jumlah) || d.jumlah < 1) continue;
      const pos = posisiValid(d.posisi);
      const ukuranAda = d.lebar_mm !== null && d.tinggi_mm !== null;
      bidang.push({
        ...dasar, jenis: "pintu", kunci: `pintu_${d.letak}`, nilai: String(d.jumlah), status: "gambar",
        keyakinan: 100, posisi: pos, unitNama: d.unit,
        data: { letak: d.letak, fungsi: d.fungsi, inset: d.inset, jumlah: d.jumlah, lebarMm: d.lebar_mm, tinggiMm: d.tinggi_mm },
      });
      const asumsi = asumsiPintu(d.letak);
      if (!ukuranAda && asumsi) {
        // FR-14: ukuran tidak ada -> hitung ditahan sampai diisi atau asumsi diterima pengguna.
        bidang.push({
          ...dasar, jenis: "ukuran_hilang", kunci: `${d.unit ?? "pintu"}|pintu_${d.letak}`, nilai: "",
          status: "belum_ada", keyakinan: 0, posisi: pos, unitNama: d.unit,
          data: { sumbu: "lebar_tinggi", alasan: "Ukuran pintu tidak tertulis", jumlah: d.jumlah, letak: d.letak, asumsi },
        });
      }
    }
    if (h.jumlah_sudut_robot !== null && Number.isInteger(h.jumlah_sudut_robot) && h.jumlah_sudut_robot > 0) {
      bidang.push({
        ...dasar, jenis: "sudut_robot", kunci: "sudut_robot", nilai: String(h.jumlah_sudut_robot), status: "gambar",
        keyakinan: 100, posisi: null,
      });
    }
    for (const pt of h.part) {
      if (!Number.isInteger(pt.jumlah) || pt.jumlah < 1 || !(pt.panjang_mm > 0) || !(pt.lebar_mm > 0)) continue; // dimensi tidak sah tidak dikoreksi diam-diam: dilewati
      bidang.push({
        ...dasar, jenis: "part", kunci: pt.fungsi, nilai: String(pt.jumlah), status: pt.status_ukuran,
        keyakinan: 100, posisi: posisiValid(pt.posisi), unitNama: pt.unit,
        data: { nama: pt.nama, fungsi: pt.fungsi, panjangMm: pt.panjang_mm, lebarMm: pt.lebar_mm, jumlah: pt.jumlah, statusUkuran: pt.status_ukuran, hplMuka: pt.hpl_muka, kodeHpl: pt.kode_hpl ? normalisasiKodeHpl(pt.kode_hpl) : null },
      });
    }
    for (const l of h.laci) {
      if (!Number.isInteger(l.jumlah) || l.jumlah < 1) continue;
      bidang.push({
        ...dasar, jenis: "laci", kunci: `laci_${l.letak}`, nilai: String(l.jumlah), status: "gambar",
        keyakinan: 100, posisi: posisiValid(l.posisi), unitNama: l.unit,
        data: { letak: l.letak, urutan: l.urutan, jumlah: l.jumlah },
      });
    }
    for (const s of h.spek) {
      const hpl = s.kunci === "kode_hpl" ? normalisasiKodeHpl(s.nilai) : null;
      bidang.push({
        ...dasar, jenis: "spek", kunci: s.kunci, nilai: hpl ?? s.nilai, status: "gambar",
        keyakinan: jepitKeyakinan(s.keyakinan), posisi: posisiValid(s.posisi), unitNama: s.unit,
        data: hpl ? { asli: s.nilai } : {}, // teks asli tetap disimpan
      });
    }
    for (const u of h.ukuran) {
      const pos = posisiValid(u.posisi);
      bidang.push({
        ...dasar, jenis: "ukuran", kunci: `${u.item}|${u.sumbu}`, nilai: u.tertulis, status: u.status,
        keyakinan: jepitKeyakinan(u.keyakinan), posisi: pos, unitNama: u.item,
        data: { sumbu: u.sumbu, nilaiMm: u.nilai_mm, kelompok: u.kelompok, peran: u.peran },
      });
      ukuran.push({ halaman, item: u.item, sumbu: u.sumbu, nilaiMm: u.nilai_mm, kelompok: u.kelompok, peran: u.peran, posisi: pos });
    }
    for (const u of h.ukuran_hilang) {
      bidang.push({
        ...dasar, jenis: "ukuran_hilang", kunci: `${u.item}|${u.sumbu}`, nilai: "", status: "belum_ada",
        keyakinan: 0, posisi: posisiValid(u.posisi), unitNama: u.item, data: { sumbu: u.sumbu, alasan: u.alasan },
      });
    }
    for (const c of h.catatan) {
      bidang.push({
        ...dasar, jenis: "catatan", kunci: "catatan", nilai: c.teks, status: "gambar",
        keyakinan: jepitKeyakinan(c.keyakinan), posisi: posisiValid(c.posisi), unitNama: c.unit,
      });
    }
  });

  for (let i = 0; i < perHalaman.length; i++) {
    await db.update(schema.halamanLembar)
      .set({ lembarTercetak: perHalaman[i].lembar_tercetak ?? null, jenis: perHalaman[i].jenis_halaman })
      .where(and(eq(schema.halamanLembar.lembarKerjaId, lembarKerjaId), eq(schema.halamanLembar.nomor, i + 1)));
  }
  if (bidang.length) await db.insert(schema.bidangTerbaca).values(bidang);
  if (unit.length) await db.insert(schema.unitTerbaca).values(unit);
  const konfliks = deteksiKonflik(ukuran);
  if (konfliks.length) {
    await db.insert(schema.konflik).values(konfliks.map((k) => ({ ...k, lembarKerjaId })));
  }

  await isiDataProyek(db, lembarKerjaId, bidang);
  return { bidang: bidang.length, unit: unit.length, konflik: konfliks.length };
}

/** Title block hanya mengisi kolom yang masih kosong; yang sudah diisi pengguna tidak ditimpa. */
async function isiDataProyek(db: Db, lembarKerjaId: string, bidang: (typeof schema.bidangTerbaca.$inferInsert)[]) {
  const [lk] = await db.select().from(schema.lembarKerja).where(eq(schema.lembarKerja.id, lembarKerjaId));
  const [pr] = await db.select().from(schema.proyek).where(eq(schema.proyek.id, lk.proyekId));
  const tb = bidang.filter((b) => b.jenis === "title_block").sort((a, b) => a.halaman - b.halaman);
  const ambil = (k: string) => tb.find((b) => b.kunci === k)?.nilai;
  const baru: Record<string, string> = {};
  if (!pr.klien && ambil("klien")) baru.klien = ambil("klien")!;
  if (!pr.lokasi && ambil("lokasi")) baru.lokasi = ambil("lokasi")!;
  if (!pr.pekerjaan && ambil("pekerjaan")) baru.pekerjaan = ambil("pekerjaan")!;
  if (!pr.surveyor && ambil("surveyor")) baru.surveyor = ambil("surveyor")!;
  const tgl = isoTanggal(ambil("tanggal_gambar"));
  if (!pr.tanggalGambar && tgl && TANGGAL.test(tgl)) baru.tanggalGambar = tgl;
  if (Object.keys(baru).length === 0) return;
  await db.update(schema.proyek).set(baru).where(and(eq(schema.proyek.id, pr.id)));
  await catat(db, null, "proyek", pr.id, "isi_dari_title_block", {}, baru);
}
