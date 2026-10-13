/* ===========================================================
   بايو (BIO) — فئات الأحياء الجديدة + تصنيف كل الفئات
   - يُحمَّل بعد ملفات الأسئلة الأخرى وقبل game.js
   - مصادر التحقق ومراجعة الحقائق: CONTENT-REVIEW.md
   =========================================================== */

CATEGORIES.push(
  {
    id: "cell",
    name: "الخلية",
    icon: "🔬",
    questions: [
      { points: 200, q: "ما الوحدة الأساسية التي تتكوّن منها كل الكائنات الحية؟", a: "الخلية" },
      { points: 200, q: "أي عضيّة تُلقَّب بـ«مصنع الطاقة» في الخلية؟", a: "الميتوكوندريا (المتقدّرات)" },
      { points: 200, q: "في أي عضيّة تحدث عملية البناء الضوئي داخل خلايا النبات؟", a: "البلاستيدات الخضراء" },
      { points: 200, q: "ما التركيب الذي يحيط بالخلية وينظّم دخول المواد وخروجها؟", a: "الغشاء الخلوي (الغشاء البلازمي)" },
      { points: 400, q: "ما العضيّات الصغيرة التي تُصنع عليها البروتينات؟", a: "الريبوسومات" },
      { points: 400, q: "ماذا يُسمّى انقسام الخلية الذي ينتج خليتين متطابقتين وراثياً؟", a: "الانقسام المتساوي (الميتوزي)" },
      { points: 400, q: "ما المادة الرئيسية التي يتكوّن منها الجدار الخلوي في النبات؟", a: "السليلوز" },
      { points: 400, q: "البكتيريا خلايا بلا نواة حقيقية. ماذا نسمّي هذا النوع من الخلايا؟", a: "خلايا بدائية النواة" },
      { points: 600, q: "ما اسم الجزيء الذي تستخدمه الخلية مباشرة كعملة للطاقة؟", a: "ATP (أدينوسين ثلاثي الفوسفات)" },
      { points: 600, q: "أي عضيّة تعدّل البروتينات وتغلّفها وترسلها إلى وجهتها؟", a: "جهاز غولجي" },
      { points: 600, q: "ماذا يُسمّى الموت المبرمج للخلية؟", a: "الاستماتة (Apoptosis)" },
      { points: 600, q: "من العالِم الذي رأى «خلايا» الفلين بمجهره وسمّاها بهذا الاسم عام 1665؟", a: "روبرت هوك" },
    ],
  },
  {
    id: "genetics",
    name: "الوراثة والحمض النووي",
    icon: "🧬",
    questions: [
      { points: 200, q: "ما الشكل الشهير لجزيء DNA؟", a: "لولب مزدوج" },
      { points: 200, q: "كم عدد الكروموسومات في الخلية الجسمية للإنسان؟", a: "46 كروموسوماً (23 زوجاً)" },
      { points: 200, q: "ماذا يُسمّى التغيّر الدائم في تسلسل DNA؟", a: "الطفرة" },
      { points: 200, q: "ما الكروموسومان اللذان يحددان الجنس عند الإنسان؟", a: "الكروموسومان X وY" },
      { points: 400, q: "ما القواعد النيتروجينية الأربع في DNA؟", a: "أدينين وثايمين وغوانين وسايتوسين (A, T, G, C)" },
      { points: 400, q: "في RNA تحلّ قاعدة أخرى محلّ الثايمين. ما هي؟", a: "اليوراسيل (U)" },
      { points: 400, q: "من الراهب الملقّب بـ«أبو علم الوراثة» الذي أجرى تجاربه على نبات البازلاء؟", a: "غريغور مندل" },
      { points: 400, q: "ماذا يعني الحرفان RNA بالعربية؟", a: "الحمض النووي الريبوزي" },
      { points: 600, q: "من العالمان اللذان نشرا نموذج اللولب المزدوج لـ DNA عام 1953؟", a: "جيمس واطسون وفرانسيس كريك" },
      { points: 600, q: "ما اسم عملية نسخ معلومات DNA إلى RNA؟", a: "النسخ (Transcription)" },
      { points: 600, q: "ما اسم أداة تعديل الجينات التي نالت عنها شاربنتييه ودودنا جائزة نوبل للكيمياء 2020؟", a: "كريسبر (CRISPR-Cas9)" },
      { points: 600, q: "ما المتلازمة الناتجة عن وجود نسخة إضافية من الكروموسوم 21؟", a: "متلازمة داون" },
    ],
  },
  {
    id: "microbes",
    name: "الأحياء الدقيقة",
    icon: "🦠",
    questions: [
      { points: 200, q: "ما الجهاز الذي نرى به الكائنات الدقيقة؟", a: "المجهر (الميكروسكوب)" },
      { points: 200, q: "إلى أي مجموعة من الكائنات تنتمي خميرة الخبز؟", a: "الفطريات" },
      { points: 200, q: "صح أو خطأ: المضادات الحيوية تقضي على الفيروسات", a: "خطأ ❌ — تعمل ضد البكتيريا، لا الفيروسات" },
      { points: 200, q: "ماذا نسمّي الكائن الدقيق الذي يسبب المرض؟", a: "المُمرِض (العامل الممرض / الجرثوم)" },
      { points: 400, q: "من اكتشف البنسلين عام 1928؟", a: "ألكسندر فليمنغ" },
      { points: 400, q: "من العالم الهولندي الذي وصف البكتيريا لأول مرة بمجهره البسيط في القرن السابع عشر؟", a: "أنطوني فان ليفينهوك" },
      { points: 400, q: "ما اسم الصبغة التي تقسّم البكتيريا إلى «موجبة» و«سالبة»؟", a: "صبغة غرام" },
      { points: 400, q: "أي نوع من البكتيريا يحوّل الحليب إلى لبن (زبادي)؟", a: "بكتيريا حمض اللاكتيك (اللبنية)" },
      { points: 600, q: "من طوّر أول لقاح (ضد الجدري) عام 1796؟", a: "إدوارد جينر" },
      { points: 600, q: "باسم أي عالم سُمّيت «البسترة»؟", a: "لويس باستور" },
      { points: 600, q: "ماذا تُسمّى الفيروسات التي تصيب البكتيريا؟", a: "العاثيات (البكتيريوفاج)" },
      { points: 600, q: "ما اسم الغلاف البروتيني الذي يحيط بالمادة الوراثية للفيروس؟", a: "القُفَيصة (الكابسيد)" },
    ],
  },
  {
    id: "ecology",
    name: "البيئة والتطور",
    icon: "🐢",
    questions: [
      { points: 200, q: "ماذا نسمّي الكائنات التي تصنع غذاءها بنفسها مثل النباتات؟", a: "المنتِجات (ذاتية التغذية)" },
      { points: 200, q: "أي غاز تمتصه النباتات من الهواء لتقوم بالبناء الضوئي؟", a: "ثاني أكسيد الكربون" },
      { points: 200, q: "ماذا نسمّي تسلسل «من يأكل من» في النظام البيئي؟", a: "السلسلة الغذائية" },
      { points: 200, q: "ماذا نسمّي الكائنات التي تحلّل بقايا الكائنات الميتة مثل بعض البكتيريا والفطريات؟", a: "المحلِّلات" },
      { points: 400, q: "من مؤلف كتاب «أصل الأنواع» عام 1859؟", a: "تشارلز داروين" },
      { points: 400, q: "أي أرخبيل اشتهر بعصافير داروين وسلاحفه العملاقة؟", a: "جزر غالاباغوس" },
      { points: 400, q: "ماذا نسمّي العلاقة التي يستفيد فيها الطرفان، مثل النحل والأزهار؟", a: "تبادل المنفعة (التقايض)" },
      { points: 400, q: "ما الطبقة في الغلاف الجوي التي تحمي الأرض من معظم الأشعة فوق البنفسجية؟", a: "طبقة الأوزون" },
      { points: 600, q: "ما المصطلح العلمي لتنوّع الكائنات الحية وأنواعها في منطقة ما؟", a: "التنوّع الحيوي" },
      { points: 600, q: "ما الكائنات البحرية الدقيقة التي يُقدَّر أنها تنتج نصف أكسجين الأرض تقريباً أو أكثر؟", a: "العوالق النباتية (الفيتوبلانكتون)" },
      { points: 600, q: "ما الجزيرة الكويتية الصغيرة التي تعشّش فيها السلاحف البحرية ومنها سلحفاة منقار الصقر؟", a: "جزيرة قاروه (وكذلك أم المرادم)" },
      { points: 600, q: "ماذا نسمّي الكائن الذي لم يتبقَّ منه أي فرد حي على الأرض؟", a: "منقرض" },
    ],
  }
);

