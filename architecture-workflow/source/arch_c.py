from archlib import *

# ============================================================ 11 Data
def p11():
    T = lambda id, name, cols, c, r, k="data": dict(id=id, t=name, s="\n".join(cols), c=c, r=r, k=k, h=26 + 14*len(cols))
    N = [T("u", "identity.users", ["id · phone · email", "role · status · created_at"], 0, 0),
         T("rd", "users.riders", ["user_id → users", "name · rating · home/work"], 0, 1),
         T("dr", "drivers.drivers", ["user_id → users", "status · rating · kyc_status", "vehicle_id → vehicles"], 1, 0),
         T("dd", "drivers.driver_documents", ["driver_id · type · number_enc", "expires_on · status · file_key"], 1, 1),
         T("v", "vehicles.vehicles", ["id · fleet_id · type", "plate · model · permit_expiry"], 2, 0),
         T("r", "rides.rides", ["id · rider_id · driver_id", "status · pickup · drop", "quote_id · fare_final"], 1, 2.2, "acc"),
         T("re", "rides.ride_events", ["ride_id · from → to state", "actor · at · lat/lng"], 0, 3.3, "acc"),
         T("rl", "location.ride_locations", ["ride_id · ts · lat/lng", "speed · partitioned by day"], 1, 3.3),
         T("p", "payments.payments", ["id · ride_id · method", "amount · currency · status"], 2, 2.2),
         T("le", "ledger.entries", ["txn_id · account", "debit · credit · currency"], 3, 2.2),
         T("in", "safety.incidents", ["id · ride_id · type", "priority · status · assignee"], 2, 3.3, "alert"),
         T("cl", "telephony.call_logs", ["ride_id · proxy · duration", "recording_key"], 3, 3.3),
         T("au", "audit.audit_logs", ["actor · action · entity", "before · after · ip · at"], 3, 0, "warn")]
    E = [dict(a="rd", b="u", l="1:1"), dict(a="dr", b="u", pa="l", pb="r", l="1:1"), dict(a="dd", b="dr", l="n:1"),
         dict(a="dr", b="v", pa="r", pb="l", l="n:1"), dict(a="r", b="dd", pa="t", pb="b", ao=0),
         dict(a="r", b="re", pa="b", pb="t", ao=-40, l="1:n"), dict(a="r", b="rl", l="1:n"), dict(a="r", b="p", pa="r", pb="l", l="1:n"),
         dict(a="p", b="le", pa="r", pb="l", l="1:n"), dict(a="r", b="in", pa="b", pb="t", ao=40, l="0:n"), dict(a="in", b="cl", pa="r", pb="l", l="evidence")]
    E[4] = dict(a="r", b="rd", pa="l", pb="b", l="rider")
    svg = flow(N, E, cw=270, rh=120, bw=225, bh=66, title="Core tables (simplified)")
    schemas = table(["Schema", "Main tables"], [
        ("identity", "users, credentials, devices, sessions, otp_attempts"),
        ("users", "riders, saved_places, emergency_contacts, preferences"),
        ("drivers", "drivers, driver_documents, driver_status_log, shifts"),
        ("vehicles", "vehicles, vehicle_types, fleets, fleet_members"),
        ("kyc", "verifications, review_tasks, decisions"),
        ("rides", "rides, ride_events, cancellations, ratings, scheduled_rides"),
        ("dispatch", "offers, offer_responses"),
        ("pricing", "fare_rules, surge_zones, quotes, tolls, tax_rules"),
        ("location", "ride_locations (partitioned), geofences, zones"),
        ("payments", "payments, payment_attempts, refunds, webhooks_inbox"),
        ("ledger", "accounts, transactions, entries, payouts"),
        ("promotions", "coupons, redemptions, referrals, campaigns"),
        ("telephony", "proxy_numbers, call_logs, ivr_sessions"),
        ("support", "tickets, messages, lost_items"),
        ("safety", "incidents, incident_events, evidence, trip_shares"),
        ("fraud", "risk_scores, risk_events, device_fingerprints, cases"),
        ("reporting", "gov_reports, report_approvals, exports, retention_jobs"),
        ("audit", "audit_logs (append-only, monthly partitions)"),
        ("configuration", "settings, feature_flags, cities, translations"),
    ], mono_cols=(0,))
    redis = table(["Key pattern", "Type", "TTL", "Used for"], [
        ("drivers:geo:{city}:{vehicle}", "GEO set", "—", "Nearby driver search"),
        ("driver:{id}:state", "Hash", "60 s, refreshed", "Online, busy, last ping"),
        ("lock:driver:{id}", "String", "20 s", "Only one offer per driver"),
        ("otp:{phone}", "Hash", "5 min", "OTP hash and attempts"),
        ("quote:{id}", "Hash", "5 min", "Locked fare quote"),
        ("rl:{scope}:{key}", "Counter", "window", "Rate limits"),
        ("ws:ride:{id}", "Pub/Sub", "—", "Live updates to rider and ops"),
        ("proxy:{number}:{caller}", "String", "trip + 30 min", "Masked call routing"),
    ], mono_cols=(0,))
    buckets = table(["MinIO bucket", "Contents", "Access"], [
        ("kyc-documents", "Licences, RC, insurance, permits, selfies", "KYC reviewers; signed URLs; encrypted"),
        ("call-recordings", "Consented recordings", "Safety and support leads only"),
        ("evidence", "Frozen incident evidence packages", "Safety manager, legal; write-once lock"),
        ("invoices", "Ride invoices (PDF)", "Rider, finance"),
        ("exports", "Report exports, government reports", "Named approvers; auto-delete after 30 days"),
        ("backups", "Database and config backups", "Ops automation only; separate account"),
    ], mono_cols=(0,))
    scale = """<ul class="clean"><li><b>Partitioning:</b> ride_locations by day, audit_logs and ride_events by month, dropped by the retention job.</li>
<li><b>Read replicas</b> serve admin dashboards and reports so they never slow down bookings.</li>
<li><b>Money columns</b> are <code>numeric(12,2)</code> with an explicit <code>currency</code> column; never floats.</li>
<li><b>Times</b> are stored in UTC and shown in the city's time zone.</li>
<li><b>Soft delete</b> for users (deletion requests anonymise personal fields but keep financial records required by law).</li></ul>"""
    fname, body = arch_page("11", "data-architecture", "Data architecture", "Data",
        "PostgreSQL schemas and core tables, Redis keys, file buckets and how data is partitioned.",
        [sec("Model", "Core tables", fig(svg, "Each box is a table in its own service schema. Cross-schema links are IDs, not database foreign keys.", "11-core-tables")),
         sec("Schemas", "PostgreSQL schemas", schemas), sec("Redis", "Fast, temporary state", redis),
         sec("Files", "Object storage", buckets), sec("Scaling", "Data rules", scale)])
    return fname, "Data architecture", body, "Core tables, PostgreSQL schemas, Redis keys, buckets and data rules."

