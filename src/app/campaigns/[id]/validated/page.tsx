import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import ValidatedLibraryPage from "@/components/ValidatedLibraryPage";

export default async function ValidatedPage({ params }: { params: { id: string } }) {
  const campaign = await prisma.campaign.findUnique({ where: { id: params.id } });
  if (!campaign) notFound();

  return (
    <AppShell>
      <ValidatedLibraryPage campaign={JSON.parse(JSON.stringify(campaign))} />
    </AppShell>
  );
}
