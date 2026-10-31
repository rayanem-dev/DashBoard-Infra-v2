const test = require('node:test'), assert = require('node:assert');
const { cleContrat_, fichesRemplacees_, tauxGlobal_, contratsDepuis_, numeroLong_, montantFr_, delaiFr_, ficheHtml_, criteres_, POURCENTS, tauxFr_ } = require('../Code.js');

test('taux global : moyenne des cases cochées, tronquée — fiche ETB ZATOUT ABDENACER = 71,53 %', () => {
  const notes = {}, c = criteres_(), idDe = t => c.filter(x => x.texte.indexOf(t) === 0)[0].id;
  ['Reporting d’avancement', 'Respect des normes et règles HSE', 'Respect du planning', 'Planification', 'Rattrapage', 'Nombre du Personnel', 'Qualification du Personnel', 'Nombre des moyens', 'Qualité des moyens', 'Temps de réponse', 'Disponibilité'].forEach(t => notes[idDe(t)] = 70);
  notes[idDe('Management du projet')] = 80; notes[idDe('Qualité de la communication')] = 80;
  assert.strictEqual(tauxGlobal_(notes), 71.53);
  assert.strictEqual(tauxFr_(71.53), '71,53 %');
  assert.strictEqual(tauxGlobal_({}), null);
  assert.strictEqual(tauxGlobal_({ 0: 100, 1: 50 }), 75);
  assert.strictEqual(tauxGlobal_({ 0: 55 }), null); // une valeur qui n'est pas une case du tableau est ignorée
});
test('20 critères, dans l\'ordre du modèle', () => {
  const c = criteres_(); assert.strictEqual(c.length, 20); assert.strictEqual(c[0].texte, 'Fiabilité des études et documents.'); assert.strictEqual(c[c.length - 1].texte, 'Disponibilité.');
  assert.deepStrictEqual(POURCENTS, [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
});
test('cartouche depuis le Suivi CPM : contrats en exécution, formats de la fiche', () => {
  assert.strictEqual(numeroLong_('53.INFRA.25'), 'I/53/RNS/INFRA/2025');
  assert.strictEqual(numeroLong_('I/53/RNS/INFRA/2025'), 'I/53/RNS/INFRA/2025');
  assert.strictEqual(montantFr_('162300000'), '162 300 000,00 DA HT');
  assert.strictEqual(montantFr_('162 300 000,00'), '162 300 000,00 DA HT');
  assert.strictEqual(montantFr_('162,300,000.5'), '162 300 000,50 DA HT');
  assert.strictEqual(delaiFr_('36'), '36 Mois'); assert.strictEqual(delaiFr_('540'), '540 Jours');
  const l = (statut, contrat, extra) => { const r = new Array(19).fill(''); r[3] = 'Terrassement'; r[8] = statut; r[12] = 'ETB ZATOUT ABDENCER'; r[13] = contrat; r[14] = '162300000'; r[16] = '10/05/2025'; r[17] = '36'; r[18] = '09/05/2028'; return Object.assign(r, extra || {}); };
  const lignes = [['', '', '', 'Intitulé', '', '', '', '', 'Statut'], l('Contrat en exécution', '53.INFRA.25'), l('Contrat échu', '10.INFRA.24'), l('Contrat en exécution', '53.INFRA.25')];
  const r = contratsDepuis_(lignes);
  assert.deepStrictEqual(r.filter(x => x.phase === 'execution'), [{ contrat: 'I/53/RNS/INFRA/2025', numeroCpm: '53.INFRA.25', entrepreneur: 'ETB ZATOUT ABDENCER', montant: '162 300 000,00 DA HT', dateOds: '10/05/2025', dateVigueur: '10/05/2025', dateService: '09/05/2028', delai: '36 Mois', manques: [], projet: 'Terrassement', statut: 'Contrat en exécution', phase: 'execution' }]);
  assert.deepStrictEqual(r.map(x => [x.numeroCpm, x.phase]), [['53.INFRA.25', 'execution'], ['10.INFRA.24', 'reserves']]);   // l'échu est proposé en levée des réserves, après l'exécution
});
test('cartouche : numéro avec année sur 4 chiffres ou faute de frappe, unité de durée, champs manquants signalés', () => {
  assert.strictEqual(numeroLong_('03.INFRA.2026'), 'I/03/RNS/INFRA/2026'); assert.strictEqual(numeroLong_('40,INFRA,26'), 'I/40/RNS/INFRA/2026');
  assert.strictEqual(delaiFr_('6', 'jours'), '6 Jours'); assert.strictEqual(delaiFr_('540', 'mois'), '540 Mois'); assert.strictEqual(delaiFr_('11', ''), '11 Mois');
  const r = new Array(36).fill(''); r[3] = 'Étude'; r[8] = 'Contrat en exécution'; r[12] = 'ENAGEO';
  const out = contratsDepuis_([['', '', '', 'Intitulé', '', '', '', '', 'Statut'], r]);
  assert.strictEqual(out.length, 1, 'un contrat en exécution sans n° reste dans la liste');
  assert.deepStrictEqual(out[0].manques, ['n° de contrat', 'montant', 'date ODS', 'durée', 'échéance (mise en service)']);
});
test('PDF : cartouche, case cochée « X » à la bonne colonne, taux, échappement', () => {
  const c = criteres_(), h = ficheHtml_({ cartouche: { entrepreneur: 'ETB <b>Z', contrat: 'I/53/RNS/INFRA/2025', date: '2025-11-25', projet: 'Terrassement', dateOds: '10/05/2025' }, notes: { [c[0].id]: 70, [c[1].id]: 80 }, suggestion: 'Ligne 1\nLigne 2' }, 'AAAA');
  assert.ok(h.includes('FICHE D’EVALUATION MENSUELLE') && h.includes('Entrepreneur : ETB &lt;b&gt;Z') && h.includes('Date : 25/11/2025') && h.includes('Projet : Terrassement'));
  assert.ok(h.includes('75 %') || h.includes('75,00') || h.includes('75 %'));
  assert.strictEqual((h.match(/>X</g) || []).length, 2);
  assert.ok(h.includes('data:image/png;base64,AAAA') && h.includes('Ligne 1<br>Ligne 2') && h.includes('Toute insuffisance doit être consignée'));
});

test('cartouche : un filet autour de chaque ligne (entrepreneur… date de mise en service)', () => {
  const { ficheHtml_ } = require('../Code.js');
  const h = ficheHtml_({ cartouche: { entrepreneur: 'ETS X', contrat: 'I/12/RNS/INFRA/2026' }, notes: {} }, '');
  assert.match(h, /td\.l\{border:1px solid #000/);
  assert.strictEqual((h.match(/<td class="l">/g) || []).length, 7);
});

test('envoi au secrétariat : seulement une fiche du dossier d\'archive, par e-mail avec le PDF', () => {
  const C = require('../Code.js'), envoyes = [];
  const dossier = { getId: () => 'D1' };
  global.DOSSIER_FICHES = undefined;
  global.DriveApp = { getFolderById: () => dossier, getFoldersByName: () => ({ hasNext: () => true, next: () => dossier }), getFileById: id => ({ getName: () => 'Fiche.pdf', getBlob: () => 'PDF', getParents: () => { let d = id === 'ok'; return { hasNext: () => d, next: () => { d = false; return id === 'ok' ? dossier : { getId: () => 'AUTRE' }; } }; } }) };
  global.MailApp = { sendEmail: m => envoyes.push(m) };
  assert.strictEqual(C.envoyerFicheAuSecretariat('ok').success, true);
  assert.strictEqual(envoyes.length, 1); assert.strictEqual(envoyes[0].to, C.EMAIL_SECRETARIAT); assert.deepStrictEqual(envoyes[0].attachments, ['PDF']);
  assert.strictEqual(C.envoyerFicheAuSecretariat('ailleurs').success, false); assert.strictEqual(envoyes.length, 1);
});

test('services : cinq boîtes e-mail, recherche par identifiant, liste sans adresses', () => {
  const C = require('../Code.js');
  assert.strictEqual(C.SERVICES_MAIL.length, 5);
  assert.strictEqual(C.serviceMail_('construction').email, 'INFRA_CONSTR.RNS@Sonatrach.dz');
  assert.strictEqual(C.serviceMail_('cpm').email, 'RNS.CPM_INFRA@Sonatrach.dz');
  assert.strictEqual(C.serviceMail_('inconnu'), null);
  assert.ok(!JSON.stringify(C.listeServices()).includes('@'), 'les adresses ne sortent pas vers l\'écran');
});

test('phases des contrats : exécution, préparation avant, levée des réserves après, infructueux jamais proposés', () => {
  const { phaseDe_ } = require('../Code.js');
  assert.deepStrictEqual(['Contrat en exécution', 'Non démarré', 'Dossier en cours', 'Attribué', 'Bloqué', 'Contrat échu', 'Terminé', 'infructueux', ''].map(phaseDe_),
    ['execution', 'preparation', 'preparation', 'preparation', 'preparation', 'reserves', 'reserves', '', '']);
});

test('une seule fiche par contrat et par mois : la dernière remplace les autres du même contrat et du même mois', () => {
  assert.strictEqual(cleContrat_('53.INFRA.25'), '53-25'); assert.strictEqual(cleContrat_('I/53/RNS/INFRA/2025'), '53-25'); assert.strictEqual(cleContrat_('Visite sur site'), '');
  const d = [{ id: 'a', contrat: 'I/53/RNS/INFRA/2025', mois: '2026-10' }, { id: 'b', contrat: '53.INFRA.25', mois: '2026-10' }, { id: 'c', contrat: 'I/53/RNS/INFRA/2025', mois: '2026-09' }, { id: 'd', contrat: 'I/47/RNS/INFRA/2026', mois: '2026-10' }, { id: 'n', contrat: 'I/53/RNS/INFRA/2025', mois: '2026-10' }, { id: 'e', contrat: '', mois: '2026-10' }];
  assert.deepStrictEqual(fichesRemplacees_(d, 'n', 'I/53/RNS/INFRA/2025', '2026-10'), ['a', 'b']);          // même contrat (écrit de deux façons) et même mois ; pas septembre, pas un autre contrat, pas la nouvelle
  assert.deepStrictEqual(fichesRemplacees_(d, 'n', 'Visite sur site', '2026-10'), [], 'sans n° de contrat lisible : rien n\'est remplacé');
  assert.deepStrictEqual(fichesRemplacees_(d, 'n', 'I/53/RNS/INFRA/2025', ''), []);
});
