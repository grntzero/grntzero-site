/* GRUNT ZERO RE — 소리: 전부 WebAudio 합성 (파일 0). 효과음 + 박자 BGM 시퀀서(120BPM, 규칙 시계에 맞춤) */
(function () {
  'use strict';
  const GZ = window.GZ;
  const AU = (GZ.AU = {});
  AU.BPM = 120;
  AU.BEAT = 60 / AU.BPM;      // 0.5초
  AU.STEP = AU.BEAT / 4;      // 16분음표
  AU.vol = { bgm: 0.8, sfx: 0.9 };
  AU.mode = 'off';            // off | title | w1 | w2 | w3 | break | boss | end
  AU.muteUntil = -1;          // 이 박자 시각까지 드럼 쉼 (궁극기 직전 정적)
  AU.dropUntil = -1;          // 이 박자 시각까지 드롭(강한 구간)
  let ctx = null, master, sfxBus, bgmBus, noiseBuf, comp, duckG = null, voiceBus = null, vdM = null, vdS = null;
  let nextStep = 0;
  const last = {};

  AU.ready = () => !!ctx;
  AU.init = function () {
    if (ctx || GZ.Q.mute) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return; }
    AU.ctx = ctx;
    // r2: 0dB 찌그러짐 제거 — 압축기(임계 −18dB·비율 12) → 음량 0.8 → 부드러운 한계기(tanh, 절대 ±0.92 를 넘지 않음)
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 12; comp.attack.value = 0.003; comp.release.value = 0.16;
    master = ctx.createGain(); master.gain.value = 0.95;
    const lim = ctx.createWaveShaper(), N = 2049, cv = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; cv[i] = Math.tanh(x * 1.5) / Math.tanh(1.5) * 0.92; }
    lim.curve = cv; lim.oversample = '2x';
    comp.connect(master); master.connect(lim); lim.connect(ctx.destination);
    AU.out = lim;
    // 음색 균형: 저음(200Hz 아래) −6dB, 중음(1.3kHz) +4dB — r1 은 60~250Hz 에 에너지가 몰려 폰 스피커에서 박자가 안 들렸음
    const shelf = ctx.createBiquadFilter(); shelf.type = 'lowshelf'; shelf.frequency.value = 220; shelf.gain.value = -6;
    const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 1300; pres.Q.value = 0.7; pres.gain.value = 4;
    shelf.connect(pres); pres.connect(comp);
    sfxBus = ctx.createGain();
    vdS = ctx.createGain(); sfxBus.connect(vdS); vdS.connect(shelf);   // 11-14 비서 그런트가 말하는 동안 효과음 살짝 낮춤 (AU.vduck)
    bgmBus = ctx.createGain();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 55; hp.Q.value = 0.7;   // 폰 스피커가 못 내는 초저음은 덜어 냄
    duckG = ctx.createGain(); duckG.gain.value = 1;   // r9: 허조교가 말하는 동안 음악만 살짝 낮춤 (AU.duck)
    vdM = ctx.createGain();   // 11-14 비서 그런트 말할 때 음악 낮춤 — 허조교 더킹(duckG)과 따로 곱해짐
    bgmBus.connect(duckG); duckG.connect(vdM); vdM.connect(hp); hp.connect(shelf);
    // r9: 허조교 실제 목소리 버스 — 저음 깎기·중음 올림(효과음용 EQ)을 거치지 않고 압축기로 바로. 음량은 효과음 막대를 따름(0 이면 목소리도 0)
    voiceBus = ctx.createGain(); voiceBus.connect(comp); AU.voiceBus = voiceBus;
    AU.applyVol();
    if (GZ.VO) GZ.VO.load();   // 목소리 미리 디코드 (누르는 순간 바로 나오게)
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  // 소리가 실제로 귀에 닿기까지의 지연(초) — 정박 판정·박자 고리를 이만큼 늦춤 (블루투스 이어폰 대비). 0~0.3초로 제한
  // r8 (검토 B5): 사용자 박자 보정(초, 일시정지 창 「박자 맞추기」 −100~+150ms) — 자동값(outputLatency)이 0 이거나 틀린 기기(iOS 사파리·블루투스) 대비. 이 기기에만 저장
  AU.userOff = 0;
  try { const v = parseFloat(localStorage.getItem('gzBeatOff')); if (isFinite(v)) AU.userOff = Math.max(-0.1, Math.min(0.15, v / 1000)); } catch (e) { AU.userOff = 0; }
  AU.setUserOff = function (ms) { AU.userOff = Math.max(-0.1, Math.min(0.15, (+ms || 0) / 1000)); try { localStorage.setItem('gzBeatOff', String(Math.round(AU.userOff * 1000))); } catch (e) { /* 저장 안 되는 곳 */ } };
  AU.latency = function () {
    let l = 0;
    if (ctx && ctx.state === 'running') { l = (ctx.outputLatency || 0) + (ctx.baseLatency || 0); l = l > 0 && l < 0.3 ? l : l >= 0.3 ? 0.3 : 0; }
    return l + AU.userOff;
  };
  AU.resume = function () { if (ctx && ctx.state !== 'running') ctx.resume(); };
  AU.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  AU.applyVol = function () {
    if (!ctx) return;
    sfxBus.gain.value = AU.vol.sfx * 0.9;
    bgmBus.gain.value = AU.vol.bgm * 0.62;
    if (voiceBus) voiceBus.gain.value = AU.vol.sfx * AU.VOICE_GAIN;
  };
  AU.VOICE_GAIN = 0.62;   // r9: 목소리 크기 (효과음 막대 × 이 값). 정규화한 목소리(가장 센 0.3초 −12.5dBFS)가 압축기 −18dB 를 넘어 효과음보다 또렷하되 찌그러지지 않는 값 (tools/test_rules 「목소리 균형」)
  // r9: 음악 낮추기 — dur 초 동안 음악 ×0.5(−6dB), 끝나면 0.25초에 걸쳐 돌아옴
  AU.duck = function (dur, k) {
    if (!ctx || !duckG) return;
    const t = ctx.currentTime, g = duckG.gain;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(k == null ? 0.5 : k, t, 0.025); g.setTargetAtTime(1, t + Math.max(0.05, dur), 0.08); } catch (e) { g.value = 1; }
  };
  AU.duckLevel = () => (duckG ? duckG.gain.value : 1);
  // 11-14 비서 그런트 목소리 더킹: dur 초 동안 음악 m(기본 0.5 = −6dB)·효과음 k(기본 0.7 ≈ −3dB), 끝나면 0.25초에 걸쳐 돌아옴
  AU.vduck = function (dur, m, k) {
    if (!ctx || !vdM) return;
    const t = ctx.currentTime;
    [[vdM.gain, m == null ? 0.5 : m], [vdS.gain, k == null ? 0.7 : k]].forEach(([g, v]) => {
      try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, 0.03); g.setTargetAtTime(1, t + Math.max(0.05, dur), 0.08); } catch (e) { g.value = 1; }
    });
  };
  AU.vduckLevel = () => (vdM ? [vdM.gain.value, vdS.gain.value] : [1, 1]);

  // --- 기본 블록 ---
  function tone(type, f0, f1, t, dur, vol, dest, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
    return g;
  }
  function noise(ftype, f0, f1, q, t, dur, vol, dest, attack) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = ftype; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(Math.max(30, f0), t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function ok(name, gap) {
    if (!ctx || ctx.state !== 'running') return false;
    const now = ctx.currentTime;
    if (last[name] != null && now - last[name] < gap) return false;
    last[name] = now; return true;
  }

  // --- 효과음 ---
  // 호각: 짧은 두 음(트릴) + 숨소리 + 낮은 「퉁」. kind 0 엇박 / 1 정박자(누르고 있을 때) / 2 「정박!」(강화)
  AU.whistle = function (kind) {
    if (!ok('wh', 0.05)) return;
    const t = ctx.currentTime;
    const base = kind === 2 ? 1976 : kind === 1 ? 1568 : 1319; // B6 / G6 / E6 — BGM 조(E단조)에 맞춘 음
    const dur = kind === 2 ? 0.2 : 0.085;
    const v = kind === 2 ? 0.2 : 0.07;   // r3: 누르고 있는 동안의 호각음 0.11 → 0.07 (4분 동안 초당 4번 울려 피로)
    if (kind !== 0) {                    // r3: 엇박 발사는 높은 호각음(트릴) 없이 숨소리 + 「탁」만
      tone('sine', base, base * 1.02, t, dur, v);
      tone('sine', base * 1.065, base * 1.085, t, dur, v * 0.8);
    }
    noise('bandpass', base * 1.6, base * 1.9, 3, t, dur * 0.8, kind === 0 ? 0.045 : v * 0.5);
    tone('sine', kind === 2 ? 240 : 200, 90, t, kind === 2 ? 0.2 : 0.09, kind === 2 ? 0.34 : 0.14);
    noise('bandpass', 900, 600, 1.2, t, 0.05, kind === 2 ? 0.3 : 0.16);   // 중음 「탁」 (폰 스피커에서 타격이 들리게)
    if (kind === 2) { tone('triangle', base * 1.5, base * 1.5, t + 0.02, 0.26, 0.09); noise('highpass', 5000, 9000, 0.7, t, 0.12, 0.12); }
  };
  AU.hit = function (heavy, vuln) {
    if (!ok('hit', 0.03)) return;
    const t = ctx.currentTime;
    noise('bandpass', heavy ? 900 : 1500, 300, 1.2, t, heavy ? 0.12 : 0.07, heavy ? 0.5 : 0.3);
    tone('square', heavy ? 170 : 240, 70, t, 0.07, 0.16);
    if (vuln) { tone('sine', 120, 52, t, 0.16, 0.42); noise('lowpass', 700, 180, 0.9, t, 0.12, 0.34); tone('triangle', 660, 330, t, 0.08, 0.1); }   // r3: 보스 약점 노출 중엔 한 단계 굵게
  };
  // r3: 화면 밖에서 공격이 올 때 경보 (예고음 880Hz 와 다른 음색 — 내려가는 두 음)
  AU.alarm = function () {
    if (!ok('alarm', 0.45)) return;
    const t = ctx.currentTime;
    tone('square', 1245, 1245, t, 0.07, 0.085); tone('square', 932, 932, t + 0.085, 0.09, 0.085); tone('sine', 1245, 932, t, 0.17, 0.07);
  };
  // r3 구령(합성): 톱니파 성대음 + 모음 포먼트 2개 + 자음 잡음. 사람 녹음이 아니라 「구령 느낌」 — 녹음이 생기면 바꿀 것
  const VOW = { a: [820, 1300], eo: [600, 1050], e: [520, 1850], i: [310, 2250], u: [350, 900] };
  function syl(t, o) {   // o: {v0, v1(모음 시작·끝), d(길이), f0, f1(높이 시작·끝), c(자음 잡음 주파수), g(음량)}
    const d = o.d, g = o.g || 0.5, A = VOW[o.v0], Bv = VOW[o.v1 || o.v0];
    if (o.c) noise('highpass', o.c, o.c * 1.2, 0.8, t, 0.05, g * 0.5);
    const t0 = t + (o.c ? 0.03 : 0), osc = ctx.createOscillator(), osc2 = ctx.createOscillator(), env = ctx.createGain();
    osc.type = 'sawtooth'; osc2.type = 'sawtooth';
    osc.frequency.setValueAtTime(o.f0, t0); osc.frequency.linearRampToValueAtTime(o.f1 || o.f0, t0 + d);
    osc2.frequency.setValueAtTime(o.f0 * 1.008, t0); osc2.frequency.linearRampToValueAtTime((o.f1 || o.f0) * 1.008, t0 + d);
    env.gain.setValueAtTime(0.0001, t0); env.gain.linearRampToValueAtTime(g, t0 + 0.018); env.gain.setValueAtTime(g, t0 + d * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    [0, 1].forEach((k) => {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = k ? 9 : 6;
      f.frequency.setValueAtTime(A[k], t0); f.frequency.linearRampToValueAtTime(Bv[k], t0 + d * 0.6);
      const gg = ctx.createGain(); gg.gain.value = k ? 0.9 : 1.6;
      osc.connect(f); osc2.connect(f); f.connect(gg); gg.connect(env);
    });
    env.connect(sfxBus); osc.start(t0); osc2.start(t0); osc.stop(t0 + d + 0.03); osc2.stop(t0 + d + 0.03);
    return (o.c ? 0.03 : 0) + d;
  }
  AU.voice = function (name) {   // 합성 목소리 — r9: 실제 목소리(GZ.VO)가 있으면 그쪽이 누른 순간 이미 말함 → 여기선 안 냄. 목소리 끄기면 둘 다 안 냄. 실제 목소리 디코드 실패 때만 대신 씀
    if (!ctx || ctx.state !== 'running') return;
    if (GZ.VO && !GZ.VO.synthOK(name)) return;
    let t = ctx.currentTime + 0.01;
    const seq = name === 'skill'
      ? [{ v0: 'a', d: 0.11, f0: 205, f1: 215, c: 3200, g: 0.5 }, { v0: 'i', v1: 'eo', d: 0.17, f0: 250, f1: 175, g: 0.6 }]                                            // 「차·렷!」
      : [{ v0: 'eo', d: 0.1, f0: 180, c: 2800, g: 0.45 }, { v0: 'e', d: 0.1, f0: 190, c: 3400, g: 0.45 }, { v0: 'i', d: 0.09, f0: 215, g: 0.5 }, { v0: 'a', d: 0.34, f0: 262, f1: 196, c: 5200, g: 0.62 }];   // 「전·체·기·상!」
    for (const o of seq) t += syl(t, o) + 0.012;
  };
  AU.clang = function () {   // 방패에 막힘
    if (!ok('clang', 0.08)) return;
    const t = ctx.currentTime;
    [523, 1187, 1873, 2794].forEach((f, i) => tone('sine', f, f * 0.995, t, 0.28 - i * 0.04, 0.12 - i * 0.02));
    noise('highpass', 4000, 6000, 0.7, t, 0.04, 0.2);
  };
  AU.boom = function (size) {  // 기계 부서짐 (size 0 작음 ~ 2 보스)
    if (!ok('boom' + size, 0.05)) return;
    const t = ctx.currentTime, s = size || 0;
    noise('lowpass', 2600 - s * 500, 180, 0.7, t, 0.22 + s * 0.3, 0.5 + s * 0.15);
    tone('sine', 130 - s * 20, 38, t, 0.2 + s * 0.3, 0.6 + s * 0.15);
    [1320, 1760, 2640].forEach((f, i) => tone('triangle', f * (1 + Math.random() * 0.08), f * 0.7, t + 0.02 * i, 0.09, 0.05)); // 톱니 짤랑
  };
  AU.hurt = function () {
    if (!ok('hurt', 0.2)) return;
    const t = ctx.currentTime;
    tone('sawtooth', 220, 70, t, 0.25, 0.3);
    noise('lowpass', 900, 200, 0.8, t, 0.2, 0.45);
  };
  AU.roll = function () {
    if (!ok('roll', 0.1)) return;
    noise('bandpass', 500, 2400, 1.0, ctx.currentTime, 0.2, 0.3, null, 0.06);
  };
  AU.skill = function () {   // 「차렷!」 — 작은북 한 번 + 금관 스탭
    if (!ok('skill', 0.2)) return;
    const t = ctx.currentTime;
    noise('bandpass', 2200, 1800, 0.8, t, 0.16, 0.6);
    tone('sine', 210, 150, t, 0.12, 0.5);
    [164.8, 247, 329.6, 494].forEach((f) => tone('sawtooth', f, f, t + 0.03, 0.42, 0.08, null, 0.02));
    tone('sine', 90, 40, t, 0.4, 0.6);
    AU.voice('skill');
  };
  AU.ultStart = function () {  // 오르는 소리 (0.75초)
    if (!ok('ult', 0.3)) return;
    const t = ctx.currentTime;
    noise('bandpass', 300, 7000, 1.5, t, 0.78, 0.45, null, 0.6);
    tone('sawtooth', 110, 880, t, 0.76, 0.2, null, 0.5);
    tone('sine', 1976, 2093, t + 0.42, 0.34, 0.16, null, 0.05); tone('sine', 2105, 2230, t + 0.42, 0.34, 0.11, null, 0.05);   // 길게 부는 호각
    AU.voice('ult');
  };
  AU.ultBlast = function () {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    tone('sine', 120, 28, t, 1.3, 0.75);
    noise('lowpass', 5000, 100, 0.7, t, 1.1, 0.8);
    [164.8, 247, 329.6, 415.3, 659.3].forEach((f) => tone('sawtooth', f, f, t, 1.0, 0.1, null, 0.01));
    tone('sine', 2637, 2637, t, 0.5, 0.12);
  };
  AU.warn = function () {   // 예고음
    if (!ok('warn', 0.12)) return;
    const t = ctx.currentTime;
    tone('square', 880, 880, t, 0.06, 0.07); tone('square', 880, 880, t + 0.09, 0.06, 0.07);
  };
  AU.shot = function () {   // 증기 탄
    if (!ok('shot', 0.06)) return;
    const t = ctx.currentTime;
    noise('highpass', 1800, 5000, 0.7, t, 0.16, 0.35);
    tone('sine', 300, 90, t, 0.12, 0.25);
  };
  AU.slam = function () {
    if (!ok('slam', 0.08)) return;
    const t = ctx.currentTime;
    tone('sine', 100, 34, t, 0.4, 0.6);
    noise('lowpass', 1600, 200, 0.7, t, 0.3, 0.6);
  };
  AU.roar = function () {   // 보스: 낮은 기계 울림
    if (!ok('roar', 0.4)) return;
    const t = ctx.currentTime;
    tone('sawtooth', 55, 41, t, 1.4, 0.35, null, 0.2);
    tone('sawtooth', 58.5, 43, t, 1.4, 0.3, null, 0.2);
    noise('bandpass', 180, 90, 2, t, 1.3, 0.6, null, 0.3);
  };
  AU.drain = function () {
    if (!ok('drain', 0.35)) return;
    const t = ctx.currentTime;
    tone('sine', 700, 350, t, 0.3, 0.07);
  };
  AU.ui = function (hi) {
    if (!ok('ui', 0.04)) return;
    const t = ctx.currentTime;
    tone('triangle', hi ? 988 : 659, hi ? 1319 : 659, t, 0.09, 0.16);
  };
  AU.perfect = function (n) {  // 정박 연속 — 올라가는 짧은 음
    if (!ok('pf', 0.05)) return;
    const sc = [659.3, 740, 784, 880, 988, 1175];
    const f = sc[Math.min(sc.length - 1, n)];
    tone('triangle', f, f, ctx.currentTime, 0.14, 0.12);
  };
  AU.fanfare = function (win) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const seq = win ? [329.6, 415.3, 494, 659.3, 494, 659.3, 830.6] : [329.6, 311.1, 293.7, 246.9];
    seq.forEach((f, i) => { tone('sawtooth', f, f, t + i * (win ? 0.13 : 0.24), win ? 0.3 : 0.5, 0.11, null, 0.01); tone('triangle', f * 2, f * 2, t + i * (win ? 0.13 : 0.24), 0.25, 0.06); });
    if (win) tone('sine', 82.4, 82.4, t + 0.78, 1.4, 0.5);
  };

  // --- BGM 시퀀서 ---
  const semi = (n) => Math.pow(2, n / 12);
  const E1 = 41.2;
  const ROOTS = { battle: [0, 0, 3, -2], boss: [0, 1, 0, -2], title: [0, 0, -2, -2], battleB: [0, 5, 3, -2], bossB: [0, 1, 3, 1] };
  const BASS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 2, 0];
  const BASS_B = [1, 0, 1, 2, 0, 1, 0, 2, 1, 0, 1, 2, 0, 1, 2, 2];
  const ARP = [0, 7, 12, 15, 12, 7, 19, 15, 0, 7, 12, 15, 17, 15, 12, 7];
  // r2: 킥에 1.2~2kHz 짧은 「딱」 + 300Hz 몸통을 더해 폰 스피커에서도 박자가 들리게, 초저음 몫은 줄임
  function kick(t, v) {
    tone('sine', 165, 46, t, 0.18, v * 0.78, bgmBus, 0.002);
    tone('triangle', 420, 190, t, 0.06, v * 0.5, bgmBus, 0.001);
    noise('bandpass', 1700, 1300, 1.6, t, 0.022, v * 0.75, bgmBus, 0.001);
    tone('square', 1500, 900, t, 0.012, v * 0.16, bgmBus, 0.001);
  }
  function snare(t, v) { noise('bandpass', 1900, 1500, 0.7, t, 0.13, v, bgmBus); tone('triangle', 200, 150, t, 0.08, v * 0.6, bgmBus); }
  function hat(t, v, open) { noise('highpass', 7500, 8500, 0.7, t, open ? 0.14 : 0.035, v, bgmBus); }
  function bass(t, f, v, dur) {
    const o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    fl.type = 'lowpass'; fl.Q.value = 6;
    fl.frequency.setValueAtTime(1500, t); fl.frequency.exponentialRampToValueAtTime(240, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + dur + 0.02);
    tone('sine', f, f, t, dur, v * 0.25, bgmBus);
    tone('square', f * 2, f * 2, t, dur * 0.7, v * 0.12, bgmBus);   // 한 옥타브 위 배음 (작은 스피커에서 베이스 음정이 들리게)
  }
  function stab(t, root, v, dur) {
    const fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(2400, t); fl.frequency.exponentialRampToValueAtTime(500, t + dur); fl.Q.value = 1.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    fl.connect(g); g.connect(bgmBus);
    [0, 3, 7, 10].forEach((n, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = root * 4 * semi(n) * (1 + (i - 1.5) * 0.003);
      o.connect(fl); o.start(t); o.stop(t + dur + 0.02);
    });
  }
  function schedStep(n, t) {
    const mode = AU.mode;
    if (mode === 'off' || mode === 'end') return;
    const st = n % 16, bar = Math.floor(n / 16) % 4, bt = n * AU.STEP;
    const muted = bt < AU.muteUntil;
    const drop = bt < AU.dropUntil;
    const boss = mode === 'boss';
    const lv = mode === 'title' ? 0 : mode === 'break' ? 0.5 : mode === 'w1' ? 1 : mode === 'w2' ? 2 : mode === 'w3' ? 3 : 4;
    // r4: 16마디(32초)마다 변주 구간 — 진행·베이스 무늬가 바뀌고 열린 하이햇이 들어감. 보스는 단계마다 반주가 두꺼워짐(2단계: 엇박 작은북·높은 아르페지오, 3단계: 16분 하이햇·8분 킥)
    const varB = lv >= 1 && Math.floor(n / 256) % 2 === 1, bph = boss ? (AU.bossPhase || 1) : 0;
    const roots = boss ? (varB ? ROOTS.bossB : ROOTS.boss) : mode === 'title' ? ROOTS.title : varB ? ROOTS.battleB : ROOTS.battle;
    const root = E1 * semi(roots[bar]);
    if (muted) return;
    // 킥
    if (lv >= 1 && st % 4 === 0) kick(t, drop ? 0.95 : 0.8);
    if (lv < 1 && st === 0) kick(t, 0.5);
    if ((boss || drop) && st === 14) kick(t, 0.55);
    if (bph >= 3 && st % 4 === 2) kick(t, 0.4);
    if (bph >= 2 && st === 10) snare(t, 0.22);
    if (varB && (st === 6 || st === 14)) hat(t, 0.15, true);
    if (bph >= 3 && st % 2 === 1 && lv < 3) hat(t, 0.08);
    // 작은북·박수 (2·4박)
    if (lv >= 2 && (st === 4 || st === 12)) snare(t, 0.36);
    // 군악대풍 작은북 굴림: 네 번째 마디 끝
    if (lv >= 1 && bar === 3 && st >= 12) { snare(t, 0.16 + (st - 12) * 0.06); if (lv >= 3) snare(t + AU.STEP / 2, 0.14); }
    // 하이햇
    if (lv >= 0.5 && st % 4 === 2) hat(t, lv >= 1 ? 0.2 : 0.1, lv >= 3);
    if (lv >= 1 && st % 4 === 0) hat(t, 0.13);   // r2: 정박에도 높은 소리 (박자를 귀로 잡기 쉽게)
    if (lv >= 3 && st % 2 === 1) hat(t, 0.09);
    // 베이스
    const bp = boss || drop || varB ? BASS_B : BASS;
    if (bp[st]) {
      if (lv >= 1) bass(t, root * 2 * (bp[st] === 2 ? 2 : 1), drop ? 0.42 : 0.34, AU.STEP * 1.5);
      else if (lv >= 0.5 && st % 8 === 0) bass(t, root * 2, 0.24, AU.STEP * 3);
      else if (lv === 0 && st === 0) bass(t, root * 2, 0.3, AU.BEAT * 3);
    }
    // 금관 스탭
    if (lv >= 2 && (st === 0 || st === 6 || (bar % 2 === 1 && st === 11))) stab(t, root, drop ? 0.11 : 0.085, st === 0 ? 0.3 : 0.16);
    if (lv === 0 && st === 0 && bar % 2 === 0) stab(t, root, 0.04, 1.6);
    // 아르페지오 (3웨이브·보스·드롭)
    if ((lv >= 3 || drop) && (boss || drop || st % 2 === 0)) {
      const f = root * (bph >= 2 && bar % 2 === 1 ? 16 : 8) * semi(ARP[(st + bar * 4 + (varB ? 5 : 0)) % 16]);
      tone('square', f, f, t, 0.09, boss || drop ? 0.06 : 0.042, bgmBus);
    }
  }
  // bt = 규칙 박자 시계(초). 매 프레임 불러 앞으로 0.12초 안의 걸음을 예약
  AU.tick = function (bt) {
    if (!ctx || ctx.state !== 'running') { nextStep = Math.ceil(bt / AU.STEP); return; }
    const cur = Math.ceil(bt / AU.STEP);
    if (nextStep < cur || nextStep > cur + 4) nextStep = cur;
    while (nextStep * AU.STEP < bt + 0.12) {
      schedStep(nextStep, ctx.currentTime + Math.max(0, nextStep * AU.STEP - bt));
      nextStep++;
    }
  };
  AU.setMode = function (m) { AU.mode = m; };
})();
