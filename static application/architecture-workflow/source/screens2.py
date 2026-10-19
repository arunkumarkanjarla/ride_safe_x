"""New driver/delivery screens, partner app screens and admin screens."""
from components import *
from superlib import *
from rider import mapbody, W, H, KEYPAD
from rider2 import TOWNS, SEGS, KM, st_
from admin import card, grid, field, tl, filters, dbtn, amap

row = li

# =================================================================== DRIVER
D = []
tog = lambda on: f'<span class="toggle{" on" if on else ""}"></span>'
D.append(dict(id="D21", mock=phone(
    appbar("What do you want to do today?") +
    f'<div class="body" style="gap:9px"><div class="sub">Mix services to earn more. You can change this any time.</div>'
    f'<div class="list">{row("car","City rides","Cab · Hyderabad",tog(True),"brand")}{row("food","Food delivery","Pick up from restaurants near you",tog(True),"amber")}'
    f'{row("box","Parcels","City parcels up to 15 kg",tog(True),"blue")}{row("users","Shared seats on long trips","Publish your own trips",tog(False))}'
    f'{row("bus","Long-distance one-way","Rides over 100 km, return trip suggested",tog(False))}</div>'
    f'{sect("RULES THAT APPLY")}<div class="card-m" style="gap:5px"><span style="font-size:13px">• Parcels need a 5-minute safety training (done ✓)</span><span style="font-size:13px">• Food on a ride only when no passenger is on board</span><span style="font-size:13px">• Long trips need 2 hours rest in every 10 hours</span></div>'
    f'<div class="fill"></div>{btn("Save and go online")}</div>'),
    purpose="Drivers and delivery partners choose which services they take today, so one person and vehicle can serve rides, food, parcels and long trips.",
    how=["Each service has its own requirements (vehicle type, training, insulated bag for food).", "Dispatch only offers jobs from enabled services.",
         "Rules prevent unsafe or illegal combinations, such as food pickups with a passenger on board.", "Earnings and incentives are tracked per service."],
    elements=["Service toggles with details", "Applicable rules", "Save and go online"],
    apis=[("PUT", "/v1/drivers/me/services", "Enabled services"), ("GET", "/v1/drivers/me/eligibility", "Which services are allowed")], events=["driver.services_changed"],
    data=["drivers.service_enrolments"], to=["D06", "D24"],
    edge=["A service needing a missing document is shown locked with the document to upload.", "Bike riders see bike taxi, food and small parcels only."]))

D.append(dict(id="D22", mock=phone(mapbody(map_svg(W, H, route=[(70,560),(70,400),(200,400),(200,245),(290,245)], pickup=(70,400), drop=(290,245), me=(70,560), dim=True, labels=False),
    sheet=f'<div class="sheet"><div style="display:flex;align-items:center;gap:12px"><div class="ring"><span>15</span></div><div style="flex:1"><div class="h1">₹62</div><div class="xs">2 orders batched · includes ₹12 batch bonus</div></div><span class="chip amber">{icon("food",13)} Food</span></div>'
          f'<div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Pickup · Biryani House · 1.1 km</b><span>Ready in 6 min · 2 orders</span></span></div><div class="vline"></div>'
          f'<div class="loc"><span class="d sq"></span><span class="tx"><b>Drop 1 · 1.4 km · Drop 2 · 2.1 km</b><span>Banjara Hills, Road 12 and Road 10</span></span></div></div>'
          f'<div class="row2">{btn("Decline","ghost")}{btn("Accept","","check")}</div></div>')),
    purpose="A delivery job offer, which may batch two orders from the same restaurant or nearby stops.",
    how=["Dispatch times the offer so the partner arrives when food is ready, using the restaurant's prep estimate.", "Batching groups orders with drops in the same direction; the second drop adds at most 8 minutes.",
         "Earnings show distance pay, waiting pay and batch bonus.", "Accept locks the job like a ride offer."],
    elements=["Countdown", "Earnings with batch bonus", "Restaurant and ready time", "Drop points", "Decline / accept"],
    apis=[("WS", "offer message", "Delivery offer"), ("POST", "/v1/delivery-offers/{id}/accept", "Accept")], events=["delivery.accepted"],
    data=["dispatch.offers", "orders.orders"], to=["D23"],
    edge=["Food not ready on arrival: waiting pay starts after 5 minutes.", "Customer addresses are shown only after pickup to protect privacy."]))

