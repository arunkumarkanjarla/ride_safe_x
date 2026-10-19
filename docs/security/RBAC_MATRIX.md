# RideNova — RBAC Matrix (Phase 2–4)

Permissions are stable string codes enforced **only on the server**. Frontend menus are UX only.

## Permissions

| Code | Description | Since |
|---|---|---|
| `profile.read_self` | Read own profile | 2 |
| `profile.update_self` | Update own profile | 2 |
| `users.read` | Read other users (ops) | 2 |
| `users.manage` | Activate/deactivate users, privileged profile edits | 2 |
| `roles.read` | List roles | 2 |
| `roles.manage` | Assign/remove roles on users | 2 |
| `permissions.read` | List permissions | 2 |
| `audit.read` | Read audit events | 2 |
| `bookings.create_self` | Create own bookings | 3 |
| `bookings.read_self` | Read own bookings | 3 |
| `bookings.cancel_self` | Cancel own eligible bookings | 3 |
| `bookings.read` | Read any booking (ops) | 3 |
| `bookings.cancel` | Cancel any eligible booking (ops) | 4 |
| `drivers.availability_self` | Set own driver availability / location | 3 |
| `drivers.offers_self` | View/respond to own offers | 3 |
| `drivers.trips_self` | Manage own assigned trips | 3 |
| `drivers.read` | Read driver readiness (ops) | 5 |
| `dispatch.read` | Read dispatch offers / unassigned reasons (ops) | 4 |
| `dispatch.retry` | Retry dispatch for eligible bookings | 4 |
| `dispatch.manage` | Reserved for future manual dispatch | 3 |

## Role → permission (seed)

| Role code | Permissions |
|---|---|
| `customer` | profile.*, bookings.create_self, bookings.read_self, bookings.cancel_self |
| `driver` | profile.*, drivers.availability_self, drivers.offers_self, drivers.trips_self |
| `partner` | profile.* |
| `support_agent` | profile.*, users.read, audit.read, bookings.read, dispatch.read, drivers.read |
| `admin` | profile.*, users.*, roles.read, permissions.read, audit.read, bookings.read, bookings.cancel, drivers.read, dispatch.read, dispatch.retry, dispatch.manage |
| `super_admin` | all permissions |

Users may hold **multiple roles**; effective permissions are the union.

## Object-level rules

- `GET/PATCH /users/{id}`: self with profile permission, or ops with `users.read` / `users.manage`.
- Customer booking APIs: actor must own the booking (or assigned driver for trip views).
- `/ops/*`: `bookings.read` for list/detail; `dispatch.read` for offer enrichment; `dispatch.retry` / `bookings.cancel` for mutations.
- Audit: read with `audit.read`; **no** client write/delete API.
- Manual driver assignment: **deferred** (not exposed).
