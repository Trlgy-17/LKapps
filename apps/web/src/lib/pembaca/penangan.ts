import { eq } from "drizzle-orm";
import { schema } from "@/db";
import { antre, daftarkanPenangan, type Konteks } from "@/lib/antrean";
import { ambilPenyimpanan, type Penyimpanan } from "@/lib/storage";
import { buatPembacaDariEnv } from "./pilih";
import { HALAMAN_KOSONG } from "./rekaman";
import { simpanHasilBaca } from "./simpan";
import type { HasilBacaHalaman, PembacaGambar } from "./skema";

const PARALEL = Number(process.env.PEMBACA_PARALEL) || 4; // turunkan (mis. 2) bila kena batas laju API; PDF 17 halaman < 3 menit (PRD §10)

async function paralel<T, R>(isi: T[], batas: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const hasil = new Array<R>(isi.length);
  let berikut = 0;
  const pekerja = Array.from({ length: Math.min(batas, isi.length) }, async () => {
    while (true) {
      const i = berikut++;
      if (i >= isi.length) return;
      hasil[i] = await fn(isi[i], i);
    }
  });
  await Promise.all(pekerja);
  return hasil;
}

/** Ubah galat teknis SDK (Gemini atau Claude) menjadi pesan yang bisa ditindaklanjuti pengguna. */
export function pesanGalat(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Could not resolve authentication|authentication_error|invalid x-api-key|API key not valid|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED|\b401\b|\b403\b/i.test(m)) {
    return "kunci API AI belum diisi atau tidak valid. Isi GEMINI_API_KEY (atau ANTHROPIC_API_KEY bila PEMBACA_AI=claude) di apps/web/.env.local, restart server, lalu klik Coba lagi.";
  }
  if (/\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(m)) {
    return "batas laju atau kuota API AI tercapai. Tunggu sebentar atau periksa kuota, lalu klik Coba lagi.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|Connection error/i.test(m)) {
    return "tidak bisa terhubung ke API AI. Periksa koneksi internet lalu klik Coba lagi.";
  }
  return m;
}

export async function bacaLembarKerja(
  k: Konteks,
  pembaca: PembacaGambar,
  st: Penyimpanan = ambilPenyimpanan(),
) {
  const lkId = String(k.job.payload.lembarKerjaId);
  const hal = await k.db
    .select()
    .from(schema.halamanLembar)
    .where(eq(schema.halamanLembar.lembarKerjaId, lkId))
    .orderBy(schema.halamanLembar.nomor);
  if (hal.length === 0) throw new Error("Belum ada halaman untuk dibaca");
  await k.lapor(0, hal.length);
  await k.db.update(schema.lembarKerja).set({ tahap: "baca", halamanDibaca: 0 }).where(eq(schema.lembarKerja.id, lkId));

  let selesai = 0;
  const gagal: { nomor: number; pesan: string }[] = [];
  try {
    // Halaman yang gagal setelah percobaan ulang tidak menggagalkan seluruh lembar kerja: hasil tetap keluar
    // dari halaman yang terbaca, dan halaman gagal dicatat supaya muncul di daftar konfirmasi.
    const hasil: (HasilBacaHalaman | null)[] = await paralel(hal, PARALEL, async (h) => {
      let r: HasilBacaHalaman | null = null;
      try {
        r = await pembaca.bacaHalaman(await st.baca(h.kunciBesar), { nomor: h.nomor, total: hal.length });
      } catch (e) {
        gagal.push({ nomor: h.nomor, pesan: pesanGalat(e) });
      }
      selesai++;
      await k.lapor(selesai);
      await k.db.update(schema.lembarKerja).set({ halamanDibaca: selesai }).where(eq(schema.lembarKerja.id, lkId));
      return r;
    });
    gagal.sort((x, y) => x.nomor - y.nomor);
    if (gagal.length === hal.length) {
      throw new Error(`Semua halaman gagal dibaca. Halaman ${gagal[0].nomor}: ${gagal[0].pesan}`);
    }
    await simpanHasilBaca(k.db, lkId, hasil.map((r) => r ?? HALAMAN_KOSONG)); // urutan sesuai nomor halaman
    await k.db
      .update(schema.lembarKerja)
      .set({
        status: "selesai",
        halamanGagal: gagal.map((g) => g.nomor),
        galat: gagal.length ? `Halaman ${gagal.map((g) => g.nomor).join(", ")} gagal dibaca (${gagal[0].pesan})` : null,
      })
      .where(eq(schema.lembarKerja.id, lkId));
    await antre(k.db, "hitung_estimasi", { lembarKerjaId: lkId }); // hasil keluar otomatis setelah dibaca
  } catch (e) {
    await k.db
      .update(schema.lembarKerja)
      .set({ status: "gagal", galat: e instanceof Error ? e.message : String(e) })
      .where(eq(schema.lembarKerja.id, lkId));
    throw e;
  }
}

export function daftarkanPenanganBaca(opsi: { pembaca?: PembacaGambar; st?: Penyimpanan } = {}) {
  daftarkanPenangan("baca_ai", (k) => {
    const pembaca =
      opsi.pembaca ??
      buatPembacaDariEnv();
    return bacaLembarKerja(k, pembaca, opsi.st ?? ambilPenyimpanan());
  });
}
