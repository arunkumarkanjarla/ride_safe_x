# Backend readiness checklist

Backend work starts only after the workflows are approved. This list records what the prototype already settles
and what must be decided before backend planning. Tick items during the review.

## Decisions needed (from the prototype review)

- [ ] Approve the ride state machine as implemented (13 states; [state-machines.md](../workflows/state-machines.md)) or the simplified names in the brief
- [ ] Cancellation fee, waiting charge (D09 says ₹1/min after 3 min) and no-show rules
- [ ] Payment failure policy: retry count/timing, driver payout when the rider's payment fails, debt limits
- [ ] Refund authority and limits; partial refunds; two-person approval where required
- [ ] SOS: who may close or mark false alarm; rider cancellation of SOS; driver notification
- [ ] KYC: rejection reasons, re-submission limits, document expiry grace periods
- [ ] Food: liability for rejections after acceptance, cancellation windows, cold-food complaints
- [ ] Role matrix extensions in [rbac.md](../workflows/rbac.md) (incident handling, tickets, coupons, campaigns, partners, coverage, configuration)
- [ ] Missing screens to design: saved addresses, driver account, partner settings/support, admin rides list
- [ ] Mobile stack: the blueprint says Flutter, the brief says React Native/Expo
- [ ] Deployment target: Docker Compose (brief) vs Kubernetes (architecture page 13)

## Contracts the prototype already describes

- [x] Screen list (118) with purpose, controls, entry points and next screens ([screen-image-mapping.md](../analysis/screen-image-mapping.md))
- [x] Endpoints and events per screen (from the specifications, shown on every screen page)
- [x] State machines for ride, offer, payment, incident, food order, KYC, driver availability
- [x] Guards and error messages for each command (`assets/js/rn-engine.js`), usable as API acceptance criteria
- [x] Idempotency for repeated submissions (successful commands only) and offline queue/replay semantics
- [x] Event names used in the event history (align with the Kafka topic list on architecture page 12)
- [x] Demo scenarios A–J as acceptance scenarios for the future API and apps

## Engineering prerequisites before backend coding

- [ ] Choose the API style per endpoint (REST/WebSocket) and write OpenAPI from the screen specs
- [ ] Data model from architecture page 11, mapped to the prototype state keys
- [ ] Real authentication (OTP provider, OIDC + MFA for staff) and server-side RBAC
- [ ] Integration sandboxes: payment gateway, SMS/WhatsApp, maps, KYC, Asterisk (test accounts only)
- [ ] Security headers and CSP from the server; secret management; logging/audit design
- [ ] CI pipeline running the existing static, engine and browser tests
