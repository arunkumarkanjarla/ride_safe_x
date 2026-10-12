"""Fare transparency screens: rider money breakdown (R55), driver earnings & daily fee (D27), admin daily fees & taxes (A29)."""
from components import *
from superlib import sect
from admin import card, grid, field, dbtn
from fees import ZONES, FEE_CAP, COMPARE_PCT, split, day, check, rs
from arch_e import COL

R50 = check(split(50, "z1", "upi"))
DAY = check(day("z1", 12, 50, "upi"))
COST = {k: v for k, _, _, v in DAY["costs"]}

def bar(parts, h=14):
    tot = sum(max(v, 0) for _, v in parts) or 1
    cells = "".join(f'<i style="display:block;width:{v*100/tot:.2f}%;background:{COL[k]}"></i>' for k, v in parts if v > 0)
    return f'<div style="display:flex;height:{h}px;border-radius:6px;overflow:hidden">{cells}</div>'

def dot(k):
    return f'<i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:{COL[k]};margin-right:6px"></i>'

def kv(k, label, value, sub=False, bold=False):
    st = "font-size:12.5px;color:#6A7885;padding-left:15px" if sub else ""
    lab = f"{dot(k) if k else ''}{label}"
    return f'<div class="kv" style="{st}"><span>{"<b>" + lab + "</b>" if bold else lab}</span>{"<b>" + value + "</b>" if bold else f"<span>{value}</span>"}</div>'

def fee_lines(d):
    return (kv("fgst", "GST 18% on fee", rs(d["fee_gst"]), sub=True)
            + "".join(kv(k, label.replace(" (merchant fee)", ""), rs(v), sub=True) for k, label, _, v in d["costs"])
            + kv("profit", "Platform profit", rs(d["profit"]), sub=True))

R = []
R.append(dict(id="R55", mock=phone(
    appbar("Where your ₹50 went") +
    f'<div class="body" style="gap:9px"><div class="card-m" style="gap:6px"><div class="kv"><span class="xs">Auto · City centre zone · UPI</span><span class="tag ok">Paid</span></div>'
    f'<div class="big-num">{rs(R50["total"])}</div><span class="xs">The price you saw before booking. Nothing was added.</span>{bar([("driver", R50["driver"]), ("gst", R50["gst"])])}</div>'
    f'<div class="card-m" style="gap:5px">{kv("driver", "Ravi (your driver) · 100%", rs(R50["driver"]), bold=True)}<span class="xs" style="padding-left:15px">The whole fare. Tips also go 100% to Ravi</span>'
    f'<div class="hr"></div>{kv("gst", "GST 5% · to government", rs(R50["gst"]), bold=True)}'
    f'<div class="hr"></div>{kv("", B() + " commission", "₹0.00", bold=True)}<span class="xs" style="padding-left:15px">We take nothing from your ride</span></div>'
    f'<div class="card-m" style="gap:4px"><b style="font-size:13px">How is the app paid for?</b><span class="xs">Drivers pay one flat fee of ₹10–15 a day, only on days they drive. '
    f'It pays for servers, maps, payments, support and ads. You never pay it.</span></div>'
    f'<div class="banner ok">{icon("check")}{rs(R50["driver"])} + {rs(R50["gst"])} = {rs(R50["total"])}. No booking fee, no card surcharge.</div>'
    f'<div class="xs" style="text-align:center">Fares & fees for Hyderabad zones · Report a wrong charge</div></div>'),
    purpose="Shows the rider exactly where every rupee of the fare went: the whole fare to the driver, GST to the government, and nothing to the platform.",
    how=["Opened from the trip receipt (R17), the invoice (R19) or the fare on ride options (R09) before booking.",
         "Lines come from the stored ride breakdown, the same record the driver sees, so both always match.",
         "The app checks that the lines add up to the amount paid and shows the sum as proof.",
         "Explains that the platform is paid by drivers' small daily fee, not by riders and not by a cut of the ride."],
    elements=["Total paid with zone and payment method", "Colour bar of the split", "Driver share (100%)", "GST to government", "Platform commission ₹0",
              "How the app is paid for", "Sum check", "Public fares and report links"],
    apis=[("GET", "/v1/rides/{id}/breakdown", "Stored breakdown lines"), ("GET", "/v1/public/fees?city=", "Zone fares and daily fees")],
    events=["fare.breakdown_viewed"], data=["ledger.ride_splits"], to=["R19", "R27"],
    edge=["Coupon used: shown as 'Paid by the platform'; the driver still gets the full fare.", "Airport or toll charge: its own line, 100% passed on with the receipt photo.",
          "Card payment: the card fee is paid by the platform; the rider's total and the driver's share are unchanged.", "Shared seat: shows the rider's own share only."]))

