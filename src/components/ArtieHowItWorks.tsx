"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Remembered per browser, in BOTH directions: minimise it and it stays minimised across reloads until
// you expand it again (and the other way round). Open the first time you ever visit.
const KEY = "artie-howto-open-v2";

// A short guide to using this page. Open the first time you visit, then it stays out of the way
// (re-open any time with the "How this works" button).
export default function ArtieHowItWorks({ threshold, currency, bonusAmount }: { threshold: number; currency: string; bonusAmount: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v !== null) setOpen(v === "1"); } catch { /* storage blocked: stay open */ } }, []);
  const set = (v: boolean) => { setOpen(v); try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* ignore */ } };
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(bonusAmount);
  const views = threshold >= 1000 ? `${Math.round(threshold / 1000)}K` : String(threshold);

  if (!open) {
    return (
      <button onClick={() => set(true)} aria-expanded={false}
        className="mb-5 w-full flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2.5 text-sm font-medium text-blue-900 hover:bg-blue-50 transition-colors">
        <span className="inline-flex items-center gap-2"><BookOpen className="w-4 h-4" /> How this page works</span>
        <span className="inline-flex items-center gap-1 text-xs text-blue-600">Show <ChevronDown className="w-4 h-4" /></span>
      </button>
    );
  }

  const steps: { n: string; title: string; body: React.ReactNode }[] = [
    { n: "1", title: "It fills itself in", body: <>The creator list comes from the <strong>payroll sheet</strong> (Artie rows only) and the videos from <strong>ViralDeck</strong>. It syncs automatically <strong>twice a day</strong>; press <em>Sync now</em> for a fresh pull. Add, change or remove a creator in the sheet — never here.</> },
    { n: "2", title: "Read the numbers", body: <><strong>Unique videos</strong> = each video counted once, even if it’s on Instagram, TikTok and Facebook. <strong>Spent on creators</strong> = unique videos × each creator’s own per-video rate from the sheet (bonuses are shown separately). Each card also shows <strong>pace</strong> against the daily target (2 a day) — counted from the day of their first post (creators who haven’t posted yet aren’t measured), so new creators aren’t marked behind for days before they joined. Use the cycle arrows to see any pay cycle. It’s a calculation to check against — final pay is still yours to confirm.</> },
    { n: "3", title: "Review bonuses — the only thing that needs you", body: <>A video that reaches <strong>{views} views</strong> becomes a <strong>{money}</strong> bonus. Most just say <em>“Hit X views — qualifies”</em>: press <strong>Approve</strong> (or <strong>Approve all</strong> at the top). A video that’s viral on <strong>both Instagram and Facebook with clearly different views</strong> earns <strong>two</strong> bonuses (one each). If the views are <strong>the same or similar</strong> you’ll see an amber “investigate” — Facebook shows its views on Instagram too when the accounts are linked, so it’s probably one set of views: check both, then <strong>Reject</strong> it (pick a reason) or approve.</> },
    { n: "4", title: "Click a creator to see underneath", body: <>Each card opens to show their bonuses, top videos and per-platform counts. <em>Open full review</em> lets you reject or correct an amount (a reason is required and every decision is logged).</> },
    { n: "5", title: "Send them their link", body: <>The <strong>link icon</strong> copies a creator’s private page (or <em>Copy all links</em> for name + link). It shows their unique videos, potential earnings and bonuses — approved ones appear there. If they’re behind, their link tells them straight what they’re missing in videos and money. The <strong>megaphone</strong> on a behind creator (or <em>Copy nudges</em>) gives you a ready-to-send message with their numbers. They don’t get a Hook OS login. Use <em>Regenerate</em> on a creator’s page if a link leaks.</> },
    { n: "6", title: "Creators who leave", body: <>When someone is fired or deleted in the sheet they <strong>stay here until the pay cycle ends + 2 days</strong> (shown as “leaving”), so you can still review and pay the closing cycle. Then they drop off automatically.</> },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-blue-900 font-bold"><BookOpen className="w-4 h-4" /> How this page works</div>
        <button onClick={() => set(false)} aria-expanded={true} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100" title="Minimise — it stays minimised until you open it again">
          Minimise <ChevronUp className="w-4 h-4" />
        </button>
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
