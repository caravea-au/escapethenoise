#!/usr/bin/env bash
# ============================================================================
# Trigger a Ploi deploy webhook and block until the deploy has actually finished.
# Goes at .github/scripts/ploi-deploy.sh — this file is environment-agnostic and
# needs no substitution.
# ----------------------------------------------------------------------------
# Why this exists. POSTing the webhook only tells you Ploi *accepted* the
# request: it answers immediately with
#     {"status":"ok","message":"Use the `ping_url` ...","ping_url":"..."}
# and the deploy script then runs on the server for minutes afterwards. A
# workflow that stops at that POST will report success for a deploy script that
# died on the server (failed `npm ci`, failed `strapi build`, missing
# backend/.env). That is how a production site sat un-deployed and blank while
# every run in the Actions list was green. Silence is the bug: this script
# converts a failed deploy into a failed job.
#
# Required env:
#   WEBHOOK         the Ploi deploy webhook URL (a secret)
# Optional env:
#   POLL_TIMEOUT    seconds to wait for a terminal status (default 900)
#   POLL_INTERVAL   seconds between polls (default 10)
#   CLOCK_SKEW      seconds of tolerance on the server clock (default 120)
# ============================================================================
set -euo pipefail

: "${WEBHOOK:?WEBHOOK is required}"
POLL_TIMEOUT="${POLL_TIMEOUT:-900}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
CLOCK_SKEW="${CLOCK_SKEW:-120}"

# Stamp the trigger time BEFORE the POST. `ping_url` reports the status of the
# site's most recent deployment, not specifically ours, so a poll that lands
# before our deploy has started would otherwise read the PREVIOUS deployment's
# result and pass on it. Ploi prefixes each deploy log with the deploy's start
# time, so we require that timestamp to be at or after this one before trusting
# any terminal status.
trigger_epoch="$(date -u +%s)"

response="$(curl --fail --silent --show-error --location --max-time 60 --request POST "$WEBHOOK")"

ping_url="$(printf '%s' "$response" | jq -r '.ping_url // empty')"
if [[ -z "$ping_url" ]]; then
  echo "::error::Ploi did not return a ping_url. Raw response: ${response}"
  exit 1
fi

echo "Ploi accepted the deploy request. Waiting for the deploy itself (timeout ${POLL_TIMEOUT}s)."

# Read the deploy log's leading timestamp as an epoch. Empty when the log has no
# parseable date, which we treat as "cannot confirm this is our deploy".
log_start_epoch() {
  local first_line
  first_line="$(printf '%s' "$1" | head -n 1)"
  [[ -z "$first_line" ]] && return 0
  date -u -d "$first_line" +%s 2>/dev/null || true
}

deadline=$(( $(date -u +%s) + POLL_TIMEOUT ))
last_reported=""

while [[ "$(date -u +%s)" -lt "$deadline" ]]; do
  sleep "$POLL_INTERVAL"

  body="$(curl --silent --show-error --location --max-time 30 \
            --header 'Accept: application/json' "$ping_url" || true)"
  status="$(printf '%s' "$body" | jq -r '.status // empty' 2>/dev/null || true)"
  log="$(printf '%s' "$body" | jq -r '.log // empty' 2>/dev/null || true)"

  if [[ -z "$status" ]]; then
    echo "  ... no status yet"
    continue
  fi

  # Ignore a terminal status still describing the previous deployment.
  started="$(log_start_epoch "$log")"
  if [[ -z "$started" ]] || [[ "$started" -lt $(( trigger_epoch - CLOCK_SKEW )) ]]; then
    echo "  ... status=${status} but the log predates this trigger, still waiting"
    continue
  fi

  [[ "$status" != "$last_reported" ]] && echo "  ... status=${status}"
  last_reported="$status"

  case "$status" in
    success|finished)
      echo "Deploy finished successfully. Last 40 lines:"
      printf '%s\n' "$log" | tail -n 40
      exit 0
      ;;
    failed|error|errored|cancelled|canceled|timeout)
      echo "::error::Ploi deploy reported status '${status}'. Full deploy log follows."
      printf '%s\n' "$log"
      exit 1
      ;;
  esac
  # Any other value is treated as still running. An unrecognised terminal state
  # therefore fails via the timeout below rather than being mistaken for success:
  # this must fail closed, since a false green is the exact bug being fixed.
done

echo "::error::Timed out after ${POLL_TIMEOUT}s waiting for the Ploi deploy to reach a terminal status."
echo "Check the deploy log in the Ploi panel for this site."
exit 1
