import { NextResponse } from "next/server";
import { ambilDb } from "@/db";
import { DilarangError } from "@/lib/permissions";
import { BATAS_BYTE, UnggahDitolak, buatProyekDariPdf } from "@/lib/proyek";
import { penggunaSaatIni } from "@/lib/sesi";
import { ambilPenyimpanan } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const p = await penggunaSaatIni();
  if (!p) return NextResponse.json({ galat: "Belum masuk." }, { status: 401 });

  const panjang = Number(req.headers.get("content-length") ?? 0);
  if (panjang > BATAS_BYTE + 1024 * 1024) {
    return NextResponse.json({ galat: "File melebihi batas 50 MB." }, { status: 413 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ galat: "Pilih file PDF." }, { status: 400 });
  try {
    const db = await ambilDb();
    const { proyek } = await buatProyekDariPdf(db, { id: p.id, peran: p.peran }, ambilPenyimpanan(), {
      workspaceId: p.workspaceId,
      namaFile: file.name,
      data: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ id: proyek.id });
  } catch (e) {
    if (e instanceof UnggahDitolak) return NextResponse.json({ galat: e.message }, { status: 400 });
    if (e instanceof DilarangError) return NextResponse.json({ galat: "Peran Anda tidak boleh membuat proyek." }, { status: 403 });
    throw e;
  }
}
