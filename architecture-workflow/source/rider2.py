"""New customer-app screens for the multi-service app."""
from components import *
from superlib import *
from rider import mapbody, W, H, ROUTE

KM = "Kozhikode → Mysuru"
TOWNS = [(0.02, "Kozhikode", "r"), (0.2, "Thamarassery", "r"), (0.36, "Kalpetta", "l"), (0.5, "Sultan Bathery", "l"), (0.6, "Muthanga", "l"), (0.8, "Gundlupet", "r"), (0.98, "Mysuru", "l")]
SEGS = [(0.0, 0.18, "g"), (0.18, 0.3, "a"), (0.3, 0.59, "g"), (0.59, 0.75, "n"), (0.75, 1.0, "g")]
POIS = [(0.36, "F", 16), (0.5, "H", 16), (0.53, "G", -16), (0.34, "+", -16), (0.27, "R", 16)]
SUPER = SUPER_NAV

def row(ic, t, s, r="", tone=""):
    return li(ic, t, s, r, tone)

S = []

# ---------------------------------------------------------------- R29 all-services home
S.append(dict(id="R29", mock=phone(
    f'<div class="ab"><span class="ic brand">{icon("pin")}</span><span style="flex:1;display:flex;flex-direction:column"><span class="xs">Pickup</span><b style="font-size:14px">Road 12, Banjara Hills ▾</b></span><span class="chip">🇮🇳 INR</span><span class="ib">{icon("bell")}</span></div>'
    f'<div class="body" style="gap:11px"><div class="inp"><div class="box" style="background:#F5F7F8;border:none;height:48px">{icon("search")}<b style="flex:1;font-weight:500;color:#6A7885">Where to, or what do you need?</b>{icon("mic")}</div></div>'
    f'{modes("bal")}'
    + svc_grid([("car", "Ride", ""), ("bike", "Bike taxi", ""), ("auto", "Auto", ""), ("route", "Long trip", "NEW"), ("users", "Share seat", "−40%"), ("bus", "Bus", ""),
                ("key", "Rentals", ""), ("bed", "Hotels", ""), ("food", "Food", ""), ("box", "Parcel", ""), ("sparkle", "Plan trip", "AI"), ("tag", "Deals", "")]) +
    f'<div class="card-m" style="flex-direction:row;align-items:center;gap:10px"><span class="ic blue">{icon("calendar")}</span><span style="flex:1"><b style="font-size:13.5px">Fri · {KM}</b><div class="xs">Bus at 6:30 · offline pack ready</div></span><span class="tag info">Trip</span></div>'
    f'<div class="card-m"><div class="kv"><b>You saved ₹1,240 this month</b><span class="xs">Saver + coupons</span></div><div class="meter"><i style="width:62%"></i></div></div></div>'
    + bnav(SUPER, "home")),
    purpose="The front door of the whole app: every service in one grid, the user's priority for today, and upcoming trips.",
    how=["The service grid comes from the country pack, so each country shows only what is live there.",
         "The priority chips (Urgent, Balanced, Saver, Flexible, Deals) set how every result list is ranked; nothing is forced, the user still sees all options.",
         "Search understands places and needs: 'Mysuru', 'biryani', 'hotel near bus stand', 'send documents to Kochi'.",
         "Upcoming trips and savings are pulled from bookings and the ledger."],
    elements=["Pickup location and country/currency", "Search with voice", "Priority chips", "Service grid with badges", "Upcoming trip card", "Monthly savings meter", "Bottom navigation"],
    apis=[("GET", "/v1/home?lat&lng", "Services live here, banners, upcoming bookings"), ("GET", "/v1/search?q=", "Unified search across places, restaurants, hotels"), ("PUT", "/v1/me/priority", "Save default priority")],
    data=["Country pack", "Bookings", "Savings ledger"], to=["R30", "R07", "R32", "R44", "R47", "R41", "R43", "R36", "R49", "R52", "R51", "R54"],
    edge=["A service not available in the country is hidden, not greyed out.", "First-time users see Balanced selected and a one-line explanation of the chips.", "In an area with no network the home shows cached services and the offline pack."]))

# ---------------------------------------------------------------- R30 priority
mode_row = lambda ic, t, s, sel=False, tone="": (f'<div class="opt{" on" if sel else ""}"><span class="ic {tone}">{icon(ic)}</span><span class="tx"><b>{t}</b><span>{s}</span></span>'
                                                 f'<span style="width:20px;height:20px;border-radius:50%;border:2px solid {"#0B7A68" if sel else "#C3CCD3"};{"box-shadow:inset 0 0 0 4px #fff;background:#0B7A68" if sel else ""}"></span></div>')
S.append(dict(id="R30", mock=phone(mapbody(map_svg(W, H, dim=True, labels=False),
    sheet=f'<div class="sheet"><div class="grab"></div><div class="h2">What matters most right now?</div><div class="sub">We sort every option by this. You can still pick anything.</div>'
          f'{mode_row("alert","Urgent","Fastest pickup and arrival. Priority drivers, may cost more.",tone="red")}'
          f'{mode_row("check","Balanced","Good price, reasonable time. Our default.")}'
          f'{mode_row("wallet","Saver","Shared rides, buses, short waits. Often 30–50% cheaper.",True,"brand")}'
          f'{mode_row("clock","Flexible · I have time","Schedule ahead or wait for a price drop alert.",tone="blue")}'
          f'{mode_row("tag","Deals","Show options where coupons and cashback save the most.",tone="amber")}'
          f'<div class="li" style="padding:6px 0;border:none"><span class="tx"><b style="font-size:13px">Remember for long trips</b></span><span class="toggle on"></span></div>{btn("Show options")}</div>')),
    purpose="Lets the user say what they care about today: speed, price, time flexibility or deals. Ranking follows; choices stay open.",
    how=["The choice sets weights for time, price, comfort and walking used by the ranking service.",
         "Saver turns on shared rides, bus legs, batched delivery and off-peak suggestions.",
         "Urgent turns on priority dispatch and hides options that need waiting or transfers at the top of the list.",
         "The choice can be remembered per trip type (city, long trip, food)."],
    elements=["Five priority options with plain explanations", "Remember toggle", "Show options button"],
    apis=[("PUT", "/v1/me/priority", "Save default per trip type")], events=["user.priority_changed"], data=["users.preferences"], to=["R31", "R33", "R44"],
    edge=["Medical emergencies go to Emergency mode, not Urgent, so there is no surge or upsell.", "Accessibility needs (wheelchair, assistance) apply in every mode."]))

# ---------------------------------------------------------------- R31 compare
cmp = lambda ic, t, s, p, b="", on=False: (f'<div class="opt{" on" if on else ""}"><span class="veh">{icon(ic,22)}</span><span class="tx"><b>{t} {b}</b><span>{s}</span></span><span class="pr">{p}</span></div>')
S.append(dict(id="R31", mock=phone(
    appbar('Banjara Hills → Airport <span class="xs" style="display:block;font-weight:400">31 km · now</span>') +
    f'<div class="body" style="gap:9px">{modes("saver")}'
    f'{cmp("users","Shared cab","2 co-riders · +12 min · drop 7:18 PM","₹420",badge("CHEAPEST","cheap"),True)}'
    f'{cmp("route","Metro + auto","58 min · 1 change · walk 300 m","₹160",badge("ECO","eco"))}'
    f'{cmp("bike","Bike taxi","38 min · beats traffic","₹390",badge("FAST","fast"))}'
    f'{cmp("car","Cab","44 min · 3 min away","₹720")}'
    f'{cmp("car","Premium","44 min · top-rated, extra boot","₹1,050")}'
    f'{sect("OPTIONAL ADD-ONS")}<div class="chips"><span class="chip">+ Extra luggage ₹40</span><span class="chip">+ Pet friendly</span><span class="chip">+ Prefer woman driver</span><span class="chip">+ Trip insurance ₹5</span></div>'
    f'<div class="fill"></div>{btn("Book shared cab · ₹420")}</div>'),
    purpose="One list that compares every way to make the trip, ordered by the chosen priority, with clear badges and optional add-ons.",
    how=["The journey service asks rides, sharing and public transport adapters in parallel (under 1.5 s).",
         "Each option gets a score from time, price, transfers and comfort weighted by the priority.",
         "Badges are computed, not paid: Cheapest, Fastest, Eco, Best value.",
         "Add-ons are opt-in chips and change the price live."],
    elements=["Route and time", "Priority chips", "Options with time, transfers and price", "Badges", "Optional add-ons", "Book button"],
    apis=[("POST", "/v1/journeys/options", "All options for a route, ranked by priority"), ("POST", "/v1/rides/estimate", "Ride quotes")], events=["journey.options_shown"],
    data=["Quotes", "Transit schedules (GTFS)"], to=["R09", "R10", "R36"],
    edge=["Public transport shown only where schedule data exists for the city.", "Shared ride can fail to match: the rider is offered a solo ride at the shared price difference or a refund."]))

