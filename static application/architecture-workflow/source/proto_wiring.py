"""Prototype wiring: turns the static mock markup of each screen into working controls.

Runs at build time (screenlib.build_app) on the mock HTML, before inline styles are extracted.
Nothing here is executable code in the page: it only sets semantic tags and data attributes that
assets/js/rn-ui.js interprets.

Attributes produced
  data-go="R03"       navigate to a screen (also a real href when the element becomes <a>)
  data-do="cmd"       run a mock-engine command ("ride.request") or a screen-controller action ("x.verifyOtp")
  data-arg="..."      argument for data-do
  data-ui="pick"      select this option within its group;  data-ui="toggle" switch on/off
  data-msg="..."      show a clearly labelled "simulated" message (features with no prototype flow)
  data-confirm="..."  ask for confirmation first (destructive actions)
  data-hold="2000"    press and hold (SOS)
  data-bind="name"    element whose text a screen controller updates from the mock state
  data-back           go back (history, or data-back-to when opened directly)

Table entries: (selector, text, spec)
  selector  class name, tag name, "@icon" (element directly holding that icon) ; optional "#n" for the nth match
  text      None or "*" = any; "=abc" exact text; otherwise substring of the element's text
  "*" as text with spec all=True applies to every match.
A table entry that matches no element, or more than one (without #n / all), stops the build.
"""
import html as _html
import re

import htmltree
import components as C
from registry import APPS, sfile, sapp

ICON_BY_SVG = {v: k for k, v in C._IC.items()}
ICON_LABEL = {"back": "Back", "phone": "Call (masked)", "bell": "Notifications", "settings": "Settings", "chat": "Chat", "menu": "Menu",
              "filter": "Filters", "share": "Share", "map": "Map view", "search": "Search", "x": "Close"}
TAGS = {"a", "b", "td", "tr", "div", "span", "label", "i", "em"}
# classes whose CSS sets display explicitly, so turning the element into <a> cannot change layout
DISPLAY_SAFE = {"li", "opt", "chip", "card-m", "place", "mode", "center", "box", "kpi", "slide", "loc", "st", "tag", "dcard", "banner", "bn", "s", "e", "kv"}
INTERACTIVE = ("go", "do", "ui", "msg", "back")

SIM = "Simulated in the prototype: "

def G(sid, **k): return dict(go=sid, **k)
def D(cmd, go=None, **k):
    d = dict(do=cmd, **k)
    if go: d["go"] = go
    return d
def M(text, **k): return dict(msg=SIM + text, **k)
PICK = dict(ui="pick")
TOG = dict(ui="toggle")
def ALL(spec): return dict(spec, all=True)
def INPUT(name, **attrs): return {"input": dict(name=name, **attrs)}
def OTP(name, n=None): return {"otp": name, "n": n}

