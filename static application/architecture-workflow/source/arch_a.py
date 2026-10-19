from archlib import *

PAGES = []

# ============================================================ 00 How it works
def p00():
    nodes = [
        dict(id="r0", t="Choose destination", c=0, r=0, k="actor"),
        dict(id="r1", t="Confirm booking", c=0, r=1, k="actor"),
        dict(id="r3", t="Watch driver arrive", s="call · chat", c=0, r=3, k="actor"),
        dict(id="r4", t="Share 4-digit OTP", c=0, r=4, k="actor"),
        dict(id="r5", t="Ride with SOS ready", s="share trip", c=0, r=5, k="actor"),
        dict(id="r6", t="Pay & rate", c=0, r=6, k="actor"),
        dict(id="p0", t="Fare estimate", s="Maps route + surge", c=1.2, r=0, k="acc"),
        dict(id="p1", t="Create ride", s="lock fare 5 min", c=1.2, r=1, k="acc"),
        dict(id="p2", t="Dispatch", s="find & offer drivers", c=1.2, r=2, k="acc"),
        dict(id="p3", t="Stream location", s="WebSocket", c=1.2, r=3, k="acc"),
        dict(id="p4", t="Verify OTP", s="TRIP_STARTED", c=1.2, r=4, k="acc"),
        dict(id="p5", t="Monitor trip", s="route deviation · SOS", c=1.2, r=5, k="alert"),
        dict(id="p6", t="Charge · invoice", s="driver earning", c=1.2, r=6, k="acc"),
        dict(id="d1", t="Online, sharing GPS", s="every 10 s", c=2.4, r=1, k="n"),
        dict(id="d2", t="Accept offer", s="15 s to decide", c=2.4, r=2, k="n"),
        dict(id="d3", t="Drive to pickup", c=2.4, r=3, k="n"),
        dict(id="d4", t="Enter rider OTP", c=2.4, r=4, k="n"),
        dict(id="d5", t="Navigate trip", c=2.4, r=5, k="n"),
        dict(id="d6", t="End trip, collect", c=2.4, r=6, k="n"),
    ]
    edges = [
        dict(a="r0", b="p0", l="destination"), dict(a="r1", b="p1", l="book"),
        dict(a="p0", b="p1"), dict(a="p1", b="p2"),
        dict(a="p2", b="d2", l="offer", k="acc"),
        dict(a="d3", b="p3", l="GPS"), dict(a="p3", b="r3", l="live position", k="acc"),
        dict(a="d4", b="p4", l="OTP"), dict(a="p4", b="r4", l="trip started", k="acc"),
        dict(a="d5", b="p5", l="GPS"), dict(a="p5", b="r5", l="alerts", k="alert"),
        dict(a="d6", b="p6", l="end trip"), dict(a="p6", b="r6", l="receipt", k="acc"),
    ]
    svg = flow(nodes, edges, groups=[("Rider app", 0, 0, 0, 6), ("Platform", 1.2, 0, 1.2, 6, "acc"), ("Driver app", 2.4, 1, 2.4, 6, "info")],
               cw=230, rh=86, bw=180, bh=52, title="One ride across the three parts of the system")
    rows = [
        ("1. Sign up", f"Phone + OTP login, profile, emergency contacts<br>{S('R03')}, {S('R04')}", f"Register, upload licence, RC, insurance, permit<br>{S('D02')}, {S('D03')}",
         "Auth issues JWT + refresh token. Driver documents go to MinIO and into the KYC review queue.", ""),
        ("2. Driver goes online", "—", f"Toggles Online after checks pass<br>{S('D06')}",
         "Driver position written to the Redis geo index every few seconds. Heat map of demand shown to the driver.", ""),
        ("3. Rider picks a destination", f"Searches place, sees fares per vehicle<br>{S('R08')}, {S('R09')}", "—",
         "Maps adapter returns route, distance and ETA. Pricing applies base fare, per-km, per-minute and zone surge.", ""),
        ("4. Booking", f"Confirms pickup and payment method<br>{S('R10')}, {S('R11')}", "—",
         "Ride created as REQUESTED with an idempotency key. Event <code>ride.requested</code> published.", ""),
        ("5. Matching", "Sees search animation", f"Gets an offer with pickup, drop and fare<br>{S('D07')}",
         "Dispatch searches nearby drivers, filters and scores them, locks one driver and sends a 15 s offer.", ""),
        ("6. Driver on the way", f"Driver photo, car, plate, OTP, live ETA<br>{S('R12')}", f"Navigates to pickup<br>{S('D08')}",
         "Ride becomes DRIVER_ACCEPTED. Location streamed to the rider over WebSocket.", ""),
        ("7. Contact", f"Masked call or chat<br>{S('R13')}, {S('R14')}", "Same, from the trip screen",
         "Telephony bridges the call through Asterisk with a proxy number so neither side sees the real number.", ""),
        ("8. Pickup", "Tells the driver the OTP", f"Enters OTP, trip starts<br>{S('D09')}", "OTP checked; ride becomes TRIP_STARTED.", ""),
        ("9. On the trip", f"Live tracking, share trip, SOS<br>{S('R15')}, {S('R16')}", f"Turn-by-turn navigation<br>{S('D10')}",
         "Location service checks route deviation and long stops; Safety service opens an incident on SOS.", ""),
        ("10. Drop", f"Fare breakdown, pay<br>{S('R17')}", f"Collects cash or sees online payment<br>{S('D11')}",
         "TRIP_COMPLETED. Payment captured, 100% of the fare credited to the driver, invoice generated. No commission; one daily fee at midnight.", ""),
        ("11. Ratings", f"{S('R18')}", f"{S('D12')}", "Ratings stored; fraud and safety models consume the completed-ride event.", ""),
        ("12. After the ride", f"History, invoice, support<br>{S('R19')}, {S('R20')}, {S('R26')}", f"Earnings, payouts<br>{S('D13')}, {S('D14')}",
         f"Ops team sees everything in {S('A02')} and {S('A04')}; audit log keeps every step.", ""),
    ]
    t = table(["Step", "Rider", "Driver", "What the platform does"], [r[:4] for r in rows])
    roles = table(["User", "App", "Main jobs"], [
        ("Rider (public user)", "Flutter app, Android and iOS", "Book, track, pay, rate, SOS, support"),
        ("Driver", "Flutter app, Android and iOS", "Get verified, accept rides, navigate, earn, get paid"),
        ("Fleet owner", "Admin portal (limited role)", "Manage own vehicles and drivers, see earnings"),
        ("Operations, safety, fraud, finance, support staff", "Admin portal + operations center", "Monitor live rides, handle incidents, refunds, KYC, tickets"),
        ("Auditor / regulator liaison", "Admin portal (read-only + reports)", "Audit logs, approved government reports"),
    ])
    fname, body = arch_page("00", "how-it-works", "How the application works",
        "Start here", "A plain-language walkthrough of one ride from sign-up to payout, with the screen and backend step for each moment.",
        [sec("Who uses it", "Five kinds of users, three apps", roles),
         sec("The big picture", "One ride, end to end", fig(svg, "Rider actions on the left, driver actions on the right, platform services in the middle.", "00-one-ride")),
         sec("Step by step", "What each person sees and what happens behind it", t)])
    return fname, "How the application works", body, "Plain-language journey of a ride with links to every screen."

