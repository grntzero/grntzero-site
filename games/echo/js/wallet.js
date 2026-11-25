/* 에코 제로 — 톱니 지갑 (2026-11-24 게임팀, 계획 v8 13-3쪽 ㉜ 톱니 6등급·합치기 / 13-2쪽 깰 때 톱니·첫 클리어 상자 / ㉝ 하루 8판까지 100% 그 뒤 30% + 쎌 휴식 안내).
   · 기기 저장(localStorage) — 서버 검산(v8 12/3 ⑦)은 이번에 안 함. 베타 기록은 정식 오픈 때 초기화(11-16 확정) → 저장 키에 판 번호 「w1」 을 붙여 TG.W.wipe() 한 번으로 전부 지움(다른 ez_* 키는 안 건드림).
   · 결제·현금·경품 없음. 거래·선물 없음(v8 서버 규칙). 숫자는 전부 js/dungeons.js TG.LEVELS(gearN·boxN)·이 파일 위쪽 상수 — 코드 안 고치고 바꿀 수 있음.
   · 아이콘 6개 = 코드 도형(SVG, 크레딧 0). 톱니 레벨 1~99 곡선·4능력은 v8 ③(11/26·28) 몫 → 여기선 「톱니 레벨」 숫자 자리(lvl, 지금 1)만 둠. */
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
  // 6등급 (v8 ㉜ 이름 그대로, 톱니골 말로). lv = 레벨 구간(13-3쪽), teeth = 아이콘 이빨 수(코드 도형)
  W.GRADES = [null,
    { g: 1, name: '톱니', lv: '1~20', teeth: 6, c1: '#cfd3dc', c2: '#8f96a6', ink: '#5b6170' },
    { g: 2, name: '잘 만들어진 톱니', lv: '21~40', teeth: 8, c1: '#f4f6fa', c2: '#aab2c4', ink: '#5b6170', shine: true },
    { g: 3, name: '반짝반짝 톱니', lv: '41~60', teeth: 8, c1: '#d6f3ff', c2: '#5fc6ff', ink: '#1f6fa0', shine: true, stars: true },
    { g: 4, name: '황동 톱니', lv: '61~80', teeth: 10, c1: '#ffe39a', c2: '#c9a23a', ink: '#7a5a10', shine: true },
    { g: 5, name: '박동 톱니', lv: '81~92', teeth: 10, c1: '#ffb3b3', c2: '#e5352b', ink: '#8a1a14', shine: true, pulse: true },
    { g: 6, name: '에코 톱니', lv: '93~99', teeth: 12, c1: '#d9ccff', c2: '#7a5cff', ink: '#3a2a8a', shine: true, echo: true },
  ];
  W.GRADE_MAX = 6;

  // ── 저장 ──
  const blank = () => ({ v: 1, g: [0, 0, 0, 0, 0, 0, 0], lvl: 1, day: '', runs: 0, got: [0, 0, 0, 0, 0, 0, 0], merges: 0, cards: 0, gold: 0, updated: 0 });
  W.data = blank();
  W.load = function () {
    let d = null; try { d = JSON.parse(localStorage.getItem(W.KEY) || 'null'); } catch (e) { d = null; }
    W.data = blank();
    if (d && typeof d === 'object' && d.v === 1) { for (const k of Object.keys(W.data)) if (d[k] != null) W.data[k] = d[k]; if (!Array.isArray(W.data.g) || W.data.g.length !== 7) W.data.g = blank().g; if (!Array.isArray(W.data.got) || W.data.got.length !== 7) W.data.got = blank().got; }
    for (let i = 1; i <= 6; i++) { W.data.g[i] = Math.max(0, (W.data.g[i] | 0)); W.data.got[i] = Math.max(0, (W.data.got[i] | 0)); }
    W.data.lvl = Math.max(1, Math.min(99, W.data.lvl | 0 || 1));
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
  const scale = (obj, rate) => { const o = {}; for (const k of Object.keys(obj)) { const n = obj[k] | 0; o[k] = rate >= 1 ? n : Math.max(n > 0 ? 1 : 0, Math.round(n * rate)); } return o; };
  const addTo = (obj) => { for (const k of Object.keys(obj)) { const g = k | 0; if (g >= 1 && g <= 6) { W.data.g[g] += obj[k] | 0; W.data.got[g] += obj[k] | 0; } } };
  // 한 판 깨면 지급. o = { lv, dun, box(첫 클리어 상자 처음 열림) }. 돌려줌 = 결과 화면용
  W.payout = function (o) {
    const lv = Math.max(1, Math.min(TG.LEVEL_MAX, o.lv | 0 || 1)), rw = W.reward(lv);
    const before = W.runsToday(), over = before >= W.DAY_FULL, rate = over ? W.OVER_RATE : 1;
    const run = scale(rw.run, rate);
    const crumb = lv >= W.CRUMB.from ? scale({ 1: W.CRUMB.n }, rate)[1] : 0;
    const box = o.box ? (W.BOX_FULL ? rw.box : scale(rw.box, rate)) : null;
    addTo(run); if (crumb) { W.data.g[1] += crumb; W.data.got[1] += crumb; } if (box) addTo(box);
    if (o.box && rw.card) W.data.cards += 1; // 카드 실제 지급은 「카드 1단계」(다음) — 받을 몫만 셈
    if (o.box && rw.gold) W.data.gold += 1;
    W.data.day = W.today(); W.data.runs = before + 1;
    W.save();
    const runs = W.data.runs;
    return { lv, dun: o.dun || null, run, crumb, box, card: !!(o.box && rw.card), gold: !!(o.box && rw.gold), rate, over, runs, full: W.DAY_FULL, rest: W.restMsg(runs, over), total: W.total() };
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
  W.snap = function () { return { g: W.data.g.slice(1), lvl: W.data.lvl, total: W.total(), day: W.data.day, runs: W.runsToday(), got: W.data.got.slice(1), merges: W.data.merges, cards: W.data.cards, gold: W.data.gold, today: W.today(), key: W.KEY }; };
  W.load();
})();
