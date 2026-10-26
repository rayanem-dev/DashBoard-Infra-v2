/**
 * Boule des jours restants de la rotation, à gauche de la pastille du profil, sur toutes les pages connectées (l'accueil a la sienne, avec le détail).
 * Même couleur que l'accueil : vert au travail, orange en repos ; un clic ouvre l'accueil. La situation est gardée 5 minutes pour ne pas la redemander à chaque page.
 */
(function () {
  if (window.JaugeEntete || !window.Api || /connexion\.html|portail\.html/.test(location.pathname)) return;
  window.JaugeEntete = true;
  var CLE = 'infra_v2_jauge', COUL = { T: '#4EA72E', R: '#E97132' };
  var css = document.createElement('style');
  css.textContent = '.je{flex:none;display:inline-grid;place-items:center;position:relative;width:40px;height:40px;border-radius:50%;text-decoration:none;color:#1A1A2E;background:conic-gradient(var(--je-c,#CBD5E1) calc(var(--je-p,0)*1%),rgba(255,255,255,.35) 0)}' +
    '.je::before{content:"";position:absolute;inset:4px;border-radius:50%;background:#fff}.je b{position:relative;z-index:1;font:800 14px/1 Inter,Arial,sans-serif;letter-spacing:-.5px}' +
    '.je.vide{opacity:.8}.je-fixe{position:fixed;top:10px;right:60px;z-index:9997}';
  document.head.appendChild(css);
  function lire() { try { var o = JSON.parse(sessionStorage.getItem(CLE) || 'null'); return o && Date.now() - o.t < 300000 ? o.r : null; } catch (e) { return null; } }
  function garder(r) { try { sessionStorage.setItem(CLE, JSON.stringify({ t: Date.now(), r: r })); } catch (e) { /* stockage indisponible */ } }
  function monter(r) {
    if (!r || !r.acces || document.getElementById('je')) return;
    var s = r.configuree ? r.situation : null, a = document.createElement('a'), b = document.createElement('b');
    a.id = 'je'; a.className = 'je'; a.href = 'portail.html'; a.appendChild(b);
    if (s && !s.avant) {
      var pct = Math.max(2, Math.min(100, Math.round(s.jour / s.total * 100)));
      a.style.setProperty('--je-c', COUL[s.statut]); a.style.setProperty('--je-p', pct); b.textContent = s.restants;
      a.title = (s.statut === 'T' ? 'Au travail' : 'En repos') + ' · jour ' + s.jour + '/' + s.total + ' · ' + s.restants + (s.restants > 1 ? ' jours restants' : ' jour restant') + ' — cliquer pour le détail';
    } else { a.className += ' vide'; b.textContent = r.configuree ? '…' : '?'; a.title = r.configuree ? 'Rotation pas encore commencée' : 'Rotation non renseignée : cliquer pour la configurer'; }
    a.setAttribute('aria-label', a.title);
    var hote = document.querySelector('.bandeau-droite');
    if (!hote) { a.className += ' je-fixe'; document.body.appendChild(a); return; }
    var av = hote.querySelector('.av-wrap'); if (av) hote.insertBefore(a, av); else hote.appendChild(a);
  }
  var c = lire(); if (c) { monter(c); return; }
  Api.call('situation').then(function (r) { garder(r); monter(r); }).catch(function () { /* pas de session ou réseau : pas de boule */ });
})();
