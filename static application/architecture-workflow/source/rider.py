from components import *

W, H = 340, 706
def mapbody(svgmap, top="", sheet="", after=""):
    return f'<div class="body nopad"><div class="map">{svgmap}</div><div class="overlay">{top}<div class="fill"></div>{sheet}</div></div>{after}'

ROUTE = [(250, 150), (250, 245), (140, 245), (140, 400), (70, 400), (70, 560)]
KEYPAD = '<div class="kbd">' + "".join(f"<span>{k}</span>" for k in ["1","2","3","4","5","6","7","8","9","","0","⌫"]) + "</div>"

S = []

# R01 Splash
S.append(dict(id="R01", mock=phone(
    f'<div class="body center" style="background:linear-gradient(160deg,#0B7A68,#0A4F45);color:#fff;justify-content:center;gap:16px;margin:0;padding:0 24px">'
    f'<div style="width:86px;height:86px;border-radius:24px;background:#fff;display:flex;align-items:center;justify-content:center;color:#0B7A68">{icon("nav",44,2.2)}</div>'
    f'<div style="font-size:30px;font-weight:800">{B()}</div><div style="opacity:.85">Rides you can trust</div>'
    f'<div style="position:absolute;bottom:40px;font-size:12px;opacity:.7">Checking your session…</div></div>'),
    purpose="First screen on launch. Decides where the rider should go next while the brand shows.",
    how=["Reads the stored refresh token from secure storage (Keychain / Keystore).", "Calls the config endpoint for minimum app version, city list and feature flags.",
         "If the app is too old, shows a forced-update dialog.", "Routes to onboarding (first launch), login (no session) or home (valid session)."],
    elements=["Logo and brand name", "Tagline", "Silent progress text"],
    apis=[("GET", "/v1/config?platform=android&version=1.0.0", "Minimum version, feature flags, supported cities"), ("POST", "/v1/auth/refresh", "Renew the access token if a session exists")],
    data=["Secure storage: refresh token, device ID", "Remote config"], to=["R02", "R03", "R07"],
    edge=["No internet: show retry banner, keep cached city config.", "Refresh token rejected: clear session, go to login.", "Rooted or tampered device: allow booking but flag device to Fraud."]))

# R02 Onboarding
S.append(dict(id="R02", mock=phone(
    f'<div class="ab"><span class="t"></span><span class="chip">English ▾</span></div>'
    f'<div class="body" style="gap:18px"><div style="height:330px;border-radius:24px;overflow:hidden;position:relative">{map_svg(308,330,route=[(60,280),(60,160),(200,160),(200,70)],pickup=(60,280),drop=(200,70),cars=[(130,160,90)],labels=False)}</div>'
    f'<div class="h1">Safe rides, every time</div><div class="sub">Verified drivers, live tracking, masked calls and a one-tap SOS on every trip.</div>'
    f'<div style="display:flex;gap:6px"><i style="width:22px;height:6px;border-radius:3px;background:#0B7A68"></i><i style="width:6px;height:6px;border-radius:3px;background:#D5DDE2"></i><i style="width:6px;height:6px;border-radius:3px;background:#D5DDE2"></i></div>'
    f'<div class="fill"></div>{btn("Get started")}<div class="xs" style="text-align:center">Want to drive? Get the {B()} Driver app</div></div>'),
    purpose="Three short slides that explain what makes the service different, shown only on first launch.",
    how=["Rider swipes through three slides: safety, fair prices, many vehicle types.", "Language picker stores the choice locally and on the profile later.", "Get started opens phone login."],
    elements=["Language selector", "Illustration", "Headline and one-line explanation", "Page dots", "Get started button", "Link to the driver app"],
    apis=[], data=["Local flag: onboarding_seen", "Chosen language"], to=["R03"],
    edge=["Right-to-left languages mirror the layout.", "Skipped automatically after the first run."]))

# R03 Login
S.append(dict(id="R03", mock=phone(
    appbar("", back=False) +
    f'<div class="body"><div class="h1">Enter your phone number</div><div class="sub">We\'ll send a one-time code to verify it.</div>'
    f'<div style="display:flex;gap:8px"><div class="inp" style="width:92px"><label>Country</label><div class="box">🇮🇳 +91</div></div>{inp("Mobile number","98480 04321",focus=True)}</div>'
    f'<div class="xs">By continuing you agree to the Terms and Privacy Policy.</div>{btn("Send OTP")}'
    f'<div class="xs" style="text-align:center">or continue with</div><div class="row2">{btn("Google","ghost sm")}{btn("Apple","ghost sm")}</div><div class="fill"></div>{KEYPAD}</div>'),
    purpose="Phone number login. The same screen handles new sign-ups and returning riders.",
    how=["Country code defaults from the SIM or locale; the rider can change it.", "Number is validated with libphonenumber before sending.", "Send OTP calls the auth service, which rate-limits per phone and device.", "On success the app moves to OTP entry."],
    elements=["Country code picker", "Phone number field with numeric keypad", "Terms and privacy consent line", "Send OTP button", "Google and Apple sign-in"],
    apis=[("POST", "/v1/auth/otp", "Send OTP by SMS, WhatsApp fallback")], events=["user.otp_requested"], data=["Device ID", "Phone number"], to=["R04"],
    edge=["More than 3 requests in 10 minutes: show a wait timer.", "Invalid number: inline error, button disabled.", "Number blocked by Fraud: generic message, link to support.", "Google/Apple sign-in still asks for a phone number once (needed for drivers to reach you)."]))

# R04 OTP
S.append(dict(id="R04", mock=phone(
    appbar("") +
    f'<div class="body"><div class="h1">Enter the 6-digit code</div><div class="sub">Sent to +91 98480 04321 · <b style="color:#0B7A68">Edit</b></div>'
    f'<div class="otp"><span>4</span><span>8</span><span>2</span><span class="f">7</span><span></span><span></span></div>'
    f'<div class="xs" style="text-align:center">Resend code in 0:24 · Get code on WhatsApp</div>{btn("Verify")}<div class="fill"></div>{KEYPAD}</div>'),
    purpose="Verifies the one-time code and creates the session.",
    how=["Android reads the SMS automatically (SMS Retriever API); iOS offers one-tap autofill.", "Verify sends phone, code and device ID.", "Auth returns a 15-minute access token and a 30-day refresh token, stored in secure storage.", "New users go to profile setup, returning users to home."],
    elements=["Six code boxes", "Edit number link", "Resend timer and WhatsApp option", "Verify button"],
    apis=[("POST", "/v1/auth/verify", "Check code and issue tokens")], events=["user.registered", "user.logged_in"], data=["OTP hash in Redis (5 min)", "identity.users, identity.devices"], to=["R05", "R07"],
    edge=["Wrong code: shake animation, attempts left shown; 5 wrong tries lock for 30 minutes.", "Code expired: prompt to resend.", "New device for an existing account: extra risk check before tokens are issued."]))

