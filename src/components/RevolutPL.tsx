"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Upload, Trash2, TrendingUp, TrendingDown, DollarSign, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
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

interface RevolutPLProps {
  selectedMonth: string; // "YYYY-MM"
  monthRevenue: number;  // from invoice tracker (milestone invoices this month)
}

const STORAGE_KEY = "vyral-revolut-v1";

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
  const rawLines = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines = rawLines.filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, "").trim());

  // Column indices — support multiple Revolut export formats
  const idx = (names: string[]) => names.map(n => header.findIndex(h => h.includes(n))).find(i => i >= 0) ?? -1;
  const dateCol    = idx(["started date", "date completed", "date"]);
  const descCol    = idx(["description", "merchant", "reference"]);
  const amountCol  = idx(["amount"]);
  const currencyCol = idx(["currency"]);
  const stateCol   = idx(["state", "status"]);
  const typeCol    = idx(["type"]);

  if (dateCol < 0 || amountCol < 0) return [];

  const txs: RevolutTx[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const clean = (ci: number) => ci >= 0 ? (cols[ci] ?? "").replace(/"/g, "").trim() : "";

    const state = clean(stateCol).toUpperCase();
    if (state && !["COMPLETED", "SETTLED", ""].includes(state)) continue;

    const rawDate = clean(dateCol).split(" ")[0]; // strip time component
    const amount  = parseFloat(clean(amountCol).replace(/[^0-9.\-]/g, ""));
    if (!rawDate || isNaN(amount)) continue;

    // Normalise date to YYYY-MM-DD
    let date = rawDate;
    // Handle DD/MM/YYYY format
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(v: number, showSign = false) {
  const abs = Math.abs(v);
  const fmt = new Intl.NumberFormat("en-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
  return showSign && v !== 0 ? (v > 0 ? `+${fmt}` : `−${fmt}`) : fmt;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function fmtMonthLong(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

// Group by top merchants (by absolute amount, outgoing only)
function topMerchants(txs: RevolutTx[], limit = 8) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const key = t.description.split(" ").slice(0, 3).join(" "); // normalise slightly
    map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, total]) => ({ name, total }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RevolutPL({ selectedMonth, monthRevenue }: RevolutPLProps) {
  const [transactions, setTransactions] = useState<RevolutTx[]>([]);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showAllTx, setShowAllTx] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setTransactions(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  function saveTxs(txs: RevolutTx[]) {
    setTransactions(txs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
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
      // Merge with existing (deduplicate by id)
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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  const monthTxs = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const burn   = useMemo(() => monthTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTxs]);
  const inflow = useMemo(() => monthTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0),           [monthTxs]);
  const profit = monthRevenue - burn;

  const merchants = useMemo(() => topMerchants(monthTxs), [monthTxs]);
  const maxMerchant = merchants[0]?.total ?? 1;

  const outgoing = useMemo(() => monthTxs.filter(t => t.amount < 0).sort((a, b) => a.amount - b.amount), [monthTxs]);
  const incoming = useMemo(() => monthTxs.filter(t => t.amount > 0).sort((a, b) => b.amount - a.amount), [monthTxs]);

  const allMonths = useMemo(() => {
    const s = new Set(transactions.map(t => t.date.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [transactions]);

  if (!ready) return null;

  const hasData = transactions.length > 0;
  const hasMonth = monthTxs.length > 0;

  return (
    <div className="space-y-6">

      {/* Upload area */}
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
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <Upload className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700 mb-1">
          {hasData ? "Upload another Revolut statement" : "Upload your Revolut statement"}
        </p>
        <p className="text-xs text-slate-400">
          In Revolut → Accounts → Statement → Export as CSV. Drag & drop or click to browse.
        </p>
        {hasData && (
          <p className="text-xs text-emerald-600 font-semibold mt-2">
            {transactions.length.toLocaleString()} transactions loaded across {allMonths.length} months
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
          {/* Month context */}
          {!hasMonth && (
            <div className="card p-5 flex items-center gap-3 border-amber-200 bg-amber-50">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No Revolut transactions for {fmtMonthLong(selectedMonth)}</p>
                <p className="text-xs text-amber-600 mt-0.5">Available months: {allMonths.slice(0, 4).join(", ")}{allMonths.length > 4 ? " …" : ""}</p>
              </div>
            </div>
          )}

          {/* P&L Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{fmtEur(monthRevenue)}</p>
              <p className="text-xs text-slate-400 mt-1">Invoice milestone total</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Burn</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{hasMonth ? fmtEur(burn) : "—"}</p>
              <p className="text-xs text-slate-400 mt-1">{hasMonth ? `${outgoing.length} outgoing transactions` : "No data this month"}</p>
            </div>

            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Inflow</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{hasMonth ? fmtEur(inflow) : "—"}</p>
              <p className="text-xs text-slate-400 mt-1">{hasMonth ? `${incoming.length} incoming transactions` : "No data this month"}</p>
            </div>

            <div className={cn("card p-5", hasMonth ? (profit >= 0 ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50") : "")}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", hasMonth ? (profit >= 0 ? "bg-emerald-100" : "bg-red-100") : "bg-slate-100")}>
                  <DollarSign className={cn("w-4 h-4", hasMonth ? (profit >= 0 ? "text-emerald-600" : "text-red-500") : "text-slate-400")} />
                </div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Est. Profit</span>
              </div>
              <p className={cn("text-2xl font-bold", hasMonth ? (profit >= 0 ? "text-emerald-700" : "text-red-600") : "text-slate-400")}>
                {hasMonth ? fmtEur(profit, true) : "—"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Revenue − burn</p>
            </div>
          </div>

          {hasMonth && (
            <>
              {/* Top spending */}
              {merchants.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Top spend — {fmtMonthLong(selectedMonth)}</h3>
                  <div className="space-y-3">
                    {merchants.map(m => (
                      <div key={m.name} className="flex items-center gap-3">
                        <div className="text-xs text-slate-500 truncate w-48 flex-shrink-0">{m.name}</div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-red-400 h-2 rounded-full transition-all"
                            style={{ width: `${(m.total / maxMerchant) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs font-semibold text-slate-700 text-right w-20 flex-shrink-0">{fmtEur(m.total)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction list */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">
                    Transactions — {fmtMonthLong(selectedMonth)}
                    <span className="ml-2 text-slate-400 font-normal">({monthTxs.length})</span>
                  </h3>
                  <button
                    onClick={() => setShowAllTx(v => !v)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showAllTx ? <><ChevronUp className="w-3.5 h-3.5" /> Hide</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all</>}
                  </button>
                </div>

                {/* Outgoing */}
                <div className="divide-y divide-slate-50">
                  {(showAllTx ? outgoing : outgoing.slice(0, 8)).map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 truncate">{tx.description}</p>
                        <p className="text-xs text-slate-400">{tx.date}{tx.type ? ` · ${tx.type}` : ""}</p>
                      </div>
                      <span className="text-sm font-semibold text-red-600 flex-shrink-0">
                        −{fmtEur(Math.abs(tx.amount))}
                      </span>
                    </div>
                  ))}
                  {!showAllTx && outgoing.length > 8 && (
                    <button
                      onClick={() => setShowAllTx(true)}
                      className="w-full text-xs text-slate-400 hover:text-slate-600 py-3 text-center transition-colors"
                    >
                      Show {outgoing.length - 8} more outgoing transactions
                    </button>
                  )}
                </div>

                {/* Incoming (collapsed under a toggle) */}
                {incoming.length > 0 && showAllTx && (
                  <>
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Incoming</p>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {incoming.map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 truncate">{tx.description}</p>
                            <p className="text-xs text-slate-400">{tx.date}{tx.type ? ` · ${tx.type}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                            +{fmtEur(tx.amount)}
                          </span>
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
              onClick={() => {
                if (confirm("Remove all Revolut transaction data?")) {
                  localStorage.removeItem(STORAGE_KEY);
                  setTransactions([]);
                }
              }}
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
