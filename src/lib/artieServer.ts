import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isArtieReviewer } from "@/lib/artieAccess";

// Access is enforced here, on the server — the UI hiding a page isn't enough
// because this data includes per-creator pay information.
export async function requireArtieReviewer(): Promise<
  { name: string; error?: undefined } | { error: NextResponse; name?: undefined }
> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { name?: string; role?: string } | undefined;
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isArtieReviewer(user)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { name: user.name ?? "Unknown" };
}
