import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ArtieDashboardContent from "@/components/ArtieDashboardContent";
import ArtieRestricted from "@/components/ArtieRestricted";
import { isArtieReviewer } from "@/lib/artieAccess";

export default async function ArtiePage({ searchParams }: { searchParams: { cycle?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <AppShell>
      {isArtieReviewer(session.user as { name?: string; role?: string }) ? <ArtieDashboardContent initialCycle={searchParams.cycle ?? ""} /> : <ArtieRestricted />}
    </AppShell>
  );
}
