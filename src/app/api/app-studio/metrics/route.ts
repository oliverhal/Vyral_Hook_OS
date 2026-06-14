import { NextResponse } from "next/server";

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

export async function GET() {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  try {
    // Fetch projects list
    const projectsData = await rcFetch("/v2/projects?limit=10");
    const projects: { id: string; name: string }[] = projectsData.items ?? [];

    if (projects.length === 0) {
      return NextResponse.json({ configured: true, projects: [] });
    }

    // Fetch overview metrics for each project in parallel
    const projectMetrics = await Promise.all(
      projects.map(async (project) => {
        try {
          const [overview, revenue] = await Promise.all([
            rcFetch(`/v2/projects/${project.id}/metrics/overview`),
            rcFetch(`/v2/projects/${project.id}/charts/revenue?resolution=monthly&start_time=${getStartTime()}&end_time=${getEndTime()}`).catch(() => null),
          ]);
          return { project, overview, revenue };
        } catch {
          return { project, overview: null, revenue: null };
        }
      })
    );

    return NextResponse.json({ configured: true, projects: projectMetrics });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function getStartTime() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function getEndTime() {
  return new Date().toISOString().split("T")[0];
}
