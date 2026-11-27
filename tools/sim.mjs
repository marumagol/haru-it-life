// 사용법: node tools/sim.mjs [판수] [전략: 무작위|균형|야근만]
import { readFileSync } from 'node:fs';
import { simulate } from '../js/sim.js';

const B = JSON.parse(readFileSync(new URL('../data/balance.json', import.meta.url)));
const E = JSON.parse(readFileSync(new URL('../data/events.json', import.meta.url)));
const n = Number(process.argv[2] || 300);
const strategy = process.argv[3] || '무작위';
const r = simulate(B, E, n, strategy);
const pct = (v) => ((v / n) * 100).toFixed(1) + '%';
const gTotal = Object.values(r.grades).reduce((a, b) => a + b, 0);
console.log(`전략 ${strategy}, ${n}판`);
console.log('평균 종료 나이', r.avgAge.toFixed(1), '· 정년 도달', pct(r.retiredAtAge), '· 평균 선택 횟수', r.avgChoices.toFixed(0));
console.log('고과 분포', Object.fromEntries(Object.entries(r.grades).map(([k, v]) => [k, ((v / gTotal) * 100).toFixed(0) + '%'])));
console.log('40세 직급', r.rankAt40);
console.log('최고 직급', r.maxRank);
console.log('엔딩', Object.fromEntries(Object.entries(r.endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, pct(v)])));
console.log('판당 수상', (r.awards / n).toFixed(1), '· 올해의 IT인 판당', (r.itAwards / n).toFixed(2), '· 평균 행복도', r.avgHappy.toFixed(0), '· 평균 순자산(만원)', Math.round(r.avgNetWorth));
