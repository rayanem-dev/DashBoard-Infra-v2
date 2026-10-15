/* Interface « Badges prestataires » : liste des personnes, entreprises & contrats, historique, réglages, aperçu et impression recto-verso.
 * Monter avec BadgesApp.monter(élément, { adapter, config }) — l'adaptateur dit où sont les données :
 *   BadgesApp.adaptateurLocal()  application autonome (données dans ce navigateur, import CSV / collage depuis Excel) ;
 *   un adaptateur du portail (badges.html)  données lues dans le CPM et les Enquêtes administratives, historique commun. */
var BadgesApp = (function () {
  'use strict';
  var B = window.Badges;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function lire(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function id() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function aujourdhui() { var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  // ---------- Adaptateur autonome (données dans le navigateur) ----------
  function adaptateurLocal(prefixe) {
    prefixe = prefixe || 'badges_';
    var K = { p: prefixe + 'personnes', e: prefixe + 'entreprises', h: prefixe + 'historique' };
    function sauver(k, v) { if (!ecrire(k, v)) return Promise.reject(new Error('Mémoire du navigateur pleine ou bloquée : exportez vos données puis videz les photos.')); return Promise.resolve(); }
    return {
      nom: 'local',
      charger: function () { return Promise.resolve({ personnes: lire(K.p, []), entreprises: lire(K.e, []), historique: lire(K.h, []), utilisateur: '' }); },
      ecrirePersonnes: function (liste) { return sauver(K.p, liste); },
      ecrireEntreprises: function (liste) { return sauver(K.e, liste); },
      numeroter: function (items, annee, cfg, utilisateur) {
        var hist = lire(K.h, []), r = B.attribuer(hist, items, annee, cfg), jour = aujourdhui();
        r.nouveaux.forEach(function (it) {
          hist.push({ date: jour, ref: it.ref, n: it.n, annee: it.annee, cle: B.cle(it), nom: it.nom, prenom: it.prenom, fonction: it.fonction, entreprise: it.entreprise, structure: it.structure || cfg.structure, contrat: it.contrat, imprime_par: utilisateur || '' });
        });
        // réimpressions : une ligne de plus dans l'historique (chaque impression est tracée)
        items.forEach(function (it, i) { if (r.items[i].reutilise && !r.nouveaux.some(function (x) { return x.n === r.items[i].n; })) hist.push({ date: jour, ref: r.items[i].ref, n: r.items[i].n, annee: r.items[i].annee, cle: B.cle(it), nom: it.nom, prenom: it.prenom, fonction: it.fonction, entreprise: it.entreprise, structure: it.structure || cfg.structure, contrat: it.contrat, imprime_par: utilisateur || '' }); });
        return sauver(K.h, hist).then(function () { return { items: r.items, historique: hist }; });
      },
      sauvegarde: function () { return { personnes: lire(K.p, []), entreprises: lire(K.e, []), historique: lire(K.h, []) }; },
      restaurer: function (o) { return sauver(K.p, o.personnes || []).then(function () { return sauver(K.e, o.entreprises || []); }).then(function () { return sauver(K.h, o.historique || []); }); }
    };
  }

  // ---------- Application ----------
  function monter(racine, opts) {
    opts = opts || {};
    var adapter = opts.adapter || adaptateurLocal(), cleReglages = (opts.prefixe || 'badges_') + 'reglages';
    var S = { cfg: B.config(Object.assign({}, window.BADGES_CONFIG || {}, lire(cleReglages, {}))), personnes: [], entreprises: [], hist: [], sel: {}, onglet: 'badges', q: '', fe: '', util: '', info: '' };
    var annee = new Date().getFullYear();
    racine.className = (racine.className ? racine.className + ' ' : '') + 'bdg-app';
    var zone = el('div', 'bdg-zone'), msg = el('div', 'bdg-msg'); msg.setAttribute('role', 'status');

    function dire(t, err) { msg.textContent = t || ''; msg.className = 'bdg-msg' + (err ? ' bdg-err' : '') + (t ? ' bdg-vu' : ''); if (t && !err) setTimeout(function () { if (msg.textContent === t) { msg.textContent = ''; msg.className = 'bdg-msg'; } }, 5000); }
    function echec(e) { dire((e && e.message) ? e.message : 'Échec', true); }

    function numeroDe(p) { var k = B.cle(p), r = null; S.hist.forEach(function (h) { if (Number(h.annee) === annee && (h.cle || B.cle(h)) === k) r = h; }); return r; }
    function entrepriseDe(nom) { var k = B.norm(nom), r = null; S.entreprises.forEach(function (e) { if (B.norm(e.nom) === k) r = e; }); return r; }

    function recharger() {
      return adapter.charger().then(function (d) { S.personnes = d.personnes || []; S.entreprises = d.entreprises || []; S.hist = d.historique || []; S.util = d.utilisateur || ''; S.lecture = d.niveau !== undefined && d.niveau < 2; S.info = d.info || ''; S.avert = d.avertissements || []; dessiner(); }).catch(echec);
    }

    // ----- Barre d'onglets -----
    function onglets() {
      var nav = el('div', 'bdg-onglets');
      [['badges', 'Badges'], ['entreprises', 'Entreprises & contrats'], ['historique', 'Historique'], ['reglages', 'Réglages']].forEach(function (o) {
        var b = el('button', 'bdg-onglet' + (S.onglet === o[0] ? ' actif' : ''), o[1]); b.type = 'button';
        b.onclick = function () { S.onglet = o[0]; dessiner(); }; nav.appendChild(b);
      });
      return nav;
    }
    function bouton(txt, fn, cls, titre) { var b = el('button', 'bdg-btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; if (titre) b.title = titre; b.onclick = fn; return b; }
    function champ(lib, input) { var l = el('label', 'bdg-champ'); l.appendChild(el('span', null, lib)); l.appendChild(input); return l; }
    function saisie(val, type, ph) { var i = el('input'); i.type = type || 'text'; i.value = val == null ? '' : val; if (ph) i.placeholder = ph; return i; }

    // ----- Onglet Badges -----
    function visibles() {
      var q = B.norm(S.q);
      return S.personnes.filter(function (p) {
        if (S.fe && B.norm(p.entreprise) !== B.norm(S.fe)) return false;
        return !q || B.norm([p.nom, p.prenom, p.fonction, p.entreprise, p.contrat].join(' ')).indexOf(q) >= 0;
      });
    }
    function nbSel() { return Object.keys(S.sel).filter(function (k) { return S.sel[k]; }).length; }
    function vueBadges() {
      var v = el('div'), liste = visibles(), tete = el('div', 'bdg-barre');
      var rech = saisie(S.q, 'search', 'Rechercher une personne, une fonction…'); rech.className = 'bdg-rech';
      rech.oninput = function () { S.q = rech.value; var pos = rech.selectionStart; dessiner(); var n = zone.querySelector('.bdg-rech'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
      tete.appendChild(rech);
      var sel = el('select', 'bdg-filtre'); sel.appendChild(new Option('Toutes les entreprises', ''));
      var noms = {}; S.personnes.forEach(function (p) { if (p.entreprise) noms[p.entreprise] = 1; });
      Object.keys(noms).sort().forEach(function (n) { sel.appendChild(new Option(n, n)); }); sel.value = S.fe; sel.onchange = function () { S.fe = sel.value; dessiner(); };
      tete.appendChild(sel);
      if (!S.lecture) { tete.appendChild(bouton('+ Ajouter', function () { editer(null); }, 'prim')); tete.appendChild(bouton('Importer…', importer, '', 'Coller depuis Excel ou charger un fichier CSV')); }
      if (opts.actualiser) tete.appendChild(bouton('↻ Actualiser les sources', function () { dire('Lecture des sources…'); recharger().then(function () { dire('Sources relues'); }); }));
      v.appendChild(tete);
      var act = el('div', 'bdg-barre');
      act.appendChild(bouton('Tout sélectionner', function () { liste.forEach(function (p) { S.sel[p.id] = true; }); dessiner(); }));
      act.appendChild(bouton('Non imprimés', function () { S.sel = {}; liste.forEach(function (p) { if (!numeroDe(p)) S.sel[p.id] = true; }); dessiner(); }, '', 'Sélectionne les personnes sans badge cette année'));
      act.appendChild(bouton('Rien', function () { S.sel = {}; dessiner(); }));
      var n = nbSel(), imp = bouton('🖨 Aperçu et impression (' + n + ')', function () { apercu(S.personnes.filter(function (p) { return S.sel[p.id]; })); }, 'prim'); imp.disabled = !n;
      if (!S.lecture) act.appendChild(imp); else act.appendChild(el('span', 'bdg-note', 'Lecture seule : l\'impression demande le niveau 2 du module Badges.'));
      act.appendChild(el('span', 'bdg-note', liste.length + ' personne(s) affichée(s) · ' + S.personnes.length + ' au total'));
      v.appendChild(act);
      if (S.avert && S.avert.length) { var a = el('div', 'bdg-avert'); S.avert.forEach(function (t) { a.appendChild(el('div', null, '⚠ ' + t)); }); v.appendChild(a); }
      if (!S.personnes.length) {
        var vide = el('div', 'bdg-vide'); vide.appendChild(el('p', null, 'Aucune personne pour l\'instant.'));
        vide.appendChild(el('p', 'bdg-note', opts.actualiser ? 'Les personnes viennent des Enquêtes administratives. Vérifiez la source dans « Réglages », ou ajoutez-en à la main.' : 'Ajoutez une personne, ou importez un fichier Excel / CSV (colonnes : Nom, Prénom, Fonction, Entreprise, Contrat).'));
        v.appendChild(vide); return v;
      }
      var t = el('table', 'bdg-table'), th = el('tr');
      ['', 'Nom', 'Prénom', 'Fonction', 'Entreprise', 'Contrat', 'Badge ' + annee, ''].forEach(function (x) { th.appendChild(el('th', null, x)); });
      t.appendChild(el('thead')).appendChild(th);
      var tb = el('tbody');
      liste.slice(0, 600).forEach(function (p) {
        var tr = el('tr', S.sel[p.id] ? 'sel' : ''), c = el('td'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!S.sel[p.id];
        cb.onchange = function () { S.sel[p.id] = cb.checked; dessiner(); }; c.appendChild(cb); tr.appendChild(c);
        var nom = el('td', 'fort', p.nom); if (p.verifier) { var w = el('span', 'bdg-pastille', '⚠'); w.title = 'Séparation nom / prénom à vérifier'; nom.appendChild(w); } tr.appendChild(nom);
        tr.appendChild(el('td', null, p.prenom)); tr.appendChild(el('td', null, p.fonction || '—')); tr.appendChild(el('td', null, p.entreprise || '—')); var ec = entrepriseDe(p.entreprise), manque = !p.contrat && ec && (ec.contrats || []).length > 1; tr.appendChild(el('td', 'bdg-petit' + (manque ? ' bdg-alerte' : ''), p.contrat || (manque ? 'à choisir' : '—')));
        var h = numeroDe(p), nb = el('td', h ? 'bdg-ok' : 'bdg-note', h ? ('N° ' + String(h.n)) : 'à imprimer'); tr.appendChild(nb);
        var ac = el('td'); if (!S.lecture) ac.appendChild(bouton('Modifier', function () { editer(p); }, 'mini')); tr.appendChild(ac);
        tb.appendChild(tr);
      });
      t.appendChild(tb); v.appendChild(t);
      if (liste.length > 600) v.appendChild(el('p', 'bdg-note', 'Les 600 premières lignes sont affichées : affinez la recherche.'));
      return v;
    }

    // ----- Fenêtres -----
    function fenetre(titre, corps, boutons) {
      var d = el('dialog', 'bdg-dlg'), f = el('form'); f.method = 'dialog';
      f.appendChild(el('h3', null, titre)); f.appendChild(corps);
      var bas = el('div', 'bdg-bas'); boutons.forEach(function (b) { bas.appendChild(b); }); f.appendChild(bas); d.appendChild(f);
      d.addEventListener('close', function () { d.remove(); }); document.body.appendChild(d);
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
      return d;
    }
    function fermer(d) { if (d.close) d.close(); else d.remove(); }
    function reduirePhoto(fichier, fin) {
      var r = new FileReader();
      r.onload = function () {
        var im = new Image();
        im.onload = function () {
          var max = 260, k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
          cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          fin(cv.toDataURL('image/jpeg', 0.82));
        };
        im.onerror = function () { dire('Image illisible', true); }; im.src = r.result;
      };
      r.readAsDataURL(fichier);
    }
    function editer(p) {
      var neuf = !p, x = p ? Object.assign({}, p) : { id: id(), structure: '', entreprise: S.fe || '', contrat: '' };
      var corps = el('div', 'bdg-grille'), I = {};
      [['nom', 'Nom'], ['prenom', 'Prénom'], ['fonction', 'Fonction']].forEach(function (c) { I[c[0]] = saisie(x[c[0]]); corps.appendChild(champ(c[1], I[c[0]])); });
      I.entreprise = saisie(x.entreprise); I.entreprise.setAttribute('list', 'bdg-dl-ent'); corps.appendChild(champ('Entreprise', I.entreprise));
      var dl = el('datalist'); dl.id = 'bdg-dl-ent'; S.entreprises.forEach(function (e) { dl.appendChild(new Option(e.nom)); }); corps.appendChild(dl);
      I.contrat = saisie(x.contrat); I.contrat.setAttribute('list', 'bdg-dl-ctr'); corps.appendChild(champ('N° de contrat', I.contrat));
      var dc = el('datalist'); dc.id = 'bdg-dl-ctr'; corps.appendChild(dc);
      function listeContrats() { vider(dc); var e = entrepriseDe(I.entreprise.value); if (e) (e.contrats || []).forEach(function (c) { var o = new Option(c.numero); o.label = c.numero + (c.intitule ? ' — ' + c.intitule : ''); dc.appendChild(o); }); if (e && (e.contrats || []).length === 1 && !I.contrat.value) I.contrat.value = e.contrats[0].numero; }
      I.entreprise.oninput = listeContrats; I.entreprise.onchange = listeContrats; listeContrats();
      I.structure = saisie(x.structure, 'text', S.cfg.structure); corps.appendChild(champ('Structure (vide = ' + S.cfg.structure + ')', I.structure));
      I.nomAr = saisie(x.nomAr); I.nomAr.dir = 'rtl'; I.prenomAr = saisie(x.prenomAr); I.prenomAr.dir = 'rtl';
      corps.appendChild(champ('Nom en arabe (facultatif)', I.nomAr)); corps.appendChild(champ('Prénom en arabe (facultatif)', I.prenomAr));
      var ph = el('div', 'bdg-photo-ed'), vue = el('img'); vue.alt = ''; if (x.photo) vue.src = x.photo; else vue.hidden = true;
      var fi = el('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.onchange = function () { if (fi.files[0]) reduirePhoto(fi.files[0], function (u) { x.photo = u; vue.src = u; vue.hidden = false; }); };
      ph.appendChild(vue); ph.appendChild(champ('Photo (facultatif)', fi)); ph.appendChild(bouton('Retirer la photo', function () { x.photo = ''; vue.hidden = true; }, 'mini')); corps.appendChild(ph);
      var d, ok = bouton('Enregistrer', function () {
        ['nom', 'prenom', 'fonction', 'entreprise', 'contrat', 'structure', 'nomAr', 'prenomAr'].forEach(function (k) { x[k] = B.vide(I[k].value); });
        if (!x.nom && !x.prenom) { dire('Indiquez au moins un nom.', true); return; }
        x.verifier = false;
        var liste = S.personnes.slice(); if (neuf) liste.push(x); else liste = liste.map(function (q) { return q.id === x.id ? x : q; });
        adapter.ecrirePersonnes(liste, x).then(function () { dire('Enregistré'); fermer(d); return recharger(); }).catch(echec);
      }, 'prim');
      var bs = [bouton('Annuler', function () { fermer(d); })];
      if (!neuf) bs.push(bouton('Supprimer', function () { if (!confirm('Supprimer cette personne de la liste ? L\'historique est conservé.')) return; adapter.ecrirePersonnes(S.personnes.filter(function (q) { return q.id !== x.id; }), x, true).then(function () { fermer(d); return recharger(); }).catch(echec); }, 'danger'));
      bs.push(ok); d = fenetre(neuf ? 'Nouvelle personne' : 'Modifier', corps, bs);
    }
    function importer() {
      var corps = el('div'), ta = el('textarea'); ta.rows = 9; ta.placeholder = 'Collez ici les lignes copiées depuis Excel (Nom, Prénom, Fonction, Entreprise, Contrat), ou un onglet « Enquêtes administratives » entier.';
      var fi = el('input'); fi.type = 'file'; fi.accept = '.csv,.txt,.tsv'; fi.onchange = function () { if (fi.files[0]) { var r = new FileReader(); r.onload = function () { ta.value = r.result; }; r.readAsText(fi.files[0], 'utf-8'); } };
      var ent = saisie('', 'text', 'Entreprise (si absente du tableau)'), ctr = saisie('', 'text', 'N° de contrat (si absent du tableau)');
      corps.appendChild(ta); corps.appendChild(champ('ou charger un fichier CSV', fi)); corps.appendChild(champ('Entreprise par défaut', ent)); corps.appendChild(champ('Contrat par défaut', ctr));
      corps.appendChild(el('p', 'bdg-note', 'Les personnes déjà présentes (même nom, prénom et entreprise) sont ignorées : pas de doublon.'));
      var d, ok = bouton('Importer', function () {
        var r = B.personnesDepuisTableau(B.lireCsv(ta.value), { entreprise: B.vide(ent.value), contrat: B.vide(ctr.value) });
        var connus = {}; S.personnes.forEach(function (p) { connus[B.cle(p)] = 1; });
        var neufs = r.personnes.filter(function (p) { var k = B.cle(p); if (connus[k]) return false; connus[k] = 1; return true; }).map(function (p) { p.id = id(); return p; });
        if (!neufs.length) { dire('Rien à ajouter (tout est déjà présent ou le tableau est vide).', true); return; }
        var nouvEnt = S.entreprises.slice(), vus = {}; nouvEnt.forEach(function (e) { vus[B.norm(e.nom)] = e; });
        neufs.forEach(function (p) { if (p.entreprise && !vus[B.norm(p.entreprise)]) { var e = { nom: p.entreprise, contrats: p.contrat ? [{ numero: p.contrat, intitule: '' }] : [] }; vus[B.norm(p.entreprise)] = e; nouvEnt.push(e); } else if (p.entreprise && p.contrat) { var e2 = vus[B.norm(p.entreprise)]; e2.contrats = e2.contrats || []; if (!e2.contrats.some(function (c) { return c.numero === p.contrat; })) e2.contrats.push({ numero: p.contrat, intitule: '' }); } });
        adapter.ecrirePersonnes(S.personnes.concat(neufs), neufs).then(function () { return adapter.ecrireEntreprises(nouvEnt); }).then(function () { dire(neufs.length + ' personne(s) ajoutée(s)'); fermer(d); return recharger(); }).catch(echec);
      }, 'prim');
      d = fenetre('Importer des personnes', corps, [bouton('Annuler', function () { fermer(d); }), ok]);
    }

    // ----- Onglet Entreprises -----
    function vueEntreprises() {
      var v = el('div'), bar = el('div', 'bdg-barre');
      if (!S.lecture) bar.appendChild(bouton('+ Entreprise', function () { editerEntreprise(null); }, 'prim'));
      if (opts.actualiser) bar.appendChild(bouton('↻ Actualiser les sources', function () { recharger().then(function () { dire('Sources relues'); }); }));
      bar.appendChild(el('span', 'bdg-note', opts.actualiser ? 'Entreprises et contrats lus dans le suivi CPM (attribution et n° de contrat) ; vous pouvez en ajouter.' : 'Un contrat par ligne ; un badge reprend le contrat choisi pour la personne.'));
      v.appendChild(bar);
      var t = el('table', 'bdg-table'), th = el('tr');
      ['Entreprise', 'Contrat(s)', 'Personnes', ''].forEach(function (x) { th.appendChild(el('th', null, x)); }); t.appendChild(el('thead')).appendChild(th);
      var tb = el('tbody');
      S.entreprises.slice().sort(function (a, b) { return a.nom.localeCompare(b.nom); }).forEach(function (e) {
        var tr = el('tr'), n = S.personnes.filter(function (p) { return B.norm(p.entreprise) === B.norm(e.nom); }).length;
        tr.appendChild(el('td', 'fort', e.nom));
        var c = el('td', 'bdg-petit'); (e.contrats || []).forEach(function (k) { c.appendChild(el('div', null, k.numero + (k.intitule ? ' — ' + k.intitule : ''))); }); if (!(e.contrats || []).length) c.textContent = '—'; tr.appendChild(c);
        tr.appendChild(el('td', null, String(n)));
        var a = el('td'); if (!S.lecture) a.appendChild(bouton('Modifier', function () { editerEntreprise(e); }, 'mini')); tr.appendChild(a); tb.appendChild(tr);
      });
      t.appendChild(tb); v.appendChild(t); if (!S.entreprises.length) v.appendChild(el('p', 'bdg-note', 'Aucune entreprise pour l\'instant.'));
      return v;
    }
    function editerEntreprise(e) {
      var neuf = !e, x = e ? { nom: e.nom, contrats: (e.contrats || []).slice() } : { nom: '', contrats: [] };
      var corps = el('div'), nom = saisie(x.nom), ta = el('textarea'); ta.rows = 5; ta.value = x.contrats.map(function (c) { return c.numero + (c.intitule ? ' | ' + c.intitule : ''); }).join('\n');
      corps.appendChild(champ('Nom (tel qu\'il doit figurer sur le badge)', nom)); corps.appendChild(champ('Contrats — un par ligne : numéro | intitulé (facultatif)', ta));
      var rat = el('select'); rat.appendChild(new Option('— non —', ''));
      if (e) S.entreprises.filter(function (q) { return q.nom !== e.nom; }).sort(function (a, b) { return a.nom.localeCompare(b.nom); }).forEach(function (q) { rat.appendChild(new Option(q.nom + ((q.contrats || []).length ? '  (' + q.contrats.length + ' contrat' + (q.contrats.length > 1 ? 's' : '') + ')' : ''), q.nom)); });
      if (e) { corps.appendChild(champ('C\'est la même entreprise que… (rattacher : ses personnes passent sous l\'autre nom)', rat)); }
      var d, ok = bouton('Enregistrer', function () {
        var n = B.vide(nom.value); if (!n) { dire('Indiquez le nom de l\'entreprise.', true); return; }
        if (e && rat.value) {
          var vers = rat.value, reste = S.entreprises.filter(function (q) { return q.nom !== e.nom; });
          if (!confirm('Rattacher « ' + e.nom + ' » à « ' + vers + ' » ? Ses personnes passeront sous « ' + vers + ' ».')) return;
          var deplacees = adapter.nom === 'portail' ? null : S.personnes.map(function (p) { if (B.norm(p.entreprise) === B.norm(e.nom)) p.entreprise = vers; return p; });
          Promise.resolve(deplacees ? adapter.ecrirePersonnes(deplacees, null) : null).then(function () { return adapter.ecrireEntreprises(reste, { alias: { de: e.nom, vers: vers } }); }).then(function () { fermer(d); dire('Rattaché'); return recharger(); }).catch(echec);
          return;
        }
        var contrats = ta.value.split('\n').map(function (l) { var p = l.split('|'); return { numero: B.vide(p[0]), intitule: B.vide(p.slice(1).join('|')) }; }).filter(function (c) { return c.numero; });
        var liste = S.entreprises.filter(function (q) { return !e || q.nom !== e.nom; }); liste.push({ nom: n, contrats: contrats });
        var maj = (e && e.nom !== n) ? S.personnes.map(function (p) { if (B.norm(p.entreprise) === B.norm(e.nom)) p.entreprise = n; return p; }) : null;
        Promise.resolve(maj ? adapter.ecrirePersonnes(maj, null) : null).then(function () { return adapter.ecrireEntreprises(liste, { ancien: e && e.nom, nom: n }); }).then(function () { fermer(d); dire('Enregistré'); return recharger(); }).catch(echec);
      }, 'prim');
      var bs = [bouton('Annuler', function () { fermer(d); })];
      if (!neuf) bs.push(bouton('Supprimer', function () { if (!confirm('Supprimer cette entreprise de la liste ? Les personnes et l\'historique sont conservés.')) return; adapter.ecrireEntreprises(S.entreprises.filter(function (q) { return q.nom !== e.nom; }), { ancien: e.nom, supprimer: true }).then(function () { fermer(d); return recharger(); }).catch(echec); }, 'danger'));
      bs.push(ok); d = fenetre(neuf ? 'Nouvelle entreprise' : 'Modifier l\'entreprise', corps, bs);
    }

    // ----- Onglet Historique -----
    function vueHistorique() {
      var v = el('div'), bar = el('div', 'bdg-barre');
      var rech = saisie(S.qh || '', 'search', 'Rechercher dans l\'historique…'); rech.className = 'bdg-rech';
      rech.oninput = function () { S.qh = rech.value; var pos = rech.selectionStart; dessiner(); var n = zone.querySelector('.bdg-rech'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
      bar.appendChild(rech);
      bar.appendChild(bouton('⬇ Exporter (Excel / CSV)', function () { telecharger('historique-badges-' + aujourdhui() + '.csv', B.csvHistorique(S.hist), 'text/csv;charset=utf-8'); }));
      if (adapter.sauvegarde) {
        bar.appendChild(bouton('Sauvegarder tout', function () { telecharger('sauvegarde-badges-' + aujourdhui() + '.json', JSON.stringify(adapter.sauvegarde()), 'application/json'); }, '', 'Personnes, entreprises et historique dans un fichier'));
        var f = el('input'); f.type = 'file'; f.accept = '.json'; f.hidden = true;
        f.onchange = function () { if (!f.files[0]) return; var r = new FileReader(); r.onload = function () { try { var o = JSON.parse(r.result); if (!confirm('Remplacer toutes les données de ce navigateur par la sauvegarde ?')) return; adapter.restaurer(o).then(recharger).then(function () { dire('Sauvegarde restaurée'); }).catch(echec); } catch (e) { dire('Fichier de sauvegarde illisible', true); } }; r.readAsText(f.files[0]); };
        bar.appendChild(f); bar.appendChild(bouton('Restaurer…', function () { f.click(); }));
      }
      var n = (S.selh || []).length, re = S.lecture ? el('span') : bouton('🖨 Réimprimer la sélection (' + n + ')', function () { reimprimer(); }, 'prim'); re.disabled = !n; if (!S.lecture) bar.appendChild(re);
      v.appendChild(bar);
      var q = B.norm(S.qh || ''), liste = S.hist.slice().reverse().filter(function (h) { return !q || B.norm([h.ref, h.nom, h.prenom, h.entreprise, h.contrat, h.date, h.imprime_par].join(' ')).indexOf(q) >= 0; });
      var t = el('table', 'bdg-table'), th = el('tr');
      ['', 'Date', 'Badge', 'Nom', 'Prénom', 'Fonction', 'Entreprise', 'Contrat', 'Par'].forEach(function (x) { th.appendChild(el('th', null, x)); }); t.appendChild(el('thead')).appendChild(th);
      var tb = el('tbody'); S.selh = S.selh || [];
      liste.slice(0, 500).forEach(function (h) {
        var tr = el('tr'), c = el('td'), cb = el('input'); cb.type = 'checkbox'; var cle = h.ref + '|' + h.date + '|' + B.cle(h); cb.checked = S.selh.indexOf(cle) >= 0;
        cb.onchange = function () { var i = S.selh.indexOf(cle); if (cb.checked && i < 0) S.selh.push(cle); if (!cb.checked && i >= 0) S.selh.splice(i, 1); dessiner(); };
        c.appendChild(cb); tr.appendChild(c);
        [h.date, 'N° ' + h.n + '/' + h.annee, h.nom, h.prenom, h.fonction, h.entreprise, h.contrat, h.imprime_par].forEach(function (x, i) { tr.appendChild(el('td', i === 1 ? 'fort' : (i === 6 ? 'bdg-petit' : ''), x || '—')); });
        tb.appendChild(tr);
      });
      t.appendChild(tb); v.appendChild(t);
      v.appendChild(el('p', 'bdg-note', S.hist.length ? (S.hist.length + ' impression(s) enregistrée(s) — la plus récente en haut.') : 'Rien n\'a encore été imprimé.'));
      return v;
    }
    function reimprimer() {
      var cles = {}; (S.selh || []).forEach(function (c) { cles[c] = 1; });
      var items = [];
      S.hist.forEach(function (h) {
        if (!cles[h.ref + '|' + h.date + '|' + B.cle(h)]) return;
        var p = S.personnes.filter(function (q) { return B.cle(q) === (h.cle || B.cle(h)); })[0] || { nom: h.nom, prenom: h.prenom, fonction: h.fonction, entreprise: h.entreprise, contrat: h.contrat, structure: h.structure };
        if (!items.some(function (i) { return B.cle(i) === B.cle(p) && i.annee === h.annee; })) items.push(Object.assign({}, p, { n: h.n, annee: h.annee }));
      });
      apercu(items);
    }
    function telecharger(nom, texte, type) {
      var a = document.createElement('a'), u = URL.createObjectURL(new Blob([texte], { type: type })); a.href = u; a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
    }

    // ----- Onglet Réglages -----
    var CHAMPS = [
      ['base', 'Nom de la base (pied du badge)', 'text'], ['structure', 'Structure par défaut', 'text'], ['titre', 'Titre du badge', 'text'], ['formatNumero', 'Format du numéro', 'text'],
      ['couleur', 'Couleur des traits', 'color'], ['chiffres', 'Chiffres du numéro (2 → 01)', 'number'], ['numeroDepart', 'Premier numéro de l\'année', 'number']
    ];
    function vueReglages() {
      var v = el('div'), c = S.cfg, I = {}, g = el('div', 'bdg-grille');
      CHAMPS.forEach(function (f) { I[f[0]] = saisie(c[f[0]], f[2]); g.appendChild(champ(f[1], I[f[0]])); });
      var dims = [['carte.largeur', 'Largeur du badge (mm)'], ['carte.hauteur', 'Hauteur du badge (mm)'], ['grille.pasX', 'Pas horizontal (mm)'], ['grille.pasY', 'Pas vertical (mm)'],
        ['decalage.x', 'Calage recto — horizontal (mm)'], ['decalage.y', 'Calage recto — vertical (mm)'], ['verso.decalage.x', 'Calage verso — horizontal (mm)'], ['verso.decalage.y', 'Calage verso — vertical (mm)']];
      function chemin(o, p) { return p.split('.').reduce(function (a, k) { return a && a[k]; }, o); }
      dims.forEach(function (d) { var i = saisie(chemin(c, d[0]), 'number'); i.step = '0.1'; I[d[0]] = i; g.appendChild(champ(d[1], i)); });
      I.pfam = saisie(c.police.famille); g.appendChild(champ('Police (installée sur le poste qui imprime)', I.pfam));
      I.ptai = saisie(c.police.taille, 'number'); I.ptai.step = '0.5'; g.appendChild(champ('Taille de la police (pt)', I.ptai));
      var mi = el('select'); [['colonnes', 'Retournement par le bord court (colonnes inversées)'], ['lignes', 'Retournement par le bord long (lignes inversées)'], ['aucun', 'Pas d\'inversion']].forEach(function (o) { mi.appendChild(new Option(o[1], o[0])); }); mi.value = c.verso.miroir; g.appendChild(champ('Recto-verso', mi));
      function coche(lib, val) { var i = el('input'); i.type = 'checkbox'; i.checked = !!val; var l = el('label', 'bdg-coche'); l.appendChild(i); l.appendChild(document.createTextNode(' ' + lib)); g.appendChild(l); return i; }
      var qr = coche('QR code de vérification (verso)', c.qr.actif), ph = coche('Emplacement photo (recto)', c.photo.actif), ar = coche('Nom et prénom en arabe (recto)', c.arabe.actif);
      v.appendChild(g);
      var bar = el('div', 'bdg-barre');
      function lireForm() {
        var o = {};
        CHAMPS.forEach(function (f) { o[f[0]] = f[2] === 'number' ? Number(I[f[0]].value) : I[f[0]].value; });
        function poser(p, val) { var k = p.split('.'), t = o; k.slice(0, -1).forEach(function (x) { t[x] = t[x] || {}; t = t[x]; }); t[k[k.length - 1]] = Number(val); }
        dims.forEach(function (d) { poser(d[0], I[d[0]].value || 0); });
        o.police = { famille: I.pfam.value || 'Berlin Sans FB', taille: Number(I.ptai.value) || 11 }; o.verso = Object.assign({ miroir: mi.value }, o.verso); o.verso.miroir = mi.value; o.qr = { actif: qr.checked }; o.photo = { actif: ph.checked }; o.arabe = { actif: ar.checked };
        return o;
      }
      bar.appendChild(bouton('Enregistrer les réglages', function () { var o = lireForm(); ecrire(cleReglages, o); S.cfg = B.config(Object.assign({}, window.BADGES_CONFIG || {}, o)); dire('Réglages enregistrés (dans ce navigateur)'); dessiner(); }, 'prim'));
      bar.appendChild(bouton('Revenir au fichier config.js', function () { try { localStorage.removeItem(cleReglages); } catch (e) {} S.cfg = B.config(window.BADGES_CONFIG || {}); dessiner(); dire('Réglages du fichier config.js rétablis'); }));
      bar.appendChild(bouton('⬇ Télécharger config.js', function () { telecharger('config.js', '/* Réglages des badges prestataires */\nwindow.BADGES_CONFIG = ' + JSON.stringify(lireForm(), null, 2) + ';\n', 'text/javascript'); }, '', 'À remplacer dans le dossier de l\'application'));
      bar.appendChild(bouton('🖨 Page de calage', function () { imprimerHtml(B.calibrageHtml(S.cfg, rendu())); }, '', 'Imprimez-la en recto-verso et superposez à la lumière pour régler les décalages'));
      v.appendChild(bar);
      v.appendChild(el('p', 'bdg-note', 'Calage : imprimez la page de calage en recto-verso à 100 % (sans « ajuster à la page »), tenez-la à la lumière : les cadres du recto et du verso doivent se superposer. Corrigez sinon les décalages ci-dessus (en mm). Si les cadres sont inversés, changez le mode de retournement.'));
      return v;
    }

    // ----- Aperçu et impression -----
    function rendu(extra) {
      return Object.assign({ logoUrl: opts.logoUrl || S.cfg.logo, cadrePhoto: false, qr: function (t) { try { var q = window.qrcode(0, 'M'); window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8']; q.addData(t); q.make(); return q.createSvgTag({ cellSize: 1, margin: 0, scalable: true }); } catch (e) { return ''; } } }, extra || {});
    }
    function imprimerHtml(html) {
      var z = document.getElementById('bdg-zone-impression'); if (z) z.remove();
      z = document.createElement('div'); z.id = 'bdg-zone-impression'; var st = document.createElement('style'); st.textContent = B.css(S.cfg); z.appendChild(st);
      var c = document.createElement('div'); c.innerHTML = html; z.appendChild(c); document.body.appendChild(z);
      document.body.classList.add('bdg-imp');
      var fin = function () { document.body.classList.remove('bdg-imp'); z.remove(); window.removeEventListener('afterprint', fin); };
      window.addEventListener('afterprint', fin); setTimeout(function () { window.print(); }, 50);
    }
    function apercu(personnes) {
      if (!personnes.length) return;
      var items = personnes.map(function (p) { return Object.assign({}, p); });
      var etat = { depart: 1, arabe: !!S.cfg.arabe.actif, recto: false };
      var corps = el('div'), zoneApercu = el('div', 'bdg-apercu'), bar = el('div', 'bdg-barre');
      var dep = saisie('1', 'number'); dep.min = '1'; dep.max = String(B.casesParFeuille(S.cfg)); dep.style.width = '70px';
      bar.appendChild(champ('Première case libre de la feuille', dep));
      var ca = el('label', 'bdg-coche'), ci = el('input'); ci.type = 'checkbox'; ci.checked = etat.arabe; ca.appendChild(ci); ca.appendChild(document.createTextNode(' Nom en arabe')); bar.appendChild(ca);
      var cr = el('label', 'bdg-coche'), cri = el('input'); cri.type = 'checkbox'; cr.appendChild(cri); cr.appendChild(document.createTextNode(' Recto seul')); bar.appendChild(cr);
      corps.appendChild(bar);
      var nbl = el('p', 'bdg-note'); corps.appendChild(nbl); corps.appendChild(zoneApercu);
      function calculer() {
        var cfg = B.config(Object.assign({}, S.cfg, { arabe: { actif: etat.arabe } }));
        var prov = B.attribuer(S.hist, items, annee, cfg);
        return { cfg: cfg, items: prov.items, nouveaux: prov.nouveaux.length };
      }
      function dessinerApercu() {
        var r = calculer(), f = B.planifier(r.items, r.cfg, etat.depart).length;
        var sans = r.items.filter(function (x) { return !x.contrat; }).length; nbl.textContent = (sans ? '⚠ ' + sans + ' badge(s) sans n° de contrat (verso incomplet) — ' : '') + r.items.length + ' badge(s), dont ' + r.nouveaux + ' nouveau(x) numéro(s) — ' + f + ' feuille(s) recto-verso. Numéros définitifs à l\'impression.';
        vider(zoneApercu); var st = el('style'); st.textContent = B.css(r.cfg) + '.bdg-apercu .bdg-feuille{zoom:.62}'; zoneApercu.appendChild(st);
        var c = el('div'); c.innerHTML = B.feuillesHtml(r.items, r.cfg, rendu({ caseDepart: etat.depart, recto: etat.recto, cadrePhoto: false })); zoneApercu.appendChild(c);
      }
      dep.oninput = function () { etat.depart = Math.max(1, Math.min(B.casesParFeuille(S.cfg), Number(dep.value) || 1)); dessinerApercu(); };
      ci.onchange = function () { etat.arabe = ci.checked; dessinerApercu(); }; cri.onchange = function () { etat.recto = cri.checked; dessinerApercu(); };
      var d, go = bouton('🖨 Imprimer', function () {
        var r = calculer(); go.disabled = true;
        adapter.numeroter(items, annee, r.cfg, S.util).then(function (res) {
          S.hist = res.historique || S.hist; var finals = res.items.map(function (x, i) { return Object.assign({}, items[i], x); });
          imprimerHtml(B.feuillesHtml(finals, r.cfg, rendu({ caseDepart: etat.depart, recto: etat.recto })));
          dire('Numéros attribués et enregistrés dans l\'historique'); fermer(d); return recharger();
        }).catch(function (e) { go.disabled = false; echec(e); });
      }, 'prim');
      d = fenetre('Aperçu avant impression (A4 paysage, recto-verso)', corps, [bouton('Fermer', function () { fermer(d); }), go]); d.classList.add('bdg-large');
      dessinerApercu();
    }

    // ----- Dessin général -----
    function dessiner() {
      vider(zone); zone.appendChild(onglets());
      var v = S.onglet === 'entreprises' ? vueEntreprises() : S.onglet === 'historique' ? vueHistorique() : S.onglet === 'reglages' ? vueReglages() : vueBadges();
      zone.appendChild(v);
      if (S.info) zone.appendChild(el('p', 'bdg-note', S.info));
    }
    vider(racine); racine.appendChild(msg); racine.appendChild(zone);
    zone.appendChild(el('p', 'bdg-note', 'Chargement…'));
    recharger();
    return { recharger: recharger, etat: S };
  }

  var CSS = '.bdg-app{font-family:Inter,Calibri,Arial,sans-serif;color:var(--text-dark,#1c1c1c);font-size:14px}' +
    '.bdg-app *{box-sizing:border-box}.bdg-onglets{display:flex;gap:4px;flex-wrap:wrap;border-bottom:2px solid var(--border,#e5e7eb);margin-bottom:14px}' +
    '.bdg-onglet{background:none;border:0;border-bottom:3px solid transparent;margin-bottom:-2px;padding:9px 14px;font:inherit;font-weight:700;color:var(--text-muted,#6b7280);cursor:pointer}' +
    '.bdg-onglet.actif{color:var(--orange-main,#E85D04);border-bottom-color:var(--orange-main,#E85D04)}' +
    '.bdg-barre{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px}' +
    '.bdg-app .bdg-rech{width:260px;max-width:100%}.bdg-app .bdg-filtre{width:auto;max-width:100%}.bdg-app input,.bdg-app select,.bdg-app textarea,.bdg-dlg input,.bdg-dlg select,.bdg-dlg textarea{font:inherit;padding:8px 10px;border:1.5px solid var(--border,#d1d5db);border-radius:9px;background:var(--surface,#fff);color:inherit;max-width:100%}' +
    '.bdg-app input[type=checkbox],.bdg-dlg input[type=checkbox]{padding:0;width:auto}.bdg-app textarea,.bdg-dlg textarea{width:100%}' +
    '.bdg-btn{font:inherit;font-size:13px;font-weight:700;padding:8px 13px;border-radius:9px;border:1.5px solid var(--border,#d1d5db);background:var(--surface,#fff);color:inherit;cursor:pointer}' +
    '.bdg-btn:hover{border-color:var(--orange-main,#E85D04)}.bdg-btn[disabled]{opacity:.45;cursor:not-allowed}' +
    '.bdg-btn.prim{background:var(--orange-main,#E85D04);border-color:var(--orange-main,#E85D04);color:#fff}.bdg-btn.danger{color:#b91c1c;border-color:#fca5a5}.bdg-btn.mini{padding:4px 9px;font-size:12px}' +
    '.bdg-alerte{color:#b45309;font-weight:800}.bdg-note{font-size:12.5px;color:var(--text-muted,#6b7280);margin:6px 0}.bdg-ok{font-weight:800;color:#047857}.bdg-petit{font-size:12px}' +
    '.bdg-table{width:100%;border-collapse:collapse;background:var(--surface,#fff);border-radius:10px;overflow:hidden;font-size:13px}' +
    '.bdg-table th,.bdg-table td{padding:7px 10px;border-bottom:1px solid var(--border,#e5e7eb);text-align:start;vertical-align:top;overflow-wrap:anywhere}' +
    '.bdg-table th{font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#6b7280);background:var(--surface-2,#f8fafc)}.bdg-table .fort{font-weight:700}' +
    '.bdg-table tr.sel td{background:var(--orange-pale,#ffe8d6)}.bdg-pastille{margin-inline-start:6px;color:#b45309}' +
    '.bdg-msg{min-height:0;margin-bottom:8px;font-weight:700;color:#047857}.bdg-msg.bdg-err{color:#b91c1c}.bdg-vide{padding:30px;text-align:center;background:var(--surface,#fff);border-radius:12px}' +
    '.bdg-avert{background:#fef3c7;color:#92400e;border-radius:10px;padding:8px 12px;margin:0 0 10px;font-size:13px}' +
    '.bdg-champ{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:700;color:var(--text-muted,#6b7280)}.bdg-champ input,.bdg-champ select{width:100%;font-weight:400;color:var(--text-dark,#1c1c1c)}' +
    '.bdg-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:12px;align-items:end}.bdg-coche{font-size:13px;display:flex;align-items:center;gap:6px}' +
    '.bdg-dlg{border:0;border-radius:14px;padding:20px 22px;width:min(640px,94vw);box-shadow:0 12px 40px rgba(0,0,0,.35);background:var(--surface,#fff);color:var(--text-dark,#1c1c1c)}.bdg-dlg::backdrop{background:rgba(0,0,0,.45)}' +
    '.bdg-dlg h3{margin:0 0 12px}.bdg-bas{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}.bdg-dlg.bdg-large{width:min(1000px,96vw)}' +
    '.bdg-apercu{max-height:62vh;overflow:auto;background:#d9d9d9;padding:8px;border-radius:8px}.bdg-apercu .bdg-feuille{margin:0 auto 8px}' +
    '.bdg-photo-ed{display:flex;align-items:end;gap:10px;flex-wrap:wrap}.bdg-photo-ed img{width:56px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border,#d1d5db)}' +
    '#bdg-zone-impression{display:none}' +
    '@media print{body.bdg-imp>*:not(#bdg-zone-impression){display:none!important}body.bdg-imp #bdg-zone-impression{display:block!important}html:has(body.bdg-imp),body.bdg-imp{background:#fff!important;margin:0!important;padding:0!important;min-height:0!important;height:auto!important}body.bdg-imp .bdg-feuille{margin:0!important;box-shadow:none!important}}';
  (function () { var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); })();

  return { monter: monter, adaptateurLocal: adaptateurLocal };
})();
