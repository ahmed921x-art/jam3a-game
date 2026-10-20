/* ===========================================================
   بايو — مباراة «سين وجيم»: الإعداد ← اللوحة ← السؤال ← النتيجة
   الحالة كلها في MatchRules (match-logic.js)، وهذا الملف واجهة فقط.
   يعتمد على: Game (الفئات/الإحصائيات/الشاشات)، Sound، FX، I18N، Auth.
   =========================================================== */
const Match = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const L = (ar, en) => (typeof I18N !== "undefined" && I18N.lang === "en" ? en : ar);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const R = MatchRules;

  const COLORS = ["#9fe0ec", "#e8949d", "#c3e813", "#e4a6f7", "#f9e09b", "#ffb36b"];
  const LS_PREFS = "bio_match_prefs";
  const COUNTS = [3, 4, 5, 6]; // عدد الفئات في اللوحة

  const cfg = {
    mode: "teams",
    sides: [
      { name: "", color: COLORS[0], players: [] },
      { name: "", color: COLORS[1], players: [] },
    ],
    selected: [],
    count: 6,
    values: 200,
    timer: 30,
    stealTimer: 15,
    steal: "full",
    penalty: "none",
    clip: 0,
    first: "random",
    filter: "all",
    search: "",
  };

  let m = null; // حالة المباراة الحالية
  let undoStack = [];
  const clock = { id: null, left: 0, total: 0, paused: false, endAt: 0, stage: "", question: "" };
  let blur = 0; // تشويش الصورة الحالي
  let busy = false; // يمنع النقر المزدوج أثناء الحركة

  /* ---------------- تخزين ---------------- */
  const storeKey = () => (typeof Auth !== "undefined" ? Auth.key("match") : "bio_match");
  const timerKey = () => storeKey() + ":timer";
  function timerSnapshot() {
    if (!m || m.phase !== "question" || !m.current || clock.total <= 0 ||
        clock.stage !== m.current.stage || clock.question !== `${m.current.ci}:${m.current.ri}`) return null;
    return {
      stage: clock.stage,
      question: clock.question,
      left: clock.paused ? clock.left : R.clockRemaining(clock.endAt, Date.now(), clock.total),
    };
  }
  function saveTimer() {
    try {
      const snapshot = timerSnapshot();
      if (snapshot) localStorage.setItem(timerKey(), JSON.stringify(snapshot));
      else localStorage.removeItem(timerKey());
    } catch {}
  }
  function save() {
    try {
      if (!m) {
        localStorage.removeItem(storeKey());
        localStorage.removeItem(timerKey());
      }
      else {
        localStorage.setItem(storeKey(), JSON.stringify({ m, undoStack: undoStack.slice(-10) }));
        if (m.phase === "done") localStorage.removeItem(timerKey());
        else saveTimer();
      }
    } catch {}
  }
  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey()));
      if (!raw || !R.validate(raw.m)) return null;
      try { raw.timer = JSON.parse(localStorage.getItem(timerKey())) || raw.timer || null; }
      catch { raw.timer = raw.timer || null; }
      return raw;
    } catch {
      return null;
    }
  }
  function savePrefs() {
    const { filter, search, ...keep } = cfg;
    try { localStorage.setItem(LS_PREFS, JSON.stringify(keep)); } catch {}
  }
  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(LS_PREFS));
      if (!p || typeof p !== "object") return;
      if (["teams", "solo"].includes(p.mode)) cfg.mode = p.mode;
      if (Array.isArray(p.sides) && p.sides.length === 2)
        cfg.sides = p.sides.map((s, i) => ({
          name: typeof s.name === "string" ? s.name.slice(0, 24) : "",
          color: COLORS.includes(s.color) ? s.color : COLORS[i],
          players: Array.isArray(s.players) ? s.players.filter((x) => typeof x === "string").slice(0, 8) : [],
        }));
      if (Array.isArray(p.selected)) cfg.selected = p.selected.filter((x) => typeof x === "string").slice(0, 6);
      if (COUNTS.includes(p.count)) cfg.count = p.count;
      if ([100, 200, 300, 500].includes(p.values)) cfg.values = p.values;
      if ([0, 15, 30, 45, 60].includes(p.timer)) cfg.timer = p.timer;
      if ([10, 15, 20].includes(p.stealTimer)) cfg.stealTimer = p.stealTimer;
      if (["off", "full", "half"].includes(p.steal)) cfg.steal = p.steal;
      if (["none", "half", "full"].includes(p.penalty)) cfg.penalty = p.penalty;
      if ([0, 5, 8, 12, 20, -1].includes(p.clip)) cfg.clip = p.clip;
      if (["random", "0", "1"].includes(p.first)) cfg.first = p.first;
    } catch {}
  }

  /* ---------------- أدوات ---------------- */
  const cats = () => Game.categories();
  const catById = (id) => cats().find((c) => c.id === id);
  const toast = (msg) => Game.toast(msg);
  const sideLabel = (i) => (cfg.mode === "solo" ? L(i ? "اللاعب الثاني" : "اللاعب الأول", i ? "Player two" : "Player one") : L(i ? "الفريق الثاني" : "الفريق الأول", i ? "Team two" : "Team one"));
  const sideName = (i) => (m ? m.sides[i].name : cfg.sides[i].name.trim() || sideLabel(i));
  function seg(id, value, options, label) {
    return `<div class="seg seg-sm" data-key="${id}" role="group" aria-label="${esc(label)}">${options
      .map(([v, t]) => `<button type="button" data-v="${esc(v)}" class="${String(v) === String(value) ? "on" : ""}" aria-pressed="${String(v) === String(value)}">${t}</button>`)
      .join("")}</div>`;
  }
  function typesOf(cat) {
    const set = new Set(cat.questions.map((q) => q.type || "text"));
    return ["image", "audio", "video"].filter((t) => set.has(t));
  }
  const TYPE_ICON = { image: "🖼️", audio: "🎵", video: "🎬" };
  const groupOf = (c) => (c.custom ? "custom" : c.group || "general");
  // ترتيب المجموعات في صفحة الإعداد: [المعرّف، الرمز، الاسم، الاسم بالإنجليزي]
  const GROUPS = [
    ["gaming", "🎮", "ألعاب فيديو", "Video games"],
    ["anime", "🎌", "أنمي", "Anime"],
    ["cartoon", "📺", "كرتون زمان", "Classic cartoons"],
    ["bio", "🧬", "أحياء وعلوم", "Science"],
    ["kuwait", "🇰🇼", "الكويت", "Kuwait"],
    ["general", "🎯", "معلومات عامة", "General"],
    ["custom", "✏️", "فئاتي", "Mine"],
  ];

  /* ====================================================
     الإعداد
     ==================================================== */
  function openSetup() {
    FX.pauseBackground(false);
    if (typeof Sound !== "undefined") Sound.select();
    stopClock();
    $("#mqModal").classList.remove("active");
    renderSetup();
    Game.showScreen("matchSetupScreen");
  }

  function renderSetup() {
    const el = $("#matchSetupScreen");
    const saved = loadSaved();
    el.innerHTML = `
      <div class="page-head">
        <button class="icon-btn" type="button" data-act="home" aria-label="${esc(L("رجوع", "Back"))}"><svg class="ic flip-ltr"><use href="#i-back" /></svg></button>
        <div>
          <h1 class="page-title">${esc(L("مباراة جديدة", "New match"))}</h1>
          <p class="page-sub">${esc(L("لوحة فئات ونقاط على طريقة سين وجيم: كل فريق يختار خانة بدوره.", "A category-and-points board: teams take turns picking a square."))}</p>
        </div>
      </div>
          ${saved ? `<div class="resume-box" style="display:flex"><div class="rb-text"><span class="rb-ic" aria-hidden="true">${saved.m.phase === "done" ? "🏆" : "⏸"}</span><span>${esc(saved.m.phase === "done" ? L(`نتيجة المباراة الأخيرة: ${saved.m.sides[0].name} ضد ${saved.m.sides[1].name}`, `Last match result: ${saved.m.sides[0].name} vs ${saved.m.sides[1].name}`) : L(`عندك مباراة لم تكتمل: ${saved.m.sides[0].name} ضد ${saved.m.sides[1].name}`, `Unfinished match: ${saved.m.sides[0].name} vs ${saved.m.sides[1].name}`))}</span></div><div class="rb-actions"><button class="btn btn-gold btn-sm" type="button" data-act="resume">${esc(saved.m.phase === "done" ? L("اعرض النتيجة", "View result") : L("أكمل المباراة", "Resume"))}</button><button class="btn btn-ghost btn-sm" type="button" data-act="discard">${esc(L("احذفها", "Discard"))}</button></div></div>` : ""}

      <section class="card setup-card">
        <h2><span class="sc-n">1</span><span>${esc(L("نوع المباراة", "Match type"))}</span></h2>
        <div class="ms-modes" role="group" aria-label="${esc(L("نوع المباراة", "Match type"))}">
          <button type="button" class="ms-mode ${cfg.mode === "teams" ? "on" : ""}" data-mode="teams" aria-pressed="${cfg.mode === "teams"}"><span class="mm-ic">👥</span><b>${esc(L("فريق ضد فريق", "Team vs team"))}</b><small>${esc(L("أسماء للفريقين وعدة لاعبين في كل فريق", "Named teams with several players each"))}</small></button>
          <button type="button" class="ms-mode ${cfg.mode === "solo" ? "on" : ""}" data-mode="solo" aria-pressed="${cfg.mode === "solo"}"><span class="mm-ic">🧑‍🤝‍🧑</span><b>${esc(L("واحد ضد واحد", "1 vs 1"))}</b><small>${esc(L("لاعبان فرديان وجهاً لوجه", "Two players head to head"))}</small></button>
        </div>
        <div class="ms-sides">${[0, 1].map(sideCard).join("")}</div>
      </section>

      <section class="card setup-card">
        <div class="card-head-row">
          <h2><span class="sc-n">2</span><span>${esc(L("فئات اللوحة", "Board categories"))}</span></h2>
          <button class="btn btn-ghost btn-sm" type="button" data-act="editor"><svg class="ic"><use href="#i-edit" /></svg><span>${esc(L("فئاتي الخاصة", "My categories"))}</span></button>
        </div>
        <div class="cats-bar">
          <p class="hint">${esc(L("كم فئة في اللوحة؟ كل فئة فيها 6 أسئلة: سؤالان لكل قيمة (فرصة لكل فريق).", "How many categories? Each has 6 questions: two per value (one chance per team)."))}</p>
          ${seg("count", cfg.count, COUNTS.map((n) => [n, String(n)]), "categories")}
          <span class="count-pill" id="msCount" aria-live="polite"></span>
          <button class="btn btn-ghost btn-sm" type="button" data-act="clearCats">${esc(L("إلغاء الكل", "Clear"))}</button>
        </div>
        <div class="cat-tools">
          <label class="search-field"><svg class="ic"><use href="#i-search" /></svg><span class="sr-only">${esc(L("ابحث عن فئة", "Search categories"))}</span><input id="msSearch" type="search" value="${esc(cfg.search)}" placeholder="${esc(L("ابحث عن فئة…", "Search categories…"))}" autocomplete="off" /></label>
          <div class="filter-chips" id="msFilters" role="group">${[
            ["all", L("الكل", "All")],
            ...GROUPS.map(([g, ic, ar, en]) => [g, ic + " " + L(ar, en)]),
            ["selected", "✓ " + L("المختارة", "Selected")],
          ].map(([g, t]) => `<button type="button" class="fchip ${cfg.filter === g ? "on" : ""}" data-filter="${g}" aria-pressed="${cfg.filter === g}">${esc(t)}</button>`).join("")}</div>
        </div>
        <div class="cats-grid ms-cats" id="msCats"></div>
        <p class="empty-state" id="msEmpty" hidden>${esc(L("لا توجد فئات مطابقة.", "No matching categories."))}</p>
      </section>

      <section class="card setup-card">
        <h2><span class="sc-n">3</span><span>${esc(L("قواعد المباراة", "Match rules"))}</span></h2>
        <div class="settings-list">
          ${ruleRow(L("💯 قيم النقاط", "💯 Point values"), L("سهل / متوسط / صعب — وكل قيمة لها خانتان.", "Easy / medium / hard — two squares each."), seg("values", cfg.values, Object.entries(R.VALUES).map(([k, v]) => [k, v.join(" · ")]), "points"))}
          ${ruleRow(L("⏱️ وقت الإجابة", "⏱️ Answer time"), L("عدّ تنازلي للفريق صاحب الدور. «بلا» = بدون مؤقت.", "Countdown for the answering team."), seg("timer", cfg.timer, [[0, L("بلا", "Off")], [15, "15"], [30, "30"], [45, "45"], [60, "60"]], "timer"))}
          ${ruleRow(L("⚡ السرقة", "⚡ Steal"), L("بعد الإجابة الخاطئة يحق للفريق الآخر محاولة السرقة (قبل كشف الإجابة).", "After a wrong answer the other side may steal (before the reveal)."), seg("steal", cfg.steal, [["off", L("إيقاف", "Off")], ["full", L("كامل النقاط", "Full points")], ["half", L("نصف النقاط", "Half points")]], "steal"))}
          ${cfg.steal !== "off" ? ruleRow(L("⏳ وقت السرقة", "⏳ Steal time"), L("ثوانٍ للفريق الذي يحاول السرقة.", "Seconds for the stealing side."), seg("stealTimer", cfg.stealTimer, [[10, "10"], [15, "15"], [20, "20"]], "steal time")) : ""}
          ${ruleRow(L("🎧 طول مقطع الأغنية", "🎧 Song snippet length"), L("«تلقائي» = 12 ثانية للسهل، 8 للمتوسط، 5 للصعب، ومن مكان عشوائي آمن في كل مرة. المقدّم يقدر يزيد 5 ثوانٍ.", "Auto = 12s easy, 8s medium, 5s hard, from a random safe spot each time. The host can add 5s."), seg("clip", cfg.clip, [[0, L("تلقائي", "Auto")], [5, "5"], [8, "8"], [12, "12"], [20, "20"], [-1, L("كامل", "Full")]], "clip"))}
          ${ruleRow(L("➖ خصم الإجابة الخاطئة", "➖ Wrong-answer penalty"), L("يُخصم من الفريق صاحب الدور إذا أخطأ.", "Deducted from the answering side on a wrong answer."), seg("penalty", cfg.penalty, [["none", L("بلا خصم", "None")], ["half", L("نصف", "Half")], ["full", L("كامل", "Full")]], "penalty"))}
          ${ruleRow(L("🎲 من يبدأ؟", "🎲 Who starts?"), "", seg("first", cfg.first, [["random", L("قرعة", "Random")], ["0", esc(sideName(0))], ["1", esc(sideName(1))]], "first"))}
        </div>
      </section>

      <div class="start-bar ms-start">
        <p class="sb-status" id="msStatus" aria-live="polite"></p>
        <button type="button" class="btn btn-gold btn-lg" data-act="start"><svg class="ic"><use href="#i-play" /></svg><span>${esc(L("ابدأ المباراة", "Start match"))}</span></button>
      </div>
      <p class="ms-classic"><button class="link-btn" type="button" data-act="classic">${esc(L("أو العب الوضع الكلاسيكي (200/400/600 مع وسائل المساعدة)", "Or play classic mode (200/400/600 with lifelines)"))}</button></p>`;
    renderCats();
  }

  function ruleRow(t, d, control) {
    return `<div class="set-row"><div class="set-text"><span class="set-t">${esc(t)}</span>${d ? `<span class="set-d">${esc(d)}</span>` : ""}</div>${control}</div>`;
  }

  function sideCard(i) {
    const s = cfg.sides[i];
    const team = cfg.mode === "teams";
    return `<div class="ms-side" style="--c:${s.color}" data-side="${i}">
      <label class="ms-lbl" for="msName${i}">${esc(team ? L(`اسم ${i ? "الفريق الثاني" : "الفريق الأول"}`, `Team ${i ? "two" : "one"} name`) : L(`اسم ${i ? "اللاعب الثاني" : "اللاعب الأول"}`, `Player ${i ? "two" : "one"} name`))}</label>
      <input id="msName${i}" class="ms-input" data-name="${i}" type="text" maxlength="24" autocomplete="off" value="${esc(s.name)}" placeholder="${esc(team ? L(i ? "مثال: الصقور" : "مثال: النسور", i ? "e.g. Falcons" : "e.g. Eagles") : L(i ? "مثال: سارة" : "مثال: أحمد", i ? "e.g. Sara" : "e.g. Ahmed"))}" />
      <div class="ms-colors" role="group" aria-label="${esc(L("اللون", "Color"))}">${COLORS.map((c) => `<button type="button" class="swatch ${c === s.color ? "on" : ""}" data-color="${c}" data-side="${i}" style="background:${c}" aria-label="${c}" aria-pressed="${c === s.color}"></button>`).join("")}</div>
      ${team ? `<div class="ms-players">
        <span class="mini-label">${esc(L("اللاعبون (اختياري، يتناوبون على الإجابة)", "Players (optional, rotate each turn)"))}</span>
        <div class="ms-chips">${s.players.map((p, pi) => `<span class="ms-chip">${esc(p)}<button type="button" data-rm="${i}:${pi}" aria-label="${esc(L("حذف", "Remove"))} ${esc(p)}">✕</button></span>`).join("")}</div>
        <div class="ms-add"><input type="text" maxlength="20" data-player="${i}" placeholder="${esc(L("اسم لاعب ثم Enter", "Player name, then Enter"))}" autocomplete="off" /><button type="button" class="btn btn-ghost btn-sm" data-addp="${i}"><svg class="ic"><use href="#i-plus" /></svg></button></div>
      </div>` : ""}
    </div>`;
  }

  function renderCats() {
    const grid = $("#msCats");
    if (!grid) return;
    const norm = (s) => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
    const q = norm(cfg.search);
    const list = cats().filter((c) => {
      const g = groupOf(c);
      const okG = cfg.filter === "all" || (cfg.filter === "selected" ? cfg.selected.includes(c.id) : g === cfg.filter);
      return okG && (!q || norm(c.name).includes(q));
    });
    const tile = (c) => {
        const ok = R.canFill(c);
        const on = cfg.selected.includes(c.id);
        const types = typesOf(c);
        return `<button type="button" class="cat-tile ms-tile ${on ? "selected" : ""} ${ok ? "" : "is-off"}" data-cat="${esc(c.id)}" aria-pressed="${on}" ${ok ? "" : 'aria-disabled="true"'}>
          <span class="check">✓</span>
          <div class="cat-thumb">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy" />` : `<span class="ic">${esc(c.icon || "📁")}</span>`}</div>
          <span class="nm">${esc(c.name)}</span>
          <span class="cat-count">${types.map((t) => `<span class="ms-type" title="${t}">${TYPE_ICON[t]}</span>`).join("")} ${c.questions.length} ${esc(L("سؤال", "Qs"))}</span>
        </button>`;
    };
    // «الكل» بدون بحث: كل مجموعة في قسم بعنوانها (ألعاب، كرتون وأنمي، أحياء…)
    if (cfg.filter === "all" && !q) {
      grid.innerHTML = GROUPS.map(([g, ic, ar, en]) => {
        const items = list.filter((c) => groupOf(c) === g);
        return items.length ? `<h3 class="ms-group">${ic} ${esc(L(ar, en))} <small>${items.length}</small></h3>${items.map(tile).join("")}` : "";
      }).join("");
    } else grid.innerHTML = list.map(tile).join("");
    $("#msEmpty").hidden = list.length > 0;
    updateCount();
  }

  function validSelection() {
    return cfg.selected.map(catById).filter((c) => c && R.canFill(c));
  }
  function updateCount() {
    const n = validSelection().length;
    $("#msCount").textContent = `${n} / ${cfg.count}`;
    const st = $("#msStatus");
    st.textContent = n < cfg.count ? L(`اختر ${cfg.count - n} فئات أخرى`, `Pick ${cfg.count - n} more`) : L(`جاهزين! ${n} فئات × 6 أسئلة`, `Ready! ${n} categories × 6 questions`);
    $(".ms-start").classList.toggle("ready", n === cfg.count);
  }

  function addPlayer(i) {
    const inp = $(`[data-player="${i}"]`);
    const v = inp.value.trim();
    if (!v) return;
    if (cfg.sides[i].players.length >= 8) return toast(L("الحد 8 لاعبين لكل فريق", "Max 8 players per team"));
    cfg.sides[i].players.push(v.slice(0, 20));
    savePrefs();
    renderSideCards(i);
    $(`[data-player="${i}"]`).focus();
  }
  function renderSideCards(focusSide) {
    $(".ms-sides").innerHTML = [0, 1].map(sideCard).join("");
    if (focusSide !== undefined) $(`[data-player="${focusSide}"]`)?.focus();
  }

  function onSetupClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "home") return Game.goLanding();
    if (act === "resume") return resume();
    if (act === "discard") {
      if (!confirm(L("حذف المباراة المحفوظة؟", "Discard the saved match?"))) return;
      m = null;
      try { localStorage.removeItem(storeKey()); } catch {}
      try { localStorage.removeItem(timerKey()); } catch {}
      return renderSetup();
    }
    if (act === "editor") return Game.openEditor();
    if (act === "classic") return Game.playClick();
    if (act === "start") return start();
    if (act === "clearCats") {
      cfg.selected = [];
      savePrefs();
      return renderCats();
    }
    if (b.dataset.mode) {
      cfg.mode = b.dataset.mode;
      savePrefs();
      Sound.click();
      return renderSetup();
    }
    if (b.dataset.color) {
      const i = +b.dataset.side;
      const other = cfg.sides[1 - i];
      if (other.color === b.dataset.color) other.color = cfg.sides[i].color; // لا يتشابه اللونان
      cfg.sides[i].color = b.dataset.color;
      savePrefs();
      Sound.click();
      return renderSideCards();
    }
    if (b.dataset.rm) {
      const [i, pi] = b.dataset.rm.split(":").map(Number);
      cfg.sides[i].players.splice(pi, 1);
      savePrefs();
      return renderSideCards();
    }
    if (b.dataset.addp !== undefined) return addPlayer(+b.dataset.addp);
    if (b.dataset.filter) {
      cfg.filter = b.dataset.filter;
      $$("#msFilters .fchip").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", x === b);
      });
      return renderCats();
    }
    if (b.dataset.cat) {
      const id = b.dataset.cat;
      const c = catById(id);
      if (!c) return;
      if (!R.canFill(c)) return toast(L("هذه الفئة تحتاج سؤالين على الأقل لكل قيمة", "This category needs two questions per value"));
      const pos = cfg.selected.indexOf(id);
      if (pos > -1) cfg.selected.splice(pos, 1);
      else {
        if (validSelection().length >= cfg.count) return toast(L(`اخترت ${cfg.count} فئات — ألغِ وحدة أو غيّر العدد`, `You already picked ${cfg.count} — remove one or change the count`));
        cfg.selected.push(id);
        Sound.select();
      }
      b.classList.toggle("selected", pos === -1);
      b.setAttribute("aria-pressed", pos === -1);
      savePrefs();
      if (cfg.filter === "selected") renderCats();
      return updateCount();
    }
    const segEl = b.closest(".seg[data-key]");
    if (segEl) {
      const k = segEl.dataset.key;
      const v = b.dataset.v;
      cfg[k] = ["count", "values", "timer", "stealTimer", "clip"].includes(k) ? +v : v;
      if (k === "count" && cfg.selected.length > cfg.count) cfg.selected = cfg.selected.slice(0, cfg.count);
      savePrefs();
      Sound.click();
      if (k === "steal") return renderSetup();
      if (k === "count") renderCats();
      $$("button", segEl).forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-pressed", x === b);
      });
    }
  }

  function onSetupInput(e) {
    const t = e.target;
    if (t.id === "msSearch") {
      cfg.search = t.value;
      renderCats();
    } else if (t.dataset.name !== undefined) {
      cfg.sides[+t.dataset.name].name = t.value;
      savePrefs();
      // تحديث أسماء زر «من يبدأ؟»
      const fs = $('.seg[data-key="first"]');
      if (fs) [0, 1].forEach((i) => (fs.querySelector(`[data-v="${i}"]`).textContent = sideName(i)));
    }
  }
  function onSetupKey(e) {
    if (e.key === "Enter" && e.target.dataset.player !== undefined) {
      e.preventDefault();
      addPlayer(+e.target.dataset.player);
    }
  }

  /* ====================================================
     بدء المباراة
     ==================================================== */
  function start() {
    Sound.unlock();
    const chosen = validSelection();
    if (chosen.length !== cfg.count) return toast(L(`اختر ${cfg.count} فئات بالضبط`, `Pick exactly ${cfg.count} categories`));
    // اللاعبون المكتوبون بدون Enter يُضافون تلقائياً
    $$("[data-player]").forEach((inp) => {
      const v = inp.value.trim();
      if (v) cfg.sides[+inp.dataset.player].players.push(v.slice(0, 20));
    });
    let board;
    try {
      board = R.buildBoard(chosen, { values: cfg.values, random: true });
    } catch {
      return toast(L("بعض الفئات لا تحتوي أسئلة فريدة كافية؛ غيّر الاختيار", "Some categories lack enough unique questions"));
    }
    const sides = [0, 1].map((i) => ({
      name: cfg.sides[i].name.trim() || sideLabel(i),
      color: cfg.sides[i].color,
      players: cfg.mode === "teams" ? cfg.sides[i].players : [],
    }));
    const first = cfg.first === "random" ? (Math.random() < 0.5 ? 0 : 1) : +cfg.first;
    m = R.newMatch({ mode: cfg.mode, sides, board, first, rules: { timer: cfg.timer, stealTimer: cfg.stealTimer, steal: cfg.steal, penalty: cfg.penalty, clip: cfg.clip } });
    m.id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `bio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    undoStack = [];
    savePrefs();
    save();
    showBoard();
    Sound.open();
    toast(L(`🎲 يبدأ ${m.sides[m.turn].name}`, `🎲 ${m.sides[m.turn].name} starts`));
  }

  function resume() {
    const saved = loadSaved();
    if (!saved) return toast(L("المباراة المحفوظة غير صالحة", "Saved match is invalid"));
    m = saved.m;
    if (!m.id) m.id = `bio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    undoStack = Array.isArray(saved.undoStack) ? saved.undoStack.filter(R.validate) : [];
    showBoard();
    if (m.phase === "question") openQuestionUI(true, saved.timer);
    if (m.phase === "done") showResult();
  }

  /* ====================================================
     اللوحة
     ==================================================== */
  // تحميل صور اللوحة مسبقاً (صور الشخصيات واللقطات كبيرة) حتى تظهر فوراً عند فتح السؤال
  const prefetched = new Map();
  function prefetchBoard() {
    m.board.forEach((col) =>
      col.cells.forEach((cell) => {
        if (cell.status !== "open") return;
        [cell.q.img, cell.q.aImg].forEach((src) => {
          if (!src || prefetched.has(src)) return;
          const im = new Image();
          im.decoding = "async";
          im.fetchPriority = "low";
          im.src = src;
          prefetched.set(src, im);
        });
      })
    );
  }

  function showBoard() {
    FX.pauseBackground(true); // خلفية ثابتة طوال المباراة: أخف على أجهزة البوث
    prefetchBoard();
    if (m.board.some((c) => c.cells.some((x) => x.q.yt))) loadYT().catch(() => {}); // مشغّل YouTube جاهز قبل أول سؤال
    renderBoard();
    Game.showScreen("matchBoardScreen", true);
  }

  function renderBoard() {
    const el = $("#matchBoardScreen");
    const n = m.board.length;
    const done = R.total(m) - R.remaining(m);
    el.style.setProperty("--c0", m.sides[0].color);
    el.style.setProperty("--c1", m.sides[1].color);
    el.innerHTML = `
      <header class="game-header">
        <div class="gh-side">
          <button class="gh-brand" type="button" data-act="home" aria-label="${esc(L("حفظ والعودة للرئيسية", "Save and go home"))}"><img src="assets/logo-mark.png" alt="" width="336" height="313" /></button>
          <span class="progress-chip" title="${esc(L("الأسئلة المنتهية", "Questions played"))}">${done} / ${R.total(m)}</span>
        </div>
        <div class="gh-side">
          <button class="mode-toggle" type="button" data-act="mode" aria-label="${esc(L("الوضع الفاتح أو الداكن", "Light or dark mode"))}"><span class="mt-knob"><svg class="ic mt-sun"><use href="#i-sun" /></svg><svg class="ic mt-moon"><use href="#i-moon" /></svg></span></button>
          <button class="gh-btn" type="button" data-act="undo" ${undoStack.length ? "" : "disabled"} title="${esc(L("تراجع عن آخر سؤال", "Undo last question"))}"><svg class="ic"><use href="#i-reset" /></svg><span class="gh-lbl">${esc(L("تراجع", "Undo"))}</span></button>
          <button class="gh-btn" type="button" data-act="end"><svg class="ic"><use href="#i-flag" /></svg><span class="gh-lbl">${esc(L("إنهاء", "End"))}</span></button>
          <button class="gh-btn" type="button" data-act="home"><svg class="ic"><use href="#i-exit" /></svg><span class="gh-lbl">${esc(L("خروج", "Exit"))}</span></button>
        </div>
      </header>
      <div class="mb-scores">${[0, 1].map(scoreCard).join('<div class="mb-vs" aria-hidden="true">VS</div>')}</div>
      <p class="mb-turn" aria-live="polite"><span class="mb-dot" style="background:${m.sides[m.turn].color}"></span>${esc(L(`دور ${m.sides[m.turn].name} يختار خانة`, `${m.sides[m.turn].name} picks a square`))}${R.currentPlayer(m, m.turn) ? ` · <b>${esc(R.currentPlayer(m, m.turn))}</b>` : ""}</p>
      <div class="mb-scroll"><div class="mb-board" style="--cols:${n}" role="grid" aria-label="${esc(L("لوحة الأسئلة", "Question board"))}">
        ${m.board.map((c, ci) => `<div class="mb-col" role="row">
          <div class="mb-head" role="columnheader">${c.img ? `<img src="${esc(c.img)}" alt="" />` : `<span class="mb-ic">${esc(c.icon)}</span>`}<span class="mb-name">${esc(c.name)}</span></div>
          ${R.TIERS.map((_, t) => `<div class="mb-tier">${c.cells.map((cell, ri) => (cell.tier === t ? cellHTML(cell, ci, ri) : "")).join("")}</div>`).join("")}
        </div>`).join("")}
      </div></div>
      <p class="mb-hint">${esc(L("اضغط على قيمة لفتح السؤال. الخانة المستخدمة لا تُفتح مرة ثانية.", "Tap a value to open its question. Played squares can't be reopened."))}</p>`;
  }

  function scoreCard(i) {
    const s = m.sides[i];
    const on = m.turn === i;
    return `<div class="mb-team ${on ? "turn" : ""}" style="--c:${s.color}">
      <div class="mbt-top"><span class="mbt-name">${esc(s.name)}</span>${on ? `<span class="mbt-badge">${esc(L("الدور", "Turn"))}</span>` : ""}</div>
      <div class="mbt-score" data-score="${i}">${s.score}</div>
      ${s.players.length ? `<div class="mbt-players">${s.players.map((p, pi) => `<span class="${pi === s.playerIdx % s.players.length ? "now" : ""}">${esc(p)}</span>`).join("")}</div>` : ""}
      <details class="score-adjust"><summary>${esc(L("تصحيح النقاط", "Adjust score"))}</summary><div class="sa-btns">
        <button type="button" class="btn btn-ghost btn-sm" data-adj="${i}:-${m.board[0].cells[0].points}">−${m.board[0].cells[0].points}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-adj="${i}:${m.board[0].cells[0].points}">+${m.board[0].cells[0].points}</button>
        ${m.phase === "board" && !on ? `<button type="button" class="btn btn-ghost btn-sm" data-turn="${i}">${esc(L("اجعله صاحب الدور", "Give turn"))}</button>` : ""}
      </div></details>
    </div>`;
  }

  function cellHTML(cell, ci, ri) {
    const label = `${m.board[ci].name} ${cell.points}`;
    if (cell.status === "used") {
      const w = cell.winner;
      return `<div class="mb-cell used ${w === null ? "none" : ""}" role="gridcell" style="${w !== null ? `--w:${m.sides[w].color}` : ""}" aria-label="${esc(label)} — ${esc(w === null ? L("لم يأخذها أحد", "no one scored") : m.sides[w].name)}">
        <span class="mbc-pts">${cell.points}</span><span class="mbc-who">${w === null ? "✕" : esc(m.sides[w].name)}</span></div>`;
    }
    const t = cell.q.type;
    return `<button type="button" class="mb-cell" role="gridcell" data-ci="${ci}" data-ri="${ri}" aria-label="${esc(label)}">${cell.points}${t !== "text" ? `<span class="mbc-type" aria-hidden="true">${TYPE_ICON[t]}</span>` : ""}</button>`;
  }

  function onBoardClick(e) {
    const b = e.target.closest("button");
    if (!b || !m) return;
    const act = b.dataset.act;
    if (act === "home") return goHome();
    if (act === "mode") return Game.toggleMode();
    if (act === "undo") return undo();
    if (act === "end") return endEarly();
    if (b.dataset.adj) {
      const [i, d] = b.dataset.adj.split(":").map(Number);
      m = R.adjust(m, i, d);
      save();
      Sound.click();
      const el = $(`[data-score="${i}"]`);
      if (el) el.textContent = m.sides[i].score;
      return;
    }
    if (b.dataset.turn !== undefined) {
      m = R.setTurn(m, +b.dataset.turn);
      save();
      return renderBoard();
    }
    if (b.dataset.ci !== undefined) openCell(+b.dataset.ci, +b.dataset.ri);
  }

  function openCell(ci, ri) {
    if (busy || m.phase !== "board") return;
    const cell = m.board[ci]?.cells[ri];
    if (!cell || cell.status !== "open") return;
    undoStack.push(JSON.parse(JSON.stringify(m)));
    if (undoStack.length > 30) undoStack.shift();
    m = R.open(m, ci, ri);
    save();
    Sound.unlock();
    Sound.open();
    openQuestionUI(false);
  }

  function undo() {
    if (!undoStack.length || m.phase === "question") return;
    if (!confirm(L("التراجع عن آخر سؤال؟ ستعود الخانة مفتوحة وتُلغى نقاطها.", "Undo the last question? The square reopens and its points are removed."))) return;
    m = undoStack.pop();
    save();
    renderBoard();
    toast(L("↩️ تم التراجع", "↩️ Undone"));
  }

  function endEarly() {
    if (!confirm(L("إنهاء المباراة الآن وعرض النتيجة؟", "End the match now and show results?"))) return;
    m = R.finish(m);
    showResult();
  }

  function goHome() {
    stopMedia();
    save();
    stopClock();
    $("#mqModal").classList.remove("active");
    FX.pauseBackground(false);
    Game.goLanding();
  }

  /* ====================================================
     شاشة السؤال
     ==================================================== */
  const cur = () => m && m.current;
  const curCell = () => m.board[m.current.ci].cells[m.current.ri];

  function ytId(url) {
    const x = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
    return x ? x[1] : "";
  }

  const EQ = "<i></i>".repeat(5);
  const ytOf = (q) => q.yt || ytId(q.video || "");
  function controlsHTML(withArt) {
    return `<div class="mq-audio ${withArt ? "" : "compact"}" id="mqCtrls" role="group" aria-label="${esc(L("مشغّل المقطع", "Media player"))}">
        ${withArt ? `<div class="mqa-art" aria-hidden="true"><span class="mqa-eq">${EQ}</span></div>` : ""}
        <div class="mqa-row">
          <button type="button" class="mqa-btn big" data-act="play" aria-label="${esc(L("تشغيل", "Play"))}"><svg class="ic"><use href="#i-play" /></svg></button>
          <button type="button" class="mqa-btn" data-act="replay" aria-label="${esc(L("إعادة من البداية", "Replay"))}"><svg class="ic"><use href="#i-reset" /></svg></button>
          <div class="mqa-bar" data-act="seek" role="slider" tabindex="0" aria-label="${esc(L("موضع المقطع", "Position"))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="mqaFill"></span></div>
          <span class="mqa-time" id="mqaTime">0:00</span>
        </div>
        <div class="mqa-row2">
          <label class="mqa-vol"><svg class="ic"><use href="#i-sound" /></svg><span class="sr-only">${esc(L("مستوى الصوت", "Volume"))}</span><input type="range" id="mqaVol" min="0" max="1" step="0.05" value="0.9" /></label>
          <button type="button" class="btn btn-ghost btn-sm" data-act="more" hidden>➕ ${esc(L("5 ثوانٍ", "5 sec"))}</button>
          <button type="button" class="btn btn-ghost btn-sm mqa-pin" data-act="pin" title="${esc(L("اجعل المقطع يبدأ من هذه الثانية دائماً (للمقدّم، يُحفظ على هذا الجهاز)", "Always start this clip here (host, saved on this device)"))}">📌 ${esc(L("ابدأ من هنا", "Start here"))}</button>
        </div>
        <p class="mqa-err" id="mqaErr" hidden></p>
      </div>`;
  }

  function mediaHTML(q) {
    if (q.type === "image") {
      return `<div class="mq-imgwrap"><img id="mqImg" src="${esc(q.img)}" alt="${esc(L("صورة السؤال", "Question image"))}" /></div>
        <button type="button" class="btn btn-ghost btn-sm mq-unblur" data-act="unblur"><svg class="ic"><use href="#i-search" /></svg><span>${esc(L("خفّف التشويش", "Reduce blur"))}</span></button>`;
    }
    const yt = (q.type === "audio" || q.type === "video") && ytOf(q);
    if (yt) {
      // قبل الكشف: الصوت مغطّى ببطاقة، والفيديو مقصوص الحواف (يخفي العنوان) ولا يُنقر
      return `<div class="mq-yt ${q.type === "audio" ? "is-audio" : "is-video"}" id="mqYt">
          <div class="mq-yt-frame"><div id="mqYtPlayer"></div></div>
          <div class="mq-yt-shield" aria-hidden="true"></div>
          ${q.type === "audio" ? `<div class="mq-yt-cover" aria-hidden="true"><span class="mqa-eq">${EQ}</span><span>🎧 ${esc(L("استمعوا وخمّنوا", "Listen and guess"))}</span></div>` : `<div class="mq-yt-pause" aria-hidden="true"><b>▶</b><span>${esc(L("اضغطوا تشغيل وخمّنوا اللعبة", "Press play and guess the game"))}</span></div>`}
          <div class="mq-yt-msg" id="mqYtMsg">${esc(L("جاري تحميل المقطع من YouTube…", "Loading from YouTube…"))}</div>
        </div>${controlsHTML(false)}`;
    }
    if (q.type === "audio") return `<audio id="mqAudio" preload="auto" src="${esc(q.audio)}"></audio>${controlsHTML(true)}`;
    if (q.type === "video") return `<div class="mq-video"><video id="mqVideo" preload="metadata" playsinline src="${esc(q.video)}"></video></div>${controlsHTML(false)}`;
    return "";
  }

  function openQuestionUI(restored, savedTimer = null) {
    const c = cur();
    if (!c) return;
    specCache = null; // مقطع عشوائي جديد لكل سؤال
    const cell = curCell();
    const q = cell.q;
    const col = m.board[c.ci];
    blur = q.type === "image" && Number.isFinite(q.blur) ? q.blur : 0; // الصور واضحة افتراضياً
    const box = $("#mqBox");
    box.innerHTML = `
      <header class="mq-head">
        <div class="mq-tags"><span class="q-cat-badge">${esc(col.icon)} ${esc(col.name)}</span><span class="q-points-badge">${cell.points} ${esc(L("نقطة", "pts"))}</span></div>
        <div class="mq-clock" id="mqClock" hidden>
          <svg viewBox="0 0 44 44" aria-hidden="true"><circle class="ring-bg" cx="22" cy="22" r="19"/><circle class="ring-fg" id="mqRing" cx="22" cy="22" r="19"/></svg>
          <span class="mq-time" id="mqTime" role="timer">0</span>
          <button type="button" class="tp-btn" data-act="pause" id="mqPause" aria-label="${esc(L("إيقاف المؤقت أو متابعته", "Pause or resume timer"))}"><svg class="ic"><use href="#i-pause" /></svg></button>
          <button type="button" class="tp-btn" data-act="restart" aria-label="${esc(L("إعادة المؤقت", "Restart timer"))}"><svg class="ic"><use href="#i-reset" /></svg></button>
        </div>
        <button type="button" class="gh-btn mq-close" data-act="board" hidden><svg class="ic"><use href="#i-grid" /></svg><span class="gh-lbl">${esc(L("اللوحة", "Board"))}</span></button>
      </header>
      <div class="mq-turn" id="mqTurn"></div>
      <div class="mq-result" id="mqResult" aria-live="polite"></div>
      <div class="mq-stage" id="mqStage" data-type="${q.type}">
        ${q.q ? `<div class="mq-q">${esc(q.q)}</div>` : ""}
        ${mediaHTML(q)}
        <div class="mq-answer" id="mqAnswer" hidden>
          <span class="view-label">${esc(L("الإجابة الصحيحة", "Correct answer"))}</span>
          <div class="a-text">${esc(q.a)}</div>
          ${q.aImg && q.aImg !== q.img ? `<img class="mq-aimg" src="${esc(q.aImg)}" alt="" />` : ""}
        </div>
      </div>
      <footer class="mq-controls" id="mqControls"></footer>
      <div class="mq-mini">${[0, 1].map((i) => `<span class="mqm" style="--c:${m.sides[i].color}"><b>${esc(m.sides[i].name)}</b><span data-mscore="${i}">${m.sides[i].score}</span></span>`).join("")}</div>`;
    FX.pauseBackground(true);
    bindMedia(q);
    applyBlur();
    $("#mqModal").classList.add("active");
    updateQuestionUI(restored);
    if (!restored) startStageClock();
    else if (c.stage !== "resolved") startStageClock(true, savedTimer);
    box.scrollTop = 0;
  }

  function applyBlur() {
    const img = $("#mqImg");
    if (!img) return;
    const shown = cur() && cur().revealed;
    img.style.filter = shown || !blur ? "none" : `blur(${blur}px)`;
    const zoom = curCell().q.zoom || 1;
    img.style.transformOrigin = curCell().q.focus || "50% 50%";
    img.style.transform = shown ? "none" : `scale(${Math.max(zoom, blur ? 1.06 : 1)})`;
    const btn = $(".mq-unblur");
    if (btn) btn.hidden = shown || blur <= 0;
  }

  function updateQuestionUI(restored) {
    const c = cur();
    if (!c) return;
    const cell = curCell();
    const ans = m.sides[c.team];
    const player = c.stage === "answer" ? R.currentPlayer(m, c.team) : "";
    const turn = $("#mqTurn");
    turn.style.setProperty("--c", ans.color);
    if (c.stage === "answer") turn.innerHTML = `<span class="mqt-l">${esc(L("يجاوب الآن", "Answering"))}</span><b>${esc(ans.name)}</b>${player ? `<span class="mqt-p">🎤 ${esc(player)}</span>` : ""}`;
    else if (c.stage === "steal") turn.innerHTML = `<span class="mqt-l">⚡ ${esc(L("فرصة سرقة", "Steal chance"))}</span><b>${esc(ans.name)}</b><span class="mqt-p">+${R.stealValue(m, cell.points)}</span>`;
    else turn.innerHTML = `<span class="mqt-l">${esc(L("انتهى السؤال", "Question resolved"))}</span>`;
    turn.classList.toggle("steal", c.stage === "steal");
    turn.classList.toggle("done", c.stage === "resolved");

    $("#mqAnswer").hidden = !c.revealed;
    applyBlur();
    if (c.revealed) $("#mqStage").classList.add("revealed");

    const res = $("#mqResult");
    if (c.stage === "resolved" && c.result) {
      const r = c.result;
      res.className = "mq-result show " + (r.team === null ? "none" : "win");
      res.style.setProperty("--c", r.team === null ? "" : m.sides[r.team].color);
      res.innerHTML = r.team === null
        ? `❌ ${esc(L("لم يحصل أحد على النقاط", "No one scored"))}${c.penalty ? ` · ${esc(m.sides[c.chooser].name)} −${c.penalty}` : ""}`
        : `${r.how === "steal" ? "⚡ " + esc(L("سرقة ناجحة!", "Steal!")) : "✅"} <b>${esc(m.sides[r.team].name)}</b> +${r.pts}${c.penalty ? ` · ${esc(m.sides[c.chooser].name)} −${c.penalty}` : ""}`;
    } else if (c.stage === "steal") {
      res.className = "mq-result show wrong";
      res.innerHTML = `✘ ${esc(L(`${m.sides[c.chooser].name} أخطأ`, `${m.sides[c.chooser].name} missed`))}${c.penalty ? ` (−${c.penalty})` : ""}`;
    } else {
      res.className = "mq-result";
      res.textContent = "";
    }

    const ctr = $("#mqControls");
    const canSteal = m.rules.steal !== "off" && c.stage === "answer" && !c.revealed;
    if (c.stage === "resolved") {
      ctr.innerHTML = `<button type="button" class="corner-btn c-green mq-big" data-act="board"><svg class="ic"><use href="#i-grid" /></svg><span>${esc(L("ارجع للوحة", "Back to board"))}</span> <kbd class="kbd-inline">Enter</kbd></button>`;
      $(".mq-close").hidden = false;
    } else {
      $(".mq-close").hidden = true;
      ctr.innerHTML = `
        ${c.revealed ? "" : `<button type="button" class="corner-btn c-dark" data-act="reveal" title="${esc(canSteal ? L("كشف الإجابة الآن يلغي فرصة السرقة", "Revealing now cancels the steal chance") : "")}"><span>👁 ${esc(L("اكشف الإجابة", "Reveal answer"))}</span> <kbd class="kbd-inline">Space</kbd></button>`}
        <button type="button" class="corner-btn c-green" data-act="right"><svg class="ic"><use href="#i-check" /></svg><span>${esc(c.stage === "steal" ? L("سرقة ناجحة", "Steal correct") : L("إجابة صحيحة", "Correct"))}</span> <kbd class="kbd-inline">1</kbd></button>
        <button type="button" class="corner-btn c-red" data-act="wrong"><svg class="ic"><use href="#i-x" /></svg><span>${esc(L("إجابة خاطئة", "Wrong"))}</span> <kbd class="kbd-inline">2</kbd></button>
        <button type="button" class="corner-btn c-ghost" data-act="skip"><span>⏭ ${esc(L("ولا أحد", "No one"))}</span> <kbd class="kbd-inline">0</kbd></button>
        ${canSteal ? `<p class="mq-note">${esc(L("الإجابة الخاطئة تفتح فرصة سرقة للطرف الآخر. كشف الإجابة قبلها يلغي السرقة.", "A wrong answer opens a steal for the other side; revealing first cancels it."))}</p>` : ""}`;
    }
    $$("[data-mscore]").forEach((el) => (el.textContent = m.sides[+el.dataset.mscore].score));
  }

  function act(fn, sound) {
    if (busy) return;
    try {
      m = fn(m);
    } catch {
      return;
    }
    save();
    if (sound) sound();
    updateQuestionUI();
  }

  function onQuestionClick(e) {
    const b = e.target.closest("button, [data-act='seek']");
    if (!b || !cur()) return;
    const a = b.dataset.act;
    if (a === "reveal") return reveal();
    if (a === "right") return judge(true);
    if (a === "wrong") return judge(false);
    if (a === "skip") return skip();
    if (a === "board") return closeQuestion();
    if (a === "pause") return togglePause();
    if (a === "restart") return startStageClock();
    if (a === "unblur") {
      blur = Math.max(0, Math.round(blur * 0.55) - 2);
      applyBlur();
      return Sound.click();
    }
    if (a === "play") return togglePlay();
    if (a === "more") return moreClip();
    if (a === "pin") return pinStart();
    if (a === "replay") return replay();
    if (a === "seek") return seek(e, b);
  }

  function reveal() {
    const c = cur();
    if (!c || c.revealed) return;
    act(R.reveal, () => Sound.select());
    pauseClock(true);
  }

  function judge(ok) {
    const c = cur();
    if (!c || c.stage === "resolved") return;
    const before = c.stage;
    act((x) => R.judge(x, ok));
    const now = cur();
    if (now.stage === "steal") {
      Sound.wrong();
      startStageClock();
      toast(L(`⚡ فرصة سرقة: ${m.sides[now.team].name}`, `⚡ ${m.sides[now.team].name} can steal`));
    } else afterResolve(before);
  }

  function skip() {
    const c = cur();
    if (!c || c.stage === "resolved") return;
    act(R.skip);
    afterResolve(c.stage);
  }

  function afterResolve() {
    stopClock();
    $("#mqClock").hidden = true;
    const r = cur().result;
    if (r.team !== null) {
      Sound.correct();
      const el = $("#mqResult").getBoundingClientRect();
      FX.confettiBurst(el.left + el.width / 2, el.top + el.height / 2, r.how === "steal" ? 60 : 40, 1.1);
    } else Sound.wrong();
    applyBlur();
  }

  function closeQuestion() {
    const c = cur();
    if (!c || c.stage !== "resolved" || busy) return;
    stopMedia();
    stopClock();
    m = R.close(m);
    save();
    $("#mqModal").classList.remove("active");
    $("#mqBox").innerHTML = "";
    if (m.phase === "done") {
      busy = true;
      renderBoard();
      setTimeout(() => {
        busy = false;
        showResult();
      }, 700);
      return;
    }
    renderBoard();
    Sound.click();
  }

  /* ---------------- المؤقت ---------------- */
  function startStageClock(paused = false, savedTimer = null) {
    stopClock();
    const c = cur();
    if (!c || c.stage === "resolved") return;
    const total = c.stage === "steal" ? m.rules.stealTimer : m.rules.timer;
    const box = $("#mqClock");
    if (!total) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.classList.remove("timeup");
    clock.total = total;
    clock.stage = c.stage;
    clock.question = `${c.ci}:${c.ri}`;
    const restored = paused ? R.restoredClock(savedTimer, total, clock.stage, clock.question) : null;
    clock.left = restored ? restored.left : total;
    clock.paused = paused || c.revealed || clock.left === 0;
    clock.endAt = Date.now() + clock.left * 1000;
    paintClock();
    if (clock.left > 0) clock.id = setInterval(tickClock, 250);
    else box.classList.add("timeup");
    saveTimer();
  }
  function tickClock() {
    if (clock.paused) {
      clock.endAt = Date.now() + clock.left * 1000;
      return;
    }
    const left = R.clockRemaining(clock.endAt, Date.now(), clock.total);
    if (left !== clock.left) {
      clock.left = left;
      paintClock();
      saveTimer();
      if (left > 0 && left <= 5) Sound.tickLow();
      if (left === 0) {
        clearInterval(clock.id);
        clock.id = null;
        $("#mqClock")?.classList.add("timeup");
        Sound.timeout();
        toast(L("⏰ انتهى الوقت! احكم على الإجابة", "⏰ Time's up! Judge the answer"));
      }
    }
  }
  function paintClock() {
    const t = $("#mqTime");
    if (!t) return;
    t.textContent = clock.left;
    const ring = $("#mqRing");
    const C = 2 * Math.PI * 19;
    ring.style.strokeDasharray = C;
    ring.style.strokeDashoffset = C * (1 - clock.left / clock.total);
    $("#mqClock").classList.toggle("low", clock.left <= 5);
    const p = $("#mqPause");
    if (p) p.innerHTML = `<svg class="ic"><use href="#${clock.paused ? "i-play" : "i-pause"}" /></svg>`;
  }
  function togglePause() {
    if (!clock.id) return;
    clock.paused = !clock.paused;
    clock.endAt = Date.now() + clock.left * 1000;
    paintClock();
    saveTimer();
  }
  function pauseClock(v) {
    if (!clock.id) return;
    clock.paused = v;
    clock.endAt = Date.now() + clock.left * 1000;
    paintClock();
    saveTimer();
  }
  function stopClock() {
    if (clock.id) clearInterval(clock.id);
    clock.id = null;
    clock.total = 0;
    clock.stage = "";
    clock.question = "";
  }

  /* ---------------- الوسائط ---------------- */
  // مشغّل موحّد: ملف صوت/فيديو أو YouTube بنفس الأزرار (تشغيل/إيقاف/إعادة/تقديم/صوت)
  let media = null;
  let ytApi = null;
  function loadYT() {
    if (window.YT && YT.Player) return Promise.resolve();
    if (!ytApi)
      ytApi = new Promise((resolve, reject) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prev) prev();
          resolve();
        };
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.onerror = () => {
          ytApi = null;
          reject(new Error("yt"));
        };
        document.head.appendChild(s);
      });
    return ytApi;
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function paintMedia() {
    if (!media || !$("#mqCtrls")) return;
    const s = media.start;
    const len = Math.max(0.01, media.end() - s);
    const pos = Math.max(0, Math.min(len, media.time() - s));
    $("#mqaFill").style.width = (pos / len) * 100 + "%";
    $(".mqa-bar").setAttribute("aria-valuenow", Math.round((pos / len) * 100));
    $("#mqaTime").textContent = media.end() ? `${fmt(pos)} / ${fmt(len)}` : fmt(pos);
    const playing = media.playing();
    $("#mqStage")?.classList.toggle("playing", playing);
    const b = $('#mqCtrls [data-act="play"]');
    if (b.dataset.on !== String(playing)) {
      b.dataset.on = playing;
      b.innerHTML = `<svg class="ic"><use href="#${playing ? "i-pause" : "i-play"}" /></svg>`;
      b.setAttribute("aria-label", playing ? L("إيقاف مؤقت", "Pause") : L("تشغيل", "Play"));
    }
  }

  function mediaError(msg, yt, start) {
    const e = $("#mqaErr");
    if (!e) return;
    e.hidden = false;
    e.innerHTML = esc(msg) + (yt ? ` <a href="https://www.youtube.com/watch?v=${esc(yt)}&t=${Math.floor(start || 0)}s" target="_blank" rel="noopener">${esc(L("افتحه على YouTube ↗", "Open on YouTube ↗"))}</a>` : "");
    const box = $("#mqYtMsg");
    if (box) box.textContent = msg;
  }

  // spec = { start, limit } — limit = نهاية المقطع المسموع (0 = حتى آخر الملف)
  function elementAdapter(el, spec) {
    const a = {
      start: spec.start,
      limit: spec.limit,
      end: () => (a.limit > a.start ? a.limit : el.duration || 0),
      time: () => el.currentTime,
      playing: () => !el.paused,
      play: () => {
        if (a.limit && el.currentTime >= a.limit - 0.05) el.currentTime = a.start;
        return el.play();
      },
      pause: () => el.pause(),
      seek: (t) => (el.currentTime = t),
      volume: (v) => (el.volume = v),
      destroy: () => {
        el.pause();
        el.removeAttribute("src");
        el.load(); // يوقف التحميل
      },
    };
    el.muted = !!spec.mute;
    el.addEventListener("loadedmetadata", () => {
      if (a.start) el.currentTime = a.start;
      paintMedia();
    });
    el.addEventListener("timeupdate", () => {
      if (a.limit && el.currentTime >= a.limit) el.pause();
      paintMedia();
    });
    ["play", "pause", "ended"].forEach((ev) => el.addEventListener(ev, paintMedia));
    el.addEventListener("error", () => {
      if (el.isConnected && el.getAttribute("src")) mediaError(L("تعذّر تحميل المقطع. تأكد من وجود الملف.", "The clip couldn't be loaded."));
    });
    return a;
  }

  function ytError(code) {
    if (code === 101 || code === 150) return L("صاحب المقطع منع تشغيله خارج YouTube.", "The owner blocked playback outside YouTube.");
    if (code === 100) return L("المقطع محذوف أو خاص.", "The video was removed or is private.");
    return L("تعذّر تشغيل المقطع.", "The clip couldn't be played.");
  }

  function ytAdapter(id, spec) {
    let p = null;
    let ready = false;
    let dead = false;
    let poll = null;
    let warming = false; // تحميل مسبق صامت حتى لا يعلق المقطع أول ما يشتغل
    const a = {
      start: spec.start,
      limit: spec.limit,
      vol: 0.9,
      wantPlay: false,
      end: () => (a.limit > a.start ? a.limit : ready ? p.getDuration() : 0),
      time: () => (ready ? p.getCurrentTime() : a.start),
      playing: () => ready && !warming && p.getPlayerState() === 1,
      play: () => {
        if (!ready) return void (a.wantPlay = true);
        const t = p.getCurrentTime();
        if (warming || p.getPlayerState() === 0 || t < a.start - 1 || (a.limit && t >= a.limit - 0.3)) p.seekTo(a.start, true);
        warming = false;
        if (spec.mute) p.mute();
        else p.unMute();
        p.setVolume(Math.round(a.vol * 100));
        p.playVideo();
      },
      pause: () => ready && p.pauseVideo(),
      seek: (t) => ready && p.seekTo(t, true),
      volume: (v) => {
        a.vol = v;
        if (ready) p.setVolume(Math.round(v * 100));
      },
      destroy: () => {
        dead = true;
        clearInterval(poll);
        try {
          if (p) p.destroy();
        } catch {}
      },
    };
    const tick = () => {
      // نهاية المقطع المسموح (مثلاً 12 ثانية من الشارة)
      if (ready && !warming && a.limit && p.getPlayerState() === 1 && p.getCurrentTime() >= a.limit) p.pauseVideo();
      paintMedia();
    };
    loadYT()
      .then(() => {
        if (dead || !$("#mqYtPlayer")) return;
        p = new YT.Player("mqYtPlayer", {
          host: "https://www.youtube-nocookie.com",
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: { start: Math.floor(a.start), controls: 0, disablekeyboard: 1, fs: 0, iv_load_policy: 3, rel: 0, playsinline: 1, cc_load_policy: 0, origin: location.origin },
          events: {
            onReady: () => {
              if (dead) return;
              ready = true;
              try {
                p.unloadModule("captions"); // الترجمة التلقائية قد تكشف الإجابة
              } catch {}
              $("#mqYt")?.classList.add("ready");
              poll = setInterval(tick, 200);
              if (a.wantPlay) a.play();
              else {
                warming = true;
                p.mute();
                p.playVideo();
              }
              paintMedia();
            },
            onStateChange: (e) => {
              if (warming && e.data === 1) {
                // صار عنده مخزون كافٍ: نوقف ونرجع للبداية بصمت
                warming = false;
                p.pauseVideo();
                p.seekTo(a.start, true);
                if (!spec.mute) p.unMute();
                p.setVolume(Math.round(a.vol * 100));
              }
              paintMedia();
            },
            onError: (e) => mediaError(ytError(e.data), id, a.start),
          },
        });
      })
      .catch(() => mediaError(L("تعذّر الاتصال بـ YouTube. تأكد من الإنترنت.", "Couldn't reach YouTube. Check the connection."), id, a.start));
    return a;
  }

  // بداية مقطع يثبّتها المقدّم بزر 📌 (تُحفظ على هذا الجهاز لكل أغنية)
  const LS_STARTS = "bio_clip_starts";
  const mediaKey = (q) => ytOf(q) || q.audio || q.video || "";
  function clipStarts() {
    try {
      const v = JSON.parse(localStorage.getItem(LS_STARTS));
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  }
  // طول المقطع حسب الصعوبة: الأغاني (CLIP_AUTO 12/8/5) ومقاطع اللعب والمشاهد (أطول للسهل)
  const VIDEO_AUTO = [30, 20, 12];
  let specCache = null; // نفس المقطع لو أُعيد رسم السؤال (تغيير اللغة مثلاً)
  function clipSpec(q) {
    const c = cur();
    const k = c ? `${c.ci}:${c.ri}:${mediaKey(q)}` : "";
    if (specCache && specCache.k === k) return specCache.spec;
    const tier = (c && curCell().tier) || 0;
    const rule = m.rules.clip;
    let len;
    if (q.type === "audio") len = rule === -1 ? 0 : rule > 0 ? rule : R.CLIP_AUTO[tier];
    else len = q.win ? VIDEO_AUTO[tier] : q.end && q.end > (q.start || 0) ? q.end - (q.start || 0) : 0;
    // مكان عشوائي آمن كل مرة (من فترات win)، إلا إذا ثبّت المقدّم بداية بزر 📌
    const saved = clipStarts()[mediaKey(q)];
    let start = q.start || 0;
    if (Number.isFinite(saved)) start = saved;
    else if (q.win && len) ({ start, len } = R.pickClip(q, len));
    const spec = { start, limit: len ? start + len : 0, clip: q.type === "audio" ? len : 0, mute: !!q.mute };
    specCache = { k, spec };
    return spec;
  }
  function moreClip() {
    if (!media || !media.limit) return;
    media.limit += 5;
    toast(L("➕ 5 ثوانٍ إضافية", "➕ 5 more seconds"));
    Promise.resolve(media.play()).catch(() => {});
  }
  function pinStart() {
    if (!media || !cur()) return;
    const q = curCell().q;
    const t = Math.max(0, Math.round(media.time() * 10) / 10);
    const all = clipStarts();
    all[mediaKey(q)] = t;
    try { localStorage.setItem(LS_STARTS, JSON.stringify(all)); } catch {}
    const len = media.limit ? media.limit - media.start : 0;
    media.start = t;
    if (len) media.limit = t + len;
    specCache = null;
    paintMedia();
    toast(L(`📌 هذا المقطع صار يبدأ من ${fmt(t)} (محفوظ على هذا الجهاز)`, `📌 This clip now starts at ${fmt(t)} (saved on this device)`));
  }

  function bindMedia(q) {
    media = null;
    const yt = (q.type === "audio" || q.type === "video") && ytOf(q);
    const el = $("#mqAudio") || $("#mqVideo");
    const spec = clipSpec(q);
    if (yt) media = ytAdapter(yt, spec);
    else if (el) media = elementAdapter(el, spec);
    if (!media) return;
    const more = $('#mqCtrls [data-act="more"]');
    if (more) more.hidden = !spec.limit || !spec.clip;
    if (spec.mute) $(".mqa-vol").hidden = true; // مشهد صامت
    const vol = $("#mqaVol");
    media.volume(+vol.value);
    vol.addEventListener("input", () => media && media.volume(+vol.value));
    $(".mqa-bar").addEventListener("keydown", (e) => {
      if (!media || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      const dir = (e.key === "ArrowRight") === (document.dir !== "rtl") ? 1 : -1;
      media.seek(Math.max(media.start, Math.min(media.end() || Infinity, media.time() + dir * 5)));
      paintMedia();
    });
    paintMedia();
  }
  function togglePlay() {
    if (!media) return;
    if (media.playing()) media.pause();
    else Promise.resolve(media.play()).catch(() => mediaError(L("تعذّر التشغيل.", "Playback failed.")));
  }
  function replay() {
    if (!media) return;
    media.seek(media.start);
    Promise.resolve(media.play()).catch(() => {});
  }
  function seek(e, bar) {
    if (!media || !media.end()) return;
    const r = bar.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    if (getComputedStyle(bar).direction === "rtl") f = 1 - f;
    media.seek(media.start + Math.max(0, Math.min(1, f)) * (media.end() - media.start));
    paintMedia();
  }
  function stopMedia() {
    if (media) media.destroy();
    media = null;
  }

  /* ====================================================
     النتيجة
     ==================================================== */
  function showResult() {
    stopMedia();
    stopClock();
    $("#mqModal").classList.remove("active");
    const w = R.winner(m);
    const [a, b] = m.sides;
    if (!m.recorded) {
      Game.recordMatch({ id: m.id, t1: a.name, s1: a.score, t2: b.name, s2: b.score, questions: R.total(m) - R.remaining(m) });
      m.recorded = true;
    }
    save();
    const el = $("#matchResultScreen");
    const statLine = (s) => `<div class="mr-stats"><span>✅ ${s.correct} ${esc(L("صحيحة", "correct"))}</span><span>⚡ ${s.steals} ${esc(L("سرقة", "steals"))}</span><span>✘ ${s.wrong} ${esc(L("خاطئة", "wrong"))}</span></div>`;
    const order = w === 1 ? [1, 0] : [0, 1];
    el.innerHTML = `
      <div class="result-wrap">
        <div class="result-card mr-card">
          <div class="trophy hex" aria-hidden="true">${w === -1 ? "🤝" : "🏆"}</div>
          <h1 class="result-h">${esc(L("انتهت المباراة", "Match over"))}</h1>
          <p class="winner-label">${esc(w === -1 ? L("النتيجة", "Result") : L("الفائز", "Winner"))}</p>
          <div class="winner-name" aria-live="polite" style="${w === -1 ? "" : `color:${m.sides[w].color}`}">${w === -1 ? esc(L("تعادل!", "It's a draw!")) : "🎉 " + esc(m.sides[w].name)}</div>
          <div class="mr-scores">${order.map((i, rank) => {
            const s = m.sides[i];
            return `<div class="mr-team ${w === i ? "win" : ""}" style="--c:${s.color}">
              <span class="mr-rank">${w === -1 ? "=" : rank + 1}</span>
              <div class="mr-name">${esc(s.name)}</div>
              <div class="mr-score">${s.score}</div>
              ${statLine(s)}
              ${s.players.length ? `<div class="mbt-players">${s.players.map((p) => `<span>${esc(p)}</span>`).join("")}</div>` : ""}
            </div>`;
          }).join("")}</div>
          <p class="mr-sum">${esc(L(`لُعب ${R.total(m) - R.remaining(m)} من ${R.total(m)} سؤالاً في ${m.board.length} فئات`, `${R.total(m) - R.remaining(m)} of ${R.total(m)} questions played across ${m.board.length} categories`))}</p>
          <div class="modal-actions">
            <button class="btn btn-gold btn-lg" type="button" data-act="rematch"><svg class="ic"><use href="#i-reset" /></svg><span>${esc(L("مباراة جديدة بنفس الإعدادات", "Rematch, same settings"))}</span></button>
            <button class="btn btn-ghost btn-lg" type="button" data-act="setup"><svg class="ic"><use href="#i-edit" /></svg><span>${esc(L("غيّر الفرق والفئات", "Change teams & categories"))}</span></button>
          </div>
          <button class="link-btn" type="button" data-act="home"><svg class="ic"><use href="#i-home" /></svg><span>${esc(L("الصفحة الرئيسية", "Home"))}</span></button>
        </div>
      </div>`;
    Game.showScreen("matchResultScreen");
    if (w === -1) Sound.draw();
    else {
      Sound.win();
      FX.celebrate();
    }
  }

  function onResultClick(e) {
    const b = e.target.closest("button");
    if (!b) return;
    const a = b.dataset.act;
    m = null;
    save();
    if (a === "rematch") return start();
    if (a === "setup") return openSetup();
    if (a === "home") return Game.goLanding();
  }

  /* ====================================================
     لوحة المفاتيح + التهيئة
     ==================================================== */
  function onKey(e) {
    if (!$("#mqModal").classList.contains("active") || !cur()) return;
    if (e.target.closest("input, textarea, select")) return;
    const c = cur();
    // Space = كشف الإجابة دائماً (حتى لو كان التركيز على زر التشغيل)
    if (e.key === " " && !c.revealed) {
      e.preventDefault();
      reveal();
    } else if (e.key === "1" && c.stage !== "resolved") judge(true);
    else if (e.key === "2" && c.stage !== "resolved") judge(false);
    else if (e.key === "0" && c.stage !== "resolved") skip();
    else if (e.key === "Enter" && c.stage === "resolved") {
      e.preventDefault();
      closeQuestion();
    } else if (e.key === "Escape" && c.stage === "resolved") closeQuestion();
  }

  function init() {
    loadPrefs();
    $("#matchSetupScreen").addEventListener("click", onSetupClick);
    $("#matchSetupScreen").addEventListener("input", onSetupInput);
    $("#matchSetupScreen").addEventListener("keydown", onSetupKey);
    $("#matchBoardScreen").addEventListener("click", onBoardClick);
    $("#matchResultScreen").addEventListener("click", onResultClick);
    $("#mqModal").addEventListener("click", onQuestionClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("i18n:change", () => {
      if ($("#matchSetupScreen").classList.contains("active")) renderSetup();
      else if (m && $("#matchBoardScreen").classList.contains("active")) {
        renderBoard();
        if (cur() && $("#mqModal").classList.contains("active")) updateQuestionUI();
      } else if (m && $("#matchResultScreen").classList.contains("active")) showResult();
    });
  }

  function refreshCats() {
    if ($("#matchSetupScreen").classList.contains("active")) renderCats();
  }

  return { init, openSetup, resume, refreshCats, hasSaved: () => !!loadSaved(), _state: () => m };
})();

document.addEventListener("DOMContentLoaded", () => Match.init());
