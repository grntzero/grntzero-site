/* 톱니골 던전 — 안개(방울·뭉치·메아리)·안개 고치(주민)·째깍이·보스 「큰 침묵 안개」·음표 방울·접지 그림자
   F.update = 규칙 계산(1/60초 고정, 난수는 TG.sr 만) / F.draw = 그리기(걸음 사이 보간) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const F = (TG.F = { list: [], notes: [], friends: [], popped: 0, boss: null });
  const CAP = { bubble: 170, clump: 32, tick: 24, echo: 40, cocoon: 3, note: 200, shadow: 360 };
  const SQ_N = 40; // 「고리 조이기」 구슬 수
  let uid = 1;

  // 얼굴 셰이더 조각 (오브젝트 공간, 앞 = +z): 크고 또렷한 흰 눈 + 검은 동공(SEFO 쪽을 봄) + 반짝 + 눈 테두리 + 볼 + 입, 가끔 깜빡
  // o: {cx,cy,cz(몸 가운데), sep(눈 사이), ey(눈 높이), size(눈 크기), lid(졸린 눈꺼풀 0~1), brow(삐친 눈썹), mouth: 'o'|'flat'|'pout'}
  const f3 = (v) => (+v).toFixed(3);
  function faceChunk(o) {
    const S = +o.size, SEP = +o.sep, EY = +o.ey, PS = S * 0.56, RW = S * 0.2;
    const L = [
      '{ vec3 ep = normalize(vObj - vec3(' + o.cx + ',' + o.cy + ',' + o.cz + '));',
      '  float front = smoothstep(0.02, 0.2, ep.z); float sx = ep.x < 0.0 ? -1.0 : 1.0;',
      '  vec2 q = vec2(abs(ep.x) - ' + f3(SEP) + ', (ep.y - ' + f3(EY) + ') / 1.16);',
      '  float d = length(q);',
      '  float blink = step(0.962, fract(uTime * 0.23 + vLook.z));',
      '  float white = (1.0 - smoothstep(' + f3(S - 0.014) + ', ' + f3(S) + ', d)) * front;',
      '  float rim = (1.0 - smoothstep(' + f3(S + RW - 0.014) + ', ' + f3(S + RW) + ', d)) * front;',
      '  vec2 lk = clamp(vLook.xy, -1.0, 1.0) * ' + f3(S * 0.34) + ';',
      '  vec2 pq = vec2(ep.x - sx * ' + f3(SEP) + ' - lk.x, ep.y - ' + f3(EY) + ' - lk.y);',
      '  float pup = (1.0 - smoothstep(' + f3(PS - 0.014) + ', ' + f3(PS) + ', length(pq))) * white;',
      '  float hl = (1.0 - smoothstep(' + f3(PS * 0.36 - 0.01) + ', ' + f3(PS * 0.36) + ', length(pq - vec2(' + f3(-PS * 0.36) + ', ' + f3(PS * 0.4) + ')))) * white;',
      '  hl = max(hl, (1.0 - smoothstep(' + f3(PS * 0.17 - 0.008) + ', ' + f3(PS * 0.17) + ', length(pq - vec2(' + f3(PS * 0.34) + ', ' + f3(-PS * 0.36) + ')))) * white);',
      '  float shut = (1.0 - smoothstep(0.012, 0.03, abs(q.y + q.x * q.x * 2.2 - 0.02))) * step(abs(q.x), ' + f3(S) + ') * front;',
    ];
    // 표정 벌: faces[i] = {lid, brow: true|'worry', mouth: 'o'|'flat'|'pout'|'wavy', sweat}. sel(셰이더 식)이 i 일 때 그 벌이 보임 (꾸밈용 — 규칙과 무관)
    const faces = o.faces || [{ lid: o.lid, brow: o.brow, mouth: o.mouth }];
    const W = faces.map((_, i) => (faces.length === 1 ? '1.0' : '(1.0 - step(0.5, abs(fsel - ' + i + '.0)))'));
    const sum = (fn) => faces.map((f, i) => { const v = fn(f); return v ? W[i] + ' * ' + f3(v) : null; }).filter(Boolean).join(' + ') || '0.0';
    const any = (fn) => faces.some(fn);
    L.push('  float fsel = ' + (o.sel || '0.0') + ';');
    if (any((f) => f.lid)) { // 졸린 눈꺼풀: 눈 위쪽을 몸 색으로 덮고 선 하나
      L.push('  float lidv = ' + sum((f) => f.lid) + '; float lidon = step(0.01, lidv);',
        '  float cut = ' + f3(S * 1.16) + ' * (1.0 - 2.0 * lidv); float lidk = step(cut, q.y * 1.16) * lidon;',
        '  float lidline = (1.0 - smoothstep(0.012, 0.028, abs(q.y * 1.16 - cut))) * step(abs(q.x), ' + f3(S * 0.98) + ') * front * lidon;',
        '  white *= 1.0 - lidk; pup *= 1.0 - lidk; hl *= 1.0 - lidk; rim = max(rim * (1.0 - lidk), lidline);');
    }
    L.push('  float dark = max(rim * (1.0 - white), pup);',
      '  white *= 1.0 - blink; hl *= 1.0 - blink; dark = mix(dark, shut, blink);');
    if (any((f) => f.brow)) L.push('  { float bon = ' + sum((f) => (f.brow ? 1 : 0)) + '; float bsl = ' + sum((f) => (f.brow === 'worry' ? -0.5 : f.brow ? 0.55 : 0)) + ';',
      '    float by = ' + f3(EY + S * 1.75) + ' + (abs(ep.x) - ' + f3(SEP) + ') * bsl;',
      '    float br = (1.0 - smoothstep(0.022, 0.04, abs(ep.y - by))) * (1.0 - smoothstep(' + f3(S * 0.85) + ', ' + f3(S * 0.95) + ', abs(abs(ep.x) - ' + f3(SEP) + '))) * front; dark = max(dark, br * bon); }');
    const MYa = f3(EY - S * 1.45), MYp = f3(EY - S * 1.55);
    const MOUTH = {
      o: '(1.0 - smoothstep(0.03, 0.045, length(vec2(ep.x, (ep.y - ' + MYa + ') * 1.25))))',
      flat: '(1.0 - smoothstep(0.014, 0.03, abs(ep.y - ' + MYa + '))) * (1.0 - smoothstep(0.06, 0.075, abs(ep.x)))',
      pout: '(1.0 - smoothstep(0.016, 0.032, abs(ep.y - ' + MYp + ' + ep.x * ep.x * 4.0))) * (1.0 - smoothstep(0.085, 0.1, abs(ep.x)))',
      wavy: '(1.0 - smoothstep(0.014, 0.03, abs(ep.y - ' + MYa + ' - sin(ep.x * 50.0) * 0.02))) * (1.0 - smoothstep(0.1, 0.115, abs(ep.x)))',
    };
    Object.keys(MOUTH).forEach((k) => { if (any((f) => f.mouth === k)) L.push('  dark = max(dark, ' + MOUTH[k] + ' * front * (' + sum((f) => (f.mouth === k ? 1 : 0)) + '));'); });
    if (any((f) => f.sweat)) L.push('  { vec2 sq = vec2(ep.x - ' + f3(SEP * 2.15) + ', (ep.y - ' + f3(EY + S * 2.0) + ') * 0.72); float sl = length(sq) - max(0.0, sq.y) * 0.45; float son = (' + sum((f) => (f.sweat ? 1 : 0)) + ') * front;', // 당황 땀방울 (하늘색 물방울)
      '    float sd = (1.0 - smoothstep(0.04, 0.052, sl)) * son; float sr = (1.0 - smoothstep(0.062, 0.074, sl)) * son;',
      '    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.88, 1.0), sd); dark = max(dark, sr * (1.0 - sd)); }');
    L.push('  vec2 bq = vec2(abs(ep.x) - ' + f3(SEP * 1.85) + ', (ep.y - ' + f3(EY - S * 1.05) + ') * 1.5);',
      '  float blush = (1.0 - smoothstep(' + f3(S * 0.45) + ', ' + f3(S * 0.8) + ', length(bq))) * front;',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.5, 0.62), blush * 0.6);',
      '  vEyeW = white; vEyeK = dark; vEyeHL = hl * (1.0 - dark * 0.0); }');
    return L.join('\n');
  }
  // 안개 몸 재질: 불투명한 보라빛 회색(#9C98B8, 그늘 #6E6A8E) — 비눗방울처럼 비치지 않게
  // 색조 3단(같은 보라빛 회색 안에서 기본·푸른 기·분홍 기) — 떼가 한 덩어리로 안 보이게
  const TINT = 'diffuseColor.rgb *= vVar.x < 0.5 ? vec3(1.0) : (vVar.x < 1.5 ? vec3(0.86, 0.95, 1.13) : vec3(1.12, 0.92, 1.0));\n';
  function fogMat(o) {
    const m = TG.R.toon({
      color: o.color, rim: o.rim != null ? o.rim : 0.3, spec: o.spec != null ? o.spec : 0, inst: o.inst, key: o.key, flashCol: o.flashCol || 'vec3(0.9, 0.84, 1.12)', gain: o.gain, sat: o.sat,
      vHead: 'varying vec3 vObj; varying vec4 vLook; varying vec2 vVar;' + (o.inst ? ' attribute vec4 aLook; attribute vec2 aVar;' : ''), vMain: 'vObj = position; vLook = ' + (o.inst ? 'aLook' : 'vec4(0.0)') + '; vVar = ' + (o.inst ? 'aVar' : 'vec2(0.0)') + ';',
      fHead: 'varying vec3 vObj; varying vec4 vLook; varying vec2 vVar;' + (o.fUni || ''),
      fColor: 'float vEyeHL = 0.0; float vEyeK = 0.0; float vEyeW = 0.0;\n' +
        'diffuseColor.rgb *= mix(0.86, 1.06, smoothstep(' + o.gy0 + ', ' + o.gy1 + ', vObj.y));\n' + (o.inst ? TINT : '') +
        (o.ripple ? '{ float rp = sin(length(vObj.xy - vec2(' + o.cx + ',' + o.cy + ')) * 17.0 - uTime * 6.5); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.93, 1.0), smoothstep(0.6, 0.95, rp) * 0.42 * vLook.w); }\n' : '') +
        faceChunk(o),
      fFinal: (o.ripple ? ' outgoingLight += vec3(0.08, 0.32, 0.95) * pow(fr, 2.0) * 0.55 * vLook.w;\n' : '') +
        ' outgoingLight = mix(outgoingLight, vec3(1.12, 1.12, 1.16), vEyeW);\n outgoingLight = mix(outgoingLight, vec3(0.05, 0.04, 0.09), vEyeK);\n outgoingLight = mix(outgoingLight, vec3(1.9), vEyeHL);\n',
    });
    if (o.uni) { const base = m.onBeforeCompile; m.onBeforeCompile = function (sh) { base(sh); Object.assign(sh.uniforms, o.uni); }; }
    return m;
  }
  // 꾸밈용 난수: 개체 id 해시 (규칙용 TG.sr 과 무관 → 재생 결과에 영향 없음)
  const hsh = (id, k) => { let x = Math.imul((id + k * 7919) | 0, 0x9e3779b1); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };

  function instAttr(geo, cap) {
    const a = new T.InstancedBufferAttribute(new Float32Array(cap), 1);
    a.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('aFlash', a);
    return a;
  }
  function lookAttr(geo, cap) { // 인스턴스마다: 동공 방향 x,y · 깜빡임 엇박 · 덧값(메아리 보호막)
    const a = new T.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    a.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('aLook', a);
    return a;
  }
  function varAttr(geo, cap) { // 인스턴스마다 꾸밈 값: 색조 0~2 · 표정 0~2
    const a = new T.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    a.setUsage(T.DynamicDrawUsage);
    geo.setAttribute('aVar', a);
    return a;
  }
  const blob = (parts) => T.BufferGeometryUtils.mergeGeometries(parts.map(([x, y, z, r, big, sy]) => { const g = new T.SphereGeometry(r, big ? big : 7, big ? Math.round(big * 0.72) : 5); if (sy) g.scale(1, sy, 1); g.translate(x, y, z); return g; }));

  F.init = function (scene) {
    const R = TG.R, M = TG.M;
    // 안개 방울: 통통한 몸 하나 + 작은 솜 뭉치 몇 개 (구름 실루엣), 얼굴은 셰이더
    const bg = blob([[0, 0.02, 0, 0.66, 12, 0.93], [0.5, -0.2, -0.06, 0.34], [-0.5, -0.2, -0.06, 0.34], [0.14, 0.5, -0.12, 0.31], [-0.22, 0.44, -0.14, 0.27], [0, -0.06, -0.6, 0.3]]);
    const bmat = fogMat({ color: 0x9c98b8, inst: true, key: 'bubble', gy0: -0.55, gy1: 0.55, cx: '0.0', cy: '0.02', cz: '0.0', sep: 0.29, ey: 0.15, size: 0.2, sel: 'vVar.y', faces: [{ mouth: 'o' }, { lid: 0.3, mouth: 'flat' }, { brow: true, mouth: 'pout' }] }); // 표정: 동그란 입(놀람)·졸림·심술
    F.bubbleMesh = new T.InstancedMesh(bg, bmat, CAP.bubble);
    F.bubbleFlash = instAttr(bg, CAP.bubble); F.bubbleLook = lookAttr(bg, CAP.bubble); F.bubbleVar = varAttr(bg, CAP.bubble);
    // 메아리 안개 (3층): 매끈한 물방울 몸 + 머리 위 작은 방울 둘, 파란 기운 + 표면에 번지는 리플
    const eg = blob([[0, 0.02, 0, 0.68, 14, 0.96], [0.42, -0.34, -0.05, 0.3], [-0.42, -0.34, -0.05, 0.3], [0, 0.72, -0.05, 0.2], [0.05, 1.0, -0.05, 0.11]]);
    const emat = fogMat({ color: 0x6f94e4, inst: true, key: 'echo', rim: 0.5, spec: 0.35, ripple: true, gy0: -0.55, gy1: 0.55, cx: '0.0', cy: '0.02', cz: '0.0', sep: 0.29, ey: 0.15, size: 0.2, mouth: 'o' });
    F.echoMesh = new T.InstancedMesh(eg, emat, CAP.echo);
    F.echoFlash = instAttr(eg, CAP.echo); F.echoLook = lookAttr(eg, CAP.echo); F.echoVar = varAttr(eg, CAP.echo);
    // 안개 뭉치: 큰 몸 + 솜 뭉치 여럿 (솜사탕), 졸린 눈
    const cg = blob([[0, 0.82, 0.06, 0.86, 14, 0.95], [0.78, 0.6, -0.1, 0.56], [-0.78, 0.6, -0.1, 0.56], [0.42, 1.42, -0.18, 0.5], [-0.4, 1.38, -0.15, 0.52], [0, 1.6, -0.3, 0.42], [0, 0.45, -0.62, 0.6]]);
    const cmat = fogMat({ color: 0x8c88ac, inst: true, key: 'clump', gy0: '0.0', gy1: '1.6', cx: '0.0', cy: '0.82', cz: '0.06', sep: 0.3, ey: 0.14, size: 0.2, sel: 'vVar.y', faces: [{ lid: 0.3, mouth: 'flat' }, { lid: 0.42, mouth: 'o' }, { brow: true, mouth: 'flat' }] }); // 표정: 졸림·하품·심술
    F.clumpMesh = new T.InstancedMesh(cg, cmat, CAP.clump);
    F.clumpFlash = instAttr(cg, CAP.clump); F.clumpLook = lookAttr(cg, CAP.clump); F.clumpVar = varAttr(cg, CAP.clump);
    // 째깍이 (GLB)
    const tg = M.tick.geo.clone(); TG.R.addOutlineNormals(tg);
    F.tickMesh = new T.InstancedMesh(tg, M.tick.mat, CAP.tick);
    F.tickFlash = instAttr(tg, CAP.tick);
    F.tickMesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(CAP.tick * 3).fill(1), 3);
    // 째깍이 등 뒤 황동 태엽(나비 손잡이, 빙글빙글 감김) — 안개와 한눈에 구분되는 고유 부품. 째깍이가 없으면 그려지지 않음(인스턴스 0)
    tg.computeBoundingBox();
    const tb = tg.boundingBox;
    F.tickKeyAt = [tb.max.y * 0.74, tb.min.z * 0.6];
    const kg = T.BufferGeometryUtils.mergeGeometries([
      (() => { const g = new T.CylinderGeometry(0.075, 0.075, 0.62, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.31); return g; })(),
      (() => { const g = new T.TorusGeometry(0.23, 0.085, 5, 10); g.rotateY(Math.PI / 2); g.translate(0, 0.27, -0.72); return g; })(),
      (() => { const g = new T.TorusGeometry(0.23, 0.085, 5, 10); g.rotateY(Math.PI / 2); g.translate(0, -0.27, -0.72); return g; })(),
    ]);
    F.tickKey = new T.InstancedMesh(kg, R.toon({ color: 0xe0ae2c, sat: 1.15, rim: 0.6, spec: 0.6, key: 'tickkey' }), CAP.tick);
    F.tickKey.count = 0; F.tickKey.frustumCulled = false; F.tickKey.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(F.tickKey); R.addOutline(F.tickKey, 1);
    [F.bubbleMesh, F.clumpMesh, F.tickMesh, F.echoMesh].forEach((m) => {
      m.count = 0; m.frustumCulled = false; m.castShadow = m === F.tickMesh; m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(m); R.addOutline(m, m === F.tickMesh ? 1 : 1.35); // 안개는 굵은 외곽선
    });
    // 음표 방울 (줍기)
    const ng = T.BufferGeometryUtils.mergeGeometries([
      (() => { const g = new T.SphereGeometry(0.2, 8, 5); g.scale(1.25, 0.9, 0.9); g.rotateZ(0.4); g.translate(-0.12, 0, 0); return g; })(),
      (() => { const g = new T.CylinderGeometry(0.045, 0.045, 0.62, 5); g.translate(0.08, 0.3, 0); return g; })(),
      (() => { const g = new T.BoxGeometry(0.26, 0.1, 0.08); g.rotateZ(-0.5); g.translate(0.18, 0.52, 0); return g; })(),
    ].map((g) => g.toNonIndexed()));
    ng.translate(0, -0.2, 0);
    const nmat = R.toon({ color: 0xffb21a, sat: 1.3, emissive: 0xffa21a, ei: 0.3, rim: 0.8, spec: 0.8 });
    F.noteMesh = new T.InstancedMesh(ng, nmat, CAP.note);
    F.noteMesh.count = 0; F.noteMesh.frustumCulled = false; F.noteMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(F.noteMesh); R.addOutline(F.noteMesh, 0.8);
    // 접지 그림자 (둥근 진한 원)
    const st = R.canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(40,20,40,0.75)'); g.addColorStop(0.55, 'rgba(40,20,40,0.6)'); g.addColorStop(1, 'rgba(40,20,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    const sgeo = new T.PlaneGeometry(1, 1); sgeo.rotateX(-Math.PI / 2);
    F.shadowMesh = new T.InstancedMesh(sgeo, new T.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), CAP.shadow);
    F.shadowMesh.count = 0; F.shadowMesh.frustumCulled = false; F.shadowMesh.renderOrder = 2; F.shadowMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(F.shadowMesh);
    // 보스 (포도송이 모양 그대로): 큰 눈 + 삐친 눈썹 + 볼 + 삐죽 입
    const bparts = [[0, 1.55, 0.1, 1.5], [1.35, 1.2, -0.2, 1.0], [-1.35, 1.2, -0.2, 1.0], [0.85, 2.5, -0.3, 0.95], [-0.85, 2.45, -0.3, 0.98], [0, 2.85, -0.5, 0.9], [1.75, 0.55, 0.15, 0.62], [-1.75, 0.55, 0.15, 0.62], [0, 0.55, -1.0, 1.0], [1.0, 0.5, 0.9, 0.55], [-1.0, 0.5, 0.9, 0.55]];
    const bgeo = blob(bparts.map(([x, y, z, r], i) => [x * 1.3, y * 1.3, z * 1.3, r * 1.3, i === 0 ? 24 : 14]));
    const bossMood = { value: 0 };
    const bossMat = fogMat({ color: 0x77729a, key: 'boss', rim: 0.35, spec: 0, flashCol: 'vec3(0.74, 0.71, 0.92)', gy0: '0.0', gy1: '3.9', cx: '0.0', cy: '2.015', cz: '0.13', sep: 0.27, ey: 0.1, size: 0.205,
      // 단계별 표정(맞을수록 기가 꺾임): 심술 → 당황(땀방울) → 지쳐 울상. 무섭지 않게
      sel: 'uMood', fUni: ' uniform float uMood;', uni: { uMood: bossMood },
      faces: [{ brow: true, mouth: 'pout' }, { brow: 'worry', mouth: 'o', sweat: true }, { brow: 'worry', lid: 0.26, mouth: 'wavy', sweat: true }] });
    const boss = new T.Mesh(bgeo, bossMat);
    boss.castShadow = true;
    const bg2 = new T.Group(); bg2.add(boss); bg2.visible = false; scene.add(bg2);
    R.addOutline(boss, 1.35); // 다른 안개와 같은 두께
    // 고유 부품(겉모습만, 판정과 무관): 몸 둘레 회색 구슬 고리(조였다 풀렸다) + 머리 위 황동 태엽 — 정점 색 한 메시(드로콜 +2)
    const paint = (g, hex) => { const c = new T.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
    const pg = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, g = new T.SphereGeometry(i % 2 ? 0.26 : 0.36, 8, 6); g.scale(1, 0.84, 1); g.translate(Math.cos(a) * 3.12, 1.0, Math.sin(a) * 3.12); pg.push(paint(g, i % 2 ? 0x8f8ca2 : 0xbcb9cc)); }
    pg.push(paint((() => { const g = new T.TorusGeometry(3.12, 0.13, 6, 40); g.rotateX(Math.PI / 2); g.translate(0, 1.0, 0); return g; })(), 0x7b7890)); // 구슬을 잇는 띠
    pg.push(paint((() => { const g = new T.CylinderGeometry(0.17, 0.17, 1.3, 8); g.translate(0, 4.95, 0); return g; })(), 0xd9a92e));
    pg.push(paint((() => { const g = new T.CylinderGeometry(0.34, 0.4, 0.22, 10); g.translate(0, 4.55, 0); return g; })(), 0xb8862a));
    [-0.5, 0.5].forEach((x) => pg.push(paint((() => { const g = new T.TorusGeometry(0.44, 0.15, 6, 14); g.translate(x, 6.0, 0); return g; })(), 0xe0ae2c)));
    const partsMat = R.toon({ color: 0xffffff, rim: 0.5, spec: 0.4, key: 'bossparts', flashCol: 'vec3(0.95, 0.93, 1.02)' });
    partsMat.vertexColors = true;
    const parts = new T.Mesh(T.BufferGeometryUtils.mergeGeometries(pg), partsMat);
    const pgr = new T.Group(); pgr.add(parts); bg2.add(pgr);
    R.addOutline(parts, 1.35);
    // 음표를 가둔 방울 3개 = 남은 단계 수. 단계가 넘어갈 때마다 하나씩 퐁 터져 음표가 풀려남 (껍질 1 드로콜, 속 음표는 음표 메시 인스턴스에 얹음)
    const shm = R.toon({ color: 0xe4e0fa, rim: 0.6, spec: 0.5, key: 'bossshell',
      fFinal: ' { float ek = smoothstep(0.7, 0.84, fr); outgoingLight = mix(outgoingLight, vec3(0.16, 0.13, 0.26), ek * 0.92); diffuseColor.a = mix(diffuseColor.a, 0.95, ek); }\n' });
    shm.transparent = true; shm.opacity = 0.42; shm.depthWrite = false;
    const shells = new T.InstancedMesh(new T.SphereGeometry(0.72, 16, 11), shm, 3);
    shells.frustumCulled = false; shells.renderOrder = 3; shells.instanceMatrix.setUsage(T.DynamicDrawUsage); bg2.add(shells);
    // 「고리 조이기」: 바닥에 내려와 조여 오는 회색 구슬 고리(인스턴스 1메시 + 외곽선) + 바닥 예고 띠(틈 3곳은 비어 있음). 그 행동 때만 보임
    const sqg = new T.SphereGeometry(0.62, 10, 7); sqg.scale(1, 0.86, 1);
    const beads = new T.InstancedMesh(sqg, R.toon({ color: 0xb4b1c6, rim: 0.5, spec: 0.4, key: 'bossbeads' }), SQ_N);
    beads.count = 0; beads.visible = false; beads.frustumCulled = false; beads.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(beads); R.addOutline(beads, 1.2);
    const bandG = new T.PlaneGeometry(1, 1); bandG.rotateX(-Math.PI / 2);
    const band = new T.Mesh(bandG, new T.ShaderMaterial({
      uniforms: { uR: { value: 0.8 }, uW: { value: 0.07 }, uG: { value: new T.Vector3() }, uHw: { value: 0.3 }, uA: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vP; void main(){ vP = position.xz * 2.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: ['uniform float uR; uniform float uW; uniform vec3 uG; uniform float uHw; uniform float uA; uniform float uT; varying vec2 vP;',
        'float gd(float a, float g){ return abs(atan(sin(a - g), cos(a - g))); }',
        'void main(){ float d = length(vP); float bd = abs(d - uR); if (bd > uW) discard;',
        ' float a = atan(vP.x, vP.y); float g = min(gd(a, uG.x), min(gd(a, uG.y), gd(a, uG.z)));',
        ' float open = 1.0 - smoothstep(uHw - 0.03, uHw, g); if (open > 0.99) discard;',
        ' float edge = smoothstep(uW * 0.55, uW, bd);',
        ' float al = (0.42 + edge * 0.55) * (1.0 - open) * uA * (0.82 + 0.18 * sin(uT * 30.0));',
        ' gl_FragColor = vec4(vec3(1.0, 0.25, 0.2) * (1.0 + edge * 0.4), al); }'].join('\n'),
      transparent: true, depthWrite: false,
    }));
    band.visible = false; band.renderOrder = 4; band.frustumCulled = false; band.position.y = 0.09; scene.add(band);
    F.bossObj = { group: bg2, mesh: boss, mat: bossMat, mood: bossMood, pgr, partsMat, shells, beads, band, spin: 0, bubS: [0, 0, 0], bubOn: [true, true, true], cap: [new T.Vector3(), new T.Vector3(), new T.Vector3()] };
    // 회색 고리 (좁혀 오는 구역)
    F.zone = makeZone(scene);
    initTele(scene);
    initCocoons(scene);
    F.tickBeat = 0;
  };

  // 안개 고치: 반투명 안개 껍질 속에 작은 주민 실루엣(흰 눈만 깜빡). 풀리면 제 색으로 폴짝
  const cocoons = [];
  function initCocoons(scene) {
    const R = TG.R;
    const cgeo = blob([[0, 0.95, 0, 1.08, 16], [0.62, 0.55, 0.22, 0.62, 10], [-0.62, 0.55, 0.22, 0.62, 10], [0, 0.5, -0.55, 0.7, 10], [0.4, 1.62, -0.12, 0.52, 10], [-0.42, 1.58, -0.1, 0.5, 10], [0, 1.95, -0.05, 0.36, 8]]);
    const bodyG = new T.CapsuleGeometry(0.3, 0.42, 3, 8), headG = new T.SphereGeometry(0.4, 12, 9), eyeG = new T.SphereGeometry(0.07, 6, 5), hatG = new T.ConeGeometry(0.33, 0.42, 8), armG = new T.SphereGeometry(0.13, 6, 5);
    const silM = new T.MeshBasicMaterial({ color: 0x3f3862 }); // 껍질 속 실루엣
    const eyeW = new T.MeshBasicMaterial({ color: 0xffffff }), eyeK = new T.MeshBasicMaterial({ color: 0x1b1424 });
    const cols = [0xffb347, 0x6fcf97, 0x56ccf2];
    for (let i = 0; i < CAP.cocoon; i++) {
      const g = new T.Group(); g.visible = false; scene.add(g);
      const sm = R.toon({ color: 0xd6d1ee, rim: 0.5, spec: 0.1,
        fFinal: ' { float ek = smoothstep(0.74, 0.86, fr); outgoingLight = mix(outgoingLight, vec3(0.16, 0.13, 0.26), ek * 0.9); diffuseColor.a = mix(diffuseColor.a, 0.92, ek); }\n' });
      sm.transparent = true; sm.opacity = 0.34; sm.depthWrite = false;
      const shell = new T.Mesh(cgeo, sm); shell.renderOrder = 3; g.add(shell);
      const res = new T.Group(); g.add(res);
      const parts = [];
      const part = (geo, color, x, y, z, o) => { const m = new T.Mesh(geo, R.toon(Object.assign({ color, rim: 0.45 }, o || {}))); m.position.set(x, y, z); res.add(m); R.addOutline(m, 0.9); m.userData.col = m.material; parts.push(m); return m; };
      part(bodyG, cols[i % 3], 0, 0.55, 0, { sat: 1.1 });
      part(headG, 0xffdfc0, 0, 1.2, 0);
      part(hatG, 0xc9a23a, 0, 1.7, 0, { rim: 0.6, spec: 0.5 });
      part(armG, cols[i % 3], 0.4, 0.72, 0.05); part(armG, cols[i % 3], -0.4, 0.72, 0.05);
      const eyes = [-0.15, 0.15].map((x) => { const e = new T.Mesh(eyeG, eyeW); e.position.set(x, 1.24, 0.36); res.add(e); return e; });
      // 풀리는 정도 고리 (바닥)
      const ring = new T.Mesh(new T.RingGeometry(1.75, 2.0, 40), new T.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.0, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.renderOrder = 4; g.add(ring);
      cocoons.push({ g, shell, res, ring, parts, eyes, silM, eyeW, eyeK, sil: null });
    }
  }
  // 주민 겉모습 바꾸기: 껍질 속(실루엣) ↔ 풀려남(제 색 + 외곽선)
  function cocoonLook(c, sil) {
    if (c.sil === sil) return;
    c.sil = sil;
    c.parts.forEach((m) => { m.material = sil ? c.silM : m.userData.col; m.userData.outline.visible = !sil; });
    c.eyes.forEach((e) => { e.material = sil ? c.eyeW : c.eyeK; e.scale.setScalar(sil ? 1.25 : 0.85); });
  }

  function makeZone(scene) {
    const mat = new T.ShaderMaterial({
      uniforms: { uR: { value: 30 }, uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform float uR; uniform float uT; uniform float uA; varying vec3 vW;',
        'void main(){ float d = length(vW.xz); float o = smoothstep(uR - 0.3, uR + 0.3, d);',
        ' float sw = 0.5 + 0.5 * sin(atan(vW.z, vW.x) * 9.0 + d * 0.9 - uT * 1.4);',
        ' float edge = (1.0 - smoothstep(0.0, 0.55, abs(d - uR)));',
        ' vec3 col = mix(vec3(0.36, 0.41, 0.52), vec3(0.5, 0.56, 0.68), sw);',
        ' float a = (o * (0.1 + sw * 0.12) + edge * 0.6) * uA; if (a < 0.01) discard;',
        ' gl_FragColor = vec4(mix(col, vec3(0.86, 0.92, 1.02), edge), a); }'].join('\n'),
      transparent: true, depthWrite: false,
    });
    const g = new T.PlaneGeometry(90, 90); g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, mat); m.position.y = 0.07; m.renderOrder = 6; m.visible = false; m.frustumCulled = false;
    scene.add(m);
    // 고리 벽 (낮고 투명)
    const wall = new T.Mesh(new T.CylinderGeometry(1, 1, 0.8, 96, 1, true), new T.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uA; uniform float uT; varying vec2 vUv; void main(){ float a = pow(max(1.0 - vUv.y, 0.0001), 1.5) * (0.2 + 0.07 * sin(vUv.x * 120.0 + uT * 3.0)) * uA; gl_FragColor = vec4(vec3(0.7, 0.77, 0.9), a); }',
      transparent: true, depthWrite: false, side: T.DoubleSide,
    }));
    wall.position.y = 0.4; wall.visible = false; wall.renderOrder = 7; wall.frustumCulled = false;
    scene.add(wall);
    return { plane: m, wall, R: 30, on: false, a: 0 };
  }

  // ── 예고 표시 (바닥 빨간 원·선) ──
  const teles = [];
  function initTele(scene) {
    const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const m = new T.Mesh(g, new T.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uCircle: { value: 1 }, uA: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: ['uniform float uK; uniform float uCircle; uniform float uA; varying vec2 vUv;',
          'void main(){ vec2 p = vUv * 2.0 - 1.0; float d = uCircle > 0.5 ? length(p) : max(abs(p.x), abs(p.y));',
          ' if (d > 1.0) discard; float edge = smoothstep(0.84, 0.92, d); float fill = (uCircle > 0.5 ? step(d, uK) : step(abs(p.y) * 0.5 + 0.5, uK)) * 0.35;',
          ' float a = (0.18 + fill + edge * 0.7) * uA; gl_FragColor = vec4(vec3(1.0, 0.25, 0.2) * (1.0 + edge * 0.4), a); }'].join('\n'),
        transparent: true, depthWrite: false,
      }));
      m.visible = false; m.renderOrder = 4; m.frustumCulled = false; scene.add(m);
      teles.push({ m, on: false });
    }
  }
  F.tele = function (kind, x, z, o) {
    const q = teles.find((e) => !e.on); if (!q) return;
    q.on = true; q.t = 0; q.dur = o.dur || 0.8;
    const u = q.m.material.uniforms; u.uCircle.value = kind === 'circle' ? 1 : 0;
    if (kind === 'circle') { q.m.position.set(x, 0.09, z); q.m.rotation.y = 0; q.m.scale.set(o.r * 2, 1, o.r * 2); }
    else { q.m.rotation.y = o.dir; q.m.position.set(x + Math.sin(o.dir) * o.len / 2, 0.09, z + Math.cos(o.dir) * o.len / 2); q.m.scale.set(o.w, 1, o.len); }
    q.m.visible = true;
  };
  function updateTele(dt) {
    for (const q of teles) {
      if (!q.on) continue;
      q.t += dt; const k = q.t / q.dur;
      const u = q.m.material.uniforms; u.uK.value = Math.min(1, k); u.uA.value = k < 1 ? Math.min(1, k * 4) * (0.75 + 0.25 * Math.sin(q.t * 30)) : Math.max(0, 1 - (k - 1) * 5);
      if (k > 1.2) { q.on = false; q.m.visible = false; }
    }
  }

  F.reset = function () {
    teles.forEach((q) => { q.on = false; q.m.visible = false; });
    F.list.length = 0; F.notes.length = 0; F.friends.length = 0; F.popped = 0;
    F.boss = null; F.bossObj.group.visible = false; F.bossObj.beads.visible = false; F.bossObj.band.visible = false;
    F.zone.on = false; F.zone.a = 0; F.zone.plane.visible = false; F.zone.wall.visible = false;
    F.tickBeat = 0; uid = 1;
    cocoons.forEach((c) => { c.g.visible = false; });
  };

  // ── 생성 ──
  const HP = { bubble: 1, clump: 5, tick: 6, echo: 1, cocoon: 1 };
  const VAL = { bubble: 1, clump: 3, tick: 2, echo: 2, cocoon: 0 }; // 층 안개 게이지에서 빠지는 양
  const RAD = { bubble: 0.75, clump: 1.3, tick: 0.8, echo: 0.85, cocoon: 1.0 };
  F.spawn = function (kind, x, z, o) {
    o = o || {};
    if (F.count(kind) >= CAP[kind]) return null;
    const u = {
      id: uid++, kind, x, z, y: 0, vx: o.vx || 0, vz: o.vz || 0, yaw: 0, flash: 0, sqT: 0, spawnT: 0, state: 'live', dieT: 0, ph: TG.sr() * 6.28,
      hp: HP[kind], scale: 1, kb: 0, val: o.small ? 0 : VAL[kind], slowK: 1, poyCd: 0, r: RAD[kind],
    };
    u.px = x; u.pz = z; u.py = 0;
    u.maxHp = u.hp;
    u.spd = kind === 'bubble' ? TG.srr(2.8, 3.6) : kind === 'clump' ? 1.5 : kind === 'echo' ? TG.srr(2.3, 2.9) : kind === 'tick' ? 2.3 : 0;
    u.leapT = TG.srr(3, 6); u.dashT = TG.srr(4, 7);
    if (kind === 'tick') { u.beatOff = o.beatOff || 0; u.dir = o.dir != null ? o.dir : 0; u.yaw = u.dir; u.danceT = 0; }
    if (kind === 'echo') { u.shield = true; u.ripT = 0; u.scale = 1.12; }
    if (kind === 'cocoon') { u.prog = 0; u.slot = o.slot || 0; }
    if (o.small) { u.scale = 0.85; }
    u.spawnT = o.instant ? 1 : 0;
    F.list.push(u);
    return u;
  };
  F.count = function (kind) { let n = 0; for (const u of F.list) if (u.kind === kind) n++; return n; };
  F.alive = function () { let n = 0; for (const u of F.list) if (u.state === 'live' && u.kind !== 'cocoon') n++; return n; };
  // 지금 떠 있는 안개의 게이지 양 합
  F.liveVal = function () { let n = 0; for (const u of F.list) if (u.state === 'live' || u.state === 'dying') n += u.val; return n; };

  // 째깍이 줄 행진: 가장자리에서 SEFO 쪽으로 한 줄
  F.spawnTickLine = function (n, px, pz) {
    const side = (TG.sr() * 4) | 0;
    const AR = TG.AR;
    let x, z;
    if (side === 0) { x = TG.srr(-14, 14); z = -AR.bz + 0.5; } else if (side === 1) { x = TG.srr(-14, 14); z = AR.bz - 0.5; } else if (side === 2) { x = -AR.bx + 0.5; z = TG.srr(-9, 9); } else { x = AR.bx - 0.5; z = TG.srr(-9, 9); }
    const dir = Math.atan2(px - x, pz - z);
    for (let i = 0; i < n; i++) {
      const bx = x - Math.sin(dir) * i * 1.5, bz = z - Math.cos(dir) * i * 1.5;
      const u = F.spawn('tick', TG.clamp(bx, -AR.bx, AR.bx), TG.clamp(bz, -AR.bz, AR.bz), { dir, beatOff: 0 });
      if (u) u.spawnT = -i * 0.15;
    }
  };

  // ── 맞힘 (안개·기계만. 사람·고치 속 주민은 대상이 아님) ──
  // 돌려줌: 'pop' | 'hit' | 'convert' | 'bounce' | null
  F.damage = function (u, dmg, fromX, fromZ, big) {
    if (u.state !== 'live' || u.spawnT < 0.3 || u.kind === 'cocoon') return null;
    const dx = u.x - fromX, dz = u.z - fromZ, d = Math.hypot(dx, dz) || 1;
    if (u.kind === 'echo' && u.shield && !big) { // 메아리 안개: 첫 파동은 통 튕겨냄
      u.shield = false; u.flash = 0.7; u.sqT = 0.13;
      u.vx += (dx / d) * 3; u.vz += (dz / d) * 3;
      return 'bounce';
    }
    u.hp -= dmg; u.flash = 1; u.sqT = 0.13;
    const kb = u.kind === 'clump' ? 2.5 : u.kind === 'tick' ? 3 : 5;
    u.vx += (dx / d) * kb; u.vz += (dz / d) * kb;
    if (u.hp <= 0) {
      if (u.kind === 'tick') { u.state = 'dance'; u.danceT = 0; u.hp = 0; return 'convert'; }
      u.state = 'dying'; u.dieT = 0; return 'pop';
    }
    return 'hit';
  };

  F.dropNotes = function (x, z, n, burst, noGauge) {
    for (let i = 0; i < n; i++) {
      if (F.notes.length >= CAP.note) break;
      const a = TG.sr() * 6.283, sp = TG.srr(1.5, 3.5) * (burst || 1);
      F.notes.push({ x, z, y: 0.8, px: x, pz: z, py: 0.8, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: TG.srr(4, 7), t: 0, mag: false, ph: TG.sr() * 6.28, noGauge: !!noGauge });
    }
  };

  // ── 보스 ──
  // 가운데에서 큰 안개가 뭉쳐 나타남. first = 첫 판(속도 70%)
  F.startBoss = function (first) {
    const b = (F.boss = { x: 0, z: 1.0, y: 0.3, px: 0, pz: 1.0, py: 0.3, state: 'gather', t: 0, hp: BOSS_HP, maxHp: BOSS_HP, phase: 0, scale: 0.03, tscale: 1, flash: 0, sq: 0, spawnT: 2.5, inv: 0, r: 3.0, deadT: 0, ringSpd: 0.7, patT: 2.6, patN: 0, seq: 0, pat: null, drops: [], stun: 0, spdK: first ? 0.7 : 1, slowK: 1, yaw: 0 });
    F.bossObj.group.visible = true;
    F.bossObj.group.position.set(b.x, b.y, b.z);
    F.bossObj.group.scale.setScalar(0.03);
    F.bossObj.bubS.fill(0); F.bossObj.bubOn.fill(true); F.bossObj.spin = 0; F.bossObj.beads.visible = F.bossObj.beads.userData.outline.visible = F.bossObj.band.visible = false;
    F.zone.on = true; F.zone.R = 22; F.zone.plane.visible = true; F.zone.wall.visible = true;
    return b;
  };
  F.damageBoss = function (dmg) {
    const b = F.boss; if (!b || b.state !== 'fight' || b.inv > 0) return null;
    b.hp = Math.max(0, b.hp - dmg); b.flash = 1; b.sq = 0.12;
    const phaseHp = b.maxHp / 3;
    const newPhase = Math.min(3, Math.floor((b.maxHp - b.hp) / phaseHp + 1e-6));
    if (b.hp <= 0) { b.state = 'dying'; b.deadT = 0; bossCancel(b); return 'dead'; }
    if (newPhase > b.phase) { // 단계 전환: 하던 행동을 멈추고 잠깐 어질어질(그동안 안 맞음) → 그 단계의 새 행동을 먼저 예고
      bossCancel(b); b.stun = STUN; b.inv = STUN + 0.7; b.seq = 0; b.patT = 0.2;
      b.phase = newPhase; b.tscale = [1, 0.8, 0.62][newPhase] || 0.62; b.ringSpd = 1.0; F.zone.R = Math.min(25, F.zone.R + 3); return 'phase'; }
    return 'hit';
  };

  // ── 규칙 계산 ──
  F.update = function (dt, t, P, G) {
    const AR = TG.AR;
    const list = F.list;
    const beat = 0.5; // 째깍이 박자
    const playing = G.phase === 'floor' || G.phase === 'boss' || G.phase === 'bossIntro';
    F.tickBeat += dt;
    let beatHit = false;
    if (F.tickBeat >= beat) { F.tickBeat -= beat; beatHit = true; }
    const bph = F.tickBeat / beat;
    let marching = 0;

    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      u.px = u.x; u.pz = u.z; u.py = u.y;
      u.spawnT += dt;
      u.flash = Math.max(0, u.flash - dt * 9);
      u.sqT = Math.max(0, u.sqT - dt);
      u.poyCd = Math.max(0, u.poyCd - dt);
      if (u.state === 'dying') { // 눌렸다(0.06초) → 부풀며 터짐
        u.dieT += dt;
        if (u.dieT > 0.12) { G.onPop(u); list.splice(i, 1); i--; }
        continue;
      }
      if (u.spawnT < 0) continue;
      const dx = P.x - u.x, dz = P.z - u.z, d = Math.hypot(dx, dz) || 1;
      if (u.kind === 'cocoon') {
        if (u.state === 'live') {
          // 곁에 2초 서 있으면 풀림 (판정·조준 대상이 아님)
          if (playing && !P.resting && d < 2.6) u.prog += dt; else u.prog = Math.max(0, u.prog - dt * 0.6);
          if (u.prog >= 2) { u.state = 'freed'; u.dieT = 0; G.onRescue(u); }
        } else {
          u.dieT += dt;
          if (u.dieT > 1.9) { list.splice(i, 1); i--; }
        }
        continue;
      }
      if (u.kind === 'tick') {
        if (u.state === 'live') {
          marching++;
          // 박자 맞춰 통통 행진, SEFO 쪽으로 천천히 방향 틀기
          const want = Math.atan2(dx, dz);
          u.leapT -= dt * u.slowK;
          if (u.leap) { // 앞으로 뛰어오르기 (예고 0.5초 → 점프)
            u.leap.t += dt;
            if (u.leap.t < 0.5) { u.vx = TG.damp(u.vx, 0, 12, dt); u.vz = TG.damp(u.vz, 0, 12, dt); u.y = 0; u.sqT = Math.max(u.sqT, 0.05); }
            else {
              const k = (u.leap.t - 0.5) / 0.38;
              u.vx = (u.leap.tx - u.leap.sx) / 0.38; u.vz = (u.leap.tz - u.leap.sz) / 0.38; u.y = Math.sin(Math.min(1, k) * Math.PI) * 1.8;
              if (k >= 1) { u.vx = u.vz = 0; u.y = 0; u.sqT = 0.13; TG.FX.dust(u.x, u.z, 8, 0.9); TG.FX.shake(0.06); TG.A.play('sfx_bonk', { gain: 0.35, rate: 1.4 });
                if (Math.hypot(P.x - u.x, P.z - u.z) < 1.6) { const h = P.hurt(u.x, u.z); if (h) G.onHurt(u, h); }
                u.leap = null; u.leapT = TG.srr(4, 7); }
            }
          } else {
            u.dir += TG.clamp(TG.angDiff(u.dir, want), -0.9 * dt, 0.9 * dt);
            const step = Math.pow(Math.sin(Math.PI * bph), 2) * 2 * u.spd * u.slowK;
            u.vx = TG.damp(u.vx, Math.sin(u.dir) * step, 10, dt); u.vz = TG.damp(u.vz, Math.cos(u.dir) * step, 10, dt);
            u.y = Math.sin(Math.PI * bph) * 0.32;
            if (u.leapT <= 0 && d < 9 && d > 2.5 && playing) {
              const L = Math.min(3.8, d), tx = u.x + (dx / d) * L, tz = u.z + (dz / d) * L;
              u.leap = { t: 0, sx: u.x, sz: u.z, tx, tz }; u.dir = want;
              F.tele('circle', tx, tz, { r: 1.5, dur: 0.5 });
            }
          }
          u.yaw = u.dir + (Math.floor(F.tickBeat + t / beat) % 2 ? 0.16 : -0.16);
          if (beatHit) u.sqT = 0.08;
          if (d < u.r + 0.6) { const h = P.hurt(u.x, u.z); if (h) { G.onHurt(u, h); u.vx -= (dx / d) * 4; u.vz -= (dz / d) * 4; } }
        } else if (u.state === 'dance') {
          u.danceT += dt;
          u.yaw += dt * 9;
          u.y = Math.abs(Math.sin(u.danceT * 7)) * 0.45;
          u.vx = TG.damp(u.vx, 0, 5, dt); u.vz = TG.damp(u.vz, 0, 5, dt);
          // 주변 안개에 작은 음표 보냄
          u.shootT = (u.shootT || 0) - dt;
          if (u.shootT <= 0) {
            u.shootT = 0.75;
            let best = null, bd = 49;
            for (const v of list) { if (v.kind === 'tick' || v.kind === 'cocoon' || v.state !== 'live') continue; const q = (v.x - u.x) ** 2 + (v.z - u.z) ** 2; if (q < bd) { bd = q; best = v; } }
            if (F.boss && F.boss.state === 'fight') { const q = (F.boss.x - u.x) ** 2 + (F.boss.z - u.z) ** 2; if (q < bd + 16) { best = { boss: true, x: F.boss.x, z: F.boss.z }; } }
            if (best) F.friends.push({ x: u.x, z: u.z, y: 1.2, tgt: best, t: 0 });
          }
          if (u.danceT > 10) { u.state = 'leave'; u.dieT = 0; TG.FX.text('고마워!', u.x, 2.2, u.z, 'word'); }
        } else if (u.state === 'leave') {
          u.dieT += dt; u.y += dt * 9 * u.dieT * 3; u.yaw += dt * 14;
          if (u.dieT > 0.6) { TG.FX.popBurst(u.x, u.y, u.z, 0.8, [1.0, 2.0, 1.9]); list.splice(i, 1); i--; continue; }
        }
      } else {
        // 안개: SEFO 쪽으로 둥실둥실 (째깍 원판 안에서는 느려짐)
        let sp = u.spd * (u.spawnT < 0.5 ? 0.3 : 1) * u.slowK;
        if (!playing) sp = 0;
        if (u.kind === 'clump') {
          u.dashT -= dt * u.slowK;
          if (u.dashT <= 0 && !u.dash && d < 10 && playing) { u.dash = 0.0001; u.sqT = 0.13; }
          if (u.dash) { u.dash += dt; if (u.dash < 0.4) sp = 0; else if (u.dash < 0.85) { sp = 8.5 * u.slowK; if (TG.fr() < 0.14) TG.FX.emit(TG.FX.CELL.puff, u.x, 0.8, u.z, { life: 0.25, size: 0.6, size1: 1.0, color: [0.95, 0.93, 1.05], alpha: 0.28 }); } else { u.dash = 0; u.dashT = TG.srr(4, 7); } }
        }
        if (u.kind === 'echo' && u.shield) { // 표면 원형 리플
          u.ripT -= dt;
          if (u.ripT <= 0) { u.ripT = 0.55; TG.FX.emit(TG.FX.CELL.ring, u.x, u.y + 0.1, u.z, { life: 0.5, size: 0.9, size1: 2.6, color: [0.8, 1.3, 2.2], alpha: 0.7 }); }
        }
        u.vx = TG.damp(u.vx, (dx / d) * sp, u.dash ? 8 : 2.2, dt); u.vz = TG.damp(u.vz, (dz / d) * sp, u.dash ? 8 : 2.2, dt);
        const base = u.kind === 'clump' ? 0.12 : 0.95;
        u.y = TG.damp(u.y, base + Math.sin(t * 2.6 + u.ph) * (u.kind === 'clump' ? 0.08 : 0.16), 6, dt);
        u.yaw += TG.angDiff(u.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-6 * dt));
        const hitR = u.r * u.scale + 0.5;
        if (d < hitR && u.spawnT > 0.4 && playing) { const h = P.hurt(u.x, u.z); if (h) { G.onHurt(u, h); u.vx -= (dx / d) * 7; u.vz -= (dz / d) * 7; } }
      }
      u.x += u.vx * dt; u.z += u.vz * dt;
    }
    // 서로 밀어내기 (겹침 방지). 고치는 제자리
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; if (a.state !== 'live') continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]; if (b.state !== 'live') continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = (a.r * a.scale + b.r * b.scale) * 0.92, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-5) {
          const d = Math.sqrt(d2), k = (rr - d) / d;
          const wa = a.kind === 'cocoon' ? 0 : b.kind === 'cocoon' ? 1 : 0.5, wb = 1 - wa;
          a.x -= dx * k * wa; a.z -= dz * k * wa; b.x += dx * k * wb; b.z += dz * k * wb;
        }
      }
      if (a.kind === 'cocoon') continue;
      const p = { x: a.x, z: a.z }; AR.push(p, a.r * a.scale * 0.8); a.x = p.x; a.z = p.z;
    }
    if (beatHit && marching > 0) TG.A.tick(0.5);

    // 친구 음표 (춤추는 째깍이가 보냄)
    for (let i = 0; i < F.friends.length; i++) {
      const f = F.friends[i];
      f.t += dt;
      const tg = f.tgt;
      if (!tg.boss && tg.state !== 'live') { f.t = 99; }
      const dx = tg.x - f.x, dz = tg.z - f.z, d = Math.hypot(dx, dz) || 1;
      f.x += (dx / d) * 11 * dt; f.z += (dz / d) * 11 * dt;
      TG.FX.emit(TG.FX.CELL.note, f.x, f.y + Math.sin(f.t * 20) * 0.1, f.z, { life: 0.05, size: 0.55, size1: 0.55, color: [0.6, 2.0, 1.9], rot: 0 });
      if (TG.fr() < 0.5) TG.FX.emit(TG.FX.CELL.sparkle, f.x, f.y, f.z, { life: 0.25, size: 0.3, size1: 0, color: [1.5, 2.2, 2.0] });
      if (d < 0.6 || f.t > 2) {
        if (f.t <= 2) {
          if (tg.boss) G.hitBoss(1, f.x, f.z, true); else G.hitUnit(tg, 1, f.x, f.z, true);
        }
        F.friends.splice(i, 1); i--;
      }
    }

    // 음표 방울: 튀어나온 뒤 자석처럼 빨려옴
    const magR = 4.2 + (G.mod ? G.mod.magnet : 0);
    for (let i = 0; i < F.notes.length; i++) {
      const n = F.notes[i];
      n.px = n.x; n.pz = n.z; n.py = n.y;
      n.t += dt;
      const dx = P.x - n.x, dz = P.z - n.z, dy = 1.0 - n.y, d = Math.hypot(dx, dz);
      if (!n.mag && n.t > 0.35 && (d < magR || n.t > 7)) n.mag = true;
      if (n.mag && !P.resting) {
        const acc = 40 + n.t * 10;
        n.vx += (dx / (d || 1)) * acc * dt; n.vz += (dz / (d || 1)) * acc * dt; n.vy += dy * 20 * dt;
        n.vx *= Math.exp(-3 * dt); n.vz *= Math.exp(-3 * dt); n.vy *= Math.exp(-4 * dt);
        if (TG.fr() < 0.6) TG.FX.emit(TG.FX.CELL.sparkle, n.x, n.y, n.z, { life: 0.28, size: 0.35, size1: 0, color: [2.4, 2.0, 0.7] });
        if (d < 0.75) { G.onPick(n); F.notes.splice(i, 1); i--; continue; }
      } else {
        n.vy -= 18 * dt; n.vx *= Math.exp(-2.5 * dt); n.vz *= Math.exp(-2.5 * dt);
        if (n.y < 0.55 && n.vy < 0) { n.y = 0.55; n.vy = -n.vy * 0.45; if (Math.abs(n.vy) < 0.6) n.vy = 0; }
      }
      n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt;
      n.x = TG.clamp(n.x, -AR.bx, AR.bx); n.z = TG.clamp(n.z, -AR.bz, AR.bz);
    }

    updateTele(dt);
    updateBoss(dt, t, P, G);
    updateZone(dt, t, P, G);
  };

  // ── 보스 행동 (모두 예고가 먼저 보임. 난수는 TG.sr 만) ──
  // 1단계: 굴러오기·안개 비 / 2단계(당황): + 고리 조이기·쿵 내려앉기 / 3단계(지침): + 연속 굴러오기(벽 튕김)·고리+안개 비 조합
  const BOSS_HP = 200, STUN = 1.5, DROP_R = 1.9;
  const BOSS_ORDER = [['roll', 'rain'], ['squeeze', 'roll', 'slam', 'rain'], ['rolls', 'combo', 'slam', 'rain']];
  const BOSS_GAP = [2.2, 1.8, 1.5]; // 행동 사이 쉬는 시간(초, 첫 판은 /0.7)
  const RBX = 17, RBZ = 11.5;       // 굴러다닐 수 있는 범위
  function bossCancel(b) { // 하던 행동·예고를 모두 거둠
    b.pat = null; b.drops.length = 0; b.roll = 0; b.wob = 0;
    teles.forEach((q) => { q.on = false; q.m.visible = false; });
  }
  function bossDrop(b, x, z, delay, spawn) { F.tele('circle', x, z, { r: DROP_R, dur: delay }); b.drops.push({ x, z, t: delay, spawn }); }
  // 굴러갈 길: 벽에 닿으면 멈추거나(bounce=false) 튕겨서 남은 거리만큼 더 감
  function rollPath(x, z, dir, len, bounce) {
    const segs = []; let sx = Math.sin(dir), sz = Math.cos(dir);
    for (let i = 0; i < 3 && len > 0.3; i++) {
      let k = len;
      if (sx > 1e-6) k = Math.min(k, (RBX - x) / sx); else if (sx < -1e-6) k = Math.min(k, (-RBX - x) / sx);
      if (sz > 1e-6) k = Math.min(k, (RBZ - z) / sz); else if (sz < -1e-6) k = Math.min(k, (-RBZ - z) / sz);
      k = Math.max(0, k);
      segs.push({ x, z, dir: Math.atan2(sx, sz), len: k });
      x = TG.clamp(x + sx * k, -RBX, RBX); z = TG.clamp(z + sz * k, -RBZ, RBZ); len -= k;
      if (!bounce) break;
      if (Math.abs(x) > RBX - 1e-3) sx = -sx;
      if (Math.abs(z) > RBZ - 1e-3) sz = -sz;
    }
    return segs;
  }
  function rollAim(b, P, pre) {
    const pt = b.pat, hr = b.r * b.scale + 0.6;
    b.x = TG.clamp(b.x, -RBX, RBX); b.z = TG.clamp(b.z, -RBZ, RBZ);
    const dir = Math.atan2(P.x - b.x, P.z - b.z);
    pt.t = 0; pt.pre = pre / b.spdK; pt.spd = 15.5 * b.spdK; pt.cur = null;
    pt.segs = rollPath(b.x, b.z, dir, pt.len, pt.bounce);
    pt.total = 0; for (const q of pt.segs) pt.total += q.len;
    pt.dir = dir; pt.sx = b.x; pt.sz = b.z; // (봇이 읽는 값)
    pt.segs.forEach((q) => F.tele('line', q.x, q.z, { dir: q.dir, len: q.len + hr * 0.9, w: hr * 2, dur: pt.pre }));
  }
  function bossBegin(b, type, P) {
    const sk = b.spdK, hr = b.r * b.scale + 0.6;
    if (type === 'roll' || type === 'rolls') {
      const chain = type === 'rolls';
      b.pat = { type: 'roll', left: chain ? 3 : 1, len: chain ? 14 : 17, bounce: b.phase >= 2 };
      rollAim(b, P, 0.8);
      if (chain) TG.FX.text('데굴데굴 세 번!', b.x, 5.6 * b.scale + 0.6, b.z, 'word');
    } else if (type === 'rain') { // 안개 비: SEFO 자리 + 가는 길 앞(2단계부터) + 둘레
      const n = 3 + Math.min(2, b.phase), pre = 0.8 / sk, spots = [[P.x, P.z]];
      if (b.phase >= 1) spots.push([P.x + P.vx * 0.7, P.z + P.vz * 0.7]);
      while (spots.length < n) { const a = TG.sr() * 6.28, r = TG.srr(2.5, 5); spots.push([P.x + Math.cos(a) * r, P.z + Math.sin(a) * r]); }
      spots.forEach(([x, z], i) => bossDrop(b, TG.clamp(x, -18, 18), TG.clamp(z, -12, 12), pre + i * 0.12, i < 3));
      b.pat = { type: 'rain', t: 0, end: pre + n * 0.12 + 0.3 };
      b.sq = 0.2;
    } else if (type === 'slam') {
      const pre = 1.0 / sk, tx = TG.clamp(P.x, -16, 16), tz = TG.clamp(P.z, -10.5, 10.5);
      b.pat = { type: 'slam', t: 0, pre, sx: b.x, sz: b.z, tx, tz, done: false };
      F.tele('circle', tx, tz, { r: hr + 0.2, dur: pre + 0.16 });
      b.sq = 0.2;
    } else { // 'squeeze' | 'combo'
      const pa = Math.atan2(P.x - b.x, P.z - b.z), g = TG.srr(0.78, 1.02);
      const R1 = b.r * b.scale * 0.9, R0 = TG.clamp(Math.hypot(P.x - b.x, P.z - b.z) + 3, 7.5, 12); // 늘 SEFO 조금 바깥에서 시작(화면 안에 보이게)
      b.pat = { type: 'squeeze', t: 0, pre: 1.0 / sk, dur: (R0 - R1) / (3.8 * sk), cx: b.x, cz: b.z, R0, R1, hw: 0.36,
        gaps: [pa + g, pa - g, pa + Math.PI], rain: type === 'combo' ? [1.0 / sk + 0.1, 1.0 / sk + 1.2] : null };
      b.pat.r = b.pat.pr = b.pat.R1;
      TG.FX.text(type === 'combo' ? '고리에 안개 비까지!' : '고리가 조여 와요!', b.x, 5.6 * b.scale + 0.6, b.z, 'word');
      TG.A.play('sfx_steam', { gain: 0.5, rate: 0.8 });
    }
  }

  function updateBoss(dt, t, P, G) {
    const b = F.boss; if (!b) return;
    b.px = b.x; b.pz = b.z; b.py = b.y;
    b.t += dt; b.flash = Math.max(0, b.flash - dt * 7); b.sq = Math.max(0, b.sq - dt); b.inv = Math.max(0, b.inv - dt);
    const K = b.spdK * b.slowK; // 첫 판 70% · 째깍 원판 안에서 느려짐
    if (b.state === 'gather') {
      // 가운데로 안개가 모여 큰 덩이가 됨
      const k = Math.min(1, b.t / 1.6);
      b.scale = 0.03 + 0.97 * (k * k * (3 - 2 * k));
      b.y = 0.3 + (1 - k) * 0.8;
      if (TG.fr() < 0.9) { const a = TG.fr() * 6.283, r = TG.fra(5, 10) * (1 - k * 0.5); TG.FX.emit(TG.FX.CELL.puff, b.x + Math.cos(a) * r, TG.fra(0.5, 3), b.z + Math.sin(a) * r, { vx: -Math.cos(a) * r * 2.2, vz: -Math.sin(a) * r * 2.2, vy: 0.5, life: 0.42, size: TG.fra(1.0, 1.8), size1: 0.5, color: [0.78, 0.75, 1.0], alpha: 0.75, drag: 0.5 }); }
      if (k >= 1) { b.state = 'land'; b.t = 0; b.scale = 1; G.onBossLand(); }
    } else if (b.state === 'land') {
      b.scale = TG.damp(b.scale, b.tscale, 6, dt);
      if (b.t > 1.4) { b.state = 'fight'; b.t = 0; }
    } else if (b.state === 'fight') {
      b.scale = TG.damp(b.scale, b.tscale, 6, dt);
      const dx = P.x - b.x, dz = P.z - b.z, d = Math.hypot(dx, dz) || 1;
      const hold = G.phase !== 'boss'; // 폭 덮임·카드 고르는 동안은 기다림
      const hr = b.r * b.scale + 0.6;  // 몸에 닿는 반지름
      if (b.stun > 0) { // 단계 전환 멈칫: 제자리에서 어질어질 (행동·뿜기 없음)
        b.stun -= dt;
        b.wob = Math.sin(b.t * 30) * 0.07 * Math.min(1, b.stun * 2); b.y = TG.damp(b.y, 0.3, 8, dt);
        if (TG.fr() < 0.35) { const a = TG.fr() * 6.283; TG.FX.emit(TG.FX.CELL.star, b.x + Math.cos(a) * 1.6, 5.2 * b.scale + 0.4, b.z + Math.sin(a) * 1.6, { vx: Math.cos(a) * 1.5, vy: 1.2, vz: Math.sin(a) * 1.5, life: 0.45, size: 0.5, size1: 0.1, color: [2.4, 2.1, 0.8], pop: true }); }
        if (b.stun <= 0) { b.stun = 0; b.wob = 0; b.sq = 0.2; }
      } else if (!b.pat) {
        const tx = TG.clamp(P.x * 0.55, -8, 8), tz = TG.clamp(P.z * 0.55, -6, 7) + 0.5;
        if (!hold) { b.x = TG.damp(b.x, tx, 0.35 * K, dt); b.z = TG.damp(b.z, tz, 0.35 * K, dt); }
        const p = { x: b.x, z: b.z }; TG.AR.push(p, 1.2); b.x = p.x; b.z = p.z;
        b.y = TG.damp(b.y, 0.3 + Math.sin(t * 1.6) * 0.25, 6, dt);
        if (!hold) b.patT -= dt * K;
        if (b.patT <= 0) {
          const ord = BOSS_ORDER[Math.min(2, b.phase)], type = ord[b.seq % ord.length];
          b.seq++; b.patN++;
          bossBegin(b, type, P);
          b.patT = BOSS_GAP[Math.min(2, b.phase)];
        }
      } else if (b.pat.type === 'roll') { // 굴러오기: 예고 선 → 선 따라 굴러 지나감 (3단계는 벽에 튕기고, 「연속」이면 다시 겨눠 또 굴러옴)
        const pt = b.pat; pt.t += dt;
        if (pt.t < pt.pre) { b.sq = 0.12 * (Math.sin(pt.t * 30) > 0 ? 1 : 0.4); b.wob = Math.sin(pt.t * 40) * 0.05; b.y = TG.damp(b.y, 0.3, 8, dt); }
        else {
          let dist = (pt.t - pt.pre) * pt.spd, done = dist >= pt.total, seg = pt.segs[pt.segs.length - 1];
          if (done) dist = pt.total;
          for (const q of pt.segs) { if (dist <= q.len) { seg = q; break; } dist -= q.len; }
          if (seg !== pt.cur) { if (pt.cur) { TG.FX.shake(0.12); TG.FX.dust(seg.x, seg.z, 6, 1.4); } pt.cur = seg; pt.dir = seg.dir; pt.sx = seg.x; pt.sz = seg.z; } // 벽에 통 튕김
          dist = Math.min(dist, seg.len);
          b.x = seg.x + Math.sin(seg.dir) * dist; b.z = seg.z + Math.cos(seg.dir) * dist;
          b.wob = 0; b.roll = (b.roll || 0) + dt * 9; b.y = 0.3 + Math.abs(Math.sin(b.roll)) * 0.4;
          if (TG.fr() < 0.5) TG.FX.dust(b.x, b.z, 3, 1.4);
          if (done) {
            b.roll = 0; TG.FX.shake(0.15);
            if (--pt.left > 0) rollAim(b, P, 0.6); else b.pat = null;
          }
        }
      } else if (b.pat.type === 'rain') { // 안개 비: 예고 원 → 차례로 내려앉음 (떨어지는 것은 아래 drops 에서)
        const pt = b.pat; pt.t += dt;
        b.y = TG.damp(b.y, 0.3, 6, dt);
        if (pt.t > pt.end) b.pat = null;
      } else if (b.pat.type === 'slam') { // 쿵 내려앉기: 둥실 떠올라(예고 원) → 그 자리에 쿵 + 작은 안개 3
        const pt = b.pat; pt.t += dt;
        if (pt.t < pt.pre) {
          const k = pt.t / pt.pre, e = 1 - (1 - k) * (1 - k), m = TG.smooth(0.1, 0.9, k);
          b.y = 0.3 + 5.4 * e; b.x = TG.lerp(pt.sx, pt.tx, m); b.z = TG.lerp(pt.sz, pt.tz, m);
          b.wob = Math.sin(pt.t * 24) * 0.04;
        } else if (!pt.done) {
          const k = Math.min(1, (pt.t - pt.pre) / 0.16);
          b.x = pt.tx; b.z = pt.tz; b.y = 0.3 + 5.4 * (1 - k * k); b.wob = 0;
          if (k >= 1) {
            pt.done = true; b.sq = 0.24;
            TG.FX.shake(0.4); TG.FX.dust(b.x, b.z, 16, 2.2); TG.FX.ring(b.x, b.z, { r0: hr * 0.6, r1: hr + 2.2, dur: 0.4, color: 0xe6eaf4, width: 0.25 });
            TG.A.play('sfx_bonk', { gain: 0.6, rate: 0.7 });
            if (!hold && Math.hypot(P.x - b.x, P.z - b.z) < hr) { const h = P.hurt(b.x, b.z); if (h) G.onHurt(b, h); }
            const a0 = TG.sr() * 6.283;
            for (let i = 0; i < 3; i++) { // 작은 안개 부르기
              const a = a0 + i * 2.094, u = F.spawn('bubble', b.x + Math.cos(a) * (hr + 0.4), b.z + Math.sin(a) * (hr + 0.4), { vx: Math.cos(a) * 5, vz: Math.sin(a) * 5, small: true });
              if (u) { u.spawnT = 0.3; u.y = 1.2; u.scale = 1; }
            }
          }
        } else { b.y = 0.3; if (pt.t > pt.pre + 0.16 + 0.55) b.pat = null; }
      } else if (b.pat.type === 'squeeze') { // 고리 조이기: 구슬 고리가 머리 위로 퍼졌다(예고) → 바닥에 내려와 조여 옴. 틈 3곳으로 빠져나감
        const pt = b.pat; pt.t += dt; pt.pr = pt.r;
        b.y = TG.damp(b.y, 0.3 + Math.sin(t * 1.6) * 0.15, 6, dt);
        if (pt.t < pt.pre) {
          const k = pt.t / pt.pre; pt.r = pt.R1 + (pt.R0 - pt.R1) * (1 - Math.pow(1 - Math.min(1, k * 1.35), 3));
          b.sq = 0.1 * (Math.sin(pt.t * 26) > 0 ? 1 : 0.4);
        } else {
          const k = Math.min(1, (pt.t - pt.pre) / pt.dur);
          pt.r = pt.R0 + (pt.R1 - pt.R0) * k;
          const px = P.x - pt.cx, pz = P.z - pt.cz, pd = Math.hypot(px, pz);
          if (!hold && Math.abs(pd - pt.r) < 0.8 && pd > 0.5) {
            const pa = Math.atan2(px, pz);
            let open = false; for (const g of pt.gaps) if (Math.abs(TG.angDiff(g, pa)) < pt.hw) open = true;
            if (!open) { const h = P.hurt(pt.cx + px * 0.5, pt.cz + pz * 0.5); if (h) G.onHurt(b, h); }
          }
          while (pt.rain && pt.rain.length && pt.t >= pt.rain[0]) { pt.rain.shift(); bossDrop(b, TG.clamp(P.x, -17, 17), TG.clamp(P.z, -11.5, 11.5), 0.85 / b.spdK, false); } // 3단계 조합: 틈에서 기다리면 안개 비
          if (k >= 1) { b.pat = null; b.sq = 0.2; TG.FX.popBurst(b.x, 1.2, b.z, 1.0); }
        }
      }
      // 예고된 안개 비가 내려앉음
      for (let i = 0; i < b.drops.length; i++) {
        const q = b.drops[i]; q.t -= dt;
        if (q.t > 0) continue;
        if (q.spawn) { const u = F.spawn('bubble', q.x, q.z, { small: true }); if (u) { u.spawnT = 0.3; u.y = 7; u.scale = 1; } }
        TG.FX.ring(q.x, q.z, { r0: 0.5, r1: 2.6, dur: 0.4, color: 0xe6eaf4, width: 0.22 });
        TG.FX.popBurst(q.x, 1.0, q.z, 1.2);
        if (Math.hypot(P.x - q.x, P.z - q.z) < DROP_R) { const h = P.hurt(q.x, q.z); if (h) G.onHurt(b, h); }
        TG.FX.shake(0.08); TG.A.play('sfx_pop', { rate: 0.7, gain: 0.6 });
        b.drops.splice(i, 1); i--;
      }
      if (!hold && b.y < 1.6 && d < hr) { const h = P.hurt(b.x, b.z); if (h) G.onHurt(b, h); }
      // 안개 방울 뿜기
      if (!hold && b.stun <= 0) b.spawnT -= dt * K;
      if (b.spawnT <= 0 && b.y < 1.6) {
        b.spawnT = [3.2, 2.7, 2.2, 2.0][b.phase] || 2.2;
        const k = 4 + b.phase;
        for (let i = 0; i < k; i++) {
          const a = (i / k) * 6.283 + t;
          const u = F.spawn('bubble', b.x + Math.cos(a) * 2.2 * b.scale, b.z + Math.sin(a) * 2.2 * b.scale, { vx: Math.cos(a) * 6, vz: Math.sin(a) * 6, small: true });
          if (u) { u.spawnT = 0.3; u.y = 1.5; u.scale = 1; }
        }
        b.sq = 0.2; TG.FX.popBurst(b.x, 2.4 * b.scale, b.z, 1.2);
        TG.A.play('sfx_steam', { gain: 0.4, rate: 1.3 });
      }
      // 고리 좁히기
      if (!hold) F.zone.R = Math.max(8.5, F.zone.R - dt * 0.25 * (b.phase === 0 ? 0.7 : b.ringSpd) * b.spdK);
    } else if (b.state === 'dying') {
      // 마지막 명중 → (0.4초 멈춤은 히트 스톱) → 크게 부풂 → 큰 퐁
      b.deadT += dt;
      const k = Math.min(1, b.deadT / 0.75);
      b.scale = b.tscale * (1 + 0.75 * k * k) ;
      b.wob = Math.sin(b.deadT * 46) * 0.05 * (0.3 + k);
      b.flash = 0.35 + 0.65 * k * (Math.sin(b.deadT * 34) > 0 ? 1 : 0.5);
      b.y = 0.3 + k * 0.5;
      if (k >= 1 && !b.popped) { b.popped = true; G.onBossPop(b); }
    }
  }

  function updateZone(dt, t, P, G) {
    const z = F.zone;
    // 고리 밖(회색 구역)에 있으면 느려지고, 2.5초 넘게 머물면 「소리 크기」 1칸
    const inZone = z.on && Math.hypot(P.x, P.z) > z.R;
    P.slow = inZone ? 0.6 : 1;
    P.inZone = inZone;
    if (inZone && !P.resting && G.phase === 'boss') {
      P.zoneT += dt;
      if (P.zoneT > 2.5) { P.zoneT = 0; const h = P.hurt(P.x * 1.2, P.z * 1.2); if (h) G.onHurt({ kind: 'zone' }, h); }
    } else P.zoneT = Math.max(0, P.zoneT - dt * 2);
  }

  // ── 그리기 (걸음 사이 보간) ──
  const tmpM = new T.Matrix4(), tmpM2 = new T.Matrix4(), tmpM3 = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpS = new T.Vector3(), tmpP = new T.Vector3(), tmpC = new T.Color();
  F.draw = function (dt, t, P, al) {
    const L = TG.lerp;
    // 회색 고리
    const z = F.zone;
    z.a = TG.damp(z.a, z.on ? 1 : 0, 2.5, dt);
    z.plane.visible = z.wall.visible = z.a > 0.01;
    z.plane.material.uniforms.uR.value = z.R; z.plane.material.uniforms.uT.value = t; z.plane.material.uniforms.uA.value = z.a;
    z.wall.scale.set(z.R, 1, z.R); z.wall.material.uniforms.uA.value = z.a; z.wall.material.uniforms.uT.value = t;
    // 보스
    const b = F.boss, o = F.bossObj;
    if (b) {
      if (b.popped) o.group.visible = false;
      const br = 1 + Math.sin(t * 1.3) * 0.035;
      const sq = b.sq > 0 ? Math.sin((b.sq / 0.12) * Math.PI) * 0.12 : 0;
      o.group.position.set(L(b.px, b.x, al), L(b.py, b.y, al), L(b.pz, b.z, al));
      o.group.scale.set(b.scale * (br + sq), b.scale * (br - sq * 1.2), b.scale * (br + sq));
      o.group.rotation.y = TG.damp(o.group.rotation.y, Math.atan2(P.rx - b.x, P.rz - b.z) * 0.6, 3, dt);
      o.group.rotation.x = b.roll ? Math.sin(b.roll) * 0.25 : TG.damp(o.group.rotation.x, 0, 6, dt);
      o.group.rotation.z = b.wob ? b.wob : TG.damp(o.group.rotation.z, 0, 8, dt);
      const fl = Math.max(Math.max(0, b.flash - 0.3) * 0.5, b.state === 'fight' && b.inv > 0 ? 0.22 + 0.16 * Math.sin(t * 22) : 0); // 맞을 때는 0.1초·밝기만 살짝 / // 단계 전환 멈칫 동안은 깜빡깜빡(안 맞는 때)
      o.mat.userData.flash.value = fl; // 밝은 보라로 약하게 (SEFO를 덮지 않게)
      // 단계 겉모습 (규칙 값 b.phase 를 읽기만 함): 표정 · 고리 조임 빠르기 · 남은 음표 방울 수
      const ph = b.state === 'dying' ? 2 : Math.min(2, b.phase);
      o.mood.value = ph;
      o.partsMat.userData.flash.value = fl;
      o.spin += dt * (0.6 + ph * 0.45);
      const tight = 1 - 0.08 * (0.5 + 0.5 * Math.sin(t * (1.5 + ph * 0.9)));
      o.pgr.rotation.y = o.spin; o.pgr.scale.set(tight, 1, tight);
      o.group.updateMatrixWorld(true);
      const remain = b.state === 'dying' ? 0 : 3 - ph;
      for (let i = 0; i < 3; i++) {
        const on = i < remain, a = -t * 0.45 + i * 2.094;
        tmpP.set(Math.cos(a) * 2.9, 4.25 + Math.sin(t * 2.1 + i * 2) * 0.18, Math.sin(a) * 2.9);
        const k = Math.max(0.001, o.bubS[i]) * (1 + Math.sin(t * 3.3 + i) * 0.04);
        tmpM.compose(tmpP, tmpQ.identity(), tmpS.set(k, k, k)); o.shells.setMatrixAt(i, tmpM);
        o.cap[i].copy(tmpP).applyMatrix4(o.group.matrixWorld);
        if (o.bubOn[i] && !on && o.group.visible) { // 퐁 — 갇혀 있던 음표가 풀려남
          const c = o.cap[i], FX = TG.FX;
          FX.popBurst(c.x, c.y, c.z, 0.8);
          for (let j = 0; j < 4; j++) FX.emit(j % 2 ? FX.CELL.note : FX.CELL.note2, c.x, c.y, c.z, { vx: TG.fra(-2.5, 2.5), vy: TG.fra(4, 7), vz: TG.fra(-2.5, 2.5), life: TG.fra(0.8, 1.1), size: 0.8, size1: 0.3, color: [2.4, 2.0, 0.6], grav: 5, rot: 0, pop: true });
        }
        o.bubOn[i] = on;
        o.bubS[i] = TG.damp(o.bubS[i], on ? 1 : 0, on ? 5 : 26, dt);
      }
      o.shells.instanceMatrix.needsUpdate = true;
    }
    // 안개 방울·뭉치·메아리·째깍이
    let nb = 0, nc = 0, nt = 0, ne = 0, ns = 0;
    const S = F.shadowMesh;
    const pushShadow = (x, z2, s) => { if (ns >= CAP.shadow) return; tmpM.compose(tmpP.set(x, 0.03, z2), tmpQ.identity(), tmpS.set(s, 1, s)); S.setMatrixAt(ns++, tmpM); };
    // 보스 「고리 조이기」: 구슬 고리 + 바닥 예고 띠 (규칙 값 b.pat 을 읽기만 함)
    const sq = b && b.state === 'fight' && b.pat && b.pat.type === 'squeeze' ? b.pat : null;
    o.beads.visible = o.beads.userData.outline.visible = o.band.visible = !!sq;
    if (sq) {
      const r = L(sq.pr, sq.r, al), pre = sq.t < sq.pre, k = pre ? sq.t / sq.pre : 1;
      const by = pre ? 0.85 + 3.6 * Math.sin(Math.min(1, k) * Math.PI) * (1 - k * 0.3) : 0.85; // 예고 동안은 머리 위로 떠서 퍼짐(닿지 않음) → 바닥으로
      const bs = pre ? 0.45 + 0.55 * k : 1;
      let n = 0;
      for (let i = 0; i < SQ_N; i++) {
        const a = sq.gaps[0] + (i + 0.5) / SQ_N * 6.283;
        let open = false; for (const g of sq.gaps) if (Math.abs(TG.angDiff(g, a)) < sq.hw) open = true;
        if (open) continue;
        const x = sq.cx + Math.sin(a) * r, z2 = sq.cz + Math.cos(a) * r, s = bs * (i % 2 ? 0.82 : 1) * Math.min(1, 0.4 + r * 0.085);
        tmpM.compose(tmpP.set(x, by + Math.sin(t * 5 + i) * 0.06, z2), tmpQ.identity(), tmpS.set(s, s, s)); o.beads.setMatrixAt(n++, tmpM);
        if (!pre) pushShadow(x, z2, 1.5 * s);
      }
      o.beads.count = o.beads.userData.outline.count = n; o.beads.instanceMatrix.needsUpdate = true;
      const u = o.band.material.uniforms;
      o.band.position.set(sq.cx, 0.09, sq.cz); o.band.scale.set(30, 1, 30);
      u.uR.value = (pre ? sq.R0 : r) / 15; u.uW.value = (pre ? 1.0 : 0.85) / 15; u.uG.value.set(sq.gaps[0], sq.gaps[1], sq.gaps[2]); u.uHw.value = sq.hw; u.uT.value = t;
      u.uA.value = pre ? Math.min(1, k * 4) : 0.8;
    }
    cocoons.forEach((c) => { c.used = false; });
    for (const u of F.list) {
      if (u.spawnT < 0) continue;
      const ux = L(u.px, u.x, al), uz = L(u.pz, u.z, al), uy = L(u.py, u.y, al);
      const k = TG.clamp(u.spawnT / 0.45, 0, 1);
      if (u.kind === 'cocoon') { drawCocoon(u, k, t, dt); pushShadow(ux, uz, 3.0); continue; }
      let s = u.scale * (u.kind === 'tick' ? 1 : TG.easeOutElastic(k));
      if (u.kind === 'tick' && k < 1) s *= TG.easeOutBack(k);
      if (u.kind === 'clump') s *= (0.62 + 0.38 * (u.hp / u.maxHp)) * (0.93 + 0.14 * hsh(u.id, 1));
      else if (u.kind === 'bubble') s *= 0.87 + 0.27 * hsh(u.id, 1); // 꾸밈용 크기 ±13% (판정 반지름은 그대로)
      let sx = 1, sy = 1;
      if (u.sqT > 0) { const q = Math.sin((u.sqT / 0.13) * Math.PI); sx = 1 + q * 0.4; sy = 1 - q * 0.38; }
      if (u.kind !== 'tick') { const w = Math.sin(t * 3.1 + u.ph) * 0.04; sx += w; sy -= w; }
      if (u.state === 'dying') { // 눌렸다 → 부풀며 터짐
        const q = u.dieT / 0.12;
        if (q < 0.5) { sx *= 1 + 0.16 * (q / 0.5); sy *= 1 - 0.3 * (q / 0.5); } else { const e = (q - 0.5) / 0.5; sx *= 1.16 + 0.06 * e; sy *= 0.7 + 0.45 * e; } // 작게 부풂(최대 약 1.2배)
      }
      if (u.kind === 'tick' && u.state === 'leave') s *= Math.max(0.01, 1 - u.dieT / 0.6);
      const fl = u.state === 'dying' ? (u.dieT < 0.05 ? 0.6 : 0.35) : u.flash * 0.7;
      if (u.kind === 'tick') {
        tmpE.set(0, u.yaw, u.state === 'live' ? Math.sin(F.tickBeat / 0.5 * Math.PI) * 0.12 : 0, 'YXZ');
        tmpQ.setFromEuler(tmpE);
        tmpM.compose(tmpP.set(ux, uy, uz), tmpQ, tmpS.set(s * sx, s * sy, s * sx));
        F.tickMesh.setMatrixAt(nt, tmpM); F.tickFlash.array[nt] = fl;
        const c = F.tickMesh.instanceColor.array;
        if (u.state === 'live') { c[nt * 3] = c[nt * 3 + 1] = c[nt * 3 + 2] = 1; }
        else { tmpC.setHSL((t * 0.6 + u.id * 0.17) % 1, 0.75, 0.62); c[nt * 3] = tmpC.r * 1.5; c[nt * 3 + 1] = tmpC.g * 1.5; c[nt * 3 + 2] = tmpC.b * 1.5; }
        tmpM2.makeRotationX(0.8); tmpM3.makeRotationZ(u.state === 'live' ? t * 2.6 + u.id : t * 13 + u.id); tmpM2.multiply(tmpM3).setPosition(0, F.tickKeyAt[0], F.tickKeyAt[1]);
        F.tickKey.setMatrixAt(nt, tmpM3.multiplyMatrices(tmpM, tmpM2));
        nt++; pushShadow(ux, uz, 1.7 * s);
        continue;
      }
      // 안개: 얼굴이 늘 화면 쪽을 보게(몸은 조금만 돌고 살짝 젖힘), 동공만 SEFO 쪽을 봄 → 위에서 내려다봐도 눈이 읽힘
      const rel = TG.angDiff(0, u.yaw), dy = Math.sin(rel) * 0.8, la = rel - dy;
      tmpE.set(-0.34, dy, 0, 'YXZ');
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpP.set(ux, uy, uz), tmpQ, tmpS.set(s * sx, s * sy, s * sx));
      const lkx = TG.clamp(Math.sin(la) * 1.5, -1, 1), lky = TG.clamp(-Math.cos(la), -0.25, 1) * 0.8 - 0.1, ph = (u.id * 0.371) % 1;
      const put = (mesh, flash, look, i, w) => { mesh.setMatrixAt(i, tmpM); flash.array[i] = fl; const a = look.array; a[i * 4] = lkx; a[i * 4 + 1] = lky; a[i * 4 + 2] = ph; a[i * 4 + 3] = w; };
      const vary = (attr, i) => { const fv = hsh(u.id, 3); attr.array[i * 2] = Math.floor(hsh(u.id, 2) * 3); attr.array[i * 2 + 1] = fv < 0.5 ? 0 : fv < 0.8 ? 1 : 2; }; // 색조 3단 · 표정 3종 (id 해시)
      if (u.kind === 'bubble') { vary(F.bubbleVar, nb); put(F.bubbleMesh, F.bubbleFlash, F.bubbleLook, nb, 0); nb++; pushShadow(ux, uz, 1.6 * s); }
      else if (u.kind === 'echo') { put(F.echoMesh, F.echoFlash, F.echoLook, ne, u.shield ? 1 : 0); ne++; pushShadow(ux, uz, 1.8 * s); }
      else { vary(F.clumpVar, nc); put(F.clumpMesh, F.clumpFlash, F.clumpLook, nc, 0); nc++; pushShadow(ux, uz, 3.0 * s); }
    }
    cocoons.forEach((c) => { if (!c.used) c.g.visible = false; });
    F.bubbleMesh.count = nb; F.clumpMesh.count = nc; F.tickMesh.count = nt; F.echoMesh.count = ne;
    F.bubbleMesh.userData.outline.count = nb; F.clumpMesh.userData.outline.count = nc; F.tickMesh.userData.outline.count = nt; F.echoMesh.userData.outline.count = ne;
    F.tickKey.count = F.tickKey.userData.outline.count = nt; F.tickKey.instanceMatrix.needsUpdate = true;
    [F.bubbleMesh, F.clumpMesh, F.tickMesh, F.echoMesh].forEach((m) => { m.instanceMatrix.needsUpdate = true; m.geometry.getAttribute('aFlash').needsUpdate = true; });
    F.bubbleLook.needsUpdate = F.echoLook.needsUpdate = F.clumpLook.needsUpdate = true;
    F.bubbleVar.needsUpdate = F.clumpVar.needsUpdate = true;
    F.tickMesh.instanceColor.needsUpdate = true;
    // 음표
    let nn = 0;
    for (const n of F.notes) {
      const blink = n.t > 10 && Math.sin(n.t * 25) > 0;
      const s = blink ? 0.001 : Math.min(1, n.t * 6) * 1.15;
      const nx = L(n.px, n.x, al), nz = L(n.pz, n.z, al);
      tmpQ.setFromEuler(tmpE.set(0, t * 3 + n.ph, Math.sin(t * 4 + n.ph) * 0.25, 'YXZ'));
      tmpM.compose(tmpP.set(nx, L(n.py, n.y, al) + Math.sin(t * 5 + n.ph) * 0.08, nz), tmpQ, tmpS.set(s, s, s));
      F.noteMesh.setMatrixAt(nn++, tmpM);
      pushShadow(nx, nz, 0.45);
    }
    if (b && o.group.visible) for (let i = 0; i < 3; i++) { // 보스 방울 속 음표
      if (o.bubS[i] < 0.05 || nn >= CAP.note) continue;
      const s = 1.35 * b.scale * o.bubS[i];
      tmpQ.setFromEuler(tmpE.set(0, t * 1.6 + i * 2, Math.sin(t * 3 + i) * 0.2, 'YXZ'));
      tmpM.compose(o.cap[i], tmpQ, tmpS.set(s, s, s));
      F.noteMesh.setMatrixAt(nn++, tmpM);
    }
    F.noteMesh.count = nn; F.noteMesh.userData.outline.count = nn; F.noteMesh.instanceMatrix.needsUpdate = true;
    // SEFO 그림자
    if (P.root.visible) pushShadow(P.rx, P.rz, 2.1 * (1 - Math.min(0.5, P.ry * 0.12)));
    if (b && o.group.visible) pushShadow(o.group.position.x, o.group.position.z, 6.8 * b.scale);
    S.count = ns; S.instanceMatrix.needsUpdate = true;
  };

  function drawCocoon(u, k, t, dt) {
    const c = cocoons[u.slot % cocoons.length];
    c.used = true; c.g.visible = true;
    c.g.position.set(u.x, 0, u.z);
    const pr = Math.min(1, u.prog / 2);
    if (u.state === 'live') {
      const s = TG.easeOutElastic(k) * (1 + Math.sin(t * 2.2 + u.ph) * 0.03);
      const shake = pr > 0 ? Math.sin(t * 30) * 0.05 * pr : 0;
      cocoonLook(c, true);
      c.shell.visible = true;
      c.shell.scale.set(s * (1.12 + shake), s * (1.12 - pr * 0.18), s * (1.12 - shake));
      c.shell.rotation.y = Math.sin(t * 0.7 + u.ph) * 0.25;
      c.shell.material.opacity = 0.34 - pr * 0.14; // 풀릴수록 껍질이 옅어짐
      // 속의 주민: 살짝 웅크려 둥실, 가끔 깜빡 (곁에 서면 폴짝거림)
      c.res.position.y = 0.2 + pr * 0.2 + Math.sin(t * (2.4 + pr * 6) + u.ph) * (0.05 + pr * 0.08); c.res.rotation.y = Math.sin(t * 1.6 + u.ph) * 0.3; c.res.scale.setScalar(s * 1.02);
      const bl = (t * 0.31 + u.ph) % 1 > 0.95 ? 0.15 : 1;
      c.eyes.forEach((e) => { e.scale.set(1.25, 1.25 * bl, 1.25); });
      c.ring.visible = true; c.ring.material.opacity = 0.35 + pr * 0.6; c.ring.scale.setScalar(0.55 + 0.45 * pr);
    } else { // 풀려남: 폴짝폴짝 손 흔들고 반짝이며 떠남
      const q = u.dieT;
      cocoonLook(c, false);
      c.shell.visible = false; c.ring.visible = false;
      c.res.position.y = Math.abs(Math.sin(q * 9)) * 0.9; c.res.rotation.y += dt * 8;
      c.res.scale.setScalar(q > 1.5 ? Math.max(0.01, 1 - (q - 1.5) / 0.4) : 1.15);
    }
  }
  // 화면용: 고치 풀림 정도 목록
  F.cocoonList = function () { return F.list.filter((u) => u.kind === 'cocoon' && u.state === 'live'); };
})();
