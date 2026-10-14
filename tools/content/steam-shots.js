#!/usr/bin/env node
/* لقطات ألعاب حقيقية 1920×1080 من متجر Steam.
   الاستخدام:  node tools/content/steam-shots.js "Elden Ring"        (بحث بالاسم)
               node tools/content/steam-shots.js 1245620              (رقم اللعبة في Steam)
   المخرجات:  اسم اللعبة وسنة صدورها، ثم المسار الذي يوضع داخل STEAM("...") في gaming-pack.js
   مهم: افتح اللقطة وتأكد أنها بلا اسم اللعبة أو شعارها (أو استخدم zoom لقصّ الحواف). */
const arg = process.argv[2];
if (!arg) {
  console.error('usage: node tools/content/steam-shots.js "game name" | appid');
  process.exit(1);
}

async function appIds(term) {
  if (/^\d+$/.test(term)) return [term];
  const j = await (await fetch("https://store.steampowered.com/api/storesearch/?cc=us&l=english&term=" + encodeURIComponent(term))).json();
  return (j.items || []).slice(0, 3).map((x) => String(x.id));
}

(async () => {
  for (const id of await appIds(arg)) {
    const j = await (await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english`)).json();
    const d = j[id] && j[id].data;
    if (!d) continue;
    console.log(`\n## ${d.name} (${d.release_date?.date || "?"}) — appid ${id}`);
    (d.screenshots || []).slice(0, 10).forEach((s, i) => {
      const path = s.path_full.split("?")[0].replace(/^.*\/apps\//, "").replace(/\.1920x1080\.jpg$/, "");
      console.log(`  ${i}: STEAM("${path}")   preview: ${s.path_thumbnail.split("?")[0]}`);
    });
  }
})();
