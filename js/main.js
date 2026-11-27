// 하루살이 IT 인생 — 화면
import * as G from './engine.js';
import { simulate } from './sim.js';

const SAVE_KEY = 'haru.save.v1';
const BAL_KEY = 'haru.balance.override';
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet-root');
let B, E, ENDINGS, BASE_B;
let S = null; // 진행 중 게임 상태
let ui = { screen: 'landing', create: null, shopTab: '힐링', info: false, devOut: '' };

// ---------- 저장 ----------
const storage = (() => { try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch { return null; } })();
function save() { if (!storage || !S) return; try { storage.setItem(SAVE_KEY, JSON.stringify(S)); } catch {} }
function loadSave() {
  if (!storage) return { state: null };
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return { state: null };
  try { const st = JSON.parse(raw); if (!st || st.v !== 1 || !st.phase) throw 0; return { state: st }; } catch { return { state: null, broken: true }; }
}
function clearSave() { try { storage?.removeItem(SAVE_KEY); } catch {} }

// ---------- 유틸 ----------
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r0 = (v) => Math.round(v);
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2000);
}
const LABEL = { 트렌드: '트렌드 감각', 사내입지: '사내 입지', 업계평판: '업계 평판', 체력최대: '체력 최대치', 고과: '고과 점수', 상사신뢰: '상사 신뢰', 회사상태: '회사 상태' };
const lab = (k) => LABEL[k] || k;
function deltaChips(d) {
  const keys = Object.keys(d || {});
  if (!keys.length) return '<span class="chip">변화 없음</span>';
  return keys.map((k) => {
    const v = d[k];
    const good = k === '스트레스' ? v < 0 : v > 0;
    const val = k === '돈' ? G.formatMoney(v) : (v > 0 ? '+' : '') + v;
    return `<span class="chip ${good ? 'up' : 'down'} num">${esc(lab(k))} ${k === '돈' && v > 0 ? '+' : ''}${val}</span>`;
  }).join('');
}
function effPreview(eff) {
  return Object.entries(eff || {}).map(([k, v]) => {
    const good = k === '스트레스' ? v < 0 : v > 0;
    return `<span class="${good ? 'u' : 'd'}">${esc(lab(k))} ${v > 0 ? '▲' : '▼'}</span>`;
  }).join('');
}
const JOB_COLOR = { 기획자: 'var(--job-planner)', 개발자: 'var(--job-dev)', 디자이너: 'var(--job-designer)', QA: 'var(--job-qa)' };
const JOB_KEY = { 기획자: 'planner', 개발자: 'dev', 디자이너: 'designer', QA: 'qa' };
// 표정: 평소 / 지침(스트레스 70+ 또는 체력 30 이하) / 신남
function mood(s) {
  if (s.stats.스트레스 >= 70 || s.hp <= 30) return 'tired';
  if (s.lastGrade === 'S' || s.lastGrade === 'A' || s.stats.스트레스 <= 20) return 'happy';
  return '';
}
function sprite(job, m = '', scale = 3) {
  const src = `assets/char-${JOB_KEY[job] || 'planner'}${m ? '-' + m : ''}.png`;
  return `<img class="sprite" src="${src}" width="${18 * scale}" height="${21 * scale}" alt="${esc(job)} 캐릭터" />`;
}
function bubbleColor(s) {
  if (s.stats.스트레스 >= 90 || s.hp <= 15) return 'var(--stress)';
  if (s.stats.스트레스 >= 70 || s.hp <= 30) return 'var(--warn)';
  return 'var(--hp)';
}
function statusLine(s) {
  if (s.leaveHalves > 0) return '휴직 중 · 쉬는 중';
  if (s.stats.스트레스 >= 90) return '번아웃 직전…';
  if (s.hp <= 15) return '쓰러지기 일보 직전';
  if (s.stats.스트레스 >= 70) return '퇴사 각 재는 중';
  if (s.hp <= 30) return '체력이 바닥났어';
  if (s.lastGrade === 'S') return '요즘 날아다니는 중';
  if (s.money < 0) return '통장이 텅장…';
  return s.half === 1 ? '올해도 열일 모드' : '하반기도 버티는 중';
}
// Figma Office Map 좌표(1x 기준). 캐릭터 18×21, 화면에는 ×2
const SCENES = {
  중견: { img: 'office-mid', chars: { 기획자: [29, 48], 개발자: [65, 48], 디자이너: [112, 118], QA: [248, 132] } },
  스타트업: { img: 'office-startup', chars: { 기획자: [33, 104], 개발자: [69, 104], QA: [150, 50], 디자이너: [152, 118] } },
  대기업: { img: 'office-big', chars: { 기획자: [62, 92], QA: [134, 146], 개발자: [230, 74], 디자이너: [262, 74] } },
};
const SC = 2;
function office(s) {
  const sc = SCENES[s.company?.size] || SCENES.중견;
  const [x, y] = sc.chars[s.job] || [160, 100];
  const fresh = s.jobless?.reason === '취준';
  const where = s.jobless ? (fresh ? '취준생' : '구직 중') : `${s.careerYears + 1}년차 · ${esc(s.rank)}`;
  return `<div class="office" id="office"><div class="stage">
      <img class="bg pixel" src="assets/${sc.img}.png" width="640" height="400" alt="${esc(s.company?.size || '')} 사무실" />
      <div class="me" style="left:${x * SC}px;top:${y * SC}px">
        <div class="say"><i style="background:${bubbleColor(s)}"></i>${esc(statusLine(s))}</div>
        ${sprite(s.job, mood(s), SC)}
      </div>
      <div class="ohud">${s.year}년 · ${where}</div>
    </div></div>`;
}
function scrollOffice() {
  const o = document.getElementById('office'); const me = o?.querySelector('.me');
  if (o && me) o.scrollLeft = Math.max(0, me.offsetLeft + 18 - o.clientWidth / 2);
}

