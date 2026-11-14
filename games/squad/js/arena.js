/* GRUNT ZERO RE — 배경: 기계도시 공업 광장 (검정 금속·황동 파이프·증기·붉은/푸른 에너지 조명). 전부 코드로 만든 도형
   r2: 카메라가 낮아져 북쪽 배경이 플레이 내내 보이므로 다시 만듦 —
       리벳 벽·난간·가로등, 창·띠·배관·물탱크·굴뚝이 있는 공장 건물, 살·모따기·축·받침이 있는 입체 톱니, 오르간 굴뚝 본탑,
       바닥은 판 이음·궤도·맨홀·배수 격자·경고 무늬·메트로놈 눈금. 고정물은 재질별로 병합(드로우콜 관리) */
(function () {
  'use strict';
  const GZ = window.GZ, T = THREE;
  const AR = (GZ.AR = {});
  AR.R = 19.2;          // 플레이어가 갈 수 있는 반지름
  AR.GATE_R = 18.2;
  AR.gates = [];        // 적이 나오는 문 각도
  const spin = [];      // 도는 톱니
  const vents = [];
  let beatRing, beatRing2, hatchGlow, eye, eyeHalo, shafts = [], halo = null, haloBase = null;

  const MAT = (GZ.MAT = {});
  function grimeTex(size, dark) {
    return GZ.R.canvasTex(size, size, (c) => {
      c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, size, size);
      for (let i = 0; i < size * 5; i++) {
        const v = Math.random();
        c.fillStyle = v < 0.55 ? 'rgba(0,0,0,' + (0.03 + Math.random() * dark) + ')' : 'rgba(255,255,255,' + (0.03 + Math.random() * 0.1) + ')';
        const x = Math.random() * size, y = Math.random() * size;
        if (v < 0.3) c.fillRect(x, y, 2 + Math.random() * size * 0.12, 1);                 // 긁힘
        else { c.beginPath(); c.arc(x, y, 1 + Math.random() * size * 0.05, 0, 6.2832); c.fill(); }   // 얼룩
      }
    }, { repeat: true });
  }
  function initMats() {
    const gr = grimeTex(128, 0.14);
    MAT.dark = new T.MeshStandardMaterial({ color: 0x22252d, metalness: 0.8, roughness: 0.5 });
    MAT.darker = new T.MeshStandardMaterial({ color: 0x121419, metalness: 0.7, roughness: 0.6 });
    MAT.brass = new T.MeshStandardMaterial({ color: 0x94692a, metalness: 0.85, roughness: 0.5 });
    MAT.gold = new T.MeshStandardMaterial({ color: 0xffc040, metalness: 1.0, roughness: 0.2 });
    MAT.chrome = new T.MeshStandardMaterial({ color: 0xe6edf5, metalness: 1.0, roughness: 0.08 });
    MAT.red = new T.MeshBasicMaterial({ color: new T.Color(2.6, 0.22, 0.14) });
    MAT.redStrip = new T.MeshBasicMaterial({ color: new T.Color(1.5, 0.12, 0.08) });
    MAT.blueStrip = new T.MeshBasicMaterial({ color: new T.Color(0.12, 0.45, 1.6) });
    MAT.redDim = new T.MeshBasicMaterial({ color: new T.Color(1.3, 0.14, 0.09) });
    MAT.blue = new T.MeshBasicMaterial({ color: new T.Color(0.3, 0.95, 3.2) });
    MAT.amber = new T.MeshBasicMaterial({ color: new T.Color(2.6, 1.3, 0.35) });
    // 한 메시에 검정 금속 + 황동을 정점 색으로 섞어 쓰는 재질 (적 기계·피스톤·톱니) — 보스 glb(금속 0.72·거칠기 0.44)와 맞춤 + 때·긁힘 무늬
    MAT.mech = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.82, roughness: 0.5, map: gr, roughnessMap: gr, envMapIntensity: 1.1 });
    // 배경 고정물 3종
    MAT.iron = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.62, roughness: 0.66, map: gr, roughnessMap: gr });
    MAT.bras2 = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.9, roughness: 0.46, map: gr, roughnessMap: gr });
    MAT.glow = new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  }

  // ---------- 병합용 도구 ----------
  const _c = new T.Color();
  function part(g, col, x, y, z, rx, ry, rz) {
    if (g.index) g = g.toNonIndexed();
    if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz);
    g.translate(x || 0, y || 0, z || 0);
    if (col && col.isColor) _c.copy(col); else _c.set(col);
    const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3));
    return g;
  }
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n, open) => new T.CylinderGeometry(r0, r1, h, n || 10, 1, !!open);
  const sph = (r, a, b) => new T.SphereGeometry(r, a || 8, b || 6);
  const newL = () => ({ iron: [], brass: [], glow: [], plate: [] });
  const put = (L, kind, g, col, x, y, z, rx, ry, rz) => { L[kind].push(part(g, col, x, y, z, rx, ry, rz)); };
  const _m = new T.Matrix4(), _m2 = new T.Matrix4();
  // 임시 묶음 L 을 각 a·반지름 r 자리에 놓음 (묶음의 +z 가 광장 중심을 봄)
  function place(dst, L, a, r, y) {
    _m.makeRotationY(a + Math.PI); _m2.makeTranslation(Math.sin(a) * r, y || 0, Math.cos(a) * r); _m2.multiply(_m);
    for (const k of ['iron', 'brass', 'glow', 'plate']) for (const g of L[k]) { g.applyMatrix4(_m2); dst[k].push(g); }
  }
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const AMBER = new T.Color(1.15, 0.6, 0.2), TEAL = new T.Color(0.2, 0.55, 0.75), REDG = new T.Color(1.6, 0.16, 0.1), BLUEG = new T.Color(0.15, 0.5, 1.7);
  const halos = [];   // [x,y,z, r,g,b, size]  (묶음 안에서 만들 땐 8번째에 그 묶음을 달아 두었다가 fixHalos 로 자리 변환)
  function fixHalos(L, a, r) {
    _m.makeRotationY(a + Math.PI);
    for (const h of halos) if (h.length === 8 && h[7] === L) { const v = new T.Vector3(h[0], h[1], h[2]).applyMatrix4(_m); h[0] = v.x + Math.sin(a) * r; h[2] = v.z + Math.cos(a) * r; h.length = 7; }
  }

  function chimney(L, x, z, h, r, lamp) {
    put(L, 'iron', cyl(r * 0.68, r, h, 12), 0x241f1f, x, h / 2, z);
    put(L, 'brass', cyl(r * 0.9, r * 0.93, 0.45, 12), 0x8a6226, x, h * 0.34, z); put(L, 'brass', cyl(r * 0.8, r * 0.83, 0.45, 12), 0x8a6226, x, h * 0.68, z);
    put(L, 'iron', cyl(r * 0.86, r * 0.72, 0.9, 12), 0x101115, x, h + 0.1, z);
    put(L, 'iron', box(0.14, h * 0.86, 0.08), 0x4a4f5a, x, h * 0.45, z + r * 0.86);   // 사다리
    if (lamp) { put(L, 'glow', sph(0.22, 6, 5), lamp, x, h + 0.9, z); }
  }
  // 공장 건물 한 채: 앞면(+z)이 광장을 봄
  function building(L, w, h, d) {
    const tone = [0x1d2028, 0x24262e, 0x2b2623, 0x20252b, 0x2a2420][Math.floor(rnd() * 5)];
    put(L, 'iron', box(w + 0.9, 1.5, d + 0.9), 0x14151a, 0, 0.75, 0);
    put(L, 'iron', box(w, h, d), tone, 0, h / 2, 0);
    const fh = 3.6, nf = Math.max(1, Math.floor((h - 3.2) / fh)), nc = Math.max(2, Math.floor(w / 2.4)), cw = w / nc, zf = d / 2;
    for (let f = 0; f < nf; f++) {
      const y = 3.6 + f * fh;
      put(L, f % 3 === 2 ? 'brass' : 'iron', box(w + 0.35, 0.24, d + 0.35), f % 3 === 2 ? 0x7c5a26 : 0x121318, 0, y - 1.55, 0);   // 층 띠
      for (let c = 0; c < nc; c++) {
        const x = (c - (nc - 1) / 2) * cw, lit = rnd();
        // r5: 먼 건물 창은 상자 대신 앞면 판(삼각형 60 → 10) — 광장 쪽에서만 보이므로 모양은 같음
        const pl = (w2, h2) => new T.PlaneGeometry(w2, h2);
        put(L, 'iron', pl(1.2, 2.0), 0x0e0f13, x, y, zf + 0.15);                                             // 창틀
        if (lit < 0.17) put(L, 'glow', pl(0.86, 1.62), _c.copy(lit < 0.14 ? AMBER : TEAL).multiplyScalar(0.55 + rnd() * 0.5).clone(), x, y, zf + 0.2);
        else put(L, 'iron', pl(0.86, 1.62), 0x0a1220, x, y, zf + 0.2);                                        // 꺼진 유리
        put(L, 'brass', pl(0.07, 1.62), 0x6f5122, x, y, zf + 0.24); put(L, 'brass', pl(0.86, 0.07), 0x6f5122, x, y + 0.2, zf + 0.24);   // 창살
        put(L, 'iron', pl(1.36, 0.34), 0x2e313a, x, y - 1.04, zf + 0.2, -Math.PI / 2);                        // 창턱(윗면)
      }
    }
    put(L, 'iron', box(0.6, h, 0.6), 0x15161b, -w / 2, h / 2, zf); put(L, 'iron', box(0.6, h, 0.6), 0x15161b, w / 2, h / 2, zf);   // 모서리 기둥
    put(L, 'iron', box(w + 0.5, 0.55, d + 0.5), 0x111216, 0, h + 0.27, 0); put(L, 'brass', box(w + 0.62, 0.12, d + 0.62), 0x8a6226, 0, h + 0.6, 0);   // 난간벽·황동 테
    // 옆 배관 (아래에서 올라와 꺾여 들어감) + 고정 띠
    const px = (rnd() < 0.5 ? -1 : 1) * (w / 2 - 0.9), ph = h * (0.55 + rnd() * 0.3);
    put(L, 'brass', cyl(0.2, 0.2, ph, 8), 0x7c5a26, px, ph / 2, zf + 0.42); put(L, 'brass', sph(0.24, 8, 6), 0x7c5a26, px, ph, zf + 0.42);
    put(L, 'brass', cyl(0.2, 0.2, 0.5, 8), 0x7c5a26, px, ph, zf + 0.2, Math.PI / 2);
    for (let y = 2; y < ph; y += 3.2) put(L, 'iron', box(0.6, 0.14, 0.3), 0x0e0f13, px, y, zf + 0.34);
    // 지붕 설비
    const k = rnd();
    if (k < 0.45) {   // 물탱크
      const tx = (rnd() - 0.5) * w * 0.4, tr = Math.min(1.6, w * 0.22);
      for (let i = 0; i < 4; i++) put(L, 'iron', box(0.16, 1.4, 0.16), 0x0e0f13, tx + (i % 2 ? 1 : -1) * tr * 0.6, h + 1.3, (i < 2 ? 1 : -1) * tr * 0.6);
      put(L, 'brass', cyl(tr, tr, 2.2, 12), 0x6a4a22, tx, h + 3.1, 0); put(L, 'iron', new T.ConeGeometry(tr * 1.08, 0.9, 12), 0x16171c, tx, h + 4.65, 0);
      put(L, 'iron', cyl(tr * 1.02, tr * 1.02, 0.14, 12), 0x16171c, tx, h + 2.5, 0); put(L, 'iron', cyl(tr * 1.02, tr * 1.02, 0.14, 12), 0x16171c, tx, h + 3.7, 0);
    }
    if (k > 0.3) { const n = 1 + Math.floor(rnd() * 2); for (let i = 0; i < n; i++) chimney(L, (rnd() - 0.5) * w * 0.7, -d * 0.2, h + 5 + rnd() * 6, 0.75 + rnd() * 0.3, null); }
    if (rnd() < 0.5) { const ax = (rnd() - 0.5) * w * 0.6; put(L, 'iron', cyl(0.05, 0.08, 5, 5), 0x3a3e48, ax, h + 3, d * 0.2); put(L, 'glow', sph(0.14, 5, 4), REDG, ax, h + 5.6, d * 0.2); halos.push([ax, h + 5.6, d * 0.2, 1.4, 0.16, 0.1, 2.2, L]); }
    if (w > 7 && rnd() < 0.6) {   // 앞면 톱니 문장
      const g = GZ.FX.gearGeo(1.5, 10, 0.3, { spokes: 5, bevel: 0.05, hole: 0.16, root: 0.82 });
      put(L, 'brass', g, 0x8a6226, 0, Math.min(h - 2.4, 3.6 + nf * 3.6 - 1.2), zf + 0.3);
    }
  }

  // r3 바닥: 「빈 보라 바닥」이 아니라 짙은 강철판 + 황동 상감 + 붉은/푸른 포인트. 전부 캔버스로 그림(절차적)
  //   색 그림(2048) + 거칠기·금속성 그림(1024, 기름 얼룩은 매끈 → 조명이 비침) + 잔요철 노멀맵(512 타일: 미끄럼 방지 돌기·긁힘·패임)
  const FLOOR = { RINGS: [0, 3.2, 7, 11, 15, 20.6], NP: 26, plates: null, stains: null, scr: null,
    MANH: [[5.6, 4.6], [-6.4, 3.1], [-3.4, -8.9], [8.9, -5.2], [1.2, 14.2], [-12.2, -9.6], [11.8, 9.4], [-9.4, 12.4]],
    GRATE: [[-9.6, -1.2, 0.2], [9.4, 1.6, -0.3], [2.6, -13.6, 1.5], [-4.2, 9.6, 1.2], [13.9, -11.2, 0.8], [-14.6, 6.4, -0.6]] };
  function floorPlan() {
    if (FLOOR.plates) return;
    const R0 = Math.random;   // 화면용 난수 (규칙 난수와 무관)
    FLOOR.plates = [];
    for (let r = 0; r < 5; r++) for (let i = 0; i < FLOOR.NP; i++) {
      const k = R0(), v = 27 + Math.floor(R0() * 15);
      FLOOR.plates.push({ r, i, kind: k < 0.1 ? 'rust' : k < 0.2 ? 'bright' : k < 0.3 ? 'dark' : 'steel', v, rough: 0.52 + R0() * 0.26 });
    }
    FLOOR.stains = []; for (let i = 0; i < 46; i++) { const a = R0() * 6.2832, rr = Math.sqrt(R0()) * 19.5; FLOOR.stains.push({ x: Math.sin(a) * rr, z: Math.cos(a) * rr, r: 0.6 + R0() * 2.1, sx: 0.6 + R0() * 0.8, rot: R0() * 3, oil: R0() < 0.72 }); }
    FLOOR.scr = []; for (let i = 0; i < 150; i++) { const a = R0() * 6.2832, rr = Math.sqrt(R0()) * 20; FLOOR.scr.push({ x: Math.sin(a) * rr, z: Math.cos(a) * rr, l: 0.5 + R0() * 3.2, rot: R0() * 6.2832, c: R0() * 0.5 - 0.25 }); }
  }
  function floorTex() {
    floorPlan();
    const S = 2048, pm = S / 42, c0 = S / 2;
    return GZ.R.canvasTex(S, S, (c) => {
      const X = (x) => c0 + x * pm, RINGS = FLOOR.RINGS, NP = FLOOR.NP;
      c.fillStyle = '#141517'; c.fillRect(0, 0, S, S);
      // 강철판 (중성 회색, 판마다 조금씩 다름 — 녹슨 판·밝게 닦인 판·어두운 판이 섞임) + 솔질 자국
      for (const p of FLOOR.plates) {
        const a0 = (p.i / NP) * 6.2832 + p.r * 0.06, a1 = ((p.i + 1) / NP) * 6.2832 + p.r * 0.06, v = p.v;
        c.fillStyle = p.kind === 'rust' ? 'rgb(' + (v + 16) + ',' + (v + 2) + ',' + (v - 8) + ')' : p.kind === 'bright' ? 'rgb(' + (v + 20) + ',' + (v + 21) + ',' + (v + 22) + ')' : p.kind === 'dark' ? 'rgb(' + (v - 9) + ',' + (v - 9) + ',' + (v - 8) + ')' : 'rgb(' + (v + 2) + ',' + (v + 2) + ',' + (v + 3) + ')';
        c.beginPath(); c.arc(c0, c0, RINGS[p.r + 1] * pm, a0, a1); c.arc(c0, c0, Math.max(0.001, RINGS[p.r]) * pm, a1, a0, true); c.closePath(); c.fill();
        c.save(); c.clip();   // 판 안쪽: 둘레 방향 솔질 자국
        for (let k = 0; k < 9; k++) { const rr = (RINGS[p.r] + Math.random() * (RINGS[p.r + 1] - RINGS[p.r])) * pm; c.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,' + (0.015 + Math.random() * 0.035) + ')' : 'rgba(0,0,0,' + (0.04 + Math.random() * 0.08) + ')'; c.lineWidth = 1 + Math.random() * 5; c.beginPath(); c.arc(c0, c0, rr, a0, a1); c.stroke(); }
        if (p.kind === 'rust') for (let k = 0; k < 14; k++) { const aa = a0 + Math.random() * (a1 - a0), rr = (RINGS[p.r] + Math.random() * (RINGS[p.r + 1] - RINGS[p.r])) * pm, x = c0 + Math.cos(aa) * rr, y = c0 + Math.sin(aa) * rr, r2 = (0.1 + Math.random() * 0.5) * pm, g = c.createRadialGradient(x, y, 0, x, y, r2); g.addColorStop(0, 'rgba(120,58,24,0.34)'); g.addColorStop(1, 'rgba(120,58,24,0)'); c.fillStyle = g; c.fillRect(x - r2, y - r2, r2 * 2, r2 * 2); }
        c.restore();
      }
      // 판 이음선 (어두운 홈 + 밝은 모서리) + 볼트
      for (let r = 0; r < 5; r++) for (let i = 0; i < NP; i++) {
        const a = (i / NP) * 6.2832 + r * 0.06, r0 = Math.max(0.001, RINGS[r]) * pm, r1 = RINGS[r + 1] * pm;
        c.lineWidth = 4; c.strokeStyle = '#050506'; c.beginPath(); c.moveTo(c0 + Math.cos(a) * r0, c0 + Math.sin(a) * r0); c.lineTo(c0 + Math.cos(a) * r1, c0 + Math.sin(a) * r1); c.stroke();
        c.lineWidth = 2; c.strokeStyle = 'rgba(190,190,185,0.22)'; c.beginPath(); c.moveTo(c0 + Math.cos(a + 0.006) * r0, c0 + Math.sin(a + 0.006) * r0); c.lineTo(c0 + Math.cos(a + 0.006) * r1, c0 + Math.sin(a + 0.006) * r1); c.stroke();
        [[a + 0.03, r0 + 0.25 * pm], [a + 0.03, r1 - 0.25 * pm], [a + 6.2832 / NP - 0.03, r0 + 0.25 * pm], [a + 6.2832 / NP - 0.03, r1 - 0.25 * pm]].forEach(([aa, rr]) => { if (rr > pm) { const x = c0 + Math.cos(aa) * rr, y = c0 + Math.sin(aa) * rr; c.fillStyle = '#060607'; c.beginPath(); c.arc(x + 1.2, y + 1.2, 0.06 * pm, 0, 6.2832); c.fill(); c.fillStyle = '#55575a'; c.beginPath(); c.arc(x, y, 0.048 * pm, 0, 6.2832); c.fill(); c.fillStyle = '#8f9193'; c.beginPath(); c.arc(x - 0.8, y - 0.8, 0.018 * pm, 0, 6.2832); c.fill(); } });
      }
      [7, 15].forEach((r) => { c.strokeStyle = '#050506'; c.lineWidth = 4; c.beginPath(); c.arc(c0, c0, r * pm, 0, 6.2832); c.stroke(); c.strokeStyle = 'rgba(190,190,185,0.2)'; c.lineWidth = 1.5; c.beginPath(); c.arc(c0, c0, r * pm + 3, 0, 6.2832); c.stroke(); });
      const ringS = (r, w, col) => { c.strokeStyle = col; c.lineWidth = w * pm; c.beginPath(); c.arc(c0, c0, r * pm, 0, 6.2832); c.stroke(); };
      // 순환 궤도 (침목 + 레일 두 줄) — 반지름 16.6~17.8
      for (let i = 0; i < 150; i++) { const a = (i / 150) * 6.2832; c.strokeStyle = '#0b0b0c'; c.lineWidth = 0.22 * pm; c.beginPath(); c.moveTo(c0 + Math.cos(a) * 16.45 * pm, c0 + Math.sin(a) * 16.45 * pm); c.lineTo(c0 + Math.cos(a) * 17.95 * pm, c0 + Math.sin(a) * 17.95 * pm); c.stroke(); }
      ringS(16.8, 0.13, '#55585d'); ringS(17.6, 0.13, '#55585d'); ringS(16.8, 0.04, '#9a9da1'); ringS(17.6, 0.04, '#9a9da1');
      // 황동 상감 고리
      ringS(3.2, 0.3, '#a8762a'); ringS(11, 0.2, '#a8762a'); ringS(19.6, 0.34, '#a8762a');
      ringS(3.2, 0.06, '#f0c873'); ringS(11, 0.05, '#f0c873'); ringS(19.6, 0.07, '#f0c873');
      // 붉은·푸른 포인트: 해치 둘레 붉은 점선, 안쪽 고리 옆 푸른 배관 표시선, 7m 고리에 노랑·검정 경고 띠 4토막
      for (let i = 0; i < 36; i++) { if (i % 2) continue; const a0 = (i / 36) * 6.2832; c.strokeStyle = '#2c6670'; c.lineWidth = 0.16 * pm; c.beginPath(); c.arc(c0, c0, 4.5 * pm, a0, a0 + 6.2832 / 36); c.stroke(); }
      ringS(14.55, 0.07, '#1f5f9e'); ringS(14.75, 0.03, '#3d86c9');
      for (let q = 0; q < 4; q++) { const am = q * 1.5708 + 0.785; for (let k = -6; k < 6; k++) { const a0 = am + k * 0.035; c.strokeStyle = k % 2 ? '#111112' : '#c2931f'; c.lineWidth = 0.34 * pm; c.beginPath(); c.arc(c0, c0, 7.28 * pm, a0, a0 + 0.036); c.stroke(); } }
      // 메트로놈 눈금 고리 (반지름 12.6~13.4): 6°마다 짧은 눈금, 30°마다 긴 눈금
      for (let i = 0; i < 60; i++) { const a = (i / 60) * 6.2832, long = i % 5 === 0; c.strokeStyle = long ? '#d2a040' : '#7c5c2a'; c.lineWidth = (long ? 0.1 : 0.05) * pm; c.beginPath(); c.moveTo(c0 + Math.cos(a) * (long ? 12.5 : 12.8) * pm, c0 + Math.sin(a) * (long ? 12.5 : 12.8) * pm); c.lineTo(c0 + Math.cos(a) * 13.4 * pm, c0 + Math.sin(a) * 13.4 * pm); c.stroke(); }
      ringS(13.45, 0.05, '#8a6a2c');
      // 흰 차선 점선 (닳음) — 반지름 5.6
      for (let i = 0; i < 40; i++) { if (i % 2) continue; const a0 = (i / 40) * 6.2832; c.strokeStyle = 'rgba(214,214,208,' + (0.2 + Math.random() * 0.25) + ')'; c.lineWidth = 0.1 * pm; c.beginPath(); c.arc(c0, c0, 5.6 * pm, a0, a0 + 6.2832 / 40); c.stroke(); }
      // 바깥 경고 무늬
      for (let i = 0; i < 120; i++) { const a = (i / 120) * 6.2832; c.fillStyle = i % 2 ? '#3b4f58' : '#101011'; c.beginPath(); c.arc(c0, c0, 20.5 * pm, a, a + 6.2832 / 120); c.arc(c0, c0, 19.9 * pm, a + 6.2832 / 120 + 0.02, a + 0.02, true); c.closePath(); c.fill(); }
      // 리벳
      c.fillStyle = '#9a7630';
      [3.6, 10.7, 11.3, 19.2].forEach((r) => { const n = Math.round(r * 5); for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832; c.beginPath(); c.arc(c0 + Math.cos(a) * r * pm, c0 + Math.sin(a) * r * pm, 0.055 * pm, 0, 6.2832); c.fill(); } });
      // 문 앞: 궤도 지선 + 노랑·검정 경고 띠 + 구역 번호
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.2832 + Math.PI / 6;           // 문 각 (x = sin a, z = cos a)
        c.save(); c.translate(X(0), X(0)); c.rotate(-a + Math.PI / 2);   // 이제 +x 가 문 쪽
        c.strokeStyle = '#0b0b0c'; c.lineWidth = 0.2 * pm; for (let r = 13.8; r < 19.4; r += 0.42) { c.beginPath(); c.moveTo(r * pm, -0.75 * pm); c.lineTo(r * pm, 0.75 * pm); c.stroke(); }
        c.strokeStyle = '#4c4f54'; c.lineWidth = 0.12 * pm; [-0.42, 0.42].forEach((y) => { c.beginPath(); c.moveTo(13.6 * pm, y * pm); c.lineTo(19.5 * pm, y * pm); c.stroke(); });
        for (let k = 0; k < 9; k++) { c.fillStyle = k % 2 ? '#111112' : '#c2931f'; c.beginPath(); const y0 = -1.9 + k * 0.42; c.moveTo(18.3 * pm, y0 * pm); c.lineTo(18.9 * pm, (y0 + 0.2) * pm); c.lineTo(18.9 * pm, (y0 + 0.62) * pm); c.lineTo(18.3 * pm, (y0 + 0.42) * pm); c.closePath(); c.fill(); }
        c.restore();
        c.save(); c.translate(X(Math.sin(a) * 14.6 + Math.cos(a) * 1.9), X(Math.cos(a) * 14.6 - Math.sin(a) * 1.9));
        c.fillStyle = 'rgba(214,178,90,0.5)'; c.font = '900 ' + Math.round(0.8 * pm) + 'px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('G-0' + (i + 1), 0, 0);
        c.restore();
      }
      // 맨홀 (황동 테 + 방사 무늬 + 볼트)
      FLOOR.MANH.forEach(([x, z]) => {
        const cx = X(x), cy = X(z), r = 0.78 * pm;
        c.fillStyle = '#09090a'; c.beginPath(); c.arc(cx, cy, r * 1.12, 0, 6.2832); c.fill();
        c.fillStyle = '#2a2b2d'; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill();
        c.strokeStyle = '#9a7630'; c.lineWidth = 0.07 * pm; c.beginPath(); c.arc(cx, cy, r * 0.98, 0, 6.2832); c.stroke();
        c.strokeStyle = '#0d0d0e'; c.lineWidth = 0.05 * pm; for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832; c.beginPath(); c.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3); c.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85); c.stroke(); }
        c.beginPath(); c.arc(cx, cy, r * 0.3, 0, 6.2832); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.6, 0, 6.2832); c.stroke();
        c.fillStyle = '#b08a38'; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832 + 0.3; c.beginPath(); c.arc(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86, 0.045 * pm, 0, 6.2832); c.fill(); }
      });
      // 배수 격자
      FLOOR.GRATE.forEach(([x, z, rot]) => {
        c.save(); c.translate(X(x), X(z)); c.rotate(rot);
        c.fillStyle = '#060607'; c.fillRect(-1.0 * pm, -0.45 * pm, 2.0 * pm, 0.9 * pm);
        c.strokeStyle = '#4a4c50'; c.lineWidth = 0.05 * pm; c.strokeRect(-1.0 * pm, -0.45 * pm, 2.0 * pm, 0.9 * pm);
        c.fillStyle = '#34363a'; for (let k = 0; k < 9; k++) c.fillRect((-0.9 + k * 0.21) * pm, -0.37 * pm, 0.1 * pm, 0.74 * pm);
        c.restore();
      });
      // 가운데 해치 (보스가 올라오는 자리)
      c.fillStyle = '#0c0c0e'; c.beginPath(); c.arc(c0, c0, 2.9 * pm, 0, 6.2832); c.fill();
      c.strokeStyle = '#2c2d30'; c.lineWidth = 0.05 * pm;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832; c.beginPath(); c.moveTo(c0, c0); c.lineTo(c0 + Math.cos(a) * 2.9 * pm, c0 + Math.sin(a) * 2.9 * pm); c.stroke(); }
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.2832; c.fillStyle = i % 2 ? '#131314' : '#a57c1e'; c.beginPath(); c.arc(c0, c0, 2.9 * pm, a, a + 6.2832 / 16); c.arc(c0, c0, 2.62 * pm, a + 6.2832 / 16, a, true); c.closePath(); c.fill(); }
      c.fillStyle = '#22343a'; c.beginPath(); c.arc(c0, c0, 0.5 * pm, 0, 6.2832); c.fill();   // r8: 빨강은 적 예고 전용 — 바닥 장식은 청록·회청·흐린 금
      // 방위 화살 (황동)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.2832 + 0.39;
        c.save(); c.translate(c0 + Math.cos(a) * 9 * pm, c0 + Math.sin(a) * 9 * pm); c.rotate(a);
        c.fillStyle = '#6f6448'; c.beginPath(); c.moveTo(0.7 * pm, 0); c.lineTo(-0.4 * pm, 0.28 * pm); c.lineTo(-0.15 * pm, 0); c.lineTo(-0.4 * pm, -0.28 * pm); c.closePath(); c.fill();
        c.restore();
      }
      // 스텐실 글자
      c.fillStyle = 'rgba(205,205,200,0.16)'; c.font = '900 ' + Math.round(0.9 * pm) + 'px Arial Black, Arial, sans-serif'; c.textAlign = 'center';
      [[0, 9.9], [0, -9.2]].forEach(([x, y], i) => { c.save(); c.translate(c0 + x * pm, c0 + y * pm); c.fillText(i ? 'SECTOR 00' : 'GRUNT ZERO', 0, 0); c.restore(); });
      // 기름 얼룩·녹물 (거칠기 그림과 같은 자리)
      for (const st of FLOOR.stains) {
        c.save(); c.translate(X(st.x), X(st.z)); c.rotate(st.rot); c.scale(1, st.sx);
        const r = st.r * pm, g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, st.oil ? 'rgba(2,2,3,0.5)' : 'rgba(96,46,18,0.3)'); g.addColorStop(0.6, st.oil ? 'rgba(2,2,3,0.3)' : 'rgba(96,46,18,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2); c.restore();
      }
      // 긁힘 (밝은 금속이 드러난 가는 선) · 잔 때
      for (const q of FLOOR.scr) {
        c.save(); c.translate(X(q.x), X(q.z)); c.rotate(q.rot);
        c.strokeStyle = 'rgba(200,202,204,' + (0.1 + Math.random() * 0.2) + ')'; c.lineWidth = 1 + Math.random() * 1.6;
        c.beginPath(); c.moveTo(-q.l * pm / 2, 0); c.quadraticCurveTo(0, q.c * pm, q.l * pm / 2, 0); c.stroke(); c.restore();
      }
      for (let i = 0; i < 6000; i++) {
        const x = Math.random() * S, y = Math.random() * S, d = Math.random();
        c.fillStyle = d < 0.6 ? 'rgba(0,0,0,' + (0.05 + Math.random() * 0.12) + ')' : 'rgba(215,215,210,' + (0.02 + Math.random() * 0.05) + ')';
        c.fillRect(x, y, 1 + Math.random() * 10, 1 + Math.random() * 2);
      }
    });
  }
  // 거칠기(G)·금속성(B) 그림: 강철판은 반무광, 황동·레일은 매끈한 금속, 페인트는 무광 비금속, 기름 얼룩은 아주 매끈(조명·환경이 비침)
  function floorRM() {
    floorPlan();
    const S = 1024, pm = S / 42, c0 = S / 2;
    return GZ.R.canvasTex(S, S, (c) => {
      const X = (x) => c0 + x * pm, RINGS = FLOOR.RINGS, NP = FLOOR.NP, col = (ro, me) => 'rgb(0,' + Math.round(ro * 255) + ',' + Math.round(me * 255) + ')';
      c.fillStyle = col(0.7, 0.5); c.fillRect(0, 0, S, S);
      for (const p of FLOOR.plates) {
        const a0 = (p.i / NP) * 6.2832 + p.r * 0.06, a1 = ((p.i + 1) / NP) * 6.2832 + p.r * 0.06;
        c.fillStyle = p.kind === 'rust' ? col(0.86, 0.12) : p.kind === 'bright' ? col(0.4, 0.72) : col(p.rough, 0.5);
        c.beginPath(); c.arc(c0, c0, RINGS[p.r + 1] * pm, a0, a1); c.arc(c0, c0, Math.max(0.001, RINGS[p.r]) * pm, a1, a0, true); c.closePath(); c.fill();
      }
      const ringS = (r, w, ro, me) => { c.strokeStyle = col(ro, me); c.lineWidth = w * pm; c.beginPath(); c.arc(c0, c0, r * pm, 0, 6.2832); c.stroke(); };
      ringS(16.8, 0.16, 0.42, 1); ringS(17.6, 0.16, 0.42, 1);
      ringS(3.2, 0.32, 0.26, 1); ringS(11, 0.22, 0.26, 1); ringS(19.6, 0.36, 0.26, 1); ringS(13.1, 0.9, 0.5, 0.75);
      ringS(4.5, 0.18, 0.8, 0.05); ringS(14.6, 0.14, 0.75, 0.05); ringS(20.2, 0.6, 0.82, 0.05);
      for (let q = 0; q < 4; q++) { const am = q * 1.5708 + 0.785; c.strokeStyle = col(0.8, 0.05); c.lineWidth = 0.34 * pm; c.beginPath(); c.arc(c0, c0, 7.28 * pm, am - 0.21, am + 0.21); c.stroke(); }
      FLOOR.MANH.forEach(([x, z]) => { c.fillStyle = col(0.45, 0.85); c.beginPath(); c.arc(X(x), X(z), 0.8 * pm, 0, 6.2832); c.fill(); });
      c.fillStyle = col(0.55, 0.7); c.beginPath(); c.arc(c0, c0, 2.9 * pm, 0, 6.2832); c.fill();
      for (const st of FLOOR.stains) {   // 기름 = 매끈, 녹물 = 거침
        c.save(); c.translate(X(st.x), X(st.z)); c.rotate(st.rot); c.scale(1, st.sx);
        const r = st.r * pm, g = c.createRadialGradient(0, 0, 0, 0, 0, r);
        if (st.oil) { g.addColorStop(0, 'rgba(0,62,90,0.96)'); g.addColorStop(0.62, 'rgba(0,70,90,0.9)'); g.addColorStop(0.8, 'rgba(0,95,100,0.4)'); g.addColorStop(1, 'rgba(0,120,120,0)'); }
        else { g.addColorStop(0, 'rgba(0,235,20,0.8)'); g.addColorStop(1, 'rgba(0,235,20,0)'); }
        c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2); c.restore();
      }
      for (const q of FLOOR.scr) { c.save(); c.translate(X(q.x), X(q.z)); c.rotate(q.rot); c.strokeStyle = 'rgba(0,70,230,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-q.l * pm / 2, 0); c.quadraticCurveTo(0, q.c * pm, q.l * pm / 2, 0); c.stroke(); c.restore(); }
    }, { linear: true });
  }
  // 잔요철 높이 그림 → 노멀맵 (타일): 마름모 미끄럼 방지 돌기 + 긁힌 홈 + 패임 + 얕은 물결
  function floorNormal() {
    return GZ.R.normalTex(512, (c, S) => {
      c.fillStyle = '#808080'; c.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) { const x = Math.random() * S, y = Math.random() * S, r = 30 + Math.random() * 70, v = Math.random() < 0.5 ? 255 : 0; for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) { const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, 'rgba(' + v + ',' + v + ',' + v + ',0.12)'); g.addColorStop(1, 'rgba(' + v + ',' + v + ',' + v + ',0)'); c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); } }
      const n = 12, st = S / n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {   // 돌기
        c.save(); c.translate(x * st + st / 2 + (y % 2) * st / 2, y * st + st / 2); c.rotate((x + y) % 2 ? 0.7 : -0.7);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, st * 0.34); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.7, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.scale(1, 0.34); c.fillStyle = g; c.beginPath(); c.arc(0, 0, st * 0.34, 0, 6.2832); c.fill(); c.restore();
        if (x * st + st / 2 + (y % 2) * st / 2 > S - st * 0.4) { c.save(); c.translate(x * st + st / 2 + (y % 2) * st / 2 - S, y * st + st / 2); c.rotate((x + y) % 2 ? 0.7 : -0.7); c.scale(1, 0.34); c.fillStyle = g; c.beginPath(); c.arc(0, 0, st * 0.34, 0, 6.2832); c.fill(); c.restore(); }
      }
      for (let i = 0; i < 70; i++) { c.strokeStyle = 'rgba(0,0,0,' + (0.25 + Math.random() * 0.4) + ')'; c.lineWidth = 0.8 + Math.random() * 1.4; const x = Math.random() * S, y = Math.random() * S, a = Math.random() * 6.28, l = 20 + Math.random() * 120; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }   // 긁힌 홈
      for (let i = 0; i < 160; i++) { c.fillStyle = 'rgba(0,0,0,' + (0.2 + Math.random() * 0.4) + ')'; c.beginPath(); c.arc(Math.random() * S, Math.random() * S, 0.8 + Math.random() * 2.4, 0, 6.2832); c.fill(); }   // 패임
    }, 3.2);
  }
  function plateTex() {
    return GZ.R.canvasTex(256, 256, (c) => {
      c.fillStyle = '#2b2c2f'; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) { const v = 34 + Math.floor(Math.random() * 14); c.fillStyle = 'rgb(' + (v + 2) + ',' + (v + 1) + ',' + (v + 1) + ')'; c.fillRect((i % 2) * 128 + 3, Math.floor(i / 2) * 128 + 3, 122, 122); }
      c.fillStyle = '#8a6a2c'; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) [[12, 12], [116, 12], [12, 116], [116, 116], [64, 12], [64, 116]].forEach(([a, b]) => { c.beginPath(); c.arc(x * 128 + a, y * 128 + b, 3.2, 0, 6.2832); c.fill(); });
      for (let i = 0; i < 500; i++) { c.fillStyle = 'rgba(0,0,0,' + (0.05 + Math.random() * 0.15) + ')'; c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 2 + Math.random() * 26); }
    }, { repeat: true });
  }
  function windowTex() {
    return GZ.R.canvasTex(64, 128, (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 64, 128);
      for (let y = 4; y < 124; y += 7) for (let x = 4; x < 60; x += 7) {
        const r = Math.random();
        if (r < 0.1) { c.fillStyle = r < 0.07 ? '#8a5c26' : r < 0.085 ? '#7a2a1e' : '#2a5890'; c.fillRect(x, y, 3, 4); }
      }
    }, { repeat: true });
  }

  AR.build = function (scene) {
    initMats();
    const add = (m) => { scene.add(m); return m; };
    // 하늘 돔 (지평선 쪽 붉은 안개 → 위 검푸름)
    {
      const g = new T.SphereGeometry(190, 24, 14);
      const p = g.getAttribute('position'), c = new Float32Array(p.count * 3), a = new T.Color(), b = new T.Color(0x04050a), h1 = new T.Color(0x3a1f22), h2 = new T.Color(0x121c2e);
      for (let i = 0; i < p.count; i++) {
        const y = GZ.sat(p.getY(i) / 190), north = GZ.sat(-p.getZ(i) / 190 * 0.5 + 0.5);
        a.copy(h2).lerp(h1, north).lerp(b, GZ.sat(y * 2.2));
        c[i * 3] = a.r; c[i * 3 + 1] = a.g; c[i * 3 + 2] = a.b;
      }
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })));
    }
    const maxAn = GZ.R.renderer.capabilities.getMaxAnisotropy();
    // 바닥
    const pt = plateTex(); pt.repeat.set(46, 46); pt.anisotropy = maxAn;
    const outer = add(new T.Mesh(new T.CircleGeometry(140, 48), new T.MeshStandardMaterial({ color: 0x74726e, map: pt, metalness: 0.5, roughness: 0.78 })));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = false;
    const tex = floorTex(); tex.anisotropy = maxAn;
    const rm = floorRM(); rm.anisotropy = maxAn;
    const nm = floorNormal(); nm.repeat.set(27, 27); nm.anisotropy = maxAn;   // r4: 15 → 27 (가까운 바닥에서 무늬가 크게 늘어나 보이지 않게). 화질: 비등방 지정이 주석 안에 들어가 있던 것 꺼냄
    const floor = add(new T.Mesh(new T.CircleGeometry(20.6, 72), new T.MeshStandardMaterial({ map: tex, metalness: 1, roughness: 1, roughnessMap: rm, metalnessMap: rm, normalMap: nm, normalScale: new T.Vector2(0.26, 0.26), envMapIntensity: 0.6 })));
    AR.floor = floor;
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    // 박자에 맞춰 빛나는 고리 (도시의 박동)
    const rg = (r0, r1) => { const g = new T.RingGeometry(r0, r1, 96); g.rotateX(-Math.PI / 2); return g; };
    beatRing = add(new T.Mesh(rg(10.9, 11.1), new T.MeshBasicMaterial({ color: new T.Color(1.2, 0.7, 0.15), transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    beatRing.position.y = 0.03;
    beatRing2 = add(new T.Mesh(rg(19.45, 19.75), new T.MeshBasicMaterial({ color: new T.Color(1.2, 0.7, 0.15), transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    beatRing2.position.y = 0.03;
    hatchGlow = add(new T.Mesh(rg(2.95, 3.15), new T.MeshBasicMaterial({ color: new T.Color(0.9, 0.55, 0.16), transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, fog: false })));
    hatchGlow.position.y = 0.035;

    const S = newL();   // 고정물 전부 (재질별 병합)
    // ---- 둘레 벽(리벳 철판) + 황동 테 + 난간 ----
    const wt = plateTex(); wt.repeat.set(44, 1); wt.anisotropy = maxAn;
    const wall = add(new T.Mesh(new T.CylinderGeometry(20.9, 21.2, 1.5, 72, 1, true), new T.MeshStandardMaterial({ map: wt, metalness: 0.7, roughness: 0.55, side: T.DoubleSide })));
    wall.position.y = 0.75; wall.receiveShadow = true;
    const tor = (r, t, n, col, y, kind) => put(S, kind || 'brass', new T.TorusGeometry(r, t, 6, n), col, 0, y, 0, Math.PI / 2);
    tor(21.0, 0.2, 96, 0x94692a, 1.55); tor(20.84, 0.09, 96, 0x7c5a26, 0.78); tor(20.86, 0.06, 96, 0x15161b, 0.2, 'iron');
    tor(21.25, 0.055, 96, 0x3a3e48, 2.5, 'iron'); tor(21.25, 0.04, 96, 0x2a2d36, 2.08, 'iron');
    for (let i = 0; i < 72; i++) { const a = (i / 72) * 6.2832; put(S, 'iron', cyl(0.05, 0.06, 0.95, 5), 0x2a2d36, Math.sin(a) * 21.25, 2.05, Math.cos(a) * 21.25); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.2832 + 0.13; put(S, 'iron', box(0.34, 1.7, 0.5), 0x15161b, Math.sin(a) * 21.05, 0.85, Math.cos(a) * 21.05, 0, a); put(S, 'brass', box(0.4, 0.12, 0.56), 0x94692a, Math.sin(a) * 21.05, 1.72, Math.cos(a) * 21.05, 0, a); }   // 버팀기둥

    // ---- 문 6개: 리벳 아치 + 톱니 문장 + 경고 띠 + 어두운 안쪽 + 가는 붉은 등 ----
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.2832 + Math.PI / 6;
      AR.gates.push(a);
      const L = newL();
      [-1, 1].forEach((sx) => {
        put(L, 'plate', box(0.7, 3.3, 1.0), 0x5a5c62, sx * 1.6, 1.65, 0); put(L, 'brass', box(0.78, 0.16, 1.08), 0x94692a, sx * 1.6, 0.5, 0); put(L, 'brass', box(0.78, 0.16, 1.08), 0x94692a, sx * 1.6, 2.6, 0);
        put(L, 'glow', box(0.07, 1.7, 0.07), _c.copy(AMBER).multiplyScalar(0.6).clone(), sx * 1.2, 1.45, 0.5);
        for (let k = 0; k < 4; k++) put(L, 'brass', sph(0.06, 5, 4), 0xa9772c, sx * 1.6, 0.9 + k * 0.45, 0.52);
      });
      put(L, 'plate', box(4.3, 0.7, 1.1), 0x5a5c62, 0, 3.55, 0); put(L, 'brass', box(4.4, 0.14, 1.18), 0x94692a, 0, 3.98, 0);
      for (let k = 0; k < 7; k++) put(L, 'iron', box(0.3, 0.3, 0.06), k % 2 ? 0x15161b : 0xa07a1c, -1.05 + k * 0.35, 3.3, 0.56);
      put(L, 'brass', GZ.FX.gearGeo(0.62, 9, 0.16, { spokes: 4, bevel: 0.03, hole: 0.2 }), 0xa9772c, 0, 4.2, 0.2);
      put(L, 'plate', box(2.5, 3.0, 0.2), 0x1a1b1e, 0, 1.5, -0.3);
      put(L, 'glow', box(1.5, 0.07, 0.06), _c.copy(AMBER).multiplyScalar(0.45).clone(), 0, 3.05, 0.5);
      place(S, L, a, 20.9);
    }
    // ---- 가로등 (난간 위, 12개) ----
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.2832 + 0.26, L = newL();
      put(L, 'iron', cyl(0.07, 0.11, 4.4, 6), 0x1c1e25, 0, 3.7, 0); put(L, 'brass', cyl(0.16, 0.2, 0.3, 8), 0x94692a, 0, 1.75, 0);
      put(L, 'iron', box(0.08, 0.08, 1.0), 0x1c1e25, 0, 5.85, 0.45); put(L, 'brass', sph(0.1, 6, 5), 0x94692a, 0, 5.9, 0);
      put(L, 'brass', cyl(0.2, 0.12, 0.14, 8), 0x7c5a26, 0, 5.72, 0.9); put(L, 'glow', sph(0.15, 8, 6), new T.Color(2.0, 1.25, 0.45), 0, 5.58, 0.9);
      put(L, 'brass', cyl(0.05, 0.05, 0.16, 5), 0x7c5a26, 0, 5.8, 0.9);
      halos.push([0, 5.58, 0.9, 1.3, 0.75, 0.25, 3.4, L]);
      place(S, L, a, 21.3); fixHalos(L, a, 21.3);
    }

    // ---- 북쪽 버팀탑 7개 + 그 사이 굵은 배관 3줄 ----
    for (let i = -3; i <= 3; i++) {
      if (i === 1 || i === 2) continue;   // r6: 이 두 자리는 비워 뒤의 랜드마크(시계탑·발전소)가 보이게 (검토 A: 위쪽 1/3 이 파이프 벽만 반복)
      const a = Math.PI + i * 0.36, h = 10.5 - Math.abs(i) * 0.9, L = newL();
      put(L, 'iron', box(2.3, 1.2, 2.3), 0x121318, 0, 0.6, 0); put(L, 'iron', box(1.6, h, 1.6), 0x1a1c23, 0, h / 2, 0);
      for (let y = 2.6; y < h - 0.6; y += 2.6) { put(L, 'brass', box(1.74, 0.16, 1.74), 0x8a6226, 0, y, 0); for (let k = -1; k <= 1; k++) put(L, 'brass', sph(0.06, 5, 4), 0xb07a2a, k * 0.5, y + 0.3, 0.82); }
      put(L, 'iron', box(0.5, h - 3.4, 0.1), 0x08090c, 0, h / 2 + 0.3, 0.8); put(L, 'glow', box(0.1, h - 4.4, 0.05), i % 2 ? BLUEG : REDG, 0, h / 2 + 0.3, 0.87);
      put(L, 'brass', box(2.0, 0.4, 2.0), 0x94692a, 0, h + 0.2, 0); put(L, 'iron', box(1.3, 0.9, 1.3), 0x15161b, 0, h + 0.85, 0); put(L, 'iron', new T.ConeGeometry(1.1, 1.3, 4), 0x1c1e25, 0, h + 1.95, 0, 0, Math.PI / 4);
      place(S, L, a, 23.4);
    }
    [[24.6, 0.42, 2.7, 0x7c5a26, 'brass'], [24.9, 0.3, 3.9, 0x23262e, 'iron'], [24.6, 0.24, 4.9, 0x7c5a26, 'brass']].forEach(([r, t, y, col, kind]) => {
      const arc = 2.5, g = new T.TorusGeometry(r, t, 8, 56, arc); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 2 - arc / 2);
      put(S, kind, g, col, 0, y, 0);
      for (let k = 0; k <= 12; k++) { const a = Math.PI + (k / 12 - 0.5) * arc * 0.96; put(S, 'iron', cyl(t * 1.45, t * 1.45, 0.22, 10), 0x121318, Math.sin(a) * r, y, Math.cos(a) * r, Math.PI / 2, a + Math.PI / 2); }   // 이음 고리
    });
    for (let k = 0; k < 5; k++) { const a = Math.PI + (k - 2) * 0.36 + 0.18; put(S, 'brass', GZ.FX.gearGeo(0.5, 8, 0.1, { spokes: 4, hole: 0.2 }), 0xb03a26, Math.sin(a) * 24.05, 2.7, Math.cos(a) * 24.05, 0, a + Math.PI); }   // 붉은 밸브 손잡이

    // ---- 대형 톱니 5개 (천천히 돎): 이빨·살·모따기·축·볼트 + 뒤 받침 ----
    // r6: 첫 톱니 -9.2 → -4.2 (뒤의 증기 발전소를 가리지 않게)
    const big = [[-4.2, 5.9, -27.2, 4.6, 16, 0.25, 0], [8.8, 4.9, -25.6, 3.5, 12, -0.4, 1], [-17.6, 4.4, -19.4, 2.8, 10, 0.5, 1], [17.2, 4.9, -19.8, 3.2, 12, -0.3, 0], [0, 12.5, -31, 6.2, 20, 0.12, 2]];
    const GC = [[0xa9772c, 0x1c1e25], [0x8a5a30, 0x1c1e25], [0x32353f, 0x94692a]];
    big.forEach(([x, y, z, r, n, sp, ci]) => {
      const cc = GC[ci], th = r * 0.2;
      const parts = [part(GZ.FX.gearGeo(r, n, th, { spokes: ci === 2 ? 0 : 5, bevel: r * 0.025, hole: ci === 2 ? 0.42 : 0.15, root: 0.86, seg: 10 }), cc[0], 0, 0, 0)];
      parts.push(part(new T.TorusGeometry(r * 0.72, r * 0.035, 6, 40), cc[1], 0, 0, th / 2), part(cyl(r * 0.24, r * 0.27, th * 1.7, 16), cc[1], 0, 0, 0, Math.PI / 2), part(cyl(r * 0.12, r * 0.12, th * 2.1, 10), 0xb07a2a, 0, 0, 0, Math.PI / 2));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.2832; parts.push(part(sph(r * 0.035, 5, 4), 0xc9963a, Math.cos(a) * r * 0.19, Math.sin(a) * r * 0.19, th * 0.86)); }
      const m = add(new T.Mesh(T.BufferGeometryUtils.mergeGeometries(parts, false), MAT.mech));
      m.position.set(x, y, z); m.rotation.y = Math.atan2(-x, -z) * 0.4;
      spin.push({ m, sp });
      if (ci !== 2) {   // 받침: 뒤 축 + A자 다리 + 받침돌
        put(S, 'iron', cyl(r * 0.1, r * 0.1, 2.4, 8), 0x15161b, x, y, z - 1.2, Math.PI / 2);
        put(S, 'iron', box(0.5, y + 1, 0.5), 0x1a1c23, x - y * 0.22, y / 2, z - 1.6, 0, 0, -0.4); put(S, 'iron', box(0.5, y + 1, 0.5), 0x1a1c23, x + y * 0.22, y / 2, z - 1.6, 0, 0, 0.4);
        put(S, 'iron', box(y * 1.2, 0.8, 1.6), 0x121318, x, 0.4, z - 1.6); put(S, 'brass', box(1.1, 1.1, 0.7), 0x8a6226, x, y, z - 1.6);
      }
    });
    // ---- 침묵 기관 본탑 (멀리 북쪽): 층층 탑 + 버팀날개 + 오르간 굴뚝 + 붉은 눈 ----
    {
      const L = newL();
      put(L, 'iron', cyl(9.5, 11.5, 6, 12), 0x15161b, 0, 3, 0); put(L, 'brass', cyl(9.8, 9.8, 0.5, 12), 0x7c5a26, 0, 6.2, 0);
      put(L, 'iron', cyl(6.6, 8.6, 15, 12), 0x191b22, 0, 13.5, 0); put(L, 'brass', cyl(7.0, 7.0, 0.6, 12), 0x7c5a26, 0, 21.2, 0);
      put(L, 'iron', cyl(5.0, 6.2, 12, 12), 0x15161b, 0, 27.4, 0); put(L, 'iron', cyl(7.2, 7.2, 1.6, 12), 0x23262e, 0, 24.4, 0);
      put(L, 'iron', cyl(9, 4.6, 6, 14, true), 0x1c1e25, 0, 36.4, 0); put(L, 'brass', new T.TorusGeometry(9, 0.3, 6, 28), 0x8a6226, 0, 39.4, 0, Math.PI / 2);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832 + 0.39; put(L, 'iron', box(1.1, 19, 3.2), 0x121318, Math.sin(a) * 8.4, 9.5, Math.cos(a) * 8.4, 0, a); }
      for (let k = -4; k <= 4; k++) { if (Math.abs(k) < 2) continue; const hh = 20 - Math.abs(k) * 2.2; put(L, 'brass', cyl(0.5, 0.56, hh, 8), k % 2 ? 0x7c5a26 : 0x94692a, k * 1.25, hh / 2, 7.9); put(L, 'iron', cyl(0.62, 0.5, 0.5, 8), 0x101115, k * 1.25, hh + 0.2, 7.9); }
      for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.2832; put(L, 'glow', box(0.5, 0.9, 0.1), _c.copy(k % 3 ? AMBER : REDG).multiplyScalar(0.6).clone(), Math.sin(a) * 6.95, 23.0, Math.cos(a) * 6.95, 0, a); }
      for (const k of ['iron', 'brass', 'glow']) for (const g of L[k]) { g.translate(0, 0, -38.5); S[k].push(g); }
    }
    eye = add(new T.Mesh(new T.CircleGeometry(2.3, 32), new T.MeshBasicMaterial({ color: new T.Color(4, 0.4, 0.22), fog: false }))); eye.position.set(0, 12.5, -30.6);
    eyeHalo = add(new T.Mesh(new T.RingGeometry(2.6, 3.0, 40), new T.MeshBasicMaterial({ color: new T.Color(1.6, 0.2, 0.12), fog: false, transparent: true, opacity: 0.8 }))); eyeHalo.position.set(0, 12.5, -30.55);
    // ---- 공장 건물 고리 (북쪽은 빽빽하게, 남쪽은 드문드문) ----
    for (let i = 0; i < 26; i++) {
      const north = i < 18;
      const a = north ? Math.PI + ((i + 0.5) / 18 - 0.5) * 3.5 + (rnd() - 0.5) * 0.05 : ((i - 18 + 0.5) / 8 - 0.5) * 2.5;
      if (north && Math.abs(GZ.angDiff(a, Math.PI)) < 0.2) { rnd(); rnd(); continue; }   // 본탑 앞은 비움
      const w = 6 + rnd() * 6, h = 9 + rnd() * 15, d = 6 + rnd() * 4, r = 31 + rnd() * 8 + (north ? 0 : 6), L = newL();
      building(L, w, h, d);
      if (north && AR.LANDMARKS.some((q) => Math.abs(GZ.angDiff(a, q[1])) < 0.2)) continue;   // r6: 랜드마크 자리 (무작위 순서는 그대로 두고 놓지만 않음)
      place(S, L, a, r); fixHalos(L, a, r);
    }
    // ---- 큰 굴뚝 6개 ----
    [[-27, -23, 24], [28, -25, 28], [-37, -8, 19], [39, -6, 21], [-15, -43, 32], [17, -45, 30]].forEach(([x, z, h], i) => {
      chimney(S, x, z, h, 2.3, i % 2 ? BLUEG : REDG);
      halos.push([x, h + 0.9, z, i % 2 ? 0.2 : 1.5, i % 2 ? 0.5 : 0.16, i % 2 ? 1.6 : 0.1, 4]);
      vents.push({ x, y: h + 1.4, z, t: Math.random() * 2, gap: 0.9, s: 6 });
    });
    // ---- 벽 밖 바닥 배관·탱크 ----
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + ((i + 0.5) / 14 - 0.5) * 3.2, L = newL();
      put(L, i % 3 ? 'brass' : 'iron', cyl(0.24, 0.24, 7, 8), i % 3 ? 0x7c5a26 : 0x23262e, (i % 2 ? 1 : -1) * 1.2, 0.3, -3.5, Math.PI / 2);
      if (i % 3 === 0) { put(L, 'brass', cyl(1.0, 1.0, 2.4, 12), 0x6a4a22, 0, 1.2, -5.5); put(L, 'iron', sph(1.0, 12, 6), 0x1c1e25, 0, 2.4, -5.5); put(L, 'iron', cyl(1.04, 1.04, 0.16, 12), 0x15161b, 0, 1.2, -5.5); }
      else if (i % 3 === 1) { put(L, 'iron', box(1.6, 1.2, 1.6), 0x2b2623, 0.4, 0.6, -5.2, 0, 0.3); put(L, 'iron', box(1.1, 0.9, 1.1), 0x23262e, 0.2, 1.65, -5.1, 0, 0.7); }
      place(S, L, a, 22.2);
    }
    // ---- 바닥 증기 배출구 (황동 테 + 격자) ----
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.2832, x = Math.sin(a) * 19.9, z = Math.cos(a) * 19.9;
      put(S, 'brass', cyl(0.5, 0.6, 0.26, 12), 0x94692a, x, 0.13, z); put(S, 'iron', cyl(0.4, 0.4, 0.28, 12), 0x08090c, x, 0.14, z);
      for (let k = -1; k <= 1; k++) put(S, 'brass', box(0.84, 0.05, 0.07), 0x7c5a26, x + Math.cos(a) * 0 , 0.29, z + k * 0.24);
      vents.push({ x, y: 0.4, z, t: Math.random() * 4, gap: 3.2 + Math.random() * 2, s: 1.6 });
    }
    // 병합
    const mg = (list, mat) => { if (!list.length) return null; const m = add(new T.Mesh(T.BufferGeometryUtils.mergeGeometries(list, false), mat)); m.matrixAutoUpdate = false; m.frustumCulled = false; m.layers.set(2); for (const g of list) g.dispose(); return m; };   // 층 2 = 큰 배경 묶음 (얼굴 컷인 창에서는 안 그려 두 번 그리는 부담을 줄임)
    mg(S.iron, MAT.iron); mg(S.brass, MAT.bras2); mg(S.glow, MAT.glow);
    { const pt2 = plateTex(); pt2.repeat.set(1, 2); mg(S.plate, new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: pt2, metalness: 0.5, roughness: 0.74, envMapIntensity: 0.3 })); }   // r8 (검토 A4): 문틀 — 리벳 철판 질감 + 어둡게 + 반사 낮춤 (빨강·파랑 무지 상자로 보이던 것)
    // 등불 번짐 (점 하나당 스프라이트 대신 Points 한 번에)
    {
      const n = halos.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n);
      halos.forEach((h, i) => { pos[i * 3] = h[0]; pos[i * 3 + 1] = h[1]; pos[i * 3 + 2] = h[2]; col[i * 3] = h[3]; col[i * 3 + 1] = h[4]; col[i * 3 + 2] = h[5]; sz[i] = h[6]; });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aCol', new T.BufferAttribute(col, 3)); g.setAttribute('aSize', new T.BufferAttribute(sz, 1));
      halo = new T.ShaderMaterial({
        uniforms: { uScale: { value: 600 }, uK: { value: 1 } },
        vertexShader: 'attribute vec3 aCol; attribute float aSize; varying vec3 vC; uniform float uScale;\nvoid main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(220.0, aSize * uScale / max(0.5, -mv.z)); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec3 vC; uniform float uK;\nvoid main(){ float d = length(gl_PointCoord - vec2(0.5)); float a = clamp(1.0 - d * 2.0, 0.0, 1.0); gl_FragColor = vec4(vC * a * a * a * uK, 1.0); }',
        blending: T.AdditiveBlending, depthWrite: false, transparent: true,
      });
      const p = add(new T.Points(g, halo)); p.frustumCulled = false; p.renderOrder = 3;
    }
    // 도시 실루엣 (멀리, 한 번에 그림)
    {
      const wtx = windowTex();
      const m = new T.MeshStandardMaterial({ color: 0x0c0e13, metalness: 0.4, roughness: 0.8, emissiveMap: wtx, emissive: 0xffffff, emissiveIntensity: 1.0 });
      const n = 70, inst = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), m, n), mt = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3(), up = new T.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (rnd() - 0.5) * 6.2, r = 52 + rnd() * 60, h = 12 + rnd() * 38, w = 5 + rnd() * 9;
        mt.compose(v.set(Math.sin(a) * r, h / 2, Math.cos(a) * r), q.setFromAxisAngle(up, rnd() * 3), s.set(w, h, w));
        inst.setMatrixAt(i, mt);
      }
      add(inst);
    }
    // 무대 조명 빛줄기 (붉은·푸른) — 더하기 합성 원뿔
    const shaft = (x, z, col, tilt, yaw) => {
      const g = new T.ConeGeometry(4.2, 22, 20, 1, true); g.translate(0, -11, 0);
      const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const k = GZ.sat(1 + p.getY(i) / 22); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k * k; }
      g.setAttribute('color', new T.BufferAttribute(c, 3));
      const m = add(new T.Mesh(g, new T.MeshBasicMaterial({ color: col, vertexColors: true, transparent: true, opacity: 0.045, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })));
      m.position.set(x, 19, z); m.rotation.set(tilt, yaw, 0, 'YXZ');
      shafts.push({ m, tilt, yaw, ph: Math.random() * 6 });
    };
    shaft(-17, -22, 0xff2a18, 0.62, 0.55); shaft(17, -22, 0x2a6bff, 0.62, -0.55);
  };

  // r6: 배경 랜드마크 「톱니 시계탑 공장」·「증기 발전소」 (glb) — 둘레 바깥, 카메라 반대쪽(북쪽 버팀탑 뒤)에 가운데를 보게. 그림자는 받기만
  AR.landmarks = [];
  AR.LANDMARKS = [['clock', Math.PI + 0.8, 31], ['power', Math.PI + 0.4, 34]];   // [모델, 각도, 반지름] — 웨이브 카메라(오른쪽 뒤 27°)에서 화면 위 왼쪽·가운데 오른쪽에 걸리게 (세로 폰 실측)
  AR.addLandmarks = function (scene) {
    const MD = GZ.MD; if (!MD) return;
    for (const [k, a, r] of AR.LANDMARKS) {
      const src = MD[k]; if (!src) continue;
      const c = MD.cloneStatic(src), x = Math.sin(a) * r, z = Math.cos(a) * r;
      c.mat.emissiveMap = c.mat.map; c.mat.emissive = new T.Color(0.32, 0.24, 0.16); c.mat.emissiveIntensity = 1;   // 어둠·안개 속에서도 창·간판이 읽히게 (그림 색으로 은은히)
      c.grp.position.set(x, 0, z); c.grp.rotation.y = Math.atan2(-x, -z);   // 앞(+Z)이 가운데를 봄
      c.grp.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); } });
      scene.add(c.grp); AR.landmarks.push({ kind: k, grp: c.grp, x, z, h: src.h });
      if (k === 'power') for (let i = -2; i <= 2; i++) { const ox = i * 0.95, cs = Math.cos(c.grp.rotation.y), sn = Math.sin(c.grp.rotation.y); vents.push({ x: x + ox * cs, y: src.h + 0.6, z: z - ox * sn, t: Math.random() * 3, gap: 1.6 + Math.random(), s: 3 }); }   // 굴뚝 연기 (입자)
    }
  };

  // k = 박자 맥박(1 → 0), danger = 보스전 붉기 0..1
  AR.update = function (dt, t, k, danger) {
    for (const o of spin) o.m.rotation.z += o.sp * dt;
    const g = 0.14 + 0.5 * k;
    beatRing.material.opacity = g; beatRing2.material.opacity = g * 0.8;
    hatchGlow.material.opacity = 0.25 + 0.3 * k + danger * 0.3;
    const e = 1 + 0.25 * k;
    eye.scale.setScalar(e); eyeHalo.rotation.z += dt * 0.4;
    if (halo) { halo.uniforms.uScale.value = (GZ.R.h * GZ.R.pr * 0.5) / Math.tan((GZ.R.camera.fov * Math.PI) / 360); halo.uniforms.uK.value = 0.75 + 0.25 * k; }
    for (const s of shafts) { s.m.rotation.set(s.tilt + Math.sin(t * 0.3 + s.ph) * 0.08, s.yaw + Math.sin(t * 0.22 + s.ph * 2) * 0.16, 0, 'YXZ'); s.m.material.opacity = 0.03 + 0.015 * k; }
    for (const v of vents) {
      v.t -= dt;
      if (v.t <= 0) { v.t = v.gap * (0.7 + Math.random() * 0.6); GZ.FX.puff(v.x, v.y, v.z, (Math.random() - 0.5) * 0.6 + 0.5, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6, v.s * 0.5, v.s * 1.8, 2.4, 0.16); }
    }
    GZ.R.redL.intensity = 8 + 4 * k + danger * 12;   // r8: 웨이브 바닥이 덜 붉게 (보스전에만 붉기 올림)
    GZ.R.redL.color.setRGB(1, GZ.lerp(0.5, 0.19, GZ.sat(danger)), GZ.lerp(0.2, 0.12, GZ.sat(danger)));   // r8: 웨이브는 호박빛, 보스전에만 붉게 — 빨강은 위험 표시 전용   // r3: 보스전에 보스가 분홍·흰색으로 떠 버리지 않게
  };
})();
