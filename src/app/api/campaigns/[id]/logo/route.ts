import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session?.user || user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  // Delete old logo if exists
  const existing = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { logoUrl: true },
  });
  if (existing?.logoUrl) {
    try { await del(existing.logoUrl); } catch {}
  }

  const ext = file.name.split(".").pop() ?? "png";
  const blob = await put(`logos/${params.id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const campaign = await prisma.campaign.update({
    where: { id: params.id },
    data: { logoUrl: blob.url },
  });

  return NextResponse.json({ logoUrl: campaign.logoUrl });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session?.user || user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.campaign.findUnique({
    where: { id: params.id },
    select: { logoUrl: true },
  });
  if (existing?.logoUrl) {
    try { await del(existing.logoUrl); } catch {}
  }

  await prisma.campaign.update({
    where: { id: params.id },
    data: { logoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
