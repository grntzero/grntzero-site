/* 에코 제로 — 던전별 맵 5개 (2026-11-24 대표 「던전 다 해 봤는데 왜 맵이 다 똑같지?」 → 던전마다 바닥·벽·엄폐물 모양·소품·배경을 확 다르게)
   · 광장(방송 파이프 굴)은 js/arena.js 의 박동탑 광장 그대로. 여기는 세포 돔·허조교 연병장·모쉬 거울 미로·쎄니 댄스홀·베리 과수원.
   · 규칙은 0 변경: 충돌 자리(AR.SPOTS — 상자 9·스피커 6·난간 3·화분 8·가로등 8·분출구 4·탑 1)·움직이는 범위(AR.bx/bz)·맨홀 자리는 모든 맵이 같고, 그 자리에 「다른 모양」의 소품을 세움(그림은 충돌 반지름 안). 기록 재생·test_balance 그대로.
   · 전부 three.js 기본 도형 + 캔버스 텍스처(크레딧 0·그림 생성 0). 단색 소품은 정점 색으로 합쳐 맵마다 메시 몇 개(가까운 것·먼 것 + 가운데 소품) — 드로콜은 광장과 비슷하게.
   · 맵 그룹은 로딩 때 전부 만들어 숨겨 두고(예열에서 한 번 그림) AR.setMap(id) 가 보이기만 바꿈 → 던전 바꿀 때 끊김 없음.
   · 가운데(박동탑 자리)엔 맵마다 큰 소품(단상·타이어 탑·수정·무대·큰 나무): 주인공이 뒤로 가면 반투명(AR.map.center), 박자에 들썩(beatObj).
   · 카메라(위에서 47°·남쪽에서 봄)라 남쪽(+z) 벽은 낮게(≤ 1.6) — 주인공이 아래 가장자리에 있어도 안 가려짐. 어린이 게임: 어둡거나 무서운 것 X(거울 미로도 파스텔). */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const AR = TG.AR;
  AR.mapBuilders = AR.mapBuilders || [];
  const PI = Math.PI;

  // ── 공통 ──
  function start(scene, id) {
    const g = new T.Group(); g.name = 'map_' + id; g.visible = false; scene.add(g);
    const rec = { id, group: g, floorMat: null, center: null, beatObj: null, ambient: null, verts: 0 };
    AR.maps[id] = rec;
    return { g, rec };
  }
  // 바닥: 되풀이 텍스처 + 먼 쪽은 평균색으로 섞음(무아레 ↓). far = 'vec3(r,g,b)'(선형)
  function floor(g, tex, rx, rz, far, o) {
    const K = AR.kit, R = TG.R;
    tex.repeat.set(rx, rz);
    const m = R.toon(Object.assign({ map: tex, rim: 0, fColor: '{ float fd = smoothstep(17.0, 44.0, length(vViewPosition)); diffuseColor.rgb = mix(diffuseColor.rgb, ' + far + ', fd * 0.6); }\n' }, o || {}));
    const f = new T.Mesh(new T.PlaneGeometry(K.W, K.D, 10, 7), m);
    f.rotation.x = -PI / 2; f.receiveShadow = true; g.add(f);
    return m;
  }
  // 바닥 덧그림(투명, 아레나 전체 한 장 — 선·원·길)
  function deco(g, draw, ppu) {
    const K = AR.kit, R = TG.R, P = ppu || 25.6, w = Math.round(K.W * P), h = Math.round(K.D * P);
    const tex = R.canvasTex(w, h, (c) => draw(c, (x) => (x + K.W / 2) * P, (z) => (z + K.D / 2) * P, P, w, h));
    const m = R.toon({ map: tex, rim: 0 }); m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
    const d = new T.Mesh(new T.PlaneGeometry(K.W, K.D, 10, 7), m);
    d.rotation.x = -PI / 2; d.position.y = 0.004; d.receiveShadow = true; d.renderOrder = 1; g.add(d);
    return d;
  }
  // 바깥 땅(울타리 밖 멀리까지)
  function ground(g, col, y) {
    const m = TG.R.toon({ color: col, rim: 0 });
    const p = new T.Mesh(new T.PlaneGeometry(240, 240, 2, 2), m);
    p.rotation.x = -PI / 2; p.position.y = y != null ? y : -0.06; p.receiveShadow = true; g.add(p);
  }
  // 가운데 큰 소품: 따로 메시(제 재질) → 뒤로 가면 반투명
  function center(g, rec) {
    const K = AR.kit, R = TG.R;
    const st = K.mergeLists(g, null, { outline: 0.95 });
    const m = st.near; if (!m) return;
    const ol = m.userData.outline, src = R.outlineMat(0.95, 0.0012);
    ol.material = src.clone(); ol.material.onBeforeCompile = src.onBeforeCompile; ol.material.customProgramCacheKey = src.customProgramCacheKey;
    rec.center = { mats: [m.material, ol.material], objs: [m, ol], fade: 1 };
    rec.beatObj = [m, ol];
  }
  function finish(rec) {
    let v = 0;
    rec.group.traverse((o) => { if (o.isMesh && !o.userData.isOutline && o.geometry && o.geometry.getAttribute('position')) v += o.geometry.getAttribute('position').count * (o.isInstancedMesh ? o.count || 1 : 1); });
    rec.verts = v;
  }
  const seeded = (s0) => { let seed = s0; return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); };
  // 별(5각) 돌출 — 쎄니 댄스홀
  function starGeo(R, r, d) {
    const s = new T.Shape();
    for (let i = 0; i < 10; i++) { const a = PI / 2 + (i / 10) * PI * 2, rr = i % 2 ? r : R; if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    s.closePath();
    const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -d / 2); return g;
  }
  // 난간 자리(BARS): [x0, z0, dx, dz] → 가운데·방향
  const barMid = ([x0, z0, dx, dz]) => ({ x: x0 + dx * 1.2, z: z0 + dz * 1.2, ry: dx ? 0 : PI / 2, dx, dz });
  // 둘레 벽 4면: fn(side, cx, cz, len, ry, h) — side n/s/e/w. S 는 낮게(카메라)
  function walls(fn, hN, hS) {
    const K = AR.kit, fx = K.fx, fz = K.fz;
    fn('n', 0, -fz, K.W + 2 * K.cw, 0, hN); fn('s', 0, fz, K.W + 2 * K.cw, 0, hS);
    fn('w', -fx, 0, K.D, PI / 2, hN); fn('e', fx, 0, K.D, PI / 2, hN);
  }

  // ═══ ① 세포 「메아리 체조 돔」 — 둥근 체육관: 체조 매트 바닥·코트 선·관중석·돔 뼈대, 뜀틀·체조 공·평균대·콘·깃발·트램펄린, 가운데 단상 + 큰 확성기 (빨강·크림·황동)
  AR.mapBuilders.push(function (scene) {
    const K = AR.kit, R = TG.R, { box, cyl, cylBig, sph, ico } = K.geos, add = K.add, addFar = K.addFar, S = AR.SPOTS;
    const { g, rec } = start(scene, 'sefo_dome');
    const RED = 0xd9543f, RED2 = 0xb9463a, CREAM = 0xe9d3a8, CREAM2 = 0xf6ecd6, BRASS = 0xba9a4c, BLUE = 0x5aa7d9, WOOD = 0xc9a46a, TAN = 0xd9c08f, WALL = 0xf1e4cc;
    // 바닥: 체조 매트(크림 고무, 2칸 이음새, 미끄럼 방지 점)
    const tex = R.canvasTex(512, 512, (c) => {
      const rnd = seeded(21);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const x = i * 128, y = j * 128, v = rnd();
        c.fillStyle = '#c9b48c'; c.fillRect(x, y, 128, 128); // 이음새
        c.fillStyle = ['#ecdcbc', '#e7d5b3', '#f0e2c6'][(v * 3) | 0]; c.fillRect(x + 3, y + 3, 122, 122);
        c.fillStyle = 'rgba(255,255,245,0.35)'; c.fillRect(x + 3, y + 3, 122, 4);
        c.fillStyle = 'rgba(120,80,40,0.10)';
        for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(x + 10 + rnd() * 108, y + 10 + rnd() * 108, 2.2, 0, 6.3); c.fill(); }
      }
    }, { repeat: true });
    rec.floorMat = floor(g, tex, K.W / 8, K.D / 8, 'vec3(0.78, 0.66, 0.46)');
    // 코트 선(빨강): 테두리·가운데 원(보스 자리)·가운데 선·구석 원호 + 파랑 매트 두 장
    deco(g, (c, X, Z, u) => {
      c.fillStyle = 'rgba(90,167,217,0.55)'; [[-15.5, 0], [15.5, 0]].forEach(([x, z]) => { c.fillRect(X(x - 2.2), Z(z - 3.6), 4.4 * u, 7.2 * u); });
      c.strokeStyle = 'rgba(217,84,63,0.9)'; c.lineWidth = 0.22 * u; c.lineCap = 'round';
      c.strokeRect(X(-18.2), Z(-12.2), 36.4 * u, 24.4 * u);
      c.beginPath(); c.arc(X(0), Z(1), 5.2 * u, 0, 6.3); c.stroke();
      c.beginPath(); c.arc(X(0), Z(1), 0.5 * u, 0, 6.3); c.fillStyle = 'rgba(217,84,63,0.8)'; c.fill();
      c.beginPath(); c.moveTo(X(-18.2), Z(1)); c.lineTo(X(-5.2), Z(1)); c.moveTo(X(5.2), Z(1)); c.lineTo(X(18.2), Z(1)); c.stroke();
      [[-18.2, -12.2, 0], [18.2, -12.2, PI / 2], [18.2, 12.2, PI], [-18.2, 12.2, -PI / 2]].forEach(([x, z, a]) => { c.beginPath(); c.arc(X(x), Z(z), 3.0 * u, a, a + PI / 2); c.stroke(); });
      c.strokeStyle = 'rgba(217,84,63,0.45)'; c.lineWidth = 0.1 * u; c.beginPath(); c.arc(X(0), Z(-5.2), 5.6 * u, 0, 6.3); c.stroke();
    });
    ground(g, 0xd6c6a2);
    // 둥근 벽(크림, 위 빨간 띠) + 구석 기둥 + 관중석(계단) + 돔 뼈대
    walls((side, cx, cz, len, ry, h) => {
      add(WALL, box, cx, h / 2, cz, ry, len, h, 0.7); add(RED, box, cx, h + 0.12, cz, ry, len + 0.2, 0.24, 0.8);
      add(CREAM, box, cx, 0.5, cz, ry, len, 0.16, 0.76);
    }, 2.6, 1.4);
    [[-K.fx, -K.fz], [K.fx, -K.fz], [-K.fx, K.fz], [K.fx, K.fz]].forEach(([x, z], i) => { add(RED2, cylBig, x, (i < 2 ? 1.7 : 1.0), z, 0, 1.1, i < 2 ? 3.4 : 2.0, 1.1); add(BRASS, sph, x, (i < 2 ? 3.5 : 2.1), z, 0, 0.6, 0.4, 0.6); });
    for (let r = 0; r < 3; r++) { // 관중석: 북·동·서 3단(빨강·크림 번갈아), 남 1단 낮게
      const h = 0.9 * (r + 1), d = 1.7, zz = K.fz + 0.9 + d * r + d / 2, col = r % 2 ? CREAM : RED;
      addFar(col, box, 0, h / 2, -zz, 0, K.W + 4 + d * r * 2, h, d); addFar(CREAM2, box, 0, h + 0.05, -zz + 0.3, 0, K.W + 4 + d * r * 2, 0.1, 0.5);
      addFar(col, box, -(K.fx + 0.9 + d * r + d / 2), h / 2, 0, PI / 2, K.D + 2 + d * r * 2, h, d); addFar(col, box, K.fx + 0.9 + d * r + d / 2, h / 2, 0, PI / 2, K.D + 2 + d * r * 2, h, d);
      if (r === 0) addFar(RED, box, 0, 0.4, zz, 0, K.W + 4, 0.8, d);
    }
    for (let i = 0; i < 7; i++) { // 돔 뼈대(멀리·높이): 북쪽 반원 갈비뼈 7 + 고리 — 남쪽(카메라 쪽)엔 안 둠(주인공을 가림)
      const a = PI + (i / 6) * PI, rr = 36, top = 24, cz = -12, L = Math.hypot(rr, top);
      addFar(CREAM, cyl, Math.cos(a) * rr / 2, top / 2, cz + Math.sin(a) * rr / 2, Math.atan2(-Math.cos(a), -Math.sin(a)), 0.45, L, 0.45, Math.atan2(rr, top), 0);
    }
    addFar(RED, new T.TorusGeometry(34, 0.5, 5, 40), 0, 11.5, -12, 0, 1, 1, 1, PI / 2, 0);
    addFar(BRASS, sph, 0, 24.5, -12, 0, 1.6, 1.0, 1.6);
    // 뜀틀(상자 자리)
    S.crates.forEach(([x, z, ry]) => {
      add(WOOD, box, x, 0.24, z, ry, 1.7, 0.48, 1.25); add(TAN, box, x, 0.7, z, ry, 1.5, 0.44, 1.12); add(RED, box, x, 1.14, z, ry, 1.3, 0.44, 1.0); add(CREAM, box, x, 1.42, z, ry, 1.32, 0.14, 1.02);
    });
    // 큰 체조 공(스피커 자리)
    S.speakers.forEach(([x, z, ry], i) => {
      add(BRASS, new T.TorusGeometry(0.62, 0.08, 5, 14), x, 0.1, z, 0, 1, 1, 1, PI / 2, 0);
      add(i % 2 ? RED : BLUE, sph, x, 1.0, z, ry, 0.95); add(CREAM, new T.TorusGeometry(0.95, 0.07, 5, 20), x, 1.0, z, ry, 1, 1, 1, PI / 2 - 0.3, 0);
      add(CREAM2, sph, x - 0.35, 1.55, z + 0.35, 0, 0.16, 0.1, 0.16);
    });
    // 평균대(난간 자리)
    S.bars.forEach((b) => { const m = barMid(b); add(BRASS, box, m.x, 0.45, m.z, m.ry, 2.9, 0.9, 0.26); add(RED, box, m.x, 0.98, m.z, m.ry, 3.3, 0.16, 0.34); add(CREAM, box, m.x, 1.08, m.z, m.ry, 3.3, 0.06, 0.34); });
    // 콘 표지(화분 자리)
    S.planters.forEach(([x, z]) => { add(CREAM, cyl, x, 0.04, z, 0, 0.6, 0.08, 0.6); add(RED, new T.CylinderGeometry(0.08, 0.42, 0.9, 8), x, 0.52, z, 0, 1); add(CREAM, new T.TorusGeometry(0.3, 0.05, 4, 10), x, 0.56, z, 0, 1, 1, 1, PI / 2, 0); });
    // 깃발 기둥(가로등 자리)
    S.lamps.forEach(([x, z, ry], i) => { add(BRASS, cyl, x, 2.0, z, 0, 0.08, 4.0, 0.08); add(BRASS, sph, x, 4.05, z, 0, 0.14); add(i % 2 ? RED : CREAM, box, x + Math.cos(ry) * 0.55, 3.55, z - Math.sin(ry) * 0.55, ry, 1.0, 0.62, 0.06); });
    // 트램펄린(분출구 자리)
    S.vents.forEach(([x, z]) => { add(BLUE, cyl, x, 0.12, z, 0, 0.82, 0.22, 0.82); add(BRASS, new T.TorusGeometry(0.86, 0.1, 5, 18), x, 0.24, z, 0, 1, 1, 1, PI / 2, 0); });
    S.vents2.forEach(([x, z], i) => { add(i % 2 ? RED : BLUE, cyl, x, 0.03, z, 0, 0.9, 0.06, 0.9); add(CREAM, new T.TorusGeometry(0.9, 0.05, 4, 16), x, 0.06, z, 0, 1, 1, 1, PI / 2, 0); });
    K.mergeLists(g, null);
    // 가운데: 단상 3단 + 큰 황동 확성기 + 큰 공 + 응원 솜방울
    { const tp = S.tower;
      add(CREAM, cylBig, tp.x, 0.25, tp.z, 0, 4.2, 0.5, 4.2); add(RED, cylBig, tp.x, 0.75, tp.z, 0, 3.3, 0.5, 3.3); add(CREAM, cylBig, tp.x, 1.25, tp.z, 0, 2.4, 0.5, 2.4);
      add(BRASS, new T.TorusGeometry(4.2, 0.1, 5, 40), tp.x, 0.5, tp.z, 0, 1, 1, 1, PI / 2, 0);
      add(RED, sph, tp.x - 1.3, 2.7, tp.z - 0.6, 0, 1.25); add(CREAM, new T.TorusGeometry(1.25, 0.09, 5, 20), tp.x - 1.3, 2.7, tp.z - 0.6, 0, 1, 1, 1, PI / 2 - 0.3, 0);
      add(BRASS, new T.CylinderGeometry(1.35, 0.4, 2.6, 12), tp.x + 1.2, 3.4, tp.z + 0.4, 0, 1, 1, 1, PI / 2 - 0.55, 0); add(BRASS, cyl, tp.x + 1.2, 2.1, tp.z - 0.6, 0, 0.3, 1.3, 0.3, 0.5, 0); add(RED2, sph, tp.x + 1.2, 1.9, tp.z - 0.9, 0, 0.4);
      add(CREAM2, sph, tp.x - 2.6, 1.95, tp.z + 1.0, 0, 0.5, 0.42, 0.5); add(CREAM2, sph, tp.x + 2.8, 1.9, tp.z - 1.2, 0, 0.5, 0.42, 0.5);
    }
    center(g, rec); finish(rec);
  });

  // ═══ ② 허조교 「연병장 지하」 — 좁은 지하 복도: 콘크리트·흙 바닥, 가까운 높은 벽(북·동·서)·낮은 철망(남), 모래주머니·타이어 더미·철망 장애물·통·벽 등·납작 타이어, 가운데 타이어 탑 + 깃발 (올리브) — 정본 안전 규칙: 호루라기·구령·타이어만
  AR.mapBuilders.push(function (scene) {
    const K = AR.kit, R = TG.R, { box, cyl, cylBig, sph } = K.geos, add = K.add, addFar = K.addFar, S = AR.SPOTS;
    const { g, rec } = start(scene, 'gunner_camp');
    const CON = 0xa3a391, CON2 = 0x8c8c7a, OLIVE = 0x9aa24f, OLIVE2 = 0x6f7538, TAN = 0xcdb98e, TIRE = 0x3f3f4a, HUB = 0x9a9aa4, YEL = 0xe8c84a, STEEL = 0x6a6f7a;
    const tex = R.canvasTex(512, 512, (c) => { // 콘크리트 + 흙 자국 + 금
      const rnd = seeded(33);
      c.fillStyle = '#9b9a86'; c.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 90; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(120,110,80,0.18)' : 'rgba(200,196,170,0.16)'; c.beginPath(); c.arc(rnd() * 512, rnd() * 512, 8 + rnd() * 26, 0, 6.3); c.fill(); }
      c.strokeStyle = 'rgba(70,65,50,0.35)'; c.lineWidth = 2;
      for (let k = 0; k < 14; k++) { c.beginPath(); let x = rnd() * 512, y = rnd() * 512; c.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; c.lineTo(x, y); } c.stroke(); }
      c.strokeStyle = 'rgba(80,75,60,0.25)'; c.lineWidth = 3; c.strokeRect(1, 1, 255, 255); c.strokeRect(256, 256, 255, 255); c.strokeRect(256, 1, 255, 255); c.strokeRect(1, 256, 255, 255); // 콘크리트 판 이음새(4칸)
    }, { repeat: true });
    rec.floorMat = floor(g, tex, K.W / 8, K.D / 8, 'vec3(0.33, 0.32, 0.25)');
    deco(g, (c, X, Z, u) => { // 노란 차선·타이어 자국·벽 밑 경고 띠·구령대 자리
      c.strokeStyle = 'rgba(232,200,74,0.85)'; c.lineWidth = 0.22 * u; c.setLineDash([1.2 * u, 0.9 * u]); c.beginPath(); c.moveTo(X(-18), Z(1)); c.lineTo(X(18), Z(1)); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(232,200,74,0.6)'; c.lineWidth = 0.14 * u; c.strokeRect(X(-18.4), Z(-12.4), 36.8 * u, 24.8 * u);
      c.strokeStyle = 'rgba(60,55,45,0.28)'; c.lineWidth = 0.32 * u; [[-12, 9, 4], [10, -6, 6], [3, 10, 3.5]].forEach(([x, z, r]) => { [-0.45, 0.45].forEach((o) => { c.beginPath(); c.arc(X(x), Z(z), (r + o) * u, 0.4, 2.9); c.stroke(); }); });
      c.fillStyle = 'rgba(232,200,74,0.5)'; for (let x = -19.5; x < 19.5; x += 2.4) { c.fillRect(X(x), Z(-13.3), 1.2 * u, 0.3 * u); c.fillRect(X(x), Z(13.0), 1.2 * u, 0.3 * u); }
      c.fillStyle = 'rgba(100,95,80,0.35)'; c.fillRect(X(-2.2), Z(-2.8), 4.4 * u, 2.6 * u); c.strokeStyle = 'rgba(232,200,74,0.6)'; c.lineWidth = 0.1 * u; c.strokeRect(X(-2.2), Z(-2.8), 4.4 * u, 2.6 * u);
    });
    ground(g, 0x6f6f62);
    // 높은 콘크리트 벽(북·동·서 4.2) + 기둥 + 위 파이프 + 벽 등 / 남쪽 낮은 턱 + 철망
    walls((side, cx, cz, len, ry, h) => {
      if (side === 's') { add(CON2, box, cx, 0.5, cz, ry, len, 1.0, 0.8); add(STEEL, box, cx, 1.55, cz, ry, len, 0.08, 0.08); add(STEEL, box, cx, 2.1, cz, ry, len, 0.08, 0.08); for (let x = -K.fx; x <= K.fx + 0.01; x += 3.0) add(STEEL, cyl, x, 1.6, cz, 0, 0.07, 1.2, 0.07); return; }
      add(CON, box, cx, h / 2, cz, ry, len + 1.2, h, 1.0); add(YEL, box, cx, 0.42, cz, ry, len + 1.2, 0.22, 1.04); add(CON2, box, cx, h + 0.15, cz, ry, len + 1.6, 0.3, 1.3);
      add(STEEL, cyl, cx, h - 0.4, cz, ry === 0 ? 0 : 0, 0.16, len + 1.2, 0.16, ry === 0 ? 0 : PI / 2, ry === 0 ? PI / 2 : 0);
      const n = Math.round(len / 6);
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (len / n) * i, px = ry === 0 ? cx + t : cx, pz = ry === 0 ? cz : cz + t; add(CON2, box, px, h / 2 + 0.1, pz, 0, 1.3, h + 0.2, 1.3); if (i < n) { const lx = ry === 0 ? cx + t + len / n / 2 : cx + (cx < 0 ? 0.56 : -0.56), lz = ry === 0 ? cz + 0.56 : cz + t + len / n / 2; add('win', box, lx, h - 0.9, lz, 0, 0.5, 0.3, 0.14); add(STEEL, box, lx, h - 0.7, lz, 0, 0.6, 0.1, 0.2); } }
    }, 4.2, 1.0);
    // 모래주머니(상자 자리)
    S.crates.forEach(([x, z, ry]) => { [[-0.45, 0.24, 0.1], [0.45, 0.24, -0.1], [0, 0.66, 0], [-0.35, 0.24, 0.6], [0.3, 0.24, -0.65]].forEach(([ox, y, oz], i) => add(i % 2 ? TAN : 0xbfa97c, sph, x + Math.cos(ry) * ox + Math.sin(ry) * oz, y, z - Math.sin(ry) * ox + Math.cos(ry) * oz, ry + i * 0.4, 0.62, 0.3, 0.42)); });
    // 타이어 더미(스피커 자리)
    S.speakers.forEach(([x, z], i) => { for (let k = 0; k < 3; k++) { add(TIRE, new T.TorusGeometry(0.7, 0.27, 5, 14), x + (k === 2 ? 0.1 : 0), 0.28 + k * 0.5, z, 0, 1, 1, 1, PI / 2, 0); add(HUB, cyl, x + (k === 2 ? 0.1 : 0), 0.28 + k * 0.5, z, 0, 0.36, 0.3, 0.36); } });
    // 낮은 철망 장애물(난간 자리)
    S.bars.forEach((b) => { const m = barMid(b); for (let i = -1; i <= 1; i += 2) add(STEEL, cyl, m.x + m.dx * 1.4 * i, 0.6, m.z + m.dz * 1.4 * i, 0, 0.08, 1.2, 0.08); [0.3, 0.7, 1.1].forEach((h) => add(STEEL, box, m.x, h, m.z, m.ry, 2.9, 0.06, 0.06)); for (let i = -2; i <= 2; i++) add(STEEL, box, m.x + m.dx * 0.5 * i, 0.7, m.z + m.dz * 0.5 * i, m.ry, 0.05, 0.9, 0.05); add(YEL, box, m.x, 1.18, m.z, m.ry, 2.9, 0.1, 0.1); });
    // 통(화분 자리)
    S.planters.forEach(([x, z], i) => { add(i % 2 ? OLIVE : OLIVE2, cyl, x, 0.55, z, 0, 0.56, 1.1, 0.56); add(TIRE, new T.TorusGeometry(0.56, 0.05, 4, 12), x, 0.3, z, 0, 1, 1, 1, PI / 2, 0); add(TIRE, new T.TorusGeometry(0.56, 0.05, 4, 12), x, 0.85, z, 0, 1, 1, 1, PI / 2, 0); add(CON2, cyl, x, 1.12, z, 0, 0.5, 0.06, 0.5); });
    // 벽 등(가로등 자리)
    S.lamps.forEach(([x, z]) => { add(STEEL, cyl, x, 1.3, z, 0, 0.1, 2.6, 0.1); add(STEEL, box, x, 2.7, z, 0, 0.5, 0.22, 0.5); add('win', box, x, 2.5, z, 0, 0.38, 0.22, 0.38); });
    // 납작 타이어(분출구 자리)
    S.vents.forEach(([x, z]) => { add(TIRE, new T.TorusGeometry(0.66, 0.24, 5, 14), x, 0.24, z, 0, 1, 1, 1, PI / 2, 0); add(HUB, cyl, x, 0.2, z, 0, 0.3, 0.2, 0.3); });
    S.vents2.forEach(([x, z]) => { add(TAN, cyl, x, 0.03, z, 0, 0.95, 0.06, 0.95); add(OLIVE2, cyl, x, 0.06, z, 0, 0.5, 0.04, 0.5); });
    K.mergeLists(g, null);
    // 가운데: 콘크리트 받침 + 타이어 탑(3·2·1) + 깃발 기둥(올리브 깃발)
    { const tp = S.tower;
      add(CON, cylBig, tp.x, 0.2, tp.z, 0, 4.2, 0.4, 4.2); add(YEL, new T.TorusGeometry(4.2, 0.08, 4, 40), tp.x, 0.4, tp.z, 0, 1, 1, 1, PI / 2, 0);
      const tire = (x, y, z) => { add(TIRE, new T.TorusGeometry(0.95, 0.36, 6, 16), x, y, z, 0, 1, 1, 1, 0, 0); add(HUB, cyl, x, y, z, 0, 0.46, 0.5, 0.46, PI / 2, 0); };
      [-2.1, 0, 2.1].forEach((x) => tire(tp.x + x, 0.78, tp.z + 0.3)); [-1.05, 1.05].forEach((x) => tire(tp.x + x, 1.5, tp.z + 0.3)); tire(tp.x, 2.22, tp.z + 0.3);
      add(STEEL, cyl, tp.x, 3.2, tp.z - 2.4, 0, 0.1, 5.6, 0.1); add(OLIVE, box, tp.x + 0.75, 5.5, tp.z - 2.4, 0, 1.5, 0.9, 0.08); add(YEL, sph, tp.x, 6.05, tp.z - 2.4, 0, 0.18);
      add(OLIVE2, box, tp.x - 2.8, 0.7, tp.z - 2.0, 0, 1.6, 0.6, 1.2); add(YEL, box, tp.x - 2.8, 1.03, tp.z - 2.0, 0, 1.7, 0.06, 1.3); // 구령대
    }
    center(g, rec); finish(rec);
  });

  // ═══ ③ 모쉬 「거울 네온 미로」 — 반짝이는 어두운 바닥 + 네온 줄, 거울·유리 벽, 밖은 작은 거울 미로, 거울 큐브·거울 기둥·유리 벽·네온 등·네온 기둥·빛 원반, 가운데 수정 (어둡지만 파스텔)
  AR.mapBuilders.push(function (scene) {
    const K = AR.kit, R = TG.R, { box, cyl, cylBig, sph } = K.geos, add = K.add, addFar = K.addFar, S = AR.SPOTS;
    const { g, rec } = start(scene, 'moshee_mirror');
    const LAV = 0xd2daf6, LAV2 = 0xb4bce8, DARK = 0x4a4a78, CY = { hex: 0x7ff2ff, k: 1.6 }, PK = { hex: 0xffa6e6, k: 1.5 }, MINT = { hex: 0xb8ffea, k: 1.4 };
    const tex = R.canvasTex(512, 512, (c) => { // 남색 유리 바닥 + 네온 격자(시안·분홍) + 반짝 조각
      const rnd = seeded(45);
      c.fillStyle = '#34325c'; c.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 70; k++) { c.fillStyle = 'rgba(190,200,255,0.10)'; c.beginPath(); c.arc(rnd() * 512, rnd() * 512, 6 + rnd() * 20, 0, 6.3); c.fill(); }
      for (let i = 0; i < 4; i++) { c.strokeStyle = i % 2 ? 'rgba(127,242,255,0.95)' : 'rgba(255,166,230,0.85)'; c.lineWidth = 4; c.beginPath(); c.moveTo(i * 128 + 1, 0); c.lineTo(i * 128 + 1, 512); c.moveTo(0, i * 128 + 1); c.lineTo(512, i * 128 + 1); c.stroke(); }
      c.strokeStyle = 'rgba(200,210,255,0.35)'; c.lineWidth = 1; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(i * 64 + 32, 0); c.lineTo(i * 64 + 32, 512); c.moveTo(0, i * 64 + 32); c.lineTo(512, i * 64 + 32); c.stroke(); }
      for (let k = 0; k < 12; k++) { c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(((rnd() * 4) | 0) * 128 + 6, ((rnd() * 4) | 0) * 128 + 6, 118, 118); }
    }, { repeat: true });
    rec.floorMat = floor(g, tex, K.W / 8, K.D / 8, 'vec3(0.08, 0.08, 0.16)', { spec: 0.5 });
    deco(g, (c, X, Z, u) => { // 네온 고리(가운데·보스 자리)·미로 무늬 줄(옅게)
      c.lineCap = 'round'; c.strokeStyle = 'rgba(127,242,255,0.8)'; c.lineWidth = 0.2 * u; c.beginPath(); c.arc(X(0), Z(-5.2), 5.0 * u, 0, 6.3); c.stroke();
      c.strokeStyle = 'rgba(255,166,230,0.8)'; c.beginPath(); c.arc(X(0), Z(1), 4.4 * u, 0, 6.3); c.stroke();
      c.strokeStyle = 'rgba(184,255,234,0.35)'; c.lineWidth = 0.16 * u;
      [[-17, -11, -17, -3, -11, -3], [17, 11, 17, 3, 11, 3], [-17, 11, -11, 11, -11, 6], [17, -11, 11, -11, 11, -6], [-6, 12, -6, 8, 2, 8], [6, -12, 6, -8, -2, -8]].forEach(([a, b, c2, d, e, f]) => { c.beginPath(); c.moveTo(X(a), Z(b)); c.lineTo(X(c2), Z(d)); c.lineTo(X(e), Z(f)); c.stroke(); });
    });
    ground(g, 0x2e2c52);
    // 거울·유리 벽(연보라, 위·아래 네온 띠) + 기둥 / 남쪽 낮게
    walls((side, cx, cz, len, ry, h) => {
      add(LAV, box, cx, h / 2, cz, ry, len + 1.0, h, 0.6); add(CY, box, cx, h + 0.08, cz, ry, len + 1.1, 0.16, 0.7); add(PK, box, cx, 0.35, cz, ry, len + 1.1, 0.12, 0.7);
      if (side === 's') return;
      const n = Math.round(len / 5);
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (len / n) * i, px = ry === 0 ? cx + t : cx, pz = ry === 0 ? cz : cz + t; add(LAV2, box, px, h / 2 + 0.2, pz, 0, 0.9, h + 0.4, 0.9); add(i % 2 ? CY : PK, box, px, h + 0.55, pz, 0, 0.5, 0.3, 0.5); }
    }, 3.0, 1.3);
    { const rnd = seeded(77); // 밖 거울 미로(멀리): 유리 판 + 네온 기둥
      for (let k = 0; k < 22; k++) { const side = k % 4, L = 3 + rnd() * 4, h = 2.4 + rnd() * 2.2, ry = rnd() < 0.5 ? 0 : PI / 2; let x, z; if (side === 0) { x = -34 + rnd() * 68; z = -17 - rnd() * 14; } else if (side === 1) { x = -36 - rnd() * 10; z = -14 + rnd() * 28; } else if (side === 2) { x = 24 + rnd() * 12; z = -14 + rnd() * 28; } else { x = -30 + rnd() * 60; z = 17 + rnd() * 8; }
        addFar(LAV, box, x, h / 2, z, ry, L, h, 0.5); addFar(k % 2 ? CY : PK, box, x, h + 0.08, z, ry, L, 0.14, 0.6); }
      for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2, x = Math.cos(a) * 38, z = Math.sin(a) * 26 - 4; addFar(LAV2, box, x, 3.5, z, 0, 0.8, 7, 0.8); addFar(k % 3 ? CY : PK, box, x, 3.5, z, 0, 0.3, 6.6, 0.95); }
    }
    // 거울 큐브(상자 자리)
    S.crates.forEach(([x, z, ry], i) => { add(LAV, box, x, 0.78, z, ry, 1.5, 1.5, 1.5); add(i % 2 ? CY : PK, box, x, 1.56, z, ry, 1.56, 0.1, 1.56); add(DARK, box, x, 0.06, z, ry, 1.6, 0.12, 1.6); });
    // 거울 기둥(스피커 자리)
    S.speakers.forEach(([x, z, ry], i) => { add(LAV, new T.CylinderGeometry(0.55, 0.9, 2.3, 6), x, 1.15, z, ry, 1); add(i % 2 ? PK : CY, new T.TorusGeometry(0.92, 0.07, 4, 12), x, 1.0, z, 0, 1, 1, 1, PI / 2, 0); add(DARK, cyl, x, 0.06, z, 0, 0.95, 0.12, 0.95); add(MINT, new T.CylinderGeometry(0, 0.55, 0.7, 6), x, 2.65, z, ry, 1); });
    // 유리 벽(난간 자리)
    S.bars.forEach((b, i) => { const m = barMid(b); add(LAV, box, m.x, 0.75, m.z, m.ry, 2.9, 1.5, 0.26); add(i % 2 ? CY : PK, box, m.x, 1.55, m.z, m.ry, 3.0, 0.1, 0.32); add(DARK, box, m.x, 0.06, m.z, m.ry, 3.0, 0.12, 0.4); });
    // 네온 등(화분 자리)
    S.planters.forEach(([x, z], i) => { add(DARK, cyl, x, 0.5, z, 0, 0.08, 1.0, 0.08); add(DARK, cyl, x, 0.05, z, 0, 0.5, 0.1, 0.5); add(i % 2 ? PK : CY, sph, x, 1.25, z, 0, 0.42); });
    // 네온 기둥(가로등 자리)
    S.lamps.forEach(([x, z, ry], i) => { add(LAV2, box, x, 2.1, z, ry, 0.5, 4.2, 0.5); add(i % 2 ? CY : PK, box, x, 2.1, z, ry, 0.16, 4.0, 0.56); add(LAV, box, x, 4.3, z, ry, 0.7, 0.2, 0.7); });
    // 빛 원반(분출구 자리)
    S.vents.forEach(([x, z]) => { add(DARK, cyl, x, 0.04, z, 0, 0.9, 0.08, 0.9); add(CY, cyl, x, 0.08, z, 0, 0.78, 0.04, 0.78); });
    S.vents2.forEach(([x, z], i) => { add(i % 2 ? PK : MINT, cyl, x, 0.03, z, 0, 0.9, 0.06, 0.9); });
    K.mergeLists(g, null);
    // 가운데: 육각 받침 + 수정 무리(연보라·시안·분홍) + 네온 고리
    { const tp = S.tower;
      add(DARK, new T.CylinderGeometry(4.2, 4.4, 0.4, 6), tp.x, 0.2, tp.z, 0, 1); add(CY, new T.TorusGeometry(3.2, 0.1, 4, 36), tp.x, 0.45, tp.z, 0, 1, 1, 1, PI / 2, 0);
      const crys = (x, z, r, h, col, tilt, ry) => add(col, new T.CylinderGeometry(0, r, h, 6), tp.x + x, 0.4 + h / 2 - 0.2, tp.z + z, ry || 0, 1, 1, 1, tilt || 0, 0);
      crys(0, 0, 1.4, 6.2, LAV, 0, 0.3); crys(-1.9, 0.6, 0.9, 3.6, CY, 0.25, 0.8); crys(1.8, 0.8, 0.9, 3.2, PK, -0.25, 1.4); crys(0.6, -1.9, 0.8, 3.0, MINT, 0.2, 0); crys(-0.9, -1.7, 0.7, 2.4, LAV, -0.2, 2.1); crys(2.2, -1.2, 0.6, 2.0, CY, 0.1, 0.5);
      add(LAV, new T.CylinderGeometry(0, 0.6, 1.6, 6), tp.x - 2.9, 1.2, tp.z - 0.4, 0, 1); add(PK, new T.CylinderGeometry(0, 0.5, 1.4, 6), tp.x + 3.0, 1.1, tp.z - 0.6, 0.4, 1);
    }
    center(g, rec);
    rec.ambient = (dt) => { rec.t = (rec.t || 0) + dt; if (rec.t > 0.35) { rec.t = 0; const s = S.crates[(TG.fr() * S.crates.length) | 0]; TG.FX.emit(TG.FX.CELL.sparkle, s[0] + TG.fra(-0.7, 0.7), 1.7 + TG.fra(0, 0.5), s[1] + TG.fra(-0.7, 0.7), { vy: 0.5, life: 0.5, size: 0.34, size1: 0, color: TG.fr() < 0.5 ? [1.2, 2.4, 2.6] : [2.6, 1.4, 2.4] }); } };
    finish(rec);
  });

  // ═══ ④ 쎄니 「별빛 댄스홀」 — 보라 댄스 플로어(빛나는 타일), 커튼 벽 + 별 조명, 무대 블록·조명 스탠드·벨벳 줄·별 등·조명 탑·빛 원반, 가운데 무대 계단 + 큰 미러볼 + 별 배경
  AR.mapBuilders.push(function (scene) {
    const K = AR.kit, R = TG.R, { box, cyl, cylBig, sph, ico, knob } = K.geos, add = K.add, addFar = K.addFar, S = AR.SPOTS;
    const { g, rec } = start(scene, 'sseni_hall');
    const PUR = 0x8e67d6, PUR2 = 0x6d4db0, LAV = 0xdcc8ff, PINK = 0xff9ccb, GOLD = 0xe0ae2c, SILVER = 0xe6eaf4, DARK = 0x4a3a7a, STAR = { hex: 0xfff4b0, k: 1.7 }, PKL = { hex: 0xffb3d9, k: 1.45 }, CYL = { hex: 0x9ff4ff, k: 1.45 };
    const star = starGeo(1, 0.45, 0.2), starS = starGeo(1, 0.45, 0.12);
    const tex = R.canvasTex(512, 512, (c) => { // 보라 체크 댄스 타일 + 켜진 타일(분홍·시안·노랑)
      const rnd = seeded(58);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const x = i * 128, y = j * 128, v = rnd(), dk = (i + j) % 2 === 0;
        c.fillStyle = '#4e3a86'; c.fillRect(x, y, 128, 128);
        c.fillStyle = v < 0.12 ? '#ff9ccb' : v < 0.22 ? '#8ff4ff' : v < 0.3 ? '#fff0a8' : dk ? '#8a5fe0' : '#b28cff'; c.fillRect(x + 3, y + 3, 122, 122);
        c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(x + 3, y + 3, 122, 5); c.fillRect(x + 3, y + 3, 5, 122);
        c.fillStyle = 'rgba(40,20,80,0.18)'; c.fillRect(x + 3, y + 120, 122, 5); c.fillRect(x + 120, y + 3, 5, 122);
        if (v > 0.3 && rnd() < 0.35) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(x + 64, y + 20); c.lineTo(x + 76, y + 52); c.lineTo(x + 108, y + 52); c.lineTo(x + 82, y + 72); c.lineTo(x + 92, y + 106); c.lineTo(x + 64, y + 86); c.lineTo(x + 36, y + 106); c.lineTo(x + 46, y + 72); c.lineTo(x + 20, y + 52); c.lineTo(x + 52, y + 52); c.closePath(); c.fill(); }
      }
    }, { repeat: true });
    rec.floorMat = floor(g, tex, K.W / 8, K.D / 8, 'vec3(0.22, 0.14, 0.42)', { spec: 0.35 });
    deco(g, (c, X, Z, u) => { // 가운데 큰 별(보스 자리)·무대 앞 반원·반짝 점
      const st = (cx, cz, Rr, a) => { c.beginPath(); for (let i = 0; i < 10; i++) { const an = -PI / 2 + (i / 10) * PI * 2, rr = i % 2 ? Rr * 0.45 : Rr; c.lineTo(X(cx) + Math.cos(an) * rr * u, Z(cz) + Math.sin(an) * rr * u); } c.closePath(); c.fillStyle = a; c.fill(); };
      st(0, 1, 5.0, 'rgba(255,244,176,0.28)'); st(0, 1, 2.2, 'rgba(255,255,255,0.22)');
      c.strokeStyle = 'rgba(255,244,176,0.6)'; c.lineWidth = 0.2 * u; c.beginPath(); c.arc(X(0), Z(-5.2), 5.4 * u, 0, PI); c.stroke();
      const rnd = seeded(5); for (let k = 0; k < 40; k++) st(-18 + rnd() * 36, -12 + rnd() * 24, 0.35 + rnd() * 0.3, 'rgba(255,255,255,0.35)');
    });
    ground(g, 0x3a2a66);
    // 커튼 벽(보라, 주름 줄) + 위 별 조명 줄 / 남쪽 낮게
    walls((side, cx, cz, len, ry, h) => {
      add(side === 's' ? LAV : PUR, box, cx, h / 2, cz, ry, len + 1.0, h, 0.7); add(GOLD, box, cx, h + 0.1, cz, ry, len + 1.2, 0.2, 0.8);
      const n = Math.round(len / 1.4);
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (len / n) * i, px = ry === 0 ? cx + t : cx + (cx < 0 ? 0.4 : -0.4), pz = ry === 0 ? cz + (cz < 0 ? 0.4 : -0.4) : cz + t; add(side === 's' ? 0xeadcff : PUR2, box, px, h / 2, pz, 0, 0.22, h - 0.1, 0.22); if (side !== 's' && i % 2 === 0) add(STAR, knob, px, h + 0.45, pz, 0, 0.22, 0.2, 0.22); }
    }, 3.2, 1.4);
    { const rnd = seeded(91); // 멀리: 별 기둥·큰 별 배경
      for (let k = 0; k < 12; k++) { const a = (k / 12) * PI * 2 + 0.2, x = Math.cos(a) * 36, z = Math.sin(a) * 25 - 3, h = 6 + rnd() * 4; addFar(GOLD, cyl, x, h / 2, z, 0, 0.18, h, 0.18); addFar(k % 2 ? STAR : PKL, star, x, h + 0.6, z, 0, 0.9); }
      for (let k = 0; k < 14; k++) addFar(k % 3 ? STAR : CYL, star, -40 + rnd() * 80, 8 + rnd() * 10, -40 + rnd() * 20, 0, 0.6 + rnd() * 0.8);
    }
    // 무대 블록(상자 자리)
    S.crates.forEach(([x, z, ry], i) => { add(i % 2 ? PUR : PINK, box, x, 0.5, z, ry, 1.7, 1.0, 1.4); add(LAV, box, x, 1.05, z, ry, 1.76, 0.12, 1.46); add(STAR, starS, x + Math.sin(ry) * 0.72, 0.5, z + Math.cos(ry) * 0.72, ry, 0.3); });
    // 조명 스탠드(스피커 자리)
    S.speakers.forEach(([x, z, ry], i) => { add(DARK, cyl, x, 0.05, z, 0, 0.8, 0.1, 0.8); add(GOLD, cyl, x, 1.0, z, 0, 0.09, 2.0, 0.09); add(i % 2 ? PKL : CYL, new T.CylinderGeometry(0.55, 0.22, 0.7, 10), x + Math.sin(ry) * 0.2, 2.25, z + Math.cos(ry) * 0.2, ry, 1, 1, 1, 0.9, 0); add(GOLD, sph, x, 2.05, z, 0, 0.16); });
    // 벨벳 줄 기둥(난간 자리)
    S.bars.forEach((b) => { const m = barMid(b); for (let i = -1; i <= 1; i++) { add(GOLD, cyl, m.x + m.dx * 1.2 * i, 0.5, m.z + m.dz * 1.2 * i, 0, 0.07, 1.0, 0.07); add(GOLD, cyl, m.x + m.dx * 1.2 * i, 0.06, m.z + m.dz * 1.2 * i, 0, 0.3, 0.12, 0.3); add(GOLD, sph, m.x + m.dx * 1.2 * i, 1.06, m.z + m.dz * 1.2 * i, 0, 0.12); } add(PINK, cyl, m.x, 0.82, m.z, 0, 0.06, 2.4, 0.06, m.dx ? 0 : PI / 2, m.dx ? PI / 2 : 0); });
    // 별 등(화분 자리)
    S.planters.forEach(([x, z], i) => { add(DARK, cyl, x, 0.06, z, 0, 0.55, 0.12, 0.55); add(GOLD, cyl, x, 0.9, z, 0, 0.07, 1.7, 0.07); add(i % 2 ? STAR : PKL, star, x, 2.0, z, i * 0.5, 0.42); });
    // 조명 탑(가로등 자리)
    S.lamps.forEach(([x, z, ry], i) => { add(DARK, box, x, 2.0, z, 0, 0.5, 4.0, 0.5); add(GOLD, box, x, 4.1, z, 0, 0.7, 0.2, 0.7); add(i % 2 ? CYL : PKL, new T.CylinderGeometry(0.5, 0.2, 0.6, 10), x + Math.cos(ry) * 0.4, 3.6, z - Math.sin(ry) * 0.4, ry, 1, 1, 1, 0, 1.0); add(STAR, star, x, 4.6, z, 0, 0.35); });
    // 빛 원반(분출구 자리)
    S.vents.forEach(([x, z]) => { add(DARK, cyl, x, 0.04, z, 0, 0.9, 0.08, 0.9); add(PKL, cyl, x, 0.08, z, 0, 0.78, 0.04, 0.78); });
    S.vents2.forEach(([x, z], i) => { add(i % 2 ? CYL : STAR, cyl, x, 0.03, z, 0, 0.9, 0.06, 0.9); });
    K.mergeLists(g, null);
    // 가운데: 둥근 무대 + 앞 계단 + 미러볼 기둥 + 별 배경
    { const tp = S.tower;
      add(PUR2, cylBig, tp.x, 0.3, tp.z, 0, 4.2, 0.6, 4.2); add(LAV, new T.TorusGeometry(4.2, 0.12, 5, 40), tp.x, 0.6, tp.z, 0, 1, 1, 1, PI / 2, 0); add(PINK, cylBig, tp.x, 0.62, tp.z, 0, 3.0, 0.06, 3.0);
      add(PUR, box, tp.x, 0.2, tp.z + 4.0, 0, 3.6, 0.4, 0.5); add(PUR, box, tp.x, 0.1, tp.z + 4.4, 0, 4.2, 0.2, 0.5);
      add(SILVER, cyl, tp.x, 3.6, tp.z - 0.6, 0, 0.12, 6.2, 0.12); add(SILVER, ico, tp.x, 6.3, tp.z - 0.6, 0, 1.5); add(GOLD, new T.TorusGeometry(0.3, 0.06, 4, 10), tp.x, 7.9, tp.z - 0.6, 0, 1, 1, 1, 0, 0);
      add(STAR, star, tp.x, 3.6, tp.z - 3.4, 0, 2.6); add(PKL, star, tp.x - 2.8, 2.2, tp.z - 2.6, 0.3, 1.0); add(CYL, star, tp.x + 2.9, 2.4, tp.z - 2.4, -0.3, 1.0);
    }
    center(g, rec);
    rec.ambient = (dt) => { rec.t = (rec.t || 0) + dt; if (rec.t > 0.3) { rec.t = 0; const x = TG.fra(-19, 19), z = TG.fr() < 0.5 ? -13.5 : TG.fra(-13, 13), xx = Math.abs(z) < 13.4 ? (TG.fr() < 0.5 ? -19.8 : 19.8) : x; TG.FX.emit(TG.FX.CELL.sparkle, xx, 3.3 + TG.fra(0, 0.6), z, { vy: 0.3, life: 0.6, size: 0.4, size1: 0, color: [2.6, 2.4, 1.3] }); } };
    finish(rec);
  });

  // ═══ ⑤ 베리 「베리 과수원」 — 잔디 언덕(흙길·꽃밭), 나무 울타리, 밖은 언덕·과일나무·꽃밭, 바구니·과일나무·나무 울타리·꽃밭·큰 나무·꽃 원반, 가운데 언덕 위 아주 큰 나무 (분홍·초록)
  AR.mapBuilders.push(function (scene) {
    const K = AR.kit, R = TG.R, { box, cyl, cylBig, ico, knob } = K.geos, sph = knob, add = K.add, addFar = K.addFar, S = AR.SPOTS; // 열매·꽃은 낮은 폴리 공(knob)
    const { g, rec } = start(scene, 'berri_orchard');
    const LEAF = 0x7fb864, LEAF2 = 0x62a04e, LEAF3 = 0x95cc74, TRUNK = 0x7a5538, WOOD = 0xb88a58, DIRT = 0x9a7250, PINK = 0xff7fb6, BERRY = 0xff5f93, YEL = 0xf2d26a, WHITE = 0xfff6ee, BASKET = 0xd2a86e;
    const tex = R.canvasTex(512, 512, (c) => { // 잔디 + 풀 뭉치 + 작은 꽃
      const rnd = seeded(14);
      c.fillStyle = '#8fc06b'; c.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 360; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(85,150,70,0.28)' : 'rgba(170,215,125,0.3)'; c.beginPath(); c.arc(rnd() * 512, rnd() * 512, 4 + rnd() * 12, 0, 6.3); c.fill(); }
      c.strokeStyle = 'rgba(70,130,55,0.35)'; c.lineWidth = 2; for (let k = 0; k < 140; k++) { const x = rnd() * 512, y = rnd() * 512; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 6, y - 6 - rnd() * 6); c.stroke(); }
      for (let k = 0; k < 46; k++) { const x = rnd() * 512, y = rnd() * 512, col = ['#ff9ccb', '#fff6ee', '#f2d26a', '#ffb3d9'][(rnd() * 4) | 0]; c.fillStyle = col; for (let p = 0; p < 5; p++) { const a = (p / 5) * 6.283; c.beginPath(); c.arc(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 2.4, 0, 6.3); c.fill(); } c.fillStyle = '#f7d35a'; c.beginPath(); c.arc(x, y, 1.6, 0, 6.3); c.fill(); }
    }, { repeat: true });
    rec.floorMat = floor(g, tex, K.W / 8, K.D / 8, 'vec3(0.24, 0.42, 0.16)');
    deco(g, (c, X, Z, u, w, h) => { // 내리막 느낌(위로 갈수록 밝은 띠 3줄) + 흙길(아래 가운데 → 큰 나무) + 꽃밭 무늬
      [[-12.5, 'rgba(255,255,230,0.16)'], [-6, 'rgba(255,255,230,0.10)'], [0.5, 'rgba(255,255,230,0.05)']].forEach(([z, col]) => { const q = c.createLinearGradient(0, Z(z), 0, Z(z + 5.5)); q.addColorStop(0, col); q.addColorStop(1, 'rgba(255,255,230,0)'); c.fillStyle = q; c.fillRect(0, Z(z), w, 5.5 * u); });
      const q2 = c.createLinearGradient(0, Z(8), 0, Z(14)); q2.addColorStop(0, 'rgba(40,80,30,0)'); q2.addColorStop(1, 'rgba(40,80,30,0.18)'); c.fillStyle = q2; c.fillRect(0, Z(8), w, 6 * u);
      c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = 'rgba(154,114,80,0.9)'; c.lineWidth = 2.4 * u; c.beginPath(); c.moveTo(X(0), Z(14)); c.quadraticCurveTo(X(-3), Z(8), X(0.5), Z(4.5)); c.quadraticCurveTo(X(3), Z(1.5), X(0), Z(-0.9)); c.stroke();
      c.strokeStyle = 'rgba(210,170,120,0.5)'; c.lineWidth = 1.7 * u; c.beginPath(); c.moveTo(X(0), Z(14)); c.quadraticCurveTo(X(-3), Z(8), X(0.5), Z(4.5)); c.quadraticCurveTo(X(3), Z(1.5), X(0), Z(-0.9)); c.stroke();
      const rnd = seeded(8); c.fillStyle = 'rgba(120,90,60,0.5)'; for (let k = 0; k < 26; k++) { const t = rnd(), px = X(-3 * (1 - t) * t * 2 + (rnd() - 0.5) * 1.6), pz = Z(14 - 15 * t); c.beginPath(); c.arc(px, pz, (0.12 + rnd() * 0.14) * u, 0, 6.3); c.fill(); }
      [[-15, -10, 3.2], [15, -10, 3.0], [-15.5, 10, 2.6], [15.5, 10, 2.6]].forEach(([x, z, r]) => { c.fillStyle = 'rgba(255,156,203,0.22)'; c.beginPath(); c.arc(X(x), Z(z), r * u, 0, 6.3); c.fill(); for (let k = 0; k < 18; k++) { const a = rnd() * 6.283, d = rnd() * r * 0.9; c.fillStyle = ['rgba(255,156,203,0.8)', 'rgba(255,246,238,0.8)', 'rgba(242,210,106,0.8)'][(rnd() * 3) | 0]; c.beginPath(); c.arc(X(x) + Math.cos(a) * d * u, Z(z) + Math.sin(a) * d * u, 0.16 * u, 0, 6.3); c.fill(); } });
    });
    ground(g, 0x79b05c);
    // 나무 울타리(사방 낮게) + 밖 언덕·과일나무·꽃밭
    walls((side, cx, cz, len, ry, h) => {
      const n = Math.round(len / 2.2);
      for (let i = 0; i <= n; i++) { const t = -len / 2 + (len / n) * i, px = ry === 0 ? cx + t : cx, pz = ry === 0 ? cz : cz + t; add(WOOD, cyl, px, 0.6, pz, 0, 0.13, 1.2, 0.13); add(WOOD, sph, px, 1.22, pz, 0, 0.15, 0.1, 0.15); }
      [0.45, 0.95].forEach((y) => add(WOOD, box, cx, y, cz, ry, len + 0.6, 0.12, 0.08));
    }, 1.2, 1.2);
    { const rnd = seeded(61);
      [[-26, -30, 16, 5, LEAF2], [4, -34, 20, 6.5, LEAF], [30, -28, 14, 4.5, LEAF3], [-38, -6, 12, 4, LEAF], [38, -4, 12, 4, LEAF2], [-34, 16, 10, 3, LEAF3], [34, 16, 10, 3, LEAF], [0, 30, 24, 3.5, LEAF2]].forEach(([x, z, r, h, col]) => addFar(col, K.geos.sph, x, -0.4, z, 0, r, h, r * 0.8));
      const tree = (x, z, s, far) => { const f = far ? addFar : add; f(TRUNK, cyl, x, 0.9 * s, z, 0, 0.2 * s, 1.8 * s, 0.2 * s); f(LEAF, ico, x, 2.2 * s, z, rnd() * 3, 1.1 * s); f(LEAF2, ico, x + 0.5 * s, 1.8 * s, z + 0.3 * s, rnd() * 3, 0.75 * s); for (let k = 0; k < 4; k++) { const a = rnd() * 6.283; f(k % 2 ? PINK : BERRY, sph, x + Math.cos(a) * 0.9 * s, (1.9 + rnd() * 0.8) * s, z + Math.sin(a) * 0.9 * s, 0, 0.17 * s); } };
      [[-30, -18, 1.5], [30, -18, 1.5], [-23, 17, 1.2], [23, 17, 1.2], [-32, 5, 1.6], [32, 5, 1.6], [-13, -19.5, 1.2], [13, -19.5, 1.2], [-4, -20.5, 1.1], [5, -21, 1.1], [-27, -8, 1.3], [27, -8, 1.3], [-18, 18, 1.0], [18, 18, 1.0]].forEach(([x, z, s]) => tree(x, z, s, true));
      for (let k = 0; k < 16; k++) { const x = -30 + rnd() * 60, z = 16 + rnd() * 6; addFar(k % 3 ? PINK : WHITE, cyl, x, 0.05, z, 0, 0.6 + rnd() * 0.6, 0.1, 0.6 + rnd() * 0.6); }
      // 소품: 바구니(상자 자리)
      S.crates.forEach(([x, z, ry], i) => { add(BASKET, new T.CylinderGeometry(0.86, 0.62, 0.82, 10), x, 0.41, z, ry, 1); add(WOOD, new T.TorusGeometry(0.86, 0.08, 5, 14), x, 0.82, z, 0, 1, 1, 1, PI / 2, 0); add(WOOD, new T.TorusGeometry(0.72, 0.06, 4, 12), x, 1.3, z, ry, 1, 1, 1, 0, 0); [[0.3, 0.1], [-0.3, 0.15], [0.05, -0.3], [-0.1, 0.35], [0.35, -0.25]].forEach(([ox, oz], k) => add(k % 2 ? BERRY : PINK, sph, x + ox, 0.95, z + oz, 0, 0.26)); });
      // 과일나무(스피커 자리)
      S.speakers.forEach(([x, z]) => tree(x, z, 0.95, false));
      // 나무 울타리 토막(난간 자리)
      S.bars.forEach((b) => { const m = barMid(b); for (let i = -1; i <= 1; i++) { add(WOOD, cyl, m.x + m.dx * 1.2 * i, 0.55, m.z + m.dz * 1.2 * i, 0, 0.12, 1.1, 0.12); add(WOOD, sph, m.x + m.dx * 1.2 * i, 1.12, m.z + m.dz * 1.2 * i, 0, 0.14, 0.1, 0.14); } [0.42, 0.88].forEach((y) => add(WOOD, box, m.x, y, m.z, m.ry, 2.9, 0.12, 0.08)); });
      // 꽃밭(화분 자리)
      S.planters.forEach(([x, z], i) => { add(DIRT, cyl, x, 0.1, z, 0, 0.66, 0.2, 0.66); add(LEAF3, ico, x, 0.3, z, i, 0.5, 0.25, 0.5); [[0.3, 0.2, PINK], [-0.3, 0.1, YEL], [0.05, -0.3, WHITE], [-0.15, 0.35, BERRY]].forEach(([ox, oz, col]) => { add(LEAF2, cyl, x + ox, 0.55, z + oz, 0, 0.03, 0.5, 0.03); add(col, sph, x + ox, 0.82, z + oz, 0, 0.17); }); });
      // 큰 나무(가로등 자리)
      S.lamps.forEach(([x, z], i) => { add(TRUNK, cyl, x, 1.2, z, 0, 0.22, 2.4, 0.22); add(i % 2 ? LEAF : LEAF2, ico, x, 3.3, z, i, 1.3, 1.1, 1.3); add(LEAF3, ico, x + 0.6, 2.7, z + 0.4, i + 1, 0.8); for (let k = 0; k < 5; k++) { const a = k * 1.3 + i; add(k % 2 ? PINK : BERRY, sph, x + Math.cos(a) * 1.1, 2.9 + (k % 3) * 0.4, z + Math.sin(a) * 1.0, 0, 0.2); } });
      // 꽃 원반(분출구 자리)
      S.vents.forEach(([x, z], i) => { add(i % 2 ? PINK : WHITE, cyl, x, 0.05, z, 0, 0.88, 0.1, 0.88); for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.283; add(i % 2 ? PINK : WHITE, sph, x + Math.cos(a) * 0.62, 0.1, z + Math.sin(a) * 0.62, 0, 0.3, 0.1, 0.3); } add(YEL, sph, x, 0.14, z, 0, 0.3, 0.14, 0.3); });
      S.vents2.forEach(([x, z], i) => { add(LEAF3, cyl, x, 0.03, z, 0, 0.95, 0.06, 0.95); add(i % 2 ? YEL : PINK, sph, x, 0.08, z, 0, 0.35, 0.1, 0.35); });
      K.mergeLists(g, null);
      // 가운데: 언덕 + 과일 수레(나무 상자·바퀴·열매 더미) + 팻말 + 큰 꽃 — 키 낮게(보스 「잠꾸러기 큰 나무」가 바로 앞(0,1)에 서니 뒤 소품이 나무면 겹쳐 보임)
      { const tp = S.tower;
        add(LEAF2, K.geos.sph, tp.x, -0.3, tp.z, 0, 4.4, 1.3, 4.4); add(DIRT, new T.TorusGeometry(2.4, 0.3, 5, 24), tp.x, 0.65, tp.z, 0, 1, 1, 1, PI / 2, 0);
        add(WOOD, box, tp.x, 1.55, tp.z - 0.4, 0, 3.6, 1.2, 2.2); add(TRUNK, box, tp.x, 1.55, tp.z - 0.4, 0, 3.7, 0.16, 2.3); add(TRUNK, box, tp.x, 1.1, tp.z - 0.4, 0, 3.7, 0.16, 2.3);
        [[-1.9, 0.6], [1.9, 0.6], [-1.9, -1.4], [1.9, -1.4]].forEach(([ox, oz]) => { add(TRUNK, new T.TorusGeometry(0.55, 0.16, 6, 14), tp.x + ox, 1.0, tp.z + oz, 0, 1, 1, 1, 0, PI / 2); add(YEL, cyl, tp.x + ox, 1.0, tp.z + oz, 0, 0.14, 0.4, 0.14, 0, PI / 2); });
        add(TRUNK, cyl, tp.x + 2.6, 1.7, tp.z + 1.3, 0, 0.1, 2.2, 0.1, 0.6, 0); add(TRUNK, cyl, tp.x - 2.6, 1.7, tp.z + 1.3, 0, 0.1, 2.2, 0.1, 0.6, 0);
        for (let k = 0; k < 16; k++) { const a = k * 1.1, rr = 0.5 + (k % 4) * 0.35; add(k % 3 ? PINK : BERRY, sph, tp.x + Math.cos(a) * rr * 1.5, 2.35 + (k % 3) * 0.3 - rr * 0.25, tp.z - 0.4 + Math.sin(a) * rr * 0.8, 0, 0.36); }
        add(LEAF, ico, tp.x + 0.6, 2.9, tp.z - 0.6, 1, 0.5); add(LEAF3, ico, tp.x - 0.8, 2.8, tp.z - 0.2, 2, 0.45);
        add(TRUNK, cyl, tp.x - 3.0, 1.6, tp.z - 2.2, 0, 0.1, 3.2, 0.1); add(WOOD, box, tp.x - 3.0, 2.9, tp.z - 2.2, 0.3, 1.6, 0.8, 0.1); add(BERRY, sph, tp.x - 3.0, 2.9, tp.z - 2.1, 0, 0.22); // 팻말
        [[2.9, -2.0, PINK], [3.2, 0.4, YEL], [-2.4, 2.4, WHITE], [1.6, 2.9, PINK]].forEach(([ox, oz, col]) => { add(LEAF2, cyl, tp.x + ox, 0.9, tp.z + oz, 0, 0.06, 1.2, 0.06); add(col, K.geos.sph, tp.x + ox, 1.55, tp.z + oz, 0, 0.42, 0.26, 0.42); add(YEL, sph, tp.x + ox, 1.6, tp.z + oz, 0, 0.14); });
      }
    }
    center(g, rec);
    rec.ambient = (dt) => { rec.t = (rec.t || 0) + dt; if (rec.t > 0.5) { rec.t = 0; const l = S.lamps[(TG.fr() * S.lamps.length) | 0]; TG.FX.emit(TG.FX.CELL.flower, l[0] + TG.fra(-1, 1), 3.6, l[1] + TG.fra(-1, 1), { vy: -0.5, vx: TG.fra(-0.4, 0.4), life: 2.6, size: 0.34, size1: 0.3, color: TG.fr() < 0.5 ? [2.4, 0.9, 1.5] : [2.5, 2.3, 2.4], vrot: 2, alpha: 0.9 }); } };
    finish(rec);
  });
  AR.mapBuilders.push(function () { finish(AR.maps.pipe); }); // 광장 정점 수(비교용)
})();