# ============================================================ 01 System overview
def p01():
    cw, rh = 185, 102
    N = [
        dict(id="c0", t="Customer app", s="Flutter · iOS/Android", c=0, r=0, k="actor"),
        dict(id="c1", t="Driver & delivery app", s="Flutter · offline-ready", c=1, r=0, k="actor"),
        dict(id="c2", t="Admin portal", s="React · TypeScript", c=2, r=0, k="actor"),
        dict(id="c3", t="Partner app · ops", s="Flutter · React", c=3, r=0, k="actor"),
        dict(id="c4", t="Support softphone", s="WebRTC in browser", c=4, r=0, k="actor"),
        dict(id="gw", t="Nginx LB → API Gateway", s="TLS · WAF · JWT check · rate limits · routing", c=0, r=1, w=3, k="info"),
        dict(id="ws", t="WebSocket Gateway", s="live GPS · ride status", c=3, r=1, k="info"),
        dict(id="ce", t="Call Edge", s="Kamailio · SBC", c=4, r=1, k="info"),
        dict(id="auth", t="Auth & Identity", c=0, r=2), dict(id="ride", t="Ride Service", c=1, r=2, k="acc"),
        dict(id="disp", t="Dispatch", c=2, r=2, k="acc"), dict(id="loc", t="Location & Maps", c=3, r=2, k="acc"),
        dict(id="tel", t="Telephony", s="Asterisk ARI", c=4, r=2),
        dict(id="usr", t="Riders & Profiles", c=0, r=3), dict(id="drv", t="Drivers & Docs", c=1, r=3),
        dict(id="veh", t="Vehicles & Fleet", c=2, r=3), dict(id="prc", t="Pricing & Surge", c=3, r=3, k="acc"),
        dict(id="ntf", t="Notifications", c=4, r=3),
        dict(id="kyc", t="KYC", c=0, r=4), dict(id="pay", t="Payments", c=1, r=4), dict(id="wal", t="Wallet & Earnings", c=2, r=4),
        dict(id="pro", t="Promotions", c=3, r=4), dict(id="sup", t="Support & Chat", c=4, r=4),
        dict(id="sos", t="Safety & SOS", c=0, r=5, k="alert"), dict(id="frd", t="Fraud & Risk", c=1, r=5, k="alert"),
        dict(id="ai", t="AI / ML", c=2, r=5, k="info"), dict(id="rep", t="Reporting & Compliance", c=3, r=5),
        dict(id="aud", t="Audit", c=4, r=5),
        dict(id="ic", t="Long trips & Planner", c=0, r=6, k="acc"), dict(id="shr", t="Sharing", s="seats · parcels", c=1, r=6, k="acc"),
        dict(id="ord", t="Orders (food)", c=2, r=6, k="acc"), dict(id="prl", t="Parcels", c=3, r=6, k="acc"), dict(id="bus", t="Bus inventory", c=4, r=6),
        dict(id="mer", t="Partners & Listings", s="restaurants · hotels · rentals", c=0, r=7), dict(id="sty", t="Stays & Rentals", c=1, r=7),
        dict(id="cov", t="Coverage & Offline", c=2, r=7, k="warn"), dict(id="cp", t="Country packs", s="i18n · tax · rules", c=3, r=7, k="warn"),
        dict(id="rank", t="Ranking by priority", c=4, r=7, k="info"),
        dict(id="kf", t="Kafka event bus", s="ride.* payment.* location.* safety.* audit.*", c=0, r=8.3, w=3, k="data"),
        dict(id="cel", t="Celery workers", s="invoices · exports", c=3, r=8.3, k="data"),
        dict(id="cron", t="Scheduler", s="payouts · expiry checks", c=4, r=8.3, k="data"),
        dict(id="pg", t="PostgreSQL", s="source of truth", c=0, r=9.5, k="data", shape="db", h=64),
        dict(id="rd", t="Redis", s="geo · locks · OTP", c=1, r=9.5, k="data", shape="db", h=64),
        dict(id="mn", t="MinIO / S3", s="documents · audio", c=2, r=9.5, k="data", shape="db", h=64),
        dict(id="os", t="OpenSearch", s="logs · search", c=3, r=9.5, k="data", shape="db", h=64),
        dict(id="ch", t="Analytics DB", s="ClickHouse", c=4, r=9.5, k="data", shape="db", h=64),
        dict(id="x0", t="Maps", s="Google · Mapbox · OSM", c=0, r=10.8, k="ext"),
        dict(id="x1", t="Payment gateways", s="Razorpay · Stripe", c=1, r=10.8, k="ext"),
        dict(id="x2", t="SMS · WhatsApp · Email", c=2, r=10.8, k="ext"),
        dict(id="x3", t="Bus · hotel · KYC APIs", s="partners · gov · insurance", c=3, r=10.8, k="ext"),
        dict(id="x4", t="LLM · SIP trunk", s="· push FCM/APNs", c=4, r=10.8, k="ext"),
        dict(id="s1", t="Security", s="OIDC · RBAC · Vault · KMS", c=5.25, r=2, k="warn"),
        dict(id="s2", t="Observability", s="Prometheus · Grafana\nLoki · OpenTelemetry", c=5.25, r=3, k="warn", h=62),
        dict(id="s3", t="DevOps", s="CI/CD · Docker · K8s", c=5.25, r=4, k="warn"),
        dict(id="s4", t="Backup & DR", s="PITR · replicas", c=5.25, r=5, k="warn"),
        dict(id="s5", t="Compliance", s="retention · consent", c=5.25, r=8.3, k="warn"),
    ]
    E = [
        dict(a="c0", b="gw", bo=-cw), dict(a="c1", b="gw"), dict(a="c2", b="gw", bo=cw),
        dict(a="c3", b="ws"), dict(a="c4", b="ce"),
        dict(a="gw", b="auth", ao=-cw), dict(a="gw", b="ride"), dict(a="gw", b="disp", ao=cw),
        dict(a="ws", b="loc"), dict(a="ce", b="tel"),
        dict(a="sty", b="kf", l="publish / consume", k="data", both=True),
        dict(a="pg", b="kf", ao=0, bo=-cw, l="outbox → events", k="data"),
        dict(a="cp", b="cel", l="jobs", k="data"), dict(a="cel", b="os", l="index", k="data"), dict(a="cron", b="ch", l="ETL", k="data"),
    ]
    G = [("Clients", 0, 0, 4, 0), ("Edge", 0, 1, 4, 1, "info"), ("Core services · Python FastAPI · one schema each", 0, 2, 4, 7, "acc"),
         ("Async", 0, 8.3, 4, 8.3, "data"), ("Data", 0, 9.5, 4, 9.5, "data"), ("Provider adapters · swappable", 0, 10.8, 4, 10.8),
         ("Cross-cutting", 5.25, 2, 5.25, 8.3, "warn")]
    svg = flow(N, E, G, cw=cw, rh=rh, bw=160, bh=50, title="Platform architecture · all layers (multi-service)")
    layers = table(["Layer", "Components", "Responsibility", "Technology"], [
        ("Clients", "Rider app, driver app, admin portal, ops center, support softphone", "Everything a person touches. Apps keep no business rules beyond validation and offline caching.", "Flutter, React + TypeScript, WebRTC"),
        ("Edge", "Load balancer, API gateway, WebSocket gateway, call edge", "Single entry point, TLS termination, WAF, JWT validation, rate limits, routing, sticky WebSocket sessions.", "Nginx, Kong or Traefik, ModSecurity, Kamailio"),
        ("Core services", "30 domain services: trip core, people, money, trust, travel, delivery and global", "Business logic. Each service owns one PostgreSQL schema and publishes domain events.", "Python 3.12, FastAPI, Pydantic, SQLAlchemy, Alembic"),
        ("Async", "Kafka topics, Celery workers, scheduler", "Everything that can happen after the response: payments, notifications, invoices, analytics, AI scoring.", "Kafka, Celery, Redis Streams for small jobs"),
        ("Data", "PostgreSQL, Redis, MinIO, OpenSearch, analytics DB", "Durable records, fast ephemeral state, files, search, reporting.", "PostgreSQL 16, Redis 7, MinIO, OpenSearch, ClickHouse"),
        ("Provider adapters", "Maps, payments, SMS/WhatsApp, push, KYC, LLM, SIP trunk, government APIs", "Every outside provider sits behind an interface so it can be swapped per country.", "Adapter classes + config per region"),
        ("Cross-cutting", "Security, observability, DevOps, backup, compliance", "Applies to every layer.", "Keycloak, Vault, Prometheus, Grafana, Loki, OTel, GitHub Actions, K8s"),
    ])
    ref = (f'<figure><div class="diagram"><img src="../images/reference/reference-architecture.png" alt="Reference architecture image" style="width:100%;max-width:1400px;display:block"></div>'
           f'<figcaption>Your reference image. The diagram above follows the same layers and adds the async and adapter layers.</figcaption></figure>')
    fname, body = arch_page("01", "system-overview", "System overview", "Layers",
        "Every component of the platform in one picture, from the apps down to the external providers.",
        [sec("Diagram", "All layers", fig(svg, "Requests enter through the edge. Services own their data and talk through Kafka for anything that doesn't need an instant answer. Rider and driver apps also open WebSocket and call connections, shown here from the ops center and softphone for clarity.", "01-system-overview")),
         sec("Layers", "What each layer does", layers), sec("Reference", "Original concept image", ref)])
    return fname, "System overview", body, "Every layer and component in one diagram, plus what each layer is responsible for."