# R05 Profile
S.append(dict(id="R05", mock=phone(
    appbar("Create your profile") +
    f'<div class="body"><div class="center"><div class="av lg">A</div><span class="chip">{icon("upload",14)} Add photo</span></div>'
    f'{inp("Full name","Ananya Rao")}{inp("Email (for receipts)","ananya@example.com")}'
    f'<div class="inp"><label>Gender (optional, for safety features)</label><div class="chips"><span class="chip on">Woman</span><span class="chip">Man</span><span class="chip">Non-binary</span><span class="chip">Prefer not to say</span></div></div>'
    f'{inp("Referral code","FRIEND100",ph=True)}<div class="fill"></div>{btn("Continue")}</div>'),
    purpose="Collects the few details needed to book: name, optional email, optional gender for safety preferences.",
    how=["Name is required; email is optional and verified by a link.", "Gender is optional and only used for features like preferring women drivers.", "Referral code is validated and credit added after the first ride."],
    elements=["Photo picker", "Name, email fields", "Optional gender chips", "Referral code", "Continue"],
    apis=[("PUT", "/v1/me", "Save profile"), ("POST", "/v1/referrals/apply", "Attach referral code")], events=["rider.updated"], data=["users.riders"], to=["R06"],
    edge=["Name with emoji or digits only: validation error.", "Invalid referral: soft warning, can continue.", "Photo is compressed to under 300 KB before upload."]))

# R06 Permissions
S.append(dict(id="R06", mock=phone(
    appbar("A few permissions", back=False) +
    f'<div class="body"><div class="sub">We ask only for what the app needs. You can change these any time in Settings.</div>'
    f'<div class="list">{li("pin","Location","Required to find drivers near you",'<span class="toggle on"></span>',"brand")}'
    f'{li("bell","Notifications","Driver arrival, trip and safety alerts",'<span class="toggle on"></span>',"blue")}'
    f'{li("users","Contacts","Optional, to pick emergency contacts",'<span class="toggle"></span>')}'
    f'{li("mic","Microphone","Only for in-app calls",'<span class="toggle"></span>')}</div>'
    f'<div class="banner info">{icon("shield")}Location is shared with your driver only during a trip.</div><div class="fill"></div>{btn("Allow and continue")}</div>'),
    purpose="Explains and requests OS permissions before the system dialogs appear.",
    how=["Each toggle triggers the operating system permission dialog.", "Location 'while using the app' is enough; background location is not requested for riders.", "The choices are stored so the app doesn't ask again."],
    elements=["Permission list with reasons", "Privacy note", "Continue"],
    apis=[("PATCH", "/v1/me/devices/{id}", "Register push token")], data=["Push token (FCM / APNs)"], to=["R07"],
    edge=["Location denied: home shows a manual pickup search instead of the blue dot.", "Notifications denied: in-app banners replace pushes.", "Precise location off (iOS): ask once to enable for accurate pickup."]))

# R07 Home
tiles = "".join(f'<div class="center" style="gap:4px;flex:1"><div class="opt" style="padding:8px;justify-content:center;width:100%">{icon(i,24)}</div><span class="xs" style="color:#111B24;font-weight:600">{t}</span></div>'
                for i, t in (("bike","Bike"),("auto","Auto"),("car","Cab"),("car","Premium")))
S.append(dict(id="R07", mock=phone(mapbody(
    map_svg(W, H, me=(170, 330), cars=[(90,250,90),(240,300,0),(200,420,45),(120,380,0),(290,200,90)]),
    top=f'<div class="floating"><span class="ib">{icon("menu")}</span><div style="flex:1"><div class="xs">Good evening</div><b>Ananya</b></div><span class="ib">{icon("bell")}</span></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="inp"><div class="box" style="background:#F5F7F8;border:none;height:50px">{icon("search")}<b style="flex:1">Where to?</b><span class="chip">{icon("clock",13)} Now ▾</span></div></div>'
          f'<div class="list">{li("home","Home","Road 12, Banjara Hills","","brand")}{li("bag","Work","Hitec City, Madhapur","")}</div>'
          f'<div style="display:flex;gap:8px">{tiles}</div>'
          f'<div class="banner warn">{icon("gift")}<span><b>RIDE50</b> · 50% off your next 2 rides</span></div></div>',
    after=bnav(RIDER_NAV, "home"))),
    purpose="The starting point: shows nearby cars on a map and the fastest ways to start a booking.",
    how=["Gets the current location and reverse-geocodes it as the default pickup.", "Polls nearby cars every 10 s (approximate positions only, no driver identities).", "Where to? opens search; saved places and vehicle tiles jump straight to options.", "Offers banner shows the best applicable coupon."],
    elements=["Map with blue location dot and nearby cars", "Greeting, menu, notifications", "Where to? with Now / Schedule", "Saved places", "Vehicle type shortcuts", "Offer banner", "Bottom navigation"],
    apis=[("GET", "/v1/nearby?lat&lng", "Approximate nearby cars per vehicle type"), ("GET", "/v1/me/places", "Saved places"), ("GET", "/v1/offers/best", "Banner offer")],
    data=["Location (while using the app)", "Saved places"], to=["R08", "R23", "R20", "R21", "R28", "R22"],
    edge=["Outside a service area: banner 'Not available here yet' and waitlist.", "Active ride exists: home is replaced by that ride's screen.", "Car positions are jittered so real driver locations are not exposed."]))

# R08 Search
S.append(dict(id="R08", mock=phone(
    appbar("Plan your ride") +
    f'<div class="body"><div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Current location</b><span>Road 12, Banjara Hills</span></span></div><div class="vline"></div>'
    f'<div class="loc"><span class="d sq"></span><span class="tx" style="flex:1"><b>Hitec|</b></span>{icon("x",16)}</div></div>'
    f'<div class="list">{li("pin","Hitec City Metro Station","Madhapur · 9.8 km")}{li("pin","Hitec City Cyber Towers","Madhapur · 10.4 km")}'
    f'{li("pin","Hitex Exhibition Centre","Izzat Nagar · 12.1 km")}{li("map","Set location on map","Drag the pin to a spot","","blue")}</div>'
    f'<div class="xs" style="font-weight:700;letter-spacing:.06em">RECENT</div><div class="list">{li("clock","Rajiv Gandhi Intl Airport","Shamshabad")}{li("clock","Inorbit Mall","Madhapur")}</div></div>'),
    purpose="Pick pickup and destination with autocomplete, saved and recent places.",
    how=["Typing calls autocomplete through the Maps adapter, biased to the rider's location, with 250 ms debounce.", "Choosing a place gets its coordinates (place details).", "Pickup can be changed the same way.", "When both are set, the app asks for fares."],
    elements=["Pickup and drop fields", "Suggestions with distance", "Set on map", "Recent places", "Add stop (up to 2)"],
    apis=[("GET", "/v1/places/autocomplete?q=", "Suggestions via Maps adapter"), ("GET", "/v1/places/{id}", "Coordinates for a place")],
    data=["Recent searches (on device)", "Session token for billing-efficient autocomplete"], to=["R09"],
    edge=["Destination outside the service area: explain and offer outstation rental.", "Same pickup and drop: blocked.", "Airport destination: asks for terminal."]))

