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
  const GROUP_LABEL = { bio: "🧬 أحياء وعلوم", kuwait: "🇰🇼 الكويت", general: "🎯 عامة", gaming: "🎮 ألعاب فيديو", anime: "🎌 أنمي", cartoon: "📺 كرتون زمان", sport: "⚽ رياضة", music: "🎤 موسيقى" };
  const db = FB.db;
  const auth = FB.auth;
  const BUILTIN = CATEGORIES.slice(); // من ملفات الأسئلة
  const BUILTIN_IDS = new Set(BUILTIN.map((c) => c.id));

  let me = null; // { email, owner }
  let adminsDoc = null;
  let cats = []; // الفئات المضافة [{ id, ...data }]
  let editingId = null;
  // فئة أساسية مفتوحة للتعديل: تُحفظ في categories/{نفس المعرّف} واللعبة تستبدل بها الأصل
  const isBuiltin = (id) => !!id && BUILTIN_IDS.has(id);
  const builtinById = (id) => BUILTIN.find((c) => c.id === id);
  // حقول الوسائط (صوت/فيديو/تكبير الصورة) لا يعرضها النموذج، لكنها تُحفظ كما هي مع السؤال
  const EXTRA_KEYS = ["type", "yt", "win", "start", "end", "mute", "blur", "zoom", "focus", "hint", "audio", "video"];
  const extrasOf = (q) => {
    const x = {};
    EXTRA_KEYS.forEach((k) => q && q[k] !== undefined && (x[k] = q[k]));
    return x;
  };
  const MEDIA_ICON = { image: "🖼", audio: "🎵", video: "🎬" };
  // هوية السؤال = نصه + وسيطه (أسئلة الوسائط تتشارك النص مثل «من أي لعبة هذي الموسيقى؟»)
  const qKey = (x) => norm(x.q) + "|" + (x.img || x.yt || x.audio || x.video || "");
  let dirty = false;
  let overrides = { hidden: [], images: {} };

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ");
  // صورة مرفوعة من الجهاز تُحفظ كـ data URL صغيرة داخل المستند (لا يلزم Firebase Storage)
  const DATA_IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  const safeUrl = (v) => {
    const raw = String(v || "").trim();
    if (!raw) return raw;
    if (DATA_IMG.test(raw)) return raw.length <= 400000 ? raw : null;
    const s = norm(raw);
    return /^(https:\/\/|assets\/)[^"'<>\s]+$/i.test(s) ? s : null;
  };
  const MAX_DOC = 900000; // حد Firestore للمستند 1MB

  // تصغير صورة من الجهاز: square = قص مربع (صورة فئة)، وإلا حد أقصى للضلع الأطول
  function fileToDataUrl(file, max, square) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error("اختر ملف صورة"));
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0, w, h;
        if (square) {
          const side = Math.min(sw, sh);
          sx = (sw - side) / 2;
          sy = (sh - side) / 2;
          sw = sh = side;
          w = h = Math.min(max, side);
        } else {
          const r = Math.min(1, max / Math.max(sw, sh));
          w = Math.round(sw * r);
          h = Math.round(sh * r);
        }
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        let out = cv.toDataURL("image/webp", 0.82);
        if (!out.startsWith("data:image/webp")) out = cv.toDataURL("image/jpeg", 0.82);
        resolve(out);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("تعذّر قراءة الصورة"));
      };
      img.src = url;
    });
  }
  function pickImage(max, square) {
    return new Promise((resolve) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/*";
      inp.onchange = async () => {
        try {
          resolve(await fileToDataUrl(inp.files[0], max, square));
        } catch (e) {
          toast(e.message);
          resolve(null);
        }
      };
      inp.click();
    });
  }
  // حقل الرابط يحتفظ بالصورة المرفوعة في dataset بدل عرض نص طويل
  function setImgField(input, value) {
    const v = value || "";
    if (!input.dataset.ph) input.dataset.ph = input.placeholder;
    if (v.startsWith("data:")) {
      input.dataset.data = v;
      input.value = "";
      input.placeholder = "✓ صورة مرفوعة من جهازك";
    } else {
      delete input.dataset.data;
      input.value = v;
      input.placeholder = input.dataset.ph;
    }
  }
  const imgFieldValue = (input) => input.dataset.data || norm(input.value);

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---------------- الدخول والصلاحيات ----------------
  function gate(title, msg, showLogin, showVerify) {
    $("#app").hidden = true;
    $("#gate").hidden = false;
    $("#gateTitle").textContent = title;
    $("#gateMsg").textContent = msg;
    $("#gateLogin").hidden = !showLogin;
    $("#emailForm").hidden = !showLogin;
    $("#gateOr").hidden = !showLogin;
    $("#resendVerify").hidden = !showVerify;
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

  const AUTH_MSG = {
    "auth/invalid-credential": "الإيميل أو كلمة السر غير صحيحة.",
    "auth/wrong-password": "الإيميل أو كلمة السر غير صحيحة.",
    "auth/user-not-found": "ما فيه حساب بهذا الإيميل. اطلب من المالك إنشاءه.",
    "auth/invalid-email": "صيغة الإيميل غير صحيحة.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلاً ثم حاول.",
    "auth/operation-not-allowed": "الدخول بالإيميل غير مفعّل في Firebase (Authentication ← Sign-in method ← Email/Password).",
    "auth/configuration-not-found": "الدخول بالإيميل غير مفعّل في Firebase (Authentication ← Sign-in method ← Email/Password).",
    "auth/network-request-failed": "لا يوجد اتصال بالإنترنت.",
  };
  $("#emailForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = norm($("#loginEmail").value);
    const pass = $("#loginPass").value;
    $("#gateMsg").textContent = "جاري الدخول…";
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      $("#gateMsg").textContent = AUTH_MSG[err.code] || "تعذّر الدخول (" + (err.code || err.message) + ").";
    }
  });
  $("#forgotPass").addEventListener("click", async () => {
    const email = norm($("#loginEmail").value);
    if (!email) return ($("#gateMsg").textContent = "اكتب إيميلك أولاً ثم اضغط «نسيت كلمة السر».");
    try {
      await auth.sendPasswordResetEmail(email);
      $("#gateMsg").textContent = "أرسلنا رابط تعيين كلمة السر إلى " + email + " (تفقّد البريد غير المرغوب).";
    } catch (err) {
      $("#gateMsg").textContent = AUTH_MSG[err.code] || "تعذّر الإرسال (" + (err.code || err.message) + ").";
    }
  });
  $("#resendVerify").addEventListener("click", async () => {
    try {
      await auth.currentUser.sendEmailVerification();
      toast("📧 أرسلنا رابط التأكيد");
    } catch (err) {
      toast(AUTH_MSG[err.code] || "تعذّر الإرسال، حاول بعد قليل");
    }
  });

  auth.onAuthStateChanged(async (u) => {
    $("#admUser").hidden = !u;
    $("#admSignOut").hidden = !u;
    if (!u) {
      me = null;
      gate("لوحة الأدمن", "سجّل دخولك بالإيميل المسجّل كمشرف.", true);
      return;
    }
    $("#admUser").textContent = u.email;
    // حسابات الإيميل/كلمة السر تحتاج تأكيد الإيميل (قواعد Firestore تشترطه)
    if (!u.emailVerified) {
      try {
        await u.sendEmailVerification();
      } catch {}
      gate("أكّد إيميلك", `أرسلنا رابط تأكيد إلى ${u.email}. افتحه من بريدك، ثم حدّث هذه الصفحة.`, false, true);
      $("#admSignOut").hidden = false;
      return;
    }
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
    if ($("#builtinList").children.length) renderBuiltin();
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
      const meta = isBuiltin(c.id) ? "✏️ فئة أساسية معدّلة" : GROUP_LABEL[c.group] || "";
      b.innerHTML = `<span class="ai-ic">${esc(c.icon || "📁")}</span><span class="ai-nm">${esc(c.name)}</span><span class="ai-meta">${esc(meta)} · ${(c.questions || []).length} سؤال</span>`;
      b.addEventListener("click", () => {
        if (dirty && !confirm("فيه تعديلات غير محفوظة. تتركها؟")) return;
        loadIntoForm(c);
      });
      list.appendChild(b);
    });
  }

  function qRow(points = 200, q = "", a = "", img = "", aImg = "", extras = {}) {
    const row = document.createElement("div");
    row.className = "adm-q";
    if (Object.keys(extras).length) row.dataset.extras = JSON.stringify(extras);
    row.innerHTML = `
      <select aria-label="النقاط">${TIERS.map((p) => `<option value="${p}">${p}</option>`).join("")}</select>
      <input class="q" type="text" maxlength="500" placeholder="السؤال" aria-label="السؤال" />
      <input class="a" type="text" maxlength="500" placeholder="الإجابة" aria-label="الإجابة" />
      <button type="button" class="adm-imgbtn" aria-expanded="false" aria-label="صور السؤال والإجابة" title="صور السؤال والإجابة">🖼</button>
      <button type="button" class="adm-rm" aria-label="حذف السؤال">✕</button>
      <div class="adm-q-imgs" hidden>
        <div class="adm-q-img"><span>صورة السؤال</span><div class="aqi-row"><input class="qi" type="url" dir="ltr" placeholder="رابط، أو ارفع من جهازك" /><button type="button" class="btn btn-ghost btn-sm adm-up" data-for="qi">📤 رفع</button></div></div>
        <div class="adm-q-img"><span>صورة الإجابة</span><div class="aqi-row"><input class="ai" type="url" dir="ltr" placeholder="رابط، أو ارفع من جهازك" /><button type="button" class="btn btn-ghost btn-sm adm-up" data-for="ai">📤 رفع</button></div></div>
      </div>`;
    row.querySelector("select").value = String(points);
    if (MEDIA_ICON[extras.type]) row.querySelector(".q").placeholder = MEDIA_ICON[extras.type] + " السؤال (المقطع/الصورة يبقى كما هو)";
    if (MEDIA_ICON[extras.type]) row.classList.add("is-media");
    row.querySelector(".q").value = q;
    row.querySelector(".a").value = a;
    setImgField(row.querySelector(".qi"), img);
    setImgField(row.querySelector(".ai"), aImg);
    const imgs = row.querySelector(".adm-q-imgs");
    const imgBtn = row.querySelector(".adm-imgbtn");
    const syncImgBtn = () => imgBtn.classList.toggle("has", !!(imgFieldValue(row.querySelector(".qi")) || imgFieldValue(row.querySelector(".ai"))));
    row.querySelectorAll(".adm-up").forEach((b) =>
      b.addEventListener("click", async () => {
        const url = await pickImage(900, false);
        if (!url) return;
        setImgField(row.querySelector("." + b.dataset.for), url);
        syncImgBtn();
        changed();
        toast("🖼 تم رفع الصورة. احفظ الفئة لنشرها");
      })
    );
    row.querySelectorAll(".qi, .ai").forEach((inp) => inp.addEventListener("input", () => setImgField(inp, inp.value)));
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
    questions.forEach((q) => box.appendChild(qRow(q.points, q.q, q.a, q.img, q.aImg, extrasOf(q))));
    sortRows();
    updateTiers();
  }

  function setBuiltinMode(base) {
    $("#builtinNote").hidden = !base;
    $("#fGroup").disabled = !!base;
    $("#delCat").textContent = base ? "↩️ استرجاع الأسئلة الأصلية" : "🗑 حذف الفئة";
  }

  function newCategory() {
    editingId = null;
    setBuiltinMode(null);
    $$("#fGroup option[data-tmp]").forEach((o) => o.remove());
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
    const base = isBuiltin(c.id) ? builtinById(c.id) : null;
    const saved = cats.some((x) => x.id === c.id);
    setBuiltinMode(base);
    $("#edTitle").textContent = base ? `تعديل فئة أساسية: ${c.name}` : `تعديل: ${c.name}`;
    $("#fName").value = c.name || "";
    $("#fIcon").value = c.icon || "";
    const g = base ? base.group : c.group;
    const sel = $("#fGroup");
    $$("option[data-tmp]", sel).forEach((o) => o.remove());
    // مجموعة الفئة الأساسية (ألعاب، أنمي…) تُعرض كما هي؛ لا تتغير من هنا
    if (base && ![...sel.options].some((o) => o.value === g)) sel.append(Object.assign(document.createElement("option"), { value: g, textContent: GROUP_LABEL[g] || g }));
    $$("option", sel).forEach((o) => !["bio", "kuwait", "general"].includes(o.value) && o.setAttribute("data-tmp", ""));
    sel.value = [...sel.options].some((o) => o.value === g) ? g : "general";
    setImgField($("#fImg"), c.img || "");
    // الفئة الأساسية لم تُعدَّل بعد: لا شيء يُسترجع
    $("#delCat").hidden = base ? !saved : false;
    fillQuestions(c.questions || []);
    previewImg();
    $("#formErr").textContent = "";
    dirty = false;
    renderCatList();
  }

  function readForm() {
    const questions = $$("#qList .adm-q")
      .map((r) => {
        const x = { points: +r.querySelector("select").value, q: norm(r.querySelector(".q").value), a: norm(r.querySelector(".a").value), ...(r.dataset.extras ? JSON.parse(r.dataset.extras) : {}) };
        const img = imgFieldValue(r.querySelector(".qi"));
        const aImg = imgFieldValue(r.querySelector(".ai"));
        if (img) x.img = img;
        if (aImg) x.aImg = aImg;
        return x;
      })
      .filter((x) => x.q || x.a);
    return { name: norm($("#fName").value), icon: norm($("#fIcon").value) || "📁", group: $("#fGroup").value, img: imgFieldValue($("#fImg")), questions };
  }

  function validate(d) {
    if (!d.name) return "اكتب اسم الفئة.";
    const half = d.questions.find((x) => !x.q || !x.a);
    if (half) return "فيه سؤال بدون إجابة أو إجابة بدون سؤال. أكمله أو احذفه.";
    for (const p of TIERS) {
      const n = new Set(d.questions.filter((x) => x.points === p).map(qKey)).size;
      if (n < 2) return `تحتاج سؤالين مختلفين على الأقل بقيمة ${p} (عندك ${n}).`;
    }
    const seen = new Set();
    for (const x of d.questions) {
      if (seen.has(qKey(x))) return `السؤال مكرر: «${x.q}»`;
      seen.add(qKey(x));
    }
    const dupBuiltin = BUILTIN.find((c) => c.id !== editingId && c.questions.some((x) => seen.has(qKey(x))));
    if (dupBuiltin) return `أحد الأسئلة موجود أصلاً في فئة «${dupBuiltin.name}». غيّره حتى لا يتكرر في اللعبة.`;
    if (safeUrl(d.img) === null) return "رابط الصورة لازم يبدأ بـ https:// أو assets/";
    const badImg = d.questions.find((x) => safeUrl(x.img) === null || safeUrl(x.aImg) === null);
    if (badImg) return `رابط صورة غير صالح في السؤال «${badImg.q}» — لازم يبدأ بـ https:// أو assets/`;
    if (d.questions.length > 90) return "الحد الأقصى 90 سؤالاً للفئة.";
    if (JSON.stringify(d).length > MAX_DOC) return "الصور المرفوعة كبيرة على فئة وحدة. احذف بعض صور الأسئلة أو استخدم روابط بدلها.";
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
    const url = safeUrl(imgFieldValue($("#fImg")));
    const box = $("#fImgPrev");
    box.innerHTML = url ? `<img src="${esc(url)}" alt="" />` : `<span>${esc(norm($("#fIcon").value) || "📁")}</span>`;
  }

  function changed() {
    dirty = true;
    updateTiers();
  }

  ["#fName", "#fIcon", "#fGroup"].forEach((s) => $(s).addEventListener("input", changed));
  $("#fImg").addEventListener("input", () => {
    setImgField($("#fImg"), $("#fImg").value);
    changed();
    previewImg();
  });
  // الضغط على مربع الصورة يرفع صورة من الجهاز (تُقص مربعة 256px)
  $("#fImgPrev").addEventListener("click", async () => {
    const url = await pickImage(256, true);
    if (!url) return;
    setImgField($("#fImg"), url);
    previewImg();
    changed();
    toast("🖼 تم رفع صورة الفئة. احفظ لنشرها");
  });
  $("#fImgClear").addEventListener("click", () => {
    setImgField($("#fImg"), "");
    previewImg();
    changed();
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
    if (!editingId && BUILTIN_IDS.has(id)) return ($("#formErr").textContent = "معرّف محجوز لفئة أساسية.");
    // قواعد Firestore تقبل هذه المجموعات فقط؛ مجموعة الفئة الأساسية (ألعاب، أنمي…) تأخذها اللعبة من الملفات
    if (!["bio", "kuwait", "general"].includes(d.group)) d.group = "general";
    if (!d.img) delete d.img;
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
      toast(isBuiltin(id) ? "✅ تم الحفظ. النسخة المعدّلة تحل محل الأصلية في اللعبة" : "✅ تم الحفظ. الفئة ظاهرة الآن في اللعبة");
    } catch (e) {
      $("#formErr").textContent = "تعذّر الحفظ: " + (e.code === "permission-denied" ? "ليس لديك صلاحية، أو قواعد Firestore لم تُنشر بعد." : e.message || e);
    } finally {
      btn.disabled = false;
    }
  });

  $("#delCat").addEventListener("click", async () => {
    if (!editingId) return;
    const c = cats.find((x) => x.id === editingId);
    const base = isBuiltin(editingId) ? builtinById(editingId) : null;
    const msg = base
      ? `استرجاع الأسئلة الأصلية لفئة «${base.name}»؟ ستُحذف تعديلاتك وترجع الفئة كما في ملفات المشروع.`
      : `حذف فئة «${c ? c.name : ""}» نهائياً؟ ستختفي من اللعبة عند كل اللاعبين.`;
    if (!confirm(msg)) return;
    try {
      await db.collection("categories").doc(editingId).delete();
      toast(base ? "↩️ رجعت الفئة لأسئلتها الأصلية" : "🗑 تم حذف الفئة");
      await loadCats();
      if (base) loadIntoForm({ ...base, img: overrides.images[base.id] || base.img || "", questions: base.questions.slice() });
      else newCategory();
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
        setBuiltinMode(null);
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
        <div class="bi-imgwrap"><input class="bi-img" type="url" dir="ltr" placeholder="رابط صورة (اختياري)" aria-label="رابط صورة ${esc(c.name)}" /><button type="button" class="btn btn-ghost btn-sm bi-up" aria-label="رفع صورة ${esc(c.name)}">📤</button></div>
        <label class="bi-toggle"><input type="checkbox" ${hidden ? "" : "checked"} /> <span>${hidden ? "مخفية" : "ظاهرة"}</span></label>
        <button type="button" class="btn btn-ghost btn-sm bi-edit">${cats.some((x) => x.id === c.id) ? "✏️ معدّلة · افتح" : "✏️ عدّل الأسئلة"}</button>`;
      const biImg = row.querySelector(".bi-img");
      setImgField(biImg, overrides.images[c.id] || "");
      biImg.addEventListener("input", () => {
        setImgField(biImg, biImg.value);
        const v = imgFieldValue(biImg);
        if (v) overrides.images[c.id] = v;
        else delete overrides.images[c.id];
        dirty = true;
      });
      row.querySelector(".bi-up").addEventListener("click", async () => {
        const url = await pickImage(256, true);
        if (!url) return;
        overrides.images[c.id] = url;
        setImgField(biImg, url);
        dirty = true;
        toast("🖼 تم رفع الصورة. اضغط «حفظ التغييرات» لنشرها");
      });
      row.querySelector(".bi-edit").addEventListener("click", () => {
        if (dirty && !confirm("فيه تعديلات غير محفوظة. تتركها؟")) return;
        const saved = cats.find((x) => x.id === c.id);
        loadIntoForm(saved || { ...c, img: overrides.images[c.id] || c.img || "", questions: c.questions.slice() });
        $('.adm-tab[data-tab="cats"]').click();
        $("#fName").focus();
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
    if (JSON.stringify(overrides).length > MAX_DOC) return toast("مجموع صور الفئات الأساسية كبير. استخدم روابط لبعضها بدل الرفع.");
    const visible = BUILTIN.length - overrides.hidden.length + cats.filter((c) => !isBuiltin(c.id)).length;
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
