"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Upload, Trash2, TrendingUp, TrendingDown, DollarSign, ChevronDown, ChevronUp, AlertCircle, Settings, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevolutTx {
  id: string;
  date: string;       // YYYY-MM-DD
  description: string;
  amount: number;     // negative = outgoing, positive = incoming
  currency: string;
  type: string;
}

interface CreatorRules {
  includeKeywords: string[];   // transaction desc must contain one of these
  excludeKeywords: string[];   // if desc contains any of these → NOT creator cost
  includeTransfers: boolean;   // flag all bank transfers (type=TRANSFER) as creator cost too
}

interface RevolutPLProps {
  selectedMonth: string;
  monthRevenue: number;
}

const STORAGE_KEY    = "vyral-revolut-v1";
const RULES_KEY      = "vyral-revolut-rules-v1";

const DEFAULT_RULES: CreatorRules = {
  includeKeywords: ["whop", "sideshift", "paypal"],
  excludeKeywords: ["hmd"],
  includeTransfers: true,
};

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; }
    else { current += ch; }
  }
  cols.push(current.trim());
  return cols;
}

function parseRevolutCSV(csv: string): RevolutTx[] {
  const lines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, "").trim());
  const idx = (names: string[]) => names.map(n => header.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1;

  const dateCol     = idx(["started date", "date completed", "date"]);
  const descCol     = idx(["description", "merchant", "reference"]);
  const amountCol   = idx(["amount"]);
  const currencyCol = idx(["currency"]);
  const stateCol    = idx(["state", "status"]);
  const typeCol     = idx(["type"]);

  if (dateCol < 0 || amountCol < 0) return [];

  const txs: RevolutTx[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;
    const clean = (ci: number) => ci >= 0 ? (cols[ci] ?? "").replace(/"/g, "").trim() : "";

    const state = clean(stateCol).toUpperCase();
    if (state && !["COMPLETED", "SETTLED", ""].includes(state)) continue;

    const rawDate = clean(dateCol).split(" ")[0];
    const amount  = parseFloat(clean(amountCol).replace(/[^0-9.\-]/g, ""));
    if (!rawDate || isNaN(amount)) continue;

    let date = rawDate;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split("/");
      date = `${y}-${m}-${d}`;
    }

    txs.push({
      id: `${date}-${i}-${amount}`,
      date,
      description: clean(descCol) || "Unknown",
      amount,
      currency: clean(currencyCol) || "EUR",
      type: clean(typeCol),
    });
  }
  return txs;
}

// ── Creator cost classification ───────────────────────────────────────────────

