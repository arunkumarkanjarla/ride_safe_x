"""Screens added in the static application phase (2026-10-10), built with the same helpers and styles as the
approved screens. They fill gaps recorded in docs/analysis/missing-requirements.md:

  Customer  R56 Notifications, R57 Terms & privacy, R58 Sign in or create account
  Driver    D28 Account & profile, D29 Call rider
  Partner   P08 Partner sign-in, P09 Partner home, P10 Business profile & settings, P11 Partner support & complaints
  Admin     A30 Disputes
  Support   S01–S11 user-facing support portal, S20–S24 agent console (new application)

Content marked "(simulated)" in the mocks has no real service behind it.
"""
from components import *
from admin import card, grid, field, tl, filters, dbtn

R, D, P, A, SUP = [], [], [], [], []

SUPPORT_NAV = [("home", "home", "Help"), ("tickets", "doc", "Tickets"), ("chat", "chat", "Chat"), ("call", "phone", "Call")]


def tag(t, k):
    return f'<span class="tag {k}">{t}</span>'


def xsp(t):
    return f'<span class="xs">{t}</span>'


def sec(t):
    return f'<div class="xs" style="font-weight:700;letter-spacing:.06em">{t}</div>'


def bubble(who, text):
    return f'<div class="bubble {who}">{text}</div>'


# ======================================================================== customer
R.append(dict(id="R58", mock=phone(
    appbar("") +
    f'<div class="body" style="gap:14px"><div class="center" style="gap:8px;margin-top:6px">'
    f'<div style="width:64px;height:64px;border-radius:18px;background:#0B7A68;color:#fff;display:flex;align-items:center;justify-content:center">{icon("nav",32,2.2)}</div>'
    f'<div class="h1">Welcome to {B()}</div><div class="sub">Rides, long trips, food and parcels in one app.</div></div>'
    f'{btn("Create an account")}{btn("I already have an account","ghost")}'
    f'{sec("DEMO ACCOUNTS · SIMULATED")}<div class="list">'
    f'{li("user","Ananya Rao","Existing customer · +91 98480 04321",tag("Demo","ok"),"brand")}'
    f'{li("plus","New customer","Registers with +91 90000 00001",tag("Demo","info"),"blue")}</div>'
    f'<div class="fill"></div><div class="xs" style="text-align:center">By continuing you agree to the <b style="color:#0B7A68">Terms and Privacy Policy</b>.</div></div>'),
    purpose="Lets a person choose between creating an account and signing in, or pick a demo account. New in the static application phase.",
    how=["Create an account and I already have an account both continue to phone verification (R03); the mode only changes the wording.",
         "Demo accounts fill in a synthetic phone number so reviewers can try both the returning and the new-customer path.",
         "The Terms and Privacy link opens the summary (R57)."],
    elements=["Brand header", "Create an account", "I already have an account", "Demo account list", "Terms and privacy link"],
    apis=[], data=["Nothing is stored; the demo state lives in memory only"], to=["R03", "R57"],
    edge=["The prototype never creates a real account.", "Reloading the page signs everyone out (in-memory demo)."]))

R.append(dict(id="R57", mock=phone(
    appbar("Terms & privacy") +
    f'<div class="body" style="gap:10px"><div class="banner warn">{icon("alert")}This is a product prototype. Nothing you enter is sent or stored.</div>'
    f'<div class="card-m"><b>Terms of use (summary)</b><span class="xs">Book only for yourself or people you travel with. Fares, fees and refunds follow the published fare card. Misuse of the SOS or support channels can lead to a suspended account.</span></div>'
    f'<div class="card-m"><b>Privacy (summary)</b><span class="xs">We use your phone number to sign you in, your location only while booking and during a trip, and share your first name and pickup point with your driver. Location history is kept for 180 days.</span></div>'
    f'<div class="card-m"><b>Your choices</b><span class="xs">Download or delete your data from Account → Privacy. Turn off marketing messages at any time.</span></div>'
    f'<div class="fill"></div>{btn("I understand")}</div>'),
    purpose="Plain-language summary of the terms and privacy notice shown before sign-up. New; legal text to be supplied by the product owner.",
    how=["Opened from the sign-in screens.", "I understand returns to the previous screen."],
    elements=["Prototype notice", "Terms summary", "Privacy summary", "Choices", "I understand"],
    apis=[("GET", "/v1/legal/terms?country&lang", "Current terms and privacy text (future)")], data=["Static text"], to=["R58"],
    edge=["Final legal text and versioning are open questions (docs/static-app/workflows.md)."]))

R.append(dict(id="R56", mock=phone(
    appbar("Notifications") +
    f'<div class="body" style="gap:10px"><div class="chips"><span class="chip on">All</span><span class="chip">Rides</span><span class="chip">Orders</span><span class="chip">Support</span></div>'
    f'<div class="list" data-list="notifications">'
    f'{li("car","Your ride is complete","Banjara Hills → Hitec City · ₹248",xsp("5:52 PM"),"brand")}'
    f'{li("gift","RIDE50 applied","50% off your next 2 rides",xsp("Mon"),"amber")}'
    f'{li("shield","Trip shared with Mom","Live location until you arrive",xsp("Sun"),"blue")}</div>'
    f'<div class="fill"></div><div class="xs" style="text-align:center">Notifications from this demo session appear at the top.</div></div>'),
    purpose="Inbox of ride, order, support and offer updates. New in the static application phase; live entries come from the simulated events.",
    how=["Shows the latest updates first.", "Filters by Rides, Orders and Support.", "Tapping a ride or order update opens it."],
    elements=["Filter chips", "Notification list", "Empty state"],
    apis=[("GET", "/v1/me/notifications", "Inbox (future)")], events=["notification.read"], data=["In-memory events of the demo session"], to=["R54", "R46", "S07"],
    edge=["No push notifications are sent in the prototype.", "An empty filter shows an empty-state message."]))

