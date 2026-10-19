"""Publish transactional outbox events to RabbitMQ; expire stale offers."""

from __future__ import annotations

import logging
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("ridenova.outbox_worker")


def main() -> None:
    from app.core.config import get_settings
    from app.core.db import get_session_factory, reset_engine
    from app.services.dispatch import expire_due_offers
    from app.services.outbox import publish_pending

    settings = get_settings()
    logger.info("outbox_worker_started")
    while True:
        try:
            reset_engine()
            factory = get_session_factory()
            db = factory()
            try:
                expired = expire_due_offers(db, commit=True)
                published = publish_pending(db, settings.rabbitmq_url, limit=50)
                from app.services.notifications import process_pending_notifications

                notified = process_pending_notifications(db, limit=50)
                if expired or published or notified:
                    logger.info(
                        "tick expired=%s published=%s notifications=%s",
                        expired,
                        published,
                        notified,
                    )
            finally:
                db.close()
        except Exception:
            logger.exception("outbox_worker_tick_failed")
        time.sleep(2)


if __name__ == "__main__":
    main()
