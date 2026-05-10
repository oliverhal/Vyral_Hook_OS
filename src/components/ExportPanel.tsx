"use client";

import { useState } from "react";
import { Copy, Download, Check, FileSpreadsheet, ExternalLink } from "lucide-react";
import { generateSlackMessage, type ExportableHook } from "@/lib/utils";
import type { Hook, Campaign, WeekValidatedHook } from "@/types";

interface ExportPanelProps {
  weekId: string;
  campaign: Campaign;
  weekStart: string;
  selectedHooks: Hook[];
  selectedValidated?: WeekValidatedHook[];
}

export default function ExportPanel({
  weekId,
  campaign,
  weekStart,
  selectedHooks,
  selectedValidated = [],
}: ExportPanelProps) {
  const [copied, setCopied] = useState<"slack" | "sheets" | null>(null);
  const [activeTab, setActiveTab] = useState<"slack" | "sheets" | "csv">("sheets");

  const expCount = selectedHooks.length;

  // Combine experimental + validated for export
  const exportable: ExportableHook[] = [
    ...selectedHooks.map((h) => ({
      hookText: h.hookText,
      format: h.format,
      referenceVideo: h.referenceVideo,
      aiCaption: h.aiCaption,
      caption: h.caption,
      recordingNotes: h.recordingNotes,
      requiresAppFootage: h.requiresAppFootage,
      appFootageSource: h.appFootageSource,
      selectedOrder: h.selectedOrder,
      source: "experimental" as const,
    })),
    ...selectedValidated.map((wv) => ({
      hookText: wv.validatedHook.hookText,
      format: wv.validatedHook.format,
      referenceVideo: wv.validatedHook.referenceVideo,
      aiCaption: null,
      caption: wv.validatedHook.caption,
      recordingNotes: wv.validatedHook.recordingNotes,
      requiresAppFootage: false,
      appFootageSource: null,
      selectedOrder: (wv.selectedOrder ?? 0) + expCount,
      source: "validated" as const,
    })),
  ];

  const totalCount = exportable.length;
  const slackMsg = generateSlackMessage(campaign.name, campaign.clientName, new Date(weekStart), exportable);

  // Sheets-ready TSV (tab-separated, ready to paste straight into Google Sheets)
  const sheetsRows = [...exportable].sort((a, b) => (a.selectedOrder ?? 99) - (b.selectedOrder ?? 99));
  const sheetsHeader = ["Hook (text on screen)", "Format", "Reference Vid:", "Captions (pls add your own hashtags)", "Notes:", "Requires App Footage", "App Footage Source"];
  const sheetsTSV = [
    ...(campaign.hashtags ? [campaign.hashtags] : []),
    sheetsHeader.join("\t"),
    ...sheetsRows.map((h) => [
      h.hookText,
      h.format,
      h.referenceVideo ?? "",
      h.aiCaption || h.caption,
      h.recordingNotes ?? "",
      h.requiresAppFootage ? "Yes" : "",
      h.appFootageSource ?? "",
    ].join("\t")),
  ].join("\n");

  async function copySlack() {
    await navigator.clipboard.writeText(slackMsg);
    setCopied("slack");
    setTimeout(() => setCopied(null), 2000);
  }

  async function copySheets() {
    await navigator.clipboard.writeText(sheetsTSV);
    setCopied("sheets");
    setTimeout(() => setCopied(null), 2000);
  }

  function downloadCSV() {
    window.open(`/api/export/${weekId}`, "_blank");
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm">Export</h3>
        <p className="text-slate-500 text-xs mt-0.5">
          {totalCount} hook{totalCount !== 1 ? "s" : ""} ready
          {selectedValidated.length > 0 && ` (${expCount} new + ${selectedValidated.length} validated)`}
        </p>
      </div>

      <div className="flex border-b border-slate-100">
        {([
          { id: "sheets", label: "Google Sheets" },
          { id: "slack", label: "Slack" },
          { id: "csv", label: "CSV" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === "sheets" ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-700 mb-1">
                <FileSpreadsheet className="w-4 h-4" />
                Paste straight into your live Google Sheet
              </div>
              <p className="text-xs text-emerald-700/80">
                Click copy → open the sheet you share with creators → click the cell where new hooks should go → paste. The columns line up automatically.
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 max-h-48 overflow-auto">
              <pre className="text-[10px] text-slate-700 font-mono whitespace-pre leading-relaxed">
                {totalCount === 0 ? "Select hooks to preview..." : sheetsTSV.split("\n").slice(0, 4).join("\n") + (sheetsTSV.split("\n").length > 4 ? "\n…" : "")}
              </pre>
            </div>
            <button
              onClick={copySheets}
              disabled={totalCount === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied === "sheets" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === "sheets" ? "Copied — paste into your sheet" : "Copy for Google Sheets"}
            </button>
          </div>
        ) : activeTab === "slack" ? (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                {totalCount === 0 ? "Select hooks to preview the Slack message..." : slackMsg}
              </pre>
            </div>
            <button
              onClick={copySlack}
              disabled={totalCount === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied === "slack" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === "slack" ? "Copied!" : "Copy Slack Message"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              Downloads a CSV file. Useful if you want to back it up or import into a fresh sheet.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 max-h-40 overflow-y-auto">
              {exportable.length === 0 ? (
                <div className="text-slate-400">None selected yet</div>
              ) : (
                exportable.map((h, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="font-mono text-slate-400 flex-shrink-0">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-700">{h.hookText}</span>
                      <span className="ml-2 text-slate-400">({h.format})</span>
                      {h.source === "validated" && <span className="ml-1 text-orange-500">🔥</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={downloadCSV}
              disabled={totalCount === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
