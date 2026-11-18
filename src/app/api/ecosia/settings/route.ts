import { NextRequest } from "next/server";
import { handleSettingsPut } from "@/lib/artie/handlers/settings";

export const PUT = (req: NextRequest) => handleSettingsPut("ecosia", req);
