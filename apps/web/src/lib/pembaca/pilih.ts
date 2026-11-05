import { buatPembacaClaude } from "./claude";
import { buatPembacaGemini, kunciGemini } from "./gemini";
import type { PembacaGambar } from "./skema";

export type Penyedia = "gemini" | "claude";

/** Penyedia AI dari env PEMBACA_AI. Bawaan gemini. Hanya membaca gambar; semua hitungan di kode. */
export function penyediaAktif(): Penyedia {
  return process.env.PEMBACA_AI === "claude" ? "claude" : "gemini";
}

export function buatPembacaDariEnv(): PembacaGambar {
  if (penyediaAktif() === "claude") {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      throw new Error("Pembaca gambar belum siap: PEMBACA_AI=claude tetapi ANTHROPIC_API_KEY belum diisi di apps/web/.env.local.");
    }
    return buatPembacaClaude();
  }
  if (!kunciGemini()) {
    throw new Error("Pembaca gambar belum siap: isi GEMINI_API_KEY di apps/web/.env.local, restart server, lalu klik Coba lagi.");
  }
  return buatPembacaGemini();
}
