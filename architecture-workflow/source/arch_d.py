"""Architecture pages for the multi-service, worldwide version (16-25)."""
from archlib import *

def links(*ids):
    return f'<div class="navlinks">{"".join(S(x) for x in ids)}</div>'

# ============================================================ 16 Super-app services
def p16():
    cw = 196
    N = [dict(id="u", t="One customer app", s="one account · one wallet · all countries", c=1.5, r=0, w=2, k="actor"),
         dict(id="m1", t="City rides", s="cab · auto · bike taxi", c=0, r=1.2, k="acc"), dict(id="m2", t="Long trips", s="50–1,000 km", c=1, r=1.2, k="acc"),
         dict(id="m3", t="Shared seats", s="+ parcels on trips", c=2, r=1.2, k="acc"), dict(id="m4", t="Bus tickets", s="operator APIs", c=3, r=1.2, k="acc"),
         dict(id="m5", t="Rentals", s="car · bike · scooter", c=4, r=1.2, k="acc"),
         dict(id="m6", t="Food delivery", s="₹ to ₹₹₹ restaurants", c=0, r=2.2, k="acc"), dict(id="m7", t="Parcels", s="city · intercity", c=1, r=2.2, k="acc"),
         dict(id="m8", t="Hotels & stays", s="budget to premium", c=2, r=2.2, k="acc"), dict(id="m9", t="Trip planner", s="multi-leg · AI assistant", c=3, r=2.2, k="info"),
         dict(id="m10", t="Deals & savings", s="coupons · pass · alerts", c=4, r=2.2, k="info"),
         dict(id="pf", t="Shared platform", s="identity · payments & wallet · maps · dispatch · ranking by priority · notifications · safety · coverage & offline · country packs", c=0, r=3.5, w=5, k="warn"),
         dict(id="s1", t="Drivers & riders", s="own fleet dispatch", c=0, r=4.8, k="ext"), dict(id="s2", t="Delivery partners", s="bike · scooter", c=1, r=4.8, k="ext"),
         dict(id="s3", t="Restaurants", s="partner app", c=2, r=4.8, k="ext"), dict(id="s4", t="Hotels · rentals", s="partner app · channel APIs", c=3, r=4.8, k="ext"),
         dict(id="s5", t="Bus operators", s="inventory APIs", c=4, r=4.8, k="ext")]
    E = [dict(a="u", b=m, pa="b", pb="t", ym=116, k="acc") for m in ["m1", "m2", "m3", "m4", "m5"]]
    E += [dict(a="m8", b="pf", l="every service uses", k="warn")]
    E += [dict(a="pf", b=x, pa="b", pb="t", ym=452) for x in ["s1", "s2", "s3", "s4", "s5"]]
    svg = flow(N, E, groups=[("Services the user sees", 0, 1.2, 4, 2.2, "acc"), ("Supply side", 0, 4.8, 4, 4.8)], cw=cw, rh=96, bw=172, bh=54,
               title="One app, many services, one shared platform")
    svc = table(["Service", "What the user gets", "How it is fulfilled", "Money model", "Screens"], [
        ("City rides", "Cab, auto, bike taxi, premium, shared cab", "Own dispatch to drivers", "Driver keeps fare; flat daily fee", links("R07", "R09", "R31")),
        ("Long trips", "One-way and round-trip cabs, 50–1,000 km", "Own dispatch; return-trip matching", "Driver keeps fare; flat daily fee", links("R32", "R33")),
        ("Shared seats", "A seat in a car already making the trip", "Drivers publish trips; riders book seats", "Booking fee per seat", links("R34", "D24")),
        ("Bus tickets", "Seats on intercity and sleeper buses", "Operator and aggregator APIs", "Commission per ticket", links("R35", "P06")),
        ("Rentals", "Self-drive cars, bikes, scooters", "Rental partners' fleets", "Commission per booking", links("R43", "P05")),
        ("Food delivery", "Restaurants from budget to fine dining", "Restaurant partners + delivery partners", "Commission + delivery fee", links("R44", "R45", "P02")),
        ("Parcels", "City instant, same-day, intercity", "Delivery partners, travellers, buses", "Per-parcel price", links("R47", "R48")),
        ("Hotels & stays", "Lodges, hotels, homestays, resorts", "Hotel partners, channel managers", "Commission per night", links("R41", "R42", "P04")),
        ("Trip planner", "Door-to-door plans across services", "Combines all of the above", "Bundle discounts", links("R36", "R52")),
        ("Deals & savings", "Coupons, pass, price alerts, budget", "Promotions service", "Marketing spend, pass fees", links("R49", "R50")),
    ])
    phases = table(["Phase", "Services", "Why this order"], [
        ("1 · Launch", "City rides, parcels (city), deals", "Builds driver supply and daily use."),
        ("2", "Long trips, shared seats, parcels on trips, coverage & offline", "Reuses the same drivers; strongest saving story."),
        ("3", "Food delivery, partner app for restaurants", "Delivery partners overlap with bike-taxi riders."),
        ("4", "Bus tickets, rentals, hotels, trip planner, AI assistant", "Needs partner integrations; completes the travel story."),
        ("5 · Global", "New countries with country packs", "Each country starts at phase 1 locally."),
    ])
    fname, body = arch_page("16", "super-app", "Multi-service app overview", "Super-app",
        "How one app offers city rides, long trips, shared seats, buses, rentals, food, parcels and hotels on one shared platform.",
        [sec("Picture", "One app, one platform", fig(svg, "Every service reuses the same account, wallet, payments, maps, safety and offline features. New services plug into the platform rather than being separate apps.", "16-super-app")),
         sec("Services", "What each service does", svc), sec("Rollout", "Suggested launch order", phases)])
    return fname, "Multi-service app overview", body, "All services, how each is fulfilled and earns money, and launch order."