CATEGORIES.push({
  id: "biotech",
  name: "BioTechnology",
  icon: "🧪",
  questions: [
    { points: 200, q: "What is biotechnology?", a: "Using living organisms (or their parts) to make useful products" },
    { points: 200, q: "What is insulin used to treat?", a: "Diabetes" },
    { points: 200, q: "Which biotechnology field focuses on developing medicines?", a: "Medical biotechnology" },
    { points: 200, q: "Which biotechnology field focuses on improving crops?", a: "Agricultural biotechnology" },
    { points: 200, q: "What is one example of biotechnology in food production?", a: "Making yogurt" },
    { points: 400, q: "What is CRISPR used for?", a: "Editing DNA" },
    { points: 400, q: "What is the process of making RNA from DNA?", a: "Transcription" },
    { points: 400, q: "What is a plasmid?", a: "A small circular DNA molecule (found in bacteria)" },
    { points: 400, q: "What does PCR stand for?", a: "Polymerase Chain Reaction" },
    { points: 400, q: "What is environmental biotechnology used for?", a: "Reducing pollution and treating waste" },
    { points: 600, q: "What are the three main steps of PCR?", a: "Denaturation, annealing, extension" },
    { points: 600, q: "What stain is commonly used to visualize DNA in gels?", a: "Ethidium bromide (or GelRed)" },
    { points: 600, q: "What does DNA stand for?", a: "Deoxyribonucleic acid" },
    { points: 600, q: "What are the main fields of biotechnology?", a: "Medical, agricultural, industrial, and environmental biotechnology" },
  ],
});

