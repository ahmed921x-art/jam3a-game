#!/usr/bin/env bash
# التقاط لقطات اللعبة بدقة 3x. يتطلب خادماً محلياً: python -m http.server 8777 (من جذر المشروع)
# الاستخدام: bash marketing/tools/capture.sh [حالة...]
cd "$(dirname "$0")/../.."
CH="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PROFILE="$(mktemp -d)"
STATES="${*:-landing setup board question answer judge lifeline golden result}"
for s in $STATES; do
  out="marketing/shots/m-$s.png"
  timeout 60 "$CH" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$PROFILE" \
    --window-size=520,844 --force-device-scale-factor=3 --virtual-time-budget=25000 \
    --screenshot="$(cygpath -w "$PWD/$out")" "http://localhost:8777/marketing/tools/capture.html?s=$s" >/dev/null 2>&1
  python -c "from PIL import Image; im=Image.open('$out'); im.crop((0,0,1170,2532)).save('$out')" && echo "ok $s"
done
