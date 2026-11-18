import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireArtieReviewer } from "@/lib/artieServer";
import type { Programme } from "@/lib/artie/programme";


// Every active creator's private-link token, for the dashboard's "Copy link" buttons.
// Reviewer-only: the tokens are the creators' only credential for their own page.
// Creators have no Hook OS account — their link opens /progress/<token>, a standalone
// page with no login and no route into the rest of the app.
export async function handleLinks(programme: Programme) {
  const auth = await requireArtieReviewer();
  if (auth.error) return auth.error;
  const creators = await prisma.artieCreator.findMany({
    where: { programme, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, accessToken: true },
  });
  return NextResponse.json({ links: creators.map((c) => ({ id: c.id, name: c.name, token: c.accessToken })) });
}
