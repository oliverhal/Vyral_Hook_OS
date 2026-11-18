import { NextRequest } from "next/server";
import { handleOverview } from "@/lib/artie/handlers/overview";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) => handleOverview("ecosia", req);
