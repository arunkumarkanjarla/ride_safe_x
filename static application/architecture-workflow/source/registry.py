"""Screen registry shared by architecture pages, screen pages and flow maps.
Each app is a list of sections; each section is (title, [(id, slug, title), ...]).
Page order and index grouping follow the sections."""

SECTIONS = {
 "rider": [
  ("Get started", [("R01","splash","Splash"),("R02","onboarding","Onboarding"),("R58","sign-in-choice","Sign in or create account"),("R57","terms-privacy","Terms & privacy"),("R03","login","Login with phone"),("R04","otp","Verify OTP"),
                   ("R05","profile-setup","Profile setup"),("R06","permissions","Permissions"),("R53","country-language","Country, language & currency")]),
  ("Home and choices", [("R29","super-home","All services home"),("R30","priority-mode","Choose your priority"),("R52","ai-assistant","AI trip assistant"),
                        ("R51","emergency-mode","Emergency mode")]),
  ("City rides", [("R07","home","Ride home map"),("R08","search","Search destination"),("R31","compare-options","Compare by priority"),("R09","ride-options","Ride options & fare"),
                  ("R10","confirm-pickup","Confirm pickup & pay"),("R11","finding-driver","Finding driver"),("R12","driver-assigned","Driver assigned"),
                  ("R13","masked-call","Masked call"),("R14","chat","In-ride chat"),("R15","trip-in-progress","Trip in progress"),("R16","sos","SOS emergency"),
                  ("R17","trip-complete","Trip complete & payment"),("R18","rate-driver","Rate driver"),("R19","invoice","Invoice"),("R55","money-breakdown","Where your money went"),("R23","schedule-ride","Schedule a ride")]),
  ("Long-distance travel", [("R32","intercity-search","Long-distance search"),("R33","intercity-results","Long-distance options"),("R34","shared-seat","Shared seat details"),
                            ("R35","bus-seats","Bus seat & boarding point"),("R43","rentals","Car & bike rentals"),("R36","trip-plan","Trip plan (multi-leg)"),
                            ("R37","along-route","Stops along the route")]),
  ("No-network planning", [("R38","coverage-warning","No-network warning"),("R39","offline-pack","Offline pack & backup plan"),("R40","offline-trip","Travelling offline")]),
  ("Stays and food", [("R41","hotels","Hotels"),("R42","hotel-detail","Hotel detail & booking"),("R44","food-home","Food home"),("R45","restaurant-menu","Menu & cart"),
                      ("R46","food-tracking","Food order tracking")]),
  ("Parcels", [("R47","send-parcel","Send a parcel"),("R48","parcel-tracking","Parcel tracking & proof")]),
  ("Savings", [("R49","savings-hub","Deals & savings hub"),("R50","price-alert","Flexible: price alert"),("R22","offers","Offers & coupons"),("R21","wallet","Wallet")]),
  ("Account and help", [("R54","bookings-wallet","Trips & tickets"),("R56","notifications","Notifications"),("R20","ride-history","Ride history"),("R24","emergency-contacts","Emergency contacts"),("R25","kyc","Rider KYC"),
                        ("R26","support-ai","Support & AI assistant"),("R27","complaint","Complaint / lost item"),("R28","account","Account & settings")]),
 ],
 "driver": [
  ("Join", [("D01","login","Driver login"),("D02","registration","Registration"),("D03","documents","Upload documents"),("D04","verification","Verification status")]),
  ("Go online", [("D05","home-offline","Home (offline)"),("D21","service-modes","Choose services"),("D06","online","Online & waiting"),("D17","document-alerts","Document expiry alerts")]),
  ("City rides", [("D07","ride-request","Incoming ride request"),("D08","to-pickup","Navigate to pickup"),("D29","call-rider","Call rider"),("D09","arrived-otp","Arrived & start trip"),("D10","trip-navigation","Trip navigation"),
                  ("D11","trip-complete","Trip complete & collect"),("D12","rate-rider","Rate rider")]),
  ("Deliveries", [("D22","delivery-request","Delivery request"),("D23","pickup-proof","Pickup & delivery proof")]),
  ("Long-distance", [("D24","publish-intercity","Publish a long trip"),("D25","trip-manifest","Seats & parcels manifest"),("D26","dead-zone","No-network stretch ahead")]),
  ("Safety and connection", [("D18","sos","Driver SOS"),("D19","offline-sync","Offline mode & sync")]),
  ("Money and help", [("D13","earnings","Earnings"),("D27","daily-fee","Today's earnings & daily fee"),("D14","wallet-payouts","Wallet & payouts"),("D15","incentives","Incentives"),("D16","trip-history","Trip history"),("D20","support","Driver support")]),
  ("Account", [("D28","account","Account & profile")]),
 ],
 "partner": [
  ("Join", [("P08","sign-in","Partner sign-in"),("P01","onboarding","Partner onboarding")]),
  ("Home", [("P09","home","Partner home")]),
  ("Restaurants", [("P02","restaurant-orders","Restaurant orders"),("P03","menu","Menu & availability")]),
  ("Hotels", [("P04","hotel-rooms","Rooms, rates & bookings")]),
  ("Rentals", [("P05","rental-fleet","Rental fleet calendar")]),
  ("Bus operators", [("P06","bus-schedule","Bus schedule & seats")]),
  ("All partners", [("P07","payouts-reviews","Payouts & reviews"),("P10","settings","Business profile & settings"),("P11","support","Support & complaints")]),
 ],
 "admin": [
  ("Operations", [("A01","login-mfa","Admin login & MFA"),("A02","command-center","Operations command center"),("A03","live-map","Live map"),("A04","ride-detail","Ride detail & timeline"),
                  ("A27","orders-board","Food & parcel orders")]),
  ("Services and countries", [("A23","services-countries","Services & countries"),("A26","intercity-sharing","Long-distance & sharing"),("A25","coverage-map","Network coverage map"),
                              ("A24","partner-review","Partner onboarding review")]),
  ("People", [("A05","riders","Riders"),("A06","drivers","Drivers"),("A07","kyc-review","KYC review"),("A08","vehicles","Vehicles & fleet")]),
  ("Money", [("A09","pricing-surge","Pricing & surge"),("A29","fees-taxes","Daily fees, taxes & zone rates"),("A10","zones","Zones & geofences"),("A11","payments","Payments & refunds"),("A28","deals-loyalty","Deals & loyalty")]),
  ("Trust", [("A12","support-tickets","Support tickets"),("A30","disputes","Disputes"),("A13","safety-sos","Safety & SOS console"),("A14","fraud-review","Fraud review queue"),("A15","telephony","Telephony console"),("A31","agent-portal-control","Agent portal control")]),
  ("Insight and control", [("A16","ai-insights","AI insights"),("A17","reports","Reports & analytics"),("A18","government-reports","Government reports"),("A19","audit-log","Audit log"),
                           ("A20","roles-permissions","Roles & permissions"),("A21","notifications","Notifications & campaigns"),("A22","configuration","System configuration")]),
 ],
 "support": [
  ("Get help", [("S01","who-needs-help","Who needs help?"),("S02","home","Support home"),("S03","issues","Topic and issues"),("S04","article","Help article")]),
  ("Tickets", [("S05","related-record","Related trip or order"),("S06","new-ticket","New ticket"),("S07","my-tickets","My tickets"),("S08","conversation","Ticket conversation"),("S11","feedback","Rate your support")]),
  ("Chat and call", [("S09","chat","Live chat"),("S10","call-back","Call me back")]),
  ("Agent console", [("S20","agent-sign-in","Agent sign-in"),("S21","queue","Agent queue"),("S22","case","Case workspace"),("S23","tickets","All tickets"),("S24","chats","Live chats")]),
 ],
}
APPS = {app: [x for _, lst in secs for x in lst] for app, secs in SECTIONS.items()}
_ALL = {sid: (app, slug, title) for app, lst in APPS.items() for sid, slug, title in lst}

def sfile(sid):
    app, slug, _ = _ALL[sid]
    return f"screens/{app}/{sid}-{slug}.html"

def stitle(sid):
    return _ALL[sid][2]

def sapp(sid):
    return _ALL[sid][0]

def slink(sid, rel):
    return f'<a href="{rel}{sfile(sid)}">{sid} {stitle(sid)}</a>'
