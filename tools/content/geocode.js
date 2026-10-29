#!/usr/bin/env node
/* إحداثيات أماكن من OpenStreetMap (Nominatim) لفئة «قوقل ماب الكويت».
   الاستخدام:  node tools/content/geocode.js "Kuwait Towers" "The Avenues Mall Kuwait"
   المخرجات:  الاسم | lat, lng | النوع | الوصف الكامل — تحقّق بالعين قبل الإضافة (tools/content/map-check.html).
   سياسة Nominatim: طلب واحد في الثانية مع User-Agent واضح. */
const names = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const q of names) {
    const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kw&q=" + encodeURIComponent(q);
    const r = await fetch(url, { headers: { "user-agent": "bio-quiz-content/1.0 (non-commercial university quiz game)", "accept-language": "en" } });
    const j = await r.json().catch(() => []);
    const p = j[0];
    console.log(p ? `${q} | ${(+p.lat).toFixed(5)}, ${(+p.lon).toFixed(5)} | ${p.type} | ${p.display_name.slice(0, 90)}` : `${q} | NOT FOUND`);
    await sleep(1100);
  }
})();
