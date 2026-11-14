// 게임 규칙·진행. 시간은 전부 곡 시계(EK.AU.songTime) 기준.
// r2: 쉬움은 끝나지 않음(연습 구간 하트 안 깎임·하트 0이면 「잠깐 쉬었다 가자!」), 구슬 소리는 구슬의 박자 시각에 예약,
//     「그대로 멈춰라」는 쎌 인형이 크게 올라오고 화면을 꾹 누르고 있기, 체조 6동작(줄 고정)·부스트는 체조 뒤로 미룸, 움직이는 장애물.
// r3: 부스트는 게이지가 차면 「부스트!」 버튼을 톡 해서 터뜨림(쉬움은 3초 안 누르면 작은 부스트가 저절로), 체조 구슬은 맞췄을 때만,
//     멈춰라는 연타로 성공 못 함(0.25초 넘게 눌러야 참)·손 떼면 「다시 꾹 눌러요」, 점프 판정 너그럽게, 얼굴 더 보이게(빙글 점프·뒤돌아 웃기·체조·출발 때 정면).
// r8 운동장(2026-11-13, 대표 결정): 「그대로 멈춰라」는 운동장 스테이지에만 — 노래의 「멈춰라!」 때 빨간 손바닥 버튼을 톡(연타 X), 「라」 끝에서 게임이 곡을 실제로 멈추고
//     조용한 동안(쉬움 3초·도전 2.5초) 움직이면(도전) 하트 −1. 마을·바다의 「꾹 누르기」 멈춰라는 뺌. 모든 장소·난이도에서 하트 0 → 「다시 해 볼까?」 카드(쉬움 앞 구간 처음부터·도전 처음부터).
// 보통 난이도(2026-11-13): 쉬움·보통·도전 3단계 — 값은 js/songs.js EK.DIFF 한 표(this.D). 보통 = 멈춰라 B+10~14·조용히 2.5초·움직이면 −1·다시 하기는 앞 구간부터.
(function () {
  const EK = window.EK, AU = EK.AU, SP = EK.SPEED, LW = EK.LANE, clamp = EK.clamp, lerp = EK.lerp;
  const JUMP = 0.66, JH = 2.0, SLIDE = 0.7, LEAD = 2.4, REST = 2.6, PRESS_MIN = 0.25, LOW_Y = 0.35, TAU = Math.PI * 2;
  // 진동(햅틱): 아이용이라 아주 짧고 약하게만 — 한 조각 40ms·한 번 합 120ms·최소 간격 60ms (js/haptics.js). 설정 창에서 끌 수 있음
  const HPT = window.GZHaptics ? window.GZHaptics.init({ key: 'ek_haptics', maxSeg: 40, maxTotal: 120, minGap: 60 }) : null;
  const VIB = { orb10: [10], land: [12], ouch: [18, 60, 18], boost: [25], gym_ok: [15, 50, 15], freeze_ok: [20, 50, 20], finish: [14, 40, 14, 40, 12] };
  const PRIO = { orb10: 1, land: 1, boost: 2, ouch: 3, gym_ok: 3, freeze_ok: 3, finish: 4 };
  const buzz = k => { try { if (HPT) HPT.play(k, VIB[k], PRIO[k]); } catch (e) {} };
  const GYM_ACT = { left: 'gymL', right: 'gymR', jump: 'gymUp', slide: 'gymDown' };
  // r5 목소리: 화면 글자 → 같은 말 목소리
  const FAIL_VO = { '앗, 못 멈췄어요!': 'miss_stop', '앗, 움직였어요!': 'moved' };   // r8c: 멈춰라 실패 글자 → 꼬마 쎌 목소리
  const PRAISE_VO = { '좋아요!': 'good', '멋져요!': 'great', '딱 맞아요!': 'match', '최고야!': 'best' };
  // r6 가로형: 가로(폰 844×390·640×360·PC 16:9) 카메라가 주 값. CAM_P 는 r5 세로 카메라(세로로 세운 태블릿·좁은 PC 창용 예비)
  // r8d 대표 실기 「카메라 조금 더 위에서」: 옛 y 2.5·z 4.0·ly 1.6·lz −10(내려다보는 각 약 2.5°) → 약 10° — 앞 장애물이 라온 머리 위로 더 일찍·잘 보임
  // r8e 대표 「라온이가 작아졌어 ㅠ」: y 4.8·z 5.0·ly 0.85 → 라온 쪽으로 당기고(z 3.0) 조금 낮추고(y 3.8) 더 아래를 봄(ly 0.2) — 라온 키 17%→22%, 내려다보는 각 약 10° 그대로, 40m 앞 길은 더 위
  const CAM_GYM = { dly: -0.3, dy: 0.0 };   // r8f: 가로 체조 때 보는 높이 = CAM_L.ly + dly, 카메라 높이 + dy
  const CAM_L = { y: 3.8, z: 3.0, ly: 0.2, lz: -10.5, xk: 0.55 }, CAM_P = { y: 2.15, z: 1.85, ly: 1.9, lz: -8, xk: 0.5 };
  const canvas = EK.$('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, 1, 0.3, 900);
  scene.add(camera);   // 쎌 인형을 카메라 앞에 붙여 그리기 위해
  // 화질(갤럭시탭 2026-11-13): 전엔 2초만 느려도 배율을 1 까지 내리고 다시 올리지 않아 태블릿(dpr 2)에서 계속 흐렸음.
  //   이제 「자동」은 오래(4초+) 느릴 때만 0.1씩 내리고 바닥 1.5(아주 느릴 때만 1.0), 빨라지면 다시 올림. 「높게」는 안 내림 (js/gzview.js)
  GZView.loadQuality('ek');
  const DYN = GZView.makeDyn({ maxPR: GZView.maxPR, soft: 1.5, hard: 1.0, enabled: () => EK.Q.get('dr') !== '0' });
  let pr = DYN.pr;
  DYN.onChange = (v) => { if (v !== pr) { pr = v; resize(); } };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight; renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; GM.baseFov = clamp(2 * Math.atan(Math.tan(21 * Math.PI / 180) / camera.aspect) * 180 / Math.PI, 52, 76); camera.fov = GM.baseFov; camera.updateProjectionMatrix();
  }
  const _v = new THREE.Vector3();

  const GM = EK.GM = {
    phase: 'boot', sub: null, stage: null, diff: 'easy', D: null, chart: null, world: null, player: null, comps: [], friends: [], charId: 'raon',
    t: -LEAD, clock: 0, P: null, hearts: 3, energy: 0, boostUntil: -9, score: 0, orbs: 0, noteN: 0, combo: 0, missions: 0, hits: 0, rests: 0, bot: EK.Q.get('auto'), god: EK.Q.has('god'),
    baseFov: 70, fps: 60, camPos: new THREE.Vector3(0, 3.6, 6.4), camLook: new THREE.Vector3(0, 1.5, -9), playSec: 0, sk: 0, sb: 0,

    // ---------- 시작 ----------
    async boot() {
      resize(); window.addEventListener('resize', resize);
      EK.UI.init();
      await EK.probeModel('raon');
      AU.init(); AU.loadVoice();   // r5: 목소리 묶음 풀어 두기(기다리지 않음)
      EK.UI.makeThumbs();
      this.ssel = EK.makeSsel(); this.ssel.group.visible = false; camera.add(this.ssel.group);
      this.toTitle();
      EK.booted = true;
      const qs = EK.Q.get('stage'); if (qs && EK.STAGES[qs]) this.startRun(qs, EK.Q.get('diff') || 'easy', { seed: EK.Q.num('seed', 0) || undefined });
    },
    clearWorld() {
      if (this.world) { this.world.dispose(scene); this.world = null; }
      for (const c of [this.player].concat(this.comps, this.friends)) if (c) { scene.remove(c.group); EK.disposeChar(c); }
      this.player = null; this.comps = []; this.friends = [];
    },
    toTitle() {
      AU.stopMusic(); AU.voiceClear(); this.clearWorld(); this.phase = 'title'; this.sub = null; this.F = null; EK.paused = false;
      this.world = new EK.World(scene, 'town', null, null);
      this.player = EK.makeChar(this.charId); scene.add(this.player.group); this.player.group.position.set(0, 0, 0);
      const a = new EK.Doll('haeon'), b = new EK.Doll('sseni'); a.group.position.set(-1.5, 0, -2.3); b.group.position.set(1.5, 0, -2.3); scene.add(a.group, b.group); this.comps = [a, b];   // r5: 라온만 앞·가운데, 인형 친구는 뒤로(그림체 차이가 덜 보이게)
      camera.fov = this.baseFov; camera.updateProjectionMatrix();
      if (this.ssel) this.ssel.group.visible = false;
      EK.UI.hud(false); EK.UI.show('title');
    },
    async startRun(stageId, diff, opts) {
      opts = opts || {}; AU.unlock(); AU.jingle(false); AU.voiceClear();
      const st = this.stage = EK.STAGES[stageId]; this.diff = EK.normDiff(diff); this.D = EK.DIFF[this.diff];
      this.phase = 'loading'; EK.UI.show('boot'); EK.UI.hud(false);
      this.audioMode = await AU.load(st);
      this.clearWorld();
      this.seed = opts.seed || ((Math.random() * 1e9) | 0) + 1;
      const C = this.chart = EK.buildChart(st, this.diff, this.seed);
      this.world = new EK.World(scene, st.theme, C, st);
      this.player = EK.makeChar(this.charId); scene.add(this.player.group); this.player.group.rotation.y = Math.PI;
      this.comps = st.theme === 'ocean' ? [new EK.Shark('boomi'), new EK.Shark('lala')] : [new EK.Doll('haeon'), new EK.Doll('kids')];
      this.comps.forEach((c, i) => { scene.add(c.group); c.group.rotation.y = Math.PI; c.side = i ? 1 : -1; c.act = 'run'; });
      const ids = st.theme === 'ocean' ? ['sefo', 'ssel', 'sseni', 'berri', 'haeon', 'kids'] : ['sefo', 'ssel', 'sseni', 'berri'];
      const FX = [-1.0, 1.0, -2.35, 2.35, -3.7, 3.7], FZ = [-3.0, -3.0, -2.6, -2.6, -3.2, -3.2];   // r3: 뒤쪽에 넓게 벌려 세움(주인공 뒤에 숨지 않게)
      this.friends = ids.map((id, i) => { const d = new EK.Doll(id); d.group.position.set(FX[i], 0.45, this.world.stageZ + FZ[i]); d.group.visible = false; scene.add(d.group); return d; });
      this.P = { lane: 1, x: 0, y: 0, jumpT: -9, dropT: -9, dropY: 0, slideT: -9, hitT: -9, inv: -9, gymAct: null, gymUntil: -9, faceUntil: -9 };
      this.hearts = 3; this.energy = 0; this.boostUntil = -9; this.boostHold = 0; this.boostLen = 1; this.readyAt = null; this.boostMag = false; this.boostMagHold = false; this.glanceUntil = 0; this.glanceN = 0; this.glanceDir = 1; this.spin = 0; this.pry = Math.PI; this.tapped = 0; this.noBoostUntil = -9; this.restUntil = -9; this.rests = 0;
      this.score = 0; this.orbs = 0; this.noteN = 0; this.combo = 0; this.missions = 0; this.hits = 0; this.dodged = 0; this.bumps = 0;
      this.boosts = 0; this.hp = 0; this.oc = 0; this.bc = 0; this.nc = 0; this.ci = 0; this.hi = 0; this.gi = 0; this.fi = 0; this.F = null; this.sub = null; this.clock = 0; this.endClock = 0; this.cardUntil = 0; this.hintUntil = 0; this.lastBeat = -99; this.botMove = 0; this.won = false; this.boostOn = false;
      this.goT = 0; this.loseT = 0; this.retryShown = false; this.failN = {}; this.loseWhy = null;   // r8: goT = 출발(또는 다시 하기) 지점, failN = 같은 멈춰라를 몇 번 놓쳤나(2번이면 판정 창 +0.5초)
      this.pend = []; this.snd = { n: 0, ahead: 0, late: 0, max: 0 }; this.sndReal = { n: 0, late: 0, max: 0, sum: 0 }; this.cheerUntil = 0; this.cue = null; this.sk = 0; this.sb = 0; this.cx = null; this.ps = 1;
      this.t = -LEAD; EK.paused = false;
      AU.applyVol(); AU.start(st, LEAD);
      this.phase = 'play';
      EK.UI.show(null); EK.UI.hud(true); EK.UI.resetHud(); this.syncHud(true);
      const K0 = camera.aspect > 1 ? CAM_L : CAM_P; this.camPos.set(0, K0.y, -SP * this.t + K0.z); this.camLook.set(0, 1.5, -SP * this.t - 9); camera.position.copy(this.camPos);
    },

    // ---------- 조작 ----------
    gymLock() { const g = this.chart && this.chart.gyms[this.gi]; return !!(g && !g.done && this.t > g.moves[0].t - this.chart.per * 4.2); },
    input(kind) {
      if (this.phase !== 'play' || EK.paused) return;
      const P = this.P, t = this.t;
      if (this.sub === 'freeze') { this.stopMoved(); return; }   // r8: 곡이 멈춘 동안 움직이면(도전) 「앗, 움직였어요!」
      if (t < this.goT - 0.3) return;
      const lock = this.gymLock();   // 체조 중엔 가운데 줄에 서서 따라 하기만
      if (kind === 'left' || kind === 'right') { if (!lock) { const nl = clamp(P.lane + (kind === 'left' ? -1 : 1), 0, 2); if (nl !== P.lane) { P.lane = nl; AU.sfx('move'); } } }
      else if (kind === 'jump') { if (t - P.jumpT >= JUMP) { P.jumpT = t; P.dropT = -9; P.slideT = -9; P.jumpBuf = -9; AU.sfx('jump'); } else P.jumpBuf = t; }
      else if (kind === 'slide') { if (P.y > 0.05) { P.dropT = t; P.dropY = P.y; } P.slideT = t; AU.sfx('slide'); }
      this.gymInput(kind);
    },
    // r8 그대로 멈춰라(운동장): 빨간 손바닥 버튼을 톡. fresh = 버튼이 뜬 뒤에 새로 댄 손가락(뜨기 전부터 닿아 있던 손가락은 불인정)
    tapStop(fresh) {
      const F = this.F; if (!F || F.over || EK.paused || this.phase !== 'play' || !F.btnShown) return false;
      if (!fresh) { F.msg = '손 떼고 다시 톡!'; F.stale = true; AU.sfx('soft'); AU.voice('lift_tap'); return false; }   // r8c: 꼬마 쎌 목소리
      if (F.tapped || F.failed) return false;   // 톡 한 번만(연타 X)
      const fz = F.fz, t = this.t, inWin = F.phase === 'hold' ? this.clock <= F.winEndClock : (t >= fz.win[0] && t <= fz.win[1] + this.extraWin(fz));
      if (!inWin) { if (F.phase !== 'hold' && t < fz.win[0]) { F.msg = '아직이에요!'; AU.sfx('soft'); AU.voice('not_yet'); } return false; }   // r8b: 너무 빠른 톡은 감점 없이 안내만(쉬움·도전 같음)
      F.tapped = true; F.tapT = t; F.msg = ''; F.stale = false;   // r8b: 「얼음!」 은 버튼 라벨 한 곳만
      AU.sfx('good'); buzz('freeze_ok'); this.score += 200;   // r8b 톡 순간 소리·진동·+200 · r8f: 「얼음!」 목소리(ice.m4a)는 뺌(대표님 2026-11-14 「얼음은 빼자」) — 버튼 글자 「얼음!」·효과음은 그대로
      if (F.phase === 'hold') this.iceFx();
      return true;
    },
    stopMoved() { const F = this.F; if (!F || F.phase !== 'hold' || F.over || F.failed || !this.D.moved) return; this.failFreeze('앗, 움직였어요!'); },   // 보통·도전
    extraWin(fz) { return (this.failN[fz.id] || 0) >= 2 ? 0.5 : 0; },   // 같은 자리 2번 실패하면 판정 창 몰래 +0.5초
    iceFx() { const P = this.P; AU.sfx('ice'); this.world.spark(P.x, 1.4, -SP * this.t - 0.4, 26, [0xffffff, 0xbfeaff, 0x9ff5e0], 2.2, 2.2, 0.9, 1.5); },
    gymInput(kind) {
      const g = this.chart.gyms[this.gi]; if (!g || g.done) return;
      const win = this.D.gymWin;
      for (const m of g.moves) if (m.res === 0 && Math.abs(this.t - m.t) <= win) {
        if (m.kind === kind) { m.res = 1; m.at = this.t; g.ok++; if (!this.boostHold) this.energy = Math.min(1, this.energy + 0.05); this.score += 100; AU.sfx('good'); m.praise = ['좋아요!', '멋져요!', '딱 맞아요!', '최고야!'][g.ok % 4];
          const P = this.P; P.gymAct = GYM_ACT[kind]; P.gymUntil = this.t + 0.8; P.faceUntil = this.t + 0.75;   // 맞추면 빙글 돌아 얼굴을 보여 줌
          // 화면 양옆에서 색종이
          for (const sx of [-1, 1]) this.world.spark(P.x + sx * 3.2, 2.6, -SP * this.t - 2, 10, [0xffd23a, 0xff8fb1, 0x5fd6c4, 0xffffff], 2.2, 2.5, 0.9, 3);
          AU.voice(PRAISE_VO[m.praise] || 'good'); }   // r5: 얼굴 앞 반짝이는 뺌(체조 자세가 가려지던 것)
        return;
      }
    },

    // ---------- 한 걸음 (규칙) ----------
    update(t, dt) {
      const C = this.chart, P = this.P, W = this.world, st = this.stage, per = C.per, D = this.D;
      this.t = t; this.clock += dt;
      // r8: 하트 0 → 「다시 힘내 보자!」 띠 1.2초 → 밝은 카드 「하트가 다 떨어졌어요! 다시 해 볼까?」 [다시 하기]/[그만하기] (봇은 3번까지 다시 하기)
      if (this.phase === 'lose') { this.endClock += dt; if (this.endClock > 1.2 && !this.retryShown) { this.retryShown = true; EK.UI.lose(false); EK.UI.show('retry'); AU.voice('retry_card', { cut: true }); } if (this.bot && this.retryShown && this.endClock > 1.7) { if (this.rests < 3) this.retry(); else this.giveUp(); } return; }
      if (this.bot) this.botThink(t);
      this.playSec += dt;

      // 안내 카드·도움말(손가락 그림)
      while (this.ci < C.cards.length && t >= C.cards[this.ci].t && this.clock >= (this.cardWait || 0) && !this.F) {   // 보통 난이도 작업 때 고침: 멈춰라(신호등·버튼) 동안 뜨던 구간 카드(운동장 「달려라!」)는 멈춰라가 끝난 뒤로 미룸   // r5: 「에너지 부스트!」 글자가 떠 있는 동안은 구역 카드를 미룸
        const c = C.cards[this.ci++]; if (!this.sub) { EK.UI.card(c.a, c.b, c.pic); this.cardUntil = this.clock + 2.8; } }
      if (this.cardUntil && this.clock > this.cardUntil) { EK.UI.card(null); this.cardUntil = 0; }
      while (this.hi < C.hints.length && t >= C.hints[this.hi].t) { const h = C.hints[this.hi++]; if (t >= this.restUntil) { const L = camera.aspect > 1 || !h.textP; EK.UI.hint(L ? h.text : h.textP, L ? h.icon : (h.iconP || h.icon)); this.hintUntil = this.clock + h.d; const hv = L ? h.vo : (h.voP || h.vo); if (hv) AU.voice(hv); } }   // r7: 가로·세로에 맞는 도움말(글자 = 목소리)
      if (this.hintUntil && this.clock > this.hintUntil) { EK.UI.hint(null); this.hintUntil = 0; }
      const ct = t - this.goT;   // r8: 다시 하기 뒤에도 「준비~」 → 「다시 달려요!」(목소리 again) 카운트
      if (ct < 0) { EK.UI.count(ct < -1.0 ? '준비~' : this.rests > 0 ? '다시 달려요!' : '출발!'); const s = ct < -1.0 ? 0 : 1; if (this.cnt !== s) { this.cnt = s; AU.sfx('count', s); AU.voice(s ? (this.rests > 0 ? 'again' : 'go') : 'ready'); } } else if (this.cnt != null) { EK.UI.count(null); this.cnt = null; }   // r8c: 도전(처음부터)도 다시 하기면 「다시 달려요!」

      // 그대로 멈춰라(r8 운동장): 「그대로」부터 신호등 → 버튼 → 「라」 끝에서 곡이 멈춤(그동안은 sub 가 'freeze')
      const fz = C.freezes[this.fi];
      if (!this.F && fz && !fz.done && t >= fz.t && this.phase === 'play') this.beginFreeze(fz);
      if (this.F) { this.updateFreeze(dt); if (this.sub === 'freeze' || this.phase !== 'play') return; }

      // 움직임
      const lock = this.gymLock(); if (lock) P.lane = 1;
      P.x = lerp(P.x, (P.lane - 1) * LW, Math.min(1, dt * 17));
      let y = 0; const jk = (t - P.jumpT) / JUMP;
      if (jk >= 0 && jk <= 1) { y = 4 * JH * jk * (1 - jk); if (P.dropT > P.jumpT) { y = P.dropY * (1 - (t - P.dropT) / 0.16); if (y <= 0) { y = 0; P.jumpT = -9; P.dropT = -9; } } }
      const wasAir = P.y > 0.05; P.y = Math.max(0, y);
      if (wasAir && P.y <= 0 && this.phase === 'play' && !this.sub) buzz('land');   // 점프 착지 톡
      if (P.jumpBuf > 0 && t - P.jumpBuf < 0.14 && t - P.jumpT >= JUMP && this.phase === 'play') { P.jumpBuf = -9; this.input('jump'); }   // 착지 직전에 누른 점프는 착지하자마자
      const sliding = t - P.slideT < SLIDE && P.y < 0.4;
      const boost = t < this.boostUntil, mag = boost && this.boostMag;   // mag: 톡 해서 터뜨린 큰 부스트만 모든 줄 구슬을 끌어당김
      const resting = false;   // r8: 「잠깐 쉬었다 가자」(쉬움 하트 0 이어 달리기)는 폐기 — 모든 난이도 하트 0 → 다시 하기

      if (this.phase === 'play') {
        // 구슬: 먹은 판정은 넉넉히 미리(0.11초 전부터), 소리와 반짝이는 그 구슬의 박자 시각에 맞춰 예약
        const orbs = C.orbs;
        const real = AU.mode === 'buffer' && AU.ctx && !AU.sim, ahead = 0.11 + (real ? AU.lat : 0);   // 출력 지연이 큰 기기(블루투스 등)는 그만큼 더 일찍 판정해 소리를 미리 예약
        while (this.oc < orbs.length && orbs[this.oc].t < t - 0.004) { if (!orbs[this.oc].got && !orbs[this.oc].gym) this.combo = 0; this.oc++; }   // 박자를 지난 구슬은 못 먹음(대신 0.11초 전부터·옮기는 중인 줄까지 넉넉히) → 소리가 늘 박자 위
        for (let i = this.oc; i < orbs.length; i++) { const o = orbs[i]; if (o.t > t + ahead) break; if (o.got) continue;
          const ox = (o.lane - 1) * LW, dx = Math.abs(P.x - ox);
          if (o.gym && o.mv.res !== 1) continue;   // 체조 구슬은 그 동작을 맞췄을 때만 나타남
          const okY = o.gym || (o.y > 1.9 ? P.y > 0.7 : P.y < 1.5);
          if (((dx < 0.95 || o.lane === P.lane) && okY) || mag) {   // 그 줄로 옮기는 중이어도 먹은 것으로(넉넉하게)
            o.got = true; if (mag && dx > 0.95) o.px = P.x;
            const d = Math.max(0, o.t - t), heart = o.heartOn && this.hearts < 3;
            if (heart) this.hearts++;
            this.orbs++; this.combo++; this.score += 10; if (this.combo % 10 === 0) buzz('orb10'); if (this.orbs % 20 === 0) { this.glanceUntil = this.clock + 0.85; this.glanceDir = -this.glanceDir; }   // 구슬 20개마다 뒤돌아 웃기
             if (!boost && !this.boostHold) this.energy = Math.min(1, this.energy + D.energy);
            // 효과음도 곡과 같은 출력 지연(lat)을 거치므로 그만큼 앞당겨 예약 → 귀에 들리는 순간이 구슬의 박자
            // (소리 엔진 시계로 직접 계산: 구슬 박자가 스피커에서 나오는 순간 = t0 + 구슬 시각 + 보정)
            const ad = real ? Math.max(0, AU.t0 + o.t + AU.adj - AU.ctx.currentTime) : d; AU.sfx('orb', this.combo, ad); if (heart) AU.sfx('good');
            if (real) { const e = Math.abs(AU.ctx.currentTime + ad - AU.t0 - o.t - AU.adj), sr = this.sndReal; sr.n++; sr.sum += e; if (e > 0.02) sr.late++; if (e > sr.max) sr.max = e; }
            const sn = this.snd, off = t + d - o.t; sn.n++; if (d > 0) sn.ahead++; if (off > 0.02) sn.late++; if (off > sn.max) sn.max = off;
            this.pend.push({ at: o.t, x: o.px != null ? P.x : ox, y: o.y, heart });
          }
        }
        // 하트 구슬(쉬움): 하트가 모자랄 때만 나타남
        while (this.hp < C.hearts.length && C.hearts[this.hp].t - t < 4) { C.hearts[this.hp].heartOn = this.hearts < 3; this.hp++; }
        const notes = C.notes;
        while (this.nc < notes.length && notes[this.nc].t < t - 0.13) this.nc++;
        for (let i = this.nc; i < notes.length; i++) { const n = notes[i]; if (n.t > t + 0.11) break; if (n.got) continue;
          if (Math.abs(P.x - (n.lane - 1) * LW) < 0.95 || mag) { n.got = true; this.noteN++; this.score += 50; if (!this.boostHold) this.energy = Math.min(1, this.energy + 0.05); AU.sfx('note', 0, Math.max(0, n.t - t)); W.spark((n.lane - 1) * LW, 1.3, -SP * t - 0.7, 14, [0xff6fa5, 0xffd23a, 0xffffff], 3, 2, 0.6, 6, -SP); } }
        // 장애물
        const obs = C.obs; let cue = null;
        while (this.bc < obs.length && obs[this.bc].t < t - 0.1) { if (!obs[this.bc].hit) this.dodged++; this.bc++; }
        for (let i = this.bc; i < obs.length; i++) { const o = obs[i]; if (o.t > t + 0.95) break; if (o.hit) continue;
          const ox = o.kind === 'mover' ? EK.moverX(o, t) : (o.lane - 1) * LW, near = Math.abs(P.x - ox) <= 0.9;
          if (o.t > t + 0.085) { if (!cue && near && o.kind !== 'block' && o.t - t < 0.9) cue = o.kind === 'high' ? 'slide' : 'jump'; continue; }   // 곧 닿을 장애물: 해당 버튼을 살짝 키워 알려 줌
          if (!near) continue;
          const col = o.kind === 'low' || o.kind === 'mover' ? (P.y < LOW_Y && !(t >= P.jumpT && t - P.jumpT < 0.12)) : o.kind === 'high' ? !sliding : true; if (!col) continue;
          o.hit = true; o.popT = t; o.popX0 = ox;
          if (boost || resting) { o.popX = ox < -0.5 ? -1 : ox > 0.5 ? 1 : (Math.random() < 0.5 ? -1 : 1); if (boost) this.score += 100; AU.sfx('pop'); W.spark(ox, 1.6, -SP * t - 1.2, 16, [0xffd23a, 0xff8fb1, 0x5fd6c4, 0xffffff], 4, 2, 0.6, 6, -SP); }
          else if (o.practice) {   // 연습 구간: 하트는 그대로, 다정하게 한 번 더 알려 줌
            this.bumps++; o.popX = P.x > ox ? -0.6 : 0.6; P.hitT = t; P.inv = t + 0.8; AU.sfx('soft');
            // r7: 가로 = 「점프 버튼을 톡!」·「옆으로 톡!」(▲ 버튼·반쪽 톡 그림), 세로(예비) = 옛 말. 글자 = 목소리
            const L = camera.aspect > 1, k = o.kind === 'high' ? 'down' : o.kind === 'block' ? 'side' : 'up';
            const B = { up: L ? ['괜찮아요! 점프 버튼을 톡!', 'jbtn', 'bump_up'] : ['위로 밀거나 톡! 점프', 'up', 'hint_up'], down: ['괜찮아요! 아래로 밀면 숙이기!', 'down', 'bump_down'], side: L ? ['괜찮아요! 옆으로 톡!', 'tap', 'bump_side'] : ['좌우로 밀어요', 'lr', 'hint_lr'] }[k];
            EK.UI.hint(B[0], B[1]); this.hintUntil = this.clock + 2.4; AU.voice(B[2]);
          }
          else if (t >= P.inv && !this.god) { this.hits++; this.hearts--; P.inv = t + 1.8; P.hitT = t; if (!this.boostHold) this.energy = Math.max(0, this.energy - 0.1); this.combo = 0; o.popX = P.x > ox ? -0.6 : 0.6; AU.sfx('hit'); buzz('ouch'); EK.UI.pop('아야, 괜찮아!', 'p'); AU.voice('ouch');
            W.spark(P.x + (o.popX > 0 ? 1.1 : -1.1), 1.4, -SP * t - 2.4, 6, [0xffffff, 0xffd23a], 1.8, 1.0, 0.4, 6, -SP);   // r7: 「아야」 반짝이는 라온 옆·뒤(머리를 안 덮게)
            if (this.hearts <= 0) { this.lose(); return; } }
          else { o.hit = false; o.popT = null; }
        }
        if (cue !== this.cue) { this.cue = cue; EK.UI.cue(cue); }
        // 체조
        this.updateGym(t, per);
        // 부스트(r3): 게이지가 가득 차면 「부스트!」 버튼이 반짝 → 톡 해서 터뜨림(16박·모든 줄 구슬 자석).
        // 쉬움은 3초 안 누르면 작은 부스트(8박·자석 없음)가 저절로. 체조에 걸리면 남은 시간을 체조 뒤로 미룸
        const g = C.gyms[this.gi], inGym = g && t > g.t0 - per * 8 && !g.done;   // r7: 체조 카드 바로 앞에는 부스트를 안 띄움(카드와 「에너지 부스트!」가 같이 뜨지 않게)
        if (boost && g && !g.done && t >= g.t0) { this.boostHold = this.boostUntil - t; this.boostUntil = -9; EK.UI.boost(false); EK.UI.boostEnding(false); }
        const bNow = t < this.boostUntil;
        if (!bNow && !this.boostHold && this.energy >= 1 && !inGym && !resting && !this.F && t > this.goT && t < C.finishT - 3 && t >= this.noBoostUntil && (!fz || fz.done || fz.t - t > 3)) {
          if (this.readyAt == null) { this.readyAt = this.clock; AU.sfx('charge'); AU.voice('boost_ready'); EK.UI.boostBtn(true); }
          else if (D.autoBoost != null && this.clock - this.readyAt >= D.autoBoost) this.fireBoost(false);   // 쉬움 3초·보통 5초·도전 없음
        } else if (this.readyAt != null) { this.readyAt = null; EK.UI.boostBtn(false); }
        const bNow2 = t < this.boostUntil;
        if (bNow2) { this.energy = clamp((this.boostUntil - t) / this.boostLen, 0, 1); const b = Math.floor((t - st.offset) / per); if (b !== this.lastBeat) { this.lastBeat = b; AU.sfx('tick'); }
          EK.UI.boostEnding(this.boostUntil - t < per * 4);   // 끝나기 4박 전부터 게이지가 통통(곧 끝나요)
          // 별 터널: 길 양옆에 별빛이 떠 있다가 휙휙 지나감 · 친구들도 같이 반짝
          if (Math.random() < dt * (this.boostMag ? 34 : 16)) W.spark((Math.random() < 0.5 ? -1 : 1) * (3.0 + Math.random() * 1.6), 0.4 + Math.random() * 3.2, -SP * t - 14 - Math.random() * 30, 1, [0xfff3b0, 0xff8fb1, 0x9ff5e0, 0xffffff], 0.1, 0, 1.1, 0);
          if (Math.random() < dt * 14) { const c = this.comps[(Math.random() * this.comps.length) | 0]; if (c) W.spark(c.group.position.x, c.group.position.y + 0.4 + Math.random() * 1.2, c.group.position.z + 0.4, 1, [0xffd23a, 0xffffff, 0x5fd6c4], 0.6, 0.5, 0.5, 1); }
          if (Math.random() < dt * 14) W.spark(P.x + (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.5), 1.2 + Math.random() * 1.4, -SP * t - 1.6 - Math.random() * 2, 1, [0xff8fb1, 0xffd23a, 0x5fd6c4, 0xb9a4ff], 0.3, 0.4, 0.45, 0, -SP * 0.8); }   // r5: 캐릭터 앞(카메라 쪽)에서 만들던 반짝이를 옆·뒤쪽으로(라온을 안 가리게)
        else if (this.boostOn && !this.boostHold) { AU.sfx('boostEnd'); EK.UI.boost(false); EK.UI.boostEnding(false); this.energy = 0; }
        this.boostOn = bNow2 || !!this.boostHold;
        // 결승
        if (t >= C.finishT) { this.phase = 'finale'; this.won = true; this.endClock = 0; this.boostUntil = -9; this.boostHold = 0; this.readyAt = null; EK.UI.boostBtn(false); EK.UI.boostEnding(false); AU.sfx('win'); buzz('finish'); AU.voice('manse', { cut: true }); AU.voice('finish'); EK.UI.clearPop(); EK.UI.boost(false); EK.UI.card(null); EK.UI.hint(null); EK.UI.cue(null); EK.UI.rest(false); EK.UI.finale(true); EK.UI.padOn(false); this.score += 300 + this.hearts * 100; }
      } else if (this.phase === 'finale') {
        this.endClock += dt; P.lane = 1;
        if (Math.random() < dt * 30) W.spark((Math.random() - 0.5) * 12, 6 + Math.random() * 3, W.stageZ + (Math.random() - 0.5) * 6, 1, [0xff8fb1, 0xffd23a, 0x5fd6c4, 0xb9a4ff, 0xffffff], 1.2, 0, 2.2, 3);
        if (t >= C.endT || this.endClock > 7) this.showResult(true);
      }
      // 구슬 반짝이: 박자 시각에
      const pd = this.pend; while (pd.length && pd[0].at <= t) { const q = pd.shift(); if (q.heart) { if (this.phase === 'play') EK.UI.pop('하트 +1', 'p sm');   /* r7: 결승 무대에선 안 띄움 */ W.spark(q.x, q.y, -SP * t - 0.7, 14, [0xff5c8a, 0xffb3cb, 0xffffff], 3, 2, 0.6, 6, -SP); } else W.spark(q.x, q.y, -SP * t - 0.7, 5, [0xffe27a, 0xffffff], 2.2, 1.5, 0.4, 6, -SP); }   // r5: 구슬 반짝이는 라온 몸 바로 뒤(먼 쪽)에서 — 몸에 가려지고 얼굴·몸을 덮지 않음
      this.syncHud();
    },
    // 「부스트!」 버튼(또는 B·Enter 키)을 톡
    tapBoost() { if (this.phase !== 'play' || EK.paused || this.sub || this.F || this.readyAt == null) return false; this.fireBoost(true); return true; },
    fireBoost(tapped) {
      this.readyAt = null; EK.UI.boostBtn(false); this.boostMag = !!tapped; if (tapped) this.tapped++;
      this.startBoost(this.t, this.chart.boostBeats * this.chart.per * (tapped ? 1 : 0.5), true);
      if (tapped) { this.world.spark(this.P.x, 2.9, -SP * this.t - 3.2, 30, [0xff8fb1, 0xffd23a, 0x5fd6c4, 0xb9a4ff, 0xffffff], 4.5, 2.5, 0.7, 6, -SP); AU.voice('boost'); }   // r5: 터뜨림은 캐릭터 뒤·위쪽에서(가리지 않게)
      if (this.cardUntil) { EK.UI.card(null); this.cardUntil = 0; } this.cardWait = this.clock + 1.5;
    },
    startBoost(t, len, fresh) {
      this.boostUntil = t + len; if (fresh) { this.boostLen = len; this.boosts = (this.boosts || 0) + 1; EK.UI.pop(this.boostMag ? '에너지 부스트!' : '부스트!', 'y bst'); }
      AU.sfx('boost'); if (fresh) buzz('boost'); EK.UI.boost(true); this.boostOn = true;
    },
    // r8 하트 0 → 다시 하기: 쉬움(·보통)은 바로 앞 구간 처음부터(하트 3·곡도 그 자리부터), 도전은 처음부터. 횟수(rests)만큼 별이 줄지만 완주하면 1개는 꼭
    retry() {
      if (this.phase !== 'lose') return; this.rests++; EK.UI.lose(false);
      let pos = 0; if (this.D.retry === 'section') for (const s0 of this.chart.secStarts) if (s0 <= this.loseT + 1e-6) pos = s0;
      this.resumeAt(pos);
    },
    giveUp() { if (this.phase !== 'lose') return; EK.UI.lose(false); this.showResult(false); },
    resumeAt(pos) {
      const C = this.chart, st = this.stage, P = this.P, lo = pos - 0.5;
      AU.stopMusic(); AU.voiceClear();
      this.hearts = 3; this.energy = 0; this.boostUntil = -9; this.boostHold = 0; this.readyAt = null; this.boostMag = false; this.boostMagHold = false; this.combo = 0; this.sub = null; this.F = null; this.cue = null; this.glanceUntil = 0; this.spin = 0; this.cheerUntil = 0; this.cardUntil = 0; this.hintUntil = 0; this.cardWait = 0; this.noBoostUntil = -9; this.restUntil = -9; this.boostOn = false; this.pend = []; this.retryShown = false; this.cnt = null; this.lastBeat = -99; this.endClock = 0;
      Object.assign(P, { lane: 1, x: 0, y: 0, jumpT: -9, dropT: -9, dropY: 0, slideT: -9, hitT: -9, inv: pos + 1.0, gymAct: null, gymUntil: -9, faceUntil: -9, jumpBuf: -9 });
      for (const o of C.orbs) if (o.t >= lo) { o.got = false; o.px = null; }
      for (const o of C.obs) if (o.t >= lo) { o.hit = false; o.popT = null; o.popX = 0; if (o.mesh) { o.mesh.scale.setScalar(1); o.mesh.rotation.z = 0; o.mesh.position.set((o.lane - 1) * LW, 0, -SP * o.t); if (o.mk) o.mk.visible = true; } }
      for (const n of C.notes) if (n.t >= lo) n.got = false;
      for (const g of C.gyms) if (g.t1 > pos) { g.done = false; g.ok = 0; g.success = undefined; g.carded = false; g.counted = false; for (const m of g.moves) { m.res = 0; m.said = false; m.praise = null; m.at = undefined; } }
      for (const f of C.freezes) if (f.t >= pos) { f.done = false; f.result = 0; }   // r8b: 「그대로」 시작이 되돌린 구간 안일 때만(구간 경계에 걸친 끝난 멈춰라는 되살리지 않음)
      for (const h of C.hearts) if (h.t >= lo) h.heartOn = false;
      const idx = (arr, k) => { let i = 0; while (i < arr.length && arr[i].t < k) i++; return i; };
      this.oc = idx(C.orbs, pos); this.bc = idx(C.obs, pos); this.nc = idx(C.notes, pos); this.hp = idx(C.hearts, pos - 4); this.ci = idx(C.cards, pos - 0.3); this.hi = idx(C.hints, pos - 0.3);
      this.gi = 0; while (this.gi < C.gyms.length && C.gyms[this.gi].t1 <= pos) this.gi++;
      this.fi = 0; while (this.fi < C.freezes.length && C.freezes[this.fi].t < pos) this.fi++;
      this.world.oi = 0; this.world.frozen = false; for (const c of this.comps) c.act = 'run';
      this.orbs = C.orbs.filter(o => o.got).length; this.noteN = C.notes.filter(n => n.got).length; this.missions = C.gyms.filter(g => g.success).length + C.freezes.filter(f => f.result === 1).length; this.loseWhy = null;   // 되돌린 구간 것은 다시 셈
      this.goT = pos; this.t = pos - LEAD; EK.paused = false;
      AU.applyVol(); AU.start(st, LEAD, pos);
      this.phase = 'play'; EK.UI.show(null); EK.UI.hud(true); EK.UI.resetHud(); this.syncHud(true);
      const K0 = camera.aspect > 1 ? CAM_L : CAM_P; this.camPos.set(0, K0.y, -SP * this.t + K0.z); this.camLook.set(0, 1.5, -SP * this.t - 9); camera.position.copy(this.camPos);
    },

    updateGym(t, per) {
      const C = this.chart, g = C.gyms[this.gi]; if (!g) { EK.UI.gym(null); return; }
      if (t < g.t0) { EK.UI.gym(null); return; }
      const win = this.D.gymWin, last = g.moves[g.moves.length - 1];
      let cur = null;
      for (const m of g.moves) { if (m.res === 0 && t > m.t + win) { m.res = -1; AU.sfx('soft'); } if (!cur && (m.res === 0 || t < m.t + 0.35)) cur = m; }
      // 친구들이 먼저 보여 줌
      for (const c of this.comps) { let a = 'run'; for (const m of g.moves) if (t > m.t - 0.15 && t < m.t + 0.75) a = GYM_ACT[m.kind]; c.act = a; }
      if (!g.done && last.res !== 0 && t > last.t + 0.4) {
        g.done = true; const ok = g.ok >= g.need;
        if (ok) { this.missions++; this.score += 500; if (!this.boostHold) this.energy = Math.min(1, this.energy + 0.3); if (this.hearts < 3) this.hearts++; AU.sfx('win'); AU.sfx('cheer'); buzz('gym_ok'); AU.voice('gym_ok'); EK.UI.pop('체조 성공!', 'y'); this.cheerUntil = this.clock + 1.2; this.noBoostUntil = t + 1.2; this.world.spark(this.P.x, 3.0, -SP * t - 3, 34, [0xff8fb1, 0xffd23a, 0x5fd6c4, 0xffffff], 4.5, 3, 0.9, 6, -SP); }
        else { AU.voice('gym_miss'); EK.UI.pop('괜찮아요! 다음에 또!', 'sm'); this.noBoostUntil = t + 1.2; }   // r5: 실패 글자와 부스트 버튼·글자가 같은 순간에 안 나오게
        g.success = ok;
      }
      if (g.done && t > last.t + 1.3) {
        EK.UI.gym(null); this.gi++; for (const c of this.comps) c.act = 'run';
        if (this.boostHold) { const h = this.boostHold; this.boostHold = 0; this.startBoost(t, h, false); }   // 미뤄 둔 부스트를 이어서
        return;
      }
      if (t < g.moves[0].t - per * 4.2) { EK.UI.gym(null); if (!g.carded) { g.carded = true; EK.UI.clearPop(); EK.UI.card('체조 시간!', g.name.replace('!', '') + ' · 그림을 따라 해요', 'gym'); this.cardUntil = this.clock + 9; AU.sfx('cue'); AU.voice('gym_card'); } return; }
      if (this.cardUntil) { EK.UI.card(null); this.cardUntil = 0; }   // 체조 그림이 나오면 안내 카드는 치움(겹치지 않게)
      // r5 구령: 「하나, 둘!」 → 동작마다 그 박자 조금 앞에 「점프!」「왼쪽!」… (글자와 같은 말)
      if (!g.counted) { g.counted = true; AU.voice('count'); }
      const lead = Math.min(per * 3.2, Math.max(per * 1.8, 1.0));   // r7: 구령을 동작 약 1초 전에(말이 끝나고 0.4초 넘게 남음)
      for (const mv of g.moves) if (!mv.said && mv.res === 0 && t >= mv.t - lead) { mv.said = true; AU.voice(mv.kind); }
      const m = cur || last, k = clamp((m.t - t) / (per * 4), 0, 1);
      EK.UI.gym({ title: g.name, kind: m.kind, ring: 1 + k * 0.5, good: m.res === 1, praise: m.praise, dots: g.moves.map(x => x.res), curI: g.moves.indexOf(m), done: g.done });
    },

    // r8 운동장 그대로 멈춰라: 「그-대-로」 신호등(초·노·빨) → 판정 창 직전에 빨간 손바닥 버튼 「통」 → 「라」 끝(B+12.5)에서 곡이 실제로 멈춤(AU.hold) → 조용히 쉬움 3초·도전 2.5초 → 이어 틂
    beginFreeze(fz) {
      const t = this.t;
      this.F = { fz, iceV: this.fi % 3, phase: 'lead', light: -1, btnShown: false, btnAt: Math.max(fz.win[0] - 0.1, fz.t + this.chart.per * 1.34) /* r8b: 빨간 점(「로」)보다 먼저 뜨지 않게 */, tapped: false, failed: false, tapT: 0, over: false, ok: false, holdClock: 0, winEndClock: 0, quietEnd: 0, msg: '', stale: false, endAt: 0 };
      if (t < this.boostUntil) { this.boostHold = Math.max(0, this.boostUntil - t); this.boostUntil = -9; this.boostMagHold = this.boostMag; this.boostMag = false; EK.UI.boost(false); EK.UI.boostEnding(false); }   // 부스트는 멈춰라 뒤로 미룸
      this.readyAt = null; EK.UI.boostBtn(false); EK.UI.card(null); this.cardUntil = 0; EK.UI.hint(null); this.hintUntil = 0; EK.UI.cue(null); this.cue = null; EK.UI.clearPop();
      EK.UI.padOn(true, true);   // ▼▲·부스트 숨김, ◀▶만
      EK.UI.stop({ msg: '', light: 0, btn: false, st: 'wait' });
    },
    updateFreeze(dt) {
      const F = this.F, fz = F.fz, t = this.t, per = this.chart.per;
      if (F.over) { if (this.clock >= F.endAt) this.endFreeze(); return; }
      if (F.phase !== 'hold') {
        const li = t >= fz.t + per * 1.34 ? 2 : t >= fz.t + per * 0.67 ? 1 : 0;   // 「그」 초 · 「대」 노 · 「로」 빨
        if (li !== F.light) { F.light = li; AU.sfx('light', li); }
        if (!F.btnShown && t >= F.btnAt) { F.btnShown = true; F.phase = 'window'; AU.sfx('stopIn'); EK.UI.stop({ msg: '', light: li, btn: true, st: 'wait' }); if (EK.UI.stopPressedNow()) this.tapStop(false); }   // 뜨기 전부터 닿아 있던 손가락 → 「손 떼고 다시 톡!」
        if (t >= fz.holdT) {
          F.phase = 'hold'; F.holdClock = this.clock; F.winEndClock = this.clock + Math.max(0, fz.win[1] + this.extraWin(fz) - fz.holdT); F.quietEnd = this.clock + fz.quiet;
          AU.hold(); this.sub = 'freeze'; this.world.frozen = true; this.P.y = 0; this.P.jumpT = -9; this.P.slideT = -9; for (const c of this.comps) c.act = 'ice';
          if (F.tapped) this.iceFx();
        }
      }
      if (F.phase === 'hold') {
        if (Math.random() < dt * 11) this.world.spark(this.P.x + (Math.random() - 0.5) * 1.6, 0.5 + Math.random() * 1.7, -SP * this.t - 0.3, 2, [0xffffff, 0xbfeaff, 0x9ff5e0], 0.3, 0.45, 0.85, 0.6);   // r8c: 반짝이 조금 더 많이·크게(검토 B 3)   // r8b: 멈춘 동안 몸 둘레 얼음 반짝이(「멈췄다」가 보이게)
        if (!F.tapped && !F.failed && this.clock >= F.winEndClock) this.failFreeze('앗, 못 멈췄어요!');
        if (this.phase === 'play' && this.clock >= F.quietEnd) return this.finishFreeze(!F.failed && F.tapped);
      }
      if (this.phase === 'play') EK.UI.stop({ msg: F.msg, light: F.light, btn: F.btnShown, st: F.tapped && !F.failed ? 'ok' : F.failed ? 'no' : 'wait', hold: F.phase === 'hold' });
      this.syncHud();
    },
    // 놓침·너무 빠름(도전)·조용할 때 움직임(도전): 하트 −1(쉬움 첫 멈춰라는 연습이라 그대로) + 호루라기 「삐익~」 + 글자. 하트 0 → 다시 하기
    failFreeze(why) {
      const F = this.F, fz = F.fz; if (F.failed) return; F.failed = true; F.msg = '';
      this.failN[fz.id] = (this.failN[fz.id] || 0) + 1;
      AU.sfx('whistle'); buzz('ouch'); EK.UI.pop(why, 'p'); this.combo = 0; AU.voice(FAIL_VO[why] || 'miss_stop', { cut: true });   // r8c: 글자 = 꼬마 쎌 목소리
      if (!fz.practice && !fz.guide && !this.god) { this.hearts--; this.hits++; if (this.hearts <= 0) { fz.done = true; fz.result = -1; this.fi++; this.loseWhy = 'freeze'; this.lose(); } }
    },
    finishFreeze(ok) {
      const F = this.F, fz = F.fz, P = this.P; F.over = true; F.ok = ok; fz.done = true; fz.result = ok ? 1 : -1; this.fi++;
      if (ok) { this.missions++; this.score += 500; this.energy = Math.min(1, this.energy + 0.3); AU.sfx('win'); AU.sfx('cheer'); buzz('freeze_ok'); AU.voice('freeze_ok', { cut: true }); EK.UI.pop('모두 멈췄다! 성공!', 'y'); this.cheerUntil = this.clock + 1.2; this.noBoostUntil = this.t + 0.7; this.world.spark(P.x, 3.0, -SP * this.t - 3, 44, [0xffffff, 0xbfeaff, 0xffd23a, 0x9ff5e0], 6, 4, 1.1); }
      else AU.sfx('soft');
      F.endAt = this.clock + 0.35; AU.release(0.35);
      EK.UI.stop({ msg: '', light: 2, btn: F.btnShown, st: ok ? 'ok' : 'no', hold: true, over: true });
    },
    endFreeze() {
      this.sub = null; this.F = null; EK.UI.stop(null); EK.UI.padOn(true); for (const c of this.comps) c.act = 'run'; this.P.inv = this.t + 1.0; this.world.frozen = false;
      if (this.boostHold) { const h = this.boostHold; this.boostHold = 0; this.boostMag = !!this.boostMagHold; this.boostMagHold = false; this.startBoost(this.t, h, false); }   // r8c: 톡 부스트(자석)는 자석도 같이 이어 감
    },

    lose() {
      this.phase = 'lose'; this.endClock = 0; this.won = false; this.loseT = this.F ? this.F.fz.t : this.t; this.retryShown = false;   // loseT: 멈춰라에서 졌으면 그 멈춰라가 든 구간(노래 구간)부터
      // r8b: 하트 0 순간 화면 정리(r8 에서 주석 뒤에 붙어 꺼졌던 줄 복구) — 카드·도움말·체조 판·부스트·버튼·커서 전부 치움
      EK.UI.boost(false); EK.UI.gym(null); EK.UI.card(null); EK.UI.hint(null); EK.UI.cue(null); EK.UI.boostBtn(false); EK.UI.boostEnding(false); EK.UI.count(null); this.readyAt = null; this.cardUntil = 0; this.hintUntil = 0; this.boostUntil = -9; this.boostHold = 0; EK.UI.padOn(false);
      this.sub = null; this.F = null; EK.UI.stop(null); this.world.frozen = false; for (const c of this.comps) c.act = 'run';
      if (AU.held) AU.stopMusic(); else AU.fadeOut(1.2);
      EK.UI.clearPop(); EK.UI.lose(true); AU.voice('lose', { cut: true }); this.syncHud(true);   // 또렷한 띠 글자 「다시 힘내 보자!」 → 1.2초 뒤 다시 하기 카드
    },
    showResult(win) {
      if (this.phase === 'result') return;
      this.phase = 'result'; EK.UI.finale(false); EK.UI.hud(false);
      const C = this.chart, pct = C.total ? this.orbs / C.total : 0;
      // 별: 완주 1 + 구슬 55% 1 + (구슬 80%·부딪힘 1번 이하) 1. 쉬움에서 쉬어 간 횟수만큼 줄지만 완주하면 1개는 꼭.
      const base = 1 + (pct >= 0.55 ? 1 : 0) + (pct >= 0.8 && this.hits <= 1 ? 1 : 0);
      let stars = win ? Math.max(1, base - this.rests) : 0;
      const noStop = win && this.stage.id === 'school' && C.freezes.length && !C.freezes.some(f => f.result === 1);   // r8b: 운동장에서 멈춰라를 한 번도 성공 못 하면 별 최대 1 + 안내
      if (noStop) { stars = Math.min(stars, 1); this.loseWhy = 'nostop'; }
      const S = EK.save, key = this.stage.id + '_' + this.diff, before = EK.UI.unlockedCount();
      S.plays++; if (win) S.clears++; S.orbs += this.orbs; S.dist += Math.round(Math.max(0, this.t) * SP / 3); S.missions += this.missions; S.stars += stars;
      S.best[key] = Math.max(S.best[key] || 0, this.score); S.bestStars[key] = Math.max(S.bestStars[key] || 0, stars); S.diff = this.diff; S.stage = this.stage.id; S.tutorial = true;
      const sess = S.sess && Date.now() - S.sess.at < 30 * 60000 ? S.sess : { sec: 0 }; sess.sec += this.playSec; sess.at = Date.now(); S.sess = sess; this.playSec = 0;
      EK.store();
      const after = EK.UI.unlockedCount();
      this.last = { diff: this.diff, win, stars, tapped: this.tapped, orbs: this.orbs, total: C.total, pct, score: this.score, missions: this.missions, missionN: C.missionN || 3, hits: this.hits, rests: this.rests, dist: Math.round(Math.max(0, this.t) * SP / 3), newSticker: after > before ? after - 1 : -1, why: this.loseWhy };
      this.loseWhy = null;
      if (win) AU.sfx('star');
      EK.UI.result(this.last);
      if (sess.sec >= 40 * 60) EK.UI.show('rest', true);   // 40분 놀면 쉬어 가기 안내 (대표 원 지시)
    },

    // ---------- 자동 플레이 (시험용) ----------
    botThink(t) {
      const mode = this.bot, C = this.chart, P = this.P; if (mode === 'idle') return;
      if (this.F) { const F = this.F, fz = F.fz;   // r8: 잘하는 봇은 판정 창 0.15초 뒤 톡, 서툰 봇(kid 15%·sloppy 30%)은 가끔 놓침, late 는 안 누름, moved 는 멈춘 뒤 움직임
        if (F.btnShown && !F.tapped && !F.failed && !F.over && mode !== 'late') { const h = Math.abs(Math.sin(fz.t * 91.7 + this.seed) * 43758.5) % 1, skip = (mode === 'sloppy' && h < 0.3) || (mode === 'kid' && h < 0.15); const d = mode === 'good' || mode === 'moved' ? 0.15 : 0.5; if (!skip && (t >= fz.win[0] + d || (F.phase === 'hold' && this.clock >= F.holdClock + 0.2))) this.tapStop(true); }
        if (mode === 'moved' && F.phase === 'hold' && this.clock - F.holdClock > 0.6) this.input('left');
        if (this.sub === 'freeze') return; }
      if (this.readyAt != null && mode !== 'sloppy' && this.clock - this.readyAt > (this.botBoostWait || (mode === 'kid' ? 1.0 : 0.35))) this.tapBoost();   // 잘하는 봇·서툰 봇은 부스트 버튼을 누름(30% 놓치는 봇은 안 누름)
      const g = C.gyms[this.gi]; if (g && !g.done) for (const m of g.moves) if (m.res === 0 && t >= m.t - 0.02 && t <= m.t + 0.2) { if (mode === 'good' || mode === 'nofriend' || mode === 'late') this.input(m.kind); else if (((m.t * 7) | 0) % 2) this.input(m.kind); }
      // 다음 장애물 묶음
      let tg = null; const grp = [];
      for (let i = this.bc; i < C.obs.length; i++) { const o = C.obs[i]; if (o.t <= t - 0.16 || o.hit) continue; if (tg == null) { if (o.t - t > 1.1) break; tg = o.t; } if (Math.abs(o.t - tg) < 0.01) grp.push(o); else break; }
      let want = P.lane;
      const hsh = tg == null ? 0 : Math.abs(Math.sin(tg * 91.7 + this.seed) * 43758.5) % 1, skip = tg != null && ((mode === 'sloppy' && hsh < 0.3) || (mode === 'kid' && hsh < 0.15));
      if (tg != null && !skip) {
        const at = l => grp.find(o => o.lane === l), mine = at(P.lane), dtg = tg - t;
        if (mine && mine.kind === 'block') { const opts = [0, 1, 2].filter(l => !at(l) || at(l).kind !== 'block').sort((a, b) => (Math.abs(a - P.lane) + (at(a) ? 0.5 : 0)) - (Math.abs(b - P.lane) + (at(b) ? 0.5 : 0))); if (opts.length) want = opts[0]; }
        else if (mine && (mine.kind === 'low' || mine.kind === 'mover')) { if (dtg < 0.26 && P.y < 0.05) this.input('jump'); }
        else if (mine && mine.kind === 'high') { if (dtg < 0.24 && t - P.slideT > SLIDE - 0.2) this.input('slide'); }
        if (want === P.lane && (!mine) && dtg > 0.5) want = this.botOrbLane(t, grp, tg);
      } else if (tg == null) want = this.botOrbLane(t, grp, tg);
      if (want !== P.lane && this.clock - this.botMove > 0.11) { this.botMove = this.clock; this.input(want < P.lane ? 'left' : 'right'); }
      // 높이 뜬 구슬은 점프로
      if (P.y < 0.05 && mode === 'good') for (let i = this.oc; i < C.orbs.length; i++) { const o = C.orbs[i]; if (o.t > t + 0.3) break; if (!o.got && o.y > 1.9 && o.lane === P.lane && o.t - t < 0.27 && o.t > t) { this.input('jump'); break; } }
    },
    botOrbLane(t, grp, tg) {
      const C = this.chart, P = this.P;
      for (let i = this.oc; i < C.orbs.length; i++) { const o = C.orbs[i]; if (o.t < t + 0.12) continue; if (o.t > t + 0.8) break; if (o.got) continue;
        if (tg != null && grp.some(b => b.lane === o.lane && (b.kind === 'block' || b.kind === 'mover'))) continue; return o.lane; }
      return P.lane;
    },

    // ---------- 화면 ----------
    syncHud(force) {
      const C = this.chart; EK.UI.setHearts(this.hearts); EK.UI.setGauge(this.boostHold ? this.boostHold / this.boostLen : this.energy, this.t < this.boostUntil || !!this.boostHold); EK.UI.setOrbs(this.orbs); EK.UI.setProg(clamp(this.t / C.finishT, 0, 1));
    },
    // 쎌 인형: 카메라 앞에 붙어 화면 아래에서 크게 올라옴 → 외친 뒤 왼쪽 아래로 비켜서 지켜봄
    // r8 쎌(구령대 체육 선생님) 인형: 곡이 멈춘 동안 왼쪽 아래(◀▶ 위)에서 지켜보다 성공하면 손팻말을 번쩍(「얼음!」은 글자+효과음, 목소리 없음)
    drawSsel(dt) {
      const S = this.ssel; if (!S) return;
      const F = this.F, show = !!F && F.phase === 'hold' && this.phase === 'play';
      this.sk = lerp(this.sk, show ? 1 : 0, Math.min(1, dt * (show ? 7 : 5)));
      if (!show && this.sk < 0.02) { S.group.visible = false; return; }
      const d = 3.0, hh = Math.tan(camera.fov * Math.PI / 360) * d, hw = hh * camera.aspect;
      const sc = hh * 0.62 / 1.75;
      S.group.visible = true; S.group.scale.setScalar(sc);
      S.group.position.set(-Math.min(hw * 0.56, 2.3), -hh * 0.5 - (1 - EK.smooth(clamp(this.sk, 0, 1))) * hh * 1.2, -d);
      S.group.rotation.set(0, 0.4, 0);
      S.update(dt, { action: show && F.ok ? 'shout' : 'calm' });
    },
    draw(dt) {
      const W = this.world; if (!W) return;
      if (this.phase === 'title' || this.phase === 'select' || this.phase === 'loading' || this.phase === 'boot') {
        this.tt = (this.tt || 0) + dt;
        if (this.player) { this.player.update(dt, { action: 'wave' }); this.comps.forEach((c, i) => c.update(dt, { action: 'dance', phase: this.tt * 2.2 + i * 0.5 })); }
        const land = camera.aspect > 1;
        camera.position.set(Math.sin(this.tt * 0.3) * 0.4, land ? 1.5 : 1.55, land ? 4.6 : 4.5); camera.lookAt(0, land ? 1.15 : 0.62, 0);
        if ((this.phase === 'title' || this.phase === 'select') && AU.ctx && AU.ctx.state === 'running' && !EK.paused) AU.jingle(true);
        if (this.ssel) this.ssel.group.visible = false;
        W.update(camera, 0, this.tt, dt, this.tt * 2.2, false); return;
      }
      const P = this.P, t = this.t, st = this.stage, C = this.chart, per = C.per, F = this.F;
      let pz = -SP * t; const onStage = pz < W.stageZ + 6.2; if (pz < W.stopZ) pz = W.stopZ;
      const arrived = pz <= W.stopZ + 0.01, beat = (t - st.offset) / per, boost = t < this.boostUntil && this.phase === 'play';
      const pl = this.player, frozen = this.sub === 'freeze' && F && F.phase === 'hold', resting = false;
      let act = 'run', k = 0, phase = beat, look = 0;
      // r3 얼굴: 출발 전·체조 중·결승에서는 정면을 봄. 체조 중엔 친구들도 정면을 보고 먼저 보여 줌
      const ready = t < -1.0 && this.phase === 'play', gymFace = this.phase === 'play' && !this.sub && this.gymLock() && t >= 0;
      if (this.phase === 'lose') { act = 'surprise'; }
      else if (frozen) act = 'ice';
      else if (t - P.hitT < 0.55) { act = 'hit'; k = (t - P.hitT) / 0.55; }
      else if (arrived && this.phase === 'finale') act = 'win';
      else if (P.y > 0.05) act = gymFace ? 'gymUp' : 'jump';   // r5: 체조 중 점프는 정면 만세 폴짝(점프 클립은 뒤로 돌아 보이던 것)
      else if (t - P.slideT < SLIDE) act = gymFace ? 'gymDown' : 'slide';   // r4: 체조 중 ▼ 는 미끄러지기 대신 체조 「쪼그리기」 자세(라온 3D 의 미끄러지기는 옆으로 눕는 동작이라 체조처럼 안 보임)
      else if (t < P.gymUntil) act = P.gymAct;
      else if (gymFace) act = 'bounce';
      else if (ready) act = 'wave';
      // 구슬을 줄줄이 먹는 중이면 가끔 고개를 돌려 옆얼굴을 보여 주고, 구슬 20개마다 뒤돌아 활짝 웃음
      let turn = 0;
      if (act === 'run' && this.phase === 'play' && !this.sub) {
        if (this.clock < this.glanceUntil) { look = -1.35 * this.glanceDir; turn = 1.45 * this.glanceDir; }   // 몸 1.45 + 고개 1.35 = 거의 카메라 쪽
        else if (this.combo >= 8) { const b4 = beat / 4, f = b4 - Math.floor(b4); if (f < 0.42) look = (Math.floor(b4) % 2 ? 1 : -1) * 1.0; }
      }
      const by = onStage ? 0.45 : 0, ry0 = resting ? 0.5 + Math.sin(this.clock * 3) * 0.06 : 0;
      pl.group.position.set(P.x, by + ry0, pz);
      const tx = (P.lane - 1) * LW;
      const front = (arrived && this.phase === 'finale') || t < P.faceUntil || resting || ready || gymFace;
      const ry = front ? 0 : Math.PI - turn - clamp((tx - P.x) * 0.45, -0.6, 0.6); this.pry = lerp(this.pry, ry, Math.min(1, dt * (t < P.faceUntil + 0.4 ? 12 : 8)));
      // 빙글 점프: 뛰는 동안 한 바퀴 돌아 얼굴이 보임(중간에 숙여 내려오면 남은 바퀴를 재빨리 마저 돎)
      const jk = (t - P.jumpT) / JUMP;
      if (jk >= 0 && jk < 1 && P.dropT <= P.jumpT && this.phase === 'play' && !this.sub && !gymFace) this.spin = TAU * EK.smooth(jk);   // r5: 체조 중엔 빙글 안 돎(만세 폴짝 자세가 정면으로 보이게)
      else if (this.spin > 0) { this.spin += dt * 22; if (this.spin >= TAU) this.spin = 0; }
      pl.group.rotation.y = this.pry + this.spin;
      this.ps = lerp(this.ps, boost ? 1.15 : 1, Math.min(1, dt * 6)); pl.group.scale.setScalar((pl.spec ? pl.spec.s : 1) * this.ps);
      pl.update(dt, { action: act, phase, y: gymFace ? P.y * 0.1 : P.y, k, look, v: frozen ? F.iceV : 0, happy: this.clock < this.glanceUntil || boost });   // r8b: 얼음 자세 종류(v)
      // 무적 중엔 살짝 투명하게 깜빡 (1초에 약 2.5번, 부드럽게)
      pl.group.visible = true; const blink = t < P.inv && this.phase === 'play' && !this.sub && !resting ? 0.82 + Math.sin(t * 16) * 0.18 : 1; pl.inner.scale.x = pl.inner.scale.z = blink;
      W.bubble.visible = resting; if (resting) { W.bubble.position.set(P.x, by + ry0 + 0.85, pz); W.bubble.scale.setScalar(1.25 + Math.sin(this.clock * 3) * 0.04); }
      // 같이 달리는 친구
      const cheer = this.clock < this.cheerUntil;
      this.comps.forEach((c, i) => {
        this.cx = lerp(this.cx == null ? 2.7 : this.cx, this.sub === 'freeze' ? (camera.aspect < 1 ? 1.5 : 2.0) : 2.7, Math.min(1, dt * 6));   // r5: 세로 폰 멈춰라 땐 친구를 안쪽으로(톡 할 친구가 화면 끝에 잘리지 않게)
        const fin = this.phase === 'finale', fu = fin ? EK.smooth(clamp(this.endClock / 1.2, 0, 1)) : 0;
        const sx = c.side * lerp(this.cx + (c.isShark ? 0.1 : 0), camera.aspect > 1 ? 3.4 : 2.15, fu);   // 결승에서는 화면 안으로 모임 (r6 가로: 옆이 넓어 바깥쪽에 — 얼굴이 서로 안 붙게)
        let cz = Math.max(pz - (c.isShark ? (camera.aspect < 1 ? 4.6 : 2.4) : 3.2), W.stopZ - 1.2)   /* r5: 세로 폰은 카메라가 가까워져 상어를 조금 앞으로(화면 끝에 반쯤 잘리지 않게) */, cy = c.isShark ? lerp(1.75, 3.3, fu) + Math.sin(this.clock * 1.5 + i) * 0.2 : (cz < W.stageZ + 6.2 ? 0.45 : 0);   // 결승에서 상어는 친구들 머리 위로 떠오름(가리지 않게)
        c.group.position.set(sx, cy, cz);
        let a = fin && arrived ? 'win' : ready ? 'wave' : cheer && !this.sub ? 'win' : c.act || 'run';
        if (a === 'run' && gymFace) a = 'bounce';
        if (a === 'ice' && c.isShark) a = 'freeze';
        const face = (fin && arrived) || (cheer && !this.sub) || ready || gymFace;
        const bs = boost ? 1.1 : 1; c.bs = lerp(c.bs || 1, bs, Math.min(1, dt * 6)); c.group.scale.setScalar((c.isShark ? 1.35 : (c.spec ? c.spec.s : 1)) * c.bs);
        c.group.rotation.y = lerp(c.group.rotation.y, face ? 0 : Math.PI, Math.min(1, dt * 8));
        c.update(dt, { action: a, phase: a === 'run' && this.sub === 'freeze' ? this.clock * 2.6 : beat + i * 0.5, v: i + 1 });
      });
      const near = pz < W.stageZ + 130;
      for (let i = 0; i < this.friends.length; i++) { const d = this.friends[i]; d.group.visible = near; if (near) d.update(dt, { action: this.phase === 'finale' ? 'win' : 'dance', phase: beat + i * 0.5 }); }
      // 카메라 (r2: 당겨서 캐릭터를 크게 — r1 높이 4.4·뒤 8.2 → 높이 3.25·뒤 5.1, 캐릭터 키가 화면 높이의 약 18%)
      const land = camera.aspect > 1;
      // r5: 세로 폰은 카메라를 더 가깝고 낮게 → 라온이 화면 높이의 약 19%, 발이 화면 70% 남짓(아래 빈 길 줄임)
      const K = land ? CAM_L : CAM_P;
      let cx = P.x * K.xk, cy = K.y + P.y * 0.2, cz = pz + K.z, lx = P.x * 0.45, ly = K.ly, lz = pz + K.lz;
      if (boost) { cz += (this.boostMag ? 1.9 : 1.3) * (land ? 0.45 : 1); cy += land ? 0.2 : 0.35; }   // r6 가로: 부스트 때 덜 물러남(라온이 너무 작아지지 않게)
      if (this.sub === 'freeze') { cy = 3.0; cz = pz + 5.8; lz = pz - 5; ly = 1.3; cx = 0; lx = 0; }
      if (this.phase === 'finale') { const u = EK.smooth(clamp(this.endClock / 1.6, 0, 1)); cx = 0; lx = 0; cy = lerp(cy, land ? 2.3 : 2.6, u); cz = Math.max(pz, W.stopZ) + lerp(5.1, land ? 5.6 : 6.4, u); ly = lerp(1.5, land ? 2.05 : 2.25, u); lz = pz - 6; }   // r7 가로: 결승 카메라를 낮고 가깝게(무대가 화면 아래까지 차게, 아래 빈 바닥 줄임)
      else if (gymFace) { if (land) { ly = K.ly + CAM_GYM.dly; cy += CAM_GYM.dy; } else { ly = window.innerHeight < 720 ? 3.05 : 2.75; cy += 0.4; } }   // r8f: 가로 체조 카메라는 달리기 카메라(CAM_L)에 맞춰 보는 높이만 조금 올림(옛 ly 2.3 고정값은 r8d·r8e 높은 카메라에서 라온 아래쪽이 화면 밖으로 잘렸음)   // r5: 세로 폰은 라온이 커져서, 체조 땐 화면을 조금 더 위로 보아 폴짝 뛰어도 머리가 체조 그림·점 줄을 안 가림   // 체조: 캐릭터를 화면 아래쪽으로(체조 그림과 안 겹치게)
      const ck = Math.min(1, dt * 9); this.camPos.set(lerp(this.camPos.x, cx, ck), lerp(this.camPos.y, cy, ck), lerp(this.camPos.z - pz, cz - pz, Math.min(1, dt * 5)) + pz); this.camLook.set(lerp(this.camLook.x, lx, ck), lerp(this.camLook.y, ly, ck), lerp(this.camLook.z - pz, lz - pz, ck) + pz);
      camera.position.copy(this.camPos); camera.lookAt(this.camLook);
      const fov = this.baseFov + (boost ? (this.boostMag ? 10 : 6) * (land ? 0.5 : 1) : 0); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 5)); camera.updateProjectionMatrix(); }
      this.drawSsel(dt);
      W.magX = boost && this.boostMag ? P.x : null; W.cullZ = this.phase === 'play' ? pz + 0.7 : null;
      W.update(camera, pz, t, dt, this.sub === 'freeze' ? 0.5 : beat, boost);
    },
  };

  // ---------- 멈춤 ----------
  EK.setPaused = function (on, silent) {
    if (GM.phase !== 'play' && GM.phase !== 'finale' && GM.phase !== 'lose') return;
    if (GM.phase === 'lose' && GM.retryShown) return;   // r8: 다시 하기 카드가 떠 있을 땐 멈춤 창 안 띄움
    EK.paused = on; AU.pause(on); if (!silent) EK.UI.show(on ? 'pause' : null);
  };
  // r6 가로형: 폰을 세로로 들면(「가로로 돌려 주세요」 안내가 뜸) 달리던 판은 잠깐 멈춤. PC(넓은 창)는 안내 없음
  const portQ = EK.portQ = window.matchMedia('(orientation: portrait) and (max-width: 600px)');
  const onPort = () => { if (portQ.matches && !EK.paused && (GM.phase === 'play' || GM.phase === 'finale')) EK.setPaused(true); };
  if (portQ.addEventListener) portQ.addEventListener('change', onPort); else if (portQ.addListener) portQ.addListener(onPort);
  document.addEventListener('visibilitychange', () => { if (document.hidden && !EK.paused && (GM.phase === 'play' || GM.phase === 'finale')) EK.setPaused(true); });
  window.addEventListener('blur', () => { if (!EK.paused && GM.phase === 'play' && !EK.Q.has('noblur') && !GM.bot) EK.setPaused(true); });

  // ---------- 돌리기 ----------
  let last = performance.now(), acc = 0, frames = 0;
  const simSpeed = Math.max(1, EK.Q.num('sim', 1) || 1);
  function tick(dt) {
    if (portQ.matches && !EK.paused && (GM.phase === 'play' || GM.phase === 'finale')) EK.setPaused(true);   // 세로로 든 채 시작돼도 안내 뒤에서 판이 흐르지 않게
    if (EK.paused) return;
    if (GM.phase === 'play' || GM.phase === 'finale' || GM.phase === 'lose') {
      if (AU.sim) { const n = Math.round(simSpeed); for (let i = 0; i < n; i++) { AU.simAdvance(dt); GM.update(AU.songTime(), dt); if (GM.phase === 'result') break; } }
      else GM.update(AU.songTime(), dt);
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (EK.loopOff) return;
    tick(dt);
    if (!EK.paused || GM.phase === 'title') GM.draw(dt);
    renderer.render(scene, camera);
    // 화면이 느리면 해상도를 조금 낮춤
    acc += dt; frames++;
    if (acc >= 1) { GM.fps = Math.round(frames / acc); GM.calls = renderer.info.render.calls; GM.tris = renderer.info.render.triangles; acc = 0; frames = 0;
      if (!EK.paused && DYN.feed(GM.fps)) { pr = DYN.pr; resize(); } else if (EK.paused) DYN.kick(1); }
  }

  // 시험용 창구
  window.__ek = {
    state() { const P = GM.P || {}; return { phase: GM.phase, sub: GM.sub, t: GM.t, hearts: GM.hearts, energy: GM.energy, boost: GM.t < GM.boostUntil, boostHold: GM.boostHold || 0, ready: GM.readyAt != null, mag: !!GM.boostMag, tapped: GM.tapped || 0, score: GM.score, orbs: GM.orbs, total: GM.chart ? GM.chart.total : 0, notes: GM.noteN, missions: GM.missions, hits: GM.hits, rests: GM.rests, bumps: GM.bumps, lane: P.lane, x: P.x, y: P.y, fps: GM.fps, calls: GM.calls, tris: GM.tris, pr, paused: !!EK.paused, audio: AU.ctx ? AU.ctx.state : 'none', mode: AU.mode, last: GM.last, boosts: GM.boosts || 0, glb: !!(GM.player && GM.player.isGlb), snd: GM.snd, sndReal: GM.sndReal, geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures, goT: GM.goT, retries: GM.rests, F: GM.F ? { phase: GM.F.phase, btn: GM.F.btnShown, tapped: GM.F.tapped, failed: GM.F.failed, over: GM.F.over, msg: GM.F.msg, id: GM.F.fz.id } : null, held: AU.held }; },
    async start(stage, diff, opts) { await GM.startRun(stage, diff, opts || {}); return true; },
    step(dt, n) { for (let i = 0; i < (n || 1); i++) { AU.simAdvance(dt); GM.update(AU.songTime(), dt); if (GM.phase === 'result') break; } return this.state(); },
    run(sec) { return this.step(1 / 60, Math.round(sec * 60)); },
    render() { renderer.render(scene, camera); },
    loop(on) { EK.loopOff = !on; }, CAM_P, CAM_L, CAM_GYM, bot(m) { GM.bot = m; }, input(k) { GM.input(k); }, tapStop(f) { return GM.tapStop(f !== false); }, GM, renderer, camera, scene,
  };

  EK.start = function () { GM.boot().then(() => {}); requestAnimationFrame(frame); };
})();
