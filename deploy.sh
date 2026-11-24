#!/usr/bin/env bash
# Rebuild the archive site and deploy it to the same Vercel production project.
# Preferred path: Vercel CLI (`vercel deploy --prod`) when a token is available.
# If the CLI is missing or unauthenticated, this script still rebuilds the site
# and writes deploy-manifest.json for an MCP create_deployment (see README.md).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="${VERCEL_PROJECT_NAME:-shiogama-nana-blog}"
# Personal Hobby team on the connected Vercel account (kkwok0915-a11y).
TEAM_SCOPE="${VERCEL_ORG_ID:-team_MpzOmojkBvxnWwiQW63WOOQH}"

python3 "$ROOT/build.py"

PUBLIC="$ROOT/public"
if [[ ! -f "$PUBLIC/index.html" ]]; then
  echo "build failed: $PUBLIC/index.html is missing" >&2
  exit 1
fi

deploy_with_cli() {
  local vercel_bin=""
  if command -v vercel >/dev/null 2>&1; then
    vercel_bin="vercel"
  elif command -v npx >/dev/null 2>&1; then
    vercel_bin="npx --yes vercel"
  else
    return 1
  fi

  # Authenticated if VERCEL_TOKEN is set, or `vercel whoami` succeeds.
  if [[ -z "${VERCEL_TOKEN:-}" ]]; then
    if ! $vercel_bin whoami --non-interactive >/dev/null 2>&1; then
      return 2
    fi
  fi

  echo "Deploying $PUBLIC to Vercel project $PROJECT_NAME (production) via CLI..."
  # Deploy the generated public/ folder as the project root so HTML/CSS/photos
  # are served as a static site. --yes skips prompts; --non-interactive for agents.
  $vercel_bin deploy "$PUBLIC" \
    --prod \
    --yes \
    --non-interactive \
    --name "$PROJECT_NAME" \
    --scope "$TEAM_SCOPE"
}

if deploy_with_cli; then
  echo "Production deploy finished."
  exit 0
fi
status=$?

echo
echo "CLI deploy was not used (exit $status): Vercel CLI missing or not authenticated."
echo "The site was still rebuilt at $PUBLIC"
echo "and the file manifest is at $ROOT/deploy-manifest.json"
echo
echo "A future agent should redeploy with the user-Vercel MCP tools:"
echo "  1. Run: python3 $ROOT/build.py"
echo "  2. For each entry in $ROOT/deploy-manifest.json -> files:"
echo "       user-Vercel / upload_file"
echo "         contentLength = size"
echo "         xVercelDigest = sha"
echo "         teamId = team_MpzOmojkBvxnWwiQW63WOOQH"
echo "         requestBody  = base64 of the file at 'path'"
echo "         (pass requestBody as \$file:<path-to-a-base64-text-file>)"
echo "  3. user-Vercel / create_deployment"
echo "       skipAutoDetectionConfirmation = 1"
echo "       teamId = team_MpzOmojkBvxnWwiQW63WOOQH"
echo "       requestBody.name = $PROJECT_NAME"
echo "       requestBody.target = production"
echo "       requestBody.projectSettings.framework = null"
echo "       requestBody.files = [{file, sha, size}, ...] from the manifest"
echo "  4. If production is behind Vercel Authentication, update_project with"
echo "       requestBody.ssoProtection = null  (this project only)."
echo
echo "Do not scrape credentials. If upload_file or create_deployment returns 403"
echo "for scope kkwok0915-a11ys-projects, call authorize_team_access with"
echo "teamId team_MpzOmojkBvxnWwiQW63WOOQH and have the user open the link."
exit 0