# ============================================================ 12 Events
def p12():
    N = [dict(id="svc", t="Ride service", s="handles request", c=0, r=0, k="acc"),
         dict(id="tx", t="One DB transaction", s="rides row + outbox row", c=1, r=0, k="data", shape="db", h=62),
         dict(id="rel", t="Outbox relay", s="Debezium / poller", c=2, r=0),
         dict(id="kf", t="Kafka topic", s="ride.events", c=3, r=0, k="data"),
         dict(id="c1", t="Consumer", s="checks processed_events", c=3, r=1.2, k="acc"),
         dict(id="ok", t="Apply change", s="+ record event id", c=2, r=1.2),
         dict(id="dlq", t="Dead-letter topic", s="after 5 retries", c=4, r=1.2, k="alert")]
    E = [dict(a="svc", b="tx"), dict(a="tx", b="rel"), dict(a="rel", b="kf"), dict(a="kf", b="c1"),
         dict(a="c1", b="ok", l="new"), dict(a="c1", b="dlq", l="keeps failing", k="alert")]
    svg = flow(N, E, cw=220, rh=100, bw=180, bh=52, title="Transactional outbox and idempotent consumers")
    topics = table(["Topic", "Key", "Producer", "Main consumers", "Retention"], [
        ("ride.events", "ride_id", "Ride", "Dispatch, Payments, Notifications, Safety, Fraud, Analytics", "7 days"),
        ("dispatch.events", "ride_id", "Dispatch", "Ride, Analytics", "3 days"),
        ("location.updated", "driver_id", "Location", "Rider live map, Geofence, Safety, Trip recorder, ML", "24 h"),
        ("payment.events", "ride_id", "Payments", "Ledger, Notifications, Ride, Fraud", "30 days"),
        ("safety.events", "incident_id", "Safety", "Ops console, Notifications, Reporting", "90 days"),
        ("fraud.events", "subject_id", "Fraud", "Auth (blocks), Promotions, Reporting", "30 days"),
        ("user.events", "user_id", "Auth, Riders, Drivers", "Notifications, KYC, Analytics", "7 days"),
        ("audit.events", "entity_id", "All services", "Audit service", "30 days (then in PostgreSQL)"),
        ("*.dlq", "same", "Consumers", "On-call engineer via alert", "14 days"),
    ], mono_cols=(0, 1))
    env = """<div class="card"><pre style="margin:0;font-family:var(--mono);font-size:13px;overflow-x:auto">{
  "event_id": "01J9ZQ4Y6R8Q2F7M3N5T0W1XKD",
  "type": "ride.completed",
  "version": 2,
  "occurred_at": "2026-09-27T12:42:18Z",
  "producer": "ride-service",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "city": "HYD",
  "key": "ride_881",
  "data": {
    "ride_id": "ride_881", "rider_id": "usr_1042", "driver_id": "drv_42",
    "vehicle_type": "cab", "distance_km": 12.4, "duration_min": 27,
    "fare": {"amount": "300.00", "currency": "INR"}, "payment_method": "upi"
  }
}</pre></div>"""
    rules = """<ul class="clean"><li>Events are facts in past tense (<code>ride.completed</code>), never commands.</li>
<li>Adding fields is allowed; removing or renaming a field needs a new <code>version</code> and both versions published during migration.</li>
<li>Consumers must be idempotent: the same event may arrive twice.</li>
<li>Order is guaranteed only per key, so everything about one ride uses <code>ride_id</code> as the key.</li></ul>"""
    fname, body = arch_page("12", "events-kafka", "Events & messaging", "Async",
        "The Kafka topics, the event format and the outbox pattern that keeps the database and events in sync.",
        [sec("Pattern", "Never lose an event", fig(svg, "Writing the row and the outbox record in one transaction means an event is published if and only if the change was saved.", "12-outbox")),
         sec("Topics", "Topic catalogue", topics), sec("Envelope", "Event format", env), sec("Rules", "Event rules", rules)])
    return fname, "Events & messaging", body, "Kafka topics, outbox pattern, event envelope and rules."