# ============================================================ 17 User priorities
def p17():
    N = [dict(id="q", t="User request", s="from, to, when, who", c=0, r=1, k="actor"),
         dict(id="p", t="Priority", s="Urgent · Balanced · Saver\nFlexible · Deals", c=1, r=1, k="warn", h=62),
         dict(id="g", t="Gather options", s="rides · sharing · bus · transit\nrentals · food · parcels", c=2, r=1, h=62),
         dict(id="sc", t="Score each option", s="weights from priority", c=3, r=1, k="acc"),
         dict(id="f", t="Rules", s="budget cap · accessibility\nsafety · legal", c=3, r=0, k="alert", h=62),
         dict(id="rk", t="Ranked list", s="badges: cheapest, fastest\nbest value, eco", c=4, r=1, k="acc", h=62),
         dict(id="ad", t="Optional add-ons", s="never pre-selected", c=4, r=2.1, k="info")]
    E = [dict(a="q", b="p"), dict(a="p", b="g"), dict(a="g", b="sc"), dict(a="f", b="sc", l="filters"), dict(a="sc", b="rk"), dict(a="rk", b="ad")]
    svg = flow(N, E, cw=215, rh=100, bw=180, bh=56, title="How priorities change results")
    modes = table(["Priority", "Who it's for", "Time", "Price", "Comfort", "Transfers", "What changes"], [
        ("Urgent", "Late for a train, important meeting", "0.70", "0.10", "0.15", "0.05", "Priority dispatch, nearest driver, direct routes first. Price may be higher."),
        ("Balanced (default)", "Most trips", "0.40", "0.40", "0.15", "0.05", "Normal ranking."),
        ("Saver", "Students, budget travellers, long trips", "0.15", "0.70", "0.05", "0.10", "Shared rides, buses, batched delivery, off-peak hints; up to a few transfers allowed."),
        ("Flexible", "Lots of time, can travel another day", "0.05", "0.75", "0.10", "0.10", "Scheduling, price alerts, auto-book under a target price."),
        ("Deals", "Coupon and cashback hunters", "0.20", "0.60 (after coupons)", "0.10", "0.10", "Ranks by price after the best coupon; shows what each coupon saves."),
        ("Emergency (separate)", "Medical or safety emergency", "—", "—", "—", "—", "Calls first, nearest hospital, priority ride, no surge, no add-ons."),
    ])
    rules = """<ul class="clean">
<li><b>Nothing is mandatory.</b> Add-ons (insurance, luggage, pet, hotel, food stop) are never pre-ticked.</li>
<li><b>All options stay visible.</b> Priority changes order and badges, it never hides a cheaper or faster option.</li>
<li><b>Badges are computed.</b> Partners can't pay for "Best value" or "Cheapest".</li>
<li><b>Budget is soft.</b> Options above the budget move down the list with a note; they don't disappear.</li>
<li><b>Accessibility and safety rules apply in every mode</b> (wheelchair vehicles, women-only seats, verified riders).</li>
<li><b>Saved per trip type.</b> A user can be Urgent in the city and Saver on long trips.</li></ul>"""
    ex = table(["Example: Kozhikode → Mysuru, 2 people, Friday", "Urgent", "Balanced", "Saver", "Flexible"], [
        ("Top result", "Private cab now · ₹4,300 · 4h 30m", "AC bus 8:00 · ₹1,080 · 5h 30m", "Non-AC bus 6:30 · ₹580 · 5h 45m", "Shared seats Tuesday 6 AM · ₹1,080 (alert)"),
        ("Second", "Shared cab 7:00 · ₹1,440", "Shared cab 7:00 · ₹1,440", "AC bus 8:00 · ₹1,080", "Bus on Friday · ₹580"),
        ("Shown with note", "Bus options lower down", "Private cab above budget", "Private cab far below", "Today's options lower down"),
    ])
    fname, body = arch_page("17", "user-priorities", "User needs & priority modes", "Users",
        "Different people want different things: some are in a hurry, some have time, some want to save, some want coupons. The app ranks the same options differently for each.",
        [sec("Mechanism", "From request to ranked list", fig(svg, "The same supply is gathered for everyone; only the scoring weights and badges change with the priority.", "17-priority-ranking")),
         sec("Modes", "Priority weights", modes, '<p class="note">Weights are starting values. They are tuned per city with experiments and stored as configuration.</p>'),
         sec("Rules", "Principles", rules), sec("Example", "Same trip, different priorities (example prices)", ex),
         sec("Screens", "Where this appears", links("R29", "R30", "R31", "R33", "R44", "R45", "R50", "R51"))])
    return fname, "User needs & priority modes", body, "Urgent, Balanced, Saver, Flexible, Deals and Emergency: how ranking changes and why nothing is forced."

