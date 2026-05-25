import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_FORMATS = ["Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Text-only", "Long text", "Short text"];

function parseTSV(raw: string): string[][] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter((cols) => cols.some((c) => c.trim()));
}

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s.trim());
}

function matchFormat(s: string): string | null {
  const lower = s.toLowerCase().trim();
  for (const f of VALID_FORMATS) {
    if (lower === f.toLowerCase() || lower.includes(f.toLowerCase())) return f;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawText } = await req.json();
  if (!rawText?.trim()) return NextResponse.json({ error: "rawText required" }, { status: 400 });

  // Step 1: Parse TSV directly — no AI involved, no JSON fragility
  const rows = parseTSV(rawText);
  if (rows.length === 0) return NextResponse.json({ hooks: [] });

  const numCols = Math.max(...rows.map((r) => r.length));

  // Step 2: Ask AI only for column indices (tiny JSON — just numbers, can't break)
  let hookCol = 0;
  let formatCol = -1;
  let refCol = -1;

  try {
    // Build a small sample (first 3 rows, truncated to 80 chars per cell) for the AI
    const sample = rows
      .slice(0, 3)
      .map((r) => r.map((c) => c.slice(0, 80)).join(" | "))
      .join("\n");

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: `A Google Sheet was pasted as tab-separated text. Here are the first rows (columns separated by " | "):

${sample}

There are ${numCols} columns (0-indexed).
Return ONLY a JSON object with these keys (use -1 if a column doesn't exist):
- hookCol: index of the best/final hook text column (prefer a corrected/edited version over an original if both exist)
- formatCol: index of the format column (e.g. "Long text", "Faceless", "Snapchat") or -1
- refCol: index of a reference video URL column or -1

Return ONLY the JSON, nothing else. Example: {"hookCol":1,"formatCol":2,"refCol":3}`,
      }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const parsed = JSON.parse(raw.match(/\{[^}]+\}/)?.[0] ?? "{}");
    if (typeof parsed.hookCol === "number") hookCol = parsed.hookCol;
    if (typeof parsed.formatCol === "number") formatCol = parsed.formatCol;
    if (typeof parsed.refCol === "number") refCol = parsed.refCol;
  } catch {
    // AI failed — fall back to heuristics
    for (let c = 0; c < numCols; c++) {
      const vals = rows.map((r) => r[c] ?? "").filter(Boolean);
      if (vals.some(looksLikeUrl) && refCol === -1) { refCol = c; continue; }
      if (vals.some((v) => matchFormat(v)) && vals.every((v) => v.length < 30) && formatCol === -1) { formatCol = c; continue; }
    }
    // hookCol: pick longest-avg-text column that isn't format or ref
    const taken = new Set([formatCol, refCol]);
    let bestLen = 0;
    for (let c = 0; c < numCols; c++) {
      if (taken.has(c)) continue;
      const avg = rows.reduce((s, r) => s + (r[c]?.length ?? 0), 0) / rows.length;
      if (avg > bestLen) { bestLen = avg; hookCol = c; }
    }
  }

  // Step 3: Map rows to hooks using the identified columns
  const hooks = rows
    .map((r) => {
      const hookText = r[hookCol]?.trim() ?? "";
      if (!hookText || hookText.length < 5) return null;

      const formatRaw = formatCol >= 0 ? r[formatCol]?.trim() : "";
      const format = matchFormat(formatRaw ?? "") ?? "Faceless";

      const refRaw = refCol >= 0 ? r[refCol]?.trim() : "";
      const referenceVideo = refRaw && looksLikeUrl(refRaw) ? refRaw : null;

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