// 쉼표·가운뎃점으로 나눠 한 줄에 하나씩
function lines(text, icon, cls) {
  return String(text || '').split(/\s*(?:,(?!\d{3})|·)\s*(?![^()]*\))/).filter(Boolean)
    .map((x) => `<span class="line small ${cls}"><span class="ic">${icon}</span>${esc(x)}</span>`).join('');
}
// 능력치 육각형
function hexagon(stats, prev, size = 240) {
  const c = size / 2, R = size / 2 - 34;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i * Math.PI) / 3; return [c + Math.cos(a) * R * v / 100, c + Math.sin(a) * R * v / 100]; };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ');
  let g = '';
  for (const lv of [25, 50, 75, 100]) g += `<polygon points="${poly(G.SKILLS.map(() => lv))}" fill="none" stroke="#ddd8cc" stroke-width="1"/>`;
  G.SKILLS.forEach((_, i) => { const [x, y] = pt(i, 100); g += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" stroke="#ddd8cc"/>`; });
  if (prev) g += `<polygon points="${poly(G.SKILLS.map((k) => prev[k]))}" fill="none" stroke="#8a8478" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  g += `<polygon points="${poly(G.SKILLS.map((k) => stats[k]))}" fill="rgba(47,91,211,.22)" stroke="#2f5bd3" stroke-width="2"/>`;
  G.SKILLS.forEach((k, i) => {
    const [x, y] = pt(i, 128);
    const d = prev ? r0(stats[k]) - r0(prev[k]) : 0;
    const dt = prev && d ? `<tspan fill="${d > 0 ? '#1d6b3d' : '#9a2a20'}"> ${d > 0 ? '▲' : '▼'}${Math.abs(d)}</tspan>` : '';
    g += `<text x="${x}" y="${y - 6}" text-anchor="middle" font-size="12" fill="#6b665c">${lab(k)}</text><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="13" font-weight="700" fill="#22201c">${r0(stats[k])}${dt}</text>`;
  });
  return `<svg viewBox="-44 -14 ${size + 88} ${size + 28}" role="img" aria-label="역량 육각형">${g}</svg>`;
}
function gauge(name, v, max, color, warnAt, invert) {
  const warn = invert ? v <= warnAt : v >= warnAt;
  return `<div class="gauge ${warn ? 'warn shake' : ''}"><div class="lab"><span>${name}</span><b class="num">${r0(v)} / ${r0(max)}</b></div><div class="bar"><i style="width:${(v / 100) * 100}%;background:${warn && !invert ? 'var(--stress)' : color}"></i></div></div>`;
}

// ---------- 렌더 ----------
function render() {
  const fn = SCREENS[ui.screen];
  app.innerHTML = `<div class="screen">${fn()}</div>`;
  renderSheet();
  window.scrollTo({ top: 0 });
  scrollOffice();
}
function renderSheet() {
  let html = '';
  if (ui.screen === 'game' && S?.phase === 'event') html = eventSheet();
  else if (ui.info) html = infoSheet();
  else if (ui.confirm) html = confirmSheet();
  sheetRoot.innerHTML = html ? `<div class="sheet-bg">${html}</div>` : '';
}

const SCREENS = {
  landing() {
    const { state, broken } = loadSave();
    return `<div class="landing">
      ${!storage ? '<div class="banner">이 환경에서는 저장되지 않아요. 창을 닫으면 진행이 사라져요.</div>' : ''}
      ${broken ? '<div class="banner">저장 데이터가 손상돼서 불러올 수 없어요. 새로 시작해주세요.</div>' : ''}
      <div class="logo">하루살이 IT 인생<small>신입부터 정년까지</small></div>
      <div class="landing-office" aria-hidden="true"><img class="pixel" src="assets/office-mid.png" alt="" /></div>
      <p class="muted">신입부터 정년까지, 살아남을 수 있을까?</p>
      <div class="stack" style="margin-top:20px">
        <button class="btn primary block" data-act="new">새 커리어 시작</button>
        ${state && state.phase !== 'ending' ? `<button class="btn block" data-act="continue">이어하기 <span class="muted small">${esc(state.name)} · ${state.age}세 · ${state.year}년</span></button>` : ''}
        <button class="btn ghost block" data-act="dev">⚙︎ 개발자 설정 (수치 조정)</button>
      </div>
      <p class="muted small" style="margin-top:24px">프로토타입 v0.2</p>
    </div>`;
  },

  create() {
    const c = ui.create;
    const dots = [0, 1, 2, 3].map((i) => `<i class="${i === c.step ? 'on' : ''}"></i>`).join('');
    let body = '';
    if (c.step === 0) {
      body = `<h2>이름을 정해주세요</h2><p class="muted small">최대 8자. 비우면 랜덤 이름이 정해져요.</p>
        <input class="text-input" id="name" maxlength="8" value="${esc(c.name)}" placeholder="예: 김하루" autocomplete="off" />`;
    } else if (c.step === 1) {
      body = `<h2>직군을 골라주세요</h2><div class="choice-list">${Object.entries(B.직군).map(([k, v]) => `
        <button class="choice ${c.job === k ? 'on' : ''}" data-act="pickJob" data-v="${esc(k)}"><div class="pick-head">${sprite(k, '', 2)}<b>${esc(k)}</b></div>${lines(v.강점, '👍', '')}${lines(v.약점, '👎', 'muted')}</button>`).join('')}</div>`;
    } else if (c.step === 2) {
      body = `<h2>시작 배경</h2><div class="choice-list">${Object.entries(B.배경).map(([k, v]) => `
        <button class="choice ${c.background === k ? 'on' : ''}" data-act="pickBg" data-v="${esc(k)}"><b>${esc(k)}</b>${lines(v.설명, '•', '')}</button>`).join('')}</div>`;
    } else {
      body = `<h2>나는 어떤 사람일까?</h2><div class="stack">${B.성향_문답.map((q, qi) => `
        <div class="card"><h3>${qi + 1}. ${esc(q.질문)}</h3><div class="choice-grid">${q.선택.map((o, oi) => `
          <button class="choice ${c.answers[qi] === oi ? 'on' : ''}" data-act="pickAns" data-q="${qi}" data-v="${oi}">${esc(o.글)}</button>`).join('')}</div></div>`).join('')}</div>`;
    }
    const canNext = c.step === 0 || (c.step === 1 && c.job) || (c.step === 2 && c.background) || (c.step === 3 && c.answers.every((a) => a != null));
    return `<div class="create"><div class="steps">${dots}</div>${body}
      <div class="nav-row"><button class="btn" data-act="createBack">${c.step === 0 ? '처음으로' : '이전'}</button>
      <button class="btn primary" data-act="createNext" ${canNext ? '' : 'disabled'}>${c.step === 3 ? '입사 지원하기' : '다음'}</button></div></div>`;
  },

  game() {
    const s = S;
    if (s.phase === 'company') return companyScreen();
    if (s.phase === 'report') return reportScreen();
    if (s.phase === 'offers') return offersScreen();
    if (s.phase === 'ending') return endingScreen();
    return mainScreen();
  },

  dev() {
    const txt = storage?.getItem(BAL_KEY) || JSON.stringify(B, null, 2);
    const over = !!storage?.getItem(BAL_KEY);
    return `<div class="stack">
      <div class="row" style="justify-content:space-between"><h2>개발자 설정</h2><button class="btn" data-act="home">닫기</button></div>
      <div class="card stack">
        <p class="small muted">아래 숫자를 바꾸고 [적용]을 누르면 이 브라우저에서만 바뀐 값으로 플레이돼요. ${over ? '<b>지금 수정된 값을 쓰는 중이에요.</b>' : '지금은 기본값이에요.'} 영구 반영은 GitHub의 <code>data/balance.json</code>을 고치면 돼요.</p>
        <textarea class="json" id="baljson" spellcheck="false">${esc(txt)}</textarea>
        <div class="row"><button class="btn primary" data-act="devApply">적용</button><button class="btn" data-act="devReset">기본값으로 되돌리기</button></div>
      </div>
      <div class="card stack">
        <h3>자동 플레이 시뮬레이터</h3>
        <p class="small muted">컴퓨터가 여러 판을 대신 플레이해서 평균 결과를 보여줘요. 위에서 적용한 수치 기준이에요.</p>
        <div class="row"><select id="simStrategy" class="btn"><option>무작위</option><option>균형</option><option>야근만</option></select>
        <select id="simN" class="btn"><option value="100">100판</option><option value="300" selected>300판</option><option value="1000">1000판</option></select>
        <button class="btn primary" data-act="devSim">돌리기</button></div>
        ${ui.devOut ? `<pre class="out">${esc(ui.devOut)}</pre>` : ''}
      </div>
    </div>`;
  },
};

function hud(s) {
  const fresh = s.jobless?.reason === '취준';
  const comp = s.company ? `${esc(s.company.name)} <span class="muted">· ${esc(s.company.type)} · ${esc(s.company.size)}</span>` : `<span class="muted">${fresh ? '취업 준비 중' : '구직 중'}</span>`;
  return `<div class="hud"><div><div class="who">${esc(s.name)} · ${s.age}세 · ${fresh ? '취준생' : `${s.careerYears + 1}년차 · ${esc(s.rank)}`}</div><div class="meta">${s.year}년 · ${comp}</div></div>
    <div class="row"><button class="icon-btn" data-act="info" aria-label="내 정보">내 정보</button><button class="icon-btn" data-act="home" aria-label="처음 화면">⌂</button></div></div>`;
}
function statusPanel(s) {
  const st = s.company ? G.companyStatus(B, s.company.state) : '-';
  const rg = G.replaceGrade(B, G.replaceScore(B, s));
  return `<div class="card stack">
    <div class="desk"><div class="avatar-px">${sprite(s.job, mood(s), 3)}<span class="bubble" style="background:${bubbleColor(s)}"></span></div>
      <div><b><span class="job-dot" style="background:${JOB_COLOR[s.job]}"></span>${esc(s.job)}</b> <span class="muted small">${esc(s.background)} 출신</span><div class="small muted">${s.boss ? `상사: ${esc(s.boss.type)}` : '상사 없음'} · 회사 분위기: ${esc(st)}</div>
      <div class="small muted">${esc(B.성향_힌트[s.trait])}</div></div></div>
    ${gauge('체력', s.hp, s.hpMax, 'var(--hp)', 30, true)}
    ${gauge('스트레스', s.stats.스트레스, 100, 'var(--stress)', 70, false)}
    <div class="hex-wrap">${hexagon(s.stats, null)}</div>
    <div class="chips"><span class="chip num">💰 ${G.formatMoney(s.money)}</span><span class="chip num">연봉 ${G.formatMoney(s.salary)}</span>
      <span class="chip num">사내 입지 ${r0(s.stats.사내입지)}</span><span class="chip num">업계 평판 ${r0(s.stats.업계평판)}</span><span class="chip">대체 가능성 ${rg}</span></div>
  </div>`;
}
function phaseDots(s) {
  const names = ['연초', '상반기', '하반기', '상점', '연말'];
  const cur = s.phase === 'shop' ? 3 : s.half === 1 ? 1 : 2;
  return `<div class="phase-dots">${names.map((n, i) => `<span class="${i === cur ? 'on' : i < cur ? 'done' : ''}">${n}</span>`).join('')}</div>`;
}

function mainScreen() {
  const s = S;
  let right = '';
  if (s.phase === 'shop') right = shopPanel();
  else {
    const title = s.leaveHalves > 0 ? '휴직 중이에요' : s.jobless?.reason === '취준' ? `취업 준비 ${s.jobless.halves + 1}번째 반기` : s.jobless ? `구직 중 (${s.jobless.halves}/${B.구직.최대년수 * 2}반기)` : `${s.half === 1 ? '상반기' : '하반기'} 행동을 고르세요`;
    const cards = s.cards.map((c) => {
      const rep = G.repeatCount(s, c.id);
      return `<div class="act"><div class="row" style="justify-content:space-between"><h3>${esc(c.이름)}</h3>${rep >= 2 ? '<span class="badge">요즘 매너리즘</span>' : ''}</div>
        <div class="small muted">${esc(c.설명 || '')}</div><div class="eff">${effPreview(c.효과)}</div>
        <button class="btn primary block" data-act="action" data-v="${esc(c.id)}">선택</button></div>`;
    }).join('');
    const noOT = !s.jobless && s.hp <= B.임계치.체력_야근불가 ? '<p class="small muted">체력이 30 이하라 야근 카드는 나오지 않아요.</p>' : '';
    right = `<div class="card stack">${phaseDots(s)}<h2>${title}</h2>
      ${s.lastAction ? `<div class="last-action">지난 반기: ${esc(s.lastAction.name)}</div><div class="chips">${deltaChips(s.lastAction.deltas)}</div>` : ''}
      <div class="action-cards">${cards}</div>${noOT}
      ${s.leaveHalves > 0 || s.jobless ? '' : `<button class="btn block" data-act="action" data-v="normal">평소처럼 보내기 <span class="muted small">체력·스트레스 조금 회복</span></button>`}
      ${G.canJobHunt(s) ? (() => { const p = G.jobHuntChance(B, s); const b = G.judgeBadge(B, p); return `<button class="btn block opt" data-act="action" data-v="jobhunt"><span>💼 이직 준비하기 <span class="muted small">스트레스↑ · 붙으면 바로 옮길 수 있어요${s.huntStreak ? ` · ${s.huntStreak}번째 도전` : ''}</span></span><span class="badge ${b === '자신 있음' ? 'ok' : b === '해볼 만함' ? 'mid' : 'bad'}">${b}</span></button>`; })() : ''}
    </div>`;
  }
  return `${hud(s)}<div class="main-grid"><div class="stack">${s.company ? office(s) : ''}${statusPanel(s)}</div><div class="side-sticky">${right}</div></div>`;
}

function shopPanel() {
  const s = S;
  const tabs = [...new Set(B.상점.map((x) => x.탭))];
  const items = B.상점.filter((x) => x.탭 === ui.shopTab);
  return `<div class="card stack">${phaseDots(s)}<h2>상점</h2><p class="small muted">잔액 <b class="num">${G.formatMoney(s.money)}</b> · 연봉은 연말에 한 번에 들어와요.</p>
    <p class="small">${G.buysLeft(B, s) > 0 ? `올해 살 수 있는 물건: <b>${G.buysLeft(B, s)}개</b> 남음` : '<b>올해는 이미 하나 샀어요.</b> 내년에 다시 들러주세요.'}</p>
    <div class="tabs">${tabs.map((t) => `<button class="tab ${t === ui.shopTab ? 'on' : ''}" data-act="shopTab" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <div>${items.map((it) => {
      const own = !it.소모품 && s.items[it.id];
      const ok = G.canBuy(B, s, it);
      return `<div class="shop-item"><div><b>${esc(it.이름)}</b> ${own ? '<span class="badge ok">보유</span>' : ''}<div class="small muted">${esc(it.설명)}</div><div class="small num">${G.formatMoney(it.가격)}</div></div>
        <button class="btn" data-act="buy" data-v="${esc(it.id)}" ${ok ? '' : 'disabled'}>${own ? '보유 중' : '구매'}</button></div>`;
    }).join('')}</div>
    <button class="btn primary block" data-act="yearEnd">연말 정산 받기</button></div>`;
}

function eventSheet() {
  const s = S, cur = s.current;
  if (cur.news) return `<div class="sheet"><span class="ending-tag">${cur.news.연도}년 업계 뉴스</span><h2>${esc(cur.news.이름)}</h2><p>${esc(cur.news.설명)}</p><button class="btn primary block" data-act="evOpt" data-v="0">확인</button></div>`;
  if (cur.notice) return `<div class="sheet"><h2>${esc(cur.notice.이름)}</h2><p>${esc(cur.notice.상황)}</p><button class="btn primary block" data-act="evOpt" data-v="0">확인</button></div>`;
  const ev = G.eventById(E, cur.id);
  const who = `<div class="who"><div class="face">🧑‍💼</div><div><b>${esc(ev.이름)}</b><div class="small muted">${esc(ev.인물 || '')}</div></div></div>`;
  if (s.result) {
    const r = s.result;
    return `<div class="sheet">${who}<p>${r.judged ? `<span class="badge ${r.success ? 'ok' : 'bad'}">${r.success ? '성공' : '실패'}</span> ` : ''}${esc(r.text)}</p>
      <div class="chips" style="margin:12px 0">${deltaChips(r.deltas)}</div><button class="btn primary block" data-act="evAck">확인</button></div>`;
  }
  const opts = G.eventChoices(E, ev).map((o, i) => {
    let badge = '';
    if (o.판정) { const p = G.judgeChance(B, s, o.판정, ev); const b = G.judgeBadge(B, p); badge = `<span class="badge ${b === '자신 있음' ? 'ok' : b === '해볼 만함' ? 'mid' : 'bad'}">${b}</span>`; }
    return `<button class="btn block opt" data-act="evOpt" data-v="${i}"><span>${esc(o.글)}</span>${badge}</button>`;
  }).join('');
  return `<div class="sheet">${who}<p>${esc(ev.상황)}</p>${ev.되돌릴수없음 ? '<p class="irrev">이 선택은 되돌릴 수 없어요.</p>' : ''}<div class="stack">${opts}</div></div>`;
}

function companyScreen() {
  const s = S;
  const title = s.jobless?.reason === '취준' ? '합격 통보가 왔어요! 첫 회사를 골라주세요' : '입사할 회사를 골라주세요';
  return `${hud(s)}<h2>${title}</h2><div class="grid2">${s.offers.map((o, i) => `
    <div class="card stack"><div><b style="font-size:18px">${esc(o.name)}</b></div>
      <div class="row"><span class="chip">${esc(o.type)}</span><span class="chip">${esc(o.size)}</span>${o.rank !== s.rank ? `<span class="chip up">${esc(o.rank)} 제안</span>` : ''}</div>
      <div class="num">연봉 <b>${G.formatMoney(o.salary)}</b></div>
      <div class="small muted">${o.mood.map(esc).join(' · ')}</div>
      <div class="small muted">회사 안정성 ${'★'.repeat(o.size === '대기업' ? 3 : o.size === '중견' ? 2 : 1)}${'☆'.repeat(o.size === '대기업' ? 0 : o.size === '중견' ? 1 : 2)} · 성장 보너스: ${esc(Object.keys(B.배율.회사유형[o.type] || {}).map(lab).join(', ') || '-')}</div>
      <button class="btn primary block" data-act="pickCompany" data-v="${i}">입사</button></div>`).join('')}</div>`;
}

function reportScreen() {
  const s = S, r = s.report;
  const awards = r.awards.length ? `<div class="card stack"><h3>🏆 연말 시상식</h3><div class="row">${r.awards.map((a) => `<span class="award">🏆 ${esc(a)}</span>`).join('')}</div></div>` : '';
  const gradeBlock = r.grade ? `<div class="row" style="gap:16px"><div class="grade ${r.grade}">${r.grade}</div><div class="small muted">역량 점수 ${r.score} / 직급 기대치 ${r.expect}<br>${r.promoted ? `<b style="color:var(--up)">🎉 ${esc(r.promoted)} 승진!</b>` : r.promoFailed ? '승진 심사에서 떨어졌어요.' : ''}</div></div>` : `<p>올해는 ${s.jobless?.reason === '취준' ? '취업 준비 중' : '구직 중'}이라 고과가 없어요.</p>`;
  const moneyLine = `<dl class="kv num"><dt>받은 연봉</dt><dd>${G.formatMoney(r.pay)}${r.bonus ? ` + 성과급 ${G.formatMoney(r.bonus)}` : ''}</dd><dt>생활비</dt><dd>-${G.formatMoney(r.living)}${r.upkeep ? ` · 유지비 -${G.formatMoney(r.upkeep)}` : ''}</dd>
    <dt>통장 변화</dt><dd>${r.moneyDelta >= 0 ? '+' : ''}${G.formatMoney(r.moneyDelta)} → ${G.formatMoney(s.money)}</dd>
    ${r.grade ? `<dt>내년 연봉</dt><dd>${G.formatMoney(r.salaryNext)} <span class="muted">(${r.salaryNext >= r.salaryOld ? '+' : ''}${(((r.salaryNext - r.salaryOld) / Math.max(1, r.salaryOld)) * 100).toFixed(0)}%)</span></dd>` : ''}
    <dt>사내 입지</dt><dd>${r0(s.stats.사내입지)} · ${esc(r.standingLine)}</dd><dt>대체 가능성</dt><dd>${r.replace}</dd>
    ${r.companyStatus ? `<dt>회사 분위기</dt><dd>${esc(r.companyStatus)}</dd>` : ''}</dl>`;
  const peers = `<table class="cmp"><tr><th></th><th>직급</th><th>연봉</th></tr><tr><td><b>나</b></td><td>${esc(s.rank)}</td><td class="num">${G.formatMoney(s.salary)}</td></tr>${r.peers.map((p) => `<tr><td>동기 ${esc(p.name)}</td><td>${esc(p.rank)}</td><td class="num">${G.formatMoney(p.salary)}</td></tr>`).join('')}</table>`;
  let buttons;
  if (r.mustRetire) {
    buttons = `<p><b>${s.age}세, 정년이에요.</b> ${r.canExtend ? '정년 연장법 덕분에 연장 근무(연봉 70%, 직급 동결)도 고를 수 있어요.' : ''}</p>
      <div class="toolbar">${r.canExtend ? '<button class="btn" data-act="cont" data-v="extend">연장 근무 (최대 65세)</button>' : ''}<button class="btn primary" data-act="cont" data-v="retire">정년 퇴직</button></div>`;
  } else {
    buttons = `<div class="toolbar"><button class="btn primary" data-act="cont" data-v="stay">올해도 버틴다</button><button class="btn danger" data-act="askRetire">이 업계를 떠난다 (은퇴)</button></div>`;
  }
  return `${hud(s)}<h2>${r.year}년 연간 보고서</h2><div class="main-grid"><div class="stack">${awards}
    <div class="card stack"><h3>고과</h3>${gradeBlock}${r.notes.map((n) => `<p class="small">• ${esc(n)}</p>`).join('')}${r.comment ? `<p class="small muted">상사 한마디: ${esc(r.comment)}</p>` : ''}</div>
    <div class="card"><h3>역량 변화 <span class="small muted">(점선: 작년)</span></h3><div class="hex-wrap">${hexagon(r.statsAfter, r.statsBefore)}</div></div></div>
    <div class="stack side-sticky"><div class="card">${moneyLine}</div><div class="card"><h3>동기 비교</h3>${peers}</div><div class="card">${buttons}</div></div></div>`;
}

function offersScreen() {
  const s = S;
  const mine = s.offers[0]?.src === 'apply';
  return `${hud(s)}<h2>${mine ? '✉️ 최종 합격 연락' : '📞 헤드헌터의 연락'}</h2><p class="muted">${mine ? '직접 지원한 회사에서 처우를 제안했어요.' : '"좋은 자리가 있는데, 한번 들어보실래요?"'} 지금 연봉 ${G.formatMoney(s.salary)}</p>
    <div class="grid2">${s.offers.map((o, i) => `<div class="card stack"><b style="font-size:18px">${esc(o.name)}</b>
      <div class="row"><span class="chip">${esc(o.type)}</span><span class="chip">${esc(o.size)}</span><span class="chip ${o.rank !== s.rank ? 'up' : ''}">${esc(o.rank)}</span></div>
      <div class="num">제안 연봉 <b>${G.formatMoney(o.salary)}</b></div><div class="small muted">${o.mood.map(esc).join(' · ')}</div>
      <button class="btn primary block" data-act="offer" data-a="accept" data-v="${i}">이직한다</button></div>`).join('')}</div>
    <div class="toolbar"><button class="btn" data-act="offer" data-a="counter" data-v="0">제안을 들고 연봉 협상 (카운터오퍼)</button><button class="btn" data-act="offer" data-a="decline" data-v="0">거절한다</button></div>`;
}

function endingScreen() {
  const s = S, info = s.endInfo, en = ENDINGS[info.id] || { 이름: info.id, 구분: '', 글: '' };
  const companies = [...new Set(s.history.map((h) => h.company).filter((c) => c !== '구직 중'))];
  const topAwards = s.awards.slice(-3).map((a) => `${a.year} ${a.name}`);
  const maxSalary = Math.max(0, ...s.history.map((h) => h.salary));
  return `<div class="stack" style="max-width:720px;margin:0 auto">
    <div class="card stack" style="text-align:center"><span class="ending-tag">${esc(en.구분)} 엔딩</span><div class="ending-title">${esc(en.이름)}</div><p class="muted">${esc(en.글)}</p></div>
    <div class="card stack"><h3>커리어 카드</h3>
      <dl class="kv num"><dt>이름</dt><dd>${esc(s.name)} (${esc(s.job)}, ${esc(s.background)})</dd><dt>기간</dt><dd>${B.시작.연도}년 ~ ${info.year}년 · ${info.age}세 종료</dd>
      <dt>최고 직급</dt><dd>${esc(info.maxRank)}</dd><dt>최고 연봉</dt><dd>${G.formatMoney(maxSalary)}</dd><dt>순자산</dt><dd>${G.formatMoney(info.netWorth)}</dd>
      <dt>거친 회사</dt><dd>${companies.map(esc).join(', ') || '-'}</dd><dt>이직</dt><dd>${s.moves}회</dd><dt>행복도</dt><dd>${info.happy} / 100</dd>
      <dt>대표 수상</dt><dd>${topAwards.map(esc).join(', ') || '없음'}</dd>
      <dt>동기들</dt><dd>${s.peers.map((p) => `${esc(p.name)}: ${esc(p.rank)}`).join(' · ')}</dd></dl>
      <div class="hex-wrap">${hexagon(s.stats, null)}</div></div>
    <div class="card"><h3>경력 타임라인</h3>${s.log.map((l) => `<div class="small">• ${esc(l)}</div>`).join('')}</div>
    <div class="toolbar"><button class="btn primary" data-act="new">다시 하기</button><button class="btn" data-act="home">처음 화면</button></div></div>`;
}

function infoSheet() {
  const s = S;
  const hist = s.history.slice(-10).reverse().map((h) => `<tr><td>${h.year}</td><td>${h.age}</td><td>${esc(h.rank)}</td><td>${h.grade || '-'}</td><td class="num">${G.formatMoney(h.salary)}</td></tr>`).join('');
  return `<div class="sheet"><h2>내 정보</h2>
    <div class="hex-wrap">${hexagon(s.stats, s.yearStart?.stats)}</div>
    <p class="small muted">점선은 올해 1월 값이에요.</p>
    <dl class="kv num"><dt>직급·트랙</dt><dd>${esc(s.rank)} · ${s.track === 'manager' ? '관리자' : s.track === 'expert' ? '실무자(전문가)' : '공통'}</dd><dt>올해 고과 점수</dt><dd>${r0(s.gradePts)}</dd>
      <dt>보유 물건</dt><dd>${Object.keys(s.items).map((id) => esc(B.상점.find((x) => x.id === id)?.이름)).join(', ') || '없음'}</dd>
      <dt>받은 상</dt><dd>${s.awards.length}개</dd></dl>
    <h3 style="margin-top:12px">최근 기록</h3><table class="cmp"><tr><th>연도</th><th>나이</th><th>직급</th><th>고과</th><th>연봉</th></tr>${hist || '<tr><td colspan="5" class="muted">아직 없어요</td></tr>'}</table>
    <h3 style="margin-top:12px">타임라인</h3>${s.log.map((l) => `<div class="small">• ${esc(l)}</div>`).join('')}
    <button class="btn block" style="margin-top:16px" data-act="closeInfo">닫기</button></div>`;
}
function confirmSheet() {
  const c = ui.confirm;
  return `<div class="sheet"><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p><div class="toolbar"><button class="btn" data-act="confirmNo">취소</button><button class="btn primary" data-act="confirmYes">${esc(c.yes)}</button></div></div>`;
}

// ---------- 동작 ----------
function startCreate() { ui.create = { step: 0, name: '', job: null, background: null, answers: B.성향_문답.map(() => null) }; ui.screen = 'create'; render(); }
function after(msg) { save(); render(); if (msg && S?.phase !== 'ending') toast(msg); }

const ACTIONS = {
  new() {
    const { state } = loadSave();
    if (state && state.phase !== 'ending' && ui.screen === 'landing') {
      ui.confirm = { title: '새 커리어를 시작할까요?', body: '진행 중인 커리어가 사라져요. 저장 슬롯은 1개예요.', yes: '새로 시작', onYes: () => { clearSave(); startCreate(); } };
      return renderSheet();
    }
    startCreate();
  },
  continue() { const { state } = loadSave(); if (!state) return; S = state; ui.screen = 'game'; render(); },
  home() { ui.screen = 'landing'; ui.info = false; render(); },
  dev() { ui.screen = 'dev'; render(); },
  pickJob(el) { ui.create.job = el.dataset.v; render(); },
  pickBg(el) { ui.create.background = el.dataset.v; render(); },
  pickAns(el) { ui.create.answers[+el.dataset.q] = +el.dataset.v; render(); },
  createBack() { const c = ui.create; if (c.step === 0) return ACTIONS.home(); c.step -= 1; render(); },
  createNext() {
    const c = ui.create;
    if (c.step === 0) c.name = (document.getElementById('name')?.value || '').slice(0, 8);
    if (c.step < 3) { c.step += 1; return render(); }
    S = G.newGame(B, E, { name: c.name, job: c.job, background: c.background, answers: c.answers });
    ui.screen = 'game';
    after(B.성향_힌트[S.trait]);
  },
  pickCompany(el) { G.chooseCompany(B, E, S, +el.dataset.v); after('자동 저장됨'); },
  action(el) { G.chooseAction(B, E, S, el.dataset.v); after('자동 저장됨'); },
  evOpt(el) { G.chooseEventOption(B, E, S, +el.dataset.v); after(); },
  evAck() { G.ackResult(B, E, S); after('자동 저장됨'); },
  shopTab(el) { ui.shopTab = el.dataset.v; render(); },
  buy(el) {
    const it = B.상점.find((x) => x.id === el.dataset.v);
    const doBuy = () => { const d = G.buyItem(B, S, it.id); after(d ? `${it.이름} 구매!` : '살 수 없어요'); };
    if (S.unpaid && it.가격 >= 1000) { ui.confirm = { title: '지금 이걸 사도 될까?', body: '월급이 밀리는 중이에요. 그래도 살까요?', yes: '그래도 산다', onYes: doBuy }; return renderSheet(); }
    ui.confirm = { title: `${it.이름}을(를) 살까요?`, body: `구매 후 잔액: ${G.formatMoney(S.money - it.가격)}`, yes: '구매', onYes: doBuy };
    renderSheet();
  },
  yearEnd() { G.goToYearEnd(B, E, S); after('자동 저장됨'); },
  cont(el) {
    const msg = S.offerResult; S.offerResult = null;
    G.continueYear(B, E, S, el.dataset.v);
    after(msg || (S.phase === 'ending' ? null : '새해가 밝았어요'));
  },
  askRetire() {
    ui.confirm = { title: '정말 은퇴할까요?', body: '이 커리어는 여기서 끝나요. 되돌릴 수 없어요.', yes: '은퇴한다', onYes: () => { G.continueYear(B, E, S, 'retire'); after(); } };
    renderSheet();
  },
  offer(el) {
    G.chooseOffer(B, E, S, el.dataset.a, +el.dataset.v);
    const msg = S.offerResult; S.offerResult = null;
    after(msg || (el.dataset.a === 'accept' ? '새 회사로 출근!' : '제안을 거절했어요'));
  },
  info() { ui.info = true; renderSheet(); },
  closeInfo() { ui.info = false; renderSheet(); },
  confirmNo() { ui.confirm = null; renderSheet(); },
  confirmYes() { const f = ui.confirm.onYes; ui.confirm = null; renderSheet(); f(); },
  devApply() {
    const txt = document.getElementById('baljson').value;
    try { const obj = JSON.parse(txt); storage?.setItem(BAL_KEY, JSON.stringify(obj, null, 2)); B = obj; toast('적용했어요'); render(); }
    catch (e) { toast('JSON 형식 오류: ' + e.message); }
  },
  devReset() { storage?.removeItem(BAL_KEY); B = structuredClone(BASE_B); toast('기본값으로 되돌렸어요'); render(); },
  devSim() {
    const n = +document.getElementById('simN').value, st = document.getElementById('simStrategy').value;
    ui.devOut = '계산 중…'; render();
    setTimeout(() => {
      try { ui.devOut = simReport(simulate(B, E, n, st)); } catch (e) { ui.devOut = '오류: ' + e.message; }
      render();
    }, 30);
  },
};
function simReport(r) {
  const pct = (v) => ((v / r.n) * 100).toFixed(1) + '%';
  const gT = Object.values(r.grades).reduce((a, b) => a + b, 0) || 1;
  const lines = [
    `전략 ${r.strategy}, ${r.n}판`,
    `평균 종료 나이 ${r.avgAge.toFixed(1)}세 · 정년 도달 ${pct(r.retiredAtAge)} (목표 30~40%) · 판당 선택 ${r.avgChoices.toFixed(0)}회`,
    `고과 분포 ${Object.entries(r.grades).map(([k, v]) => `${k} ${((v / gT) * 100).toFixed(0)}%`).join(' · ')} (목표 S10 A25 B40 C20 D5)`,
    `40세 직급 ${Object.entries(r.rankAt40).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')} (목표: 팀장~실장)`,
    `최고 직급 ${Object.entries(r.maxRank).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}`,
    `판당 수상 ${(r.awards / r.n).toFixed(1)}개 · 올해의 IT인 ${(r.itAwards / r.n).toFixed(2)}회 · 평균 행복도 ${r.avgHappy.toFixed(0)} · 평균 순자산 ${G.formatMoney(r.avgNetWorth)}`,
    '', '엔딩 분포',
    ...Object.entries(r.endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${ENDINGS[k]?.이름 || k}: ${pct(v)}`),
  ];
  return lines.join('\n');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'name') ACTIONS.createNext(); });

// ---------- 시작 ----------
async function boot() {
  const get = (p) => fetch(p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  [BASE_B, E, ENDINGS] = await Promise.all([get('data/balance.json'), get('data/events.json'), get('data/endings.json')]);
  B = structuredClone(BASE_B);
  const over = storage?.getItem(BAL_KEY);
  if (over) { try { B = JSON.parse(over); } catch { storage.removeItem(BAL_KEY); } }
  render();
}
boot().catch((e) => { app.innerHTML = `<p class="loading">게임 데이터를 불러오지 못했어요. (${esc(e.message)})<br>파일을 직접 열었다면 GitHub Pages 주소나 로컬 서버로 열어주세요.</p>`; });
