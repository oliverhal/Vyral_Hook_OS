import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

// POST /api/user/avatar?userId=xxx  (admins can pass userId, users upload for themselves)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { id: string; role?: string };
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId") ?? sessionUser.id;

  // Only admins can upload for other users
  if (targetId !== sessionUser.id && sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Must be an image" }, { status: 400 });

  // Delete old avatar
  const existing = await prisma.user.findUnique({ where: { id: targetId }, select: { avatarUrl: true } });
  if (existing?.avatarUrl) {
    try { await del(existing.avatarUrl); } catch {}
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const blob = await put(`avatars/${targetId}.${ext}`, file, { access: "public", addRandomSuffix: true });

  await prisma.user.update({ where: { id: targetId }, data: { avatarUrl: blob.url } });

  return NextResponse.json({ avatarUrl: blob.url });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { id: string; role?: string };
  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId") ?? sessionUser.id;

  if (targetId !== sessionUser.id && sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { id: targetId }, select: { avatarUrl: true } });
  if (existing?.avatarUrl) {
    try { await del(existing.avatarUrl); } catch {}
  }

  await prisma.user.update({ where: { id: targetId }, data: { avatarUrl: null } });
  return NextResponse.json({ ok: true });
}
