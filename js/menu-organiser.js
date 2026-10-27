/**
 * Organisation du menu par le secrétariat (bouton ✎ de la barre latérale) : glisser les applications d'une catégorie à l'autre, changer leur ordre,
 * renommer les catégories, en ajouter, en supprimer (vides). Le rangement enregistré change la barre latérale ET les cartes de l'accueil ; il ne change aucun droit.
 * Sans souris : les boutons ▲ ▼ et la liste « Déplacer vers » font la même chose (téléphone, clavier).
 * Chargé seulement au clic (js/menu-lateral.js). Réservé au rôle secrétariat côté serveur.
 */
(function () {
  if (window.MenuOrganiser) return;
  var cats = [], dlg, zone, msg, glisse = null;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function nouvelId() { return 'c' + Date.now().toString(36) + Math.floor(Math.random() * 36).toString(36); }
  function auto(c) { return /^autres-/.test(c.id); }

  var CSS = '#mo{width:min(760px,96vw);max-height:92vh;border:0;border-radius:16px;padding:0;box-shadow:0 20px 60px rgba(0,0,0,.4);color:var(--text-dark,#1A1A2E);background:var(--surface,#fff)}#mo::backdrop{background:rgba(0,0,0,.45)}' +
    '#mo .mo-in{display:flex;flex-direction:column;max-height:92vh}#mo .mo-tete{padding:16px 18px 6px}#mo h3{margin:0 0 4px;font-size:18px}#mo .mo-aide{margin:0;font-size:12.5px;color:var(--text-muted,#6B7280)}' +
    '#mo .mo-corps{overflow:auto;padding:8px 18px;flex:1}#mo .mo-pied{display:flex;gap:8px;align-items:center;padding:12px 18px;border-top:1px solid var(--border,#E5E7EB);flex-wrap:wrap}' +
    '#mo .mo-cat{border:1.5px solid var(--border,#E5E7EB);border-radius:12px;margin:0 0 10px;background:var(--surface-2,#F8F9FA)}#mo .mo-cat.sur{border-color:#E85D04;background:#FFF4EA}#mo .mo-cat.auto{opacity:.85;border-style:dashed}' +
    '#mo .mo-ch{display:flex;gap:6px;align-items:center;padding:8px 10px}#mo .mo-poi{cursor:grab;opacity:.55;font-size:15px;flex:none;user-select:none}' +
    '#mo input.mo-ico{width:44px;text-align:center;padding:5px 2px;font-size:16px}#mo input.mo-nom{flex:1;min-width:0;padding:6px 8px;font-weight:700}' +
    '#mo input{border:1.5px solid var(--border,#E5E7EB);border-radius:8px;background:var(--surface,#fff);color:inherit;font:inherit}#mo select{border:1.5px solid var(--border,#E5E7EB);border-radius:8px;background:var(--surface,#fff);color:inherit;font:inherit;font-size:12px;padding:4px;max-width:120px}' +
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
      var bloc = el('div', 'mo-cat' + (auto(c) ? ' auto' : '')); bloc.dataset.id = c.id;
      var ch = el('div', 'mo-ch'), poi = el('span', 'mo-poi', '⠿'); poi.title = 'Glisser pour changer l\'ordre des catégories';
      if (!auto(c)) { poi.draggable = true; poi.addEventListener('dragstart', function (e) { glisse = { cat: c.id }; try { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* rien */ } }); poi.addEventListener('dragend', function () { glisse = null; }); }
      ch.appendChild(poi);
      if (auto(c)) { ch.appendChild(el('span', 'mo-nom', (c.icone || '📁') + ' ' + c.titre + ' (non classées : rangez-les ailleurs)')); ch.lastChild.style.cssText = 'flex:1;font-weight:700;font-size:13px'; }
      else {
        var ico = el('input', 'mo-ico'); ico.value = c.icone; ico.maxLength = 8; ico.title = 'Icône (un emoji)'; ico.addEventListener('input', function () { c.icone = ico.value; }); ico.addEventListener('change', dessiner);
        var nom = el('input', 'mo-nom'); nom.value = c.titre; nom.maxLength = 40; nom.setAttribute('aria-label', 'Nom de la catégorie'); nom.addEventListener('input', function () { c.titre = nom.value; }); nom.addEventListener('change', dessiner);   // les listes « Déplacer… » reprennent le nouveau nom
        ch.appendChild(ico); ch.appendChild(nom);
        var hb = el('button', 'mo-b', '▲'); hb.type = 'button'; hb.title = 'Monter la catégorie'; hb.disabled = ci === 0; hb.addEventListener('click', function () { bougerCat(ci, -1); });
        var bb = el('button', 'mo-b', '▼'); bb.type = 'button'; bb.title = 'Descendre la catégorie'; bb.disabled = ci >= cats.length - 1 || auto(cats[ci + 1]); bb.addEventListener('click', function () { bougerCat(ci, 1); });
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
        li.appendChild(h2); li.appendChild(b2); li.appendChild(sel); ul.appendChild(li);
      });
      if (!c.apps.length) bloc.appendChild(el('div', 'mo-vide', 'Aucune application : glissez-en une ici.'));
      bloc.appendChild(ul);
      bloc.addEventListener('dragover', function (e) { if (glisse && (glisse.app || (glisse.cat && glisse.cat !== c.id && !auto(c)))) { e.preventDefault(); bloc.classList.add('sur'); } });
      bloc.addEventListener('dragleave', function (e) { if (!bloc.contains(e.relatedTarget)) bloc.classList.remove('sur'); });
      bloc.addEventListener('drop', function (e) {
        bloc.classList.remove('sur'); if (!glisse) return; e.preventDefault();
        if (glisse.app) deplacerApp(glisse.app, c.id, null);
        else if (glisse.cat && !auto(c)) { var de = cats.findIndex(function (x) { return x.id === glisse.cat; }), vers = cats.findIndex(function (x) { return x.id === c.id; }); if (de >= 0 && vers >= 0) { var x = cats.splice(de, 1)[0]; cats.splice(vers, 0, x); dessiner(); } }
      });
      zone.appendChild(bloc);
    });
    zone.scrollTop = haut;
  }

  function enregistrer(bouton) {
    msg.textContent = '';
    var vraies = cats.filter(function (c) { return !auto(c); });
    for (var i = 0; i < vraies.length; i += 1) if (String(vraies[i].titre).trim().length < 2) { msg.textContent = 'Chaque catégorie doit avoir un nom (2 caractères au moins).'; return; }
    var apps = []; cats.forEach(function (c) { c.apps.forEach(function (a, i) { apps.push({ titre: a.titre, rubrique: auto(c) ? '' : c.id, ordre: (i + 1) * 10 }); }); });
    bouton.disabled = true;
    Api.call('menu_organisation_enregistrer', { rubriques: vraies.map(function (c) { return { id: c.id, titre: String(c.titre).trim(), icone: String(c.icone || '').trim() || '📁' }; }), apps: apps })
      .then(function () { try { sessionStorage.removeItem('ml_menu'); sessionStorage.removeItem('ml_menu2'); sessionStorage.removeItem('gm_pages'); } catch (e) { /* rien */ } location.reload(); })
      .catch(function (e) { msg.textContent = e.message; bouton.disabled = false; });
  }

  function construire(d) {
    // applications rangées comme elles s'affichent aujourd'hui (mêmes règles que la barre et les cartes)
    var pseudo = [{ id: 'tout', titre: 'Tout', icone: '', apps: d.apps.map(function (a) { return { titre: a.titre, description: a.description, emoji: a.emoji, url: a.url, rubrique: a.rubrique, ordre: a.ordre, module_titre: a.module_titre }; }) }];
    var cfg = d.rubriques && d.rubriques.length ? d.rubriques : null, groupes = Rubriques.regrouper(pseudo, cfg);
    cats = groupes.map(function (g) { return { id: g.id, titre: g.titre, icone: g.icone, apps: g.apps.slice() }; });
    cats.sort(function (a, b) { return (auto(a) ? 1 : 0) - (auto(b) ? 1 : 0); });   // « non classées » à la fin
  }

  function ouvrir() {
    Api.call('menu_organisation_lire').then(function (d) {
      construire(d);
      if (!document.getElementById('mo-css')) { var st = el('style'); st.id = 'mo-css'; st.textContent = CSS; document.head.appendChild(st); }
      var vieux = document.getElementById('mo'); if (vieux) vieux.remove();
      dlg = el('dialog'); dlg.id = 'mo';
      var inn = el('div', 'mo-in'), tete = el('div', 'mo-tete');
      tete.appendChild(el('h3', null, 'Organiser les applications'));
      tete.appendChild(el('p', 'mo-aide', 'Glissez une application dans une catégorie (ou utilisez ▲ ▼ et « Déplacer… »), renommez les catégories, ajoutez-en. Le menu de gauche et les cartes de l\'accueil suivent. Aucun droit n\'est modifié.'));
      zone = el('div', 'mo-corps'); var pied = el('div', 'mo-pied'); msg = el('span', 'mo-err');
      var ajout = el('button', 'mo-b', '＋ Ajouter une catégorie'); ajout.type = 'button'; ajout.style.padding = '0 12px'; ajout.style.height = '36px';
      ajout.addEventListener('click', function () { var i = cats.findIndex(auto); var c = { id: nouvelId(), titre: 'Nouvelle catégorie', icone: '📁', apps: [] }; if (i < 0) cats.push(c); else cats.splice(i, 0, c); dessiner(); var champs = zone.querySelectorAll('.mo-nom'); var f = champs[(i < 0 ? cats.length : i) - 1]; if (f && f.select) { f.focus(); f.select(); f.scrollIntoView({ block: 'center' }); } });
      var ann = el('button', 'mo-b', 'Annuler'); ann.type = 'button'; ann.style.padding = '0 14px'; ann.style.height = '36px'; ann.addEventListener('click', function () { dlg.close(); });
      var ok = el('button', 'mo-b p', 'Enregistrer'); ok.type = 'button'; ok.addEventListener('click', function () { enregistrer(ok); });
      pied.appendChild(ajout); pied.appendChild(msg); pied.appendChild(ann); pied.appendChild(ok);
      inn.appendChild(tete); inn.appendChild(zone); inn.appendChild(pied); dlg.appendChild(inn); document.body.appendChild(dlg);
      dlg.addEventListener('close', function () { dlg.remove(); });
      dessiner();
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }).catch(function (e) { alert(e.message); });
  }
  window.MenuOrganiser = { ouvrir: ouvrir };
})();
