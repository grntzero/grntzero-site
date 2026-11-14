/* 톱니골 던전 — 이펙트: 입자(인스턴스 1회 그리기), 바닥 충격파 링, 떠오르는 숫자, 화면 흔들림·히트 스톱·펀치 줌 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const FX = (TG.FX = {});
  const CELL = { star: 0, glow: 1, bubble: 2, note: 3, note2: 4, sparkle: 5, puff: 6, flower: 7, dot: 8, drop: 9, ring: 10, heart: 11 };
  FX.CELL = CELL;

  // ── 입자 아틀라스 (흰색으로 그려 색은 곱해서 입힘) ──
  function makeAtlas() {
    const S = 128, N = 4;
    return TG.R.canvasTex(S * N, S * N, (c) => {
      c.clearRect(0, 0, S * N, S * N);
      const cell = (i, f) => { c.save(); c.translate((i % N) * S + S / 2, Math.floor(i / N) * S + S / 2); f(); c.restore(); };
      const star = (r1, r2, k) => { c.beginPath(); for (let i = 0; i < k * 2; i++) { const r = i % 2 ? r2 : r1, a = (i / (k * 2)) * Math.PI * 2 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };
      // 0 별 (검은 테두리 + 흰 몸)
      cell(0, () => { star(54, 24, 5); c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = 'rgba(30,20,40,0.9)'; c.stroke(); c.fillStyle = '#fff'; c.fill(); });
      // 1 부드러운 빛
      cell(1, () => { const g = c.createRadialGradient(0, 0, 0, 0, 0, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-64, -64, 128, 128); });
      // 2 거품 (테두리 원 + 반짝)
      cell(2, () => { // 짙은 외곽선 + 흰 테 + 아래쪽 연보라 그늘 1단 + 반짝 (질감 없는 흰 판으로 보이지 않게)
        c.lineWidth = 8; c.strokeStyle = 'rgba(40,28,62,0.95)'; c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(236,228,255,0.30)'; c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.fill();
        c.save(); c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.clip(); c.fillStyle = 'rgba(150,128,222,0.7)'; c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.arc(-8, -12, 42, 0, Math.PI * 2, true); c.fill('evenodd'); c.restore();
        c.lineWidth = 6; c.strokeStyle = '#fff'; c.beginPath(); c.arc(0, 0, 43, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-18, -20, 11, 7, -0.7, 0, Math.PI * 2); c.fill(); });
      // 3 음표 ♪
      const note = (dbl) => {
        c.lineJoin = 'round'; c.lineCap = 'round';
        const path = () => {
          c.beginPath(); c.ellipse(-14, 30, 20, 14, -0.45, 0, Math.PI * 2);
          if (dbl) c.ellipse(30, 20, 20, 14, -0.45, 0, Math.PI * 2);
        };
        const stems = () => {
          c.beginPath(); c.moveTo(4, 26); c.lineTo(4, -44);
          if (dbl) { c.moveTo(48, 16); c.lineTo(48, -54); c.moveTo(4, -44); c.lineTo(48, -54); c.moveTo(4, -30); c.lineTo(48, -40); }
          else { c.moveTo(4, -44); c.quadraticCurveTo(30, -34, 30, -8); }
        };
        c.strokeStyle = 'rgba(30,20,40,1)'; c.lineWidth = 22; stems(); c.stroke(); path(); c.lineWidth = 12; c.stroke();
        c.fillStyle = '#fff'; path(); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 10; stems(); c.stroke();
      };
      cell(3, () => { c.translate(-6, 4); note(false); });
      cell(4, () => { c.translate(-16, 6); c.scale(0.92, 0.92); note(true); });
      // 5 반짝 십자
      cell(5, () => { const g = c.createRadialGradient(0, 0, 0, 0, 0, 22); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-30, -30, 60, 60); c.fillStyle = '#fff'; star(60, 7, 4); c.fill(); });
      // 6 김 덩이 (부드러운 흰 구름 — 짧게만 씀)
      cell(6, () => { const blob = (x, y, r) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }; blob(-16, 8, 36); blob(18, 10, 32); blob(0, -14, 38); });
      // 7 꽃 (꽃잎 5 + 가운데)
      cell(7, () => { c.lineWidth = 8; c.strokeStyle = 'rgba(30,20,40,0.9)'; for (let i = 0; i < 5; i++) { c.save(); c.rotate((i / 5) * Math.PI * 2); c.beginPath(); c.ellipse(0, -30, 18, 26, 0, 0, Math.PI * 2); c.stroke(); c.restore(); } for (let i = 0; i < 5; i++) { c.save(); c.rotate((i / 5) * Math.PI * 2); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, -30, 18, 26, 0, 0, Math.PI * 2); c.fill(); c.restore(); } c.fillStyle = 'rgba(255,230,120,1)'; c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill(); c.stroke(); });
      // 8 점
      cell(8, () => { c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 40, 0, Math.PI * 2); c.fill(); });
      // 9 물방울 (숨 고르기 땀)
      cell(9, () => { c.lineWidth = 8; c.strokeStyle = 'rgba(30,20,40,0.9)'; c.beginPath(); c.moveTo(0, -48); c.quadraticCurveTo(34, 6, 0, 40); c.quadraticCurveTo(-34, 6, 0, -48); c.stroke(); c.fillStyle = '#fff'; c.fill(); });
      // 10 얇은 고리
      cell(10, () => { c.lineWidth = 10; c.strokeStyle = '#fff'; c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.stroke(); });
      // 11 하트 (째깍이 고마워)
      cell(11, () => { c.lineWidth = 9; c.strokeStyle = 'rgba(30,20,40,0.9)'; c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-60, 0, -40, -50, 0, -20); c.bezierCurveTo(40, -50, 60, 0, 0, 40); c.stroke(); c.fillStyle = '#fff'; c.fill(); });
    });
  }

  const MAX = 2400;
  let mesh, geo, aPos, aCol, aMisc, n = 0;
  // 입자 상태
  const P = {
    x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX),
    vx: new Float32Array(MAX), vy: new Float32Array(MAX), vz: new Float32Array(MAX),
    life: new Float32Array(MAX), max: new Float32Array(MAX), s0: new Float32Array(MAX), s1: new Float32Array(MAX),
    r: new Float32Array(MAX), g: new Float32Array(MAX), b: new Float32Array(MAX), a: new Float32Array(MAX),
    rot: new Float32Array(MAX), vrot: new Float32Array(MAX), cell: new Float32Array(MAX), grav: new Float32Array(MAX), drag: new Float32Array(MAX),
    pop: new Float32Array(MAX), // 1이면 처음에 톡 커졌다가 줄어듦
    home: new Uint8Array(MAX), // 1이면 SEFO 쪽으로 빨려감
  };

  FX.init = function (scene) {
    const base = new T.PlaneGeometry(1, 1);
    geo = new T.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.getAttribute('position')); geo.setAttribute('uv', base.getAttribute('uv'));
    aPos = new T.InstancedBufferAttribute(new Float32Array(MAX * 4), 4); // xyz + size
    aCol = new T.InstancedBufferAttribute(new Float32Array(MAX * 4), 4);
    aMisc = new T.InstancedBufferAttribute(new Float32Array(MAX * 2), 2); // rot, cell
    aPos.setUsage(T.DynamicDrawUsage); aCol.setUsage(T.DynamicDrawUsage); aMisc.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('iPos', aPos); geo.setAttribute('iCol', aCol); geo.setAttribute('iMisc', aMisc);
    geo.instanceCount = 0;
    const mat = new T.ShaderMaterial({
      uniforms: { map: { value: makeAtlas() } },
      vertexShader: [
        'attribute vec4 iPos; attribute vec4 iCol; attribute vec2 iMisc; varying vec2 vUv; varying vec4 vCol;',
        'void main(){',
        '  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);',
        '  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);',
        '  float c = cos(iMisc.x), s = sin(iMisc.x);',
        '  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iPos.w;',
        '  vec3 wp = iPos.xyz + right * p.x + up * p.y;',
        '  float cell = iMisc.y; vec2 cc = vec2(mod(cell, 4.0), 3.0 - floor(cell / 4.0));',
        '  vUv = (cc + uv) / 4.0; vCol = iCol;',
        '  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);',
        '}'].join('\n'),
      fragmentShader: [
        'uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;',
        'void main(){ vec4 t = texture2D(map, vUv); float a = t.a * vCol.a; if (!(a >= 0.01)) discard; gl_FragColor = vec4(max(t.rgb * vCol.rgb, vec3(0.0)), min(a, 1.0)); }'].join('\n'),
      transparent: true, depthWrite: false, depthTest: true,
    });
    mesh = new T.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    scene.add(mesh);
    initRings(scene);
  };

  // 꾸밈 입자(별·거품·음표·반짝·점) 동시 상한: 안개가 많을수록 줄여 SEFO·안개가 묻히지 않게 (game.js 가 FX.crowd 를 매 프레임 알려 줌)
  FX.crowd = 0;
  const DECO = [1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0];
  FX.thin = () => (FX.crowd > 55 ? 0.45 : FX.crowd > 30 ? 0.7 : 1);
  const decoCap = () => (FX.crowd > 55 ? 420 : FX.crowd > 30 ? 700 : 1400);
  // 입자 하나 내기
  FX.emit = function (cell, x, y, z, o) {
    if (n >= MAX) return -1;
    if (DECO[cell] && n >= decoCap()) return -1;
    const i = n++, puffK = cell === 6 && FX.crowd > 30 ? 0.5 : 1; // 안개가 많을 때 흰 김은 작고 옅게 (흰 덩이가 화면을 덮지 않게)
    P.x[i] = x; P.y[i] = y; P.z[i] = z;
    P.vx[i] = o.vx || 0; P.vy[i] = o.vy || 0; P.vz[i] = o.vz || 0;
    P.life[i] = 0; P.max[i] = o.life || 0.6;
    P.s0[i] = (o.size != null ? o.size : 0.4) * (puffK < 1 ? 0.7 : 1); P.s1[i] = (o.size1 != null ? o.size1 * (puffK < 1 ? 0.7 : 1) : P.s0[i] * 0.2);
    const c = o.color || [1, 1, 1];
    P.r[i] = c[0]; P.g[i] = c[1]; P.b[i] = c[2]; P.a[i] = (o.alpha != null ? o.alpha : 1) * puffK;
    P.rot[i] = o.rot != null ? o.rot : TG.fra(0, 6.28); P.vrot[i] = o.vrot || 0;
    P.cell[i] = cell; P.grav[i] = o.grav || 0; P.drag[i] = o.drag || 0; P.pop[i] = o.pop ? 1 : 0; P.home[i] = o.home ? 1 : 0;
    return i;
  };

  function kill(i) {
    const j = --n;
    if (i === j) return;
    for (const k in P) P[k][i] = P[k][j];
  }

  // 예약 이펙트 (그림 쪽 시계 — 규칙 계산과 무관). 명중 연출 순서를 나눠 보여 줄 때 씀
  const laters = [];
  FX.later = function (delay, fn) { if (laters.length < 160) laters.push({ t: delay, fn }); };
  FX.update = function (dt, target) {
    for (let q = 0; q < laters.length; q++) { const L = laters[q]; L.t -= dt; if (L.t <= 0) { laters.splice(q, 1); q--; L.fn(); } }
    let i = 0;
    while (i < n) {
      P.life[i] += dt;
      if (P.life[i] >= P.max[i]) { kill(i); continue; }
      const d = Math.exp(-P.drag[i] * dt);
      P.vx[i] *= d; P.vz[i] *= d; P.vy[i] = P.vy[i] * d - P.grav[i] * dt;
      if (P.home[i] && target) {
        const dx = target.x - P.x[i], dy = target.y - P.y[i], dz = target.z - P.z[i];
        const k = 14 * dt;
        P.vx[i] += dx * k; P.vy[i] += dy * k; P.vz[i] += dz * k;
      }
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      P.rot[i] += P.vrot[i] * dt;
      i++;
    }
    const ap = aPos.array, ac = aCol.array, am = aMisc.array;
    for (i = 0; i < n; i++) {
      const t = P.life[i] / P.max[i];
      let s = P.s0[i] + (P.s1[i] - P.s0[i]) * t;
      if (P.pop[i]) s *= t < 0.15 ? TG.easeOutBack(t / 0.15) : 1;
      const a = P.a[i] * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
      ap[i * 4] = P.x[i]; ap[i * 4 + 1] = P.y[i]; ap[i * 4 + 2] = P.z[i]; ap[i * 4 + 3] = s;
      ac[i * 4] = P.r[i]; ac[i * 4 + 1] = P.g[i]; ac[i * 4 + 2] = P.b[i]; ac[i * 4 + 3] = a;
      am[i * 2] = P.rot[i]; am[i * 2 + 1] = P.cell[i];
    }
    geo.instanceCount = n;
    aPos.needsUpdate = aCol.needsUpdate = aMisc.needsUpdate = true;
    aPos.addUpdateRange && (aPos.clearUpdateRanges(), aPos.addUpdateRange(0, n * 4));
    aCol.addUpdateRange && (aCol.clearUpdateRanges(), aCol.addUpdateRange(0, n * 4));
    aMisc.addUpdateRange && (aMisc.clearUpdateRanges(), aMisc.addUpdateRange(0, n * 2));
    updateRings(dt);
    updateTexts(dt);
  };
  FX.count = () => n;
  FX.clear = function () { n = 0; laters.length = 0; rings.forEach((r) => { r.on = false; r.mesh.visible = false; }); texts.forEach((t) => { t.on = false; t.el.style.display = 'none'; }); };

  // ── 묶음 이펙트 ──
  const WHITE = [1.6, 1.6, 1.55], GOLD = [2.0, 1.6, 0.5], RED = [2.0, 0.45, 0.3], LAV = [1.0, 0.94, 1.2];
  FX.C = { WHITE, GOLD, RED, LAV };
  // 명중: 별 4~6 + 번쩍
  FX.hitSpark = function (x, y, z, big) {
    const k = big ? 7 : 4 + ((TG.fr() * 3) | 0);
    for (let i = 0; i < k; i++) {
      const a = TG.fr() * 6.283, sp = TG.fra(3, 6.5) * (big ? 1.3 : 1);
      FX.emit(CELL.star, x, y, z, { vx: Math.cos(a) * sp, vy: TG.fra(2, 5), vz: Math.sin(a) * sp, life: TG.fra(0.3, 0.5), size: TG.fra(0.32, 0.5) * (big ? 1.3 : 1), size1: 0.05, color: i % 2 ? GOLD : WHITE, grav: 9, drag: 3, vrot: TG.fra(-8, 8), pop: true });
    }
    FX.emit(CELL.glow, x, y, z, { life: 0.1, size: big ? 1.6 : 0.9, size1: big ? 2.1 : 1.3, color: [1.6, 1.55, 1.5], alpha: 0.4 });
  };
  // 명중 순서: (접촉·히트 스톱은 규칙 쪽) → 흰 번쩍 → 거품 → 별 입자
  FX.hitSeq = function (x, y, z, level, tint, bub) { // bub = 거품 색(안 주면 연보라)
    const big = level >= 2, s = 1 + level * 0.22;
    FX.emit(CELL.glow, x, y, z, { life: 0.09, size: 0.7 * s, size1: 1.2 * s, color: tint || [1.35, 1.2, 1.7], alpha: 0.4 });
    FX.later(0.035, () => {
      for (let i = 0, nb = Math.max(1, Math.round((3 + level) * FX.thin())); i < nb; i++) { const a = TG.fr() * 6.283, sp = TG.fra(2, 4) * s; FX.emit(CELL.bubble, x, y, z, { vx: Math.cos(a) * sp, vy: TG.fra(0.5, 2.5), vz: Math.sin(a) * sp, life: TG.fra(0.2, 0.3), size: 0.16 * s, size1: 0.26 * s, color: bub || LAV, drag: 4.5, grav: -1, pop: true }); }
    });
    FX.later(0.075, () => {
      const k = big ? 7 : 4;
      for (let i = 0; i < k; i++) { const a = (i / k) * 6.283 + TG.fr(), sp = TG.fra(3, 6.5) * (big ? 1.3 : 1); FX.emit(CELL.star, x, y, z, { vx: Math.cos(a) * sp, vy: TG.fra(2, 5), vz: Math.sin(a) * sp, life: TG.fra(0.3, 0.5), size: TG.fra(0.32, 0.5) * (big ? 1.3 : 1), size1: 0.05, color: i % 2 ? GOLD : WHITE, grav: 9, drag: 3, vrot: TG.fra(-8, 8), pop: true }); }
    });
  };
  // 터짐: 거품 고리 링 + 음표 + 빛
  FX.popBurst = function (x, y, z, scale, color) {
    scale = scale || 1;
    const k = Math.max(4, Math.round((10 + 4 * scale) * FX.thin())), bs = Math.min(scale, 2.2);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * 6.283 + TG.fr() * 0.3, sp = TG.fra(3.5, 5.5) * scale;
      FX.emit(CELL.bubble, x, y, z, { vx: Math.cos(a) * sp, vy: TG.fra(0.5, 3), vz: Math.sin(a) * sp, life: TG.fra(0.2, 0.3), size: TG.fra(0.16, 0.26) * bs, size1: 0.3 * bs, color: color || LAV, drag: 4.5, grav: -1, pop: true }); // 조각: 절반 크기, 0.3초 안에 사라짐
    }
    for (let i = 0; i < 4; i++) {
      const a = TG.fr() * 6.283;
      FX.emit(CELL.dot, x, y, z, { vx: Math.cos(a) * 2, vy: TG.fra(2, 4), vz: Math.sin(a) * 2, life: 0.3, size: 0.1 * bs, size1: 0.02, color: [1.25, 1.1, 1.6], grav: 6 });
    }
    // 터지는 빛: 절반 크기·연보라·짧게 (흰 판처럼 보이지 않게)
    FX.emit(CELL.glow, x, y, z, { life: 0.12, size: 0.7 * scale, size1: 1.1 * scale, color: [1.2, 1.05, 1.6], alpha: 0.32 });
    FX.emit(CELL.ring, x, y, z, { life: 0.24, size: 0.6 * scale, size1: 2.4 * scale, color: [1.0, 0.9, 1.35], alpha: 0.5 });
  };
  // 음표 꽃 (큰 소리)
  FX.noteFlower = function (x, z, R) {
    const petals = 7;
    for (let p = 0; p < petals; p++) {
      const a0 = (p / petals) * 6.283;
      for (let j = 0; j < 7; j++) {
        const rr = (j + 1) / 7, a = a0 + Math.sin(rr * 3.14) * 0.35;
        const px = x + Math.cos(a) * R * rr, pz = z + Math.sin(a) * R * rr;
        const cols = [[2.4, 0.6, 0.45], [2.4, 1.9, 0.6], [0.6, 1.9, 2.4], [1.9, 0.8, 2.2]];
        FX.emit(j % 3 === 0 ? CELL.flower : (j % 2 ? CELL.note : CELL.note2), px, 0.4, pz, { vy: TG.fra(2.5, 5), life: TG.fra(0.8, 1.2), size: TG.fra(0.9, 1.3), size1: 0.3, color: cols[(p + j) % 4], grav: 5, vrot: TG.fra(-3, 3), rot: TG.fra(-0.4, 0.4), pop: true });
      }
    }
  };
  // 증기 「칙」: 짧고 하얀 김 몇 덩이, 빠르게 올라가 사라짐
  FX.steam = function (x, z, y0, k) {
    y0 = y0 || 0.3; k = k || 1;
    for (let i = 0; i < 8; i++) {
      FX.emit(CELL.puff, x + TG.fra(-0.2, 0.2) * k, y0 + i * 0.14 * k, z + TG.fra(-0.2, 0.2) * k, { vx: TG.fra(-0.4, 0.4), vy: TG.fra(4.5, 7) * k, vz: TG.fra(-0.4, 0.4), life: TG.fra(0.35, 0.55), size: TG.fra(0.5, 0.8) * k, size1: TG.fra(1.3, 1.8) * k, color: [1.35, 1.38, 1.42], alpha: 0.95, drag: 3.5, vrot: TG.fra(-1, 1) });
    }
  };
  FX.dust = function (x, z, k, s) { // 착지 먼지 (밝은 크림색, 짧게)
    k = k || 8; s = s || 1;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * 6.283;
      FX.emit(CELL.puff, x + Math.cos(a) * 0.4, 0.2, z + Math.sin(a) * 0.4, { vx: Math.cos(a) * 3.5 * s, vy: 0.8, vz: Math.sin(a) * 3.5 * s, life: 0.35, size: 0.45 * s, size1: 0.9 * s, color: [1.25, 1.15, 1.0], alpha: 0.8, drag: 6 });
    }
  };

  // ── 바닥 충격파 링 (풀) ──
  const rings = [];
  let ringGeo, wallGeo;
  function ringMat() {
    return new T.ShaderMaterial({
      uniforms: { uCol: { value: new T.Color() }, uA: { value: 1 }, uW: { value: 0.15 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 uCol; uniform float uA; uniform float uW; varying vec2 vUv;',
        'void main(){ float w = max(uW, 0.02); float r = length(vUv - 0.5) * 2.0; float band = smoothstep(1.0 - w, 1.0 - w * 0.5, r) * (1.0 - smoothstep(0.985, 1.0, r));',
        ' float inner = smoothstep(1.0 - w * 3.0, 1.0, r) * 0.25; float a = (band + inner) * uA; if (!(a >= 0.01)) discard;',
        ' float core = smoothstep(1.0 - w * 0.42, 1.0 - w * 0.3, r) * (1.0 - smoothstep(1.0 - w * 0.2, 1.0 - w * 0.08, r));', // 띠 가운데 흰 심지
        ' vec3 col = mix(max(uCol, vec3(0.0)) * (0.8 + band * 0.6), vec3(1.5, 1.45, 1.35), core * 0.85);',
        ' gl_FragColor = vec4(col, clamp(a, 0.0, 1.0)); }'].join('\n'),
      transparent: true, depthWrite: false,
    });
  }
  function wallMat() {
    return new T.ShaderMaterial({
      uniforms: { uCol: { value: new T.Color() }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float vy = clamp(vUv.y, 0.0, 1.0); float a = pow(max(1.0 - vy, 0.0), 1.6) * uA * (0.55 + 0.45 * smoothstep(0.0, 0.15, vy)); if (!(a >= 0.01)) discard; gl_FragColor = vec4(max(uCol, vec3(0.0)) * (2.0 - vy), clamp(a, 0.0, 1.0)); }',
      transparent: true, depthWrite: false, side: T.DoubleSide,
    });
  }
  function initRings(scene) {
    ringGeo = new T.PlaneGeometry(2, 2); ringGeo.rotateX(-Math.PI / 2);
    wallGeo = new T.CylinderGeometry(1, 1, 1, 48, 1, true); wallGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 14; i++) {
      const wall = i >= 10;
      const m = new T.Mesh(wall ? wallGeo : ringGeo, wall ? wallMat() : ringMat());
      m.visible = false; m.renderOrder = wall ? 16 : 5; m.frustumCulled = false;
      scene.add(m);
      rings.push({ mesh: m, on: false, wall, t: 0 });
    }
  }
  // o: {r0, r1, dur, color(hex), width, y, h(벽 높이), alpha}
  FX.ring = function (x, z, o) {
    const r = rings.find((q) => !q.on && q.wall === !!o.wall); if (!r) return;
    r.on = true; r.t = -(o.delay || 0); r.o = o; r.x = x; r.z = z;
    r.mesh.material.uniforms.uCol.value.set(o.color || 0xffffff).multiplyScalar(o.hdr || 1.6);
    if (!r.wall) r.mesh.material.uniforms.uW.value = o.width || 0.15;
    r.mesh.position.set(x, o.y != null ? o.y : 0.06, z);
    r.mesh.visible = false;
  };
  function updateRings(dt) {
    for (const r of rings) {
      if (!r.on) continue;
      r.t += dt;
      if (r.t < 0) continue;
      const k = r.t / r.o.dur;
      if (k >= 1) { r.on = false; r.mesh.visible = false; continue; }
      r.mesh.visible = true;
      const e = 1 - Math.pow(1 - k, 2.4);
      const rad = r.o.r0 + (r.o.r1 - r.o.r0) * e;
      r.mesh.scale.set(rad, r.wall ? (r.o.h || 1.5) * (1 - k * 0.5) : 1, rad);
      r.mesh.material.uniforms.uA.value = (r.o.alpha || 1) * (1 - k) * (k < 0.08 ? k / 0.08 : 1);
    }
  }

  // ── 떠오르는 숫자·글자 (DOM 풀) ──
  const texts = [];
  let layer;
  FX.initText = function (el) {
    layer = el;
    for (let i = 0; i < 48; i++) {
      const d = document.createElement('div');
      d.className = 'ftext'; d.style.display = 'none';
      layer.appendChild(d);
      texts.push({ el: d, on: false });
    }
  };
  // kind: 'n' 숫자, 'word' 글자, 'cheer', 'heal', 'boing', 'thanks', 'echo', 'pop', 'dmg dN'
  // 규칙: 같은 문구는 화면에 1개(「퐁!」「통!」은 3개)까지, 같은 종류 알림(word·cheer·heal·boing)은 한 번에 1개만 — 넘으면 가장 오래된 것을 다시 씀(포개짐 없음)
  const FPX = { n: 24, d0: 27, d1: 31, d2: 37, d3: 46, boing: 30, thanks: 28, echo: 26, cheer: 32, hint: 16, word: 26, heal: 24, zone: 18, pop: 30 };
  const SINGLE = { word: 1, cheer: 1, heal: 1, boing: 1 };
  FX.text = function (str, x, y, z, kind) {
    kind = kind || 'n';
    const sp = kind.split(' '), base = sp[0], isDmg = base === 'dmg';
    let t = null;
    if (!isDmg) {
      const lim = base === 'pop' || base === 'echo' ? 3 : 1;
      let same = 0, old = null;
      for (const q of texts) { if (!q.on || q.key != null) continue; if (q.str === str || (SINGLE[base] && q.base === base)) { same++; if (!old || q.t > old.t) old = q; } }
      if (same >= lim) t = old;
    }
    if (!t) t = texts.find((q) => !q.on);
    if (!t) { t = texts.reduce((a, b) => (a.t > b.t ? a : b)); }
    t.on = true; t.t = 0; t.x = x + TG.fra(-0.3, 0.3); t.y = y; t.z = z; t.life = kind === 'word' || kind === 'thanks' ? 1.0 : kind === 'hint' ? 1.6 : 0.75;
    t.vx = TG.fra(-30, 30); t.key = null; t.val = 0; t.str = str; t.base = base;
    // 같은 자리에 글자가 이미 떠 있으면 한 줄씩 위로 쌓음 (겹침 방지)
    t.stack = 0;
    if (!isDmg) for (const q of texts) if (q !== t && q.on && q.key == null && q.t < q.life * 0.8 && Math.abs(q.x - x) < 5 && Math.abs(q.z - z) < 4) t.stack = Math.max(t.stack, (q.stack || 0) + 1);
    if (t.stack > 2) t.stack = 2;
    t.el.className = 'ftext ' + kind;
    t.el.textContent = str;
    t.el.style.display = 'block';
    setHalf(t, str, isDmg ? sp[1] : base);
    return t;
  };
  // 글자 반너비·반높이 어림 (화면 밖·HUD 밑으로 안 들어가게 밀 때 씀. 한글 1em, 숫자·기호 0.62em)
  function setHalf(t, str, k) {
    let em = 0; for (let i = 0; i < str.length; i++) em += str.charCodeAt(i) > 0x2e80 ? 1 : 0.62;
    const px = (FPX[k] || 24) * ((TG.H && TG.H.s) || 1) * 1.2;
    t.hw = em * px * 0.5 + 4; t.hh = px * 0.6;
  }
  // 떠오르는 숫자: 같은 대상 연속 명중은 한 숫자로 합침(화면 도배 방지). 동시에 최대 6개
  const DKIND = ['d0', 'd1', 'd2', 'd3'];
  FX.dmg = function (key, val, x, y, z, level) {
    let t = null, cnt = 0, oldest = null;
    for (const q of texts) { if (!q.on || q.key == null) continue; cnt++; if (!oldest || q.t > oldest.t) oldest = q; if (q.key === key && q.t < 0.5) t = q; }
    if (t) {
      t.val += val; t.lv = Math.max(t.lv, level); t.t = 0.1; t.x = x; t.y = y; t.z = z;
      t.el.className = 'ftext dmg ' + DKIND[t.lv]; t.el.textContent = String(t.val); setHalf(t, String(t.val), DKIND[t.lv]);
      return;
    }
    if (cnt >= 6 && oldest) { oldest.on = false; oldest.el.style.display = 'none'; }
    t = FX.text(String(val), x, y, z, 'dmg ' + DKIND[level]);
    t.key = key; t.val = val; t.lv = level; t.vx = TG.fra(-12, 12); t.life = 0.8;
  };
  const pv = new T.Vector3();
  function updateTexts(dt) {
    const cam = TG.R.camera, W = TG.R.w, H = TG.R.h, us = (TG.H && TG.H.s) || 1, G = TG.G;
    const topMid = G && G.phase === 'shelter' ? 114 : G && G.bossStarted ? 96 : 66; // 가운데 위: 쉼터 버튼 / 보스 막대 / 진행 바
    for (const t of texts) {
      if (!t.on) continue;
      t.t += dt;
      if (t.t >= t.life) { t.on = false; t.el.style.display = 'none'; continue; }
      pv.set(t.x, t.y, t.z).project(cam);
      const k = t.t / t.life;
      let sx = (pv.x * 0.5 + 0.5) * W + t.vx * k, sy = (-pv.y * 0.5 + 0.5) * H - 60 * (1 - Math.pow(1 - k, 2)) * (H / 500) - (t.stack || 0) * H * 0.095;
      // HUD 안전 구역 밖으로 밀어 넣음: 위(얼굴·진행 바·보스 막대·미니맵·쉼터 버튼), 아래 구석(조이스틱 / 「소리」+큰 소리 버튼 — 왼손잡이면 좌우 바뀜), 아래 가운데(안내 줄)
      const hw = t.hw || 30, hh = t.hh || 16;
      sx = sx < hw + 6 ? hw + 6 : sx > W - hw - 6 ? W - hw - 6 : sx;
      const top = (sx + hw > W - 205 * us ? 108 : sx - hw < 232 * us ? 84 : topMid) * us + hh;
      const lefty = !!(G && G.settings && G.settings.lefty), nearL = sx - hw, nearR = W - (sx + hw); // 버튼 쪽: 너비 256·높이 250(큰 소리 버튼 위 「아직!」까지), 스틱 쪽: 192·172
      const dBtn = lefty ? nearL : nearR, dStk = lefty ? nearR : nearL;
      const bot = H - ((dBtn < 150 * us ? 172 : dBtn < 256 * us ? 250 : dStk < 192 * us ? 172 : 58) * us) - hh;
      sy = sy < top ? top : sy > bot ? Math.max(top, bot) : sy;
      const sc = k < 0.12 ? 0.4 + 1.1 * TG.easeOutBack(k / 0.12) * 0.8 + 0.2 : 1.2 - (k - 0.12) * 0.25;
      t.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px) translate(-50%,-50%) scale(' + sc.toFixed(3) + ')';
      t.el.style.opacity = k > 0.75 ? (1 - (k - 0.75) / 0.25).toFixed(2) : '1';
    }
  }

  // ── 흔들림·히트 스톱·펀치 줌 ──
  FX.trauma = 0; FX.punchV = 0; FX.freeze = 0;
  const shakeOn = () => !(TG.G && TG.G.settings && TG.G.settings.shake === false);
  // 폰 진동은 js/haptics.js(GZHaptics) + game.js 사건별 패턴으로 옮김(2026-11-13). 화면 흔들림 설정과 따로 켜고 끔
  FX.shake = function (a) { if (shakeOn()) { FX.trauma = Math.min(1, FX.trauma + a); } };
  // 히트 스톱: 규칙 계산 걸음(1/60초) 수로 멈춤 → 같은 입력이면 늘 같은 결과
  FX.hitstop = function (ms) { const G = TG.G; if (G) G.freeze = Math.max(G.freeze || 0, Math.max(1, Math.round(ms / 16.667))); };
  FX.punch = function (a) { if (shakeOn()) FX.punchV = Math.min(0.12, FX.punchV + a); };
  FX.camUpdate = function (dt) {
    FX.trauma = Math.max(0, FX.trauma - dt * 1.7);
    FX.punchV = TG.damp(FX.punchV, 0, 9, dt);
    const s = FX.trauma * FX.trauma, t = performance.now() / 1000;
    return {
      x: s * 0.55 * (Math.sin(t * 47.1) * 0.6 + Math.sin(t * 83.3) * 0.4),
      y: s * 0.4 * (Math.sin(t * 59.7) * 0.6 + Math.sin(t * 101.9) * 0.4),
      roll: s * 0.035 * Math.sin(t * 37.3),
      zoom: FX.punchV,
    };
  };
})();
