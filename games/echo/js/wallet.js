/* 에코 제로 — 톱니 지갑 (2026-11-24 게임팀, 계획 v8 13-3쪽 ㉜ 톱니 6등급·합치기 / 13-2쪽 깰 때 톱니·첫 클리어 상자 / ㉝ 하루 8판까지 100% 그 뒤 30% + 쎌 휴식 안내).
   · 기기 저장(localStorage) — 서버 검산(v8 12/3 ⑦)은 이번에 안 함. 베타 기록은 정식 오픈 때 초기화(11-16 확정) → 저장 키에 판 번호 「w1」 을 붙여 TG.W.wipe() 한 번으로 전부 지움(다른 ez_* 키는 안 건드림).
   · 결제·현금·경품 없음. 거래·선물 없음(v8 서버 규칙). 숫자는 전부 js/dungeons.js TG.LEVELS(gearN·boxN)·이 파일 위쪽 상수 — 코드 안 고치고 바꿀 수 있음.
   · 아이콘 6개 = 코드 도형(SVG, 크레딧 0).
   · 11-25 톱니 레벨 1~99(계획 v8 ③, 회의 11-18 「난이도·톱니성장」 2장 + 10단계 회의): 계정 공통 레벨 1개 · 4능력(소리 세기·보호·이동 속도·소리 간격, 99에서 +90/+80/+25/+35%) · 레벨 곡선(2-4 표를 구간 안에서 직선으로 이음) · 구간 등급 조건(2-3) · 쓰러져도 도달 층 비율 × 최대 60%(1-4) · 오늘의 첫 던전 +2판 몫(1-4·2-5).
     레벨 1 = 지금 밸런스 그대로(능력 0) → 식은 최대치 × ((레벨−1)/98)^0.85 (회의 식 (레벨/99)^0.85 는 레벨 1에서 1.8% 가 남아 「레벨 1 = 표준」 을 못 지킴 — 중간 레벨은 표와 ±1%p 안). 끝까지 모드(?rank=1)·기록 재생은 game.js 가 G.gear 를 null 로(랭킹 공정 A안, 표준 수치). */
