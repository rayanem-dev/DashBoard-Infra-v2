/* Client de la passerelle. Le mode démo (données fictives) est dans js/api-demo.js, chargé à la demande : en production, cette page ne le télécharge jamais. */
(function () {
  var DEMO = !window.GATEWAY_URL || /[?&]demo\b/.test(location.search);
  var CLE = 'infra_v2_token';
  var BASE = (document.currentScript && document.currentScript.src || '').replace(/api\.js(\?.*)?$/, '');
  var LECTURE = /^(liste|menu|situation|donnees|reprendre|annuaire|cpm_journal|planning|rotations|badges_donnees)/;
  function erreur(msg, code) { var e = new Error(msg); e.code = code || 'ERR'; return e; }
  var demoChargee = null;
  function chargerDemo() {
    if (window.ApiDemo) return Promise.resolve(window.ApiDemo);
    if (!demoChargee) demoChargee = new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = (BASE || 'js/') + 'api-demo.js'; s.onload = function () { ok(window.ApiDemo); }; s.onerror = function () { demoChargee = null; ko(erreur('Mode démo indisponible.')); }; document.head.appendChild(s); });
    return demoChargee;
  }
  var CLE_RM = 'infra_v2_remember';
  var SANS_REPRISE = { login: 1, activer: 1, reprendre: 1, liste: 1, demanderCode: 1 };

  // Un nouvel onglet démarre sans session (elle est propre à l'onglet) : il la demande aux autres onglets ouverts du même
  // navigateur (BroadcastChannel). Rien n'est écrit durablement ; sans onglet ouvert, on retombe sur la connexion.
  function jeton() { try { return sessionStorage.getItem(CLE) || ''; } catch (e) { return ''; } }
  var CANAL = 'infra_v2_session';
  var pret = Promise.resolve();
  if (!DEMO && typeof BroadcastChannel !== 'undefined') {
    try {
      var repondeur = new BroadcastChannel(CANAL);
      repondeur.onmessage = function (e) { if (e.data && e.data.type === 'demande' && jeton()) repondeur.postMessage({ type: 'jeton', jeton: jeton() }); };
      if (!jeton()) pret = new Promise(function (ok) {
        var bc = new BroadcastChannel(CANAL), fini = false;
        function fin() { if (!fini) { fini = true; try { bc.close(); } catch (e) {} ok(); } }
        bc.onmessage = function (e) { if (e.data && e.data.type === 'jeton' && e.data.jeton && !fini) { try { sessionStorage.setItem(CLE, e.data.jeton); } catch (x) {} fin(); } };
        bc.postMessage({ type: 'demande' }); setTimeout(fin, 400);
      });
    } catch (e) { pret = Promise.resolve(); }
  }

  window.Api = {
    demo: DEMO,
    remember: function () { try { return localStorage.getItem(CLE_RM) || ''; } catch (e) { return ''; } },
    setRemember: function (t) { try { t ? localStorage.setItem(CLE_RM, t) : localStorage.removeItem(CLE_RM); } catch (e) { /* stockage indisponible */ } },
    // Rouvre une session à partir du jeton « rester connecté » ; résout true/false.
    reprendre: function () {
      var self = this; var rt = this.remember();
      if (!rt) return Promise.resolve(false);
      if (this._reprise) return this._reprise; // plusieurs appels en parallèle : une seule reprise (le jeton « rester connecté » change à chaque fois)
      var fin = function () { self._reprise = null; };
      this._reprise = this.call('reprendre', { rt: rt }).then(function (r) {
        self.setToken(r.token); if (r.remember) self.setRemember(r.remember); return true;
      }).catch(function (e) { if (e.code === 'SESSION') self.setRemember(''); return false; });
      this._reprise.then(fin, fin);
      return this._reprise;
    },
    token: function () { try { return sessionStorage.getItem(CLE) || ''; } catch (e) { return ''; } },
    setToken: function (t) { try { sessionStorage.removeItem('gm_pages'); sessionStorage.removeItem('ml_menu'); sessionStorage.removeItem('ml_menu2'); t ? sessionStorage.setItem(CLE, t) : sessionStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ } },
    call: function (action, params, dejaRepris) {
      params = params || {};
      var self = this;
      if (DEMO) return chargerDemo().then(function (D) { return D.appeler(self, action, params); });
      return (SANS_REPRISE[action] ? Promise.resolve() : pret).then(function () {
      var corps = Object.assign({ action: action, token: self.token() }, params);
      // Google répond parfois par une page HTML (surcharge, quota, panne brève) au lieu du JSON : on le dit clairement, et les lectures sont rejouées.
      function appeler(essai) {
        return fetch(window.GATEWAY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) })
          .then(function (r) { return r.text().then(function (t) {
            try { return JSON.parse(t); } catch (x) {
              var brut = String(t).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
              var e = erreur('Le serveur Google n\'a pas répondu correctement' + (brut ? ' (« ' + brut + ' »)' : '') + '. Réessayez dans un instant.', 'SERVEUR'); e.rejouable = true; throw e;
            }
          }); })
          .catch(function (e) {
            if ((e.rejouable || e instanceof TypeError) && LECTURE.test(action) && essai < 3) return new Promise(function (ok) { setTimeout(ok, 700 * essai); }).then(function () { return appeler(essai + 1); });
            if (e instanceof TypeError) throw erreur('Connexion au serveur impossible : vérifiez le réseau.', 'RESEAU');
            throw e;
          });
      }
      return appeler(1)
        .then(function (j) { if (!j.ok) throw erreur(j.erreur || 'Erreur', j.code); return j; })
        .catch(function (e) {
          // Session expirée : on tente une fois de la rouvrir avec « rester connecté », puis on rejoue l'appel.
          if (e.code === 'SESSION' && !dejaRepris && !SANS_REPRISE[action] && self.remember()) {
            return self.reprendre().then(function (ok) { if (!ok) throw e; return self.call(action, params, true); });
          }
          throw e;
        });
      });
    }
  };
})();

