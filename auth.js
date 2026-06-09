/* ===========================================================
   جمعة — نظام الحسابات (محلي، يعمل بدون سيرفر)
   تخزين الحسابات في localStorage مع تجزئة بسيطة لكلمة المرور.
   ملاحظة: للحماية الحقيقية عبر الأجهزة استبدل بـ Firebase Auth.
   =========================================================== */

const Auth = (() => {
  const K_USERS = "sj_users";
  const K_SESSION = "sj_session";
  const listeners = [];

  function read(k, def) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? def;
    } catch {
      return def;
    }
  }
  function write(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  }

  // تجزئة بسيطة (ليست تشفيراً قوياً — للاستخدام المحلي فقط)
  function hash(str) {
    let h = 5381;
    const salt = "seenjeem~salt~9x";
    const s = salt + str + salt;
    for (let i = 0; i < s.length; i++) {
      h = (h * 33) ^ s.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
  }

  function users() {
    return read(K_USERS, {});
  }

  const GUEST = { id: "guest", name: "ضيف", email: null, avatar: "👤", guest: true };

  function current() {
    const email = localStorage.getItem(K_SESSION);
    if (!email) return GUEST;
    const u = users()[email.toLowerCase()];
    return u ? sanitize(u) : GUEST;
  }

  function sanitize(u) {
    return { id: u.id, name: u.name, email: u.email, avatar: u.avatar, guest: false };
  }

  function isLoggedIn() {
    return !current().guest;
  }

  function emit() {
    const u = current();
    listeners.forEach((cb) => cb(u));
  }
  function onChange(cb) {
    listeners.push(cb);
  }

  function validEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function signup({ name, email, pass, avatar }) {
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    if (name.length < 2) return { ok: false, error: "الاسم قصير جداً" };
    if (!validEmail(email)) return { ok: false, error: "البريد غير صالح" };
    if ((pass || "").length < 4) return { ok: false, error: "كلمة المرور 4 أحرف على الأقل" };
    const db = users();
    if (db[email]) return { ok: false, error: "هذا البريد مسجّل مسبقاً" };
    const user = {
      id: "u_" + Date.now().toString(36),
      name,
      email,
      avatar: avatar || "🦊",
      hash: hash(pass),
      createdAt: Date.now(),
    };
    db[email] = user;
    write(K_USERS, db);
    localStorage.setItem(K_SESSION, email);
    emit();
    return { ok: true, user: sanitize(user) };
  }

  function login(email, pass) {
    email = (email || "").trim().toLowerCase();
    const u = users()[email];
    if (!u) return { ok: false, error: "لا يوجد حساب بهذا البريد" };
    if (u.hash !== hash(pass)) return { ok: false, error: "كلمة المرور غير صحيحة" };
    localStorage.setItem(K_SESSION, email);
    emit();
    return { ok: true, user: sanitize(u) };
  }

  function logout() {
    localStorage.removeItem(K_SESSION);
    emit();
  }

  function continueAsGuest() {
    localStorage.removeItem(K_SESSION);
    emit();
  }

  // تحديث الملف الشخصي (اسم/أفاتار)
  function updateProfile({ name, avatar }) {
    const u = current();
    if (u.guest) return { ok: false };
    const db = users();
    const rec = db[u.email];
    if (!rec) return { ok: false };
    if (name) rec.name = name.trim();
    if (avatar) rec.avatar = avatar;
    write(K_USERS, db);
    emit();
    return { ok: true };
  }

  // مفتاح تخزين خاص بالمستخدم الحالي (للإحصائيات والفئات والحفظ)
  function key(base) {
    return `sj_u_${current().id}_${base}`;
  }

  return {
    current,
    isLoggedIn,
    signup,
    login,
    logout,
    continueAsGuest,
    updateProfile,
    onChange,
    key,
  };
})();
