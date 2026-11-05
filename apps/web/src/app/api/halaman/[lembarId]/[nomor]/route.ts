import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ambilDb, schema } from "@/db";
import { penggunaSaatIni } from "@/lib/sesi";
import { ambilPenyimpanan } from "@/lib/storage";

/** Gambar halaman PDF: hanya anggota workspace pemilik proyek (PRD §10). */
export async function GET(req: Request, ctx: { params: Promise<{ lembarId: string; nomor: string }> }) {
  const p = await penggunaSaatIni();
  if (!p) return new NextResponse("Belum masuk.", { status: 401 });
  const { lembarId, nomor } = await ctx.params;
  const n = Number(nomor);
  if (!/^[0-9a-f-]{36}$/.test(lembarId) || !Number.isInteger(n) || n < 1) {
    return new NextResponse("Tidak ditemukan.", { status: 404 });
  }
  const db = await ambilDb();
  const [baris] = await db
    .select({ h: schema.halamanLembar })
    .from(schema.halamanLembar)
    .innerJoin(schema.lembarKerja, eq(schema.lembarKerja.id, schema.halamanLembar.lembarKerjaId))
    .innerJoin(schema.proyek, eq(schema.proyek.id, schema.lembarKerja.proyekId))
    .where(
      and(
        eq(schema.halamanLembar.lembarKerjaId, lembarId),
        eq(schema.halamanLembar.nomor, n),
        eq(schema.proyek.workspaceId, p.workspaceId),
      ),
    );
  if (!baris) return new NextResponse("Tidak ditemukan.", { status: 404 });
  const ukuran = new URL(req.url).searchParams.get("u") === "besar" ? "besar" : "thumb";
  const data = await ambilPenyimpanan().baca(ukuran === "besar" ? baris.h.kunciBesar : baris.h.kunciThumb);
  return new NextResponse(new Uint8Array(data), {
    headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" },
  });
}
