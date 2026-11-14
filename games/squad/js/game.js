/* GRUNT ZERO RE — 「기계도시 점호」 게임 규칙·진행 (60Hz 고정 걸음, 화면과 분리) + 시험 훅(__gz) */
(function () {
  'use strict';
  const GZ = window.GZ, AU = GZ.AU, FX = GZ.FX, EN = GZ.EN, HUD = GZ.HUD, R = GZ.R, I = GZ.I;
  const G = (GZ.G = {});
  const STEP = 1 / 60, BEAT = AU.BEAT;
  // r2 정박 판정: 이른 쪽 0.06초 / 늦은 쪽 0.11초 (터치는 늘 조금 늦게 들어옴). 판정 시계는 소리 지연(AU.latency)만큼 뺌
  const WIN_EARLY = 0.06, WIN_LATE = 0.11;
  const TAP_GAP = 0.30, TAP_GAP_PERFECT = 0.15;   // 새로 누른 발사의 최소 간격 (정박일 때만 짧게) — 마구 두드리기 막기
  const SLOPPY = 0.35;                            // 엇박에 새로 누르면 이 시간 동안 「정박」이 안 됨 (두드리면 정박이 영영 안 나옴)
  const P = (G.P = {});
  const U = (G.U = {});
  // r5 난이도 2단계 (기본 = 정규). 훈련병: 받는 피해 ×0.5 · 포탑 쉬는 시간 ×1.4 · 보스 체력 ×0.7 · 점호 회복 +45 · 쓰러져도 두 번 다시 일어남
  // r8 (검토 A1): 정규 보스전·크롤러 완화 — 고리 간격 ×1.25 · 고리 속도 ×0.88 · 광선 회전 ×0.85 · 고리 피해 12→7 · 광선 16→10 · 보스 포격 13→11 · 단계 회복 34→40 · 고리 판정 폭 ±0.7→±0.55m · 고리 직전 구르기 인정 2.2→3.0m · 크롤러 탄 16→13·속도 ×0.85 · 크롤러 동시 조준 최대 2기 · 조준선 0.95→1.2초 (사람 흉내 손 시험으로 두 번 더 낮춤)
  const DIFF = { normal: { name: '정규', hurt: 1, turretCd: 1, bossHp: 1, heal: 28, lives: 0, droneSp: 1, ringGap: 1.25, beamSp: 0.85, ringSp: 0.88, ringDmg: 7, beamDmg: 10, aimMax: 2, aimT: 1.2, ringDodge: 3.0, turDmg: 13, turSp: 0.85, volDmg: 11, phaseHeal: 40, ringBand: 0.55 }, easy: { name: '훈련병', hurt: 0.5, turretCd: 1.4, bossHp: 0.7, heal: 45, lives: 2, droneSp: 0.88, ringGap: 1.25, beamSp: 0.85, ringSp: 0.88, ringDmg: 7, beamDmg: 10, aimMax: 2, aimT: 1.2, ringDodge: 3.0, turDmg: 13, turSp: 0.85, volDmg: 11, phaseHeal: 40, ringBand: 0.55 } };
  G.DIFF = DIFF;
  // r7 (검토 B2): 처음 켠 사람(저장된 난이도 없음)은 「훈련병」이 기본 — 초보는 정규에서 2웨이브에 쓰러짐. 시험(auto·seed)은 늘 정규
  G.diff = GZ.Q.diff === 'easy' ? 'easy' : (() => { try { if (GZ.Q.auto || GZ.Q.seedSet) return 'normal'; const v = localStorage.getItem('gzDiff'); return v === 'easy' || v == null ? 'easy' : 'normal'; } catch (e) { return 'normal'; } })();
  G.D = DIFF[G.diff];
  // r9 공격 방식: manual(수동, 지금 그대로) / auto(자동 — 호각을 박자에 맞춰 알아서 불되 박자 보너스·점수는 약하게). 저장 gzre_atk, 시험은 ?atk=auto
  G.atk = GZ.Q.atk === 'auto' || GZ.Q.atk === 'manual' ? GZ.Q.atk : (() => { try { return GZ.Q.auto || GZ.Q.seedSet ? 'manual' : localStorage.getItem('gzre_atk') === 'auto' ? 'auto' : 'manual'; } catch (e) { return 'manual'; } })();
  G.setAtk = function (m) {
    G.atk = m === 'auto' ? 'auto' : 'manual';
    try { if (!GZ.Q.auto) localStorage.setItem('gzre_atk', G.atk); } catch (e) { /* 저장 안 되는 곳 */ }
    if (G.atk === 'auto' && stats && G.playing()) stats.autoUsed = true;   // 한 판 중에 한 번이라도 자동이면 결과에 「자동」
    if (GZ.HUD && GZ.HUD.atk) GZ.HUD.atk(G.atk);
  };
  const AUTO = { beatMul: 1.9, beatUp: 0.3, pts: 0.85 };   // 자동 박자 발사 위력(수동 정박 2.5~3.75배 대신 1.9배)·보급「정박 훈련」 몫 30%·점수 ×0.85
  G.AUTO = AUTO;
  G.setDiff = function (d) { G.diff = d === 'easy' ? 'easy' : 'normal'; G.D = DIFF[G.diff]; try { localStorage.setItem('gzDiff', G.diff); } catch (e) {} };
  // r5 멈칫(히트스톱): 큰 순간(처치·정박 처치·차렷·궁극기·맞음)은 늘, 보통 타격은 쿨다운(0.4초) 뒤에만. 멈칫 중에도 주인공 이동·입력은 그대로
  let hsNext = 0; G.hsFrames = 0; G.hsSteps = 0;
  function hitStop(v, force) { if (force || G.bt >= hsNext) { G.hitstop = Math.max(G.hitstop, v); if (!force) hsNext = G.bt + v + 0.4; } }
  G.hitStop = hitStop;
  // 진동(햅틱) — js/haptics.js. 짧고 또렷하게, 연발 금지(최소 간격 45ms·우선순위). 정박 톡은 누른 순간(판정 순간) 바로
  const HAPS = {
    beat: [[8], [12], [16], [20], [20]],              // 정박 명중: 연속(×1~×5)일수록 살짝 굵게
    beat5: [[22, 45, 30], 2],                          // 「정박 ×5」 연속 보상: 톡-톡
    kill: [[24], 1],                                   // 기계 처치
    skill: [[60], 3],                                  // 「차렷!」 발 쾅
    ult: [[90, 40, 60, 40, 130], 5],                   // 「전체 기상!」 터지는 순간
    hurt: [[40, 55, 40], 4],                           // 맞음: 두 번
    revive: [[30, 60, 30], 4],                         // 훈련병 다시 일어남
    down: [[150, 70, 150], 6],                         // 쓰러짐
    bossIn: [[60, 60, 110], 4],                        // 보스 솟아오름
    bossPhase: [[80, 50, 80, 50, 120], 5],             // 보스 단계 전환
    bossDie: [[120, 60, 90, 60, 90], 6],               // 보스 처치
    toggle: [[30], 1],                                 // 진동 켜기 확인
  };
  const HAP = GZ.HAP = function (name, lv) {
    const H = window.GZHaptics; if (!H) return false;
    try {
      if (name === 'beat') return H.play('beat' + (lv || 1), HAPS.beat[Math.max(0, Math.min(4, (lv || 1) - 1))], 1);
      const d = HAPS[name]; return d ? H.play(name, d[0], d[1]) : false;
    } catch (e) { return false; }
  };
  if (window.GZHaptics) window.GZHaptics.init({ key: 'gzre_haptics', maxSeg: 150, maxTotal: 420, minGap: 45 });
  G.phase = 'loading'; G.paused = false; G.t = 0; G.bt = 0; G.pt = 0; G.combo = 0; G.comboT = 0;
  G.waves = []; let wavesFx = [];
  let stats, ult = null, wave = null, cardList = null, botMode = GZ.Q.auto, botT = 0, botState = {}, testInput = null, hintStage = 0;
  // r3 안내: 한 번씩만, 차례로 (첫 30초)
  let hintSeen = {}, hintQ = [], hintCur = null, hintGap = 0, hintForce = false, offT = -9, rangeT = -9, cutT = 0, camOX = 0, camOZ = 0, yawMove = false, yawV = 0;
  let leadX = 0, leadZ = 0, leadTX = 0, leadTZ = 0;   // r9: 가는 쪽으로 앞서 보는 카메라 (m)
  let leadVX = 0, leadVZ = 0, leadHold = 0, leadBack = true, leanX = 0, leanZ = 0;   // r9b: 감쇠 스프링 속도·멈춘 뒤 기다림·보스 중점 기울임
  const VO = () => GZ.VO;
  function say(n) { const v = VO(); return v ? v.say(n) : false; }
  // r4 안내: 대기 줄을 비우지 않음. 하나는 최소 3초 보여 주고, 6초에 하나까지만. 급한 안내(pri: 궁극기 준비·보스 고리)는 줄 맨 앞에 서되 지금 것이 3초를 채운 뒤에 뜸
  G.hintLog = [];
  const hintsOn = () => hintForce || !(GZ.Q.auto || botMode);
  function tip(key, txt, dur, pri, sticky, now) {
    if (!hintsOn() || hintSeen[key]) return; hintSeen[key] = 1;
    const h = { key, txt, dur, pri: !!pri, sticky: !!sticky, t: 0, now: !!now };   // r8: now = 지금 안내가 3초를 안 채웠어도 바로 자리를 받음 (포탑 첫 조준)
    if (pri) { let i = 0; while (i < hintQ.length && hintQ[i].pri) i++; hintQ.splice(i, 0, h); } else hintQ.push(h);
  }
  function hintShow(h) { hintCur = h; h.t = 0; HUD.hint(h.txt, h.dur + 0.3); h.log = { key: h.key, at: +stats.time.toFixed(2), shown: 0 }; G.hintLog.push(h.log); if (!h.quick) hintGap = 6; }
  function hintDrop(requeue) { const h = hintCur; hintCur = null; if (!h) return; HUD.hintOff(); if (requeue && (h.sticky || h.t < 3) && !h.quick) { h.t = 0; let i = 0; while (i < hintQ.length && hintQ[i].pri) i++; hintQ.splice(i, 0, h); } }
  function tipStep(dt) {
    hintGap -= dt;
    if (hintCur) {
      const h = hintCur; h.t += dt; if (h.log) h.log.shown = +h.t.toFixed(2);
      if (h.t >= h.dur) hintCur = null;
      else if (hintQ.length && hintQ[0].pri && (hintQ[0].now ? h.t >= 0.6 : !h.pri && h.t >= 3)) hintDrop(h.sticky || hintQ[0].now);   // 급한 안내에 자리를 내줌 (3초는 채운 뒤)
    }
    if (!hintCur && hintQ.length && (hintGap <= 0 || hintQ[0].pri)) hintShow(hintQ.shift());
  }

  const WAVES = [
    { name: 'WAVE 1', sub: '톱니 드론 편대', lvl: 1, groups: [[0, 'drone', 3], [4, 'drone', 3], [9, 'turret', 1], [9.5, 'drone', 4], [16, 'drone', 4], [16.5, 'turret', 1], [23, 'drone', 5], [30, 'drone', 5], [30.5, 'turret', 1], [37, 'drone', 5], [37.5, 'turret', 1], [44, 'drone', 6], [51, 'drone', 6]] },   // r4: 무리 2개 추가 (쉬운 1웨이브에서 더 오래 익히게)
    { name: 'WAVE 2', sub: '방패 기계병 · 피스톤 브루트', lvl: 2, groups: [[0, 'shield', 2], [0.5, 'drone', 3], [7, 'turret', 1], [7.5, 'drone', 4], [15, 'shield', 2], [15.5, 'drone', 5], [23, 'turret', 1], [20, 'brute', 1], [23.5, 'drone', 5], [31, 'shield', 2], [31.5, 'drone', 5], [39, 'turret', 1], [39.5, 'drone', 6], [44, 'brute', 1], [47, 'shield', 2], [47.5, 'drone', 5], [55, 'shield', 2], [55.5, 'drone', 5]] },   // r5: 무리 1개 추가 (한 판 4분)   // r4: 첫 포탑 2 → 1, 무리 2개 추가
    { name: 'WAVE 3', sub: '흡수기 · 메트로놈 출현', lvl: 3, groups: [[0, 'absorber', 1], [0.5, 'drone', 4], [6, 'shield', 2], [6.5, 'turret', 1], [7, 'drone', 4], [10, 'metro', 1], [14, 'absorber', 1], [14.5, 'turret', 1], [15, 'drone', 5], [26, 'metro', 2], [42, 'metro', 2], [58, 'metro', 2], [18, 'brute', 1], [22, 'shield', 2], [22.5, 'drone', 4], [30, 'absorber', 2], [30.5, 'drone', 6], [31, 'turret', 1], [34, 'brute', 1], [38, 'shield', 2], [38.5, 'drone', 4], [46, 'absorber', 1], [46.5, 'turret', 1], [47, 'drone', 6], [50, 'brute', 2], [54, 'shield', 2], [54.5, 'drone', 4], [66, 'brute', 1], [62, 'absorber', 1], [62.5, 'turret', 1], [63, 'drone', 6], [70, 'shield', 2], [70.5, 'drone', 6], [71, 'metro', 1]] },   // r4: 무리 2개 추가
  ];
  for (const w of WAVES) w.groups.sort((a, b) => a[0] - b[0]);   // r5: 새 적(메트로놈)을 끼워 넣어도 시간 순서대로
  const CARDS = [
    { id: 'wide', ico: '폭', name: '넓은 호각', desc: '음파 폭 +30%', max: 3, ap: () => { U.half *= 1.3; } },
    { id: 'beat', ico: '박', name: '정박 훈련', desc: '「정박」 위력 +40%, 판정 조금 넉넉하게', max: 3, ap: () => { U.perfMul += 1.0; U.winE += 0.012; U.winL += 0.012; } },
    { id: 'roll', ico: '구', name: '낙법 숙달', desc: '구르기 재사용 30% 빠르게', max: 2, ap: () => { U.rollCd *= 0.7; } },
    { id: 'skill', ico: '차', name: '칼각 구령', desc: '「차렷!」 재사용 30% 빠르게, 범위 +15%', max: 2, ap: () => { U.skillCd *= 0.7; U.skillR *= 1.15; } },
    { id: 'range', ico: '원', name: '멀리 가는 소리', desc: '음파 사거리 +25%', max: 2, ap: () => { U.range *= 1.25; } },
    { id: 'dmg', ico: '강', name: '쩌렁쩌렁', desc: '모든 호각 위력 +20%', max: 3, ap: () => { U.dmg *= 1.2; } },
    { id: 'hp', ico: '체', name: '전투 식량', desc: '최대 체력 +25, 체력 40 회복', max: 3, ap: () => { P.maxHp += 25; P.hp = Math.min(P.maxHp, P.hp + 40); } },
    { id: 'gauge', ico: '기', name: '기상 나팔', desc: '「전체 기상!」 게이지 30% 빨리 참', max: 2, ap: () => { U.gaugeMul *= 1.3; } },
    { id: 'echo', ico: '메', name: '메아리', desc: '「정박」 음파가 한 번 더 울림(위력 절반)', max: 1, ap: () => { U.echo = 1; } },
  ];

  function resetRun() {
    GZ.seed(GZ.Q.seed);
    Object.assign(U, { half: 0.5, range: 8.5, dmg: 1, perfMul: 2.5, winE: WIN_EARLY, winL: WIN_LATE, rollCd: 1.0, skillCd: 11, skillR: 7.5, gaugeMul: 1, echo: 0, lv: {} });
    Object.assign(P, { x: 0, z: 10.5, vx: 0, vz: 0, face: Math.PI, hp: 100, maxHp: 100, inv: 0, rollT: 0, rollCd: 0, rollDx: 0, rollDz: -1, rollInv: 0, hurtInv: 0, skillCd: 0, skillT: 0, gauge: 0, hitT: 0, down: false, held: false, lastShot: -9, lastQ: -1, sloppyT: -9, streak: 0, streakT: 0, fireDir: Math.PI, moving: 0, win: false, fireV: 0 });
    stats = G.stats = { time: 0, kills: 0, perfect: 0, shots: 0, maxCombo: 0, dmgTaken: 0, blocked: 0, ults: 0, skills: 0, rolls: 0, drained: 0, wave: 0, bossPhase: 0, win: false, by: {}, autoUsed: G.atk === 'auto', autoBeat: 0 };
    P.rollSaid = false; leadX = leadZ = leadTX = leadTZ = leadVX = leadVZ = leanX = leanZ = 0; leadHold = 0; leadBack = true;
    G.t = 0; G.pt = 0; G.combo = 0; G.comboT = 0; G.hitstop = 0; hintSeen = {}; hintQ.length = 0; hintCur = null; hintGap = 0; G.hintLog = []; rangeT = -9; cutT = 0; camOX = camOZ = 0; R.yaw = R.YAW0; yawV = 0; yawMove = false; ult = null; wave = null; cardList = null; G.waves.length = 0; wavesFx.length = 0;
    G.shieldMet = 0; G.nudgeSkill = 0; G.bruteMet = 0;
    I.rollP = I.skillP = I.ultP = false; G.echoQ = null; hsNext = 0; G.hsFrames = 0; G.hsSteps = 0; P.lives = G.D.lives; P.skillWind = 0; G.ultBlocked = 0;   // r5: 메아리 대기 지움(새 판 첫 프레임 헛방 방지)
    EN.reset(); HUD.reset();
    R.setCine(false); R.zoom = 1; R.cutIn(false);
  }

  G.tipArrow = () => { if (stats && stats.time > 30) tip('arrow', '빨간 화살표 = 화면 밖의 적 · 깜빡이면 공격이 온다', 4.5); };
  G.playing = () => !G.paused && ['intro', 'play', 'clear', 'bossIntro', 'boss'].indexOf(G.phase) >= 0;
  G.remaining = function () {
    let n = EN.alive();
    if (wave) for (let i = wave.gi; i < wave.def.groups.length; i++) n += wave.def.groups[i][2];
    return n;
  };

  // ---------- 진행 ----------
  G.toTitle = function () {
    resetRun();
    G.paused = false; G.phase = 'title'; HUD.diff && HUD.diff(G.diff);
    HUD.showHud(false); HUD.screen('title');
    AU.setMode('title'); AU.resume();
    P.x = 0; P.z = 9; P.face = 0.35;
  };
  G.start = function (d) {
    if (d) G.setDiff(d);
    AU.init(); AU.resume();
    resetRun();
    G.paused = false;
    HUD.screen(null); HUD.showHud(true);
    startWave(0);
  };
  function startWave(i) {
    const def = WAVES[i];
    wave = { i, def, t: -1.8, gi: 0 }; G.outW = 0;
    stats.wave = i + 1;
    G.phase = 'intro'; G.pt = 0;
    HUD.wave(def.name); HUD.banner(def.name, def.sub, 1.7);
    AU.setMode('w' + (i + 1));
    if (i === 0) { hintStage = 1; if (G.atk === 'auto') tip('aimAuto', '호각은 자동 — 움직이고 「구르기」·「차렷!」·「전체 기상!」만', 5, true); else tip('aim', GZ.isTouch ? '「호각」을 누른 채 적 쪽으로 끌어라' : '마우스 왼쪽을 누른 채 적을 겨눠라', 40, true, true); }   // 첫 처치까지 유지 (r9 자동: 짧게 한 번)
  }
  // r3: 적은 가능하면 주인공 앞쪽(카메라 시야 안)에서 등장. front = 그렇게 고를 확률
  function inView(x, z) {
    const sy = Math.sin(R.yaw), cy = Math.cos(R.yaw), dx = x - P.x, dz = z - P.z;
    const f = -dx * sy - dz * cy, l = dx * cy - dz * sy;   // 화면 위쪽(앞)·오른쪽 성분
    return f > 2.5 && Math.abs(l) < 1.6 + f * 0.24 ? 1 : 0;
  }
  function spawnGroup(kind, n, lvl, front) {
    const out = [], useFront = front != null && GZ.rand() < front;
    let gates = GZ.AR.gates;
    if (useFront && kind !== 'turret') {
      const vis = gates.filter((a) => inView(Math.sin(a) * (GZ.AR.GATE_R - 2), Math.cos(a) * (GZ.AR.GATE_R - 2)));
      if (vis.length) gates = vis;
      else {   // 보이는 문이 없으면 화면 위쪽에 가장 가까운 문
        let best = null, bs = -1e9; const sy = Math.sin(R.yaw), cy = Math.cos(R.yaw);
        for (const a of gates) { const dx = Math.sin(a) * GZ.AR.GATE_R - P.x, dz = Math.cos(a) * GZ.AR.GATE_R - P.z, sc = (-dx * sy - dz * cy) - Math.abs(dx * cy - dz * sy) * 1.5; if (sc > bs) { bs = sc; best = a; } }
        gates = [best];
      }
    }
    for (let k = 0; k < n; k++) {
      let x, z;
      if (kind === 'turret') {
        for (let tr = 0; tr < 16; tr++) {
          const a = GZ.rand() * GZ.TAU, r = GZ.rr(7, 14);
          x = Math.sin(a) * r; z = Math.cos(a) * r;
          if (useFront && tr < 10 && !inView(x, z)) continue;
          if (Math.hypot(x - P.x, z - P.z) > 6 && !EN.list.some((e) => !e.dead && Math.hypot(e.x - x, e.z - z) < 3.5)) break;
        }
      } else {
        const a = GZ.pick(gates) + GZ.rr(-0.12, 0.12), r = GZ.AR.GATE_R - GZ.rr(0, 1.5);
        x = Math.sin(a) * r; z = Math.cos(a) * r;
      }
      out.push(EN.spawn(kind, x, z, { lvl }));
      if (kind === 'brute' && !G.bruteMet) { G.bruteMet = 1; tip('brute', '피스톤 브루트 — 주먹을 들면(붉은 부채꼴) 옆으로 피하거나 「구르기」', 4.5); }   // r6
      if (kind === 'shield' && !G.shieldMet) { G.shieldMet = 1; G.nudgeSkill = 4.5; tip('shieldMeet', GZ.isTouch ? '방패 기계병! 번쩍이는 「차렷!」 버튼으로 방패째 멈춰라' : '방패 기계병! E 「차렷!」으로 방패째 멈춰라', 4.5); }   // r5 마무리: 첫 방패병 때 「차렷!」 버튼 번쩍임
    }
    return out;
  }
  G.spawnGroup = spawnGroup;
  function waveStep(dt) {
    if (!wave) return;
    wave.t += dt;
    const gs = wave.def.groups;
    if (wave.gi < gs.length && EN.alive() <= (wave.i === 0 ? 1 : 0) && wave.t > 0) wave.t = Math.max(wave.t, gs[wave.gi][0] - 2.6);   // r4: 0.7 → 2.6초 (숨 돌릴 틈)   // 다 치웠으면 다음 무리를 당김 (r4: 1웨이브는 1기만 남아도 — 실력이 시간에 반영되게)
    while (wave.gi < gs.length && wave.t >= gs[wave.gi][0]) {
      const g = gs[wave.gi++], es = spawnGroup(g[1], g[2], wave.def.lvl, wave.i === 0 ? 1 : 0.8);   // r4: 카메라가 안 도는 대신 2·3웨이브도 80%가 앞쪽 시야 안에서 등장
      // r3 첫 30초: 1웨이브 처음 8초 동안은 드론이 돌진하지 않음 (조작을 익힐 틈)
      if (wave.i === 0 && wave.t < 8) for (const e of es) if (e.kind === 'drone') e.cd = 8 - wave.t;
    }
    if (wave.gi >= gs.length && EN.alive() === 0) {
      G.phase = 'clear'; G.pt = 0;
      const heal = G.D.heal + (wave.i === WAVES.length - 1 ? 22 : 0);   // r8 (검토 A1): 보스 앞 마지막 점호는 회복 +22 더 (정규 28 → 50)
      P.hp = Math.min(P.maxHp, P.hp + heal);
      HUD.banner('점호 완료', '체력 +' + heal + ' · 보급을 고른다', 1.5);
      AU.fanfare(true); AU.setMode('break');
      FX.ring(P.x, P.z, 0.5, 6, 0.6, 'gold', 1);
    }
  }
  function openCards() {
    const pool = CARDS.filter((c) => (U.lv[c.id] || 0) < c.max);
    cardList = [];
    while (cardList.length < 3 && pool.length) cardList.push(pool.splice(Math.floor(GZ.rand() * pool.length), 1)[0]);
    G.phase = 'cards';
    HUD.cards(cardList.map((c) => ({ ico: c.ico, name: c.name, desc: c.desc, lv: (U.lv[c.id] || 0) + 1 })));
    I.fire = false; I.mx = I.mz = 0; I.rollP = I.skillP = I.ultP = false; hintDrop(true);   // r4: P.held 는 건드리지 않음 — 손가락이 눌린 채 카드를 고르면 박자를 다시 판정하지 않고 8분음표 연사가 그대로 이어짐
    if (botMode) setTimeout(() => { if (G.phase === 'cards') G.pickCard(0); }, 350);
    G.cardIds = cardList.map((c) => c.id);
  }
  G.pickCard = function (i) {
    if (G.phase !== 'cards' || !cardList || !cardList[i]) return;
    const c = cardList[i];
    U.lv[c.id] = (U.lv[c.id] || 0) + 1; c.ap();
    cardList = null; HUD.screen(null); AU.ui(true);
    I.rollP = I.skillP = I.ultP = false;   // r5: 카드를 고르는 동안 누른 Space·Q 가 다음 웨이브 시작에 나가지 않게
    HUD.restoreHeld();   // 누르고 있던 호각은 그대로 이어짐
    if (wave.i + 1 < WAVES.length) startWave(wave.i + 1); else startBoss();
  };
  function startBoss() {
    wave = null; G.phase = 'bossIntro'; G.pt = 0;
    stats.wave = 4; stats.bossPhase = 1;
    HUD.wave('BOSS'); G.bossBannerAt = 1.5;   // r8 (검토 A4): 배너는 보스 머리가 바닥 위로 올라온 뒤(0.6초쯤)에서 0.5초 더 지나 띄움 — 빈 원판에 배너만 뜨던 것
    AU.setMode('boss'); AU.bossPhase = 1; AU.roar();
    // 플레이어가 해치 위에 있으면 밀어냄
    const d = Math.hypot(P.x, P.z); if (d < 7) { const k = 7 / (d || 1); P.x = (P.x || 0.01) * k; P.z = (P.z || 1) * k; }
    EN.spawn('boss', 0, 0); G.outW = 0;
    if (EN.boss) EN.boss.face = GZ.ang(P.x, P.z);
    HAP('bossIn');   // r7 (검토 B3): 솟아오를 때부터 주인공 쪽(얼굴)을 봄 — 등장 컷에서 등을 보이던 것
    R.shake(0.5);
  }
  G.onBossPhase = function (e, ph) {
    stats.bossPhase = ph;
    AU.bossPhase = ph;
    if (!P.down) { const hh = G.D.phaseHeal || 34; P.hp = Math.min(P.maxHp, P.hp + hh); FX.text(P.x, 2.6, P.z, '체력 +' + hh, 'word', 0.9); }   // r5: 26 → 34 (단계가 4개로 늘어난 만큼)   // r2: 단계를 넘기면 숨 돌릴 틈
    HUD.banner(ph === 4 ? '4단계 · 과열' : ph + '단계', ph === 2 ? '회전 광선 — 따라 돌거나 굴러서 넘는다' : ph === 3 ? '피스톤 낙하 — 멈추지 마라' : '광선과 고리가 함께 온다 — 끝까지 버텨라', 2.0, true, true);   // r8: 화면 아래쪽 (보스 몸을 덮지 않게)
    AU.roar(); R.shake(0.7); R.pulse(0.4); HAP('bossPhase');
    if (GZ.AS) GZ.AS.bossPhase(ph);   // 비서 그런트 무전
    for (let i = 0; i < 3; i++) FX.ring(0, 0, 2, 10 + i * 5, 0.5 + i * 0.15, 'red', 1.4);
    FX.burst(0, 4, 0, 40, 'red', 14, 0.4, 0.8, 2);
    EN.clearShots(0, 0, 99);
    const d = Math.hypot(P.x, P.z);
    if (d < 9) { P.vx += (P.x / (d || 1)) * 16; P.vz += (P.z / (d || 1)) * 16; }
    if (ph === 2) { spawnGroup('drone', 4, 3); spawnGroup('absorber', 1, 3); }
    else if (ph === 3) { spawnGroup('shield', 2, 3); spawnGroup('drone', 4, 3); }
    else { spawnGroup('metro', 2, 3); spawnGroup('drone', 3, 3); }
  };
  G.onBossDying = function (e) {
    if (e) { G.bossX = e.x; G.bossZ = e.z; }
    for (const e of EN.list) if (!e.dead && e.kind !== 'boss') EN.kill(e);
    EN.clearShots(0, 0, 99);
    AU.setMode('end');
    G.phase = 'win'; G.pt = 0; P.inv = 99;
    HUD.banner('침묵 기관 정지', '', 1.6);
    HAP('bossDie');
  };
  G.onBossDead = function () {
    stats.win = true; P.win = true;
    G.bannerAt = 0.9;   // r3: 파편이 가라앉은 뒤에 띄움
    AU.fanfare(true);
    G.pt = 0; G.winT = 3.4;
  };
  function finish(win) {
    G.phase = 'result';
    AU.setMode(win ? 'title' : 'off');
    HUD.showHud(false);
    const s = stats;
    let pts = (win ? 52 : 0) + (s.wave - 1) * 6 + (s.bossPhase || 0) * 3;
    pts += Math.min(14, s.maxCombo / 5) + Math.min(14, s.perfect / 8) + Math.max(0, 14 - s.dmgTaken / 10);
    if (win) pts += Math.max(0, 6 - Math.max(0, s.time - 240) / 20);
    if (s.autoUsed) { pts -= Math.min(14, s.maxCombo / 5) / 2; pts *= AUTO.pts; }   // r9 자동: 콤보 몫 절반(정박 몫은 수동 정박만 세므로 0) + 전체 ×0.85
    let grade = pts >= 90 ? 'S' : pts >= 76 ? 'A' : pts >= 56 ? 'B' : pts >= 34 ? 'C' : 'D';
    if (grade === 'S' && s.dmgTaken > 45) grade = 'A';
    if (grade === 'A' && s.dmgTaken > 120) grade = 'B';   // r3: 많이 맞고 깨면 A 가 아님
    if (!win) EN.hideNear(P.x, P.z, 9);                   // 실패 화면: 주인공 주변 적을 치워 한 컷이 지저분하지 않게
    s.grade = grade; s.points = Math.min(100, Math.round(pts));   // r7 (검토 B): 100점 상한
    // r5 마무리: 난이도별 최고 기록(이 기기에만 저장) + 「다음 목표」 한 줄 — 다시 할 이유
    let best = null, newBest = false;
    const bk = 'gzBest_' + G.diff + (s.autoUsed ? '_auto' : '');   // r9: 자동 기록은 따로
    try { best = JSON.parse(localStorage.getItem(bk) || 'null'); } catch (e) { best = null; }
    if (!best || s.points > best.points) { newBest = !!best; best = { points: s.points, grade, win, time: Math.round(s.time), perfect: s.perfect }; try { if (!GZ.Q.auto && !botMode) localStorage.setItem(bk, JSON.stringify(best)); } catch (e) {} }
    const goal = !win ? (s.wave >= 4 ? '침묵 기관 ' + Math.min(4, (s.bossPhase || 1) + 1) + '단계까지 버티기' : 'WAVE ' + s.wave + ' 넘기기 — 붉은 선·고리는 「구르기」')
      : grade !== 'S' ? 'S 등급 — 받은 피해 45 아래로 (지금 ' + Math.round(s.dmgTaken) + ')'
      : s.dmgTaken > 0 ? '노피격 클리어 — 받은 피해 0' : '정박 ' + (s.perfect + 20) + '회 넘기기';
    s.goal = goal; s.best = best; s.newBest = newBest;
    HUD.result({
      win, grade, auto: !!s.autoUsed,
      sub: win ? '기계도시 1구역 · 침묵 기관 정지' : s.wave >= 4 ? '침묵 기관 ' + (s.bossPhase || 1) + '단계에서 쓰러짐' : 'WAVE ' + s.wave + ' 에서 쓰러짐',
      rows: [['걸린 시간', GZ.fmtTime(s.time)], ['부순 기계', s.kills], ['최대 콤보', s.maxCombo], [s.autoUsed ? '공격' : '정박', s.autoUsed ? '자동 (점수 ×0.85)' : s.perfect + '회'], ['받은 피해', Math.round(s.dmgTaken)], [newBest ? '최고 기록 갱신!' : '최고 기록' + (G.diff === 'easy' ? ' (훈련병)' : '') + (s.autoUsed ? ' (자동)' : ''), best.grade + ' · ' + best.points + '점']],
      goal: '다음 목표: ' + goal,
    });
  }
  G.pause = function (v) {
    if (v && !G.playing()) return;
    if (!v && !G.paused) return;
    G.paused = v;
    if (v && window.GZHaptics) window.GZHaptics.stop();
    if (v && VO()) VO().stop();   // r9: 멈추면 말도 끊음
    HUD.screen(v ? 'pause' : null);
    I.rollP = I.skillP = I.ultP = false;   // r5: 멈춘 동안 누른 Space·E·Q 가 「계속」 순간 구르기·차렷·궁극기로 나가지 않게
    if (v) { AU.suspend(); I.fire = false; I.mx = I.mz = 0; } else { AU.resume(); HUD.restoreHeld(); }
    HUD.paused(v);
  };

  // ---------- 플레이어 ----------
  function comboHit() {
    G.combo++; G.comboT = 2.8;
    if (G.combo > stats.maxCombo) stats.maxCombo = G.combo;
  }
  G._comboHit = comboHit;   // 시험용
  function addGauge(v) { P.gauge = Math.min(100, P.gauge + v * U.gaugeMul); }
  G.drain = function (v) { if (P.gauge > 0) { P.gauge = Math.max(0, P.gauge - v); stats.drained += v; AU.drain(); if (Math.random() < 0.04) FX.text(P.x, 2.3, P.z, '게이지 흡수', 'drain', 0.7); } };
  G.onKill = function (e) {
    stats.kills++; addGauge(e.kind === 'drone' ? 2 : 4);
    if (stats.kills === 1 && hintStage === 1) {   // 첫 처치 → 다음 안내로. r4: 첫 30초는 조준 → 이동 → 정박 3개만
      hintStage = 2;
      if (hintsOn()) { hintDrop(false); hintShow({ key: 'good', txt: '좋다!', dur: 0.8, quick: true, t: 0 }); hintGap = 1.0; }
      tip('move', GZ.isTouch ? '왼쪽 스틱으로 움직이면 돌진을 피한다' : 'WASD 로 움직이면 돌진을 피한다', 4);
      if (G.atk !== 'auto') tip('beat', GZ.isTouch ? '발밑 고리가 번쩍일 때 호각을 다시 누르면 「정박」 — 위력 2.5배' : '발밑 고리가 번쩍일 때 다시 누르면 「정박」 — 위력 2.5배', 6);
    }
  };   // r2: 3/6 → 2/4
  G.hurt = function (dmg, sx, sz, src) {
    if (P.inv > 0 || P.down || G.phase === 'win') return false;
    if (GZ.Q.god || G.god) { P.inv = 0.4; return true; }
    dmg *= G.D.hurt;
    P.hp -= dmg; stats.dmgTaken += dmg; if (src) stats.by[src] = (stats.by[src] || 0) + dmg;
    P.inv = 0.8; P.hurtInv = 0.8; P.hitT = 1; G.combo = 0; P.streak = 0;
    const d = Math.hypot(P.x - sx, P.z - sz) || 1;
    P.vx += ((P.x - sx) / d) * 9; P.vz += ((P.z - sz) / d) * 9;
    FX.text(P.x, 2.4, P.z, '-' + Math.round(dmg), 'hurt', 0.8);
    FX.burst(P.x, 1.2, P.z, 10, 'red', 6, 0.25, 0.35, 1);
    R.shake(0.45); HUD.hurt(); AU.hurt(); hitStop(0.07, true);
    HAP(P.hp <= 0 ? (P.lives > 0 ? 'revive' : 'down') : 'hurt');   // 진동: 맞음 두 번 / 쓰러짐 길게
    if (P.hp <= 0 && P.lives > 0) {   // r5 훈련병: 한 번 다시 일어남 (체력 60, 주변 적 멈춤·탄 지움)
      P.lives--; P.hp = 60; P.inv = 2.6; P.hurtInv = 2.6;
      EN.stunAll(P.x, P.z, 9, 2.4, 1.2); EN.clearShots(P.x, P.z, 99);
      FX.ring(P.x, P.z, 0.6, 9, 0.5, 'gold', 2); FX.burst(P.x, 1, P.z, 30, 'gold', 9, 0.3, 0.6, 3);
      HUD.banner('다시 일어나라!', '훈련병 — 남은 기회 ' + P.lives, 1.6); AU.fanfare(true); stats.revived = (stats.revived || 0) + 1;
      return true;
    }
    if (P.hp <= 0) {
      P.hp = 0; P.down = true; G.phase = 'lose'; G.pt = 0;
      AU.setMode('off'); AU.fanfare(false);
      HUD.banner('작전 실패', '', 1.6, true);
      for (const w of G.waves) for (const a of w.arcs) FX.arcSet(a, 1, 0);
      G.waves.length = 0;
    }
    return true;
  };

  // r8: 판정 글자(정박·엇박·회피) 자리 — 평소엔 머리 위, 보스전엔 주인공 왼쪽 옆 가슴 높이 (보스 몸·얼굴을 덮지 않게)
  const _sp = { x: 0, y: 0, z: 0 };
  function sideP(y) {
    const b = EN.boss;
    if (b && !b.dead && (G.phase === 'boss' || G.phase === 'bossIntro')) { const cy = Math.cos(R.yaw), sy = Math.sin(R.yaw), sd = ((b.x - P.x) * cy - (b.z - P.z) * sy) < 0 ? 1 : -1; _sp.x = P.x + cy * 1.6 * sd; _sp.z = P.z - sy * 1.6 * sd; _sp.y = 1.3; }   // 보스가 화면 왼쪽이면 오른쪽 옆에
    else { _sp.x = P.x; _sp.z = P.z; _sp.y = y == null ? 2.6 : y; }
    return _sp;
  }
  // r4 조준 도움: 끌어 겨눌 때 좌우 0.35rad(20°). 끌지 않을 때는 1웨이브만 1.6rad(92°), 2웨이브부터 0.8rad(46°) — 끄는 쪽이 이득이 되게
  const assistLim = () => (I.aim != null ? 0.35 : stats.wave <= 1 ? 1.6 : 0.8);
  function fireDir() {
    let dir = I.aim != null ? I.aim : P.face;
    let best = assistLim(), to = null;
    for (const e of EN.list) {
      if (e.dead || e.spawnT > 0) continue;
      const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
      if (d > U.range + e.r + 1) continue;
      const off = Math.abs(GZ.angDiff(GZ.ang(dx, dz), dir)) - Math.atan2(e.r * 0.5, d);
      if (off < best) { best = off; to = GZ.ang(dx, dz); }
    }
    return to != null ? to : dir;
  }
  function shoot(kind, autoDir) {   // 0 엇박 · 1 정박자(누르고 있는 중) · 2 「정박!」 · r9 autoDir 가 있으면 자동 공격(박자 발사는 약한 「자동 박자」)
    const auto = autoDir != null;
    const dir = auto ? autoDir : fireDir();
    P.fireDir = dir; P.face = dir; P.lastShot = G.bt; P.fireV = 0.35;
    stats.shots++;
    const drag = I.aim != null;   // r4: 끌어(마우스로) 겨눈 음파는 위력 +15%·사거리 +10%
    let dmg = 10 * U.dmg * (drag ? 1.15 : 1), half = U.half, col = 'gold', pow = 1;
    if (kind === 1) { dmg *= 1.6; pow = 1.25; }   // r2: 1.3 → 1.6 (누르고만 있어도 박자 맛)
    if (kind === 2 && auto) {   // r9 자동 박자: 연속(×N)·정박 횟수·진동·글자·컷인 없음, 위력 1.9배
      dmg *= AUTO.beatMul + (U.perfMul - 2.5) * AUTO.beatUp; pow = 1.15; stats.autoBeat++;   // 게이지는 「누르고 있기」와 같은 몫(정박 게이지 보너스 없음)
      FX.ring(P.x, P.z, 0.6, 1.8, 0.2, 'gold', 0.5);
    } else if (kind === 2) {
      P.streak = Math.min(5, P.streak + 1); P.streakT = 1.3;
      dmg *= U.perfMul * (1 + 0.1 * P.streak); half *= 1.15; col = 'white'; pow = 1.05;
      stats.perfect++; addGauge(1.2);
      { FX.textKill(P.pfTxt); const q = sideP(3.05); P.pfTxt = FX.text(q.x, q.y, q.z, P.streak >= 2 ? '정박 ×' + P.streak : '정박!', 'word', 0.55, true); }   // r8: 새 「정박 ×N」이 뜨면 이전 것 지움, 보스전엔 주인공 옆
      if (P.streak === 5 && G.bt - (P.cutBt || -9) > 6) { P.cutBt = G.bt; cutT = 0.55; }   // 정박 5연속: 얼굴 컷인   // 머리 위로 충분히 띄움 (몸을 가리지 않게)
      FX.ring(P.x, P.z, 0.6, 2.4, 0.25, 'gold', 0.85);   // r8: 1.2 → 0.85 (정박 ×5 연속에 몸이 하얗게 뜨던 것)
      AU.perfect(P.streak); R.pulse(0.08);
      if (P.streak === 5) HAP('beat5'); else HAP('beat', P.streak);   // 진동: 정박 톡 (판정 순간)
    }
    spawnWave(dir, half, dmg, auto && kind === 2 ? 1 : kind, col, pow, drag ? 1.1 : 1);   // r9 자동 박자 음파는 「누르고 있기」 음파처럼(사거리·게이지 보너스 없음)
    if (kind === 2 && U.echo) G.echoQ = { t: 0.14, dir, half, dmg: dmg * 0.5, rk: drag ? 1.1 : 1 };
    AU.whistle(auto && kind === 2 ? 1 : kind);
    GZ.HERO.kick(kind === 2 ? 1.25 : kind === 1 ? 1 : 0.7);
    const mx = P.x + Math.sin(dir) * 0.5, mz = P.z + Math.cos(dir) * 0.5;
    FX.spray(mx, 1.6, mz, dir, kind === 2 ? 6 : 3, 'gold', 9);
    // r2: 입 앞에서 앞으로 터져 나가는 음파 뿔 (호각을 '분다'가 읽히게). 정박은 더 굵고 흰 심지
    FX.cone(P.x + Math.sin(dir) * 0.3, 1.62, P.z + Math.cos(dir) * 0.3, dir, 'gold', kind === 2 ? 1.5 : kind === 1 ? 1.0 : 0.75, kind === 2 ? 3.0 : 2.1);
    if (kind === 2) FX.cone(P.x + Math.sin(dir) * 0.6, 1.62, P.z + Math.cos(dir) * 0.6, dir, 'white', 0.45, 1.7);   // r8: 흰 심지는 호각 끝 앞으로·약하게
  }
  function spawnWave(dir, half, dmg, kind, col, pow, rk) {
    const x = P.x + Math.sin(dir) * 0.4, z = P.z + Math.cos(dir) * 0.4;
    // r5: 음파를 2~3겹 부채꼴로 (앞머리 + 뒤따르는 겹 2개, 조금씩 넓고 옅게)
    const arcs = [FX.arc(x, z, dir, half, col, pow), FX.arc(x, z, dir, half * 1.1, 'gold', pow * 0.55, 1)];
    if (kind >= 1) arcs.push(FX.arc(x, z, dir, half * 1.2, 'gold', pow * 0.32, 2));
    G.waves.push({ x, z, dir, half, r: 0.6, range: U.range * (kind === 2 ? 1.1 : 1) * (rk || 1), dmg, kind, hit: {}, arc: arcs[0], arcs, n: 0, blk: 0 });
  }
  function wavesStep(dt) {
    for (let i = G.waves.length - 1; i >= 0; i--) {
      const w = G.waves[i];
      w.r += 30 * dt;
      for (const e of EN.list) {
        if (e.dead || w.hit[e.id]) continue;
        const dx = e.x - w.x, dz = e.z - w.z, d = Math.hypot(dx, dz);
        if (d - e.r > w.r || d + e.r < w.r - 2.2 || d - e.r > w.range) continue;
        const off = Math.abs(GZ.angDiff(GZ.ang(dx, dz), w.dir));
        if (off > w.half + Math.atan2(e.r, Math.max(0.5, d))) continue;
        w.hit[e.id] = 1;
        const res = EN.damage(e, w.dmg, w.x, w.z, { perfect: w.kind === 2 });
        if (res === 'none') continue;
        const hy = e.kind === 'boss' ? 2.6 : e.kind === 'drone' || e.kind === 'absorber' ? e.y : 1.2;
        const hx = e.x - (dx / (d || 1)) * e.r * 0.8, hz = e.z - (dz / (d || 1)) * e.r * 0.8;
        if (res === 'block') {
          stats.blocked++; w.blk++; AU.clang(); if (G.t - (e.blkT || -9) > 0.45) { e.blkT = G.t; FX.text(e.x + Math.cos(R.yaw) * 1.1, hy + 0.5, e.z - Math.sin(R.yaw) * 1.1, '막힘', 'blk', 0.5, true); }   // r4: 적 머리 위가 아니라 옆에 (피해 숫자·정박 글자와 자리 나눔)   // r3: 같은 자리에 겹쳐 찍히지 않게
          tip('shield', '방패는 정면을 막는다 — 「차렷!」으로 깨거나 뒤로 돌아라', 5);
          continue;
        }
        w.n++;
        comboHit(); addGauge(w.kind === 2 ? 1.6 : 0.8);   // r2: 1.1/2.2 → 0.8/1.6
        {   // r8 (검토 A·B): 피해 숫자 합치기 — ① 같은 음파가 붙어 있는(2.6m) 여러 적을 맞히면 숫자 하나 (37×5 → 185) ② 같은 적을 0.45초 안에 또 맞히면 그 숫자에 더함 (한 숫자는 최대 1.6초)
          const v = e.lastDmg != null ? e.lastDmg : w.dmg, live = (o, sq) => o && o.on && o.seq === sq;
          let o = null;
          if (live(w.numO, w.numSeq) && Math.hypot(hx - w.numO.ax, hz - w.numO.az) < 2.6) o = w.numO;
          else if (live(e.numO, e.numSeq) && G.t - e.numO.lt < 0.45 && G.t - e.numO.t0 < 1.6) o = e.numO;
          if (o) { o.sum += v; o.lt = G.t; o.pf = o.pf || w.kind === 2; FX.textSet(o, String(Math.round(o.sum)), o.pf ? 'pf' : ''); }
          else { o = FX.text(hx, hy + 0.9, hz, String(Math.round(v)), w.kind === 2 ? 'pf' : '', 0.6); if (o) { o.sum = v; o.lt = o.t0 = G.t; o.pf = w.kind === 2; o.ax = hx; o.az = hz; } }
          if (o) { e.numO = o; e.numSeq = o.seq; if (!live(w.numO, w.numSeq)) { w.numO = o; w.numSeq = o.seq; } }
        }
        FX.spray(hx, hy, hz, w.dir, w.kind === 2 ? 14 : 8, w.kind === 2 ? 'white' : 'gold', 10);
        FX.debris(hx, hy, hz, w.kind === 2 ? 4 : 2, 5.5);
        FX.hitMark(hx, hy, hz, w.kind === 2 ? 1.5 : 1, w.kind === 2);
        // r2 멈칫: 보통 타격 0.02 / 정박 타격 0.04 / 처치 0.05 / 정박 처치 0.09초
        if (res === 'kill') { hitStop(w.kind === 2 ? 0.09 : 0.05, true); if (e.kind !== 'boss') HAP('kill'); }
        else { AU.hit(w.kind === 2, e.kind === 'boss' && e.vuln > 0); hitStop(e.kind === 'boss' ? (w.kind === 2 ? 0.04 : 0) : (w.kind === 2 ? 0.055 : 0.035)); R.shake(w.kind === 2 ? 0.16 : 0.07); }   // r5: 보통 타격 멈칫은 쿨다운 0.4초, 보스는 정박 타격만 (보스전에 뚝뚝 끊기지 않게)
      }
      const k = w.r / w.range, fd = k >= 1 ? 0 : Math.min(1, (1 - k) * 2.2);
      for (let a = 0; a < w.arcs.length; a++) FX.arcSet(w.arcs[a], Math.max(0.45, w.r - a * 0.85), a ? fd * GZ.sat((w.r - a * 0.85) / 1.2) : fd);
      if (k >= 1) {
        // r4: 겨눈 쪽에 적이 있는데 음파가 닿기 전에 사라졌으면 2초에 한 번 「사거리 밖」 (보스에게 멀리서 헛방 치는 것을 알려 줌)
        if (!w.n && !w.blk && G.t - rangeT > 2 && (G.outW || 0) < 3) for (const e of EN.list) {
          if (e.dead || e.spawnT > 0) continue;
          const dx = e.x - w.x, dz = e.z - w.z, d = Math.hypot(dx, dz);
          if (d - e.r > w.range && d - e.r < w.range + 10 && Math.abs(GZ.angDiff(GZ.ang(dx, dz), w.dir)) < w.half + Math.atan2(e.r, d)) {
            rangeT = G.t; stats.outRange = (stats.outRange || 0) + 1; G.outW = (G.outW || 0) + 1;   // r7 (검토 A3): 웨이브·보스전마다 3번까지만
            FX.text(w.x + Math.sin(w.dir) * w.range * 0.8, 1.7, w.z + Math.cos(w.dir) * w.range * 0.8, '사거리 밖 — 더 가까이', 'off', 0.9, true);
            FX.ring(w.x + Math.sin(w.dir) * w.range, w.z + Math.cos(w.dir) * w.range, 0.3, 1.3, 0.3, 'steam', 0.9);
            break;
          }
        }
        G.waves.splice(i, 1);
      }
    }
  }

  // r5 「차렷!」 예비동작: 0.13초 동안 오른발을 들어 올렸다가(가슴 펴기) 발을 모으며 「척」 내려찍는 순간에 효과가 터짐
  const SKILL_WIND = 0.13;
  function startSkill() { P.skillCd = U.skillCd; P.skillWind = SKILL_WIND; P.inv = Math.max(P.inv, SKILL_WIND + 0.05); stats.skills++; GZ.HERO.windup && GZ.HERO.windup(SKILL_WIND); say('att'); G.skillPressAt = performance.now(); }   // r9: 누른 순간 「차렷!」 — 「렷」(0.14초)이 발 쾅(0.13초)과 맞음
  function doSkill() {
    P.skillT = 0.5;
    const n = EN.stunAll(P.x, P.z, U.skillR, 2.2);
    for (const e of EN.list.slice()) if (!e.dead && Math.hypot(e.x - P.x, e.z - P.z) < U.skillR + e.r) { if (EN.damage(e, 8, P.x, P.z, { skill: true }) !== 'none') comboHit(); }
    EN.clearShots(P.x, P.z, U.skillR);
    FX.ring(P.x, P.z, 0.8, U.skillR, 0.35, 'gold', 1.4); FX.ring(P.x, P.z, 0.5, U.skillR * 0.7, 0.45, 'gold', 0.7);   // r8: 흰 고리 → 금 (몸 탈색 줄임)
    FX.burst(P.x, 0.3, P.z, 20, 'gold', 11, 0.3, 0.5, 1);
    // r4: 발을 모으며 척 서는 스냅 + 바닥 충격 (먼지·불티·짧은 흰 고리)
    GZ.HERO.snap();
    FX.ring(P.x, P.z, 0.3, 1.9, 0.18, 'gold', 1.0); FX.ground(P.x, P.z, 16, 'gold', 8, 0.1, 0.3);
    for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.6; FX.puff(P.x + Math.sin(a) * 0.4, 0.2, P.z + Math.cos(a) * 0.4, Math.sin(a) * 2.2, 0.5, Math.cos(a) * 2.2, 0.5, 1.5, 0.45, 0.3, 0xb9a68a); }
    HUD.shout('차렷!', 0.7); AU.skill(); HAP('skill'); cutT = 0.7; R.shake(0.4); R.pulse(0.18); hitStop(0.08, true);
    P.inv = Math.max(P.inv, 0.35);
    return n;
  }
  function startUlt() {
    P.gauge = 0; stats.ults++;
    ult = { t: 0, fired: false };
    { const b = EN.boss; if (b && !b.dead && G.phase === 'boss') { ult.bossCam = { x: b.x, z: b.z }; const cy = Math.cos(R.yaw), sy = Math.sin(R.yaw); ult.side = ((b.x - P.x) * cy - (b.z - P.z) * sy) > 0 ? -1 : 1; } }   // r8: 보스가 화면 오른쪽이면 카메라는 왼쪽 어깨 너머
    P.inv = Math.max(P.inv, 2.3); P.vx = P.vz = 0;
    say('ult'); G.ultPressAt = performance.now();   // r9: 누른 순간 「전~체~ 기상!」 — 「상」 모음이 0.75초(터지는 순간·진동)에
    AU.ultStart(); AU.muteUntil = G.bt + 0.78;
    HUD.shout('전체 기상!', 1.3, 'ult');
    for (const w of G.waves) for (const a of w.arcs) FX.arcSet(a, 1, 0); G.waves.length = 0;
  }
  function ultStep(dt) {
    ult.t += dt;
    if (!ult.fired) {
      // 모이는 빛
      // r3: 동그란 빛망울 대신 바닥을 타고 모여드는 가는 불티 + 조여드는 고리
      if (Math.random() < 0.7) { const a = Math.random() * 6.28, r = 4 + Math.random() * 4; FX.spark(P.x + Math.sin(a) * r, 0.12, P.z + Math.cos(a) * r, -Math.sin(a) * r * 2.4, 0.2, -Math.cos(a) * r * 2.4, 1.6, 1.0, 0.25, 0.1, 0.36, 0); }
      if (Math.floor(ult.t * 5) !== Math.floor((ult.t - dt) * 5)) FX.ring(P.x, P.z, 6.5, 1.0, 0.3, 'gold', 0.8);
      if (ult.t >= 0.75) {
        ult.fired = true;
        const RAD = 16;
        for (const e of EN.list.slice()) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - P.x, e.z - P.z);
          if (d > RAD + e.r) continue;
          const res = EN.damage(e, e.kind === 'boss' ? 450 : 150, P.x, P.z, { ult: true });   // r3: 보스 190 → 450
          if (res !== 'none') { comboHit(); FX.text(e.x, e.kind === 'boss' ? 4 : 2.2, e.z, e.kind === 'boss' ? '450' : '150', 'big', e.kind === 'boss' ? 1.1 : 0.8); }
          if (e.kind === 'boss' && res !== 'none') { e.flinch = 0.3; e.flash = 1; FX.burst(e.x, 3.2, e.z, 14, 'gold', 10, 0.25, 0.5, 3); FX.ring(e.x, e.z, 2, 7, 0.4, 'gold', 1.4); }   // r8 (검토 B1): 보스가 맞는 반응 — 움찔·코어 번쩍·금빛 파편
        }
        EN.stunAll(P.x, P.z, RAD, 1.6, 2.5);   // 보스 기절 1.4 → 2.5초
        EN.clearShots(P.x, P.z, 99);
        // r3: 화면을 덮는 빛망울 대신 바닥을 훑는 충격 고리 5겹 + 낮게 깔리는 불티 + 짧은 번쩍
        for (let i = 0; i < 5; i++) FX.ring(P.x, P.z, 0.8, RAD * (0.4 + i * 0.16), 0.38 + i * 0.1, i % 2 ? 'white' : 'gold', 2.2);
        FX.shock(P.x, P.z, RAD);
        FX.ground(P.x, P.z, 46, 'gold', 22, 0.13, 0.7); FX.ground(P.x, P.z, 20, 'white', 15, 0.1, 0.5);
        FX.burst(P.x, 1.2, P.z, 14, 'gold', 9, 0.16, 0.5, 5);
        R.flash(P.x, 3, P.z, 0.5); R.shake(1.1); R.pulse(0.3);
        AU.ultBlast(); HAP('ult'); AU.dropUntil = G.bt + BEAT * 16;
        hitStop(0.12, true);
      }
    }
    if (ult.t >= 1.35) { ult = null; G.ultCharging = false; }
  }

  // r9: 차렷·전체 기상을 걸음(최대 16ms 뒤)까지 기다리지 않고 「누른 그 순간」(입력 처리 안) 바로 시작 — 목소리·예비동작이 누른 프레임에 나감. 조건은 걸음과 똑같음
  const canAct0 = () => G.playing() && !P.down && !P.win && !ult && G.phase !== 'bossIntro';
  function canSkill() { return canAct0() && P.skillCd <= 0 && P.rollT <= 0 && P.skillWind <= 0; }
  function canUltNow() { return canAct0() && P.gauge >= 100 && P.rollT <= 0 && P.skillWind <= 0; }
  G.pressNow = function (kind) {
    if (kind === 'skill') { if (canSkill()) { I.skillP = false; startSkill(); return true; } return false; }
    if (kind === 'ult') { const bs = EN.boss && !EN.boss.dead && EN.boss.state === 'shift'; if (canUltNow() && !bs) { I.ultP = false; startUlt(); return true; } return false; }
    if (kind === 'roll') { if (canAct0() && P.rollCd <= 0 && P.rollT <= 0 && !P.rollSaid) { P.rollSaid = true; say('roll'); } return false; }   // 「구르기!」는 누른 순간 말하고, 구르기 자체는 다음 걸음(≤16ms)에
    return false;
  };
  // r9 자동 공격: 사거리 안(+0.5m)의 가장 가까운 적(공격 준비 중이면 더 앞)을 고름
  function autoTarget() {
    let best = null, bd = 1e9;
    for (const e of EN.list) {
      if (e.dead || e.spawnT > 0 || e.hidden) continue;
      const d = Math.hypot(e.x - P.x, e.z - P.z) - e.r;
      if (d > U.range + 0.5) continue;
      const hot = e.state === 'wind' || e.state === 'aim' || e.state === 'dash';
      const sc = d - (hot ? 2 : 0);
      if (sc < bd) { bd = sc; best = e; }
    }
    return best ? GZ.ang(best.x - P.x, best.z - P.z) : null;
  }
  function playerStep(dt) {
    P.inv = Math.max(0, P.inv - dt); P.rollCd = Math.max(0, P.rollCd - dt); P.skillCd = Math.max(0, P.skillCd - dt);
    P.rollInv = Math.max(0, P.rollInv - dt); P.hurtInv = Math.max(0, P.hurtInv - dt); P.hitT = Math.max(0, P.hitT - dt * 3); P.skillT = Math.max(0, P.skillT - dt); P.fireV = Math.max(0, P.fireV - dt);
    if (P.streakT > 0) { P.streakT -= dt; if (P.streakT <= 0) P.streak = 0; }
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
    if (P.down || P.win) { P.vx *= Math.exp(-dt * 6); P.vz *= Math.exp(-dt * 6); P.x += P.vx * dt; P.z += P.vz * dt; P.moving = 0; clampPlayer(); return; }
    const canAct = !ult && G.phase !== 'bossIntro';
    let mx = I.mx, mz = I.mz; const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    // 구르기
    if (I.rollP && canAct && P.rollCd <= 0 && P.rollT <= 0) {
      const l = Math.hypot(mx, mz);
      if (l > 0.2) { P.rollDx = mx / l; P.rollDz = mz / l; }
      else {   // r3: 스틱 없이 구르면 — 쏘는 중엔 겨눈 쪽의 반대(뒤)로 빠짐, 아니면 보는 쪽
        const back = I.fire || P.fireV > 0 || G.bt - P.lastShot < 0.6 ? -1 : 1;
        P.rollDx = Math.sin(P.face) * back; P.rollDz = Math.cos(P.face) * back;
      }
      if (!P.rollSaid) say('roll'); P.rollSaid = false;   // r9: 「구르기!」 (터치·키는 누른 순간 G.pressNow 가 이미 말함)
      P.rollT = 0.34; P.rollCd = U.rollCd; P.inv = Math.max(P.inv, 0.44); P.rollInv = 0.44; stats.rolls++;
      // r3 고리: 닿기 직전(2.2m 안)에 구르면 방향과 상관없이 그 고리는 넘은 것으로 침
      { const pd = Math.hypot(P.x, P.z), RD = G.D.ringDodge || 2.2; let dg = false; for (const r of EN.rings) if (!r.hit && pd - r.r > -0.8 && pd - r.r < RD) { r.hit = true; dg = true; } if (dg) { const q = sideP(); FX.text(q.x, q.y, q.z, '회피!', 'word', 0.5, true); } }
      AU.roll(); FX.puff(P.x, 0.4, P.z, 0, 0.5, 0, 0.8, 2.2, 0.4, 0.25);
    }
    if (P.skillWind > 0) { P.skillWind -= dt; if (P.skillWind <= 0) { P.skillWind = 0; doSkill(); } }
    if (I.skillP && canSkill()) startSkill();
    // r5: 보스 단계 전환(무적) 중에는 「전체 기상!」을 막음 — 게이지는 그대로 (버튼이 잠김 표시)
    const bossShift = EN.boss && !EN.boss.dead && EN.boss.state === 'shift';
    G.ultBlocked = bossShift ? 1 : 0;
    if (I.ultP && canUltNow()) {
      if (bossShift) { if (G.bt - (G.ultMsgT || -9) > 1) { G.ultMsgT = G.bt; FX.text(P.x, 2.75, P.z, '전환 중 — 잠시 뒤에', 'off', 0.8, true); } }
      else startUlt();
    }
    if (I.rollP && P.rollT <= 0 && P.rollCd > 0) P.rollSaid = false;
    I.rollP = false; if (P.rollT <= 0) I.skillP = I.ultP = false;   // 구르는 중에 누른 차렷·기상은 구르기가 끝나면 나감
    G.ultCharging = !!(ult && !ult.fired);
    if (ult) { ultStep(dt); P.moving = 0; return; }

    const autoAtk = G.atk === 'auto', aDir = autoAtk && canAct && P.rollT <= 0 ? autoTarget() : null;
    const firing = (autoAtk ? aDir != null : I.fire) && canAct && P.rollT <= 0;
    if (P.rollT > 0) {
      P.rollT -= dt;
      P.vx = P.rollDx * 14.5; P.vz = P.rollDz * 14.5;
      P.face = GZ.ang(P.rollDx, P.rollDz);
      if (P.rollT <= 0) { P.vx *= 0.4; P.vz *= 0.4; }
    } else {
      const sp = (firing ? 5.3 : 6.4) * (P.skillT > 0.25 || P.skillWind > 0 ? 0.2 : 1) * (G.phase === 'bossIntro' ? 0 : 1);
      const k = 1 - Math.exp(-dt * 14);
      P.vx += (mx * sp - P.vx) * k; P.vz += (mz * sp - P.vz) * k;
      if (aDir != null) P.face = GZ.angTo(P.face, aDir, dt * 18);   // r9 자동: 고른 적 쪽으로 몸을 돌림 (발사 사이에 이동 쪽으로 휙휙 돌지 않게)
      else if (I.aim != null && (firing || !GZ.isTouch)) P.face = GZ.angTo(P.face, I.aim, dt * 18);
      else if (!firing && P.fireV <= 0 && ml > 0.15) P.face = GZ.angTo(P.face, GZ.ang(mx, mz), dt * 14);
      else if (firing && I.aim == null) {
        // r4: 조준 도움 범위 안에 적이 있으면 몸을 그대로 둠(물러나며 쏴도 적 쪽). 범위 안에 적이 없으면 — 사거리 안에 적이 있어도 — 이동 방향으로 몸을 돌림(뒤쪽 적을 영영 못 맞히던 버그)
        const lim = assistLim(); let inCone = false, ne = null, nd = 1e9;
        for (const e of EN.list) {
          if (e.dead || e.spawnT > 0) continue;
          const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz);
          if (d > U.range + e.r + 1) continue;
          if (Math.abs(GZ.angDiff(GZ.ang(dx, dz), P.face)) - Math.atan2(e.r * 0.5, d) < lim) { inCone = true; break; }
          if (d < nd) { nd = d; ne = e; }
        }
        if (!inCone) {
          if (ml > 0.15) P.face = GZ.angTo(P.face, GZ.ang(mx, mz), dt * 9);
          else if (ne && stats.wave <= 1) P.face = GZ.angTo(P.face, GZ.ang(ne.x - P.x, ne.z - P.z), dt * 3);   // 1웨이브(연습)만: 서서 누르고 있으면 사거리 안의 적 쪽으로 천천히 돌아섬
        }
      }
    }
    P.x += P.vx * dt; P.z += P.vz * dt;
    P.moving = GZ.sat(Math.hypot(P.vx, P.vz) / 6.4);
    clampPlayer();

    // 호각: 누르는 동안만. 새로 누른 순간이 박자에 맞으면 「정박!」, 누르고 있으면 8분음표마다
    const q = Math.floor(G.bt / (BEAT / 2));
    if (autoAtk) {   // r9 자동: 귀에 들리는 박자(소리 지연만큼 늦춤)의 8분음표마다 — 정박 자리는 「자동 박자」, 사이는 약한 발사
      const qa = Math.floor((G.bt - AU.latency()) / (BEAT / 2));
      if (firing && qa > P.lastQ) { P.lastQ = qa; if (G.bt - P.lastShot >= 0.17) shoot(qa % 2 === 0 ? 2 : 0, aDir); }
      else if (!firing) P.lastQ = Math.max(P.lastQ, qa);
      P.held = false;
    } else if (firing) {
      if (!P.held) {
        P.held = true;
        const bp = (G.bt - AU.latency()) / BEAT, off = (bp - Math.round(bp)) * BEAT;   // 음수 = 이르게, 양수 = 늦게
        const onBeat = off >= -U.winE && off <= U.winL;
        const perfect = onBeat && G.bt >= P.sloppyT;
        P.offRun = onBeat ? 0 : (P.offRun || 0) + 1;   // r8 (검토 A): 「엇박」 글자는 3번 연속 엇박부터 (잔소리처럼 자주 뜨던 것)
        if (!onBeat) { P.sloppyT = G.bt + SLOPPY; P.streak = 0; if (G.bt - offT > 0.8 && stats.perfect + stats.shots > 3 && P.offRun >= 3) { offT = G.bt; { const q = sideP(2.75); FX.text(q.x, q.y, q.z, '엇박', 'off', 0.4, true); } } }   // r3: 왜 정박이 아닌지 알려 줌
        if (G.bt - P.lastShot >= (perfect ? TAP_GAP_PERFECT : TAP_GAP)) {
          shoot(perfect ? 2 : 0);
          P.lastQ = q;
        }
      } else if (q > P.lastQ) {
        P.lastQ = q;
        if (G.bt - P.lastShot >= 0.17) shoot(q % 2 === 0 ? 1 : 0);
      }
    } else if (!I.fire) P.held = false;   // r4: 손가락이 눌려 있는 동안(구르기·차렷·궁극기 중에도)은 「누르고 있음」 유지 → 끝난 뒤 박자를 다시 판정하지 않고 8분음표 연사를 그대로 이어감
    if (G.echoQ) { G.echoQ.t -= dt; if (G.echoQ.t <= 0) { spawnWave(G.echoQ.dir, G.echoQ.half, G.echoQ.dmg, 0, 'gold', 0.8, G.echoQ.rk); G.echoQ = null; } }
  }
  function clampPlayer() {
    const d = Math.hypot(P.x, P.z), lim = GZ.AR.R - 0.5;
    if (d > lim) { P.x *= lim / d; P.z *= lim / d; }
    const b = EN.boss;
    if (b && !b.dead) { const m = b.r + 0.6; if (d < m) { const k = m / (d || 0.001); P.x = (P.x || 0.001) * k; P.z = (P.z || 0.001) * k; } }
    for (const e of EN.list) {   // 포탑·방패병은 길을 막음
      if (e.dead || (e.kind !== 'turret' && e.kind !== 'shield') || e.spawnT > 0) continue;
      const dx = P.x - e.x, dz = P.z - e.z, dd = Math.hypot(dx, dz), m = e.r + 0.45;
      if (dd < m && dd > 0.001 && P.rollT <= 0) { P.x = e.x + (dx / dd) * m; P.z = e.z + (dz / dd) * m; }
    }
  }

  // ---------- 한 걸음 ----------
  G.step = function (dt) {
    G.bt += dt;
    const ph = G.phase;
    if (ph === 'title' || ph === 'cards' || ph === 'result' || ph === 'loading') return;
    if (botMode) bot(dt);
    if (testInput) Object.assign(I, testInput);
    let ts = 1;
    if (G.phase === 'boss') G.hsSteps++;
    if (G.hitstop > 0) { G.hitstop -= dt; ts = 0.06; if (G.phase === 'boss') G.hsFrames++; }
    const edt = dt * ts;
    G.t += edt; G.pt += dt;
    if (ph !== 'win' && ph !== 'lose') stats.time += dt;
    tipStep(dt);
    if (P.gauge >= 100 && !hintSeen.ult) tip('ult', '「전체 기상!」 준비 완료 — 금색 버튼을 눌러라', 5, true);
    if (!hintSeen.turret) for (const e of EN.list) if (e.kind === 'turret' && e.state === 'aim') { tip('turret', '보일러 크롤러(포탑)의 붉은 선 — 옆으로 걷거나 「구르기」', 4.5, true, false, true); break; }   // r8 (검토 B5): 첫 크롤러가 겨누는 순간 바로 (30초 조건 뺌, 급한 안내)
    playerStep(dt);   // r5: 멈칫 중에도 주인공 이동·구르기는 제 속도 (적·음파·이펙트만 느려짐)
    wavesStep(edt);
    EN.update(ult && !ult.fired ? edt * 0.05 : edt, P);
    if (ph === 'intro') { waveStep(edt); if (wave.t >= 0) { G.phase = 'play'; if (GZ.AS) GZ.AS.wave(wave.i); } }   // 비서 그런트 무전 (띠 글자가 사라진 뒤)
    else if (ph === 'play') waveStep(edt);
    else if (ph === 'clear') { if (G.pt > 1.7) openCards(); }
    else if (ph === 'bossIntro') { if (G.bossBannerAt && G.pt >= G.bossBannerAt) { G.bossBannerAt = 0; HUD.banner('침묵 기관', '도시의 박동을 되찾아라', 1.9, true); } if (G.pt > 2.9) { G.phase = 'boss'; if (GZ.AS) GZ.AS.boss(); tip('ring', '붉은 고리가 닿기 직전에 「구르기」 — 방향은 상관없다', 6, true); } }
    else if (ph === 'win') { if (stats.win && G.bannerAt && G.pt > G.bannerAt) { G.bannerAt = 0; HUD.banner('도시의 박동이 돌아왔다', '임무 완수', 2.4); } if (stats.win && G.pt > G.winT) finish(true); }
    else if (ph === 'lose') { if (G.pt > 1.9) finish(false); }
  };

  // ---------- 자동 플레이 (시험용) ----------
  function bot(dt) {
    I.rollP = I.skillP = I.ultP = false;
    if (botMode === 'idle' || P.down) { I.mx = I.mz = 0; I.fire = false; return; }
    if (botMode === 'novice') {   // 초보: 끌어 조준 안 함, 구르기·차렷·궁극기 안 씀. 0.45초마다 판단 — 가까운 적에서 물러나고, 아니면 옆으로 걸으며 호각만 누름
      botT -= dt; I.aim = null;
      if (botT > 0) return; botT = 0.45;
      if (stats.blocked > (botState.blk || 0)) { botState.blk = stats.blocked; if (P.skillCd <= 0 && GZ.rand() < 0.5) I.skillP = true; }   // 방패에 막히면 안내대로 「차렷!」은 누름 (절반쯤)
      let ne = null, nd2 = 1e9; for (const e of EN.list) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < nd2) { nd2 = d; ne = e; } }
      let mx = 0, mz = 0;
      // r4: 끌지 않는 사람은 「걸어서 겨눈다」 — 적이 조준 도움 범위 밖이면 그쪽으로 한 발 내디뎌 몸을 돌리고, 너무 가까우면(3m 안) 물러남
      if (ne) { const dx = P.x - ne.x, dz = P.z - ne.z, d = nd2 || 1, sd = botState.side || 1, offA = Math.abs(GZ.angDiff(GZ.ang(-dx, -dz), P.face));
        if (d < 3) { mx = dx / d + (-dz / d) * 0.8 * sd; mz = dz / d + (dx / d) * 0.8 * sd; } else if (d > 7.5 || offA > (stats.wave <= 1 ? 1.4 : 0.6)) { mx = -dx / d; mz = -dz / d; } else { mx = (-dz / d) * sd * 0.9 - (dx / d) * 0.25; mz = (dx / d) * sd * 0.9 - (dz / d) * 0.25; } }
      const pd0 = Math.hypot(P.x, P.z); if (pd0 > 14) { mx -= (P.x / pd0) * 1.5; mz -= (P.z / pd0) * 1.5; }
      if (GZ.rand() < 0.08) botState.side = -(botState.side || 1);
      stickBot(mx, mz); I.fire = !!ne && GZ.rand() < 0.9;
      return;
    }
    const good = botMode === 'good';
    botT -= dt;
    // 목표 고르기
    let tgt = null, best = 1e9, nearN = 0, nearest = null, nd = 1e9, shieldNear = false;
    for (const e of EN.list) {
      if (e.dead || e.spawnT > 0) continue;
      const d = Math.hypot(e.x - P.x, e.z - P.z) - e.r;
      if (d < 6) nearN++;
      if (d < nd) { nd = d; nearest = e; }
      let guarded = e.kind === 'shield' && e.broken <= 0 && e.stun <= 0 && e.state !== 'recover' && Math.abs(GZ.angDiff(GZ.ang(P.x - e.x, P.z - e.z), e.face)) < 1.25;
      if (e.kind === 'shield' && d < 6 && guarded) shieldNear = true;
      if (guarded) continue;
      let sc = d + (e.kind === 'absorber' ? -6 : e.kind === 'boss' ? 3 : e.kind === 'turret' ? 1 : 0);
      if (d > U.range - 0.5) sc += 20;
      if (sc < best) { best = sc; tgt = e; }
    }
    if (!good && !tgt && nearest) tgt = nearest;
    if (!good && botT > 0) {
      stickBot(botState.mx, botState.mz); I.fire = botState.fire; I.aim = botState.aim; if (GZ.rand() < 0.004) I.rollP = true;
      // 어설픈 사람: 보스 고리는 보이니까 구르긴 하는데 절반쯤만 제때 누름 (고리마다 한 번 판단)
      const pr0 = Math.hypot(P.x, P.z);
      for (const r of EN.rings) if (!r.hit && !r.botTry && r.r < pr0 && pr0 - r.r < 1.5) { r.botTry = true; if (GZ.rand() < 0.55 && P.rollCd <= 0) { I.rollP = true; stickBot(-P.x / pr0, -P.z / pr0); } }
      return;
    }
    // 이동: 가까운 것에서 멀어지고, 옆으로 돌고, 벽에서 떨어짐
    let mx = 0, mz = 0;
    for (const e of EN.list) {
      if (e.dead) continue;
      const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) - e.r, want = e.kind === 'boss' ? 6.5 : e.kind === 'shield' || e.kind === 'brute' ? 5 : e.kind === 'turret' ? 3 : 4.2;
      if (d < want) { const k = (want - d) / want * 2.2; mx += (dx / (d + e.r)) * k; mz += (dz / (d + e.r)) * k; }
      if (e.kind === 'turret' && e.state === 'aim') {   // 예고선에서 비킴
        const bx = Math.sin(e.face), bz = Math.cos(e.face), perp = dx * bz - dz * bx;
        if (Math.abs(perp) < 1.6 && dx * bx + dz * bz > 0) { const s = perp >= 0 ? 1 : -1; mx += bz * s * 2.5; mz += -bx * s * 2.5; }
      }
      if (e.kind === 'drone' && (e.state === 'wind' || e.state === 'dash') && d < 6) { const bx = Math.sin(e.dash), bz = Math.cos(e.dash), perp = dx * bz - dz * bx, s = perp >= 0 ? 1 : -1; mx += bz * s * 3; mz += -bx * s * 3; }
      if (e.kind === 'boss') {
        for (const a of e.aims) { if (a.beam) continue; const bx = Math.sin(a.ang), bz = Math.cos(a.ang), perp = dx * bz - dz * bx; if (Math.abs(perp) < 1.8) { const s = perp >= 0 ? 1 : -1; mx += bz * s * 3; mz += -bx * s * 3; } }
        if (e.state === 'beam') {   // 광선: 도는 방향으로 같이 돎
          const pa = GZ.ang(dx, dz); let minOff = 9, sign = 1;
          for (let i = 0; i < e.beamN; i++) { const off = GZ.angDiff(pa, e.beamA + (i / e.beamN) * GZ.TAU); if (Math.abs(off) < Math.abs(minOff)) minOff = off; }
          const dir = e.beamDir; const tx = Math.cos(pa) * dir, tz = -Math.sin(pa) * dir;
          mx += tx * 3.5; mz += tz * 3.5;
          if (good && e.beamOn && Math.abs(minOff) < 0.2 && P.rollCd <= 0) { I.rollP = true; botState.rollDir = [tx * (minOff * dir > 0 ? 1 : -1), tz * (minOff * dir > 0 ? 1 : -1)]; }
          const pd = Math.hypot(dx, dz); if (pd < 9) { mx += dx / pd * 1.5; mz += dz / pd * 1.5; }
        }
        if (e.state === 'piston') { const pa = GZ.ang(dx, dz); mx += Math.cos(pa) * 4; mz += -Math.sin(pa) * 4; }
      }
    }
    for (const s of EN.shots) {   // 날아오는 탄
      const dx = P.x - s.x, dz = P.z - s.z, sp = Math.hypot(s.vx, s.vz), bx = s.vx / sp, bz = s.vz / sp, along = dx * bx + dz * bz, perp = dx * bz - dz * bx;
      if (along > 0 && along < 9 && Math.abs(perp) < 1.5) { const sg = perp >= 0 ? 1 : -1; mx += bz * sg * 3; mz += -bx * sg * 3; if (good && along < 3.2 && Math.abs(perp) < 0.9 && P.rollCd <= 0) { I.rollP = true; botState.rollDir = [bz * sg, -bx * sg]; } }
    }
    const pd = Math.hypot(P.x, P.z);
    if (pd > 13) { mx -= (P.x / pd) * (pd - 13) * 0.9; mz -= (P.z / pd) * (pd - 13) * 0.9; }
    if (tgt) {   // 목표와 사거리 유지 + 옆걸음
      const dx = tgt.x - P.x, dz = tgt.z - P.z, d = Math.hypot(dx, dz) || 1, far = d - tgt.r > U.range * 0.75 ? 1.6 : 0;
      mx += (dx / d) * far + (-dz / d) * 0.7 * (botState.side || 1); mz += (dz / d) * far + (dx / d) * 0.7 * (botState.side || 1);
    } else if (nearest) { const dx = nearest.x - P.x, dz = nearest.z - P.z, d = Math.hypot(dx, dz) || 1; mx += (-dz / d) * 1.2; mz += (dx / d) * 1.2; }
    if (GZ.rand() < 0.005) botState.side = -(botState.side || 1);
    // 보스 고리·피스톤: 구르기
    const pr = Math.hypot(P.x, P.z);
    for (const r of EN.rings) if (!r.hit && (good || !r.botTry) && r.r < pr && pr - r.r < (good ? 1.7 : 1.5) && P.rollCd <= 0) { if (!good) { r.botTry = true; if (GZ.rand() >= 0.55) continue; } I.rollP = true; botState.rollDir = [-P.x / pr, -P.z / pr]; }
    if (I.rollP && botState.rollDir) { mx = botState.rollDir[0] * 5; mz = botState.rollDir[1] * 5; }
    if (!good) {   // 어설픈 플레이: 0.5초마다 판단, 조준 오차, 구르기 잘 안 씀
      const ringRoll = I.rollP && EN.rings.some((r) => r.botTry && !r.hit && r.r < pr);
      I.rollP = ringRoll || (I.rollP && GZ.rand() < 0.3);
      botT = 0.5;
      botState.mx = mx; botState.mz = mz;
      botState.fire = !!tgt && GZ.rand() < 0.85;
      botState.aim = tgt ? GZ.ang(tgt.x - P.x, tgt.z - P.z) + GZ.rr(-0.45, 0.45) : null;
      stickBot(mx, mz); I.fire = botState.fire; I.aim = botState.aim;
      if (P.gauge >= 100 && GZ.rand() < 0.3) I.ultP = true;
      if (P.skillCd <= 0 && (nearN >= 3 || shieldNear) && GZ.rand() < 0.3) I.skillP = true;
      return;
    }
    stickBot(mx, mz);
    if (tgt) {
      I.aim = GZ.ang(tgt.x - P.x, tgt.z - P.z);
      // 박자마다 새로 눌러 「정박」: 박자 직전에 잠깐 뗌
      const bp = (G.bt / BEAT) % 1;
      I.fire = !(bp > 0.86 && bp < 0.97);
    } else { I.fire = false; I.aim = null; }
    if (P.skillCd <= 0 && (shieldNear || nearN >= 4 || (EN.boss && !EN.boss.dead && nd < 9 && EN.boss.spawnT <= 0 && EN.boss.state !== 'shift'))) I.skillP = true;
    if (P.gauge >= 100 && (nearN >= 3 || (nearN >= 1 && EN.alive() >= 5) || (EN.boss && !EN.boss.dead && EN.boss.spawnT <= 0 && EN.boss.state !== 'shift' && Math.hypot(P.x, P.z) < 15))) I.ultP = true;
  }
  function stickBot(mx, mz) { const l = Math.hypot(mx, mz); if (l > 0.3) { I.mx = mx / l; I.mz = mz / l; } else { I.mx = 0; I.mz = 0; } }

  // ---------- 화면 ----------
  // r9b (대표 「따라가는 카메라 아직 부족」): 웨이브 4.0m(가로 폰 화면 폭 약 16%)·보스 1.1m·조준만 1.3m, 감쇠 스프링(ω 7.5 따라붙기 / 4.5 돌아오기), 멈춘 뒤 1.0초 기다렸다 복귀,
  //   앞섬이 바뀌는 빠르기 최대 8.5m/s·가속 최대 60m/s² (방향을 휙 바꿔도 덜컹 없이 부드럽게 꺾임). 보스전은 보스-주인공 중점 쪽 기울임(최대 2.0m) + 작은 앞섬
  const LEAD = { wave: 4.0, boss: 1.1, aim: 1.3, w: 7.5, wBack: 4.5, hold: 1.0, vmax: 8.5, amax: 60, lean: 0.24, leanMax: 2.0 };
  const BOSS_PITCH = -0.12;   // 11-14 보스전 각 보정(rad): 보스전은 0.64-0.12=0.52rad(옛 0.5 와 거의 같음) — 키 큰 보스·위 막대 때문에 세우면 발이 바닥 끝(96%)으로 감
  const CAM_LV = { off: 0, mid: 0.55, strong: 1 };   // 일시정지 창 「카메라 따라가기: 끔 / 보통 / 강하게」 (기본 강하게, 저장 gzre_camlead)
  G.camLv = 'strong';
  try { const v = localStorage.getItem('gzre_camlead'); if (v && v in CAM_LV) G.camLv = v; } catch (e) { /* 저장 안 되는 곳 */ }
  if (GZ.Q.lead === '0') G.camLv = 'off';   // 비교 시험용 (저장 안 함)
  G.setCamLv = function (v) { if (!(v in CAM_LV)) return G.camLv; G.camLv = v; try { localStorage.setItem('gzre_camlead', v); } catch (e) { /* 저장 안 되는 곳 */ } if (HUD.camLv) HUD.camLv(v); return v; };
  G.LEAD = LEAD; G.CAM_LV = CAM_LV;
  G.lead = () => ({ x: +(leadX + leanX).toFixed(3), z: +(leadZ + leanZ).toFixed(3), mx: +leadX.toFixed(3), mz: +leadZ.toFixed(3), tx: +leadTX.toFixed(3), tz: +leadTZ.toFixed(3), vx: +leadVX.toFixed(3), vz: +leadVZ.toFixed(3), lean: +Math.hypot(leanX, leanZ).toFixed(3), back: leadBack, lv: G.camLv });
  let last = 0, acc = 0, titleT = 0, bossFeet = 0.1; const _bt = { x: 0, y: 0, behind: false }, BOSS_TOP = 6.0;   // BOSS_TOP: 보스 머리 끝 높이(m, 굴뚝 포함 실측 5.66 + 여유)
  const heroSt = { x: 0, z: 0, face: 0, move: 0, firing: false, rollK: -1, hitK: 0, down: false, win: false, skillK: 0, ultK: 0, beat: 0, inv: false };
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    R.trackFrame(dt);
    if (G.playing() && !G.frozen) HUD.pollPC(P.x, P.z);
    if (!G.paused && !G.frozen) {
      acc += dt * GZ.Q.sim;
      let n = 0;
      while (acc >= STEP && n < 12 * GZ.Q.sim) { G.step(STEP); acc -= STEP; n++; }
      if (acc > STEP * 3) acc = 0;
    }
    draw(G.paused ? 0 : dt, dt);
  }
  function draw(dt, rdt) {
    const cdt = rdt == null ? dt : rdt;   // r5: 카메라는 일시정지 중에도 실제 시간으로 (멈추기 직전의 연출 카메라에 붙어 있던 버그)
    const beatK = 1 - ((G.bt / BEAT) % 1);           // 1 → 0
    const pulse = beatK * beatK;
    const st = heroSt;
    st.x = P.x; st.z = P.z; st.face = P.face; st.move = P.moving;
    st.firing = (I.fire && G.playing() && P.rollT <= 0 && !ult) || P.fireV > 0;
    st.rollK = P.rollT > 0 ? 1 - P.rollT / 0.34 : -1;
    st.hitK = P.hitT; st.down = P.down; st.win = P.win; st.title = G.phase === 'title';
    st.salute = st.title || (G.phase === 'result' && stats.win);   // 타이틀·임무 완수: 경례
    st.skillK = P.skillT > 0 ? P.skillT / 0.5 : 0;
    st.ultK = ult ? GZ.sat(ult.t / 0.75) : 0;
    st.onBeat = beatK > 0.86 || beatK < 0.06; st.ultT = ult ? ult.t : -1;
    st.camU = R.yaw + Math.PI;   // 화면 위쪽이 가리키는 바닥 방향 (3/4 자세 계산용)
    st.stance = (G.playing() || G.phase === 'cards') && !ult && !G.dbgCam && !(G.phase === 'bossIntro' && G.pt < 2.3);
    st.beat = pulse; st.inv = P.hurtInv > 0 && P.inv > 0 && !ult && G.phase !== 'win' && G.phase !== 'result';   // r3: 흰 테두리 빛은 맞은 뒤 무적에만 (「차렷!」·구르기 무적엔 안 띄움 — 몸이 허옇게 뜨던 것)
    GZ.HERO.update(dt, st);
    if (GZ.MD) GZ.MD.time.value = (performance.now() / 1000) % 1000;
    if (GZ.MD) GZ.MD.glow.value += ((ult ? 1 : 0) - GZ.MD.glow.value) * (1 - Math.exp(-dt * (ult ? 10 : 3)));
    const showFan = G.playing() && !P.down && (I.fire || (!GZ.isTouch && I.aim != null)) && P.rollT <= 0;
    GZ.HERO.setFan(showFan, I.aim != null ? I.aim : P.face, U.half, U.range * (I.aim != null ? 1.1 : 1), P.x, P.z);
    EN.sync(dt, G.t, P);
    FX.update(dt);
    const b = EN.boss, danger = b && !b.dead ? 0.4 + (b.phase - 1) * 0.3 : 0;
    GZ.AR.update(dt, G.bt, pulse, danger);
    // 카메라
    const port = R.w < R.h;
    if (G.phase === 'title' || G.phase === 'loading') {
      titleT += dt;
      const a = 0.42 + Math.sin(titleT * 0.25) * 0.2;
      R.setCine(true, P.x + Math.sin(a) * (port ? 4.7 : 4.2), port ? 1.3 : 1.5, P.z + Math.cos(a) * (port ? 4.7 : 4.2), P.x, port ? 1.25 : 1.15, P.z, port ? 50 : 36);
      R.cine.k = 1;
    } else if (G.phase === 'result') {
      // 결과: 주인공(경례/쓰러짐)을 창 위쪽(가로는 왼쪽)에 한 컷
      const a = P.face + (stats.win ? 0.25 : 0.7), d = port ? 5.4 : 4.6, sx = port ? 0 : 1.9;
      R.setCine(true, P.x + Math.sin(a) * d + Math.cos(a) * sx, 1.5, P.z + Math.cos(a) * d - Math.sin(a) * sx, P.x + Math.cos(a) * sx, port ? -0.25 : 1.0, P.z - Math.sin(a) * sx, port ? 50 : 38);
    } else if (G.dbgCam) {
      const c = G.dbgCam, a = P.face + c.a;
      R.setCine(true, P.x + Math.sin(a) * c.d, c.h, P.z + Math.cos(a) * c.d, P.x, c.ly == null ? 1.0 : c.ly, P.z, c.fov || 30); R.cine.k = 1;
    } else if (ult && ult.bossCam && ult.t < 1.3) {
      // r8 (검토 B1): 보스전 「전체 기상!」 — 보스 반대편 어깨 너머에서 주인공 + 보스 전체를 한 화면에 (터진 뒤 보스 움찔·코어 번쩍까지 보이게 1.3초)
      const bb = ult.bossCam, dx = P.x - bb.x, dz = P.z - bb.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, sd = ult.side;
      const back = port ? 6.2 : 4.6, side = port ? 1.3 : 2.1;
      R.setCine(true, P.x + ux * back - uz * side * sd, port ? 3.0 : 2.7, P.z + uz * back + ux * side * sd, GZ.lerp(P.x, bb.x, 0.5), port ? 2.9 : 2.6, GZ.lerp(P.z, bb.z, 0.5), port ? 64 : 54);
    } else if (ult && ult.t < 1.0) {
      // r8 (검토 A5): 가로 근접컷 — 0.5m 뒤·0.3m 위 (머리·올린 손이 화면 위 끝에 안 잘림), 주인공을 화면 오른쪽으로 비켜 왼쪽 위 「전체 기상!」 글자와 안 겹치게
      const a = P.face - 0.6, d = port ? 5.7 : 5.1, rx = Math.cos(a), rz = -Math.sin(a), sh = port ? 0 : 0.62;   // (rx,rz) = 이 카메라의 오른쪽
      R.setCine(true, P.x + Math.sin(a) * d - rx * sh, port ? 1.3 : 1.6, P.z + Math.cos(a) * d - rz * sh, P.x - rx * sh, port ? 1.3 : 1.36, P.z - rz * sh, port ? 50 : 40);
    } else if (G.phase === 'bossIntro' && G.pt < 2.3) {
      // r5: 주인공 등 뒤 높은 곳에서 — 주인공 발끝까지 + 솟아오르는 보스 전체가 한 화면에
      const d = Math.hypot(P.x, P.z) || 1, ux = P.x / d, uz = P.z / d;
      R.setCine(true, P.x + ux * (port ? 6.2 : 7.4) - uz * 1.2, port ? 3.6 : 4.0, P.z + uz * (port ? 6.2 : 7.4) + ux * 1.2, P.x * 0.45, port ? 2.6 : 2.0, P.z * 0.45, port ? 64 : 50);
    } else if (G.phase === 'win') {
      // r5: 승리 컷 (보스가 무너지는 2.3초 동안부터 — r4 는 다 무너진 뒤에야 연출 카메라가 켜져 그 전엔 보스가 화면 밖) — 주인공 어깨 너머로 무너지는 보스 전체 (보스가 화면 밖으로 반쯤 잘리던 것)
      const bx = G.bossX || 0, bz = G.bossZ || 0, d = Math.hypot(P.x - bx, P.z - bz) || 1, ux = (P.x - bx) / d, uz = (P.z - bz) / d;
      R.setCine(true, P.x + ux * 5.4 - uz * 1.1, port ? 2.6 : 2.2, P.z + uz * 5.4 + ux * 1.1, GZ.lerp(P.x, bx, 0.6), port ? 2.4 : 2.1, GZ.lerp(P.z, bz, 0.6), port ? 64 : 48);
    } else R.setCine(false);
    // r3 카메라: 평상시 물러남은 최대 6% (허조교가 화면 높이 15% 밑으로 안 내려감), 보스전 1.16배 (14% 이상)
    const bossOn = b && !b.dead && (G.phase === 'boss' || G.phase === 'bossIntro');
    let nearN = 0, tx = 0, tz = 0, tw = 0;
    for (const e of EN.list) {
      if (e.dead || e.kind === 'boss') continue;
      const ex = e.x - P.x, ez = e.z - P.z, d = Math.hypot(ex, ez);
      if (d < 9) nearN++;
      if (d > 13) continue;
      const hot = e.state === 'wind' || e.state === 'aim' || e.state === 'dash';
      const wgt = (hot ? 1.5 : 1) * GZ.sat((13 - d) / 7) * (e.kind === 'turret' && !hot ? 0.4 : 1);
      tx += ex * wgt; tz += ez * wgt; tw += wgt;
    }
    // r5: 화면 밖 적이 3대 이상이면 조금 더 물러남 (세로 최대 +8%, r7 가로 최대 +5%)
    const offK = G.playing() ? Math.min(port ? 0.08 : 0.05, Math.max(0, (HUD.offN || 0) - 2) * 0.02) : 0;
    const zt = bossOn ? 1.16 : Math.min(1.12, 1 + Math.min(0.06, Math.max(0, nearN - 2) * 0.02) + offK);
    R.zoom += (zt - R.zoom) * (1 - Math.exp(-cdt * 1.6));
    // r4 카메라 회전 (총괄 결정): 웨이브는 돌지 않음(오른쪽 뒤 27° 고정) — 조작이 휘지 않게. 보스전만 아주 느리게:
    //   보스가 화면 위쪽 좌우 0.35rad 안에 있으면 안 돌고, 벗어나면 초당 최대 0.6rad 로 따라가 0.14rad 안에 들어오면 멈춤. 일시정지 창에서 끌 수 있음(R.opt.camAuto)
    //   (시험용 ?camwave=1: 웨이브에서도 느리게 돎 — 검토 B 권고값 0.6/0.2rad·0.45rad/s)
    {
      let want = 0;
      if (bossOn && R.opt.camAuto) {
        const d = GZ.angDiff(Math.atan2(P.x - b.x, P.z - b.z), R.yaw), off = Math.abs(d);
        if (off > 0.35) yawMove = true; else if (off < 0.14) yawMove = false;
        if (yawMove) want = GZ.clamp(d * 1.6, -0.6, 0.6);
      } else if (GZ.Q.camwave && R.opt.camAuto && G.playing() && tw > 0.25 && Math.hypot(tx / tw, tz / tw) > 1.6) {
        const d = GZ.angDiff(Math.atan2(-tx, -tz), R.yaw), off = Math.abs(d);
        if (off > 0.6) yawMove = true; else if (off < 0.2) yawMove = false;
        if (yawMove) want = GZ.clamp(d * 1.0, -0.45, 0.45);
      } else yawMove = false;
      yawV += (want - yawV) * (1 - Math.exp(-dt * 5));   // 휙 꺾이지 않게 속도를 부드럽게
      if (Math.abs(yawV) < 0.002 && !want) yawV = 0;
      R.yaw += yawV * dt; R.yawV = yawV;
    }
    // 초점: 주인공과 「가장 위협적인 적들」(가깝고, 공격 준비 중일수록 무겁게)의 중간 쪽으로 부드럽게 밀기 — 옆 1.45m, 뒤 1.7m, 앞 0.5m 까지만
    {
      const sy = Math.sin(R.yaw), cy = Math.cos(R.yaw);
      let lat = 0, fwd = 0;
      if (tw > 0.01) {
        const k = 0.5 * GZ.sat(tw / 1.0), cx = (tx / tw) * k, cz = (tz / tw) * k;
        lat = GZ.clamp(cx * cy - cz * sy, -0.6, 0.6); fwd = GZ.clamp(-cx * sy - cz * cy, -0.7, 0.4);   // r4: 초점 밀기를 절반 이하로 (주인공이 화면 가운데에서 크게 벗어나지 않게 — 끌어 조준이 흔들리지 않음)
      }
      if (bossOn && !CAM_LV[G.camLv]) fwd = Math.max(fwd, GZ.clamp((Math.hypot(P.x - b.x, P.z - b.z) - 9) * 0.25, 0, 1.2));   // 보스가 멀면 초점을 조금 앞으로
      const ox = lat * cy - fwd * sy, oz = -lat * sy - fwd * cy, kk = 1 - Math.exp(-cdt * 2.2);
      camOX += (ox - camOX) * kk; camOZ += (oz - camOZ) * kk;
      if (!G.playing() && G.phase !== 'cards') { camOX *= 1 - kk; camOZ *= 1 - kk; }
    }
    // r7: 가로 보스전은 주인공 발을 조금 아래(+10%)로 — 보스 머리가 위 HUD(보스 체력 막대)에 잘리지 않게 (검토 B3)
    // r8 (검토 A4·B): 보스 머리 끝이 보스 막대 아래 6% 안으로 오면 발을 더 내림 (최대 +0.2)
    if (bossOn && !port) {
      R.project(b.x, BOSS_TOP, b.z, _bt); const barB = HUD.bossBarBottom ? HUD.bossBarBottom() : R.h * 0.12;
      const need = _bt.behind ? 0 : GZ.clamp((barB + R.h * 0.06 - _bt.y) / R.h, -0.1, 0.1);
      bossFeet = GZ.clamp(bossFeet + need * cdt * 2.5, 0.03, 0.2);   // 11-14 카메라 세움: 바닥 0.1→0.03 (세운 카메라는 보스 머리가 덜 올라가 발을 덜 내려도 됨 — 0.1 이면 발이 화면 96% 까지 내려감)
    } else bossFeet = 0.03;
    R.feetAdd = (R.feetAdd || 0) + ((bossOn && !port ? bossFeet : 0) - (R.feetAdd || 0)) * (1 - Math.exp(-cdt * 2));
    // 11-14 카메라 세움: 보스전(가로)만 내려다보는 각을 BOSS_PITCH 만큼 덜 세움 — 세운 각 그대로면 키 큰 보스 때문에 발이 화면 96% 까지 내려감
    R.pitchAdd = (R.pitchAdd || 0) + ((bossOn && !port ? BOSS_PITCH : 0) - (R.pitchAdd || 0)) * (1 - Math.exp(-cdt * 2));
    // r9b 가는 쪽으로 앞서 보기 (대표 실기 「아직 부족」 → 확실히 느껴지게): 움직이는 쪽으로 웨이브 최대 4.0m(가로 화면 폭 약 16%), 보스전 1.1m.
    //   · 감쇠 스프링(임계 감쇠): 움직이기 시작 0.3초에 절반·0.5초에 80% · 속도 최대 8.5m/s · 가속 최대 60m/s² (방향을 휙 바꿔도 덜컹 X)
    //   · 멈추면 1.0초 그대로 있다가 부드럽게 가운데로(약 1초) · 구르는 동안은 목표 고정 · 이동 없이 조준(호각)만 하면 조준 쪽으로 1.3m
    //   · 가로 화면은 위아래가 좁아 화면 위쪽으로 갈 땐 0.4배(1.6m — 주인공 발이 아래 버튼 쪽으로 안 내려가게)·아래(카메라 쪽)로 갈 땐 0.35배, 적 무리 반대쪽으로 물러나면 최대 0.8배로(적이 등 뒤 화면 밖으로 덜 밀리게 — ½ 은 실제 판에서 앞섬이 1.8m 로 줄어 안 느껴짐), 적 쪽으로 가면 +10%
    //   · 보스전: 보스와 주인공 중점 쪽으로 기울임(거리 × 0.24, 최대 2.0m) — 보스가 늘 화면 안에
    //   · 「전체 기상!」 컷·보스 등장·쓰러짐·승리 땐 목표 0 (연출 카메라가 덮음), 흔들림은 updateCamera 가 맨 끝에 더함
    {
      const str = CAM_LV[G.camLv] || 0;
      const live = G.playing() && !ult && !P.down && !P.win && G.phase !== 'bossIntro';
      const sy = Math.sin(R.yaw), cy = Math.cos(R.yaw);
      const setT = (ux, uz, L, downK) => {   // 바닥 방향(ux,uz)·길이 L → 목표 (가로 화면은 위아래가 좁아 화면 위쪽 0.4배·아래쪽 downK배)
        let lat = ux * cy - uz * sy, fwd = -ux * sy - uz * cy;
        fwd *= fwd < 0 ? downK : 0.4;
        leadTX = (lat * cy - fwd * sy) * L; leadTZ = (-lat * sy - fwd * cy) * L;
      };
      if (!str || !live) { leadTX = leadTZ = 0; leadBack = true; leadHold = LEAD.hold; }
      else if (P.rollT <= 0) {
        const sp = Math.hypot(P.vx, P.vz);
        const aiming = I.fire && I.aim != null && G.atk !== 'auto';
        const ml = Math.hypot(I.mx, I.mz);   // 스틱(키) 의도로 판단 — 멈출 때 속도가 줄며 앞섬이 같이 줄어 바로 돌아가 버리던 것 막음
        if (ml > 0.15 && (sp > 0.8 || ml > 0.5)) {
          const ux = sp > 0.8 ? P.vx / sp : I.mx / ml, uz = sp > 0.8 ? P.vz / sp : I.mz / ml;
          let L = (bossOn ? LEAD.boss : LEAD.wave) * str * GZ.sat(ml / 0.7);
          if (tw > 0.3 && !bossOn) { const tl = Math.hypot(tx, tz) || 1, dot = (ux * tx + uz * tz) / tl; L *= dot < 0 ? 1 - 0.2 * GZ.sat(-dot * 1.5) : 1 + 0.1 * dot; }
          setT(ux, uz, L, 0.35); leadHold = 0; leadBack = false;
        } else if (aiming) {
          setT(Math.sin(I.aim), Math.cos(I.aim), LEAD.aim * str * (bossOn ? 0.6 : 1), 0.6); leadHold = 0; leadBack = false;
        } else {
          leadHold += cdt;
          if (leadHold >= LEAD.hold) { leadTX = leadTZ = 0; leadBack = true; }
        }
      }
      // 보스 중점 기울임 (앞섬과 따로, 부드럽게)
      let lnX = 0, lnZ = 0;
      if (bossOn && str && G.playing()) {
        const dx = b.x - P.x, dz = b.z - P.z, d = Math.hypot(dx, dz) || 1, m = Math.min(LEAD.leanMax * str, d * LEAD.lean * str);
        lnX = (dx / d) * m; lnZ = (dz / d) * m;
      }
      const lk = 1 - Math.exp(-cdt * 2.5); leanX += (lnX - leanX) * lk; leanZ += (lnZ - leanZ) * lk;
      // 걷는 동안 화면 초점이 주인공을 0.15초 늦게 따라가 앞섬이 약 0.7m 덜 보이던 것 → 걷는 속도 × 0.11초 만큼 더해 상쇄 (멈추면 초점이 따라잡으며 0 이 되어 보이는 앞섬은 그대로 이어짐)
      const cmp = live && str && P.rollT <= 0 && !leadBack ? 0.11 * str : 0, gX = leadTX + P.vx * cmp, gZ = leadTZ + P.vz * cmp;
      // 감쇠 스프링 (잘게 나눠 계산 — 프레임이 떨어져도 같은 움직임)
      const w = leadBack ? LEAD.wBack : LEAD.w, n = Math.max(1, Math.ceil(cdt / (1 / 120))), h = cdt / n;
      for (let i = 0; i < n; i++) {
        let ax = w * w * (gX - leadX) - 2 * w * leadVX, az = w * w * (gZ - leadZ) - 2 * w * leadVZ;
        const al = Math.hypot(ax, az); if (al > LEAD.amax) { ax *= LEAD.amax / al; az *= LEAD.amax / al; }
        leadVX += ax * h; leadVZ += az * h;
        const vl = Math.hypot(leadVX, leadVZ); if (vl > LEAD.vmax) { leadVX *= LEAD.vmax / vl; leadVZ *= LEAD.vmax / vl; }
        leadX += leadVX * h; leadZ += leadVZ * h;
      }
    }
    R.updateCamera(cdt, P.x, P.z, camOX, camOZ, false, leadX + leanX, leadZ + leanZ);   // r9b: 앞섬은 스프링이 이미 부드러워서 초점 늦춤(0.15초)을 거치지 않고 바로 더함
    // 얼굴 컷인 (「차렷!」·정박 5연속): 카메라를 흔들지 않고 화면 한쪽 작은 창에 얼굴을 보여 줌
    if (cutT > 0) { cutT -= dt; R.cutIn(cutT > 0 && G.playing() && !ult, P.x, P.z, P.face); if (cutT <= 0) R.cutIn(false); }
    HUD.mode(G.phase === 'boss' || G.phase === 'bossIntro', G.phase === 'bossIntro' || (G.phase === 'win'), !!ult && ult.t < (ult.bossCam ? 1.3 : 1.0));
    HUD.update(dt);
    if (!G.paused) AU.tick(G.bt);
    if (!G.noRender) R.render(dt);
  }
  G.draw = draw;

  // ---------- 시작 ----------
  async function boot() {
    HUD.init();
    R.init(document.getElementById('c'));
    FX.init(R.scene);
    GZ.AR.build(R.scene);
    GZ.HERO.build(R.scene);
    HUD.loadProgress(0.3);
    try { await GZ.MD.load((k) => HUD.loadProgress(0.3 + k * 0.6)); } catch (e) { console.warn(e); }
    if (GZ.MD.hejo) GZ.HERO.useGlb(GZ.MD.hejo);
    if (GZ.AR.addLandmarks) GZ.AR.addLandmarks(R.scene);   // r6: 배경 시계탑·발전소
    EN.init(R.scene);
    GZ.onResize = () => HUD.layout();
    HUD.loadProgress(1);
    G.toTitle();
    R.updateCamera(0.016, P.x, P.z, 0, 0, true);
    // 셰이더 미리 굽기 (첫 적·첫 폭발에서 멈칫하지 않게)
    try { const e1 = EN.spawn('drone', 3, 3), e2 = EN.spawn('shield', -3, 3), e3 = EN.spawn('absorber', 0, 4), e4 = EN.spawn('turret', 5, 5), e5 = EN.spawn('brute', -5, 5), e6 = EN.spawn('metro', 2, -3); R.renderer.compile(R.scene, R.camera); EN.reset(); void e1; void e2; void e3; void e4; void e5; void e6; } catch (e) { console.warn(e); }
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
    if (GZ.Q.auto) G.start();
  }

  // ---------- 시험 훅 ----------
  // 시험용: 주인공이 화면에서 차지하는 높이 비율·발 위치(화면 높이 대비)·보이는 좌우 폭(m)
  const _pj = { x: 0, y: 0, behind: false };
  function camInfo() {
    R.project(P.x, 0, P.z, _pj); const fy = _pj.y, fx = _pj.x;
    R.project(P.x, GZ.HERO.cfg.height, P.z, _pj); const hy = _pj.y;
    R.project(P.x + 1, 0, P.z, _pj); const mpp = Math.abs(_pj.x - fx);
    // 화면 안(HUD 위 12% ~ 버튼 위)에 보이는 적 수
    let vis = 0, tot = 0; const o = { x: 0, y: 0, behind: false };
    for (const e of EN.list) { if (e.dead) continue; tot++; R.project(e.x, e.kind === 'boss' ? 2.8 : 1, e.z, o); if (!o.behind && o.x > 0 && o.x < R.w && o.y > R.h * 0.08 && o.y < R.h) vis++; }
    R.project(P.x + Math.sin(P.face), 0, P.z + Math.cos(P.face), _pj); const fax = _pj.x - fx, fay = _pj.y - fy;
    return { faceScr: +Math.atan2(fax, -fay).toFixed(3), body: +GZ.angDiff(GZ.HERO.bodyYaw ? GZ.HERO.bodyYaw() : P.face, R.yaw + Math.PI).toFixed(3), heroH: +((fy - hy) / R.h).toFixed(4), feetY: +(fy / R.h).toFixed(4), feetX: +(fx / R.w).toFixed(3), widthM: +(R.w / (mpp || 1)).toFixed(2), zoom: +R.zoom.toFixed(3), yaw: +R.yaw.toFixed(3), vis, tot, rig: R.rig };
  }
  window.__gz = {
    state() {
      const b = EN.boss;
      return {
        phase: G.phase, paused: G.paused, t: +G.t.toFixed(3), bt: +G.bt.toFixed(3), time: +(stats ? stats.time : 0).toFixed(2),
        hp: P.hp, maxHp: P.maxHp, gauge: +P.gauge.toFixed(2), x: +P.x.toFixed(3), z: +P.z.toFixed(3), face: P.face, inv: P.inv, down: P.down, rollCd: P.rollCd, skillCd: P.skillCd, streak: P.streak,
        combo: G.combo, enemies: EN.alive(), remaining: G.remaining(), shots: EN.shots.length, waves: G.waves.length, wave: stats ? stats.wave : 0,
        boss: b && !b.dead ? { hp: b.hp, max: b.max, phase: b.phase, state: b.state, stun: b.stun, vuln: b.vuln } : null,
        stats: stats ? Object.assign({}, stats) : null, upg: Object.assign({}, U.lv), hero: GZ.HERO.kind, clips: GZ.HERO.clips || [], models: { hejo: !!GZ.MD.hejo, boss: !!GZ.MD.boss, shield: !!GZ.MD.shield, brute: !!GZ.MD.brute, crawler: !!GZ.MD.crawler, conductor: !!GZ.MD.conductor, clock: !!GZ.MD.clock, power: !!GZ.MD.power, landmarks: GZ.AR.landmarks ? GZ.AR.landmarks.length : 0 },
        diff: G.diff, lives: P.lives, ultBlocked: G.ultBlocked, skillWind: P.skillWind, atk: G.atk, lead: G.lead(),
        fps: +R.fps.toFixed(1), pr: R.pr, cam: camInfo(), calls: R.renderer.info.render.calls, tris: R.renderer.info.render.triangles,
        list: EN.list.filter((e) => !e.dead).map((e) => ({ id: e.id, kind: e.kind, x: +e.x.toFixed(2), z: +e.z.toFixed(2), hp: e.hp, state: e.state, stun: +e.stun.toFixed(2), broken: +e.broken.toFixed(2), face: e.face })),
      };
    },
    run(n) { for (let i = 0; i < n; i++) G.step(STEP); return this.state(); },
    // r7 시험: 규칙 걸음 + 화면 계산(카메라·HUD)을 같이 n 걸음 돌리며(그리기는 생략) 「적이 화면에 보이는 시간」을 잼
    tick(n, o) {
      o = o || {}; G.noRender = !o.render; const r = { fight: 0, vis: 0, boss: 0, bossIn: 0, bossInY: 0, offMax: 0, nums: 0, off: 0 }; const q = { x: 0, y: 0, behind: false };
      for (let i = 0; i < n; i++) {
        G.step(STEP); draw(STEP, STEP);
        if (!(G.phase === 'play' || G.phase === 'boss') || P.down) continue;
        let any = false, vis = false;
        for (const e of EN.list) { if (e.dead || e.spawnT > 0 || e.hidden) continue; any = true; if (vis || !e.grp.visible) continue; R.project(e.x, e.kind === 'boss' ? 2.8 : 1, e.z, q); if (!q.behind && q.x > 0 && q.x < R.w && q.y > R.h * 0.08 && q.y < R.h * 0.98) vis = true; }
        if (!any) continue;
        r.fight++; if (vis) r.vis++;
        const b = EN.boss;
        if (b && !b.dead && b.spawnT <= 0 && G.phase === 'boss') { r.boss++; R.project(b.x, 2.8, b.z, q); if (!q.behind && q.x > R.w * 0.2 && q.x < R.w * 0.8) r.bossIn++; if (!q.behind && q.y > R.h * 0.12 && q.y < R.h * 0.75) r.bossInY++; }
      }
      G.noRender = false; return r;
    },
    input(o) { testInput = o; if (!o) { I.mx = I.mz = 0; I.fire = false; I.aim = null; } },
    press(name) { I[name + 'P'] = true; },
    bot(m) { botMode = m || ''; if (!m) { I.mx = I.mz = 0; I.fire = false; I.aim = null; } },
    pause(v) { G.paused = !!v; },
    freeze(v) { G.frozen = !!v; },   // 시험용: 화면 걸음(실시간)을 끔 — G.start() 가 일시정지를 풀어도 규칙은 run() 으로만 흐름
    clearHazards() { EN.clearHazards(); },
    set(k, v) { if (k === 'hints') hintForce = !!v; else if (k === 'wave') stats.wave = v; else if (k in P) P[k] = v; else if (k in U) U[k] = v; else if (k === 'god') G.god = v; else if (k === 'bt') G.bt = v; else if (k === 'waveT' && wave) wave.t = v; else if (k === 'noSpawn' && wave) { wave.gi = v ? 999 : 0; wave.def = { groups: [], lvl: 1, name: '', sub: '' }; } },
    spawn(kind, x, z, o) { const e = EN.spawn(kind, x, z, o); if (o && o.ready) { e.spawnT = 0; e.state = kind === 'turret' || kind === 'boss' ? 'idle' : 'chase'; if (e.tg) { e.tg.free(); e.tg = null; } } return e.id; },
    ent(id) { return EN.list.find((e) => e.id === id); },
    start() { G.start(); },
    jump(to) {
      if (to === 'title') return G.toTitle();
      if (G.phase === 'title' || G.phase === 'result' || G.phase === 'loading') G.start();
      if (to === 'play') { wave.t = 0; G.phase = 'play'; }
      else if (to === 'empty') { wave = null; G.phase = 'play'; EN.reset(); }
      else if (to === 'w2' || to === 'w3') { EN.reset(); startWave(to === 'w2' ? 1 : 2); wave.t = 0; G.phase = 'play'; }
      else if (to === 'cards') { EN.reset(); wave.gi = 999; G.phase = 'clear'; G.pt = 9; openCards(); }
      else if (to === 'boss') { EN.reset(); startBoss(); }
      else if (to === 'bossfight') { EN.reset(); startBoss(); const b = EN.boss; b.spawnT = 0; b.state = 'idle'; G.phase = 'boss'; }
      else if (to === 'result') { EN.reset(); startBoss(); const b = EN.boss; b.spawnT = 0; b.state = 'idle'; G.phase = 'boss'; stats.win = true; P.win = true; finish(true); }
      else if (to === 'boss2' || to === 'boss3' || to === 'boss4') { EN.reset(); startBoss(); const b = EN.boss; b.spawnT = 0; b.state = 'idle'; G.phase = 'boss'; const ph = +to.slice(4); b.hp = b.max * (ph === 2 ? 0.6 : ph === 3 ? 0.36 : 0.15); b.phase = ph; stats.bossPhase = ph; AU.bossPhase = ph; }   // r5: 단계를 바로 맞춤 (4단계 — 전환을 여러 번 거치지 않게)
      else if (to === 'win') { EN.reset(); startBoss(); const b = EN.boss; b.spawnT = 0; b.state = 'idle'; G.phase = 'boss'; EN.damage(b, 99999, P.x, P.z, { ult: true }); }
      else if (to === 'lose') { G.god = false; P.inv = 0; G.hurt(9999, P.x + 1, P.z); }
      else if (to === 'ult') { P.gauge = 100; I.ultP = true; }
      return this.state();
    },
    touch() { return HUD.touchState(); },
    // 바닥 방향각이 화면에서 가리키는 쪽 (0 = 위, +π/2 = 오른쪽) / 그 반대
    scrAng(a) { const o = { x: 0, y: 0 }, q = { x: 0, y: 0 }; R.project(P.x, 1, P.z, o); R.project(P.x + Math.sin(a) * 2, 1, P.z + Math.cos(a) * 2, q); return Math.atan2(q.x - o.x, -(q.y - o.y)); },
    hints() { return { log: G.hintLog.slice(), q: hintQ.map((h) => h.key), cur: hintCur ? hintCur.key : null }; },
    cards() { return G.phase === 'cards' && G.cardIds ? G.cardIds.slice() : null; },
    diff(d) { if (d) G.setDiff(d); return { diff: G.diff, D: G.D }; },
    hs() { return { frames: G.hsFrames, steps: G.hsSteps }; },
    G, EN,
  };

  window.addEventListener('DOMContentLoaded', boot);
})();
