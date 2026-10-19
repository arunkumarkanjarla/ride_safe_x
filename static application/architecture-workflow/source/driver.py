from components import *
from rider import mapbody, W, H, KEYPAD

ROUTE_P = [(70, 560), (70, 400), (140, 400), (140, 300)]
ROUTE_T = [(140, 560), (140, 400), (250, 400), (250, 245), (250, 150)]
HEAT = [(240, 230, 90), (90, 470, 70), (200, 540, 60)]
def step(state, title, sub):
    ic = {"ok": icon("check", 14, 3), "now": icon("clock", 14, 2.4), "": ""}[state]
    return f'<div class="s"><span class="dot {state}">{ic}</span><span><b>{title}</b><div class="xs">{sub}</div></span></div>'

S = []

S.append(dict(id="D01", mock=phone(
    appbar("", back=False) +
    f'<div class="body"><div class="card-m brand" style="gap:4px"><span class="xs">{B()} Driver</span><div class="h1" style="color:#fff">Drive and earn on your schedule</div><span class="xs">Keep 100% of every fare · small daily fee · 24×7 support</span></div>'
    f'<div class="h2">Log in or sign up</div><div style="display:flex;gap:8px"><div class="inp" style="width:92px"><label>Country</label><div class="box">🇮🇳 +91</div></div>{inp("Mobile number","90000 12345",focus=True)}</div>'
    f'{btn("Send OTP")}<div class="xs" style="text-align:center">Already driving with a fleet? Ask your fleet owner for an invite code.</div><div class="fill"></div>{KEYPAD}</div>'),
    purpose="Login and sign-up entry for drivers, using the same OTP flow as riders but a separate driver role.",
    how=["Phone number and OTP work as in the rider app.", "A number can be both a rider and a driver; the role in the token decides which APIs are allowed.", "New drivers go to registration, existing drivers to home."],
    elements=["Earnings pitch", "Country code and phone", "Send OTP", "Fleet invite hint", "Numeric keypad"],
    apis=[("POST", "/v1/auth/otp", "Send OTP"), ("POST", "/v1/auth/verify?role=driver", "Verify and issue driver token")], events=["user.logged_in"],
    data=["identity.users", "identity.devices"], to=["D02", "D05"],
    edge=["One active driver session per phone; logging in elsewhere logs out the old device.", "Device must pass integrity checks (Play Integrity / App Attest) to go online."]))

S.append(dict(id="D02", mock=phone(
    appbar("Become a driver partner") +
    f'<div class="body"><div class="xs" style="font-weight:700">STEP 1 OF 4 · ABOUT YOU</div><div class="progress"><i style="width:25%"></i></div>'
    f'{inp("Full name (as on licence)","Arjun Kumar")}{inp("City","Hyderabad ▾")}'
    f'<div class="inp"><label>What will you drive?</label><div class="chips"><span class="chip">{icon("bike",14)} Bike</span><span class="chip">{icon("auto",14)} Auto</span><span class="chip on">{icon("car",14)} Cab</span></div></div>'
    f'<div class="inp"><label>Do you own the vehicle?</label><div class="chips"><span class="chip on">Yes, my own</span><span class="chip">Fleet vehicle</span></div></div>'
    f'{inp("Languages you speak","Telugu, Hindi, English")}{inp("Referral code","DRV-RAVI22",ph=True)}<div class="fill"></div>{btn("Next")}</div>'),
    purpose="Collects basic details and the vehicle type, which decides the documents needed next.",
    how=["City decides local rules: which documents, which vehicle types, which fees.", "Fleet drivers are linked to a fleet owner who manages the vehicle.", "Progress is saved, so the driver can come back later."],
    elements=["Step indicator", "Name, city", "Vehicle type", "Ownership", "Languages (for rider matching and chat)", "Referral code", "Next"],
    apis=[("POST", "/v1/drivers", "Create driver profile (draft)"), ("GET", "/v1/cities/{id}/requirements", "Documents needed for this city and vehicle")],
    events=["driver.registered"], data=["drivers.drivers (status DRAFT)"], to=["D03"],
    edge=["City not served yet: join a waitlist.", "Minimum age and licence age checked from the licence later."]))

