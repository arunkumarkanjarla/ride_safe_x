from components import *
import random

random.seed(7)
def cars(n, w, h):
    return [(random.randint(20, w-20), random.randint(20, h-20), random.choice([0, 90, 45, 135])) for _ in range(n)]
def amap(w, h, n=30, **kw):
    return map_svg(w, h, cars=cars(n, w, h), labels=True, **kw)
def card(title, body, right="", style=""):
    return f'<div class="dcard" style="{style}"><div class="hd"><b>{title}</b><span class="sp">{right}</span></div>{body}</div>'
def grid(cols, *items, style=""):
    return f'<div class="dgrid" style="grid-template-columns:{cols};{style}">{"".join(items)}</div>'
def field(label, value):
    return f'<div class="dfield"><label>{label}</label><div class="box">{value}</div></div>'
def tl(items):
    return '<div class="tl">' + "".join(f'<div class="e"><span class="tm">{t}</span><span class="dt2 {k}"></span><span>{x}</span></div>' for t, x, k in items) + "</div>"
def filters(*chips, right=""):
    c = "".join(f'<span class="st {"ok" if i==0 else ""}" style="padding:5px 10px;font-size:12px">{x}</span>' for i, x in enumerate(chips))
    return f'<div style="display:flex;gap:8px;align-items:center">{c}<span style="margin-left:auto;display:flex;gap:8px">{right}</span></div>'
dbtn = lambda t, k="": f'<span class="dbtn {k}">{t}</span>'

S = []

# A01
login = f'''<div class="desk" style="grid-template-columns:1fr 1fr">
<div style="background:linear-gradient(150deg,#0B7A68,#0A3F38);color:#fff;padding:48px;display:flex;flex-direction:column;gap:14px;justify-content:center">
<div style="display:flex;align-items:center;gap:10px;font-size:26px;font-weight:800"><i style="width:34px;height:34px;border-radius:9px;background:#fff;display:inline-block"></i>{B()}</div>
<div style="font-size:30px;font-weight:800;line-height:1.15;max-width:420px">Operations console</div><div style="opacity:.8;max-width:420px">For operations, safety, finance and support teams. Every action is recorded in the audit log.</div></div>
<div style="background:#fff;display:flex;align-items:center;justify-content:center"><div style="width:360px;display:flex;flex-direction:column;gap:14px">
<div style="font-size:22px;font-weight:800">Two-step verification</div><div style="color:#667685">Enter the 6-digit code from your authenticator app for <b>priya.k@ridenova.example</b>.</div>
<div style="display:flex;gap:8px">{"".join(f'<span style="width:48px;height:54px;border:1.5px solid {"#0B7A68" if i==4 else "#E1E7EC"};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700">{c}</span>' for i, c in enumerate("7309  "[:6]))}</div>
<label style="display:flex;gap:8px;align-items:center;color:#667685"><span style="width:16px;height:16px;border:1.5px solid #C3CCD3;border-radius:4px"></span>Trust this browser for 12 hours</label>
<span class="dbtn" style="height:42px;justify-content:center;font-size:14px">Verify and sign in</span>
<div style="color:#667685;font-size:12.5px">Lost your device? Use a recovery code or contact your security admin.</div>
<div style="border-top:1px solid #E1E7EC;padding-top:12px;color:#667685;font-size:12.5px">Signed in with company SSO (OIDC). Sessions end after 30 minutes idle.</div></div></div></div>'''
S.append(dict(id="A01", mock=login,
    purpose="Staff sign-in through company single sign-on with mandatory two-step verification.",
    how=["Staff enter email; the portal redirects to the identity provider (Keycloak or the company's SSO).", "Password is checked by the identity provider, never by the portal itself.", "A TOTP code or security key is required for every staff account.", "The portal receives an OIDC token with roles; the session lasts 8 hours with a 30-minute idle timeout."],
    elements=["Brand panel", "MFA code entry", "Trust this browser option", "Verify button", "Recovery help"],
    apis=[("GET", "/oidc/authorize", "Start SSO"), ("POST", "/oidc/token", "Exchange code for tokens"), ("GET", "/v1/admin/me", "Roles and permissions")],
    events=["admin.logged_in", "admin.login_failed"], data=["Keycloak realm", "audit.audit_logs"], to=["A02"],
    edge=["5 failed attempts lock the account and alert security.", "Login from a new country requires re-verification.", "Accounts of people who left are disabled from the HR system automatically."]))

# A02
kp = ('<div class="kpis">' + kpi("Active rides", "1,245", "+8% vs last hour") + kpi("Online drivers", "3,482", "74% busy") + kpi("Waiting requests", "182", "p50 match 24 s")
      + kpi("Open SOS", "3", "oldest 0:48", True, True) + kpi("Payment failures", "9", "last 15 min", True) + kpi("Avg pickup", "4.2 min", "−0.3 min") + '</div>')
mp = card("Live operations · Hyderabad", f'<div class="dmap">{amap(640, 330, 55, heat=[(420,120,70),(160,230,55)], zones=[([(360,40),(520,40),(540,180),(380,200)], "#E8590C", "Surge 1.3×")])}</div>',
          '<span class="st">All vehicles ▾</span><span class="st">Cab</span>', "height:390px")
sos = card("Safety alerts", dtable(["Ride", "Type", "Age", ""], [["RN-00125", st("SOS", "err"), "0:48", st("Unassigned", "err")], ["RN-00098", st("Route deviation", "warn"), "2:10", "Meera"], ["RN-00077", st("Long stop", "warn"), "4:32", "Vikram"]]), '<span class="dbtn r">Open console</span>')
att = card("Needs attention", dtable(["Item", "Count"], [["KYC documents waiting", "12"], ["Payouts failed", "4"], ["Tickets past SLA", "7"], ["Fraud cases high risk", "5"]]))
ch = card("Rides per hour · today vs last week", line_chart(560, 120, [[120, 180, 260, 420, 610, 700, 820, 760, 690, 720, 910, 1245], [110, 170, 240, 390, 580, 690, 770, 740, 700, 690, 860, 1100]]))
cities = card("Cities", dtable(["City", "Active", "Online", "Match p50", "Health"], [["Hyderabad", "1,245", "3,482", "24 s", st("OK", "ok")], ["Bengaluru", "2,108", "5,020", "31 s", st("OK", "ok")], ["Dubai", "412", "960", "58 s", st("Slow", "warn")]]))
S.append(dict(id="A02", mock=desk("dash", "Operations command center", kp + grid("1.65fr 1fr", mp, f'<div style="display:flex;flex-direction:column;gap:14px">{sos}{att}</div>') + grid("1.2fr 1fr", ch, cities, style="flex:1"), right='<span class="st ok" style="margin-left:14px">● Live</span>'),
    purpose="One screen that tells the operations team, at a glance, whether the city is healthy and what needs action right now.",
    how=["KPIs stream over WebSocket every 5 s from aggregated Kafka metrics.", "Map shows driver positions (sampled), demand heat and surge zones.", "Safety alerts sort by age; an unassigned SOS over 45 s turns the tile red and pages the safety lead.", "Every tile links to the detailed screen."],
    elements=["KPI row with deltas", "Live city map with heat and surge zones", "Safety alerts list", "Work queues needing attention", "Rides per hour chart", "City health table"],
    apis=[("WS", "/ws/admin/ops?city=HYD", "Live KPIs and alerts"), ("GET", "/v1/admin/queues/summary", "Queue counts"), ("GET", "/v1/admin/metrics/rides-per-hour", "Chart data")],
    data=["Analytics store (ClickHouse)", "Redis live counters"], to=["A03", "A13", "A07", "A12", "A14", "A11", "A04"],
    edge=["If live data is older than 30 s, a grey 'stale' label appears on each tile.", "Views are filtered by the user's cities and role."]))

