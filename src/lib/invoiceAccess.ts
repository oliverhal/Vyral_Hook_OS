// Who can see/edit invoices. Enforced client-side by InvoicePasswordGate and
// server-side by /api/invoice-data (the data is financial, so the API must
// not rely on the UI gate).
export const INVOICE_ALLOWED_NAMES = ["Ethan Dichoso", "Oliver Barnes", "Oliver Hale"];

// The localStorage keys that now live in the cloud.
export const INVOICE_STORE_KEYS = [
  "vyral-invoices-v3",          // clients + invoice statuses
  "vyral-invoice-history-v1",   // saved invoices
  "vyral-client-billing-v1",    // per-client billing details
  "vyral-invoice-counters-v1",  // invoice number counters
  "vyral-sender-details-v1",    // Vyral sender/bank details
  "vyral-monthly-burn-v2",      // monthly burn figures
] as const;
