/**
 * Vidéos de formation, servies APRÈS CONNEXION seulement (elles ne sont plus publiées sur le site public).
 * Les données viennent des fichiers générés VideosFormation*.gs (source privée : data/videos, voir outils/generer-videos-gateway.js).
 */
var VIDEOS_TITRES_ = { 'fiche-evaluation': 'Fiche d\'évaluation : comment l\'utiliser', 'rapports-journaliers': 'Rapports journaliers : du rapport du jour au consolidé' };
/** Pur (testé en Node) : assemble les morceaux d'une vidéo ; null si l'identifiant n'existe pas. */
function videoAssembler_(parties, id) {
  var p = parties && Object.prototype.hasOwnProperty.call(parties, id) ? parties[id] : null; if (!p) return null;
  return { mp4: (p.mp4 || []).join(''), poster: (p.poster || []).join('') };
}
function videoFormation_(req) {
  Auth.userFromToken(req.token);
  var parties = (typeof videosFormationParties_ === 'function') ? videosFormationParties_() : {}, v = videoAssembler_(parties, String(req.id || ''));
  if (!v || !v.mp4) throw new Error('Vidéo indisponible');
  return { id: String(req.id), titre: VIDEOS_TITRES_[String(req.id)] || '', mp4: v.mp4, poster: v.poster };
}
if (typeof module !== 'undefined') module.exports = { videoAssembler_: videoAssembler_ };
