/* GRUNT ZERO RE — 이펙트: 불꽃 입자·톱니 파편·충격 고리·음파 호·증기·바닥 예고 표시·떠오르는 숫자 */
(function () {
  'use strict';
  const GZ = window.GZ, T = THREE;
  const FX = (GZ.FX = {});
  const NS = 700, ND = 150, NR = 30, NA = 48, NP = 96, NT = 30, NC = 6, NG = 8;
  let scene;

  // ---------- 불꽃 입자 (Points, 더하기 합성) ----------
  const sp = { pos: new Float32Array(NS * 3), col: new Float32Array(NS * 3), size: new Float32Array(NS), vel: new Float32Array(NS * 3), life: new Float32Array(NS), max: new Float32Array(NS), base: new Float32Array(NS * 3), sz: new Float32Array(NS), g: new Float32Array(NS), i: 0 };
  let spGeo, spMat;
  function initSparks() {
    spGeo = new T.BufferGeometry();
    spGeo.setAttribute('position', new T.BufferAttribute(sp.pos, 3).setUsage(T.DynamicDrawUsage));
    spGeo.setAttribute('aCol', new T.BufferAttribute(sp.col, 3).setUsage(T.DynamicDrawUsage));
    spGeo.setAttribute('aSize', new T.BufferAttribute(sp.size, 1).setUsage(T.DynamicDrawUsage));
    spMat = new T.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: 'attribute vec3 aCol; attribute float aSize; varying vec3 vC; uniform float uScale;\nvoid main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC;\nvoid main(){ float d = length(gl_PointCoord - vec2(0.5)); float a = clamp(1.0 - d * 2.0, 0.0, 1.0); gl_FragColor = vec4(vC * a * a, 1.0); }',
      blending: T.AdditiveBlending, depthWrite: false, transparent: true,
    });
    const p = new T.Points(spGeo, spMat);
    p.frustumCulled = false; p.renderOrder = 20; p.layers.set(1);
    scene.add(p);
  }
  FX.spark = function (x, y, z, vx, vy, vz, r, g, b, size, life, grav) {
    const i = sp.i; sp.i = (i + 1) % NS;
    sp.pos[i * 3] = x; sp.pos[i * 3 + 1] = y; sp.pos[i * 3 + 2] = z;
    sp.vel[i * 3] = vx; sp.vel[i * 3 + 1] = vy; sp.vel[i * 3 + 2] = vz;
    sp.base[i * 3] = r; sp.base[i * 3 + 1] = g; sp.base[i * 3 + 2] = b;
    sp.sz[i] = size; sp.life[i] = life; sp.max[i] = life; sp.g[i] = grav == null ? 9 : grav;
  };
  const COL = {
    gold: [1.25, 0.78, 0.17], white: [1.2, 1.1, 0.9], red: [1.5, 0.17, 0.09], blue: [0.17, 0.5, 1.6], ember: [1.3, 0.42, 0.08], steam: [0.5, 0.52, 0.56],
  };
  FX.COL = COL;
  FX.burst = function (x, y, z, n, col, speed, size, life, up) {
    const c = COL[col] || COL.gold;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.283, e = (Math.random() - 0.25) * 1.4, s = speed * (0.35 + Math.random() * 0.8);
      const k2 = 0.6 + Math.random() * 0.6;
      FX.spark(x, y, z, Math.sin(a) * Math.cos(e) * s, Math.sin(e) * s + (up || 0), Math.cos(a) * Math.cos(e) * s, c[0] * k2, c[1] * k2, c[2] * k2, (size || 0.25) * (0.6 + Math.random() * 0.8), (life || 0.5) * (0.6 + Math.random() * 0.7));
    }
  };
  // 한쪽으로 튀는 불꽃 (맞은 자리)
  FX.spray = function (x, y, z, ang, n, col, speed) {
    const c = COL[col] || COL.gold;
    for (let k = 0; k < n; k++) {
      const a = ang + (Math.random() - 0.5) * 1.5, s = speed * (0.4 + Math.random() * 0.8);
      FX.spark(x, y, z, Math.sin(a) * s, 1 + Math.random() * 4, Math.cos(a) * s, c[0], c[1], c[2], 0.16 + Math.random() * 0.2, 0.25 + Math.random() * 0.3);
    }
  };

  // ---------- 톱니 파편 (인스턴스) ----------
  const db = { c: new Uint32Array(ND), p: new Float32Array(ND * 3), v: new Float32Array(ND * 3), r: new Float32Array(ND * 3), w: new Float32Array(ND * 3), life: new Float32Array(ND), s: new Float32Array(ND), i: 0 };
  let dbMesh; const dm = new T.Matrix4(), dq = new T.Quaternion(), de = new T.Euler(), dv = new T.Vector3(), ds = new T.Vector3(), dc = new T.Color();
  // 톱니: 이빨(사다리꼴)·살 구멍·모따기·두께가 있는 입체. o = {spokes: 살 수(0 = 통판), bevel: 모따기, hole: 축 구멍 비율}
  function gearGeo(r, teeth, th, o) {
    o = o || {};
    const sh = new T.Shape(), n = teeth, root = r * (o.root || 0.8), st = 6.2832 / n;
    for (let i = 0; i < n; i++) {
      const a = i * st;
      const pts = [[a, root], [a + st * 0.16, root], [a + st * 0.27, r], [a + st * 0.57, r], [a + st * 0.68, root]];
      pts.forEach(([aa, rr], k) => { const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr; if (i === 0 && k === 0) sh.moveTo(x, y); else sh.lineTo(x, y); });
    }
    sh.closePath();
    const hr = r * (o.hole == null ? 0.3 : o.hole);
    if (hr > 0) { const hole = new T.Path(); hole.absarc(0, 0, hr, 0, 6.2832, true); sh.holes.push(hole); }
    if (o.spokes) {   // 살 사이 구멍 (부채꼴 창)
      const k = o.spokes, r0 = r * 0.36, r1 = r * 0.66, gap = 0.2;
      for (let i = 0; i < k; i++) {
        const a0 = (i / k) * 6.2832 + gap, a1 = ((i + 1) / k) * 6.2832 - gap, h = new T.Path();
        h.absarc(0, 0, r1, a0, a1, false); h.absarc(0, 0, r0, a1 - gap * 0.3, a0 + gap * 0.3, true); h.closePath();
        sh.holes.push(h);
      }
    }
    const bv = o.bevel || 0;
    const g = new T.ExtrudeGeometry(sh, { depth: th - bv * 2, bevelEnabled: bv > 0, bevelThickness: bv, bevelSize: bv, bevelSegments: 1, curveSegments: o.seg || 6 });
    g.translate(0, 0, -(th - bv * 2) / 2);
    return g;
  }
  FX.gearGeo = gearGeo;
  function initDebris() {
    const g = gearGeo(0.16, 8, 0.05, { root: 0.78, bevel: 0, seg: 4, hole: 0 });   // r5: 모따기·구멍 없앰 (파편 1개 456 → 약 70 삼각형)
    const m = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.35 });
    dbMesh = new T.InstancedMesh(g, m, ND);
    dbMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    dbMesh.frustumCulled = false; dbMesh.castShadow = false; dbMesh.layers.set(1); dbMesh.count = 0;   // r5: 살아 있는 파편만 그림(앞으로 모아 씀) · 얼굴 컷인 창에는 안 그림
    dm.makeScale(0, 0, 0);
    for (let i = 0; i < ND; i++) { dbMesh.setMatrixAt(i, dm); dbMesh.setColorAt(i, dc.set(0xc9a23a)); }
    scene.add(dbMesh);
  }
  FX.debris = function (x, y, z, n, speed, big) {
    for (let k = 0; k < n; k++) {
      const i = db.i; db.i = (i + 1) % ND;
      const a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.9);
      db.p[i * 3] = x; db.p[i * 3 + 1] = y; db.p[i * 3 + 2] = z;
      db.v[i * 3] = Math.sin(a) * s; db.v[i * 3 + 1] = 3 + Math.random() * 6; db.v[i * 3 + 2] = Math.cos(a) * s;
      db.r[i * 3] = Math.random() * 6; db.r[i * 3 + 1] = Math.random() * 6; db.r[i * 3 + 2] = Math.random() * 6;
      db.w[i * 3] = (Math.random() - 0.5) * 16; db.w[i * 3 + 1] = (Math.random() - 0.5) * 16; db.w[i * 3 + 2] = (Math.random() - 0.5) * 16;
      db.life[i] = 1.2 + Math.random() * 0.9; db.s[i] = (big ? 1.25 : 1) * (0.6 + Math.random() * 0.8);   // r4: 큰 파편이 카메라 앞을 각지게 지나가지 않게 줄임
      db.c[i] = Math.random() < 0.6 ? 0xd9a441 : 0x3a3d45;
    }
  };

  // ---------- 충격 고리 ----------
  const rings = [];
  function initRings() {
    const g = new T.RingGeometry(0.93, 1, 56, 1);
    g.rotateX(-Math.PI / 2);
    const col = g.getAttribute('position'), c = new Float32Array(col.count * 3);
    for (let i = 0; i < col.count; i++) { const r = Math.hypot(col.getX(i), col.getZ(i)); const k = r > 0.965 ? 1 : 0; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    for (let i = 0; i < NR; i++) {
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false }));
      m.visible = false; m.renderOrder = 12; m.layers.set(1); scene.add(m);   // 층 1 = 얼굴 컷인 창에는 안 그림 (흰 고리가 창을 하얗게 덮지 않게)
      rings.push({ m, t: 0, dur: 0, r0: 0, r1: 0, k: 1 });
    }
  }
  let ri = 0;
  FX.ring = function (x, z, r0, r1, dur, col, power, y) {
    const o = rings[ri]; ri = (ri + 1) % NR;
    const c = COL[col] || COL.gold;
    o.m.material.color.setRGB(c[0], c[1], c[2]);
    o.m.position.set(x, y == null ? 0.12 : y, z);
    o.t = 0; o.dur = dur; o.r0 = r0; o.r1 = r1; o.k = power || 1; o.m.visible = true;
    o.m.scale.setScalar(r0);
  };

  // ---------- 호각 음파 (부채꼴 호) ----------
  const arcs = []; let arcHalf = -1, arcGeo = null, ai = 0;
  // r2: 앞으로 나가는 부채꼴 음파 — 굵은 앞머리 + 뒤따르는 잔물결 2줄 + 옅은 속 (바닥 고리 한 줄이 아니라 '소리의 띠')
  function arcGeometry(half) {
    const g = new T.RingGeometry(0.5, 1, 30, 16, -Math.PI / 2 - half, half * 2);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i)), a = Math.abs(Math.atan2(p.getX(i), p.getZ(i))) / half;
      const band = (r0, w) => Math.max(0, 1 - Math.abs(r - r0) / w);
      // r5: 앞머리를 두껍게(폭 0.045 → 0.075) + 잔물결 2줄 + 속 채움을 올려 「소리의 덩어리」가 보이게
      let k = band(0.955, 0.075) * 1.15 + band(0.8, 0.05) * 0.55 + band(0.66, 0.04) * 0.3 + GZ.sat((r - 0.5) / 0.5) * 0.12;
      k *= GZ.sat(1.3 - a * a * 1.1);
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
      p.setY(i, (r - 0.5) * 0.9);   // 앞머리가 들림 (낮은 카메라에서도 띠가 두껍게 보이게)
    }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    return g;
  }
  function initArcs() {
    for (let i = 0; i < NA; i++) {
      const m = new T.Mesh(undefined, new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false }));
      m.visible = false; m.renderOrder = 14; m.frustumCulled = false; m.layers.set(1); scene.add(m);
      arcs.push({ m, on: false });
    }
  }
  // 규칙 쪽 파동과 짝: 반환한 객체의 r(반지름)·k(밝기)를 규칙이 갱신
  // r5: 폭별 모양을 여러 개 들고 있음 (겹 음파는 조금씩 넓음). lift = 겹 번호(뒤 겹일수록 낮게)
  const arcGeos = {};
  FX.arc = function (x, z, ang, half, col, power, lift) {
    const key = half.toFixed(3);
    if (!arcGeos[key]) { arcGeos[key] = arcGeometry(half); const ks = Object.keys(arcGeos); if (ks.length > 12) { const old = arcGeos[ks[0]]; delete arcGeos[ks[0]]; if (!arcs.some((a) => a.m.geometry === old)) old.dispose(); } }
    const o = arcs[ai]; ai = (ai + 1) % NA;
    o.m.geometry = arcGeos[key];
    const c = COL[col] || COL.gold;
    o.c = c; o.power = power || 1;
    o.m.material.color.setRGB(c[0] * o.power, c[1] * o.power, c[2] * o.power);
    o.m.position.set(x, 0.95 - (lift || 0) * 0.22, z); o.m.rotation.y = ang; o.m.scale.setScalar(0.5); o.m.visible = true; o.on = true;
    return o;
  };

  // ---------- 호각 입 앞 음파 뿔 (쏠 때마다 입에서 앞으로 터져 나감) ----------
  const cones = []; let ci = 0;
  function initCones() {
    const g = new T.CylinderGeometry(0.5, 0.05, 1, 18, 4, true); g.rotateX(Math.PI / 2); g.translate(0, 0, 0.5);   // 좁은 끝이 입, 넓은 끝이 앞
    const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const k = Math.sin(GZ.sat(z) * Math.PI) * (0.35 + 0.65 * (Math.round(z * 4) % 2)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    for (let i = 0; i < NC; i++) {
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false }));
      m.visible = false; m.renderOrder = 15; m.layers.set(1); scene.add(m);
      cones.push({ m, t: 0, dur: 0.2, len: 2, c: COL.gold, k: 1 });
    }
  }
  FX.cone = function (x, y, z, ang, col, power, len) {
    const o = cones[ci]; ci = (ci + 1) % NC;
    o.c = COL[col] || COL.gold; o.k = power || 1; o.t = 0; o.len = len || 2.2; o.dur = 0.2;
    o.m.position.set(x, y, z); o.m.rotation.set(0.1, ang, 0, 'YXZ'); o.m.visible = true;
  };

  // ---------- 구르기 잔상 ----------
  const ghosts = []; let gi = 0;
  function initGhosts() {
    const g = new T.CapsuleGeometry(0.34, 0.75, 3, 8); g.rotateX(Math.PI / 2);
    for (let i = 0; i < NG; i++) {
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: new T.Color(0.42, 0.3, 0.12), transparent: true, opacity: 0, depthWrite: false, fog: false }));   // r8 (검토 B2): 흰·하늘 가산 유령 → 반투명 짙은 금(보통 섞기)
      m.visible = false; m.renderOrder = 9; scene.add(m);
      ghosts.push({ m, t: 0 });
    }
  }
  FX.ghost = function (x, z, face) {
    const o = ghosts[gi]; gi = (gi + 1) % NG;
    o.t = 0; o.m.position.set(x, 0.6, z); o.m.rotation.y = face; o.m.visible = true;
  };
  let _glint = null;
  FX.glintTex = function () {
    if (_glint) return _glint;
    _glint = GZ.R.canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 0, 32, 32, 30);
      // r5: 십자(사격 조준선처럼 읽힘) 대신 — 부드러운 빛 + 음파 고리 + 톱니 이빨 8개 (기계도시 톤)
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.4)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2.2; c.beginPath(); c.arc(32, 32, 19, 0, 6.2832); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 8; i++) { c.save(); c.translate(32, 32); c.rotate(i * 0.785 + 0.39); c.fillRect(-1.6, -27, 3.2, 5); c.restore(); }
    });
    return _glint;
  };
  FX.arcSet = function (o, r, fade) {
    if (!o || !o.on) return;
    o.m.scale.set(r, 1, r);
    const k = o.power * fade;
    o.m.material.color.setRGB(o.c[0] * k, o.c[1] * k, o.c[2] * k);
    if (fade <= 0.01) { o.m.visible = false; o.on = false; }
  };

  // ---------- 증기 ----------
  const puffs = []; let pi = 0;
  function initPuffs() {
    const tex = GZ.R.canvasTex(64, 64, (c) => {
      const g = c.createRadialGradient(32, 32, 2, 32, 32, 31);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    for (let i = 0; i < NP; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, color: 0xb8c0cc, transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false; s.renderOrder = 8; scene.add(s);
      puffs.push({ s, t: 0, dur: 1, vx: 0, vy: 0, vz: 0, s0: 1, s1: 2, a: 0.3 });
    }
  }
  FX.puff = function (x, y, z, vx, vy, vz, s0, s1, dur, alpha, color) {
    const o = puffs[pi]; pi = (pi + 1) % NP;
    o.s.position.set(x, y, z); o.vx = vx; o.vy = vy; o.vz = vz; o.s0 = s0; o.s1 = s1; o.dur = dur; o.t = 0; o.a = alpha == null ? 0.28 : alpha;
    o.s.material.color.set(color || 0xb8c0cc); o.s.visible = true;
  };

  // ---------- 바닥 예고 표시 ----------
  const tgs = [];
  let gLine, gDisc, gRingT, gConeCache = {};
  function initTG() {
    // r2: 속을 꽉 채운 단색 스티커가 아니라 '빛' — 가장자리는 밝은 테, 속은 옅게 번짐
    const shade = (g, f) => { const p = g.getAttribute('position'), c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = f(p.getX(i), p.getZ(i)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; } g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; };
    gLine = new T.PlaneGeometry(1, 1, 6, 1); gLine.rotateX(-Math.PI / 2); gLine.translate(0, 0, 0.5);
    shade(gLine, (x) => (Math.abs(x) > 0.41 ? 1.5 : 0.3 + Math.abs(x) * 0.5));
    gDisc = new T.RingGeometry(0.001, 1, 48, 8); gDisc.rotateX(-Math.PI / 2);
    shade(gDisc, (x, z) => { const r = Math.hypot(x, z); return r > 0.93 ? 1.7 : 0.16 + r * r * r * 0.5; });
    FX.shade = shade;
    gRingT = new T.RingGeometry(0.93, 1, 48); gRingT.rotateX(-Math.PI / 2);
    for (let i = 0; i < NT; i++) {
      const m = new T.Mesh(gLine, new T.MeshBasicMaterial({ color: 0xff3a22, vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
      const e = new T.Mesh(gRingT, new T.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
      m.visible = e.visible = false; m.renderOrder = 6; e.renderOrder = 7;
      scene.add(m); scene.add(e);
      tgs.push({ m, e, used: false });
    }
  }
  function grabTG() {
    for (const t of tgs) if (!t.used) { t.used = true; t.m.visible = true; t.e.visible = false; t.m.material.color.set(0xff4a1c); return t; }
    return null;
  }
  const noTG = { set() {}, free() {}, move() {} };
  function wrap(t, base) {
    if (!t) return noTG;
    return {
      // k: 0→1 (공격 직전일수록 진하게)
      set(k) { t.m.material.opacity = (base + 0.5 * k) * (0.82 + 0.18 * Math.sin(performance.now() * 0.03)); if (t.e.visible) t.e.scale.setScalar(Math.max(0.05, t.rad * k)); },
      move(x, z, ang) { t.m.position.x = x; t.m.position.z = z; t.e.position.x = x; t.e.position.z = z; if (ang != null) t.m.rotation.y = ang; },
      color(c) { t.m.material.color.set(c); },
      free() { t.used = false; t.m.visible = false; t.e.visible = false; },
    };
  }
  FX.tgLine = function (x, z, ang, len, w) {
    const t = grabTG(); if (!t) return noTG;
    t.m.geometry = gLine; t.m.position.set(x, 0.07, z); t.m.rotation.y = ang; t.m.scale.set(w, 1, len);
    return wrap(t, 0.12);
  };
  FX.tgCircle = function (x, z, r) {
    const t = grabTG(); if (!t) return noTG;
    t.m.geometry = gDisc; t.m.position.set(x, 0.07, z); t.m.rotation.y = 0; t.m.scale.set(r, 1, r);
    t.e.visible = true; t.e.position.set(x, 0.09, z); t.rad = r; t.e.scale.setScalar(0.05);
    return wrap(t, 0.1);
  };
  FX.tgCone = function (x, z, ang, r, half) {
    const t = grabTG(); if (!t) return noTG;
    const key = half.toFixed(2);
    if (!gConeCache[key]) { const g = new T.RingGeometry(0.001, 1, 24, 6, -Math.PI / 2 - half, half * 2); g.rotateX(-Math.PI / 2); FX.shade(g, (x, z) => { const r = Math.hypot(x, z), a = Math.abs(Math.atan2(x, z)) / half; return r > 0.93 || a > 0.93 ? 1.6 : 0.18 + r * r * 0.5; }); gConeCache[key] = g; }
    t.m.geometry = gConeCache[key]; t.m.position.set(x, 0.07, z); t.m.rotation.y = ang; t.m.scale.set(r, 1, r);
    return wrap(t, 0.14);
  };
  FX.clearTG = function () { for (const t of tgs) { t.used = false; t.m.visible = false; t.e.visible = false; } };

  // ---------- 떠오르는 숫자·글자 (DOM) ----------
  const texts = []; let ti = 0, box; const pj = { x: 0, y: 0, behind: false };
  function initTexts() {
    box = document.getElementById('fxText');
    for (let i = 0; i < 30; i++) {
      const el = document.createElement('div'); el.className = 'ft'; box.appendChild(el);
      texts.push({ el, t: 0, dur: 0, x: 0, y: 0, z: 0, on: false, w: 30, h: 20, ox: 0, oy: 0, seq: 0, down: 0 });
    }
  }
  // r4 글자 겹침 0: 글자마다 화면 상자(대략 크기)를 잡고, 먼저 뜬 글자·외침·띠 글자·컷인 창·콤보와 겹치면 빈 줄로 옮김. 피해 숫자는 좌우로 번갈아 뜸
  const FSZ = { '': 17, pf: 23, big: 28, hurt: 22, blk: 14, word: 20, off: 15, drain: 14 };
  let tseq = 0, tside = 1; const tact = [], tplaced = [];
  FX.text = function (x, y, z, str, cls, dur, fix) {
    if (!box) return;
    const o = texts[ti]; ti = (ti + 1) % texts.length;
    o.el.textContent = str; o.el.className = 'ft ' + (cls || '');
    tside = -tside;
    o.x = x; o.y = y; o.z = z; o.t = 0; o.dur = dur || 0.7; o.on = true; o.seq = ++tseq; o.oy = 0; o.down = 0;
    const S = (GZ.HUD && GZ.HUD.S) || 1, fs = (FSZ[cls || ''] || 17) * S; let w = 0;
    for (let i = 0; i < str.length; i++) w += str.charCodeAt(i) > 0x2e7f ? 1.0 : str[i] === ' ' ? 0.32 : 0.62;
    o.w = (w + (cls === 'word' || cls === 'off' ? str.length * 0.12 : 0.1)) * fs * 1.25 + 8; o.h = fs * 1.45 + 5;
    o.ox = fix ? 0 : tside * (o.w * 0.5 + 3 + Math.random() * 8);
    o.fixP = fix ? 1 : 0;
    o.el.style.opacity = '1';
    return o;
  };
  // r8 (검토 A·B): 같은 적의 연속 피해는 숫자 하나로 합침 — 떠 있는 글자의 내용만 바꾸고 다시 튀어 오르게 / 「정박 ×N」 새 글자가 뜨면 이전 것은 바로 지움
  FX.textSet = function (o, str, cls) {
    if (!o || !o.on) return false;
    o.el.textContent = str; if (cls != null) o.el.className = 'ft ' + cls;
    const S = (GZ.HUD && GZ.HUD.S) || 1, fs = (FSZ[cls != null ? cls : ''] || 17) * S;
    o.w = (str.length * 0.62 + 0.1) * fs * 1.25 + 8; o.t = Math.min(o.t, 0.04);
    return true;
  };
  FX.textKill = function (o) { if (o && o.on) { o.on = false; o.el.style.opacity = '0'; } };
  FX.textRects = () => tplaced.map((r) => Object.assign({}, r));

  // ---------- r3: 맞은 자리 별빛(짧게 번쩍) · 궁극기 바닥 충격파 · 바닥을 타고 퍼지는 불티 ----------
  const marks = []; let mi = 0;
  function initMarks() {
    for (let i = 0; i < 10; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: FX.glintTex(), color: 0xffe2a0, blending: T.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, fog: false }));
      sp.visible = false; sp.renderOrder = 22; scene.add(sp); marks.push({ sp, t: 0, s: 1 });
    }
  }
  FX.hitMark = function (x, y, z, size, white) {
    const o = marks[mi]; mi = (mi + 1) % marks.length;
    o.sp.position.set(x, y, z); o.t = 0; o.s = size || 1; o.sp.material.color.set(white ? 0xffffff : 0xffd27a); o.sp.material.rotation = Math.random() * 1.5; o.sp.visible = true;
  };
  const shocks = []; let shi = 0;
  function initShocks() {
    const g = new T.RingGeometry(0.62, 1, 72, 5); g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)), k = GZ.sat((r - 0.62) / 0.38); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k * k * k * (r > 0.985 ? 1.6 : 1); }
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    for (let i = 0; i < 2; i++) {
      const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide, fog: false }));
      m.visible = false; m.renderOrder = 13; m.layers.set(1); scene.add(m); shocks.push({ m, t: 0, r: 10 });
    }
  }
  FX.shock = function (x, z, r) { const o = shocks[shi]; shi = (shi + 1) % shocks.length; o.t = 0; o.r = r; o.m.position.set(x, 0.1, z); o.m.scale.setScalar(1); o.m.visible = true; };
  FX.ground = function (x, z, n, col, speed, size, life) {
    const c = COL[col] || COL.gold;
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, s = speed * (0.45 + Math.random() * 0.7); FX.spark(x + Math.sin(a) * 0.8, 0.12 + Math.random() * 0.25, z + Math.cos(a) * 0.8, Math.sin(a) * s, 0.4 + Math.random() * 1.2, Math.cos(a) * s, c[0], c[1], c[2], size * (0.7 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), 3); }
  };

  FX.init = function (sc) {
    scene = sc;
    initSparks(); initDebris(); initRings(); initArcs(); initCones(); initGhosts(); initPuffs(); initTG(); initTexts(); initMarks(); initShocks();
    FX.onResize();
  };
  FX.onResize = function () {
    if (!spMat || !GZ.R.camera) return;
    spMat.uniforms.uScale.value = (GZ.R.h * GZ.R.pr * 0.5) / Math.tan((GZ.R.camera.fov * Math.PI) / 360);
  };

  // 묶음 효과
  FX.explode = function (x, y, z, size) {   // size 0 드론 / 1 중형 / 2 보스 조각
    const s = size || 0;
    FX.burst(x, y, z, 14 + s * 10, 'ember', 9 + s * 4, 0.3 + s * 0.12, 0.5 + s * 0.15, 2);
    FX.burst(x, y, z, 8 + s * 6, 'white', 6 + s * 3, 0.22, 0.3, 1);
    FX.debris(x, y, z, 5 + s * 5, 6 + s * 3, s > 0);
    FX.ring(x, z, 0.4, 3 + s * 2.2, 0.32 + s * 0.1, 'gold', 1.2);
    FX.puff(x, y, z, 0, 1.2, 0, 1, 3 + s, 0.7, 0.22);
    GZ.R.flash(x, y + 0.8, z, 0.5 + s * 0.4);
    GZ.R.shake(0.22 + s * 0.3);
    GZ.R.pulse(0.1 + s * 0.15);
  };

  FX.update = function (dt) {
    // 불꽃
    let any = false;
    for (let i = 0; i < NS; i++) {
      if (sp.life[i] <= 0) { if (sp.size[i] !== 0) { sp.size[i] = 0; any = true; } continue; }
      any = true;
      sp.life[i] -= dt;
      const k = Math.max(0, sp.life[i] / sp.max[i]);
      const j = i * 3, dr = Math.exp(-dt * 2.2);
      sp.vel[j] *= dr; sp.vel[j + 2] *= dr; sp.vel[j + 1] = sp.vel[j + 1] * dr - sp.g[i] * dt;
      sp.pos[j] += sp.vel[j] * dt; sp.pos[j + 1] += sp.vel[j + 1] * dt; sp.pos[j + 2] += sp.vel[j + 2] * dt;
      if (sp.pos[j + 1] < 0.05) { sp.pos[j + 1] = 0.05; sp.vel[j + 1] *= -0.4; }
      sp.col[j] = sp.base[j] * k; sp.col[j + 1] = sp.base[j + 1] * k; sp.col[j + 2] = sp.base[j + 2] * k;
      sp.size[i] = sp.sz[i] * (0.5 + 0.5 * k);
    }
    if (any) { spGeo.attributes.position.needsUpdate = true; spGeo.attributes.aCol.needsUpdate = true; spGeo.attributes.aSize.needsUpdate = true; }
    // 파편 (r5: 살아 있는 것만 0번부터 모아 그림 → 그리는 삼각형이 파편 수만큼만)
    let dAny = false, dn = 0;
    for (let i = 0; i < ND; i++) {
      if (db.life[i] <= 0) continue;
      dAny = true;
      db.life[i] -= dt;
      const j = i * 3;
      db.v[j + 1] -= 22 * dt;
      db.p[j] += db.v[j] * dt; db.p[j + 1] += db.v[j + 1] * dt; db.p[j + 2] += db.v[j + 2] * dt;
      if (db.p[j + 1] < 0.06) { db.p[j + 1] = 0.06; db.v[j + 1] *= -0.38; db.v[j] *= 0.6; db.v[j + 2] *= 0.6; db.w[j] *= 0.5; db.w[j + 1] *= 0.5; db.w[j + 2] *= 0.5; }
      db.r[j] += db.w[j] * dt; db.r[j + 1] += db.w[j + 1] * dt; db.r[j + 2] += db.w[j + 2] * dt;
      let s = db.life[i] <= 0 ? 0 : db.s[i] * Math.min(1, db.life[i] * 3);
      { const cp = GZ.R.camera.position, cx = db.p[j] - cp.x, cy = db.p[j + 1] - cp.y, cz = db.p[j + 2] - cp.z, d2 = cx * cx + cy * cy + cz * cz; if (d2 < 30) s *= GZ.sat((d2 - 12) / 18); }   // r4: 카메라 코앞(5.5m 안)을 지나는 파편은 줄여 없앰 (화면을 크게 가리던 것)
      dq.setFromEuler(de.set(db.r[j], db.r[j + 1], db.r[j + 2]));
      dm.compose(dv.set(db.p[j], db.p[j + 1], db.p[j + 2]), dq, ds.set(s, s, s));
      dbMesh.setMatrixAt(dn, dm); dbMesh.setColorAt(dn, dc.set(db.c[i])); dn++;
    }
    dbMesh.count = dn;
    if (dAny) { dbMesh.instanceMatrix.needsUpdate = true; dbMesh.instanceColor.needsUpdate = true; }
    // 고리
    for (const o of rings) {
      if (!o.m.visible) continue;
      o.t += dt;
      const k = o.t / o.dur;
      if (k >= 1) { o.m.visible = false; continue; }
      const e = 1 - (1 - k) * (1 - k);
      o.m.scale.setScalar(GZ.lerp(o.r0, o.r1, e));
      o.m.material.opacity = (1 - k) * o.k;
    }
    for (const o of cones) {
      if (!o.m.visible) continue;
      o.t += dt; const k = o.t / o.dur;
      if (k >= 1) { o.m.visible = false; continue; }
      const e = 1 - (1 - k) * (1 - k), s = 0.35 + e * 0.9;
      o.m.scale.set(s, s * 0.8, o.len * (0.3 + e * 0.7));
      const f = (1 - k) * (1 - k) * o.k * 0.6; o.m.material.color.setRGB(o.c[0] * f, o.c[1] * f, o.c[2] * f);
    }
    for (const o of ghosts) {
      if (!o.m.visible) continue;
      o.t += dt; const k = o.t / 0.26;
      if (k >= 1) { o.m.visible = false; continue; }
      o.m.material.opacity = 0.22 * (1 - k); o.m.scale.set(1 - k * 0.3, 1 - k * 0.3, 1);
    }
    for (const o of marks) {
      if (!o.sp.visible) continue;
      o.t += dt; const k = o.t / 0.13;
      if (k >= 1) { o.sp.visible = false; continue; }
      const sc = o.s * (0.5 + k * 1.3); o.sp.scale.set(sc, sc, 1); o.sp.material.opacity = 1 - k * k;
    }
    for (const o of shocks) {
      if (!o.m.visible) continue;
      o.t += dt; const k = o.t / 0.55;
      if (k >= 1) { o.m.visible = false; continue; }
      const e = 1 - (1 - k) * (1 - k); o.m.scale.setScalar(1 + (o.r - 1) * e);
      const f = (1 - k) * 1.5; o.m.material.color.setRGB(1.3 * f, 0.85 * f, 0.25 * f);
    }
    // 증기
    for (const o of puffs) {
      if (!o.s.visible) continue;
      o.t += dt;
      const k = o.t / o.dur;
      if (k >= 1) { o.s.visible = false; continue; }
      o.s.position.x += o.vx * dt; o.s.position.y += o.vy * dt; o.s.position.z += o.vz * dt;
      const s = GZ.lerp(o.s0, o.s1, Math.sqrt(k));
      o.s.scale.set(s, s, 1);
      o.s.material.opacity = o.a * Math.min(1, k * 6) * (1 - k);
    }
    // 글자
    tact.length = 0; tplaced.length = 0;
    for (const o of texts) if (o.on) tact.push(o);
    if (tact.length) {
      tact.sort((p, q) => (q.fixP - p.fixP) || (p.seq - q.seq));   // r5: 판정 글자(정박·엇박·막힘)를 먼저 자리 잡고, 피해 숫자가 그것을 피함
      const S = GZ.HUD.S || 1, top = (GZ.EN.boss && !GZ.EN.boss.dead ? 168 : 124) * S, av = GZ.HUD.avoid ? GZ.HUD.avoid() : [], W = GZ.R.w;
      for (const o of tact) {
        o.t += dt;
        const k = o.t / o.dur;
        if (k >= 1) { o.on = false; o.el.style.opacity = '0'; continue; }
        GZ.R.project(o.x, o.y + k * 1.3, o.z, pj);
        // r7 (검토 A3·B4): 화면 밖 대상의 피해 숫자는 띄우지 않음 — 가장자리에 숫자 기둥이 쌓여 화살표를 덮던 것 (판정 글자는 그대로)
        if (o.t <= dt + 1e-6 && !o.fixP && (pj.behind || pj.x < 0 || pj.x > W || pj.y < 0 || pj.y > GZ.R.h)) { o.on = false; o.el.style.opacity = '0'; continue; }
        const hw = o.w / 2, hh = o.h / 2;
        let x = GZ.clamp(pj.x + o.ox, hw + 2, W - hw - 2), y = Math.max(pj.y, top + hh) + o.oy;   // HUD(위쪽 체력·보스 막대) 밑으로 들어가지 않게
        if (!pj.behind) {
          for (let tr = 0; tr < 10; tr++) {
            let r = null;
            for (const q of av) if (x + hw > q.l && x - hw < q.r && y + hh > q.t && y - hh < q.b) { r = q; break; }
            if (r) { const ny = r.b + hh + 1; o.oy += ny - y; y = ny; o.down = 1; continue; }   // 외침·띠·컷인·콤보 아래로
            for (const q of tplaced) if (x + hw > q.l && x - hw < q.r && y + hh > q.t && y - hh < q.b) { r = q; break; }
            if (!r) break;
            const ny = o.down || r.t - o.h - 1 < top ? r.b + hh + 1 : r.t - hh - 1;   // 위로 쌓고, 위가 막혀 있으면 아래로
            if (ny > y) o.down = 1;
            o.oy += ny - y; y = ny;
          }
          tplaced.push({ l: x - hw, r: x + hw, t: y - hh, b: y + hh });
        }
        const sc = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 1.2);
        o.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + sc.toFixed(2) + ')';
        o.el.style.opacity = pj.behind ? '0' : k > 0.7 ? ((1 - k) / 0.3).toFixed(2) : '1';
      }
    }
  };
})();