# ---------------------------------------------------------------- R32 long-distance search
S.append(dict(id="R32", mock=phone(
    appbar("Long-distance trip") +
    f'<div class="body" style="gap:10px"><div class="chips"><span class="chip on">One way</span><span class="chip">Round trip</span><span class="chip">Multi-city</span></div>'
    f'<div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Kozhikode</b><span>Mavoor Road, near home</span></span></div><div class="vline"></div>'
    f'<div class="loc"><span class="d sq"></span><span class="tx"><b>Mysuru</b><span>Karnataka · about 215 km</span></span></div></div>'
    f'<div class="row2">{inp("Date","Fri 16 Oct",ic="calendar")}{inp("Leave","Morning ▾",ic="clock")}</div>'
    f'<div class="row2">{inp("Travellers","2 adults",ic="users")}{inp("Luggage","2 bags",ic="bag")}</div>'
    f'<div class="li" style="padding:4px 0;border:none"><span class="ic amber">{icon("box")}</span><span class="tx"><b>Also send a parcel on this route</b><span>Optional</span></span><span class="toggle"></span></div>'
    f'{sect("WHAT MATTERS")}{modes("saver")}'
    f'<div class="card-m"><div class="kv"><b>Budget per person (optional)</b><b>₹1,500</b></div><div class="meter"><i style="width:45%"></i></div><span class="xs">We\'ll show options above this too, just lower in the list.</span></div>'
    f'<div class="fill"></div>{btn("Find options","","search")}</div>'),
    purpose="Search for trips of roughly 50–1,000 km: buses, shared seats, private cabs and rentals, in one place.",
    how=["Origin and destination resolve to cities and nearby boarding points.", "Travellers, luggage and the parcel toggle filter options that physically fit.",
         "Budget is a soft limit: options above it are shown but ranked lower.", "Search fans out to bus operator APIs, intercity driver supply and rental partners."],
    elements=["Trip type", "From and to", "Date and time window", "Travellers and luggage", "Optional parcel", "Priority chips", "Optional budget", "Find options"],
    apis=[("POST", "/v1/intercity/search", "Search all long-distance supply")], events=["intercity.searched"], data=["Saved places", "Country pack"], to=["R33"],
    edge=["Cross-border trips check visa and vehicle permit rules per country pair and warn early.", "Trips longer than 12 hours suggest an overnight stop."]))

# ---------------------------------------------------------------- R33 results
ic_ = lambda i: f'<span class="veh">{icon(i,22)}</span>'
res = lambda i, t, s, p, sub, b="", on=False: (f'<div class="opt{" on" if on else ""}">{ic_(i)}<span class="tx"><b>{t} {b}</b><span>{s}</span></span>'
                                              f'<span style="display:flex;flex-direction:column;align-items:flex-end"><span class="pr">{p}</span><span class="xs">{sub}</span></span></div>')
S.append(dict(id="R33", mock=phone(
    appbar(f'{KM} <span class="xs" style="display:block;font-weight:400">Fri 16 Oct · 2 travellers · 215 km</span>', right=f'<span class="ib">{icon("filter")}</span>') +
    f'<div class="body" style="gap:8px"><div class="chips"><span class="chip on">All</span><span class="chip">Bus</span><span class="chip">Shared</span><span class="chip">Cab</span><span class="chip">Self-drive</span><span class="chip">Bike</span></div>'
    f'<div style="display:flex;justify-content:space-between;align-items:center">{tier((0,1))}<span class="xs">Sorted for <b>Saver</b></span></div>'
    f'{res("bus","State bus · non-AC","6:30 → 12:15 · 5h 45m","₹290","per person",badge("CHEAPEST","cheap"))}'
    f'{res("users","Shared cab seat","7:00 → 11:40 · 2 of 4 left","₹720","per seat",badge("BEST VALUE","value"),True)}'
    f'{res("bus","AC seater bus","8:00 → 13:30 · live tracking","₹540","per person")}'
    f'{res("car","Private cab (one way)","Leave any time · 4h 30m","₹4,300","whole car")}'
    f'{res("key","Self-drive car","Pick up 7:00 · 300 km/day incl.","₹2,600","+ fuel")}'
    f'<div class="banner warn">{icon("wifi_off")}<span>About 30 km with no mobile network on this route. <b>Plan ahead</b></span></div></div>'),
    purpose="All the ways to make a long trip, side by side, filtered by type and price band and sorted by the user's priority.",
    how=["Results stream in as each supplier answers; slow suppliers don't block the list.", "Price bands (₹, ₹₹, ₹₹₹) are calculated per route from the spread of prices.",
         "The network-coverage check runs on the route and shows a warning if there are no-signal stretches.", "Selecting an option opens its detail: seats, boarding points, driver or rental terms."],
    elements=["Route summary", "Type filters", "Price band filter", "Sort label", "Option cards with times and badges", "No-network warning"],
    apis=[("GET", "/v1/intercity/search/{id}/results", "Streamed results"), ("GET", "/v1/coverage/route?polyline=", "No-network stretches on route")],
    data=["Bus inventory (operator APIs)", "Published intercity trips", "Rental inventory", "Coverage tiles"], to=["R34", "R35", "R43", "R38", "R36"],
    edge=["Prices from partners are re-checked at booking; a change is shown before payment.", "Night travel through restricted roads is flagged with the restriction hours."]))

# ---------------------------------------------------------------- R34 shared seat
S.append(dict(id="R34", mock=phone(
    appbar("Shared seat · 7:00 AM") +
    f'<div class="body" style="gap:9px"><div class="li" style="padding:0;border:none"><span class="av">RS</span><span class="tx"><b>Ravi S. · ★ 4.8 · 214 long trips</b><span>Toyota Innova · KL 11 BT 2024 · ID and licence verified</span></span></div>'
    f'<div class="card-m" style="flex-direction:row;gap:14px;align-items:center"><div class="seatmap" style="grid-template-columns:repeat(2,26px) 10px 26px"><i class="t"></i><i class="t"></i><span></span><i class="t"></i><i class="on"></i><i class="f"></i><span></span><i></i></div>'
    f'<div style="display:flex;flex-direction:column;gap:4px;font-size:12px"><span>■ Your seat</span><span style="color:#C2185B">■ Women-only seat</span><span style="color:#8796A2">■ Taken / driver</span></div></div>'
    f'{sect("CO-TRAVELLERS")}<div class="list">{row("user","Meena K. · ★ 4.9","Verified · to Mysuru","","brand")}</div>'
    f'{sect("PICKUP POINT")}<div class="list">{row("pin","Mavoor Road bus bay","6:55 AM · 1.2 km from you",icon("check"),"brand")}{row("pin","Thamarassery junction","7:35 AM")}</div>'
    f'<div class="card-m"><div class="kv"><span>Seat</span><span>₹720</span></div><div class="kv"><span>Booking fee</span><span>₹25</span></div><div class="kv"><span>Cab alone would cost</span><span style="text-decoration:line-through;color:#6A7885">₹4,300</span></div></div>'
    f'{btn("Book 1 seat · ₹745")}</div>'),
    purpose="Book one seat in a car someone is already driving to the same city, for a fraction of a private cab.",
    how=["Drivers publish long trips with seats, price per seat and pickup points (see D24).", "Riders pick a seat; women-only seats are bookable only by women riders who chose that option.",
         "Pickup points are fixed stops on the route so the driver doesn't make long detours.", "Payment is held and released to the driver after the trip."],
    elements=["Driver profile and verification", "Seat map with women-only seats", "Co-travellers", "Pickup points with times", "Price breakdown vs private cab", "Book seat"],
    apis=[("GET", "/v1/intercity/trips/{id}", "Trip, seats, stops"), ("POST", "/v1/intercity/trips/{id}/bookings", "Book seat")], events=["seat.booked"],
    data=["sharing.trips, sharing.seats"], to=["R36", "R39"],
    edge=["Seat prices are capped to cost sharing where carpool laws require it.", "Driver cancels: riders get an automatic rebooking offer and a full refund.", "Co-traveller details are shown only as first name, rating and verified status."]))

