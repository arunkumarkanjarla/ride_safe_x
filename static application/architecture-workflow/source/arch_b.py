from archlib import *

# ============================================================ 06 Payments
def p06():
    parts = [("rid", "Rider App", "actor"), ("pay", "Payments Svc", "acc"), ("gw", "Gateway\nRazorpay / Stripe", "ext"),
             ("led", "Ledger", "data"), ("kf", "Kafka", "data"), ("wal", "Wallet &\nEarnings", "n")]
    M = [("sec", "At booking (online payment)"),
         ("m", "rid", "pay", "create intent (estimated fare)"), ("m", "pay", "gw", "create order · idempotency key"),
         ("r", "gw", "pay", "order_id"), ("r", "pay", "rid", "UPI intent / card sheet"),
         ("m", "rid", "gw", "rider authorises in gateway SDK"),
         ("sec", "After the trip"),
         ("async", "kf", "pay", "ride.completed (final fare)"), ("m", "pay", "gw", "capture final amount"),
         ("m", "gw", "pay", "webhook payment.captured (signed)"), ("self", "pay", "verify signature, dedupe event id"),
         ("m", "pay", "led", "post balanced entries"), ("async", "pay", "kf", "payment.completed"),
         ("async", "kf", "wal", "credit driver earning"),
         ("note", "rid", "wal", "Cash ride: driver confirms cash received and keeps the fare; only the GST\nbecomes an amount owed, recovered from the next online payouts", "warn"),
         ("sec", "Failure"),
         ("m", "gw", "pay", "webhook payment.failed"), ("self", "pay", "retry once, then PAYMENT_FAILED"),
         ("async", "pay", "rid", "ask to pay by other method; block new bookings until settled")]
    sq = seq(parts, M, colw=175, title="Online payment · booking, capture, webhook")
    ledger = table(["Entry", "Account", "Debit", "Credit"], [
        ("1", "Gateway clearing", "300.00", ""), ("1", "Rider payable", "", "300.00"),
        ("2", "Rider payable", "300.00", ""), ("2", "Driver earnings (100% of fare)", "", "285.71"), ("2", "GST payable on ride (5%)", "", "14.29"),
        ("3 · midnight", "Driver earnings", "15.00", ""), ("3 · midnight", "Platform revenue (daily fee)", "", "12.71"), ("3 · midnight", "GST payable on daily fee (18%)", "", "2.29"),
        ("", "<b>Total</b>", "<b>615.00</b>", "<b>615.00</b>")])
    N = [dict(id="cr", t="Daily scheduler", s="02:00 local time", c=0, r=0, k="data", shape="pill"),
         dict(id="bal", t="Compute balances", s="earnings − daily fees", c=1, r=0),
         dict(id="q", t="Above minimum?", c=2, r=0, k="warn", shape="q"),
         dict(id="hold", t="Carry forward", c=2, r=1),
         dict(id="kyc", t="KYC + bank verified?", c=3, r=0, k="warn", shape="q"),
         dict(id="blk", t="Hold, notify driver", c=3, r=1, k="alert"),
         dict(id="bat", t="Payout batch", s="gateway payouts API", c=4, r=0, k="acc"),
         dict(id="wh", t="Webhook: paid / failed", c=4, r=1),
         dict(id="ok", t="Mark paid · notify", c=4, r=2, k="acc")]
    E = [dict(a="cr", b="bal"), dict(a="bal", b="q"), dict(a="q", b="hold", l="no", k="warn"), dict(a="q", b="kyc", l="yes"),
         dict(a="kyc", b="blk", l="no", k="alert"), dict(a="kyc", b="bat", l="yes"), dict(a="bat", b="wh"), dict(a="wh", b="ok")]
    po = flow(N, E, cw=235, rh=96, bw=180, bh=52, title="Driver payouts")
    states = table(["Payment state", "Meaning"], [
        ("CREATED", "Order created at the gateway, rider hasn't paid yet."),
        ("AUTHORISED", "Card held or UPI mandate approved; nothing captured."),
        ("CAPTURED", "Money taken; waiting for settlement to the platform account."),
        ("FAILED", "Declined, timed out or cancelled by the rider."),
        ("REFUND_PENDING → REFUNDED", "Full or partial refund requested by support or policy."),
        ("SETTLED", "Gateway has paid the platform; reconciliation matched."),
    ], mono_cols=(0,))
    methods = table(["Method", "Where", "Notes"], [
        ("UPI (collect / intent)", "India", "Most common; no pre-authorisation, so charge after the trip."),
        ("Cards", "Global", "Pre-authorise estimated fare, capture final amount."),
        ("Apple Pay / Google Pay", "Global", "Through Stripe or the local gateway."),
        ("Net banking, local wallets", "India and others", "Adapter per gateway."),
        ("Rider wallet", "All", "Top-ups, refunds and referral credits; spent before other methods."),
        ("Cash", "Where allowed", "Driver confirms and keeps the fare; GST recovered from payouts."),
        ("Corporate billing", "Business accounts", "Monthly invoice to the company; employee rides tagged by cost centre."),
    ])
    fname, body = arch_page("06", "payments", "Payments, wallet & payouts", "Money",
        "How rider payments are captured, how each rupee or dollar is recorded in a double-entry ledger, and how drivers get paid.",
        [sec("Sequence", "Capturing a payment", fig(sq, "The gateway webhook, not the app, is the source of truth for whether money moved.", "06-payment-sequence")),
         sec("Ledger", "Example: a 300.00 online ride, then that day's 15.00 driver fee", ledger,
             '<p class="note">Illustrative only. There is no per-ride commission: the driver is credited the whole fare and one flat daily fee is posted at midnight (see page 26). Tax rules vary by country and vehicle type; they are configuration, not code.</p>'),
         sec("Payouts", "Paying drivers", fig(po, "Payouts run as a batch so the finance team can review totals before release.", "06-driver-payouts")),
         sec("States", "Payment states", states), sec("Methods", "Supported payment methods", methods)])
    return fname, "Payments, wallet & payouts", body, "Payment capture, double-entry ledger, payouts and payment methods."