D.append(dict(id="D23", mock=phone(
    appbar("Order #4412 · Biryani House") +
    f'<div class="body" style="gap:9px"><div class="steps-m">{st_("Arrived at restaurant","7:16 PM","ok")}{st_("Check items","2 items · sealed bag","ok")}{st_("Photo of sealed bag","Required","now")}{st_("Deliver with OTP","Ask customer for 4-digit code","")}</div>'
    f'<div style="height:150px;border-radius:12px;background:repeating-linear-gradient(135deg,#EEF2F5 0 10px,#E4EAEE 10px 20px);display:flex;align-items:center;justify-content:center;color:#6A7885;font-weight:600;gap:8px">{icon("eye",22)}Camera · take photo of sealed bag</div>'
    f'<div class="card-m"><div class="kv"><span>Parcel jobs</span><span>Contents declared by sender</span></div><div class="kv"><span>Leave at door allowed</span><span>Only with photo</span></div></div>'
    f'<div class="fill"></div><div class="slide"><i>{icon("check",22)}</i>Slide after photo · picked up</div></div>'),
    purpose="Guided pickup and handover with photo proof and OTP, for food and parcels.",
    how=["Each step must be completed in order; the slider unlocks after the photo.", "Photos are compressed on the phone and uploaded when there is network.",
         "Delivery is confirmed by the customer's OTP or, if allowed, a doorstep photo with location.", "Parcels show the sender's declaration; partners can refuse suspicious items."],
    elements=["Step list", "Camera capture", "Rules for this job", "Slide to confirm pickup"],
    apis=[("POST", "/v1/orders/{id}/pickup", "Pickup with photo"), ("POST", "/v1/orders/{id}/deliver", "Deliver with OTP or photo")], events=["order.picked_up", "order.delivered"],
    data=["orders.handovers", "MinIO proofs"], to=["D06"],
    edge=["Seal broken: partner reports it before leaving; restaurant remakes or order is cancelled.", "Customer unreachable for 10 min: support decides return or leave at door."]))

D.append(dict(id="D24", mock=phone(
    appbar("Publish a long trip") +
    f'<div class="body" style="gap:9px"><div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Kozhikode</b><span>Leave Fri 16 Oct, 7:00 AM</span></span></div><div class="vline"></div><div class="loc"><span class="d sq"></span><span class="tx"><b>Mysuru</b><span>About 4h 40m · 215 km</span></span></div></div>'
    f'{sect("PICKUP POINTS")}<div class="chips"><span class="chip on">Mavoor Road 6:55</span><span class="chip on">Thamarassery 7:35</span><span class="chip">+ Add</span></div>'
    f'<div class="row2"><div class="card-m"><span class="xs">Seats to share</span><b style="font-size:20px">3</b></div><div class="card-m"><span class="xs">Price per seat</span><b style="font-size:20px">₹720</b><span class="xs">Suggested ₹650–₹780</span></div></div>'
    f'<div class="list">{row("users","Women-only seat","1 seat reserved for women riders",tog(True),"brand")}{row("box","Carry parcels","Boot space 40 L · up to 10 kg · ₹180 each",tog(True),"amber")}'
    f'</div>'
    f'<div class="banner info">{icon("doc")}In places where carpool laws cap prices to cost sharing, the maximum is applied automatically.</div>{btn("Publish trip")}</div>'),
    purpose="Drivers already making a long journey publish their empty seats and boot space so riders and parcels can share the cost.",
    how=["Route, time and pickup points create a sharing trip.", "Suggested price is based on fuel and tolls for the route divided by seats, within local rules.",
         "Parcels are matched by size and drop point along the way.", "Bookings arrive in the manifest (D25)."],
    elements=["Route and time", "Pickup points", "Seats and price per seat", "Women-only seat", "Parcel space", "Verified riders option", "Legal note", "Publish"],
    apis=[("POST", "/v1/sharing/trips", "Publish trip"), ("GET", "/v1/sharing/price-suggestion", "Suggested seat price")], events=["sharing.trip_published"],
    data=["sharing.trips"], to=["D25"],
    edge=["Commercial vehicles and private cars follow different rules per country; the form adapts.", "Trips with no bookings 2 hours before leaving can be cancelled without penalty."]))

D.append(dict(id="D25", mock=phone(
    appbar(f'Fri 7:00 · {KM}') +
    f'<div class="body" style="gap:9px"><div class="row2"><div class="card-m"><span class="xs">Seats</span><b>3 of 3 booked</b></div><div class="card-m"><span class="xs">Parcels</span><b>2 · 6 kg</b></div><div class="card-m"><span class="xs">You earn</span><b>₹2,430</b></div></div>'
    f'{sect("PASSENGERS")}<div class="list">{row("user","Ananya R. · seat 2","Mavoor Road 6:55 · OTP at pickup",'<span class="tag ok">Paid</span>',"brand")}'
    f'{row("user","Meena K. · women-only seat","Mavoor Road 6:55",'<span class="tag ok">Paid</span>',"brand")}{row("user","Joseph T. · seat 3","Thamarassery 7:35",'<span class="tag ok">Paid</span>',"brand")}</div>'
    f'{sect("PARCELS")}<div class="list">{row("box","PRC-88214 · books 2 kg","Drop: Vijayanagar, Mysuru · receiver OTP","","amber")}{row("box","PRC-88230 · clothes 4 kg","Drop: Gundlupet bus stand","","amber")}</div>'
    f'<div class="banner ok">{icon("download")}Offline pack downloaded: route, manifest and receiver codes.</div></div>'),
    purpose="Everything on a long trip in one list: passengers, seats, parcels, pickup and drop points.",
    how=["Manifest updates as bookings arrive; it is cached offline before departure.", "Each passenger and parcel is checked in with OTP or code scan.",
         "Parcel drops are added to navigation as stops.", "Earnings show the full fare; there is no per-trip fee."],
    elements=["Seat, parcel and earning summary", "Passengers with pickup and payment status", "Parcels with drop points", "Offline pack status"],
    apis=[("GET", "/v1/sharing/trips/{id}/manifest", "Manifest"), ("POST", "/v1/sharing/trips/{id}/checkin", "Check in passenger or parcel")], events=["sharing.checked_in"],
    data=["sharing.bookings", "parcels.parcels"], to=["D26", "D10"],
    edge=["No-show passenger: seat payment goes to the driver after 10 min wait.", "Codes work offline: they are verified against the cached manifest and synced later."]))

