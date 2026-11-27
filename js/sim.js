// 자동 플레이 시뮬레이터 — 밸런스 확인용 (무작위/전략별로 여러 판 돌려 통계를 냅니다)
import * as G from './engine.js';

const JOBS = ['기획자', '개발자', '디자이너', 'QA'];
const BGS = ['전공자', '부트캠프', '독학', '타 업계'];

function policyCard(s, strategy, r) {
  const ids = s.cards.map((c) => c.id);
  if (ids.length === 1) return ids[0];
  if (strategy === '야근만' && ids.includes('overtime')) return 'overtime';
  if (strategy === '균형') {
    if (s.stats.스트레스 >= 60 && ids.includes('rest')) return 'rest';
    if (s.stats.스트레스 >= 60) return 'normal';
  }
  const all = ids.concat(['normal']);
  return all[Math.floor(r() * all.length)];
}

export function playOne(B, E, strategy = '무작위', seed) {
  let x = (seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const r = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
  const s = G.newGame(B, E, {
    seed: x, name: '시뮬', job: JOBS[Math.floor(r() * 4)], background: BGS[Math.floor(r() * 4)],
    answers: B.성향_문답.map(() => (r() < 0.5 ? 0 : 1)),
  });
  let guard = 0;
  while (s.phase !== 'ending' && guard++ < 2000) {
    switch (s.phase) {
      case 'company': G.chooseCompany(B, E, s, Math.floor(r() * s.offers.length)); break;
      case 'turn': G.chooseAction(B, E, s, policyCard(s, strategy, r)); break;
      case 'event':
        if (s.result) G.ackResult(B, E, s);
        else if (s.current.news || s.current.notice) G.chooseEventOption(B, E, s, 0);
        else { const n = G.eventChoices(E, G.eventById(E, s.current.id)).length; G.chooseEventOption(B, E, s, Math.floor(r() * n)); }
        break;
      case 'shop': {
        const items = B.상점.filter((it) => G.canBuy(B, s, it) && it.가격 < s.money * 0.3);
        if (items.length && r() < 0.3) G.buyItem(B, s, items[Math.floor(r() * items.length)].id);
        G.goToYearEnd(B, E, s); break;
      }
      case 'report':
        if (s.report.mustRetire) G.continueYear(B, E, s, s.report.canExtend && r() < 0.3 ? 'extend' : 'retire');
        else G.continueYear(B, E, s, 'stay');
        break;
      case 'offers': G.chooseOffer(B, E, s, r() < 0.3 ? 'accept' : r() < 0.5 ? 'counter' : 'decline', 0); break;
      default: throw new Error('알 수 없는 단계: ' + s.phase);
    }
  }
  if (guard >= 2000) throw new Error('무한 루프 의심');
  return s;
}

export function simulate(B, E, n = 200, strategy = '무작위') {
  const out = { n, strategy, endings: {}, ages: [], grades: { S: 0, A: 0, B: 0, C: 0, D: 0 }, rankAt40: {}, maxRank: {}, retiredAtAge: 0, awards: 0, itAwards: 0, choices: 0, happy: 0, netWorth: 0, cards: {} };
  for (let i = 0; i < n; i++) {
    const s = playOne(B, E, strategy, i * 7919 + 13);
    out.endings[s.ending] = (out.endings[s.ending] || 0) + 1;
    out.ages.push(s.age);
    if (s.age >= B.시작.정년) out.retiredAtAge += 1;
    for (const g of s.gradeHist) out.grades[g] += 1;
    const h40 = s.history.find((h) => h.age === 40);
    const r40 = h40 ? h40.rank : '(40세 전 종료)';
    out.rankAt40[r40] = (out.rankAt40[r40] || 0) + 1;
    out.maxRank[s.maxRank] = (out.maxRank[s.maxRank] || 0) + 1;
    out.awards += s.awards.length; out.itAwards += s.itAwards;
    out.choices += s.choiceCount;
    out.happy += s.endInfo.happy; out.netWorth += s.endInfo.netWorth;
    for (const c of s.cardHist) out.cards[c] = (out.cards[c] || 0) + 1;
  }
  out.avgAge = out.ages.reduce((a, b) => a + b, 0) / n;
  out.avgChoices = out.choices / n;
  out.avgHappy = out.happy / n;
  out.avgNetWorth = out.netWorth / n;
  return out;
}
