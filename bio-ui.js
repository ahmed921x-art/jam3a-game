/* ===========================================================
   بايو (BIO) — تحسينات واجهة فقط (لا تغيّر حالة اللعبة)
   يُحمَّل بعد game.js. يراقب DOM الذي يبنيه game.js ويضيف:
   1) تصنيف بطاقات الفئات + بحث وتصفية + حالة فارغة
   2) شريط البدء: كم فئة باقية / جاهزين
   3) أسماء الثيمات الجديدة (بديل مؤقت حتى يُحدَّث THEME_NAMES في game.js)
   4) أزرار رهان سريعة ومراحل الجولة الذهبية
   5) إدارة التركيز في النوافذ (فتح/إغلاق/Tab)
   6) عدّاد الإنجازات + حالة فارغة لمحرر الفئات
   7) مباراة «سين وجيم»: أسماء الألوان، ملاحظة الحفظ المحلي، إعلان الدور، والتركيز بعد الحكم
   لا يستدعي أي دالة Game.* تغيّر الحالة.
   =========================================================== */

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const t = (k, v) => (typeof I18N !== "undefined" ? I18N.t(k, v) : k);
  const observe = (el, fn, opts) => el && new MutationObserver(fn).observe(el, opts);

  /* ---------- 1) الفئات: تصنيف + بحث + تصفية ---------- */
  const grid = $("#catsGrid");
  const search = $("#catSearch");
  const filters = $("#catFilters");
  const empty = $("#catsEmpty");
  let group = "all";

  const norm = (s) =>
    (s || "")
      .toLowerCase()
      .replace(/[ً-ْـ]/g, "") // تشكيل وتطويل
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .trim();

  function tagTiles() {
    const cats = typeof CATEGORIES !== "undefined" ? CATEGORIES : [];
    const base = cats.length;
    $$(".cat-tile", grid).forEach((tile) => {
      const i = +tile.dataset.index;
      const cat = i < base ? cats[i] : null;
      tile.dataset.group = cat ? cat.group || "general" : "custom";
      if (!tile.dataset.search) tile.dataset.search = norm(tile.getAttribute("aria-label"));
    });
  }

  function applyFilter() {
    if (!grid) return;
    const q = norm(search && search.value);
    let shown = 0;
    $$(".cat-tile", grid).forEach((tile) => {
      const okGroup =
        group === "all" ||
        (group === "selected" ? tile.classList.contains("selected") : tile.dataset.group === group);
      const okText = !q || (tile.dataset.search || "").includes(q);
      const show = okGroup && okText;
      tile.classList.toggle("is-hidden", !show);
      if (show) shown++;
    });
    if (empty) {
      empty.hidden = shown > 0;
      if (!shown)
        empty.textContent =
          group === "custom" && !q ? t("cats_empty_custom") : group === "selected" && !q ? t("cats_empty_selected") : t("cats_empty_search");
    }
  }

  if (grid) {
    observe(grid, () => {
      tagTiles();
      applyFilter();
    }, { childList: true });
    // تغيّر الاختيار (class) يؤثر على فلتر «المختارة»
    observe(grid, () => group === "selected" && applyFilter(), { attributes: true, subtree: true, attributeFilter: ["class"] });
    tagTiles();
    applyFilter();
  }
  search && search.addEventListener("input", applyFilter);
  filters &&
    filters.addEventListener("click", (e) => {
      const b = e.target.closest(".fchip");
      if (!b) return;
      group = b.dataset.group;
      $$(".fchip", filters).forEach((x) => {
        const on = x === b;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", on);
      });
      applyFilter();
    });

  /* ---------- 2) شريط البدء ---------- */
  const counter = $("#catCounter");
  const bar = $(".start-bar");
  const status = $("#setupStatus");
  function refreshStatus() {
    if (!counter || !bar) return;
    const [have, need] = counter.textContent.split("/").map((x) => parseInt(x, 10) || 0);
    const left = Math.max(0, need - have);
    const ready = need > 0 && left === 0;
    bar.classList.toggle("ready", ready);
    counter.classList.toggle("full", ready);
    status.textContent = ready ? t("status_ready") : left === 1 ? t("status_need1") : t("status_need", { n: left });
  }
  observe(counter, refreshStatus, { childList: true, characterData: true, subtree: true });
  refreshStatus();

  /* ---------- 3) أسماء الثيمات ---------- */
  const THEME_KEYS = ["theme_royal", "theme_emerald", "theme_crimson", "theme_ocean", "theme_violet"];
  const picker = $("#themePicker");
  let relabeling = false;
  function relabelThemes() {
    if (!picker || relabeling) return;
    relabeling = true;
    $$(".theme-swatch", picker).forEach((b, i) => {
      const name = t(THEME_KEYS[i] || "");
      const nm = $(".ts-nm", b);
      if (nm && nm.textContent !== name) nm.textContent = name;
      b.title = name;
      b.setAttribute("aria-pressed", b.classList.contains("on"));
    });
    relabeling = false;
  }
  observe(picker, relabelThemes, { childList: true });
  relabelThemes();

  /* ---------- 4) الجولة الذهبية ---------- */
  const golden = $("#goldenModal");
  function buildWagerChips() {
    $$(".wager-chips", golden).forEach((box) => {
      const inp = document.getElementById(box.dataset.for);
      const max = Math.max(0, parseInt(inp.max, 10) || 0);
      const half = Math.floor(max / 200) * 100; // نصف مقرّب لأقرب 100
      box.innerHTML = "";
      [
        [t("w_zero"), 0],
        [t("w_half"), half],
        [t("w_all"), max],
      ].forEach(([label, v]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label === "0" ? "0" : `${label} · ${v}`;
        b.addEventListener("click", () => {
          inp.value = v;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        });
        box.appendChild(b);
      });
      inp.oninput = () => {
        // تنبيه بصري فقط إذا تجاوز الرصيد (game.js يقصّه عند التثبيت)
        inp.setAttribute("aria-invalid", +inp.value > max || +inp.value < 0 ? "true" : "false");
      };
    });
  }
  function goldenStage() {
    const steps = $$(".g-steps li", golden);
    if (!steps.length) return;
    const qShown = $("#goldStageQ").style.display !== "none";
    const judge = $("#goldJudge").style.display !== "none";
    const idx = !qShown ? 0 : judge ? 2 : 1;
    steps.forEach((li, i) => li.classList.toggle("on", i === idx));
    // كرّر شريط المراحل داخل مرحلة السؤال
    const holder = $("#goldStageQ");
    if (qShown && !$(".g-steps", holder)) holder.prepend($(".g-steps", golden).cloneNode(true));
    $$(".g-steps", golden).forEach((ol) => $$("li", ol).forEach((li, i) => li.classList.toggle("on", i === idx)));
  }
  if (golden) {
    observe(golden, () => golden.classList.contains("active") && (buildWagerChips(), goldenStage()), { attributes: true, attributeFilter: ["class"] });
    observe(golden, goldenStage, { attributes: true, subtree: true, attributeFilter: ["style"] });
  }

  /* ---------- 5) التركيز في النوافذ ---------- */
  const FOCUSABLE = 'button:not([disabled]):not([hidden]), [href], input:not([type="hidden"]):not([hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';
  const lastFocus = new Map();
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  function topModal() {
    const open = $$(".modal.active");
    return open[open.length - 1] || null;
  }
  $$(".modal").forEach((m) => {
    let was = m.classList.contains("active");
    observe(m, () => {
      const now = m.classList.contains("active");
      if (now === was) return;
      was = now;
      if (now) {
        lastFocus.set(m, document.activeElement);
        requestAnimationFrame(() => {
          const prefer =
            m.id === "qModal"
              ? $("#showAnswerBtn")
              : m.id === "goldenModal"
                ? $("#wager1")
                : m.id === "mqModal"
                  ? $('#mqControls [data-act="board"], #mqControls [data-act="reveal"], #mqControls [data-act="right"]', m)
                  : $(".auth-close, .editor-head .icon-btn", m);
          const target = prefer && visible(prefer) ? prefer : $$(FOCUSABLE, m).find(visible);
          target && target.focus({ preventScroll: true });
        });
      } else {
        const back = lastFocus.get(m);
        if (back && document.contains(back) && visible(back)) back.focus({ preventScroll: true });
      }
    }, { attributes: true, attributeFilter: ["class"] });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const m = topModal();
    if (!m) return;
    const items = $$(FOCUSABLE, m).filter(visible);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!m.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  // بعد اختيار إجابة/حكم ينتقل التركيز لزر العرض الجديد (لوحة المفاتيح)
  const frame = $("#qFrame");
  observe(frame, () => {
    if (!$("#qModal").classList.contains("active")) return;
    if (frame.contains(document.activeElement) && visible(document.activeElement)) return;
    const v = frame.dataset.view;
    const target = v === "q" ? $("#showAnswerBtn") : v === "a" ? $("#whichTeamBtn") : $("#awardT1");
    target && target.focus({ preventScroll: true });
  }, { attributes: true, attributeFilter: ["data-view"] });

  /* ---------- 6) الإنجازات + المحرر ---------- */
  const badges = $("#badges");
  observe(badges, () => {
    const all = $$(".badge", badges).length;
    const got = $$(".badge.got", badges).length;
    const c = $("#achCount");
    if (c) c.textContent = all ? `${got} / ${all}` : "";
  }, { childList: true });

  const edList = $("#editorList");
  let edBusy = false;
  function edEmpty() {
    if (!edList || edBusy) return;
    edBusy = true;
    const has = !!$(".ed-item .del", edList);
    let note = $(".ed-empty", edList);
    if (!has && !note) {
      note = document.createElement("div");
      note.className = "ed-empty";
      edList.prepend(note);
    }
    if (note) {
      if (has) note.remove();
      else note.textContent = t("ed_empty");
    }
    edBusy = false;
  }
  observe(edList, edEmpty, { childList: true });

  /* ---------- 7) مباراة «سين وجيم» (match.js يبني DOM، وهنا تحسينات عرض فقط) ---------- */
  const msScreen = $("#matchSetupScreen");
  const mbScreen = $("#matchBoardScreen");
  const mqModal = $("#mqModal");
  const mqBox = $("#mqBox");
  const SWATCH_NAMES = { "#9fe0ec": "col_aqua", "#e8949d": "col_rose", "#c3e813": "col_lime", "#e4a6f7": "col_orchid", "#f9e09b": "col_cream", "#ffb36b": "col_orange" };
  const isGuest = () => typeof Auth === "undefined" || !!Auth.current().guest;

  // أ) الإعداد: أسماء ألوان مفهومة بدل رموز hex، وملاحظة أين تُحفظ المباراة
  let msBusy = false;
  function decorateSetup() {
    if (!msScreen || msBusy || !msScreen.firstElementChild) return;
    msBusy = true;
    $$(".ms-colors .swatch", msScreen).forEach((b) => {
      const k = SWATCH_NAMES[(b.dataset.color || "").toLowerCase()];
      if (!k) return;
      const label = t("col_l", { name: t(k) });
      if (b.getAttribute("aria-label") !== label) b.setAttribute("aria-label", label);
      if (b.title !== label) b.title = label;
    });
    const text = t(isGuest() ? "ms_note_guest" : "ms_note_user");
    let note = $(".ms-local", msScreen);
    if (!note) {
      note = document.createElement("p");
      note.className = "ms-local";
      const head = $(".page-head", msScreen);
      head ? head.after(note) : msScreen.prepend(note);
    }
    if (note.textContent !== text) note.textContent = text;
    msBusy = false;
  }
  observe(msScreen, decorateSetup, { childList: true, subtree: true });
  if (typeof Auth !== "undefined") Auth.onChange(decorateSetup);

  // ب) اللوحة: إعلان تغيّر الدور لقارئ الشاشة (match.js يعيد بناء .mb-turn فلا يُقرأ)
  const live = document.createElement("p");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);
  let lastTurn = "";
  observe(mbScreen, () => {
    if (!mbScreen.classList.contains("active")) return;
    const turn = $(".mb-turn", mbScreen);
    const msg = turn ? turn.textContent.trim() : "";
    if (msg && msg !== lastTurn) live.textContent = lastTurn = msg;
  }, { childList: true });

  // ج) السؤال: بعد كل حكم تُستبدل الأزرار، فننقل التركيز للزر التالي المنطقي
  const lost = () => !document.activeElement || document.activeElement === document.body || !document.contains(document.activeElement);
  function focusQuestion() {
    if (!mqModal || !mqModal.classList.contains("active")) return;
    if (!lost() && mqModal.contains(document.activeElement)) return;
    const target = $('#mqControls [data-act="board"], #mqControls [data-act="reveal"], #mqControls [data-act="right"]', mqBox);
    target && visible(target) && target.focus({ preventScroll: true });
  }
  // المراقِب يعمل بعد انتهاء match.js من بناء الأزرار، فلا حاجة لانتظار إطار رسم
  observe(mqBox, focusQuestion, { childList: true, subtree: true });

  // د) إغلاق السؤال: الخانة المفتوحة صارت مستخدمة، فالتركيز ينتقل لأقرب خانة مفتوحة في نفس الفئة
  let openedCol = null;
  observe(mqModal, () => {
    if (mqModal.classList.contains("active")) {
      const a = document.activeElement;
      openedCol = a && a.dataset && a.dataset.ci !== undefined ? a.dataset.ci : null;
      return;
    }
    // renderBoard يحدث مباشرة بعد الإغلاق، فاللوحة الجديدة موجودة هنا
    if (!mbScreen || !mbScreen.classList.contains("active") || !lost()) return;
    const next = (openedCol !== null && $(`button.mb-cell[data-ci="${openedCol}"]`, mbScreen)) || $("button.mb-cell", mbScreen);
    next && next.focus({ preventScroll: true });
  }, { attributes: true, attributeFilter: ["class"] });

  /* ---------- اللغة ---------- */
  document.addEventListener("i18n:change", () => {
    refreshStatus();
    relabelThemes();
    applyFilter();
    edEmpty();
    decorateSetup();
  });
})();