# R09 Options
opts = (f'<div class="opt">{"<span class=\"veh\">"+icon("bike",24)+"</span>"}<span class="tx"><b>Bike</b><span>2 min away · 1 seat</span></span><span class="pr">₹89</span></div>'
        f'<div class="opt">{"<span class=\"veh\">"+icon("auto",24)+"</span>"}<span class="tx"><b>Auto</b><span>4 min · 3 seats</span></span><span class="pr">₹142</span></div>'
        f'<div class="opt on">{"<span class=\"veh\">"+icon("car",24)+"</span>"}<span class="tx"><b>Cab</b><span>3 min · drop 6:12 PM</span></span><span class="pr">₹236</span></div>'
        f'<div class="opt">{"<span class=\"veh\">"+icon("car",24)+"</span>"}<span class="tx"><b>Premium</b><span>6 min · top-rated drivers</span></span><span class="pr">₹398</span></div>')
S.append(dict(id="R09", mock=phone(mapbody(
    map_svg(W, H, route=ROUTE, pickup=(70, 560), drop=(250, 150), labels=False),
    top=f'<div class="floating"><span class="ib">{icon("back")}</span><div style="flex:1"><b>Banjara Hills → Hitec City</b><div class="xs">9.8 km · about 27 min</div></div></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;align-items:center;gap:8px"><b class="h2" style="flex:1">Choose a ride</b><span class="chip amber">1.2× high demand</span></div>{opts}'
          f'<div style="display:flex;gap:10px"><span class="chip">{icon("wallet",13)} UPI ▾</span><span class="chip">{icon("tag",13)} Apply coupon</span></div>{btn("Book Cab · ₹236")}</div>')),
    purpose="Shows every available vehicle type with an upfront fare and pickup time so the rider can choose.",
    how=["App requests quotes for all vehicle types in one call.", "Pricing returns fares with a quote ID valid for 5 minutes; surge is shown openly.", "Tapping a type updates the button; long-press shows the fare breakdown.", "Book goes to pickup confirmation."],
    elements=["Route preview on map", "Vehicle list with ETA, seats, fare", "Surge notice", "Payment method and coupon", "Book button"],
    apis=[("POST", "/v1/rides/estimate", "Quotes for each vehicle type"), ("POST", "/v1/coupons/validate", "Discounted fare")], events=["pricing.quoted"],
    data=["pricing.quotes (5 min)", "Route polyline"], to=["R10", "R22"],
    edge=["Quote expired: refresh prices silently and highlight any change.", "No drivers for a type: shown greyed with 'none nearby'.", "Surge above 1.5×: ask for explicit confirmation."]))

# R10 Confirm pickup
S.append(dict(id="R10", mock=phone(mapbody(
    map_svg(W, H, pickup=(170, 300), labels=True),
    top=f'<div class="floating"><span class="ib">{icon("back")}</span><b style="flex:1">Confirm pickup spot</b></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="loc"><span class="d"></span><span class="tx"><b>Gate 2, Lumbini Apartments</b><span>Road 12, Banjara Hills · move the map to adjust</span></span></div>'
          f'<div class="xs" style="font-weight:700;letter-spacing:.06em">PAY WITH</div><div class="list">{li("wallet","UPI · ananya@okbank","",icon("check"),"brand")}{li("card","Visa •••• 4417","")}{li("wallet","Wallet","₹120.00 available")}{li("cash","Cash","")}</div>'
          f'{btn("Confirm pickup")}</div>')),
    purpose="Lets the rider fine-tune the pickup pin and pick how to pay before the request is sent.",
    how=["Map is movable; the pin stays centred and the address updates on stop.", "Suggested pickup points (gates, entrances) snap the pin.", "Confirm creates the ride with an idempotency key so a double tap never books twice."],
    elements=["Draggable map under a fixed pin", "Pickup address", "Payment methods", "Confirm button"],
    apis=[("GET", "/v1/places/reverse?lat&lng", "Address for pin"), ("POST", "/v1/rides", "Create ride with quote_id and payment method")], events=["ride.requested"],
    data=["rides.rides", "rides.ride_events"], to=["R11"],
    edge=["Pin moved over 300 m: re-quote the fare.", "Payment method needs re-authentication (UPI mandate): open the gateway sheet first.", "Rider has unpaid dues: must settle before booking."]))

# R11 Finding driver
radar = map_svg(W, H, pickup=(170, 300), cars=[(110,220,90),(250,260,0),(230,380,45)], labels=False)
radar = radar.replace("</svg>", '<circle cx="170" cy="300" r="70" fill="none" stroke="#0B7A68" stroke-width="2" opacity=".5"/><circle cx="170" cy="300" r="130" fill="none" stroke="#0B7A68" stroke-width="2" opacity=".25"/></svg>')
S.append(dict(id="R11", mock=phone(mapbody(radar,
    sheet=f'<div class="sheet"><div class="grab"></div><div class="h2">Finding your driver</div><div class="progress"><i style="width:45%"></i></div>'
          f'<div class="sub">Contacting nearby Cab drivers. This usually takes under a minute.</div>'
          f'<div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Gate 2, Lumbini Apartments</b></span></div><div class="vline"></div><div class="loc"><span class="d sq"></span><span class="tx"><b>Hitec City Metro Station</b></span></div></div>'
          f'<div class="kv"><span>Cab · UPI</span><b>₹236</b></div>{btn("Cancel request","ghost")}</div>')),
    purpose="Waiting state while dispatch offers the ride to drivers.",
    how=["App subscribes to the ride channel over WebSocket (push as backup).", "Dispatch offers the ride to one driver at a time, 15 s each, widening the radius.", "As soon as a driver accepts, the screen switches to driver assigned.", "After 3 minutes the rider sees 'No drivers available' with options."],
    elements=["Pulsing radar around pickup", "Progress and message", "Trip summary", "Fare and payment", "Cancel (free at this stage)"],
    apis=[("WS", "/ws/rides/{id}", "Live status"), ("POST", "/v1/rides/{id}/cancel", "Cancel without fee")], events=["ride.cancelled"],
    data=["Ride status"], to=["R12", "R09"],
    edge=["No driver found: suggest another vehicle type or retry with a small fare boost.", "App killed during search: on reopen, resumes this screen.", "Network lost: status resyncs from the API when reconnected."]))

