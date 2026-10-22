/**
 * E-mails d'une demande de modification de planning, TOUJOURS après une question (aucun e-mail ne part tout seul) :
 *   NotifModif.proposer({ numeros: ['MOD-2026-0007'], evenement: 'creation' | 'approbation' | 'refus', agent: 'NOM Prénom' }) → Promise (résolue quand la fenêtre est fermée)
 * Cases cochées par défaut selon l'événement :
 *   création (secrétaire, chef de service ou chef de division) : l'agent, le secrétariat « pour traitement », le chef de service, le chef de division ;
 *   approbation : l'agent (approuvée), le secrétariat « pour traitement », le chef de division « pour information et signature » ;
 *   refus : l'agent seulement (rejetée).
 * Nécessite js/api.js.
 */
var NotifModif = (function () {
  var DEFAUTS = {
    creation: { titre: 'Prévenir par e-mail ?', texte: 'La modification est enregistrée. Choisissez qui prévenir :', agent: true, secretariat: true, chef_service: true, chef_division: true },
    approbation: { titre: 'Demande approuvée : prévenir par e-mail ?', texte: 'Choisissez qui prévenir de l\'approbation :', agent: true, secretariat: true, chef_service: false, chef_division: true },
    refus: { titre: 'Demande rejetée : prévenir l\'agent ?', texte: 'L\'agent peut recevoir un e-mail lui indiquant que la modification est rejetée :', agent: true, secretariat: false, chef_service: false, chef_division: false }
  };
  var LIB = { agent: 'L\'agent', secretariat: 'Le secrétariat (pour traitement)', chef_service: 'Le chef de service (pour information)', chef_division: 'Le chef de division (pour information et signature)' };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function proposer(o) {
    var ev = DEFAUTS[o.evenement] ? o.evenement : 'creation', def = DEFAUTS[ev], numeros = (o.numeros || []).filter(Boolean);
    if (!numeros.length) return Promise.resolve();
    return new Promise(function (fin) {
      var dlg = el('dialog'), f = el('form'); f.method = 'dialog'; dlg.style.cssText = 'border:0;border-radius:14px;padding:20px 22px;max-width:460px;width:92vw;box-shadow:0 10px 40px rgba(0,0,0,.3);font-family:Inter,Arial,sans-serif';
      f.appendChild(el('h2', null, def.titre)).style.cssText = 'font-size:17px;margin:0 0 6px';
      f.appendChild(el('p', null, (o.agent ? o.agent + ' — ' : '') + numeros.join(', ') + '. ' + def.texte)).style.cssText = 'font-size:13px;color:#555;margin:0 0 10px';
      var cases = {};
      ['agent', 'secretariat', 'chef_service', 'chef_division'].forEach(function (k) {
        var l = el('label'); l.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0;font-size:14px'; var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!def[k]; cases[k] = cb; l.appendChild(cb); l.appendChild(document.createTextNode(LIB[k])); f.appendChild(l);
      });
      var msg = el('div'); msg.style.cssText = 'font-size:12.5px;margin-top:6px;min-height:16px'; f.appendChild(msg);
      var bt = el('div'); bt.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:12px';
      var non = el('button', 'btn-s', 'Ne pas envoyer'); non.type = 'button'; non.addEventListener('click', function () { dlg.close(); });
      var ok = el('button', 'btn-p', '✉ Envoyer'); ok.type = 'submit'; bt.appendChild(non); bt.appendChild(ok); f.appendChild(bt);
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var dest = {}, n = 0; Object.keys(cases).forEach(function (k) { dest[k] = cases[k].checked; if (cases[k].checked) n += 1; });
        if (!n) { msg.textContent = 'Cochez au moins un destinataire, ou « Ne pas envoyer ».'; msg.style.color = '#B42318'; return; }
        ok.disabled = non.disabled = true; msg.style.color = ''; msg.textContent = 'Envoi…';
        numeros.reduce(function (p, numero) { return p.then(function (tot) { return Api.call('simu_envoyer', { numero: numero, evenement: ev, destinataires: dest }).then(function (x) { return tot + (x.emails || 0); }); }); }, Promise.resolve(0))
          .then(function (tot) { msg.textContent = '✔ ' + tot + ' e-mail(s) envoyé(s).'; msg.style.color = '#166534'; setTimeout(function () { dlg.close(); }, 900); })
          .catch(function (err) { msg.textContent = err.message; msg.style.color = '#B42318'; ok.disabled = non.disabled = false; });
      });
      dlg.addEventListener('close', function () { dlg.remove(); fin(); }); dlg.appendChild(f); document.body.appendChild(dlg); dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
    });
  }
  return { proposer: proposer };
})();
