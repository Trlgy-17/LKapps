export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ambilDb } = await import("@/db");
  const { mulaiPenjalan, pulihkanJob } = await import("@/lib/antrean");
  const { daftarkanPenanganPdf } = await import("@/lib/pdf-proses");
  const { daftarkanPenanganBaca } = await import("@/lib/pembaca/penangan");
  const db = await ambilDb();
  daftarkanPenanganPdf();
  daftarkanPenanganBaca();
  const { daftarkanPenanganHitung } = await import("@/lib/estimasi");
  daftarkanPenanganHitung();
  await pulihkanJob(db);
  mulaiPenjalan(db);
}
