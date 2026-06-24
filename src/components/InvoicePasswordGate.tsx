"use client";

import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

const SESSION_KEY = "vyral-invoices-unlocked";
const PASSWORD = "Vyr4l123!";

export default function InvoicePasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
    setReady(true);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
      setValue("");
      setTimeout(() => setError(false), 2000);
    }
  }

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="flex-1 min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <h1 className="text-lg font-bold text-slate-900 text-center mb-1">Invoice Management</h1>
        <p className="text-sm text-slate-400 text-center mb-6">Enter the password to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              autoFocus
              type={show ? "text" : "password"}
              value={value}
              onChange={e => { setValue(e.target.value); setError(false); }}
              placeholder="Password"
              className={`input pr-10 ${error ? "border-red-400 bg-red-50 focus:ring-red-400" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 font-medium text-center">Incorrect password</p>}
          <button type="submit" className="btn-primary w-full justify-center">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
