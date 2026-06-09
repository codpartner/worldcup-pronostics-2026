import { NextResponse } from "next/server";
import { validatePassword } from "@/lib/auth";
import {
  findValidPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from "@/lib/db";
import { hashResetToken } from "@/lib/password-reset";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token) {
      return NextResponse.json(
        { error: "Reset link is invalid or expired." },
        { status: 400 }
      );
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const resetToken = findValidPasswordResetToken(hashResetToken(token));
    if (!resetToken) {
      return NextResponse.json(
        { error: "Reset link is invalid or expired." },
        { status: 400 }
      );
    }

    await updateUserPassword(resetToken.userId, password);
    markPasswordResetTokenUsed(resetToken.id);

    return NextResponse.json({
      message: "Password updated. You can log in with your new password.",
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reset password." },
      { status: 500 }
    );
  }
}
