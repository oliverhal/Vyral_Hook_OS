import type { CreatorProgress, ProgressBonusItem } from "@/lib/artie/views";

const PLATFORM: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook" };

const STATE: Record<ProgressBonusItem["state"], { label: string; cls: string }> = {
  under_review: { label: "Awaiting review", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
  adjusted: { label: "Adjusted after review", cls: "bg-blue-100 text-blue-800" },
  not_approved: { label: "Not approved after review", cls: "bg-slate-200 text-slate-600" },
};

export default function ArtieProgressView({ progress: p }: { progress: CreatorProgress }) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const views = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
  const first = p.name.split(" ")[0];
  const threshold = views(p.bonusThreshold);

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-5">
      <div className="max-w-xl mx-auto space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Artie creator progress</p>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Hi {first} 👋</h1>
          <p className="text-sm text-slate-500 mt-1">
            Current cycle: <strong className="text-slate-700">{p.cycle.startLabel} → {p.cycle.endLabel}</strong>
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Videos counted</p>
            <p className="text-4xl font-black text-slate-900 mt-2">{p.countedVideos}</p>
            <p className="text-xs text-slate-400 mt-1">this cycle</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{threshold}+ view bonuses</p>
            <p className="text-4xl font-black text-slate-900 mt-2">{p.bonusCount}</p>
            <p className="text-xs text-slate-400 mt-1">
              {p.bonusCount ? <>Indicative: <strong className="text-slate-600">{money(p.indicativeBonus)}</strong></> : "none yet"}
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-900">Videos that reached {threshold} views</h2>
          {p.bonusItems.length === 0 ? (
            <p className="text-sm text-slate-400 mt-3">No videos have reached {threshold} views in this cycle yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {p.bonusItems.map((b) => (
                <li key={b.url} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 hover:underline">
                      {PLATFORM[b.platform] ?? b.platform} video · {views(b.views)} views
                    </a>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Posted {new Date(b.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATE[b.state].cls}`}>{STATE[b.state].label}</span>
                    <p className="text-sm font-bold text-slate-800 mt-1">
                      {b.state === "not_approved" ? "—" : money(b.amount)}
                    </p>
                    {b.previouslyShown != null && (
                      <p className="text-[11px] text-slate-400">previously shown {money(b.previouslyShown)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-relaxed text-amber-900 space-y-2">
          <p><strong>These figures are indicative, not a payment promise.</strong> Final numbers are checked and approved by the team at the end of the cycle.</p>
          <p>Bonuses apply to eligible <strong>unique</strong> videos. If the same video is posted on both Instagram and Facebook, the views can overlap, so the final total may change after review.</p>
        </section>

        {p.previousCycles.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-900">Previous cycles</h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {p.previousCycles.map((c) => (
                <li key={c.key} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold text-slate-700">{c.startLabel} → {c.endLabel}</p>
                    <p className="text-xs text-slate-400">{c.countedVideos} videos counted</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-700">{c.bonusCount} bonus{c.bonusCount === 1 ? "" : "es"} · {money(c.bonusAmount)}</p>
                    {c.awaitingReview > 0 && <p className="text-xs text-amber-600">{c.awaitingReview} still awaiting review</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-[11px] text-slate-400 pt-2">This is your private link — please don&apos;t share it.</p>
      </div>
    </main>
  );
}
