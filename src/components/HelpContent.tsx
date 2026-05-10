"use client";

import Link from "next/link";
import {
  BookOpen, Flame, FileSpreadsheet,
  ThumbsUp, ThumbsDown, MessageSquare, Sparkles, Upload, ChevronRight,
  Users, Megaphone, Archive
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS_SUBMIT = [
  { step: "1", text: "Go to Campaigns in the sidebar, then click the current week for your campaign." },
  { step: "2", text: 'Click "+ Submit experimental hook" on the left side to open the form.' },
  { step: "3", text: "Write your hook text — this is what appears on screen in the video. Keep it punchy." },
  { step: "4", text: "Choose a format: Faceless, Snapchat, Face-to-camera, Voiceover, or Text-only." },
  { step: "5", text: "Write a caption — this is what the creator posts alongside the video." },
  { step: "6", text: "Optionally add a reference video URL (something that inspired the hook) and recording notes." },
  { step: "7", text: "Hit Submit. Your hook appears on the right side immediately." },
];

const STEPS_SHEETS = [
  { step: "1", text: "Select your experimental hooks first — click each one to check it off (you'll see a blue ring)." },
  { step: "2", text: "On the left, pick 7 validated hooks from the library panel (they turn orange when selected)." },
  { step: "3", text: 'Click the Export panel → "Google Sheets" tab.' },
  { step: "4", text: 'Click "Copy for Google Sheets" — this copies all 14 hooks tab-separated to your clipboard.' },
  { step: "5", text: "Open the shared Google Sheet for that campaign (the live one creators use)." },
  { step: "6", text: "Click the first empty cell in the Hook column (below the last week's hooks)." },
  { step: "7", text: "Paste (Cmd+V on Mac / Ctrl+V on Windows). The columns fill in automatically: Hook, Format, Reference, Caption, Notes." },
  { step: "8", text: "The sheet updates live — creators will see it immediately." },
];

const STEPS_VIRAL = [
  { step: "1", text: "After a week's hooks have gone out to creators, check back to see which ones performed." },
  { step: "2", text: "Go into that week view and find the hook that went viral." },
  { step: "3", text: "Click the 🔥 flame button (top right of the hook card) — admin only." },
  { step: "4", text: "It gets added to the campaign's Validated Library automatically, with the date." },
  { step: "5", text: "Next week it shows up in the validated picker for you to select. It tracks how many times it's been used so you don't repeat it too often." },
];

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  );
}

function StepList({ steps }: { steps: { step: string; text: string }[] }) {
  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <div key={s.step} className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
            {s.step}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed pt-0.5">{s.text}</p>
        </div>
      ))}
    </div>
  );
}

