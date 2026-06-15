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

// RevenueCat resolution values to try in order (P1D=daily, P7D=weekly, P1M=monthly)
const RESOLUTION_BY_PERIOD: Record<Period, string[]> = {
  "7d":  ["P1D", "day", "daily"],
  "30d": ["P1D", "day", "daily"],
  "3m":  ["P7D", "week", "weekly"],
  "12m": ["P1M", "month", "monthly"],
};

async function fetchRevenueChart(projectId: string, period: Period, start: string, end: string) {
  const candidates = RESOLUTION_BY_PERIOD[period];

  // Try each resolution candidate until one works
  for (const resolution of candidates) {
    try {
      const data = await rcFetch(
        `/v2/projects/${projectId}/charts/revenue?resolution=${resolution}&start_time=${start}&end_time=${end}`
      );
      return data;
    } catch {
      // try next
    }
  }

  // Also try without resolution param
  try {
    return await rcFetch(
      `/v2/projects/${projectId}/charts/revenue?start_time=${start}&end_time=${end}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { _error: msg };
  }
}

export async function GET(req: NextRequest) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

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
        try {
          const [overview, revenue] = await Promise.all([
            rcFetch(`/v2/projects/${project.id}/metrics/overview`),
            fetchRevenueChart(project.id, period, start, end),
          ]);
          return { project, overview, revenue };
        } catch {
          return { project, overview: null, revenue: null };
        }
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