# ------------------------------------------------------------------ per-screen table
W = {
 # ----------------------------------------------------------- rider: get started
 "R01": [],
 "R02": [("chip", "English", G("R53")), ("btn", "Get started", G("R58"))],
 "R03": [("xs", "Terms and Privacy", G("R57")), ("inp", "Mobile number", INPUT("phone", type="tel", inputmode="numeric", autocomplete="tel-national", maxlength="12", required=None, value="98480 04321")),
         ("btn", "Send OTP", D("x.sendOtp", next="R04")), ("btn", "Google", M("Google sign-in is not connected. A phone number is still required.")),
         ("btn", "Apple", M("Apple sign-in is not connected. A phone number is still required."))],
 "R04": [("otp", None, OTP("riderOtp", 6)), ("btn", "Verify", D("x.verifyOtp", next="R05 R29")), ("b", "=Edit", G("R03")),
         ("xs", "Resend code", D("x.resendOtp", bind="resend"))],
 "R05": [("chip", "Add photo", M("photo picker. Nothing is uploaded.")), ("chip", "=Woman", PICK), ("chip", "=Man", PICK), ("chip", "=Non-binary", PICK),
         ("chip", "=Prefer not to say", PICK),
         ("inp", "Full name", INPUT("name", autocomplete="name", required=None, value="Ananya Rao", maxlength="50")),
         ("inp", "Email", INPUT("email", type="email", autocomplete="email", value="ananya@example.com")),
         ("inp", "Referral", INPUT("referral", placeholder="FRIEND100", autocomplete="off")), ("btn", "Continue", D("x.profile", next="R06"))],
 "R06": [("toggle", "*", ALL(TOG)), ("btn", "Allow and continue", D("x.permissions", next="R29"))],
 "R53": [("li", "*", ALL(PICK)), ("chip", "*", ALL(PICK))],
 # ----------------------------------------------------------- rider: home and choices
 "R29": [("chip", "INR", G("R53")), ("box", "Where to", G("R08")), ("b", "Road 12, Banjara Hills", G("R08")), ("@bell", None, G("R56", label="Notifications")),
         ("mode", "*", ALL(D("x.priority", go="R30"))),
         ("a", "=Ride", G("R07")), ("a", "Bike taxi", G("R09")), ("a", "=Auto", G("R09")), ("a", "Long trip", G("R32")), ("a", "Share seat", G("R33")),
         ("a", "=Bus", G("R33")), ("a", "Rentals", G("R43")), ("a", "Hotels", G("R41")), ("a", "=Food", G("R44")), ("a", "Parcel", G("R47")),
         ("a", "Plan trip", G("R52")), ("a", "=Deals", G("R49")), ("card-m", "Kozhikode", G("R36")), ("card-m", "You saved", G("R49"))],
 "R30": [("opt", "*", ALL(dict(PICK, do="x.priorityOpt"))), ("toggle", "*", ALL(TOG)), ("btn", "Show options", G("R31"))],
 "R52": [("chip", "Book this plan", G("R36")), ("chip", "Make it faster", M("the AI assistant would re-plan for speed.")), ("chip", "Add a hotel", G("R41")),
         ("chip", "Cheaper?", M("the AI assistant would re-plan for price."))],
 "R51": [("btn", "=Call 112", M("this would open the phone dialer for 112. No call is made.")), ("btn", "Ambulance 108", M("this would open the dialer for 108. No call is made.")),
         ("li", "*", ALL(PICK)), ("btn", "Fastest ride", D("x.emergencyRide", next="R11")), ("btn", "Share my location", M("live location link to your emergency contacts. Nothing is sent."))],
 # ----------------------------------------------------------- rider: city rides
 "R07": [("@bell", None, G("R56", label="Notifications")), ("chip", "Now", G("R23")), ("b", "=Where to?", G("R08")), ("li", "=HomeRoad 12, Banjara Hills", D("x.destination", arg="Home", next="R09")),
         ("li", "Work", D("x.destination", arg="Work")), ("opt#1", None, D("x.vehicle", go="R09", label="Bike")), ("opt#2", None, D("x.vehicle", go="R09", label="Auto")), ("opt#3", None, D("x.vehicle", go="R09", label="Cab")), ("opt#4", None, D("x.vehicle", go="R09", label="Premium")), ("banner", "RIDE50", G("R22"))],
 "R08": [("li", "Hitec City Metro Station", D("x.destination", next="R09 R31")), ("li", "Cyber Towers", D("x.destination")), ("li", "Hitex", D("x.destination")),
         ("li", "Set location on map", M("dragging a pin on a real map.")), ("li", "Rajiv Gandhi", D("x.destination")), ("li", "Inorbit", D("x.destination"))],
 "R31": [("mode", "*", ALL(PICK)), ("opt", "*", ALL(PICK)), ("chip", "*", ALL(TOG)), ("btn", "Book shared cab", D("x.book", arg="Shared cab", next="R10"))],
 "R09": [("chip", "high demand", G("R55")), ("opt", "*", ALL(dict(PICK, do="x.vehicle"))), ("chip", "UPI", G("R10")), ("chip", "Apply coupon", G("R22")),
         ("btn", "Book Cab", D("x.book", bind="book", next="R10"))],
 "R10": [("li", "*", ALL(dict(PICK, do="x.pay"))), ("btn", "Confirm pickup", D("x.request", next="R11"))],
 "R11": [("btn", "Cancel request", D("x.cancelRide", confirm="Cancel this ride request? Cancelling while we search is free."))],
 "R12": [("h2", "Arriving in", dict(bind="eta")), ("xs", "1.1 km away", dict(bind="dist")), ("chip", "OTP 4827", dict(bind="otp")),
         ("center", "=Call", G("R13")), ("center", "=Chat", G("R14")), ("center", "=Share", M("a trip-sharing link. Nothing leaves this browser.")),
         ("center", "=Safety", G("R16")), ("btn", "Cancel ride", D("x.cancelRide", confirm="Cancel this ride? A cancellation fee may apply after the free window."))],
 "R13": [("center", "=Mute", TOG), ("center", "=Speaker", TOG), ("center", "=Keypad", M("call keypad.")), ("@phone#2", None, dict(back=True, label="End call"))],
 "R14": [("chip", "*", ALL(D("x.quickReply")))],
 "R15": [("loc", "Change destination", G("R08")), ("btn", "Share trip", M("a live trip link for your contacts. Nothing is sent.")),
         ("btn", "=Safety", G("R24")), ("btn", "=SOS", G("R16")), ("xs", "Drop at", dict(bind="drop"))],
 "R16": [("sos-ring", None, D("x.sos", hold="2000", label="SOS: press and hold for 2 seconds")), ("btn", "Call 112", M("this would open the phone dialer for 112. No call is made."))],
 "R17": [("btn", "Rate your ride", G("R18")), ("xs", "View invoice", G("R19")), ("kv", "High demand", G("R55")),
         ("kv", "Paid by UPI", dict(bind="payline"))],
 "R18": [("chip", "Safe driving", TOG), ("chip", "Clean car", TOG), ("chip", "=Polite", TOG), ("chip", "Knew the route", TOG), ("chip", "Good music", TOG),
         ("chip", "=₹10", PICK), ("chip", "=₹20", PICK), ("chip", "=₹50", PICK), ("chip", "=Other", PICK), ("btn", "Submit", D("x.rate", next="R29"))],
 "R19": [("btn", "Download PDF", M("PDF download is not part of the prototype.")), ("btn", "=Email", M("emailing the invoice. Nothing is sent."))],
 "R55": [],
 "R23": [("chip", "*", ALL(PICK)), ("opt", "*", ALL(PICK)), ("btn", "Schedule for", D("x.schedule", next="R20"))],
 # ----------------------------------------------------------- rider: long distance, offline
 "R32": [("chip", "*", ALL(PICK)), ("toggle", "*", ALL(TOG)), ("mode", "*", ALL(PICK)), ("btn", "Find options", G("R33"))],
 "R33": [("chip", "*", ALL(PICK)), ("opt", "State bus", G("R35")), ("opt", "Shared cab seat", G("R34")), ("opt", "AC seater bus", G("R35")),
         ("opt", "Private cab", G("R36")), ("opt", "Self-drive car", G("R43")), ("span", "About 30 km with no mobile network", G("R38"))],
 "R34": [("li", "Mavoor Road bus bay", PICK), ("li", "Thamarassery junction", PICK), ("btn", "Book 1 seat", D("x.simBook", arg="Shared seat booked (simulated, nothing charged)", go="R36"))],
 "R35": [("li", "*", ALL(PICK)), ("btn", "Continue to pay", D("x.simBook", arg="Bus seat 14 booked (simulated, nothing charged)", go="R36"))],
 "R43": [("chip", "*", ALL(PICK)), ("place", "*", ALL(D("x.simBook", arg="Rental added to your trip plan (simulated)", go="R36")))],
 "R36": [("b", "No network for", G("R38")), ("b", "Breakfast stop", G("R37")), ("b", "Hotel (optional)", G("R41")), ("b", "Scooter rental (optional)", G("R43")), ("btn", "Customise", G("R37")), ("btn", "Book all", D("x.simBook", arg="All legs booked (simulated, nothing charged)", go="R54"))],
 "R37": [("chip", "*", ALL(PICK)), ("li", "*", ALL(D("x.simBook", arg="Stop added to your plan (simulated)", go="R36")))],
 "R38": [("li", "Download offline pack", G("R39")), ("li", "Route with coverage", PICK), ("li", "Stop before", G("R37")), ("li", "Auto check-in", PICK),
         ("btn", "Set up my backup plan", G("R39"))],
 "R39": [("btn", "=Done", G("R40"))],
 "R40": [("li", "SOSSends", D("x.sos")), ("li", "Bus ticket QR", G("R54"))],
 # ----------------------------------------------------------- rider: stays, food, parcels
 "R41": [("chip", "Near bus stand", PICK), ("place", "*", ALL(G("R42")))],
 "R42": [("opt", "*", ALL(PICK)), ("btn", "Add to trip plan", D("x.simBook", arg="Room added to your trip plan (simulated)", go="R36"))],
 "R44": [("mode", "*", ALL(PICK)), ("chip", "*", ALL(TOG)), ("place", "*", ALL(G("R45")))],
 "R45": [("opt", "*", ALL(dict(PICK, do="x.delivery"))), ("btn", "Pay ₹458", D("x.placeOrder", next="R46"))],
 "R46": [("h2", "Arriving in", dict(bind="eta"))],
 "R47": [("chip", "*", ALL(PICK)), ("opt", "*", ALL(PICK)), ("btn", "Book pickup", D("x.simBook", arg="Parcel pickup booked (simulated)", go="R48"))],
 "R48": [("btn", "Call traveller", M("masked call to the traveller. No call is made.")), ("btn", "Share tracking", M("a tracking link. Nothing is sent."))],
 # ----------------------------------------------------------- rider: savings
 "R49": [("btn", "Try free", M("7-day pass trial started. Nothing is charged.")), ("li", "Share a seat", G("R33")), ("li", "Off-peak", G("R50")),
         ("li", "BIRYANI40", G("R44")), ("li", "Parcel with a traveller", G("R47")), ("li", "Alert un", G("R50"))],
 "R50": [("toggle", "*", ALL(TOG)), ("btn", "Start watching", D("x.simBook", arg="Price alert created (simulated)", go="R54"))],
 "R22": [("btn", "=Apply", D("x.coupon", next="R09")), ("btn", "Share invite", M("sharing your invite code. Nothing is sent."))],
 "R21": [("btn", "Add money", M("wallet top-up. No payment is taken.")), ("btn", "History", M("wallet history.")), ("li", "Add card or UPI", M("adding a payment method. Never enter real card details."))],
 # ----------------------------------------------------------- rider: account and help
 "R54": [("chip", "*", ALL(PICK)), ("li", "Scooter rental", G("R43")), ("li", "Heritage View", G("R42")), ("li", "Auto to bus stand", G("R36")),
         ("li", "Biryani House", G("R46")), ("li", "Parcel PRC", G("R48"))],
 "R20": [("chip", "*", ALL(PICK)), ("li", "Banjara Hills", G("R19")), ("li", "Home → Airport", G("R19")), ("li", "Inorbit Mall", G("R27")),
         ("li", "Home → Work", G("R19")), ("li", "Work → Jubilee", G("R19"))],
 "R24": [("li", "Add contact", M("contact picker. Nothing is read from your phone.")), ("toggle", "*", ALL(TOG))],
 "R25": [("upload", "Take a selfie", M("camera capture. No photo is taken.")), ("btn", "Continue", G("R28"))],
 "R26": [("chip", "Talk to agent", M("connecting to an agent.")), ("chip", "Yes, review it", D("x.ticket", arg="Fare review")), ("chip", "That's fine", M("issue closed.")),
         ("chip", "Lost item", G("R27")), ("chip", "Payment issue", G("R27")), ("chip", "Safety concern", G("R16"))],
 "R27": [("li", "*", ALL(PICK)), ("upload", "Add a photo", M("photo picker. Nothing is uploaded.")), ("btn", "Submit", D("x.ticket", arg="Complaint"))],
 "R28": [("li", "Ananya", G("R05")), ("li", "=Profile", G("R05")), ("li", "Saved places", M("saved places editor.")), ("li", "Payment methods", G("R21")),
         ("li", "Safety & emergency", G("R24")), ("li", "Verify identity", G("R25")), ("li", "Language", G("R53")), ("li", "=Notifications", M("notification settings.")),
         ("li", "Privacy", M("data download or deletion request.")), ("li", "=Help", G("R26")),
         ("li", "Log out", D("x.signOut", arg="rider", confirm="Log out of the rider app?", next="R03"))],
 # ----------------------------------------------------------- driver
 "D01": [("inp", "Mobile number", INPUT("phone", type="tel", inputmode="numeric", autocomplete="tel-national", maxlength="12", required=None, value="90000 12345")), ("btn", "Send OTP", D("x.driverLogin", next="D05 D02"))],
 "D02": [("chip", "=Bike", PICK), ("chip", "=Auto", PICK), ("chip", "=Cab", PICK), ("chip", "Yes, my own", PICK), ("chip", "Fleet vehicle", PICK),
         ("inp", "Full name", INPUT("fullname", autocomplete="name", required=None, value="Arjun Kumar", maxlength="50")), ("btn", "=Next", D("x.register", next="D03"))],
 "D03": [("li", "Driving licence", D("x.uploadDoc", arg="licence")), ("li", "Vehicle RC", D("x.uploadDoc", arg="rc")), ("li", "InsurancePhoto unclear", D("x.uploadDoc", arg="insurance")),
         ("li", "=PermitCommercial permitUpload", D("x.uploadDoc", arg="permit")), ("li", "Fitness certificate", D("x.uploadDoc", arg="fitness")),
         ("li", "Police verification", D("x.uploadDoc", arg="police")), ("li", "Profile photo", D("x.uploadDoc", arg="photo")), ("btn", "Submit for review", D("x.submitKyc", next="D04"))],
 "D04": [("btn", "Watch training", D("x.training", next="D05"))],
 "D05": [("slide", "go online", D("x.goOnline", label="Go online", next="D06")), ("banner", "Insurance expires", G("D17")), ("card-m", "This week", G("D13"))],
 "D06": [("btn", "Go offline", D("x.goOffline", next="D05")), ("banner", "High demand", M("heat map of demand.")), ("card-m", "Evening quest", G("D15"))],
 "D21": [("b", "Shared seats on long trips", G("D24")), ("toggle", "*", ALL(TOG)), ("btn", "Save and go online", D("x.goOnline", next="D06"))],
 "D17": [("btn", "Upload new PUC", D("x.renewDoc", next="D05"))],
 "D07": [("btn", "Decline", D("x.decline", next="D06")), ("btn", "Accept", D("x.accept", next="D08"))],
 "D08": [("@phone", None, G("D29", label="Call rider")), ("slide", "arrived", D("x.arrive", label="Arrived at pickup", next="D09")), ("h2", "Picking up", dict(bind="title")), ("xs", "4 min", dict(bind="eta"))],
 "D09": [("@phone", None, G("D29", label="Call rider")), ("otp", None, OTP("tripOtp", 4)), ("btn", "Start trip", D("x.startTrip", next="D10")), ("chip", "Waiting", dict(bind="waiting"))],
 "D10": [("chip", "SOS", G("D18")), ("slide", "end trip", D("x.endTrip", label="End trip", next="D11"))],
 "D11": [("btn", "Rate rider", G("D12"))],
 "D12": [("chip", "*", ALL(TOG)), ("btn", "=Done", D("x.rateRider", next="D06"))],
 "D22": [("btn", "Decline", D("x.declineDelivery", next="D06")), ("btn", "Accept", D("x.acceptDelivery", next="D23"))],
 "D23": [],
 "D24": [("chip", "Mavoor", TOG), ("chip", "Thamarassery", TOG), ("chip", "+ Add", M("adding a stop.")), ("toggle", "*", ALL(TOG)),
         ("btn", "Publish trip", D("x.simBook", arg="Trip published with 3 seats and boot space (simulated)", go="D25"))],
 "D25": [("li", "Ananya R.", D("x.simBook", arg="Ananya R. checked in (simulated)")), ("li", "Meena K.", D("x.simBook", arg="Meena K. checked in (simulated)")),
         ("li", "Joseph T.", D("x.simBook", arg="Joseph T. checked in (simulated)")), ("li", "PRC-88214", D("x.simBook", arg="Parcel code scanned (simulated)", go="D26")),
         ("li", "PRC-88230", D("x.simBook", arg="Parcel code scanned (simulated)"))],
 "D26": [("li", "Offline navigation", G("D19"))],
 "D18": [("li", "Rider behaviour", D("x.driverSos")), ("li", "Accident", D("x.driverSos")), ("li", "Vehicle breakdown", D("x.driverSos")),
         ("li", "Feeling unsafe", D("x.driverSos")), ("btn", "Call 112", M("this would open the phone dialer for 112. No call is made."))],
 "D19": [("btn", "Retry now", D("x.sync"))],
 "D13": [("big-num", "₹14,730", G("D14")), ("chip", "This week", M("period picker.")), ("li", "Trip earnings", G("D16")), ("li", "Quests", G("D15")), ("li", "Daily fees", G("D27"))],
 "D27": [("chip", "*", ALL(PICK))],
 "D14": [("btn", "Cash out", M("instant payout request. No money moves.")), ("li", "Daily fees this week", G("D27"))],
 "D15": [("btn", "Share code", M("sharing your referral code. Nothing is sent."))],
 "D16": [("chip", "*", ALL(PICK)), ("li", "*", ALL(G("D20")))],
 "D20": [("li", "Payout or earnings", D("x.ticket", arg="Payout issue")), ("li", "Fare or trip dispute", D("x.ticket", arg="Trip dispute")),
         ("li", "Account blocked", D("x.ticket", arg="Account review")), ("li", "Documents and verification", G("D04")), ("li", "App not working", D("x.ticket", arg="App problem")),
         ("li", "=Incentives", G("D15")), ("btn", "Call driver helpline", M("calling the helpline. No call is made."))],
 # ----------------------------------------------------------- partner
 "P01": [("a", "*", ALL(PICK)), ("btn", "Start application", D("x.partnerApply", next="P02 P04 P05 P06"))],
 "P02": [("chip", "=10 min", PICK), ("chip", "=15 min", PICK), ("chip", "=20 min", PICK), ("btn", "=Reject", D("x.orderReject", confirm="Reject this order? The customer is refunded automatically.")),
         ("btn", "=Accept", D("x.orderAccept"))],
 "P03": [("chip", "Pause 30 min", M("pausing new orders for 30 minutes.")), ("toggle", "*", ALL(D("x.simBook", ui="toggle", arg="Menu availability updated (simulated)")))],
 "P04": [("li", "*", ALL(M("booking details.")))],
 "P05": [("chip", "*", ALL(TOG)), ("btn", "Start handover photos", M("handover photos with the camera. No photo is taken."))],
 "P06": [("li", "*", ALL(M("trip and boarding details.")))],
 "P07": [("li", "*", ALL(M("replying to a review.")))],
 # ----------------------------------------------------------- admin
 "A01": [("div", "=7309", OTP("adminMfa", 6)), ("dbtn", "Verify and sign in", D("x.mfa", next="A02"))],
 "A02": [("dbtn", "Open console", G("A13")), ("kpi", "Active rides", G("A03")), ("kpi", "Open SOS", G("A13")), ("kpi", "Payment failures", G("A11")),
         ("tr", "KYC documents waiting", G("A07")), ("tr", "Payouts failed", G("A11")), ("tr", "Tickets past SLA", G("A12")), ("tr", "Fraud cases", G("A14")),
         ("tr", "RN-00125", G("A04"))],
 "A03": [("dbtn", "Open ride", G("A04")), ("dbtn", "Call driver", G("A15")), ("dbtn", "=Message", M("message to the driver. Nothing is sent."))],
 "A04": [("st", "TRIP_IN_PROGRESS", dict(bind="state")), ("dbtn", "Call rider", G("A15")), ("dbtn", "Call driver", G("A15")), ("dbtn", "=Refund", D("x.refund")),
         ("dbtn", "Cancel ride", D("ride.cancel", confirm="Cancel this ride for the rider and driver?")), ("dbtn", "Open incident", D("x.openIncident", next="A13"))],
 "A05": [("dbtn", "Export CSV", D("x.adminAction", arg="report.export|export riders|report.exported"))],
 "A06": [("dbtn", "Invite fleet", M("fleet owner invitation. Nothing is sent."))],
 "A07": [("tr", "Arjun K. · Insurance", D("x.applicant")), ("dfield", "Reason", INPUT("reason", placeholder="Reason (required to reject or ask again)", maxlength="200")),
         ("dbtn", "=Approve", D("x.kyc", arg="approve")), ("dbtn", "Ask to re-upload", D("x.kyc", arg="reupload")), ("dbtn", "=Reject", D("x.kyc", arg="reject", confirm="Reject this driver application?"))],
 "A08": [("dbtn", "Add vehicle", M("vehicle form."))],
 "A09": [("dbtn", "Edit rules", D("x.adminAction", arg="pricing.edit|edit pricing rules|pricing.rules_changed")), ("dbtn", "Version history", M("pricing version history.")),
         ("dbtn", "Simulate a trip", G("A29"))],
 "A29": [("dbtn", "Propose change", D("x.adminAction", arg="pricing.edit|propose a fee change|fees.schedule_proposed")), ("dbtn", "Version history", M("fee version history.")),
         ("dbtn", "Simulate a driver day", M("the calculator on architecture page 26 runs this simulation."))],
 "A10": [("dbtn", "Draw polygon", M("polygon drawing on a map.")), ("dbtn", "Import GeoJSON", M("file import."))],
 "A11": [("dbtn", "Reconciliation report", D("x.adminAction", arg="report.export|export the reconciliation report|report.exported")),
         ("dbtn", "Issue refund", D("x.refund")), ("dbtn", "=Cancel", M("form cleared."))],
 "A28": [("dbtn", "=Create", D("x.adminAction", arg="coupon.create|create a coupon|coupon.created")), ("dbtn", "Simulate cost", M("campaign cost estimate."))],
 "A12": [("tr", "48790", G("A30")), ("dbtn", "=Reply", M("reply to the customer. Nothing is sent.")), ("dbtn", "Macro", G("A31")), ("dbtn", "Call rider", G("A15")),
         ("dbtn", "Resolve", D("x.adminAction", arg="ticket.resolve|resolve a ticket|ticket.resolved"))],
 "A13": [("dbtn", "Assign to me", D("incident.ack")), ("dbtn", "Call rider (masked)", G("A15")), ("dbtn", "Call driver (masked)", G("A15")),
         ("dbtn", "Message contacts", M("message to emergency contacts. Nothing is sent.")), ("dbtn", "Record police", D("incident.escalate", confirm="Record that police/ambulance were contacted by an agent? (Simulated – nobody is contacted.)"))],
 "A14": [("dbtn", "Block account", D("admin.block", arg="rider:U-2231", confirm="Block this account?")), ("dbtn", "Ask for verification", M("verification request. Nothing is sent.")),
         ("dbtn", "=Clear", D("x.adminAction", arg="fraud.block_account|clear a fraud case|fraud.decided"))],
 "A15": [],
 "A16": [("dbtn", "Apply#1", D("x.adminAction", arg="pricing.edit|apply an AI recommendation|ml.recommendation_applied")),
         ("dbtn", "Apply#2", D("x.adminAction", arg="pricing.edit|apply an AI recommendation|ml.recommendation_applied"))],
 "A17": [("dbtn", "New report", M("report builder.")), ("dbtn", "=Export", D("x.adminAction", arg="report.export|export a report|report.exported")),
         ("dbtn", "=Run", ALL(M("running a saved report.")))],
 "A18": [("dbtn", "Approve & submit", D("x.adminAction", arg="government_report.approve|approve and submit a government report|report.approved")),
         ("dbtn", "Send back", M("report returned to its author.")), ("dbtn", "Preview PDF", M("PDF preview."))],
 "A19": [("dbtn", "Export", D("x.adminAction", arg="audit.view|export the audit log|report.exported"))],
 "A20": [("dbtn", "New role", D("x.adminAction", arg="config.edit|create a role|admin.role_changed"))],
 "A21": [("dbtn", "Schedule", D("x.adminAction", arg="campaign.send|schedule a campaign|campaign.scheduled")), ("dbtn", "Send test", M("test notification. Nothing is sent."))],
 "A22": [("dbtn", "Save changes", D("x.adminAction", arg="config.edit|change system configuration|config.changed"))],
 "A23": [], "A26": [],
 "A24": [("dbtn", "=Approve", D("x.adminAction", arg="partner.approve|approve a partner|partner.approved")), ("dbtn", "Ask for more", M("request for more documents.")),
         ("dbtn", "=Reject", D("x.adminAction", arg="partner.approve|reject a partner|partner.rejected", confirm="Reject this partner application?"))],
 "A25": [("dbtn", "Publish to apps", D("x.adminAction", arg="coverage.publish|publish coverage zones|coverage.zones_published")),
         ("dbtn", "Add road restriction", M("road restriction editor."))],
 "A27": [("dbtn", "Credit ₹50#1", D("x.adminAction", arg="payment.refund|credit a customer|refund.issued")), ("dbtn", "Credit ₹50#2", D("x.adminAction", arg="payment.refund|credit a customer|refund.issued")),
         ("dbtn", "=Call", G("A15")), ("dbtn", "Credit ₹30", D("x.adminAction", arg="payment.refund|credit a customer|refund.issued"))],
 # ----------------------------------------------------------- added in the static application phase
 "R58": [("btn", "Create an account", D("x.authMode", arg="register", next="R03")), ("btn", "I already have an account", D("x.authMode", arg="login", next="R03")),
         ("li", "Ananya Rao", D("x.demoAccount", arg="existing", next="R03")), ("li", "New customer", D("x.demoAccount", arg="new", next="R03")),
         ("b", "Terms and Privacy Policy", G("R57"))],
 "R57": [("btn", "I understand", dict(back=True))],
 "R56": [("chip", "*", ALL(dict(PICK, do="x.notifFilter")))],
 "D28": [("li", "White Swift Dzire", M("vehicle details. Changes need re-inspection.")), ("li", "Documents", G("D17")), ("li", "Services", G("D21")),
         ("li", "Driver support", G("D20")), ("li", "Help centre", G("D20")), ("btn", "Log out", D("x.signOut", arg="driver", confirm="Log out of the driver app?", next="D01"))],
 "D29": [("center", "=Mute", TOG), ("center", "=Speaker", TOG), ("center", "=Message", M("quick message to the rider.")), ("@phone", None, dict(back=True, label="End call"))],
 "P08": [("inp", "Business e-mail", INPUT("email", type="email", autocomplete="email", required=None, value="orders@biryanihouse.example")),
         ("inp", "Verification code", INPUT("code", inputmode="numeric", maxlength="6", autocomplete="one-time-code", placeholder="6-digit code")),
         ("btn", "Sign in", D("x.partnerSignIn", next="P09")), ("b", "Apply to join", G("P01"))],
 "P09": [("chip", "Open", TOG), ("li", "Biryani House", G("P02")), ("li", "Menu & availability", G("P03")), ("li", "Heritage View", G("P04")),
         ("li", "Ride Easy", G("P05")), ("li", "Malabar", G("P06")), ("li", "Payouts & reviews", G("P07"))],
 "P10": [("li", "Opening hours", M("opening hours editor.")), ("li", "Bank account", M("bank details are masked; changes need re-verification.")),
         ("li", "Support & complaints", G("P11")), ("li", "Help centre", G("P11")),
         ("btn", "Log out", D("x.signOut", arg="partner", confirm="Log out of the partner app?", next="P08"))],
 "P11": [("li", "Order dispute", D("x.ticket", arg="Order dispute #4409")), ("li", "Payout or commission", D("x.ticket", arg="Payout or commission question")),
         ("li", "Listing or menu", D("x.ticket", arg="Listing or menu problem")), ("li", "Report a customer", D("x.ticket", arg="Report a customer or delivery partner")),
         ("li", "48731 · Commission", M("closed case details.")), ("btn", "Talk to an agent", D("x.ticket", arg="Talk to an agent"))],
 "A30": [("dbtn", "Approve refund", D("x.adminAction", arg="payment.refund|approve a dispute refund|dispute.decided")),
         ("dbtn", "Ask for evidence", M("evidence request to the rider. Nothing is sent.")),
         ("dbtn", "=Reject", D("x.adminAction", arg="payment.refund|reject a dispute|dispute.decided", confirm="Reject this dispute?"))],
 # support portal – user side
 "S01": [("opt", "Customer", dict(PICK, do="x.userType", arg="rider")), ("opt", "Driver or delivery", dict(PICK, do="x.userType", arg="driver")),
         ("opt", "Business partner", dict(PICK, do="x.userType", arg="partner")), ("btn", "Continue", G("S02")), ("b", "Open the agent console", G("S20"))],
 "S02": [("chip", "Customer", G("S01")), ("inp", "Search help articles", INPUT("q", type="search", placeholder="Search, e.g. refund", autocomplete="off")),
         ("btn", "Chat with us", G("S09")), ("btn", "Call me back", G("S10")), ("btn", "Raise a ticket", D("x.newTicket", next="S05")),
         ("li", "*", ALL(D("x.category", next="S03")))],
 "S03": [("li", "*", ALL(D("x.pickIssue", next="S05"))), ("btn", "Something else", D("x.newTicket", next="S05"))],
 "S04": [("chip", "=Yes", D("x.articleFeedback", arg="yes")), ("chip", "=No", D("x.articleFeedback", arg="no")), ("btn", "Still need help", D("x.newTicket", next="S05"))],
 "S05": [("chip", "*", ALL(dict(PICK, do="x.recordType"))), ("li", "*", ALL(dict(PICK, do="x.pickRecord"))), ("btn", "Continue", D("x.recordContinue", next="S06"))],
 "S06": [("inp", "Category", INPUT("category", tag="select", required=None, change="x.categoryChanged", options=[("payments", "Payments and refunds")])),
         ("inp", "What went wrong?", INPUT("issue", tag="select", required=None, options=["I was charged more than the estimate"])),
         ("inp", "Related trip or order", INPUT("ref", readonly=None, value="RN-20260927-00125")),
         ("chip", "=Urgent", PICK), ("chip", "=High", PICK), ("chip", "=Normal", PICK),
         ("inp", "Describe the problem", INPUT("description", tag="textarea", required=None, maxlength="1000", placeholder="Tell us what happened")),
         ("upload", "Add a screenshot", D("x.attach", label="Add a screenshot (simulated)")), ("btn", "Submit ticket", D("x.submitTicket", next="S08"))],
 "S07": [("chip", "*", ALL(dict(PICK, do="x.ticketFilter"))), ("li", "*", ALL(D("x.openTicket", next="S08"))), ("btn", "Raise a new ticket", D("x.newTicket", next="S05"))],
 "S08": [("inp", "Your message", INPUT("message", placeholder="Write a reply", maxlength="1000", autocomplete="off")),
         ("btn", "=Send", D("x.ticketSend")), ("btn", "Attach file", D("x.ticketAttach")), ("btn", "Close ticket", D("x.ticketCloseToggle")),
         ("btn", "Rate support", D("x.rateGo", next="S11"))],
 "S09": [("inp", "=MessageType a message", INPUT("message", placeholder="Type a message", maxlength="500", autocomplete="off")),
         ("btn", "=Send", D("x.chatSend")), ("btn", "End chat", D("x.chatEnd")), ("btn", "Turn this chat", D("x.chatEscalate", next="S08"))],
 "S10": [("inp", "What is the call about?", INPUT("issue", tag="select", required=None, options=["Payments and refunds"])), ("inp", "We will call", INPUT("phone", readonly=None, value="+91 98••• ••321 (masked)")),
         ("btn", "Request a call-back", D("x.callRequest"))],
 "S11": [("chip", "*", ALL(TOG)), ("inp", "Anything else?", INPUT("comment", placeholder="Optional comment", maxlength="500")),
         ("btn", "Submit feedback", D("x.ticketFeedback", next="S07"))],
 # support portal – agent console
 "S20": [("dfield", "Agent profile", INPUT("agent", tag="select", required=None, options=["Meera S.", "Vikram R.", "Farah N."])), ("dfield", "Demo code", INPUT("code", inputmode="numeric", maxlength="6", placeholder="6-digit code", autocomplete="one-time-code")),
         ("dbtn", "=Sign in", D("x.agentSignIn", next="S21"))],
 "S21": [("st", "=Available", dict(PICK, do="x.agentStatus", arg="AVAILABLE")), ("st", "=Away", dict(PICK, do="x.agentStatus", arg="AWAY")),
         ("st", "=Offline", dict(PICK, do="x.agentStatus", arg="OFFLINE")), ("dbtn", "=Accept", D("x.acceptChat"))],
 "S22": [("dfield", "=ReplyWrite a reply…", INPUT("reply", placeholder="Write a reply…", maxlength="1000")),
         ("dbtn", "Send reply", D("x.caseReply")), ("dbtn", "Add internal note", D("x.caseNote")), ("dbtn", "Assign to me", D("x.caseAssign")),
         ("dfield", "Reassign", INPUT("reassign", tag="select", change="x.caseReassign", options=[("", "Reassign to…"), "Vikram R.", "Farah N."])),
         ("dfield", "=PriorityP2 ▾", INPUT("priority", tag="select", change="x.casePriority", options=[("P1", "P1 · urgent"), ("P2", "P2 · high"), ("P3", "P3 · normal")])),
         ("dbtn", "Escalate", D("x.caseEscalate")), ("dbtn", "Wait for user", D("x.caseWait")),
         ("dfield", "Resolution category", INPUT("rescat", tag="select", options=[("", "Choose a category"), "Information given", "Refund issued", "Lost item returned"])), ("dfield", "Resolution notes", INPUT("resnotes", placeholder="What was done?", maxlength="500")),
         ("dbtn", "=Resolve", D("x.caseResolve")), ("dbtn", "=Close", D("x.caseClose", confirm="Close this ticket?")), ("dbtn", "=Reopen", D("x.caseReopen"))],
 "S23": [],
 "S24": [("dfield", "Reply", INPUT("reply", placeholder="Type a reply…", maxlength="500", autocomplete="off")),
         ("dbtn", "=Send", D("x.agentChatSend")), ("dbtn", "Accept chat", D("x.agentChatAccept")), ("dbtn", "Create ticket", D("x.agentChatTicket")),
         ("dbtn", "End chat", D("x.agentChatEnd", confirm="End this chat?"))],
}

