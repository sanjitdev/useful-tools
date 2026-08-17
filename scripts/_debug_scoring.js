const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('assets/js/scoring.js', 'utf8');
const ctx = { HT: {}, console: { warn: () => {}, log: () => {}, error: () => {} } };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const s = ctx.HT.scoring;
console.log('has score fn:', typeof s.score);
const spec = {
  traits: ['calm', 'bold'],
  weights: { q1: { calm: { calm: 1, bold: 0 }, bold: { calm: 0, bold: 1 } } },
  archetypes: [
    { id: 'zen', scores: { calm: 80, bold: 20 } },
    { id: 'hero', default: true, scores: { calm: 20, bold: 80 } }
  ]
};
const r = s.score({ q1: 'calm' }, spec);
console.log('result:', JSON.stringify(r));
