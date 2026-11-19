import { NextRequest } from "next/server";
import { handleDetailGet, handleDetailPatch } from "@/lib/artie/handlers/creatorDetail";

export const dynamic = "force-dynamic";

export const GET = (req: NextRequest, ctx: { params: { id: string } }) => handleDetailGet("artie", req, ctx);
export const PATCH = (req: NextRequest, ctx: { params: { id: string } }) => handleDetailPatch("artie", req, ctx);