(function () {
  'use strict';
  const TG = window.TG;
  const W = (TG.W = {});
  W.KEY = 'ez_w1_wallet';           // 베타 판 번호 w1 — 정식 오픈 때 TG.W.wipe()
  W.PREFIX = 'ez_w1_';
  W.MERGE_N = 5;                     // 5개 → 윗등급 1개 (수수료 없음, v8 ㉜)
  W.DAY_FULL = 8;                    // 하루 8판까지 100% (v8 ㉝)
  W.OVER_RATE = 0.3;                 // 그 뒤 30% (1개 밑으로는 안 내려감 — 「많이 해도 손해 없게」)
  W.CRUMB = { from: 4, n: 5 };       // v8 13-2: 4단계부터 판 톱니에 1등급 부스러기 +5 덤(카드 올리기 재료)
  W.BOX_FULL = true;                 // 첫 클리어 상자(던전·단계 1회)는 상한과 무관하게 100% [대표 확인]
  W.FIRST_BONUS = 2;                 // 11-25 회의 1-4·2-5: 하루 첫 판(깸) 「오늘의 첫 던전」 = 판 톱니 +2판 몫 [추정]
  W.FALL_MAX = 0.6;                  // 11-25 회의 1-4: 쓰러져도 도달 층 비율 × 판 톱니의 최대 60% [추정]. 층 = 1·2·3층 + 보스 = 4칸(1층에서 쓰러짐 = 1/4 × 60% = 15%)
  // 6등급 (v8 ㉜ 이름 그대로, 톱니골 말로). lv = 레벨 구간(13-3쪽), from~to = 그 등급으로 올리는 레벨(올릴 레벨 기준: 2~20 = 1등급 … 93~99 = 6등급), teeth = 아이콘 이빨 수(코드 도형)
  W.GRADES = [null,
    { g: 1, name: '톱니', lv: '1~20', from: 2, to: 20, teeth: 6, c1: '#cfd3dc', c2: '#8f96a6', ink: '#5b6170' },
    { g: 2, name: '잘 만들어진 톱니', lv: '21~40', from: 21, to: 40, teeth: 8, c1: '#f4f6fa', c2: '#aab2c4', ink: '#5b6170', shine: true },
    { g: 3, name: '반짝반짝 톱니', lv: '41~60', from: 41, to: 60, teeth: 8, c1: '#d6f3ff', c2: '#5fc6ff', ink: '#1f6fa0', shine: true, stars: true },
    { g: 4, name: '황동 톱니', lv: '61~80', from: 61, to: 80, teeth: 10, c1: '#ffe39a', c2: '#c9a23a', ink: '#7a5a10', shine: true },
    { g: 5, name: '박동 톱니', lv: '81~92', from: 81, to: 92, teeth: 10, c1: '#ffb3b3', c2: '#e5352b', ink: '#8a1a14', shine: true, pulse: true },
    { g: 6, name: '에코 톱니', lv: '93~99', from: 93, to: 99, teeth: 12, c1: '#d9ccff', c2: '#7a5cff', ink: '#3a2a8a', shine: true, echo: true },
  ];
  W.GRADE_MAX = 6;

  // ── 11-25 톱니 레벨 1~99 ──
  W.LV_MAX = 99;
  W.CURVE_EXP = 0.85;                                        // 회의 2-2: 처음 오를 때 조금 더 크게, 후반 완만
  W.MAXP = { power: 0.90, guard: 0.80, move: 0.25, rate: 0.35 }; // 레벨 99 능력치(회의 2-2 표: 소리 세기 +90 · 보호 +80 · 이동 +25 · 소리 간격 +35%)
  W.ABIL = [ // 화면 말(순한 말, 회의 2-1) · 어디에 쓰이나
    { id: 'power', name: '소리 세기', note: '안개가 더 빨리 퐁' },
    { id: 'guard', name: '보호', note: '안개에 닿아도 가끔 보호' },
    { id: 'move', name: '이동 속도', note: '더 빨리 달려요' },
    { id: 'rate', name: '소리 간격', note: '소리가 더 자주 나가요' }];
  // 레벨 l 의 능력(비율). 레벨 1 = 0(지금 밸런스 그대로) · 레벨 99 = MAXP
  W.ability = function (l) {
    l = Math.max(1, Math.min(W.LV_MAX, l | 0 || 1)); const k = Math.pow((l - 1) / (W.LV_MAX - 1), W.CURVE_EXP), o = {};
    for (const id in W.MAXP) o[id] = +(W.MAXP[id] * k).toFixed(4);
    o.lvl = l; return o;
  };
  W.abilityPct = function (l) { const a = W.ability(l), o = {}; for (const id in W.MAXP) o[id] = Math.round(a[id] * 100); return o; };
  // 올릴 레벨(2~99)에 쓰는 톱니 등급(회의 2-3 구간 조건: 레벨 45 → 46 은 반짝반짝 톱니)
  W.gradeFor = function (to) { to |= 0; for (let g = 1; g <= W.GRADE_MAX; g++) if (to >= W.GRADES[g].from && to <= W.GRADES[g].to) return g; return to >= 93 ? 6 : 1; };
  // 레벨 곡선(회의 2-4 표 [추정]) — 표에 있는 레벨은 그대로, 사이는 같은 등급 구간 안에서 직선으로 이어 반올림. 92 는 표에 없어 90 의 기울기로 이음(49)
  W.NEED_ANCH = { 2: 6, 5: 9, 10: 13, 20: 22, 21: 20, 30: 26, 40: 32, 41: 24, 50: 30, 60: 36, 61: 26, 70: 33, 80: 40, 81: 31, 90: 46, 92: 49, 93: 36, 96: 50, 99: 63 };
  W.NEED = [null, null];
  { const ks = Object.keys(W.NEED_ANCH).map(Number).sort((a, b) => a - b);
    for (let to = 2; to <= W.LV_MAX; to++) {
      let n;
      if (W.NEED_ANCH[to] != null) n = W.NEED_ANCH[to];
      else { let lo = null, hi = null; for (const k of ks) { if (k < to) lo = k; if (k > to && hi == null) hi = k; } n = Math.round(W.NEED_ANCH[lo] + (W.NEED_ANCH[hi] - W.NEED_ANCH[lo]) * (to - lo) / (hi - lo)); }
      W.NEED[to] = { g: W.gradeFor(to), n };
    } }
  W.needFor = function (to) { to |= 0; return to >= 2 && to <= W.LV_MAX ? W.NEED[to] : null; };   // { g, n } — 레벨 to 로 올리는 데 드는 톱니
  W.needTotal = function () { const t = [0, 0, 0, 0, 0, 0, 0]; for (let to = 2; to <= W.LV_MAX; to++) t[W.NEED[to].g] += W.NEED[to].n; return t.slice(1); }; // 99까지 등급별 합계(기록표용)
  W.nextNeed = function () { return W.needFor(W.data.lvl + 1); };
  W.canLevelUp = function () { const nd = W.nextNeed(); return !!nd && W.data.g[nd.g] >= nd.n; };
  // 레벨 올리기(버튼 한 번 = 1레벨). 돌려줌 { ok, from, to, spent:{g,n}, jump(10단위 도약), newGrade(다음 레벨부터 윗등급 톱니), max(99 도달) }
  W.levelUp = function () {
    const nd = W.nextNeed(); if (!nd || W.data.g[nd.g] < nd.n) return { ok: false, from: W.data.lvl, to: W.data.lvl, need: nd };
    const from = W.data.lvl, to = from + 1;
    W.data.g[nd.g] -= nd.n; W.data.lvl = to; W.data.ups = (W.data.ups | 0) + 1; W.data.spent = (W.data.spent | 0) + nd.n; W.save();
    const nn = W.needFor(to + 1);
    return { ok: true, from, to, spent: { g: nd.g, n: nd.n }, jump: to % 10 === 0 || to === W.LV_MAX, newGrade: !!(nn && nn.g !== nd.g), max: to === W.LV_MAX, need: nn, ab: W.ability(to) };
  };
  // 10 단위 도약 쎌 한마디(게임 안 쎌 반말 — 세계관 정본). 99 는 최고 레벨
  W.jumpMsg = function (lv) {
    if (lv >= W.LV_MAX) return '레벨 99! 톱니골 최고 친구다~ 정말 대단해!';
    const M = { 10: '레벨 10! 톱니가 반짝반짝~ 소리가 더 커졌어!', 20: '레벨 20! 벌써 이만큼 컸네! 다음은 잘 만들어진 톱니야!', 30: '레벨 30! 안개들이 깜짝 놀라겠다~', 40: '레벨 40! 반짝반짝 톱니로 올라갈 차례야!', 50: '레벨 50! 절반 왔어! 톱니골이 응원해~', 60: '레벨 60! 이제 황동 톱니야. 멋지다!', 70: '레벨 70! 소리가 톱니골 끝까지 울려~', 80: '레벨 80! 박동 톱니가 두근두근!', 90: '레벨 90! 에코 톱니까지 조금만 더!' };
    return M[lv] || ('레벨 ' + lv + '! 와, 정말 대단해!');
  };

  // ── 저장 ──  v2(11-25): ups(레벨 올린 횟수)·falls(쓰러져도 챙긴 판)·firsts(오늘의 첫 던전 받은 날 수) 추가. v1 저장(11-24)은 그대로 읽고 v2 로 올림(보유분 손실 X)
  const blank = () => ({ v: 2, g: [0, 0, 0, 0, 0, 0, 0], lvl: 1, day: '', runs: 0, got: [0, 0, 0, 0, 0, 0, 0], merges: 0, cards: 0, gold: 0, spent: 0, ups: 0, falls: 0, firsts: 0, updated: 0 });
  W.LEGACY_FRAG_KEYS = ['ez_w1_frag', 'ez_frag', 'ez_w1_shards', 'ez_shards']; // 혹시 남아 있을 옛 「톱니 조각」 저장 — 있으면 1등급 톱니로 합침(회의 2-6, 보유분 손실 X). 지금 코드엔 없던 키(안전망)
  W.data = blank();
  W.load = function () {
    let d = null; try { d = JSON.parse(localStorage.getItem(W.KEY) || 'null'); } catch (e) { d = null; }
    W.data = blank(); W.migrated = null;
    if (d && typeof d === 'object' && (d.v === 1 || d.v === 2)) {
      for (const k of Object.keys(W.data)) if (d[k] != null && k !== 'v') W.data[k] = d[k];
      if (!Array.isArray(W.data.g) || W.data.g.length !== 7) W.data.g = blank().g; if (!Array.isArray(W.data.got) || W.data.got.length !== 7) W.data.got = blank().got;
      if (d.v === 1) W.migrated = { from: 1, to: 2 };
    }
    for (let i = 1; i <= 6; i++) { W.data.g[i] = Math.max(0, (W.data.g[i] | 0)); W.data.got[i] = Math.max(0, (W.data.got[i] | 0)); }
    W.data.lvl = Math.max(1, Math.min(W.LV_MAX, W.data.lvl | 0 || 1));
    // 옛 「톱니 조각」 키 → 1등급 톱니
    let frag = 0; try { for (const k of W.LEGACY_FRAG_KEYS) { const v = localStorage.getItem(k); if (v != null) { frag += Math.max(0, parseInt(v, 10) || 0); localStorage.removeItem(k); } } } catch (e) { /* 무시 */ }
    if (frag > 0) { W.data.g[1] += frag; W.data.got[1] += frag; W.migrated = Object.assign(W.migrated || {}, { frag }); }
    if (W.migrated) W.save();
    return W.data;
  };
  W.save = function () { W.data.updated = Date.now(); try { localStorage.setItem(W.KEY, JSON.stringify(W.data)); } catch (e) { /* 무시 */ } };
  W.reset = function () { try { localStorage.removeItem(W.KEY); } catch (e) { /* 무시 */ } W.data = blank(); return W.snap(); };
  W.wipe = function () { // 정식 오픈 때: 베타 지갑 기록 전부 지움(ez_w1_* 만)
    const ks = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(W.PREFIX) === 0) ks.push(k); } ks.forEach((k) => localStorage.removeItem(k)); } catch (e) { /* 무시 */ }
    W.data = blank(); return ks.length;
  };
  // 오늘(기기 날짜, YYYY-MM-DD). 시험용 덮어쓰기 W._today
  W.today = function () { if (W._today) return W._today; const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  W.runsToday = function () { return W.data.day === W.today() ? (W.data.runs | 0) : 0; };
  W.total = function () { let n = 0; for (let i = 1; i <= 6; i++) n += W.data.g[i]; return n; };

  // ── 보상 (js/dungeons.js TG.LEVELS 의 gearN·boxN) ──
  W.reward = function (lv) { const L = TG.LEVELS[lv] || TG.LEVELS[1]; return { run: Object.assign({}, L.gearN || {}), box: Object.assign({}, L.boxN || {}), card: !!L.boxCard, gold: !!L.boxGold }; };
  const scale = (obj, rate) => { const o = {}; for (const k of Object.keys(obj)) { const n = obj[k] | 0; o[k] = rate >= 1 ? Math.round(n * rate) : Math.max(n > 0 ? 1 : 0, Math.round(n * rate)); } return o; };
  const addTo = (obj) => { for (const k of Object.keys(obj)) { const g = k | 0; if (g >= 1 && g <= 6) { W.data.g[g] += obj[k] | 0; W.data.got[g] += obj[k] | 0; } } };
  // 한 판 깨면 지급. o = { lv, dun, box(첫 클리어 상자 처음 열림) }. 돌려줌 = 결과 화면용
  W.payout = function (o) {
    const lv = Math.max(1, Math.min(TG.LEVEL_MAX, o.lv | 0 || 1)), rw = W.reward(lv);
    const before = W.runsToday(), over = before >= W.DAY_FULL, rate = over ? W.OVER_RATE : 1;
    const run = scale(rw.run, rate);
    const crumb = lv >= W.CRUMB.from ? scale({ 1: W.CRUMB.n }, rate)[1] : 0;
    const box = o.box ? (W.BOX_FULL ? rw.box : scale(rw.box, rate)) : null;
    const first = before === 0 && W.FIRST_BONUS > 0 ? scale(rw.run, W.FIRST_BONUS) : null; // 11-25 오늘의 첫 던전(하루 첫 깸): 판 톱니 +2판 몫
    addTo(run); if (crumb) { W.data.g[1] += crumb; W.data.got[1] += crumb; } if (box) addTo(box); if (first) { addTo(first); W.data.firsts = (W.data.firsts | 0) + 1; }
    if (o.box && rw.card) W.data.cards += 1; // 카드 실제 지급은 「카드 1단계」(다음) — 받을 몫만 셈
    if (o.box && rw.gold) W.data.gold += 1;
    W.data.day = W.today(); W.data.runs = before + 1;
    W.save();
    const runs = W.data.runs;
    return { lv, dun: o.dun || null, run, crumb, box, first, card: !!(o.box && rw.card), gold: !!(o.box && rw.gold), rate, over, runs, full: W.DAY_FULL, rest: W.restMsg(runs, over), total: W.total() };
  };
  // 11-25 쓰러져도 성장(회의 1-4): 도달 층 비율 × 판 톱니 × 최대 60%. o = { lv, dun, reached(1~4: 1·2·3층·보스), of(4) }. 하루 판 수엔 안 셈(깬 판만 셈) · 이미 8판 넘었으면 30% 도 같이 [대표 확인]
  W.payoutFall = function (o) {
    const lv = Math.max(1, Math.min(TG.LEVEL_MAX, o.lv | 0 || 1)), rw = W.reward(lv);
    const of = o.of || 4, reached = Math.max(1, Math.min(of, o.reached | 0 || 1)), ratio = reached / of;
    const over = W.runsToday() >= W.DAY_FULL, rate = over ? W.OVER_RATE : 1, k = W.FALL_MAX * ratio * rate;
    const run = scale(rw.run, k);
    addTo(run); W.data.falls = (W.data.falls | 0) + 1; W.save();
    return { lv, dun: o.dun || null, run, reached, of, ratio, pct: Math.round(W.FALL_MAX * ratio * 100), rate, over, fall: true, total: W.total(), say: '조금만 더! 톱니는 챙겼어!' };
  };
  // 쎌 휴식 안내 (v8 ㉝) — 8판째 끝나면 「쉬었다 하자」, 9판째부터 「30%만」. 말투 = 정본(게임 안 쎌 반말)
  W.restMsg = function (runs, over) {
    if (over) return '쉬는 시간! 오늘은 톱니가 30%만 와. 내일 또 하자~';
    if (runs >= W.DAY_FULL) return '오늘 ' + W.DAY_FULL + '판! 톱니는 다 챙겼어. 이제 잠깐 쉬었다 하자~';
    return null;
  };
  // ── 합치기: 같은 등급 5개 → 윗등급 1개 (버튼 1번 = 1번, 수수료 없음) ──
  W.canMerge = function (g) { g |= 0; return g >= 1 && g < W.GRADE_MAX && W.data.g[g] >= W.MERGE_N; };
  W.merge = function (g) { if (!W.canMerge(g)) return false; g |= 0; W.data.g[g] -= W.MERGE_N; W.data.g[g + 1] += 1; W.data.merges += 1; W.save(); return true; };
  // 11-25 카드 1단계: 카드 올리기 재료(1등급 톱니 3/6/12개, js/collect.js K.upgrade) — 모자라면 false
  W.spend = function (g, n) { g |= 0; n |= 0; if (g < 1 || g > W.GRADE_MAX || n <= 0 || W.data.g[g] < n) return false; W.data.g[g] -= n; W.data.spent = (W.data.spent | 0) + n; W.save(); return true; };

  // ── 아이콘 (코드 도형 SVG, 크레딧 0): 이빨 수·색이 등급마다 다름, 3등급 반짝 별, 5등급 박동 고리, 6등급 메아리 고리 ──
  const gearPath = (teeth, R, r, cx, cy) => {
    const pts = [], n = teeth * 4, step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) { const k = i % 4, rad = k === 0 || k === 3 ? r : R, a = (i + (k === 1 ? 0.15 : k === 2 ? -0.15 : 0)) * step - Math.PI / 2; pts.push((cx + Math.cos(a) * rad).toFixed(2) + ',' + (cy + Math.sin(a) * rad).toFixed(2)); }
    return 'M' + pts.join('L') + 'Z';
  };
  const iconCache = {};
  W.icon = function (g, size) {
    g = Math.max(1, Math.min(W.GRADE_MAX, g | 0)); const key = g + ':' + (size || 0);
    if (iconCache[key]) return iconCache[key];
    const G = W.GRADES[g], id = 'wg' + g;
    let s = '<svg class="gIco g' + g + '" viewBox="0 0 44 44" aria-label="' + G.name + '" role="img"' + (size ? ' width="' + size + '" height="' + size + '"' : '') + '>';
    s += '<defs><radialGradient id="' + id + '" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="' + G.c1 + '"/><stop offset="1" stop-color="' + G.c2 + '"/></radialGradient></defs>';
    if (G.echo) s += '<circle cx="22" cy="22" r="20.5" fill="none" stroke="' + G.c2 + '" stroke-width="1.6" opacity="0.55"/><circle cx="22" cy="22" r="17.5" fill="none" stroke="' + G.c1 + '" stroke-width="1.2" opacity="0.7"/>';
    if (G.pulse) s += '<circle cx="22" cy="22" r="20.5" fill="none" stroke="' + G.c2 + '" stroke-width="2" opacity="0.5" stroke-dasharray="4 3"/>';
    s += '<path d="' + gearPath(G.teeth, G.echo || G.pulse ? 15.5 : 18, G.echo || G.pulse ? 12 : 14, 22, 22) + '" fill="url(#' + id + ')" stroke="' + G.ink + '" stroke-width="2" stroke-linejoin="round"/>';
    s += '<circle cx="22" cy="22" r="5" fill="#fff" stroke="' + G.ink + '" stroke-width="2"/>';
    if (G.shine) s += '<path d="M14 15 q3 -4 7 -5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.85"/>';
    if (G.stars) s += '<path d="M35 7 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4z M8 33 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z" fill="#fff" stroke="' + G.ink + '" stroke-width="1"/>';
    if (G.pulse) s += '<path d="M15 24 h3 l2 -5 3 10 2 -7 2 2 h2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,6)" opacity="0.95"/>';
    if (G.echo) s += '<path d="M31 11 q6 3 6 11 M35 9 q8 4 8 13" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>';
    s += '</svg>';
    return (iconCache[key] = s);
  };
  // 글·HTML 도우미: { '1': 12, '2': 2 } → 「톱니 ×12 · 잘 만들어진 톱니 ×2」 / 아이콘 + ×N
  W.text = function (obj) { const a = []; for (let g = 1; g <= 6; g++) if (obj && obj[g] > 0) a.push(W.GRADES[g].name + ' ×' + obj[g]); return a.join(' · '); };
  W.html = function (obj, size) { const a = []; for (let g = 1; g <= 6; g++) if (obj && obj[g] > 0) a.push('<span class="gw">' + W.icon(g, size || 22) + '<b>×' + obj[g] + '</b></span>'); return a.join(''); };
  W.snap = function () { return { g: W.data.g.slice(1), lvl: W.data.lvl, total: W.total(), day: W.data.day, runs: W.runsToday(), got: W.data.got.slice(1), merges: W.data.merges, cards: W.data.cards, gold: W.data.gold, ups: W.data.ups | 0, falls: W.data.falls | 0, firsts: W.data.firsts | 0, need: W.nextNeed(), canUp: W.canLevelUp(), ab: W.abilityPct(W.data.lvl), abNext: W.data.lvl < W.LV_MAX ? W.abilityPct(W.data.lvl + 1) : null, v: W.data.v, migrated: W.migrated || null, today: W.today(), key: W.KEY }; };
  W.load();
})();
