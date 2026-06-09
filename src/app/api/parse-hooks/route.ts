import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_FORMATS = ["Faceless", "Snapchat", "Talking head", "Voiceover", "Text-only", "Long text", "Short text", "Other"];

// RFC-4180 TSV parser — handles quoted cells containing newlines and tabs
function parseTSV(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const n = raw.length;

  for (let i = 0; i < n; i++) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'; i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"' && cell === "") {
        inQuotes = true;
      } else if (ch === "\t") {
        row.push(cell.trim()); cell = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(cell.trim());
        if (row.some((c) => c.length > 0)) rows.push(row);
        row = []; cell = "";
      } else {
        cell += ch;
      }
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function looksLikeUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function matchFormat(s: string): string | null {
  const lower = s.toLowerCase();
  for (const f of VALID_FORMATS) {
    if (lower === f.toLowerCase()) return f;
  }
  for (const f of VALID_FORMATS) {
    if (lower.includes(f.toLowerCase())) return f;
  }
  return null;
}

function isFormatOnly(col: string[]): boolean {
  const nonEmpty = col.filter((c) => c.length > 0);
  if (nonEmpty.length === 0) return false;
  const matches = nonEmpty.filter((c) => matchFormat(c) !== null);
  return matches.length / nonEmpty.length > 0.6;
}

function heuristicColumns(rows: string[][], numCols: number) {
  const cols: string[][] = Array.from({ length: numCols }, (_, i) =>
    rows.map((r) => r[i] ?? "")
  );

  let formatCol = -1;
  let refCol = -1;

  for (let c = 0; c < numCols; c++) {
    const nonEmpty = cols[c].filter((v) => v.length > 0);
    if (nonEmpty.length === 0) continue;
    if (refCol === -1 && nonEmpty.some(looksLikeUrl)) { refCol = c; continue; }
    if (formatCol === -1 && isFormatOnly(cols[c])) { formatCol = c; continue; }
  }

  const taken = new Set([formatCol, refCol]);
  let hookCol = 0;
  let bestScore = -1;

  for (let c = 0; c < numCols; c++) {
    if (taken.has(c)) continue;
    const nonEmpty = cols[c].filter((v) => v.length > 10);
    if (nonEmpty.length === 0) continue;
    const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length;
    const score = avgLen + c * 2; // bias toward later cols (corrected version)
    if (score > bestScore) { bestScore = score; hookCol = c; }
  }

  return { hookCol, formatCol, refCol };
}

// Returns true if heuristics seem unreliable
function needsAiFallback(rows: string[][], hookCol: number, formatCol: number): boolean {
  if (formatCol === -1) return true; // couldn't find format column
  const hookTexts = rows.map((r) => r[hookCol]?.trim() ?? "").filter(Boolean);
  if (hookTexts.length === 0) return true;
  const avgLen = hookTexts.reduce((s, t) => s + t.length, 0) / hookTexts.length;
  if (avgLen < 20) return true; // hooks suspiciously short — probably wrong column
  return false;
}

async function aiColumnHints(rows: string[][], numCols: number): Promise<{ hookCol: number; formatCol: number; refCol: number }> {
  const sample = rows
    .slice(0, 4)
    .map((r, i) => `Row ${i}: ${r.map((c, j) => `[${j}] ${c.slice(0, 60)}`).join("  |  ")}`)
    .join("\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 60,
    messages: [{
      role: "user",
      content: `Google Sheet rows (${numCols} cols, 0-indexed):\n${sample}\n\nReturn ONLY JSON with column indices (-1 if absent): {"hookCol":N,"formatCol":N,"refCol":N}`,
    }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const match = raw.match(/\{[^}]+\}/);
  const parsed = match ? JSON.parse(match[0]) : {};
  return {
    hookCol: typeof parsed.hookCol === "number" ? parsed.hookCol : 0,
    formatCol: typeof parsed.formatCol === "number" ? parsed.formatCol : -1,
    refCol: typeof parsed.refCol === "number" ? parsed.refCol : -1,
  };
}

// Merge continuation rows back into the previous hook.
// When a hook is written across multiple lines and pasted into Google Sheets,
// each line becomes a separate row. Rows with text but no format/URL are
// continuations — join them onto the previous hook with a newline.
function mergeRows(rows: string[][], hookCol: number, formatCol: number, refCol: number): string[][] {
  if (formatCol < 0) return rows; // no format column detected — can't tell continuations from hooks
  const merged: string[][] = [];
  for (const row of rows) {
    const hookText = row[hookCol]?.trim() ?? "";
    const formatVal = formatCol >= 0 ? row[formatCol]?.trim() ?? "" : "";
    const refVal = refCol >= 0 ? row[refCol]?.trim() ?? "" : "";
    const hasFormat = matchFormat(formatVal) !== null;
    const hasRef = looksLikeUrl(refVal);
    const hasText = hookText.length > 0;
    // Continuation: has text but no format and no URL — merge into previous hook
    if (!hasFormat && !hasRef && hasText && merged.length > 0) {
      const prev = [...merged[merged.length - 1]];
      prev[hookCol] = (prev[hookCol] ?? "") + "\n" + hookText;
      merged[merged.length - 1] = prev;
    } else {
      merged.push(row);
    }
  }
  return merged;
}

function buildHooks(rows: string[][], hookCol: number, formatCol: number, refCol: number) {
  const processedRows = mergeRows(rows, hookCol, formatCol, refCol);

  return processedRows
    .map((r) => {
      const hookText = r[hookCol]?.trim() ?? "";
      if (hookText.length < 5) return null;
      if (/^(hook|hook text|text on screen)$/i.test(hookText)) return null;

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
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rawText } = await req.json();
  if (!rawText?.trim()) return NextResponse.json({ hooks: [] });

  const rows = parseTSV(rawText);
  if (rows.length === 0) return NextResponse.json({ hooks: [] });

  const numCols = Math.max(...rows.map((r) => r.length));

  // Step 1: fast heuristics
  let { hookCol, formatCol, refCol } = heuristicColumns(rows, numCols);

  // Step 2: AI fallback only when heuristics look unreliable
  if (needsAiFallback(rows, hookCol, formatCol)) {
    try {
      const aiHints = await aiColumnHints(rows, numCols);
      hookCol = aiHints.hookCol;
      formatCol = aiHints.formatCol;
      refCol = aiHints.refCol;
    } catch {
      // AI failed too — proceed with heuristics anyway
    }
  }

  const hooks = buildHooks(rows, hookCol, formatCol, refCol);
  return NextResponse.json({ hooks });
}