# ============================================================ 18 Long-distance & trip planner
def p18():
    parts = [("u", "Customer App", "actor"), ("pl", "Planner", "acc"), ("rt", "Routing", "n"), ("sup", "Supply\nbus · seats · cabs", "n"),
             ("rn", "Rentals &\nStays", "n"), ("poi", "Places on\nroute", "n"), ("cv", "Coverage", "warn")]
    M = [("m", "u", "pl", "plan(Kozhikode→Mysuru, Fri, 2, Saver, ≤₹2,000)"), ("m", "pl", "rt", "route options + polylines"),
         ("r", "rt", "pl", "2 routes, 215 / 253 km"), ("m", "pl", "sup", "search buses, shared seats, cabs (parallel)"),
         ("m", "pl", "rn", "rentals and stays near arrival"), ("m", "pl", "poi", "food, fuel, hospitals along route"),
         ("m", "pl", "cv", "dead zones on each route"), ("r", "cv", "pl", "30 km no network · 9 PM–6 AM restriction"),
         ("self", "pl", "assemble legs + buffers, score by priority"), ("r", "pl", "u", "3 plans: Saver / Balanced / Fast"),
         ("sec", "User books a plan"), ("m", "u", "pl", "book plan (one payment)"), ("self", "pl", "saga: hold each leg, then confirm all"),
         ("async", "pl", "u", "tickets, vouchers, offline pack")]
    sq = seq(parts, M, colw=165, title="Building a door-to-door plan")
    N = [dict(id="a", t="First mile", s="auto · bike taxi · walk", c=0, r=0), dict(id="b", t="Main leg", s="bus · shared seat · cab · train*", c=1, r=0, k="acc"),
         dict(id="c", t="Stops (optional)", s="food · fuel · rest · stay", c=2, r=0, k="info"), dict(id="d", t="Last mile", s="auto · rental · cab", c=3, r=0),
         dict(id="e", t="At destination", s="hotel · rental · food", c=4, r=0)]
    E = [dict(a="a", b="b", l="buffer 15 min"), dict(a="b", b="c"), dict(a="c", b="d"), dict(a="d", b="e")]
    legs = flow(N, E, cw=210, rh=90, bw=175, bh=54, title="Legs of a long trip")
    products = table(["Product", "Typical distance", "Supply", "Notes"], [
        ("One-way outstation cab", "100–1,000 km", "Own drivers", "Return empty leg is offered cheaper as 'return trip' to others."),
        ("Round trip with driver", "Any", "Own drivers", "Driver allowance and night charge shown upfront."),
        ("Shared seat", "100–600 km", "Drivers publishing trips", "Cheapest door-to-door after buses; women-only seats."),
        ("Bus ticket", "50–1,200 km", "Operators via API", "Seat maps, boarding points, live tracking where available."),
        ("Self-drive rental", "Any", "Rental partners", "Licence verified once; deposit held."),
        ("Bike/scooter rental", "Local touring", "Rental partners", "Helmets included; km limits."),
        ("Trains* (later)", "Any", "Rail APIs where allowed", "Shown as legs in plans where an official API is available."),
    ])
    pois = table(["Along-the-route category", "Source", "Filters"], [
        ("Restaurants and dhabas", "Partners + map data", "₹ / ₹₹ / ₹₹₹, veg, open at arrival time, detour km"),
        ("Hotels, lodges, homestays", "Partners", "₹ / ₹₹ / ₹₹₹, rating, pay at hotel, couple/family friendly"),
        ("Bus stops and stands", "Operators + map data", "Operators serving, facilities"),
        ("Auto and taxi stands", "Map data + driver reports", "Typical fare to centre"),
        ("Car and bike rentals", "Partners", "Type, deposit, delivery"),
        ("Fuel and EV charging", "Map data + charging networks", "Fuel type, charger type, open now"),
        ("Hospitals, police, mechanics", "Map data", "24×7, emergency department"),
        ("Toilets and rest areas", "Map data + reports", "Rating, women-friendly"),
    ])
    fname, body = arch_page("18", "long-distance", "Long-distance travel & trip planner", "Travel",
        "How the app plans and books trips of 200–500 km and more: buses, shared seats, cabs and rentals, with stops, hotels and food along the way.",
        [sec("Planner", "Building a plan", fig(sq, "Searches run in parallel; the plan is booked as a saga so a failed leg never leaves the user half-booked.", "18-planner-sequence")),
         sec("Legs", "What a plan is made of", fig(legs, "Every leg after the first gets a transfer buffer based on how reliable the previous leg usually is. *Trains only where an official API is available.", "18-trip-legs")),
         sec("Products", "Long-distance products", products), sec("Places", "Along-the-route categories", pois),
         sec("Screens", "Where this appears", links("R32", "R33", "R34", "R35", "R43", "R36", "R37", "R41", "R42", "R54", "D24"))])
    return fname, "Long-distance travel & trip planner", body, "Multi-leg planning, long-distance products and places along the route."

