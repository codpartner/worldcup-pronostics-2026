import { NextResponse } from "next/server";
import { verifyUserPassword } from "@/lib/db";
import {
  createSession,
  isValidEmail,
  normalizeEmail,
  setSessionCookie,
} from "@/lib/auth";
import { sendEmailSafely, sendLoginEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));
    const password = String(body.password || "");

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Please enter your password." },
        { status: 400 }
      );
    }

    const user = await verifyUserPassword(email, password);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await sendEmailSafely(() =>
      sendLoginEmail({ to: user.email, name: user.name })
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
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
