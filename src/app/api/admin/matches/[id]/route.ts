import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMatchEmailStats, updateMatchDetails } from "@/lib/db";

export const runtime = "nodejs";

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matchId = parseId((await params).id);
  if (matchId === null) {
    return NextResponse.json({ error: "Invalid match id." }, { status: 400 });
  }

  try {
    const body = await request.json();
    const num = parseOptionalInt(body.num);
    const apiFixtureId = parseOptionalInt(body.apiFixtureId);

    if (body.num !== null && body.num !== undefined && body.num !== "" && num === null) {
      return NextResponse.json({ error: "Invalid match number." }, { status: 400 });
    }

    if (
      body.apiFixtureId !== null &&
      body.apiFixtureId !== undefined &&
      body.apiFixtureId !== "" &&
      apiFixtureId === null
    ) {
      return NextResponse.json(
        { error: "Invalid API fixture id." },
        { status: 400 }
      );
    }

    const match = updateMatchDetails(matchId, {
      round: String(body.round || ""),
      num,
      date: String(body.date || ""),
      time: String(body.time || ""),
      team1: String(body.team1 || ""),
      team2: String(body.team2 || ""),
      group: body.group ? String(body.group) : null,
      ground: String(body.ground || ""),
      apiFixtureId,
    });

    return NextResponse.json({
      match,
      emailStats: getMatchEmailStats(matchId),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update match.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
