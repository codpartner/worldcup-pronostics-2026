import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isApiFootballConfigured } from "@/lib/api-football";
import { getSession } from "@/lib/auth";
import { getMatchById, getMatchDetails } from "@/lib/db";
import { syncMatchDetails } from "@/lib/match-sync";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
  }

  const match = getMatchById(matchId);
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const force = request.nextUrl.searchParams.get("refresh") === "1";

  let details = getMatchDetails(matchId);
  if (match.apiFixtureId && isApiFootballConfigured()) {
    details = await syncMatchDetails(matchId, { force });
  }

  return NextResponse.json({
    matchId,
    apiConfigured: isApiFootballConfigured(),
    linked: match.apiFixtureId != null,
    details,
  });
}
