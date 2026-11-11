#!/usr/bin/env bash
# Runs the watcher in a loop for one long shift (about 5h40m by default, under GitHub's 6-hour job limit).
# Each pass waits up to POLL_TIMEOUT seconds for bot messages, answers them, scans Base Sepolia for new
# vault events, and saves the encrypted subscriber list if it changed. The workflow starts the next shift.
set -uo pipefail

end=$((SECONDS + ${SHIFT_SECONDS:-20400}))
export POLL_TIMEOUT="${POLL_TIMEOUT:-25}"
passes=0
while [ "$SECONDS" -lt "$end" ]; do
  node alerts/watch.js > /tmp/watch.log 2>&1 || { echo "::warning::watch pass failed"; cat /tmp/watch.log; sleep 10; }
  grep -v "^no new\|^scanned\|^0 " /tmp/watch.log | head -20 || true
  bash alerts/state-branch.sh save alerts-state > /dev/null || echo "::warning::could not save subscribers this pass"
  passes=$((passes + 1))
  if [ $((passes % 100)) -eq 0 ]; then echo "$passes passes, $((SECONDS / 60)) min"; fi
  sleep 1
done
echo "shift over after $passes passes"
