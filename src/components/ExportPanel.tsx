"use client";

import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";
import { generateSlackMessage } from "@/lib/utils";
import type { Hook, Campaign } from "@/types";

interface ExportPanelProps {
  weekId: string;
  campaign: Campaign;
  weekStart: string;
  selectedHooks: Hook[];
}

export default function ExportPanel({ weekId, campaign, weekStart, selectedHooks }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"slack" | "csv">("slack");

  const slackMsg = generateSlackMessage(
    campaign.name,
    campaign.clientName,
    new Date(weekStart),
    selectedHooks
  );

  async function copySlack() {
    await navigator.clipboard.writeText(slackMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCSV() {
    window.open(`/api/export/${weekId}`, "_blank");
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm">Export</h3>
        <p className="text-slate-500 text-xs mt-0.5">
          {selectedHooks.length} hook{selectedHooks.length !== 1 ? "s" : ""} selected
        </p>
      </div>

      <div className="flex border-b border-slate-100">
        {(["slack", "csv"] as const).map((tab) => (
          <button
            key={tab}
            className={`flex-1 py-3 text-xs font-semibold transition-colors ${
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "slack" ? "Slack Message" : "CSV / Google Sheets"}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === "slack" ? (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                {selectedHooks.length === 0
                  ? "Select hooks to preview the Slack message..."
                  : slackMsg}
              </pre>
            </div>
            <button
              onClick={copySlack}
              disabled={selectedHooks.length === 0}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Slack Message"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 leading-relaxed">
              Downloads a CSV matching your Google Sheets format — columns: Hook, Format, Reference Vid, Caption, Notes.
              Hashtags row included at the top.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 max-h-40 overflow-y-auto">
              <div className="font-semibold text-slate-700 mb-1.5">Selected hooks:</div>
              {selectedHooks.length === 0 ? (
                <div className="text-slate-400">None selected yet</div>
              ) : (
                selectedHooks.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-2">
                    <span className="font-mono text-slate-400 flex-shrink-0">{i + 1}.</span>
                    <div>
                      <span className="text-slate-700">{h.hookText}</span>
                      <span className="ml-2 text-slate-400">({h.format})</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={downloadCSV}
              disabled={selectedHooks.length === 0}
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