doc = lambda n, s, t, k, ic="doc", tone="": li(ic, n, s, f'<span class="tag {k}">{t}</span>', tone)
S.append(dict(id="D03", mock=phone(
    appbar("Upload documents") +
    f'<div class="body"><div class="xs" style="font-weight:700">STEP 2 OF 4 · DOCUMENTS</div><div class="progress"><i style="width:50%"></i></div>'
    f'<div class="list">{doc("Driving licence","TS09 2019 0012345 · till 2034","Uploaded","ok","id","brand")}{doc("Vehicle RC","TS 09 EA 4521","Uploaded","ok","car","brand")}'
    f'{doc("Insurance","Photo unclear, please retake","Rejected","err","shield","red")}{doc("Permit","Commercial permit","Upload","info")}'
    f'{doc("Fitness certificate","Vehicles older than 8 years","Upload","info")}{doc("Police verification","Certificate or consent to check","In review","warn","gov","amber")}{doc("Profile photo","Clear face, no sunglasses","Uploaded","ok","user","brand")}</div>'
    f'<div class="fill"></div>{btn("Submit for review")}</div>'),
    purpose="Upload every document the city requires, with a clear status for each.",
    how=["Camera opens with an edge guide; photos are checked for blur and glare on the phone.", "Files go straight to object storage with a signed URL; the API only stores the key.", "OCR reads number and expiry date; the driver confirms them.", "Submit sends the set to the KYC review queue."],
    elements=["Step indicator", "Document list with status and reason", "Submit for review"],
    apis=[("POST", "/v1/drivers/me/documents/upload-url", "Signed upload URL"), ("POST", "/v1/drivers/me/documents", "Save document metadata"), ("POST", "/v1/drivers/me/submit", "Send for review")],
    events=["driver.document_uploaded", "kyc.submitted"], data=["drivers.driver_documents", "MinIO kyc-documents"], to=["D04"],
    edge=["Rejected documents show the reviewer's reason.", "Same licence already used by another account: sent to Fraud.", "Document numbers are encrypted at rest."]))

S.append(dict(id="D04", mock=phone(
    appbar("Verification status", back=False) +
    f'<div class="body"><div class="banner warn">{icon("clock")}Usually done in 2–5 working days. We\'ll notify you at each step.</div>'
    f'<div class="steps-m">{step("ok","Documents submitted","26 Sep, 4:10 PM")}{step("ok","Documents checked","Licence, RC, photo approved")}'
    f'{step("now","Background check","Police verification in progress")}{step("","Training","12-minute safety and app video")}{step("","Vehicle inspection","At a partner centre or by video")}{step("","Account active","Go online and start earning")}</div>'
    f'<div class="fill"></div>{btn("Watch training now","soft","eye")}<div class="xs" style="text-align:center">Questions? Call driver support</div></div>'),
    purpose="Shows where the driver is in onboarding and what's left, so they don't need to call support.",
    how=["Each step updates when the KYC or operations team decides.", "Training can be done while waiting; a short quiz confirms it.", "When all steps pass, the driver status becomes ACTIVE and home unlocks."],
    elements=["Expected time", "Step timeline with state", "Training shortcut", "Support link"],
    apis=[("GET", "/v1/drivers/me/onboarding", "Status of each step")], events=["kyc.decided", "driver.activated"],
    data=["kyc.verifications", "drivers.drivers"], to=["D03", "D05"],
    edge=["A step rejected: jumps back to the related upload with the reason.", "Background check result is never shown in detail, only pass or contact support."]))

S.append(dict(id="D05", mock=phone(mapbody(
    map_svg(W, H, me=(170, 330), dim=False),
    top=f'<div class="floating"><span class="av" style="width:36px;height:36px;font-size:13px">AK</span><div style="flex:1"><b>Arjun K.</b><div class="xs">★ 4.9 · TS 09 EA 4521</div></div><span class="onpill off"><i></i>Offline</span></div>'
        f'<div class="banner warn" style="margin:0 14px">{icon("alert")}Insurance expires in 12 days. Upload the new one.</div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="row2"><div class="card-m"><span class="xs">Today</span><b style="font-size:20px">₹0</b></div><div class="card-m"><span class="xs">Trips</span><b style="font-size:20px">0</b></div><div class="card-m"><span class="xs">This week</span><b style="font-size:20px">₹8,420</b></div></div>'
          f'<div class="slide"><i>{icon("power",22)}</i>Slide to go online</div></div>',
    after=bnav(DRIVER_NAV, "home"))),
    purpose="Driver home while off duty: status, warnings, today's numbers and the go-online control.",
    how=["Going online runs checks: documents valid, no blocks, selfie match for the shift, vehicle selected.", "If a check fails, the slider explains what to fix.", "Once online, location sharing starts and the driver can receive offers."],
    elements=["Driver card with rating and plate", "Offline status", "Document warning", "Today and weekly summary", "Slide to go online", "Bottom navigation"],
    apis=[("PATCH", "/v1/drivers/me/status", "Go online / offline"), ("POST", "/v1/drivers/me/selfie-check", "Shift selfie")], events=["driver.status_changed"],
    data=["drivers.drivers", "driver:{id}:state in Redis"], to=["D06", "D17", "D13", "D16"],
    edge=["Expired mandatory document: going online is blocked.", "Background location permission required on Android to receive rides with the screen off."]))

