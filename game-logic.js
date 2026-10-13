/* Pure, dependency-free rules shared by the browser and Node tests. */
const BioRules = (() => {
  const TIERS = [200, 400, 600];
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const key = (value) => text(value).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const safeImage = (value) => {
    const v = text(value);
    return /^(https?:\/\/|\.\/|\/[^/])[^"'<>]*$/i.test(v) ? v : "";
  };

  function validQuestion(q) {
    return !!(q && TIERS.includes(q.points) && text(q.q) && text(q.a));
  }

  function validCategory(cat) {
    return cat && text(cat.name) && Array.isArray(cat.questions) &&
      TIERS.every((points) => new Set(cat.questions.filter((q) => validQuestion(q) && q.points === points).map((q) => key(q.q))).size >= 2);
  }

  function cleanCategory(cat) {
    if (!cat || typeof cat !== "object") return null;
    const questions = Array.isArray(cat.questions) ? cat.questions.filter(validQuestion).map((q) => ({
      points: q.points, q: text(q.q).slice(0, 500), a: text(q.a).slice(0, 500),
      ...(safeImage(q.img) ? { img: safeImage(q.img) } : {}),
      ...(safeImage(q.aImg) ? { aImg: safeImage(q.aImg) } : {}),
    })) : [];
    const cleaned = { id: text(cat.id) || `c_${Math.random().toString(36).slice(2)}`, name: text(cat.name).slice(0, 60), icon: text(cat.icon).slice(0, 8) || "📁", ...(safeImage(cat.img) ? { img: safeImage(cat.img) } : {}), questions, custom: true };
    return validCategory(cleaned) ? cleaned : null;
  }

  function pickBoard(categories, random = true, rng = Math.random) {
    const used = new Set();
    return categories.map((cat) => {
      if (!validCategory(cat)) throw new Error(`Invalid category: ${cat?.name || "?"}`);
      const questions = [];
      for (const points of TIERS) {
        const pool = cat.questions.filter((q) => q.points === points && validQuestion(q));
        const ordered = pool.slice();
        if (random) for (let i = ordered.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
        }
        const picked = [];
        for (const q of ordered) {
          const id = key(q.q);
          if (used.has(id) || picked.some((item) => key(item.q) === id)) continue;
          picked.push({ ...q, done: false });
          used.add(id);
          if (picked.length === 2) break;
        }
        if (picked.length !== 2) throw new Error(`Not enough unique ${points} questions in ${cat.name}`);
        questions.push(...picked);
      }
      return { name: cat.name, icon: cat.icon || "📁", img: cat.img || "", questions, pool: cat.questions };
    });
  }

  function replacement(cat, points, excluded, rng = Math.random) {
    const candidates = (cat.pool || []).filter((q) => q.points === points && validQuestion(q) && !excluded.has(key(q.q)));
    return candidates.length ? { ...candidates[Math.floor(rng() * candidates.length)], done: false } : null;
  }

  function award(teams, currentTurn, answeringTeam, points) {
    if (![0, 1, 2].includes(answeringTeam) || ![1, 2].includes(currentTurn) || !TIERS.includes(points)) throw new Error("Invalid award");
    const next = teams.map((team, i) => ({ ...team, score: finite(team.score) + (answeringTeam === i + 1 ? points : 0), correct: finite(team.correct) + (answeringTeam === i + 1 ? 1 : 0) }));
    return { teams: next, turn: currentTurn === 1 ? 2 : 1, stolen: answeringTeam > 0 && answeringTeam !== currentTurn };
  }

  function clampWager(value, score) {
    const n = Number(value);
    return Math.min(Math.max(0, Number.isFinite(n) ? Math.round(n) : 0), Math.max(0, finite(score)));
  }

  function advanceTimer(elapsed, lastTick, now, paused) {
    const since = Number.isFinite(lastTick) ? lastTick : now;
    if (paused) return { elapsed: Math.max(0, finite(elapsed)), lastTick: now };
    const seconds = Math.max(0, Math.floor((now - since) / 1000));
    return { elapsed: Math.max(0, finite(elapsed)) + seconds, lastTick: since + seconds * 1000 };
  }

  function applyGolden(teams, wagers, results) {
    if (!Array.isArray(results) || results.length !== 2 || results.some((x) => typeof x !== "boolean")) throw new Error("Golden results incomplete");
    return teams.map((team, i) => {
      const wager = clampWager(wagers[i], team.score);
      return { ...team, score: finite(team.score) + (results[i] ? wager : -wager), correct: finite(team.correct) + (results[i] ? 1 : 0) };
    });
  }

  function validateSnapshot(s) {
    if (!s || !Array.isArray(s.teams) || s.teams.length !== 2 || ![1, 2].includes(s.turn) || !Array.isArray(s.cats) || s.cats.length < 1) return false;
    if (s.teams.some((t) => !t || !text(t.name) || !Number.isFinite(t.score) || !Array.isArray(t.lifelines))) return false;
    if (s.cats.some((c) => !c || !Array.isArray(c.questions) || c.questions.length !== 6 || c.questions.some((q) => !validQuestion(q) || typeof q.done !== "boolean"))) return false;
    if (s.current && !s.current.tie && (!s.cats[s.current.ci]?.questions[s.current.qi] || s.cats[s.current.ci].questions[s.current.qi].done)) return false;
    if (s.current?.tie && (!text(s.current.q) || !text(s.current.a))) return false;
    if (s.phase === "golden" && (!s.golden || !text(s.golden.q) || !text(s.golden.a) || !Array.isArray(s.golden.wagers) || s.golden.wagers.length !== 2 || !Array.isArray(s.golden.results) || s.golden.results.length !== 2)) return false;
    return true;
  }

  return { TIERS, key, validQuestion, validCategory, cleanCategory, pickBoard, replacement, award, clampWager, applyGolden, advanceTimer, validateSnapshot };
})();
if (typeof globalThis !== "undefined") globalThis.BioRules = BioRules;
if (typeof module !== "undefined") module.exports = BioRules;