# ============================================================ 02 Services
def p02():
    rows = [
        ("Auth & Identity", "OTP login, MFA, JWT + refresh tokens, sessions, device binding", "identity", f"{api('POST','/v1/auth/otp')}<br>{api('POST','/v1/auth/verify')}<br>{api('POST','/v1/auth/refresh')}", "user.registered, user.logged_in", "—"),
        ("Riders & Profiles", "Rider profile, saved places, emergency contacts, preferences", "users", f"{api('GET','/v1/me')}<br>{api('PUT','/v1/me/contacts')}", "rider.updated", "user.registered"),
        ("Drivers & Documents", "Driver profile, licence, RC, insurance, permit, fitness, police check, expiry tracking", "drivers", f"{api('POST','/v1/drivers/documents')}<br>{api('PATCH','/v1/drivers/me/status')}", "driver.document_uploaded, driver.status_changed", "kyc.decided"),
        ("Vehicles & Fleet", "Vehicles, vehicle types, fleet owners, driver ↔ vehicle assignment", "vehicles", f"{api('POST','/v1/vehicles')}<br>{api('GET','/v1/fleets/{id}/vehicles')}", "vehicle.updated", "—"),
        ("KYC", "Document checks, face match, manual review queue, decisions", "kyc", f"{api('GET','/v1/admin/kyc/queue')}<br>{api('POST','/v1/admin/kyc/{id}/decision')}", "kyc.decided", "driver.document_uploaded"),
        ("Ride", "Ride lifecycle, state machine, OTP, cancellations, ride event trail", "rides", f"{api('POST','/v1/rides/estimate')}<br>{api('POST','/v1/rides')}<br>{api('POST','/v1/rides/{id}/cancel')}", "ride.* (requested, accepted, started, completed, cancelled)", "dispatch.assigned, payment.completed"),
        ("Dispatch & Matching", "Candidate search, scoring, offers, locks, re-dispatch", "dispatch", f"{api('POST','/v1/offers/{id}/accept')}<br>{api('WS','offer channel')}", "dispatch.offered, dispatch.assigned, dispatch.failed", "ride.requested, ride.cancelled"),
        ("Pricing & Surge", "Fare quotes, surge multipliers per zone, tolls, taxes, final fare", "pricing", f"{api('POST','/internal/quotes')}<br>{api('PUT','/v1/admin/pricing/rules')}", "pricing.surge_changed", "location.demand_snapshot"),
        ("Location & Maps", "GPS ingestion, geo index, ETA, routes, geofences, trip recording", "location", f"{api('WS','/ws/driver/location')}<br>{api('GET','/v1/rides/{id}/track')}", "location.updated, geofence.entered, route.deviation", "ride.started, ride.completed"),
        ("Payments", "Charges, gateway integration, webhooks, refunds, reconciliation", "payments", f"{api('POST','/v1/payments/intents')}<br>{api('POST','/webhooks/{gateway}')}", "payment.completed, payment.failed, refund.issued", "ride.completed"),
        ("Wallet & Earnings", "Rider wallet, driver ledger, daily fees, incentives, payouts", "ledger", f"{api('GET','/v1/wallet')}<br>{api('POST','/v1/drivers/me/payouts')}", "wallet.credited, payout.sent", "payment.completed"),
        ("Promotions", "Coupons, referral credits, campaign budgets, abuse limits", "promotions", f"{api('POST','/v1/coupons/validate')}", "coupon.redeemed", "ride.completed"),
        ("Notifications", "Push, SMS, WhatsApp, email, in-app, templates per language", "notifications", f"{api('POST','/internal/notify')}", "notification.sent", "most domain events"),
        ("Telephony", "Masked calls, number pool, IVR, recording, call logs", "telephony", f"{api('POST','/v1/rides/{id}/call')}<br>{api('GET','/v1/admin/calls')}", "call.started, call.ended", "ride.accepted, ride.completed"),
        ("Support & Chat", "In-ride chat, tickets, lost & found, AI assistant hand-off", "support", f"{api('POST','/v1/tickets')}<br>{api('WS','/ws/chat/{ride_id}')}", "ticket.created, ticket.resolved", "ride.completed"),
        ("Safety & SOS", "SOS, trip sharing, incidents, safety checks, emergency contacts alerts", "safety", f"{api('POST','/v1/rides/{id}/sos')}<br>{api('POST','/v1/rides/{id}/share')}", "safety.sos_raised, incident.opened", "route.deviation, ride.*"),
        ("Fraud & Risk", "Risk scores, rules, device fingerprints, review queue", "fraud", f"{api('GET','/v1/admin/fraud/queue')}", "fraud.flagged", "ride.*, payment.*, user.logged_in"),
        ("AI / ML", "ETA, demand forecast, fraud and safety models, support assistant", "ml", f"{api('POST','/internal/ml/score')}<br>{api('POST','/v1/assistant/messages')}", "ml.prediction", "location.*, ride.*"),
        ("Reporting & Compliance", "Dashboards, exports, government reports, retention jobs", "reporting", f"{api('POST','/v1/admin/gov-reports')}<br>{api('GET','/v1/admin/reports/{id}')}", "report.approved", "incident.*, audit.*"),
        ("Long trips & Planner", "Intercity search, multi-leg plans, booking sagas, transfer buffers", "planner", f"{api('POST','/v1/intercity/search')}<br>{api('POST','/v1/planner/plans')}<br>{api('POST','/v1/planner/plans/{id}/book')}", "plan.created, plan.booked", "bus.*, seat.*, stay.*"),
        ("Sharing", "Published trips, seat bookings, parcel space, corridor matching", "sharing", f"{api('POST','/v1/sharing/trips')}<br>{api('POST','/v1/intercity/trips/{id}/bookings')}", "sharing.trip_published, seat.booked", "parcel.created"),
        ("Orders (food)", "Carts, food orders, restaurant states, batching hints", "orders", f"{api('POST','/v1/food/orders')}<br>{api('POST','/v1/merchant/orders/{id}/accept')}", "order.*", "payment.*, dispatch.*"),
        ("Parcels", "City and intercity parcels, handovers, proofs", "parcels", f"{api('POST','/v1/parcels/quote')}<br>{api('POST','/v1/parcels')}", "parcel.*", "sharing.*, bus.*"),
        ("Bus inventory", "Operator and aggregator adapters, seat holds, tickets", "bus", f"{api('GET','/v1/bus/trips/{id}/seats')}<br>{api('POST','/v1/bus/bookings')}", "bus.booked", "—"),
        ("Partners & Listings", "Partner onboarding, restaurants, menus, price bands, reviews", "partners, merchants", f"{api('POST','/v1/partners/applications')}<br>{api('PATCH','/v1/merchant/items/{id}')}", "partner.approved, menu.updated", "order.*, review.*"),
        ("Stays & Rentals", "Hotel rates and bookings, rental fleets, deposits, handovers", "stays, rentals", f"{api('GET','/v1/stays/search')}<br>{api('POST','/v1/rentals/bookings')}", "stay.booked, rental.booked", "plan.*"),
        ("Coverage & Offline", "Signal readings, dead zones, road rules, check-in windows, offline packs", "coverage", f"{api('GET','/v1/coverage/route')}<br>{api('POST','/v1/trips/{id}/checkin-window')}", "coverage.warning_shown", "location.updated"),
        ("Country packs", "Currency, languages, tax, payments, emergency numbers, legal limits per country", "configuration", f"{api('GET','/v1/countries')}", "country_pack.published", "—"),
        ("Ranking by priority", "Scores and badges for options by Urgent / Balanced / Saver / Flexible / Deals", "— (stateless)", f"{api('POST','/v1/journeys/options')}", "journey.options_shown", "pricing.*"),
        ("Audit", "Append-only log of every admin and system action", "audit", f"{api('GET','/v1/admin/audit')}", "—", "audit.* from all services"),
    ]
    t = table(["Service", "Responsibility", "Owns schema", "Key APIs", "Publishes", "Consumes"], rows, mono_cols=(2,))
    N = [dict(id="prc", t="Pricing", c=0, r=0), dict(id="loc", t="Location & Maps", c=1, r=0), dict(id="dsp", t="Dispatch", c=2, r=0),
         dict(id="ride", t="Ride Service", s="owns lifecycle", c=1, r=1.2, k="acc"),
         dict(id="pay", t="Payments", c=0, r=2.5), dict(id="kf", t="Kafka", s="ride.events", c=1, r=2.5, k="data"), dict(id="saf", t="Safety", c=2, r=2.5, k="alert"),
         dict(id="ntf", t="Notifications", c=0, r=3.6), dict(id="frd", t="Fraud", c=1, r=3.6), dict(id="an", t="Analytics", c=2, r=3.6)]
    E = [dict(a="ride", b="prc", pa="l", pb="b", l="quote (sync)"), dict(a="ride", b="loc", l="ETA (sync)"), dict(a="ride", b="dsp", pa="r", pb="b", l="dispatch (sync)"),
         dict(a="ride", b="kf", l="publish", k="data"), dict(a="kf", b="pay", k="data"), dict(a="kf", b="saf", k="data"),
         dict(a="kf", b="ntf", pa="b", pb="t", ao=-40, k="data"), dict(a="kf", b="frd", k="data"), dict(a="kf", b="an", pa="b", pb="t", ao=40, k="data")]
    svg = flow(N, E, cw=220, rh=90, bw=175, bh=50, title="Sync calls only where the answer is needed now; everything else is an event")
    rules = """<ul class="clean">
<li><b>One owner per table.</b> A service never reads another service's schema; it calls the API or keeps a local copy from events.</li>
<li><b>Sync only on the critical path.</b> Quotes, ETA and dispatch are sync calls with a 300–800 ms timeout and a circuit breaker.</li>
<li><b>Idempotency keys</b> on every POST that creates money or rides, so app retries never double-book or double-charge.</li>
<li><b>Transactional outbox.</b> A service writes its row and its event in one database transaction; a relay pushes the event to Kafka.</li>
<li><b>Versioned APIs</b> under <code>/v1</code>; mobile apps can lag several versions, so old versions stay supported for 12 months.</li>
<li><b>Start as a modular monolith.</b> Each service is a separate Python package with its own schema, deployed together in phase 1 and split out when load requires it.</li></ul>"""
    fname, body = arch_page("02", "services", "Microservices catalogue", "Services",
        "The thirty domain services, what each one owns, the APIs it exposes and the events it sends and receives.",
        [sec("Catalogue", "Service by service", t), sec("Communication", "How services talk", fig(svg, "The Ride service calls three services synchronously while booking; everything after that fans out through Kafka.", "02-service-communication"), rules)])
    return fname, "Microservices catalogue", body, "30 services with responsibilities, APIs, schemas and events."

