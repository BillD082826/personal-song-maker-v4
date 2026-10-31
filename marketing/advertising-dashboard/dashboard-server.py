from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime
import json
import threading
import os
import re
from urllib.parse import urlsplit, unquote
from scheduler_store import SchedulerStore, PlanError

ROOT = Path(__file__).resolve().parent
SCHEDULER = SchedulerStore(ROOT, Path(os.environ.get("LYRIBOP_SCHEDULER_DB", ROOT / ".scheduler-data/plans.sqlite3")))

HISTORY = Path("posting-history.json")
LOCK = threading.Lock()

class DashboardHandler(SimpleHTTPRequestHandler):
    def json_response(self, data, status=200):
        payload = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def valid_scheduler_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

    def do_GET(self):
        route = urlsplit(self.path).path
        if route.startswith("/api/scheduler/artwork/"):
            if not self.valid_scheduler_host():
                return self.json_response({"error":"Local dashboard only."},403)
            digest = route.rsplit('/',1)[-1]
            content = SCHEDULER.artwork(digest) if re.fullmatch(r'[0-9a-f]{64}',digest) else None
            if content is None:
                return self.json_response({"error":"Saved artwork not found."},404)
            self.send_response(200)
            self.send_header("Content-Type","image/png")
            self.send_header("X-Content-Type-Options","nosniff")
            self.send_header("Cache-Control","no-store")
            self.end_headers()
            self.wfile.write(content)
            return
        if route == "/api/scheduler":
            if not self.valid_scheduler_host():
                return self.json_response({"error":"Open the dashboard at localhost:8765."},403)
            return self.json_response(SCHEDULER.state())
        return super().do_GET()

    def send_head(self):
        # Keep the private SQLite queue, journals and dotfiles off the web server.
        path = Path(self.translate_path(self.path)).resolve()
        try:
            parts = path.relative_to(ROOT).parts
        except ValueError:
            self.send_error(403)
            return None
        if any(part.startswith('.') for part in parts):
            self.send_error(403)
            return None
        return super().send_head()

    def do_POST(self):
        if self.path.startswith("/api/scheduler"):
            origin = self.headers.get("Origin")
            if (not self.valid_scheduler_host() or
                origin not in (None, f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}") or
                self.headers.get("X-LyriBop-Scheduler") != "1" or
                self.headers.get("Content-Type", "").split(";")[0] != "application/json"):
                return self.json_response({"error":"Use the scheduler inside your local dashboard."},403)
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 64000:
                    raise PlanError("Invalid request size.")
                data = json.loads(self.rfile.read(size))
                if not isinstance(data,dict):
                    raise PlanError("Invalid scheduler request.")
                if self.path == "/api/scheduler/plans":
                    return self.json_response({"saved":SCHEDULER.add(data)},201)
                if self.path == "/api/scheduler/pause":
                    SCHEDULER.pause(data.get("paused"))
                    return self.json_response({"saved":True})
                if self.path == "/api/scheduler/cancel":
                    SCHEDULER.cancel(data.get("id"))
                    return self.json_response({"saved":True})
                return self.json_response({"error":"Unknown scheduler action."},404)
            except (ValueError, TypeError) as error:
                return self.json_response({"error":str(error)},400)
            except Exception:
                return self.json_response({"error":"Could not save the plan. Your earlier plans are retained."},500)

        if self.path != "/api/posting-history":
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 4096:
                raise ValueError("Invalid request size")
            data = json.loads(self.rfile.read(size))
            ads = json.loads(Path("all-ads.json").read_text())
            ad = next((a for a in ads if a["type"] == data.get("type") and str(a["id"]) == str(data.get("id"))), None)
            platforms = data.get("platforms")
            if ad is None or not isinstance(platforms, list):
                raise ValueError("Invalid advertisement or platforms")
            if not platforms or len(platforms) != len(set(platforms)):
                raise ValueError("Invalid platforms")
            if any(p not in ("Facebook", "Instagram", "Pinterest") for p in platforms):
                raise ValueError("Invalid platform")
            with LOCK:
                history = json.loads(HISTORY.read_text())
                history.append({"advertisement": ad["name"], "type": ad["type"], "id": ad["id"], "platforms": platforms, "posted_at": datetime.now().astimezone().isoformat(timespec="seconds")})
                HISTORY.write_text(json.dumps(history, indent=2) + "\n")
            self.send_response(201)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b"{\"saved\":true}")
        except (ValueError, KeyError, TypeError):
            self.send_error(400, "Invalid posting record")

if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("LYRIBOP_DASHBOARD_PORT", "8765"))), DashboardHandler)
    print("LyriBop Advertising Dashboard server ready", flush=True)
    server.serve_forever()
