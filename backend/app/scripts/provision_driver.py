"""Provision an eligible test driver (controlled; not a public endpoint).

Usage:
  python -m app.scripts.provision_driver --email driver@example.com --password '...' \\
      --lat 17.385 --lon 78.4865 [--online]
"""

from __future__ import annotations

import argparse
import sys

from app.core.config import get_settings
from app.core.db import get_session_factory, reset_engine
from app.services.auth import create_user
from app.services.dispatch import get_or_create_driver_profile, set_availability
from app.services.seed import seed_rbac_catalogue


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Provision eligible RideNova test driver")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Test Driver")
    parser.add_argument("--vehicle", default="Cab")
    parser.add_argument("--lat", type=float, default=17.3850)
    parser.add_argument("--lon", type=float, default=78.4867)
    parser.add_argument("--online", action="store_true")
    args = parser.parse_args(argv)

    get_settings.cache_clear()
    reset_engine()
    db = get_session_factory()()
    try:
        seed_rbac_catalogue(db)
        user = create_user(
            db,
            email=args.email,
            password=args.password,
            display_name=args.name,
            role_codes=["driver"],
        )
        profile = get_or_create_driver_profile(db, user.id, vehicle_type=args.vehicle)
        profile.vehicle_type = args.vehicle
        profile.status = "eligible"
        db.commit()
        if args.online:
            set_availability(db, profile, is_online=True, lat=args.lat, lon=args.lon)
        print(f"driver_user_id={user.id}")
        print(f"driver_profile_id={profile.id}")
        print(f"email={user.email}")
        print(f"online={args.online}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
