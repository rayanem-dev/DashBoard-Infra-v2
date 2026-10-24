/* Aide de la page ou de l'application courante (chargée à la demande par le « ? » discret de js/pied.js).
 * Contenu : js/aide-data.js ; captures : img/aide/. window.Aide.ouvrir(cle?) */
(function () {
  var me = document.currentScript, BASE = me && me.src ? me.src.replace(/js\/aide\.js(\?.*)?$/, '') : '';
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function cleCourante() {
    var nom = window.AIDE_NOM; if (nom && window.AIDE[nom]) return nom;
    var f = (location.pathname.split('/').pop() || 'index.html').toLowerCase(); if (f === 'index.html' || f === '') f = 'connexion.html';
    return window.AIDE[f] ? f : null;
  }
  var CSS = '.aide-dlg{margin:auto;border:0;border-radius:16px;padding:0;width:min(640px,94vw);max-height:90vh;box-shadow:0 20px 60px rgba(0,0,0,.4);font:14px/1.5 Inter,Arial,sans-serif;color:#1C1C1C;background:#fff}.aide-dlg::backdrop{background:rgba(26,26,46,.55)}' +
    '.aide-in{padding:22px 24px 20px;overflow:auto;max-height:90vh}.aide-dlg h2{font-size:19px;margin:0 0 2px}.aide-dlg h3{font-size:12px;text-transform:uppercase;letter-spacing:.6px;color:#6B7280;margin:16px 0 6px}.aide-res{color:#374151;margin:4px 0 10px}' +
    '.aide-dlg ol,.aide-dlg ul{margin:0 0 0 20px;padding:0}.aide-dlg li{margin:4px 0}.aide-img{display:block;width:100%;border:1px solid #E5E7EB;border-radius:10px;margin:8px 0 4px}.aide-top{display:flex;gap:8px;align-items:center;margin-bottom:10px}' +
    '.aide-top select{flex:1;padding:6px 8px;border:1.5px solid #E5E7EB;border-radius:8px;font:inherit;font-size:13px;background:#fff;color:#1C1C1C}.aide-x{border:1.5px solid #E5E7EB;background:#fff;border-radius:8px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer;color:#1C1C1C}' +
    'html[data-theme="dark"] .aide-dlg{background:#1E2430;color:#E5E7EB}html[data-theme="dark"] .aide-res{color:#C7CDD8}html[data-theme="dark"] .aide-top select,html[data-theme="dark"] .aide-x{background:#2A3140;color:#E5E7EB;border-color:#3A4254}';
  function ouvrir(cle) {
    if (!document.getElementById('aide-css')) { var s = el('style'); s.id = 'aide-css'; s.textContent = CSS; document.head.appendChild(s); }
    cle = cle || cleCourante(); var d = window.AIDE[cle];
    var old = document.querySelector('.aide-dlg'); if (old) old.remove();
    var dlg = el('dialog', 'aide-dlg'), in_ = el('div', 'aide-in'); dlg.appendChild(in_);
    var top = el('div', 'aide-top'), sel = el('select'); sel.setAttribute('aria-label', 'Choisir une aide');
    Object.keys(window.AIDE).forEach(function (k) { var o = el('option', null, window.AIDE[k].titre); o.value = k; if (k === cle) o.selected = true; sel.appendChild(o); });
    sel.onchange = function () { dlg.close(); ouvrir(sel.value); };
    var x = el('button', 'aide-x', '✕ Fermer'); x.type = 'button'; x.onclick = function () { dlg.close(); };
    top.appendChild(sel); top.appendChild(x); in_.appendChild(top);
    if (!d) { in_.appendChild(el('h2', null, 'Aide')); in_.appendChild(el('p', 'aide-res', 'Pas d\'aide spécifique pour cette page. Choisissez un sujet dans la liste ci-dessus, ou demandez à l\'administrateur du portail.')); }
    else {
      in_.appendChild(el('h2', null, d.titre)); in_.appendChild(el('p', 'aide-res', d.resume));
      if (d.img) { var im = el('img', 'aide-img'); im.alt = 'Capture : ' + d.titre; im.loading = 'lazy'; im.src = BASE + 'img/aide/' + d.img + '.jpg'; im.onerror = function () { im.remove(); }; in_.appendChild(im); }
      if (d.video) { var v = el('video', 'aide-img'); v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline', ''); v.poster = BASE + 'img/aide/videos/' + d.video + '.jpg'; v.src = BASE + 'img/aide/videos/' + d.video + '.mp4'; v.setAttribute('aria-label', 'Vidéo de formation : ' + d.titre); in_.appendChild(v); var lv = el('a', 'aide-res', '↗ Lien direct vers cette vidéo'); lv.href = BASE + 'video.html?v=' + encodeURIComponent(d.video); lv.target = '_blank'; lv.rel = 'noopener'; lv.style.cssText = 'font-size:12px'; in_.appendChild(lv); }
      if (d.etapes && d.etapes.length) { in_.appendChild(el('h3', null, 'Pas à pas')); var ol = el('ol'); d.etapes.forEach(function (t) { ol.appendChild(el('li', null, t)); }); in_.appendChild(ol); }
      if (d.astuces && d.astuces.length) { in_.appendChild(el('h3', null, 'À savoir')); var ul = el('ul'); d.astuces.forEach(function (t) { ul.appendChild(el('li', null, t)); }); in_.appendChild(ul); }
    }
    dlg.addEventListener('close', function () { dlg.remove(); }); document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  window.Aide = { ouvrir: ouvrir };
})();