D.append(dict(id="D26", mock=phone(mapbody(corridor_svg(W, H, segs=SEGS, towns=TOWNS, me_t=0.56, labels=True),
    top=f'<div class="turn" style="background:#33424E">{icon("wifi_off",26)}<div><div class="big">No network in 4 km</div><div>About 30 km · 45 min through forest</div></div></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="list">{row("check","Trip, fare meter and manifest","Saved on phone",icon("check"),"brand")}'
          f'{row("map","Offline navigation","Route ready",icon("check"),"brand")}{row("fuel","Last fuel before forest","Sultan Bathery · 2 km",'',"amber")}'
          f'{row("clock","Forest road closes 9 PM","Example restriction · you pass at 11:10",'',"blue")}</div>'
          f'<div class="xs">Your check-in is automatic. If the car isn\'t back online by 11:55, the safety team is alerted.</div></div>')),
    purpose="Warns the driver before a no-network stretch and confirms the trip will keep working offline.",
    how=["The coverage service has flagged the stretch on this route; the warning appears 4 km before it.", "All trip data is already cached; the app switches to offline mode automatically.",
         "Fuel and rest suggestions come from the route places service.", "A check-in window is set on the server for the expected exit time."],
    elements=["No-network banner with length and time", "Offline readiness list", "Last fuel stop", "Road restriction", "Auto check-in note"],
    apis=[("POST", "/v1/trips/{id}/checkin-window", "Expected exit time")], events=["coverage.entering_dead_zone"], data=["coverage.tiles", "road_rules"], to=["D19"],
    edge=["If the car stops for more than 15 min inside the stretch, the app asks the driver to send an SMS check-in at the next signal.", "SOS is queued and sent by SMS as soon as any signal appears."]))

# =================================================================== PARTNER
P = []
P.append(dict(id="P01", mock=phone(
    appbar(f"Partner with {BRAND}") +
    f'<div class="body" style="gap:10px"><div class="h2">What kind of business?</div>'
    + svc_grid([("food", "Restaurant", ""), ("bed", "Hotel or homestay", ""), ("key", "Car / bike rental", ""), ("bus", "Bus operator", ""), ("car", "Fleet owner", ""), ("box", "Parcel point", ""), ("fuel", "Fuel / EV stop", ""), ("bag", "Store", "")]) +
    f'{sect("YOU WILL NEED (HOTEL)")}<div class="list">{row("doc","Business registration","Licence or registration certificate","","brand")}{row("doc","Tax ID","GST / VAT number where required","","brand")}'
    f'{row("pin","Exact location","Pin and entrance photo","","brand")}{row("card","Bank account","For weekly payouts","","brand")}{row("eye","Photos","At least 5 of rooms and property","","brand")}</div>'
    f'<div class="banner info">{icon("tag")}Commission is shown before you sign. No listing fee.</div><div class="fill"></div>{btn("Start application")}</div>'),
    purpose="One app for every kind of partner: restaurants, hotels, rental companies, bus operators, fleet owners and pickup points.",
    how=["Partner picks a type; the document list comes from the country pack for that type.", "Applications go to the admin review queue (A24).",
         "Once approved, the partner sees the tools for their type.", "One partner account can own several outlets or properties."],
    elements=["Business type grid", "Documents needed", "Commission note", "Start application"],
    apis=[("POST", "/v1/partners/applications", "Create application"), ("GET", "/v1/partners/requirements?type=&country=", "Documents needed")],
    events=["partner.applied"], data=["partners.applications"], to=["P02", "P04", "P05", "P06"],
    edge=["Food partners need a food safety licence where the law requires it (for example FSSAI in India).", "Duplicate businesses are detected by tax ID and location."]))

order = lambda n, items, t, k: f'<div class="card-m" style="gap:4px"><div class="kv"><b>#{n}</b><span class="tag {k}">{t}</span></div><span style="font-size:13px">{items}</span></div>'
P.append(dict(id="P02", mock=phone(
    f'<div class="ab"><span class="t">Biryani House</span><span class="onpill on"><i></i>Accepting</span></div>'
    f'<div class="body" style="gap:8px"><div class="card-m" style="border:2px solid #F2A516;background:#FFF9EC"><div class="kv"><b>New order #4415</b><b>₹538</b></div>'
    f'<span style="font-size:13px">1× Chicken dum biryani · 1× Paneer biryani · note: less spicy</span><span class="xs">Saver delivery · partner arrives when ready</span>'
    f'<div class="xs" style="font-weight:700">PREP TIME</div><div class="chips"><span class="chip">10 min</span><span class="chip on">15 min</span><span class="chip">20 min</span></div><div class="row2">{btn("Reject","ghost sm")}{btn("Accept","sm")}</div></div>'
    f'{sect("PREPARING · 3")}{order("4412","2 items · ready in 2 min","Salim arriving","info")}{order("4410","4 items · ready in 8 min","Partner assigned","info")}'
    f'{sect("READY · 1")}{order("4409","1 item","Waiting for pickup 3 min","warn")}</div>'
    + bnav(PARTNER_NAV, "orders")),
    purpose="Restaurants receive, accept and prepare orders, and see when the delivery partner will arrive.",
    how=["New orders ring until accepted; unaccepted orders auto-reject after 3 minutes.", "The chosen prep time tells dispatch when to send the partner.",
         "Order states update the customer's tracking screen.", "Restaurants can pause orders when the kitchen is overloaded."],
    elements=["Accepting status", "New order with items, note and prep time", "Preparing list", "Ready list"],
    apis=[("WS", "/ws/merchants/{id}/orders", "Live orders"), ("POST", "/v1/merchant/orders/{id}/accept", "Accept with prep time"), ("POST", "/v1/merchant/orders/{id}/ready", "Mark ready")],
    events=["order.accepted", "order.ready"], data=["orders.orders"], to=["P03", "P07"],
    edge=["Poor internet at the restaurant: orders also arrive by SMS and a call.", "Frequent rejections lower ranking and trigger a call from the partner team."]))