# ============================================================ 03 Ride booking
def p03():
    parts = [("rid", "Rider App", "actor"), ("gw", "API Gateway", "info"), ("ride", "Ride Svc", "acc"), ("prc", "Pricing", "n"),
             ("dsp", "Dispatch", "acc"), ("rds", "Redis", "data"), ("drv", "Driver App", "actor"), ("kf", "Kafka", "data"),
             ("pay", "Payments", "n"), ("ntf", "Notifications", "n")]
    M = [("sec", "Fare estimate"),
         ("m", "rid", "gw", "POST /v1/rides/estimate"), ("m", "gw", "ride", "forward (JWT ok)"), ("m", "ride", "prc", "quote(pickup, drop, types)"),
         ("self", "prc", "route + ETA via Maps, zone surge"), ("r", "prc", "ride", "quotes + quote_id (5 min)"), ("r", "ride", "rid", "fare per vehicle type"),
         ("sec", "Book"),
         ("m", "rid", "gw", "POST /v1/rides + Idempotency-Key"), ("m", "gw", "ride", "create ride"), ("self", "ride", "REQUESTED + ride_event row (outbox)"),
         ("async", "ride", "kf", "ride.requested"), ("r", "ride", "rid", "201 ride_id · SEARCHING_DRIVER"),
         ("sec", "Match"),
         ("async", "kf", "dsp", "consume ride.requested"), ("m", "dsp", "rds", "GEOSEARCH 2 km, vehicle=cab"), ("r", "rds", "dsp", "candidates"),
         ("self", "dsp", "filter + score"), ("m", "dsp", "rds", "SET lock:driver NX EX 20"), ("async", "dsp", "drv", "offer via WebSocket + push (15 s)"),
         ("m", "drv", "dsp", "accept"), ("m", "dsp", "ride", "assign driver"), ("self", "ride", "DRIVER_ACCEPTED"),
         ("async", "ride", "kf", "ride.driver_assigned"), ("async", "kf", "ntf", "consume"), ("async", "ntf", "rid", "push: driver, car, OTP, ETA"),
         ("sec", "Trip"),
         ("m", "drv", "ride", "start trip (rider OTP)"), ("self", "ride", "TRIP_STARTED"), ("m", "drv", "ride", "end trip + GPS trail"),
         ("self", "ride", "final fare from actual km / min"), ("async", "ride", "kf", "ride.completed"),
         ("sec", "Pay"),
         ("async", "kf", "pay", "consume ride.completed"), ("self", "pay", "capture payment, credit driver 100% of fare"), ("async", "pay", "kf", "payment.completed"),
         ("async", "kf", "ntf", "consume"), ("async", "ntf", "rid", "receipt + invoice link")]
    sq = seq(parts, M, colw=150, title="Booking a ride · request to receipt")
    N = [dict(id="nd", t="NO_DRIVER_FOUND", c=1, r=-1.1, k="alert"),
         dict(id="a", t="REQUESTED", c=0, r=0), dict(id="b", t="SEARCHING_DRIVER", c=1, r=0), dict(id="c", t="DRIVER_ASSIGNED", c=2, r=0),
         dict(id="d", t="DRIVER_ACCEPTED", c=3, r=0, k="acc"), dict(id="x", t="CANCELLED", c=4.2, r=1, k="alert"),
         dict(id="e", t="DRIVER_ARRIVING", c=3, r=1, k="acc"), dict(id="f", t="DRIVER_ARRIVED", c=2, r=1, k="acc"),
         dict(id="g", t="TRIP_STARTED", c=1, r=1, k="acc"), dict(id="h", t="TRIP_IN_PROGRESS", c=0, r=1, k="acc"),
         dict(id="i", t="TRIP_COMPLETED", c=0, r=2, k="acc"), dict(id="j", t="PAYMENT_PENDING", c=1, r=2), dict(id="k", t="PAYMENT_COMPLETED", c=2, r=2, k="acc"),
         dict(id="l", t="CLOSED", s="rated · invoiced", c=3, r=2), dict(id="pf", t="PAYMENT_FAILED", s="debt on account", c=1, r=3, k="alert")]
    E = [dict(a="a", b="b"), dict(a="b", b="c", l="offer"), dict(a="c", b="d", l="accept"),
         dict(a="c", b="b", pa="t", pb="t", ym=18, bo=40, l="reject / 15 s timeout", k="warn"),
         dict(a="b", b="nd", ao=-40, l="3 min, no driver", k="alert"),
         dict(a="d", b="e"), dict(a="e", b="f", l="within 100 m"), dict(a="f", b="g", l="OTP ok"), dict(a="g", b="h"),
         dict(a="h", b="i", l="end trip"), dict(a="i", b="j"), dict(a="j", b="k", l="captured"), dict(a="k", b="l"),
         dict(a="j", b="pf", l="declined", k="alert"), dict(a="pf", b="k", pa="r", pb="b", l="settled later", k="warn"),
         dict(a="d", b="x", pa="r", pb="t", l="cancel before TRIP_STARTED", k="alert")]
    sm = flow(N, E, cw=250, rh=100, bw=180, bh=46, title="Ride state machine")
    states = table(["State", "Set by", "Can move to", "Timeout / rule"], [
        ("REQUESTED", "Ride service on create", "SEARCHING_DRIVER, CANCELLED", "Immediate"),
        ("SEARCHING_DRIVER", "Dispatch", "DRIVER_ASSIGNED, NO_DRIVER_FOUND, CANCELLED", "3 min total search"),
        ("DRIVER_ASSIGNED", "Dispatch (offer sent)", "DRIVER_ACCEPTED, SEARCHING_DRIVER", "15 s to accept"),
        ("DRIVER_ACCEPTED / ARRIVING", "Driver app", "DRIVER_ARRIVED, CANCELLED", "Cancel fee after 3 min for rider"),
        ("DRIVER_ARRIVED", "Location svc (within 100 m) or driver", "TRIP_STARTED, CANCELLED", "Waiting charge after 3 min; no-show after 7 min"),
        ("TRIP_STARTED / IN_PROGRESS", "Driver app with OTP", "TRIP_COMPLETED", "Safety checks active; cannot be cancelled, only ended"),
        ("TRIP_COMPLETED", "Driver app", "PAYMENT_PENDING", "Final fare computed from GPS trail"),
        ("PAYMENT_PENDING", "Payments", "PAYMENT_COMPLETED, PAYMENT_FAILED", "Gateway webhook within 15 min"),
        ("PAYMENT_COMPLETED → CLOSED", "Payments / Ride", "—", "Ratings accepted for 7 days"),
    ], mono_cols=(0,))
    fname, body = arch_page("03", "ride-booking", "Ride booking flow", "Core flow",
        "The full request-to-receipt sequence across services, and the state machine every ride follows.",
        [sec("Sequence", "Request to receipt", fig(sq, "Solid arrows are synchronous calls, dashed purple arrows are events or pushes, grey dashed arrows are responses.", "03-booking-sequence")),
         sec("State machine", "Every state a ride can be in", fig(sm, "Each transition appends a row to <code>rides.ride_events</code>; the ride row only caches the latest state.", "03-ride-state-machine"), states),
         sec("Screens", "Where this flow appears", f'<div class="navlinks">{"".join(S(x) for x in ["R08","R09","R10","R11","R12","R15","R17","D07","D08","D09","D10","D11","A04"])}</div>')])
    return fname, "Ride booking flow", body, "Full booking sequence and the ride state machine with timeouts."

