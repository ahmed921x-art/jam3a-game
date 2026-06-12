/* ===========================================================
   لَمة — نظام اللغتين (عربي / إنجليزي)
   =========================================================== */

const I18N = (() => {
  const DICT = {
    ar: {
      dir: "rtl",
      tagline: "لعبة المسابقات رقم ١ — فريقان، فئات، وتحدٍّ لا يُنسى",
      hero_sub: "اختر فئاتك، اجمع فريقك، وابدأ معركة المعلومات بأجواء احترافية.",
      play_now: "ابدأ اللعب الآن 🚀",
      how_play: "كيف تلعب؟",
      feat_title: "ليش لَمة؟",
      f1_t: "فئات لا تنتهي",
      f1_d: "عشرات الفئات وأسئلة عشوائية تتجدد كل لعبة.",
      f2_t: "محرر خاص",
      f2_d: "أضف فئاتك وأسئلتك واحفظها وشاركها.",
      f3_t: "أجواء احترافية",
      f3_d: "أصوات، مؤثرات، كونفيتي، وتصميم عالمي.",
      f4_t: "يعمل بدون نت",
      f4_d: "ثبّتها كتطبيق والعب في أي مكان.",
      step1: "اختر فريقين وسمّهما",
      step2: "اختر 6 فئات",
      step3: "جاوب واجمع النقاط",
      step4: "الأعلى نقاطاً يفوز 🏆",
      stat_cats: "فئة",
      stat_q: "سؤال",
      stat_games: "لعبة لُعبت",
      teams_h: "أسماء الفريقين",
      team1_ph: "الفريق الأزرق",
      team2_ph: "الفريق الأحمر",
      team1_l: "الفريق الأول",
      team2_l: "الفريق الثاني",
      cats_h: "اختر الفئات",
      cats_hint_a: "اختر",
      cats_hint_b: "فئات بالضبط",
      editor_btn: "محرر الفئات",
      settings_h: "الإعدادات",
      timer_l: "مدة المؤقت لكل سؤال",
      rand_l: "عشوائية الأسئلة",
      rand_on: "عشوائي 🎲",
      rand_off: "ثابت",
      theme_l: "الثيم",
      golden_l: "👑 الجولة الذهبية (رهان نقاط على سؤال أخير)",
      golden_on: "تشغيل 👑",
      golden_off: "إيقاف",
      start: "ابدأ اللعب 🚀",
      resume_msg: "عندك لعبة محفوظة لم تكتمل",
      resume: "استكمال",
      del: "حذف",
      back_setup: "رجوع",
      result_h: "النتيجة",
      new_game: "لعبة جديدة",
      switch_turn: "تبديل الدور",
      end_game: "إنهاء اللعبة",
      exit: "خروج",
      footer: "صُنع بشغف لعشاق التحدي",
    },
    en: {
      dir: "ltr",
      tagline: "The #1 Trivia Game — Two Teams, Endless Categories, Pure Fun",
      hero_sub: "Pick your categories, gather your team, and start an epic battle of knowledge.",
      play_now: "Play Now 🚀",
      how_play: "How to play?",
      feat_title: "Why Lamma?",
      f1_t: "Endless Categories",
      f1_d: "Dozens of categories with fresh random questions every game.",
      f2_t: "Custom Editor",
      f2_d: "Add your own categories & questions, save and share them.",
      f3_t: "Premium Vibes",
      f3_d: "Sounds, effects, confetti, and a world-class design.",
      f4_t: "Works Offline",
      f4_d: "Install it as an app and play anywhere.",
      step1: "Create & name two teams",
      step2: "Pick 6 categories",
      step3: "Answer & score points",
      step4: "Highest score wins 🏆",
      stat_cats: "Categories",
      stat_q: "Questions",
      stat_games: "Games Played",
      teams_h: "Team Names",
      team1_ph: "Blue Team",
      team2_ph: "Red Team",
      team1_l: "Team One",
      team2_l: "Team Two",
      cats_h: "Choose Categories",
      cats_hint_a: "Choose exactly",
      cats_hint_b: "categories",
      editor_btn: "Category Editor",
      settings_h: "Settings",
      timer_l: "Timer per question",
      rand_l: "Question randomness",
      rand_on: "Random 🎲",
      rand_off: "Fixed",
      theme_l: "Theme",
      golden_l: "👑 Golden Round (wager points on a final question)",
      golden_on: "On 👑",
      golden_off: "Off",
      start: "Start Game 🚀",
      resume_msg: "You have an unfinished saved game",
      resume: "Resume",
      del: "Delete",
      back_setup: "Back",
      result_h: "Result",
      new_game: "New Game",
      switch_turn: "Switch Turn",
      end_game: "End Game",
      exit: "Exit",
      footer: "Made with passion for challenge lovers",
    },
  };

  let lang = "ar";

  function t(key) {
    return (DICT[lang] && DICT[lang][key]) || (DICT.ar[key] ?? key);
  }

  function apply(l) {
    lang = DICT[l] ? l : "ar";
    const d = DICT[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = d.dir;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    return lang;
  }

  return { t, apply, get lang() { return lang; } };
})();
