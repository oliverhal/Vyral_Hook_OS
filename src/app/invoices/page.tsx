import AppShell from "@/components/AppShell";
import InvoicePasswordGate from "@/components/InvoicePasswordGate";
import InvoiceManagementContent from "@/components/InvoiceManagementContent";

export default function InvoicesPage() {
  return (
    <AppShell>
      <InvoicePasswordGate>
        <InvoiceManagementContent />
      </InvoicePasswordGate>
    </AppShell>
  );
}
