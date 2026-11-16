/* 톱니골 던전 — 「소리 파동」: 「소리」 버튼을 누르는 동안 나가는 호 3겹(겨눈 방향), 관통. update = 규칙 계산 / draw = 그리기
   11-16 대표 지시(밸런스 개편): 기본 소리는 주인공 넷 모두 같은 파형(WV.LV 한 표 — 범위·위력·간격 같음). 주인공마다 색·곁 알갱이·소리만 다름(heroes.js style):
     세포 「소리 방울」 빨강·음표 / 허조교 「삑!」 올리브·음표+출발 삑 / 모쉬 「픽셀 빛줄」 시안·픽셀 점(호 끝에 네모 점) / 베리 「베리 방울」 핑크·꽃(파동이 끝난 자리에 작은 꽃 자국)
   큰 소리 「픽셀 빔!」(모쉬, WV.beam): 큐브 머리에서 앞·왼·오·뒤 4방향 빛줄기가 촥 펼쳐지고(1초) → 샥 한 바퀴 반 돌며(0.75초) 닿는 안개 전부 퐁(큰 소리 판정 99). 게임 흐름은 js/game.js bigBeam */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const WV = (TG.WV = { list: [], pending: [] });
  // 단계별 값 (0 = 기본, 1~3 = 모으기) — 주인공 넷 공통(11-16 대표: 누구를 골라도 비슷하게)
  WV.LV = [
    { range: 8.2, speed: 17, half: 0.5, dmg: 1, h: 1.8, band: 0.95, cd: 0.42 },
    { range: 9.0, speed: 17.5, half: 0.58, dmg: 2, h: 2.1, band: 1.1, cd: 0.5 },
    { range: 10.0, speed: 18.5, half: 0.68, dmg: 3, h: 2.5, band: 1.25, cd: 0.56 },
    { range: 11.5, speed: 19.5, half: 0.8, dmg: 5, h: 3.0, band: 1.45, cd: 0.62 },
  ];
  let id = 1;
  const DEF_STYLE = { in: 0xff8a5b, out: 0xe5352b, edge: [0.62, 0.08, 0.08], cell: 'note', spark: [2.5, 1.2, 0.8] };
  const style = () => (TG.hero && TG.hero.style) || DEF_STYLE;

  function bandGeo(half) {
    const S = 24, V = 6, pos = [], uv = [], idx = [];
    for (let j = 0; j <= V; j++) for (let i = 0; i <= S; i++) {
      const th = -half + (2 * half * i) / S, yv = -0.5 + j / V;
      const rf = 1 + yv * 0.14; // 살짝만 바깥으로 기운 얇은 띠 → 「)))」 리본으로 읽힘
      pos.push(Math.sin(th) * rf, yv, Math.cos(th) * rf);
      uv.push(i / S, j / V);
    }
    for (let j = 0; j < V; j++) for (let i = 0; i < S; i++) {
      const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  function waveMat() {
    return new T.ShaderMaterial({
      uniforms: { uA: { value: 1 }, uIn: { value: new T.Color(0xff8a5b) }, uOut: { value: new T.Color(0xe5352b) }, uEdge: { value: new T.Color(0.62, 0.08, 0.08) }, uGold: { value: 0 }, uPix: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uA; uniform vec3 uIn; uniform vec3 uOut; uniform vec3 uEdge; uniform float uGold; uniform float uPix; varying vec2 vUv;',
        'void main(){ float x = vUv.x * 2.0 - 1.0, y = vUv.y * 2.0 - 1.0;',
        ' if (uPix > 0.5) { x = (floor(x * 9.0) + 0.5) / 9.0; y = (floor(y * 4.0) + 0.5) / 4.0; }', // 모쉬: 네모 칸으로 계단진 픽셀 파형
        ' float hh = 1.0 - pow(abs(x), 2.6) * 0.85;',          // 끝으로 갈수록 가늘어지는 초승달
        ' float d = abs(y) / max(hh, 0.05);',
        ' if (d > 1.0) discard;',
        ' vec3 fill = mix(uIn, uOut, smoothstep(0.15, 0.75, d));',   // 가운데 밝은 색 → 바깥 대표색
        ' fill = mix(fill, vec3(1.15, 0.95, 0.35), uGold * (1.0 - smoothstep(0.0, 0.5, d)));',
        ' vec3 col = mix(vec3(1.12, 1.08, 1.0), fill, smoothstep(0.10, 0.2, d));',   // 가운데 흰 심지 한 줄
        ' col = mix(col, uEdge, smoothstep(0.74, 0.8, d));',        // 짙은 테
        ' col = mix(col, vec3(1.25, 1.2, 1.1), smoothstep(0.86, 0.9, d));',          // 바깥 흰 테 (빨간 타일 위에서도 읽히게)
        ' float a = uA * (1.0 - smoothstep(0.96, 1.0, d)) * (1.0 - smoothstep(0.85, 1.0, abs(x)));',
        ' if (!(a >= 0.01)) discard; gl_FragColor = vec4(col, min(a, 1.0)); }'].join('\n'),
      transparent: true, depthWrite: false, side: T.DoubleSide,
    });
  }

  const SIZES = [1, 1.15, 1.3, 1.45]; // 「파동 크게」 카드 단계
  WV.init = function (scene) {
    WV.geos = WV.LV.map((l) => SIZES.map((k) => bandGeo(Math.min(1.25, l.half * (1 + (k - 1) * 0.8)))));
    WV.pool = [];
    for (let i = 0; i < 18; i++) {
      const g = new T.Group(); g.visible = false; scene.add(g);
      const parts = [];
      for (let k = 0; k < 3; k++) { const m = new T.Mesh(WV.geos[0][0], waveMat()); m.renderOrder = 15 - k; m.frustumCulled = false; g.add(m); parts.push(m); }
      WV.pool.push({ g, parts, on: false });
    }
    // 모쉬 「픽셀 빔!」: 시안 빛줄기 4개(앞·왼·오·뒤) — 길쭉한 상자 + 밝은 심지
    const R = TG.R;
    const bmMat = R.toon({ color: 0x2fe0f0, gain: 1.5, rim: 0.6, spec: 0.3, emissive: 0x0a6a74, ei: 0.9 }), coreMat = new T.MeshBasicMaterial({ color: 0xeafeff, transparent: true, opacity: 0.95 });
    const bg = new T.Group(); bg.visible = false; scene.add(bg);
    const arms = [];
    for (let k = 0; k < 4; k++) {
      const arm = new T.Group(); arm.rotation.y = k * Math.PI / 2; bg.add(arm);
      const box = new T.Mesh(new T.BoxGeometry(0.6, 0.6, 1), bmMat); box.position.z = 0.5; box.renderOrder = 14; arm.add(box); R.addOutline(box, 1.0).renderOrder = 14;
      const core = new T.Mesh(new T.BoxGeometry(0.22, 0.22, 1), coreMat); core.position.z = 0.5; core.renderOrder = 15; arm.add(core);
      arms.push(arm);
    }
    WV.beam = { on: false, g: bg, arms, t: 0, x: 0, z: 0, dir: 0, len: 0, lv: 0, hit: new Set(), pops: 0, spins: 0 };
    WV.beamPops = 0;
  };
  WV.reset = function () { WV.pool.forEach((w) => { w.on = false; w.g.visible = false; }); WV.pending.length = 0; id = 1; if (WV.beam) { WV.beam.on = false; WV.beam.g.visible = false; WV.beam.hit.clear(); } WV.beamPops = 0; WV.flowers = 0; };
  WV.activeCount = () => WV.pool.filter((w) => w.on).length;

  // 단계 + 카드 효과를 합친 실제 값
  WV.stat = function (level) {
    const B = WV.LV[level], m = TG.G.mod || { size: 0, fast: 0 };
    const k = SIZES[m.size];
    return { range: B.range * k, speed: B.speed * (1 + m.size * 0.05), half: Math.min(1.25, B.half * (1 + (k - 1) * 0.8)), dmg: B.dmg, h: B.h * (1 + m.size * 0.1), band: B.band * k, cd: B.cd * [1, 0.88, 0.78, 0.7][m.fast], sizeLv: m.size };
  };

  // 가장 가까운 대상 찾기(시험 봇·시험용 자동 누름 전용 — 사람 조작은 겨눈 방향으로만 나감): 사거리 안 가장 가까운 안개·기계(행진 중인 째깍이)·보스. 거리가 같으면 id 가 작은 것. 고치·춤추는 째깍이·사람은 대상이 아님
  WV.target = function (x, z, range) {
    let best = null, bd = range * range;
    for (const u of TG.F.list) {
      if (u.state !== 'live' || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
      const d = (u.x - x) ** 2 + (u.z - z) ** 2;
      if (d < bd - 1e-9 || (best && Math.abs(d - bd) <= 1e-9 && u.id < best.id)) { bd = d; best = u; }
    }
    const b = TG.F.boss;
    if (b && b.state === 'fight') { const d = Math.max(0, Math.hypot(b.x - x, b.z - z) - b.r * b.scale * 0.8) ** 2; if (d < bd - 1e-9) { bd = d; best = { boss: true, id: 1e9, x: b.x, z: b.z }; } }
    return best;
  };

  // 파동 내보내기. n = 한 번에 나가는 수(「파동 +1」 카드): 조준 방향부터 둥글게 고르게. 소리만 주인공마다 다름(규칙은 같음)
  WV.fire = function (dir, level, n) {
    const P = TG.PL, st = style();
    n = n || 1;
    P.fireAnim(dir, level);
    for (let i = 0; i < n; i++) WV.pending.push({ t: 0.05, dir: dir + (i / n) * Math.PI * 2, level });
    if (st.flowers) { TG.A.play('sfx_pop', { rate: 1.5 + level * 0.1 + TG.fra(-0.05, 0.05), gain: 0.4 + level * 0.1 }); TG.A.play('sfx_wave', { rate: 1.2 + level * 0.08, gain: 0.4 + level * 0.1 }); } // 베리: 퐁 + 파동 높게
    else if (st.beep) { TG.A.countBeep(true); TG.A.play('sfx_wave', { rate: 1.7 + level * 0.12, gain: 0.35 + level * 0.1 }); } // 허조교: 출발 삑 + 파동 샘플 높게
    else if (st.pixel) { TG.A.play('sfx_pick', { rate: 1.9 + level * 0.1, gain: 0.28 }); TG.A.play('sfx_wave', { rate: 1.3 + level * 0.1, gain: 0.3 + level * 0.08 }); } // 모쉬: 삐빅 + 파동
    else TG.A.wave(level);
    if (level >= 2) { TG.FX.shake(0.12 + level * 0.05); TG.FX.punch(0.015 * level); }
  };

  function launch(dir, level) {
    const w = WV.pool.find((q) => !q.on); if (!w) return;
    const P = TG.PL, L = WV.stat(level), st = style();
    const ox = P.x + Math.sin(dir) * 0.45, oz = P.z + Math.cos(dir) * 0.45;
    Object.assign(w, { on: true, id: id++, x: ox, z: oz, dir, level, L, t: 0, r: 0.5, pr: 0.5, fade: 1, hit: new Set(), done: false, st, flowered: false });
    w.g.visible = true; w.g.position.set(ox, 1.6 + (level * 0.12), oz); w.g.rotation.y = dir;
    w.parts.forEach((m) => {
      m.geometry = WV.geos[level][L.sizeLv];
      const U = m.material.uniforms;
      U.uGold.value = level === 3 ? 1 : 0; U.uA.value = 0; U.uPix.value = st.pixel ? 1 : 0;
      U.uIn.value.set(st.in); U.uOut.value.set(st.out); U.uEdge.value.setRGB(st.edge[0], st.edge[1], st.edge[2]);
    });
    // 입 앞 반짝 + 주인공마다 다른 알갱이(음표·꽃·픽셀 점)
    const mx = P.x + Math.sin(dir) * 1.2, mz = P.z + Math.cos(dir) * 1.2, FX = TG.FX, cell = FX.CELL[st.cell] != null ? FX.CELL[st.cell] : FX.CELL.note;
    const c1 = st.spark, c2 = [c1[0] * 0.96, c1[1] * 0.9, c1[2] * 0.9];
    FX.emit(FX.CELL.glow, mx, 1.15, mz, { life: 0.12, size: 1.2 + level * 0.4, size1: 1.8 + level * 0.5, color: [c1[0] * 0.75, c1[1] * 0.75, c1[2] * 0.75], alpha: 0.4 });
    for (let i = 0; i < 3 + level * 2; i++) {
      const a = dir + TG.fra(-0.6, 0.6), sp = TG.fra(4, 8);
      FX.emit(i % 2 ? cell : FX.CELL.sparkle, mx, 1.2, mz, { vx: Math.sin(a) * sp, vy: TG.fra(1, 3), vz: Math.cos(a) * sp, life: 0.4, size: 0.35 + level * 0.06, size1: 0.1, color: i % 2 ? c2 : [2.4, 2.0, 1.4], drag: 4, rot: 0 });
    }
  }

  // ── 모쉬 큰 소리 「픽셀 빔!」 ──
  const BEAM = { hold: 1.0, spin: 0.75, turns: 1.5, grow: 0.25, half: 0.2, fade: 0.25, bossDmg: 12 };
  WV.beamStart = function (x, z, dir, len, lv) {
    const b = WV.beam;
    Object.assign(b, { on: true, t: 0, x, z, dir, len, lv, bossHit: false });
    b.hit.clear(); b.g.visible = true; b.g.position.set(x, 2.2, z); b.g.rotation.y = dir;
    return b;
  };
  WV.beamAngle = function () { const b = WV.beam; const k = TG.clamp((b.t - BEAM.hold) / BEAM.spin, 0, 1); return b.dir + (k * k * (3 - 2 * k)) * BEAM.turns * Math.PI * 2; };
  function beamUpdate(dt, G) {
    const b = WV.beam; if (!b.on) return;
    const P = TG.PL; b.x = P.x; b.z = P.z; // 빛줄기는 머리에 붙어 있음
    const was = b.t; b.t += dt;
    if (b.t >= BEAM.hold + BEAM.spin + BEAM.fade) { b.on = false; b.g.visible = false; return; }
    if (b.t < BEAM.hold || was >= BEAM.hold + BEAM.spin) return;
    // 회전 중: 이번 걸음에 빛줄기가 지나간 각도 띠(앞 걸음 각도 → 지금 각도)에 든 안개 전부 퐁(한 마리 한 번)
    const a0 = (() => { const k = TG.clamp((was - BEAM.hold) / BEAM.spin, 0, 1); return b.dir + (k * k * (3 - 2 * k)) * BEAM.turns * Math.PI * 2; })(), a1 = WV.beamAngle();
    const sweep = Math.abs(a1 - a0) + BEAM.half;
    const F = TG.F;
    for (const u of F.list) {
      if (u.state !== 'live' || u.kind === 'cocoon' || u.spawnT < 0.3 || b.hit.has(u.id)) continue;
      const dx = u.x - b.x, dz = u.z - b.z, d = Math.hypot(dx, dz), ur = u.r * u.scale;
      if (d > b.len + ur) continue;
      const ang = Math.atan2(dx, dz), extra = Math.atan2(ur, Math.max(d, 0.5));
      let hitA = false;
      for (let k = 0; k < 4 && !hitA; k++) { const rel = TG.angDiff(a0 + k * Math.PI / 2, ang); if (rel >= -BEAM.half - extra && rel <= sweep + extra) hitA = true; }
      if (!hitA) continue;
      b.hit.add(u.id); u.byBig = true; WV.beamPops++;
      G.hitUnit(u, 99, b.x, b.z, true, 3, [0.8, 2.2, 2.4]);
    }
    const bs = F.boss;
    if (!b.bossHit && bs && bs.state === 'fight' && Math.hypot(bs.x - b.x, bs.z - b.z) < b.len + bs.r * bs.scale) { b.bossHit = true; G.hitBoss(Math.round(BEAM.bossDmg * (1 + b.lv * 0.25)), bs.x, bs.z, true); }
  }
  function beamDraw() {
    const b = WV.beam; if (!b.on) return;
    const P = TG.PL;
    b.g.position.set(P.rx != null ? P.rx : P.x, 2.2 + (P.y || 0), P.rz != null ? P.rz : P.z);
    const grow = TG.clamp(b.t / BEAM.grow, 0, 1), e = 1 - Math.pow(1 - grow, 3);
    const end = b.t - (BEAM.hold + BEAM.spin), fade = end > 0 ? 1 - TG.clamp(end / BEAM.fade, 0, 1) : 1;
    const len = b.len * e * (0.6 + 0.4 * fade), spinning = b.t >= BEAM.hold && end <= 0;
    b.g.rotation.y = WV.beamAngle();
    for (const arm of b.arms) { arm.scale.set(fade, fade, Math.max(0.01, len)); }
    if (spinning && TG.fr() < 0.9) { const a = WV.beamAngle() + ((TG.fr() * 4) | 0) * Math.PI / 2, r = TG.fra(2, b.len); TG.FX.emit(TG.FX.CELL.dot, b.x + Math.sin(a) * r, 2.0 + TG.fra(-0.3, 0.4), b.z + Math.cos(a) * r, { life: 0.25, size: 0.3, size1: 0, color: [0.8, 2.3, 2.5] }); }
    else if (!spinning && end <= 0 && TG.fr() < 0.5) { const a = b.dir + ((TG.fr() * 4) | 0) * Math.PI / 2; TG.FX.emit(TG.FX.CELL.sparkle, b.x + Math.sin(a) * len, 2.2, b.z + Math.cos(a) * len, { life: 0.2, size: 0.5, size1: 0, color: [1.5, 2.4, 2.5] }); }
  }

  // ── 규칙 계산 ──
  WV.update = function (dt, G) {
    for (let i = 0; i < WV.pending.length; i++) {
      const p = WV.pending[i]; p.t -= dt;
      if (p.t <= 0) { launch(p.dir, p.level); WV.pending.splice(i, 1); i--; }
    }
    beamUpdate(dt, G);
    const F = TG.F;
    for (const w of WV.pool) {
      if (!w.on) continue;
      const L = w.L;
      w.t += dt; w.pr = w.r;
      w.r = 0.5 + L.speed * w.t * (1 - Math.min(0.35, w.t * 0.3));
      if (w.r >= L.range) { w.done = true; }
      if (w.done) {
        if (!w.flowered) { // 베리: 파동이 끝난 자리에 작은 꽃 자국(밟으면 회복, js/flowers.js). 상자·벽 자리면 조금 안쪽에
          w.flowered = true;
          if (w.st && w.st.flowers && TG.FL) for (const k of [0.9, 0.7, 0.5]) { if (TG.FL.add(w.x + Math.sin(w.dir) * w.r * k, w.z + Math.cos(w.dir) * w.r * k, false)) { WV.flowers = (WV.flowers || 0) + 1; break; } }
        }
        w.fade -= dt * 7; if (w.fade <= 0) { w.on = false; w.g.visible = false; } continue;
      }
      // 맞힘 판정: 호 띠 안 + 각도 안 (관통). 대상은 안개·기계뿐
      for (const u of F.list) {
        if (u.state !== 'live' || w.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const dx = u.x - w.x, dz = u.z - w.z, d = Math.hypot(dx, dz);
        const ur = u.r * u.scale;
        if (Math.abs(d - w.r) > L.band * 0.5 + ur) continue;
        const ang = Math.abs(TG.angDiff(w.dir, Math.atan2(dx, dz)));
        if (ang > L.half + Math.atan2(ur, Math.max(d, 0.5))) continue;
        w.hit.add(u.id);
        G.hitUnit(u, L.dmg, w.x, w.z, false, w.level, w.st && w.st.spark ? [w.st.spark[0] * 0.9, w.st.spark[1] * 0.9, w.st.spark[2] * 0.9] : undefined);
      }
      const b = F.boss;
      if (b && b.state === 'fight' && !w.hit.has('boss')) {
        const dx = b.x - w.x, dz = b.z - w.z, d = Math.hypot(dx, dz), br = b.r * b.scale;
        if (Math.abs(d - w.r) < L.band * 0.5 + br) {
          const ang = Math.abs(TG.angDiff(w.dir, Math.atan2(dx, dz)));
          if (ang < L.half + Math.atan2(br, Math.max(d, 0.5))) { w.hit.add('boss'); G.hitBoss(L.dmg, w.x + Math.sin(w.dir) * w.r, w.z + Math.cos(w.dir) * w.r, false, w.level); }
        }
      }
    }
  };

  // ── 그리기 ──
  WV.draw = function (al) {
    beamDraw();
    for (const w of WV.pool) {
      if (!w.on) continue;
      const L = w.L, r = TG.lerp(w.pr, w.r, al), st = w.st || DEF_STYLE;
      const grow = 0.55 + Math.min(1, r / L.range) * 0.45;
      w.parts.forEach((m, k) => {
        const rr = Math.max(0.3, r - k * 1.05);                 // 호 사이를 띄워 「)))」 로 읽히게
        const hh = L.h * 0.58 * grow * (1 - k * 0.2);
        m.scale.set(rr, hh, rr);
        m.material.uniforms.uA.value = (1 - k * 0.22) * w.fade * (w.t < 0.04 ? w.t / 0.04 : 1);
      });
      // 호 끝 반짝이 (주인공 색). 모쉬는 네모 점·베리는 꽃잎도 섞임
      if (TG.fr() < 0.5) {
        const side = TG.fr() < 0.5 ? -1 : 1, a = w.dir + side * L.half * 0.85;
        const cell = st.pixel ? TG.FX.CELL.dot : st.flowers && TG.fr() < 0.4 ? TG.FX.CELL.flower : TG.FX.CELL.sparkle;
        TG.FX.emit(cell, w.x + Math.sin(a) * r, 1.1 + TG.fra(-0.3, 0.3), w.z + Math.cos(a) * r, { life: 0.22, size: st.pixel ? 0.3 : 0.4, size1: 0, color: st.spark, rot: 0 });
      }
    }
  };
})();
