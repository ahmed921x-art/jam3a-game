/* ===========================================================
   جمعة — منطق اللعبة الكامل (نسخة عالمية)
   حسابات + ملف شخصي + ثيمات + لغتان + إحصائيات + اللعبة
   =========================================================== */

const Game = (() => {
  const LS_SETTINGS = "sj_settings";
  const LS_THEME = "sj_theme";
  const LS_LANG = "sj_lang";

  const THEMES = ["royal", "emerald", "crimson", "ocean", "violet"];

  const LIFELINES = [
    { id: "double", label: "نقطتك ونص", icon: "✖️" },
    { id: "steal", label: "جاوب واسرق", icon: "🥷" },
    { id: "phone", label: "وقت إضافي", icon: "📞" },
  ];

  const TEAM_COLORS = ["#3aa0ff", "#ff5d73", "#34d399", "#a78bfa", "#f59e0b", "#ec4899"];

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

  const state = {
    teams: [
      { name: "الفريق الأول", score: 0, lifelines: [] },
      { name: "الفريق الثاني", score: 0, lifelines: [] },
    ],
    turn: 1,
    selectedCats: [],
    cats: [],
    current: null,
    timer: { id: null, left: 0, paused: false, total: 60 },
    multiplier: 1,
    multiplierTeam: 0,
    stealArmed: false,
    answerShown: false,
    goldenPlayed: false,
    golden: null,
    settings: { seconds: 60, random: true, sound: true, golden: false },
    themeIndex: 0,
    teamColors: ["#3aa0ff", "#ff5d73"],
  };

  let customCats = [];
  let editing = null;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const screens = {
    landing: $("#landingScreen"),
    setup: $("#setupScreen"),
    board: $("#boardScreen"),
    result: $("#resultScreen"),
  };

  function show(scr) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[scr].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    localStorage.setItem(Auth.key(base), JSON.stringify(v));
    Auth.cloudSet(base, v); // مزامنة سحابية للمسجلين (تتجاهل الضيف تلقائياً)
  }

  function loadCustom() {
    customCats = uRead("custom", []);
  }
  function saveCustom() {
    uWrite("custom", customCats);
  }

  function getStats() {
    return uRead("stats", { games: 0, best: 0, q: 0 });
  }
  function saveStats(s) {
    uWrite("stats", s);
  }

  function getHistory() {
    return uRead("history", []);
  }
  function addHistory(rec) {
    const h = getHistory();
    h.unshift(rec);
    uWrite("history", h.slice(0, 20));
  }

  function getUnlocked() {
    return uRead("ach", []);
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
    uWrite("save", {
      teams: state.teams,
      turn: state.turn,
      cats: state.cats,
      settings: state.settings,
      teamColors: state.teamColors,
      goldenPlayed: state.goldenPlayed,
    });
  }
  function clearSave() {
    localStorage.removeItem(Auth.key("save"));
  }
  function hasSave() {
    return !!localStorage.getItem(Auth.key("save"));
  }

  // إعدادات عامة (غير مرتبطة بالمستخدم)
  function loadSettings() {
    try {
      Object.assign(state.settings, JSON.parse(localStorage.getItem(LS_SETTINGS)) || {});
    } catch {}
  }
  function saveSettings() {
    localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings));
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
    if (fresh.length) toast(`🏅 إنجاز جديد: ${fresh[0].name}`);
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
  const THEME_NAMES = {
    royal: "ملكي",
    emerald: "زمردي",
    crimson: "قرمزي",
    ocean: "محيطي",
    violet: "بنفسجي",
  };
  const THEME_SWATCH = {
    royal: "#e9b949",
    emerald: "#34d399",
    crimson: "#fb7185",
    ocean: "#38bdf8",
    violet: "#a78bfa",
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
      $("#authErr").textContent = "تعذّر تسجيل الدخول — حاول مرة أخرى";
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
      el.title = a.name;
      el.innerHTML = `<span class="b-ic">${a.icon}</span><span class="b-nm">${a.name}</span>`;
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
        <span class="hi-team ${w1}">${r.t1}</span>
        <span class="hi-score">${r.s1} - ${r.s2}</span>
        <span class="hi-team ${w2}">${r.t2}</span>`;
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

  function buildCatPicker() {
    const grid = $("#catsGrid");
    grid.innerHTML = "";
    allCats().forEach((cat, i) => {
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
        <span class="ic">${cat.icon || "📁"}</span>
        <span class="nm">${cat.name}</span>
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
    const b = document.querySelector(".hint b");
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
    $("#timeSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      $$("#timeSeg button").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      state.settings.seconds = +b.dataset.v;
      saveSettings();
      Sound.click();
    });
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
    $$("#timeSeg button").forEach((b) =>
      b.classList.toggle("on", +b.dataset.v === state.settings.seconds)
    );
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
    $("#soundBtn").textContent = state.settings.sound ? "🔊" : "🔇";
  }

  // ====================================================
  //  بدء اللعبة
  // ====================================================
  function pickQuestions(cat) {
    const tiers = [200, 400, 600];
    const out = [];
    tiers.forEach((p) => {
      let pool = cat.questions.filter((q) => q.points === p);
      if (pool.length === 0) pool = cat.questions.slice();
      let chosen = state.settings.random ? shuffle(pool.slice()).slice(0, 2) : pool.slice(0, 2);
      while (chosen.length < 2) chosen.push(pool[0]);
      chosen.forEach((q) => out.push({ ...q, points: p, done: false }));
    });
    return out;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function start() {
    Sound.unlock();
    if (state.selectedCats.length !== catTarget())
      return toast(`اختر ${catTarget()} فئات بالضبط`);
    const n1 = $("#team1").value.trim() || "الفريق الأول";
    const n2 = $("#team2").value.trim() || "الفريق الثاني";
    state.teams[0] = { name: n1, score: 0, correct: 0, lifelines: cloneLifelines() };
    state.teams[1] = { name: n2, score: 0, correct: 0, lifelines: cloneLifelines() };
    state.turn = 1;
    state.goldenPlayed = false;

    const cats = allCats();
    state.cats = state.selectedCats.map((i) => {
      const c = cats[i];
      return { name: c.name, icon: c.icon || "📁", questions: pickQuestions(c) };
    });

    document.documentElement.style.setProperty("--team1", state.teamColors[0]);
    document.documentElement.style.setProperty("--team2", state.teamColors[1]);

    buildBoard();
    refreshScores();
    saveGame();
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
    board.style.gridTemplateColumns = `repeat(${state.cats.length}, 1fr)`;
    board.innerHTML = "";
    state.cats.forEach((cat, ci) => {
      const col = document.createElement("div");
      col.className = "board-col";
      const head = document.createElement("div");
      head.className = "col-head";
      head.innerHTML = `<span class="ic">${cat.icon}</span>${cat.name}`;
      col.appendChild(head);
      cat.questions.forEach((q, qi) => {
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
        col.appendChild(cell);
      });
      board.appendChild(col);
    });
    renderLifelines();
    updateProgress();
  }

  function renderLifelines() {
    [1, 2].forEach((t) => {
      const box = $(`#t${t}Lifelines`);
      box.innerHTML = "";
      state.teams[t - 1].lifelines.forEach((l, li) => {
        const el = document.createElement("span");
        el.className = "lifeline" + (l.used ? " used" : "");
        el.textContent = `${l.icon} ${l.label}`;
        el.addEventListener("click", () => useLifeline(t, li));
        box.appendChild(el);
      });
    });
  }

  function useLifeline(team, li) {
    const l = state.teams[team - 1].lifelines[li];
    if (l.used) return;
    if (l.id === "phone") {
      if (!state.current) return toast("استخدمها أثناء عرض السؤال");
      state.timer.left += 30;
      state.timer.total += 30;
      paintTimer();
      toast("📞 +30 ثانية");
    }
    if (l.id === "double") {
      if (!state.current) return toast("استخدمها أثناء عرض السؤال");
      state.multiplier = 1.5;
      state.multiplierTeam = team;
      toast(`✖️ نقاط هذا السؤال ×1.5 لـ ${state.teams[team - 1].name}`);
    }
    if (l.id === "steal") {
      if (!state.current) return toast("استخدمها أثناء عرض السؤال");
      state.stealArmed = true;
      $("#stealNote").classList.add("show");
      toast("🥷 وضع السرقة مفعّل");
    }
    Sound.lifeline();
    l.used = true;
    renderLifelines();
    saveGame();
  }

  function setTurn(t) {
    state.turn = t;
    $("#teamCard1").classList.toggle("active", t === 1);
    $("#teamCard2").classList.toggle("active", t === 2);
  }
  function toggleTurn() {
    setTurn(state.turn === 1 ? 2 : 1);
    Sound.click();
    saveGame();
  }

  function animateScore(el, from, to) {
    const dur = 500;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * ease);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
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
    const el = $(`#t${team}Score`);
    const from = state.teams[team - 1].score;
    state.teams[team - 1].score += delta;
    animateScore(el, from, state.teams[team - 1].score);
    Sound.click();
    saveGame();
  }

  function updateProgress() {
    const total = state.cats.reduce((s, c) => s + c.questions.length, 0);
    const done = state.cats.reduce((s, c) => s + c.questions.filter((q) => q.done).length, 0);
    $("#progressMini").textContent = `${done} / ${total}`;
  }

  // ====================================================
  //  السؤال
  // ====================================================
  function openQuestion(ci, qi, cell) {
    const q = state.cats[ci].questions[qi];
    if (q.done) return;
    Sound.unlock();
    state.current = { ci, qi, cell, points: q.points };
    state.multiplier = 1;
    state.multiplierTeam = 0;
    state.stealArmed = false;
    state.answerShown = false;

    $("#qCat").textContent = state.cats[ci].name;
    $("#qPoints").textContent = q.points;
    $("#qText").textContent = q.q;
    $("#answerText").textContent = q.a;
    $("#answerBox").classList.remove("show");
    $("#awardRow").classList.remove("show");
    $("#stealNote").classList.remove("show");
    $("#showAnswerBtn").style.display = "";
    $("#pauseBtn").style.display = "";
    $("#pauseBtn").textContent = "⏸️ إيقاف";
    $("#awardT1").textContent = `${state.teams[0].name} ✓`;
    $("#awardT2").textContent = `${state.teams[1].name} ✓`;

    $("#qModal").classList.add("active");
    Sound.open();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.timer.total = state.settings.seconds;
    state.timer.left = state.settings.seconds;
    state.timer.paused = false;
    paintTimer();
    state.timer.id = setInterval(() => {
      if (state.timer.paused) return;
      state.timer.left--;
      paintTimer();
      if (state.timer.left <= 5 && state.timer.left > 0) Sound.tickLow();
      if (state.timer.left <= 0) {
        stopTimer();
        Sound.timeout();
        toast("⏰ انتهى الوقت!");
        // عرض الإجابة تلقائياً عند انتهاء الوقت
        if (!state.answerShown) showAnswer();
      }
    }, 1000);
  }
  function paintTimer() {
    const el = $("#timer");
    const left = Math.max(0, state.timer.left);
    el.textContent = left;
    const low = left <= 10;
    el.classList.toggle("low", low);
    const bar = $("#timerBar");
    bar.style.width = (left / state.timer.total) * 100 + "%";
    bar.classList.toggle("low", low);
  }
  function stopTimer() {
    if (state.timer.id) clearInterval(state.timer.id);
    state.timer.id = null;
  }
  function togglePause() {
    if (!state.current) return;
    state.timer.paused = !state.timer.paused;
    $("#pauseBtn").textContent = state.timer.paused ? "▶️ متابعة" : "⏸️ إيقاف";
    Sound.click();
  }

  function showAnswer() {
    state.answerShown = true;
    state.timer.paused = true;
    $("#answerBox").classList.add("show");
    $("#showAnswerBtn").style.display = "none";
    $("#pauseBtn").style.display = "none";
    $("#awardRow").classList.add("show");
    Sound.select();
  }

  function award(team) {
    if (!state.current) return;

    // وضع الشوط الفاصل
    if (state.current.tie) {
      if (team === 0) {
        // لا أحد أجاب → شوط فاصل آخر
        closeQuestion();
        startTieBreaker();
        return;
      }
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
    if (team !== 0) {
      let mult = state.multiplier > 1 && state.multiplierTeam === team ? state.multiplier : 1;
      const gained = Math.round(points * mult);
      state.teams[team - 1].score += gained;
      state.teams[team - 1].correct = (state.teams[team - 1].correct || 0) + 1;
      Sound.correct();
      const r = cell.getBoundingClientRect();
      FX.confettiBurst(r.left + r.width / 2, r.top + r.height / 2, 40, 1);
    } else {
      Sound.wrong();
    }
    state.cats[ci].questions[qi].done = true;
    cell.classList.add("done", "flip");
    cell.textContent = "✓";
    closeQuestion();
    refreshScores(true);
    updateProgress();
    setTurn(state.turn === 1 ? 2 : 1);
    // إحصائية الأسئلة
    const st = getStats();
    st.q = (st.q || 0) + 1;
    saveStats(st);
    saveGame();
    if (allDone()) setTimeout(finish, 700);
  }

  function closeQuestion() {
    stopTimer();
    state.current = null;
    state.multiplier = 1;
    state.stealArmed = false;
    state.answerShown = false;
    $("#qModal").classList.remove("active");
  }
  function allDone() {
    return state.cats.every((c) => c.questions.every((q) => q.done));
  }

  // ====================================================
  //  النتيجة + الإحصائيات
  // ====================================================
  function finish() {
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
    const pool = [];
    allCats().forEach((c) => c.questions.forEach((q) => { if (q.points === 600) pool.push(q); }));
    return pool.length ? pool : allCats().flatMap((c) => c.questions);
  }

  function openGolden() {
    const pool = goldenPool();
    const q = pool[(Math.random() * pool.length) | 0];
    state.golden = { q: q.q, a: q.a, wagers: [0, 0], results: [null, null], revealed: false };

    [1, 2].forEach((t) => {
      const team = state.teams[t - 1];
      $(`#gtName${t}`).textContent = team.name;
      $(`#gtScore${t}`).textContent = `رصيدك: ${team.score}`;
      const inp = $(`#wager${t}`);
      inp.value = 0;
      inp.max = Math.max(0, team.score);
    });
    $("#goldStageWager").style.display = "";
    $("#goldStageQ").style.display = "none";
    $("#goldJudge").style.display = "none";
    $("#goldAnswerBox").classList.remove("show");
    $("#goldRevealBtn").style.display = "";
    $("#goldenModal").classList.add("active");
    Sound.open();
    toast("👑 الجولة الذهبية! راهنوا بحكمة");
  }

  function goldenShowQuestion() {
    [1, 2].forEach((t) => {
      const max = Math.max(0, state.teams[t - 1].score);
      let w = Math.round(+$(`#wager${t}`).value || 0);
      w = Math.min(Math.max(0, w), max);
      state.golden.wagers[t - 1] = w;
    });
    $("#goldQText").textContent = state.golden.q;
    $("#goldAnswerText").textContent = state.golden.a;
    $("#goldStageWager").style.display = "none";
    $("#goldStageQ").style.display = "";
    Sound.select();
  }

  function goldenReveal() {
    state.golden.revealed = true;
    $("#goldAnswerBox").classList.add("show");
    $("#goldRevealBtn").style.display = "none";
    $("#goldJudge").style.display = "";
    [1, 2].forEach((t) => {
      $(`#gjName${t}`).textContent = state.teams[t - 1].name;
    });
    Sound.select();
  }

  function goldenSetResult(team, ok) {
    state.golden.results[team - 1] = ok;
    $$(`#gjRow${team} .gj-btn`).forEach((b) => {
      b.classList.toggle("on", (b.dataset.ok === "1") === ok);
    });
    Sound.click();
  }

  function goldenApply() {
    const g = state.golden;
    if (g.results.some((r) => r === null)) return toast("حدد نتيجة الفريقين أولاً");
    [0, 1].forEach((i) => {
      if (g.wagers[i] > 0) {
        state.teams[i].score += g.results[i] ? g.wagers[i] : -g.wagers[i];
        if (g.results[i]) state.teams[i].correct = (state.teams[i].correct || 0) + 1;
      }
    });
    state.goldenPlayed = true;
    state.golden = null;
    $("#goldenModal").classList.remove("active");
    refreshScores(true);
    // إحصائية الجولة الذهبية
    const st = getStats();
    st.golden = (st.golden || 0) + 1;
    saveStats(st);
    FX.confettiBurst(window.innerWidth / 2, window.innerHeight / 3, 50, 1.2);
    Sound.win();
    setTimeout(finish, 900);
  }

  // ===== شوط فاصل =====
  function startTieBreaker() {
    const pool = [];
    allCats().forEach((c) => c.questions.forEach((q) => pool.push(q)));
    const q = pool[(Math.random() * pool.length) | 0];
    state.current = { tie: true, points: 0, q: q.q, a: q.a };
    state.answerShown = false;

    $("#qCat").textContent = "⚡ شوط فاصل حاسم";
    $("#qPoints").textContent = "الفوز";
    $("#qText").textContent = q.q;
    $("#answerText").textContent = q.a;
    $("#answerBox").classList.remove("show");
    $("#awardRow").classList.remove("show");
    $("#stealNote").classList.remove("show");
    $("#showAnswerBtn").style.display = "";
    $("#pauseBtn").style.display = "";
    $("#awardT1").textContent = `${state.teams[0].name} ✓`;
    $("#awardT2").textContent = `${state.teams[1].name} ✓`;

    $("#qModal").classList.add("active");
    toast("🤝 تعادل! شوط فاصل يحسم الفوز ⚡");
    Sound.timeout();
    startTimer();
  }

  function endGame() {
    stopTimer();
    $("#qModal").classList.remove("active");
    clearSave();
    const [a, b] = state.teams;
    $("#fsName1").textContent = a.name;
    $("#fsName2").textContent = b.name;
    $("#fsScore1").textContent = a.score;
    $("#fsScore2").textContent = b.score;
    $("#fsCorrect1").textContent = `✅ ${a.correct || 0} إجابة صحيحة`;
    $("#fsCorrect2").textContent = `✅ ${b.correct || 0} إجابة صحيحة`;

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
      winner = "🤝 تعادل!";
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
      setTimeout(() => toast(`🏅 إنجاز جديد: ${fresh[0].name}`), 1400);
    }

    show("result");
  }

  function playAgain() {
    clearSave();
    state.selectedCats = [];
    state.cats = [];
    state.current = null;
    $$(".cat-tile.selected").forEach((t) => t.classList.remove("selected"));
    updateCounter();
    show("setup");
    Sound.click();
  }

  function home() {
    if (state.cats.length && !allDone()) saveGame();
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
      if (!snap) return;
      state.teams = snap.teams;
      state.turn = snap.turn;
      state.cats = snap.cats;
      Object.assign(state.settings, snap.settings || {});
      state.teamColors = snap.teamColors || state.teamColors;
      state.goldenPlayed = !!snap.goldenPlayed;
      document.documentElement.style.setProperty("--team1", state.teamColors[0]);
      document.documentElement.style.setProperty("--team2", state.teamColors[1]);
      buildBoard();
      refreshScores();
      show("board");
      Sound.open();
    } catch {
      toast("تعذّر الاستكمال");
    }
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
  }
  function renderEditorList() {
    const list = $("#editorList");
    list.innerHTML = "";
    CATEGORIES.forEach((c) => {
      const it = document.createElement("div");
      it.className = "ed-item";
      it.innerHTML = `<span>${c.icon} ${c.name}</span><span class="lock">🔒</span>`;
      list.appendChild(it);
    });
    customCats.forEach((c, i) => {
      const it = document.createElement("div");
      it.className = "ed-item";
      it.innerHTML = `<span>${c.icon} ${c.name}</span><span class="del">🗑</span>`;
      it.querySelector("span").addEventListener("click", () => loadIntoForm(i));
      it.querySelector(".del").addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`حذف "${c.name}"؟`)) {
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
      <input class="q" type="text" placeholder="السؤال" />
      <input class="a" type="text" placeholder="الإجابة" />
      <span class="rm">✕</span>`;
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
    const ok = [200, 400, 600].every((p) => questions.filter((x) => x.points === p).length >= 2);
    if (!ok) return toast("سؤالان على الأقل لكل قيمة (200/400/600)");
    const cat = { id: "c_" + Date.now(), name, icon, questions, custom: true };
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
    a.download = "jam3a-categories.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("⬇️ تم التصدير");
  }
  function importData(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error();
        customCats = customCats.concat(data);
        saveCustom();
        renderEditorList();
        toast("⬆️ تم الاستيراد");
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
    $("#soundBtn").textContent = state.settings.sound ? "🔊" : "🔇";
    saveSettings();
    if (state.settings.sound) Sound.select();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      $("#fsBtn").textContent = "🗗";
    } else {
      document.exitFullscreen?.();
      $("#fsBtn").textContent = "⛶";
    }
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
    const sw = THEME_SWATCH[THEMES[state.themeIndex]] || "#e9b949";

    // خلفية
    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#131829");
    bg.addColorStop(1, "#0c0f1a");
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // إطار
    c.strokeStyle = sw;
    c.lineWidth = 8;
    c.strokeRect(40, 40, W - 80, H - 80);

    c.textAlign = "center";
    c.fillStyle = sw;
    c.font = "900 90px Tajawal, Arial";
    c.fillText("جمعة", W / 2, 200);

    c.fillStyle = "#aeb4c7";
    c.font = "700 40px Tajawal, Arial";
    c.fillText("نتيجة المباراة", W / 2, 270);

    // الفائز
    let winLine = a.score === b.score ? "🤝 تعادل" : "🏆 " + (a.score > b.score ? a.name : b.name);
    c.fillStyle = "#f3d27a";
    c.font = "900 70px Tajawal, Arial";
    c.fillText(winLine, W / 2, 430);

    // الفرق والنقاط
    function teamBox(name, score, color, y) {
      c.fillStyle = "#1a2138";
      roundRect(c, 140, y, W - 280, 150, 24);
      c.fill();
      c.fillStyle = color;
      c.font = "800 50px Tajawal, Arial";
      c.fillText(name, W / 2, y + 65);
      c.fillStyle = "#f3d27a";
      c.font = "900 80px Tajawal, Arial";
      c.fillText(score, W / 2, y + 135);
    }
    teamBox(a.name, a.score, "#3aa0ff", 540);
    teamBox(b.name, b.score, "#ff5d73", 730);

    c.fillStyle = "#8a90a8";
    c.font = "700 34px Tajawal, Arial";
    c.fillText("العب الآن • جمعة", W / 2, 980);

    cv.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "jam3a-result.png";
      link.click();
      URL.revokeObjectURL(url);
      toast("📸 تم حفظ صورة النتيجة");
    });
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
    state.themeIndex = +(localStorage.getItem(LS_THEME) || 0) % THEMES.length;
    applyTheme();
    applyLang(localStorage.getItem(LS_LANG) || "ar");

    FX.starfield("starfield");
    buildColorPickers();
    buildThemePicker();
    bindSettings();
    bindMusic();
    applySettingsToUI();
    buildMarquee();

    Auth.onChange(onUserChange);
    onUserChange(); // تحميل بيانات المستخدم الحالي

    $("#startBtn").addEventListener("click", start);

    $("#qModal").addEventListener("click", (e) => {
      if (e.target.id === "qModal" && state.current) {
        if (confirm("إغلاق السؤال بدون منح نقاط؟")) closeQuestion();
      }
    });
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
        if (state.current) closeQuestion();
        $$(".modal.active").forEach((m) => {
          if (m.id !== "qModal" && m.id !== "goldenModal") m.classList.remove("active");
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
    toggleSound, toggleFullscreen, cycleTheme, setTheme, toggleLang,
    openProfile, closeProfile, openAuth, closeAuth, googleLogin, guest,
    openHelp, closeHelp, shareResult,
    goldenShowQuestion, goldenReveal, goldenSetResult, goldenApply,
  };
})();

document.addEventListener("DOMContentLoaded", Game.init);
