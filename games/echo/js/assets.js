/* 톱니골 던전 — GLB 풀기 (TG_MODELS base64 → GLTFLoader.parse). 네트워크 요청 0
   11-16 MOSHEE: 주인공 GLB(베리·허조교·MOSHEE)는 js/pack_hero_<이름>.js 로 따로 묶여 있음(tools/pack_assets.py HERO_SPLIT) — 첫 로딩은 SEFO + 소품만(pack_models.js),
   고른 주인공·보조 것만 <script> 태그로 받아 TG_MODELS 에 넣음(M.ensure). file:// 로 열어도 됨(fetch 아님) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const M = (TG.M = {});
  const HERO_PACK = { berri: 1, gunner: 1, moshee: 1, sseni: 1 }; // 따로 묶인 주인공 모델 (pack_assets.py HERO_SPLIT 과 같게). 11-16 쎄니 추가
  const loading = {}, parsed = {};

  function parse(name) {
    return new Promise((ok, bad) => {
      const b64 = window.TG_MODELS && window.TG_MODELS[name];
      if (!b64) { bad(new Error('모델 없음: ' + name)); return; }
      new T.GLTFLoader().parse(TG.b64ToBuf(b64), '', ok, bad);
    });
  }

  // 주인공 묶음 받기(한 번만): 끝나면 TG_MODELS[name] 이 있음. 이미 있으면 바로
  M.ensure = function (name) {
    if (window.TG_MODELS && window.TG_MODELS[name]) return Promise.resolve();
    if (!HERO_PACK[name]) return Promise.reject(new Error('모델 없음: ' + name));
    if (loading[name]) return loading[name];
    loading[name] = new Promise((ok, bad) => {
      const s = document.createElement('script'); s.src = 'js/pack_hero_' + name + '.js'; s.async = true;
      s.onload = () => { if (window.TG_MODELS && window.TG_MODELS[name]) ok(); else { delete loading[name]; s.remove(); bad(new Error('묶음에 모델 없음: ' + name)); } }; // 실패하면 다시 누를 때 재시도
      s.onerror = () => { delete loading[name]; s.remove(); bad(new Error('묶음 못 받음: ' + name)); };
      document.head.appendChild(s);
    });
    return loading[name];
  };
  // 주인공 모델 풀기(한 번만) → M.gltf[name]. 보조용 두 번째 사본은 M.ensure(name).then(() => M.parse(name)) 로 따로
  M.hero = function (name) {
    if (M.gltf && M.gltf[name]) return Promise.resolve(M.gltf[name]);
    if (parsed[name]) return parsed[name];
    parsed[name] = M.ensure(name).then(() => parse(name)).then((g) => { M.gltf = M.gltf || {}; M.gltf[name] = g; return g; }).catch((e) => { delete parsed[name]; throw e; });
    return parsed[name];
  };
  M.has = (name) => !!(M.gltf && M.gltf[name]);

  // 정적 소품: 메시 하나 → (회전, 바닥 0, 높이 맞춤) 구운 기하 + 툰 재질
  function prop(gltf, o) {
    let mesh = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((m) => { if (m.isMesh && !mesh) mesh = m; });
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (o.rotY) geo.rotateY(o.rotY);
    geo.computeBoundingBox();
    const bb = geo.boundingBox, size = bb.getSize(new T.Vector3()), c = bb.getCenter(new T.Vector3());
    geo.translate(-c.x, -bb.min.y, -c.z);
    const s = o.height / size.y;
    geo.scale(s, s, s);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    TG.R.addOutlineNormals(geo);
    const src = mesh.material;
    const map = src.map || null;
    if (map) { map.anisotropy = TG.R.maxAniso || 4; map.colorSpace = T.SRGBColorSpace; }
    const mat = TG.R.toon(Object.assign({ map }, o.mat || {}));
    return { geo, mat, size: size.multiplyScalar(s) };
  }

  M.parse = parse;
  M.load = function (onProgress) {
    const names = ['sefo', 'tick', 'tower', 'speaker', 'crate', 'shop', 'house', 'lamp'].filter((n) => window.TG_MODELS && window.TG_MODELS[n]);
    // 지금 고른 주인공·보조의 모델(SEFO 아닌 것)은 처음에 같이 받아 둠 (?hero=·저장값). 못 받으면 SEFO 모습으로 대신(console.warn)
    const heroes = [TG.hero && TG.hero.model, TG.assist && TG.assist.model].filter((n, i, a) => n && n !== 'sefo' && HERO_PACK[n] && a.indexOf(n) === i);
    const total = names.length + heroes.length;
    let done = 0;
    const rest = () => new Promise((r) => { let d = false; const f = () => { if (!d) { d = true; r(); } }; requestAnimationFrame(f); setTimeout(f, 80); });
    const list0 = [];
    let chain = Promise.all(heroes.map((h) => M.ensure(h).catch((e) => console.warn(e.message)))).then(() => undefined);
    names.forEach((n) => { chain = chain.then(rest).then(() => parse(n)).then((g) => { done++; onProgress && onProgress(done / total); list0.push([n, g]); }); });
    heroes.forEach((n) => { chain = chain.then(rest).then(() => M.hero(n).catch((e) => console.warn(e.message))).then(() => { done++; onProgress && onProgress(done / total); }); });
    return chain.then(rest).then(() => list0)
      .then((list) => {
        const G = Object.fromEntries(list);
        const F = -Math.PI / 2; // Tripo 모델은 앞면이 +x → 카메라 쪽(+z)으로 돌림
        M.sefoGltf = G.sefo;
        M.gltf = Object.assign({ sefo: G.sefo }, M.gltf || {}); // 주인공 모델(11-16 베리·허조교·MOSHEE 는 M.hero 로 받은 것). 보조용 두 번째 사본은 M.parse 로 따로 풂
        M.tick = prop(G.tick, { rotY: F, height: 2.0, mat: { teal: true, gain: 1.25, gamma: 0.9, sat: 1.15, rim: 0.5, spec: 0.55, inst: true } });
        // 배경 소품은 캐릭터·이펙트보다 한 단계 낮은 채도·밝기 (SEFO·안개가 먼저 읽히게). 장애물은 SEFO 허리 높이 아래로 낮게
        M.tower = prop(G.tower, { rotY: F, height: 8.6, mat: { gain: 1.08, gamma: 0.95, sat: 0.96, rim: 0.34, spec: 0.22 } });
        M.speaker = prop(G.speaker, { rotY: F, height: 1.9, mat: { gain: 1.06, gamma: 0.94, sat: 0.86, rim: 0.36, spec: 0.3 } });
        M.crate = prop(G.crate, { rotY: 0, height: 1.5, mat: { gain: 0.98, gamma: 0.98, sat: 0.82, rim: 0.32, spec: 0.18 } });
        if (G.shop) M.shop = prop(G.shop, { rotY: F, height: 7.5, mat: { gain: 1.0, gamma: 0.96, sat: 0.84, rim: 0.3, spec: 0.12 } });
        if (G.house) M.house = prop(G.house, { rotY: F, height: 8.2, mat: { gain: 1.0, gamma: 0.96, sat: 0.84, rim: 0.3, spec: 0.12 } });
        if (G.lamp) M.lamp = prop(G.lamp, { rotY: F, height: 4.6, mat: { gain: 1.05, gamma: 0.95, sat: 0.88, rim: 0.36, spec: 0.3 } });
      });
  };
})();
