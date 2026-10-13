/* ===========================================================
   بايو (BIO) — فئات لوحة الأدمن من Firestore
   - categories/{id}      فئات يضيفها المشرفون
   - catalog/overrides    { hidden: [ids], images: { id: url } } للفئات الأساسية
   يُحمَّل بعد ملفات الأسئلة و firebase-config.js وقبل game.js.
   يطبّق آخر نسخة محفوظة محلياً فوراً (يعمل بدون اتصال)، ثم يجلب الأحدث
   ويطلب من اللعبة إعادة رسم منتقي الفئات إذا تغيّر شيء.
   =========================================================== */

const Catalog = (() => {
  const LS = "bio_catalog_v1";
  const TIERS = [200, 400, 600];
  const GROUPS = ["bio", "kuwait", "general"];
  const BASE = CATEGORIES.slice(); // الفئات الأساسية بعد questions-bio.js
  const BASE_IDS = new Set(BASE.map((c) => c.id));
  let lastSig = "";

  const txt = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const safeUrl = (v) => {
    const s = txt(v, 500);
    return /^(https:\/\/|assets\/)[^"'<>\s]+$/i.test(s) ? s : "";
  };

  // نفس شروط اللعبة: سؤالان مختلفان على الأقل لكل قيمة
  function cleanCat(d, id) {
    if (!d || typeof d !== "object") return null;
    const name = txt(d.name, 60);
    if (!name || !id) return null;
    const questions = (Array.isArray(d.questions) ? d.questions : [])
      .filter((q) => q && TIERS.includes(q.points) && txt(q.q, 500) && txt(q.a, 500))
      .map((q) => ({ points: q.points, q: txt(q.q, 500), a: txt(q.a, 500) }));
    const ok = TIERS.every((p) => new Set(questions.filter((q) => q.points === p).map((q) => q.q)).size >= 2);
    if (!ok) return null;
    const cat = { id: String(id), name, icon: txt(d.icon, 16) || "📁", group: GROUPS.includes(d.group) ? d.group : "general", questions, admin: true };
    const img = safeUrl(d.img);
    if (img) cat.img = img;
    return cat;
  }

  function apply(data) {
    const sig = JSON.stringify(data || {});
    if (sig === lastSig) return false;
    lastSig = sig;
    const hidden = new Set(Array.isArray(data.hidden) ? data.hidden : []);
    const images = data.images && typeof data.images === "object" ? data.images : {};
    const base = BASE.filter((c) => !hidden.has(c.id)).map((c) => {
      const img = safeUrl(images[c.id]);
      return img ? { ...c, img } : c;
    });
    const extra = (Array.isArray(data.cats) ? data.cats : [])
      .map((c) => cleanCat(c, c && c.id))
      .filter((c) => c && !BASE_IDS.has(c.id) && !hidden.has(c.id));
    // كل فئة إضافية تظهر في آخر مجموعتها
    const rank = { bio: 0, kuwait: 1, general: 2 };
    const all = [...base, ...extra].map((c, i) => [c, i]);
    all.sort((a, b) => (rank[a[0].group] ?? 3) - (rank[b[0].group] ?? 3) || a[1] - b[1]);
    CATEGORIES.length = 0;
    all.forEach(([c]) => CATEGORIES.push(c));
    return true;
  }

  // 1) نسخة محلية فورية
  try {
    const cached = JSON.parse(localStorage.getItem(LS));
    if (cached) apply(cached);
  } catch {}

  // 2) الأحدث من Firestore
  async function load() {
    if (typeof FB === "undefined" || !FB.db) return;
    try {
      const [cs, ov] = await Promise.all([
        FB.db.collection("categories").get(),
        FB.db.collection("catalog").doc("overrides").get(),
      ]);
      const o = ov.exists ? ov.data() : {};
      const data = {
        cats: cs.docs.map((d) => cleanCat(d.data(), d.id)).filter(Boolean),
        hidden: Array.isArray(o.hidden) ? o.hidden.filter((x) => typeof x === "string") : [],
        images: o.images && typeof o.images === "object" ? o.images : {},
      };
      try {
        localStorage.setItem(LS, JSON.stringify(data));
      } catch {}
      if (apply(data) && typeof Game !== "undefined" && Game.refreshCatalog) Game.refreshCatalog();
    } catch (e) {
      // بدون اتصال أو القواعد لم تُنشر بعد: نكمل بالنسخة الحالية
    }
  }
  document.addEventListener("DOMContentLoaded", () => setTimeout(load, 0));

  return { load, cleanCat, TIERS, GROUPS };
})();
