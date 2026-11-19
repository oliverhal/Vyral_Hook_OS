// Who can see and approve Artie creator data. Admins always can; the named
// list covers people who aren't admins. Add Alice's Hook OS account name here
// if she isn't an admin.
export const ARTIE_REVIEWER_NAMES = ["Oliver Hale", "Oliver Barnes", "Hanna"];

// Reviewers who should see ONLY the Artie pages (no other Hook OS sections).
export const ARTIE_ONLY_NAMES = ["Hanna"];

export function isArtieOnly(user: { name?: string | null; role?: string | null } | undefined | null): boolean {
  return !!user && user.role !== "admin" && ARTIE_ONLY_NAMES.includes(user.name ?? "");
}

export function isArtieReviewer(user: { name?: string | null; role?: string | null } | undefined | null): boolean {
  if (!user) return false;
  return user.role === "admin" || ARTIE_REVIEWER_NAMES.includes(user.name ?? "");
}
