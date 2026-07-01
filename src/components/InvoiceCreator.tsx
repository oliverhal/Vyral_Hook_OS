"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Printer, ChevronDown, ChevronUp, RotateCcw, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Vyral Labs sender defaults ────────────────────────────────────────────────

const VYRAL = {
  company: "Vyral Labs Ltd",
  address: "3 Bournside Drive\nGL51 3AP, Cheltenham\nUnited Kingdom",
  iban: "GB41 REVO 2301 2061 2070 56",
  bic: "REVOGB21",
  intermediaryBic: "CHASGB2L",
};

// ── Client billing details (pre-populated) ────────────────────────────────────

interface ClientBilling {
  companyName: string;
  address: string;
  vatId: string;
  contactName: string;
  series: string;
}

const CLIENT_BILLING: Record<string, ClientBilling> = {
  "Shameless Pets": {
    companyName: "Shameless Pets, Inc.",
    address: "474 N Lakeshore Dr\nChicago, Illinois, US 60611",
    vatId: "",
    contactName: "James Bello",
    series: "SHAMELESS",
  },
  "Juno": {
    companyName: "SharedGenes, Inc.",
    address: "2803 Philadelphia Pike\n19703 Claymont, Delaware, USA",
    vatId: "",
    contactName: "Isaac Tolley",
    series: "JUN",
  },
  "Faircado UG": {
    companyName: "Faircado UG",
    address: "Rudi-Dutschke Straße 26\n10969 Berlin, Germany",
    vatId: "DE351581686",
    contactName: "",
    series: "FAIRCADO",
  },
  "Natively": {
    companyName: "Small Scale Labs AB",
    address: "Agavägen 19\n18155 Lidingö, Sweden",
    vatId: "",
    contactName: "",
    series: "NATIVELY",
  },
  "Artie (New Contract)": {
    companyName: "Art Master Academy s.r.o.",
    address: "Příčná 147/2, 370 01 České Budějovice\nCzech Republic",
    vatId: "CZ07597177",
    contactName: "",
    series: "ART",
  },
  "MeetCiao": {
    companyName: "MeetCiao",
    address: "",
    vatId: "",
    contactName: "",
    series: "MEETCIAO",
  },
  "MeetCiao Contract Extension": {
    companyName: "MeetCiao",
    address: "",
    vatId: "",
    contactName: "",
    series: "MEETCIAO",
  },
  "Ecosia": {
    companyName: "Ecosia GmbH",
    address: "",
    vatId: "",
    contactName: "",
    series: "ECOSIA",
  },
  "Jumpspeak": {
    companyName: "Jumpspeak",
    address: "",
    vatId: "",
    contactName: "",
    series: "JUMPSPEAK",
  },
  "TwoCents inc": {
    companyName: "TwoCents Inc.",
    address: "",
    vatId: "",
    contactName: "",
    series: "TWOCENTS",
  },
  "Garderobe": {
    companyName: "Garderobe",
    address: "",
    vatId: "",
    contactName: "",
    series: "GARDEROBE",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }
function todayStr() { return new Date().toISOString().split("T")[0]; }
function inDaysStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}
function fmtDateLong(s: string) {
  if (!s) return "—";
  return new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}
