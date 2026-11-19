"use client";

import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { TrendingUp, Users, DollarSign, BarChart3, RefreshCw, AlertCircle, ArrowUpRight, ArrowDownRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "3m" | "12m";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7D",
  "30d": "30D",
  "3m": "3M",
  "12m": "12M",
};

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

interface CountryEntry {
  country: string;
  revenue: number;
}

interface ProjectData {
  project: { id: string; name: string };
  overview: { metrics?: RCMetric[]; items?: RCMetric[] } | null;
  revenue: unknown;
  revenue7d: number;
  revenue30d: number;
  revenueAllTime: number;
  newSubs7d: number;
  newSubs30d: number;
  countryBreakdown: CountryEntry[];
}

interface MetricsResponse {
  configured: boolean;
  projects?: ProjectData[];
  error?: string;
  period?: Period;
}

function findMetric(metrics: RCMetric[], id: string): RCMetric | undefined {
  return metrics.find((m) => m.id === id);
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

const CURRENCY_UNITS = new Set([
  "USD", "EUR", "GBP", "AUD", "CAD", "JPY", "CHF",
  "SEK", "NOK", "DKK", "NZD", "SGD", "HKD", "MXN",
  "BRL", "INR", "KRW",
]);

function isCurrencyUnit(unit: string | undefined): boolean {
  if (!unit) return false;
  if (unit === "$" || unit === "€" || unit === "£") return true;
  return CURRENCY_UNITS.has(unit.toUpperCase());
}

const SYMBOL_TO_ISO: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };

function formatCurrency(value: unknown, unit = "USD") {
  try {
    const n = safeNum(value);
    const resolved = SYMBOL_TO_ISO[unit] ?? unit;
    const currency = CURRENCY_UNITS.has(resolved.toUpperCase()) ? resolved.toUpperCase() : "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${safeNum(value).toFixed(0)}`;
  }
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("en-US").format(Math.round(safeNum(value)));
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", AU: "Australia", CA: "Canada",
  DE: "Germany", FR: "France", JP: "Japan", NL: "Netherlands", SE: "Sweden",
  NO: "Norway", DK: "Denmark", FI: "Finland", CH: "Switzerland", NZ: "New Zealand",
  SG: "Singapore", HK: "Hong Kong", MX: "Mexico", BR: "Brazil", IN: "India",
  KR: "South Korea", ES: "Spain", IT: "Italy", PT: "Portugal", PL: "Poland",
  AT: "Austria", BE: "Belgium", IE: "Ireland", ZA: "South Africa", AE: "UAE",
};

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", AU: "🇦🇺", CA: "🇨🇦", DE: "🇩🇪", FR: "🇫🇷",
  JP: "🇯🇵", NL: "🇳🇱", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰", FI: "🇫🇮",
  CH: "🇨🇭", NZ: "🇳🇿", SG: "🇸🇬", HK: "🇭🇰", MX: "🇲🇽", BR: "🇧🇷",
  IN: "🇮🇳", KR: "🇰🇷", ES: "🇪🇸", IT: "🇮🇹", PT: "🇵🇹", PL: "🇵🇱",
  AT: "🇦🇹", BE: "🇧🇪", IE: "🇮🇪", ZA: "🇿🇦", AE: "🇦🇪",
};

function extractRevenuePoints(revenue: unknown): RevenuePoint[] {
  try {
    if (!revenue || typeof revenue !== "object") return [];
    const r = revenue as Record<string, unknown>;

    if (Array.isArray(r.values) && r.values.length > 0) {
      const first = r.values[0] as Record<string, unknown>;

      if (first.cohort !== undefined && first.measure !== undefined) {
        return r.values
          .filter((i: Record<string, unknown>) => safeNum(i.measure) === 0 && !i.incomplete)
          .map((i: Record<string, unknown>) => ({
            date: new Date(safeNum(i.cohort) * 1000).toISOString().split("T")[0],
            value: safeNum(i.value),
          }));
      }

      if (first.date !== undefined || first.period !== undefined) {
        return r.values.map((i: Record<string, unknown>) => ({
          date: String(i.date ?? i.period ?? ""),
          value: safeNum(i.value ?? i.revenue ?? 0),
        }));
      }
    }

    if (Array.isArray(r.items) && r.items.length > 0) {
      return r.items.map((i: Record<string, unknown>) => ({
        date: String(i.date ?? i.period ?? ""),
        value: safeNum(i.value ?? i.revenue ?? 0),
      }));
    }

    if (Array.isArray(r.summaries)) {
      return r.summaries.map((s: Record<string, unknown>) => ({
        date: String(s.date ?? s.period ?? ""),
        value: safeNum(s.value ?? s.revenue ?? 0),
      }));
    }

    return [];
  } catch {
    return [];
  }
}

