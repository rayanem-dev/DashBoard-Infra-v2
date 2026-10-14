/* Pied de page commun : brique « basdepage » de la bibliothèque lib (ligne de version avec ✓ / ⚠ / ?, nouveautés, copyright, actualiser).
 * Une seule ligne dans chaque page : <script src="js/pied.js"></script>. Pas de sélecteur de langue ni de thème (le portail est en français, thème clair). */
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
      prefs: false, cle: 'infra'
    });
  }
  charger('js/version.js', function () { charger('js/nouveautes.js', function () { charger('js/basdepage.js', monter); }); });
})();
