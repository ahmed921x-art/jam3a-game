"""يولّد أيقونات «بايو» من الشعار الرسمي assets/logo.png دون تشويه (قصّ + تحجيم متناسب فقط).
التشغيل: python tools/make_icons.py  (من جذر المشروع)"""
from PIL import Image, ImageDraw
import base64, io, os

INK = (15, 16, 19, 255)  # --ink-0
SRC = Image.open("assets/logo.png").convert("RGBA")
W, H = SRC.size

# العلامة: الخلايا السداسية + BSC KU (الصفوف 27–326 في الملف الأصلي) بدون سطر الاسم الطويل
band = SRC.crop((0, 20, W, 333))
mark = band.crop(band.getbbox())
pad = 6
m = Image.new("RGBA", (mark.width + pad * 2, mark.height + pad * 2), (0, 0, 0, 0))
m.paste(mark, (pad, pad))
m.save("assets/logo-mark.png", optimize=True)

# الشعار الكامل مقصوصاً على حدوده (بنفس النسب)
full = SRC.crop(SRC.getbbox())
f = Image.new("RGBA", (full.width + 16, full.height + 16), (0, 0, 0, 0))
f.paste(full, (8, 8))
f.save("assets/logo-full.png", optimize=True)

def fit(img, box):
    r = min(box / img.width, box / img.height)
    return img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)

def tile(size, ratio, rounded):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg = Image.new("RGBA", (size, size), INK)
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=255)
        canvas.paste(bg, (0, 0), mask)
    else:
        canvas = bg
    art = fit(m, round(size * ratio))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas

tile(512, 0.80, True).save("assets/icon-512.png", optimize=True)
tile(192, 0.80, True).save("assets/icon-192.png", optimize=True)
tile(512, 0.62, False).save("assets/icon-maskable-512.png", optimize=True)  # منطقة أمان 80%
tile(180, 0.74, False).save("assets/apple-touch-icon.png", optimize=True)
tile(48, 0.86, True).save("assets/favicon-48.png", optimize=True)

# icon.svg يبقى (مسجّل في sw.js) لكن يغلّف الأيقونة الجديدة
buf = io.BytesIO(); tile(256, 0.80, True).save(buf, "PNG", optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
open("icon.svg", "w", encoding="utf-8").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 256 256">'
    f'<title>بايو</title><image width="256" height="256" href="data:image/png;base64,{b64}"/></svg>\n')
print("mark", m.size, "full", f.size)