S.append(dict(id="D06", mock=phone(mapbody(
    map_svg(W, H, me=(170, 330), heat=HEAT),
    top=f'<div class="floating"><span class="onpill on"><i></i>Online</span><div style="flex:1" class="xs">Finding rides near you</div><span class="ib">{icon("settings")}</span></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="row2"><div class="card-m"><span class="xs">Today</span><b style="font-size:20px">₹1,240</b></div><div class="card-m"><span class="xs">Trips</span><b style="font-size:20px">7</b></div><div class="card-m"><span class="xs">Online</span><b style="font-size:20px">5h 20m</b></div></div>'
          f'<div class="banner warn">{icon("chart")}High demand near Hitec City · 1.3× now</div>'
          f'<div class="card-m"><div class="kv"><b>Evening quest</b><span>4 of 7 trips</span></div><div class="progress"><i style="width:57%"></i></div><span class="xs">3 more trips by 10 PM for ₹150 bonus</span></div>{btn("Go offline","ghost sm")}</div>',
    after=bnav(DRIVER_NAV, "home"))),
    purpose="Online and waiting: shows where demand is and progress towards bonuses.",
    how=["Location is sent every 10 s while idle.", "Demand heat map refreshes every 2 minutes from the demand model.", "Offers arrive over WebSocket with a push notification as backup.", "Driver can set a destination filter to get rides towards home."],
    elements=["Online status", "Demand heat map", "Today's earnings, trips, hours", "Surge hint", "Quest progress", "Go offline"],
    apis=[("WS", "/ws/driver", "Location up, offers down"), ("GET", "/v1/drivers/me/heatmap", "Demand zones")], events=["location.updated"],
    data=["Redis drivers:geo", "Demand forecast"], to=["D07", "D05"],
    edge=["Network drops: app keeps the online state for 60 s, then marks offline on the server.", "Driver online 12 hours: forced break for rest, as many regulations require."]))

S.append(dict(id="D07", mock=phone(mapbody(
    map_svg(W, H, route=ROUTE_P + [(140, 245), (250, 245), (250, 150)], pickup=(140, 300), drop=(250, 150), me=(70, 560), dim=True, labels=False),
    sheet=f'<div class="sheet"><div style="display:flex;align-items:center;gap:12px"><div class="ring"><span>12</span></div><div style="flex:1"><div class="h1">₹236</div><div class="xs">You earn about ₹189 · Cab · UPI</div></div><span class="chip amber">1.2×</span></div>'
          f'<div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Pickup · 1.2 km · 4 min</b><span>Gate 2, Lumbini Apartments, Banjara Hills</span></span></div><div class="vline"></div>'
          f'<div class="loc"><span class="d sq"></span><span class="tx"><b>Drop · 9.8 km · 27 min</b><span>Hitec City Metro Station</span></span></div></div>'
          f'<div class="kv"><span>Rider</span><span>★ 4.8 · 112 rides</span></div><div class="row2">{btn("Decline","ghost")}{btn("Accept","", "check")}</div></div>')),
    purpose="A ride offer with everything needed to decide in 15 seconds.",
    how=["Offer arrives with a loud sound and vibration, even in the background.", "The countdown matches the server's offer timeout.", "Accept is checked on the server against the driver lock; the first valid accept wins.", "Decline or timeout passes the ride to the next driver."],
    elements=["Countdown", "Fare and estimated earning", "Surge", "Pickup distance and time", "Drop distance", "Rider rating", "Decline and accept"],
    apis=[("WS", "offer message", "Offer received"), ("POST", "/v1/offers/{id}/accept", "Accept"), ("POST", "/v1/offers/{id}/decline", "Decline")],
    events=["dispatch.accepted", "dispatch.declined"], data=["dispatch.offers"], to=["D08", "D06"],
    edge=["Accepted too late: 'Ride taken by another driver'.", "Many declines in a row lower priority for a short time, never block the driver.", "Drop address is shown in full so drivers can decide fairly (required in several markets)."]))