# ---------------------------------------------------------------- R35 bus seats
bus = '<div class="seatmap">' + "".join(
    ('<span></span>' if c == "|" else f'<i class="{c}"></i>') for c in
    ["t","t","|","t","","", "t","|","on","on", "t","t","|","f","t", "","t","|","t","", "t","","|","t","t", "","","|","t","t"]).replace('<i class=""></i>', "<i></i>") + "</div>"
S.append(dict(id="R35", mock=phone(
    appbar('AC seater bus <span class="xs" style="display:block;font-weight:400">8:00 → 13:30 · operator rating 4.4</span>') +
    f'<div class="body" style="gap:9px"><div class="card-m" style="flex-direction:row;gap:16px;align-items:flex-start">{bus}<div style="display:flex;flex-direction:column;gap:5px;font-size:12px"><span>■ Selected 2</span><span style="color:#C2185B">■ Reserved for women</span><span style="color:#8796A2">■ Booked</span><span>□ Available</span><span class="tag info" style="margin-top:6px">Live tracking</span></div></div>'
    f'{sect("BOARDING POINT")}<div class="list">{row("bus","KSRTC stand, Kozhikode","8:00 AM",icon("check"),"brand")}{row("bus","Thamarassery","8:45 AM")}</div>'
    f'{sect("DROPPING POINT")}<div class="list">{row("bus","Mysuru suburban bus stand","13:30")}</div>'
    f'<div class="kv"><span>2 × ₹540</span><b>₹1,080</b></div>{btn("Continue to pay")}<div class="xs" style="text-align:center">Your ticket QR works without network.</div></div>'),
    purpose="Pick bus seats and boarding and dropping points for an operator's bus.",
    how=["Seat layout and availability come from the bus operator's system through the bus adapter.", "Seats are held for 8 minutes while the user pays.",
         "The ticket is issued by the operator; the app stores a QR code that works offline.", "Buses with GPS trackers share live location in the app."],
    elements=["Bus summary", "Seat map with women-reserved seats", "Boarding points", "Dropping point", "Total", "Offline ticket note"],
    apis=[("GET", "/v1/bus/trips/{id}/seats", "Layout and availability"), ("POST", "/v1/bus/trips/{id}/hold", "Hold seats 8 min"), ("POST", "/v1/bus/bookings", "Confirm after payment")],
    events=["bus.booked"], data=["Operator inventory (via adapter)"], to=["R36", "R54"],
    edge=["Operator system slow: seats shown as 'checking' rather than wrong availability.", "Operator cancels the trip: full refund and alternatives on the same day."]))

# ---------------------------------------------------------------- R43 rentals
S.append(dict(id="R43", mock=phone(
    appbar('Rentals in Mysuru <span class="xs" style="display:block;font-weight:400">Fri 16 Oct 13:00 → Sun 18 Oct 18:00</span>') +
    f'<div class="body" style="gap:4px"><div class="chips"><span class="chip on">{icon("car",13)} Cars</span><span class="chip">{icon("bike",13)} Bikes & scooters</span><span class="chip">With driver</span></div>'
    f'<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">{tier((0,))}<span class="xs">Delivered to bus stand</span></div>'
    + place("Hatchback · manual", "Self-drive · 5 seats · 250 km/day", "Deposit ₹2,000 · 4.6 ★", "₹1,900/day") +
    place("Compact SUV · automatic", "Self-drive · 5 seats · unlimited km", "Deposit ₹5,000 · 4.7 ★", "₹3,400/day", "h2") +
    place("Scooter 110cc", "2 helmets · 120 km/day", "Deposit ₹1,000 · 4.5 ★", "₹450/day", "h3") +
    place("350cc cruiser bike", "Touring · 200 km/day", "Deposit ₹3,000 · 4.8 ★", "₹1,100/day") +
    f'<div class="banner info" style="margin-top:6px">{icon("id")}Driving licence check needed once. Photos at pickup protect your deposit.</div></div>'),
    purpose="Self-drive cars, bikes and scooters from local rental partners, delivered where the trip ends.",
    how=["Rental partners list vehicles with calendar availability (P05).", "The user's driving licence is verified once and reused.",
         "Pickup and return include a guided photo walk-around to settle damage disputes.", "Deposit is held on the card or UPI and released after return."],
    elements=["Dates", "Type tabs", "Price band", "Delivery option", "Vehicle cards with limits, deposit, rating", "Licence note"],
    apis=[("GET", "/v1/rentals/search", "Availability"), ("POST", "/v1/rentals/bookings", "Book with deposit hold")], events=["rental.booked"],
    data=["rentals.vehicles, rentals.bookings"], to=["R36", "R54"],
    edge=["Licence class must match the vehicle (two-wheeler vs car).", "Late return charges shown before booking."]))

# ---------------------------------------------------------------- R36 trip plan
S.append(dict(id="R36", mock=phone(
    appbar(f'Your trip plan <span class="xs" style="display:block;font-weight:400">{KM} · Fri 16 Oct · Saver</span>', right=f'<span class="ib">{icon("share")}</span>') +
    f'<div class="body" style="gap:8px"><div class="card-m brand" style="flex-direction:row;justify-content:space-between;align-items:center"><span><span class="xs">Total for 2</span><div class="big-num" style="font-size:26px">₹1,840</div></span><span style="text-align:right"><span class="xs">Door to door</span><div style="font-weight:800;font-size:18px">7h 10m</div></span></div>'
    f'<div>{leg("7:30","Auto to bus stand","3 km · booked 15 min before","₹60")}{leg("8:00","AC seater bus","Kozhikode → Mysuru · seats 14, 15","₹1,080")}'
    f'{leg("10:05","Breakfast stop (optional)","Kalpetta · 20 min · ₹ to ₹₹ nearby","+ Add")}'
    f'{leg("11:10","No network for ~30 km","Muthanga → Gundlupet forest · about 45 min","", "dead")}'
    f'{leg("13:30","Arrive Mysuru","Suburban bus stand","")}{leg("13:45","Scooter rental (optional)","Delivered at bus stand · 2 days","₹900","walk")}'
    f'{leg("14:15","Hotel (optional)","Budget to premium near stand","+ Add")}</div>'
    f'<div class="row2">{btn("Customise","ghost sm")}{btn("Book all · ₹1,840","sm")}</div></div>'),
    purpose="A full door-to-door plan with every leg, optional stops and add-ons, booked in one payment.",
    how=["The planner joins legs from different services: city ride, bus, rental, hotel.", "Transfer buffers are added automatically (15–30 min) based on reliability data.",
         "Optional items stay optional; the total changes only when the user adds them.", "No-network stretches are shown as a dashed leg with expected duration."],
    elements=["Plan summary: total and door-to-door time", "Leg timeline with times and prices", "Optional stops and add-ons", "No-network leg", "Customise and book all"],
    apis=[("POST", "/v1/planner/plans", "Build plan from chosen options"), ("POST", "/v1/planner/plans/{id}/book", "Book all legs, one payment")],
    events=["plan.created", "plan.booked"], data=["planner.plans, planner.legs"], to=["R37", "R38", "R39", "R41", "R54"],
    edge=["One leg fails to book: others are held, the user can pick a replacement or cancel all with full refund.", "Bus delay over 30 min re-plans the next legs and notifies the rental partner."]))

