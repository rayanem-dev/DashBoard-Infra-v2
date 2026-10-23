/**
 * Avatar du compte en haut à droite de chaque page (comme Google) : photo ou initiales ; un clic ouvre « Mon profil », « Changer mon mot de passe » et « Se déconnecter ».
 * Chargé par js/pied.js sur les pages du site (jamais sur la connexion). La photo vient de l'onglet « Profils » (action photos_mini), gardée 10 minutes dans cette session.
 * Expose Avatar.photos() (promesse { uid: image }) et Avatar.pastille(uid, nom, taille) pour afficher la photo d'un agent n'importe où.
 */
(function () {
  if (!window.Api || !Api.token || !Api.token() || window.Avatar) return;
  var CLE = 'infra_avatar', DUREE = 600000;
  function lire() { try { var o = JSON.parse(sessionStorage.getItem(CLE) || 'null'); return o && Date.now() - o.t < DUREE ? o : null; } catch (e) { return null; } }
  function garder(o) { try { o.t = Date.now(); sessionStorage.setItem(CLE, JSON.stringify(o)); } catch (e) { /* stockage plein : sans cache */ } }
  function initiales(n) { var m = String(n || '?').replace(/[^A-Za-zÀ-ÿ\s'-]/g, ' ').trim().split(/\s+/).filter(Boolean); return ((m[0] || '?').charAt(0) + (m[1] || '').charAt(0)).toUpperCase(); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

  var cachePhotos = null;
  function photos() { if (cachePhotos) return cachePhotos; var o = lire(); if (o && o.photos) return (cachePhotos = Promise.resolve(o.photos)); return (cachePhotos = Api.call('photos_mini').then(function (r) { return r.photos || {}; }).catch(function () { return {}; })); }
  /** Rond de la photo de l'agent (ou de ses initiales). */
  function pastille(uid, nom, taille) {
    var d = el('span', 'av-pastille'), t = taille || 28; d.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:' + t + 'px;height:' + t + 'px;border-radius:50%;background:#FCE9D6;color:#B94E00;font-weight:800;font-size:' + Math.round(t * .4) + 'px;overflow:hidden;flex:none;vertical-align:middle';
    d.textContent = initiales(nom);
    photos().then(function (m) { if (m[uid]) { d.textContent = ''; var i = new Image(); i.src = m[uid]; i.alt = ''; i.style.cssText = 'width:100%;height:100%;object-fit:cover'; d.appendChild(i); } });
    return d;
  }
  window.Avatar = { photos: photos, pastille: pastille, initiales: initiales };

  var css = document.createElement('style');
  css.textContent = '.av-wrap{position:relative;display:inline-block;margin-left:8px;vertical-align:middle}.av-btn{width:42px;height:42px;border-radius:50%;border:2px solid rgba(255,255,255,.65);padding:0;cursor:pointer;background:#FCE9D6;color:#B94E00;font:800 15px Inter,sans-serif;overflow:hidden;display:inline-flex;align-items:center;justify-content:center}' +
    '.av-btn img,.av-grand img{width:100%;height:100%;object-fit:cover}.av-btn:focus-visible{outline:3px solid #E85D04;outline-offset:2px}' +
    '.av-menu{position:absolute;right:0;top:50px;z-index:9999;min-width:270px;background:var(--surface,#fff);color:var(--text-dark,#1F2937);border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.28);padding:14px;text-align:left}' +
    '.av-menu[hidden]{display:none}.av-tete{display:flex;gap:12px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border,#E5E7EB);margin-bottom:6px}.av-grand{width:56px;height:56px;border-radius:50%;background:#FCE9D6;color:#B94E00;font:800 20px Inter,sans-serif;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}' +
    '.av-nom{font-weight:800;font-size:15px;line-height:1.2}.av-sous{font-size:12px;color:var(--text-muted,#6B7280);word-break:break-all}.av-menu a,.av-menu button{display:block;width:100%;text-align:left;padding:10px 8px;border:0;background:none;border-radius:10px;font:600 14px Inter,sans-serif;color:inherit;text-decoration:none;cursor:pointer}.av-menu a:hover,.av-menu button:hover{background:rgba(232,93,4,.1)}' +
    '.av-fixe{position:fixed;top:10px;right:12px;z-index:9998}';
  document.head.appendChild(css);

  function monter(u, photo) {
    var hote = document.querySelector('.bandeau-droite') || document.querySelector('.bandeau-inner');
    var w = el('span', 'av-wrap'); if (!hote) w.className += ' av-fixe';
    var b = el('button', 'av-btn'); b.type = 'button'; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Mon compte : ' + (u.nom_affiche || u.nom)); b.title = u.nom_affiche || u.nom;
    function rond(n) { if (photo) { var i = new Image(); i.src = photo; i.alt = ''; n.appendChild(i); } else n.textContent = initiales(u.nom); }
    rond(b);
    var m = el('div', 'av-menu'); m.hidden = true; m.setAttribute('role', 'menu');
    var tete = el('div', 'av-tete'), g = el('div', 'av-grand'); rond(g); tete.appendChild(g);
    var tx = el('div'); tx.appendChild(el('div', 'av-nom', u.nom_affiche || u.nom)); tx.appendChild(el('div', 'av-sous', u.email_contact || u.email || '')); if (u.role_libelle) tx.appendChild(el('div', 'av-sous', u.role_libelle)); tete.appendChild(tx); m.appendChild(tete);
    var l1 = el('a', null, '👤 Mon profil'); l1.href = 'profil.html'; m.appendChild(l1);
    var l2 = el('a', null, '🔒 Changer mon mot de passe'); l2.href = 'profil.html#mdp'; m.appendChild(l2);
    var l3 = el('button', null, '⎋ Se déconnecter'); l3.type = 'button';
    l3.addEventListener('click', function () { try { sessionStorage.removeItem(CLE); } catch (e) { /* rien */ } Api.call('logout', { rt: Api.remember ? Api.remember() : '' }).catch(function () {}).then(function () { Api.setToken(''); if (Api.setRemember) Api.setRemember(''); location.replace('connexion.html'); }); });
    m.appendChild(l3);
    w.appendChild(b); w.appendChild(m);
    if (hote) hote.appendChild(w); else document.body.appendChild(w);
    function ouvrir(o) { m.hidden = !o; b.setAttribute('aria-expanded', o ? 'true' : 'false'); }
    b.addEventListener('click', function (e) { e.stopPropagation(); ouvrir(m.hidden); });
    document.addEventListener('click', function (e) { if (!w.contains(e.target)) ouvrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { ouvrir(false); b.focus(); } });
  }

  var c = lire();
  if (c && c.user) { monter(c.user, c.photo || ''); photos(); return; }
  Promise.all([Api.call('me'), Api.call('photos_mini').catch(function () { return { photos: {} }; })]).then(function (rs) {
    var u = rs[0].user || {}, ph = rs[1].photos || {}, photo = ph[u.uid] || '';
    garder({ user: { uid: u.uid, nom: u.nom, nom_affiche: u.nom_affiche, email: u.email, email_contact: u.email_contact, role_libelle: u.role_libelle }, photo: photo, photos: ph });
    monter(u, photo); cachePhotos = Promise.resolve(ph);
  }).catch(function () { /* pas de session : pas d'avatar */ });
})();