# R12 Driver assigned
act = "".join(f'<div class="center" style="gap:4px;flex:1"><span class="ic {c}">{icon(i)}</span><span class="xs" style="color:#111B24">{t}</span></div>'
              for i, t, c in (("phone","Call","brand"),("chat","Chat","brand"),("share","Share",""),("shield","Safety","red")))
S.append(dict(id="R12", mock=phone(mapbody(
    map_svg(W, H, route=[(250,180),(250,245),(170,245),(170,300)], pickup=(170, 300), cars=[(250, 185, 0)], labels=False),
    sheet=f'<div class="sheet"><div class="grab"></div><div style="display:flex;align-items:center"><div style="flex:1"><div class="h2">Arriving in 4 min</div><div class="xs">1.1 km away</div></div><span class="chip on" style="font-size:14px">OTP 4827</span></div>'
          f'<div class="li" style="padding:0;border:none"><span class="av">AK</span><span class="tx"><b>Arjun K. · ★ 4.9</b><span>White Swift Dzire</span></span><span class="tag" style="font-size:13px">TS 09 EA 4521</span></div>'
          f'<div style="display:flex">{act}</div><div class="hr"></div><div class="loc"><span class="d"></span><span class="tx"><b>Gate 2, Lumbini Apartments</b><span>Pickup</span></span></div>{btn("Cancel ride","ghost sm")}</div>')),
    purpose="Tells the rider who is coming, in what car, how soon, and the OTP to share at pickup.",
    how=["Driver position arrives over WebSocket every 4 s and animates smoothly.", "ETA is recalculated every 30 s.", "OTP must be told to the driver; the trip can't start without it.", "Call and chat use masked channels."],
    elements=["Live car on map with route to pickup", "ETA and distance", "Trip OTP", "Driver photo, name, rating", "Car model and plate", "Call, chat, share, safety", "Cancel"],
    apis=[("WS", "/ws/rides/{id}", "Driver location and status"), ("POST", "/v1/rides/{id}/call", "Start masked call"), ("POST", "/v1/rides/{id}/share", "Trip share link")],
    events=["ride.share_created"], data=["Driver public profile", "Vehicle"], to=["R13", "R14", "R15", "R16"],
    edge=["Cancel after 3 minutes: shows the cancellation fee before confirming.", "Driver not moving for 5 minutes: offer to find another driver.", "Plate shown large so riders can check the car before getting in."]))

# R13 Call
S.append(dict(id="R13", mock=phone(
    f'<div class="body center" style="justify-content:center;gap:14px"><div class="av lg" style="width:96px;height:96px;font-size:30px">AK</div><div class="h1">Arjun K.</div>'
    f'<div class="sub">Calling through {B()} · numbers hidden</div><div style="font-size:18px;font-variant-numeric:tabular-nums">00:42</div>'
    f'<div style="display:flex;gap:26px;margin-top:40px">' + "".join(f'<div class="center" style="gap:6px"><span class="ic" style="width:58px;height:58px">{icon(i,24)}</span><span class="xs">{t}</span></div>' for i, t in (("mic","Mute"),("phone","Speaker"),("grid","Keypad"))) +
    f'</div><div style="margin-top:36px;width:70px;height:70px;border-radius:50%;background:#D93A1E;color:#fff;display:flex;align-items:center;justify-content:center">{icon("phone",28)}</div>'
    f'<div class="xs" style="margin-top:24px">Calls may be recorded for safety where the law allows.</div></div>', dark=True),
    purpose="In-app voice call to the driver without either side seeing the other's real number.",
    how=["App asks Telephony for a call session; the call is placed over WebRTC to Asterisk.", "Asterisk rings the driver app, or the driver's phone through a proxy number.", "If WebRTC fails, the app dials the proxy number over the normal phone network.", "Call ends; duration saved to call logs."],
    elements=["Driver name and photo", "Privacy note", "Timer", "Mute, speaker, keypad", "End call", "Recording notice"],
    apis=[("POST", "/v1/rides/{id}/call", "Create call session"), ("WS", "webrtc signalling (SIP over WSS)", "Media setup")], events=["call.started", "call.ended"],
    data=["telephony.call_logs"], to=["R12"],
    edge=["Masked calling available from driver assigned until 30 min after the trip.", "Poor network: automatic fallback to a phone call.", "Driver doesn't answer: suggest chat."]))

# R14 Chat
S.append(dict(id="R14", mock=phone(
    appbar('Arjun K. <span class="xs" style="font-weight:400;display:block">Swift Dzire · TS 09 EA 4521</span>', right=f'<span class="ib">{icon("phone")}</span>') +
    f'<div class="body" style="gap:8px"><div class="bubble sys">Messages are kept for 7 days for your safety</div>'
    f'<div class="bubble them">Hi, I\'m at Gate 2. White Dzire.</div><div class="bubble me">Coming in 2 minutes</div><div class="bubble them">OK, waiting 👍</div>'
    f'<div class="fill"></div><div class="chips"><span class="chip">I\'m on my way</span><span class="chip">Please wait</span><span class="chip">Call me</span></div>'
    f'<div style="display:flex;gap:8px;align-items:center"><div class="inp" style="flex:1"><div class="box"><span class="ph">Message</span></div></div><span class="ic brand" style="width:46px;height:46px">{icon("send")}</span></div></div>'),
    purpose="Text chat between rider and driver during pickup, with quick replies that are translated automatically.",
    how=["Messages go over the ride WebSocket and are stored by the Support service.", "Quick replies are pre-translated, so a rider and driver who speak different languages still understand each other.", "Driver sees messages read aloud while driving."],
    elements=["Driver header with call button", "Retention notice", "Message bubbles", "Quick replies", "Message box"],
    apis=[("WS", "/ws/chat/{ride_id}", "Send and receive messages"), ("GET", "/v1/rides/{id}/messages", "History")], events=["chat.message_sent"],
    data=["support.messages"], to=["R12", "R13"],
    edge=["Phone numbers, links and abusive words are masked and can trigger a safety review.", "Chat closes 30 minutes after the trip."]))

