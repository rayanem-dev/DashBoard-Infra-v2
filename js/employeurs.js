/* Couleurs des employeurs (ACOSCO, GTP…), définies dans js/config.js (window.EMPLOYEURS). */
(function () {
  function cle(s) { return String(s == null ? '' : s).trim().toUpperCase(); }
  var Employeur = {
    style: function (nom) { var t = window.EMPLOYEURS || {}; return t[cle(nom)] || null; },
    // Petite pastille colorée avec le nom de l'employeur ; null si l'employeur n'a pas de couleur.
    pastille: function (nom) {
      var s = Employeur.style(nom); if (!s) return null;
      var e = document.createElement('span'); e.className = 'emp'; e.textContent = cle(nom);
      e.style.background = s.fond; e.style.color = s.texte; e.style.border = '1px solid ' + s.texte + '66'; e.title = 'Employeur : ' + cle(nom); return e;
    },
    // Teinte une cellule / une boîte avec la couleur de l'employeur.
    teinter: function (el, nom) { var s = Employeur.style(nom); if (s) { el.style.background = s.fond; el.style.setProperty('--emp-bord', s.texte); el.classList.add('emp-teinte'); } return el; },
    tous: function () { return Object.keys(window.EMPLOYEURS || {}); }
  };
  window.Employeur = Employeur;
})();
