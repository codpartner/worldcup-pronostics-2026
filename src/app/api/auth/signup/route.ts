import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/db";
import {
  createSession,
  isAdminEmail,
  isValidEmail,
  isWorkEmail,
  normalizeEmail,
  setSessionCookie,
  validatePassword,
} from "@/lib/auth";
import { sendEmailSafely, sendWelcomeEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = normalizeEmail(String(body.email || ""));
    const password = String(body.password || "");

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name (at least 2 characters)." },
        { status: 400 }
      );
    }

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

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please log in." },
        { status: 409 }
      );
    }

    const user = await createUser(name, email, password, isAdminEmail(email));

    await sendEmailSafely(() =>
      sendWelcomeEmail({ to: user.email, name: user.name })
    );

    const token = await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } catch {
    return NextResponse.json({ error: "Sign up failed." }, { status: 500 });
  }
}
