import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { hookText, caption, format, campaignName, clientName, hashtags } = body;

  if (!hookText || !campaignName) {
    return NextResponse.json({ error: "hookText and campaignName are required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === "your-anthropic-api-key-here") {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are writing social media captions for UGC creators promoting ${clientName} (${campaignName}).

Hook text (text on screen): ${hookText}
Format: ${format ?? "Faceless"}
Draft caption: ${caption}
${hashtags ? `Hashtags to include: ${hashtags}` : ""}

Write a natural, authentic caption from the creator's perspective. Requirements:
- Conversational and genuine, NOT corporate or cringe
- Promotes ${clientName} naturally — mention it but don't make it the focus
- 2-4 sentences max
- First person ("I", "me", "my")
- 1-2 emojis max — use them naturally, not excessively
- Do NOT include hashtags (they go separately)
- Should sound like something a real person would actually post
- Match the energy of the hook text

Return ONLY the caption text, nothing else.`,
      },
    ],
  });

  const generatedCaption = message.content[0].type === "text" ? message.content[0].text : "";
  return NextResponse.json({ caption: generatedCaption });
}
