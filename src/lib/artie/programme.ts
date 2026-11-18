// The creator-progress dashboard runs for more than one client ("programme"). Each has its own ViralDeck
// workspace key, its own settings row, and its own rows on the shared payroll sheet (Client Name column).

// ARTIE ONLY: the Art Master calculator is in euros (€600 per creator incl. bonuses, €30,000 for 50 creators) but
// Artie is shown in dollars, so its budget is converted once here at the ECB reference rate for 17 Nov 2026
// (1 EUR = 1.0989 USD). Editable in Artie's Settings ("Monthly creator budget per creator") if the rate moves.
// Ecosia stays in euros, unconverted.
export const EUR_TO_USD = 1.0989;
const usd = (eur: number) => Math.round(eur * EUR_TO_USD * 100) / 100;

export type Programme = "artie" | "ecosia";

export interface ProgrammeConfig {
  label: string;
  /** ArtieSettings.id for this programme. Artie keeps the legacy "singleton" id so no data had to move. */
  settingsId: string;
  /** Default for the payroll sheet's Client Name filter. */
  payrollClientDefault: string;
  /** Env var holding this programme's ViralDeck API key. */
  apiKeyEnv: string;
  /** Defaults a brand-new settings row is created with. */
  defaults: { bonusEnabled: boolean; monthlyCostPerCreator: number | null; targetCreators: number | null; currency: string };
}

export const PROGRAMMES: Record<Programme, ProgrammeConfig> = {
  artie: {
    label: "Artie", settingsId: "singleton", payrollClientDefault: "Artie", apiKeyEnv: "VIRALDECK_ARTIE_API_KEY",
    // Art Master calculator, 50-creator row: €600 per creator incl. bonuses = €30,000, converted to dollars.
    defaults: { bonusEnabled: true, monthlyCostPerCreator: usd(600), targetCreators: 50, currency: "USD" }, // €600 → $659.34; 50 creators → $32,967
  },
  ecosia: {
    label: "Ecosia", settingsId: "ecosia", payrollClientDefault: "Ecosia", apiKeyEnv: "VIRALDECK_ECOSIA_API_KEY",
    // No bonuses for Ecosia. ~€500 creator budget per creator per month (pricing table: 14→€7,000 … 35→€17,500), kept in euros.
    defaults: { bonusEnabled: false, monthlyCostPerCreator: 500, targetCreators: 28, currency: "EUR" }, // €500, shown in euros
  },
};

export const isProgramme = (x: unknown): x is Programme => x === "artie" || x === "ecosia";

/** Programme of a stored row, tolerating anything unexpected as Artie (the original). */
export const programmeOf = (x: string | null | undefined): Programme => (isProgramme(x) ? x : "artie");
