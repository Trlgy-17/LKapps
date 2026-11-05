/** Format angka Indonesia: 1.320 dan 6,05 (DESIGN §8). */
export function formatAngka(nilai: number | string, desimal?: number): string {
  const n = typeof nilai === "string" ? Number(nilai) : nilai;
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal ?? 0,
    maximumFractionDigits: desimal ?? 20,
  }).format(n);
}