# ======================================================================== driver
D.append(dict(id="D28", mock=phone(
    appbar("Account") +
    f'<div class="body" style="gap:10px"><div class="card-m" style="flex-direction:row;align-items:center;gap:12px"><span class="av">AK</span>'
    f'<span style="display:flex;flex-direction:column;flex:1"><b>Arjun Kumar</b><span class="xs">★ 4.9 · 1,240 trips · since 2024</span></span><span class="tag ok">Active</span></div>'
    f'<div class="card-m"><div class="kv"><span>Rating</span><b>4.9</b></div><div class="kv"><span>Acceptance</span><b>92%</b></div><div class="kv"><span>Cancellation</span><b>2%</b></div></div>'
    f'<div class="list">{li("car","White Swift Dzire","TS 09 EA 4521 · Cab","","brand")}{li("doc","Documents","Insurance expires in 12 days",tag("Check","warn"))}'
    f'{li("grid","Services","City rides, food, parcels")}{li("headset","Driver support","Tickets, chat and call-back")}{li("help","Help centre","Articles, chat, calls and e-mail")}</div>'
    f'<div class="fill"></div>{btn("Log out","ghost")}</div>', ),
    purpose="Driver profile, vehicle, ratings and quick links to documents, services and support. New in the static application phase.",
    how=["Reached from the bottom navigation (Account).", "Documents opens expiry alerts (D17); Services opens D21.", "Log out ends the simulated session and returns to D01."],
    elements=["Profile card", "Ratings summary", "Vehicle", "Documents", "Services", "Support links", "Log out"],
    apis=[("GET", "/v1/drivers/me", "Profile, vehicle and ratings (future)")], data=["Synthetic driver profile"], to=["D17", "D21", "D20", "D01"],
    edge=["Logging out while on a trip is refused.", "Profile changes need re-verification (not in the prototype)."]))

D.append(dict(id="D29", mock=phone(
    f'<div class="body center" style="justify-content:center;gap:14px"><div class="av lg" style="width:96px;height:96px;font-size:30px">AR</div>'
    f'<div class="h1">Ananya R.</div><div class="sub">Calling through {B()} · numbers hidden</div>'
    f'<div style="font-size:18px;font-variant-numeric:tabular-nums">00:00</div>'
    f'<div style="display:flex;gap:26px;margin-top:40px">'
    f'<div class="center" style="gap:6px"><span class="ic" style="width:58px;height:58px">{icon("mic",22)}</span><span class="xs">Mute</span></div>'
    f'<div class="center" style="gap:6px"><span class="ic" style="width:58px;height:58px">{icon("bell",22)}</span><span class="xs">Speaker</span></div>'
    f'<div class="center" style="gap:6px"><span class="ic" style="width:58px;height:58px">{icon("chat",22)}</span><span class="xs">Message</span></div></div>'
    f'<div style="margin-top:36px;width:70px;height:70px;border-radius:50%;background:#D93A1E;color:#fff;display:flex;align-items:center;justify-content:center">{icon("phone",28)}</div>'
    f'<div class="xs" style="margin-top:24px">Simulated call · no audio, no real numbers</div></div>', dark=True),
    purpose="Masked call from the driver to the rider during an assigned ride. New; mirrors the rider's call screen (R13).",
    how=["Opened from the phone icon on D08 and D09.", "Only available while the ride is assigned (proxy number window).", "End returns to the trip screen."],
    elements=["Rider name", "Timer", "Mute, speaker, message", "End call"],
    apis=[("POST", "/v1/rides/{id}/call", "Bridge a masked call (future, Asterisk)")], events=["call.started", "call.ended"], data=["Ride id"], to=["D08", "D09"],
    edge=["No microphone permission is requested.", "Outside an active ride the call is refused."]))

# ======================================================================== partner
P.append(dict(id="P08", mock=phone(
    appbar("", back=False) +
    f'<div class="body"><div class="h1">Partner sign-in</div><div class="sub">Restaurants, hotels, rental companies and bus operators.</div>'
    f'{inp("Business e-mail","orders@biryanihouse.example")}{inp("Verification code","6-digit code",ph=True)}'
    f'<div class="xs">Demo code 482716 · simulated e-mail, nothing is sent.</div>{btn("Sign in")}'
    f'<div class="xs" style="text-align:center">New partner? <b style="color:#0B7A68">Apply to join</b></div><div class="fill"></div></div>'),
    purpose="Simulated sign-in for partner businesses. New in the static application phase.",
    how=["Enter the business e-mail and the 6-digit code.", "Valid input signs in and opens the partner home (P09).", "Apply to join opens onboarding (P01)."],
    elements=["Business e-mail", "Verification code", "Sign in", "Apply to join"],
    apis=[("POST", "/v1/partners/auth/otp", "Send code (future)"), ("POST", "/v1/partners/auth/verify", "Verify (future)")], data=["Nothing stored"], to=["P09", "P01"],
    edge=["Invalid e-mail or code shows inline errors.", "The prototype never authenticates anyone."]))

P.append(dict(id="P09", mock=phone(
    f'<div class="ab"><span class="t">Partner home</span><span class="chip on">Open</span></div>'
    f'<div class="body" style="gap:10px"><div class="row2"><div class="card-m"><span class="xs">Orders today</span><b style="font-size:20px">46</b></div>'
    f'<div class="card-m"><span class="xs">Bookings today</span><b style="font-size:20px">9</b></div></div>'
    f'<div class="banner info">{icon("users")}This demo account manages one business of each partner type.</div>'
    f'<div class="list">{li("food","Biryani House","Restaurant orders",tag("1 new","warn"),"brand")}{li("grid","Menu & availability","Items, prices, opening hours")}'
    f'{li("bed","Heritage View Hotel","Rooms, rates and arrivals","","blue")}{li("key","Ride Easy Rentals","Fleet calendar and handovers")}'
    f'{li("bus","Malabar Travels","Bus trips and boarding lists")}{li("wallet","Payouts & reviews","Next payout Monday")}</div>'
    f'<div class="fill"></div></div>' + bnav(PARTNER_NAV, "orders")),
    purpose="Partner dashboard: today's orders and bookings and the businesses this account manages. New in the static application phase.",
    how=["Shows counts for the day.", "Each business opens its own screen (P02–P07)."],
    elements=["Open/closed status", "Today's counts", "Business list", "Bottom navigation"],
    apis=[("GET", "/v1/partners/me/dashboard", "Counts and businesses (future)")], data=["Synthetic partner"], to=["P02", "P03", "P04", "P05", "P06", "P07"],
    edge=["A partner with one business type would see only that entry."]))

