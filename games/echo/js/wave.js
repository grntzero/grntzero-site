/* 톱니골 던전 — 「소리 파동」: 「소리」 버튼을 누르는 동안 나가는 호 3겹(겨눈 방향), 관통. update = 규칙 계산 / draw = 그리기
   11-16 대표 지시(밸런스 개편): 기본 소리는 주인공 넷 모두 같은 파형(WV.LV 한 표 — 범위·위력·간격 같음). 주인공마다 색·곁 알갱이·소리만 다름(heroes.js style):
     세포 「소리 방울」 빨강·음표 / 허조교 「삑!」 올리브·음표+출발 삑 / 모쉬 「픽셀 빛줄」 시안·픽셀 점(호 끝에 네모 점) / 베리 「베리 방울」 핑크·꽃(파동이 끝난 자리에 작은 꽃 자국)
   큰 소리 「픽셀 빔!」(모쉬, WV.beam): 큐브 머리에서 4방향 빛줄기가 나오자마자 빠르게 두 바퀴 돌며(0.5초) 닿는 안개 전부 퐁(큰 소리 판정 99). 머리도 같이 돎(player.js). 게임 흐름은 js/game.js bigBeam
   11-17 대표 피드백(필살기평타개편_20261117): 기본 소리가 주인공마다 다름 —
     모쉬 「푸슝 빔」(style.bolt, WV.bolts): 한 발에 한 명 맞는 곧은 빛(사이클롭스 눈빔). 카드 「튕기는 빔」(bounce: 맞은 안개에서 가까운 다른 안개로 튕김, 1단 2명·단마다 +1·4단 5명)·「지나는 빔」(pierce: 뚫고 지나감)
     허조교 「올려놔!」(style.shout): 고함 파형 — 처음 맞은 안개 하나만 피해 + 0.5초 멈춤(u.stun), 그 둘레(SHOUT.splash) 안개는 피해 없이 같이 멈춤
     세포·쎄니·베리는 전처럼 파형(WV.LV 공통)
   쎄니 큰 소리 「퍼플팡팡!」(WV.mist): 한 바퀴 돌며 물감 → 둥근 물감 구역(MIST.dur 초) 안 안개 느려짐+천천히 피해(한 방 X), 바닥에 남은 물감(stainDur)도 밟으면 느려짐(MIST.floorSlow, 11-17 대표: 켜짐) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const WV = (TG.WV = { list: [], pending: [], bolts: [], mists: [] });
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
    // 모쉬 「픽셀 빔!」: 시안 빛줄기 4개(앞·왼·오·뒤) — 곧게 뻗는 광선: 길쭉한 상자 + 밝은 심지 + 바깥 옅은 빛(11-17 보강)
    const R = TG.R;
    const bmMat = R.toon({ color: 0x2fe0f0, gain: 1.5, rim: 0.6, spec: 0.3, emissive: 0x0a6a74, ei: 0.9 }), coreMat = new T.MeshBasicMaterial({ color: 0xeafeff, transparent: true, opacity: 0.95 });
    const haloMat = new T.MeshBasicMaterial({ color: 0x7ff3ff, transparent: true, opacity: 0.28, depthWrite: false });
    const bg = new T.Group(); bg.visible = false; scene.add(bg);
    const arms = [];
    for (let k = 0; k < 4; k++) {
      const arm = new T.Group(); arm.rotation.y = k * Math.PI / 2; bg.add(arm);
      const box = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 1), bmMat); box.position.z = 0.5; box.renderOrder = 14; arm.add(box); R.addOutline(box, 1.0).renderOrder = 14;
      const core = new T.Mesh(new T.BoxGeometry(0.18, 0.18, 1), coreMat); core.position.z = 0.5; core.renderOrder = 15; arm.add(core);
      const halo = new T.Mesh(new T.BoxGeometry(0.95, 0.95, 1), haloMat); halo.position.z = 0.5; halo.renderOrder = 13; arm.add(halo);
      arms.push(arm);
    }
    WV.beam = { on: false, g: bg, arms, t: 0, x: 0, z: 0, dir: 0, len: 0, lv: 0, hit: new Set(), pops: 0, spins: 0 };
    WV.beamPops = 0;
    // 모쉬 기본 「푸슝 빔」: 짧은 빛 토막(픽셀 느낌 네모) 풀
    const bMat = R.toon({ color: 0x2fe0f0, gain: 1.5, rim: 0.5, spec: 0.3, emissive: 0x0a6a74, ei: 0.8 }), bCore = new T.MeshBasicMaterial({ color: 0xeafeff });
    WV.boltPool = [];
    for (let i = 0; i < 32; i++) { // 32: 파동+1 3단(4발)×빠르게 3단×fastAll 때 20개 넘게 겹칠 수 있음(검토 ②5)
      const g = new T.Group(); g.visible = false; scene.add(g);
      const box = new T.Mesh(new T.BoxGeometry(0.42, 0.42, BOLT.len), bMat); box.renderOrder = 14; g.add(box); R.addOutline(box, 0.9).renderOrder = 14;
      const core = new T.Mesh(new T.BoxGeometry(0.16, 0.16, BOLT.len * 1.05), bCore); core.renderOrder = 15; g.add(core);
      WV.boltPool.push({ g, box, core, on: false });
    }
    // 쎄니 「퍼플팡팡!」 물감 구역: 바닥 둥근 보라 얼룩(안쪽 옅고 가장자리 진함) 3개
    WV.mistPool = [];
    for (let i = 0; i < 3; i++) {
      const m = new T.Mesh(new T.CircleGeometry(1, 48), new T.ShaderMaterial({
        uniforms: { uA: { value: 0 }, uT: { value: 0 }, uCol: { value: new T.Color(0xa46bff) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: ['uniform float uA; uniform float uT; uniform vec3 uCol; varying vec2 vUv;',
          'void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;',
          ' float an = atan(p.x, p.y); float edge = 1.0 - smoothstep(0.86 + 0.05 * sin(an * 7.0 + uT * 0.8), 1.0, r);', // 물감 얼룩: 가장자리가 울퉁불퉁
          ' float rim = smoothstep(0.7, 0.92, r) * edge; float blob = 0.5 + 0.5 * sin(r * 9.0 - uT * 2.0 + an * 3.0);',
          ' float a = uA * edge * (0.45 + 0.35 * rim + 0.12 * blob); gl_FragColor = vec4(uCol * (0.85 + 0.5 * rim), a); }'].join('\n'),
        transparent: true, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.065; m.renderOrder = 4; m.visible = false; m.frustumCulled = false; scene.add(m);
      WV.mistPool.push(m);
    }
  };
  WV.reset = function () {
    WV.pool.forEach((w) => { w.on = false; w.g.visible = false; }); WV.pending.length = 0; id = 1;
    if (WV.beam) { WV.beam.on = false; WV.beam.g.visible = false; WV.beam.hit.clear(); } WV.beamPops = 0; WV.flowers = 0;
    if (WV.boltPool) WV.boltPool.forEach((b) => { b.on = false; b.g.visible = false; });
    WV.bolts.length = 0; WV.boltHits = 0; WV.boltChains = 0; WV.boltPierces = 0; WV.shoutStuns = 0; WV.shoutHits = 0;
    WV.mists.length = 0; WV.mistDots = 0; WV.mistBoss = 0; if (WV.mistPool) WV.mistPool.forEach((m) => { m.visible = false; });
  };
  WV.activeCount = () => WV.pool.filter((w) => w.on).length;

  // 단계 + 카드 효과를 합친 실제 값 (파형·푸슝 빔·고함 공통 표 WV.LV — 빔·고함은 아래 BOLT·SHOUT 로 조정)
  WV.stat = function (level) {
    const B = WV.LV[level], m = TG.G.mod || { size: 0, fast: 0 };
    const k = SIZES[m.size], st = TG.hero && TG.hero.style;
    const o = { range: B.range * k, speed: B.speed * (1 + m.size * 0.05), half: Math.min(1.25, B.half * (1 + (k - 1) * 0.8)), dmg: B.dmg, h: B.h * (1 + m.size * 0.1), band: B.band * k, cd: B.cd * [1, 0.88, 0.78, 0.7][m.fast], sizeLv: m.size };
    if (st && st.bolt) { o.range = B.range * BOLT.rangeK * k; o.cd = o.cd * BOLT.cdK; o.dmg = B.dmg + BOLT.dmgAdd[level]; o.bossDmg = B.dmg * BOLT.bossK; o.r = BOLT.r + m.size * 0.08; o.bounce = m.bounce || 0; o.pierce = m.pierce || 0; } // bounce = 튕기는 횟수(1단 1번 → 2명 … 4단 4번 → 5명)
    if (st && st.shout) { o.range = B.range * SHOUT.rangeK * k; o.cd = o.cd * SHOUT.cdK; o.dmg = B.dmg + SHOUT.dmgAdd[level]; o.bossDmg = B.dmg * SHOUT.bossK; o.stun = SHOUT.stun; o.splash = SHOUT.splash * k; }
    return o;
  };
  // 11-17 기본 소리 개편 수치(초안 — 밸런스 측정으로 맞춤, 기록.md 3절)
  //  BOLT: 한 발 한 명이라 파형(세 마리 동시)보다 약함 → 간격 짧게·세기 보강. bounce = 튕기는 수(1단 2명 … 4단 5명), pierce = 뚫는 수
  const BOLT = { spd: 30, len: 1.5, r: 0.42, rangeK: 1.0, cdK: 0.52, dmgAdd: [1, 1, 1, 2], chainR: 7.0, bossK: 0.69 }; // 간격 0.42×0.52≈0.22초(푸슝푸슝 — 한 발 한 명이라 안개 치우기가 파형보다 느려 짧게), bossK: 보스엔 파형 표 세기 × 0.69 → 초당 보스 피해 ≈ 3.2(파형 2.4 보다 조금 위: 보스를 겨눌 땐 안개를 못 치우는 몫). 측정 r2 ×0.6/cd0.25 +12% · r3 ×1.2 −25% · r4 ×0.8 −10%(카드 있음) → r5. 튕김은 보스로 안 감(직접 맞을 때만)
  //  SHOUT: 처음 맞은 하나만 피해 + 멈춤(stun 초), 둘레 splash 안 안개도 같이 멈춤(피해 X) → 세기 보강·간격 조금 짧게
  const SHOUT = { stun: 0.5, splash: 4.0, rangeK: 0.95, cdK: 0.62, dmgAdd: [1, 1, 2, 2], bossK: 1.02 }; // 간격 0.42×0.62≈0.26초(1층이 느려 r3·r4 +17% → 짧게), 둘레 4.0, bossK: 보스엔 × 1.02 → 초당 3.9(하나만 맞히는 대신). 측정 r2 ×0.8 +33% · r3 ×1.6 −16% · r4 ×1.15/cd0.29 −5%(카드 있음) → r5
  //  MIST(쎄니 큰 소리): dur 초 동안 느려짐(slow)+dot 초마다 dmg(보스는 bossEvery 초마다 bossDmg → 합 12), 끝나면 stainDur 초 바닥 물감(밟으면 stainSlow — floorSlow 스위치, 11-17 대표: 켜짐)
  const MIST = { dur: 3.0, slow: 0.45, dot: 0.5, dmg: 1, bossEvery: 0.5, bossDmg: 2, stainDur: 4.0, stainSlow: 0.65, floorSlow: true };
  WV.BOLT = BOLT; WV.SHOUT = SHOUT; WV.MIST = MIST;

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
    if (st.bolt) { // 모쉬 「푸슝 빔」: 곧은 빛 한 발(「파동 +1」이면 좁게 벌려 여러 발)
      for (let i = 0; i < n; i++) WV.pending.push({ t: 0.03, dir: dir + (i / n) * Math.PI * 2, level, bolt: true }); // 「파동 +1」은 파형과 같게 둥글게 고르게(좁게 벌리면 보스에게 전부 맞아 보스전이 너무 빨라짐 — r1)
      TG.A.play('sfx_pick', { rate: 2.3 + level * 0.15, gain: 0.3 }); TG.A.play('sfx_wave', { rate: 2.0 + level * 0.1, gain: 0.22 + level * 0.06 }); // 푸슝(짧고 높게)
      if (level >= 2) { TG.FX.shake(0.1 + level * 0.04); TG.FX.punch(0.012 * level); }
      return;
    }
    for (let i = 0; i < n; i++) WV.pending.push({ t: 0.05, dir: dir + (i / n) * Math.PI * 2, level });
    if (st.flowers) { TG.A.play('sfx_pop', { rate: 1.5 + level * 0.1 + TG.fra(-0.05, 0.05), gain: 0.4 + level * 0.1 }); TG.A.play('sfx_wave', { rate: 1.2 + level * 0.08, gain: 0.4 + level * 0.1 }); } // 베리: 퐁 + 파동 높게
    else if (st.shout) { TG.A.countBeep(true); TG.A.play('sfx_wave', { rate: 0.95 + level * 0.1, gain: 0.5 + level * 0.1 }); TG.A.play('sfx_bonk', { rate: 1.6, gain: 0.25 }); } // 허조교: 호각 + 낮고 굵은 고함 파형
    else if (st.beep) { TG.A.countBeep(true); TG.A.play('sfx_wave', { rate: 1.7 + level * 0.12, gain: 0.35 + level * 0.1 }); } // (옛 허조교) 출발 삑 + 파동 샘플 높게
    else if (st.pixel) { TG.A.play('sfx_pick', { rate: 1.9 + level * 0.1, gain: 0.28 }); TG.A.play('sfx_wave', { rate: 1.3 + level * 0.1, gain: 0.3 + level * 0.08 }); } // (옛 모쉬) 삐빅 + 파동
    else if (st.stars) { TG.A.play('sfx_pick', { rate: 1.5 + level * 0.1 + TG.fra(-0.05, 0.05), gain: 0.3 }); TG.A.play('sfx_wave', { rate: 1.45 + level * 0.08, gain: 0.35 + level * 0.1 }); } // 쎄니: 반짝 + 파동 높게
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

  // ── 모쉬 기본 「푸슝 빔」: 곧은 빛 한 발 → 처음 닿은 안개 하나(또는 보스) 피해. 카드 「튕기는 빔」이면 가까운 다른 안개로 튕김, 「지나는 빔」이면 뚫고 계속 ──
  function launchBolt(dir, level) {
    const b = WV.boltPool.find((q) => !q.on); if (!b) return;
    const P = TG.PL, L = WV.stat(level);
    const ox = P.x + Math.sin(dir) * 0.6, oz = P.z + Math.cos(dir) * 0.6;
    Object.assign(b, { on: true, id: id++, x: ox, z: oz, px: ox, pz: oz, dir, level, L, trav: 0, range: L.range, hit: new Set(), bounce: L.bounce || 0, pierce: L.pierce || 0, chained: 0, fade: 1, done: false, t: 0 });
    b.g.visible = true; b.g.position.set(ox, 1.55 + level * 0.1, oz); b.g.rotation.y = dir;
    const k = 1 + level * 0.18 + (L.r - BOLT.r) * 2; b.box.scale.set(k, k, 1); b.core.scale.set(k, k, 1);
    WV.bolts.push(b);
    const FX = TG.FX, mx = P.x + Math.sin(dir) * 1.2, mz = P.z + Math.cos(dir) * 1.2;
    FX.emit(FX.CELL.glow, mx, 1.5, mz, { life: 0.1, size: 1.0 + level * 0.3, size1: 1.6 + level * 0.3, color: [0.6, 1.7, 1.9], alpha: 0.5 });
    for (let i = 0; i < 2 + level; i++) FX.emit(FX.CELL.dot, mx, 1.5, mz, { vx: Math.sin(dir + TG.fra(-0.5, 0.5)) * 5, vy: TG.fra(0.5, 2), vz: Math.cos(dir + TG.fra(-0.5, 0.5)) * 5, life: 0.3, size: 0.3, size1: 0.05, color: [0.8, 2.2, 2.5], drag: 4, rot: 0 });
  }
  // 빔 토막(앞 자리→지금 자리)과 둥근 안개가 닿았나
  function segHit(ax, az, bx, bz, ux, uz, rr) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-6;
    let k = ((ux - ax) * dx + (uz - az) * dz) / l2; k = TG.clamp(k, 0, 1);
    const cx = ax + dx * k - ux, cz = az + dz * k - uz;
    return cx * cx + cz * cz <= rr * rr;
  }
  function boltUpdate(dt, G) {
    const F = TG.F, FX = TG.FX;
    for (let i = 0; i < WV.bolts.length; i++) {
      const b = WV.bolts[i]; b.t += dt;
      if (b.done) { b.fade -= dt * 9; if (b.fade <= 0) { b.on = false; b.g.visible = false; WV.bolts.splice(i, 1); i--; } continue; }
      const L = b.L, step = BOLT.spd * dt;
      b.px = b.x; b.pz = b.z; b.x += Math.sin(b.dir) * step; b.z += Math.cos(b.dir) * step; b.trav += step;
      let hitU = null, hd = 1e9;
      for (const u of F.list) { // 이번 걸음에 닿은 것 중 가장 가까운 하나
        if (u.state !== 'live' || b.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue;
        const ur = u.r * u.scale + L.r;
        if (!segHit(b.px, b.pz, b.x, b.z, u.x, u.z, ur)) continue;
        const d = (u.x - b.px) ** 2 + (u.z - b.pz) ** 2; if (d < hd) { hd = d; hitU = u; }
      }
      const bs = F.boss, bossIn = !hitU && bs && bs.state === 'fight' && !b.hit.has('boss') && segHit(b.px, b.pz, b.x, b.z, bs.x, bs.z, bs.r * bs.scale * 0.9 + L.r);
      if (hitU || bossIn) {
        const hx = hitU ? hitU.x : bs.x, hz = hitU ? hitU.z : bs.z, spark = [0.8, 2.2, 2.5];
        if (hitU) { b.hit.add(hitU.id); G.hitUnit(hitU, L.dmg, b.px, b.pz, false, b.level, spark); }
        else { b.hit.add('boss'); G.hitBoss(L.bossDmg, b.x, b.z, false, b.level); }
        WV.boltHits++;
        FX.emit(FX.CELL.glow, hx, 1.4, hz, { life: 0.12, size: 0.8, size1: 1.6, color: [0.7, 1.9, 2.1], alpha: 0.5 });
        // 튕김: 아직 안 맞은 가장 가까운 안개(보스 포함)로 방향을 꺾음
        let next = null;
        if (b.bounce > 0) {
          let bd = BOLT.chainR * BOLT.chainR;
          for (const u of F.list) { if (u.state !== 'live' || b.hit.has(u.id) || u.spawnT < 0.3 || u.kind === 'cocoon') continue; const d = (u.x - hx) ** 2 + (u.z - hz) ** 2; if (d < bd - 1e-9 || (next && Math.abs(d - bd) <= 1e-9 && u.id < next.id)) { bd = d; next = u; } }
        }
        if (next) {
          b.bounce--; b.chained++; WV.boltChains++;
          b.x = hx; b.z = hz; b.dir = Math.atan2(next.x - hx, next.z - hz); b.range = b.trav + Math.hypot(next.x - hx, next.z - hz) + 1.0;
          b.g.position.set(hx, 1.55 + b.level * 0.1, hz); b.g.rotation.y = b.dir;
          for (let k = 0; k < 4; k++) FX.emit(FX.CELL.dot, hx, 1.5, hz, { vx: TG.fra(-3, 3), vy: TG.fra(1, 3), vz: TG.fra(-3, 3), life: 0.25, size: 0.28, size1: 0, color: [1.2, 2.4, 2.5], rot: 0 });
          TG.A.play('sfx_pick', { rate: 2.6 + b.chained * 0.15, gain: 0.25 }); // 타다닥
        } else if (b.pierce > 0 && hitU) { b.pierce--; WV.boltPierces++; }
        else { b.done = true; FX.emit(FX.CELL.sparkle, hx, 1.6, hz, { life: 0.2, size: 0.6, size1: 0, color: [1.5, 2.4, 2.5] }); }
      }
      if (!b.done && b.trav >= b.range) { b.done = true; }
    }
  }
  function boltDraw(al) {
    for (const b of WV.bolts) {
      if (!b.on) continue;
      const x = TG.lerp(b.px, b.x, al), z = TG.lerp(b.pz, b.z, al);
      b.g.position.x = x; b.g.position.z = z; b.g.rotation.y = b.dir;
      const s = Math.min(1, b.t / 0.06) * b.fade;
      b.g.scale.set(s, s, Math.max(0.05, Math.min(1, b.trav / BOLT.len)) * s);
      if (TG.fr() < 0.5) TG.FX.emit(TG.FX.CELL.dot, x - Math.sin(b.dir) * TG.fra(0.3, 1.2), 1.5 + TG.fra(-0.15, 0.15), z - Math.cos(b.dir) * TG.fra(0.3, 1.2), { life: 0.18, size: 0.26, size1: 0, color: [0.8, 2.2, 2.5], rot: 0 }); // 지나간 자리 픽셀 점
    }
  }

  // ── 허조교 기본 「올려놔!」: 고함 파형이 처음 닿은 안개 하나 → 피해 + stun 초 멈춤, 둘레(splash) 안개는 피해 없이 같이 멈춤(스턴 스플래시). 파형은 거기서 끝남 ──
  function shoutHit(w, u, G) {
    const L = w.L, F = TG.F, FX = TG.FX;
    G.hitUnit(u, L.dmg, w.x, w.z, false, w.level, [2.0, 2.2, 1.0]);
    let n = 0;
    for (const v of F.list) {
      if (v.state !== 'live' || v.kind === 'cocoon' || v.spawnT < 0.3) continue;
      const d = Math.hypot(v.x - u.x, v.z - u.z);
      if (v !== u && d > L.splash + v.r * v.scale) continue;
      if (!(v.stun > 0)) n++;
      v.stun = Math.max(v.stun || 0, L.stun); v.stunK = 0;
      FX.emit(FX.CELL.star, v.x, v.y + 1.5 * v.scale, v.z, { vy: 1.5, life: 0.35, size: 0.42, size1: 0.1, color: [2.4, 2.3, 1.0], rot: 0, vrot: 7 }); // 머리 위 별(뚱 멈춤 표시)
    }
    WV.shoutHits++; WV.shoutStuns += n;
    FX.ring(u.x, u.z, { r0: 0.4, r1: L.splash, dur: 0.28, color: 0xdce383, width: 0.14, alpha: 0.7, hdr: 1.3 });
    w.done = true;
  }

  // ── 모쉬 큰 소리 「픽셀 빔!」(11-17: 나오자마자 빠르게 돎 — 멈춤 0.08초·회전 0.5초, 머리에 붙어 머리와 같이 돎) ──
  const BEAM = { hold: 0.08, spin: 0.5, turns: 2, grow: 0.1, half: 0.2, fade: 0.2, bossDmg: 12 }; // turns 정수: 머리가 빔과 같이 돌므로 끝나면 앞을 봄(검토 ②3 — 1.5 바퀴면 뒤를 본 채 끝남)
  WV.BEAM = BEAM;
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
    const P = TG.PL, hp = P.headW; // 머리(큐브) 세계 위치(player.js 가 매 프레임 갱신) — 빔은 머리에서 나옴
    if (hp) b.g.position.set(hp.x, hp.y + 0.45, hp.z); else b.g.position.set(P.rx != null ? P.rx : P.x, 2.2 + (P.y || 0), P.rz != null ? P.rz : P.z);
    const grow = TG.clamp(b.t / BEAM.grow, 0, 1), e = 1 - Math.pow(1 - grow, 3);
    const end = b.t - (BEAM.hold + BEAM.spin), fade = end > 0 ? 1 - TG.clamp(end / BEAM.fade, 0, 1) : 1;
    const len = b.len * e * (0.6 + 0.4 * fade), spinning = b.t >= BEAM.hold && end <= 0;
    b.g.rotation.y = WV.beamAngle();
    for (const arm of b.arms) { arm.scale.set(fade, fade, Math.max(0.01, len)); }
    const y0 = b.g.position.y;
    if (spinning) { for (let k = 0; k < 3; k++) if (TG.fr() < 0.9) { const a = WV.beamAngle() + ((TG.fr() * 4) | 0) * Math.PI / 2, r = TG.fra(2, b.len); TG.FX.emit(TG.FX.CELL.dot, b.g.position.x + Math.sin(a) * r, y0 + TG.fra(-0.3, 0.4), b.g.position.z + Math.cos(a) * r, { life: 0.25, size: 0.32, size1: 0, color: [0.8, 2.3, 2.5] }); } } // 훑고 지나간 자리 픽셀 점 (곧은 광선 느낌)
    else if (!spinning && end <= 0 && TG.fr() < 0.7) { const a = b.dir + ((TG.fr() * 4) | 0) * Math.PI / 2; TG.FX.emit(TG.FX.CELL.sparkle, b.g.position.x + Math.sin(a) * len, y0, b.g.position.z + Math.cos(a) * len, { life: 0.2, size: 0.6, size1: 0, color: [1.5, 2.4, 2.5] }); }
  }

  // ── 쎄니 큰 소리 「퍼플팡팡!」 물감 구역(11-17): x,z 둥근 R 안 — dur 초 동안 안개 느려짐(slow)+dot 초마다 dmg(한 방 X), 보스는 bossEvery 초마다 bossDmg. 끝나면 stainDur 초 바닥 물감(floorSlow 면 밟은 안개 stainSlow) ──
  WV.mistStart = function (x, z, R, o) {
    o = o || {};
    if (WV.mists.length >= 3) WV.mists.shift();
    const m = { x, z, R, t: 0, dur: o.dur != null ? o.dur : MIST.dur, stainDur: o.stainDur != null ? o.stainDur : MIST.stainDur, dotT: 0.25, bossT: 0.25, boss: o.boss !== false, dots: 0, id: id++ };
    WV.mists.push(m);
    return m;
  };
  // 규칙 쪽 — 안개 움직임(fogs.js F.update) 전에 불림(game.js: C.sim 뒤 WV.zones). 느려짐은 cards.js 가 매 걸음 되돌린 slowK 에 곱함
  WV.zones = function (dt, G) {
    const F = TG.F, FX = TG.FX;
    for (let i = 0; i < WV.mists.length; i++) {
      const m = WV.mists[i]; m.t += dt;
      const live = m.t < m.dur, stain = !live && m.t < m.dur + m.stainDur;
      if (!live && !stain) { WV.mists.splice(i, 1); i--; continue; }
      if (stain && !MIST.floorSlow) continue;
      const k = live ? MIST.slow : MIST.stainSlow, R2 = m.R * m.R;
      let dot = false;
      if (live) { m.dotT -= dt; if (m.dotT <= 0) { m.dotT += MIST.dot; dot = true; } }
      for (const u of F.list) {
        if (u.state !== 'live' || u.kind === 'cocoon') continue;
        if ((u.x - m.x) ** 2 + (u.z - m.z) ** 2 > R2) continue;
        u.slowK *= k;
        if (live) {
          u.mistT = 0.12; // 보라 물듦 표시
          if (dot && u.spawnT >= 0.3) { // 도트: 제자리에서(밀려 나가지 않게 — 구역 밖으로 밀리면 도트가 끊김). 도트로 퐁 나면 게이지 안 참(큰 소리 몫) — 살아 나간 안개는 평타로 터뜨리면 다시 참(검토 ①: 매 걸음 byBig 을 찍으면 영구히 막혔음)
            m.dots++; WV.mistDots++; const was = u.byBig; u.byBig = true; const r = G.hitUnit(u, MIST.dmg, u.x, u.z, true, 0, [1.8, 1.2, 2.6]); if (r !== 'pop' && r !== 'convert') u.byBig = was;
          }
        } else u.stainT = 0.12;
      }
      const b = F.boss;
      if (b && b.state === 'fight' && Math.hypot(b.x - m.x, b.z - m.z) < m.R + b.r * b.scale) {
        b.slowK = Math.min(b.slowK, Math.max(0.7, k));
        if (live && m.boss) { m.bossT -= dt; if (m.bossT <= 0) { m.bossT += MIST.bossEvery; WV.mistBoss++; G.hitBoss(MIST.bossDmg, b.x, b.z, true, 1); } }
      }
    }
  };
  function mistDraw(dt, t) {
    for (let i = 0; i < WV.mistPool.length; i++) {
      const mesh = WV.mistPool[i], m = WV.mists[i];
      if (!m) { mesh.visible = false; continue; }
      const live = m.t < m.dur, u = mesh.material.uniforms, left = m.dur + m.stainDur - m.t;
      const grow = TG.clamp(m.t / 0.35, 0, 1), e = 1 - Math.pow(1 - grow, 3);
      mesh.visible = true; mesh.position.set(m.x, 0.065 + i * 0.002, m.z); mesh.scale.set(m.R * e, m.R * e, 1);
      u.uT.value = t; u.uA.value = (live ? 0.62 : 0.4) * Math.min(1, left / 0.6) * Math.min(1, m.t / 0.1);
      u.uCol.value.set(live ? 0xa46bff : 0x8a5be0);
      if (live) for (let k = 0; k < 2; k++) if (TG.fr() < 0.8) { const a = TG.fr() * 6.283, r = Math.sqrt(TG.fr()) * m.R * 0.95; TG.FX.emit(TG.fr() < 0.5 ? TG.FX.CELL.puff : TG.FX.CELL.star, m.x + Math.sin(a) * r, 0.3 + TG.fr() * 1.2, m.z + Math.cos(a) * r, { vy: TG.fra(0.6, 1.6), life: TG.fra(0.5, 0.9), size: TG.fra(0.5, 0.9), size1: 0.15, color: [1.4, 0.9, 2.3], alpha: 0.55, rot: TG.fra(0, 3), vrot: 3 }); } // 보라 안개(물감 김)·작은 별
    }
  }

  // ── 규칙 계산 ──
  WV.update = function (dt, G) {
    for (let i = 0; i < WV.pending.length; i++) {
      const p = WV.pending[i]; p.t -= dt;
      if (p.t <= 0) { if (p.bolt) launchBolt(p.dir, p.level); else launch(p.dir, p.level); WV.pending.splice(i, 1); i--; }
    }
    beamUpdate(dt, G);
    boltUpdate(dt, G);
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
        if (w.st && w.st.shout) { shoutHit(w, u, G); break; } // 허조교 고함: 처음 하나만 + 둘레 멈춤, 파형은 거기서 끝
        G.hitUnit(u, L.dmg, w.x, w.z, false, w.level, w.st && w.st.spark ? [w.st.spark[0] * 0.9, w.st.spark[1] * 0.9, w.st.spark[2] * 0.9] : undefined);
      }
      const b = F.boss;
      if (b && b.state === 'fight' && !w.hit.has('boss') && !w.done) {
        const dx = b.x - w.x, dz = b.z - w.z, d = Math.hypot(dx, dz), br = b.r * b.scale;
        if (Math.abs(d - w.r) < L.band * 0.5 + br) {
          const ang = Math.abs(TG.angDiff(w.dir, Math.atan2(dx, dz)));
          if (ang < L.half + Math.atan2(br, Math.max(d, 0.5))) { w.hit.add('boss'); G.hitBoss(L.bossDmg != null ? L.bossDmg : L.dmg, w.x + Math.sin(w.dir) * w.r, w.z + Math.cos(w.dir) * w.r, false, w.level); if (w.st && w.st.shout) { WV.shoutHits++; w.done = true; } }
        }
      }
    }
  };

  // ── 그리기 ──
  WV.draw = function (al, dt, t) {
    beamDraw();
    boltDraw(al);
    mistDraw(dt || 0, t || 0);
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
        const cell = st.pixel ? TG.FX.CELL.dot : st.stars ? TG.FX.CELL.star : st.flowers && TG.fr() < 0.4 ? TG.FX.CELL.flower : TG.FX.CELL.sparkle;
        TG.FX.emit(cell, w.x + Math.sin(a) * r, 1.1 + TG.fra(-0.3, 0.3), w.z + Math.cos(a) * r, { life: st.stars ? 0.3 : 0.22, size: st.pixel ? 0.3 : st.stars ? 0.34 : 0.4, size1: 0, color: st.spark, rot: 0, vrot: st.stars ? 6 : 0 });
        if (st.stars && TG.fr() < 0.6) { const a2 = w.dir + TG.fra(-1, 1) * L.half * 0.7; TG.FX.emit(TG.FX.CELL.star, w.x + Math.sin(a2) * r, 1.0 + TG.fra(0, 0.6), w.z + Math.cos(a2) * r, { vy: TG.fra(0.5, 1.5), life: 0.35, size: 0.26, size1: 0, color: [1.6, 1.1, 2.5], rot: TG.fra(0, 3), vrot: 4 }); } // 쎄니 퍼플팝: 호 전체에 보라 작은 별이 퍼져 나감
      }
    }
  };
})();