# R15 Trip in progress
S.append(dict(id="R15", mock=phone(mapbody(
    map_svg(W, H, route=ROUTE[:4], pickup=None, drop=(250, 150), cars=[(140, 360, 0)], labels=False),
    top=f'<div class="floating"><span class="ic brand">{icon("route")}</span><div style="flex:1"><b>On your way</b><div class="xs">Drop at 6:12 PM · 6.2 km left</div></div></div>',
    sheet=f'<div class="sheet"><div class="grab"></div><div class="progress"><i style="width:38%"></i></div>'
          f'<div class="li" style="padding:0;border:none"><span class="av">AK</span><span class="tx"><b>Arjun K.</b><span>TS 09 EA 4521</span></span><span class="ib">{icon("phone")}</span></div>'
          f'<div class="loc"><span class="d sq"></span><span class="tx"><b>Hitec City Metro Station</b><span>Change destination</span></span></div>'
          f'<div class="row2">{btn("Share trip","soft sm","share")}{btn("Safety","ghost sm","shield")}</div>{btn("SOS","danger","alert")}</div>')),
    purpose="The main in-trip screen: live progress, driver details, destination changes and the SOS button.",
    how=["Location updates every 3 s; the route redraws if the driver takes another road.", "If the car goes off route or stops too long, the app asks 'Is everything OK?'.", "Share trip sends a live link to chosen contacts.", "SOS opens the emergency screen."],
    elements=["Live route and car", "ETA and remaining distance", "Progress bar", "Driver row with call", "Change destination", "Share trip, safety toolkit", "SOS button"],
    apis=[("WS", "/ws/rides/{id}", "Location and status"), ("PATCH", "/v1/rides/{id}/destination", "Change drop (re-priced)"), ("POST", "/v1/rides/{id}/share", "Share link")],
    events=["ride.destination_changed", "safety.check_in"], data=["Live location", "Route"], to=["R16", "R17", "R14"],
    edge=["Destination change shows the new fare before confirming.", "Deviation check-in unanswered for 60 s: safety team is alerted.", "Phone goes offline: ride continues; driver app is the source of truth."]))

# R16 SOS
S.append(dict(id="R16", mock=phone(
    appbar("Emergency") +
    f'<div class="body center" style="gap:14px"><div class="sub">Press and hold for 2 seconds</div><div class="sos-ring">SOS</div>'
    f'<div class="banner err" style="text-align:left">{icon("alert")}<span>Alert sent at 5:58 PM. Our safety team is calling you now.</span></div>'
    f'<div class="list" style="width:100%;text-align:left">{li("users","Mom · +91 98•••••210","Live location sent",'<span class="tag ok">Sent</span>',"brand")}'
    f'{li("users","Rahul · +91 99•••••876","Live location sent",'<span class="tag ok">Sent</span>',"brand")}'
    f'{li("headset",f"{BRAND} safety team","Agent Meera is joining",'<span class="tag warn">Calling</span>',"amber")}</div>'
    f'<div style="width:100%">{btn("Call 112 (emergency)","danger","phone")}</div><div class="xs">Your trip is recording location every second.</div></div>'),
    purpose="One place for help in an emergency: alerts the safety team and trusted contacts and offers a direct emergency call.",
    how=["Holding the button for 2 s prevents accidental alerts.", "Safety service opens a P1 incident and raises an alarm on the ops console.", "Emergency contacts get an SMS/WhatsApp with a live trip link.", "A safety agent calls within 60 seconds; the emergency number button dials directly from the phone."],
    elements=["Hold-to-send SOS", "Status of the alert", "Contacts notified", "Safety agent status", "Call emergency number", "Recording notice"],
    apis=[("POST", "/v1/rides/{id}/sos", "Raise SOS with location"), ("WS", "/ws/rides/{id}", "Incident status updates")], events=["safety.sos_raised"],
    data=["safety.incidents", "Emergency contacts"], to=["R15"],
    edge=["Works without internet: sends an SMS with location as a fallback.", "Emergency number is localised per country (112, 911, 999).", "The app never says police were contacted unless an agent confirms it."]))

# R17 Trip complete
S.append(dict(id="R17", mock=phone(
    appbar("", back=False) +
    f'<div class="body"><div class="center"><span class="ic brand xl" style="width:64px;height:64px">{icon("check",30,2.4)}</span><div class="h1">You\'ve arrived</div><div class="sub">Hitec City Metro Station · 6:11 PM</div></div>'
    f'<div class="card-m"><div class="kv"><span>Base fare</span><span>₹50.00</span></div><div class="kv"><span>Distance 9.9 km</span><span>₹138.60</span></div>'
    f'<div class="kv"><span>Time 26 min</span><span>₹39.00</span></div><div class="kv"><span>High demand 1.2×</span><span>₹45.50</span></div>'
    f'<div class="kv"><span>Coupon RIDE50</span><span style="color:#0B7A68">−₹37.00</span></div><div class="kv"><span>Taxes</span><span>₹11.90</span></div><div class="hr"></div>'
    f'<div class="kv"><b>Total</b><b style="font-size:18px">₹248.00</b></div><div class="kv"><span>Paid by UPI</span><span class="tag ok">Paid</span></div></div>'
    f'<div class="fill"></div>{btn("Rate your ride")}<div class="xs" style="text-align:center">View invoice · Report an issue</div></div>'),
    purpose="Confirms the trip ended and shows exactly what was charged and why.",
    how=["Ride service computes the final fare from the snapped GPS trail.", "Payments captures the amount; status updates live from the webhook.", "If the final fare is more than 20% above the quote, the reason is shown."],
    elements=["Arrival confirmation", "Fare breakdown", "Payment status", "Rate button", "Invoice and issue links"],
    apis=[("GET", "/v1/rides/{id}/receipt", "Final fare breakdown"), ("WS", "/ws/rides/{id}", "Payment status")], events=["ride.completed", "payment.completed"],
    data=["rides.rides", "payments.payments"], to=["R18", "R19", "R27"],
    edge=["Payment failed: ask to retry or choose another method; booking blocked until paid.", "Cash ride: shows 'Pay ₹248 to driver'.", "Toll or parking added by driver: listed with a photo of the receipt."]))

