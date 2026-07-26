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

// Sum all revenue values from a chart response (handles multiple RC shapes)
function sumChartValues(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const r = data as Record<string, unknown>;
  if (Array.isArray(r.values)) {
    return r.values
      .filter((i: Record<string, unknown>) => {
        const m = i.measure;
        return !i.incomplete && (m === undefined || Number(m) === 0);
      })
      .reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.value ?? 0), 0);
  }
  if (Array.isArray(r.items)) {
    return r.items.reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.value ?? 0), 0);
  }
  if (Array.isArray(r.summaries)) {
    return r.summaries.reduce((sum: number, s: Record<string, unknown>) => sum + Number(s.value ?? 0), 0);
  }
  return 0;
}

async function fetchRevenueChart(projectId: string, period: Period, start: string, end: string) {
  const candidates = RESOLUTION_BY_PERIOD[period];
  for (const resolution of candidates) {
    try {
      return await rcFetch(`/v2/projects/${projectId}/charts/revenue?resolution=${resolution}&start_time=${start}&end_time=${end}`);
    } catch {}
  }
  try {
    return await rcFetch(`/v2/projects/${projectId}/charts/revenue?start_time=${start}&end_time=${end}`);
  } catch (err) {
    return { _error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchPeriodRevenue(projectId: string, days: number): Promise<number> {
  const end = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  try {
    const data = await rcFetch(`/v2/projects/${projectId}/charts/revenue?resolution=P1D&start_time=${start}&end_time=${end}`);
    return sumChartValues(data);
  } catch { return 0; }
}

async function fetchAllTimeRevenue(projectId: string): Promise<number> {
  const end = new Date().toISOString().split("T")[0];
  const start = new Date();
  start.setFullYear(start.getFullYear() - 5);
  const startStr = start.toISOString().split("T")[0];
  try {
    const data = await rcFetch(`/v2/projects/${projectId}/charts/revenue?resolution=P1M&start_time=${startStr}&end_time=${end}`);
    return sumChartValues(data);
  } catch { return 0; }
}

async function fetchNewCustomers(projectId: string, days: number): Promise<number> {
  const end = new Date().toISOString().split("T")[0];
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  try {
    const data = await rcFetch(`/v2/projects/${projectId}/charts/new_paying_customers?resolution=P1D&start_time=${start}&end_time=${end}`);
    return sumChartValues(data);
  } catch { return 0; }
}

export interface CountryEntry { country: string; revenue: number; }

function extractCountryData(data: unknown): CountryEntry[] {
  if (!data || typeof data !== "object") return [];
  const r = data as Record<string, unknown>;

  // Segmented chart: values have a country/segment field alongside cohort
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

  // { countries: [...] } shape
  if (Array.isArray(r.countries)) {
    return (r.countries as Record<string, unknown>[])
      .sort((a, b) => Number(b.revenue ?? b.value ?? 0) - Number(a.revenue ?? a.value ?? 0))
      .slice(0, 12)
      .map((c) => ({
        country: String(c.country ?? c.name ?? c.id ?? "?"),
        revenue: Number(c.revenue ?? c.value ?? 0),
      }));
  }

  // { items: [...] } shape
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
          revenueAllTime,
          newSubs7d,
          newSubs30d,
          countryBreakdown,
        ] = await Promise.allSettled([
          rcFetch(`/v2/projects/${project.id}/metrics/overview`),
          fetchRevenueChart(project.id, period, start, end),
          fetchPeriodRevenue(project.id, 7),
          fetchPeriodRevenue(project.id, 30),
          fetchAllTimeRevenue(project.id),
          fetchNewCustomers(project.id, 7),
          fetchNewCustomers(project.id, 30),
          fetchCountryBreakdown(project.id),
        ]);

        return {
          project,
          overview:         overview.status === "fulfilled" ? overview.value : null,
          revenue:          revenue.status === "fulfilled" ? revenue.value : null,
          revenue7d:        revenue7d.status === "fulfilled" ? revenue7d.value : 0,
          revenue30d:       revenue30d.status === "fulfilled" ? revenue30d.value : 0,
          revenueAllTime:   revenueAllTime.status === "fulfilled" ? revenueAllTime.value : 0,
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