# ============================================================ 04 Dispatch
def p04():
    N = [dict(id="ev", t="ride.requested", c=1, r=0, k="data", shape="pill"),
         dict(id="gs", t="Geo search", s="radius R (start 2 km)", c=1, r=1),
         dict(id="fl", t="Filter", s="online · vehicle type · docs valid\nnot on trip · not blocked", c=1, r=2, h=62),
         dict(id="sc", t="Score & rank", s="ETA · acceptance · idle · rating", c=1, r=3),
         dict(id="q1", t="Candidates?", c=1, r=4, k="warn", shape="q"),
         dict(id="ex", t="Expand radius", s="2 → 4 → 6 km", c=0, r=4),
         dict(id="nd", t="NO_DRIVER_FOUND", s="suggest other vehicle", c=0, r=5.3, k="alert"),
         dict(id="lk", t="Lock driver + offer", s="Redis NX · 15 s", c=1, r=5.3, k="acc"),
         dict(id="q2", t="Accepted?", c=1, r=6.5, k="warn", shape="q"),
         dict(id="nx", t="Next candidate", s="cool-down rejecter 30 s", c=2, r=6.5),
         dict(id="as", t="Assign driver", s="DRIVER_ACCEPTED", c=1, r=7.7, k="acc")]
    E = [dict(a="ev", b="gs"), dict(a="gs", b="fl"), dict(a="fl", b="sc"), dict(a="sc", b="q1"),
         dict(a="q1", b="ex", l="none", k="warn"), dict(a="ex", b="gs", pa="t", pb="l", l="retry"),
         dict(a="ex", b="nd", l="max radius or 3 min", k="alert"), dict(a="q1", b="lk", l="yes"),
         dict(a="lk", b="q2"), dict(a="q2", b="nx", l="no / timeout", k="warn"), dict(a="nx", b="lk", pa="t", pb="r", l="offer next"),
         dict(a="q2", b="as", l="yes", k="acc")]
    svg = flow(N, E, cw=240, rh=86, bw=200, bh=50, title="Dispatch loop")
    parts = [("dsp", "Dispatch A", "acc"), ("dsp2", "Dispatch B", "acc"), ("rds", "Redis", "data"), ("drv", "Driver 42", "actor")]
    M = [("note", "dsp", "dsp2", "Two rides want the same nearby driver at the same moment", "warn"),
         ("m", "dsp", "rds", "SET lock:driver:42 ride_881 NX EX 20"), ("r", "rds", "dsp", "OK"),
         ("m", "dsp2", "rds", "SET lock:driver:42 ride_882 NX EX 20"), ("r", "rds", "dsp2", "nil (already locked)"),
         ("self", "dsp2", "skip, try next candidate"), ("async", "dsp", "drv", "offer ride_881"),
         ("m", "drv", "dsp", "accept"), ("m", "dsp", "rds", "DEL lock, SET driver:42:busy")]
    sq = seq(parts, M, colw=210, title="Why the Redis lock matters")
    cfg = table(["Setting", "Default", "What it controls"], [
        ("search_radius_steps_km", "2, 4, 6", "Radius used on each search round; per city and vehicle type."),
        ("offer_timeout_s", "15", "How long a driver has to accept before the next candidate is offered."),
        ("max_offers_per_ride", "8", "Stop after this many offers and return NO_DRIVER_FOUND."),
        ("max_search_time_s", "180", "Total time the rider waits before search ends."),
        ("score_weights", "ETA 0.50 · acceptance 0.20 · idle 0.15 · rating 0.15", "How candidates are ranked; tuned by AI demand model later."),
        ("reject_cooldown_s", "30", "A driver who rejects is not offered the same ride again and pauses briefly."),
        ("min_driver_rating", "4.2", "Drivers below this are only offered rides when nobody else is available."),
        ("women_preference", "off by default", "When a rider enables it and a verified woman driver is nearby, she is preferred."),
    ], mono_cols=(0,))
    fname, body = arch_page("04", "dispatch", "Dispatch & driver matching", "Core flow",
        "How the platform finds, ranks and offers a ride to a driver without ever giving one driver two rides.",
        [sec("Algorithm", "The dispatch loop", fig(svg, "Sequential offers are simpler and fairer for launch. Batched matching across many rides can replace the scoring step later without changing the rest.", "04-dispatch-loop")),
         sec("Concurrency", "One driver, one offer at a time", fig(sq, "The lock expires by itself after 20 s, so a crashed dispatcher never leaves a driver stuck.", "04-driver-lock")),
         sec("Configuration", "Tunable per city and vehicle type", cfg)])
    return fname, "Dispatch & driver matching", body, "Matching loop, Redis locking and tunable dispatch settings."

