"""Architecture page 26: fare transparency, zone pricing and the flat daily driver fee (no per-ride commission)."""
from archlib import *
from fees import ZONES, PAYMENT, COSTS, GST_RIDE, GST_FEE, FEE_CAP, COMPARE_PCT, WORK_DAYS, split, day, check, quote, rs, js_config

def links(*ids):
    return f'<div class="navlinks">{"".join(S(x) for x in ids)}</div>'

# segment colours shared by the bars, the keys, the calculator and the mock screens
SEG = [("driver", "Driver", "#0B7A68"), ("gst", "GST (government)", "#A8690F"), ("thru", "Pass-through", "#8A99A6"),
       ("fgst", "GST on fee", "#C9A35A"), ("server", "Servers & maps", "#2F5DA8"), ("gateway", "Payment gateway", "#6B4FB3"),
       ("social", "Social media & marketing", "#D9643F"), ("support", "Support & safety", "#C2410C"), ("profit", "Platform profit", "#33424E")]
COL = {k: c for k, _, c in SEG}
RIDE_KEYS = ("driver", "gst", "thru")
FEE_KEYS = ("fgst", "server", "gateway", "social", "support", "profit")

def bar(parts):
    tot = sum(max(v, 0) for _, v in parts) or 1
    cells = "".join(f'<i style="width:{v*100/tot:.2f}%;background:{COL[k]}">{rs(v) if v*100/tot > 9 else ""}</i>' for k, v in parts if v > 0)
    return f'<div class="moneybar">{cells}</div>'

def ride_parts(r):
    return [("driver", r["driver"]), ("gst", r["gst"]), ("thru", r["thru"])]

def fee_parts(d):
    return [("fgst", d["fee_gst"])] + [(k, v) for k, _, _, v in d["costs"]] + [("profit", max(d["profit"], 0))]

def key(keys):
    return '<div class="moneykey">' + "".join(f'<span><b style="background:{c}"></b>{t}</span>' for k, t, c in SEG if k in keys) + "</div>"

