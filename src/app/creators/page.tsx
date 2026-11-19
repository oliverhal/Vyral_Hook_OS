import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import CreatorsContent from "@/components/CreatorsContent";

export default async function CreatorsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <AppShell>
      <CreatorsContent />
    </AppShell>
  );
}
