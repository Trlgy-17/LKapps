import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ambilDb, schema } from "@/db";
import { ambilProyek, lembarKerjaTerbaru } from "@/lib/proyek";
import { wajibMasuk } from "@/lib/sesi";

/** Ringkasan hasil baca saja. Layar Review dua panel dikerjakan di Tahap 5. */
export default async function RingkasanBaca({ params }: { params: Promise<{ id: string }> }) {
  const p = await wajibMasuk("proyek.baca");
  const { id } = await params;
  const db = await ambilDb();
  const pr = /^[0-9a-f-]{36}$/.test(id) ? await ambilProyek(db, p.workspaceId, id) : null;
  if (!pr) notFound();
  const lk = await lembarKerjaTerbaru(db, id);
  if (!lk) notFound();
  const bidang = await db.select().from(schema.bidangTerbaca).where(eq(schema.bidangTerbaca.lembarKerjaId, lk.id));
  const unit = await db.select().from(schema.unitTerbaca).where(eq(schema.unitTerbaca.lembarKerjaId, lk.id));
  const konflik = await db.select().from(schema.konflik).where(eq(schema.konflik.lembarKerjaId, lk.id));
  const hitung = (j: string) => bidang.filter((b) => b.jenis === j).length;

  return (
    <>
      <div className="kepala">
        <h1>Hasil Baca</h1>
        <Link href={`/proyek/${id}/unggah`} className="tombol sekunder">Kembali</Link>
      </div>
      <div className="ringkasan">
        <div className="kartu"><div className="angka">{unit.length}</div><div className="muted">Unit</div></div>
        <div className="kartu"><div className="angka">{hitung("spek")}</div><div className="muted">Spek</div></div>
        <div className="kartu"><div className="angka">{hitung("ukuran")}</div><div className="muted">Ukuran</div></div>
        <div className="kartu"><div className="angka">{hitung("ukuran_hilang")}</div><div className="muted">Ukuran belum ada</div></div>
        <div className="kartu"><div className="angka">{konflik.length}</div><div className="muted">Konflik gambar</div></div>
      </div>
      <p className="muted">Layar review (gambar di kiri, data di kanan, jawab konflik) menyusul di Tahap 5.</p>
    </>
  );
}
