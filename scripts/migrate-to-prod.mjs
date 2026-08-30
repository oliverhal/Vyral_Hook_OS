/**
 * Migrates local SQLite data (campaigns, weeks, hooks) to production Neon PostgreSQL.
 * Run: node scripts/migrate-to-prod.mjs
 */
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const { Client } = pg;

// --- Local SQLite (via Prisma) ---
const local = new PrismaClient();

// --- Production Neon (via pg) ---
const prod = new Client({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function newId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function main() {
  await prod.connect();

  // Get Oliver Hale's prod user id
  const { rows: [oliver] } = await prod.query(
    `SELECT id FROM "User" WHERE email = 'oliver@vyral-labs.com'`
  );
  if (!oliver) throw new Error("Oliver Hale not found in prod DB");
  const oliverId = oliver.id;
  console.log("Oliver's prod ID:", oliverId);

  // Fetch all local data
  const campaigns = await local.campaign.findMany({
    include: {
      weeks: {
        include: {
          hooks: true,
          selectedValidated: { include: { validatedHook: true } },
        },
        orderBy: { weekStart: "asc" },
      },
    },
  });

  for (const c of campaigns) {
    console.log(`\n📁 Migrating campaign: ${c.name}`);

    // Check if campaign already exists
    const { rows: existing } = await prod.query(
      `SELECT id FROM "Campaign" WHERE name = $1 AND "clientName" = $2`,
      [c.name, c.clientName]
    );

    let campaignId;
    if (existing.length > 0) {
      campaignId = existing[0].id;
      console.log(`  ↩️  Campaign already exists (${campaignId}), skipping create`);
    } else {
      campaignId = newId();
      await prod.query(
        `INSERT INTO "Campaign" (id, name, "clientName", description, color, emoji, active, "hooksTarget", "validatedTarget", hashtags, "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [campaignId, c.name, c.clientName, c.description, c.color, c.emoji, c.active,
         c.hooksTarget, c.validatedTarget, c.hashtags, c.createdAt, c.updatedAt]
      );
      console.log(`  ✅ Created campaign ${c.name} (${campaignId})`);
    }

    for (const w of c.weeks) {
      // Check if week already exists
      const { rows: existingWeek } = await prod.query(
        `SELECT id FROM "Week" WHERE "campaignId" = $1 AND "weekStart" = $2`,
        [campaignId, w.weekStart]
      );

      let weekId;
      if (existingWeek.length > 0) {
        weekId = existingWeek[0].id;
        console.log(`  ↩️  Week ${w.weekStart.toISOString().slice(0,10)} already exists`);
      } else {
        weekId = newId();
        await prod.query(
          `INSERT INTO "Week" (id, "campaignId", "weekStart", deadline, status, mode, notes, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [weekId, campaignId, w.weekStart, w.deadline, w.status, w.mode, w.notes, w.createdAt, w.updatedAt]
        );
        console.log(`    ✅ Created week ${w.weekStart.toISOString().slice(0,10)} (${w.status})`);
      }

      for (const h of w.hooks) {
        const { rows: existingHook } = await prod.query(
          `SELECT id FROM "Hook" WHERE "weekId" = $1 AND "hookText" = $2`,
          [weekId, h.hookText]
        );
        if (existingHook.length > 0) {
          console.log(`      ↩️  Hook already exists: ${h.hookText.slice(0,50)}...`);
          continue;
        }
        const hookId = newId();
        await prod.query(
          `INSERT INTO "Hook" (id, "weekId", "submittedById", "submitterName", "hookText", format, caption, "referenceVideo", "recordingNotes", "requiresAppFootage", "appFootageSource", status, "isSelected", "selectedOrder", "aiCaption", "wentViral", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [hookId, weekId, oliverId, h.submitterName, h.hookText, h.format, h.caption,
           h.referenceVideo, h.recordingNotes, h.requiresAppFootage, h.appFootageSource,
           h.status, h.isSelected, h.selectedOrder, h.aiCaption, h.wentViral, h.createdAt, h.updatedAt]
        );
        console.log(`      ✅ Hook: ${h.hookText.slice(0,60)}...`);
      }
    }
  }

  console.log("\n🎉 Migration complete!");
  await prod.end();
  await local.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
