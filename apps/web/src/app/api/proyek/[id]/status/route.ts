import { NextResponse } from "next/server";
import { ambilDb } from "@/db";
import { ambilProyek, halamanLembar, lembarKerjaTerbaru } from "@/lib/proyek";
import { penggunaSaatIni } from "@/lib/sesi";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await penggunaSaatIni();
  if (!p) return NextResponse.json({ galat: "Belum masuk." }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ galat: "Tidak ditemukan." }, { status: 404 });
  const db = await ambilDb();
  const proyek = await ambilProyek(db, p.workspaceId, id);
  if (!proyek) return NextResponse.json({ galat: "Tidak ditemukan." }, { status: 404 });
  const lk = await lembarKerjaTerbaru(db, id);
  if (!lk) return NextResponse.json({ galat: "Belum ada lembar kerja." }, { status: 404 });
  const hal = await halamanLembar(db, lk.id);
  return NextResponse.json({
    status: lk.status,
    galat: lk.galat,
    namaFile: lk.namaFile,
    ukuranByte: lk.ukuranByte,
    totalHalaman: lk.halaman,
    halamanGagal: lk.halamanGagal,
    tahap: lk.tahap,
    halamanDibaca: lk.halamanDibaca,
    halaman: hal.map((h) => ({ nomor: h.nomor, lebar: h.lebarPx, tinggi: h.tinggiPx })),
    lembarKerjaId: lk.id,
  });
}
