/* ===========================================================
   بايو — قواعد مباراة «سين وجيم» (نقية، بلا DOM، تُختبر في Node)
   لوحة: أعمدة = فئات، وفي كل فئة خانتان لكل مستوى صعوبة (سهل/متوسط/صعب)
   حتى يكون لكل فريق فرصة متساوية في نفس الفئة — مثل سين جيم (200 200 400 400 600 600).
   فريقان (أو لاعبان)، دور يتناوب، سرقة اختيارية، وكل خانة تُلعب مرة واحدة.
   =========================================================== */
const MatchRules = (() => {
  const TIERS = [200, 400, 600]; // نقاط الأسئلة في البيانات = مستوى الصعوبة
  const PER_TIER = 2;
  // قيم اللوحة الظاهرة (يختارها المقدّم)؛ المفتاح = قيمة السؤال السهل
  const VALUES = { 100: [100, 200, 300], 200: [200, 400, 600], 300: [300, 600, 900], 500: [500, 1000, 1500] };
  const TYPES = ["text", "image", "audio", "video"];

  const text = (v) => (typeof v === "string" ? v.trim() : "");
  const key = (v) => text(v).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const media = (v) => {
    const s = text(v);
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return s; // صور لوحة الأدمن
    if (/^https:\/\/[^"'<>\s]+$/i.test(s)) return s;
    // مسار نسبي داخل الموقع فقط (بلا .. ولا بروتوكول)
    return /^(\.\/)?[\w-]+(\/[\w.-]+)+$/.test(s) && !s.includes("..") ? s : "";
  };

  const tierOf = (q) => (q && typeof q === "object" ? TIERS.indexOf(q.points) : -1);

  function cleanQuestion(q) {
    if (!q || typeof q !== "object") return null;
    const out = { q: text(q.q), a: text(q.a), type: TYPES.includes(q.type) ? q.type : "text" };
    for (const f of ["img", "aImg", "audio", "video"]) if (media(q[f])) out[f] = media(q[f]);
    if (Number.isFinite(q.blur)) out.blur = Math.max(0, Math.min(40, q.blur));
    // zoom: تكبير جزء من الصورة حتى الكشف (يقصّ شعاراً في الزاوية، أو يصعّب السؤال)؛ focus: مركز التكبير
    if (Number.isFinite(q.zoom)) out.zoom = Math.max(1, Math.min(4, q.zoom));
    if (/^\d{1,3}% \d{1,3}%$/.test(text(q.focus))) out.focus = text(q.focus);
    if (Number.isFinite(q.start)) out.start = Math.max(0, q.start);
    if (Number.isFinite(q.end)) out.end = Math.max(0, q.end);
    // win: فترات آمنة [من، إلى] بالثواني يُختار منها مقطع عشوائي (بعيداً عن اسم الكرتون في الأغنية)
    if (Array.isArray(q.win)) {
      const win = q.win.filter((w) => Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[1] > w[0] && w[0] >= 0).map((w) => [w[0], w[1]]);
      if (win.length) out.win = win;
    }
    if (q.mute === true) out.mute = true; // فيديو بدون صوت (خمّن من المشهد)
    if (text(q.hint)) out.hint = text(q.hint);
    if (/^[\w-]{11}$/.test(text(q.yt))) out.yt = text(q.yt); // معرّف فيديو YouTube (يُشغَّل مضمَّناً)
    if (out.type === "image" && !out.img) out.type = "text";
    if (out.type === "audio" && !out.audio && !out.yt) out.type = "text";
    if (out.type === "video" && !out.video && !out.yt) out.type = "text";
    if (!out.a || (!out.q && out.type === "text")) return null;
    return out;
  }
  const qKey = (q) => key(q.q) + "|" + (q.img || q.audio || q.video || q.yt || "");

  // هل تكفي أسئلة الفئة لعمود كامل؟ (سؤالان مختلفان لكل مستوى)
  function canFill(cat) {
    try {
      pickColumn(cat, false, new Set(), () => 0);
      return true;
    } catch {
      return false;
    }
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // عمود الفئة: سؤالان مختلفان من كل مستوى بالترتيب سهل، سهل، متوسط، متوسط، صعب، صعب
  function pickColumn(cat, random, used, rng, history = []) {
    if (!cat || !Array.isArray(cat.questions)) throw new Error("Invalid category");
    const taken = new Set();
    const ans = new Set(); // لا تتكرر نفس الإجابة مرتين في العمود
    return TIERS.flatMap((points, tier) => {
      let pool = cat.questions.filter((q) => tierOf(q) === tier);
      if (random) pool = shuffle(pool, rng);
      const rank = new Map(history.map((id, i) => [id, i]));
      pool.sort((a, b) => (rank.get(qKey(a)) ?? -1) - (rank.get(qKey(b)) ?? -1));
      const picked = [];
      for (const raw of pool) {
        const q = cleanQuestion(raw);
        if (!q) continue;
        const k = qKey(q);
        // أسئلة التعرف على الصوت/الصورة لا تكرر نفس الهوية؛ أسئلة الفيديو قد تشترك في نتيجة مختلفة السياق.
        const a = q.type === "image" || q.type === "audio" ? key(q.a) : "";
        if (used.has(k) || taken.has(k) || (a && ans.has(a))) continue;
        taken.add(k);
        ans.add(a);
        picked.push({ tier, q });
        if (picked.length === PER_TIER) return picked;
      }
      throw new Error(`Not enough ${points} questions in ${cat.name}`);
    });
  }

  function buildBoard(categories, opts = {}, rng = Math.random) {
    const values = VALUES[opts.values] || VALUES[200];
    const used = new Set();
    return categories.map((cat, ci) => {
      const col = pickColumn(cat, opts.random !== false, used, rng, Array.isArray(opts.history) ? opts.history : []);
      col.forEach((c) => used.add(qKey(c.q)));
      return {
        id: text(cat.id) || "c" + ci,
        name: text(cat.name),
        icon: text(cat.icon) || "📁",
        img: media(cat.img),
        cells: col.map((c) => ({ tier: c.tier, points: values[c.tier], q: c.q, status: "open", winner: null, awarded: 0 })),
      };
    });
  }

  // clip = طول مقطع الأغنية بالثواني؛ 0 = تلقائي حسب الصعوبة (CLIP_AUTO)، -1 = كامل
  const CLIP_AUTO = [12, 8, 5];
  const DEFAULT_RULES = { timer: 30, stealTimer: 15, steal: "full", penalty: "none", clip: 0 };

  function clockRemaining(endAt, now, total) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    const limit = Math.ceil(total);
    if (!Number.isFinite(endAt) || !Number.isFinite(now)) return limit;
    return Math.max(0, Math.min(limit, Math.ceil((endAt - now) / 1000)));
  }

  function restoredClock(snapshot, total, stage, question) {
    if (!Number.isFinite(total) || total <= 0) return null;
    const limit = Math.ceil(total);
    if (!snapshot || snapshot.stage !== stage || snapshot.question !== question || !Number.isFinite(snapshot.left))
      return { left: limit, paused: true };
    return { left: Math.max(0, Math.min(limit, Math.ceil(snapshot.left))), paused: true };
  }

  // مقطع عشوائي داخل فترة آمنة: يفضّل الفترات التي تتسع للطول كاملاً،
  // وإلا يقصّر المقطع على طول الفترة حتى لا يخرج منها (فلا يُسمع الاسم أبداً)
  function pickClip(q, len, rng = Math.random) {
    const wins = (q.win && q.win.length ? q.win : [[q.start || 0, (q.start || 0) + len]]).filter((w) => w[1] - w[0] > 0);
    const fit = wins.filter((w) => w[1] - w[0] >= len);
    const pool = fit.length ? fit : [wins.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))];
    const w = pool[Math.floor(rng() * pool.length)];
    const clipLen = Math.min(len, w[1] - w[0]);
    const room = Math.max(0, w[1] - w[0] - clipLen);
    return { start: Math.round((w[0] + rng() * room) * 10) / 10, len: clipLen };
  }
  const pickStart = (q, len, rng) => pickClip(q, len, rng).start;

  function newMatch({ mode, sides, board, rules, first = 0 }) {
    if (!Array.isArray(sides) || sides.length !== 2) throw new Error("Need two sides");
    if (!Array.isArray(board) || !board.length) throw new Error("Empty board");
    const r = { ...DEFAULT_RULES, ...(rules || {}) };
    return {
      version: 2, // 2 = لوحة 200/400/600 بخانتين لكل قيمة
      mode: mode === "solo" ? "solo" : "teams",
      sides: sides.map((s, i) => ({
        name: text(s.name) || (i ? "B" : "A"),
        color: /^#[0-9a-f]{6}$/i.test(s.color || "") ? s.color : i ? "#e8949d" : "#9fe0ec",
        players: (Array.isArray(s.players) ? s.players : []).map(text).filter(Boolean).slice(0, 8),
        playerIdx: 0,
        score: 0, correct: 0, wrong: 0, steals: 0,
      })),
      board: clone(board),
      rules: r,
      turn: first === 1 ? 1 : 0,
      phase: "board", // board | question | done
      current: null,
      log: [],
    };
  }

  const other = (t) => (t === 0 ? 1 : 0);
  const cellAt = (m, ci, ri) => m.board[ci] && m.board[ci].cells[ri];
  const remaining = (m) => m.board.reduce((n, c) => n + c.cells.filter((x) => x.status === "open").length, 0);
  const total = (m) => m.board.reduce((n, c) => n + c.cells.length, 0);

  function open(m0, ci, ri) {
    if (m0.phase !== "board" || m0.current) throw new Error("Not on board");
    const cell = cellAt(m0, ci, ri);
    if (!cell || cell.status !== "open") throw new Error("Cell not available");
    const m = clone(m0);
    m.current = { ci, ri, chooser: m.turn, team: m.turn, stage: "answer", revealed: false, attempts: [] };
    m.phase = "question";
    return m;
  }

  function reveal(m0) {
    if (m0.phase !== "question" || !m0.current) throw new Error("No question");
    const m = clone(m0);
    m.current.revealed = true;
    return m;
  }

  function penaltyFor(m, points) {
    return m.rules.penalty === "full" ? points : m.rules.penalty === "half" ? Math.round(points / 2) : 0;
  }
  function stealValue(m, points) {
    return m.rules.steal === "half" ? Math.round(points / 2) : points;
  }

  function resolve(m, team, pts, how) {
    const cur = m.current;
    const cell = cellAt(m, cur.ci, cur.ri);
    cell.status = "used";
    cell.winner = team;
    cell.awarded = pts;
    if (team !== null) {
      m.sides[team].score += pts;
      m.sides[team].correct += 1;
      if (how === "steal") m.sides[team].steals += 1;
    }
    cur.stage = "resolved";
    cur.revealed = true;
    cur.result = { team, pts, how };
    m.log.push({ ci: cur.ci, ri: cur.ri, team, pts, how, chooser: cur.chooser });
  }

  // correct = true/false للفريق الذي يجاوب الآن
  function judge(m0, correct) {
    const cur = m0.current;
    if (m0.phase !== "question" || !cur || !["answer", "steal"].includes(cur.stage)) throw new Error("Nothing to judge");
    const m = clone(m0);
    const c = m.current;
    const points = cellAt(m, c.ci, c.ri).points;
    c.attempts.push({ team: c.team, correct: !!correct });
    if (c.stage === "answer") {
      if (correct) {
        resolve(m, c.team, points, "answer");
        return m;
      }
      const pen = penaltyFor(m, points);
      m.sides[c.team].score -= pen;
      m.sides[c.team].wrong += 1;
      c.penalty = pen;
      if (m.rules.steal !== "off" && !c.revealed) {
        c.stage = "steal";
        c.team = other(c.chooser);
        return m;
      }
      resolve(m, null, 0, "none");
      return m;
    }
    // مرحلة السرقة
    if (correct) resolve(m, c.team, stealValue(m, points), "steal");
    else {
      m.sides[c.team].wrong += 1;
      resolve(m, null, 0, "none");
    }
    return m;
  }

  // «ولا أحد» / تخطّي: تُغلق الخانة بلا نقاط وبلا خصم
  function skip(m0) {
    const cur = m0.current;
    if (m0.phase !== "question" || !cur || cur.stage === "resolved") throw new Error("Nothing to skip");
    const m = clone(m0);
    resolve(m, null, 0, "none");
    return m;
  }

  function close(m0) {
    const cur = m0.current;
    if (m0.phase !== "question" || !cur || cur.stage !== "resolved") throw new Error("Resolve first");
    const m = clone(m0);
    const chooser = m.current.chooser;
    const side = m.sides[chooser];
    if (side.players.length) side.playerIdx = (side.playerIdx + 1) % side.players.length;
    m.turn = other(chooser);
    m.current = null;
    m.phase = remaining(m) ? "board" : "done";
    return m;
  }

  function adjust(m0, side, delta) {
    if (![0, 1].includes(side) || !Number.isFinite(delta)) throw new Error("Invalid adjust");
    const m = clone(m0);
    m.sides[side].score += Math.round(delta);
    return m;
  }

  function setTurn(m0, side) {
    if (m0.phase !== "board" || ![0, 1].includes(side)) throw new Error("Invalid turn");
    const m = clone(m0);
    m.turn = side;
    return m;
  }

  function finish(m0) {
    if (m0.phase === "question") throw new Error("Close the question first");
    const m = clone(m0);
    m.phase = "done";
    return m;
  }

  function winner(m) {
    const [a, b] = m.sides;
    return a.score === b.score ? -1 : a.score > b.score ? 0 : 1;
  }

  function currentPlayer(m, side) {
    const s = m.sides[side];
    return s && s.players.length ? s.players[s.playerIdx % s.players.length] : "";
  }

  function validate(m) {
    if (!m || m.version !== 2 || !Array.isArray(m.sides) || m.sides.length !== 2 || !Array.isArray(m.board) || !m.board.length) return false;
    if (!["board", "question", "done"].includes(m.phase) || ![0, 1].includes(m.turn)) return false;
    if (!m.rules || !["off", "full", "half"].includes(m.rules.steal) ||
        !["none", "half", "full"].includes(m.rules.penalty) ||
        !Number.isFinite(m.rules.timer) || m.rules.timer < 0 || m.rules.timer > 300 ||
        !Number.isFinite(m.rules.stealTimer) || m.rules.stealTimer < 0 || m.rules.stealTimer > 300) return false;
    if (m.sides.some((s) => !s || !text(s.name) || !Number.isFinite(s.score) || !Array.isArray(s.players) ||
        s.players.some((p) => !text(p)) || !Number.isInteger(s.playerIdx) || s.playerIdx < 0)) return false;
    if (m.board.some((c) => !c || !Array.isArray(c.cells) || c.cells.length !== 6 ||
        c.cells.some((x, i) => !x || x.tier !== Math.floor(i / 2) || !cleanQuestion(x.q) ||
          !Number.isFinite(x.points) || x.points <= 0 || !["open", "used"].includes(x.status)))) return false;
    if (m.phase === "question") {
      const cur = m.current;
      if (!cur || !Number.isInteger(cur.ci) || !Number.isInteger(cur.ri) || !cellAt(m, cur.ci, cur.ri) ||
          !["answer", "steal", "resolved"].includes(cur.stage) || ![0, 1].includes(cur.chooser) ||
          ![0, 1].includes(cur.team) || typeof cur.revealed !== "boolean" || !Array.isArray(cur.attempts)) return false;
      if ((cur.stage === "resolved") !== (cellAt(m, cur.ci, cur.ri).status === "used")) return false;
      if (cur.stage === "answer" && cur.team !== cur.chooser) return false;
      if (cur.stage === "steal" && cur.team === cur.chooser) return false;
    } else if (m.current !== null) return false;
    return true;
  }

  return {
    TIERS, PER_TIER, VALUES, CLIP_AUTO, TYPES, DEFAULT_RULES, tierOf, cleanQuestion, canFill, buildBoard, pickClip, pickStart, newMatch,
    open, reveal, judge, skip, close, adjust, setTurn, finish, winner, currentPlayer,
    clockRemaining, restoredClock,
    remaining, total, validate, stealValue, penaltyFor, other,
  };
})();
if (typeof globalThis !== "undefined") globalThis.MatchRules = MatchRules;
if (typeof module !== "undefined") module.exports = MatchRules;
