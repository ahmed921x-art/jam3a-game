/* ===========================================================
   سين جيم — منطق اللعبة
   =========================================================== */

const Game = (() => {
  // ---------- الحالة ----------
  const state = {
    teams: [
      { name: "الفريق الأول", score: 0 },
      { name: "الفريق الثاني", score: 0 },
    ],
    turn: 1, // 1 أو 2
    selectedCats: [], // مصفوفة كائنات الفئات (6)
    cats: [], // نسخة العمل مع حالة الخلايا
    current: null, // السؤال الحالي { catIndex, qIndex, points }
    timer: { id: null, left: 0, paused: false },
    multiplier: 1, // مضاعف النقاط للسؤال الحالي (لايف لاين)
    QUESTION_SECONDS: 60,
  };

  // وسائل المساعدة لكل فريق (تُستخدم مرة واحدة)
  const LIFELINES = [
    { id: "double", label: "نقطتك ونص", icon: "✖️" },
    { id: "steal", label: "جاوب واسرق", icon: "🥷" },
    { id: "phone", label: "اتصال بصديق", icon: "📞" },
  ];

  // ---------- اختصارات DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const screens = {
    setup: $("#setupScreen"),
    board: $("#boardScreen"),
    result: $("#resultScreen"),
  };

  function show(screen) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[screen].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ========================================================
  //  شاشة الإعداد
  // ========================================================
  function buildCatPicker() {
    const grid = $("#catsGrid");
    grid.innerHTML = "";
    CATEGORIES.forEach((cat, i) => {
      const tile = document.createElement("div");
      tile.className = "cat-tile";
      tile.dataset.index = i;
      tile.innerHTML = `
        <span class="check">✓</span>
        <span class="ic">${cat.icon}</span>
        <span class="nm">${cat.name}</span>`;
      tile.addEventListener("click", () => toggleCat(i, tile));
      grid.appendChild(tile);
    });
    updateCounter();
  }

  function toggleCat(index, tile) {
    const pos = state.selectedCats.indexOf(index);
    if (pos > -1) {
      state.selectedCats.splice(pos, 1);
      tile.classList.remove("selected");
    } else {
      if (state.selectedCats.length >= 6) {
        toast("اخترت 6 فئات بالفعل — أزل واحدة أولاً");
        return;
      }
      state.selectedCats.push(index);
      tile.classList.add("selected");
    }
    updateCounter();
  }

  function updateCounter() {
    $("#catCounter").textContent = `${state.selectedCats.length} / 6`;
  }

  function start() {
    if (state.selectedCats.length !== 6) {
      toast("اختر 6 فئات بالضبط للبدء");
      return;
    }
    // أسماء الفرق
    const n1 = $("#team1").value.trim() || "الفريق الأول";
    const n2 = $("#team2").value.trim() || "الفريق الثاني";
    state.teams[0] = { name: n1, score: 0, lifelines: cloneLifelines() };
    state.teams[1] = { name: n2, score: 0, lifelines: cloneLifelines() };
    state.turn = 1;

    // بناء نسخة العمل من الفئات بترتيب الاختيار
    state.cats = state.selectedCats.map((i) => {
      const c = CATEGORIES[i];
      return {
        name: c.name,
        icon: c.icon,
        questions: c.questions.map((q) => ({ ...q, done: false })),
      };
    });

    buildBoard();
    refreshScores();
    show("board");
  }

  function cloneLifelines() {
    return LIFELINES.map((l) => ({ ...l, used: false }));
  }

  // ========================================================
  //  اللوحة
  // ========================================================
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
        cell.className = "cell";
        cell.textContent = q.points;
        cell.dataset.ci = ci;
        cell.dataset.qi = qi;
        cell.addEventListener("click", () => openQuestion(ci, qi, cell));
        col.appendChild(cell);
      });

      board.appendChild(col);
    });

    renderLifelines();
  }

  function renderLifelines() {
    [1, 2].forEach((t) => {
      const box = $(`#t${t}Lifelines`);
      box.innerHTML = "";
      state.teams[t - 1].lifelines.forEach((l, li) => {
        const el = document.createElement("span");
        el.className = "lifeline" + (l.used ? " used" : "");
        el.textContent = `${l.icon} ${l.label}`;
        el.title = lifelineHint(l.id);
        el.addEventListener("click", () => useLifeline(t, li));
        box.appendChild(el);
      });
    });
  }

  function lifelineHint(id) {
    return {
      double: "النقاط القادمة لفريقك ×1.5",
      steal: "إن أخطأ الخصم، يمكن لفريقك السرقة",
      phone: "تمديد الوقت 30 ثانية إضافية",
    }[id];
  }

  function useLifeline(team, li) {
    const l = state.teams[team - 1].lifelines[li];
    if (l.used) return;

    // اتصال بصديق متاح فقط أثناء سؤال مفتوح
    if (l.id === "phone") {
      if (!state.current) {
        toast("استخدم (اتصال بصديق) أثناء عرض السؤال");
        return;
      }
      state.timer.left += 30;
      toast("📞 تمت إضافة 30 ثانية");
    }
    if (l.id === "double") {
      if (!state.current) {
        toast("استخدم (نقطتك ونص) أثناء عرض السؤال");
        return;
      }
      state.multiplier = 1.5;
      toast(`✖️ نقاط هذا السؤال ×1.5 لـ ${state.teams[team - 1].name}`);
    }
    if (l.id === "steal") {
      toast("🥷 السرقة مفعّلة — إن أخطأ الخصم تقدر تجاوب وتاخذ النقاط");
    }

    l.used = true;
    renderLifelines();
  }

  function setTurn(t) {
    state.turn = t;
    $("#teamCard1").classList.toggle("active", t === 1);
    $("#teamCard2").classList.toggle("active", t === 2);
  }

  function toggleTurn() {
    setTurn(state.turn === 1 ? 2 : 1);
  }

  function refreshScores() {
    $("#t1Name").textContent = state.teams[0].name;
    $("#t2Name").textContent = state.teams[1].name;
    $("#t1Score").textContent = state.teams[0].score;
    $("#t2Score").textContent = state.teams[1].score;
    setTurn(state.turn);
  }

  function adjust(team, delta) {
    state.teams[team - 1].score += delta;
    refreshScores();
  }

  // ========================================================
  //  نافذة السؤال
  // ========================================================
  function openQuestion(ci, qi, cell) {
    const q = state.cats[ci].questions[qi];
    if (q.done) return;

    state.current = { ci, qi, cell, points: q.points };
    state.multiplier = 1;

    $("#qCat").textContent = state.cats[ci].name;
    $("#qPoints").textContent = `${q.points} نقطة`;
    $("#qText").textContent = q.q;
    $("#answerText").textContent = q.a;
    $("#answerBox").classList.remove("show");
    $("#awardRow").classList.remove("show");
    $("#showAnswerBtn").style.display = "";

    // أسماء أزرار المنح
    $("#awardT1").textContent = `${state.teams[0].name} ✓`;
    $("#awardT2").textContent = `${state.teams[1].name} ✓`;

    $("#qModal").classList.add("active");
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.timer.left = state.QUESTION_SECONDS;
    state.timer.paused = false;
    paintTimer();
    state.timer.id = setInterval(() => {
      if (state.timer.paused) return;
      state.timer.left--;
      paintTimer();
      if (state.timer.left <= 0) {
        stopTimer();
        toast("⏰ انتهى الوقت!");
      }
    }, 1000);
  }

  function paintTimer() {
    const el = $("#timer");
    el.textContent = Math.max(0, state.timer.left);
    el.classList.toggle("low", state.timer.left <= 10);
  }

  function stopTimer() {
    if (state.timer.id) clearInterval(state.timer.id);
    state.timer.id = null;
  }

  function showAnswer() {
    state.timer.paused = true;
    $("#answerBox").classList.add("show");
    $("#showAnswerBtn").style.display = "none";
    $("#awardRow").classList.add("show");
  }

  function award(team) {
    const { ci, qi, cell, points } = state.current;

    if (team !== 0) {
      const gained = Math.round(points * state.multiplier);
      state.teams[team - 1].score += gained;
    }

    // علّم الخلية كمستخدمة
    state.cats[ci].questions[qi].done = true;
    cell.classList.add("done");
    cell.textContent = "✓";

    closeQuestion();
    refreshScores();

    // بدّل الدور تلقائياً للفريق الآخر
    setTurn(state.turn === 1 ? 2 : 1);

    if (allDone()) {
      setTimeout(finish, 600);
    }
  }

  function closeQuestion() {
    stopTimer();
    state.current = null;
    state.multiplier = 1;
    $("#qModal").classList.remove("active");
  }

  function allDone() {
    return state.cats.every((c) => c.questions.every((q) => q.done));
  }

  // ========================================================
  //  النتيجة
  // ========================================================
  function finish() {
    stopTimer();
    $("#qModal").classList.remove("active");
    const [a, b] = state.teams;
    $("#fsName1").textContent = a.name;
    $("#fsName2").textContent = b.name;
    $("#fsScore1").textContent = a.score;
    $("#fsScore2").textContent = b.score;

    let winner;
    if (a.score > b.score) winner = `🎉 الفائز: ${a.name}`;
    else if (b.score > a.score) winner = `🎉 الفائز: ${b.name}`;
    else winner = "🤝 تعادل!";
    $("#winnerName").textContent = winner;

    show("result");
  }

  function playAgain() {
    state.selectedCats = [];
    state.cats = [];
    state.current = null;
    document.querySelectorAll(".cat-tile.selected").forEach((t) => t.classList.remove("selected"));
    updateCounter();
    show("setup");
  }

  // ========================================================
  //  التهيئة
  // ========================================================
  function init() {
    buildCatPicker();
    $("#startBtn").addEventListener("click", start);
    // إغلاق النافذة بالضغط على الخلفية
    $("#qModal").addEventListener("click", (e) => {
      if (e.target.id === "qModal") {
        if (confirm("إغلاق السؤال بدون منح نقاط؟")) closeQuestion();
      }
    });
    // ESC لإغلاق السؤال
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.current) closeQuestion();
    });
  }

  // الواجهة العامة
  return {
    init,
    start,
    adjust,
    toggleTurn,
    showAnswer,
    award,
    finish,
    playAgain,
  };
})();

document.addEventListener("DOMContentLoaded", Game.init);
