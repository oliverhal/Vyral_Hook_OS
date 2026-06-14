"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { TrendingUp, Users, DollarSign, BarChart3, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RCMetric {
  id: string;
  name: string;
  value: number;
  unit?: string;
  period?: string;
  change_percentage?: number;
}

interface RevenuePoint {
  date: string;
  value: number;
}

interface ProjectData {
  project: { id: string; name: string };
  overview: { metrics?: RCMetric[]; items?: RCMetric[] } | null;
  revenue: unknown;
}

interface MetricsResponse {
  configured: boolean;
  projects?: ProjectData[];
  error?: string;
}

function findMetric(metrics: RCMetric[], id: string): RCMetric | undefined {
  return metrics.find((m) => m.id === id);
}

function formatCurrency(value: number, unit = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: unit,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function Sparkline({ points, color = "#3b82f6" }: { points: number[]; color?: string }) {
  if (points.length < 2) return null;
  const w = 120;
  const h = 36;
  const pad = 2;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map((v) => h - pad - ((v - min) / range) * (h - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`;
  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  subLabel,
  icon: Icon,
  colorClass,
  hexColor,
  change,
  sparkPoints,
  loading,
}: {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ElementType;
  colorClass: string;
  hexColor: string;
  change?: number;
  sparkPoints?: number[];
  loading?: boolean;
}) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <span className={cn("flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full", isPositive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 w-28 bg-slate-100 rounded" />
          <div className="h-4 w-20 bg-slate-100 rounded" />
        </div>
      ) : (
        <div>
          <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
          {subLabel && <div className="text-xs text-slate-500 mt-1">{subLabel}</div>}
        </div>
      )}

      {sparkPoints && sparkPoints.length > 1 && (
        <div className="mt-auto">
          <Sparkline points={sparkPoints} color={hexColor} />
        </div>
      )}

      <div className="text-xs font-medium text-slate-500 -mt-1">{label}</div>
    </div>
  );
}

function RevenueChart({ points }: { points: RevenuePoint[] }) {
  if (points.length < 2) return null;
  const w = 600;
  const h = 160;
  const padL = 56;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const xs = points.map((_, i) => padL + (i / (points.length - 1)) * (w - padL - padR));
  const ys = points.map((p) => padT + (1 - p.value / max) * (h - padT - padB));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h - padB} L${xs[0].toFixed(1)},${h - padB} Z`;
  const yTicks = 4;
  const xStep = Math.max(1, Math.floor(points.length / 6));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = padT + (i / yTicks) * (h - padT - padB);
        const val = max * (1 - i / yTicks);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {points.map((p, i) => {
        if (i % xStep !== 0 && i !== points.length - 1) return null;
        return (
          <text key={i} x={xs[i]} y={h - padB + 14} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {String(p.date).slice(0, 7)}
          </text>
        );
      })}
      <path d={area} fill="url(#revenue-grad)" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill="#3b82f6" />
    </svg>
  );
}

function extractMetrics(overview: ProjectData["overview"]): RCMetric[] {
  if (!overview) return [];
  const arr = overview.metrics ?? overview.items ?? [];
  return Array.isArray(arr) ? arr : [];
}

function extractRevenuePoints(revenue: unknown): RevenuePoint[] {
  try {
    if (!revenue || typeof revenue !== "object") return [];
    const rev = revenue as Record<string, unknown>;
    const summaries = (rev.summaries ?? (rev.values as Record<string, unknown> | undefined)?.summaries) as { date: string; value: number }[] | undefined;
    if (!Array.isArray(summaries)) return [];
    return summaries.map((s) => ({ date: String(s.date ?? ""), value: Number(s.value ?? 0) }));
  } catch {
    return [];
  }
}

export default function AppStudioContent() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const selectedProjectRef = useRef<string | null>(null);

  const fetchMetrics = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/app-studio/metrics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: MetricsResponse = await res.json();
      setData(json);
      setLastUpdated(new Date());
      if (json.projects?.length && !selectedProjectRef.current) {
        const id = json.projects[0].project.id;
        selectedProjectRef.current = id;
        setSelectedProject(id);
      }
    } catch {
      // retain previous data on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(true), 60_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProject = data?.projects?.find((p) => p.project.id === selectedProject) ?? data?.projects?.[0];
  const metrics = extractMetrics(currentProject?.overview ?? null);
  const revenuePoints = extractRevenuePoints(currentProject?.revenue);

  const mrr = findMetric(metrics, "mrr");
  const arr = findMetric(metrics, "arr");
  const activeSubs = findMetric(metrics, "active_subscriptions");
  const revenue = findMetric(metrics, "revenue") ?? findMetric(metrics, "monthly_revenue");
  const newCustomers = findMetric(metrics, "new_paying_customers") ?? findMetric(metrics, "new_customers");
  const churn = findMetric(metrics, "churned_paying_customers") ?? findMetric(metrics, "churn_rate");

  if (!loading && !data?.configured) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">App Studio Performance</h1>
          <p className="text-slate-500 text-sm mt-1">Live revenue & subscriber data from RevenueCat</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">RevenueCat API key not configured</p>
            <p className="text-sm text-amber-700 mt-1">
              Add your RevenueCat V2 secret key to Vercel environment variables, then redeploy.
            </p>
            <div className="mt-4 bg-amber-100 rounded-lg px-4 py-3 font-mono text-xs text-amber-900">
              REVENUECAT_SECRET_KEY=sk_your_key_here
            </div>
            <p className="text-xs text-amber-600 mt-3">
              Find your secret key in RevenueCat → <span className="font-medium">Project Settings → API Keys</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && data?.error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">App Studio Performance</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Failed to load RevenueCat data</p>
            <p className="text-sm text-red-700 mt-1 font-mono">{data.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const cardLoading = loading || !currentProject?.overview;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">App Studio Performance</h1>
          <p className="text-slate-500 text-sm mt-1">
            Live data from RevenueCat
            {lastUpdated && (
              <span className="ml-2 text-slate-400">
                · Updated {format(lastUpdated, "h:mm:ss a")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchMetrics(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      {(data?.projects?.length ?? 0) > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {data!.projects!.map((p) => (
            <button
              key={p.project.id}
              onClick={() => {
                selectedProjectRef.current = p.project.id;
                setSelectedProject(p.project.id);
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                selectedProject === p.project.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              )}
            >
              {p.project.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Monthly Recurring Revenue"
          value={cardLoading ? "—" : mrr ? formatCurrency(mrr.value, mrr.unit) : "—"}
          subLabel="MRR"
          icon={DollarSign}
          colorClass="bg-blue-100 text-blue-600"
          hexColor="#3b82f6"
          change={mrr?.change_percentage}
          loading={cardLoading}
        />
        <MetricCard
          label="Active Subscriptions"
          value={cardLoading ? "—" : activeSubs ? formatNumber(activeSubs.value) : "—"}
          subLabel="subscribers"
          icon={Users}
          colorClass="bg-emerald-100 text-emerald-600"
          hexColor="#10b981"
          change={activeSubs?.change_percentage}
          loading={cardLoading}
        />
        <MetricCard
          label="Annual Recurring Revenue"
          value={cardLoading ? "—" : arr ? formatCurrency(arr.value, arr.unit) : "—"}
          subLabel="ARR"
          icon={TrendingUp}
          colorClass="bg-violet-100 text-violet-600"
          hexColor="#8b5cf6"
          change={arr?.change_percentage}
          loading={cardLoading}
        />
        <MetricCard
          label="Revenue (period)"
          value={cardLoading ? "—" : revenue ? formatCurrency(revenue.value, revenue.unit) : "—"}
          subLabel={revenue?.period ?? "current period"}
          icon={BarChart3}
          colorClass="bg-amber-100 text-amber-600"
          hexColor="#f59e0b"
          change={revenue?.change_percentage}
          loading={cardLoading}
        />
      </div>

      {(newCustomers || churn) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          {newCustomers && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 font-medium mb-1">New paying customers (30d)</div>
              <div className="text-3xl font-bold text-slate-900">{formatNumber(newCustomers.value)}</div>
            </div>
          )}
          {churn && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="text-xs text-slate-500 font-medium mb-1">
                {churn.id === "churn_rate" ? "Churn rate" : "Churned customers (30d)"}
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {churn.id === "churn_rate" ? `${(churn.value * 100).toFixed(2)}%` : formatNumber(churn.value)}
              </div>
            </div>
          )}
        </div>
      )}

      {revenuePoints.length > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Monthly Revenue (12 months)</h2>
          <RevenueChart points={revenuePoints} />
        </div>
      )}

      {metrics.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">All Metrics</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {metrics.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-6 py-3">
                <span className="text-sm text-slate-600">{m.name}</span>
                <div className="flex items-center gap-3">
                  {m.change_percentage !== undefined && (
                    <span className={cn("text-xs font-medium", m.change_percentage >= 0 ? "text-emerald-600" : "text-red-500")}>
                      {m.change_percentage >= 0 ? "+" : ""}{m.change_percentage.toFixed(1)}%
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-900">
                    {m.unit
                      ? formatCurrency(m.value, m.unit)
                      : m.id.includes("rate") || m.id.includes("percentage")
                      ? `${(m.value * 100).toFixed(2)}%`
                      : formatNumber(m.value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && metrics.length === 0 && !data?.error && data?.configured && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No metrics returned from RevenueCat yet.</p>
          <p className="text-slate-400 text-xs mt-1">Check that your secret key has access to the project.</p>
        </div>
      )}

      {loading && metrics.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center animate-pulse">
          <div className="w-10 h-10 bg-slate-100 rounded-full mx-auto mb-3" />
          <div className="h-4 w-40 bg-slate-100 rounded mx-auto" />
        </div>
      )}
    </div>
  );
}
