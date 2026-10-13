# Admin control plane - analysis and design (round 3)

## 1. Problem
RideNova has 5 static apps (customer, driver, partner, admin, agent). Before round 3 every app owned its own data:
fares were hard-coded in the customer app (`VEH` in product-ride.js), coupons in product-account.js, home tiles in
product-core.js, driver KYC was "approved" by a 15 s timer, partner approval by a timer, and the admin portal edited
its own private store (`ridenova.admin.v1`) that no other app read. So nothing an operator changed in admin had any
effect. In a real ride-hailing company (Uber/Ola/Rapido) the opposite is true: **ops and pricing teams run the
marketplace from the admin console** and apps are thin clients of server-driven config.

## 2. How the real platforms do it (what we copy)
| Concern | Real-world pattern | Our static equivalent |
|---|---|---|
| Server-driven config | Versioned config service, apps poll / get pushed, kill-switches | `ridenova.platform.v1` in localStorage, `version` + history, `storage` event + BroadcastChannel push |
| Pricing | Rate cards per city x vehicle: base, per km, per min, minimum fare, booking fee, waiting, night, cancellation; surge per geo-zone with caps; airport fees; GST 5% on rides; take-rate (commission) | `pricing` block per city with the same fields; one shared `RNPC.fare()` used by admin preview **and** customer quote, so they can never disagree |
| Catalog | Products (Bike, Auto, Mini, Sedan, Premier, Rentals, Intercity) toggled per city/zone; super-app tiles ordered by growth team | `services` (home tiles) + `vehicles` with `on`, `order`, `icon`, `badge`, per-zone availability |
| Geo | City -> zones/geofences (airport, surge, no-pickup) | `cities[].zones[]` static list with type, fee, service matrix |
| Promotions | Coupons with budget/limit, validity, min order, cap, category; referral; cashback | `offers.coupons[]`, `offers.referral`, `offers.cashback` |
| Supply | Driver onboarding funnel, KYC doc review with reject reasons, suspend/reactivate, quests, payouts | `ops.kyc`, `ops.drivers`, `drivers.quests`, `drivers.payout` |
| Merchants | Restaurant onboarding approval, menu moderation, commission, payouts | `ops.partnerApps`, `partners.commissionPct`, `ops.menuHidden` |
| Demand | Customer block, wallet adjustments, refunds | `ops.customers`, `ops.wallet[]` ledger (idempotent ids) |
| Live ops | Booking board, reassign/cancel, SOS desk, tickets, broadcasts, maintenance mode, feature flags | `ops.bookings` (mirrored by the customer app), `ops.cmds`, `ops.sos`, `ops.tickets`, `broadcasts[]`, `maintenance`, `flags` |
| Governance | RBAC, maker-checker for money/pricing, immutable audit log, CSV exports | role matrix in `roles`, every write goes through `RNPC.update()` which appends to `audit` |

## 3. Architecture (static, no backend)
```
            +------------------------- admin/control.html (Platform control) -------------------------+
            | tabs: Overview, Services, Pricing(+calculator), Cities & zones, Offers, Drivers, Partners, |
            | Customers, Live ops (bookings/SOS/tickets), Broadcasts, Flags & maintenance, Content,      |
            | Roles, Audit, Config (versions, export/import JSON, reset)                                 |
            +-------------------------------------+-----------------------------------------------------+
                                                  | RNPC.update(fn, meta)  -> version++, audit, save
                                                  v
   shared/platform-config.js (bundled defaults)  localStorage: ridenova.platform.v1 (config)
   shared/platform.js (runtime, RNPC)            localStorage: ridenova.ops.v1      (operational records)
                                                  |  'storage' event + BroadcastChannel('ridenova-platform')
          +------------------+--------------------+--------------------+------------------+
          v                  v                    v                    v                  v
   customer bridge     driver bridge        partner bridge        agent bridge     every app (platform.js):
   fares, tiles,       KYC result, suspend, approval, commission, broadcasts,      broadcast banner,
   coupons, block,     quests, payouts      menu moderation       maintenance      maintenance overlay,
   wallet, bookings                                                                flags
```
* **Two keys.** `platform.v1` = desired state written only by admin (versioned, exportable). `ops.v1` = operational
  records written by both sides (apps publish applications/bookings/SOS; admin writes decisions/commands).
