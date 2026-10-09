from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from datetime import datetime
import json
import threading

HISTORY = Path("posting-history.json")
LOCK = threading.Lock()

class DashboardHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
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
            if any(p not in ("Facebook", "Instagram") for p in platforms):
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
    server = ThreadingHTTPServer(("127.0.0.1", 8765), DashboardHandler)
    print("LyriBop Advertising Dashboard server ready", flush=True)
    server.serve_forever()