# ---------------------------------------------------------------- R37 along the route
S.append(dict(id="R37", mock=phone(mapbody(corridor_svg(W, H, segs=SEGS, towns=TOWNS, pois=POIS, labels=True),
    top=f'<div class="floating"><span class="ib">{icon("back")}</span><b style="flex:1">Along the route</b><span class="chip">{icon("filter",13)} Filters</span></div>'
        f'<div class="chips" style="margin:0 14px;flex-wrap:nowrap;overflow:hidden"><span class="chip on">{icon("food",13)} Food</span><span class="chip">{icon("bed",13)} Stays</span><span class="chip">{icon("fuel",13)} Fuel/EV</span><span class="chip">{icon("bus",13)} Bus stops</span><span class="chip">{icon("hospital",13)} Hospitals</span></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;justify-content:space-between;align-items:center"><b class="h2">Food stops</b>{tier((0,1))}</div>'
          f'<div class="list">{row("food","Hill View Mess · ₹","Kalpetta · 0.4 km off route · open 6 AM · 4.4 ★","","amber")}{row("food","Green Leaf Café · ₹₹","Sultan Bathery · on route · 4.5 ★","","amber")}'
          f'{row("food","Forest Edge Resort dining · ₹₹₹","Muthanga · 2 km off route · 4.3 ★","","amber")}</div>'
          f'<div class="banner warn">{icon("wifi_off")}Last network before the forest: Sultan Bathery.</div></div>')),
    purpose="Everything a traveller may need along a long route: food, stays, fuel and EV charging, bus stops, auto stands, hospitals and police, filtered by price band.",
    how=["Places come from partners (restaurants, hotels) and map data (fuel, hospitals, bus stops).",
         "Only places within a set distance of the route are shown, with the detour in km.", "Price bands use average cost: ₹ budget, ₹₹ mid, ₹₹₹ premium.",
         "The last place with network before a dead zone is highlighted."],
    elements=["Route map with signal colours and place markers", "Category chips", "Price band", "Place list with detour, hours and rating", "Last-network notice"],
    apis=[("GET", "/v1/route/pois?polyline=&type=&tier=", "Places along a route")], data=["Partner listings", "Map POI data", "Coverage tiles"], to=["R36", "R41"],
    edge=["Opening hours checked for the arrival time, not now.", "Places in the dead zone show 'pay in cash or prepay' because cards may fail there."]))

# ---------------------------------------------------------------- R38 coverage warning
S.append(dict(id="R38", mock=phone(mapbody(corridor_svg(W, H, segs=SEGS, towns=TOWNS, labels=True),
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;gap:10px;align-items:center"><span class="ic" style="background:#33424E;color:#fff">{icon("wifi_off")}</span><div><div class="h2">No mobile network for ~30 km</div><div class="xs">Muthanga → Gundlupet forest · about 45 min</div></div></div>'
          f'{cov([("g",58),("n",16),("g",26)])}<div class="xs">Reported by 214 travellers in the last 30 days, all networks. Night traffic on this forest road is restricted 9 PM – 6 AM (example).</div>'
          f'{sect("CHOOSE A BACKUP PLAN")}<div class="list">{row("download","Download offline pack","Map, tickets, contacts, emergency numbers · 18 MB",'<span class="tag ok">Recommended</span>',"brand")}'
          f'{row("route","Route with coverage","+38 km, about +50 min, full network","","blue")}{row("food","Stop before the stretch","Sultan Bathery: food, fuel, ATM","","amber")}'
          f'{row("shield","Auto check-in","Contacts alerted if you don\'t reappear by 11:55","","red")}</div>{btn("Set up my backup plan")}</div>')),
    purpose="Warns before a trip that part of the route has no mobile network and offers concrete backup plans.",
    how=["The coverage service checks the route against a map of signal strength built from anonymous reports by app users and partner data.",
         "Stretches longer than 5 km without signal trigger this screen.", "Each backup plan is optional; the recommended one is marked.",
         "Road restrictions such as night closures are shown from the road rules database."],
    elements=["Map with signal colours", "Length, duration and source of the no-network stretch", "Coverage bar", "Road restriction note", "Backup options", "Set up button"],
    apis=[("GET", "/v1/coverage/route?polyline=&at=", "Dead zones with confidence"), ("POST", "/v1/trips/{id}/backup-plan", "Save chosen backup options")],
    events=["coverage.warning_shown", "trip.backup_plan_set"], data=["coverage.tiles (H3)", "road_rules"], to=["R39", "R37", "R36"],
    edge=["Low-confidence areas say 'signal may be weak' instead of 'no network'.", "Coverage changes over time; data older than 90 days is shown with a note."]))

# ---------------------------------------------------------------- R39 offline pack
chk = lambda t, s, done=True: f'<div class="li"><span class="ic {"brand" if done else "amber"}">{icon("check" if done else "clock")}</span><span class="tx"><b>{t}</b><span>{s}</span></span></div>'
S.append(dict(id="R39", mock=phone(
    appbar("Offline pack & backup plan") +
    f'<div class="body" style="gap:9px"><div class="card-m"><div class="kv"><b>Ready for no-network travel</b><b>5 of 6</b></div><div class="meter"><i style="width:84%"></i></div></div>'
    f'<div class="list">{chk("Route map and directions","Works with GPS only · 18 MB")}{chk("Tickets and bookings","Bus QR, rental and hotel vouchers")}'
    f'{chk("Contacts and driver details","Bus operator helpline, rental partner")}{chk("Emergency numbers","Kerala and Karnataka · 112 · nearest hospitals")}'
    f'{chk("Payments sorted","Bus and rental prepaid; ₹500 cash suggested")}{chk("Auto check-in","Waiting for your 2 emergency contacts to confirm", False)}</div>'
    f'{sect("IF PLANS CHANGE")}<div class="card-m" style="gap:6px"><span style="font-size:13px">• Bus over 30 min late: free switch to the 9:00 bus</span><span style="font-size:13px">• Missed bus: shared cab seats at 10:00 (₹720)</span><span style="font-size:13px">• SMS HELP to 5xxxx with any weak signal</span></div>'
    f'<div class="fill"></div>{btn("Done")}</div>'),
    purpose="Prepares everything the traveller needs to keep going with no network, and agrees a backup plan in advance.",
    how=["Map tiles, tickets, contacts and emergency numbers for the route's regions are saved encrypted on the phone.",
         "Payments for bookings in the dead zone are taken in advance where possible.",
         "Auto check-in: the server expects the phone back online by the end of the stretch plus a buffer; if not, contacts and the safety team are alerted.",
         "Backup rules are stored with the trip so rebooking needs no network."],
    elements=["Readiness meter", "Checklist with status", "Pre-agreed backup rules", "SMS help number", "Done"],
    apis=[("GET", "/v1/trips/{id}/offline-pack", "Pack manifest and files"), ("POST", "/v1/trips/{id}/checkin-window", "Expected back-online time")],
    events=["offline_pack.downloaded", "checkin.window_set"], data=["Encrypted local storage", "safety.checkin_windows"], to=["R40"],
    edge=["Low storage: pack is reduced to tickets, contacts and a simplified map (2 MB).", "Pack expires 48 hours after the trip and deletes itself."]))

