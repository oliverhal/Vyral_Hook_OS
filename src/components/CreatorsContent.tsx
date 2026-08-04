"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search, MapPin, ExternalLink, Bot, Send, ChevronDown,
  CheckCircle2, Clock, XCircle, Star, RefreshCw, Tag, StickyNote, Loader2
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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-slate-100 text-slate-600", icon: Clock },
  shortlisted: { label: "Shortlisted", color: "bg-amber-100 text-amber-700", icon: Star },
  approved: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600", icon: XCircle },
};

const LOCATION_OPTIONS = ["all", "Europe", "US", "Canada", "UK", "Australia", "Philippines", "Asia"];

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
    if (search) params.set("search", search);
    const res = await fetch(`/api/creators?${params}`);
    const data = await res.json();
    setCreators(data);
    setLoading(false);
  }

  useEffect(() => { fetchCreators(); }, [statusFilter, locationFilter, languageFilter, genderFilter]);

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
    const res = await fetch("/api/creators/bulk-enrich", { method: "POST" });
    const data = await res.json();
    setImportResult(`Enriched ${data.enriched} creator profiles`);
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

  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      {/* Left panel */}
      <div className="flex flex-col w-[420px] min-w-[320px] border-r border-slate-200 bg-white">
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold text-slate-900">Creator Applications</h1>
            <button
              onClick={runBulkImport}
              disabled={importing}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Sync latest entries from Google Sheet"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sync Sheet
            </button>
            <button
              onClick={runEnrichAll}
              disabled={enrichingAll}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-500 hover:text-violet-800 px-2.5 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
              title="AI-enrich all profiles: gender, age, country, language, niche, follower counts"
            >
              {enrichingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-sm leading-none">✨</span>}
              Enrich All
            </button>
          </div>
          {importResult && (
            <p className="text-xs text-emerald-600 font-medium mt-1">{importResult}</p>
          )}

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, handle…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="relative">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LOCATION_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l === "all" ? "All regions" : l}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All status</option>
                <option value="new">New ({counts.new})</option>
                <option value="shortlisted">Shortlisted ({counts.shortlisted})</option>
                <option value="approved">Approved ({counts.approved})</option>
                <option value="rejected">Rejected ({counts.rejected})</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All languages</option>
                <option value="German">German</option>
                <option value="Dutch">Dutch</option>
                <option value="Italian">Italian</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="Polish">Polish</option>
                <option value="Greek">Greek</option>
                <option value="English">English</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All genders</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <p className="text-xs text-slate-400 mt-2">{creators.length} creators</p>
        </div>

        {/* Creator list */}
        <div className="flex-1 overflow-y-auto">
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
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold",
                      avatarColor(c.id)
                    )}
                  >
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
                    {c.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{c.notes}</p>
                    )}
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
            <div className="flex items-start gap-4 mb-6">
              <div
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0",
                  avatarColor(selected.id)
                )}
              >
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
                <a
                  href={tiktokUrl(selected.tiktok)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group"
                >
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
                <a
                  href={instaUrl(selected.instagram)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group"
                >
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
              ].map(({ label, value }) => (
                <div key={label} className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className={cn("text-sm font-medium mt-0.5", value ? "text-slate-800" : "text-slate-300")}>
                    {value ?? "—"}
                  </p>
                </div>
              ))}
              <div className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 col-span-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Enriched</p>
                <p className={cn("text-sm font-medium mt-0.5", selected.enrichedAt ? "text-emerald-600" : "text-slate-300")}>
                  {selected.enrichedAt ? new Date(selected.enrichedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Pending"}
                </p>
              </div>
            </div>

            {/* Application notes */}
            {selected.notes && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Application Message</p>
                <p className="text-sm text-slate-700 leading-relaxed">{selected.notes}</p>
              </div>
            )}

            {/* Meta */}
            <div className="mb-5 text-xs text-slate-400">
              Applied {new Date(selected.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>

            {/* Language */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <span className="text-sm">🌐</span>
                Language
              </label>
              <input
                value={editLanguage}
                onChange={(e) => setEditLanguage(e.target.value)}
                placeholder="e.g. German, English, Italian, Dutch…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <Tag className="w-3.5 h-3.5" />
                Campaign Tags
              </label>
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="e.g. ecosia, getminds, europe-ready"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Internal note */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                <StickyNote className="w-3.5 h-3.5" />
                Internal Note
              </label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                placeholder="Add private notes about this creator…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              onClick={saveNote}
              disabled={savingNote}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        ) : (
          /* AI Chat panel */
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Creator Search AI</h2>
                  <p className="text-xs text-slate-500">Ask me to find creators for any campaign</p>
                </div>
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
                      "Find European creators with TikTok accounts for a new campaign",
                      "Who has previous UGC experience?",
                      "Show me creators from Canada who mentioned referrals",
                      "Find creators who worked on Ecosia or Faircado",
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

            {/* Input */}
            <div className="px-6 py-4 border-t border-slate-200 bg-white">
              <div className="flex gap-3">
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
              <p className="text-xs text-slate-400 mt-2">
                Click a creator on the left to view their profile. Select one first to close this chat.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