# Navigation the screen controllers do on their own when the shared state changes (rn-screens.js "follow").
# Declared here so the coverage report and the reachability test know about it.
FOLLOW = {"R01": ["R02", "R29"], "R11": ["R12"], "R12": ["R15"], "R15": ["R17"], "D05": ["D06"], "D06": ["D07", "D22"],
          "D22": ["D23"], "D08": ["D09"], "D09": ["D10"], "D10": ["D11"]}

# Rows that screen controllers build from the demo state (lists of articles, tickets, cases, chats) lead here.
DYNAMIC = {"S02": ["S03", "S04"], "S03": ["S04", "S05"], "S07": ["S08"], "S21": ["S22", "S24"], "S23": ["S22"], "S24": ["S22"],
           "R20": ["R19"], "D16": ["D11"], "R56": ["R54"]}

# Bottom navigation and admin sidebar targets
NAV_RIDER = {"Home": "R07", "Trips": "R20", "Wallet": "R21", "Account": "R28"}
NAV_SUPER = {"Home": "R29", "Trips": "R54", "Savings": "R49", "Wallet": "R21", "Account": "R28"}
NAV_DRIVER = {"Home": "D05", "Earnings": "D13", "Trips": "D16", "Account": "D28"}
NAV_PARTNER = {"Orders": "P09", "Listings": "P03", "Payouts": "P07", "Settings": "P10"}
NAV_SUPPORT = {"Help": "S02", "Tickets": "S07", "Chat": "S09", "Call": "S10"}
SUPPORT_SIDEBAR = {"Queue": "S21", "Case workspace": "S22", "All tickets": "S23", "Live chats": "S24", "Sign out": "S20"}
APP_DIRS = {"rider": "customer-app", "driver": "driver-app", "partner": "patner-app", "admin": "admin", "support": "agent-portal"}
MODE = {"app": False}   # True while build_apps.py wires the single-document applications
APP_URLS = {}           # app -> address of its server (set by build_apps.py); links between applications use it
SIDEBAR = {"Command center": "A02", "Live map": "A03", "Rides": "A04", "Food & parcel orders": "A27", "Services & countries": "A23",
           "Long-distance & sharing": "A26", "Network coverage": "A25", "Partners": "A24", "Riders": "A05", "Drivers": "A06", "KYC review": "A07",
           "Vehicles & fleet": "A08", "Pricing & surge": "A09", "Zones & geofences": "A10", "Payments & refunds": "A11", "Deals & loyalty": "A28",
           "Support tickets": "A12", "Safety & SOS": "A13", "Fraud review": "A14", "Telephony": "A15", "Agent portal": "A31", "AI insights": "A16", "Reports": "A17",
           "Government reports": "A18", "Audit log": "A19", "Roles & permissions": "A20", "Notifications": "A21", "Configuration": "A22"}
