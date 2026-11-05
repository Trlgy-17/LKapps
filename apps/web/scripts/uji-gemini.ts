/** Uji cepat kunci dan model Gemini: tsx scripts/uji-gemini.ts (membaca apps/web/.env.local). */
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";

for (const l of fs.readFileSync(".env.local", "utf-8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const kunci = process.env.GEMINI_API_KEY;
console.log("GEMINI_API_KEY terisi:", !!kunci, "panjang:", kunci?.length ?? 0);
if (!kunci) process.exit(1);
const model = process.env.GEMINI_MODEL || "gemini-pro-latest";
const ai = new GoogleGenAI({ apiKey: kunci });
try {
  const r = await ai.models.generateContent({ model, contents: "Balas satu kata: siap" });
  console.log("model", model, "OK ->", r.text?.slice(0, 40));
} catch (e) {
  console.log("model", model, "GAGAL ->", e instanceof Error ? e.message.slice(0, 400) : String(e));
  process.exit(2);
}