P.append(dict(id="P03", mock=phone(
    appbar("Menu & availability", back=False, right='<span class="chip">Pause 30 min</span>') +
    f'<div class="body" style="gap:8px"><div class="card-m" style="flex-direction:row;justify-content:space-between;align-items:center"><span><span class="xs">Your price band</span><div style="font-weight:800">₹₹ · ₹350 for two</div></span>{tier((1,))}</div>'
    f'<div class="list">{row("food","Chicken dum biryani","₹289 · bestseller",tog(True),"amber")}{row("food","Paneer biryani","₹249",tog(True),"amber")}'
    f'{row("food","Mutton biryani","₹389 · out until 8 PM",tog(False),"amber")}{row("food","Double ka meetha","₹99",tog(True),"amber")}{row("food","Lunch combo","₹199 · 12–3 PM only",tog(True),"amber")}</div>'
    f'<div class="list">{row("clock","Opening hours","11:00 AM – 11:30 PM daily")}{row("tag","Offers you fund","40% off up to ₹80 · ends Sunday")}</div></div>'
    + bnav(PARTNER_NAV, "items")),
    purpose="Keep the menu, prices, stock and opening hours accurate, and run offers.",
    how=["Toggling an item updates the customer menu within seconds.", "Price band is calculated from average order value; partners can't pick it.",
         "Time-limited items appear only in their window.", "Partner-funded offers are shown separately from platform offers."],
    elements=["Price band", "Items with in-stock toggles", "Opening hours", "Offers", "Pause orders"],
    apis=[("PATCH", "/v1/merchant/items/{id}", "Stock and price"), ("PUT", "/v1/merchant/hours", "Hours")], events=["menu.updated"], data=["merchants.menus"], to=["P02"],
    edge=["Price increases over 20% need confirmation and are shown to customers as changed.", "Menu photos are reviewed before going live."]))

cal = lambda vals: '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:11px;text-align:center">' + "".join(
    f'<div style="border:1px solid #E3E8EC;border-radius:8px;padding:5px 0;background:{"#DCF3EC" if a>2 else ("#FDF1D8" if a>0 else "#FDE6E0")}"><b>{d}</b><div>{a} left</div><div class="xs">₹{p}</div></div>' for d, a, p in vals) + "</div>"
P.append(dict(id="P04", mock=phone(
    appbar("Heritage View Hotel", back=False) +
    f'<div class="body" style="gap:9px">{sect("DELUXE DOUBLE · NEXT 7 DAYS")}{cal([("Thu",5,"3,200"),("Fri",2,"3,400"),("Sat",0,"3,900"),("Sun",3,"3,400"),("Mon",6,"2,900"),("Tue",6,"2,900"),("Wed",4,"3,100")])}'
    f'<div class="banner ok">{icon("sync")}Synced with your channel manager 2 min ago.</div>'
    f'{sect("ARRIVING TODAY")}<div class="list">{row("user","Ananya R. · 2 guests","Deluxe double · 2 nights · arrives ~2:15 PM by bus","","blue")}{row("user","Kiran M. · 1 guest","Palace-view · 1 night · paid","","blue")}</div>'
    f'<div class="card-m"><div class="kv"><b>This month</b><b>₹1,84,600</b></div><div class="kv"><span>Bookings</span><span>62</span></div><div class="kv"><span>Cancellation rate</span><span>4%</span></div></div></div>'
    + bnav(PARTNER_NAV, "orders")),
    purpose="Hotels manage room availability and prices, see arrivals, and keep in sync with other booking channels.",
    how=["Availability and rates can be edited here or synced from a channel manager.", "Guests booked with transport show their expected arrival time from the trip plan.",
         "Payouts follow the hotel's policy: pay at hotel or prepaid."],
    elements=["7-day availability and price strip", "Channel sync status", "Today's arrivals with ETA", "Month summary"],
    apis=[("PUT", "/v1/stays/{id}/rates", "Rates and availability"), ("GET", "/v1/stays/{id}/arrivals", "Arrivals")], events=["stay.rates_updated"], data=["stays.rates, stays.bookings"], to=["P07"],
    edge=["Overbooking from another channel: the system closes sales here immediately and alerts the hotel.", "Guest bus delayed: arrival time updates automatically."]))

