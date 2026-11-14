/* Couleurs des employeurs : celles de js/config.js (window.EMPLOYEURS : ACOSCO, GTP, SETER SUD…), sinon calculées automatiquement à partir du nom. */
(function () {
  function cle(s) { return String(s == null ? '' : s).trim().toUpperCase(); }
  var Employeur = {
    /** Couleur d'un employeur : celle de js/config.js si elle y est ; sinon une couleur calculée à partir du nom (toujours la même pour un même nom), pour que TOUT employeur ait sa pastille sans rien configurer. SONATRACH / SH et un employeur vide : aucune pastille. */
    style: function (nom) {
      var k = cle(nom); if (!k) return null; var t = window.EMPLOYEURS || {}; if (t[k]) return t[k];
      if (k === 'SH' || k.indexOf('SONATRACH') !== -1) return null;
      var h = 0; for (var i = 0; i < k.length; i += 1) h = (h * 31 + k.charCodeAt(i)) % 360;
      var hex = function (hue, sat, lum) { var a = sat * Math.min(lum, 1 - lum), f = function (n) { var kk = (n + hue / 30) % 12, c = lum - a * Math.max(Math.min(kk - 3, 9 - kk, 1), -1); return ('0' + Math.round(255 * c).toString(16)).slice(-2); }; return '#' + f(0) + f(8) + f(4); };
      return (Employeur.auto = Employeur.auto || {})[k] || (Employeur.auto[k] = { fond: hex(h, 0.55, 0.88), texte: hex(h, 0.5, 0.26) });
    },
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
