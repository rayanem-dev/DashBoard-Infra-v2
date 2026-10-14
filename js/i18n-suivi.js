/** Traductions des pages de suivi (Dossiers CPM, Avancement des chantiers, Suivi chantier) — voir js/i18n.js. [français, English, العربية] */
(function () {
  var T = [
    ['Dossiers CPM', 'CPM Files', 'ملفات CPM'], ['Division Infrastructure — RNS', 'Infrastructure Division — RNS', 'قسم البنى التحتية — RNS'], ['← Portail', '← Portal', 'البوابة →'],
    ['📂 Ouvrir le fichier', '📂 Open the file', '📂 فتح الملف'], ['Total dossiers', 'Total files', 'مجموع الملفات'],
    ['Attribué', 'Awarded', 'ممنوح'], ['Dossier en cours', 'File in progress', 'ملف قيد المعالجة'], ['Contrat en exécution', 'Contract in execution', 'عقد قيد التنفيذ'], ['Contrat échu', 'Expired contract', 'عقد منتهٍ'],
    ['Bloqué', 'Blocked', 'متوقف'], ['Infructueux', 'Unsuccessful', 'غير مثمر'], ['Non démarré', 'Not started', 'لم يبدأ'], ['Autre / non renseigné', 'Other / not filled in', 'أخرى / غير مُدخل'],
    ['Arrivée à échéance (contrats en exécution, ≥60% du délai consommé)', 'Nearing deadline (contracts in execution, ≥60% of the time used)', 'اقتراب الأجل (عقود قيد التنفيذ، استُهلك ≥60% من الأجل)'],
    ['Rechercher un intitulé, une entreprise, une adresse…', 'Search for a title, a company, an address…', 'ابحث عن عنوان أو مؤسسة أو عنوان بريدي…'],
    ['Attribution', 'Award', 'المنح'], ['⏳ Arrive à échéance', '⏳ Nearing deadline', '⏳ يقترب أجله'], ['consommé', 'used', 'مستهلك'], ['Jours restants', 'Days remaining', 'الأيام المتبقية'],
    ['Avancement des Chantiers', 'Site Progress', 'تقدّم الأشغال'], ['Vue globale', 'Global view', 'نظرة شاملة'], ['Projets & Prestations — Division Infra', 'Projects & Services — Infra Division', 'المشاريع والخدمات — قسم البنى التحتية'],
    ['Avancement global par service', 'Overall progress by department', 'التقدّم العام حسب المصلحة'], ['En pause', 'On hold', 'متوقف مؤقتًا'],
    ['Chantiers gelés temporairement — données conservées dans le fichier, exclues du calcul global. Reprise ultérieure.', 'Sites temporarily frozen — data kept in the file, excluded from the overall calculation. To resume later.', 'أشغال مجمّدة مؤقتًا — البيانات محفوظة في الملف ومستبعدة من الحساب العام. تُستأنف لاحقًا.'],
    ['🚧 Service Travaux Entretien', '🚧 Maintenance Works Department', '🚧 مصلحة أشغال الصيانة'], ['🔧 Service Électromécanique', '🔧 Electromechanical Department', '🔧 مصلحة الكهروميكانيك'],
    ['Actif', 'Active', 'نشط'], ['À venir', 'Coming soon', 'قريبًا'],
    ['Aucune fiche suiveuse renseignée pour l\'instant — ajoutée dès réception.', 'No tracking sheet filled in yet — added as soon as received.', 'لا توجد بطاقة متابعة مُدخلة حاليًا — تُضاف فور استلامها.'],
    ['📋 Contrats en exécution à activer', '📋 Contracts in execution to activate', '📋 عقود قيد التنفيذ للتفعيل'], ['recensement automatique CPM', 'automatic CPM census', 'إحصاء CPM التلقائي'],
    ['Fiche suiveuse non branchée', 'Tracking sheet not connected', 'بطاقة المتابعة غير موصولة'], ['⚠️ Chantiers non chargés', '⚠️ Sites not loaded', '⚠️ أشغال لم تُحمَّل'],
    ['Forage RNS — 3 puits d\'eau', 'RNS Drilling — 3 water wells', 'حفر RNS — 3 آبار مياه'], ['Terrassement RNS (36 mois)', 'RNS Earthworks (36 months)', 'أشغال التسوية RNS (36 شهرًا)'], ['Maintenance des Installations Électriques', 'Electrical Installations Maintenance', 'صيانة المنشآت الكهربائية'],
    ['Données de démonstration non disponibles pour cette source', 'Demo data not available for this source', 'بيانات العرض التجريبي غير متاحة لهذا المصدر'],
    ['Fiche suiveuse globale', 'Global tracking sheet', 'بطاقة المتابعة العامة'], ['FICHE SUIVEUSE GLOBALE', 'GLOBAL TRACKING SHEET', 'بطاقة المتابعة العامة'], ['Fichier maître — tous les chantiers', 'Master file — all sites', 'الملف الرئيسي — كل الأشغال'],
    ['Les fiches restent listées ci-dessous (grisées) pour mémoire, mais ne sont pas accessibles pour l\'instant.', 'The sheets remain listed below (greyed out) for reference, but are not accessible for now.', 'تبقى البطاقات مدرجة أدناه (باهتة) للتذكير لكنها غير متاحة حاليًا.'],
    ['Service Travaux Entretien', 'Maintenance Works Department', 'مصلحة أشغال الصيانة'], ['Lien conservé, en attente — dis-le-moi quand tu veux l\'activer', 'Link kept, on hold — tell me when you want to activate it', 'الرابط محفوظ في الانتظار — أخبرني متى تريد تفعيله'],
    ['Prestation de Maintenance des Installations Hydrauliques', 'Maintenance of Hydraulic Installations', 'خدمة صيانة المنشآت الهيدروليكية'], ['Lien à venir', 'Link coming soon', 'الرابط قريبًا'],
    ['Travaux de Dessablage Mécanique', 'Mechanical Desanding Works', 'أشغال إزالة الرمال آليًا'], ['Travaux de Dessablage Manuel', 'Manual Desanding Works', 'أشغال إزالة الرمال يدويًا'],
    ['Forage RNS (3 puits)', 'RNS Drilling (3 wells)', 'حفر RNS (3 آبار)'], ['Tableau de bord exécutif', 'Executive dashboard', 'لوحة القيادة التنفيذية'], ['Suivi global du contrat', 'Overall contract tracking', 'المتابعة العامة للعقد'],
    ['Service Électromécanique', 'Electromechanical Department', 'مصلحة الكهروميكانيك'], ['Prestation de Travaux de maintenance des installations électriques', 'Electrical Installations Maintenance Works', 'خدمة أشغال صيانة المنشآت الكهربائية'], ['Tableau de bord', 'Dashboard', 'لوحة القيادة'],
    ['Travaux de maintenance des installations de froid et climatisation', 'Refrigeration and Air-conditioning Maintenance Works', 'أشغال صيانة منشآت التبريد والتكييف'],
    ['Service Construction — en pause ⏸️', 'Construction Department — on hold ⏸️', 'مصلحة البناء — متوقفة مؤقتًا ⏸️'], ['Pause', 'On hold', 'متوقف'], ['Génie Civil (ETBE ZATOUT)', 'Civil Engineering (ETBE ZATOUT)', 'الهندسة المدنية (ETBE ZATOUT)'],
    ['Pointage MO/Matériel — synthèse annuelle', 'Labour/Equipment attendance — annual summary', 'تسجيل اليد العاملة/العتاد — الملخص السنوي'], ['Bassin CPF (tab de suivi)', 'CPF Basin (tracking tab)', 'حوض CPF (جدول المتابعة)'],
    ['Suivi journalier — Plate-forme/Talus', 'Daily tracking — Platform/Embankment', 'متابعة يومية — المنصة/المنحدر'], ['Les Abris', 'The Shelters', 'المآوي'], ['Fiche suiveuse indépendante', 'Independent tracking sheet', 'بطاقة متابعة مستقلة'],
    ['Stades', 'Stadiums', 'الملاعب'], ['Mosquée', 'Mosque', 'المسجد'], ['Piscine', 'Swimming pool', 'المسبح'], ['Studio (cadre)', 'Studio (frame)', 'الاستوديو (الإطار)'],
    ['Plans de situation — par projet (Service Construction, en pause)', 'Site plans — by project (Construction Department, on hold)', 'مخططات الوضعية — حسب المشروع (مصلحة البناء، متوقفة)'], ['Plan de situation', 'Site plan', 'مخطط الوضعية'], ['Lien manquant', 'Missing link', 'رابط مفقود'],
    ['Dossier projet complet (Drive)', 'Complete project folder (Drive)', 'ملف المشروع الكامل (Drive)'], ['Dossier "Dashboard"', '“Dashboard” folder', 'مجلد «Dashboard»'], ['Tous les fichiers projet réunis', 'All project files together', 'كل ملفات المشروع مجتمعة'],
    ['⚠️ Cette page ne contient que les liens pour l\'instant (accès rapide à un seul endroit). Le résumé d\'avancement global et détaillé par chantier, avec les pourcentages, est sur la page', '⚠️ This page only contains the links for now (quick access in one place). The overall and detailed progress summary by site, with percentages, is on the page', '⚠️ تحتوي هذه الصفحة على الروابط فقط حاليًا (وصول سريع من مكان واحد). ملخص التقدّم العام والمفصّل حسب الورشة مع النسب موجود في صفحة'],
    ['"📊 Avancement Chantiers"', '“📊 Site Progress”', '«📊 تقدّم الأشغال»'], ['(en haut à droite) — on continue à l\'enrichir ensemble.', '(top right) — we keep enriching it together.', '(أعلى اليمين) — نواصل إثراءها معًا.'],
    ['🕘 Journal des changements (90 derniers jours)', '🕘 Change log (last 90 days)', '🕘 سجل التغييرات (آخر 90 يومًا)'],
    ['Aucun changement enregistré pour le moment.', 'No change recorded yet.', 'لم يُسجَّل أي تغيير حتى الآن.'],
    ['Le journal démarre à la première lecture de la feuille (chaque nuit).', 'The log starts at the first reading of the sheet (every night).', 'يبدأ السجل عند أول قراءة للجدول (كل ليلة).'],
    ['Nouveau', 'New', 'جديد'], ['Retiré', 'Removed', 'محذوف'], ['(vide)', '(empty)', '(فارغ)'],
    ['Étape', 'Stage', 'المرحلة'], ['Date limite', 'Deadline', 'التاريخ الأقصى'], ['Échéance (passation)', 'Deadline (award)', 'الأجل (الإبرام)'], ['Avancement', 'Progress', 'التقدّم'],
    ['Commentaire', 'Comment', 'تعليق'], ['Attribution finale', 'Final award', 'المنح النهائي'], ['Attribué à', 'Awarded to', 'ممنوح لـ'], ['N° de contrat', 'Contract no.', 'رقم العقد'],
    ['Date de signature', 'Signature date', 'تاريخ التوقيع'], ['Date ODS', 'Start order date', 'تاريخ أمر الخدمة'], ['Durée du contrat (mois)', 'Contract duration (months)', 'مدة العقد (أشهر)'], ['Échéance du contrat', 'Contract deadline', 'أجل العقد'],
    ['Intitulé', 'Title', 'العنوان'],
    ['📋 Texte pour le rapport hebdomadaire (colonne O.B.S du PowerPoint)', '📋 Text for the weekly report (O.B.S column of the PowerPoint)', '📋 نص التقرير الأسبوعي (عمود الملاحظات O.B.S في العرض)'],
    ['Choisissez la semaine (du samedi au vendredi), puis cliquez sur « Copier » à côté d\'un dossier et collez dans la case O.B.S de la diapositive : le texte est déjà en', 'Choose the week (Saturday to Friday), then click “Copy” next to a file and paste into the O.B.S cell of the slide: the text is already in', 'اختر الأسبوع (من السبت إلى الجمعة) ثم انقر على «نسخ» بجانب الملف والصق في خانة O.B.S من الشريحة: النص مكتوب مسبقًا بـ'],
    ['gras', 'bold', 'الخط الغليظ'], ['Semaine', 'Week', 'الأسبوع'], ['Copier', 'Copy', 'نسخ'], ['Copié ✓', 'Copied ✓', 'تم النسخ ✓'], ['Aucun changement cette semaine.', 'No change this week.', 'لا تغيير هذا الأسبوع.'],
    ['DAO et CF', 'DAO and CF', 'DAO و CF'], ['Les contrats d\'application', 'Application contracts', 'عقود التطبيق'], ['Contrats d\'application convention cadre', 'Framework agreement application contracts', 'عقود تطبيق الاتفاقية الإطارية'],
    ['Autres types (non repris dans le rapport)', 'Other types (not included in the report)', 'أنواع أخرى (غير مدرجة في التقرير)'],
    ['🕘 Le journal des changements du CPM (90 derniers jours)', '🕘 The CPM change log (last 90 days)', '🕘 سجل تغييرات CPM (آخر 90 يومًا)'],
    ['Le journal des changements du CPM', 'The CPM change log', 'سجل تغييرات CPM'], ['Semaines du samedi au vendredi', 'Weeks from Saturday to Friday', 'أسابيع من السبت إلى الجمعة'], ['Tout voir', 'See all', 'عرض الكل'],
    ['Suivi Chantier', 'Site Tracking', 'متابعة الورشة'], ['Avancement Chantiers', 'Site Progress', 'تقدّم الأشغال'], ['📊 Avancement Chantiers', '📊 Site Progress', '📊 تقدّم الأشغال'], ['📋 Suivi CPM', '📋 CPM Tracking', '📋 متابعة CPM'],
    ['FICHE SUIVEUSE GLOBALE', 'GLOBAL TRACKING SHEET', 'بطاقة المتابعة العامة']
  ];
  var en = {}, ar = {};
  T.forEach(function (r) { en[r[0]] = r[1]; ar[r[0]] = r[2]; });
  function motifs(l) {
    var E = l === 'en';
    function jours(n) { return E ? n + ' d.' : n + ' ي'; }
    function duree(txt) { // « 1 mois et 10 jours », « 1 mois », « 12 jours »
      return String(txt).replace(/(\d+) mois/g, function (_, n) { return E ? n + ' month' + (n > 1 ? 's' : '') : n + ' شهر'; }).replace(/(\d+) jours?/g, function (_, n) { return E ? n + ' day' + (n > 1 ? 's' : '') : n + ' يومًا'; }).replace(/ et /g, E ? ' and ' : ' و');
    }
    return [
      [/^Du (\d\d\/\d\d\/\d{4}) au (\d\d\/\d\d\/\d{4})$/, function (a, b) { return E ? 'From ' + a + ' to ' + b : 'من ' + a + ' إلى ' + b; }],
      [/^(DAO et CF|Les contrats d'application|Contrats d'application convention cadre|Autres types \(non repris dans le rapport\)) \((\d+)\)$/, function (t, n) { return I18n.t(t) + ' (' + n + ')'; }],
      [/^Statut : (.*) → (.*)$/, function (a, b) { return (E ? 'Status: ' : 'الحالة: ') + I18n.t(a) + ' → ' + I18n.t(b); }],
      [/^Nouveau dossier — (.+)$/, function (st) { return (E ? 'New file — ' : 'ملف جديد — ') + I18n.t(st); }],
      [/^Semaine du (.+) au (.+)$/, function (a, b) { return E ? 'Week from ' + a + ' to ' + b : 'الأسبوع من ' + a + ' إلى ' + b; }],
      [/^Nouveau dossier : (.+?)(?: \((.+)\))?$/, function (n, st) { return (E ? 'New file: ' : 'ملف جديد: ') + n + (st ? ' (' + I18n.t(st) + ')' : ''); }],
      [/^Dossier retiré du suivi : (.+)$/, function (n) { return (E ? 'File removed from tracking: ' : 'ملف محذوف من المتابعة: ') + n; }],
      [/^(.+) : passe de « (.*) » à « (.*) »$/, function (n, a, b) { return E ? n + ': changes from “' + I18n.t(a) + '” to “' + I18n.t(b) + '”' : n + ': ينتقل من «' + I18n.t(a) + '» إلى «' + I18n.t(b) + '»'; }],
      [/^(.+) — ([^:—]+) : (.*) → (.*)$/, function (n, l, a, b) { return n + ' — ' + I18n.t(l.trim()) + ' : ' + I18n.t(a) + ' → ' + I18n.t(b); }],
      [/^Dernière lecture de la feuille : (.+)$/, function (d) { return (E ? 'Last reading of the sheet: ' : 'آخر قراءة للجدول: ') + d; }],
      [/^ — (.+)$/, function (v) { return ' — ' + I18n.t(v); }],
      [/^ : (.*) → (.*)$/, function (a, b) { return ' : ' + I18n.t(a) + ' → ' + I18n.t(b); }],
      [/^(\d+) j\.$/, function (n) { return jours(n); }],
      [/^il reste (.+)$/, function (d) { return (E ? 'remaining: ' : 'المتبقي: ') + duree(d); }],
      [/^⏳ (\d+)$/, function (n) { return '⏳ ' + n; }],
      [/^📁 Service (.+) — (\d+) en attente de branchement$/, function (s, n) { return E ? '📁 ' + s + ' Department — ' + n + ' awaiting connection' : '📁 مصلحة ' + s + ' — ' + n + ' في انتظار الربط'; }],
      [/^Tableau de bord exécutif — ([\d,]+)% réalisé$/, function (p) { return E ? 'Executive dashboard — ' + p + '% completed' : 'لوحة القيادة التنفيذية — ' + p + '% منجز'; }],
      [/^Tableau de bord — ([\d,]+)% consommé$/, function (p) { return E ? 'Dashboard — ' + p + '% used' : 'لوحة القيادة — ' + p + '% مستهلك'; }],
      [/^Suivi global du contrat — ([\d,]+)% réalisé$/, function (p) { return E ? 'Overall contract tracking — ' + p + '% completed' : 'المتابعة العامة للعقد — ' + p + '% منجز'; }],
      [/^Fiche suiveuse indépendante \(Suivi_MCM000 — (\d+) lots\)$/, function (n) { return E ? 'Independent tracking sheet (Suivi_MCM000 — ' + n + ' lots)' : 'بطاقة متابعة مستقلة (Suivi_MCM000 — ' + n + ' حصص)'; }],
      [/^⏸️ Le$/, function () { return E ? '⏸️ The' : '⏸️'; }],
      [/^est actuellement mis en pause — on se concentre sur les autres services\. (.+)$/, function (r) { return (E ? 'is currently on hold — we are focusing on the other departments. ' : 'متوقفة حاليًا — نركّز على المصالح الأخرى. ') + I18n.t(r); }]
    ];
  }
  I18n.dico({ en: en, ar: ar }, { en: motifs('en'), ar: motifs('ar') });
})();
