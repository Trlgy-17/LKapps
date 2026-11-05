import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { ambilDb, schema } from "@/db";
import { cocokKataSandi } from "@/lib/password";
import { mulaiSesi, penggunaSaatIni } from "@/lib/sesi";

async function masuk(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const kata = String(formData.get("kata_sandi") ?? "");
  const db = await ambilDb();
  const [p] = await db
    .select()
    .from(schema.pengguna)
    .where(sql`lower(${schema.pengguna.email}) = ${email.toLowerCase()}`);
  if (!p || !p.aktif || !(await cocokKataSandi(kata, p.kataSandi))) {
    redirect("/masuk?galat=1");
  }
  await mulaiSesi(p.id);
  redirect("/");
}

export default async function HalamanMasuk({ searchParams }: { searchParams: Promise<{ galat?: string }> }) {
  if (await penggunaSaatIni()) redirect("/");
  const { galat } = await searchParams;
  return (
    <main className="masuk">
      <h1>Masuk</h1>
      <p className="muted">Estimasi Material · Putra Corporation</p>
      <form action={masuk} className="kartu">
        {galat && <div className="galat" role="alert">Email atau kata sandi salah.</div>}
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="kata_sandi">Kata sandi</label>
          <input id="kata_sandi" name="kata_sandi" type="password" autoComplete="current-password" required />
        </div>
        <button className="tombol" type="submit">Masuk</button>
      </form>
    </main>
  );
}
