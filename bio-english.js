/* ===========================================================
   بايو — الاسم الإنجليزي بجانب الجواب العربي في فئات «أحياء وعلوم»
   لمن درس المصطلح بالإنجليزي. يُطبَّق على فئات مجموعة bio فقط، فلا يغيّر أجوبة الفئات الأخرى.
   يُحمَّل بعد expansion-pack.js. عند إضافة سؤال علمي جديد: اكتب الإنجليزي في الجواب مباشرة
   أو أضفه هنا. الأرقام وأجوبة صح/خطأ لا تحتاج ترجمة.
   =========================================================== */
(() => {
  const EN = {
    // الخلية
    "الخلية": "Cell", "البلاستيدات الخضراء": "Chloroplasts", "الميتوكوندريا (المتقدّرات)": "Mitochondria", "الغشاء الخلوي (الغشاء البلازمي)": "Cell / Plasma membrane", "الريبوسومات": "Ribosomes", "الانقسام المتساوي (الميتوزي)": "Mitosis", "السليلوز": "Cellulose", "خلايا بدائية النواة": "Prokaryotic cells", "جهاز غولجي": "Golgi apparatus", "روبرت هوك": "Robert Hooke", "السيتوبلازم": "Cytoplasm", "النواة": "Nucleus", "الجسيم الحال (الليسوسوم)": "Lysosome",
    // الوراثة
    "لولب مزدوج": "Double helix", "46 كروموسوماً (23 زوجاً)": "46 chromosomes", "الطفرة": "Mutation", "غريغور مندل": "Gregor Mendel", "الحمض النووي الريبوزي": "RNA", "جيمس واطسون وفرانسيس كريك": "James Watson & Francis Crick", "متلازمة داون": "Down syndrome", "الجين": "Gene", "الثايمين": "Thymine",
    // الأحياء الدقيقة
    "المجهر (الميكروسكوب)": "Microscope", "الفطريات": "Fungi", "المُمرِض (العامل الممرض / الجرثوم)": "Pathogen", "ألكسندر فليمنغ": "Alexander Fleming", "أنطوني فان ليفينهوك": "Antonie van Leeuwenhoek", "صبغة غرام": "Gram stain", "بكتيريا حمض اللاكتيك (اللبنية)": "Lactic acid bacteria", "إدوارد جينر": "Edward Jenner", "لويس باستور": "Louis Pasteur", "العاثيات (البكتيريوفاج)": "Bacteriophages", "القُفَيصة (الكابسيد)": "Capsid", "الخميرة": "Yeast", "بدائيات النواة": "Prokaryotes", "البنسلين": "Penicillin",
    // التقنية الحيوية
    "زراعة الأنسجة": "Tissue culture", "كريسبر-كاس9": "CRISPR-Cas9",
    // البيئة
    "المنتِجات (ذاتية التغذية)": "Producers / Autotrophs", "ثاني أكسيد الكربون": "CO₂", "السلسلة الغذائية": "Food chain", "المحلِّلات": "Decomposers", "تشارلز داروين": "Charles Darwin", "جزر غالاباغوس": "Galápagos Islands", "تبادل المنفعة (التقايض)": "Mutualism", "تبادل المنفعة": "Mutualism", "طبقة الأوزون": "Ozone layer", "التنوّع الحيوي": "Biodiversity", "العوالق النباتية (الفيتوبلانكتون)": "Phytoplankton", "جزيرة قاروه (وكذلك أم المرادم)": "Qaruh & Umm Al-Maradim", "منقرض": "Extinct", "المنتِج": "Producer", "التراكم الحيوي": "Bioaccumulation",
    // العلوم العامة
    "الأكسجين": "Oxygen", "32 سناً": "32 teeth", "الأخضر": "Green", "300,000 كم في الثانية": "300,000 km/s", "النيوتن": "Newton", "إسحاق نيوتن": "Isaac Newton", "الألماس": "Diamond", "100 درجة مئوية": "100 °C", "الترمومتر": "Thermometer", "الحمل الحراري": "Convection", "الإلكترون": "Electron",
    // جسم الإنسان
    "القلب": "Heart", "اللمس": "Touch", "الرئتين": "Lungs", "الكبد": "Liver", "الحجاب الحاجز": "Diaphragm", "الكلى": "Kidneys", "عظمة الركاب (في الأذن)": "Stapes", "خلايا الدم الحمراء": "Red blood cells", "البنكرياس": "Pancreas", "الجمجمة": "Skull", "الأوردة": "Veins",
    // الحيوان
    "الفهد الصيّاد (الشيتا)": "Cheetah", "الحوت الأزرق": "Blue whale", "الهريرة": "Kitten", "ثلاثة قلوب": "Three hearts", "الجمل": "Camel", "الزرافة": "Giraffe", "البطريق": "Penguin", "ثماني أرجل": "Eight legs", "الفيل": "Elephant", "الضفدع": "Frog", "الخياشيم": "Gills", "الحيتانيات": "Cetaceans",
    // الطبيعة
    "البناء الضوئي": "Photosynthesis", "المطر": "Rain", "النخلة": "Palm tree", "الجذور": "Roots", "السيكويا الساحلية (الخشب الأحمر الساحلي)": "Coast redwood", "البرق": "Lightning", "دوّار الشمس (عبّاد الشمس)": "Sunflower", "البَرَد": "Hail", "التربة الصقيعية": "Permafrost",
    // الصحة
    "فيتامين د": "Vitamin D", "الرئتان": "Lungs", "الكالسيوم": "Calcium", "البرتقال (الحمضيات)": "Orange / Citrus", "السمّاعة الطبية (الستيثوسكوب)": "Stethoscope", "السكري": "Diabetes", "خلايا الدم البيضاء": "White blood cells", "الضغط الانقباضي": "Systolic pressure", "الصفائح الدموية": "Platelets",
    // الفضاء
    "الأرض": "Earth", "الشمس": "Sun", "القمر": "Moon", "المشتري": "Jupiter", "المريخ": "Mars", "درب التبانة": "Milky Way", "نيل أرمسترونغ": "Neil Armstrong", "زحل": "Saturn", "نبتون": "Neptune", "حزام الكويكبات": "Asteroid belt",
    // الاختراعات
    "توماس إديسون (طوّر أول مصباح عملي تجارياً)": "Thomas Edison", "الهاتف": "Telephone", "الطائرة": "Airplane", "غراهام بيل": "Alexander Graham Bell", "يوهانس غوتنبرغ": "Johannes Gutenberg", "فيلهلم رونتغن": "Wilhelm Röntgen", "ابن سينا": "Avicenna", "الخوارزمي": "Al-Khwarizmi", "المطبعة ذات الحروف المتحركة": "Movable-type printing press",
    // الدماغ والحواس
    "الدماغ": "Brain", "السمع": "Hearing", "القزحية": "Iris", "العصب البصري": "Optic nerve", "المخيخ": "Cerebellum", "العصبونات": "Neurons", "الناقل العصبي": "Neurotransmitter", "طبلة الأذن": "Eardrum", "البقعة العمياء": "Blind spot", "الخلايا المخروطية": "Cone cells", "غمد الميالين": "Myelin sheath", "جذع الدماغ": "Brainstem",
    // البحار
    "المحيط الهادئ": "Pacific Ocean", "الأخطبوط": "Octopus", "سرب أسماك": "School of fish", "حيوان المرجان": "Coral", "العوالق": "Plankton", "الدلفين": "Dolphin", "مصب النهر": "Estuary", "التعشيش": "Nesting", "كائنات ذات إضاءة حيوية": "Bioluminescent organisms", "المد والجزر": "Tides", "خندق ماريانا": "Mariana Trench", "تكافل": "Symbiosis",
    // مهمات الفضاء
    "سبوتنيك 1": "Sputnik 1", "ناسا": "NASA", "أبولو 11": "Apollo 11", "نيو هورايزنز": "New Horizons", "محطة الفضاء الدولية": "International Space Station", "يوري غاغارين": "Yuri Gagarin", "جيمس ويب": "James Webb", "فوياجر 1 وفوياجر 2": "Voyager 1 & 2", "أوسايرس ريكس": "OSIRIS-REx",
  };
  CATEGORIES.filter((c) => c.group === "bio").forEach((c) =>
    c.questions.forEach((q) => {
      if (EN[q.a]) q.a = `${q.a} (${EN[q.a]})`;
    })
  );
})();
