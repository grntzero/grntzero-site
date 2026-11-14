/* 톱니골 던전 — 소리: TG_AUDIO 샘플 + Web Audio 합성(말렛·밝은 신스·황동 클릭), 동시 재생 제한, 덕킹, BGM 크로스페이드, 음량 재기 */
(function () {
  'use strict';
  const TG = window.TG;
  const A = (TG.A = {
    ctx: null, buffers: {}, ready: false, vol: { bgm: 0.8, sfx: 0.9 }, active: 0, per: {}, curBgm: null, bgmName: null,
  });
  const LIMIT = { sfx_pop: 6, sfx_pick: 4, sfx_wave: 3, sfx_tick: 2, sfx_steam: 2, sfx_bonk: 2, sfx_big: 2, sfx_ui: 3, sfx_bossend: 1 };
  const MAX_VOICES = 22;
  const COMP = { threshold: -14, knee: 10, ratio: 4, attack: 0.004, release: 0.18 };

  // 미리 풀기: OfflineAudioContext 로 디코딩(사용자 입력 전에도 경고 없이 가능)
  A.preload = function () {
    if (!window.TG_AUDIO) return Promise.resolve();
    let off;
    try { off = new OfflineAudioContext(2, 44100, 44100); } catch (e) { return Promise.resolve(); }
    const names = Object.keys(window.TG_AUDIO);
    return Promise.all(names.map((n) => off.decodeAudioData(TG.b64ToBuf(window.TG_AUDIO[n])).then((b) => { A.buffers[n] = b; }).catch(() => {})))
      .then(() => { A.ready = true; });
  };

  function makeComp(ctx) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = COMP.threshold; comp.knee.value = COMP.knee; comp.ratio.value = COMP.ratio; comp.attack.value = COMP.attack; comp.release.value = COMP.release;
    return comp;
  }

  A.makeComp = makeComp;   // 11-14 비서 목소리 크기 시험(TG.SV.measure)이 같은 압축기를 씀

  // 첫 터치/키 때 열기
  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended' && !A.paused) A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.master = ctx.createGain(); A.master.gain.value = TG.Q.mute ? 0 : 1;
    const comp = makeComp(ctx);
    A.master.connect(comp); comp.connect(ctx.destination);
    A.bgmBus = ctx.createGain(); A.bgmBus.gain.value = 0.5 * A.vol.bgm; // -6dB
    A.duckG = ctx.createGain(); A.duckG.gain.value = 1;
    // 11-14 비서 목소리: 쎌이 말하는 동안 음악·효과음을 살짝 낮추는 마디(A.vduck) + 목소리 버스(효과음 막대를 따름)
    A.vduckM = ctx.createGain(); A.vduckS = ctx.createGain();
    A.bgmBus.connect(A.duckG); A.duckG.connect(A.vduckM); A.vduckM.connect(A.master);
    A.sfxBus = ctx.createGain(); A.sfxBus.gain.value = A.vol.sfx;
    A.sfxBus.connect(A.vduckS); A.vduckS.connect(A.master);
    A.voiceBus = ctx.createGain(); A.voiceBus.gain.value = A.vol.sfx * A.VOICE_GAIN; A.voiceBus.connect(A.master);
    if (A.pendingBgm) { const p = A.pendingBgm; A.pendingBgm = null; A.bgm(p.name, p.fade, p.loop); }
  };

  A.setVol = function (bgm, sfx) {
    A.vol.bgm = bgm; A.vol.sfx = sfx;
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.bgmBus.gain.setTargetAtTime(0.5 * bgm, t, 0.05);
    A.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
    if (A.voiceBus) A.voiceBus.gain.setTargetAtTime(sfx * A.VOICE_GAIN, t, 0.05);
  };
  A.VOICE_GAIN = 0.32;   // 11-14 비서 쎌 목소리 크기(효과음 막대 × 이 값) — tools/test_assist_voice 「비서 목소리 크기」(가장 센 0.3초가 0.25초 넘는 효과음 중앙값보다 3~6dB 크게)
  // 11-14 비서 목소리 더킹: dur 초 동안 음악 m(기본 0.5 = −6dB)·효과음 k(기본 0.7 ≈ −3dB), 끝나면 0.25초에 걸쳐 돌아옴
  A.vduck = function (dur, m, k) {
    if (!ok() || !A.vduckM) return;
    const t = A.ctx.currentTime;
    [[A.vduckM.gain, m == null ? 0.5 : m], [A.vduckS.gain, k == null ? 0.7 : k]].forEach(([g, v]) => {
      try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, 0.03); g.setTargetAtTime(1, t + Math.max(0.05, dur), 0.08); } catch (e) { g.value = 1; }
    });
  };
  A.vduckLevel = () => (A.vduckM ? [A.vduckM.gain.value, A.vduckS.gain.value] : [1, 1]);

  function ok() { return A.ctx && A.ctx.state !== 'closed'; }

  A.play = function (name, o) {
    if (!ok()) return;
    const buf = A.buffers[name]; if (!buf) return;
    o = o || {};
    const lim = LIMIT[name] || 3;
    if ((A.per[name] || 0) >= lim || A.active >= MAX_VOICES) return;
    const ctx = A.ctx, src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.gain != null ? o.gain : 1;
    src.connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = TG.clamp(o.pan, -1, 1); g.connect(p); p.connect(A.sfxBus); }
    else g.connect(A.sfxBus);
    A.per[name] = (A.per[name] || 0) + 1; A.active++;
    src.onended = () => { A.per[name]--; A.active--; };
    src.start(ctx.currentTime + (o.delay || 0));
  };

  // ── 합성 도구 (ctx·나갈 곳·시작 시각을 받아 실제 재생과 음량 재기에 똑같이 씀) ──
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(ctx, out, t, type, f0, f1, glide, a, peak, d) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    const g = ctx.createGain(); env(g, t, a, peak, d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.03);
    return o;
  }
  const noiseMap = new WeakMap();
  function noise(ctx) {
    let b = noiseMap.get(ctx);
    if (b) return b;
    const n = Math.floor(ctx.sampleRate * 0.25); b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 987654321; // 고정 잡음(재기 결과가 매번 같게)
    for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648 - 1); }
    noiseMap.set(ctx, b);
    return b;
  }
  // 황동 클릭: 짧은 대역 잡음 + 금속 공명
  function click(ctx, out, t, f, peak, d) {
    const src = ctx.createBufferSource(); src.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 7;
    const g = ctx.createGain(); env(g, t, 0.001, peak, d || 0.04);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + (d || 0.04) + 0.03);
    tone(ctx, out, t, 'sine', f * 0.56, 0, 0, 0.001, peak * 0.35, (d || 0.04) * 2.5);
  }
  // 말렛(마림바·실로폰 느낌): 기본음 + 4배음 짧게 + 톡
  function mallet(ctx, out, t, f, peak, d) {
    tone(ctx, out, t, 'sine', f, 0, 0, 0.003, peak, d || 0.32);
    tone(ctx, out, t, 'sine', f * 4, 0, 0, 0.002, peak * 0.3, (d || 0.32) * 0.22);
    tone(ctx, out, t, 'triangle', f * 2, 0, 0, 0.002, peak * 0.18, (d || 0.32) * 0.5);
  }
  // 밝은 신스: 세모 + 살짝 어긋난 네모
  function bright(ctx, out, t, f, peak, d) {
    tone(ctx, out, t, 'triangle', f, 0, 0, 0.006, peak, d);
    tone(ctx, out, t, 'square', f * 2.003, 0, 0, 0.006, peak * 0.16, d * 0.7);
  }

  const SYN = (A.SYN = {});
  // 소리 파동: 짧은 톱니파 스윕 + 필터
  SYN.wave = function (ctx, out, t, o) {
    const level = o.level || 0;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const f0 = 180 + level * 40, f1 = 520 + level * 160;
    osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + 0.09); osc.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.2);
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(f0 * 0.5, t); o2.frequency.exponentialRampToValueAtTime(f1 * 0.5, t + 0.1);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(3200 + level * 900, t + 0.07); lp.frequency.exponentialRampToValueAtTime(600, t + 0.22);
    const g = ctx.createGain(); env(g, t, 0.008, 0.11 + level * 0.04, 0.2 + level * 0.06);
    osc.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    osc.start(t); o2.start(t); osc.stop(t + 0.35 + level * 0.1); o2.stop(t + 0.35 + level * 0.1);
    return 0.4;
  };
  // 둘레 링이 커질 때: 단계별 상승 웅웅
  SYN.charge = function (ctx, out, t, o) {
    const base = [0, 196, 262, 349][o.level || 1] || 196;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(base * 0.8, t); osc.frequency.exponentialRampToValueAtTime(base, t + 0.12);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 2.005;
    const trem = ctx.createOscillator(); trem.frequency.value = 9; const tg = ctx.createGain(); tg.gain.value = 0.35;
    const g = ctx.createGain(); env(g, t, 0.03, 0.16, 0.42);
    const am = ctx.createGain(); am.gain.value = 0.7; trem.connect(tg); tg.connect(am.gain);
    osc.connect(am); o2.connect(am); am.connect(g); g.connect(out);
    [osc, o2, trem].forEach((n) => { n.start(t); n.stop(t + 0.5); });
    return 0.5;
  };
  SYN.pop = function (ctx, out, t, o) { // 퐁 (합성 층)
    const f = (o.big ? 420 : 720) * (o.up || 1) * (o.jit || 1);
    tone(ctx, out, t, 'sine', f * 1.6, f * 0.6, 0.09, 0.004, o.big ? 0.22 : 0.13, 0.1);
    return 0.15;
  };
  SYN.hitSmall = function (ctx, out, t, o) { // 맞힘 톡
    tone(ctx, out, t, 'square', 900 * (o.jit || 1), 300, 0.05, 0.002, 0.07, 0.05);
    return 0.08;
  };
  SYN.boom = function (ctx, out, t) { // 큰 소리 저음 쿵 + 화음 반짝
    tone(ctx, out, t, 'sine', 140, 38, 0.5, 0.01, 0.5, 0.6);
    [523, 659, 784, 1046].forEach((f, i) => tone(ctx, out, t + 0.05 + i * 0.05, 'triangle', f, 0, 0, 0.01, 0.07, 0.5));
    return 0.9;
  };
  let tock = 0;
  SYN.tick = function (ctx, out, t, o) { // 째깍 딸깍
    tock ^= 1; const gain = o.gain || 0.5;
    click(ctx, out, t, tock ? 4200 : 3300, 0.5 * gain, 0.04);
    tone(ctx, out, t, 'sine', tock ? 2350 : 1870, 0, 0, 0.001, 0.08 * gain, 0.12);
    return 0.15;
  };
  SYN.ui = function (ctx, out, t, o) { // 버튼: 짧은 방울 톡
    const f = 520 * (o.pitch || 1);
    tone(ctx, out, t, 'sine', f, f * 2.2, 0.06, 0.004, 0.22, 0.09);
    return 0.14;
  };
  SYN.cheer = function (ctx, out, t, o) { // 연속 보상 아르페지오
    const notes = [[523, 659, 784], [587, 740, 880, 1175], [659, 831, 988, 1319, 1568]][o.lv || 0] || [523, 659, 784];
    notes.forEach((f, i) => tone(ctx, out, t + i * 0.07, 'triangle', f, 0, 0, 0.005, 0.12, 0.28));
    return 0.7;
  };
  SYN.countBeep = function (ctx, out, t, o) {
    tone(ctx, out, t, 'square', o.hi ? 880 : 523, 0, 0, 0.005, 0.12, o.hi ? 0.45 : 0.18);
    return 0.5;
  };
  // ── V2 새 효과음 ──
  let stepAlt = 0;
  SYN.step = function (ctx, out, t) { // 걷기: 통통 낮은 말렛 + 살짝 톡
    stepAlt ^= 1;
    const f = stepAlt ? 196 : 233;
    tone(ctx, out, t, 'sine', f * 1.5, f, 0.04, 0.003, 0.15, 0.09);
    click(ctx, out, t, 1500, 0.07, 0.02);
    return 0.12;
  };
  SYN.levelUp = function (ctx, out, t) { // 레벨업: 말렛 도미솔도 + 반짝
    [523, 659, 784, 1047].forEach((f, i) => mallet(ctx, out, t + i * 0.075, f, 0.2, 0.35));
    bright(ctx, out, t + 0.3, 1568, 0.1, 0.4);
    return 0.8;
  };
  SYN.cardPick = function (ctx, out, t) { // 카드 고름: 황동 클릭 + 말렛 두 음
    click(ctx, out, t, 3000, 0.3, 0.03);
    mallet(ctx, out, t + 0.02, 784, 0.2, 0.2);
    mallet(ctx, out, t + 0.1, 1047, 0.22, 0.32);
    return 0.45;
  };
  SYN.bigReady = function (ctx, out, t) { // 큰 소리 준비: 밝은 신스 두 음 상승 + 반짝
    bright(ctx, out, t, 659, 0.18, 0.16);
    bright(ctx, out, t + 0.11, 988, 0.22, 0.34);
    tone(ctx, out, t + 0.2, 'sine', 1976, 2637, 0.12, 0.004, 0.08, 0.25);
    return 0.5;
  };
  SYN.bossIn = function (ctx, out, t) { // 보스 등장: 낮은 황동 부풂 + 둥 + 톱니 클릭
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(98, t); osc.frequency.exponentialRampToValueAtTime(73, t + 0.9);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(147, t); o2.frequency.exponentialRampToValueAtTime(110, t + 0.9);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.35); lp.frequency.exponentialRampToValueAtTime(320, t + 1.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    [osc, o2].forEach((n) => { n.start(t); n.stop(t + 1.25); });
    tone(ctx, out, t, 'sine', 110, 45, 0.4, 0.008, 0.45, 0.5);
    [0.5, 0.62, 0.74].forEach((d, i) => click(ctx, out, t + d, 2400 + i * 300, 0.2, 0.03));
    return 1.3;
  };
  SYN.bossPhase = function (ctx, out, t) { // 보스 단계 변화: 내려오는 말렛 셋 + 둥
    [880, 698, 523].forEach((f, i) => mallet(ctx, out, t + i * 0.08, f, 0.22, 0.3));
    tone(ctx, out, t + 0.02, 'sine', 160, 60, 0.3, 0.008, 0.35, 0.35);
    return 0.6;
  };
  SYN.rescue = function (ctx, out, t) { // 주민 구조: 통통 올라가는 말렛 + 고마워 짹
    [659, 784, 988, 1319].forEach((f, i) => mallet(ctx, out, t + i * 0.085, f, 0.2, 0.28));
    tone(ctx, out, t + 0.36, 'sine', 1319, 1760, 0.08, 0.004, 0.13, 0.16);
    return 0.7;
  };
  SYN.covered = function (ctx, out, t) { // 폭 덮임: 뿌우~ 내려가는 부드러운 소리 + 푹
    tone(ctx, out, t, 'triangle', 440, 150, 0.45, 0.01, 0.26, 0.5);
    tone(ctx, out, t + 0.04, 'sine', 330, 110, 0.45, 0.01, 0.16, 0.5);
    tone(ctx, out, t + 0.42, 'sine', 120, 55, 0.2, 0.006, 0.3, 0.25);
    return 0.8;
  };
  SYN.gruntHelp = function (ctx, out, t) { // 비서 그런트 도움: 태엽 감는 클릭(점점 빨리) + 올라가는 말렛
    let d = 0;
    for (let i = 0; i < 8; i++) { click(ctx, out, t + d, 2200 + i * 180, 0.22, 0.025); d += 0.09 - i * 0.008; }
    [523, 784, 1047].forEach((f, i) => mallet(ctx, out, t + d + i * 0.07, f, 0.22, 0.35));
    return 1.1;
  };
  SYN.shelter = function (ctx, out, t) { // 쉼터 진입: 포근한 차임 두 음 + 부드러운 바탕
    mallet(ctx, out, t, 523, 0.2, 0.6);
    mallet(ctx, out, t + 0.16, 784, 0.2, 0.7);
    tone(ctx, out, t, 'sine', 262, 0, 0, 0.08, 0.1, 0.8);
    return 0.95;
  };
  SYN.echo = function (ctx, out, t) { // 메아리 튕김: 통~ 통~ 통 (점점 작게)
    [0, 0.11, 0.22].forEach((d, i) => tone(ctx, out, t + d, 'sine', 620 * (1 + i * 0.06), 900 * (1 + i * 0.06), 0.07, 0.003, 0.24 * Math.pow(0.55, i), 0.12));
    click(ctx, out, t, 3600, 0.12, 0.02);
    return 0.4;
  };
  SYN.boing = function (ctx, out, t) { // 뽀잉: 닿았을 때 통 튀는 소리
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t); osc.frequency.exponentialRampToValueAtTime(620, t + 0.08); osc.frequency.exponentialRampToValueAtTime(300, t + 0.2); osc.frequency.exponentialRampToValueAtTime(420, t + 0.28);
    const g = ctx.createGain(); env(g, t, 0.005, 0.28, 0.3);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.36);
    return 0.36;
  };
  SYN.shield = function (ctx, out, t) { // 보호 방울이 대신 톡
    tone(ctx, out, t, 'sine', 880, 1320, 0.06, 0.003, 0.2, 0.14);
    click(ctx, out, t, 4000, 0.12, 0.02);
    return 0.2;
  };

  let synthCount = 0;
  function synthOk() { return ok() && synthCount < 12; }
  // 합성 효과음 실제 재생
  A.syn = function (name, o) {
    if (!synthOk() || !SYN[name]) return;
    const dur = SYN[name](A.ctx, A.sfxBus, A.ctx.currentTime + ((o && o.delay) || 0), o || {});
    synthCount++; setTimeout(() => synthCount--, dur * 1000 + 50);
  };

  // ── 예전 이름 그대로 (다른 파일에서 부름) ──
  A.wave = function (level) {
    A.syn('wave', { level });
    A.play('sfx_wave', { rate: 1 + level * 0.08 + TG.fra(-0.04, 0.04), gain: 0.55 + level * 0.12 });
  };
  A.charge = function (level) { A.syn('charge', { level }); };
  A.pop = function (combo, big) { // 퐁: 피치 랜덤 ±, 연속일 때 점점 올라감
    if (!ok()) return;
    const up = 1 + Math.min(combo || 0, 24) * 0.022;
    A.play('sfx_pop', { rate: (big ? 0.8 : 1) * up * TG.fra(0.92, 1.1), gain: big ? 0.95 : 0.7 });
    A.syn('pop', { big, up, jit: TG.fra(0.9, 1.12) });
  };
  let pickChain = 0, lastPick = 0;
  A.pick = function () { // 줍기: 연속이면 반음씩 올라감 (소리 층만의 시계 — 규칙 계산과 무관)
    if (!ok()) return;
    const now = A.ctx.currentTime;
    pickChain = now - lastPick < 0.45 ? Math.min(pickChain + 1, 14) : 0;
    lastPick = now;
    A.play('sfx_pick', { rate: Math.pow(2, pickChain / 12), gain: 0.8 });
  };
  A.hitSmall = function () { A.syn('hitSmall', { jit: TG.fra(0.9, 1.1) }); };
  A.boom = function () { A.syn('boom'); };
  A.tick = function (gain) { A.syn('tick', { gain }); };
  A.ui = function (pitch) { A.syn('ui', { pitch }); };
  A.cheer = function (lv) { A.syn('cheer', { lv }); };
  A.countBeep = function (hi) { A.syn('countBeep', { hi }); };

  // 덕킹: 큰 소리 순간 BGM 낮춤
  A.duck = function (amt, dur) {
    if (!ok()) return;
    const t = A.ctx.currentTime, g = A.duckG.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(amt, t + 0.04);
    g.linearRampToValueAtTime(1, t + 0.04 + dur);
  };

  // BGM 크로스페이드
  A.bgm = function (name, fade, loop) {
    fade = fade == null ? 1 : fade; loop = loop !== false;
    if (!ok()) { A.pendingBgm = { name, fade, loop }; return; }
    if (A.bgmName === name) return;
    const ctx = A.ctx, t = ctx.currentTime;
    if (A.curBgm) {
      const old = A.curBgm;
      old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t);
      old.g.gain.linearRampToValueAtTime(0.0001, t + fade);
      old.src.stop(t + fade + 0.05);
    }
    A.curBgm = null; A.bgmName = name;
    const buf = A.buffers[name]; if (!buf) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fade));
    src.connect(g); g.connect(A.bgmBus); src.start(t);
    A.curBgm = { src, g };
  };
  A.stopBgm = function (fade) {
    A.pendingBgm = null;
    if (!ok() || !A.curBgm) { A.bgmName = null; return; }
    const t = A.ctx.currentTime, c = A.curBgm;
    c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.5));
    c.src.stop(t + (fade || 0.5) + 0.05);
    A.curBgm = null; A.bgmName = null;
  };
  A.pause = function (p) { A.paused = p; if (A.ctx) { if (p) A.ctx.suspend(); else A.ctx.resume(); } };

  // ── 음량 재기 (시험용): 효과음마다 실제와 같은 길(효과음 크기 → 컴프레서)로 따로 렌더해 최대 음량(dBFS)을 잼 ──
  // 게임에서 실제로 쓰는 크기(샘플은 재생 gain, 합성은 기본 인자)
  const USE = {
    sfx_pop: { gain: 0.7 }, sfx_pick: { gain: 0.8 }, sfx_wave: { gain: 0.55 }, sfx_steam: { gain: 0.6 }, sfx_bonk: { gain: 0.8 }, sfx_big: { gain: 1 }, sfx_bossend: { gain: 1 },
  };
  const SYN_USE = { wave: { level: 0 }, charge: { level: 1 }, tick: { gain: 0.5 }, countBeep: { hi: true } };
  // 11-14: 가장 센 0.3초 RMS (효과음·비서 목소리 크기를 같은 잣대로 비교)
  A.max300 = function (d, sr) {
    const w = Math.round(sr * 0.3), hop = Math.round(sr * 0.05); let best = 0;
    for (let i = 0; i + 1 <= d.length; i += hop) { let q = 0; const e = Math.min(d.length, i + w); for (let j = i; j < e; j++) q += d[j] * d[j]; best = Math.max(best, Math.sqrt(q / w)); }
    return best;
  };
  A.measure = function (sfxVol) {
    const sr = 44100, vol = sfxVol != null ? sfxVol : 0.9;
    const one = (label, kind, build) => {
      const off = new OfflineAudioContext(1, sr * 2, sr);
      const bus = off.createGain(); bus.gain.value = vol;
      const comp = makeComp(off); bus.connect(comp); comp.connect(off.destination);
      build(off, bus);
      return off.startRendering().then((buf) => {
        const d = buf.getChannelData(0); let peak = 0, sq = 0, n = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.001) { sq += v * v; n++; } }
        const db = (v) => (v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -120);
        return { name: label, kind, peakDb: db(peak), rmsDb: db(n ? Math.sqrt(sq / n) : 0), ms: Math.round((n / sr) * 1000), max300Db: db(A.max300(d, sr)) };
      });
    };
    const jobs = [];
    Object.keys(SYN).forEach((name) => jobs.push(one(name, '합성', (ctx, bus) => SYN[name](ctx, bus, 0.05, SYN_USE[name] || {}))));
    Object.keys(USE).forEach((name) => {
      if (!A.buffers[name]) { jobs.push(Promise.resolve({ name, kind: '샘플', peakDb: -120, rmsDb: -120, ms: 0, missing: true })); return; }
      jobs.push(one(name, '샘플', (ctx, bus) => { const s = ctx.createBufferSource(); s.buffer = A.buffers[name]; const g = ctx.createGain(); g.gain.value = USE[name].gain; s.connect(g); g.connect(bus); s.start(0.05); }));
    });
    return Promise.all(jobs);
  };
})();
