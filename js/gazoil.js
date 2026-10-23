/* Autorisation d'approvisionnement en GAZ-OIL (fûts) : la quantité en litres est divisée en fûts de 200 L (contenance modifiable). Pur : testé avec Node. */
(function (racine) {
  /** 400 → { futs: 2, reste: 0, texte: '400L Soit 2 fûts de 200L' } ; 500 → '500L Soit 2 fûts de 200L et 1 fût de 100L'. */
  function repartir(litres, contenance) {
    var L = Math.floor(Number(litres)), C = Math.floor(Number(contenance)) || 200;
    if (!(L > 0) || !(C > 0)) return { futs: 0, reste: 0, texte: '' };
    var n = Math.floor(L / C), r = L % C, parts = [];
    if (n) parts.push(n + ' fût' + (n > 1 ? 's' : '') + ' de ' + C + 'L');
    if (r) parts.push('1 fût de ' + r + 'L');
    return { futs: n + (r ? 1 : 0), reste: r, texte: L + 'L Soit ' + parts.join(' et ') };
  }
  var API = { repartir: repartir };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Gazoil = API;
})(typeof window !== 'undefined' ? window : this);
