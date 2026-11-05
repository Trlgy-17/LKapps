import { buatDb, schema } from "../src/db/index";
import { seed } from "../src/lib/seed";

const email = process.env.SEED_ADMIN_EMAIL;
const kataSandi = process.env.SEED_ADMIN_PASSWORD;
if (!email || !kataSandi) {
  console.error("Isi SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD di environment.");
  process.exit(1);
}
const db = await buatDb();
const ada = await db.select().from(schema.workspace).limit(1);
if (ada.length) {
  console.log("Workspace sudah ada, seed dilewati.");
} else {
  await seed(db, { adminEmail: email, adminKataSandi: kataSandi });
  console.log("Seed selesai.");
}
process.exit(0);
