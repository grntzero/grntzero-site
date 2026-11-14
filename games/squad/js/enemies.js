/* GRUNT ZERO RE — 적 기계 4종 + 보스 「침묵 기관」. 모델은 three.js 도형 조합(검정 금속+황동+붉은/푸른 코어) */
(function () {
  'use strict';
  const GZ = window.GZ, T = THREE;
  const EN = (GZ.EN = {});
  EN.list = []; EN.shots = []; EN.rings = []; EN.boss = null;
  let scene, nextId = 1;
  const C = { dark: 0x30333d, black: 0x15161b, brass: 0xb07a2a, gold: 0xffc040, steel: 0x8f98a8, rust: 0x70402a, copper: 0x9a5530 };
  const GEO = {}, MARK = {}, PLAIN = {};

  function paint(g, hex) {
    const c = new T.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3));
    return g;
  }
  function part(g, hex, x, y, z, rx, ry, rz) {
    if (g.index) g = g.toNonIndexed();
    if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
    g.translate(x || 0, y || 0, z || 0);
    return paint(g, hex);
  }
  const merge = (list) => T.BufferGeometryUtils.mergeGeometries(list, false);
  const cyl = (r0, r1, h, n, open) => new T.CylinderGeometry(r0, r1, h, n || 12, 1, !!open);
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const sph = (r, a, b) => new T.SphereGeometry(r, a || 12, b || 8);
  const gear = (r, n, th, o) => GZ.FX.gearGeo(r, n, th, o);
  const tor = (r, t, n) => new T.TorusGeometry(r, t, 6, n || 20);
  const sq = (g, x, y, z) => { g.scale(x, y, z); return g; };
  // 둘레에 n개 늘어놓기 (리벳·볼트·다리)
  function around(n, r, y, mk, a0) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832 + (a0 || 0); out.push(mk(Math.sin(a) * r, y, Math.cos(a) * r, a)); } return out; }

  function buildGeos() {
    // --- 톱니 드론: 회전 톱날 고리 + 장갑 몸통 + 황동 띠·추진기·안테나 + 붉은 눈 ---
    GEO.droneBody = merge([
      part(sq(sph(0.31, 14, 10), 1, 0.78, 1.08), C.dark, 0, 0, 0),
      part(tor(0.325, 0.035, 22), C.brass, 0, 0, 0, Math.PI / 2),
      part(sq(sph(0.2, 10, 6), 1, 0.6, 1), C.black, 0, 0.17, -0.03),                       // 윗 덮개
      part(cyl(0.012, 0.012, 0.3, 5), C.steel, -0.1, 0.38, -0.12), part(sph(0.03, 6, 5), C.brass, -0.1, 0.54, -0.12),   // 안테나
      part(cyl(0.15, 0.17, 0.12, 12), C.black, 0, 0, 0.29, Math.PI / 2), part(tor(0.15, 0.028, 16), C.brass, 0, 0, 0.35),   // 눈 테
      part(cyl(0.085, 0.07, 0.3, 8), C.black, 0.3, 0.02, -0.16, Math.PI / 2), part(cyl(0.085, 0.07, 0.3, 8), C.black, -0.3, 0.02, -0.16, Math.PI / 2),   // 추진기
      part(cyl(0.095, 0.095, 0.05, 8), C.copper, 0.3, 0.02, -0.31, Math.PI / 2), part(cyl(0.095, 0.095, 0.05, 8), C.copper, -0.3, 0.02, -0.31, Math.PI / 2),
      part(box(0.05, 0.2, 0.3), C.brass, 0, 0.2, -0.26, 0.5),                               // 등지느러미
      part(cyl(0.09, 0.02, 0.26, 8), C.brass, 0, -0.32, 0), part(cyl(0.14, 0.1, 0.07, 10), C.black, 0, -0.2, 0),   // 아래 축
    ].concat(around(6, 0.27, -0.1, (x, y, z) => part(sph(0.03, 5, 4), C.brass, x, y, z))));
    GEO.droneGear = merge([
      part(gear(0.64, 14, 0.07, { root: 0.8, hole: 0.66, bevel: 0.012 }), C.steel, 0, 0, 0, Math.PI / 2),
      part(tor(0.44, 0.03, 24), C.brass, 0, 0, 0, Math.PI / 2),
      part(box(0.05, 0.035, 0.9), C.black, 0, 0, 0), part(box(0.9, 0.035, 0.05), C.black, 0, 0, 0),   // 톱날을 잡는 살
    ]);
    GEO.eye = sph(0.115, 10, 8);
    // --- 증기 포탑: 리벳 박힌 받침·세 다리·포신(냉각 고리·포구)·보일러·배기관 ---
    GEO.turBase = merge([
      part(cyl(0.9, 1.02, 0.22, 8), C.dark, 0, 0.11, 0), part(cyl(0.8, 0.8, 0.07, 20), C.brass, 0, 0.255, 0),
      part(cyl(0.6, 0.76, 0.3, 8), C.black, 0, 0.42, 0), part(cyl(0.36, 0.5, 0.4, 12), C.dark, 0, 0.75, 0),
      part(tor(0.42, 0.045, 18), C.brass, 0, 0.58, 0, Math.PI / 2), part(cyl(0.4, 0.4, 0.08, 16), C.brass, 0, 0.97, 0),
    ].concat(
      around(3, 0.95, 0.16, (x, y, z, a) => part(box(0.26, 0.16, 0.9), C.black, x, y, z, 0, a)),
      around(3, 1.36, 0.05, (x, y, z) => part(cyl(0.2, 0.24, 0.1, 8), C.brass, x, y, z)),
      around(8, 0.84, 0.235, (x, y, z) => part(sph(0.045, 5, 4), C.brass, x, y, z), 0.39)));
    GEO.turHead = merge([
      part(sq(sph(0.5, 14, 10), 1, 0.82, 1.05), C.dark, 0, 0, 0), part(tor(0.5, 0.04, 22), C.brass, 0, -0.02, 0, Math.PI / 2),
      part(box(0.16, 0.42, 0.7), C.black, 0.47, 0.02, 0.02), part(box(0.16, 0.42, 0.7), C.black, -0.47, 0.02, 0.02),   // 옆 장갑판
      part(cyl(0.13, 0.17, 1.2, 12), C.steel, 0, 0.02, 0.95, Math.PI / 2),                                               // 포신
      part(cyl(0.23, 0.23, 0.1, 12), C.brass, 0, 0.02, 0.46, Math.PI / 2),
      part(cyl(0.2, 0.2, 0.04, 10), C.black, 0, 0.02, 0.7, Math.PI / 2), part(cyl(0.2, 0.2, 0.04, 10), C.black, 0, 0.02, 0.85, Math.PI / 2),
      part(cyl(0.2, 0.2, 0.04, 10), C.black, 0, 0.02, 1.0, Math.PI / 2), part(cyl(0.2, 0.2, 0.04, 10), C.black, 0, 0.02, 1.15, Math.PI / 2),
      part(cyl(0.25, 0.21, 0.24, 12), C.black, 0, 0.02, 1.55, Math.PI / 2), part(tor(0.235, 0.03, 14), C.brass, 0, 0.02, 1.66),   // 포구
      part(cyl(0.22, 0.22, 0.72, 12), C.copper, 0, 0.2, -0.42, 0, 0, Math.PI / 2),                                          // 보일러
      part(sph(0.22, 8, 6), C.copper, 0.36, 0.2, -0.42), part(sph(0.22, 8, 6), C.copper, -0.36, 0.2, -0.42),
      part(tor(0.225, 0.02, 12), C.brass, 0.15, 0.2, -0.42, 0, Math.PI / 2), part(tor(0.225, 0.02, 12), C.brass, -0.15, 0.2, -0.42, 0, Math.PI / 2),
      part(cyl(0.07, 0.07, 0.5, 8), C.brass, 0.26, 0.56, -0.42), part(cyl(0.07, 0.07, 0.5, 8), C.brass, -0.26, 0.56, -0.42),   // 배기관
      part(cyl(0.11, 0.08, 0.1, 8), C.black, 0.26, 0.84, -0.42), part(cyl(0.11, 0.08, 0.1, 8), C.black, -0.26, 0.84, -0.42),
      part(cyl(0.16, 0.2, 0.1, 12), C.black, 0, 0.26, 0.36, 0.9),                                                         // 눈 받침
    ]);
    // --- 방패 기계병 ---
    GEO.shBody = merge([
      part(box(0.34, 0.6, 0.4), C.black, 0.28, 0.3, 0), part(box(0.34, 0.6, 0.4), C.black, -0.28, 0.3, 0),
      part(box(1.0, 0.24, 0.62), C.brass, 0, 0.7, 0),
      part(cyl(0.62, 0.48, 0.8, 8), C.dark, 0, 1.2, 0), part(box(1.5, 0.3, 0.6), C.dark, 0, 1.52, 0),
      part(sph(0.3, 8, 6), C.brass, 0.78, 1.5, 0), part(sph(0.3, 8, 6), C.brass, -0.78, 1.5, 0),
      part(box(0.44, 0.34, 0.44), C.black, 0, 1.82, 0.04), part(cyl(0.08, 0.08, 0.5, 6), C.brass, 0.24, 1.95, -0.2),
      part(box(0.24, 0.7, 0.24), C.dark, -0.82, 1.1, 0.1), part(box(0.4, 0.4, 0.6), C.steel, -0.82, 0.7, 0.3),   // 오른팔 망치
    ]);
    GEO.shield = merge([
      part(new T.CylinderGeometry(1.0, 1.0, 1.6, 12, 1, true, -1.0, 2.0), C.steel, 0, 0, 0),
      part(new T.CylinderGeometry(1.03, 1.03, 0.1, 12, 1, true, -1.0, 2.0), C.gold, 0, 0.78, 0),
      part(new T.CylinderGeometry(1.03, 1.03, 0.1, 12, 1, true, -1.0, 2.0), C.gold, 0, -0.78, 0),
      part(gear(0.34, 8, 0.06), C.gold, 0, 0.05, 1.01),
    ]);
    GEO.visor = box(0.36, 0.08, 0.06);
    GEO.mark = (() => { const g = new T.RingGeometry(0.72, 1, 32, 3); g.rotateX(-Math.PI / 2); return GZ.FX.shade(g, (x, z) => { const r = Math.hypot(x, z); return r > 0.9 ? 1.2 : (r - 0.72) * 1.4; }); })();
    MARK.red = new T.MeshBasicMaterial({ color: new T.Color(1.0, 0.3, 0.04), vertexColors: true, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    MARK.blue = new T.MeshBasicMaterial({ color: new T.Color(0.1, 0.4, 1.1), vertexColors: true, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    // r8: 방패 금색 테두리 · 브루트 주먹 주황 발광
    GEO.rim = new T.TorusGeometry(1, 0.075, 6, 36);
    MARK.rim = new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.05, 0.3), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, fog: false });
    MARK.fist = new T.SpriteMaterial({ map: GZ.R.canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, 'rgba(255,220,150,1)'); g.addColorStop(0.25, 'rgba(255,140,40,0.85)'); g.addColorStop(0.6, 'rgba(255,90,10,0.25)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }), color: 0xffffff, blending: T.AdditiveBlending, transparent: true, opacity: 0.4, depthWrite: false, fog: false });
    GEO.guard = (() => { const g = new T.RingGeometry(1.2, 1.36, 20, 1, -Math.PI / 2 - 1.25, 2.5); g.rotateX(-Math.PI / 2); return g; })();
    // --- 흡수기: 검은 구체 + 황동 띠 + 흡입 뿔 6개 + 늘어진 전선 ---
    GEO.abBody = merge([
      part(sph(0.42, 14, 10), C.black, 0, 0, 0), part(tor(0.43, 0.045, 22), C.brass, 0, 0, 0, Math.PI / 2),
      part(tor(0.3, 0.03, 18), C.copper, 0, 0.3, 0, Math.PI / 2), part(cyl(0.2, 0.3, 0.16, 10), C.dark, 0, 0.42, 0),
      part(cyl(0.2, 0.22, 0.14, 12), C.black, 0, -0.05, 0.36, Math.PI / 2), part(tor(0.2, 0.03, 14), C.brass, 0, -0.05, 0.43),
      part(cyl(0.16, 0.26, 0.14, 10), C.dark, 0, -0.42, 0),
    ].concat(
      around(6, 0.3, 0.56, (x, y, z, a) => part(cyl(0.012, 0.05, 0.42, 6), C.brass, x * 1.25, y, z * 1.25, 0.5, a)),
      around(6, 0.39, 0.74, (x, y, z) => part(sph(0.035, 5, 4), C.copper, x * 1.05, y, z * 1.05)),
      around(4, 0.24, -0.72, (x, y, z, a) => part(cyl(0.035, 0.012, 0.6, 5), C.brass, x, y, z, -0.28, a), 0.78),
      around(4, 0.32, -1.02, (x, y, z) => part(sph(0.04, 5, 4), C.steel, x, y, z), 0.78)));
    GEO.abRing = new T.TorusGeometry(0.78, 0.035, 6, 28);
    // --- r5 메트로놈 기계병 (3웨이브 전용): 사다리꼴 몸통(검정 금속) + 황동 앞판·눈금 + 좌우로 흔들리는 추 + 네 발 + 머리 위 박자 등 ---
    GEO.meBody = merge([
      part(sq(new T.CylinderGeometry(0.36, 0.78, 1.7, 4, 1), 1, 1, 0.82), C.dark, 0, 1.05, 0, 0, Math.PI / 4),
      part(sq(new T.CylinderGeometry(0.4, 0.82, 0.12, 4, 1), 1, 1, 0.86), C.brass, 0, 0.26, 0, 0, Math.PI / 4),
      part(sq(new T.CylinderGeometry(0.42, 0.42, 0.1, 4, 1), 1, 1, 0.86), C.brass, 0, 1.92, 0, 0, Math.PI / 4),
      part(box(0.6, 1.12, 0.04), C.copper, 0, 1.0, 0.41, -0.2), part(box(0.5, 1.0, 0.03), C.black, 0, 1.02, 0.435, -0.2), part(box(0.07, 1.1, 0.05), C.brass, 0, 1.0, 0.46, -0.2),   // 앞판: 구리 테 + 검은 창 + 황동 눈금 기둥
      part(cyl(0.11, 0.11, 0.14, 12), C.brass, 0, 1.55, 0.36, Math.PI / 2 - 0.2),
      part(cyl(0.05, 0.05, 0.42, 6), C.steel, 0, 2.17, 0), part(sph(0.16, 10, 8), C.black, 0, 2.38, 0),
    ].concat(around(4, 0.62, 0.12, (x, y, z, a) => part(box(0.26, 0.24, 0.36), C.black, x, y, z, 0, a), Math.PI / 4),
      [-0.22, -0.11, 0.11, 0.22].map((x) => part(box(0.1, 0.025, 0.03), C.gold, x, 0.65 + Math.abs(x) * 0.6, 0.48, -0.2)),
      around(6, 0.5, 0.33, (x, y, z) => part(sph(0.04, 5, 4), C.brass, x, y, z))));
    GEO.meArm = merge([part(box(0.05, 1.0, 0.04), C.steel, 0, 0.5, 0), part(cyl(0.12, 0.12, 0.09, 12), C.gold, 0, 0.62, 0, Math.PI / 2)]);
    GEO.abCore = sph(0.2, 10, 8);
    // --- 보스 「침묵 기관」 ---
    const pipes = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.2832 + 0.785, x = Math.sin(a) * 2.5, z = Math.cos(a) * 2.5;
      pipes.push(part(cyl(0.34, 0.42, 4.6, 10), C.brass, x, 2.9, z), part(cyl(0.5, 0.36, 0.5, 10), C.black, x, 5.3, z), part(box(0.9, 0.9, 0.9), C.dark, x, 0.9, z));
    }
    GEO.bossBase = merge([
      part(cyl(3.0, 3.5, 1.3, 8), C.dark, 0, 0.65, 0), part(cyl(3.1, 3.1, 0.18, 24), C.brass, 0, 1.36, 0),
      part(cyl(1.7, 2.3, 2.6, 10), C.black, 0, 2.6, 0), part(cyl(1.85, 1.85, 0.2, 20), C.brass, 0, 3.9, 0),
    ].concat(pipes));
    GEO.bossGear1 = part(gear(3.5, 16, 0.34), C.brass, 0, 0, 0, Math.PI / 2);
    GEO.bossGear2 = part(gear(2.6, 12, 0.3), C.steel, 0, 0, 0, Math.PI / 2);
    GEO.bossHead = merge([
      part(sph(1.75, 16, 12), C.dark, 0, 0, 0), part(cyl(1.82, 1.82, 0.22, 20), C.brass, 0, -0.1, 0),
      part(cyl(2.3, 0.9, 1.6, 14, true), C.black, 0, 2.1, 0), part(cyl(0.95, 0.95, 0.2, 14), C.brass, 0, 1.3, 0),   // 위쪽 「소음기」 나팔
      part(cyl(0.95, 1.05, 0.5, 16), C.black, 0, 0.1, 1.5, Math.PI / 2), part(new T.TorusGeometry(0.98, 0.09, 6, 24), C.gold, 0, 0.1, 1.76),
      part(box(0.5, 1.2, 1.0), C.black, 1.7, -0.2, 0), part(box(0.5, 1.2, 1.0), C.black, -1.7, -0.2, 0),
    ]);
    GEO.bossEye = new T.CircleGeometry(0.82, 24);
    GEO.beam = (() => { const g = box(1, 1, 1); g.translate(0, 0, 0.5); return g; })();
    PLAIN.copper = new T.MeshStandardMaterial({ color: 0x8c5a30, metalness: 0.9, roughness: 0.42, vertexColors: false });
    // r4 광선: 단색 띠 → 흰 심지 + 바깥으로 옅게 번지는 붉은 빛 (가로 방향 밝기 그라데이션)
    GEO.beamSoft = (() => { const g = new T.PlaneGeometry(1, 1, 8, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0.5); return GZ.FX.shade(g, (x) => { const a = Math.abs(x) * 2; return a > 0.98 ? 0 : (1 - a) * (1 - a) * 1.3; }); })();
    // 피스톤: 톱니 가장자리 도장판 + 검은 망치 머리 + 황동 띠·볼트 + 강철 피스톤 봉(고리) — 보스 본체와 같은 검정 금속·황동
    GEO.piston = merge([
      part(gear(2.25, 18, 0.34, { root: 0.9, hole: 0, bevel: 0.03 }), C.dark, 0, 0.17, 0, Math.PI / 2),
      part(cyl(1.85, 2.0, 0.6, 20), C.black, 0, 0.62, 0), part(cyl(2.03, 2.03, 0.14, 24), C.brass, 0, 0.94, 0),
      part(cyl(0.95, 1.75, 0.55, 16), C.dark, 0, 1.28, 0), part(cyl(1.0, 1.0, 0.12, 16), C.brass, 0, 1.6, 0),
      part(cyl(0.36, 0.36, 9, 12), C.steel, 0, 6.1, 0),
      part(cyl(0.48, 0.48, 0.22, 12), C.brass, 0, 2.6, 0), part(cyl(0.48, 0.48, 0.22, 12), C.black, 0, 4.2, 0), part(cyl(0.48, 0.48, 0.22, 12), C.brass, 0, 5.8, 0),
    ].concat(around(10, 1.9, 1.02, (x, y, z) => part(sph(0.11, 6, 5), C.brass, x, y, z)), around(4, 1.2, 1.4, (x, y, z, a) => part(box(0.14, 0.5, 0.9), C.black, x, y, z, 0, a))));
    GEO.pistonGlow = (() => { const g = new T.TorusGeometry(2.02, 0.05, 5, 36); g.rotateX(Math.PI / 2); g.translate(0, 0.42, 0); return g; })();
    GEO.shot = sph(0.3, 10, 8);
    GEO.bring = (() => { const g = new T.RingGeometry(0.955, 1, 72); g.rotateX(-Math.PI / 2); return g; })();
    GEO.bringIn = (() => { const g = new T.RingGeometry(0.968, 0.982, 72); g.rotateX(-Math.PI / 2); return g; })();   // r8: 고리 안쪽 흰 심지
  }

  const STAT = {
    drone: { r: 0.6, hp: 26, y: 1.15 },
    turret: { r: 0.9, hp: 80, y: 0 },
    shield: { r: 0.85, hp: 110, y: 0 },
    absorber: { r: 0.75, hp: 70, y: 1.5 },
    metro: { r: 0.8, hp: 95, y: 0 },
    brute: { r: 1.15, hp: 170, y: 0 },    // r6 「피스톤 브루트」: 느리게 다가와 주먹을 들고(붉은 부채꼴 0.85초) 앞을 내려침 — 2·3웨이브      // r5: 3웨이브 전용 — 박자마다 한 칸씩 걸어오고 4박째에 내려찍음. 「정박」 음파로만 제대로 부서짐
    boss: { r: 2.7, hp: 10800, y: 0 },   // r4: 6600 → 9600, r5: 4단계(과열)를 더하며 10800 (숙련 한 판 4분 이상)
  };
  EN.STAT = STAT;
  const D = () => (GZ.G && GZ.G.D) || {};   // r8: 난이도 값
  const SHIELD_RIM = [0.5, 0.93, 0.14, 0.56], BRUTE_FIST = [1.0, 0.55, 0.85, 1.3];   // r8: 방패 테두리 [x,y,z,반지름] · 주먹 발광 [x,y,z,크기] (모델 기준)
  const DMG = (EN.DMG = { drone: 12, turret: 16, slam: 22, ring: 12, beam: 16, piston: 20, volley: 13, orb: 9, metro: 18, brute: 20 });   // r4: 보스가 단단해진(9200) 만큼 고리 18→15·광선 18→16·피스톤 21→20·포격 14→13   // r3: 고리 17→18, 광선 17→18, 피스톤 20→21 (고리가 공정해지고 궁극기가 세진 만큼)   // 피해량 (r2: 한곳에 모음)

  const shotPool = [], ringPool = [], pistons = [], beams = [];
  EN.init = function (sc) {
    scene = sc; buildGeos();
    for (let i = 0; i < 26; i++) { const m = new T.Mesh(GEO.shot, new T.MeshBasicMaterial({ color: new T.Color(2.2, 0.7, 0.2) })); m.visible = false; scene.add(m); shotPool.push(m); }
    // r8 (검토 B3): 고리 색 — 형광 분홍 → 짙은 구리빛 빨강 테두리 + 안쪽 흰 심지 (청동·금 팔레트 안에서, 내 금빛 음파와는 붉기·흰 줄로 구분)
    for (let i = 0; i < 4; i++) { const m = new T.Mesh(GEO.bring, new T.MeshBasicMaterial({ color: new T.Color(1.45, 0.2, 0.04), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); m.visible = false; m.position.y = 0.3; m.renderOrder = 11; const c = new T.Mesh(GEO.bringIn, new T.MeshBasicMaterial({ color: new T.Color(1.5, 1.25, 0.95), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); c.position.y = 0.01; c.renderOrder = 12; m.add(c); m.userData.core = c; scene.add(m); ringPool.push(m); }
    for (let i = 0; i < 6; i++) { const m = new T.Mesh(GEO.piston, GZ.MAT.mech); m.visible = false; m.castShadow = true; m.add(new T.Mesh(GEO.pistonGlow, GZ.MAT.red)); scene.add(m); pistons.push({ m, t: -1 }); }
    for (let i = 0; i < 3; i++) {
      const m = new T.Group(); m.visible = false;
      const glow = new T.Mesh(GEO.beamSoft, new T.MeshBasicMaterial({ color: new T.Color(1.9, 0.2, 0.1), vertexColors: true, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); glow.scale.set(3.4, 1, 1); glow.position.y = -0.3; glow.renderOrder = 10;
      const mid = new T.Mesh(GEO.beam, new T.MeshBasicMaterial({ color: new T.Color(1.8, 0.3, 0.14), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false })); mid.renderOrder = 11;
      const core = new T.Mesh(GEO.beam, new T.MeshBasicMaterial({ color: new T.Color(2.4, 1.9, 1.5), transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, fog: false })); core.scale.set(0.3, 0.4, 1); core.renderOrder = 12;
      m.add(glow, mid, core); scene.add(m); beams.push(m);
    }
  };

  function makeModel(e) {
    const g = new T.Group(), mat = GZ.MAT.mech.clone();
    e.mat = mat;
    const mesh = (geo, m, cast) => { const o = new T.Mesh(geo, m || mat); o.castShadow = cast !== false; return o; };
    if (e.kind === 'drone') {
      e.body = mesh(GEO.droneBody); e.gear = mesh(GEO.droneGear); e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(0, 0, 0.3);
      g.add(e.body, e.gear, e.eye);
    } else if (e.kind === 'turret' && GZ.MD && GZ.MD.crawler) {   // r6: 포탑 = 「보일러 크롤러」 (네 다리 보일러 거미, 통짜) — 몸 전체가 겨눈 쪽으로 돎
      const c = GZ.MD.cloneStatic(GZ.MD.crawler); mat.dispose(); e.mat = c.mat; const M = GZ.MD.crawler, H = M.h, D = M.size.z * M.scale;
      e.base = new T.Object3D(); e.head = new T.Group(); e.head.add(c.grp); e.glb = true;
      e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(0, H * 0.42, D * 0.5); e.eye.scale.set(1.6, 1.0, 0.6);
      e.head.add(e.eye); g.add(e.base, e.head);
    } else if (e.kind === 'turret') {
      e.base = mesh(GEO.turBase); e.head = new T.Group(); e.head.position.y = 1.15;
      const h = mesh(GEO.turHead); e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(0, 0.26, 0.4); e.eye.scale.setScalar(1.2);
      e.head.add(h, e.eye); g.add(e.base, e.head);
    } else if (e.kind === 'shield') {
      if (GZ.MD && GZ.MD.shield) {   // 정예 방패 기계병 glb (통짜) — 방패는 몸에 붙어 있음
        const c = GZ.MD.cloneStatic(GZ.MD.shield); mat.dispose(); e.mat = c.mat; e.body = c.grp; e.shield = null;
        e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(-0.1, 1.08, 0.52); e.eye.scale.set(1.5, 1.5, 0.6);
        // r8 (검토 B4): 방패(톱니 원판) 금색 테두리 — 브루트(주황 주먹)와 중간 거리에서 바로 갈리게
        e.rim = new T.Mesh(GEO.rim, MARK.rim); e.rim.position.set(SHIELD_RIM[0], SHIELD_RIM[1], SHIELD_RIM[2]); e.rim.scale.setScalar(SHIELD_RIM[3]);
        g.add(e.body, e.eye, e.rim);
      } else {
        e.body = mesh(GEO.shBody); e.shield = mesh(GEO.shield); e.shield.position.set(0, 1.05, 0.05);
        e.eye = new T.Mesh(GEO.visor, GZ.MAT.red); e.eye.position.set(0, 1.84, 0.26);
        g.add(e.body, e.shield, e.eye);
      }
      // 앞쪽 방어 표시 (바닥의 금색 호) — 켜져 있으면 정면 음파가 막힘
      e.guard = new T.Mesh(GEO.guard, new T.MeshBasicMaterial({ color: new T.Color(1.1, 0.7, 0.17), transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      e.guard.position.y = 0.08; g.add(e.guard);
    } else if (e.kind === 'absorber') {
      e.body = mesh(GEO.abBody); e.ring1 = new T.Mesh(GEO.abRing, GZ.MAT.blue); e.ring2 = new T.Mesh(GEO.abRing, GZ.MAT.blue); e.ring2.scale.setScalar(0.72);
      e.eye = new T.Mesh(GEO.abCore, GZ.MAT.blue); e.eye.position.y = -0.05; e.eye.position.z = 0.36;
      e.beam = new T.Mesh(GEO.beam, new T.MeshBasicMaterial({ color: new T.Color(0.2, 0.6, 1.8), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
      e.beam.visible = false; e.beam.renderOrder = 11;
      g.add(e.body, e.ring1, e.ring2, e.eye, e.beam);
    } else if (e.kind === 'metro' && GZ.MD && GZ.MD.conductor) {   // r6: 메트로놈 = 「뮤트 컨덕터」 (축음기 나팔 어깨·메트로놈 등·붉은 소리굽쇠 가슴, 키 3.4) — 가슴 등이 박자에 번쩍
      const c = GZ.MD.cloneStatic(GZ.MD.conductor); mat.dispose(); e.mat = c.mat; const M = GZ.MD.conductor, H = M.h, D = M.size.z * M.scale;
      e.body = c.grp; e.arm = new T.Object3D(); e.glb = true;
      e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(0, H * 0.86, D * 0.3);
      e.lamp = new T.Mesh(GEO.abCore, new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.0, 0.25), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); e.lamp.position.set(0, H * 0.62, D * 0.32); e.lamp.scale.setScalar(0.9); e.eyeMat = e.lamp.material;
      g.add(e.body, e.arm, e.eye, e.lamp);
    } else if (e.kind === 'brute') {   // r6 「피스톤 브루트」 (통짜 glb, 없으면 방패병 몸을 크게)
      if (GZ.MD && GZ.MD.brute) { const c = GZ.MD.cloneStatic(GZ.MD.brute); mat.dispose(); e.mat = c.mat; e.body = c.grp; e.glb = true; }
      else { e.body = mesh(GEO.shBody); e.body.scale.set(1.45, 1.3, 1.45); }
      const M = GZ.MD && GZ.MD.brute, H = M ? M.h : 2.6, D = M ? M.size.z * M.scale : 1.2;
      e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(0, H * 0.74, D * 0.36); e.eye.scale.set(1.0, 0.6, 0.5);   // 눈(붉은 바이저) 자리 — 주먹 들 때만 크게 번쩍
      g.add(e.body, e.eye);
      // r8 (검토 B4): 피스톤 주먹 주황 발광 (평소 약하게, 주먹을 들 때 강하게) — 방패병(금색 방패 테두리)과 구분
      e.fists = [-1, 1].map((sx) => { const m = new T.Sprite(MARK.fist.clone()); m.position.set(sx * BRUTE_FIST[0], BRUTE_FIST[1], BRUTE_FIST[2]); m.scale.setScalar(BRUTE_FIST[3]); m.renderOrder = 9; g.add(m); return m; });
    } else if (e.kind === 'metro') {
      e.body = mesh(GEO.meBody); e.arm = mesh(GEO.meArm); e.arm.position.set(0, 0.62, 0.5); e.arm.rotation.order = 'ZXY';
      e.eye = new T.Mesh(GEO.eye, GZ.MAT.red); e.eye.position.set(0, 2.38, 0.12); e.eye.scale.setScalar(1.1);
      e.lamp = new T.Mesh(GEO.abCore, new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.0, 0.25), transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); e.lamp.position.set(0, 2.38, 0); e.lamp.scale.setScalar(0.9); e.eyeMat = e.lamp.material;
      g.add(e.body, e.arm, e.eye, e.lamp);
    } else if (e.kind === 'boss') {
      if (GZ.MD && GZ.MD.boss) {     // 보스 glb (통짜): 몸 전체를 돌리고 기울임 + 가슴 코어에 붉은 발광
        const c = GZ.MD.cloneStatic(GZ.MD.boss); mat.dispose(); e.mat = c.mat;
        e.g1 = mesh(GEO.bossGear2, PLAIN.copper); e.g1.position.y = 0.16; e.g1.scale.setScalar(1.3); e.g2 = new T.Object3D();   // r4: 옆면 무늬가 깨져 보이던 발판 톱니 → 단색 구리
        e.head = new T.Group(); e.headY = 0;
        e.eyeMat = new T.MeshBasicMaterial({ color: new T.Color(4, 0.45, 0.25), transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false });
        e.eye = new T.Mesh(GEO.shot, e.eyeMat); e.eye.position.set(0, 2.7, 1.5); e.eye.scale.set(1.7, 1.7, 0.9);   // r3: 붉은 번짐이 보스 전체를 분홍으로 덮지 않게
        e.head.add(c.grp, e.eye); g.add(e.g1, e.g2, e.head);
      } else {
        e.base = mesh(GEO.bossBase); e.g1 = mesh(GEO.bossGear1); e.g1.position.y = 1.75; e.g2 = mesh(GEO.bossGear2); e.g2.position.y = 3.55;
        e.head = new T.Group(); e.head.position.y = 5.0; e.headY = 5.0;
        const h = mesh(GEO.bossHead);
        e.eyeMat = new T.MeshBasicMaterial({ color: new T.Color(4, 0.45, 0.25) });
        e.eye = new T.Mesh(GEO.bossEye, e.eyeMat); e.eye.position.set(0, 0.1, 1.77);
        e.head.add(h, e.eye); g.add(e.base, e.g1, e.g2, e.head);
      }
    }
    g.rotation.order = 'YXZ'; if (e.head) e.head.rotation.order = 'YXZ';
    if (e.kind !== 'boss') {   // 발밑 표시 (폰에서 작은 적도 잘 보이게)
      e.mark = new T.Mesh(GEO.mark, e.kind === 'absorber' ? MARK.blue : MARK.red);
      e.mark.scale.setScalar(e.r * (e.kind === 'drone' ? 1.6 : 1.25)); e.mark.renderOrder = 4; scene.add(e.mark);
    }
    scene.add(g);
    e.grp = g;
  }

  EN.spawn = function (kind, x, z, opt) {
    const s = STAT[kind];
    const e = { id: nextId++, kind, x, z, vx: 0, vz: 0, r: s.r, hp: s.hp, max: s.hp, y: s.y, face: GZ.ang(-x, -z), state: 'spawn', t: 0, st: 0, cd: 0, stun: 0, flash: 0, spawnT: 0.6, dead: false, broken: 0, tg: null, lvl: (opt && opt.lvl) || 1, seed: GZ.rand() * 100, push: 0 };
    if (opt && opt.hp) { e.hp = e.max = opt.hp; }
    makeModel(e);
    if (kind === 'turret') { e.spawnT = 0.9; e.tg = GZ.FX.tgCircle(x, z, 1.3); e.cd = 0.8 + GZ.rand() * 0.8; }
    if (kind === 'metro') { e.beatN = Math.floor(GZ.G.bt / GZ.AU.BEAT); e.count = 0; e.hop = 0; }
    if (kind === 'absorber') e.cd = 2.5 + GZ.rand() * 1.5;
    if (kind === 'brute') e.cd = 1.2;
    if (kind === 'boss') { e.hp = e.max = Math.round(s.hp * (GZ.G.D ? GZ.G.D.bossHp : 1)); e.spawnT = 2.6; e.phase = 1; e.atk = -1; e.aims = []; e.vuln = 0; e.beamA = 0; e.beamN = 0; e.beamDir = 1; e.count = 0; e.cd = 1.2; EN.boss = e; }
    else GZ.FX.ring(x, z, 0.3, 1.8, 0.4, kind === 'absorber' ? 'blue' : 'red', 1);
    e.grp.position.set(x, kind === 'turret' ? 14 : kind === 'boss' ? -7.5 : e.y, z);
    EN.list.push(e);
    return e;
  };

  function freeTG(e) { if (e.tg) { e.tg.free(); e.tg = null; } if (e.aims) { for (const a of e.aims) if (a.tg) a.tg.free(); e.aims.length = 0; } }
  function remove(e) {
    e.dead = true; freeTG(e);
    scene.remove(e.grp); if (e.mark) scene.remove(e.mark);
    e.mat.dispose();
    if (e.beam) e.beam.material.dispose();
    if (e.guard) e.guard.material.dispose();
    if (e.fists) for (const f of e.fists) f.material.dispose();
    if (e.eyeMat) e.eyeMat.dispose();
    if (e === EN.boss) { for (const b of beams) b.visible = false; }
  }
  EN.reset = function () {
    for (const e of EN.list) if (!e.dead) remove(e);
    EN.list.length = 0; EN.boss = null;
    for (const s of EN.shots) s.m.visible = false; EN.shots.length = 0;
    for (const r of EN.rings) r.m.visible = false; EN.rings.length = 0;
    for (const p of pistons) { p.m.visible = false; p.t = -1; }
    for (const b of beams) b.visible = false;
    GZ.FX.clearTG();
  };
  EN.clearHazards = function () { for (const r of EN.rings) r.m.visible = false; EN.rings.length = 0; for (const p of pistons) { if (p.t >= 0 && p.tg) p.tg.free(); p.m.visible = false; p.t = -1; } for (const s of EN.shots) s.m.visible = false; EN.shots.length = 0; const b = EN.boss; if (b && b.aims) { for (const a of b.aims) if (a.tg) a.tg.free(); b.aims.length = 0; } };
  EN.alive = function () { let n = 0; for (const e of EN.list) if (!e.dead) n++; return n; };

  EN.shoot = function (x, z, ang, spd, dmg, blue) {
    let m = null; for (const p of shotPool) if (!p.visible) { m = p; break; }
    if (!m) return;
    m.visible = true; m.position.set(x, 1.1, z);
    if (blue) m.material.color.setRGB(0.35, 0.9, 2.6); else m.material.color.setRGB(2.2, 0.7, 0.2);
    m.scale.setScalar(blue ? 0.85 : 1);
    EN.shots.push({ x, z, vx: Math.sin(ang) * spd, vz: Math.cos(ang) * spd, r: 0.4, dmg, life: blue ? 3.2 : 2.2, m, blue: !!blue });
    GZ.AU.shot();
    GZ.FX.puff(x, 1.1, z, Math.sin(ang) * 2, 0.6, Math.cos(ang) * 2, 0.6, 1.8, 0.5, 0.3);
  };
  EN.clearShots = function (x, z, r) {
    let n = 0;
    for (const s of EN.shots) if (s.life > 0 && Math.hypot(s.x - x, s.z - z) < r) { s.life = 0; n++; GZ.FX.burst(s.x, 1.1, s.z, 6, 'gold', 5, 0.2, 0.3); }
    return n;
  };

  /* 피해 주기. 반환: 'none' | 'block' | 'hit' | 'kill'.  o: {skill, ult} */
  EN.damage = function (e, dmg, fx, fz, o) {
    if (e.dead || e.spawnT > 0 || e.state === 'dying' || e.state === 'shift') return 'none';
    o = o || {};
    if (e.kind === 'shield' && !o.skill && !o.ult && e.broken <= 0 && e.stun <= 0 && e.state !== 'recover') {
      const a = GZ.ang(fx - e.x, fz - e.z);
      if (Math.abs(GZ.angDiff(a, e.face)) < 1.25) {
        e.flash = 0.25; GZ.FX.spray(e.x + Math.sin(e.face) * 0.9, 1.2, e.z + Math.cos(e.face) * 0.9, a, 5, 'white', 6);
        return 'block';
      }
    }
    if (e.kind === 'boss' && e.vuln > 0) dmg *= 1.5;
    if (e.kind === 'metro' && !o.skill && !o.ult) {   // r5 메트로놈: 「정박」은 1.4배, 그 밖의 음파는 30%만
      if (o.perfect) dmg *= 1.4;
      else { dmg *= 0.3; if (GZ.G.t - (e.armT || -9) > 0.9) { e.armT = GZ.G.t; GZ.FX.text(e.x, 2.9, e.z, '정박으로!', 'blk', 0.7, true); GZ.FX.ring(e.x, e.z, 0.5, 1.4, 0.2, 'gold', 1, 2.4); } }
    }
    e.lastDmg = dmg;
    e.hp -= dmg; e.flash = 1; e.punch = 1; e.hitA = GZ.ang(e.x - fx, e.z - fz);
    if (e.kind !== 'boss' && e.kind !== 'turret') {   // r5: 맞은 순간 0.06초 멈칫했다가 밀려남
      const d = Math.hypot(e.x - fx, e.z - fz) || 1, k = e.kind === 'drone' ? 6.5 : e.kind === 'absorber' ? 3.2 : e.kind === 'metro' ? 1.2 : e.kind === 'brute' ? 0.6 : 1.8;
      e.pvx = (e.pvx || 0) + ((e.x - fx) / d) * k; e.pvz = (e.pvz || 0) + ((e.z - fz) / d) * k; e.hitFreeze = 0.06;
    }
    if (e.hp <= 0) {
      if (e.kind === 'boss') { e.hp = 0; e.state = 'dying'; e.t = 0; freeTG(e); for (const b of beams) b.visible = false; e.beamN = 0; GZ.G.onBossDying(e); return 'kill'; }
      EN.kill(e); return 'kill';
    }
    return 'hit';
  };
  EN.kill = function (e) {
    const big = e.kind === 'drone' ? 0 : 1;
    GZ.FX.explode(e.x, e.kind === 'drone' || e.kind === 'absorber' ? e.y : 1.0, e.z, big);
    if (e.kind === 'absorber') GZ.FX.burst(e.x, e.y, e.z, 16, 'blue', 8, 0.3, 0.6, 2);
    GZ.AU.boom(big);
    remove(e);
    GZ.G.onKill(e);
  };
  EN.hideNear = function (x, z, r) { for (const e of EN.list) if (!e.dead && e.kind !== 'boss' && Math.hypot(e.x - x, e.z - z) < r) { e.grp.visible = false; if (e.mark) e.mark.visible = false; e.hidden = true; } GZ.FX.clearTG(); for (const s of EN.shots) s.m.visible = false; };
  EN.stunAll = function (x, z, r, dur, bossStun) {
    let n = 0;
    for (const e of EN.list) {
      if (e.dead || e.spawnT > 0) continue;
      if (Math.hypot(e.x - x, e.z - z) > r + e.r) continue;
      n++;
      if (e.kind === 'boss') { if (e.state !== 'shift' && e.state !== 'dying') { e.stun = Math.max(e.stun, bossStun || 1.4); e.vuln = 3.6; } continue; }
      e.stun = Math.max(e.stun, dur);
      if (e.kind === 'shield') e.broken = 6.5;
      if (e.state === 'wind' || e.state === 'aim' || e.state === 'dash' || e.state === 'charge') { e.state = e.kind === 'turret' ? 'idle' : 'chase'; e.cd = 1.2; freeTG(e); }
      GZ.FX.burst(e.x, 1.4, e.z, 6, 'gold', 4, 0.2, 0.4, 2);
    }
    return n;
  };

  // ---------- 종류별 행동 ----------
  function sep(e) {
    for (const o of EN.list) {
      if (o === e || o.dead || o.kind === 'boss') continue;
      const dx = e.x - o.x, dz = e.z - o.z, d = Math.hypot(dx, dz), m = e.r + o.r;
      if (d < m && d > 0.001) { const k = (m - d) / d * 0.5; e.x += dx * k; e.z += dz * k; }
    }
    const b = EN.boss;
    if (b && !b.dead && b !== e) { const d = Math.hypot(e.x, e.z), m = b.r + e.r; if (d < m && d > 0.001) { e.x *= m / d; e.z *= m / d; } }
    const d = Math.hypot(e.x, e.z), lim = GZ.AR.R - 0.3;
    if (d > lim) { e.x *= lim / d; e.z *= lim / d; }
  }

  const WIND = 0.56;   // r3: 드론 돌진 예고 0.42 → 0.56초 (화면 밖에서 와도 화살표·띠·경보음을 보고 피할 수 있게)
  EN.WIND = WIND;
  function drone(e, dt, P, dx, dz, dist) {
    const sp = (4.4 + e.lvl * 0.45) * (GZ.G.D ? GZ.G.D.droneSp : 1);
    if (e.state === 'chase') {
      e.cd -= dt;
      const w = Math.sin(e.st * 2.6 + e.seed) * 1.6;
      const tx = (dx / dist) * sp + (-dz / dist) * w, tz = (dz / dist) * sp + (dx / dist) * w;
      const k = 1 - Math.exp(-dt * 3.5);
      e.vx += (tx - e.vx) * k; e.vz += (tz - e.vz) * k;
      e.face = GZ.angTo(e.face, GZ.ang(dx, dz), dt * 8);
      if (dist < 4.8 && e.cd <= 0) { e.state = 'wind'; e.t = WIND; e.dash = GZ.ang(dx, dz); GZ.AU.warn(); e.tg = GZ.FX.tgLine(e.x, e.z, e.dash, 5.6, 0.7); }
    } else if (e.state === 'wind') {   // 예고: 멈칫 + 눈이 번쩍
      e.vx *= Math.exp(-dt * 8); e.vz *= Math.exp(-dt * 8);
      if (e.t > 0.2) e.dash = GZ.ang(dx, dz);
      e.face = e.dash; e.t -= dt;
      if (e.tg) { e.tg.move(e.x, e.z, e.dash); e.tg.set(1 - e.t / WIND); }
      if (e.t <= 0) { e.state = 'dash'; e.t = 0.42; e.hitP = false; freeTG(e); }
    } else if (e.state === 'dash') {
      e.vx = Math.sin(e.dash) * 13.5; e.vz = Math.cos(e.dash) * 13.5; e.t -= dt;
      if (!e.hitP && dist < e.r + 0.55) { e.hitP = true; if (GZ.G.hurt(DMG.drone, e.x, e.z, 'drone')) { e.vx *= -0.4; e.vz *= -0.4; e.t = 0; } }
      if (Math.random() < 0.6) GZ.FX.spark(e.x, e.y, e.z, 0, 1, 0, 2.6, 0.5, 0.2, 0.22, 0.25);
      if (e.t <= 0) { e.state = 'recover'; e.t = 0.75; }
    } else if (e.state === 'recover') {
      e.vx *= Math.exp(-dt * 4); e.vz *= Math.exp(-dt * 4); e.t -= dt;
      if (e.t <= 0) { e.state = 'chase'; e.cd = 0.9 + GZ.rand() * 0.8; }
    }
    e.x += e.vx * dt; e.z += e.vz * dt;
  }

  function turret(e, dt, P, dx, dz, dist) {
    if (e.state === 'idle') {
      e.face = GZ.angTo(e.face, GZ.ang(dx, dz), dt * 1.5);
      e.cd -= dt;
      if (e.cd <= 0 && dist < 30) {
        // r8 (검토 A1): 동시에 겨누는 크롤러는 최대 aimMax 기 — 넘으면 조금 기다림 (웨이브 3 붉은 선 다발 방지)
        let n = 0; for (const o of EN.list) if (o !== e && !o.dead && o.kind === 'turret' && o.state === 'aim') n++;
        if (n >= (D().aimMax || 9)) e.cd = 0.35 + GZ.rand() * 0.4;
        else { e.state = 'aim'; e.t = e.aimT = D().aimT || 0.95; e.tg = GZ.FX.tgLine(e.x, e.z, e.face, 26, 0.55); GZ.AU.warn(); }
      }
    } else if (e.state === 'aim') {
      e.t -= dt;
      if (e.t > 0.3) e.face = GZ.angTo(e.face, GZ.ang(dx, dz), dt * 3.2);   // 마지막 0.3초는 고정
      if (e.tg) { e.tg.move(e.x, e.z, e.face); e.tg.set(1 - e.t / (e.aimT || 0.95)); }
      if (e.t <= 0) {
        freeTG(e);
        EN.shoot(e.x + Math.sin(e.face) * 1.5, e.z + Math.cos(e.face) * 1.5, e.face, (e.lvl >= 2 ? 19 : 22) * (D().turSp || 1), D().turDmg || DMG.turret);   // r8: 정규 크롤러 탄 16→13·속도 ×0.85   // r5: 2·3웨이브 포탑 탄 22 → 19 (옆걸음으로 피할 틈)
        e.kick = 1; e.state = 'idle'; e.cd = ((e.lvl >= 3 ? 1.9 : e.lvl >= 2 ? 2.4 : 2.1) + GZ.rand() * 0.6) * (GZ.G.D ? GZ.G.D.turretCd : 1);   // r5: 2·3웨이브 쉬는 시간 1.5/2.1 → 1.9/2.4 (탄 압박 완화)
      }
    }
  }

  function shield(e, dt, P, dx, dz, dist) {
    const want = GZ.ang(dx, dz);
    if (e.state === 'chase') {
      e.face = GZ.angTo(e.face, want, dt * 1.5);   // r2: 2.0 → 1.5 (걸어서 뒤를 잡을 수 있게)
      const off = Math.abs(GZ.angDiff(want, e.face));
      const sp = off < 1.0 ? 2.5 + e.lvl * 0.15 : 0.6;
      e.vx += (Math.sin(e.face) * sp - e.vx) * (1 - Math.exp(-dt * 6)); e.vz += (Math.cos(e.face) * sp - e.vz) * (1 - Math.exp(-dt * 6));
      e.cd -= dt;
      if (dist < 2.7 && off < 0.7 && e.cd <= 0) { e.state = 'wind'; e.windT = e.lvl === 2 ? 0.75 : 0.62; e.t = e.windT; e.tg = GZ.FX.tgCone(e.x, e.z, e.face, 3.3, 0.95); GZ.AU.warn(); }
    } else if (e.state === 'wind') {
      e.vx *= Math.exp(-dt * 10); e.vz *= Math.exp(-dt * 10); e.t -= dt;
      if (e.tg) { e.tg.move(e.x, e.z, e.face); e.tg.set(1 - e.t / (e.windT || 0.62)); }
      if (e.t <= 0) {
        freeTG(e);
        const hx = e.x + Math.sin(e.face) * 1.6, hz = e.z + Math.cos(e.face) * 1.6;
        GZ.FX.ring(hx, hz, 0.4, 3.2, 0.3, 'red', 1.2); GZ.FX.burst(hx, 0.3, hz, 10, 'ember', 7, 0.25, 0.4, 2); GZ.AU.slam(); GZ.R.shake(0.25);
        if (dist < 3.3 + 0.5 && Math.abs(GZ.angDiff(want, e.face)) < 1.15) GZ.G.hurt(e.lvl === 2 ? DMG.slam - 3 : DMG.slam, e.x, e.z, 'slam');   // r4: 2웨이브(처음 만나는 방패병)는 22 → 19
        e.state = 'recover'; e.t = 1.05;
      }
    } else if (e.state === 'recover') {   // 내려친 뒤 빈틈 — 방패가 내려가 있음
      e.vx *= Math.exp(-dt * 10); e.vz *= Math.exp(-dt * 10); e.t -= dt;
      if (e.t <= 0) { e.state = 'chase'; e.cd = 0.5; }
    }
    e.x += e.vx * dt; e.z += e.vz * dt;
  }

  // ---------- r6 피스톤 브루트: 느리게 다가와 → 주먹을 높이 들고 0.85초(붉은 부채꼴) → 앞을 내려침(넓고 아픔) → 1.2초 빈틈 ----------
  function brute(e, dt, P, dx, dz, dist) {
    const want = GZ.ang(dx, dz);
    if (e.state === 'chase') {
      e.face = GZ.angTo(e.face, want, dt * 1.7);
      const sp = 1.75 + e.lvl * 0.1;
      e.vx += (Math.sin(e.face) * sp - e.vx) * (1 - Math.exp(-dt * 5)); e.vz += (Math.cos(e.face) * sp - e.vz) * (1 - Math.exp(-dt * 5));
      e.cd -= dt;
      if (dist < 3.3 && Math.abs(GZ.angDiff(want, e.face)) < 0.6 && e.cd <= 0) { e.state = 'wind'; e.t = 0.85; e.tg = GZ.FX.tgCone(e.x, e.z, e.face, 3.8, 1.05); GZ.AU.warn(); }
    } else if (e.state === 'wind') {
      e.vx *= Math.exp(-dt * 10); e.vz *= Math.exp(-dt * 10); e.t -= dt;
      if (e.tg) { e.tg.move(e.x, e.z, e.face); e.tg.set(1 - e.t / 0.85); }
      if (e.t <= 0) {
        freeTG(e); e.slam = 1;
        const hx = e.x + Math.sin(e.face) * 2.0, hz = e.z + Math.cos(e.face) * 2.0;
        GZ.FX.ring(hx, hz, 0.5, 3.6, 0.32, 'red', 1.4); GZ.FX.burst(hx, 0.3, hz, 14, 'ember', 8, 0.25, 0.45, 2.2); GZ.AU.slam(); GZ.R.shake(0.32);
        for (let k = 0; k < 4; k++) GZ.FX.puff(hx + (Math.random() - 0.5) * 2, 0.3, hz + (Math.random() - 0.5) * 2, 0, 1.4, 0, 0.9, 2.6, 0.7, 0.12, 0xb9a68a);   // 증기
        if (dist < 3.8 + 0.5 && Math.abs(GZ.angDiff(want, e.face)) < 1.1) GZ.G.hurt(DMG.brute, e.x, e.z, 'brute');
        e.state = 'recover'; e.t = 1.2;
      }
    } else if (e.state === 'recover') {
      e.vx *= Math.exp(-dt * 10); e.vz *= Math.exp(-dt * 10); e.t -= dt;
      if (e.t <= 0) { e.state = 'chase'; e.cd = 0.8; }
    }
    e.x += e.vx * dt; e.z += e.vz * dt;
  }

  function absorber(e, dt, P, dx, dz, dist) {
    // r5 공격 패턴: 3.6초마다 푸른 코어를 0.7초 모았다가(예고선) 느린 「흡수탄」 1발 — 게이지가 비어 있으면 2발 부채꼴
    e.cd -= dt;
    if (e.state === 'charge') {
      e.t -= dt; e.vx *= Math.exp(-dt * 6); e.vz *= Math.exp(-dt * 6); e.x += e.vx * dt; e.z += e.vz * dt;
      e.face = GZ.ang(dx, dz); if (e.tg) { e.tg.move(e.x, e.z, e.face); e.tg.set(1 - e.t / 0.7); }
      if (e.t <= 0) {
        freeTG(e); const two = P.gauge <= 0.5;
        for (const da of two ? [-0.09, 0.09] : [0]) EN.shoot(e.x + Math.sin(e.face + da) * 0.9, e.z + Math.cos(e.face + da) * 0.9, e.face + da, 9.5, DMG.orb, true);
        GZ.FX.burst(e.x, e.y, e.z, 10, 'blue', 5, 0.25, 0.4, 1); e.state = 'chase'; e.cd = 3.6 + GZ.rand() * 0.8;
      }
      e.drain = false; return;
    }
    if (e.cd <= 0 && dist < 11 && !P.down) { e.state = 'charge'; e.t = 0.7; e.tg = GZ.FX.tgLine(e.x, e.z, GZ.ang(dx, dz), 12, 0.5); e.tg.color(0x3a8cff); GZ.AU.warn(); }
    const want = dist > 4.6 ? 1 : dist < 3.2 ? -0.7 : 0;
    const sp = 2.1;
    const tx = (dx / dist) * sp * want + (-dz / dist) * 0.9, tz = (dz / dist) * sp * want + (dx / dist) * 0.9;
    e.vx += (tx - e.vx) * (1 - Math.exp(-dt * 3)); e.vz += (tz - e.vz) * (1 - Math.exp(-dt * 3));
    e.x += e.vx * dt; e.z += e.vz * dt;
    e.face = GZ.ang(dx, dz);
    e.drain = dist < 6.4 && !P.down;
    if (e.drain) GZ.G.drain(dt * 9, e);
  }

  // ---------- r5 메트로놈 기계병: 박자(BGM 박)마다 한 칸 뛰어 다가오고, 4박마다 발밑을 내려찍음(한 박 전에 붉은 원 예고) ----------
  function metro(e, dt, P, dx, dz, dist) {
    const BEAT = GZ.AU.BEAT, bn = Math.floor(GZ.G.bt / BEAT);
    e.face = GZ.angTo(e.face, GZ.ang(dx, dz), dt * 4);
    if (bn !== e.beatN) {
      e.beatN = bn; e.count++;
      if (e.state === 'wind') {   // 내려찍기
        freeTG(e); e.state = 'chase'; e.stomp = 1;
        GZ.FX.ring(e.x, e.z, 0.5, 2.9, 0.3, 'red', 1.4); GZ.FX.burst(e.x, 0.3, e.z, 12, 'ember', 7, 0.25, 0.4, 2); GZ.AU.slam(); GZ.R.shake(0.22);
        if (dist < 2.6 + 0.45) GZ.G.hurt(DMG.metro, e.x, e.z, 'metro');
      } else if (e.count % 4 === 3 && dist < 4.4) { e.state = 'wind'; e.t = BEAT; e.tg = GZ.FX.tgCircle(e.x, e.z, 2.6); GZ.AU.warn(); }
      else if (dist > 1.8) { e.hop = 1; const st = Math.min(1.5, dist - 1.6); e.hx = Math.sin(e.face) * st; e.hz = Math.cos(e.face) * st; }
    }
    if (e.state === 'wind') { e.t -= dt; if (e.tg) { e.tg.move(e.x, e.z); e.tg.set(1 - Math.max(0, e.t) / BEAT); } }
    if (e.hop > 0) { const k = Math.min(e.hop, dt / 0.2); e.hop -= dt / 0.2; e.x += e.hx * k; e.z += e.hz * k; }
    e.vx *= Math.exp(-dt * 8); e.vz *= Math.exp(-dt * 8); e.x += e.vx * dt; e.z += e.vz * dt;
  }

  // ---------- 보스 ----------
  const GAP = [0, 1.7, 1.25, 0.95, 0.9];
  const RING_GAP = 1.6;   // r2: 고리 사이 0.8 → 1.6초 (구르기 재사용보다 길게 — 연속 고리를 실력으로 다 넘을 수 있게)
  EN.RING_GAP = RING_GAP;
  const RING_R0 = 5.0; EN.RING_R0 = RING_R0;
  function bossPick(e) {
    // 단계마다 새 패턴부터 차례로 (예측 가능하게 → 배우는 맛)
    // r5: 4단계 「과열」 — 광선이 도는 동안 고리가 함께 퍼짐(heat)
    const pool = e.phase === 1 ? ['ring', 'volley'] : e.phase === 2 ? ['beam', 'ring', 'volley'] : e.phase === 3 ? ['piston', 'ring', 'beam', 'volley'] : ['heat', 'piston', 'volley', 'ring'];
    if (e.seqPh !== e.phase) { e.seqPh = e.phase; e.seq = 0; }
    let a = pool[e.seq++ % pool.length]; e.heat = a === 'heat'; if (e.heat) a = 'beam';
    e.state = a; e.t = 0; e.count = 0; e.sub = 0; e.beamWarm = 0;
    if (a === 'ring') { e.tg = GZ.FX.tgCircle(e.x, e.z, 5); GZ.AU.warn(); }
    if (a === 'beam') {
      e.beamN = e.phase === 3 ? 3 : 2; e.beamDir = -e.beamDir; e.heatN = 0; e.beamA = GZ.rand() * 6.28; e.beamOn = false;
      for (let i = 0; i < e.beamN; i++) e.aims.push({ tg: GZ.FX.tgLine(e.x, e.z, e.beamA + (i / e.beamN) * 6.2832, 20, 0.9), t: 0, beam: true });
      GZ.AU.warn();
    }
  }
  function boss(e, dt, P, dx, dz, dist) {
    const want = GZ.ang(dx, dz);
    e.vuln = Math.max(0, e.vuln - dt);
    if (e.state === 'dying') {
      e.t += dt;
      if (Math.floor(e.t * 9) !== Math.floor((e.t - dt) * 9)) {
        const a = Math.random() * 6.28, r = 1 + Math.random() * 2, y = 1 + Math.random() * 5;
        GZ.FX.explode(e.x + Math.sin(a) * r, y, e.z + Math.cos(a) * r, 1); GZ.AU.boom(1);
      }
      if (e.t >= 2.3) {
        GZ.FX.explode(e.x, 3, e.z, 2); GZ.FX.burst(e.x, 3, e.z, 60, 'gold', 18, 0.5, 1.2, 4); GZ.FX.debris(e.x, 3, e.z, 40, 14, true);
        for (let i = 0; i < 4; i++) GZ.FX.ring(e.x, e.z, 1, 10 + i * 6, 0.6 + i * 0.2, 'gold', 1.5);
        GZ.AU.boom(2); GZ.AU.ultBlast(); GZ.R.shake(1.3); GZ.R.pulse(0.8);
        remove(e); GZ.G.onBossDead(e);
      }
      return;
    }
    if (e.state === 'shift') {   // 단계 전환: 2.2초 동안 무적 + 밀어내기
      e.t += dt;
      if (e.t >= 2.2) { e.state = 'idle'; e.cd = 0.9; }
      return;
    }
    // 단계 넘어가기 (r5: 4단계 — 75/50/25%). 「전체 기상!」을 모으는 0.75초 동안은 넘어가지 않음(궁극기 피해가 무적 전환에 먹히지 않게)
    const ph = e.hp > e.max * 0.75 ? 1 : e.hp > e.max * 0.5 ? 2 : e.hp > e.max * 0.25 ? 3 : 4;
    if (ph > e.phase && !GZ.G.ultCharging) {
      e.phase = Math.min(ph, e.phase + 1); e.state = 'shift'; e.beamWarm = 0; e.t = 0; e.stun = 0; freeTG(e); for (const b of beams) b.visible = false; e.beamN = 0;
      for (const r of EN.rings) r.m.visible = false; EN.rings.length = 0;
      GZ.G.onBossPhase(e, e.phase);
      return;
    }
    if (e.stun > 0) { if (e.state === 'beam' && e.beamOn) e.beamWarm = 0.45; return; }   // 「차렷!」에 멈춤 (시간이 흐르지 않음). r5: 기절 동안 광선은 꺼지고, 풀린 뒤 0.45초 동안 다시 켜지는 예고(피해 없음)
    e.face = GZ.angTo(e.face, want, dt * 1.6);
    if (e.state === 'idle') {
      e.cd -= dt;
      if (e.cd <= 0) bossPick(e);
    } else if (e.state === 'ring') {       // 침묵 파동: 바닥을 훑는 붉은 고리 — 닿기 직전에 구르면 넘는다
      e.t += dt;
      const RG = RING_GAP * (D().ringGap || 1), n = e.phase, nextT = 0.95 + e.count * RG;
      // r3: 2·3번째 고리도 0.5초 예고 (보스 발밑 원이 다시 번쩍 + 예고음)
      if (e.count > 0 && e.count < n && !e.tg && e.t >= nextT - 0.5) { e.tg = GZ.FX.tgCircle(e.x, e.z, 5); GZ.AU.warn(); }
      if (e.tg) e.tg.set(e.count === 0 ? GZ.sat(e.t / 0.95) : GZ.sat((e.t - (nextT - 0.5)) / 0.5));
      if (e.t < 0.95 && Math.random() < 0.5) { const a = Math.random() * 6.28; GZ.FX.spark(e.x + Math.sin(a) * 6, 0.2 + Math.random() * 1.0, e.z + Math.cos(a) * 6, -Math.sin(a) * 7, 0, -Math.cos(a) * 7, 1.5, 0.22, 0.1, 0.13, 0.42, 0); }
      while (e.count < n && e.t >= 0.95 + e.count * RG) {
        freeTG(e);
        e.count++;
        let m = null; for (const p of ringPool) if (!p.visible) { m = p; break; }
        // r3: 고리는 예고 원(반지름 5m) 바깥에서 생겨 퍼짐 — 보스 바로 옆에서 생기자마자 맞는 일이 없음. 1단계 속도 11.3 → 10.0
        if (m) { m.visible = true; EN.rings.push({ r: RING_R0, spd: (9.2 + e.phase * 0.8) * (D().ringSp || 1), hit: false, m }); }
        GZ.AU.slam(); GZ.R.shake(0.3); GZ.FX.puff(e.x, 1, e.z + 3, 0, 1, 0, 3, 7, 0.8, 0.2);
        GZ.FX.ring(e.x, e.z, 3.2, RING_R0, 0.16, 'red', 1.2);
      }
      if (e.count >= n && e.t > 0.95 + (n - 1) * RG + 0.8) { e.state = 'idle'; e.cd = GAP[e.phase]; }
    } else if (e.state === 'volley') {     // 증기 포격: 예고선 → 빠른 탄
      e.t += dt;
      const n = 2 + e.phase;
      while (e.count < n && e.t >= e.count * 0.42) {
        e.count++;
        const a = want + (GZ.rand() - 0.5) * 0.25;
        e.aims.push({ t: 0.68, ang: a, tg: GZ.FX.tgLine(e.x, e.z, a, 24, 0.6) });
        GZ.AU.warn();
      }
      if (e.phase === 3 && !e.sub && e.t >= n * 0.42 + 0.5) {   // 3단계: 마지막에 부채꼴 5발
        e.sub = 1;
        for (let i = -2; i <= 2; i++) { const a = want + i * 0.3; e.aims.push({ t: 0.8, ang: a, fixed: true, tg: GZ.FX.tgLine(e.x, e.z, a, 24, 0.6) }); }
      }
      if (e.count >= n && (e.phase < 3 || e.sub) && e.aims.length === 0) { e.state = 'idle'; e.cd = GAP[e.phase]; }
    } else if (e.state === 'beam') {       // 회전 광선
      e.t += dt;
      const tel = 1.15, act = 4.4;
      if (e.t < tel) { for (const a of e.aims) a.tg.set(e.t / tel); }
      else {
        if (!e.beamOn) { e.beamOn = true; for (const a of e.aims) a.tg.free(); e.aims.length = 0; GZ.AU.roar(); }
        const k = GZ.sat((e.t - tel) / 0.7);
        e.beamA += e.beamDir * (e.heat ? 0.62 : e.phase === 3 ? 0.98 : 0.8) * (D().beamSp || 1) * k * dt;
        if (e.heat && e.heatN < 2 && e.t >= tel + 0.6 + e.heatN * 1.9 * (D().ringGap || 1)) {   // 과열: 광선 중 고리 2개 (0.5초 예고는 고리 쪽 tgCircle)
          e.heatN++; let m = null; for (const q of ringPool) if (!q.visible) { m = q; break; }
          if (m) { m.visible = true; EN.rings.push({ r: RING_R0, spd: 8.6 * (D().ringSp || 1), hit: false, m }); }
          GZ.AU.slam(); GZ.R.shake(0.3); GZ.FX.ring(e.x, e.z, 3.2, RING_R0, 0.16, 'red', 1.2);
        }
        if (e.beamWarm > 0) e.beamWarm -= dt;
        else if (e.t > tel + 0.12 && !P.down) {
          for (let i = 0; i < e.beamN; i++) {
            const a = e.beamA + (i / e.beamN) * 6.2832, bx = Math.sin(a), bz = Math.cos(a);
            const along = dx * bx + dz * bz, perp = Math.abs(dx * bz - dz * bx);
            if (along > 2 && along < 20.5 && perp < 0.85) { GZ.G.hurt(D().beamDmg || DMG.beam, e.x, e.z, 'beam'); }
          }
        }
        if (e.t >= tel + act) { e.beamN = 0; e.state = 'idle'; e.cd = GAP[e.phase]; }
      }
    } else if (e.state === 'piston') {     // 피스톤 낙하: 발밑 원 → 쾅
      e.t += dt;
      const n = 6;
      while (e.count < n && e.t >= e.count * 0.44) {
        e.count++;
        let px = P.x + P.vx * 0.22, pz = P.z + P.vz * 0.22;
        const d = Math.hypot(px, pz); if (d < 5.6) { px *= 5.6 / (d || 1); pz *= 5.6 / (d || 1); }
        for (const p of pistons) if (p.t < 0) { p.t = 0; p.x = px; p.z = pz; p.tg = GZ.FX.tgCircle(px, pz, 2.3); p.hit = false; break; }
        GZ.AU.warn();
      }
      if (e.count >= n && e.t > n * 0.44 + 1.4) { e.state = 'idle'; e.cd = GAP[e.phase]; }
    }
    // 예고선 → 발사 (포격)
    for (let i = e.aims.length - 1; i >= 0; i--) {
      const a = e.aims[i]; if (a.beam) continue;
      a.t -= dt;
      a.tg.set(1 - a.t / 0.7);
      if (a.t <= 0) {
        a.tg.free(); e.aims.splice(i, 1);
        EN.shoot(e.x + Math.sin(a.ang) * 3.3, e.z + Math.cos(a.ang) * 3.3, a.ang, 24, D().volDmg || DMG.volley);
        e.kick = 1;
      }
    }
  }

  function updPistons(dt, P) {
    for (const p of pistons) {
      if (p.t < 0) continue;
      p.t += dt;
      const T0 = 0.9;
      if (p.t < T0) { p.tg.set(p.t / T0); p.m.visible = p.t > T0 - 0.12; p.m.position.set(p.x, GZ.lerp(14, 0, GZ.sat((p.t - (T0 - 0.12)) / 0.12)), p.z); }
      else {
        if (!p.hit) {
          p.hit = true; p.tg.free(); p.m.visible = true; p.m.position.set(p.x, 0, p.z);
          GZ.FX.ring(p.x, p.z, 1, 4.6, 0.4, 'red', 1.4); GZ.FX.burst(p.x, 0.3, p.z, 16, 'ember', 9, 0.3, 0.5, 3); GZ.FX.debris(p.x, 0.3, p.z, 4, 7);
          GZ.AU.slam(); GZ.R.shake(0.5);
          if (Math.hypot(P.x - p.x, P.z - p.z) < 2.3 + 0.35) GZ.G.hurt(DMG.piston, p.x, p.z, 'piston');
        }
        const k = p.t - T0;
        p.m.position.y = k < 0.14 ? 0 : (k - 0.14) * 46;   // r2: 카메라가 가까워 화면을 가리므로 찍자마자 바로 올라감
        if (k > 0.3) { p.m.visible = false; p.t = -1; }   // r8 (검토 A): 0.55 → 0.3초 — 올라가는 피스톤이 왼쪽 전경을 크게 가리던 것
      }
    }
  }

  EN.update = function (dt, P) {
    const list = EN.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) continue;
      e.st += dt; e.flash = Math.max(0, e.flash - dt * 9); e.punch = Math.max(0, (e.punch || 0) - dt * 8);
      if (e.broken > 0) e.broken -= dt;
      let dx = P.x - e.x, dz = P.z - e.z, dist = Math.hypot(dx, dz) || 0.001;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        if (e.kind === 'turret') { if (e.tg) e.tg.set(1 - e.spawnT / 0.9); if (e.spawnT <= 0) { freeTG(e); GZ.FX.ring(e.x, e.z, 0.5, 3, 0.35, 'red', 1); GZ.FX.burst(e.x, 0.3, e.z, 10, 'ember', 6, 0.25, 0.4, 2); GZ.AU.slam(); GZ.R.shake(0.2); e.state = 'idle'; } }
        else if (e.spawnT <= 0) e.state = e.kind === 'boss' ? 'idle' : 'chase';
      } else if (e.kind === 'boss') boss(e, dt, P, dx, dz, dist);
      else if (e.hitFreeze > 0) {   // r5: 맞은 순간 멈칫 → 끝나면 밀려남
        e.hitFreeze -= dt;
        if (e.hitFreeze <= 0) { e.vx += e.pvx || 0; e.vz += e.pvz || 0; e.pvx = e.pvz = 0; }
      }
      else if (e.stun > 0) {
        e.vx *= Math.exp(-dt * 8); e.vz *= Math.exp(-dt * 8); e.x += e.vx * dt; e.z += e.vz * dt;
        if (e.beam) e.drain = false;
      }
      else if (e.kind === 'drone') drone(e, dt, P, dx, dz, dist);
      else if (e.kind === 'turret') turret(e, dt, P, dx, dz, dist);
      else if (e.kind === 'shield') shield(e, dt, P, dx, dz, dist);
      else if (e.kind === 'absorber') absorber(e, dt, P, dx, dz, dist);
      else if (e.kind === 'metro') metro(e, dt, P, dx, dz, dist);
      else if (e.kind === 'brute') brute(e, dt, P, dx, dz, dist);
      if (e.dead) continue;
      if (e.stun > 0) { e.stun -= dt; if (Math.random() < 0.25) GZ.FX.spark(e.x + (Math.random() - 0.5) * e.r, (e.kind === 'boss' ? 5 : 1.6) + Math.random(), e.z + (Math.random() - 0.5) * e.r, 0, 2, 0, 2.6, 1.8, 0.4, 0.2, 0.35, 0); }
      if (e.kind !== 'boss' && e.kind !== 'turret') sep(e);
    }
    // 죽은 것 정리
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
    // 탄
    for (let i = EN.shots.length - 1; i >= 0; i--) {
      const s = EN.shots[i];
      s.life -= dt; s.x += s.vx * dt; s.z += s.vz * dt;
      if (s.life > 0 && Math.hypot(s.x, s.z) > GZ.AR.R + 2.5) s.life = 0;
      if (s.life > 0 && !P.down && Math.hypot(s.x - P.x, s.z - P.z) < s.r + 0.45) { if (GZ.G.hurt(s.dmg, s.x - s.vx, s.z - s.vz, 'shot')) s.life = 0; }
      if (s.life <= 0) { s.m.visible = false; EN.shots.splice(i, 1); continue; }
      s.m.position.set(s.x, 1.1, s.z);
      if (Math.random() < 0.7) GZ.FX.spark(s.x, 1.1, s.z, -s.vx * 0.05, 0.5, -s.vz * 0.05, 2.4, 0.8, 0.25, 0.3, 0.22, 0);
    }
    // 보스 고리
    const pd = Math.hypot(P.x, P.z);
    for (let i = EN.rings.length - 1; i >= 0; i--) {
      const r = EN.rings[i];
      r.r += r.spd * dt;
      r.m.scale.setScalar(r.r);
      r.m.material.opacity = 0.95 * GZ.sat((24 - r.r) / 5); r.m.userData.core.material.opacity = r.m.material.opacity;
      { const near = Math.abs(pd - r.r) < 2 && !r.hit, f = near ? 0.75 + 0.6 * (Math.sin(performance.now() * 0.04) > 0 ? 1 : 0) : 1; r.m.material.color.setRGB(1.45 * f, 0.2 * f, 0.04 * f); r.m.userData.core.material.color.setRGB(1.5 * f, 1.25 * f, 0.95 * f); }   // r8: 구리빛 빨강 + 흰 심지, 주인공 2m 안이면 깜빡임
      if (!r.hit && !P.down && r.r > RING_R0 + 0.5 && Math.abs(pd - r.r) < (D().ringBand || 0.7)) {   /* 생긴 자리(예고 원 가장자리)에서는 아직 안 아픔 — 퍼져 나간 뒤부터 */ if (P.rollInv > 0) r.hit = true; else if (GZ.G.hurt(D().ringDmg || DMG.ring, 0, 0, 'ring')) r.hit = true; }   // 구르는 무적 중에 겹친 고리는 넘은 것
      if (r.r > 24) { r.m.visible = false; EN.rings.splice(i, 1); }
    }
    updPistons(dt, P);
  };

  // 화면용 갱신 (모델 위치·회전·번쩍)
  EN.sync = function (dt, t, P) {
    for (const e of EN.list) {
      if (e.dead) continue;
      const g = e.grp;
      const f = e.flash;
      if (e.hidden) continue;
      if (e.mark) { e.mark.position.set(e.x, 0.06, e.z); e.mark.visible = e.kind !== 'turret' || e.spawnT <= 0; }
      // r5: 맞은 적이 흰 덩어리로 날아가지 않게 — 몸 전체는 따뜻한 주황으로 옅게(최대 0.5), 대신 맞은 자리 별빛·움찔로 표시
      { const fk = e.kind === 'boss' ? 0.02 : e.kind === 'shield' && !e.shield ? 0.22 : 0.36; e.mat.emissive.setRGB(f * 1.0 * fk, f * 0.55 * fk, f * 0.18 * fk); }   // r8: 맞은 번쩍임 낮춤 0.5 → 0.36 (적이 하얗게 탈색되던 것)
      // r5: 카메라 코앞(3.2m 안)에 들어온 적은 숨김 — 화면 구석을 크게 가리는 흰 덩어리 방지 (화면 밖 화살표로 표시됨)
      { const cp = GZ.R.camera.position, cd = Math.hypot(e.x - cp.x, (e.kind === 'boss' ? 3 : 1.2) - cp.y, e.z - cp.z); const nearC = e.kind !== 'boss' && cd < 3.2; g.visible = !nearC; if (e.mark) e.mark.visible = e.mark.visible && !nearC; }   // r3 보스: 몸 전체가 희게 뜨지 않게 — 몸은 거의 안 밝히고, 맞은 자리 별빛·가슴 코어·움찔로 표시
      const pn = e.punch || 0, pa = (e.hitA || 0) - e.face;   // 맞은 반응: 맞은 쪽 반대로 젖혀지고 순간 부풂
      const stunned = e.stun > 0;
      if (e.kind === 'drone') {
        const k = e.spawnT > 0 ? 1 - e.spawnT / 0.6 : 1;
        g.position.set(e.x, e.y + Math.sin(t * 4 + e.seed) * 0.12, e.z); g.rotation.y = e.face; g.scale.setScalar((0.3 + 0.7 * k) * 1.55 * (1 + pn * 0.16));   // r4: 멀리서 점처럼 보이지 않게 더 키움 (판정 반지름은 그대로)
        if (!stunned) e.gear.rotation.y += dt * (e.state === 'dash' ? 40 : e.state === 'wind' ? 28 : 12);
        g.rotation.x = (e.state === 'dash' ? 0.5 : e.state === 'wind' ? -0.35 : 0.12) - Math.cos(pa) * pn * 0.7; g.rotation.z = Math.sin(pa) * pn * 0.7;
        const s = e.state === 'wind' ? 1.9 + Math.sin(t * 50) * 0.4 : 1;
        e.eye.scale.setScalar(stunned ? 0.5 : s * 1.3);
      } else if (e.kind === 'turret') {
        const y = e.spawnT > 0 ? Math.max(0, (e.spawnT - 0.15) / 0.75) * 14 : 0;
        g.position.set(e.x, y, e.z);
        e.kick = Math.max(0, (e.kick || 0) - dt * 5);
        if (e.glb) { e.head.position.y = Math.sin(t * 9 + e.seed) * 0.02 * (e.state === 'aim' ? 1 : 0); }   // r6 크롤러: 겨눌 때 몸이 떨림
        e.head.rotation.y = e.face; e.head.position.z = 0; e.head.rotation.x = -e.kick * (e.glb ? 0.12 : 0.25) - Math.cos(pa) * pn * 0.3; e.head.rotation.z = Math.sin(pa) * pn * 0.3; e.head.scale.setScalar(1 + pn * 0.1);
        e.eye.scale.setScalar(e.state === 'aim' ? 1.7 + Math.sin(t * 40) * 0.3 : stunned ? 0.6 : 1.2);
      } else if (e.kind === 'shield') {
        const k = e.spawnT > 0 ? 1 - e.spawnT / 0.6 : 1;
        const sp = Math.hypot(e.vx, e.vz);
        g.position.set(e.x, Math.abs(Math.sin(e.st * 6)) * 0.08 * Math.min(1, sp), e.z); g.rotation.y = e.face; g.scale.setScalar(0.3 + 0.7 * k);
        const down = e.broken > 0 || e.state === 'recover' || stunned;
        if (e.shield) {
          const tx = down ? 1.15 : e.state === 'wind' ? -0.25 : 0, ty = down ? 0.45 : 1.05;
          e.shield.rotation.x += (tx - e.shield.rotation.x) * (1 - Math.exp(-dt * 14));
          e.shield.position.y += (ty - e.shield.position.y) * (1 - Math.exp(-dt * 14));
          e.eye.scale.y = stunned ? 0.3 : 1;
        } else {   // 통짜 모델: 뒤뚱 걸음·내려치기 기울임을 몸 전체로
          e.body.rotation.z = Math.sin(e.st * 6) * 0.07 * Math.min(1, sp);
          e.eye.visible = !stunned;
        }
        const tr = (e.state === 'wind' ? -0.22 : e.state === 'recover' ? 0.3 : stunned ? 0.12 : 0) - Math.cos(pa) * pn * 0.3;
        g.rotation.x += (tr - g.rotation.x) * (1 - Math.exp(-dt * 16));
        e.guard.visible = !down && e.spawnT <= 0;
        e.guard.material.opacity = 0.55 + Math.sin(t * 6) * 0.2;
      } else if (e.kind === 'absorber') {
        const k = e.spawnT > 0 ? 1 - e.spawnT / 0.6 : 1;
        const y = e.y + Math.sin(t * 2 + e.seed) * 0.2;
        g.position.set(e.x, y, e.z); g.rotation.y = e.face; g.scale.setScalar((0.3 + 0.7 * k) * (1 + pn * 0.16)); g.rotation.x = -Math.cos(pa) * pn * 0.5;
        if (!stunned) { e.ring1.rotation.x += dt * 2.2; e.ring1.rotation.y += dt * 1.3; e.ring2.rotation.z += dt * 2.8; e.ring2.rotation.x -= dt * 1.7; }
        const on = e.drain && !stunned && e.spawnT <= 0;
        e.beam.visible = on;
        if (on) {
          const d = Math.hypot(P.x - e.x, P.z - e.z), w = 0.07 + Math.sin(t * 30) * 0.03;
          e.beam.scale.set(w, w, d / g.scale.x); e.beam.position.set(0, -0.05, 0.3);
          e.beam.rotation.x = Math.atan2(y - 1.2, d);
        }
      } else if (e.kind === 'brute') {   // r6: 뒤뚱 걸음 · 주먹 들 때 뒤로 젖힘 · 내려칠 때 앞으로 숙임
        const k = e.spawnT > 0 ? 1 - e.spawnT / 0.6 : 1, sp = Math.hypot(e.vx, e.vz);
        e.slam = Math.max(0, (e.slam || 0) - dt * 3);
        g.position.set(e.x, Math.abs(Math.sin(e.st * 4.2)) * 0.07 * Math.min(1, sp), e.z); g.rotation.y = e.face; g.scale.setScalar((0.3 + 0.7 * k) * (1 + pn * 0.05));
        const tr = (e.state === 'wind' ? -0.2 * GZ.sat(1 - e.t / 0.85) : 0) + e.slam * 0.3 + (stunned ? 0.1 : 0) - Math.cos(pa) * pn * 0.15;
        g.rotation.x += (tr - g.rotation.x) * (1 - Math.exp(-dt * 18)); g.rotation.z = Math.sin(e.st * 4.2) * 0.05 * Math.min(1, sp) + Math.sin(pa) * pn * 0.12;
        { const w = e.state === 'wind'; const k2 = w ? 1.5 + Math.sin(t * 40) * 0.3 : stunned ? 0.4 : 0.8; e.eye.scale.set(k2 * 1.3, k2 * 0.7, 0.5); e.eye.visible = w || !e.glb; }
        if (e.fists) { const w = e.state === 'wind', a = stunned ? 0.15 : w ? 0.9 + Math.sin(t * 30) * 0.1 : 0.36 + Math.sin(t * 3 + e.seed) * 0.05; for (const f of e.fists) { f.material.opacity = a; f.scale.setScalar(BRUTE_FIST[3] * (w ? 1.35 : 1)); } }
      } else if (e.kind === 'metro') {
        const k = e.spawnT > 0 ? 1 - e.spawnT / 0.6 : 1, BEAT = GZ.AU.BEAT, bp = (GZ.G.bt / BEAT) % 1, hop = Math.max(0, e.hop || 0);
        e.stomp = Math.max(0, (e.stomp || 0) - dt * 5);
        g.position.set(e.x, Math.sin(Math.min(1, 1 - hop) * Math.PI) * 0.22 * (hop > 0 ? 1 : 0) - e.stomp * 0.08, e.z); g.rotation.y = e.face;
        g.scale.setScalar((0.3 + 0.7 * k) * (1 + pn * 0.08)); g.rotation.x = (e.state === 'wind' ? -0.12 : 0) - Math.cos(pa) * pn * 0.3 + e.stomp * 0.1; g.rotation.z = Math.sin(pa) * pn * 0.25;
        if (!stunned) e.arm.rotation.z = Math.cos(((GZ.G.bt / BEAT) % 2) * Math.PI) * 0.62;   // 추: 박자마다 끝까지 흔들림
        const on = bp < 0.14 || bp > 0.92;   // 머리 등: 정박 순간 밝게 (「이때 쳐라」)
        e.lamp.material.color.setRGB(on ? 1.6 : 0.6, on ? 1.15 : 0.36, on ? 0.35 : 0.08); e.lamp.scale.setScalar(on ? 1.2 : 0.85);
        e.eye.scale.setScalar(e.state === 'wind' ? 1.6 + Math.sin(t * 40) * 0.3 : stunned ? 0.5 : 1.1);
      } else if (e.kind === 'boss') {
        let y = 0;
        if (e.spawnT > 0) { y = -7.5 * GZ.smooth(e.spawnT / 2.6); for (let q = 0; q < 2; q++) if (Math.random() < 0.8) { const a = Math.random() * 6.28, rr = 1.5 + Math.random() * 3.2; GZ.FX.puff(e.x + Math.sin(a) * rr, 0.2 + Math.random() * 1.2, e.z + Math.cos(a) * rr, Math.sin(a) * 1.2, 1.6 + Math.random() * 1.6, Math.cos(a) * 1.2, 1.0 + Math.random(), 3.2 + Math.random() * 2.4, 0.9 + Math.random() * 0.5, 0.085, Math.random() < 0.3 ? 0xc79a84 : 0x9aa0aa); } }
        if (e.state === 'dying') { y = -e.t * 0.5; g.rotation.z = Math.sin(e.t * 30) * 0.02 + e.t * 0.04; }
        g.position.set(e.x + (e.state === 'shift' ? (Math.random() - 0.5) * 0.12 : 0), y, e.z);
        if (e.flinch > 0) { e.flinch = Math.max(0, e.flinch - dt); const fk = Math.sin((1 - e.flinch / 0.3) * Math.PI); g.rotation.x = -fk * 0.09; g.position.y -= fk * 0.3; } else if (e.state !== 'dying') g.rotation.x = 0;   // r8: 「전체 기상!」 맞은 움찔
        const sp = stunned ? 0 : e.state === 'dying' ? 5 : 0.5 + e.phase * 0.35;
        e.g1.rotation.y += dt * sp; e.g2.rotation.y -= dt * sp * 1.4;
        e.kick = Math.max(0, (e.kick || 0) - dt * 4);
        e.head.rotation.y = e.face; e.head.position.y = e.headY + Math.sin(t * 1.5) * 0.08 - e.kick * 0.15;
        const lean = e.state === 'ring' ? (e.count ? -0.05 : 0.13) : e.state === 'shift' ? -0.12 : stunned ? 0.16 : 0;   // 몸 전체 기울임
        e.head.rotation.x += (lean - e.head.rotation.x) * (1 - Math.exp(-dt * 8));
        const sq = 1 - e.kick * 0.05 + pn * 0.012; e.head.scale.set(2 - sq, sq, 2 - sq); e.head.rotation.z = Math.sin(t * 60) * pn * 0.012;
        const hot = e.state === 'shift' ? 2.2 : e.state === 'ring' || e.state === 'beam' ? 1.6 + Math.sin(t * 30) * 0.3 : 1;
        const v = e.vuln > 0 ? 1 : 0;
        { const kk = (e.headY ? 1 : 0.2) * (1 + f * 0.9); e.eyeMat.color.setRGB((4 - v * 1.5) * hot * kk, (0.45 + v * 2.2) * hot * kk, 0.25 * hot * kk); }
        // 광선
        for (let i = 0; i < beams.length; i++) {
          // r5: 기절 중에는 광선을 끔(피해도 없음), 풀린 뒤 0.45초는 가늘게 깜빡이는 예고(피해 없음) → 「빨강 = 아프다」 규칙과 일치
          const b = beams[i], on = e.state === 'beam' && e.beamOn && i < e.beamN && !stunned;
          b.visible = on;
          if (on) { const a = e.beamA + (i / e.beamN) * 6.2832, warm = (e.beamWarm || 0) > 0; b.position.set(e.x + Math.sin(a) * 2.6, 1.1, e.z + Math.cos(a) * 2.6); b.rotation.y = a; const w = warm ? 0.14 + 0.12 * Math.abs(Math.sin(t * 30)) : 0.62 + Math.sin(t * 40 + i) * 0.1; b.scale.set(w, 0.35, 18); }
        }
        if (Math.random() < 0.08) GZ.FX.puff(e.x + (Math.random() - 0.5) * 4, 5.6, e.z + (Math.random() - 0.5) * 4, 0, 1.5, 0, 1, 3, 1.2, 0.16);
      }
    }
  };
})();
