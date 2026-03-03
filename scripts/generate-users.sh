#!/usr/bin/env bash
# generate-users.sh
#
# Copies users.json.example to users.json for local development.
# users.json is intentionally excluded from git (see .gitignore) because
# it may contain real credentials.  Edit users.json locally to suit your
# environment; never commit it with real email addresses or passwords.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLE="$REPO_ROOT/users.json.example"
TARGET="$REPO_ROOT/users.json"

if [ ! -f "$EXAMPLE" ]; then
  echo "ERROR: $EXAMPLE not found." >&2
  exit 1
fi

if [ -f "$TARGET" ]; then
  echo "users.json already exists. Skipping copy to avoid overwriting local edits."
  echo "Delete $TARGET and re-run this script to reset to the sample data."
  exit 0
fi

cp "$EXAMPLE" "$TARGET"
echo "Created $TARGET from $EXAMPLE."
echo ""
echo "Edit users.json with your local test data."
echo "This file is listed in .gitignore and safe for local credentials — but never commit it."
