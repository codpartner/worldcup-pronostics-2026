import { NextResponse } from "next/server";
import { isValidEmail, getSession, validatePassword } from "@/lib/auth";
import {
  deleteUserAccount,
  getUserPicksForAdmin,
  setUserAdmin,
  updateUserPassword,
  updateUserProfile,
} from "@/lib/db";

export const runtime = "nodejs";

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = parseId((await params).id);
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const detail = getUserPicksForAdmin(userId);
  if (!detail) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ detail });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = parseId((await params).id);
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "profile") {
      const name = String(body.name || "");
      const email = String(body.email || "");
      if (!isValidEmail(email.trim())) {
        return NextResponse.json(
          { error: "Enter a valid email address." },
          { status: 400 }
        );
      }
      const user = updateUserProfile(userId, name, email);
      return NextResponse.json({ user });
    }

    if (action === "admin") {
      const isAdmin = Boolean(body.isAdmin);
      if (!isAdmin && userId === session.id) {
        return NextResponse.json(
          { error: "You cannot remove your own admin access." },
          { status: 400 }
        );
      }
      const user = setUserAdmin(userId, isAdmin);
      return NextResponse.json({ user });
    }

    if (action === "password") {
      const password = String(body.password || "");
      const passwordError = validatePassword(password);
      if (passwordError) {
        return NextResponse.json({ error: passwordError }, { status: 400 });
      }
      await updateUserPassword(userId, password);
      return NextResponse.json({ message: "Password updated." });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = parseId((await params).id);
  if (userId === null) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  if (userId === session.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  try {
    deleteUserAccount(userId);
    return NextResponse.json({ message: "User deleted." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not delete user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