# R18 Rate
S.append(dict(id="R18", mock=phone(
    appbar("", back=False, right='<span class="sub">Skip</span>') +
    f'<div class="body center"><div class="av lg">AK</div><div class="h2">How was your ride with Arjun?</div>'
    f'<div class="stars">{icon("star")*4}<span style="color:#D5DDE2">{icon("star")}</span></div>'
    f'<div class="chips" style="justify-content:center"><span class="chip on">Safe driving</span><span class="chip on">Clean car</span><span class="chip">Polite</span><span class="chip">Knew the route</span><span class="chip">Good music</span></div>'
    f'<div class="inp" style="width:100%"><div class="box" style="height:70px;align-items:flex-start;padding-top:10px"><span class="ph">Tell us more (optional)</span></div></div>'
    f'<div style="width:100%;text-align:left"><b>Add a tip</b> <span class="xs">100% goes to Arjun</span></div><div class="chips"><span class="chip">₹10</span><span class="chip on">₹20</span><span class="chip">₹50</span><span class="chip">Other</span></div>'
    f'<div class="fill"></div><div style="width:100%">{btn("Submit")}</div></div>'),
    purpose="Rate the driver, pick compliments or problems, and optionally tip.",
    how=["Stars change the chips: 5 shows compliments, 3 or below shows problems.", "1 or 2 stars with a safety problem opens a ticket automatically.", "Tips are charged with the same payment method and paid out in full."],
    elements=["Driver photo", "Star rating", "Compliment / problem chips", "Comment", "Tip options", "Submit and skip"],
    apis=[("POST", "/v1/rides/{id}/rating", "Save rating"), ("POST", "/v1/rides/{id}/tip", "Charge tip")], events=["ride.rated", "tip.added"],
    data=["rides.ratings"], to=["R07"],
    edge=["Ratings can be changed for 7 days.", "Drivers see only the average, never who gave a rating.", "A low rating on a safety topic creates a support ticket."]))

# R19 Invoice
S.append(dict(id="R19", mock=phone(
    appbar("Invoice") +
    f'<div class="body"><div class="card-m"><div class="kv"><span>Invoice</span><b>RN-HYD-2026-0927-00125</b></div><div class="kv"><span>Date</span><span>27 Sep 2026, 5:45 PM</span></div>'
    f'<div class="hr"></div><div class="loc"><span class="d"></span><span class="tx"><b>Banjara Hills</b><span>5:45 PM</span></span></div><div class="loc"><span class="d sq"></span><span class="tx"><b>Hitec City Metro</b><span>6:11 PM</span></span></div>'
    f'<div class="hr"></div><div class="kv"><span>Ride fare</span><span>₹236.10</span></div><div class="kv"><span>Taxes</span><span>₹11.90</span></div><div class="kv"><b>Total paid</b><b>₹248.00</b></div>'
    f'<div class="hr"></div><div class="kv"><span>Driver</span><span>Arjun K.</span></div><div class="kv"><span>Vehicle</span><span>TS 09 EA 4521</span></div><div class="kv"><span>Tax ID</span><span>36AAxxxxxx1Z5</span></div></div>'
    f'<div class="row2">{btn("Download PDF","soft sm","upload")}{btn("Email","ghost sm")}</div><div class="xs">Business profile? Switch to send invoices to your company.</div></div>'),
    purpose="A tax-compliant invoice for the ride that can be downloaded or emailed.",
    how=["A Celery worker renders the PDF after payment and stores it in the invoices bucket.", "The app opens a signed link valid for 5 minutes.", "Business riders get GST/VAT details of their company."],
    elements=["Invoice number and date", "Route and times", "Fare and taxes", "Driver, vehicle, tax ID", "Download and email"],
    apis=[("GET", "/v1/rides/{id}/invoice", "Signed PDF link"), ("POST", "/v1/rides/{id}/invoice/email", "Email invoice")],
    data=["MinIO invoices bucket", "ledger entries"], to=["R20"],
    edge=["Invoice not ready yet: shows 'Generating…' and a push when ready.", "Tax format differs per country (GST, VAT)."]))

# R20 History
row = lambda d, r, f, t, k: f'<div class="li"><span class="ic">{icon("car")}</span><span class="tx"><b>{r}</b><span>{d}</span></span><span style="display:flex;flex-direction:column;align-items:flex-end;gap:3px"><b>{f}</b><span class="tag {k}">{t}</span></span></div>'
S.append(dict(id="R20", mock=phone(
    appbar("Your rides", back=False) +
    f'<div class="body"><div class="chips"><span class="chip on">All</span><span class="chip">Completed</span><span class="chip">Cancelled</span><span class="chip">Scheduled</span></div>'
    f'<div class="list">{row("Today, 5:45 PM","Banjara Hills → Hitec City","₹248","Completed","ok")}{row("Tue 30 Sep, 7:30 AM","Home → Airport","₹612","Scheduled","info")}'
    f'{row("25 Sep, 9:10 PM","Inorbit Mall → Home","₹0","Cancelled","err")}{row("24 Sep, 8:20 AM","Home → Work","₹212","Completed","ok")}{row("22 Sep, 6:40 PM","Work → Jubilee Hills","₹164","Completed","ok")}</div></div>'
    + bnav(RIDER_NAV, "rides")),
    purpose="All past, cancelled and upcoming rides in one list.",
    how=["Loads 20 rides at a time with cursor pagination.", "Tapping a ride shows its receipt, route map and help options.", "Scheduled rides can be edited or cancelled here."],
    elements=["Filter chips", "Ride rows with date, route, fare, status", "Bottom navigation"],
    apis=[("GET", "/v1/rides?status=&cursor=", "Ride list")], data=["rides.rides (read replica)"], to=["R19", "R27", "R23"],
    edge=["Rides older than the retention period show summary only.", "Offline: shows the last cached page."]))

# R21 Wallet
S.append(dict(id="R21", mock=phone(
    appbar("Wallet", back=False) +
    f'<div class="body"><div class="card-m brand"><span class="xs">{B()} wallet balance</span><div class="big-num">₹120.00</div><div class="row2">{btn("Add money","amber sm","plus")}{btn("History","ghost sm")}</div></div>'
    f'<div class="xs" style="font-weight:700;letter-spacing:.06em">PAYMENT METHODS</div><div class="list">{li("wallet","UPI","ananya@okbank · default",icon("check"),"brand")}{li("card","Visa •••• 4417","Expires 08/29")}{li("plus","Add card or UPI ID","","","blue")}</div>'
    f'<div class="xs" style="font-weight:700;letter-spacing:.06em">RECENT</div><div class="list">{li("gift","Referral credit","22 Sep",'<b style="color:#0B7A68">+₹100</b>')}{li("car","Ride · Home → Work","24 Sep",'<b>−₹40</b>')}</div></div>'
    + bnav(RIDER_NAV, "wallet")),
    purpose="Wallet balance, payment methods and wallet transactions.",
    how=["Balance comes from the ledger, never from a number stored on the phone.", "Add money opens the gateway checkout; balance updates when the webhook confirms.", "Wallet is used first when a ride is paid, the rest from the default method."],
    elements=["Balance card", "Add money", "Payment methods with default", "Recent wallet transactions"],
    apis=[("GET", "/v1/wallet", "Balance and transactions"), ("POST", "/v1/wallet/topups", "Start a top-up"), ("POST", "/v1/payment-methods", "Add method (tokenised)")],
    events=["wallet.credited"], data=["ledger.accounts, ledger.entries"], to=["R07"],
    edge=["Card data never touches the platform's servers; only gateway tokens are stored.", "Wallet limits per local regulation (for example a monthly cap without full KYC)."]))

