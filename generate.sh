#!/usr/bin/env bash
set -euo pipefail

URL="https://securha-n8n--proposal-generator-generate-proposal.modal.run"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Single source of truth: the bearer token lives in .env (never hardcoded).
if [ -f "$ROOT/.env" ]; then
  set -a
  . <(grep -E '^PROPOSAL_API_TOKEN=' "$ROOT/.env")
  set +a
fi
TOKEN="${PROPOSAL_API_TOKEN:?PROPOSAL_API_TOKEN missing — add it to .env}"

TRANSCRIPT_FILE="${1:?Usage: $0 <transcript_file> <company_name> <price>}"
COMPANY="${2:?Usage: $0 <transcript_file> <company_name> <price>}"
PRICE="${3:?Usage: $0 <transcript_file> <company_name> <price>}"

TRANSCRIPT=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" < "$TRANSCRIPT_FILE")

curl -s -X POST "$URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"transcript\": $TRANSCRIPT, \"company_name\": \"$COMPANY\", \"price\": \"$PRICE\"}"