import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Email TLD → expected language(s)
const DOMAIN_LANGUAGE: Record<string, string[]> = {
  ".de": ["German"],
  ".at": ["German"],
  ".ch": ["German", "French", "Italian"],
  ".nl": ["Dutch"],
  ".be": ["Dutch", "French"],
  ".it": ["Italian"],
  ".fr": ["French"],
  ".es": ["Spanish"],
  ".pt": ["Portuguese"],
  ".pl": ["Polish"],
  ".gr": ["Greek"],
  ".ro": ["Romanian"],
  ".cz": ["Czech"],
  ".se": ["Swedish"],
  ".no": ["Norwegian"],
  ".dk": ["Danish"],
  ".fi": ["Finnish"],
  ".hu": ["Hungarian"],
};

// Location/country keyword → expected language(s)
const LOCATION_LANGUAGE: Record<string, string[]> = {
  germany: ["German"], deutschland: ["German"], münchen: ["German"],
  berlin: ["German"], hamburg: ["German"], cologne: ["German"],
  austria: ["German"], wien: ["German"], vienna: ["German"],
  switzerland: ["German", "French", "Italian"],
  netherlands: ["Dutch"], holland: ["Dutch"], amsterdam: ["Dutch"],
  rotterdam: ["Dutch"], utrecht: ["Dutch"],
  italy: ["Italian"], italia: ["Italian"], milan: ["Italian"],
  rome: ["Italian"], florence: ["Italian"], naples: ["Italian"],
  france: ["French"], paris: ["French"], lyon: ["French"],
  toulouse: ["French"], marseille: ["French"],
  spain: ["Spanish"], españa: ["Spanish"], madrid: ["Spanish"],
  barcelona: ["Spanish"], seville: ["Spanish"],
  portugal: ["Portuguese"], lisbon: ["Portuguese"], porto: ["Portuguese"],
  brazil: ["Portuguese"], brasil: ["Portuguese"],
  poland: ["Polish"], polska: ["Polish"], warsaw: ["Polish"],
  greece: ["Greek"], athens: ["Greek"],
  romania: ["Romanian"], bucharest: ["Romanian"],
  philippines: ["Filipino", "English"], manila: ["Filipino", "English"],
};

// Clients that have a language column in their form — null language here is suspicious
const CLIENTS_WITH_FORM_LANGUAGE = ["Ecosia", "Juno", "Jumpspeak", "Artie", "Pazi"];

function domainLanguages(email: string): string[] {
  const lower = email.toLowerCase();
  for (const [tld, langs] of Object.entries(DOMAIN_LANGUAGE)) {
    const atIdx = lower.lastIndexOf("@");
    if (atIdx !== -1 && lower.slice(atIdx).includes(tld)) return langs;
  }
  return [];
}

function locationLanguages(location: string | null, country: string | null): string[] {
  const text = `${location ?? ""} ${country ?? ""}`.toLowerCase();
  for (const [keyword, langs] of Object.entries(LOCATION_LANGUAGE)) {
    if (text.includes(keyword)) return langs;
  }
  return [];
}

function languageMatches(stored: string | null, expected: string[]): boolean {
  if (!stored) return false;
  const lo = stored.toLowerCase();
  return expected.some((e) => lo.includes(e.toLowerCase()));
}

export interface AuditFlag {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  client: string;
  language: string | null;
  location: string | null;
  country: string | null;
  reason: string;
}

export async function GET() {
  const creators = await prisma.creatorApplication.findMany({
    select: {
      id: true, firstName: true, lastName: true, email: true,
      client: true, language: true, location: true, country: true,
    },
  });

  const flagged: AuditFlag[] = [];

  for (const c of creators) {
    const domainLangs = domainLanguages(c.email);
    const locLangs = locationLanguages(c.location, c.country);

    if (!c.language) {
      const hasFormLang = CLIENTS_WITH_FORM_LANGUAGE.includes(c.client);
      const hint = domainLangs[0] ?? locLangs[0];
      flagged.push({
        ...c,
        reason: hasFormLang
          ? `No language — ${c.client} form should have provided one`
          : hint
          ? `No language — ${hint} likely based on ${domainLangs.length ? "email domain" : "location"}`
          : "No language — could not determine",
      });
      continue;
    }

    if (domainLangs.length > 0 && !languageMatches(c.language, domainLangs)) {
      flagged.push({
        ...c,
        reason: `Stored "${c.language}" but email domain suggests ${domainLangs.join(" or ")}`,
      });
      continue;
    }

    if (locLangs.length > 0 && !languageMatches(c.language, locLangs) && c.language.toLowerCase() !== "english") {
      flagged.push({
        ...c,
        reason: `Stored "${c.language}" but location "${c.country ?? c.location}" suggests ${locLangs.join(" or ")}`,
      });
    }
  }

  return NextResponse.json({ total: creators.length, flagged });
}
