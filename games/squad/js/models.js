/* GRUNT ZERO RE — glb 불러오기 (없으면 조용히 건너뜀 → 도형 임시 모델로 돌아감)
   · http(s): assets/models/*.glb 를 fetch
   · file:// : js/pack_models.js (tools/pack_assets.py 가 만든 base64 묶음) 가 있으면 그것을 씀
   + 허조교 광택 보강: 그림 색으로 금색 탄띠·검은 전투화·철모·선글라스·호각을 골라 금속성·매끈함을 올림(애니메이션을 그대로 따라감) */
(function () {
  'use strict';
  const GZ = window.GZ, T = THREE;
  const MD = (GZ.MD = { hejo: null, boss: null, shield: null, brute: null, crawler: null, conductor: null, clock: null, power: null, glow: { value: 0 }, inv: { value: 0 }, time: { value: 0 } });
  // r6: 허조교 새 판(hejo_r6 — 금속/거칠기 그림 있음) + 잡몹 3종(피스톤 브루트·보일러 크롤러·뮤트 컨덕터) + 배경 랜드마크 2개
  const FILES = { hejo: 'hejo_r6', boss: 'boss_engine', shield: 'elite_shield', brute: 'enemy_brute', crawler: 'enemy_crawler', conductor: 'enemy_conductor', clock: 'bg_clocktower', power: 'bg_powerstation' };

  function parse(buf) { return new Promise((ok, bad) => new T.GLTFLoader().parse(buf, '', ok, bad)); }
  function loadPack() {
    return new Promise((ok) => {
      const s = document.createElement('script');
      s.src = 'js/pack_models.js'; s.onload = () => ok(true); s.onerror = () => ok(false);
      document.head.appendChild(s);
    });
  }
  async function get(name) {
    try {
      if (window.GZ_MODELS && window.GZ_MODELS[name]) return await parse(GZ.b64ToBuf(window.GZ_MODELS[name]));
      if (location.protocol === 'file:') return null;
      const r = await fetch('assets/models/' + name + '.glb');
      if (!r.ok) return null;
      return await parse(await r.arrayBuffer());
    } catch (e) { console.warn('모델 불러오기 실패: ' + name, e); return null; }
  }

  // 허조교 재질: 색으로 부위를 골라 광택을 줌. uH = 화면 속 키
  //   r6: pbr = true (새 판은 금속/거칠기 그림이 있음) → 색으로 금속 고르기는 끄고(이중 적용 방지) 테두리 빛·무적 번쩍·밝기 상한만 남김
  MD.glossHero = function (mat, H, pbr) {
    if (pbr) { mat.metalness = 1; mat.roughness = 1; mat.envMapIntensity = 1.5; mat.side = T.FrontSide; if (mat.metalnessMap) { mat.metalnessMap.colorSpace = T.NoColorSpace; } }   // 계수 1 = 그림 값 그대로
    else { mat.metalness = 0; mat.roughness = 0.78; mat.envMapIntensity = 1.35; mat.side = T.FrontSide; }
    // r5: 멀리서 독사복 무늬가 체크처럼 깨지던 것 — 밉맵(삼선형) + 이방성 최대
    if (mat.map) { const m = mat.map; m.generateMipmaps = true; m.minFilter = T.LinearMipmapLinearFilter; m.magFilter = T.LinearFilter; m.anisotropy = GZ.R.renderer.capabilities.getMaxAnisotropy(); m.needsUpdate = true; }
    for (const k of ['roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap']) if (mat[k]) mat[k].anisotropy = GZ.R.maxAniso || 16;   // 화질(갤럭시탭)
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uGlow = MD.glow; sh.uniforms.uInv = MD.inv; sh.uniforms.uT = MD.time;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vGzY;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGzY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGzY; uniform float uGlow; uniform float uInv; uniform float uT;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + (pbr ? 'float gzGold = 0.0;\n' : '') + (pbr ? '' :
          'vec3 gzC = diffuseColor.rgb; float gzL = dot(gzC, vec3(0.2126, 0.7152, 0.0722));\n' +
          'float gzMx = max(gzC.r, max(gzC.g, gzC.b)); float gzSat = (gzMx - min(gzC.r, min(gzC.g, gzC.b))) / max(gzMx, 0.001);\n' +
          'float gzH = vGzY / ' + H.toFixed(3) + ';\n' +
          'float gzBR = gzC.b / max(gzC.r, 0.001);\n' +
          'float gzGold = smoothstep(0.42, 0.58, gzC.r) * (1.0 - smoothstep(0.12, 0.2, gzBR)) * step(0.3, gzH) * (1.0 - step(0.82, gzH));\n' +
          'gzGold = max(gzGold, smoothstep(0.2, 0.34, gzC.r) * (1.0 - smoothstep(0.16, 0.28, gzBR)) * smoothstep(0.5, 0.53, gzH) * (1.0 - smoothstep(0.615, 0.645, gzH)));\n' +   // r3: 허리 높이에서는 넓게 잡아 띠 전체가 한 덩어리 금속으로   // 황금 탄띠
          'float gzBoot = (1.0 - smoothstep(0.02, 0.05, gzL)) * (1.0 - smoothstep(0.24, 0.3, gzH));\n' +                                    // 유광 전투화
          'float gzHelm = (1.0 - smoothstep(0.05, 0.12, gzL)) * smoothstep(0.8, 0.84, gzH);\n' +                                             // 철모·선글라스
          'float gzChr = (1.0 - smoothstep(0.12, 0.25, gzSat)) * smoothstep(0.18, 0.3, gzL) * smoothstep(0.55, 0.6, gzH) * (1.0 - smoothstep(0.8, 0.84, gzH));\n' + // 크롬 호각
          'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.72, 0.2), gzGold * 0.92);\n' +
          'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.97), gzChr * 0.8);\n' +
          'metalnessFactor = max(metalnessFactor, max(gzGold, max(gzChr, max(gzBoot * 0.55, gzHelm * 0.6))));\n' +
          'roughnessFactor = mix(roughnessFactor, 0.11, gzGold); roughnessFactor = mix(roughnessFactor, 0.08, gzChr);\n' +
          'roughnessFactor = mix(roughnessFactor, 0.1, gzBoot); roughnessFactor = mix(roughnessFactor, 0.16, gzHelm);\n'))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' +
          // r3 탄띠 유광 금: 반사 방향으로 「밝은 하늘 / 어두운 바닥」을 비추고(금속의 강한 대비), 날카로운 하이라이트 + 띠를 훑고 지나가는 반짝임
          'vec3 gzN = normalize(normal); vec3 gzV = normalize(vViewPosition); vec3 gzR = reflect(-gzV, gzN);\n' +
          'float gzUp = dot(gzR, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));\n' +
          'vec3 gzEnv = mix(vec3(0.13, 0.045, 0.006), vec3(1.0, 0.66, 0.2), smoothstep(-0.3, 0.5, gzUp));\n' +
          'float gzS = max(dot(gzR, normalize(vec3(0.3, 0.8, 0.5))), 0.0); gzS *= gzS; gzS *= gzS; gzS *= gzS; gzS *= gzS;\n' +
          'float gzBand = 1.0 - smoothstep(0.0, 0.14, abs(gzN.x - (fract(uT * 0.36) * 3.6 - 1.8)));\n' +
          'totalEmissiveRadiance += gzGold * (gzEnv * 0.36 + vec3(1.0, 0.9, 0.6) * (gzS * 1.5 + gzBand * 0.7) + vec3(1.0, 0.56, 0.1) * uGlow * 0.5);\n' +   // r2: 평소 은은한 금빛, 궁극기 때도 하얗게 날아가지 않게 상한
          'float gzF = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition))); gzF = gzF * gzF;\n' +
          'float gzNu = dot(gzN, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));\n' +
          'totalEmissiveRadiance += vec3(0.2, 0.3, 0.5) * gzF * 0.3;\n' +                       // 푸른 테두리 빛 (바닥에서 떠 보이게)
          'totalEmissiveRadiance += vec3(1.0, 0.7, 0.32) * gzF * (0.2 + 0.8 * smoothstep(-0.1, 0.7, gzNu)) * 0.42;\n' +   // r4: 위·뒤에서 떨어지는 금빛 림 — 뒷모습이 어두운 바닥과 갈라지게
          'totalEmissiveRadiance += vec3(0.85, 0.92, 1.0) * (gzF * 1.1 + 0.03) * uInv;')
        // r5: 주인공 밝기 상한 — 0.72 위는 부드럽게 눌러 0.95 를 넘지 않음 (블룸 문턱 1.0 아래 → 정박·폭발 번쩍임에 하얗게 날아가지 않음). 궁극기 때만 조금 풀어 줌
        .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n' +
          'vec3 gzO = gl_FragColor.rgb; float gzCap = 0.95 + uGlow * 0.35; vec3 gzOver = max(gzO - 0.72, 0.0); gl_FragColor.rgb = min(gzO, 0.72 + (gzCap - 0.72) * (1.0 - exp(-gzOver / (gzCap - 0.72))));');
    };
    mat.customProgramCacheKey = () => 'gzHero9' + (pbr ? 'p' : '') + H.toFixed(3);
    mat.needsUpdate = true;
  };

  // 통짜 적 모델: 높이 h 로 맞춘 원본(복제해서 씀) + 금속 느낌 재질
  //   r6 o: { pbr: 금속/거칠기 그림을 그대로 씀, ground: 발바닥을 y=0 에, metal/rough: 그림 없는 재질 값, cast: 그림자 드리우기 }
  function prepStatic(gltf, h, o) {
    o = o || {};
    const sc = gltf.scene; sc.updateMatrixWorld(true);
    const bb = new T.Box3().setFromObject(sc), size = bb.getSize(new T.Vector3());
    let mat = null;
    sc.traverse((m) => { if (m.isMesh) {
      m.castShadow = o.cast !== false; m.receiveShadow = !!o.recv; mat = m.material;
      if (mat.map) { mat.map.minFilter = T.LinearMipmapLinearFilter; }
      for (const k of ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'emissiveMap']) if (mat[k]) mat[k].anisotropy = GZ.R.maxAniso || 16;   // 화질(갤럭시탭): 4·1 → 기기 최대
      if (o.pbr && mat.metalnessMap) { mat.metalness = 1; mat.roughness = 1; mat.envMapIntensity = o.env || 1.3; }
      else { mat.metalness = o.metal != null ? o.metal : 0.72; mat.roughness = o.rough != null ? o.rough : 0.44; mat.envMapIntensity = o.env || 1.1; }
    } });
    return { scene: sc, scale: h / size.y, mat, size, minY: o.ground ? bb.min.y : 0, h };
  }
  MD.prepStatic = prepStatic;
  // 복제본 + 자기 재질(맞으면 번쩍이게)
  MD.cloneStatic = function (src) {
    const g = new T.Group(), c = src.scene.clone(true), mat = src.mat.clone();
    c.traverse((m) => { if (m.isMesh) m.material = mat; });
    c.position.y = -src.minY;   // r6: 발바닥 y=0
    g.add(c); g.scale.setScalar(src.scale);
    return { grp: g, mat };
  };

  MD.load = async function (onProgress) {
    if (GZ.Q.noglb) return;
    if (location.protocol === 'file:' && !window.GZ_MODELS) await loadPack();
    onProgress && onProgress(0.2);
    // r6: 8개를 한꺼번에 받음 (차례로 받으면 로딩이 길어짐)
    const keys = Object.keys(FILES); let done = 0;
    const got = await Promise.all(keys.map((k) => get(FILES[k]).then((r) => { done++; onProgress && onProgress(0.2 + 0.8 * done / keys.length); return r; })));
    const R = {}; keys.forEach((k, i) => { R[k] = got[i]; });
    if (R.hejo) MD.hejo = R.hejo;
    if (R.boss) MD.boss = prepStatic(R.boss, 5.6);
    if (R.shield) MD.shield = prepStatic(R.shield, 1.95);
    // 잡몹 (설명.md 권장 높이: 브루트 2.6~2.8 · 크롤러 2.0~2.2 · 컨덕터 3.2~3.6)
    if (R.brute) MD.brute = prepStatic(R.brute, 2.7, { pbr: true, ground: true, env: 1.4 });
    if (R.crawler) MD.crawler = prepStatic(R.crawler, 2.1, { pbr: true, ground: true, env: 1.4 });
    if (R.conductor) MD.conductor = prepStatic(R.conductor, 3.4, { ground: true, metal: 0.35, rough: 0.5, env: 1.5 });   // 색 그림만 있는 판 — 광택은 여기서
    // 배경 랜드마크: 그림자 받기만 (드리우기 끔 — 폰 부담)
    if (R.clock) MD.clock = prepStatic(R.clock, 17, { pbr: true, ground: true, cast: false, recv: true, aniso: 2, env: 1.0 });
    if (R.power) MD.power = prepStatic(R.power, 10.5, { pbr: true, ground: true, cast: false, recv: true, aniso: 2, env: 1.0 });
  };
})();
