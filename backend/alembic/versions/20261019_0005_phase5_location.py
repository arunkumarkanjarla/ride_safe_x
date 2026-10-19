"""Phase 5 driver location freshness and duty status.

Revision ID: 20261019_0005
Revises: 20261019_0004
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261019_0005"
down_revision: Union[str, None] = "20261019_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "driver_availability",
        sa.Column("duty_status", sa.String(32), nullable=False, server_default="offline"),
    )
    op.add_column(
        "driver_availability",
        sa.Column("location_received_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "driver_availability",
        sa.Column("location_client_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "driver_availability",
        sa.Column("accuracy_m", sa.Numeric(8, 2), nullable=True),
    )
    op.add_column(
        "driver_availability",
        sa.Column("location_seq", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_driver_availability_duty_online",
        "driver_availability",
        ["is_online", "duty_status"],
    )
    # Backfill duty_status from is_online
    op.execute(
        sa.text(
            "UPDATE driver_availability SET duty_status = CASE "
            "WHEN is_online THEN 'available' ELSE 'offline' END"
        )
    )
    # Existing coords: treat updated_at as receipt time for backfill only
    op.execute(
        sa.text(
            "UPDATE driver_availability SET location_received_at = updated_at "
            "WHERE last_lat IS NOT NULL AND last_lon IS NOT NULL"
        )
    )
    op.execute(sa.text("UPDATE schema_meta SET value = '5-location' WHERE key = 'phase'"))


def downgrade() -> None:
    op.drop_index("ix_driver_availability_duty_online", table_name="driver_availability")
    op.drop_column("driver_availability", "location_seq")
    op.drop_column("driver_availability", "accuracy_m")
    op.drop_column("driver_availability", "location_client_at")
    op.drop_column("driver_availability", "location_received_at")
    op.drop_column("driver_availability", "duty_status")
    op.execute(sa.text("UPDATE schema_meta SET value = '4-ops' WHERE key = 'phase'"))
