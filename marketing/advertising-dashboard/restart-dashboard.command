#!/bin/bash
set -euo pipefail
lyribop_dashboard="/Users/billdonofrio/Projects/personal-song-maker-v4/marketing/advertising-dashboard"
lyribop_pids=$(/usr/sbin/lsof -nP -t -iTCP@127.0.0.1:8765 -sTCP:LISTEN || true)
for lyribop_pid in $lyribop_pids; do
  lyribop_command=$(/bin/ps -p "$lyribop_pid" -o command=)
  lyribop_cwd=$(/usr/sbin/lsof -a -p "$lyribop_pid" -d cwd -Fn | /usr/bin/sed -n 's/^n//p')
  if [[ "$lyribop_command" == *"dashboard-server.py"* ]] && { [[ "$lyribop_cwd" == "$lyribop_dashboard" ]] || [[ "$lyribop_command" == *"$lyribop_dashboard/dashboard-server.py"* ]]; }; then
    kill -TERM "$lyribop_pid"
  else
    echo "Port 8765 is used by another application. Nothing was stopped."
    read -r -p "Press Return to close."
    exit 1
  fi
done
for lyribop_attempt in {1..20}; do
  if ! /usr/sbin/lsof -nP -t -iTCP@127.0.0.1:8765 -sTCP:LISTEN >/dev/null; then break; fi
  /bin/sleep 0.25
done
cd "$lyribop_dashboard"
echo "Starting LyriBop Advertising Dashboard. Keep this window open."
echo "Refresh http://127.0.0.1:8765/index.html and choose Ad Scheduler."
echo "Plans are saved locally. Automatic publishing is not connected."
exec /usr/bin/python3 dashboard-server.py
