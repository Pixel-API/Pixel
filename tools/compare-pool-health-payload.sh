#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000/api/v1}"
OLD_PATH="${OLD_PATH:-/admin/accounts?page_size=500&platform=openai}"
NEW_PATH="${NEW_PATH:-/admin/pools/health}"
AUTH_HEADER="${AUTH_HEADER:-}"
ROUNDS="${ROUNDS:-3}"

if [[ -z "$AUTH_HEADER" && -n "${ADMIN_TOKEN:-}" ]]; then
  AUTH_HEADER="Authorization: Bearer ${ADMIN_TOKEN}"
fi

measure() {
  local label="$1"
  local path="$2"
  local url="${BASE_URL}${path}"

  for i in $(seq 1 "$ROUNDS"); do
    if [[ -n "$AUTH_HEADER" ]]; then
      curl -sS -o /dev/null \
        -H "$AUTH_HEADER" \
        -w "${label}\tround=${i}\tstatus=%{http_code}\tbytes=%{size_download}\ttime_total=%{time_total}\n" \
        "$url"
    else
      curl -sS -o /dev/null \
        -w "${label}\tround=${i}\tstatus=%{http_code}\tbytes=%{size_download}\ttime_total=%{time_total}\n" \
        "$url"
    fi
  done
}

echo "BASE_URL=${BASE_URL}"
echo "OLD_PATH=${OLD_PATH}"
echo "NEW_PATH=${NEW_PATH}"
echo "ROUNDS=${ROUNDS}"
measure old_accounts "$OLD_PATH"
measure new_pool_health "$NEW_PATH"
