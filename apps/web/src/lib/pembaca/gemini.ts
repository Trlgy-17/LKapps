import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ADENDUM, muatSystemPrompt } from "./claude";
import { SkemaHalaman, type HasilBacaHalaman, type PembacaGambar } from "./skema";

// Diuji dengan kunci tingkat gratis: pro = kuota 0 (429), flash = sering 503; flash-lite berhasil membaca halaman dan mengikuti skema.
// Untuk akurasi baca lebih tinggi pada akun berbayar, isi GEMINI_MODEL (mis. gemini-pro-latest).
export const MODEL_GEMINI_BAWAAN = "gemini-flash-lite-latest";

/** JSON Schema dari skema zod, tanpa kunci $schema yang tidak dipakai Gemini. */
export function skemaJsonGemini(): Record<string, unknown> {
  const { $schema: _abaikan, ...sisa } = z.toJSONSchema(SkemaHalaman) as Record<string, unknown>;
  return buang(sisa) as Record<string, unknown>;
}

/** Hapus batas bilangan bulat aman JS (+-9e15) yang ditambahkan zod; tidak bermakna untuk skema ini. */
function buang(n: unknown): unknown {
  if (Array.isArray(n)) return n.map(buang);
  if (n && typeof n === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
      if ((k === "minimum" || k === "maximum") && typeof v === "number" && Math.abs(v) >= 9e15) continue;
      o[k] = buang(v);
    }
    return o;
  }
  return n;
}

type KlienGemini = Pick<GoogleGenAI, "models">;

const JEDA_ULANG_MS = [3000, 8000, 20000, 45000]; // tetap, tanpa acak; 503 "high demand" bisa berlangsung menit
const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sementara(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|fetch failed|ECONNRESET|ETIMEDOUT/i.test(m);
}

export function kunciGemini(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

export function buatPembacaGemini(
  opsi: { model?: string; klien?: KlienGemini; systemPrompt?: string; jeda?: number[] } = {},
): PembacaGambar {
  let klien = opsi.klien;
  if (!klien) {
    const apiKey = kunciGemini();
    if (!apiKey) throw new Error("GEMINI_API_KEY belum diisi.");
    klien = new GoogleGenAI({ apiKey });
  }
  const model = opsi.model ?? process.env.GEMINI_MODEL ?? MODEL_GEMINI_BAWAAN;
  const sistem = (opsi.systemPrompt ?? muatSystemPrompt()) + ADENDUM;
  const skema = skemaJsonGemini();
  const jeda = opsi.jeda ?? JEDA_ULANG_MS;

  return {
    async bacaHalaman(png, info): Promise<HasilBacaHalaman> {
      const perintah = `Halaman PDF ${info.nomor} dari ${info.total}. Baca halaman ini dan isi skema JSON.`;
      let galatTerakhir: unknown;
      for (let percobaan = 0; percobaan <= jeda.length; percobaan++) {
        try {
          const res = await klien!.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }, { text: perintah }],
              },
            ],
            config: {
              systemInstruction: sistem,
              responseMimeType: "application/json",
              responseJsonSchema: skema,
              temperature: 0,
              maxOutputTokens: 32000,
            },
          });
          const fr = res.candidates?.[0]?.finishReason;
          if (fr && String(fr) !== "STOP") {
            throw new Error(`Keluaran halaman ${info.nomor} berhenti dengan alasan ${String(fr)}.`);
          }
          const teks = res.text;
          if (!teks) throw new Error(`Keluaran halaman ${info.nomor} kosong.`);
          return SkemaHalaman.parse(JSON.parse(teks));
        } catch (e) {
          galatTerakhir = e;
          const perluUlang = sementara(e) || e instanceof SyntaxError || e instanceof z.ZodError;
          if (!perluUlang || percobaan === jeda.length) break;
          await tidur(jeda[percobaan]);
        }
      }
      const pesan = galatTerakhir instanceof z.ZodError
        ? `Keluaran halaman ${info.nomor} tidak sesuai skema: ${galatTerakhir.issues[0]?.path.join(".")} ${galatTerakhir.issues[0]?.message}`
        : galatTerakhir instanceof Error ? galatTerakhir.message : String(galatTerakhir);
      throw new Error(pesan);
    },
  };
}
