import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_FORMATS = ["Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Text-only", "Long text", "Short text"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawText } = await req.json();
  if (!rawText?.trim()) return NextResponse.json({ error: "rawText required" }, { status: 400 });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are parsing pasted rows from a Google Sheet containing social media hook scripts for UGC creators.

Each row is a hook. Columns are tab-separated. Rows are newline-separated.

Your job: extract the best version of each hook (prefer a "corrected" or "improved" column over an "original" column if there are two similar text columns), the format, and a reference video URL if present.

Valid formats: ${VALID_FORMATS.join(", ")}
- If the format column says something like "Long text" or "long text", use "Long text"
- If no format is specified or it's unclear, default to "Faceless"
- If the format doesn't match any valid format, pick the closest match

For each row return:
- hookText: the best/final hook text (prefer corrected over original when two similar columns exist)
- format: one of the valid formats above
- referenceVideo: URL string or null
- caption: use "Creator to come up with their own caption" as default unless there's a clear caption column

Skip any row that is a header row, empty, or doesn't contain a real hook.

Return ONLY a valid JSON array, no explanation, no markdown, no code blocks. Example:
[{"hookText":"...","format":"Faceless","referenceVideo":"https://...","caption":"Creator to come up with their own caption"}]

Raw pasted data:
${rawText}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  let hooks;
  try {
    hooks = JSON.parse(raw);
  } catch {
    // Try to extract JSON array from response if wrapped in anything
    const match = raw.match(/\[[\s\S]*\]/);
    hooks = match ? JSON.parse(match[0]) : [];
  }

  // Sanitise
  hooks = hooks
    .filter((h: { hookText?: string }) => h.hookText?.trim())
    .map((h: { hookText: string; format?: string; referenceVideo?: string; caption?: string }) => ({
      hookText: h.hookText.trim(),
      format: VALID_FORMATS.includes(h.format ?? "") ? h.format : "Faceless",
      referenceVideo: h.referenceVideo?.startsWith("http") ? h.referenceVideo : null,
      caption: h.caption?.trim() || "Creator to come up with their own caption",
    }));

  return NextResponse.json({ hooks });
}
