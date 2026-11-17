/* 톱니골 던전 — 주인공(SEFO·BERRI·허조교·MOSHEE, js/heroes.js): 리깅 모델 + idle/run 블렌딩 + 프로시저럴 덧칠(기울기·통통·스쿼시·반동·맞음·큰 소리 점프·쉬기)
   11-16 베리: 같은 뼈 이름이라 SEFO 동작 9개를 그대로 씀(tools/build_berri.py). 딸기 막대(베리 마라카스)는 GLB 안에서 RightHand 뼈 자식 — 손을 따라감
   11-16 MOSHEE: 큐브 머리 앞 화면판(moshee_face_screen, Head 뼈 자식)의 그림을 표정 아틀라스 7칸(tools/build_moshee.py)에서 골라 보임(PL.face) — 평소 웃음·소리 ^^·큰 소리 하트·안개 닿음 놀람·쉼 Z·이김 별눈·카드 윙크 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const PL = (TG.PL = {});
  const HEIGHT0 = 2.87; // SEFO 월드 키 (다른 주인공은 heroes.js 의 height, 머리 위 자리 등은 이 비율로)
  PL.MAXSPD = 7.2;

  // 주인공 바꾸기 (타이틀에서 고름): 만든 것을 걷어내고 다시 만듦
  PL.setHero = function (scene) {
    if (PL.root) {
      [PL.root, PL.ring, PL.aim].concat(PL.chargeRings || []).forEach((o) => { if (o && o.parent) o.parent.remove(o); });
      if (PL.back34 && PL.back34.parent) PL.back34.parent.remove(PL.back34);
      const drop = []; PL.model.traverse((o) => { if (o.userData.isOutline) drop.push(o); }); drop.forEach((o) => o.parent && o.parent.remove(o)); // 지난번 외곽선·실루엣 껍데기 걷어냄
      if (PL.faceScr && PL.faceScr.material) PL.faceScr.material.dispose(); // MOSHEE 표정 재질(바꿀 때마다 새로 만듦)
      PL.bones = null; PL._ovl = null; PL.headP0 = null; PL.flashT = 0; PL.outlines = null; PL.mats = null; PL.mega = null; PL.back34 = null; PL.wand = null; PL.xray = null; PL.special = null; PL.faceScr = null;
    }
    PL.init(scene);
  };

  // ── MOSHEE 표정 화면 (큐브 얼굴): 아틀라스 가로 7칸, map.offset 으로 고름. hold = 잠깐 고정(초) ──
  const FACES = { smile: 0, happy: 1, heart: 2, surprised: 3, sleepy: 4, stareyes: 5, wink: 6 };
  PL.FACES = FACES;
  function setupFace(o) {
    const map = o.material.map; // GLTFLoader: KHR_materials_unlit → MeshBasicMaterial(map). 그림 하나에 7칸
    if (map) { map.wrapS = map.wrapT = T.ClampToEdgeWrapping; map.repeat.set(1 / 7, 1); map.offset.set(0, 0); map.anisotropy = TG.R.maxAniso || 4; map.needsUpdate = true; }
    const m = new T.MeshBasicMaterial({ map, color: 0xffffff }); // 화면은 빛을 안 받아 늘 또렷함(툰 조명·외곽선·무적 깜빡임 밖. 톤매핑은 OutputPass 가 화면 전체에 — 재질 플래그는 효과 없음)
    o.material = m; o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; o.renderOrder = 10;
    PL.faceScr = o; PL.faceMap = map; PL.faceName = ''; PL.faceHold = 0; PL.faceHoldName = null;
    setFace('smile');
  }
  function setFace(name) {
    if (!PL.faceScr || PL.faceName === name || FACES[name] == null) return;
    PL.faceName = name;
    if (PL.faceMap) PL.faceMap.offset.x = FACES[name] / 7;
  }
  PL.face = function (name, hold) { // 바깥에서(큰 소리·카드 등) 잠깐 고정. 다른 주인공이면 아무 일 없음
    if (!PL.faceScr || FACES[name] == null) return false;
    PL.faceHold = hold || 0.8; PL.faceHoldName = name; setFace(name);
    return true;
  };
  PL.faceFlash = function (k) { // 11-17 3차: 빔 쏠 때 큐브 화면 번쩍(0.14초, 화면 재질 색을 1 넘게 → 블룸이 받음). 다른 주인공이면 아무 일 없음
    if (!PL.faceScr) return false;
    PL.flashK = Math.max(PL.flashT > 0 ? PL.flashK || 0 : 0, k || 1); PL.flashT = 0.14; // 겹치면 센 쪽(검토 ⑥)
    return true;
  };
  function faceUpdate(dt) {
    if (!PL.faceScr) return;
    const fm = PL.faceScr.material;
    if (PL.flashT > 0) { PL.flashT -= dt; fm.color.setScalar(1 + (PL.flashK || 1) * 2.4 * Math.max(0, PL.flashT / 0.14)); }
    else if (fm.color.r !== 1) fm.color.setScalar(1);
    if (PL.faceHold > 0) { PL.faceHold -= dt; if (PL.faceHold > 0) { setFace(PL.faceHoldName); return; } PL.faceHoldName = null; }
    let f = 'smile';
    if (PL.special === 'victory') f = 'stareyes';                                          // 이김(결과 화면)
    else if (PL.resting || PL.special === 'covered' || PL.special === 'sit') f = 'sleepy'; // 쉬는 중·안개에 덮임: 감은 눈 + Z
    else if (PL.inv > 0.9) f = 'surprised';                                                // 안개에 닿은 직후 0.6초: 동그란 눈 + o 입
    else if (PL.bigOn || (PL.airborne && PL.onLand)) f = 'heart';                          // 큰 소리 도약 중
    else if (PL.joyT > 0) f = 'wink';                                                      // 카드 고른 뒤 폴짝
    else if (PL.recoil >= 0 && PL.recoil < 0.3) f = 'happy';                               // 소리 쏠 때 ^^
    setFace(f);
  }
  PL.faceState = () => (PL.faceScr ? { name: PL.faceName, offset: +PL.faceMap.offset.x.toFixed(4), hold: +PL.faceHold.toFixed(2), flash: +(PL.flashT > 0 ? PL.flashT : 0).toFixed(3), bright: +PL.faceScr.material.color.r.toFixed(2) } : null);

  PL.init = function (scene) {
    const R = TG.R, hero = (PL.hero = TG.hero || TG.HEROES.sefo), gltf = (TG.M.gltf && TG.M.gltf[hero.model]) || TG.M.sefoGltf;
    const HEIGHT = (PL.HEIGHT = hero.height || HEIGHT0);
    PL.hk = HEIGHT / HEIGHT0;
    const model = (PL.model = gltf.scene);
    model.scale.set(1, 1, 1).multiplyScalar(HEIGHT);
    const root = (PL.root = new T.Group());
    const body = (PL.body = new T.Group());
    root.add(body); body.add(model);
    scene.add(root);
    PL.mats = [];
    // SEFO 전용 표시값: x = 닿음 번쩍(0.1초 이하, 밝기 +30% + 테두리 빛), y = 금빛 테두리(카드·회복·일어남). 통째로 흰색을 덮지 않음 → 검정 저지·빨강·34 가 늘 남음
    PL.fxU = { value: new T.Vector4(0, 0, 0, 0) };
    PL.toon = function (o) {
      o.fHead = 'uniform vec4 uSefo;\n';
      o.fFinal = '  outgoingLight *= 1.0 + 0.3 * uSefo.x;\n' +
        '  outgoingLight += vec3(1.0, 0.93, 0.82) * smoothstep(0.38, 0.78, fr) * uSefo.x * 0.9;\n' +
        '  outgoingLight += vec3(1.0, 0.74, 0.22) * smoothstep(0.42, 0.8, fr) * uSefo.y * 0.85;\n' +
        (hero.rimGlow ? '  outgoingLight += mix(vec3(0.55, 0.25, 0.95), vec3(0.18, 0.88, 0.94), smoothstep(-0.2, 0.8, N.y)) * smoothstep(0.5, 0.82, fr) * 0.32;\n' : ''); // MOSHEE: 검은 몸이 어두운 굴에서도 읽히게 은은한 림 라이트(아래 보라 → 위 시안, 큐브에 시안 테두리가 이미 있어 약하게). 다른 주인공은 빈 문자열(셰이더 그대로)
      const m = R.toon(o), obc = m.onBeforeCompile;
      m.onBeforeCompile = function (sh, rn) { sh.uniforms.uSefo = PL.fxU; obc(sh, rn); };
      m.transparent = true; // 무적 시간은 투명도 깜빡임으로 (늘 켜 둠 → 깜빡일 때 셰이더를 새로 만들지 않음)
      return m;
    };
    const meshes = [];
    PL.faceScr = null;
    model.traverse((o) => { if (o.isMesh && !o.userData.isOutline) { if (o.name === 'moshee_face_screen') setupFace(o); else meshes.push(o); } if (o.isBone) { PL.bones = PL.bones || {}; PL.bones[o.name] = o; } }); // MOSHEE 표정 화면판은 툰·외곽선 없이 따로
    meshes.forEach((o) => {
      const map = o.material.map; if (map) { map.anisotropy = TG.R.maxAniso || 4; }
      if (map && o.isSkinnedMesh && hero.id === 'sefo' && !map.userData.bold) { map.userData.bold = true; boldSleeveRed(o, map); }
      const m = PL.toon({ map, gain: 1.12, gamma: 0.95, sat: 1.12, rim: 0.5, spec: 0.12 });
      o.material = m; PL.mats.push(m);
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
      o.renderOrder = 9; // 발밑 링(8) 뒤에 그림
      const ol = R.addOutline(o, 1.15); ol.renderOrder = 1; PL.outlines = PL.outlines || []; PL.outlines.push(ol);
      // 가려져도 보이는 빨강 실루엣: 안개·소품 뒤에 있을 때만(깊이가 더 먼 곳만) 그려 SEFO 자리를 늘 알 수 있게.
      // 불투명 순서 0.5 = 다른 물체 다음·SEFO 자기 외곽선(1) 앞 → 제 몸끼리 겹친 곳에는 안 그려짐
      if (o.isSkinnedMesh) {
        const src = R.outlineMat(1.15);
        const xm = new T.MeshBasicMaterial({ color: hero.xray || 0xf0483c, side: T.BackSide, depthWrite: false, depthFunc: T.GreaterDepth });
        xm.onBeforeCompile = src.onBeforeCompile; xm.customProgramCacheKey = src.customProgramCacheKey;
        const x = new T.SkinnedMesh(o.geometry, xm); x.bind(o.skeleton, o.bindMatrix); x.frustumCulled = false;
        x.position.copy(o.position); x.quaternion.copy(o.quaternion); x.scale.copy(o.scale);
        x.userData.isOutline = true; x.renderOrder = 0.5; o.parent.add(x); PL.xray = x;
      }
    });
    PL.mainMesh = meshes[0];
    PL.headP0 = PL.bones && PL.bones.Head ? PL.bones.Head.position.clone() : null; // 11-17 2차: 머리 뼈의 처음 자리(동작 클립에 Head 위치 트랙이 없어 매 프레임 여기서 다시 놓음 — 모쉬 머리 내밀기가 쌓이지 않게)

    // 애니메이션: 뿌리 이동 빼기 (Hips 위치 x,z 고정)
    const mixer = (PL.mixer = new T.AnimationMixer(model));
    const clips = {};
    gltf.animations.forEach((c) => {
      c.tracks.forEach((tr) => {
        if (/Hips\.position$/.test(tr.name)) {
          const v = tr.values, x0 = v[0], z0 = v[2];
          for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
        }
      });
      clips[c.name] = c;
    });
    PL.clips = clips;
    PL.act = {
      idle: mixer.clipAction(clips.idle),
      run: mixer.clipAction(clips.run),
      cheer: mixer.clipAction(clips.cheer),
    };
    if (clips.sit) { PL.act.sit = mixer.clipAction(clips.sit); PL.act.sit.setLoop(T.LoopOnce, 1); PL.act.sit.clampWhenFinished = true; PL.act.sit.timeScale = 2.0; }
    if (clips.victory) { PL.act.victory = mixer.clipAction(clips.victory); }
    // v7 동작: big(큰 소리 도약) · covered(폭 덮임, 웅크려 졸기) · arise(일으킴) · joy(카드 고름)
    ['big', 'covered', 'arise', 'joy'].forEach((n) => { if (clips[n]) PL.act[n] = mixer.clipAction(clips[n]); });
    ['big', 'arise'].forEach((n) => { if (PL.act[n]) { PL.act[n].setLoop(T.LoopOnce, 1); PL.act[n].clampWhenFinished = true; } });
    PL.act.idle.play(); PL.act.run.play(); PL.act.run.setEffectiveWeight(0);
    PL.act.cheer.setLoop(T.LoopOnce, 1); PL.act.cheer.clampWhenFinished = true;
    mixer.addEventListener('finished', (e) => {
      if (e.action === PL.act.cheer) PL.cheerOut = true;
      if (e.action === PL.act.arise && PL.special === 'arise') { PL.act.arise.fadeOut(0.25); PL.special = null; }
    });
    buildProps();

    // 발밑 대표색 링 + 방향 화살표
    const ringG = new T.Group(); PL.ring = ringG; scene.add(ringG);
    const ringMat = (PL.ringMat = new T.MeshBasicMaterial({ color: new T.Color(hero.color), transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
    const ring = new T.Mesh(new T.RingGeometry(1.08, 1.34, 48), ringMat); ring.rotation.x = -Math.PI / 2; ringG.add(ring);
    const inner = new T.Mesh(new T.CircleGeometry(1.08, 40), new T.MeshBasicMaterial({ color: hero.color, transparent: true, opacity: 0.22, depthWrite: false })); inner.rotation.x = -Math.PI / 2; ringG.add(inner);
    // 흰 테 2줄: 빨간 타일 위에서도 링이 읽히게
    const edgeMat = new T.MeshBasicMaterial({ color: 0xfff6e8, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
    [[1.34, 1.43], [1.01, 1.08]].forEach((r) => { const e = new T.Mesh(new T.RingGeometry(r[0], r[1], 48), edgeMat); e.rotation.x = -Math.PI / 2; e.renderOrder = 8; ringG.add(e); });
    const tri = new T.Shape(); tri.moveTo(-0.32, 0); tri.lineTo(0.32, 0); tri.lineTo(0, 0.42); tri.closePath();
    const arrow = new T.Mesh(new T.ShapeGeometry(tri), ringMat); arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = Math.PI; arrow.position.z = 1.04;
    // ShapeGeometry 는 XY → 눕히면 y→-z. z 회전으로 앞(+z)을 향하게
    arrow.rotation.set(-Math.PI / 2, 0, Math.PI); arrow.position.set(0, 0, 1.38);
    const arrowHolder = new T.Group(); arrowHolder.add(arrow); ringG.add(arrowHolder); PL.arrow = arrowHolder;
    ringG.position.y = 0.04; ring.renderOrder = 8; arrow.renderOrder = 8; inner.renderOrder = 4; // 링·화살표는 안개 떼 위에 늘 보임

    // 모으기 링 3단
    PL.chargeRings = [];
    const cc = hero.charge || [0xff8a5b, 0xe5352b, 0xffd966];
    for (let i = 0; i < 3; i++) {
      const m = new T.Mesh(new T.TorusGeometry(1.7 + i * 0.55, 0.09 + i * 0.02, 6, 56), new T.MeshBasicMaterial({ color: new T.Color(cc[i]).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.12; m.visible = false; scene.add(m); PL.chargeRings.push(m);
    }

    // 조준 부채꼴
    const half = 0.5;
    const sg = new T.CircleGeometry(1, 28, -Math.PI / 2 - half, half * 2); sg.rotateX(-Math.PI / 2);
    PL.aim = new T.Mesh(sg, new T.ShaderMaterial({
      uniforms: { uA: { value: 0.0 }, uCol: { value: new T.Color(hero.aim || 0xff6a4a) }, uH: { value: half } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; uniform vec3 uCol; uniform float uH; varying vec3 vP; void main(){ float r = length(vP.xz); float an = abs(atan(vP.x, vP.z)); float edge = max(smoothstep(0.93, 0.985, r), smoothstep(uH - 0.07, uH - 0.015, an)); float mid = (1.0 - smoothstep(0.0, 0.035, an)) * step(0.5, fract(r * 6.0)); float a = (0.2 + 0.6 * edge + 0.45 * mid) * uA; a *= smoothstep(0.1, 0.22, r); vec3 c = mix(uCol * 1.4, vec3(1.5, 1.4, 1.2), max(edge, mid) * 0.75); gl_FragColor = vec4(c, clamp(a, 0.0, 1.0)); }',
      transparent: true, depthWrite: false,
    }));
    PL.aim.position.y = 0.05; PL.aim.visible = false; PL.aim.renderOrder = 3; scene.add(PL.aim);

    PL.reset();
  };

  PL.reset = function () {
    Object.assign(PL, {
      x: 0, z: 3.5, y: 0, vy: 0, vx: 0, vz: 0, kx: 0, kz: 0, yaw: Math.PI * 0, tyaw: 0, speed: 0,
      hp: 3, maxHp: 3, shield: 0, inv: 0, flash: 0, glow: 0, sq: 0, sqv: 0, lean: 0, side: 0, recoil: -1, recoilDir: 0,
      faceLock: 0, airborne: false, cheerT: -1, cheerOut: false, resting: false, restT: 0, slow: 1, spdMul: 1, onLand: null, noHurt: 0,
      chargeVis: 0, chargeLevel: 0, charging: false, introFly: false, lastHurt: 99, zoneT: 0, inZone: false, keepFace: false, aimK: 0, aimDir: 0, aimR: 8, aimA: 0, spin: null, headSpin: 0,
    });
    PL.px = PL.rx = PL.x; PL.pz = PL.rz = PL.z; PL.py = PL.ry = PL.y;
    PL.root.position.set(PL.x, 0, PL.z);
    PL.root.rotation.y = 0;
    PL.root.visible = true; PL.ring.visible = true;
    PL.act.cheer.stop(); PL.stopSpecial && PL.stopSpecial();
    if (PL.act.big) PL.act.big.stop(); if (PL.act.joy) PL.act.joy.stop(); PL.bigOn = false; PL.joyT = 0; PL.sitT = 0;
    PL.act.idle.setEffectiveWeight(1); PL.act.run.setEffectiveWeight(0);
    PL.act.idle.timeScale = 1;
  };

  // 스프링 스쿼시 (양수 = 위로 늘어남)
  PL.kick = function (v) { PL.sqv += v; };

  // 소리 파동 동작: 뒤로 젖힘 → 앞으로 튐
  PL.fireAnim = function (dir, level) {
    PL.recoil = 0; PL.recoilDir = dir; PL.recoilLv = level;
    PL.tyaw = dir; PL.yaw = dir; PL.faceLock = 0.28;
  };

  // 안개에 닿음: 「소리 크기」 1칸 줄고 뒤로 통 밀림 (보호 방울이 있으면 대신 톡). 돌려줌: false | 'shield' | true
  PL.hurt = function (fx, fz) {
    if (PL.inv > 0 || PL.resting || TG.Q.god || PL.noHurt > 0) return false;
    const sh = PL.shield > 0;
    if (sh) PL.shield--; else PL.hp = Math.max(0, PL.hp - 1);
    PL.inv = 1.5; PL.flash = 1; // 닿은 뒤 1.5초는 다시 안 닿음 (다시 일어나기가 없어져 1.2 → 1.5초)
    const dx = PL.x - fx, dz = PL.z - fz, d = Math.hypot(dx, dz) || 1;
    PL.kx = (dx / d) * 9; PL.kz = (dz / d) * 9;
    PL.kick(-6);
    PL.lastHurt = 0;
    return sh ? 'shield' : true;
  };

  // 큰 소리: 점프 → 착지 때 콜백
  PL.bigJump = function (onLand) {
    PL.vy = 9.5; PL.airborne = true; PL.onLand = onLand; PL.kick(5);
    PL.act.cheer.stop(); if (PL.act.joy) PL.act.joy.stop(); PL.joyT = 0;
    const a = PL.act.big;
    if (a) { // 도약 구간(0.24~0.62초)만 쓰고, 착지하면 두 팔 번쩍(cheer)으로 넘김
      a.reset(); a.paused = false; a.time = 0.24; a.timeScale = 0.8; a.setEffectiveWeight(1); a.fadeIn(0.06); a.play(); PL.bigOn = true;
    } else { PL.act.cheer.reset(); PL.act.cheer.setEffectiveWeight(1); PL.act.cheer.fadeIn(0.12); PL.act.cheer.play(); }
    PL.cheerT = 0; PL.cheerOut = false;
  };
  // 벌떡 일어나기 (비서 그런트가 태엽을 감아 줌)
  PL.getUp = function () {
    PL.setRest(false); PL.stopSpecial(); PL.act.idle.timeScale = 1;
    PL.kick(6); PL.glow = 0.8;
    if (PL.act.arise) { PL.playSpecial('arise'); PL.act.arise.time = 0.62; } // 웅크린 데서 일어서는 구간만
    else { PL.vy = 7; PL.airborne = true; PL.onLand = null; }
  };
  // 카드 고른 뒤 짧게 폴짝 (다른 동작 위에 덧입힘)
  PL.joy = function () {
    const a = PL.act.joy; if (!a || PL.special || PL.resting || PL.airborne || PL.cheerT >= 0) return;
    a.reset(); a.time = 0.6; a.setEffectiveWeight(0.75); a.fadeIn(0.1); a.play(); PL.joyT = 0.9;
  };

  // 맨홀에서 튀어나와 착지
  PL.introLaunch = function (fromX, fromZ, toX, toZ, onLand) {
    PL.x = fromX; PL.z = fromZ; PL.y = -1.6; PL.vy = 15; PL.airborne = true; PL.introFly = true;
    PL.flyFrom = [fromX, fromZ]; PL.flyTo = [toX, toZ]; PL.flyT = 0; PL.onLand = onLand;
    PL.kick(6); PL.tyaw = 0; PL.yaw = 0;
  };

  PL.setRest = function (on) {
    PL.resting = on; PL.restT = 0;
    if (on) { PL.act.cheer.stop(); PL.act.run.setEffectiveWeight(0); PL.act.idle.setEffectiveWeight(1); PL.act.idle.timeScale = 0.6; PL.playSpecial(PL.act.covered && !(PL.hero && PL.hero.kid) ? 'covered' : 'sit'); PL.tyaw = 0.2; PL.faceLock = 0; } // 아이 캐릭터는 「꽃잎에 싸여 쉬는 중」 — 앉아 쉬는 동작(웅크림·쓰러짐 X, 기획서 ④ 안전 4)
  };
  // 특별 동작 (sit = 잠깐 쉬어요, victory = 결과 화면 승리)
  PL.playSpecial = function (name) {
    const a = PL.act[name]; if (!a) return false;
    if (PL.special && PL.special !== name && PL.act[PL.special]) PL.act[PL.special].fadeOut(0.2);
    PL.special = name; PL.act.cheer.stop(); PL.cheerT = -1;
    if (PL.act.big) PL.act.big.stop(); if (PL.act.joy) PL.act.joy.stop(); PL.bigOn = false; PL.joyT = 0;
    a.reset(); a.setEffectiveWeight(1); a.fadeIn(0.2); a.play();
    return true;
  };
  PL.stopSpecial = function () { if (PL.special && PL.act[PL.special]) PL.act[PL.special].stop(); PL.special = null; };

  // ── 규칙 계산 (1/60초 고정 걸음): 이동·밀림·무적 시간·점프. 그림과 무관하게 같은 결과 ──
  PL.sim = function (dt, input, simOn) {
    PL.px = PL.x; PL.pz = PL.z; PL.py = PL.y;
    const ax = input ? input.x : 0, az = input ? input.z : 0;
    const mag = Math.min(1, Math.hypot(ax, az));
    const cheering = PL.cheerT >= 0;
    const maxs = PL.MAXSPD * PL.spdMul * (TG.AS ? TG.AS.spdMul() : 1) * PL.slow * (cheering ? 0.35 : 1) * (PL.resting ? 0 : 1) * (PL.special === 'arise' ? 0.2 : 1); // AS.spdMul = 쎄니 「퍼플팡팡」 뒤 잠깐 빨라짐(규칙 쪽)
    if (simOn && !PL.introFly) {
      const tx = ax * maxs, tz = az * maxs;
      PL.vx = TG.damp(PL.vx, tx, mag > 0.05 ? 16 : 20, dt);
      PL.vz = TG.damp(PL.vz, tz, mag > 0.05 ? 16 : 20, dt);
      PL.kx = TG.damp(PL.kx, 0, 7, dt); PL.kz = TG.damp(PL.kz, 0, 7, dt);
      PL.x += (PL.vx + PL.kx) * dt; PL.z += (PL.vz + PL.kz) * dt;
      const p = { x: PL.x, z: PL.z }; TG.AR.push(p, 0.55); PL.x = p.x; PL.z = p.z;
      if (mag > 0.15 && PL.faceLock <= 0) {
        // 이동 방향으로 돌되, 위(화면 안쪽)로 갈 때도 얼굴이 조금 보이게 카메라 쪽으로 살짝 당김
        let y = Math.atan2(ax, az);
        if (Math.abs(y) > 2.0) y = Math.sign(y) * (2.0 + (Math.abs(y) - 2.0) * 0.55);
        PL.tyaw = y; PL.idleT = 0;
      } else if (mag <= 0.15 && PL.faceLock <= 0 && !PL.keepFace) {
        PL.idleT = (PL.idleT || 0) + dt;
        if (PL.idleT > 0.5) PL.tyaw = PL.tyaw * (1 - Math.min(1, dt * 2.5)) + 0.25 * Math.min(1, dt * 2.5); // 서 있으면 카메라 쪽을 봄
      }
    } else if (!simOn) { PL.vx = TG.damp(PL.vx, 0, 10, dt); PL.vz = TG.damp(PL.vz, 0, 10, dt); }
    PL.faceLock -= dt;
    PL.speed = Math.hypot(PL.vx, PL.vz);
    PL.inv = Math.max(0, PL.inv - dt); PL.noHurt = Math.max(0, PL.noHurt - dt);
    PL.lastHurt = (PL.lastHurt || 0) + dt;
    if (cheering) { PL.cheerT += dt; if (PL.cheerT > 1.85) { PL.cheerT = -1; PL.cheerOut = true; } }
    if (PL.resting) PL.restT += dt;

    // 공중 (큰 소리 점프 / 시작 연출)
    if (PL.airborne) {
      PL.vy -= 34 * dt; PL.y += PL.vy * dt;
      if (PL.introFly) {
        PL.flyT += dt;
        const k = Math.min(1, PL.flyT / 0.9);
        PL.x = TG.lerp(PL.flyFrom[0], PL.flyTo[0], k); PL.z = TG.lerp(PL.flyFrom[1], PL.flyTo[1], k);
      }
      if (PL.y <= 0 && PL.vy < 0) {
        PL.y = 0; PL.vy = 0; PL.airborne = false; PL.introFly = false;
        PL.kick(-9); TG.FX.dust(PL.x, PL.z, 10, 1.1);
        const cb = PL.onLand; PL.onLand = null; if (cb) cb();
      }
    }
    // 회전: 방향 전환 빠르게
    PL.yaw += TG.angDiff(PL.yaw, PL.tyaw) * (1 - Math.exp(-20 * dt));
  };

  // ── 11-17 2차: 소리 낼 때 몸동작 덧칠(그림만, 규칙 X). 세계 축 기준으로 뼈를 돌리고(rotW) 머리를 옮김 — mixer 가 매 프레임 회전을 다시 쓰고 머리 자리는 headP0 로 되돌리므로 쌓이지 않음 ──
  //  허조교 「올려놔!」: 한 발씩 나가는 멈춤 공격 → 호각 불며 고함치는 몸동작이 또렷하게: 머리 뒤로 젖힘(0~0.06초) → 앞으로 내지름, 가슴 펴기, 오른손은 입(호각)으로, 왼팔은 앞으로 쭉(「올려놔!」 지휘). 0.36초에 제자리
  //  모쉬 「푸슝 빔」: 큐브 머리를 뒤로 당겼다(0~0.07초) 앞으로 쑥 내밀며(0.07~0.17초, 월드 0.5) 얼굴 화면에서 빔이 나감(wave.js 빔 자리 = PL.headW) → 0.36초에 제자리
  const poseQ = new T.Quaternion(), poseAx = new T.Vector3(), poseF = new T.Vector3(), poseR = new T.Vector3();
  function rotW(b, ax, ang) { // 뼈 b 를 세계 축 ax 로 ang 만큼 돌림(부모 공간에서 premultiply — 뼈의 로컬 축을 몰라도 됨)
    if (!b || !ang) return;
    b.parent.updateWorldMatrix(true, false); b.parent.getWorldQuaternion(poseQ);
    poseAx.copy(ax).applyQuaternion(poseQ.invert()).normalize();
    b.quaternion.premultiply(poseQ.setFromAxisAngle(poseAx, ang));
  }
  function shotPose(dt) {
    const B = PL.bones; if (!B) return;
    if (B.Head && PL.headP0) B.Head.position.copy(PL.headP0); // 머리 자리 되돌림(아래 내밀기 전)
    const r = PL.recoil; PL.shotPoseK = 0;
    if (!(r >= 0)) return;
    const id = PL.hero.id, yaw = PL.yaw;
    const fwd = poseF.set(Math.sin(yaw), 0, Math.cos(yaw)), right = poseR.set(Math.cos(yaw), 0, -Math.sin(yaw)); // right 축 + 회전 = 앞으로 숙임, − = 뒤로 젖힘 / 내린 팔은 − 로 앞으로 들림
    if (id === 'gunner') {
      const wind = r < 0.06 ? r / 0.06 : 0;                                                            // 젖힘
      const hit = r < 0.06 ? 0 : r < 0.14 ? (r - 0.06) / 0.08 : r < 0.36 ? 1 - (r - 0.14) / 0.22 : 0; // 내지름 → 천천히 제자리
      const k = Math.max(wind, hit); PL.shotPoseK = k;
      rotW(B.Head, right, -0.5 * wind - 0.9 * hit);     // 머리: 뒤로 크게 젖혀 하늘 보고 고함(위에서 내려다보는 카메라에 얼굴·호각이 보임 — 앞으로 숙이면 철모가 얼굴을 가려 안 읽혔음)
      rotW(B.Spine01, right, 0.3 * hit);                // 몸통은 앞으로 쏠림(한 발 내지르기)
      rotW(B.Spine02, right, -0.2 * wind - 0.15 * hit);  // 가슴 펴기
      rotW(B.RightArm, right, -2.2 * k); rotW(B.RightForeArm, right, -1.8 * k); rotW(B.RightArm, fwd, 0.6 * k); // 오른손 → 입 앞(호각)
      rotW(B.LeftArm, right, -2.2 * k); rotW(B.LeftArm, fwd, -0.3 * k);                                   // 왼팔 → 앞으로 쭉(「올려놔!」)
    } else if (id === 'moshee') {
      const back = r < 0.07 ? r / 0.07 : 0;
      const out = r < 0.07 ? 0 : r < 0.17 ? TG.easeOutBack((r - 0.07) / 0.1) : r < 0.36 ? 1 - (r - 0.17) / 0.19 : 0;
      const off = -0.22 * back + 0.5 * out; PL.shotPoseK = off; // 머리 앞뒤 거리(월드 단위, − 뒤)
      if (B.Head && PL.headP0 && off) {
        B.Head.parent.updateWorldMatrix(true, false); B.Head.parent.getWorldQuaternion(poseQ); B.Head.parent.getWorldScale(poseAx);
        const s = poseAx.x || 1; // 부모 월드 배율 → 뼈 단위로
        poseAx.copy(fwd).applyQuaternion(poseQ.invert()).multiplyScalar(off / s);
        B.Head.position.add(poseAx);
      }
      rotW(B.Head, right, -0.3 * back + 0.25 * out); // 뒤로 살짝 젖혔다 앞으로 꾸벅
    }
  }

  // ── 그리기 (화면 주사율): 걸음 사이를 보간, 애니·스쿼시·번쩍·링 ──
  let drawT = 0;
  const megaV = new T.Vector3(), spinQ = new T.Quaternion(), spinAx = new T.Vector3();
  PL.draw = function (dt, alpha) {
    drawT += dt;
    const t = drawT;
    PL.rx = TG.lerp(PL.px, PL.x, alpha); PL.rz = TG.lerp(PL.pz, PL.z, alpha); PL.ry = TG.lerp(PL.py, PL.y, alpha);
    const turnRate = TG.angDiff(PL.yaw, PL.tyaw);
    const cheering = PL.cheerT >= 0;

    // 애니 블렌딩: 속도 따라 crossfade, run 속도 맞춤
    const f = TG.clamp(PL.speed / (PL.MAXSPD * 0.75), 0, 1);
    // 큰 소리: 도약 동작은 0.62초에서 멈춰 두고, 착지하면 cheer 로 넘김
    if (PL.bigOn) {
      const b = PL.act.big;
      if (b.time >= 0.62) { b.time = 0.62; b.paused = true; }
      if (!PL.airborne) { b.fadeOut(0.14); PL.bigOn = false; const c = PL.act.cheer; c.reset(); c.timeScale = 1.5; c.setEffectiveWeight(1); c.fadeIn(0.14); c.play(); }
    }
    if (PL.joyT > 0) { PL.joyT -= dt; if (PL.joyT <= 0 && PL.act.joy) PL.act.joy.fadeOut(0.22); }
    // 쉼터: 가만히 서 있으면 앉고, 움직이면 일어섬
    const inShelter = TG.G && TG.G.phase === 'shelter' && !PL.resting;
    if (inShelter && PL.speed < 0.4 && !PL.airborne) { PL.sitT = (PL.sitT || 0) + dt; if (PL.sitT > 0.7 && !PL.special && PL.act.sit) PL.playSpecial('sit'); }
    else { PL.sitT = 0; if (PL.special === 'sit' && !PL.resting) { PL.act.sit.fadeOut(0.18); PL.special = null; } }
    const ov = (a) => (a && a.isRunning() ? a.getEffectiveWeight() : 0);
    const cheerW = Math.min(1, Math.max(ov(PL.act.cheer), PL.bigOn || ov(PL.act.big) ? 1 : 0, ov(PL.act.joy)));
    const spW = PL.special ? 1 : 0;
    PL.act.run.setEffectiveWeight(f * (1 - cheerW) * (1 - spW));
    PL.act.idle.setEffectiveWeight((1 - f) * (1 - cheerW) * (1 - spW));
    PL.act.run.timeScale = TG.clamp(PL.speed / 5.6, 0.6, 1.35);
    if (PL.cheerOut) { PL.act.cheer.fadeOut(0.25); PL.cheerOut = false; }
    // 11-17 2차: 뼈 덧칠(허리 세움·pose·headSpin·shotPose)은 mixer 가 매 프레임 다시 쓴다는 전제였는데, three.js PropertyMixer 는 **값이 바뀐 뼈만** 다시 씀(멈춤 창·dt 0 이면 안 씀) → 멈춘 채 그리면 덧칠이 프레임마다 쌓임.
    //  → 지난 프레임에 덧칠한 뼈를 먼저 덧칠 전 값으로 되돌린 뒤 mixer 를 돌리고, 덧칠 직전 값을 다시 적어 둠(어느 경우에도 쌓이지 않음)
    if (PL._ovl) for (const o of PL._ovl) o.b.quaternion.copy(o.q);
    PL.mixer.update(dt);
    if (!PL._ovl && PL.bones) PL._ovl = ['Hips', 'Head', 'Spine01', 'Spine02', 'RightArm', 'RightForeArm', 'LeftArm'].concat(Object.keys(PL.hero.pose || {})).filter((n, i, a) => PL.bones[n] && a.indexOf(n) === i).map((n) => ({ b: PL.bones[n], q: new T.Quaternion() }));
    if (PL._ovl) for (const o of PL._ovl) o.q.copy(o.b.quaternion);
    // 달리기 클립이 몸을 많이 숙여 위에서 얼굴이 가려짐 → 허리·고개를 세움
    const rw = PL.act.run.getEffectiveWeight(), B = PL.bones;
    if (rw > 0.01 && B.Hips && B.Head) { B.Hips.rotateX(-0.35 * rw); B.Head.rotateX(-0.25 * rw); }
    if (B.Head) B.Head.scale.setScalar(PL.headS0 * (PL.hero.headScale || 1)); // SEFO v0 는 머리를 18% 줄여(0.82) 위에서도 어깨·빨간 줄이 보이게 (처음 값 기준 — 쌓이지 않음). 다른 주인공은 그대로
    if (PL.hero.pose) for (const k in PL.hero.pose) { const b = B[k]; if (b) { const e = PL.hero.pose[k]; b.rotateX(e[0]); b.rotateY(e[1]); b.rotateZ(e[2]); } } // 11-16 밤: 뼈 회전 덧칠(베리 편 손 → 쥐는 손처럼, heroes.js pose) — 동작 위에 매 프레임 더함(mixer 가 매 프레임 다시 쓰므로 쌓이지 않음)
    // 11-17 모쉬 「픽셀 빔!」: 빔이 도는 동안 머리(큐브)도 같은 각도로 돎 — 세계 위 축 기준, mixer 가 매 프레임 다시 쓰므로 쌓이지 않음(한 몸)
    { const bm = TG.WV && TG.WV.beam; PL.headSpin = 0;
      if (bm && bm.on && B.Head) { const ang = TG.WV.beamAngle() - bm.dir; PL.headSpin = ang; B.Head.parent.updateWorldMatrix(true, false); B.Head.parent.getWorldQuaternion(spinQ); spinAx.set(0, 1, 0).applyQuaternion(spinQ.invert()).normalize(); B.Head.quaternion.premultiply(spinQ.setFromAxisAngle(spinAx, ang)); } }
    shotPose(dt); // 11-17 2차: 소리 낼 때 주인공별 몸동작 덧칠(허조교 호각 고함·모쉬 머리 내밀기) — 세계 축 기준 뼈 회전·이동, mixer 가 매 프레임 다시 쓰므로 쌓이지 않음

    // 스쿼시 스프링
    const sdt = Math.min(dt, 0.033);
    PL.sqv += (-170 * PL.sq - 13 * PL.sqv) * sdt; PL.sq += PL.sqv * sdt; PL.sq = TG.clamp(PL.sq, -0.4, 0.45);

    // 통통 걸음: run 주기와 맞춘 위아래 튐 + 좌우 기울기 (+ 발소리)
    const runPh = (PL.act.run.time / PL.clips.run.duration) * Math.PI * 2;
    const bob = Math.abs(Math.sin(runPh)) * 0.16 * f;
    if (f > 0.3 && Math.abs(Math.sin(runPh)) < 0.12 && !PL._stepped) { PL.kick(-1.6 * f); PL._stepped = true; if (!PL.airborne && PL.root.visible) TG.A.syn('step'); }
    if (Math.abs(Math.sin(runPh)) > 0.5) PL._stepped = false;
    // 숨쉬기 (대기)
    const breathe = (1 - f) * Math.sin(t * (Math.PI * 2 / 1.2)) * 0.03;

    // 반동
    let recoilLean = 0;
    if (PL.recoil >= 0) {
      PL.recoil += dt;
      const r = PL.recoil;
      if (r < 0.06) recoilLean = -0.32 * (r / 0.06);
      else if (r < 0.16) { recoilLean = TG.lerp(-0.32, 0.38, (r - 0.06) / 0.1); if (!PL._lunged) { PL._lunged = true; PL.kick(4 + (PL.recoilLv || 0) * 1.2); } }
      else if (r < 0.36) recoilLean = TG.lerp(0.38, 0, (r - 0.16) / 0.2);
      else { PL.recoil = -1; PL._lunged = false; }
    }
    PL.lean = TG.damp(PL.lean, f * 0.1 + recoilLean, 22, dt);
    PL.side = TG.damp(PL.side, TG.clamp(-turnRate * 0.35, -0.3, 0.3) + Math.sin(runPh) * 0.14 * f, 14, dt);

    // 쉬기(앉아서 숨 고르기)
    const restDrop = PL.resting ? Math.min(1, PL.restT / 0.4) : 0;

    // 반영
    const sy = 1 + PL.sq + breathe, sxz = 1 - PL.sq * 0.55 - breathe * 0.5;
    PL.root.position.set(PL.rx, PL.ry + bob * (PL.airborne ? 0 : 1), PL.rz);
    // 11-17 쎄니 「퍼플팡팡!」: 한 바퀴 싹 돌며 물감 뿌림 — 그림만(규칙 yaw 는 그대로)
    let spinOff = 0;
    if (PL.spin) { PL.spin.t += dt; const k = TG.clamp(PL.spin.t / PL.spin.dur, 0, 1); spinOff = (k * k * (3 - 2 * k)) * Math.PI * 2 * (PL.spin.turns || 1); if (k >= 1) PL.spin = null; }
    PL.root.rotation.y = PL.yaw + spinOff;
    PL.body.rotation.set(PL.lean, 0, PL.side);
    PL.body.scale.set(sxz, sy, sxz);
    if (PL.resting && !PL.act.sit) poseRest(restDrop, t);
    // 메가폰: 오른손을 따라가되 늘 앞쪽 위를 향함. 손을 들면 더 위로, 소리 낼 때 톡 커짐
    if (PL.mega && B.RightHand) {
      PL.root.updateMatrixWorld(true);
      B.RightHand.getWorldPosition(megaV); PL.body.worldToLocal(megaV);
      const up = TG.clamp((megaV.y - 1.3) / 1.0, 0, 1);
      const fire = PL.recoil >= 0 ? Math.sin(Math.min(1, PL.recoil / 0.36) * Math.PI) : 0;
      PL.mega.position.set(megaV.x - 0.04 - up * 0.1, megaV.y + 0.1 - up * 0.12, megaV.z + 0.12);
      PL.mega.rotation.set(-(0.38 + up * 0.12 + fire * 0.3) + Math.sin(t * 9) * 0.05 * f, -0.32 - up * 0.75, 0);
      PL.mega.scale.setScalar(1 + fire * 0.28);
    }

    // 딸기 막대(베리)·호루라기(허조교)·붐박스(MOSHEE): 뼈에 붙어 몸을 따라감. 소리 낼 때 톡 커졌다 돌아옴
    if (PL.wand) {
      const fire = PL.recoil >= 0 ? Math.sin(Math.min(1, PL.recoil / 0.36) * Math.PI) : 0;
      PL.wand.scale.copy(PL.wandS0).multiplyScalar(1 + fire * (PL.hero.prop === 'boombox' ? 0.15 : 0.25));
    }
    faceUpdate(dt); // MOSHEE 큐브 표정 (다른 주인공은 아무 일 없음)
    if (B.Head) { PL.root.updateMatrixWorld(true); B.Head.getWorldPosition(PL.headW || (PL.headW = new T.Vector3())); } // 11-17 머리 세계 위치(모쉬 빔이 머리에서 나옴, wave.js beamDraw)

    // 번쩍 (닿음·무적 깜빡임)
    // 닿음 번쩍은 0.1초(밝기 +30% + 테두리 빛), 무적 시간은 투명도 깜빡임, 보호 시간은 발밑 링만 깜빡 → 몸 색(검정·빨강·34)은 늘 그대로
    PL.flash = Math.max(0, PL.flash - dt * 10);
    PL.glow = Math.max(0, (PL.glow || 0) - dt * 3);
    PL.fxU.value.x = PL.flash; PL.fxU.value.y = Math.min(1, PL.glow * 1.5);
    const low = PL.inv > 0 && PL.inv < 1.1 && Math.sin(PL.inv * 30) > 0.1;
    if (low !== PL._low) {
      PL._low = low;
      PL.mats.forEach((m) => (m.opacity = low ? 0.4 : 1));
      if (PL.outlines) PL.outlines.forEach((o) => (o.visible = !low));
      if (PL.back34) PL.back34.material.opacity = low ? 0.4 : 1;
    }
    const play = TG.G && (TG.G.phase === 'floor' || TG.G.phase === 'boss');
    PL.ringMat.opacity = play && PL.noHurt > 0 && PL.inv <= 0 && Math.sin(t * 16) > 0.2 ? 0.5 : 0.95;

    // 발밑 링
    PL.ring.position.set(PL.rx, 0.04, PL.rz);
    PL.arrow.rotation.y = PL.yaw;
    const rs = 1 + Math.max(0, -PL.sq) * 0.5;
    PL.ring.scale.set(rs, 1, rs);

    // 둘레 링 3단 (멈춰 서 있으면 저절로 커짐)
    const lv = PL.chargeLevel;
    PL.chargeVis = TG.damp(PL.chargeVis, PL.charging ? 1 : 0, 14, dt);
    PL.chargeRings.forEach((m, i) => {
      const on = PL.charging && lv > i;
      m.visible = PL.chargeVis > 0.02 && (on || m.material.opacity > 0.02);
      m.material.opacity = TG.damp(m.material.opacity, on ? 0.9 : 0, 16, dt);
      const pulse = 1 + Math.sin(t * 9 - i * 1.2) * 0.06 + (on ? 0 : -0.2);
      m.scale.setScalar(pulse * (0.8 + 0.2 * PL.chargeVis));
      m.position.set(PL.rx, 0.12 + i * 0.03, PL.rz);
    });
    // 조준 부채꼴: 「소리」를 누르는 동안 쏘는 쪽 바닥에 (game.js 가 aimK·aimDir·aimR 를 줌)
    if (PL.aim) {
      PL.aimA = TG.damp(PL.aimA || 0, PL.aimK || 0, 18, dt);
      PL.aim.visible = PL.aimA > 0.02;
      if (PL.aim.visible) {
        PL.aim.material.uniforms.uA.value = PL.aimA;
        PL.aim.position.set(PL.rx, 0.05, PL.rz); PL.aim.rotation.y = PL.aimDir; PL.aim.scale.set(PL.aimR, 1, PL.aimR);
      }
    }
  };

  // 손 메가폰(원뿔, 금색+빨간 테) + 등번호 34(크게) — 뼈에 붙임 (뼈 단위: 약 35 = 월드 1). 옷 모양은 그대로
  function buildProps() {
    const R = TG.R, B = PL.bones || {};
    const keep = (g) => g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) { o.castShadow = true; o.renderOrder = 9; PL.mats.push(o.material); } else if (o.userData.isOutline) { o.renderOrder = 1; PL.outlines = PL.outlines || []; PL.outlines.push(o); } });
    if (PL.hero.propNode) { // 베리 딸기 막대·세포 확성기(v0)·쎄니 소리굽쇠·MOSHEE 붐박스(RightHand 자식)·허조교 호루라기(Spine 자식)는 GLB 안 노드 (tools/build_hero.py) — 찾아서 소리 낼 때 톡 커지게만
      PL.model.traverse((o) => { if (o.name === PL.hero.propNode) PL.wand = o; });
      if (PL.wand) PL.wandS0 = PL.wand.scale.clone();
    }
    if (B.RightHand && PL.hero.prop === 'mega') { // 몸통에 달고 매 프레임 손 위치로 옮김 → 늘 앞을 향해 위에서도 원뿔로 보임 (단위: 월드)
      const g = new T.Group();
      const gold = PL.toon({ color: 0xe8b23a, gain: 1.15, rim: 0.6, spec: 0.5, side: T.DoubleSide }), red = PL.toon({ color: 0xe5352b, gain: 1.1, rim: 0.4, spec: 0.3 }), dark = PL.toon({ color: 0x7a4a1c, gain: 0.9 });
      const add = (geo, mat, z, ol) => { const m = new T.Mesh(geo, mat); m.position.z = z; g.add(m); if (ol) R.addOutline(m, 1.0); return m; };
      const rx = (geo) => geo.rotateX(Math.PI / 2);
      add(rx(new T.CylinderGeometry(0.4, 0.1, 0.78, 24, 1, true)), gold, 0.45, true);       // 나팔 몸
      add(new T.TorusGeometry(0.4, 0.06, 10, 28), red, 0.84, true);                          // 빨간 테
      add(new T.TorusGeometry(0.25, 0.035, 8, 24), red, 0.45, false);                        // 가운데 빨간 줄
      add(new T.CircleGeometry(0.2, 20), dark, 0.3, false);                                  // 안쪽 그늘
      add(rx(new T.CylinderGeometry(0.11, 0.13, 0.14, 14)), red, 0.0, true);                 // 입 대는 곳
      keep(g);
      g.rotation.order = 'YXZ';
      PL.body.add(g); PL.mega = g;
    }
    if (B.Spine02 && PL.hero.badge) { // 등번호 34: 2배 가까이 키우고 등 굴곡에 맞춰 살짝 휨
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192;
      const c = cv.getContext('2d'); c.font = '900 italic 150px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = 26; c.strokeStyle = '#e5352b'; c.strokeText(PL.hero.badge, 128, 104); c.fillStyle = '#ffffff'; c.fillText(PL.hero.badge, 128, 104);
      const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = TG.R.maxAniso || 4;
      const geo = new T.PlaneGeometry(27, 20, 8, 1), pa = geo.getAttribute('position');
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, -(x * x) / 130); }
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.position.set(0, -1.5, -12.6); m.rotation.y = Math.PI; m.renderOrder = 10; B.Spine02.add(m); PL.back34 = m;
    }
    if (B.Head) { if (B.Head.userData.s0 == null) B.Head.userData.s0 = B.Head.scale.x; PL.headS0 = B.Head.userData.s0; }
  }

  // 뼈에 주로 붙은 정점 고르기 (이름 정규식)
  function boneMask(mesh, re) {
    const g = mesh.geometry, si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
    const hit = mesh.skeleton.bones.map((b) => re.test(b.name)), n = si.count, out = new Uint8Array(n);
    for (let v = 0; v < n; v++) { let best = -1, bi = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > best) { best = w; bi = si.getComponent(v, k); } } out[v] = hit[bi] ? 1 : 0; }
    return out;
  }

  // 소매 빨간 줄 굵게: 어깨·팔에 붙은 면의 텍스처에서만 빨강을 몇 픽셀 넓힘 (옷 모양·다른 부위는 그대로)
  function boldSleeveRed(mesh, map) {
    try {
      const img = map.image, W = img && img.width, H = img && img.height; if (!W || !H) return;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0, W, H);
      const g = mesh.geometry, uv = g.getAttribute('uv'), idx = g.index, arm = boneMask(mesh, /^(Left|Right)(Shoulder|Arm)$/);
      const mk = document.createElement('canvas'); mk.width = W; mk.height = H;
      const m = mk.getContext('2d', { willReadFrequently: true }); m.fillStyle = '#fff'; m.beginPath();
      const nT = idx ? idx.count / 3 : uv.count / 3, vi = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
      const fy = map.flipY ? (y) => (1 - y) * H : (y) => y * H;
      for (let t = 0; t < nT; t++) {
        const a = vi(t, 0), b = vi(t, 1), d = vi(t, 2);
        if (!(arm[a] && arm[b] && arm[d])) continue;
        m.moveTo(uv.getX(a) * W, fy(uv.getY(a))); m.lineTo(uv.getX(b) * W, fy(uv.getY(b))); m.lineTo(uv.getX(d) * W, fy(uv.getY(d))); m.closePath();
      }
      m.fill();
      const id = c.getImageData(0, 0, W, H), px = id.data, mp = m.getImageData(0, 0, W, H).data, N = W * H;
      const red = new Uint8Array(N), can = new Uint8Array(N);
      for (let i = 0; i < N; i++) {
        const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
        if (mp[i * 4 + 3] < 128) continue;
        if (r > 135 && gg < 100 && b < 100 && r > gg * 2) red[i] = 1; else if (r < 80 && gg < 80 && b < 80) can[i] = 1;
      }
      const passes = Math.max(2, Math.round(W / 1024 * 5));
      for (let p = 0; p < passes; p++) {
        const add = [];
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x; if (!can[i]) continue;
          const j = red[i - 1] ? i - 1 : red[i + 1] ? i + 1 : red[i - W] ? i - W : red[i + W] ? i + W : -1;
          if (j >= 0) add.push(i, j);
        }
        for (let q = 0; q < add.length; q += 2) { const i = add[q], j = add[q + 1]; px[i * 4] = px[j * 4]; px[i * 4 + 1] = px[j * 4 + 1]; px[i * 4 + 2] = px[j * 4 + 2]; red[i] = 1; can[i] = 0; }
      }
      c.putImageData(id, 0, 0);
      map.image = cv; map.needsUpdate = true;
    } catch (e) { /* 텍스처를 못 읽으면 원래 그림 그대로 */ }
  }

  // 앉은 자세: 다리 접고 몸 낮춤 (뼈 직접 회전, 믹서 뒤에 반영)
  function poseRest(k, t) {
    const B = PL.bones || {};
    const e = TG.easeOutBack(k);
    ['LeftUpLeg', 'RightUpLeg'].forEach((n, i) => { const b = B[n]; if (b) { b.rotation.x -= 1.45 * e; b.rotation.z += (i ? -0.25 : 0.25) * e; } });
    ['LeftLeg', 'RightLeg'].forEach((n) => { const b = B[n]; if (b) b.rotation.x += 1.6 * e; });
    if (B.Spine) B.Spine.rotation.x += 0.15 * e + Math.sin(t * 3) * 0.04;
    if (B.Head) B.Head.rotation.x += Math.sin(t * 3) * 0.06;
    PL.root.position.y = -0.62 * e;
  }

  PL.headPos = function (out) {
    return out.set(PL.rx, PL.root.position.y + 3.45 * (PL.hk || 1) + PL.sq * 1.2, PL.rz);
  };
})();
