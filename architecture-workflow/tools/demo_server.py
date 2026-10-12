"""Optional demo server for showing the static prototype on two devices (e.g. a rider phone and a driver phone).

* Serves the repository folder as static files.
* Adds ONE endpoint, /api/demo-state, that holds the synthetic demo state IN MEMORY so several browsers
  can share it. Nothing is written to disk; stopping the server forgets everything.
* Not a backend: no accounts, no database, no authentication, no real services. Synthetic data only.

Usage (from the repository root):
    py tools/demo_server.py                # http://127.0.0.1:8770, this computer only
    py tools/demo_server.py --lan          # also reachable from phones on the same Wi-Fi (trusted networks only)
"""
import argparse
import functools
import http.server
import json
import os
import socket
import threading

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAX_BYTES = 2 * 1024 * 1024
_lock = threading.Lock()
_state = {"rev": -1, "body": None}


class Handler(http.server.SimpleHTTPRequestHandler):
    server_version = "RideNovaDemo/1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def _json(self, code, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-RideNova-Demo", "1")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/demo-state":
            with _lock:
                return self._json(200, {"rev": _state["rev"], "state": _state["body"]})
        return super().do_GET()

    def do_PUT(self):
        if self.path.split("?")[0] != "/api/demo-state":
            return self._json(404, {"error": "not found"})
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self._json(415, {"error": "JSON only"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._json(413, {"error": "too large"})
        try:
            body = json.loads(self.rfile.read(n).decode("utf-8"))
            rev = int(body["rev"])
            state = body["state"]
            if not isinstance(state, dict) or state.get("v") is None:
                raise ValueError("not a demo state")
        except (ValueError, KeyError, TypeError):
            return self._json(400, {"error": "invalid demo state"})
        with _lock:
            if rev <= _state["rev"] and not body.get("reset"):
                return self._json(409, {"rev": _state["rev"], "state": _state["body"]})
            _state["rev"], _state["body"] = rev, state
            return self._json(200, {"rev": rev})

    def do_DELETE(self):
        if self.path.split("?")[0] != "/api/demo-state":
            return self._json(404, {"error": "not found"})
        with _lock:
            _state["rev"], _state["body"] = -1, None
        return self._json(200, {"rev": -1})

    def log_message(self, fmt, *args):
        text = fmt % args if args else fmt
        if "/api/demo-state" not in text:      # the 1-second sync polling would flood the console
            super().log_message("%s", text)


def lan_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.0.2.1", 9))   # TEST-NET address: no packet is sent for UDP connect
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8770)
    ap.add_argument("--lan", action="store_true", help="listen on all interfaces so phones on the same network can connect")
    a = ap.parse_args()
    host = "0.0.0.0" if a.lan else "127.0.0.1"
    httpd = http.server.ThreadingHTTPServer((host, a.port), functools.partial(Handler, directory=ROOT))
    print(f"RideNova demo server (synthetic data, in memory only) serving {ROOT}", flush=True)
    print(f"  This computer:  http://127.0.0.1:{a.port}/prototype/index.html", flush=True)
    if a.lan and lan_address():
        print(f"  Phones on the same Wi-Fi:  http://{lan_address()}:{a.port}/prototype/index.html", flush=True)
        print("  Only use --lan on a trusted network. There is no authentication.", flush=True)
    print("Press Ctrl+C to stop (the shared demo state is discarded).", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
