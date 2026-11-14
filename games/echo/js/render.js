/* 톱니골 던전 — 렌더러·툰 재질·외곽선·포스트(블룸)·동적 해상도 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const R = (TG.R = {});
  // 보이는 화면 크기(2026-11-13 「화면 아래 잘림」): 폰 주소창이 숨거나 전체화면이 되면 innerHeight·100vh 가 실제 보이는 높이와 어긋남 →
  // visualViewport(확대 안 했을 때)를 기준으로 재고, 캔버스·UI 칸을 그 px 로 맞춤
  TG.vp = function () {
    let w = innerWidth, h = innerHeight;
    try { const v = window.visualViewport; if (v && v.width > 50 && v.height > 50 && Math.abs((v.scale || 1) - 1) < 0.01) { w = v.width; h = v.height; } } catch (e) { /* 무시 */ }
    return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  };

  // 모든 툰 재질이 함께 쓰는 값 (매 프레임 한 번만 갱신)
  R.U = {
    uLightView: { value: new T.Vector3(0, 1, 0) },
    uThick: { value: 2.5 },
    uRes: { value: new T.Vector2(1280, 720) },
    uTime: { value: 0 },
  };

  // 3단 툰 그라데이션 (그늘·중간·밝음)
  const g = new Uint8Array([105, 175, 255]);
  R.gradient = new T.DataTexture(g, 3, 1, T.RedFormat);
  R.gradient.minFilter = R.gradient.magFilter = T.NearestFilter;
  R.gradient.generateMipmaps = false;
  R.gradient.needsUpdate = true;

  /* 툰 재질 만들기
     o: {map,color,gain,gamma,sat,rim,spec,emissive,ei,teal,inst(인스턴스 번쩍),vHead,vMain,fHead,fColor,fFinal,key,side,transparent} */
  R.toon = function (o) {
    o = o || {};
    const m = new T.MeshToonMaterial({
      map: o.map || null,
      color: o.color != null ? o.color : 0xffffff,
      gradientMap: R.gradient,
      emissive: o.emissive != null ? o.emissive : 0x000000,
      emissiveIntensity: o.ei != null ? o.ei : 1,
      side: o.side || T.FrontSide,
    });
    m.userData.flash = { value: 0 };
    const P = {
      gain: (o.gain != null ? o.gain : 1).toFixed(3),
      gamma: (o.gamma != null ? o.gamma : 1).toFixed(3),
      sat: (o.sat != null ? o.sat : 1).toFixed(3),
      rim: (o.rim != null ? o.rim : 0.35).toFixed(3),
      spec: (o.spec != null ? o.spec : 0).toFixed(3),
      teal: o.teal ? 1 : 0,
      inst: o.inst ? 1 : 0,
      key: o.key || '',
    };
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uLightView = R.U.uLightView;
      sh.uniforms.uTime = R.U.uTime;
      sh.uniforms.uFlash = m.userData.flash;
      let vs = sh.vertexShader, fs = sh.fragmentShader;
      vs = vs.replace('#include <common>', '#include <common>\nuniform float uTime;\n' +
        (P.inst ? 'attribute float aFlash; varying float vFlash;\n' : '') + (o.vHead || ''));
      vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (P.inst ? 'vFlash = aFlash;\n' : '') + (o.vMain || ''));
      fs = fs.replace('#include <common>', '#include <common>\nuniform vec3 uLightView; uniform float uFlash; uniform float uTime;\n' +
        (P.inst ? 'varying float vFlash;\n' : '') + (o.fHead || ''));
      let col = '#include <map_fragment>\n' +
        'diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(' + P.gamma + ')) * ' + P.gain + ';\n' +
        '{ float lum = dot(diffuseColor.rgb, vec3(0.2126,0.7152,0.0722)); diffuseColor.rgb = max(mix(vec3(lum), diffuseColor.rgb, ' + P.sat + '), 0.0); }\n';
      if (P.teal) {
        // 째깍이: 어두운 청록 → 밝은 청록(#2FB7A8)
        col += '{ vec3 c = diffuseColor.rgb; float lum = dot(c, vec3(0.2126,0.7152,0.0722));\n' +
          '  float tm = smoothstep(0.003, 0.03, (c.g + c.b) * 0.5 - c.r) * (1.0 - smoothstep(0.10, 0.22, lum));\n' +
          '  vec3 teal = vec3(0.028, 0.47, 0.39) * (0.75 + lum * 9.0);\n' +
          '  diffuseColor.rgb = mix(c, teal, tm); }\n';
      }
      col += (o.fColor || '');
      fs = fs.replace('#include <map_fragment>', col);
      fs = fs.replace('#include <opaque_fragment>',
        '{ vec3 N = normalize(normal); vec3 V = normalize(vViewPosition);\n' +
        '  float fr = 1.0 - max(dot(N, V), 0.0);\n' +
        '  float rimv = smoothstep(0.52, 0.78, fr) * smoothstep(-0.25, 0.55, N.y);\n' +
        '  outgoingLight += (diffuseColor.rgb * 1.1 + vec3(0.25,0.22,0.18)) * rimv * ' + P.rim + ';\n' +
        '  vec3 H = normalize(uLightView + V);\n' +
        '  outgoingLight += vec3(1.0, 0.95, 0.82) * smoothstep(0.93, 0.96, dot(N, H)) * ' + P.spec + ';\n' +
        (o.fFinal || '') +
        '  outgoingLight = mix(outgoingLight, ' + (o.flashCol || 'vec3(1.8, 1.8, 1.75)') + ', clamp(uFlash' + (P.inst ? ' + vFlash' : '') + ', 0.0, 1.0));\n' +
        '}\n#include <opaque_fragment>');
      sh.vertexShader = vs;
      sh.fragmentShader = fs;
    };
    m.customProgramCacheKey = () => 'toon' + JSON.stringify(P) + (o.vHead || '').length + (o.fColor || '').length + (o.fFinal || '').length + (o.flashCol || '');
    return m;
  };

  // 외곽선용 부드러운 법선 (같은 위치 정점끼리 평균) — 각진 모델에서도 선이 끊기지 않게
  R.addOutlineNormals = function (geo) {
    if (geo.getAttribute('outlineNormal')) return geo;
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    const pos = geo.getAttribute('position'), nrm = geo.getAttribute('normal');
    const n = pos.count, map = new Map(), keys = new Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.round(pos.getX(i) * 1000) + ',' + Math.round(pos.getY(i) * 1000) + ',' + Math.round(pos.getZ(i) * 1000);
      keys[i] = k;
      let a = map.get(k);
      if (!a) { a = [0, 0, 0]; map.set(k, a); }
      a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i);
    }
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = map.get(keys[i]);
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
    }
    geo.setAttribute('outlineNormal', new T.BufferAttribute(out, 3));
    return geo;
  };

  // 굵은 검정 외곽선 (뒤집은 껍데기 + 화면 공간 일정 두께). scale: 두께 배율
  const outlineCache = {};
  // zp: 깊이 밀기(기본 0.0025). 큰 모델(박동탑)은 작게 줘야 선이 제 몸 뒤로 숨지 않음
  R.outlineMat = function (scale, zp) {
    scale = scale || 1;
    zp = zp || 0.0025;
    const key = scale.toFixed(2) + (zp !== 0.0025 ? '_' + zp : '');
    if (outlineCache[key]) return outlineCache[key];
    const m = new T.MeshBasicMaterial({ color: 0x17121f, side: T.BackSide });
    m.onBeforeCompile = function (sh) {
      sh.uniforms.uThick = R.U.uThick;
      sh.uniforms.uRes = R.U.uRes;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 outlineNormal; uniform float uThick; uniform vec2 uRes;')
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = outlineNormal;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
        .replace('#include <project_vertex>', '#include <project_vertex>\n{\n' +
          '#ifdef USE_SKINNING\n  vec3 vN = transformedNormal;\n  #ifdef FLIP_SIDED\n  vN = -vN;\n  #endif\n' +
          '#else\n  vec3 oN = outlineNormal;\n  #ifdef USE_INSTANCING\n  oN = mat3(instanceMatrix) * oN;\n  #endif\n  vec3 vN = normalMatrix * oN;\n#endif\n' +
          '  vec4 cN = projectionMatrix * vec4(vN, 0.0);\n' +
          '  vec2 d = cN.xy * uRes; float L = length(d);\n' +
          '  if (L > 1e-6) { d /= L; gl_Position.xy += d * uThick * ' + scale.toFixed(2) + ' * 2.0 / uRes * gl_Position.w; }\n' +
          '  gl_Position.z += ' + zp.toFixed(5) + ' * gl_Position.w;\n' +
          '}');
    };
    m.customProgramCacheKey = () => 'outline' + key;
    outlineCache[key] = m;
    return m;
  };

  // 메시에 외곽선 껍데기 붙이기 (같은 부모, 같은 변환). InstancedMesh·SkinnedMesh 지원
  R.addOutline = function (mesh, scale) {
    R.addOutlineNormals(mesh.geometry);
    let o;
    if (mesh.isSkinnedMesh) {
      o = new T.SkinnedMesh(mesh.geometry, R.outlineMat(scale));
      o.bind(mesh.skeleton, mesh.bindMatrix);
      o.frustumCulled = false;
    } else if (mesh.isInstancedMesh) {
      o = new T.InstancedMesh(mesh.geometry, R.outlineMat(scale), mesh.instanceMatrix.count);
      o.instanceMatrix = mesh.instanceMatrix;
      o.frustumCulled = false;
    } else {
      o = new T.Mesh(mesh.geometry, R.outlineMat(scale));
    }
    o.position.copy(mesh.position); o.quaternion.copy(mesh.quaternion); o.scale.copy(mesh.scale);
    o.castShadow = false; o.receiveShadow = false;
    o.userData.isOutline = true;
    o.renderOrder = mesh.renderOrder;
    if (mesh.parent) mesh.parent.add(o);
    mesh.userData.outline = o;
    return o;
  };

  R.init = function (canvas) {
    const renderer = (R.renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false }));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.setClearColor(0x9fd7f2);
    renderer.info.autoReset = false; // 포스트 패스까지 한 프레임 합계
    R.maxAniso = renderer.capabilities.getMaxAnisotropy() || 1; // 화질(갤럭시탭): 기기 최대(보통 16)까지 — 비스듬한 바닥·모델 무늬가 뭉개지지 않게

    const scene = (R.scene = new T.Scene());
    scene.background = new T.Color(0x9fd7f2);
    const cam = (R.camera = new T.PerspectiveCamera(38, 16 / 9, 0.5, 160));
    scene.add(cam);

    // 반구광: 세기는 game.js 가 장면마다 정함(1.1~1.9) → 여기서는 색을 한 단계 어둡게 해 뿌연 느낌을 줄임 (V2f)
    const hemi = (R.hemi = new T.HemisphereLight(new T.Color(0xdcefff).multiplyScalar(0.84), new T.Color(0xd9a878).multiplyScalar(0.8), 1.35));
    scene.add(hemi);
    const sun = (R.sun = new T.DirectionalLight(0xfff1dc, 2.3));
    sun.castShadow = true;
    const ss = TG.isTouch ? 768 : 2048;   // 화질: 터치 기기 「자동」 768(예전 그대로), 「높게」 2048 (아래 R.shadowQ). 2048 은 소프트웨어 렌더에서 한 프레임 2배 넘게 느려 자동엔 안 씀
    sun.shadow.mapSize.set(ss, ss);
    const sc = sun.shadow.camera;
    sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2;
    R.sunOffset = new T.Vector3(-11, 24, 13);
    scene.add(sun); scene.add(sun.target);

    // 포스트: 렌더 → 블룸 → 출력(톤매핑·sRGB). MSAA 4x
    const { w, h } = TG.vp();
    const rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: TG.isTouch ? 2 : 4 });   // MSAA: 터치 「자동」 2x(배율 2 에선 충분), 「높게」·PC 4x (아래 R.shadowQ)
    const composer = (R.composer = new T.EffectComposer(renderer, rt));
    composer.addPass(new T.RenderPass(scene, cam));
    const bloom = (R.bloom = new T.UnrealBloomPass(new T.Vector2(w, h), 0.28, 0.4, 1.4)); // 평소 빛 번짐은 약하게 (번쩍일 때만 bloomPulse 로 세짐)
    composer.addPass(bloom);
    composer.addPass(new T.OutputPass());
    R.bloomBase = 0.28;
    R.bloomPulse = 0;

    // 화질(갤럭시탭 2026-11-13): 전엔 터치 기기 배율 상한 1.5 + 느리면 0.6 까지 내려 태블릿(dpr 2)에서 그림이 3배 넘게 늘어나 흐렸음.
    //   이제 기기 배율(상한 2)로 시작, 「자동」은 오래 느릴 때만 0.1씩 내리고 바닥 1.25(아주 느릴 때만 1.0). 「높게」는 안 내림 (js/gzview.js)
    GZView.loadQuality('tg_slice');
    R.maxPR = GZView.maxPR;
    R.dyn = GZView.makeDyn({ maxPR: R.maxPR, enabled: () => TG.Q.dr });
    R.dyn.onChange = (pr) => { if (R.pr !== pr) { R.pr = pr; R.resize(); } };
    R.pr = R.dyn.pr;
    // 그림자 지도 크기: 「높게」 또는 PC 는 2048, 터치 기기 「자동」은 768(예전 그대로)
    R.shadowQ = (m) => { const s = m === 'high' || !TG.isTouch ? 2048 : 768; if (sun.shadow.mapSize.x !== s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } };
    GZView.onQuality(R.shadowQ);
    R.msaaQ = (m) => { const n = m === 'high' || !TG.isTouch ? 4 : 2; for (const t of [R.composer.renderTarget1, R.composer.renderTarget2]) if (t.samples !== n) { t.samples = n; t.dispose(); } };
    GZView.onQuality(R.msaaQ);
    R.resize();
    // 주소창·전체화면·회전 때마다 다시 맞춤 (아이폰은 회전 직후 크기가 늦게 바뀌어 0.3·0.7초 뒤 한 번 더). 그 밖엔 매 프레임 크기 비교(R.trackFrame)
    const again = () => { R.resize(); setTimeout(R.resize, 300); setTimeout(R.resize, 700); };
    window.addEventListener('resize', R.resize);
    window.addEventListener('orientationchange', again);
    document.addEventListener('fullscreenchange', again);
    document.addEventListener('webkitfullscreenchange', again);
    try { if (window.visualViewport) window.visualViewport.addEventListener('resize', R.resize); } catch (e) { /* 무시 */ }
  };

  R.resize = function () {
    const { w, h } = TG.vp();
    R.w = w; R.h = h; R.resizes = (R.resizes || 0) + 1;
    const ds = document.documentElement.style;
    ds.setProperty('--vw', w + 'px'); ds.setProperty('--vh', h + 'px');
    R.renderer.setPixelRatio(R.pr);
    R.renderer.setSize(w, h, false);
    R.composer.setPixelRatio(R.pr);
    R.composer.setSize(w, h);
    R.camera.aspect = w / h;
    R.camera.updateProjectionMatrix();
    R.U.uRes.value.set(w * R.pr, h * R.pr);
    R.U.uThick.value = (h < 500 ? 2.7 : 3.1) * R.pr * TG.clamp(h / 720, 0.75, 1.25);
    if (TG.onResize) TG.onResize(w, h);
  };

  // 동적 해상도: 프레임이 떨어지면 낮추고, 여유 있으면 올림
  let acc = 0, frames = 0;
  R.fps = 60;
  R.trackFrame = function (dt) {
    { const v = TG.vp(); if (v.w !== R.w || v.h !== R.h) R.resize(); } // 크기 바뀜 이벤트를 놓쳐도 다음 프레임에 맞춤
    acc += dt; frames++;
    if (acc >= 1) {
      R.fps = frames / acc;
      if (R.dyn.feed(R.fps)) { R.pr = R.dyn.pr; R.resize(); }
      acc = 0; frames = 0;
    }
  };

  const tmpV = new T.Vector3();
  R.render = function (dt) {
    // 빛 방향(뷰 공간) 갱신 — 툰 하이라이트용
    tmpV.copy(R.sunOffset).normalize().transformDirection(R.camera.matrixWorldInverse);
    R.U.uLightView.value.copy(tmpV);
    if (TG.AR && TG.AR.cull) TG.AR.cull(R.camera); // 화면 밖 소품 인스턴스 빼기
    R.bloomPulse = Math.max(0, R.bloomPulse - dt * 2.2);
    R.bloom.strength = R.bloomBase + R.bloomPulse;
    R.composer.render(dt);
  };

  // 그림자 카메라를 보이는 곳 둘레로만
  R.followShadow = function (x, z) {
    R.sun.position.set(x + R.sunOffset.x, R.sunOffset.y, z + R.sunOffset.z);
    R.sun.target.position.set(x, 0, z);
  };

  // 캔버스 텍스처 도우미
  R.canvasTex = function (w, h, draw, opts) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = opts && opts.linear ? T.NoColorSpace : T.SRGBColorSpace;
    t.anisotropy = R.maxAniso || 4; // 화질(갤럭시탭): 최대
    t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; // 먼 바닥·작은 그림이 자글거리지 않게 (밉맵)
    if (opts && opts.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    return t;
  };
})();
