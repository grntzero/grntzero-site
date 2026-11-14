/* GRUNT ZERO RE — 허조교(SGT.GUNNER)
   1) assets/models/hejo_r6.glb 가 있으면 그 모델+동작(idle, run, fire, roll, attention, ult, hit, win + 옛 판에서 옮긴 down)
     r6: attack → fire(호각 불며 지시), skill → ult(전체 기상), 「차렷!」은 새 attention(발 쾅 → 차렷). 옛 hejo.glb(attack·skill)도 그대로 읽힘
   2) 없으면 도형으로 만든 임시 허조교(철모·선글라스·독사복·금색 탄띠·크롬 호각·유광 전투화) + 코드 동작 */
(function () {
  'use strict';
  const GZ = window.GZ, T = THREE;
  const H = (GZ.HERO = {});
  H.cfg = { height: 1.9, srcHeight: 1.70, rotY: 0 };   // glb 맞춤값 (hejo_정보.md 에 따라 고침)
  H.kind = 'temp'; H.r6 = false;
  let root, body, J = {}, footRing, fan, fanHalf = -1, mixer = null, actions = {}, curAct = null, glbRoot = null;
  const pose = {}, cur = {};
  const KEYS = ['by', 'bx', 'bz', 'tw', 'hx', 'aLx', 'aLz', 'eLx', 'eLz', 'aRx', 'aRz', 'eRx', 'eRz', 'lLx', 'kL', 'lRx', 'kR'];
  KEYS.forEach((k) => { pose[k] = 0; cur[k] = 0; });
  let runP = 0, kick = 0, kickNew = false, rollSpin = 0;
  // r2: 뼈를 코드로 보정 (새 3D 없이): 겨누기(aim)·비틀기(twist) — 뼈 축 방향을 몰라도 되게 세계 좌표로 계산
  const B = {}, W = { fire: 0, idle: 0, sal: 0, att: 0, run: 0, ult: 0 };
  let blob = null, leanDbg = 0, footOff = 0, ultB = 0;
  const _q = new T.Quaternion(), _q2 = new T.Quaternion(), _bw = new T.Quaternion(), _pw = new T.Quaternion(), _rq = new T.Quaternion(), _id = new T.Quaternion();
  const _a = new T.Vector3(), _b = new T.Vector3(), _t = new T.Vector3();
  let whProp = null, ghostT = 0, dustT = 0;
  // r4: 3/4 자세(stance) — 카메라에 정뒷모습만 보이지 않게 몸을 겨눈 쪽에서 오른쪽으로 비껴 섬(왼팔·고개는 겨눈 쪽). snapT = 「차렷!」 스냅, kickP = 발사 반동 세기
  let stance = 0, snapT = 0, kickP = 1, beltMat = null, beltPlain = null, backMark = null, gearG = [];
  // r5: 달리기 몸 위아래(runSw = 두 발 앞뒤 차이 −1..1) · 「차렷!」 예비동작(windT 1 → 0) · 탄띠 고정용 묶음 자세 값
  let runSw = 0, runSwPrev = 0, bobY = 0, windT = 0, windDur = 0.13, beltBind = null;
  const _q3 = new T.Quaternion(), _q4 = new T.Quaternion(), _v4 = new T.Vector3(), _v5 = new T.Vector3();
  const rotY = (v, a) => { const c = Math.cos(a), sn = Math.sin(a); return [v[0] * c + v[2] * sn, v[1], -v[0] * sn + v[2] * c]; };
  const boneList = [], preQ = [], postQ = [];
  H.poseDbg = null; H.bones = B; H.W = W; let HT = 1.2; H.setHT = (v) => { HT = v; };   // 시험용: {RightArm:[x,y,z,w], ...} 를 넣으면 그 방향으로 겨눔
  function applyWorld(b, q) {
    b.getWorldQuaternion(_bw); b.parent.getWorldQuaternion(_pw);
    b.quaternion.copy(_pw).invert().multiply(q).multiply(_bw);
    b.updateMatrixWorld(true);
  }
  // 뼈 b 에서 자식 c 로 가는 방향을 (허조교 기준) (x,y,z) 로. 왼쪽 = +x, 앞 = +z
  function aim(b, c, x, y, z, w) {
    if (!b || !c || w <= 0.002) return;
    _a.setFromMatrixPosition(b.matrixWorld); _b.setFromMatrixPosition(c.matrixWorld);
    _b.sub(_a).normalize(); _t.set(x, y, z).normalize().applyQuaternion(_rq);
    _q.setFromUnitVectors(_b, _t);
    if (w < 0.998) { _q2.copy(_q); _q.copy(_id).slerp(_q2, w); }
    applyWorld(b, _q);
  }
  function twist(b, x, y, z, ang) {
    if (!b || Math.abs(ang) < 0.0005) return;
    _t.set(x, y, z).applyQuaternion(_rq);
    _q.setFromAxisAngle(_t, ang); applyWorld(b, _q);
  }
  function arm(side, ux, uy, uz, fx, fy, fz, w) {   // side: 'Left' | 'Right'
    aim(B[side + 'Arm'], B[side + 'ForeArm'], ux, uy, uz, w);
    aim(B[side + 'ForeArm'], B[side + 'Hand'], fx, fy, fz, w);
  }
  // 두 마디 팔 뻗기: 손목을 (허조교 기준) (wx,wy,wz) 로, 팔꿈치는 (hx,hy,hz) 쪽으로 꺾음. 팔 길이는 뼈에서 잼
  const _s = new T.Vector3(), _e = new T.Vector3(), _w = new T.Vector3(), _d = new T.Vector3(), _h = new T.Vector3();
  function reach(side, wx, wy, wz, hx, hy, hz, w) {
    const bs = B[side + 'Arm'], be = B[side + 'ForeArm'], bh = B[side + 'Hand'];
    if (!bs || !be || !bh || w <= 0.002) return;
    _s.setFromMatrixPosition(bs.matrixWorld); _e.setFromMatrixPosition(be.matrixWorld); _w.setFromMatrixPosition(bh.matrixWorld);
    root.worldToLocal(_s); root.worldToLocal(_e); root.worldToLocal(_w);
    const l1 = _e.distanceTo(_s), l2 = _w.distanceTo(_e);
    _d.set(wx, wy, wz).sub(_s); let L = _d.length(); const mx = (l1 + l2) * 0.985; if (L > mx) L = mx; _d.normalize();
    const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    _h.set(hx, hy, hz); _h.addScaledVector(_d, -_h.dot(_d)).normalize();
    _e.copy(_s).addScaledVector(_d, a).addScaledVector(_h, h);          // 팔꿈치 자리
    _w.copy(_s).addScaledVector(_d, L);                                 // 손목 자리
    const ux = _e.x - _s.x, uy = _e.y - _s.y, uz = _e.z - _s.z, fx = _w.x - _e.x, fy = _w.y - _e.y, fz = _w.z - _e.z;
    arm(side, ux, uy, uz, fx, fy, fz, w);
  }
  function legs(w, spread) {
    aim(B.LeftUpLeg, B.LeftLeg, spread, -1, 0.02, w); aim(B.LeftLeg, B.LeftFoot, 0.02, -1, -0.04, w);
    aim(B.RightUpLeg, B.RightLeg, -spread, -1, 0.02, w); aim(B.RightLeg, B.RightFoot, -0.02, -1, -0.04, w);
  }
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const footY = () => { let y = 9; for (const n of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) if (B[n]) { _a.setFromMatrixPosition(B[n].matrixWorld); if (_a.y < y) y = _a.y; } return y; };
  function postPose(dt, st, base) {
    const ultOn = st.ultK > 0 && !st.down;
    const fireOn = (st.firing || kick > 0.25) && st.rollK < 0 && !st.down && !st.win && !ultOn && st.skillK <= 0 && windT <= 0 && st.hitK <= 0.35;
    const calm = base === 'idle';
    const e = (k, to, rate) => { W[k] += (to - W[k]) * (1 - Math.exp(-dt * rate)); };
    e('fire', fireOn ? 1 : 0, fireOn ? 26 : 12);
    e('sal', st.salute ? 1 : 0, 7);
    e('att', (st.skillK > 0 || windT > 0) && !ultOn && st.rollK < 0 ? 1 : 0, 30);
    e('idle', calm && !st.salute && !ultOn ? 0.92 : 0, 9);
    e('run', base === 'run' ? 1 : 0, 10);
    e('ult', ultOn ? 1 : 0, ultOn ? 16 : 8);
    root.updateMatrixWorld(true);
    root.getWorldQuaternion(_rq);
    // r3 달리기: 상체가 35~45° 앞으로 쏠리던 것을 12~15°(쏘는 중엔 8°)로 — 골반·다리는 그대로 두고 허리(맨 아래 척추 Spine02)에서 상체를 통째로 세움. 두 번 재서 맞춤
    if (W.run > 0.01 && B.Hips && B.neck && B.Spine) {
      const target = fireOn || W.fire > 0.5 ? 0.14 : 0.235;
      _t.set(0, 0, 1).applyQuaternion(_rq); const fx = _t.x, fy = _t.y, fz = _t.z;
      const leanNow = () => { _a.setFromMatrixPosition(B.Hips.matrixWorld); _b.setFromMatrixPosition(B.neck.matrixWorld); _b.sub(_a); return Math.atan2(_b.x * fx + _b.y * fy + _b.z * fz, _b.y); };
      for (let pass = 0; pass < 2; pass++) { const over = Math.max(0, leanNow() - target) * W.run; if (over < 0.004) break; twist(B.Spine02, 1, 0, 0, -over * (pass ? 1.0 : 1.1)); }   // 뼈 순서: Hips → Spine02(맨 아래) → Spine01 → Spine → neck
      twist(B.neck, 1, 0, 0, 0.06 * W.run);   // 고개는 살짝 앞을 봄
      leanDbg = leanNow();
      // 팔: 상체를 세우면 원래 팔 흔들기가 머리 위로 올라가 「손 흔들기」처럼 보임 → 군인 뜀걸음 팔(팔꿈치 90°, 앞뒤로)로 바꿈. 박자는 발에서 읽음(앞에 나간 발의 반대 팔이 앞으로)
      const fw = (n) => { _a.setFromMatrixPosition(B[n].matrixWorld); return _a.x * fx + _a.y * fy + _a.z * fz; };
      const sw = GZ.clamp((fw('LeftFoot') - fw('RightFoot')) / (H.r6 ? 0.5 : 0.6), -1, 1), wa = W.run * (1 - W.fire);
      runSw = sw;
      if (wa > 0.01) {
        // r5: 팔 흔들기 0.62 → 0.95rad (앞으로 나간 팔은 주먹이 가슴 높이까지), 어깨는 팔과 반대로 비틀림
        // 팔꿈치는 앞으로 나갈수록 덜 굽힘(주먹이 턱이 아니라 가슴 높이에 — 「손 흔들기」처럼 안 보이게)
        const tr = 0.82 * sw, tl = -0.82 * sw, bR = 1.55 - 0.3 * GZ.sat(sw), bL = 1.55 - 0.3 * GZ.sat(-sw);
        arm('Right', -0.22, -Math.cos(tr), Math.sin(tr), -0.04, -Math.cos(tr + bR), Math.sin(tr + bR), wa);
        arm('Left', 0.22, -Math.cos(tl), Math.sin(tl), 0.04, -Math.cos(tl + bL), Math.sin(tl + bL), wa);
        twist(B.Spine01, 0, 1, 0, -0.16 * sw * wa); twist(B.Head, 0, 1, 0, 0.1 * sw * wa);
      }
    } else leanDbg = 0;
    // 대기: 가슴 펴고 팔을 몸에 붙임, 다리 꼬임 풀기, 숨쉬기
    const wi = W.idle * (1 - W.fire) * (1 - W.att);
    if (wi > 0.01) {
      const br = Math.sin(performance.now() * 0.0021);
      twist(B.Spine, 1, 0, 0, (-0.1 + br * 0.012) * wi); twist(B.Spine02, 1, 0, 0, br * 0.03 * wi);
      arm('Left', 0.13, -1, 0.0, 0.06, -1, 0.16, wi); arm('Right', -0.13, -1, 0.0, -0.06, -1, 0.16, wi);
      twist(B.LeftArm, 0, 0, 1, br * 0.012 * wi); twist(B.RightArm, 0, 0, 1, -br * 0.012 * wi);
      twist(B.LeftHand, 0.1, -1, 0.2, HT * wi); twist(B.RightHand, -0.1, -1, 0.2, -HT * wi);   // 손바닥을 허벅지 쪽으로 (편 손가락이 덜 보이게)
      legs(wi * 0.75, 0.13);
    }
    // 「차렷!」: 부동자세 — 팔을 바지 옆선에, 발뒤꿈치를 붙이고, 가슴을 내밀고 턱을 당김. r4: 척 서는 스냅(처음 0.3초: 움츠렸다가 튕겨 올라와 가슴이 한 번 더 나감)
    if (W.att > 0.01 && !H.r6) {   // r6: attention 동작이 대신함
      const w = W.att, sn = snapT * snapT;
      if (windT > 0) {   // r5 예비동작: 오른 무릎을 높이 들고(허벅지 수평 가까이) 가슴을 크게 폄 → 내려찍기
        const k = Math.sin((1 - windT) * Math.PI * 0.5 + 0.35);
        aim(B.RightUpLeg, B.RightLeg, -0.06, -0.35 + 0.1 * (1 - k), 0.95 * k, w); aim(B.RightLeg, B.RightFoot, -0.02, -1, 0.15, w);
        aim(B.LeftUpLeg, B.LeftLeg, 0.05, -1, 0.0, w); aim(B.LeftLeg, B.LeftFoot, 0.02, -1, -0.04, w);
        twist(B.Spine, 1, 0, 0, -0.26 * w); twist(B.Head, 1, 0, 0, -0.08 * w);
        arm('Left', 0.32, -0.9, -0.2, 0.2, -0.6, 0.6, w); arm('Right', -0.32, -0.9, -0.2, -0.2, -0.6, 0.6, w);
      } else {
      twist(B.Spine02, 1, 0, 0, 0.1 * sn * w); twist(B.Spine, 1, 0, 0, (-0.2 + 0.16 * sn - 0.1 * Math.sin(snapT * 3.14) ) * w); twist(B.Head, 1, 0, 0, (0.09 - 0.2 * sn) * w);
      arm('Left', 0.1 + 0.25 * sn, -1, 0, 0.04, -1, 0.04 + 0.3 * sn, w); arm('Right', -0.1 - 0.25 * sn, -1, 0, -0.04, -1, 0.04 + 0.3 * sn, w);
      legs(w, 0.035 + 0.1 * sn);
      }
    }
    // 경례 (타이틀·임무 완수): 오른팔을 올려 손끝을 철모 챙에
    if (W.sal > 0.01) {
      const w = W.sal;
      twist(B.Spine, 1, 0, 0, -0.1 * w);
      reach('Right', -0.2, 1.7, 0.13, -1, 0.25, 0.3, w);
      arm('Left', 0.12, -1, 0, 0.05, -1, 0.05, w);
      legs(w, 0.07);
    }
    // 호각: 오른손은 호각을 입에, 왼팔은 겨눈 쪽으로 「지적」. r3: 달리는 중엔 왼팔을 뻗지 않고 굽혀 든다 (「슈퍼맨」 자세 방지)
    if (W.fire > 0.01) {
      const w = W.fire, k = Math.min(1.3, kick * kickP), rk = GZ.sat(W.run), bp = st.beat || 0;
      // r4 반동: 불 때마다 상체가 뒤로 튕기고(허리·가슴), 철모가 끄덕이고, 어깨가 틀리고, 호각 든 팔이 당겨짐 + 박자에 맞춘 잔 반동
      twist(B.Spine02, 1, 0, 0, (-0.09 * k - 0.025 * bp) * w * (1 - rk * 0.5));
      twist(B.Spine, 1, 0, 0, (-0.05 - 0.12 * k) * w * (1 - rk * 0.6));
      twist(B.Spine01, 0, 1, 0, 0.1 * k * w);
      twist(B.Head, 1, 0, 0, (0.2 * k - 0.04) * w);
      reach('Right', -0.05 - 0.02 * k, 1.56 + 0.015 * k, 0.2 - 0.035 * k, -0.6, -0.8 + 0.25 * k, 0.1, w);
      // 왼팔은 「겨눈 쪽」을 가리킴 — 몸이 비껴 서 있는 만큼(stance) 되돌려 계산
      const sa = -stance * (1 - rk * 0.5);
      const up = lerp3(rotY([0.2, 0.02 + 0.13 * k, 1], sa), [0.34, -0.8, 0.42], rk), fo = lerp3(rotY([0.06, 0.06 + 0.22 * k, 1], sa), [-0.05, 0.3 + 0.2 * k, 1], rk);
      arm('Left', up[0], up[1], up[2], fo[0], fo[1], fo[2], w);
    }
    // 고개: 몸은 비껴 서도 시선은 겨눈 쪽 가까이 — 겨눈 쪽과 몸 사이(겨눈 쪽에서 오른쪽으로 0.3rad)에 두어 뒤에서도 선글라스 옆선·턱선이 보이게. 지금 머리 방향을 재서 그 차이만큼만 돌림
    if (st.stance && B.headfront && B.Head && !ultOn && st.rollK < 0 && !st.down && st.hitK <= 0.35) {
      const wS = GZ.sat(Math.abs(stance) / 0.2);
      if (wS > 0.01) {
        _a.setFromMatrixPosition(B.Head.matrixWorld); _b.setFromMatrixPosition(B.headfront.matrixWorld);
        const d = GZ.clamp(GZ.angDiff(st.face - 0.3, Math.atan2(_b.x - _a.x, _b.z - _a.z)), -0.9, 0.9) * wS;
        twist(B.neck, 0, 1, 0, d * 0.45); twist(B.Head, 0, 1, 0, d * 0.55);
      }
    }
    // r3 「전체 기상!」: 두 손 든 「항복」 대신 — 다리를 벌려 버티고, 호각을 길게 불며(오른손 입), 왼팔을 뒤로 당겼다가 터지는 순간 앞으로 힘차게 뻗어 지휘
    if (W.ult > 0.01 && !H.r6) {   // r6: ult 동작이 대신함
      const w = W.ult, t = st.ultT < 0 ? 1.2 : st.ultT, k1 = GZ.smooth(t / 0.6), k2 = GZ.smooth((t - 0.72) / 0.1);
      twist(B.Spine02, 1, 0, 0, (-0.12 * k1 + 0.2 * k2) * w); twist(B.Spine, 1, 0, 0, -0.1 * w); twist(B.Head, 1, 0, 0, -0.1 * w);   // 가슴 펴고 숨을 들이마셨다가 터지는 순간 앞으로
      reach('Right', -0.05, 1.56, 0.2, -0.7, -0.6, 0.1, w);
      // 왼팔: 모으는 동안은 주먹을 허리 옆 뒤로 당김 → 터지는 순간 앞·위로 힘차게 뻗어 지휘
      const up = lerp3([0.42, -0.8, -0.38], [0.62, 0.5, 0.7], k2), fo = lerp3([0.1, -0.2, 0.9], [0.6, 0.62, 0.72], k2);
      arm('Left', up[0], up[1], up[2], fo[0], fo[1], fo[2], w);
      aim(B.LeftUpLeg, B.LeftLeg, 0.3, -1, 0.16, w); aim(B.LeftLeg, B.LeftFoot, 0.12, -1, -0.16, w);
      aim(B.RightUpLeg, B.RightLeg, -0.3, -1, -0.12, w); aim(B.RightLeg, B.RightFoot, -0.12, -1, -0.1, w);
    }
    // r6 「전체 기상!」 B안(대표 결정 2026-11-13): 두 손을 다 하늘로 들면 「항복·만세」처럼 읽힘 →
    //   터지는 순간부터 왼팔만 옆·위로 비스듬히 뻗어 「지휘」, 오른손은 호각을 입에 (하늘로 안 듦).
    //   왼팔은 앞으로 뻗지 않음 — 정면 연출 카메라에 손이 크게 들이밀려 화면을 가렸던 문제(r6). 끝난 뒤 동작이 풀리는 동안(ultT<0)도 W.ult 만큼 유지해 두 팔이 다시 솟지 않게
    ultB = 0;
    if (H.r6 && W.ult > 0.01 && (st.ultT > 0.6 || st.ultT < 0)) {
      const w = W.ult * (st.ultT < 0 ? 1 : GZ.smooth((st.ultT - 0.6) / 0.2));
      ultB = w;
      arm('Left', 0.8, 0.6, 0.12, 0.68, 0.72, 0.16, w);   // 옆·위로 약 40° (팔꿈치 거의 폄)
      twist(B.Spine, 1, 0, 0, 0.06 * w); twist(B.Spine01, 0, 1, 0, 0.08 * w);   // 가슴을 살짝 왼팔 쪽으로 열어 「가리키는」 몸
      if (B.Head) {   // 오른손: 호각을 입에 — 「호각」 발사 자세와 같은 자리(머리 기준: 오른쪽 0.095·아래 0.017·앞 0.185)
        _v4.setFromMatrixPosition(B.Head.matrixWorld); root.worldToLocal(_v4);
        reach('Right', _v4.x - 0.095, _v4.y - 0.017, _v4.z + 0.185, -0.7, -0.6, 0.1, w);
      }
    }
    const d = H.poseDbg;
    if (d) for (const n in d) { const b = B[n], v = d[n]; if (!b) continue; if (v.length === 5) twist(b, v[0], v[1], v[2], v[3]); else aim(b, b.children.find((c) => c.isBone) || b.children[0], v[0], v[1], v[2], v[3] == null ? 1 : v[3]); }
    // 손에 든 호각 + 반짝임
    if (whProp) {
      const on = (W.fire > 0.5 || (W.ult > 0.5 && (!H.r6 || ultB > 0.5))) && B.RightHand;   // B안: 전체 기상 뒤 오른손 호각도 보임
      whProp.visible = !!on;
      if (on) {
        _a.setFromMatrixPosition(B.RightHand.matrixWorld); _b.setFromMatrixPosition(B.Head.matrixWorld);
        _a.lerp(_b, 0.25); root.worldToLocal(_a);
        whProp.position.set(_a.x * 0.6, _a.y + 0.02, Math.max(_a.z, 0.2) + 0.06);
        const gk = W.ult > 0.5 ? 0.7 + 0.3 * Math.sin(performance.now() * 0.05) : kick;
        whProp.children[0].material.opacity = 0.2 + gk * 0.8; whProp.children[0].scale.setScalar(0.16 + gk * 0.3);
      }
    }
  }

  function camoTex() {
    return GZ.R.canvasTex(256, 256, (c) => {
      c.fillStyle = '#80582f'; c.fillRect(0, 0, 256, 256);
      const cols = ['#4c3520', '#2a2118', '#5f4526', '#33301c'];
      for (let i = 0; i < 46; i++) {
        c.fillStyle = cols[i % 4];
        const x = Math.random() * 256, y = Math.random() * 256, l = 40 + Math.random() * 70, w = 9 + Math.random() * 14;
        for (let ox = -256; ox <= 256; ox += 256) for (let oy = -256; oy <= 256; oy += 256) {
          c.save(); c.translate(x + ox, y + oy); c.rotate(-0.72);
          c.beginPath(); c.moveTo(-l / 2, 0); c.quadraticCurveTo(-l / 4, -w, 0, -w * 0.6); c.quadraticCurveTo(l / 3, -w * 0.2, l / 2, 0); c.quadraticCurveTo(l / 4, w * 0.8, 0, w * 0.5); c.quadraticCurveTo(-l / 3, w, -l / 2, 0); c.fill();
          c.restore();
        }
      }
    }, { repeat: true });
  }

  function buildTemp() {
    const camo = new T.MeshStandardMaterial({ map: camoTex(), roughness: 0.82, metalness: 0.0 });
    const skin = new T.MeshStandardMaterial({ color: 0xd79a6e, roughness: 0.55, metalness: 0.0 });
    const boot = new T.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.1, metalness: 0.45 });
    const helm = new T.MeshStandardMaterial({ color: 0x1c2019, roughness: 0.16, metalness: 0.55 });
    const glass = new T.MeshStandardMaterial({ color: 0x040405, roughness: 0.04, metalness: 0.9 });
    const gold = GZ.MAT.gold, chrome = GZ.MAT.chrome;
    const tee = new T.MeshStandardMaterial({ color: 0x39422a, roughness: 0.8 });
    const mk = (geo, mat, x, y, z, parent) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const grp = (x, y, z, parent) => { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; };

    body = grp(0, 0.98, 0, root);
    // 골반·탄띠
    const hips = mk(new T.CylinderGeometry(0.25, 0.23, 0.2, 14), camo, 0, -0.05, 0, body); hips.scale.z = 0.72;
    const belt = mk(new T.CylinderGeometry(0.262, 0.262, 0.1, 18), gold, 0, 0.08, 0, body); belt.scale.z = 0.74;
    mk(new T.CylinderGeometry(0.075, 0.075, 0.035, 16), gold, 0, 0.08, 0.2, body).rotation.x = Math.PI / 2;
    mk(new T.TorusGeometry(0.055, 0.012, 6, 14), chrome, 0, 0.08, 0.222, body);
    // 몸통 (넓은 어깨·좁은 허리)
    J.torso = grp(0, 0.12, 0, body);
    const chest = mk(new T.CylinderGeometry(0.37, 0.25, 0.5, 16), camo, 0, 0.26, 0, J.torso); chest.scale.z = 0.66;
    const sh = mk(new T.SphereGeometry(0.37, 16, 10, 0, 6.2832, 0, Math.PI / 2), camo, 0, 0.51, 0, J.torso); sh.scale.set(1, 0.3, 0.66);
    // 가슴 주머니
    mk(new T.BoxGeometry(0.15, 0.13, 0.03), camo, 0.16, 0.36, 0.215, J.torso);
    mk(new T.BoxGeometry(0.15, 0.13, 0.03), camo, -0.16, 0.36, 0.215, J.torso);
    // 깃·속옷
    mk(new T.CylinderGeometry(0.1, 0.13, 0.1, 10), tee, 0, 0.58, 0.01, J.torso);
    // 호각 (목줄 + 크롬)
    const lan = mk(new T.TorusGeometry(0.13, 0.008, 5, 18), glass, 0, 0.47, 0.13, J.torso); lan.rotation.x = 0.5; lan.scale.y = 1.5;
    J.whistle = mk(new T.CylinderGeometry(0.035, 0.035, 0.09, 10), chrome, 0, 0.3, 0.235, J.torso); J.whistle.rotation.z = Math.PI / 2;
    mk(new T.BoxGeometry(0.03, 0.03, 0.06), chrome, 0.03, 0.3, 0.27, J.torso);
    // 머리
    J.head = grp(0, 0.74, 0, J.torso);
    mk(new T.CylinderGeometry(0.075, 0.085, 0.1, 10), skin, 0, -0.06, 0, J.head);
    const face = mk(new T.SphereGeometry(0.165, 18, 14), skin, 0, 0.1, 0, J.head); face.scale.set(0.95, 1.08, 0.98);
    mk(new T.BoxGeometry(0.19, 0.09, 0.1), skin, 0, 0.0, 0.07, J.head);          // 각진 턱
    mk(new T.BoxGeometry(0.03, 0.04, 0.03), skin, 0, 0.08, 0.165, J.head);        // 코
    // 선글라스
    mk(new T.BoxGeometry(0.135, 0.062, 0.03), glass, 0.075, 0.13, 0.15, J.head).rotation.y = 0.12;
    mk(new T.BoxGeometry(0.135, 0.062, 0.03), glass, -0.075, 0.13, 0.15, J.head).rotation.y = -0.12;
    mk(new T.BoxGeometry(0.33, 0.016, 0.02), glass, 0, 0.152, 0.13, J.head);
    // 미소
    mk(new T.BoxGeometry(0.075, 0.012, 0.012), new T.MeshStandardMaterial({ color: 0x7a3f2c, roughness: 0.6 }), 0, 0.035, 0.158, J.head);
    // 철모 + 챙
    const hm = mk(new T.SphereGeometry(0.212, 20, 12, 0, 6.2832, 0, Math.PI * 0.56), helm, 0, 0.14, -0.005, J.head); hm.scale.set(1, 1.0, 1.06);
    const brim = mk(new T.CylinderGeometry(0.235, 0.25, 0.03, 20), helm, 0, 0.165, 0, J.head); brim.scale.z = 1.1; brim.rotation.x = 0.06;
    // 「조교」 글자
    const tx = GZ.R.canvasTex(256, 128, (c) => { c.clearRect(0, 0, 256, 128); c.fillStyle = '#f4f1e6'; c.font = '900 92px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('조교', 128, 68); });
    const tg = new T.CylinderGeometry(0.218, 0.218, 0.105, 12, 1, true, -0.55, 1.1);
    const tm = new T.Mesh(tg, new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: true }));
    tm.position.set(0, 0.265, 0.004); tm.scale.set(0.95, 1, 1.02); tm.rotation.x = -0.2; J.head.add(tm);

    // 팔 (어깨 → 팔꿈치 → 주먹)
    const arm = (sx) => {
      const a = grp(sx * 0.4, 0.5, 0, J.torso);
      mk(new T.SphereGeometry(0.125, 12, 10), camo, 0, 0, 0, a);
      mk(new T.CylinderGeometry(0.11, 0.095, 0.3, 10), camo, 0, -0.16, 0, a);
      const e = grp(0, -0.32, 0, a);
      mk(new T.CylinderGeometry(0.1, 0.085, 0.2, 10), camo, 0, -0.09, 0, e);
      mk(new T.CylinderGeometry(0.105, 0.105, 0.06, 10), camo, 0, -0.17, 0, e);    // 걷은 소매
      mk(new T.CylinderGeometry(0.072, 0.066, 0.1, 10), skin, 0, -0.24, 0, e);
      mk(new T.SphereGeometry(0.095, 10, 8), skin, 0, -0.32, 0, e);
      return [a, e];
    };
    [J.aL, J.eL] = arm(1); [J.aR, J.eR] = arm(-1);
    // 손에 든 호각 (불 때만 보임)
    J.handWh = mk(new T.CylinderGeometry(0.035, 0.035, 0.1, 10), chrome, 0, -0.4, 0.04, J.eR); J.handWh.rotation.x = Math.PI / 2; J.handWh.visible = false;
    // 다리
    const leg = (sx) => {
      const l = grp(sx * 0.14, -0.1, 0, body);
      mk(new T.CylinderGeometry(0.135, 0.115, 0.42, 10), camo, 0, -0.2, 0, l);
      const k = grp(0, -0.42, 0, l);
      mk(new T.CylinderGeometry(0.118, 0.11, 0.26, 10), camo, 0, -0.1, 0, k);
      mk(new T.CylinderGeometry(0.125, 0.125, 0.06, 10), camo, 0, -0.2, 0, k);     // 바짓단
      mk(new T.CylinderGeometry(0.1, 0.11, 0.24, 10), boot, 0, -0.33, 0, k);
      const ft = mk(new T.BoxGeometry(0.2, 0.12, 0.34), boot, 0, -0.4, 0.06, k);
      mk(new T.BoxGeometry(0.215, 0.035, 0.36), new T.MeshStandardMaterial({ color: 0x050506, roughness: 0.5 }), 0, -0.445, 0.06, k);
      return [l, k];
    };
    [J.lL, J.kL] = leg(1); [J.lR, J.kR] = leg(-1);
  }

  H.build = function (scene) {
    root = H.root = new T.Group();
    scene.add(root);
    buildTemp();
    // 발밑 박자 고리 (금색)
    const g = new T.RingGeometry(0.72, 0.82, 40); g.rotateX(-Math.PI / 2);
    footRing = new T.Mesh(g, new T.MeshBasicMaterial({ color: new T.Color(1.2, 0.75, 0.17), transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    footRing.position.y = 0.05; scene.add(footRing);
    fan = new T.Mesh(undefined, new T.MeshBasicMaterial({ color: new T.Color(1.5, 0.95, 0.25), vertexColors: true, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    fan.position.y = 0.06; fan.visible = false; fan.renderOrder = 5; scene.add(fan);
    // r3: 발밑 접지 그림자 (주인공이 바닥에서 떠 보이지 않게 진하게)
    const bt = GZ.R.canvasTex(128, 128, (c) => { const g2 = c.createRadialGradient(64, 64, 4, 64, 64, 62); g2.addColorStop(0, 'rgba(0,0,0,0.78)'); g2.addColorStop(0.45, 'rgba(0,0,0,0.5)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, 128, 128); });
    const bg = new T.PlaneGeometry(2.1, 2.1); bg.rotateX(-Math.PI / 2);
    blob = new T.Mesh(bg, new T.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    blob.position.y = 0.035; blob.renderOrder = 2; scene.add(blob);
  };

  // glb 로 바꿔 끼우기 (hejo_정보.md: 키 1.70 · 발 y=0 · 앞 +Z · 동작 idle, run, attack, roll, hit, down, win, skill)
  H.useGlb = function (gltf) {
    try {
      const sc = gltf.scene;
      const wrap = new T.Group();
      wrap.add(sc); wrap.scale.setScalar(H.cfg.height / H.cfg.srcHeight); wrap.rotation.y = H.cfg.rotY;
      sc.traverse((m) => {
        if (m.isMesh) {
          m.castShadow = true; m.frustumCulled = false;
          if (m.material && m.material.map) { m.material.map.anisotropy = GZ.R.renderer.capabilities.getMaxAnisotropy(); m.material.map.needsUpdate = true; }
          if (GZ.MD && m.material) GZ.MD.glossHero(m.material, H.cfg.height, !!m.material.metalnessMap);   // r6: 금속/거칠기 그림이 있으면 색 고르기 광택 끔
        }
      });
      mixer = new T.AnimationMixer(sc);
      actions = {};
      const want = ['idle', 'run', 'fire', 'attack', 'roll', 'attention', 'ult', 'skill', 'hit', 'down', 'win'];
      (gltf.animations || []).forEach((clip) => {
        const n = clip.name.toLowerCase();
        const key = want.find((w) => n === w) || want.find((w) => n.indexOf(w) >= 0);
        if (key && !actions[key]) {
          const a = mixer.clipAction(clip);
          if (key !== 'idle' && key !== 'run' && key !== 'win' && key !== 'fire') { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; }
          actions[key] = a;
        }
      });
      if (!actions.idle) throw new Error('idle 동작 없음');
      H.r6 = !!(actions.fire && actions.attention && actions.ult);   // r6: 새 동작 3개가 있으면 차렷·전체 기상은 동작 그대로 (코드 자세는 끔)
      H.cfg.belt = !H.r6;                                            // r6: 금 탄띠가 그림+금속 그림에 들어 있음 → 덧씌운 금속 띠는 안 붙임(두껍고 떠 보이던 것)
      body.visible = false;
      glbRoot = wrap; root.add(wrap);
      sc.traverse((o) => { if (o.isBone) { B[o.name] = o; boneList.push(o); preQ.push(o.quaternion.clone()); postQ.push(new T.Quaternion(9, 9, 9, 9)); } });
      addGear(sc);
      // 손에 든 크롬 호각 (불 때만 보임) + 반짝임
      whProp = new T.Group();
      const wm = new T.Mesh(new T.CylinderGeometry(0.038, 0.038, 0.13, 12), GZ.MAT.chrome); wm.rotation.x = Math.PI / 2;
      const gl = new T.Sprite(new T.SpriteMaterial({ map: GZ.FX.glintTex(), color: 0xfff2c8, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      whProp.add(gl, wm); whProp.visible = false; root.add(whProp);
      H.kind = 'glb'; H.clips = Object.keys(actions);
      curAct = null; play('idle', 0);
      return true;
    } catch (e) { console.warn('hejo.glb 연결 실패 → 임시 모델 사용', e); H.kind = 'temp'; if (glbRoot) root.remove(glbRoot); glbRoot = null; mixer = null; body.visible = true; return false; }
  };
  // r4: 유광 황금 탄띠를 「확실한 금속」으로 — 그림 위에 얇은 금속 띠(위아래 테두리·두 줄 구멍) + 네모 버클 판·둥근 문장을 덧씌워 골반 뼈에 붙임(동작을 그대로 따라감).
  //     폭은 그림 탄띠의 1.3배. 뒤통수에도 「조교」 글자(뒷모습에서 누구인지 읽히게) — H.cfg.backMark = false 로 끔
  //     수치는 hejo.glb 원본(키 1.70 기준, 탄띠 중심 y 0.986 · 허리 반폭 x 0.155 / z -0.108~+0.143)에서 잼
  function addGear(sc) {
    root.updateMatrixWorld(true);
    const hips = B.Hips, head = B.Head; if (!hips) return;
    const tex = GZ.R.canvasTex(256, 64, (c) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 64);
      for (let x = 0; x < 256; x += 16) { c.fillStyle = 'rgba(70,38,4,0.9)'; for (const y of [24, 40]) { c.beginPath(); c.arc(x + 8, y, 2.6, 0, 6.2832); c.fill(); } c.fillStyle = 'rgba(120,70,10,0.35)'; c.fillRect(x, 0, 1, 64); }
    }, { repeat: true });
    tex.repeat.set(5, 1); tex.anisotropy = GZ.R.maxAniso || 16;
    beltMat = new T.MeshStandardMaterial({ color: 0xffb428, metalness: 1.0, roughness: 0.2, envMapIntensity: 2.0, emissive: new T.Color(0.2, 0.105, 0.012), map: tex });
    const plain = beltPlain = new T.MeshStandardMaterial({ color: 0xffbe38, metalness: 1.0, roughness: 0.16, envMapIntensity: 2.2, emissive: new T.Color(0.22, 0.12, 0.015) });
    const h = 0.072, hh = h / 2, rx = 0.163, rz = 0.135;   // r5: 조금 얇고 몸에 붙게 (두껍고 떠 보이던 것)
    const pts = [[0.93, -hh], [1.0, -hh], [1.045, -hh + 0.005], [1.045, -hh + 0.014], [1.0, -hh + 0.019], [1.0, hh - 0.019], [1.045, hh - 0.014], [1.045, hh - 0.005], [1.0, hh], [0.93, hh]].map((q) => new T.Vector2(q[0], q[1]));
    const bg = new T.LatheGeometry(pts, 44); bg.scale(rx, 1, rz); bg.computeVertexNormals();
    const g = new T.Group(); g.position.set(0, 0.986, 0.017);
    const band = new T.Mesh(bg, beltMat); g.add(band);
    const plate = new T.Mesh(new T.BoxGeometry(0.094, 0.08, 0.02), plain); plate.position.set(0, 0, rz + 0.008); g.add(plate);
    const em = new T.Mesh(new T.CylinderGeometry(0.031, 0.034, 0.016, 20), plain); em.rotation.x = Math.PI / 2; em.position.set(0, 0, rz + 0.022); g.add(em);
    const ring = new T.Mesh(new T.TorusGeometry(0.02, 0.006, 6, 18), beltMat); ring.position.set(0, 0, rz + 0.031); g.add(ring);
    for (const sx of [-1, 1]) { const k = new T.Mesh(new T.BoxGeometry(0.014, 0.088, 0.024), plain); k.position.set(sx * 0.056, 0, rz + 0.004); g.add(k); }   // 버클 옆 고리
    if (H.cfg.belt !== false) { sc.add(g); g.updateMatrixWorld(true);
    // r5: 묶음 자세에서 탄띠·골반의 「몸(root) 기준」 자세를 기억 → 달릴 때 골반이 앞으로 숙여져도 탄띠는 그 기울기의 30%만 따라감(허리에 수평으로 붙어 있게)
    { const rq = root.getWorldQuaternion(new T.Quaternion()).invert(), hq = hips.getWorldQuaternion(new T.Quaternion()), gq = g.getWorldQuaternion(new T.Quaternion()), hp = hips.getWorldPosition(new T.Vector3()), gp = g.getWorldPosition(new T.Vector3());
      beltBind = { g, qHb: rq.clone().multiply(hq), qGb: rq.clone().multiply(gq), off: gp.sub(hp).applyQuaternion(rq) }; }
    hips.attach(g); gearG.push(g); }
    if (head && H.cfg.backMark !== false) {
      const tx = GZ.R.canvasTex(256, 128, (c) => { c.clearRect(0, 0, 256, 128); c.fillStyle = '#f4f1e6'; c.font = '900 92px "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('조교', 128, 68); });
      // 철모가 각진 저폴리라 표면에 딱 붙이기 어렵다 → 깊이 검사를 끄고, 「뒤에서 볼 때만」 보이게 함(H.update 에서 각도로 밝기 조절)
      const tg = new T.CylinderGeometry(0.122, 0.148, 0.086, 14, 1, true, Math.PI - 0.62, 1.24);
      const tm = backMark = new T.Mesh(tg, new T.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
      tm.renderOrder = 30; tm.scale.set(0.9, 1, 1); tm.position.set(0, 1.60, -0.012);
      sc.add(tm); tm.updateMatrixWorld(true); head.attach(tm); gearG.push(tm);
    }
  }
  // 탄띠: 골반 뼈에 붙어 있되, 골반이 묶음 자세에서 돌아간 만큼의 k 만 따라 돌게 (위치는 골반 자리 + 그 회전으로 돌린 원래 간격)
  function fixBelt(k) {
    const bb = beltBind, hips = B.Hips; hips.updateMatrixWorld(true);
    root.getWorldQuaternion(_q3);
    const hq = hips.getWorldQuaternion(_q4), hp = hips.getWorldPosition(_v4);
    _q.copy(_q3).multiply(bb.qHb);                     // 지금 몸 기준 「묶음 자세 골반」
    _q2.copy(hq).multiply(_q.invert());                // 묶음 자세 이후 골반이 돈 만큼 (세계)
    _q.copy(_id).slerp(_q2, k);                        // 그중 k 만
    const wq = _q.clone().multiply(_q3).multiply(bb.qGb);
    const wp = _v5.copy(bb.off).applyQuaternion(_q3).applyQuaternion(_q).add(hp);
    const g = bb.g; hips.worldToLocal(wp); g.position.copy(wp);
    g.quaternion.copy(hq.invert()).multiply(wq); g.updateMatrixWorld(true);
  }
  function play(name, fade) {
    let a = actions[name] || actions.idle;
    if (a === curAct) return a;
    a.reset(); a.enabled = true; a.paused = false; a.timeScale = 1; a.setEffectiveWeight(1);
    if (curAct) a.crossFadeFrom(curAct, fade == null ? 0.12 : fade, false);
    a.play(); curAct = a;
    return a;
  }
  // 진행도로 직접 모는 동작 (구르기·차렷·맞음): 시각을 직접 넣음
  function drive(name, time, fade) { const a = play(name, fade); a.paused = true; a.time = time; }

  H.kick = function (pow) { kick = 1; kickP = pow || 1; kickNew = true; };
  H.snap = function () { snapT = 1; windT = 0; };
  H.windup = function (d) { windDur = d || 0.13; windT = 1; W.att = 1; };
  H.bodyYaw = () => (root ? root.rotation.y : 0);
  H.gear = () => gearG.map((g) => ({ parent: g.parent && g.parent.name, y: +g.getWorldPosition(new T.Vector3()).y.toFixed(3) }));
  H.setFan = function (on, ang, half, range, x, z) {
    fan.visible = !!on;
    if (!on) return;
    if (Math.abs(half - fanHalf) > 0.001) {
      fanHalf = half; if (fan.geometry) fan.geometry.dispose();
      // r5 조준 표시: 얇은 선 한 줄 → 「음파가 닿는 부채꼴」 — 끝 테는 밝게, 속은 바깥으로 갈수록 옅게 번지고, 가운데 음파 물결 3줄(사격 조준선처럼 안 보이게)
      const g = new T.RingGeometry(0.2, 1, 28, 10, -Math.PI / 2 - half, half * 2); g.rotateX(-Math.PI / 2);
      GZ.FX.shade(g, (x, z) => { const r = Math.hypot(x, z), a = Math.abs(Math.atan2(x, -z)) / half; const edge = r > 0.955 ? 0.95 : 0, wv = Math.max(0, 1 - Math.abs(((r * 3.2) % 1) - 0.5) * 9) * 0.22 * r; return (edge + wv + r * r * 0.12) * (1 - 0.7 * GZ.sat((a - 0.75) / 0.25)); });
      fan.geometry = g;
    }
    fan.position.x = x; fan.position.z = z; fan.rotation.y = ang; fan.scale.set(range, 1, range);
  };

  /* st: {x,z,face,move(0..1),firing,rollK(-1 또는 0..1),hitK(0..1),down,win,skillK(0..1),ultK(0..1),beat(1→0),inv} */
  H.update = function (dt, st) {
    // r4 3/4 자세: 화면 위쪽(st.camU)을 등지고 서면 정뒷모습이 되므로, 몸을 오른쪽으로 최대 0.5rad 비껴 세워 옆선(선글라스·호각 든 손·탄띠 옆)이 보이게. 왼쪽을 볼 때(이미 3/4)는 그대로
    let stT = 0;
    if (st.stance && st.rollK < 0 && !st.down && !st.win && !st.salute && st.camU != null) {
      const rel = GZ.angDiff(st.face, st.camU);
      if (rel > -0.5) stT = -(rel + 0.5) * (1 - GZ.smooth((rel - 0.3) / 0.6));
      if (st.move > 0.1 && !st.firing) stT *= 0.45;   // 달릴 때는 조금만 (게걸음처럼 보이지 않게)
    }
    stance += (stT - stance) * (1 - Math.exp(-dt * 9));
    snapT = Math.max(0, snapT - dt / 0.32);
    root.position.set(st.x, 0, st.z);
    root.rotation.y = st.face + stance;
    footRing.position.x = st.x; footRing.position.z = st.z;
    // r3: 엄지에 가리는 버튼 고리 대신 발밑 고리로 박자를 읽게 — 정박 순간 희게 번쩍
    const fs = st.onBeat ? 1.0 : 1 + (1 - st.beat) * 0.55;
    footRing.scale.setScalar(fs); footRing.material.opacity = st.onBeat ? 0.9 : 0.1 + st.beat * 0.36; footRing.visible = !st.title;   // r4: 평소 밝기를 낮춤 (주인공 뒷면이 고리 빛에 묻히지 않게) — 정박 순간만 희게 번쩍
    if (st.onBeat) footRing.material.color.setRGB(2.2, 2.1, 1.8); else footRing.material.color.setRGB(1.1, 0.7, 0.16);
    if (blob) { blob.position.x = st.x; blob.position.z = st.z; blob.visible = st.rollK < 0; }
    // r2: 무적 동안 모델을 숨기지 않음 — 흰 테두리 번쩍임(셰이더)으로 표시
    root.visible = true;
    if (GZ.MD) GZ.MD.inv.value = st.inv && !st.down && st.rollK < 0 ? 0.55 + 0.45 * Math.sin(performance.now() * 0.03) : 0;
    kick = Math.max(0, kick - dt * 7);
    if (st.move > 0.05) runP += dt * (7 + 6 * st.move);
    // 구르기: 잔상 + 먼지
    if (st.rollK >= 0) {
      ghostT -= dt; dustT -= dt;
      if (ghostT <= 0) { ghostT = 0.09; GZ.FX.ghost(st.x, st.z, st.face); }   // r8: 0.045 → 0.09초
      if (dustT <= 0) { dustT = 0.05; GZ.FX.puff(st.x + (Math.random() - 0.5) * 0.5, 0.25, st.z + (Math.random() - 0.5) * 0.5, 0, 0.7, 0, 0.7, 1.9, 0.5, 0.3, 0xb9a68a); }
    } else { ghostT = 0; dustT = 0; }

    if (H.kind === 'glb' && mixer) {
      kickNew = false;
      let base = 'idle';
      if (st.down) { play('down', 0.15); base = 'down'; }
      else if (st.win && !st.salute) { play('win', 0.2); base = 'win'; }
      else if (st.rollK >= 0) { drive('roll', 0.15 + st.rollK * 1.45, 0.05); base = 'roll'; }
      else if (st.ultK > 0 && H.r6) { const t = st.ultT < 0 ? 2.6 : st.ultT < 0.75 ? st.ultT / 0.75 * 1.8 : Math.min(2.65, 1.8 + (st.ultT - 0.75) * 1.4); drive('ult', t, 0.08); base = 'ult'; }   // r6: 웅크려 모았다가(0.75초 = 터지는 순간) 두 팔을 하늘로
      else if (st.ultK > 0) { const a = play('idle', 0.1); a.paused = false; a.timeScale = 0.2; base = 'ult'; }   // r3: 「항복」처럼 보이던 skill 클립을 안 씀 — postPose 가 자세를 만듦
      else if (H.r6 && (windT > 0 || st.skillK > 0) && !st.win) { const t = windT > 0 ? 0.55 + (1 - windT) * 0.45 : Math.min(1.8, 1.0 + (1 - st.skillK) * 0.8); drive('attention', t, 0.06); base = 'att'; }   // r6 「차렷!」: 예비동작 0.13초 = 발 들기 → 효과가 터질 때 발 쾅(1.0초) → 곧게 섬
      else if (st.hitK > 0.35) { drive('hit', (1 - st.hitK) * 0.75, 0.05); base = 'hit'; }
      else if (st.move > 0.1) { const a = play('run', 0.1); a.paused = false; a.timeScale = 0.85 + 0.3 * st.move; base = 'run'; }
      else if (H.r6 && st.firing && !st.salute) { const a = play('fire', 0.12); a.paused = false; a.timeScale = 1.7; base = 'fire'; }   // r6: 서서 불 때 — 「호각 불며 지시」 동작 전체를 1.7배 (팔은 아래 코드가 겨눈 쪽으로 다듬음)
      else { const a = play('idle', 0.18); a.paused = false; a.timeScale = st.salute || st.skillK > 0 ? 0.25 : 0.8; }
      mixer.update(dt);
      // r4 덧움직임: 발사 반동(뒤로 살짝 밀리고 주저앉았다 올라옴) · 「차렷!」 스냅(움츠렸다가 척 일어섬)
      { const fk = Math.min(1.3, kick * kickP) * W.fire, sn = snapT * snapT;
        glbRoot.rotation.x = -0.035 * fk; glbRoot.position.y = -0.03 * fk - 0.09 * sn * W.att + 0.035 * Math.sin(snapT * 3.14) * W.att; glbRoot.position.z = -0.06 * fk; }
      if (beltMat) { const gl = GZ.MD ? GZ.MD.glow.value : 0; beltMat.emissiveIntensity = 1 + gl * 0.8; beltMat.envMapIntensity = 2.0 - 1.1 * gl; beltPlain.envMapIntensity = 2.2 - 1.2 * gl; }   // 궁극기 번쩍임 속에서 연노랑 납작 면으로 날아가지 않게 반사를 낮춤
      // 믹서는 값이 안 바뀐 뼈를 다시 쓰지 않음 → 지난 프레임 보정이 남아 있으면 원래 값으로 되돌린 뒤 다시 보정 (보정이 쌓이지 않게)
      for (let i = 0; i < boneList.length; i++) { const b = boneList[i]; if (b.quaternion.equals(postQ[i])) b.quaternion.copy(preQ[i]); else preQ[i].copy(b.quaternion); }
      postPose(dt, st, base);
      for (let i = 0; i < boneList.length; i++) postQ[i].copy(boneList[i].quaternion);
      // r5 달리기 몸 위아래: 발이 땅을 밀 때(두 발이 가장 벌어질 때) 낮고, 다리가 모일 때 높게 — 6.5cm
      { const want = W.run > 0.05 && st.rollK < 0 ? (H.r6 ? 0.055 - 0.09 * Math.abs(runSw) : 0.045 - 0.065 * Math.abs(runSw)) * W.run * (1 - W.fire * 0.4) : 0; bobY += (want - bobY) * (1 - Math.exp(-dt * 30)); glbRoot.position.y += bobY; runSwPrev = runSw; }
      windT = Math.max(0, windT - dt / windDur);
      if (beltBind && B.Hips) fixBelt(st.rollK >= 0 || st.down ? 1 : 0.3);
      if (backMark && B.headfront) {   // 뒤통수 「조교」: 카메라가 머리 뒤쪽(±65°)에 있을 때만
        _a.setFromMatrixPosition(B.Head.matrixWorld); _b.setFromMatrixPosition(B.headfront.matrixWorld);
        const fx = _b.x - _a.x, fz = _b.z - _a.z, fl = Math.hypot(fx, fz) || 1, cp = GZ.R.camera.position, cx = cp.x - _a.x, cz = cp.z - _a.z, cl = Math.hypot(cx, cz) || 1;
        const d = -(fx * cx + fz * cz) / (fl * cl);
        backMark.material.opacity = st.rollK >= 0 || st.down ? 0 : 0.92 * GZ.sat((d - 0.42) / 0.25); backMark.visible = backMark.material.opacity > 0.01;
      }
      return;
    }

    // ---- 임시 모델: 목표 자세 계산 ----
    const p = pose, s = Math.sin(runP), c = Math.cos(runP), mv = st.move;
    const br = Math.sin(performance.now() * 0.003) * 0.012;
    p.by = br + Math.abs(s) * 0.07 * mv; p.bx = 0.2 * mv; p.bz = 0; p.tw = s * 0.18 * mv; p.hx = -0.08 * mv;
    p.lLx = -s * 0.95 * mv; p.lRx = s * 0.95 * mv;
    p.kL = (0.2 + 0.95 * Math.max(0, c)) * mv; p.kR = (0.2 + 0.95 * Math.max(0, -c)) * mv;
    p.aLx = s * 0.85 * mv + 0.05; p.aRx = -s * 0.85 * mv + 0.05;
    p.aLz = 0.16; p.aRz = -0.16; p.eLx = -0.35 - 0.9 * mv; p.eRx = -0.35 - 0.9 * mv; p.eLz = 0; p.eRz = 0;
    let rate = 16;
    J.handWh.visible = false; J.whistle.visible = true;
    if (st.firing || kick > 0.05) {
      // 오른손 호각을 입에, 왼손은 앞으로 「지적」
      p.aRx = -1.05; p.aRz = 0.62; p.eRx = -2.2; p.eRz = 0;
      p.aLx = -1.5 - kick * 0.12; p.aLz = 0.05; p.eLx = -0.06;
      p.bx += -0.1 * kick; p.tw = -0.1; p.hx = -0.05 - kick * 0.1;
      J.handWh.visible = true; J.whistle.visible = false; rate = 26;
    }
    if (st.skillK > 0) {  // 「차렷!」: 꼿꼿이, 주먹은 바지 옆선
      p.aLx = 0; p.aRx = 0; p.aLz = 0.03; p.aRz = -0.03; p.eLx = 0; p.eRx = 0; p.lLx = 0; p.lRx = 0; p.kL = 0; p.kR = 0;
      p.bx = -0.1; p.by = 0.06 * st.skillK; p.hx = -0.15; p.tw = 0; rate = 30;
    }
    if (st.ultK > 0) {    // 「전체 기상!」: 호각 불며 왼팔을 하늘로
      p.aRx = -1.05; p.aRz = 0.62; p.eRx = -2.2; p.aLx = 0; p.aLz = 2.75; p.eLx = 0; p.eLz = 0.1;
      p.bx = -0.2; p.hx = -0.25; p.lLx = -0.25; p.lRx = 0.2; p.by = 0.03; rate = 22;
      J.handWh.visible = true; J.whistle.visible = false;
    }
    if (st.win) {         // 경례
      p.aRx = 0; p.aRz = -1.8; p.eRx = 0; p.eRz = 2.25; p.aLx = 0.1; p.aLz = 0.5; p.eLx = -1.3; p.eLz = 0;
      p.bx = -0.06; p.hx = -0.08; p.tw = 0; p.lLx = 0; p.lRx = 0; p.kL = 0; p.kR = 0; rate = 9;
    }
    if (st.hitK > 0) { p.bx = -0.4 * st.hitK; p.aLz = 0.5 + 0.6 * st.hitK; p.aRz = -0.5 - 0.6 * st.hitK; }
    if (st.rollK >= 0) {  // 구르기: 웅크려 한 바퀴
      p.by = -0.45; p.lLx = -1.5; p.lRx = -1.5; p.kL = 2.2; p.kR = 2.2; p.aLx = -1.2; p.aRx = -1.2; p.eLx = -1.8; p.eRx = -1.8; p.aLz = 0; p.aRz = 0; p.hx = 0.4; rate = 40;
      rollSpin = st.rollK * 6.2832;
    } else rollSpin = 0;
    if (st.down) { p.bx = -1.45; p.by = -0.72; p.aLz = 1.2; p.aRz = -1.2; p.aLx = 0; p.aRx = 0; p.eLx = -0.3; p.eRx = -0.3; p.lLx = -0.2; p.lRx = 0.15; p.kL = 0.3; p.kR = 0.1; p.hx = 0.2; rate = 7; }
    const k = 1 - Math.exp(-dt * rate);
    for (const key of KEYS) cur[key] += (p[key] - cur[key]) * k;
    body.position.y = 0.98 + cur.by;
    body.rotation.x = cur.bx + rollSpin; body.rotation.z = cur.bz;
    J.torso.rotation.y = cur.tw; J.head.rotation.x = cur.hx; J.head.rotation.y = -cur.tw * 0.7;
    J.aL.rotation.x = cur.aLx; J.aL.rotation.z = cur.aLz; J.eL.rotation.x = cur.eLx; J.eL.rotation.z = cur.eLz;
    J.aR.rotation.x = cur.aRx; J.aR.rotation.z = cur.aRz; J.eR.rotation.x = cur.eRx; J.eR.rotation.z = cur.eRz;
    J.lL.rotation.x = cur.lLx; J.kL.rotation.x = cur.kL; J.lR.rotation.x = cur.lRx; J.kR.rotation.x = cur.kR;
  };

  // 호각이 있는 자리(음파가 나가는 곳) 높이
  H.mouthY = 1.6;
  H.dbg = () => ({ lean: leanDbg, footOff, W: Object.assign({}, W), bobY, runSw, windT, act: curAct ? curAct.getClip().name : null, r6: H.r6 });
  // 시험용: 탄띠가 몸(root) 위쪽에서 기운 각, 골반이 기운 각 (라디안)
  H.tilt = () => { if (!beltBind || !B.Hips) return null; const up = new T.Vector3(0, 1, 0).applyQuaternion(root.getWorldQuaternion(new T.Quaternion())); const bu = new T.Vector3(0, 1, 0).applyQuaternion(beltBind.g.getWorldQuaternion(new T.Quaternion())); const q0 = root.getWorldQuaternion(new T.Quaternion()).multiply(beltBind.qHb); const hd = B.Hips.getWorldQuaternion(new T.Quaternion()).multiply(q0.invert()); const hu = new T.Vector3(0, 1, 0).applyQuaternion(hd); return { belt: +up.angleTo(bu).toFixed(3), hips: +up.angleTo(hu).toFixed(3), y: +glbRoot.position.y.toFixed(3) }; };
})();