P.append(dict(id="P10", mock=phone(
    appbar("Settings", back=False) +
    f'<div class="body" style="gap:10px"><div class="card-m"><b>Biryani House</b><span class="xs">Road 10, Banjara Hills · GSTIN 36•••••••1Z5 · verified</span></div>'
    f'<div class="list">{li("clock","Opening hours","11:00 AM – 11:30 PM daily")}{li("wallet","Bank account","HDFC •••• 8812 · weekly payouts")}'
    f'{li("bell","Order alerts","Sound and vibration",'<span class="toggle on"></span>')}{li("headset","Support & complaints","Disputes, payouts, listings")}'
    f'{li("help","Help centre","Articles, chat, calls and e-mail")}</div><div class="fill"></div>{btn("Log out","ghost")}</div>' + bnav(PARTNER_NAV, "acct")),
    purpose="Business profile and settings for the partner, with support and log out. New in the static application phase.",
    how=["Shows the verified business details (synthetic).", "Support & complaints opens P11; Log out returns to P08."],
    elements=["Business card", "Opening hours", "Bank account", "Order alerts switch", "Support links", "Log out"],
    apis=[("GET", "/v1/partners/me", "Business profile (future)"), ("PATCH", "/v1/partners/me/settings", "Settings (future)")], data=["Synthetic business"], to=["P11", "P08"],
    edge=["Bank changes need re-verification (not in the prototype)."]))

P.append(dict(id="P11", mock=phone(
    appbar("Support & complaints") +
    f'<div class="body" style="gap:10px"><div class="sub">Raise an issue about an order, a payout or your listing.</div>'
    f'<div class="list">{li("bag","Order dispute","#4409 · customer says item missing")}{li("wallet","Payout or commission question","Last payout ₹42,380")}'
    f'{li("grid","Listing or menu problem","Items, photos, prices")}{li("flag","Report a customer or delivery partner","Behaviour or safety")}</div>'
    f'{sec("RECENT")}<div class="list">{li("doc","#48731 · Commission rate","Resolved · 3 days ago",tag("Resolved","ok"))}</div>'
    f'<div class="fill"></div>{btn("Talk to an agent","soft")}</div>'),
    purpose="Partner-side entry to support: quick complaint types and recent cases. New in the static application phase.",
    how=["Each complaint type raises a support ticket (simulated) that RideNova agents answer by message, call or e-mail (agent portal).", "Talk to an agent raises a general request for an agent."],
    elements=["Complaint types", "Recent cases", "Talk to an agent"],
    apis=[("POST", "/v1/support/tickets", "Create ticket (future)")], events=["ticket.created"], data=["Synthetic cases"], to=[],
    edge=["Duplicate complaints about the same order are merged by the agent (policy to confirm)."]))

# ======================================================================== admin
A.append(dict(id="A30", mock=desk("support", "Disputes", (
    f'<div class="kpis">{kpi("Open disputes","14","3 new today")}{kpi("Avg resolution","1.6 d","−0.2 d")}{kpi("Refunded this week","₹8,420")}{kpi("Past SLA","2","",True,True)}</div>'
    + filters("All", "Fare", "Cancellation fee", "Food & parcels", "Partner") +
    grid("1.5fr 1fr",
         card("Disputes", dtable(["Dispute", "Type", "Party", "Amount", "Age", "Status"], [
             ["DSP-2201 · RN-00125", "Fare", "Rider · Ananya R.", "₹12", "2 h", st("Open", "warn")],
             ["DSP-2198 · #4409", "Food & parcels", "Rider · Rahul M.", "₹289", "5 h", st("Evidence", "info")],
             ["DSP-2190 · RN-00098", "Cancellation fee", "Rider · Divya P.", "₹50", "1 d", st("Open", "warn")],
             ["DSP-2187 · PO-0921", "Partner", "Partner · Biryani House", "₹1,240", "2 d", st("Past SLA", "err")],
             ["DSP-2180 · RN-00077", "Fare", "Driver · Imran S.", "₹40", "3 d", st("Resolved", "ok")]])),
         card("DSP-2201 · Fare dispute", f'{field("Ride", "RN-20260927-00125 · ₹248 vs ₹236 quote")}{field("Reason", "Trip took 26 min instead of 22")}'
              f'{field("Evidence", "GPS trail 186 points · route deviation check: none")}'
              f'<div style="display:flex;gap:8px;flex-wrap:wrap">{dbtn("Approve refund")}{dbtn("Ask for evidence","g")}{dbtn("Reject","r")}</div>'
              + tl([("17:44", "Rider opened dispute in support chat", ""), ("17:46", "AI summary attached", ""), ("18:02", "Assigned to disputes queue", "a")])),
         style="flex:1;min-height:0"))),
    purpose="Queue of fare, fee, food and partner disputes with evidence and decisions. New; the blueprint had tickets (A12) but no dispute queue.",
    how=["Filter by type; select a dispute to see its evidence.", "Approve refund needs payment.refund; Reject and Ask for evidence are recorded in the audit log."],
    elements=["KPIs", "Type filters", "Dispute table", "Evidence and decision panel", "Timeline"],
    apis=[("GET", "/v1/admin/disputes", "Queue (future)"), ("POST", "/v1/admin/disputes/{id}/decision", "Decision (future)")],
    events=["dispute.decided"], data=["Synthetic disputes"], to=["A11", "A12", "A04"],
    edge=["Refund limits and second approval are open questions.", "Decisions on resolved disputes are refused."]))

