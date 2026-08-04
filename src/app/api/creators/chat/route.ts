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
      (c: { id: string; firstName: string; lastName: string; email: string; location: string; over18: boolean; tiktok: string | null; instagram: string | null; status: string; notes: string | null; tags: string | null }) =>
        `ID:${c.id} | ${c.firstName} ${c.lastName} | ${c.email} | Location: ${c.location} | Over18: ${c.over18} | TikTok: ${c.tiktok || "N/A"} | Instagram: ${c.instagram || "N/A"} | Status: ${c.status} | Notes: ${c.notes || ""} | Tags: ${c.tags || ""}`
    )
    .join("\n");

  const systemPrompt = `You are a creator talent assistant for Vyral Labs. You help the team find the right UGC creators from their applicant pool for specific campaigns.

Here is the full list of ${creators.length} creator applicants:
${creatorList}

When the user asks you to find creators, analyze the list and return relevant matches. Be specific about WHY each creator matches. If they ask for a region, filter by location. If they mention language, look for hints in location and name. If they mention experience level, check notes.

Format your response clearly. For each recommended creator, include:
- Name + location
- TikTok/Instagram handle
- Why they match
- Their current status

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
