/* Pied de page commun : brique « basdepage » de la bibliothèque lib (ligne de version avec ✓ / ⚠ / ?, nouveautés, copyright, actualiser).
 * Une seule ligne dans chaque page : <script src="js/pied.js"></script>. Langue (français, arabe, anglais) et thème clair / sombre en bas à droite ; la traduction des pages est faite par js/i18n.js. */
(function () {
  // Depuis une application Apps Script : <script src="https://…/js/pied.js" data-nom="Nom de l'application"></script> — tout est alors chargé depuis l'adresse du site.
  var me = document.currentScript, BASE = me && me.src ? me.src.replace(/js\/pied\.js(\?.*)?$/, '') : '', NOM = me && me.getAttribute('data-nom');
  if (NOM) {
    var st = document.createElement('style');
    // thème sombre pour des pages qui n'ont pas de variables de thème : on inverse la page (les teintes sont conservées), sauf en-tête et images
    st.textContent = 'html[data-theme="dark"] body { background: #11151c !important; }' +
      'html[data-theme="dark"] body > :not(.bdp-prefs):not(.bdp-foot):not(script):not(style) { filter: invert(.92) hue-rotate(180deg); }' +
      'html[data-theme="dark"] body > :not(.bdp-prefs) header, html[data-theme="dark"] body > :not(.bdp-prefs) img { filter: invert(.92) hue-rotate(180deg); }' +
      'html[data-theme="dark"] body > header { filter: none !important; }';
    document.head.appendChild(st);
  }
  /** Télécharge toutes les pièces en parallèle ; elles s'exécutent dans l'ordre de la liste (async=false). */
  function chargerTout(liste, suite) {
    var restant = liste.length; if (!restant) { suite(); return; }
    liste.forEach(function (src) {
      var s = document.createElement('script'); s.src = BASE + src; s.async = false;
      s.onload = s.onerror = function () { restant -= 1; if (!restant) suite(); };
      document.head.appendChild(s);
    });
  }
  var TRADUCTION = ['js/i18n.js', 'js/i18n-dico.js', 'js/i18n-apps.js', 'js/i18n-suivi.js'];
  /** Moteur et dictionnaires de traduction : chargés seulement quand la langue n'est pas le français (≈ 130 ko économisés sinon). */
  function avecTraduction(suite) { if (window.I18n) { suite(); return; } chargerTout(TRADUCTION, suite); }
  function langueMemorisee() { try { return localStorage.getItem('infra-lang') || 'fr'; } catch (e) { return 'fr'; } }
  function monter() {
    if (!window.BasDePage) return;
    BasDePage.monter({
      nom: NOM || 'Portail Infra', version: window.PORTAIL_VERSION || '',
      surVersion: function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); if (window.Nouveautes) Nouveautes.ouvrir(); },
      comparer: { urlSite: BASE + 'version.json' },
      copyright: '© 2026 JawlaDev — Tous droits réservés', copyrightLien: { texte: 'JawlaDev', href: 'https://rayanem-dev.github.io/JawlaDev/' },
      actualiser: function () { location.reload(); },
      langues: [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']], langue: 'fr',
      surLangue: function (code) { if (code === 'fr' && !window.I18n) return; avecTraduction(function () { if (window.I18n) I18n.appliquer(code); }); },
      t: function (texte) { return window.I18n ? I18n.t(texte) : texte; },
      surTheme: function () { document.dispatchEvent(new Event('infra-theme')); },
      cle: 'infra'
    });
    var l = BasDePage.langue(); if (l !== 'fr') avecTraduction(function () { I18n.appliquer(l); }); // langue mémorisée (basdepage règle lang/dir, la traduction du texte est faite ici)
  }
  // version, nouveautés et pied de page ; la traduction n'est chargée qu'en arabe / anglais (avant le pied de page, pour que ses textes soient traduits)
  var pieces = ['js/version.js', 'js/nouveautes.js'].concat(langueMemorisee() === 'fr' ? [] : TRADUCTION, ['js/basdepage.js']);
  chargerTout(pieces, function () {
    var bv = document.getElementById('bandeau-version'); if (bv && window.PORTAIL_VERSION) bv.textContent = 'Sonatrach · RNS · Version ' + window.PORTAIL_VERSION;
    monter();
  });
})();
