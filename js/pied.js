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
      'html[data-theme="dark"] body > header { filter: none; }';
    document.head.appendChild(st);
  }
  function charger(src, suite) { var s = document.createElement('script'); s.src = BASE + src; s.onload = suite; s.onerror = suite; document.head.appendChild(s); }
  function monter() {
    if (!window.BasDePage) return;
    BasDePage.monter({
      nom: NOM || 'Portail Infra', version: window.PORTAIL_VERSION || '',
      surVersion: function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); if (window.Nouveautes) Nouveautes.ouvrir(); },
      comparer: { urlSite: BASE + 'version.json' },
      copyright: '© 2026 JawlaDev — Tous droits réservés', copyrightLien: { texte: 'JawlaDev', href: 'https://rayanem-dev.github.io/JawlaDev/' },
      actualiser: function () { location.reload(); },
      langues: [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']], langue: 'fr',
      surLangue: function (code) { if (window.I18n) I18n.appliquer(code); },
      t: function (texte) { return window.I18n ? I18n.t(texte) : texte; },
      surTheme: function () { document.dispatchEvent(new Event('infra-theme')); },
      cle: 'infra'
    });
    if (window.I18n) I18n.appliquer(BasDePage.langue()); // langue mémorisée (basdepage règle lang/dir, la traduction du texte est faite ici)
  }
  // version → nouveautés → traduction (moteur + dictionnaire) → pied de page (qui applique la langue mémorisée)
  charger('js/version.js', function () { var bv = document.getElementById('bandeau-version'); if (bv && window.PORTAIL_VERSION) bv.textContent = 'Sonatrach · RNS · Version ' + window.PORTAIL_VERSION; charger('js/nouveautes.js', function () { charger('js/i18n.js', function () { charger('js/i18n-dico.js', function () { charger('js/i18n-apps.js', function () { charger('js/i18n-suivi.js', function () { charger('js/basdepage.js', monter); }); }); }); }); }); });
})();