function fmtEur(n: number) {
  return `€${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function parseAmt(s: string) { return parseFloat(s.replace(/[^0-9.]/g, "")) || 0; }

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem { id: string; description: string; amount: string; }
interface CreatorLine { id: string; name: string; platform: string; amount: string; }

const blankItem = (): LineItem => ({ id: uid(), description: "", amount: "" });
const blankCreator = (): CreatorLine => ({ id: uid(), name: "", platform: "", amount: "" });

const BILLING_KEY = "vyral-client-billing-v1";

function loadSavedBilling(): Record<string, ClientBilling> {
  try { return JSON.parse(localStorage.getItem(BILLING_KEY) || "{}"); } catch { return {}; }
}

function saveBillingForClient(clientId: string, billing: ClientBilling) {
  const saved = loadSavedBilling();
  saved[clientId] = billing;
  localStorage.setItem(BILLING_KEY, JSON.stringify(saved));
}

function getBilling(clientId: string, clientName: string): ClientBilling | null {
  const saved = loadSavedBilling();
  if (saved[clientId]) return saved[clientId];
  return CLIENT_BILLING[clientName] ?? null;
}

function getNextNumber(series: string): string {
  const counters: Record<string, number> = JSON.parse(
    localStorage.getItem("vyral-invoice-counters-v1") || "{}"
  );
  const next = (counters[series] ?? 0) + 1;
  return `${series}-${String(next).padStart(3, "0")}`;
}

function saveCounter(invoiceNumber: string) {
  const match = invoiceNumber.match(/^(.+)-(\d+)$/);
  if (!match) return;
  const [, series, numStr] = match;
  const num = parseInt(numStr, 10);
  const counters: Record<string, number> = JSON.parse(
    localStorage.getItem("vyral-invoice-counters-v1") || "{}"
  );
  counters[series] = Math.max(counters[series] ?? 0, num);
  localStorage.setItem("vyral-invoice-counters-v1", JSON.stringify(counters));
}

// ── Logo (matches app branding) ───────────────────────────────────────────────

function InvoiceLogo({ large = false }: { large?: boolean }) {
  const sz = large ? 32 : 24;
  const dot = large ? 10 : 8;
  return (
    <div className="flex items-baseline" style={{ gap: 0 }}>
      <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: sz, color: "#0a0a0a", lineHeight: 1 }}>
        Vyral
      </span>
      <span style={{ fontSize: sz, fontWeight: 900, marginLeft: 6, color: "#0a0a0a", lineHeight: 1 }}>
        labs
      </span>
      <span style={{
        width: dot, height: dot, background: "#2563eb", borderRadius: 2,
        marginLeft: 2, marginBottom: 2, display: "inline-block", flexShrink: 0,
      }} />
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Invoice preview ───────────────────────────────────────────────────────────

interface PreviewProps {
  fromCompany: string; fromAddress: string; fromVatId: string; fromIban: string; fromBic: string; fromIntBic: string;
  invoiceNumber: string; invoiceDate: string; dueDate: string;
  toCompany: string; toAddress: string; toVatId: string; toContact: string;
  lineItems: LineItem[]; showCreators: boolean; creatorLines: CreatorLine[];
  notes: string;
}

function InvoicePreview(p: PreviewProps) {
  const total = p.lineItems.reduce((s, i) => s + parseAmt(i.amount), 0);
  const visibleCreators = p.creatorLines.filter(c => c.name);

  return (
    <div className="invoice-print-area bg-white rounded-2xl shadow-xl p-12 font-sans" style={{ minHeight: 900 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-12">
        <InvoiceLogo large />
        <div className="text-right">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">INVOICE</h1>
          {p.invoiceNumber && (
            <p className="text-sm text-slate-500 mb-1">
              <span className="text-slate-400">No.</span>{" "}
              <span className="font-bold text-slate-900">{p.invoiceNumber}</span>
            </p>
          )}
          <p className="text-sm text-slate-500 mb-0.5">
            Date: <span className="font-semibold text-slate-800">{fmtDateLong(p.invoiceDate)}</span>
          </p>
          <p className="text-sm text-slate-500">
            Due: <span className="font-semibold text-slate-800">{fmtDateLong(p.dueDate)}</span>
          </p>
        </div>
      </div>

      {/* From / To */}
      <div className="grid grid-cols-2 gap-12 mb-12">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">From</p>
          <p className="font-bold text-slate-900 mb-1">{p.fromCompany || "—"}</p>
          {p.fromAddress.split("\n").map((l, i) => (
            <p key={i} className="text-sm text-slate-500">{l}</p>
          ))}
          {p.fromVatId && <p className="text-sm text-slate-500 mt-1">VAT: {p.fromVatId}</p>}
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</p>
          <p className="font-bold text-slate-900 mb-1">{p.toCompany || <span className="text-slate-300">Client name</span>}</p>
          {p.toAddress ? p.toAddress.split("\n").map((l, i) => (
            <p key={i} className="text-sm text-slate-500">{l}</p>
          )) : null}
          {p.toVatId && <p className="text-xs text-slate-400 mt-1">VAT: {p.toVatId}</p>}
          {p.toContact && <p className="text-xs text-slate-400">Att: {p.toContact}</p>}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-900 mb-0" />

      {/* Line items */}
      <table className="w-full mb-0">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left text-xs font-bold uppercase tracking-wider text-slate-600 py-3 pr-4">Description</th>
            <th className="text-right text-xs font-bold uppercase tracking-wider text-slate-600 py-3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {p.lineItems.map((item) => (
            <tr key={item.id} className="border-b border-slate-100">
              <td className="py-4 pr-4 text-sm text-slate-800 leading-snug">
                {item.description || <span className="text-slate-300 italic">Description</span>}
              </td>
              <td className="py-4 text-right text-sm font-semibold text-slate-900">
                {item.amount ? fmtEur(parseAmt(item.amount)) : <span className="text-slate-300">€0.00</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Creator breakdown */}
      {p.showCreators && visibleCreators.length > 0 && (
        <div className="mt-6 mb-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Creator Breakdown</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left text-xs text-slate-400 font-semibold pb-2 pr-4">Creator</th>
                <th className="text-left text-xs text-slate-400 font-semibold pb-2 pr-4">Platform</th>
                <th className="text-right text-xs text-slate-400 font-semibold pb-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {visibleCreators.map(c => (
                <tr key={c.id} className="border-b border-slate-100">
                  <td className="py-2.5 pr-4 text-sm text-slate-700">{c.name}</td>
                  <td className="py-2.5 pr-4 text-xs text-slate-400">{c.platform || "—"}</td>
                  <td className="py-2.5 text-right text-sm text-slate-700">
                    {c.amount ? fmtEur(parseAmt(c.amount)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Total */}
      <div className="flex justify-end mt-8 mb-10">
        <div className="bg-slate-900 text-white rounded-2xl px-8 py-5 text-right">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-1">Total Due</p>
          <p className="text-3xl font-black">{fmtEur(total)}</p>
        </div>
      </div>

      {/* Payment details */}
      <div className="border-t border-slate-200 pt-7">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Payment Details</p>
        <div className="space-y-1.5">
          <div className="flex gap-8 text-sm">
            <span className="text-slate-400 w-36 flex-shrink-0">Account Name</span>
            <span className="font-semibold text-slate-800">{p.fromCompany}</span>
          </div>
          <div className="flex gap-8 text-sm">
            <span className="text-slate-400 w-36 flex-shrink-0">IBAN</span>
            <span className="font-mono font-semibold text-slate-900 tracking-wide">{p.fromIban}</span>
          </div>
          <div className="flex gap-8 text-sm">
            <span className="text-slate-400 w-36 flex-shrink-0">BIC / SWIFT</span>
            <span className="font-mono text-slate-700">{p.fromBic}</span>
          </div>
          {p.fromIntBic && (
            <div className="flex gap-8 text-sm">
              <span className="text-slate-400 w-36 flex-shrink-0">Intermediary BIC</span>
              <span className="font-mono text-slate-700">{p.fromIntBic}</span>
            </div>
          )}
        </div>
        {p.notes && (
          <p className="text-xs text-slate-400 mt-5 leading-relaxed">{p.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface InvoiceCreatorProps {
  clients: Array<{ id: string; name: string }>;
}

export default function InvoiceCreator({ clients }: InvoiceCreatorProps) {
  // Fetch live campaigns from API and merge with invoice tracker clients
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string; clientName: string }>>([]);
  useEffect(() => {
    fetch("/api/campaigns")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCampaigns(data); })
      .catch(() => {});
  }, []);

  // Merged client list: campaigns take priority, invoice clients fill any gaps
  const mergedClients = (() => {
    const seen = new Set<string>();
    const out: Array<{ id: string; name: string }> = [];
    for (const c of campaigns) {
      seen.add(c.clientName.toLowerCase());
      out.push({ id: c.id, name: c.clientName });
    }
    for (const c of clients) {
      if (!seen.has(c.name.toLowerCase())) out.push(c);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  })();

  // From (Vyral)
  const [fromCompany, setFromCompany] = useState(VYRAL.company);
  const [fromAddress, setFromAddress] = useState(VYRAL.address);
  const [fromIban, setFromIban] = useState(VYRAL.iban);
  const [fromBic, setFromBic] = useState(VYRAL.bic);
  const [fromIntBic, setFromIntBic] = useState(VYRAL.intermediaryBic);
  const [fromVatId, setFromVatId] = useState("");
  const [showFromEditor, setShowFromEditor] = useState(false);

  // Invoice meta
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(() => inDaysStr(7));

  // To (Client)
  const [selectedClientId, setSelectedClientId] = useState("");
  const [toCompany, setToCompany] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [toVatId, setToVatId] = useState("");
  const [toContact, setToContact] = useState("");
  const [toSeries, setToSeries] = useState("");
  const [billingSaved, setBillingSaved] = useState(false);

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([blankItem()]);

  // Creator breakdown
  const [showCreators, setShowCreators] = useState(false);
  const [creatorLines, setCreatorLines] = useState<CreatorLine[]>([blankCreator()]);

  // Notes
  const [notes, setNotes] = useState("Payment due within 7 days of invoice date.\nPlease reference the invoice number when making payment.");

  function selectClient(clientId: string) {
    setSelectedClientId(clientId);
    setBillingSaved(false);
    if (!clientId) return;
    const client = mergedClients.find(c => c.id === clientId);
    if (!client) return;
    const billing = getBilling(clientId, client.name);
    if (billing) {
      setToCompany(billing.companyName);
      setToAddress(billing.address);
      setToVatId(billing.vatId);
      setToContact(billing.contactName);
      setToSeries(billing.series);
      try { setInvoiceNumber(getNextNumber(billing.series)); } catch { /* */ }
    } else {
      setToCompany(client.name);
      setToAddress("");
      setToVatId("");
      setToContact("");
      setToSeries("");
    }
  }

  function saveBilling() {
    if (!selectedClientId) return;
    saveBillingForClient(selectedClientId, {
      companyName: toCompany,
      address: toAddress,
      vatId: toVatId,
      contactName: toContact,
      series: toSeries,
    });
    if (toSeries) {
      try { setInvoiceNumber(getNextNumber(toSeries)); } catch { /* */ }
    }
    setBillingSaved(true);
    setTimeout(() => setBillingSaved(false), 2500);
  }

  function handleDateChange(val: string) {
    setInvoiceDate(val);
    if (val) {
      const d = new Date(val + "T12:00:00");
      d.setDate(d.getDate() + 7);
      setDueDate(d.toISOString().split("T")[0]);
    }
  }

  function handlePrint() {
    if (invoiceNumber) saveCounter(invoiceNumber);
    window.print();
  }

  function resetForm() {
    setSelectedClientId("");
    setInvoiceNumber("");
    setInvoiceDate(todayStr());
    setDueDate(inDaysStr(7));
    setToCompany(""); setToAddress(""); setToVatId(""); setToContact(""); setToSeries(""); setBillingSaved(false);
    setLineItems([blankItem()]);
    setShowCreators(false);
    setCreatorLines([blankCreator()]);
    setNotes("Payment due within 7 days of invoice date.\nPlease reference the invoice number when making payment.");
  }

  const total = lineItems.reduce((s, i) => s + parseAmt(i.amount), 0);

  return (
    <>
      {/* Print CSS — only invoice-print-area visible when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .invoice-print-area, .invoice-print-area * { visibility: visible !important; }
          .invoice-print-area {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            padding: 48px !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="flex gap-8 items-start">

        {/* ── LEFT: Form ────────────────────────────────────────────────── */}
        <div className="w-96 flex-shrink-0 space-y-5">

          {/* Client selector */}
          <div className="card p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Client</p>
            <select
              value={selectedClientId}
              onChange={e => selectClient(e.target.value)}
              className="input w-full mb-3"
            >
              <option value="">Select client…</option>
              {mergedClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Invoice #">
                <input className="input" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="e.g. SHAMELESS-002" />
              </Field>
              <div />
              <Field label="Invoice Date">
                <input type="date" className="input" value={invoiceDate} onChange={e => handleDateChange(e.target.value)} />
              </Field>
              <Field label="Due Date">
                <input type="date" className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </Field>
            </div>
          </div>

          {/* From details (collapsible) */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowFromEditor(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide text-left">From (Vyral)</p>
                <p className="text-sm font-semibold text-slate-800 text-left">{fromCompany}</p>
              </div>
              {showFromEditor ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showFromEditor && (
              <div className="px-5 pb-5 space-y-3 border-t border-slate-100">
                <Field label="Company name">
                  <input className="input" value={fromCompany} onChange={e => setFromCompany(e.target.value)} />
                </Field>
                <Field label="Address (one line per row)">
                  <textarea className="textarea" rows={3} value={fromAddress} onChange={e => setFromAddress(e.target.value)} />
                </Field>
                <Field label="VAT number (optional)">
                  <input className="input" value={fromVatId} onChange={e => setFromVatId(e.target.value)} placeholder="e.g. GB123456789" />
                </Field>
                <Field label="IBAN">
                  <input className="input font-mono" value={fromIban} onChange={e => setFromIban(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="BIC">
                    <input className="input font-mono" value={fromBic} onChange={e => setFromBic(e.target.value)} />
                  </Field>
                  <Field label="Intermediary BIC">
                    <input className="input font-mono" value={fromIntBic} onChange={e => setFromIntBic(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* To details */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bill To</p>
              {selectedClientId && (
                <button
                  onClick={saveBilling}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    billingSaved
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                  )}
                >
                  {billingSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  {billingSaved ? "Saved!" : "Save details"}
                </button>
              )}
            </div>
            <Field label="Company name">
              <input className="input" value={toCompany} onChange={e => setToCompany(e.target.value)} placeholder="Client Ltd" />
            </Field>
            <Field label="Address (one line per row)">
              <textarea className="textarea" rows={3} value={toAddress} onChange={e => setToAddress(e.target.value)} placeholder={"123 Street Name\nCity, Country"} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="VAT ID">
                <input className="input" value={toVatId} onChange={e => setToVatId(e.target.value)} placeholder="Optional" />
              </Field>
              <Field label="Att / Contact">
                <input className="input" value={toContact} onChange={e => setToContact(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
            <Field label="Invoice series prefix">
              <input className="input" value={toSeries} onChange={e => setToSeries(e.target.value.toUpperCase())} placeholder="e.g. ECOSIA" />
            </Field>
            {!selectedClientId && (
              <p className="text-xs text-slate-400">Select a client above to enable saving</p>
            )}
          </div>

          {/* Line items */}
          <div className="card p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Line Items</p>
            <div className="space-y-2 mb-3">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    className="input flex-1 text-sm"
                    placeholder={`Item ${idx + 1} description`}
                    value={item.description}
                    onChange={e => setLineItems(p => p.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                  />
                  <div className="relative flex-shrink-0 w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">€</span>
                    <input
                      className="input pl-6 text-sm w-full"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={e => setLineItems(p => p.map(i => i.id === item.id ? { ...i, amount: e.target.value } : i))}
                    />
                  </div>
                  {lineItems.length > 1 && (
                    <button onClick={() => setLineItems(p => p.filter(i => i.id !== item.id))}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setLineItems(p => [...p, blankItem()])}
              className="btn-ghost text-blue-600 hover:bg-blue-50 text-xs flex items-center gap-1 mb-3">
              <Plus className="w-3 h-3" /> Add line item
            </button>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Total</span>
              <span className="text-lg font-black text-slate-900">{fmtEur(total)}</span>
            </div>
          </div>

          {/* Creator breakdown */}
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowCreators(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <div className="text-left">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Creator Breakdown</p>
                <p className="text-xs text-slate-400 mt-0.5">Optional — attach individual creator costs</p>
              </div>
              {showCreators ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showCreators && (
              <div className="px-5 pb-5 border-t border-slate-100 space-y-2 pt-4">
                {creatorLines.map((line) => (
                  <div key={line.id} className="flex items-center gap-2">
                    <input
                      className="input flex-1 text-sm"
                      placeholder="Creator name"
                      value={line.name}
                      onChange={e => setCreatorLines(p => p.map(c => c.id === line.id ? { ...c, name: e.target.value } : c))}
                    />
                    <input
                      className="input w-24 text-sm"
                      placeholder="Platform"
                      value={line.platform}
                      onChange={e => setCreatorLines(p => p.map(c => c.id === line.id ? { ...c, platform: e.target.value } : c))}
                    />
                    <div className="relative flex-shrink-0 w-24">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">€</span>
                      <input
                        className="input pl-6 text-sm w-full"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={e => setCreatorLines(p => p.map(c => c.id === line.id ? { ...c, amount: e.target.value } : c))}
                      />
                    </div>
                    {creatorLines.length > 1 && (
                      <button onClick={() => setCreatorLines(p => p.filter(c => c.id !== line.id))}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={() => setCreatorLines(p => [...p, blankCreator()])}
                  className="btn-ghost text-blue-600 hover:bg-blue-50 text-xs flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add creator
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Notes / Footer</p>
            <textarea
              className="textarea text-sm"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Payment terms, additional notes…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={resetForm}
              className="btn-secondary flex items-center gap-2 flex-shrink-0">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button onClick={handlePrint}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center -mt-2">
            Opens browser print dialog → Save as PDF
          </p>
        </div>

        {/* ── RIGHT: Invoice preview ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Preview</p>
              <button onClick={handlePrint}
                className="btn-primary flex items-center gap-2 text-sm">
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
            </div>
            <InvoicePreview
              fromCompany={fromCompany}
              fromAddress={fromAddress}
              fromVatId={fromVatId}
              fromIban={fromIban}
              fromBic={fromBic}
              fromIntBic={fromIntBic}
              invoiceNumber={invoiceNumber}
              invoiceDate={invoiceDate}
              dueDate={dueDate}
              toCompany={toCompany}
              toAddress={toAddress}
              toVatId={toVatId}
              toContact={toContact}
              lineItems={lineItems}
              showCreators={showCreators}
              creatorLines={creatorLines}
              notes={notes}
            />
          </div>
        </div>
      </div>
    </>
  );
}