# R22 Offers
cpn = lambda code, t, s: f'<div class="card-m" style="border-style:dashed;border-width:1.5px"><div style="display:flex;align-items:center;gap:8px"><span class="tag ok" style="font-size:13px">{code}</span><span style="flex:1"></span><b style="color:#0B7A68">Apply</b></div><b>{t}</b><span class="xs">{s}</span></div>'
S.append(dict(id="R22", mock=phone(
    appbar("Offers") +
    f'<div class="body"><div style="display:flex;gap:8px">{inp("","Enter coupon code",ph=True).replace("<label></label>","")}{btn("Apply","sm")}</div>'
    f'{cpn("RIDE50","50% off up to ₹75","Next 2 rides · valid till 30 Sep")}{cpn("AIRPORT100","₹100 off airport rides","Cab and Premium · min fare ₹500")}{cpn("BIKE20","20% off Bike","Weekdays 7–10 AM")}'
    f'<div class="card-m brand"><b>Invite friends, get ₹100</b><span class="xs">They get ₹50 off their first ride. Code ANANYA100</span>{btn("Share invite","amber sm","share")}</div></div>'),
    purpose="Coupons the rider can use and the referral programme.",
    how=["Shows offers the rider is eligible for, based on city, history and campaign rules.", "Apply stores the coupon for the next booking; the fare shows the discount on ride options.", "Referral credit arrives after the friend's first completed ride."],
    elements=["Code entry", "Offer cards with terms", "Referral card"],
    apis=[("GET", "/v1/offers", "Eligible offers"), ("POST", "/v1/coupons/validate", "Check a code")], events=["coupon.applied"],
    data=["promotions.coupons, redemptions"], to=["R09"],
    edge=["Abuse limits per device and payment method to stop multi-account farming.", "Expired or used code: clear message why."]))

# R23 Schedule
S.append(dict(id="R23", mock=phone(
    appbar("Schedule a ride") +
    f'<div class="body"><div class="chips"><span class="chip">Today</span><span class="chip">Mon 29</span><span class="chip on">Tue 30</span><span class="chip">Wed 1</span></div>'
    f'<div class="card-m" style="align-items:center;gap:2px"><span class="sub">7:00 AM</span><span class="sub">7:15 AM</span><b style="font-size:22px;padding:6px 0;border-top:1px solid #E3E8EC;border-bottom:1px solid #E3E8EC;width:100%;text-align:center">7:30 AM</b><span class="sub">7:45 AM</span><span class="sub">8:00 AM</span></div>'
    f'<div class="card-m" style="gap:0"><div class="loc"><span class="d"></span><span class="tx"><b>Home</b><span>Road 12, Banjara Hills</span></span></div><div class="vline"></div><div class="loc"><span class="d sq"></span><span class="tx"><b>Rajiv Gandhi Intl Airport</b><span>Departures, Terminal 1</span></span></div></div>'
    f'<div class="opt on"><span class="veh">{icon("car",24)}</span><span class="tx"><b>Cab</b><span>Estimated ₹560–₹640</span></span></div>'
    f'<div class="banner info">{icon("clock")}A driver is assigned 15 minutes before pickup. Free cancellation until then.</div><div class="fill"></div>{btn("Schedule for Tue 7:30 AM")}</div>'),
    purpose="Book a ride for a later time, up to 7 days ahead.",
    how=["Rider picks date, time, route and vehicle; the app shows an estimated fare range.", "The scheduler starts dispatch 20 minutes before pickup.", "Rider is notified when a driver is assigned."],
    elements=["Date chips", "Time picker in 15-minute steps", "Pickup and drop", "Vehicle with fare range", "Cancellation policy", "Schedule button"],
    apis=[("POST", "/v1/scheduled-rides", "Create scheduled ride"), ("DELETE", "/v1/scheduled-rides/{id}", "Cancel")], events=["ride.scheduled"],
    data=["rides.scheduled_rides"], to=["R20"],
    edge=["If no driver is found 5 minutes before pickup, the rider is told immediately with options.", "Airport rides allow flight number for delay tracking later."]))

# R24 Emergency contacts
S.append(dict(id="R24", mock=phone(
    appbar("Emergency contacts") +
    f'<div class="body"><div class="banner info">{icon("shield")}They receive your live trip link when you press SOS or share a trip.</div>'
    f'<div class="list">{li("user","Mom","+91 98••• ••210","","brand")}{li("user","Rahul","+91 99••• ••876","","brand")}{li("plus","Add contact","Up to 5 people","","blue")}</div>'
    f'<div class="xs" style="font-weight:700;letter-spacing:.06em">AUTOMATIC SHARING</div><div class="list">{li("clock","Share night rides","10 PM – 6 AM",'<span class="toggle on"></span>')}'
    f'{li("share","Share every ride","",'<span class="toggle"></span>')}{li("users","Prefer women drivers","When available",'<span class="toggle on"></span>')}</div></div>'),
    purpose="Trusted contacts and automatic trip-sharing rules.",
    how=["Contacts are picked from the phone book or typed; each gets a one-time SMS so they know they were added.", "Auto-share rules run when a ride starts.", "The women-driver preference is passed to dispatch."],
    elements=["Info banner", "Contacts list", "Add contact", "Auto-share toggles", "Women driver preference"],
    apis=[("PUT", "/v1/me/emergency-contacts", "Save contacts"), ("PUT", "/v1/me/safety-preferences", "Save rules")],
    data=["users.emergency_contacts"], to=["R28"],
    edge=["Contact numbers are verified format only; no OTP needed from the contact.", "Contacts can reply STOP to opt out."]))

