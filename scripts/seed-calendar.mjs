import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const clients = [
  { name: "Natively", contractStart: "2025-10-08", contractEnd: null, monthlyValue: 8500, source: "imported", color: "blue", externalId: "1770155749128" },
  { name: "Artie (Art Master)", contractStart: "2026-02-04", contractEnd: "2026-02-22", monthlyValue: 4750, source: "imported", color: "orange", externalId: "1770227983088" },
  { name: "Garderobe", contractStart: "2026-01-15", contractEnd: "2026-04-15", monthlyValue: 1683, source: "imported", color: "teal", externalId: "1770228247273" },
  { name: "MeetCiao", contractStart: "2026-02-03", contractEnd: null, monthlyValue: 8500, source: "imported", color: "violet", externalId: "1770228990944" },
  { name: "Artie (New Contract)", contractStart: "2026-02-23", contractEnd: null, monthlyValue: 17000, source: "imported", contractLink: "https://docs.google.com/document/d/1HK63Oma_OJROALs4nh3zq84uzY6t0Tam/edit", color: "orange", externalId: "1771509014396" },
  { name: "Faircado UG", contractStart: "2026-03-17", contractEnd: null, monthlyValue: 7000, source: "imported", contractLink: "https://docs.google.com/document/d/1JyBWnTKwdEb8jgd3A_mrCwwEfkqNG-qQwOll58ry80U/edit", color: "emerald", externalId: "1772708562316" },
  { name: "Juno", contractStart: "2026-04-13", contractEnd: "2026-07-13", monthlyValue: 8500, source: "imported", firstPostDate: "2026-04-13", color: "pink", externalId: "1775126876996" },
  { name: "Shameless Pets", contractStart: "2026-04-01", contractEnd: "2026-06-01", monthlyValue: 8660, source: "imported", firstPostDate: "2026-04-06", color: "yellow", externalId: "1775127640928" },
  { name: "TwoCents", contractStart: "2026-05-12", contractEnd: "2026-07-12", monthlyValue: 8500, source: "imported", firstPostDate: "2026-06-01", color: "blue", externalId: "1778568821388" },
  { name: "MeetCiao Extension", contractStart: "2026-04-16", contractEnd: "2026-07-16", monthlyValue: 8500, source: "imported", color: "violet", externalId: "1778569126031" },
  { name: "Ecosia", contractStart: "2026-06-01", contractEnd: "2027-06-01", monthlyValue: 8500, source: "imported", firstPostDate: "2026-06-01", color: "emerald", externalId: "1779193926479" },
];

function cuid() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

async function main() {
  await client.connect();

  // Create table if not exists (safe if already exists)
  await client.query(`
    CREATE TABLE IF NOT EXISTS "CalendarClient" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "contractStart" TIMESTAMPTZ NOT NULL,
      "contractEnd" TIMESTAMPTZ,
      "firstPostDate" TIMESTAMPTZ,
      "monthlyValue" DOUBLE PRECISION,
      notes TEXT,
      "contractLink" TEXT,
      color TEXT NOT NULL DEFAULT 'violet',
      source TEXT NOT NULL DEFAULT 'manual',
      "externalId" TEXT UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const now = new Date().toISOString();

  for (const c of clients) {
    const id = cuid();
    await client.query(
      `INSERT INTO "CalendarClient" (id, name, "contractStart", "contractEnd", "firstPostDate", "monthlyValue", "contractLink", color, source, "externalId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT ("externalId") DO NOTHING`,
      [
        id,
        c.name,
        c.contractStart,
        c.contractEnd || null,
        c.firstPostDate || null,
        c.monthlyValue || null,
        c.contractLink || null,
        c.color,
        c.source,
        c.externalId,
        now,
        now,
      ]
    );
    console.log(`Seeded: ${c.name}`);
  }

  console.log("Calendar clients seeded successfully.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
