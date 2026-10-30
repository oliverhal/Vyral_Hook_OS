/**
 * Migrates the Week table:
 *   - Renames sheetUrl -> newHooksSheetUrl
 *   - Adds validatedSheetUrl column
 *
 * Usage:
 *   DATABASE_URL="postgres://..." node scripts/migrate-sheet-urls.mjs
 */
import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("Connected to production DB");

try {
  // Rename sheetUrl -> newHooksSheetUrl (safe to re-run — will error if already renamed)
  await client.query(`ALTER TABLE "Week" RENAME COLUMN "sheetUrl" TO "newHooksSheetUrl"`);
  console.log('✅ Renamed sheetUrl -> newHooksSheetUrl');
} catch (e) {
  if (e.message.includes("does not exist") || e.message.includes("already exists")) {
    console.log('ℹ️  sheetUrl already renamed (skipping)');
  } else {
    throw e;
  }
}

await client.query(`ALTER TABLE "Week" ADD COLUMN IF NOT EXISTS "validatedSheetUrl" TEXT`);
console.log('✅ Added validatedSheetUrl column');

await client.end();
console.log("Done!");
