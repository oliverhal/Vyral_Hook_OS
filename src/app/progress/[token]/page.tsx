import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getCreatorProgress } from "@/lib/artie/views";
import ArtieProgressView from "@/components/ArtieProgressView";

// A creator's private link. Public (no login) but unguessable; the token is the
// only input and it resolves to exactly one creator. Never cached or indexed.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your progress · Artie",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8fafc" };

export default async function ProgressPage({ params }: { params: { token: string } }) {
  const progress = await getCreatorProgress(params.token);
  if (!progress) notFound();
  return <ArtieProgressView progress={progress} />;
}
