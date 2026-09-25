#!/usr/bin/env bash
# Runs every tests/*.test.js under gjs and fails on any non-zero exit.
# gjs is the GNOME JavaScript runtime that executes the extension; unit tests
# here are plain-JS (no gi/resource imports) so they run headless.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAIL=0

for testfile in "$DIR"/*.test.js; do
  echo "==> $(basename "$testfile")"
  gjs -m "$testfile" || FAIL=1
done

if [ "$FAIL" -ne 0 ]; then
  echo "==> FAILURES PRESENT" >&2
  exit 1
fi
echo "==> all tests passed"
exit 0