# A03
side = card("Driver · Arjun K.", f'''<div style="display:flex;gap:10px;align-items:center"><span class="av">AK</span><div><b>Arjun K.</b> ★ 4.9<div style="color:#667685;font-size:12px">TS 09 EA 4521 · Swift Dzire</div></div></div>
{st("On trip", "info")}<div class="kv" style="display:flex;justify-content:space-between"><span>Ride</span><b>RN-00125</b></div><div style="display:flex;justify-content:space-between"><span>Speed</span><b>38 km/h</b></div>
<div style="display:flex;justify-content:space-between"><span>Last ping</span><b>3 s ago</b></div><div style="display:flex;justify-content:space-between"><span>Today</span><b>7 trips · ₹1,240</b></div>
<div style="display:flex;gap:6px;flex-wrap:wrap">{dbtn("Open ride")}{dbtn("Call driver","g")}{dbtn("Message","g")}</div>''', style="width:280px")
lmap = f'<div class="dmap" style="height:640px">{amap(760, 640, 90, heat=[(520,200,90),(200,420,70)], route=[(330,470),(330,330),(470,330),(470,210)], pickup=(330,470), drop=(470,210))}</div>'
leg = '<div style="display:flex;gap:14px;font-size:12px;color:#667685"><span>● Available 1,540</span><span>● On trip 1,245</span><span>● Offer pending 97</span><span>▢ Surge zones 4</span></div>'
S.append(dict(id="A03", mock=desk("live", "Live map", filters("All", "Available", "On trip", "Offer pending", "SOS", right='<span class="st">Hyderabad ▾</span><span class="st">Vehicle: all ▾</span>') + leg + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{lmap}{side}</div>'),
    purpose="City-wide live view of drivers, rides and zones for operations staff.",
    how=["Positions stream from the location service; at city scale the map clusters markers.", "Filters change the WebSocket subscription on the server, not just what is drawn.", "Clicking a car opens the driver card; clicking a trip draws its route and trail."],
    elements=["Status filters", "City and vehicle selectors", "Legend with counts", "Map with cars, heat and zones", "Selected driver panel with actions"],
    apis=[("WS", "/ws/admin/map?city=&filters=", "Live positions"), ("GET", "/v1/admin/drivers/{id}/live", "Driver card")],
    data=["Redis GEO", "Location stream"], to=["A04", "A06"],
    edge=["Exact rider locations are only shown to roles with ride.view.", "Map falls back to 10 s polling if WebSocket is blocked by a proxy."]))

# A04
info = card("Ride RN-20260927-00125", f'''{st("TRIP_IN_PROGRESS", "info")}
{dtable(["", ""], [["Rider", "Ananya R. · ★ 4.8 · +91 98••• ••321"], ["Driver", "Arjun K. · ★ 4.9 · +91 90••• ••345"], ["Vehicle", "Swift Dzire · TS 09 EA 4521"], ["Pickup", "Gate 2, Lumbini Apts, Banjara Hills"], ["Drop", "Hitec City Metro"], ["Fare", "Quote ₹236 · running ₹162"], ["Payment", "UPI · authorised"], ["Surge", "1.2× · zone HYD-BH-04"]]).replace("<thead><tr><th></th><th></th></tr></thead>", "")}
<div style="display:flex;gap:6px;flex-wrap:wrap">{dbtn("Call rider","g")}{dbtn("Call driver","g")}{dbtn("Refund","g")}{dbtn("Cancel ride","g")}{dbtn("Open incident","r")}</div>''')
rmap = card("Route and GPS trail", f'<div class="dmap" style="height:560px">{map_svg(230, 560, route=[(40,480),(40,330),(110,330),(110,200),(190,200),(190,80)], pickup=(40,480), drop=(190,80), cars=[(110,260,0)], labels=False)}</div>')
tim = card("Timeline", tl([("17:44:02", "Ride requested · quote ₹236", ""), ("17:44:04", "Dispatch started, 9 candidates", ""), ("17:44:11", "Offer to driver 51 declined", "a"), ("17:44:27", "Arjun K. accepted", ""),
                           ("17:48:40", "Masked call rider → driver, 0:42", ""), ("17:52:10", "Driver arrived", ""), ("17:53:02", "OTP verified, trip started", ""), ("17:58:31", "Route deviation check sent", "a"),
                           ("17:58:40", "Rider confirmed OK", ""), ("18:02:15", "Location every 3 s · 186 points", "")]))
S.append(dict(id="A04", mock=desk("rides", "Ride detail", grid("1.1fr 1fr 1fr", info, rmap, tim)),
    purpose="Everything about a single ride in one place, used for live support, disputes and investigations.",
    how=["Summary, route and timeline load from the ride, location and event services.", "The timeline is built from ride_events, dispatch, calls and safety events.", "Actions require the matching permission and are written to the audit log with a reason."],
    elements=["Status chip", "Parties with masked phone numbers", "Fare, payment, surge", "Route and GPS trail map", "Event timeline", "Actions: call, refund, cancel, open incident"],
    apis=[("GET", "/v1/admin/rides/{id}", "Ride summary"), ("GET", "/v1/admin/rides/{id}/timeline", "Events"), ("GET", "/v1/admin/rides/{id}/trail", "GPS points"), ("POST", "/v1/admin/rides/{id}/cancel", "Cancel with reason")],
    events=["admin.ride_cancelled", "incident.opened"], data=["rides.*", "location.ride_locations", "telephony.call_logs"], to=["A11", "A13", "A15"],
    edge=["Full phone numbers only for roles with user.pii.view_full, and viewing is audited.", "Refunds above the limit require a second approver."]))

# A05
riders = dtable(["Rider", "Phone", "City", "Rides", "Rating", "Wallet", "Risk", "Status", "Joined"], [
    ["Ananya Rao", "+91 98••• ••321", "Hyderabad", "112", "4.8", "₹120", st("Low", "ok"), st("Active", "ok"), "12 Jan 2025"],
    ["Rahul Mehta", "+91 99••• ••876", "Hyderabad", "48", "4.6", "₹0", st("Low", "ok"), st("Active", "ok"), "3 Mar 2025"],
    ["S. Iqbal", "+971 50••• ••12", "Dubai", "9", "4.9", "AED 20", st("Low", "ok"), st("Active", "ok"), "9 Aug 2026"],
    ["user_88210", "+91 70••• ••004", "Hyderabad", "2", "—", "₹300", st("High", "err"), st("Under review", "warn"), "25 Sep 2026"],
    ["Divya P.", "+91 96••• ••552", "Bengaluru", "301", "4.9", "₹45", st("Low", "ok"), st("Active", "ok"), "18 Jun 2024"],
    ["Karthik V.", "+91 93••• ••118", "Bengaluru", "77", "3.9", "₹0", st("Medium", "warn"), st("Warned", "warn"), "2 Feb 2025"],
    ["M. Fernandes", "+91 98••• ••640", "Hyderabad", "15", "4.7", "₹0", st("Low", "ok"), st("Dues ₹212", "err"), "30 Jul 2026"],
    ["Priyanka S.", "+91 90••• ••777", "Hyderabad", "64", "4.8", "₹10", st("Low", "ok"), st("Active", "ok"), "5 Nov 2025"],
    ["user_77120", "+91 81••• ••231", "Hyderabad", "0", "—", "₹0", st("High", "err"), st("Blocked", "err"), "26 Sep 2026"]])
S.append(dict(id="A05", mock=desk("riders", "Riders", filters("All", "Active", "Under review", "Blocked", "Has dues", right=dbtn("Export CSV", "g")) + card("412,806 riders", riders + '<div style="color:#667685;font-size:12px">Showing 1–9 · Next ›</div>')),
    purpose="Search and manage rider accounts.",
    how=["Search by name, phone, ride ID or email (OpenSearch index).", "Phone numbers are masked; opening the full record is logged.", "Row click opens the rider profile with rides, payments, tickets and risk history.", "Actions: warn, block, clear dues, reset devices — all need a reason."],
    elements=["Status filters", "Export", "Rider table with risk and status", "Pagination"],
    apis=[("GET", "/v1/admin/riders?query=&status=&cursor=", "List"), ("POST", "/v1/admin/riders/{id}/block", "Block with reason")], events=["admin.rider_blocked"],
    data=["users.riders", "fraud.risk_scores", "OpenSearch riders index"], to=["A04", "A14"],
    edge=["Exports need report.export and only include masked fields unless approved.", "Deleted accounts show as anonymised."]))

# A06
drivers = dtable(["Driver", "Vehicle", "City", "Status", "Documents", "Rating", "Accept %", "Week earnings", "Since"], [
    ["Arjun K.", "Cab · TS 09 EA 4521", "Hyderabad", st("On trip", "info"), st("Insurance 12 d", "warn"), "4.9", "92%", "₹14,820", "2024"],
    ["Ravi T.", "Auto · TS 11 UB 2210", "Hyderabad", st("Online", "ok"), st("Valid", "ok"), "4.7", "85%", "₹9,340", "2025"],
    ["Salma B.", "Cab · TS 07 FK 8812", "Hyderabad", st("Online", "ok"), st("Valid", "ok"), "4.95", "95%", "₹16,200", "2023"],
    ["Imran S.", "Bike · TS 10 EQ 1109", "Hyderabad", st("Offline", ""), st("PUC expired", "err"), "4.6", "78%", "₹3,120", "2026"],
    ["Mohan R.", "Cab · KA 01 AB 4432", "Bengaluru", st("Online", "ok"), st("Valid", "ok"), "4.8", "90%", "₹15,760", "2022"],
    ["Joseph D.", "Premium · KA 05 MN 7777", "Bengaluru", st("Paused", "warn"), st("Valid", "ok"), "4.3", "70%", "₹6,900", "2024"],
    ["Ahmed K.", "Cab · Dubai 12345", "Dubai", st("On trip", "info"), st("Valid", "ok"), "4.9", "93%", "AED 2,140", "2026"],
    ["Suresh N.", "Auto · TS 13 UC 3341", "Hyderabad", st("Blocked", "err"), st("Valid", "ok"), "3.6", "61%", "₹0", "2025"]])
S.append(dict(id="A06", mock=desk("drivers", "Drivers", '<div class="kpis">' + kpi("Active drivers", "18,402") + kpi("Online now", "3,482") + kpi("Docs expiring 15 d", "214", "", True) + kpi("Pending KYC", "12", "", True) + '</div>'
    + filters("All", "Online", "On trip", "Docs expiring", "Blocked", right=dbtn("Invite fleet", "g")) + card("Drivers", drivers)),
    purpose="Search and manage drivers, their status, documents and performance.",
    how=["Live status comes from Redis; documents and ratings from the drivers service.", "Opening a driver shows documents, vehicles, trips, earnings, complaints and history.", "Actions: pause, block, force offline, send message, request document; each needs a reason."],
    elements=["Driver KPIs", "Filters", "Driver table with live status, document state, rating, acceptance, earnings"],
    apis=[("GET", "/v1/admin/drivers?status=&cursor=", "List"), ("POST", "/v1/admin/drivers/{id}/pause", "Pause"), ("POST", "/v1/admin/drivers/{id}/force-offline", "Force offline")],
    events=["admin.driver_paused", "admin.driver_blocked"], data=["drivers.*", "Redis driver state"], to=["A07", "A08", "A03"],
    edge=["Blocking a driver on a trip waits until the trip ends, unless it's a safety block.", "Fleet managers see only their fleet's drivers."]))

# A07
queue = card("Queue · 12", dtable(["Driver", "Waiting"], [["Arjun K. · Insurance", "2 h"], ["New: Vivek P.", "5 h"], ["New: Lakshmi M.", "6 h"], ["Imran S. · PUC", "8 h"], ["New: Farhan A.", "1 d"]]), style="width:250px")
docs = card("Driving licence · Vivek P.", f'''<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="docimg">Licence front</div><div class="docimg">Licence back</div><div class="docimg">Selfie (shift photo)</div><div class="docimg">Photo on licence</div></div>
<div class="banner" style="background:#DCF3EC;color:#075A4D;border-radius:8px;padding:8px 10px">Face match 94% · above 85% threshold</div>''')
fields = card("Checks", dtable(["Field", "Entered", "Read from document", ""], [["Name", "Vivek Prasad", "VIVEK PRASAD", st("Match", "ok")], ["Licence no.", "TS10 2018 •••••45", "TS10 2018 •••••45", st("Match", "ok")],
    ["Date of birth", "14 Feb 1994", "14 Feb 1994", st("Match", "ok")], ["Valid till", "—", "13 Feb 2034", st("OK", "ok")], ["Vehicle class", "LMV", "LMV, MCWG", st("OK", "ok")],
    ["Duplicate check", "", "Unique", st("Pass", "ok")], ["Registry check", "", "Registry: valid", st("Pass", "ok")]]) +
    f'<div class="dfield"><label>Reason (required to reject)</label><div class="box" style="color:#9AA7B2">Choose a reason ▾</div></div><div style="display:flex;gap:8px">{dbtn("Approve")}{dbtn("Ask to re-upload","g")}{dbtn("Reject","r")}</div>')
S.append(dict(id="A07", mock=desk("kyc", "KYC review", f'<div style="display:flex;gap:14px;flex:1;min-height:0">{queue}<div style="flex:1;display:grid;grid-template-columns:0.75fr 1.4fr;gap:14px">{docs}{fields}</div></div>'),
    purpose="Where reviewers approve or reject driver and rider documents with automated checks side by side.",
    how=["Queue is ordered by waiting time and priority (renewals of active drivers first).", "OCR, face match, duplicate and registry checks run before a person sees the case.", "The reviewer decides; the decision and reason are sent to the driver instantly.", "Four-eyes rule: a reviewer can't approve documents they uploaded or edited."],
    elements=["Review queue with waiting time", "Document images (zoom, rotate)", "Face match result", "Field comparison table", "Registry and duplicate checks", "Approve / re-upload / reject with reason"],
    apis=[("GET", "/v1/admin/kyc/queue", "Next cases"), ("GET", "/v1/admin/kyc/{id}", "Case with signed image URLs"), ("POST", "/v1/admin/kyc/{id}/decision", "Decision + reason")],
    events=["kyc.decided"], data=["kyc.review_tasks", "MinIO kyc-documents"], to=["A06"],
    edge=["Images are watermarked with the reviewer's name to discourage screenshots.", "Registry API down: case marked 'manual check needed', not auto-approved."]))

# A08
fleet = '<div class="kpis">' + kpi("Vehicles", "21,930") + kpi("Fleets", "318") + kpi("Permit expiring 30 d", "96", "", True) + kpi("Inactive 14 d", "1,204") + '</div>'
veh = dtable(["Plate", "Type", "Model", "Fleet", "Driver", "Permit", "Insurance", "Fitness", "Status"], [
    ["TS 09 EA 4521", "Cab", "Swift Dzire 2022", "Own", "Arjun K.", "Mar 2027", st("12 d", "warn"), "Jan 2027", st("Active", "ok")],
    ["TS 07 FK 8812", "Cab", "Toyota Etios 2021", "Metro Fleet Ltd", "Salma B.", "Aug 2027", "Jun 2027", "Dec 2026", st("Active", "ok")],
    ["TS 11 UB 2210", "Auto", "Bajaj RE 2020", "Own", "Ravi T.", "Jan 2027", "Nov 2026", "Nov 2026", st("Active", "ok")],
    ["KA 05 MN 7777", "Premium", "Honda City 2024", "Blue Cabs", "Joseph D.", "May 2028", "Apr 2027", "—", st("Active", "ok")],
    ["TS 10 EQ 1109", "Bike", "Honda Shine 2023", "Own", "Imran S.", "—", "Feb 2027", "—", st("PUC expired", "err")],
    ["TS 08 GA 9001", "Cab", "Ertiga 2019", "Metro Fleet Ltd", "Unassigned", "Oct 2026", "Oct 2026", st("Due", "warn"), st("Idle", "")]])
S.append(dict(id="A08", mock=desk("vehicles", "Vehicles & fleet", fleet + filters("All vehicles", "Cab", "Auto", "Bike", "Premium", "Expiring", right=dbtn("Add vehicle")) + card("Vehicles", veh)),
    purpose="Vehicles, fleet owners and the driver assigned to each vehicle.",
    how=["Each vehicle has type, documents and the fleet it belongs to.", "Fleet managers can assign their drivers to their vehicles.", "Expiring vehicle documents follow the same reminder and block rules as driver documents."],
    elements=["Fleet KPIs", "Type filters", "Vehicle table with document dates and status", "Add vehicle"],
    apis=[("GET", "/v1/admin/vehicles", "List"), ("POST", "/v1/admin/vehicles", "Add"), ("PUT", "/v1/admin/vehicles/{id}/driver", "Assign driver")],
    events=["vehicle.updated"], data=["vehicles.*"], to=["A06"],
    edge=["A vehicle can have one active driver at a time.", "Changing vehicle type needs new permit review."]))

# A09
rules = dtable(["Vehicle", "Base", "Per km", "Per min", "Minimum", "Cancel fee", "Waiting / min"], [
    ["Bike", "₹20", "₹6", "₹1.0", "₹35", "₹20", "₹1"], ["Auto", "₹30", "₹12", "₹1.5", "₹45", "₹30", "₹1"],
    ["Cab", "₹50", "₹14", "₹1.5", "₹90", "₹50", "₹2"], ["Premium", "₹90", "₹20", "₹2.5", "₹160", "₹75", "₹3"]])
surge = dtable(["Zone", "Demand / supply", "Current", "Cap", "Mode"], [
    ["HYD-HITEC-01", "2.1", st("1.3×", "warn"), "1.8×", "Auto"], ["HYD-BH-04", "1.6", st("1.2×", "warn"), "1.8×", "Auto"],
    ["HYD-AIRPORT", "0.9", "1.0×", "1.5×", "Auto"], ["HYD-OLDCITY-02", "1.2", "1.0×", "1.5×", "Manual"]])
S.append(dict(id="A09", mock=desk("pricing", "Pricing & surge", f'<div class="banner" style="background:#FBF0D9;color:#6B4600;border-radius:8px;padding:9px 12px">Changes to fare rules need approval by a second pricing manager and apply from the next quote.</div>'
    + grid("1.2fr 1fr", card("Fare rules · Hyderabad · v14", rules + f'<div style="display:flex;gap:8px">{dbtn("Edit rules")}{dbtn("Version history","g")}{dbtn("Simulate a trip","g")}</div>'),
           card("Demand vs supply · Hitec zone", line_chart(420, 150, [[40, 55, 80, 120, 160, 150, 130], [70, 72, 75, 80, 78, 76, 74]]) + '<div style="font-size:12px;color:#667685">Teal: requests · Purple: available drivers (last 3 h)</div>'))
    + card("Surge zones", surge + '<div style="font-size:12px;color:#667685">Surge is shown to riders before booking. Government fare caps for each city are enforced as hard limits.</div>')),
    purpose="Fare rules per city and vehicle type, and live surge settings per zone.",
    how=["Fare rules are versioned; a change is a draft until a second manager approves it.", "The simulator shows the fare for a sample trip under old and new rules.", "Surge is recommended by the demand model and applied automatically within the cap, or set manually.", "Local fare caps set by regulators are hard limits the system never exceeds."],
    elements=["Approval notice", "Fare rule table with version", "Edit, history, simulate", "Demand vs supply chart", "Surge zones with current multiplier, cap and mode"],
    apis=[("GET", "/v1/admin/pricing/rules?city=", "Rules"), ("POST", "/v1/admin/pricing/rules/drafts", "Propose change"), ("POST", "/v1/admin/pricing/rules/{v}/approve", "Approve"), ("PUT", "/v1/admin/surge/zones/{id}", "Set cap / mode")],
    events=["pricing.rules_changed", "pricing.surge_changed"], data=["pricing.fare_rules", "pricing.surge_zones"], to=["A10", "A16"],
    edge=["During declared emergencies (floods, strikes) ops can freeze surge city-wide with one switch.", "Every change is in the audit log with before and after values."]))

# A10
zmap = f'<div class="dmap" style="height:640px">{map_svg(720, 640, labels=True, zones=[([(420,60),(640,60),(660,230),(440,250)], "#E8590C", "Surge · Hitec 01"), ([(60,380),(260,360),(280,560),(80,590)], "#2F6FDB", "Airport pickup"), ([(330,420),(470,420),(470,520),(330,520)], "#D0381C", "Restricted · no pickup")])}</div>'
zlist = card("Zones · Hyderabad", dtable(["Zone", "Type", "Rule"], [["Hitec 01", st("Surge", "warn"), "Auto surge cap 1.8×"], ["RGIA", st("Airport", "info"), "Queue, gate pickup"], ["Charminar", st("Restricted", "err"), "No pickup 6–11 PM"], ["City limit", st("Service area", "ok"), "Rides start inside"], ["Jubilee Hills", st("Safety", "warn"), "Night check-ins"]])
             + f'<div style="display:flex;gap:6px">{dbtn("Draw polygon")}{dbtn("Import GeoJSON","g")}</div>', style="width:330px")
S.append(dict(id="A10", mock=desk("zones", "Zones & geofences", f'<div style="display:flex;gap:14px;flex:1;min-height:0">{zmap}{zlist}</div>'),
    purpose="Draw and manage the zones that control where rides can start, surge areas, airports and restricted areas.",
    how=["Zones are polygons stored with PostGIS and cached by the location service.", "Each zone has a type, rules and an optional schedule.", "Changes are validated (no gaps in the service area, no self-crossing shapes) and take effect within a minute."],
    elements=["Map with zones", "Zone list with type and rule", "Draw and import tools"],
    apis=[("GET", "/v1/admin/zones?city=", "Zones"), ("POST", "/v1/admin/zones", "Create"), ("PUT", "/v1/admin/zones/{id}", "Update")],
    events=["geofence.updated"], data=["location.geofences (PostGIS)"], to=["A09"],
    edge=["Deleting a zone with active surge first sets it to 1.0×.", "Temporary zones (events, road closures) expire automatically."]))

# A11
pay = '<div class="kpis">' + kpi("Collected today", "₹48.6 L") + kpi("Refunds today", "₹62,400", "184 refunds") + kpi("Failed payments", "0.8%", "", True) + kpi("Awaiting settlement", "₹1.2 Cr") + '</div>'
txn = dtable(["Payment", "Ride", "Method", "Amount", "Status", "Gateway ref", "Time"], [
    ["pay_9f21", "RN-00125", "UPI", "₹248.00", st("Captured", "ok"), "pay_Nx81…", "18:11"], ["pay_9f20", "RN-00124", "Card", "₹612.00", st("Authorised", "info"), "pi_3PQ…", "18:10"],
    ["pay_9f1e", "RN-00119", "UPI", "₹164.00", st("Failed", "err"), "pay_Nx7Z…", "18:07"], ["pay_9f1a", "RN-00117", "Wallet", "₹90.00", st("Captured", "ok"), "internal", "18:05"],
    ["rf_2210", "RN-00098", "UPI", "−₹120.00", st("Refunded", "warn"), "rfnd_Kq…", "18:02"]])
refund = card("Refund RN-00098", f'''{field("Amount", "₹120.00 of ₹240.00")}{field("Reason", "Driver took longer route ▾")}{field("Refund to", "Original method (UPI)")}
<div class="banner" style="background:#FBF0D9;color:#6B4600;border-radius:8px;padding:8px 10px;font-size:12px">Refunds above ₹500 need approval from a finance manager.</div><div style="display:flex;gap:6px">{dbtn("Issue refund")}{dbtn("Cancel","g")}</div>''', style="width:320px")
S.append(dict(id="A11", mock=desk("payments", "Payments & refunds", pay + filters("All", "Failed", "Refunds", "Disputes", "Cash owed", right=dbtn("Reconciliation report", "g")) + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{card("Transactions", txn, style="flex:1")}{refund}</div>'),
    purpose="Payments, refunds, failures and reconciliation for the finance and support teams.",
    how=["Transactions come from the payments service; gateway references link to the gateway dashboard.", "Refunds post reverse ledger entries and call the gateway refund API.", "Nightly reconciliation matches gateway settlement files against the ledger and lists mismatches."],
    elements=["Money KPIs", "Filters", "Transaction table", "Refund panel with limits"],
    apis=[("GET", "/v1/admin/payments", "Transactions"), ("POST", "/v1/admin/payments/{id}/refunds", "Issue refund"), ("GET", "/v1/admin/reconciliation?date=", "Mismatch report")],
    events=["refund.issued"], data=["payments.*", "ledger.*"], to=["A04", "A17"],
    edge=["Refund cannot exceed amount captured minus earlier refunds.", "Chargebacks from card networks appear as disputes with deadlines."]))

# A12
tlist = card("Inbox · 38 open", dtable(["Ticket", "SLA"], [[f'<b>#48790</b> Fare dispute<br><span style="color:#667685">Driver · Arjun K.</span>', st("1 h", "warn")], [f'<b>#48802</b> Lost item<br><span style="color:#667685">Rider · Ananya R.</span>', st("3 h", "ok")],
       [f'<b>#48811</b> Driver rude<br><span style="color:#667685">Rider · Karthik V.</span>', st("Past SLA", "err")], [f'<b>#48815</b> Payout failed<br><span style="color:#667685">Driver · Imran S.</span>', st("5 h", "ok")]]), style="width:280px")
conv = card("#48802 · Lost item · black backpack", f'''<div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
<div style="background:#F4F6F8;padding:8px 10px;border-radius:8px;max-width:80%"><b>AI assistant</b> collected: item, ride RN-00125, seat. Masked call window opened for 24 h.</div>
<div style="background:#F4F6F8;padding:8px 10px;border-radius:8px;max-width:80%"><b>Ananya</b>: I left my black backpack on the back seat.</div>
<div style="background:#DCF3EC;padding:8px 10px;border-radius:8px;max-width:80%;align-self:flex-end"><b>Meera (support)</b>: Arjun has your bag. He can drop it at 8 PM; ₹100 return fee applies. OK?</div></div>
<div style="margin-top:auto;display:flex;gap:6px">{dbtn("Reply")}{dbtn("Macro ▾","g")}{dbtn("Call rider","g")}{dbtn("Resolve","g")}</div>''', style="flex:1")
ctx = card("Context", dtable(["", ""], [["Ride", "RN-00125 · today"], ["Rider", "Ananya R. · 112 rides"], ["Driver", "Arjun K."], ["Past tickets", "1 (fare, resolved)"], ["Priority", "Normal"]]).replace("<thead><tr><th></th><th></th></tr></thead>", ""), style="width:260px")
S.append(dict(id="A12", mock=desk("support", "Support tickets", f'<div style="display:flex;gap:14px;flex:1;min-height:0">{tlist}{conv}{ctx}</div>'),
    purpose="Support agents' inbox for rider and driver tickets with the ride context beside the conversation.",
    how=["Tickets arrive from the apps, the AI assistant, calls and email, with category and priority.", "SLA timers depend on category; safety tickets go to the safety console instead.", "Macros insert approved answers in the user's language.", "Resolution codes feed quality reports."],
    elements=["Inbox with SLA", "Conversation thread including AI assistant summary", "Reply, macros, call, resolve", "Ride and user context"],
    apis=[("GET", "/v1/admin/tickets?queue=", "Inbox"), ("POST", "/v1/admin/tickets/{id}/messages", "Reply"), ("POST", "/v1/admin/tickets/{id}/resolve", "Resolve")],
    events=["ticket.resolved"], data=["support.*"], to=["A04", "A11"],
    edge=["Keywords about harm move the ticket to the safety queue.", "Agent can't see full phone numbers; calls go through the masked line."]))

# A13
inc = card("Open incidents", dtable(["Incident", "Age", "Owner"], [[f'<b>SOS</b> · RN-00125<br><span style="color:#667685">Rider pressed SOS</span>', st("0:48", "err"), st("Unassigned", "err")],
      [f'<b>Deviation</b> · RN-00098', st("2:10", "warn"), "Meera"], [f'<b>Long stop</b> · RN-00077', st("4:32", "warn"), "Vikram"]]), style="width:300px")
smap = card("RN-00125 · live · location every 1 s", f'<div class="dmap" style="height:470px">{map_svg(460, 470, route=[(70,420),(70,300),(200,300),(200,160),(360,160)], cars=[(200,210,0)], drop=(360,160), labels=True)}</div>', style="flex:1")
act = card("Actions", f'''{dbtn("Assign to me")}<div style="display:flex;flex-direction:column;gap:6px">{dbtn("Call rider (masked)","g")}{dbtn("Call driver (masked)","g")}{dbtn("Message contacts","g")}{dbtn("Record police/ambulance contact","r")}</div>
{field("Notes", "Rider says driver stopped in an unlit lane…")}
{tl([("17:58:02","SOS raised by rider",""),("17:58:03","Contacts sent live link",""),("17:58:03","Evidence freeze started","a")])}''', style="width:280px")
S.append(dict(id="A13", mock=desk("safety", "Safety & SOS console", '<div class="kpis">' + kpi("Open SOS", "1", "", True, True) + kpi("Open checks", "2") + kpi("Avg acknowledge", "38 s") + kpi("Resolved today", "14") + '</div>'
    + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{inc}{smap}{act}</div>'),
    purpose="Where the safety team handles SOS alerts and safety checks in real time.",
    how=["New SOS alerts ring an alarm and appear at the top; unassigned after 45 s pages the safety lead.", "Agent assigns, calls both parties through masked lines and notes each step.", "Contact with police or ambulance is recorded as an action with the reference number.", "Closing requires a category and summary; evidence is frozen automatically."],
    elements=["Safety KPIs", "Incident list with age and owner", "Live map of the ride", "Actions, notes and incident timeline"],
    apis=[("WS", "/ws/admin/safety", "Live incidents"), ("POST", "/v1/admin/incidents/{id}/assign", "Assign"), ("POST", "/v1/admin/incidents/{id}/actions", "Record action"), ("POST", "/v1/admin/incidents/{id}/close", "Close")],
    events=["incident.acknowledged", "incident.escalated", "incident.closed"], data=["safety.*", "location.ride_locations"], to=["A18", "A04"],
    edge=["Safety console access is limited to trained safety staff.", "Shift handover: open incidents must be reassigned before logging out."]))

# A14
fq = dtable(["Case", "Subject", "Score", "Signals", "Suggested"], [
    ["FR-771", "user_77120", '<span style="display:inline-block;width:80px;height:6px;background:#FCE6DF;border-radius:3px;vertical-align:middle"><i style="display:block;width:92%;height:100%;background:#D0381C;border-radius:3px"></i></span> 92', "6 accounts same device · promo abuse", st("Block", "err")],
    ["FR-768", "Driver Suresh N.", '<span style="display:inline-block;width:80px;height:6px;background:#FCE6DF;border-radius:3px;vertical-align:middle"><i style="display:block;width:81%;height:100%;background:#D0381C;border-radius:3px"></i></span> 81', "GPS jumps · fake trips with 2 riders", st("Suspend", "err")],
    ["FR-765", "user_88210", '<span style="display:inline-block;width:80px;height:6px;background:#FBF0D9;border-radius:3px;vertical-align:middle"><i style="display:block;width:58%;height:100%;background:#B7791F;border-radius:3px"></i></span> 58', "Card BIN mismatch · new device", st("Verify", "warn")],
    ["FR-760", "Driver Ravi T.", '<span style="display:inline-block;width:80px;height:6px;background:#FBF0D9;border-radius:3px;vertical-align:middle"><i style="display:block;width:41%;height:100%;background:#B7791F;border-radius:3px"></i></span> 41', "High cancellations 8–9 PM", st("Warn", "warn")]])
fcase = card("FR-771 · user_77120", f'''<div style="font-size:12.5px">Model: fraud-risk v7 · scored 18:03</div>{dtable(["Signal", "Weight"], [["Device shared by 6 new accounts", "high"], ["Referral codes used 5× in 2 days", "high"], ["Same UPI ID across accounts", "medium"], ["No completed rides", "low"]])}
<div class="banner" style="background:#E4ECFA;color:#1F4E9E;border-radius:8px;padding:8px 10px;font-size:12px">The model suggests; you decide. Blocking needs a reason and is reversible.</div>
<div style="display:flex;gap:6px">{dbtn("Block account","r")}{dbtn("Ask for verification","g")}{dbtn("Clear","g")}</div>''', style="width:360px")
S.append(dict(id="A14", mock=desk("fraud", "Fraud review queue", filters("High risk", "Medium", "Drivers", "Riders", "Promotions") + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{card("Cases", fq, style="flex:1")}{fcase}</div>'),
    purpose="Human review of cases the fraud model and rules flag, with the reasons behind each score.",
    how=["Rules and the ML model score events continuously; cases above a threshold enter the queue.", "Each case shows the signals and their weight so the analyst understands the score.", "The analyst picks an action; the model's suggestion is never applied automatically for blocks.", "Outcomes are fed back as training labels."],
    elements=["Filters", "Case table with score and main signals", "Case detail with signal list", "Block / verify / clear"],
    apis=[("GET", "/v1/admin/fraud/cases", "Queue"), ("POST", "/v1/admin/fraud/cases/{id}/decision", "Decision + reason")],
    events=["fraud.decided"], data=["fraud.*", "ml predictions log"], to=["A05", "A06"],
    edge=["Linked accounts can be actioned together with one decision.", "Users can appeal; appeals go to a different analyst."]))

# A15
calls = dtable(["Time", "Ride", "From → To", "Proxy", "Duration", "Result", "Recording"], [
    ["18:04", "RN-00125", "Rider → Driver", "+91 80 4xxx 1234", "0:42", st("Answered", "ok"), "▶ consented"], ["18:03", "RN-00124", "Driver → Rider", "+91 80 4xxx 1290", "0:00", st("No answer", "warn"), "—"],
    ["18:01", "Hotline", "Caller → Safety", "IVR 2", "3:10", st("Answered", "ok"), "▶"], ["17:58", "RN-00098", "Rider → Driver", "WebRTC", "1:05", st("Answered", "ok"), "—"],
    ["17:55", "RN-00090", "Driver → Rider", "+91 80 4xxx 1301", "0:00", st("Failed · trunk", "err"), "—"]])
trunks = card("Voice health", dtable(["Component", "Status", "Detail"], [["SIP trunk A", st("Up", "ok"), "42 / 120 channels"], ["SIP trunk B", st("Up", "ok"), "standby"], ["Asterisk-1", st("Up", "ok"), "CPU 31%"], ["Asterisk-2", st("Up", "ok"), "CPU 28%"], ["Kamailio", st("Up", "ok"), "WSS 1,120 conns"], ["Proxy pool", st("78% used", "warn"), "980 / 1,250"]]), style="width:380px")
S.append(dict(id="A15", mock=desk("calls", "Telephony console", '<div class="kpis">' + kpi("Calls today", "18,240") + kpi("Answer rate", "91%") + kpi("Avg duration", "0:51") + kpi("Hotline queue", "4", "wait 0:35") + '</div>'
    + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{card("Call log", calls, style="flex:1")}{trunks}</div>'),
    purpose="Monitor masked calls, the support hotline and the health of the voice infrastructure.",
    how=["Call records come from Asterisk CDRs via the telephony service.", "Recordings are played in the browser with a signed URL; each play is audited.", "Health tiles read Asterisk and Kamailio metrics from Prometheus."],
    elements=["Call KPIs", "Call log with proxy, duration, result, recording", "Voice health: trunks, PBX nodes, WebRTC gateway, proxy pool usage"],
    apis=[("GET", "/v1/admin/calls?ride=&from=", "Call log"), ("GET", "/v1/admin/calls/{id}/recording", "Signed audio URL"), ("GET", "/v1/admin/telephony/health", "Health")],
    data=["telephony.call_logs", "Prometheus"], to=["A04"],
    edge=["Proxy pool above 90%: alert to add numbers.", "Recordings only where consent was announced and law allows."]))

# A16
fc = card("Demand forecast · Hitec 01 · next 3 h", line_chart(520, 160, [[60, 75, 90, 130, 170, 160, 140, 120, 100], [55, 72, 95, 125, 165, 170, 150, 125, 105]]) + '<div style="font-size:12px;color:#667685">Teal: actual requests · Purple: forecast (15-min buckets) · MAPE 8.4%</div>')
rec = card("Surge recommendations", dtable(["Zone", "Now", "Suggested", "Why", ""], [["Hitec 01", "1.3×", "1.5×", "Forecast +35% at 19:00", dbtn("Apply")], ["Kondapur", "1.0×", "1.2×", "Supply −20%", dbtn("Apply")], ["Airport", "1.0×", "1.0×", "Balanced", "—"]]))
mh = card("Model health", dtable(["Model", "Version", "Quality", "Drift"], [["ETA correction", "v12", "MAE 1.1 min", st("OK", "ok")], ["Demand forecast", "v5", "MAPE 8.4%", st("OK", "ok")], ["Fraud risk", "v7", "Precision 0.91", st("Watch", "warn")], ["Safety anomaly", "v3", "Recall 0.88", st("OK", "ok")], ["Support assistant", "—", "62% solved without agent", st("OK", "ok")]]))
S.append(dict(id="A16", mock=desk("ai", "AI insights", grid("1.2fr 1fr", fc, rec) + mh),
    purpose="What the AI models predict, what they recommend and whether they are still accurate.",
    how=["Forecasts are compared against actual demand every 15 minutes.", "Recommendations above the auto-apply limit wait here for an ops decision.", "Model quality and drift metrics are computed daily; a 'Watch' status opens an engineering ticket."],
    elements=["Forecast vs actual chart", "Surge recommendations with apply / skip", "Model health table"],
    apis=[("GET", "/v1/admin/ml/forecast?zone=", "Forecast series"), ("GET", "/v1/admin/ml/recommendations", "Pending recommendations"), ("POST", "/v1/admin/ml/recommendations/{id}/apply", "Apply")],
    events=["ml.recommendation_applied"], data=["Feature store", "MLflow registry"], to=["A09"],
    edge=["If a model is unhealthy, the system switches to rule-based fallbacks and says so here."]))

# A17
rep = grid("1.3fr 1fr",
    card("Gross bookings · last 12 weeks", bar_chart(560, 170, [38, 41, 40, 44, 47, 46, 49, 52, 55, 54, 58, 61], hi=11) + '<div style="font-size:12px;color:#667685">₹ lakh per week · Hyderabad</div>'),
    card("Saved reports", dtable(["Report", "Schedule", ""], [["Daily operations summary", "Every day 07:00", dbtn("Run", "g")], ["Driver earnings by fleet", "Weekly", dbtn("Run", "g")], ["Cancellations by reason", "Weekly", dbtn("Run", "g")], ["Tax collected", "Monthly", dbtn("Run", "g")], ["Safety incidents", "Monthly", dbtn("Run", "g")]])))
tbl = card("Cancellations by reason · this week", dtable(["Reason", "Rider", "Driver", "Share"], [["Driver too far", "4,120", "—", "31%"], ["Changed plans", "3,010", "—", "23%"], ["Rider not at pickup", "—", "1,840", "14%"], ["Vehicle issue", "—", "620", "5%"], ["Other", "2,180", "1,300", "27%"]]))
S.append(dict(id="A17", mock=desk("reports", "Reports & analytics", filters("Hyderabad", "Last 12 weeks", "All vehicles", right=dbtn("New report") + " " + dbtn("Export", "g")) + rep + tbl),
    purpose="Business reports and scheduled exports for operations, finance and management.",
    how=["Reports query the analytics store, never the live database.", "Saved reports can be scheduled and emailed as CSV or PDF.", "Exports containing personal data need approval and expire after 30 days."],
    elements=["Filters", "Bookings chart", "Saved and scheduled reports", "Cancellation analysis table", "Export"],
    apis=[("POST", "/v1/admin/reports/run", "Run report"), ("GET", "/v1/admin/reports/{id}", "Result"), ("POST", "/v1/admin/reports/{id}/schedule", "Schedule")],
    events=["report.exported"], data=["ClickHouse", "MinIO exports"], to=["A18"],
    edge=["Long reports run in Celery and notify when ready.", "Numbers match finance only after nightly reconciliation; the page shows the data cut-off time."]))

# A18
glist = card("Government reports", dtable(["Report", "Type", "Authority", "Status"], [["GR-2026-0311", "Safety incident", "State Transport Dept.", st("Pending approval", "warn")], ["GR-2026-0309", "Law-enforcement response", "City Police (request LR-88)", st("Submitted", "ok")], ["GR-2026-0305", "Monthly compliance return", "Transport Dept.", st("Submitted", "ok")], ["GR-2026-0302", "Driver document violation", "RTO", st("Draft", "")]]), style="flex:1")
gdet = card("GR-2026-0311 · Safety incident", f'''{dtable(["", ""], [["Incident", "INC-5521 · SOS · RN-00125"], ["Classified as", "Harassment complaint, severity 2"], ["Country / state", "India / Telangana"], ["Format", "State template v3 (PDF + JSON)"]]).replace("<thead><tr><th></th><th></th></tr></thead>", "")}
<b style="font-size:13px">Evidence package (frozen)</b><div style="font-size:12.5px;color:#667685">GPS trail 1,204 pts · 14 ride events · 2 call logs · chat transcript · driver documents</div>
<b style="font-size:13px">Approval chain</b>{tl([("27 Sep 18:40","Created by Meera (safety agent)",""),("27 Sep 19:05","Reviewed by Vikram (safety manager)",""),("—","Waiting: compliance lead approval","a")])}
<div style="display:flex;gap:6px">{dbtn("Approve & submit")}{dbtn("Send back","g")}{dbtn("Preview PDF","g")}</div>''', style="width:430px")
S.append(dict(id="A18", mock=desk("gov", "Government reports", f'<div class="banner" style="background:#E4ECFA;color:#1F4E9E;border-radius:8px;padding:9px 12px">Reports are created from reviewed incidents or verified legal requests only. Submission needs government_report.approve.</div>'
    + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{glist}{gdet}</div>'),
    purpose="Prepare, approve and submit reports to authorities, with a full approval chain and frozen evidence.",
    how=["A report starts from a closed or escalated incident, or from a verified law-enforcement request.", "The template for the jurisdiction decides fields and format.", "Only data needed for the report is included; personal data is minimised.", "A second person with approval permission submits; the portal records the submission reference."],
    elements=["Policy banner", "Report list with authority and status", "Report detail: classification, evidence, approval chain", "Approve & submit, send back, preview"],
    apis=[("POST", "/v1/admin/gov-reports", "Create from incident"), ("POST", "/v1/admin/gov-reports/{id}/approve", "Approve and submit"), ("GET", "/v1/admin/gov-reports/{id}/pdf", "Signed PDF")],
    events=["report.approved", "report.submitted"], data=["reporting.gov_reports", "MinIO evidence"], to=["A19"],
    edge=["Creator can't approve their own report (four-eyes rule).", "If the authority's API is down, the PDF is filed manually and the reference entered."]))

# A19
aud = dtable(["Time", "Actor", "Role", "Action", "Entity", "IP"], [
    ["18:12:04", "Priya K.", "OPS_MANAGER", "pricing.rules.approve", "fare_rules HYD v14", "10.2.1.14"], ["18:09:51", "Meera", "SAFETY_AGENT", "incident.action", "INC-5521", "10.2.4.33"],
    ["18:07:10", "Anil", "SUPPORT_AGENT", "user.pii.view_full", "rider usr_1042", "10.2.3.8"], ["18:02:44", "system", "payments", "refund.issued", "rf_2210", "—"],
    ["17:55:02", "Farah", "FRAUD_ANALYST", "fraud.block_account", "user_77120", "10.2.5.21"], ["17:40:19", "Priya K.", "OPS_MANAGER", "surge.freeze", "HYD-OLDCITY-02", "10.2.1.14"]])
diff = card("Change detail · pricing.rules.approve", '<pre style="margin:0;font-family:ui-monospace,Consolas,monospace;font-size:12px;background:#F4F6F8;padding:10px;border-radius:8px;white-space:pre-wrap">  vehicle: cab\n- per_km: 13.00\n+ per_km: 14.00\n- min_fare: 80.00\n+ min_fare: 90.00\n  proposed_by: Rakesh S.\n  approved_by: Priya K.\n  reason: fuel price revision</pre>', style="width:340px")
S.append(dict(id="A19", mock=desk("audit", "Audit log", filters("All actions", "Pricing", "PII access", "Refunds", "Blocks", right=dbtn("Export", "g")) + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{card("Events", aud, style="flex:1")}{diff}</div>'),
    purpose="Append-only record of every staff and system action, with before-and-after values.",
    how=["Every service emits audit events; the audit service stores them in monthly partitions that can't be updated or deleted.", "Filters by actor, action, entity and date.", "Change detail shows a diff and the reason given."],
    elements=["Action filters", "Event table", "Change detail diff", "Export"],
    apis=[("GET", "/v1/admin/audit?actor=&action=&from=", "Search")], data=["audit.audit_logs"], to=["A20"],
    edge=["Viewing the audit log is itself audited.", "Logs are also shipped to a separate write-once store so an admin can't erase them."]))

# A20
roles = ["SUPER ADMIN", "OPS MGR", "SAFETY MGR", "FRAUD", "FINANCE", "SUPPORT"]
perms = [("ride.view", "111111"), ("ride.cancel", "110001"), ("driver.verify", "110000"), ("payment.refund", "100011"), ("incident.close", "101000"), ("fraud.block_account", "100100"),
         ("pricing.edit", "110000"), ("report.export", "111110"), ("government_report.approve", "100000"), ("user.pii.view_full", "101000"), ("audit.view", "100000")]
pm = '<div class="perm">' + '<div class="h l">Permission</div>' + "".join(f'<div class="h">{r}</div>' for r in roles)
for p, bits in perms:
    pm += f'<div class="l">{p}</div>' + "".join(f'<div>{"<span class=ck>✓</span>" if b=="1" else "<span class=nx>·</span>"}</div>' for b in bits)
pm += "</div>"
S.append(dict(id="A20", mock=desk("rbac", "Roles & permissions", filters("Roles", "Users", "Access reviews", right=dbtn("New role")) + card("Permission matrix", pm + '<div style="font-size:12px;color:#667685">Changes to roles need SUPER_ADMIN and are reviewed every quarter. Fleet managers get row-level limits to their own fleet.</div>')),
    purpose="Define roles and the permissions each role grants.",
    how=["Permissions are fine-grained strings checked by every service.", "Roles bundle permissions; staff can hold several roles per city.", "Quarterly access reviews ask managers to confirm each person still needs their roles."],
    elements=["Tabs for roles, users, access reviews", "Permission matrix", "New role"],
    apis=[("GET", "/v1/admin/roles", "Roles"), ("PUT", "/v1/admin/roles/{id}", "Update permissions"), ("POST", "/v1/admin/users/{id}/roles", "Grant role")],
    events=["admin.role_changed"], data=["identity.roles, identity.role_permissions"], to=["A19"],
    edge=["A user can't grant themselves a role.", "Sensitive permissions (PII, government reports) need justification when granted."]))

# A21
camp = grid("1fr 1fr", card("New campaign", f'''{field("Audience", "Riders · Hyderabad · inactive 30 days · 48,210")}{field("Channel", "Push + WhatsApp")}
<div class="dtabs"><span class="on">English</span><span>తెలుగు</span><span>हिन्दी</span></div>{field("Message", "We miss you! 30% off your next ride with COMEBACK30")}{field("Send", "Sat 4 Oct, 10:00 AM local time")}
<div style="display:flex;gap:6px">{dbtn("Schedule")}{dbtn("Send test","g")}</div>'''),
    card("Recent campaigns", dtable(["Campaign", "Sent", "Opened", "Rides"], [["Airport week", "120,400", "22%", "3,110"], ["Driver quest reminder", "18,200", "61%", "—"], ["Monsoon safety tips", "410,000", "18%", "—"]])))
S.append(dict(id="A21", mock=desk("notify", "Notifications & campaigns", camp + card("Transactional templates", dtable(["Template", "Channels", "Languages", "Last edit"], [["ride.driver_assigned", "Push, SMS fallback", "9", "12 Sep"], ["safety.sos_contacts", "SMS, WhatsApp", "9", "2 Aug"], ["payout.sent", "Push, email", "9", "20 Jul"]]))),
    purpose="Marketing campaigns and the templates for transactional messages.",
    how=["Audience is built from analytics segments; the count updates live.", "Messages have versions per language.", "Marketing respects each user's consent and quiet hours; transactional messages (OTP, safety) always send."],
    elements=["Campaign builder: audience, channel, language tabs, message, schedule", "Recent campaign results", "Transactional templates"],
    apis=[("POST", "/v1/admin/campaigns", "Create"), ("POST", "/v1/admin/campaigns/{id}/test", "Send test"), ("PUT", "/v1/admin/templates/{key}", "Edit template")],
    events=["campaign.scheduled"], data=["notifications.*"], to=["A17"],
    edge=["Opt-out users are excluded automatically.", "Safety templates can only be edited by the safety manager."]))

# A22
tog = lambda on: '<span style="display:inline-block;width:34px;height:20px;border-radius:10px;background:' + ("#0B7A68" if on else "#D4DCE2") + ';position:relative;vertical-align:middle"><i style="position:absolute;top:3px;' + ("left:17px" if on else "left:3px") + ';width:14px;height:14px;border-radius:50%;background:#fff"></i></span>'
cfg = grid("1fr 1fr",
    card("Provider adapters", dtable(["Capability", "Primary", "Fallback", "Health"], [["Maps", "Google Maps", "Mapbox", st("OK", "ok")], ["Payments", "Razorpay", "Cashfree", st("OK", "ok")], ["SMS", "Provider A", "Provider B", st("OK", "ok")], ["WhatsApp", "Meta Cloud API", "—", st("OK", "ok")], ["LLM", "Claude (API)", "Rules only", st("OK", "ok")], ["SIP trunk", "Trunk A", "Trunk B", st("OK", "ok")]])),
    card("Feature flags · Hyderabad", dtable(["Flag", "State"], [["women_driver_preference", tog(True)], ["ai_support_assistant", tog(True)], ["bike_taxi", tog(True)], ["scheduled_rides", tog(True)], ["corporate_billing", tog(False)], ["in_app_webrtc_calls", tog(True)]])))
cfg2 = card("Dispatch & retention", dtable(["Setting", "Value", "Setting", "Value"], [["offer_timeout_s", "15", "gps_trail_retention_days", "180"], ["search_radius_km", "2, 4, 6", "call_recording_retention_days", "90"], ["max_search_time_s", "180", "audit_log_retention_years", "3"]]))
S.append(dict(id="A22", mock=desk("config", "System configuration", filters("Hyderabad", "Bengaluru", "Dubai", "Global", right=dbtn("Save changes")) + cfg + cfg2),
    purpose="City and global settings: which providers are used, which features are on, and key operating parameters.",
    how=["Settings are stored per city with a global default; services read them from a cache refreshed every minute.", "Provider adapters can be switched without a release when a provider has an outage.", "Every change needs a reason and appears in the audit log."],
    elements=["City selector", "Provider adapters with fallback and health", "Feature flags", "Dispatch and retention settings", "Save"],
    apis=[("GET", "/v1/admin/config?city=", "Settings"), ("PUT", "/v1/admin/config/{key}", "Change setting"), ("PUT", "/v1/admin/providers/{capability}", "Switch provider")],
    events=["config.changed"], data=["configuration.settings", "configuration.feature_flags"], to=["A19"],
    edge=["Invalid values are rejected with the allowed range.", "Retention can't be set below the legal minimum for the country."]))