S.append(dict(id="D08", mock=phone(mapbody(
    map_svg(W, H, route=ROUTE_P, pickup=(140, 300), me=(70, 560), labels=False),
    top=f'<div class="turn">{icon("nav",26)}<div><div class="big">300 m</div><div>Turn right onto Road 12</div></div></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;align-items:center"><div style="flex:1"><div class="h2">Picking up Ananya</div><div class="xs">4 min · 1.2 km</div></div><span class="ib">{icon("chat")}</span>&nbsp;<span class="ib">{icon("phone")}</span></div>'
          f'<div class="loc"><span class="d"></span><span class="tx"><b>Gate 2, Lumbini Apartments</b><span>Note from rider: near the security cabin</span></span></div>'
          f'<div class="slide" style="opacity:.55"><i>{icon("check",22)}</i>Slide when arrived</div></div>')),
    purpose="Turn-by-turn navigation to the pickup point with ways to reach the rider.",
    how=["Navigation uses the in-app SDK, or hands off to Google Maps / Waze if the driver prefers.", "Location is sent every 4 s so the rider sees the car move.", "'Arrived' unlocks within 100 m of pickup."],
    elements=["Next turn banner", "Route to pickup", "Rider name, ETA", "Chat and call", "Pickup note", "Arrived slider"],
    apis=[("WS", "/ws/driver", "Location every 4 s"), ("POST", "/v1/rides/{id}/arrived", "Mark arrived")], events=["ride.driver_arrived"],
    data=["Ride", "Route"], to=["D09", "D18"],
    edge=["Rider cancels: full-screen notice and cancellation fee credited if rules apply.", "Driver far off the route: asked if they want to cancel instead."]))

S.append(dict(id="D09", mock=phone(
    appbar("At pickup", back=False, right='<span class="chip amber">Waiting 02:14</span>') +
    f'<div class="body"><div class="li" style="padding:0;border:none"><span class="av">AR</span><span class="tx"><b>Ananya R.</b><span>★ 4.8 · Cab · UPI</span></span><span class="ib">{icon("phone")}</span></div>'
    f'<div class="h2">Enter the rider\'s 4-digit code</div><div class="otp"><span>4</span><span>8</span><span class="f">2</span><span></span></div>'
    f'<div class="xs" style="text-align:center">Ask the rider for the code shown in their app. Never start a trip without it.</div>{btn("Start trip")}'
    f'<div class="banner info">{icon("clock")}Waiting is free for 3 min, then ₹1/min. You can cancel for no-show after 7 min.</div><div class="fill"></div>{KEYPAD}</div>'),
    purpose="Starts the trip only when the right rider is in the car, confirmed by their OTP.",
    how=["Waiting timer starts at 'arrived'.", "The OTP is checked on the server; three wrong tries alert Safety.", "Correct OTP sets TRIP_STARTED and switches to trip navigation."],
    elements=["Rider details and call", "OTP entry", "Start trip", "Waiting policy", "Keypad"],
    apis=[("POST", "/v1/rides/{id}/start", "Start with OTP")], events=["ride.started"], data=["rides.rides", "rides.ride_events"], to=["D10"],
    edge=["No-show after 7 min: cancel with fee to the driver.", "OTP entry works offline and syncs later if the trip already started."]))

S.append(dict(id="D10", mock=phone(mapbody(
    map_svg(W, H, route=ROUTE_T, drop=(250, 150), me=(140, 470), labels=False),
    top=f'<div class="turn">{icon("nav",26)}<div><div class="big">1.2 km</div><div>Continue on Ring Road</div></div></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;align-items:center"><div style="flex:1"><div class="h2">Dropping Ananya</div><div class="xs">Hitec City Metro · 18 min · 6.2 km</div></div><span class="chip red">{icon("alert",13)} SOS</span></div>'
          f'<div class="kv"><span>Fare so far</span><b>₹162</b></div><div class="slide red"><i>{icon("flag",22)}</i>Slide to end trip</div></div>')),
    purpose="Navigation to the destination with the fare meter, SOS and end-trip control.",
    how=["Location every 3 s; points are buffered on the phone if the network drops.", "Stops and destination changes by the rider appear as a banner.", "End trip sends the final GPS trail; the server computes the fare."],
    elements=["Next turn", "Route to drop", "Rider and ETA", "SOS", "Running fare", "End trip slider"],
    apis=[("WS", "/ws/driver", "Location every 3 s"), ("POST", "/v1/rides/{id}/end", "End trip with trail")], events=["ride.completed"],
    data=["location.ride_locations"], to=["D11", "D18", "D19"],
    edge=["End trip far from the destination: asks for a reason.", "Toll paid: add amount with a photo of the receipt."]))

