"use client";

import { useEffect, useState } from "react";
import { Heart, Megaphone, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = ["🌟", "🔥", "💪", "🙌", "❤️", "🎉", "👏", "✨", "💡", "🚀"];

interface Shoutout {
  id: string;
  toName: string;
  message: string;
  emoji: string;
  createdAt: string;
}

export default function ShoutoutBoard() {
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("🌟");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const data = await fetch("/api/shoutouts").then((r) => r.json());
    setShoutouts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!toName.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    await fetch("/api/shoutouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toName, message, emoji }),
    });
    setToName("");
    setMessage("");
    setEmoji("🌟");
    setShowForm(false);
    setSubmitting(false);
    load();
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Megaphone className="w-5 h-5 text-pink-500" />
          <h2 className="text-base font-bold text-slate-900">Shoutout Board</h2>
          <span className="badge bg-pink-100 text-pink-600 text-xs">anonymous</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl border transition-colors",
            showForm
              ? "bg-slate-100 border-slate-200 text-slate-600"
              : "bg-pink-500 border-pink-500 text-white hover:bg-pink-600"
          )}
        >
          {showForm ? <X className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
          {showForm ? "Cancel" : "Give a shoutout"}
        </button>
      </div>

      {/* Compose form */}
      {showForm && (
        <form onSubmit={submit} className="mb-5 p-5 bg-pink-50 rounded-2xl border border-pink-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Big shoutout to…</label>
              <input
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Name"
                required
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-pink-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Vibe</label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-base transition-all",
                      emoji === e ? "bg-pink-200 ring-2 ring-pink-400 scale-110" : "bg-white border border-slate-200 hover:border-pink-300"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">What did they do?</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. had some incredible hooks this week, always brings the energy…"
              required
              rows={2}
              maxLength={280}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-pink-400 bg-white resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-2.5 bg-white border border-pink-200 rounded-xl text-sm text-slate-500 italic">
              {toName || message
                ? `Big shoutout to ${toName || "…"} ${message ? `— ${message}` : ""}`
                : "Preview will appear here…"}
            </div>
            <button
              type="submit"
              disabled={submitting || !toName.trim() || !message.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-pink-500 hover:bg-pink-600 text-white rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Sending…" : "Post anonymously"}
            </button>
          </div>
        </form>
      )}

      {/* Feed */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}
        </div>
      ) : shoutouts.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">💌</div>
          <p className="text-sm font-medium text-slate-500">No shoutouts yet</p>
          <p className="text-xs text-slate-400 mt-1">Be the first to hype someone up</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shoutouts.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "rounded-2xl p-5 border",
                i === 0
                  ? "bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 col-span-1 sm:col-span-2 lg:col-span-1"
                  : "bg-white border-slate-100"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0",
                  i === 0 ? "bg-pink-100" : "bg-slate-50"
                )}>
                  {s.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-semibold uppercase tracking-wide mb-0.5", i === 0 ? "text-pink-500" : "text-slate-400")}>
                    Big shoutout to
                  </p>
                  <p className="font-bold text-slate-900 text-base leading-tight">{s.toName}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{timeAgo(s.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mt-3">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
