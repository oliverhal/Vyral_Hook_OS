import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// One-time setup endpoint — creates the admin user
// Disabled automatically once an admin exists
export async function POST(req: NextRequest) {
  const existing = await prisma.user.findFirst({ where: { role: "admin" } });
  if (existing) {
    return NextResponse.json({ error: "Setup already complete" }, { status: 400 });
  }

  const body = await req.json();
  const { name, email, password, setupKey } = body;

  if (setupKey !== process.env.SETUP_KEY) {
    return NextResponse.json({ error: "Invalid setup key" }, { status: 403 });
  }

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email and password required" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: hashed, role: "admin", color: "blue" },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ ok: true, user });
}
