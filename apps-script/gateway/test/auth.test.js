const test = require('node:test');
const assert = require('node:assert');
global.CFG = { MDP_MIN: 4 };
const Auth = require('../Auth.gs');

test('mot de passe : 4 caractères suffisent, sans règle de lettre/chiffre', () => {
  assert.doesNotThrow(() => Auth.controleMdp('1234'));
  assert.doesNotThrow(() => Auth.controleMdp('abcd'));
});
test('mot de passe : moins de 4 caractères refusé', () => {
  assert.throws(() => Auth.controleMdp('123'), /4 caractères/);
  assert.throws(() => Auth.controleMdp(''), /4 caractères/);
  assert.throws(() => Auth.controleMdp(null), /4 caractères/);
});