# ============================================================ 05 Location
def p05():
    N = [dict(id="gps", t="Driver app GPS", s="fused location", c=0, r=0, k="actor"),
         dict(id="buf", t="Local buffer", s="encrypted, when offline", c=1, r=0),
         dict(id="ws", t="WebSocket Gateway", c=2, r=0, k="info"),
         dict(id="ls", t="Location service", s="validate · smooth", c=3, r=0, k="acc"),
         dict(id="geo", t="Redis GEO", s="drivers:geo:{city}", c=4, r=1, k="data", shape="db", h=62),
         dict(id="kf", t="Kafka", s="location.updated", c=3, r=1, k="data"),
         dict(id="live", t="Rider live map", s="WebSocket push", c=0, r=2.2, k="actor"),
         dict(id="gf", t="Geofence engine", s="zones · airports", c=1, r=2.2),
         dict(id="sf", t="Safety monitor", s="deviation · long stop", c=2, r=2.2, k="alert"),
         dict(id="tr", t="Trip recorder", s="ride_locations", c=3, r=2.2),
         dict(id="ml", t="Demand & ETA models", c=4, r=2.2, k="info")]
    E = [dict(a="gps", b="buf", l="3–10 s"), dict(a="buf", b="ws", l="batch"), dict(a="ws", b="ls"),
         dict(a="ls", b="geo", pa="r", pb="t", l="GEOADD"), dict(a="ls", b="kf", l="publish", k="data")]
    E += [dict(a="kf", b=t, pa="b", pb="t", ym=232, k="data") for t in ("live", "gf", "sf", "tr", "ml")]
    svg = flow(N, E, cw=235, rh=110, bw=180, bh=52, title="Location pipeline")
    freq = table(["Driver state", "Update interval", "Why"], [
        ("Offline", "none", "No tracking when the driver is off duty."),
        ("Online, idle", "every 10 s or 100 m", "Enough for matching, easy on battery and data."),
        ("Offer received / to pickup", "every 4 s", "Rider sees the car approach smoothly."),
        ("On trip", "every 3 s", "Accurate fare distance, route-deviation checks."),
        ("SOS active", "every 1 s", "Safety team gets the best possible trail."),
    ])
    adapter = table(["Adapter method", "Used for", "Providers you can plug in"], [
        ("autocomplete(query, near)", "Destination search", "Google Places, Mapbox, HERE, Photon (OSM)"),
        ("geocode / reverse_geocode", "Addresses ↔ coordinates", "Google, Mapbox, Nominatim (OSM)"),
        ("route(a, b, vehicle)", "Distance, duration, polyline", "Google Directions, Mapbox, OSRM, Valhalla"),
        ("eta_matrix(drivers, pickup)", "Dispatch scoring", "Google Distance Matrix, OSRM table"),
        ("snap_to_road(points)", "Clean GPS trail for final fare", "Google Roads, OSRM match"),
    ], mono_cols=(0,))
    geof = table(["Geofence type", "Effect"], [
        ("City service area", "Rides can only start inside it; outstation rides use a separate product."),
        ("Airport pickup zone", "Riders must pick a terminal gate; drivers join an airport queue."),
        ("Restricted zone", "No pickups or drops, for example border areas or events."),
        ("Surge zone", "Pricing reads the zone's live multiplier."),
        ("Safety hotspot", "Lower threshold for long-stop and deviation alerts at night."),
    ])
    checks = """<ul class="clean"><li><b>Mock location:</b> Android mock-location flag and impossible jumps (over 150 km/h between points) mark the point as suspect and notify Fraud.</li>
<li><b>Route deviation:</b> distance from the planned polyline over 500 m for more than 2 minutes raises a safety check to the rider.</li>
<li><b>Long stop:</b> no movement for 5 minutes on a trip (3 at night) asks both parties if all is well.</li></ul>"""
    fname, body = arch_page("05", "location-gps", "Location, GPS & maps", "Real-time",
        "How driver positions travel from the phone to the rider's map, the geo index and the safety monitor.",
        [sec("Pipeline", "From GPS to every consumer", fig(svg, "Only the Location service writes to the Redis geo index. Everything else reads events from Kafka.", "05-location-pipeline")),
         sec("Frequency", "How often drivers send location", freq), sec("Checks", "Validation and safety rules", checks),
         sec("Maps", "Provider adapter", adapter), sec("Geofences", "Zone types", geof)])
    return fname, "Location, GPS & maps", body, "GPS pipeline, update frequency, validation, map adapters and geofences."

PAGES = [p00, p01, p02, p03, p04, p05]
