# CODPARTNER World Cup 2026 Pronostics

Internal winner-pick pool for the CODPARTNER team during FIFA World Cup 2026.

## Features

- Individual accounts with work email + password
- All 104 tournament matches (group stage through final)
- Pick the winner (or draw) for each match, locked at kickoff
- **Pick history** — every change logged; full audit for admins
- **Team activity feed** — anonymized picks (`Ale***** picked Mexico vs South Africa`)
- Automatic scoring: 1 pt per correct winner (or draw)
- **Live match hub** — `/live` with scores refreshed every 30s via API-Football
- **Team hero banners** — star player spotlight per country (add photos under `public/images/players/`)
- **Scheduled result sync** — 10 min after kickoff (UTC), retries every 5 min
- **SMTP emails** when a member earns points on a finished match
- Live leaderboard

## Quick start (Docker — recommended)

The stack runs the app, SQLite, scheduled jobs, and **Caddy** (automatic HTTPS for your domain).

### Server deploy

1. Point your domain **A record** to the server IP (e.g. `pronostics.codpartner.com`).
2. Open firewall ports **80** and **443**.
3. On the server:

```bash
git clone <repo> pronostics && cd pronostics
cp .env.example .env
# Edit .env — set DOMAIN, AUTH_SECRET, CRON_SECRET, MAIL_*, ADMIN_EMAILS, API_FOOTBALL_KEY

docker compose up --build -d
```

4. Open `https://your-domain` — Caddy obtains the TLS certificate automatically.

`APP_URL` is derived from `DOMAIN` (`https://DOMAIN`) for password-reset and email links. Override only if needed with `APP_URL` in `.env`.

The container automatically runs:

| Schedule | Job |
|----------|-----|
| Every 5 min | Sync live/final scores from API-Football |
| Daily 08:00 UTC | Email all users when new pick windows open |

Data persists in Docker volumes (`pronostics-data` for SQLite/PDFs, `caddy-data` for TLS certs).

To stop: `docker compose down`  
To wipe app data: `docker compose down -v` (keeps certs unless you remove `caddy-data` too)

### Local Docker (optional)

Set `DOMAIN=localhost` in `.env` for local Caddy, or use `npm run dev` instead (see below).

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Cron jobs are **not** run in dev mode — trigger them manually (see below) or use Docker.

## Configuration

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Public hostname — Caddy serves HTTPS; `APP_URL` defaults to `https://DOMAIN` |
| `ACME_EMAIL` | Optional Let's Encrypt contact email |
| `WORK_EMAIL_DOMAIN` | Required email domain (default: `codpartner.com`) |
| `AUTH_SECRET` | JWT signing secret |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `APP_URL` | Optional override for email/reset links (auto from `DOMAIN` in Docker) |
| `API_FOOTBALL_KEY` | API-Football key for live results |
| `CRON_SECRET` | Protects the scheduled sync endpoint |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP port (465 for SSL) |
| `MAIL_USERNAME` | SMTP username |
| `MAIL_PASSWORD` | SMTP password |
| `MAIL_ENCRYPTION` | `SSL` or `TLS` |
| `MAIL_FROM_ADDRESS` | Sender email address |
| `MAIL_FROM_NAME` | Optional sender display name |

## Emails

| Event | When | Trigger |
|-------|------|---------|
| Welcome | Sign up | Automatic |
| Login notice | Log in | Automatic |
| Picks open | 4 days before match day | Daily cron (`/api/cron/notify-picks-open`) |
| Correct pick | After match result | Admin clicks **Send winner emails** |

Result sync (API or cron) only saves scores and calculates points — it does not email members until an admin sends winner emails from `/admin`.

## Scheduled result sync

Kickoff times are converted to **UTC** from the match schedule (e.g. `13:00 UTC-6` → 19:00 UTC). The system starts polling **10 minutes after kickoff** and retries every **5 minutes** for up to 3 hours.

With **Docker**, these run automatically inside the container. Without Docker, call the endpoints yourself or use an external scheduler:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/sync-results
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/notify-picks-open
```

### Pick window

Picks open **4 days before match day** (UTC midnight) and **close at midnight on match day**. Configure with `PICKS_OPEN_DAYS_BEFORE` in `.env.local`.

When a match's pick window opens, the daily cron emails **all signed-up users** (once per match).

When a result is found, predictions are scored. Admins then send winner emails from the admin panel.

## Pages

| Route | Who | Description |
|-------|-----|-------------|
| `/live` | All | Live scores and today's results |
| `/matches` | All | Pick match winners |
| `/activity` | All | Anonymized team picks (no scores) |
| `/leaderboard` | All | Rankings |
| `/admin` | Admins | Enter/sync match results |
| `/admin/picks` | Admins | Full pick history audit trail |

## Scoring

| Result | Points |
|--------|--------|
| Correct winner (or draw) | 1 |

## Tech stack

- Next.js (App Router)
- SQLite via better-sqlite3
- Tailwind CSS
- SMTP (nodemailer) for notifications
- API-Football for result sync

Data is stored locally in `data/pronostics.db`.

## Live scores & player images

Set `API_FOOTBALL_KEY` in `.env.local` (free tier at [api-football.com](https://www.api-football.com/)). The `/live` page and cron job pull live scores; final results still score predictions without sending emails until an admin triggers them.

Each team has a star player in `src/data/team-heroes.json`. To show real photos (e.g. Hakimi for Morocco, Ronaldo for Portugal), add JPEGs under `public/images/players/` and set the `image` field:

```json
"MAR": { "player": "Achraf Hakimi", "image": "/images/players/mar.jpg" },
"POR": { "player": "Cristiano Ronaldo", "image": "/images/players/por.jpg" }
```

Without images, the UI falls back to a colored gradient with the player name and flag.
