"""Background RabbitMQ → WebSocket fanout consumer (API process)."""

from __future__ import annotations

import asyncio
import json
import logging
import threading

logger = logging.getLogger("ridenova.events_consumer")


def start_events_consumer(rabbitmq_url: str, hub, loop: asyncio.AbstractEventLoop) -> threading.Thread:
    def _run() -> None:
        try:
            import pika
        except ImportError:
            logger.warning("pika not available; WS fanout via RabbitMQ disabled")
            return
        while True:
            try:
                params = pika.URLParameters(rabbitmq_url)
                connection = pika.BlockingConnection(params)
                channel = connection.channel()
                channel.exchange_declare(
                    exchange="ridenova.events", exchange_type="topic", durable=True
                )
                result = channel.queue_declare(queue="", exclusive=True)
                queue_name = result.method.queue
                channel.queue_bind(
                    exchange="ridenova.events", queue=queue_name, routing_key="booking.#"
                )

                def on_message(_ch, _method, _properties, body: bytes) -> None:
                    try:
                        event = json.loads(body.decode("utf-8"))
                    except Exception:
                        logger.exception("bad_event_payload")
                        return
                    fut = asyncio.run_coroutine_threadsafe(hub.fanout(event), loop)
                    try:
                        fut.result(timeout=5)
                    except Exception:
                        logger.exception("fanout_failed")

                channel.basic_consume(
                    queue=queue_name, on_message_callback=on_message, auto_ack=True
                )
                logger.info("events_consumer_started queue=%s", queue_name)
                channel.start_consuming()
            except Exception:
                logger.exception("events_consumer_restart")
                try:
                    import time

                    time.sleep(15)
                except Exception:
                    return

    thread = threading.Thread(target=_run, name="ridenova-events-consumer", daemon=True)
    thread.start()
    return thread
