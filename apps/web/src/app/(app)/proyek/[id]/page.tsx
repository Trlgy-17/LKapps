import { notFound, redirect } from "next/navigation";
import { ambilDb } from "@/db";
import { ambilProyek } from "@/lib/proyek";
import { wajibMasuk } from "@/lib/sesi";

export default async function ProyekRoot({ params }: { params: Promise<{ id: string }> }) {
  const p = await wajibMasuk("proyek.baca");
  const { id } = await params;
  const pr = /^[0-9a-f-]{36}$/.test(id) ? await ambilProyek(await ambilDb(), p.workspaceId, id) : null;
  if (!pr) notFound();
  // Halaman hasil menampilkan status proses bila belum ada hasil.
  redirect(`/proyek/${id}/hasil`);
}
