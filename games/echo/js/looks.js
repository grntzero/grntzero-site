/* 에코 제로 — 던전별 안개·보스 「모양」 표 (2026-11-24 대표 지시: 던전마다 일반 안개·보스 모양을 다르게)
   · 전부 three.js 기본 도형 조합(크레딧 0) — 기존 툰 재질·외곽선·얼굴 셰이더를 그대로 쓰고 「몸 모양」만 바꿔 끼움(js/fogs.js F.setLook).
   · 그림만: 판정 반지름(RAD)·튼튼함·규칙·난수는 손대지 않음. 기록 재생과 무관.
   · 색: 안개 재질은 한 색(몸 색 × 단계 색) → 부품 색은 정점 색(color 속성)으로 — 「원하는 색 ÷ 몸 색」을 정점에 넣어 한 드로콜로 두 색 이상(값이 1 을 넘어도 됨, 상한 2.4).
   · 모양 한 줄 = TG.LOOKS.<던전 id> = { bubble, clump, echo, boss(몸), parts(보스 부품), spin(부품 돌림), bossC(보스 얼굴 중심) }. 없는 던전은 pipe(기존 모양). 지오메트리는 처음 쓸 때 한 번만 만들어 둠(fogs.js).
   · 던전 모양 요약: 파이프 굴 = 기존 안개 구름 · 세포 돔 = 체조 공(띠·응원 솜방울·확성기) · 허조교 연병장 = 헬멧(챙·턱끈)·타이어(총·무기 X) · 모쉬 거울 미로 = 네온 큐브·거울 조각(팔면체) · 쎄니 댄스홀 = 별·미러볼, 보스 = 진짜 먹구름 · 베리 과수원 = 씨앗·열매(꼭지·잎)·새싹, 보스 = 진짜 나무(줄기·뿌리·수관·열매) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const LK = (TG.LOOKS = {});
  const BASE = { bubble: 0x9c98b8, clump: 0x8c88ac, echo: 0x6f94e4, boss: 0x77729a, parts: 0xffffff }; // 재질 몸 색(fogs.js 와 같아야 함). 보스는 던전 tint 가 몸 색

  // ── 정점 색 ──  hex 색 ÷ 몸 색(base) → 재질 색이 곱해지면 원하는 색이 됨
  const c0 = new T.Color(), c1 = new T.Color();
  function paint(g, hex, base) {
    const n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    let r = 1, gg = 1, b = 1;
    if (hex != null) { c0.set(hex); c1.set(base == null ? 0xffffff : base); r = Math.min(2.4, c0.r / Math.max(0.05, c1.r)); gg = Math.min(2.4, c0.g / Math.max(0.05, c1.g)); b = Math.min(2.4, c0.b / Math.max(0.05, c1.b)); }
    for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gg; a[i * 3 + 2] = b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3));
    return g;
  }
  // ── 도형 조각 ── 공통: (x,y,z) 자리, col = 색(없으면 몸 색), rot = [rx,ry,rz](자리 옮기기 전에 돌림), sc = [sx,sy,sz]
  const mk = (g, x, y, z, col, rot, sc) => { if (sc) g.scale(sc[0] || 1, sc[1] || 1, sc[2] || 1); if (rot) { if (rot[0]) g.rotateX(rot[0]); if (rot[1]) g.rotateY(rot[1]); if (rot[2]) g.rotateZ(rot[2]); } g.translate(x, y, z); g.userData.col = col; return g; };
  const P = {
    sph: (x, y, z, r, seg, col, sc) => mk(new T.SphereGeometry(r, seg || 8, Math.max(4, Math.round((seg || 8) * 0.72))), x, y, z, col, null, sc),
    half: (x, y, z, r, col, sy, seg) => mk(new T.SphereGeometry(r, seg || 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), x, y, z, col, null, [1, sy || 1, 1]), // 반구(헬멧)
    tor: (x, y, z, R, r, col, rot, seg) => mk(new T.TorusGeometry(R, r, seg && seg <= 10 ? 5 : 6, seg || 14), x, y, z, col, rot || [Math.PI / 2, 0, 0]), // 기본 = 바닥에 눕힘(축 y)
    cyl: (x, y, z, rt, rb, h, col, rot, seg) => mk(new T.CylinderGeometry(rt, rb, h, seg || 7), x, y, z, col, rot),
    cone: (x, y, z, r, h, col, rot, seg) => mk(new T.ConeGeometry(r, h, seg || 8), x, y, z, col, rot),
    box: (x, y, z, s, col, rot) => mk(Array.isArray(s) ? new T.BoxGeometry(s[0], s[1], s[2]) : new T.BoxGeometry(s, s, s), x, y, z, col, rot),
    oct: (x, y, z, r, col, sc, rot) => mk(new T.OctahedronGeometry(r, 0), x, y, z, col, rot, sc), // 거울 조각
    ico: (x, y, z, r, col) => mk(new T.IcosahedronGeometry(r, 1), x, y, z, col), // 각진 미러볼(면마다 법선 → 반짝 조각)
    star: (x, y, z, R, r, d, col, n, rz) => { // 별(윤곽 돌출) — n 꼭짓점, R 바깥·r 안쪽, d 두께
      const s = new T.Shape(); n = n || 5;
      for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? r : R; if (i) s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: d * 0.35, bevelSize: R * 0.1, bevelSegments: 2, curveSegments: 1 });
      g.translate(0, 0, -d / 2);
      return mk(g, x, y, z, col, [0, 0, rz || 0]);
    },
  };
  // 조각들을 한 지오메트리로 (정점 색 포함). base = 그 재질의 몸 색
  function merge(parts, base) {
    const gs = parts.map((g) => { const ng = g.index ? g.toNonIndexed() : g; return paint(ng, g.userData.col, base); });
    for (const g of gs) for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'uv') g.deleteAttribute(k);
    const m = T.BufferGeometryUtils.mergeGeometries(gs, false);
    m.computeBoundingSphere();
    return m;
  }
  // 기존 안개 구름 조각(fogs.js blob 과 같은 값) — 파이프 굴 = 기존 모양
  const blob = (parts, base) => merge(parts.map(([x, y, z, r, big, sy]) => P.sph(x, y, z, r, big || 7, null, sy ? [1, sy, 1] : null)), base);

  // ── 던전별 모양 표 ── (좌표는 기존 안개 크기 기준: 방울 반지름 약 0.66 · 뭉치 가운데 (0,0.82) · 보스 얼굴 중심 (0,2.015,0.13), 보스 몸 반지름 약 1.95)
  const CREAM = 0xf6e7c9, RED = 0xe5352b, BRASS = 0xe0ae2c, OLIVE_D = 0x4f5530, STRAP = 0x7a6a3a, TIRE = 0x3a3a44, HUB = 0x8c8c96, CYAN = 0x9ff6ff, LAV = 0xe9d9ff, STARY = 0xfff4b0, SILVER = 0xe6eaf4, ROD = 0x9aa0b8, LEAF = 0x7fcf6a, STEM = 0x8a5a36, BERRY = 0xff6f9c;
  // 공통 부품: 황동 태엽(큰 침묵 안개 표시) · 둘레 고리 16칸
  const KEY = () => [P.cyl(0, 4.95, 0, 0.17, 0.17, 1.3, 0xd9a92e, null, 8), P.cyl(0, 4.55, 0, 0.34, 0.4, 0.22, 0xb8862a, null, 10), P.tor(-0.5, 6.0, 0, 0.44, 0.15, BRASS, [0, 0, 0]), P.tor(0.5, 6.0, 0, 0.44, 0.15, BRASS, [0, 0, 0])];
  const RING = (fn) => { const out = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283; out.push(...fn(Math.cos(a) * 3.12, Math.sin(a) * 3.12, i, a)); } return out; };

  LK.pipe = { name: '안개 구름(기존)',
    bubble: (b) => blob([[0, 0.02, 0, 0.66, 12, 0.93], [0.5, -0.2, -0.06, 0.34], [-0.5, -0.2, -0.06, 0.34], [0.14, 0.5, -0.12, 0.31], [-0.22, 0.44, -0.14, 0.27], [0, -0.06, -0.6, 0.3]], b),
    echo: (b) => blob([[0, 0.02, 0, 0.68, 14, 0.96], [0.42, -0.34, -0.05, 0.3], [-0.42, -0.34, -0.05, 0.3], [0, 0.72, -0.05, 0.2], [0.05, 1.0, -0.05, 0.11]], b),
    clump: (b) => blob([[0, 0.82, 0.06, 0.86, 14, 0.95], [0.78, 0.6, -0.1, 0.56], [-0.78, 0.6, -0.1, 0.56], [0.42, 1.42, -0.18, 0.5], [-0.4, 1.38, -0.15, 0.52], [0, 1.6, -0.3, 0.42], [0, 0.45, -0.62, 0.6]], b),
    boss: (b) => { const bp = [[0, 1.55, 0.1, 1.5], [1.35, 1.2, -0.2, 1.0], [-1.35, 1.2, -0.2, 1.0], [0.85, 2.5, -0.3, 0.95], [-0.85, 2.45, -0.3, 0.98], [0, 2.85, -0.5, 0.9], [1.75, 0.55, 0.15, 0.62], [-1.75, 0.55, 0.15, 0.62], [0, 0.55, -1.0, 1.0], [1.0, 0.5, 0.9, 0.55], [-1.0, 0.5, 0.9, 0.55]]; return blob(bp.map(([x, y, z, r], i) => [x * 1.3, y * 1.3, z * 1.3, r * 1.3, i === 0 ? 24 : 14]), b); },
    parts: () => RING((x, z, i) => [P.sph(x, 1.0, z, i % 2 ? 0.26 : 0.36, 8, i % 2 ? 0x8f8ca2 : 0xbcb9cc, [1, 0.84, 1])]).concat([P.tor(0, 1.0, 0, 3.12, 0.13, 0x7b7890, null, 40)], KEY()), spin: true, // 기존 회색 구슬 고리 + 황동 태엽
  };
  // 세포 「메아리 체조 돔」: 체조 공(가로 띠·응원 솜방울·확성기) — 빨강·크림·황동
  LK.sefo_dome = { name: '체조 공 안개',
    bubble: (b) => merge([P.sph(0, 0.02, 0, 0.66, 12, null, [1, 0.95, 1]), P.tor(0, 0.0, 0, 0.64, 0.085, CREAM, [Math.PI / 2 - 0.22, 0, 0], 18), P.sph(0.3, 0.6, -0.12, 0.22, 7, CREAM), P.sph(-0.28, 0.58, -0.14, 0.2, 7, CREAM), P.sph(0, -0.06, -0.6, 0.28)], b),
    echo: (b) => merge([P.sph(0, 0.02, 0, 0.68, 14, null, [1, 0.96, 1]), P.tor(0, 0.42, 0, 0.56, 0.08, RED, [Math.PI / 2 + 0.12, 0, 0], 18), P.sph(0.36, 0.72, -0.1, 0.19, 7, CREAM), P.sph(-0.36, 0.7, -0.1, 0.19, 7, CREAM), P.sph(0.42, -0.34, -0.05, 0.28), P.sph(-0.42, -0.34, -0.05, 0.28)], b), // 머리띠 + 솜방울
    clump: (b) => merge([P.sph(0, 0.85, 0.05, 0.9, 14, null, [1, 0.95, 1]), P.tor(0, 0.8, 0.05, 0.88, 0.1, CREAM, [Math.PI / 2 - 0.18, 0, 0], 20), P.sph(0.8, 0.55, -0.1, 0.55, 8), P.sph(-0.8, 0.55, -0.1, 0.55, 8), P.cone(0.42, 1.78, -0.4, 0.36, 0.72, BRASS, [-0.55, 0, -0.5]), P.cyl(0.1, 1.42, -0.22, 0.08, 0.08, 0.5, BRASS, [-0.55, 0, -0.5], 6), P.sph(-0.45, 1.55, -0.2, 0.3, 7, CREAM), P.sph(0, 0.45, -0.62, 0.55, 8)], b), // 큰 공 + 확성기
    boss: (b) => merge([P.sph(0, 2.02, 0.1, 2.05, 24, null, [1, 0.95, 1]), P.tor(0, 1.95, 0.1, 1.98, 0.2, CREAM, [Math.PI / 2 - 0.2, 0, 0], 36), P.tor(0, 0.95, 0.1, 1.5, 0.15, CREAM, [Math.PI / 2 - 0.2, 0, 0], 28), P.tor(0, 3.05, 0.1, 1.5, 0.15, CREAM, [Math.PI / 2 - 0.2, 0, 0], 28),
      P.sph(0.95, 3.75, -0.3, 0.62, 10, CREAM), P.sph(-0.95, 3.7, -0.3, 0.62, 10, CREAM), P.sph(0.3, 4.05, -0.5, 0.42, 8, CREAM), P.sph(-0.35, 4.0, -0.5, 0.42, 8, CREAM),
      P.cone(2.85, 3.15, 0.3, 0.72, 1.4, BRASS, [0, 0, -1.25], 10), P.cyl(2.0, 2.6, 0.25, 0.18, 0.18, 0.9, BRASS, [0, 0, -1.25], 7), P.sph(1.95, 2.55, 0.25, 0.32, 8, BRASS)], b), // 큰 체조 공 + 응원 솜방울 + 황동 확성기
    parts: () => RING((x, z, i) => [P.sph(x, 1.0, z, i % 2 ? 0.3 : 0.4, 8, i % 2 ? CREAM : RED, [1, 0.86, 1])]).concat([P.tor(0, 1.0, 0, 3.12, 0.12, CREAM, null, 40)], KEY()), spin: true, // 빨강·크림 공 고리
  };
  // 허조교 「연병장 지하」: 헬멧(챙·턱끈) 쓴 안개 + 타이어(정본 3장: 호루라기·구령·타이어만 — 총·무기 0)
  const HELMET = (x, y, z, r, col) => [P.half(x, y, z, r, col || OLIVE_D, 0.62), P.tor(x, y + 0.02, z, r * 0.98, r * 0.11, col || OLIVE_D, null, 20), P.tor(x, y - r * 0.5, z, r * 1.02, r * 0.06, STRAP, [Math.PI / 2 + 0.4, 0, 0], 16)];
  const TIRE_W = (x, y, z, R, r, ry) => [P.tor(x, y, z, R, r, TIRE, [0, ry, 0], 10), P.cyl(x, y, z, R * 0.48, R * 0.48, r * 0.9, HUB, [0, ry, Math.PI / 2], 6)]; // 서 있는 바퀴(축 = ry 방향)
  LK.gunner_camp = { name: '헬멧 안개',
    bubble: (b) => merge([P.sph(0, 0.02, 0, 0.66, 12, null, [1, 0.93, 1]), P.sph(0.5, -0.2, -0.06, 0.32), P.sph(-0.5, -0.2, -0.06, 0.32), P.sph(0, -0.06, -0.6, 0.3)].concat(HELMET(0, 0.36, -0.02, 0.62)), b),
    echo: (b) => merge([P.sph(0, 0.02, 0, 0.68, 14, null, [1, 0.96, 1]), P.sph(0.42, -0.34, -0.05, 0.3), P.sph(-0.42, -0.34, -0.05, 0.3), P.cyl(0.32, 1.0, -0.12, 0.035, 0.035, 0.62, 0x5c5c66, null, 5), P.sph(0.32, 1.33, -0.12, 0.09, 6, RED)].concat(HELMET(0, 0.36, -0.02, 0.64, 0x5b6b7a)), b), // 통신병: 파란 헬멧 + 안테나
    clump: (b) => merge([P.sph(0, 0.82, 0.06, 0.86, 14, null, [1, 0.95, 1]), P.sph(0, 0.45, -0.62, 0.6)].concat(TIRE_W(0.95, 0.5, -0.05, 0.42, 0.2, Math.PI / 2), TIRE_W(-0.95, 0.5, -0.05, 0.42, 0.2, Math.PI / 2), HELMET(0, 1.22, 0.02, 0.86)), b), // 헬멧 + 양옆 타이어
    boss: (b) => merge([P.sph(0, 2.0, 0.13, 1.95, 24, null, [1, 0.95, 1]), P.sph(1.75, 1.55, -0.25, 1.25, 12), P.sph(-1.75, 1.55, -0.25, 1.25, 12), P.sph(0, 0.7, -1.3, 1.3, 12), P.sph(1.3, 0.65, 1.15, 0.72, 10), P.sph(-1.3, 0.65, 1.15, 0.72, 10),
      P.half(0, 3.0, 0.0, 2.35, OLIVE_D, 0.6, 18), P.tor(0, 3.02, 0, 2.3, 0.26, OLIVE_D, null, 32), P.sph(0.9, 4.0, -0.7, 0.6, 8, 0x3e4326, [1, 0.5, 1]), P.tor(0, 1.75, 0.15, 1.95, 0.14, STRAP, [Math.PI / 2 + 0.32, 0, 0], 28)], b), // 찌그러진 헬멧(눌린 자국)·턱끈
    parts: () => RING((x, z, i, a) => (i % 2 ? TIRE_W(x, 0.72, z, 0.5, 0.22, Math.PI / 2 - a) : [P.sph(x, 0.95, z, 0.3, 8, 0x9fa472, [1, 0.84, 1])])).concat([P.tor(0, 0.95, 0, 3.12, 0.12, 0x6f7538, null, 40)], KEY()), spin: true, // 타이어·올리브 공 고리
  };
  // 모쉬 「거울 네온 미로」: 네온 큐브(면이 볼록한 둥근 큐브) · 거울 조각(팔면체) · 보스 = 큰 네온 큐브(시안 조각)
  const CUBE = (x, y, z, s, col) => [P.box(x, y, z, s, col), P.sph(x, y, z, s * 0.63, 12)];
  LK.moshee_mirror = { name: '네온 큐브 안개',
    bubble: (b) => merge(CUBE(0, 0.02, 0, 1.0, 0xc4dcf4).concat([P.box(0.5, 0.56, -0.2, 0.34, CYAN, [0.5, 0.6, 0]), P.box(-0.48, -0.42, -0.3, 0.28, CYAN, [0.4, 0.3, 0])]), b),
    echo: (b) => merge([P.oct(0, 0.02, 0, 0.9, 0xd0e4ff, [1, 1.15, 1]), P.oct(0.5, 0.62, -0.2, 0.3, CYAN, [1, 1.2, 1], [0, 0.4, 0]), P.oct(-0.4, -0.5, -0.2, 0.24, CYAN, [1, 1.2, 1], [0, 0.2, 0])], b), // 거울 조각
    clump: (b) => merge(CUBE(0, 0.85, 0.05, 1.36, 0xc4dcf4).concat(CUBE(0.95, 0.45, -0.2, 0.78, 0xc4dcf4), CUBE(-0.95, 0.45, -0.15, 0.78, 0xc4dcf4), [P.box(0.3, 1.72, -0.3, 0.4, CYAN, [0.5, 0.7, 0]), P.box(-0.5, 1.6, -0.2, 0.3, CYAN, [0.3, 0.3, 0])]), b),
    boss: (b) => merge(CUBE(0, 2.02, 0.13, 3.3).concat(CUBE(1.9, 0.85, -0.6, 1.5), CUBE(-1.9, 0.85, -0.6, 1.5), [P.box(1.0, 4.0, -0.5, 0.9, CYAN, [0.5, 0.7, 0]), P.box(-1.1, 3.9, -0.4, 0.7, CYAN, [0.4, 0.3, 0]), P.box(0.1, 4.2, -1.2, 0.55, CYAN, [0.6, 0.5, 0])]), b),
    parts: () => RING((x, z, i, a) => [P.box(x, 1.0, z, i % 2 ? 0.46 : 0.62, i % 2 ? CYAN : 0xe0e8ff, [0.6, a + 0.785, 0])]).concat([P.tor(0, 1.0, 0, 3.12, 0.1, 0x9fb6ff, null, 40)], KEY()), spin: true, // 큐브 고리
  };
  // 쎄니 「별빛 댄스홀」: 별 안개 · 미러볼 뭉치 · 보스 = 진짜 먹구름(넓고 납작한 뭉게구름) + 아래 미러볼(돌아감)
  LK.sseni_hall = { name: '별 안개',
    bubble: (b) => merge([P.sph(0, 0.0, 0, 0.5, 12), P.star(0, 0.0, 0, 0.98, 0.5, 0.42, LAV, 5), P.sph(0, -0.02, -0.5, 0.3)], b),
    echo: (b) => merge([P.sph(0, 0.0, 0, 0.56, 14), P.star(0, 0.0, 0, 1.08, 0.58, 0.46, 0xcfe0ff, 4, 0.785), P.star(0.55, 0.75, -0.15, 0.3, 0.14, 0.2, STARY, 4), P.sph(0, -0.02, -0.5, 0.32)], b),
    clump: (b) => merge([P.ico(0, 0.85, 0.05, 0.95, SILVER), P.cyl(0, 1.95, 0.05, 0.04, 0.04, 0.5, ROD, null, 5), P.tor(0, 2.22, 0.05, 0.14, 0.05, ROD, [0, 0, 0], 10), P.sph(0, 0.4, -0.55, 0.5), P.star(0.95, 1.1, -0.2, 0.3, 0.14, 0.2, STARY, 5), P.star(-0.9, 0.5, -0.2, 0.26, 0.12, 0.18, STARY, 5)], b), // 미러볼(각진 은빛) + 줄·고리 + 별
    boss: (b) => merge([P.sph(0, 2.0, 0.2, 1.75, 24, null, [1, 0.9, 1]), P.sph(1.55, 1.65, -0.1, 1.3, 14, null, [1, 0.92, 1]), P.sph(-1.55, 1.65, -0.1, 1.3, 14, null, [1, 0.92, 1]), P.sph(0.95, 2.95, -0.35, 1.05, 12), P.sph(-0.95, 2.9, -0.35, 1.05, 12), P.sph(2.5, 1.35, -0.3, 0.9, 10, null, [1, 0.9, 1]), P.sph(-2.5, 1.35, -0.3, 0.9, 10, null, [1, 0.9, 1]), P.sph(0, 1.2, -1.3, 1.25, 12, null, [1, 0.9, 1]), P.sph(1.3, 1.1, 1.0, 0.75, 10, null, [1, 0.85, 1]), P.sph(-1.3, 1.1, 1.0, 0.75, 10, null, [1, 0.85, 1]), P.sph(0, 3.4, -0.9, 0.8, 10)], b), // 먹구름: 가로로 넓고 아래가 평평
    parts: () => [P.ico(0, -0.45, 0, 1.15, SILVER), P.cyl(0, 0.75, 0, 0.06, 0.06, 0.7, ROD, null, 6), P.star(1.9, 0.3, 0.6, 0.34, 0.15, 0.2, STARY, 5), P.star(-1.8, 0.1, 0.5, 0.3, 0.13, 0.2, STARY, 5), P.star(0.3, -0.2, 1.6, 0.26, 0.12, 0.18, STARY, 5)], spin: true, // 미러볼은 빙글
    bossC: [0, 2.0, 0.2],
  };
  // 베리 「베리 과수원」: 씨앗·열매 안개(꼭지·잎) · 새싹 메아리 · 보스 = 진짜 나무(갈색 줄기·뿌리·가지 + 둥근 초록 수관 + 열매)
  LK.berri_orchard = { name: '씨앗·열매 안개',
    bubble: (b) => merge([P.sph(0, 0.0, 0, 0.64, 12, null, [1, 1.08, 1]), P.cyl(0, 0.74, 0, 0.05, 0.07, 0.26, STEM, null, 6), P.sph(0.3, 0.8, -0.02, 0.3, 8, LEAF, [1.5, 0.22, 0.75]), P.sph(0, -0.06, -0.55, 0.26)], b), // 씨앗·열매: 꼭지 + 잎 하나
    echo: (b) => merge([P.sph(0, 0.0, 0, 0.66, 14, null, [1, 0.98, 1]), P.cyl(0, 0.82, 0, 0.05, 0.06, 0.5, LEAF, null, 6), P.sph(0.34, 1.02, 0, 0.32, 8, LEAF, [1.6, 0.2, 0.8]), P.sph(-0.34, 1.07, 0, 0.32, 8, LEAF, [1.6, 0.2, 0.8]), P.sph(0.42, -0.34, -0.05, 0.28), P.sph(-0.42, -0.34, -0.05, 0.28)], b), // 새싹
    clump: (b) => merge([P.sph(0, 0.95, 0.05, 0.86, 14), P.sph(0.78, 0.5, -0.05, 0.6, 10, BERRY), P.sph(-0.78, 0.5, -0.05, 0.6, 10, BERRY), P.cyl(0, 1.95, 0, 0.06, 0.08, 0.36, STEM, null, 6), P.sph(0.42, 2.0, -0.05, 0.36, 8, LEAF, [1.6, 0.22, 0.8]), P.sph(-0.4, 1.9, -0.05, 0.32, 8, LEAF, [1.5, 0.22, 0.8]), P.sph(0, 0.45, -0.62, 0.5)], b), // 열매 송이
    boss: (b) => merge([P.sph(0, 2.9, 0.1, 1.75, 24, null, [1, 0.92, 1]), P.sph(1.5, 2.45, -0.2, 1.2, 14), P.sph(-1.5, 2.45, -0.2, 1.2, 14), P.sph(0.85, 3.9, -0.35, 1.0, 12), P.sph(-0.85, 3.85, -0.35, 1.0, 12), P.sph(0, 4.2, -0.7, 0.85, 10), P.sph(0, 2.2, -1.2, 1.1, 12), P.sph(2.2, 1.9, 0.1, 0.72, 10), P.sph(-2.2, 1.9, 0.1, 0.72, 10)], b), // 둥근 수관(얼굴 중심 2.9) — 줄기가 아래로 보이게 위로 올림
    parts: () => [P.cyl(0, 1.0, 0.1, 0.6, 0.95, 2.2, STEM, null, 10), P.sph(0.85, 0.08, 0.5, 0.38, 7, STEM, [1, 0.5, 1]), P.sph(-0.8, 0.08, 0.55, 0.36, 7, STEM, [1, 0.5, 1]), P.sph(0.1, 0.06, -0.9, 0.38, 7, STEM, [1, 0.5, 1]), P.cyl(1.0, 2.3, 0.5, 0.12, 0.2, 1.1, STEM, [0, 0, -0.75], 6), P.cyl(-0.95, 2.3, 0.4, 0.12, 0.2, 1.1, STEM, [0, 0, 0.75], 6),
      P.sph(1.1, 3.4, 1.0, 0.3, 8, BERRY), P.sph(-1.4, 3.0, 0.9, 0.28, 8, BERRY), P.sph(0.4, 2.3, 1.45, 0.3, 8, BERRY), P.sph(-0.3, 4.3, 0.7, 0.27, 8, BERRY), P.sph(2.0, 2.3, 0.5, 0.26, 8, BERRY), P.sph(-2.1, 2.6, -0.1, 0.26, 8, BERRY), P.sph(0.9, 4.6, -0.2, 0.26, 8, BERRY), P.sph(-0.9, 1.75, 0.95, 0.25, 8, BERRY)], spin: false, // 줄기·뿌리·가지·열매는 돌지 않음
    bossC: [0, 2.9, 0.1],
  };
  // 지오메트리 만들기: kind = bubble|clump|echo|boss|parts. base = 재질 몸 색(보스는 던전 tint). 외곽선 법선까지 붙여 돌려줌
  LK.build = function (id, kind, base) {
    const L = LK[id] && LK[id].bubble ? LK[id] : LK.pipe;
    const b = base != null ? base : BASE[kind];
    let g = kind === 'parts' ? merge(L.parts(), BASE.parts) : L[kind](b);
    TG.R.addOutlineNormals(g);
    return g;
  };
  LK.get = (id) => (LK[id] && LK[id].bubble ? LK[id] : LK.pipe);
  LK.ids = () => Object.keys(LK).filter((k) => LK[k] && LK[k].bubble);
})();
