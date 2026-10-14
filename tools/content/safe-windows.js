#!/usr/bin/env node
/* يحسب «فترات آمنة» (win) لمقطع أغنية: أجزاء لا يُغنّى فيها اسم الكرتون/الأنمي،
   من كلمات متزامنة (lrclib.net)، ويختار مقطع YouTube الذي تطابق مدته مدة الكلمات
   (حتى يكون التوقيت صحيحاً).
   الاستخدام:
     node tools/content/safe-windows.js --song "المحقق كونان" --ban "كونان,conan" [--search "المحقق كونان شارة"]
     node tools/content/safe-windows.js --yt LbD4btWrWaM --song "المحقق كونان" --ban "كونان"
     خيارات: --artist "..."  --min 6 (أقصر فترة)  --skip 0 (تجاهل أول ثوانٍ)  --json (سطر JSON فقط)
   المخرجات: الكلمات بتوقيتها (✘ = فيها اسم ممنوع) ثم:  yt: "..."  win: [[من، إلى], ...] */
const args = {};
process.argv.slice(2).forEach((v, i, all) => {
  if (v.startsWith("--")) args[v.slice(2)] = all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true;
});
if (!args.song) {
  console.error('usage: node tools/content/safe-windows.js --song "name" --ban "w1,w2" [--yt ID | --search "query"] [--artist x] [--min 6] [--skip 0] [--json]');
  process.exit(1);
}
const UA = { "user-agent": "bio-quiz-content/1.0 (non-commercial university quiz game)" };
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ");
const bans = String(args.ban || "").split(",").map(norm).map((s) => s.trim()).filter(Boolean);
const MIN = +(args.min || 6);
const SKIP = +(args.skip || 0);
const log = args.json ? () => {} : console.log;

const toSec = (t) => String(t).split(":").reduce((s, x) => s * 60 + +x, 0);
async function ytSearch(q) {
  const html = await (await fetch("https://www.youtube.com/results?hl=en&search_query=" + encodeURIComponent(q), { headers: { "user-agent": "Mozilla/5.0", "accept-language": "en" } })).text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  const out = [];
  if (!m) return out;
  (function walk(o) {
    if (!o || typeof o !== "object" || out.length >= 12) return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      if (v.lengthText) out.push({ id: v.videoId, title: (v.title?.runs || []).map((r) => r.text).join(""), len: toSec(v.lengthText.simpleText) });
      return;
    }
    for (const k in o) walk(o[k]);
  })(JSON.parse(m[1]));
  return out;
}
async function ytLength(id) {
  const html = await (await fetch("https://www.youtube.com/watch?v=" + id, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "en" } })).text();
  const m = html.match(/"lengthSeconds":"(\d+)"/);
  return m ? +m[1] : 0;
}
const embeddable = async (id) => (await fetch("https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=" + id)).status === 200;
const parseLrc = (lrc) =>
  lrc
    .split("\n")
    .map((l) => l.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/))
    .filter(Boolean)
    .map((m) => ({ t: +m[1] * 60 + +m[2], text: m[3] }));

(async () => {
  const q = new URLSearchParams(args.artist ? { track_name: args.song, artist_name: args.artist } : { q: args.song });
  const res = await (await fetch("https://lrclib.net/api/search?" + q, { headers: UA })).json().catch(() => []);
  const lyrics = (Array.isArray(res) ? res : []).filter((x) => x.syncedLyrics);
  if (!lyrics.length) {
    console.log(JSON.stringify({ song: args.song, error: "no-synced-lyrics" }));
    process.exit(2);
  }
  // اختيار زوج (كلمات، مقطع YouTube) بأقرب مدة
  let videos;
  if (args.yt) videos = [{ id: args.yt, title: "(given)", len: await ytLength(args.yt) }];
  else videos = await ytSearch(args.search || args.song);
  let best = null;
  for (const v of videos)
    for (const l of lyrics) {
      const d = Math.abs(l.duration - v.len);
      if (!best || d < best.d) best = { v, l, d };
    }
  if (!args.yt) {
    // تأكد أن المقطع المختار يسمح بالتضمين؛ وإلا جرّب التالي
    const ranked = [];
    for (const v of videos) for (const l of lyrics) ranked.push({ v, l, d: Math.abs(l.duration - v.len) });
    ranked.sort((a, b) => a.d - b.d);
    best = null;
    for (const r of ranked.slice(0, 8))
      if (await embeddable(r.v.id)) {
        best = r;
        break;
      }
  }
  if (!best) {
    console.log(JSON.stringify({ song: args.song, error: "no-embeddable-video" }));
    process.exit(3);
  }
  const { v, l } = best;
  log(`YouTube ${v.id} «${v.title}» ${v.len}s | lrclib «${l.trackName}» — ${l.artistName} ${Math.round(l.duration)}s | فرق ${Math.round(best.d)}s`);
  if (best.d > 4) log("⚠ المدة مختلفة: التوقيت قد لا يطابق هذا المقطع.");
  const lines = parseLrc(l.syncedLyrics);
  const bad = [];
  lines.forEach((ln, i) => {
    const end = i + 1 < lines.length ? lines[i + 1].t : ln.t + 6;
    const hit = bans.some((b) => norm(ln.text).includes(b));
    if (hit) bad.push([Math.max(0, ln.t - 1.5), end + 1]);
    log(`${hit ? "✘" : " "} ${ln.t.toFixed(1).padStart(6)}  ${ln.text}`);
  });
  const total = Math.min(v.len || l.duration, l.duration + 2);
  const wins = [];
  let from = SKIP;
  for (const [a, b] of bad.sort((x, y) => x[0] - y[0])) {
    if (a - from >= MIN) wins.push([Math.round(from), Math.floor(a)]);
    from = Math.max(from, b);
  }
  if (total - 3 - from >= MIN) wins.push([Math.round(from), Math.floor(total - 3)]);
  const out = { song: args.song, yt: v.id, title: v.title, len: v.len, lyricsLen: Math.round(l.duration), diff: Math.round(best.d), banned: bad.length, win: wins };
  log(`\nyt: "${v.id}", win: ${JSON.stringify(wins)}`);
  if (args.json) console.log(JSON.stringify(out));
})();
