#!/usr/bin/env bash
set -euo pipefail

[[ -r /etc/default/japit-keepalived ]] && source /etc/default/japit-keepalived
STATE_DIR="${CLUSTER_STATE_DIR:-/var/lib/japit/cluster}"
VIP="${CLUSTER_SIP_VIP:-10.10.10.50}"
NODE_NAME="${NODE_NAME:-$(hostname -s)}"
mkdir -p "${STATE_DIR}"
export STATE_DIR VIP NODE_NAME

python3 - <<'PY'
import json, os, tempfile
from datetime import datetime, timezone
from pathlib import Path

state_dir = Path(os.environ["STATE_DIR"])
state_file = state_dir / "vrrp-state.json"
try:
    previous = json.loads(state_file.read_text())
except (OSError, json.JSONDecodeError):
    previous = {}
event = {
    "role": "BACKUP", "state": "BACKUP", "vip": os.environ["VIP"],
    "node": os.environ["NODE_NAME"], "timestamp": datetime.now(timezone.utc).isoformat(),
    "failover_count": int(previous.get("failover_count", 0)),
}
with tempfile.NamedTemporaryFile("w", dir=state_dir, delete=False, encoding="utf-8") as output:
    json.dump(event, output, sort_keys=True)
    output.write("\n")
    temporary = output.name
Path(temporary).replace(state_file)
with (state_dir / "failover-history.jsonl").open("a", encoding="utf-8") as history:
    history.write(json.dumps(event, sort_keys=True) + "\n")
PY
