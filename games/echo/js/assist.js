/* 톱니골 던전 — 보조 캐릭터 (2026-11-16, 기획서 ⑦-A-4): 쎄니(빠르게) · 베리(버티게). 주인공 뒤를 저절로 따라다님(조작 없음)
   · 판정 없음: 안개에 맞지 않고 쓰러지지 않음(안개·보스는 주인공 TG.PL 만 봄). 카드 적용 없음
   · 평소(응원): 쎄니 = 600걸음마다 180걸음 동안 주인공 소리 간격 25% 짧게 / 베리 = 900걸음마다 회복 조각(큰 꽃) + 걸은 자리에 작은 꽃
   · 기본 소리(작게, 피해 0.5배·간격 2배): 쎄니 별 3갈래 / 베리 작은 베리 방울 — 가까운 안개 쪽으로 저절로
   · 큰 소리: 주인공이 큰 소리를 쓰면 함께 — 쎄니 「스타팡팡!」(별이 위에서 떨어짐 + 모두 잠깐 아주 빨라짐) / 베리 「꽃 피었다!」(회복 + 꽃잎 보호막), 60초에 한 번
   · 쎄니 3D 전까지는 보라 별 도형(이름은 보호자 동의 있음). sim = 규칙 계산(1/60초, 난수는 TG.sr 만) / draw = 그리기 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const AS = (TG.AS = { on: false, id: 'none', shots: [] });
  const CHEER = { star: { every: 600, ticks: 180, pct: 0.25 }, flower: { every: 900 } };
  const SHOT = { cdK: 2, dmg: 0.5, range: 7.5, speed: 12, len: 8.5, rad: 0.5 };
  const BIG_CD = 60, FAST_TICKS = 180;
  let scene, vis = null, shotPool = [], starGeo = null;

  AS.init = function (sc) {
    scene = sc;
    // 보조 소리 방울 풀(별·작은 열매 겸용)
    const R = TG.R;
    const shape = new T.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.17 : 0.4, a = (i / 10) * Math.PI * 2 - Math.PI / 2; shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); } shape.closePath();
    starGeo = new T.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false }); starGeo.center();
    const ballGeo = new T.SphereGeometry(0.3, 14, 10);
    const starMat = R.toon({ color: 0xc9a6ff, gain: 1.3, rim: 0.6, spec: 0.3, side: T.DoubleSide }), ballMat = R.toon({ color: 0xff8fc4, gain: 1.2, rim: 0.5, spec: 0.3 });
    for (let i = 0; i < 12; i++) {
      const g = new T.Group(); g.visible = false; scene.add(g);
      const st = new T.Mesh(starGeo, starMat); st.renderOrder = 14; g.add(st); R.addOutline(st, 1.0).renderOrder = 14;
      const bl = new T.Mesh(ballGeo, ballMat); bl.renderOrder = 14; g.add(bl); R.addOutline(bl, 1.0).renderOrder = 14;
      shotPool.push({ g, st, bl, on: false });
    }
    AS.set(TG.assistId || 'none');
  };

  // 보조 고르기: 겉모습을 만들고(쎄니 = 별 도형, 베리 = GLB 두 번째 사본) 자리 초기화
  AS.set = function (id) {
    if (!TG.ASSISTS[id]) id = 'none';
    AS.id = id; AS.def = TG.ASSISTS[id]; AS.on = id !== 'none';
    if (vis) { scene.remove(vis.root); vis.root.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); vis = null; } // 링·별 geometry 정리 (GLB 사본은 캐시라 두 번째부터 같은 scene 그래프를 다시 씀)
    AS.reset();
    if (!AS.on) return;
    const R = TG.R, root = new T.Group(); scene.add(root);
    vis = { root, body: new T.Group(), mixer: null, act: null, ring: null, kind: id };
    root.add(vis.body);
    // 발밑 작은 링(보조 색)
    const ring = new T.Mesh(new T.RingGeometry(0.62, 0.78, 36), new T.MeshBasicMaterial({ color: AS.def.color, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.renderOrder = 8; root.add(ring); vis.ring = ring;
    if (id === 'sseni') { // 별 도형: 큰 보라 별 + 작은 별 2개가 돎 (3D 오면 바꿈)
      const mat = R.toon({ color: 0xa46bff, gain: 1.25, rim: 0.6, spec: 0.3, side: T.DoubleSide });
      const big = new T.Mesh(starGeo, mat); big.scale.setScalar(2.2); big.position.y = 1.5; big.renderOrder = 9; vis.body.add(big); R.addOutline(big, 1.15).renderOrder = 1;
      const eyeMat = new T.MeshBasicMaterial({ color: 0x1b1424 });
      [-0.2, 0.2].forEach((x) => { const e = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), eyeMat); e.position.set(x, 1.62, 0.2); vis.body.add(e); });
      vis.orbit = [];
      for (let i = 0; i < 2; i++) { const s = new T.Mesh(starGeo, mat); s.scale.setScalar(0.8); vis.body.add(s); R.addOutline(s, 1.0).renderOrder = 1; vis.orbit.push(s); }
      vis.ready = true;
    } else if (AS.def.model) { // 베리: GLB 를 따로 한 번 더 풀어 두 번째 사본 (주인공 모델과 뼈를 안 섞음)
      const myVis = vis;
      (AS.cache || (AS.cache = {}))[AS.def.model] = AS.cache[AS.def.model] || TG.M.parse(AS.def.model); // 한 번만 풀어 둠 (타이틀에서 여러 번 바꿔도 다시 안 풂)
      AS.cache[AS.def.model].then((gltf) => {
        if (vis !== myVis) return;
        const model = gltf.scene; model.scale.setScalar(2.3);
        model.traverse((o) => {
          if (!o.isMesh) return;
          const map = o.material.map; if (map) map.anisotropy = TG.R.maxAniso || 4;
          o.material = R.toon({ map, gain: 1.12, gamma: 0.95, sat: 1.1, rim: 0.5, spec: 0.12 }); o.castShadow = true; o.frustumCulled = false; o.renderOrder = 9;
          R.addOutline(o, 1.15).renderOrder = 1;
        });
        myVis.body.add(model);
        const mixer = new T.AnimationMixer(model), clips = {};
        gltf.animations.forEach((c) => { c.tracks.forEach((tr) => { if (/Hips\.position$/.test(tr.name)) { const v = tr.values, x0 = v[0], z0 = v[2]; for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; } } }); clips[c.name] = c; });
        myVis.mixer = mixer; myVis.act = { idle: mixer.clipAction(clips.idle), run: mixer.clipAction(clips.run), cheer: clips.cheer ? mixer.clipAction(clips.cheer) : null };
        myVis.act.idle.play(); myVis.act.run.play(); myVis.act.run.setEffectiveWeight(0);
        if (myVis.act.cheer) { myVis.act.cheer.setLoop(T.LoopOnce, 1); myVis.act.cheer.clampWhenFinished = true; }
        myVis.ready = true;
      }).catch(() => { /* 못 풀면 링만 */ });
    }
  };

  AS.reset = function () {
    const P = TG.PL;
    AS.x = P ? P.x - 2.1 : -2.1; AS.z = P ? P.z - 1.0 : 2.5; AS.px = AS.x; AS.pz = AS.z; AS.vx = AS.vz = 0; AS.yaw = 0; AS.speed = 0; // 처음 자리 = 주인공 왼쪽 뒤
    AS.cheerT = 0; AS.fastT = 0; AS.fast2T = 0; AS.shotCd = 1.2; AS.bigCd = 0; AS.trailAt = 0; AS.walked = 0;
    AS.shotsFired = 0; AS.shotHits = 0; AS.bigs = 0; AS.drops = 0; AS.cheerOn = false;
    AS.shots.length = 0; shotPool.forEach((s) => { s.on = false; s.g.visible = false; });
    AS.cheerFxT = 0;
    if (vis && vis.act && vis.act.cheer) vis.act.cheer.stop();
  };

  // 주인공 소리 간격 배율 (쎄니 응원): 평소 응원 0.75, 스타팡팡 뒤 0.5
  AS.cdMul = function () { return !AS.on ? 1 : AS.fast2T > 0 ? 0.5 : AS.fastT > 0 ? 1 - CHEER.star.pct : 1; };
  AS.spdMul = function () { return AS.on && AS.fast2T > 0 ? 1.25 : 1; };

  // ── 규칙 계산 ──
  AS.sim = function (dt, P, G, play) {
    if (!AS.on) return;
    AS.px = AS.x; AS.pz = AS.z;
    // 따라다니기: 주인공 뒤(보는 반대쪽) 2.3 자리로, 1.3 안쪽으로는 안 붙음
    const bx = P.x - Math.sin(P.yaw) * 2.3, bz = P.z - Math.cos(P.yaw) * 2.3;
    let dx = bx - AS.x, dz = bz - AS.z, d = Math.hypot(dx, dz);
    const maxs = P.MAXSPD * 1.15;
    const tx = d > 0.35 ? (dx / d) * Math.min(maxs, d * 3.2) : 0, tz = d > 0.35 ? (dz / d) * Math.min(maxs, d * 3.2) : 0;
    AS.vx = TG.damp(AS.vx, tx, 9, dt); AS.vz = TG.damp(AS.vz, tz, 9, dt);
    AS.x += AS.vx * dt; AS.z += AS.vz * dt;
    { const hx = AS.x - P.x, hz = AS.z - P.z, hd = Math.hypot(hx, hz); if (hd < 1.3 && hd > 1e-4) { AS.x = P.x + (hx / hd) * 1.3; AS.z = P.z + (hz / hd) * 1.3; } }
    const pp = { x: AS.x, z: AS.z }; TG.AR.push(pp, 0.4); AS.x = pp.x; AS.z = pp.z;
    AS.speed = Math.hypot(AS.vx, AS.vz);
    const ty = AS.speed > 0.6 ? Math.atan2(AS.vx, AS.vz) : Math.atan2(P.x - AS.x, P.z - AS.z);
    AS.yaw += TG.angDiff(AS.yaw, ty) * (1 - Math.exp(-12 * dt));
    AS.walked += Math.hypot(AS.x - AS.px, AS.z - AS.pz);
    AS.fastT = Math.max(0, AS.fastT - 1); AS.fast2T = Math.max(0, AS.fast2T - 1);
    AS.bigCd = Math.max(0, AS.bigCd - dt);
    updateShots(dt, G);
    if (!play) return;
    // 응원
    AS.cheerT++;
    const FX = TG.FX;
    if (AS.def.cheer === 'star') {
      if (AS.cheerT % CHEER.star.every === 0) { AS.fastT = CHEER.star.ticks; AS.cheerOn = true; FX.text('빠르게!', AS.x, 3.0, AS.z, 'cheer'); FX.ring(AS.x, AS.z, { r0: 0.4, r1: 3.2, dur: 0.5, color: 0xc9a6ff, width: 0.25 }); TG.A.syn('charge', { level: 1 }); }
      if (AS.fastT === 1) AS.cheerOn = false;
    } else if (AS.def.cheer === 'flower' && TG.FL) {
      if (AS.cheerT % CHEER.flower.every === 0) { const a = TG.sr() * 6.283; if (TG.FL.add(P.x + Math.cos(a) * 1.6, P.z + Math.sin(a) * 1.6, true)) { AS.drops++; FX.text('회복 조각!', AS.x, 3.0, AS.z, 'heal'); TG.A.pick(); } }
      if (AS.walked - AS.trailAt >= 2.0 && AS.speed > 1.5) { AS.trailAt = AS.walked; TG.FL.add(AS.x, AS.z, false); }
    }
    // 기본 소리: 사거리 안 가장 가까운 안개 쪽으로 (작게)
    AS.shotCd -= dt;
    if (AS.shotCd <= 0) {
      const t = TG.WV.target(AS.x, AS.z, SHOT.range);
      if (t) {
        const dir = Math.atan2(t.x - AS.x, t.z - AS.z);
        AS.shotCd = TG.WV.LV[0].cd * SHOT.cdK;
        AS.shotsFired++;
        if (AS.def.cheer === 'star') [-0.32, 0, 0.32].forEach((o) => fireShot(dir + o, 'star'));
        else fireShot(dir, 'berry');
        AS.yaw = dir;
        if (AS.def.cheer === 'star') TG.A.play('sfx_pick', { rate: 1.6 + TG.fra(-0.1, 0.1), gain: 0.3 }); else TG.A.play('sfx_pop', { rate: 1.7, gain: 0.3 });
      } else AS.shotCd = 0.2;
    }
  };
  function fireShot(dir, kind) {
    const s = shotPool.find((q) => !q.on); if (!s) return;
    Object.assign(s, { on: true, kind, x: AS.x + Math.sin(dir) * 0.6, z: AS.z + Math.cos(dir) * 0.6, dir, r: 0, pr: 0, t: 0, px: 0, pz: 0 });
    s.px = s.x; s.pz = s.z; s.ox = s.x; s.oz = s.z;
    s.g.visible = true; s.st.visible = kind === 'star'; s.st.userData.outline.visible = kind === 'star'; s.bl.visible = kind === 'berry'; s.bl.userData.outline.visible = kind === 'berry';
  }
  function updateShots(dt, G) {
    const F = TG.F;
    for (const s of shotPool) {
      if (!s.on) continue;
      s.t += dt; s.pr = s.r; s.px = s.x; s.pz = s.z;
      s.r += SHOT.speed * dt; s.x = s.ox + Math.sin(s.dir) * s.r; s.z = s.oz + Math.cos(s.dir) * s.r;
      if (s.r >= SHOT.len || TG.AR.blocked(s.x, s.z, 0.2)) { s.on = false; s.g.visible = false; continue; }
      let hit = null;
      for (const u of F.list) { if (u.state !== 'live' || u.spawnT < 0.3 || u.kind === 'cocoon') continue; if (Math.hypot(u.x - s.x, u.z - s.z) < u.r * u.scale + SHOT.rad) { hit = u; break; } }
      if (hit) { AS.shotHits++; G.hitUnit(hit, SHOT.dmg, s.x, s.z, true, 0, s.kind === 'star' ? [1.6, 1.1, 2.4] : [2.2, 1.1, 1.6]); s.on = false; s.g.visible = false; continue; }
      const b = F.boss;
      if (b && b.state === 'fight' && Math.hypot(b.x - s.x, b.z - s.z) < b.r * b.scale + SHOT.rad) { AS.shotHits++; G.hitBoss(SHOT.dmg, s.x, s.z, true, 0); s.on = false; s.g.visible = false; }
    }
  }

  // 주인공 큰 소리 착지 때 (game.js bigSound) — 60초에 한 번 함께
  AS.onBig = function (x, z, G) {
    if (!AS.on || AS.bigCd > 0) return false;
    AS.bigCd = BIG_CD; AS.bigs++;
    const FX = TG.FX, P = TG.PL;
    if (vis && vis.act && vis.act.cheer) { vis.act.cheer.reset(); vis.act.cheer.setEffectiveWeight(1); vis.act.cheer.fadeIn(0.1); vis.act.cheer.play(); vis.cheerT = 0; }
    if (AS.def.cheer === 'star') { // 스타팡팡!: 별 10개가 위에서 떨어져 둘레 안개 퐁 + 모두 잠깐 아주 빨라짐
      FX.text('스타팡팡!', AS.x, 2.4, AS.z, 'cheer');
      AS.fast2T = FAST_TICKS;
      for (let i = 0; i < 10; i++) {
        const a = TG.sr() * 6.283, r = TG.srr(2, 7), sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
        G.after(6 + i * 5, () => {
          for (let k = 0; k < 3; k++) FX.emit(FX.CELL.star, sx + TG.fra(-0.3, 0.3), 9 + k * 0.6, sz, { vy: -16, life: 0.6, size: 0.9 - k * 0.15, size1: 0.6, color: [1.8, 1.2, 2.5], vrot: 6, rot: 0 });
          G.after(34, () => {
            FX.popBurst(sx, 0.4, sz, 1.1, [1.6, 1.1, 2.4]); FX.ring(sx, sz, { r0: 0.3, r1: 2.4, dur: 0.3, color: 0xc9a6ff, width: 0.2 });
            TG.A.play('sfx_pop', { rate: 1.3 + TG.fra(-0.1, 0.1), gain: 0.5 });
            for (const u of TG.F.list) { if (u.state !== 'live' || u.kind === 'cocoon' || u.spawnT < 0.3) continue; if (Math.hypot(u.x - sx, u.z - sz) < 2.0 + u.r * u.scale) G.hitUnit(u, 2, sx, sz, true, 1, [1.6, 1.1, 2.4]); }
            const b = TG.F.boss; if (b && b.state === 'fight' && Math.hypot(b.x - sx, b.z - sz) < 2.0 + b.r * b.scale) G.hitBoss(1, sx, sz, true, 0);
          });
        });
      }
    } else { // 꽃 피었다!: 꽃잎 원 → 주인공 회복 1칸 + 꽃잎 보호막, 둘레 안개 퐁
      FX.text('꽃 피었다!', AS.x, 2.4, AS.z, 'cheer');
      flowerBloom(AS.x, AS.z, G, 6.5, 2, 1);
      if (P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 1); FX.text('회복!', P.x, 4.2, P.z, 'heal'); }
      P.shield = Math.max(P.shield, 1); P.glow = 0.8;
    }
    return true;
  };
  // 꽃잎 원 연출 + 반경 안 안개 퐁 (주인공 베리의 큰 소리도 같이 씀)
  function flowerBloom(x, z, G, R2, dmg, lv) {
    const FX = TG.FX;
    FX.ring(x, z, { r0: 0.6, r1: R2, dur: 0.6, color: 0xff7fb6, width: 0.14, hdr: 1.4 });
    FX.ring(x, z, { r0: 0.6, r1: R2 * 0.85, dur: 0.7, color: 0xfff0a8, width: 0.1, delay: 0.1, hdr: 1.3, alpha: 0.85 });
    FX.ring(x, z, { wall: true, r0: 1.5, r1: R2 * 0.9, dur: 0.6, color: 0xff9ccb, h: 1.4, alpha: 0.4, hdr: 1 });
    for (let p = 0; p < 8; p++) for (let j = 0; j < 5; j++) { const a = (p / 8) * 6.283 + j * 0.12, rr = (j + 1) / 5; FX.emit(j % 2 ? FX.CELL.flower : FX.CELL.heart, x + Math.cos(a) * R2 * rr * 0.9, 0.4, z + Math.sin(a) * R2 * rr * 0.9, { vy: TG.fra(2.5, 5), life: TG.fra(0.8, 1.2), size: TG.fra(0.8, 1.1), size1: 0.3, color: [[2.3, 1.0, 1.5], [2.4, 2.0, 0.9], [2.0, 1.2, 2.2]][(p + j) % 3], grav: 5, vrot: TG.fra(-3, 3), rot: TG.fra(-0.4, 0.4), pop: true }); }
    for (const u of TG.F.list) {
      if (u.state !== 'live' || u.kind === 'cocoon') continue;
      const d = Math.hypot(u.x - x, u.z - z); if (d > R2) continue;
      u.byBig = u.byBig || dmg >= 50;
      G.after(1 + Math.round(d * 2.7), () => { if (u.state === 'live') G.hitUnit(u, dmg, x, z, true, lv, [2.2, 1.1, 1.6]); });
    }
  }
  AS.bloom = flowerBloom;

  // ── 그리기 ──
  const tmpV = new T.Vector3();
  AS.draw = function (dt, t, al) {
    if (!AS.on || !vis) return;
    const x = TG.lerp(AS.px, AS.x, al), z = TG.lerp(AS.pz, AS.z, al);
    vis.root.position.set(x, 0, z); vis.root.rotation.y = AS.yaw;
    vis.ring.material.opacity = AS.fastT > 0 || AS.fast2T > 0 ? 0.6 + Math.sin(t * 14) * 0.35 : 0.8;
    if (vis.kind === 'sseni') {
      vis.body.position.y = Math.sin(t * 2.6) * 0.12 + 0.2;
      vis.body.rotation.z = Math.sin(t * 1.7) * 0.12 + (AS.speed > 1 ? -0.2 : 0);
      vis.orbit.forEach((s, i) => { const a = t * 2.2 + i * Math.PI; s.position.set(Math.cos(a) * 1.0, 1.5 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.0); s.rotation.z = t * 3; });
    } else if (vis.mixer) {
      const f = TG.clamp(AS.speed / (TG.PL.MAXSPD * 0.75), 0, 1);
      const cw = vis.act.cheer && vis.act.cheer.isRunning() ? 1 : 0;
      if (cw) { vis.cheerT = (vis.cheerT || 0) + dt; if (vis.cheerT > 1.8) vis.act.cheer.fadeOut(0.25); }
      vis.act.run.setEffectiveWeight(f * (1 - cw)); vis.act.idle.setEffectiveWeight((1 - f) * (1 - cw));
      vis.act.run.timeScale = TG.clamp(AS.speed / 5.6, 0.6, 1.35);
      vis.mixer.update(dt);
      vis.body.position.y = Math.abs(Math.sin((vis.act.run.time / 0.5) * Math.PI * 2)) * 0.14 * f;
    }
    // 응원 중 반짝
    if ((AS.fastT > 0 || AS.fast2T > 0) && TG.fr() < 0.3) TG.FX.emit(TG.FX.CELL.sparkle, x + TG.fra(-0.8, 0.8), TG.fra(0.5, 2.4), z + TG.fra(-0.8, 0.8), { vy: 1.5, life: 0.35, size: 0.35, size1: 0, color: [1.8, 1.3, 2.5] });
    for (const s of shotPool) {
      if (!s.on) continue;
      const sx = TG.lerp(s.px, s.x, al), sz = TG.lerp(s.pz, s.z, al);
      s.g.position.set(sx, s.kind === 'star' ? 1.3 + Math.sin(s.t * 18) * 0.12 : 0.3 + Math.abs(Math.sin(s.r * 3)) * 0.2, sz);
      s.g.rotation.set(0, s.dir, 0); if (s.kind === 'star') s.st.rotation.z = s.t * 10; else s.bl.rotation.x = -s.r * 3;
    }
  };
  AS.state = function () { return { id: AS.id, x: +AS.x.toFixed(2), z: +AS.z.toFixed(2), fast: AS.fastT, fast2: AS.fast2T, bigCd: +AS.bigCd.toFixed(1), shots: AS.shotsFired, hits: AS.shotHits, bigs: AS.bigs, drops: AS.drops, ready: !!(vis && vis.ready) }; };
})();
