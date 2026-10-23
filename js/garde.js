/**
 * Garde d'accès pour les pages reprises de l'ancien site (Avancement_des_Chantiers, Suivi_Chantier, Dossiers_CPM).
 * La page reste invisible tant que : (1) une session est ouverte, (2) la page figure dans le menu de l'utilisateur (droits du module).
 * Sinon : retour à la connexion (pas de session) ou au portail (pas de droit). Nécessite js/config.js puis js/api.js.
 */
(function () {
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  var racine = document.documentElement;
  racine.style.visibility = 'hidden';
  function afficher() { racine.style.visibility = ''; }
  function message(txt, lien, libelle) {
    var d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#F5F5F0;font-family:Inter,Arial,sans-serif;text-align:center;padding:24px;z-index:99999;color:#1A1A2E';
    d.innerHTML = '<div><p style="font-size:16px;margin-bottom:14px"></p><a style="color:#E85D04;font-weight:700"></a></div>';
    d.querySelector('p').textContent = txt; var a = d.querySelector('a'); a.href = lien; a.textContent = libelle;
    document.body.appendChild(d); afficher();
  }
  function fichier(u) { return String(u || '').split(/[?#]/)[0].split('/').pop().toLowerCase(); }
  if (!window.Api) { location.replace('connexion.html'); return; }
  var CLE_MENU = 'gm_pages', TTL_MENU = 600000;
  function pagesDe(r) { var f = []; (r.menu || []).forEach(function (m) { (m.apps || []).forEach(function (a) { f.push(fichier(a.url)); }); }); return f; }
  function autorise(r) { return pagesDe(r).indexOf(page) !== -1; }
  function connu() { try { var o = JSON.parse(sessionStorage.getItem(CLE_MENU) || 'null'); return !!(o && Date.now() - o.t < TTL_MENU && o.f.indexOf(page) !== -1); } catch (e) { return false; } }
  function retenir(r) { try { sessionStorage.setItem(CLE_MENU, JSON.stringify({ t: Date.now(), f: pagesDe(r) })); } catch (e) { /* stockage indisponible */ } }
  function oublier() { try { sessionStorage.removeItem(CLE_MENU); } catch (e) { /* rien */ } }
  var affichee = connu(); if (affichee) afficher(); // accès déjà vérifié il y a peu : la page s'affiche tout de suite, la vérification se refait en arrière-plan
  // Un « non » n'est cru qu'après une seconde lecture (le menu peut être incomplet un instant quand Google est lent)
  Api.call('menu').then(function (r) { return autorise(r) ? r : new Promise(function (ok) { setTimeout(ok, 900); }).then(function () { return Api.call('menu'); }); }).then(function (r) {
    if (autorise(r)) { retenir(r); afficher(); return; }
    oublier();
    message('Vous n\'avez pas accès à cette page avec votre compte.', 'portail.html', '← Retour au portail');
  }).catch(function (e) {
    if (e && e.code === 'SESSION') { oublier(); location.replace('connexion.html'); return; }
    if (affichee) return; // page déjà affichée : une panne passagère de la vérification ne la masque pas
    message('Impossible de vérifier votre accès pour le moment : ' + (e && e.message ? e.message : 'erreur'), 'portail.html', '← Retour au portail');
  });
})();
