"""Phase 9 payments foundation (sandbox).

Revision ID: 20261019_0007
Revises: 20261019_0006
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20261019_0007"
down_revision: Union[str, None] = "20261019_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("amount_paise", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("gateway", sa.String(32), nullable=False, server_default="sandbox"),
        sa.Column("gateway_ref", sa.String(128), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("failure_category", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("succeeded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "customer_id",
            "idempotency_key",
            name="uq_payment_customer_idempotency",
        ),
        sa.UniqueConstraint("gateway_ref", name="uq_payment_gateway_ref"),
    )
    op.create_index("ix_payments_booking", "payments", ["booking_id"])
    op.create_index("ix_payments_customer_created", "payments", ["customer_id", "created_at"])
    op.execute(
        sa.text(
            "CREATE UNIQUE INDEX uq_payment_booking_succeeded "
            "ON payments (booking_id) WHERE status = 'SUCCEEDED'"
        )
    )

    op.create_table(
        "payment_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("payments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_status", sa.String(32), nullable=True),
        sa.Column("to_status", sa.String(32), nullable=False),
        sa.Column("reason", sa.String(64), nullable=True),
        sa.Column(
            "actor_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("gateway_event_key", sa.String(128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("gateway_event_key", name="uq_payment_event_gateway_key"),
    )
    op.create_index("ix_payment_events_payment", "payment_events", ["payment_id", "created_at"])

    op.execute(
        sa.text(
            "UPDATE schema_meta SET value = '9-payments' WHERE key = 'phase'"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_payment_events_payment", table_name="payment_events")
    op.drop_table("payment_events")
    op.execute(sa.text("DROP INDEX IF EXISTS uq_payment_booking_succeeded"))
    op.drop_index("ix_payments_customer_created", table_name="payments")
    op.drop_index("ix_payments_booking", table_name="payments")
    op.drop_table("payments")
    op.execute(
        sa.text(
            "UPDATE schema_meta SET value = '8-notifications' WHERE key = 'phase'"
        )
    )
