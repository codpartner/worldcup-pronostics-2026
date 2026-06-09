import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { GROUP_LETTERS } from "@/lib/group-standings";
import { getTeamOrPlaceholder } from "@/lib/teams";
import type { BracketSubmissionSnapshot } from "@/lib/bracket-submission";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Standard PDF fonts only support WinAnsi — strip/replace characters outside that set. */
function toPdfText(text: string): string {
  return text
    .replace(/\u2192/g, "->")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "?");
}

function displayTeam(name: string): string {
  return toPdfText(getTeamOrPlaceholder(name).displayName);
}

function formatSubmittedAt(value: string): string {
  return toPdfText(
    new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString(
      "en-US",
      {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
      }
    )
  );
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

export async function generateBracketPdf(
  snapshot: BracketSubmissionSnapshot
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawLine = (
    text: string,
    size: number,
    font = regular,
    color = rgb(0.1, 0.1, 0.1),
    align: "left" | "center" = "left"
  ) => {
    const safeText = toPdfText(text);
    const width = font.widthOfTextAtSize(safeText, size);
    const x =
      align === "center" ? (PAGE_WIDTH - width) / 2 : MARGIN;

    if (y - size < MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawText(safeText, { x, y: y - size, size, font, color });
    y -= size + 6;
  };

  const drawWrapped = (
    text: string,
    size: number,
    font = regular,
    color = rgb(0.1, 0.1, 0.1)
  ) => {
    const maxChars = Math.floor(CONTENT_WIDTH / (size * 0.52));
    for (const line of wrapText(text, maxChars)) {
      drawLine(line, size, font, color, "left");
    }
  };

  drawLine("World Cup 2026 Bracket", 22, bold, rgb(0.1, 0.06, 0.2), "center");
  drawLine(snapshot.userName, 12, regular, rgb(0.27, 0.27, 0.27), "center");
  drawLine(
    `Submitted ${formatSubmittedAt(snapshot.submittedAt)}`,
    10,
    regular,
    rgb(0.4, 0.4, 0.4),
    "center"
  );

  if (snapshot.champion) {
    y -= 4;
    drawLine(
      `Champion: ${displayTeam(snapshot.champion)}`,
      14,
      bold,
      rgb(0.1, 0.06, 0.2),
      "center"
    );
  }

  y -= 10;
  drawLine("Group stage predictions", 14, bold, rgb(0.1, 0.06, 0.2));

  for (const group of GROUP_LETTERS) {
    const ranking = snapshot.rankings[group] ?? [];
    drawWrapped(
      `Group ${group}: ${ranking
        .map((team, index) => `${index + 1}. ${displayTeam(team)}`)
        .join(" | ")}`,
      10,
      regular,
      rgb(0.2, 0.2, 0.2)
    );
  }

  y -= 8;
  drawLine("Knockout bracket", 14, bold, rgb(0.1, 0.06, 0.2));

  let currentRound = "";
  for (const pick of snapshot.knockoutPicks) {
    if (pick.round !== currentRound) {
      currentRound = pick.round;
      y -= 4;
      drawLine(currentRound, 12, bold, rgb(0.35, 0.18, 0.51));
    }

    drawWrapped(
      `${displayTeam(pick.team1)} vs ${displayTeam(pick.team2)} -> ${displayTeam(pick.winner)}`,
      10,
      regular,
      rgb(0.2, 0.2, 0.2)
    );
  }

  y -= 8;
  drawLine(
    "CODPARTNER World Cup 2026 Pronostics - bracket locked after submission.",
    8,
    regular,
    rgb(0.53, 0.53, 0.53),
    "center"
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
