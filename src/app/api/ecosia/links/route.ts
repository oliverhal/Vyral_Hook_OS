import { handleLinks } from "@/lib/artie/handlers/links";

export const dynamic = "force-dynamic";

export const GET = () => handleLinks("ecosia");
