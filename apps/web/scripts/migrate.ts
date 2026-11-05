import { buatDb } from "../src/db/index";

await buatDb();
console.log("Migrasi selesai.");
process.exit(0);