S.append(dict(id="D11", mock=phone(
    appbar("", back=False) +
    f'<div class="body"><div class="center"><span class="ic brand xl" style="width:64px;height:64px">{icon("check",30,2.4)}</span><div class="h1">Trip complete</div><div class="sub">Paid online by UPI · nothing to collect</div></div>'
    f'<div class="card-m"><div class="kv"><span>Rider paid</span><span>₹248.00</span></div><div class="kv"><span>Taxes</span><span>−₹11.90</span></div><div class="kv"><span>Commission</span><span>₹0.00</span></div>'
    f'<div class="kv"><span>Coupon (paid by {B()})</span><span style="color:#0B7A68">+₹37.00</span></div><div class="hr"></div><div class="kv"><b>You earned · 100% of fare</b><b style="font-size:18px;color:#0B7A68">₹273.10</b></div></div>'
    f'<div class="banner info">{icon("cash")}No cut from any ride. Your only charge is one daily fee of ₹15 at midnight, and only if you drove today.</div><div class="fill"></div>{btn("Rate rider")}</div>'),
    purpose="Shows what the rider paid, the tax and what the driver earned: 100% of the fare, with no commission.",
    how=["Final fare comes from the server after end trip.", "Online payments need no action; cash rides need 'Cash received'.", "Earnings post to the driver ledger when payment completes.", "Cash rides show 'Collect ₹248'; only the GST is settled from the wallet."],
    elements=["Completion message", "Payment method", "Earning breakdown", "Cash guidance", "Rate rider"],
    apis=[("GET", "/v1/rides/{id}/driver-summary", "Breakdown"), ("POST", "/v1/rides/{id}/cash-collected", "Confirm cash")], events=["payment.cash_collected"],
    data=["ledger.entries"], to=["D12"],
    edge=["Rider disputes cash: support can check the confirmation time and GPS.", "Coupon discounts are paid by the platform, never taken from the driver.", "The daily fee is never shown per trip; it is charged once a day (D27)."]))

S.append(dict(id="D12", mock=phone(
    appbar("", back=False, right='<span class="sub">Skip</span>') +
    f'<div class="body center"><div class="av lg">AR</div><div class="h2">Rate Ananya</div><div class="stars">{icon("star")*5}</div>'
    f'<div class="chips" style="justify-content:center"><span class="chip on">Polite</span><span class="chip on">On time</span><span class="chip">Clear directions</span></div>'
    f'<div class="xs">Problem? Pick 1–3 stars to report behaviour, damage or safety issues.</div><div class="fill"></div><div style="width:100%">{btn("Done")}</div></div>'),
    purpose="Driver rates the rider; low ratings with a reason feed rider quality checks.",
    how=["Same component as the rider app with driver-side reasons.", "A rider under 4.0 may see warnings; very low ratings go to review.", "Returns the driver to online or offline, as before the trip."],
    elements=["Rider photo", "Stars", "Reason chips", "Done and skip"],
    apis=[("POST", "/v1/rides/{id}/rider-rating", "Save rating")], events=["ride.rider_rated"], data=["rides.ratings"], to=["D06"],
    edge=["Damage report asks for photos and opens a ticket.", "Ratings are anonymous to the rider."]))

