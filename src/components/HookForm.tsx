"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Loader2, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOOK_FORMATS } from "@/types";

interface HookFormProps {
  weekId: string;
  teamMembers: { id: string; name: string; color: string }[];
  onSuccess: () => void;
}

export default function HookForm({ weekId, onSuccess }: HookFormProps) {
  const { data: session } = useSession();
  const user = session?.user as { name?: string } | undefined;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creatorCaption, setCreatorCaption] = useState(false);
  const [requiresAppFootage, setRequiresAppFootage] = useState(false);
  const [form, setForm] = useState({
    hookText: "",
    format: "Faceless",
    caption: "",
    referenceVideo: "",
    recordingNotes: "",
    appFootageSource: "",
  });

  const isLongText = form.format === "Long text";

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hookText || !form.caption) {
      setError("Hook text and caption are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekId, ...form, requiresAppFootage }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit hook");
      }
      setForm({ hookText: "", format: "Faceless", caption: "", referenceVideo: "", recordingNotes: "", appFootageSource: "" });
      setCreatorCaption(false);
      setRequiresAppFootage(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 text-base">Submit a Hook</h2>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">{user?.name?.charAt(0) ?? "?"}</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">{user?.name ?? "You"}</span>
        </div>
      </div>

      {/* Hook text on screen */}
      <div>
        <label className="label">Hook (text on screen) *</label>
        <textarea
          className="textarea font-medium"
          rows={2}
          placeholder='e.g. "POV: someone made piano tiles but it teaches you songs IRL 🤯"'
          value={form.hookText}
          onChange={(e) => setField("hookText", e.target.value)}
          required
        />
        <div className="text-right text-xs text-slate-400 mt-1">{form.hookText.length} characters</div>
      </div>

      {/* Format */}
      <div>
        <label className="label">Format *</label>
        <div className="flex gap-2 flex-wrap">
          {HOOK_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setField("format", f);
                if (f === "Short text") {
                  setRequiresAppFootage(true);
                } else if (f === "Long text") {
                  setRequiresAppFootage(false);
                  setField("appFootageSource", "");
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                form.format === f
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* App footage */}
      {!isLongText && (
        <div className="space-y-2">
          <label className={cn("flex items-center gap-2 select-none w-fit", form.format === "Short text" ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
            <input
              type="checkbox"
              checked={requiresAppFootage}
              disabled={form.format === "Short text"}
              onChange={(e) => {
                setRequiresAppFootage(e.target.checked);
                if (!e.target.checked) setField("appFootageSource", "");
              }}
              className="rounded border-slate-300 accent-slate-800"
            />
            <span className="text-sm font-medium text-slate-700">
              Requires app footage{form.format === "Short text" && <span className="text-slate-400 font-normal ml-1">(always required)</span>}
            </span>
          </label>
          {requiresAppFootage && (
            <div>
              <label className="label">Where to find the footage *</label>
              <input
                className="input"
                placeholder="Link or description (e.g. Dropbox folder, Drive link, 'ask @name')"
                value={form.appFootageSource}
                onChange={(e) => setField("appFootageSource", e.target.value)}
                required
              />
            </div>
          )}
        </div>
      )}

      {/* Caption */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Caption *</label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={creatorCaption}
              onChange={(e) => {
                setCreatorCaption(e.target.checked);
                setField("caption", e.target.checked ? "Creator to come up with their own caption" : "");
              }}
              className="rounded border-slate-300 accent-slate-800"
            />
            Creator writes their own
          </label>
        </div>
        <textarea
          className={cn("textarea", creatorCaption && "opacity-50 cursor-not-allowed")}
          rows={3}
          placeholder="Caption for the creator — they'll customize this with their own voice"
          value={form.caption}
          onChange={(e) => !creatorCaption && setField("caption", e.target.value)}
          disabled={creatorCaption}
          required
          maxLength={1000}
        />
        <div className="text-right text-xs text-slate-400 mt-1">{form.caption.length}/1000</div>
      </div>

      {/* Reference video */}
      <div>
        <label className="label">Reference video URL</label>
        <div className="relative">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className={cn("input", "pl-9")}
            placeholder="https://..."
            type="url"
            value={form.referenceVideo}
            onChange={(e) => setField("referenceVideo", e.target.value)}
          />
        </div>
      </div>

      {/* Recording notes */}
      <div>
        <label className="label">
          Recording notes{" "}
          <span className="text-slate-400 font-normal normal-case tracking-normal">optional</span>
        </label>
        <textarea
          className="textarea"
          rows={2}
          placeholder="Detailed instructions for the creator on how to film this hook..."
          value={form.recordingNotes}
          onChange={(e) => setField("recordingNotes", e.target.value)}
          maxLength={800}
        />
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {loading ? "Submitting..." : "Submit Hook"}
      </button>
    </form>
  );
}
