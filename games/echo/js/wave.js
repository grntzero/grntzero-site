/* 톱니골 던전 — 「소리 파동」: 「소리」 버튼을 누르는 동안 나가는 빨간 호 3겹(겨눈 방향), 관통. update = 규칙 계산 / draw = 그리기
   11-16 베리 「베리 방울」(TG.hero.shot === 'berry'): 핑크 열매 방울이 데굴데굴 굴러가다 닿으면(또는 사거리 끝에서) 퐁 — 둘레 안개를 함께 터뜨림, 지나간 자리에 작은 꽃(js/flowers.js)
   11-16 허조교 「삑!」(TG.hero.shot === 'whistle'): 올리브 음표가 빠르게 직선으로 날아가 처음 닿는 안개를 퐁(모은 링 단계만큼 더 뚫고 감). 큰 소리 「열 맞춰!」의 긴 음표(whistleBig)는 줄 선 안개를 한 번에 관통
   11-16 MOSHEE 「픽셀 빛줄」(TG.hero.shot === 'pixel'): 붐박스에서 시안 픽셀 음표 줄이 직선으로 나가 벽·상자에 한 번 튕기고(두 번째에 퐁) 닿는 안개를 퐁(모은 링 단계만큼 더 뚫고 감).
     큰 소리 「픽셀 하트!」(heartBig): 큰 픽셀 하트가 날아가며 줄 위 안개 퐁 + 지나는 길 곁 상자에서 숨은 음표 → 벽에서 작은 하트 4개로 쪼개져 튕김 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const WV = (TG.WV = { list: [], pending: [] });
  // 단계별 값 (0 = 기본, 1~3 = 모으기)
  WV.LV = [
    { range: 8.2, speed: 17, half: 0.5, dmg: 1, h: 1.8, band: 0.95, cd: 0.42 },
    { range: 9.0, speed: 17.5, half: 0.58, dmg: 2, h: 2.1, band: 1.1, cd: 0.5 },
    { range: 10.0, speed: 18.5, half: 0.68, dmg: 3, h: 2.5, band: 1.25, cd: 0.56 },
    { range: 11.5, speed: 19.5, half: 0.8, dmg: 5, h: 3.0, band: 1.45, cd: 0.62 },
  ];
  let id = 1;

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
      uniforms: { uA: { value: 1 }, uIn: { value: new T.Color(0xff8a5b) }, uOut: { value: new T.Color(0xe5352b) }, uGold: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform float uA; uniform vec3 uIn; uniform vec3 uOut; uniform float uGold; varying vec2 vUv;',
        'void main(){ float x = vUv.x * 2.0 - 1.0, y = vUv.y * 2.0 - 1.0;',
        ' float hh = 1.0 - pow(abs(x), 2.6) * 0.85;',          // 끝으로 갈수록 가늘어지는 초승달
        ' float d = abs(y) / max(hh, 0.05);',
        ' if (d > 1.0) discard;',
        ' vec3 fill = mix(uIn, uOut, smoothstep(0.15, 0.75, d));',   // 가운데 주황 → 바깥 빨강
        ' fill = mix(fill, vec3(1.15, 0.95, 0.35), uGold * (1.0 - smoothstep(0.0, 0.5, d)));',
        ' vec3 col = mix(vec3(1.12, 1.08, 1.0), fill, smoothstep(0.10, 0.2, d));',   // 가운데 흰 심지 한 줄
        ' col = mix(col, vec3(0.62, 0.08, 0.08), smoothstep(0.74, 0.8, d));',        // 짙은 빨강 테
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
    // 베리 방울 풀: 핑크 열매(점 무늬) + 초록 잎 꼭지 + 외곽선
    WV.berries = [];
    const R = TG.R;
    const seedTex = R.canvasTex(128, 128, (c) => { c.fillStyle = '#ff6fae'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#ffe9a8'; for (let i = 0; i < 14; i++) { const a = (i * 2.399), r = 10 + (i * 37) % 44; c.beginPath(); c.ellipse(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 5, 7.5, a, 0, 6.283); c.fill(); } }, { repeat: true });
    const bodyMat = R.toon({ map: seedTex, gain: 1.15, rim: 0.55, spec: 0.35 }), leafMat = R.toon({ color: 0x6fd36b, gain: 1.1, rim: 0.4 });
    for (let i = 0; i < 14; i++) {
      const g = new T.Group(); g.visible = false; scene.add(g);
      const ball = new T.Mesh(new T.SphereGeometry(0.46, 20, 14), bodyMat); ball.castShadow = true; ball.renderOrder = 14; g.add(ball); R.addOutline(ball, 1.0).renderOrder = 14;
      const leaf = new T.Mesh(new T.ConeGeometry(0.22, 0.26, 6), leafMat); leaf.position.y = 0.5; leaf.renderOrder = 14; ball.add(leaf); R.addOutline(leaf, 1.0).renderOrder = 14;
      WV.berries.push({ g, ball, on: false });
    }
    WV.berryPops = 0;
    // 허조교 호루라기 음표 풀: 올리브 음표(머리 구슬 + 대 + 깃발) + 외곽선. 마지막 하나는 큰 소리용(길고 금빛)
    WV.notes = [];
    const noteMat = R.toon({ color: 0xb9c25a, gain: 1.2, rim: 0.55, spec: 0.4 }), stemMat = R.toon({ color: 0xfffbe6, gain: 1.15, rim: 0.4 }), goldMat = R.toon({ color: 0xffd966, gain: 1.3, rim: 0.6, spec: 0.5 });
    for (let i = 0; i < 12; i++) {
      const big = i === 11, g = new T.Group(); g.visible = false; scene.add(g);
      const body = new T.Group(); g.add(body); // body 는 음표 모양(앞 = +z 로 눕힘), g 는 자리·방향
      const head = new T.Mesh(new T.SphereGeometry(0.3, 16, 12), big ? goldMat : noteMat); head.scale.set(1.25, 0.8, 1); head.rotation.z = -0.5; head.castShadow = true; head.renderOrder = 14; body.add(head); R.addOutline(head, 1.0).renderOrder = 14;
      const stem = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.95, 8), stemMat); stem.position.set(0.3, 0.45, 0); stem.renderOrder = 14; body.add(stem); R.addOutline(stem, 1.0).renderOrder = 14;
      const flag = new T.Mesh(new T.BoxGeometry(0.34, 0.12, 0.08), big ? goldMat : noteMat); flag.position.set(0.5, 0.86, 0); flag.rotation.z = -0.6; flag.renderOrder = 14; body.add(flag); R.addOutline(flag, 1.0).renderOrder = 14;
      body.rotation.set(0, 0, -0.35); body.position.y = -0.2;
      WV.notes.push({ g, body, on: false, big });
    }
    WV.whistlePops = 0; WV.lineHits = 0;
    // MOSHEE 픽셀 빛줄 풀: 시안 픽셀 큐브 넷이 줄지어(앞이 크고 뒤로 작게) 날아감. 하트 풀: 큰 하트 1 + 쪼개진 작은 하트 4 (픽셀 하트 모양 = 큐브 격자)
    WV.pixels = [];
    const pxMat = R.toon({ color: 0x2fe0f0, gain: 1.45, rim: 0.6, spec: 0.3, emissive: 0x0a6a74, ei: 0.8 }), pxMat2 = R.toon({ color: 0x9df5ff, gain: 1.4, rim: 0.5 });
    const cube = new T.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 12; i++) {
      const g = new T.Group(); g.visible = false; scene.add(g);
      const body = new T.Group(); g.add(body);
      [0.3, 0.22, 0.17, 0.13].forEach((s, k) => { const m = new T.Mesh(cube, k % 2 ? pxMat2 : pxMat); m.scale.setScalar(s); m.position.z = -k * 0.36; m.rotation.z = k * 0.5; m.castShadow = k === 0; m.renderOrder = 14; body.add(m); R.addOutline(m, 1.0).renderOrder = 14; });
      WV.pixels.push({ g, body, on: false });
    }
    WV.hearts = [];
    const htMat = R.toon({ color: 0xff5fb8, gain: 1.4, rim: 0.6, spec: 0.35, emissive: 0x6a1040, ei: 0.7 }), htMat2 = R.toon({ color: 0xd95cff, gain: 1.3, rim: 0.5 });
    const HEART_PX = [[-2, 2], [-1, 2], [1, 2], [2, 2], [-3, 1], [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-1, -2], [0, -2], [1, -2], [0, -3]];
    for (let i = 0; i < 5; i++) {
      const big = i === 0, g = new T.Group(); g.visible = false; scene.add(g);
      const body = new T.Group(); g.add(body);
      const px = big ? 0.26 : 0.15;
      HEART_PX.forEach(([hx, hy], k) => { const m = new T.Mesh(cube, k % 5 === 0 ? htMat2 : htMat); m.scale.set(px, px, px * 0.8); m.position.set(hx * px, hy * px, 0); m.renderOrder = 14; m.castShadow = big && k % 3 === 0; body.add(m); });
      body.rotation.y = Math.PI / 2; // 하트 면이 가는 방향(+z)을 봄 → 옆에서 보면 하트, 앞에서 보면 날아오는 판
      WV.hearts.push({ g, body, on: false, big });
    }
    WV.pixelPops = 0; WV.pixelBounces = 0; WV.heartHits = 0; WV.heartSplits = 0; WV.crateLit = 0;
  };
  WV.reset = function () { WV.pool.forEach((w) => { w.on = false; w.g.visible = false; }); WV.berries.forEach((b) => { b.on = false; b.g.visible = false; }); WV.notes.forEach((b) => { b.on = false; b.g.visible = false; }); WV.pixels.forEach((b) => { b.on = false; b.g.visible = false; }); WV.hearts.forEach((b) => { b.on = false; b.g.visible = false; }); WV.pending.length = 0; id = 1; WV.berryPops = 0; WV.whistlePops = 0; WV.lineHits = 0; WV.pixelPops = 0; WV.pixelBounces = 0; WV.heartHits = 0; WV.heartSplits = 0; WV.crateLit = 0; };
  WV.activeCount = () => WV.pool.filter((w) => w.on).length + WV.berries.filter((b) => b.on).length + WV.notes.filter((b) => b.on).length + WV.pixels.filter((b) => b.on).length + WV.hearts.filter((b) => b.on).length;

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

  // 파동 내보내기. n = 한 번에 나가는 수(「파동 +1」 카드): 조준 방향부터 둥글게 고르게
  WV.fire = function (dir, level, n) {
    const P = TG.PL;
    n = n || 1;
    P.fireAnim(dir, level);
    const berry = !!(TG.hero && TG.hero.shot === 'berry'), whistle = !!(TG.hero && TG.hero.shot === 'whistle'), pixel = !!(TG.hero && TG.hero.shot === 'pixel');
    for (let i = 0; i < n; i++) WV.pending.push({ t: 0.05, dir: dir + (i / n) * Math.PI * 2, level, berry, whistle, pixel });
    if (berry) { TG.A.play('sfx_pop', { rate: 1.5 + level * 0.1 + TG.fra(-0.05, 0.05), gain: 0.4 + level * 0.1 }); TG.A.pick(); }
    else if (whistle) { TG.A.countBeep(true); TG.A.play('sfx_wave', { rate: 1.7 + level * 0.12, gain: 0.35 + level * 0.1 }); } // 삑! (출발 삑 소리 + 파동 샘플 높게)
    else if (pixel) { TG.A.play('sfx_pick', { rate: 1.9 + level * 0.1, gain: 0.28 }); TG.A.play('sfx_wave', { rate: 1.3 + level * 0.1, gain: 0.3 + level * 0.08 }); } // 픽셀 삐빅 (줍기 소리 높게 + 파동 샘플)
    else TG.A.wave(level);
    if (level >= 2) { TG.FX.shake(0.12 + level * 0.05); TG.FX.punch(0.015 * level); }
  };

  function launch(dir, level) {
    const w = WV.pool.find((q) => !q.on); if (!w) return;
    const P = TG.PL, L = WV.stat(level);
    const ox = P.x + Math.sin(dir) * 0.45, oz = P.z + Math.cos(dir) * 0.45;
    Object.assign(w, { on: true, id: id++, x: ox, z: oz, dir, level, L, t: 0, r: 0.5, pr: 0.5, fade: 1, hit: new Set(), done: false });
    w.g.visible = true; w.g.position.set(ox, 1.6 + (level * 0.12), oz); w.g.rotation.y = dir;
    w.parts.forEach((m) => { m.geometry = WV.geos[level][L.sizeLv]; m.material.uniforms.uGold.value = level === 3 ? 1 : 0; m.material.uniforms.uA.value = 0; });
    // 입 앞 반짝
    const mx = P.x + Math.sin(dir) * 1.2, mz = P.z + Math.cos(dir) * 1.2;
    TG.FX.emit(TG.FX.CELL.glow, mx, 1.15, mz, { life: 0.12, size: 1.2 + level * 0.4, size1: 1.8 + level * 0.5, color: [1.8, 0.9, 0.6], alpha: 0.4 });
    for (let i = 0; i < 3 + level * 2; i++) {
      const a = dir + TG.fra(-0.6, 0.6), sp = TG.fra(4, 8);
      TG.FX.emit(i % 2 ? TG.FX.CELL.note : TG.FX.CELL.sparkle, mx, 1.2, mz, { vx: Math.sin(a) * sp, vy: TG.fra(1, 3), vz: Math.cos(a) * sp, life: 0.4, size: 0.35 + level * 0.06, size1: 0.1, color: i % 2 ? [2.4, 0.7, 0.5] : [2.4, 2.0, 1.4], drag: 4, rot: 0 });
    }
  }

  // ── 베리 방울 (주인공 베리) ──
  const BERRY = { speed: 0.78, pop: 1.7, trail: 1.6, maxTrail: 2 }; // 파동 속도 배율, 퐁 둘레(안개 함께 터짐), 꽃 자국 간격, 한 방울이 남기는 꽃 수
  function launchBerry(dir, level) {
    const b = WV.berries.find((q) => !q.on); if (!b) return;
    const P = TG.PL, L = WV.stat(level);
    const rad = 0.46 * (1 + level * 0.16) * (1 + L.sizeLv * 0.12);
    const ox = P.x + Math.sin(dir) * 0.9, oz = P.z + Math.cos(dir) * 0.9;
    Object.assign(b, { on: true, id: id++, ox, oz, x: ox, z: oz, px: ox, pz: oz, dir, level, L, rad, t: 0, r: 0, pr: 0, done: false, trailAt: 0, trails: 0, roll: 0 });
    b.g.visible = true; b.g.scale.setScalar(rad / 0.46); b.g.position.set(ox, rad, oz);
    TG.FX.emit(TG.FX.CELL.glow, ox, 1.0, oz, { life: 0.12, size: 1.0 + level * 0.3, size1: 1.6 + level * 0.3, color: [2.0, 1.0, 1.5], alpha: 0.4 });
  }
  function berryPop(b, G, hitU) {
    const F = TG.F, L = b.L, R2 = BERRY.pop + b.level * 0.45 + b.rad;
    b.done = true; b.on = false; b.g.visible = false; WV.berryPops++;
    const FX = TG.FX;
    FX.popBurst(b.x, b.rad, b.z, 0.9 + b.level * 0.25, [2.3, 1.0, 1.5]);
    for (let i = 0; i < 3 + b.level; i++) FX.emit(FX.CELL.flower, b.x, b.rad + 0.2, b.z, { vx: TG.fra(-2.5, 2.5), vy: TG.fra(3, 5.5), vz: TG.fra(-2.5, 2.5), life: 0.6, size: 0.45, size1: 0.15, color: [2.3, 1.2, 1.7], grav: 8, pop: true, vrot: TG.fra(-4, 4), rot: 0 });
    FX.ring(b.x, b.z, { r0: 0.3, r1: R2, dur: 0.3, color: 0xff9ccb, width: 0.22, alpha: 0.9 });
    if (hitU) G.hitUnit(hitU, L.dmg, b.x, b.z, false, b.level, [2.2, 1.1, 1.6]);
    for (const u of F.list) {
      if (u === hitU || u.state !== 'live' || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
      if (Math.hypot(u.x - b.x, u.z - b.z) < R2 + u.r * u.scale) G.hitUnit(u, L.dmg, b.x, b.z, true, b.level, [2.2, 1.1, 1.6]);
    }
    const bs = F.boss;
    if (bs && bs.state === 'fight' && Math.hypot(bs.x - b.x, bs.z - b.z) < R2 + bs.r * bs.scale) G.hitBoss(L.dmg, b.x, b.z, !!hitU, b.level);
  }
  function berryUpdate(dt, G) {
    const F = TG.F;
    for (const b of WV.berries) {
      if (!b.on) continue;
      const L = b.L;
      b.t += dt; b.pr = b.r; b.px = b.x; b.pz = b.z;
      b.r += L.speed * BERRY.speed * dt;
      b.roll += (L.speed * BERRY.speed * dt) / b.rad;
      b.x = b.ox + Math.sin(b.dir) * b.r; b.z = b.oz + Math.cos(b.dir) * b.r;
      // 꽃 자국: 굴러간 길에 띄엄띄엄
      if (b.r - b.trailAt >= BERRY.trail && b.trails < BERRY.maxTrail && TG.FL) { b.trailAt = b.r; b.trails++; TG.FL.add(b.x, b.z, false); }
      if (TG.AR.blocked(b.x, b.z, 0.3) || Math.abs(b.x) > TG.AR.bx - 0.3 || Math.abs(b.z) > TG.AR.bz - 0.3) { berryPop(b, G, null); continue; } // 벽·상자에 닿으면 퐁
      if (b.r >= L.range) { berryPop(b, G, null); continue; }
      let hit = null, hd = 1e9;
      for (const u of F.list) {
        if (u.state !== 'live' || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const d = Math.hypot(u.x - b.x, u.z - b.z) - u.r * u.scale - b.rad;
        if (d < 0 && d < hd) { hd = d; hit = u; }
      }
      if (hit) { berryPop(b, G, hit); continue; }
      const bs = F.boss;
      if (bs && bs.state === 'fight' && Math.hypot(bs.x - b.x, bs.z - b.z) < bs.r * bs.scale + b.rad) { berryPop(b, G, null); continue; }
    }
  }
  function berryDraw(al) {
    for (const b of WV.berries) {
      if (!b.on) continue;
      const x = TG.lerp(b.px, b.x, al), z = TG.lerp(b.pz, b.z, al), r = TG.lerp(b.pr, b.r, al);
      const hop = Math.abs(Math.sin(r * 2.4)) * 0.22 * b.rad; // 데굴데굴 + 살짝 통통
      b.g.position.set(x, b.rad + hop, z);
      b.ball.rotation.set(0, 0, 0); b.ball.rotateY(b.dir); b.ball.rotateX(b.roll);
      if (TG.fr() < 0.35) TG.FX.emit(TG.FX.CELL.sparkle, x + TG.fra(-0.3, 0.3), b.rad * 1.6, z + TG.fra(-0.3, 0.3), { life: 0.2, size: 0.3, size1: 0, color: [2.4, 1.4, 1.8] });
    }
  }

  // ── 호루라기 음표 (주인공 허조교) ──
  const WHISTLE = { speed: 2.1, range: 1.3, rad: 0.42 }; // 파동 속도 배율(빠르게), 사거리 배율(길게·좁게), 맞힘 반지름. 뚫는 수 = 1 + 모은 링 단계
  function launchWhistle(dir, level) {
    const n = WV.notes.find((q) => !q.on && !q.big); if (!n) return;
    const P = TG.PL, L = WV.stat(level);
    const rad = WHISTLE.rad * (1 + level * 0.14) * (1 + L.sizeLv * 0.12);
    const ox = P.x + Math.sin(dir) * 0.9, oz = P.z + Math.cos(dir) * 0.9;
    Object.assign(n, { on: true, id: id++, ox, oz, x: ox, z: oz, px: ox, pz: oz, dir, level, L, rad, t: 0, r: 0, pr: 0, done: false, left: 1 + level, hit: new Set(), speed: L.speed * WHISTLE.speed, range: L.range * WHISTLE.range, dmg: L.dmg, bigNote: false });
    n.g.visible = true; n.g.scale.setScalar(rad / WHISTLE.rad); n.g.position.set(ox, 1.5, oz); n.g.rotation.y = dir;
    TG.FX.emit(TG.FX.CELL.glow, ox, 1.5, oz, { life: 0.1, size: 0.9 + level * 0.3, size1: 1.5 + level * 0.3, color: [1.8, 1.9, 0.9], alpha: 0.4 });
  }
  // 큰 소리 「열 맞춰!」의 긴 음표: 줄 선 안개를 모두 뚫고 지나감(큰 소리 판정 = 99). 돌려줌: 음표 (시험용)
  WV.whistleBig = function (x, z, dir, range, lv) {
    const n = WV.notes.find((q) => q.big && !q.on) || WV.notes[WV.notes.length - 1];
    const rad = 0.7 + lv * 0.08;
    const ox = x + Math.sin(dir) * 1.0, oz = z + Math.cos(dir) * 1.0;
    Object.assign(n, { on: true, id: id++, ox, oz, x: ox, z: oz, px: ox, pz: oz, dir, level: 3, L: WV.stat(3), rad, t: 0, r: 0, pr: 0, done: false, left: 999, hit: new Set(), speed: 30, range, dmg: 99, bigNote: true, bigLv: lv });
    n.g.visible = true; n.g.scale.setScalar(rad / WHISTLE.rad); n.g.position.set(ox, 1.6, oz); n.g.rotation.y = dir;
    TG.A.countBeep(true); TG.A.play('sfx_wave', { rate: 1.45, gain: 0.7 });
    return n;
  };
  function whistlePop(n, G, wall) {
    n.done = true; n.on = false; n.g.visible = false; if (!n.bigNote) WV.whistlePops++;
    const FX = TG.FX, c = n.bigNote ? [2.5, 2.1, 0.8] : [2.0, 2.2, 0.9];
    FX.popBurst(n.x, 1.4, n.z, (n.bigNote ? 1.2 : 0.7) + n.level * 0.15, c);
    for (let i = 0; i < 3 + n.level; i++) FX.emit(FX.CELL.note, n.x, 1.6, n.z, { vx: TG.fra(-2.5, 2.5), vy: TG.fra(2.5, 5), vz: TG.fra(-2.5, 2.5), life: 0.5, size: 0.4, size1: 0.1, color: c, grav: 8, pop: true, vrot: TG.fra(-4, 4), rot: 0 });
    if (wall) TG.A.play('sfx_bonk', { rate: 1.6, gain: 0.25 });
  }
  function whistleUpdate(dt, G) {
    const F = TG.F;
    for (const n of WV.notes) {
      if (!n.on) continue;
      n.t += dt; n.pr = n.r; n.px = n.x; n.pz = n.z;
      const step = n.speed * dt; n.r += step;
      n.x = n.ox + Math.sin(n.dir) * n.r; n.z = n.oz + Math.cos(n.dir) * n.r;
      if ((!n.bigNote && TG.AR.blocked(n.x, n.z, 0.3)) || Math.abs(n.x) > TG.AR.bx - 0.3 || Math.abs(n.z) > TG.AR.bz - 0.3) { whistlePop(n, G, true); continue; } // 벽·상자에 닿으면 퐁 (큰 소리의 긴 음표는 상자를 넘어감 — 줄 선 안개를 끝까지)
      if (n.r >= n.range) { whistlePop(n, G, false); continue; }
      // 지나온 한 걸음(px→x) 선분에 걸리는 안개를 가까운 순서로 (빠르니 건너뛰지 않게 선분으로)
      const hits = [];
      for (const u of F.list) {
        if (u.state !== 'live' || n.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const ux = u.x - n.px, uz = u.z - n.pz, sx = n.x - n.px, sz = n.z - n.pz, l2 = sx * sx + sz * sz || 1e-9;
        const k = TG.clamp((ux * sx + uz * sz) / l2, 0, 1), d = Math.hypot(ux - sx * k, uz - sz * k);
        if (d < n.rad + u.r * u.scale) hits.push([k, u]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      let stop = false;
      for (const [k, u] of hits) {
        n.hit.add(u.id);
        if (n.bigNote) { u.byBig = true; WV.lineHits++; G.hitUnit(u, 99, n.px + (n.x - n.px) * k, n.pz + (n.z - n.pz) * k, true, 3, [2.3, 2.1, 0.9]); }
        else G.hitUnit(u, n.dmg, n.px, n.pz, false, n.level, [2.0, 2.1, 0.9]);
        n.left--;
        if (n.left <= 0) { n.x = n.px + (n.x - n.px) * k; n.z = n.pz + (n.z - n.pz) * k; stop = true; break; }
      }
      if (stop) { whistlePop(n, G, false); continue; }
      const bs = F.boss;
      if (bs && bs.state === 'fight' && !n.hit.has('boss') && Math.hypot(bs.x - n.x, bs.z - n.z) < bs.r * bs.scale + n.rad) {
        n.hit.add('boss');
        if (n.bigNote) G.hitBoss(Math.round(12 * (1 + (n.bigLv || 0) * 0.25)), n.x, n.z, true); else G.hitBoss(n.dmg, n.x, n.z, false, n.level);
        n.left--; if (n.left <= 0 || !n.bigNote) { whistlePop(n, G, false); continue; }
      }
    }
  }
  function whistleDraw(al) {
    for (const n of WV.notes) {
      if (!n.on) continue;
      const x = TG.lerp(n.px, n.x, al), z = TG.lerp(n.pz, n.z, al);
      n.g.position.set(x, (n.bigNote ? 1.6 : 1.5) + Math.sin(n.t * 18) * 0.08, z);
      n.body.rotation.y = n.t * (n.bigNote ? 6 : 10); // 팽글팽글 돌며 날아감
      if (TG.fr() < (n.bigNote ? 0.9 : 0.45)) TG.FX.emit(TG.FX.CELL.sparkle, x + TG.fra(-0.2, 0.2), 1.3 + TG.fra(0, 0.4), z + TG.fra(-0.2, 0.2), { life: 0.22, size: n.bigNote ? 0.5 : 0.3, size1: 0, color: n.bigNote ? [2.5, 2.1, 0.8] : [2.0, 2.2, 1.0] });
    }
  }

  // ── 픽셀 빛줄 (주인공 MOSHEE) ──
  const PIXEL = { speed: 1.6, range: 1.45, rad: 0.42, bounces: 1 }; // 파동 속도 배율, 사거리 배율(튕긴 거리 포함), 맞힘 반지름, 튕기는 수. 뚫는 수 = 1 + 모은 링 단계
  function launchPixel(dir, level) {
    const n = WV.pixels.find((q) => !q.on); if (!n) return;
    const P = TG.PL, L = WV.stat(level);
    const rad = PIXEL.rad * (1 + level * 0.14) * (1 + L.sizeLv * 0.12);
    const ox = P.x + Math.sin(dir) * 0.9, oz = P.z + Math.cos(dir) * 0.9;
    Object.assign(n, { on: true, id: id++, ox, oz, x: ox, z: oz, px: ox, pz: oz, dir, level, L, rad, t: 0, r: 0, pr: 0, done: false, left: 1 + level, hit: new Set(), speed: L.speed * PIXEL.speed, range: L.range * PIXEL.range, dmg: L.dmg, bounces: PIXEL.bounces });
    n.g.visible = true; n.g.scale.setScalar(rad / PIXEL.rad); n.g.position.set(ox, 1.4, oz); n.g.rotation.y = dir;
    TG.FX.emit(TG.FX.CELL.glow, ox, 1.4, oz, { life: 0.1, size: 0.9 + level * 0.3, size1: 1.5 + level * 0.3, color: [0.8, 2.2, 2.4], alpha: 0.4 });
  }
  // 벽·상자에 닿았을 때 튕길 방향: 경기장 테두리면 그 축 반전, 장애물이면 중심에서 바깥쪽 법선으로 반사. 돌려줌: 새 방향 (안 닿았으면 null)
  function reflectDir(x, z, dir, pad) {
    const AR = TG.AR;
    let sx = Math.sin(dir), sz = Math.cos(dir), hitW = false;
    if (Math.abs(x) > AR.bx - pad) { sx = -sx; hitW = true; }
    if (Math.abs(z) > AR.bz - pad) { sz = -sz; hitW = true; }
    if (hitW) return Math.atan2(sx, sz);
    for (const c of AR.colliders) {
      const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r + pad) { const nx = dx / (d || 1), nz = dz / (d || 1), dot = sx * nx + sz * nz; return Math.atan2(sx - 2 * dot * nx, sz - 2 * dot * nz); }
    }
    return null;
  }
  function pixelPop(n, G, wall) {
    n.done = true; n.on = false; n.g.visible = false; WV.pixelPops++;
    const FX = TG.FX, c = [0.8, 2.3, 2.5];
    FX.popBurst(n.x, 1.3, n.z, 0.7 + n.level * 0.15, c);
    for (let i = 0; i < 3 + n.level; i++) FX.emit(FX.CELL.dot, n.x, 1.4, n.z, { vx: TG.fra(-2.5, 2.5), vy: TG.fra(2.5, 5), vz: TG.fra(-2.5, 2.5), life: 0.45, size: 0.3, size1: 0.08, color: c, grav: 8, pop: true });
    if (wall) TG.A.play('sfx_bonk', { rate: 1.9, gain: 0.2 });
  }
  function pixelUpdate(dt, G) {
    const F = TG.F;
    for (const n of WV.pixels) {
      if (!n.on) continue;
      n.t += dt; n.pr = n.r; n.px = n.x; n.pz = n.z;
      const step = n.speed * dt; n.r += step;
      n.x = n.ox + Math.sin(n.dir) * n.r; n.z = n.oz + Math.cos(n.dir) * n.r;
      if (TG.AR.blocked(n.x, n.z, 0.3) || Math.abs(n.x) > TG.AR.bx - 0.3 || Math.abs(n.z) > TG.AR.bz - 0.3) { // 벽·상자: 한 번은 튕기고(남은 사거리로 계속), 두 번째에 퐁
        if (n.bounces > 0) {
          const nd = reflectDir(n.x, n.z, n.dir, 0.3);
          n.bounces--; WV.pixelBounces++;
          n.range = Math.max(0, n.range - n.r); n.ox = n.x = n.px; n.oz = n.z = n.pz; n.r = n.pr = 0; n.dir = nd == null ? n.dir + Math.PI : nd;
          n.g.rotation.y = n.dir;
          TG.A.play('sfx_bonk', { rate: 2.1, gain: 0.18 }); TG.FX.emit(TG.FX.CELL.glow, n.x, 1.4, n.z, { life: 0.12, size: 0.8, size1: 1.6, color: [0.8, 2.2, 2.4], alpha: 0.5 });
          for (let i = 0; i < 4; i++) TG.FX.emit(TG.FX.CELL.dot, n.x, 1.4, n.z, { vx: TG.fra(-2, 2), vy: TG.fra(1, 3), vz: TG.fra(-2, 2), life: 0.3, size: 0.25, size1: 0.05, color: [0.9, 2.3, 2.5], grav: 6 });
          continue;
        }
        pixelPop(n, G, true); continue;
      }
      if (n.r >= n.range) { pixelPop(n, G, false); continue; }
      const hits = []; // 지나온 한 걸음 선분으로 판정 (빠르니 건너뛰지 않게)
      for (const u of F.list) {
        if (u.state !== 'live' || n.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const ux = u.x - n.px, uz = u.z - n.pz, sx = n.x - n.px, sz = n.z - n.pz, l2 = sx * sx + sz * sz || 1e-9;
        const k = TG.clamp((ux * sx + uz * sz) / l2, 0, 1), d = Math.hypot(ux - sx * k, uz - sz * k);
        if (d < n.rad + u.r * u.scale) hits.push([k, u]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      let stop = false;
      for (const [k, u] of hits) {
        n.hit.add(u.id);
        G.hitUnit(u, n.dmg, n.px, n.pz, false, n.level, [0.8, 2.2, 2.4]);
        n.left--;
        if (n.left <= 0) { n.x = n.px + (n.x - n.px) * k; n.z = n.pz + (n.z - n.pz) * k; stop = true; break; }
      }
      if (stop) { pixelPop(n, G, false); continue; }
      const bs = F.boss;
      if (bs && bs.state === 'fight' && !n.hit.has('boss') && Math.hypot(bs.x - n.x, bs.z - n.z) < bs.r * bs.scale + n.rad) {
        n.hit.add('boss'); G.hitBoss(n.dmg, n.x, n.z, false, n.level);
        pixelPop(n, G, false); continue;
      }
    }
  }
  function pixelDraw(al) {
    for (const n of WV.pixels) {
      if (!n.on) continue;
      const x = TG.lerp(n.px, n.x, al), z = TG.lerp(n.pz, n.z, al);
      n.g.position.set(x, 1.4 + Math.sin(n.t * 20) * 0.06, z);
      n.body.rotation.z = n.t * 7; // 픽셀 줄이 빙글 돌며 날아감
      if (TG.fr() < 0.45) TG.FX.emit(TG.FX.CELL.dot, x + TG.fra(-0.2, 0.2), 1.2 + TG.fra(0, 0.4), z + TG.fra(-0.2, 0.2), { life: 0.22, size: 0.22, size1: 0, color: [0.8, 2.2, 2.5] });
    }
  }

  // ── 픽셀 하트 (주인공 MOSHEE 큰 소리): 큰 하트 → 벽에서 작은 하트 4개로 ──
  const HEART = { speed: 24, rad: 0.95, small: { speed: 17, range: 7.5, rad: 0.55, dmg: 99 }, crateR: 2.6, crateNotes: 2 };
  function launchHeart(h, x, z, dir, range, lv, rad, speed) {
    Object.assign(h, { on: true, id: id++, ox: x, oz: z, x, z, px: x, pz: z, dir, lv, rad, t: 0, r: 0, pr: 0, done: false, hit: new Set(), speed, range, lit: new Set() });
    h.g.visible = true; h.g.scale.setScalar(rad / (h.big ? HEART.rad : HEART.small.rad)); h.g.position.set(x, h.big ? 1.9 : 1.5, z); h.g.rotation.y = dir;
  }
  WV.heartBig = function (x, z, dir, range, lv) {
    const h = WV.hearts[0];
    const ox = x + Math.sin(dir) * 1.0, oz = z + Math.cos(dir) * 1.0;
    launchHeart(h, ox, oz, dir, range, lv, HEART.rad + lv * 0.1, HEART.speed);
    TG.A.play('sfx_wave', { rate: 1.1, gain: 0.7 }); TG.A.pick();
    TG.FX.emit(TG.FX.CELL.heart, ox, 2.2, oz, { life: 0.25, size: 1.6, size1: 2.6, color: [2.4, 0.9, 1.7], alpha: 0.6 });
    return h;
  };
  function heartPop(h, G, split) {
    h.done = true; h.on = false; h.g.visible = false;
    const FX = TG.FX, c = [2.4, 0.9, 1.7];
    FX.popBurst(h.x, h.big ? 1.9 : 1.4, h.z, h.big ? 1.3 : 0.8, c);
    for (let i = 0; i < (h.big ? 8 : 4); i++) FX.emit(FX.CELL.heart, h.x, 1.8, h.z, { vx: TG.fra(-3, 3), vy: TG.fra(2.5, 5.5), vz: TG.fra(-3, 3), life: 0.55, size: h.big ? 0.6 : 0.4, size1: 0.1, color: c, grav: 8, pop: true, vrot: TG.fra(-4, 4), rot: 0 });
    if (split && h.big) { // 벽에서 작은 하트 4개로 쪼개져 튕김: 반사 방향 둘레 넷으로
      WV.heartSplits++;
      const nd = reflectDir(h.x, h.z, h.dir, 0.4); const base = nd == null ? h.dir + Math.PI : nd;
      let k = 0;
      for (const o of [-0.95, -0.32, 0.32, 0.95]) {
        const s = WV.hearts.find((q) => !q.big && !q.on); if (!s) break;
        const d = base + o; k++;
        launchHeart(s, h.px + Math.sin(d) * 0.3, h.pz + Math.cos(d) * 0.3, d, HEART.small.range, h.lv, HEART.small.rad, HEART.small.speed);
      }
      TG.A.play('sfx_pop', { rate: 1.25, gain: 0.6 }); TG.A.play('sfx_bonk', { rate: 1.5, gain: 0.25 });
      FX.ring(h.px, h.pz, { r0: 0.4, r1: 3.5, dur: 0.35, color: 0xff5fb8, width: 0.2, hdr: 1.3 });
    } else if (!h.big) TG.A.play('sfx_pop', { rate: 1.6, gain: 0.3 });
  }
  function heartUpdate(dt, G) {
    const F = TG.F, AR = TG.AR;
    for (const h of WV.hearts) {
      if (!h.on) continue;
      h.t += dt; h.pr = h.r; h.px = h.x; h.pz = h.z;
      h.r += h.speed * dt;
      h.x = h.ox + Math.sin(h.dir) * h.r; h.z = h.oz + Math.cos(h.dir) * h.r;
      const wall = Math.abs(h.x) > AR.bx - 0.4 || Math.abs(h.z) > AR.bz - 0.4 || (!h.big && AR.blocked(h.x, h.z, 0.3)); // 큰 하트는 상자를 넘어감(줄 위 안개를 끝까지), 작은 하트는 상자에서도 퐁
      if (wall) { heartPop(h, G, true); continue; }
      if (h.r >= h.range) { heartPop(h, G, h.big); continue; } // 사거리 끝에서도 큰 하트는 넷으로
      if (h.big) { // 지나는 길 곁 상자: 숨은 음표가 튀어나옴(한 상자 한 번). 상자 색으로 반짝
        for (let ci = 0; ci < AR.colliders.length; ci++) {
          const c = AR.colliders[ci]; if (c.kind !== 'crate' || h.lit.has(ci)) continue;
          if (Math.hypot(c.x - h.x, c.z - h.z) < HEART.crateR) {
            h.lit.add(ci); WV.crateLit++;
            F.dropNotes(c.x, c.z, HEART.crateNotes, 1.2, true);
            const FX = TG.FX; FX.emit(FX.CELL.glow, c.x, 1.3, c.z, { life: 0.4, size: 1.6, size1: 3.2, color: [0.9, 2.3, 2.5], alpha: 0.55 });
            for (let i = 0; i < 5; i++) FX.emit(FX.CELL.note, c.x, 1.6, c.z, { vx: TG.fra(-2, 2), vy: TG.fra(3, 6), vz: TG.fra(-2, 2), life: 0.6, size: 0.45, size1: 0.15, color: [0.9, 2.3, 2.5], grav: 7, pop: true, vrot: TG.fra(-3, 3), rot: 0 });
            FX.text('숨은 음표!', c.x, 2.6, c.z, 'word'); TG.A.pick();
          }
        }
      }
      const hits = [];
      for (const u of F.list) {
        if (u.state !== 'live' || h.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const ux = u.x - h.px, uz = u.z - h.pz, sx = h.x - h.px, sz = h.z - h.pz, l2 = sx * sx + sz * sz || 1e-9;
        const k = TG.clamp((ux * sx + uz * sz) / l2, 0, 1), d = Math.hypot(ux - sx * k, uz - sz * k);
        if (d < h.rad + u.r * u.scale) hits.push([k, u]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      for (const [k, u] of hits) { h.hit.add(u.id); u.byBig = true; WV.heartHits++; G.hitUnit(u, 99, h.px + (h.x - h.px) * k, h.pz + (h.z - h.pz) * k, true, 3, [2.3, 0.9, 1.7]); }
      const bs = F.boss;
      if (bs && bs.state === 'fight' && !h.hit.has('boss') && Math.hypot(bs.x - h.x, bs.z - h.z) < bs.r * bs.scale + h.rad) {
        h.hit.add('boss');
        G.hitBoss(h.big ? Math.round(12 * (1 + (h.lv || 0) * 0.25)) : 3, h.x, h.z, true);
        if (!h.big) { heartPop(h, G, false); continue; }
      }
    }
  }
  function heartDraw(al) {
    for (const h of WV.hearts) {
      if (!h.on) continue;
      const x = TG.lerp(h.px, h.x, al), z = TG.lerp(h.pz, h.z, al);
      h.g.position.set(x, (h.big ? 1.9 : 1.5) + Math.sin(h.t * 14) * 0.1, z);
      h.body.rotation.y = Math.PI / 2 + Math.sin(h.t * 6) * 0.35; // 살랑살랑 좌우로 돌며 날아감(하트가 늘 조금 보이게)
      if (TG.fr() < (h.big ? 0.9 : 0.4)) TG.FX.emit(TG.FX.CELL.heart, x + TG.fra(-0.3, 0.3), 1.4 + TG.fra(0, 0.8), z + TG.fra(-0.3, 0.3), { life: 0.3, size: h.big ? 0.5 : 0.3, size1: 0, color: [2.4, 0.9, 1.7] });
    }
  }

  // ── 규칙 계산 ──
  WV.update = function (dt, G) {
    for (let i = 0; i < WV.pending.length; i++) {
      const p = WV.pending[i]; p.t -= dt;
      if (p.t <= 0) { if (p.berry) launchBerry(p.dir, p.level); else if (p.whistle) launchWhistle(p.dir, p.level); else if (p.pixel) launchPixel(p.dir, p.level); else launch(p.dir, p.level); WV.pending.splice(i, 1); i--; }
    }
    berryUpdate(dt, G); whistleUpdate(dt, G); pixelUpdate(dt, G); heartUpdate(dt, G);
    const F = TG.F;
    for (const w of WV.pool) {
      if (!w.on) continue;
      const L = w.L;
      w.t += dt; w.pr = w.r;
      w.r = 0.5 + L.speed * w.t * (1 - Math.min(0.35, w.t * 0.3));
      if (w.r >= L.range) { w.done = true; }
      if (w.done) { w.fade -= dt * 7; if (w.fade <= 0) { w.on = false; w.g.visible = false; } continue; }
      // 맞힘 판정: 호 띠 안 + 각도 안 (관통). 대상은 안개·기계뿐
      for (const u of F.list) {
        if (u.state !== 'live' || w.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const dx = u.x - w.x, dz = u.z - w.z, d = Math.hypot(dx, dz);
        const ur = u.r * u.scale;
        if (Math.abs(d - w.r) > L.band * 0.5 + ur) continue;
        const ang = Math.abs(TG.angDiff(w.dir, Math.atan2(dx, dz)));
        if (ang > L.half + Math.atan2(ur, Math.max(d, 0.5))) continue;
        w.hit.add(u.id);
        G.hitUnit(u, L.dmg, w.x, w.z, false, w.level);
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
    berryDraw(al); whistleDraw(al); pixelDraw(al); heartDraw(al);
    for (const w of WV.pool) {
      if (!w.on) continue;
      const L = w.L, r = TG.lerp(w.pr, w.r, al);
      const grow = 0.55 + Math.min(1, r / L.range) * 0.45;
      w.parts.forEach((m, k) => {
        const rr = Math.max(0.3, r - k * 1.05);                 // 호 사이를 띄워 「)))」 로 읽히게
        const hh = L.h * 0.58 * grow * (1 - k * 0.2);
        m.scale.set(rr, hh, rr);
        m.material.uniforms.uA.value = (1 - k * 0.22) * w.fade * (w.t < 0.04 ? w.t / 0.04 : 1);
      });
      // 호 끝 반짝이
      if (TG.fr() < 0.5) {
        const side = TG.fr() < 0.5 ? -1 : 1, a = w.dir + side * L.half * 0.85;
        TG.FX.emit(TG.FX.CELL.sparkle, w.x + Math.sin(a) * r, 1.1 + TG.fra(-0.3, 0.3), w.z + Math.cos(a) * r, { life: 0.22, size: 0.4, size1: 0, color: [2.5, 1.2, 0.8] });
      }
    }
  };
})();
