import { createHmac, timingSafeEqual } from "node:crypto";

export const MASA_SESI_DETIK = 60 * 60 * 12;

export type IsiSesi = { uid: string; exp: number };

function tanda(isi: string, rahasia: string): string {
  return createHmac("sha256", rahasia).update(isi).digest("base64url");
}

export function buatToken(uid: string, rahasia: string, sekarang = Date.now()): string {
  if (!rahasia || rahasia.length < 16) throw new Error("SESSION_SECRET minimal 16 karakter");
  const isi = Buffer.from(
    JSON.stringify({ uid, exp: Math.floor(sekarang / 1000) + MASA_SESI_DETIK }),
  ).toString("base64url");
  return `${isi}.${tanda(isi, rahasia)}`;
}

export function bacaToken(token: string | undefined, rahasia: string, sekarang = Date.now()): IsiSesi | null {
  if (!token || !rahasia) return null;
  const [isi, ttd] = token.split(".");
  if (!isi || !ttd) return null;
  const benar = Buffer.from(tanda(isi, rahasia));
  const uji = Buffer.from(ttd);
  if (benar.length !== uji.length || !timingSafeEqual(benar, uji)) return null;
  try {
    const data = JSON.parse(Buffer.from(isi, "base64url").toString()) as IsiSesi;
    return data.exp > Math.floor(sekarang / 1000) ? data : null;
  } catch {
    return null;
  }
}