function extractMetrics(overview: ProjectData["overview"]): RCMetric[] {
  if (!overview) return [];
  const arr = overview.metrics ?? overview.items ?? [];
  return Array.isArray(arr) ? arr : [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, colorClass, hexColor, change, loading,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  colorClass: string; hexColor: string; change?: number; loading?: boolean;
}) {
  const isPos = safeNum(change ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", colorClass)}>
          <Icon className="w-4 h-4" />
        </div>
        {change !== undefined && (
          <span className={cn("flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full",
            isPos ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
            {isPos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(safeNum(change)).toFixed(1)}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 w-28 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
      ) : (
        <div>
          <div className="text-2xl font-bold text-slate-900 leading-none">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
      )}
      <div className="text-xs font-medium text-slate-500 mt-auto">{label}</div>
    </div>
  );
}

function RevenueChart({ points, unit = "USD", period }: { points: RevenuePoint[]; unit?: string; period: Period }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No chart data available for this period
      </div>
    );
  }

  const w = 600, h = 200, padL = 64, padR = 20, padT = 16, padB = 40;
  const values = points.map((p) => p.value);
  const rawMax = Math.max(...values, 1);

  function niceMax(v: number): number {
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const normed = v / exp;
    const nice = normed <= 1 ? 1 : normed <= 2 ? 2 : normed <= 5 ? 5 : 10;
    return nice * exp * 1.05;
  }
  const max = niceMax(rawMax);

  function niceStep(maxVal: number, ticks: number): number {
    const rough = maxVal / ticks;
    const exp = Math.pow(10, Math.floor(Math.log10(rough)));
    const normed = rough / exp;
    return (normed <= 1 ? 1 : normed <= 2 ? 2 : normed <= 5 ? 5 : 10) * exp;
  }
  const yStep = niceStep(max, 4);
  const yTickValues: number[] = [];
  for (let v = 0; v <= max * 1.01; v += yStep) yTickValues.push(v);

  const xs = points.map((_, i) => padL + (i / (points.length - 1)) * (w - padL - padR));
  const ys = points.map((p) => padT + (1 - p.value / max) * (h - padT - padB));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${h - padB} L${xs[0].toFixed(1)},${h - padB} Z`;

  const minLabelGap = 52;
  const targetLabels = Math.min(7, Math.floor((w - padL - padR) / minLabelGap));
  const xStep = Math.max(1, Math.floor(points.length / targetLabels));
  const labeledSet = new Set<number>();
  for (let i = 0; i < points.length; i += xStep) labeledSet.add(i);
  const lastI = points.length - 1;
  const prevLabelI = Math.floor(lastI / xStep) * xStep;
  if (xs[lastI] - xs[prevLabelI] > minLabelGap) labeledSet.add(lastI);

  function xLabel(date: string): string {
    if (period === "7d" || period === "30d" || period === "3m") {
      try { return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
      catch { return date.slice(5, 10); }
    }
    try {
      const d = new Date(date + (date.length === 7 ? "-01" : ""));
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    } catch { return date.slice(0, 7); }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (w / rect.width);
    let closest = 0, minDist = Infinity;
    xs.forEach((x, i) => { const d = Math.abs(x - mx); if (d < minDist) { minDist = d; closest = i; } });
    setHoverIdx(closest);
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;
  const tooltipX = hoverIdx !== null ? xs[hoverIdx] : 0;
  const tooltipY = hoverIdx !== null ? ys[hoverIdx] : 0;
  const tipOnLeft = tooltipX > w * 0.6;
  const tooltipW = 120, tooltipH = 48;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full cursor-crosshair select-none"
      style={{ height: h }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
      <defs>
        <linearGradient id="revenue-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTickValues.map((val, i) => {
        const y = padT + (1 - val / max) * (h - padT - padB);
        const label = isCurrencyUnit(unit)
          ? (val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${val.toFixed(0)}`)
          : (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0));
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{label}</text>
          </g>
        );
      })}
      {points.map((p, i) => !labeledSet.has(i) ? null : (
        <text key={i} x={xs[i]} y={h - padB + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
          {xLabel(p.date)}
        </text>
      ))}
      <path d={area} fill="url(#revenue-grad)" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {hoverIdx !== null ? (
        <>
          <line x1={tooltipX} y1={padT} x2={tooltipX} y2={h - padB}
            stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.45" />
          <circle cx={tooltipX} cy={tooltipY} r="5.5" fill="white" stroke="#3b82f6" strokeWidth="2" />
          <circle cx={tooltipX} cy={tooltipY} r="3" fill="#3b82f6" />
          <g transform={`translate(${tipOnLeft ? tooltipX - tooltipW - 10 : tooltipX + 10},${Math.max(padT, Math.min(tooltipY - tooltipH / 2, h - padB - tooltipH))})`}>
            <rect rx="7" ry="7" width={tooltipW} height={tooltipH} fill="#1e293b" />
            <text x="10" y="17" fontSize="10" fill="#94a3b8">{xLabel(hovered?.date ?? "")}</text>
            <text x="10" y="35" fontSize="14" fontWeight="bold" fill="white">
              {isCurrencyUnit(unit) ? formatCurrency(hovered?.value ?? 0, unit) : formatNumber(hovered?.value ?? 0)}
            </text>
          </g>
        </>
      ) : (
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill="#3b82f6" />
      )}
    </svg>
  );
}

