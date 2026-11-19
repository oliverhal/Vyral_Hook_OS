import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const RC_BASE = "https://api.revenuecat.com";

async function rcFetch(path: string) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw new Error("REVENUECAT_SECRET_KEY not configured");
  const res = await fetch(`${RC_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RevenueCat API error ${res.status}: ${text}`);
  }
  return res.json();
}

type Period = "7d" | "30d" | "3m" | "12m";

function getDateRange(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case "7d":  start.setDate(start.getDate() - 7); break;
    case "30d": start.setDate(start.getDate() - 30); break;
    case "3m":  start.setMonth(start.getMonth() - 3); start.setDate(1); break;
    case "12m": start.setMonth(start.getMonth() - 12); start.setDate(1); break;
  }
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

const RESOLUTION_BY_PERIOD: Record<Period, string[]> = {
  "7d":  ["P1D", "day", "daily"],
  "30d": ["P1D", "day", "daily"],
  "3m":  ["P7D", "week", "weekly"],
  "12m": ["P1M", "month", "monthly"],
};

// RC ignores start_time/end_time for some chart endpoints — filter locally by date
function filterValuesByDate(data: unknown, startDate: string, endDate: string): unknown {
  if (!data || typeof data !== "object") return data;
  const r = data as Record<string, unknown>;
  if (!Array.isArray(r.values)) return data;

  const filtered = (r.values as Record<string, unknown>[]).filter((item) => {
    // String date field ("2026-07-20" or "2026-07")
    const dateStr = item.date ?? item.period;
    if (typeof dateStr === "string" && dateStr.length >= 7) {
      const d = dateStr.slice(0, 10);
      return d >= startDate && d <= endDate;
    }
    // Unix timestamp in cohort field
    if (typeof item.cohort === "number") {
      const d = new Date(item.cohort * 1000).toISOString().slice(0, 10);
      return d >= startDate && d <= endDate;
    }
    return true; // unknown shape — include it
  });

  return { ...r, values: filtered };
}

// Sum numeric values from a chart response, with optional date filtering
function sumChartValues(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const r = data as Record<string, unknown>;
  if (Array.isArray(r.values)) {
    return r.values
      .filter((i: Record<string, unknown>) => {
        if (i.incomplete === true) return false;
        // If measure field exists, only take measure=0 (net revenue)
        if (i.measure !== undefined && Number(i.measure) !== 0) return false;
        return true;
      })
      .reduce((sum: number, i: Record<string, unknown>) => {
        return sum + Number(i.value_usd ?? i.value ?? 0);
      }, 0);
  }
  if (Array.isArray(r.items)) {
    return r.items.reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.value_usd ?? i.value ?? 0), 0);
  }
  if (Array.isArray(r.summaries)) {
    return r.summaries.reduce((sum: number, s: Record<string, unknown>) => sum + Number(s.value_usd ?? s.value ?? 0), 0);
  }
  return 0;
}

async function fetchRevenueChart(projectId: string, period: Period, start: string, end: string) {
  const candidates = RESOLUTION_BY_PERIOD[period];
  for (const resolution of candidates) {
    try {
      const data = await rcFetch(`/v2/projects/${projectId}/charts/revenue?resolution=${resolution}&start_time=${start}&end_time=${end}`);
      // Filter by date locally since RC may ignore the params
      return filterValuesByDate(data, start, end);
    } catch {}
  }
  try {
    const data = await rcFetch(`/v2/projects/${projectId}/charts/revenue?start_time=${start}&end_time=${end}`);
    return filterValuesByDate(data, start, end);
  } catch (err) {
    return { _error: err instanceof Error ? err.message : String(err) };
  }
}

