import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface BulkRow {
  hookText: string;
  format?: string;
  caption?: string;
  referenceVideo?: string;
  recordingNotes?: string;
}

const VALID_FORMATS = ["Faceless", "Snapchat", "Talking head", "Voiceover", "Text-only"];

function normalizeFormat(input?: string): string {
  if (!input) return "Faceless";
  const trimmed = input.trim();
  const match = VALID_FORMATS.find((f) => f.toLowerCase() === trimmed.toLowerCase());
  return match || "Faceless";
}

function parseBulkInput(raw: string): BulkRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const cols = line.split("\t").map((c) => c.trim());
    return {
      hookText: cols[0] || "",
      format: cols[1],
      referenceVideo: cols[2] || undefined,
      caption: cols[3] || undefined,
      recordingNotes: cols[4] || undefined,
    };
  }).filter((r) => r.hookText);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const { rawText } = body;

  if (!rawText?.trim()) {
    return NextResponse.json({ error: "rawText required" }, { status: 400 });
  }

  const parsed = parseBulkInput(rawText);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No valid hooks found" }, { status: 400 });
  }

  const created = await prisma.validatedHook.createMany({
    data: parsed.map((r) => ({
      campaignId: params.id,
      hookText: r.hookText,
      format: normalizeFormat(r.format),
      caption: r.caption ?? "",
      referenceVideo: r.referenceVideo || null,
      recordingNotes: r.recordingNotes || null,
      addedById: userId,
    })),
  });

  return NextResponse.json({ count: created.count });
}
