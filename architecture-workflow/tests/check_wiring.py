"""Runs the prototype wiring over every screen and lists all problems at once (build stops at the first)."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "source"))
import rider, rider2, driver, admin, screens2, screens3, screens4, proto_wiring
from registry import APPS
rider2.patch_old(rider.S); screens3.patch_old(rider.S, driver.S, admin.S)
sets = {"rider": rider.S + rider2.S + screens3.R + screens4.R, "driver": driver.S + screens2.D + screens3.D + screens4.D, "partner": screens2.P + screens4.P, "admin": admin.S + screens2.A + screens3.A + screens4.A, "support": screens4.SUP}
errors = []
for app, scr in sets.items():
    by = {s["id"]: s for s in scr}
    for sid, _, _ in APPS[app]:
        try:
            proto_wiring.wire(app, sid, by[sid]["mock"], "index.html")
        except proto_wiring.WiringError as e:
            errors.append(str(e))
print("\n".join(errors) or "wiring OK for all screens")
sys.exit(1 if errors else 0)
