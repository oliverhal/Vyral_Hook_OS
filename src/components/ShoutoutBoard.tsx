"use client";

import { useEffect, useState } from "react";
import { Heart, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = ["🌟", "🔥", "💪", "🙌", "❤️", "🎉", "👏", "✨", "💡", "🚀"];

interface Shoutout {
  id: string;
  toName: string;
  message: string;
  emoji: string;
  createdAt: string;
}

export default function ShoutoutCard() {
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [emoji, setEmoji] = useState("🌟");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const data = await fetch("/api/shoutouts").then((r) => r.json());
    setShoutouts(Array.isArray(data) ? data : []);
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

  const latest = shoutouts[0];

  return (
    <div className="card p-5 flex flex-col">
      {/* Header row — matches other stat cards */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Heart className="w-4 h-4 text-pink-500" />
          </div>
          <span className="text-sm font-medium text-slate-500">Shoutout Board</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors",
            showForm
              ? "bg-slate-100 border-slate-200 text-slate-500"
              : "bg-pink-50 border-pink-200 text-pink-600 hover:bg-pink-100"
          )}
        >
          {showForm ? <X className="w-3 h-3" /> : <Send className="w-3 h-3" />}
          {showForm ? "Cancel" : "Give one"}
        </button>
      </div>

      {/* Compose form */}
      {showForm ? (
        <form onSubmit={submit} className="space-y-2.5 flex-1">
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="Who's this for?"
            required
            autoFocus
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-pink-400"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Say something nice…"
            required
            rows={2}
            maxLength={280}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-pink-400 resize-none"
          />
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1 flex-wrap">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-7 h-7 rounded-md text-sm transition-all",
                    emoji === e ? "bg-pink-200 ring-2 ring-pink-400 scale-110" : "bg-slate-50 border border-slate-200 hover:border-pink-300"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={submitting || !toName.trim() || !message.trim()}
              className="px-3 py-1.5 text-xs font-semibold bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {submitting ? "…" : "Post"}
            </button>
          </div>
        </form>
      ) : (
        /* Latest shoutout or empty state */
        <div className="flex-1">
          {latest ? (
            <div>
              <p className="text-[11px] font-semibold text-pink-500 uppercase tracking-wide mb-1">
                Big shoutout to {latest.toName} {latest.emoji}
              </p>
              <p className="text-sm text-slate-700 leading-snug line-clamp-3">{latest.message}</p>
              {shoutouts.length > 1 && (
                <p className="text-xs text-slate-400 mt-2">+{shoutouts.length - 1} more this week</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No shoutouts yet this week — be the first!</p>
          )}
        </div>
      )}
    </div>
  );
}
