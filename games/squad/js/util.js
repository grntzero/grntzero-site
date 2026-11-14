/* GRUNT ZERO RE — 공용 (이름공간 GZ, 시드 난수, 수학) */
(function () {
  'use strict';
  const GZ = (window.GZ = {});
  const qs = new URLSearchParams(location.search);
  GZ.Q = {
    seed: +(qs.get('seed') || 0) || ((Date.now() % 99991) + 1),
    mute: qs.get('mute') === '1',
    auto: qs.get('auto') || '',        // good | sloppy | idle  (시험용 자동 플레이)
    sim: Math.max(1, +(qs.get('sim') || 1)), // 한 프레임에 규칙 걸음 몇 배
    god: qs.get('god') === '1',
    dr: qs.get('dr') !== '0',          // 동적 해상도
    noglb: qs.get('noglb') === '1',
    lefty: qs.get('lefty') === '1',
    camwave: qs.get('camwave') === '1',
    diff: qs.get('diff') || '',          // r5: easy = 훈련병(쉬움), 없으면 정규(보통)
    rig: qs.get('rig') || '',
    atk: qs.get('atk') || '',          // r9: auto = 자동 공격, manual = 수동 (없으면 저장값 → 수동)
    lead: qs.get('lead') || '',        // r9: 0 = 앞서 보는 카메라 끔 (비교 시험용)          // 시험용: 가로 카메라 값 바꿔 보기 「fov,dist,pitch,feet」
    seedSet: qs.has('seed'),   // 시험용: 웨이브에서도 카메라가 느리게 돎 (기본은 고정)
  };
  GZ.isTouch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;

  // 규칙 계산 전용 난수 (mulberry32) — 화면 효과는 Math.random 을 따로 씀
  let s = GZ.Q.seed >>> 0;
  GZ.seed = (v) => { s = v >>> 0; };
  GZ.rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  GZ.rr = (a, b) => a + (b - a) * GZ.rand();
  GZ.pick = (arr) => arr[Math.floor(GZ.rand() * arr.length) % arr.length];

  GZ.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  GZ.lerp = (a, b, k) => a + (b - a) * k;
  GZ.sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  GZ.smooth = (k) => { k = GZ.sat(k); return k * k * (3 - 2 * k); };
  const TAU = Math.PI * 2;
  GZ.TAU = TAU;
  // 각도 차이 (-PI..PI)
  GZ.angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; };
  // 각도 a 를 b 쪽으로 최대 m 만큼
  GZ.angTo = (a, b, m) => { const d = GZ.angDiff(b, a); return a + GZ.clamp(d, -m, m); };
  // 방향각 규약: 각 θ 의 앞 = (sin θ, 0, cos θ) — three.js rotation.y 와 같음. 화면 위쪽 = -z
  GZ.dirX = (a) => Math.sin(a);
  GZ.dirZ = (a) => Math.cos(a);
  GZ.ang = (dx, dz) => Math.atan2(dx, dz);
  GZ.fmtTime = (t) => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  GZ.b64ToBuf = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  // 화면 아래 잘림 고침 (2026-11-13): 실제로 보이는 넓이는 visualViewport 로 잼 (주소창·전체 화면·홈바 바뀔 때 innerHeight·100vh 가 어긋남)
  //   잰 값을 CSS 변수 --app-w/--app-h/--app-t/--app-l 로 넣어 캔버스·UI 를 그 크기에 딱 맞추고, 바뀔 때마다 cb(크기 다시 맞추기)를 부름
  GZ.view = { w: 0, h: 0, t: 0, l: 0, n: 0 };
  GZ.measureView = function () {
    let w = window.innerWidth, h = window.innerHeight, t = 0, l = 0;
    const vv = window.visualViewport;
    if (vv && vv.width > 0 && vv.height > 0) { w = vv.width; h = vv.height; t = vv.offsetTop || 0; l = vv.offsetLeft || 0; }
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); t = Math.round(t); l = Math.round(l);
    const v = GZ.view, changed = v.w !== w || v.h !== h || v.t !== t || v.l !== l;
    if (changed) {
      v.w = w; v.h = h; v.t = t; v.l = l; v.n++;
      try { const st = document.documentElement.style; st.setProperty('--app-w', w + 'px'); st.setProperty('--app-h', h + 'px'); st.setProperty('--app-t', t + 'px'); st.setProperty('--app-l', l + 'px'); } catch (e) {}
    }
    return changed;
  };
  GZ.watchView = function (cb) {
    let tm = [];
    const check = () => { if (GZ.measureView()) cb(); };
    const burst = () => { check(); tm.forEach(clearTimeout); tm = [60, 180, 400, 800].map((d) => setTimeout(check, d)); };   // 전체 화면·회전은 크기가 몇 번에 나눠 바뀜 → 조금 뒤에도 다시 잼
    window.addEventListener('resize', burst);
    window.addEventListener('orientationchange', burst);
    document.addEventListener('fullscreenchange', burst);
    document.addEventListener('webkitfullscreenchange', burst);
    if (window.visualViewport) { visualViewport.addEventListener('resize', burst); visualViewport.addEventListener('scroll', check); }
    setInterval(check, 500);   // 이벤트를 놓쳐도 0.5초 안에 맞춤 (값이 같으면 아무것도 안 함)
    GZ.measureView();
  };
  GZ.vw = () => GZ.view.w || window.innerWidth;
  GZ.vh = () => GZ.view.h || window.innerHeight;
  try { GZ.measureView(); } catch (e) {}
})();