# ============================================================ 07 Telephony
def p07():
    N = [dict(id="rid", t="Rider app", s="in-app call (WebRTC)", c=0, r=0, k="actor"),
         dict(id="ts", t="Telephony service", s="FastAPI · Asterisk ARI", c=2, r=0, k="acc"),
         dict(id="drv", t="Driver phone", s="normal mobile call", c=4, r=0, k="actor"),
         dict(id="kam", t="Kamailio", s="WebRTC gateway · SBC", c=0.8, r=1.3, k="info"),
         dict(id="ast", t="Asterisk PBX", s="PJSIP · bridge · IVR", c=2, r=1.3, k="acc"),
         dict(id="trk", t="SIP trunk", s="telecom provider", c=3.2, r=1.3, k="ext"),
         dict(id="pool", t="Proxy number pool", s="Redis", c=1, r=2.6, k="data", shape="db", h=62),
         dict(id="rec", t="Recordings", s="MinIO · encrypted", c=2, r=2.6, k="data", shape="db", h=62),
         dict(id="cdr", t="Call logs", s="PostgreSQL", c=3, r=2.6, k="data", shape="db", h=62)]
    E = [dict(a="rid", b="ts", l="POST /rides/{id}/call"), dict(a="rid", b="kam", pa="b", pb="t", l="WebRTC (SRTP)"),
         dict(a="kam", b="ast", l="SIP"), dict(a="ts", b="ast", l="ARI originate"), dict(a="ast", b="trk", l="PSTN leg"),
         dict(a="trk", b="drv", pa="r", pb="b", l="calls driver"),
         dict(a="ast", b="pool", pa="b", pb="t", ao=-40, l="proxy lookup", k="data"), dict(a="ast", b="rec", k="data", l="if consented"),
         dict(a="ts", b="cdr", pa="r", pb="t", ao=0, l="CDR", k="data", xm=0)]
    svg = flow(N[:-1] + [N[-1]], E[:-1] + [dict(a="ast", b="cdr", pa="b", pb="t", ao=40, l="CDR", k="data")], cw=215, rh=96, bw=180, bh=52,
               title="Masked calling · in-app and phone")
    parts = [("rp", "Rider phone", "actor"), ("trk", "SIP trunk", "ext"), ("kam", "Kamailio", "info"), ("ast", "Asterisk", "acc"),
             ("ts", "Telephony svc", "acc"), ("dp", "Driver phone", "actor"), ("kf", "Kafka", "data")]
    M = [("m", "rp", "trk", "dials proxy +91 80 4xxx 1234"), ("m", "trk", "kam", "INVITE"), ("m", "kam", "ast", "INVITE (rate-limited)"),
         ("m", "ast", "ts", "ARI: who is caller on this proxy?"), ("self", "ts", "caller ANI + proxy → active ride 881"),
         ("r", "ts", "ast", "bridge to driver, caller ID = proxy"), ("m", "ast", "trk", "dial driver's real number"),
         ("m", "trk", "dp", "rings with proxy number"), ("note", "rp", "dp", "Neither side ever sees the other's real number", "acc"),
         ("m", "dp", "ast", "hang up"), ("m", "ast", "ts", "call ended, duration, recording id"), ("async", "ts", "kf", "call.ended")]
    sq = seq(parts, M, colw=170, title="Masked PSTN call")
    N2 = [dict(id="h", t="Support hotline", s="one number per country", c=1.5, r=0, k="actor"),
          dict(id="l", t="Choose language", c=1.5, r=1),
          dict(id="a1", t="1 · Current ride", s="caller matched to ride", c=0, r=2, k="acc"),
          dict(id="a2", t="2 · Safety emergency", s="skips queue", c=1, r=2, k="alert"),
          dict(id="a3", t="3 · Payments", c=2, r=2), dict(id="a4", t="4 · Driver partners", c=3, r=2),
          dict(id="ai", t="AI assistant", s="status, ETA, simple fixes", c=0, r=3, k="info"),
          dict(id="sq", t="Safety team", s="answer < 30 s", c=1, r=3, k="alert"),
          dict(id="ag", t="Agent queue", s="ticket auto-created", c=2.5, r=3)]
    E2 = [dict(a="h", b="l"), dict(a="l", b="a1"), dict(a="l", b="a2"), dict(a="l", b="a3"), dict(a="l", b="a4"),
          dict(a="a1", b="ai"), dict(a="a2", b="sq", k="alert"), dict(a="a3", b="ag", bo=-60), dict(a="a4", b="ag", bo=60),
          dict(a="ai", b="ag", pa="b", pb="b", ym=376, l="hand off to agent", k="info")]
    ivr = flow(N2, E2, cw=215, rh=90, bw=180, bh=50, title="IVR for the support hotline")
    rules = table(["Rule", "Detail"], [
        ("Proxy binding", "A proxy number is bound to the rider–driver pair from DRIVER_ACCEPTED until 30 minutes after the trip ends."),
        ("Pool size", "Reuse is possible because a proxy is resolved by caller number + proxy number, so a small pool serves many rides."),
        ("After binding expires", "Calls to the proxy reach the support IVR instead of the other party."),
        ("Recording", "Only where the law allows, with an announcement at call start; stored encrypted with a retention period set per country."),
        ("Abuse limits", "Max calls per ride and per hour; repeated late-night calls after the trip trigger a safety review."),
        ("Fallback", "If WebRTC fails on a weak network, the app falls back to a phone call through the proxy number."),
    ])
    fname, body = arch_page("07", "telephony", "Telephony & masked calling", "Communication",
        "Rider and driver can call each other without ever seeing a real phone number, using Asterisk, Kamailio and WebRTC.",
        [sec("Architecture", "Call path", fig(svg, "In-app calls go over WebRTC; phone calls go through the SIP trunk. Both meet in Asterisk, which the Telephony service controls through ARI.", "07-telephony-architecture")),
         sec("Sequence", "A masked phone call", fig(sq, "The Telephony service decides who is called; Asterisk only carries audio.", "07-masked-call")),
         sec("Support line", "IVR menu", fig(ivr, "Callers are matched to their current ride automatically so they don't need to type a ride ID.", "07-ivr")),
         sec("Rules", "Number masking and recording", rules)])
    return fname, "Telephony & masked calling", body, "Asterisk/Kamailio call path, masked call sequence, IVR and recording rules."