function isCreatorCost(tx: RevolutTx, rules: CreatorRules): boolean {
  if (tx.amount >= 0) return false;
  const desc = tx.description.toLowerCase();
  const type = tx.type.toLowerCase();

  // Exclusions take priority
  if (rules.excludeKeywords.some(k => k && desc.includes(k.toLowerCase()))) return false;

  // Keyword match (Whop, Sideshift, PayPal…)
  if (rules.includeKeywords.some(k => k && desc.includes(k.toLowerCase()))) return true;

  // Bank transfers (Revolut types: TRANSFER, TOPUP reversed, etc.)
  if (rules.includeTransfers && (type.includes("transfer") || type === "")) return true;

  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number, showSign = false) {
  const abs = Math.abs(v);
  const fmt = new Intl.NumberFormat("en-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
  return showSign && v !== 0 ? (v > 0 ? `+${fmt}` : `−${fmt}`) : fmt;
}

function fmtMonthLong(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

function topMerchants(txs: RevolutTx[], limit = 8) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const key = t.description.split(" ").slice(0, 3).join(" ");
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, total]) => ({ name, total }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RevolutPL({ selectedMonth, monthRevenue }: RevolutPLProps) {
  const [transactions, setTransactions] = useState<RevolutTx[]>([]);
  const [rules, setRules]               = useState<CreatorRules>(DEFAULT_RULES);
  const [ready, setReady]               = useState(false);
  const [dragging, setDragging]         = useState(false);
  const [parseError, setParseError]     = useState<string | null>(null);
  const [showAllTx, setShowAllTx]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newInclude, setNewInclude]     = useState("");
  const [newExclude, setNewExclude]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTransactions(JSON.parse(saved));
      const savedRules = localStorage.getItem(RULES_KEY);
      if (savedRules) setRules(JSON.parse(savedRules));
    } catch {}
    setReady(true);
  }, []);

  function saveRules(r: CreatorRules) {
    setRules(r);
    localStorage.setItem(RULES_KEY, JSON.stringify(r));
  }

  function handleFile(file: File) {
    setParseError(null);
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setParseError("Please upload a CSV file exported from Revolut.");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseRevolutCSV(text);
      if (parsed.length === 0) {
        setParseError("Couldn't parse this file. Make sure it's a Revolut CSV export (Statement → CSV).");
        return;
      }
      setTransactions(prev => {
        const existing = new Set(prev.map(t => t.id));
        const merged = [...prev, ...parsed.filter(t => !existing.has(t.id))];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      });
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const monthTxs = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const creatorTxs  = useMemo(() => monthTxs.filter(t => isCreatorCost(t, rules)),  [monthTxs, rules]);
  const opTxs       = useMemo(() => monthTxs.filter(t => t.amount < 0 && !isCreatorCost(t, rules)), [monthTxs, rules]);
  const incomingTxs = useMemo(() => monthTxs.filter(t => t.amount > 0), [monthTxs]);

  const creatorBurn = useMemo(() => creatorTxs.reduce((s, t) => s + Math.abs(t.amount), 0), [creatorTxs]);
  const opBurn      = useMemo(() => opTxs.reduce((s, t) => s + Math.abs(t.amount), 0),      [opTxs]);
  const inflow      = useMemo(() => incomingTxs.reduce((s, t) => s + t.amount, 0),           [incomingTxs]);
  const totalBurn   = creatorBurn + opBurn;
  const profit      = monthRevenue - opBurn; // creator costs are pass-through

  const hasData  = transactions.length > 0;
  const hasMonth = monthTxs.length > 0;

  const allMonths = useMemo(() => {
    const s = new Set(transactions.map(t => t.date.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [transactions]);

  const merchants    = useMemo(() => topMerchants(opTxs),      [opTxs]);
  const maxMerchant  = merchants[0]?.total ?? 1;

  if (!ready) return null;

  return (
    <div className="space-y-6">

      {/* Upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer",
          dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
        )}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Upload className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">
          {hasData ? "Upload another Revolut statement" : "Upload your Revolut statement"}
        </p>
        <p className="text-xs text-slate-400">Revolut → Accounts → Statement → Export as CSV</p>
        {hasData && (
          <p className="text-xs text-emerald-600 font-semibold mt-2">
            {transactions.length.toLocaleString()} transactions across {allMonths.length} months
          </p>
        )}
        {parseError && (
          <p className="text-xs text-red-500 font-semibold mt-2 flex items-center gap-1 justify-center">
            <AlertCircle className="w-3.5 h-3.5" /> {parseError}
          </p>
        )}
      </div>

      {!hasData && (
        <div className="card p-10 text-center">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm font-medium">No statement data yet</p>
          <p className="text-slate-300 text-xs mt-1">Upload a Revolut CSV above to see your P&L</p>
        </div>
      )}

      {hasData && (
        <>
          {!hasMonth && (
            <div className="card p-5 flex items-center gap-3 border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No transactions for {fmtMonthLong(selectedMonth)}</p>
                <p className="text-xs text-amber-600 mt-0.5">Available: {allMonths.slice(0, 4).join(", ")}{allMonths.length > 4 ? " …" : ""}</p>
              </div>
            </div>
          )}

          {/* P&L Summary — 5 cards */}
          <div className="grid grid-cols-5 gap-3">
            {/* Revenue */}
            <div className="card p-4">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Revenue</p>
              <p className="text-xl font-bold text-slate-900">{fmtEur(monthRevenue)}</p>
              <p className="text-xs text-slate-400 mt-1">Invoice milestones</p>
            </div>

            {/* Creator Costs */}
            <div className="card p-4 border-amber-200 bg-amber-50/40">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Creator Costs</p>
              <p className="text-xl font-bold text-slate-900">{hasMonth ? fmtEur(creatorBurn) : "—"}</p>
              <p className="text-xs text-slate-400 mt-1">Pass-through · {creatorTxs.length} txns</p>
            </div>

            {/* Operational Burn */}
            <div className="card p-4 border-red-200 bg-red-50/40">
              <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Op. Burn</p>
              <p className="text-xl font-bold text-slate-900">{hasMonth ? fmtEur(opBurn) : "—"}</p>
              <p className="text-xs text-slate-400 mt-1">Vyral expenses · {opTxs.length} txns</p>
            </div>

            {/* Bank Inflow */}
            <div className="card p-4">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Bank Inflow</p>
              <p className="text-xl font-bold text-slate-900">{hasMonth ? fmtEur(inflow) : "—"}</p>
              <p className="text-xs text-slate-400 mt-1">{incomingTxs.length} incoming</p>
            </div>

            {/* Est. Profit */}
            <div className={cn("card p-4", hasMonth ? (profit >= 0 ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50") : "")}>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-2", hasMonth ? (profit >= 0 ? "bg-emerald-100" : "bg-red-100") : "bg-slate-100")}>
                <DollarSign className={cn("w-3.5 h-3.5", hasMonth ? (profit >= 0 ? "text-emerald-600" : "text-red-500") : "text-slate-400")} />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Est. Profit</p>
              <p className={cn("text-xl font-bold", hasMonth ? (profit >= 0 ? "text-emerald-700" : "text-red-600") : "text-slate-400")}>
                {hasMonth ? fmtEur(profit, true) : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Revenue − op. burn</p>
            </div>
          </div>

          {/* Creator cost rules config */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">Creator cost rules</span>
                <span className="text-xs text-slate-400">
                  Matches: {rules.includeKeywords.join(", ")}{rules.includeTransfers ? ", bank transfers" : ""}
                  {rules.excludeKeywords.length > 0 ? ` · Excludes: ${rules.excludeKeywords.join(", ")}` : ""}
                </span>
              </div>
              {showSettings ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {showSettings && (
              <div className="px-6 pb-6 border-t border-slate-100 space-y-5 pt-5">
                <p className="text-xs text-slate-500">Transactions matching <strong>include keywords</strong> (minus <strong>exclude keywords</strong>) are flagged as creator costs — pass-through billing, excluded from your profit calculation.</p>

                {/* Include keywords */}
                <div>
                  <label className="label mb-2">Include keywords <span className="font-normal text-slate-400 normal-case">(description contains)</span></label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {rules.includeKeywords.map(k => (
                      <span key={k} className="flex items-center gap-1 badge bg-amber-50 text-amber-700 border border-amber-200 pl-2.5 pr-1.5">
                        {k}
                        <button onClick={() => saveRules({ ...rules, includeKeywords: rules.includeKeywords.filter(x => x !== k) })} className="hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newInclude}
                      onChange={e => setNewInclude(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newInclude.trim()) { saveRules({ ...rules, includeKeywords: [...rules.includeKeywords, newInclude.trim().toLowerCase()] }); setNewInclude(""); } }}
                      placeholder="e.g. stripe, wise…"
                      className="input flex-1 text-sm"
                    />
                    <button
                      onClick={() => { if (newInclude.trim()) { saveRules({ ...rules, includeKeywords: [...rules.includeKeywords, newInclude.trim().toLowerCase()] }); setNewInclude(""); } }}
                      className="btn-secondary text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Exclude keywords */}
                <div>
                  <label className="label mb-2">Exclude keywords <span className="font-normal text-slate-400 normal-case">(overrides include — never flagged as creator cost)</span></label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {rules.excludeKeywords.map(k => (
                      <span key={k} className="flex items-center gap-1 badge bg-slate-100 text-slate-600 border border-slate-200 pl-2.5 pr-1.5">
                        {k}
                        <button onClick={() => saveRules({ ...rules, excludeKeywords: rules.excludeKeywords.filter(x => x !== k) })} className="hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newExclude}
                      onChange={e => setNewExclude(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && newExclude.trim()) { saveRules({ ...rules, excludeKeywords: [...rules.excludeKeywords, newExclude.trim().toLowerCase()] }); setNewExclude(""); } }}
                      placeholder="e.g. hmd, salary…"
                      className="input flex-1 text-sm"
                    />
                    <button
                      onClick={() => { if (newExclude.trim()) { saveRules({ ...rules, excludeKeywords: [...rules.excludeKeywords, newExclude.trim().toLowerCase()] }); setNewExclude(""); } }}
                      className="btn-secondary text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Bank transfers toggle */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="includeTransfers"
                    checked={rules.includeTransfers}
                    onChange={e => saveRules({ ...rules, includeTransfers: e.target.checked })}
                    className="mt-0.5 w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                  <label htmlFor="includeTransfers" className="cursor-pointer">
                    <p className="text-sm font-semibold text-slate-700">Flag bank transfers as creator costs</p>
                    <p className="text-xs text-slate-400 mt-0.5">Outgoing bank transfers (type = TRANSFER) are treated as creator payments. Exclude keywords still apply — e.g. HMD transfers won't be flagged.</p>
                  </label>
                </div>

                <button onClick={() => saveRules(DEFAULT_RULES)} className="btn-secondary text-xs text-slate-400">Reset to defaults</button>
              </div>
            )}
          </div>

          {hasMonth && (
            <>
              {/* Op burn breakdown */}
              {merchants.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Operational spend — {fmtMonthLong(selectedMonth)}</h3>
                  <p className="text-xs text-slate-400 mb-4">Creator costs excluded · Vyral business expenses only</p>
                  <div className="space-y-3">
                    {merchants.map(m => (
                      <div key={m.name} className="flex items-center gap-3">
                        <div className="text-xs text-slate-500 truncate w-48 flex-shrink-0">{m.name}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${(m.total / maxMerchant) * 100}%` }} />
                        </div>
                        <div className="text-xs font-semibold text-slate-700 text-right w-20 flex-shrink-0">{fmtEur(m.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction list — split by category */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">
                    Transactions — {fmtMonthLong(selectedMonth)}
                    <span className="ml-2 text-slate-400 font-normal">({monthTxs.length})</span>
                  </h3>
                  <button onClick={() => setShowAllTx(v => !v)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                    {showAllTx ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Expand</>}
                  </button>
                </div>

                {/* Operational costs */}
                {opTxs.length > 0 && (
                  <>
                    <div className="px-6 py-2.5 bg-red-50 border-b border-red-100">
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Operational burn — {fmtEur(opBurn)}</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {(showAllTx ? opTxs : opTxs.slice(0, 6)).sort((a, b) => a.amount - b.amount).map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{tx.description}</p>
                            <p className="text-xs text-slate-400">{tx.date}{tx.type ? ` · ${tx.type}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold text-red-600 flex-shrink-0">−{fmtEur(Math.abs(tx.amount))}</span>
                        </div>
                      ))}
                      {!showAllTx && opTxs.length > 6 && (
                        <button onClick={() => setShowAllTx(true)} className="w-full text-xs text-slate-400 hover:text-slate-600 py-3 text-center">
                          +{opTxs.length - 6} more
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Creator costs */}
                {creatorTxs.length > 0 && (
                  <>
                    <div className="px-6 py-2.5 bg-amber-50 border-t border-amber-100 border-b border-amber-100">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Creator costs (pass-through) — {fmtEur(creatorBurn)}</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {(showAllTx ? creatorTxs : creatorTxs.slice(0, 6)).sort((a, b) => a.amount - b.amount).map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-amber-50/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{tx.description}</p>
                            <p className="text-xs text-slate-400">{tx.date}{tx.type ? ` · ${tx.type}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold text-amber-600 flex-shrink-0">−{fmtEur(Math.abs(tx.amount))}</span>
                        </div>
                      ))}
                      {!showAllTx && creatorTxs.length > 6 && (
                        <button onClick={() => setShowAllTx(true)} className="w-full text-xs text-amber-500 hover:text-amber-700 py-3 text-center">
                          +{creatorTxs.length - 6} more creator transactions
                        </button>
                      )}
                    </div>
                  </>
                )}

                {/* Incoming */}
                {showAllTx && incomingTxs.length > 0 && (
                  <>
                    <div className="px-6 py-2.5 bg-emerald-50 border-t border-emerald-100 border-b border-emerald-100">
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Incoming — {fmtEur(inflow)}</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {incomingTxs.sort((a, b) => b.amount - a.amount).map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-emerald-50/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{tx.description}</p>
                            <p className="text-xs text-slate-400">{tx.date}{tx.type ? ` · ${tx.type}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">+{fmtEur(tx.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Data management */}
          <div className="flex justify-end">
            <button
              onClick={() => { if (confirm("Remove all Revolut transaction data?")) { localStorage.removeItem(STORAGE_KEY); setTransactions([]); } }}
              className="btn-secondary text-xs text-red-500 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" /> Clear all transaction data
            </button>
          </div>
        </>
      )}
    </div>
  );
}
