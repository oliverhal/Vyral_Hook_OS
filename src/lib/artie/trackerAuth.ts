import { createHash, timingSafeEqual } from "crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

/**
 * Does the presented bearer value match the shared secret? Compared as fixed-length hashes in constant
 * time (so neither content nor length leaks), and it FAILS CLOSED: an unset or empty secret never matches.
 */
export function secretMatches(presented: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !presented) return false;
  return timingSafeEqual(digest(presented), digest(secret));
}

/** "Bearer abc" → "abc" (null when the header is missing or not a bearer token). */
export function bearerFrom(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return m ? m[1].trim() : null;
}
