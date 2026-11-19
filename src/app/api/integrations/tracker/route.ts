import { NextRequest } from "next/server";
import { handleTracker } from "@/lib/artie/handlers/trackerSummary";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handleTracker(req);
