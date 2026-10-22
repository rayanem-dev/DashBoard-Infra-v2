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
    // la rotation EN COURS peut aussi être modifiée (raccourcie ou prolongée, jamais en dessous des jours déjà écoulés) : on part de son début, si la rotation de l'agent et la limite de 30 jours le permettent
    if (g.charAt(ia) === 'T' || g.charAt(ia) === 'R') { var ic = ia; while (ic > 0 && g.charAt(ic - 1) === g.charAt(ic)) ic -= 1; var dc = Simulation.addDays(F, ic); if (dc >= rot.depuis && dc >= Simulation.addDays(auj, -30)) iS = Math.min(iS, ic); }
    if (d.en_cours_modif && Simulation.estDate(d.en_cours_modif.debut)) { var ip = Math.max(0, Simulation.diff(F, d.en_cours_modif.debut)); while (ip > 0 && g.charAt(ip - 1) === g.charAt(ip)) ip -= 1; iS = Math.min(iS, ip); }
    var lignes = blocs(g, iS, NB_LIGNES).map(function (b) { return { type: b.type, jours: b.jours, orig: b.jours, verrou: b.idx + b.jours <= ia, min: b.idx <= ia && b.idx + b.jours > ia ? ia - b.idx + 1 : 1 }; });
    var actuel = blocs(d.grille_actuelle, iS, NB_LIGNES), debutS = Simulation.addDays(F, iS);

    var dlg = el('dialog', 'dlg mp'), f = el('form'); f.method = 'dialog';
    f.appendChild(el('h2', null, options.titre || 'Modifier mon planning'));
    f.appendChild(el('p', 'sous', 'Changez la durée de la rotation en cours et des suivantes : les dates en dessous se recalculent. La rotation en cours ne peut pas descendre en dessous des jours déjà écoulés.'));
    var zone = el('div'); f.appendChild(zone);

    function tableau(titre, rows, editable) {
      var h = el('h3', null, titre), t = el('table'), cellules = [], cur = debutS;
      rows.forEach(function (r, i) {
        var tr = el('tr', r.type === 'T' ? 'lt' : 'lr'), ligne = { tr: tr };
        tr.appendChild(el('td', null, nomType(r.type))); ligne.du = el('td', 'd'); ligne.au = el('td', 'd'); tr.appendChild(ligne.du); tr.appendChild(el('td', null, 'au')); tr.appendChild(ligne.au);
        var n = el('td', 'n');
        if (editable && !r.verrou) {
          var inp = document.createElement('input'); inp.type = 'number'; inp.min = r.min || 1; inp.max = 120; inp.step = 1; inp.value = r.jours; if (r.min > 1) inp.title = 'Rotation en cours : au moins ' + r.min + ' jours (déjà écoulés)'; inp.setAttribute('aria-label', 'Nombre de jours, ligne ' + (i + 1));
          inp.addEventListener('input', function () { r.jours = Math.floor(Number(inp.value)); calculer(); }); n.appendChild(inp);
        } else { n.textContent = r.jours + ' j'; if (editable) tr.className += ' verrou'; }
        tr.appendChild(n); t.appendChild(tr); cellules.push(ligne);
      });
      return { h: h, t: t, cellules: cellules, rows: rows };
    }
    var tA = tableau('Planning actuel', actuel, false), tM = tableau('Planning modifié', lignes, true);
    if (options.rotationBase) {
      var rb = el('button', 'btn-s', '✎ Corriger le planning actuel (saisi par erreur)'); rb.type = 'button'; rb.style.cssText = 'margin:0 0 6px;font-size:12px';
      rb.title = 'Changer le statut, la date de début ou la rotation (28/28, 14/14…) enregistrés au départ'; rb.addEventListener('click', function () { dlg.close(); options.rotationBase(); });
      zone.appendChild(tA.h); zone.appendChild(rb); zone.appendChild(tA.t);
    } else { zone.appendChild(tA.h); zone.appendChild(tA.t); } zone.appendChild(tM.h); zone.appendChild(tM.t);
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
 ok.type = 'submit';
    var annulerDemande = null;
    if (!chef && d.en_cours) { annulerDemande = el('button', 'btn-s', 'Annuler ma demande en cours'); annulerDemande.type = 'button'; boutons.appendChild(annulerDemande); }
    boutons.appendChild(ann); boutons.appendChild(ok); f.appendChild(boutons);

    var courant = null;   // { m, mod, retour, rq } du dernier calcul valide
    function modif() {
      var k = -1; lignes.forEach(function (r, i) { if (r.jours !== HAB[r.type]) k = i; });
      var n = Math.max(k, 0) + 1, ps = lignes.slice(0, n).map(function (r) { return { type: r.type, jours: r.jours }; });
      for (var q = 0; q < n; q += 1) if (lignes[q].min > 1 && lignes[q].jours < lignes[q].min) return { erreur: 'Ligne ' + (q + 1) + ' : la rotation en cours a déjà ' + lignes[q].min + ' jours écoulés, elle ne peut pas être plus courte.' };
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
      p.then(function (r) { if (options.onChange) options.onChange(r); if (chef) { dlg.close(); var num = (r && r.demande && r.demande.numero) || options.numero; if (window.NotifModif && num) NotifModif.proposer({ numeros: [num], evenement: direct ? 'creation' : 'approbation', agent: d.nom || '' }); return; } suite(r); })
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
   * Une seule page « Où en êtes-vous ? » pour tous (première saisie comme correction) : statut, début de la rotation EN COURS, reliquat au début de la rotation,
   * rotation habituelle, puis les cases de durée de chaque rotation à partir de ce début (28 / 28 partout, sauf si l'agent saisit directement une rotation déjà ajustée).
   * options : { titre, email? (autre agent), valeurs? { statut, depuis, jours_travail, jours_repos, reliquat }, donnees? (grille_actuelle…), obligatoire, onOk() }
   */
  function ouvrirInitial(options) {
    style();
    var v = options.valeurs || {}, d = options.donnees || null, auj = Rotation.aujourdhui();
    var PRE = [[28, 28], [14, 14], [15, 15], [7, 7], [4, 4]];
    var jt0 = v.jours_travail || 28, jr0 = v.jours_repos || 28, statut0 = v.statut || 'T', debut0 = v.depuis || auj, rows = [], i;
    function blocsDe(g, F, i0) { return blocs(g, i0, NB_LIGNES); }
    if (d && d.grille_actuelle) {                       // planning déjà enregistré : on part du début de la rotation en cours et des durées réelles
      var F = d.debut, g = d.grille_actuelle, ia = Simulation.diff(F, auj); i = ia; while (i > 0 && g.charAt(i - 1) === g.charAt(i)) i -= 1;
      if (g.charAt(ia) === 'T' || g.charAt(ia) === 'R') { statut0 = g.charAt(ia); debut0 = Simulation.addDays(F, i); rows = blocsDe(g, F, i).map(function (b) { return b.jours; }); }
    } else if (v.depuis && v.depuis <= auj && v.jours_travail) {   // rotation enregistrée sans grille : on retrouve le début de la rotation en cours par le calcul
      var cy0 = jt0 + jr0, pos = Simulation.diff(v.depuis, auj) % cy0, prem = v.statut === 'T' ? jt0 : jr0;
      if (pos < prem) { statut0 = v.statut; debut0 = Simulation.addDays(auj, -pos); } else { statut0 = Simulation.autre(v.statut); debut0 = Simulation.addDays(auj, -(pos - prem)); }
    }
    var dlg = el('dialog', 'dlg mp'), f = el('form'); f.method = 'dialog';
    f.appendChild(el('h2', null, options.titre || 'Où en êtes-vous ?'));
    f.appendChild(el('p', 'sous', 'Indiquez le début de votre rotation en cours et votre reliquat à ce moment-là. Les durées des rotations sont à 28 / 28 ; changez-les seulement si vous êtes déjà dans une rotation ajustée. Vous pouvez partir de la rotation en cours ou de la précédente.'));
    function champ(lib, ctl) { var w = el('div', 'champ'); w.appendChild(el('label', null, lib)); w.appendChild(ctl); return w; }
    var sSt = document.createElement('select'); [['T', 'Je suis au travail'], ['R', 'Je suis en repos / congé']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (o[0] === statut0) op.selected = true; sSt.appendChild(op); });
    var iDate = document.createElement('input'); iDate.type = 'date'; iDate.max = auj; iDate.value = debut0;
    var iRel = document.createElement('input'); iRel.type = 'number'; iRel.min = -365; iRel.max = 365; iRel.step = 1; iRel.value = v.reliquat == null ? 0 : v.reliquat;
    var sRot = document.createElement('select'); PRE.forEach(function (p) { var op = el('option', null, p[0] + ' jours travail / ' + p[1] + ' jours repos'); op.value = p[0] + '/' + p[1]; sRot.appendChild(op); });
    var au = el('option', null, 'Autre rotation…'); au.value = 'autre'; sRot.appendChild(au);
    var connu = PRE.some(function (p) { return p[0] === jt0 && p[1] === jr0; }); sRot.value = connu ? jt0 + '/' + jr0 : 'autre';
    var ligne = el('div', 'deux'), jt = document.createElement('input'), jr = document.createElement('input'); [jt, jr].forEach(function (x) { x.type = 'number'; x.min = 1; x.max = 90; }); jt.value = jt0; jr.value = jr0;
    ligne.appendChild(champ('Jours de travail', jt)); ligne.appendChild(champ('Jours de repos', jr)); ligne.hidden = connu;
    var haut = el('div', 'deux'); haut.appendChild(champ('1. Actuellement…', sSt)); haut.appendChild(champ('2. Début de la rotation en cours', iDate));
    f.appendChild(haut);
    var rel = champ('3. Au début de cette rotation, combien avez-vous de reliquat ? (jours)', iRel); f.appendChild(rel);
    f.appendChild(el('p', 'aide', 'Jours de congé qui vous sont dus (+), ou jours pris en avance (−) à ce moment-là. 0 si vous n\'en avez pas.'));
    f.appendChild(champ('4. Votre rotation habituelle', sRot)); f.appendChild(ligne);
    f.appendChild(el('h3', null, 'Vos rotations à partir de ce début'));
    var tbl = el('table'), cel = [], etat = el('div'), edite = [];
    var hab = function () { return { T: Math.floor(Number(jt.value)) || 0, R: Math.floor(Number(jr.value)) || 0 }; };
    for (i = 0; i < NB_LIGNES; i += 1) (function (k) {
      var tr = el('tr'), c = { tr: tr, type: el('td'), du: el('td', 'd'), au: el('td', 'd'), n: el('td', 'n') }, inp = document.createElement('input');
      inp.type = 'number'; inp.min = 1; inp.max = 120; inp.step = 1; inp.setAttribute('aria-label', 'Nombre de jours, rotation ' + (k + 1)); c.inp = inp;
      inp.addEventListener('input', function () { edite[k] = true; maj(); });
      c.n.appendChild(inp); [c.type, c.du, el('td', null, 'au'), c.au, c.n].forEach(function (x) { tr.appendChild(x); }); tbl.appendChild(tr); cel.push(c);
      edite[k] = rows[k] != null && rows[k] !== (((k % 2 === 0) === (statut0 === 'T')) ? jt0 : jr0);
      inp.value = rows[k] != null ? rows[k] : (((k % 2 === 0) === (statut0 === 'T')) ? jt0 : jr0);
    })(i);
    f.appendChild(tbl); f.appendChild(etat);
    var msg = el('div', 'msg'); msg.setAttribute('role', 'alert'); f.appendChild(msg);
    var boutons = el('div', 'boutons'), ann = el('button', 'btn-s', 'Annuler'); ann.type = 'button'; ann.addEventListener('click', function () { dlg.close(); });
    var ok = el('button', 'btn', 'Enregistrer'); ok.type = 'submit';
    if (v.depuis && !options.obligatoire) {    // planning déjà enregistré : possibilité de l'effacer (avec confirmation, pour éviter les erreurs)
      var ef = el('button', 'btn-s', 'Effacer mon planning'); ef.type = 'button'; ef.style.cssText = 'color:var(--err);border-color:var(--err)';
      ef.addEventListener('click', function () {
        if (!confirm('Effacer ' + (options.email ? 'ce planning' : 'mon planning') + ' ?\n\nLa rotation, le reliquat et les demandes de modification seront supprimés. Cette action est définitive.')) return;
        if (!confirm('Dernière confirmation : effacer définitivement le planning ?')) return;
        ef.disabled = true; Api.call('planning_effacer', options.email ? { email: options.email } : {}).then(function () { dlg.close(); if (options.onOk) options.onOk(); })
          .catch(function (err) { msg.textContent = err.message; msg.className = 'msg err'; ef.disabled = false; });
      });
      boutons.appendChild(ef);
    }
    if (!options.obligatoire) boutons.appendChild(ann); boutons.appendChild(ok); f.appendChild(boutons);
    var etatCourant = null;
    function typeDe(k) { return (k % 2 === 0) === (sSt.value === 'T') ? 'T' : 'R'; }
    function maj() {
      var h = hab(), cur = iDate.value;
      cel.forEach(function (c, k) {
        var t = typeDe(k); if (!edite[k]) c.inp.value = h[t] || '';
        var n = Math.floor(Number(c.inp.value)) || 0;
        c.type.textContent = nomType(t); c.tr.className = t === 'T' ? 'lt' : 'lr'; c.tr.classList.toggle('chg', edite[k] && n !== h[t]);
        if (/^\d{4}-\d{2}-\d{2}$/.test(cur)) { var fin = Simulation.addDays(cur, Math.max(n, 1) - 1); c.du.textContent = fr(cur); c.au.textContent = fr(fin); cur = Simulation.addDays(fin, 1); } else { c.du.textContent = c.au.textContent = '—'; }
      });
      etat.textContent = ''; etatCourant = null; var err = '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iDate.value)) err = 'Indiquez le début de la rotation en cours.';
      else if (iDate.value > auj) err = 'Le début de la rotation en cours ne peut pas être dans le futur.';
      else if (!(h.T >= 1 && h.R >= 1 && h.T <= 90 && h.R <= 90)) err = 'Rotation habituelle : de 1 à 90 jours.';
      else cel.forEach(function (c, k) { var n = Number(c.inp.value); if (!err && !(n >= 1 && n <= 120 && Math.floor(n) === n)) err = 'Rotation ' + (k + 1) + ' : de 1 à 120 jours.'; });
      if (!err && Simulation.addDays(iDate.value, Number(cel[0].inp.value) + Number(cel[1].inp.value) - 1) < auj) err = 'Date de début trop ancienne : indiquez le début de la rotation en cours (ou de la précédente).';
      if (err) { etat.appendChild(el('div', 'info alerte', err)); ok.disabled = true; return; }
      var k2 = -1; cel.forEach(function (c, k) { if (Number(c.inp.value) !== h[typeDe(k)]) k2 = k; });
      var ps = []; for (var q = 0; q <= k2; q += 1) ps.push({ type: typeDe(q), jours: Number(cel[q].inp.value) });
      etatCourant = { statut: sSt.value, depuis: iDate.value, jours_travail: h.T, jours_repos: h.R, reliquat: iRel.value === '' ? 0 : Number(iRel.value), periodes: ps };
      ok.disabled = false;
    }
    [sSt, iDate, jt, jr, iRel].forEach(function (x) { x.addEventListener('input', maj); x.addEventListener('change', maj); });
    sRot.addEventListener('change', function () { if (sRot.value === 'autre') { ligne.hidden = false; } else { ligne.hidden = true; var p = sRot.value.split('/'); jt.value = p[0]; jr.value = p[1]; } maj(); });
    maj();
    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (!etatCourant) return; ok.disabled = true; msg.className = 'msg';
      var q = etatCourant; if (options.email) q.email = options.email;
      Api.call('planning_initial', q).then(function () { try { localStorage.setItem('infra_v2_derniere_rotation', JSON.stringify({ statut: q.statut, jours_travail: q.jours_travail, jours_repos: q.jours_repos })); } catch (x) { /* stockage indisponible */ } dlg.close(); if (options.onOk) options.onOk(); })
        .catch(function (err) { msg.textContent = err.message; msg.className = 'msg err'; ok.disabled = false; });
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    if (options.obligatoire) dlg.addEventListener('cancel', function (e) { e.preventDefault(); });
    dlg.appendChild(f); document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /**
   * Point d'entrée de « Modifier mon planning » : sans rotation enregistrée, la petite fenêtre « Où en êtes-vous ? » ; sinon le planning modifiable.
   * rotation : rotation actuelle de la ligne (ou null) ; onChange() : rafraîchir la page.
   */
  function modifierMonPlanning(rotation, onChange) {
    if (!rotation) { ouvrirInitial({ titre: 'Où en êtes-vous ?', onOk: onChange }); return Promise.resolve(); }
    return Api.call('modif_moi_donnees').then(function (d) {
      ouvrir({ donnees: d, mode: 'agent', onChange: onChange, rotationBase: function () { ouvrirInitial({ titre: 'Corriger mon planning actuel', valeurs: d.rotation, donnees: d, onOk: onChange }); } });
    });
  }
  window.ModifPlanning = { ouvrirInitial: ouvrirInitial, ouvrir: ouvrir, modifierMonPlanning: modifierMonPlanning };
})();
