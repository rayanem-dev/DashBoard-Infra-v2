/* boutoninstaller — bouton « Installer » (application installable, PWA) : Chrome / Edge / Android et consigne iPhone.
 * Autonome (le style est inclus), sans dépendance. Usage : voir README.md.
 *   BoutonInstaller.monter({ cible: '#install', langue: 'fr', serviceWorker: 'sw.js' })
 *   BoutonInstaller.maj({ langue: 'ar' })      // quand la langue change
 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BoutonInstaller = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TEXTES = {
    fr: { installer: 'Installer', ios: 'Pour installer : touchez Partager, puis « Sur l\'écran d\'accueil ».' },
    en: { installer: 'Install', ios: 'To install: tap Share, then "Add to Home Screen".' },
    ar: { installer: 'تثبيت', ios: 'للتثبيت: اضغط على مشاركة ثم «إضافة إلى الشاشة الرئيسية».' }
  };
  var CSS = '.bi-btn{border:1px solid var(--bi-line,#DADFE8);background:var(--bi-bg,#fff);color:var(--bi-ink,#1B1D23);border-radius:999px;padding:7px 14px;font:600 .88rem system-ui,sans-serif;cursor:pointer}' +
    '.bi-btn[hidden]{display:none}.bi-btn:hover{border-color:var(--bi-accent,#1B4575);color:var(--bi-accent,#1B4575)}' +
    ':root[data-theme="dark"] .bi-btn{--bi-bg:#232733;--bi-ink:#E8EAF0;--bi-line:#3A4052}';
  var etat = { langue: 'fr', t: null, btn: null, differe: null, ios: false, installee: false, opts: {} };

  function texte(cle) {
    var base = (TEXTES[etat.langue] || TEXTES.fr)[cle] || TEXTES.fr[cle];
    var perso = etat.opts.libelles && etat.opts.libelles[etat.langue] && etat.opts.libelles[etat.langue][cle];
    var s = perso || base;
    return etat.t ? etat.t(s) : s;
  }
  function style() { if (document.getElementById('bi-style')) return; var s = document.createElement('style'); s.id = 'bi-style'; s.textContent = CSS; document.head.appendChild(s); }
  function afficher() { if (etat.installee || !etat.btn) return; etat.btn.textContent = '⤓ ' + texte('installer'); etat.btn.hidden = false; }
  function monter(opts) {
    opts = opts || {}; etat.opts = opts; etat.langue = opts.langue || 'fr'; etat.t = opts.t || null; style();
    var cible = typeof opts.cible === 'string' ? document.querySelector(opts.cible) : opts.cible;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'bi-btn'; btn.hidden = true;
    if (cible) cible.appendChild(btn); else { btn.style.cssText = 'position:fixed;top:12px;inset-inline-end:12px;z-index:50'; document.body.appendChild(btn); }
    etat.btn = btn;
    etat.installee = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    etat.ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); etat.differe = e; afficher(); });
    window.addEventListener('appinstalled', function () { etat.installee = true; btn.hidden = true; etat.differe = null; if (opts.surInstallation) opts.surInstallation(); });
    btn.addEventListener('click', function () {
      if (etat.differe) { etat.differe.prompt(); etat.differe.userChoice.then(function () { etat.differe = null; btn.hidden = true; }); }
      else if (etat.ios) alert(texte('ios'));
    });
    if (etat.ios && !etat.installee) afficher();
    if (opts.serviceWorker && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register(opts.serviceWorker).catch(function () {});
    return btn;
  }
  function maj(opts) {
    opts = opts || {};
    if (opts.langue) etat.langue = opts.langue;
    if (opts.t) etat.t = opts.t;
    if (etat.btn && !etat.btn.hidden) etat.btn.textContent = '⤓ ' + texte('installer');
  }
  return { monter: monter, maj: maj };
});
