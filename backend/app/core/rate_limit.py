"""Login rate limiting — Redis preferred, in-memory fallback for tests."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from app.core.config import Settings

_lock = Lock()
_memory: dict[str, list[float]] = defaultdict(list)


class RateLimitExceeded(Exception):
    pass


def _memory_hit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    with _lock:
        hits = [t for t in _memory[key] if now - t < window_seconds]
        if len(hits) >= limit:
            _memory[key] = hits
            raise RateLimitExceeded()
        hits.append(now)
        _memory[key] = hits


def check_login_rate_limit(key: str, settings: Settings) -> None:
    limit = settings.login_rate_limit
    window = settings.login_rate_window_seconds
    try:
        import redis

        client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=0.5)
        redis_key = f"ridenova:login:{key}"
        count = client.incr(redis_key)
        if count == 1:
            client.expire(redis_key, window)
        if int(count) > limit:
            raise RateLimitExceeded()
    except RateLimitExceeded:
        raise
    except Exception:
        # Redis unavailable — fall back without failing open unbounded
        _memory_hit(key, limit, window)


def reset_memory_limits() -> None:
    with _lock:
        _memory.clear()