ICON_DEFAULT = {  # (rider action, driver action) for icon buttons without a table entry
    "phone": (G("R13"), M("masked call to the rider. No call is made.")), "chat": (G("R14"), M("chat with the rider.")),
    "bell": (M("notifications inbox."), M("notifications inbox.")), "settings": (G("R28"), G("D21")), "menu": (G("R28"), G("D04")),
    "filter": (M("filters."), M("filters.")), "share": (M("sharing. Nothing is sent."), M("sharing. Nothing is sent.")),
    "map": (M("full-screen map."), M("full-screen map.")), "search": (M("search."), M("search.")), "x": (dict(back=True), dict(back=True))}


class WiringError(Exception):
    pass


def _norm(s):
    return re.sub(r"\s+", "", s)


def _icon(n, direct=True):
    kids = [c for c in n.children if c.kind == "el"]
    for c in kids if direct else list(n.iter()):
        if c.tag == "svg":
            return ICON_BY_SVG.get("".join(x.serialize() for x in c.children))
    return None


def _excluded(n):
    p = n.parent
    while p is not None and p.kind == "el":
        if p.has_class("dsb") or p.has_class("bnav") or p.has_class("sb"):
            return True
        p = p.parent
    return False


def _find(root, sel, text):
    nth = None
    if "#" in sel:
        sel, nth = sel.split("#"); nth = int(nth)
    if text and "#" in text and text.rsplit("#", 1)[1].isdigit():
        text, nth = text.rsplit("#", 1); nth = int(nth)
    if sel.startswith("@"):
        cands = [n for n in root.iter() if _icon(n) == sel[1:]]
    elif sel in TAGS:
        cands = [n for n in root.iter() if n.tag == sel]
    else:
        cands = [n for n in root.iter() if n.has_class(sel)]
    cands = [n for n in cands if not _excluded(n)]
    if text and text != "*":
        if text.startswith("="):
            want = _norm(_html.unescape(text[1:]))
            cands = [n for n in cands if _norm(n.text_content()) == want]
        else:
            want = _norm(_html.unescape(text))
            cands = [n for n in cands if want in _norm(n.text_content())]
        ids = {id(n) for n in cands}
        cands = [n for n in cands if not any(id(d) in ids for d in n.iter())]   # keep the deepest match
    return cands, nth