D = []
D.append(dict(id="D27", mock=phone(
    appbar("Today's earnings & daily fee") +
    f'<div class="body" style="gap:9px"><div class="card-m brand" style="gap:4px"><span class="xs">You keep today · {DAY["rides"]} rides</span><div class="big-num">{rs(DAY["kept"])}</div>'
    f'<span class="xs">100% of every fare · one daily fee of {rs(DAY["fee"])}</span></div>'
    f'<div class="card-m" style="gap:5px">{kv("", "Riders paid", rs(DAY["paid"]))}{kv("gst", "GST 5% · to government", "−" + rs(DAY["gst"]))}'
    f'{kv("driver", "Your fares (100%)", rs(DAY["earned"]), bold=True)}{kv("", "Daily fee · City centre", "−" + rs(DAY["fee"]))}{fee_lines(DAY)}'
    f'<div class="hr"></div>{kv("driver", "You keep", rs(DAY["kept"]), bold=True)}</div>'
    f'<div class="banner ok">{icon("trophy")}A {COMPARE_PCT:g}% commission would have taken {rs(DAY["commission"])}. You saved {rs(DAY["saved"])} today.</div>'
    f'{sect("DAILY FEE BY ZONE · NO RIDES, NO FEE")}<div class="chips">' + "".join(f'<span class="chip{" on" if k == "z1" else ""}">{v[0]} ₹{v[6]}</span>' for k, v in ZONES.items()) + '</div></div>'),
    purpose="Shows the driver that they keep 100% of every fare, the one flat daily fee charged for the day, what that fee pays for, and how much they saved compared with a per-ride commission.",
    how=["Opened from Trip complete (D11), Earnings (D13) or Wallet (D14).", "Before midnight it shows the fee that will be charged; after midnight, the fee that was charged.",
         f"No completed rides: the fee is ₹0. A slow day: the fee is capped at {FEE_CAP:g}% of the day's fares.",
         "Worked in several zones: the lowest zone fee applies; the screen says which one."],
    elements=["What the driver keeps today", "Riders paid, GST, fares", "Daily fee and what it pays for", "Saving vs commission", "Daily fee in each zone"],
    apis=[("GET", "/v1/drivers/me/daily-fees?date=", "Today's rides, fee and saving"), ("GET", "/v1/public/fees?city=", "Zone daily fees")],
    events=["driver.daily_fee_charged"], data=["ledger.daily_fees", "ledger.ride_splits"], to=["D13", "D14", "D20"],
    edge=["Fee change coming: a banner shows the new amount and the date it applies, at least 7 days ahead.", "Wallet empty at midnight: the fee is taken from the next earnings, with no interest or late fee.",
          "3 unpaid days: the driver is asked to clear them before going online.", "Wrong fee: 'Raise with support' attaches the day's ride list automatically."]))

A = []
zr = []
for k, (name, where, base, pkm, pmin, mn, fee, thru, tl) in ZONES.items():
    dz = check(day(k, 12, 50, "upi"))
    zr.append([name, f"₹{base} + ₹{pkm:g}/km + ₹{pmin:g}/min", f"₹{fee}", rs(dz["kept"]), rs(dz["profit"]), st("Live", "ok") if k != "z2" else st("16 Oct", "warn")])
