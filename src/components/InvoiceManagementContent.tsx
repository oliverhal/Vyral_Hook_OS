"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Edit2, Download, Upload, Check, X,
  AlertCircle, Clock, TrendingUp, Repeat, ExternalLink,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "pending" | "sent" | "paid";
type StatusMap = Record<string, Status>;

interface Milestone {
  id: string;
  name: string;
  amount: number;
  startsMonth: number;
  durationMonths: number;
  statuses: StatusMap;
}

interface Client {
  id: string;
  name: string;
  firstPostDate: string;
  creatorPaymentAmount: number;
  creatorDurationMonths: number;
  creatorStatuses: StatusMap;
  milestones: Milestone[];
  notes?: string;
  contractStartDate?: string;
  contractDuration?: number;
  contractEndDate?: string;
  contractLink?: string;
  contractNotes?: string;
  finalPaymentNote?: string;
}

interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  type: "creator" | "milestone";
  milestoneName: string;
  milestoneId?: string;
  dueDate: Date;
  amount: number;
  status: Status;
  monthKey: string;
}

// ── Seed data (exported 2026-06-24) ──────────────────────────────────────────

const SEED_CLIENTS: Client[] = [
  {
    id: "1770155749128",
    name: "Natively",
    firstPostDate: "2026-01-08",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 0,
    creatorStatuses: { "2026-01": "paid", "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" },
    milestones: [{ id: "1770155749128-97vpk54yj", name: "M1", amount: 8500, startsMonth: 1, durationMonths: 0, statuses: { "2026-01": "paid", "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid", "2026-06": "paid" } }],
    contractStartDate: "2025-10-08", contractDuration: 0, notes: "",
  },
  {
    id: "1770227983088",
    name: "Artie (Art Master)",
    firstPostDate: "2026-02-04",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 3,
    creatorStatuses: {},
    milestones: [{ id: "1770227983088-ht7wwcfcc", name: "M1", amount: 4750, startsMonth: 1, durationMonths: 1, statuses: { "2026-02": "paid" } }],
    contractDuration: 2, contractStartDate: "2026-02-04", contractEndDate: "2026-02-22", finalPaymentNote: "4750", notes: "",
  },
  {
    id: "1770228247273",
    name: "Garderobe",
    firstPostDate: "2026-01-15",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [
      { id: "1770228247273-sse5pfqf8", name: "M1", amount: 1683, startsMonth: 1, durationMonths: 2, statuses: { "2026-01": "paid", "2026-02": "paid", "2026-03": "sent" } },
      { id: "1774461410764-1bsugsl9i", name: "M2", amount: 800, startsMonth: 3, durationMonths: 1, statuses: { "2026-03": "paid" } },
    ],
    contractDuration: 3, contractStartDate: "2026-01-15", notes: "",
  },
  {
    id: "1770228990944",
    name: "MeetCiao",
    firstPostDate: "2026-02-16",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 0,
    creatorStatuses: { "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" },
    milestones: [{ id: "1770228990944-v9et7ajz5", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 2, statuses: { "2026-03": "paid", "2026-04": "paid" } }],
    contractStartDate: "2026-02-03", notes: "",
  },
  {
    id: "1771509014396",
    name: "Artie (New Contract)",
    firstPostDate: "2026-02-23",
    creatorPaymentAmount: 10000,
    creatorDurationMonths: 12,
    creatorStatuses: { "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" },
    milestones: [{ id: "1771509014397-ss3awx6er", name: "M1", amount: 17000, startsMonth: 2, durationMonths: 0, statuses: { "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" } }],
    contractStartDate: "2026-02-23", contractDuration: 0,
    contractLink: "https://docs.google.com/document/d/1HK63Oma_OJROALs4nh3zq84uzY6t0Tam/edit",
    finalPaymentNote: "", notes: "",
  },
  {
    id: "1772708562316",
    name: "Faircado UG",
    firstPostDate: "2026-03-17",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [{ id: "1772708562316-tn30e3exf", name: "M1", amount: 7000, startsMonth: 3, durationMonths: 0, statuses: { "2026-04": "paid", "2026-05": "paid", "2026-06": "paid" } }],
    contractStartDate: "2026-03-17", contractDuration: 0,
    contractLink: "https://docs.google.com/document/d/1JyBWnTKwdEb8jgd3A_mrCwwEfkqNG-qQwOll58ry80U/edit?tab=t.0",
    notes: "",
  },
  {
    id: "1775126876996",
    name: "Juno",
    firstPostDate: "2026-04-13",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 2,
    creatorStatuses: { "2026-04": "paid", "2026-05": "paid" },
    milestones: [{ id: "1775126876996-1v3vyeebw", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 2, statuses: { "2026-05": "paid", "2026-06": "paid" } }],
    contractStartDate: "2026-04-13", contractDuration: 2, notes: "",
  },
  {
    id: "1775127640928",
    name: "Shameless Pets",
    firstPostDate: "2026-04-06",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 12,
    creatorStatuses: { "2026-04": "paid", "2026-05": "paid", "2026-06": "paid" },
    milestones: [{ id: "1775127640928-ltiih0u86", name: "M1", amount: 8660, startsMonth: 2, durationMonths: 2, statuses: { "2026-05": "paid", "2026-06": "paid" } }],
    contractStartDate: "2026-04-01", contractDuration: 2, notes: "",
  },
  {
    id: "1778568821388",
    name: "TwoCents inc",
    firstPostDate: "2026-06-01",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [{ id: "1778568821388-96qu7lr60", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 12, statuses: {} }],
    contractStartDate: "2026-05-12", contractDuration: 2, finalPaymentNote: "8500", notes: "",
  },
  {
    id: "1778569126031",
    name: "MeetCiao Contract Extension",
    firstPostDate: "2026-04-16",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [{ id: "1778569126031-x8ik1lwe9", name: "M1", amount: 8500, startsMonth: 1, durationMonths: 12, statuses: { "2026-05": "paid", "2026-06": "sent" } }],
    contractStartDate: "2026-04-16", contractDuration: 3, notes: "",
  },
  {
    id: "1779193926479",
    name: "Ecosia",
    firstPostDate: "2026-06-01",
    creatorPaymentAmount: 7000,
    creatorDurationMonths: 2,
    creatorStatuses: {},
    milestones: [{ id: "1779193926479-p9evlcolw", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 2, statuses: {} }],
    contractStartDate: "2026-06-01", contractDuration: 12, notes: "",
  },
  {
    id: "1781148811559",
    name: "Jumpspeak",
    firstPostDate: "2026-07-01",
    creatorPaymentAmount: 7361,
    creatorDurationMonths: 2,
    creatorStatuses: {},
    milestones: [{ id: "1781148811559-q3vaqcaeg", name: "M1", amount: 8660, startsMonth: 1, durationMonths: 2, statuses: {} }],
    contractStartDate: "2026-06-11", contractDuration: 2, notes: "",
  },
];