* **Same origin.** Serve the repo root: `py -m http.server 8080` in `D:\git\ride_safe_x` and open
  `http://localhost:8080/admin/control.html`, `/customer-app/` etc. All apps then share localStorage and update live.
  (Chrome `file://` pages also share one storage origin, which is what the headless tests use.)
* **Bundled default.** `shared/platform-config.js` sets `window.RN_PLATFORM_DEFAULT`. If no admin config is stored, apps
  run on it. Admin "Export" downloads the current JSON; "Import" validates and applies it; "Reset" goes back to the bundle.
* **Live update.** `RNPC.on(fn)` fires for local writes and for writes in other tabs. Bridges re-render the visible
  screen (unless the user is typing) so an open customer app shows a new fare / hides a tile within a second.
* **Idempotency.** Wallet credits and booking commands carry ids; apps record applied ids so a reload never double-credits.
* **Security note.** This is a demo: localStorage is not a trust boundary. In production every rule here is enforced
  server-side and the client only renders it.

## 4. Data model (abridged)
```
config = { schema:1, version, updatedAt, updatedBy, history:[{v,at,by,note}],
  services:[{id,label,icon,go,arg,badge,on,order}],
  vehicles:[{id,label,icon,on,order,seats,note}],
  pricing:{ taxPct, currency:'INR', cities:{ HYD:{ Bike:{base,perKm,perMin,minFare,bookingFee,freeWaitMin,waitPerMin,
           cancelFee,nightPct,commissionPct}, ...}}, night:{from:23,to:5}, surge:{cap, rules:[{zone,mult,from,to,on}]} },
  cities:[{id,name,on,zones:[{id,name,type,on,fee,services:{Cab:true..}}]}], defaultCity:'HYD',
  offers:{coupons:[{code,title,sub,cat,pct|flat,cap,min,limit,used,ends,on}], referral:{referrerPaise,refereePaise}, cashback:{pct,capPaise}},
  drivers:{kycAutoApproveSecs, quests:[...], payout:{minPaise,feePaise}},
  partners:{commissionPct, autoApproveSecs, payoutCycle},
  broadcasts:[{id,apps:[],tone,text,on,ends}], flags:{...}, maintenance:{customer,driver,partner,agent,message},
  content:{terms, faqs:[{q,a}], supportPhone}, roles:{ROLE:[perm...]} }
ops = { kyc:{phone:{status,name,city,vehicle,docs,reason,at,by}}, drivers:{phone:{status,reason}},
  customers:{phone:{name,blocked,reason,seen}}, wallet:[{id,phone,paise,note,kind,at}], partnerApps:{id:{biz,email,status,reason}},
  menuHidden:{itemName:reason}, bookings:{id:{...}}, cmds:[{id,booking,action,driver,reason}], sos:{id:{...}}, tickets:[...], audit:[...] }
```

## 5. Fare formula (shared `RNPC.fare`)
`subtotal = base + perKm*km + perMin*min + bookingFee`; `subtotal = max(subtotal, minFare)`;
night (23:00-05:00 by default) `+ nightPct%`; surge = best matching active zone rule for the hour, capped at `surge.cap`;
airport zone fee added; coupon applied by the app (category rules, min order, cap, limit, expiry from admin); `GST taxPct` on
the discounted amount. Commission (take-rate) is shown to the admin per vehicle (driver net = fare - tax - commission).

## 6. What each app reads
* **Customer:** vehicle list + fares (R09/R10/R07), home tiles (R29), coupons (R22 and at checkout), broadcasts, maintenance,
  blocked account screen, wallet credits/refunds, booking cancel/reassign commands, referral amount, support content.
* **Driver:** KYC decision (approve -> can go online; reject with reason -> back to documents), suspension (engine
  `blocked`, forced offline), quests and payout rules, broadcasts, maintenance.
* **Partner:** application approval/rejection, commission %, menu moderation, broadcasts, maintenance.
* **Agent portal:** broadcasts, maintenance, open SOS/ticket counts, FAQs.

## 7. Testing
`docs-analysis/test-admin-control.js` opens admin control and the apps in the same browser (shared storage) and checks:
price change -> customer fare changes; service off -> tile hidden; vehicle off -> option hidden; suspend driver -> cannot go
online; manual KYC approve -> driver proceeds, reject -> reason shown; broadcast -> banner in apps; coupon expire -> rejected;
maintenance -> overlay; export/import round trip; audit entries written.
