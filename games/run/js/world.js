// 세계: 하늘·바닥·지나가는 풍경·장애물·구슬·음표·반짝이·결승 무대. 테마 2개(town 마을 / ocean 바닷속)
// 모든 물체의 앞뒤 위치는 z = -EK.SPEED * (곡 시간) — 곡 시간에 묶여 있어 박자와 어긋나지 않음.
(function () {
  const EK = window.EK, SP = EK.SPEED, LW = EK.LANE;
  // 테마마다 풍경 구역(zones) 3개: 한 곡 안에서 하늘·안개·조명·길·바닥 색과 옆 소품이 바뀜. 모두 밝은 색(무섭지 않게).
  const TH = {
    town: { fogN: 55, fogF: 135, hemiI: 2.1, sunI: 2.3, dash: '#ffffff', orb: 0xffcf3a, orbE: 0xff9a00, zones: [
      { sky: [0x4aa8ff, 0xa9dcff, 0xe6f6ff], fog: 0xdaf1ff, hemi: [0xffffff, 0xffe2b0], sun: 0xfff1d6, road: '#FFDD85', edge: '#FF9F45', walk: '#C9B6FF', ground: '#86D667', ground2: '#74C957' },   // 마을
      { sky: [0x35a3f0, 0x9fe6f2, 0xe9fbe6], fog: 0xdcf7e2, hemi: [0xffffff, 0xd8f5b8], sun: 0xfff6dc, road: '#FFE9A6', edge: '#6EC8FF', walk: '#FFC9A8', ground: '#63C456', ground2: '#52B347' },   // 공원
      { sky: [0x7d6fe6, 0xffa9cc, 0xffe6c0], fog: 0xffe2d2, hemi: [0xfff3ea, 0xffd2b8], sun: 0xffe0bc, road: '#FFD0E6', edge: '#B58CFF', walk: '#FFD873', ground: '#B9A4FF', ground2: '#A792F2' },   // 무대 앞(노을 축제)
    ] },
    ocean: { fogN: 34, fogF: 110, hemiI: 2.2, sunI: 1.8, dash: '#ffffff', orb: 0x8fe9ff, orbE: 0x2fb6ff, zones: [
      { sky: [0x1f9be0, 0x66d2f0, 0xbdf3f0], fog: 0x86def0, hemi: [0xffffff, 0xf2f0d8], sun: 0xfffbe6, road: '#FFE6A6', edge: '#FFB36B', walk: '#F3D9A0', ground: '#EBD79E', ground2: '#DFC98A' },   // 얕은 바다(모래)
      { sky: [0x0b5fb5, 0x2aa3df, 0x7fdcf2], fog: 0x3db4e6, hemi: [0xffffff, 0xd6ecff], sun: 0xfff6e8, road: '#F8D98E', edge: '#FF8FB1', walk: '#E9C98A', ground: '#2E93C8', ground2: '#2785BA' },   // 산호 숲
      { sky: [0x3a35b0, 0x5a72e0, 0x8fb0f5], fog: 0x6f8cf0, hemi: [0xffffff, 0xddd6ff], sun: 0xf6f2ff, road: '#DCCBFF', edge: '#5FD6C4', walk: '#B9A4FF', ground: '#4E62D2', ground2: '#4356C4' },   // 반짝이는 깊은 바다
    ] },
    // r8 옛날 학교 운동장(밝은 낮): 황토 흙 트랙 + 흰 석회 줄. 구역 = 운동장 → 놀이터 옆 → 구령대 앞(운동회)
    school: { fogN: 50, fogF: 130, hemiI: 2.2, sunI: 2.3, dash: '#ffffff', orb: 0xffcf3a, orbE: 0xff9a00, zones: [
      { sky: [0x3fa6ff, 0xa6dcff, 0xeaf6ff], fog: 0xdff1ff, hemi: [0xffffff, 0xffe6c4], sun: 0xfff3dc, road: '#E3B06A', edge: '#D29A54', walk: '#CFA062', ground: '#8FD46E', ground2: '#7CC45C' },   // 운동장
      { sky: [0x3aa0f5, 0xa9e6f5, 0xeafbe6], fog: 0xdcf7e6, hemi: [0xffffff, 0xdaf5bc], sun: 0xfff6dc, road: '#E6B470', edge: '#D49E58', walk: '#D2A466', ground: '#73CC5E', ground2: '#62BB4E' },   // 놀이터 옆
      { sky: [0x3aa4ff, 0xaadcff, 0xeef8ff], fog: 0xe3f3ff, hemi: [0xffffff, 0xffe6c4], sun: 0xfff3dc, road: '#E6B470', edge: '#D49E58', walk: '#D2A466', ground: '#8FD46E', ground2: '#7CC45C' },   // 구령대 앞(운동회, 밝은 낮 그대로 — r8b: 노을 X)
    ] },
  };
  const cache = {};
  const geo = (key, fn) => { if (!cache[key]) { cache[key] = EK.merge(fn()); cache[key].userData.keep = true; } return cache[key]; };
  const PAL = [0xff8fb1, 0xffd23a, 0x5fd6c4, 0xb9a4ff, 0xff9f45, 0x6ec8ff];

  // ---------- 풍경 도형 ----------
  function house(i) {
    const w = [0xfff3d6, 0xffd9e4, 0xd9f2ff, 0xe8dcff][i % 4], r = [0xff7b6b, 0x6244be, 0xffa53a, 0x3fb8a8][i % 4];
    return geo('house' + i % 4, () => [
      ['box', w, [0, 1.4, 0], [3.2, 2.8, 3.0]], ['pyr', r, [0, 3.7, 0], [2.9, 1.9, 2.9], [0, Math.PI / 4, 0]],
      ['box', 0x8a5a3c, [0, 0.75, 1.52], [0.8, 1.5, 0.08]], ['sphLo', 0xffd23a, [0.25, 0.75, 1.58], 0.07],
      ['box', 0x9fdcff, [-1.0, 1.7, 1.52], [0.7, 0.7, 0.08]], ['box', 0x9fdcff, [1.0, 1.7, 1.52], [0.7, 0.7, 0.08]],
      ['box', 0xffffff, [-1.0, 1.7, 1.54], [0.76, 0.08, 0.06]], ['box', 0xffffff, [1.0, 1.7, 1.54], [0.76, 0.08, 0.06]],
      ['box', r, [0.9, 3.9, -0.5], [0.45, 1.1, 0.45]], ['sphLo', 0xffffff, [0, 3.2, 1.3], 0.3],
    ]);
  }
  const tree = i => geo('tree' + i % 3, () => i % 3 === 2
    ? [['cyl', 0x9a6a44, [0, 0.7, 0], [0.22, 1.4, 0.22]], ['cone', 0x4fbf6a, [0, 2.2, 0], [1.3, 2.0, 1.3]], ['cone', 0x63cf7c, [0, 3.3, 0], [1.0, 1.7, 1.0]], ['cone', 0x7bdc8f, [0, 4.2, 0], [0.7, 1.3, 0.7]]]
    : [['cyl', 0x9a6a44, [0, 0.9, 0], [0.24, 1.8, 0.24]], ['sph', i % 3 ? 0x5ccc6e : 0x77d85a, [0, 2.9, 0], [1.5, 1.35, 1.5]], ['sphLo', i % 3 ? 0x77d985 : 0x92e372, [0.8, 2.3, 0.3], 0.85], ['sphLo', i % 3 ? 0x77d985 : 0x92e372, [-0.75, 2.5, -0.2], 0.9], ['sphLo', 0xff8fb1, [0.5, 3.5, 0.9], 0.14], ['sphLo', 0xff8fb1, [-0.6, 3.0, 1.0], 0.14], ['sphLo', 0xffffff, [0.1, 2.5, 1.35], 0.13]]);
  // r8 운동장 소품(전부 도형): 플라타너스·은행나무·철봉·정글짐·구름사다리·시소·나팔 스피커·만국기 기둥·콩주머니 바구니
  const plane = i => geo('plane' + i % 2, () => [['cyl', 0xc9b79a, [0, 1.3, 0], [0.3, 2.6, 0.3]], ['sphLo', 0x8d7b63, [0.12, 1.1, 0.2], [0.18, 0.5, 0.18]], ['sph', 0x5fbf6a, [0, 3.9, 0], [2.2, 1.8, 2.2]], ['sphLo', 0x7ad184, [1.3, 3.2, 0.4], 1.2], ['sphLo', 0x6cc777, [-1.2, 3.4, -0.3], 1.3], ['sphLo', 0x8ddc8f, [0.2, 4.9, 0.5], 1.0]]);
  const ginkgo = i => geo('ginkgo' + i % 2, () => [['cyl', 0xa98a63, [0, 1.4, 0], [0.22, 2.8, 0.22]], ['sph', i % 2 ? 0xffd23a : 0xffc93a, [0, 3.6, 0], [1.1, 1.9, 1.1]], ['sphLo', 0xffe27a, [0.6, 3.0, 0.3], 0.7], ['sphLo', 0xffe27a, [-0.55, 3.9, -0.2], 0.7], ['sphLo', 0xffd23a, [0, 4.9, 0], 0.55]]);
  const bars = () => geo('bars', () => { const P = []; for (const h of [1.0, 1.4, 1.8]) { const x = (h - 1.4) * 2.2; P.push(['cyl', 0x6244be, [x - 0.9, h / 2, 0], [0.06, h, 0.06]], ['cyl', 0x6244be, [x + 0.9, h / 2, 0], [0.06, h, 0.06]], ['cyl', 0xd9d3ea, [x, h, 0], [0.05, 1.86, 0.05], [0, 0, Math.PI / 2]]); } return P; });
  const jungle = () => geo('jungle', () => { const P = [], c = [0xff7b6b, 0x6ec8ff, 0xffd23a, 0x5fd6c4]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P.push(['cyl', c[(i + j) % 4], [-1.2 + i * 1.2, 1.2, -1.2 + j * 1.2], [0.06, 2.4, 0.06]]); for (let k = 0; k < 3; k++) { const y = 0.8 + k * 0.8; for (let i = 0; i < 3; i++) P.push(['cyl', c[(i + k) % 4], [-1.2 + i * 1.2, y, 0], [0.05, 2.5, 0.05], [Math.PI / 2, 0, 0]], ['cyl', c[(i + k + 1) % 4], [0, y, -1.2 + i * 1.2], [0.05, 2.5, 0.05], [0, 0, Math.PI / 2]]); } return P; });
  const ladder = () => geo('ladder', () => { const P = []; for (const sx of [1, -1]) for (const sz of [1, -1]) P.push(['cyl', 0x6244be, [sx * 0.6, 1.1, sz * 1.8], [0.06, 2.2, 0.06]]); for (const sx of [1, -1]) P.push(['cyl', 0x6244be, [sx * 0.6, 2.2, 0], [0.05, 3.8, 0.05], [Math.PI / 2, 0, 0]]); for (let k = 0; k < 7; k++) P.push(['cyl', 0xffd23a, [0, 2.2, -1.5 + k * 0.5], [0.04, 1.3, 0.04], [0, 0, Math.PI / 2]]); return P; });
  const seesaw = () => geo('seesaw', () => [['pyr', 0x6244be, [0, 0.3, 0], [0.6, 0.6, 0.6], [0, Math.PI / 4, 0]], ['box', 0xffd23a, [0, 0.62, 0], [3.4, 0.12, 0.4], [0, 0, 0.16]], ['box', 0xff7b6b, [-1.5, 0.95, 0], [0.5, 0.14, 0.5], [0, 0, 0.16]], ['box', 0x6ec8ff, [1.5, 0.45, 0], [0.5, 0.14, 0.5], [0, 0, 0.16]], ['cyl', 0x2b1f57, [-1.1, 1.1, 0], [0.04, 0.5, 0.04]], ['cyl', 0x2b1f57, [1.1, 0.6, 0], [0.04, 0.5, 0.04]]]);
  const horn = () => geo('horn', () => [['cyl', 0x8a8aa0, [0, 2.2, 0], [0.07, 4.4, 0.07]], ['cone', 0xd9d3ea, [0.45, 4.3, 0], [0.32, 0.8, 0.32], [0, 0, -Math.PI / 2]], ['cone', 0xd9d3ea, [-0.45, 4.1, 0], [0.32, 0.8, 0.32], [0, 0, Math.PI / 2]], ['sphLo', 0x2b1f57, [0, 4.2, 0], 0.16], ['sph', 0xffffff, [0.85, 4.3, 0], [0.12, 0.3, 0.3]], ['sph', 0xffffff, [-0.85, 4.1, 0], [0.12, 0.3, 0.3]]]);
  const flagpole = i => geo('flagpole' + i % 3, () => { const P = [['cyl', 0xffffff, [0, 2.6, 0], [0.06, 5.2, 0.06]], ['sph', 0xffd23a, [0, 5.3, 0], 0.16]]; for (let k = 0; k < 6; k++) P.push(['pyr', PAL[(k + i) % 6], [0.55 + k * 0.5, 5.0 - k * 0.12, 0], [0.26, 0.5, 0.05], [0, 0, -Math.PI / 2 + 0.2]]); return P; });   // 세모 색깔 만국기(실제 국기 아님)
  const beanbag = i => geo('bean' + i % 2, () => { const P = [['cyl', 0xc98a4c, [0, 0.3, 0], [0.55, 0.6, 0.55]], ['cyl', 0xb5763f, [0, 0.6, 0], [0.6, 0.06, 0.6]]]; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; P.push(['sphLo', k % 2 ? (i % 2 ? 0xff5c5c : 0x4a8df0) : 0xffffff, [Math.cos(a) * 0.28, 0.7, Math.sin(a) * 0.28], [0.17, 0.12, 0.17]]); } return P; });
  // r8b 운동회 천막(본부석 그늘막): 네 기둥 + 흰·파랑(또는 흰·빨강) 줄무늬 네모 지붕 + 긴 탁자 — 둥근 서커스 천막 X
  const canopy = i => geo('canopy' + i % 2, () => { const c = i % 2 ? 0x4a8df0 : 0xff5c5c, P = []; for (const sx of [1, -1]) for (const sz of [1, -1]) P.push(['cyl', 0xd9d3ea, [sx * 2.0, 1.4, sz * 1.5], [0.07, 2.8, 0.07]]);
    for (let k = 0; k < 6; k++) P.push(['box', k % 2 ? 0xffffff : c, [-2.1 + k * 0.84, 2.9, 0], [0.84, 0.14, 3.6]], ['box', k % 2 ? 0xffffff : c, [-2.1 + k * 0.84, 2.62, 1.85], [0.84, 0.5, 0.06]]);
    P.push(['box', 0xfff3d6, [0, 0.7, 0.4], [3.4, 0.1, 0.9]], ['box', 0xfff3d6, [-1.5, 0.35, 0.4], [0.1, 0.7, 0.8]], ['box', 0xfff3d6, [1.5, 0.35, 0.4], [0.1, 0.7, 0.8]], ['sphLo', 0xffd23a, [-0.8, 0.9, 0.4], 0.16], ['sphLo', 0x5fd6c4, [0.6, 0.9, 0.4], 0.16]); return P; });
  const balloons = i => geo('bal' + i % 2, () => [['cyl', 0xffffff, [0, 1.2, 0], [0.04, 2.4, 0.04]], ['sph', PAL[i % 6], [0, 2.9, 0], [0.5, 0.6, 0.5]], ['sph', PAL[(i + 2) % 6], [0.5, 2.5, 0.1], [0.42, 0.5, 0.42]], ['sph', PAL[(i + 4) % 6], [-0.45, 2.45, -0.1], [0.42, 0.5, 0.42]], ['box', 0xffd23a, [0, 0.25, 0], [0.5, 0.5, 0.5]]]);
  const lamp = () => geo('lamp', () => [['cyl', 0x6244be, [0, 1.6, 0], [0.08, 3.2, 0.08]], ['sph', 0xfff3b0, [0, 3.4, 0], 0.34], ['cyl', 0x6244be, [0, 0.1, 0], [0.25, 0.2, 0.25]], ['pyr', 0xff8fb1, [0.38, 2.6, 0], [0.3, 0.5, 0.05], [0, 0, -Math.PI / 2]]]);
  const bush = i => geo('bush' + i % 2, () => [['sph', 0x6fcf63, [0, 0.4, 0], [0.9, 0.6, 0.7]], ['sphLo', 0x86dc74, [0.6, 0.35, 0.1], 0.45], ['sphLo', i % 2 ? 0xff8fb1 : 0xffd23a, [0.2, 0.85, 0.3], 0.13], ['sphLo', 0xffffff, [-0.35, 0.75, 0.35], 0.12], ['sphLo', i % 2 ? 0xffd23a : 0xb9a4ff, [0.55, 0.6, 0.45], 0.12]]);
  const tower = () => geo('tower', () => [['cyl', 0xfff3d6, [0, 3, 0], [1.6, 6, 1.6]], ['cone', 0x6244be, [0, 7.4, 0], [2.1, 2.8, 2.1]], ...star(0xffd23a, 0, 9.3, 0, 0.7, 0.3), ['box', 0x9fdcff, [0, 4, 1.56], [0.8, 1.0, 0.1]], ['box', 0x8a5a3c, [0, 0.9, 1.56], [1.0, 1.8, 0.1]], ['tor', 0xff8fb1, [0, 5.6, 0], [1.66, 1.66, 0.6], [Math.PI / 2, 0, 0]]]);
  function gate(theme) {
    return geo('gate_' + theme, () => {
      const P = [], post = theme === 'ocean' ? 0xff9fb8 : 0xffffff;
      for (const sx of [1, -1]) { P.push(['cyl', post, [4.6 * sx, 3.2, 0], [0.14, 6.4, 0.14]], ['sph', 0xffd23a, [4.6 * sx, 6.5, 0], 0.3]); }
      if (theme === 'school') P.push(['cyl', 0xffffff, [0, 6.0, 0], [0.025, 9.2, 0.025], [0, 0, Math.PI / 2]]);   // r8 운동장: 줄에 매단 세모 만국기(실제 국기 아님)
      for (let i = 0; i < 11; i++) { const u = i / 10, x = -4.6 + u * 9.2, y = 6.3 - Math.sin(u * Math.PI) * 0.9; P.push(theme === 'ocean' ? ['sph', PAL[i % 6], [x, y - 0.2, 0], [0.26, 0.3, 0.26]] : ['pyr', PAL[i % 6], [x, y - 0.3, 0], [0.34, 0.6, 0.06], [Math.PI, 0, 0]]); }
      return P;
    });
  }
  // 바닷속
  const coral = i => geo('coral' + i % 3, () => { const c = [0xff8fb1, 0xff9f45, 0xc79bff][i % 3], c2 = [0xffb3cb, 0xffc17a, 0xdcc0ff][i % 3], P = [], R = EK.rng(11 + i % 3);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, r = 0.2 + R() * 0.7, h = 1.0 + R() * 1.8; P.push(['cyl', c, [Math.cos(a) * r, h / 2, Math.sin(a) * r], [0.16, h, 0.16], [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25]], ['sphLo', c2, [Math.cos(a) * (r + h * 0.12), h, Math.sin(a) * (r + h * 0.12)], 0.24]); }
    P.push(['sph', 0x6f86a8, [0, 0.1, 0], [1.2, 0.35, 1.0]]); return P; });
  const kelp = i => geo('kelp' + i % 2, () => { const P = [], h = i % 2 ? 6 : 4.5; for (let k = 0; k < 7; k++) { const u = k / 6; P.push(['sphLo', k % 2 ? 0x3fbf7a : 0x2faa6a, [Math.sin(u * 3.2) * 0.35, 0.3 + u * h, 0], [0.26 - u * 0.1, h / 9, 0.1]]); } P.push(['sphLo', 0x49c987, [0.5, 1.0, 0.1], [0.16, 0.9, 0.08]], ['sphLo', 0x49c987, [-0.45, 0.8, -0.1], [0.14, 0.7, 0.08]]); return P; });
  const rock = i => geo('rock' + i % 2, () => [['ico', 0x6f86a8, [0, 0.6, 0], [1.4, 0.9, 1.1]], ['ico', 0x8198b8, [0.9, 0.35, 0.4], [0.7, 0.5, 0.6]], ['sphLo', i % 2 ? 0xff9f45 : 0xff8fb1, [-0.3, 1.38, 0.3], [0.32, 0.1, 0.32]], ['sphLo', 0xffffff, [0.5, 0.9, 0.8], 0.1], ['sphLo', 0x5fd6c4, [-0.9, 0.5, 0.7], [0.2, 0.5, 0.1]]]);
  const chest = () => geo('chest', () => [['box', 0xb5763f, [0, 0.4, 0], [1.3, 0.8, 0.9]], ['cyl', 0xc98a4c, [0, 0.8, 0], [0.45, 1.3, 0.45], [0, 0, Math.PI / 2]], ['box', 0xffd23a, [0, 0.55, 0.47], [0.25, 0.3, 0.06]], ['box', 0xffd23a, [-0.45, 0.6, 0], [0.1, 1.0, 0.95]], ['box', 0xffd23a, [0.45, 0.6, 0], [0.1, 1.0, 0.95]], ['sphLo', 0xffe98a, [0.9, 0.12, 0.3], 0.14], ['sphLo', 0xffe98a, [-0.85, 0.1, 0.5], 0.12]]);
  const jelly = i => geo('jelly' + i % 2, () => { const c = i % 2 ? 0xffb3cb : 0xdcc0ff, P = [['sph', c, [0, 0, 0], [0.7, 0.55, 0.7]], ['sphLo', 0xffffff, [0.2, 0.2, 0.5], 0.09], ['sphLo', 0x1d1420, [0.2, -0.05, 0.62], [0.06, 0.08, 0.04]], ['sphLo', 0x1d1420, [-0.2, -0.05, 0.62], [0.06, 0.08, 0.04]], ['sphLo', 0xff8fb1, [0, -0.2, 0.62], [0.1, 0.04, 0.03]]]; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; P.push(['cyl', c, [Math.cos(a) * 0.4, -0.75, Math.sin(a) * 0.4], [0.06, 0.9, 0.06]]); } return P; });
  const fish = i => geo('fish' + i % 3, () => { const c = [0xffd23a, 0xff9f45, 0xff8fb1][i % 3]; return [['sph', c, [0, 0, 0], [0.5, 0.32, 0.16]], ['cone', c, [-0.6, 0, 0], [0.3, 0.4, 0.08], [0, 0, -Math.PI / 2]], ['sphLo', 0xffffff, [0.28, 0.08, 0.13], 0.07], ['sphLo', 0x1d1420, [0.3, 0.08, 0.17], 0.035], ['sphLo', 0xffffff, [0.28, 0.08, -0.13], 0.07], ['sphLo', 0x1d1420, [0.3, 0.08, -0.17], 0.035], ['box', 0xffffff, [0, 0, 0], [0.1, 0.6, 0.34]]]; });

  // 공원·축제·얕은 바다·깊은 바다용 소품
  const bench = () => geo('bench', () => [['box', 0xc98a4c, [0, 0.5, 0], [1.6, 0.12, 0.5]], ['box', 0xc98a4c, [0, 0.95, -0.22], [1.6, 0.5, 0.1]], ['box', 0x6244be, [0.65, 0.25, 0], [0.1, 0.5, 0.45]], ['box', 0x6244be, [-0.65, 0.25, 0], [0.1, 0.5, 0.45]]]);
  const flowers = i => geo('flw' + i % 2, () => { const P = [['cyl', 0x9a6a44, [0, 0.1, 0], [0.95, 0.2, 0.95]], ['cyl', 0x6fcf63, [0, 0.2, 0], [0.85, 0.08, 0.85]]]; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, r = k ? 0.5 : 0, c = PAL[(k + i) % 6]; P.push(['cyl', 0x4fbf6a, [Math.cos(a) * r, 0.45, Math.sin(a) * r], [0.03, 0.5, 0.03]], ['sphLo', c, [Math.cos(a) * r, 0.75, Math.sin(a) * r], [0.2, 0.12, 0.2]], ['sphLo', 0xffe98a, [Math.cos(a) * r, 0.8, Math.sin(a) * r], 0.07]); } return P; });
  const playset = () => geo('playset', () => [['box', 0x6ec8ff, [-0.9, 1.0, 0], [0.5, 2.0, 0.9]], ['box', 0xffd23a, [0.55, 0.9, 0], [2.7, 0.14, 0.8], [0, 0, -0.62]], ['cone', 0xff7b6b, [-0.9, 2.4, 0], [0.62, 0.8, 0.62]], ['box', 0xff8fb1, [0.55, 1.05, 0.42], [2.7, 0.2, 0.06], [0, 0, -0.62]], ['box', 0xff8fb1, [0.55, 1.05, -0.42], [2.7, 0.2, 0.06], [0, 0, -0.62]]]);
  const tent = i => geo('tent' + i % 3, () => { const c = [0xff7b6b, 0x6ec8ff, 0xffd23a][i % 3]; return [['cyl', 0xfff3d6, [0, 0.9, 0], [1.4, 1.8, 1.4]], ['cone', c, [0, 2.6, 0], [1.9, 1.6, 1.9]], ['tor', 0xffffff, [0, 1.85, 0], [1.75, 1.75, 0.5], [Math.PI / 2, 0, 0]], ['cyl', 0xffffff, [0, 3.7, 0], [0.04, 0.8, 0.04]], ['pyr', 0xff8fb1, [0.25, 3.9, 0], [0.3, 0.3, 0.05], [0, 0, -Math.PI / 2]], ['box', 0x6244be, [0, 0.8, 1.38], [0.8, 1.4, 0.08]]]; });
  const spk = () => geo('spk', () => [['box', 0x2b1f57, [0, 1.3, 0], [1.3, 2.6, 1.0]], ['cyl', 0xb9a4ff, [0, 1.8, 0.52], [0.45, 0.08, 0.45], [Math.PI / 2, 0, 0]], ['cyl', 0xb9a4ff, [0, 0.75, 0.52], [0.32, 0.08, 0.32], [Math.PI / 2, 0, 0]], ['sph', 0xffd23a, [0, 2.75, 0], 0.22]]);
  const shell = i => geo('shell' + i % 2, () => [['sph', i % 2 ? 0xffd0df : 0xfff0c8, [0, 0.2, 0], [0.5, 0.25, 0.4]], ['sphLo', 0xffffff, [0.35, 0.1, 0.35], 0.12], ['sphLo', 0xff9f45, [-0.6, 0.08, 0.2], [0.3, 0.08, 0.3]], ['sphLo', 0xffc17a, [-0.6, 0.14, 0.2], 0.1], ['sphLo', 0x5fd6c4, [0.5, 0.2, -0.3], [0.1, 0.35, 0.1]]]);
  const crystal = i => geo('cry' + i % 2, () => { const c = i % 2 ? [0x9fe9ff, 0xd6c0ff, 0xffb3e0] : [0xd6c0ff, 0x9ff5e0, 0x9fe9ff]; return [['ico', c[0], [0, 0.9, 0], [0.42, 1.3, 0.42]], ['ico', c[1], [0.5, 0.6, 0.2], [0.3, 0.9, 0.3], [0, 0, -0.3]], ['ico', c[2], [-0.45, 0.5, -0.1], [0.28, 0.75, 0.28], [0, 0, 0.35]], ['sphLo', 0xffffff, [0.1, 1.6, 0.3], 0.08], ['sph', 0x7f8fe0, [0, 0.08, 0], [1.0, 0.2, 0.8]]]; });
  // 바닷속 터널: 산호 바위 아치 갈비 + 천장 등불 + 옆 반짝 조개
  const trib = i => geo('trib' + i % 3, () => { const c = [0xff9fc4, 0xa493e6, 0x5fd6c4][i % 3], c2 = [0xffc6dc, 0xc7b8ff, 0x9ff0e0][i % 3];
    const P = [['torHalf', c, [0, 0, 0], [6.3, 7.3, 3.4]], ['cyl', 0xffffff, [0, 6.55, 0], [0.03, 0.9, 0.03]], ['sph', 0xfff3b0, [0, 5.95, 0], 0.42], ['sphLo', 0xffffff, [0.12, 6.1, 0.3], 0.1]];
    for (const sx of [1, -1]) P.push(['sph', c2, [6.3 * sx, 0.5, 0], [1.1, 0.9, 1.0]], ['sphLo', 0x8fe9ff, [5.3 * sx, 1.1, 0.2], 0.32], ['sphLo', 0xffe98a, [5.6 * sx, 3.2, 0.25], 0.22], ['sphLo', 0xffffff, [4.7 * sx, 5.1, 0.25], 0.18]);
    return P; });
  const tmouth = () => geo('tmouth', () => { const P = [['torHalf', 0x8f7fd6, [0, 0, 0], [6.9, 8.0, 7.5]], ...star(0xffd23a, 0, 8.6, 0.4, 1.0, 0.3)];
    for (const sx of [1, -1]) P.push(['ico', 0x8198b8, [7.6 * sx, 1.6, 0], [1.9, 2.4, 1.6]], ['cyl', 0xff8fb1, [8.2 * sx, 3.9, 0.4], [0.2, 1.8, 0.2]], ['sphLo', 0xffb3cb, [8.2 * sx, 4.9, 0.4], 0.38], ['cyl', 0xff9f45, [7.0 * sx, 3.7, 0.6], [0.16, 1.3, 0.16]], ['sphLo', 0xffc17a, [7.0 * sx, 4.4, 0.6], 0.3]);
    return P; });
  // 움직이는 장애물(천천히 좌우로 오감): 마을 = 무당벌레 장난감, 바다 = 꽃게
  const moverGeo = theme => theme === 'school'
    ? geo('o_bigball', () => [['sph', 0xff5c5c, [0, 0.62, 0], 0.62], ['sph', 0xffffff, [0, 0.62, 0], [0.63, 0.22, 0.63]], ['sph', 0x4a8df0, [0, 0.62, 0], [0.22, 0.63, 0.63]], ['sphLo', 0xffffff, [-0.25, 1.0, 0.35], 0.1]])   // r8 굴러다니는 큰 박 공(빨강·파랑·흰 띠)
    : theme === 'town'
    ? geo('o_bug', () => { const P = [['sph', 0xff5c5c, [0, 0.38, 0], [0.62, 0.42, 0.56]], ['sph', 0x2b1f57, [0.0, 0.36, 0.42], [0.34, 0.3, 0.26]], ['box', 0x2b1f57, [0, 0.62, -0.05], [0.04, 0.3, 0.9]]];
      for (const sx of [1, -1]) P.push(['sphLo', 0xffffff, [0.14 * sx, 0.46, 0.62], 0.085], ['sphLo', 0x1d1420, [0.14 * sx, 0.46, 0.69], 0.045], ['sphLo', 0x2b1f57, [0.3 * sx, 0.66, 0.1], [0.12, 0.05, 0.12]], ['sphLo', 0x2b1f57, [0.36 * sx, 0.52, -0.25], [0.11, 0.05, 0.11]], ['cyl', 0x2b1f57, [0.1 * sx, 0.8, 0.5], [0.02, 0.3, 0.02], [0.4, 0, -0.3 * sx]], ['sphLo', 0xffd23a, [0.15 * sx, 0.95, 0.56], 0.06], ['cyl', 0x6244be, [0.45 * sx, 0.12, 0.2], [0.14, 0.1, 0.14], [0, 0, Math.PI / 2]], ['cyl', 0x6244be, [0.45 * sx, 0.12, -0.25], [0.14, 0.1, 0.14], [0, 0, Math.PI / 2]]);
      P.push(['sphLo', 0xff9fb0, [0, 0.3, 0.68], [0.1, 0.04, 0.03]]); return P; })
    : geo('o_crab', () => { const P = [['sph', 0xff7b5c, [0, 0.42, 0], [0.62, 0.34, 0.46]], ['sphLo', 0xffb199, [0, 0.36, 0.2], [0.5, 0.24, 0.3]], ['sphLo', 0x8c2a34, [0, 0.34, 0.47], [0.12, 0.05, 0.03]]];
      for (const sx of [1, -1]) { P.push(['cyl', 0xff7b5c, [0.2 * sx, 0.8, 0.2], [0.03, 0.26, 0.03]], ['sphLo', 0xffffff, [0.2 * sx, 0.95, 0.2], 0.1], ['sphLo', 0x1d1420, [0.2 * sx, 0.96, 0.28], 0.05], ['sphLo', 0xff9fb0, [0.33 * sx, 0.36, 0.42], [0.08, 0.04, 0.03]],
        ['cyl', 0xff7b5c, [0.72 * sx, 0.55, 0.2], [0.06, 0.4, 0.06], [0, 0, -0.9 * sx]], ['sph', 0xff5c4a, [0.95 * sx, 0.82, 0.2], [0.2, 0.26, 0.14]], ['sphLo', 0xffb199, [0.95 * sx, 1.0, 0.2], [0.08, 0.12, 0.08]]);
        for (let k = 0; k < 3; k++) P.push(['cyl', 0xff7b5c, [(0.6 + k * 0.06) * sx, 0.2, -0.2 + k * 0.2], [0.04, 0.4, 0.04], [0, 0, -0.7 * sx]]); }
      return P; });
  // 장애물 위 표시: 뛰어넘기 = 노란 ▲, 숙이기 = 하늘색 ▼ (아래 버튼 색과 같음). 조명과 무관하게 또렷이 보이도록 빛 안 받는 재질
  function markGeo(up) {
    const key = up ? 'mk_up' : 'mk_dn'; if (cache[key]) return cache[key];
    const d = up ? 1 : -1, pos = [], col = [], c0 = new THREE.Color(0x2b1f57), c1 = new THREE.Color(up ? 0xffd23a : 0x6ec8ff), c2 = new THREE.Color(0xffffff);
    const tri = (r, z, c, oy) => { pos.push(0, (r + oy) * d, z, d * r * 0.95, (-r * 0.72 + oy) * d, z, -d * r * 0.95, (-r * 0.72 + oy) * d, z); for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b); };
    tri(1.0, 0, c0, 0); tri(0.72, 0.02, c1, -0.04); tri(0.22, 0.04, c2, 0.1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeBoundingSphere(); g.userData.keep = true;
    return cache[key] = g;
  }
  const markMat = () => cache.markMat || (cache.markMat = EK.patch(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  // ---------- 장애물 도형 (kind: low 넘기 / high 숙이기 / block 옆으로 / mover 움직임) ----------
  function obsGeo(theme, kind, v) {
    if (kind === 'mover') return moverGeo(theme);
    // 뛰어넘는 장애물은 스테이지마다 한 가지 모양(마을 = 허들, 바다 = 조개) — 「이건 점프」를 모양으로 외우게
    if (kind === 'low') v = 1;
    if (theme === 'school') {   // r8 운동장: 넘기 = 나무 허들(한 가지), 숙이기 = 림보 막대·장애물 그물, 옆으로 = 고깔콘·콩주머니 바구니 더미
      if (kind === 'low') return geo('o_whurdle', () => { const P = [['cyl', 0xc98a4c, [0.7, 0.42, 0], [0.07, 0.84, 0.07]], ['cyl', 0xc98a4c, [-0.7, 0.42, 0], [0.07, 0.84, 0.07]], ['box', 0xc98a4c, [0.7, 0.05, 0], [0.12, 0.1, 0.7]], ['box', 0xc98a4c, [-0.7, 0.05, 0], [0.12, 0.1, 0.7]], ['box', 0xe8c591, [0, 0.74, 0], [1.5, 0.14, 0.1]], ['box', 0xe8c591, [0, 0.4, 0], [1.5, 0.1, 0.08]]]; for (let i = 0; i < 4; i++) P.push(['box', i % 2 ? 0xff5c5c : 0xffffff, [-0.56 + i * 0.375, 0.74, 0.02], [0.375, 0.15, 0.08]]); return P; });
      if (kind === 'high') return v % 2 ? geo('o_limbo', () => [['cyl', 0xffd23a, [0.8, 1.1, 0], [0.07, 2.2, 0.07]], ['cyl', 0xffd23a, [-0.8, 1.1, 0], [0.07, 2.2, 0.07]], ['sph', 0xff5c5c, [0.8, 2.25, 0], 0.13], ['sph', 0xff5c5c, [-0.8, 2.25, 0], 0.13], ['cyl', 0xe8c591, [0, 1.32, 0], [0.06, 1.7, 0.06], [0, 0, Math.PI / 2]], ['sphLo', 0xff5c5c, [-0.5, 1.32, 0], [0.08, 0.1, 0.08]], ['sphLo', 0x4a8df0, [0, 1.32, 0], [0.08, 0.1, 0.08]], ['sphLo', 0xff5c5c, [0.5, 1.32, 0], [0.08, 0.1, 0.08]]])
        : geo('o_net', () => { const P = [['cyl', 0xffffff, [0.8, 1.1, 0], [0.07, 2.2, 0.07]], ['cyl', 0xffffff, [-0.8, 1.1, 0], [0.07, 2.2, 0.07]], ['cyl', 0x6244be, [0, 2.2, 0], [0.05, 1.7, 0.05], [0, 0, Math.PI / 2]]]; for (let i = 0; i < 5; i++) P.push(['cyl', 0x5fd6c4, [-0.6 + i * 0.3, 1.75, 0], [0.025, 0.9, 0.025]]); for (let k = 0; k < 3; k++) P.push(['cyl', 0x5fd6c4, [0, 1.35 + k * 0.3, 0], [0.025, 1.5, 0.025], [0, 0, Math.PI / 2]]); return P; });
      return v % 2 ? geo('o_cones', () => [['cone', 0xff7b2a, [0, 0.55, 0], [0.42, 1.1, 0.42]], ['box', 0xff7b2a, [0, 0.05, 0], [0.9, 0.1, 0.9]], ['cyl', 0xffffff, [0, 0.55, 0], [0.26, 0.14, 0.26]], ['cone', 0xff7b2a, [0.55, 0.4, 0.3], [0.3, 0.8, 0.3]], ['box', 0xff7b2a, [0.55, 0.04, 0.3], [0.65, 0.08, 0.65]], ['cone', 0xff7b2a, [-0.5, 0.35, -0.25], [0.28, 0.7, 0.28]], ['box', 0xff7b2a, [-0.5, 0.04, -0.25], [0.6, 0.08, 0.6]]])
        : geo('o_beanpile', () => { const P = [['cyl', 0xc98a4c, [0, 0.45, 0], [0.62, 0.9, 0.62]], ['cyl', 0xb5763f, [0, 0.92, 0], [0.7, 0.08, 0.7]]]; for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = k < 6 ? 0.36 : 0.15, y = k < 6 ? 1.0 : 1.22; P.push(['sphLo', k % 3 === 0 ? 0xff5c5c : k % 3 === 1 ? 0x4a8df0 : 0xffffff, [Math.cos(a) * r, y, Math.sin(a) * r], [0.2, 0.14, 0.2]]); } return P; });
    }
    if (theme === 'town') {
      if (kind === 'low') {
        if (v % 3 === 0) return geo('o_gift', () => [['box', 0xff8fb1, [0, 0.45, 0], [1.0, 0.9, 1.0]], ['box', 0xffd23a, [0, 0.45, 0], [1.03, 0.92, 0.22]], ['box', 0xffd23a, [0, 0.45, 0], [0.22, 0.92, 1.03]], ['sph', 0xffd23a, [0.2, 1.0, 0], [0.22, 0.14, 0.14]], ['sph', 0xffd23a, [-0.2, 1.0, 0], [0.22, 0.14, 0.14]]]);
        if (v % 3 === 1) return geo('o_hurdle', () => { const P = [['cyl', 0x6244be, [0.65, 0.4, 0], [0.07, 0.8, 0.07]], ['cyl', 0x6244be, [-0.65, 0.4, 0], [0.07, 0.8, 0.07]], ['sph', 0xffd23a, [0.65, 0.85, 0], 0.11], ['sph', 0xffd23a, [-0.65, 0.85, 0], 0.11]]; for (let i = 0; i < 6; i++) P.push(['box', i % 2 ? 0xffffff : 0xff7b6b, [-0.54 + i * 0.216, 0.62, 0], [0.216, 0.24, 0.12]]); return P; });
        return geo('o_duck', () => [['cyl', 0x6ec8ff, [0, 0.04, 0], [0.75, 0.06, 0.75]], ['cyl', 0xbfeaff, [0, 0.06, 0], [0.55, 0.06, 0.55]], ['sph', 0xffd23a, [0, 0.42, 0], [0.4, 0.34, 0.5]], ['sph', 0xffd23a, [0, 0.82, 0.22], 0.27], ['cone', 0xff9f45, [0, 0.78, 0.52], [0.1, 0.2, 0.1], [Math.PI / 2, 0, 0]], ['sphLo', 0x1d1420, [0.13, 0.9, 0.42], 0.04], ['sphLo', 0x1d1420, [-0.13, 0.9, 0.42], 0.04], ['cone', 0xffd23a, [0, 0.5, -0.5], [0.16, 0.3, 0.1], [-0.9, 0, 0]]]);
      }
      if (kind === 'high') return geo('o_arch', () => { const P = [['cyl', 0xffffff, [0.76, 1.1, 0], [0.07, 2.2, 0.07]], ['cyl', 0xffffff, [-0.76, 1.1, 0], [0.07, 2.2, 0.07]], ['sph', 0xff8fb1, [0.76, 2.25, 0], 0.13], ['sph', 0xff8fb1, [-0.76, 2.25, 0], 0.13]]; const c = [0xff7b6b, 0xffd23a, 0x5fd6c4, 0x6ec8ff]; for (let i = 0; i < 4; i++) P.push(['box', c[i], [0, 1.32 + i * 0.17, 0], [1.5, 0.17, 0.16]]); P.push(['ico', 0xffffff, [0, 1.66, 0.12], [0.2, 0.2, 0.06]]); return P; });
      return v % 2 ? geo('o_blocks', () => [['box', 0x6ec8ff, [0, 0.55, 0], [1.3, 1.1, 1.1]], ['box', 0xffd23a, [0.1, 1.55, 0], [1.1, 0.9, 1.0], [0, 0.3, 0]], ['box', 0xff8fb1, [-0.05, 2.35, 0], [0.8, 0.7, 0.8], [0, -0.2, 0]], ['sph', 0xffffff, [0, 0.55, 0.56], [0.3, 0.3, 0.04]], ['ico', 0x6244be, [0.1, 1.55, 0.52], [0.25, 0.25, 0.05]]])
        : geo('o_planter', () => [['cyl', 0xff9f45, [0, 0.45, 0], [0.62, 0.9, 0.62]], ['cyl', 0xffb668, [0, 0.92, 0], [0.7, 0.14, 0.7]], ['sph', 0x5ccc6e, [0, 1.75, 0], [0.85, 0.85, 0.8]], ['sphLo', 0x77d985, [0.45, 1.4, 0.3], 0.5], ['sphLo', 0xff8fb1, [0.3, 2.3, 0.5], 0.13], ['sphLo', 0xffffff, [-0.4, 1.9, 0.6], 0.12], ['sphLo', 0xffd23a, [0, 1.5, 0.78], 0.12]]);
    }
    if (kind === 'low') return v % 2 ? geo('o_clam', () => [['sph', 0xffb3cb, [0, 0.25, 0], [0.75, 0.28, 0.6]], ['sph', 0xffd0df, [0, 0.62, -0.3], [0.75, 0.3, 0.55], [-0.75, 0, 0]], ['sph', 0xffffff, [0, 0.48, 0.05], 0.22], ['sphLo', 0x1d1420, [0.2, 0.3, 0.55], 0.045], ['sphLo', 0x1d1420, [-0.2, 0.3, 0.55], 0.045]])
      : geo('o_scoral', () => { const P = [['sph', 0x6f86a8, [0, 0.12, 0], [0.8, 0.25, 0.7]]]; const c = [0xff9f45, 0xffc17a]; for (let k = 0; k < 5; k++) { const x = -0.5 + k * 0.25, h = 0.5 + (k % 2) * 0.35; P.push(['cyl', c[k % 2], [x, h / 2 + 0.1, (k % 2) * 0.2 - 0.1], [0.12, h, 0.12]], ['sphLo', 0xffe0b0, [x, h + 0.1, (k % 2) * 0.2 - 0.1], 0.16]); } return P; });
    if (kind === 'high') return geo('o_karch', () => { const P = []; for (const sx of [1, -1]) for (let k = 0; k < 5; k++) P.push(['sphLo', k % 2 ? 0x3fbf7a : 0x2faa6a, [0.76 * sx + Math.sin(k * 1.3) * 0.08, 0.25 + k * 0.42, 0], [0.16, 0.3, 0.1]]); for (let i = 0; i < 7; i++) { const u = i / 6, x = -0.76 + u * 1.52; P.push(['sphLo', i % 2 ? 0x49c987 : 0x2faa6a, [x, 1.5 + Math.sin(u * Math.PI) * 0.35, 0], [0.2, 0.2, 0.14]]); } P.push(['sphLo', 0xff8fb1, [0, 1.62, 0.14], 0.12], ['sphLo', 0xffd23a, [0.4, 1.56, 0.14], 0.1], ['sphLo', 0xffffff, [-0.4, 1.56, 0.14], 0.1]); return P; });
    return geo('o_brock' + v % 2, () => [['ico', v % 2 ? 0x8f7fd6 : 0x6f86a8, [0, 1.0, 0], [0.82, 1.1, 0.7]], ['ico', v % 2 ? 0xa493e6 : 0x8198b8, [0.15, 2.05, 0], [0.55, 0.6, 0.5]], ['cyl', 0xff8fb1, [-0.45, 2.1, 0.2], [0.1, 0.8, 0.1]], ['sphLo', 0xffb3cb, [-0.45, 2.55, 0.2], 0.17], ['cyl', 0xff9f45, [0.5, 1.6, 0.3], [0.09, 0.7, 0.09]], ['sphLo', 0xffc17a, [0.5, 2.0, 0.3], 0.15], ['sphLo', 0xffd23a, [0, 1.2, 0.68], [0.25, 0.25, 0.06]], ['sphLo', 0x1d1420, [0.2, 1.75, 0.5], 0.05], ['sphLo', 0x1d1420, [-0.1, 1.75, 0.55], 0.05]]);
  }
  // 별: 가운데 원판 + 뾰족한 팔 5개
  function star(c, x, y, z, r, d) { const P = [['cyl', c, [x, y, z], [r * 0.5, d, r * 0.5], [Math.PI / 2, 0, 0]]]; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; P.push(['cone', c, [x - Math.sin(a) * r * 0.62, y + Math.cos(a) * r * 0.62, z], [r * 0.34, r * 0.8, d * 0.5], [0, 0, a]]); } return P; }
  EK.starParts = star;
  const noteGeo = () => geo('note', () => [['sph', 0xff6fa5, [-0.12, 0, 0], [0.24, 0.19, 0.19], [0, 0, 0.3]], ['box', 0xff6fa5, [0.08, 0.38, 0], [0.07, 0.78, 0.07]], ['box', 0xff6fa5, [0.24, 0.66, 0], [0.34, 0.2, 0.07], [0, 0, -0.35]]]);

  function tex(key, w, h, draw, rx, ry) {
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;   // 화질(갤럭시탭): 4 → 16(기기 최대로 잘림) — 먼 길·바닥 무늬가 뭉개지지 않게
    return cache[key] = t;
  }

  // ---------- 세계 만들기 ----------
  EK.World = function (scene, themeId, chart, stage) {
    const W = this, th = TH[themeId], R = EK.rng(themeId === 'town' ? 101 : 202);
    W.theme = themeId; W.root = new THREE.Group(); scene.add(W.root); W.chart = chart; W.anim = []; W.props = []; W.gates = []; W.scene = scene;
    const per = chart ? chart.per : 0.375, beatD = SP * per, off = stage ? stage.offset : 0;
    const trackEnd = chart ? -SP * chart.finishT : -400;
    W.finishZ = trackEnd; W.stageZ = trackEnd - 22; W.stopZ = W.stageZ + 2.2;
    // 풍경 구역: 곡 시간으로 나뉨(타이틀 화면은 구역 0 하나)
    W.zoneT = chart ? chart.zones.map(z => z.t) : [-99];
    const zoneOf = W.zoneOf = t => { let i = 0; for (let k = 1; k < W.zoneT.length; k++) if (t >= W.zoneT[k]) i = k; return i; };
    W.tunnels = chart ? chart.tunnels.map(u => ({ z0: -SP * u.t0, z1: -SP * u.t1, t0: u.t0, t1: u.t1 })) : [];
    const inTunnel = z => W.tunnels.some(u => z < u.z0 + 8 && z > u.z1 - 8);

    const z0 = th.zones[0];
    scene.fog = new THREE.Fog(z0.fog, th.fogN, th.fogF); scene.background = new THREE.Color(z0.fog);
    W.hemi = new THREE.HemisphereLight(z0.hemi[0], z0.hemi[1], th.hemiI); W.root.add(W.hemi);
    W.sun = new THREE.DirectionalLight(z0.sun, th.sunI); W.sun.position.set(4, 10, 6); W.root.add(W.sun);
    W.zc = th.zones.map(z => ({ fog: new THREE.Color(z.fog), h0: new THREE.Color(z.hemi[0]), h1: new THREE.Color(z.hemi[1]), sun: new THREE.Color(z.sun) }));

    // 하늘(위에서 아래로 번지는 색) — 카메라를 따라다님. 구역마다 한 장씩, 구역이 바뀔 때 서서히 겹쳐 바뀜
    W.skies = [];
    const nz = chart ? W.zoneT.length : 1;
    for (let zi = 0; zi < nz; zi++) { const zn = th.zones[zi];
      const sg = new THREE.SphereGeometry(300 - zi, 20, 12), n = sg.attributes.position.count, col = new Float32Array(n * 3), c0 = new THREE.Color(zn.sky[0]), c1 = new THREE.Color(zn.sky[1]), c2 = new THREE.Color(zn.fog), cc = new THREE.Color();
      for (let i = 0; i < n; i++) { const y = sg.attributes.position.getY(i) / 300; if (y > 0.25) cc.lerpColors(c1, c0, EK.clamp((y - 0.25) / 0.6, 0, 1)); else cc.lerpColors(c2, c1, EK.clamp((y + 0.02) / 0.27, 0, 1)); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
      sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, transparent: zi > 0, opacity: zi ? 0 : 1 })); m.renderOrder = -10 + zi; m.visible = zi === 0; W.root.add(m); W.skies.push(m); }
    W.sky = W.skies[0];

    // 바닥 타일 (길 + 양옆) — 구역마다 색이 다른 재질
    const TL = beatD * 8;
    W.roadMats = []; W.groundMats = [];
    for (let zi = 0; zi < nz; zi++) { const zn = th.zones[zi], key = themeId + zi;
      const roadTex = tex('road_' + key, 256, 512, (g, w, h) => {
        if (themeId === 'school') {   // r8: 황토 흙 트랙 + 흰 석회 줄 3레인(줄 경계 2개 + 바깥 선) + 작은 돌·발자국
          g.fillStyle = zn.walk; g.fillRect(0, 0, w, h); g.fillStyle = zn.road; g.fillRect(w * 0.1, 0, w * 0.8, h);
          g.fillStyle = 'rgba(120,80,40,0.18)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 3 + Math.random() * 7, 2 + Math.random() * 4, Math.random() * 3, 0, 7); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,0.9)'; for (const x of [0.105, 0.402, 0.598, 0.895]) g.fillRect(w * x - 4, 0, 8, h);
          g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 2; k++) g.fillRect(w * 0.1, h * (k / 2) + h * 0.005, w * 0.8, h * 0.016);
          g.fillStyle = 'rgba(90,60,30,0.22)'; for (let k = 0; k < 2; k++) for (let l = 0; l < 3; l++) { const cx = w * (0.25 + l * 0.25) + (l % 2 ? 10 : -10), cy = h * (k / 2 + 0.25 + (l % 2) * 0.12); g.beginPath(); g.ellipse(cx, cy, 7, 11, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 16, cy + 18, 7, 11, 0, 0, 7); g.fill(); }
          return; }
        g.fillStyle = zn.walk; g.fillRect(0, 0, w, h);
        g.fillStyle = zn.edge; g.fillRect(w * 0.1, 0, w * 0.8, h);
        g.fillStyle = zn.road; g.fillRect(w * 0.125, 0, w * 0.75, h);
        g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(w * (0.15 + Math.random() * 0.7), Math.random() * h, 2 + Math.random() * 5, 0, 7); g.fill(); }
        g.fillStyle = th.dash; for (const x of [0.402, 0.598]) for (let k = 0; k < 2; k++) { g.beginPath(); if (g.roundRect) g.roundRect(w * x - 5, h * (k / 2) + h * 0.07, 10, h * 0.18, 5); else g.rect(w * x - 5, h * (k / 2) + h * 0.07, 10, h * 0.18); g.fill(); }
        // r3: 길 무늬를 진하게 — 박자마다 가로 띠, 줄마다 별·발자국(가까운 길이 텅 비어 보이지 않게)
        g.globalAlpha = 0.5; g.fillStyle = zn.edge; for (let k = 0; k < 2; k++) g.fillRect(w * 0.125, h * (k / 2) + h * 0.005, w * 0.75, h * 0.022);
        g.globalAlpha = 0.34; for (let k = 0; k < 2; k++) for (let l = 0; l < 3; l++) { const cx = w * (0.25 + l * 0.25), cy = h * (k / 2 + 0.25 + (l % 2) * 0.12), r = 17; g.fillStyle = (k + l) % 2 ? zn.edge : zn.walk; g.beginPath();
          if (themeId === 'town') { for (let q = 0; q < 10; q++) { const a = q / 10 * 6.283 - 1.571, rr = q % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 1.6); } }
          else g.ellipse(cx, cy, r * 0.8, r * 1.3, 0, 0, 7);
          g.fill(); }
        g.globalAlpha = 1;
        g.fillStyle = themeId === 'town' ? 'rgba(98,68,190,0.5)' : 'rgba(255,255,255,0.6)'; for (let k = 0; k < 8; k++) { g.beginPath(); g.arc(w * 0.05, h * (k + 0.5) / 8, 6, 0, 7); g.fill(); g.beginPath(); g.arc(w * 0.95, h * (k + 0.5) / 8, 6, 0, 7); g.fill(); }
      }, 1, 4);
      const groundTex = tex('ground_' + key, 256, 256, (g, w, h) => {
        g.fillStyle = zn.ground; g.fillRect(0, 0, w, h); g.fillStyle = zn.ground2;
        for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 22, 5 + Math.random() * 10, 0, 0, 7); g.fill(); }
        g.fillStyle = themeId === 'ocean' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.55)'; for (let i = 0; i < 24; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.2, 0, 7); g.fill(); }
        if (themeId === 'school') { g.fillStyle = 'rgba(210,154,84,0.5)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 16, 5 + Math.random() * 6, 0, 0, 7); g.fill(); } }   // r8 운동장 가장자리 흙 자국
        if (themeId === 'town' || zi === 2) { g.fillStyle = zi === 2 ? 'rgba(255,255,255,0.75)' : 'rgba(255,214,58,0.8)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2.4, 0, 7); g.fill(); } }
      }, 8, 6);
      W.roadMats.push(cache['roadMat_' + key] || (cache['roadMat_' + key] = EK.patch(new THREE.MeshStandardMaterial({ map: roadTex, color: 0xe6e6e6, roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0 }))));
      W.groundMats.push(cache['gMat_' + key] || (cache['gMat_' + key] = EK.patch(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 })))); }
    W.roadMat = W.roadMats[0];
    const RW = LW * 3 + 1.6 + 2.0, rg = new THREE.PlaneGeometry(RW, TL, 1, 20); rg.rotateX(-Math.PI / 2);
    const gg = new THREE.PlaneGeometry(90, TL, 6, 20); gg.rotateX(-Math.PI / 2);
    W.tiles = []; W.TL = TL;
    for (let i = 0; i < 4; i++) { const t = new THREE.Group(); const r = new THREE.Mesh(rg, W.roadMats[0]); r.position.y = 0.01; const a = new THREE.Mesh(gg, W.groundMats[0]); a.position.x = -(45 + RW / 2 - 0.05); const b = new THREE.Mesh(gg, W.groundMats[0]); b.position.x = 45 + RW / 2 - 0.05; t.add(r, a, b); t.userData.m = [r, a, b]; t.userData.zi = 0; r.frustumCulled = a.frustumCulled = b.frustumCulled = false; W.root.add(t); W.tiles.push(t); }

    // 지나가는 풍경 (구역마다 소품 묶음이 다름)
    const add = (g, x, y, z, s, ry, kind, mat) => { const m = new THREE.Mesh(g, mat || EK.MAT.vc); m.position.set(x, y, z); m.scale.setScalar(s); m.rotation.y = ry || 0; m.visible = false; if (kind) { m.userData.k = kind; m.userData.s = s; m.userData.y = y; m.userData.x = x; m.userData.p = R() * 6.28; W.anim.push(m); } else { m.matrixAutoUpdate = false; m.updateMatrix(); } W.root.add(m); W.props.push(m); return m; };
    const zEnd = trackEnd - 70; let i = 0;
    for (let z = 34; z > zEnd; z -= 6.5) {
      const nearStage = z < W.stageZ + 16 && z > W.stageZ - 14, zi = zoneOf(-z / SP), tun = inTunnel(z);
      for (const sd of [1, -1]) {
        i++; const r = R(), jz = z + (R() - 0.5) * 3, face = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
        if (themeId === 'school') {   // r8 운동장: 트랙 옆은 만국기 기둥·콩주머니 바구니·나팔 스피커, 그 뒤 플라타너스·은행나무·철봉·정글짐·구름사다리·시소·운동회 천막
          if (zi === 0) {
            if (!nearStage) { if (r < 0.22) add(flagpole(i), sd * (5.4 + R() * 0.6), 0, jz, 0.9 + R() * 0.3, sd > 0 ? Math.PI : 0); else if (r < 0.34) add(beanbag(i), sd * (5.6 + R() * 1.2), 0, jz, 0.9, R() * 6); else if (r < 0.42) add(horn(), sd * 5.6, 0, jz, 1, sd > 0 ? Math.PI : 0); else if (r < 0.55) add(bush(i), sd * (5.6 + R() * 1.2), 0, jz, 0.8 + R() * 0.4, R() * 6); }
            const r2 = R(); if (r2 < 0.3) add(plane(i), sd * (9 + R() * 4), 0, jz, 1.0 + R() * 0.5, R() * 6); else if (r2 < 0.5) add(ginkgo(i), sd * (8.5 + R() * 4), 0, jz, 1.0 + R() * 0.5, R() * 6); else if (r2 < 0.62) add(bars(), sd * (9 + R() * 2), 0, jz, 1.1, sd > 0 ? Math.PI / 2 : -Math.PI / 2); else if (r2 < 0.72) add(jungle(), sd * (10 + R() * 2), 0, jz, 1.0, R() * 6); else if (r2 < 0.8) add(seesaw(), sd * (9 + R() * 2), 0, jz, 1.0, R() * 6);
            if (R() < 0.45) add(plane(i + 1), sd * (16 + R() * 9), 0, jz, 1.4 + R() * 0.8, 0);
          } else if (zi === 1) { // 놀이터 옆: 미끄럼틀·정글짐·구름사다리·시소·꽃밭
            if (!nearStage) { if (r < 0.2) add(flagpole(i), sd * (5.4 + R() * 0.6), 0, jz, 0.9 + R() * 0.3, sd > 0 ? Math.PI : 0); else if (r < 0.36) add(flowers(i), sd * (5.6 + R() * 1.0), 0, jz, 0.9 + R() * 0.3, R() * 6); else if (r < 0.46) add(beanbag(i), sd * (5.6 + R() * 1.2), 0, jz, 0.9, R() * 6); else if (r < 0.54) add(bench(), sd * 5.7, 0, jz, 1, -face); }
            const r2 = R(); if (r2 < 0.2) add(playset(), sd * (9.5 + R() * 2.5), 0, jz, 1.1, sd > 0 ? Math.PI : 0); else if (r2 < 0.38) add(jungle(), sd * (10 + R() * 2), 0, jz, 1.0, R() * 6); else if (r2 < 0.54) add(ladder(), sd * (9.5 + R() * 2), 0, jz, 1.0, sd > 0 ? Math.PI / 2 : -Math.PI / 2); else if (r2 < 0.66) add(seesaw(), sd * (9 + R() * 2), 0, jz, 1.0, R() * 6); else if (r2 < 0.8) add(bars(), sd * (9 + R() * 2), 0, jz, 1.1, sd > 0 ? Math.PI / 2 : -Math.PI / 2); else add(ginkgo(i), sd * (9 + R() * 4), 0, jz, 1.0 + R() * 0.5, R() * 6);
            if (R() < 0.5) add(plane(i + 1), sd * (16 + R() * 9), 0, jz, 1.4 + R() * 0.8, 0);
          } else {               // 구령대 앞: 운동회 천막·만국기·나팔 스피커·풍선
            if (!nearStage) { if (r < 0.3) add(flagpole(i), sd * (5.4 + R() * 0.6), 0, jz, 0.9 + R() * 0.3, sd > 0 ? Math.PI : 0); else if (r < 0.42) add(horn(), sd * 5.6, 0, jz, 1, sd > 0 ? Math.PI : 0); else if (r < 0.55) add(balloons(i), sd * (5.6 + R() * 1.3), 0, jz, 1.0 + R() * 0.3, R() * 6, 'sway'); else if (r < 0.64) add(beanbag(i), sd * (5.6 + R() * 1.2), 0, jz, 0.9, R() * 6); }
            const r2 = R(); if (r2 < 0.45) add(canopy(i), sd * (9.5 + R() * 2), 0, jz, 1.1 + R() * 0.2, -face); else if (r2 < 0.65) add(plane(i), sd * (9 + R() * 4), 0, jz, 1.0 + R() * 0.5, R() * 6); else if (r2 < 0.8) add(ginkgo(i), sd * (9 + R() * 4), 0, jz, 1.0 + R() * 0.5, R() * 6);
            if (R() < 0.3) add(balloons(i + 1), sd * (14 + R() * 8), 0, jz, 1.8, 0, 'sway'); else if (R() < 0.4) add(plane(i + 1), sd * (16 + R() * 9), 0, jz, 1.4 + R() * 0.8, 0);
          }
        } else if (themeId === 'town') {
          if (zi === 0) {        // 마을: 집이 줄지어 있음
            if (!nearStage) { if (r < 0.3) add(bush(i), sd * (5.4 + R() * 1.2), 0, jz, 0.8 + R() * 0.5, R() * 6); else if (r < 0.45) add(lamp(), sd * 5.3, 0, jz, 1, sd > 0 ? Math.PI : 0); else if (r < 0.55) add(balloons(i), sd * (5.6 + R() * 1.5), 0, jz, 0.9 + R() * 0.3, R() * 6, 'sway'); }
            const r2 = R(); if (r2 < 0.3) add(tree(i), sd * (8.5 + R() * 4), 0, jz, 0.9 + R() * 0.6, R() * 6); else if (r2 < 0.85) add(house(i), sd * (10.5 + R() * 3.5), 0, jz, 0.95 + R() * 0.35, face);
            if (R() < 0.3) add(tree(i + 1), sd * (17 + R() * 9), 0, jz, 1.3 + R() * 0.9, 0);
            if (R() < 0.05) add(tower(), sd * (16 + R() * 6), 0, jz, 1.2, face);
          } else if (zi === 1) { // 공원: 나무·꽃밭·벤치·미끄럼틀
            if (!nearStage) { if (r < 0.3) add(flowers(i), sd * (5.5 + R() * 1.0), 0, jz, 0.9 + R() * 0.4, R() * 6); else if (r < 0.5) add(bush(i), sd * (5.4 + R() * 1.2), 0, jz, 0.8 + R() * 0.5, R() * 6); else if (r < 0.62) add(bench(), sd * 5.6, 0, jz, 1, -face); else if (r < 0.7) add(balloons(i), sd * (5.8 + R()), 0, jz, 0.9, R() * 6, 'sway'); }
            const r2 = R(); if (r2 < 0.7) add(tree(i), sd * (8 + R() * 5), 0, jz, 1.0 + R() * 0.8, R() * 6); else if (r2 < 0.84) add(playset(), sd * (9.5 + R() * 2.5), 0, jz, 1.1, sd > 0 ? Math.PI : 0); else add(flowers(i + 1), sd * (8 + R() * 3), 0, jz, 1.4, R() * 6);
            if (R() < 0.55) add(tree(i + 1), sd * (15 + R() * 10), 0, jz, 1.4 + R() * 1.0, 0);
          } else {               // 무대 앞: 풍선·천막·스피커·깃발 등불(노을 축제)
            if (!nearStage) { if (r < 0.34) add(balloons(i), sd * (5.6 + R() * 1.3), 0, jz, 1.0 + R() * 0.3, R() * 6, 'sway'); else if (r < 0.6) add(lamp(), sd * 5.3, 0, jz, 1.1, sd > 0 ? Math.PI : 0); else if (r < 0.7) add(spk(), sd * 6.2, 0, jz, 0.8, -face); }
            const r2 = R(); if (r2 < 0.42) add(tent(i), sd * (9.5 + R() * 3), 0, jz, 1.1 + R() * 0.3, -face); else if (r2 < 0.62) add(tree(i), sd * (9 + R() * 4), 0, jz, 1.0 + R() * 0.5, R() * 6); else if (r2 < 0.8) add(house(i), sd * (12 + R() * 3), 0, jz, 1.0 + R() * 0.3, face);
            if (R() < 0.12) add(tower(), sd * (17 + R() * 6), 0, jz, 1.25, face); else if (R() < 0.3) add(balloons(i + 1), sd * (14 + R() * 8), 0, jz, 1.8, 0, 'sway');
          }
        } else {
          const nearOk = !nearStage && !tun;
          if (zi === 0) {        // 얕은 바다: 모래·조개·작은 바위, 드문드문 다시마
            if (nearOk) { if (r < 0.34) add(shell(i), sd * (5.4 + R() * 1.6), 0, jz, 0.8 + R() * 0.5, R() * 6); else if (r < 0.5) add(rock(i), sd * (5.9 + R() * 1.5), 0, jz, 0.5 + R() * 0.3, R() * 6); else if (r < 0.6) add(kelp(i), sd * (5.5 + R() * 1.6), 0, jz, 0.7 + R() * 0.3, R() * 6, 'kelp'); else if (r < 0.66) add(chest(), sd * (5.8 + R()), 0, jz, 0.9, sd > 0 ? -1.2 : 1.2); }
            const r2 = R(); if (r2 < 0.3) add(rock(i), sd * (9 + R() * 6), 0, jz, 1.0 + R() * 0.8, R() * 6); else if (r2 < 0.5) add(coral(i), sd * (8.5 + R() * 5), 0, jz, 0.8 + R() * 0.5, R() * 6); else if (r2 < 0.7) add(kelp(i), sd * (8 + R() * 6), 0, jz, 1.0 + R() * 0.5, R() * 6, 'kelp'); else if (r2 < 0.85) add(shell(i + 1), sd * (8 + R() * 4), 0, jz, 1.6, R() * 6);
            if (R() < 0.5) add(fish(i), sd * (7.5 + R() * 7), 2.5 + R() * 4, jz, 0.7 + R() * 0.5, sd > 0 ? Math.PI : 0, 'fish');
          } else if (zi === 1) { // 산호 숲: 크고 빽빽한 산호·다시마·해파리
            if (nearOk) { if (r < 0.34) add(kelp(i), sd * (5.3 + R() * 1.6), 0, jz, 0.8 + R() * 0.5, R() * 6, 'kelp'); else if (r < 0.56) add(coral(i), sd * (5.9 + R() * 1.2), 0, jz, 0.55 + R() * 0.25, R() * 6); else if (r < 0.62) add(chest(), sd * (5.8 + R()), 0, jz, 0.9, sd > 0 ? -1.2 : 1.2); }
            const r2 = R(); if (r2 < 0.65) add(coral(i), sd * (8.2 + R() * 5), 0, jz, 1.1 + R() * 1.0, R() * 6); else if (r2 < 0.8) add(rock(i), sd * (9 + R() * 6), 0, jz, 1.3 + R() * 1.2, R() * 6); else add(kelp(i), sd * (8.2 + R() * 6), 0, jz, 1.2 + R() * 0.8, R() * 6, 'kelp');
            if (!tun && R() < 0.3) add(jelly(i), sd * (7.5 + R() * 6), 4.5 + R() * 4, jz, 0.8 + R() * 0.6, sd > 0 ? -0.6 : 0.6, 'bob');
            if (!tun && R() < 0.4) add(fish(i), sd * (7.5 + R() * 7), 2.5 + R() * 5, jz, 0.7 + R() * 0.6, sd > 0 ? Math.PI : 0, 'fish');
            if (R() < 0.4) add(coral(i + 1), sd * (17 + R() * 9), 0, jz, 2.2 + R() * 1.4, 0);
          } else {               // 반짝이는 깊은 바다: 빛나는 수정·빛나는 해파리
            if (nearOk) { if (r < 0.36) add(crystal(i), sd * (5.5 + R() * 1.4), 0, jz, 0.7 + R() * 0.4, R() * 6, null, EK.MAT.glow); else if (r < 0.52) add(kelp(i), sd * (5.4 + R() * 1.6), 0, jz, 0.8 + R() * 0.4, R() * 6, 'kelp'); }
            const r2 = R(); if (r2 < 0.38) add(crystal(i), sd * (8.5 + R() * 5), 0, jz, 1.4 + R() * 1.2, R() * 6, null, EK.MAT.glow); else if (r2 < 0.7) add(coral(i * 3 + 2), sd * (8.5 + R() * 5), 0, jz, 1.2 + R() * 0.9, R() * 6); else if (r2 < 0.85) add(rock(i + 1), sd * (9 + R() * 6), 0, jz, 1.3 + R() * 1.0, R() * 6);
            if (!tun && R() < 0.6) add(jelly(i), sd * (7.5 + R() * 7), 4 + R() * 5, jz, 0.9 + R() * 0.7, sd > 0 ? -0.6 : 0.6, 'bob', EK.MAT.glow);
            if (!tun && R() < 0.25) add(fish(i), sd * (8 + R() * 7), 2.5 + R() * 5, jz, 0.7 + R() * 0.5, sd > 0 ? Math.PI : 0, 'fish');
            if (R() < 0.4) add(crystal(i + 1), sd * (17 + R() * 9), 0, jz, 3.0 + R() * 1.6, 0, null, EK.MAT.glow);
          }
        }
      }
    }
    // 바닷속 터널: 들머리·날머리 큰 아치 + 7m마다 갈비 아치(등불)
    for (const u of W.tunnels) { let k = 0;
      add(tmouth(), 0, 0, u.z0 + 3, 1, 0); add(tmouth(), 0, 0, u.z1 - 3, 1, Math.PI);
      for (let z = u.z0 - 2; z > u.z1; z -= 7) add(trib(k++), 0, 0, z, 1, 0); }
    // 박자에 맞춰 통통 뛰는 깃발 문 (8마디마다) + 풍경이 바뀌는 자리의 큰 문
    if (chart) {
      for (let b = 16; SP * (off + b * per) < -trackEnd - 30; b += 32) { const z = -SP * (off + b * per); if (inTunnel(z)) continue; const m = new THREE.Mesh(gate(themeId), EK.MAT.vc); m.position.set(0, 0, z); m.visible = false; W.root.add(m); W.gates.push(m); }
      for (let k = 1; k < W.zoneT.length; k++) { const z = -SP * W.zoneT[k]; if (inTunnel(z) || W.gates.some(g => Math.abs(g.position.z - z) < 12)) continue; const m = new THREE.Mesh(gate(themeId), EK.MAT.vc); m.position.set(0, 0, z); m.userData.big = 1.18; m.visible = false; W.root.add(m); W.gates.push(m); }
    }

    // 장애물·음표 (장애물 위에 ▲/▼ 표시)
    W.obs = []; W.notes = [];
    if (chart) {
      for (const o of chart.obs) { const m = new THREE.Mesh(obsGeo(themeId, o.kind, o.v), EK.MAT.vc); m.position.set((o.lane - 1) * LW, 0, -SP * o.t); m.visible = false; const sh = EK.blob(0.7, 0.5); m.add(sh);
        if (o.kind !== 'block') { const up = o.kind !== 'high', mk = new THREE.Mesh(markGeo(up), markMat()); mk.scale.setScalar(up ? 0.42 : 0.46); mk.position.set(0, up ? (o.kind === 'mover' ? 2.0 : 1.95) : 3.0, 0.3); mk.userData.y = mk.position.y; m.add(mk); o.mk = mk; }
        W.root.add(m); o.mesh = m; W.obs.push(o); }
      for (const nt of chart.notes) { const m = new THREE.Mesh(noteGeo(), EK.MAT.gloss); m.position.set((nt.lane - 1) * LW, 1.1, -SP * nt.t); m.scale.setScalar(1.25); m.visible = false; W.root.add(m); nt.mesh = m; W.notes.push(nt); }
    }
    // 구슬 (한 번에 그림)
    const om = EK.patch(new THREE.MeshStandardMaterial({ color: th.orb, emissive: th.orbE, emissiveIntensity: 0.55, roughness: 0.2 }));
    W.orbMesh = new THREE.InstancedMesh(EK.G.sph, om, 110); W.orbMesh.frustumCulled = false; W.orbMesh.count = 0; W.root.add(W.orbMesh);
    // r3 타이틀: 길 위에 굽이치는 구슬 줄과 음표(「구슬을 모으며 달리는 게임」이 첫 화면에서 보이게)
    W.deco = [];
    if (!chart) {
      for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(EK.G.sph, om); m.position.set(Math.sin(k * 0.9 + 0.6) * 0.5, 0.3, 0.75 + k * 0.24); m.scale.setScalar(0.105); m.userData.y = 0.3; m.userData.p = k; W.root.add(m); W.deco.push(m); }
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(noteGeo(), EK.MAT.gloss); m.position.set(sx * 0.95, 0.45, 1.5 + sx * 0.2); m.scale.setScalar(0.42); m.userData.y = 0.5; m.userData.p = sx * 2; m.userData.note = 1; W.root.add(m); W.deco.push(m); }
    }
    const hm = EK.patch(new THREE.MeshBasicMaterial({ color: themeId === 'town' ? 0xfff2a0 : 0xd8fbff, transparent: true, opacity: 0.32, depthWrite: false }));
    W.heartPool = []; for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(geo('heart', () => [['sph', 0xff5c8a, [0.17, 0.1, 0], [0.25, 0.25, 0.17]], ['sph', 0xff5c8a, [-0.17, 0.1, 0], [0.25, 0.25, 0.17]], ['cone', 0xff5c8a, [0, -0.2, 0], [0.37, 0.46, 0.15], [Math.PI, 0, 0]], ['sphLo', 0xffffff, [-0.2, 0.2, 0.14], 0.05]]), EK.MAT.gloss); m.visible = false; W.root.add(m); W.heartPool.push(m); }
    W.haloMesh = new THREE.InstancedMesh(EK.G.sphLo, hm, 110); W.haloMesh.frustumCulled = false; W.haloMesh.count = 0; W.haloMesh.renderOrder = 2; W.root.add(W.haloMesh);
    // 부스트 속도선 (길 양옆으로 뒤로 흐르는 흰 줄)
    W.LN = 46; W.lineMesh = new THREE.InstancedMesh(EK.G.box, EK.patch(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })), W.LN); W.lineMesh.frustumCulled = false; W.lineMesh.count = 0; W.lineMesh.renderOrder = 2; W.root.add(W.lineMesh);
    { const lc = [0xffffff, 0xfff3b0, 0xffc6dc, 0xbff5ea, 0xffffff, 0xdcd0ff], c = new THREE.Color(); for (let k = 0; k < W.LN; k++) W.lineMesh.setColorAt(k, c.set(lc[k % 6])); }
    // 쉬는 동안 캐릭터를 감싸는 폭신한 방울
    W.bubble = new THREE.Mesh(EK.G.sph, EK.patch(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }))); W.bubble.visible = false; W.bubble.renderOrder = 4; W.root.add(W.bubble);

    // 반짝이·색종이·물방울 (점)
    const PN = 420; W.PN = PN; W.pp = new Float32Array(PN * 3); W.pc = new Float32Array(PN * 3); W.pv = new Float32Array(PN * 3); W.pl = new Float32Array(PN); W.pg = new Float32Array(PN); W.pi = 0;
    for (let k = 0; k < PN; k++) W.pp[k * 3 + 1] = -999;
    const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(W.pp, 3)); pgeo.setAttribute('color', new THREE.BufferAttribute(W.pc, 3));
    const ptex = tex('dot', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    W.points = new THREE.Points(pgeo, EK.patch(new THREE.PointsMaterial({ size: 0.42, map: ptex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }))); W.points.frustumCulled = false; W.points.renderOrder = 3; W.root.add(W.points);

    // 멀리 있는 것 (카메라를 따라다니는 배경 — 굽지 않음)
    W.far = new THREE.Group(); W.root.add(W.far);
    const farMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    if (themeId === 'school') {   // r8: 멀리 2층 학교 건물(시계·창문, 이름·로고 없음)·교문·낮은 언덕·구름·해
      const P = [], hc = [0xa8e0a0, 0xb9e8c0, 0x9fd8b8];
      for (let k = 0; k < 9; k++) { const x = -170 + k * 42 + (R() - 0.5) * 16; P.push(['sph', hc[k % 3], [x, -30, -230 - (k % 2) * 18], [46 + R() * 16, 42 + R() * 14, 20]]); }
      P.push(['box', 0xfff3d6, [0, 9, -205], [70, 18, 12]], ['box', 0xff8f7a, [0, 18.6, -205], [72, 1.4, 14]], ['box', 0xffd9b0, [0, 9.2, -198.9], [70, 0.5, 0.3]]);
      for (let f = 0; f < 2; f++) for (let k = 0; k < 11; k++) P.push(['box', 0x9fdcff, [-30 + k * 6, 4.5 + f * 8.4, -198.8], [3.2, 4.0, 0.3]], ['box', 0xffffff, [-30 + k * 6, 4.5 + f * 8.4, -198.7], [3.4, 0.3, 0.2]]);
      P.push(['box', 0x6244be, [0, 3.2, -198.8], [5.5, 6.4, 0.4]], ['cyl', 0xffffff, [0, 15.2, -198.8], [2.6, 0.5, 2.6], [Math.PI / 2, 0, 0]], ['cyl', 0x2b1f57, [0, 15.2, -198.4], [2.3, 0.2, 2.3], [Math.PI / 2, 0, 0]], ['cyl', 0xffffff, [0, 15.2, -198.2], [2.0, 0.2, 2.0], [Math.PI / 2, 0, 0]], ['box', 0x2b1f57, [0.6, 15.6, -198.0], [1.4, 0.3, 0.1], [0, 0, 0.6]], ['box', 0x2b1f57, [0, 16.0, -198.0], [0.3, 1.7, 0.1]]);
      for (const sx of [1, -1]) P.push(['box', 0xd9d3ea, [sx * 40, 3.2, -190], [2.4, 6.4, 2.4]], ['sph', 0xffd23a, [sx * 40, 6.8, -190], 0.9]);   // 교문 기둥
      for (let k = 0; k < 12; k++) P.push(['cyl', 0x8a8aa0, [-36 + k * 6.5, 1.8, -190], [0.15, 3.6, 0.15]], ['cyl', 0x8a8aa0, [-36 + k * 6.5 + 3.25, 2.8, -190], [0.1, 6.4, 0.1], [0, 0, Math.PI / 2]]);
      W.far.add(new THREE.Mesh(EK.merge(P), farMat));
      W.clouds = [];
      const cg = geo('cloud', () => [['sph', 0xffffff, [0, 0, 0], [3.2, 1.5, 1.8]], ['sph', 0xffffff, [2.4, -0.3, 0], [2.2, 1.1, 1.5]], ['sph', 0xffffff, [-2.3, -0.2, 0.2], [2.4, 1.2, 1.5]], ['sph', 0xffffff, [0.6, 0.9, -0.2], [1.8, 1.2, 1.4]]]);
      const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(cg, cm); m.position.set((R() - 0.5) * 150, 24 + R() * 26, -60 - R() * 130); m.scale.setScalar(1.2 + R() * 1.6); W.far.add(m); W.clouds.push(m); }
      const sunM = new THREE.Mesh(EK.G.sph, new THREE.MeshBasicMaterial({ color: 0xfff6c0, fog: false })); sunM.position.set(-70, 80, -200); sunM.scale.setScalar(11); W.far.add(sunM);
    } else if (themeId === 'town') {
      const P = []; const hc = [0xa8e0a0, 0xb9e8c0, 0x9fd8b8];
      for (let k = 0; k < 9; k++) { const x = -170 + k * 42 + (R() - 0.5) * 16; P.push(['sph', hc[k % 3], [x, -26, -210 - (k % 2) * 18], [44 + R() * 16, 40 + R() * 14, 20]]); }
      W.far.add(new THREE.Mesh(EK.merge(P), farMat));
      W.clouds = [];
      const cg = geo('cloud', () => [['sph', 0xffffff, [0, 0, 0], [3.2, 1.5, 1.8]], ['sph', 0xffffff, [2.4, -0.3, 0], [2.2, 1.1, 1.5]], ['sph', 0xffffff, [-2.3, -0.2, 0.2], [2.4, 1.2, 1.5]], ['sph', 0xffffff, [0.6, 0.9, -0.2], [1.8, 1.2, 1.4]]]);
      const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
      for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(cg, cm); m.position.set((R() - 0.5) * 150, 22 + R() * 26, -60 - R() * 130); m.scale.setScalar(1.2 + R() * 1.6); W.far.add(m); W.clouds.push(m); }
      const sunM = new THREE.Mesh(EK.G.sph, new THREE.MeshBasicMaterial({ color: 0xfff6c0, fog: false })); sunM.position.set(60, 78, -200); sunM.scale.setScalar(11); W.far.add(sunM);
    } else {
      const P = []; for (let k = 0; k < 10; k++) { const x = -160 + k * 36 + (R() - 0.5) * 14; P.push(['cone', k % 2 ? 0x2f8fd0 : 0x2a86c6, [x, -4, -150 - (k % 3) * 12], [20 + R() * 12, 50 + R() * 30, 14]]); }
      W.far.add(new THREE.Mesh(EK.merge(P), farMat));
      // 위에서 내려오는 빛줄기
      const rm = new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.13, fog: false, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      W.rays = []; for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(5 + R() * 6, 90), rm); m.position.set(-45 + k * 15 + R() * 6, 26, -50 - R() * 40); m.rotation.z = 0.28 + R() * 0.12; W.far.add(m); W.rays.push(m); }
    }

    // 결승문 + 무대
    if (chart) {
      const fz = W.finishZ, P = [];
      for (const sx of [1, -1]) P.push(['cyl', 0x6244be, [4.6 * sx, 3.6, 0], [0.3, 7.2, 0.3]], ['sph', 0xffd23a, [4.6 * sx, 7.4, 0], 0.5]);
      for (let k = 0; k < 14; k++) P.push(['box', k % 2 ? 0xffffff : 0x6244be, [-4.3 + k * 0.66, 6.9, 0], [0.66, 0.6, 0.2]], ['box', k % 2 ? 0x6244be : 0xffffff, [-4.3 + k * 0.66, 6.3, 0], [0.66, 0.6, 0.2]]);
      const fm = new THREE.Mesh(EK.merge(P), EK.MAT.vc); fm.position.set(0, 0, fz); W.root.add(fm); W.finishMesh = fm;
      const sz = W.stageZ, S = [
        ['cyl', 0x6244be, [0, 0.2, 0], [8.5, 0.4, 6.5]], ['cyl', 0xffd23a, [0, 0.42, 0], [8.0, 0.06, 6.0]], ['cyl', 0x7b5be0, [0, 0.46, 0], [7.5, 0.04, 5.6]],
        ['box', 0x4a3496, [0, 4.2, -6.4], [15, 7.6, 0.6]], ['box', 0xffd23a, [0, 8.1, -6.4], [15.6, 0.5, 0.8]],
        ...star(0xffd23a, 0, 5.3, -6.0, 2.3, 0.5), ...star(0xff8fb1, -4.8, 6.0, -6.0, 1.0, 0.4), ...star(0x5fd6c4, 4.8, 6.0, -6.0, 1.0, 0.4),
        ['box', 0x2b1f57, [-6.3, 1.9, -4.6], [1.8, 3.0, 1.4]], ['box', 0x2b1f57, [6.3, 1.9, -4.6], [1.8, 3.0, 1.4]],
        ['cyl', 0xb9a4ff, [-6.3, 2.5, -3.88], [0.6, 0.1, 0.6], [Math.PI / 2, 0, 0]], ['cyl', 0xb9a4ff, [6.3, 2.5, -3.88], [0.6, 0.1, 0.6], [Math.PI / 2, 0, 0]],
        ['cyl', 0xb9a4ff, [-6.3, 1.2, -3.88], [0.4, 0.1, 0.4], [Math.PI / 2, 0, 0]], ['cyl', 0xb9a4ff, [6.3, 1.2, -3.88], [0.4, 0.1, 0.4], [Math.PI / 2, 0, 0]],
        ['box', 0xffffff, [0, 1.1, -4.4], [3.4, 1.3, 1.1]], ['box', 0xff8fb1, [0, 1.1, -3.84], [3.0, 0.9, 0.06]], ['cyl', 0x2b1f57, [-0.8, 1.8, -4.4], [0.5, 0.08, 0.5]], ['cyl', 0x2b1f57, [0.8, 1.8, -4.4], [0.5, 0.08, 0.5]],
      ];
      for (let k = 0; k < 9; k++) S.push(['sph', PAL[k % 6], [-7 + k * 1.75, 8.6, -6.3], 0.42]);
      // r3: 바닷속 결승은 큰 조개 무대(분홍 조개 등받이·진주·산호 기둥·모래 바닥) — 마을의 보라 무대와 구분
      const O = [['cyl', 0xf3d9a0, [0, 0.2, 0], [8.5, 0.4, 6.5]], ['cyl', 0x5fd6c4, [0, 0.42, 0], [8.0, 0.06, 6.0]], ['cyl', 0xfff3cf, [0, 0.46, 0], [7.5, 0.04, 5.6]],
        ['sph', 0xff9fc4, [0, 3.6, -6.4], [8.2, 5.4, 0.7]], ['sph', 0xffd0df, [0, 3.4, -6.0], [6.9, 4.5, 0.5]], ['sph', 0xffffff, [0, 2.3, -5.2], 1.15], ['sphLo', 0xfff3b0, [0.35, 2.75, -4.3], 0.22],
        ['sph', 0xffb3cb, [0, 0.9, -5.0], [3.2, 0.7, 1.6]], ...star(0xffd23a, 0, 7.6, -5.9, 1.3, 0.4)];
      for (let k = 0; k < 9; k++) { const a = (k - 4) / 4 * 1.25; O.push(['cyl', 0xff8fb1, [Math.sin(a) * 3.4, 3.4 + Math.cos(a) * 2.2, -5.72], [0.11, 4.6, 0.11], [0, 0, -a]]); }
      for (const sx of [1, -1]) { for (let k = 0; k < 4; k++) { const h = 2.2 + ((k * 7) % 4) * 0.8, x = sx * (5.6 + k * 0.6), c = [0xff9f45, 0xc79bff, 0xff8fb1, 0x5fd6c4][k]; O.push(['cyl', c, [x, h / 2 + 0.4, -4.6 + (k % 2) * 0.7], [0.24, h, 0.24], [0, 0, sx * -0.12]], ['sphLo', 0xffe0b0, [x - sx * 0.12 * h * 0.5, h + 0.45, -4.6 + (k % 2) * 0.7], 0.36]); }
        O.push(['sph', 0x8fe9ff, [sx * 6.9, 5.2, -5.6], 0.5], ['sph', 0xd8fbff, [sx * 5.9, 6.3, -5.6], 0.34], ['sph', 0x8fe9ff, [sx * 7.3, 6.7, -5.6], 0.26]); }
      // r8b 운동장 결승: 흰 구령대(단 + 계단 + 난간) + 흰·파랑 줄무늬 운동회 천막 지붕 + 큰 청백 박 두 개(터져서 색종이 리본) + 만국기 줄. 보라 무대 X
      const K = [['box', 0xf4f1ea, [0, 0.45, 0], [14, 0.9, 9]], ['box', 0xe4ded2, [0, 0.92, 0], [13.4, 0.06, 8.4]], ['box', 0xf4f1ea, [0, 0.22, 5.2], [6, 0.44, 1.2]], ['box', 0xf4f1ea, [0, 0.66, 4.6], [6, 0.44, 1.0]],
        ['box', 0xffffff, [0, 1.5, -4.3], [13, 1.2, 0.2]], ['box', 0x4a8df0, [0, 1.5, -4.2], [12, 0.6, 0.1]]];
      for (const sx of [1, -1]) K.push(['cyl', 0xd9d3ea, [sx * 6.6, 4.4, -3.8], [0.14, 7.0, 0.14]], ['cyl', 0xd9d3ea, [sx * 6.6, 4.4, 3.8], [0.14, 7.0, 0.14]], ['cyl', 0xd9d3ea, [sx * 6.9, 1.6, 0], [0.06, 1.4, 0.06]], ['cyl', 0xd9d3ea, [sx * 6.9, 2.2, 0], [0.05, 8.2, 0.05], [Math.PI / 2, 0, 0]]);
      for (let k = 0; k < 10; k++) K.push(['box', k % 2 ? 0xffffff : 0x4a8df0, [-6.3 + k * 1.4, 7.9, 0], [1.4, 0.16, 9.2]], ['box', k % 2 ? 0xffffff : 0x4a8df0, [-6.3 + k * 1.4, 7.5, 4.65], [1.4, 0.7, 0.08]]);
      for (let k = 0; k < 12; k++) K.push(['pyr', PAL[k % 6], [-7.0 + k * 1.27, 7.05, 4.8], [0.36, 0.6, 0.06], [Math.PI, 0, 0]]);
      for (const sx of [1, -1]) { const c = sx > 0 ? 0x4a8df0 : 0xffffff, c2 = sx > 0 ? 0xffffff : 0x4a8df0; K.push(['cyl', 0x8a8aa0, [sx * 4.2, 3.4, -2.6], [0.1, 6.8, 0.1]], ['sph', c, [sx * 4.2 - 0.95, 7.0, -2.6], [1.15, 1.3, 1.15], [0, 0, 0.5]], ['sph', c, [sx * 4.2 + 0.95, 7.0, -2.6], [1.15, 1.3, 1.15], [0, 0, -0.5]], ['sphLo', c2, [sx * 4.2, 7.1, -2.6], 0.55], ['sph', 0xffd23a, [sx * 4.2, 7.9, -2.6], 0.3]);
        for (let k = 0; k < 9; k++) K.push(['box', PAL[k % 6], [sx * 4.2 + (k - 4) * 0.3, 4.6 - (k % 3) * 0.6, -2.3], [0.1, 2.4 + (k % 2) * 0.8, 0.04], [0, 0, (k - 4) * 0.07]]); }
      K.push(['box', 0xffd23a, [0, 1.75, -3.6], [3.6, 0.1, 1.2]], ['cyl', 0x2b1f57, [-1.0, 1.75, -3.6], [0.5, 0.08, 0.5]], ['cyl', 0x2b1f57, [1.0, 1.75, -3.6], [0.5, 0.08, 0.5]], ['box', 0xff8fb1, [0, 1.35, -3.3], [3.0, 0.7, 0.06]]);
      const sm = new THREE.Mesh(EK.merge(themeId === 'ocean' ? O : themeId === 'school' ? K : S), EK.MAT.vc); sm.position.set(0, 0, sz); W.root.add(sm); W.stageMesh = sm;
      // r7: 무대 앞 가장자리 소품(박자에 통통) — 결승 화면 아래 빈 바닥을 채움. 라온 앞(가운데)은 비워 둠
      const FT = [], fc = themeId === 'ocean' ? [0xff8fb1, 0x8fe9ff, 0xffd23a, 0xc79bff] : [0xffd23a, 0xff8fb1, 0x5fd6c4, 0xb9a4ff];
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) { const x = sx * (1.55 + k * 1.0), z = 3.0 - k * 0.3, c = fc[k];
        if (themeId === 'ocean') FT.push(['sph', c, [x, 0.55, z], [0.26, 0.2, 0.26]], ['sphLo', 0xffffff, [x - 0.08, 0.64, z + 0.14], 0.06]);
        else FT.push(['sph', c, [x, 0.54, z], [0.25, 0.19, 0.25]], ['cyl', 0x2b1f57, [x, 0.49, z], [0.3, 0.06, 0.3]], ['sphLo', 0xffffff, [x - 0.08, 0.62, z + 0.13], 0.055]); }
      for (const sx of [-1, 1]) FT.push(['box', themeId === 'ocean' ? 0x5fd6c4 : 0xff8fb1, [sx * 5.9, 0.78, 1.6], [0.62, 0.62, 0.62], [0, sx * 0.4, 0]], ['box', 0xffd23a, [sx * 5.9, 0.78, 1.6], [0.66, 0.13, 0.66], [0, sx * 0.4, 0]]);
      const ft = new THREE.Mesh(EK.merge(FT), EK.MAT.vc); ft.position.set(0, 0, sz); W.root.add(ft); W.footMesh = ft;
    }
    W.time = 0; W.oi = 0; W.orbTmp = new THREE.Object3D();
  };

  const WP = EK.World.prototype;
  WP.spark = function (x, y, z, n, color, spread, up, life, grav, vz) {   // r5: vz = 앞으로 같이 가는 속도(라온과 같이 달리는 반짝이는 -SPEED)
    const c = new THREE.Color();
    for (let k = 0; k < n; k++) { const i = this.pi = (this.pi + 1) % this.PN; c.set(Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color);
      this.pp[i * 3] = x + (Math.random() - 0.5) * 0.3; this.pp[i * 3 + 1] = y + (Math.random() - 0.5) * 0.3; this.pp[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      const a = Math.random() * 6.28, s = spread * (0.4 + Math.random() * 0.6);
      this.pv[i * 3] = Math.cos(a) * s; this.pv[i * 3 + 1] = (up || 0) + Math.random() * spread * 0.8; this.pv[i * 3 + 2] = Math.sin(a) * s * 0.6 + (vz || 0);
      this.pc[i * 3] = c.r; this.pc[i * 3 + 1] = c.g; this.pc[i * 3 + 2] = c.b; this.pl[i] = (life || 0.6) * (0.7 + Math.random() * 0.5); this.pg[i] = grav == null ? 6 : grav; }
  };
  const _ca = new THREE.Color();
  WP.update = function (cam, pz, t, dt, beat, boost) {
    const W = this, th = TH[W.theme]; W.time += dt;
    for (const sk of W.skies) sk.position.copy(cam.position); W.far.position.set(0, 0, cam.position.z);
    // 풍경 구역: 경계 2초 앞에서부터 4초에 걸쳐 하늘·안개·조명 색이 서서히 바뀜
    let zi = 0, zk = 0;
    for (let k = 1; k < W.zoneT.length; k++) { const u = (t - (W.zoneT[k] - 2)) / 4; if (u >= 1) { zi = k; zk = 0; } else if (u > 0) { zk = EK.smooth(u); break; } else break; }
    const A = W.zc[zi], B = W.zc[Math.min(zi + 1, W.zc.length - 1)];
    // 터널 안: 조명이 살짝 포근해짐(어두워지지 않게 10%만)
    let tk = 0; for (const u of W.tunnels) tk = Math.max(tk, EK.clamp(Math.min(t - u.t0 + 0.6, u.t1 + 0.6 - t) / 1.2, 0, 1));
    W.tk = EK.lerp(W.tk || 0, tk, Math.min(1, dt * 3));
    _ca.lerpColors(A.fog, B.fog, zk); W.scene.fog.color.copy(_ca); W.scene.background.copy(_ca);
    W.hemi.color.lerpColors(A.h0, B.h0, zk); W.hemi.groundColor.lerpColors(A.h1, B.h1, zk); W.sun.color.lerpColors(A.sun, B.sun, zk);
    for (let k = 0; k < W.skies.length; k++) { const sk = W.skies[k], op = k === zi ? 1 : k === zi + 1 ? zk : 0; sk.visible = op > 0.001; if (k > 0) sk.material.opacity = op; }
    W.zi = zi; W.zk = zk;
    // 타일 돌려쓰기 (타일마다 그 자리 구역의 길·바닥 색)
    const base = Math.floor((-pz - 22) / W.TL);
    for (let i = 0; i < W.tiles.length; i++) { const tl = W.tiles[i], z = -(base + i + 0.5) * W.TL; tl.position.z = z; const q = W.zoneOf(-z / SP); if (q !== tl.userData.zi) { tl.userData.zi = q; const m = tl.userData.m; m[0].material = W.roadMats[q]; m[1].material = m[2].material = W.groundMats[q]; } }
    // 보이는 범위만 켜기
    const zNear = pz + 16, zFar = pz - (W.theme === 'town' ? 140 : 110);
    for (const m of W.props) m.visible = m.position.z < zNear && m.position.z > zFar;
    const bp = beat - Math.floor(beat), pulse = Math.max(0, 1 - bp * 2.2);
    if (W.footMesh) { W.footMesh.visible = W.footMesh.position.z < pz + 12 && W.footMesh.position.z > zFar; if (W.footMesh.visible) W.footMesh.scale.y = 1 + pulse * 0.18; }
    // 물고기는 제자리 둘레에서만 헤엄침(길 가운데·카메라 앞으로 못 들어옴) · 풍선·다시마는 박자마다 통통
    for (const m of W.anim) if (m.visible) { const u = m.userData, tt = W.time + u.p; if (u.k === 'kelp') { m.rotation.z = Math.sin(tt * 1.3) * 0.12; m.scale.y = u.s * (1 + pulse * 0.05); } else if (u.k === 'sway') { m.rotation.z = Math.sin(tt * 1.6) * 0.06; m.scale.y = u.s * (1 + pulse * 0.09); } else if (u.k === 'bob') { m.position.y = u.y + Math.sin(tt * 1.1) * 0.5; } else if (u.k === 'fish') { m.position.y = u.y + Math.sin(tt * 2) * 0.2; m.position.x = u.x + Math.sin(tt * 0.5) * 1.2; m.rotation.y = Math.cos(tt * 0.5) > 0 ? 0 : Math.PI; } }
    for (const m of W.gates) { m.visible = m.position.z < pz + 1.2 && m.position.z > zFar;   /* 캐릭터를 지나면 치움(카메라 코앞에 큰 깃발이 걸리지 않게) */ if (m.visible) { const b = m.userData.big || 1; m.scale.set(b, b * (1 + pulse * 0.05), b); } }
    // 결승 문: 다가가면 위로 올라가 화면을 가리지 않음
    if (W.finishMesh) { const k = EK.smooth(EK.clamp((W.finishZ + 26 - pz) / 14, 0, 1)); W.finishMesh.position.y = k * 9; W.finishMesh.visible = k < 0.999; }
    // 장애물
    const zPass = W.cullZ != null ? W.cullZ + 0.3 : zNear;   // r5: 카메라가 가까워져서, 지나간 장애물은 바로 치움(화면 아래를 크게 가리지 않게)
    for (const o of W.obs) { const m = o.mesh, z = -SP * o.t; let vis = z < Math.min(zNear, o.popT != null ? zNear : zPass) && z > zFar;
      if (o.popT != null) { const k = (t - o.popT) / 0.55; if (k >= 1 || k < 0) vis = false; else { m.position.y = k * 2.0; m.position.x = (o.popX0 != null ? o.popX0 : (o.lane - 1) * LW) + Math.sign(o.popX) * (1.9 * Math.min(1, k * 12)) + o.popX * k * 7;   /* r7: 바로 옆으로 비켜 나며 낮게 — 「아야」 때 라온 머리를 안 덮음 */ m.position.z = Math.min(z, pz - 1.4 - k * 3);   /* r5: 튕긴 장애물은 캐릭터보다 앞(먼 쪽)·옆으로 — 카메라 쪽으로 와서 라온을 덮지 않게 */ m.rotation.z = k * 5 * o.popX; m.scale.setScalar(1 - k * 0.7); if (o.mk) o.mk.visible = false; } }
      else if (vis) {
        if (o.kind === 'mover') { const x = EK.moverX(o, t), dir = -Math.sin((t - o.t) / o.period * Math.PI * 2) * (o.lane - o.lane2); m.position.x = x; m.rotation.y = EK.lerp(m.rotation.y, W.theme === 'town' ? (dir > 0.05 ? 0.9 : dir < -0.05 ? -0.9 : 0) : 0, Math.min(1, dt * 6)); m.position.y = Math.abs(Math.sin(W.time * 7)) * 0.07; }
        if (o.mk) { o.mk.position.y = o.mk.userData.y + pulse * 0.16; } }
      m.visible = vis; }
    for (const nt of W.notes) { const m = nt.mesh; m.visible = !nt.got && m.position.z < zPass && m.position.z > zFar; if (m.visible) { m.rotation.y = W.time * 3; m.position.y = 1.15 + Math.sin(W.time * 4 + nt.t) * 0.12; } }
    // 구슬 (먹은 구슬도 그 구슬의 박자 시각까지는 보이다가, 소리와 함께 사라짐)
    if (W.chart) { const orbs = W.chart.orbs, T = W.orbTmp; let n = 0, hn = 0; for (const h of W.heartPool) h.visible = false; const t0 = t - 0.5, t1 = t + (W.theme === 'town' ? 6.5 : 5.5);
      while (W.oi < orbs.length && orbs[W.oi].t < t0) W.oi++;
      for (let i = W.oi || 0; i < orbs.length && n < 110; i++) { const o = orbs[i]; if (o.t > t1) break; if (o.got && (t >= o.t || W.frozen)) continue; if (W.frozen && Math.abs(o.t - t) < 0.22) continue;   // 멈춰라 순간 캐릭터 몸에 겹친 구슬은 안 그림
        if (o.gym && o.mv.res !== 1) continue;   // 체조 구슬은 맞춘 동작 뒤에만 나타남
        if (W.cullZ != null && -SP * o.t > W.cullZ) continue;   // r5: 캐릭터를 지나 카메라 쪽으로 온 구슬은 안 그림(코앞에서 크고 흐리게 화면을 덮던 것)
        let x = (o.lane - 1) * LW, y = o.y, z = -SP * o.t, grow = o.gym ? EK.clamp((t - o.mv.at) / 0.2, 0.15, 1) : 1;
        if (W.magX != null && o.t - t < 0.6) { const k = EK.clamp(1 - (o.t - t) / 0.6, 0, 1), kk = k * k; x = EK.lerp(x, W.magX, kk); y = EK.lerp(y, 1.05, kk); grow = 1 - kk * 0.35; }   // 부스트 자석: 구슬이 캐릭터로 빨려옴
        else if (o.got && o.px != null) { const k = EK.clamp(1 - (o.t - t) / 0.11, 0, 1); x = EK.lerp(x, o.px, k * 0.8); }
        if (o.heartOn && hn < 3) { const h = W.heartPool[hn++]; h.visible = true; h.position.set(x, y + 0.1 + Math.sin(W.time * 4) * 0.08, z); h.scale.setScalar(1.25 + pulse * 0.2); h.rotation.y = Math.sin(W.time * 2.5) * 0.5; continue; }
        const nk = EK.clamp((o.t - t) / 0.28, 0, 1), s = 0.27 * (1 + pulse * 0.22) * grow * (0.72 + 0.28 * nk); T.position.set(x, y + Math.sin(W.time * 3 + o.t * 5) * 0.06, z); T.rotation.set(0, 0, 0); T.scale.setScalar(s); T.updateMatrix(); W.orbMesh.setMatrixAt(n, T.matrix);
        T.scale.setScalar(s * (1.05 + 0.7 * nk)); T.updateMatrix(); W.haloMesh.setMatrixAt(n, T.matrix); n++; }   // r7: 라온 바로 앞(0.28초 안) 구슬은 빛무리를 줄임 — 바다 물방울 빛무리가 라온 머리를 덮던 것
      W.orbMesh.count = W.haloMesh.count = n; W.orbMesh.instanceMatrix.needsUpdate = W.haloMesh.instanceMatrix.needsUpdate = true; }
    // 점
    const pp = W.pp, pv = W.pv, pl = W.pl;
    const cz = W.cullZ;
    for (let i = 0; i < W.PN; i++) { if (pl[i] <= 0) continue; pl[i] -= dt; if (pl[i] <= 0 || (cz != null && pp[i * 3 + 2] > cz)) { pl[i] = 0; pp[i * 3 + 1] = -999; continue; }   /* r5: 캐릭터 뒤(카메라 쪽)로 넘어온 반짝이는 지움 */ pv[i * 3 + 1] -= W.pg[i] * dt; pp[i * 3] += pv[i * 3] * dt; pp[i * 3 + 1] += pv[i * 3 + 1] * dt; pp[i * 3 + 2] += pv[i * 3 + 2] * dt; }
    // 바닷속 물방울이 계속 올라옴 · 깊은 바다와 터널에서는 색색 반짝이도
    if (W.theme === 'ocean' && Math.random() < dt * 14) W.spark((Math.random() - 0.5) * 16, 0.3 + Math.random() * 2, pz - 4 - Math.random() * 40, 1, [0xffffff, 0xd8fbff], 0.3, 1.6, 2.6, -0.6);
    if (W.theme === 'ocean' && (zi === 2 || W.tk > 0.3) && Math.random() < dt * 22) W.spark((Math.random() < 0.5 ? -1 : 1) * (2.8 + Math.random() * 6), 0.5 + Math.random() * 5, pz - 6 - Math.random() * 45, 1, [0xfff3b0, 0xffb3e0, 0x9ff5e0, 0xffffff], 0.2, 0.3, 2.2, -0.2);
    if (W.theme === 'town' && zi === 2 && Math.random() < dt * 10) W.spark((Math.random() - 0.5) * 18, 5 + Math.random() * 4, pz - 8 - Math.random() * 40, 1, [0xff8fb1, 0xffd23a, 0x5fd6c4, 0xffffff], 0.4, 0, 3.0, 1.2);
    W.points.geometry.attributes.position.needsUpdate = true; W.points.geometry.attributes.color.needsUpdate = true;
    if (W.clouds) for (const c of W.clouds) { c.position.z += dt * 3.2; if (c.position.z > -30) { c.position.z = -190; c.position.x = (Math.random() - 0.5) * 150; } }
    if (W.rays) for (let k = 0; k < W.rays.length; k++) W.rays[k].material.opacity = (0.11 + Math.sin(W.time * 0.7) * 0.03) * (zi === 0 ? 1.5 : 1) * (1 - W.tk * 0.7);
    // 부스트 때 조명·길이 살짝 밝아짐 + 박자마다 길 불빛 + 속도선 (번쩍임 없이 부드럽게)
    const tb = boost ? 1 : 0; W.bk = EK.lerp(W.bk || 0, tb, Math.min(1, dt * 4));
    W.hemi.intensity = th.hemiI * (1 + W.bk * 0.12 + pulse * 0.03 * W.bk) * (1 - W.tk * 0.1);
    const em = W.bk * (0.04 + pulse * 0.07); for (const m of W.roadMats) m.emissiveIntensity = em;
    if (W.bk > 0.03) { const T = W.orbTmp, n = W.LN; for (let k = 0; k < n; k++) { const sd = k % 2 ? 1 : -1, h = (k * 0.6180339) % 1, zz = pz + 8 - ((h * 56 + W.time * 62) % 56), gnd = k % 4 === 0;   // 길 양옆 + 바닥에 깔리는 줄
        T.position.set(sd * (gnd ? 2.75 + ((k * 5) % 3) * 0.35 : 3.0 + ((k * 7) % 6) * 0.5), gnd ? 0.06 : 0.35 + ((k * 3) % 9) * 0.42, zz); T.rotation.set(0, 0, 0); T.scale.set(gnd ? 0.22 : 0.11, gnd ? 0.02 : 0.11, 3.6 + (k % 3) * 2.0); T.updateMatrix(); W.lineMesh.setMatrixAt(k, T.matrix); } W.lineMesh.count = n; W.lineMesh.instanceMatrix.needsUpdate = true; W.lineMesh.material.opacity = 0.7 * W.bk; } else W.lineMesh.count = 0;
    for (const m of W.deco) { const u = m.userData; m.position.y = u.y + Math.abs(Math.sin(W.time * 2.6 + u.p * 0.7)) * (u.note ? 0.22 : 0.1); if (u.note) m.rotation.y = W.time * 1.6; }
    EK.bendU.value.y = Math.sin(t * 0.21) * 0.0007;
  };
  // 판 정리: 이 판만 쓰던 도형·재질을 지움(같이 쓰는 것은 keep 표시가 있어 남김)
  WP.dispose = function (scene) {
    scene.remove(this.root);
    const keepMat = new Set(Object.values(EK.MAT).concat(Object.values(cache)));
    this.root.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); const m = o.material; if (m && !keepMat.has(m) && m.dispose) m.dispose(); });
    this.orbMesh.dispose(); this.haloMesh.dispose(); this.lineMesh.dispose();
    for (const m of this.roadMats) m.emissiveIntensity = 0;
  };
  EK.TH = TH;
})();