# ============================================================ 19 Sharing
def p19():
    N = [dict(id="d", t="Driver publishes trip", s="route · time · seats · boot", c=0, r=0, k="actor"),
         dict(id="idx", t="Corridor index", s="route polyline → H3 cells", c=1, r=0, k="data"),
         dict(id="rq", t="Seat or parcel request", s="pickup · drop · size", c=0, r=1.2, k="actor"),
         dict(id="m", t="Match", s="on corridor? detour ≤ 5 km?\ntime window? capacity?", c=1, r=1.2, k="acc", h=62),
         dict(id="pr", t="Price split", s="cost share per seat / parcel", c=2, r=1.2),
         dict(id="ok", t="Booked", s="manifest updated", c=3, r=1.2, k="acc"),
         dict(id="no", t="No match", s="suggest bus / courier / alert", c=1, r=2.3, k="alert")]
    E = [dict(a="d", b="idx"), dict(a="rq", b="m", l="search"), dict(a="idx", b="m"), dict(a="m", b="pr", l="yes"), dict(a="pr", b="ok"), dict(a="m", b="no", l="no", k="alert")]
    svg = flow(N, E, cw=230, rh=100, bw=190, bh=56, title="Matching seats and parcels to trips already happening")
    split = table(["Example: 215 km trip", "Amount"], [
        ("Fuel (215 km at about 15 km/l, ₹105/l)", "₹1,505"), ("Tolls", "₹0 on this route"), ("Driver's cost for the trip", "₹1,505"),
        ("3 shared seats (cost sharing ÷ 4 people incl. driver, rounded)", "₹380 per seat minimum"), ("Market seat price where commercial rules allow", "₹650–₹780"),
        ("2 parcels on board", "₹180 each"), ("Rider saving vs private cab (₹4,300)", "about 80%")])
    safety = """<ul class="clean">
<li>Drivers and riders are ID-verified; ratings are shown for long trips separately from city rides.</li>
<li>Women-only seats can be reserved and only booked by women who chose that option.</li>
<li>Live trip sharing, SOS and auto check-in work the same as city rides, including offline.</li>
<li>Parcels: contents declared, prohibited items list per country, photo and code at every handover, value limit without insurance.</li>
<li>Drivers can refuse a parcel that looks different from its declaration; the platform supports them.</li>
<li>Local law decides whether private cars may charge more than cost sharing; pricing enforces it.</li></ul>"""
    fname, body = arch_page("19", "sharing", "Sharing seats and parcels", "Savings",
        "Long-distance travellers save the most by sharing. The app fills empty seats and boot space in cars and buses already making the trip.",
        [sec("Matching", "How sharing works", fig(svg, "Trips are indexed by the map cells their route passes through, so a request finds trips that pass near both its pickup and its drop.", "19-sharing-match")),
         sec("Pricing", "How the cost is split (example)", split, '<p class="note">Example numbers. Fuel price, efficiency and tolls are computed per trip.</p>'),
         sec("Safety", "Trust and safety rules", safety), sec("Screens", "Where this appears", links("R34", "R47", "R48", "D24", "D25", "A26"))])
    return fname, "Sharing seats and parcels", body, "Matching seats and parcels to trips already happening, cost split and safety."

