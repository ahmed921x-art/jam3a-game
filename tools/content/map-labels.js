#!/usr/bin/env node
/* أسماء الشوارع والأماكن المحيطة بمكان (من OpenStreetMap عبر Overpass) لفئة «قوقل ماب الكويت».
   اسم المكان المقصود لا يظهر أبداً:
     1) أي عنصر فيه كلمة من --ban في أي من وسومه (name/name:en/alt_name/brand/operator/addr…) يُحذف.
     2) «منطقة الهدف» = كل مضلّع يحتوي نقطة الهدف (أصغر من 4 كم²) + كل مضلّع اسمه محظور.
        أي محل/فندق/مطعم داخلها أو ملاصق لها (هامش BUF) يُحذف — فلا تظهر محلات المول مثل كيدزانيا داخل الأفنيوز.
     3) العناصر الداخلية (indoor / level) تُحذف دائماً، والطرق لا تُوسَم إلا من جزء خارج منطقة الهدف.
   الاستخدام:
     node tools/content/map-labels.js --lat 29.38992 --lng 48.00329 --z 17 --ban "أبراج,Towers,ابراج"
   المخرجات: سطر labels جاهز للنسخ: [[lat, lng, "الاسم", "road"|"poi"], ...] */
const args = {};
process.argv.slice(2).forEach((v, i, all) => {
  if (v.startsWith("--")) args[v.slice(2)] = all[i + 1];
});
const lat = +args.lat, lng = +args.lng, z = +(args.z || 17);
const bans = String(args.ban || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
// --hide: كلمات تُخفى من الأسماء بدون اعتبارها منطقة هدف (مثل «كلية» داخل حرم جامعي كامل)
const hides = String(args.hide || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
  console.error('usage: node tools/content/map-labels.js --lat 29.3 --lng 47.9 --z 17 --ban "word1,word2"');
  process.exit(1);
}
// مساحة اللوحة تقريباً 900×520 بكسل؛ متر لكل بكسل عند الزوم z
const mpp = (156543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
const radius = Math.round(Math.min(6000, 520 * mpp)); // نصف عرض الشاشة تقريباً
const MIN_FROM_TARGET = Math.max(50, 40 * mpp); // لا أسماء ملاصقة لنقطة الهدف
const BUF = Math.max(60, 25 * mpp); // هامش حول منطقة الهدف

const q = `[out:json][timeout:60];
is_in(${lat},${lng})->.a;
(
  way(pivot.a)[name];
  rel(pivot.a)[name];
  way(around:${radius},${lat},${lng})[name][highway~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"];
  node(around:${radius},${lat},${lng})[name][~"^(amenity|tourism|leisure|historic|shop|office)$"~"."];
  way(around:${radius},${lat},${lng})[name][~"^(amenity|tourism|leisure|historic|shop|building|aeroway|landuse)$"~"."];
  rel(around:${radius},${lat},${lng})[name][~"^(amenity|tourism|leisure|historic|shop|building|aeroway)$"~"."];
);out geom tags;`;

const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

// إحداثيات محلية بالأمتار حول الهدف
const R = 6371000, rad = Math.PI / 180, kx = Math.cos(lat * rad) * R * rad, ky = R * rad;
const loc = ([a, b]) => [(b - lng) * kx, (a - lat) * ky];
const dist = (a, b, c, d) => Math.hypot((d - b) * kx, (c - a) * ky);
// موقع الشاشة بالبكسل نسبة للمركز
const px = (la, ln) => {
  const n = 256 * 2 ** z;
  const Y = (v) => ((1 - Math.log(Math.tan(v * rad) + 1 / Math.cos(v * rad)) / Math.PI) / 2) * n;
  return [((ln - lng) / 360) * n, Y(la) - Y(lat)];
};

// حلقات المضلّع (way مغلق أو أجزاء outer لعلاقة) بإحداثيات محلية
const rings = (e) => {
  if (e.type === "way" && e.geometry && e.geometry.length > 3) {
    const g = e.geometry, f = g[0], l = g[g.length - 1];
    if (f.lat === l.lat && f.lon === l.lon) return [g.map((p) => loc([p.lat, p.lon]))];
  }
  if (e.type === "relation" && e.members) {
    return e.members.filter((m) => m.role === "outer" && m.geometry).map((m) => m.geometry.map((p) => loc([p.lat, p.lon])));
  }
  return [];
};
const area = (r) => Math.abs(r.reduce((s, p, i) => { const q2 = r[(i + 1) % r.length]; return s + p[0] * q2[1] - q2[0] * p[1]; }, 0)) / 2;
const inside = ([x, y], r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const segDist = ([x, y], [x1, y1], [x2, y2]) => {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
};
const nearRing = (p, r, buf) => inside(p, r) || r.some((a, i) => i && segDist(p, r[i - 1], a) < buf);

const allText = (tags) => Object.entries(tags).filter(([k]) => !/^(highway|building|source|wikidata|wikipedia|opening_hours|phone|website|layer)/.test(k)).map(([, v]) => v).join(" ").toLowerCase();
const banned = (tags) => bans.some((b) => allText(tags).includes(b));
const hidden = (tags) => hides.some((b) => allText(tags).includes(b));

(async () => {
  let j;
  for (let t = 0; t < 6 && !j; t++) {
    try {
      const r = await fetch(MIRRORS[t % MIRRORS.length], { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "bio-quiz-content/1.0" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(70000) });
      if (r.ok) j = await r.json();
    } catch (e) { /* جرّب الخادم التالي */ }
    if (!j) await new Promise((s) => setTimeout(s, 3000 * (t + 1)));
  }
  if (!j) { console.log("labels: []  // Overpass unavailable"); process.exitCode = 2; return; }

  // منطقة الهدف
  const zones = [];
  for (const e of j.elements) {
    const tags = e.tags || {};
    if (tags.boundary || tags.admin_level || tags.place) continue; // المحافظات والمناطق السكنية لا تُعدّ هدفاً
    for (const r of rings(e)) {
      const a = area(r);
      if (banned(tags) || (inside([0, 0], r) && a < 4e6 && !hidden(tags))) zones.push(r);
    }
  }
  const inZone = (p) => zones.some((r) => nearRing(loc(p), r, BUF));

  const cands = [];
  for (const e of j.elements) {
    const tags = e.tags || {};
    const name = tags["name:ar"] || tags.name;
    if (!name || tags.boundary || tags.admin_level || tags.place) continue;
    if (banned(tags) || hidden(tags) || tags.indoor || tags.level != null || tags["level:ref"]) continue;
    const road = !!tags.highway;
    let pts = e.type === "node" ? [[e.lat, e.lon]] : (e.geometry || (e.members || []).flatMap((m) => m.geometry || [])).map((g) => [g.lat, g.lon]);
    if (!pts.length) continue;
    // للمباني: لو المضلّع يحتوي نقطة الهدف فهو الهدف نفسه
    if (!road && rings(e).some((r) => inside([0, 0], r))) continue;
    let best;
    if (road) {
      pts = pts.filter(([a, b]) => { const [x, y] = px(a, b); return Math.abs(x) < 420 && Math.abs(y) < 230; }).filter((p) => !inZone(p));
      if (!pts.length) continue;
      best = pts.reduce((m, p) => (dist(lat, lng, p[0], p[1]) < dist(lat, lng, m[0], m[1]) ? p : m), pts[0]);
    } else {
      if (pts.some((p) => inZone(p))) continue; // داخل المكان المقصود أو ملاصق له (محلات المول، فنادقه…)
      best = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
      const [x, y] = px(best[0], best[1]);
      if (Math.abs(x) >= 420 || Math.abs(y) >= 230) continue;
    }
    const d = dist(lat, lng, best[0], best[1]);
    if (!road && d < MIN_FROM_TARGET) continue;
    const rank = road ? ({ motorway: 0, trunk: 0, primary: 1, secondary: 2, tertiary: 3 }[tags.highway] ?? 5) : tags.tourism || tags.historic ? 1 : tags.amenity || tags.leisure ? 3 : 4;
    cands.push({ name, road, rank, d, p: best.map((v) => +v.toFixed(5)) });
  }
  // أفضل الأسماء مع مسافة كافية بينها على الشاشة حتى لا تتداخل
  cands.sort((a, b) => a.rank - b.rank || a.d - b.d);
  const out = [], seen = new Set();
  for (const c of cands) {
    if (seen.has(c.name)) continue;
    const [x, y] = px(c.p[0], c.p[1]);
    if (Math.hypot(x, y) < 70) continue; // مكان علامة «؟» في المنتصف
    if (out.some((o) => { const [ox, oy] = px(o[0], o[1]); return Math.abs(ox - x) < 150 && Math.abs(oy - y) < 34; })) continue;
    seen.add(c.name);
    out.push([c.p[0], c.p[1], c.name, c.road ? "road" : "poi"]);
    if (out.length >= 10) break;
  }
  console.log(`radius ${radius}m, ${zones.length} target zones, ${cands.length} candidates`);
  console.log("labels: " + JSON.stringify(out));
})();
