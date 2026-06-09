import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";

interface CorrectPredictionEmail {
  to: string;
  name: string;
  team1: string;
  team2: string;
  predictedPick: string;
  actualScore: string;
  points: number;
}

interface WelcomeEmail {
  to: string;
  name: string;
}

interface LoginEmail {
  to: string;
  name: string;
}

interface PasswordResetEmail {
  to: string;
  name: string;
  resetUrl: string;
}

interface PicksOpenEmail {
  to: string;
  name: string;
  team1: string;
  team2: string;
  matchDate: string;
  ground: string;
  round: string;
  closesOn: string;
  picksUrl: string;
}

let transporter: Transporter | null = null;

function getMailEncryption() {
  return (process.env.MAIL_ENCRYPTION || "SSL").trim().toUpperCase();
}

function createTransporter(): Transporter {
  const host = process.env.MAIL_HOST;
  const port = Number(process.env.MAIL_PORT || 465);
  const username = process.env.MAIL_USERNAME;
  const password = process.env.MAIL_PASSWORD;

  if (!host || !username || !password) {
    throw new Error("Mail SMTP settings are incomplete.");
  }

  const encryption = getMailEncryption();

  return nodemailer.createTransport({
    host,
    port,
    secure: encryption === "SSL" || port === 465,
    auth: { user: username, pass: password },
    ...(encryption === "TLS" ? { requireTLS: true } : {}),
  });
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

function getFromAddress(): string {
  const address = process.env.MAIL_FROM_ADDRESS;
  if (!address) {
    throw new Error("MAIL_FROM_ADDRESS is not configured.");
  }

  const name = process.env.MAIL_FROM_NAME?.replace(/^"|"$/g, "");
  return name ? `"${name}" <${address}>` : address;
}

function pointsLabel(): string {
  return "Correct winner!";
}

async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  await getTransporter().sendMail({
    from: getFromAddress(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
  });
}

export async function sendWelcomeEmail(payload: WelcomeEmail): Promise<void> {
  await sendMail({
    to: payload.to,
    subject: "Welcome to CODPARTNER World Cup 2026 Pronostics",
    text: [
      `Hi ${payload.name},`,
      "",
      "Your account is ready. You can now pick match winners and compete with the team.",
      "",
      "Scoring:",
      "- 1 pt for each correct winner (or draw)",
      "",
      "Good luck!",
    ].join("\n"),
    html: `
      <p>Hi ${payload.name},</p>
      <p>Your account is ready. You can now pick match winners and compete with the team.</p>
      <p><strong>Scoring:</strong></p>
      <ul>
        <li>1 pt — correct winner (or draw)</li>
      </ul>
      <p>Good luck!</p>
    `,
  });
}

export async function sendLoginEmail(payload: LoginEmail): Promise<void> {
  const time = new Date().toUTCString();
  await sendMail({
    to: payload.to,
    subject: "New login — World Cup 2026 Pronostics",
    text: [
      `Hi ${payload.name},`,
      "",
      `You just logged in to the CODPARTNER World Cup 2026 pronostics pool.`,
      `Time (UTC): ${time}`,
      "",
      "If this wasn't you, contact your admin.",
    ].join("\n"),
    html: `
      <p>Hi ${payload.name},</p>
      <p>You just logged in to the CODPARTNER World Cup 2026 pronostics pool.</p>
      <p><strong>Time (UTC):</strong> ${time}</p>
      <p>If this wasn't you, contact your admin.</p>
    `,
  });
}

export async function sendPasswordResetEmail(
  payload: PasswordResetEmail
): Promise<void> {
  await sendMail({
    to: payload.to,
    subject: "Reset your password — World Cup 2026 Pronostics",
    text: [
      `Hi ${payload.name},`,
      "",
      "We received a request to reset your password for the CODPARTNER World Cup 2026 pronostics pool.",
      "",
      `Reset your password: ${payload.resetUrl}`,
      "",
      "This link expires in 1 hour. If you didn't request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Hi ${payload.name},</p>
      <p>We received a request to reset your password for the CODPARTNER World Cup 2026 pronostics pool.</p>
      <p><a href="${payload.resetUrl}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
  });
}

export async function sendPicksOpenEmail(payload: PicksOpenEmail): Promise<void> {
  const subject = `Picks are open — ${payload.team1} vs ${payload.team2}`;
  const text = [
    `Hi ${payload.name},`,
    "",
    `You can now pick a winner for ${payload.team1} vs ${payload.team2}.`,
    `Round: ${payload.round}`,
    `Match date: ${payload.matchDate}`,
    `Venue: ${payload.ground}`,
    `Picks close on ${payload.closesOn} (match day).`,
    "",
    `Make your pick: ${payload.picksUrl}`,
  ].join("\n");
  const html = `
    <p>Hi ${payload.name},</p>
    <p>You can now pick a winner for <strong>${payload.team1} vs ${payload.team2}</strong>.</p>
    <ul>
      <li>Round: ${payload.round}</li>
      <li>Match date: ${payload.matchDate}</li>
      <li>Venue: ${payload.ground}</li>
      <li>Picks close: <strong>${payload.closesOn}</strong> (match day)</li>
    </ul>
    <p><a href="${payload.picksUrl}">Make your pick</a></p>
  `;

  await sendMail({ to: payload.to, subject, text, html });
}

export async function sendCorrectPredictionEmail(
  payload: CorrectPredictionEmail
): Promise<void> {
  const subject = `Nice pick! +${payload.points} pts — ${payload.team1} vs ${payload.team2}`;
  const text = [
    `Hi ${payload.name},`,
    "",
    `Your pick for ${payload.team1} vs ${payload.team2} was correct.`,
    `Your pick: ${payload.predictedPick}`,
    `Final score: ${payload.actualScore}`,
    `Points earned: ${payload.points} (${pointsLabel()})`,
    "",
    "Keep it up on the CODPARTNER World Cup 2026 pronostics pool!",
  ].join("\n");
  const html = `
    <p>Hi ${payload.name},</p>
    <p>Your pick for <strong>${payload.team1} vs ${payload.team2}</strong> was correct.</p>
    <ul>
      <li>Your pick: <strong>${payload.predictedPick}</strong></li>
      <li>Final score: <strong>${payload.actualScore}</strong></li>
      <li>Points earned: <strong>${payload.points}</strong> (${pointsLabel()})</li>
    </ul>
    <p>Keep it up on the CODPARTNER World Cup 2026 pronostics pool!</p>
  `;

  await sendMail({ to: payload.to, subject, text, html });
}

interface BracketSubmissionEmail {
  to: string;
  name: string;
  champion: string | null;
  pdf: Buffer;
}

export async function sendBracketSubmissionEmail(
  payload: BracketSubmissionEmail
): Promise<void> {
  const championLine = payload.champion
    ? `Your champion pick: ${payload.champion}`
    : "Your full bracket is attached as a PDF.";

  await sendMail({
    to: payload.to,
    subject: "Your World Cup 2026 bracket is locked in",
    text: [
      `Hi ${payload.name},`,
      "",
      "Thanks for submitting your World Cup 2026 bracket.",
      championLine,
      "",
      "Your bracket is now locked and cannot be edited.",
      "A PDF copy of your picks is attached to this email.",
      "",
      "Good luck!",
    ].join("\n"),
    html: `
      <p>Hi ${payload.name},</p>
      <p>Thanks for submitting your World Cup 2026 bracket.</p>
      <p>${payload.champion ? `<strong>Champion:</strong> ${payload.champion}` : "Your full bracket is attached as a PDF."}</p>
      <p>Your bracket is now <strong>locked</strong> and cannot be edited. A PDF copy of your picks is attached.</p>
      <p>Good luck!</p>
    `,
    attachments: [
      {
        filename: "world-cup-2026-bracket.pdf",
        content: payload.pdf,
      },
    ],
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.MAIL_HOST &&
      process.env.MAIL_PORT &&
      process.env.MAIL_USERNAME &&
      process.env.MAIL_PASSWORD &&
      process.env.MAIL_FROM_ADDRESS
  );
}

export async function sendEmailSafely(task: () => Promise<void>) {
  if (!isEmailConfigured()) return;

  try {
    await task();
  } catch (error) {
    console.error("Email delivery failed:", error);
  }
}
