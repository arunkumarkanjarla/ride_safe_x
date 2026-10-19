"""Phase 4 ops indexes and schema marker.

Revision ID: 20261019_0004
Revises: 20261019_0003

Permissions are seeded at API startup (no table DDL for RBAC catalogue).
Adds composite index to support ops list filters.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261019_0004"
down_revision: Union[str, None] = "20261019_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_bookings_status_created",
        "bookings",
        ["status", "created_at"],
        unique=False,
    )
    op.execute(sa.text("UPDATE schema_meta SET value = '4-ops' WHERE key = 'phase'"))


def downgrade() -> None:
    op.drop_index("ix_bookings_status_created", table_name="bookings")
    op.execute(sa.text("UPDATE schema_meta SET value = '3-booking' WHERE key = 'phase'"))