bars = '<div class="bars">' + "".join(f'<i class="{"on" if i==4 else ""}" style="height:{h}%"></i>' for i, h in enumerate([55, 72, 40, 88, 95, 64, 30])) + '</div><div class="bars-l">' + "".join(f"<span>{d}</span>" for d in "MTWTFSS") + "</div>"
S.append(dict(id="D13", mock=phone(
    appbar("Earnings", back=False, right='<span class="chip">This week ▾</span>') +
    f'<div class="body"><div><span class="xs">22 – 28 Sep</span><div class="big-num">₹14,730</div></div>{bars}'
    f'<div class="row2"><div class="card-m"><span class="xs">Trips</span><b>68</b></div><div class="card-m"><span class="xs">Online</span><b>41h</b></div><div class="card-m"><span class="xs">Tips</span><b>₹340</b></div></div>'
    f'<div class="list">{li("car","Trip earnings","68 trips","<b>₹13,480</b>")}{li("trophy","Quests & bonuses","2 completed","<b>₹1,000</b>","amber")}{li("gift","Tips","14 riders","<b>₹340</b>")}{li("doc","Daily fees","6 driving days × ₹15 · no commission","<b>−₹90</b>","amber")}</div></div>'
    + bnav(DRIVER_NAV, "earn")),
    purpose="Earnings by day and week, with trips, hours and where the money came from.",
    how=["Numbers come from the ledger, grouped by day in the city's time zone.", "Tapping a bar lists that day's trips.", "Week, month and custom ranges are available."],
    elements=["Period selector", "Total", "Daily bar chart", "Trips, hours, tips", "Breakdown by source"],
    apis=[("GET", "/v1/drivers/me/earnings?from&to", "Totals and daily series")], data=["ledger.entries (read replica)"], to=["D14", "D15", "D16"],
    edge=["Pending payments are shown separately until settled.", "Daily fees are shown as their own line so totals are honest; days without rides show ₹0."]))

S.append(dict(id="D14", mock=phone(
    appbar("Wallet & payouts") +
    f'<div class="body"><div class="card-m brand"><span class="xs">Available to pay out</span><div class="big-num">₹6,480</div><span class="xs">Next automatic payout: tomorrow, 10 AM</span>{btn("Cash out now · ₹10 fee","amber sm")}</div>'
    f'<div class="list">{li("card","HDFC Bank •••• 4521","Verified · IFSC HDFC0001234",icon("check"),"brand")}{li("doc","Daily fees this week","6 days × ₹15 · deducted from this payout","<b>−₹90</b>","amber")}</div>'
    f'<div class="xs" style="font-weight:700;letter-spacing:.06em">PAYOUTS</div><div class="list">{li("check","21 Sep","Paid · UTR 4312…9921","<b>₹7,210</b>","brand")}{li("check","14 Sep","Paid","<b>₹6,905</b>","brand")}{li("clock","7 Sep","Failed · bank rejected, retried 8 Sep","<b>₹5,880</b>","red")}</div></div>'),
    purpose="Driver balance, bank account, instant cash-out and payout history.",
    how=["Balance = settled earnings (100% of fares) − daily fees − GST on cash rides − adjustments.", "Automatic payouts run daily or weekly per city settings.", "Instant cash-out uses the gateway payouts API for a small fee.", "Bank account changes need OTP and a 24-hour cool-down to stop account takeover fraud."],
    elements=["Available balance", "Next payout", "Cash out", "Bank account", "Daily fees", "Payout history with status"],
    apis=[("GET", "/v1/drivers/me/wallet", "Balance"), ("POST", "/v1/drivers/me/payouts", "Instant payout"), ("PUT", "/v1/drivers/me/bank-account", "Change account")],
    events=["payout.requested", "payout.sent"], data=["ledger.accounts", "ledger.payouts"], to=["D13"],
    edge=["Negative balance (unpaid daily fees): taken from the next earnings, no interest; after 3 unpaid days the driver is asked to pay before going online.", "Payout failed: reason and automatic retry."]))

S.append(dict(id="D15", mock=phone(
    appbar("Incentives") +
    f'<div class="body"><div class="card-m"><div class="kv"><b>Weekend quest</b><span class="tag ok">Active</span></div><span class="xs">Complete 30 trips Sat–Sun</span><div class="progress"><i style="width:60%"></i></div><div class="kv"><span>18 / 30 trips</span><b>₹1,500</b></div></div>'
    f'<div class="card-m"><div class="kv"><b>Morning peak boost</b><span class="tag info">Mon–Fri</span></div><span class="xs">1.2× on trips 8–10 AM in Hitec City and Gachibowli</span></div>'
    f'<div class="card-m"><div class="kv"><b>Airport queue</b><span class="tag">Live</span></div><span class="xs">You are #14 in the queue at RGIA · about 25 min</span></div>'
    f'<div class="card-m brand"><b>Refer a driver, earn ₹2,000</b><span class="xs">When they finish 50 trips in 30 days</span>{btn("Share code","amber sm","share")}</div></div>'),
    purpose="Bonuses the driver can earn, with live progress.",
    how=["Ops create campaigns with budgets; the incentive model targets them per driver.", "Progress updates after each completed trip event.", "Bonuses are credited to the ledger when the goal is met."],
    elements=["Quest cards with progress", "Peak boosts", "Airport queue position", "Referral"],
    apis=[("GET", "/v1/drivers/me/incentives", "Active incentives and progress")], data=["promotions.campaigns"], to=["D13"],
    edge=["Trips flagged by Fraud don't count until cleared.", "Terms shown before joining any quest."]))

