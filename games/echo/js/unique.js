/* 에코 제로 — 유니크 5명 「1판 1번 별 버튼」 (2026-11-25 게임팀, 계획 v8 14~17-2쪽 · 유니크큰소리_기획_20261117 · 회의 11-18 해병 모드 · 11-19 세포키즈유니크)
   · 유니크 카드(js/collect.js, 0.1%·천장 없음·도감 완성 조건 밖)를 끼고 **그 캐릭으로** 플레이할 때만 큰 소리 버튼 위 작은 ★ 버튼. 한 판 1번, 충전 없음, 자동 모드에서도 직접 눌러야 함(봇·자동은 절대 안 누름).
   · 공통 틀(가치 같음, 순위 공정): 연출 2.8초(끝까지 모드 1.5초 짧은판) + 건너뛰기 → 연출 중 나는 안전·안개 정지 → 층 전체 퐁(가까운 것부터) + 보스 30 → 5초 작은 보너스 1개(세포만 10초 필승 모드). 흔들림 0 · 하얀 번쩍 X · 깜빡임 초당 3회 이하.
   · 5명(11-20 ★안 정함): 세포 「필승 모드!」(해병 모드 A안: 팔각모 「모양」+빨강·노랑 「색」만, 빨간 명찰 「세포」, 실제 마크·계급장·무늬 X) · 허조교 「전원 집합!」 · 모쉬 「픽셀 폭죽」 · 쎄니 「보라 세상」 · 베리 「베리 비!」.
     세포는 한 카드 두 연출 — 11-26 2번째 「세포키즈 출동!」 들어옴(U.ALT.kids): 도감 세포 유니크 카드에서 고름(K.data.alt.sefo = 'kids', 판 시작 전에만) → 세포키즈 8명(코드 도형 1벌 + 색·머리·크기 변형, InstancedMesh 19부분 = 8명이어도 그리기 약 37번, 3D 모델·크레딧 0)이 쏟아져 나와 맵을 휘저으며 춤 → 다 같이 「쿵!」 → 층 전체 퐁 → 5초 세포키즈 3명이 세포 둘레를 돌며 가까운 안개 퐁(회의 11-19 1-6 보너스, [추정]).
     얼굴은 임의(8명 같은 얼굴·이름 X·실제 아이 닮게 X·사진·AI 생성 0) — 그림체만 어린이클럽 홈페이지 캐릭터(보라 34 저지·흰 카고 바지·하트 선글라스). 기록 칸 rec.uqk = 'kids'(고른 판만) → 재생 같은 연출.
   · 입력 기록(game.js nextInput 깃발 16384 = ★ 누름 · 32768 = 건너뛰기) → 같은 시드·같은 기록이면 같은 결과. 유니크 없는 판은 깃발이 0 이라 결과 그대로(기록 판 번호 REC_V 7 유지).
   · 목소리는 **임시**(크레딧 0): assets/audio/uq_<id>.mp3 가 있으면 그걸(js/pack_audio.js), 없으면 audio.js 합성 「부름」 소리(A.TEMP_LOOPS uq_*) + 말풍선 자막. 대표·본인 녹음이 오면 파일만 넣고 tools/pack_assets.py → 코드 수정 0.
   · 그림 전부 코드 도형·기존 효과(FX)·기존 3D 모델 — 실제 얼굴·AI 생성 0. 쎄니·베리(어린이)는 귀엽게·순한 말만.
   · 끝까지 모드(?rank=1): 유니크 수치는 랭킹에도 유지(대표 결정) — 가진 사람은 그대로 발동(1.5초 짧은판). 「빌린 별」(⑱ 누구나 1번)은 다음 일. */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const U = (TG.U = {});
  U.PROB = 0.1;                                 // % — 화면 글(카드 확률표는 collect.js K.PROB 가 원본)
  U.DUR = { normal: 2.8, rank: 1.5 };           // 연출 길이(초) — 일반 / 끝까지 모드 짧은판 (+건너뛰기)
  U.BOSS = 30;                                  // 보스 피해(기본 큰 소리 세포 16 의 약 2배)
  U.FLAG = { star: 16384, skip: 32768 };        // 입력 깃발(game.js nextInput)
  U.KEYS = ['sefo', 'gunner', 'moshee', 'sseni', 'berri'];
  // 연출 숫자표(전부 회의 [추정] 시작값 — 12/2 측정(measure_heroes --unique)으로 ±5% 맞춤). 화면 글은 퐁·반짝·회복(공격·필살 X)
  U.DEFS = {
    sefo: { id: 'sefo', name: '필승 모드!', say: '필승!', voice: 'uq_sefo', color: 0xe5352b, color2: 0xffd23f,
      desc: '팔각모 쓰고 「필승!」 → 층 전체 퐁 + 보스 30 → 10초 필승 모드(범위 +20% · 간격 −20% · 이동 +15%)',
      bonus: { kind: 'power', dur: 10, range: 0.20, rate: 0.20, move: 0.15 }, endSay: '필승 모드 끝!', during: '힘이 넘쳐요!',
      alt: { key: 'kids', name: '세포키즈 출동!', ready: true, note: '' } }, // 11-19 한 카드 두 연출 → 11-26 2번째 연출 들어옴(U.ALT.kids). 도감 세포 유니크 카드에서 고름
    gunner: { id: 'gunner', name: '전원 집합!', say: '전원 집합!', voice: 'uq_gunner', color: 0xa7b04f, color2: 0xffe88a,
      desc: '호루라기 → 네 친구가 달려와 큰 소리 짧게 → 경례! → 층 전체 퐁 + 보스 30 → 5초 멈춤 둘레 2배',
      bonus: { kind: 'stunR', dur: 5, k: 2 } },
    moshee: { id: 'moshee', name: '픽셀 폭죽', say: '픽셀 폭죽!', voice: 'uq_moshee', color: 0x2fe0f0, color2: 0xff5fb8,
      desc: '큐브 ★_★ 번쩍 → 픽셀 빔이 바둑판으로 층 전체 → 전부 퐁 + ^_^ → 5초 푸슝 빔 튕김 +2',
      bonus: { kind: 'bounce', dur: 5, n: 2 } },
    sseni: { id: 'sseni', name: '보라 세상', say: '보라 세상!', voice: 'uq_sseni', color: 0xa46bff, color2: 0xe4d2ff,
      desc: '손 한 번 흔들면 층 전체가 보라로 물들어 반짝이로 퐁 → 5초 안개 느려짐 · 나 빨라짐',
      bonus: { kind: 'slow', dur: 5, fog: 0.6, move: 0.25 } },
    berri: { id: 'berri', name: '베리 비!', say: '베리 비!', voice: 'uq_berri', color: 0xff7fb6, color2: 0xfff0a8,
      desc: '마라카스 샤카샤카 → 딸기 방울 비가 층 전체에 톡톡 → 전부 퐁 + 나(와 친구) 회복 1칸',
      bonus: { kind: 'heal', n: 1 } },
  };
  // 11-26 세포 2번째 연출(같은 카드·같은 틀·가치 같음 ±5% 목표): 보너스는 5초 세포키즈 3명이 세포 둘레(반지름 2.3)를 돌며 0.6초마다 자기 1.7 안 가장 가까운 안개를 퐁 — [추정] 12/2 측정(measure_heroes --unique own_b)으로 필승 모드·빌린 별과 ±5% 맞춤(안 맞으면 n 2~4·every 만 조절)
  U.ALT = {
    kids: { id: 'sefo', key: 'kids', vis: 'kids', name: '세포키즈 출동!', say: '세포키즈 출동!', voice: 'uq_sefo_kids', color: 0x7a4fe6, color2: 0x2fd9c0,
      desc: '세포키즈 8명이 쏟아져 나와 맵을 휘저으며 춤 → 다 같이 「쿵!」 → 층 전체 퐁 + 보스 30 → 5초 세포키즈 3명이 세포 둘레를 돌며 가까운 안개 퐁',
      bonus: { kind: 'kids', dur: 5, n: 3, r: 2.3, reach: 1.7, every: 0.6, w: 2.4 }, endSay: '또 만나요!', during: '같이 춤춰요!' },
  };
  U.altOf = function (hero) { const d = U.DEFS[hero]; if (!d || !d.alt || !d.alt.ready) return 'power'; const K = TG.K; const k = K && K.data && K.data.alt ? K.data.alt[hero] : null; return k === d.alt.key ? k : 'power'; };
  U.pick = function (hero, key) { // 도감(타이틀)에서만 — 판 안에서는 못 바꿈(이번 판 def 는 setup 때 정해짐)
    const d = U.DEFS[hero], K = TG.K; if (!d || !d.alt || !d.alt.ready || !K || !K.data) return false;
    if (key !== 'power' && key !== d.alt.key) return false;
    if (!K.data.alt || typeof K.data.alt !== 'object') K.data.alt = {};
    if (key === 'power') delete K.data.alt[hero]; else K.data.alt[hero] = key;
    K.save(); return true;
  };
  U.defFor = function (hero, altKey) { const d = U.DEFS[hero] || null; if (d && d.alt && d.alt.ready && altKey === d.alt.key && U.ALT[altKey]) return U.ALT[altKey]; return d; };
  const G = () => TG.G, P = () => TG.PL, F = () => TG.F, FX = () => TG.FX, A = () => TG.A, H = () => TG.H;
  const fra = (a, b) => TG.fra(a, b);

  // ── 판 시작(game.js startPlay 뒤): 이 판에 ★ 가 있나 ──
  U.setup = function () {
    const g = G(), hero = TG.heroId;
    let avail = false, def = null;
    if (U.DEFS[hero]) {
      if (g.replay) { avail = true; def = U.defFor(hero, g.replay.uqk || 'power'); }                      // 기록이 정함(깃발이 있어야만 발동) — 11-26 연출은 기록 칸 uqk
      else { avail = !!(TG.K && TG.K.has(TG.K.uid(hero)) && TG.K.data.eq.indexOf(TG.K.uid(hero)) >= 0); def = U.defFor(hero, U.altOf(hero)); } // 유니크 카드를 끼고 그 캐릭으로 · 고른 연출
    }
    g.uq = { def, avail, used: false, act: null, bonus: null, bonusT: 0, bonusDur: 0, pops: 0, bossHit: 0, n: 0, skipped: false, voice: null, healed: 0, pressDeny: 0, kidPops: 0, kidT: 0, kidPos: null };
    g.uqPose = false;
    U.clearVis();
    U.sync();
  };
  U.clear = function () { const g = G(); if (g.uq && g.uq.act) U.end(true); U.bonusStop(true); g.uq = null; g.uqPose = false; U.clearVis(); U.sync(); };
  U.canUse = function () { const g = G(); return !!(g.uq && g.uq.avail && !g.uq.used && !g.uq.act && (g.phase === 'floor' || g.phase === 'boss') && !P().airborne && !P().resting); };
  // 입력(한 걸음): ★ 누름 / 건너뛰기 — game.js step 이 깃발로 부름(기록·재생 같은 길)
  U.press = function () {
    const g = G(); if (!g.uq || !g.uq.def) return false;
    if (!U.canUse()) {
      if (g.realT - (g.uq.pressDeny || -9) > 0.4) { g.uq.pressDeny = g.realT; H().starDeny(g.uq.used ? '다음 판에!' : g.uq.act ? '잠깐!' : '아직!'); A().ui(0.55); }
      return false;
    }
    U.start(); return true;
  };
  U.skip = function () { const g = G(), a = g.uq && g.uq.act; if (!a || a.fired) return false; a.t = a.dur; a.skipped = true; g.uq.skipped = true; return true; };

  // ── 시작: 안개 정지·나 안전 → 캐릭별 연출 ──
  U.start = function () {
    const g = G(), p = P(), def = g.uq.def, dur = g.rankMode ? U.DUR.rank : U.DUR.normal;
    g.uq.used = true;
    const a = (g.uq.act = { t: 0, dur, fired: false, skipped: false, x: p.x, z: p.z, step: 0, hero: def.vis || def.id, timers: {}, wide: false });
    p.noHurt = Math.max(p.noHurt, dur + 0.8);
    FX().trauma = 0; // 흔들림 0
    let n = 0;
    for (const u of F().list) {
      if (u.state !== 'live' || u.kind === 'cocoon') continue;
      u.byBig = true; u.vx = u.vz = 0; if (u.leap) u.leap = null; if (u.dash) u.dash = 0; if (u.fly) u.fly = null;
      if (def.id === 'gunner') { u.stun = dur + 0.3; u.stunK = 0; u.dance = 0; } // 허조교: 차렷(멈춤) — 교관 맛
      else { u.dance = dur + 0.3; u.danceK = 0; u.stun = 0; }                      // 나머지: 홀린 듯(닿는 판정 없음)
      u.uq = true; n++;
    }
    g.uq.n = n;
    A().duck(0.35, dur + 0.6); A().ui(1.3);
    H().starFire(); H().cuSkip(true); document.body.classList.add('uqAct');
    g.uqPose = true; g.idleHold(p, true);
    U.voice(def);
    H().say(def.say, Math.min(1.8, dur));
    const vis = VIS[def.vis || def.id]; if (vis && vis.start) vis.start(a);
  };
  // 목소리(임시): 파일이 있으면 그 파일, 없으면 합성 부름 소리(audio.js TEMP_LOOPS uq_*) — 둘 다 같은 키 A.play('uq_<id>'). 자막은 H.say
  U.voice = function (def) {
    const g = G(); if (!def.voice) return;
    g.uq.voice = A().tempUsed && A().tempUsed[def.voice] ? 'temp' : A().buffers[def.voice] ? 'file' : 'none';
    A().play(def.voice, { gain: 0.95 });
  };
  U.voiceInfo = () => U.KEYS.map((k) => U.DEFS[k]).concat(Object.keys(U.ALT).map((k) => U.ALT[k])).map((d) => ({ id: d.key ? d.id + '_' + d.key : d.id, key: d.voice, path: 'assets/audio/' + d.voice + '.mp3', has: !!(A().buffers && A().buffers[d.voice]), temp: !!(A().tempUsed && A().tempUsed[d.voice]), say: d.say })); // 11-26 6개(세포키즈 uq_sefo_kids 포함)

  // ── 걸음마다(game.js step: C.sim·WV.zones 뒤, F.update 앞) ──
  U.sim = function (dt) {
    const g = G(), p = P(); if (!g.uq) return;
    const a = g.uq.act;
    if (a && !(g.phase === 'floor' || g.phase === 'boss' || g.phase === 'bossEnd')) { U.end(true); return; } // 판이 끝나면(쓰러짐·결과) 연출만 접음
    if (a) {
      a.t += dt; p.noHurt = Math.max(p.noHurt, 0.8); FX().trauma = 0;
      if (p.cuPose) { p.cuPose.t += dt; if (p.cuPose.t >= p.cuPose.dur) { p.cuPose = null; } }
      const vis = VIS[a.hero]; if (vis && vis.tick) vis.tick(a, dt);
      if (!a.fired && a.t >= a.dur) { a.fired = true; U.fire(a); }
      if (a.fired && a.t >= a.dur + 0.35) U.end(false);
    }
    if (g.uq.bonus) {
      const b = g.uq.bonus;
      if (b.kind === 'slow') { for (const u of F().list) if (u.state === 'live' && u.kind !== 'cocoon') { u.slowK *= b.fog; u.mistT = Math.max(u.mistT || 0, 0.12); } const bs = F().boss; if (bs && bs.state === 'fight') bs.slowK = Math.min(bs.slowK, Math.max(0.7, b.fog)); } // 보라 세상: 안개 느려짐(cards.js 가 되돌린 slowK 에 곱함) + 보라 물듦 표시
      if (b.kind === 'kids') U.kidsBonus(b, dt); // 11-26 세포키즈 3명: 세포 둘레를 돌며 가까운 안개 퐁(규칙 — 난수 0, 기록 재생 같음)
      g.uq.bonusT -= dt;
      const vis = VIS[g.uq.def.vis || g.uq.def.id]; if (vis && vis.bonusTick) vis.bonusTick(g.uq, dt);
      if (g.uq.bonusT <= 0) U.bonusStop(false);
    }
  };
  // 11-26 세포키즈 보너스(규칙): n 명이 세포 둘레 r 을 각속도 w 로 돌고(자리 = 지난 시간으로만 계산 → 재생 같음), every 초마다 각자 reach 안 가장 가까운 안개 하나를 퐁(99 = 큰 소리와 같은 길 hitUnit)
  U.kidsBonus = function (b, dt) {
    const g = G(), p = P(), q = g.uq, el = q.bonusDur - q.bonusT, pos = [];
    for (let i = 0; i < b.n; i++) { const ang = el * b.w + i * (6.2832 / b.n); pos.push({ x: p.x + Math.sin(ang) * b.r, z: p.z + Math.cos(ang) * b.r, ang }); }
    q.kidPos = pos; q.kidT += dt;
    if (q.kidT >= b.every) {
      q.kidT -= b.every;
      const live = F().list.filter((u) => u.state === 'live' && u.kind !== 'cocoon'), hits = [];
      for (const k of pos) { let best = null, bd = b.reach * b.reach; for (const u of live) { if (hits.indexOf(u) >= 0) continue; const d = (u.x - k.x) ** 2 + (u.z - k.z) ** 2; if (d < bd) { bd = d; best = u; } } if (best) { hits.push(best); k.hit = true; } }
      for (const u of hits) { if (u.state === 'live') { q.kidPops++; g.hitUnit(u, 99, p.x, p.z, true, 3); } }
    }
  };
  // ── 연출 끝 → 층 전체 퐁(가까운 것부터) + 보스 30 + 보너스 시작 ──
  U.fire = function (a) {
    const g = G(), p = P(), def = g.uq.def, x = p.x, z = p.z, fx = FX();
    A().play('sfx_big', { gain: 0.9 }); A().boom(); fx.punch(0.08); TG.R.bloomPulse = 0.35; g.vib && g.vib('big');
    fx.ring(x, z, { r0: 0.8, r1: 30, dur: 0.7, color: def.color, width: 0.14, hdr: 1.5 });
    fx.ring(x, z, { r0: 0.8, r1: 26, dur: 0.8, color: def.color2, width: 0.1, delay: 0.1, hdr: 1.3, alpha: 0.85 });
    fx.ring(x, z, { wall: true, r0: 2.2, r1: 28, dur: 0.7, color: def.color, h: 1.6, alpha: 0.4, hdr: 1 });
    fx.noteFlower(x, z, 9);
    fx.text('전부 퐁!', x, 4.6, z, 'cheer');
    for (const u of F().list) { // 층 전체(연출 중 새로 나온 안개도)
      if (u.state !== 'live' || u.kind === 'cocoon') continue;
      u.dance = 0; u.stun = 0; u.uq = false; u.byBig = true;
      const d = Math.hypot(u.x - x, u.z - z);
      g.after(1 + Math.round(d * 0.9), () => { if (u.state === 'live') { g.uq.pops++; g.hitUnit(u, 99, x, z, true, 3); } });
    }
    const b = F().boss;
    if (b && b.state === 'fight') { g.hitBoss(U.BOSS, b.x, b.z, true); g.uq.bossHit += U.BOSS; }
    const vis = VIS[def.vis || def.id]; if (vis && vis.fire) vis.fire(a);
    U.bonusStart(def);
  };
  U.end = function (force) {
    const g = G(), p = P(); if (!g.uq || !g.uq.act) return;
    const vis = VIS[g.uq.act.hero]; if (vis && vis.end) vis.end(g.uq.act, force);
    g.uq.act = null; g.uqPose = false; p.cuPose = null; g.idleHold(p, false);
    document.body.classList.remove('uqAct'); if (!g.cu) H().cuSkip(false);
  };
  // ── 보너스(5초 1개 · 세포 10초) ──
  U.bonusStart = function (def) {
    const g = G(), p = P(), b = def.bonus; if (!b) return;
    if (b.kind === 'heal') { // 베리: 나(와 친구) 회복 1칸 — 10초 1칸 상한 밖(유니크만 예외)
      if (p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + b.n); g.uq.healed++; FX().text('회복!', p.x + 1.6, 4.6, p.z, 'heal'); p.glow = 0.8; }
      else FX().text('소리 가득!', p.x + 1.6, 4.6, p.z, 'word');
      A().syn('rescue'); return;
    }
    g.uq.bonus = b; g.uq.bonusT = b.dur; g.uq.bonusDur = b.dur;
    if (TG.C && TG.C.recalc) TG.C.recalc();
    if (def.during) g.after(30, () => { if (g.uq && g.uq.bonus) FX().text(def.during, P().x, 4.2, P().z, 'cheer'); });
  };
  U.bonusStop = function (quiet) {
    const g = G(); if (!g.uq || !g.uq.bonus) return;
    const def = g.uq.def; g.uq.bonus = null; g.uq.bonusT = 0; g.uq.kidPos = null;
    if (TG.C && TG.C.recalc) TG.C.recalc();
    const vis = VIS[def.vis || def.id]; if (vis && vis.bonusEnd) vis.bonusEnd(quiet);
    if (!quiet && def.endSay) { H().say(def.endSay, 1.2); FX().text(def.endSay, P().x, 4.2, P().z, 'word'); }
  };
  // 규칙 쪽 숫자(wave.js WV.stat · cards.js recalc 가 부름) — 보너스 중에만 0 이 아님
  U.bonusOf = (kind) => { const g = G(); return g && g.uq && g.uq.bonus && g.uq.bonus.kind === kind ? g.uq.bonus : null; };
  U.move = () => { const g = G(); return g && g.uq && g.uq.bonus && g.uq.bonus.move ? g.uq.bonus.move : 0; };
  U.stat = function (o, st) {
    const g = G(), b = g && g.uq && g.uq.bonus; if (!b) return o;
    if (b.kind === 'power') { o.range *= 1 + b.range; o.cd *= 1 - b.rate; }               // 세포 필승 모드: 범위 +20% · 간격 −20%
    else if (b.kind === 'stunR' && st && st.shout) { o.splash *= b.k; }                   // 허조교: 멈춤 둘레 2배
    else if (b.kind === 'bounce' && st && st.bolt) { o.bounce = (o.bounce || 0) + b.n; } // 모쉬: 푸슝 빔 튕김 +2
    return o;
  };
  U.state = function () {
    const g = G(); if (!g || !g.uq) return null; const q = g.uq;
    return { hero: q.def ? q.def.id : null, name: q.def ? q.def.name : null, avail: q.avail, used: q.used, act: q.act ? { t: +q.act.t.toFixed(2), dur: q.act.dur, fired: q.act.fired, skipped: q.act.skipped, step: q.act.step } : null,
      bonus: q.bonus ? q.bonus.kind : null, bonusT: +q.bonusT.toFixed(2), bonusDur: q.bonusDur, pops: q.pops, bossHit: q.bossHit, n: q.n, skipped: q.skipped, voice: q.voice, healed: q.healed,
      btn: H().btnStar ? { shown: !H().btnStar.classList.contains('hide') && !!(H().hud && !H().hud.classList.contains('hide')), used: H().btnStar.classList.contains('used'), label: (H().starLbl || {}).textContent || '' } : null,
      hat: !!(vis.hat && vis.hat.visible), proxies: vis.proxies ? vis.proxies.filter((o) => o.visible).length : 0, alt: q.def ? (U.DEFS[q.def.id] && U.DEFS[q.def.id].alt ? U.DEFS[q.def.id].alt.name : null) : null,
      altKey: q.def ? (q.def.key || 'power') : null, kidPops: q.kidPops, kids: KIDS.shown(), kidPos: q.kidPos ? q.kidPos.map((k) => [+k.x.toFixed(2), +k.z.toFixed(2)]) : null };
  };
  // HUD 동기화(game.js 가 phase 바뀔 때·hud.js H.update 가 매 프레임)
  U.sync = function () { if (H().starSync) H().starSync(G()); };

  // ── 그림(규칙과 무관): 캐릭별 연출 ──
  const vis = { hat: null, badge: null, proxies: null, built: {} };
  U.vis = vis;
  U.clearVis = function () { if (vis.hat) vis.hat.visible = false; if (vis.badge) vis.badge.visible = false; if (vis.proxies) vis.proxies.forEach((o) => { o.visible = false; }); KIDS.hideAll(); };
  U.kidsState = () => KIDS.state();
  const pose = (name, dur) => { const p = P(); p.cuPose = { name, t: 0, dur: dur || 9 }; };
  const every = (a, key, iv, fn) => { const t = a.timers; if (t[key] == null) t[key] = a.t; if (a.t - t[key] >= iv) { t[key] = a.t; fn(); } };
  // 세포 팔각모(코드 도형: 팔각 기둥 + 챙, 빨강·노랑 색만 — 실제 마크·계급장·무늬 X) + 가슴 빨간 명찰 「세포」. Head·Spine02 뼈 자식, 처음엔 숨김
  function buildSefo() {
    const p = P(), B = p.bones; if (!B || !B.Head || vis.hat || !p.toon || !p.body) return;
    const red = p.toon({ color: 0xe5352b, gain: 1.1, rim: 0.4, spec: 0.25 }), yel = p.toon({ color: 0xffd23f, gain: 1.15, rim: 0.5, spec: 0.4 }), ink = p.toon({ color: 0x1b1424, gain: 0.9 });
    // 크기 = 월드 단위(body 자식 — 뼈 스케일·headScale 과 무관). 머리 반지름은 모델 경계 상자로 잼
    const box = new T.Box3().setFromObject(p.model), top = box.max.y, hw = (box.max.x - box.min.x) * 0.5;
    const r = TG.clamp(hw * 0.88, 0.5, 0.95); // 세포 v0 머리 너비 약 2.0 → r 0.89
    const g = new T.Group();
    const tp = new T.Mesh(new T.CylinderGeometry(r * 0.86, r * 0.96, r * 0.5, 8), red); tp.position.y = r * 0.42; g.add(tp); TG.R.addOutline(tp, 1.0);
    const band = new T.Mesh(new T.CylinderGeometry(r * 1.0, r * 1.0, r * 0.13, 8), yel); band.position.y = r * 0.18; g.add(band);
    const brim = new T.Mesh(new T.CylinderGeometry(r * 1.12, r * 1.18, r * 0.11, 24), ink); brim.position.set(0, r * 0.1, r * 0.42); brim.scale.set(1, 1, 0.72); g.add(brim);
    const mark = new T.Mesh(new T.CircleGeometry(r * 0.2, 16), yel); mark.position.set(0, r * 0.5, r * 0.9); g.add(mark); // 앞 마크 자리 = 노란 동그라미(실제 마크 X)
    g.visible = false; g.userData.top = top; g.userData.r = r;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 9; } });
    p.body.add(g); vis.hat = g;
    { // 명찰: 빨간 바탕 흰 글 「세포」(캔버스) — 가슴 앞(Spine02 자리 + 보는 쪽)
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 48; const c = cv.getContext('2d');
      c.fillStyle = '#e5352b'; c.fillRect(0, 0, 128, 48); c.strokeStyle = '#1b1424'; c.lineWidth = 6; c.strokeRect(3, 3, 122, 42);
      c.fillStyle = '#fff'; c.font = '900 30px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('세포', 64, 26);
      const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
      const m = new T.Mesh(new T.PlaneGeometry(r * 0.9, r * 0.34), new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide }));
      m.visible = false; m.renderOrder = 10; p.body.add(m); vis.badge = m;
    }
  }
  const hv = new T.Vector3();
  function followSefo() { // 매 걸음: 모자는 머리 뼈 위, 명찰은 가슴 뼈 앞(보는 쪽). 그림만
    const p = P(), B = p.bones; if (!vis.hat || !B) return;
    const hat = vis.hat, r = hat.userData.r;
    if (hat.visible && B.Head) { B.Head.getWorldPosition(hv); p.body.worldToLocal(hv); hat.position.set(hv.x, hv.y + 0.82, hv.z + 0.02); hat.rotation.y = 0; } // 머리 뼈 1.96 · 머리 꼭대기 3.22 → 챙이 이마 위(약 2.8)
    if (vis.badge && vis.badge.visible && B.Spine02) { B.Spine02.getWorldPosition(hv); p.body.worldToLocal(hv); vis.badge.position.set(hv.x + 0.16, hv.y + r * 0.25, hv.z + r * 1.0); }
  }
  // 허조교 「전원 집합!」 친구 4명 — 고른 주인공 GLB 만 받으므로 다른 4명은 코드 도형 대역(둥근 머리 + 몸, 그 캐릭 색 + 이름 글). [대표 확인: 실제 3D 로 바꾸려면 모델 4개를 더 받아야 함]
  function buildProxies() {
    if (vis.proxies || !P().toon) return;
    const sc = TG.R.scene, out = [];
    ['sefo', 'moshee', 'sseni', 'berri'].forEach((id) => {
      const h = TG.HEROES[id], mat = P().toon({ color: h.color, gain: 1.05, rim: 0.4, spec: 0.3 }), skin = P().toon({ color: 0xffe0c2, gain: 1.05, rim: 0.3 });
      const g = new T.Group(), kid = h.kid ? 0.84 : 1;
      const body = new T.Mesh(T.CapsuleGeometry ? new T.CapsuleGeometry(0.55 * kid, 0.9 * kid, 6, 14) : new T.CylinderGeometry(0.55 * kid, 0.6 * kid, 1.6 * kid, 14), mat); body.position.y = 1.0 * kid; g.add(body); TG.R.addOutline(body, 1.0);
      const head = new T.Mesh(id === 'moshee' ? new T.BoxGeometry(1.0, 1.0, 1.0) : new T.SphereGeometry(0.62 * kid, 18, 14), id === 'moshee' ? P().toon({ color: 0x1b1424, gain: 1.0, rim: 0.5 }) : skin); head.position.y = (1.95) * kid; g.add(head); TG.R.addOutline(head, 1.0);
      const cap = new T.Mesh(new T.SphereGeometry(0.64 * kid, 18, 10, 0, 6.283, 0, 1.2), mat); cap.position.y = 2.02 * kid; g.add(cap);
      if (id === 'moshee') { const eyes = new T.Mesh(new T.PlaneGeometry(0.7, 0.3), new T.MeshBasicMaterial({ color: 0x2fe0f0 })); eyes.position.set(0, 2.0, 0.51); g.add(eyes); }
      g.visible = false; g.userData.id = id; g.userData.name = h.name; g.userData.col = h.color; g.userData.bigSay = h.bigSay;
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.renderOrder = 9; } });
      sc.add(g); out.push(g);
    });
    vis.proxies = out;
  }

  // ── 11-26 세포키즈 8명(그림만): 코드 도형 1벌 → InstancedMesh 19부분(머리·머리카락·양갈래 2·똥머리·하트 선글라스·저지·벨트·바지·다리 2·주머니 2·신발 2·팔 2·소매 2), 8명 = 보이지 않는 뼈대(Object3D) 8벌의 matrixWorld 를 매 걸음 부분마다 setMatrixAt
  //    · 색·머리·크기만 다름(피부 4톤·머리카락 5색·머리 모양 4(양갈래 높·낮/똥머리/짧게)·신발 4색·선글라스 2색·키 ±5%) — 얼굴은 8명 같은 그림(임의 얼굴·실제 아이 X·이름 X). 키 2.67~2.93(세포 3D 3.34 의 80~88%, 비율_기준 아이) · 2.4등신(머리 1.16)
  //    · 그림체: 어린이클럽 홈페이지 캐릭터(_site/kids/img/sefokids_char.webp) — 보라 34 저지(청록 숫자·흰 단추 줄)·흰 카고 바지(허벅지 주머니)·머리 위 하트 선글라스·운동화. 로봇 X · 3D 모델 X · 크레딧 0
  const KIDS = { N: 8, H: 2.8, built: false, group: null, parts: {}, rigs: [], kids: [], mode: 'off' };
  const kidHk = (i) => 0.955 + (i % 4) * 0.0267 + (i >= 4 ? 0.0133 : 0); // 8명 키 변형(순서 고정)
  const KCOL = { jersey: 0x6b3fd6, num: 0x2fd9c0, white: 0xffffff, skins: [0xffe3c8, 0xf6d2b0, 0xe9b98f, 0xd9a278], hairs: [0x5a3a22, 0x2b1d14, 0x8a4b2a, 0x3f2a1e, 0x6e4a2e], shoes: [0xffffff, 0xff9ad1, 0x9ff2e2, 0xfff28a], glasses: [0xff5fb8, 0xb34bff] };
  function kidCanvas(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = TG.R.maxAniso || 4; return tx; }
  function kidBuild() {
    if (KIDS.built) return; KIDS.built = true;
    const R = TG.R, sc = R.scene, grp = (KIDS.group = new T.Group()); grp.name = 'sefokids'; grp.visible = false; sc.add(grp);
    const N = KIDS.N;
    // 얼굴(흰 바탕 → instanceColor 피부색이 곱해짐): 까만 둥근 눈 + 흰 반짝임 + 웃는 입 + 볼 — 8명 같은 임의 얼굴. 구 UV 앞(+z) = u 0.25
    const faceTx = kidCanvas(256, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); const cx = 64, cy = 66;
      c.fillStyle = '#ffb3c0'; c.globalAlpha = 0.7; [[cx - 30, cy + 10], [cx + 30, cy + 10]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 7, 4.5, 0, 0, 6.283); c.fill(); }); c.globalAlpha = 1;
      c.fillStyle = '#1b1424'; [[cx - 15, cy - 2], [cx + 15, cy - 2]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 5.2, 6.4, 0, 0, 6.283); c.fill(); });
      c.fillStyle = '#fff'; [[cx - 17, cy - 5], [cx + 13, cy - 5]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 1.9, 0, 6.283); c.fill(); });
      c.strokeStyle = '#1b1424'; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy + 6, 8, 0.25, 2.89); c.stroke(); // 웃는 입
      c.fillStyle = '#e8536d'; c.beginPath(); c.arc(cx, cy + 9, 4.2, 0, 3.1416); c.fill(); }); // 혀 조금
    // 저지(앞 = u 0.5 로 돌림): 보라 바탕 · 청록 「34」 · 흰 단추 줄 · 청록 소매·목 띠
    const jerseyTx = kidCanvas(512, 256, (c, w, h) => { c.fillStyle = '#6b3fd6'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#2fd9c0'; c.fillRect(0, 0, w, 14); c.fillStyle = '#fff'; c.fillRect(0, 14, w, 5);
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(252, 20, 8, 236); c.fillStyle = '#fff'; [60, 110, 160].forEach((y) => { c.beginPath(); c.arc(256, y, 7, 0, 6.283); c.fill(); });
      c.font = '900 118px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 14; c.strokeStyle = '#fff'; c.strokeText('34', 256, 150); c.fillStyle = '#2fd9c0'; c.fillText('34', 256, 150); });
    // 하트 선글라스(두 하트 + 다리): 흰 그림 → instanceColor 로 분홍/보라, alphaTest 로 모양만
    const glassTx = kidCanvas(256, 128, (c, w, h) => { c.clearRect(0, 0, w, h); const heart = (x, y, r) => { c.beginPath(); c.moveTo(x, y + r); c.bezierCurveTo(x - r * 1.5, y - r * 0.2, x - r * 0.5, y - r * 1.3, x, y - r * 0.45); c.bezierCurveTo(x + r * 0.5, y - r * 1.3, x + r * 1.5, y - r * 0.2, x, y + r); c.closePath(); };
      c.strokeStyle = '#1b1424'; c.lineWidth = 16; c.fillStyle = '#fff'; [[80, 64], [176, 64]].forEach(([x, y]) => { heart(x, y, 40); c.stroke(); c.fill(); }); c.fillStyle = '#fff'; c.fillRect(112, 52, 32, 12); c.strokeStyle = '#1b1424'; c.lineWidth = 3; c.strokeRect(112, 52, 32, 12);
      c.fillStyle = 'rgba(255,255,255,0.55)'; [[64, 50], [160, 50]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 10, 6, -0.6, 0, 6.283); c.fill(); }); });
    const toon = (o) => R.toon(o), mat = {
      skin: toon({ map: faceTx, gain: 1.1, rim: 0.4, spec: 0.1, sat: 1.05 }), skinPlain: toon({ color: 0xffffff, gain: 1.1, rim: 0.4, spec: 0.1 }), hair: toon({ color: 0xffffff, gain: 1.05, rim: 0.35, spec: 0 }), // 11-26 검수: spec 0.35 면 툰 반사 띠가 머리 꼭대기에 회색 원판(빈 가면처럼)으로 보여 0 으로
      jersey: toon({ map: jerseyTx, gain: 1.12, rim: 0.45, spec: 0.15, sat: 1.1 }), purple: toon({ color: KCOL.jersey, gain: 1.12, rim: 0.45, spec: 0.15 }), white: toon({ color: 0xf6f3ff, gain: 1.1, rim: 0.4, spec: 0.2 }), shoe: toon({ color: 0xffffff, gain: 1.1, rim: 0.4, spec: 0.1 }),
      glass: new T.MeshBasicMaterial({ map: glassTx, transparent: true, alphaTest: 0.5, side: T.DoubleSide, depthWrite: false }),
    };
    const geo = (g, tx, ty, tz) => { if (tx || ty || tz) g.translate(tx || 0, ty || 0, tz || 0); return g; };
    const cap = (r, len, rs, cs) => T.CapsuleGeometry ? new T.CapsuleGeometry(r, len, rs, cs) : new T.CylinderGeometry(r, r, len + r * 2, cs);
    const jerseyGeo = new T.CylinderGeometry(0.40, 0.50, 0.78, 16); jerseyGeo.rotateY(Math.PI); jerseyGeo.translate(0, 0.39, 0);
    const shoeGeo = new T.SphereGeometry(0.2, 12, 9); shoeGeo.scale(0.85, 0.55, 1.25); shoeGeo.translate(0, -0.57, 0.06);
    const defs = [ // [이름, 기하, 재질, 뼈대 마디, 외곽선 두께(0 = 없음), 색 쓰나]
      ['head', new T.SphereGeometry(0.58, 20, 14), mat.skin, 'head', 1.0, 'skin'],
      ['hair', geo(new T.SphereGeometry(0.63, 20, 12, 0, 6.283, 0, 1.25), 0, 0.04, -0.1), mat.hair, 'head', 1.0, 'hair'],
      ['tailL', geo(new T.SphereGeometry(0.25, 12, 10), 0, 0, 0), mat.hair, 'tailL', 1.0, 'hair'], ['tailR', geo(new T.SphereGeometry(0.25, 12, 10), 0, 0, 0), mat.hair, 'tailR', 1.0, 'hair'],
      ['bun', geo(new T.SphereGeometry(0.27, 12, 10), 0, 0.62, -0.1), mat.hair, 'head', 1.0, 'hair'],
      ['glasses', geo(new T.PlaneGeometry(0.95, 0.48), 0, 0, 0), mat.glass, 'glasses', 0, 'glass'],
      ['jersey', jerseyGeo, mat.jersey, 'torso', 1.0, null], ['belt', geo(new T.CylinderGeometry(0.48, 0.48, 0.09, 16), 0, 0.0, 0), mat.white, 'torso', 1.0, null],
      ['pants', geo(new T.CylinderGeometry(0.47, 0.43, 0.42, 16), 0, -0.2, 0), mat.white, 'torso', 1.0, null],
      ['legL', geo(new T.CylinderGeometry(0.19, 0.17, 0.62, 10), 0, -0.31, 0), mat.white, 'legL', 1.0, null], ['legR', geo(new T.CylinderGeometry(0.19, 0.17, 0.62, 10), 0, -0.31, 0), mat.white, 'legR', 1.0, null],
      ['pocketL', geo(new T.BoxGeometry(0.1, 0.22, 0.2), -0.19, -0.3, 0.02), mat.white, 'legL', 1.0, null], ['pocketR', geo(new T.BoxGeometry(0.1, 0.22, 0.2), 0.19, -0.3, 0.02), mat.white, 'legR', 1.0, null],
      ['shoeL', shoeGeo, mat.shoe, 'legL', 1.0, 'shoe'], ['shoeR', shoeGeo.clone(), mat.shoe, 'legR', 1.0, 'shoe'],
      ['armL', geo(cap(0.13, 0.46, 4, 10), 0, -0.36, 0), mat.skinPlain, 'armL', 1.0, 'skin'], ['armR', geo(cap(0.13, 0.46, 4, 10), 0, -0.36, 0), mat.skinPlain, 'armR', 1.0, 'skin'],
      ['sleeveL', geo(new T.CylinderGeometry(0.2, 0.17, 0.3, 10), 0, -0.1, 0), mat.purple, 'armL', 1.0, null], ['sleeveR', geo(new T.CylinderGeometry(0.2, 0.17, 0.3, 10), 0, -0.1, 0), mat.purple, 'armR', 1.0, null],
    ];
    defs.forEach(([name, g, m, node, ol, colKind]) => {
      const im = new T.InstancedMesh(g, m, N); im.frustumCulled = false; im.castShadow = name !== 'glasses'; im.receiveShadow = false; im.renderOrder = name === 'glasses' ? 10 : 9; im.name = 'kid_' + name;
      if (colKind) { im.instanceColor = new T.InstancedBufferAttribute(new Float32Array(N * 3), 3); }
      grp.add(im); if (ol) { const o = R.addOutline(im, ol); o.frustumCulled = false; }
      KIDS.parts[name] = { im, node, colKind };
    });
    // 뼈대 8벌(보이지 않음) + 8명 변형표(피부·머리·모양·신발·선글라스·키) — 순서 고정(난수 X → 늘 같은 8명)
    const styles = [0, 1, 2, 3, 0, 2, 1, 3]; // 0 양갈래 높게 · 1 똥머리 · 2 짧게 · 3 양갈래 낮게
    const col = new T.Color();
    for (let i = 0; i < N; i++) {
      const root = new T.Object3D(), body = new T.Object3D(), torso = new T.Object3D(), head = new T.Object3D(), glasses = new T.Object3D(), tailL = new T.Object3D(), tailR = new T.Object3D();
      const armL = new T.Object3D(), armR = new T.Object3D(), legL = new T.Object3D(), legR = new T.Object3D();
      root.add(body); body.add(torso, head, armL, armR, legL, legR); head.add(glasses, tailL, tailR);
      torso.position.set(0, 0.95, 0); head.position.set(0, 2.17, 0); armL.position.set(-0.5, 1.62, 0); armR.position.set(0.5, 1.62, 0); legL.position.set(-0.21, 0.74, 0); legR.position.set(0.21, 0.74, 0);
      glasses.position.set(0, 0.46, 0.38); glasses.rotation.x = -0.95;
      const st = styles[i], low = st === 3; tailL.position.set(-0.6, low ? -0.3 : -0.05, -0.12); tailR.position.set(0.6, low ? -0.3 : -0.05, -0.12); tailL.scale.set(1, 1.6, 1); tailR.scale.set(1, 1.6, 1);
      const hk = kidHk(i); // 키 0.955~1.048 → 2.67~2.93 (세포 3D 키 3.34 의 0.80~0.88 — 비율_기준 아이)
      root.scale.setScalar((KIDS.H / 2.75) * hk);
      KIDS.rigs.push({ root, body, torso, head, glasses, tailL, tailR, armL, armR, legL, legR });
      const kid = { i, h: +(KIDS.H * hk).toFixed(2), style: st, skin: KCOL.skins[i % 4], hair: KCOL.hairs[(i * 3) % 5], shoe: KCOL.shoes[(i * 5) % 4], glass: KCOL.glasses[i % 2], x: 0, z: 0, y: 0, yaw: 0, vis: false, sq: 1, lean: 0, swing: 0, armUp: 0, armWave: 0, headTilt: 0, fade: 1 };
      KIDS.kids.push(kid);
      for (const name in KIDS.parts) { const P_ = KIDS.parts[name]; if (!P_.colKind) continue; const c = P_.colKind === 'skin' ? kid.skin : P_.colKind === 'hair' ? kid.hair : P_.colKind === 'shoe' ? kid.shoe : kid.glass; col.setHex(c); P_.im.setColorAt(i, col); }
    }
    for (const name in KIDS.parts) { const im = KIDS.parts[name].im; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    KIDS.hideAll();
  }
  const kM = new T.Matrix4(), kZero = new T.Matrix4().makeScale(0, 0, 0);
  KIDS.hideAll = function () { if (!KIDS.built) return; KIDS.kids.forEach((k) => { k.vis = false; }); KIDS.group.visible = false; KIDS.mode = 'off'; };
  KIDS.shown = () => (KIDS.built && KIDS.group.visible ? KIDS.kids.filter((k) => k.vis).length : 0);
  KIDS.state = () => ({ built: KIDS.built, mode: KIDS.mode, shown: KIDS.shown(), parts: Object.keys(KIDS.parts).length, draws: KIDS.built ? KIDS.group.children.length : 0, kids: KIDS.kids.map((k) => ({ i: k.i, h: k.h, vis: k.vis, x: +k.x.toFixed(2), z: +k.z.toFixed(2), y: +k.y.toFixed(2), style: k.style })) });
  // 매 걸음: 변형값(자리·춤 자세) → 뼈대 → 부분별 instanceMatrix
  KIDS.draw = function () {
    if (!KIDS.built) return; const any = KIDS.kids.some((k) => k.vis); KIDS.group.visible = any; if (!any) return;
    KIDS.kids.forEach((k, i) => {
      const r = KIDS.rigs[i], f = k.vis ? k.fade : 0;
      r.root.position.set(k.x, k.y, k.z); r.root.rotation.set(0, k.yaw, 0); const sx = (KIDS.H / 2.75) * kidHk(i) * f; r.root.scale.set(sx, sx * k.sq, sx);
      r.body.rotation.set(k.lean, 0, k.swing * 0.08); r.head.rotation.set(k.headTilt * 0.3, 0, k.headTilt);
      // 팔: armUp 1 = 두 팔 위로(만세), 0 = 내림 · armWave 좌우 흔들 · swing 달릴 때 앞뒤
      r.armL.rotation.set(k.swing * 0.9 * (1 - k.armUp), 0, (0.25 + 2.6 * k.armUp) + k.armWave * 0.35 * k.armUp); r.armR.rotation.set(-k.swing * 0.9 * (1 - k.armUp), 0, -(0.25 + 2.6 * k.armUp) + k.armWave * 0.35 * k.armUp);
      r.legL.rotation.set(-k.swing * 0.8, 0, 0); r.legR.rotation.set(k.swing * 0.8, 0, 0);
      r.tailL.visible = r.tailR.visible = k.style === 0 || k.style === 3;
      r.root.updateMatrixWorld(true);
    });
    for (const name in KIDS.parts) {
      const P_ = KIDS.parts[name], im = P_.im;
      KIDS.kids.forEach((k, i) => {
        const r = KIDS.rigs[i]; let hide = !k.vis;
        if (name === 'tailL' || name === 'tailR') hide = hide || !(k.style === 0 || k.style === 3); else if (name === 'bun') hide = hide || k.style !== 1;
        im.setMatrixAt(i, hide ? kZero : r[P_.node].matrixWorld);
      });
      im.instanceMatrix.needsUpdate = true;
    }
  };
  const kidsArena = (x, z, m) => { const AR = TG.AR; return [TG.clamp(x, -AR.bx + m, AR.bx - m), TG.clamp(z, -AR.bz + m, AR.bz - m)]; };
  const smooth = (k) => { k = TG.clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const VIS = {
    kids: { // 11-26 세포 「세포키즈 출동!」(계획 v8 ㊳ 11-20: 맵 휘젓기 춤 → 가운데 모여 쿵! → 층 전체 퐁). 시간은 k = dur/2.8 로 늘임(끝까지 모드 1.5초)
      start(a) { kidBuild(); const p = P(), k = a.dur / 2.8, AR = TG.AR; a.k = k; a.step = 0; a.wide = true; // 카메라 안 다가감(맵 전체 휘젓기가 보이게)
        a.tb = 0.55 * k; a.tg = 2.0 * k; a.tj = 2.5 * k; a.beat = 0; a.trailT = 0;
        p.glow = 0.8; pose('cheerup', 9); FX().text('세포키즈 출동!', p.x, 4.8, p.z, 'cheer'); TG.R.bloomPulse = 0.25;
        FX().ring(p.x, p.z, { r0: 0.6, r1: 5, dur: 0.5, color: 0x7a4fe6, width: 0.16, hdr: 1.3 }); FX().ring(p.x, p.z, { r0: 0.4, r1: 4, dur: 0.5, color: 0x2fd9c0, width: 0.1, delay: 0.08, hdr: 1.2, alpha: 0.8 });
        const rx = Math.min(AR.bx * 0.78, 9.5), rz = Math.min(AR.bz * 0.78, 6.5);
        a.kd = KIDS.kids.map((kd, i) => { const ang = i * (6.2832 / KIDS.N) + fra(-0.25, 0.25), d = fra(3.4, 5.6); const [tx, tz] = kidsArena(p.x + Math.sin(ang) * d, p.z + Math.cos(ang) * d, 0.8);
          kd.vis = true; kd.fade = 1; kd.sq = 1; kd.x = p.x; kd.z = p.z; kd.y = 0; kd.yaw = ang; kd.armUp = 1; kd.swing = 0; kd.lean = 0;
          return { kd, d0: i * 0.045 * k, d1: (0.42 + i * 0.045) * k, tx, tz, ang, ph0: ang + 1.6, dir: i % 2 ? 1 : -1, rx, rz, gx: 0, gz: 0, sx: 0, sz: 0, gathered: false }; });
        KIDS.mode = 'burst'; KIDS.draw(); },
      tick(a, dt) { const p = P(), k = a.k, t = a.t, AR = TG.AR, cx = Math.abs(p.x) < AR.bx * 0.5 ? p.x * 0.5 : 0, cz = Math.abs(p.z) < AR.bz * 0.5 ? p.z * 0.5 : 0; // 타원 가운데 = 경기장 가운데(세포 쪽으로 조금)
        if (a.step === 0 && t >= a.tb) { a.step = 1; KIDS.mode = 'sweep'; pose('dj', 9); A().play('sfx_pick', { rate: 1.4, gain: 0.4 }); }
        if (a.step === 1 && t >= a.tg) { a.step = 2; KIDS.mode = 'gather'; a.kd.forEach((q, i) => { q.sx = q.kd.x; q.sz = q.kd.z; const ang = i * (6.2832 / KIDS.N); const [gx, gz] = kidsArena(p.x + Math.sin(ang) * 2.0, p.z + Math.cos(ang) * 2.0, 0.5); q.gx = gx; q.gz = gz; }); FX().text('모여라!', p.x + 2.4, 3.4, p.z, 'word'); } // 글은 옆·낮게(0.8초 뒤 「쿵!」과 안 겹치게)
        if (a.step === 2 && t >= a.tj) { a.step = 3; KIDS.mode = 'jump'; pose('thumb', 9); A().play('sfx_pick', { rate: 0.8, gain: 0.5 }); }
        if (a.step >= 1 && a.step <= 2) every(a, 'beat', 0.5, () => { a.beat++; FX().ring(p.x, p.z, { r0: 0.6, r1: 3.2, dur: 0.45, color: a.beat % 2 ? 0x7a4fe6 : 0x2fd9c0, width: 0.14, alpha: 0.8 }); A().play('sfx_wave', { rate: 1.3 + (a.beat % 2) * 0.2, gain: 0.3 }); }); // 박자 링 초당 2회(깜빡임 3회 이하)
        a.trailT += dt;
        a.kd.forEach((q, i) => { const kd = q.kd; let moving = false;
          if (t < a.tb) { // 쏟아짐: 세포 자리에서 포물선으로 튀어 흩어짐(한 명씩 0.045초 차이)
            const s = TG.clamp((t - q.d0) / Math.max(0.01, q.d1 - q.d0), 0, 1), e = 1 - (1 - s) * (1 - s);
            kd.x = p.x + (q.tx - p.x) * e; kd.z = p.z + (q.tz - p.z) * e; kd.y = Math.sin(Math.PI * s) * 2.6; kd.yaw = q.ang + s * 6.2832 * 1.5; kd.armUp = 1; kd.armWave = Math.sin(t * 14 + i); kd.swing = 0; kd.sq = s < 1 ? 1 : 1;
            if (s >= 1 && !q.landed) { q.landed = true; for (let j = 0; j < 5; j++) FX().emit(FX().CELL.puff, kd.x + fra(-0.4, 0.4), 0.2, kd.z + fra(-0.4, 0.4), { vy: fra(0.8, 1.6), life: 0.35, size: 0.5, size1: 0.1, color: [2.2, 2.2, 2.4], alpha: 0.7 }); }
          } else if (t < a.tg) { // 휘젓기 춤: 타원 궤도(8명 자리 나눔, 반 바퀴 남짓) + 지그재그, 팔 위로 흔들며 통통
            const u = t - a.tb, blend = smooth(u / (0.3 * k)), ph = q.ph0 + q.dir * u * (0.55 * 6.2832 / (1.45 * k)), wob = 1 + 0.12 * Math.sin(u * 9 + i);
            const [ex, ez] = kidsArena(cx + Math.sin(ph) * q.rx * wob, cz + Math.cos(ph) * q.rz * wob, 0.6);
            const nx = q.tx + (ex - q.tx) * blend, nz = q.tz + (ez - q.tz) * blend; const dx = nx - kd.x, dz = nz - kd.z; if (dx * dx + dz * dz > 1e-6) kd.yaw = Math.atan2(dx, dz); kd.x = nx; kd.z = nz; moving = true;
            kd.y = Math.abs(Math.sin(u * 12.6 + i * 0.7)) * 0.32; kd.armUp = 1; kd.armWave = Math.sin(u * 12.6 + i); kd.swing = Math.sin(u * 12.6 + i * 0.7) * 0.9; kd.lean = 0.12; kd.headTilt = Math.sin(u * 6.3 + i) * 0.18;
          } else if (t < a.tj) { // 가운데 모이기: 세포 둘레 2.0 링으로
            const s = smooth((t - a.tg) / Math.max(0.01, a.tj - a.tg)); kd.x = q.sx + (q.gx - q.sx) * s; kd.z = q.sz + (q.gz - q.sz) * s; kd.y = Math.abs(Math.sin(s * 9.4)) * 0.25 * (1 - s);
            kd.yaw = Math.atan2(p.x - kd.x, p.z - kd.z); kd.armUp = 1 - s * 0.5; kd.swing = Math.sin(t * 12) * 0.8 * (1 - s); kd.lean = 0.1 * (1 - s); kd.headTilt = 0; kd.armWave = 0;
          } else { // 다 같이 쿵!: 웅크렸다 점프 → 착지(= a.dur, fire 에서 「쿵!」)
            const s = TG.clamp((t - a.tj) / Math.max(0.01, a.dur - a.tj), 0, 1); kd.armUp = s < 0.4 ? 0.2 : 1; kd.armWave = 0; kd.swing = 0; kd.lean = 0;
            if (s < 0.4) { kd.sq = 1 - 0.18 * (s / 0.4); kd.y = 0; } else { const j = (s - 0.4) / 0.6; kd.sq = 1 + 0.1 * Math.sin(Math.PI * j); kd.y = Math.sin(Math.PI * j) * 1.9; }
            kd.yaw = Math.atan2(p.x - kd.x, p.z - kd.z);
          }
          if (moving && a.trailT >= 0.1) FX().emit(i % 2 ? FX().CELL.note : FX().CELL.star, kd.x + fra(-0.3, 0.3), 0.4, kd.z + fra(-0.3, 0.3), { vy: fra(1.2, 2.4), life: 0.45, size: 0.4, size1: 0.1, color: i % 2 ? [1.2, 2.5, 2.3] : [1.9, 1.3, 2.7], rot: 0, vrot: 4, pop: true });
        });
        if (a.trailT >= 0.1) a.trailT = 0;
        KIDS.draw(); },
      fire(a) { const p = P(), g = G(); A().play('sfx_kids_stomp', { gain: 0.9 }); FX().text('쿵!', p.x, 5.4, p.z, 'cheer'); FX().ring(p.x, p.z, { r0: 1.0, r1: 9, dur: 0.5, color: 0xfff0a8, width: 0.22, hdr: 1.4, y: 0.06 });
        a.kd.forEach((q) => { const kd = q.kd; kd.y = 0; kd.sq = 0.72; for (let j = 0; j < 4; j++) FX().emit(FX().CELL.puff, kd.x + fra(-0.5, 0.5), 0.15, kd.z + fra(-0.5, 0.5), { vy: fra(0.6, 1.4), life: 0.4, size: 0.6, size1: 0.15, color: [2.3, 2.3, 2.5], alpha: 0.75 }); });
        g.vib && g.vib('big'); KIDS.mode = 'stomp'; KIDS.draw(); },
      end(a, force) { if (force || !G().uq.bonus) { a.kd.forEach((q) => { q.kd.vis = false; }); KIDS.hideAll(); KIDS.draw(); return; }
        // 보너스 5초: 3명은 세포 둘레를 돌며(자리는 규칙 U.kidsBonus 의 kidPos) 나머지 5명은 손 흔들고 반짝이며 사라짐(0.5초)
        a.kd.forEach((q, i) => { const kd = q.kd; kd.sq = 1; kd.y = 0; if (i >= 3) { kd.bye = 0.5; } }); KIDS.mode = 'bonus'; },
      bonusTick(q, dt) { const b = q.bonus, p = P(); if (!b || !q.kidPos) return;
        KIDS.kids.forEach((kd, i) => { if (!kd.vis) return;
          if (i < b.n) { const kp = q.kidPos[i]; const dx = kp.x - kd.x, dz = kp.z - kd.z; kd.yaw = dx * dx + dz * dz > 1e-6 ? Math.atan2(dx, dz) : kd.yaw; kd.x = kp.x; kd.z = kp.z; kd.y = Math.abs(Math.sin((b.dur - q.bonusT) * 12 + i * 2)) * 0.28; kd.armUp = 1; kd.armWave = Math.sin((b.dur - q.bonusT) * 10 + i); kd.swing = Math.sin((b.dur - q.bonusT) * 12 + i) * 0.8; kd.lean = 0.12;
            if (kp.hit) { kp.hit = false; FX().ring(kd.x, kd.z, { r0: 0.3, r1: 2.2, dur: 0.3, color: 0x2fd9c0, width: 0.12, alpha: 0.8 }); A().play('sfx_pick', { rate: 1.6, gain: 0.3 }); } }
          else { kd.bye -= dt; kd.armUp = 1; kd.armWave = Math.sin(kd.bye * 24) * 1.2; kd.fade = TG.clamp(kd.bye / 0.25, 0, 1); if (kd.bye <= 0) { kd.vis = false; for (let j = 0; j < 6; j++) FX().emit(FX().CELL.sparkle, kd.x + fra(-0.4, 0.4), 0.8 + fra(0, 1.6), kd.z + fra(-0.4, 0.4), { vy: fra(1, 3), life: 0.4, size: 0.45, size1: 0, color: [2.4, 2.0, 2.6] }); } } });
        KIDS.draw(); },
      bonusEnd(quiet) { if (!KIDS.built) return; KIDS.kids.forEach((kd) => { if (!kd.vis) return; kd.vis = false; if (!quiet) for (let j = 0; j < 8; j++) FX().emit(FX().CELL.sparkle, kd.x + fra(-0.4, 0.4), 0.8 + fra(0, 1.6), kd.z + fra(-0.4, 0.4), { vy: fra(1, 3), life: 0.4, size: 0.45, size1: 0, color: [2.4, 2.0, 2.6] }); });
        if (!quiet) A().play('sfx_pick', { rate: 0.9, gain: 0.5 }); KIDS.hideAll(); KIDS.draw(); },
    },
    sefo: {
      start(a) { buildSefo(); a.step = 0; const p = P();
        FX().ring(p.x, p.z, { wall: true, r0: 0.6, r1: 2.2, dur: 0.4, color: 0xe5352b, h: 4.5, alpha: 0.55, hdr: 1.2 }); FX().ring(p.x, p.z, { wall: true, r0: 0.4, r1: 1.8, dur: 0.4, color: 0xffd23f, h: 5.5, alpha: 0.5, delay: 0.08, hdr: 1.2 }); // 빨강·노랑 빛 기둥 0.4초(가림 — 하얀 번쩍 X)
        for (let i = 0; i < 18; i++) FX().emit(FX().CELL.sparkle, p.x + fra(-0.8, 0.8), 0.3, p.z + fra(-0.8, 0.8), { vy: fra(5, 9), life: 0.45, size: 0.5, size1: 0, color: i % 2 ? [2.5, 0.9, 0.7] : [2.5, 2.1, 0.7] });
        A().play('sfx_bonk', { rate: 0.85, gain: 0.7 }); p.glow = 1; },
      tick(a) { const p = P(); followSefo();
        if (a.step === 0 && a.t >= 0.4 * (a.dur / 2.8)) { a.step = 1; if (vis.hat) vis.hat.visible = true; if (vis.badge) vis.badge.visible = true; pose('fist', 9); FX().text('필승 모드!', p.x, 4.6, p.z, 'cheer'); A().syn('bossPhase'); TG.R.bloomPulse = 0.3; } // 변신 → 주먹 불끈(한 발 앞으로는 pose 에서 몸 쏠림)
        every(a, 'ring', 0.5, () => { a.ringK = !a.ringK; FX().ring(p.x, p.z, { r0: 0.5, r1: 2.6, dur: 0.5, color: a.ringK ? 0xe5352b : 0xffd23f, width: 0.14, alpha: 0.8 }); }); },
      fire() { const p = P(); FX().text('전부 퐁!', p.x, 5.2, p.z, 'cheer'); },
      end() { /* 모자는 필승 모드 10초 동안 그대로 */ },
      bonusTick(q, dt) { const p = P(); followSefo(); q.ringT = (q.ringT || 0) + dt; if (q.ringT >= 0.5) { q.ringT = 0; q.ringK = !q.ringK; FX().ring(p.x, p.z, { r0: 1.0, r1: 1.7, dur: 0.5, color: q.ringK ? 0xe5352b : 0xffd23f, width: 0.12, alpha: 0.6 }); } }, // 발밑 빨강·노랑 링(천천히, 깜빡임 아님)
      bonusEnd(quiet) { if (vis.hat) vis.hat.visible = false; if (vis.badge) vis.badge.visible = false; if (!quiet) { const p = P(); for (let i = 0; i < 12; i++) FX().emit(FX().CELL.sparkle, p.x + fra(-0.6, 0.6), 1.5 + fra(0, 1.8), p.z + fra(-0.6, 0.6), { vy: fra(1, 3), life: 0.4, size: 0.45, size1: 0, color: [2.5, 2.1, 0.8] }); A().play('sfx_pick', { rate: 0.9, gain: 0.5 }); } },
    },
    gunner: {
      start(a) { buildProxies(); a.step = 0; A().play('sfx_whistle_gunner', { gain: 0.9 }); pose('whistle', a.dur * 0.3); const p = P();
        const k = a.dur / 2.8, AR = TG.AR, corners = [[-AR.bx * 0.85, -AR.bz * 0.85], [AR.bx * 0.85, -AR.bz * 0.85], [-AR.bx * 0.85, AR.bz * 0.85], [AR.bx * 0.85, AR.bz * 0.85]];
        a.pr = (vis.proxies || []).map((g, i) => { const ang = -0.9 + i * 0.6; const tx = p.x + Math.sin(ang) * 2.4, tz = p.z + Math.cos(ang) * 2.4; g.position.set(corners[i][0], 0, corners[i][1]); g.rotation.set(0, 0, 0); g.visible = true; return { g, x0: corners[i][0], z0: corners[i][1], tx, tz, t0: 0.4 * k, t1: (1.2 + i * 0.08) * k, big: (1.4 + i * 0.16) * k, said: false, didBig: false }; });
        a.saluteAt = 2.1 * k; a.goneAt = 2.55 * k; },
      tick(a, dt) { const p = P();
        (a.pr || []).forEach((q) => { const g = q.g; if (!g.visible) return;
          const k = TG.clamp((a.t - q.t0) / Math.max(0.01, q.t1 - q.t0), 0, 1), e = k * k * (3 - 2 * k);
          g.position.x = q.x0 + (q.tx - q.x0) * e; g.position.z = q.z0 + (q.tz - q.z0) * e; g.position.y = k < 1 ? Math.abs(Math.sin(a.t * 18)) * 0.35 : 0;
          g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z);
          if (k >= 1 && !q.said) { q.said = true; FX().text(g.userData.name, g.position.x, 3.2, g.position.z, 'word'); }
          if (a.t >= q.big && !q.didBig) { q.didBig = true; FX().ring(g.position.x, g.position.z, { r0: 0.4, r1: 3.2, dur: 0.35, color: g.userData.col, width: 0.16, hdr: 1.4 }); FX().text(g.userData.bigSay, g.position.x, 4.0, g.position.z, 'cheer'); A().play('sfx_pick', { rate: 1.3 + Math.random() * 0.4, gain: 0.4 }); for (let i = 0; i < 6; i++) FX().emit(FX().CELL.note, g.position.x + fra(-0.5, 0.5), 2.2, g.position.z + fra(-0.5, 0.5), { vy: fra(2, 4), life: 0.5, size: 0.45, size1: 0.1, color: [2.2, 2.2, 1.0], rot: 0, pop: true }); }
          if (a.t >= a.saluteAt) g.rotation.z = Math.min(0.18, g.rotation.z + dt * 1.4); // 경례(살짝 기울임)
          if (a.t >= a.goneAt) { g.visible = false; for (let i = 0; i < 8; i++) FX().emit(FX().CELL.sparkle, g.position.x + fra(-0.5, 0.5), 1 + fra(0, 1.8), g.position.z + fra(-0.5, 0.5), { vy: fra(1, 3), life: 0.4, size: 0.45, size1: 0, color: [2.4, 2.4, 1.2] }); } });
        if (a.step === 0 && a.t >= a.saluteAt) { a.step = 1; pose('salute', 9); FX().text('경례!', p.x, 4.6, p.z, 'cheer'); A().play('sfx_bonk', { rate: 1.6, gain: 0.3 }); } },
      end(a) { (a.pr || []).forEach((q) => { q.g.visible = false; }); },
    },
    moshee: {
      start(a) { a.step = 0; const p = P(); if (p.face) p.face('stareyes', a.dur + 0.5); if (p.faceFlash) p.faceFlash(1.0); TG.R.bloomPulse = 0.45;
        FX().ring(p.x, p.z, { r0: 0.8, r1: 7, dur: 0.45, color: 0x2fe0f0, width: 0.18, hdr: 1.6 }); A().play('sfx_pick', { rate: 2.2, gain: 0.5 }); pose('dj', 9);
        const AR = TG.AR, k = a.dur / 2.8; a.rows = []; const nx = 7, nz = 5; for (let j = 0; j < nz; j++) a.rows.push({ at: (0.5 + j * 0.34) * k, z: -AR.bz + (j + 0.5) * (2 * AR.bz / nz), nx, done: false }); }, // 바둑판 줄 5개가 0.34초마다(초당 3회 이하) 차례로
      tick(a) { const AR = TG.AR;
        a.rows.forEach((r) => { if (r.done || a.t < r.at) return; r.done = true; a.step++;
          for (let i = 0; i < r.nx; i++) { const x = -AR.bx + (i + 0.5) * (2 * AR.bx / r.nx); FX().emit(FX().CELL.dot, x, 0.3, r.z, { vy: 2.2, life: 0.55, size: 0.9, size1: 0.2, color: [0.9, 2.3, 2.5], drag: 2 }); FX().emit(FX().CELL.ring, x, 0.1, r.z, { life: 0.4, size: 0.4, size1: 2.2, color: [0.9, 2.3, 2.5], alpha: 0.8 }); }
          FX().ring(0, r.z, { r0: 0.4, r1: AR.bx * 1.4, dur: 0.3, color: 0x2fe0f0, width: 0.1, alpha: 0.6, hdr: 1.2, y: 0.08 }); A().play('sfx_wave', { rate: 1.5 + a.step * 0.08, gain: 0.35 }); }); },
      fire() { const p = P(); if (p.face) p.face('happy', 2.0); },
    },
    sseni: {
      start(a) { a.step = 0; const p = P(); p.spin = { t: 0, dur: 0.5, turns: 1 }; A().play('sfx_twinkle_sseni', { gain: 0.8 });
        const v = H().zoneVig; if (v) { v.classList.remove('on'); void v.offsetWidth; v.style.boxShadow = 'inset 0 0 40px 8px rgba(164,107,255,0.65)'; v.classList.add('on'); setTimeout(() => { v.style.boxShadow = ''; }, 320); } // 가장자리 0.3초 보라 테두리(전체 덮개 X)
        a.floodAt = 0.5 * (a.dur / 2.8); },
      tick(a, dt) { const p = P();
        if (a.step === 0 && a.t >= a.floodAt) { a.step = 1; pose('starhand', 9); FX().ring(p.x, p.z, { wall: true, r0: 1, r1: 34, dur: 1.5 * (a.dur / 2.8), color: 0xa46bff, h: 2.2, alpha: 0.5, hdr: 1.1 }); FX().ring(p.x, p.z, { r0: 1, r1: 34, dur: 1.5 * (a.dur / 2.8), color: 0xa46bff, width: 0.3, alpha: 0.7, hdr: 1.2 }); FX().text('보라 세상!', p.x, 4.6, p.z, 'cheer'); }
        if (a.step >= 1) { // 물감이 번지는 반지름 안 안개: 보라 물듦 + 조금씩 작아짐(녹는 표현 X — 반짝이로 퐁)
          const R = 34 * TG.clamp((a.t - a.floodAt) / (1.5 * (a.dur / 2.8)), 0, 1);
          for (const u of F().list) { if (u.state !== 'live' || u.kind === 'cocoon' || !u.uq) continue; if ((u.x - p.x) ** 2 + (u.z - p.z) ** 2 > R * R) continue; u.mistT = Math.max(u.mistT || 0, 0.15); u.scale = Math.max(0.6, u.scale - dt * 0.35); if (TG.fr() < 0.05) FX().emit(FX().CELL.star, u.x + fra(-0.4, 0.4), u.y + 1.4 * u.scale, u.z, { vy: 1.5, life: 0.4, size: 0.4, size1: 0, color: [1.9, 1.3, 2.7], rot: 0, vrot: 6, pop: true }); }
        } },
      fire() { const p = P(); for (let i = 0; i < 24; i++) FX().emit(FX().CELL.star, p.x + fra(-6, 6), 1 + fra(0, 2.5), p.z + fra(-4, 4), { vy: fra(1.5, 3.5), life: 0.6, size: 0.5, size1: 0.1, color: [1.9, 1.3, 2.7], rot: 0, vrot: 5, pop: true }); },
    },
    berri: {
      start(a) { a.step = 0; A().play('sfx_maraca_berri', { gain: 0.85 }); pose('shake', a.dur * 0.4); a.rainAt = 0.5 * (a.dur / 2.8); a.rainEnd = a.dur - 0.15; },
      tick(a) { const p = P();
        if (a.step === 0 && a.t >= a.rainAt) { a.step = 1; FX().text('베리 비!', p.x, 4.6, p.z, 'cheer'); }
        if (a.t >= a.rainAt && a.t < a.rainEnd) every(a, 'rain', 0.08, () => { // 딸기 방울 비: 안개 위에 톡톡 + 층 여기저기
          const AR = TG.AR; let n = 0;
          for (const u of F().list) { if (u.state !== 'live' || u.kind === 'cocoon' || !u.uq) continue; if (n++ > 24) break; FX().emit(FX().CELL.drop, u.x + fra(-0.6, 0.6), 5.5 + fra(0, 1.5), u.z + fra(-0.6, 0.6), { vy: -7, life: 0.6, size: 0.55, size1: 0.3, color: [2.3, 0.9, 1.3], grav: 4, rot: 0 }); }
          for (let i = 0; i < 4; i++) FX().emit(i % 2 ? FX().CELL.drop : FX().CELL.heart, fra(-AR.bx, AR.bx), 5.5 + fra(0, 1.5), fra(-AR.bz, AR.bz), { vy: -7, life: 0.65, size: 0.5, size1: 0.25, color: [2.3, 1.0, 1.5], grav: 4, rot: 0, vrot: 3 });
          if (a.timers.rainN == null) a.timers.rainN = 0; a.timers.rainN++; }); },
      fire() { const p = P(); for (let i = 0; i < 16; i++) FX().emit(i % 2 ? FX().CELL.flower : FX().CELL.heart, p.x + fra(-3, 3), 1 + fra(0, 2), p.z + fra(-2, 2), { vy: fra(1.5, 3.5), life: 0.7, size: 0.55, size1: 0.2, color: [2.3, 1.0, 1.5], grav: 3, rot: 0, vrot: 3, pop: true }); },
    },
  };
})();
