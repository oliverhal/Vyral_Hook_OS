import { NextRequest } from "next/server";
import { handleCron } from "@/lib/artie/handlers/cron";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handleCron("artie", req);
export const POST = (req: NextRequest) => handleCron("artie", req);
