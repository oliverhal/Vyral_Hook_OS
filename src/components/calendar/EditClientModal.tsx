"use client";

import { useState } from "react";
import { X, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarClient, COLOR_OPTIONS, COLOR_MAP, getContractStatus, STATUS_STYLES } from "./types";

interface EditClientModalProps {
  client: CalendarClient;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function formatDateInput(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

export default function EditClientModal({ client, onClose, onSaved, onDeleted }: EditClientModalProps) {
  const [form, setForm] = useState({
    name: client.name,
    contractStart: formatDateInput(client.contractStart),
    contractEnd: formatDateInput(client.contractEnd),
    firstPostDate: formatDateInput(client.firstPostDate),
    monthlyValue: client.monthlyValue?.toString() || "",
    notes: client.notes || "",
    contractLink: client.contractLink || "",
    color: client.color,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const status = getContractStatus(client);

  async function handleSave() {
    if (!form.name || !form.contractStart) {
      setError("Name and contract start date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
    } catch {
      setError("Failed to save changes.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/calendar/clients/${client.id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-[#0f1629] border border-white/10 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white">Edit Client</h2>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_STYLES[status].pill)}>
              {status.replace("_", " ")}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-slate-400 border border-white/10">
              {client.source === "imported" ? "Imported" : "Manual"}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Name</label>
            <input
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Contract Start</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={form.contractStart}
                onChange={(e) => setForm(f => ({ ...f, contractStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Contract End</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={form.contractEnd}
                onChange={(e) => setForm(f => ({ ...f, contractEnd: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">First Post Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={form.firstPostDate}
                onChange={(e) => setForm(f => ({ ...f, firstPostDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Monthly Value</label>
              <input
                type="number"
                placeholder="0"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={form.monthlyValue}
                onChange={(e) => setForm(f => ({ ...f, monthlyValue: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Contract Link</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                value={form.contractLink}
                onChange={(e) => setForm(f => ({ ...f, contractLink: e.target.value }))}
              />
              {form.contractLink && (
                <a href={form.contractLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn(
                    "w-7 h-7 rounded-full transition-all",
                    COLOR_MAP[c]?.dot || "bg-violet-500",
                    form.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0f1629] scale-110" : "opacity-60 hover:opacity-100"
                  )}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-400">Are you sure?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