const STORAGE_KEY = "vyral-invoices-v3";

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getEndOfMonth(date: Date): Date {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMonthLong(key: string): string {
  return new Date(key + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString("en-GB")}`;
}

// ── Invoice generation ────────────────────────────────────────────────────────

function generateInvoices(clients: Client[]): Invoice[] {
  const invoices: Invoice[] = [];
  const MAX_MONTHS = 24;

  for (const client of clients) {
    if (!client.firstPostDate) continue;
    const firstPost = new Date(client.firstPostDate);
    const contractEnd = client.contractEndDate ? new Date(client.contractEndDate) : null;

    if (client.creatorPaymentAmount > 0) {
      const maxMonths = client.creatorDurationMonths === 0 ? MAX_MONTHS : client.creatorDurationMonths;
      for (let i = 0; i < maxMonths; i++) {
        const dueDate = getEndOfMonth(addMonths(firstPost, i));
        if (contractEnd && dueDate > contractEnd) continue;
        const monthKey = getMonthKey(dueDate);
        const isLastBeforeEnd = contractEnd && getEndOfMonth(addMonths(firstPost, i + 1)) > contractEnd;
        const amount = (isLastBeforeEnd && client.finalPaymentNote)
          ? parseFloat(client.finalPaymentNote) || client.creatorPaymentAmount
          : client.creatorPaymentAmount;
        invoices.push({ id: `${client.id}-creator-${monthKey}`, clientId: client.id, clientName: client.name, type: "creator", milestoneName: "Creator Payment", dueDate, amount, status: client.creatorStatuses?.[monthKey] ?? "pending", monthKey });
      }
    }

    for (const m of client.milestones ?? []) {
      const maxMonths = m.durationMonths === 0 ? MAX_MONTHS : m.durationMonths;
      for (let i = 0; i < maxMonths; i++) {
        const dueDate = addMonths(firstPost, (m.startsMonth ?? 1) - 1 + i);
        if (contractEnd && dueDate > contractEnd) continue;
        const monthKey = getMonthKey(dueDate);
        invoices.push({ id: `${client.id}-milestone-${m.id}-${monthKey}`, clientId: client.id, clientName: client.name, type: "milestone", milestoneName: m.name, milestoneId: m.id, dueDate, amount: m.amount, status: m.statuses?.[monthKey] ?? "pending", monthKey });
      }
    }
  }

  return invoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    sent: "bg-blue-50 text-blue-700 border-blue-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={cn("badge border", styles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Invoice card ──────────────────────────────────────────────────────────────

interface InvoiceCardProps {
  invoice: Invoice;
  onStatusChange: (id: string, status: Status) => void;
  onEditClient: (clientId: string) => void;
}

function InvoiceCard({ invoice, onStatusChange, onEditClient }: InvoiceCardProps) {
  const days = getDaysUntil(invoice.dueDate);
  const isOverdue = days < 0 && invoice.status !== "paid";
  const isUrgent = days >= 0 && days <= 7 && invoice.status !== "paid";

  return (
    <div className={cn(
      "card p-4 flex flex-col gap-3",
      isOverdue && "border-red-300 bg-red-50",
      isUrgent && !isOverdue && "border-amber-300 bg-amber-50"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{invoice.clientName}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {invoice.type === "creator" ? "💰 Creator Payment" : `📄 ${invoice.milestoneName}`}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div>
        <p className="text-xl font-bold text-slate-900">{fmtEur(invoice.amount)}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Due {fmtDate(invoice.dueDate)}
          {invoice.status !== "paid" && days !== undefined && (
            <span className={cn("ml-2 font-medium",
              isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-slate-400"
            )}>
              · {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `${days}d`}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={invoice.status}
          onChange={e => onStatusChange(invoice.id, e.target.value as Status)}
          className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium"
        >
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
        </select>
        <button onClick={() => onEditClient(invoice.clientId)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit client">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Duration options ──────────────────────────────────────────────────────────

const DURATIONS = [
  { v: 0, label: "Ongoing" }, { v: 1, label: "1 month" }, { v: 2, label: "2 months" },
  { v: 3, label: "3 months" }, { v: 6, label: "6 months" }, { v: 12, label: "12 months" },
  { v: 18, label: "18 months" }, { v: 24, label: "24 months" },
];

// ── Client form ───────────────────────────────────────────────────────────────

interface ClientFormProps {
  client: Client | null;
  onSave: (client: Client) => void;
  onCancel: () => void;
}

function ClientForm({ client, onSave, onCancel }: ClientFormProps) {
  const blank = { name: "", firstPostDate: "", creatorPaymentAmount: 0, creatorDurationMonths: 0, creatorStatuses: {} as StatusMap, milestones: [{ id: "", name: "M1", amount: 0, startsMonth: 1, durationMonths: 0, statuses: {} as StatusMap }], contractStartDate: "", contractDuration: 0, contractEndDate: "", contractLink: "", contractNotes: "", finalPaymentNote: "", notes: "" };
  const [form, setForm] = useState<Omit<Client, "id">>(client ? { ...client } : blank);

  function updateMilestone(idx: number, key: keyof Milestone, value: unknown) {
    setForm(f => ({ ...f, milestones: f.milestones.map((m, i) => i === idx ? { ...m, [key]: value } : m) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...form,
      id: client?.id ?? `${Date.now()}`,
      creatorPaymentAmount: Number(form.creatorPaymentAmount) || 0,
      milestones: form.milestones.map(m => ({
        ...m,
        id: m.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        amount: Number(m.amount) || 0,
        statuses: m.statuses ?? {},
      })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Client Name *</label>
        <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="Acme Corp" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">First Post Date *</label>
          <input required type="date" value={form.firstPostDate} onChange={e => setForm(f => ({ ...f, firstPostDate: e.target.value }))} className="input" />
        </div>
        <div>
          <label className="label">Contract Start</label>
          <input type="date" value={form.contractStartDate ?? ""} onChange={e => setForm(f => ({ ...f, contractStartDate: e.target.value }))} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Early End Date <span className="text-red-400 normal-case font-normal">(stops all invoices)</span></label>
          <input type="date" value={form.contractEndDate ?? ""} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value }))} className="input border-red-200 bg-red-50/50" />
        </div>
        <div>
          <label className="label">Contract Link</label>
          <input type="url" value={form.contractLink ?? ""} onChange={e => setForm(f => ({ ...f, contractLink: e.target.value }))} className="input" placeholder="https://..." />
        </div>
      </div>

      {/* Creator payment */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-800 mb-3 uppercase tracking-wide">💰 Creator Payment — monthly, end of month</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={form.creatorPaymentAmount || ""} onChange={e => setForm(f => ({ ...f, creatorPaymentAmount: Number(e.target.value) }))} className="input" placeholder="Amount €" />
          <select value={form.creatorDurationMonths} onChange={e => setForm(f => ({ ...f, creatorDurationMonths: Number(e.target.value) }))} className="input">
            {DURATIONS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
        </div>
        {form.contractEndDate && (
          <div className="mt-3">
            <label className="label">Final payment amount (if different)</label>
            <input type="number" value={form.finalPaymentNote ?? ""} onChange={e => setForm(f => ({ ...f, finalPaymentNote: e.target.value }))} className="input" placeholder="e.g. 4750" />
          </div>
        )}
      </div>

      {/* Milestones */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">📄 Client Invoice Milestones — monthly, recurring</p>
        <div className="space-y-2 mb-2">
          {form.milestones.map((m, idx) => (
            <div key={idx} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input type="text" value={m.name} onChange={e => updateMilestone(idx, "name", e.target.value)} className="input w-16 py-1.5 text-xs" />
                <input type="number" value={m.amount || ""} onChange={e => updateMilestone(idx, "amount", Number(e.target.value))} className="input flex-1 py-1.5 text-xs" placeholder="Amount €" />
                {form.milestones.length > 1 && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, milestones: f.milestones.filter((_, i) => i !== idx) }))} className="text-red-400 hover:text-red-600 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Starts:</span>
                <select value={m.startsMonth} onChange={e => updateMilestone(idx, "startsMonth", Number(e.target.value))} className="input py-1 text-xs w-24">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>Month {n}</option>)}
                </select>
                <span>Duration:</span>
                <select value={m.durationMonths} onChange={e => updateMilestone(idx, "durationMonths", Number(e.target.value))} className="input py-1 text-xs w-28">
                  {DURATIONS.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button type="button"
          onClick={() => setForm(f => ({ ...f, milestones: [...f.milestones, { id: "", name: `M${f.milestones.length + 1}`, amount: 0, startsMonth: f.milestones.length + 1, durationMonths: 0, statuses: {} }] }))}
          className="btn-ghost text-blue-600 hover:bg-blue-50 text-xs flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add milestone
        </button>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="textarea" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" className="btn-primary">{client ? "Save Changes" : "Add Client"}</button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvoiceManagementContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"overview" | "clients">("overview");
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setClients(saved ? JSON.parse(saved) : SEED_CLIENTS);
    } catch {
      setClients(SEED_CLIENTS);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients, ready]);

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const allInvoices = useMemo(() => generateInvoices(clients), [clients]);

  const allMonths = useMemo(() => {
    const s = new Set(allInvoices.map(inv => inv.monthKey));
    return Array.from(s).sort();
  }, [allInvoices]);

  useEffect(() => {
    if (allMonths.length && !allMonths.includes(selectedMonth)) {
      const cur = getMonthKey(new Date());
      setSelectedMonth(allMonths.includes(cur) ? cur : allMonths[0]);
    }
  }, [allMonths, selectedMonth]);

  const monthInvoices = useMemo(
    () => allInvoices.filter(inv => inv.monthKey === selectedMonth),
    [allInvoices, selectedMonth]
  );

  const stats = useMemo(() => {
    const ms = monthInvoices.filter(i => i.type === "milestone");
    const cr = monthInvoices.filter(i => i.type === "creator");
    const totalRev = ms.reduce((s, i) => s + i.amount, 0);
    const paidRev = ms.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const totalCr = cr.reduce((s, i) => s + i.amount, 0);
    const paidCr = cr.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    return { totalRev, paidRev, pendingRev: totalRev - paidRev, totalCr, paidCr, pendingCr: totalCr - paidCr, totalBilled: totalRev + totalCr };
  }, [monthInvoices]);

  const overdueCount = useMemo(
    () => allInvoices.filter(i => i.status !== "paid" && getDaysUntil(i.dueDate) < 0).length,
    [allInvoices]
  );

  function handleStatusChange(invoiceId: string, status: Status) {
    const parts = invoiceId.split("-");
    const clientId = parts[0];
    const type = parts[1];
    const monthKey = parts.slice(-2).join("-");
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      if (type === "creator") return { ...c, creatorStatuses: { ...c.creatorStatuses, [monthKey]: status } };
      const milestoneId = parts.slice(2, -2).join("-");
      return { ...c, milestones: c.milestones.map(m => m.id === milestoneId ? { ...m, statuses: { ...m.statuses, [monthKey]: status } } : m) };
    }));
  }

  function handleSaveClient(client: Client) {
    setClients(prev => prev.find(c => c.id === client.id) ? prev.map(c => c.id === client.id ? client : c) : [...prev, client]);
    notify(editingClient ? "Client updated" : "Client added");
    setShowForm(false);
    setEditingClient(null);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this client and all their invoice data?")) return;
    setClients(prev => prev.filter(c => c.id !== id));
    notify("Client deleted");
  }

  function openEdit(clientId: string) {
    const c = clients.find(x => x.id === clientId);
    if (c) { setEditingClient(c); setShowForm(true); }
  }

  function handleExport() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(clients, null, 2)], { type: "application/json" }));
    a.download = `vyral-invoices-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    notify("Exported");
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { setClients(JSON.parse(ev.target?.result as string)); notify("Imported"); }
      catch { notify("Invalid JSON", false); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const monthIdx = allMonths.indexOf(selectedMonth);

  if (!ready) return (
    <div className="p-8 animate-pulse space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white",
          toast.ok ? "bg-emerald-600" : "bg-red-600"
        )}>
          {toast.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">
            {clients.length} clients · {allInvoices.length} invoices tracked
            {overdueCount > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 text-red-600 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" />{overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="btn-secondary flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { setEditingClient(null); setShowForm(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button disabled={monthIdx <= 0} onClick={() => setSelectedMonth(allMonths[monthIdx - 1])}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="input py-1.5 text-sm font-semibold min-w-[180px] text-center">
            {allMonths.map(m => <option key={m} value={m}>{fmtMonthLong(m)}</option>)}
          </select>
          <button disabled={monthIdx >= allMonths.length - 1} onClick={() => setSelectedMonth(allMonths[monthIdx + 1])}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 font-mono">
          {monthInvoices.filter(i => i.status === "paid").length} / {monthInvoices.length} paid
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client Revenue</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtEur(stats.totalRev)}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-600 font-semibold">{fmtEur(stats.paidRev)}</span> paid
            {stats.pendingRev > 0 && <span className="text-amber-600 font-semibold ml-1">· {fmtEur(stats.pendingRev)} pending</span>}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
              <Repeat className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Creator Costs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmtEur(stats.totalCr)}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-600 font-semibold">{fmtEur(stats.paidCr)}</span> paid
            {stats.pendingCr > 0 && <span className="text-amber-600 font-semibold ml-1">· {fmtEur(stats.pendingCr)} pending</span>}
          </p>
        </div>

        <div className="card p-5 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Billed</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{fmtEur(stats.totalBilled)}</p>
          <p className="text-xs text-slate-400 mt-1">Revenue + creator pass-through</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">This Month</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{monthInvoices.length}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {monthInvoices.filter(i => i.status === "pending").length > 0 && (
              <span className="badge bg-amber-50 text-amber-700 border border-amber-200">{monthInvoices.filter(i => i.status === "pending").length} pending</span>
            )}
            {monthInvoices.filter(i => i.status === "sent").length > 0 && (
              <span className="badge bg-blue-50 text-blue-700 border border-blue-200">{monthInvoices.filter(i => i.status === "sent").length} sent</span>
            )}
            {monthInvoices.filter(i => i.status === "paid").length > 0 && (
              <span className="badge bg-emerald-50 text-emerald-700 border border-emerald-200">{monthInvoices.filter(i => i.status === "paid").length} paid</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {(["overview", "clients"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}>
            {t === "overview" ? "Overview" : `Clients (${clients.length})`}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        monthInvoices.length === 0 ? (
          <div className="card p-12 text-center">
            <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 text-sm">No invoices in {fmtMonthLong(selectedMonth)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthInvoices.map(inv => (
              <InvoiceCard key={inv.id} invoice={inv} onStatusChange={handleStatusChange} onEditClient={openEdit} />
            ))}
          </div>
        )
      )}

      {/* Clients tab */}
      {tab === "clients" && (
        <div className="space-y-3">
          {clients.map(client => {
            const isEnded = client.contractEndDate ? new Date(client.contractEndDate) < new Date() : false;
            const thisMonth = monthInvoices.filter(i => i.clientId === client.id);
            const monthTotal = thisMonth.reduce((s, i) => s + i.amount, 0);
            return (
              <div key={client.id} className={cn("card p-5", isEnded && "opacity-60")}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{client.name}</h3>
                      {isEnded && <span className="badge bg-slate-100 text-slate-500 border border-slate-200">Ended {client.contractEndDate ? fmtDate(new Date(client.contractEndDate)) : ""}</span>}
                      {monthTotal > 0 && <span className="badge bg-blue-50 text-blue-700 border border-blue-200 font-semibold">{fmtEur(monthTotal)} this month</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      First post: {client.firstPostDate ? fmtDate(new Date(client.firstPostDate)) : "—"}
                      {client.contractStartDate && ` · Contract from ${fmtDate(new Date(client.contractStartDate))}`}
                      {client.contractDuration !== undefined && ` · ${client.contractDuration === 0 ? "Ongoing" : `${client.contractDuration}mo`}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {client.contractLink && (
                      <a href={client.contractLink} target="_blank" rel="noopener noreferrer"
                        className="btn-ghost p-1.5 text-slate-400 hover:text-purple-600" title="View contract">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => openEdit(client.id)} className="btn-ghost p-1.5 text-slate-400 hover:text-blue-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(client.id)} className="btn-ghost p-1.5 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {client.creatorPaymentAmount > 0 && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 flex items-center gap-1 mb-1">
                        <Repeat className="w-3 h-3" /> Creator
                      </p>
                      <p className="text-sm font-bold text-slate-900">{fmtEur(client.creatorPaymentAmount)}<span className="font-normal text-slate-400">/mo</span></p>
                      <p className="text-xs text-slate-400">{client.creatorDurationMonths === 0 ? "Ongoing" : `${client.creatorDurationMonths}mo`} · EOM</p>
                    </div>
                  )}
                  {client.milestones?.map((m, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1 mb-1">
                        <Repeat className="w-3 h-3" /> {m.name}
                      </p>
                      <p className="text-sm font-bold text-slate-900">{fmtEur(m.amount)}<span className="font-normal text-slate-400">/mo</span></p>
                      <p className="text-xs text-slate-400">Mo.{m.startsMonth} · {m.durationMonths === 0 ? "Ongoing" : `${m.durationMonths}mo`}</p>
                    </div>
                  ))}
                </div>

                {client.notes && <p className="text-xs text-slate-400 mt-3">{client.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editingClient ? "Edit Client" : "Add Client"}</h2>
              <button onClick={() => { setShowForm(false); setEditingClient(null); }} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <ClientForm client={editingClient} onSave={handleSaveClient} onCancel={() => { setShowForm(false); setEditingClient(null); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
