import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const location = searchParams.get("location");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (location && location !== "all") where.location = { contains: location, mode: "insensitive" };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { tiktok: { contains: search, mode: "insensitive" } },
      { instagram: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
      { tags: { contains: search, mode: "insensitive" } },
    ];
  }

  const creators = await prisma.creatorApplication.findMany({
    where,
    orderBy: { submittedAt: "desc" },
  });

  return NextResponse.json(creators);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { firstName, lastName, email, over18, location, tiktok, instagram, notes, submittedAt } = body;

  if (!firstName || !email || !submittedAt) {
    return NextResponse.json({ error: "firstName, email and submittedAt are required" }, { status: 400 });
  }

  const creator = await prisma.creatorApplication.upsert({
    where: { email_submittedAt: { email, submittedAt: new Date(submittedAt) } },
    update: {},
    create: {
      firstName,
      lastName: lastName || "",
      email,
      over18: over18 === "Yes" || over18 === true,
      location: location || "Unknown",
      tiktok: tiktok || null,
      instagram: instagram || null,
      notes: notes || null,
      submittedAt: new Date(submittedAt),
    },
  });

  return NextResponse.json(creator, { status: 201 });
}