A.append(dict(id="A31", mock=desk("agents", "Agent portal control", (
    f'<div style="display:flex;gap:10px;align-items:center;padding:10px 12px;background:#fff;border:1px solid #E3E8EC;border-radius:12px;font-size:12.5px">'
    f'<b>Published policy v1</b><span>10 Oct, 09:00 · Priya K. · Operations manager</span>{st("Draft = published", "ok")}<span style="flex:1"></span>'
    f'{dbtn("Publish to agents")}{dbtn("Download agent-policy.js", "g")}</div>'
    f'<div class="dtabs"><span class="on">Live monitor</span><span>Agents</span><span>Channels &amp; routing</span><span>Roles &amp; limits</span>'
    f'<span>Templates &amp; knowledge</span><span>Announcements</span><span>Publish</span></div>'
    f'<div class="kpis">{kpi("Agents signed in", "3 / 4")}{kpi("On calls", "1")}{kpi("Calls waiting", "2")}{kpi("E-mails waiting", "4")}{kpi("Social waiting", "3")}{kpi("Past SLA", "1", "", True, True)}</div>'
    + card("Agents", dtable(["Agent", "Role", "Team", "Channels", "Status", "Open", "Policy"], [
        ["Meera S.", "Agent", "Customer care", "Calls, e-mail, chat, WhatsApp", st("Available", "ok"), "3", st("v1", "ok")],
        ["Vikram R.", "Senior agent", "Driver care", "All channels", st("On a call", "info"), "2", st("v1", "ok")],
        ["Farah N.", "Agent", "Partner care", "Calls, e-mail, social", st("On break", "warn"), "4", st("v1", "ok")],
        ["Rohan D.", "Team supervisor", "All teams", "All channels", st("Available", "ok"), "1", st("v1", "ok")],
        ["Sana P.", "Agent", "Social media", "WhatsApp, Facebook, Instagram, X", st("Suspended", "err"), "—", "—"]]), style="flex:1"))),
    purpose="The admin controls the agent portal: agent accounts, roles and credit limits, channels (calls, e-mail, chat, WhatsApp, Facebook, Instagram, X), routing, reply templates, knowledge articles and announcements, plus a live monitor of signed-in agents. New in the static application phase.",
    how=["Changes are made in a draft and published as a new policy version (needs agentdesk.manage; written to the audit log).",
         "Agent portals open on the same site receive a publish at once and report their status back (BroadcastChannel, no server).",
         "Download agent-policy.js gives the file the agent portal server is deployed with.",
         "Suspending an agent or switching a channel off takes effect in the agent portal on publish; Sign out ends an agent's session remotely."],
    elements=["Published version and draft status", "Publish, discard and download", "Live monitor", "Agent accounts", "Channels & routing", "Roles & limits", "Templates & knowledge", "Announcements"],
    apis=[("GET", "/v1/admin/agent-desk/policy", "Current policy (future)"), ("PUT", "/v1/admin/agent-desk/policy", "Publish a version (future)"),
          ("GET", "/v1/admin/agent-desk/presence", "Agents signed in (future)"), ("POST", "/v1/admin/agent-desk/agents/{id}/sign-out", "Remote sign-out (future)")],
    events=["agentdesk.policy_published", "agentdesk.agent_signed_out"], data=["agent-policy.js (synthetic)", "Agent presence in memory"], to=["A12", "A15", "A19"],
    edge=["Roles without agentdesk.manage see the screen read-only; publish attempts are denied and audited.",
          "Publishing is refused when no agent account or no channel would remain active.",
          "On separate servers the live link is not available: the downloaded file must be deployed with the agent portal."]))

# ======================================================================== support portal – user side (phone)
SUP.append(dict(id="S01", mock=phone(
    appbar(f'{B()} Help', back=False) +
    f'<div class="body" style="gap:12px"><div class="h1">Who needs help?</div><div class="sub">We show the help that fits you.</div>'
    f'<div class="opt on">{icon("user",22)}<span class="tx"><b>Customer</b><span>Rides, long trips, food, parcels, payments</span></span></div>'
    f'<div class="opt">{icon("car",22)}<span class="tx"><b>Driver or delivery partner</b><span>Trips, earnings, payouts, documents</span></span></div>'
    f'<div class="opt">{icon("bag",22)}<span class="tx"><b>Business partner</b><span>Restaurants, hotels, rentals, buses</span></span></div>'
    f'<div class="banner warn">{icon("alert")}Support portal prototype · synthetic data · no messages are sent.</div>'
    f'<div class="fill"></div>{btn("Continue")}<div class="xs" style="text-align:center">Support agent? <b style="color:#0B7A68">Open the agent console</b></div></div>'),
    purpose="Entry to the support portal: the person chooses whether they are a customer, a driver or a partner. New application.",
    how=["The choice sets which records, categories and wording are shown.", "Continue opens the support home (S02).", "Agents use the agent console (S20)."],
    elements=["User type options", "Prototype notice", "Continue", "Agent console link"],
    apis=[], data=["In-memory choice"], to=["S02", "S20"], edge=["Signed-in users of the apps skip this step in a future version."]))

