# RideSafe X / RideNova — Role × Page Matrix

Generated: 2026-10-19

Status legend: **Working** = navigable + actions persist / validated by automated suites (2026-10-19).

## Public

| Capability | Entry | Status |
|---|---|---|
| Landing hub | `index.html` | Working |
| Connected multi-app demo | `connected-demo/index.html` | Working |
| Architecture wireframes | `architecture-workflow/` | Working (reference only) |

## Customer

| Capability | Screen area (ids) | Status | Notes |
|---|---|---|---|
| Register / login / OTP | R02–R06, R58 | Working | Inline validation; demo OTP |
| Home / services | R29 | Working | Ride, bike, auto, long trip, food, parcel, etc. |
| Book ride + fare estimate | R07–R10 | Working | Simulated map/route; fare via RNPC |
| Trip progress / complete | R10–R18 | Working | Simulated assignment; reload resumes via `ridenova.demo.v1` |
| History / wallet / offers | R19–R22, R54 | Working | |
| Support / tickets / notifications | R26–R27, R56 | Working | Simulated chat/bot |
| Profile / settings / UX | R28 | Working | Dark mode, language |
| Food / hotel / bus / rental / parcel | R33–R48 | Working | Extended marketplace demos |

## Driver

| Capability | Status | Notes |
|---|---|---|
| Registration + docs upload preview | Working | Local file preview only |
| Demo verification / approval | Working | Admin KYC queue / auto-approve flag |
| Online/offline | Working | Blocked when suspended |
| Accept / reject / trip states | Working | State machine enforced; active trip resumes after reload |
| Earnings / wallet / quests | Working | Config-driven |
| Trip history / account | Working | |

## Partner (`patner-app`)

| Capability | Status | Notes |
|---|---|---|
| Onboarding + approval | Working | Stages via admin config |
| Menu CRUD / pause / hours | Working | |
| Payouts / reviews / bank | Working | Commission from admin |
| Settings | Working | |

## Administrator

| Capability | Entry | Status |
|---|---|---|
| Ops portal (A-screens) | `admin/index.html` | Working |
| Platform control | `admin/control.html` | Working |
| Customers / drivers / partners / pricing / refunds / fraud / RBAC | Working | Permission matrix; A05 credit/block + A11 refunds sync to `ridenova.ops.v1` (P0) |
| Metrics | Working | Derived from demo + ops data |

## Support agent

| Capability | Status | Notes |
|---|---|---|
| Sign-in + workspace | Working | |
| Queue / conversations / calls (simulated) | Working | No real telephony |
| Persistence | Working | `ridenova.agent.v1` |

## Cross-role rules

| Rule | Status |
|---|---|
| Customer booking visible across connected demo / ops | Working (same origin) |
| Driver KYC decision updates driver app | Working |
| Fare / coupon / maintenance / broadcasts from admin | Working |
| Multi-device sync | **N/A** (browser localStorage only) |