# ---------------------------------------------------------------- R40 offline trip
S.append(dict(id="R40", mock=phone(mapbody(corridor_svg(W, H, segs=SEGS, towns=TOWNS, me_t=0.66, labels=True),
    top=f'<div class="floating" style="background:#33424E;color:#fff"><span class="ic" style="background:#4A5A66;color:#fff">{icon("wifi_off")}</span><div style="flex:1"><b>Offline since 11:12</b><div class="xs" style="color:#C9D4DC">Map, GPS and tickets still work</div></div></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="kv"><b>Back in network around 11:55</b><span class="xs">near Gundlupet</span></div>{cov([("g",58),("n",8),("a",0),("n",8),("g",26)])}'
          f'<div class="list">{row("map","Offline map & GPS","You are 12 km into the forest stretch",icon("check"),"brand")}{row("doc","Bus ticket QR","Show to conductor",icon("check"),"brand")}'
          f'{row("alert","SOS","Sends by SMS the moment any signal appears",icon("check"),"red")}{row("signal","Satellite SOS","On supported phones, from the phone\'s own settings","","blue")}</div>'
          f'<div class="xs">46 location points saved. They sync automatically when you\'re back online.</div></div>')),
    purpose="Shows travellers what still works while there is no network, and when they'll be back online.",
    how=["The app detects loss of network and switches to the offline pack.", "GPS keeps working without mobile data; position is saved locally.",
         "SOS is queued and sent by SMS as soon as any signal appears, even a weak one.", "On reconnection, saved points and events sync and the auto check-in closes."],
    elements=["Offline banner with time", "Live position on offline map", "Expected reconnection", "What works list", "Satellite SOS hint", "Sync note"],
    apis=[("POST", "/v1/trips/{id}/sync", "Upload saved events when back online")], events=["trip.offline_started", "trip.offline_ended"], data=["Local queue", "Offline map tiles"], to=["R36"],
    edge=["Phone stays offline 30 min past the expected time: safety team and contacts are alerted with the last known position.", "Battery saver mode lowers GPS frequency but keeps SOS."]))

# ---------------------------------------------------------------- R41 hotels
S.append(dict(id="R41", mock=phone(
    appbar('Stays in Mysuru <span class="xs" style="display:block;font-weight:400">Fri 16 – Sun 18 Oct · 2 guests</span>', right=f'<span class="ib">{icon("map")}</span>') +
    f'<div class="body" style="gap:2px"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:6px">{tier((0,1,2))}<span class="chip">Near bus stand ▾</span></div>'
    + place("Comfort Lodge", "₹ · 450 m from bus stand · AC room", "4.1 ★ (820) · Free cancellation", "₹1,100/night") +
    place("Heritage View Hotel", "₹₹ · palace view rooftop · breakfast", "4.5 ★ (1,940) · Pay at hotel", "₹3,400/night", "h2") +
    place("Garden Homestay", "₹₹ · family-run · home food", "4.8 ★ (310) · Couple friendly", "₹2,200/night", "h3") +
    place("Palace Road Resort", "₹₹₹ · pool · spa · airport transfer", "4.6 ★ (2,410)", "₹8,900/night") +
    f'<div class="banner ok" style="margin-top:6px">{icon("tag")}Book with your bus: extra ₹150 off.</div></div>'),
    purpose="Hotels, homestays and lodges from budget to premium, near where the trip ends.",
    how=["Inventory comes from hotel partners directly or through channel managers.", "Price band is set from the nightly rate compared with the city's spread.",
         "Distance is measured from the trip's arrival point, not the city centre.", "Bundle discounts apply when booked with transport in the same plan."],
    elements=["Dates and guests", "Price band filter", "Location filter", "Hotel cards with tier, distance, rating, policy, price", "Bundle offer"],
    apis=[("GET", "/v1/stays/search", "Availability and prices")], data=["stays.properties, stays.rates"], to=["R42"],
    edge=["Taxes shown in the total, never added at the last step.", "Unverified properties are not listed."]))

# ---------------------------------------------------------------- R42 hotel detail
S.append(dict(id="R42", mock=phone(
    f'<div style="height:190px;background:linear-gradient(135deg,#C9B8E0,#7D63AE);position:relative;flex:0 0 160px"><span class="ib" style="position:absolute;top:12px;left:14px;background:#fff">{icon("back")}</span></div>'
    f'<div class="body" style="gap:9px;padding-top:12px"><div><div class="h2">Heritage View Hotel <span class="tag info">₹₹</span></div><div class="xs">Mysuru · 1.1 km from bus stand · 4.5 ★ (1,940)</div></div>'
    f'<div class="chips"><span class="chip">AC</span><span class="chip">Wi-Fi</span><span class="chip">Breakfast</span><span class="chip">Rooftop</span><span class="chip">Parking</span></div>'
    f'{sect("ROOMS")}<div class="opt on"><span class="tx"><b>Deluxe double</b><span>Breakfast · free cancellation till 15 Oct</span></span><span class="pr">₹3,400</span></div>'
    f'<div class="opt"><span class="tx"><b>Palace-view room</b><span>Breakfast · pay at hotel</span></span><span class="pr">₹4,200</span></div>'
    f'<div class="card-m"><div class="kv"><span>2 nights</span><span>₹6,800</span></div><div class="kv"><span>Taxes</span><span>₹816</span></div><div class="kv"><span>Bundle with bus</span><span style="color:#0B7A68">−₹150</span></div><div class="hr"></div><div class="kv"><b>Total</b><b>₹7,466</b></div></div>'
    f'{btn("Add to trip plan")}</div>'),
    purpose="Hotel details, room choice and the final price before adding it to the trip.",
    how=["Rates and policies come live from the partner when the page opens.", "Room is held for 10 minutes while paying.", "Voucher is saved in Trips & tickets and works offline."],
    elements=["Photo", "Name, tier, distance, rating", "Amenities", "Room options with policy", "Price breakdown with bundle saving", "Add to trip"],
    apis=[("GET", "/v1/stays/{id}", "Details and live rates"), ("POST", "/v1/stays/{id}/hold", "Hold room")], events=["stay.booked"], data=["stays.*"], to=["R36", "R54"],
    edge=["Rate changed since search: new price shown before paying.", "Partner overbooking: rebooked at equal or better tier at no extra cost."]))

# ---------------------------------------------------------------- R44 food home
rest = lambda n, s, m, p, ph="": place(n, s, m, p, ph)
S.append(dict(id="R44", mock=phone(
    f'<div class="ab"><span class="ic brand">{icon("home")}</span><span style="flex:1"><span class="xs">Deliver to</span><div style="font-weight:700">Home · Banjara Hills ▾</div></span><span class="ib">{icon("search")}</span></div>'
    f'<div class="body" style="gap:4px"><div style="display:flex;gap:8px;align-items:center;padding-bottom:6px">{modes("saver")}</div>'
    f'<div style="display:flex;gap:8px;align-items:center;padding-bottom:4px">{tier((0,1))}<span class="chip">Veg only</span><span class="chip">Under 30 min</span></div>'
    + rest("Biryani House", "₹₹ · ₹350 for two · Hyderabadi", "28 min · 1.8 km · 4.4 ★", '<span class="tag ok">40% OFF up to ₹80</span>', "") +
    rest("Udupi Corner", "₹ · ₹180 for two · South Indian, veg", "22 min · 0.9 km · 4.5 ★", '<span class="tag ok">Free delivery</span>', "h3") +
    rest("The Grill Room", "₹₹₹ · ₹1,200 for two · continental", "35 min · 3.4 km · 4.6 ★", "", "h2") +
    f'<div class="banner info" style="margin-top:6px">{icon("clock")}Saver: we batch orders nearby, delivery free, up to 12 min slower.</div></div>'
    + bnav(SUPER, "home")),
    purpose="Food delivery with the same priority choices: fastest, cheapest or best deal, from budget to fine dining.",
    how=["Restaurants are partners (P02, P03); price band uses average cost for two.", "Saver allows batching two nearby orders on one delivery partner, so delivery is free or cheaper.",
         "Delivery time estimate = restaurant prep time + partner travel, learned per restaurant.", "Offers shown are the best the user can actually use."],
    elements=["Delivery address", "Priority chips", "Price band and quick filters", "Restaurant cards with price for two, time, rating, offer", "Saver explanation"],
    apis=[("GET", "/v1/food/restaurants?lat&lng&tier=", "Restaurants open and delivering here")], data=["merchants.restaurants", "ETA model"], to=["R45"],
    edge=["Restaurants closing within 20 minutes are hidden.", "Heavy rain: delivery fee and times update, and a weather banner explains why."]))

