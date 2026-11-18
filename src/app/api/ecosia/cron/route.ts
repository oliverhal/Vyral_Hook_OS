import { NextRequest } from "next/server";
import { handleCron } from "@/lib/artie/handlers/cron";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handleCron("ecosia", req);
export const POST = (req: NextRequest) => handleCron("ecosia", req);
