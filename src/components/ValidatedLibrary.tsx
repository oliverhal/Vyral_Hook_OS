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

function BulkImportModal({
  campaignId,
  onClose,
  onSuccess,
}: {
  campaignId: string;
  onClose: () => void;
  onSuccess: (count: number) => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
          <div className="text-sm text-slate-600 leading-relaxed bg-blue-50 border border-blue-100 rounded-xl p-3">
            <strong className="text-blue-700">Tip:</strong> Copy your hooks straight from Google Sheets — the columns paste as
            tabs. Format: <code className="text-xs bg-white px-1 py-0.5 rounded">Hook ⇥ Format ⇥ Reference URL ⇥ Caption ⇥ Notes</code>
            <br />
            Or just paste plain text — one hook per line, all default to <strong>Faceless</strong>.
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 font-mono"
            placeholder={`I tried this hack for 30 days...\tFaceless\thttps://...\tDay 1 was rough but...\tShoot vertically\nWhy nobody talks about...\tSnapchat\n...`}
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{lineCount} hook{lineCount !== 1 ? "s" : ""} ready to import</span>
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
