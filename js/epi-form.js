/**
 * Formulaire des tailles de dotation EPI (haut, pantalon, pointure, veste / parka UK, remarque).
 * Partagé par la page « Dotation EPI » (epi.html) et par « Mon profil » (profil.html) : les deux écrivent dans le même fichier (onglet TaillesEPI de la passerelle).
 *   EpiForm.formulaire(tailles, table, surEnregistrer(valeurs) → Promise, { toast }) → élément DOM
 */
var EpiForm = (function () {
  var HAUTS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function formulaire(t, TABLE, surEnregistrer, opt) {
    t = t || {}; TABLE = TABLE || []; var toast = (opt && opt.toast) || function () {}, pref = (opt && opt.prefixe) || 'f';
    function ukDe(l) { var x = TABLE.filter(function (r) { return r.lettre === String(l || '').toUpperCase(); })[0]; return x ? x.uk : ''; }
    if (!document.getElementById('epf-css')) {
      var st = el('style'); st.id = 'epf-css';
      st.textContent = '.epf .grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}.epf .grille label{display:block;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px}' +
        '.epf input,.epf select,.epf textarea{width:100%;box-sizing:border-box;padding:8px 10px;border:1.5px solid var(--border);border-radius:9px;font:inherit;font-size:14px;background:var(--surface);color:var(--text-dark)}.epf .aide{font-size:11.5px;color:var(--text-muted);margin-top:3px}' +
        '.epf .large{grid-column:1/-1}.epf .coche{display:inline-flex;align-items:center;gap:8px;font-size:14px!important;text-transform:none!important;letter-spacing:0!important;color:var(--text-dark)!important}.epf .coche input{width:auto;padding:0;margin:0;flex:none}' +
        '.epf .petit{padding:3px 8px;font-size:12px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface);color:var(--text-dark);font-weight:700;cursor:pointer;margin-top:6px;width:auto}' +
        '.epf .btn-p{padding:9px 15px;border:0;border-radius:10px;background:linear-gradient(135deg,var(--orange-main),var(--orange-light));color:#fff;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;width:auto}.epf .btn-p:disabled{opacity:.5}';
      document.head.appendChild(st);
    }
    var f = el('div', 'epf'), g = el('div', 'grille'), champs = {};
    function champ(id, lib, noeud, aide, large) { var d = el('div', large ? 'large' : ''), l = el('label', null, lib); l.htmlFor = pref + '-' + id; noeud.id = pref + '-' + id; d.appendChild(l); d.appendChild(noeud); if (aide) d.appendChild(el('div', 'aide', aide)); g.appendChild(d); champs[id] = noeud; return d; }
    function liste(id, valeurs) { var dl = el('datalist'); dl.id = pref + '-dl-' + id; valeurs.forEach(function (v) { var o = el('option'); o.value = v; dl.appendChild(o); }); f.appendChild(dl); return dl.id; }
    /* Sélecteur (même présentation que la veste / parka) ; une valeur déjà enregistrée hors liste (ex. un tour de taille) reste proposée */
    function selecteur(valeurs, courant, vide) {
      var sl = el('select'), o = el('option', null, vide); o.value = ''; sl.appendChild(o); var c = String(courant == null ? '' : courant).trim();
      if (c && valeurs.indexOf(c) < 0) valeurs = [c].concat(valeurs);
      valeurs.forEach(function (v) { var x = el('option', null, v); x.value = v; sl.appendChild(x); }); sl.value = c; return sl;
    }
    var PANTALONS = []; for (var n = 34; n <= 66; n += 1) PANTALONS.push(String(n));
    var haut = selecteur(HAUTS, t.haut, '— choisir la taille —');
    champ('haut', 'T-shirt · veste · combinaison (haut)', haut, 'La combinaison suit cette taille ; autre cas : écrivez-le dans la remarque.');
    var pan = selecteur(PANTALONS, t.pantalon, '— choisir la taille —');
    champ('pantalon', 'Pantalon : taille', pan, 'Taille numérique (EU).');
    var cha = el('input'); cha.type = 'number'; cha.min = 30; cha.max = 52; cha.placeholder = 'ex. 43'; cha.value = t.chaussures || ''; champ('chaussures', 'Pointure (chaussures de sécurité)', cha);
    var vc = el('select'); var o0 = el('option', null, '— choisir la taille —'); o0.value = ''; vc.appendChild(o0);
    TABLE.forEach(function (r) { var o = el('option', null, 'UK ' + r.uk + ' — ' + r.lettre + ' (poitrine ' + r.poitrine + ' cm)'); o.value = String(r.uk); vc.appendChild(o); }); vc.value = String(t.veste_cuir || '');
    var dv = champ('veste_cuir', 'Veste / Parka', vc, 'Taille UK (facultatif).');
    var sug = el('button', 'petit', 'Reprendre la taille de mon haut'); sug.type = 'button'; sug.addEventListener('click', function () { var uk = ukDe(haut.value); if (uk) vc.value = String(uk); else toast('Indiquez d\'abord une taille de haut en lettres (S, M, L…).'); }); dv.appendChild(sug);
    var rem = el('textarea'); rem.rows = 2; rem.maxLength = 200; rem.value = t.remarque || ''; champ('remarque', 'Remarque (facultatif)', rem, '', true);
    f.appendChild(g);
    var b = el('div'); b.style.marginTop = '12px'; var s = el('button', 'btn-p', '💾 Enregistrer'); s.type = 'button'; b.appendChild(s); f.appendChild(b);
    s.addEventListener('click', function () {
      s.disabled = true;
      surEnregistrer({ haut: haut.value, pantalon: pan.value, chaussures: cha.value, veste_cuir: vc.value, remarque: rem.value }).then(function () { s.disabled = false; }, function () { s.disabled = false; });
    });
    return f;
  }
  return { formulaire: formulaire };
})();
