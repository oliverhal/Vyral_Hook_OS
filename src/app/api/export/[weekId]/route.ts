import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCSV, type ExportableHook } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { weekId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const wantsTSV = searchParams.get("format") === "tsv";

  const week = await prisma.week.findUnique({
    where: { id: params.weekId },
    include: {
      campaign: true,
      hooks: {
        where: { isSelected: true },
        orderBy: { selectedOrder: "asc" },
      },
      selectedValidated: {
        include: { validatedHook: true },
        orderBy: { selectedOrder: "asc" },
      },
    },
  });

  if (!week) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Combine experimental + validated. Experimental first (selectedOrder), then validated (selectedOrder offset).
  const expCount = week.hooks.length;
  const experimental: ExportableHook[] = week.hooks.map((h) => ({
    hookText: h.hookText,
    format: h.format,
    referenceVideo: h.referenceVideo,
    aiCaption: h.aiCaption,
    caption: h.caption,
    recordingNotes: h.recordingNotes,
    selectedOrder: h.selectedOrder,
    source: "experimental" as const,
  }));

  const validated: ExportableHook[] = week.selectedValidated.map((wv) => ({
    hookText: wv.validatedHook.hookText,
    format: wv.validatedHook.format,
    referenceVideo: wv.validatedHook.referenceVideo,
    aiCaption: null,
    caption: wv.validatedHook.caption,
    recordingNotes: wv.validatedHook.recordingNotes,
    selectedOrder: (wv.selectedOrder ?? 0) + expCount,
    source: "validated" as const,
  }));

  const all = [...experimental, ...validated];
  const csv = generateCSV(all, week.campaign.hashtags);

  // Optional: TSV format (tab-separated) for direct paste into Google Sheets
  const output = wantsTSV
    ? csv
        .split("\n")
        .map((line) => {
          // Parse CSV line back to fields, then join with tabs
          const cells: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"' && line[i + 1] === '"') {
              current += '"';
              i++;
            } else if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === "," && !inQuotes) {
              cells.push(current);
              current = "";
            } else {
              current += ch;
            }
          }
          cells.push(current);
          return cells.join("\t");
        })
        .join("\n")
    : csv;

  const weekDate = new Date(week.weekStart).toISOString().split("T")[0];
  const ext = wantsTSV ? "tsv" : "csv";
  const filename = `${week.campaign.name.replace(/\s+/g, "_")}_hooks_${weekDate}.${ext}`;

  return new NextResponse(output, {
    headers: {
      "Content-Type": wantsTSV ? "text/tab-separated-values; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
