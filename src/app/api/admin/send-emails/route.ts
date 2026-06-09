import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMatchEmailStats, notifyCorrectPredictionsForMatch } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured. Check MAIL_* settings." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const matchId = Number(body.matchId);

    if (!Number.isInteger(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Invalid match." }, { status: 400 });
    }

    const result = await notifyCorrectPredictionsForMatch(matchId);

    return NextResponse.json({
      ...result,
      emailStats: getMatchEmailStats(matchId),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send emails.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
