#!/bin/sh
set -e

PORT="${PORT:-3000}"
export PORT

if [ -z "${APP_URL}" ] && [ -n "${DOMAIN}" ]; then
  export APP_URL="https://${DOMAIN}"
fi

if [ -z "${APP_URL}" ]; then
  export APP_URL="http://localhost:${PORT}"
fi

if [ -z "${CRON_SECRET}" ]; then
  echo "WARNING: CRON_SECRET is not set — scheduled jobs will fail."
fi

mkdir -p /app/data

export CRON_SECRET
envsubst < /app/docker/crontab.template > /tmp/crontab
echo "Starting scheduler (supercronic)..."
/usr/local/bin/supercronic /tmp/crontab &

echo "Starting app on port ${PORT} (public URL: ${APP_URL})..."
exec node /app/server.js