SUP.append(dict(id="S02", mock=phone(
    f'<div class="ab"><span class="t">Help centre</span><span class="chip">Customer</span></div>'
    f'<div class="body" style="gap:10px">{inp("Search help articles","Search, e.g. refund",ph=True,ic="search")}'
    f'<div class="row2">{btn("Chat with us","sm",ic="chat")}{btn("Call me back","ghost sm",ic="phone")}</div>{btn("Raise a ticket","soft sm",ic="doc")}'
    f'{sec("BROWSE BY TOPIC")}<div class="list" data-list="categories">'
    f'{li("user","Login and account")}{li("car","Booking and cancellations")}{li("users","Driver or rider issues")}{li("card","Payments and refunds")}'
    f'{li("bag","Food and parcel delivery")}{li("grid","Partner issues")}{li("shield","Safety and SOS","","","red")}{li("settings","Technical issues")}</div>'
    f'<div class="fill"></div></div>' + bnav(SUPPORT_NAV, "home")),
    purpose="Support home: search articles, browse topics, start a chat, request a call-back or raise a ticket. New application.",
    how=["Search filters the help articles as you type.", "A topic opens its common issues (S03).", "Chat (S09), Call me back (S10) and Raise a ticket (S05 → S06)."],
    elements=["Article search", "Chat, call-back and ticket actions", "Topic list", "Bottom navigation"],
    apis=[("GET", "/v1/support/articles?q=", "Search (future)")], data=["Synthetic help articles"], to=["S03", "S04", "S05", "S07", "S09", "S10"],
    edge=["No results shows a 'Raise a ticket' suggestion.", "Safety topics always show the emergency number."]))

SUP.append(dict(id="S03", mock=phone(
    appbar("Payments and refunds") +
    f'<div class="body" style="gap:10px"><div class="sub">What went wrong?</div><div class="list" data-list="issues">'
    f'{li("card","I was charged more than the estimate")}{li("card","Payment failed but money was deducted")}{li("card","Refund not received")}{li("card","Payout or earnings issue")}</div>'
    f'{sec("RELATED ARTICLES")}<div class="list" data-list="articles">{li("doc","Why the final fare can differ from the estimate")}{li("doc","When will I get my refund")}</div>'
    f'<div class="fill"></div>{btn("Something else · raise a ticket","ghost")}</div>'),
    purpose="Common issues and articles for one support topic. New application.",
    how=["Choosing an issue continues to the related trip/order selection (S05).", "Articles open S04."],
    elements=["Issue list", "Related articles", "Raise a ticket"], apis=[], data=["Synthetic catalogue"], to=["S05", "S04", "S06"],
    edge=["Safety topics add a call-112 banner."]))

SUP.append(dict(id="S04", mock=phone(
    appbar("Help article") +
    f'<div class="body" style="gap:10px"><div class="h2">Why the final fare can differ from the estimate</div>'
    f'<div class="sub" style="font-size:14px;line-height:1.5">The estimate uses the expected route and time. The final fare uses the actual distance and time from the trip, so traffic or a changed destination can change it. Every line of the fare is shown on your receipt.</div>'
    f'<div class="card-m"><b>Was this helpful?</b><div class="chips"><span class="chip">Yes</span><span class="chip">No</span></div></div>'
    f'<div class="fill"></div>{btn("Still need help? Contact us")}</div>'),
    purpose="One help article with a helpfulness check. New application.",
    how=["Shows the article text.", "Yes/No records simulated feedback.", "Still need help continues to ticket creation."],
    elements=["Title", "Article text", "Helpful? chips", "Contact us"], apis=[("GET", "/v1/support/articles/{id}", "Article (future)")],
    events=["article.feedback"], data=["Synthetic article"], to=["S05"], edge=["Articles are per country and language in the future."]))

SUP.append(dict(id="S05", mock=phone(
    appbar("Which trip or order?") +
    f'<div class="body" style="gap:10px"><div class="chips"><span class="chip on">Rides</span><span class="chip">Orders</span><span class="chip">Payments</span></div>'
    f'<div class="list" data-list="records">{li("car","Banjara Hills → Hitec City","RN-20260927-00125 · Today 5:45 PM · ₹248","","brand")}'
    f'{li("car","Home → Work","RN-20260924-00031 · 24 Sep · ₹212")}{li("bag","Biryani House","Order #4415 · ₹458")}{li("card","UPI payment","₹248 · ananya@okbank")}'
    f'{li("x","None of these","Raise a general question")}</div><div class="fill"></div>{btn("Continue")}</div>'),
    purpose="Links the support request to a trip, order or payment from the demo records. New application.",
    how=["Records from this demo session appear first, then sample records.", "Continue opens the ticket form with the record attached."],
    elements=["Record type chips", "Record list", "None of these", "Continue"],
    apis=[("GET", "/v1/me/rides?limit=10", "Recent rides (future)"), ("GET", "/v1/me/orders?limit=10", "Recent orders (future)")], data=["In-memory and sample records"], to=["S06"],
    edge=["Continue without a choice asks to pick a record or 'None of these'."]))

SUP.append(dict(id="S06", mock=phone(
    appbar("New ticket") +
    f'<div class="body" style="gap:9px">{inp("Category","Payments and refunds")}{inp("What went wrong?","I was charged more than the estimate")}'
    f'{inp("Related trip or order","RN-20260927-00125")}'
    f'<div class="inp"><label>Priority</label><div class="chips"><span class="chip">Urgent</span><span class="chip">High</span><span class="chip on">Normal</span></div></div>'
    f'{inp("Describe the problem","Tell us what happened",ph=True)}'
    f'<div class="upload">{icon("upload")}<span class="tx"><b>Add a screenshot</b><span class="xs">Optional · synthetic file only</span></span></div>'
    f'<div class="fill"></div>{btn("Submit ticket")}</div>'),
    purpose="Ticket form: category, issue, related record, priority, description and an optional (synthetic) attachment. New application.",
    how=["All required fields are validated before submit.", "Submit creates the ticket in the in-memory demo and opens its conversation (S08).",
         "The same ticket appears in the agent console (S21–S23) in the connected demo."],
    elements=["Category", "Issue", "Related record", "Priority", "Description", "Attachment (simulated)", "Submit"],
    apis=[("POST", "/v1/support/tickets", "Create ticket (future)")], events=["ticket.created"], data=["In-memory ticket"], to=["S08"],
    edge=["Description under 10 characters is rejected.", "No file is read: the attachment is a synthetic name."]))

