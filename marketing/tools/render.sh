#!/usr/bin/env bash
# يصوّر قوالب design.html. يتطلب: python -m http.server 8777 (من جذر المشروع)
cd "$(dirname "$0")/../.."
CH="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROFILE="$(mktemp -d)"
mkdir -p marketing/posts marketing/video/scenes
for k in ${*:-post1 post2 post3 s1 s2 s3 s4 s5 s6 s7}; do
  case $k in post*) H=1350; out="marketing/posts/$k.png";; *) H=1920; out="marketing/video/scenes/$k.png";; esac
  timeout 60 "$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" \
    --window-size=1080,$H --force-device-scale-factor=1 --virtual-time-budget=8000 \
    --screenshot="$(cygpath -w "$PWD/$out")" "http://localhost:8777/marketing/tools/design.html?k=$k" >/dev/null 2>&1
  echo "ok $k"
done