def p26():
    r = check(split(50, "z1", "upi"))
    d = check(day("z1", 12, 50, "upi"))
    t = r["total"]
    zfee = ZONES["z1"][6]

    # ---------------------------------------------------------- diagrams
    N1 = [dict(id="r", t=f"Rider pays {rs(t)}", s="one price, shown before booking", c=0, r=1, k="actor"),
          dict(id="g", t=f"GST {GST_RIDE:g}% · {rs(r['gst'])}", s="paid to the government", c=1, r=0, k="warn"),
          dict(id="d", t=f"Driver · {rs(r['driver'])}", s="100% of the fare", c=1, r=1, k="acc"),
          dict(id="p", t="Platform · ₹0.00", s="takes nothing from any ride", c=1, r=2, k="ext")]
    E1 = [dict(a="r", b="g", pa="r", pb="l"), dict(a="r", b="d", pa="r", pb="l", k="acc"), dict(a="r", b="p", pa="r", pb="l", dash=True)]
    svg1 = flow(N1, E1, cw=280, rh=80, bw=230, bh=54, title=f"Every ride · {rs(t)} · City centre · UPI")

    N2 = [dict(id="day", t=f"Driver's day · {d['rides']} rides", s=f"earned {rs(d['earned'])}", c=0, r=2.6, k="actor"),
          dict(id="kept", t=f"Driver keeps · {rs(d['kept'])}", s="everything except one fee", c=1, r=1.2, k="acc"),
          dict(id="fee", t=f"Daily fee · {rs(d['fee'])}", s="once a day, not per ride", c=1, r=4, k="info")]
    uses = [("fgst", f"GST {GST_FEE:g}% on fee", d["fee_gst"], "to the government")] + [(k, label.split(" (")[0], v, "UPI has no merchant fee" if k == "gateway" else "") for k, label, _, v in d["costs"]] + [("profit", "Platform profit", d["profit"], "")]
    for i, (k, label, v, s) in enumerate(uses):
        N2.append(dict(id=k, t=f"{label} · {rs(v)}", s=s, c=2, r=1.4 + i * 0.85, h=44, k="warn" if k == "fgst" else "n" if k == "profit" else "data"))
    E2 = [dict(a="day", b="kept", pa="r", pb="l", k="acc"), dict(a="day", b="fee", pa="r", pb="l")] + [dict(a="fee", b=k, pa="r", pb="l", k="data") for k, *_ in uses]
    svg2 = flow(N2, E2, groups=[("The daily fee pays for", 2, 1.4, 2, 1.4 + 5 * 0.85 + 0.3, "data")], cw=270, rh=78, bw=225, bh=54,
                title=f"Once a day · {d['rides']} rides of {rs(t)} · City centre zone")

    # ---------------------------------------------------------- worked example
    ride_rows = [("<b>Rider pays</b>", "", f"<b>{rs(t)}</b>", "The one price on the booking button. No booking fee, no card surcharge."),
                 (f"GST {GST_RIDE:g}% on the ride", f"{rs(t)} − ({rs(t)} ÷ {1 + GST_RIDE/100:.2f})", rs(r["gst"]), "Collected for the government; shown on the invoice"),
                 ("<b>Driver gets</b>", f"{rs(t)} ÷ {1 + GST_RIDE/100:.2f}", f"<b>{rs(r['driver'])}</b>", "100% of the fare. Tips, tolls and parking are extra and also go 100% to the driver"),
                 ("<b>Platform takes</b>", "no per-ride commission", "<b>₹0.00</b>", "The platform is paid only by the small daily fee below"),
                 ("<b>Check</b>", f"{rs(r['driver'])} + {rs(r['gst'])}", f"<b>{rs(t)}</b>", "Every line adds back to exactly what the rider paid ✓")]
    ride_tbl = table(["Line", "How it is calculated", "Amount", "What it means"], ride_rows, mono_cols=(1, 2))

    day_rows = [(f"Rides today", f"{d['rides']} × {rs(t)}", rs(d["paid"]), "What riders paid in total"),
                ("GST on rides (to government)", f"{d['rides']} × {rs(r['gst'])}", rs(d["gst"]), "Not the platform's money"),
                ("<b>Driver earned</b>", f"{d['rides']} × {rs(r['driver'])}", f"<b>{rs(d['earned'])}</b>", "100% of every fare"),
                ("<b>Daily fee</b>", f"₹{zfee} flat (City centre)", f"<b>−{rs(d['fee'])}</b>", "Charged once, at the end of the day. Same for 5 rides or 25"),
                ("<b>Driver keeps</b>", f"{rs(d['earned'])} − {rs(d['fee'])}", f"<b>{rs(d['kept'])}</b>", f"{d['kept']*100/d['earned']:.1f}% of the day's fares"),
                (f"With a {COMPARE_PCT:g}% commission app", f"{d['rides']} × {rs(r['commission'])}", f"−{rs(d['commission'])}", "What a per-ride commission would have taken"),
                ("<b>Driver saves</b>", f"{rs(d['commission'])} − {rs(d['fee'])}", f"<b>{rs(d['saved'])}</b>", f"About {rs(d['saved'] * WORK_DAYS)} a month over {WORK_DAYS} working days")]
    day_tbl = table(["Line", "How it is calculated", "Amount", "What it means"], day_rows, mono_cols=(1, 2))

    fee_rows = [(f"GST {GST_FEE:g}% included in the fee", f"{rs(d['fee'])} − ({rs(d['fee'])} ÷ {1 + GST_FEE/100:.2f})", rs(d["fee_gst"]), "Paid to the government; GST invoice for drivers every month")]
    fee_rows += [(f"↳ {label}", "per driver per day" if k != "gateway" else "0% on UPI", rs(v), desc) for k, label, desc, v in d["costs"]]
    fee_rows += [("↳ Platform profit", "fee − GST − costs", rs(d["profit"]), "Before the company's own income tax"),
                 ("<b>Check</b>", "", f"<b>{rs(d['fee'])}</b>", "The uses add up to exactly the fee ✓")]
    fee_tbl = table(["Where the daily fee goes", "How it is calculated", "Amount", "What it means"], fee_rows, mono_cols=(1, 2))

    # ---------------------------------------------------------- daily fee vs commission, by number of rides
    cmp_rows = []
    for n in (1, 3, 5, 8, 12, 15, 20):
        x = check(day("z1", n, 50, "upi"))
        cmp_rows.append((f"{n}", rs(x["earned"]), f"−{rs(x['commission'])}", f"−{rs(x['fee'])}" + (" (10% cap)" if x["capped"] else ""), rs(x["kept"]), f"<b>{rs(x['saved'])}</b>"))
    cmp = table(["Rides of ₹50 in a day", "Driver earned", f"{COMPARE_PCT:g}% commission would take", "Daily fee", "Driver keeps", "Driver saves"], cmp_rows, mono_cols=(0, 1, 2, 3, 4, 5))

    # ---------------------------------------------------------- zones
    zone_rows = []
    for z, (name, where, base, pkm, pmin, mn, fee, thru, tl) in ZONES.items():
        rz, dz = check(split(50, z, "upi")), check(day(z, 12, 50, "upi"))
        zone_rows.append((f"<b>{name}</b><br><span style='color:var(--muted);font-size:13px'>{where}</span>",
                          f"₹{base} + ₹{pkm:g}/km + ₹{pmin:g}/min · min ₹{mn}" + (f"<br>+ ₹{thru} {tl.lower()}" if thru else ""),
                          f"₹{quote(z, 3, 10):.0f}", f"<b>₹{fee}/day</b>", rs(rz["driver"]) + (f" · {rs(rz['thru'])} to airport" if rz["thru"] else ""),
                          rs(dz["kept"]), rs(dz["saved"] * WORK_DAYS)))
    zones = table(["Zone", "Fare rule (auto, GST included)", "Same 3 km · 10 min trip", "Daily fee", "Driver gets from a ₹50 ride", "12 rides/day: driver keeps", "Saved per month vs 15%"],
                  zone_rows, mono_cols=(1, 2, 3, 4, 5, 6))

    pay_rows = []
    for p, (name, gp) in PAYMENT.items():
        rp = check(split(50, "z1", p))
        pay_rows.append((name, f"{gp:g}%", rs(rp["gateway"]), "₹0.00", rs(rp["driver"]),
                         f"Driver keeps the ₹50 cash; only the {rs(rp['gst'])} GST is settled from the wallet" if p == "cash" else "Paid by the platform from daily fees" if gp else ""))
    pays = table(["Payment method", "Merchant fee (incl. its GST)", "On ₹50", "Extra charged to rider", "Driver gets", "Note"], pay_rows, mono_cols=(1, 2, 3, 4))
    low = check(day("z1", 1, 50, "upi"))
    loss = (f'<p class="note">On quiet days the platform can lose money: 1 ride of ₹50 means a capped fee of <b>{rs(low["fee"])}</b> but running costs of '
            f'<b>{rs(sum(c[3] for c in low["costs"]))}</b>, a platform loss of <b>{rs(low["profit"])}</b>. The platform absorbs it; it is never passed to riders or drivers.</p>')

    rules = f"""<ul class="clean">
<li><b>No ride, no fee.</b> The fee is charged only on days the driver completes at least one ride or delivery. Days offline or with no trips cost nothing.</li>
<li><b>One flat amount per day</b>: ₹10 to ₹15 depending on the zone. It does not grow with the number of rides or the money earned.</li>
<li><b>Never more than {FEE_CAP:g}% of the day's fares.</b> One ₹50 ride pays {rs(low['fee'])}, not ₹{zfee}.</li>
<li><b>Worked in more than one zone?</b> The driver pays the lowest of those zones' fees.</li>
<li><b>One fee covers everything that day</b>: city rides, long trips, food and parcel deliveries.</li>
<li><b>Taken at midnight from the driver wallet.</b> If the wallet is empty it is taken from the next earnings. No interest, no late fee. After 3 unpaid days the driver is asked to clear it before going online.</li>
<li><b>GST invoice every month</b> for all daily fees paid, so drivers can see and claim them.</li></ul>"""

    promises = """<ul class="clean">
<li><b>One price for riders.</b> The amount on the booking button is the amount charged, GST included. No booking fee, convenience fee, card surcharge or platform charge.</li>
<li><b>100% of the fare goes to the driver.</b> The platform takes nothing from any ride: not from the fare, tips, tolls, parking or surge.</li>
<li><b>Same numbers for both sides.</b> The rider's receipt and the driver's trip summary come from one stored record and match to the paisa.</li>
<li><b>Lines must add up.</b> Driver + GST + pass-through = rider total, and the daily fee's uses add up to the fee. The ledger refuses anything that does not reconcile.</li>
<li><b>Server, payment gateway, social media and support costs are paid from the daily fee</b>, never from the rider's price or the driver's fare.</li>
<li><b>Coupons are paid by the platform.</b> The driver is paid the full fare before the coupon.</li>
<li><b>Fee changes are public and announced</b> on a public page, reaching drivers 7 days before they apply, with a hard maximum of ₹15 a day.</li></ul>"""

    taxes = table(["Tax", "Rate (India example)", "On what", "Who pays it", "Shown where"], [
        ("GST on the ride", f"{GST_RIDE:g}%", "Fare, included in the rider's price", "Rider; collected and filed for the government", "Rider invoice, driver trip summary"),
        ("GST on the daily fee", f"{GST_FEE:g}%", "Daily fee, included in the ₹10–15", "Driver, inside the fee", "Daily fee line; monthly GST invoice"),
        ("GST on the payment gateway fee", "18%", "Gateway's merchant fee", "Platform, from the daily fees", "Daily fee breakdown"),
        ("Platform's income tax", "Company rate", "Platform profit", "Platform", "Yearly public transparency report"),
        ("Driver income tax deduction (TDS)", "Only where the law requires", "Driver earnings", "Driver, with a certificate to claim it", "Separate line on driver statement"),
        ("Other countries (VAT etc.)", "Country pack", "Set per country", "Per local law", "Same screens, local tax names")])

    engine = table(["Part", "What it does"], [
        (api("GET", "/v1/fares/quote"), "Returns the price <b>and</b> its breakdown before booking, for the zone where the trip starts."),
        (api("GET", "/v1/rides/{id}/breakdown"), "The stored breakdown of one ride. Used by the rider receipt (R55) and support."),
        (api("GET", "/v1/drivers/me/daily-fees?from&to"), "The driver's days: rides, earnings, fee charged (or not), cap applied, and the saving vs commission (D27)."),
        (api("GET", "/v1/public/fees?city="), "Public, no login: zone fares and daily fees. Also printed in the driver app."),
        (api("PUT", "/v1/admin/fees/zones/{id}"), "Change a zone's fares or daily fee. Needs two approvers and gives drivers 7 days' notice."),
        ("Daily fee job", "Runs at midnight in each city's time zone: finds drivers with at least one completed trip, picks the lowest zone fee they worked in, applies the 10% cap and posts one charge."),
        ("<code>ledger.ride_splits</code>", "One row per line of every ride's breakdown; must sum to what the rider paid."),
        ("<code>ledger.daily_fees</code>", "One row per driver per working day: rides, earnings, fee, GST, cap flag, status (charged / carried / waived)."),
        ("<span class='pill ev'>driver.daily_fee_charged</span>", "Event for the driver notification, wallet, GST invoice and the monthly transparency report."),
        ("<span class='pill ev'>fees.schedule_published</span>", "Event that notifies drivers and updates the public fee page.")])

    # ---------------------------------------------------------- calculator
    zone_opts = "".join(f'<option value="{k}">{v[0]} · ₹{v[6]}/day</option>' for k, v in ZONES.items())
    pay_opts = "".join(f'<option value="{k}">{v[0]}</option>' for k, v in PAYMENT.items())
    calc = f'''<div class="card calc" id="feecalc">
<div class="in"><label>Fare of one ride (₹, GST included)<input id="fc-amt" type="number" min="1" step="1" value="50" inputmode="decimal"></label>
<label>Rides the driver completes today<input id="fc-n" type="number" min="0" step="1" value="12" inputmode="numeric"></label>
<label>Zone<select id="fc-zone">{zone_opts}</select></label><label>Payment method<select id="fc-pay">{pay_opts}</select></label>
<p class="calc-note">Uses exactly the same numbers and rounding as the apps. Amounts are worked out in paise.</p></div>
<div class="out"><div class="eyebrow">Each ride</div><div id="fc-rbar" class="moneybar"></div><div class="tw"><table><tbody id="fc-ride"></tbody></table></div>
<div class="eyebrow">The driver's day</div><div class="tw"><table><tbody id="fc-day"></tbody></table></div>
<div class="eyebrow">Where the daily fee goes</div><div id="fc-fbar" class="moneybar"></div>{key(FEE_KEYS)}<div class="tw"><table><tbody id="fc-fee"></tbody></table></div><div id="fc-check"></div></div></div>
'''

    fname, body = arch_page("26", "fare-transparency", "Fare transparency & daily driver fee", "Trust",
        "Drivers keep 100% of every fare. Instead of taking a cut of each ride, the platform charges drivers one small flat fee per working day: ₹10 to ₹15 by zone, "
        "and nothing on days with no rides. Riders and drivers can both see where every rupee goes, including tax and what the daily fee pays for "
        "(servers, payment gateway, social media, support). Nothing is ever added on top of the price shown.",
        [sec("Every ride", f"A {rs(t)} ride: the driver gets the whole fare",
             bar(ride_parts(r)) + key(RIDE_KEYS) + ride_tbl,
             fig(svg1, "The platform takes no commission from any ride.", "26-every-ride")),
         sec("Every day", f"The driver's day: {d['rides']} rides and one ₹{zfee} fee", day_tbl,
             f'<p class="note">City centre zone, auto rides of {rs(t)} paid by UPI. The more the driver works, the more they save, because the fee stays the same.</p>'),
         sec("Daily fee", "Where the daily fee goes", bar(fee_parts(d)) + key(FEE_KEYS) + fee_tbl,
             fig(svg2, "Server, payment gateway, social media and support costs are paid from the daily fee. Riders and drivers never pay them separately.", "26-daily-fee")),
         sec("Rules", "How the daily fee works", rules),
         sec("Try it", "Earnings and daily fee calculator", calc, intro="Change the fare, the number of rides, the zone or the payment method. This is what the rider sees on the receipt and what the driver sees for the day."),
         sec("Compare", "Daily fee vs per-ride commission", cmp,
             f'<p class="note">City centre, ₹50 rides. With a commission, the driver pays more the harder they work. With the daily fee, every ride after the first few is all theirs.</p>'),
         sec("Zones", "Prices and daily fees by zone", zones,
             '<p class="note">The same trip costs different amounts in different zones, and the daily fee is lower where earnings are lower (towns, villages, hills). '
             'Zones are polygons drawn in the admin portal; the zone where a trip starts decides its fare. Rates are examples for planning.</p>'),
         sec("Payment methods", "The payment method never changes the price or the driver's share", pays, loss),
         sec("Taxes", "Every tax, shown separately", taxes),
         sec("Promise", "No hidden charges: the rules the system enforces", promises),
         sec("How it is built", "APIs, data and events", engine),
         sec("Screens", "Where this appears", links("R09", "R17", "R55", "R19", "D11", "D27", "D13", "D14", "A29", "A09", "A10"))])
    return fname, "Fare transparency & daily driver fee", body, "Drivers keep 100% of fares and pay one flat ₹10–15 daily fee; every rupee shown to riders and drivers."

PAGES = [p26]