SUP.append(dict(id="S07", mock=phone(
    f'<div class="ab"><span class="t">My tickets</span></div>'
    f'<div class="body" style="gap:10px"><div class="chips"><span class="chip on">Open</span><span class="chip">Resolved</span><span class="chip">All</span></div>'
    f'<div class="list" data-list="tickets">{li("doc","#48802 · Lost item · black backpack","Waiting on you · 3 h ago",tag("Reply","warn"))}</div>'
    f'<div class="fill"></div>{btn("Raise a new ticket","soft")}</div>' + bnav(SUPPORT_NAV, "tickets")),
    purpose="The person's tickets with their status. New application.",
    how=["Filter by open or resolved.", "A ticket opens its conversation (S08)."],
    elements=["Status filter", "Ticket list", "New ticket"], apis=[("GET", "/v1/support/tickets?mine=1", "My tickets (future)")], data=["In-memory tickets"], to=["S08", "S05"],
    edge=["Empty list shows how to raise a ticket."]))

SUP.append(dict(id="S08", mock=phone(
    appbar("#48802 · Lost item") +
    f'<div class="body" style="gap:8px"><div style="display:flex;gap:8px;align-items:center"><span class="tag warn">Waiting on you</span><span class="xs">Assigned to Meera S. · first reply in 4 h</span></div>'
    f'<div class="card-m" style="flex:1;gap:8px" data-list="messages">{bubble("me","I left my black backpack on the back seat.")}'
    f'{bubble("them","Arjun has your bag. He can drop it at 8 PM; ₹100 return fee applies. OK?")}</div>'
    f'{inp("Your message","Write a reply",ph=True)}'
    f'<div class="row2">{btn("Send","sm")}{btn("Attach file","ghost sm")}</div>'
    f'<div class="row2">{btn("Close ticket","ghost sm")}{btn("Rate support","ghost sm")}</div></div>'),
    purpose="Ticket conversation: messages, reply, synthetic attachment, close or reopen, and feedback. New application.",
    how=["Shows the conversation and status.", "Replying to a 'Waiting on you' ticket moves it back to the agent.", "Closed tickets can be reopened with a reason; resolved tickets can be rated."],
    elements=["Status and assignee", "Conversation", "Reply box", "Send", "Attach (simulated)", "Close / reopen", "Rate support"],
    apis=[("GET", "/v1/support/tickets/{id}", "Ticket (future)"), ("POST", "/v1/support/tickets/{id}/messages", "Reply (future)")],
    events=["ticket.message", "ticket.closed", "ticket.reopened"], data=["In-memory ticket"], to=["S11", "S07"],
    edge=["Empty or over-long messages are refused.", "Messages cannot be added to a closed ticket."]))

SUP.append(dict(id="S09", mock=phone(
    appbar("Chat with support") +
    f'<div class="body" style="gap:8px"><div class="banner info">{icon("clock")}You are 2nd in the queue · about 1 min</div>'
    f'<div class="card-m" style="flex:1;gap:8px" data-list="chat">{bubble("sys","Chat started 6:02 PM")}{bubble("them","Hi Ananya, I am Meera. How can I help?")}'
    f'{bubble("me","My refund has not arrived.")}<div class="bubble them" style="opacity:.6">Meera is typing…</div></div>'
    f'{inp("Message","Type a message",ph=True)}<div class="row2">{btn("Send","sm")}{btn("End chat","ghost sm")}</div>{btn("Turn this chat into a ticket","soft sm")}</div>'
    + bnav(SUPPORT_NAV, "chat")),
    purpose="Live chat with a support agent, simulated with local replies. New application.",
    how=["Start puts the person in a queue; a simulated agent joins.", "Messages get keyword-based replies with a typing indicator.",
         "End chat asks for confirmation; Turn into a ticket keeps the transcript.", "When no agent is available the chat offers a ticket instead."],
    elements=["Queue / agent status", "Messages with timestamps", "Typing indicator", "Composer", "End chat", "Escalate to ticket"],
    apis=[("WS", "/ws/support/chat", "Live chat (future)")], events=["chat.started", "chat.message", "chat.ended"], data=["In-memory chat"], to=["S08", "S02"],
    edge=["No WebSocket or messaging service is used.", "Messages over 500 characters are refused."]))

SUP.append(dict(id="S10", mock=phone(
    appbar("Call me back") +
    f'<div class="body" style="gap:10px"><div class="banner warn">{icon("phone")}Simulated voice support · no call is made, no microphone is used.</div>'
    f'{inp("What is the call about?","Payments and refunds")}{inp("We will call","+91 98••• ••321 (masked)")}'
    f'<div class="card-m center" style="gap:6px" data-list="call"><span class="ic brand" style="width:56px;height:56px">{icon("headset",26)}</span>'
    f'<b>Average wait 2 min</b><span class="xs">An agent calls you back from a masked number.</span></div>'
    f'<div class="fill"></div>{btn("Request a call-back",ic="phone")}</div>' + bnav(SUPPORT_NAV, "call")),
    purpose="Voice support: request a call-back and follow queue, ringing, connected and ended states (simulated). New application.",
    how=["Choose the topic and confirm the request.", "Queue position updates, then the phone rings: Answer or Decline.",
         "Connected shows a call timer; Hang up shows a summary.", "Busy, missed and failed outcomes offer a retry or a ticket."],
    elements=["Simulation notice", "Topic", "Masked number", "Call status card", "Request / Answer / Decline / Hang up", "Summary"],
    apis=[("POST", "/v1/support/callbacks", "Request call-back (future, telephony)")], events=["call.requested", "call.answered", "call.ended"],
    data=["In-memory call"], to=["S08"], edge=["No real call, SIP, WebRTC or microphone access.", "Only one active call-back at a time."]))

