"""Phase 3 booking, dispatch, outbox.

Revision ID: 20261019_0003
Revises: 20261019_0002
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261019_0003"
down_revision: Union[str, None] = "20261019_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "driver_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vehicle_type", sa.String(32), nullable=False, server_default="Cab"),
        sa.Column("status", sa.String(32), nullable=False, server_default="eligible"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_driver_profiles_user"),
    )
    op.create_table(
        "driver_availability",
        sa.Column("driver_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("driver_profiles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("is_online", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_lat", sa.Numeric(10, 7)),
        sa.Column("last_lon", sa.Numeric(10, 7)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("vehicle_type", sa.String(32), nullable=False, server_default="Cab"),
        sa.Column("pickup_lat", sa.Numeric(10, 7), nullable=False),
        sa.Column("pickup_lon", sa.Numeric(10, 7), nullable=False),
        sa.Column("drop_lat", sa.Numeric(10, 7), nullable=False),
        sa.Column("drop_lon", sa.Numeric(10, 7), nullable=False),
        sa.Column("distance_km", sa.Numeric(10, 3), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("estimate_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("assigned_driver_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("driver_profiles.id", ondelete="SET NULL")),
        sa.Column("cancel_reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("customer_id", "idempotency_key", name="uq_bookings_customer_idem"),
    )
    op.create_index("ix_bookings_customer_created", "bookings", ["customer_id", "created_at"])
    op.create_index("ix_bookings_status", "bookings", ["status"])

    op.create_table(
        "booking_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_status", sa.String(32)),
        sa.Column("to_status", sa.String(32), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_booking_events_booking", "booking_events", ["booking_id"])

    op.create_table(
        "driver_offers",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("driver_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("driver_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("booking_id", "driver_profile_id", name="uq_offer_booking_driver"),
    )
    op.create_index("ix_driver_offers_driver_status", "driver_offers", ["driver_profile_id", "status"])

    op.create_table(
        "trip_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("driver_profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("driver_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("offer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("driver_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("booking_id", name="uq_assignment_booking"),
    )

    op.create_table(
        "outbox_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("aggregate_type", sa.String(64), nullable=False),
        sa.Column("aggregate_id", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("publish_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_outbox_unpublished", "outbox_events", ["published_at", "created_at"])

    # PostGIS helper index for availability points when coords present (expression optional)
    op.execute(
        """
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
            ALTER TABLE driver_availability
              ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
          END IF;
        END $$;
        """
    )

    op.execute(sa.text("UPDATE schema_meta SET value = '3-booking' WHERE key = 'phase'"))


def downgrade() -> None:
    op.execute("ALTER TABLE driver_availability DROP COLUMN IF EXISTS location")
    op.drop_table("outbox_events")
    op.drop_table("trip_assignments")
    op.drop_table("driver_offers")
    op.drop_table("booking_events")
    op.drop_table("bookings")
    op.drop_table("driver_availability")
    op.drop_table("driver_profiles")
