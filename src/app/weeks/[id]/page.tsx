import AppShell from "@/components/AppShell";
import WeekView from "@/components/WeekView";

export default function WeekPage({ params }: { params: { id: string } }) {
  return (
    <AppShell>
      <WeekView weekId={params.id} />
    </AppShell>
  );
}