# ============================================================ 08 Safety
def p08():
    parts = [("rid", "Rider App", "actor"), ("saf", "Safety Svc", "alert"), ("loc", "Location", "acc"), ("ops", "Ops Console", "info"),
             ("ntf", "Notifications", "n"), ("ec", "Emergency\ncontacts", "actor"), ("tel", "Telephony", "n")]
    M = [("m", "rid", "saf", "SOS pressed (hold 2 s)"), ("self", "saf", "create incident P1 · OPEN"),
         ("m", "saf", "loc", "switch trip to 1 s GPS"), ("async", "saf", "ops", "alarm on safety console"),
         ("async", "saf", "ntf", "alert contacts"), ("async", "ntf", "ec", "SMS/WhatsApp: live trip link"),
         ("m", "ops", "saf", "agent acknowledges (< 60 s)"), ("m", "ops", "tel", "call rider via masked line"),
         ("note", "rid", "tel", "The app shows a one-tap call to the local emergency number (112 in India and the EU, 911 in the US).\nThe platform never claims to have contacted police unless an agent actually did.", "alert"),
         ("m", "ops", "saf", "escalate / resolve with notes"), ("self", "saf", "evidence frozen: GPS, events, calls")]
    sq = seq(parts, M, colw=165, title="SOS sequence")
    N = [dict(id="o", t="OPEN", c=0, r=0, k="alert"), dict(id="a", t="ACKNOWLEDGED", s="agent assigned", c=1, r=0),
         dict(id="p", t="IN_PROGRESS", c=2, r=0), dict(id="e", t="ESCALATED", s="police · ambulance", c=3, r=0, k="alert"),
         dict(id="r", t="RESOLVED", c=3, r=1, k="acc"), dict(id="c", t="CLOSED", s="review done", c=4, r=1, k="acc"),
         dict(id="f", t="FALSE_ALARM", c=1, r=1)]
    E = [dict(a="o", b="a", l="< 60 s"), dict(a="a", b="p"), dict(a="p", b="e"), dict(a="p", b="r", pa="b", pb="l", l="handled"), dict(a="e", b="r"),
         dict(a="r", b="c"), dict(a="a", b="f", l="rider confirms safe")]
    sm = flow(N, E, cw=230, rh=96, bw=175, bh=50, title="Incident states")
    checks = table(["Check", "Trigger", "What happens"], [
        ("Route deviation", "Over 500 m off route for 2+ min", "Push to rider: \"Everything OK?\" No answer in 60 s → incident."),
        ("Long stop", "No movement 5 min (3 at night)", "Same check-in to rider and driver."),
        ("Over-speeding", "Speed above limit + 20 km/h for 30 s", "Driver warned; repeated cases go to driver quality review."),
        ("Trip sharing", "Rider taps Share", "Link with live map, driver and car details; expires when the trip ends."),
        ("Night ride check-in", "Trips between 22:00 and 05:00", "Automatic check-in at pickup and drop."),
        ("Driver selfie check", "Start of each shift", "Face match against the verified photo before going online."),
        ("Women safety options", "Rider preference", "Prefer women drivers where available; trusted contacts auto-notified."),
    ])
    fname, body = arch_page("08", "safety-sos", "Safety & SOS", "Trust",
        "SOS handling, automatic safety checks during trips, and how incidents are tracked until closed.",
        [sec("Sequence", "What happens when a rider presses SOS", fig(sq, "A driver SOS follows the same path from the driver app.", "08-sos-sequence")),
         sec("Incidents", "Incident lifecycle", fig(sm, "Every state change is audited with the agent's name and time.", "08-incident-states")),
         sec("Proactive", "Automatic safety checks", checks),
         sec("Screens", "Where safety appears", f'<div class="navlinks">{"".join(S(x) for x in ["R15","R16","R24","D18","A13"])}</div>')])
    return fname, "Safety & SOS", body, "SOS sequence, incident lifecycle and automatic trip safety checks."

