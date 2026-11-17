import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ArtieCreatorDetail from "@/components/ArtieCreatorDetail";
import ArtieRestricted from "@/components/ArtieRestricted";
import { isArtieReviewer } from "@/lib/artieAccess";

export default async function ArtieCreatorPage({ params, searchParams }: { params: { id: string }; searchParams: { cycle?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return (
    <AppShell>
      {isArtieReviewer(session.user as { name?: string; role?: string }) ? <ArtieCreatorDetail id={params.id} initialCycle={searchParams.cycle ?? ""} /> : <ArtieRestricted />}
    </AppShell>
  );
}