# R25 KYC
S.append(dict(id="R25", mock=phone(
    appbar("Verify your identity") +
    f'<div class="body"><div class="sub">Needed for corporate accounts, higher wallet limits and some cities\' rules.</div>'
    f'<div class="list">{li("id","Government ID","Passport, driving licence or national ID",'<span class="tag ok">Uploaded</span>',"brand")}'
    f'{li("user","Selfie","Matched to your ID photo",'<span class="tag warn">Pending</span>',"amber")}</div>'
    f'<div class="upload">{icon("upload",22)}<span style="flex:1"><b>Take a selfie</b><div class="xs">Good light, no glasses</div></span></div>'
    f'<div class="banner info">{icon("lock")}Your documents are encrypted and seen only by our verification team.</div><div class="fill"></div>{btn("Continue")}</div>'),
    purpose="Optional identity verification for riders, used for corporate accounts, higher wallet limits and where regulations require it.",
    how=["Rider uploads an ID; OCR extracts name and number.", "Selfie is matched to the ID photo by the face-match model.", "Low confidence goes to a human reviewer; the rider gets a push with the result."],
    elements=["Why it is needed", "Checklist with status", "Camera capture", "Privacy note", "Continue"],
    apis=[("POST", "/v1/kyc/documents", "Upload document (signed URL)"), ("GET", "/v1/kyc/status", "Current status")], events=["kyc.submitted"],
    data=["kyc.verifications", "MinIO kyc-documents"], to=["R28"],
    edge=["Blurry photo: rejected on the phone before upload.", "ID numbers are stored encrypted and masked in every screen."]))

# R26 Support AI
S.append(dict(id="R26", mock=phone(
    appbar("Help", right='<span class="chip">Talk to agent</span>') +
    f'<div class="body" style="gap:8px"><div class="bubble them">Hi Ananya 👋 I can help with your rides. What\'s wrong?</div>'
    f'<div class="card-m" style="flex-direction:row;align-items:center;gap:10px;padding:8px 10px"><span class="ic">{icon("car")}</span><span style="flex:1"><b style="font-size:13px">Today · Banjara Hills → Hitec City</b><div class="xs">₹248 · Completed</div></span></div>'
    f'<div class="bubble me">I was charged more than the estimate</div><div class="bubble them">Your fare was ₹248 vs the ₹236 estimate. The trip took 26 min instead of 22 because of traffic on Road 36, which added ₹12. Would you like me to raise a fare review?</div>'
    f'<div class="chips"><span class="chip on">Yes, review it</span><span class="chip">That\'s fine</span></div><div class="fill"></div>'
    f'<div class="chips"><span class="chip">Lost item</span><span class="chip">Payment issue</span><span class="chip red">Safety concern</span></div>'
    f'<div class="inp"><div class="box"><span class="ph">Type your question</span></div></div></div>'),
    purpose="Self-service help with an AI assistant that can read the rider's own ride data and hand over to a person.",
    how=["The assistant calls tools like get_ride and get_fare_breakdown for the rider's own rides.", "It answers with real numbers or creates a ticket.", "Safety topics and refunds above a limit always go to a human agent.", "The chat history is attached to the ticket so the rider doesn't repeat themselves."],
    elements=["Assistant messages", "Ride context card", "Suggested actions", "Topic shortcuts", "Talk to agent", "Message box"],
    apis=[("POST", "/v1/assistant/messages", "Send message, get answer"), ("POST", "/v1/tickets", "Create ticket")], events=["ticket.created"],
    data=["support.tickets", "Ride summary via tools"], to=["R27"],
    edge=["Assistant unsure: says so and offers an agent.", "Rider types something about danger: jumps straight to the safety team."]))

# R27 Complaint
radio = lambda t, on=False: f'<div class="li"><span style="width:18px;height:18px;border-radius:50%;border:2px solid {"#0B7A68" if on else "#C3CCD3"};{"box-shadow:inset 0 0 0 3px #fff;background:#0B7A68" if on else ""}"></span><span class="tx"><b>{t}</b></span></div>'
S.append(dict(id="R27", mock=phone(
    appbar("Report an issue") +
    f'<div class="body"><div class="card-m" style="flex-direction:row;align-items:center;gap:10px;padding:8px 10px"><span class="ic">{icon("car")}</span><span style="flex:1"><b style="font-size:13px">Today · Banjara Hills → Hitec City</b><div class="xs">Arjun K. · TS 09 EA 4521</div></span></div>'
    f'<div class="list">{radio("I lost an item", True)}{radio("Driver behaviour")}{radio("Fare or payment")}{radio("Vehicle condition")}{radio("Route taken")}</div>'
    f'{inp("What did you lose?","Black backpack, back seat")}<div class="upload">{icon("upload",22)}<span><b>Add a photo</b><div class="xs">Optional</div></span></div>'
    f'<div class="banner info">{icon("phone")}We\'ll connect you to the driver by masked call for 24 hours.</div><div class="fill"></div>{btn("Submit")}</div>'),
    purpose="Report a problem with a specific ride, including lost items.",
    how=["Each category creates a ticket with the right priority and team.", "Lost items open a 24-hour masked call window with the driver.", "Driver behaviour complaints also create a safety or quality review."],
    elements=["Ride context", "Issue categories", "Details", "Photo upload", "Next-step note", "Submit"],
    apis=[("POST", "/v1/tickets", "Create ticket"), ("POST", "/v1/rides/{id}/lost-item", "Open masked contact window")], events=["ticket.created", "lost_item.reported"],
    data=["support.tickets", "support.lost_items"], to=["R26"],
    edge=["Serious allegations are routed to the safety team, not general support.", "Duplicate reports for the same ride are merged."]))

# R28 Account
S.append(dict(id="R28", mock=phone(
    appbar("Account", back=False) +
    f'<div class="body"><div class="li" style="border:none;padding:0"><span class="av lg">AR</span><span class="tx"><b style="font-size:17px">Ananya Rao</b><span>+91 98480 04321 · ★ 4.8 rider rating</span></span></div>'
    f'<div class="list">{li("user","Profile")}{li("home","Saved places")}{li("card","Payment methods")}{li("shield","Safety & emergency contacts")}{li("id","Verify identity")}'
    f'{li("globe","Language","English")}{li("bell","Notifications")}{li("lock","Privacy & data","Download or delete your data")}{li("help","Help")}{li("logout","Log out","","","red")}</div></div>'
    + bnav(RIDER_NAV, "acct")),
    purpose="Profile, settings, privacy controls and log out.",
    how=["Each row opens its settings screen.", "Privacy & data lets the rider download their data or request deletion (handled within the legal time limit).", "Log out revokes the refresh token on the server."],
    elements=["Profile summary and rider rating", "Settings list", "Log out"],
    apis=[("GET", "/v1/me", "Profile"), ("POST", "/v1/me/data-export", "Request data export"), ("DELETE", "/v1/me", "Request account deletion"), ("POST", "/v1/auth/logout", "Revoke session")],
    events=["user.deletion_requested"], data=["users.riders", "identity.sessions"], to=["R24", "R25", "R21", "R26", "R03"],
    edge=["Deletion keeps records the law requires (invoices) but removes personal details.", "Unpaid dues must be settled before deletion."]))