function CountryBreakdown({ entries, unit }: { entries: CountryEntry[]; unit: string }) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-6">
        Country data not available for this project
      </div>
    );
  }

  const total = entries.reduce((s, e) => s + e.revenue, 0);
  const maxRev = entries[0]?.revenue ?? 1;

  return (
    <div className="space-y-3">
      {entries.map((e) => {
        const code = e.country.toUpperCase();
        const flag = COUNTRY_FLAGS[code] ?? "🌐";
        const name = COUNTRY_NAMES[code] ?? e.country;
        const pct = total > 0 ? (e.revenue / total) * 100 : 0;
        const barPct = maxRev > 0 ? (e.revenue / maxRev) * 100 : 0;
        return (
          <div key={e.country} className="flex items-center gap-3">
            <span className="text-base w-6 flex-shrink-0">{flag}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-700 truncate">{name}</span>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-xs text-slate-400">{pct.toFixed(1)}%</span>
                  <span className="text-xs font-semibold text-slate-800 w-16 text-right">
                    {isCurrencyUnit(unit) ? formatCurrency(e.revenue, unit) : formatNumber(e.revenue)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppStudioContent() {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("30d");
  const selectedProjectRef = useRef<string | null>(null);

  const fetchMetrics = async (silent = false, p: Period = period) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/app-studio/metrics?period=${p}`);
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

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    fetchMetrics(false, p);
  }

  const currentProject = data?.projects?.find((p) => p.project.id === selectedProject) ?? data?.projects?.[0];
  const metrics = extractMetrics(currentProject?.overview ?? null);
  const revenuePoints = extractRevenuePoints(currentProject?.revenue);
  const revenueUnit = findMetric(metrics, "mrr")?.unit ?? findMetric(metrics, "revenue")?.unit ?? "USD";

  const activeSubs = findMetric(metrics, "active_subscriptions");
  const mrr        = findMetric(metrics, "mrr");
  const churn      = findMetric(metrics, "churned_paying_customers") ?? findMetric(metrics, "churn_rate");
  const trials     = findMetric(metrics, "active_trials") ?? findMetric(metrics, "trials");
  const arpu       = mrr && activeSubs && activeSubs.value > 0
    ? mrr.value / activeSubs.value
    : undefined;

  const cardLoading = loading || !currentProject?.overview;

  // ── Not configured ──
  if (!loading && !data?.configured) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">App Studio Performance</h1>
        <p className="text-slate-500 text-sm mb-8">Live revenue & subscriber data from RevenueCat</p>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">RevenueCat API key not configured</p>
            <p className="text-sm text-amber-700 mt-1">Add your RevenueCat V2 secret key to Vercel environment variables, then redeploy.</p>
            <div className="mt-4 bg-amber-100 rounded-lg px-4 py-3 font-mono text-xs text-amber-900">REVENUECAT_SECRET_KEY=sk_your_key_here</div>
            <p className="text-xs text-amber-600 mt-3">Find your secret key in RevenueCat → <span className="font-medium">Project Settings → API Keys</span></p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (!loading && data?.error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-8">App Studio Performance</h1>
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

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">App Studio Performance</h1>
          <p className="text-slate-500 text-sm mt-1">
            Live data from RevenueCat
            {lastUpdated && <span className="ml-2 text-slate-400">· Updated {format(lastUpdated, "h:mm:ss a")}</span>}
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

      {/* Project switcher */}
      {(data?.projects?.length ?? 0) > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {data!.projects!.map((p) => (
            <button
              key={p.project.id}
              onClick={() => { selectedProjectRef.current = p.project.id; setSelectedProject(p.project.id); }}
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

      {/* ── Revenue totals row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <StatCard
          label="Revenue last 30 days"
          value={cardLoading ? "—" : formatCurrency(currentProject?.revenue30d ?? 0, revenueUnit)}
          icon={TrendingUp} colorClass="bg-violet-100 text-violet-600" hexColor="#8b5cf6"
          loading={cardLoading}
        />
        <StatCard
          label="Revenue last 7 days"
          value={cardLoading ? "—" : formatCurrency(currentProject?.revenue7d ?? 0, revenueUnit)}
          icon={BarChart3} colorClass="bg-amber-100 text-amber-600" hexColor="#f59e0b"
          loading={cardLoading}
        />
      </div>

      {/* ── Subscriber stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active subscribers"
          value={cardLoading ? "—" : activeSubs ? formatNumber(activeSubs.value) : "—"}
          icon={Users} colorClass="bg-emerald-100 text-emerald-600" hexColor="#10b981"
          change={activeSubs?.change_percentage} loading={cardLoading}
        />
        <StatCard
          label="New subscribers (30d)"
          value={cardLoading ? "—" : formatNumber(currentProject?.newSubs30d ?? 0)}
          icon={Users} colorClass="bg-cyan-100 text-cyan-600" hexColor="#06b6d4"
          loading={cardLoading}
        />
        <StatCard
          label="New subscribers (7d)"
          value={cardLoading ? "—" : formatNumber(currentProject?.newSubs7d ?? 0)}
          icon={Users} colorClass="bg-sky-100 text-sky-600" hexColor="#0ea5e9"
          loading={cardLoading}
        />
        <StatCard
          label="MRR"
          value={cardLoading ? "—" : mrr ? formatCurrency(mrr.value, mrr.unit) : "—"}
          sub={arpu !== undefined ? `ARPU ${formatCurrency(arpu, revenueUnit)}` : undefined}
          icon={DollarSign} colorClass="bg-rose-100 text-rose-600" hexColor="#f43f5e"
          change={mrr?.change_percentage} loading={cardLoading}
        />
      </div>

      {/* ── Revenue chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-900">Revenue over time</h2>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                disabled={loading}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold transition-all",
                  period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="animate-pulse"><div className="h-44 bg-slate-50 rounded-xl" /></div>
        ) : (
          <RevenueChart points={revenuePoints} unit={revenueUnit} period={period} />
        )}
      </div>

      {/* ── Country breakdown + extra metrics ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Country breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Revenue by country</h2>
            <span className="text-xs text-slate-400 ml-auto">last 30 days</span>
          </div>
          {cardLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-6 h-5 bg-slate-100 rounded" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-1.5 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <CountryBreakdown entries={currentProject?.countryBreakdown ?? []} unit={revenueUnit} />
          )}
        </div>

        {/* Extra metrics */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-5">Key metrics</h2>
          {cardLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded-xl" />)}
            </div>
          ) : metrics.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {metrics.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <span className="text-sm text-slate-600">{m.name}</span>
                  <div className="flex items-center gap-3">
                    {m.change_percentage !== undefined && (
                      <span className={cn("text-xs font-medium", safeNum(m.change_percentage) >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {safeNum(m.change_percentage) >= 0 ? "+" : ""}{safeNum(m.change_percentage).toFixed(1)}%
                      </span>
                    )}
                    <span className="text-sm font-semibold text-slate-900 w-20 text-right">
                      {isCurrencyUnit(m.unit)
                        ? formatCurrency(m.value, m.unit)
                        : m.id.includes("rate") || m.id.includes("percentage")
                        ? `${(safeNum(m.value) * 100).toFixed(2)}%`
                        : formatNumber(m.value)}
                    </span>
                  </div>
                </div>
              ))}
              {/* Churn & trials if available */}
              {churn && (
                <div className="flex items-center justify-between py-3 last:pb-0">
                  <span className="text-sm text-slate-600">{churn.id === "churn_rate" ? "Churn rate" : "Churned (30d)"}</span>
                  <span className="text-sm font-semibold text-red-600">
                    {churn.id === "churn_rate" ? `${(safeNum(churn.value) * 100).toFixed(2)}%` : formatNumber(churn.value)}
                  </span>
                </div>
              )}
              {trials && (
                <div className="flex items-center justify-between py-3 last:pb-0">
                  <span className="text-sm text-slate-600">Active trials</span>
                  <span className="text-sm font-semibold text-slate-900">{formatNumber(trials.value)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">No metrics available</p>
          )}
        </div>
      </div>

      {!loading && metrics.length === 0 && !data?.error && data?.configured && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No metrics returned from RevenueCat yet.</p>
          <p className="text-slate-400 text-xs mt-1">Check that your secret key has access to the project.</p>
        </div>
      )}
    </div>
  );
}