SUP.append(dict(id="S11", mock=phone(
    appbar("Rate your support") +
    f'<div class="body" style="gap:12px"><div class="center"><div class="h2">How did we do?</div><div class="sub">Ticket #48802 · Lost item</div>'
    f'<div class="stars">{icon("star")}{icon("star")}{icon("star")}{icon("star")}<span style="color:#D5DDE2">{icon("star")}</span></div></div>'
    f'<div class="chips" style="justify-content:center"><span class="chip">Quick reply</span><span class="chip">Solved my problem</span><span class="chip">Friendly agent</span></div>'
    f'{inp("Anything else?","Optional comment",ph=True)}<div class="fill"></div>{btn("Submit feedback")}</div>'),
    purpose="Customer satisfaction rating after a ticket is resolved. New application.",
    how=["Choose 1–5 stars and optional tags and comment.", "Submit records the feedback on the ticket (in memory)."],
    elements=["Stars", "Tags", "Comment", "Submit"], apis=[("POST", "/v1/support/tickets/{id}/feedback", "Feedback (future)")],
    events=["ticket.feedback"], data=["In-memory ticket"], to=["S07"], edge=["Feedback is possible once per ticket, after it is resolved."]))

# ======================================================================== support portal – agent console (desktop)
SUPPORT_MENU = [("SUPPORT", [("queue", "grid", "Queue"), ("cases", "doc", "Case workspace"), ("tickets", "filter", "All tickets"), ("chats", "chat", "Live chats")]),
                ("ACCOUNT", [("signout", "logout", "Sign out")])]


def sdesk(active, title, content, right=""):
    items = []
    for g, lst in SUPPORT_MENU:
        items.append(f'<div class="grp">{g}</div>')
        for k, ic, t in lst:
            items.append(f'<a class="{"on" if k == active else ""}">{icon(ic, 16)}{t}</a>')
    sb = f'<div class="dsb"><div class="lg"><i></i>{B()} Support</div>{"".join(items)}</div>'
    top = (f'<div class="dtop"><span class="ttl">{title}</span>{right}<span class="srch">{icon("search", 15)}Search tickets, people, rides</span>'
           f'<span class="me"><span class="av">MS</span><span style="display:flex;flex-direction:column"><b style="font-size:12.5px">Meera S.</b>'
           f'<span style="font-size:11px;color:#667685">Support agent · demo</span></span></span></div>')
    return f'<div class="desk">{sb}<div class="dmain">{top}<div class="dc">{content}</div></div></div>'


SUP.append(dict(id="S20", mock=(
    f'<div class="desk" style="grid-template-columns:1fr 1fr"><div style="background:linear-gradient(160deg,#0B7A68,#0A3F36);color:#fff;padding:48px;display:flex;flex-direction:column;gap:14px;justify-content:center">'
    f'<div style="display:flex;align-items:center;gap:10px;font-size:26px;font-weight:800"><i style="width:34px;height:34px;border-radius:9px;background:#fff;display:inline-block"></i>{B()}</div>'
    f'<div style="font-size:30px;font-weight:800;line-height:1.15;max-width:420px">Support console</div><div style="opacity:.8;max-width:420px">Chats, call-backs and tickets from customers, drivers and partners. Demo workspace with synthetic data.</div></div>'
    f'<div style="background:#fff;display:flex;align-items:center;justify-content:center"><div style="width:360px;display:flex;flex-direction:column;gap:14px">'
    f'<div style="font-size:22px;font-weight:800">Agent sign-in</div>{field("Agent profile", "Meera S. ▾")}{field("Demo code", "6-digit code")}'
    f'<span class="dbtn" style="height:42px;justify-content:center;font-size:14px">Sign in</span>'
    f'<div style="color:#667685;font-size:12.5px">Demo code 246810. Simulated sign-in: no account, no real customer data.</div></div></div></div>'),
    purpose="Agent sign-in for the support console (simulated). New application.",
    how=["Pick an agent profile and enter the demo code.", "Sign-in sets the agent to Available and opens the queue (S21)."],
    elements=["Agent profile", "Demo code", "Sign in"], apis=[("POST", "/v1/support/agents/session", "OIDC + MFA in production (future)")],
    events=["agent.signed_in"], data=["Nothing stored"], to=["S21"], edge=["Wrong code shows an inline error."]))

SUP.append(dict(id="S21", mock=sdesk("queue", "Queue", (
    f'<div style="display:flex;gap:8px;align-items:center"><span class="st ok" style="padding:5px 10px;font-size:12px">Available</span>'
    f'<span class="st" style="padding:5px 10px;font-size:12px">Away</span><span class="st" style="padding:5px 10px;font-size:12px">Offline</span>'
    f'<span style="margin-left:auto;color:#667685;font-size:12px">Simulated queue · synthetic customers</span></div>'
    f'<div class="kpis">{kpi("Chats waiting","1")}{kpi("Call-backs waiting","1")}{kpi("My open cases","2")}{kpi("Past SLA","1","",True,True)}</div>'
    + grid("1fr 1.4fr",
           card("Incoming", dtable(["Channel", "From", "Topic", "Waiting", ""], [["Chat", "Ananya R.", "Refund not received", "0:40", dbtn("Accept")],
                                                                              ["Call-back", "Arjun K.", "Payout issue", "1:10", st("Queued", "info")]])),
           card("My cases", dtable(["Ticket", "From", "Issue", "Priority", "SLA", "Status"], [
               ["#48802", "Ananya R.", "Lost item", "P2", st("1 h left", "warn"), "Waiting on user"],
               ["#48790", "Arjun K.", "Fare dispute", "P2", st("3 h left", "ok"), "In progress"],
               ["#48811", "Karthik V.", "Driver rude", "P1", st("Past SLA", "err"), "Open"]])),
           style="flex:1;min-height:0"))),
    purpose="Agent's queue: availability, incoming chats and call-backs, and assigned cases with SLA. New application.",
    how=["Availability controls whether new chats are offered.", "Accept takes a waiting chat (S24).", "A case opens the case workspace (S22)."],
    elements=["Availability", "KPIs", "Incoming chats and calls", "My cases with SLA"], apis=[("GET", "/v1/support/queue", "Queue (future)")],
    data=["In-memory support state"], to=["S22", "S23", "S24"], edge=["Away or Offline agents receive no new chats."]))

