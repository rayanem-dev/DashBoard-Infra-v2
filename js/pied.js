/* Pied de page commun : brique « basdepage » de la bibliothèque lib (ligne de version avec ✓ / ⚠ / ?, nouveautés, copyright, actualiser).
 * Une seule ligne dans chaque page : <script src="js/pied.js"></script>. Langue (français, arabe, anglais) et thème clair / sombre en bas à droite ; la traduction des pages est faite par js/i18n.js. */
(function () {
  function charger(src, suite) { var s = document.createElement('script'); s.src = src; s.onload = suite; s.onerror = suite; document.head.appendChild(s); }
  function monter() {
    if (!window.BasDePage) return;
    BasDePage.monter({
      nom: 'Portail Infra', version: window.PORTAIL_VERSION || '',
      surVersion: function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); if (window.Nouveautes) Nouveautes.ouvrir(); },
      comparer: { urlSite: 'version.json' },
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
  charger('js/version.js', function () { charger('js/nouveautes.js', function () { charger('js/i18n.js', function () { charger('js/i18n-dico.js', function () { charger('js/i18n-apps.js', function () { charger('js/i18n-suivi.js', function () { charger('js/basdepage.js', monter); }); }); }); }); }); });
})();