def _href(app, target):
    if MODE["app"]:   # single-document applications: routes inside the app, other apps on their own server
        return f"#/{target}" if sapp(target) == app else f"{APP_URLS[sapp(target)]}#/{target}"
    f = sfile(target).split("/")
    return f[-1] if sapp(target) == app else f"../{f[1]}/{f[2]}"


def _el(tag, attrs, text=None):
    n = htmltree.Node("el", tag, [[k, v] for k, v in attrs.items()])
    n.dirty = True
    if tag not in htmltree.VOID:
        n.raw_end = f"</{tag}>"
    if text:
        n.children.append(htmltree.Node("text", raw_start=_html.escape(text), text=text))
    return n


def _append(parent, child):
    child.parent = parent; parent.children.append(child)


def _make_input(sid, node, cfg):
    cfg = dict(cfg); name = cfg.pop("name")
    label = next((c for c in node.iter() if c.tag == "label"), None)
    box = next((c for c in node.iter() if c.has_class("box")), None)
    if label is None or box is None:
        raise WiringError(f"{sid}: input '{name}' needs a label and a .box")
    ident = f"in-{sid}-{name}"
    label.set("for", ident)
    value = cfg.pop("value", None)
    tag = cfg.pop("tag", "input")
    change = cfg.pop("change", None)
    options = cfg.pop("options", None)
    keep = [c for c in box.children if c.kind == "el" and c.tag == "svg"]
    box.children = []
    for c in keep:
        _append(box, c)
    attrs = {"id": ident, "name": name, "class": "rn-input", "aria-describedby": ident + "-err"}
    if tag == "input":
        attrs["type"] = cfg.pop("type", "text")
        if value is not None:
            attrs["value"] = value
    if change:
        attrs["data-change"] = change
    attrs.update({k: v for k, v in cfg.items()})
    if tag == "input":
        _append(box, _el("input", attrs))
    else:   # <select> gets its default options here; controllers refresh them from the demo state
        box.add_class("rn-" + tag)
        sel = _el(tag, attrs, value if tag == "textarea" else None)
        for o in options or []:
            v, t = (o, o) if isinstance(o, str) else o
            _append(sel, _el("option", {"value": v}, t))
        _append(box, sel)
    node.add_class("rn-field")
    _append(node, _el("span", {"class": "rn-err", "id": ident + "-err", "data-err": name, "hidden": None}))