P.append(dict(id="P05", mock=phone(
    appbar("Ride Easy Rentals · Mysuru", back=False) +
    f'<div class="body" style="gap:9px">{sect("FLEET THIS WEEK")}'
    + "".join(f'<div style="display:grid;grid-template-columns:110px 1fr;gap:8px;align-items:center;font-size:12.5px"><b>{n}</b><div style="position:relative;height:16px;background:#F5F7F8;border-radius:4px">'
              + "".join(f'<i style="position:absolute;left:{a}%;width:{b}%;top:0;bottom:0;background:{c};border-radius:4px"></i>' for a, b, c in bars) + "</div></div>"
              for n, bars in [("Hatchback KA09 1", [(0, 30, "#0B7A68"), (45, 40, "#0B7A68")]), ("SUV KA09 2", [(10, 60, "#0B7A68")]), ("Scooter 01", [(20, 35, "#F2A516"), (60, 30, "#0B7A68")]),
                              ("Scooter 02", [(0, 100, "#C3CCD3")]), ("Cruiser 350", [(55, 45, "#0B7A68")])]) +
    f'<div class="xs">■ Booked · <span style="color:#A56A00">■ Handover today</span> · <span style="color:#8796A2">■ In service</span></div>'
    f'{sect("HANDOVER TODAY")}<div class="card-m"><b>Scooter 01 → Ananya R. · 1:45 PM</b><span class="xs">Delivery to Mysuru bus stand · licence verified</span><div class="chips"><span class="chip on">Front ✓</span><span class="chip on">Back ✓</span><span class="chip">Left</span><span class="chip">Right</span><span class="chip">Fuel</span></div>{btn("Start handover photos","sm")}</div></div>'
    + bnav(PARTNER_NAV, "orders")),
    purpose="Rental companies see which vehicles are booked when, and run handovers with photo checks.",
    how=["Each vehicle has a calendar; bookings from the app block it automatically.", "Handover and return follow a photo checklist that both sides see.",
         "Deposits are held by the platform and released or partly charged after return."],
    elements=["Fleet timeline for the week", "Legend", "Today's handover with photo checklist"],
    apis=[("GET", "/v1/rentals/fleet", "Calendar"), ("POST", "/v1/rentals/bookings/{id}/handover", "Photos and odometer")], events=["rental.handed_over"], data=["rentals.*"], to=["P07"],
    edge=["Damage claims need matching photos from handover and return.", "Vehicle marked in service hides it from search for those dates."]))

P.append(dict(id="P06", mock=phone(
    appbar("Malabar Travels · buses", back=False) +
    f'<div class="body" style="gap:9px"><div class="banner ok">{icon("sync")}Seat inventory synced with your booking system (API).</div>'
    f'<div class="list">{row("bus","Kozhikode → Mysuru · 8:00","AC seater · 34 of 40 sold · GPS live",'<span class="tag ok">On time</span>',"brand")}'
    f'{row("bus","Kozhikode → Bengaluru · 21:00","AC sleeper · 28 of 30 sold",'<span class="tag info">Tonight</span>',"blue")}{row("bus","Mysuru → Kozhikode · 14:30","AC seater · 19 of 40 sold",'',"brand")}</div>'
    f'{sect("BOARDING LIST · 8:00")}<div class="list">{row("user","Seats 14, 15 · Ananya R. + 1","KSRTC stand · checked in",icon("check"),"brand")}{row("user","Seat 22 · Faisal K.","Thamarassery · not yet",'',"")}</div>'
    f'<div class="card-m"><div class="kv"><b>Parcels on this bus</b><b>6</b></div><span class="xs">Collect at the stand counter on arrival</span></div></div>'
    + bnav(PARTNER_NAV, "orders")),
    purpose="Bus operators publish trips, sync seats with their own booking system, see boarding lists and carry parcels.",
    how=["Operators connect their reservation system by API, or manage seats here directly.", "Seats sold in the app are pushed to the operator system instantly to avoid double sale.",
         "Conductors check passengers in by scanning the ticket QR, which also works offline.", "A GPS device or the conductor's phone shares live bus location."],
    elements=["Sync status", "Today's trips with seats sold and status", "Boarding list with check-in", "Parcels on board"],
    apis=[("POST", "/v1/operators/trips", "Publish trips"), ("POST", "/v1/operators/inventory/sync", "Seat sync"), ("POST", "/v1/operators/checkin", "Scan ticket")],
    events=["bus.trip_published", "bus.passenger_checked_in"], data=["bus.trips, bus.seats"], to=["P07"],
    edge=["Bus breakdown: operator marks it; passengers are notified and offered the next bus or a refund.", "Seat sync failure stops sales for that trip until fixed."]))

P.append(dict(id="P07", mock=phone(
    appbar("Payouts & reviews", back=False) +
    f'<div class="body" style="gap:9px"><div class="card-m brand"><span class="xs">Next payout · Monday</span><div class="big-num">₹42,380</div><span class="xs">Weekly · to HDFC •••• 8812</span></div>'
    f'<div class="card-m"><div class="kv"><span>Gross sales</span><span>₹58,900</span></div><div class="kv"><span>Commission (18%)</span><span>−₹10,602</span></div><div class="kv"><span>Offers you funded</span><span>−₹3,940</span></div><div class="kv"><span>Tax deducted at source</span><span>−₹1,978</span></div></div>'
    f'{sect("REVIEWS · 4.4 ★")}<div class="list">{row("star_o","★★★★★ “Hot and on time”","Ananya · reply",'',"amber")}{row("star_o","★★ “Biryani was cold”","Rahul · saver delivery · reply",'',"amber")}</div></div>'
    + bnav(PARTNER_NAV, "money")),
    purpose="Payouts, deductions and customer reviews for every partner type.",
    how=["Earnings are computed from the ledger with a line for each deduction.", "Payout schedule depends on partner type and country.", "Partners can reply to reviews once; replies are public."],
    elements=["Next payout", "Breakdown of deductions", "Reviews with reply"],
    apis=[("GET", "/v1/partners/me/payouts", "Payouts"), ("POST", "/v1/reviews/{id}/reply", "Reply")], data=["ledger.*", "reviews"], to=["P02"],
    edge=["Disputed orders are held from the payout until resolved.", "Tax documents are downloadable monthly."]))