# ============================================================ 20 Food & parcels
def p20():
    N = [dict(id="a", t="PLACED", c=0, r=0), dict(id="b", t="ACCEPTED", s="prep time set", c=1, r=0, k="acc"), dict(id="c", t="PREPARING", c=2, r=0, k="acc"),
         dict(id="d", t="READY", c=3, r=0, k="acc"), dict(id="e", t="PICKED_UP", s="photo of seal", c=3, r=1, k="acc"), dict(id="f", t="DELIVERED", s="OTP or photo", c=2, r=1, k="acc"),
         dict(id="x", t="REJECTED / CANCELLED", s="auto refund", c=0, r=1, k="alert"), dict(id="dp", t="Delivery partner assigned", s="timed to ready time", c=2, r=-1, k="info")]
    E = [dict(a="a", b="b"), dict(a="b", b="c"), dict(a="c", b="d"), dict(a="d", b="e"), dict(a="e", b="f"), dict(a="a", b="x", l="no answer 3 min", k="alert"),
         dict(a="b", b="dp", pa="t", pb="l", l="dispatch at ready − travel", k="info"), dict(a="dp", b="d", pa="r", pb="t", l="arrives")]
    sm = flow(N, E, cw=220, rh=96, bw=180, bh=50, title="Food order states")
    parts = [("c", "Customer", "actor"), ("o", "Orders", "acc"), ("r", "Restaurant\n(partner app)", "n"), ("dp", "Dispatch", "acc"), ("p", "Delivery\npartner", "actor"), ("pay", "Payments", "n")]
    M = [("m", "c", "o", "place order + delivery speed"), ("m", "o", "pay", "authorise"), ("async", "o", "r", "new order (ring)"),
         ("m", "r", "o", "accept, prep 15 min"), ("self", "dp", "wait until ready − travel time"), ("async", "dp", "p", "offer (maybe batched)"),
         ("m", "p", "o", "picked up + seal photo"), ("m", "p", "o", "delivered + OTP"), ("m", "o", "pay", "capture, split restaurant / partner / platform")]
    sq = seq(parts, M, colw=175, title="Food order across three parties")
    speed = table(["Delivery option", "How it works", "Effect"], [
        ("Priority", "Partner assigned immediately, no batching", "Fastest, highest fee"),
        ("Standard", "Normal dispatch, batching only if no delay", "Default"),
        ("Saver", "Batch with another order in the same direction, up to +12 min", "Free or lower delivery fee"),
        ("Pickup yourself", "No partner", "No delivery fee, small discount"),
        ("Scheduled", "Choose a 30-minute slot", "Good for offices and parties"),
    ])
    parcel = table(["Parcel type", "Carrier", "Speed", "Proof"], [
        ("City instant", "Bike or car partner", "Under 1 hour", "Sender OTP, receiver OTP, photos"),
        ("City same-day", "Batched routes", "By evening", "Same"),
        ("Intercity with traveller", "Shared-seat driver", "Same day", "Code scans at each handover"),
        ("Intercity by bus", "Bus operator", "Next day", "Counter receipts"),
        ("Intercity express", "Dedicated courier", "Same day", "Insured, tracked"),
    ])
    fname, body = arch_page("20", "food-parcels", "Food delivery & parcels", "Delivery",
        "How food orders flow between customer, restaurant and delivery partner, and the parcel options from instant city delivery to intercity.",
        [sec("States", "Order lifecycle", fig(sm, "Dispatch waits until the food is almost ready so partners don't stand idle and food doesn't go cold.", "20-food-states")),
         sec("Sequence", "Three-party flow", fig(sq, "One payment is split three ways after delivery.", "20-food-sequence")),
         sec("Speed", "Delivery options", speed), sec("Parcels", "Parcel options", parcel),
         sec("Screens", "Where this appears", links("R44", "R45", "R46", "R47", "R48", "D22", "D23", "P02", "P03", "A27"))])
    return fname, "Food delivery & parcels", body, "Food order states, three-party flow, delivery speeds and parcel options."

# ============================================================ 21 Offline & coverage
def p21():
    N = [dict(id="ph", t="Phones (opt-in)", s="signal level · network · cell", c=0, r=0, k="actor"),
         dict(id="dr", t="Driver reports", s="'no network here'", c=0, r=1, k="actor"),
         dict(id="cr", t="Carrier data", s="where licensed", c=0, r=2, k="ext"),
         dict(id="ing", t="Coverage ingest", s="anonymise · batch", c=1, r=1, k="info"),
         dict(id="h3", t="Coverage tiles", s="per H3 cell, per network", c=2, r=1, k="data", shape="db", h=62),
         dict(id="rd", t="Road stretches", s="tiles joined to roads", c=3, r=1, k="acc"),
         dict(id="rr", t="Road rules", s="night closures · permits", c=3, r=0, k="warn"),
         dict(id="api", t="Route check API", s="dead zones + confidence", c=4, r=1, k="acc")]
    E = [dict(a="ph", b="ing", pa="r", pb="l", bo=-12), dict(a="dr", b="ing"), dict(a="cr", b="ing", pa="r", pb="l", bo=12),
         dict(a="ing", b="h3"), dict(a="h3", b="rd"), dict(a="rd", b="api"), dict(a="rr", b="api", pa="r", pb="t")]
    pipe = flow(N, E, cw=215, rh=90, bw=175, bh=54, title="Building the network coverage map")
    parts = [("u", "Customer / driver app", "actor"), ("cv", "Coverage API", "warn"), ("sf", "Safety service", "alert"), ("ec", "Emergency\ncontacts", "actor")]
    M = [("sec", "Before the trip"), ("m", "u", "cv", "check route polyline"), ("r", "cv", "u", "30 km dead zone, 11:10–11:55"),
         ("self", "u", "download offline pack, choose backup plan"), ("m", "u", "sf", "check-in window: back online by 11:55 + 20 min"),
         ("sec", "In the dead zone"), ("self", "u", "offline: GPS, map, tickets, queue events"), ("self", "u", "SOS pressed → queued, sent by SMS at first signal"),
         ("sec", "Two outcomes"), ("m", "u", "sf", "back online 11:52 → sync, close window"),
         ("note", "u", "ec", "If not back by 12:15: safety team alerted with last known position; contacts notified.\nTeam calls, checks bus/driver, and escalates if needed.", "alert"),
         ("async", "sf", "ec", "alert with last position (only if overdue)")]
    sq = seq(parts, M, colw=200, title="Travelling through a no-network stretch")
    pack = table(["Offline pack item", "Size (typical)", "Why"], [
        ("Vector map tiles for the route corridor", "10–25 MB", "Navigation and position without data"),
        ("Tickets, QR codes, vouchers", "< 1 MB", "Board buses and check in without network"),
        ("Driver, operator and hotel contacts", "< 1 MB", "Call or SMS when any signal appears"),
        ("Emergency numbers and hospitals for each region", "< 1 MB", "Correct numbers when crossing states or borders"),
        ("Backup rules", "< 1 KB", "Rebook without network if a leg fails"),
        ("Manifest (drivers)", "< 1 MB", "Verify passengers and parcels offline"),
    ])
    works = table(["Feature", "With no network"], [
        ("Map and GPS position", "Works (GPS doesn't need mobile data)"), ("Tickets and QR codes", "Works"), ("Trip and fare meter (drivers)", "Works, synced later"),
        ("OTP check at pickup", "Works against cached codes"), ("SOS", "Queued; sent by SMS at the first signal; satellite SOS on phones that support it"),
        ("Payments", "Prepaid or cash; card/UPI not possible"), ("Chat and calls", "Not possible; resume when back online"), ("Live tracking for contacts", "Shows last position and 'in no-network area'"),
    ])
    fname, body = arch_page("21", "offline-coverage", "No-network areas & offline mode", "Reliability",
        "Long trips pass through forests, ghats and remote areas with no mobile signal. The app knows where these are, warns ahead, and keeps working offline.",
        [sec("Coverage map", "Where the network is missing", fig(pipe, "Signal readings are collected only with consent, stripped of identity and kept raw for 30 days; only the aggregated map is kept.", "21-coverage-pipeline")),
         sec("Journey", "Before, during and after a dead zone", fig(sq, "The check-in window means silence is only treated as a problem after the expected exit time plus a buffer.", "21-dead-zone-sequence")),
         sec("Offline pack", "What is saved on the phone", pack), sec("Offline features", "What works without network", works),
         sec("Screens", "Where this appears", links("R33", "R38", "R39", "R40", "R54", "D26", "D19", "A25"))])
    return fname, "No-network areas & offline mode", body, "Coverage map, dead-zone warnings, offline pack, check-in windows and what works offline."

