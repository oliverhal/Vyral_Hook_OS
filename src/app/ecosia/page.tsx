import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ArtieDashboardContent from "@/components/ArtieDashboardContent";
import ArtieRestricted from "@/components/ArtieRestricted";
import { isArtieReviewer, isArtieOnly } from "@/lib/artieAccess";

// The same creator-progress dashboard, for Ecosia (its own ViralDeck workspace, no bonuses).
// Artie-only users (e.g. Hanna) don't get this one.
export default async function EcosiaPage({ searchParams }: { searchParams: { cycle?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const user = session.user as { name?: string; role?: string };
  return (
    <AppShell>
      {isArtieReviewer(user) && !isArtieOnly(user) ? <ArtieDashboardContent programme="ecosia" initialCycle={searchParams.cycle ?? ""} /> : <ArtieRestricted />}
    </AppShell>
  );
}