# =================================================================== ADMIN
A = []
stc = lambda t: {"Live": st("Live", "ok"), "Pilot": st("Pilot", "info"), "Off": st("Off", ""), "Plan": st("Planned", "warn")}[t]
svcs = ["Rides", "Long trip", "Sharing", "Bus", "Food", "Parcel", "Rentals", "Hotels"]
ctry = [("🇮🇳 India", "Live Live Live Live Live Live Live Live"), ("🇦🇪 UAE", "Live Live Off Pilot Live Live Live Live"), ("🇬🇧 UK", "Live Pilot Live Off Live Live Off Live"),
        ("🇰🇪 Kenya", "Live Live Pilot Live Pilot Live Off Off"), ("🇧🇷 Brazil", "Plan Plan Plan Plan Plan Plan Plan Plan")]
A.append(dict(id="A23", mock=desk("services", "Services & countries",
    '<div class="kpis">' + kpi("Countries live", "4") + kpi("Cities live", "63") + kpi("Services live", "34 of 40") + kpi("Next launch", "Brazil · Q2") + '</div>'
    + card("Service matrix", dtable(["Country"] + svcs + ["Country pack"], [[c] + [stc(x) for x in v.split()] + [f"v{3+i}.{i*2}"] for i, (c, v) in enumerate(ctry)]))
    + grid("1fr 1fr", card("Country pack · Brazil (draft)", dtable(["Item", "Value", ""], [["Currency", "BRL", st("Done", "ok")], ["Languages", "Português", st("Done", "ok")], ["Payments", "Pix, cards", st("Done", "ok")],
        ["Emergency numbers", "190 police · 192 ambulance · 193 fire", st("Done", "ok")], ["Ride licensing rules", "Per city", st("In review", "warn")], ["Data residency", "LGPD · São Paulo region", st("In progress", "warn")]])),
        card("Launch checklist · Brazil", '<div style="display:flex;justify-content:space-between"><b>14 of 20</b><span style="color:#667685">target 1 Apr</span></div><div class="meter" style="height:8px;border-radius:4px;background:#E1E7EC;overflow:hidden"><i style="display:block;height:100%;width:70%;background:#0B7A68"></i></div>'
             + dtable(["Step", "Owner", ""], [["Legal entity & licences", "Legal", st("Done", "ok")], ["Payment gateway contract", "Finance", st("Done", "ok")], ["Map provider check", "Platform", st("Done", "ok")], ["Driver supply 2,000 signed", "Ops", st("1,240", "warn")], ["Support team in Portuguese", "Support", st("Hiring", "warn")]])))),
    purpose="Turn services on or off per country and city, and manage each country's pack and launch checklist.",
    how=["A country pack holds everything local: currency, languages, payments, tax, emergency numbers, document rules, map provider and legal limits.",
         "Services move through Planned → Pilot → Live per city.", "Launching a country is a checklist with owners, so nothing is forgotten.",
         "Apps read the matrix to decide what to show."],
    elements=["Global KPIs", "Country × service matrix", "Country pack draft", "Launch checklist with owners"],
    apis=[("GET", "/v1/admin/countries", "Matrix"), ("PUT", "/v1/admin/countries/{code}/services/{svc}", "Change status"), ("PUT", "/v1/admin/country-packs/{code}", "Edit pack")],
    events=["country.service_changed", "country_pack.published"], data=["configuration.countries, country_packs"], to=["A22", "A25"],
    edge=["A service can't go Live while required pack items are missing.", "Turning a service off finishes active bookings first."]))

