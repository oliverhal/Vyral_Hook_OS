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
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="card p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-500" />
          <h3 className="font-bold text-slate-900 text-sm">Shoutout Board</h3>
          <span className="badge bg-pink-100 text-pink-700 text-xs">anonymous</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors",
            showForm
              ? "bg-slate-100 border-slate-200 text-slate-600"
              : "bg-pink-500 border-pink-500 text-white hover:bg-pink-600"
          )}
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
          {showForm ? "Cancel" : "Send one"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 p-4 bg-pink-50 rounded-xl border border-pink-100 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Who's this for?</label>
            <input
              value={toName}
              onChange={(e) => setToName(e.target.value)}
              placeholder="Their name..."
              required
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-pink-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Your message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something nice..."
              required
              rows={2}
              maxLength={280}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-pink-400 bg-white resize-none"
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
          <button
            type="submit"
            disabled={submitting || !toName.trim() || !message.trim()}
            className="w-full py-2 text-sm font-semibold bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send anonymously ✨"}
          </button>
        </form>
      )}

      <div className="space-y-2 overflow-y-auto flex-1 max-h-80">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
          </div>
        ) : shoutouts.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">💌</div>
            <p className="text-sm text-slate-500">No shoutouts yet — be the first!</p>
          </div>
        ) : (
          shoutouts.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center text-lg flex-shrink-0">
                {s.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-slate-900">{s.toName}</span>
                  <span className="text-[10px] text-slate-400">{timeAgo(s.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{s.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
