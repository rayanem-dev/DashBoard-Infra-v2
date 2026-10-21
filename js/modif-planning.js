/* Modifier un planning : tableau « Planning actuel » / « Planning modifié » dont les prochaines rotations se règlent au jour près.
 * Utilisé par la page Planning (l'agent modifie le sien : la demande est appliquée tout de suite) et par les responsables (ils corrigent puis valident).
 * Dépend de Api, Simulation (js/simulation.js). Le calcul des dates et du retour à la rotation est celui de Simulation ; le serveur le refait avant d'enregistrer. */
(function () {
  var NB_LIGNES = 10;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function fr(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function nomType(t) { return t === 'T' ? 'Travail du' : 'Récupération du'; }
  function signe(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n); }
  function jours(n) { return Math.abs(n) > 1 ? 'jours' : 'jour'; }

  var CSS = '.mp{width:min(760px,96vw)!important}.mp h3{font-size:13px;letter-spacing:.04em;text-transform:uppercase;margin:14px 0 6px;color:var(--text-muted)}' +
    '.mp table{width:100%;border-collapse:collapse;font-size:13.5px}.mp td{padding:5px 6px;border-bottom:1px solid var(--border)}.mp td.d{font-variant-numeric:tabular-nums;font-weight:700}' +
    '.mp td.n{text-align:right;width:92px}.mp td.n input{width:74px!important;padding:6px 8px!important;text-align:right;font-weight:700}.mp .lt td:first-child{color:var(--c-T)}.mp .lr td:first-child{color:var(--c-R)}' +
    '.mp tr.verrou td{opacity:.6}.mp tr.chg td.n input{background:var(--tint-orange);border-color:var(--orange-main)!important}' +
    '.mp .info{border-radius:10px;padding:10px 12px;margin:12px 0;font-size:13.5px;line-height:1.45}.mp .info.ok{background:var(--tint-ok);color:var(--ok)}.mp .info.alerte{background:var(--tint-err);color:var(--err);font-weight:600}' +
    '.mp .info.neutre{background:var(--surface-2);color:var(--ink-2)}.mp .mails{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:8px}.mp .mails label{display:flex;gap:6px;align-items:center;font-size:14px;margin:0}' +
    '.mp input[type=text]{width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font:inherit}';
  function style() { if (document.getElementById('mp-css')) return; var s = el('style'); s.id = 'mp-css'; s.textContent = CSS; document.head.appendChild(s); }

  /** Blocs (travail / repos consécutifs) d'une grille à partir de l'indice i0. */
  function blocs(g, i0, n) {
    var out = [], i = i0;
    while (i < g.length && out.length < n) { var c = g.charAt(i); if (c !== 'T' && c !== 'R') break; var j = i; while (j < g.length && g.charAt(j) === c) j += 1; out.push({ type: c, jours: j - i, idx: i }); i = j; }
    return out;
  }

  /**
   * options : { donnees (réponse de modif_moi_donnees / modif_agent_donnees), mode: 'agent' | 'chef', numero (mode chef), titre, onChange() }
   */
  function ouvrir(options) {
    style();
    var d = options.donnees, rot = d.rotation, F = d.debut, auj = d.aujourdhui, g = d.grille_demande, ia = Simulation.diff(F, auj), cy = rot.jours_travail + rot.jours_repos;
    var direct = options.mode === 'direct', chef = options.mode === 'chef' || direct, HAB = { T: rot.jours_travail, R: rot.jours_repos };
    // première rotation à régler : la prochaine qui commence après aujourd'hui ; si une demande est en cours, on part de son début (les jours déjà passés restent figés)
    var iS = Simulation.prochaineReleve(g, ia + 1);
    if (d.en_cours_modif && Simulation.estDate(d.en_cours_modif.debut)) { var ip = Math.max(0, Simulation.diff(F, d.en_cours_modif.debut)); while (ip > 0 && g.charAt(ip - 1) === g.charAt(ip)) ip -= 1; iS = Math.min(iS, ip); }
    var lignes = blocs(g, iS, NB_LIGNES).map(function (b) { return { type: b.type, jours: b.jours, orig: b.jours, verrou: b.idx <= ia }; });
    var actuel = blocs(d.grille_actuelle, iS, NB_LIGNES), debutS = Simulation.addDays(F, iS);

    var dlg = el('dialog', 'dlg mp'), f = el('form'); f.method = 'dialog';
    f.appendChild(el('h2', null, options.titre || 'Modifier mon planning'));
    f.appendChild(el('p', 'sous', 'Changez la durée des prochaines rotations : les dates en dessous se recalculent. Les rotations déjà commencées ne se modifient pas.'));
    var zone = el('div'); f.appendChild(zone);

    function tableau(titre, rows, editable) {
      var h = el('h3', null, titre), t = el('table'), cellules = [], cur = debutS;
      rows.forEach(function (r, i) {
        var tr = el('tr', r.type === 'T' ? 'lt' : 'lr'), ligne = { tr: tr };
        tr.appendChild(el('td', null, nomType(r.type))); ligne.du = el('td', 'd'); ligne.au = el('td', 'd'); tr.appendChild(ligne.du); tr.appendChild(el('td', null, 'au')); tr.appendChild(ligne.au);
        var n = el('td', 'n');
        if (editable && !r.verrou) {
          var inp = document.createElement('input'); inp.type = 'number'; inp.min = 1; inp.max = 120; inp.step = 1; inp.value = r.jours; inp.setAttribute('aria-label', 'Nombre de jours, ligne ' + (i + 1));
          inp.addEventListener('input', function () { r.jours = Math.floor(Number(inp.value)); calculer(); }); n.appendChild(inp);
        } else { n.textContent = r.jours + ' j'; if (editable) tr.className += ' verrou'; }
        tr.appendChild(n); t.appendChild(tr); cellules.push(ligne);
      });
      return { h: h, t: t, cellules: cellules, rows: rows };
    }
    var tA = tableau('Planning actuel', actuel, false), tM = tableau('Planning modifié', lignes, true);
    zone.appendChild(tA.h); zone.appendChild(tA.t); zone.appendChild(tM.h); zone.appendChild(tM.t);
    function dates(tb) {
      var cur = debutS;
      tb.rows.forEach(function (r, i) { var c = tb.cellules[i], fin = Simulation.addDays(cur, Math.max(1, r.jours) - 1); c.du.textContent = fr(cur); c.au.textContent = fr(fin); cur = Simulation.addDays(fin, 1); });
    }
    var etat = el('div'); zone.appendChild(etat);
    // Reliquat initial : saisi ici (agent pour lui-même, ou responsable habilité pour l'agent) sans avoir à modifier le planning
    if (!chef || direct) {
      var rl = el('div', 'mp-rel'), ri = document.createElement('input'); ri.type = 'number'; ri.min = -365; ri.max = 365; ri.step = 1; ri.value = rot.reliquat == null ? 0 : rot.reliquat; ri.style.cssText = 'width:90px;padding:6px 8px;border:1.5px solid var(--border);border-radius:10px;font:inherit;font-weight:700;text-align:right';
      var rb2 = el('button', 'btn-s', 'Enregistrer le reliquat'); rb2.type = 'button'; var rm = el('span', 'note'); rm.style.cssText = 'font-size:13px';
      rl.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px';
      var lb = el('label', null, 'Au début de la rotation, combien avez-vous de reliquat ? (jours)'); lb.style.cssText = 'font-weight:700;font-size:13px;margin:0'; rl.appendChild(lb); rl.appendChild(ri); rl.appendChild(rb2); rl.appendChild(rm);
      rb2.addEventListener('click', function () {
        rb2.disabled = true; rm.textContent = '';
        var q = { reliquat: ri.value === '' ? 0 : Number(ri.value) }; if (direct) q.email = d.email;
        Api.call('reliquat_enregistrer', q).then(function () { d.solde += q.reliquat - (rot.reliquat || 0); rot.reliquat = q.reliquat; rm.textContent = '✓ Reliquat enregistré'; rm.style.color = 'var(--ok)'; rb2.disabled = false; calculer(); if (options.onChange) options.onChange(); })
          .catch(function (err) { rm.textContent = err.message; rm.style.color = 'var(--err)'; rb2.disabled = false; });
      });
      zone.appendChild(rl);
    }
    var motif = document.createElement('input'); motif.type = 'text'; motif.maxLength = 120; motif.value = chef ? '' : 'Demande de l\'agent'; motif.placeholder = direct ? 'Motif (facultatif)' : chef ? 'Commentaire (facultatif)' : 'Motif de la demande';
    f.appendChild(el('h3', null, chef ? 'Commentaire' : 'Motif')); f.appendChild(motif);
    var msg = el('div', 'msg'); msg.setAttribute('role', 'alert'); f.appendChild(msg);
    var boutons = el('div', 'boutons'), ann = el('button', 'btn-s', 'Fermer'); ann.type = 'button'; ann.addEventListener('click', function () { dlg.close(); });
    var ok = el('button', 'btn', direct ? 'Enregistrer la modification' : chef ? 'Valider avec ces changements' : 'Enregistrer ma demande');
    if (options.rotationBase) { var rb = el('button', 'btn-s', 'Rotation de base…'); rb.type = 'button'; rb.title = 'Changer la rotation habituelle (28/28, 14/14…)'; rb.addEventListener('click', function () { dlg.close(); options.rotationBase(); }); boutons.appendChild(rb); } ok.type = 'submit';
    var annulerDemande = null;
    if (!chef && d.en_cours) { annulerDemande = el('button', 'btn-s', 'Annuler ma demande en cours'); annulerDemande.type = 'button'; boutons.appendChild(annulerDemande); }
    boutons.appendChild(ann); boutons.appendChild(ok); f.appendChild(boutons);

    var courant = null;   // { m, mod, retour, rq } du dernier calcul valide
    function modif() {
      var k = -1; lignes.forEach(function (r, i) { if (r.jours !== HAB[r.type]) k = i; });
      var n = Math.max(k, 0) + 1, ps = lignes.slice(0, n).map(function (r) { return { type: r.type, jours: r.jours }; });
      for (var i = 0; i < ps.length; i += 1) if (!(ps[i].jours >= 1 && ps[i].jours <= 120 && Math.floor(ps[i].jours) === ps[i].jours)) return { erreur: 'Ligne ' + (i + 1) + ' : de 1 à 120 jours' };
      return { m: { debut: debutS, periodes: ps, reprise: Simulation.autre(ps[ps.length - 1].type) } };
    }
    function calculer() {
      dates(tM);
      lignes.forEach(function (r, i) { tM.cellules[i].tr.classList.toggle('chg', r.jours !== (actuel[i] ? actuel[i].jours : r.jours)); });
      etat.textContent = ''; courant = null;
      var x = modif();
      if (x.erreur) { etat.appendChild(el('div', 'info alerte', x.erreur)); ok.disabled = true; return; }
      var off = d.grille_actuelle, err = Simulation.valider(x.m, rot, auj);
      if (err) { etat.appendChild(el('div', 'info alerte', err)); ok.disabled = true; return; }
      var mod = Simulation.appliquer(off, F, x.m, rot), retour = Simulation.retour(d.grille_normale, mod, F, cy), rq = Simulation.reliquatDetail(off, mod, F, x.m);
      courant = { m: x.m, mod: mod, retour: retour };
      var identique = mod === off;
      ok.disabled = identique && !chef;
      if (identique) etat.appendChild(el('div', 'info neutre', 'Aucun changement par rapport à votre planning actuel.'));
      else {
        etat.appendChild(el('div', 'info neutre', 'Écart : ' + (rq.net === 0 ? 'aucun jour de plus ni de moins' : signe(rq.net) + ' ' + jours(rq.net) + ' (' + (rq.net > 0 ? 'jours travaillés en plus, à récupérer' : 'jours de repos en plus') + ')') +
          (rq.pic !== rq.net ? ' — pic pendant la transition : ' + signe(rq.pic) + ' ' + jours(rq.pic) : '') + '. Reliquat : ' + signe(d.solde) + ' → ' + signe(d.solde + rq.net) + ' ' + jours(d.solde + rq.net) + ' une fois validée.'));
        etat.appendChild(retour.ok ? el('div', 'info ok', '✓ Retour à votre rotation habituelle (' + rot.jours_travail + '/' + rot.jours_repos + ')' + (retour.reprendLe ? ' à partir du ' + fr(retour.reprendLe) : '') + '.')
          : el('div', 'info alerte', '⚠ Vous n\'êtes pas rentré dans votre rotation à la fin de ces changements (dernier écart le ' + fr(retour.dernierEcart) + '). ' + (chef ? 'Cette demande est signalée.' : 'Votre demande est signalée à votre chef de service ; ce message reste affiché jusqu\'à la décision d\'un responsable.')));
      }
    }
    dates(tA); calculer();

    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (!courant) return; ok.disabled = true; msg.className = 'msg';
      var m = courant.m, p = direct ? Api.call('simu_valider', { uid: d.uid, debut: m.debut, periodes: m.periodes, reprise: m.reprise, motif: motif.value || 'Modification directe' }).then(function (v) { return Api.call('simu_decider', { numero: v.numero, decision: 'approuvee', commentaire: 'Modification directe' }); })
        : chef ? Api.call('simu_decider', { numero: options.numero, decision: 'approuvee', commentaire: motif.value, modif: m }) : Api.call('modif_moi', { debut: m.debut, periodes: m.periodes, reprise: m.reprise, motif: motif.value });
      p.then(function (r) { if (options.onChange) options.onChange(r); if (chef) { dlg.close(); return; } suite(r); })
        .catch(function (err) { msg.textContent = err.message; msg.className = 'msg err'; ok.disabled = false; });
    });
    if (annulerDemande) annulerDemande.addEventListener('click', function () {
      annulerDemande.disabled = true;
      Api.call('modif_moi_annuler').then(function (r) { if (options.onChange) options.onChange(r); dlg.close(); }).catch(function (err) { msg.textContent = err.message; msg.className = 'msg err'; annulerDemande.disabled = false; });
    });

    /** Après l'enregistrement : la demande est déjà appliquée ; envoi facultatif par e-mail (cases à cocher). */
    function suite(r) {
      f.textContent = '';
      f.appendChild(el('h2', null, 'Demande enregistrée'));
      f.appendChild(el('div', 'info ok', '✓ Votre demande n° ' + r.numero + ' est appliquée : elle est visible dans votre planning et dans le planning global. Elle attend la décision de votre chef de service, du secrétariat ou du chef de division ; un refus ramène votre planning initial. Vous pouvez l\'annuler vous-même tant qu\'elle n\'est pas approuvée.'));
      if (r.hors_rotation) f.appendChild(el('div', 'info alerte', '⚠ Vous n\'êtes pas rentré dans votre rotation à la fin de ces changements : un message reste affiché jusqu\'à la décision d\'un responsable.'));
      f.appendChild(el('h3', null, 'Envoyer par e-mail (facultatif)'));
      var mails = el('div', 'mails'), cases = {};
      [['chef_service', 'Chef de service', true], ['secretariat', 'Secrétariat', false], ['chef_division', 'Chef de division', false]].forEach(function (c) {
        var l = el('label'), i = document.createElement('input'); i.type = 'checkbox'; i.checked = c[2]; cases[c[0]] = i; l.appendChild(i); l.appendChild(document.createTextNode(c[1])); mails.appendChild(l);
      });
      f.appendChild(mails);
      var m2 = el('div', 'msg'); m2.setAttribute('role', 'alert'); f.appendChild(m2);
      var b = el('div', 'boutons'), envoi = el('button', 'btn', 'Envoyer par e-mail'); envoi.type = 'button';
      var voir = el('a', 'btn-s', 'Voir le document'); voir.href = 'demande.html?n=' + encodeURIComponent(r.numero); voir.target = '_blank'; voir.rel = 'noopener'; voir.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none';
      var ann2 = el('button', 'btn-s', 'Annuler ma demande'); ann2.type = 'button'; ann2.title = 'En cas d\'erreur : retour à votre planning initial';
      ann2.addEventListener('click', function () { ann2.disabled = true; Api.call('modif_moi_annuler').then(function (x) { if (options.onChange) options.onChange(x); dlg.close(); }).catch(function (err) { m2.textContent = err.message; m2.className = 'msg err'; ann2.disabled = false; }); });
      var fin = el('button', 'btn-s', 'Terminer'); fin.type = 'button'; fin.addEventListener('click', function () { dlg.close(); });
      envoi.addEventListener('click', function () {
        envoi.disabled = true; m2.className = 'msg';
        Api.call('simu_envoyer', { numero: r.numero, destinataires: { chef_service: cases.chef_service.checked, secretariat: cases.secretariat.checked, chef_division: cases.chef_division.checked } })
          .then(function (x) { m2.textContent = 'E-mail envoyé à ' + x.emails + ' personne' + (x.emails > 1 ? 's' : '') + '.'; m2.className = 'msg ok'; envoi.disabled = false; })
          .catch(function (err) { m2.textContent = err.message; m2.className = 'msg err'; envoi.disabled = false; });
      });
      b.appendChild(envoi); b.appendChild(voir); b.appendChild(ann2); b.appendChild(fin); f.appendChild(b);
    }
    dlg.addEventListener('close', function () { dlg.remove(); });
    dlg.appendChild(f); document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /**
   * Point d'entrée de « Modifier mon planning » : sans rotation enregistrée, la petite fenêtre « Où en êtes-vous ? » ; sinon le planning modifiable.
   * rotation : rotation actuelle de la ligne (ou null) ; onChange() : rafraîchir la page.
   */
  function modifierMonPlanning(rotation, onChange) {
    if (!rotation) { Rotation.ouvrir({ titre: 'Où en êtes-vous ?', onOk: onChange }); return Promise.resolve(); }
    return Api.call('modif_moi_donnees').then(function (d) { ouvrir({ donnees: d, mode: 'agent', onChange: onChange }); });
  }
  window.ModifPlanning = { ouvrir: ouvrir, modifierMonPlanning: modifierMonPlanning };
})();
