/**
 * Sinkronkan RuleSet aktif dengan ATURAN_AWAL di kode (aturan baru dan koreksi teks, mis. ukuran lembar 2,40 x 1,20 m).
 * Dibuat sebagai RuleSet versi baru lewat jalur resmi (draf -> aktif oleh admin, tercatat di audit);
 * versi lama tetap utuh. Jalankan saat server mati: npm run db:sinkron
 */
import { and, eq } from "drizzle-orm";
import { buatDb, schema } from "../src/db/index";
import { aktifkanDraf, bukaDraf, daftarAturan, ruleSetAktif, tambahAturan } from "../src/lib/aturan";
import { ATURAN_AWAL } from "../src/lib/seed";

const db = await buatDb();
const [ws] = await db.select().from(schema.workspace).limit(1);
if (!ws) {
  console.log("Belum ada workspace. Jalankan db:seed dulu.");
  process.exit(1);
}
const [admin] = await db.select().from(schema.pengguna).where(and(eq(schema.pengguna.workspaceId, ws.id), eq(schema.pengguna.peran, "admin"))).limit(1);
const aktor = { id: admin.id, peran: "admin" as const };
const aktif = await ruleSetAktif(db, ws.id);
if (!aktif) {
  console.log("Tidak ada RuleSet aktif.");
  process.exit(1);
}
const ada = await daftarAturan(db, aktif.id);
const kunciAda = new Map(ada.map((a) => [`${a.kategori}/${a.kunci}`, a]));

const baru = ATURAN_AWAL.filter((a) => !kunciAda.has(`${a.kategori}/${a.kunci}`));
const berubah = ATURAN_AWAL.filter((a) => {
  const x = kunciAda.get(`${a.kategori}/${a.kunci}`);
  return x && (x.isi !== a.isi || x.nama !== a.nama || x.sumber !== a.sumber || x.keyakinan !== a.keyakinan);
});
if (baru.length === 0 && berubah.length === 0) {
  console.log(`RuleSet versi ${aktif.versi} sudah sesuai. Tidak ada perubahan.`);
  process.exit(0);
}

const draf = await bukaDraf(db, aktor, ws.id);
for (const a of berubah) {
  await db
    .update(schema.aturan)
    .set({ isi: a.isi, nama: a.nama, sumber: a.sumber, keyakinan: a.keyakinan })
    .where(and(eq(schema.aturan.ruleSetId, draf.id), eq(schema.aturan.kategori, a.kategori), eq(schema.aturan.kunci, a.kunci)));
}
for (const a of baru) await tambahAturan(db, aktor, draf.id, a);
await aktifkanDraf(db, aktor, draf.id);
console.log(`RuleSet versi ${draf.versi} aktif. Aturan baru: ${baru.length}, diperbarui: ${berubah.length}.`);
for (const a of berubah) console.log(`  diperbarui: ${a.kunci}`);
process.exit(0);