# ============================================================ 13 DevOps
def p13():
    steps = [("c", "Commit / PR", "actor"), ("l", "Lint · types", "n"), ("u", "Unit tests", "n"), ("s", "SAST · deps · secrets", "warn"),
             ("b", "Build images", "n"), ("i", "Integration tests", "n"), ("st", "Deploy staging", "info"), ("e", "Smoke + E2E", "n"),
             ("a", "Approval", "warn"), ("cn", "Canary 5%", "acc"), ("f", "Full rollout", "acc")]
    N = [dict(id=i, t=t, c=n % 6, r=n // 6, k=k) for n, (i, t, k) in enumerate(steps)]
    N.append(dict(id="rb", t="Automatic rollback", s="error rate or latency up", c=3.5, r=2, k="alert"))
    E = [dict(a=steps[i][0], b=steps[i+1][0]) for i in range(len(steps)-1) if i != 5]
    E.append(dict(a="i", b="st", pa="b", pb="t", l="push image to registry"))
    E.append(dict(a="cn", b="rb", l="bad metrics", k="alert"))
    E.append(dict(a="f", b="rb", k="alert"))
    svg = flow(N, E, cw=200, rh=100, bw=165, bh=50, title="CI/CD pipeline")
    K = [dict(id="dns", t="Global DNS / CDN", s="geo routing", c=2, r=0, k="ext"),
         dict(id="ing", t="Ingress + LB", s="TLS · WAF", c=2, r=1, k="info"),
         dict(id="edge", t="edge namespace", s="API gateway · WS gateway", c=0, r=2.2, k="info"),
         dict(id="app", t="apps namespace", s="FastAPI services · HPA", c=1.33, r=2.2, k="acc"),
         dict(id="wrk", t="workers namespace", s="Celery · consumers", c=2.66, r=2.2, k="acc"),
         dict(id="ml", t="ml namespace", s="model serving", c=4, r=2.2, k="info"),
         dict(id="tel", t="Telephony hosts", s="Asterisk · Kamailio (VMs)", c=0, r=3.4),
         dict(id="pg", t="PostgreSQL", s="primary + 2 replicas", c=1.33, r=3.4, k="data", shape="db", h=62),
         dict(id="kf", t="Kafka cluster", s="3 brokers", c=2.66, r=3.4, k="data", shape="db", h=62),
         dict(id="rd", t="Redis", s="primary + replica", c=4, r=3.4, k="data", shape="db", h=62)]
    KE = [dict(a="dns", b="ing"), dict(a="ing", b="edge"), dict(a="ing", b="app", ao=-20), dict(a="edge", b="tel", l="SIP"),
          dict(a="app", b="pg"), dict(a="wrk", b="kf"), dict(a="ml", b="rd")]
    k8s = flow(K, KE, cw=210, rh=100, bw=180, bh=52, title="Production deployment · one region")
    R = [dict(id="u", t="Riders & drivers", s="worldwide", c=1.5, r=0, k="actor"),
         dict(id="g", t="Geo DNS", s="nearest healthy region", c=1.5, r=1, k="ext"),
         dict(id="in", t="Region: India", s="full stack · data stays in India", c=0, r=2.1, k="acc"),
         dict(id="me", t="Region: Middle East", s="full stack", c=1, r=2.1, k="acc"),
         dict(id="eu", t="Region: Europe", s="full stack · GDPR", c=2, r=2.1, k="acc"),
         dict(id="us", t="Region: Americas", s="full stack", c=3, r=2.1, k="acc"),
         dict(id="gl", t="Global control plane", s="config · releases · aggregated analytics (no raw PII)", c=0.5, r=3.3, w=3, k="warn")]
    RE = [dict(a="u", b="g"), dict(a="g", b="in"), dict(a="g", b="me"), dict(a="g", b="eu"), dict(a="g", b="us"),
          dict(a="in", b="gl", k="warn", dash=True), dict(a="us", b="gl", k="warn", dash=True)]
    reg = flow(R, RE, cw=220, rh=90, bw=190, bh=52, title="Global rollout · region cells")
    envs = table(["Environment", "Where", "Purpose"], [
        ("Local", "Windows 11 + WSL2 + Docker Desktop", "Every developer runs the full stack with docker-compose and seed data."),
        ("CI", "GitHub Actions or GitLab CI runners", "Tests, scans, image builds on every pull request."),
        ("Staging", "Same as production, smaller", "Release candidates, QA, load tests, payment sandbox."),
        ("Production", "Kubernetes per region + managed databases", "Live traffic, canary releases, autoscaling."),
    ])
    local = table(["Container", "Image", "Port"], [
        ("api", "python:3.12 + FastAPI (all services as a modular monolith)", "8000"), ("worker", "same image, Celery", "—"),
        ("ws-gateway", "FastAPI WebSockets", "8081"), ("admin-web", "node:20 + Vite dev server", "5173"),
        ("postgres", "postgres:16 + PostGIS", "5432"), ("redis", "redis:7", "6379"), ("kafka", "Kafka in KRaft mode", "9092"),
        ("minio", "minio/minio", "9000 / 9001"), ("nginx", "nginx:stable", "80 / 443"), ("asterisk", "Asterisk 20 with PJSIP", "5060 / 8088"),
        ("prometheus · grafana · loki", "monitoring stack", "9090 / 3000 / 3100"), ("opensearch", "opensearch", "9200"),
        ("mailpit", "fake SMTP to see emails", "8025")], mono_cols=(2,))
    fname, body = arch_page("13", "devops-deployment", "DevOps & deployment", "Operations",
        "How code moves from a laptop to production, how production is laid out, and how the platform expands to new countries.",
        [sec("Pipeline", "CI/CD", fig(svg, "Canary releases watch error rate and p95 latency for 15 minutes before rolling out further.", "13-cicd")),
         sec("Runtime", "Production layout", fig(k8s, "Stateless services scale automatically; databases run as managed services or on dedicated nodes.", "13-kubernetes")),
         sec("Global", "Region cells", fig(reg, "Each region is a complete copy of the platform. A problem in one region never takes down another, and personal data stays in its region.", "13-regions")),
         sec("Environments", "Environments", envs), sec("Local setup", "docker-compose services on your Windows machine", local)])
    return fname, "DevOps & deployment", body, "CI/CD pipeline, Kubernetes layout, region cells, environments and local setup."

# ============================================================ 14 Observability & DR
def p14():
    N = [dict(id="s", t="Services & apps", s="metrics · logs · traces", c=0, r=0, k="acc"),
         dict(id="o", t="OTel collector", c=1, r=0, k="info"),
         dict(id="p", t="Prometheus", s="metrics", c=2, r=-0.7, k="data"), dict(id="l", t="Loki", s="logs", c=2, r=0.3, k="data"),
         dict(id="t", t="Tempo", s="traces", c=2, r=1.3, k="data"),
         dict(id="g", t="Grafana", s="dashboards", c=3, r=0.3, k="info"),
         dict(id="a", t="Alertmanager", c=4, r=-0.7, k="warn"), dict(id="oc", t="On-call", s="phone · Slack", c=4, r=0.6, k="alert")]
    E = [dict(a="s", b="o"), dict(a="o", b="p", pa="r", pb="l"), dict(a="o", b="l", pa="r", pb="l"), dict(a="o", b="t", pa="r", pb="l"),
         dict(a="p", b="g", pa="r", pb="l", bo=-14), dict(a="l", b="g"), dict(a="t", b="g", pa="r", pb="l", bo=14),
         dict(a="p", b="a", l="rules"), dict(a="a", b="oc")]
    svg = flow(N, E, cw=210, rh=90, bw=170, bh=48, title="Monitoring pipeline")
    slo = table(["What", "Target (SLO)", "Alert when"], [
        ("Booking API success", "99.9% per month", "Error rate > 1% for 5 min"),
        ("Fare estimate latency", "p95 < 800 ms", "p95 > 1.2 s for 10 min"),
        ("Driver match time", "p50 < 30 s", "p50 > 60 s in any city for 10 min"),
        ("Location freshness", "95% of online drivers updated in last 15 s", "Below 85%"),
        ("SOS acknowledged", "100% within 60 s", "Any SOS unacknowledged after 45 s"),
        ("Payment webhook lag", "p99 < 2 min", "Any webhook older than 15 min"),
        ("Masked call setup", "98% connect", "Below 95% for 10 min"),
    ])
    deg = table(["If this fails", "The platform keeps working by"], [
        ("Maps provider", "Switching to the backup provider; if both fail, straight-line estimates with a 'fare may change' note."),
        ("Payment gateway", "Offering cash or wallet; failed online payments settled later."),
        ("SMS provider", "Falling back to a second SMS provider or WhatsApp for OTP."),
        ("Kafka", "Services keep writing to the outbox; events flow once Kafka is back, nothing is lost."),
        ("Redis", "Dispatch pauses new matches for a few seconds while the replica is promoted; running trips are unaffected."),
        ("AI models", "Rules-based fallbacks: fixed surge caps, simple ETA, fraud rules only."),
        ("Telephony", "In-app chat stays available; calls fall back to a second SIP trunk."),
    ])
    dr = table(["Data", "Backup", "RPO (max data loss)", "RTO (time to restore)"], [
        ("PostgreSQL", "Continuous WAL archiving + daily full, point-in-time recovery", "5 minutes", "1 hour"),
        ("Redis", "Replica; state is rebuildable from drivers' next pings", "seconds", "5 minutes"),
        ("Kafka", "3 replicas per partition", "0", "15 minutes"),
        ("MinIO", "Versioning + replication to another zone", "15 minutes", "2 hours"),
        ("Configuration & secrets", "Git + Vault snapshots", "0", "30 minutes"),
    ])
    fname, body = arch_page("14", "observability-dr", "Monitoring, reliability & recovery", "Operations",
        "What is measured, when people get woken up, how the platform degrades gracefully and how data is recovered.",
        [sec("Monitoring", "Metrics, logs and traces", fig(svg, "Every request carries one trace ID from the app through all services, so any slow ride can be followed end to end.", "14-monitoring")),
         sec("Targets", "Service level objectives", slo), sec("Resilience", "Graceful degradation", deg), sec("Recovery", "Backup and disaster recovery", dr,
             '<p class="note">Restores are rehearsed every quarter on staging; an untested backup is not counted as a backup.</p>')])
    return fname, "Monitoring, reliability & recovery", body, "Monitoring stack, SLOs, graceful degradation and backup targets."

# ============================================================ 15 Compliance
def p15():
    N = [dict(id="s", t="Signal", s="SOS · complaint · fraud flag\nlaw-enforcement request", c=0, r=0, k="alert", h=62),
         dict(id="f", t="Flag", s="auto or staff", c=1, r=0),
         dict(id="h", t="Human review", s="SAFETY_MANAGER", c=2, r=0, k="acc"),
         dict(id="c", t="Classify", s="type · severity · country", c=3, r=0, k="acc"),
         dict(id="e", t="Evidence package", s="GPS · events · calls · docs", c=3, r=1.1, k="acc"),
         dict(id="a", t="Approval", s="government_report.approve", c=2, r=1.1, k="warn"),
         dict(id="r", t="Report sent", s="portal · API · signed PDF", c=1, r=1.1, k="acc"),
         dict(id="au", t="Audit trail", s="who · what · when", c=0, r=1.1, k="warn")]
    E = [dict(a="s", b="f"), dict(a="f", b="h"), dict(a="h", b="c"), dict(a="c", b="e"), dict(a="e", b="a"), dict(a="a", b="r"), dict(a="r", b="au")]
    svg = flow(N, E, cw=230, rh=100, bw=190, bh=56, title="Regulatory reporting pipeline")
    regs = table(["Region", "Rules to plan for", "What it means for the platform"], [
        ("India", "Motor Vehicle Aggregator Guidelines (MoRTH) and state rules; Digital Personal Data Protection Act 2023; CERT-In cyber incident directions",
         "Driver verification and training records, panic button and tracking, fare caps where set by states, consent and data rights, incident reporting to CERT-In within hours."),
        ("European Union", "GDPR; national taxi and private-hire laws", "Lawful basis per data use, data export and erasure on request, data kept in the EU region."),
        ("United States", "State and city TNC rules; CCPA/CPRA and other state privacy laws", "Insurance proof, background checks per state, privacy notices and opt-outs."),
        ("Middle East", "Local transport authority rules (for example Dubai RTA); local data laws", "Licensed operators and vehicles, data residency where required."),
    ])
    reports = table(["Report", "Trigger", "Contents", "Approved by"], [
        ("Safety incident report", "Serious SOS or accident", "Ride, parties, GPS trail, timeline, actions taken", "Safety manager"),
        ("Law-enforcement response", "Verified legal request", "Only the data the request covers", "Legal + safety manager"),
        ("Driver document violation", "Expired or fake document found", "Driver, vehicle, document, action taken", "Operations manager"),
        ("Data breach notification", "Confirmed personal data breach", "Scope, data types, users affected, measures", "Data protection officer"),
        ("Periodic compliance return", "Monthly or quarterly as required", "Trips, drivers, complaints, safety stats", "Compliance lead"),
        ("Tax reports", "Monthly", "Tax collected on rides and daily fees", "Finance manager"),
    ])
    ret = table(["Data", "Keep for", "Then"], [
        ("Trip records and invoices", "As required by tax law (often 7–8 years)", "Archive, then delete"),
        ("GPS trails", "180 days (longer if linked to an incident)", "Delete"),
        ("Call recordings", "90 days unless under investigation", "Delete"),
        ("KYC documents", "While active + period required by local rules", "Delete"),
        ("Audit logs", "At least 3 years", "Archive"),
        ("Incident evidence", "Until the case closes + legal hold period", "Delete after legal sign-off"),
    ])
    fname, body = arch_page("15", "compliance-government", "Compliance & government reporting", "Compliance",
        "How incidents turn into official reports, which rules apply by region and how long each kind of data is kept.",
        [sec("Pipeline", "From signal to report", fig(svg, "AI and automatic checks can only raise a flag. A person reviews, classifies and approves before anything is sent to an authority.", "15-reporting-pipeline")),
         sec("Regions", "Regulations by region", regs, '<p class="note">This is a planning list, not legal advice. Confirm current rules with a lawyer in each country before launch; they change often.</p>'),
         sec("Reports", "Report types", reports), sec("Retention", "How long data is kept", ret,
             '<p>Retention periods are configuration per country, enforced by a nightly job that also writes an audit entry.</p>')])
    return fname, "Compliance & government reporting", body, "Reporting pipeline, regulations by region, report types and retention."

PAGES = [p11, p12, p13, p14, p15]
