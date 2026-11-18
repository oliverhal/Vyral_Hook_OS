// The creator-progress dashboard runs for more than one client ("programme"). Each has its own ViralDeck
// workspace key, its own settings row, and its own rows on the shared payroll sheet (Client Name column).

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
  defaults: { bonusEnabled: boolean; monthlyCostPerCreator: number | null; currency: string };
}

export const PROGRAMMES: Record<Programme, ProgrammeConfig> = {
  artie: {
    label: "Artie", settingsId: "singleton", payrollClientDefault: "Artie", apiKeyEnv: "VIRALDECK_ARTIE_API_KEY",
    defaults: { bonusEnabled: true, monthlyCostPerCreator: 600, currency: "USD" },
  },
  ecosia: {
    label: "Ecosia", settingsId: "ecosia", payrollClientDefault: "Ecosia", apiKeyEnv: "VIRALDECK_ECOSIA_API_KEY",
    // No bonuses for Ecosia. ~€500 creator budget per creator per month (pricing table: 14→€7,000 … 35→€17,500).
    defaults: { bonusEnabled: false, monthlyCostPerCreator: 500, currency: "EUR" },
  },
};

export const isProgramme = (x: unknown): x is Programme => x === "artie" || x === "ecosia";

/** Programme of a stored row, tolerating anything unexpected as Artie (the original). */
export const programmeOf = (x: string | null | undefined): Programme => (isProgramme(x) ? x : "artie");
