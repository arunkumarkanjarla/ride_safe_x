# RideSafe X / RideNova — Workflow Map

Generated: 2026-10-19

## 1. Customer ride lifecycle

```
Landing → Create account → OTP → Profile → Permissions → Home
  → Pickup/destination → Vehicle options → Fare quote → Confirm
    → Matching (simulated) → Trip in progress → Complete → Rate → History
```

Cancel / SOS / support ticket can branch from active trip screens.

**Persistence:** active trip state is stored in `ridenova.demo.v1`. Same-origin reload restores the live ride screen; completed/cancelled rides do not restart as REQUESTED.

## 2. Driver lifecycle

```
Phone OTP → Registration → Document upload → Under review
  → (Admin KYC approve/reject) → Training → Home
  → Go online → Incoming request → Accept/Reject
  → Pickup → Start → Complete → Earnings
```

Invalid transitions (e.g. restart completed trip) are blocked in state machines.

## 3. Partner lifecycle

```
Sign-in / onboarding application → Approval progress → Dashboard
  → Menu & hours → Orders/bookings (service type) → Payouts → Reviews
```

## 4. Admin control → apps

```
Admin control.html updates platform.v1 / ops.v1
  → storage/BroadcastChannel → bridges in customer/driver/partner/agent
  → fare tiles, KYC, maintenance, broadcasts, coupons, wallet credits
```

## 5. Agent support

```
Agent code → Queue → Conversation / call simulation → Notes → Resolve
  ↔ Customer support ticket creation (customer app)
```

## 6. Connected demo

`connected-demo/index.html` opens multiple role apps against one shared engine (`ridenova.demo.v1`). Reload restores the scenario; **Reset** clears the key. Same-origin HTTP required (not bare `file://`).

## Simulation boundaries

| Feature | Reality in this demo |
|---|---|
| OTP / SMS | Fixed demo codes; no SMS gateway |
| Payments / UPI PIN | Local UI + wallet balances |
| GPS / map | Visual mock; not live location |
| Calls | UI status + history only |
| Multi-user concurrency | Same-origin tabs only |
