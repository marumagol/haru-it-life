// 하루살이 IT 인생 — 게임 엔진 (화면과 분리된 순수 로직)
// 모든 수치는 data/balance.json, 이벤트는 data/events.json 에서 읽습니다.

export const SKILLS = ['실무력', '소통력', '트렌드', '리더십', '정치력', '멘탈'];
const CLAMP100 = ['실무력', '소통력', '트렌드', '리더십', '정치력', '멘탈', '스트레스', '사내입지', '업계평판'];
const RANK_COEF = { 사원: 0.5, 대리: 0.5, 과장: 1, 팀장: 1.5, 리드: 1.5, 실장: 2, 프린시팔: 2, 임원: 3, C레벨: 5, 펠로우: 5 };
const NEXT_RANK = { 사원: '대리', 대리: '과장', 과장: '팀장', 팀장: '실장', 실장: '임원', 임원: 'C레벨', 리드: '프린시팔', 프린시팔: '펠로우' };
const GRADE_ORDER = ['S', 'A', 'B', 'C', 'D'];
const GRADE_SCORE = { S: 2, A: 1, B: 0, C: -1, D: -2 };
const PEER_NAMES = ['김하늘', '이도윤', '박서연', '최준호', '정유나', '강민재', '윤지아', '한결', '오세린', '임태오'];
const RANDOM_NAMES = ['김하루', '이버팀', '박야근', '최칼퇴', '정성장', '한다솜', '윤새벽', '오늘찬'];