// Fetch revenue chart and sum values within the date window
async function fetchPeriodRevenue(projectId: string, days: number): Promise<number> {
  const end = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  for (const res of ["P1D", "day", "daily"]) {
    try {
      const raw = await rcFetch(`/v2/projects/${projectId}/charts/revenue?resolution=${res}&start_time=${start}&end_time=${end}`);
      // Filter by date locally — RC may return all-time data regardless of params
      const filtered = filterValuesByDate(raw, start, end);
      const sum = sumChartValues(filtered);
      // A successful parse returns something (even 0 is valid if there was genuinely no revenue)
      console.log(`[RC] revenue ${days}d res=${res} raw_count=${(raw.values ?? raw.items ?? []).length} filtered_count=${((filtered as Record<string, unknown>).values as unknown[] ?? []).length} sum=${sum}`);
      return sum;
    } catch (e) {
      console.log(`[RC] revenue ${days}d res=${res} ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return 0;
}

async function fetchNewCustomers(projectId: string, days: number): Promise<number> {
  const end = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  for (const res of ["P1D", "day", "daily"]) {
    try {
      const raw = await rcFetch(`/v2/projects/${projectId}/charts/new_paying_customers?resolution=${res}&start_time=${start}&end_time=${end}`);
      const filtered = filterValuesByDate(raw, start, end);
      const sum = sumChartValues(filtered);
      console.log(`[RC] new_customers ${days}d res=${res} sum=${sum}`);
      return sum;
    } catch (e) {
      console.log(`[RC] new_customers ${days}d res=${res} ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return 0;
}

export interface CountryEntry { country: string; revenue: number; }

function extractCountryData(data: unknown): CountryEntry[] {
  if (!data || typeof data !== "object") return [];
  const r = data as Record<string, unknown>;

  if (Array.isArray(r.values) && r.values.length > 0) {
    const first = r.values[0] as Record<string, unknown>;
    if (first.country !== undefined || first.segment !== undefined) {
      const byCountry: Record<string, number> = {};
      for (const v of r.values as Record<string, unknown>[]) {
        if (Number((v as Record<string, unknown>).measure ?? 0) !== 0) continue;
        const c = String(v.country ?? v.segment ?? "Unknown");
        byCountry[c] = (byCountry[c] ?? 0) + Number(v.value ?? 0);
      }
      return Object.entries(byCountry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([country, revenue]) => ({ country, revenue }));
    }
  }

  if (Array.isArray(r.countries)) {
    return (r.countries as Record<string, unknown>[])
      .sort((a, b) => Number(b.revenue ?? b.value ?? 0) - Number(a.revenue ?? a.value ?? 0))
      .slice(0, 12)
      .map((c) => ({
        country: String(c.country ?? c.name ?? c.id ?? "?"),
        revenue: Number(c.revenue ?? c.value ?? 0),
      }));
  }

  if (Array.isArray(r.items)) {
    return (r.items as Record<string, unknown>[])
      .sort((a, b) => Number(b.value ?? b.revenue ?? 0) - Number(a.value ?? a.revenue ?? 0))
      .slice(0, 12)
      .map((i) => ({
        country: String(i.country ?? i.name ?? i.id ?? "?"),
        revenue: Number(i.value ?? i.revenue ?? 0),
      }));
  }

  return [];
}

async function fetchCountryBreakdown(projectId: string): Promise<CountryEntry[]> {
  const end = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const attempts = [
    () => rcFetch(`/v2/projects/${projectId}/charts/revenue_by_country?start_time=${start}&end_time=${end}`),
    () => rcFetch(`/v2/projects/${projectId}/charts/revenue?start_time=${start}&end_time=${end}&segmentation=country&resolution=P1M`),
    () => rcFetch(`/v2/projects/${projectId}/charts/revenue?start_time=${start}&end_time=${end}&country=all`),
  ];

  for (const attempt of attempts) {
    try {
      const data = await attempt();
      const entries = extractCountryData(data);
      if (entries.length > 0) return entries;
    } catch {}
  }
  return [];
}

// Normalise RC V2 overview — fields vary (metric_id vs id, metric_name vs name, change fraction vs %)
function normalizeOverview(raw: unknown): { metrics: Record<string, unknown>[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const arr: Record<string, unknown>[] = Array.isArray(r.metrics)
    ? r.metrics as Record<string, unknown>[]
    : Array.isArray(r.items)
    ? r.items as Record<string, unknown>[]
    : [];

  const normalized = arr.map((item) => ({
    ...item,
    id:   item.id   ?? item.metric_id   ?? item.metricId,
    name: item.name ?? item.metric_name ?? item.metricName,
    change_percentage:
      item.change_percentage !== undefined
        ? Number(item.change_percentage)
        : item.change !== undefined
        ? Number(item.change) * 100
        : undefined,
    value: Number(item.value ?? 0),
  }));

  return { metrics: normalized };
}

// Extract all-time revenue from the overview "Revenue" metric (most accurate source)
function extractAllTimeRevenue(overview: unknown): number {
  if (!overview || typeof overview !== "object") return 0;
  const r = overview as Record<string, unknown>;
  const arr: Record<string, unknown>[] = Array.isArray(r.metrics) ? r.metrics as Record<string, unknown>[]
    : Array.isArray(r.items) ? r.items as Record<string, unknown>[]
    : [];
  const metric = arr.find((m) => {
    const id = String(m.id ?? m.metric_id ?? "").toLowerCase();
    return id === "revenue" || id === "total_revenue" || id === "net_revenue";
  });
  return metric ? Number(metric.value ?? 0) : 0;
}

export async function GET(req: NextRequest) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return NextResponse.json({ configured: false }, { status: 200 });

  const { searchParams } = req.nextUrl;
  const period = (searchParams.get("period") ?? "30d") as Period;
  const { start, end } = getDateRange(period);

  try {
    const projectsData = await rcFetch("/v2/projects?limit=10");
    const projects: { id: string; name: string }[] = projectsData.items ?? [];

    if (projects.length === 0) {
      return NextResponse.json({ configured: true, projects: [] });
    }

    const projectMetrics = await Promise.all(
      projects.map(async (project) => {
        const [
          overview,
          revenue,
          revenue7d,
          revenue30d,
          newSubs7d,
          newSubs30d,
          countryBreakdown,
        ] = await Promise.allSettled([
          rcFetch(`/v2/projects/${project.id}/metrics/overview`),
          fetchRevenueChart(project.id, period, start, end),
          fetchPeriodRevenue(project.id, 7),
          fetchPeriodRevenue(project.id, 30),
          fetchNewCustomers(project.id, 7),
          fetchNewCustomers(project.id, 30),
          fetchCountryBreakdown(project.id),
        ]);

        const rawOverview = overview.status === "fulfilled" ? overview.value : null;
        const normalizedOverview = normalizeOverview(rawOverview);

        // All-time revenue comes from the overview "Revenue" metric — chart-based sum is unreliable
        const revenueAllTime = extractAllTimeRevenue(rawOverview);

        console.log(`[RC] project=${project.name} allTime=${revenueAllTime} 7d=${revenue7d.status === "fulfilled" ? revenue7d.value : "ERR"} 30d=${revenue30d.status === "fulfilled" ? revenue30d.value : "ERR"}`);

        return {
          project,
          overview:         normalizedOverview,
          revenue:          revenue.status === "fulfilled" ? revenue.value : null,
          revenue7d:        revenue7d.status === "fulfilled" ? revenue7d.value : 0,
          revenue30d:       revenue30d.status === "fulfilled" ? revenue30d.value : 0,
          revenueAllTime,
          newSubs7d:        newSubs7d.status === "fulfilled" ? newSubs7d.value : 0,
          newSubs30d:       newSubs30d.status === "fulfilled" ? newSubs30d.value : 0,
          countryBreakdown: countryBreakdown.status === "fulfilled" ? countryBreakdown.value : [],
        };
      })
    );

    return NextResponse.json({ configured: true, projects: projectMetrics, period });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