SUP.append(dict(id="S22", mock=sdesk("cases", "Case workspace", grid("0.8fr 1.4fr 1fr",
    card("Customer", f'{field("Name", "Ananya R. · customer · ★ 4.8")}{field("Phone", "+91 98••• ••321 (masked)")}{field("Reference", "RN-20260927-00125 · ₹248 · UPI")}'
         f'{field("Previous tickets", "2 · last 12 Sep")}' + tl([("17:44", "Ride requested", ""), ("18:11", "Ride completed", ""), ("18:20", "Ticket #48802 opened", "a")])),
    card("#48802 · Lost item · black backpack", f'<div style="display:flex;flex-direction:column;gap:8px;flex:1">'
         f'<div><b>Ananya</b>: I left my black backpack on the back seat.</div><div><b>Meera (support)</b>: Arjun has your bag. He can drop it at 8 PM; ₹100 return fee applies. OK?</div>'
         f'<div style="color:#667685">Internal note: driver confirmed by masked call.</div></div>'
         f'{field("Reply", "Write a reply…")}<div style="display:flex;gap:8px">{dbtn("Send reply")}{dbtn("Add internal note","g")}</div>'),
    card("Actions", f'{dbtn("Assign to me")}{field("Reassign", "Vikram R. ▾")}{field("Priority", "P2 ▾")}'
         f'<div style="display:flex;gap:8px;flex-wrap:wrap">{dbtn("Escalate","g")}{dbtn("Wait for user","g")}</div>'
         f'{field("Resolution category", "Lost item returned ▾")}{field("Resolution notes", "Bag returned at 8 PM")}'
         f'<div style="display:flex;gap:8px;flex-wrap:wrap">{dbtn("Resolve")}{dbtn("Close","g")}{dbtn("Reopen","g")}</div>'),
    style="flex:1;min-height:0")),
    purpose="Case workspace: customer context, linked ride/order/payment, conversation, internal notes and all case actions. New application.",
    how=["Assign to me starts work; Reassign moves the case to another agent.", "Replies go to the customer; internal notes stay in the console.",
         "Resolve needs a category and notes; Close and Reopen follow the ticket state machine.", "Every change is added to the case history."],
    elements=["Customer context", "Reference", "Conversation", "Reply and internal note", "Assign/reassign", "Priority", "Escalate", "Resolution", "Close/reopen", "History"],
    apis=[("GET", "/v1/support/tickets/{id}", "Case (future)"), ("PATCH", "/v1/support/tickets/{id}", "Update (future)")],
    events=["ticket.assigned", "ticket.escalated", "ticket.resolved", "ticket.closed", "ticket.reopened"], data=["In-memory ticket"], to=["S21", "S23"],
    edge=["Resolving without category or notes is refused.", "Actions on a closed ticket other than reopen are refused."]))

SUP.append(dict(id="S23", mock=sdesk("tickets", "All tickets", (
    filters("All", "Open", "In progress", "Waiting", "Escalated", "Resolved", "Closed") +
    card("Tickets", dtable(["Ticket", "From", "Category", "Issue", "Priority", "Assignee", "SLA", "Status"], [
        ["#48790", "Driver · Arjun K.", "Payments", "Fare dispute", "P2", "Meera S.", st("3 h left", "ok"), "In progress"],
        ["#48802", "Rider · Ananya R.", "Safety", "Lost item", "P2", "Meera S.", st("1 h left", "warn"), "Waiting on user"],
        ["#48811", "Rider · Karthik V.", "People", "Driver rude", "P1", "—", st("Past SLA", "err"), "Open"],
        ["#48815", "Driver · Imran S.", "Payments", "Payout failed", "P3", "—", st("19 h left", "ok"), "Open"]]), style="flex:1"))),
    purpose="All tickets with status filters, search and sorting. New application.",
    how=["Filter by status; search by ticket, person or reference; sort by column.", "A row opens the case workspace (S22)."],
    elements=["Status filters", "Search", "Sortable ticket table"], apis=[("GET", "/v1/support/tickets?status&q&sort", "Search (future)")],
    data=["In-memory tickets"], to=["S22"], edge=["No match shows an empty state."]))

SUP.append(dict(id="S24", mock=sdesk("chats", "Live chats", grid("0.8fr 1.6fr",
    card("Chats", dtable(["Chat", "From", "Topic", "State"], [["CH-7001", "Ananya R.", "Refund not received", st("Active", "ok")], ["CH-6998", "Rahul M.", "Order late", st("Ended", "")]])),
    card("CH-7001 · Ananya R.", f'<div style="display:flex;flex-direction:column;gap:8px;flex:1"><div style="color:#667685">Meera S. joined the chat.</div>'
         f'<div><b>Ananya</b>: My refund has not arrived.</div><div><b>Meera</b>: I can see the refund. UPI refunds arrive within 1–3 working days.</div></div>'
         f'{field("Reply", "Type a reply…")}<div style="display:flex;gap:8px">{dbtn("Send")}{dbtn("Accept chat","g")}{dbtn("Create ticket","g")}{dbtn("End chat","r")}</div>'),
    style="flex:1;min-height:0")),
    purpose="Agent view of live chats: accept, reply, turn into a ticket, end. New application.",
    how=["Select a chat; Accept assigns it to you when it is waiting.", "Replies appear in the customer's chat (S09) in the connected demo."],
    elements=["Chat list", "Conversation", "Reply", "Accept, create ticket, end"], apis=[("WS", "/ws/support/agent", "Agent channel (future)")],
    events=["chat.assigned", "chat.message", "chat.ended"], data=["In-memory chats"], to=["S21", "S22"], edge=["Replying to a chat assigned to someone else is refused."]))
