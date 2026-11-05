import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ambilDb, schema } from "@/db";
import { boleh, type Aksi } from "./permissions";
import { bacaToken, buatToken, MASA_SESI_DETIK } from "./session-token";

const NAMA_COOKIE = "sesi";

function rahasia(): string {
  const r = process.env.SESSION_SECRET;
  if (!r || r.length < 16) throw new Error("SESSION_SECRET belum diisi (minimal 16 karakter). Lihat .env.example.");
  return r;
}

export async function mulaiSesi(penggunaId: string) {
  (await cookies()).set(NAMA_COOKIE, buatToken(penggunaId, rahasia()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MASA_SESI_DETIK,
  });
}

export async function akhiriSesi() {
  (await cookies()).delete(NAMA_COOKIE);
}

export async function penggunaSaatIni() {
  const isi = bacaToken((await cookies()).get(NAMA_COOKIE)?.value, rahasia());
  if (!isi) return null;
  const db = await ambilDb();
  const [p] = await db.select().from(schema.pengguna).where(eq(schema.pengguna.id, isi.uid));
  return p && p.aktif ? p : null;
}

/** Halaman wajib login, dan opsional wajib punya hak akses. */
export async function wajibMasuk(aksi?: Aksi) {
  const p = await penggunaSaatIni();
  if (!p) redirect("/masuk");
  if (aksi && !boleh(p.peran, aksi)) redirect("/?dilarang=1");
  return p;
}
