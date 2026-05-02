import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_FORMATS = ["Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Text-only"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { rawCSV, confirm, hooks: confirmedHooks } = await req.json();

  // If confirming pre-parsed hooks, just save them
  if (confirm && Array.isArray(confirmedHooks)) {
    const created = await prisma.validatedHook.createMany({
      data: confirmedHooks.map((h: {
        hookText: string;
        format: string;
        caption?: string;
        referenceVideo?: string;
        recordingNotes?: string;
      }) => ({
        campaignId: params.id,
        hookText: h.hookText,
        format: VALID_FORMATS.includes(h.format) ? h.format : "Faceless",
        caption: h.caption ?? "",
        referenceVideo: h.referenceVideo || null,
        recordingNotes: h.recordingNotes || null,
        addedById: userId,
      })),
    });
    return NextResponse.json({ count: created.count });
  }

  if (!rawCSV?.trim()) return NextResponse.json({ error: "rawCSV required" }, { status: 400 });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are parsing a spreadsheet export of social media hooks for a UGC creator agency.
The data may have inconsistent column order, different header names, merged cells, or messy formatting.

Parse every row and return a JSON array. Each object must have:
- hookText: string (the hook / text shown on screen — required, clean up whitespace but preserve meaning)
- format: string (normalise to exactly one of: "Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Text-only" — if unclear, guess from content: POV/talking = Face-to-camera, text overlay only = Text-only, default = Faceless)
- caption: string (the social media caption — empty string if absent)
- referenceVideo: string | null (URL if present, null if not)
- recordingNotes: string | null (filming instructions — null if absent)

Rules:
- Skip header rows, blank rows, and rows with no meaningful hook text
- Clean up hook text: fix obvious casing issues, trim whitespace
- Return ONLY a valid JSON array, no markdown, no explanation

Raw data:
${rawCSV.slice(0, 8000)}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  let hooks: unknown[];
  try {
    const jsonStr = raw.startsWith("[") ? raw : raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
    hooks = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ error: "AI failed to parse — try again or use paste mode" }, { status: 500 });
  }

  return NextResponse.json({ hooks });
}
