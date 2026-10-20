/* ===========================================================
   بايو — منطق اللعبة
   حسابات + ملف شخصي + ثيمات + لغتان + إحصائيات + اللعبة
   =========================================================== */

const Game = (() => {
  const LS_SETTINGS = "sj_settings";
  const LS_THEME = "sj_theme";
  const LS_LANG = "sj_lang";
  const LS_MODE = "sj_mode";
  const LS_QUESTION_HISTORY = "bio_question_history_v1";

  function questionHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_QUESTION_HISTORY));
      return Array.isArray(value) ? value.filter((id) => typeof id === "string" && id.length <= 1000).slice(-3000) : [];
    } catch { return []; }
  }
  function rememberQuestions(questions) {
    try {
      const fresh = questions.map(BioRules.historyKey);
      const previous = questionHistory().filter((id) => !fresh.includes(id));
      localStorage.setItem(LS_QUESTION_HISTORY, JSON.stringify([...previous, ...fresh].slice(-3000)));
    } catch {}
  }

  const THEMES = ["royal", "emerald", "crimson", "ocean", "violet"];

  // وسائل المساعدة (نمط سين جيم): بطاقة وصف في الشريط الجانبي ثم تفعيل
  const LIFELINES = [
    {
      id: "swap",
      label: "تبديل السؤال",
      labelEn: "Swap question",
      icon: "🔄",
      desc: "مو عاجبكم السؤال؟ بدّلوه بسؤال ثاني من نفس الفئة وبنفس النقاط",
      descEn: "Replace this question with another of the same value.",
      start: "بدّل السؤال",
      startEn: "Swap question",
    },
    {
      id: "phone",
      label: "اتصال بصديق",
      labelEn: "Phone a friend",
      icon: "📞",
      desc: "صديقك اللي يعرف كل شي هذا وقته. دق عليه",
      descEn: "Call a friend for up to one minute. The question timer pauses.",
      start: "ابدأ",
      startEn: "Start call",
    },
    {
      id: "two",
      label: "جاوب جوابين",
      labelEn: "Two answers",
      icon: "✌️",
      desc: "مو متأكدين من الجواب؟ عطوا جوابين بدل جواب واحد — إذا أحدهم صح تنحسب لكم",
      descEn: "Give two possible answers to this question.",
      start: "فعّل",
      startEn: "Use lifeline",
    },
  ];
  const PHONE_SECONDS = 60;

  const TEAM_COLORS = ["#9fe0ec", "#e8949d", "#c3e813", "#e4a6f7", "#f9e09b", "#ffb36b"];

  // الإنجازات: شرط لكل إنجاز يعتمد على الإحصائيات
  const ACHIEVEMENTS = [
    { id: "first", icon: "🎮", name: "أول لعبة", test: (s) => s.games >= 1 },
    { id: "five", icon: "🔥", name: "محموم (5 ألعاب)", test: (s) => s.games >= 5 },
    { id: "ten", icon: "🎖️", name: "خبير (10 ألعاب)", test: (s) => s.games >= 10 },
    { id: "fifty", icon: "👑", name: "أسطورة (50 لعبة)", test: (s) => s.games >= 50 },
    { id: "q100", icon: "🧠", name: "مئة سؤال", test: (s) => (s.q || 0) >= 100 },
    { id: "score3k", icon: "💎", name: "نقّاط (3000+)", test: (s) => (s.best || 0) >= 3000 },
    { id: "score5k", icon: "🏆", name: "بطل (5000+)", test: (s) => (s.best || 0) >= 5000 },
    { id: "score8k", icon: "🌟", name: "أسطوري (8000+)", test: (s) => (s.best || 0) >= 8000 },
    { id: "marathon", icon: "🏃", name: "ماراثوني (25 لعبة)", test: (s) => s.games >= 25 },
    { id: "q500", icon: "📚", name: "خمسمئة سؤال", test: (s) => (s.q || 0) >= 500 },
    { id: "creator", icon: "✏️", name: "مبدع (أنشأ فئة)", test: (s, ctx) => ctx.customCount >= 1 },
    { id: "polyglot", icon: "🎨", name: "ذوّاق (جرّب 3 ثيمات)", test: (s) => (s.themesUsed || 0) >= 3 },
    { id: "golden1", icon: "👑", name: "مجازف (لعب الجولة الذهبية)", test: (s) => (s.golden || 0) >= 1 },
  ];

  const ACH_EN = {
    first: "First game", five: "On fire (5 games)", ten: "Expert (10 games)", fifty: "Legend (50 games)",
    q100: "100 questions", score3k: "Scorer (3000+)", score5k: "Champion (5000+)", score8k: "Legendary (8000+)",
    marathon: "Marathoner (25 games)", q500: "500 questions", creator: "Creator (made a category)",
    polyglot: "Taster (tried 3 themes)", golden1: "Risk taker (played the golden round)",
  };
  const achName = (a) => loc(a.name, ACH_EN[a.id] || a.name);

  const state = {
    teams: [
      { name: "الفريق الأول", score: 0, lifelines: [] },
      { name: "الفريق الثاني", score: 0, lifelines: [] },
    ],
    turn: 1,
    selectedCats: [],
    cats: [],
    current: null,
    timer: { id: null, elapsed: 0, paused: false }, // مؤقت تصاعدي (ستوب ووتش) مثل سين جيم
    ll: null, // وسيلة المساعدة المفتوحة حالياً { team, li, countId, left }
    answerShown: false,
    goldenPlayed: false,
    golden: null,
    phase: "setup", // setup, board, question, golden, tie, result
    usedQuestions: [],
    settings: { seconds: 60, random: true, sound: true, golden: false },
    themeIndex: 0,
    teamColors: ["#9fe0ec", "#e8949d"],
  };

  let customCats = [];
  let editing = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const loc = (ar, en) => I18N.lang === "en" ? en : ar;
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const screens = {
    landing: $("#landingScreen"),
    setup: $("#setupScreen"),
    board: $("#boardScreen"),
    result: $("#resultScreen"),
  };

  function show(scr) {
    showScreen(screens[scr].id, scr === "board");
  }
  // يُستخدم أيضاً من match.js: يخفي كل الشاشات (الكلاسيكية والمباراة) ويُظهر واحدة
  function showScreen(id, inGame = false) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    document.body.classList.toggle("in-game", inGame);
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  function allCats() {
    return [...CATEGORIES, ...customCats];
  }

  // ====================================================
  //  تخزين خاص بالمستخدم
  // ====================================================
  function uRead(base, def) {
    try {
      return JSON.parse(localStorage.getItem(Auth.key(base))) ?? def;
    } catch {
      return def;
    }
  }
  function uWrite(base, v) {
    try { localStorage.setItem(Auth.key(base), JSON.stringify(v)); } catch { toast("تعذّر حفظ البيانات على هذا الجهاز"); return; }
    Auth.cloudSet(base, v);
  }

  function loadCustom() {
    const raw = uRead("custom", []);
    customCats = Array.isArray(raw) ? raw.map(BioRules.cleanCategory).filter(Boolean) : [];
  }
  function saveCustom() {
    uWrite("custom", customCats);
  }

  function getStats() {
    const raw = uRead("stats", {});
    const v = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const number = (x) => Number.isFinite(x) && x >= 0 ? x : 0;
    return { ...v, games: number(v.games), best: number(v.best), q: number(v.q), golden: number(v.golden) };
  }
  function saveStats(s) {
    uWrite("stats", s);
  }

  function getHistory() {
    const raw = uRead("history", []);
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x === "object" && Number.isFinite(x.date)).slice(0, 20) : [];
  }
  function addHistory(rec) {
    const h = getHistory();
    h.unshift(rec);
    uWrite("history", h.slice(0, 20));
  }

  function getUnlocked() {
    const raw = uRead("ach", []);
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  }
  // يفحص الإنجازات الجديدة، يحفظها، ويعيد قائمة المفتوحة حديثاً
  function checkAchievements() {
    const stats = getStats();
    const ctx = { customCount: customCats.length };
    const have = new Set(getUnlocked());
    const fresh = [];
    ACHIEVEMENTS.forEach((a) => {
      if (!have.has(a.id) && a.test(stats, ctx)) {
        have.add(a.id);
        fresh.push(a);
      }
    });
    uWrite("ach", [...have]);
    return fresh;
  }

  function saveGame() {
    if (state.phase === "setup" || state.phase === "result") return;
    uWrite("save", {
      version: 2,
      teams: state.teams,
      turn: state.turn,
      cats: state.cats,
      settings: state.settings,
      teamColors: state.teamColors,
      goldenPlayed: state.goldenPlayed,
      golden: state.golden,
      phase: state.phase,
      current: state.current ? { ci: state.current.ci, qi: state.current.qi, points: state.current.points, tie: !!state.current.tie, q: state.current.q, a: state.current.a, img: state.current.img, aImg: state.current.aImg } : null,
      answerShown: state.answerShown,
      questionView: state.current ? $("#qFrame").dataset.view : null,
      timer: { elapsed: state.timer.elapsed, paused: state.timer.paused },
      usedQuestions: state.usedQuestions,
    });
  }
  function clearSave() {
    localStorage.removeItem(Auth.key("save"));
  }
  function hasSave() {
    return BioRules.validateSnapshot(uRead("save", null));
  }

  // إعدادات عامة (غير مرتبطة بالمستخدم)
  function loadSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(LS_SETTINGS));
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      if (typeof value.random === "boolean") state.settings.random = value.random;
      if (typeof value.sound === "boolean") state.settings.sound = value.sound;
      if (typeof value.golden === "boolean") state.settings.golden = value.golden;
      if ([4, 5, 6].includes(value.catCount)) state.settings.catCount = value.catCount;
    } catch {}
  }
  function saveSettings() {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings)); } catch { toast(loc("تعذّر حفظ الإعدادات", "Settings could not be saved.")); }
  }

  // ====================================================
  //  الثيمات
  // ====================================================
  function applyTheme() {
    document.body.dataset.theme = THEMES[state.themeIndex];
    localStorage.setItem(LS_THEME, state.themeIndex);
  }
  function recordTheme() {
    const st = getStats();
    const set = new Set(st.themeList || []);
    set.add(THEMES[state.themeIndex]);
    st.themeList = [...set];
    st.themesUsed = set.size;
    saveStats(st);
    const fresh = checkAchievements();
    if (fresh.length) toast(loc("🏅 إنجاز جديد: ", "🏅 New achievement: ") + achName(fresh[0]));
  }
  // الوضع الفاتح / الغامق (زر التبديل في هيدر اللعبة — مثل سين جيم)
  function applyMode(m) {
    document.body.dataset.mode = m === "light" ? "light" : "dark";
    localStorage.setItem(LS_MODE, document.body.dataset.mode);
  }
  function toggleMode() {
    applyMode(document.body.dataset.mode === "light" ? "dark" : "light");
    Sound.click();
  }

  function cycleTheme() {
    state.themeIndex = (state.themeIndex + 1) % THEMES.length;
    applyTheme();
    buildThemePicker();
    recordTheme();
    Sound.select();
  }
  function setTheme(i) {
    state.themeIndex = i % THEMES.length;
    applyTheme();
    buildThemePicker();
    recordTheme();
    Sound.select();
  }
  // الأسماء من I18N (theme_*) — المفاتيح الداخلية ثابتة حفاظاً على الإعدادات المحفوظة
  const THEME_NAMES = new Proxy({}, { get: (_, th) => I18N.t("theme_" + String(th)) });
  const THEME_SWATCH = {
    royal: "#c3e813",
    emerald: "#f9e09b",
    crimson: "#e8949d",
    ocean: "#9fe0ec",
    violet: "#e4a6f7",
  };
  function buildThemePicker() {
    const box = $("#themePicker");
    if (!box) return;
    box.innerHTML = "";
    THEMES.forEach((th, i) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "theme-swatch" + (i === state.themeIndex ? " on" : "");
      el.style.setProperty("--sw", THEME_SWATCH[th]);
      el.title = THEME_NAMES[th];
      el.innerHTML = `<span class="ts-dot"></span><span class="ts-nm">${THEME_NAMES[th]}</span>`;
      el.addEventListener("click", () => setTheme(i));
      box.appendChild(el);
    });
  }

  function bindMusic() {
    const seg = $("#musicSeg");
    if (!seg) return;
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.v === "1" && !state.settings.sound) return toast(loc("فعّل الصوت أولاً", "Turn on sound first."));
      $$("#musicSeg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      Sound.unlock();
      if (b.dataset.v === "1") {
        Sound.musicStart();
      } else {
        Sound.musicStop();
      }
    });
  }

  // ====================================================
  //  اللغة
  // ====================================================
  function applyLang(l) {
    I18N.apply(l);
    localStorage.setItem(LS_LANG, I18N.lang);
    $("#langBtn").textContent = I18N.lang === "ar" ? "EN" : "ع";
    document.body.dataset.theme = THEMES[state.themeIndex]; // إعادة ضبط بعد تغيير الاتجاه
  }
  function toggleLang() {
    applyLang(I18N.lang === "ar" ? "en" : "ar");
    Sound.click();
  }

  // ====================================================
  //  الحسابات / الملف الشخصي
  // ====================================================
  function refreshUserUI() {
    const u = Auth.current();
    $("#pcAvatar").textContent = u.avatar;
    $("#pcName").textContent = u.guest ? "دخول" : u.name;
  }

  function openAuth() {
    $("#authErr").textContent = "";
    $("#authModal").classList.add("active");
    Sound.open();
  }
  function closeAuth() {
    $("#authModal").classList.remove("active");
  }

  async function googleLogin() {
    $("#authErr").textContent = "";
    const r = await Auth.googleLogin();
    if (!r.ok) {
      // رسالة واضحة حسب رمز Firebase بدل رسالة عامة
      const code = String(r.error || "");
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      const msg =
        code === "auth/configuration-not-found" || code === "auth/operation-not-allowed"
          ? loc("تسجيل الدخول بحساب Google غير مفعّل حالياً. العب كضيف وستُحفظ نتائجك على هذا الجهاز.", "Google sign-in isn't enabled yet. Play as a guest; your progress stays on this device.")
          : code === "auth/unauthorized-domain"
          ? loc("هذا الرابط غير مسموح له بتسجيل الدخول. افتح اللعبة من رابطها الرسمي.", "Sign-in isn't allowed from this address. Open the game from its official link.")
          : code === "auth/network-request-failed"
          ? loc("لا يوجد اتصال بالإنترنت. تحقّق من الاتصال وحاول مرة أخرى.", "No internet connection. Check it and try again.")
          : loc("تعذّر تسجيل الدخول. حاول مرة أخرى.", "Couldn't sign in. Please try again.");
      $("#authErr").textContent = msg;
      Sound.wrong();
      return;
    }
    Sound.correct();
    closeAuth();
    toast("👋 تم تسجيل الدخول");
  }

  function guest() {
    Auth.continueAsGuest();
    closeAuth();
    goSetup();
  }

  function openProfile() {
    const u = Auth.current();
    if (u.guest) {
      openAuth();
      return;
    }
    const st = getStats();
    $("#profAvatar").textContent = u.avatar;
    $("#profName").textContent = u.name;
    $("#profEmail").textContent = u.email;
    $("#psGames").textContent = st.games;
    $("#psWins").textContent = st.best;
    $("#psCats").textContent = customCats.length;
    renderBadges();
    renderHistory();
    const act = $("#profActions");
    act.innerHTML = "";
    const out = document.createElement("button");
    out.className = "btn btn-ghost";
    out.textContent = "🚪 تسجيل الخروج";
    out.onclick = () => {
      Auth.logout();
      closeProfile();
      toast("تم تسجيل الخروج");
    };
    act.appendChild(out);
    $("#profileModal").classList.add("active");
    Sound.open();
  }
  function closeProfile() {
    $("#profileModal").classList.remove("active");
  }

  function renderBadges() {
    const box = $("#badges");
    box.innerHTML = "";
    const have = new Set(getUnlocked());
    ACHIEVEMENTS.forEach((a) => {
      const el = document.createElement("span");
      const got = have.has(a.id);
      el.className = "badge" + (got ? " got" : "");
      el.title = achName(a);
      el.innerHTML = `<span class="b-ic">${a.icon}</span><span class="b-nm">${escapeHTML(achName(a))}</span>`;
      box.appendChild(el);
    });
  }

  function renderHistory() {
    const box = $("#historyList");
    box.innerHTML = "";
    const h = getHistory();
    if (!h.length) {
      box.innerHTML = '<div class="hist-empty">لا توجد مباريات بعد — العب أول مباراة!</div>';
      return;
    }
    h.forEach((r) => {
      const el = document.createElement("div");
      el.className = "hist-item";
      const w1 = r.winner === 1 ? "win" : "";
      const w2 = r.winner === 2 ? "win" : "";
      el.innerHTML = `
        <span class="hi-team ${w1}">${escapeHTML(r.t1)}</span>
        <span class="hi-score">${Number.isFinite(r.s1) ? r.s1 : 0} - ${Number.isFinite(r.s2) ? r.s2 : 0}</span>
        <span class="hi-team ${w2}">${escapeHTML(r.t2)}</span>`;
      box.appendChild(el);
    });
  }

  // عند تغيّر المستخدم: أعد تحميل بياناته
  function onUserChange() {
    refreshUserUI();
    loadCustom();
    buildCatPicker();
    checkResume();
    updateLandingStats();
  }

  // ====================================================
  //  صفحة الهبوط
  // ====================================================
  function goLanding() {
    show("landing");
    updateLandingStats();
    Sound.click();
  }
  function playClick() {
    Sound.select();
    goSetup();
  }
  function goSetup() {
    state.phase = "setup";
    show("setup");
    checkResume();
  }

  function updateLandingStats() {
    const cats = allCats().length;
    const qs = allCats().reduce((s, c) => s + c.questions.length, 0);
    countUp($("#statCats"), cats);
    countUp($("#statQ"), qs);
    countUp($("#statGames"), getStats().games);
  }

  function countUp(el, to) {
    const dur = 900;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * ease);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function buildMarquee() {
    const track = $("#cmTrack");
    track.innerHTML = "";
    const items = [...allCats(), ...allCats()]; // تكرار لحلقة سلسة
    items.forEach((c) => {
      const chip = document.createElement("span");
      chip.className = "cm-chip";
      chip.innerHTML = `<span>${c.icon || "📁"}</span> ${c.name}`;
      track.appendChild(chip);
    });
  }

  // ====================================================
  //  منتقي الفئات + فن البطاقات
  // ====================================================
  function colorFor(cat, i) {
    if (cat.color) return cat.color;
    const palette = [
      ["#5b8cff", "#1e3a8a"],
      ["#34d399", "#065f46"],
      ["#f59e0b", "#92400e"],
      ["#ec4899", "#831843"],
      ["#a78bfa", "#4c1d95"],
      ["#22d3ee", "#155e75"],
      ["#f87171", "#7f1d1d"],
      ["#facc15", "#854d0e"],
    ];
    return palette[i % palette.length];
  }

  // تُستدعى من catalog.js عندما تتغيّر فئات لوحة الأدمن (تتغير الفهارس، فنلغي الاختيار)
  function refreshCatalog() {
    state.selectedCats = [];
    if (window.Match) Match.refreshCats();
    buildCatPicker();
    updateLandingStats();
    buildMarquee();
  }

  function buildCatPicker() {
    const grid = $("#catsGrid");
    grid.innerHTML = "";
    allCats().forEach((cat, i) => {
      if (!BioRules.validCategory(cat)) return; // فئات لوحة 100–500 (حزمة الألعاب) خاصة بالمباراة الجديدة
      const tile = document.createElement("div");
      tile.className = "cat-tile";
      tile.dataset.index = i;
      const isCustom = i >= CATEGORIES.length;
      const [c1, c2] = colorFor(cat, i);
      tile.style.setProperty("--c1", c1);
      tile.style.setProperty("--c2", c2);
      tile.innerHTML = `
        ${isCustom ? '<span class="custom-tag">خاص</span>' : ""}
        <span class="check">✓</span>
        <div class="cat-thumb">${
          cat.img ? `<img src="${escapeHTML(cat.img)}" alt="" loading="lazy" />` : `<span class="ic">${escapeHTML(cat.icon || "📁")}</span>`
        }</div>
        <span class="nm">${escapeHTML(cat.name)}</span>
        <span class="cat-count">${cat.questions.length} سؤال</span>`;
      tile.tabIndex = 0;
      tile.setAttribute("role", "button");
      tile.setAttribute("aria-label", cat.name);
      const activate = () => {
        Sound.unlock();
        toggleCat(i, tile);
      };
      tile.addEventListener("click", activate);
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
      grid.appendChild(tile);
    });
    state.selectedCats = state.selectedCats.filter((i) => i < allCats().length);
    refreshTiles();
    updateCounter();
  }

  function toggleCat(index, tile) {
    const pos = state.selectedCats.indexOf(index);
    if (pos > -1) {
      state.selectedCats.splice(pos, 1);
      tile.classList.remove("selected");
    } else {
      if (state.selectedCats.length >= catTarget())
        return toast(`اخترت ${catTarget()} فئات بالفعل`);
      state.selectedCats.push(index);
      tile.classList.add("selected");
      Sound.select();
    }
    updateCounter();
  }
  function catTarget() {
    return state.settings.catCount || 6;
  }
  function refreshTiles() {
    $$(".cat-tile").forEach((t) => {
      t.classList.toggle("selected", state.selectedCats.includes(+t.dataset.index));
    });
  }
  function updateCounter() {
    $("#catCounter").textContent = `${state.selectedCats.length} / ${catTarget()}`;
    const b = document.querySelector("#catsHint b");
    if (b) b.textContent = catTarget();
  }

  // منتقي ألوان الفرق
  function buildColorPickers() {
    [1, 2].forEach((t) => {
      const box = $(`#colorPick${t}`);
      box.innerHTML = "";
      TEAM_COLORS.forEach((c) => {
        const sw = document.createElement("span");
        sw.className = "swatch" + (state.teamColors[t - 1] === c ? " on" : "");
        sw.style.background = c;
        sw.addEventListener("click", () => {
          state.teamColors[t - 1] = c;
          document.documentElement.style.setProperty(`--team${t}`, c);
          box.querySelectorAll(".swatch").forEach((x) => x.classList.remove("on"));
          sw.classList.add("on");
          Sound.click();
        });
        box.appendChild(sw);
      });
    });
  }

  function bindSettings() {
    $("#randSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("#randSeg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      state.settings.random = b.dataset.v === "1";
      saveSettings();
      Sound.click();
    });
    const gSeg = $("#goldenSeg");
    if (gSeg)
      gSeg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        $$("#goldenSeg button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        state.settings.golden = b.dataset.v === "1";
        saveSettings();
        Sound.click();
      });
    const ccSeg = $("#catCountSeg");
    if (ccSeg)
      ccSeg.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        $$("#catCountSeg button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        state.settings.catCount = +b.dataset.v;
        saveSettings();
        // قصّ الاختيارات الزائدة
        if (state.selectedCats.length > catTarget()) {
          state.selectedCats = state.selectedCats.slice(0, catTarget());
          refreshTiles();
        }
        updateCounter();
        Sound.click();
      });
  }

  function applySettingsToUI() {
    $$("#randSeg button").forEach((b) =>
      b.classList.toggle("on", (b.dataset.v === "1") === state.settings.random)
    );
    $$("#catCountSeg button").forEach((b) =>
      b.classList.toggle("on", +b.dataset.v === catTarget())
    );
    $$("#goldenSeg button").forEach((b) =>
      b.classList.toggle("on", (b.dataset.v === "1") === !!state.settings.golden)
    );
    Sound.setEnabled(state.settings.sound);
    setSoundIcon();
  }

  // ====================================================
  //  بدء اللعبة
  // ====================================================
  function start() {
    Sound.unlock();
    if (state.phase !== "setup" && state.phase !== "result") return;
    if (state.selectedCats.length !== catTarget())
      return toast(`اختر ${catTarget()} فئات بالضبط`);
    const n1 = $("#team1").value.trim() || loc("الفريق الأول", "Team One");
    const n2 = $("#team2").value.trim() || loc("الفريق الثاني", "Team Two");
    state.teams[0] = { name: n1, score: 0, correct: 0, lifelines: cloneLifelines() };
    state.teams[1] = { name: n2, score: 0, correct: 0, lifelines: cloneLifelines() };
    state.turn = 1;
    state.goldenPlayed = false;
    state.golden = null;
    state.current = null;
    state.usedQuestions = [];

    const cats = allCats();
    try {
      state.cats = BioRules.pickBoard(state.selectedCats.map((i) => cats[i]), state.settings.random, Math.random, questionHistory());
    } catch (error) {
      return toast(loc("هذه الفئات لا تحتوي أسئلة فريدة كافية؛ اختر فئات أخرى", "These categories need more unique questions. Choose others."));
    }

    document.documentElement.style.setProperty("--team1", state.teamColors[0]);
    document.documentElement.style.setProperty("--team2", state.teamColors[1]);

    buildBoard();
    refreshScores();
    state.phase = "board";
    saveGame();
    rememberQuestions(state.cats.flatMap((c) => c.questions));
    show("board");
    Sound.open();
  }

  function cloneLifelines() {
    return LIFELINES.map((l) => ({ ...l, used: false }));
  }

  // ====================================================
  //  اللوحة
  // ====================================================
  function buildBoard() {
    const board = $("#board");
    board.style.gridTemplateColumns = `repeat(${Math.min(3, state.cats.length)}, 1fr)`;
    board.innerHTML = "";
    state.cats.forEach((cat, ci) => {
      const unit = document.createElement("div");
      unit.className = "cat-unit";

      const makeCell = (qi) => {
        const q = cat.questions[qi];
        const cell = document.createElement("div");
        cell.className = "cell" + (q.done ? " done" : "");
        cell.textContent = q.done ? "✓" : q.points;
        cell.dataset.ci = ci;
        cell.dataset.qi = qi;
        if (!q.done) {
          cell.tabIndex = 0;
          cell.setAttribute("role", "button");
          cell.setAttribute("aria-label", `${cat.name} ${q.points}`);
        }
        cell.addEventListener("click", () => openQuestion(ci, qi, cell));
        cell.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openQuestion(ci, qi, cell);
          }
        });
        return cell;
      };

      // عمودان حول صورة الفئة: يمين أول سؤال من كل قيمة، يسار ثانيها
      const makeCol = (idxs) => {
        const col = document.createElement("div");
        col.className = "unit-col";
        idxs.forEach((qi) => {
          if (cat.questions[qi]) col.appendChild(makeCell(qi));
        });
        return col;
      };

      const media = document.createElement("div");
      media.className = "cat-media";
      const [c1, c2] = colorFor(cat, ci);
      media.style.setProperty("--c1", c1);
      media.style.setProperty("--c2", c2);
      media.innerHTML =
        (cat.img
          ? `<img src="${escapeHTML(cat.img)}" alt="" loading="lazy" />`
          : `<span class="big-ic">${escapeHTML(cat.icon || "📁")}</span>`) +
        `<span class="cat-name">${escapeHTML(cat.name)}</span>`;

      unit.appendChild(makeCol([0, 2, 4]));
      unit.appendChild(media);
      unit.appendChild(makeCol([1, 3, 5]));
      board.appendChild(unit);
    });
    renderLifelines();
    updateProgress();
  }

  function renderLifelines() {
    // أزرار دائرية (أيقونة فقط) — على اللوحة وداخل شاشة السؤال (نمط سين جيم)
    [1, 2].forEach((t) => {
      [$(`#t${t}Lifelines`), $(`#qT${t}Lifelines`)].forEach((box) => {
        if (!box) return;
        box.innerHTML = "";
        state.teams[t - 1].lifelines.forEach((l, li) => {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "lifeline" + (l.used ? " used" : "");
          el.textContent = l.icon;
          const definition = LIFELINES.find((item) => item.id === l.id) || l;
          el.title = loc(definition.label, definition.labelEn || definition.label);
          el.setAttribute("aria-label", el.title);
          el.disabled = l.used;
          el.addEventListener("click", () => useLifeline(t, li));
          box.appendChild(el);
        });
      });
    });
  }

  // ===== وسائل المساعدة: بطاقة جانبية بوصف وزر «ابدأ» (مثل سين جيم) =====
  function useLifeline(team, li) {
    const l = state.teams[team - 1]?.lifelines?.[li];
    if (!l || l.used) return;
    if (!state.current || state.answerShown || state.phase !== "question") return toast("تستخدم أثناء عرض السؤال فقط");
    if (team !== state.turn) return toast("وسائل المساعدة للفريق صاحب الدور");
    if (state.current.tie) return toast("لا وسائل مساعدة في الشوط الفاصل");
    if (state.ll) return;
    const def = LIFELINES.find((d) => d.id === l.id) || l;
    state.ll = { team, li, countId: null, left: 0 };
    $("#llTitle").textContent = loc(def.label, def.labelEn || def.label);
    $("#llDesc").textContent = loc(def.desc || "", def.descEn || def.desc || "");
    $("#llIcon").textContent = l.icon;
    $("#llIcon").hidden = false;
    $("#llRing").hidden = true;
    const startBtn = $("#llStartBtn");
    startBtn.textContent = loc(def.start || "ابدأ", def.startEn || def.start || "Start");
    startBtn.hidden = false;
    $("#llCancelBtn").textContent = loc("رجوع", "Back");
    $("#qSideTeams").hidden = true;
    $("#llCard").hidden = false;
    Sound.open();
  }

  function consumeLifeline() {
    if (!state.ll) return;
    const { team, li } = state.ll;
    state.teams[team - 1].lifelines[li].used = true;
    Sound.lifeline();
    renderLifelines();
    saveGame();
  }

  function closeLifelineCard() {
    if (state.ll && state.ll.countId) clearInterval(state.ll.countId);
    state.ll = null;
    const card = $("#llCard");
    if (card) {
      card.hidden = true;
      $("#qSideTeams").hidden = false;
    }
  }

  function lifelineStart() {
    if (!state.ll || !state.current || state.answerShown || state.phase !== "question") return;
    const { team, li } = state.ll;
    const l = state.teams[team - 1].lifelines[li];
    if (l.id === "swap") {
      if (swapQuestion()) {
        consumeLifeline();
        closeLifelineCard();
      }
      return;
    }
    if (l.id === "two") {
      const note = $("#qNote");
      note.textContent = loc(`✌️ ${state.teams[team - 1].name} يحق له جوابين على هذا السؤال`, `✌️ ${state.teams[team - 1].name} may give two answers.`);
      note.classList.add("show");
      consumeLifeline();
      closeLifelineCard();
      toast(loc("✌️ جاوب جوابين مفعّلة", "✌️ Two answers activated."));
      return;
    }
    if (l.id === "phone") startPhoneCall();
  }

  function lifelineCancel() {
    if (!state.ll) return;
    if (state.ll.countId) {
      // إنهاء المكالمة مبكراً (انحسبت من لحظة البدء)
      endPhoneCall();
      return;
    }
    closeLifelineCard();
    Sound.click();
  }

  function startPhoneCall() {
    state.ll.left = PHONE_SECONDS;
    state.ll.endAt = Date.now() + PHONE_SECONDS * 1000;
    $("#llDesc").textContent = loc("عندك دقيقة وحدة تقدر تتصل فيها على شخص ممكن يكون عارف الإجابة", "You have one minute to call a friend.");
    $("#llIcon").hidden = true;
    $("#llRing").hidden = false;
    $("#llStartBtn").hidden = true;
    $("#llCancelBtn").textContent = loc("إنهاء المكالمة", "End call");
    // يتوقف مؤقت السؤال أثناء المكالمة
    state.timer.paused = true;
    setPauseIcon(true);
    paintPhoneRing();
    consumeLifeline();
    state.ll.countId = setInterval(() => {
      state.ll.left = Math.max(0, Math.ceil((state.ll.endAt - Date.now()) / 1000));
      paintPhoneRing();
      if (state.ll.left <= 0) endPhoneCall();
    }, 1000);
  }

  function paintPhoneRing() {
    const left = Math.max(0, state.ll.left);
    $("#llRingTime").textContent = fmtTime(left);
    const fg = $("#llRingFg");
    const C = 2 * Math.PI * 54;
    fg.style.strokeDasharray = C;
    fg.style.strokeDashoffset = C * (1 - left / PHONE_SECONDS);
  }

  function endPhoneCall() {
    closeLifelineCard();
    Sound.timeout();
    toast(loc("📞 انتهت المكالمة", "📞 Call ended."));
    // استئناف مؤقت السؤال إن كنا ما زلنا على شاشة السؤال
    if (state.current && !state.answerShown) {
      state.timer.paused = false;
      state.timer.lastTick = Date.now();
      setPauseIcon(false);
    }
  }

  function swapQuestion() {
    const cur = state.current;
    const cat = state.cats[cur.ci];
    const excluded = new Set([...state.usedQuestions, ...state.cats.flatMap((c) => c.questions.map((q) => BioRules.key(q.q)))]);
    const q = BioRules.replacement(cat, cur.points, excluded);
    if (!q) {
      toast(loc("ما فيه سؤال بديل لهذه الفئة", "No replacement question is available."));
      return false;
    }
    state.usedQuestions.push(BioRules.key(cat.questions[cur.qi].q));
    cat.questions[cur.qi] = q;
    $("#qText").textContent = q.q;
    $("#answerText").textContent = q.a;
    setImg("qImg", q.img);
    setImg("answerImg", q.aImg);
    state.timer.elapsed = 0;
    paintTimer();
    saveGame();
    toast(loc("🔄 تم تبديل السؤال", "🔄 Question swapped."));
    return true;
  }

  function setTurn(t) {
    state.turn = t;
    $("#teamCard1").classList.toggle("active", t === 1);
    $("#teamCard2").classList.toggle("active", t === 2);
    const label = loc(`دور فريق : ${state.teams[t - 1].name}`, `${state.teams[t - 1].name}'s turn`);
    $("#bTurnPill").textContent = label;
    if (state.current && !state.current.tie) $("#qTurnPill").textContent = label;
    [1, 2].forEach((x) => $(`#qSideT${x}`).classList.toggle("turn", t === x));
  }
  function toggleTurn() {
    if (state.phase !== "board") return;
    setTurn(state.turn === 1 ? 2 : 1);
    Sound.click();
    saveGame();
  }

  function animateScore(el, from, to) {
    if (el._scoreFrame) cancelAnimationFrame(el._scoreFrame);
    const dur = 500;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * ease);
      if (p < 1) el._scoreFrame = requestAnimationFrame(step);
      else el._scoreFrame = null;
    }
    el._scoreFrame = requestAnimationFrame(step);
  }

  function refreshScores(animate) {
    $("#t1Name").textContent = state.teams[0].name;
    $("#t2Name").textContent = state.teams[1].name;
    [1, 2].forEach((t) => {
      const el = $(`#t${t}Score`);
      const to = state.teams[t - 1].score;
      if (animate) animateScore(el, parseInt(el.textContent) || 0, to);
      else el.textContent = to;
    });
    setTurn(state.turn);
  }

  function adjust(team, delta) {
    if (state.phase !== "board" || ![1, 2].includes(team) || !Number.isFinite(delta) || Math.abs(delta) > 1000) return;
    const el = $(`#t${team}Score`);
    const from = state.teams[team - 1].score;
    state.teams[team - 1].score = Math.max(0, from + delta);
    animateScore(el, from, state.teams[team - 1].score);
    Sound.click();
    saveGame();
  }

  function updateProgress() {
    const el = $("#progressMini");
    if (!el) return;
    const total = state.cats.reduce((s, c) => s + c.questions.length, 0);
    const done = state.cats.reduce((s, c) => s + c.questions.filter((q) => q.done).length, 0);
    el.textContent = `${done} / ${total}`;
  }

  // ====================================================
  //  السؤال
  // ====================================================
  // صورة اختيارية للسؤال أو الإجابة (حقلا img / aImg في بيانات السؤال)
  function setImg(id, src) {
    const el = $("#" + id);
    if (!el) return;
    if (src) {
      el.src = src;
      el.classList.add("show");
    } else {
      el.removeAttribute("src");
      el.classList.remove("show");
    }
  }

  function askClose() {
    // «الرجوع للوحة» — يغلق السؤال بدون نقاط (الخلية تبقى متاحة)
    if (state.phase === "tie") return toast(loc("احسموا الشوط الفاصل أولاً", "Finish the tie-breaker first."));
    if (state.answerShown) return toast(loc("بعد كشف الإجابة، احكم على السؤال قبل الرجوع", "Judge the answer before returning to the board."));
    if (state.current) closeQuestion();
  }

  function setView(v) {
    $("#qFrame").dataset.view = v;
  }

  function openQuestion(ci, qi, cell) {
    if (state.phase !== "board" || state.current) return;
    const q = state.cats[ci]?.questions[qi];
    if (!q || q.done) return;
    Sound.unlock();
    state.current = { ci, qi, cell, points: q.points };
    state.answerShown = false;
    state.phase = "question";

    $("#qCat").textContent = state.cats[ci].name;
    $("#qPoints").textContent = loc(`${q.points} نقطة`, `${q.points} points`);
    $("#qText").textContent = q.q;
    $("#answerText").textContent = q.a;
    setImg("qImg", q.img);
    setImg("answerImg", q.aImg);
    const note = $("#qNote");
    note.textContent = "";
    note.classList.remove("show");
    $("#awardT1").textContent = state.teams[0].name;
    $("#awardT2").textContent = state.teams[1].name;
    setView("q");
    closeLifelineCard();
    syncQuestionSide(loc(`دور فريق : ${state.teams[state.turn - 1].name}`, `${state.teams[state.turn - 1].name}'s turn`));

    $("#qModal").classList.add("active");
    Sound.open();
    startTimer();
    saveGame();
  }

  // مزامنة الشريط الجانبي لشاشة السؤال (أسماء، نقاط، دور، وسائل)
  function syncQuestionSide(turnLabel) {
    $("#qTurnPill").textContent = turnLabel;
    [1, 2].forEach((t) => {
      $(`#qT${t}Name`).textContent = state.teams[t - 1].name;
      $(`#qT${t}Score`).textContent = state.teams[t - 1].score;
      $(`#qSideT${t}`).classList.toggle("turn", state.turn === t);
    });
    renderLifelines();
  }

  // ===== مؤقت تصاعدي (00:00 ↑) مع إيقاف وتصفير — مثل سين جيم =====
  function fmtTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  function restartTimer() {
    if (!state.current || state.answerShown) return;
    state.timer.elapsed = 0;
    state.timer.lastTick = Date.now();
    paintTimer();
    saveGame();
    Sound.click();
  }
  function startTimer(elapsed = 0, paused = false) {
    stopTimer();
    state.timer.elapsed = elapsed;
    state.timer.paused = paused;
    state.timer.lastTick = Date.now();
    setPauseIcon(paused);
    paintTimer();
    state.timer.id = setInterval(() => {
      const next = BioRules.advanceTimer(state.timer.elapsed, state.timer.lastTick, Date.now(), state.timer.paused);
      if (next.elapsed === state.timer.elapsed) { state.timer.lastTick = next.lastTick; return; }
      state.timer.elapsed = next.elapsed;
      state.timer.lastTick = next.lastTick;
      paintTimer();
      if (state.timer.elapsed % 5 === 0) saveGame();
    }, 1000);
  }
  function paintTimer() {
    $("#timer").textContent = fmtTime(state.timer.elapsed);
  }
  function stopTimer() {
    if (state.timer.id) clearInterval(state.timer.id);
    state.timer.id = null;
  }
  function togglePause() {
    if (!state.current || state.answerShown) return;
    state.timer.paused = !state.timer.paused;
    state.timer.lastTick = Date.now();
    setPauseIcon(state.timer.paused);
    saveGame();
    Sound.click();
  }

  // ===== تنقّل شاشات السؤال → الإجابة → الحكم =====
  function showAnswer() {
    if (!state.current || state.answerShown) return;
    state.answerShown = true;
    state.timer.paused = true;
    closeLifelineCard();
    setPauseIcon(true);
    setView("a");
    saveGame();
    Sound.select();
  }
  function backToQuestion() {
    if (!state.current || !state.answerShown) return;
    state.answerShown = false;
    setView("q");
    state.timer.paused = false;
    state.timer.lastTick = Date.now();
    setPauseIcon(false);
    saveGame();
    Sound.click();
  }
  function openJudge() {
    if (!state.current || !state.answerShown) return;
    setView("j");
    saveGame();
    Sound.open();
  }
  function backToAnswer() {
    if (!state.current || !state.answerShown) return;
    setView("a");
    saveGame();
    Sound.click();
  }

  function award(team) {
    if (!state.current || !state.answerShown || ![0, 1, 2].includes(team) || !["question", "tie"].includes(state.phase)) return;

    // وضع الشوط الفاصل
    if (state.current.tie) {
      if (team === 0) {
        // لا أحد أجاب → شوط فاصل آخر
        state.usedQuestions.push(BioRules.key(state.current.q));
        closeQuestion();
        startTieBreaker();
        return;
      }
      state.phase = "transition";
      state.teams[team - 1].score += 100; // نقطة الحسم
      state.teams[team - 1].correct = (state.teams[team - 1].correct || 0) + 1;
      Sound.correct();
      FX.confettiBurst(window.innerWidth / 2, window.innerHeight / 2, 60, 1.3);
      closeQuestion();
      refreshScores(true);
      endGame();
      return;
    }

    const { ci, qi, cell, points } = state.current;
    const result = BioRules.award(state.teams, state.turn, team, points);
    state.teams = result.teams;
    state.usedQuestions.push(BioRules.key(state.cats[ci].questions[qi].q));
    if (team !== 0) {
      Sound.correct();
      const r = cell.getBoundingClientRect();
      FX.confettiBurst(r.left + r.width / 2, r.top + r.height / 2, 40, 1);
      toast(result.stolen ? loc(`⚡ سرقة ناجحة: ${state.teams[team - 1].name} +${points}`, `⚡ Steal! ${state.teams[team - 1].name} +${points}`) : `✅ ${state.teams[team - 1].name} +${points}`);
    } else {
      Sound.wrong();
      toast(loc("لم يحصل أي فريق على نقاط", "No team scored."));
    }
    state.cats[ci].questions[qi].done = true;
    cell.classList.add("done", "flip");
    cell.textContent = "✓";
    closeQuestion();
    refreshScores(true);
    updateProgress();
    setTurn(result.turn);
    // إحصائية الأسئلة
    const st = getStats();
    st.q = (st.q || 0) + 1;
    saveStats(st);
    state.phase = allDone() ? "transition" : "board";
    saveGame();
    if (state.phase === "transition") setTimeout(finish, 700);
  }

  function closeQuestion() {
    stopTimer();
    closeLifelineCard();
    state.current = null;
    state.answerShown = false;
    $("#qModal").classList.remove("active");
    if (state.phase === "question") state.phase = "board";
    saveGame();
  }
  function allDone() {
    return state.cats.every((c) => c.questions.every((q) => q.done));
  }

  // ====================================================
  //  النتيجة + الإحصائيات
  // ====================================================
  function finish() {
    if (!["board", "transition"].includes(state.phase)) return;
    if (state.phase === "board" && !allDone() && !window.confirm(loc("إنهاء المباراة قبل إكمال جميع الأسئلة؟", "End the match before all questions are played?"))) return;
    state.phase = "transition";
    if (state.current) closeQuestion();
    stopTimer();
    $("#qModal").classList.remove("active");
    // الجولة الذهبية قبل إعلان النتيجة (إن كانت مفعّلة)
    if (state.settings.golden && !state.goldenPlayed) {
      openGolden();
      return;
    }
    const [a, b] = state.teams;
    // تعادل → شوط فاصل حاسم
    if (a.score === b.score) {
      startTieBreaker();
      return;
    }
    endGame();
  }

  // ====================================================
  //  👑 الجولة الذهبية — رهان نقاط على سؤال أخير
  // ====================================================
  function goldenPool() {
    const seen = new Set([...state.usedQuestions, ...state.cats.flatMap((c) => c.questions.map((q) => BioRules.key(q.q)))]);
    const selected = state.cats.flatMap((c) => c.pool || []).filter((q) => BioRules.validQuestion(q) && !seen.has(BioRules.key(q.q)));
    const pool = selected.filter((q) => q.points === 600);
    return pool.length ? pool : selected.length ? selected : allCats().flatMap((c) => c.questions).filter((q) => !seen.has(BioRules.key(q.q)));
  }

  function openGolden() {
    if (!state.golden) {
      const pool = goldenPool();
      if (!pool.length) return endGame();
      const q = pool[(Math.random() * pool.length) | 0];
      state.golden = { q: q.q, a: q.a, img: q.img || "", aImg: q.aImg || "", wagers: [0, 0], results: [null, null], revealed: false, stage: "wager" };
      state.usedQuestions.push(BioRules.key(q.q));
    }
    state.phase = "golden";
    const g = state.golden;

    [1, 2].forEach((t) => {
      const team = state.teams[t - 1];
      $(`#gtName${t}`).textContent = team.name;
      $(`#gtScore${t}`).textContent = loc(`رصيدك: ${team.score}`, `Score: ${team.score}`);
      const inp = $(`#wager${t}`);
      inp.value = g.wagers[t - 1];
      inp.max = Math.max(0, team.score);
    });
    $("#goldQText").textContent = g.q;
    $("#goldAnswerText").textContent = g.a;
    setImg("goldQImg", g.img);
    setImg("goldAnswerImg", g.aImg);
    $("#goldStageWager").style.display = g.stage === "wager" ? "" : "none";
    $("#goldStageQ").style.display = g.stage === "wager" ? "none" : "";
    $("#goldJudge").style.display = g.revealed ? "" : "none";
    $("#goldAnswerBox").classList.toggle("show", g.revealed);
    $("#goldRevealBtn").style.display = g.revealed ? "none" : "";
    [1, 2].forEach((t) => {
      $(`#gjName${t}`).textContent = state.teams[t - 1].name;
      if (g.results[t - 1] !== null) $$(`#gjRow${t} .gj-btn`).forEach((b) => b.classList.toggle("on", (b.dataset.ok === "1") === g.results[t - 1]));
    });
    $("#goldenModal").classList.add("active");
    saveGame();
    Sound.open();
    toast(loc("👑 الجولة الذهبية! راهنوا بحكمة", "👑 Golden round! Place your wagers."));
  }

  function goldenShowQuestion() {
    if (state.phase !== "golden" || !state.golden || state.golden.stage !== "wager") return;
    [1, 2].forEach((t) => {
      state.golden.wagers[t - 1] = BioRules.clampWager($(`#wager${t}`).value, state.teams[t - 1].score);
    });
    state.golden.stage = "question";
    $("#goldQText").textContent = state.golden.q;
    $("#goldAnswerText").textContent = state.golden.a;
    setImg("goldQImg", state.golden.img);
    setImg("goldAnswerImg", state.golden.aImg);
    $("#goldStageWager").style.display = "none";
    $("#goldStageQ").style.display = "";
    saveGame();
    Sound.select();
  }

  function goldenReveal() {
    if (state.phase !== "golden" || !state.golden || state.golden.stage !== "question" || state.golden.revealed) return;
    state.golden.revealed = true;
    saveGame();
    $("#goldAnswerBox").classList.add("show");
    $("#goldRevealBtn").style.display = "none";
    $("#goldJudge").style.display = "";
    [1, 2].forEach((t) => {
      $(`#gjName${t}`).textContent = state.teams[t - 1].name;
    });
    Sound.select();
  }

  function goldenSetResult(team, ok) {
    if (state.phase !== "golden" || !state.golden?.revealed || ![1, 2].includes(team) || typeof ok !== "boolean") return;
    state.golden.results[team - 1] = ok;
    saveGame();
    $$(`#gjRow${team} .gj-btn`).forEach((b) => {
      b.classList.toggle("on", (b.dataset.ok === "1") === ok);
    });
    Sound.click();
  }

  function goldenApply() {
    if (state.phase !== "golden" || !state.golden?.revealed) return;
    const g = state.golden;
    if (g.results.some((r) => r === null)) return toast(loc("حدد نتيجة الفريقين أولاً", "Mark both teams' answers first."));
    state.teams = BioRules.applyGolden(state.teams, g.wagers, g.results);
    state.phase = "transition";
    state.goldenPlayed = true;
    state.golden = null;
    $("#goldenModal").classList.remove("active");
    refreshScores(true);
    // إحصائية الجولة الذهبية
    const st = getStats();
    st.golden = (st.golden || 0) + 1;
    saveStats(st);
    saveGame();
    FX.confettiBurst(window.innerWidth / 2, window.innerHeight / 3, 50, 1.2);
    Sound.win();
    setTimeout(finish, 900);
  }

  // ===== شوط فاصل =====
  function startTieBreaker(savedQuestion = null) {
    if (state.phase === "tie" && state.current) return;
    const used = new Set([...state.usedQuestions, ...state.cats.flatMap((c) => c.questions.map((q) => BioRules.key(q.q)))]);
    let pool = state.cats.flatMap((c) => c.pool || []).filter((q) => BioRules.validQuestion(q) && !used.has(BioRules.key(q.q)));
    if (!pool.length) pool = allCats().flatMap((c) => c.questions).filter((q) => BioRules.validQuestion(q) && !used.has(BioRules.key(q.q)));
    if (!savedQuestion && !pool.length) return endGame();
    const q = savedQuestion || pool[(Math.random() * pool.length) | 0];
    state.current = { tie: true, points: 0, q: q.q, a: q.a, img: q.img, aImg: q.aImg };
    state.answerShown = false;
    state.phase = "tie";

    $("#qCat").textContent = loc("⚡ شوط فاصل حاسم", "⚡ Tie-breaker");
    $("#qPoints").textContent = loc("نقطة الفوز", "Winning point");
    $("#qText").textContent = q.q;
    $("#answerText").textContent = q.a;
    setImg("qImg", q.img);
    setImg("answerImg", q.aImg);
    const note = $("#qNote");
    note.textContent = "";
    note.classList.remove("show");
    $("#awardT1").textContent = state.teams[0].name;
    $("#awardT2").textContent = state.teams[1].name;
    setView("q");
    closeLifelineCard();
    syncQuestionSide(loc("⚡ شوط فاصل حاسم", "⚡ Tie-breaker"));

    $("#qModal").classList.add("active");
    toast(loc("🤝 تعادل! شوط فاصل يحسم الفوز ⚡", "🤝 It's tied! The next answer decides it. ⚡"));
    Sound.timeout();
    startTimer();
    saveGame();
  }

  function endGame() {
    if (state.phase === "result") return;
    state.phase = "result";
    stopTimer();
    $("#qModal").classList.remove("active");
    clearSave();
    const [a, b] = state.teams;
    $("#fsName1").textContent = a.name;
    $("#fsName2").textContent = b.name;
    $("#fsScore1").textContent = a.score;
    $("#fsScore2").textContent = b.score;
    $("#fsCorrect1").textContent = loc(`✅ ${a.correct || 0} إجابة صحيحة`, `✅ ${a.correct || 0} correct`);
    $("#fsCorrect2").textContent = loc(`✅ ${b.correct || 0} إجابة صحيحة`, `✅ ${b.correct || 0} correct`);

    let winner;
    if (a.score > b.score) {
      winner = `🎉 ${a.name}`;
      Sound.win();
      FX.celebrate();
    } else if (b.score > a.score) {
      winner = `🎉 ${b.name}`;
      Sound.win();
      FX.celebrate();
    } else {
      winner = loc("🤝 تعادل!", "🤝 Draw!");
      Sound.draw();
    }
    $("#winnerName").textContent = winner;

    // تحديث إحصائيات المستخدم
    const st = getStats();
    st.games = (st.games || 0) + 1;
    st.best = Math.max(st.best || 0, a.score, b.score);
    saveStats(st);

    // سجل المباراة
    addHistory({
      date: Date.now(),
      t1: a.name,
      s1: a.score,
      t2: b.name,
      s2: b.score,
      winner: a.score === b.score ? 0 : a.score > b.score ? 1 : 2,
    });

    // الإنجازات الجديدة
    const fresh = checkAchievements();
    if (fresh.length) {
      setTimeout(() => toast(loc("🏅 إنجاز جديد: ", "🏅 New achievement: ") + achName(fresh[0])), 1400);
    }

    show("result");
  }

  // نتيجة مباراة «سين وجيم» (match.js) → نفس الإحصائيات والسجل والإنجازات
  function recordMatch(r) {
    const result = BioRules.applyMatchRecord(getStats(), getHistory(), { ...r, date: Date.now() });
    if (result.statsChanged) saveStats(result.stats);
    if (result.historyChanged) uWrite("history", result.history);
    const fresh = checkAchievements();
    if (fresh.length) setTimeout(() => toast(loc("🏅 إنجاز جديد: ", "🏅 New achievement: ") + achName(fresh[0])), 1400);
  }

  function playAgain() {
    clearSave();
    state.phase = "setup";
    state.golden = null;
    state.usedQuestions = [];
    state.selectedCats = [];
    state.cats = [];
    state.current = null;
    $$(".cat-tile.selected").forEach((t) => t.classList.remove("selected"));
    updateCounter();
    show("setup");
    Sound.click();
  }

  function home() {
    if (state.current) {
      state.timer.paused = true;
      saveGame();
      stopTimer();
      $("#qModal").classList.remove("active");
    }
    if (state.cats.length && state.phase !== "result") saveGame();
    goLanding();
  }

  // ====================================================
  //  استكمال
  // ====================================================
  function checkResume() {
    $("#resumeBox").style.display = hasSave() ? "flex" : "none";
  }
  function resume() {
    try {
      const snap = uRead("save", null);
      if (!BioRules.validateSnapshot(snap)) return toast("ملف المباراة المحفوظة غير صالح");
      stopTimer();
      state.teams = snap.teams;
      state.turn = snap.turn;
      state.cats = snap.cats;
      if (snap.settings && typeof snap.settings === "object") {
        for (const key of ["random", "sound", "golden"]) if (typeof snap.settings[key] === "boolean") state.settings[key] = snap.settings[key];
        if ([4, 5, 6].includes(snap.settings.catCount)) state.settings.catCount = snap.settings.catCount;
      }
      state.teamColors = Array.isArray(snap.teamColors) && snap.teamColors.length === 2 && snap.teamColors.every((c) => /^#[0-9a-f]{6}$/i.test(c)) ? snap.teamColors : state.teamColors;
      state.goldenPlayed = !!snap.goldenPlayed;
      state.golden = snap.golden && typeof snap.golden === "object" ? snap.golden : null;
      state.usedQuestions = Array.isArray(snap.usedQuestions) ? snap.usedQuestions : [];
      state.current = null;
      state.answerShown = false;
      state.phase = "board";
      document.documentElement.style.setProperty("--team1", state.teamColors[0]);
      document.documentElement.style.setProperty("--team2", state.teamColors[1]);
      buildBoard();
      refreshScores();
      show("board");
      if (snap.phase === "golden" && state.golden) {
        openGolden();
      } else if (snap.phase === "tie" && snap.current?.tie) {
        startTieBreaker(snap.current);
        restoreQuestionState(snap);
      } else if (snap.phase === "question" && snap.current) {
        const { ci, qi } = snap.current;
        openQuestion(ci, qi, $(`#board .cell[data-ci="${ci}"][data-qi="${qi}"]`));
        restoreQuestionState(snap);
      } else if (snap.phase === "transition" || allDone()) {
        state.phase = "transition";
        finish();
      }
      Sound.open();
    } catch {
      toast("تعذّر الاستكمال");
    }
  }
  function restoreQuestionState(snap) {
    if (!state.current) return;
    state.answerShown = !!snap.answerShown;
    const view = state.answerShown && ["a", "j"].includes(snap.questionView) ? snap.questionView : "q";
    setView(view);
    const elapsed = Number.isFinite(snap.timer?.elapsed) && snap.timer.elapsed >= 0 ? Math.floor(snap.timer.elapsed) : 0;
    startTimer(elapsed, true);
    saveGame();
    toast(loc("تم استكمال السؤال؛ المؤقت متوقف حتى تضغط متابعة", "Question restored; press play to resume the timer."));
  }
  function discardSave() {
    clearSave();
    checkResume();
    toast("تم حذف اللعبة المحفوظة");
  }

  // ====================================================
  //  المحرر
  // ====================================================
  function openEditor() {
    editing = null;
    renderEditorList();
    edClear();
    $("#editorModal").classList.add("active");
    Sound.open();
  }
  function closeEditor() {
    $("#editorModal").classList.remove("active");
    buildCatPicker();
    updateLandingStats();
    buildMarquee();
    if (window.Match) Match.refreshCats();
  }
  function renderEditorList() {
    const list = $("#editorList");
    list.innerHTML = "";
    CATEGORIES.forEach((c) => {
      const it = document.createElement("div");
      it.className = "ed-item";
      it.innerHTML = `<span>${escapeHTML(c.icon)} ${escapeHTML(c.name)}</span><span class="lock">🔒</span>`;
      list.appendChild(it);
    });
    customCats.forEach((c, i) => {
      const it = document.createElement("div");
      it.className = "ed-item";
      it.innerHTML = `<button type="button" class="ed-edit">${escapeHTML(c.icon)} ${escapeHTML(c.name)}</button><button type="button" class="del" aria-label="${escapeHTML(loc("حذف", "Delete"))} ${escapeHTML(c.name)}">🗑</button>`;
      it.querySelector(".ed-edit").addEventListener("click", () => loadIntoForm(i));
      it.querySelector(".del").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(loc(`حذف "${c.name}"؟`, `Delete "${c.name}"?`))) {
          customCats.splice(i, 1);
          saveCustom();
          renderEditorList();
          toast("تم الحذف");
        }
      });
      list.appendChild(it);
    });
  }
  function loadIntoForm(i) {
    editing = i;
    const c = customCats[i];
    $("#edName").value = c.name;
    $("#edIcon").value = c.icon || "";
    $("#edQuestions").innerHTML = "";
    c.questions.forEach((q) => addQRow(q.points, q.q, q.a));
  }
  function edClear() {
    editing = null;
    $("#edName").value = "";
    $("#edIcon").value = "";
    $("#edQuestions").innerHTML = "";
    [200, 200, 400, 400, 600, 600].forEach((p) => addQRow(p, "", ""));
  }
  function addQRow(points = 200, q = "", a = "") {
    const row = document.createElement("div");
    row.className = "ed-q";
    row.innerHTML = `
      <select><option value="200">200</option><option value="400">400</option><option value="600">600</option></select>
      <input class="q" type="text" placeholder="${escapeHTML(loc("السؤال", "Question"))}" />
      <input class="a" type="text" placeholder="${escapeHTML(loc("الإجابة", "Answer"))}" />
      <button type="button" class="rm" aria-label="${escapeHTML(loc("حذف السؤال", "Remove question"))}">✕</button>`;
    row.querySelector("select").value = points;
    row.querySelector(".q").value = q;
    row.querySelector(".a").value = a;
    row.querySelector(".rm").addEventListener("click", () => row.remove());
    $("#edQuestions").appendChild(row);
  }
  function edAddQuestion() {
    addQRow();
  }
  function edSave() {
    const name = $("#edName").value.trim();
    const icon = $("#edIcon").value.trim() || "📁";
    if (!name) return toast("اكتب اسم الفئة");
    const questions = [];
    $$("#edQuestions .ed-q").forEach((row) => {
      const p = +row.querySelector("select").value;
      const q = row.querySelector(".q").value.trim();
      const a = row.querySelector(".a").value.trim();
      if (q && a) questions.push({ points: p, q, a });
    });
    const cat = BioRules.cleanCategory({ id: editing !== null ? customCats[editing].id : "c_" + Date.now(), name, icon, questions });
    if (!cat) return toast("يلزم سؤالان مختلفان على الأقل لكل قيمة (200/400/600)");
    if (editing !== null) customCats[editing] = cat;
    else customCats.push(cat);
    saveCustom();
    editing = null;
    renderEditorList();
    edClear();
    Sound.correct();
    toast("✅ تم حفظ الفئة");
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(customCats, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bio-categories.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("⬇️ تم التصدير");
  }
  function importData(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.size > 2_000_000) { ev.target.value = ""; return toast("الملف كبير جداً"); }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data) || data.length > 100) throw new Error();
        const incoming = data.map(BioRules.cleanCategory);
        if (incoming.some((x) => !x)) throw new Error();
        const names = new Set(customCats.map((c) => BioRules.key(c.name)));
        const unique = incoming.filter((c) => { const k = BioRules.key(c.name); if (names.has(k)) return false; names.add(k); return true; });
        customCats = customCats.concat(unique);
        saveCustom();
        renderEditorList();
        toast(`⬆️ تم استيراد ${unique.length} فئة`);
      } catch {
        toast("ملف غير صالح");
      }
    };
    reader.readAsText(file);
    ev.target.value = "";
  }

  // ====================================================
  //  أدوات
  // ====================================================
  function toggleSound() {
    state.settings.sound = !state.settings.sound;
    Sound.setEnabled(state.settings.sound);
    if (!state.settings.sound) {
      $$("#musicSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === "0"));
    }
    setSoundIcon();
    saveSettings();
    if (state.settings.sound) Sound.select();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }
  // أيقونات SVG + aria-pressed بدل كتابة إيموجي في الزر
  function iconBtn(sel, icon, pressed) {
    const b = $(sel);
    if (!b) return;
    b.innerHTML = `<svg class="ic"><use href="#${icon}" /></svg>`;
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
  }
  function setPauseIcon(paused) {
    iconBtn("#pauseBtn", paused ? "i-play" : "i-pause", paused);
  }
  function setSoundIcon() {
    iconBtn("#soundBtn", state.settings.sound ? "i-sound" : "i-mute", !state.settings.sound);
  }
  function setFsIcon() {
    iconBtn("#fsBtn", document.fullscreenElement ? "i-shrink" : "i-expand", !!document.fullscreenElement);
  }

  // حفظ صورة النتيجة (canvas → تنزيل)
  function shareResult() {
    const [a, b] = state.teams;
    const W = 1080,
      H = 1080;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const c = cv.getContext("2d");
    const sw = THEME_SWATCH[THEMES[state.themeIndex]] || "#c3e813";
    const logo = new Image();
    logo.onload = logo.onerror = () => paint();
    logo.src = "assets/logo-mark.png";

    function paint() {
    // خلفية
    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#17191e");
    bg.addColorStop(1, "#0f1013");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // إطار
    c.strokeStyle = sw;
    c.lineWidth = 8;
    c.strokeRect(40, 40, W - 80, H - 80);

    c.textAlign = "center";
    if (logo.complete && logo.naturalWidth) c.drawImage(logo, W / 2 - 230, 92, 120, 112);
    c.fillStyle = sw;
    c.font = "800 96px 'Baloo Bhaijaan 2', Tajawal, Arial";
    c.fillText(loc("بايو", "BIO"), W / 2 + 60, 190);

    c.fillStyle = "#bdc0c8";
    c.font = "600 40px 'IBM Plex Sans Arabic', Tajawal, Arial";
    c.fillText(loc("نتيجة المباراة", "Match result"), W / 2, 270);

    // الفائز
    let winLine = a.score === b.score ? loc("🤝 تعادل", "🤝 Draw") : "🏆 " + (a.score > b.score ? a.name : b.name);
    c.fillStyle = "#f9e09b";
    c.font = "800 70px 'Baloo Bhaijaan 2', Tajawal, Arial";
    c.fillText(winLine, W / 2, 430);

    // الفرق والنقاط
    function teamBox(name, score, color, y) {
      c.fillStyle = "#1f2228";
      roundRect(c, 140, y, W - 280, 150, 24);
      c.fill();
      c.fillStyle = color;
      c.font = "700 50px 'IBM Plex Sans Arabic', Tajawal, Arial";
      c.fillText(name, W / 2, y + 65);
      c.fillStyle = "#f5f2e9";
      c.font = "800 80px 'Baloo Bhaijaan 2', Tajawal, Arial";
      c.fillText(score, W / 2, y + 135);
    }
    teamBox(a.name, a.score, state.teamColors[0] || "#9fe0ec", 540);
    teamBox(b.name, b.score, state.teamColors[1] || "#e8949d", 730);

    c.fillStyle = "#8d919b";
    c.font = "600 34px 'IBM Plex Sans Arabic', Tajawal, Arial";
    c.fillText(loc("بايو · مسابقة علمية بين فريقين", "BIO · a science quiz for two teams"), W / 2, 980);

    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bio-result.png";
      link.click();
      URL.revokeObjectURL(url);
      toast(loc("📸 تم حفظ صورة النتيجة", "📸 Result image saved"));
    });
    }
    Sound.select();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function openHelp() {
    $("#helpModal").classList.add("active");
    Sound.open();
  }
  function closeHelp() {
    $("#helpModal").classList.remove("active");
  }

  // ====================================================
  //  التهيئة
  // ====================================================
  function init() {
    loadSettings();
    const storedTheme = +(localStorage.getItem(LS_THEME) || 0);
    state.themeIndex = Number.isInteger(storedTheme) && storedTheme >= 0 ? storedTheme % THEMES.length : 0;
    applyTheme();
    applyMode(localStorage.getItem(LS_MODE) || "dark");
    applyLang(localStorage.getItem(LS_LANG) || "ar");

    FX.starfield("starfield");
    buildColorPickers();
    buildThemePicker();
    bindSettings();
    bindMusic();
    applySettingsToUI();
    setPauseIcon(false);
    setFsIcon();
    document.addEventListener("fullscreenchange", setFsIcon);
    buildMarquee();

    Auth.onChange(onUserChange);
    onUserChange(); // تحميل بيانات المستخدم الحالي

    $("#startBtn").addEventListener("click", start);

    ["editorModal", "authModal", "profileModal", "helpModal"].forEach((id) => {
      $("#" + id).addEventListener("click", (e) => {
        if (e.target.id === id) $("#" + id).classList.remove("active");
      });
    });

    // عرض المساعدة في أول زيارة
    if (!localStorage.getItem("sj_seen_help")) {
      localStorage.setItem("sj_seen_help", "1");
      setTimeout(openHelp, 900);
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (state.current) askClose();
        $$(".modal.active").forEach((m) => {
          if (!["qModal", "goldenModal", "mqModal"].includes(m.id)) m.classList.remove("active");
        });
      }
      if (!state.current) return;
      if (e.key === " ") {
        e.preventDefault();
        if (!state.answerShown) showAnswer();
        return;
      }
      // منح النقاط بالكيبورد فقط بعد عرض الإجابة
      if (!state.answerShown) return;
      if (e.key === "1") award(1);
      if (e.key === "2") award(2);
      if (e.key === "0") award(0);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  return {
    init, start, adjust, toggleTurn, togglePause, showAnswer, award, finish,
    playAgain, home, resume, discardSave, goLanding, playClick,
    openEditor, closeEditor, edAddQuestion, edSave, edClear, exportData, importData,
    toggleSound, toggleFullscreen, cycleTheme, setTheme, toggleLang, toggleMode,
    openProfile, closeProfile, openAuth, closeAuth, googleLogin, guest,
    openHelp, closeHelp, shareResult, askClose, restartTimer,
    backToQuestion, openJudge, backToAnswer, lifelineStart, lifelineCancel,
    goldenShowQuestion, goldenReveal, goldenSetResult, goldenApply, refreshCatalog,
    showScreen, recordMatch, toast, categories: allCats, questionHistory, rememberQuestions,
  };
})();

const bioRulesReady = globalThis.BioRules ? Promise.resolve() : new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = new URL("./game-logic.js", document.currentScript?.src || location.href).href;
  script.onload = resolve;
  script.onerror = reject;
  document.head.appendChild(script);
});
document.addEventListener("DOMContentLoaded", () => bioRulesReady.then(Game.init).catch(() => {
  const toast = document.getElementById("toast");
  toast.textContent = "تعذّر تحميل قواعد اللعبة. أعد الاتصال وحدّث الصفحة.";
  toast.classList.add("show");
}));