trow = lambda t, r, e, k, s: f'<div class="li"><span class="ic">{icon("car")}</span><span class="tx"><b>{r}</b><span>{t}</span></span><span style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><b>{e}</b><span class="tag {k}">{s}</span></span></div>'
S.append(dict(id="D16", mock=phone(
    appbar("Trips", back=False) +
    f'<div class="body"><div class="chips"><span class="chip on">Today</span><span class="chip">Week</span><span class="chip">Month</span></div>'
    f'<div class="list">{trow("5:45 PM · 9.9 km","Banjara Hills → Hitec City","₹225.88","ok","Completed")}{trow("4:50 PM · 4.1 km","Ameerpet → Punjagutta","₹96.40","ok","Completed")}'
    f'{trow("4:12 PM","Rider cancelled after 6 min","₹40.00","warn","Cancel fee")}{trow("3:30 PM · 12.3 km","Kondapur → Airport road","₹288.10","ok","Completed")}{trow("2:05 PM · 2.2 km","Madhapur → Kavuri Hills","₹58.20","info","Cash")}</div></div>'
    + bnav(DRIVER_NAV, "trips")),
    purpose="Every trip with earnings, including cancellation fees.",
    how=["Paged list from the rides read replica.", "Tapping a trip shows the route, fare breakdown and help options.", "Disputes can be raised from a trip for 7 days."],
    elements=["Period filter", "Trip rows with route, distance, earning, status", "Bottom navigation"],
    apis=[("GET", "/v1/drivers/me/trips", "Trip list")], data=["rides.rides"], to=["D20"],
    edge=["Trips in dispute show a 'Under review' tag."]))

S.append(dict(id="D17", mock=phone(
    appbar("Documents") +
    f'<div class="body"><div class="banner err">{icon("alert")}Pollution certificate expired. You can\'t go online until it\'s renewed.</div>'
    f'<div class="list">{doc("Pollution certificate (PUC)","Expired 25 Sep 2026","Expired","err","doc","red")}{doc("Insurance","Expires 9 Oct 2026 · 12 days","Renew soon","warn","shield","amber")}'
    f'{doc("Permit","Valid till 14 Mar 2027","Valid","ok","doc","brand")}{doc("Driving licence","Valid till 2034","Valid","ok","id","brand")}{doc("Fitness certificate","Valid till 2 Jan 2027","Valid","ok","car","brand")}</div>'
    f'<div class="fill"></div>{btn("Upload new PUC","", "upload")}</div>'),
    purpose="All documents with expiry dates, reminders and blocks when something mandatory expires.",
    how=["A nightly job checks expiry dates: reminders at 30, 15, 7 and 1 day.", "On expiry of a mandatory document the driver can't go online.", "A new upload goes to KYC review; old document stays until approved."],
    elements=["Blocking banner", "Document list with expiry and status", "Upload button"],
    apis=[("GET", "/v1/drivers/me/documents", "Documents and expiry"), ("POST", "/v1/drivers/me/documents", "Upload renewal")], events=["driver.document_expiring", "driver.blocked_expired_document"],
    data=["drivers.driver_documents"], to=["D03", "D05"],
    edge=["Expiry during an online shift: the current trip finishes, then the driver is taken offline.", "Which documents are mandatory is set per city."]))

