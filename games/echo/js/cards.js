/* 톱니골 던전 — 리믹스 카드(레벨업 3택1) 10종 + 함께하는 친구 3종(POY 다이얼 링·WOAD 거품 자국·ROGUN 째깍 원판)
   sim = 규칙 계산(1/60초, 난수는 TG.sr 만) / draw = 그리기. 아이콘은 캔버스로 직접 그림 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const C = (TG.C = {});
  const MAXLV = 3;
  // name = 화면 글(두 단어 이하), tag = 함께하는 친구 이름
  C.DEFS = [
    { id: 'size', name: '파동 크게', col: '#e5352b' },
    { id: 'fast', name: '파동 빠르게', col: '#ff8a5b' },
    { id: 'more', name: '파동 +1', col: '#ffc21f' },
    { id: 'move', name: '이동 빠르게', col: '#4fc3f7' },
    { id: 'magnet', name: '줍기 자석', col: '#ff6fae' },
    { id: 'heart', name: '소리 +1', col: '#ff5a4a' },
    { id: 'charge', name: '충전 빠르게', col: '#ffd23f' },
    { id: 'poy', name: '다이얼 링', tag: 'POY', col: '#00FF00' },
    { id: 'woad', name: '거품 자국', tag: 'WOAD', col: '#FF6F61' },
    { id: 'rogun', name: '째깍 원판', tag: 'ROGUN', col: '#3D7BFF' },
  ];
  C.byId = {}; C.DEFS.forEach((d) => (C.byId[d.id] = d));
  C.MAXLV = MAXLV;

  C.reset = function () {
    const G = TG.G;
    G.cards = {};
    C.poyA = 0; C.poyBossCd = 0; C.trail = []; C.lastX = null; C.lastZ = null; C.woadBossCd = 0;
    C.recalc();
  };
  C.lv = (id) => (TG.G.cards[id] || 0);
  // 카드 단계 → 실제 값
  C.recalc = function () {
    const G = TG.G, P = TG.PL;
    G.mod = { size: C.lv('size'), fast: C.lv('fast'), more: C.lv('more'), magnet: C.lv('magnet') * 2.2, charge: 1 + C.lv('charge') * 0.3 };
    if (P) P.spdMul = 1 + C.lv('move') * 0.1;
  };
  // 3장 뽑기 (다 찬 카드는 빼고)
  C.offer = function () {
    const av = C.DEFS.filter((d) => C.lv(d.id) < MAXLV).map((d) => d.id);
    const out = [];
    while (out.length < 3 && av.length) out.push(av.splice((TG.sr() * av.length) | 0, 1)[0]);
    return out;
  };
  C.apply = function (id) {
    const G = TG.G, P = TG.PL;
    G.cards[id] = Math.min(MAXLV, C.lv(id) + 1);
    if (id === 'heart') { P.maxHp++; P.hp = Math.min(P.maxHp, P.hp + 1); }
    C.recalc();
  };

  // ── 규칙 계산: 함께하는 친구 3종 ──
  const POY_R = 2.7;
  C.sim = function (dt, P, G) {
    const F = TG.F, list = F.list, b = F.boss && F.boss.state === 'fight' ? F.boss : null;
    // POY 다이얼 링: 몸 둘레를 도는 초록 고리가 닿은 안개를 톡
    const pl = C.lv('poy');
    if (pl > 0) {
      C.poyA += dt * (2.2 + pl * 0.3); C.poyBossCd -= dt;
      const n = pl + 1;
      for (let i = 0; i < n; i++) {
        const a = C.poyA + (i / n) * Math.PI * 2, ox = P.x + Math.sin(a) * POY_R, oz = P.z + Math.cos(a) * POY_R;
        for (let j = 0; j < list.length; j++) {
          const u = list[j];
          if (u.state !== 'live' || u.kind === 'cocoon' || u.spawnT < 0.3 || u.poyCd > 0) continue;
          const rr = u.r * u.scale + 0.55;
          if ((u.x - ox) ** 2 + (u.z - oz) ** 2 < rr * rr) { u.poyCd = 0.9; G.hitUnit(u, 1, P.x, P.z, true, 0, [0.4, 2.2, 0.4]); }
        }
        if (b && C.poyBossCd <= 0 && Math.hypot(b.x - ox, b.z - oz) < b.r * b.scale + 0.5) { C.poyBossCd = 0.6; G.hitBoss(1, ox, oz, true, 0); }
      }
    }
    // WOAD 거품 자국: 지나간 길에 코랄 거품이 남고, 안개가 닿으면 퐁
    const wl = C.lv('woad');
    if (wl > 0) {
      C.woadBossCd -= dt;
      if (C.lastX == null) { C.lastX = P.x; C.lastZ = P.z; }
      if ((P.x - C.lastX) ** 2 + (P.z - C.lastZ) ** 2 > 1.3 * 1.3 && !P.airborne) {
        C.lastX = P.x; C.lastZ = P.z;
        C.trail.push({ x: P.x, z: P.z, t: 0, ph: TG.sr() * 6.28 });
        if (C.trail.length > 6 + wl * 4) C.trail.shift();
      }
      const life = 2.4 + wl * 0.8;
      for (let i = 0; i < C.trail.length; i++) {
        const q = C.trail[i]; q.t += dt;
        let gone = q.t > life;
        if (!gone && q.t > 0.25) {
          for (let j = 0; j < list.length; j++) {
            const u = list[j];
            if (u.state !== 'live' || u.kind === 'cocoon' || u.spawnT < 0.3) continue;
            const rr = u.r * u.scale + 0.65;
            if ((u.x - q.x) ** 2 + (u.z - q.z) ** 2 < rr * rr) { G.hitUnit(u, wl >= 3 ? 2 : 1, q.x, q.z, true, 0, [2.3, 0.9, 0.75]); gone = true; break; }
          }
          if (!gone && b && C.woadBossCd <= 0 && Math.hypot(b.x - q.x, b.z - q.z) < b.r * b.scale + 0.5) { C.woadBossCd = 0.4; G.hitBoss(1, q.x, q.z, true, 0); gone = true; }
          if (gone) TG.FX.popBurst(q.x, 0.5, q.z, 0.7, [2.2, 0.95, 0.8]);
        }
        if (gone) { C.trail.splice(i, 1); i--; }
      }
    }
    // ROGUN 째깍 원판: 파란 원 안의 안개는 느려짐
    const rl = C.lv('rogun');
    if (rl > 0) {
      const R = C.rogunR(rl), k = [1, 0.8, 0.68, 0.58][rl];
      for (let j = 0; j < list.length; j++) { const u = list[j]; u.slowK = (u.x - P.x) ** 2 + (u.z - P.z) ** 2 < R * R ? k : 1; }
      if (F.boss) F.boss.slowK = Math.hypot(F.boss.x - P.x, F.boss.z - P.z) < R + 2 ? Math.max(0.7, k) : 1;
    }
  };
  C.rogunR = (lv) => 3.6 + lv * 0.9;

  // ── 그리기 ──
  C.init = function (scene) {
    // POY: 초록 다이얼 고리 (최대 4개) + 바닥 길
    C.poyMesh = [];
    const dg = T.BufferGeometryUtils.mergeGeometries([new T.TorusGeometry(0.42, 0.12, 8, 22), (() => { const g = new T.BoxGeometry(0.1, 0.34, 0.1); g.translate(0, 0.2, 0); return g; })()].map((g) => g.toNonIndexed()));
    const dm = new T.MeshBasicMaterial({ color: new T.Color(0x00ff00).multiplyScalar(1.5) });
    for (let i = 0; i < 4; i++) { const m = new T.Mesh(dg, dm); m.visible = false; scene.add(m); TG.R.addOutline(m, 0.8); C.poyMesh.push(m); }
    C.poyPath = new T.Mesh(new T.RingGeometry(POY_R - 0.06, POY_R + 0.06, 56), new T.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4, depthWrite: false }));
    C.poyPath.rotation.x = -Math.PI / 2; C.poyPath.position.y = 0.07; C.poyPath.renderOrder = 4; C.poyPath.visible = false; scene.add(C.poyPath);
    // WOAD: 코랄 거품 (인스턴스)
    C.woadMesh = new T.InstancedMesh(new T.SphereGeometry(0.5, 12, 9), TG.R.toon({ color: 0xff6f61, rim: 0.9, spec: 0.7, sat: 1.15, gain: 1.15 }), 20);
    C.woadMesh.count = 0; C.woadMesh.frustumCulled = false; C.woadMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(C.woadMesh); TG.R.addOutline(C.woadMesh, 0.8);
    // ROGUN: 파란 째깍 원판 (바닥)
    const g = new T.PlaneGeometry(2, 2); g.rotateX(-Math.PI / 2);
    C.rogunMesh = new T.Mesh(g, new T.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: ['uniform float uT; uniform float uA; varying vec2 vUv;',
        'void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard; float an = atan(p.x, p.y);',
        ' float rim = smoothstep(0.92, 0.95, r) * (1.0 - smoothstep(0.985, 1.0, r));',
        ' float tk = step(0.8, r) * step(r, 0.92) * step(0.86, cos(an * 12.0));',
        ' float hand = step(r, 0.78) * smoothstep(0.985, 0.995, cos(an - uT * 1.6)) + step(r, 0.5) * smoothstep(0.98, 0.992, cos(an - uT * 0.25));',
        ' float a = (0.13 + rim * 0.75 + tk * 0.6 + hand * 0.55) * uA; gl_FragColor = vec4(vec3(0.24, 0.48, 1.0) * (1.0 + rim * 0.9 + tk * 0.6 + hand * 0.7), a); }'].join('\n'),
      transparent: true, depthWrite: false,
    }));
    C.rogunMesh.position.y = 0.055; C.rogunMesh.renderOrder = 3; C.rogunMesh.visible = false; C.rogunMesh.frustumCulled = false; scene.add(C.rogunMesh);
  };
  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(), tmpP = new T.Vector3();
  C.draw = function (dt, t, P) {
    const on = P.root.visible && TG.G.phase !== 'title';
    const pl = on ? C.lv('poy') : 0, n = pl ? pl + 1 : 0;
    C.poyMesh.forEach((m, i) => {
      const v = i < n; m.visible = v; m.userData.outline.visible = v;
      if (!v) return;
      const a = C.poyA + (i / n) * Math.PI * 2;
      m.position.set(P.rx + Math.sin(a) * POY_R, 1.15 + Math.sin(t * 5 + i) * 0.12, P.rz + Math.cos(a) * POY_R);
      m.rotation.set(-0.75, 0, t * 4 + i); // 카메라 쪽으로 눕혀 고리 모양이 보이게
      m.userData.outline.position.copy(m.position); m.userData.outline.rotation.copy(m.rotation);
      if (TG.fr() < 0.35) TG.FX.emit(TG.FX.CELL.sparkle, m.position.x, m.position.y, m.position.z, { life: 0.25, size: 0.35, size1: 0, color: [0.5, 2.4, 0.5] });
    });
    C.poyPath.visible = n > 0; if (n) C.poyPath.position.set(P.rx, 0.07, P.rz);
    // WOAD
    let k = 0;
    const wl = on ? C.lv('woad') : 0, life = 2.4 + wl * 0.8;
    if (wl) for (const q of C.trail) {
      if (k >= 20) break;
      const s = (q.t < 0.25 ? TG.easeOutBack(q.t / 0.25) : q.t > life - 0.4 ? Math.max(0.05, (life - q.t) / 0.4) : 1) * (1 + Math.sin(t * 4 + q.ph) * 0.07);
      tmpM.compose(tmpP.set(q.x, 0.5 + Math.sin(t * 3 + q.ph) * 0.07, q.z), tmpQ.identity(), tmpS.set(s, s, s));
      C.woadMesh.setMatrixAt(k++, tmpM);
    }
    C.woadMesh.count = k; C.woadMesh.userData.outline.count = k; C.woadMesh.instanceMatrix.needsUpdate = true;
    // ROGUN
    const rl = on ? C.lv('rogun') : 0, u = C.rogunMesh.material.uniforms;
    u.uA.value = TG.damp(u.uA.value, rl ? 1 : 0, 6, dt); u.uT.value = t;
    C.rogunMesh.visible = u.uA.value > 0.02;
    if (rl) { const R = C.rogunR(rl); C.rogunMesh.scale.set(R, 1, R); }
    C.rogunMesh.position.set(P.rx, 0.055, P.rz);
  };

  // ── 아이콘 (캔버스에 직접 그림, 128 기준) ──
  const INK = '#1b1424';
  function ol(c, fill, w) { c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = w || 7; c.strokeStyle = INK; c.stroke(); if (fill) { c.fillStyle = fill; c.fill(); } }
  function arc3(c, x, y, r0, dr, half, col, w) { // 소리 파동 호 3겹
    for (let i = 2; i >= 0; i--) {
      c.beginPath(); c.arc(x, y, r0 + dr * i, -half, half);
      c.lineCap = 'round'; c.lineWidth = (w || 11) + 6; c.strokeStyle = INK; c.stroke();
      c.lineWidth = w || 11; c.strokeStyle = i === 2 ? col : i === 1 ? '#ff8a5b' : '#fff'; c.stroke();
    }
  }
  function note(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.beginPath(); c.ellipse(-6, 12, 9, 7, -0.4, 0, 6.3); ol(c, col, 5);
    c.beginPath(); c.moveTo(2, 12); c.lineTo(2, -16); c.quadraticCurveTo(14, -12, 14, -2); c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 4; c.strokeStyle = col; c.stroke();
    c.restore();
  }
  function plus(c, x, y, s, txt) {
    c.font = '900 ' + s + 'px -apple-system, "Apple SD Gothic Neo", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = INK; c.strokeText(txt, x, y); c.fillStyle = '#fff'; c.fillText(txt, x, y);
  }
  const ICON = {
    size(c) { arc3(c, 30, 64, 26, 24, 1.0, '#e5352b', 12); },
    fast(c) {
      arc3(c, 44, 64, 22, 19, 0.8, '#ff8a5b', 10);
      [[38, 12], [26, 16], [38, 20]].forEach(([y, x0]) => { c.beginPath(); c.moveTo(x0 - 8, y * 2.2 - 24); c.lineTo(x0 + 16, y * 2.2 - 24); c.lineWidth = 12; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke(); });
    },
    more(c) {
      arc3(c, 66, 50, 14, 14, 0.8, '#ffc21f', 8);
      c.save(); c.translate(128, 128); c.rotate(Math.PI); arc3(c, 66, 50, 14, 14, 0.8, '#ffc21f', 8); c.restore();
      plus(c, 64, 64, 34, '+1');
    },
    move(c) { // 운동화 + 바람 줄
      c.beginPath(); c.moveTo(40, 52); c.lineTo(62, 50); c.quadraticCurveTo(70, 70, 100, 72); c.quadraticCurveTo(116, 76, 112, 90); c.lineTo(40, 90); c.closePath(); ol(c, '#4fc3f7', 8);
      c.beginPath(); c.moveTo(40, 82); c.lineTo(112, 82); c.lineWidth = 6; c.strokeStyle = '#fff'; c.stroke();
      [[10, 54, 30], [4, 68, 26], [12, 82, 22]].forEach(([x, y, l]) => { c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.lineWidth = 11; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#fff'; c.stroke(); });
    },
    magnet(c) { // 말굽 자석 + 음표
      c.beginPath(); c.arc(64, 62, 34, Math.PI, 0); c.lineTo(98, 100); c.lineTo(78, 100); c.lineTo(78, 62); c.arc(64, 62, 14, 0, Math.PI, true); c.lineTo(50, 100); c.lineTo(30, 100); c.closePath(); ol(c, '#ff5a8a', 8);
      c.fillStyle = '#fff'; c.fillRect(33, 86, 14, 11); c.fillRect(81, 86, 14, 11);
      note(c, 64, 28, 0.9, '#ffd23f');
    },
    heart(c) { // 말풍선 + 소리 줄 + 1
      c.beginPath(); c.moveTo(20, 30); c.quadraticCurveTo(20, 18, 34, 18); c.lineTo(94, 18); c.quadraticCurveTo(108, 18, 108, 30); c.lineTo(108, 68); c.quadraticCurveTo(108, 80, 94, 80); c.lineTo(58, 80); c.lineTo(40, 100); c.lineTo(42, 80); c.lineTo(34, 80); c.quadraticCurveTo(20, 80, 20, 68); c.closePath(); ol(c, '#ff5a4a', 8);
      plus(c, 64, 50, 40, '+1');
    },
    charge(c) { // 큰 소리 버튼 + 번개
      c.beginPath(); c.arc(64, 64, 42, 0, 6.3); ol(c, '#ffd23f', 8);
      c.beginPath(); c.arc(64, 64, 42, -1.57, 2.6); c.lineWidth = 9; c.strokeStyle = '#fff'; c.stroke();
      c.beginPath(); c.moveTo(72, 30); c.lineTo(46, 68); c.lineTo(62, 68); c.lineTo(54, 98); c.lineTo(84, 56); c.lineTo(66, 56); c.closePath(); ol(c, '#e5352b', 7);
    },
    poy(c) { // 초록 다이얼 고리
      c.beginPath(); c.arc(64, 64, 40, 0, 6.3); c.lineWidth = 22; c.strokeStyle = INK; c.stroke(); c.lineWidth = 13; c.strokeStyle = '#00FF00'; c.stroke();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.beginPath(); c.moveTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36); c.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
      c.beginPath(); c.arc(64, 64, 13, 0, 6.3); ol(c, '#e5352b', 6);
      c.beginPath(); c.arc(64 + 40 * 0.7, 64 - 40 * 0.7, 10, 0, 6.3); ol(c, '#fff', 6);
    },
    woad(c) { // 코랄 거품 자국
      [[30, 92, 12], [52, 74, 16], [82, 52, 24]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, 6.3); ol(c, '#FF6F61', 7); c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.18, -0.7, 0, 6.3); c.fillStyle = '#fff'; c.fill(); });
    },
    rogun(c) { // 파란 째깍 원판
      c.beginPath(); c.arc(64, 64, 44, 0, 6.3); ol(c, '#3D7BFF', 8);
      c.beginPath(); c.arc(64, 64, 33, 0, 6.3); c.fillStyle = '#dfe9ff'; c.fill();
      for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; c.beginPath(); c.moveTo(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26); c.lineTo(64 + Math.cos(a) * 31, 64 + Math.sin(a) * 31); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); }
      c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 40); c.moveTo(64, 64); c.lineTo(82, 72); c.lineWidth = 7; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.arc(64, 64, 5, 0, 6.3); c.fillStyle = '#e5352b'; c.fill();
    },
    // 쉼터 고르기용
    shield(c) { c.beginPath(); c.arc(64, 64, 42, 0, 6.3); ol(c, 'rgba(143,220,255,0.9)', 8); c.beginPath(); c.ellipse(48, 46, 12, 7, -0.7, 0, 6.3); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.arc(64, 70, 14, 0, 6.3); ol(c, '#e5352b', 6); },
    notes(c) { note(c, 44, 70, 1.5, '#ffd23f'); note(c, 84, 56, 1.2, '#ffb21a'); },
  };
  ICON.heal = function (c) { // 말풍선 3칸이 다 참
    [[34, 44], [64, 44], [94, 44]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x - 13, y - 14); c.lineTo(x + 13, y - 14); c.quadraticCurveTo(x + 17, y - 14, x + 17, y - 9); c.lineTo(x + 17, y + 8); c.quadraticCurveTo(x + 17, y + 13, x + 13, y + 13); c.lineTo(x, y + 13); c.lineTo(x - 8, y + 24); c.lineTo(x - 7, y + 13); c.lineTo(x - 13, y + 13); c.quadraticCurveTo(x - 17, y + 13, x - 17, y + 8); c.lineTo(x - 17, y - 9); c.quadraticCurveTo(x - 17, y - 14, x - 13, y - 14); c.closePath(); ol(c, '#ff5a4a', 6); });
    c.beginPath(); c.moveTo(64, 78); c.lineTo(64, 110); c.moveTo(50, 96); c.lineTo(64, 80); c.lineTo(78, 96); c.lineWidth = 13; c.strokeStyle = INK; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#8cf06a'; c.stroke();
  };
  C.icon = function (id, canvas) {
    const c = canvas.getContext('2d'), S = canvas.width;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
    c.setTransform(S / 128, 0, 0, S / 128, 0, 0);
    if (ICON[id]) ICON[id](c);
  };
})();
