/* 톱니골 던전 — 공용 도구 (클래식 스크립트, window.TG 아래에 모음) */
(function () {
  'use strict';
  const TG = (window.TG = window.TG || {});
  const q = new URLSearchParams(location.search);
  TG.Q = {
    auto: q.get('auto') === '1',
    bench: q.get('bench') === '1',
    god: q.get('god') === '1',
    seed: q.has('seed') ? Number(q.get('seed')) || 1 : null,
    dr: q.get('dr') !== '0', // 동적 해상도 (시험 촬영 때 0)
    mute: q.get('mute') === '1',
    jump: q.get('jump') || null,
    first: q.get('first'), // 보스 첫 판(70% 속도) 강제: 1/0 (없으면 저장값, 시드가 있으면 1)
  };

  // 고정 난수 (mulberry32) — 게임 규칙용. 이펙트는 TG.fr(빠른 난수) 사용
  let s = (TG.Q.seed != null ? TG.Q.seed : (Math.random() * 4294967296) | 0) >>> 0;
  TG.rand = function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // 규칙 계산(sim) 전용 난수 — 배경 연출(TG.rand)·이펙트(TG.fr)와 흐름이 따로라 그림 속도와 무관하게 같은 결과
  let ss = 1;
  TG.simSeed = function (n) { ss = (n >>> 0) || 1; };
  TG.sr = function () {
    ss = (ss + 0x6d2b79f5) | 0;
    let t = Math.imul(ss ^ (ss >>> 15), 1 | ss);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  TG.srr = (a, b) => a + (b - a) * TG.sr();
  let fs = 12345;
  TG.fr = function () { // 이펙트용 (시드 고정과 무관하게 가벼움)
    fs = (fs * 1664525 + 1013904223) >>> 0;
    return fs / 4294967296;
  };
  TG.rr = (a, b) => a + (b - a) * TG.rand();
  TG.fra = (a, b) => a + (b - a) * TG.fr();
  TG.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  TG.lerp = (a, b, t) => a + (b - a) * t;
  TG.damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  TG.smooth = (a, b, x) => { const t = TG.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  TG.easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  TG.easeOutElastic = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1);
  TG.angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  TG.b64ToBuf = function (b64) {
    const bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  };
  TG.isTouch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
  TG.fmtTime = (t) => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
})();
