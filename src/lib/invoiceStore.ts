import { INVOICE_STORE_KEYS } from "./invoiceAccess";

// Write-through cloud store for the invoice tool. Components keep the same
// synchronous get/set they had with localStorage; localStorage is now a cache
// of the cloud copy and every set is pushed to /api/invoice-data.
//
// Modes:
//   cloud       – the DB has invoice data; it is the source of truth.
//   local-only  – the DB is empty; this browser still holds the old local data
//                 and can upload it once (uploadLocalToCloud). Nothing is sent
//                 to the cloud until then, so a fresh browser can't seed it.
//   forbidden   – signed-in user isn't on the invoice access list.
//   offline     – couldn't reach the API; changes stay local for now.

export type StoreMode = "uninitialized" | "cloud" | "local-only" | "forbidden" | "offline";

export interface StoreStatus {
  mode: StoreMode;
  saveError: string | null;
}

const KEYS: readonly string[] = INVOICE_STORE_KEYS;
const DEBOUNCE_MS = 300;

let status: StoreStatus = { mode: "uninitialized", saveError: null };
let initPromise: Promise<StoreMode> | null = null;
const listeners = new Set<() => void>();
const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function setStatus(patch: Partial<StoreStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function getStoreStatus(): StoreStatus {
  return status;
}

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function storeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

async function push(key: string, value: string, keepalive = false) {
  try {
    const res = await fetch("/api/invoice-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
      keepalive,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (status.saveError) setStatus({ saveError: null });
  } catch (e) {
    setStatus({ saveError: e instanceof Error ? e.message : "Save failed" });
  }
}

export function storeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* quota / private mode */ }
  if (status.mode !== "cloud") return;
  pending.set(key, value);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => {
    const v = pending.get(key);
    pending.delete(key);
    timers.delete(key);
    if (v !== undefined) void push(key, v);
  }, DEBOUNCE_MS));
}

function flushPending() {
  pending.forEach((value, key) => {
    const t = timers.get(key);
    if (t) clearTimeout(t);
    timers.delete(key);
    void push(key, value, true);
  });
  pending.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPending);
}

// Pulls the cloud copy into the local cache. Safe to call repeatedly.
export function initInvoiceStore(): Promise<StoreMode> {
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<StoreMode> => {
    try {
      const res = await fetch("/api/invoice-data", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setStatus({ mode: "forbidden" });
        return "forbidden";
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = (await res.json()) as { data: Record<string, string> };
      if (Object.keys(data).length === 0) {
        setStatus({ mode: "local-only" });
        return "local-only";
      }
      for (const key of KEYS) {
        try {
          if (key in data) localStorage.setItem(key, data[key]);
          else localStorage.removeItem(key); // cloud is the truth; drop stale local copy
        } catch { /* ignore */ }
      }
      setStatus({ mode: "cloud", saveError: null });
      return "cloud";
    } catch {
      initPromise = null; // allow a retry
      setStatus({ mode: "offline" });
      return "offline";
    }
  })();
  return initPromise;
}

export function hasLocalInvoiceData(): boolean {
  return KEYS.some((k) => storeGet(k) !== null);
}

// One-time migration of this browser's local data into the cloud. The server
// refuses if the cloud already holds data.
export async function uploadLocalToCloud(): Promise<{ ok: boolean; error?: string }> {
  const data: Record<string, string> = {};
  for (const key of KEYS) {
    const v = storeGet(key);
    if (v !== null) data[key] = v;
  }
  try {
    const res = await fetch("/api/invoice-data/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (res.status === 409) {
      initPromise = null;
      await initInvoiceStore(); // someone else already uploaded — adopt theirs
      return { ok: false, error: "The cloud already has invoice data, so it was loaded instead." };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setStatus({ mode: "cloud", saveError: null });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Upload failed" };
  }
}