# ============================================================ 09 AI
def p09():
    N = [dict(id="ev", t="Kafka events", s="ride · location · payment", c=0, r=0, k="data"),
         dict(id="pg", t="PostgreSQL", s="history", c=0, r=1, k="data", shape="db", h=60),
         dict(id="fp", t="Feature pipeline", s="Python consumers", c=1, r=0.5, k="info"),
         dict(id="on", t="Online features", s="Redis", c=2, r=0, k="data", shape="db", h=60),
         dict(id="off", t="Offline features", s="ClickHouse", c=2, r=1, k="data", shape="db", h=60),
         dict(id="tr", t="Training", s="scheduled jobs", c=2, r=2.1, k="info"),
         dict(id="reg", t="Model registry", s="MLflow", c=3, r=1, k="info"),
         dict(id="srv", t="Model serving", s="FastAPI · batched", c=3, r=0, k="info"),
         dict(id="use", t="Pricing · Dispatch\nFraud · Safety", c=4, r=0, k="acc", h=58),
         dict(id="hr", t="Human review queue", s="high-impact decisions", c=4, r=1, k="alert"),
         dict(id="mon", t="Drift & accuracy", s="Grafana alerts", c=4, r=2.1, k="warn")]
    E = [dict(a="ev", b="fp", pa="r", pb="l", bo=-12), dict(a="pg", b="fp", pa="r", pb="l", bo=12),
         dict(a="fp", b="on", pa="r", pb="l"), dict(a="fp", b="off", pa="r", pb="l"),
         dict(a="on", b="srv", l="features"), dict(a="off", b="tr"), dict(a="tr", b="reg", pa="r", pb="b", l="new version"),
         dict(a="reg", b="srv", l="deploy"), dict(a="srv", b="use", l="scores"), dict(a="use", b="hr", l="flag", k="alert"),
         dict(a="reg", b="mon", pa="r", pb="l", k="warn")]
    svg = flow(N, E, cw=230, rh=100, bw=180, bh=52, title="ML platform")
    models = table(["Model", "Input", "Output", "Who decides"], [
        ("ETA correction", "Route ETA, time, weather, zone traffic history", "Adjusted pickup and trip ETA", "Automatic"),
        ("Demand forecast", "Bookings per zone, events, weather", "Expected requests per zone per 15 min", "Ops use it to position drivers"),
        ("Surge recommendation", "Demand forecast vs online drivers", "Suggested multiplier", "Automatic within limits set by ops; caps per city"),
        ("Fraud risk", "Devices, accounts, payments, GPS, cancellations", "Risk score 0–100 + reasons", "Fraud analyst for any block or refund denial"),
        ("Safety anomaly", "Route, stops, speed, time of day", "Anomaly score", "Safety agent; model only raises a check-in"),
        ("Document OCR + face match", "Licence, RC, selfie", "Extracted fields, match score", "KYC reviewer approves"),
        ("Support assistant (LLM)", "Rider message + ride data via tools", "Answer or ticket", "Human agent for refunds above a limit and all safety topics"),
        ("Driver incentives", "Earnings, hours, zone demand", "Targets per driver", "Ops approves campaign budgets"),
    ])
    parts = [("rid", "Rider", "actor"), ("as", "Assistant svc", "info"), ("llm", "LLM provider", "ext"), ("ride", "Ride svc", "acc"), ("tk", "Support tickets", "n")]
    M = [("m", "rid", "as", "\"My driver hasn't arrived\""), ("m", "as", "llm", "message + allowed tools"),
         ("r", "llm", "as", "call get_ride_status(881)"), ("m", "as", "ride", "get_ride_status (rider's own ride only)"),
         ("r", "ride", "as", "DRIVER_ARRIVING, ETA 4 min, 1.1 km"), ("m", "as", "llm", "tool result"),
         ("r", "llm", "as", "answer text"), ("r", "as", "rid", "\"Arjun is 4 min away, 1.1 km…\""),
         ("sec", "If the rider asks for a refund over the limit or mentions safety"),
         ("m", "as", "tk", "create ticket, attach conversation"), ("r", "as", "rid", "\"A support agent will join this chat\"")]
    sq = seq(parts, M, colw=200, title="AI support assistant with tools")
    guard = """<ul class="clean"><li>The assistant can only call read tools for the signed-in user's own rides; writes go through tickets.</li>
<li>No model blocks an account, denies a refund, or files a report by itself. It raises a flag with reasons for a person.</li>
<li>Every prediction used in a decision is logged with model version and inputs for later review.</li>
<li>Personal data sent to an external LLM is minimised: ride IDs and status, never documents or card data.</li></ul>"""
    fname, body = arch_page("09", "ai-ml", "AI & machine learning", "Intelligence",
        "Where AI is used, how models are trained and served, and where people stay in charge.",
        [sec("Platform", "Data to decisions", fig(svg, "Online features serve real-time scoring; offline features train the next model version.", "09-ml-platform")),
         sec("Models", "What each model does", models),
         sec("Assistant", "Support assistant", fig(sq, "Tool calls let the assistant answer from real ride data instead of guessing.", "09-ai-assistant")),
         sec("Guardrails", "Rules for AI decisions", guard)])
    return fname, "AI & machine learning", body, "ML platform, model list, support assistant and AI guardrails."

