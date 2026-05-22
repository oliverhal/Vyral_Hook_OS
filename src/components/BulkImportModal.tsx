"use client";

import { useState } from "react";
import { X, Loader2, Upload, Check, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOOK_FORMATS } from "@/types";
import type { HookFormat } from "@/types";

interface ParsedHook {
  hookText: string;
  format: HookFormat;
  referenceVideo: string | null;
  caption: string;
  selected: boolean;
}

interface BulkImportModalProps {
  weekId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkImportModal({ weekId, onClose, onSuccess }: BulkImportModalProps) {
  const [step, setStep] = useState<"paste" | "preview">("paste");
  const [rawText, setRawText] = useState("");
  const [hooks, setHooks] = useState<ParsedHook[]>([]);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleParse() {
    if (!rawText.trim()) return;
    setParsing(true);
    setError("");
    try {
      const res = await fetch("/api/parse-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Parse failed");
      setHooks(data.hooks.map((h: Omit<ParsedHook, "selected">) => ({ ...h, selected: true })));
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit() {
    const toSubmit = hooks.filter((h) => h.selected);
    if (toSubmit.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/hooks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, hooks: toSubmit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleHook(i: number) {
    setHooks((prev) => prev.map((h, idx) => idx === i ? { ...h, selected: !h.selected } : h));
  }

  function updateHook(i: number, field: keyof ParsedHook, value: string) {
    setHooks((prev) => prev.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
  }

  function removeHook(i: number) {
    setHooks((prev) => prev.filter((_, idx) => idx !== i));
  }

  const selectedCount = hooks.filter((h) => h.selected).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Bulk Import Hooks</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === "paste"
                ? "Paste rows from your Google Sheet — AI will parse them automatically"
                : `${hooks.length} hooks parsed — review and deselect any you don't want`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "paste" ? (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 leading-relaxed">
                <strong>How it works:</strong> Select your hook rows in Google Sheets → Ctrl/Cmd+C to copy → paste below. Works with any column layout — AI figures out which column is the hook text, format, and reference video.
              </div>
              <textarea
                className="textarea font-mono text-xs"
                rows={14}
                placeholder={"Paste your rows here...\n\nExample (tab-separated):\nhook text\tcorrected hook text\tLong text\thttps://instagram.com/..."}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-3">
              {hooks.map((hook, i) => (
                <div
                  key={i}
                  className={cn(
                    "border rounded-xl p-4 transition-colors",
                    hook.selected ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={hook.selected}
                      onChange={() => toggleHook(i)}
                      className="mt-1 rounded border-slate-300 accent-slate-800 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <textarea
                        className="textarea text-sm font-medium"
                        rows={2}
                        value={hook.hookText}
                        onChange={(e) => updateHook(i, "hookText", e.target.value)}
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        {HOOK_FORMATS.map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => updateHook(i, "format", f)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all",
                              hook.format === f
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                            )}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                      {hook.referenceVideo && (
                        <p className="text-xs text-blue-600 truncate">📎 {hook.referenceVideo}</p>
                      )}
                    </div>
                    <button onClick={() => removeHook(i)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          {step === "preview" ? (
            <>
              <button
                onClick={() => setStep("paste")}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{selectedCount} of {hooks.length} selected</span>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || selectedCount === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {submitting ? "Importing..." : `Import ${selectedCount} hook${selectedCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-medium">
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!rawText.trim() || parsing}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {parsing ? "Parsing hooks..." : "Parse hooks"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
