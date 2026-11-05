import { afterEach, describe, expect, it, vi } from "vitest";
import { buatPembacaGemini, skemaJsonGemini } from "@/lib/pembaca/gemini";
import { buatPembacaDariEnv, penyediaAktif } from "@/lib/pembaca/pilih";
import { pesanGalat } from "@/lib/pembaca/penangan";
import { isoTanggal } from "@/lib/pembaca/simpan";
import { HALAMAN_KOSONG } from "@/lib/pembaca/rekaman";

type Panggilan = { model: string; contents: unknown; config: Record<string, unknown> };

function klienPalsu(respons: Array<() => unknown>) {
  const panggilan: Panggilan[] = [];
  let i = 0;
  return {
    panggilan,
    klien: {
      models: {
        generateContent: async (p: Panggilan) => {
          panggilan.push(p);
          const r = respons[Math.min(i++, respons.length - 1)]();
          return r as never;
        },
      },
    } as never,
  };
}

const ok = (isi: unknown) => () => ({ text: JSON.stringify(isi), candidates: [{ finishReason: "STOP" }] });
const png = Buffer.from("png-palsu");

describe("pembaca Gemini", () => {
  it("memakai system prompt dokumen, gambar inline, JSON schema, suhu 0", async () => {
    const f = klienPalsu([ok(HALAMAN_KOSONG)]);
    const r = await buatPembacaGemini({ klien: f.klien, model: "gemini-uji", systemPrompt: "ATURAN DOKUMEN" })
      .bacaHalaman(png, { nomor: 3, total: 5 });
    expect(r).toEqual(HALAMAN_KOSONG);
    const p = f.panggilan[0];
    expect(p.model).toBe("gemini-uji");
    expect(String(p.config.systemInstruction)).toContain("ATURAN DOKUMEN");
    expect(String(p.config.systemInstruction)).toContain("ADENDUM APLIKASI");   // AI dilarang menghitung
    expect(p.config.responseMimeType).toBe("application/json");
    expect(p.config.temperature).toBe(0);
    expect(p.config.responseJsonSchema).toBeTruthy();
    const parts = (p.contents as { parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] }[])[0].parts;
    expect(parts[0].inlineData?.mimeType).toBe("image/png");
    expect(parts[0].inlineData?.data).toBe(png.toString("base64"));
    expect(parts[1].text).toContain("Halaman PDF 3 dari 5");
  });

  it("JSON schema tanpa $schema dan memuat bidang kunci", () => {
    const s = skemaJsonGemini();
    expect(s.$schema).toBeUndefined();
    const props = (s as { properties: Record<string, unknown> }).properties;
    for (const k of ["unit", "pintu", "laci", "ukuran", "ukuran_hilang", "lembar_tercetak", "jenis_halaman"]) {
      expect(props).toHaveProperty(k);
    }
  });

  it("mengulang pada 429 lalu berhasil", async () => {
    const f = klienPalsu([() => { throw new Error("429 RESOURCE_EXHAUSTED"); }, ok(HALAMAN_KOSONG)]);
    const r = await buatPembacaGemini({ klien: f.klien, systemPrompt: "x", jeda: [1, 1] }).bacaHalaman(png, { nomor: 1, total: 1 });
    expect(r).toEqual(HALAMAN_KOSONG);
    expect(f.panggilan).toHaveLength(2);
  });

  it("keluaran tidak sesuai skema diulang lalu gagal dengan pesan jelas", async () => {
    const f = klienPalsu([ok({ jenis_halaman: "ngawur" })]);
    await expect(
      buatPembacaGemini({ klien: f.klien, systemPrompt: "x", jeda: [1] }).bacaHalaman(png, { nomor: 2, total: 2 }),
    ).rejects.toThrow(/tidak sesuai skema/);
    expect(f.panggilan).toHaveLength(2);
  });

  it("JSON rusak dan keluaran terpotong ditolak", async () => {
    const a = klienPalsu([() => ({ text: "{rusak", candidates: [{ finishReason: "STOP" }] })]);
    await expect(buatPembacaGemini({ klien: a.klien, systemPrompt: "x", jeda: [] }).bacaHalaman(png, { nomor: 1, total: 1 })).rejects.toThrow();
    const b = klienPalsu([() => ({ text: "{}", candidates: [{ finishReason: "MAX_TOKENS" }] })]);
    await expect(buatPembacaGemini({ klien: b.klien, systemPrompt: "x", jeda: [] }).bacaHalaman(png, { nomor: 1, total: 1 })).rejects.toThrow(/MAX_TOKENS/);
  });

  it("galat kunci tidak diulang dan diterjemahkan", async () => {
    const f = klienPalsu([() => { throw new Error("API key not valid. Please pass a valid API key."); }]);
    await expect(
      buatPembacaGemini({ klien: f.klien, systemPrompt: "x", jeda: [1, 1] }).bacaHalaman(png, { nomor: 1, total: 1 }),
    ).rejects.toThrow(/API key not valid/);
    expect(f.panggilan).toHaveLength(1);
    expect(pesanGalat(new Error("API key not valid"))).toContain("GEMINI_API_KEY");
  });
});

describe("pemilihan penyedia dari env", () => {
  const awal = { ...process.env };
  afterEach(() => {
    process.env = { ...awal };
    vi.restoreAllMocks();
  });

  it("bawaan gemini dan menolak bila GEMINI_API_KEY kosong", () => {
    delete process.env.PEMBACA_AI;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    expect(penyediaAktif()).toBe("gemini");
    expect(() => buatPembacaDariEnv()).toThrow(/GEMINI_API_KEY/);
  });

  it("claude hanya bila diminta, dan minta ANTHROPIC_API_KEY", () => {
    process.env.PEMBACA_AI = "claude";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    expect(penyediaAktif()).toBe("claude");
    expect(() => buatPembacaDariEnv()).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("tanggal gambar dari title block", () => {
  it("dd/mm/yyyy jadi ISO; tidak valid tidak ditebak", () => {
    expect(isoTanggal("27/10/2026")).toBe("2026-10-27");
    expect(isoTanggal("7-3-2026")).toBe("2026-03-07");
    expect(isoTanggal("2026-10-27")).toBe("2026-10-27");
    expect(isoTanggal("31/02/2026")).toBeUndefined();
    expect(isoTanggal("Oktober 2026")).toBeUndefined();
    expect(isoTanggal(null)).toBeUndefined();
  });
});