S.append(dict(id="D18", mock=phone(
    appbar("Emergency") +
    f'<div class="body center" style="gap:12px"><div class="sos-ring">SOS</div><div class="sub">Hold 2 seconds to alert the safety team</div>'
    f'<div class="list" style="width:100%;text-align:left">{li("users","Rider behaviour","Threat, harassment, damage","","red")}{li("car","Accident","Anyone hurt? We\'ll guide you","","red")}'
    f'{li("settings","Vehicle breakdown","We\'ll find the rider another car","","amber")}{li("alert","Feeling unsafe","Share live location with the safety team","","amber")}</div>'
    f'<div style="width:100%">{btn("Call 112 (emergency)","danger","phone")}</div></div>'),
    purpose="Driver-side emergency and problem reporting during a trip.",
    how=["SOS works like the rider SOS and opens a P1 incident.", "Accident flow asks if anyone is hurt and shows first steps.", "Breakdown ends the trip safely and re-dispatches the rider."],
    elements=["Hold-to-send SOS", "Situation shortcuts", "Emergency call"],
    apis=[("POST", "/v1/rides/{id}/sos", "Raise SOS"), ("POST", "/v1/rides/{id}/breakdown", "End and re-dispatch")], events=["safety.sos_raised", "ride.breakdown"],
    data=["safety.incidents"], to=["D10"],
    edge=["No network: SMS fallback with location.", "False alarm can be cancelled within 10 seconds."]))

S.append(dict(id="D19", mock=phone(
    appbar("Connection", back=False) +
    f'<div class="body"><div class="banner err">{icon("wifi_off")}No internet. Your trip continues and is saved on this phone.</div>'
    f'<div class="list">{li("pin","Location points","186 saved, waiting to send","<b>186</b>","amber")}{li("flag","Trip end","Saved at 6:11 PM","<span class=\"tag warn\">Queued</span>","amber")}'
    f'{li("check","Trip start","Sent before the network dropped","<span class=\"tag ok\">Synced</span>","brand")}</div>'
    f'<div class="card-m"><div class="kv"><span>Last sync</span><b>6:02 PM</b></div><div class="kv"><span>Storage</span><span>Encrypted on device</span></div></div>'
    f'<div class="fill"></div>{btn("Retry now","soft","sync")}<div class="xs" style="text-align:center">When the network returns, everything uploads in order and the server reconciles the trip.</div></div>'),
    purpose="Shows what the driver app is doing when the network drops, so drivers trust that the trip and fare are safe.",
    how=["Every action and GPS point is written to an encrypted local queue first.", "A background worker sends the queue in order when a network is available.", "The server accepts late data using event timestamps and recomputes the fare.", "Conflicts (for example the rider cancelled meanwhile) are resolved by server rules and shown to the driver."],
    elements=["Offline banner", "Queued items with counts", "Last sync time", "Retry"],
    apis=[("POST", "/v1/drivers/me/sync", "Upload queued actions and points in batches")], events=["ride.reconciled"],
    data=["Local SQLite queue (encrypted)"], to=["D10"],
    edge=["Queue survives app restart and phone reboot.", "Fare disputes caused by long offline gaps are reviewed by support."]))

S.append(dict(id="D20", mock=phone(
    appbar("Driver support") +
    f'<div class="body"><div class="inp"><div class="box">{icon("bot")}<span class="ph">Ask about payouts, trips, documents…</span></div></div>'
    f'<div class="list">{li("cash","Payout or earnings issue")}{li("route","Fare or trip dispute")}{li("lock","Account blocked or paused")}{li("doc","Documents and verification")}{li("settings","App not working")}{li("trophy","Incentives")}</div>'
    f'<div class="card-m"><b>Open tickets</b><div class="kv"><span>#48213 · Payout 7 Sep</span><span class="tag ok">Resolved</span></div><div class="kv"><span>#48790 · Trip fare 25 Sep</span><span class="tag warn">In progress</span></div></div>'
    f'{btn("Call driver helpline","ghost","headset")}</div>'),
    purpose="Help for drivers: AI answers for common questions, categories, tickets and a helpline.",
    how=["The assistant can read the driver's own trips, payouts and document status.", "Categories open a ticket with the right team and priority.", "The helpline goes through the IVR, which already knows it's a driver calling."],
    elements=["Ask box", "Help categories", "Open tickets", "Helpline"],
    apis=[("POST", "/v1/assistant/messages", "Assistant"), ("GET", "/v1/tickets", "My tickets"), ("POST", "/v1/tickets", "New ticket")], events=["ticket.created"],
    data=["support.tickets"], to=["D16", "D14"],
    edge=["Account blocks always explain the reason and how to appeal.", "Ticket replies arrive as push notifications."]))
