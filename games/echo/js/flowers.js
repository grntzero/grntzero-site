/* 톱니골 던전 — 꽃 자국 (2026-11-16 베리): 베리 방울이 지나간 자리·보조 베리가 걸은 자리에 작은 꽃이 남고, 주인공이 밟으면 조금 회복(응원 「버티게」)
   sim = 규칙 계산(1/60초, 난수 없음) / draw = 그리기(인스턴스 1회). 안개·기계와는 아무 판정 없음
   · 작은 꽃: 밟으면 꽃 조각 +1, 4개 모이면 소리 크기 1칸(이미 가득이면 큰 소리 게이지 +4)
   · 큰 꽃(회복 조각, 보조 베리가 15초마다): 밟으면 바로 1칸(가득이면 게이지 +6) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const FL = (TG.FL = { list: [] });
  const MAX = 36, LIFE = 10, LIFE_BIG = 20, NEED = 4;
  let mesh, dummy;

  function flowerTex() {
    return TG.R.canvasTex(128, 128, (c) => {
      c.clearRect(0, 0, 128, 128); c.translate(64, 64);
      const petal = (fill) => { for (let i = 0; i < 5; i++) { c.save(); c.rotate((i / 5) * Math.PI * 2); c.beginPath(); c.ellipse(0, -30, 19, 27, 0, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } else c.stroke(); c.restore(); } };
      c.lineWidth = 9; c.strokeStyle = 'rgba(40,24,52,0.9)'; petal(null);
      petal('#ff8fc4');
      for (let i = 0; i < 5; i++) { c.save(); c.rotate((i / 5) * Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(-5, -36, 6, 10, -0.3, 0, Math.PI * 2); c.fill(); c.restore(); }
      c.fillStyle = '#ffe36b'; c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.fill(); c.lineWidth = 6; c.stroke();
    });
  }

  FL.init = function (scene) {
    const g = new T.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = new T.MeshBasicMaterial({ map: flowerTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    mesh = new T.InstancedMesh(g, m, MAX); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(mesh); dummy = new T.Object3D();
  };
  FL.reset = function () { FL.list.length = 0; FL.petal = 0; FL.healed = 0; FL.stepped = 0; if (mesh) mesh.count = 0; };
  FL.count = () => FL.list.length;
  // 꽃 하나 (big = 회복 조각). 꽉 차면 가장 오래된 작은 꽃을 지움
  FL.add = function (x, z, big) {
    if (TG.AR && TG.AR.blocked(x, z, 0.3)) return null;
    if (FL.list.length >= MAX) { const i = FL.list.findIndex((f) => !f.big); FL.list.splice(i < 0 ? 0 : i, 1); }
    const f = { x, z, t: 0, life: big ? LIFE_BIG : LIFE, big: !!big, rot: ((x * 7.3 + z * 3.1) % 6.283) };
    FL.list.push(f);
    return f;
  };
  // 규칙 계산: 나이 먹기·주인공이 밟으면 회복
  FL.sim = function (dt, P, G, play) {
    const L = FL.list;
    for (let i = 0; i < L.length; i++) {
      const f = L[i]; f.t += dt;
      if (f.t >= f.life) { L.splice(i, 1); i--; continue; }
      if (!play || P.resting || P.airborne || f.t < 0.25) continue;
      const pk = TG.C && TG.C.pathK ? TG.C.pathK() : 1; // 11-18 베리 「꽃길 넓게」: 꽃 자국 폭 +20/40/60%
      const rr = (f.big ? 1.15 : 0.95) * pk;
      if ((P.x - f.x) ** 2 + (P.z - f.z) ** 2 > rr * rr) continue;
      L.splice(i, 1); i--;
      FL.stepped++;
      const FX = TG.FX;
      if (f.big) { heal(P, G, 1, 6, '회복 조각!'); FX.popBurst(f.x, 0.5, f.z, 1.2, [2.3, 1.0, 1.5]); }
      else {
        FL.petal++;
        for (let k = 0; k < 4; k++) FX.emit(FX.CELL.flower, f.x, 0.4, f.z, { vx: TG.fra(-1.5, 1.5), vy: TG.fra(2, 4), vz: TG.fra(-1.5, 1.5), life: 0.5, size: 0.4, size1: 0.1, color: [2.3, 1.1, 1.6], grav: 6, pop: true, vrot: TG.fra(-4, 4), rot: 0 });
        TG.A.play('sfx_pick', { rate: 1.3 + FL.petal * 0.08, gain: 0.35 });
        if (FL.petal >= NEED) { FL.petal = 0; heal(P, G, 1, 4, '꽃 네 송이! 조금 회복!'); }
        else if (TG.C && TG.C.pathHeal && TG.C.pathHeal(P)) { FL.healed++; FX.text('꽃길 회복!', P.x, 4.0, P.z, 'heal'); FX.ring(P.x, P.z, { r0: 0.4, r1: 2.4, dur: 0.4, color: 0xff9ccb, width: 0.22 }); TG.A.syn('rescue'); } // 11-18 꽃길 넓게 2단부터: 밟으면 회복 1칸(10~12초에 1번)
        else FX.text('꽃 ' + FL.petal + '/' + NEED, P.x, 3.2, P.z, 'word');
      }
    }
  };
  function heal(P, G, hp, gauge, msg) {
    const FX = TG.FX;
    if (P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + hp); FL.healed++; FX.text(msg, P.x, 4.0, P.z, 'heal'); }
    else { if (G.addGauge) G.addGauge(gauge); FX.text('가득! 큰 소리 +', P.x, 4.0, P.z, 'word'); }
    for (let k = 0; k < 8; k++) FX.emit(FX.CELL.heart, P.x + TG.fra(-1, 1), 1 + TG.fra(0, 1), P.z + TG.fra(-1, 1), { vy: TG.fra(1.5, 3), life: 0.8, size: 0.45, size1: 0.15, color: [2.3, 0.9, 1.3], rot: 0, pop: true });
    FX.ring(P.x, P.z, { r0: 0.4, r1: 2.6, dur: 0.45, color: 0xff9ccb, width: 0.25 });
    P.glow = Math.max(P.glow || 0, 0.5); P.kick(2.5);
    TG.A.syn('rescue');
  };
  // 그리기: 톡 피어나고(0.3초) 살랑이다가 마지막 1초에 작아짐
  FL.draw = function (t) {
    if (!mesh) return;
    const L = FL.list; let n = 0;
    for (let i = 0; i < L.length && n < MAX; i++) {
      const f = L[i];
      const k = Math.min(1, f.t / 0.3), e = TG.easeOutBack(k);
      const fade = Math.min(1, (f.life - f.t) / 1.0);
      const s = (f.big ? 1.45 : 0.72) * (TG.C && TG.C.pathK ? TG.C.pathK() : 1) * e * fade * (1 + Math.sin(t * 3 + f.rot) * 0.05); // 꽃길 넓게: 그림도 넓게
      dummy.position.set(f.x, f.big ? 0.08 + Math.sin(t * 4 + f.rot) * 0.03 : 0.06, f.z);
      dummy.rotation.set(0, f.rot + Math.sin(t * 1.3 + f.rot) * 0.08, 0);
      dummy.scale.set(s, 1, s);
      dummy.updateMatrix(); mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true;
  };
})();
