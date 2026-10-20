#!/usr/bin/env node
/* يفحص حزمة الألعاب (gaming-pack.js) قبل النشر:
   - كل فئة فيها سؤالان مختلفان على الأقل لكل قيمة (200/400/600)، وعدد الأسئلة لكل قيمة
   - إجابات مكررة داخل نفس الفئة
   - كل مقطع YouTube موجود وعام (oEmbed). هذا لا يكشف منع التشغيل خارج YouTube (خطأ 150)؛
     للفحص الحقيقي افتح tools/content/embed-check.html على خادم محلي.
   - كل صورة https تُحمَّل (HTTP 200 ونوعها صورة)
   الاستخدام:  node tools/content/check-pack.js  [--offline]   (offline = بدون فحص الروابط) */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const R = require("../../match-logic.js");

const root = path.resolve(__dirname, "../..");
const ctx = vm.createContext({});
vm.runInContext("var CATEGORIES = [];", ctx);
vm.runInContext(fs.readFileSync(path.join(root, "gaming-pack.js"), "utf8"), ctx);
const cats = vm.runInContext("CATEGORIES", ctx);
const offline = process.argv.includes("--offline");
let problems = 0;
const bad = (msg) => {
  problems++;
  console.log("  ✘ " + msg);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ويكيميديا ترد 429 إذا تتابعت الطلبات بسرعة: ننتظر ونعيد المحاولة
async function headWithRetry(u) {
  for (let i = 0; i < 4; i++) {
    if (u.includes("wikimedia.org")) await sleep(400 * (i + 1));
    const r = await fetch(u, { method: "HEAD", headers: { referer: "https://example.com/", "user-agent": "bio-quiz-content-check/1.0 (GitHub Pages quiz game)" } }).catch(() => null);
    if (r && r.status !== 429) return r;
    await sleep(2000 * (i + 1));
  }
  return { throttled: true };
}
let warnings = 0;

(async () => {
  for (const c of cats) {
    const per = [200, 400, 600].map((p) => c.questions.filter((q) => q.points === p).length);
    console.log(`\n${c.icon} ${c.name} [${c.group}] — ${c.questions.length} سؤال (سهل 200: ${per[0]} · متوسط 400: ${per[1]} · صعب 600: ${per[2]})`);
    if (!R.canFill(c)) bad("يلزم سؤالان مختلفان على الأقل لكل قيمة");
    if (Math.min(...per) < 3) console.log("  ⚠ أقل من 3 أسئلة في مستوى — اللوحة ستتكرر كثيراً");
    const seen = new Set();
    for (const q of c.questions) {
      const cq = R.cleanQuestion(q);
      if (!cq) bad(`سؤال غير صالح: ${q.q}`);
      else if ((q.type || "text") !== cq.type) bad(`الوسائط مرفوضة (رابط غير صالح؟): ${q.a}`);
      const k = String(q.a).trim().toLowerCase();
      if (seen.has(k)) bad(`إجابة مكررة: ${q.a}`);
      seen.add(k);
      if (offline) continue;
      if (q.yt) {
        const r = await fetch("https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=" + q.yt);
        if (r.status !== 200) bad(`YouTube ${q.yt} لا يسمح بالتضمين أو محذوف (${r.status}) — ${q.a}`);
      }
      for (const f of ["img", "aImg"]) {
        const u = q[f];
        if (!u || !u.startsWith("https://")) continue;
        const r = await headWithRetry(u);
        if (r.throttled) {
          warnings++;
          console.log(`  ⚠ لم يُفحص (ويكيميديا تطلب التمهّل، أعد الفحص بعد دقائق): ${u}`);
          continue;
        }
        if (!r.ok || !/^image\//.test(r.headers.get("content-type") || "")) bad(`صورة لا تُحمَّل (${r ? r.status : "شبكة"}): ${u}`);
      }
    }
  }
  console.log(problems ? `\n✘ ${problems} مشكلة` : warnings ? `\n✔ لا مشاكل (⚠ ${warnings} رابط لم يُفحص بسبب التمهّل)` : "\n✔ كل شيء سليم");
  process.exit(problems ? 1 : 0);
})();