# ============================================================ 22 Global
def p22():
    N = [dict(id="core", t="Global core platform", s="same code everywhere", c=1, r=0, w=2, k="acc"),
         dict(id="in", t="India pack", s="INR · UPI · 112/108 · GST\nDPDP · Hindi + 10 languages", c=0, r=1.3, k="warn", h=66),
         dict(id="ae", t="UAE pack", s="AED · cards · 999/998 · VAT\nArabic (RTL) · English", c=1, r=1.3, k="warn", h=66),
         dict(id="ke", t="Kenya pack", s="KES · M-Pesa · 999/112\nKiswahili · English", c=2, r=1.3, k="warn", h=66),
         dict(id="br", t="Brazil pack", s="BRL · Pix · 190/192 · LGPD\nPortuguese", c=3, r=1.3, k="warn", h=66),
         dict(id="reg", t="Regional cells", s="data stays in region", c=1, r=2.6, w=2, k="data")]
    E = [dict(a="core", b=x, pa="b", pb="t", ym=126) for x in ["in", "ae", "ke", "br"]] + [dict(a=x, b="reg", pa="b", pb="t", ym=256, k="data") for x in ["in", "ae", "ke", "br"]]
    svg = flow(N, E, cw=225, rh=100, bw=200, bh=56, title="Core platform + country packs")
    pack = table(["Country pack item", "Examples"], [
        ("Currency and money format", "₹1,84,600 (India grouping), AED 45, £12.50, R$ 30,00"),
        ("Languages and scripts", "Malayalam, Hindi, Telugu, Tamil, Arabic (right to left), Spanish, Portuguese, Kiswahili"),
        ("Address format", "House/street/landmark (India), PO Box (UAE), postcode-first (UK)"),
        ("Units and time", "km or miles, 12/24-hour, week start day"),
        ("Payments", "UPI, cards, wallets, M-Pesa, Pix, cash rules"),
        ("Tax", "GST, VAT, sales tax rules and invoice format"),
        ("Emergency", "Police, ambulance and fire numbers; nearest-hospital data"),
        ("Transport law", "Ride-hailing licences, carpool price caps, driver hours, vehicle age"),
        ("Food and parcel law", "Food licences, prohibited items, customs for cross-border"),
        ("Privacy and data residency", "DPDP (India), GDPR (EU/UK), LGPD (Brazil), local storage rules"),
        ("Map and supplier adapters", "Map provider per region, bus/rail/hotel suppliers per country"),
    ])
    rules = """<ul class="clean">
<li><b>No country logic in code.</b> Code reads the country pack; adding a country is configuration plus adapters.</li>
<li><b>Prices stored with currency</b>, converted only for display when travelling.</li>
<li><b>Text never hard-coded.</b> All strings go through translation keys, including notifications and invoices.</li>
<li><b>Right-to-left support</b> is tested in every release for Arabic and Hebrew.</li>
<li><b>Personal data stays in the user's home region</b>; operations in another country use that region with minimal data.</li>
<li><b>Where a global provider can't operate</b> (for example map providers restricted in some countries), the region uses a local adapter.</li></ul>"""
    fname, body = arch_page("22", "global", "Worldwide: countries, languages & money", "Global",
        "The same app works in any country by loading a country pack with local currency, languages, payments, laws and emergency numbers.",
        [sec("Design", "Core + country packs", fig(svg, "One codebase. Each country adds a pack and, if needed, local adapters. Data is stored in the region that serves that country.", "22-country-packs")),
         sec("Packs", "What a country pack contains", pack), sec("Rules", "Engineering rules for global", rules),
         sec("Screens", "Where this appears", links("R53", "R51", "A23", "A22"))])
    return fname, "Worldwide: countries, languages & money", body, "Country packs, localisation, payments, laws and data residency."

