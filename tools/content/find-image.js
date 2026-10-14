#!/usr/bin/env node
/* صور الشخصيات والأجهزة.
   الاستخدام:
     node tools/content/find-image.js smash mario sonic cloud     ← رندر رسمي عالي الدقة من موقع Smash Bros (SMASH("id"))
     node tools/content/find-image.js wiki "Kratos_(God_of_War)"   ← صورة مقال ويكيبيديا (أقل دقة)
     node tools/content/find-image.js commons "PS4-Console-wDS4.jpg" ← صورة حرّة من Wikimedia Commons (COMMONS("..."))
   ملاحظة: مواقع Fandom تمنع عرض صورها من مواقع ثانية، فلا تستخدمها. */
const [kind, ...names] = process.argv.slice(2);
const UA = { "user-agent": "bio-quiz-content/1.0" };
if (!kind || !names.length) {
  console.error("usage: node tools/content/find-image.js smash|wiki|commons NAME...");
  process.exit(1);
}

(async () => {
  if (kind === "smash") {
    for (const id of names) {
      const r = await fetch(`https://www.smashbros.com/assets_v2/img/fighter/${id}/main.png`, { method: "HEAD", headers: { referer: "https://example.com/" } });
      console.log(`${id} | ${r.ok ? `OK → SMASH("${id}")` : "NOT FOUND (جرّب اسماً آخر: koopa=Bowser, rockman=Mega Man, pac_man)"}`);
    }
  } else if (kind === "wiki") {
    for (const t of names) {
      const j = await (await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(t), { headers: UA })).json().catch(() => ({}));
      const img = j.originalimage || j.thumbnail;
      console.log(`${t} | ${img ? `${img.width}x${img.height} ${img.source.split("?")[0]}` : "NO IMAGE"}`);
    }
  } else if (kind === "commons") {
    const u = "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size&iiurlwidth=1280&titles=" + names.map((f) => "File:" + f).join("|");
    const j = await (await fetch(u, { headers: UA })).json();
    for (const p of Object.values(j.query.pages)) {
      const i = p.imageinfo && p.imageinfo[0];
      console.log(`${p.title} | ${i ? `${i.width}x${i.height} → COMMONS("${i.thumburl.split("?")[0].replace(/^.*\/commons\/thumb\//, "")}")` : "MISSING"}`);
    }
  } else console.error("kind must be smash, wiki or commons");
})();
