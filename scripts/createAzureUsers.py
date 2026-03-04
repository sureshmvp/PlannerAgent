#!/usr/bin/env python3
"""
createAzureUsers.py
-------------------
Reads user definitions from a JSON file and bulk-creates them in Azure AD
via Microsoft Graph API using MSAL client-credentials flow.

Credentials are loaded from .env (project root) and/or environment variables.

Usage:
  python3 scripts/createAzureUsers.py                     # uses users.json
  python3 scripts/createAzureUsers.py --file users.json   # explicit file
  python3 scripts/createAzureUsers.py --dry-run           # validate only
"""

import json
import os
import sys
import argparse
from pathlib import Path

from typing import Optional, Tuple, List

import msal
import requests

# ─── Config ──────────────────────────────────────────────────────────────────

# Resolve project root relative to this script
PROJECT_ROOT = Path(__file__).resolve().parent.parent

GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"


def load_env(env_path: Path) -> dict:
    """Parse a .env file and return key/value pairs (does not modify os.environ)."""
    env: dict = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def resolve_config() -> dict:
    """Merge .env file values with real environment variables (env vars win)."""
    file_env = load_env(PROJECT_ROOT / ".env")

    def get(key: str, default: str = "") -> str:
        return os.environ.get(key) or file_env.get(key) or default

    return {
        "tenant_id":     get("AZURE_TENANT_ID"),
        "client_id":     get("AZURE_CLIENT_ID"),
        "client_secret": get("AZURE_CLIENT_SECRET"),
        "scope":         get("AZURE_GRAPH_SCOPE", "https://graph.microsoft.com/.default"),
    }


# ─── Authentication ───────────────────────────────────────────────────────────

def get_access_token(config: dict) -> str:
    """Acquire an access token using MSAL client-credentials flow."""
    required = ["tenant_id", "client_id", "client_secret"]
    missing = [k for k in required if not config.get(k)]
    if missing:
        sys.exit(
            f"\n❌ Missing credentials: {', '.join(missing)}\n"
            "   Set them in your .env file or as environment variables.\n"
        )

    authority = f"https://login.microsoftonline.com/{config['tenant_id']}"
    app = msal.ConfidentialClientApplication(
        client_id=config["client_id"],
        client_credential=config["client_secret"],
        authority=authority,
    )

    result = app.acquire_token_for_client(scopes=[config["scope"]])

    if "access_token" not in result:
        error = result.get("error_description", result.get("error", "Unknown error"))
        sys.exit(f"\n❌ Failed to acquire token: {error}\n")

    return result["access_token"]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def graph_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def user_exists(token: str, upn: str) -> Tuple[bool, Optional[str]]:
    """Return (True, user_id) if the UPN already exists in Azure AD."""
    url = f"{GRAPH_BASE_URL}/users/{requests.utils.quote(upn)}"
    resp = requests.get(url, headers=graph_headers(token), timeout=15)
    if resp.status_code == 200:
        return True, resp.json().get("id")
    return False, None


def build_user_payload(user: dict) -> dict:
    """Convert input dict to the Microsoft Graph user creation payload."""
    payload = {
        "displayName":       user["displayName"],
        "userPrincipalName": user["userPrincipalName"],
        "mailNickname":      user["mailNickname"],
        "accountEnabled":    user.get("accountEnabled", True),
        "passwordProfile": {
            "forceChangePasswordNextSignIn": user.get("forceChangePasswordNextSignIn", True),
            "password": user.get("password", os.getenv("DEFAULT_USER_PASSWORD", "TempPass123!")),
        },
    }

    # Optional fields
    for field in ("givenName", "surname", "jobTitle", "department", "usageLocation"):
        if user.get(field):
            payload[field] = user[field]

    return payload


def validate_user(user: dict, index: int) -> List[str]:
    """Return a list of validation error strings (empty = valid)."""
    errors = []
    for required in ("displayName", "userPrincipalName", "mailNickname"):
        if not user.get(required):
            errors.append(f"missing '{required}'")
    upn = user.get("userPrincipalName", "")
    if upn and "@" not in upn:
        errors.append(f"'userPrincipalName' does not look like an email: {upn}")
    return errors


# ─── Core ─────────────────────────────────────────────────────────────────────

