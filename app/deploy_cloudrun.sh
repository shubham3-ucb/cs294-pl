#!/usr/bin/env bash
# Put Monster Lab on Google Cloud Run: exactly one always-on instance, because the whole session
# lives in that one process. Cloud Run's disk is memory, so a redeploy or restart starts a fresh
# session (with a new teacher key, unless you pass the old one as ADMIN_KEY).
#
#   ./deploy_cloudrun.sh PROJECT REGION      e.g. ./deploy_cloudrun.sh my-class us-west1
#
# Optional: ADMIN_KEY=... (default: a new random key), SERVICE=... (default: monster-lab).
set -euo pipefail
cd "$(dirname "$0")"

[ $# -eq 2 ] || { echo "Usage: $0 PROJECT REGION   (e.g. $0 my-class us-west1)" >&2; exit 1; }
PROJECT=$1 REGION=$2
SERVICE=${SERVICE:-monster-lab}
KEY=${ADMIN_KEY:-$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')}

gcloud run deploy "$SERVICE" --source . --project "$PROJECT" --region "$REGION" \
  --max-instances 1 --min-instances 1 --concurrency 1000 --no-cpu-throttling \
  --session-affinity --timeout 3600 --allow-unauthenticated \
  --set-env-vars "ADMIN_KEY=$KEY"

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format 'value(status.url)')

cat <<EOF

  Monster Lab is on Cloud Run.

  Students   $URL/
  Teacher    $URL/admin?key=$KEY
  Projector  $URL/screen?key=$KEY

  It runs (and bills) all the time. After class, delete it:
    gcloud run services delete $SERVICE --project $PROJECT --region $REGION

EOF
