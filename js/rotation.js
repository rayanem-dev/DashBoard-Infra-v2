/* Rotation : phrase d'accueil et formulaire « Où en êtes-vous ? » (partagés par le portail et le planning). */
(function () {
  var PRESETS = [[28, 28], [14, 14], [15, 15], [7, 7], [4, 4]];

  function frDate(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : ''; }
  function aujourdhui() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function s(n) { return n > 1 ? 's' : ''; }

  /** « Vous êtes au travail depuis le …, il vous reste N jours — début du repos le … » (le « Bonjour X » est le titre de la page). */
  function phrase(sit) {
    if (!sit) return '';
    if (sit.avant) return 'Votre rotation commence le ' + frDate(sit.debut) + '.';
    var etat = sit.statut === 'T' ? 'au travail' : 'en repos';
    var reste = sit.restants <= 1 ? 'c\'est le dernier jour' : 'il vous reste ' + sit.restants + ' jour' + s(sit.restants) + ' (aujourd\'hui compris)';
    var suite = sit.prochain ? ' — ' + (sit.prochain.statut === 'T' ? 'reprise du travail' : 'début du repos') + ' le ' + frDate(sit.prochain.date) : '';
    return 'Vous êtes ' + etat + ' depuis le ' + frDate(sit.depuis) + ' (jour ' + sit.jour + ' sur ' + sit.total + '), ' + reste + suite + '.';
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function champ(libelle, controle) { var w = el('div', 'champ'); w.appendChild(el('label', null, libelle)); w.appendChild(controle); return w; }

  /**
   * Ouvre le formulaire. options : { titre, email? (pour modifier quelqu'un d'autre), valeurs? { statut, depuis, jours_travail, jours_repos }, onOk() }
   */
  function ouvrir(options) {
    var v = options.valeurs || {};
    if (!v.jours_travail) { try { var m = JSON.parse(localStorage.getItem('infra_v2_derniere_rotation') || 'null'); if (m) v = Object.assign({}, m, v); } catch (e) {} }
    var dlg = el('dialog', 'dlg');
    var f = el('form'); f.method = 'dialog';
    f.appendChild(el('h2', null, options.titre || 'Où en êtes-vous ?'));
    f.appendChild(el('p', 'sous', 'Trois questions pour calculer automatiquement votre planning.'));

    var sStat = document.createElement('select');
    [['T', 'Je suis au travail'], ['R', 'Je suis en repos / congé']].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (o[0] === (v.statut || 'T')) op.selected = true; sStat.appendChild(op); });
    f.appendChild(champ('1. Actuellement…', sStat));

    var iDate = document.createElement('input'); iDate.type = 'date'; iDate.max = aujourdhui(); iDate.value = v.depuis || aujourdhui();
    f.appendChild(champ('2. Depuis quel jour ? (premier jour de la période en cours)', iDate));

    var sRot = document.createElement('select');
    PRESETS.forEach(function (p) { var op = el('option', null, p[0] + ' jours travail / ' + p[1] + ' jours repos'); op.value = p[0] + '/' + p[1]; sRot.appendChild(op); });
    var autre = el('option', null, 'Autre rotation…'); autre.value = 'autre'; sRot.appendChild(autre);
    var cle = (v.jours_travail || 28) + '/' + (v.jours_repos || 28);
    var connu = PRESETS.some(function (p) { return p[0] + '/' + p[1] === cle; });
    sRot.value = connu ? cle : 'autre';
    f.appendChild(champ('3. Votre rotation', sRot));

    var ligne = el('div', 'deux'); var jt = document.createElement('input'), jr = document.createElement('input');
    [jt, jr].forEach(function (i) { i.type = 'number'; i.min = 1; i.max = 90; });
    jt.value = v.jours_travail || 28; jr.value = v.jours_repos || 28;
    ligne.appendChild(champ('Jours de travail', jt)); ligne.appendChild(champ('Jours de repos', jr));
    ligne.hidden = connu; f.appendChild(ligne);
    sRot.addEventListener('change', function () {
      if (sRot.value === 'autre') { ligne.hidden = false; return; }
      ligne.hidden = true; var p = sRot.value.split('/'); jt.value = p[0]; jr.value = p[1];
    });

    var iRel = document.createElement('input'); iRel.type = 'number'; iRel.min = -365; iRel.max = 365; iRel.step = 1; iRel.value = v.reliquat == null ? 0 : v.reliquat;
    f.appendChild(champ('4. Au début de la rotation, combien avez-vous de reliquat ? (jours)', iRel));
    f.appendChild(el('p', 'aide', 'Jours de congé qui vous sont dus (+), ou jours pris en avance (−) à ce jour. Laissez 0 si vous n\'avez ni l\'un ni l\'autre : il sert à proposer des plannings qui tiennent compte de votre reliquat.'));

    var msg = el('div', 'msg'); msg.setAttribute('role', 'alert'); f.appendChild(msg);
    var boutons = el('div', 'boutons');
    var ann = el('button', 'btn-s', 'Annuler'); ann.type = 'button'; ann.addEventListener('click', function () { dlg.close(); });
    var ok = el('button', 'btn', 'Enregistrer'); ok.type = 'submit';
    if (!options.obligatoire) boutons.appendChild(ann); boutons.appendChild(ok); f.appendChild(boutons);

    f.addEventListener('submit', function (e) {
      e.preventDefault(); ok.disabled = true; msg.className = 'msg';
      var p = { statut: sStat.value, depuis: iDate.value, jours_travail: Number(jt.value), jours_repos: Number(jr.value), reliquat: iRel.value === '' ? 0 : Number(iRel.value) };
      if (options.email) p.email = options.email;
      Api.call('rotation_enregistrer', p).then(function () { try { localStorage.setItem('infra_v2_derniere_rotation', JSON.stringify({ statut: p.statut, jours_travail: p.jours_travail, jours_repos: p.jours_repos })); } catch (e) {} dlg.close(); if (options.onOk) options.onOk(); })
        .catch(function (err) { msg.textContent = err.message; msg.className = 'msg err'; ok.disabled = false; });
    });
    dlg.addEventListener('close', function () { dlg.remove(); });
    if (options.obligatoire) dlg.addEventListener('cancel', function (e) { e.preventDefault(); }); // Échap ne ferme pas
    dlg.appendChild(f); document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /** Les autres pages exigent une rotation ET un reliquat renseignés : sinon retour au portail, où ils sont demandés avant tout accès. */
  function exiger() {
    Api.call('situation').then(function (r) { if (r.acces && (!r.configuree || r.reliquat_renseigne === false)) location.replace('portail.html'); }).catch(function () {});
  }

  /**
   * Fenêtre « Votre reliquat » (obligatoire, valeur par défaut 0) pour ceux dont la rotation est déjà enregistrée mais qui n'ont pas encore indiqué leur reliquat.
   * options : { onOk() }
   */
  function reliquat(options) {
    var dlg = el('dialog', 'dlg'), f = el('form'); f.method = 'dialog';
    f.appendChild(el('h2', null, 'Votre reliquat de congé'));
    f.appendChild(el('p', 'sous', 'Une seule fois : combien de jours de congé vous sont dus (+) ou avez-vous pris en avance (−) ? Laissez 0 si vous n\'en avez pas.'));
    var i = document.createElement('input'); i.type = 'number'; i.min = -365; i.max = 365; i.step = 1; i.value = 0;
    f.appendChild(champ('Au début de la rotation, combien avez-vous de reliquat ? (jours)', i));
    f.appendChild(el('p', 'aide', 'Ex. : +14 si vous avez 14 jours de congé non pris ; −7 si vous avez pris 7 jours de congé en avance. Il sert à proposer des plannings qui tiennent compte de votre reliquat. Vous pourrez le modifier en changeant votre rotation.'));
    var msg = el('div', 'msg'); msg.setAttribute('role', 'alert'); f.appendChild(msg);
    var b = el('div', 'boutons'), ok = el('button', 'btn', 'Enregistrer'); ok.type = 'submit'; b.appendChild(ok); f.appendChild(b);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); ok.disabled = true; msg.className = 'msg';
      Api.call('reliquat_enregistrer', { reliquat: i.value === '' ? 0 : Number(i.value) }).then(function () { dlg.close(); if (options && options.onOk) options.onOk(); })
        .catch(function (err) { msg.textContent = err.message; msg.className = 'msg err'; ok.disabled = false; });
    });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); });
    dlg.addEventListener('close', function () { dlg.remove(); }); dlg.appendChild(f); document.body.appendChild(dlg);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  window.Rotation = { reliquat: reliquat, exiger: exiger, phrase: phrase, ouvrir: ouvrir, frDate: frDate, aujourdhui: aujourdhui };
})();