# ---------------------------------------------------------------- R45 menu & cart
food = lambda n, d, p, v="veg", q=None, ph="": (f'<div class="food"><span><span class="{"veg" if v=="veg" else "veg nv"}"></span><b style="font-size:14px">{n}</b><div class="xs">{d}</div>'
                                                f'<div style="font-weight:800;margin-top:4px">{p}</div></span><span style="display:flex;flex-direction:column;align-items:center;gap:4px"><span class="ph {ph}"></span>'
                                                + (f'<span class="qty"><span>−</span><span>{q}</span><span>+</span></span>' if q else '<span class="qty"><span>ADD</span></span>') + '</span></div>')
S.append(dict(id="R45", mock=phone(
    appbar('Biryani House <span class="xs" style="display:block;font-weight:400">₹₹ · 28 min · 4.4 ★</span>') +
    f'<div class="body" style="gap:0">{food("Chicken dum biryani","Serves 1 · bestseller","₹289","nv",1,"")}{food("Paneer biryani","Serves 1","₹249","veg",1,"g")}'
    f'<div class="card-m" style="margin-top:10px">{sect("DELIVERY")}<div class="opt"><span class="tx"><b>Priority</b><span>22 min · direct</span></span><span class="pr">₹49</span></div>'
    f'<div class="opt"><span class="tx"><b>Standard</b><span>28 min</span></span><span class="pr">₹29</span></div>'
    f'<div class="opt on"><span class="tx"><b>Saver {badge("CHEAPEST","cheap")}</b><span>40 min · shared with a nearby order</span></span><span class="pr">₹0</span></div>'
    f'<div class="kv"><span>Coupon BIRYANI40 applied</span><span style="color:#0B7A68">−₹80</span></div></div><div class="fill"></div>{btn("2 items · Pay ₹458")}</div>'),
    purpose="Choose dishes and how fast to get them, with the best coupon already applied.",
    how=["Menu and stock come from the restaurant's live menu (P03).", "Delivery speed options reflect the priority modes; Saver uses batching.",
         "The best eligible coupon is applied automatically; the user can switch to another.", "Payment confirms the order to the restaurant."],
    elements=["Restaurant header", "Menu items with veg / non-veg mark and quantity", "Delivery speed options", "Auto-applied coupon", "Pay button"],
    apis=[("GET", "/v1/food/restaurants/{id}/menu", "Menu"), ("POST", "/v1/food/carts/{id}/quote", "Price with delivery and coupon"), ("POST", "/v1/food/orders", "Place order")],
    events=["order.placed"], data=["merchants.menus", "orders.orders"], to=["R46"],
    edge=["Item goes out of stock after adding: removed with a notice before payment.", "Allergen notes passed to the restaurant and printed on the kitchen ticket."]))

# ---------------------------------------------------------------- R46 food tracking
st_ = lambda t, s, k: f'<div class="s"><span class="dot {k}">{icon("check",14,3) if k=="ok" else (icon("clock",14,2.4) if k=="now" else "")}</span><span><b>{t}</b><div class="xs">{s}</div></span></div>'
S.append(dict(id="R46", mock=phone(mapbody(map_svg(W, H, route=[(250,150),(250,245),(140,245),(140,400)], pickup=(250,150), drop=(140,400), cars=[(250,200,0)], labels=False),
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;align-items:center"><div style="flex:1"><div class="h2">Arriving in 14 min</div><div class="xs">Saver delivery · 1 stop before you</div></div><span class="chip on">OTP 4471</span></div>'
          f'<div class="steps-m">{st_("Order accepted","7:02 PM","ok")}{st_("Prepared","7:15 PM · sealed bag photo taken","ok")}{st_("Picked up by Salim","7:18 PM","now")}{st_("Delivered","","")}</div>'
          f'<div class="li" style="padding:0;border:none"><span class="av">SM</span><span class="tx"><b>Salim M. · ★ 4.9</b><span>Bike · contactless drop on</span></span><span class="ib">{icon("phone")}</span></div></div>')),
    purpose="Live tracking of a food order from kitchen to door.",
    how=["Restaurant status updates arrive from the partner app.", "Delivery partner location streams like a ride.", "Batched orders show how many stops are before yours.", "OTP or a doorstep photo confirms delivery."],
    elements=["Map with route", "ETA and delivery type", "Order steps", "Delivery partner with masked call", "Delivery OTP"],
    apis=[("WS", "/ws/orders/{id}", "Status and location")], events=["order.delivered"], data=["orders.order_events"], to=["R18"],
    edge=["Order late by 15 min over estimate: automatic credit offered.", "Restaurant cancels: instant refund and similar restaurants suggested."]))

# ---------------------------------------------------------------- R47 send parcel
S.append(dict(id="R47", mock=phone(
    appbar("Send a parcel") +
    f'<div class="body" style="gap:8px"><div class="chips"><span class="chip">Within city</span><span class="chip on">To another city</span></div>'
    f'<div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>From: Mavoor Road, Kozhikode</b><span>Anil · +91 94••• ••120</span></span></div><div class="vline"></div>'
    f'<div class="loc"><span class="d sq"></span><span class="tx"><b>To: Vijayanagar, Mysuru</b><span>Divya · +91 99••• ••305</span></span></div></div>'
    f'<div class="chips"><span class="chip">Documents</span><span class="chip on">Small · up to 5 kg</span><span class="chip">Medium · 15 kg</span></div>'
        f'<div class="opt"><span class="veh">{icon("bike",22)}</span><span class="tx"><b>Express courier {badge("FAST","fast")}</b><span>Today by 9 PM · dedicated</span></span><span class="pr">₹1,450</span></div>'
    f'<div class="opt on"><span class="veh">{icon("users",22)}</span><span class="tx"><b>With a traveller {badge("CHEAPEST","cheap")}</b><span>Shared cab leaving 7:00 · arrives by 1 PM</span></span><span class="pr">₹180</span></div>'
    f'<div class="opt"><span class="veh">{icon("bus",22)}</span><span class="tx"><b>Bus parcel</b><span>Tomorrow 10 AM · collect at stand</span></span><span class="pr">₹120</span></div>'
    f'{inp("What\'s inside? (required)","Books, 2 kg")}<div class="xs">No cash, jewellery or banned items. <b>Full list</b></div>{btn("Book pickup · ₹180")}</div>'),
    purpose="Send packages within a city or to another city, choosing between fast, cheap and in-between.",
    how=["City parcels use bike or car delivery partners like a ride.", "Intercity parcels can ride with a verified traveller on a shared trip, with a bus operator, or by a dedicated courier.",
         "Contents must be declared; prohibited items are listed per country.", "Sender and receiver get OTPs; photos are taken at each handover."],
    elements=["City or intercity", "Sender and receiver", "Size", "Delivery options with time and price", "Contents declaration", "Book pickup"],
    apis=[("POST", "/v1/parcels/quote", "Options for size and route"), ("POST", "/v1/parcels", "Create parcel")], events=["parcel.created"],
    data=["parcels.parcels", "sharing.trips (boot space)"], to=["R48"],
    edge=["High-value items need a dedicated courier with insurance.", "Traveller trip cancelled: parcel moves to the next trip or bus at no extra cost."]))

