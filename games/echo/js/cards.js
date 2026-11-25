/* 톱니골 던전 — 리믹스 카드(레벨업 3택1) 28종 = 공통 7 + 함께하는 친구 3(POY 다이얼 링·WOAD 거품 자국·ROGUN 째깍 원판) + 모쉬 기존 2 + 11-18 새 16(전용 13 + 공통 3)
   sim = 규칙 계산(1/60초, 난수는 TG.sr 만) / draw = 그리기. 아이콘은 캔버스로 직접 그림(0크레딧)
   11-18 리믹스 카드 28종(리믹스카드_기획_20261117.md·계획 v4 3~4쪽, 대표 「진행해」): 전용은 hero 칸, 3택1 에 전용은 최대 1장(C.offer). 수치는 기획 그대로, 밸런스 측정(기록.md)으로 맞춘 것만 주석에 적음
     세포  echo 확성기 메아리(파동이 끝에서 튕겨 돌아옴 50/75/100%, 돌아온 파동은 원래 파동이 맞힌 안개는 다시 안 맞힘) · beat 34 박자(3초 안 연속 퐁 1겹씩 +8/12/15%, 최대 3겹=+45% 상한, 3단은 34연속 때 음표 비) · run 세포런(2초 쉬지 않고 달리면 이동 +6%·파동 범위 +5%, 2/3/4겹, 이동은 「이동 빠르게」와 합쳐 +45% 상한)
     허조교 stun 올려놔!(멈춤 0.5→0.7/0.9/1.1초, 보스는 절반) · line 줄 맞춰!(멈춤 둘레 +25/50/75%) · whistle2 호루라기 두 번(0.15초 뒤 2번째 고함 50/75/100%, 3단은 멈춤까지+간격 +10%)
     모쉬  bounce 튕기는 빔(기존 4단) · pierce 지나는 빔(기존 3단) · thick 굵은 픽셀빔(빔 폭 1.5/2/2.5배 — 같이 닿은 안개 1/2/3마리 더, 3단 세기 +10%)
     쎄니  stars 별 더 많이(퍼플팝이 처음 맞히면 별 조각 1/2/3개가 가까운 안개로) · stain 물감 오래(바닥 물감 +1/2/3초) · bright 밝게 반짝(물감 구역 안 퐁 속도 +30/60/90%)
     베리  drops 방울 두 개(방울 1→2/3/3개+조금 큰 방울 — 곁 방울은 범위 75%) · path 꽃길 넓게(꽃 자국 폭 +20/40/60%, 2단부터 밟으면 회복 1칸 — 10초에 1칸 상한) · shaka 마라카스 샤카(방울 거리·빠르기 +25/50/75%)
     공통  notex2 음표 두 배(뽑은 뒤 10/15/20초 음표 가치 2배) · cheer 친구 응원 더(보조 응원 +25/50/75%, 보조 없으면 안 나옴) · revive 다시 일어나기(1단만, 쓰러질 때 1번 소리 크기 1칸으로 버팀, 순위 모드(?rank=1)에선 안 나옴) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const C = (TG.C = {});
  const MAXLV = 3;
  // name = 화면 글(순한 말), tag = 함께하는 친구 이름, hero = 전용(그 주인공에게만), needAssist = 보조가 있을 때만, noRank = 순위 모드에선 안 나옴
  //  for = 효과 있는 주인공 목록(11-18 대표 요청 3: 의미 없는 카드는 안 나오게). 없으면 다섯 모두. 공통 10장은 코드로 확인해 다섯 모두에게 효과(파동 크게·빠르게·+1 은 WV.stat 한 표라 빔·고함도 같이 커지고·빨라지고·+1발) — 표는 기록.md 11절. 주인공별로 빼려면 예: for: ['sefo', 'sseni', 'berri']
  C.DEFS = [
    { id: 'size', name: '파동 크게', col: '#e5352b' },
    { id: 'fast', name: '파동 빠르게', col: '#ff8a5b' },
    { id: 'more', name: '파동 +1', col: '#ffc21f' },
    { id: 'move', name: '이동 빠르게', col: '#4fc3f7' },
    { id: 'magnet', name: '줍기 자석', col: '#ff6fae' },
    { id: 'heart', name: '소리 +1', col: '#ff5a4a' },
    { id: 'charge', name: '충전 빠르게', col: '#ffd23f' },
    { id: 'poy', name: '다이얼 링', tag: 'POY', col: '#00FF00' },
    { id: 'woad', name: '거품 자국', tag: 'WOAD', col: '#FF6F61' },
    { id: 'rogun', name: '째깍 원판', tag: 'ROGUN', col: '#3D7BFF' },
    // 11-17 모쉬 전용(hero): 「푸슝 빔」을 키우는 카드 — 다른 주인공에게는 안 나옴
    { id: 'bounce', name: '튕기는 빔', col: '#2fe0f0', hero: 'moshee', max: 4 }, // 맞은 안개에서 가까운 다른 안개로 튕김: 1단 2명·2단 3명·3단 4명·4단 5명
    { id: 'pierce', name: '지나는 빔', col: '#8ff4ff', hero: 'moshee', max: 3 }, // 뚫고 지나감: 단마다 +1 명
    // 11-18 새 16장
    { id: 'thick', name: '굵은 픽셀빔', col: '#5ff0ff', hero: 'moshee' },
    { id: 'echo', name: '확성기 메아리', col: '#ff8a5b', hero: 'sefo' },
    { id: 'beat', name: '34 박자', col: '#e5352b', hero: 'sefo' },
    { id: 'run', name: '세포런', col: '#ffd966', hero: 'sefo' },
    { id: 'stun', name: '올려놔!', col: '#a7b04f', hero: 'gunner' },
    { id: 'line', name: '줄 맞춰!', col: '#dce383', hero: 'gunner' },
    { id: 'whistle2', name: '호루라기 두 번', col: '#ffe88a', hero: 'gunner' },
    { id: 'stars', name: '별 더 많이', col: '#a46bff', hero: 'sseni' },
    { id: 'stain', name: '물감 오래', col: '#7d3fe6', hero: 'sseni' },
    { id: 'bright', name: '밝게 반짝', col: '#d6c0ff', hero: 'sseni' },
    { id: 'drops', name: '방울 두 개', col: '#ff7fb6', hero: 'berri' },
    { id: 'path', name: '꽃길 넓게', col: '#ff9ccb', hero: 'berri' },
    { id: 'shaka', name: '마라카스 샤카', col: '#ffb3d6', hero: 'berri' },
    { id: 'notex2', name: '음표 두 배', col: '#ffc21f' },
    { id: 'cheer', name: '친구 응원 더', col: '#c9a6ff', needAssist: true },
    { id: 'revive', name: '다시 일어나기', col: '#8cf06a', max: 1, noRank: true },
  ];
  // 기획 수치표(단계 0·1·2·3)
  C.NUM = {
    echoK: [0, 0.5, 0.75, 1.0],      // 돌아온 파동 세기
    beatPct: [0, 0.08, 0.12, 0.15],  // 1겹당 소리 +, 최대 3겹
    beatWin: 3.0, beatMax: 3, beatRain: 34,
    runMax: [0, 2, 3, 4], runEvery: 2.0, runMove: 0.06, runRange: 0.05, moveCap: 0.45,
    stunAdd: [0, 0.2, 0.4, 0.6], stunBossK: 0.5, stunBossEvery: 4.0, // 보스 멈춤 4초에 1번(r4 허조교 −28% → 더 띄움) // 보스 멈춤은 2.5초에 1번(측정 r1: 고함 간격 0.24초 < 멈춤 0.35~0.55초라 보스가 영영 멈춰 보스전 −34% → 보정)
    lineK: [1, 1.25, 1.5, 1.75],
    whistleK: [0, 0.5, 0.65, 0.8], whistleAt: 0.15, whistleCd3: 1.1, // 2번째 고함 세기 — 기획 50/75/100 → 측정 r3(카드 있음 허조교 보스전 −24%)로 2·3단 0.65/0.8
    thickK: [1, 1.5, 2.0, 2.5], thickN: [0, 1, 2, 3], thickDmg3: 1.1,
    starsN: [0, 1, 2, 3], starsR: 4.0,
    stainAdd: [0, 1, 2, 3],
    brightK: [1, 1.3, 1.6, 1.9],
    dropsN: [1, 2, 3, 3], dropsK: 0.5, dropsBigK: 0.75, dropsRange: 0.6, dropsSpread: 0.42, // 곁 방울 세기 0.5(두 번 닿으면 방울 안개 퐁)·3단 큰 방울 0.75·곁 방울 범위 0.6(측정 r3 베리 −22% → 거리로 누름). r4 는 이 줄 주석이 뒤를 삼켜 dropsRange·dropsSpread 가 비어 곁 방울 방향 NaN — 측정 무효
    pathK: [1, 1.2, 1.4, 1.6], pathHealCd: [0, 0, 12, 10],
    shakaK: [1, 1.25, 1.5, 1.75],
    noteX2T: [0, 10, 15, 20],
    reviveDown: 3.0, reviveGuard: 1.5, // 다시 일어나기(11-18 대표 요청 3): 쓰러진 채 3초(3·2·1 카운트, 안개는 움직이고 나는 안전) → 일어나며 1.5초 보호
    cheerK: [1, 1.25, 1.5, 1.75],
  };
  C.maxOf = (id) => (C.byId[id] && C.byId[id].max) || MAXLV;
  C.byId = {}; C.DEFS.forEach((d) => (C.byId[d.id] = d));
  C.MAXLV = MAXLV;

  C.reset = function () {
    const G = TG.G;
    G.cards = {};
    C.poyA = 0; C.poyBossCd = 0; C.trail = []; C.lastX = null; C.lastZ = null; C.woadBossCd = 0;
    // 11-18 새 카드 상태
    C.beatStk = 0; C.beatT = 0; C.beatChain = 0; C.beatRains = 0; // 34 박자: 겹·남은 시간·연속 수
    C.runStk = 0; C.runT = 0; C.stopT = 0;                      // 세포런: 겹·달린 시간·멈춘 시간
    C.noteX2T = 0; C.noteX2N = 0;                                // 음표 두 배: 남은 초·2배로 주운 수
    C.revived = false; C.pathCd = 0; C.pathHeals = 0;            // 다시 일어나기(1번)·꽃길 회복 쿨
    C.echoWaves = 0; C.starHits = 0; C.thickHits = 0; C.whistle2N = 0; C.bossStuns = 0; C.dropWaves = 0;
    C.recalc();
  };
  C.lv = (id) => (TG.G.cards[id] || 0);
  const H = () => TG.heroId; // 전용 카드는 그 주인공일 때만 효과(다른 주인공이 시험용 give 로 받아도 0)
  C.fits = (d) => (!d.hero || d.hero === H()) && (!d.for || d.for.indexOf(H()) >= 0); // 이 주인공에게 효과 있는 카드인가(전용·for)
  C.hlv = (id) => (C.byId[id] && C.byId[id].hero && C.byId[id].hero !== H() ? 0 : C.lv(id));
  // 카드 단계 → 실제 값
  C.recalc = function () {
    const G = TG.G, P = TG.PL, N = C.NUM;
    G.mod = { size: C.lv('size'), fast: C.lv('fast'), more: C.lv('more'), magnet: C.lv('magnet') * 2.2, charge: 1 + C.lv('charge') * 0.3, bounce: C.hlv('bounce'), pierce: C.hlv('pierce'),
      thick: C.hlv('thick'), echo: C.hlv('echo'), beat: C.hlv('beat'), run: C.hlv('run'), stun: C.hlv('stun'), line: C.hlv('line'), whistle2: C.hlv('whistle2'),
      stars: C.hlv('stars'), stain: C.hlv('stain'), bright: C.hlv('bright'), drops: C.hlv('drops'), path: C.hlv('path'), shaka: C.hlv('shaka'), cheer: C.lv('cheer') };
    if (C.runStk > N.runMax[G.mod.run]) C.runStk = N.runMax[G.mod.run];
    if (P) P.spdMul = (1 + Math.min(N.moveCap, C.lv('move') * 0.1 + C.runStk * N.runMove)) * (G.eq && G.eq.star ? 1 + G.eq.star : 1) * (G.gear && G.gear.move ? 1 + G.gear.move : 1); // 11-25 톱니 레벨 이동 속도(최대 +25%, 끝까지 모드는 G.gear null)도 따로 곱함 // 「이동 빠르게」+「세포런」 합쳐 +45% 상한 · 11-25 카드 1단계 ⭐이동(장착 능력치, 최대 +10%)은 따로 곱함
  };
  C.rank = () => !!(TG.G.rankMode || (TG.Q && TG.Q.rank)); // 순위(끝까지) 모드 — 「다시 일어나기」 안 나옴
  // 3장 뽑기 (다 찬 카드는 빼고). 11-18: 전용(hero)은 3장 중 최대 1장 — 「내 캐릭터 1장 + 다른 맛 2장」. 보조 없으면 「친구 응원 더」 X, 순위 모드면 「다시 일어나기」 X
  //  11-18 다시 뽑기: avoid = 방금 나온 3장 — 뺀 뒤에도 3장 이상 남으면 빼고 뽑음(가능하면 피하기). 뽑을 카드가 3장이 안 되면 남은 만큼만(0장이면 game.js openCard 가 소리 크기 1칸으로)
  C.offer = function (avoid) {
    let av = C.DEFS.filter((d) => C.lv(d.id) < C.maxOf(d.id) && C.fits(d) && (!d.needAssist || (TG.AS && TG.AS.on)) && (!d.noRank || !C.rank()));
    if (avoid && avoid.length) { const rest = av.filter((d) => avoid.indexOf(d.id) < 0); if (rest.length >= 3) av = rest; }
    const out = []; let heroN = 0;
    while (out.length < 3 && av.length) {
      const d = av.splice((TG.sr() * av.length) | 0, 1)[0];
      if (d.hero) { if (heroN >= 1) continue; heroN++; }
      out.push(d.id);
    }
    return out;
  };
  C.apply = function (id) {
    const G = TG.G, P = TG.PL;
    G.cards[id] = Math.min(C.maxOf(id), C.lv(id) + 1);
    if (id === 'heart') { P.maxHp++; P.hp = Math.min(P.maxHp, P.hp + 1); }
    if (id === 'notex2') C.noteX2T = C.NUM.noteX2T[C.lv('notex2')]; // 뽑은 뒤 10/15/20초
    C.recalc();
  };
  // ── 11-18 새 카드 훅(다른 파일이 부름) ──
  C.beatK = () => 1 + C.beatStk * C.NUM.beatPct[TG.G.mod.beat || 0];         // 34 박자: 파동 세기 배율(wave.js WV.stat)
  C.runRangeK = () => 1 + C.runStk * C.NUM.runRange;                           // 세포런: 파동 범위 배율
  C.noteK = () => (C.noteX2T > 0 ? 2 : 1);                                     // 음표 두 배(game.js onPick)
  C.stainAdd = () => C.NUM.stainAdd[TG.G.mod.stain || 0];                      // 물감 오래(wave.js mistStart)
  C.brightK = () => C.NUM.brightK[TG.G.mod.bright || 0];                       // 밝게 반짝(wave.js zones)
  C.cheerK = () => C.NUM.cheerK[TG.G.mod.cheer || 0];                          // 친구 응원 더(assist.js)
  C.pathK = () => C.NUM.pathK[TG.G.mod.path || 0];                             // 꽃길 넓게(flowers.js)
  // 파동(세포)이 안개를 터뜨렸을 때 — 34 박자 겹 쌓기 (wave.js 가 부름)
  C.onWavePop = function (w) {
    const G = TG.G, lv = G.mod.beat; if (!lv) return;
    if (C.beatT > 0) { if (C.beatStk < C.NUM.beatMax) { C.beatStk++; if (C.beatStk === C.NUM.beatMax) TG.FX.text('34 박자!', TG.PL.x, 4.0, TG.PL.z, 'cheer'); } }
    else C.beatStk = 0;
    C.beatT = C.NUM.beatWin; C.beatChain++;
    if (lv >= 3 && C.beatChain > 0 && C.beatChain % C.NUM.beatRain === 0) { // 3단: 34마리 연속이면 음표 비
      C.beatRains++; TG.F.dropNotes(TG.PL.x, TG.PL.z, 10, 1.8); TG.FX.text('34 연속! 음표 비!', TG.PL.x, 4.6, TG.PL.z, 'cheer'); TG.A.pop(0, true);
      for (let i = 0; i < 12; i++) TG.FX.emit(TG.FX.CELL.note, TG.PL.x + TG.fra(-2, 2), 2 + TG.fra(0, 2), TG.PL.z + TG.fra(-2, 2), { vy: TG.fra(2, 5), life: 0.9, size: 0.6, size1: 0.2, color: [2.4, 2.0, 0.6], grav: 6, pop: true, rot: 0 });
    }
  };
  // 꽃길 넓게: 작은 꽃을 밟을 때 회복(2단부터, 쿨 10~12초) — flowers.js 가 부름. 돌려줌 = 회복했나
  C.pathHeal = function (P) {
    const lv = TG.G.mod.path || 0; if (lv < 2 || C.pathCd > 0 || P.hp >= P.maxHp) return false;
    C.pathCd = C.NUM.pathHealCd[lv]; C.pathHeals++; P.hp = Math.min(P.maxHp, P.hp + 1);
    return true;
  };
  // 다시 일어나기: 쓰러질 때 1번 소리 크기 1칸으로 버팀 (game.js onHurt). 순위 모드에선 카드가 안 나오니 여기도 안 옴
  C.tryRevive = function (P) { // 11-18 요청 3: 바로 일어나지 않고 game.js 가 reviveDown 초 세고 나서 일으킴(hp 는 그때 1)
    if (!C.lv('revive') || C.revived || C.rank()) return false;
    C.revived = true;
    return true;
  };
  // 11-18 카드 설명(얼굴 칸 → 내 리믹스 카드, 지금 단 숫자) — 순한 말
  const pct = (v) => Math.round(v * 100) + '%';
  C.DESC = {
    size: (l) => '소리 파동이 더 커져요 (×' + [1, 1.15, 1.3, 1.45][l] + ')',
    fast: (l) => '파동이 더 자주 나가요 (간격 ' + pct([1, 0.88, 0.78, 0.7][l]) + ')',
    more: (l) => '한 번에 파동이 ' + (1 + l) + '개 나가요',
    move: (l) => '달리기가 빨라져요 (+' + l * 10 + '%)',
    magnet: (l) => '음표가 더 멀리서도 끌려와요 (둘레 +' + (l * 2.2).toFixed(1) + ')',
    heart: (l) => '소리 크기 칸이 ' + l + '칸 늘어요',
    charge: (l) => '큰 소리가 더 빨리 차요 (+' + l * 30 + '%)',
    poy: (l) => 'POY 초록 다이얼 고리 ' + (l + 1) + '개가 몸 둘레를 돌며 닿는 안개를 톡',
    woad: (l) => 'WOAD 거품 자국이 길에 남아요 (' + (6 + l * 4) + '개, ' + (2.4 + l * 0.8).toFixed(1) + '초' + (l >= 3 ? ', 두 배 세게' : '') + ')',
    rogun: (l) => 'ROGUN 째깍 원판 안 안개가 느려져요 (둘레 ' + (3.6 + l * 0.9).toFixed(1) + ', 빠르기 ' + pct([1, 0.8, 0.68, 0.58][l]) + ')',
    bounce: (l) => '푸슝 빔이 가까운 안개로 ' + l + '번 튕겨요 (' + (l + 1) + '명)',
    pierce: (l) => '푸슝 빔이 안개 ' + l + '명을 더 뚫고 지나가요',
    thick: (l) => '빔이 ' + C.NUM.thickK[l] + '배 굵어져 옆 안개 ' + C.NUM.thickN[l] + '마리도 같이' + (l >= 3 ? ', 세기 +10%' : ''),
    echo: (l) => '파동이 끝에서 튕겨 돌아와요 (돌아온 세기 ' + pct(C.NUM.echoK[l]) + ')',
    beat: (l) => '3초 안에 연속으로 터뜨리면 소리 +' + pct(C.NUM.beatPct[l]) + '씩, 최대 3겹' + (l >= 3 ? ' · 34연속이면 음표 비' : ''),
    run: (l) => '2초 쉬지 않고 달리면 이동 +6%·파동 +5% (최대 ' + C.NUM.runMax[l] + '겹)',
    stun: (l) => '고함에 맞은 안개가 ' + (0.5 + C.NUM.stunAdd[l]).toFixed(1) + '초 멈춰요 (큰 안개는 절반)',
    line: (l) => '멈춤이 번지는 둘레 +' + pct(C.NUM.lineK[l] - 1),
    whistle2: (l) => '0.15초 뒤 두 번째 고함 (세기 ' + pct(C.NUM.whistleK[l]) + (l >= 3 ? ', 멈춤까지' : '') + ')',
    stars: (l) => '퍼플팝이 맞히면 별 조각 ' + C.NUM.starsN[l] + '개가 가까운 안개로 더 날아가요',
    stain: (l) => '바닥 물감이 +' + C.NUM.stainAdd[l] + '초 더 오래 남아요',
    bright: (l) => '물감에 물든 안개가 더 빨리 퐁 (+' + pct(C.NUM.brightK[l] - 1) + ')',
    drops: (l) => '베리 방울이 한 번에 ' + C.NUM.dropsN[l] + '개' + (l >= 3 ? ' (하나는 조금 큰 방울)' : ''),
    path: (l) => '꽃 자국 폭 +' + pct(C.NUM.pathK[l] - 1) + (l >= 2 ? ', 밟으면 회복 1칸(' + C.NUM.pathHealCd[l] + '초에 1번)' : ''),
    shaka: (l) => '방울이 ' + pct(C.NUM.shakaK[l] - 1) + ' 더 멀리·빠르게 굴러가요',
    notex2: (l) => '뽑은 뒤 ' + C.NUM.noteX2T[l] + '초 동안 음표 하나가 둘로 쳐져요',
    cheer: (l) => '함께하는 친구의 응원이 +' + pct(C.NUM.cheerK[l] - 1) + ' 더 길게·자주',
    revive: () => '쓰러지면 한 번, ' + C.NUM.reviveDown + '초 뒤 소리 크기 1칸으로 다시 일어나요 (' + C.NUM.reviveGuard + '초 보호)',
  };
  C.desc = (id, lv) => { const f = C.DESC[id]; try { return f ? f(Math.max(1, lv | 0)) : ''; } catch (e) { return ''; } };
  // 지금까지 고른 카드 목록(고른 순서 — G.cards 는 넣은 순서가 유지됨). 이 주인공에게 효과 없는 카드(for 밖·다른 주인공 전용)는 시험용 give 로 받았어도 안 보임
  C.picked = () => Object.keys(TG.G.cards).filter((id) => TG.G.cards[id] > 0 && C.byId[id] && C.fits(C.byId[id])).map((id) => ({ id, name: C.byId[id].name, lv: TG.G.cards[id], max: C.maxOf(id), desc: C.desc(id, TG.G.cards[id]) }));
  C.state = function () { return { beatStk: C.beatStk, beatT: +C.beatT.toFixed(2), beatChain: C.beatChain, beatRains: C.beatRains, runStk: C.runStk, runT: +C.runT.toFixed(2), noteX2T: +C.noteX2T.toFixed(2), noteX2N: C.noteX2N, revived: C.revived, pathCd: +C.pathCd.toFixed(2), pathHeals: C.pathHeals, echoWaves: C.echoWaves, starHits: C.starHits, thickHits: C.thickHits, whistle2N: C.whistle2N, bossStuns: C.bossStuns, dropWaves: C.dropWaves, spdMul: TG.PL ? +TG.PL.spdMul.toFixed(3) : 1 }; };

  // ── 규칙 계산: 함께하는 친구 3종 ──
  const POY_R = 2.7;
  C.sim = function (dt, P, G) {
    const F = TG.F, list = F.list, b = F.boss && F.boss.state === 'fight' ? F.boss : null, N = C.NUM;
    // ── 11-18 새 카드 시계 ──
    if (C.beatT > 0) { C.beatT -= dt; if (C.beatT <= 0) { C.beatT = 0; C.beatStk = 0; C.beatChain = 0; } } // 34 박자: 3초 비면 0으로
    if (G.mod.run) { // 세포런: 쉬지 않고 2초 달리면 1겹(최대 2/3/4겹), 멈추면(0.25초 넘게) 0으로
      const moving = P.speed > P.MAXSPD * 0.45 && !P.resting && !P.airborne;
      if (moving) { C.stopT = 0; C.runT += dt; if (C.runT >= N.runEvery && C.runStk < N.runMax[G.mod.run]) { C.runT -= N.runEvery; C.runStk++; C.recalc(); TG.FX.text('세포런 ' + C.runStk + '겹!', P.x, 3.4, P.z, 'cheer'); TG.A.play('sfx_pick', { rate: 1.4 + C.runStk * 0.2, gain: 0.3 }); } }
      else { C.stopT += dt; if (C.stopT > 0.25 && (C.runStk || C.runT)) { C.runStk = 0; C.runT = 0; C.recalc(); } }
      if (C.runStk && TG.fr() < 0.25 * C.runStk) TG.FX.emit(TG.FX.CELL.sparkle, P.x + TG.fra(-0.5, 0.5), 0.3, P.z + TG.fra(-0.5, 0.5), { vy: TG.fra(1, 2.5), life: 0.3, size: 0.35, size1: 0, color: [2.5, 2.1, 0.8] });
    } else if (C.runStk) { C.runStk = 0; C.runT = 0; C.recalc(); }
    if (C.noteX2T > 0) { C.noteX2T = Math.max(0, C.noteX2T - dt); if (TG.fr() < 0.2) TG.FX.emit(TG.FX.CELL.note, P.x + TG.fra(-0.8, 0.8), 2.2 + TG.fra(0, 0.8), P.z + TG.fra(-0.8, 0.8), { vy: 1.5, life: 0.4, size: 0.4, size1: 0.1, color: [2.4, 2.0, 0.6], rot: 0 }); }
    if (C.pathCd > 0) C.pathCd -= dt;
    // POY 다이얼 링: 몸 둘레를 도는 초록 고리가 닿은 안개를 톡
    const pl = C.lv('poy');
    if (pl > 0) {
      C.poyA += dt * (2.2 + pl * 0.3); C.poyBossCd -= dt;
      const n = pl + 1;
      for (let i = 0; i < n; i++) {
        const a = C.poyA + (i / n) * Math.PI * 2, ox = P.x + Math.sin(a) * POY_R, oz = P.z + Math.cos(a) * POY_R;
        for (let j = 0; j < list.length; j++) {
          const u = list[j];
          if (u.state !== 'live' || u.kind === 'cocoon' || u.spawnT < 0.3 || u.poyCd > 0) continue;
          const rr = u.r * u.scale + 0.55;
          if ((u.x - ox) ** 2 + (u.z - oz) ** 2 < rr * rr) { u.poyCd = 0.9; G.hitUnit(u, 1, P.x, P.z, true, 0, [0.4, 2.2, 0.4]); }
        }
        if (b && C.poyBossCd <= 0 && Math.hypot(b.x - ox, b.z - oz) < b.r * b.scale + 0.5) { C.poyBossCd = 0.6; G.hitBoss(1, ox, oz, true, 0); }
      }
    }
    // WOAD 거품 자국: 지나간 길에 코랄 거품이 남고, 안개가 닿으면 퐁
    const wl = C.lv('woad');
    if (wl > 0) {
      C.woadBossCd -= dt;
      if (C.lastX == null) { C.lastX = P.x; C.lastZ = P.z; }
      if ((P.x - C.lastX) ** 2 + (P.z - C.lastZ) ** 2 > 1.3 * 1.3 && !P.airborne) {
        C.lastX = P.x; C.lastZ = P.z;
        C.trail.push({ x: P.x, z: P.z, t: 0, ph: TG.sr() * 6.28 });
        if (C.trail.length > 6 + wl * 4) C.trail.shift();
      }
      const life = 2.4 + wl * 0.8;
      for (let i = 0; i < C.trail.length; i++) {
        const q = C.trail[i]; q.t += dt;
        let gone = q.t > life;
        if (!gone && q.t > 0.25) {
          for (let j = 0; j < list.length; j++) {
            const u = list[j];
            if (u.state !== 'live' || u.kind === 'cocoon' || u.spawnT < 0.3) continue;
            const rr = u.r * u.scale + 0.65;
            if ((u.x - q.x) ** 2 + (u.z - q.z) ** 2 < rr * rr) { G.hitUnit(u, wl >= 3 ? 2 : 1, q.x, q.z, true, 0, [2.3, 0.9, 0.75]); gone = true; break; }
          }
          if (!gone && b && C.woadBossCd <= 0 && Math.hypot(b.x - q.x, b.z - q.z) < b.r * b.scale + 0.5) { C.woadBossCd = 0.4; G.hitBoss(1, q.x, q.z, true, 0); gone = true; }
          if (gone) TG.FX.popBurst(q.x, 0.5, q.z, 0.7, [2.2, 0.95, 0.8]);
        }
        if (gone) { C.trail.splice(i, 1); i--; }
      }
    }
    // ROGUN 째깍 원판: 파란 원 안의 안개는 느려짐
    //  11-17: 느려짐 배율은 매 걸음 여기서 1 로 되돌리고(원판 안이면 k) → 그 뒤 쎄니 물감 구역(wave.js WV.zones)이 곱함
    const rl = C.lv('rogun');
    { const R = rl > 0 ? C.rogunR(rl) : 0, k = [1, 0.8, 0.68, 0.58][rl];
      for (let j = 0; j < list.length; j++) { const u = list[j]; u.slowK = rl > 0 && (u.x - P.x) ** 2 + (u.z - P.z) ** 2 < R * R ? k : 1; }
      if (F.boss) F.boss.slowK = rl > 0 && Math.hypot(F.boss.x - P.x, F.boss.z - P.z) < R + 2 ? Math.max(0.7, k) : 1;
      // 11-18 허조교 「올려놔!」 카드: 보스도 절반 길이로 뚱 멈춤(wave.js 가 shoutT 를 켬) — 다가오기·다음 동작 시계가 멈춤(이미 시작한 동작은 끝까지)
      if (F.boss && F.boss.shoutCd > 0) F.boss.shoutCd -= dt;
      if (F.boss && F.boss.shoutT > 0) { F.boss.shoutT -= dt; F.boss.slowK = Math.min(F.boss.slowK, 0.02); if (TG.fr() < 0.3) { const a = TG.fr() * 6.283; TG.FX.emit(TG.FX.CELL.star, F.boss.x + Math.cos(a) * 1.6, 5.2 * F.boss.scale + 0.4, F.boss.z + Math.sin(a) * 1.6, { vy: 1.2, life: 0.4, size: 0.45, size1: 0.1, color: [2.4, 2.3, 1.0], rot: 0, vrot: 6 }); } }
    }
  };
  C.rogunR = (lv) => 3.6 + lv * 0.9;

  // ── 그리기 ──
  C.init = function (scene) {
    // POY: 초록 다이얼 고리 (최대 4개) + 바닥 길
    C.poyMesh = [];
    const dg = T.BufferGeometryUtils.mergeGeometries([new T.TorusGeometry(0.42, 0.12, 8, 22), (() => { const g = new T.BoxGeometry(0.1, 0.34, 0.1); g.translate(0, 0.2, 0); return g; })()].map((g) => g.toNonIndexed()));
    const dm = new T.MeshBasicMaterial({ color: new T.Color(0x00ff00).multiplyScalar(1.5) });
    for (let i = 0; i < 4; i++) { const m = new T.Mesh(dg, dm); m.visible = false; scene.add(m); TG.R.addOutline(m, 0.8); C.poyMesh.push(m); }
    C.poyPath = new T.Mesh(new T.RingGeometry(POY_R - 0.06, POY_R + 0.06, 56), new T.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4, depthWrite: false }));
    C.poyPath.rotation.x = -Math.PI / 2; C.poyPath.position.y = 0.07; C.poyPath.renderOrder = 4; C.poyPath.visible = false; scene.add(C.poyPath);
    // WOAD: 코랄 거품 (인스턴스)
    C.woadMesh = new T.InstancedMesh(new T.SphereGeometry(0.5, 12, 9), TG.R.toon({ color: 0xff6f61, rim: 0.9, spec: 0.7, sat: 1.15, gain: 1.15 }), 20);
    C.woadMesh.count = 0; C.woadMesh.frustumCulled = false; C.woadMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(C.woadMesh); TG.R.addOutline(C.woadMesh, 0.8);
    // ROGUN: 파란 째깍 원판 (바닥)
    const g = new T.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    C.rogunMesh = new T.Mesh(g, new T.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: ['uniform float uT; uniform float uA; varying vec2 vUv;',
        'void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard; float an = atan(p.x, p.y);',
        ' float rim = smoothstep(0.92, 0.95, r) * (1.0 - smoothstep(0.985, 1.0, r));',
        ' float tk = step(0.8, r) * step(r, 0.92) * step(0.86, cos(an * 12.0));',
        ' float hand = step(r, 0.78) * smoothstep(0.985, 0.995, cos(an - uT * 1.6)) + step(r, 0.5) * smoothstep(0.98, 0.992, cos(an - uT * 0.25));',
        ' float a = (0.13 + rim * 0.75 + tk * 0.6 + hand * 0.55) * uA; gl_FragColor = vec4(vec3(0.24, 0.48, 1.0) * (1.0 + rim * 0.9 + tk * 0.6 + hand * 0.7), a); }'].join('\n'),
      transparent: true, depthWrite: false,
    }));
    C.rogunMesh.position.y = 0.055; C.rogunMesh.renderOrder = 3; C.rogunMesh.visible = false; C.rogunMesh.frustumCulled = false; scene.add(C.rogunMesh);
  };
  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpP = new T.Vector3();
  C.draw = function (dt, t, P) {
    const on = P.root.visible && TG.G.phase !== 'title';
    const pl = on ? C.lv('poy') : 0, n = pl ? pl + 1 : 0;
    C.poyMesh.forEach((m, i) => {
      const v = i < n; m.visible = v; m.userData.outline.visible = v;
      if (!v) return;
      const a = C.poyA + (i / n) * Math.PI * 2;
      m.position.set(P.rx + Math.sin(a) * POY_R, 1.15 + Math.sin(t * 5 + i) * 0.12, P.rz + Math.cos(a) * POY_R);
      m.rotation.set(-0.75, 0, t * 4 + i); // 카메라 쪽으로 눕혀 고리 모양이 보이게
      m.userData.outline.position.copy(m.position); m.userData.outline.rotation.copy(m.rotation);
      if (TG.fr() < 0.35) TG.FX.emit(TG.FX.CELL.sparkle, m.position.x, m.position.y, m.position.z, { life: 0.25, size: 0.35, size1: 0, color: [0.5, 2.4, 0.5] });
    });
    C.poyPath.visible = n > 0; if (n) C.poyPath.position.set(P.rx, 0.07, P.rz);
    // WOAD
    let k = 0;
    const wl = on ? C.lv('woad') : 0, life = 2.4 + wl * 0.8;
    if (wl) for (const q of C.trail) {
      if (k >= 20) break;
      const s = (q.t < 0.25 ? TG.easeOutBack(q.t / 0.25) : q.t > life - 0.4 ? Math.max(0.05, (life - q.t) / 0.4) : 1) * (1 + Math.sin(t * 4 + q.ph) * 0.07);
      tmpM.compose(tmpP.set(q.x, 0.5 + Math.sin(t * 3 + q.ph) * 0.07, q.z), tmpQ.identity(), tmpS.set(s, s, s));
      C.woadMesh.setMatrixAt(k++, tmpM);
    }
    C.woadMesh.count = k; C.woadMesh.userData.outline.count = k; C.woadMesh.instanceMatrix.needsUpdate = true;
    // ROGUN
    const rl = on ? C.lv('rogun') : 0, u = C.rogunMesh.material.uniforms;
    u.uA.value = TG.damp(u.uA.value, rl ? 1 : 0, 6, dt); u.uT.value = t;
    C.rogunMesh.visible = u.uA.value > 0.02;
    if (rl) { const R = C.rogunR(rl); C.rogunMesh.scale.set(R, 1, R); }
    C.rogunMesh.position.set(P.rx, 0.055, P.rz);
  };

  // ── 아이콘 (캔버스에 직접 그림, 128 기준) ──
  const INK = '#1b1424';
  function ol(c, fill, w) { c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = w || 7; c.strokeStyle = INK; c.stroke(); if (fill) { c.fillStyle = fill; c.fill(); } }
  function arc3(c, x, y, r0, dr, half, col, w) { // 소리 파동 호 3겹
    for (let i = 2; i >= 0; i--) {
      c.beginPath(); c.arc(x, y, r0 + dr * i, -half, half);
      c.lineCap = 'round'; c.lineWidth = (w || 11) + 6; c.strokeStyle = INK; c.stroke();
      c.lineWidth = w || 11; c.strokeStyle = i === 2 ? col : i === 1 ? '#ff8a5b' : '#fff'; c.stroke();
    }
  }
  function note(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.ellipse(-6, 12, 9, 7, -0.4, 0, 6.3); ol(c, col, 5);
    c.beginPath(); c.moveTo(2, 12); c.lineTo(2, -16); c.quadraticCurveTo(14, -12, 14, -2); c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = col; c.stroke();
    c.restore();
  }
  function plus(c, x, y, s, txt) {
    c.font = '900 ' + s + 'px -apple-system, "Apple SD Gothic Neo", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = INK; c.strokeText(txt, x, y); c.fillStyle = '#fff'; c.fillText(txt, x, y);
  }
  const ICON = {
    size(c) { arc3(c, 30, 64, 26, 24, 1.0, '#e5352b', 12); },
    fast(c) {
      arc3(c, 44, 64, 22, 19, 0.8, '#ff8a5b', 10);
      [[38, 12], [26, 16], [38, 20]].forEach(([y, x0]) => { c.beginPath(); c.moveTo(x0 - 8, y * 2.2 - 24); c.lineTo(x0 + 16, y * 2.2 - 24); c.lineWidth = 12; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke(); });
    },
    more(c) {
      arc3(c, 66, 50, 14, 14, 0.8, '#ffc21f', 8);
      c.save(); c.translate(128, 128); c.rotate(Math.PI); arc3(c, 66, 50, 14, 14, 0.8, '#ffc21f', 8); c.restore();
      plus(c, 64, 64, 34, '+1');
    },
    move(c) { // 운동화 + 바람 줄
      c.beginPath(); c.moveTo(40, 52); c.lineTo(62, 50); c.quadraticCurveTo(70, 70, 100, 72); c.quadraticCurveTo(116, 76, 112, 90); c.lineTo(40, 90); c.closePath(); ol(c, '#4fc3f7', 8);
      c.beginPath(); c.moveTo(40, 82); c.lineTo(112, 82); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke();
      [[10, 54, 30], [4, 68, 26], [12, 82, 22]].forEach(([x, y, l]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.lineWidth = 11; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke(); });
    },
    magnet(c) { // 말굽 자석 + 음표
      c.beginPath(); c.arc(64, 62, 34, Math.PI, 0); c.lineTo(98, 100); c.lineTo(78, 100); c.lineTo(78, 62); c.arc(64, 62, 14, 0, Math.PI, true); c.lineTo(50, 100); c.lineTo(30, 100); c.closePath(); ol(c, '#ff5a8a', 8);
      c.fillStyle = '#fff'; c.fillRect(33, 86, 14, 11); c.fillRect(81, 86, 14, 11);
      note(c, 64, 28, 0.9, '#ffd23f');
    },
    heart(c) { // 말풍선 + 소리 줄 + 1
      c.beginPath(); c.moveTo(20, 30); c.quadraticCurveTo(20, 18, 34, 18); c.lineTo(94, 18); c.quadraticCurveTo(108, 18, 108, 30); c.lineTo(108, 68); c.quadraticCurveTo(108, 80, 94, 80); c.lineTo(58, 80); c.lineTo(40, 100); c.lineTo(42, 80); c.lineTo(34, 80); c.quadraticCurveTo(20, 80, 20, 68); c.closePath(); ol(c, '#ff5a4a', 8);
      plus(c, 64, 50, 40, '+1');
    },
    charge(c) { // 큰 소리 버튼 + 번개
      c.beginPath(); c.arc(64, 64, 42, 0, 6.3); ol(c, '#ffd23f', 8);
      c.beginPath(); c.arc(64, 64, 42, -1.57, 2.6); c.lineWidth = 9; c.strokeStyle = '#fff'; c.stroke();
      c.beginPath(); c.moveTo(72, 30); c.lineTo(46, 68); c.lineTo(62, 68); c.lineTo(54, 98); c.lineTo(84, 56); c.lineTo(66, 56); c.closePath(); ol(c, '#e5352b', 7);
    },
    poy(c) { // 초록 다이얼 고리
      c.beginPath(); c.arc(64, 64, 40, 0, 6.3); c.lineWidth = 22; c.strokeStyle = INK; c.stroke(); c.lineWidth = 13; c.strokeStyle = '#00FF00'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.beginPath(); c.moveTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36); c.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
      c.beginPath(); c.arc(64, 64, 13, 0, 6.3); ol(c, '#e5352b', 6);
      c.beginPath(); c.arc(64 + 40 * 0.7, 64 - 40 * 0.7, 10, 0, 6.3); ol(c, '#fff', 6);
    },
    woad(c) { // 코랄 거품 자국
      [[30, 92, 12], [52, 74, 16], [82, 52, 24]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 6.3); ol(c, '#FF6F61', 7); c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.7, 0, 6.3); c.fillStyle = '#fff'; c.fill(); });
    },
    rogun(c) { // 파란 째깍 원판
      c.beginPath(); c.arc(64, 64, 44, 0, 6.3); ol(c, '#3D7BFF', 8);
      c.beginPath(); c.arc(64, 64, 33, 0, 6.3); c.fillStyle = '#dfe9ff'; c.fill();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.beginPath(); c.moveTo(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26); c.lineTo(64 + Math.cos(a) * 31, 64 + Math.sin(a) * 31); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); }
      c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 40); c.moveTo(64, 64); c.lineTo(82, 72); c.lineWidth = 7; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.arc(64, 64, 5, 0, 6.3); c.fillStyle = '#e5352b'; c.fill();
    },
    bounce(c) { // 시안 빔이 점 셋 사이를 지그재그로 튕김
      [[22, 96], [60, 40], [98, 84]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 13, 0, 6.3); ol(c, '#9c98b8', 6); });
      c.beginPath(); c.moveTo(8, 118); c.lineTo(28, 88); c.lineTo(58, 50); c.lineTo(94, 76); c.lineTo(118, 30); c.lineWidth = 15; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 8; c.strokeStyle = '#2fe0f0'; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#eafeff'; c.stroke();
    },
    pierce(c) { // 곧은 시안 빔이 점 둘을 뚫고 지나감
      [[46, 64], [84, 64]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 14, 0, 6.3); ol(c, '#9c98b8', 6); });
      c.beginPath(); c.moveTo(8, 64); c.lineTo(120, 64); c.lineWidth = 16; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 9; c.strokeStyle = '#2fe0f0'; c.stroke(); c.lineWidth = 3; c.strokeStyle = '#eafeff'; c.stroke();
      c.beginPath(); c.moveTo(104, 50); c.lineTo(122, 64); c.lineTo(104, 78); c.lineWidth = 12; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke();
    },
    // ── 11-18 새 16장 ──
    thick(c) { // 굵은 시안 빔이 점 둘을 한 번에 덮음
      [[46, 52], [84, 76]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 13, 0, 6.3); ol(c, '#9c98b8', 6); });
      c.beginPath(); c.moveTo(8, 64); c.lineTo(120, 64); c.lineWidth = 34; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 26; c.strokeStyle = '#2fe0f0'; c.stroke(); c.lineWidth = 8; c.strokeStyle = '#eafeff'; c.stroke();
      for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? '#5ff0ff' : '#eafeff'; c.fillRect(18 + i * 20, 54, 10, 20); }
    },
    echo(c) { // 확성기 + 돌아오는 파동(화살)
      c.beginPath(); c.moveTo(14, 54); c.lineTo(42, 46); c.lineTo(66, 26); c.lineTo(66, 102); c.lineTo(42, 82); c.lineTo(14, 74); c.closePath(); ol(c, '#ff8a5b', 8);
      c.fillStyle = '#fff'; c.fillRect(20, 58, 18, 12);
      arc3(c, 72, 64, 14, 12, 0.75, '#e5352b', 7);
      c.beginPath(); c.moveTo(118, 44); c.lineTo(100, 56); c.lineTo(118, 68); c.lineWidth = 12; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke();
    },
    beat(c) { // 큰 「34」 + 박자 점
      [[28, 104], [52, 104], [76, 104], [100, 104]].forEach(([x, y], i) => { c.beginPath(); c.arc(x, y, i === 3 ? 9 : 6, 0, 6.3); ol(c, i === 3 ? '#ffd23f' : '#fff', 5); });
      c.font = '900 64px -apple-system, "Apple SD Gothic Neo", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.lineWidth = 14; c.strokeStyle = INK; c.strokeText('34', 64, 52); c.fillStyle = '#e5352b'; c.fillText('34', 64, 52);
      c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText('34', 64, 52);
    },
    run(c) { // 달리는 발자국 + 바람 줄 + 파동
      [[30, 80, 1], [62, 60, -1], [94, 80, 1]].forEach(([x, y, f]) => { c.save(); c.translate(x, y); c.scale(f, 1); c.beginPath(); c.ellipse(0, 6, 12, 15, 0.2, 0, 6.3); ol(c, '#ffd966', 6); c.beginPath(); c.ellipse(-3, -16, 7, 8, 0.2, 0, 6.3); ol(c, '#ffd966', 5); c.restore(); });
      [[6, 30, 30], [12, 42, 22], [4, 108, 26]].forEach(([x, y, l]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.lineWidth = 10; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); });
      arc3(c, 96, 34, 10, 9, 0.75, '#e5352b', 6);
    },
    stun(c) { // 멈춘 안개(어질 별) + 시계 바늘
      c.beginPath(); c.arc(56, 72, 30, 0, 6.3); ol(c, '#c9c4e0', 7);
      c.beginPath(); c.arc(46, 68, 4, 0, 6.3); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(66, 68, 4, 0, 6.3); c.fill();
      c.beginPath(); c.arc(56, 84, 7, 0, Math.PI); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      [[22, 30], [50, 18], [78, 30]].forEach(([x, y]) => { c.save(); c.translate(x, y); c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 11, a = (i / 10) * 6.283 - 1.57; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); ol(c, '#ffe88a', 4); c.restore(); });
      c.beginPath(); c.arc(100, 92, 20, 0, 6.3); ol(c, '#a7b04f', 6); c.beginPath(); c.moveTo(100, 92); c.lineTo(100, 78); c.moveTo(100, 92); c.lineTo(110, 98); c.lineWidth = 5; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
    },
    line(c) { // 한 줄로 선 안개 셋 + 넓은 둘레 링
      c.beginPath(); c.ellipse(64, 76, 56, 24, 0, 0, 6.3); c.lineWidth = 12; c.strokeStyle = INK; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#dce383'; c.stroke();
      [[30, 66], [64, 60], [98, 66]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 15, 0, 6.3); ol(c, '#c9c4e0', 6); c.beginPath(); c.arc(x - 5, y - 2, 2.5, 0, 6.3); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(x + 5, y - 2, 2.5, 0, 6.3); c.fill(); });
      c.beginPath(); c.moveTo(12, 34); c.lineTo(116, 34); c.lineWidth = 10; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#a7b04f'; c.stroke();
    },
    whistle2(c) { // 호루라기 + 소리 파동 2줄
      c.beginPath(); c.moveTo(18, 56); c.lineTo(70, 56); c.lineTo(70, 44); c.lineTo(84, 44); c.lineTo(84, 56); c.quadraticCurveTo(96, 62, 84, 78); c.lineTo(52, 84); c.quadraticCurveTo(30, 86, 18, 70); c.closePath(); ol(c, '#a7b04f', 8);
      c.beginPath(); c.arc(52, 70, 7, 0, 6.3); c.fillStyle = INK; c.fill();
      arc3(c, 94, 60, 10, 10, 0.7, '#ffe88a', 6);
      plus(c, 34, 30, 30, '×2');
    },
    stars(c) { // 보라 별 여러 개
      const star = (x, y, r, col) => { c.save(); c.translate(x, y); c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = (i / 10) * 6.283 - 1.57; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); ol(c, col, 6); c.restore(); };
      star(64, 56, 30, '#a46bff'); star(26, 92, 15, '#c9a6ff'); star(102, 92, 15, '#c9a6ff'); star(104, 30, 11, '#e4d2ff'); star(22, 32, 11, '#e4d2ff');
    },
    stain(c) { // 바닥 보라 물감 + 시계
      c.beginPath(); c.moveTo(14, 84); c.quadraticCurveTo(10, 56, 40, 60); c.quadraticCurveTo(52, 40, 74, 54); c.quadraticCurveTo(104, 44, 106, 72); c.quadraticCurveTo(120, 92, 92, 98); c.quadraticCurveTo(70, 112, 44, 100); c.quadraticCurveTo(16, 104, 14, 84); c.closePath(); ol(c, '#7d3fe6', 8);
      c.beginPath(); c.ellipse(46, 74, 12, 5, -0.4, 0, 6.3); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
      c.beginPath(); c.arc(96, 34, 20, 0, 6.3); ol(c, '#fff', 6); c.beginPath(); c.moveTo(96, 34); c.lineTo(96, 20); c.moveTo(96, 34); c.lineTo(106, 40); c.lineWidth = 5; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
    },
    bright(c) { // 물든 안개가 환하게 반짝 → 퐁
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; c.beginPath(); c.moveTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36); c.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54); c.lineWidth = 10; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#fff0a8'; c.stroke(); }
      c.beginPath(); c.arc(64, 64, 28, 0, 6.3); ol(c, '#d6c0ff', 7);
      c.beginPath(); c.arc(54, 58, 3.5, 0, 6.3); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(74, 58, 3.5, 0, 6.3); c.fill();
      c.beginPath(); c.arc(64, 70, 7, 0.2, Math.PI - 0.2); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.ellipse(52, 50, 6, 3.5, -0.6, 0, 6.3); c.fillStyle = '#fff'; c.fill();
    },
    drops(c) { // 핑크 방울 셋(하나 조금 큼)
      [[40, 78, 24], [86, 52, 18], [92, 94, 14]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 6.3); ol(c, '#ff7fb6', 7); c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.18, -0.7, 0, 6.3); c.fillStyle = '#fff'; c.fill(); });
    },
    path(c) { // 넓은 꽃길(꽃 넷) + 하트
      c.beginPath(); c.moveTo(10, 100); c.quadraticCurveTo(64, 60, 118, 100); c.lineWidth = 36; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 26; c.strokeStyle = '#ffe3ef'; c.stroke();
      const fl = (x, y, r) => { for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * 0.6, 0, 6.3); ol(c, '#ff9ccb', 3); } c.beginPath(); c.arc(x, y, r * 0.5, 0, 6.3); ol(c, '#ffe36b', 3); };
      fl(28, 92, 9); fl(64, 76, 10); fl(100, 92, 9);
      c.beginPath(); c.moveTo(64, 46); c.bezierCurveTo(64, 36, 48, 30, 46, 40); c.bezierCurveTo(44, 50, 64, 58, 64, 60); c.bezierCurveTo(64, 58, 84, 50, 82, 40); c.bezierCurveTo(80, 30, 64, 36, 64, 46); c.closePath(); ol(c, '#ff5a4a', 6);
    },
    shaka(c) { // 딸기 마라카스 + 움직임 줄
      c.beginPath(); c.moveTo(58, 120); c.lineTo(70, 120); c.lineTo(76, 70); c.lineTo(52, 70); c.closePath(); ol(c, '#ffe36b', 6);
      c.beginPath(); c.moveTo(64, 20); c.bezierCurveTo(96, 20, 100, 72, 64, 76); c.bezierCurveTo(28, 72, 32, 20, 64, 20); c.closePath(); ol(c, '#ff7fb6', 7);
      [[52, 36], [74, 34], [60, 54], [78, 56]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 3, 0, 6.3); c.fillStyle = '#ffe36b'; c.fill(); });
      c.beginPath(); c.moveTo(56, 18); c.lineTo(64, 8); c.lineTo(72, 18); c.lineWidth = 5; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); c.fillStyle = '#8cf06a'; c.fill();
      [[12, 36, 20], [16, 54, 14], [102, 40, 18], [96, 58, 14]].forEach(([x, y, l]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + 4); c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke(); });
    },
    notex2(c) { // 음표 둘 + ×2
      note(c, 42, 66, 1.6, '#ffd23f'); note(c, 78, 52, 1.2, '#ffb21a');
      plus(c, 92, 100, 34, '×2');
    },
    cheer(c) { // 응원 깃발을 든 작은 친구 + 하트
      c.beginPath(); c.arc(48, 46, 20, 0, 6.3); ol(c, '#e4d2ff', 7);
      c.beginPath(); c.arc(42, 44, 3, 0, 6.3); c.fillStyle = INK; c.fill(); c.beginPath(); c.arc(54, 44, 3, 0, 6.3); c.fill();
      c.beginPath(); c.arc(48, 52, 6, 0.3, Math.PI - 0.3); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(30, 70); c.lineTo(66, 70); c.lineTo(72, 108); c.lineTo(24, 108); c.closePath(); ol(c, '#c9a6ff', 6);
      c.beginPath(); c.moveTo(80, 100); c.lineTo(80, 30); c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke();
      c.beginPath(); c.moveTo(82, 30); c.lineTo(118, 40); c.lineTo(82, 54); c.closePath(); ol(c, '#ff6fae', 6);
      c.beginPath(); c.moveTo(104, 84); c.bezierCurveTo(104, 76, 92, 72, 90, 80); c.bezierCurveTo(88, 88, 104, 96, 104, 98); c.bezierCurveTo(104, 96, 120, 88, 118, 80); c.bezierCurveTo(116, 72, 104, 76, 104, 84); c.closePath(); ol(c, '#ff5a4a', 5);
    },
    revive(c) { // 소리 1칸(말풍선) + 위로 솟는 화살 + 반짝
      c.beginPath(); c.moveTo(34, 50); c.quadraticCurveTo(34, 38, 48, 38); c.lineTo(80, 38); c.quadraticCurveTo(94, 38, 94, 50); c.lineTo(94, 72); c.quadraticCurveTo(94, 84, 80, 84); c.lineTo(62, 84); c.lineTo(50, 98); c.lineTo(52, 84); c.lineTo(48, 84); c.quadraticCurveTo(34, 84, 34, 72); c.closePath(); ol(c, '#ff5a4a', 7);
      c.beginPath(); c.moveTo(64, 78); c.lineTo(64, 46); c.moveTo(50, 62); c.lineTo(64, 46); c.lineTo(78, 62); c.lineWidth = 13; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#8cf06a'; c.stroke();
      [[18, 30], [110, 30], [16, 96], [112, 100]].forEach(([x, y]) => { c.save(); c.translate(x, y); c.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 3 : 9, a = (i / 8) * 6.283 - 1.57; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); ol(c, '#ffe88a', 4); c.restore(); });
    },
    // 쉼터 고르기용
    shield(c) { c.beginPath(); c.arc(64, 64, 42, 0, 6.3); ol(c, 'rgba(143,220,255,0.9)', 8); c.beginPath(); c.ellipse(48, 46, 12, 7, -0.7, 0, 6.3); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.arc(64, 70, 14, 0, 6.3); ol(c, '#e5352b', 6); },
    notes(c) { note(c, 44, 70, 1.5, '#ffd23f'); note(c, 84, 56, 1.2, '#ffb21a'); },
  };
  ICON.heal = function (c) { // 말풍선 3칸이 다 참
    [[34, 44], [64, 44], [94, 44]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x - 13, y - 14); c.lineTo(x + 13, y - 14); c.quadraticCurveTo(x + 17, y - 14, x + 17, y - 9); c.lineTo(x + 17, y + 8); c.quadraticCurveTo(x + 17, y + 13, x + 13, y + 13); c.lineTo(x, y + 13); c.lineTo(x - 8, y + 24); c.lineTo(x - 7, y + 13); c.lineTo(x - 13, y + 13); c.quadraticCurveTo(x - 17, y + 13, x - 17, y + 8); c.lineTo(x - 17, y - 9); c.quadraticCurveTo(x - 17, y - 14, x - 13, y - 14); c.closePath(); ol(c, '#ff5a4a', 6); });
    c.beginPath(); c.moveTo(64, 78); c.lineTo(64, 110); c.moveTo(50, 96); c.lineTo(64, 80); c.lineTo(78, 96); c.lineWidth = 13; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#8cf06a'; c.stroke();
  };
  C.icon = function (id, canvas) {
    const c = canvas.getContext('2d'), S = canvas.width;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    c.setTransform(S / 128, 0, 0, S / 128, 0, 0);
    if (ICON[id]) ICON[id](c);
  };
})();
