// 캐릭터: 도형으로 만든 임시 인형(달리기·점프·숙이기·아야·춤·체조 동작을 코드로) + 오리지널 상어 친구 + glb 자동 교체
// 나중에 assets/models/<id>.glb (동작 이름 idle/run/jump/slide/hit/win) 를 넣으면 그 캐릭터는 glb 로 바뀜.
(function () {
  const EK = window.EK, L = EK.lerp;
  // 임시 색·모양 (라온만 확정 시안의 옷 색을 참고, 나머지는 자리 표시용 임시)
  EK.SPECS = {
    raon: { skin: 0xffd9bf, hair: 0x2a1c18, hairStyle: 'curly', top: 0xe0322f, sleeve: 0xfff0d8, bottom: 0x232f55, shoe: 0xe0322f, badge: 0xffd23a, s: 1 },
    haeon: { skin: 0xffdcc4, hair: 0x33221c, hairStyle: 'short', top: 0x2f7fe0, sleeve: 0xfff0d8, bottom: 0x3a3f58, shoe: 0x2f7fe0, badge: 0xffd23a, s: 0.9 },
    sefo: { skin: 0xf6cfb0, hair: 0x1f1a22, hairStyle: 'cap', cap: 0x6244be, top: 0x6244be, sleeve: 0x6244be, bottom: 0x26223a, shoe: 0xffd23a, badge: 0xffd23a, phones: 0xffd23a, s: 1.18 },
    ssel: { skin: 0xffe0cc, hair: 0x6a4a3a, hairStyle: 'bun', top: 0x5fd6c4, sleeve: 0xffffff, bottom: 0x2b1f57, shoe: 0xffffff, badge: 0xffffff, glasses: 0x2b1f57, s: 1.0 },
    sseni: { skin: 0xffdcc4, hair: 0x2a1c18, hairStyle: 'twin', top: 0xff7fae, sleeve: 0xffffff, bottom: 0x7a4fd0, shoe: 0xff7fae, badge: 0xffffff, phones: 0xffffff, s: 0.92 },
    berri: { skin: 0xffd9bf, hair: 0x3a241c, hairStyle: 'bob', top: 0x8e5be6, sleeve: 0xffe07a, bottom: 0x2b1f57, shoe: 0x8e5be6, badge: 0xffe07a, phones: 0xffe07a, s: 0.92 },
    kids: { skin: 0xffdcc4, hair: 0x2f211b, hairStyle: 'cap', cap: 0xffd23a, top: 0xffd23a, sleeve: 0xffd23a, bottom: 0x2f7fe0, shoe: 0xffffff, badge: 0x6244be, s: 0.88 },
  };

  function headParts(sp) {
    const P = [], H = sp.hair;
    P.push(['sph', sp.skin, [0, 0, 0], [0.4, 0.38, 0.38]]);
    P.push(['sphLo', sp.skin, [0.39, -0.03, 0], [0.07, 0.09, 0.06]], ['sphLo', sp.skin, [-0.39, -0.03, 0], [0.07, 0.09, 0.06]]);
    // 눈 · 반짝 · 볼 · 웃는 입
    for (const sx of [1, -1]) {
      P.push(['sphLo', 0x1d1420, [0.15 * sx, 0.0, 0.345], [0.052, 0.07, 0.03]]);
      P.push(['sphLo', 0xffffff, [0.165 * sx, 0.03, 0.372], 0.017]);
      P.push(['sphLo', 0xff9fb0, [0.25 * sx, -0.11, 0.29], [0.07, 0.04, 0.03]]);
      // r3: 처져 보이던 눈썹을 높이 올린 둥근 아치로(가운데가 가장 높음 → 웃는 얼굴)
      P.push(['sphLo', H, [0.118 * sx, 0.142, 0.352], [0.042, 0.015, 0.02], [0, 0, 0.3 * sx]]);
      P.push(['sphLo', H, [0.185 * sx, 0.142, 0.338], [0.042, 0.015, 0.02], [0, 0, -0.3 * sx]]);
      P.push(['sphLo', H, [0.152 * sx, 0.153, 0.347], [0.03, 0.014, 0.02]]);
    }
    // 머리 모양 (입은 따로 달아 활짝 웃을 때 커짐 — Doll 에서)
    const st = sp.hairStyle;
    if (st === 'cap') {
      P.push(['sph', sp.cap, [0, 0.1, -0.02], [0.425, 0.33, 0.41]]);
      P.push(['cyl', sp.cap, [0, 0.13, 0.38], [0.26, 0.035, 0.2]]);
      P.push(['sphLo', H, [0, -0.02, -0.12], [0.41, 0.3, 0.32]]);
    } else {
      P.push(['sph', H, [0, 0.09, -0.05], [0.425, 0.36, 0.4]]);
      if (st === 'curly') { const R = EK.rng(7); for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2, r = 0.2 + R() * 0.16; P.push(['sphLo', H, [Math.cos(a) * r, 0.34 + R() * 0.08 - r * 0.25, Math.sin(a) * r * 0.9 + 0.04], 0.12 + R() * 0.04]); } P.push(['sphLo', H, [0, 0.42, 0.05], 0.13], ['sphLo', H, [0.12, 0.3, 0.3], 0.1], ['sphLo', H, [-0.12, 0.31, 0.3], 0.1], ['sphLo', H, [0, 0.33, 0.33], 0.09]); }
      if (st === 'short') { P.push(['sphLo', H, [0, 0.27, 0.22], [0.33, 0.12, 0.18]], ['sphLo', H, [0.1, 0.44, -0.02], [0.05, 0.09, 0.05], [0, 0, -0.4]]); }
      if (st === 'twin') { P.push(['sphLo', H, [0, 0.27, 0.22], [0.34, 0.11, 0.18]]); for (const sx of [1, -1]) { P.push(['sphLo', H, [0.47 * sx, 0.12, -0.05], [0.13, 0.17, 0.13]], ['sphLo', H, [0.5 * sx, -0.1, -0.05], [0.1, 0.14, 0.1]], ['sphLo', 0xffd23a, [0.4 * sx, 0.2, -0.03], 0.05]); } }
      if (st === 'bob') { P.push(['sphLo', H, [0, 0.27, 0.22], [0.35, 0.11, 0.18]], ['sph', H, [0, -0.06, -0.08], [0.44, 0.3, 0.36]], ['sphLo', 0xffe07a, [0.2, 0.34, 0.24], [0.08, 0.04, 0.05]]); }
      if (st === 'bun') { P.push(['sphLo', H, [0, 0.27, 0.22], [0.34, 0.11, 0.18]], ['sphLo', H, [0, 0.5, -0.1], 0.15]); }
    }
    if (sp.phones) { P.push(['torHalf', sp.phones, [0, 0.02, 0], [0.44, 0.47, 0.44]]); for (const sx of [1, -1]) P.push(['cyl', sp.phones, [0.43 * sx, -0.02, 0], [0.13, 0.08, 0.13], [0, 0, Math.PI / 2]]); }
    if (sp.glasses) { for (const sx of [1, -1]) P.push(['tor', sp.glasses, [0.15 * sx, 0.0, 0.37], [0.085, 0.085, 0.05]]); P.push(['box', sp.glasses, [0, 0.0, 0.38], [0.1, 0.02, 0.02]]); }
    return P;
  }

  function Doll(id) {
    const sp = this.spec = EK.SPECS[id] || EK.SPECS.raon; this.id = id;
    const root = this.group = new THREE.Group(), inner = this.inner = new THREE.Group(); root.add(inner);
    const body = this.body = new THREE.Group(); body.position.y = 0.42; inner.add(body);
    const M = EK.MAT.vc;
    // 몸통(점퍼) + 반바지
    this.torso = EK.mesh([
      ['cap', sp.top, [0, 0.26, 0], [0.52, 0.27, 0.46]],
      ['cyl', 0xfff0d8, [0, 0.05, 0], [0.265, 0.05, 0.235]],
      ['box', 0xd9d9de, [0, 0.27, 0.228], [0.022, 0.36, 0.02]],
      ['sphLo', sp.badge, [0.12, 0.34, 0.215], [0.05, 0.06, 0.02]],
      ['cyl', 0xffffff, [0, 0.5, 0], [0.13, 0.05, 0.12]],
      ['sph', sp.bottom, [0, -0.02, 0], [0.275, 0.17, 0.245]],
    ], M); body.add(this.torso);
    const head = this.head = new THREE.Group(); head.position.y = 0.82; body.add(head);
    head.add(EK.mesh(headParts(sp), M));
    this.mouth = EK.mesh([['sphLo', 0x8c2a34, [0, -0.012, 0], [0.085, 0.05, 0.035]], ['sphLo', 0xffffff, [0, 0.01, 0.02], [0.06, 0.016, 0.02]], ['sphLo', 0xff8fa0, [0, -0.035, 0.012], [0.045, 0.02, 0.02]]], M); this.mouth.position.set(0, -0.138, 0.34); head.add(this.mouth); this.mk = 1;
    const arm = sx => { const g = new THREE.Group(); g.position.set(0.3 * sx, 0.44, 0);
      g.add(EK.mesh([['cap', sp.sleeve, [0, -0.15, 0], [0.19, 0.19, 0.19]], ['cyl', sp.top, [0, -0.3, 0], [0.098, 0.05, 0.098]], ['sphLo', sp.skin, [0, -0.39, 0], 0.09]], M)); body.add(g); return g; };
    this.armA = arm(1); this.armB = arm(-1);
    const leg = sx => { const g = new THREE.Group(); g.position.set(0.13 * sx, 0.42, 0);
      g.add(EK.mesh([['sph', sp.bottom, [0, -0.06, 0], [0.13, 0.13, 0.13]], ['cap', sp.skin, [0, -0.2, 0], [0.16, 0.13, 0.16]], ['cyl', 0xffffff, [0, -0.3, 0], [0.085, 0.07, 0.085]], ['sph', sp.shoe, [0, -0.365, 0.045], [0.115, 0.075, 0.18]], ['sphLo', 0xfff0d8, [0, -0.41, 0.045], [0.118, 0.035, 0.185]]], M)); inner.add(g); return g; };
    this.legA = leg(1); this.legB = leg(-1);
    this.shadow = EK.blob(0.42); root.add(this.shadow);
    root.scale.setScalar(sp.s);
    this.pose = { by: 0, bx: 0, bz: 0, ry: 0, aAx: 0, aBx: 0, aAz: 0.12, aBz: -0.12, lAx: 0, lBx: 0, lAz: 0, lBz: 0, hx: 0, hy: 0, hz: 0, sq: 1 };
    this.tgt = Object.assign({}, this.pose); this.time = 0;
  }
  // st: { action, phase(박자 위상: 1박에 1), y(점프 높이), k(동작 진행 0~1) }
  Doll.prototype.update = function (dt, st) {
    this.time += dt;
    const a = st.action || 'idle'; if (a === 'freeze') return;
    const T = this.tgt, ph = (st.phase != null ? st.phase : this.time * 2.4) * Math.PI, s = Math.sin(ph), c = Math.cos(ph);
    T.by = 0; T.bx = 0; T.bz = 0; T.ry = 0; T.aAz = 0.12; T.aBz = -0.12; T.aAx = 0; T.aBx = 0; T.lAx = 0; T.lBx = 0; T.lAz = 0; T.lBz = 0; T.hx = 0; T.hy = st.look || 0; T.hz = 0; T.sq = 1;
    let rate = 16;
    if (a === 'run') { T.lAx = s * 0.95; T.lBx = -s * 0.95; T.aAx = -s * 1.05; T.aBx = s * 1.05; T.by = Math.abs(c) * 0.07; T.bx = 0.2; T.hx = -0.1; T.bz = s * 0.05; rate = 40; }
    else if (a === 'jump') { T.lAx = -0.9; T.lBx = 0.7; T.aAx = -2.7; T.aBx = -2.7; T.aAz = 0.35; T.aBz = -0.35; T.bx = 0.05; T.hx = -0.15; rate = 20; }
    else if (a === 'slide') { T.bx = -1.05; T.by = -0.2; T.lAx = -1.25; T.lBx = -1.0; T.aAx = 0.7; T.aBx = 0.7; T.hx = 0.75; rate = 24; }
    else if (a === 'hit') { const k = st.k || 0; T.bz = Math.sin(k * 22) * 0.35 * (1 - k); T.aAz = 1.6; T.aBz = -1.6; T.by = Math.sin(k * Math.PI) * 0.12; T.hx = -0.25; T.lAx = 0.3; T.lBx = -0.3; rate = 30; }
    else if (a === 'win' || a === 'dance' || a === 'wiggle') { const b = Math.abs(s), m = a === 'wiggle' ? 0.55 : 1;
      T.by = b * 0.2 * m; T.aAz = (2.3 + c * 0.5) * m + 0.2; T.aBz = -(2.3 - c * 0.5) * m - 0.2; T.bz = c * 0.14 * m; T.ry = Math.sin(ph * 0.5) * 0.45 * m; T.lAz = 0.12; T.lBz = -0.12; T.lAx = c > 0 ? -0.5 * b : 0; T.lBx = c < 0 ? -0.5 * b : 0; T.hz = -c * 0.12; rate = 22; }
    else if (a === 'gymL' || a === 'gymR') { const d = a === 'gymL' ? 1 : -1; T.bz = 0.32 * d; T.aAz = 1.75; T.aBz = -1.75; T.by = Math.abs(s) * 0.05; T.hz = 0.15 * d; T.lAz = 0.2; T.lBz = -0.2; rate = 18; }
    else if (a === 'gymUp') { T.aAz = 2.95; T.aBz = -2.95; T.by = Math.abs(s) * 0.12; T.hx = -0.25; rate = 18; }
    else if (a === 'gymDown') { T.by = -0.24; T.sq = 0.82; T.aAx = -1.5; T.aBx = -1.5; T.lAz = 0.45; T.lBz = -0.45; T.bx = 0.2; rate = 18; }
    else if (a === 'bounce') { T.by = Math.abs(s) * 0.09; T.aAz = 0.5 + c * 0.12; T.aBz = -0.5 + c * 0.12; T.bz = c * 0.06; T.lAz = 0.1; T.lBz = -0.1; T.hz = -c * 0.08; rate = 20; }   // 체조 중 제자리 통통(정면)
    else if (a === 'wave') { T.by = Math.abs(Math.sin(this.time * 2.2)) * 0.03; T.aAz = 2.5 + Math.sin(this.time * 9) * 0.35; T.hz = 0.08; }
    // 얼음 자세(그대로 멈춰라): 한 발 들고 팔을 엉뚱하게 — 목표가 안 변하니 금방 그대로 굳음. v 로 친구마다 다른 자세
    else if (a === 'ice') { const v = st.v || 0; if (v === 1) { T.aAz = 2.6; T.aBz = -2.6; T.lAz = 0.5; T.lBz = -0.5; T.sq = 0.92; T.by = -0.08; T.hz = 0.2; } else if (v === 2) { T.aAx = -1.5; T.aBx = 1.0; T.lAx = 0.9; T.lBx = -0.6; T.bx = 0.25; T.hx = -0.2; } else { T.lAx = -1.3; T.aAz = 2.4; T.aBz = -0.7; T.aBx = -1.3; T.bz = 0.16; T.hz = -0.22; T.hy = 0.5; } rate = 30; }
    // 잠깐 쉬기: 폭신하게 앉아 숨 고르기
    else if (a === 'rest') { T.by = -0.16 + Math.sin(this.time * 3) * 0.02; T.lAx = -1.35; T.lBx = -1.35; T.lAz = 0.25; T.lBz = -0.25; T.aAz = 0.5; T.aBz = -0.5; T.hx = 0.12; T.hz = Math.sin(this.time * 2) * 0.1; rate = 10; }
    // 쎌: 손바닥을 앞으로 쭉 내밀고 「멈춰」 손팻말을 높이 듦
    else if (a === 'shout') { T.aAx = -1.5; T.aAz = 0.1; T.aBx = 0; T.aBz = -2.85 + Math.sin(this.time * 9) * 0.1; T.by = Math.abs(Math.sin(this.time * 9)) * 0.05; T.bz = Math.sin(this.time * 4.5) * 0.05; T.hx = -0.12; rate = 22; }
    else if (a === 'calm') { T.aAx = -1.5; T.aAz = 0.1; T.aBz = -2.85; T.by = Math.sin(this.time * 2.4) * 0.015; T.hz = 0.06; rate = 12; }
    else if (a === 'surprise') { T.aAz = 1.2; T.aBz = -1.2; T.by = 0.05; T.hx = -0.2; T.sq = 1.04; }
    else { T.by = Math.sin(this.time * 2.4) * 0.02; T.aAx = Math.sin(this.time * 2.4) * 0.08; T.aBx = -T.aAx; }
    const P = this.pose, k = Math.min(1, dt * rate);
    for (const n in P) P[n] = L(P[n], T[n], k);
    const b = this.body;
    b.position.y = 0.42 + P.by; b.rotation.set(P.bx, P.ry, P.bz); b.scale.set(1, P.sq, 1);
    this.armA.rotation.set(P.aAx, 0, P.aAz); this.armB.rotation.set(P.aBx, 0, P.aBz);
    this.legA.rotation.set(P.lAx, 0, P.lAz); this.legB.rotation.set(P.lBx, 0, P.lBz);
    this.legA.position.y = this.legB.position.y = 0.42 + Math.min(0, P.by) * 0.6;
    this.head.rotation.set(P.hx, P.hy, P.hz);
    const hap = st.happy || a === 'win' || a === 'dance' || a === 'wave' || a === 'gymUp' ? 1.5 : a === 'hit' || a === 'surprise' ? 0.75 : 1; this.mk = L(this.mk, hap, Math.min(1, dt * 10)); this.mouth.scale.set(this.mk, 0.7 + this.mk * 0.3 + (hap > 1 ? 0.25 : 0), 1);
    this.inner.position.y = st.y || 0;
    const sh = Math.max(0.35, 1 - (st.y || 0) * 0.3); this.shadow.scale.set(0.42 * sh, 1, 0.42 * sh);
  };
  EK.Doll = Doll;
  // 판을 정리할 때 인형·상어 도형을 지움(같이 쓰는 도형은 keep 표시가 있어 남김)
  EK.disposeChar = function (c) { if (!c || !c.group) return;
    // glb: 도형·그림은 원본과 같이 쓰므로 두고, 복제마다 새로 생기는 뼈 그림(skeleton)·복제 재질·동작만 정리
    if (c.isGlb) { c.mixer.stopAllAction(); c.mixer.uncacheRoot(c.mixer.getRoot()); c.group.traverse(o => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose(); if (o.isMesh && o.material) o.material.dispose(); }); return; }
    c.group.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); };
  // 쎌(세포의 비서): 정식 디자인이 없어 임시 인형. 민트 옷·올림머리·안경 + 머리 위 별 더듬이, 「멈춰」 손팻말, 큰 흰 장갑 손바닥으로 다른 캐릭터와 구분
  EK.makeSsel = function () {
    const d = new Doll('ssel'); d.isSsel = true; d.shadow.visible = false;
    d.head.add(EK.mesh([['cyl', 0xffffff, [0, 0.7, -0.1], [0.018, 0.18, 0.018]], ...EK.starParts(0xffd23a, 0, 0.86, -0.1, 0.14, 0.05), ['box', 0xffd23a, [0, -0.36, 0.3], [0.2, 0.09, 0.05]], ['sphLo', 0xffe98a, [0, -0.36, 0.33], 0.05]], EK.MAT.vc));
    d.armA.add(EK.mesh([['sph', 0xffffff, [0, -0.47, 0], [0.17, 0.07, 0.17]], ['sphLo', 0xffffff, [-0.11, -0.47, 0.19], [0.045, 0.06, 0.1]], ['sphLo', 0xffffff, [-0.037, -0.47, 0.22], [0.045, 0.06, 0.12]], ['sphLo', 0xffffff, [0.037, -0.47, 0.22], [0.045, 0.06, 0.12]], ['sphLo', 0xffffff, [0.11, -0.47, 0.19], [0.045, 0.06, 0.1]], ['sphLo', 0xffffff, [0.2, -0.47, 0.03], [0.09, 0.06, 0.05]], ['sphLo', 0xff8fb1, [0, -0.515, 0], [0.07, 0.02, 0.07]]], EK.MAT.vc));
    // 「멈춰」 손팻말(분홍 동그라미 + 흰 손바닥): 글을 몰라도 멈추라는 뜻이 보이게
    d.armB.add(EK.mesh([['cyl', 0xffffff, [0, -0.56, 0], [0.03, 0.34, 0.03]], ['cyl', 0xffffff, [0, -0.92, 0], [0.3, 0.05, 0.3], [Math.PI / 2, 0, 0]], ['cyl', 0xff5c8a, [0, -0.92, 0.012], [0.26, 0.05, 0.26], [Math.PI / 2, 0, 0]], ['sph', 0xffffff, [0, -0.88, 0.05], [0.1, 0.09, 0.02]], ['sphLo', 0xffffff, [-0.075, -1.0, 0.05], [0.027, 0.07, 0.02]], ['sphLo', 0xffffff, [-0.025, -1.02, 0.05], [0.027, 0.08, 0.02]], ['sphLo', 0xffffff, [0.025, -1.02, 0.05], [0.027, 0.08, 0.02]], ['sphLo', 0xffffff, [0.075, -1.0, 0.05], [0.027, 0.07, 0.02]], ['sphLo', 0xffffff, [0.12, -0.86, 0.05], [0.05, 0.03, 0.02]]], EK.MAT.vc));
    return d;
  };

  // ---- glb 캐릭터 (있을 때만) : 같은 update(dt, st) 로 움직임 ----
  function GlbChar(gltf, id) {
    this.id = id; this.isGlb = true;
    const root = this.group = new THREE.Group(), inner = this.inner = new THREE.Group(); root.add(inner);
    const obj = gltf.scene; inner.add(obj);
    // r4: 뼈대 있는 메시는 뼈를 적용한 실제 모양으로 잼(precise). 라온 glb 는 Armature 가 0.01 배라 그냥 재면 키가 0.01 로 나와 162 배로 커지던 것
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, true), h = box.max.y - box.min.y || 1, sc = 1.7 / h;   // r4: 1.62 → 1.7 (머리가 큰 임시 인형 친구들 옆에서 주인공이 작아 보여서)
    obj.scale.setScalar(sc); obj.position.y = -box.min.y * sc; obj.position.x = -(box.min.x + box.max.x) / 2 * sc; obj.position.z = -(box.min.z + box.max.z) / 2 * sc;
    obj.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) o.material = toonOf(o.material); } });   // r5: 툰 재질(3단 그림자)+잉크색 가장자리 — 도형 친구들과 그림체를 맞춤(얼굴 모양은 그대로)
    this.mixer = new THREE.AnimationMixer(obj); this.acts = {}; this.clipNames = [];
    for (const clip of gltf.animations || []) { const n = clip.name.toLowerCase(); this.clipNames.push(n);
      for (const key of ['idle', 'run', 'jump', 'slide', 'hit', 'win']) if (n.indexOf(key) >= 0 && !this.acts[key]) this.acts[key] = this.mixer.clipAction(clip); }
    // r4: 한 번만 하는 동작은 게임 시간(점프 0.66초·숙이기 0.7초·아야 0.55초)에 길이를 맞추고 끝 자세에서 멈춤
    for (const k in GLB_ONCE) { const ac = this.acts[k]; if (!ac) continue; ac.setLoop(THREE.LoopOnce, 1); ac.clampWhenFinished = true; ac.timeScale = ac.getClip().duration / GLB_ONCE[k]; }
    this.cur = null; this.curKey = null; this.act = null; this.shadow = EK.blob(0.42); root.add(this.shadow); this.time = 0;
    // 고개 돌리기(구슬 줄줄이 먹을 때 옆얼굴·뒤돌아 웃기): 동작 위에 머리뼈를 Y축으로 더 돌림. head.rotation.y = 몸 기준 고개 각도(임시 인형과 같은 뜻)
    this.headBone = null; this.bones = {}; obj.traverse(o => { if (o.isBone) { if (!this.bones[o.name]) this.bones[o.name] = o; if (o.name === 'Head' && !this.headBone) this.headBone = o; } });
    this.sq = 0;   // r4: 쪼그려 앉기 정도(0~1) — 체조 「쪼그리기」·잠깐 쉬기는 동작 클립이 없어 뼈를 직접 굽힘
    this.head = { rotation: { y: 0 } }; this._q = new THREE.Quaternion(); this._ax = new THREE.Vector3();
  }
  const GLB_ONCE = { jump: 0.66, slide: 0.7, hit: 0.55 };
  // r5 그림체 맞추기: 사진처럼 부드러운 명암 → 만화처럼 3단 명암 + 가장자리 잉크선(추가 그리기 없이 셰이더에서). 머리 1.2배(친구 인형 비율 쪽으로)
  const HEAD_K = 1.2;
  let GRAD = null;
  function toonOf(src) {
    if (!GRAD) { GRAD = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 214, 214, 214, 255, 255, 255, 255, 255]), 3, 1); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.generateMipmaps = false; GRAD.needsUpdate = true; }
    if (src.map) src.map.anisotropy = 16;   // 화질(갤럭시탭): 캐릭터 그림 비등방 필터 최대(기기 상한으로 잘림)
    const m = new THREE.MeshToonMaterial({ map: src.map || null, color: 0xffffff, gradientMap: GRAD, side: src.side, transparent: !!src.transparent, alphaTest: src.alphaTest || 0 });
    m.color.setRGB(1.1, 1.06, 1.04);   // 조금 밝고 따뜻하게(툰 그림자로 어두워지는 만큼)
    EK.patch(m); const bend = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) { bend(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n float gzRim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));\n gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.17, 0.12, 0.34), smoothstep(0.78, 0.95, gzRim) * 0.8);'); };
    m.userData.toon = true; return m;
  }
  const GLB_MAP = { run: ['run'], idle: ['idle'], jump: ['jump', 'run'], slide: ['slide', 'run'], hit: ['hit', 'idle'], win: ['win', 'idle'], dance: ['win', 'idle'], wiggle: ['win', 'idle'], wave: ['win', 'idle'], surprise: ['hit', 'idle'], gymL: ['win', 'idle'], gymR: ['win', 'idle'], gymUp: ['win', 'jump', 'idle'], gymDown: ['idle'], bounce: ['idle'], rest: ['idle'], shout: ['win', 'idle'], calm: ['idle'] };
  GlbChar.prototype.update = function (dt, st) {
    this.time += dt; const a = st.action || 'idle';
    if (a === 'freeze') return;
    // 그대로 멈춰라(ice): 지금 자세 그대로 굳음(동작 시계를 멈춤)
    this.act = a;
    // r8b 그대로 멈춰라(ice): 우스운 얼음 자세로 굳음 — v 0: 만세+한 발 들기 · 1: 옆으로 기울어 한 팔 번쩍 · 2: 쪼그려 두 팔 벌림 (동작 시계는 멈춤)
    if (a === 'ice') { this.inner.position.y = st.y || 0; const v = st.v || 0;
      if (this.iceV !== v) { this.iceV = v; const B = this.bones; const act = this.acts.win || this.acts.idle; if (act) { for (const k in this.acts) if (this.acts[k] !== act) this.acts[k].stop(); act.reset().play(); act.time = 0.45 * act.getClip().duration; this.mixer.update(0); this.cur = act; this.curKey = 'win'; }
        if (B.LeftUpLeg && B.RightUpLeg) { if (v === 0) { B.LeftUpLeg.rotateX(-1.4); B.LeftLeg.rotateX(1.2); if (B.Spine) B.Spine.rotateZ(0.12); } else if (v === 1) { if (B.Spine) B.Spine.rotateZ(-0.35); B.RightUpLeg.rotateX(-0.6); B.RightLeg.rotateX(1.5); if (B.LeftArm) B.LeftArm.rotateX(-1.2); if (B.RightArm) B.RightArm.rotateZ(1.3); } else { for (const p of ['Left', 'Right']) { B[p + 'UpLeg'].rotateX(-1.0); B[p + 'Leg'].rotateX(1.8); B[p + 'Foot'].rotateX(-0.8); if (B[p + 'Arm']) B[p + 'Arm'].rotateZ(p === 'Left' ? -1.1 : 1.1); } if (B.Hips) B.Hips.position.y -= 0.25 * (this.legLen || 0.6); if (B.Head) B.Head.rotateZ(0.3); } }
        if (this.headBone) this.headBone.scale.setScalar(HEAD_K); }
      return; }
    if (this.iceV != null) { this.iceV = null; if (this.cur) { this.cur.reset(); this.mixer.update(0); } }   // 얼음이 풀리면 동작을 새로 맞춤
    let act = null, key = null; for (const n of (GLB_MAP[a] || ['idle'])) if (this.acts[n]) { act = this.acts[n]; key = n; break; }
    if (act && act !== this.cur) { act.reset().fadeIn(key === 'jump' || key === 'slide' ? 0.08 : 0.15).play(); if (this.cur) this.cur.fadeOut(0.15); this.cur = act; this.curKey = key; }
    // 달리기는 박자에 발을 맞춤: 2박에 한 바퀴(왼발·오른발) — 임시 인형과 같은 박자
    if (key === 'run' && st.phase != null) { const d = act.getClip().duration, f = st.phase / 2; act.time = (f - Math.floor(f)) * d; act.timeScale = 0; }
    else if (key === 'run') act.timeScale = 1;
    this.mixer.update(dt);
    if (this.headBone) this.headBone.scale.setScalar(HEAD_K);
    // 고개: 동작이 정한 머리 자세 위에, 몸의 위쪽(세계 Y)을 축으로 더 돌림
    const hy = this.head.rotation.y = L(this.head.rotation.y, st.look || 0, Math.min(1, dt * 12));
    if (this.headBone && Math.abs(hy) > 1e-3) {
      // 캐릭터(group) 기준 위쪽 축 회전 q 를 머리뼈 부모 좌표로 옮겨(T·q·T⁻¹) 앞에 곱함. T = 부모⁻¹·group (세계 회전)
      const hb = this.headBone, T = this._t || (this._t = new THREE.Quaternion()), G = this._g || (this._g = new THREE.Quaternion()), Ti = this._ti || (this._ti = new THREE.Quaternion());
      this.group.updateWorldMatrix(true, true); hb.parent.getWorldQuaternion(T).invert(); this.group.getWorldQuaternion(G); T.multiply(G); Ti.copy(T).invert();
      this._q.setFromAxisAngle(this._ax.set(0, 1, 0), hy); hb.quaternion.premultiply(T.multiply(this._q).multiply(Ti)); }
    // r4: 쪼그려 앉기(체조 쪼그리기·잠깐 쉬기) — 동작 클립 위에 엉덩이를 내리고 허벅지·무릎·발목을 굽힘. 발바닥은 바닥에 남음
    const sqT = a === 'gymDown' ? 1 : a === 'rest' ? 1.12 : 0; this.sq = L(this.sq, sqT, Math.min(1, dt * 14));
    const B = this.bones, s = this.sq;
    if (s > 1e-3 && B.Hips && B.LeftUpLeg && B.LeftLeg && B.LeftFoot) {
      const th = 1.1 * s;
      const lg = this.legLen || (this.legLen = B.LeftUpLeg.getWorldPosition(new THREE.Vector3()).distanceTo(B.LeftFoot.getWorldPosition(new THREE.Vector3())) / (B.Hips.parent.getWorldScale(new THREE.Vector3()).y || 1));
      for (const p of ['Left', 'Right']) { B[p + 'UpLeg'].rotateX(-th); B[p + 'Leg'].rotateX(th * 2); B[p + 'Foot'].rotateX(-th); }
      B.Hips.position.y -= lg * (1 - Math.cos(th));
      if (B.Spine) B.Spine.rotateX(0.35 * s);
      for (const p of ['Left', 'Right']) if (B[p + 'Arm']) B[p + 'Arm'].rotateX(-0.9 * s);
    }
    // r4: 앞을 볼 때(손 흔들기·체조·만세·쉬기)와 빙글 점프 때(점프 클립은 몸을 웅크려 고개를 숙임) 고개를 살짝 들어 위에 있는 카메라에서 얼굴이 보이게
    const up = a === 'jump' || a === 'wave' || a === 'bounce' || a === 'win' || a === 'rest' || a.indexOf('gym') === 0 ? 1 : 0; this.hup = L(this.hup || 0, up, Math.min(1, dt * 8));
    if (this.headBone && this.hup > 1e-3) this.headBone.rotateX(-0.28 * this.hup);
    // r5 체조 자세를 서로 크게 다르게: 왼쪽/오른쪽 = 두 팔을 올린 채 옆구리를 크게 늘이기(몸통까지 휨), 점프 = 만세하며 실제로 폴짝, 숙이기 = 쪼그리기
    const gk = a === 'gymL' ? 1 : a === 'gymR' ? -1 : 0; this.gl = L(this.gl || 0, gk, Math.min(1, dt * 12));
    if (Math.abs(this.gl) > 1e-3) { const g = this.gl; if (B.Spine01) B.Spine01.rotateZ(ARM.spine * g); if (B.Spine02) B.Spine02.rotateZ(ARM.spine * g); }
    if (a === 'gymUp' && this.prevAct !== 'gymUp') this.hopAt = this.time;
    this.prevAct = a;
    const hop = a === 'gymUp' && this.hopAt != null ? Math.max(0, Math.sin(Math.min(1, (this.time - this.hopAt) / 0.5) * Math.PI)) * 0.45 : 0;
    // 동작 클립이 없을 때 몸 전체로 흉내
    const noSlide = a === 'slide' && !this.acts.slide;
    this.inner.scale.y = L(this.inner.scale.y, noSlide ? 0.5 : 1, Math.min(1, dt * 20));
    this.inner.rotation.z = a === 'gymL' || a === 'gymR' ? ARM.lean * this.gl : a === 'hit' ? Math.sin((st.k || 0) * 22) * 0.3 * (1 - (st.k || 0)) : 0;
    this.inner.position.y = (st.y || 0) + hop;
    const sh = Math.max(0.35, 1 - ((st.y || 0) + hop) * 0.3); this.shadow.scale.set(0.42 * sh, 1, 0.42 * sh);
  };
  const ARM = { spine: -0.12, lean: 0.45 };   // 체조 옆구리 늘이기: 등뼈 휨·몸 기울기(라디안) — 미리보기(tools/pose_preview.py)로 맞춤   // 체조 팔 각도(뼈 Z축, 라디안) — 미리보기로 맞춤
  EK.GlbChar = GlbChar; EK.GLB_ARM = ARM;

  // 캐릭터 만들기: glb 가 있으면 그것, 없으면 임시 인형. (glb 는 미리 EK.probeModel 로 확인)
  EK.glb = {};
  EK.probeModel = async function (id) {
    if (EK.glb[id] !== undefined || EK.Q.has('noglb')) return;
    EK.glb[id] = null;
    const url = EK.Q.get('model_' + id) || ('assets/models/' + id + '.glb');
    try {
      // file://(더블클릭)은 fetch 가 막혀서 js/pack_models.js(glb 를 base64 로 묶은 사본, tools/pack_models.py 로 만듦)를 읽음
      if (location.protocol === 'file:' && !EK.Q.get('model_' + id)) {
        if (!EK.PACK) await new Promise(ok => { const s = document.createElement('script'); s.src = 'js/pack_models.js'; s.onload = s.onerror = ok; document.head.appendChild(s); });
        const b = EK.PACK && EK.PACK[id]; if (!b) return;
        const bin = Uint8Array.from(atob(b), c => c.charCodeAt(0)).buffer;
        EK.glb[id] = await new Promise((ok, no) => new THREE.GLTFLoader().parse(bin, '', ok, no)); return;
      }
      if (!EK.Q.get('model_' + id)) { const r = await fetch(url, { method: 'HEAD' }); if (!r.ok) return; }
      EK.glb[id] = await new Promise((ok, no) => new THREE.GLTFLoader().load(url, ok, undefined, no));
    } catch (e) { EK.glb[id] = null; }
  };
  EK.makeChar = function (id) {
    if (EK.glb[id]) { const g = EK.glb[id]; return new GlbChar({ scene: THREE.SkeletonUtils.clone(g.scene), animations: g.animations }, id); }
    return new Doll(id);
  };

  // ---- 오리지널 상어 친구 (둥글고 통통, 헤드폰·별 무늬 — 다른 회사 캐릭터와 닮지 않게 우리 색·모양) ----
  EK.SHARKS = { boomi: { body: 0x5fd6c4, fin: 0x3fb8a8, acc: 'phones', accC: 0xffd23a }, lala: { body: 0xb9a4ff, fin: 0x9a80f0, acc: 'star', accC: 0xff8fb1 } };
  function Shark(id) {
    const sp = EK.SHARKS[id] || EK.SHARKS.boomi; this.id = id;
    const root = this.group = new THREE.Group(), inner = this.inner = new THREE.Group(); root.add(inner);
    const P = [
      ['sph', sp.body, [0, 0, -0.05], [0.5, 0.46, 0.86]],
      ['sph', 0xffffff, [0, -0.1, 0.1], [0.44, 0.38, 0.6]],
      ['sph', sp.fin, [0, 0.52, -0.2], [0.07, 0.34, 0.3], [-0.55, 0, 0]],
      ['sph', sp.fin, [0.52, -0.16, 0.0], [0.26, 0.06, 0.17], [0, 0.35, -0.45]],
      ['sph', sp.fin, [-0.52, -0.16, 0.0], [0.26, 0.06, 0.17], [0, -0.35, 0.45]],
    ];
    for (const sx of [1, -1]) {
      P.push(['sphLo', 0x1d1420, [0.24 * sx, 0.12, 0.6], [0.075, 0.095, 0.04]], ['sphLo', 0xffffff, [0.265 * sx, 0.16, 0.635], 0.026], ['sphLo', 0xff9fb0, [0.33 * sx, -0.02, 0.52], [0.08, 0.045, 0.03]]);
    }
    P.push(['sphLo', 0x8c2a34, [0, -0.06, 0.685], [0.13, 0.05, 0.04]], ['sphLo', 0xffffff, [0, -0.035, 0.7], [0.09, 0.018, 0.025]]);
    if (sp.acc === 'phones') { P.push(['torHalf', sp.accC, [0, 0.06, 0.2], [0.52, 0.5, 0.5]], ['cyl', sp.accC, [0.5, 0.05, 0.2], [0.13, 0.08, 0.13], [0, 0, Math.PI / 2]], ['cyl', sp.accC, [-0.5, 0.05, 0.2], [0.13, 0.08, 0.13], [0, 0, Math.PI / 2]]); }
    else { P.push(['ico', sp.accC, [0.2, 0.42, 0.25], [0.11, 0.11, 0.05]], ['sphLo', 0xffffff, [-0.3, 0.3, 0.3], 0.035], ['sphLo', 0xffffff, [-0.2, 0.38, 0.2], 0.03]); }
    inner.add(EK.mesh(P, EK.MAT.vc));
    const tail = this.tail = new THREE.Group(); tail.position.set(0, 0, -0.78); inner.add(tail);
    tail.add(EK.mesh([['sph', sp.body, [0, 0, -0.18], [0.2, 0.2, 0.36]], ['sph', sp.fin, [0, 0.3, -0.62], [0.06, 0.42, 0.2], [-0.75, 0, 0]], ['sph', sp.fin, [0, -0.22, -0.58], [0.06, 0.3, 0.17], [0.85, 0, 0]]], EK.MAT.vc));
    this.shadow = EK.blob(0.5, 0.7); this.shadow.position.y = -1.25; root.add(this.shadow);
    this.time = 0; this.isShark = true; root.scale.setScalar(1.35);
  }
  Shark.prototype.update = function (dt, st) {
    const a = st.action || 'run'; if (a === 'freeze') return;
    this.time += dt; const ph = (st.phase != null ? st.phase : this.time * 2.4) * Math.PI, t = this.time;
    const dance = a === 'win' || a === 'dance' || a === 'wiggle' || a.indexOf('gym') === 0, m = a === 'wiggle' ? 0.6 : 1;
    this.tail.rotation.y = Math.sin(ph) * (dance ? 0.9 : 0.6) * m;
    this.inner.rotation.y = Math.sin(ph) * -0.12 * m + (dance ? Math.sin(ph * 0.5) * 0.5 * m : 0);
    this.inner.rotation.z = dance ? Math.cos(ph) * 0.3 * m : Math.sin(t * 1.7) * 0.06;
    this.inner.rotation.x = a === 'gymUp' ? -0.5 : a === 'gymDown' ? 0.4 : 0;
    this.inner.position.y = Math.sin(t * 2.1) * 0.08 + (dance ? Math.abs(Math.sin(ph)) * 0.22 * m : 0) + (a === 'gymUp' ? 0.3 : a === 'gymDown' ? -0.3 : 0);
  };
  EK.Shark = Shark;
})();