# ---------------------------------------------------------------- R48 parcel tracking
S.append(dict(id="R48", mock=phone(
    appbar("Parcel PRC-88214") +
    f'<div class="body" style="gap:9px"><div class="card-m brand"><span class="xs">With traveller Ravi S. · shared cab KL 11 BT 2024</span><div class="h2" style="color:#fff">Arriving Mysuru by 1 PM</div><span class="xs">Receiver OTP sent to Divya: 6214</span></div>'
    f'<div class="steps-m">{st_("Picked up from Anil","6:42 AM · photo of sealed parcel","ok")}{st_("Handed to traveller","6:58 AM · Ravi scanned code","ok")}{st_("On the way","No network 11:10–11:55 expected","now")}{st_("Delivered to Divya","Receiver OTP + photo","")}</div>'
    f'<div style="display:flex;gap:8px"><div class="docimg" style="flex:1;height:90px;border-radius:10px;background:repeating-linear-gradient(135deg,#EEF2F5 0 10px,#E4EAEE 10px 20px);display:flex;align-items:center;justify-content:center;color:#6A7885;font-size:12px">Pickup photo</div>'
    f'<div style="flex:1;height:90px;border-radius:10px;background:repeating-linear-gradient(135deg,#EEF2F5 0 10px,#E4EAEE 10px 20px);display:flex;align-items:center;justify-content:center;color:#6A7885;font-size:12px">Handover photo</div></div>'
    f'<div class="row2">{btn("Call traveller","ghost sm","phone")}{btn("Share tracking","soft sm","share")}</div></div>'),
    purpose="Track a parcel through each handover with photos, codes and time stamps.",
    how=["Each handover needs the next person to scan the parcel code and take a photo.", "Location follows the carrier's trip; dead zones are shown as expected gaps.",
         "The receiver gets a tracking link and an OTP without installing the app.", "Delivery proof is the receiver's OTP and a photo."],
    elements=["Carrier and ETA", "Receiver OTP", "Handover steps", "Proof photos", "Call carrier and share tracking"],
    apis=[("GET", "/v1/parcels/{id}", "Status and proofs"), ("WS", "/ws/parcels/{id}", "Live updates")], events=["parcel.handed_over", "parcel.delivered"],
    data=["parcels.handovers"], to=["R27"],
    edge=["Receiver unavailable: held by the traveller or dropped at a partner point, per sender's choice.", "Damage claims need the pickup photo for comparison."]))

# ---------------------------------------------------------------- R49 savings hub
S.append(dict(id="R49", mock=phone(
    appbar("Savings", back=False) +
    f'<div class="body" style="gap:9px"><div class="card-m"><div class="kv"><b>October budget</b><b>₹2,350 of ₹4,000</b></div><div class="meter"><i style="width:59%"></i></div><span class="xs">Saved ₹1,240 with Saver choices and coupons</span></div>'
    f'<div class="card-m brand"><b>Go Pass · ₹99/month</b><span class="xs">Free food delivery over ₹199 · 10% off rides · priority support. Pays for itself after 2 orders.</span>{btn("Try free for 7 days","amber sm")}</div>'
    f'{sect("BEST DEALS FOR YOU")}<div class="list">{row("users","Share a seat, save 40%","Long trips this weekend · 12 routes","","brand")}'
    f'{row("clock","Off-peak rides 10% off","2–5 PM weekdays","","blue")}{row("food","BIRYANI40","40% off up to ₹80 · 3 restaurants near you","","amber")}{row("box","Parcel with a traveller","From ₹120 to 18 cities","","brand")}</div>'
    f'{sect("PRICE ALERTS")}<div class="list">{row("bell","Kozhikode → Mysuru shared seat","Alert under ₹600 · now ₹720","","amber")}</div></div>'
    + bnav(SUPER_NAV, "deals")),
    purpose="One place for people who want to save: monthly budget, subscription pass, the best current deals and price alerts.",
    how=["Budget is a user goal; the app warns before a booking takes them over.", "Deals are ranked by the user's history and what is valid near them now.",
         "The pass is a subscription with clear benefits and a break-even hint.", "Price alerts watch flexible trips and notify or auto-book."],
    elements=["Monthly budget meter", "Savings so far", "Pass offer", "Personal deals", "Price alerts", "Bottom navigation"],
    apis=[("GET", "/v1/savings", "Budget, savings, deals"), ("POST", "/v1/pass/subscribe", "Start pass")], events=["pass.subscribed"],
    data=["promotions.*", "ledger"], to=["R22", "R50", "R31"],
    edge=["Pass benefits stop the day after cancelling; no hidden renewals.", "Deals never hide a cheaper option without the deal."]))

# ---------------------------------------------------------------- R50 price alert
bars = '<div class="bars" style="height:90px">' + "".join(f'<i class="{"on" if i==1 else ""}" style="height:{h}%"></i>' for i, h in enumerate([80, 55, 62, 70, 95, 100, 74])) + '</div><div class="bars-l">' + "".join(f"<span>{d}</span>" for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) + "</div>"
S.append(dict(id="R50", mock=phone(
    appbar("I have time: watch the price") +
    f'<div class="body" style="gap:10px"><div class="card-m"><b>{KM} · shared seat</b><span class="xs">Lowest seat price by day, next week</span>{bars}<span class="xs"><b>Tuesday 6 AM</b> is usually cheapest: ₹540</span></div>'
    f'<div class="card-m"><div class="kv"><b>Alert me when under</b><b>₹600</b></div><div class="meter"><i style="width:40%"></i></div></div>'
    f'<div class="list">{row("calendar","Travel window","Mon 19 – Thu 22 Oct, any morning")}{row("check","Auto-book if price is under ₹560","Charged only when booked",'<span class="toggle on"></span>',"brand")}'
    f'{row("bell","Notify by","Push and WhatsApp")}</div><div class="fill"></div>{btn("Start watching")}</div>'),
    purpose="For flexible travellers: watch prices across days and times and book automatically when it drops.",
    how=["Price history per route and time builds the weekly pattern.", "The watcher checks new seats and bus fares every 15 minutes.",
         "Auto-book uses the saved payment method within the user's limits and sends a receipt.", "The alert ends after booking or when the window passes."],
    elements=["Price by day chart", "Cheapest time hint", "Target price", "Travel window", "Auto-book toggle", "Notification channels"],
    apis=[("POST", "/v1/price-alerts", "Create alert"), ("GET", "/v1/routes/{id}/price-history", "Weekly pattern")], events=["price_alert.created", "price_alert.triggered"],
    data=["pricing.price_history", "alerts.price_alerts"], to=["R49", "R54"],
    edge=["Auto-book never exceeds the set price or the budget.", "If nothing matches by the deadline, the user gets the best available options."]))

# ---------------------------------------------------------------- R51 emergency
S.append(dict(id="R51", mock=phone(
    f'<div class="ab" style="background:#D93A1E;color:#fff;padding-top:10px;padding-bottom:14px"><span class="ib" style="background:#E8644B;color:#fff">{icon("back")}</span><span class="t">Medical emergency</span></div>'
    f'<div class="body" style="gap:10px;padding-top:12px"><div class="row2">{btn("Call 112","danger","phone")}{btn("Ambulance 108","danger","hospital")}</div>'
    f'<div class="banner info">{icon("globe")}Numbers change by country. We use the right ones for where you are.</div>'
    f'{sect("NEAREST HOSPITALS WITH EMERGENCY")}<div class="list">{row("hospital","City General Hospital","2.1 km · 7 min · 24×7 casualty","","red")}{row("hospital","Apex Multi-speciality","3.4 km · 11 min · cardiac care","","red")}{row("hospital","Govt. District Hospital","4.0 km · 13 min","","red")}</div>'
    f'{btn("Fastest ride to City General · no surge","dark","car")}<div class="xs">Priority dispatch. Surge and add-ons are switched off in emergency mode.</div>'
    f'{btn("Share my location with contacts","ghost","share")}</div>'),
    purpose="A calm, fast path in a medical emergency: call for help, find the nearest emergency department, and get a ride without surge.",
    how=["Emergency numbers come from the country pack (112, 108, 911, 999 and others).", "Hospital list comes from map data filtered to emergency departments, with live travel time.",
         "The ride is dispatched with top priority, no surge and no upsell.", "This mode never replaces an ambulance; the call buttons are first."],
    elements=["Call emergency and ambulance", "Country note", "Nearest emergency hospitals", "No-surge priority ride", "Share location"],
    apis=[("GET", "/v1/emergency/nearby?lat&lng", "Hospitals and numbers"), ("POST", "/v1/rides?mode=emergency", "Priority ride")], events=["emergency.ride_requested"],
    data=["Country pack", "POI data"], to=["R12"],
    edge=["Drivers can't decline emergency rides without a safety reason.", "Abuse of emergency mode is reviewed, but never blocks a ride at the time."]))