/* ---------- صور الفئات ----------
   ضع الصورة في مجلد assets/categories/ ثم اكتب اسم ملفها أمام معرّف الفئة.
   مثال:  cell: "cell.webp",
   الفئة بلا صورة تعرض رمزها التعبيري كالمعتاد. القائمة الكاملة للمعرّفات: assets/categories/README.md
*/
const CATEGORY_IMAGES = {
  // cell: "cell.webp",
  // genetics: "genetics.webp",
};

/* ---------- تصنيف الفئات للمنتقي (بحث/تصفية في bio-ui.js) ---------- */
(() => {
  const BIO = ["cell", "genetics", "microbes", "biotech", "ecology", "science", "body", "animals", "nature", "health", "space", "inventions"];
  const KUWAIT = ["kuwait", "kw-history", "kw-food", "kw-proverbs", "kw-dialect", "kw-places", "gulf-artists"];
  CATEGORIES.forEach((c) => {
    if (CATEGORY_IMAGES[c.id]) c.img = "assets/categories/" + CATEGORY_IMAGES[c.id];
    if (!c.group) c.group = BIO.includes(c.id) ? "bio" : KUWAIT.includes(c.id) ? "kuwait" : "general";
  });
  // الأحياء والعلوم أولاً، ثم الكويت، ثم العامة — مع الحفاظ على الترتيب الداخلي
  const rank = { bio: 0, kuwait: 1, general: 2 };
  const order = new Map(CATEGORIES.map((c, i) => [c, i]));
  const bioOrder = new Map(BIO.map((id, i) => [id, i]));
  CATEGORIES.sort((a, b) => {
    const r = (rank[a.group] ?? 3) - (rank[b.group] ?? 3);
    if (r) return r;
    if (a.group === "bio") return bioOrder.get(a.id) - bioOrder.get(b.id);
    return order.get(a) - order.get(b);
  });
})();
