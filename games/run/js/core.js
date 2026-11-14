// SEFO KIDS : ENERGY RUN — 공용: 도구 함수, 색 입힌 도형 합치기, 굽은 길 셰이더, 저장
(function () {
  const EK = window.EK = {};
  const Q = new URLSearchParams(location.search);
  EK.Q = { get: k => Q.get(k), has: k => Q.has(k), num: (k, d) => Q.has(k) ? +Q.get(k) : d };

  EK.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  EK.lerp = (a, b, k) => a + (b - a) * k;
  EK.smooth = k => k * k * (3 - 2 * k);
  EK.rng = function (seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  EK.$ = id => document.getElementById(id);

  // ---- 저장 (이 기기에만) ----
  const KEY = 'sefokids_energy_run_v1';
  const DEF = { volMusic: 80, volSfx: 70, diff: 'easy', stage: 'town', stars: 0, best: {}, bestStars: {}, plays: 0, clears: 0, orbs: 0, dist: 0, missions: 0, tutorial: false };
  EK.save = Object.assign({}, DEF);
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') Object.assign(EK.save, s); } catch (e) {}
  EK.store = function () { try { localStorage.setItem(KEY, JSON.stringify(EK.save)); } catch (e) {} };

  // ---- 굽은 길: 멀리 갈수록 아래로 살짝 휘어 보이게 (보는 쪽 기준) ----
  EK.bendU = { value: new THREE.Vector2(0.0016, 0) };
  function obc(shader) {
    shader.uniforms.uBend = EK.bendU;
    shader.vertexShader = 'uniform vec2 uBend;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n float bz = mvPosition.z; mvPosition.y -= uBend.x * bz * bz; mvPosition.x += uBend.y * bz * bz; gl_Position = projectionMatrix * mvPosition;');
  }
  EK.patch = function (m) { m.onBeforeCompile = obc; return m; };

  // ---- 재질 (정점 색 하나로 거의 다 그림 → 그리기 횟수 줄임) ----
  const std = o => EK.patch(new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.62, metalness: 0 }, o)));
  EK.MAT = {
    vc: std({}),
    gloss: std({ roughness: 0.22 }),
    glow: std({ roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.35 }),
    shadow: EK.patch(new THREE.MeshBasicMaterial({ color: 0x1c1440, transparent: true, opacity: 0.2, depthWrite: false })),
  };
  EK.MAT.glow.emissiveMap = null;

  // ---- 기본 도형 ----
  const G = {
    sph: new THREE.SphereGeometry(1, 18, 12), sphLo: new THREE.SphereGeometry(1, 10, 7), box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14), cone: new THREE.ConeGeometry(1, 1, 14), cap: new THREE.CapsuleGeometry(0.5, 1, 5, 12),
    tor: new THREE.TorusGeometry(1, 0.22, 8, 20), torHalf: new THREE.TorusGeometry(1, 0.16, 8, 16, Math.PI), disc: new THREE.CircleGeometry(1, 20),
    pyr: new THREE.ConeGeometry(1, 1, 4), ico: THREE.BufferGeometryUtils.mergeVertices(new THREE.IcosahedronGeometry(1, 1)),
  };
  EK.G = G; for (const k in G) G[k].userData.keep = true;
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  // 부품 하나: [도형 이름, 색, [x,y,z], [sx,sy,sz] 또는 숫자, [rx,ry,rz]]
  EK.part = function (g, color, pos, scl, rot) {
    const geo = G[g].clone();
    if (typeof scl === 'number') _s.set(scl, scl, scl); else if (scl) _s.set(scl[0], scl[1], scl[2]); else _s.set(1, 1, 1);
    _p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0);
    if (rot) _e.set(rot[0], rot[1], rot[2]); else _e.set(0, 0, 0);
    geo.applyMatrix4(_m.compose(_p, _q.setFromEuler(_e), _s));
    _c.set(color);
    const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  };
  EK.merge = function (parts) {
    const geos = parts.map(p => Array.isArray(p) ? EK.part(p[0], p[1], p[2], p[3], p[4]) : p);
    const g = THREE.BufferGeometryUtils.mergeGeometries(geos, false);
    geos.forEach(x => x.dispose());
    g.computeBoundingSphere();
    return g;
  };
  EK.mesh = function (parts, mat) { return new THREE.Mesh(EK.merge(parts), mat || EK.MAT.vc); };

  // 동그란 바닥 그림자
  const shGeo = new THREE.CircleGeometry(1, 16); shGeo.rotateX(-Math.PI / 2); shGeo.userData.keep = true;
  EK.blob = function (r, rz) { const m = new THREE.Mesh(shGeo, EK.MAT.shadow); m.scale.set(r, 1, rz || r); m.position.y = 0.03; m.renderOrder = 1; return m; };
})();
