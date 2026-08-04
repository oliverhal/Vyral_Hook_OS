"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, MapPin, ExternalLink, Bot, Send, ChevronDown,
  CheckCircle2, Clock, XCircle, Star, RefreshCw, Tag, StickyNote, Loader2,
  LayoutList, Table2, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Creator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  over18: boolean;
  location: string;
  tiktok: string | null;
  instagram: string | null;
  notes: string | null;
  submittedAt: string;
  client: string;
  status: string;
  language: string | null;
  country: string | null;
  gender: string | null;
  ageRange: string | null;
  tiktokFollowers: number | null;
  instagramFollowers: number | null;
  niche: string | null;
  enrichedAt: string | null;
  tags: string | null;
  internalNote: string | null;
  phone: string | null;
  referredBy: string | null;
  chronicIllness: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-slate-100 text-slate-600", icon: Clock },
  shortlisted: { label: "Shortlisted", color: "bg-amber-100 text-amber-700", icon: Star },
  approved: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600", icon: XCircle },
};

const LOCATION_OPTIONS = ["all", "Europe", "US", "Canada", "UK", "Australia", "Philippines", "Asia"];

const CLIENT_OPTIONS = ["all", "Vyral Labs", "Juno", "Jumpspeak", "Ecosia", "Artie", "Pazi"];

const CLIENT_COLORS: Record<string, string> = {
  "Vyral Labs":  "bg-violet-100 text-violet-700",
  "Juno":        "bg-pink-100 text-pink-700",
  "Jumpspeak":   "bg-blue-100 text-blue-700",
  "Ecosia":      "bg-green-100 text-green-700",
  "Artie":       "bg-amber-100 text-amber-700",
  "Pazi":        "bg-orange-100 text-orange-700",
};

function tiktokUrl(handle: string | null) {
  if (!handle) return null;
  if (handle.startsWith("http")) return handle;
  if (handle.startsWith("@")) return `https://tiktok.com/${handle}`;
  if (handle === "N/A" || handle === "None" || handle === "/") return null;
  return `https://tiktok.com/@${handle}`;
}

function instaUrl(handle: string | null) {
  if (!handle) return null;
  if (handle.startsWith("http")) return handle;
  if (handle === "." || handle === "N/A" || handle === "None") return null;
  const clean = handle.replace(/^@/, "");
  return `https://instagram.com/${clean}`;
}

function initials(c: Creator) {
  return (c.firstName[0] ?? "") + (c.lastName[0] ?? "");
}

const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

function avatarColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) & 0xfffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export default function CreatorsContent() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [view, setView] = useState<"list" | "table">("list");
  const [selected, setSelected] = useState<Creator | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editLanguage, setEditLanguage] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function fetchCreators() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (locationFilter !== "all") params.set("location", locationFilter);
    if (languageFilter !== "all") params.set("language", languageFilter);
    if (genderFilter !== "all") params.set("gender", genderFilter);
    if (clientFilter !== "all") params.set("client", clientFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/creators?${params}`);
    const data = await res.json();
    setCreators(data);
    setLoading(false);
  }

  useEffect(() => { fetchCreators(); }, [statusFilter, locationFilter, languageFilter, genderFilter, clientFilter]);

  // debounced search
  useEffect(() => {
    const t = setTimeout(fetchCreators, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (selected) {
      setEditNote(selected.internalNote || "");
      setEditTags(selected.tags || "");
      setEditLanguage(selected.language || "");
    }
  }, [selected?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/creators/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setCreators((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
  }

  async function deleteCreator(id: string) {
    if (!confirm("Delete this creator? This can't be undone.")) return;
    await fetch(`/api/creators/${id}`, { method: "DELETE" });
    setCreators((prev) => prev.filter((c) => c.id !== id));
    setSelected(null);
  }

  async function saveNote() {
    if (!selected) return;
    setSavingNote(true);
    await fetch(`/api/creators/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internalNote: editNote, tags: editTags, language: editLanguage }),
    });
    setCreators((prev) =>
      prev.map((c) => c.id === selected.id ? { ...c, internalNote: editNote, tags: editTags, language: editLanguage } : c)
    );
    setSelected((s) => s ? { ...s, internalNote: editNote, tags: editTags, language: editLanguage } : s);
    setSavingNote(false);
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    const res = await fetch("/api/creators/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    setChatMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
    setChatLoading(false);
  }

  async function runEnrichAll() {
    setEnrichingAll(true);
    let totalEnriched = 0;
    let batch = 0;
    while (true) {
      batch++;
      setImportResult(`Enriching… batch ${batch} (${totalEnriched} done so far)`);
      const res = await fetch("/api/creators/bulk-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      totalEnriched += data.enriched ?? 0;
      if (!data.enriched || data.enriched === 0) break;
    }
    setImportResult(`✓ Enriched ${totalEnriched} creator profiles`);
    setEnrichingAll(false);
    fetchCreators();
  }

  async function runBulkImport() {
    setImporting(true);
    setImportResult(null);
    const res = await fetch("/api/creators/sync-sheet", { method: "POST" });
    const data = await res.json();
    setImportResult(`Synced ${data.created} new creators (${data.skipped} already existed)`);
    setImporting(false);
    fetchCreators();
  }

  const counts = {
    all: creators.length,
    new: creators.filter((c) => c.status === "new").length,
    shortlisted: creators.filter((c) => c.status === "shortlisted").length,
    approved: creators.filter((c) => c.status === "approved").length,
    rejected: creators.filter((c) => c.status === "rejected").length,
  };

  /* ── shared toolbar helpers ── */
  const Toolbar = (
    <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center gap-3">
      {/* Title */}
      <h1 className="text-base font-bold text-slate-900 mr-2">Creator Applications</h1>

      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filters */}
      {[
        { value: clientFilter, set: setClientFilter, opts: CLIENT_OPTIONS.map((c) => ({ v: c, l: c === "all" ? "All programmes" : c })) },
        { value: statusFilter, set: setStatusFilter, opts: [
          { v: "all", l: "All status" }, { v: "new", l: `New (${counts.new})` },
          { v: "shortlisted", l: `Shortlisted (${counts.shortlisted})` },
          { v: "approved", l: `Approved (${counts.approved})` },
          { v: "rejected", l: `Rejected (${counts.rejected})` },
        ]},
        { value: locationFilter, set: setLocationFilter, opts: LOCATION_OPTIONS.map((l) => ({ v: l, l: l === "all" ? "All regions" : l })) },
        { value: languageFilter, set: setLanguageFilter, opts: [
          { v: "all", l: "All languages" }, { v: "German", l: "German" }, { v: "Dutch", l: "Dutch" },
          { v: "Italian", l: "Italian" }, { v: "Portuguese", l: "Portuguese" }, { v: "Spanish", l: "Spanish" },
          { v: "French", l: "French" }, { v: "Polish", l: "Polish" }, { v: "Greek", l: "Greek" }, { v: "English", l: "English" },
        ]},
        { value: genderFilter, set: setGenderFilter, opts: [
          { v: "all", l: "All genders" }, { v: "Female", l: "Female" }, { v: "Male", l: "Male" }, { v: "Non-binary", l: "Non-binary" },
        ]},
      ].map(({ value, set, opts }, i) => (
        <div key={i} className="relative">
          <select
            value={value}
            onChange={(e) => set(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>
      ))}

      <span className="text-xs text-slate-400 ml-1">{creators.length} creators</span>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        {importResult && <span className="text-xs text-emerald-600 font-medium">{importResult}</span>}
        <button
          onClick={runBulkImport}
          disabled={importing}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          title="Sync latest entries from all Google Sheets"
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync
        </button>
        <button
          onClick={runEnrichAll}
          disabled={enrichingAll}
          className="flex items-center gap-1.5 text-xs font-medium text-violet-500 hover:text-violet-800 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
          title="AI-enrich all profiles"
        >
          {enrichingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-sm leading-none">✨</span>}
          Enrich
        </button>
        {/* View toggle */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden ml-2">
          <button
            onClick={() => setView("list")}
            className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors", view === "list" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
          >
            <LayoutList className="w-3.5 h-3.5" /> List
          </button>
          <button
            onClick={() => setView("table")}
            className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors", view === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}
          >
            <Table2 className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>
    </div>
  );

  /* ── table view ── */
  if (view === "table") {
    const TH = ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <th className={cn("px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap border-b border-slate-200 bg-slate-50", className)}>
        {children}
      </th>
    );
    const TD = ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <td className={cn("px-3 py-2.5 text-xs text-slate-700 border-b border-slate-100 align-top", className)}>
        {children}
      </td>
    );
    return (
      <div className="flex flex-col h-full min-h-screen bg-slate-50">
        {Toolbar}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : creators.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm">No creators found.</div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <TH className="sticky left-0 z-10 min-w-[160px]">Name</TH>
                  <TH>Programme</TH>
                  <TH>Status</TH>
                  <TH>Country</TH>
                  <TH>Gender</TH>
                  <TH>Age</TH>
                  <TH>Language</TH>
                  <TH>Niche</TH>
                  <TH>TikTok</TH>
                  <TH>TT Followers</TH>
                  <TH>Instagram</TH>
                  <TH>IG Followers</TH>
                  <TH>Phone</TH>
                  <TH>Referred by</TH>
                  <TH>Enriched</TH>
                  <TH>Applied</TH>
                  <TH>Notes</TH>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => {
                  const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.new;
                  const tt = tiktokUrl(c.tiktok);
                  const ig = instaUrl(c.instagram);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => { setView("list"); setSelected(c); }}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <TD className="sticky left-0 bg-white hover:bg-blue-50 font-medium min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold", avatarColor(c.id))}>
                            {initials(c).toUpperCase()}
                          </div>
                          <span className="whitespace-nowrap">{c.firstName} {c.lastName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 ml-8 truncate max-w-[140px]">{c.email}</div>
                      </TD>
                      <TD>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", CLIENT_COLORS[c.client] ?? "bg-slate-100 text-slate-600")}>
                          {c.client}
                        </span>
                      </TD>
                      <TD>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap", cfg.color)}>
                          {cfg.label}
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap">{c.country ?? c.location ?? "—"}</TD>
                      <TD>{c.gender ?? <span className="text-slate-300">—</span>}</TD>
                      <TD className="whitespace-nowrap">{c.ageRange ?? <span className="text-slate-300">—</span>}</TD>
                      <TD className="whitespace-nowrap">{c.language ?? <span className="text-slate-300">—</span>}</TD>
                      <TD className="max-w-[140px]">
                        <span className="line-clamp-2">{c.niche ?? <span className="text-slate-300">—</span>}</span>
                      </TD>
                      <TD>
                        {tt ? (
                          <a href={tt} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline flex items-center gap-1 whitespace-nowrap">
                            {c.tiktok?.replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, "@").slice(0, 22) ?? ""}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : <span className="text-slate-400 text-[10px]">N/A</span>}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {c.tiktokFollowers != null ? c.tiktokFollowers.toLocaleString() : <span className="text-slate-300">—</span>}
                      </TD>
                      <TD>
                        {ig ? (
                          <a href={ig} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-pink-600 hover:underline flex items-center gap-1 whitespace-nowrap">
                            {c.instagram?.replace(/https?:\/\/(www\.)?instagram\.com\//, "").replace(/\?.*$/, "").replace(/\/$/, "").replace(/^@?/, "@").slice(0, 22) ?? ""}
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          </a>
                        ) : <span className="text-slate-400 text-[10px]">N/A</span>}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {c.instagramFollowers != null ? c.instagramFollowers.toLocaleString() : <span className="text-slate-300">—</span>}
                      </TD>
                      <TD className="whitespace-nowrap">{c.phone ?? <span className="text-slate-300">—</span>}</TD>
                      <TD className="max-w-[120px]">
                        <span className="line-clamp-1">{c.referredBy ?? <span className="text-slate-300">—</span>}</span>
                      </TD>
                      <TD>
                        {c.enrichedAt ? (
                          <span className="text-emerald-600 whitespace-nowrap">
                            {new Date(c.enrichedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        ) : <span className="text-amber-500">Pending</span>}
                      </TD>
                      <TD className="whitespace-nowrap text-slate-400">
                        {new Date(c.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                      </TD>
                      <TD className="max-w-[200px]">
                        <span className="line-clamp-2 text-slate-500">{c.notes ?? ""}</span>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {Toolbar}
      <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div className="flex flex-col w-[420px] min-w-[320px] border-r border-slate-200 bg-white overflow-y-auto">
        {/* Creator list */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          ) : creators.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No creators found.{" "}
              <button onClick={runBulkImport} className="text-blue-500 hover:underline">
                Import from sheet?
              </button>
            </div>
          ) : (
            creators.map((c) => {
              const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.new;
              const isSelected = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(isSelected ? null : c)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 border-b border-slate-100 text-left transition-colors",
                    isSelected ? "bg-blue-50" : "hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold", avatarColor(c.id))}>
                    {initials(c).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0", cfg.color)}>
                        {cfg.label}
                      </span>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0", CLIENT_COLORS[c.client] ?? "bg-slate-100 text-slate-600")}>
                        {c.client}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{c.country ?? c.location}</span>
                      {c.gender && <span className="text-xs text-slate-400">{c.gender === "Female" ? "♀" : c.gender === "Male" ? "♂" : "⚧"}</span>}
                      {c.ageRange && <span className="text-xs text-slate-400">{c.ageRange}</span>}
                      {c.language && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-blue-500 font-medium">{c.language.split(",")[0].trim()}</span>
                        </>
                      )}
                    </div>
                    {c.niche && <p className="text-xs text-slate-400 mt-0.5">{c.niche}</p>}
                    {c.notes && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{c.notes}</p>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          /* Creator detail */
          <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 mb-4 transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              Back to AI search
            </button>
            <div className="flex items-start gap-4 mb-6">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0", avatarColor(selected.id))}>
                {initials(selected).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-slate-900">
                  {selected.firstName} {selected.lastName}
                </h2>
                <p className="text-sm text-slate-500">{selected.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-600">{selected.country ?? selected.location}</span>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", CLIENT_COLORS[selected.client] ?? "bg-slate-100 text-slate-600")}>
                    {selected.client}
                  </span>
                  {!selected.over18 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Under 18</span>
                  )}
                  {!selected.enrichedAt && (
                    <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Not enriched</span>
                  )}
                </div>
              </div>
              {/* Status picker */}
              <div className="flex gap-2 flex-shrink-0">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => updateStatus(selected.id, key)}
                    className={cn(
                      "text-xs font-medium px-3 py-1.5 rounded-full transition-colors border",
                      selected.status === key
                        ? cn(cfg.color, "border-current")
                        : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Socials */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {tiktokUrl(selected.tiktok) ? (
                <a href={tiktokUrl(selected.tiktok)!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">TK</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium">TikTok</p>
                    <p className="text-sm text-slate-700 font-medium truncate group-hover:text-blue-600">
                      {selected.tiktok?.replace(/https?:\/\/(www\.)?tiktok\.com\/@?/, "@") ?? selected.tiktok}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                </a>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 opacity-50">
                  <div className="w-7 h-7 bg-slate-300 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">TK</span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">TikTok</p>
                    <p className="text-sm text-slate-400">Not provided</p>
                  </div>
                </div>
              )}
              {instaUrl(selected.instagram) ? (
                <a href={instaUrl(selected.instagram)!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group">
                  <div className="w-7 h-7 rounded-lg flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)" }}>
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">IG</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium">Instagram</p>
                    <p className="text-sm text-slate-700 font-medium truncate group-hover:text-blue-600">
                      {selected.instagram?.replace(/https?:\/\/(www\.)?instagram\.com\//, "@").replace(/\?.*$/, "") ?? selected.instagram}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                </a>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 border border-slate-100 rounded-xl bg-slate-50 opacity-50">
                  <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: "#ccc" }}>
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">IG</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Instagram</p>
                    <p className="text-sm text-slate-400">Not provided</p>
                  </div>
                </div>
              )}
            </div>

            {/* Enriched profile data */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: "Gender", value: selected.gender },
                { label: "Age range", value: selected.ageRange },
                { label: "Country", value: selected.country },
                { label: "Language", value: selected.language },
                { label: "Niche", value: selected.niche },
                { label: "TikTok followers", value: selected.tiktokFollowers?.toLocaleString() },
                { label: "Instagram followers", value: selected.instagramFollowers?.toLocaleString() },
                { label: "Phone", value: selected.phone },
                { label: "Referred by", value: selected.referredBy },
                { label: "Chronic illness", value: selected.chronicIllness },
              ].map(({ label, value }) => {
                if (!value && (label === "Phone" || label === "Referred by" || label === "Chronic illness")) return null;
                return (
                  <div key={label} className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className={cn("text-sm font-medium mt-0.5", value ? "text-slate-800" : "text-slate-300")}>
                      {value ?? "—"}
                    </p>
                  </div>
                );
              })}
              <div className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Enriched</p>
                <p className={cn("text-sm font-medium mt-0.5", selected.enrichedAt ? "text-emerald-600" : "text-slate-300")}>
                  {selected.enrichedAt ? new Date(selected.enrichedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Pending"}
                </p>
              </div>
            </div>

            {selected.notes && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Application Message</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selected.notes}</p>
              </div>
            )}

            <div className="mb-5 text-xs text-slate-400">
              Applied to <span className={cn("font-medium px-1.5 py-0.5 rounded", CLIENT_COLORS[selected.client] ?? "bg-slate-100 text-slate-600")}>{selected.client}</span> on {new Date(selected.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <span className="text-sm">🌐</span> Language
              </label>
              <input value={editLanguage} onChange={(e) => setEditLanguage(e.target.value)}
                placeholder="e.g. German, English, Italian, Dutch…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <Tag className="w-3.5 h-3.5" /> Campaign Tags
              </label>
              <input value={editTags} onChange={(e) => setEditTags(e.target.value)}
                placeholder="e.g. ecosia, getminds, europe-ready"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <StickyNote className="w-3.5 h-3.5" /> Internal Note
              </label>
              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3}
                placeholder="Add private notes about this creator…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={saveNote} disabled={savingNote}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
              <button onClick={() => deleteCreator(selected.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete record
              </button>
            </div>
          </div>
        ) : (
          /* AI Chat panel */
          <div className="flex-1 flex flex-col">
            {/* Input at top */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-900">Creator Search AI</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="e.g. Find female creators in Europe aged 18-25 with TikTok…"
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={sendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.length === 0 && (
                <div className="max-w-lg mx-auto text-center pt-8">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-7 h-7 text-blue-500" />
                  </div>
                  <p className="text-slate-600 font-medium mb-2">Find the right creators</p>
                  <p className="text-sm text-slate-400 mb-6">
                    Ask in plain English. I have access to all {creators.length > 0 ? creators.length : "your"} creator applications.
                  </p>
                  <div className="grid grid-cols-1 gap-2 text-left">
                    {[
                      "Find German-speaking creators across all programmes",
                      "Who are the Juno creators with chronic illness content experience?",
                      "Find Artie applicants who have piano access and TikTok",
                      "Show me Ecosia creators in Europe — which languages do they speak?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => { setChatInput(prompt); }}
                        className="text-left text-sm text-slate-600 px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                    )}
                  >
                    <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

          </div>
        )}
      </div>
      </div>
    </div>
  );
}