def _make_otp(sid, node, name, n):
    boxes = [c for c in node.children if c.kind == "el" and c.tag == "span"]
    n = n or len(boxes)
    ident = f"in-{sid}-{name}"
    node.add_class("rn-otp")
    node.set("data-otp", name)
    _append(node, _el("input", {"id": ident, "class": "rn-otp-input", "type": "text", "inputmode": "numeric", "autocomplete": "one-time-code",
                                "maxlength": str(n), "pattern": "[0-9]*", "aria-label": f"{n}-digit code", "aria-describedby": ident + "-err"}))
    _append(node.parent, _el("span", {"class": "rn-err", "id": ident + "-err", "data-err": name, "hidden": None}))


ROW_CLASSES = {"row2", "kv", "ab", "floating", "dtop", "hd", "chips", "modes"}

def _row_flex(parent):
    """True when the parent lays children out in a row, where a <div> was only as wide as its content."""
    if parent is None or parent.kind != "el":
        return False
    style = (parent.get("style") or "").replace(" ", "")
    return bool(set(parent.classes()) & ROW_CLASSES) or ("display:flex" in style and "flex-direction:column" not in style)


def _apply(app, sid, node, spec):
    if "input" in spec:
        return _make_input(sid, node, spec["input"])
    if "otp" in spec:
        return _make_otp(sid, node, spec["otp"], spec.get("n"))
    if "bind" in spec:
        node.set("data-bind", spec["bind"])
    if not any(k in spec for k in INTERACTIVE):
        return
    if node.has_class("btn") or node.has_class("dbtn"):
        if node.tag == "div" and not _row_flex(node.parent):
            node.add_class("rn-blk")      # a block <div> filled its container; prototype.css keeps that for the <button>
        node.rename("button"); node.set("type", "button")
    elif node.has_class("toggle"):
        node.set("role", "switch"); node.set("tabindex", "0"); node.set("aria-checked", "true" if node.has_class("on") else "false")
        row = node.parent
        while row is not None and row.kind == "el" and not row.has_class("li"):
            row = row.parent
        title = next((b for b in row.iter() if b.tag in ("b", "a") and b.parent.has_class("tx")), None) if row is not None and row.kind == "el" else None
        if title is not None and not spec.get("label"):
            node.set("aria-label", title.text_content().strip())
    elif "go" in spec and not ({"do", "ui", "msg", "back"} & set(spec)) and (node.tag in ("a", "span") or node.tag == "div" and set(node.classes()) & DISPLAY_SAFE):
        node.rename("a"); node.set("href", _href(app, spec["go"]))
    elif "go" in spec and not ({"do", "ui", "msg", "back"} & set(spec)):
        node.set("role", "link"); node.set("tabindex", "0")      # e.g. <b>: renaming would lose its bold
    else:
        node.set("role", "button"); node.set("tabindex", "0")
        if spec.get("ui") == "pick":
            node.set("aria-pressed", "true" if node.has_class("on") else "false")
    for k in ("go", "do", "arg", "ui", "msg", "confirm", "hold", "next"):
        if k in spec:
            node.set("data-" + k, spec[k])
    if spec.get("back"):
        node.set("data-back", None)
    if spec.get("back-to"):
        node.set("data-back-to", spec["back-to"])
    if spec.get("label"):
        node.set("aria-label", spec["label"])
    node.set("data-w", None)