# ---------------------------------------------------------------- R52 AI assistant
S.append(dict(id="R52", mock=phone(
    appbar(f'{icon("sparkle")} Trip assistant') +
    f'<div class="body" style="gap:8px"><div class="bubble me">Plan Kozhikode to Mysuru this Friday for 2 of us, under ₹2,000, we have time, and we want a good breakfast stop</div>'
    f'<div class="bubble them">Here\'s a Saver plan for ₹1,840 for both:</div>'
    f'<div class="card-m" style="gap:4px">{leg("7:30","Auto to bus stand","","₹60")}{leg("8:00","AC seater bus","Seats together","₹1,080")}{leg("10:05","Breakfast · Hill View Mess ₹","Kalpetta, 20 min","")}{leg("13:45","Scooter rental 2 days","","₹900","walk")}</div>'
    f'<div class="bubble them">Heads up: about 30 km has no network after Muthanga. I\'ll prepare an offline pack.</div>'
    f'<div class="chips"><span class="chip on">Book this plan</span><span class="chip">Make it faster</span><span class="chip">Add a hotel</span><span class="chip">Cheaper?</span></div>'
    f'<div class="fill"></div><div class="inp"><div class="box">{icon("mic")}<span class="ph">Ask in any language</span></div></div></div>'),
    purpose="Plan and book by talking, in the user's language: 'under ₹2,000', 'we have time', 'good breakfast'.",
    how=["The assistant turns the request into a structured search: route, date, party, budget, priority, wishes.",
         "It calls the same planner, search and coverage tools the app uses, so prices are real.", "Nothing is booked until the user taps a confirm button.",
         "Voice input works in local languages."],
    elements=["User request", "Plan card with legs and prices", "Coverage heads-up", "Quick follow-ups", "Voice / text input"],
    apis=[("POST", "/v1/assistant/messages", "Assistant with planner tools")], events=["assistant.plan_proposed"], data=["Planner results"], to=["R36"],
    edge=["Unclear request: the assistant asks one short question.", "The assistant never invents prices or availability; if a tool fails it says so."]))

# ---------------------------------------------------------------- R53 country language currency
S.append(dict(id="R53", mock=phone(
    appbar("Country, language & currency") +
    f'<div class="body" style="gap:8px">{sect("COUNTRY")}<div class="list">{row("globe","🇮🇳 India","All 9 services · INR · emergency 112",icon("check"),"brand")}'
    f'{row("globe","🇦🇪 United Arab Emirates","7 services · AED · emergency 999")}{row("globe","🇬🇧 United Kingdom","5 services · GBP · emergency 999")}{row("globe","🇰🇪 Kenya","6 services · KES · M-Pesa")}{row("globe","🇧🇷 Brazil","6 services · BRL · Pix")}</div>'
    f'{sect("LANGUAGE")}<div class="chips"><span class="chip">English</span><span class="chip on">മലയാളം</span><span class="chip">हिन्दी</span><span class="chip">తెలుగు</span><span class="chip">தமிழ்</span><span class="chip">العربية</span><span class="chip">Español</span><span class="chip">Kiswahili</span></div>'
    f'{sect("UNITS")}<div class="chips"><span class="chip on">Kilometres</span><span class="chip">Miles</span><span class="chip on">24-hour</span><span class="chip">12-hour</span></div>'
    f'<div class="banner info">{icon("globe")}Travelling abroad? The app switches automatically when you land and keeps your account and wallet.</div></div>'),
    purpose="Choose country, language and units. The same account works in every country the app serves.",
    how=["Country is detected from location and SIM; the user can override it.", "Each country loads a country pack: services, currency, payment methods, emergency numbers, laws.",
         "Language changes the whole app, including right-to-left scripts such as Arabic.", "Wallet balances are kept per currency."],
    elements=["Country list with services, currency and emergency number", "Language chips in native scripts", "Units", "Travel note"],
    apis=[("GET", "/v1/countries", "Countries and services"), ("PUT", "/v1/me/locale", "Save language and units")], data=["Country packs", "Translations"], to=["R29"],
    edge=["Personal data stays in the home region; trips abroad use the local region for operations only.", "Missing translations fall back to English, never to blank text."]))

# ---------------------------------------------------------------- R54 trips & tickets
S.append(dict(id="R54", mock=phone(
    appbar("Trips & tickets", back=False) +
    f'<div class="body" style="gap:8px"><div class="chips"><span class="chip on">Upcoming</span><span class="chip">Past</span></div>'
    f'<div class="card-m" style="gap:6px"><div class="kv"><b>Fri 16 Oct · {KM}</b><span class="tag ok">Offline ready</span></div>'
    f'<div style="display:flex;gap:10px;align-items:center"><div style="width:76px;height:76px;background:repeating-conic-gradient(#14202A 0 25%,#fff 0 50%) 0 0/12px 12px;border-radius:6px;border:4px solid #fff;outline:1px solid #E3E8EC"></div>'
    f'<div style="display:flex;flex-direction:column;gap:2px"><b>AC seater bus · 8:00</b><span class="xs">Seats 14, 15 · PNR 4K9-22X</span><span class="xs">Board at KSRTC stand</span></div></div></div>'
    f'<div class="list">{row("key","Scooter rental · Mysuru","Fri 13:45 → Sun 18:00 · deposit held","","brand")}{row("bed","Heritage View Hotel","2 nights · voucher HV-5521","","blue")}{row("car","Auto to bus stand","Fri 7:30 · auto-booked","","amber")}</div>'
    f'{sect("THIS WEEK")}<div class="list">{row("food","Biryani House","Delivered · ₹458")}{row("box","Parcel PRC-88214","In transit")}</div></div>'
    + bnav(SUPER_NAV, "trips")),
    purpose="All bookings across services in one list, with tickets and vouchers that work without network.",
    how=["Every booking from every service writes to one bookings index.", "Tickets, QR codes and vouchers are cached encrypted on the phone.", "Plans are grouped so a multi-leg trip shows as one item."],
    elements=["Upcoming / past", "Trip card with offline QR", "Other legs of the plan", "Recent orders and parcels", "Bottom navigation"],
    apis=[("GET", "/v1/bookings?status=upcoming", "Bookings across services")], data=["bookings index", "Local encrypted cache"], to=["R36", "R48", "R46"],
    edge=["Ticket changed by operator: the cached QR is replaced and the user notified.", "Past bookings older than retention show summary only."]))

def patch_old(old_screens):
    """Point old rider screens at the new home where it makes sense."""
    by = {s["id"]: s for s in old_screens}
    by["R01"]["to"] = ["R02", "R03", "R29"]
    by["R04"]["to"] = ["R05", "R29"]
    by["R06"]["to"] = ["R29"]
    by["R08"]["to"] = ["R31", "R09"]
    by["R07"]["to"] = ["R08", "R23", "R29"]