// ---------- 랜덤 (시드 고정) ----------
export function rand(s) {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
const chance = (s, pct) => rand(s) * 100 < pct;
function pickWeighted(s, items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rand(s) * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}
function shuffle(s, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ageIdx = (age) => (age < 30 ? 0 : age < 40 ? 1 : age < 50 ? 2 : 3);

// ---------- 공개 헬퍼 ----------
export function companyStatus(B, v) {
  const z = B.회사.상태구간;
  if (v >= z.호황) return '호황';
  if (v < z.위기) return '위기';
  if (v < z.경고) return '경고';
  return '평시';
}
export function replaceScore(B, s) {
  const R = B.대체가능성;
  const tc = s.year >= 2028 ? R.AI시대_트렌드계수 : R.트렌드계수;
  let v = R.기본 - s.stats.실무력 * R.실무력계수 - s.stats.트렌드 * tc;
  if (s.age >= 50) v += R['50대'];
  if (s.lastGrade === 'D') v += R.고과D;
  if (s.stats.업계평판 >= 60) v += R.평판60이상;
  if (s.job === 'QA' && s.company && companyStatus(B, s.company.state) === '위기') v += R.QA_회사위기;
  const J = B.직군[s.job] || {};
  v += J.대체보정 || 0;
  if (s.year >= 2028) v += J.대체보정_AI시대 || 0;
  return v;
}
export function replaceGrade(B, v) {
  const g = B.대체가능성.등급;
  if (v >= g.위험) return '위험';
  if (v >= g.높음) return '높음';
  if (v >= g.보통) return '보통';
  return '낮음';
}
export function competence(B, s) {
  const key = s.track === 'manager' ? 'manager' : s.track === 'expert' && s.rank !== '과장' ? 'expert' : 'common';
  const w = B.고과.가중치[key];
  let v = 0;
  for (const k in w) v += s.stats[k] * w[k];
  return v;
}
export function judgeChance(B, s, check, ev) {
  if (!check) return 100;
  if (check.확률 != null) return check.확률;
  const J = B.판정;
  let c = J.기본 + (s.stats[check.능력치] - check.요구);
  if (check.위기) c += s.stats.멘탈 * B.위기.멘탈_회복판정계수;
  if (ev?.분류 === '직군') c += B.직군[s.job]?.직군이벤트_판정보너스 || 0;
  return clamp(c, J.최소, J.최대);
}
export function judgeBadge(B, pct) {
  if (pct >= B.판정.자신있음) return '자신 있음';
  if (pct >= B.판정.해볼만함) return '해볼 만함';
  return '불안함';
}
export function netWorth(B, s) {
  let v = s.money;
  if (s.items.jeonse) v += 30000;
  if (s.items.house) v += s.items.house.value || 80000;
  return v;
}
export function formatMoney(v) {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(Math.round(v));
  if (a >= 10000) return sign + (a / 10000).toFixed(a >= 100000 ? 0 : 1).replace(/\.0$/, '') + '억';
  return sign + a.toLocaleString('ko-KR') + '만원';
}
export function eventById(E, id) {
  return E.특수이벤트[id] ? { id, ...E.특수이벤트[id] } : E.이벤트.find((e) => e.id === id);
}
export function eventChoices(E, ev) {
  return ev.공통선택지 ? E.상사공통선택지 : ev.선택;
}

// ---------- 새 게임 ----------
export function newGame(B, E, opt) {
  const seed = opt.seed ?? Math.floor(Math.random() * 2 ** 31);
  const st = B.시작;
  const s = {
    v: 1, seed, rng: seed >>> 0,
    name: (opt.name || '').trim(), job: opt.job, background: opt.background,
    year: st.연도, age: opt.background === '타 업계' ? st.타업계_나이 : st.나이,
    careerYears: 0, yearsInCompany: 0, yearsInRank: 0,
    stats: { ...st.능력치, 사내입지: st.사내입지, 업계평판: st.업계평판, 스트레스: st.스트레스 },
    hp: st.체력, hpMax: st.체력최대, money: st.돈,
    pot: {}, trait: null, traitScores: {},
    company: null, boss: null, salary: 0, rank: '사원', track: 'common',
    gradeHist: [], lastGrade: null, gradePts: 0, cardHist: [], yearCards: {},
    items: {}, buffs: {}, flags: {}, seen: {}, avoidedBosses: [],
    growthBoost: null, hhBoost: 0, hhForce: false, leaveHalves: 0, leaveThisYear: 0,
    healthHits: 0, stressHighYears: 0, replaceDangerYears: 0, unpaid: false, failPromo: 0,
    companyLowYears: 0, jobless: null, everJobless: false, crisisNext: null, crisisOvercameYear: -1,
    warnedYear: -1, burnoutYear: -1,
    peers: [], phase: 'company', half: 1, cards: [], queue: [], after: null, current: null, result: null,
    report: null, offers: null, pendingOffers: null, postQueue: [], history: [], awards: [], log: [],
    stressSum: 0, stressCount: 0, traitMatch: 0, choiceCount: 0, moves: 0, maxRank: '사원', itAwards: 0,
    extended: false, ending: null, yearStart: null,
  };
  if (!s.name) s.name = pick(s, RANDOM_NAMES);
  // 직군·배경 보너스
  applyRaw(s, B.직군[s.job].보너스 || {});
  const bg = B.배경[s.background];
  applyRaw(s, bg.보너스 || {});
  s.stressMult = bg.스트레스배율 || 1;
  // 잠재력
  const potBonus = bg.잠재력보너스 || 0;
  for (const k of SKILLS) s.pot[k] = Math.min(100, randInt(s, st.잠재력_최소, st.잠재력_최대) + potBonus);
  // 성향
  const sc = { 야망형: 0, 워라밸형: 0, 장인형: 0, 모험형: 0 };
  (opt.answers || []).forEach((ai, qi) => {
    const c = B.성향_문답[qi]?.선택[ai];
    if (c) for (const k in c.점수) sc[k] += c.점수[k];
  });
  s.traitScores = sc;
  const max = Math.max(...Object.values(sc));
  s.trait = pick(s, Object.keys(sc).filter((k) => sc[k] === max));
  // 동기 2명
  const names = shuffle(s, PEER_NAMES);
  for (let i = 0; i < 2; i++) s.peers.push({ name: names[i], rank: '사원', yearsInRank: 0, salary: 0, job: pick(s, Object.keys(B.직군)) });
  // 취업 준비생으로 시작
  s.jobless = { reason: '취준', halves: 0, lastSalary: 0 };
  startYear(B, E, s);
  return s;
}

function makeCompanyName(B, s) {
  return '(주)' + pick(s, B.회사.이름_앞) + pick(s, B.회사.이름_뒤);
}
// 첫 취업·재취업 때 회사 규모: 대기업은 스펙이 좋아야 드물게
function specScore(s) { return s.stats.실무력 + s.stats.소통력 + s.stats.트렌드; }
function pickSize(B, s, smallOnly) {
  if (smallOnly) return rand(s) < 0.6 ? '스타트업' : '중견';
  const F = B.첫취업;
  const first = s.jobless?.reason === '취준' || !s.history.some((h) => h.company !== '구직 중');
  let big = first ? (F.대기업확률[s.background] ?? 10) + Math.max(0, specScore(s) - F.합격_스펙기준) * F.대기업_스펙계수
    : (B.재취업_대기업확률 ?? 10) + s.stats.업계평판 / 3;
  big = clamp(big, 0, 60);
  const r = rand(s) * 100;
  if (r < big) return '대기업';
  if (r < big + F.중견확률) return '중견';
  return '스타트업';
}
function makeOffers(B, s, n, from, smallOnly) {
  const out = [];
  const used = new Set();
  while (out.length < n) {
    const type = pick(s, B.회사.유형);
    const size = from ? pick(s, B.회사.규모) : pickSize(B, s, smallOnly);
    if (used.has(type + size)) { if (used.size > 40) break; continue; }
    used.add(type + size);
    const base = Math.round(B.회사.초봉[type][size] * B.직군[s.job].연봉배율);
    let salary = base;
    let rank = s.rank;
    if (from) {
      const H = B.헤드헌터;
      const pct = H.기본인상 + Math.min(H.최대인상 - H.기본인상, Math.max(0, (s.stats.업계평판 - 30) / 4));
      const raised = Math.round(from * (1 + pct / 100));
      const rankBoost = Math.pow(1.12, B.직급[s.rank].높이 - 1);
      salary = Math.max(raised, Math.round(base * rankBoost));
      if (s.stats.업계평판 >= H.직급업_평판 && chance(s, H.직급업_확률) && NEXT_RANK[s.rank] && !(s.rank === '과장')) {
        rank = NEXT_RANK[s.rank];
        salary = Math.round(salary * 1.1);
      }
    }
    const mood = shuffle(s, B.회사.분위기[type]).slice(0, 2);
    out.push({ name: makeCompanyName(B, s), type, size, salary, rank, mood });
  }
  return out;
}
function newBoss(B, s) {
  const prev = s.boss?.type;
  let type;
  do { type = pickWeighted(s, B.상사.유형, B.상사.가중치); } while (type === prev && rand(s) < 0.7);
  s.boss = { type, trust: 50, line: false };
}

export function chooseCompany(B, E, s, idx) {
  const o = s.offers[idx];
  const wasJobless = !!s.jobless;
  s.company = { name: o.name, type: o.type, size: o.size, state: B.회사.상태_시작[o.size] };
  s.salary = o.salary;
  if (o.rank !== s.rank) { s.rank = o.rank; s.yearsInRank = 0; bumpMaxRank(B, s); }
  s.yearsInCompany = 0;
  s.companyLowYears = 0;
  s.stats.사내입지 = B.시작.사내입지;
  newBoss(B, s);
  s.offers = null;
  s.log.push(`${s.year}년 ${o.name} 입사 (${o.type} · ${o.size})`);
  if (s.careerYears > 0 || (wasJobless && s.jobless?.reason !== '취준')) s.moves += 1;
  s.jobless = null;
  if (s.phase === 'company' && s.yearStart == null) { startYear(B, E, s); return; }
  // 연중(구직 성공) 입사: 다음 반기로 이어감
  s.after = s.half === 1 ? 'half2' : 'shop';
  s.phase = 'turn';
  proceed(B, E, s);
}

// ---------- 연도 시작 ----------
function startYear(B, E, s) {
  s.yearStart = { stats: { ...s.stats }, hp: s.hp, money: s.money, salary: s.salary };
  s.gradePts = 0; s.yearCards = {}; s.yearBuys = 0; s.unpaid = false; s.leaveThisYear = 0;
  s.half = 1; s.queue = [];
  // 시대 이벤트
  for (const er of B.시대이벤트) if (er.연도 === s.year) {
    s.queue.push({ news: er });
    if (er.회사상태 && s.company) s.company.state = clamp(s.company.state + er.회사상태, 0, 100);
  }
  // 지난해에 정해진 위기
  if (s.crisisNext) { s.queue.push({ id: s.crisisNext }); s.crisisNext = null; }
  // 올해 연간 이벤트 계획
  s.planned = { 1: [], 2: [] };
  if (!s.jobless) {
    const P = B.이벤트확률;
    const plan = (cat, pct) => { if (chance(s, pct)) { const ev = pickEvent(B, E, s, cat); if (ev) s.planned[randInt(s, 1, 2)].push(ev.id); } };
    plan('직군', P.직군_연);
    plan('회사', P.회사유형_연);
    plan('상사', P.상사_연[s.boss.type] ?? P.상사_연.그외);
    plan('동기', P.동기_연);
  }
  s.after = 'turn';
  proceed(B, E, s);
}

function eligible(B, s, ev) {
  if (s.seen[ev.id] && !(ev.반복 && s.seen[ev.id] < 2)) return false;
  if (ev.직군 && ev.직군 !== s.job) return false;
  if (ev.회사유형 && ev.회사유형 !== s.company?.type) return false;
  if (ev.규모 && ev.규모 !== s.company?.size) return false;
  if (ev.상사 && ev.상사 !== s.boss?.type) return false;
  if (ev.최소직급 && B.직급[s.rank].높이 - 1 < ev.최소직급) return false;
  if (ev.조건_동기승진 && !s.peers.some((p) => B.직급[p.rank].높이 > B.직급[s.rank].높이)) return false;
  return true;
}
function pickEvent(B, E, s, cat) {
  const pool = E.이벤트.filter((e) => e.분류 === cat && eligible(B, s, e) && (!e.희귀 || rand(s) < e.희귀));
  if (!pool.length) return null;
  return pick(s, pool);
}

// ---------- 흐름 제어 ----------
function proceed(B, E, s) {
  if (s.ending) { s.phase = 'ending'; return; }
  if (s.queue.length) {
    const q = s.queue.shift();
    if (q.id) s.seen[q.id] = (s.seen[q.id] || 0) + 1;
    s.current = q; s.result = null; s.phase = 'event';
    return;
  }
  s.current = null;
  const a = s.after;
  if (a === 'turn') { drawCards(B, s); s.phase = 'turn'; return; }
  if (a === 'half2') { s.half = 2; s.after = 'turn'; drawCards(B, s); s.phase = 'turn'; return; }
  if (a === 'shop') { s.phase = 'shop'; return; }
  if (a === 'offers') {
    if (s.pendingOffers) { s.offers = s.pendingOffers; s.pendingOffers = null; s.phase = 'offers'; return; }
    s.after = 'nextyear'; return proceed(B, E, s);
  }
  if (a === 'nextyear') { s.after = null; startYear(B, E, s); return; }
  if (a === 'company') { s.phase = 'company'; return; }
}

function drawCards(B, s) {
  if (s.leaveHalves > 0) { s.cards = [{ id: 'leave', 이름: '쉬어가기', 설명: '휴직 중이에요. 이번 반기는 쉬어갑니다.', 효과: {} }]; return; }
  if (s.jobless) { s.cards = B.구직카드.slice(); return; }
  const lvl = B.직급[s.rank].높이 - 1;
  const pool = B.행동카드.filter((c) => c.사용 !== false && (!c.최소직급 || lvl >= c.최소직급) && !(c.야근 && s.hp <= B.임계치.체력_야근불가));
  s.cards = shuffle(s, pool).slice(0, 3);
}
export function repeatCount(s, id) {
  let n = 0;
  for (let i = s.cardHist.length - 1; i >= 0 && s.cardHist[i] === id; i--) n++;
  return n;
}

// ---------- 효과 적용 ----------
function applyRaw(s, eff) {
  for (const k in eff) {
    const v = eff[k];
    if (k === '체력') s.hp += v;
    else if (k === '체력최대') s.hpMax += v;
    else if (k === '돈') s.money += v;
    else if (k in s.stats) s.stats[k] += v;
  }
  normalize(s);
}
function normalize(s) {
  for (const k of CLAMP100) s.stats[k] = clamp(s.stats[k], 0, 100);
  s.hpMax = clamp(s.hpMax, 30, 120);
  s.hp = clamp(s.hp, 0, s.hpMax);
}
function snapshot(s) {
  return { ...s.stats, 체력: s.hp, 돈: s.money, 체력최대: s.hpMax, 회사상태: s.company?.state ?? 0 };
}
export function diff(a, b) {
  const out = {};
  for (const k in b) { const d = Math.round((b[k] - a[k]) * 10) / 10; if (Math.abs(d) >= 0.5) out[k] = Math.round(d); }
  return out;
}
function stressUp(B, s, v) {
  return v * (1 - s.stats.멘탈 / 200) * (s.stressMult || 1);
}
// 이벤트·아이템 효과 (성장 배율 없음, 스트레스엔 멘탈 보정)
function applyEffects(B, s, eff) {
  for (const k in eff) {
    let v = eff[k];
    if (k === '스트레스' && v > 0) v = stressUp(B, s, v);
    if (k === '고과') { s.gradePts += v; continue; }
    if (k === '상사신뢰') { if (s.boss) s.boss.trust = clamp(s.boss.trust + v, 0, 100); continue; }
    if (k === '회사상태') { if (s.company) s.company.state = clamp(s.company.state + v, 0, 100); continue; }
    applyRaw(s, { [k]: v });
  }
  normalize(s);
}
function growthMult(B, s, card, k) {
  const M = B.배율;
  let m = 1;
  if (M.나이[k]) m *= M.나이[k][ageIdx(s.age)];
  if (card.성향 && card.성향[s.trait]) m *= card.성향[s.trait];
  const ct = M.회사유형[s.company?.type] || {};
  if (ct[k]) m *= ct[k];
  const bm = M.상사[s.boss?.type] || {};
  if (bm.전체) m *= bm.전체;
  if (bm[k]) m *= bm[k];
  const rep = repeatCount(s, card.id);
  if (rep >= 2) m *= M.반복_3연속; else if (rep === 1) m *= M.반복_2연속;
  if (s.pot[k] != null) {
    const gap = s.pot[k] - s.stats[k];
    if (gap <= 0) m = 0; else if (gap <= M.상한근처_범위) m *= M.상한근처_배율;
  }
  if (s.stats.스트레스 >= B.임계치.스트레스_지침) m *= M.스트레스70_성장배율;
  if (s.growthBoost && s.growthBoost.until >= s.year) m *= s.growthBoost.mult;
  if (card.자기계발 && s.buffs.lecture) m *= 1.3;
  if (k === '트렌드' && s.year >= 2028) m *= M.AI시대_트렌드카드;
  return m;
}
function applyCard(B, s, card) {
  const eff = card.효과 || {};
  for (const k in eff) {
    let v = eff[k];
    if (SKILLS.includes(k) && v > 0) v *= growthMult(B, s, card, k);
    else if (k === '업계평판' && v > 0) v *= ((B.배율.회사유형[s.company?.type] || {}).업계평판 || 1) * (B.직군[s.job].평판성장배율 || 1);
    else if (k === '체력' && v < 0 && s.buffs.chair) v *= 0.8;
    else if (k === '스트레스' && v > 0 && card.id === 'overtime' && s.items.pet) v += 3;
    if (k === '스트레스' && v > 0) v = stressUp(B, s, v);
    if (k === '고과') { s.gradePts += v; continue; }
    if (k === '상사신뢰') { if (s.boss) s.boss.trust = clamp(s.boss.trust + v, 0, 100); continue; }
    applyRaw(s, { [k]: v });
  }
  if (card.자기계발 && s.buffs.lecture) s.buffs.lecture = false;
}

// ---------- 행동 선택 ----------
export function chooseAction(B, E, s, cardId) {
  const before = snapshot(s);
  let card;
  if (cardId === 'leave') {
    s.leaveHalves -= 1; s.leaveThisYear += 1;
    if (s.healthRecover) { s.hp = Math.max(s.hp, B.임계치.건강악화_회복체력); s.healthRecover = false; }
    card = { id: 'leave', 이름: '쉬어가기', 효과: { 체력: 8, 스트레스: -8 } };
    applyRaw(s, card.효과);
  } else {
    card = cardId === 'normal' ? B.평소처럼 : (s.cards.find((c) => c.id === cardId) || B.구직카드.find((c) => c.id === cardId));
    applyCard(B, s, card);
    s.cardHist.push(card.id);
    s.yearCards[card.id] = (s.yearCards[card.id] || 0) + 1;
    s.choiceCount += 1;
    if (card.성향 && card.성향[s.trait] > 1) s.traitMatch += 1;
    if (card.성향 && card.성향[s.trait] < 1) s.traitMatch -= 0.5;
  }
  s.lastAction = { name: card.이름, deltas: diff(before, snapshot(s)) };
  const half = s.half;
  s.queue = [];

  if (s.jobless) {
    s.jobless.halves += 1;
    const J = B.구직;
    const F = B.첫취업;
    const fresh = s.jobless.reason === '취준';
    const pct = fresh
      ? F.합격_기본확률 + (specScore(s) - F.합격_스펙기준) * F.합격_스펙계수 + (card.구직보너스 || 0)
      : J.기본확률 + s.stats.실무력 * J.실무력계수 + s.stats.업계평판 * J.업계평판계수 + (card.구직보너스 || 0);
    const lastTry = fresh && s.jobless.halves >= F.최대반기;
    if (chance(s, pct) || lastTry) {
      const msg = lastTry ? '지원서만 수십 장. 드디어 작은 회사 한 곳에서 연락이 왔다.' : fresh ? '최종 합격 문자가 왔다! 입사할 회사를 골라요.' : '면접 본 회사에서 연락이 왔다! 입사할 회사를 골라요.';
      s.queue.push({ notice: { 이름: '합격 연락', 상황: msg } });
      const base = s.jobless.lastSalary || 0;
      s.offers = makeOffers(B, s, lastTry ? 1 : fresh ? F.제안수 : 2, null, lastTry).map((o) => ({ ...o, salary: Math.max(o.salary, Math.round(base * J.재취업_연봉배율)) }));
      s.after = 'company';
      return proceed(B, E, s);
    }
    if (!fresh && s.jobless.halves >= J.최대년수 * 2) {
      s.ending = s.jobless.reason === '부도' ? 'END-F4' : 'END-F2';
      return finalize(B, s, 'fixed');
    }
  } else if (cardId !== 'leave') {
    // 일상 이벤트 + 연간 계획 이벤트
    const list = (s.planned?.[half] || []).filter((id) => { const ev = eventById(E, id); return ev && eligible(B, s, ev); });
    if (chance(s, B.이벤트확률.일상_반기)) { const ev = pickEvent(B, E, s, '일상'); if (ev && !list.includes(ev.id)) list.unshift(ev.id); }
    for (const id of list.slice(0, B.이벤트확률.반기당_최대)) s.queue.push({ id });
  }
  checkThresholds(B, s);
  s.after = half === 1 ? 'half2' : 'shop';
  proceed(B, E, s);
}

function checkThresholds(B, s) {
  const T = B.임계치;
  if (s.hp <= 0) {
    s.healthHits += 1;
    if (s.healthHits >= T.건강악화_엔딩횟수) { s.ending = 'END-F5'; return finalize(B, s, 'fixed'); }
    s.queue.unshift({ id: 'HEALTH' });
    s.healthRecover = true;
    s.hp = 1;
  }
  if (s.jobless) return;
  if (s.stats.스트레스 >= T.스트레스_번아웃 && s.burnoutYear !== s.year) {
    s.burnoutYear = s.year; s.queue.unshift({ id: 'CR01' });
  } else if (s.stats.스트레스 >= T.스트레스_번아웃경고 && s.warnedYear !== s.year && s.burnoutYear !== s.year) {
    s.warnedYear = s.year; s.queue.push({ id: 'CR00' });
  }
}

// ---------- 이벤트 선택 ----------
export function chooseEventOption(B, E, s, idx) {
  const cur = s.current;
  if (cur.news || cur.notice) { s.result = null; s.current = null; return proceed(B, E, s); }
  const ev = eventById(E, cur.id);
  const opt = eventChoices(E, ev)[idx];
  const before = snapshot(s);
  let success = true, judged = false;
  if (opt.판정) { judged = true; success = rand(s) * 100 < judgeChance(B, s, opt.판정, ev); }
  let eff = { ...(opt.효과 || {}) };
  const add = judged ? (success ? opt.성공 : opt.실패) : null;
  if (add) for (const k in add) eff[k] = (eff[k] || 0) + add[k];
  if (ev.상사 === '감정기복형' && ev.공통선택지) for (const k in eff) eff[k] = Math.round(eff[k] * (0.8 + rand(s) * 0.4));
  applyEffects(B, s, eff);
  const sp = { ...(opt.특수 || {}), ...((judged ? (success ? opt.성공특수 : opt.실패특수) : null) || {}) };
  // 공 가로채기형: 윗선에 알리기 성공 시 상사 교체
  if (ev.id === 'BS03' && idx === 2 && success) { sp.상사교체 = true; applyRaw(s, { 사내입지: 6 }); }
  applySpecial(B, s, sp);
  const text = judged && !success ? (opt.실패결과 || opt.결과) : opt.결과;
  if (s.ending) { s.phase = 'event'; s.current = cur; }
  s.result = { text, deltas: diff(before, snapshot(s)), success, judged };
  if (!s.ending) checkThresholds(B, s);
}
export function ackResult(B, E, s) {
  s.result = null; s.current = null;
  proceed(B, E, s);
}

function applySpecial(B, s, sp) {
  if (sp.피한상사 && s.boss) s.avoidedBosses.push(s.boss.type);
  if (sp.플래그) s.flags[sp.플래그] = true;
  if (sp.상사교체) newBoss(B, s);
  if (sp.성장부스트) s.growthBoost = { mult: sp.성장부스트, until: s.year + 1 };
  if (sp.라인 && s.boss) s.boss.line = true;
  if (sp.헤드헌터부스트) s.hhBoost += sp.헤드헌터부스트;
  if (sp.헤드헌터강제) s.hhForce = true;
  if (sp.휴직반기) s.leaveHalves += sp.휴직반기;
  if (sp.위기극복 && s.crisisOvercameYear !== s.year) { s.crisisOvercameYear = s.year; s.stats.멘탈 = clamp(s.stats.멘탈 + B.위기.위기극복_멘탈, 0, 100); }
  if (sp.미지급) s.unpaid = true;
  if (sp.위로금) s.money += Math.round(s.salary * sp.위로금);
  if (sp.승진) promote(B, s, sp.승진, 'manager');
  if (sp.트랙) s.track = sp.트랙;
  if (sp.실직) {
    s.jobless = { reason: sp.실직, halves: 0, lastSalary: s.salary };
    s.everJobless = true;
    s.log.push(`${s.year}년 ${s.company?.name} 퇴사 (${sp.실직})`);
    s.company = null; s.boss = null; s.salary = 0; s.leaveHalves = 0;
    s.queue = s.queue.filter((q) => q.news); // 남은 회사 이벤트는 취소
  }
  if (sp.엔딩) { s.ending = sp.엔딩; finalize(B, s, 'fixed'); }
}

function bumpMaxRank(B, s) {
  if (B.직급[s.rank].높이 > B.직급[s.maxRank].높이) s.maxRank = s.rank;
}
function promote(B, s, to, track) {
  const P = B.승진확률;
  s.rank = to; s.yearsInRank = 0; s.failPromo = 0;
  if (track) s.track = track;
  s.salary = Math.round(s.salary * (1 + (to === '임원' ? P.임원연봉인상 : P.연봉인상) / 100));
  bumpMaxRank(B, s);
  s.log.push(`${s.year}년 ${to} 승진`);
}

// ---------- 상점 ----------
export function buysLeft(B, s) {
  return Math.max(0, (B.상점_연간구매횟수 ?? 99) - (s.yearBuys || 0));
}
export function canBuy(B, s, item) {
  if (buysLeft(B, s) <= 0) return false;
  if (s.money < item.가격) return false;
  if (!item.소모품 && s.items[item.id]) return false;
  return true;
}
export function buyItem(B, s, id) {
  const it = B.상점.find((x) => x.id === id);
  if (!it || !canBuy(B, s, it)) return null;
  const before = snapshot(s);
  s.money -= it.가격;
  s.yearBuys = (s.yearBuys || 0) + 1;
  if (it.즉시) applyEffects(B, s, it.즉시);
  if (it.버프) s.buffs[it.버프] = true;
  if (!it.소모품) s.items[it.id] = { years: 0, value: it.id === 'house' ? it.가격 : undefined };
  return diff(before, snapshot(s));
}

// ---------- 연말 정산 ----------
export function endYear(B, E, s) {
  const rep = { year: s.year, age: s.age, awards: [], notes: [] };
  const before = { ...s.yearStart.stats };
  const BC = B.연말_기본변화;
  const st = s.company ? companyStatus(B, s.company.state) : null;

  // 1) 기본 변화
  let dStress = 0, dHp = 0;
  if (s.company) {
    dStress += BC.스트레스_회사유형[s.company.type] || 0;
    dHp += BC.체력_회사유형[s.company.type] || 0;
    dStress += BC.스트레스_상사[s.boss.type] ?? BC.스트레스_상사.그외;
    if (st === '경고') dStress += BC.스트레스_회사경고;
    if (st === '위기') dStress += BC.스트레스_회사위기;
    if (s.track === 'manager') dStress += BC.스트레스_관리자;
    if (isMismatch(B, s)) dStress += BC.스트레스_성향불일치;
    dStress += B.직군[s.job].연말스트레스 || 0;
    dHp += B.직군[s.job].연말체력 || 0;
  }
  if (s.year >= 2034 && s.trait === '워라밸형') dStress -= 3;
  if (dStress > 0) dStress = stressUp(B, s, dStress);
  s.stats.스트레스 += dStress + BC.연말휴가_스트레스;
  s.hp += dHp + BC.연말휴가_체력;
  // 아이템 연간 효과·유지비
  let upkeep = 0;
  for (const id in s.items) {
    const it = B.상점.find((x) => x.id === id);
    const own = s.items[id];
    if (it.연간 && (!it.기간 || own.years < it.기간)) applyEffects(B, s, it.연간);
    own.years += 1;
    if (it.유지비) upkeep += it.유지비;
    if (it.변동) own.value = Math.round(own.value * (1 + randInt(s, it.변동[0], it.변동[1]) / 100));
  }
  normalize(s);

  // 2) 자연 감소
  const D = B.연말_자연감소;
  s.stats.트렌드 += D.트렌드[ageIdx(s.age)];
  if (s.track === 'manager') s.stats.실무력 += D.관리자_실무력;
  let hpMaxLoss = s.age >= 50 ? D.체력최대_50대 : s.age >= 40 ? D.체력최대_40대 : 0;
  s.hpMax += hpMaxLoss;
  normalize(s);

  // 3) 고과
  let grade = null;
  if (s.company) {
    const G = B.고과;
    const score = competence(B, s);
    let exp = B.직급[s.rank].기대치;
    if (s.year >= 2039 && s.track === 'expert') exp += 3;
    let bossMod = G.상사보정[s.boss.type];
    if (s.boss.type === '감정기복형') bossMod = randInt(s, -G.감정기복_범위, G.감정기복_범위);
    else if (s.boss.type === '정치형') bossMod = s.boss.line ? G.상사보정.정치형_라인 : G.상사보정.정치형;
    else if (bossMod == null) bossMod = G.상사보정.그외;
    const d = score - exp + bossMod + s.gradePts * B.배율.고과점수_반영비율 + (s.boss.trust - 50) * G.상사신뢰_반영;
    const T = G.등급기준;
    grade = d >= T.S ? 'S' : d >= T.A ? 'A' : d >= T.B ? 'B' : d >= T.C ? 'C' : 'D';
    if (s.boss.type === '공 가로채기형' && (grade === 'S' || grade === 'A') && chance(s, G.공가로채기_강등확률 * 100)) {
      grade = GRADE_ORDER[GRADE_ORDER.indexOf(grade) + 1];
      rep.notes.push('상사가 내 성과 일부를 가져갔다. 고과가 한 등급 내려갔다.');
    }
    if (s.leaveThisYear >= 2) grade = 'B';
    s.stats.사내입지 += G.등급효과_사내입지[grade];
    if (grade === 'C' || grade === 'D') s.stats.사내입지 += D.고과C이하_사내입지;
    s.gradeHist.push(grade); s.lastGrade = grade;
    rep.score = Math.round(score); rep.expect = exp; rep.diff = Math.round(d);
  }
  rep.grade = grade;
  normalize(s);

  // 4) 수상
  if (s.company) awards(B, s, grade, rep);

  // 5) 연봉 지급
  const L = B.연봉;
  const living = s.jobless?.reason === '취준' ? B.첫취업.생활비 : Math.max(L.생활비최소, Math.round((s.salary || 0) * L.생활비비율));
  let pay = s.salary;
  if (s.leaveThisYear >= 2) pay *= L.휴직_지급비율; else if (s.leaveThisYear === 1) pay *= 0.75;
  if (s.unpaid) { pay *= 1 - B.위기.월급밀림_미지급비율; rep.notes.push('월급이 밀려 연봉 일부를 받지 못했다.'); }
  let bonus = 0;
  if (s.company && st === '호황' && (grade === 'S' || grade === 'A')) {
    bonus = Math.round(s.salary * randInt(s, L.호황성과급_최소, L.호황성과급_최대) / 100);
  }
  const moneyBefore = s.money;
  s.money += Math.round(pay + bonus - living - upkeep);
  rep.pay = Math.round(pay); rep.bonus = bonus; rep.living = living; rep.upkeep = upkeep;
  rep.moneyDelta = s.money - moneyBefore;
  if (s.money < 0) { s.stats.스트레스 += stressUp(B, s, B.돈마이너스_스트레스); rep.notes.push('통장이 마이너스다. 스트레스가 쌓인다.'); normalize(s); }

  // 6) 인상률
  const oldSalary = s.salary;
  if (s.company && grade) {
    let r = L.인상률[grade];
    if (st === '경고' || st === '위기') r = Math.min(r, 0);
    else if (st === '호황') r += L.호황보정;
    if (s.extended) r = 0;
    s.salary = Math.round(s.salary * (1 + r / 100));
    rep.raise = r;
  }

  // 7) 승진 심사
  s.postQueue = [];
  if (s.company && !s.extended) promotionReview(B, s, grade, rep);
  rep.salaryNext = s.salary; rep.salaryOld = oldSalary;

  // 8) 회사 상태
  if (s.company) {
    const C = B.회사;
    let dc = randInt(s, -C.상태_연간랜덤, C.상태_연간랜덤);
    dc += GRADE_SCORE[grade] * (RANK_COEF[s.rank] || 1) * (s.company.size === '스타트업' ? 2 : 1);
    const off = 50 - s.company.state;
    dc += Math.sign(off) * Math.min(C.상태_평균회귀, Math.abs(off) / 5);
    s.company.state = clamp(Math.round(s.company.state + dc), 0, 100);
    rep.companyState = s.company.state; rep.companyStatus = companyStatus(B, s.company.state);
  }

  // 9) 대체 가능성
  const rs = replaceScore(B, s);
  rep.replace = replaceGrade(B, rs);
  s.replaceDangerYears = rep.replace === '위험' ? s.replaceDangerYears + 1 : 0;

  // 10) 스트레스 누적
  if (s.stats.스트레스 >= B.임계치.스트레스_지침) s.stressHighYears += 1; else s.stressHighYears = 0;
  s.stressSum += s.stats.스트레스; s.stressCount += 1;

  // 11) 위기 판정 (다음 해 초에 발생, 한 해에 하나)
  if (s.company) decideCrisis(B, s, rep);

  // 12) 동기
  for (const p of s.peers) {
    p.yearsInRank += 1;
    if (!p.salary) p.salary = Math.round(B.회사.초봉.인하우스.중견 * B.직군[p.job].연봉배율);
    p.salary = Math.round(p.salary * 1.04);
    const nx = NEXT_RANK[p.rank];
    if (nx && p.yearsInRank >= 3 && rand(s) < 0.45 && !(p.rank === '과장' && rand(s) < 0.4)) {
      p.rank = nx; p.yearsInRank = 0; p.salary = Math.round(p.salary * 1.12);
    }
  }
  rep.peers = s.peers.map((p) => ({ name: p.name, rank: p.rank, salary: p.salary }));

  // 13) 헤드헌터
  s.pendingOffers = null;
  if (s.company && !s.extended) {
    const H = B.헤드헌터;
    let pct = H.기본확률 + s.hhBoost;
    if (s.stats.실무력 >= 60) pct += H.실무력60;
    if (s.job === '개발자') pct += H.개발자;
    if (s.failPromoFlag) pct += H.승진누락;
    if (st === '경고' || st === '위기') pct += H.회사경고;
    if (s.moves >= H.이직많음_기준) pct += H.이직많음;
    if (s.year >= 2031 && s.year <= 2032) pct -= 10;
    if (s.hhForce || chance(s, pct)) s.pendingOffers = makeOffers(B, s, H.제안수, s.salary);
    s.hhForce = false; s.hhBoost = 0; s.failPromoFlag = false;
  }

  // 14) 기록
  s.history.push({ year: s.year, age: s.age, rank: s.rank, grade, salary: s.salary, stats: { ...s.stats }, company: s.company?.name || '구직 중' });
  if (s.yearsInCompany != null) s.yearsInCompany += 1;
  rep.statsBefore = before;
  rep.statsAfter = { ...s.stats };
  rep.standingLine = standingLine(s.stats.사내입지);
  rep.comment = s.boss ? bossComment(s.boss.type, grade) : null;
  rep.mustRetire = s.age >= (s.extended ? B.시작.연장근무_최대나이 : B.시작.정년);
  rep.canExtend = rep.mustRetire && !s.extended && s.year >= 2045 && s.company && s.age < B.시작.연장근무_최대나이;
  if (s.extended && s.age >= B.시작.연장근무_최대나이) rep.canExtend = false;
  s.report = rep;
  s.phase = 'report';
}

function isMismatch(B, s) {
  const m = B.성향불일치[s.trait];
  if (!m) return false;
  if (m.회사유형 && m.회사유형.includes(s.company?.type)) return true;
  if (m.트랙 && m.트랙 === s.track) return true;
  if (m.규모 && m.규모 === s.company?.size) return true;
  return false;
}

function awards(B, s, grade, rep) {
  const A = B.수상;
  const give = (name, eff) => { rep.awards.push(name); s.awards.push({ year: s.year, name }); applyEffects(B, s, eff || {}); };
  if (grade === 'S' && chance(s, A.우수사원상.확률)) give('우수사원상', A.우수사원상.효과);
  if (s.careerYears === 0 && (grade === 'S' || grade === 'A') && chance(s, A['올해의 신입상'].확률)) give('올해의 신입상', A['올해의 신입상'].효과);
  const J = A['올해의 직군상'];
  if (s.stats.실무력 >= J.실무력 && s.stats.업계평판 >= J.업계평판 && chance(s, (s.stats.업계평판 - 55) * 2)) give(`올해의 ${s.job}상`, J.효과);
  const IT = A['올해의 IT인'];
  if ((s.stats.실무력 >= IT.능력치 || s.stats.리더십 >= IT.능력치) && s.stats.업계평판 >= IT.업계평판 && grade === 'S' && chance(s, IT.확률)) { give('올해의 IT인', IT.효과); s.itAwards += 1; }
  if ((s.yearCards.overtime || 0) >= 2) give('야근왕');
  if ((s.yearCards.rest || 0) >= 2) give('칼퇴의 달인');
}

function promotionReview(B, s, grade, rep) {
  s.yearsInRank += 1;
  const P = B.승진확률;
  const rules = B.승진.filter((r) => r.from === s.rank && (!r.트랙 || s.track === 'common' || s.track === r.트랙));
  const last3 = s.gradeHist.slice(-3);
  const minus = s.company.size === '스타트업' ? P.스타트업_최소년수감소 : 0;
  let reviewed = false;
  for (const r of rules) {
    if (s.rank === '과장' && r.트랙 === 'manager' && s.track === 'expert') continue;
    if (s.yearsInRank < r.최소년수 - minus) continue;
    if (r.역량점수 && competence(B, s) < r.역량점수) continue;
    if (r.조건 && Object.keys(r.조건).some((k) => s.stats[k] < r.조건[k])) continue;
    const need = GRADE_ORDER.indexOf(r.고과);
    if (last3.filter((g) => GRADE_ORDER.indexOf(g) <= need).length < r.고과횟수) continue;
    if (grade === 'C' || grade === 'D') continue;
    reviewed = true;
    let pct = P.기본 + (P.고과보정[grade] || 0) + (P.규모보정[s.company.size] || 0);
    if (s.boss.type === '멘토형') pct += P.멘토형;
    if (s.boss.line) pct += P.정치형_라인;
    if (r.트랙 === 'manager' || s.track === 'manager') pct += B.직군[s.job].관리자승진보정 || 0;
    if (chance(s, pct)) {
      if (r.to === '팀장') { s.postQueue.push({ id: 'TP02' }); rep.notes.push('팀장 제안이 들어올 것 같다.'); }
      else { promote(B, s, r.to, r.트랙 || null); rep.promoted = r.to; }
      return;
    }
  }
  if (reviewed) {
    s.failPromo += 1;
    rep.promoFailed = true;
    if (s.failPromo >= 2) {
      s.failPromo = 0; s.failPromoFlag = true;
      s.stats.스트레스 = clamp(s.stats.스트레스 + stressUp(B, s, P.누락_스트레스), 0, 100);
      s.postQueue.push({ id: 'TP06' });
    }
  }
}

function decideCrisis(B, s, rep) {
  const W = B.위기;
  const st = companyStatus(B, s.company.state);
  const big = s.company.size === '대기업';
  // 부도·폐업
  const lowLine = s.company.size === '스타트업' ? W.스타트업폐업_상태 : W.부도_상태;
  s.companyLowYears = s.company.state < lowLine ? s.companyLowYears + 1 : 0;
  if (!big && (s.companyLowYears >= 2 || (s.unpaid && chance(s, W.부도_이벤트확률)))) { s.crisisNext = 'CR06'; rep.notes.push('익명 게시판: "우리 회사 진짜 위험하대요..."'); return; }
  // 권고사직
  const rg = rep.replace;
  let rec = 0;
  if (st === '위기') rec = W.권고사직_회사위기 + (rg === '높음' ? W.권고사직_대체높음 : rg === '위험' ? W.권고사직_대체위험 : 0);
  else if (s.replaceDangerYears >= 2) rec = W.권고사직_평시위험2년;
  if (rec && chance(s, rec)) { s.crisisNext = 'CR07'; return; }
  // 번아웃 (3년 연속 70 이상)
  if (s.stressHighYears >= B.임계치.지침_연속년수_번아웃) { s.crisisNext = 'CR01'; s.stressHighYears = 0; return; }
  // 고립
  if (s.stats.사내입지 <= W.고립_사내입지) { s.crisisNext = 'CR03'; return; }
  // 월급 밀림
  if (!big && s.company.state < B.회사.상태구간.위기) {
    const weak = s.company.size === '스타트업' || (s.company.size === '중견' && ['SI', '에이전시'].includes(s.company.type));
    if (chance(s, weak ? W.월급밀림_취약확률 : W.월급밀림_확률)) { s.crisisNext = 'CR05'; return; }
  }
  // 명예퇴직
  if (s.age >= W.명예퇴직_나이 && !['임원', 'C레벨', '펠로우'].includes(s.rank) && (rg === '높음' || rg === '위험') && chance(s, W.명예퇴직_확률)) {
    s.postQueue.push({ id: 'TP07' });
  }
}

function standingLine(v) {
  if (v >= 80) return '회사에서 모르는 사람이 없다.';
  if (v >= 60) return '중요한 회의에는 꼭 불린다.';
  if (v >= 40) return '믿고 맡길 만한 사람으로 통한다.';
  if (v >= 20) return '아직은 존재감이 옅다.';
  return '요즘 회의 초대가 줄었다.';
}
function bossComment(type, grade) {
  const good = grade === 'S' || grade === 'A';
  const m = {
    멘토형: good ? '"올해 정말 많이 컸어요. 내년이 기대돼요."' : '"괜찮아요. 방향만 잡으면 금방 올라와요."',
    마이크로매니저: good ? '"보고서 형식만 조금 더 맞춰주면 완벽해요."' : '"제가 매일 체크한 이유를 아시겠죠?"',
    '공 가로채기형': good ? '"우리 팀이 잘했지. 내가 잘 이끌었고."' : '"이 정도면 내가 다 한 거지."',
    감정기복형: good ? '"올해 최고야! (아마도)"' : '"솔직히 실망이에요. 아니 뭐, 괜찮고."',
    방임형: '"수고했어요. 내년에도 알아서 잘..."',
    정치형: good ? '"윗분들이 자네 이름을 기억하더군."' : '"줄은 잘 서야 하는 거야."',
    꼰대형: good ? '"요즘 애들치고는 제법이야."' : '"우리 때는 말이야..."',
  };
  return m[type];
}

// ---------- 연말 이후 ----------
export function continueYear(B, E, s, choice) {
  if (choice === 'retire') return finalize(B, s, s.report?.mustRetire ? 'age' : 'retire');
  if (choice === 'extend') {
    s.extended = true;
    s.salary = Math.round(s.salary * B.시작.연장근무_연봉배율);
    s.log.push(`${s.year}년 연장 근무 시작`);
  }
  if (s.report?.mustRetire && choice !== 'extend') return finalize(B, s, 'age');
  if (s.company) s.careerYears += 1;
  s.year += 1; s.age += 1;
  s.report = null;
  if (s.boss && rand(s) < B.상사.교체_연확률) newBoss(B, s);
  s.queue = s.postQueue.slice(); s.postQueue = [];
  s.after = 'offers';
  proceed(B, E, s);
}

export function chooseOffer(B, E, s, action, idx) {
  if (action === 'accept') {
    const o = s.offers[idx];
    s.log.push(`${s.year}년 ${s.company.name} 퇴사 → 이직`);
    s.offers = [o];
    s.phase = 'company';
    s.yearStart = null;
    return chooseCompany(B, E, s, 0);
  }
  if (action === 'counter') {
    const H = B.헤드헌터;
    const ok = rand(s) * 100 < judgeChance(B, s, { 능력치: '정치력', 요구: 50 });
    if (ok) { s.salary = Math.round(s.salary * (1 + H.카운터오퍼_인상 / 100)); s.stats.사내입지 = clamp(s.stats.사내입지 + H.카운터오퍼_입지, 0, 100); }
    else s.stats.사내입지 = clamp(s.stats.사내입지 - 3, 0, 100);
    s.offerResult = ok ? '카운터오퍼 성공! 연봉이 올랐다. 대신 눈치가 보인다.' : '회사는 붙잡지 않았다. 그냥 남기로 했다.';
  }
  s.offers = null;
  s.after = 'nextyear';
  proceed(B, E, s);
}

export function goToYearEnd(B, E, s) { endYear(B, E, s); }

// ---------- 행복도·엔딩 ----------
export function happiness(B, s) {
  const H = B.행복도;
  const avg = s.stressCount ? s.stressSum / s.stressCount : s.stats.스트레스;
  const matchRate = s.choiceCount ? clamp(s.traitMatch / s.choiceCount, 0, 1) : 0.5;
  let v = H.기본 + (avg - H.스트레스평균_기준) * H.스트레스평균_계수 + (matchRate - 0.5) * H.성향일치_계수;
  v += clamp((netWorth(B, s) / 10000) * H.자산_1억당, -10, H.자산_최대);
  v += (s.hpMax - H.건강_기준체력최대) * 0.3 - s.healthHits * H.건강악화_감점;
  for (const id in s.items) { const it = B.상점.find((x) => x.id === id); if (it?.행복도) v += it.행복도; }
  return Math.round(clamp(v, 0, 100));
}
export function height(B, s) {
  return B.직급[s.maxRank].높이 * 10 + s.itAwards * B.엔딩.높이_IT인;
}
function finalize(B, s, reason) {
  const happy = happiness(B, s);
  const h = height(B, s);
  let id = s.ending;
  if (!id || reason !== 'fixed') {
    const early = reason === 'retire' && s.age < B.시작.정년;
    const nw = netWorth(B, s);
    if (!early) {
      if (s.flags.QA영웅 && s.job === 'QA') id = 'END-H1';
      else if (s.moves === 0 && !s.everJobless) id = 'END-H4';
      else {
        const [hi, mid] = B.엔딩.높이_상;
        const ok = happy >= B.엔딩.행복_기준;
        const expert = s.track === 'expert';
        if (h >= hi) id = ok ? (expert ? 'END-R2' : 'END-R1') : 'END-R3';
        else if (h >= mid) id = ok ? (expert ? 'END-R5' : 'END-R4') : 'END-R6';
        else id = ok ? 'END-R7' : 'END-R8';
      }
    } else {
      if (s.stats.업계평판 >= 70 && s.stats.소통력 >= 70) id = 'END-T2';
      else if (s.trait === '워라밸형' && nw >= 30000) id = 'END-T1';
      else if (nw >= 200000 && happy >= 60) id = 'END-S3';
      else if (nw >= 200000 && s.stats.스트레스 >= 70) id = 'END-E1';
      else if (s.careerYears <= 2) id = 'END-E3';
      else if ((s.company && companyStatus(B, s.company.state) === '위기') || s.stats.스트레스 >= 90 || s.stats.사내입지 <= 15 || s.jobless) id = 'END-E4';
      else id = 'END-E2';
    }
  }
  s.ending = id;
  s.endInfo = { id, happy, height: h, netWorth: netWorth(B, s), age: s.age, year: s.year, maxRank: s.maxRank };
  s.phase = 'ending';
  s.queue = []; s.current = null; s.result = null;
}
