# RideNova — Phase 8 Report (In-App Notifications)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Starting HEAD:** `92344167438834bb1a972295f47fa10e6547673a`  
**Ending HEAD:** same (no commit requested)  
**Starting migration head:** `20261019_0005` (`5-location`)  
**Ending migration head:** `20261019_0006` (`8-notifications`)  
**Gate verdict:** **CONDITIONAL PASS**  
**Commit:** none  
**BMAD:** External `D:\git\bmad_project` agent rules used; stories `docs/stories/8.*`; no BMAD install into RideNova

---

## 1. Verdict

**CONDITIONAL PASS**

Persisted in-app notifications are created from authoritative outbox events for the correct recipients, with idempotent duplicate handling, ownership-enforced APIs, unread/read state, optional recipient-scoped WS hints, and client inboxes on customer/driver/portal (partner empty-state). Full backend + frontend checks pass.

**Conditional** because:

- Multi-replica RabbitMQ/WS topology and live outbox-worker integration were not exercised end-to-end in this session (materialization covered via post-commit + unit/integration API tests; worker code path present).
- Phase 5–7 physical-device GPS / trip UI verification remains outstanding (unchanged).
- No SMS/FCM/email channels (explicitly out of scope).

---

## 2. Git status

Working tree remains dirty with Phase 1–8 uncommitted work; `static application/` preserved. No reset/stash/revert. No commit.

---

## 3. Migration

Forward-only `20261019_0006_phase8_notifications.py`:

- `notifications` (+ unique `(source_event_id, recipient_user_id)`, recipient indexes)
- `notification_processing_failures`
- `outbox_events.notifications_processed_at`
- `schema_meta.phase` → `8-notifications`

Upgrade verified: `alembic upgrade head` and `tests/test_migrations.py`.

---

## 4. Files / endpoints / events / permissions

### Permissions

| Code | Roles |
|---|---|
| `notifications.read_self` | customer, driver, partner, support_agent, admin |
| `notifications.update_self` | same |
| `notifications.ops_health` | support_agent, admin, super_admin |

### APIs

| Method | Path |
|---|---|
| GET | `/notifications` (page, unread filter) |
| GET | `/notifications/unread-count` |
| POST | `/notifications/{id}/read` |
| POST | `/notifications/read-bulk` |
| POST | `/notifications/read-all` |
| GET | `/ops/notifications/health` |

### Events → recipients

See `docs/architecture/NOTIFICATION_EVENTS.md` (`booking.created`, `offer.created`, `offer.accepted`, `dispatch.exhausted`, `booking.cancelled`, lifecycle `booking.status_changed` actions).

### Key code

- `backend/app/services/notifications.py` — materializer, list/read, ops health
- `backend/app/api/notifications.py`
- `backend/app/services/outbox.py` — process notifications in publish tick
- `workers/outbox_publisher.py` — notification tick
- `apps/*` inbox UIs; contracts `0.8.0`

---

## 5. Idempotency & reliability design

- **Source of truth:** PostgreSQL `notifications`
- **Idempotency key:** `UNIQUE (source_event_id, recipient_user_id)` + `ON CONFLICT DO NOTHING`
- **At-least-once:** post-commit materialize + worker `process_pending_notifications` + re-materialize before Rabbit publish
- **Not exactly-once** RabbitMQ (documented)
- **WS:** `notification.created` only to `recipient_user_id`; failure does not roll back rows
- **Failures:** `notification_processing_failures` stores category/attempt only (no secrets/stacks)

---

## 6. Retry / ack behavior

- Outbox publish: mark published after successful Rabbit publish; bump attempts on failure
- Notification materialize: set `notifications_processed_at` after durable inserts; retry pending on next worker tick
- Rabbit API consumer remains auto-ack for WS fanout only (unchanged Phase 3); notifications do **not** rely on that consumer for persistence

---

## 7. Tests

### Backend

```powershell
cd D:\git\ride_safe_x\backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\python.exe -m pytest -q --tb=line
```

**Result:** `64 passed in 354.04s` (0 failures)

Targeted: `tests/test_notifications.py` + `test_migrations.py` → 4 passed.

### Frontend

| Command | Result |
|---|---|
| `packages/contracts` `npm run check` | pass |
| `apps/customer_mobile` `npm run check` | pass |
| `apps/driver_mobile` `npm run check` | pass |
| `apps/partner_mobile` `npm run check` | pass |
| `apps/web_portal` `npm run build` | pass |

### Phase 1–7 regression

Included in the 64-pass suite (auth, booking, dispatch, ops, location, customer summary, trip lifecycle, migrations).

---

## 8. Security / isolation evidence

- `test_notifications_from_booking_lifecycle`: other customer cannot see booking notifications; mark-read cross-user → 403/404; customer denied ops health → 403
- Recipient always from session; never from client-supplied user id

---

## 9. Topology actually tested

| Component | Tested? |
|---|---|
| PostgreSQL | Yes (integration tests + migration upgrade) |
| Notification materialize (post-commit / process_pending) | Yes |
| RabbitMQ live publish + worker loop | Code present; **not** live E2E in this session |
| Redis | Not required for notifications |
| WebSocket recipient hint | Unit path via hub targeting; **not** multi-replica |
| Physical device | **Not** performed |

---

## 10. Deferred / risks

- Push/SMS/email providers
- Live multi-instance WS delivery guarantees
- Partner domain events (empty inbox only)
- Phase 5–7 device GPS / trip UI verification
- Exactly-once messaging
- Phase 9+ not started

---

## 11. BMAD

- Stories authored under `docs/stories/8.*`
- Catalogue ADR-014 + `NOTIFICATION_EVENTS.md`
- No BMAD CLI invented; external install only

---

## 12. Definition of done

| Criterion | Status |
|---|---|
| Domain events → persisted notifications | Met |
| Duplicate delivery safe | Met (unique key + tests) |
| Retry / restart safe materialize | Met (processed_at + pending processor) |
| Ownership APIs | Met |
| Unread/read persisted | Met |
| WS hint after persist; REST recovery | Met |
| Client inboxes (cust/drv/portal; partner empty) | Met |
| Ops health without secrets | Met |
| Migration from 0005 | Met |
| Checks pass | Met (64 + FE) |
| Docs accurate | Met |

**Stop:** Phase 9 not started. Awaiting explicit user approval.
