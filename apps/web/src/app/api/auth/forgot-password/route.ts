import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Always respond with success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: "If an account with this email exists, a password reset link has been dispatched.",
      });
    }

    // Generate random crypto reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      },
    });

    // Determine host origin for link
    const origin =
      req.headers.get("origin") ||
      req.headers.get("x-forwarded-host") ||
      "http://localhost:3000";
    const protocol = origin.startsWith("http") ? "" : "https://";
    const fullOrigin = origin.startsWith("http") ? origin : `${protocol}${origin}`;
    const resetUrl = `${fullOrigin}/reset-password?token=${token}`;

    console.log(`[PASSWORD RESET] Generated reset link for ${user.email}: ${resetUrl}`);

    // Send reset email using platform runnly.xyz
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM || "Cupid Mail <no-reply@runnly.xyz>";

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: fromAddress,
          to: user.email,
          subject: "Reset your Cupid Mail password",
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Space Mono', sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px; margin: 0 auto; background: #FAF7F2; border-radius: 16px; overflow: hidden; border: 1px solid #ECE3D6; box-shadow: 0 4px 20px -2px rgba(136, 19, 55, 0.08);">
  <div style="background: linear-gradient(135deg, #881337 0%, #4c0519 100%); padding: 32px 28px; color: #FFFDFB; text-align: left; border-bottom: 3px solid #be123c;">
    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
      <tr>
        <td style="vertical-align: middle; padding-right: 14px;">
          <img src="${fullOrigin}/assets/Logo.png" alt="Cupid Mail" style="width: 44px; height: 44px; object-fit: contain; display: block; background: rgba(255, 255, 255, 0.12); padding: 5px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.25);" />
        </td>
        <td style="vertical-align: middle;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #fecdd3; font-weight: 700;">Cupid Mail Security</div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFDFB; letter-spacing: -0.02em;">Reset Your Password</h1>
        </td>
      </tr>
    </table>
    <p style="margin: 0; color: #ffe4e6; font-size: 13px; opacity: 0.95;">A password reset request was initiated for your account.</p>
  </div>

  <div style="background: #FFFDFB; padding: 28px; border-radius: 0 0 16px 16px;">
    <p style="font-size: 14px; margin-top: 0; color: #292524;">
      Hello <strong>${user.name || "there"}</strong>,
    </p>
    <p style="font-size: 13px; color: #57534e; line-height: 1.6;">
      We received a request to reset your password for Cupid Mail. Click the button below to choose a new password. This link will expire in <strong>60 minutes</strong>.
    </p>

    <div style="margin: 26px 0; text-align: left;">
      <a href="${resetUrl}" style="display: inline-block; background: #881337; color: #FFFDFB; font-weight: 700; font-size: 13px; text-decoration: none; padding: 13px 28px; border-radius: 12px; font-family: monospace; box-shadow: 0 2px 8px rgba(136, 19, 55, 0.25);">
        Reset Password &rarr;
      </a>
    </div>

    <div style="background: #FFF1F2; border: 1px solid #FFE4E6; border-left: 3px solid #881337; padding: 12px 14px; border-radius: 8px; margin-top: 20px;">
      <p style="margin: 0; font-size: 11px; color: #881337; font-family: monospace;">
        Direct link: <a href="${resetUrl}" style="color: #881337; word-break: break-all;">${resetUrl}</a>
      </p>
    </div>

    <p style="font-size: 12px; color: #78716c; line-height: 1.5; margin-top: 24px; margin-bottom: 0;">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
  </div>
</div>`,
        });
      } catch (err: any) {
        console.error("Failed to send reset email via Resend:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "If an account with this email exists, a password reset link has been dispatched.",
      // For easy local testing if email fails:
      resetUrl: (process.env.NODE_ENV as string) !== "production" ? resetUrl : undefined,
    });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: err?.message || "Failed to process request" }, { status: 500 });
  }
}

