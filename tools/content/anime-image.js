#!/usr/bin/env node
/* صور شخصيات وأنميات من AniList (قاعدة بيانات أنمي مفتوحة).
   الاستخدام:
     node tools/content/anime-image.js character "Monkey D. Luffy" "Levi"   ← صورة الشخصية + الأنمي التابعة له
     node tools/content/anime-image.js anime "Detective Conan" "Slam Dunk" ← غلاف (عمودي) وبانر (عريض، غالباً بلا عنوان)
   ملاحظة: صور الشخصيات 230×345 تقريباً؛ البانرات عريضة وعالية الدقة. */
const [kind, ...names] = process.argv.slice(2);
if (!kind || !names.length) {
  console.error('usage: node tools/content/anime-image.js character|anime "name" ...');
  process.exit(1);
}
const Q = {
  character: `query($s:String){ Character(search:$s){ name{full native} image{large} favourites media(perPage:1,sort:POPULARITY_DESC){nodes{title{romaji english}}} } }`,
  anime: `query($s:String){ Media(search:$s,type:ANIME,sort:POPULARITY_DESC){ title{romaji english} startDate{year} popularity coverImage{extraLarge} bannerImage } }`,
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  for (const s of names) {
    let j = {};
    for (let tries = 0; tries < 5; tries++) {
      const r = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query: Q[kind], variables: { s } }) });
      if (r.status === 429) {
        await sleep(+(r.headers.get("retry-after") || 30) * 1000 + 500); // تجاوزنا الحد: انتظر ثم أعد
        continue;
      }
      j = await r.json().catch(() => ({}));
      break;
    }
    if (kind === "character") {
      const c = j.data && j.data.Character;
      const m = c && c.media.nodes[0];
      console.log(c ? `${s} | ${c.name.full} | ${m ? m.title.english || m.title.romaji : "?"} | ❤${c.favourites} | ${c.image.large}` : `${s} | NOT FOUND`);
    } else {
      const m = j.data && j.data.Media;
      console.log(m ? `${s} | ${m.title.english || m.title.romaji} (${m.startDate.year}) | pop ${m.popularity} | cover ${m.coverImage.extraLarge} | banner ${m.bannerImage || "-"}` : `${s} | NOT FOUND`);
    }
    await sleep(700); // AniList يسمح بحوالي 90 طلباً في الدقيقة
  }
})();
