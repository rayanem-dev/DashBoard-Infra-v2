/* « Nouveautés » : liste de changelog.json dans une fenêtre (ouverte depuis le pied de page, lien « nouveautés » de la ligne de version). */
var Nouveautes = (function () {
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function fr(d) { return /^\d{4}-\d{2}-\d{2}/.test(String(d)) ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : String(d || ''); }
  function ouvrir() {
    var dlg = el('dialog', 'dlg'); dlg.style.cssText = 'width:min(640px,94vw);max-height:86vh;overflow:auto';
    dlg.appendChild(el('h2', null, 'Nouveautés du portail'));
    var corps = el('div'); corps.appendChild(el('p', 'aide', 'Chargement…')); dlg.appendChild(corps);
    var b = el('div', 'boutons'), ok = el('button', 'btn-s', 'Fermer'); ok.type = 'button'; ok.addEventListener('click', function () { dlg.close(); }); b.appendChild(ok); dlg.appendChild(b);
    dlg.addEventListener('close', function () { dlg.remove(); }); document.body.appendChild(dlg); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    fetch('changelog.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (l) {
      corps.textContent = '';
      (l || []).slice(0, 12).forEach(function (e) {
        var c = el('div'); c.style.cssText = 'padding:10px 0;border-bottom:1px solid #F1F3F5';
        var t = el('div'); t.style.fontWeight = '700'; t.textContent = fr(e.date) + ' — ' + (e.title || ''); c.appendChild(t);
        var u = el('ul'); u.style.cssText = 'margin:6px 0 0 18px;padding:0;font-size:13px;color:#374151'; (e.changes || []).forEach(function (x) { u.appendChild(el('li', null, x)); }); c.appendChild(u); corps.appendChild(c);
      });
      if (!l || !l.length) corps.appendChild(el('p', 'aide', 'Aucune nouveauté enregistrée.'));
    }).catch(function () { corps.textContent = ''; corps.appendChild(el('p', 'aide', 'Historique indisponible pour l\'instant.')); });
  }
  return { ouvrir: ouvrir };
})();
