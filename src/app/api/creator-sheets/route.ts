import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractFileId(input: string): string | null {
  // Accept a full Google Sheets URL or a bare file ID
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Bare ID: no slashes, looks like a Sheets ID
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim();
  return null;
}

export async function GET() {
  const sheets = await prisma.creatorSheet.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(sheets);
}

export async function POST(req: NextRequest) {
  const { client, url, languageColIndex } = await req.json();
  if (!client?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "client and url are required" }, { status: 400 });
  }
  const fileId = extractFileId(url);
  if (!fileId) {
    return NextResponse.json({ error: "Could not extract a file ID from that URL" }, { status: 400 });
  }
  const sheet = await prisma.creatorSheet.create({
    data: {
      client: client.trim(),
      fileId,
      languageColIndex: languageColIndex != null ? Number(languageColIndex) : null,
    },
  });
  return NextResponse.json(sheet);
}