A.append(dict(id="A24", mock=desk("partners", "Partner onboarding review", f'<div style="display:flex;gap:14px;flex:1;min-height:0">'
    + card("Queue · 38", dtable(["Partner", "Type", "Waiting"], [["Heritage View Hotel", "Hotel", "4 h"], ["Ride Easy Rentals", "Rental", "6 h"], ["Udupi Corner", "Restaurant", "7 h"], ["Malabar Travels", "Bus", "1 d"], ["Green Leaf Café", "Restaurant", "1 d"]]), style="width:330px")
    + '<div style="flex:1;display:grid;grid-template-columns:1fr 1.2fr;gap:14px">'
    + card("Heritage View Hotel · Mysuru", '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="docimg">Registration</div><div class="docimg">GST certificate</div><div class="docimg">Entrance photo</div><div class="docimg">Room photos (12)</div></div>')
    + card("Checks", dtable(["Check", "Result", ""], [["Business registration", "Valid, matches name", st("Pass", "ok")], ["Tax ID", "Active", st("Pass", "ok")], ["Location", "Pin matches map listing", st("Pass", "ok")],
        ["Photos", "No duplicates online", st("Pass", "ok")], ["Price band", "₹₹ (avg ₹3,300/night)", st("Auto", "info")], ["Bank account", "Name match 96%", st("Pass", "ok")], ["Commission", "18% signed", st("Pass", "ok")]])
        + f'<div style="display:flex;gap:8px">{dbtn("Approve")}{dbtn("Ask for more","g")}{dbtn("Reject","r")}</div>') + "</div></div>"),
    purpose="Review and approve new partners of every type with automated checks.",
    how=["Applications from the partner app enter this queue.", "Registration, tax ID, bank account and location are checked automatically where APIs exist.",
         "Price band is computed, not chosen by the partner.", "Approval activates the partner's listing in the selected cities."],
    elements=["Queue by type and age", "Documents and photos", "Check results", "Approve / ask / reject"],
    apis=[("GET", "/v1/admin/partners/applications", "Queue"), ("POST", "/v1/admin/partners/applications/{id}/decision", "Decision")], events=["partner.approved"],
    data=["partners.applications"], to=["A23"],
    edge=["Food partners without a valid food licence can't be approved.", "A visit or video call can be requested for high-value partners."]))

from superlib import CORRIDOR
_sc = [(x * 0.82 + 10, y * 0.48 + 4) for x, y in CORRIDOR]
dead = corridor_svg(300, 320, pts=_sc, segs=SEGS, towns=[(t, n, "r") for t, n, _ in TOWNS], labels=True)
A.append(dict(id="A25", mock=desk("coverage", "Network coverage map",
    '<div class="kpis">' + kpi("Signal reports today", "4.2 M") + kpi("Known dead zones", "1,184") + kpi("Updated this week", "96") + kpi("Trips warned today", "2,310") + '</div>'
    + f'<div style="display:flex;gap:14px;flex:1;min-height:0"><div class="dcard" style="flex:1"><div class="hd"><b>Kerala · Karnataka border</b><span class="sp"><span class="st">All networks ▾</span></span></div><div class="dmap">{dead}</div></div>'
    + card("Dead zones on long-trip routes", dtable(["Stretch", "Length", "Reports", "Updated"], [["Muthanga → Gundlupet", "30 km", "214", "2 d"], ["Nadukani ghat", "12 km", "88", "5 d"], ["Munnar → Bodi", "18 km", "61", "9 d"], ["Thekkady forest", "9 km", "40", "12 d"]])
           + f'<div style="font-size:12px;color:#667685">Sources: anonymous signal readings from apps (opt-in), driver reports, carrier data where licensed.</div><div style="display:flex;gap:6px">{dbtn("Publish to apps")}{dbtn("Add road restriction","g")}</div>', style="width:400px")
    + "</div>"),
    purpose="The map of where mobile network is missing or weak, used to warn travellers and plan offline packs.",
    how=["Apps record signal strength and network type with location (opt-in, anonymous) and upload in batches.",
         "Readings are aggregated into map cells per network; cells with no signal over many readings become dead zones.",
         "Dead zones are joined with roads to produce stretches with length and confidence.", "Ops can add road restrictions such as night closures."],
    elements=["Coverage KPIs", "Map with dead and weak zones", "Dead zones on long-trip routes", "Data sources", "Publish and add restriction"],
    apis=[("POST", "/v1/coverage/readings", "Batch signal readings (apps)"), ("GET", "/v1/admin/coverage/zones?region=", "Zones"), ("POST", "/v1/admin/road-rules", "Add restriction")],
    events=["coverage.zones_published"], data=["coverage.readings (raw, 30 days)", "coverage.tiles (aggregated)", "road_rules"], to=["A26"],
    edge=["Raw readings are deleted after 30 days; only aggregates are kept.", "Zones with few readings are marked low confidence."]))

A.append(dict(id="A26", mock=desk("intercity", "Long-distance & sharing",
    '<div class="kpis">' + kpi("Long trips today", "3,420") + kpi("Seat fill rate", "78%", "+6% vs last month") + kpi("Parcels on trips", "1,180", "attach 34%") + kpi("Bus seats sold", "12,940") + '</div>'
    + card("Top corridors", dtable(["Corridor", "Distance", "Trips/day", "Seat fill", "Avg seat price", "Parcel attach", "Dead zone"],
        [["Hyderabad → Vijayawada", "275 km", "410", "82%", "₹640", "41%", "—"], ["Bengaluru → Mysuru", "145 km", "620", "86%", "₹390", "38%", "—"], ["Kozhikode → Mysuru", "215 km", "96", "74%", "₹720", "29%", st("30 km", "warn")],
         ["Chennai → Puducherry", "150 km", "280", "79%", "₹420", "33%", "—"], ["Dubai → Abu Dhabi", "140 km", "190", "71%", "AED 45", "22%", "—"]]))
    + grid("1fr 1fr", card("Sharing rules · India", dtable(["Rule", "Value"], [["Max seat price (private cars)", "Cost sharing: fuel + tolls ÷ seats"], ["Max pickup detour", "5 km"], ["Parcel max weight", "10 kg per parcel"], ["Women-only seat", "Allowed"], ["Driver rest", "2 h per 10 h driving"]])),
        card("Bus operators", dtable(["Operator", "Routes", "Sync", "On-time"], [["Malabar Travels", "18", st("API", "ok"), "91%"], ["State transport (via aggregator)", "240", st("API", "ok"), "84%"], ["City Express", "12", st("Manual", "warn"), "88%"]])))),
    purpose="Manage long-distance supply: corridors, seat sharing, parcels on trips, bus operators and the rules for each country.",
    how=["Corridor stats show where demand and supply are and where dead zones affect trips.", "Sharing rules are country configuration enforced by pricing and dispatch.",
         "Bus operators are monitored for sync health and punctuality."],
    elements=["Long-trip KPIs", "Corridor table", "Sharing rules", "Bus operators"],
    apis=[("GET", "/v1/admin/intercity/corridors", "Corridors"), ("PUT", "/v1/admin/sharing/rules/{country}", "Rules")], data=["sharing.*", "bus.*"], to=["A25", "A09"],
    edge=["Rules that would break local carpool law can't be saved.", "Operators with on-time below 75% are ranked lower."]))

