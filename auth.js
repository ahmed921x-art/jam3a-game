/* ===========================================================
   لَمة — نظام الحسابات (Firebase Auth + Firestore)
   نفس الواجهة القديمة: Auth.current() / Auth.key() / Auth.onChange()
   + دخول Google + مزامنة سحابية للإحصائيات والفئات الخاصة
   =========================================================== */

const Auth = (() => {
  const GUEST = { id: "guest", name: "ضيف", email: null, avatar: "👤", guest: true };
  const SYNC_BASES = ["stats", "history", "custom", "ach"]; // ما يُزامَن سحابياً
  const listeners = [];

  let user = GUEST; // نسخة متزامنة — Auth.current() تبقى فورية
  let syncTimer = null;
  let pendingUid = null;
  const pendingSync = {};

  function current() {
    return user;
  }
  function isLoggedIn() {
    return !user.guest;
  }
  function onChange(cb) {
    listeners.push(cb);
  }
  function emit() {
    listeners.forEach((cb) => cb(user));
  }

  // مفتاح تخزين محلي خاص بالمستخدم الحالي
  function key(base) {
    return `sj_u_${user.id}_${base}`;
  }

  function lsRead(base) {
    try {
      return JSON.parse(localStorage.getItem(key(base)));
    } catch {
      return null;
    }
  }

  function userDoc() {
    return FB.db.collection("users").doc(user.id);
  }

  // ---------- المزامنة السحابية ----------
  // تُستدعى من uWrite في game.js بعد كل كتابة محلية (دمج مع مهلة قصيرة)
  function cloudSet(base, value) {
    if (user.guest || !SYNC_BASES.includes(base)) return;
    if (pendingUid !== user.id) {
      clearTimeout(syncTimer);
      Object.keys(pendingSync).forEach((key) => delete pendingSync[key]);
      pendingUid = user.id;
    }
    pendingSync[base] = value;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (user.id !== pendingUid) return;
      const batch = { ...pendingSync, updatedAt: Date.now() };
      Object.keys(pendingSync).forEach((k) => delete pendingSync[k]);
      userDoc().set(batch, { merge: true }).catch(() => {});
    }, 800);
  }

  // عند الدخول: السحابة هي المرجع إن وُجدت، وإلا نرفع المحلي
  async function pullCloud() {
    const uid = user.id;
    try {
      const doc = FB.db.collection("users").doc(uid);
      const snap = await doc.get();
      if (user.id !== uid) return;
      const data = snap.exists ? snap.data() : {};
      const up = {};
      SYNC_BASES.forEach((base) => {
        if (data[base] !== undefined && data[base] !== null) {
          localStorage.setItem(`sj_u_${uid}_${base}`, JSON.stringify(data[base]));
        } else {
          let local = null;
          try { local = JSON.parse(localStorage.getItem(`sj_u_${uid}_${base}`)); } catch {}
          if (local !== null) up[base] = local;
        }
      });
      // الملف الشخصي (اسم/أفاتار) المخزن سحابياً يغلب
      if (data.profile && user.id === uid) {
        user = { ...user, name: data.profile.name || user.name, avatar: data.profile.avatar || user.avatar };
      } else {
        up.profile = { name: user.name, avatar: user.avatar };
      }
      if (Object.keys(up).length) {
        up.email = user.email;
        up.updatedAt = Date.now();
        await doc.set(up, { merge: true });
      }
    } catch (e) {
      // بدون اتصال: نكمل محلياً وستتم المزامنة لاحقاً
    }
  }

  // ---------- الدخول والخروج ----------
  async function googleLogin() {
    if (!FB.auth) return { ok: false, error: "تسجيل Google يحتاج اتصالاً بالإنترنت" };
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await FB.auth.signInWithPopup(provider);
      return { ok: true };
    } catch (e) {
      // بعض المتصفحات/الجوالات تمنع النوافذ المنبثقة → إعادة توجيه
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
        try {
          await FB.auth.signInWithRedirect(provider);
          return { ok: true };
        } catch (e2) {
          return { ok: false, error: e2 && e2.code ? e2.code : "auth/unknown" };
        }
      }
      return { ok: false, error: e && e.code ? e.code : "تعذّر تسجيل الدخول" };
    }
  }

  function logout() {
    FB.auth?.signOut().catch(() => {});
  }
  function continueAsGuest() {
    if (isLoggedIn()) logout();
    else emit();
  }

  function updateProfile({ name, avatar }) {
    if (user.guest) return { ok: false };
    if (name) user.name = name.trim();
    if (avatar) user.avatar = avatar;
    userDoc().set({ profile: { name: user.name, avatar: user.avatar } }, { merge: true }).catch(() => {});
    emit();
    return { ok: true };
  }

  // ---------- مراقبة حالة الدخول ----------
  FB.auth?.onAuthStateChanged(async (u) => {
    clearTimeout(syncTimer);
    pendingUid = null;
    Object.keys(pendingSync).forEach((key) => delete pendingSync[key]);
    if (u) {
      user = {
        id: u.uid,
        name: u.displayName || "لاعب",
        email: u.email,
        avatar: "🦊",
        guest: false,
      };
      await pullCloud();
    } else {
      user = GUEST;
    }
    emit();
  });

  return {
    current,
    isLoggedIn,
    onChange,
    key,
    googleLogin,
    logout,
    continueAsGuest,
    updateProfile,
    cloudSet,
  };
})();
