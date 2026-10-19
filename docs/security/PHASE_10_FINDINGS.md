# Phase 10 security findings (sanitized)

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-01 | High | Production + `PAYMENTS_SANDBOX_ENABLED=true` must be rejected | **Fixed** — Settings validator (Phase 9) + regression `test_production_rejects_sandbox_enabled` |
| S-02 | High | Sandbox payment routes in production | **Fixed** — `sandbox_payments_allowed()` false in production |
| S-03 | Medium | Running worker image used Phase-1 heartbeat instead of outbox publisher | **Closed (Phase 11)** — container recreated; running cmd `workers.outbox_publisher`, healthy, publish ticks observed |
| S-04 | Medium | Health responses must not leak DB URLs / JWT | **Verified** — health/ready assertions |
| S-05 | Medium | Cross-user IDOR on payments/notifications/bookings | **Verified** — existing Phase 6–9 tests remain green |
| S-06 | Low | `__version__` drifted from API description | **Fixed** — `0.10.0` |
| S-07 | Info | No formal penetration test performed | Accepted — document only |
| S-08 | Info | CI lacks private PostgreSQL / RabbitMQ secrets | Accepted — local integration path documented |

No live payment credentials or provider secrets were introduced.
