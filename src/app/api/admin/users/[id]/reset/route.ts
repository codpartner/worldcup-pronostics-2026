import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resetUserData, resetUserMatchPick } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = Number((await params).id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const matchId = body?.matchId;

    if (matchId !== undefined && matchId !== null) {
      const id = Number(matchId);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
      }
      resetUserMatchPick(userId, id);
      return NextResponse.json({ message: "Pick reset." });
    }

    resetUserData(userId);
    return NextResponse.json({ message: "All picks reset." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reset picks.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
