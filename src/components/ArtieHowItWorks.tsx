"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "artie-howto-dismissed-v1";

// A short guide to using this page. Open the first time you visit, then it stays out of the way
// (re-open any time with the "How this works" button).
export default function ArtieHowItWorks({ threshold, currency, bonusAmount }: { threshold: number; currency: string; bonusAmount: number }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(localStorage.getItem(KEY) !== "1"); } catch { setOpen(true); } }, []);
  const set = (v: boolean) => { setOpen(v); if (!v) { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } } };
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(bonusAmount);
  const views = threshold >= 1000 ? `${Math.round(threshold / 1000)}K` : String(threshold);

  if (!open) {
    return (
      <button onClick={() => set(true)} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600">
        <BookOpen className="w-4 h-4" /> How this page works <ChevronDown className="w-4 h-4" />
      </button>
    );
  }

  const steps: { n: string; title: string; body: React.ReactNode }[] = [
    { n: "1", title: "It fills itself in", body: <>The creator list comes from the <strong>payroll sheet</strong> (Artie rows only) and the videos from <strong>ViralDeck</strong>. It syncs automatically <strong>twice a day</strong>; press <em>Sync now</em> for a fresh pull. Add, change or remove a creator in the sheet — never here.</> },
    { n: "2", title: "Read the numbers", body: <><strong>Unique videos</strong> = each video counted once, even if it’s on Instagram, TikTok and Facebook. <strong>Expected cost</strong> = unique videos × that creator’s per-video rate from the sheet, plus bonuses. It’s an estimate of what you’ll owe — final pay is still yours to confirm.</> },
    { n: "3", title: "Review bonuses — the only thing that needs you", body: <>A video that reaches <strong>{views} views</strong> becomes a <strong>{money}</strong> bonus. Most just say <em>“Hit X views — qualifies”</em>: press <strong>Approve</strong> (or <strong>Approve all</strong> at the top). If the same video is on both <strong>Instagram and Facebook</strong> you’ll see an amber warning — those accounts may be linked, so the views could be counted twice. Look at both numbers before approving, or reject/correct it.</> },
    { n: "4", title: "Click a creator to see underneath", body: <>Each card opens to show their bonuses, top videos and per-platform counts. <em>Open full review</em> lets you reject or correct an amount (a reason is required and every decision is logged).</> },
    { n: "5", title: "Send them their link", body: <>The <strong>link icon</strong> copies a creator’s private page (or <em>Copy all links</em> for name + link). It shows their unique videos, potential earnings and bonuses — approved ones appear there. They don’t get a Hook OS login. Use <em>Regenerate</em> on a creator’s page if a link leaks.</> },
    { n: "6", title: "Creators who leave", body: <>When someone is fired or deleted in the sheet they <strong>stay here until the pay cycle ends + 2 days</strong> (shown as “leaving”), so you can still review and pay the closing cycle. Then they drop off automatically.</> },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-blue-900 font-bold"><BookOpen className="w-4 h-4" /> How this page works</div>
        <button onClick={() => set(false)} className="p-1 rounded-lg text-blue-400 hover:text-blue-700 hover:bg-blue-100" title="Hide this guide"><X className="w-4 h-4" /></button>
      </div>
      <ol className="grid md:grid-cols-2 gap-x-8 gap-y-3">
        {steps.map((st) => (
          <li key={st.n} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
            <span className={cn("w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5")}>{st.n}</span>
            <div><p className="font-semibold text-slate-900">{st.title}</p><p>{st.body}</p></div>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-blue-700/70 mt-3">Cycles run the 29th → 28th. Nothing is paid from here — it’s a tracker and review tool.</p>
    </div>
  );
}