def _chrome(app, sid, root, back_to):
    # bottom navigation
    for bn in [n for n in root.iter() if n.has_class("bnav")]:
        items = [c for c in bn.children if c.kind == "el"]
        labels = [i.text_content().strip() for i in items]
        nav = {"rider": NAV_SUPER if "Savings" in labels else NAV_RIDER, "driver": NAV_DRIVER, "partner": NAV_PARTNER, "support": NAV_SUPPORT}[app]
        bn.rename("nav"); bn.set("aria-label", "App navigation")
        for i, lab in zip(items, labels):
            target = nav[lab]
            i.rename("a"); i.set("href", _href(app, target)); i.set("data-go", target)
            if app == "driver" and lab == "Home":
                i.set("data-home", "driver")
            if i.has_class("on"):
                i.set("aria-current", "page")
    # admin sidebar
    for a in [n for n in root.iter() if n.tag == "a" and n.parent is not None and n.parent.has_class("dsb")]:
        lab = re.sub(r"\d+$", "", a.text_content().strip()).strip()
        target = (SUPPORT_SIDEBAR if app == "support" else SIDEBAR)[lab]
        a.set("href", _href(app, target)); a.set("data-go", target)
        if a.has_class("on"):
            a.set("aria-current", "page")
    # icon buttons
    for ib in [n for n in root.iter() if n.has_class("ib")]:
        if ib.get("data-w", 0) is None or ib.get("data-go") or ib.get("data-do"):
            continue
        name = _icon(ib, direct=True) or _icon(ib, direct=False)
        if name == "back":
            ib.rename("button"); ib.set("type", "button"); ib.set("aria-label", "Back"); ib.set("data-back", None); ib.set("data-back-to", back_to)
            continue
        spec = dict(ICON_DEFAULT.get(name, (M("this control."), M("this control.")))[0 if app == "rider" else 1])
        spec["label"] = ICON_LABEL.get(name, "More")
        if spec.get("back"):
            spec["back-to"] = back_to
        _apply(app, sid, ib, spec)
    # desktop screens: the header search box becomes a real search field; filter chips and tabs become selectable
    for srch in [n for n in root.iter() if n.has_class("srch") and n.parent is not None and n.parent.has_class("dtop")]:
        hint = srch.text_content().strip()
        keep = [c for c in srch.children if c.kind == "el" and c.tag == "svg"]
        srch.children = []
        for c in keep:
            _append(srch, c)
        _append(srch, _el("input", {"type": "search", "class": "rn-input rn-search", "placeholder": hint, "aria-label": hint + " (this screen)", "data-search": None}))
    for st in [n for n in root.iter() if n.has_class("st") and n.parent is not None and n.get("role") is None]:
        sibs = [c for c in st.parent.children if c.kind == "el"]
        chips = [c for c in sibs if c.has_class("st")]
        if len(chips) >= 3 and sibs and sibs[0].has_class("st") and sibs[0].text_content().strip() == "All":
            for c in chips:
                if c.get("role") is None:
                    c.set("role", "button"); c.set("tabindex", "0"); c.set("data-ui", "pick")
                    c.set("aria-pressed", "true" if c.has_class("ok") else "false"); c.set("data-filter", c.text_content().strip())
    for tab in [n for n in root.iter() if n.parent is not None and n.parent.has_class("dtabs") and n.get("role") is None]:
        tab.set("role", "button"); tab.set("tabindex", "0"); tab.set("data-ui", "pick"); tab.set("aria-pressed", "true" if tab.has_class("on") else "false")
    # number keypads type into the screen's code or phone field
    for k in [n for n in root.iter() if n.parent is not None and n.parent.has_class("kbd")]:
        t = k.text_content().strip()
        if t:
            k.set("role", "button"); k.set("tabindex", "-1"); k.set("data-key", t); k.set("aria-label", "Delete" if t == "⌫" else t)
    # toggles without a table entry are UI switches
    for t in [n for n in root.iter() if n.has_class("toggle") and n.get("role") is None]:
        _apply(app, sid, t, TOG)
    # buttons without a table entry still respond (simulated message)
    for b in [n for n in root.iter() if (n.has_class("btn") or n.has_class("dbtn")) and n.tag != "button"]:
        _apply(app, sid, b, M("this action is not part of the prototype flows."))


