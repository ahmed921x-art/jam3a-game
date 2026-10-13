/* ===========================================================
   بايو (BIO) — لوحة الأدمن
   - categories/{id}    إضافة/تعديل/حذف فئات تظهر لكل اللاعبين
   - catalog/overrides  إخفاء الفئات الأساسية وتعيين صورها
   - config/admins      المالكون (من لوحة Firebase) + المحررون (يديرهم المالك من هنا)
   الصلاحيات الفعلية تفرضها firestore.rules؛ هذه الصفحة واجهة فقط.
   =========================================================== */

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const TIERS = [200, 400, 600];
  const GROUP_LABEL = { bio: "🧬 أحياء وعلوم", kuwait: "🇰🇼 الكويت", general: "🎯 عامة" };
  const db = FB.db;
  const auth = FB.auth;
  const BUILTIN = CATEGORIES.slice(); // من ملفات الأسئلة
  const BUILTIN_IDS = new Set(BUILTIN.map((c) => c.id));

  let me = null; // { email, owner }
  let adminsDoc = null;
  let cats = []; // الفئات المضافة [{ id, ...data }]
  let editingId = null;
  let dirty = false;
  let overrides = { hidden: [], images: {} };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
  const safeUrl = (v) => {
    const s = norm(v);
    return !s || /^(https:\/\/|assets\/)[^"'<>\s]+$/i.test(s) ? s : null;
  };

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---------------- الدخول والصلاحيات ----------------
  function gate(title, msg, showLogin) {
    $("#app").hidden = true;
    $("#gate").hidden = false;
    $("#gateTitle").textContent = title;
    $("#gateMsg").textContent = msg;
    $("#gateLogin").hidden = !showLogin;
  }

  if (!auth || !db) {
    gate("لوحة الأدمن", "تعذّر تحميل Firebase. تحقّق من الاتصال بالإنترنت ثم حدّث الصفحة.", false);
    return;
  }

  $("#gateLogin").addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      const code = (e && e.code) || "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          await auth.signInWithRedirect(provider);
        } catch (e2) {
          $("#gateMsg").textContent = "تعذّر تسجيل الدخول: " + ((e2 && e2.code) || "خطأ غير معروف");
        }
      } else if (code === "auth/configuration-not-found" || code === "auth/operation-not-allowed") {
        $("#gateMsg").textContent = "تسجيل الدخول بحساب Google غير مفعّل في Firebase. فعّله من Authentication ← Sign-in method ← Google.";
      } else if (code === "auth/unauthorized-domain") {
        $("#gateMsg").textContent = "هذا النطاق غير مضاف في Firebase Authentication ← Settings ← Authorized domains.";
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        $("#gateMsg").textContent = "تعذّر تسجيل الدخول (" + (code || "خطأ غير معروف") + "). حاول مرة أخرى.";
      }
    }
  });
  $("#admSignOut").addEventListener("click", () => auth.signOut());

  auth.onAuthStateChanged(async (u) => {
    $("#admUser").hidden = !u;
    $("#admSignOut").hidden = !u;
    if (!u) {
      me = null;
      gate("لوحة الأدمن", "سجّل دخولك بحساب Google المسجّل كمشرف.", true);
      return;
    }
    $("#admUser").textContent = u.email;
    gate("لوحة الأدمن", "جاري التحقق من الصلاحيات…", false);
    try {
      const snap = await db.collection("config").doc("admins").get();
      adminsDoc = snap.exists ? snap.data() : null;
      const email = (u.email || "").toLowerCase();
      const owners = (adminsDoc && adminsDoc.owners) || [];
      const editors = (adminsDoc && adminsDoc.editors) || [];
      if (!owners.includes(email) && !editors.includes(email)) throw new Error("not-admin");
      me = { email, owner: owners.includes(email) };
    } catch (e) {
      gate("غير مصرّح", `الحساب ${u.email} ليس مشرفاً. اطلب من مالك اللعبة إضافتك، أو سجّل الدخول بحساب آخر.`, false);
      $("#admSignOut").hidden = false;
      return;
    }
    $("#gate").hidden = true;
    $("#app").hidden = false;
    $("#tabAdminsBtn").hidden = !me.owner;
    await Promise.all([loadCats(), loadOverrides()]);
    renderAdmins();
    newCategory();
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ---------------- التبويبات ----------------
  $$(".adm-tab").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".adm-tab").forEach((x) => {
        x.classList.toggle("on", x === b);
        x.setAttribute("aria-selected", x === b);
      });
      $$(".adm-panel").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
    })
  );

  // ---------------- الفئات المضافة ----------------
  async function loadCats() {
    const snap = await db.collection("categories").get();
    cats = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
    renderCatList();
  }

  function renderCatList() {
    const list = $("#catList");
    list.innerHTML = "";
    if (!cats.length) {
      list.innerHTML = '<p class="empty-state">ما فيه فئات مضافة بعد. املأ النموذج واضغط «حفظ ونشر».</p>';
      return;
    }
    cats.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "adm-item" + (c.id === editingId ? " on" : "");
      b.innerHTML = `<span class="ai-ic">${esc(c.icon || "📁")}</span><span class="ai-nm">${esc(c.name)}</span><span class="ai-meta">${esc(GROUP_LABEL[c.group] || "")} · ${(c.questions || []).length} سؤال</span>`;
      b.addEventListener("click", () => {
        if (dirty && !confirm("فيه تعديلات غير محفوظة. تتركها؟")) return;
        loadIntoForm(c);
      });
      list.appendChild(b);
    });
  }

  function qRow(points = 200, q = "", a = "", img = "", aImg = "") {
    const row = document.createElement("div");
    row.className = "adm-q";
    row.innerHTML = `
      <select aria-label="النقاط">${TIERS.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
      <input class="q" type="text" maxlength="500" placeholder="السؤال" aria-label="السؤال" />
      <input class="a" type="text" maxlength="500" placeholder="الإجابة" aria-label="الإجابة" />
      <button type="button" class="adm-imgbtn" aria-expanded="false" aria-label="صور السؤال والإجابة" title="صور السؤال والإجابة">🖼</button>
      <button type="button" class="adm-rm" aria-label="حذف السؤال">✕</button>
      <div class="adm-q-imgs" hidden>
        <label><span>صورة السؤال</span><input class="qi" type="url" dir="ltr" placeholder="assets/questions/… أو https://…" /></label>
        <label><span>صورة الإجابة</span><input class="ai" type="url" dir="ltr" placeholder="assets/questions/… أو https://…" /></label>
      </div>`;
    row.querySelector("select").value = String(points);
    row.querySelector(".q").value = q;
    row.querySelector(".a").value = a;
    row.querySelector(".qi").value = img || "";
    row.querySelector(".ai").value = aImg || "";
    const imgs = row.querySelector(".adm-q-imgs");
    const imgBtn = row.querySelector(".adm-imgbtn");
    const syncImgBtn = () => imgBtn.classList.toggle("has", !!(row.querySelector(".qi").value.trim() || row.querySelector(".ai").value.trim()));
    imgBtn.addEventListener("click", () => {
      imgs.hidden = !imgs.hidden;
      imgBtn.setAttribute("aria-expanded", !imgs.hidden);
      if (!imgs.hidden) row.querySelector(".qi").focus();
    });
    imgs.addEventListener("input", syncImgBtn);
    syncImgBtn();
    row.querySelector(".adm-rm").addEventListener("click", () => {
      row.remove();
      changed();
    });
    return row;
  }

  function sortRows() {
    const box = $("#qList");
    $$(".adm-q", box)
      .sort((x, y) => +x.querySelector("select").value - +y.querySelector("select").value)
      .forEach((r) => box.appendChild(r));
  }

  function fillQuestions(questions) {
    const box = $("#qList");
    box.innerHTML = "";
    questions.forEach((q) => box.appendChild(qRow(q.points, q.q, q.a, q.img, q.aImg)));
    sortRows();
    updateTiers();
  }

  function newCategory() {
    editingId = null;
    $("#edTitle").textContent = "فئة جديدة";
    $("#fName").value = "";
    $("#fIcon").value = "";
    $("#fGroup").value = "bio";
    $("#fImg").value = "";
    $("#delCat").hidden = true;
    fillQuestions(TIERS.flatMap((p) => [{ points: p, q: "", a: "" }, { points: p, q: "", a: "" }]));
    previewImg();
    $("#formErr").textContent = "";
    dirty = false;
    renderCatList();
  }

  function loadIntoForm(c) {
    editingId = c.id;
    $("#edTitle").textContent = `تعديل: ${c.name}`;
    $("#fName").value = c.name || "";
    $("#fIcon").value = c.icon || "";
    $("#fGroup").value = c.group || "general";
    $("#fImg").value = c.img || "";
    $("#delCat").hidden = false;
    fillQuestions(c.questions || []);
    previewImg();
    $("#formErr").textContent = "";
    dirty = false;
    renderCatList();
  }

  function readForm() {
    const questions = $$("#qList .adm-q")
      .map((r) => {
        const x = { points: +r.querySelector("select").value, q: norm(r.querySelector(".q").value), a: norm(r.querySelector(".a").value) };
        const img = norm(r.querySelector(".qi").value);
        const aImg = norm(r.querySelector(".ai").value);
        if (img) x.img = img;
        if (aImg) x.aImg = aImg;
        return x;
      })
      .filter((x) => x.q || x.a);
    return { name: norm($("#fName").value), icon: norm($("#fIcon").value) || "📁", group: $("#fGroup").value, img: norm($("#fImg").value), questions };
  }

  function validate(d) {
    if (!d.name) return "اكتب اسم الفئة.";
    const half = d.questions.find((x) => !x.q || !x.a);
    if (half) return "فيه سؤال بدون إجابة أو إجابة بدون سؤال. أكمله أو احذفه.";
    for (const p of TIERS) {
      const n = new Set(d.questions.filter((x) => x.points === p).map((x) => x.q)).size;
      if (n < 2) return `تحتاج سؤالين مختلفين على الأقل بقيمة ${p} (عندك ${n}).`;
    }
    const seen = new Set();
    for (const x of d.questions) {
      if (seen.has(x.q)) return `السؤال مكرر: «${x.q}»`;
      seen.add(x.q);
    }
    const dupBuiltin = BUILTIN.find((c) => c.questions.some((x) => d.questions.some((y) => y.q === x.q.trim())));
    if (dupBuiltin) return `أحد الأسئلة موجود أصلاً في فئة «${dupBuiltin.name}». غيّره حتى لا يتكرر في اللعبة.`;
    if (safeUrl(d.img) === null) return "رابط الصورة لازم يبدأ بـ https:// أو assets/";
    const badImg = d.questions.find((x) => safeUrl(x.img) === null || safeUrl(x.aImg) === null);
    if (badImg) return `رابط صورة غير صالح في السؤال «${badImg.q}» — لازم يبدأ بـ https:// أو assets/`;
    if (d.questions.length > 90) return "الحد الأقصى 90 سؤالاً للفئة.";
    return "";
  }

  function updateTiers() {
    const d = readForm();
    $("#tierCount").innerHTML = TIERS.map((p) => {
      const n = d.questions.filter((x) => x.points === p && x.q && x.a).length;
      return `<span class="${n >= 2 ? "ok" : "bad"}">${p}: ${n}</span>`;
    }).join("");
  }

  function previewImg() {
    const url = safeUrl($("#fImg").value);
    const box = $("#fImgPrev");
    box.innerHTML = url ? `<img src="${esc(url)}" alt="" />` : `<span>${esc(norm($("#fIcon").value) || "📁")}</span>`;
  }

  function changed() {
    dirty = true;
    updateTiers();
  }

  ["#fName", "#fIcon", "#fGroup"].forEach((s) => $(s).addEventListener("input", changed));
  $("#fImg").addEventListener("input", () => {
    changed();
    previewImg();
  });
  $("#fIcon").addEventListener("input", previewImg);
  $("#qList").addEventListener("input", changed);
  $("#qList").addEventListener("change", (e) => {
    if (e.target.matches("select")) sortRows();
    changed();
  });
  $$("[data-add]").forEach((b) =>
    b.addEventListener("click", () => {
      const row = qRow(+b.dataset.add);
      $("#qList").appendChild(row);
      sortRows();
      row.querySelector(".q").focus();
      changed();
    })
  );
  $("#newCat").addEventListener("click", () => {
    if (dirty && !confirm("فيه تعديلات غير محفوظة. تتركها؟")) return;
    newCategory();
    $("#fName").focus();
  });

  $("#saveCat").addEventListener("click", async () => {
    const d = readForm();
    const err = validate(d);
    $("#formErr").textContent = err;
    if (err) return;
    const id = editingId || "a_" + Date.now().toString(36);
    if (BUILTIN_IDS.has(id)) return ($("#formErr").textContent = "معرّف محجوز لفئة أساسية.");
    const btn = $("#saveCat");
    btn.disabled = true;
    try {
      await db.collection("categories").doc(id).set({
        ...d,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: me.email,
      });
      dirty = false;
      await loadCats();
      loadIntoForm(cats.find((c) => c.id === id) || { id, ...d });
      toast("✅ تم الحفظ. الفئة ظاهرة الآن في اللعبة");
    } catch (e) {
      $("#formErr").textContent = "تعذّر الحفظ: " + (e.code === "permission-denied" ? "ليس لديك صلاحية، أو قواعد Firestore لم تُنشر بعد." : e.message || e);
    } finally {
      btn.disabled = false;
    }
  });

  $("#delCat").addEventListener("click", async () => {
    if (!editingId) return;
    const c = cats.find((x) => x.id === editingId);
    if (!confirm(`حذف فئة «${c ? c.name : ""}» نهائياً؟ ستختفي من اللعبة عند كل اللاعبين.`)) return;
    try {
      await db.collection("categories").doc(editingId).delete();
      toast("🗑 تم حذف الفئة");
      await loadCats();
      newCategory();
    } catch (e) {
      $("#formErr").textContent = "تعذّر الحذف: " + (e.message || e);
    }
  });

  $("#importFile").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const c = Array.isArray(data) ? data[0] : data;
        if (!c || !Array.isArray(c.questions)) throw new Error();
        editingId = null;
        $("#delCat").hidden = true;
        $("#edTitle").textContent = "فئة جديدة (مستوردة)";
        $("#fName").value = norm(c.name).slice(0, 60);
        $("#fIcon").value = norm(c.icon).slice(0, 8);
        $("#fImg").value = "";
        fillQuestions(c.questions.filter((q) => q && TIERS.includes(q.points)).map((q) => ({ points: q.points, q: norm(q.q), a: norm(q.a), img: norm(q.img), aImg: norm(q.aImg) })));
        previewImg();
        changed();
        toast("📥 تم تعبئة النموذج. راجع ثم احفظ");
      } catch {
        toast("الملف غير صالح");
      }
    };
    r.readAsText(file);
    ev.target.value = "";
  });

  // ---------------- الفئات الأساسية ----------------
  async function loadOverrides() {
    const snap = await db.collection("catalog").doc("overrides").get();
    const o = snap.exists ? snap.data() : {};
    overrides = { hidden: Array.isArray(o.hidden) ? o.hidden : [], images: o.images && typeof o.images === "object" ? { ...o.images } : {} };
    renderBuiltin();
  }

  function renderBuiltin() {
    const q = norm($("#builtinSearch").value).toLowerCase();
    const list = $("#builtinList");
    list.innerHTML = "";
    BUILTIN.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.includes(q)).forEach((c) => {
      const hidden = overrides.hidden.includes(c.id);
      const row = document.createElement("div");
      row.className = "adm-bi" + (hidden ? " is-off" : "");
      row.innerHTML = `
        <span class="ai-ic">${esc(c.icon)}</span>
        <div class="bi-txt"><span class="ai-nm">${esc(c.name)}</span><span class="ai-meta">${esc(GROUP_LABEL[c.group] || "")} · ${c.questions.length} سؤال · <code dir="ltr">${esc(c.id)}</code></span></div>
        <input class="bi-img" type="url" dir="ltr" placeholder="رابط صورة (اختياري)" aria-label="رابط صورة ${esc(c.name)}" value="${esc(overrides.images[c.id] || "")}" />
        <label class="bi-toggle"><input type="checkbox" ${hidden ? "" : "checked"} /> <span>${hidden ? "مخفية" : "ظاهرة"}</span></label>`;
      row.querySelector(".bi-img").addEventListener("input", (e) => {
        const v = norm(e.target.value);
        if (v) overrides.images[c.id] = v;
        else delete overrides.images[c.id];
        dirty = true;
      });
      row.querySelector(".bi-toggle input").addEventListener("change", (e) => {
        const set = new Set(overrides.hidden);
        e.target.checked ? set.delete(c.id) : set.add(c.id);
        overrides.hidden = [...set];
        dirty = true;
        renderBuiltin();
      });
      list.appendChild(row);
    });
  }
  $("#builtinSearch").addEventListener("input", renderBuiltin);

  $("#saveOverrides").addEventListener("click", async () => {
    const bad = Object.entries(overrides.images).find(([, v]) => safeUrl(v) === null);
    if (bad) return toast(`رابط صورة غير صالح في «${bad[0]}» — لازم يبدأ بـ https:// أو assets/`);
    const visible = BUILTIN.length - overrides.hidden.length + cats.length;
    if (visible < 4) return toast("لازم تبقى 4 فئات ظاهرة على الأقل");
    try {
      await db.collection("catalog").doc("overrides").set({
        hidden: overrides.hidden,
        images: overrides.images,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: me.email,
      });
      dirty = false;
      toast("✅ تم حفظ إعدادات الفئات الأساسية");
    } catch (e) {
      toast("تعذّر الحفظ: " + (e.code === "permission-denied" ? "لا توجد صلاحية" : e.message || e));
    }
  });

  // ---------------- المشرفون ----------------
  function renderAdmins() {
    const owners = (adminsDoc && adminsDoc.owners) || [];
    const editors = (adminsDoc && adminsDoc.editors) || [];
    $("#ownerList").innerHTML = owners.map((e) => `<li><span dir="ltr">${esc(e)}</span></li>`).join("") || "<li>—</li>";
    const ul = $("#editorList");
    ul.innerHTML = editors.length ? "" : '<li class="hint">ما فيه محررين بعد.</li>';
    editors.forEach((e) => {
      const li = document.createElement("li");
      li.innerHTML = `<span dir="ltr">${esc(e)}</span>`;
      if (me && me.owner) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-ghost btn-sm adm-danger";
        b.textContent = "إزالة";
        b.addEventListener("click", () => saveEditors(editors.filter((x) => x !== e)));
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
  }

  async function saveEditors(list) {
    try {
      await db.collection("config").doc("admins").update({ editors: list });
      adminsDoc = { ...adminsDoc, editors: list };
      renderAdmins();
      toast("✅ تم تحديث المشرفين");
    } catch (e) {
      toast("تعذّر التحديث: " + (e.message || e));
    }
  }

  $("#addAdminForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = norm($("#newAdmin").value).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("اكتب إيميلاً صحيحاً");
    const editors = (adminsDoc && adminsDoc.editors) || [];
    const owners = (adminsDoc && adminsDoc.owners) || [];
    if (editors.includes(email) || owners.includes(email)) return toast("هذا الإيميل مشرف أصلاً");
    $("#newAdmin").value = "";
    saveEditors([...editors, email]);
  });
})();
