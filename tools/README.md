# أدوات الأصول

## الأيقونات ونسخ الشعار
```bash
python tools/make_icons.py
```
يقرأ `assets/logo.png` (الشعار الرسمي، لا يُعدَّل) ويولّد بالقصّ والتحجيم المتناسب فقط:
`assets/logo-mark.png` و`logo-full.png` و`icon-192.png` و`icon-512.png` و`icon-maskable-512.png` (منطقة أمان 80%) و`apple-touch-icon.png` و`favicon-48.png`، بالإضافة إلى `icon.svg` (غلاف PNG للتوافق مع `sw.js`).
يتطلب Pillow (`pip install pillow`).

## صورة المشاركة (1200×630)
`tools/og.html` هو المصدر. شغّل خادماً محلياً من جذر المشروع ثم صوّرها بمتصفح Chromium:
```bash
python -m http.server 8766
msedge --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1200,630 --virtual-time-budget=6000 --screenshot=assets/og-image.png http://localhost:8766/tools/og.html
```
(يعمل الأمر نفسه مع `chrome`.) بعد التوليد حدّث `og-image.svg` (غلاف PNG) إذا كان ما زال مسجّلاً في `sw.js`.
