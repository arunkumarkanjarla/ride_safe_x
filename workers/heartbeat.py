"""Phase 1 worker: verify Redis/RabbitMQ reachability and idle with health logging."""

from __future__ import annotations

import logging
import os
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ridenova.worker")


def ping_redis(url: str) -> bool:
    import redis

    client = redis.Redis.from_url(url, socket_connect_timeout=5)
    return bool(client.ping())


def ping_rabbitmq(url: str) -> bool:
    import pika

    params = pika.URLParameters(url)
    params.socket_timeout = 5
    connection = pika.BlockingConnection(params)
    connection.close()
    return True


def main() -> None:
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    rabbit_url = os.getenv("RABBITMQ_URL", "amqp://ridenova:ridenova@rabbitmq:5672/")
    interval = int(os.getenv("WORKER_HEARTBEAT_SECONDS", "30"))

    log.info("worker starting (phase1 heartbeat)")
    while True:
        try:
            redis_ok = ping_redis(redis_url)
            log.info("redis_ping=%s", redis_ok)
        except Exception as exc:  # noqa: BLE001
            log.warning("redis_ping_failed error=%s", type(exc).__name__)

        try:
            rabbit_ok = ping_rabbitmq(rabbit_url)
            log.info("rabbitmq_ping=%s", rabbit_ok)
        except Exception as exc:  # noqa: BLE001
            log.warning("rabbitmq_ping_failed error=%s", type(exc).__name__)

        time.sleep(interval)


if __name__ == "__main__":
    main()