kan = lambda t, n, k: f'<div class="kpi"><span class="l">{t}</span><span class="v">{n}</span><span class="d {"bad" if k else ""}">{"" if not k else k}</span></div>'
A.append(dict(id="A27", mock=desk("orders", "Food & parcel orders",
    '<div class="kpis">' + kan("Placed", "312", "") + kan("Preparing", "841", "") + kan("Ready, waiting", "96", "22 over 5 min") + kan("On the way", "1,204", "") + kan("Delivered today", "48,920", "") + kan("Late > 15 min", "58", "1.2%") + '</div>'
    + grid("1.4fr 1fr", card("Late orders", dtable(["Order", "Type", "Restaurant / sender", "Late by", "Reason", ""], [["#4398", "Food", "The Grill Room", "22 min", "Kitchen delay", dbtn("Credit ₹50", "g")], ["#4401", "Food", "Biryani House", "17 min", "Partner rain delay", dbtn("Credit ₹50", "g")],
        ["PRC-88190", "Parcel", "Anil (city)", "31 min", "Receiver unreachable", dbtn("Call", "g")], ["#4405", "Food", "Udupi Corner", "16 min", "Batched, 2nd drop", dbtn("Credit ₹30", "g")]])),
        card("Restaurants needing attention", dtable(["Restaurant", "Issue", ""], [["Spice Route", "Paused 45 min", st("Paused", "warn")], ["Pizza Point", "Rejected 6 today", st("Call", "err")], ["Tea Stall 9", "Prep time 2× normal", st("Watch", "warn")]])))
    + card("Orders per 15 min · today", line_chart(1000, 120, [[40, 60, 90, 150, 260, 420, 380, 300, 260, 290, 410, 620, 700, 640]]))),
    purpose="Live board for food and parcel orders: where orders are stuck and which partners need help.",
    how=["Counts update every few seconds from order events.", "Late orders are flagged with the main cause from the timeline.", "Ops can credit customers, call partners or reassign delivery."],
    elements=["Order stage counts", "Late orders with reasons and actions", "Restaurants needing attention", "Orders over time"],
    apis=[("WS", "/ws/admin/orders", "Live counts"), ("POST", "/v1/admin/orders/{id}/credit", "Credit customer")], data=["orders.*"], to=["A24", "A12"],
    edge=["Credits above limits need finance approval.", "Weather alerts raise late thresholds automatically."]))

A.append(dict(id="A28", mock=desk("deals", "Deals & loyalty",
    '<div class="kpis">' + kpi("Pass subscribers", "182,400", "+9% m/m") + kpi("Coupon spend this month", "₹1.8 Cr", "62% of budget") + kpi("Savings given to users", "₹3.4 Cr") + kpi("Abuse blocked", "₹21 L", "", True) + '</div>'
    + grid("1.3fr 1fr", card("Campaigns", dtable(["Campaign", "Service", "Budget used", "Orders", "Cost / order"], [["RIDE50", "Rides", "71%", "84,210", "₹41"], ["BIRYANI40 (partner funded)", "Food", "—", "12,880", "₹0"], ["Share a seat −40%", "Sharing", "48%", "9,410", "₹63"], ["Off-peak 10%", "Rides", "33%", "41,200", "₹18"]])),
        card("New coupon", field("Code", "MONSOON25") + field("Who", "Riders · Kerala · inactive 30 days") + field("Value", "25% up to ₹60 · rides and long trips") + field("Stacking", "Not with Pass discount · max 1 per order") + field("Budget", "₹5,00,000 · ends 31 Oct") + f'<div style="display:flex;gap:6px">{dbtn("Create")}{dbtn("Simulate cost","g")}</div>'))),
    purpose="Run coupons, cashback, the subscription pass and savings features within budget, and stop abuse.",
    how=["Every coupon has audience, value, stacking rules, budget and end date.", "The simulator estimates cost from past redemption rates before launch.",
         "Spending stops automatically at budget.", "Fraud rules block multi-account coupon farming."],
    elements=["Loyalty KPIs", "Campaign performance", "New coupon form with stacking rules and budget"],
    apis=[("POST", "/v1/admin/coupons", "Create"), ("POST", "/v1/admin/coupons/simulate", "Estimate cost")], events=["coupon.created"], data=["promotions.*"], to=["A21", "A14"],
    edge=["Partner-funded offers need the partner's agreement in the partner app.", "A coupon can't make a driver's or partner's earning lower."]))
