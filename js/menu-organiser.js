/**
 * Organisation du menu par le secrétariat (bouton ✎ de la barre latérale) : glisser les applications d'une catégorie à l'autre, changer leur ordre,
 * renommer les catégories, en ajouter, en supprimer (vides). Le rangement enregistré change la barre latérale ET les cartes de l'accueil ; il ne change aucun droit.
 * Sans souris : les boutons ▲ ▼ et la liste « Déplacer vers » font la même chose (téléphone, clavier).
 * Chargé seulement au clic (js/menu-lateral.js). Réservé au rôle secrétariat côté serveur.
 */
(function () {
  if (window.MenuOrganiser) return;
  var cats = [], dlg, zone, msg, glisse = null, niveaux = [], simul = null;   // simul = rang simulé (« Voir comme »), null = aucune simulation
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function nouvelId() { return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36); }
  function auto(c) { return /^autres-/.test(c.id); }
  function masq(c) { return c.id === 'masquees'; }   // applications masquées : invisibles pour tous (actif = 0), rangées à part
  function fige(c) { return auto(c) || masq(c); }   // groupes ni renommables, ni déplaçables, ni enregistrés comme catégories

  var CSS = '#mo{width:min(760px,96vw);max-height:92vh;border:0;border-radius:16px;padding:0;box-shadow:0 20px 60px rgba(0,0,0,.4);color:var(--text-dark,#1A1A2E);background:var(--surface,#fff)}#mo::backdrop{background:rgba(0,0,0,.45)}' +
    '#mo .mo-in{display:flex;flex-direction:column;max-height:92vh}#mo .mo-tete{padding:16px 18px 6px}#mo h3{margin:0 0 4px;font-size:18px}#mo .mo-aide{margin:0;font-size:12.5px;color:var(--text-muted,#6B7280)}' +
    '#mo .mo-corps{overflow:auto;padding:8px 18px;flex:1}#mo .mo-pied{display:flex;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid var(--border,#E5E7EB);flex-wrap:wrap}' +
    '#mo .mo-cat{border:1.5px solid var(--border,#E5E7EB);border-radius:12px;margin:0 0 10px;background:var(--surface-2,#F8F9FA)}#mo .mo-cat.sur{border-color:#E85D04;background:#FFF4EA}#mo .mo-cat.auto{opacity:.85;border-style:dashed}' +
    '#mo .mo-ch{display:flex;gap:6px;align-items:center;padding:8px 10px}#mo .mo-poi{cursor:grab;opacity:.55;font-size:15px;flex:none;user-select:none}' +
    '#mo input.mo-ico{width:44px;text-align:center;padding:5px 2px;font-size:16px}#mo input.mo-nom{flex:1;min-width:0;padding:6px 8px;font-weight:700}' +
    '#mo input{border:1.5px solid var(--border,#E5E7EB);border-radius:8px;background:var(--surface,#fff);color:inherit;font:inherit}#mo select.mo-vis{max-width:150px;font-size:11.5px}#mo select{border:1.5px solid var(--border,#E5E7EB);border-radius:8px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:12px;padding:4px;max-width:120px}' +
    '#mo .mo-b{border:1px solid var(--border,#E5E7EB);background:var(--surface,#fff);border-radius:8px;min-width:30px;height:30px;cursor:pointer;font:inherit;flex:none}#mo .mo-b:disabled{opacity:.35;cursor:default}#mo .mo-b.p{background:linear-gradient(135deg,#E85D04,#F48C06);color:#fff;border:0;padding:0 16px;height:36px;font-weight:700}' +
    '#mo ul{list-style:none;margin:0;padding:0 10px 8px}#mo li{display:flex;gap:6px;align-items:center;padding:5px 8px;margin:3px 0;border-radius:9px;background:var(--surface,#fff);border:1px solid var(--border,#E5E7EB)}#mo li.glisse{opacity:.4}#mo li .mo-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13.5px}#mo li.sur{box-shadow:0 -3px 0 #E85D04}' +
    '#mo .mo-vide{padding:6px 12px 10px;font-size:12.5px;color:var(--text-muted,#6B7280)}#mo .mo-err{color:#B42318;font-weight:700;font-size:13px;flex:1}';

  function deplacerApp(titre, versId, avant) {   // avant = titre de l'application devant laquelle insérer (sinon à la fin)
    var app = null;
    cats.forEach(function (c) { var i = c.apps.findIndex(function (a) { return a.titre === titre; }); if (i >= 0) app = c.apps.splice(i, 1)[0]; });
    if (!app) return;
    var cible = cats.filter(function (c) { return c.id === versId; })[0]; if (!cible) return;
    var k = avant ? cible.apps.findIndex(function (a) { return a.titre === avant; }) : -1;
    if (k < 0) cible.apps.push(app); else cible.apps.splice(k, 0, app);
    dessiner();
  }
  function bougerCat(i, d) { var j = i + d; if (j < 0 || j >= cats.length) return; var x = cats.splice(i, 1)[0]; cats.splice(j, 0, x); dessiner(); }
  function bougerApp(c, i, d) { var j = i + d; if (j < 0 || j >= c.apps.length) return; var x = c.apps.splice(i, 1)[0]; c.apps.splice(j, 0, x); dessiner(); }

  function dessiner() {
    var haut = zone.scrollTop; zone.textContent = '';
    cats.forEach(function (c, ci) {
      var bloc = el('div', 'mo-cat' + (fige(c) ? ' auto' : '')); bloc.dataset.id = c.id;
      var ch = el('div', 'mo-ch'), poi = el('span', 'mo-poi', '⠿'); poi.title = 'Glisser pour changer l\'ordre des catégories';
      if (!fige(c)) { poi.draggable = true; poi.addEventListener('dragstart', function (e) { glisse = { cat: c.id }; try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* rien */ } }); poi.addEventListener('dragend', function () { glisse = null; }); }
      ch.appendChild(poi);
      if (fige(c)) { ch.appendChild(el('span', 'mo-nom', (c.icone || '📁') + ' ' + c.titre + (masq(c) ? ' (invisibles pour tous ; glissez-en une ici pour la masquer)' : ' (non classées : rangez-les ailleurs)'))); ch.lastChild.style.cssText = 'flex:1;font-weight:700;font-size:13px'; }
      else {
        var ico = el('input', 'mo-ico'); ico.value = c.icone; ico.maxLength = 8; ico.title = 'Icône (un emoji)'; ico.addEventListener('input', function () { c.icone = ico.value; }); ico.addEventListener('change', dessiner);
        var nom = el('input', 'mo-nom'); nom.value = c.titre; nom.maxLength = 40; nom.setAttribute('aria-label', 'Nom de la catégorie'); nom.addEventListener('input', function () { c.titre = nom.value; }); nom.addEventListener('change', dessiner);   // les listes « Déplacer… » reprennent le nouveau nom
        ch.appendChild(ico); ch.appendChild(nom);
        var hb = el('button', 'mo-b', '▲'); hb.type = 'button'; hb.title = 'Monter la catégorie'; hb.disabled = ci === 0; hb.addEventListener('click', function () { bougerCat(ci, -1); });
        var bb = el('button', 'mo-b', '▼'); bb.type = 'button'; bb.title = 'Descendre la catégorie'; bb.disabled = ci >= cats.length - 1 || fige(cats[ci + 1]); bb.addEventListener('click', function () { bougerCat(ci, 1); });
        var sup = el('button', 'mo-b', '🗑'); sup.type = 'button'; sup.title = c.apps.length ? 'Videz la catégorie pour la supprimer' : 'Supprimer la catégorie'; sup.disabled = !!c.apps.length; sup.addEventListener('click', function () { cats.splice(ci, 1); dessiner(); });
        ch.appendChild(hb); ch.appendChild(bb); ch.appendChild(sup);
      }
      bloc.appendChild(ch);
      var ul = el('ul');
      c.apps.forEach(function (a, ai) {
        var li = el('li'); li.draggable = true; li.dataset.titre = a.titre;
        li.addEventListener('dragstart', function (e) { glisse = { app: a.titre }; li.classList.add('glisse'); try { e.dataTransfer.setData('text/plain', a.titre); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* rien */ } e.stopPropagation(); });
        li.addEventListener('dragend', function () { glisse = null; li.classList.remove('glisse'); });
        li.addEventListener('dragover', function (e) { if (glisse && glisse.app && glisse.app !== a.titre) { e.preventDefault(); e.stopPropagation(); li.classList.add('sur'); } });
        li.addEventListener('dragleave', function () { li.classList.remove('sur'); });
        li.addEventListener('drop', function (e) { li.classList.remove('sur'); if (glisse && glisse.app) { e.preventDefault(); e.stopPropagation(); deplacerApp(glisse.app, c.id, a.titre); } });
        li.appendChild(el('span', 'mo-poi', '⠿')); li.appendChild(el('span', null, a.emoji || '📄')); var t = el('span', 'mo-t', a.titre); t.title = a.titre + (a.module_titre ? ' — module ' + a.module_titre : ''); li.appendChild(t);
        var h2 = el('button', 'mo-b', '▲'); h2.type = 'button'; h2.disabled = ai === 0; h2.title = 'Monter'; h2.addEventListener('click', function () { bougerApp(c, ai, -1); });
        var b2 = el('button', 'mo-b', '▼'); b2.type = 'button'; b2.disabled = ai >= c.apps.length - 1; b2.title = 'Descendre'; b2.addEventListener('click', function () { bougerApp(c, ai, 1); });
        var sel = el('select'); sel.setAttribute('aria-label', 'Déplacer vers une autre catégorie'); var o0 = el('option', null, '↪ Déplacer…'); o0.value = ''; sel.appendChild(o0);
        cats.forEach(function (d) { if (d.id !== c.id && !auto(d)) { var o = el('option', null, (d.icone || '') + ' ' + d.titre); o.value = d.id; sel.appendChild(o); } });
        sel.addEventListener('change', function () { if (sel.value) deplacerApp(a.titre, sel.value, null); });
        var vis = el('select', 'mo-vis'); vis.setAttribute('aria-label', 'Niveau de vision : qui voit cette application'); vis.title = 'Qui voit cette application (en plus des droits du module) : ce niveau et tous ceux au-dessus';
        var v0 = el('option', null, 'Tous'); v0.value = ''; vis.appendChild(v0); niveaux.forEach(function (n) { var o = el('option', null, '≤ ' + n.rang + ' ' + n.nom); o.value = String(n.rang); vis.appendChild(o); });
        vis.value = a.vision == null ? '' : String(a.vision); vis.addEventListener('change', function () { a.vision = vis.value === '' ? null : Number(vis.value); dessiner(); });
        if (simul !== null && (masq(c) || (a.vision != null && simul > a.vision))) { li.style.opacity = '.35'; li.title = 'Invisible pour le niveau simulé'; }
        li.appendChild(h2); li.appendChild(b2); li.appendChild(vis); li.appendChild(sel); ul.appendChild(li);
      });
      if (!c.apps.length) bloc.appendChild(el('div', 'mo-vide', masq(c) ? 'Aucune application masquée.' : 'Aucune application : glissez-en une ici.'));
      bloc.appendChild(ul);
      bloc.addEventListener('dragover', function (e) { if (glisse && (glisse.app || (glisse.cat && glisse.cat !== c.id && !fige(c)))) { e.preventDefault(); bloc.classList.add('sur'); } });
      bloc.addEventListener('dragleave', function (e) { if (!bloc.contains(e.relatedTarget)) bloc.classList.remove('sur'); });
      bloc.addEventListener('drop', function (e) {
        bloc.classList.remove('sur'); if (!glisse) return; e.preventDefault();
        if (glisse.app) deplacerApp(glisse.app, c.id, null);
        else if (glisse.cat && !fige(c)) { var de = cats.findIndex(function (x) { return x.id === glisse.cat; }), vers = cats.findIndex(function (x) { return x.id === c.id; }); if (de >= 0 && vers >= 0) { var x = cats.splice(de, 1)[0]; cats.splice(vers, 0, x); dessiner(); } }
      });
      zone.appendChild(bloc);
    });
    zone.scrollTop = haut;
  }

  function enregistrer(bouton) {
    msg.textContent = '';
    var vraies = cats.filter(function (c) { return !fige(c); });
    for (var i = 0; i < vraies.length; i += 1) if (String(vraies[i].titre).trim().length < 2) { msg.textContent = 'Chaque catégorie doit avoir un nom (2 caractères au moins).'; return; }
    var apps = []; cats.forEach(function (c) { c.apps.forEach(function (a, i) { apps.push({ titre: a.titre, rubrique: fige(c) ? '' : c.id, ordre: (i + 1) * 10, actif: masq(c) ? 0 : 1, vision: a.vision == null ? null : a.vision }); }); });
    bouton.disabled = true;
    Api.call('menu_organisation_enregistrer', { rubriques: vraies.map(function (c) { return { id: c.id, titre: String(c.titre).trim(), icone: String(c.icone || '').trim() || '📁' }; }), apps: apps })
      .then(function () { try { sessionStorage.removeItem('ml_menu'); sessionStorage.removeItem('ml_menu2'); sessionStorage.removeItem('gm_pages'); } catch (e) { /* rien */ } location.reload(); })
      .catch(function (e) { msg.textContent = e.message; bouton.disabled = false; });
  }

  function construire(d) {
    // applications rangées comme elles s'affichent aujourd'hui (mêmes règles que la barre et les cartes) ; les masquées (actif = 0) vont dans leur groupe
    niveaux = d.niveaux || [];
    var cartes = function (a) { return { titre: a.titre, description: a.description, emoji: a.emoji, url: a.url, rubrique: a.rubrique, ordre: a.ordre, module_titre: a.module_titre, vision: a.vision == null ? null : a.vision }; };
    var visibles = d.apps.filter(function (a) { return a.actif !== 0; }).map(cartes), cachees = d.apps.filter(function (a) { return a.actif === 0; }).map(cartes);
    var cfg = d.rubriques && d.rubriques.length ? d.rubriques : null, groupes = Rubriques.regrouper([{ id: 'tout', titre: 'Tout', icone: '', apps: visibles }], cfg);
    cats = groupes.map(function (g) { return { id: g.id, titre: g.titre, icone: g.icone, apps: g.apps.slice() }; });
    cats.sort(function (a, b) { return (auto(a) ? 1 : 0) - (auto(b) ? 1 : 0); });   // « non classées » à la fin
    cats.push({ id: 'masquees', titre: 'Masquées', icone: '🚫', apps: cachees });
  }

  /** Organisation validée par le secrétariat (tableau « Frequence / Qui ») : catégories dans l'ordre, applications dans l'ordre, et celles à masquer. Les titres sont comparés sans accents ni majuscules ; « ~ » = contient. */
  var PRESET = {
    cats: [
      { id: 'pilotage', titre: 'Chantiers', icone: '📈', apps: ['Affectation chantier|3', 'Avancement Chantiers|6', 'Suivi Chantier|6', 'Suivi des Tâches Journalières', 'Fiche d\'évaluation|6', 'Passation des Consignes|7'] },
      { id: 'marches', titre: 'Marchés', icone: '📑', apps: ['Suivi CPM V5', 'Dossiers CPM — Détail', 'Vivier des Entreprises', 'Passation des Contrats — Outils CPM'] },
      { id: 'logistique', titre: 'Logistique & Accès site', icone: '🚧', apps: ['Prises en Charge + Autorisation d\'Accès|9', 'Badges prestataires|9', 'Fichier des habilitations|3', 'Statistique sous-traitants|3', 'Bon de sortie matériel|7', '~avril 2026|3', 'Affectation Véhicule – Division Infra|7', 'Générateur Requête Transport|7', 'Autorisation GAZ-OIL|9', 'Ordre de travail|7', 'Repas à emporter|6', 'Commande de Pièces – Service Électromécanique|5', 'Suivi des Écarts Inventaire|5', 'Liste Radio INFRA RNS|7'] },
      { id: 'personnel', titre: 'Personnel', icone: '👥', apps: ['Planning & rotations|7', 'Simulation de planning|7', 'Affectation du personnel|3', 'Feuille de pointage|7', 'Organigramme — Division Infrastructure|7', 'Personnel de Permanence|7', 'Planning de Formation|7', 'Planning de Visite Médicale|7', 'Veste en Cuir – Personnel Actif RNS', 'Dotation Vivres & Eau Minérale|6', 'Prise en charge hôtel|3', 'Réservation Vol|7', 'Demande de réservation|7', 'Requête de transport de personnel|7', 'Documents administratifs|7'] },
      { id: 'admin', titre: 'Admin', icone: '📨', apps: ['Paramétrage|0', 'Renommage de documents|7', 'Suivi des Instances Courriers', 'Ordres de Mission|7'] },
      { id: 'it', titre: 'Informatique', icone: '💻', apps: ['Contrôle de l\'annuaire|0', 'Gestion des privilèges|0', 'HELPDESK Ticket support IT|7', 'Accès, Partage & Privilèges', 'Email en Quarantaine (anti-spam)|7'] },
      { id: 'rapports', titre: 'Rapport', icone: '📊', apps: ['Rapports journaliers|7', 'Rapport Hebdomadaire Infra|3'] },
      { id: 'bibliotheque', titre: 'Bibliothèque', icone: '📚', apps: ['Imputation SH RNS|7', 'Table Stock Magasin RNS|7', 'Catalogue Formation|7', 'Vidéos Formation SAP|7'] }
    ],
    masquees: ['Suivi des Tâches Journalières', 'Veste en Cuir – Personnel Actif RNS', 'Suivi des Instances Courriers', 'Accès, Partage & Privilèges']
  };
  function nn(t) { return String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function trouve(reste, motif) {
    var m = String(motif), partiel = m.charAt(0) === '~', k = nn(partiel ? m.slice(1) : m);
    for (var i = 0; i < reste.length; i += 1) if (partiel ? nn(reste[i].titre).indexOf(k) >= 0 : nn(reste[i].titre) === k) return i;
    return -1;
  }
  /** Reclasse toutes les applications d'après PRESET (sans enregistrer : on vérifie, on ajuste, puis « Enregistrer »). Ce qui n'est pas prévu va dans « Non classées ». */
  function appliquerPreset() {
    var reste = []; cats.forEach(function (c) { c.apps.forEach(function (a) { reste.push(a); }); });
    var pris = function (motif) { var i = trouve(reste, motif); return i < 0 ? null : reste.splice(i, 1)[0]; };
    var masquees = PRESET.masquees.map(function (m) { return trouve(reste, m); }).filter(function (i) { return i >= 0; });   // titres à masquer, repérés avant de ranger
    var aMasquer = {}; masquees.forEach(function (i) { aMasquer[reste[i].titre] = 1; });
    var nouv = PRESET.cats.map(function (c) { return { id: c.id, titre: c.titre, icone: c.icone, apps: c.apps.map(function (e) { var m = String(e).split('|'), a = pris(m[0]); if (a && m.length > 1) a.vision = m[1] === '' ? null : Number(m[1]); return a; }).filter(function (a) { return a && !aMasquer[a.titre]; }) }; });
    var cachees = []; Object.keys(aMasquer).forEach(function (t) { cats.forEach(function (c) { c.apps.forEach(function (a) { if (a.titre === t) cachees.push(a); }); }); });
    nouv.forEach(function (c) { c.apps = c.apps.filter(function (a) { return !aMasquer[a.titre]; }); });
    var autres = reste.filter(function (a) { return !aMasquer[a.titre]; });
    cats = nouv.filter(function (c) { return c.apps.length; });
    if (autres.length) cats.push({ id: 'autres-nouveau', titre: 'Non classées', icone: '📁', apps: autres });
    cats.push({ id: 'masquees', titre: 'Masquées', icone: '🚫', apps: cachees });
    dessiner();
  }

  function ouvrir() {
    Api.call('menu_organisation_lire').then(function (d) {
      construire(d);
      if (!document.getElementById('mo-css')) { var st = el('style'); st.id = 'mo-css'; st.textContent = CSS; document.head.appendChild(st); }
      var vieux = document.getElementById('mo'); if (vieux) vieux.remove();
      dlg = el('dialog'); dlg.id = 'mo';
      var inn = el('div', 'mo-in'), tete = el('div', 'mo-tete');
      tete.appendChild(el('h3', null, 'Organiser les applications'));
      tete.appendChild(el('p', 'mo-aide', 'Glissez une application dans une catégorie (ou utilisez ▲ ▼ et « Déplacer… »), renommez les catégories, ajoutez-en. Le menu de gauche et les cartes de l\'accueil suivent. Le niveau de vision de chaque application (liste « ≤ N ») restreint qui la voit, en plus des droits du module ; « Voir comme » montre l\'effet.'));
      var sim = el('div'); sim.style.cssText = 'margin-top:8px;display:flex;gap:8px;align-items:center;font-size:12.5px;flex-wrap:wrap';
      var simSel = el('select'); simSel.style.cssText = 'font-size:12.5px;padding:4px'; var s0 = el('option', null, '— aucune —'); s0.value = ''; simSel.appendChild(s0);
      niveaux.forEach(function (n) { var o = el('option', null, n.nom); o.value = String(n.rang); simSel.appendChild(o); });
      simSel.addEventListener('change', function () { simul = simSel.value === '' ? null : Number(simSel.value); dessiner(); });
      sim.appendChild(el('span', null, '👁 Voir comme :')); sim.appendChild(simSel); sim.appendChild(el('span', 'mo-aide', 'les applications grisées ne seraient pas visibles pour ce niveau (en plus des droits du module)'));
      tete.appendChild(sim);
      zone = el('div', 'mo-corps'); var pied = el('div', 'mo-pied'); msg = el('span', 'mo-err');
      var ajout = el('button', 'mo-b', '＋ Ajouter une catégorie'); ajout.type = 'button'; ajout.style.padding = '0 12px'; ajout.style.height = '36px';
      ajout.addEventListener('click', function () { var i = cats.findIndex(fige); var c = { id: nouvelId(), titre: 'Nouvelle catégorie', icone: '📁', apps: [] }; if (i < 0) cats.push(c); else cats.splice(i, 0, c); dessiner(); var champs = zone.querySelectorAll('.mo-nom'); var f = champs[(i < 0 ? cats.length : i) - 1]; if (f && f.select) { f.focus(); f.select(); f.scrollIntoView({ block: 'center' }); } });
      var pre = el('button', 'mo-b', '📋 Appliquer l\'organisation validée'); pre.type = 'button'; pre.style.padding = '0 12px'; pre.style.height = '36px'; pre.title = 'Reclasse toutes les applications d\'après votre tableau (catégories, ordre, applications à masquer). Rien n\'est enregistré avant « Enregistrer ».'; pre.addEventListener('click', function () { if (confirm('Reclasser toutes les applications d\'après l\'organisation validée ?\nRien n\'est enregistré avant de cliquer sur « Enregistrer ».')) appliquerPreset(); });
      var ann = el('button', 'mo-b', 'Annuler'); ann.type = 'button'; ann.style.padding = '0 14px'; ann.style.height = '36px'; ann.addEventListener('click', function () { dlg.close(); });
      var ok = el('button', 'mo-b p', 'Enregistrer'); ok.type = 'button'; ok.addEventListener('click', function () { enregistrer(ok); });
      pied.appendChild(ajout); pied.appendChild(pre); pied.appendChild(msg); pied.appendChild(ann); pied.appendChild(ok);
      inn.appendChild(tete); inn.appendChild(zone); inn.appendChild(pied); dlg.appendChild(inn); document.body.appendChild(dlg);
      dlg.addEventListener('close', function () { dlg.remove(); });
      dessiner();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }).catch(function (e) { alert(e.message); });
  }
  window.MenuOrganiser = { ouvrir: ouvrir };
})();