# ============================================================ 23 Partners
def p23():
    N = [dict(id="a", t="Apply", s="partner app", c=0, r=0, k="actor"), dict(id="b", t="Automated checks", s="registration · tax · bank · location", c=1, r=0, k="info"),
         dict(id="c", t="Human review", s="admin queue", c=2, r=0, k="acc"), dict(id="d", t="Go live", s="listings visible in cities", c=3, r=0, k="acc"),
         dict(id="e", t="Quality loop", s="ratings · cancellations · on-time", c=3, r=1, k="warn"), dict(id="f", t="Price band", s="₹ / ₹₹ / ₹₹₹ computed", c=2, r=1, k="data")]
    E = [dict(a="a", b="b"), dict(a="b", b="c"), dict(a="c", b="d"), dict(a="d", b="e"), dict(a="e", b="f"), dict(a="f", b="d", pa="t", pb="b", ao=0, bo=-40)]
    svg = flow(N, E, cw=230, rh=100, bw=190, bh=56, title="Partner lifecycle")
    types = table(["Partner type", "How inventory arrives", "Key tools", "Typical commission*"], [
        ("Restaurant / cloud kitchen", "Menu in partner app", "Orders board, menu, offers", "15–25%"),
        ("Hotel / homestay", "Partner app or channel manager API", "Rates calendar, arrivals", "12–18%"),
        ("Car / bike rental", "Fleet calendar in partner app", "Handover photos, deposits", "10–20%"),
        ("Bus operator", "Reservation system API or partner app", "Seat sync, boarding list, parcels", "5–12% per ticket"),
        ("Fleet owner", "Vehicles and drivers in admin (limited)", "Driver assignment, earnings", "Daily fee per vehicle"),
        ("Parcel point / store", "Partner app", "Drop-off and collection", "Per parcel fee"),
    ])
    tiers = table(["Band", "Restaurants (cost for two)", "Hotels (per night)", "How computed"], [
        ("₹ Budget", "Bottom third in the city", "Bottom third in the city", "From real prices, recalculated weekly"),
        ("₹₹ Mid", "Middle third", "Middle third", "Same"), ("₹₹₹ Premium", "Top third", "Top third", "Same")])
    fname, body = arch_page("23", "partners", "Partners & marketplace", "Supply",
        "Restaurants, hotels, rental companies and bus operators join through one partner app and are reviewed, ranked and paid by the platform.",
        [sec("Lifecycle", "From application to listing", fig(svg, "Price bands are computed from prices, never chosen by the partner, so ₹ always means budget.", "23-partner-lifecycle")),
         sec("Types", "Partner types", types, '<p class="note">*Illustrative ranges for planning; set per country and negotiated per partner.</p>'),
         sec("Bands", "Price bands", tiers), sec("Screens", "Where this appears", links("P01", "P02", "P03", "P04", "P05", "P06", "P07", "A24"))])
    return fname, "Partners & marketplace", body, "Partner types, onboarding, computed price bands and commissions."

