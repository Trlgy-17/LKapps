import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (p: string, s: Buffer, n: number) => Promise<Buffer>;

export async function hashKataSandi(kata: string): Promise<string> {
  const garam = randomBytes(16);
  const hash = await scrypt(kata, garam, 64);
  return `scrypt$${garam.toString("hex")}$${hash.toString("hex")}`;
}

export async function cocokKataSandi(kata: string, tersimpan: string): Promise<boolean> {
  const [skema, garam, hash] = tersimpan.split("$");
  if (skema !== "scrypt" || !garam || !hash) return false;
  const asli = Buffer.from(hash, "hex");
  const uji = await scrypt(kata, Buffer.from(garam, "hex"), asli.length);
  return uji.length === asli.length && timingSafeEqual(uji, asli);
}
