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

function getDateRange(period: Period): { start: string; end: string; resolution: string } {
  const end = new Date();
  const start = new Date();
  let resolution = "daily";

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 7);
      resolution = "daily";
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      resolution = "daily";
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      start.setDate(1);
      resolution = "weekly";
      break;
    case "12m":
      start.setMonth(start.getMonth() - 12);
      start.setDate(1);
      resolution = "monthly";
      break;
  }

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    resolution,
  };
}

export async function GET(req: NextRequest) {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  const { searchParams } = req.nextUrl;
  const period = (searchParams.get("period") ?? "30d") as Period;
  const { start, end, resolution } = getDateRange(period);

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
            rcFetch(
              `/v2/projects/${project.id}/charts/revenue?resolution=${resolution}&start_time=${start}&end_time=${end}`
            ).catch(() => null),
          ]);

          // Log raw revenue shape so we can see what RevenueCat actually returns
          if (revenue) {
            console.log(
              `[app-studio] revenue shape for ${project.id} (period=${period}):`,
              JSON.stringify(Object.keys(revenue))
            );
            const firstItem = revenue.items?.[0] ?? revenue.values?.[0] ?? revenue.summaries?.[0];
            if (firstItem) {
              console.log(`[app-studio] first revenue item keys:`, JSON.stringify(Object.keys(firstItem)));
              console.log(`[app-studio] first revenue item:`, JSON.stringify(firstItem));
            }
          }

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
