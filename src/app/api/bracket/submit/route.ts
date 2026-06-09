import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateBracketPdf } from "@/lib/bracket-pdf";
import {
  buildBracketSubmissionSnapshot,
  validateBracketReady,
} from "@/lib/bracket-submission";
import {
  createBracketSubmission,
  getAllMatches,
  getBracketSubmission,
  getBracketPicksByNum,
  getGroupRankings,
  getUserById,
  markBracketSubmissionEmailSent,
} from "@/lib/db";
import {
  isEmailConfigured,
  sendBracketSubmissionEmail,
} from "@/lib/email";
import { getTeamOrPlaceholder } from "@/lib/teams";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submission = getBracketSubmission(session.id);
  return NextResponse.json({
    submitted: Boolean(submission),
    submittedAt: submission?.submittedAt ?? null,
    emailSentAt: submission?.emailSentAt ?? null,
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const existing = getBracketSubmission(session.id);
    if (existing) {
      return NextResponse.json(
        { error: "Your bracket has already been submitted." },
        { status: 400 }
      );
    }

    const user = getUserById(session.id);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const rankingsRecord = getGroupRankings(session.id);
    if (!rankingsRecord) {
      return NextResponse.json(
        { error: "Complete your group predictions first." },
        { status: 400 }
      );
    }

    const matches = getAllMatches();
    const picksByNum = getBracketPicksByNum(session.id);
    const validationError = validateBracketReady(
      picksByNum,
      rankingsRecord.rankings
    );

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const submittedAt = new Date().toISOString();
    const snapshot = buildBracketSubmissionSnapshot({
      userName: user.name,
      userEmail: user.email,
      submittedAt,
      matches,
      picksByNum,
      rankings: rankingsRecord.rankings,
    });

    const pdf = await generateBracketPdf(snapshot);
    const submission = createBracketSubmission(session.id, pdf);

    let emailSent = false;
    if (isEmailConfigured()) {
      await sendBracketSubmissionEmail({
        to: user.email,
        name: user.name,
        champion: snapshot.champion
          ? getTeamOrPlaceholder(snapshot.champion).displayName
          : null,
        pdf,
      });
      markBracketSubmissionEmailSent(session.id);
      emailSent = true;
    }

    return NextResponse.json({
      submitted: true,
      submittedAt: submission.submittedAt,
      emailSent,
      champion: snapshot.champion,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not submit bracket.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
