import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const password = "Vyral2025!";

const users = [
  { name: "Oliver Hale",    email: "oliver@vyral-labs.com",        role: "admin" },
  { name: "Oliver Barnes",  email: "oliver.barnes@vyral-labs.com", role: "admin" },
  { name: "Ethan Dichoso",  email: "ethan@vyral-labs.com",         role: "admin" },
  { name: "Klara Ralevic",  email: "klara@vyral-labs.com",         role: "member" },
  { name: "Sara Elbeih",    email: "sara@vyral-labs.com",          role: "member" },
];

async function main() {
  await client.connect();

  const hashed = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  for (const u of users) {
    // Generate a cuid-like id using timestamp + random
    const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    await client.query(
      `INSERT INTO "User" (id, name, email, password, color, role, active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name, role = EXCLUDED.role, password = EXCLUDED.password, "updatedAt" = EXCLUDED."updatedAt"`,
      [id, u.name, u.email, hashed, "blue", u.role, true, now, now]
    );
    console.log(`✅ ${u.name} (${u.role}) — ${u.email}`);
  }

  console.log("\nAll users seeded! 🎉");
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
