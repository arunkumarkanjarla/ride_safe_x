"""Provision an administrator account (no default password in seed).

Usage:
  python -m app.scripts.provision_admin --email admin@example.com --name "Admin"
  ADMIN_PASSWORD=... python -m app.scripts.provision_admin --email ... --name ...
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from app.core.db import get_session_factory, reset_engine
from app.services.auth import create_user
from app.services.seed import seed_rbac_catalogue


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Provision RideNova admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument(
        "--role",
        default="super_admin",
        choices=["admin", "super_admin"],
    )
    args = parser.parse_args(argv)

    password = os.environ.get("ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Admin password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match", file=sys.stderr)
            return 1
    if len(password) < 12:
        print("Password must be at least 12 characters", file=sys.stderr)
        return 1

    os.environ.setdefault("RIDENOVA_DB_PREFER_HOST", "1")
    reset_engine()
    factory = get_session_factory()
    db = factory()
    try:
        seed_rbac_catalogue(db)
        user = create_user(
            db,
            email=args.email,
            password=password,
            display_name=args.name,
            role_codes=[args.role],
        )
        print(f"created user_id={user.id} email={user.email} roles={[r.code for r in user.roles]}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