# ============================================================ 24 Deals & pricing pipeline
def p24():
    N = [dict(id="b", t="Base price", s="fare / menu / rate", c=0, r=0), dict(id="s", t="Demand", s="surge or off-peak discount", c=1, r=0),
         dict(id="sh", t="Sharing split", s="seat / batched delivery", c=2, r=0, k="acc"), dict(id="bu", t="Bundle", s="plan discount", c=3, r=0, k="acc"),
         dict(id="cp", t="Best coupon", s="auto-picked, stacking rules", c=4, r=0, k="info"),
         dict(id="ps", t="Pass benefit", s="if subscribed", c=4, r=1, k="info"), dict(id="w", t="Wallet / cashback", s="applied last", c=3, r=1),
         dict(id="tx", t="Taxes", s="country pack", c=2, r=1, k="warn"), dict(id="f", t="Final price", s="shown before booking", c=1, r=1, k="acc"),
         dict(id="bc", t="Budget check", s="warn if over user budget", c=0, r=1, k="alert")]
    E = [dict(a="b", b="s"), dict(a="s", b="sh"), dict(a="sh", b="bu"), dict(a="bu", b="cp"), dict(a="cp", b="ps"), dict(a="ps", b="w"), dict(a="w", b="tx"), dict(a="tx", b="f"), dict(a="f", b="bc")]
    svg = flow(N, E, cw=215, rh=100, bw=180, bh=54, title="Price calculation pipeline")
    feats = table(["Saving feature", "For whom", "How it works"], [
        ("Shared seats and shared rides", "Saver", "Split cost with others going the same way"), ("Parcels with travellers", "Senders", "Use space in trips already happening"),
        ("Batched delivery", "Saver food orders", "Free delivery if okay to wait a little"), ("Off-peak discounts", "Flexible", "Lower prices when demand is low"),
        ("Price alerts and auto-book", "Flexible", "Watch a route and book under a target price"), ("Best coupon auto-applied", "Deals", "No need to search codes"),
        ("Subscription pass", "Frequent users", "Monthly fee, free delivery, ride discounts"), ("Bundle discounts", "Trip planners", "Bus + hotel + rental together"),
        ("Monthly budget", "Everyone", "Set a budget and see progress"), ("Referral credits", "Everyone", "Both people get credit after a first order"),
    ])
    guard = """<ul class="clean"><li>Coupons never reduce what drivers and partners earn unless the partner agreed to fund the offer.</li>
<li>Each campaign has a hard budget; redemptions stop when it's spent.</li><li>Fraud rules block multiple accounts on one device or payment method from farming coupons.</li>
<li>The final price on the booking button is the price charged, including taxes and fees.</li></ul>"""
    fname, body = arch_page("24", "deals-pricing", "Deals, savings & pricing", "Savings",
        "How the final price is calculated, how the best saving is applied automatically, and the features that help people spend less.",
        [sec("Pipeline", "From base price to final price", fig(svg, "Each step is logged with the quote, so support can explain any price line by line.", "24-price-pipeline")),
         sec("Features", "Ways to save", feats), sec("Guardrails", "Fairness rules", guard), sec("Screens", "Where this appears", links("R49", "R50", "R22", "R45", "R31", "A28"))])
    return fname, "Deals, savings & pricing", body, "Price pipeline, saving features and fairness rules."

# ============================================================ 25 Advanced features
def p25():
    feats = table(["Area", "Feature", "Notes"], [
        ("AI", "Trip assistant in local languages (text and voice)", "Uses the same planner tools; confirms before booking"),
        ("AI", "Demand forecast and driver positioning", "Heat maps and incentives"), ("AI", "ETA learned per road and time", "Better transfer buffers"),
        ("AI", "Fraud and safety anomaly detection", "Flags for human review only"),
        ("Safety", "SOS online and offline, auto check-in windows", "SMS and satellite fallback"), ("Safety", "Women-only seats and women-driver preference", "Opt-in"),
        ("Safety", "Trip sharing with live link", "Works for non-users"), ("Safety", "Emergency mode with nearest hospitals", "No surge"),
        ("Access", "Wheelchair-accessible vehicles, assistance requests", "Filter in every mode"), ("Access", "Large text, screen reader, voice booking", "Tested each release"),
        ("Family & work", "Family profiles, book for someone else, kids and elderly rides", "Guardian notifications"), ("Family & work", "Corporate accounts and invoices", "Cost centres, policies"),
        ("Travel", "Multi-city trips, return-trip matching for cabs", "Lower one-way prices"), ("Travel", "Digital ticket wallet offline", "QR and vouchers"),
        ("Travel", "Road restriction and weather alerts", "Night closures, floods, landslides"), ("Travel", "Luggage and pet options", "Opt-in add-ons"),
        ("Planet", "EV options and carbon per trip", "Eco badge"), ("Planet", "EV charger stops along routes", "Long trips"),
        ("Money", "Multi-currency wallet", "Travel abroad"), ("Money", "Split payments with friends", "Rides, food, stays"),
        ("Insurance", "Per-trip travel and parcel insurance", "Opt-in, partner-provided"),
        ("Partners", "Channel manager and operator APIs", "Hotels, buses"), ("Partners", "Kitchen display for restaurants", "Tablet mode"),
    ])
    road = table(["Quarter", "Focus"], [
        ("Q1", "Phase 1: city rides, city parcels, deals, core platform, India"), ("Q2", "Phase 2: long trips, sharing, coverage & offline"),
        ("Q3", "Phase 3: food delivery, partner app"), ("Q4", "Phase 4: buses, rentals, hotels, planner, AI assistant"),
        ("Year 2", "Second and third countries with country packs; corporate travel; insurance")])
    fname, body = arch_page("25", "advanced-features", "Advanced features & roadmap", "Roadmap",
        "The full list of advanced features planned for the platform and a suggested order to build them.",
        [sec("Features", "Advanced features", feats), sec("Roadmap", "Suggested roadmap", road)])
    return fname, "Advanced features & roadmap", body, "AI, safety, accessibility, family, travel, planet and money features, with roadmap."

PAGES = [p16, p17, p18, p19, p20, p21, p22, p23, p24, p25]
