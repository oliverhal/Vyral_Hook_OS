import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const creators = await prisma.creatorApplication.findMany({
    orderBy: { submittedAt: "desc" },
  });

  const creatorList = creators
    .map(
      (c: {
        id: string; firstName: string; lastName: string; email: string; location: string;
        over18: boolean; tiktok: string | null; instagram: string | null; status: string;
        notes: string | null; tags: string | null; client: string; language: string | null;
        country: string | null; gender: string | null; ageRange: string | null; niche: string | null;
        tiktokFollowers: number | null; instagramFollowers: number | null; referredBy: string | null;
      }) =>
        `ID:${c.id} | ${c.firstName} ${c.lastName} | ${c.email} | Programme: ${c.client} | Location: ${c.country ?? c.location} | Over18: ${c.over18} | TikTok: ${c.tiktok || "N/A"} | Instagram: ${c.instagram || "N/A"} | Language: ${c.language || "unknown"} | Gender: ${c.gender || "unknown"} | Age: ${c.ageRange || "unknown"} | Niche: ${c.niche || ""} | TT Followers: ${c.tiktokFollowers ?? "?"} | IG Followers: ${c.instagramFollowers ?? "?"} | Status: ${c.status} | Referred by: ${c.referredBy || ""} | Notes: ${c.notes || ""} | Tags: ${c.tags || ""}`
    )
    .join("\n");

  const systemPrompt = `You are a creator talent assistant for Vyral Labs. You help the team find the right UGC creators from their applicant pool for specific campaigns.

Vyral Labs manages creator programmes for multiple clients: Vyral Labs (general UGC), Juno (chronic illness community), Jumpspeak (language learning), Ecosia (sustainability/climate), Artie (piano/music), and Pazi.

Here is the full list of ${creators.length} creator applicants across all programmes:
${creatorList}

When the user asks you to find creators, analyze the list and return relevant matches. Be specific about WHY each creator matches. Always mention which programme they applied through (the "Programme" field) — this is important context.

Format your response clearly. For each recommended creator, include:
- Name + location + programme they applied through
- TikTok/Instagram handle + follower counts if known
- Language(s) they create in
- Why they match the request
- Their current status (new/shortlisted/approved/rejected)

Keep your response concise and actionable. If there are no strong matches, say so honestly.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ reply: text });
}
