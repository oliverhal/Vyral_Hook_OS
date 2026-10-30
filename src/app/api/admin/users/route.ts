import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!session?.user || user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, color: true, avatarUrl: true, role: true, active: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as { role?: string } | undefined;
  if (!session?.user || sessionUser?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, password, color, role } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: hashed,
      color: color ?? "blue",
      role: role ?? "member",
    },
    select: { id: true, name: true, email: true, color: true, avatarUrl: true, role: true, active: true },
  });

  // Send welcome email
  const siteUrl = process.env.NEXTAUTH_URL ?? "https://vyral-hook-os.vercel.app";
  try {
    await resend.emails.send({
      from: "Vyral Hook OS <team@vyral-labs.com>",
      to: email.toLowerCase(),
      subject: "You've been invited to Vyral Hook OS 🎣",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1e293b;">
          <div style="margin-bottom: 32px;">
            <div style="font-size: 28px; margin-bottom: 8px;">🎣</div>
            <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 6px;">Welcome to Vyral Hook OS</h1>
            <p style="color: #64748b; margin: 0; font-size: 15px;">Your account is ready. Here's everything you need to log in.</p>
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
                <td style="padding: 8px 0; font-size: 14px; font-weight: 500;">${email.toLowerCase()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #64748b;">Password</td>
                <td style="padding: 8px 0; font-size: 14px; font-weight: 500; font-family: monospace; background: #fff; padding: 4px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${password}</td>
              </tr>
            </table>
          </div>

          <a href="${siteUrl}" style="display: inline-block; background: #1e293b; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px; margin-bottom: 28px;">
            Log in now →
          </a>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
            <p style="font-size: 14px; color: #475569; margin: 0 0 12px; font-weight: 600;">What is Vyral Hook OS?</p>
            <p style="font-size: 14px; color: #64748b; margin: 0 0 10px; line-height: 1.6;">
              Hook OS is where the Vyral team submits, reviews, and selects hooks each week for our UGC creator campaigns. Each week you'll see the active campaigns — submit your best hook ideas, vote on the team's submissions, and leave feedback in comments.
            </p>
            <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
              Admins finalise the week's selection and export everything straight to the creator brief. If you have any questions just reply to this email or ask in Slack.
            </p>
          </div>

          <p style="font-size: 12px; color: #94a3b8; margin-top: 32px; margin-bottom: 0;">Sent by Vyral Labs · Hook OS</p>
        </div>
      `,
    });
  } catch (emailErr) {
    // Don't fail the request if email fails — user is already created
    console.error("Failed to send welcome email:", emailErr);
  }

  return NextResponse.json(user, { status: 201 });
}
