"""Fare transparency model: drivers keep 100% of every fare; the platform charges one small flat fee per working day.

The same CONFIG is used by the architecture page, the rider/driver/admin mock screens and the in-page JavaScript
calculator, so the numbers can never disagree. All maths is done in paise (integers) to avoid rounding drift.
Rates are planning examples for India; each country pack sets its own."""
import json, math

GST_RIDE = 5.0          # % GST on the ride, included in the fare, paid to the government (0 where the law says it does not apply)
GST_FEE = 18.0          # % GST on the platform's daily fee (a software service), included in the fee
FEE_CAP = 10.0          # the daily fee is never more than this % of the driver's fares that day
COMPARE_PCT = 15.0      # typical per-ride commission of other apps, used only to show drivers what they save
WORK_DAYS = 26          # working days in a month, for monthly examples

# Zones: the same trip costs different amounts in different areas, and the daily fee is lower where earnings are lower.
# key: (name, where, base ₹, per km ₹, per min ₹, minimum ₹, daily fee ₹, pass-through ₹, pass-through label)
ZONES = {
    "z1": ("City centre", "Dense core, high demand", 20, 8, 0.6, 30, 15, 0, ""),
    "z2": ("Suburbs", "Outer ring, residential", 20, 7, 0.5, 30, 12, 0, ""),
    "z3": ("Town & village", "Small towns, rural roads", 18, 6, 0.4, 25, 10, 0, ""),
    "z4": ("Airport & railway", "Terminals and stations", 20, 8, 0.6, 30, 15, 20, "Airport entry fee (paid to airport)"),
    "z5": ("Hill & forest", "Ghat roads, no-network areas", 25, 10, 0.6, 35, 10, 0, ""),
}

# Payment (merchant) gateway charges, % of the amount paid, including the gateway's own 18% GST
# (debit 0.9% → 1.062%, credit 2% → 2.36%, wallet 1.5% → 1.77%).
# The platform pays these out of its daily fees. Riders pay no surcharge and drivers lose nothing.
PAYMENT = {
    "upi": ("UPI", 0.0),
    "rupay": ("RuPay debit card", 0.0),
    "debit": ("Other debit card", 1.062),
    "credit": ("Credit card", 2.36),
    "wallet": ("Wallet", 1.77),
    "cash": ("Cash", 0.0),
}

# What the daily fee pays for, per driver per working day (₹). The payment gateway line is added from the day's actual rides.
COSTS = [
    ("server", "Servers & maps", "Cloud servers, maps and routing, OTP SMS, masked calls", 3.00),
    ("social", "Social media & marketing", "Ads and social media that bring riders, so drivers get trips", 2.00),
    ("support", "Support, safety & insurance", "24×7 help, SOS team, accident insurance on every ride", 3.00),
]

def rnd(x):
    """Round half up, the same as Math.round in the page calculator (Python's round() is banker's rounding)."""
    return int(math.floor(x + 0.5))

def paise(x):
    return rnd(x * 100)

def rs(p, sign=False):
    s = "−" if p < 0 else ("+" if sign and p > 0 else "")
    return f"{s}₹{abs(p) // 100:,}.{abs(p) % 100:02d}"

def quote(zone, km, mins):
    """Fare the rider sees for a trip in a zone (₹, GST included). Pass-through charges are added at cost."""
    _, _, base, pkm, pmin, mn, _, thru, _ = ZONES[zone]
    return max(mn, base + pkm * km + pmin * mins) + thru

def split(total, zone="z1", pay="upi"):
    """One ride. The driver gets the whole fare; GST goes to the government; pass-through goes to whoever is owed.
    The platform takes nothing from the ride. The gateway fee is paid by the platform, not taken from the fare."""
    t = paise(total)
    th = min(paise(ZONES[zone][7]), t)
    taxable = t - th
    fare = rnd(taxable * 100 / (100 + GST_RIDE))
    gst = taxable - fare
    gw = rnd(t * PAYMENT[pay][1] / 100)
    return dict(zone=ZONES[zone][0], pay=PAYMENT[pay][0], total=t, thru=th, thru_label=ZONES[zone][8], fare=fare, gst=gst,
                driver=fare, platform=0, gateway=gw, commission=rnd(fare * COMPARE_PCT / 100))

def day(zone="z1", rides=12, fare=50, pay="upi"):
    """One working day of a driver doing `rides` rides of `fare` ₹ each."""
    r = split(fare, zone, pay)
    earned = rides * r["driver"]
    fee = 0 if rides <= 0 else min(paise(ZONES[zone][6]), rnd(earned * FEE_CAP / 100))
    fee_net = rnd(fee * 100 / (100 + GST_FEE))
    fee_gst = fee - fee_net
    costs = [(k, label, desc, paise(v) if rides > 0 else 0) for k, label, desc, v in COSTS]
    costs.insert(1, ("gateway", "Payment gateway (merchant fee)", f"{PAYMENT[pay][0]}: {PAYMENT[pay][1]:g}% on {rides} rides", rides * r["gateway"]))
    profit = fee_net - sum(c[3] for c in costs)
    commission = rides * r["commission"]
    return dict(ride=r, rides=rides, paid=rides * r["total"], gst=rides * r["gst"], thru=rides * r["thru"], earned=earned,
                fee=fee, full_fee=paise(ZONES[zone][6]), capped=0 < fee < paise(ZONES[zone][6]), fee_net=fee_net, fee_gst=fee_gst,
                costs=costs, profit=profit, kept=earned - fee, commission=commission, saved=commission - fee)

def check(d):
    """The rules the system enforces: every line adds up exactly, and the driver keeps the whole fare."""
    r = d["ride"] if "ride" in d else d
    assert r["driver"] + r["gst"] + r["thru"] == r["total"] and r["platform"] == 0
    if "ride" in d:
        assert d["kept"] + d["fee"] == d["earned"] and d["earned"] + d["gst"] + d["thru"] == d["paid"]
        assert d["fee_net"] + d["fee_gst"] == d["fee"] and sum(c[3] for c in d["costs"]) + d["profit"] == d["fee_net"]
        assert d["fee"] <= d["full_fee"] and d["fee"] * 100 <= d["earned"] * FEE_CAP + 50
    return d

def js_config():
    """Config for the in-page calculator, so JavaScript uses exactly the Python numbers."""
    return json.dumps(dict(gst=GST_RIDE, gst_fee=GST_FEE, cap=FEE_CAP, cmp=COMPARE_PCT,
                           zones={k: dict(name=v[0], fee=v[6], thru=v[7], thru_label=v[8]) for k, v in ZONES.items()},
                           pay={k: dict(name=v[0], pct=v[1]) for k, v in PAYMENT.items()},
                           costs=[dict(key=k, label=l, desc=d, rs=v) for k, l, d, v in COSTS]), ensure_ascii=False)

if __name__ == "__main__":
    for z in ZONES:
        for n in (0, 1, 5, 12, 20):
            d = check(day(z, n, 50, "upi"))
            print(z, n, "earned", rs(d["earned"]), "fee", rs(d["fee"]), "kept", rs(d["kept"]), "saved", rs(d["saved"]), "profit", rs(d["profit"]))
