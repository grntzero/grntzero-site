/* GRUNT ZERO RE — 렌더러·조명·환경 반사·블룸·카메라(3인칭 추적)·동적 해상도 */
(function () {
  'use strict';
  const GZ = window.GZ, T = THREE;
  const R = (GZ.R = {});
  R.opt = { shake: true, camAuto: true };   // camAuto = 보스전에서 보스 쪽으로 천천히 도는 자동 회전 (웨이브는 늘 고정)
  R.YAW0 = 0.47;   // r4: 카메라는 주인공의 오른쪽 뒤 27° 에 고정 (3/4 뒷모습). 조작은 화면 기준

  R.canvasTex = function (w, h, draw, o) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = o && o.linear ? T.NoColorSpace : T.SRGBColorSpace;
    t.anisotropy = R.maxAniso || 16;   // 화질(갤럭시탭): 4 → 기기 최대
    if (o && o.repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  };

  // r3: 높이 그림(밝을수록 높음)을 그려 노멀맵으로 바꿈 (바닥 잔요철 — 유료 생성 없이 코드로)
  R.normalTex = function (size, draw, strength) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); draw(g, size);
    const src = g.getImageData(0, 0, size, size), d = src.data, out = g.createImageData(size, size), o = out.data, k = strength || 2;
    const H = (x, y) => d[(((y + size) % size) * size + ((x + size) % size)) * 4];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) / 255 * k, dy = (H(x, y - 1) - H(x, y + 1)) / 255 * k, l = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (y * size + x) * 4;
      o[i] = (dx * l * 0.5 + 0.5) * 255; o[i + 1] = (-dy * l * 0.5 + 0.5) * 255; o[i + 2] = (l * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = R.maxAniso || 16;
    return t;
  };

  // 금속이 검게 죽지 않게: 작은 가상 스튜디오(따뜻한 위 조명·빨강/파랑 옆 조명)를 구워 반사 환경으로 씀
  function buildEnv(renderer) {
    const s = new T.Scene();
    const box = new T.Mesh(new T.BoxGeometry(40, 40, 40), new T.MeshBasicMaterial({ color: 0x0b0d13, side: T.BackSide }));
    s.add(box);
    const panel = (col, k, x, y, z, w, h, rx, ry) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k), side: T.DoubleSide }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
    };
    panel(0xfff0d8, 4.2, 0, 19, 0, 18, 18, Math.PI / 2, 0);     // 위 큰 조명
    panel(0xffb060, 3.2, 0, 4, 19, 26, 7, 0, Math.PI);         // 앞(카메라 쪽) 따뜻한 띠
    panel(0xff3a2a, 4.5, -19, 3, 0, 12, 12, 0, Math.PI / 2);   // 왼쪽 빨강
    panel(0x2f7dff, 4.5, 19, 3, 0, 12, 12, 0, -Math.PI / 2);   // 오른쪽 파랑
    panel(0x7f93b8, 1.6, 0, 6, -19, 30, 10, 0, 0);             // 뒤 차가운 띠
    panel(0x30261c, 1.0, 0, -19, 0, 40, 40, -Math.PI / 2, 0);  // 바닥
    const pm = new T.PMREMGenerator(renderer);
    const env = pm.fromScene(s, 0.04).texture;
    pm.dispose();
    s.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return env;
  }

  R.init = function (canvas) {
    const renderer = (R.renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false }));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.info.autoReset = false;
    R.maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;   // 화질(갤럭시탭): 모든 텍스처 비등방 필터를 기기 최대로

    const scene = (R.scene = new T.Scene());
    scene.background = new T.Color(0x07090e);
    scene.fog = new T.FogExp2(0x0b0e15, 0.0135);
    scene.environment = buildEnv(renderer);
    scene.environmentIntensity = 0.7;

    const cam = (R.camera = new T.PerspectiveCamera(50, 1, 0.3, 220));
    scene.add(cam); cam.layers.enable(1); cam.layers.enable(2);   // 층 1 = 번쩍이는 이펙트 (본 화면에만)

    R.hemi = new T.HemisphereLight(0xa3a6ad, 0x2a2018, 0.7);   // r3: 하늘빛을 중성 회색으로 (바닥이 보라로 뜨지 않게)
    scene.add(R.hemi);
    // 주광: 따뜻한 위 조명 (그림자)
    const sun = (R.sun = new T.DirectionalLight(0xffdcae, 2.9));
    sun.castShadow = true;
    const ss = GZ.isTouch ? 1024 : 2048;   // 화질: 터치 기기 「자동」 1024, 「높게」 2048 (아래 R.shadowQ). 2048 은 소프트웨어 렌더에서 한 프레임 2배 넘게 느려 자동엔 안 씀
    sun.shadow.mapSize.set(ss, ss);
    const sc = sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 22; sc.bottom = -12; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; sun.shadow.radius = 2.5;
    R.sunOffset = new T.Vector3(-9, 26, 12);
    scene.add(sun); scene.add(sun.target);
    // 림라이트: 뒤에서 오는 차가운 빛 (실루엣 테두리)
    const rim = (R.rim = new T.DirectionalLight(0x7f9be0, 1.25));   // r3: 푸른 림 절반 이하 + 채도 낮춤 (군복·바닥이 푸르게 물들지 않게)
    rim.position.set(5, 16, -13); scene.add(rim);
    // 붉은 에너지(중앙)·푸른 에너지(옆) 점광
    R.redL = new T.PointLight(0xff4a26, 40, 26, 1.9); R.redL.position.set(0, 6.5, 0); scene.add(R.redL);
    R.blueL = new T.PointLight(0x2f7dff, 30, 30, 1.7); R.blueL.position.set(15, 7, -8); scene.add(R.blueL);
    // 번쩍 조명 (폭발·궁극기)
    R.flashL = new T.PointLight(0xffc24a, 0, 26, 1.5); scene.add(R.flashL);
    // r2: 주인공을 따라다니는 따뜻한 키 라이트 (카메라 쪽 위에서) — 화면에서 가장 밝은 곳이 주인공이 되게
    R.keyL = new T.PointLight(0xffd9a0, 19, 10, 1.6); scene.add(R.keyL);
    R.cutL = new T.PointLight(0xffe2b8, 0, 7, 1.5); scene.add(R.cutL);   // 얼굴 컷인 전용 조명 (그 창을 그릴 때만 켬)
    R.flashV = 0;

    GZ.measureView();
    const w = GZ.vw(), h = GZ.vh();
    const rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: GZ.isTouch ? 2 : 4 });   // MSAA: 터치 「자동」 2x(배율 2 에선 충분), 「높게」·PC 4x (아래 R.shadowQ)
    const composer = (R.composer = new T.EffectComposer(renderer, rt));
    composer.addPass(new T.RenderPass(scene, cam));
    // r5: 문턱 0.96 → 1.0, 주인공 재질은 셰이더에서 밝기 상한(0.95)을 둬 블룸에 안 걸림 → 정박 순간 주인공이 하얗게 날아가지 않음
    const bloom = (R.bloom = new T.UnrealBloomPass(new T.Vector2(w, h), 0.28, 0.45, 1.0));
    composer.addPass(bloom);
    composer.addPass(new T.OutputPass());
    R.bloomBase = 0.28; R.bloomPulse = 0;

    // 화질(갤럭시탭 2026-11-13): 전엔 터치 배율 상한 1.6 + 느리면 0.7 까지 → 태블릿(dpr 2)에서 흐렸음.
    //   이제 기기 배율(상한 2)로 시작, 「자동」은 오래 느릴 때만 0.1씩 내리고 바닥 1.25(아주 느릴 때만 1.0), 「높게」는 안 내림 (js/gzview.js)
    GZView.loadQuality('gzre');
    R.maxPR = GZView.maxPR;
    R.dyn = GZView.makeDyn({ maxPR: R.maxPR, enabled: () => GZ.Q.dr });
    R.dyn.onChange = (pr) => { if (R.pr !== pr) { R.pr = pr; if (R.w) R.resize(); } };
    R.pr = R.dyn.pr;
    // 그림자 지도 크기: 「높게」 또는 PC 는 2048, 터치 기기 「자동」은 1024
    R.shadowQ = (m) => { const s = m === 'high' || !GZ.isTouch ? 2048 : 1024; if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } };
    GZView.onQuality(R.shadowQ);
    R.msaaQ = (m) => { const n = m === 'high' || !GZ.isTouch ? 4 : 2; for (const t of [R.composer.renderTarget1, R.composer.renderTarget2]) if (t.samples !== n) { t.samples = n; t.dispose(); } };
    GZView.onQuality(R.msaaQ);
    // 카메라 상태
    R.focus = new T.Vector3(0, 0, 8); R.lead = new T.Vector3();
    R.shakeV = 0;
    R.cine = { k: 0, to: 0, pos: new T.Vector3(), look: new T.Vector3(), fov: 40 };
    R.zoom = 1; R.yaw = R.YAW0;
    R.resize();
    GZ.watchView(R.resize);   // 화면 아래 잘림 고침: resize·회전·전체 화면·visualViewport 바뀔 때마다 (조금 뒤에도 다시) 크기·비율 맞춤
  };

  R.resize = function () {
    GZ.measureView();
    const w = GZ.vw(), h = GZ.vh();
    R.w = w; R.h = h;
    R.renderer.setPixelRatio(R.pr);
    R.renderer.setSize(w, h, false);
    R.composer.setPixelRatio(R.pr);
    R.composer.setSize(w, h);
    const a = w / h;
    R.camera.aspect = a;
    // r7 (대표 지시: 가로형이 기본): 가로(폰 844×390·PC 16:9) 값이 주. 좁은 화면(비율 1.3 아래 — 세로로 든 PC 창 등, 폰은 「가로로 돌려 주세요」 안내)만 예비 값으로 섞음
    const k = GZ.sat((a - 0.56) / (1.3 - 0.56)); // 1 = 가로(기본), 0 = 세로
    R.rig = {
      fov: GZ.lerp(R.RIG.narrow.fov, R.RIG.main.fov, k),
      dist: GZ.lerp(R.RIG.narrow.dist, R.RIG.main.dist, k),
      pitch: GZ.lerp(R.RIG.narrow.pitch, R.RIG.main.pitch, k),   // 내려다보는 각 (라디안)
      feet: GZ.lerp(R.RIG.narrow.feet, R.RIG.main.feet, k),      // 주인공 발이 놓일 화면 높이 (0 = 맨 위, 1 = 맨 아래)
    };
    R.camera.fov = R.rig.fov;
    R.camera.updateProjectionMatrix();
    if (GZ.FX && GZ.FX.onResize) GZ.FX.onResize();
    if (GZ.onResize) GZ.onResize(w, h);
  };

  // r2~r5 는 세로 폰(390×844) 기준이었음 (세로: 허조교 키 21~23%, 발 62%).
  // r7 (대표 지시 2026-11-13 「가로형으로」): main = 가로 폰·PC — 시야각 46°·거리 10.2·내려다보는 각 0.5rad·발 62%
  //   → 허조교 키 화면 높이의 약 21%, 발밑에서 보이는 좌우 폭 약 20m (r6 가로 17.7m) — 옆에서 오는 적이 화면 안에 들어옴
  //   narrow = 좁은 화면 예비 값 (옛 세로 값 그대로)
  // 2026-11-13 「화면 아래 잘림」: 위쪽 빈 곳을 줄이는 카메라 6가지를 camvis 로 재 봤으나 모두 숙련 봇 「적이 보이는 시간」이 r8 보다 떨어져(4시드: r8 값 81.1% → 77.9~78.6%) r8 값 그대로 둠. 실제 폰에서 아래가 안 보이던 까닭은 크기 버그(util.js GZ.watchView). 다시 시험할 땐 ?rig=시야각,거리,각,발
  // 2026-11-14 「카메라 세움」(대표 실기 「너무 눕혀져 있어, 좀 세워야 해」): 내려다보는 각 0.5→0.64rad(28.6°→36.7°). 그만큼 앞쪽이 덜 보이는 걸
  //   시야각 46→50·거리 10.2→9.4·발 62→66% 로 메움 → camvis 숙련 봇 4시드 가로 「적이 보이는 시간」 81.3%→81.3%(1웨이브 60.6→62.2·2웨이브 73.9→78.0), 허조교 키 약 19.7%.
  //   0.66~0.72 는 1웨이브 첫 무리가 화면 밖에서 나오거나 보이는 시간이 76~79% 로 떨어져 안 씀. 옛 값: ?rig=46,10.2,0.5,0.62
  R.RIG = { main: { fov: 50, dist: 9.4, pitch: 0.64, feet: 0.66 }, narrow: { fov: 60, dist: 7.45, pitch: 0.37, feet: 0.62 } };
  if (GZ.Q.rig) { const v = GZ.Q.rig.split(',').map(Number); if (v.length === 4 && v.every((x) => x > 0)) R.RIG.main = { fov: v[0], dist: v[1], pitch: v[2], feet: v[3] }; }   // 시험용
  let acc = 0, frames = 0;
  R.fps = 60;
  R.trackFrame = function (dt) {
    acc += dt; frames++;
    if (acc >= 1) {
      R.fps = frames / acc;
      if (R.dyn.feed(R.fps)) { R.pr = R.dyn.pr; R.resize(); }
      acc = 0; frames = 0;
    }
  };

  R.shake = function (v) { if (R.opt.shake) R.shakeV = Math.max(R.shakeV, v); };
  R.flash = function (x, y, z, power, color) {
    R.flashL.position.set(x, y, z);
    R.flashL.color.set(color || 0xffc24a);
    R.flashV = Math.max(R.flashV, power);
  };
  R.pulse = function (v) { R.bloomPulse = Math.max(R.bloomPulse, Math.min(0.16, v * 0.35)); };   // r5: 블룸 맥박 상한 0.3 → 0.16

  const tmp = new T.Vector3(), tmp2 = new T.Vector3(), look = new T.Vector3();
  // 추적 카메라: (fx,fz) = 플레이어 자리, (ox,oz) = 초점 밀기(위협 쪽, 세계 좌표 — game.js 가 부드럽게 만들어 줌), R.yaw = 카메라가 도는 각(보스전 고정 추적)
  R.updateCamera = function (dt, fx, fz, ox, oz, snap, lx, lz) {
    const rig = R.rig;
    tmp.set(fx + (ox || 0), 0, fz + (oz || 0));
    if (snap) R.focus.copy(tmp); else R.focus.lerp(tmp, 1 - Math.exp(-dt * 6.5));
    R.lead.set(lx || 0, 0, lz || 0);   // r9b 앞서 보기 (게임 쪽 스프링이 부드럽게 만든 값 — 여기서 다시 늦추지 않음)
    const d = rig.dist * R.zoom, sy = Math.sin(R.yaw), cyw = Math.cos(R.yaw);
    // 초점(발)이 화면 높이 rig.feet 에 오도록 카메라 축을 위로 든다: 축과 초점 방향의 각 = atan((feet-0.5)*2*tan(fov/2))
    const off = Math.atan((rig.feet + (R.feetAdd || 0) - 0.5) * 2 * Math.tan((rig.fov * Math.PI) / 360));
    const pitch = rig.pitch + (R.pitchAdd || 0);   // 11-14: 보스전은 game.js 가 조금 눕힘(R.pitchAdd) — 키 큰 보스 머리가 위 막대에 안 잘리게
    const cy = Math.sin(pitch) * d, cz = Math.cos(pitch) * d;
    const fcx = R.focus.x + R.lead.x, fcz = R.focus.z + R.lead.z;
    tmp.set(fcx + sy * cz, cy, fcz + cyw * cz);
    const ax = pitch - off;   // 카메라 축이 수평선 아래로 내려간 각
    look.set(tmp.x - sy * Math.cos(ax) * 10, cy - Math.sin(ax) * 10, tmp.z - cyw * Math.cos(ax) * 10);
    R.rim.position.set(-sy * 13 + cyw * 5, 16, -cyw * 13 - sy * 5);   // 림라이트는 늘 카메라 맞은편 위에서
    // 연출 카메라와 섞기
    const c = R.cine;
    c.k += (c.to - c.k) * (1 - Math.exp(-dt * (c.to > c.k ? 7 : 4.5)));
    if (c.k > 0.002) {
      const e = GZ.smooth(c.k);
      tmp.lerp(c.pos, e); look.lerp(c.look, e);
      R.camera.fov = GZ.lerp(rig.fov, c.fov, e);
    } else R.camera.fov = rig.fov;
    R.camera.updateProjectionMatrix();
    if (R.shakeV > 0.001) {
      const s = R.shakeV * 0.55;   // 카메라가 가까워진 만큼 흔들림 폭을 줄임
      tmp.x += (Math.random() - 0.5) * s; tmp.y += (Math.random() - 0.5) * s * 0.7; tmp.z += (Math.random() - 0.5) * s * 0.5;
      R.shakeV *= Math.exp(-dt * 9);
    } else R.shakeV = 0;
    R.camera.position.copy(tmp);
    R.camera.lookAt(look);
    R.camera.updateMatrixWorld();
    R.sun.position.set(fx + R.sunOffset.x, R.sunOffset.y, fz + R.sunOffset.z);
    R.sun.target.position.set(fx, 0, fz);
    // 키 라이트: 주인공의 카메라 쪽 위 (연출 카메라일 땐 그 카메라 쪽)
    const kx = R.camera.position.x - fx, kz = R.camera.position.z - fz, kl = Math.hypot(kx, kz) || 1;
    R.keyL.position.set(fx + (kx / kl) * 2.6 - 1.2, 3.4, fz + (kz / kl) * 2.6);
  };
  R.setCine = function (on, px, py, pz, lx, ly, lz, fov) {
    R.cine.to = on ? 1 : 0;
    if (on) { R.cine.pos.set(px, py, pz); R.cine.look.set(lx, ly, lz); R.cine.fov = fov || 40; }
  };

  R.render = function (dt) {
    R.renderer.info.reset();
    R.bloomPulse = Math.max(0, R.bloomPulse - dt * 1.8);
    R.bloom.strength = R.bloomBase + R.bloomPulse;
    R.flashV = Math.max(0, R.flashV - dt * 5 * Math.max(0.6, R.flashV));
    R.flashL.intensity = R.flashV * 38;
    R.composer.render(dt);
    if (cut.on && cut.el) {   // 얼굴 컷인: 같은 장면을 얼굴 앞 카메라로 한 번 더, 창 자리에만 그림
      const b = cut.el.getBoundingClientRect(), rn = R.renderer;
      if (b.width > 4 && b.height > 4) {
        const a = cut.face + 0.42;
        cutCam.aspect = b.width / b.height; cutCam.updateProjectionMatrix();
        cutCam.position.set(cut.x + Math.sin(a) * 1.75, 1.74, cut.z + Math.cos(a) * 1.75); cutCam.lookAt(cut.x, 1.6, cut.z);
        R.cutL.position.set(cut.x + Math.sin(a + 0.5) * 1.6, 2.1, cut.z + Math.cos(a + 0.5) * 1.6); R.cutL.intensity = 7;
        rn.setRenderTarget(null); rn.shadowMap.autoUpdate = false;
        rn.setScissorTest(true); rn.setScissor(b.left, R.h - b.bottom, b.width, b.height); rn.setViewport(b.left, R.h - b.bottom, b.width, b.height);
        rn.render(R.scene, cutCam);
        rn.setScissorTest(false); rn.setViewport(0, 0, R.w, R.h); rn.shadowMap.autoUpdate = true; R.cutL.intensity = 0;
      }
    }
  };
  const cut = { on: false, x: 0, z: 0, face: 0, el: null }, cutCam = new T.PerspectiveCamera(27, 1.5, 0.2, 150);
  R.cutIn = function (on, x, z, face) {
    if (!cut.el) cut.el = document.getElementById('cutin');
    if (on) { cut.x = x; cut.z = z; cut.face = face; }
    if (on !== cut.on) { cut.on = !!on; if (cut.el) cut.el.classList.toggle('on', cut.on); }
  };

  // 화면 좌표 (px) — 숫자·표시용
  const pv = new T.Vector3();
  R.project = function (x, y, z, out) {
    pv.set(x, y, z).project(R.camera);
    out.x = (pv.x * 0.5 + 0.5) * R.w; out.y = (-pv.y * 0.5 + 0.5) * R.h; out.behind = pv.z > 1;
    return out;
  };
})();
