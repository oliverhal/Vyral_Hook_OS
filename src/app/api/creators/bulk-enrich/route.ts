import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractHandle(raw: string | null, platform: "tiktok" | "instagram"): string | null {
  if (!raw) return null;
  const skip = ["n/a", "none", "/", ".", "don't have", "no tiktok", "not provided"];
  if (skip.some((s) => raw.toLowerCase().includes(s))) return null;
  try {
    if (raw.startsWith("http")) {
      const path = new URL(raw).pathname.replace(/^\//, "").replace(/^@/, "").split("?")[0].split("/")[0];
      return path || null;
    }
  } catch {}
  return raw.replace(/^@/, "").split("?")[0].split("/")[0] || null;
}

async function fetchInstagramBio(handle: string): Promise<{ bio: string; followers: number | null }> {
  try {
    const res = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { bio: "", followers: null };
    const html = await res.text();
    const ogDesc = html.match(/property="og:description" content="([^"]+)"/)?.[1] ?? "";
    const followersMatch = ogDesc.match(/([\d,.]+[KMkMB]?)\s*Followers/i);
    const raw = followersMatch?.[1]?.replace(/,/g, "") ?? null;
    let followers: number | null = null;
    if (raw) {
      const n = parseFloat(raw);
      if (raw.toUpperCase().endsWith("K")) followers = Math.round(n * 1000);
      else if (raw.toUpperCase().endsWith("M")) followers = Math.round(n * 1_000_000);
      else followers = Math.round(n);
    }
    const bioMatch = html.match(/"biography":"((?:[^"\\]|\\.)*)"/);
    const bio = bioMatch ? bioMatch[1].replace(/\\n/g, " ").replace(/\\"/g, '"') : ogDesc;
    return { bio: bio.slice(0, 400), followers };
  } catch {
    return { bio: "", followers: null };
  }
}

async function fetchTikTokBio(handle: string): Promise<{ bio: string; followers: number | null }> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${handle}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { bio: "", followers: null };
    const html = await res.text();
    const followersMatch = html.match(/"followerCount":(\d+)/);
    const followers = followersMatch ? parseInt(followersMatch[1]) : null;
    const bioMatch = html.match(/"signature":"((?:[^"\\]|\\.)*)"/);
    const bio = bioMatch ? bioMatch[1].replace(/\\n/g, " ") : "";
    return { bio: bio.slice(0, 400), followers };
  } catch {
    return { bio: "", followers: null };
  }
}

async function enrichOne(creator: {
  id: string; firstName: string; lastName: string; email: string;
  location: string; over18: boolean; tiktok: string | null; instagram: string | null;
  notes: string | null; gender: string | null; ageRange: string | null;
  country: string | null; language: string | null; niche: string | null;
  tiktokFollowers: number | null; instagramFollowers: number | null;
}) {
  const ttHandle = extractHandle(creator.tiktok, "tiktok");
  const igHandle = extractHandle(creator.instagram, "instagram");

  const [ttData, igData] = await Promise.all([
    ttHandle ? fetchTikTokBio(ttHandle) : Promise.resolve({ bio: "", followers: null }),
    igHandle ? fetchInstagramBio(igHandle) : Promise.resolve({ bio: "", followers: null }),
  ]);

  const prompt = `Enrich this UGC creator profile. Return ONLY raw JSON, no markdown.

Name: ${creator.firstName} ${creator.lastName}
Location (self-reported): ${creator.location}
Over 18: ${creator.over18}
TikTok handle: ${ttHandle ?? "none"}${ttData.bio ? `\nTikTok bio: "${ttData.bio}"` : ""}
Instagram handle: ${igHandle ?? "none"}${igData.bio ? `\nInstagram bio: "${igData.bio}"` : ""}
Application notes: ${creator.notes ?? "none"}

Return:
{
  "gender": "Female"|"Male"|"Non-binary"|"Unknown",
  "ageRange": "18-24"|"25-34"|"35+"|"Unknown",
  "country": "specific country, null if genuinely unknown",
  "language": "comma-separated content languages",
  "niche": "2-5 word content niche"
}

Rules:
- Gender from first name + any pronouns in bio (she/her = Female, he/him = Male)
- Age: bio clues like "student", "uni", "in my 20s", nursing job, Deloitte = older. Default to 18-24 for UGC creators with no clues.
- Country: "Europe" + German name = Germany; Dutch names (van den, de, Herik) = Netherlands; Italian names = Italy; "London" or "UK" in bio = United Kingdom; "Madrid" = Spain; "Toulouse"/"ville rose" = France; Philippines location = Philippines; "Bucharest" = Romania.
- Language: match country + any bio language + explicit mentions in notes.
- Niche: from bio text and handle (e.g. "Travel & Lifestyle", "Fashion UGC", "Study & Education", "Fitness & Wellness", "Climate & Sustainability").`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const enriched = JSON.parse(cleaned);

    await prisma.creatorApplication.update({
      where: { id: creator.id },
      data: {
        gender: enriched.gender !== "Unknown" ? enriched.gender : (creator.gender ?? null),
        ageRange: enriched.ageRange !== "Unknown" ? enriched.ageRange : (creator.ageRange ?? null),
        country: enriched.country ?? creator.country,
        language: enriched.language ?? creator.language,
        niche: enriched.niche ?? creator.niche,
        tiktokFollowers: ttData.followers ?? creator.tiktokFollowers,
        instagramFollowers: igData.followers ?? creator.instagramFollowers,
        enrichedAt: new Date(),
      },
    });
    return "ok";
  } catch {
    // Mark as attempted so we don't retry indefinitely
    await prisma.creatorApplication.update({
      where: { id: creator.id },
      data: { enrichedAt: new Date() },
    });
    return "error";
  }
}

export async function GET() {
  return run();
}

export async function POST() {
  return run();
}

async function run() {
  // Get all creators not yet enriched (or enriched > 7 days ago for a refresh)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const creators = await prisma.creatorApplication.findMany({
    where: {
      OR: [
        { enrichedAt: null },
        { enrichedAt: { lt: sevenDaysAgo } },
      ],
    },
    take: 50, // batch size per run — cron runs daily so this handles up to 50/day
  });

  if (creators.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, message: "All creators already enriched" });
  }

  let success = 0;
  let errors = 0;

  for (const creator of creators) {
    const result = await enrichOne(creator);
    if (result === "ok") success++;
    else errors++;
    // Small delay to avoid hammering Claude API
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({ ok: true, enriched: success, errors, total: creators.length });
}
