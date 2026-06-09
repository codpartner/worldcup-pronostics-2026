import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000;

export function createResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getResetTokenExpiry(): string {
  return new Date(Date.now() + TOKEN_TTL_MS).toISOString();
}

export function getAppUrl(request: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function buildResetPasswordUrl(request: Request, token: string): string {
  const baseUrl = getAppUrl(request);
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}
