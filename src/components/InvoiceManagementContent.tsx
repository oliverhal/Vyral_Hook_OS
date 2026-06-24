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

// ── Seed data (exported 2026-06-24) ───────────────────────────────────────────

const SEED_CLIENTS: Client[] = [
  {
    id: "1770155749128",
    name: "Natively",
    firstPostDate: "2026-01-08",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 0,
    creatorStatuses: { "2026-01": "paid", "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" },
    milestones: [{
      id: "1770155749128-97vpk54yj", name: "M1", amount: 8500, startsMonth: 1, durationMonths: 0,
      statuses: { "2026-01": "paid", "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid", "2026-06": "paid" },
    }],
    contractStartDate: "2025-10-08", contractDuration: 0, notes: "",
  },
  {
    id: "1770227983088",
    name: "Artie (Art Master)",
    firstPostDate: "2026-02-04",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 3,
    creatorStatuses: {},
    milestones: [{
      id: "1770227983088-ht7wwcfcc", name: "M1", amount: 4750, startsMonth: 1, durationMonths: 1,
      statuses: { "2026-02": "paid" },
    }],
    contractDuration: 2, contractStartDate: "2026-02-04",
    contractEndDate: "2026-02-22", finalPaymentNote: "4750", notes: "",
  },
  {
    id: "1770228247273",
    name: "Garderobe",
    firstPostDate: "2026-01-15",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [
      {
        id: "1770228247273-sse5pfqf8", name: "M1", amount: 1683, startsMonth: 1, durationMonths: 2,
        statuses: { "2026-01": "paid", "2026-02": "paid", "2026-03": "sent" },
      },
      {
        id: "1774461410764-1bsugsl9i", name: "M2", amount: 800, startsMonth: 3, durationMonths: 1,
        statuses: { "2026-03": "paid" },
      },
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
    milestones: [{
      id: "1770228990944-v9et7ajz5", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 2,
      statuses: { "2026-03": "paid", "2026-04": "paid" },
    }],
    contractStartDate: "2026-02-03", notes: "",
  },
  {
    id: "1771509014396",
    name: "Artie (New Contract)",
    firstPostDate: "2026-02-23",
    creatorPaymentAmount: 10000,
    creatorDurationMonths: 12,
    creatorStatuses: { "2026-02": "paid", "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" },
    milestones: [{
      id: "1771509014397-ss3awx6er", name: "M1", amount: 17000, startsMonth: 2, durationMonths: 0,
      statuses: { "2026-03": "paid", "2026-04": "paid", "2026-05": "paid" },
    }],
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
    milestones: [{
      id: "1772708562316-tn30e3exf", name: "M1", amount: 7000, startsMonth: 3, durationMonths: 0,
      statuses: { "2026-04": "paid", "2026-05": "paid", "2026-06": "paid" },
    }],
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
    milestones: [{
      id: "1775126876996-1v3vyeebw", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 2,
      statuses: { "2026-05": "paid", "2026-06": "paid" },
    }],
    contractStartDate: "2026-04-13", contractDuration: 2, notes: "",
  },
  {
    id: "1775127640928",
    name: "Shameless Pets",
    firstPostDate: "2026-04-06",
    creatorPaymentAmount: 5000,
    creatorDurationMonths: 12,
    creatorStatuses: { "2026-04": "paid", "2026-05": "paid", "2026-06": "paid" },
    milestones: [{
      id: "1775127640928-ltiih0u86", name: "M1", amount: 8660, startsMonth: 2, durationMonths: 2,
      statuses: { "2026-05": "paid", "2026-06": "paid" },
    }],
    contractStartDate: "2026-04-01", contractDuration: 2, notes: "",
  },
  {
    id: "1778568821388",
    name: "TwoCents inc",
    firstPostDate: "2026-06-01",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [{
      id: "1778568821388-96qu7lr60", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 12,
      statuses: {},
    }],
    contractStartDate: "2026-05-12", contractDuration: 2, finalPaymentNote: "8500", notes: "",
  },
  {
    id: "1778569126031",
    name: "MeetCiao Contract Extension",
    firstPostDate: "2026-04-16",
    creatorPaymentAmount: 0,
    creatorDurationMonths: 12,
    creatorStatuses: {},
    milestones: [{
      id: "1778569126031-x8ik1lwe9", name: "M1", amount: 8500, startsMonth: 1, durationMonths: 12,
      statuses: { "2026-05": "paid", "2026-06": "sent" },
    }],
    contractStartDate: "2026-04-16", contractDuration: 3, notes: "",
  },
  {
    id: "1779193926479",
    name: "Ecosia",
    firstPostDate: "2026-06-01",
    creatorPaymentAmount: 7000,
    creatorDurationMonths: 2,
    creatorStatuses: {},
    milestones: [{
      id: "1779193926479-p9evlcolw", name: "M1", amount: 8500, startsMonth: 2, durationMonths: 2,
      statuses: {},
    }],
    contractStartDate: "2026-06-01", contractDuration: 12, notes: "",
  },
  {
    id: "1781148811559",
    name: "Jumpspeak",
    firstPostDate: "2026-07-01",
    creatorPaymentAmount: 7361,
    creatorDurationMonths: 2,
    creatorStatuses: {},
    milestones: [{
      id: "1781148811559-q3vaqcaeg", name: "M1", amount: 8660, startsMonth: 1, durationMonths: 2,
      statuses: {},
    }],
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

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonthLabel(monthKey: string): string {
  return new Date(monthKey + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function fmt(n: number): string {
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

    // Creator payments (monthly, EOM)
    if (client.creatorPaymentAmount > 0) {
      const maxMonths = client.creatorDurationMonths === 0 ? MAX_MONTHS : client.creatorDurationMonths;
      for (let i = 0; i < maxMonths; i++) {
        const dueDate = getEndOfMonth(addMonths(firstPost, i));
        if (contractEnd && dueDate > contractEnd) continue;
        const monthKey = getMonthKey(dueDate);
        const nextEOM = getEndOfMonth(addMonths(firstPost, i + 1));
        const isLastBeforeEnd = contractEnd && nextEOM > contractEnd;
        const amount = (isLastBeforeEnd && client.finalPaymentNote)
          ? parseFloat(client.finalPaymentNote) || client.creatorPaymentAmount
          : client.creatorPaymentAmount;
        invoices.push({
          id: `${client.id}-creator-${monthKey}`,
          clientId: client.id,
          clientName: client.name,
          type: "creator",
          milestoneName: "Creator Payment",
          dueDate,
          amount,
          status: client.creatorStatuses?.[monthKey] ?? "pending",
          monthKey,
        });
      }
    }

    // Milestone invoices (monthly)
    for (const milestone of client.milestones ?? []) {
      const startsAt = milestone.startsMonth ?? 1;
      const maxMonths = milestone.durationMonths === 0 ? MAX_MONTHS : milestone.durationMonths;
      for (let i = 0; i < maxMonths; i++) {
        const offset = startsAt - 1 + i;
        const dueDate = addMonths(firstPost, offset);
        if (contractEnd && dueDate > contractEnd) continue;
        const monthKey = getMonthKey(dueDate);
        invoices.push({
          id: `${client.id}-milestone-${milestone.id}-${monthKey}`,
          clientId: client.id,
          clientName: client.name,
          type: "milestone",
          milestoneName: milestone.name,
          milestoneId: milestone.id,
          dueDate,
          amount: milestone.amount,
          status: milestone.statuses?.[monthKey] ?? "pending",
          monthKey,
        });
      }
    }
  }

  return invoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    sent: "bg-blue-100 text-blue-800 border-blue-200",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", styles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

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
      "p-4 rounded-xl border bg-white",
      isOverdue ? "border-red-300 bg-red-50" : isUrgent ? "border-amber-300 bg-amber-50" : "border-slate-200"
    )}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-slate-900 text-sm">{invoice.clientName}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {invoice.type === "creator" ? "💰 Creator Payment" : `📄 ${invoice.milestoneName}`}
          </p>
        </div>
        <StatusBadge status={isOverdue ? "pending" : invoice.status} />
      </div>

      <p className="text-lg font-bold text-slate-900 mb-2">{fmt(invoice.amount)}</p>

      <p className="text-xs text-slate-500 mb-3">
        Due {formatDate(invoice.dueDate)}
        {invoice.status !== "paid" && (
          <span className={cn("ml-2 font-medium", isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-slate-400")}>
            {isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Today!" : `${days}d`}
          </span>
        )}
      </p>

      <div className="flex items-center gap-2">
        <select
          value={invoice.status}
          onChange={(e) => onStatusChange(invoice.id, e.target.value as Status)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 flex-1"
        >
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
        </select>
        <button
          onClick={() => onEditClient(invoice.clientId)}
          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Edit client"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Client Form ───────────────────────────────────────────────────────────────

const BLANK_CLIENT: Omit<Client, "id"> = {
  name: "", firstPostDate: "",
  creatorPaymentAmount: 0, creatorDurationMonths: 0, creatorStatuses: {},
  milestones: [{ id: "", name: "M1", amount: 0, startsMonth: 1, durationMonths: 0, statuses: {} }],
  contractStartDate: "", contractDuration: 0, contractEndDate: "",
  contractLink: "", contractNotes: "", finalPaymentNote: "", notes: "",
};

interface ClientFormProps {
  client: Client | null;
  onSave: (client: Client) => void;
  onCancel: () => void;
}

function ClientForm({ client, onSave, onCancel }: ClientFormProps) {
  const [form, setForm] = useState<Omit<Client, "id">>(
    client ? { ...client } : { ...BLANK_CLIENT, milestones: [{ id: "", name: "M1", amount: 0, startsMonth: 1, durationMonths: 0, statuses: {} }] }
  );

  function updateMilestone(idx: number, key: keyof Milestone, value: unknown) {
    const updated = form.milestones.map((m, i) => i === idx ? { ...m, [key]: value } : m);
    setForm(f => ({ ...f, milestones: updated }));
  }

  function addMilestone() {
    const n = form.milestones.length + 1;
    setForm(f => ({
      ...f,
      milestones: [...f.milestones, { id: "", name: `M${n}`, amount: 0, startsMonth: n, durationMonths: 0, statuses: {} }],
    }));
  }

  function removeMilestone(idx: number) {
    setForm(f => ({ ...f, milestones: f.milestones.filter((_, i) => i !== idx) }));
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

  const dur = [
    { v: 0, label: "Ongoing" }, { v: 1, label: "1 month" }, { v: 2, label: "2 months" },
    { v: 3, label: "3 months" }, { v: 6, label: "6 months" }, { v: 12, label: "12 months" },
    { v: 18, label: "18 months" }, { v: 24, label: "24 months" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Client Name *</label>
        <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Acme Corp" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">First Post Date *</label>
          <input required type="date" value={form.firstPostDate} onChange={e => setForm(f => ({ ...f, firstPostDate: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contract Start</label>
          <input type="date" value={form.contractStartDate ?? ""} onChange={e => setForm(f => ({ ...f, contractStartDate: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Early End Date <span className="text-red-400">(stops all invoices)</span></label>
          <input type="date" value={form.contractEndDate ?? ""} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value }))}
            className="w-full px-3 py-2 border border-red-200 bg-red-50 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contract Link</label>
          <input type="url" value={form.contractLink ?? ""} onChange={e => setForm(f => ({ ...f, contractLink: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="https://..." />
        </div>
      </div>

      {/* Creator payment */}
      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
        <label className="block text-xs font-semibold text-amber-800 mb-2">💰 Creator Payment (monthly, EOM)</label>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={form.creatorPaymentAmount || ""} onChange={e => setForm(f => ({ ...f, creatorPaymentAmount: Number(e.target.value) }))}
            className="px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" placeholder="Amount €" />
          <select value={form.creatorDurationMonths} onChange={e => setForm(f => ({ ...f, creatorDurationMonths: Number(e.target.value) }))}
            className="px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white">
            {dur.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
          </select>
        </div>
        {form.contractEndDate && (
          <div className="mt-2">
            <label className="block text-xs text-amber-700 mb-1">Final payment amount (if different)</label>
            <input type="number" value={form.finalPaymentNote ?? ""} onChange={e => setForm(f => ({ ...f, finalPaymentNote: e.target.value }))}
              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" placeholder="e.g. 4750" />
          </div>
        )}
      </div>

      {/* Milestones */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">📄 Client Invoice Milestones (monthly, recurring)</label>
        <div className="space-y-2 mb-2">
          {form.milestones.map((m, idx) => (
            <div key={idx} className="p-3 bg-blue-50 rounded-xl border border-blue-200 space-y-2">
              <div className="flex gap-2 items-center">
                <input type="text" value={m.name} onChange={e => updateMilestone(idx, "name", e.target.value)}
                  className="w-16 px-2 py-1.5 border border-blue-200 rounded-lg text-xs bg-white" />
                <input type="number" value={m.amount || ""} onChange={e => updateMilestone(idx, "amount", Number(e.target.value))}
                  className="flex-1 px-2 py-1.5 border border-blue-200 rounded-lg text-xs bg-white" placeholder="Amount €" />
                {form.milestones.length > 1 && (
                  <button type="button" onClick={() => removeMilestone(idx)} className="text-red-400 hover:text-red-600 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-slate-500 self-center">Starts:</span>
                <select value={m.startsMonth} onChange={e => updateMilestone(idx, "startsMonth", Number(e.target.value))}
                  className="px-2 py-1 border border-blue-200 rounded text-xs bg-white">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>Month {n}</option>)}
                </select>
                <span className="text-slate-500 self-center">Duration:</span>
                <select value={m.durationMonths} onChange={e => updateMilestone(idx, "durationMonths", Number(e.target.value))}
                  className="px-2 py-1 border border-blue-200 rounded text-xs bg-white">
                  {dur.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addMilestone} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
          <Plus className="w-3 h-3" /> Add milestone
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
          {client ? "Save Changes" : "Add Client"}
        </button>
      </div>
    </form>
  );
}

// ── Month Navigator ───────────────────────────────────────────────────────────

interface MonthNavProps {
  months: string[];
  selected: string;
  onChange: (m: string) => void;
}

function MonthNav({ months, selected, onChange }: MonthNavProps) {
  const idx = months.indexOf(selected);
  return (
    <div className="flex items-center gap-2">
      <button disabled={idx <= 0} onClick={() => onChange(months[idx - 1])}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select value={selected} onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white min-w-[160px] text-center">
        {months.map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
      </select>
      <button disabled={idx >= months.length - 1} onClick={() => onChange(months[idx + 1])}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function InvoiceManagementContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "clients">("overview");
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getMonthKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [notification, setNotification] = useState<{ msg: string; ok: boolean } | null>(null);

  // Load from localStorage, seed if empty
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setClients(saved ? JSON.parse(saved) : SEED_CLIENTS);
    } catch {
      setClients(SEED_CLIENTS);
    }
    setReady(true);
  }, []);

  // Persist
  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients, ready]);

  function notify(msg: string, ok = true) {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 3000);
  }

  // All generated invoices
  const allInvoices = useMemo(() => generateInvoices(clients), [clients]);

  // All months that have invoices
  const allMonths = useMemo(() => {
    const s = new Set(allInvoices.map(inv => inv.monthKey));
    return Array.from(s).sort();
  }, [allInvoices]);

  // Ensure selectedMonth is always in the list
  useEffect(() => {
    if (allMonths.length > 0 && !allMonths.includes(selectedMonth)) {
      const current = getMonthKey(new Date());
      setSelectedMonth(allMonths.includes(current) ? current : allMonths[0]);
    }
  }, [allMonths, selectedMonth]);

  // Invoices for the selected month
  const monthInvoices = useMemo(
    () => allInvoices.filter(inv => inv.monthKey === selectedMonth),
    [allInvoices, selectedMonth]
  );

  // Monthly stats
  const stats = useMemo(() => {
    const milestones = monthInvoices.filter(inv => inv.type === "milestone");
    const creators = monthInvoices.filter(inv => inv.type === "creator");
    const totalRevenue = milestones.reduce((s, i) => s + i.amount, 0);
    const paidRevenue = milestones.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const pendingRevenue = totalRevenue - paidRevenue;
    const totalCreator = creators.reduce((s, i) => s + i.amount, 0);
    const paidCreator = creators.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    const pendingCreator = totalCreator - paidCreator;
    return { totalRevenue, paidRevenue, pendingRevenue, totalCreator, paidCreator, pendingCreator, net: totalRevenue - totalCreator };
  }, [monthInvoices]);

  const overdueInvoices = useMemo(
    () => allInvoices.filter(inv => inv.status !== "paid" && getDaysUntil(inv.dueDate) < 0),
    [allInvoices]
  );

  // Status change handler
  function handleStatusChange(invoiceId: string, status: Status) {
    const parts = invoiceId.split("-");
    const clientId = parts[0];
    const type = parts[1];
    const monthKey = parts.slice(-2).join("-");

    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c;
      if (type === "creator") {
        return { ...c, creatorStatuses: { ...c.creatorStatuses, [monthKey]: status } };
      }
      // milestone: id is between type and monthKey
      const milestoneId = parts.slice(2, -2).join("-");
      return {
        ...c,
        milestones: c.milestones.map(m =>
          m.id === milestoneId ? { ...m, statuses: { ...m.statuses, [monthKey]: status } } : m
        ),
      };
    }));
  }

  function handleSaveClient(client: Client) {
    setClients(prev => {
      const exists = prev.find(c => c.id === client.id);
      return exists ? prev.map(c => c.id === client.id ? client : c) : [...prev, client];
    });
    notify(editingClient ? "Client updated" : "Client added");
    setShowForm(false);
    setEditingClient(null);
  }

  function handleDeleteClient(id: string) {
    if (!confirm("Delete this client and all their invoice history?")) return;
    setClients(prev => prev.filter(c => c.id !== id));
    notify("Client deleted");
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(clients, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vyral-invoices-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    notify("Exported");
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        setClients(parsed);
        notify("Imported successfully");
      } catch {
        notify("Import failed — invalid JSON", false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function openEdit(clientId: string) {
    const c = clients.find(x => x.id === clientId);
    if (c) { setEditingClient(c); setShowForm(true); }
  }

  if (!ready) return null;

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "clients" as const, label: `Clients (${clients.length})` },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Notification */}
      {notification && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium text-white",
          notification.ok ? "bg-emerald-600" : "bg-red-600"
        )}>
          {notification.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoice Management</h1>
          <p className="text-slate-500 text-sm mt-1">{clients.length} active clients · {allInvoices.length} invoices generated</p>
        </div>
        <div className="flex items-center gap-2">
          {overdueInvoices.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              {overdueInvoices.length} overdue
            </span>
          )}
          <label className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <Upload className="w-4 h-4" /> Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { setEditingClient(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between mb-6">
        <MonthNav months={allMonths} selected={selectedMonth} onChange={setSelectedMonth} />
        <p className="text-xs text-slate-400 font-mono">
          {monthInvoices.filter(i => i.status === "paid").length}/{monthInvoices.length} paid this month
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Client Revenue</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(stats.totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-600 font-medium">{fmt(stats.paidRevenue)} paid</span>
            {stats.pendingRevenue > 0 && ` · ${fmt(stats.pendingRevenue)} pending`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Creator Costs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(stats.totalCreator)}</p>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-emerald-600 font-medium">{fmt(stats.paidCreator)} paid</span>
            {stats.pendingCreator > 0 && ` · ${fmt(stats.pendingCreator)} pending`}
          </p>
        </div>
        <div className={cn("rounded-2xl border p-4", stats.net >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Net This Month</span>
          </div>
          <p className={cn("text-2xl font-bold", stats.net >= 0 ? "text-emerald-700" : "text-red-700")}>
            {stats.net >= 0 ? "+" : ""}{fmt(stats.net)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Revenue minus creator costs</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoices</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{monthInvoices.length}</span>
            <span className="text-sm text-slate-400">total</span>
          </div>
          <p className="text-xs mt-1">
            {monthInvoices.filter(i => i.status === "pending").length > 0 && (
              <span className="text-amber-600 font-medium">{monthInvoices.filter(i => i.status === "pending").length} pending</span>
            )}
            {monthInvoices.filter(i => i.status === "sent").length > 0 && (
              <span className="text-blue-600 font-medium ml-2">{monthInvoices.filter(i => i.status === "sent").length} sent</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-colors", activeTab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === "overview" && (
        <div>
          {monthInvoices.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No invoices in {formatMonthLabel(selectedMonth)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthInvoices.map(inv => (
                <InvoiceCard key={inv.id} invoice={inv} onStatusChange={handleStatusChange} onEditClient={openEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clients tab */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          {clients.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm">No clients yet</p>
            </div>
          ) : (
            clients.map(client => {
              const isEnded = client.contractEndDate ? new Date(client.contractEndDate) < new Date() : false;
              const clientInvoicesThisMonth = monthInvoices.filter(inv => inv.clientId === client.id);
              const totalThisMonth = clientInvoicesThisMonth.reduce((s, i) => s + i.amount, 0);

              return (
                <div key={client.id} className={cn("bg-white rounded-2xl border p-5", isEnded ? "border-slate-200 opacity-70" : "border-slate-200")}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{client.name}</h3>
                        {isEnded && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Ended {client.contractEndDate ? formatDate(new Date(client.contractEndDate)) : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        First post: {client.firstPostDate ? formatDate(new Date(client.firstPostDate)) : "—"}
                        {client.contractStartDate && ` · Contract: ${formatDate(new Date(client.contractStartDate))}`}
                        {client.contractDuration ? ` · ${client.contractDuration === 0 ? "Ongoing" : `${client.contractDuration}mo`}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalThisMonth > 0 && (
                        <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold border border-blue-100">
                          {fmt(totalThisMonth)} this month
                        </span>
                      )}
                      {client.contractLink && (
                        <a href={client.contractLink} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="View contract">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => openEdit(client.id)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteClient(client.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {client.creatorPaymentAmount > 0 && (
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                          <Repeat className="w-3 h-3" /> Creator Payment
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{fmt(client.creatorPaymentAmount)}/mo</p>
                        <p className="text-xs text-slate-400">{client.creatorDurationMonths === 0 ? "Ongoing" : `${client.creatorDurationMonths}mo`} · EOM</p>
                      </div>
                    )}
                    {client.milestones?.map((m, i) => (
                      <div key={i} className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                          <Repeat className="w-3 h-3" /> {m.name}
                        </p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{fmt(m.amount)}/mo</p>
                        <p className="text-xs text-slate-400">Starts mo.{m.startsMonth} · {m.durationMonths === 0 ? "Ongoing" : `${m.durationMonths}mo`}</p>
                      </div>
                    ))}
                  </div>

                  {client.notes && <p className="text-xs text-slate-400 mt-3">{client.notes}</p>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">{editingClient ? "Edit Client" : "Add Client"}</h2>
              <button onClick={() => { setShowForm(false); setEditingClient(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <ClientForm client={editingClient} onSave={handleSaveClient} onCancel={() => { setShowForm(false); setEditingClient(null); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