def wire(app, sid, mock, back_to):
    root = htmltree.parse(mock)
    for sel, text, spec in W.get(sid, []):
        spec = dict(spec)
        many = spec.pop("all", False)
        nodes, nth = _find(root, sel, text)
        if nth:
            if len(nodes) < nth:
                raise WiringError(f"{sid}: no match #{nth} for ({sel!r}, {text!r}); found {len(nodes)}")
            nodes = [nodes[nth - 1]]
        elif not many and len(nodes) != 1:
            raise WiringError(f"{sid}: ({sel!r}, {text!r}) matched {len(nodes)} elements, expected 1")
        elif many and not nodes:
            raise WiringError(f"{sid}: ({sel!r}, {text!r}) matched nothing")
        for n in nodes:
            _apply(app, sid, n, spec)
    _chrome(app, sid, root, back_to)
    # interactive elements must not contain other interactive elements
    def interactive(n):
        return n.tag in ("a", "button", "input") or n.get("role") in ("button", "switch") or n.get("data-key") is not None
    for n in root.iter():
        if interactive(n) and n.tag != "input":
            inner = [d for d in n.iter() if interactive(d)]
            if inner:
                raise WiringError(f"{sid}: nested interactive elements inside <{n.tag} class='{n.get('class')}'>")
    for n in root.iter():
        n.remove("data-w")
    return root.serialize()


def table_coverage():
    """Used by docs: number of table entries per screen."""
    return {sid: len(v) for sid, v in W.items()}
