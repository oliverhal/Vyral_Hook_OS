import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractHandle(raw: string | null, platform: "tiktok" | "instagram"): string | null {
  if (!raw) return null;
  const skip = ["N/A", "None", "/", ".", "don't have TikTok", "don't have TikTok (yet)", "Don't have"];
  if (skip.some((s) => raw.toLowerCase().includes(s.toLowerCase()))) return null;
  const url = raw.startsWith("http") ? raw : `https://${platform}.com/@${raw.replace(/^@/, "")}`;
  try {
    const path = new URL(url).pathname.replace(/^\//, "").replace(/^@/, "").split("?")[0].split("/")[0];
    return path || null;
  } catch {
    return raw.replace(/^@/, "").split("?")[0];
  }
}

async function fetchInstagramBio(handle: string): Promise<{ bio: string; followers: number | null } | null> {
  try {
    const res = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract from og:description which contains "N Followers, N Following, N Posts - See Instagram photos and videos from NAME (@handle)"
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] ?? "";
    const followersMatch = ogDesc.match(/([\d,.]+[KMB]?)\s*Followers/i);
    const rawFollowers = followersMatch?.[1]?.replace(/,/g, "") ?? null;
    let followers: number | null = null;
    if (rawFollowers) {
      const n = parseFloat(rawFollowers);
      if (rawFollowers.endsWith("K")) followers = Math.round(n * 1000);
      else if (rawFollowers.endsWith("M")) followers = Math.round(n * 1_000_000);
      else followers = Math.round(n);
    }

    // Extract bio from og:description or title
    const bioMatch = html.match(/"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bio = bioMatch ? bioMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : ogDesc;

    return { bio: bio.slice(0, 500), followers };
  } catch {
    return null;
  }
}

async function fetchTikTokBio(handle: string): Promise<{ bio: string; followers: number | null } | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${handle}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] ?? "";
    const followersMatch = html.match(/"followerCount"\s*:\s*(\d+)/);
    const followers = followersMatch ? parseInt(followersMatch[1]) : null;
    const bioMatch = html.match(/"signature"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const bio = bioMatch ? bioMatch[1].replace(/\\n/g, "\n") : ogDesc;

    return { bio: bio.slice(0, 500), followers };
  } catch {
    return null;
  }
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const creator = await prisma.creatorApplication.findUnique({ where: { id: params.id } });
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ttHandle = extractHandle(creator.tiktok, "tiktok");
  const igHandle = extractHandle(creator.instagram, "instagram");

  const [ttData, igData] = await Promise.all([
    ttHandle ? fetchTikTokBio(ttHandle) : null,
    igHandle ? fetchInstagramBio(igHandle) : null,
  ]);

  const prompt = `You are enriching a UGC creator profile for Vyral Labs. Based on all available information, extract what you can confidently determine.

CREATOR INFO:
- Name: ${creator.firstName} ${creator.lastName}
- Email: ${creator.email}
- Self-reported location: ${creator.location}
- Over 18: ${creator.over18}
- TikTok handle: ${ttHandle ?? "none"}
- Instagram handle: ${igHandle ?? "none"}
- Application notes: ${creator.notes ?? "none"}
${ttData ? `- TikTok bio: "${ttData.bio}"` : ""}
${igData ? `- Instagram bio: "${igData.bio}"` : ""}

Respond with a JSON object (no markdown, just raw JSON):
{
  "gender": "Female" | "Male" | "Non-binary" | "Unknown",
  "ageRange": "18-24" | "25-34" | "35+" | "Unknown",
  "country": "specific country name or null if truly unknown",
  "language": "Primary language(s) for content, comma-separated",
  "niche": "Content niche/type in 2-5 words e.g. Travel & Lifestyle, Fashion UGC, Fitness & Wellness",
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence explaining your main inferences"
}

Rules:
- Gender: infer from first name and any pronouns in bio. Most names have a clear gender.
- AgeRange: use bio clues (student, university, graduation year, "in my 20s", etc). If notes mention Faircado/Ecosia experience assume 18-24 to 25-34.
- Country: use the location field + name origin + bio location mentions. "Europe" + German name = Germany. "Europe" + Italian name = Italy. "UK" in notes or bio = United Kingdom. Be specific.
- Language: infer from country, name origin, bio language, and any explicit mentions in notes.
- Niche: infer from bio, TikTok handle, and application notes.`;

  let enriched: {
    gender?: string; ageRange?: string; country?: string;
    language?: string; niche?: string;
  } = {};

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    enriched = JSON.parse(cleaned);
  } catch {
    // fall through with partial data
  }

  const updated = await prisma.creatorApplication.update({
    where: { id: params.id },
    data: {
      gender: enriched.gender && enriched.gender !== "Unknown" ? enriched.gender : creator.gender,
      ageRange: enriched.ageRange && enriched.ageRange !== "Unknown" ? enriched.ageRange : creator.ageRange,
      country: enriched.country ?? creator.country,
      language: enriched.language ?? creator.language,
      niche: enriched.niche ?? creator.niche,
      tiktokFollowers: ttData?.followers ?? creator.tiktokFollowers,
      instagramFollowers: igData?.followers ?? creator.instagramFollowers,
      enrichedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
