"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Check, KeyRound, Loader2, Plus, Shield, Trash2, UserCheck, UserMinus, X, Camera
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserAvatar from "./UserAvatar";

const COLORS = [
  { id: "blue", label: "Blue", class: "bg-blue-500" },
  { id: "violet", label: "Violet", class: "bg-violet-500" },
  { id: "emerald", label: "Green", class: "bg-emerald-500" },
  { id: "orange", label: "Orange", class: "bg-orange-500" },
  { id: "pink", label: "Pink", class: "bg-pink-500" },
  { id: "teal", label: "Teal", class: "bg-teal-500" },
  { id: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { id: "slate", label: "Grey", class: "bg-slate-500" },
];

interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  avatarUrl: string | null;
  role: string;
  active: boolean;
}

type Modal =
  | { type: "add" }
  | { type: "reset"; user: User }
  | { type: "remove"; user: User }
  | null;

export default function TeamManager() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const sessionUser = session?.user as { role?: string } | undefined;
  const isAdmin = sessionUser?.role === "admin";

  useEffect(() => {
    if (status === "authenticated" && !isAdmin) {
      router.push("/");
    }
  }, [status, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  async function fetchUsers() {
    const data = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(data);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function toggleActive(user: User) {
    setSaving(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
    });
    await fetchUsers();
    showToast(`${user.name} ${user.active ? "deactivated" : "reactivated"}`);
    setSaving(false);
  }

  async function toggleRole(user: User) {
    const newRole = user.role === "admin" ? "member" : "admin";
    setSaving(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await fetchUsers();
    showToast(`${user.name} is now ${newRole}`);
    setSaving(false);
  }

  if (loading || !isAdmin) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-200 rounded-2xl" />)}
      </div>
    );
  }

  const active = users.filter((u) => u.active);
  const inactive = users.filter((u) => !u.active);

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-slide-up">
          <Check className="w-4 h-4 text-emerald-400" />
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Members</h1>
          <p className="text-slate-500 text-sm mt-1">
            {active.length} active member{active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "add" })}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add member
        </button>
      </div>

      {/* Active members */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Active — {active.length}
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {active.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onReset={() => setModal({ type: "reset", user })}
              onToggleActive={() => toggleActive(user)}
              onToggleRole={() => toggleRole(user)}
              onAvatarChange={(url) => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, avatarUrl: url } : u))}
              saving={saving}
            />
          ))}
        </div>
      </div>

      {/* Inactive members */}
      {inactive.length > 0 && (
        <div className="card overflow-hidden opacity-60">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Deactivated — {inactive.length}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {inactive.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onReset={() => setModal({ type: "reset", user })}
                onToggleActive={() => toggleActive(user)}
                onToggleRole={() => toggleRole(user)}
                onAvatarChange={(url) => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, avatarUrl: url } : u))}
                saving={saving}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "add" && (
        <AddMemberModal
          onClose={() => setModal(null)}
          onSuccess={async () => { await fetchUsers(); setModal(null); showToast("Team member added!"); }}
        />
      )}
      {modal?.type === "reset" && (
        <ResetPasswordModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); showToast(`Password reset for ${modal.user.name}`); }}
        />
      )}
    </div>
  );
}

function UserRow({
  user,
  onReset,
  onToggleActive,
  onToggleRole,
  onAvatarChange,
  saving,
}: {
  user: User;
  onReset: () => void;
  onToggleActive: () => void;
  onToggleRole: () => void;
  onAvatarChange: (avatarUrl: string | null) => void;
  saving: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/user/avatar?userId=${user.id}`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.avatarUrl) onAvatarChange(data.avatarUrl);
    setUploading(false);
  }

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      {/* Avatar with upload */}
      <div className="relative group flex-shrink-0">
        <UserAvatar name={user.name} color={user.color} avatarUrl={user.avatarUrl} size="md" className="ring-0" />
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title="Upload photo"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" />}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 text-sm">{user.name}</span>
          {user.role === "admin" && (
            <span className="badge bg-blue-100 text-blue-700 text-xs">
              <Shield className="w-2.5 h-2.5 inline mr-0.5" />
              Admin
            </span>
          )}
          {!user.active && (
            <span className="badge bg-red-100 text-red-600 text-xs">Deactivated</span>
          )}
        </div>
        <div className="text-slate-400 text-xs mt-0.5">{user.email}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onReset}
          disabled={saving}
          className="btn-ghost flex items-center gap-1.5 text-xs"
          title="Reset password"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Reset password
        </button>
        <button
          onClick={onToggleRole}
          disabled={saving}
          className="btn-ghost flex items-center gap-1.5 text-xs"
          title={user.role === "admin" ? "Remove admin" : "Make admin"}
        >
          {user.role === "admin" ? (
            <><UserMinus className="w-3.5 h-3.5" /> Remove admin</>
          ) : (
            <><Shield className="w-3.5 h-3.5" /> Make admin</>
          )}
        </button>
        <button
          onClick={onToggleActive}
          disabled={saving}
          className={cn(
            "btn-ghost flex items-center gap-1.5 text-xs",
            user.active ? "hover:text-red-600" : "hover:text-emerald-600"
          )}
          title={user.active ? "Deactivate" : "Reactivate"}
        >
          {user.active ? (
            <><Trash2 className="w-3.5 h-3.5" /> Deactivate</>
          ) : (
            <><UserCheck className="w-3.5 h-3.5" /> Reactivate</>
          )}
        </button>
      </div>
    </div>
  );
}

function AddMemberModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "vyral123",
    color: "blue",
    role: "member",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError("Name, email and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    onSuccess();
  }

  return (
    <ModalWrapper onClose={onClose} title="Add team member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">First name *</label>
            <input className="input" placeholder="Alex" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" placeholder="name@vyral-labs.com" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </div>

        <div>
          <label className="label">Temporary password *</label>
          <input className="input" placeholder="They can ask you to change it later" value={form.password} onChange={(e) => set("password", e.target.value)} required />
          <p className="text-xs text-slate-400 mt-1">Share this with them so they can log in. They should ask you to reset it once they're in.</p>
        </div>

        <div>
          <label className="label">Colour</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set("color", c.id)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  c.class,
                  form.color === c.id ? "border-slate-900 scale-110" : "border-transparent"
                )}
                title={c.label}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Adding..." : "Add member"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function ResetPasswordModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setError("Failed to reset password.");
      setLoading(false);
      return;
    }
    onSuccess();
  }

  return (
    <ModalWrapper onClose={onClose} title={`Reset password — ${user.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Set a new temporary password for <strong>{user.name}</strong>. Share it with them directly — they should ask you to reset it again once they log in.
        </p>
        <div>
          <label className="label">New password *</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. vyral2025!"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
          />
        </div>
        {error && (
          <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl border border-red-100">{error}</div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Saving..." : "Reset password"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

function ModalWrapper({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-base">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