def create_user(token: str, user: dict) -> Tuple[str, Optional[str], Optional[str]]:
    """
    POST to /users.
    Returns (status, user_id, error_message)
      status: 'created' | 'skipped' | 'failed'
    """
    upn = user["userPrincipalName"]

    # Check for existing user first
    exists, existing_id = user_exists(token, upn)
    if exists:
        return "skipped", existing_id, None

    payload = build_user_payload(user)
    resp = requests.post(
        f"{GRAPH_BASE_URL}/users",
        headers=graph_headers(token),
        json=payload,
        timeout=15,
    )

    if resp.status_code == 201:
        return "created", resp.json().get("id"), None

    try:
        error_msg = resp.json()["error"]["message"]
    except Exception:
        error_msg = resp.text or f"HTTP {resp.status_code}"

    return "failed", None, error_msg


def run(users_file: Path, dry_run: bool = False) -> None:
    print("")
    print("  ╭───────────────────────────────────────────────╮")
    print("  │  Azure AD User Creation — workasaservice.ai   │")
    print("  ╰───────────────────────────────────────────────╯")
    print("")

    # Load config
    config = resolve_config()
    print(f"  Tenant  : {config['tenant_id']}")
    print(f"  ClientID: {config['client_id']}")

    # Load users file
    if not users_file.exists():
        sys.exit(f"\n❌ Users file not found: {users_file}\n")

    raw = json.loads(users_file.read_text())
    users = raw.get("users") or (raw if isinstance(raw, list) else [])

    if not users:
        sys.exit("\n❌ No users found in the file. Expected { \"users\": [...] }\n")

    print(f"  File    : {users_file}")
    print(f"  Users   : {len(users)}")
    if dry_run:
        print("  Mode    : DRY RUN (no changes will be made)")
    print("")

    # Validate
    print("  Validating...")
    has_errors = False
    for i, user in enumerate(users):
        errors = validate_user(user, i)
        if errors:
            print(f"  ❌ User #{i + 1} ({user.get('userPrincipalName', '?')}): {'; '.join(errors)}")
            has_errors = True

    if has_errors:
        sys.exit("\n  Aborting: fix validation errors above before creating users.\n")
    print("  ✅ All users validated\n")

    if dry_run:
        print("  Dry-run complete. Re-run without --dry-run to apply changes.\n")
        return

    # Authenticate
    print("  Authenticating with Microsoft Graph...")
    token = get_access_token(config)
    print("  ✅ Token acquired\n")

    # Create users
    print(f"  Creating {len(users)} user(s)...\n")
    results = {"created": [], "skipped": [], "failed": []}
    portal_base = "https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserProfileMenuBlade/~/overview/userId"

    for i, user in enumerate(users):
        upn = user["userPrincipalName"]
        label = f"  [{i + 1}/{len(users)}] {upn}"

        status, uid, error = create_user(token, user)

        if status == "created":
            print(f"{label}")
            print(f"         ✅ Created  →  ID: {uid}")
            print(f"            🔗 {portal_base}/{uid}")
            results["created"].append({"upn": upn, "id": uid})
        elif status == "skipped":
            print(f"{label}")
            print(f"         ⏭️  Already exists  →  ID: {uid}")
            results["skipped"].append({"upn": upn, "id": uid})
        else:
            print(f"{label}")
            print(f"         ❌ Failed  →  {error}")
            results["failed"].append({"upn": upn, "error": error})

        print("")

    # Summary
    print("  ─────────────────────────────────────────────────")
    print(f"  ✅ Created : {len(results['created'])}")
    print(f"  ⏭️  Skipped : {len(results['skipped'])}")
    print(f"  ❌ Failed  : {len(results['failed'])}")
    print("")

    if results["failed"]:
        print("  Failed users:")
        for f in results["failed"]:
            print(f"    - {f['upn']}: {f['error']}")
        print("")

    print("  View all users in Azure Portal:")
    print("  https://portal.azure.com/#view/Microsoft_AAD_UsersAndTenants/UserManagementMenuBlade/~/AllUsers")
    print("")


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Bulk-create Azure AD users from a JSON file via Microsoft Graph API."
    )
    parser.add_argument(
        "--file", "-f",
        type=Path,
        default=PROJECT_ROOT / "users.json",
        help="Path to users JSON file (default: users.json in project root)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate the JSON file without making any API calls",
    )
    args = parser.parse_args()
    run(users_file=args.file.resolve(), dry_run=args.dry_run)


if __name__ == "__main__":
    main()
