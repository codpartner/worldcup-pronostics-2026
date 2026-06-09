import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  areAllGroupRankingsComplete,
  GROUP_LETTERS,
} from "@/lib/group-standings";
import { getGroupRankings, getBracketSubmission, upsertGroupRankings } from "@/lib/db";
import type { GroupRankings } from "@/lib/types";

export const runtime = "nodejs";

function isValidRankings(value: unknown): value is GroupRankings {
  if (!value || typeof value !== "object") return false;
  const rankings = value as GroupRankings;

  for (const group of GROUP_LETTERS) {
    const teams = rankings[group];
    if (teams === undefined) continue;
    if (!Array.isArray(teams) || teams.length > 4 || teams.length === 0) {
      return false;
    }
    if (!teams.every((team) => typeof team === "string" && team.length > 0)) {
      return false;
    }
    if (new Set(teams).size !== teams.length) return false;
  }

  return true;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = getGroupRankings(session.id);
  const submission = getBracketSubmission(session.id);
  return NextResponse.json({
    rankings: record?.rankings ?? {},
    updatedAt: record?.updatedAt ?? null,
    complete: record ? areAllGroupRankingsComplete(record.rankings) : false,
    submitted: Boolean(submission),
    submittedAt: submission?.submittedAt ?? null,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!isValidRankings(body.rankings)) {
    return NextResponse.json(
      { error: "Invalid group rankings. Each group needs 4 unique teams." },
      { status: 400 }
    );
  }

  try {
    const record = upsertGroupRankings(session.id, body.rankings);
    return NextResponse.json({
      rankings: record.rankings,
      updatedAt: record.updatedAt,
      complete: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save group predictions.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