function Callout({ color, icon: Icon, title, children }: {
  color: "blue" | "orange" | "emerald" | "violet";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    orange: "bg-orange-50 border-orange-200 text-orange-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
    violet: "bg-violet-50 border-violet-200 text-violet-900",
  };
  const iconStyles = {
    blue: "text-blue-500",
    orange: "text-orange-500",
    emerald: "text-emerald-500",
    violet: "text-violet-500",
  };
  return (
    <div className={cn("p-4 rounded-xl border", styles[color])}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn("w-4 h-4", iconStyles[color])} />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

const navLinks = [
  { href: "#overview", label: "Overview" },
  { href: "#weekly-flow", label: "Weekly Flow" },
  { href: "#submitting", label: "Submitting Hooks" },
  { href: "#feedback", label: "Voting & Comments" },
  { href: "#sheets", label: "Sending to Creators" },
  { href: "#validated", label: "Validated Hooks" },
  { href: "#faq", label: "FAQ" },
];

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
          <BookOpen className="w-4 h-4" />
          <span>Team Guide</span>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">How Hook OS works</h1>
        <p className="text-lg text-slate-500 leading-relaxed max-w-2xl">
          Everything your team needs to know — from submitting hooks to getting them into the creators' Google Sheet.
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-wrap gap-1.5 mb-12 p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
        {navLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
          >
            {l.label}
          </a>
        ))}
      </nav>

      <div className="space-y-16">

        {/* ── OVERVIEW ── */}
        <Section id="overview">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">What is Hook OS?</h2>
          <p className="text-slate-600 leading-relaxed mb-6">
            Hook OS is Vyral Labs' internal tool for managing the weekly hooks we send to creators.
            Instead of editing Google Sheets directly, the team submits hook ideas here,
            gives each other feedback, and exports the final selection straight into the creator-facing sheet —
            all without touching a spreadsheet.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Megaphone, label: "Campaigns", desc: "One campaign per client. Each has its own hook library and weekly cadence." },
              { icon: BookOpen, label: "Weeks", desc: "A new week is created each cycle. This is where the team submits and votes on hooks." },
              { icon: Flame, label: "Validated Library", desc: "Hooks that went viral live here. Every week, 7 come from here + 7 are brand new." },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="card p-5">
                <Icon className="w-5 h-5 text-blue-600 mb-3" />
                <div className="font-semibold text-slate-900 text-sm mb-1">{label}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── WEEKLY FLOW ── */}
        <Section id="weekly-flow">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">The weekly cycle</h2>
          <p className="text-slate-500 text-sm mb-6">Every week looks the same. Here's what happens when.</p>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

            <div className="space-y-6">
              {[
                {
                  day: "Mon",
                  dot: "bg-blue-600",
                  badge: "bg-blue-100 text-blue-700",
                  title: "Week opens — start submitting",
                  body: "The new week goes live. Everyone on the team submits their experimental hook ideas before the deadline. Aim to get yours in early so there's time for feedback.",
                },
                {
                  day: "Mon 6pm",
                  dot: "bg-amber-500",
                  badge: "bg-amber-100 text-amber-700",
                  title: "Submission deadline",
                  body: "Hooks are due by Monday 6pm. After this, the admin team reviews everything and picks the top 7 experimental hooks.",
                },
                {
                  day: "Tue",
                  dot: "bg-violet-600",
                  badge: "bg-violet-100 text-violet-700",
                  title: "Admin selects + exports",
                  body: "Admin clicks the top 7 experimental hooks to select them (blue ring). Then picks 7 validated hooks from the campaign library. Exports everything into the creator's Google Sheet.",
                },
                {
                  day: "Tue–Wed",
                  dot: "bg-emerald-600",
                  badge: "bg-emerald-100 text-emerald-700",
                  title: "Creators receive hooks",
                  body: "The Google Sheet updates live. Creators can see the new hooks and start filming.",
                },
                {
                  day: "Following week",
                  dot: "bg-orange-500",
                  badge: "bg-orange-100 text-orange-700",
                  title: "Mark what went viral",
                  body: "Once you know which hooks performed, admins click the 🔥 button on them. They automatically move to the Validated Library for future weeks.",
                },
              ].map(({ day, dot, badge, title, body }) => (
                <div key={day} className="flex gap-4 pl-2">
                  <div className={cn("w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center z-10", dot)}>
                    <span className="w-2 h-2 bg-white rounded-full" />
                  </div>
                  <div className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("badge text-xs font-bold", badge)}>{day}</span>
                      <span className="font-semibold text-slate-900 text-sm">{title}</span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── SUBMITTING ── */}
        <Section id="submitting">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">How to submit a hook</h2>
          <p className="text-slate-500 text-sm mb-6">Takes about 2 minutes per hook. These are called <strong>experimental hooks</strong> — brand new ideas you're testing this week.</p>

          <StepList steps={STEPS_SUBMIT} />

          <div className="mt-6 space-y-3">
            <Callout color="blue" icon={Sparkles} title="AI captions">
              Once a hook is selected (blue ring), click the ✨ sparkle icon to generate an AI caption. It uses the hook text, format, and campaign context to write something authentic — not corporate. You can also generate all captions at once from the header button.
            </Callout>
            <Callout color="violet" icon={BookOpen} title="Writing good hooks">
              A hook is the first thing someone sees — the text on screen or the first thing they say. It should create immediate curiosity, tell a story, or make a bold claim. Reference videos help the creator understand the style you're going for.
            </Callout>
          </div>
        </Section>

        {/* ── FEEDBACK ── */}
        <Section id="feedback">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Voting & comments</h2>
          <p className="text-slate-500 text-sm mb-6">Give each other quick feedback so the best ideas rise to the top before admin selects the final seven.</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  <ThumbsDown className="w-4 h-4 text-red-500" />
                </div>
                <span className="font-semibold text-slate-900 text-sm">Upvote / Downvote</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click 👍 to upvote a hook you think is strong, 👎 if you're unsure. One vote per person — click again to flip it. The score shows up on the card so admins can see community consensus.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span className="font-semibold text-slate-900 text-sm">Comments</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click the 💬 icon to open the comment thread on any hook. Leave specific feedback — "this hook would work better with a face" or "the caption needs to be shorter". Hover a comment to delete it.
              </p>
            </div>
          </div>

          <Callout color="emerald" icon={Users} title="Team culture tip">
            Voting and commenting isn't about being negative — it's about making the final selection stronger. If you downvote something, leave a comment explaining why so the person can learn from it.
          </Callout>
        </Section>

        {/* ── SHEETS ── */}
        <Section id="sheets">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Sending hooks to creators via Google Sheets</h2>
          <p className="text-slate-500 text-sm mb-6">
            Once you've selected 7 experimental hooks and 7 validated hooks, export them into the live Google Sheet that creators use.
            The sheet stays live — creators see it update immediately.
          </p>

          <StepList steps={STEPS_SHEETS} />

          <div className="mt-6 space-y-3">
            <Callout color="blue" icon={FileSpreadsheet} title="Why copy-paste instead of auto-sync?">
              This keeps you in control. You decide exactly which row the hooks go into, which sheet, and when. No surprise overwrites. Once everything is stable and you want one-click sync, we can wire up the Google Sheets API.
            </Callout>
            <Callout color="orange" icon={Flame} title="The 🔥 validated hooks show in the sheet too">
              Validated hooks get pasted alongside the experimental ones — creators see all 14 in one sheet. The 🔥 in the Slack message marks which ones are validated, but the sheet itself looks the same for everyone.
            </Callout>
          </div>

          <div className="mt-6 card overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">What the pasted columns look like</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    {["Hook (text on screen)", "Format", "Reference Vid:", "Captions (pls add your own hashtags)", "Notes:"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-3 py-2 text-slate-700 max-w-[200px]">I tried this for 30 days and my piano went from zero to actually sounding good</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">Faceless</td>
                    <td className="px-3 py-2 text-blue-600 whitespace-nowrap">tiktok.com/…</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[200px]">POV: you actually stuck with something for a month 🎹</td>
                    <td className="px-3 py-2 text-slate-500">Keep it close-up on hands</td>
                  </tr>
                  <tr className="bg-orange-50">
                    <td className="px-3 py-2 text-slate-700 max-w-[200px]">The one thing every beginner gets wrong 🔥</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">Snapchat</td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[200px]">This changed everything when I finally understood it</td>
                    <td className="px-3 py-2 text-slate-500">Reaction style</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-5 py-2 text-[11px] text-slate-400 border-t border-slate-100">
              Orange row = validated hook (🔥 proven viral). White rows = new experimental hooks. Both paste the same way.
            </div>
          </div>
        </Section>

        {/* ── VALIDATED ── */}
        <Section id="validated">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">The Validated Library</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your library of hooks that have already gone viral. These are gold — proven to work with real audiences.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card p-4 border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-slate-900 text-sm">How a hook becomes validated</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                An admin clicks the 🔥 flame button on a hook from a past week. It gets saved to the campaign's Validated Library automatically, with the date it was added.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-900 text-sm">Importing from your Google Sheet</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Already have validated hooks in a spreadsheet? Go to Campaigns → click the orange <strong>Validated</strong> button → <strong>Bulk import</strong> → paste your hooks. Tab-separated from Sheets works directly.
              </p>
            </div>
          </div>

          <StepList steps={STEPS_VIRAL} />

          <div className="mt-6">
            <Callout color="orange" icon={Flame} title="Bulk mode (new campaigns)">
              If a campaign is brand new and has no validated hooks yet, switch the week to <strong>Bulk mode</strong> using the toggle at the top of the week view. This lets you send 14 experimental hooks instead of the usual 7+7 split.
            </Callout>
          </div>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">FAQ</h2>

          <div className="space-y-4">
            {[
              {
                q: "I can't see the flame button — why?",
                a: "The 🔥 button to mark a hook as viral is admin-only. If you think a hook should be validated, let Oliver know and he'll mark it.",
              },
              {
                q: "Can I edit a hook after submitting?",
                a: "Not yet — if you need to change something, delete it (trash icon) and resubmit. Deletions are only possible before the week is finalized.",
              },
              {
                q: "What's the difference between AI Caption and my caption?",
                a: "Your caption is what you write when you submit the hook. The AI caption (✨ sparkle button) rewrites it to sound more natural for social media. The AI one gets used in the export if it exists; otherwise your original caption is used.",
              },
              {
                q: "How do I know if my hook was selected?",
                a: "Selected hooks get a blue ring around the card and a number showing their position in the final seven. You'll see it immediately once admin selects it.",
              },
              {
                q: "What if we want to send more or fewer than 7 hooks?",
                a: 'The target is set per campaign. Oliver can adjust it when creating the campaign — it\'s separate for experimental vs validated. The week view shows the progress bar against your target.',
              },
              {
                q: "Where do I find old hooks from past weeks?",
                a: "Go to Archive in the sidebar. You can search by keyword, filter by campaign, format, or see only viral hooks. Each result links back to the original week.",
              },
              {
                q: "The Slack message — when do we use that?",
                a: "If you need to message creators directly (outside of the sheet), use Export → Slack tab to copy a formatted message. It lists all 14 hooks with formatting already done.",
              },
            ].map(({ q, a }) => (
              <details key={q} className="group card p-0 overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                  <span className="font-semibold text-slate-900 text-sm">{q}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform flex-shrink-0 ml-3" />
                </summary>
                <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div className="pt-8 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-400 mb-4">Something not covered here? Ping Oliver.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/campaigns" className="btn-primary flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              Go to Campaigns
            </Link>
            <Link href="/archive" className="btn-secondary flex items-center gap-2">
              <Archive className="w-4 h-4" />
              View Archive
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
