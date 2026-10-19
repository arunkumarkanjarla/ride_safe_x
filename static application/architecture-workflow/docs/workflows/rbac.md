# Mock roles and permissions (demonstration only)

> **This is not authorization.** Role switching happens in the browser, the role matrix is a public JavaScript
> file and the stored demo state can be edited by anyone. The production platform must enforce every permission
> on the server (architecture page 10: "Permissions are checked in every service, never only in the UI").

Source: `assets/js/rn-rbac.js`.

## Matrix from architecture page 10 (implemented as written)

| Permission | Super admin | Ops manager | Safety manager | Fraud analyst | Finance manager | Support agent | Fleet manager | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ride.view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ride.cancel | ✓ | ✓ | · | · | · | ✓ | · | · |
| driver.verify | ✓ | ✓ | · | · | · | · | · | · |
| payment.refund | ✓ | · | · | · | ✓ | ✓ | · | · |
| incident.view | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ |
| incident.close | ✓ | · | ✓ | · | · | · | · | · |
| fraud.block_account | ✓ | · | · | ✓ | · | · | · | · |
| pricing.edit | ✓ | ✓ | · | · | · | · | · | · |
| report.export | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ |
| government_report.create | ✓ | · | ✓ | · | · | · | · | · |
| government_report.approve | ✓ | · | · | · | · | · | · | · |
| audit.view | ✓ | · | · | · | · | · | · | ✓ |
| user.pii.view_full | ✓ | · | ✓ | · | · | · | · | · |

## Assumptions added for admin actions the matrix does not cover (need approval)

| Permission | Roles assumed | Used by |
| --- | --- | --- |
| incident.handle (acknowledge, work, escalate, resolve) | Super admin, Ops manager, Safety manager | A13, A04 *Open incident* |
| ticket.resolve | Super admin, Ops manager, Support agent | A12 *Resolve* |
| coupon.create | Super admin, Ops manager, Finance manager | A28 *Create* |
| campaign.send | Super admin, Ops manager | A21 *Schedule* |
| partner.approve | Super admin, Ops manager | A24 *Approve / Reject* |
| coverage.publish | Super admin, Ops manager | A25 *Publish to apps* |
| config.edit | Super admin | A20 *New role*, A22 *Save changes* |

## Behaviour in the prototype

* The default demo role is **Operations manager** (Priya K.); Scenario J starts as **Support agent**.
* Every permission-checked attempt is appended to the in-browser audit list with `allowed` / `denied`.
* A19 (audit log) blurs its content and shows *Access denied* for roles without `audit.view`.
* Not modelled: row-level rules (fleet managers seeing only their fleet), PII masking by role, session expiry,
  separation of duties (two approvers for fee changes).