# ============================================================ 10 Security
def p10():
    parts = [("app", "Rider / Driver App", "actor"), ("gw", "API Gateway", "info"), ("auth", "Auth Svc", "acc"), ("rds", "Redis", "data"), ("sms", "SMS adapter", "ext")]
    M = [("m", "app", "gw", "POST /auth/otp {phone, device_id}"), ("m", "gw", "auth", "rate limit: 3/phone/10 min"),
         ("m", "auth", "rds", "store OTP hash, 5 min TTL"), ("m", "auth", "sms", "send 6-digit OTP"), ("r", "auth", "app", "202 accepted"),
         ("m", "app", "gw", "POST /auth/verify {phone, otp}"), ("m", "gw", "auth", "verify"), ("m", "auth", "rds", "compare hash, max 5 tries"),
         ("self", "auth", "bind device, risk check"), ("r", "auth", "app", "access JWT 15 min + refresh 30 days"),
         ("sec", "Later"), ("m", "app", "auth", "POST /auth/refresh"), ("self", "auth", "rotate refresh, revoke old one"),
         ("note", "app", "sms", "Reuse of an old refresh token revokes the whole session family (token theft signal)", "alert")]
    sq = seq(parts, M, colw=195, title="OTP login and token refresh")
    N = [dict(id="i", t="Internet", c=0, r=0, k="ext"), dict(id="c", t="CDN + DDoS", c=1, r=0, k="info"), dict(id="w", t="WAF", s="OWASP rules", c=2, r=0, k="info"),
         dict(id="g", t="API Gateway", s="JWT · rate limits", c=3, r=0, k="info"), dict(id="s", t="Service", s="RBAC · validation", c=4, r=0, k="acc"),
         dict(id="d", t="Database", s="encrypted · least privilege", c=5, r=0, k="data", shape="db", h=60),
         dict(id="v", t="Vault / KMS", s="secrets · keys", c=3, r=1, k="warn"), dict(id="a", t="Audit log", s="append-only", c=5, r=1, k="warn")]
    E = [dict(a="i", b="c"), dict(a="c", b="w"), dict(a="w", b="g"), dict(a="g", b="s"), dict(a="s", b="d"), dict(a="v", b="s", pa="r", pb="b", bo=-30, l="secrets"), dict(a="s", b="a", pa="b", pb="l", ao=30, l="log")]
    dfn = flow(N, E, cw=200, rh=96, bw=160, bh=50, title="Defence in depth")
    roles = ["SUPER_ADMIN", "OPS_MANAGER", "SAFETY_MANAGER", "FRAUD_ANALYST", "FINANCE_MANAGER", "SUPPORT_AGENT", "FLEET_MANAGER", "AUDITOR"]
    perms = [("ride.view", "11111111"), ("ride.cancel", "11000100"), ("driver.verify", "11000000"), ("payment.refund", "10001100"),
             ("incident.view", "11110101"), ("incident.close", "10100000"), ("fraud.block_account", "10010000"),
             ("pricing.edit", "11000000"), ("report.export", "11111011"), ("government_report.create", "10100000"),
             ("government_report.approve", "10000000"), ("audit.view", "10000001"), ("user.pii.view_full", "10100000")]
    ck = lambda b: '<span style="color:#0B7A68;font-weight:800">✓</span>' if b == "1" else '<span style="color:#C3CCD3">·</span>'
    mtx = table(["Permission"] + [r.replace("_", " ") for r in roles], [[f"<code>{p}</code>"] + [ck(b) for b in bits] for p, bits in perms])
    tokens = table(["Item", "Setting"], [
        ("Access token (apps)", "JWT, 15 min, signed RS256, key rotated every 90 days"),
        ("Refresh token (apps)", "Opaque, 30 days, rotated on every use, bound to device"),
        ("Admin login", "OIDC via Keycloak, MFA required, session 8 h, idle timeout 30 min"),
        ("Service-to-service", "mTLS inside the cluster + short-lived service tokens"),
        ("Secrets", "Vault; nothing in images or git; database passwords rotated automatically"),
        ("PII at rest", "Column encryption for ID numbers and bank details; masked in the UI by default"),
        ("Files", "Signed URLs valid 5 minutes; antivirus scan and type check on upload"),
    ])
    cls = table(["Data class", "Examples", "Protection"], [
        ("Restricted", "ID numbers, bank accounts, call recordings, SOS evidence", "Encrypted column or bucket, access logged, only named roles"),
        ("Confidential", "Phone numbers, addresses, trip history, ratings", "Masked in UI, full view needs permission"),
        ("Internal", "Pricing rules, zone configs, metrics", "Staff only"),
        ("Public", "Service areas, fare cards", "Published"),
    ])
    fname, body = arch_page("10", "security-rbac", "Security & access control", "Security",
        "Authentication, token handling, layered defences and the role-based permission model.",
        [sec("Login", "OTP and tokens", fig(sq, "OTPs are stored hashed and expire in 5 minutes.", "10-otp-login")),
         sec("Layers", "Defence in depth", fig(dfn, "Every request passes each layer; the service still checks permissions even after the gateway.", "10-defence-layers")),
         sec("RBAC", "Roles and permissions", mtx, '<p>Permissions are checked in every service, never only in the UI. Fleet managers are also limited to rows of their own fleet (row-level rule).</p>'),
         sec("Tokens", "Session and secret settings", tokens), sec("Data", "Data classification", cls)])
    return fname, "Security & access control", body, "OTP login, token rotation, defence layers, RBAC matrix and data classes."

PAGES = [p06, p07, p08, p09, p10]
