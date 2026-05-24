import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { role?: string } | undefined;
  if (!session?.user || sessionUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, color, role, active, password } = body;

  // Check if we're reactivating a previously deactivated user
  const existingUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { active: true, email: true, name: true },
  });
  const isReactivating = active === true && existingUser?.active === false;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email.toLowerCase();
  if (color !== undefined) data.color = color;
  if (role !== undefined) data.role = role;
  if (active !== undefined) data.active = active;
  if (password) data.password = await bcrypt.hash(password, 10);

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, color: true, role: true, active: true },
  });

  // Send welcome email on reactivation
  if (isReactivating) {
    const siteUrl = process.env.NEXTAUTH_URL ?? "https://vyral-hook-os.vercel.app";
    const userEmail = (email ?? existingUser?.email ?? "").toLowerCase();
    try {
      await resend.emails.send({
        from: "Vyral Hook OS <team@vyral-labs.com>",
        to: userEmail,
        subject: "Your Vyral Hook OS account has been reactivated 🎣",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1e293b;">
            <div style="margin-bottom: 32px;">
              <div style="font-size: 28px; margin-bottom: 8px;">🎣</div>
              <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 6px;">You're back on Vyral Hook OS</h1>
              <p style="color: #64748b; margin: 0; font-size: 15px;">Your account has been reactivated. Here's your login info.</p>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
              <p style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Your login details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b; width: 80px;">Site</td>
                  <td style="padding: 8px 0; font-size: 14px;"><a href="${siteUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 500;">${siteUrl}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Email</td>
                  <td style="padding: 8px 0; font-size: 14px; font-weight: 500;">${userEmail}</td>
                </tr>
                ${password ? `<tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Password</td>
                  <td style="padding: 8px 0; font-size: 14px; font-weight: 500; font-family: monospace; background: #fff; padding: 4px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${password}</td>
                </tr>` : `<tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Password</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Same as before</td>
                </tr>`}
              </table>
            </div>

            <a href="${siteUrl}" style="display: inline-block; background: #1e293b; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px; margin-bottom: 28px;">
              Log in now →
            </a>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 32px; margin-bottom: 0;">Sent by Vyral Labs · Hook OS</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send reactivation email:", emailErr);
    }
  }

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { role?: string; id?: string } | undefined;
  if (!session?.user || sessionUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (sessionUser?.id === params.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
