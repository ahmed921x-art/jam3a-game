#!/usr/bin/env node
/* بحث في YouTube + فحص السماح بالتضمين.
   الاستخدام:  node tools/content/yt-search.js "شارة كابتن ماجد" [عدد=5]
   المخرجات:  المعرّف | العنوان | المدة | القناة | embed-ok أو NO-EMBED
   استخدم المعرّف في gaming-pack.js كـ yt: "..." */
const q = process.argv[2];
const n = +(process.argv[3] || 5);
if (!q) {
  console.error('usage: node tools/content/yt-search.js "query" [count]');
  process.exit(1);
}

async function embeddable(id) {
  const r = await fetch("https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=" + id);
  return r.status === 200;
}

(async () => {
  const res = await fetch("https://www.youtube.com/results?hl=en&search_query=" + encodeURIComponent(q), {
    headers: { "accept-language": "en", "user-agent": "Mozilla/5.0" },
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) {
    console.error("YouTube returned no results page (try again in a minute).");
    process.exit(2);
  }
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object" || out.length >= n) return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      out.push({ id: v.videoId, title: (v.title?.runs || []).map((r) => r.text).join(""), len: v.lengthText?.simpleText || "live", ch: v.ownerText?.runs?.[0]?.text || "" });
      return;
    }
    for (const k in o) walk(o[k]);
  })(JSON.parse(m[1]));
  for (const v of out) console.log([v.id, v.title, v.len, v.ch, (await embeddable(v.id)) ? "embed-ok" : "NO-EMBED"].join(" | "));
})();
