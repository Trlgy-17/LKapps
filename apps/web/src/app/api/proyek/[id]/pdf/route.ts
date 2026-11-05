import { NextResponse } from "next/server";
import { ambilDb } from "@/db";
import { boleh } from "@/lib/permissions";
import { bangunHtml, htmlKePdf } from "@/lib/pdf-hasil";
import { kumpulkanDataPdf, namaBerkasPdf } from "@/lib/pdf-data";
import { penggunaSaatIni } from "@/lib/sesi";

export const runtime = "nodejs";

/** Unduh PDF Estimasi Belanja Material (FR-33). Purchasing boleh mengunduh (PRD §2). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const p = await penggunaSaatIni();
  if (!p) return NextResponse.json({ galat: "Belum masuk." }, { status: 401 });
  if (!boleh(p.peran, "hasil.unduh")) return NextResponse.json({ galat: "Peran Anda tidak boleh mengunduh." }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ galat: "Tidak ditemukan." }, { status: 404 });
  const data = await kumpulkanDataPdf(await ambilDb(), p.workspaceId, id);
  if (!data) return NextResponse.json({ galat: "Belum ada hasil estimasi untuk proyek ini." }, { status: 404 });
  try {
    const pdf = await htmlKePdf(bangunHtml(data));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${namaBerkasPdf(data.proyek.klien)}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ galat: e instanceof Error ? e.message : "Gagal membuat PDF." }, { status: 500 });
  }
}
