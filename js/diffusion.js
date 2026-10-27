/**
 * Envoi d'un document généré par e-mail, TOUJOURS au clic : une petite fenêtre propose le secrétariat (coché par défaut) et/ou la boîte du service de l'agent.
 *   Diffusion.choisir({ titre })            → promesse { secretariat, service } (ou null si annulé)
 *   Diffusion.envoyerHtml({ sujet, nom, html, message }) → choisit puis envoie la page (corps du message + copie PDF)
 * Les adresses sont décidées par le serveur (action diffusion_envoyer) : la page ne choisit jamais une adresse.
 */
(function () {
  if (window.Diffusion) return;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var CSS = '#dif{margin:auto;border:0;border-radius:16px;padding:20px;width:min(460px,94vw);box-shadow:0 20px 60px rgba(0,0,0,.4);color:var(--text-dark,#1A1A2E);background:var(--surface,#fff)}#dif::backdrop{background:rgba(0,0,0,.45)}' +
    '#dif h3{margin:0 0 4px}#dif p{margin:0 0 10px;font-size:12.5px;color:var(--text-muted,#6B7280)}#dif label{text-transform:none;letter-spacing:0;display:flex;gap:8px;align-items:flex-start;margin:8px 0;font-size:14px;font-weight:600;cursor:pointer}#dif label small{text-transform:none;letter-spacing:0;display:block;font-weight:400;color:var(--text-muted,#6B7280);font-size:12px}' +
    '#dif input{width:auto;min-width:0;margin-top:3px}#dif .dif-b{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}#dif .dif-e{color:#B42318;font-weight:700;font-size:13px;margin:8px 0 0}' +
    '#dif button{font:inherit;border-radius:10px;padding:9px 15px;border:1.5px solid var(--border,#E5E7EB);background:var(--surface,#fff);color:inherit;cursor:pointer}#dif button.p{border:0;color:#fff;font-weight:700;background:linear-gradient(135deg,#E85D04,#F48C06)}#dif button:disabled{opacity:.5;cursor:default}';
  function choisir(o) {
    o = o || {};
    return Api.call('diffusion_options').then(function (opt) {
      return new Promise(function (fin) {
        if (!document.getElementById('dif-css')) { var st = el('style'); st.id = 'dif-css'; st.textContent = CSS; document.head.appendChild(st); }
        var vieux = document.getElementById('dif'); if (vieux) vieux.remove();
        var d = el('dialog'); d.id = 'dif'; d.appendChild(el('h3', null, o.titre || '✉ Envoyer le document'));
        d.appendChild(el('p', null, 'Rien n\'est envoyé sans votre clic. Le document part en pièce jointe.'));
        var l1 = el('label'), c1 = el('input'); c1.type = 'checkbox'; c1.checked = true; l1.appendChild(c1); var t1 = el('span', null, 'Secrétariat'); t1.appendChild(el('small', null, (opt.secretariat || []).join(' · '))); l1.appendChild(t1); d.appendChild(l1);
        var l2 = el('label'), c2 = el('input'); c2.type = 'checkbox'; l2.appendChild(c2);
        var t2 = el('span', null, 'Mon service' + (opt.service_agent ? ' (' + opt.service_agent + ')' : '')); t2.appendChild(el('small', null, opt.service ? opt.service : 'Aucune boîte e-mail connue pour ce compte.')); l2.appendChild(t2); if (!opt.service) { c2.disabled = true; l2.style.opacity = '.55'; } d.appendChild(l2);
        var er = el('p', 'dif-e'); d.appendChild(er);
        var b = el('div', 'dif-b'), an = el('button', null, 'Annuler'), ok = el('button', 'p', 'Envoyer'); an.type = ok.type = 'button'; b.appendChild(an); b.appendChild(ok); d.appendChild(b); document.body.appendChild(d);
        var res = null; d.addEventListener('close', function () { d.remove(); fin(res); });
        an.onclick = function () { d.close(); };
        ok.onclick = function () { if (!c1.checked && !c2.checked) { er.textContent = 'Cochez au moins un destinataire.'; return; } res = { secretariat: c1.checked, service: c2.checked }; d.close(); };
        if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      });
    });
  }
  function envoyerHtml(o) {
    return choisir({ titre: o.titre }).then(function (ch) {
      if (!ch) return null;
      return Api.call('diffusion_envoyer', { sujet: o.sujet, nom: o.nom, message: o.message, html: o.html, secretariat: ch.secretariat, service: ch.service });
    });
  }
  window.Diffusion = { choisir: choisir, envoyerHtml: envoyerHtml };
})();
