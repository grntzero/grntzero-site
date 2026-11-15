/* 톱니골 던전 — 「소리 파동」: 「소리」 버튼을 누르는 동안 나가는 빨간 호 3겹(겨눈 방향), 관통. update = 규칙 계산 / draw = 그리기
   11-16 베리 「베리 방울」(TG.hero.shot === 'berry'): 핑크 열매 방울이 데굴데굴 굴러가다 닿으면(또는 사거리 끝에서) 퐁 — 둘레 안개를 함께 터뜨림, 지나간 자리에 작은 꽃(js/flowers.js) */
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
  };
  WV.reset = function () { WV.pool.forEach((w) => { w.on = false; w.g.visible = false; }); WV.berries.forEach((b) => { b.on = false; b.g.visible = false; }); WV.pending.length = 0; id = 1; WV.berryPops = 0; };
  WV.activeCount = () => WV.pool.filter((w) => w.on).length + WV.berries.filter((b) => b.on).length;

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
    const berry = !!(TG.hero && TG.hero.shot === 'berry');
    for (let i = 0; i < n; i++) WV.pending.push({ t: 0.05, dir: dir + (i / n) * Math.PI * 2, level, berry });
    if (berry) { TG.A.play('sfx_pop', { rate: 1.5 + level * 0.1 + TG.fra(-0.05, 0.05), gain: 0.4 + level * 0.1 }); TG.A.pick(); }
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

  // ── 규칙 계산 ──
  WV.update = function (dt, G) {
    for (let i = 0; i < WV.pending.length; i++) {
      const p = WV.pending[i]; p.t -= dt;
      if (p.t <= 0) { if (p.berry) launchBerry(p.dir, p.level); else launch(p.dir, p.level); WV.pending.splice(i, 1); i--; }
    }
    berryUpdate(dt, G);
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
    berryDraw(al);
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