A.append(dict(id="A29", mock=desk("pricing", "Daily fees, taxes & zone rates",
    '<div class="kpis">' + kpi("Rider payments today", "₹48.6 L") + kpi("Paid to drivers", "₹46.3 L", "100% of fares") + kpi("Drivers charged today", "41,820", "₹15 or less each")
    + kpi("Daily fees today", "₹5.9 L", "8,140 capped · 2,310 no rides") + kpi("Rides out of balance", "0", "all reconcile") + '</div>'
    + grid("1.35fr 1fr", card("Zone fares & daily fees · Hyderabad · v8", dtable(["Zone", "Auto fare rule", "Daily fee", "Driver keeps (12 × ₹50)", "Profit / driver-day", ""], zr)
        + f'<div style="font-size:12px;color:#667685">No per-ride commission. Fee charged only on days with a completed trip, capped at {FEE_CAP:g}% of that day\'s fares, maximum ₹15. Published at /fees.</div>'
        + f'<div style="display:flex;gap:6px">{dbtn("Propose change")}{dbtn("Version history","g")}{dbtn("Simulate a driver day","g")}</div>'),
      card("What the daily fee pays for · per driver-day", dtable(["Cost", "Per day", "Month"], [["GST 18% on fee", rs(DAY["fee_gst"]), "₹28.1 L"], ["Servers & maps", rs(COST["server"]), "₹36.8 L"], ["Payment gateway", "by method", "₹9.1 L"],
          ["Social media & marketing", rs(COST["social"]), "₹24.5 L"], ["Support, safety & insurance", rs(COST["support"]), "₹36.8 L"]])
        + field("Pending · Suburbs daily fee ₹12 → ₹11", "Approved by R. Menon · drivers notified 9 Oct · applies 16 Oct")
        + '<div style="font-size:12px;color:#667685">Riders never pay a card or wallet surcharge. GST on rides: 5%, included in the price.</div>'))),
    purpose="Finance and pricing teams set fares and the flat daily driver fee per zone, see what the fees pay for, and prove every ride and every fee adds up.",
    how=["Each zone has a versioned schedule of fares and a daily fee (₹10–15); the system refuses anything above ₹15.",
         "A change is a draft until a second approver signs; drivers are notified 7 days before it applies and the public fee page updates.",
         "The midnight job charges one fee per driver who completed at least one trip, using the lowest zone they worked in and the 10% cap.",
         "A nightly check confirms every ride's lines sum to what the rider paid and that no driver was charged twice; mismatches alert finance."],
    elements=["Money KPIs including drivers charged, capped and not charged", "Zone fares and daily fees", "Pending change with notice date", "Cost per driver-day", "Propose, history, simulate"],
    apis=[("GET", "/v1/admin/fees/zones?city=", "Fee schedules"), ("PUT", "/v1/admin/fees/zones/{id}", "Propose change"), ("POST", "/v1/admin/fees/zones/{id}/approve", "Second approval"),
          ("GET", "/v1/admin/fees/daily-run?date=", "Last night's fee run and exceptions")],
    events=["fees.schedule_published", "driver.daily_fee_charged", "fees.reconciliation_failed"], data=["pricing.fee_schedules", "ledger.daily_fees", "ledger.ride_splits", "finance.cost_per_driver_day"],
    to=["A09", "A10", "A11"],
    edge=["A daily fee above ₹15, or a per-ride commission, can't be configured.", "A change can't apply sooner than 7 days after drivers are told.",
          "If costs exceed fees in a zone, the loss stays with the platform; fares and fees can't be raised retroactively."]))

def patch_old(rider_s, driver_s, admin_s):
    """Link existing fare screens to the new breakdown screens."""
    for lst, sid, new in ((rider_s, "R17", "R55"), (rider_s, "R19", "R55"), (rider_s, "R09", "R55"), (driver_s, "D11", "D27"), (driver_s, "D13", "D27"),
                          (driver_s, "D14", "D27"), (admin_s, "A09", "A29")):
        for s in lst:
            if s["id"] == sid and new not in s.setdefault("to", []):
                s["to"].append(new)
