import { describe, expect, it } from "vitest";
import { ADENDUM, muatSystemPrompt } from "@/lib/pembaca/claude";
import { normalisasiKodeHpl } from "@/lib/pembaca/simpan";
import path from "node:path";

const berkas = path.join(process.cwd(), "..", "..", "SYSTEM_PROMPT_APLIKASI_ESTIMATOR_LK_INTERIOR_v1_0.md");

describe("system prompt dari dokumen pemilik aplikasi", () => {
  it("diambil hanya di antara BEGIN dan END", () => {
    const p = muatSystemPrompt(berkas);
    expect(p.startsWith("## 1. Peran, tujuan, dan batas pekerjaan")).toBe(true);
    expect(p).toContain("nama multipleks yang hanya ditulis “multi” berarti multipleks polos");
    expect(p).not.toContain("Catatan integrasi untuk pembuat aplikasi");
    expect(p).not.toContain("BEGIN SYSTEM PROMPT");
  });
  it("gagal bila penanda tidak ada", () => {
    expect(() => muatSystemPrompt(path.join(process.cwd(), "package.json"))).toThrow();
  });
  it("adendum melarang AI menghitung", () => {
    expect(ADENDUM).toContain("Jangan: menghitung jumlah bahan");
  });
});

describe("kode HPL", () => {
  it.each([["th009d", "TH 009 D"], ["TH 009 D", "TH 009 D"], ["th 852 j", "TH 852 J"], ["HPL th852 j", "TH 852 J"]])(
    "%s -> %s", (a, b) => expect(normalisasiKodeHpl(a)).toBe(b),
  );
  it("kode kabur null, J tidak sama dengan D", () => {
    expect(normalisasiKodeHpl("hpl kayu")).toBeNull();
    expect(normalisasiKodeHpl("th 009 j")).not.toBe(normalisasiKodeHpl("th 009 d"));
  });
});
