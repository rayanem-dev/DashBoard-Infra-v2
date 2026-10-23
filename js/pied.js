/* Pied de page commun : brique « basdepage » de la bibliothèque lib (ligne de version avec ✓ / ⚠ / ?, nouveautés, copyright, actualiser).
 * Une seule ligne dans chaque page : <script src="js/pied.js"></script>. Langue (français, arabe, anglais) et thème clair / sombre en bas à droite ; la traduction des pages est faite par js/i18n.js. */
(function () {
  // Depuis une application Apps Script : <script src="https://…/js/pied.js" data-nom="Nom de l'application"></script> — tout est alors chargé depuis l'adresse du site.
  var me = document.currentScript, BASE = me && me.src ? me.src.replace(/js\/pied\.js(\?.*)?$/, '') : '', NOM = me && me.getAttribute('data-nom');
  if (NOM) {
    var st = document.createElement('style');
    // thème sombre pour des pages qui n'ont pas de variables de thème : on inverse la page (les teintes sont conservées), sauf en-tête et images
    st.textContent = 'html[data-theme="dark"] body { background: #11151c !important; }' +
      'html[data-theme="dark"] body > :not(.bdp-prefs):not(.bdp-foot):not(.aide-btn):not(.aide-dlg):not(script):not(style) { filter: invert(.92) hue-rotate(180deg); }' +
      'html[data-theme="dark"] body > :not(.bdp-prefs) header, html[data-theme="dark"] body > :not(.bdp-prefs) img { filter: invert(.92) hue-rotate(180deg); }' +
      'html[data-theme="dark"] body > header { filter: none !important; }';
    document.head.appendChild(st);
  }
  /**
   * Ancienne application installée (créée à partir de l'ancienne adresse) : l'ancienne page l'envoie ici avec ?depuis=ancien.
   * Dans ce cas, et tant que cet onglet / cette fenêtre reste ouvert, un écran invite à désinstaller l'ancienne application et à installer la nouvelle ;
   * l'accès se fait depuis le navigateur. Une application installée depuis la nouvelle adresse n'est jamais concernée.
   */
  (function () {
    if (NOM) return;
    var depuis = /[?&]depuis=ancien\b/.test(location.search), memo = false;
    try { if (depuis) sessionStorage.setItem('infra_ancienne_app', '1'); memo = sessionStorage.getItem('infra_ancienne_app') === '1'; } catch (e) { memo = depuis; }
    var autonome = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    if (!memo || !autonome) return;
    function monter() {
      var nouveau = location.origin + location.pathname.replace(/[^\/]*$/, '') + 'connexion.html';
      var d = document.createElement('div'); d.setAttribute('role', 'alertdialog'); d.setAttribute('aria-modal', 'true');
      d.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#F5F5F0;color:#1A1A2E;font-family:Inter,Arial,sans-serif;display:grid;place-items:center;padding:24px;overflow:auto';
      d.innerHTML = '<div style="max-width:520px;text-align:center"><div style="font-size:42px">🔄</div><h1 style="font-size:22px;margin:8px 0">Cette application est l\'ancienne version</h1>' +
        '<p style="line-height:1.5">Le portail de la Division Infrastructure a changé d\'adresse. Pour continuer, installez la nouvelle application :</p>' +
        '<ol style="text-align:left;line-height:1.7;display:inline-block"><li><b>Désinstallez</b> cette application (menu ⋮ en haut à droite › Désinstaller).</li><li>Ouvrez le <b>nouveau portail</b> dans votre navigateur (bouton ci-dessous).</li><li>Cliquez sur l\'icône <b>Installer</b> de la barre d\'adresse (ou menu ⋮ › Installer).</li></ol>' +
        '<p style="margin:14px 0"><a id="ia-lien" target="_blank" rel="noopener" style="display:inline-block;background:#E85D04;color:#fff;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">Ouvrir le nouveau portail dans le navigateur</a></p>' +
        '<p style="font-size:12px;color:#666;word-break:break-all">' + nouveau + '</p></div>';
      d.querySelector('#ia-lien').href = nouveau;
      document.body.appendChild(d);
    }
    if (document.body) monter(); else document.addEventListener('DOMContentLoaded', monter);
  })();
  /** Télécharge toutes les pièces en parallèle ; elles s'exécutent dans l'ordre de la liste (async=false). */
  function chargerTout(liste, suite) {
    var restant = liste.length; if (!restant) { suite(); return; }
    liste.forEach(function (src) {
      var s = document.createElement('script'); s.src = BASE + src; s.async = false;
      s.onload = s.onerror = function () { restant -= 1; if (!restant) suite(); };
      document.head.appendChild(s);
    });
  }
  var TRADUCTION = ['js/i18n.js', 'js/i18n-dico.js', 'js/i18n-apps.js', 'js/i18n-suivi.js', 'js/i18n-formulaires.js', 'js/i18n-ajouts.js'];
  /** Moteur et dictionnaires de traduction : chargés seulement quand la langue n'est pas le français (≈ 130 ko économisés sinon). */
  function avecTraduction(suite) { if (window.I18n) { suite(); return; } chargerTout(TRADUCTION, suite); }
  function langueMemorisee() { try { return localStorage.getItem('infra-lang') || 'fr'; } catch (e) { return 'fr'; } }
  function monter() {
    if (!window.BasDePage) return;
    BasDePage.monter({
      nom: NOM || 'Portail Infra', version: window.PORTAIL_VERSION || '',
      surVersion: function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); if (window.Nouveautes) Nouveautes.ouvrir(); },
      comparer: { urlSite: BASE + 'version.json' },
      copyright: '© 2026 JawlaDev — Tous droits réservés', copyrightLien: { texte: 'JawlaDev', href: 'https://rayanem-dev.github.io/JawlaDev/' },
      actualiser: function () { location.reload(); },
      langues: [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']], langue: 'fr',
      surLangue: function (code) { if (code === 'fr' && !window.I18n) return; avecTraduction(function () { if (window.I18n) I18n.appliquer(code); }); },
      t: function (texte) { return window.I18n ? I18n.t(texte) : texte; },
      surTheme: function () { document.dispatchEvent(new Event('infra-theme')); },
      cle: 'infra'
    });
    var l = BasDePage.langue(); if (l !== 'fr') avecTraduction(function () { I18n.appliquer(l); }); // langue mémorisée (basdepage règle lang/dir, la traduction du texte est faite ici)
  }
  // Aide : petit « ? » discret en bas à gauche ; le contenu (js/aide.js + js/aide-data.js) n'est chargé qu'au clic
  (function () {
    function monterAide() {
      if (document.querySelector('.aide-btn')) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'aide-btn'; b.textContent = '?'; b.title = 'Aide'; b.setAttribute('aria-label', 'Aide'); b.setAttribute('data-i18n-non', '');
      b.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9000;width:28px;height:28px;border-radius:50%;border:1px solid rgba(120,120,120,.45);background:rgba(255,255,255,.85);color:#6B7280;font:700 14px Inter,Arial,sans-serif;cursor:pointer;opacity:.55;padding:0;line-height:1';
      b.onmouseenter = b.onfocus = function () { b.style.opacity = '1'; }; b.onmouseleave = b.onblur = function () { b.style.opacity = '.55'; };
      b.onclick = function () { window.AIDE_NOM = NOM || ''; chargerTout(window.Aide && window.AIDE ? [] : ['js/aide-data.js', 'js/aide.js'], function () { if (window.Aide) Aide.ouvrir(); }); };
      document.body.appendChild(b);
      var st = document.createElement('style'); st.textContent = '@media print{.aide-btn,.aide-dlg{display:none!important}}'; document.head.appendChild(st);
    }
    if (document.body) monterAide(); else document.addEventListener('DOMContentLoaded', monterAide);
  })();
  // Mode support (ouvert depuis Privilèges) : bandeau fixe en haut de chaque page, avec retour au compte de l'administrateur
  (function () {
    var o = null; try { o = JSON.parse(sessionStorage.getItem('infra_v2_support') || 'null'); } catch (e) { o = null; }
    if (!o || !o.retour) return;
    function monterBandeau() {
      var b = document.createElement('div'); b.setAttribute('data-i18n-non', '');
      b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#9D0208;color:#fff;font:600 13px Inter,Arial,sans-serif;padding:7px 12px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.35)';
      b.appendChild(document.createTextNode('MODE SUPPORT — vous voyez le portail comme ' + o.nom + '  '));
      var a = document.createElement('button'); a.type = 'button'; a.textContent = 'Revenir à mon compte';
      a.style.cssText = 'margin-left:10px;padding:3px 10px;border-radius:6px;border:1px solid #fff;background:#fff;color:#9D0208;font:700 12px Inter,Arial,sans-serif;cursor:pointer';
      a.onclick = function () {
        try { sessionStorage.setItem('infra_v2_token', o.retour); sessionStorage.removeItem('infra_v2_support'); sessionStorage.removeItem('gm_pages'); Object.keys(sessionStorage).forEach(function (k) { if (k.indexOf('dc_') === 0) sessionStorage.removeItem(k); }); } catch (e) { /* rien */ }
        location.href = 'privileges.html';
      };
      b.appendChild(a); document.body.appendChild(b); document.body.style.paddingTop = '34px';
    }
    if (document.body) monterBandeau(); else document.addEventListener('DOMContentLoaded', monterBandeau);
  })();
  // version, nouveautés et pied de page ; la traduction n'est chargée qu'en arabe / anglais (avant le pied de page, pour que ses textes soient traduits)
  var pieces = ['js/version.js', 'js/nouveautes.js'].concat(langueMemorisee() === 'fr' ? [] : TRADUCTION, ['js/basdepage.js']);
  chargerTout(pieces, function () {
    var bv = document.getElementById('bandeau-version'); if (bv && window.PORTAIL_VERSION) bv.textContent = 'Sonatrach · RNS · Version ' + window.PORTAIL_VERSION;
    monter();
  });
  // avatar du compte en haut à droite (pages du site connectées ; ni la connexion ni les applications Apps Script)
  if (!NOM && !/connexion\.html/.test(location.pathname) && window.Api && !window.Avatar) { var av = document.createElement('script'); av.src = BASE + 'js/avatar.js'; document.head.appendChild(av); }
})();
