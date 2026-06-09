import { NextResponse } from "next/server";
import { isValidEmail, isWorkEmail, normalizeEmail } from "@/lib/auth";
import {
  createPasswordResetTokenRecord,
  findUserByEmail,
} from "@/lib/db";
import { isEmailConfigured, sendEmailSafely, sendPasswordResetEmail } from "@/lib/email";
import {
  buildResetPasswordUrl,
  createResetToken,
  getResetTokenExpiry,
  hashResetToken,
} from "@/lib/password-reset";

export const runtime = "nodejs";

const GENERIC_MESSAGE =
  "If an account exists for that email, we sent a password reset link.";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!isWorkEmail(email)) {
      const domain = process.env.WORK_EMAIL_DOMAIN || "codpartner.com";
      return NextResponse.json(
        { error: `Please use your @${domain} work email.` },
        { status: 400 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Password reset email is not configured. Contact your admin.",
        },
        { status: 503 }
      );
    }

    const user = findUserByEmail(email);
    if (user) {
      const token = createResetToken();
      createPasswordResetTokenRecord(
        user.id,
        hashResetToken(token),
        getResetTokenExpiry()
      );

      const resetUrl = buildResetPasswordUrl(request, token);

      await sendEmailSafely(() =>
        sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        })
      );
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch {
    return NextResponse.json(
      { error: "Could not process password reset request." },
      { status: 500 }
    );
  }
}
