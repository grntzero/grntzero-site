/* 톱니골 던전 — 게임 흐름(1층→쉼터→2층→쉼터→3층→보스)·입력·카메라·생성·큰 소리·레벨업 카드·시험 훅(window.__tg)·봇
   규칙 계산(sim)은 1/60초 고정 걸음 + 시드 난수(TG.sr) + 입력 기록 → 같은 시드·같은 입력이면 같은 결과. 그리기는 걸음 사이를 보간만 함.
   조작(11-12 대표 결정): 소리 파동은 저절로 나가지 않음 — 「소리」 버튼(터치) / 마우스 왼쪽·Space(PC)를 누르고 있는 동안만 나감. 누른 채 끌면 그쪽으로 겨눔.
   소리 크기가 0칸이 되면 다시 일어나기 없이 바로 결과 화면.
   (남은 일: 계산은 아직 실수(float). 정수 고정소수점 전환은 하지 않음) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const DT = 1 / 60;
  const G = (TG.G = {
    phase: 'loading', tick: 0, time: 0, realT: 0, gauge: 0, combo: 0, comboT: 0, maxCombo: 0, notes: 0, popped: 0, rescued: 0, bossStarted: false,
    floor: 1, fogPop: 0, floorDone: false, level: 1, xp: 0, xpNeed: 10, pendingCards: 0, cardOpen: null, cardN: 0, revived: false,
    paused: false, bot: false, freeze: 0, hash: 0, cards: {}, mod: { size: 0, fast: 0, more: 0, magnet: 0, charge: 1 },
    settings: { bgm: 0.8, sfx: 0.9, lefty: false, shake: true, atk: 'manual', cam: 'strong' }, // cam: 카메라 따라가기 'off' / 'mid' / 'strong'(기본) // atk: 소리 방울 'auto'(가까운 안개에 저절로) / 'manual'(직접 누름)
    inBig: false, inPick: -1, inCard: -1, afters: [], camZoom: 1, machK: 1, drawT: 0, arT: 0,
  });
  const P = () => TG.PL;
  // 안개가 있는 놀이 단계
  const isPlay = () => G.phase === 'floor' || G.phase === 'shelter' || G.phase === 'bossIntro' || G.phase === 'boss';

  // 층마다 배정된 안개 양(게이지). 다 비우면 다음으로 — 시간으로 넘어가지 않음
  // spd = 그 층 안개 이동 속도 배율(fogs.js 의 기본 속도에 곱함 — 생성 직후 한 번), split = 한 무리가 몇 군데로 나뉘어 나오는지(직접 겨눠야 하므로 여러 쪽에서 오면 어려움)
  const FLOORS = [null,
    { budget: 88, cap: 20, iv: [1.35, 0.9], grp: [3, 5], clump: 0, echo: 0, tick: 0, spd: 1.4, split: 1, cocoonAt: 0.35, title: '1층 · 안개 방울이 와요!', sub: '「소리」 버튼을 꾹! 소리 방울이 나가요' },
    { budget: 120, cap: 28, iv: [1.15, 0.8], grp: [4, 7], clump: 5, echo: 0, tick: 0, spd: 1.65, split: 2, cocoonAt: 0.45, title: '2층 · 안개 뭉치가 굴러와요!', sub: '터지면 둘로 나뉘어요' },
    { budget: 150, cap: 36, iv: [1.0, 0.7], grp: [5, 8], clump: 6, echo: 4, tick: 8, spd: 1.85, split: 3, cocoonAt: 0.45, title: '3층 · 메아리 안개 등장!', sub: '한 번은 통! 튕겨요. 두 번째에 퐁' },
  ];
  const XP0 = 10, XP_STEP = 24;      // 레벨업 필요 음표: XP0 + XP_STEP × (레벨 − 1)
  const REST_HEAL = 2;              // 쉼터 「소리 회복」: 2칸 (전에는 가득)
  const AIM_N = 256;                // 조준 방향 기록 단위(한 바퀴 256칸)
  const AIM_ASSIST = 0.21;          // 약한 조준 도움: 쏘는 방향 좌우 약 12° 안의 대상에만 붙음
  const END_HOLD = 0.9;
  // 자동 모드(11-13): 너무 쉬워지지 않게 저절로 나가는 것만 조금 약하게 — 사거리 AUTO.range 배, 연사 간격 AUTO.cd 배. 받는 피해·직접 누름·큰 소리는 그대로
  const AUTO = { range: 0.75, cd: 1.5 };             // 0칸 → 결과 화면까지 (초)
  const REST = [{ id: 'heal', name: '소리 회복', icon: 'heal' }, { id: 'shield', name: '보호 방울', icon: 'shield' }, { id: 'notes', name: '음표 선물', icon: 'notes' }];
  // 비서 쎌(진행자) 대사 [표정, 말] — 그림·글만, 규칙 계산과 무관
  const GRUNT_REST = [null, ['smile', '잘했어! 하나 골라 봐~'], ['ok', '마지막 층이야. 숨 고르고 가자!']];
  const SSEL = (face, text, dur, delay) => { try { TG.H.gruntSay(text, dur || 2.6, face, delay); } catch (e) { /* 무시 */ } };

  // ── 저장된 설정 ──
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem('tg_slice_set') || '{}')); } catch (e) { /* 없음 */ }
  { const qa = new URLSearchParams(location.search).get('atk'); if (qa === 'auto' || qa === 'manual') G.settings.atk = qa; } // 시험: ?atk=auto
  if (G.settings.atk !== 'auto') G.settings.atk = 'manual';
  if (!['off', 'mid', 'strong'].includes(G.settings.cam)) G.settings.cam = 'strong';
  const isAuto = () => G.settings.atk === 'auto';
  function saveSet() { try { localStorage.setItem('tg_slice_set', JSON.stringify(G.settings)); } catch (e) { /* 무시 */ } }
  // ── 진동(햅틱) — js/haptics.js. 규칙 계산(걸음·난수)에는 아무 영향 없음. 설정 「진동」(소리·화면 흔들림과 따로) ──
  const HZ = window.GZHaptics ? window.GZHaptics.init({ key: 'tg_haptics', maxSeg: 150, maxTotal: 420, minGap: 50 }) : null;
  const VIB = { // [울림, 쉼, 울림 …] ms, 우선순위
    hit: [[14], 1], hit2: [[20], 2], hit3: [[28], 2], kill: [[30], 2], killBig: [[45], 3], rescue: [[25], 2], shield: [[18], 2],
    hurt: [[40, 60, 40], 4], big: [[70, 40, 50], 4], bossLand: [[110, 60, 70, 60, 120], 5], bossPhase: [[80, 50, 80], 4],
    bossLast: [[60], 5], bossPop: [[150, 70, 90, 60, 50], 6], covered: [[60, 80, 90], 5],
  };
  let hzHitT = -1e9;
  function vib(name) {
    if (!HZ) return;
    try {
      if (name === 'hit' || name === 'hit2') { const t = performance.now(); if (t - hzHitT < 110) return; hzHitT = t; } // 연발 명중은 0.11초에 한 번만
      const v = VIB[name]; if (v) HZ.play(name, v[0], v[1]);
    } catch (e) { /* 무시 */ }
  }
  G.vib = vib; G.VIB = VIB;

  // ── 시작 ──
  window.addEventListener('load', boot);
  let last = 0, acc = 0;
  function boot() {
    TG.H.init();
    TG.R.init(document.getElementById('c'));
    TG.onResize = () => TG.H.resize();
    TG.H.resize();
    TG.FX.initText(document.getElementById('fxText'));
    let k1 = 0, k2 = 0;
    const prog = () => TG.H.loadProg((k1 * 0.75 + k2 * 0.25) * 0.78);
    Promise.all([TG.M.load((k) => { k1 = k; prog(); }), TG.A.preload().then(() => { k2 = 1; prog(); })])
      .then(async () => {
        const sc = TG.R.scene;
        const rest = () => new Promise((r) => { let d = false; const f = () => { if (!d) { d = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 80); });
        const steps = [() => TG.AR.build(sc), () => TG.FX.init(sc), () => TG.PL.init(sc), () => TG.F.init(sc), () => { TG.WV.init(sc); TG.C.init(sc); },
          () => { TG.PL.mixer.update(0.01); TG.H.makeFace(); }, warmup];
        for (let i = 0; i < steps.length; i++) { steps[i](); TG.H.loadProg(0.78 + 0.22 * (i + 1) / steps.length); await rest(); }
        applySettings();
        bindInput();
        TG.H.show(TG.H.loading, false);
        if (TG.Q.bench) { startPlay(true); G.bot = true; G.bench = true; TG.Q.god = true; }
        else if (TG.Q.auto) { G.bot = true; startPlay(true); }
        else toTitle();
        if (TG.Q.jump) setTimeout(() => api.jump(TG.Q.jump), 300);
        last = performance.now();
        requestAnimationFrame(frame);
      })
      .catch((e) => { console.error(e); document.querySelector('#loading .ltxt').textContent = '불러오기 실패: ' + e.message; });
  }

  // 예열: 숨겨 둔 효과·보스·안개 재질까지 전부 한 번 그려 셰이더를 미리 만듦 (첫 판 끊김 방지). 로딩 화면 뒤라 보이지 않음. 실패해도 게임은 그대로 시작
  function warmup() {
    const R = TG.R, F = TG.F, FX = TG.FX, shown = [], inst = [];
    try {
      R.scene.traverse((o) => { if (!o.visible) { o.visible = true; shown.push(o); } if (o.isInstancedMesh && o.count === 0) { o.count = 1; inst.push(o); } });
      for (const k in FX.CELL) FX.emit(FX.CELL[k], 0, 1, 0, { life: 1, size: 0.1 });
      FX.ring(0, 0, { r0: 1, r1: 2, dur: 1 }); FX.ring(0, 0, { wall: true, r0: 1, r1: 2, dur: 1 });
      FX.update(0.05, null);
      R.camera.position.set(0, 30, 34); R.camera.lookAt(0, 0, 0); R.camera.updateMatrixWorld(true);
      R.followShadow(0, 0);
      R.render(0);
    } catch (e) { /* 예열 실패는 무시 */ }
    shown.forEach((o) => { o.visible = false; }); inst.forEach((o) => { o.count = 0; });
    try { FX.clear(); } catch (e) { /* 무시 */ }
  }

  function applySettings() {
    const s = G.settings;
    TG.A.setVol(s.bgm, s.sfx);
    document.body.classList.toggle('lefty', !!s.lefty);
    document.body.classList.toggle('atkAuto', isAuto());
    document.querySelectorAll('[data-cam]').forEach((b) => { const on = b.dataset.cam === s.cam; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    document.querySelectorAll('[data-atk]').forEach((b) => { const on = b.dataset.atk === s.atk; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    { const l = document.querySelector('#btnSnd .lbl'); if (l) l.textContent = isAuto() ? '자동' : '소리'; }
    document.getElementById('optShake').classList.toggle('on', s.shake !== false);
    document.getElementById('optLefty').classList.toggle('on', !!s.lefty);
    document.getElementById('optVibe').classList.toggle('on', !HZ || HZ.on);
    document.getElementById('optBgm').value = Math.round(s.bgm * 100);
    document.getElementById('optSfx').value = Math.round(s.sfx * 100);
  }

  // 걸음 수로 예약 (setTimeout 대신 — 그림 속도와 무관하게 같은 순서)
  G.after = function (ticks, fn) { G.afters.push({ t: Math.max(1, ticks | 0), fn }); };
  function runAfters() {
    const a = G.afters;
    for (let i = 0; i < a.length; i++) { if (--a[i].t <= 0) { const fn = a[i].fn; a.splice(i, 1); i--; fn(); } }
  }

  function resetRun(keepFx) {
    G.tick = 0; G.time = 0; G.realT = 0; G.gauge = 0; G.combo = 0; G.comboT = 0; G.maxCombo = 0; G.notes = 0; G.popped = 0; G.rescued = 0; G.bossStarted = false;
    G.floor = 1; G.fogPop = 0; G.floorDone = false; G.cocoonDone = false; G.level = 1; G.xp = 0; G.xpNeed = XP0; G.pendingCards = 0; G.cardOpen = null; G.cardN = 0; G.revived = false;
    G.spawnT = 1.0; G.clumpT = 4; G.echoT = 3; G.tickT = 5; G.autoCd = 0.3; G.stillT = 0; G.faceDir = 0; G.fireOn = false; G.fireDir = 0; G.shots = 0; G.aimShots = 0; G.hintT = 0; G.hurts = 0; G.testIn = null; G.endT = 0; G.clear = false; G.cheered = false; G.freeze = 0; G.hash = 0; G.hsCd = 0;
    G.gaugeLock = 0; G.hintStage = 0; G.moved = 0; G.afters.length = 0; G.inBig = false; G.inPick = -1; G.inCard = -1; G.botW = 0; G.botStuck = 0; G.botSideT = 0; G.botSideS = 1; G.botLx = 0; G.botLz = 0; G.botCocT = 0; G.machSlow = false; G.camFocusK = 0.45;
    G.autoTicks = 0; G.playTicks = 0; G.autoShots = 0; G.autoOn = false;
    G.denyT = -9; G.shelterT = 0; G.shelterPick = -1; G.covT = 0; G.biT = 0; G.biStage = 0; G.lid = null; G.countAt = null; G.lastCount = -1;
    TG.F.reset(); TG.WV.reset(); if (!keepFx) TG.FX.clear(); TG.PL.reset(); TG.PL.setRest(false); TG.C.reset();
    TG.H.hideCards(); TG.H.hideShelter(); TG.H.gruntHide(); TG.H.hintSet(null);
    TG.PL.stillLv = 0; TG.PL.idleT = 0; G.result = null;
    G.hemiT = 1.35; G.camZoom = 1;
    cam.lx = cam.lz = cam.vlx = cam.vlz = cam.gx = cam.gz = cam.hold = cam.cT = cam.m = cam.mT = 0;
  }

  function toTitle() {
    resetRun();
    G.phase = 'title'; G.replay = null;
    TG.PL.x = 0; TG.PL.z = 3.5; TG.PL.px = 0; TG.PL.pz = 3.5; TG.PL.yaw = TG.PL.tyaw = 0;
    TG.H.show(TG.H.title, true); TG.H.show(TG.H.hud, false); TG.H.show(TG.H.result, false); TG.H.show(TG.H.pause, false);
    TG.A.bgm('bgm_win', 0.6, true);
    G.paused = false;
    TG.H.sselTitleStart();
  }

  function showHud() {
    TG.H.show(TG.H.title, false); TG.H.show(TG.H.hud, true); TG.H.show(TG.H.result, false);
    TG.H.show(TG.H.stick, TG.isTouch); TG.H.show(TG.H.keyHint, !TG.isTouch);
  }
  // 시작 연출: 맨홀 덜컹 → SEFO 튀어나와 착지 → 출발!
  function startIntro() {
    resetRun();
    showHud();
    G.phase = 'intro'; G.introT = 0; G.replay = null;
    TG.PL.root.visible = false; TG.PL.ring.visible = false;
    TG.A.stopBgm(0.4);
    const mh = TG.AR.manholeMeshes[0];
    G.lid = { mesh: mh, t: 0, y0: mh.position.y };
  }
  // 놀이 시작: 여기서부터 규칙 계산이 기록·재생 대상 (처음 상태를 늘 똑같이 맞춤)
  function startPlay(skipIntro) {
    resetRun(!skipIntro);
    if (skipIntro) showHud();
    const p = P();
    p.x = p.px = 0; p.z = p.pz = 3.2; p.root.visible = true; p.ring.visible = true;
    const rp = G.replay;
    G.seed = rp ? rp.seed : (TG.Q.seed != null ? TG.Q.seed >>> 0 : (Math.random() * 4294967296) >>> 0);
    let first;
    if (rp) first = !!rp.first;
    else if (TG.Q.first != null) first = TG.Q.first === '1';
    else if (TG.Q.seed != null) first = true;
    else { try { first = !localStorage.getItem('tg_slice_boss'); } catch (e) { first = true; } }
    G.firstBoss = first;
    if (rp) TG.Q.god = !!rp.god;
    TG.simSeed(G.seed);
    G.rec = { v: 2, seed: G.seed, first: first ? 1 : 0, god: TG.Q.god ? 1 : 0, ticks: [], cards: [] };
    G.rpI = 0; G.rpN = 0; G.replayDone = false;
    TG.A.bgm('bgm_battle', 0.8);
    startFloor(1);
  }

  function updateIntro(dt) {
    G.introT += dt;
    const t = G.introT, L = G.lid;
    // 맨홀 뚜껑이 들썩 → 튀어오름
    if (t < 0.9) {
      const k = Math.sin(t * 40) * 0.04 * (t > 0.3 ? 1 : 0);
      L.mesh.position.y = L.y0 + Math.max(0, k);
      if (t > 0.3 && !L.r1) { L.r1 = true; TG.A.play('sfx_bonk', { rate: 0.7, gain: 0.6 }); }
    } else {
      if (!L.flip) {
        L.flip = true; L.vy = 9; L.y = 0.02; L.rot = 0;
        TG.A.play('sfx_bonk', { rate: 0.55, gain: 0.95 }); TG.A.play('sfx_steam', { gain: 0.6 });
        TG.FX.steam(L.mesh.position.x, L.mesh.position.z); TG.FX.shake(0.3);
        TG.PL.root.visible = true; TG.PL.ring.visible = true;
        TG.PL.introLaunch(L.mesh.position.x, L.mesh.position.z, 0, 3.2, () => {
          TG.FX.shake(0.35); TG.FX.ring(0, 3.2, { r0: 0.5, r1: 3.5, dur: 0.45, color: 0xfff3d6, width: 0.2 }); TG.A.play('sfx_bonk', { rate: 1.1, gain: 0.7 });
          G.countAt = G.introT + 0.35;
        });
      }
      L.vy -= 30 * dt; L.y += L.vy * dt; L.rot += dt * 14;
      if (L.y <= 0.015) { L.y = 0.015; L.vy = Math.abs(L.vy) > 2 ? -L.vy * 0.35 : 0; L.rot = Math.round(L.rot / Math.PI) * Math.PI; }
      L.mesh.position.y = L.y; L.mesh.position.x = TG.AR.manholes[0][0] + Math.min(1.2, (t - 0.9) * 2.4); L.mesh.rotation.x = L.rot;
    }
    if (G.countAt != null) { // 숫자 세기 없이 바로 「출발!」
      const c = G.introT - G.countAt;
      if (c >= 0 && G.lastCount < 0) { G.lastCount = 0; TG.H.countShow('출발!', true); TG.A.countBeep(true); TG.PL.kick(5); }
      if (c >= 0.7) { TG.H.countHide(); G.countAt = null; G.lastCount = -1; startPlay(false); }
    }
  }

  // ── 층 진행 (안개 게이지) ──
  function startFloor(n) {
    const f = FLOORS[n];
    G.phase = 'floor'; G.floor = n; G.fogPop = 0; G.floorDone = false; G.cocoonDone = false;
    G.spawnT = 1.0; G.clumpT = 3; G.echoT = 2.5; G.tickT = 6;
    G.hemiT = 1.35; G.camZoom = 1;
    TG.H.hideShelter(); TG.H.gruntHide();
    TG.H.showBanner(f.title, n === 1 && isAuto() ? '가까운 안개에 소리 방울이 저절로 나가요' : f.sub, '', 2.4);
    if (n === 1) SSEL(isAuto() ? 'ok' : 'wink', isAuto() ? '소리 방울은 저절로! 넌 음표만 주워~' : TG.isTouch ? '안개 온다! 「소리」 꾹 눌러 봐!' : '안개 온다! 마우스 꾹 눌러 봐!', 3.2, 2.4);
    else if (n === 2) SSEL('think', '뭉치는 터지면 둘로 나뉘어! 조심~', 3.0, 2.4);
    else SSEL('wink', '메아리는 두 번 맞혀야 퐁! 할 수 있지?', 3.0, 2.4);
    if (n > 1) TG.A.countBeep(true);
  }
  G.fogLeft = function () {
    if (G.phase === 'shelter' || G.floorDone) return 0;
    return Math.max(0, 1 - G.fogPop / FLOORS[G.floor].budget);
  };
  function spawnPoint(minD) {
    const p = P();
    for (let i = 0; i < 20; i++) {
      let x, z;
      if (TG.sr() < 0.3) { const m = TG.AR.manholes[(TG.sr() * TG.AR.manholes.length) | 0]; x = m[0]; z = m[1]; }
      else {
        const side = (TG.sr() * 4) | 0, AR = TG.AR;
        if (side < 2) { x = TG.srr(-AR.bx + 1, AR.bx - 1); z = side ? AR.bz - 0.8 : -AR.bz + 0.8; } else { z = TG.srr(-AR.bz + 1, AR.bz - 1); x = side === 2 ? AR.bx - 0.8 : -AR.bx + 0.8; }
      }
      if (Math.hypot(x - p.x, z - p.z) >= minD && !TG.AR.blocked(x, z, 0.5)) return [x, z];
    }
    return [P().x > 0 ? -16 : 16, 0];
  }
  function spawnGroup(kind, n) {
    const [x, z] = spawnPoint(kind === 'clump' ? 9 : 8);
    TG.FX.ring(x, z, { r0: 0.3, r1: 2.2, dur: 0.5, color: kind === 'echo' ? 0x9fc4ff : 0xc9c2ea, width: 0.25 });
    TG.FX.popBurst(x, 0.6, z, 0.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28, r = n > 1 ? 0.9 : 0;
      const u = TG.F.spawn(kind, x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (u) u.spawnT = -i * 0.08;
    }
  }
  function updateSpawns(dt) {
    if (G.floorDone || G.bench) return;
    const f = FLOORS[G.floor], F = TG.F;
    const live = F.liveVal(), k = Math.min(1, G.fogPop / f.budget);
    const left = f.budget - G.fogPop - live; // 아직 안 나온 양
    const room = left > 0 && live < f.cap;
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      G.spawnT = TG.lerp(f.iv[0], f.iv[1], k);
      if (room) {
        const n = Math.max(1, Math.min(left, f.grp[0] + ((TG.sr() * (f.grp[1] - f.grp[0] + 1)) | 0))), parts = Math.min(f.split || 1, n);
        for (let i = 0; i < parts; i++) spawnGroup('bubble', Math.floor(n / parts) + (i < n % parts ? 1 : 0));
      }
    }
    if (f.clump) { G.clumpT -= dt; if (G.clumpT <= 0) { G.clumpT = f.clump; if (room && left >= 3 && F.count('clump') < 5) spawnGroup('clump', 1); } }
    if (f.echo) { G.echoT -= dt; if (G.echoT <= 0) { G.echoT = f.echo; if (room && left >= 4 && F.count('echo') < 8) spawnGroup('echo', 2); } }
    if (f.tick) { G.tickT -= dt; if (G.tickT <= 0) { G.tickT = f.tick; if (room && left >= 6 && F.count('tick') < 8) { F.spawnTickLine(3, P().x, P().z); TG.A.tick(0.7); } } }
    // 안개 고치(속에 주민): 층마다 한 번
    if (!G.cocoonDone && k >= f.cocoonAt) {
      G.cocoonDone = true;
      for (let i = 0; i < 12; i++) {
        const x = TG.srr(-13, 13), z = TG.srr(-8, 9);
        if (Math.hypot(x - P().x, z - P().z) > 6 && !TG.AR.blocked(x, z, 1.6)) { const u = F.spawn('cocoon', x, z, { slot: G.floor % 3 }); if (u) { TG.FX.popBurst(x, 1, z, 1.2); TG.FX.text('도와줘요!', x, 3.4, z, 'thanks'); } break; }
      }
    }
    // 혹시 남은 양이 없는데 게이지가 안 비면(구석에 낀 경우 등) 마저 비움
    if (left <= 0 && live <= 0 && G.fogPop < f.budget) { G.fogPop = f.budget; floorClear(); }
  }
  function fogGain(u) {
    if (G.phase !== 'floor' || G.floorDone || !u.val || G.bench) return;
    G.fogPop += u.val;
    if (G.fogPop >= FLOORS[G.floor].budget) floorClear();
  }
  function floorClear() {
    if (G.floorDone) return;
    G.floorDone = true;
    TG.H.showBanner(G.floor + '층 안개 걷힘!', '', 'gold', 1.8);
    TG.A.cheer(1); TG.FX.shake(0.15);
    P().noHurt = Math.max(P().noHurt, 2.5);
    // 남은 안개는 차례로 퐁 (큰 소리 게이지는 안 참), 째깍이는 떠나고, 고치는 풀림
    TG.F.list.forEach((u, i) => {
      if (u.state !== 'live') { if (u.kind === 'tick' && u.state === 'dance') { u.state = 'leave'; u.dieT = 0; } return; }
      if (u.kind === 'cocoon') { u.prog = 2; return; }
      if (u.kind === 'tick') { u.state = 'leave'; u.dieT = 0; return; }
      u.byBig = true;
      G.after(8 + i * 2, () => { if (u.state === 'live') { u.state = 'dying'; u.dieT = 0; } });
    });
    G.after(100, () => { if (G.phase !== 'floor') return; if (G.floor < 3) toShelter(); else startBossIntro(); });
  }

  // ── 쉼터 (약 10초): 비서 그런트 한 줄 + 3택1. 안 고르면 저절로 회복 ──
  function toShelter() {
    G.phase = 'shelter'; G.shelterT = 0; G.shelterPick = -1; G.shelterEnd = 1e9;
    G.hemiT = 1.42; G.camZoom = 0.92;
    P().noHurt = 2;
    TG.H.showShelter(REST, (i) => { G.inPick = i; });
    { const g = GRUNT_REST[G.floor] || GRUNT_REST[1]; SSEL(g[0], g[1], 9.5); }
    TG.H.showBanner('쉼터', '잠깐 쉬어 가요', 'gold', 1.6);
    TG.A.syn('shelter'); TG.A.duck(0.45, 9);
    TG.FX.ring(P().x, P().z, { r0: 0.6, r1: 5, dur: 0.7, color: 0xffe9a8, width: 0.2 });
  }
  function applyRest(i, auto) {
    const p = P(), FX = TG.FX, id = REST[i] ? REST[i].id : 'heal';
    G.shelterPick = i; G.shelterEnd = G.shelterT + 0.9;
    TG.H.markShelter(i);
    TG.A.syn('cardPick');
    if (id === 'heal') { p.hp = Math.min(p.maxHp, p.hp + REST_HEAL); FX.text(auto ? '저절로 회복!' : '소리 크기 회복!', p.x, 4.0, p.z, 'heal'); for (let k = 0; k < 8; k++) FX.emit(FX.CELL.heart, p.x + TG.fra(-1, 1), 1 + TG.fra(0, 1), p.z + TG.fra(-1, 1), { vy: TG.fra(1.5, 3), life: 0.8, size: 0.5, size1: 0.2, color: [2.2, 0.7, 0.6], rot: 0, pop: true }); }
    else if (id === 'shield') { p.shield = 1; FX.text('보호 방울!', p.x, 4.0, p.z, 'word'); FX.ring(p.x, p.z, { r0: 0.4, r1: 2.4, dur: 0.5, color: 0x8fdcff, width: 0.3 }); }
    else { TG.F.dropNotes(p.x, p.z, 8, 1.3); FX.text('음표 선물!', p.x, 4.0, p.z, 'cheer'); }
    p.glow = 0.5; p.kick(3);
  }
  function updateShelter(dt, inp) {
    G.shelterT += dt;
    if (G.shelterPick < 0) {
      if (inp.pick >= 0 && inp.pick < REST.length && G.shelterT > 0.4) applyRest(inp.pick, false);
      else if (G.shelterT >= 10) applyRest(0, true);
    } else if (G.shelterT >= G.shelterEnd) startFloor(G.floor + 1);
  }

  // ── 보스 등장: 기계가 잠깐 느려짐 → 가운데 큰 안개가 뭉침 → 이름 띠 → 카메라 줌 → SEFO가 보스 쪽을 봄 ──
  function startBossIntro() {
    G.phase = 'bossIntro'; G.bossStarted = true; G.biT = 0; G.biStage = 0;
    G.machSlow = true; G.hemiT = 1.1; G.camFocusK = 0.5;
    P().noHurt = 6;
    TG.A.stopBgm(0.7); TG.A.syn('bossIn');
    TG.H.hintSet(null);
  }
  function updateBossIntro(dt) {
    G.biT += dt;
    const p = P();
    if (G.biStage === 0 && G.biT >= 0.9) {
      G.biStage = 1;
      const b = TG.F.startBoss(G.firstBoss);
      TG.A.bgm('bgm_boss', 1.6); TG.A.duck(0.5, 1.6);
      G.camFocusK = 0.75;
      TG.FX.ring(b.x, b.z, { r0: 11, r1: 1.5, dur: 1.5, color: 0xdcd8cc, width: 0.12, alpha: 0.4, hdr: 1.0 });
    }
    if (G.biStage >= 1 && TG.F.boss) { const b = TG.F.boss; p.tyaw = Math.atan2(b.x - p.x, b.z - p.z); p.faceLock = 0.3; }
  }
  G.onBossLand = function () {
    const b = TG.F.boss, FX = TG.FX;
    G.machSlow = false; G.biStage = 2;
    FX.shake(0.7); FX.hitstop(70); FX.punch(0.05); vib('bossLand');
    FX.ring(b.x, b.z, { r0: 1, r1: 10, dur: 0.6, color: 0xfff3d6, width: 0.1, hdr: 1.1, alpha: 0.7 });
    FX.ring(b.x, b.z, { r0: 1, r1: 7, dur: 0.5, color: 0xdcd8cc, width: 0.1, delay: 0.1, hdr: 1.0, alpha: 0.4 });
    FX.dust(b.x, b.z, 16, 2.4);
    TG.A.play('sfx_big', { rate: 0.6, gain: 0.9 }); TG.A.boom();
    TG.H.showBanner('큰 침묵 안개', '노래를 꽁꽁 숨긴 안개예요', 'boss name', 2.2);
    SSEL('surprise', '헉, 엄청 큰 안개야! 같이 해 보자!', 3.0);
    G.camZoom = 0.74; G.camFocusK = 0.85; // 잠깐 줌
    G.after(84, () => { if (G.phase === 'bossIntro') { G.phase = 'boss'; G.camZoom = 1.12; G.camFocusK = 0.45; G.hemiT = 1.35; } });
  };

  // ── 명중 처리 (파동·친구 음표·큰 소리·함께하는 친구 공통). 대상은 안개·기계뿐 ──
  // 순서: 접촉 → 히트 스톱(보통 1걸음, 강한 것만 길게) → 흰 번쩍 → 거품 → 별 → 안개가 눌렸다 터짐 → 음표 방울
  G.hitUnit = function (u, dmg, ox, oz, quiet, level, tint) {
    const big = dmg >= 50, lv = level || 0;
    const r = TG.F.damage(u, dmg, ox, oz, big);
    if (!r) return null;
    const FX = TG.FX;
    const y = u.y + (u.kind === 'clump' ? 0.8 : u.kind === 'tick' ? 0.8 : 0.1);
    if (r === 'bounce') { // 메아리 안개: 파동을 한 번 통 튕겨냄 + 표면 원형 리플
      for (let i = 0; i < 3; i++) FX.emit(FX.CELL.ring, u.x, y, u.z, { life: 0.34 + i * 0.12, size: 0.5, size1: 2.4 + i * 1.3, color: [0.8, 1.4, 2.4], alpha: 0.9 });
      FX.text('통!', u.x, y + 1.6, u.z, 'echo');
      TG.A.syn('echo');
      if (G.hsCd <= 0) { FX.hitstop(17); G.hsCd = 0.1; }
      return r;
    }
    if (!quiet) {
      if (lv >= 2) FX.hitstop(lv === 3 ? 50 : 34);
      else if (G.hsCd <= 0) { FX.hitstop(17); G.hsCd = 0.12; }
    }
    FX.hitSeq(u.x, y, u.z, lv, tint);
    if ((!quiet || big) && r !== 'convert') vib(big ? 'hit3' : lv >= 3 ? 'hit3' : lv >= 2 ? 'hit2' : 'hit'); // 바뀌는 순간은 아래 처치 진동만
    if (!big && (u.maxHp > 1 || lv >= 2)) FX.dmg('u' + u.id, Math.round(dmg * 120), u.x, y + 1.0, u.z, lv);
    addCombo();
    if (!quiet) TG.A.hitSmall();
    if (lv === 3 && !quiet) FX.shake(0.2);
    if (r === 'convert') {
      FX.popBurst(u.x, 1, u.z, 1.0, [0.8, 2.2, 2.0]);
      FX.text('춤추는 째깍이!', u.x, 2.6, u.z, 'word');
      for (let i = 0; i < 6; i++) FX.emit(FX.CELL.note2, u.x, 1.2, u.z, { vx: TG.fra(-3, 3), vy: TG.fra(3, 6), vz: TG.fra(-3, 3), life: 0.9, size: 0.6, size1: 0.3, color: [[2.4, 0.6, 0.5], [2.4, 2.0, 0.6], [0.6, 2.2, 2.0]][i % 3], grav: 6, pop: true });
      TG.A.pop(G.combo, true); TG.A.play('sfx_pick', { rate: 1.5, gain: 0.6 });
      FX.hitstop(45); FX.shake(0.18); vib('kill');
      if (!u.byBig) addGauge(8);
      G.popped++;
      TG.F.dropNotes(u.x, u.z, 4, 1, !!u.byBig);
      fogGain(u);
    } else if (u.kind === 'clump') { FX.shake(0.05); }
    return r;
  };
  G.hitBoss = function (dmg, x, z, quiet, level) {
    const r = TG.F.damageBoss(dmg);
    if (!r) return;
    const b = TG.F.boss, FX = TG.FX;
    const lv = dmg >= 5 ? 3 : dmg >= 3 ? 2 : dmg >= 2 ? 1 : 0;
    FX.hitSeq(x, 2.4 + TG.fra(-0.5, 0.8), z, Math.min(lv, 1), [1.4, 1.34, 1.22], [1.2, 1.17, 1.08]); // 옅은 크림빛, 작게 (보라가 화면에 쌓이지 않게)
    FX.dmg('boss', Math.round(dmg * 120), b.x, 4.6 * b.scale + 0.6, b.z, lv);
    addCombo();
    if (!quiet && r !== 'phase' && r !== 'dead') vib(lv >= 2 ? 'hit2' : 'hit'); // 단계·마지막 명중은 아래 큰 진동만
    if (!quiet) { TG.A.hitSmall(); if (G.hsCd <= 0) { FX.hitstop(lv >= 2 ? 34 : 17); G.hsCd = 0.12; } }
    if (r === 'phase') {
      FX.hitstop(100); FX.shake(0.55); FX.punch(0.06); TG.R.bloomPulse = 0.12; vib('bossPhase');
      FX.popBurst(b.x, 2.5, b.z, 2.0, [1.3, 1.26, 1.16]); FX.ring(b.x, b.z, { r0: 1, r1: 8, dur: 0.5, color: 0xfff3d6, width: 0.1, alpha: 0.7, hdr: 1.1 });
      FX.text('작아졌어요!', b.x, 5, b.z, 'word');
      SSEL('cheer', '작아졌다! 그대로 계속 가!', 2.4);
      TG.A.syn('bossPhase'); TG.A.pop(0, true);
      TG.F.dropNotes(b.x, b.z, 8, 1.6);
    } else if (r === 'dead') {
      // 마지막 명중 → 0.4초 멈춤 → (fogs.js) 크게 부풂 → 큰 퐁
      FX.hitstop(400); FX.shake(0.5); TG.A.duck(0.2, 2.2); TG.A.stopBgm(0.5); vib('bossLast');
      P().noHurt = 9;
    }
  };

  // 안개가 터질 때 (fogs.js 에서 부름)
  G.onPop = function (u) {
    const FX = TG.FX, big = u.kind === 'clump';
    const y = u.y + (big ? 0.7 : 0.1);
    FX.popBurst(u.x, y, u.z, big ? 1.8 : 1, u.kind === 'echo' ? [0.8, 1.2, 2.0] : null);
    for (let i = 0; i < (big ? 4 : 2); i++) FX.emit(i % 2 ? FX.CELL.note : FX.CELL.note2, u.x, y + 0.3, u.z, { vx: TG.fra(-2.5, 2.5), vy: TG.fra(4, 6.5), vz: TG.fra(-2.5, 2.5), life: 0.8, size: 0.55, size1: 0.3, color: [[2.4, 0.6, 0.5], [2.4, 2.0, 0.6], [0.7, 1.9, 2.4]][(TG.fr() * 3) | 0], grav: 9, pop: true, vrot: TG.fra(-3, 3), rot: 0 });
    TG.A.pop(G.combo, big);
    vib(big ? 'killBig' : 'kill');
    if (big) { FX.hitstop(50); FX.shake(0.22); FX.punch(0.025); FX.text('퐁!', u.x, y + 1.6, u.z, 'pop'); }
    else if (u.byBig && G.combo > 0 && G.combo % 10 === 0) FX.text('퐁!', u.x, y + 1.2, u.z, 'pop');
    G.popped++;
    if (!u.byBig) addGauge(big ? 8 : u.kind === 'echo' ? 6 : 4);
    TG.F.dropNotes(u.x, u.z, big ? 3 : u.kind === 'echo' ? 2 : 1, 1, !!u.byBig);
    if (big) { // 작은 방울 2개가 서로 반대 방향으로 튀어 나감
      const a = TG.sr() * 6.283;
      for (let i = 0; i < 2; i++) {
        const b = a + i * Math.PI;
        const v = TG.F.spawn('bubble', u.x + Math.cos(b) * 0.7, u.z + Math.sin(b) * 0.7, { vx: Math.cos(b) * 7, vz: Math.sin(b) * 7, small: true });
        if (v) { v.spawnT = 0.25; v.y = 0.8; v.byBig = u.byBig; if (G.floorDone) G.after(20, () => { if (v.state === 'live') { v.byBig = true; v.state = 'dying'; v.dieT = 0; } }); }
      }
    }
    fogGain(u);
  };
  // 안개에 닿음: 「소리 크기」 1칸 줄고 「뽀잉」
  G.onHurt = function (src, res) {
    const FX = TG.FX, p = P();
    if (res === 'shield') {
      TG.A.syn('shield'); FX.shake(0.12); vib('shield');
      FX.text('보호 방울 톡!', p.x, 3.6, p.z, 'word');
      FX.ring(p.x, p.z, { r0: 0.6, r1: 3, dur: 0.4, color: 0x8fdcff, width: 0.3 });
      return;
    }
    TG.A.syn('boing'); TG.A.play('sfx_bonk', { gain: 0.45, rate: TG.fra(0.95, 1.1) });
    FX.shake(0.32); FX.hitstop(50); vib(p.hp <= 0 ? 'covered' : 'hurt');
    FX.text('뽀잉!', p.x, 3.6, p.z, 'boing');
    for (let i = 0; i < 5; i++) FX.emit(FX.CELL.star, p.x, 1.6, p.z, { vx: TG.fra(-3, 3), vy: TG.fra(2, 5), vz: TG.fra(-3, 3), life: 0.45, size: 0.4, size1: 0.1, color: [2.2, 2.2, 2.2], grav: 8, pop: true });
    G.combo = 0; G.hurts++;
    if (p.hp <= 0) toCovered();
    else if (p.hp === 1 && p.maxHp > 1) SSEL('surprise', '앗, 한 칸 남았어! 조심조심~', 2.4);
  };
  G.onPick = function (n) {
    G.notes++;
    TG.A.pick();
    TG.FX.emit(TG.FX.CELL.glow, n.x, n.y, n.z, { life: 0.15, size: 0.8, size1: 1.4, color: [2.0, 1.7, 0.6], alpha: 0.45 });
    if (!n.noGauge) addGauge(1.5);
    // 음표 → 소리 게이지(레벨)
    G.xp++;
    if (G.xp >= G.xpNeed) { G.xp -= G.xpNeed; G.level++; G.xpNeed = XP0 + XP_STEP * (G.level - 1); G.pendingCards++; }
  };
  // 안개 고치가 풀림: 주민 「고마워요!」 + 음표
  G.onRescue = function (u) {
    const FX = TG.FX;
    G.rescued++;
    FX.popBurst(u.x, 1.2, u.z, 2.0); FX.shake(0.1); vib('rescue');
    FX.ring(u.x, u.z, { r0: 0.5, r1: 4, dur: 0.5, color: 0xffe07a, width: 0.25 });
    for (let i = 0; i < 10; i++) FX.emit(i % 2 ? FX.CELL.heart : FX.CELL.sparkle, u.x + TG.fra(-0.8, 0.8), 1.4, u.z + TG.fra(-0.8, 0.8), { vx: TG.fra(-2, 2), vy: TG.fra(2, 5), vz: TG.fra(-2, 2), life: 0.9, size: 0.5, size1: 0.15, color: i % 2 ? [2.3, 0.8, 0.9] : [2.4, 2.1, 1.0], grav: 4, rot: 0, pop: true });
    FX.text('고마워요!', u.x, 3.6, u.z, 'thanks');
    TG.A.syn('rescue');
    TG.F.dropNotes(u.x, u.z, 6, 1.3);
  };
  G.onBossPop = function (b) {
    const FX = TG.FX;
    FX.hitstop(130); FX.shake(0.9); FX.punch(0.09); TG.R.bloomPulse = 0.4; vib('bossPop');
    TG.A.play('sfx_bossend', { gain: 1 }); TG.A.boom();
    FX.popBurst(b.x, 2.4, b.z, 4);
    for (let i = 0; i < 3; i++) FX.ring(b.x, b.z, { r0: 1, r1: 16 + i * 4, dur: 0.9 + i * 0.15, color: [0xffd966, 0xff8a5b, 0xffffff][i], width: 0.16, delay: i * 0.12 });
    FX.ring(b.x, b.z, { wall: true, r0: 2, r1: 14, dur: 0.8, color: 0xffd966, h: 2.2, alpha: 0.5, hdr: 1 });
    // 노래 조각(음표) 수십 개가 사방으로 흩어져 마을로 돌아감
    const cols = [[2.4, 0.6, 0.5], [2.4, 2.0, 0.6], [0.7, 1.9, 2.4], [1.9, 0.8, 2.2], [0.8, 2.2, 0.9]];
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * 6.283 + TG.fr() * 0.2, sp = TG.fra(7, 15);
      FX.emit([FX.CELL.note, FX.CELL.note2, FX.CELL.flower][i % 3], b.x, 2.5, b.z, { vx: Math.cos(a) * sp, vy: TG.fra(6, 12), vz: Math.sin(a) * sp, life: TG.fra(1.6, 2.4), size: TG.fra(0.7, 1.1), size1: 0.5, color: cols[i % 5], grav: 5, drag: 0.4, vrot: TG.fra(-3, 3), rot: 0, pop: true });
    }
    for (let i = 0; i < 40; i++) FX.emit(FX.CELL.sparkle, b.x + TG.fra(-3, 3), TG.fra(1, 4), b.z + TG.fra(-3, 3), { vy: TG.fra(1, 4), life: TG.fra(0.6, 1.2), size: 0.6, size1: 0, color: [2.4, 2.2, 1.4] });
    // 남은 안개도 모두 퐁, 째깍이는 춤
    TG.F.list.forEach((u, i) => {
      if (u.kind === 'tick') { if (u.state === 'live') { u.state = 'dance'; u.danceT = 0; } return; }
      if (u.state === 'live' && u.kind !== 'cocoon') { u.byBig = true; G.after(6 + i * 2, () => { if (u.state === 'live') { u.state = 'dying'; u.dieT = 0; } }); }
    });
    TG.F.zone.on = false;
    TG.F.dropNotes(b.x, b.z, 16, 2, true);
    G.phase = 'bossEnd'; G.endT = 0; G.clear = true;
    SSEL('cheer', '해냈다! 너 최고야!', 2.6);
    G.camZoom = 0.9; G.hemiT = 1.5;
    TG.A.bgm('bgm_win', 0.25, false); // 승리곡
    G.after(36, () => TG.H.showBanner('노래를 되찾았어요!', '톱니골에 노래가 돌아와요', 'gold', 3.0));
    try { localStorage.setItem('tg_slice_boss', '1'); } catch (e) { /* 무시 */ }
  };

  function addCombo() {
    G.combo++; G.comboT = 1.2; if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    const ms = { 10: ['좋아요!', 0], 25: ['대단해요!', 1], 50: ['톱니골 최고!', 2] }[G.combo];
    if (ms) { TG.FX.text(ms[0], P().x, 4.3, P().z, 'cheer'); TG.A.cheer(ms[1]); TG.FX.shake(0.06); }
  }
  // 큰 소리 게이지: 음표 줍기·안개 터뜨리기로만 참. 쓴 직후(잠금 시간)에는 차지 않음
  function addGauge(v) {
    if (G.gaugeLock > 0) return;
    const before = G.gauge;
    G.gauge = Math.min(100, G.gauge + v * G.mod.charge);
    if (before < 100 && G.gauge >= 100) { TG.A.syn('bigReady'); TG.FX.text('큰 소리 준비!', P().x, 3.2, P().z, 'word'); }
  }

  // ── 큰 소리 ──
  function bigSound() {
    const p = P();
    if (!(G.phase === 'floor' || G.phase === 'boss') || G.gauge < 100 || p.airborne || p.resting) return false;
    G.gauge = 0; G.gaugeLock = 3.0; // 쓰면 0으로, 3초 동안 다시 차지 않음
    const lv = p.stillLv || 0, pow = 1 + lv * 0.12; // 둘레 링 단계만큼 세짐
    G.stillT = 0;
    TG.H.say('다 같이 손 머리 위로!', 1.8);
    TG.A.duck(0.35, 1.4);
    TG.A.ui(1.2);
    p.noHurt = Math.max(p.noHurt, 1.6);
    { // 누른 즉시: 버튼 번쩍·발밑 링 2겹·위로 솟는 반짝·모으는 소리 (효과 판정은 착지 때 그대로)
      const FX = TG.FX;
      TG.H.bigFire(); TG.A.charge(3);
      FX.ring(p.x, p.z, { r0: 0.5, r1: 4.2, dur: 0.2, color: 0xffd966, width: 0.3, hdr: 1.5 });
      FX.ring(p.x, p.z, { r0: 3.6, r1: 1.0, dur: 0.42, color: 0xff8a5b, width: 0.22, alpha: 0.85 });
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; FX.emit(FX.CELL.sparkle, p.x + Math.cos(a) * 1.3, 0.4, p.z + Math.sin(a) * 1.3, { vy: TG.fra(5, 8), life: 0.4, size: 0.55, size1: 0, color: [2.5, 2.0, 0.8] }); }
      FX.punch(0.02); TG.R.bloomPulse = Math.max(TG.R.bloomPulse, 0.12);
    }
    p.bigJump(() => {
      const FX = TG.FX, x = p.x, z = p.z, R2 = 12.5 * pow;
      FX.hitstop(80); FX.shake(0.75); FX.punch(0.1); TG.R.bloomPulse = 0.32; vib('big');
      TG.A.play('sfx_big', { gain: 1 }); TG.A.boom();
      FX.ring(x, z, { r0: 0.8, r1: R2, dur: 0.65, color: 0xe5352b, width: 0.12, hdr: 1.4 });
      FX.ring(x, z, { r0: 0.8, r1: R2 * 0.88, dur: 0.7, color: 0xffc23a, width: 0.1, delay: 0.12, hdr: 1.3, alpha: 0.85 });
      FX.ring(x, z, { r0: 0.8, r1: R2 * 0.76, dur: 0.75, color: 0xff8a5b, width: 0.08, delay: 0.24, hdr: 1.3, alpha: 0.8 });
      FX.ring(x, z, { wall: true, r0: 2.2, r1: R2 * 0.96, dur: 0.6, color: 0xff6a4a, h: 1.6, alpha: 0.45, hdr: 1 });
      FX.ring(x, z, { wall: true, r0: 2.2, r1: R2 * 0.8, dur: 0.7, color: 0xffd966, h: 1.2, delay: 0.15, alpha: 0.4, hdr: 1 });
      FX.noteFlower(x, z, 9 * pow);
      FX.dust(x, z, 14, 1.6);
      // 반경 안 안개를 거리 순서로 차례차례 터뜨림 (고치·사람은 대상이 아님)
      for (const u of TG.F.list) {
        if (u.state !== 'live' || u.kind === 'cocoon') continue;
        const d = Math.hypot(u.x - x, u.z - z);
        if (d > R2) continue;
        u.byBig = true;
        G.after(1 + Math.round(d * 2.7), () => { if (u.state === 'live') G.hitUnit(u, 99, x, z, true, 3); });
      }
      const b = TG.F.boss;
      if (b && b.state === 'fight' && Math.hypot(b.x - x, b.z - z) < 15 * pow) G.after(15, () => G.hitBoss(Math.round(12 * (1 + lv * 0.25)), b.x, b.z, true));
    });
    return true;
  }

  // ── 소리 파동: 누르고 있는 동안만 나감(연사 간격 = WV.stat().cd). 끌어 겨눈 방향, 안 끌면 SEFO 가 보는(움직이는) 방향 ──
  // 멈춰 서 있으면(안 쏘는 동안) 둘레 링이 3단까지 커져 다음 파동 한 번·큰 소리가 세짐. 쏘면 링은 처음부터 다시 모음
  function aimAssist(p, dir, range) {
    let best = dir, ba = AIM_ASSIST, r2 = range * range;
    for (const u of TG.F.list) {
      if (u.state !== 'live' || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
      const dx = u.x - p.x, dz = u.z - p.z;
      if (dx * dx + dz * dz > r2) continue;
      const an = Math.atan2(dx, dz), a = Math.abs(TG.angDiff(dir, an));
      if (a < ba - 1e-9) { ba = a; best = an; }
    }
    const b = TG.F.boss;
    if (b && b.state === 'fight' && Math.hypot(b.x - p.x, b.z - p.z) - b.r * b.scale * 0.8 < range) {
      const an = Math.atan2(b.x - p.x, b.z - p.z), a = Math.abs(TG.angDiff(dir, an));
      if (a < ba - 1e-9) { ba = a; best = an; }
    }
    return best;
  }
  function updateFire(dt, input, inp) {
    const p = P();
    const mag = Math.hypot(input.x, input.z);
    if (mag > 0.15) G.faceDir = Math.atan2(input.x, input.z);
    const still = mag < 0.1 && !p.airborne && !p.resting && G.phase !== 'shelter';
    if (still) G.stillT = Math.min(1.6, G.stillT + dt); else G.stillT = Math.max(0, G.stillT - dt * 6);
    const slv = G.stillT < 0.45 ? 0 : G.stillT < 0.95 ? 1 : G.stillT < 1.5 ? 2 : 3;
    if (slv !== (p.stillLv || 0)) {
      if (slv > (p.stillLv || 0)) { TG.A.charge(slv); p.kick(1.2); chargeBurst(slv); }
      p.stillLv = slv;
    }
    p.charging = slv > 0; p.chargeLevel = slv;
    G.autoCd -= dt;
    const can = p.cheerT < 0 && !p.airborne && !p.resting && (G.phase === 'floor' || G.phase === 'boss');
    // 자동 모드(입력 깃발 8192): 「소리」를 안 누르고 있으면 사거리 안 가장 가까운 안개·기계·보스 쪽으로 연사 간격대로 저절로 나감.
    // 규칙 상태(위치·안개 목록)만 보고 정하므로 같은 시드·같은 입력이면 같은 결과. 저절로 나가는 것은 늘 기본 세기(모은 링은 안 씀 → 큰 소리·직접 누름에 그대로 남음)
    let autoT = null;
    if (inp.auto && !inp.fire && can) autoT = TG.WV.target(p.x, p.z, TG.WV.stat(0).range * AUTO.range);
    G.autoOn = !!autoT;
    G.fireOn = (!!inp.fire || !!autoT) && can;
    p.keepFace = G.phase === 'floor' || G.phase === 'boss'; // 놀이 중에는 서 있어도 보던 쪽을 그대로 봄(쏘는 방향이 곧 보는 방향)
    if (!G.fireOn) return;
    if (autoT) {
      const L0 = TG.WV.stat(0), dir = Math.atan2(autoT.x - p.x, autoT.z - p.z);
      G.fireDir = dir; p.tyaw = dir; p.faceLock = Math.max(p.faceLock, 0.12);
      if (G.autoCd <= 0) { TG.WV.fire(dir, 0, 1 + G.mod.more); G.autoCd = L0.cd * AUTO.cd; G.shots++; G.autoShots++; }
      return;
    }
    if (inp.aim != null) G.faceDir = inp.aim;
    const L = TG.WV.stat(slv);
    const dir = aimAssist(p, G.faceDir, L.range);
    G.fireDir = dir;
    p.tyaw = dir; p.faceLock = Math.max(p.faceLock, 0.12);
    if (G.autoCd <= 0) {
      TG.WV.fire(dir, slv, 1 + G.mod.more); G.autoCd = L.cd; G.stillT = 0;
      G.shots++; if (inp.aim != null) G.aimShots++;
    }
  }
  function chargeBurst(lv) {
    const p = P(), FX = TG.FX, col = [[2.4, 1.2, 0.8], [2.4, 0.6, 0.45], [2.6, 2.1, 0.7]][lv - 1];
    for (let i = 0; i < 6 + lv * 3; i++) {
      const a = (i / (6 + lv * 3)) * 6.283;
      FX.emit(FX.CELL.sparkle, p.x + Math.cos(a) * (1.2 + lv * 0.4), 0.3, p.z + Math.sin(a) * (1.2 + lv * 0.4), { vx: -Math.cos(a) * 2, vy: TG.fra(2, 4), vz: -Math.sin(a) * 2, life: 0.4, size: 0.4 + lv * 0.1, size1: 0, color: col });
    }
    FX.ring(p.x, p.z, { r0: 0.8, r1: 2.2 + lv * 0.6, dur: 0.3, color: [0xff8a5b, 0xe5352b, 0xffd966][lv - 1], width: 0.25 });
  }

  // ── 레벨업 → 리믹스 카드 3택1 (규칙 계산을 멈추고 고름) ──
  function openCard() {
    const opts = TG.C.offer(), p = P();
    G.pendingCards--;
    if (!opts.length) { p.hp = Math.min(p.maxHp, p.hp + 1); return; } // 카드가 다 차면 소리 크기 1칸
    G.cardOpen = { opts }; G.inCard = -1; G.cardAt = performance.now();
    TG.H.showCards(opts, (i) => { G.inCard = i; });
    TG.A.syn('levelUp'); TG.A.duck(0.4, 1.2);
    TG.FX.ring(p.x, p.z, { r0: 0.6, r1: 4.5, dur: 0.5, color: 0xffd23f, width: 0.25 });
    keys.KeyA = keys.KeyD = keys.KeyW = keys.KeyS = keys.ArrowLeft = keys.ArrowRight = keys.ArrowUp = keys.ArrowDown = keys.Space = false; mouse.down = false;
  }
  function chooseCard(i) {
    const c = G.cardOpen; if (!c) return;
    if (!(i >= 0 && i < c.opts.length)) i = 0;
    const id = c.opts[i], p = P();
    TG.C.apply(id);
    G.rec.cards.push(i); G.cardN++;
    G.cardOpen = null; G.inCard = -1;
    TG.H.hideCards();
    TG.A.syn('cardPick');
    TG.FX.text(TG.C.byId[id].name, p.x, 4.3, p.z, 'cheer');
    p.glow = 0.35; p.kick(4); p.noHurt = Math.max(p.noHurt, 0.8); if (p.joy) p.joy();
  }
  function botCard() { // 봇: 정해진 순서대로 고름 (난수 안 씀)
    const pri = ['more', 'size', 'poy', 'fast', 'rogun', 'woad', 'heart', 'charge', 'magnet', 'move'], o = G.cardOpen.opts;
    let best = 0, bp = 99;
    o.forEach((id, i) => { const q = pri.indexOf(id); if (q < bp) { bp = q; best = i; } });
    return best;
  }

  // ── 안개에 폭 덮임 → 다시 일어나기 없이 곧바로 결과 화면(모은 것은 그대로) ──
  function toCovered() {
    const p = P(), FX = TG.FX;
    if (G.phase === 'covered' || G.phase === 'result') return;
    G.prevPhase = G.phase; G.phase = 'covered'; G.covT = 0;
    G.fireOn = false; G.pendingCards = 0;
    p.setRest(true);
    TG.H.showBanner('안개에 폭 덮임', '다음에 다시!', 'boss', 1.2);
    TG.A.syn('covered'); TG.A.duck(0.3, 1.6);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * 6.283; FX.emit(FX.CELL.bubble, p.x + Math.cos(a) * 2.8, 0.5 + TG.fra(0, 0.8), p.z + Math.sin(a) * 2.8, { vx: -Math.cos(a) * 3.4, vz: -Math.sin(a) * 3.4, life: 0.6, size: 0.9, size1: 1.15, color: [0.6, 0.48, 0.95], alpha: 0.85, drag: 3.2, rot: 0 }); } // 연보라, 발치로 모여듦(몸을 덮지 않음)
  }
  function updateCovered(dt) {
    const p = P();
    G.covT += dt;
    for (const u of TG.F.list) { if (u.kind !== 'tick' && u.kind !== 'cocoon' && u.state === 'live') { const dx = u.x - p.x, dz = u.z - p.z, d = Math.hypot(dx, dz) || 1; if (d < 9) { u.vx = (dx / d) * 4; u.vz = (dz / d) * 4; } } } // 다른 안개는 둥실 물러남
    if (G.covT >= END_HOLD) finish(false);
  }

  // ── 입력 ──
  const keys = {};
  const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const fire = { id: null, ox: 0, oy: 0, aim: false, dir: 0, kx: 0, ky: 0 };   // 터치 「소리」 버튼: 누름 + 끌어 겨누기
  const mouse = { down: false, x: 0, y: 0, seen: false };                        // PC: 마우스 방향 + 왼쪽 버튼
  function pressBig() { if (isPlay() && !G.paused && !G.cardOpen) G.inBig = true; }
  // 마우스가 가리키는 바닥 자리 → SEFO 기준 방향 (입력 쪽 계산. 규칙에는 256칸으로 자른 값만 들어감)
  const mv = new T.Vector3();
  function mouseDir() {
    const c = TG.R.camera, p = P();
    mv.set((mouse.x / TG.R.w) * 2 - 1, -(mouse.y / TG.R.h) * 2 + 1, 0.5).unproject(c).sub(c.position);
    if (mv.y > -1e-4) return G.faceDir;
    const k = (0.9 - c.position.y) / mv.y;
    const dx = c.position.x + mv.x * k - p.rx, dz = c.position.z + mv.z * k - p.rz;
    return dx * dx + dz * dz < 0.04 ? G.faceDir : Math.atan2(dx, dz);
  }
  // 지금 사람이 「소리」를 누르고 있는지 + 겨눈 방향(null = 안 겨눔 → 보는 방향)
  function readFire() {
    if (fire.id != null) return { on: true, a: fire.aim ? fire.dir : null };
    if (mouse.down || keys.Space) return { on: true, a: mouse.seen ? mouseDir() : null };
    return { on: false, a: null };
  }
  const aimCode = (a) => (a == null ? 0 : ((Math.round((a / (Math.PI * 2)) * AIM_N) % AIM_N) + AIM_N) % AIM_N + 1);
  const aimOf = (c) => (c ? ((c - 1) / AIM_N) * Math.PI * 2 : null);
  function bindInput() {
    const unlock = () => TG.A.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      const num = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (num != null && !G.paused) { if (G.cardOpen) G.inCard = num; else if (G.phase === 'shelter') G.inPick = num; }
      if (e.code === 'Space') e.preventDefault(); // Space = 누르고 있는 동안 소리(keys.Space)
      if ((e.code === 'KeyE' || e.code === 'KeyQ' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) pressBig();
      if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
      if (e.code === 'Enter' && G.phase === 'title') { startIntro(); }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; fire.id = null; if (isPlay() && !G.bot) setPause(true); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && isPlay() && !G.bot) setPause(true); });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    const btnBig = document.getElementById('btnBig');
    const btnSnd = document.getElementById('btnSnd');
    window.addEventListener('pointerdown', (e) => {
      const tgt = e.target;
      if (tgt.closest && tgt.closest('button, input, .panel')) return;
      if (!isPlay() || G.paused || G.cardOpen) return;
      if (tgt.closest && tgt.closest('#btnBig')) { pressBig(); btnBig.classList.add('press'); setTimeout(() => btnBig.classList.remove('press'), 140); return; }
      if (e.pointerType === 'mouse') { // PC: 왼쪽 = 누르는 동안 소리, 오른쪽 = 큰 소리
        mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
        if (e.button === 0) mouse.down = true; else if (e.button === 2) pressBig();
        return;
      }
      // 터치: 「소리」 버튼 — 누르고 있는 동안 나감, 누른 채 끌면 그쪽으로 겨눔 (이동 스틱과 따로 → 동시에 됨)
      // (버튼 자리로 판정 — 보스 등장 연출로 HUD 가 잠깐 숨은 동안 눌러도 그대로 이어짐)
      const inBtn = (el, pad) => { const r = el.getBoundingClientRect(); return r.width > 0 && Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) <= r.width / 2 + pad; };
      if (inBtn(btnBig, 6 * TG.H.s)) return;
      if ((tgt.closest && tgt.closest('#btnSnd')) || inBtn(btnSnd, 20 * TG.H.s)) {
        if (fire.id == null) { fire.id = e.pointerId; fire.ox = e.clientX; fire.oy = e.clientY; fire.aim = false; fire.kx = fire.ky = 0; }
        return;
      }
      // 터치: 떠다니는 이동 스틱 (왼쪽 절반, 왼손잡이면 오른쪽 절반)
      const left = e.clientX < innerWidth / 2;
      if ((left !== !!G.settings.lefty) && stick.id == null) {
        stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = 0; stick.y = 0;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true; return; }
      if (fire.id === e.pointerId) {
        const R = 44 * TG.H.s, dead = 13 * TG.H.s;
        let dx = e.clientX - fire.ox, dy = e.clientY - fire.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { fire.ox += (dx / d) * (d - R); fire.oy += (dy / d) * (d - R); dx = e.clientX - fire.ox; dy = e.clientY - fire.oy; }
        if (d > dead) { fire.aim = true; fire.dir = Math.atan2(dx, dy); } // 한 번 끌면 뗄 때까지 그 방향을 기억
        fire.kx = dx / R; fire.ky = dy / R;
        return;
      }
      if (stick.id === e.pointerId) {
        const R = 56 * TG.H.s;
        let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { // 떠다니는 스틱: 너무 멀리 가면 바탕이 따라옴
          stick.ox += (dx / d) * (d - R); stick.oy += (dy / d) * (d - R);
          dx = e.clientX - stick.ox; dy = e.clientY - stick.oy;
        }
        stick.x = dx / R; stick.y = dy / R;
      }
    });
    const up = (e) => {
      if (e.pointerType === 'mouse') { if (e.button === 0 || e.type === 'pointercancel') mouse.down = false; return; }
      if (fire.id === e.pointerId) { fire.id = null; fire.aim = false; fire.kx = fire.ky = 0; }
      if (stick.id === e.pointerId) { stick.id = null; stick.x = stick.y = 0; }
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    // 버튼들
    const click = (id, fn) => document.getElementById(id).addEventListener('click', (e) => { TG.A.unlock(); TG.A.ui(1); fn(e); });
    click('startBtn', () => { GZView.request('start'); startIntro(); });   // 첫 터치 때 전체화면 + 가로 고정 시도 (js/gzview.js)
    // 화질 자동/높게 (멈춤 창) — 기본 자동. 저장 tg_slice_quality
    document.querySelectorAll('[data-gq]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); TG.A.unlock(); TG.A.ui(1); GZView.setQuality(b.dataset.gq); }));
    GZView.onQuality((m) => document.querySelectorAll('[data-gq]').forEach((b) => { const on = b.dataset.gq === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }));
    // ⛶ 전체화면 버튼(멈춤 버튼 아래) + 저절로 풀린 뒤엔 게임 화면에서만 다시 시도
    GZView.initFs({ anchor: '#pauseBtn', appName: '에코 제로', isPlay: () => isPlay() && !G.paused,
      onHelp: () => { if ((isPlay() || G.phase === 'intro' || G.phase === 'covered') && !G.paused) setPause(true); },   // 11-14: 「홈 화면에 추가」 안내를 읽는 동안 판이 흐르지 않게
      onState: (on) => { const b = document.getElementById('optFs'); if (!b) return; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? '⛶ 전체화면 끄기' : '⛶ 전체화면'; } });   // 11-14: 멈춤 창 오른쪽 위 「⛶ 전체화면」 단추
    GZView.initHud(() => ({ pr: TG.R.pr, fps: TG.R.fps, w: TG.R.renderer.domElement.width, h: TG.R.renderer.domElement.height, extra: 'MSAA ' + TG.R.composer.renderTarget1.samples }));
    click('pauseBtn', () => togglePause());
    click('resumeBtn', () => setPause(false));
    click('homeBtn', () => { setPause(false); toTitle(); });
    click('againBtn', () => { TG.H.show(TG.H.result, false); startIntro(); });
    click('optShake', () => { G.settings.shake = G.settings.shake === false; applySettings(); saveSet(); });
    click('optFs', (e) => { e.preventDefault(); e.stopPropagation(); GZView.toggle('menu'); });   // 11-14: 멈춤 창에서 전체화면 켜기/끄기(안 되는 브라우저는 「홈 화면에 추가」 안내)
    click('optVibe', () => { if (HZ) { HZ.toggle(); if (HZ.on) HZ.play('toggle', [30], 9); } applySettings(); });
    document.querySelectorAll('[data-atk]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); TG.A.unlock(); TG.A.ui(1); setAtk(b.dataset.atk); }));
    document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); TG.A.unlock(); TG.A.ui(1); G.settings.cam = b.dataset.cam; applySettings(); saveSet(); }));
    click('optLefty', () => { G.settings.lefty = !G.settings.lefty; applySettings(); saveSet(); });
    document.getElementById('optBgm').addEventListener('input', (e) => { G.settings.bgm = e.target.value / 100; applySettings(); saveSet(); });
    document.getElementById('optSfx').addEventListener('input', (e) => { G.settings.sfx = e.target.value / 100; applySettings(); saveSet(); });
  }
  // 소리 방울 자동/수동: 저장하고 다음 걸음부터 적용(입력 깃발로 기록 → 재생도 같음)
  function setAtk(m) {
    G.settings.atk = m === 'auto' ? 'auto' : 'manual';
    applySettings(); saveSet();
  }
  function togglePause() { if (isPlay() || G.phase === 'intro' || G.phase === 'covered') setPause(!G.paused); }
  function setPause(on) {
    G.paused = on; TG.H.show(TG.H.pause, on);
    TG.A.pause(on);
    if (on) { stick.id = null; stick.x = stick.y = 0; fire.id = null; fire.aim = false; fire.kx = fire.ky = 0; mouse.down = false; keys.Space = false; }
  }

  function readMove() {
    let x = 0, z = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) z -= 1; if (keys.KeyS || keys.ArrowDown) z += 1;
    if (x || z) { const l = Math.hypot(x, z); return { x: x / l, z: z / l }; }
    if (stick.id != null) { const l = Math.hypot(stick.x, stick.y); const k = l > 1 ? 1 / l : 1; return { x: stick.x * k, z: stick.y * k }; }
    return { x: 0, z: 0 };
  }

  // 보스 행동 예고를 보고 비킬 방향 (봇·시험용 가상 플레이어가 씀). only = 다른 것보다 먼저 따라야 함(고리 틈으로 빠져나가기)
  function bossAvoid(p) {
    const b = TG.F.boss, o = { x: 0, z: 0, only: false };
    if (!b || b.state !== 'fight') return o;
    const hr = b.r * b.scale + 0.6, pt = b.pat;
    for (const q of b.drops) { // 안개 비: 예고 원 밖으로
      const dx = p.x - q.x, dz = p.z - q.z, d = Math.hypot(dx, dz);
      if (d < 3.3) { const k = (3.3 - d) * 3.5 / Math.max(d, 0.2); o.x += (d < 0.05 ? 1 : dx) * k; o.z += dz * k; }
    }
    if (!pt) return o;
    if (pt.type === 'roll') { // 굴러오기: 길(꺾인 길 포함)에서 옆으로
      for (const s of pt.segs) {
        const sn = Math.sin(s.dir), cs = Math.cos(s.dir), rx = p.x - s.x, rz = p.z - s.z;
        const along = rx * sn + rz * cs, side = rx * cs - rz * sn;
        if (along < -hr - 1 || along > s.len + hr + 1 || Math.abs(side) > hr + 1.6) continue;
        const k = (side >= 0 ? 1 : -1) * 5;
        o.x += cs * k; o.z += -sn * k;
      }
    } else if (pt.type === 'slam' && !pt.done) { // 쿵 내려앉기: 예고 원 밖으로
      const dx = p.x - pt.tx, dz = p.z - pt.tz, d = Math.hypot(dx, dz), need = hr + 1.6;
      if (d < need) { const k = 6 / Math.max(d, 0.2); o.x += (d < 0.05 ? 1 : dx) * k; o.z += dz * k; }
    } else if (pt.type === 'squeeze') { // 고리 조이기: 가장 가까운 틈 쪽으로 돌아가서, 고리가 올 때 그 틈으로 나감
      const px = p.x - pt.cx, pz = p.z - pt.cz, pd = Math.hypot(px, pz) || 0.01;
      const ringR = pt.t < pt.pre ? pt.R0 : pt.r;
      if (pd < ringR + 1.2) {
        const pa = Math.atan2(px, pz);
        let ga = 0, best = 9;
        for (const g of pt.gaps) { const a = TG.angDiff(pa, g); if (Math.abs(a) < Math.abs(best)) { best = a; ga = g; } }
        const tx = Math.cos(pa), tz = -Math.sin(pa), rx = px / pd, rz = pz / pd; // 접선(각도가 커지는 쪽)·바깥 방향
        const turn = TG.clamp(best * pd / 1.2, -1, 1), out = Math.abs(best) < pt.hw * 0.55 ? 1 : pd < pt.R1 + 2.5 ? 0.5 : 0;
        const vx = tx * turn + rx * out, vz = tz * turn + rz * out, l = Math.hypot(vx, vz) || 1;
        o.x = (vx / l) * (1 + 0) + o.x * 0.15; o.z = (vz / l) + o.z * 0.15; o.only = true;
        const n = Math.hypot(o.x, o.z) || 1; if (n > 1) { o.x /= n; o.z /= n; }
      }
    }
    return o;
  }

  // ── 봇 (시험용 자동 놀이). 규칙 상태만 보고 정하므로 기록·재생과 같은 결과 ──
  function botInput(dt) {
    const p = P(), F = TG.F;
    let mx = 0, mz = 0, nearFog = 1e9;
    for (const u of F.list) {
      if (u.state !== 'live' || u.kind === 'cocoon') continue;
      const dx = p.x - u.x, dz = p.z - u.z, d2 = dx * dx + dz * dz;
      if (d2 < nearFog) nearFog = d2;
      if (d2 < 20) { const w = 1 / Math.max(d2, 0.5); mx += dx * w * 3.2; mz += dz * w * 3.2; }
    }
    { let nu = null, nd2 = 1e9; for (const u of F.list) { if (u.state !== 'live' || u.kind === 'cocoon') continue; const q = (u.x - p.x) ** 2 + (u.z - p.z) ** 2; if (q < nd2) { nd2 = q; nu = u; } }
      if (nu && nd2 > 42 && !(F.boss && F.boss.state === 'fight')) { const d = Math.sqrt(nd2); mx += ((nu.x - p.x) / d) * 1.2; mz += ((nu.z - p.z) / d) * 1.2; } }
    const b = F.boss;
    if (b && (b.state === 'fight' || b.state === 'land')) {
      const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1;
      if (d < 7.5) { mx += (dx / d) * 2.2; mz += (dz / d) * 2.2; } else { mx += (-dz / d) * 0.6; mz += (dx / d) * 0.6; }
      const av = bossAvoid(p);
      if (av.only) return { x: av.x, z: av.z };
      mx += av.x; mz += av.z;
    }
    G.botW += dt * 0.35;
    const wx = Math.cos(G.botW) * 8, wz = Math.sin(G.botW) * 5 + 2;
    mx += (wx - p.x) * 0.08; mz += (wz - p.z) * 0.08;
    let near = null, nd = 36;
    for (const n of F.notes) { const d = (n.x - p.x) ** 2 + (n.z - p.z) ** 2; if (d < nd) { nd = d; near = n; } }
    if (near) { mx += (near.x - p.x) * 0.12; mz += (near.z - p.z) * 0.12; }
    // 고치: 안개가 멀면 곁으로 가서 서 있음
    let hold = false, coc = false;
    for (const u of F.list) {
      if (u.kind !== 'cocoon' || u.state !== 'live') continue;
      coc = true;
      const dx = u.x - p.x, dz = u.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (d < 2.2 && nearFog > 16) hold = true; else if (nearFog > 25 && G.botCocT < 480) { G.botCocT++; mx += (dx / d) * 2.4; mz += (dz / d) * 2.4; } // 8초 넘게 못 닿으면 그만둠
    }
    if (!coc) G.botCocT = 0;
    if (F.zone.on) { const d = Math.hypot(p.x, p.z); if (d > F.zone.R - 3) { mx -= (p.x / d) * 3; mz -= (p.z / d) * 3; } }
    const AR = TG.AR;
    if (p.x > AR.bx - 2) mx -= 1.5; if (p.x < -AR.bx + 2) mx += 1.5; if (p.z > AR.bz - 2) mz -= 1.5; if (p.z < -AR.bz + 2) mz += 1.5;
    const l = Math.hypot(mx, mz);
    // 큰 소리
    if (G.gauge >= 100) {
      let cnt = 0; for (const u of F.list) if (u.state === 'live' && u.kind !== 'cocoon' && (u.x - p.x) ** 2 + (u.z - p.z) ** 2 < 100) cnt++;
      if (cnt >= 6 || (b && b.state === 'fight')) G.inBig = true;
    }
    // 쉼터: 2초 뒤 고름 (칸이 줄었으면 회복, 아니면 보호 방울)
    if (G.phase === 'shelter' && G.shelterPick < 0 && G.shelterT > 2) G.inPick = p.hp < p.maxHp ? 0 : 1;
    if (hold) return { x: 0, z: 0 };
    if (l <= 0.2) { G.botStuck = 0; return { x: 0, z: 0 }; }
    let ox = mx / Math.max(1, l), oz = mz / Math.max(1, l);
    // 상자·난간에 걸려 제자리면 잠깐 옆으로 돌아감
    if (Math.hypot(p.x - G.botLx, p.z - G.botLz) < 0.02) G.botStuck++; else G.botStuck = 0;
    G.botLx = p.x; G.botLz = p.z;
    if (G.botStuck > 24) { G.botStuck = 0; G.botSideT = 50; G.botSideS = -G.botSideS; }
    if (G.botSideT > 0) { G.botSideT--; const s = G.botSideS, tx = -oz * s, tz = ox * s; ox = tx * 0.9 + ox * 0.3; oz = tz * 0.9 + oz * 0.3; }
    return { x: ox, z: oz };
  }

  // ── 카메라 ──
  const cam = { x: 0, z: 3, dist: 8, pitch: 0.6, yaw: 0, look: new T.Vector3(), lx: 0, lz: 0, vlx: 0, vlz: 0, gx: 0, gz: 0, hold: 0, cx: 0, cz: 0, cT: 0 };
  // 가는 쪽으로 앞서 보기(11-13 대표, 폰 시험 뒤 「확실히 느껴지게」로 강화): 그리기 쪽만(규칙 계산과 무관)
  //  · 목표 = 움직이는 방향 × 빠르기 비율 × 앞섬(가로 X·세로 Z, 설정 「카메라 따라가기」 끔 0 / 보통 / 강하게) × 장면 배율(보스전 BOSS)
  //  · 감쇠 스프링(임계 감쇠): 움직이기 시작하면 IN(ω) → 0.3~0.5초 안에 대부분 도달, 멈추면 HOLD 초 그대로 있다가 OUT(ω)로 부드럽게 가운데
  //  · 방향 고정: 새 방향이 TURN 초(반대쪽으로 확 꺾으면 TURN_BACK 초) 이어져야 목표를 바꿈 → 짧게 피하기·큰 소리 점프 중에는 화면이 안 돎
  const LEAD = { X: 4.8, Z: 2.8, MID: 0.6, IN: 7.0, TURN_W: 3.4, OUT: 3.2, HOLD: 0.8, TURN: 0.1, TURN_BACK: 0.25, START: 0.06, BOSS: 0.35, BOSS_MID: 0.3, MIN: 0.6 };
  const CAM_MODE = { off: 0, mid: LEAD.MID, strong: 1 };
  function leadStep(o, dt, vx, vz, maxs, k, lock) {
    if (dt <= 0) return o;
    const sp = Math.hypot(vx, vz), moving = sp > LEAD.MIN && k > 0;
    if (moving && !lock) {
      const ux = vx / sp, uz = vz / sp, m = Math.min(1, sp / Math.max(0.1, maxs)) * k;
      const gl = Math.hypot(o.gx, o.gz), cosT = gl > 1e-6 ? (ux * o.gx / LEAD.X + uz * o.gz / LEAD.Z) / Math.hypot(o.gx / LEAD.X, o.gz / LEAD.Z) : -2;
      if (cosT > 0.82) { // 거의 같은 쪽: 바로 따라감. 빨라지면 바로 늘리고, 느려지면(멈추는 중) HOLD 초 동안은 그대로 둠
        if (m >= (o.m || 0) - 0.05) { o.m = m; o.mT = 0; } else { o.mT = (o.mT || 0) + dt; if (o.mT >= LEAD.HOLD) o.m = m; }
        o.gx = ux * o.m * LEAD.X; o.gz = uz * o.m * LEAD.Z; o.cT = 0;
      }
      else {
        if (o.cT > 0 && ux * o.cx + uz * o.cz > 0.82) o.cT += dt; else { o.cx = ux; o.cz = uz; o.cT = dt; }
        const need = cosT === -2 ? LEAD.START : cosT < -0.17 ? LEAD.TURN_BACK : LEAD.TURN;
        if (o.cT >= need) { o.m = m; o.mT = 0; o.gx = ux * m * LEAD.X; o.gz = uz * m * LEAD.Z; o.cT = 0; o.turn = cosT !== -2 && cosT < 0.5; } // 크게 꺾은 경우 넘어가는 동안 스프링을 느리게
      }
      o.hold = 0;
    } else if (!lock) {
      o.hold += dt; o.cT = 0;
      if (o.hold >= LEAD.HOLD || k <= 0) { o.gx = 0; o.gz = 0; o.m = 0; }
    }
    const back = Math.hypot(o.gx, o.gz) < 1e-6;
    if (o.turn && Math.hypot(o.gx - o.lx, o.gz - o.lz) < 0.4) o.turn = false;
    const w = back ? LEAD.OUT : o.turn ? LEAD.TURN_W : LEAD.IN;
    for (let t = dt; t > 1e-9; t -= 1 / 120) { // 임계 감쇠 스프링(작은 걸음으로 나눠 안정)
      const h = Math.min(t, 1 / 120);
      o.vlx += (w * w * (o.gx - o.lx) - 2 * w * o.vlx) * h; o.vlz += (w * w * (o.gz - o.lz) - 2 * w * o.vlz) * h;
      o.lx += o.vlx * h; o.lz += o.vlz * h;
    }
    return o;
  }
  function updateCamera(dt) {
    const p = P(), R = TG.R, c = R.camera;
    const aspect = R.w / R.h;
    let dist, pitch, yaw = 0, tx, tz, ty = 0.6, bossCam = false;
    if (G.phase === 'title') {
      const t = G.drawT;
      dist = 9.6; pitch = 0.36; yaw = -0.18 + Math.sin(t * 0.25) * 0.12;
      tx = p.rx - 3.0; tz = p.rz - 0.6; ty = 2.0;
    } else {
      const base = aspect > 2 ? 20.8 : 22.5; // 대표 의견(11-12): 더 넓게 — 예전 15.4/17 의 1.35배
      dist = base * G.camZoom; ty = 1.0; // SEFO 가 화면 높이의 1/5 이상
      pitch = 0.82; // 약 47° — 층·쉼터·보스 모두 같은 각도
      // 앞서 보기: 층·쉼터 1, 보스전 0.35(보스를 안 놓치게), 보스 등장·결과·폭 덮임 0(천천히 가운데로)
      const cm = CAM_MODE[G.settings.cam] != null ? CAM_MODE[G.settings.cam] : 1;
      const lk = cm * (G.phase === 'boss' ? LEAD.BOSS : (G.phase === 'floor' || G.phase === 'shelter') ? 1 : 0);
      leadStep(cam, G.paused || G.cardOpen || G.freeze > 0 ? 0 : dt, p.vx, p.vz, p.MAXSPD * (p.spdMul || 1), lk, p.airborne); // 멈춤·카드·히트 스톱 동안은 그대로, 점프 중엔 방향 고정
      const ff = lk > 0 && G.phase !== 'boss' ? 1 / 6 : 0; // 카메라가 뒤따라오며 생기는 늦음(빠르기 ÷ 따라가기 6)을 미리 더해 앞섬이 그대로 보이게
      tx = p.rx + cam.lx + p.vx * ff;
      tz = p.rz + cam.lz + p.vz * ff - dist * 0.045; // SEFO 는 화면 중앙보다 조금 아래 (11-13: 0.08→0.045 — 위 벽·빈 곳을 줄이고 발밑·앞 바닥을 더 보이게, 거리에 비례 → 장면마다 같은 자리)
      tx = TG.clamp(tx, -13.5, 13.5); tz = TG.clamp(tz, -9.5, 9.5); // 가장자리에서도 SEFO 가 버튼·조이스틱 밑으로 안 가게
      if (G.phase === 'result') { dist = 11.5; pitch = 0.5; tx = p.rx + 3.4; tz = p.rz; ty = 1.6; }
      if (G.phase === 'covered') { dist = 14; tx = p.rx; tz = p.rz; }
      const b = TG.F.boss;
      if (G.phase === 'boss' && b && TG.F.bossObj.group.visible) {
        // 보스전: SEFO 와 보스가 둘 다 잡히게 — 떨어진 만큼 뒤로 빼고(상한 1.55배, SEFO 60px 이상) 둘 사이를 봄. SEFO 가 늘 먼저(화면 안), 움직임은 천천히 따라감
        const dx = b.x - p.rx, dz = b.z - p.rz, far = base * 1.5;
        const needZ = dz < 0 ? (-dz + 3.9) / 0.469 : (dz + 1.4) / 0.427, needX = (Math.abs(dx) + 6) / (0.633 * aspect);
        dist = TG.clamp(Math.max(dist, needZ, needX), base, far);
        const X = 0.317 * aspect * dist; // 화면 반너비(월드)
        if (lk > 0) { tx += (b.x - p.rx) * LEAD.BOSS_MID * cm; } // 보스-SEFO 가운데 쪽으로 기울임(카메라 따라가기 끔이면 안 함)
        tx = TG.clamp(tx, b.x - (X - 3.6), b.x + (X - 3.6)); tx = TG.clamp(tx, p.rx - (X - 2.6), p.rx + (X - 2.6));
        tz = p.rz - dist * 0.08 + cam.lz + (lk > 0 ? (b.z - p.rz) * LEAD.BOSS_MID * cm : 0);
        tz = Math.min(tz, b.z + 0.2 * dist - 3.9); tz = Math.max(tz, b.z - 0.237 * dist - 1.4); // 보스가 위 HUD·아래 가장자리에 안 걸리게
        tz = TG.clamp(tz, p.rz - 0.269 * dist, p.rz + 0.19 * dist - 2.8);                       // SEFO 는 늘 화면 안(위 HUD 아래 ~ 아래 버튼 위)
        bossCam = true;
      } else if (G.phase === 'bossIntro' && b && TG.F.bossObj.group.visible) { const kb = G.camFocusK; tx = TG.clamp(TG.lerp(p.rx, b.x, kb), -11.5, 11.5); tz = TG.clamp(TG.lerp(p.rz, b.z, kb) - 1, -9, 6.8); }
      else if (G.phase === 'bossIntro') { tx = TG.lerp(p.rx, 0, 0.5); tz = TG.lerp(p.rz, 1, 0.5) - 1; }
    }
    if (api.camOv) { const o = api.camOv; dist = o.dist; pitch = o.pitch; yaw = o.yaw; tx = p.rx; tz = p.rz; ty = o.ty; cam.dist = dist; cam.pitch = pitch; cam.yaw = yaw; cam.x = tx; cam.z = tz; cam.ty = ty; } // 시험: 가까이 보기
    const k = G.phase === 'title' ? 3 : G.phase === 'intro' ? 2.2 : bossCam ? 3.2 : 6;
    cam.x = TG.damp(cam.x, tx, k, dt); cam.z = TG.damp(cam.z, tz, k, dt);
    cam.dist = TG.damp(cam.dist, dist, G.phase === 'intro' ? 2 : bossCam ? 2.2 : 3, dt); cam.pitch = TG.damp(cam.pitch, pitch, 2.5, dt); cam.yaw = TG.damp(cam.yaw, yaw, 2.5, dt);
    cam.ty = TG.damp(cam.ty || ty, ty, 3, dt);
    const sh = TG.FX.camUpdate(dt);
    const d = cam.dist * (1 - sh.zoom);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    c.position.set(cam.x + Math.sin(cam.yaw) * cp * d, cam.ty + sp * d, cam.z + Math.cos(cam.yaw) * cp * d);
    cam.look.set(cam.x, cam.ty, cam.z);
    c.lookAt(cam.look);
    c.translateX(sh.x); c.translateY(sh.y);
    c.rotateZ(sh.roll);
    R.followShadow(cam.x, cam.z - 2);
  }

  // ── 매 프레임: 밀린 시간만큼 규칙 계산을 1/60초 걸음으로 돌리고, 그리기는 한 번 ──
  function frame(now) {
    requestAnimationFrame(frame);
    const rdt = TG.clamp((now - last) / 1000 || 0.016, 0, 0.1);
    last = now;
    TG.R.trackFrame(rdt);
    TG.R.renderer.info.reset();
    if (!G.paused && !TG.H.portrait) {
      const k = api.simK || 1;
      acc += rdt * k;
      let n = 0; const maxN = 5 * k;
      while (acc >= DT && n < maxN) { acc -= DT; n++; simTick(); }
      if (acc >= DT) acc = 0; // 너무 밀리면 버림 (느린 기기에서 멈춤 방지)
    }
    const al = G.paused || G.cardOpen || G.freeze > 0 ? 1 : TG.clamp(acc / DT, 0, 1);
    draw(rdt, al);
  }

  // 규칙 계산 한 걸음. 카드 고르는 중·히트 스톱 중에는 시간이 흐르지 않음
  function simTick() {
    if (G.cardOpen) {
      let c = -1;
      if (G.replay) c = G.replay.cards[G.cardN] != null ? G.replay.cards[G.cardN] : 0;
      else if (G.inCard >= 0) c = G.inCard;
      else if (G.bot && (G.fast || performance.now() - G.cardAt > 900)) c = botCard();
      else if (G.fast) c = 0;
      if (c < 0) return;
      chooseCard(c);
      return;
    }
    if (G.freeze > 0) { G.freeze--; return; }
    step(nextInput());
    G.tick++;
    if (G.tick % 30 === 0) {
      const p = P();
      const q = (Math.round(p.x * 1000) * 73856093) ^ (Math.round(p.z * 1000) * 19349663) ^ (G.notes * 83492791) ^ (G.popped << 8) ^ TG.F.list.length ^ (Math.round(G.gauge * 10) << 16) ^ (p.hp << 24);
      G.hash = (Math.imul(G.hash, 31) + q) | 0;
    }
  }

  // 이번 걸음의 입력: 재생 중이면 기록에서, 아니면 봇·사람 입력을 1/100 단위로 잘라 기록
  function nextInput() {
    let ix = 0, iz = 0, fl = 0;
    const rp = G.replay;
    if (rp && G.rec) {
      const t = rp.ticks;
      if (G.rpI < t.length) {
        ix = t[G.rpI]; iz = t[G.rpI + 1]; fl = t[G.rpI + 2];
        if (++G.rpN >= t[G.rpI + 3]) { G.rpI += 4; G.rpN = 0; }
      } else G.replayDone = true;
    } else {
      let m = { x: 0, z: 0 }, f = { on: false, a: null };
      if (isPlay() && !P().resting) {
        m = G.bot ? botInput(DT) : readMove();
        f = readFire();
        if (G.bot) { const h = readMove(); if (h.x || h.z) m = h; }
        // 시험용: 봇(?auto=1)과 __tg.autoFire(true) 는 「소리」를 누르고 가장 가까운 대상을 겨누는 입력을 대신 넣음(사람 조작에는 절대 안 켜짐). 기록에는 보통 입력으로 남음
        if ((G.bot || G.testAuto) && !f.on && !isAuto()) { const p = P(), t = TG.WV.target(p.x, p.z, TG.WV.stat(p.stillLv || 0).range - 0.3); if (t) f = { on: true, a: Math.atan2(t.x - p.x, t.z - p.z) }; }
        if (G.testIn) { const q = G.testIn; m = { x: q.x || 0, z: q.z || 0 }; f = { on: !!q.fire, a: q.aim == null ? null : q.aim }; if (q.big) G.inBig = true; } // 시험용: __tg.input()
      }
      ix = Math.round(TG.clamp(m.x, -1, 1) * 100); iz = Math.round(TG.clamp(m.z, -1, 1) * 100);
      // 입력 깃발: 1 = 큰 소리, 2~4 = 쉼터 고르기, 8 = 「소리」 누름, 16~4112 = 겨눈 방향(0 = 안 겨눔, 1~256), 8192 = 자동 모드
      // 8192 = 자동 모드(소리 방울이 가까운 안개에 저절로). 멈춤 창에서 바꾸면 그 걸음부터 기록에 남음 → 재생도 같음
      fl = (G.inBig ? 1 : 0) | ((G.inPick + 1) << 1) | (f.on ? 8 : 0) | ((f.on ? aimCode(f.a) : 0) << 4) | (isAuto() ? 8192 : 0);
    }
    G.inBig = false; G.inPick = -1;
    if (G.rec && G.phase !== 'title' && G.phase !== 'intro' && G.phase !== 'result') {
      const t = G.rec.ticks, n = t.length;
      if (n && t[n - 4] === ix && t[n - 3] === iz && t[n - 2] === fl) t[n - 1]++; else t.push(ix, iz, fl, 1);
    }
    return { x: ix / 100, z: iz / 100, big: !!(fl & 1), pick: ((fl >> 1) & 3) - 1, fire: !!(fl & 8), aim: aimOf((fl >> 4) & 511), auto: !!(fl & 8192) };
  }

  function step(inp) {
    const dt = DT, p = P();
    G.realT += dt;
    runAfters();
    if (G.phase === 'intro') updateIntro(dt);
    const play = isPlay();
    const input = play && !p.resting ? inp : { x: 0, z: 0 };
    if (play) {
      G.time += dt;
      if (G.phase === 'floor') updateSpawns(dt);
      else if (G.phase === 'shelter') updateShelter(dt, inp);
      else if (G.phase === 'bossIntro') updateBossIntro(dt);
      if (G.bench) benchTick(dt);
      updateFire(dt, input, inp);
      if (G.phase === 'floor' || G.phase === 'boss') { G.playTicks++; if (inp.auto) G.autoTicks++; }
      if (inp.big && !bigSound() && G.realT - (G.denyT || -9) > 0.4) { // 못 쓸 때도 반응: 버튼 흔들림 + 짧은 소리 + 한마디
        G.denyT = G.realT; TG.H.bigDeny(G.gauge < 100 ? '아직!' : '잠깐!'); TG.A.ui(0.55);
      }
      TG.C.sim(dt, p, G);
      updateHints(dt, input);
    } else { p.charging = false; p.stillLv = 0; G.fireOn = false; p.keepFace = false; }
    if (G.phase === 'covered') updateCovered(dt);

    p.sim(dt, input, play || G.phase === 'intro');
    { // 층 난이도: 새로 나온 안개의 이동 속도에 그 층 배율을 한 번 곱함 (보스전에 나오는 것은 그대로)
      const fk = G.phase === 'floor' ? FLOORS[G.floor].spd : 1, L = TG.F.list;
      for (let i = 0; i < L.length; i++) { const u = L[i]; if (!u.gk) { u.gk = 1; u.spd *= fk; u.gx = u.x; u.gz = u.z; u.gs = 1; } }
      // 상자·난간에 끼어 2초 넘게 제자리인 안개는 옆으로 통 밀어 줌 (층이 안 끝나는 일 방지)
      if (G.tick % 120 === 0 && play) for (let i = 0; i < L.length; i++) {
        const u = L[i]; if (u.state !== 'live' || u.kind === 'cocoon' || u.kind === 'tick' || u.spawnT < 2) continue;
        const dx = p.x - u.x, dz = p.z - u.z, d = Math.hypot(dx, dz) || 1;
        if (d > 5 && Math.hypot(u.x - u.gx, u.z - u.gz) < 0.3) { u.gs = -u.gs; u.vx += (dz / d) * 7 * u.gs; u.vz += (-dx / d) * 7 * u.gs; }
        u.gx = u.x; u.gz = u.z;
      }
    }
    TG.F.update(dt, G.realT, p, G);
    TG.WV.update(dt, G);
    G.comboT -= dt; if (G.comboT <= 0) G.combo = 0;
    G.gaugeLock = Math.max(0, G.gaugeLock - dt); G.hsCd = Math.max(0, G.hsCd - dt);

    if (G.phase === 'bossEnd') {
      G.endT += dt;
      if (G.endT > 0.6 && !G.cheered) { G.cheered = true; p.bigJump(null); p.noHurt = 9; TG.H.say('노래가 돌아왔어요!', 2.2); }
      if (G.endT > 3.9) finish(true);
    }
    // 레벨업 카드: 놀이 중 안전할 때 열림
    if (G.pendingCards > 0 && (G.phase === 'floor' || G.phase === 'boss' || G.phase === 'shelter') && !p.airborne && !p.resting) openCard();
  }

  // 첫 30초 한 줄 안내: 움직이기 → 「소리」 꾹 → 끌어 겨누기 → 줍기 → 큰 소리 (긴 설명창 없음)
  function updateHints(dt, input) {
    const H = TG.H;
    if (G.hintStage === 0) {
      H.hintSet(TG.isTouch ? (G.settings.lefty ? '오른쪽 엄지로 움직여요' : '왼쪽 엄지로 움직여요') : 'WASD로 움직여요');
      G.moved += Math.hypot(input.x, input.z) * dt;
      if (G.moved > 0.7 || G.shots > 0) G.hintStage = 1;
    } else if (G.hintStage === 1) {
      H.hintSet(isAuto() ? '가까운 안개에 소리 방울이 저절로 나가요' : TG.isTouch ? '「소리」 버튼을 꾹 누르고 있어요' : '마우스 왼쪽 버튼을 꾹 누르고 있어요');
      if (G.shots >= 3) { G.hintStage = isAuto() ? 3 : 2; G.hintT = 0; if (isAuto()) H.hintSet(null); }
    } else if (G.hintStage === 2) {
      G.hintT += dt;
      if (isAuto()) { G.hintStage = 3; H.hintSet(null); return; } // 도중에 자동으로 바꾸면 겨누기 안내는 건너뜀
      H.hintSet(TG.isTouch ? '누른 채 끌면 그쪽으로 나가요' : '마우스가 가리키는 쪽으로 나가요');
      if (G.aimShots >= 2 || G.hintT > 7) { G.hintStage = 3; H.hintSet(null); }
    } else if (G.hintStage === 3) {
      if (G.notes >= 3) { G.hintStage = 4; H.hintSet(null); }
      else if (TG.F.notes.length || G.notes > 0) H.hintSet('음표 방울을 주워요');
      else H.hintSet(null);
    } else if (G.hintStage === 4) {
      if (G.gauge >= 100) H.hintSet(TG.isTouch ? '큰 소리 버튼을 눌러요!' : 'E 키로 큰 소리!');
      else if (G.gaugeLock > 0) { G.hintStage = 5; H.hintSet(null); }
    }
  }

  // ── 그리기 (화면 주사율). al = 걸음 사이 보간 비율 ──
  function draw(rdt, al) {
    const p = P();
    const vis = G.paused || G.freeze > 0 ? 0 : rdt; // 히트 스톱 동안은 그림도 멈춤
    G.drawT += vis;
    const play = isPlay();
    { // 조준 부채꼴: 「소리」를 누르는 동안 쏘는 쪽에 또렷하게, PC 는 안 눌러도 마우스 쪽에 옅게
      const live = (G.phase === 'floor' || G.phase === 'boss') && !p.resting, human = !G.replay && !G.bot && !G.testIn;
      p.aimR = TG.WV.stat(p.stillLv || 0).range;
      if (live && G.fireOn) { p.aimK = G.autoOn ? 0.55 : 1; p.aimDir = G.fireDir; } // 자동으로 나갈 때는 옅게
      else if (live && human && !TG.isTouch && mouse.seen) { p.aimK = 0.4; p.aimDir = mouseDir(); }
      else p.aimK = 0;
      TG.H.sndBtn(fire.id != null || (G.fireOn && !human), fire.kx, fire.ky);
    }
    p.draw(vis, al);
    TG.F.draw(vis, G.drawT, p, al);
    TG.WV.draw(al);
    TG.C.draw(vis, G.drawT, p);
    // 배경 기계: 보스가 나타날 때 잠깐 느려짐
    G.machK = TG.damp(G.machK, G.machSlow ? 0.08 : 1, G.machSlow ? 5 : 2.5, rdt);
    G.arT += vis * G.machK;
    TG.AR.update(vis * G.machK, G.arT, play ? p : null);
    TG.AR.beat(Math.max(0, Math.cos(G.arT * Math.PI * 2 / 0.5)) ** 4);
    TG.FX.crowd = TG.F.list.length; // 꾸밈 입자 상한(마릿수에 따라 줄임)
    TG.FX.update(vis, null);
    TG.R.hemi.intensity = TG.damp(TG.R.hemi.intensity, G.hemiT || 1.35, 2.5, rdt);
    if (TG.isTouch && TG.H.hud && !TG.H.hud.classList.contains('hide')) {
      const s = TG.H.s, R = 56 * s;
      if (stick.id == null) { const vp = TG.vp(); const ix = G.settings.lefty ? vp.w - 100 * s : 100 * s; TG.H.stickAt(ix, vp.h - 92 * s, 0, 0, false); }
      else { const l = Math.hypot(stick.x, stick.y), k = l > 1 ? 1 / l : 1; TG.H.stickAt(stick.ox, stick.oy, stick.x * k * R, stick.y * k * R, true); }
    }
    document.body.classList.toggle('ended', G.phase === 'result' || G.phase === 'bossEnd' || G.phase === 'covered');
    document.body.classList.toggle('cine', G.phase === 'bossIntro');                 // 보스 등장 확대 동안 HUD 숨김
    document.body.classList.toggle('panelOpen', G.phase === 'result' || G.paused);   // 결과·쉬어가기·멈춤 패널 뒤로 HUD 가 비치지 않게
    if (TG.H.hud && !TG.H.hud.classList.contains('hide')) TG.H.update(rdt, G);
    updateCamera(rdt);
    TG.R.U.uTime.value = G.drawT;
    TG.R.render(rdt);
    G.drawCalls = TG.R.renderer.info.render.calls; G.tris = TG.R.renderer.info.render.triangles;
  }

  function finish(clear) {
    G.phase = 'result';
    const p = P();
    const stars = clear ? 3 : (G.bossStarted ? 2 : 1);
    TG.H.hintSet(null); TG.H.hideCards(); TG.H.hideShelter(); TG.H.gruntHide();
    if (!clear) { TG.A.stopBgm(0.3); G.after(8, () => TG.A.bgm('bgm_win', 0.1, false)); p.setRest(true); }
    else { TG.A.bgm('bgm_win', 0.25, false); p.stopSpecial(); p.playSpecial('victory'); }
    G.result = { clear, time: G.time, fogs: G.popped, combo: G.maxCombo, notes: G.notes, stars, tick: G.tick, hash: G.hash, level: G.level, rescued: G.rescued, floor: G.floor, boss: !!G.bossStarted, hurts: G.hurts, cards: G.cardN,
      atk: G.autoTicks <= 0 ? 'manual' : G.autoTicks >= G.playTicks ? 'auto' : 'mixed', autoShots: G.autoShots };
    TG.H.showResult(G.result);
  }

  // bench: 안개 80마리 + 이펙트 강제
  function benchTick(dt) {
    const F = TG.F;
    const n = F.count('bubble');
    for (let i = n; i < 80; i++) {
      const a = TG.sr() * 6.28, r = TG.srr(4, 13);
      const u = F.spawn('bubble', TG.clamp(P().x + Math.cos(a) * r, -18, 18), TG.clamp(P().z + Math.sin(a) * r, -12, 12));
      if (u) u.spawnT = 0.5;
    }
    if (F.count('clump') < 4) spawnGroup('clump', 1);
    if (F.count('tick') < 5) F.spawnTickLine(5, P().x, P().z);
    G.gaugeLock = 0; G.gauge = Math.min(100, G.gauge + dt * 6);
    G.benchT = (G.benchT || 0) + dt;
    if (G.benchT > 0.25) { G.benchT = 0; TG.FX.popBurst(TG.srr(-8, 8) + P().x, 1, TG.srr(-5, 5) + P().z, 1); }
  }

  // ── 시험 훅 ──
  const ensurePlay = () => { if (!isPlay()) startPlay(true); };
  const api = {
    state() {
      if (G.phase === 'loading' || !TG.PL.root) return { phase: G.phase };
      const p = P(), F = TG.F;
      return {
        phase: G.phase === 'floor' ? 'floor' + G.floor : G.phase, floor: G.floor, tick: G.tick, time: +G.time.toFixed(2), lives: p.hp, maxLives: p.maxHp, shield: p.shield,
        fogLeft: +G.fogLeft().toFixed(3), fogs: F.list.filter((u) => u.state === 'live' && u.kind !== 'tick' && u.kind !== 'cocoon').length,
        ticks: F.list.filter((u) => u.kind === 'tick').length, echoes: F.count('echo'), cocoons: F.count('cocoon'), boss: F.boss ? { hp: F.boss.hp, state: F.boss.state, phase: F.boss.phase } : null,
        fps: +TG.R.fps.toFixed(1), drawCalls: G.drawCalls, tris: G.tris, pixelRatio: TG.R.pr, gauge: Math.round(G.gauge), gaugeLock: +G.gaugeLock.toFixed(2), combo: G.combo, maxCombo: G.maxCombo,
        notes: G.notes, level: G.level, xp: G.xp, popped: G.popped, rescued: G.rescued, revived: G.revived, cards: Object.assign({}, G.cards), cardOpen: G.cardOpen ? G.cardOpen.opts.slice() : null,
        still: p.stillLv || 0, shots: G.shots, autoShots: G.autoShots, autoOn: !!G.autoOn, atk: G.settings.atk, hurts: G.hurts, fire: !!G.fireOn, fireDir: +TG.angDiff(0, G.fireDir || 0).toFixed(3), particles: TG.FX.count(), waves: TG.WV.activeCount(), paused: G.paused, x: +p.x.toFixed(3), z: +p.z.toFixed(3), hash: G.hash, seed: G.seed, replayDone: !!G.replayDone,
      };
    },
    spawn(kind, n, near) {
      n = n || 1;
      if (kind === 'tickline' || kind === 'tick') { TG.F.spawnTickLine(n, P().x, P().z); return; }
      for (let i = 0; i < n; i++) { const a = TG.sr() * 6.28, r = near || TG.srr(5, 10); const u = TG.F.spawn(kind, TG.clamp(P().x + Math.cos(a) * r, -18, 18), TG.clamp(P().z + Math.sin(a) * r, -12, 12), { slot: i }); if (u) u.spawnT = 0.5; }
    },
    jump(name) {
      if (name === 'title') return toTitle();
      if (name === 'intro') return startIntro();
      if (name === 'play' || name === 'floor1' || name === 'wave1') return startPlay(true);
      if (name === 'floor2' || name === 'wave2') { ensurePlay(); return startFloor(2); }
      if (name === 'floor3' || name === 'wave3') { ensurePlay(); return startFloor(3); }
      if (name === 'shelter') { ensurePlay(); TG.F.reset(); G.floorDone = true; return toShelter(); }
      if (name === 'card') { ensurePlay(); G.pendingCards++; return; }
      if (name === 'feat') { ensurePlay(); ['poy', 'woad', 'rogun'].forEach((id) => { TG.C.apply(id); TG.C.apply(id); }); return; }
      if (name === 'echo') { ensurePlay(); startFloor(3); api.spawn('echo', 5, 6); return; }
      if (name === 'cocoon') { ensurePlay(); const u = TG.F.spawn('cocoon', P().x + 3.4, P().z - 0.5, { slot: 1 }); if (u) u.spawnT = 0.5; return; }
      if (name === 'covered' || name === 'covered2') { ensurePlay(); TG.Q.god = false; P().hp = 0; return toCovered(); }
      if (name === 'boss') { ensurePlay(); TG.F.reset(); G.floor = 3; G.floorDone = true; return startBossIntro(); }
      if (name === 'bossfight') { ensurePlay(); TG.F.reset(); G.floor = 3; G.floorDone = true; startBossIntro(); G.machSlow = false; const b = TG.F.startBoss(G.firstBoss); TG.A.bgm('bgm_boss', 0.5); b.y = 0.3; b.scale = 1; b.state = 'fight'; G.phase = 'boss'; G.camZoom = 1.12; G.camFocusK = 0.45; G.hemiT = 1.35; P().noHurt = 1; return; }
      if (name === 'bossend') { api.jump('bossfight'); const b = TG.F.boss; b.hp = 1; G.hitBoss(5, b.x, b.z, false); return; }
      if (name === 'big') { ensurePlay(); G.gaugeLock = 0; G.gauge = 100; return bigSound(); }
      if (name === 'result') { ensurePlay(); G.time = Math.max(G.time, 236); G.popped = Math.max(G.popped, 212); G.maxCombo = Math.max(G.maxCombo, 38); G.notes = Math.max(G.notes, 180); return finish(true); }
      if (name === 'rest' || name === 'fail') { ensurePlay(); G.time = Math.max(G.time, 74); G.popped = Math.max(G.popped, 41); G.notes = Math.max(G.notes, 30); G.maxCombo = Math.max(G.maxCombo, 12); return finish(false); }
    },
    bot(on) { G.bot = on !== false; },
    god(on) { TG.Q.god = on !== false; },
    pause(on) { setPause(on !== false); },
    big() { G.gaugeLock = 0; G.gauge = 100; return bigSound(); },
    pressBig() { G.inBig = true; },
    // 시험 전용(사람 조작에는 안 켜짐): autoFire(true) = 「소리」를 누르고 가장 가까운 대상을 겨누는 입력을 대신 넣음 / input({x,z,fire,aim,big}) = 이동·누름·겨눔을 직접 넣음(null 로 끔)
    autoFire(on) { G.testAuto = on !== false; },
    input(o) { G.testIn = o || null; },
    avoid() { const a = bossAvoid(P()); return { x: a.x, z: a.z, only: a.only }; },
    card(i) { G.inCard = i | 0; },
    rest(i) { G.inPick = i | 0; },
    give(id, n) { for (let i = 0; i < (n || 1); i++) TG.C.apply(id); },
    set(k, v) { if (k === 'lives') P().hp = v; else if (k === 'gauge') { G.gaugeLock = 0; G.gauge = v; } else if (k === 'notes') { for (let i = 0; i < v; i++) G.onPick({ x: P().x, y: 1, z: P().z }); } else G[k] = v; },
    settings: G.settings,
    simK: Math.max(1, Math.min(16, Number(new URLSearchParams(location.search).get('sim')) || 1)),
    speed(k) { api.simK = Math.max(1, Math.min(16, k | 0)); },
    // 그리기 없이 규칙 계산만 n걸음 (빠른 시험용). 카드는 봇/첫 장으로 바로 고름
    run(n) {
      G.fast = true;
      let guard = 0;
      for (let i = 0; i < n && guard < n * 4; guard++) { const t0 = G.tick; simTick(); if (G.tick !== t0) i++; if (G.phase === 'result') break; }
      G.fast = false;
      return api.state();
    },
    // 입력 기록 (같은 시드 + 이 기록 → 같은 결과)
    rec() { return G.rec ? JSON.parse(JSON.stringify(G.rec)) : null; },
    replay(rec) { G.replay = rec; G.bot = false; startPlay(true); return true; },
    result() { return G.result || null; },
    texts() { return TG.H.allText(); },
    // 시험: SEFO 를 가까이서 봄 (dist·pitch·yaw·ty), null 이면 원래 카메라
    cam(o) { api.camOv = o ? Object.assign({ dist: 6, pitch: 0.25, yaw: 0, ty: 1.6 }, o) : null; },
    face(yaw) { const p = P(); p.tyaw = p.yaw = yaw; p.faceLock = 99; },
    // 시험: 카메라 앞서 보기 상태 / 같은 계산을 따로 돌려 봄(seq = [[vx, vz, 배율, 걸음 수], …], 1/60초 걸음) → 걸음마다 lx·lz·한 걸음 변화량
    autoCfg() { return Object.assign({}, AUTO); },
    camInfo() { const p = P(); return { mode: G.settings.cam, lx: cam.lx, lz: cam.lz, cx: cam.x, cz: cam.z, px: p.rx, pz: p.rz, dist: cam.dist, LEAD: Object.assign({}, LEAD) }; },
    leadSim(seq, dt) {
      dt = dt || 1 / 60; const o = { lx: 0, lz: 0, vlx: 0, vlz: 0, gx: 0, gz: 0, hold: 0, cx: 0, cz: 0, cT: 0 }, out = [], maxs = P().MAXSPD;
      for (const [vx, vz, k, n, lock] of seq) for (let i = 0; i < n; i++) { const x0 = o.lx, z0 = o.lz; leadStep(o, dt, vx, vz, maxs, k, !!lock); out.push([+o.lx.toFixed(4), +o.lz.toFixed(4), +Math.hypot(o.lx - x0, o.lz - z0).toFixed(5)]); }
      return out;
    },
    // 시험: 소리 방울 자동/수동 바꾸기(멈춤 창 버튼과 같은 길)
    atk(m) { if (m) setAtk(m); return G.settings.atk; },
    camMode(m) { if (m) { G.settings.cam = m; applySettings(); saveSet(); } return G.settings.cam; },
    audio(vol) { return TG.A.measure(vol); },
    unitPos() { return TG.F.list.map((u) => ({ id: u.id, kind: u.kind, state: u.state, x: u.x, z: u.z, vx: u.vx, vz: u.vz, small: u.val === 0 })); },
    waveTarget() { const p = P(); const t = TG.WV.target(p.x, p.z, 30); return t ? { id: t.id, boss: !!t.boss, kind: t.kind } : null; },
  };
  window.__tg = api;
})();
