import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const VALID_FORMATS = ["Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Text-only", "Long text", "Short text"];

function parseTSV(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((c) => c.trim()))
    .filter((cols) => cols.some((c) => c.length > 0));
}

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function matchFormat(s: string): string | null {
  const lower = s.toLowerCase();
  for (const f of VALID_FORMATS) {
    if (lower === f.toLowerCase()) return f;
  }
  // partial match
  for (const f of VALID_FORMATS) {
    if (lower.includes(f.toLowerCase())) return f;
  }
  return null;
}

function isFormatOnly(col: string[]): boolean {
  // A column is "format-only" if almost every non-empty cell is a valid format
  const nonEmpty = col.filter((c) => c.length > 0);
  if (nonEmpty.length === 0) return false;
  const matches = nonEmpty.filter((c) => matchFormat(c) !== null);
  return matches.length / nonEmpty.length > 0.6;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawText } = await req.json();
  if (!rawText?.trim()) return NextResponse.json({ hooks: [] });

  const rows = parseTSV(rawText);
  if (rows.length === 0) return NextResponse.json({ hooks: [] });

  const numCols = Math.max(...rows.map((r) => r.length));

  // Build per-column arrays
  const cols: string[][] = Array.from({ length: numCols }, (_, i) =>
    rows.map((r) => r[i] ?? "")
  );

  // Identify special columns
  let formatCol = -1;
  let refCol = -1;

  for (let c = 0; c < numCols; c++) {
    const nonEmpty = cols[c].filter((v) => v.length > 0);
    if (nonEmpty.length === 0) continue;

    if (refCol === -1 && nonEmpty.some(looksLikeUrl)) {
      refCol = c;
      continue;
    }
    if (formatCol === -1 && isFormatOnly(cols[c])) {
      formatCol = c;
      continue;
    }
  }

  // Hook text column: among remaining columns, pick the one with the longest average text
  // If two similar-length text columns exist, prefer the LAST one (usually the corrected version)
  const taken = new Set([formatCol, refCol]);
  let hookCol = 0;
  let bestScore = -1;

  for (let c = 0; c < numCols; c++) {
    if (taken.has(c)) continue;
    const nonEmpty = cols[c].filter((v) => v.length > 10);
    if (nonEmpty.length === 0) continue;
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    // Bias toward later columns (corrected version) by adding a small bonus per column index
    const score = avgLen + c * 2;
    if (score > bestScore) {
      bestScore = score;
      hookCol = c;
    }
  }

  // Map rows to hooks
  const hooks = rows
    .map((r) => {
      const hookText = r[hookCol]?.trim() ?? "";
      if (hookText.length < 5) return null;

      // Skip rows that look like headers
      if (hookText.toLowerCase().includes("hook text") || hookText.toLowerCase() === "hook") return null;

      const formatRaw = formatCol >= 0 ? r[formatCol]?.trim() ?? "" : "";
      const format = matchFormat(formatRaw) ?? "Faceless";

      const refRaw = refCol >= 0 ? r[refCol]?.trim() ?? "" : "";
      const referenceVideo = looksLikeUrl(refRaw) ? refRaw : null;

      return {
        hookText,
        format,
        referenceVideo,
        caption: "Creator to come up with their own caption",
      };
    })
    .filter(Boolean);

  return NextResponse.json({ hooks });
}
