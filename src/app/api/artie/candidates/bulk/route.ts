import { NextRequest } from "next/server";
import { handleBulk } from "@/lib/artie/handlers/bulkApprove";

export const POST = (req: NextRequest) => handleBulk("artie", req);
