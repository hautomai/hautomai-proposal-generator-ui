"""
One-time OAuth2 setup: authorizes with your Google account so the backend
can create Google Docs in your Drive.

Prerequisites:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID → "Desktop app"
3. Download the JSON → save as "client_secret.json" in project root

Usage: python -m backend.auth_setup
"""

import json
import os
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def main():
    project_root = Path(__file__).resolve().parent.parent
    secret_path = project_root / "client_secret.json"

    if not secret_path.exists():
        print("=" * 60)
        print("  MISSING: client_secret.json")
        print("=" * 60)
        print()
        print("Step 1: Go to https://console.cloud.google.com/apis/credentials")
        print("Step 2: Click + Create Credentials → OAuth 2.0 Client ID")
        print("Step 3: Application type → Desktop app")
        print("Step 4: Name → Proposal Generator")
        print("Step 5: Download the JSON file")
        print("Step 6: Save it as 'client_secret.json' in this directory:")
        print(f"       {project_root}")
        print()
        return

    print("Starting OAuth2 authorization...")
    print("A browser window will open. Log in with your Google account")
    print(f"(you@example.com) and grant access.")
    print()

    flow = InstalledAppFlow.from_client_secrets_file(
        str(secret_path), scopes=SCOPES
    )
    creds = flow.run_local_server(port=0)

    print("\nAuthorization successful!")
    print(f"Refresh token obtained.")

    client_data = json.loads(secret_path.read_text())
    client_id = client_data.get("installed", {}).get(
        "client_id", creds.client_id
    )
    client_secret = client_data.get("installed", {}).get(
        "client_secret", creds.client_secret
    )

    _save_to_env(client_id, client_secret, creds.refresh_token)

    print()
    print("=" * 60)
    print("  SETUP COMPLETE")
    print("=" * 60)
    print()
    print("The OAuth2 credentials are now saved in .env")
    print("You can now start the server:")
    print()
    print("  source venv/bin/activate")
    print("  uvicorn backend.main:app --reload")
    print()


def _save_to_env(client_id: str, client_secret: str, refresh_token: str):
    env_lines = []
    if ENV_PATH.exists():
        env_lines = ENV_PATH.read_text().splitlines()

    updated = _set_or_add(env_lines, "GOOGLE_CLIENT_ID", client_id)
    updated = _set_or_add(updated, "GOOGLE_CLIENT_SECRET", client_secret)
    updated = _set_or_add(updated, "GOOGLE_REFRESH_TOKEN", refresh_token)

    ENV_PATH.write_text("\n".join(updated) + "\n")
    print(f"Updated {ENV_PATH}")


def _set_or_add(lines: list[str], key: str, value: str) -> list[str]:
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            return lines
    lines.append(f"{key}={value}")
    return lines


if __name__ == "__main__":
    main()
