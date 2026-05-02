"use client";

import { useEffect, useState } from "react";
import { Flame, Trash2, Search, Plus, Upload, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_COLORS, HOOK_FORMATS } from "@/types";
import type { Campaign, ValidatedHook, HookFormat } from "@/types";

interface Props {
  campaign: Campaign;
  isAdmin?: boolean;
}

export default function ValidatedLibrary({ campaign, isAdmin }: Props) {
  const [hooks, setHooks] = useState<ValidatedHook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  async function reload() {
    const data = await fetch(`/api/campaigns/${campaign.id}/validated`).then((r) => r.json());
    setHooks(data);
    setLoading(false);
  }

  useEffect(() => { reload(); }, [campaign.id]);

  async function removeValidated(id: string) {
    if (!confirm("Remove from validated library?")) return;
    await fetch(`/api/validated/${id}`, { method: "DELETE" });
    setHooks((prev) => prev.filter((h) => h.id !== id));
  }

  const filtered = hooks.filter((h) =>
    h.hookText.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{campaign.emoji}</span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Validated Hooks
              <span className="badge bg-orange-100 text-orange-700 text-xs">{hooks.length}</span>
            </h2>
            <p className="text-xs text-slate-400">{campaign.name} — proven viral hooks</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add hook
          </button>
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
          >
            <Upload className="w-4 h-4" />
            Bulk import
          </button>
        </div>
      </div>

      {hooks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search validated hooks..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-colors"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔥</div>
          <div className="text-slate-500 text-sm font-medium">
            {hooks.length === 0 ? "No validated hooks yet" : "No matches"}
          </div>
          {hooks.length === 0 && (
            <div className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
              Add hooks one at a time, or paste your existing list from Google Sheets to bulk import.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((hook) => {
            const formatColor = FORMAT_COLORS[hook.format] ?? "bg-slate-100 text-slate-600";
            return (
              <div key={hook.id} className="card p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn("badge text-xs", formatColor)}>{hook.format}</span>
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      {hook.timesUsed > 0 && (
                        <span className="text-xs text-slate-400">Used {hook.timesUsed}x</span>
                      )}
                    </div>
                    <p className="font-semibold text-slate-900 text-sm leading-snug">{hook.hookText}</p>
                    {hook.caption && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{hook.caption}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {hook.referenceVideo && (
                        <a
                          href={hook.referenceVideo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Reference
                        </a>
                      )}
                      {hook.lastUsedAt && (
                        <span className="text-xs text-slate-400">
                          Last sent {new Date(hook.lastUsedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeValidated(hook.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddHookModal
          campaignId={campaign.id}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); reload(); }}
        />
      )}

      {showBulk && (
        <BulkImportModal
          campaignId={campaign.id}
          onClose={() => setShowBulk(false)}
          onSuccess={(count) => { setShowBulk(false); reload(); alert(`${count} hooks imported`); }}
        />
      )}
    </div>
  );
}

function AddHookModal({
  campaignId,
  onClose,
  onSuccess,
}: {
  campaignId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [hookText, setHookText] = useState("");
  const [format, setFormat] = useState<HookFormat>("Faceless");
  const [caption, setCaption] = useState("");
  const [referenceVideo, setReferenceVideo] = useState("");
  const [recordingNotes, setRecordingNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hookText.trim() || submitting) return;
    setSubmitting(true);
    await fetch(`/api/campaigns/${campaignId}/validated`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hookText, format, caption, referenceVideo, recordingNotes }),
    });
    setSubmitting(false);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Add validated hook</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hook (text on screen)</label>
            <textarea
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              maxLength={200}
              rows={2}
              autoFocus
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400"
              placeholder="The hook text creators say or show on screen"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Format</label>
            <div className="flex flex-wrap gap-1.5">
              {HOOK_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    format === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={1000}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400"
              placeholder="Default caption when this hook is sent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reference video URL</label>
            <input
              value={referenceVideo}
              onChange={(e) => setReferenceVideo(e.target.value)}
              type="url"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Recording notes</label>
            <textarea
              value={recordingNotes}
              onChange={(e) => setRecordingNotes(e.target.value)}
              maxLength={800}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting || !hookText.trim()} className="flex-1 btn-primary disabled:opacity-50">
              {submitting ? "Adding..." : "Add hook"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function parseCSV(raw: string): string {
  // Convert CSV to tab-separated so the existing bulk API can handle it
  const lines = raw.split(/\r?\n/);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cells.push(current); current = ""; }
      else { current += ch; }
    }
    cells.push(current);
    return cells.join("\t");
  }).join("\n");
}

const HEADER_KEYWORDS = ["hook (text", "hook text", "hooks", "text on screen"];

function BulkImportModal({
  campaignId,
  onClose,
  onSuccess,
}: {
  campaignId: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function processFileContent(content: string, name: string) {
    const isCSV = name.endsWith(".csv") || content.includes(",");
    const converted = isCSV ? parseCSV(content) : content;
    // Strip header row if present
    const lines = converted.split(/\r?\n/).filter((l) => l.trim());
    const firstCell = lines[0]?.split("\t")[0]?.toLowerCase() ?? "";
    const hasHeader = HEADER_KEYWORDS.some((k) => firstCell.includes(k));
    const data = hasHeader ? lines.slice(1).join("\n") : lines.join("\n");
    setText(data);
    setPreview(lines.slice(hasHeader ? 1 : 0, hasHeader ? 4 : 3).map((l) => l.split("\t")[0]));
    setFileName(name);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => processFileContent(e.target?.result as string, file.name);
    reader.readAsText(file);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;

  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/campaigns/${campaignId}/validated/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: text }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) onSuccess(data.count);
    else alert(data.error || "Import failed");
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Bulk import validated hooks</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">

          {/* Mode tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {([["file", "Upload CSV"], ["paste", "Paste text"]] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setText(""); setFileName(""); setPreview([]); }}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <>
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
                In Google Sheets: <strong>File → Download → Comma Separated Values (.csv)</strong> → upload that file here.
                Columns are mapped automatically: Hook, Format, Reference URL, Caption, Notes.
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-10 text-center transition-colors",
                  dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                )}
              >
                {fileName ? (
                  <div className="space-y-2">
                    <div className="text-2xl">✅</div>
                    <div className="font-semibold text-slate-900 text-sm">{fileName}</div>
                    <div className="text-xs text-slate-500">{lineCount} hooks found</div>
                    {preview.length > 0 && (
                      <div className="mt-3 text-left bg-white rounded-xl p-3 border border-slate-200 space-y-1">
                        <div className="text-xs font-semibold text-slate-500 mb-1.5">Preview:</div>
                        {preview.map((line, i) => (
                          <div key={i} className="text-xs text-slate-700 truncate">• {line}</div>
                        ))}
                        {lineCount > preview.length && (
                          <div className="text-xs text-slate-400">…and {lineCount - preview.length} more</div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => { setText(""); setFileName(""); setPreview([]); }}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors mt-2"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-3xl">📄</div>
                    <div className="text-sm font-medium text-slate-700">Drop your CSV here</div>
                    <div className="text-xs text-slate-400">or</div>
                    <label className="btn-secondary text-xs cursor-pointer inline-block">
                      Browse file
                      <input type="file" accept=".csv,.tsv,.txt" onChange={onFileInput} className="hidden" />
                    </label>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
                One hook per line. Or copy rows straight from Google Sheets — columns paste as tabs automatically.
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 font-mono"
                placeholder={"Hook text here\nAnother hook\t Faceless\thttps://ref..."}
              />
            </>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {lineCount > 0 ? `${lineCount} hook${lineCount !== 1 ? "s" : ""} ready to import` : "No hooks yet"}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button onClick={submit} disabled={submitting || !text.trim()} className="btn-primary disabled:opacity-50">
                {submitting ? "Importing..." : `Import ${lineCount}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
