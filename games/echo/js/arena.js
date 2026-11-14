/* 톱니골 던전 — 아레나 「박동탑 광장」: 촘촘한 체크 바닥(원형 돌길·테두리 타일·황동 레일·바닥 톱니), 황동 파이프 울타리·난간, 박동탑(시계 바늘·맥박·가릴 때 반투명), 엄폐물(상자·스피커+톱니 기둥), 증기 분출구, 벽면 톱니, 가로등, 마을 배경
   성능: 단색 소품은 정점 색으로 한 덩이(가까운 것/먼 것), GLB 소품은 인스턴스 + 화면 밖 인스턴스 빼기(AR.cull) */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const AR = (TG.AR = {});
  const W = 40, D = 28; // 아레나 크기
  AR.W = W; AR.D = D;
  AR.bx = W / 2 - 0.9; AR.bz = D / 2 - 0.9; // 움직일 수 있는 범위
  AR.colliders = [];
  AR.towerPos = new T.Vector3(0, 0, -5.2);
  AR.manholes = [[0, 6.2], [-10.5, 1.5], [10.5, -1.5], [-3, -12], [4, 12.2]];
  AR.vents = [[-16.8, -10.8], [16.8, -10.8], [-16.8, 11], [16.8, 11]]; // 구석 분출구 (턱 있음 → 충돌)
  AR.vents2 = [[-9.8, 5.6], [12.0, -4.6], [-4.2, 4.6], [15.6, -2.4]];   // 안쪽 분출구 (바닥에 붙은 격자 → 충돌 없음, 밟고 지나감)
  // 바닥에 박힌 톱니 (충돌 없음): 큰 것 [x, z, 작은 것 쪽 방향(라디안)] — 작은 톱니가 맞물려 반대로 돎
  const FG = { R: 2.0, r: 1.25, d: 2.98, N: 14, n: 9 };
  AR.floorGears = [[4.7, 4.9, 3.665], [-12.2, -7.0, 0.558], [11.2, 7.6, 2.269]];
  // 황동 레일 무늬 (충돌 없음): 둥근 네모 한 바퀴. 레일 위 상자는 「수레」처럼 보이게 놓음
  const RAIL = { x: 13.2, z0: -10.2, z1: 9.4, rad: 2.6 };
  // 엄폐물 — 가장자리(옛 것) + 안쪽(V2f: 어느 자리에서도 화면에 2~3개). 가운데(시작점 0,3.2 · 보스 0,1 · 맨홀) 둘레는 비움
  const CRATES = [[-14.2, 8.6, 0.2], [-15.9, 9.9, -0.35], [14.6, -8.6, 0.4], [16.4, 9.6, 0.1],
    [-6.6, 7.4, 0.3], [-13.4, -3.4, 0.08], [13.2, 3.6, -0.1], [7.4, 1.6, -0.3], [-8.6, -8.2, 0.5]];
  const SPEAKERS = [[14.6, 10.6, -2.5], [-15.6, -8.8, 0.7], [-17.2, 2.6, 1.6],
    [7.6, 7.6, -0.5], [-7.6, -2.2, 0.5], [9.6, -8.0, -0.3]];
  const INNER = [CRATES[4], CRATES[5], CRATES[6], CRATES[7], CRATES[8], SPEAKERS[3], SPEAKERS[4], SPEAKERS[5]]; // 톱니 기둥을 붙일 안쪽 엄폐물
  // 낮은 황동 파이프 난간 (엄폐물 옆에 붙여 한 덩이로): [첫 기둥 x, z, 방향 dx, dz] 기둥 3개·간격 1.2
  const BARS = [[-9.0, -2.0, -1, 0], [7.6, 3.0, 0, 1], [-5.2, 7.6, 1, 0]];

  // ── 텍스처 ──
  const TS = 2 / 3; // 타일 한 칸 (SEFO 발 폭의 약 1.2배) — 작고 촘촘하게
  // 바닥 색 (V2f): 빨간 타일을 기준색 #D9543F 쪽으로, 크림은 #E9D3A8 쪽. 캐릭터(고채도)보다 한 단계 낮게
  const TILE = { red: ['#c25340', '#c85945', '#bb4d3b'], cream: ['#e3cd9f', '#e8d3a7', '#ddc696'], groutR: '#9c3f2e', groutC: '#bfa67c' };
  const TILE_FAR = 'vec3(0.65, 0.34, 0.22)'; // 두 타일 평균색(선형) — 먼 쪽은 이 색으로 섞어 체크 대비를 낮춤
  // 바닥 바탕: 8×8칸 무늬를 되풀이 (가까이서도 줄눈이 또렷). 모래색·흙분홍 중채도, 대비 낮게
  function tileTex() {
    const S = 64, N = 8;
    const t = TG.R.canvasTex(S * N, S * N, (c) => {
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const dk = (i + j) % 2 === 0, v = rnd();
        const base = dk ? TILE.red[(v * 3) | 0] : TILE.cream[(v * 3) | 0];
        const x = i * S, y = j * S;
        c.fillStyle = dk ? TILE.groutR : TILE.groutC; c.fillRect(x, y, S, S);           // 줄눈
        c.fillStyle = base; c.fillRect(x + 2, y + 2, S - 4, S - 4);
        c.fillStyle = dk ? 'rgba(255,205,180,0.20)' : 'rgba(255,255,245,0.34)'; c.fillRect(x + 2, y + 2, S - 4, 3); c.fillRect(x + 2, y + 2, 3, S - 4);
        c.fillStyle = dk ? 'rgba(90,30,20,0.18)' : 'rgba(130,100,65,0.16)'; c.fillRect(x + 2, y + S - 5, S - 4, 3); c.fillRect(x + S - 5, y + 2, 3, S - 4);
        if (v > 0.72) { c.fillStyle = 'rgba(120,60,40,0.07)'; c.beginPath(); c.arc(x + 14 + rnd() * (S - 28), y + 14 + rnd() * (S - 28), 4 + rnd() * 6, 0, 6.3); c.fill(); }
      }
    }, { repeat: true });
    t.anisotropy = TG.R.maxAniso || 8; // 비스듬한 먼 바닥 무아레 줄이기 (밉맵은 캔버스 텍스처 기본)
    return t;
  }
  // 바닥 덧그림(투명 바탕): 박동탑 둘레 원형 돌길 2겹 + 그 사이 살짝 짙은 광장 원 + 가장자리 테두리 타일 + 구석 그늘
  function floorDecoTex() {
    const PPU = 51.2, w = Math.round(W * PPU), h = Math.round(D * PPU);
    return TG.R.canvasTex(w, h, (c) => {
      let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const X = (x) => (x + W / 2) * PPU, Z = (z) => (z + D / 2) * PPU, u = PPU;
      const tx = X(AR.towerPos.x), tz = Z(AR.towerPos.z);
      // 광장 원 (탑 중심): 안쪽 타일을 한 톤 짙게
      c.fillStyle = 'rgba(120,70,48,0.10)'; c.beginPath(); c.arc(tx, tz, 10.9 * u, 0, 6.3); c.fill();
      // 탑 받침 둘레 그늘
      let g = c.createRadialGradient(tx, tz, 4.9 * u, tx, tz, 6.6 * u); g.addColorStop(0, 'rgba(60,35,40,0.30)'); g.addColorStop(1, 'rgba(60,35,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(tx, tz, 6.6 * u, 0, 6.3); c.fill();
      // 원형 돌길: 띠 + 방사형 돌 + 황동 가는 줄
      const band = (r0, r1, n) => {
        c.lineWidth = (r1 - r0) * u; c.strokeStyle = '#b8a688'; c.beginPath(); c.arc(tx, tz, ((r0 + r1) / 2) * u, 0, 6.3); c.stroke();
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * 6.2832, a1 = ((k + 1) / n) * 6.2832 - 0.012;
          c.fillStyle = ['#d3c4a4', '#cab999', '#d9cbad'][(rnd() * 3) | 0];
          c.beginPath(); c.arc(tx, tz, (r1 - 0.05) * u, a0, a1); c.arc(tx, tz, (r0 + 0.05) * u, a1, a0, true); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(255,250,235,0.35)'; c.lineWidth = 2; c.beginPath(); c.arc(tx, tz, (r1 - 0.1) * u, a0 + 0.004, a1 - 0.004); c.stroke();
        }
        c.lineWidth = 4; c.strokeStyle = '#9d7f3c'; [r0 - 0.07, r1 + 0.07].forEach((r) => { c.beginPath(); c.arc(tx, tz, r * u, 0, 6.3); c.stroke(); });
      };
      band(5.25, 6.05, 54);
      band(10.5, 11.3, 96);
      // 황동 레일 한 바퀴 (둥근 네모): 침목(짙은 돌) + 레일 두 줄(짙은 테 → 황동 → 밝은 줄)
      const rr = (inset) => { const x0 = X(-RAIL.x) + inset * u, x1 = X(RAIL.x) - inset * u, y0 = Z(RAIL.z0) + inset * u, y1 = Z(RAIL.z1) - inset * u, r = (RAIL.rad - inset) * u;
        c.beginPath(); c.moveTo(x0 + r, y0); c.lineTo(x1 - r, y0); c.arc(x1 - r, y0 + r, r, -1.5708, 0); c.lineTo(x1, y1 - r); c.arc(x1 - r, y1 - r, r, 0, 1.5708); c.lineTo(x0 + r, y1); c.arc(x0 + r, y1 - r, r, 1.5708, 3.1416); c.lineTo(x0, y0 + r); c.arc(x0 + r, y0 + r, r, 3.1416, 4.7124); c.closePath(); };
      c.lineCap = 'butt';
      rr(0); c.strokeStyle = 'rgba(70,45,40,0.28)'; c.lineWidth = 1.06 * u; c.stroke();                       // 레일 바닥 그늘
      rr(0); c.setLineDash([0.2 * u, 0.46 * u]); c.strokeStyle = '#8a6a4c'; c.lineWidth = 0.92 * u; c.stroke(); // 침목
      rr(0); c.strokeStyle = 'rgba(255,235,200,0.25)'; c.lineWidth = 0.80 * u; c.setLineDash([0.05 * u, 0.61 * u]); c.stroke(); c.setLineDash([]);
      [-0.28, 0.28].forEach((o) => {
        rr(o); c.strokeStyle = '#4a3320'; c.lineWidth = 0.19 * u; c.stroke();
        rr(o); c.strokeStyle = '#c9a23a'; c.lineWidth = 0.115 * u; c.stroke();
        rr(o - 0.02); c.strokeStyle = 'rgba(255,236,160,0.75)'; c.lineWidth = 0.03 * u; c.stroke();
      });
      // 바닥 톱니 자리: 짙은 홈 + 황동 테 + 가운데 축 뚜껑 (톱니 메시는 이 위에서 돎)
      const pit = (gx, gz, R) => {
        const px = X(gx), pz = Z(gz);
        c.fillStyle = '#4b3a44'; c.beginPath(); c.arc(px, pz, (R + 0.2) * u, 0, 6.3); c.fill();
        c.strokeStyle = '#4a3320'; c.lineWidth = 0.22 * u; c.beginPath(); c.arc(px, pz, (R + 0.2) * u, 0, 6.3); c.stroke();
        c.strokeStyle = '#c9a23a'; c.lineWidth = 0.13 * u; c.beginPath(); c.arc(px, pz, (R + 0.2) * u, 0, 6.3); c.stroke();
        c.strokeStyle = 'rgba(255,236,160,0.7)'; c.lineWidth = 0.03 * u; c.beginPath(); c.arc(px, pz, (R + 0.23) * u, 3.4, 5.2); c.stroke();
        for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.2832 + 0.39; c.fillStyle = '#6b4f22'; c.beginPath(); c.arc(px + Math.cos(a) * (R + 0.2) * u, pz + Math.sin(a) * (R + 0.2) * u, 0.05 * u, 0, 6.3); c.fill(); }
        c.fillStyle = '#4a3320'; c.beginPath(); c.arc(px, pz, R * 0.2 * u, 0, 6.3); c.fill();
        c.fillStyle = '#c46a3a'; c.beginPath(); c.arc(px, pz, R * 0.2 * u - 3, 0, 6.3); c.fill();
        c.fillStyle = '#ffd966'; c.beginPath(); c.arc(px - R * 0.05 * u, pz - R * 0.05 * u, R * 0.06 * u, 0, 6.3); c.fill();
      };
      AR.floorGears.forEach(([gx, gz, th]) => { pit(gx, gz, FG.R); });
      AR.floorGears.forEach(([gx, gz, th]) => { pit(gx + Math.cos(th) * FG.d, gz + Math.sin(th) * FG.d, FG.r); });
      // 맞물리는 틈은 다시 짙게 (두 홈의 테가 겹친 곳)
      AR.floorGears.forEach(([gx, gz, th]) => { const mx = gx + Math.cos(th) * (FG.R - 0.05), mz = gz + Math.sin(th) * (FG.R - 0.05); c.fillStyle = '#4b3a44'; c.beginPath(); c.arc(X(mx), Z(mz), 0.42 * u, 0, 6.3); c.fill(); });
      // 안쪽 분출구 둘레: 옅은 물기 자국 (바닥에 붙어 있음)
      AR.vents2.forEach(([vx, vz]) => { const q = c.createRadialGradient(X(vx), Z(vz), 0.8 * u, X(vx), Z(vz), 1.7 * u); q.addColorStop(0, 'rgba(60,40,50,0.22)'); q.addColorStop(1, 'rgba(60,40,50,0)'); c.fillStyle = q; c.beginPath(); c.arc(X(vx), Z(vz), 1.7 * u, 0, 6.3); c.fill(); });
      // 가장자리 테두리 타일 (두 칸 폭의 긴 돌) + 안쪽 황동 줄
      const bw = 2 * TS * u, sl = 2 * TS * u;
      const slab = (x, y, ww, hh) => { c.fillStyle = '#ac9a7c'; c.fillRect(x, y, ww, hh); c.fillStyle = ['#cdbe9f', '#c5b595', '#d2c4a6'][(rnd() * 3) | 0]; c.fillRect(x + 2, y + 2, ww - 4, hh - 4); c.fillStyle = 'rgba(255,252,240,0.32)'; c.fillRect(x + 2, y + 2, ww - 4, 3); };
      for (let x = 0; x < w; x += sl) { slab(x, 0, sl, bw / 2); slab(x - sl / 2, bw / 2, sl, bw / 2); slab(x, h - bw / 2, sl, bw / 2); slab(x - sl / 2, h - bw, sl, bw / 2); }
      for (let y = bw; y < h - bw; y += sl) { slab(0, y, bw / 2, sl); slab(bw / 2, y - sl / 2, bw / 2, sl); slab(w - bw / 2, y, bw / 2, sl); slab(w - bw, y - sl / 2, bw / 2, sl); }
      c.strokeStyle = '#9d7f3c'; c.lineWidth = 5; c.strokeRect(bw + 3, bw + 3, w - 2 * bw - 6, h - 2 * bw - 6);
      c.strokeStyle = 'rgba(70,45,30,0.35)'; c.lineWidth = 2; c.strokeRect(bw + 8, bw + 8, w - 2 * bw - 16, h - 2 * bw - 16);
      // 울타리 쪽 그늘 (깊이감)
      const sh = 2.6 * u;
      [[0, 0, 0, sh, 0, 0, w, sh], [0, h, 0, h - sh, 0, h - sh, w, sh], [0, 0, sh, 0, 0, 0, sh, h], [w, 0, w - sh, 0, w - sh, 0, sh, h]].forEach(([x0, y0, x1, y1, rx, ry, rw, rh]) => {
        const q = c.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, 'rgba(70,40,45,0.22)'); q.addColorStop(1, 'rgba(70,40,45,0)'); c.fillStyle = q; c.fillRect(rx, ry, rw, rh);
      });
    });
  }
  function cobbleTex() {
    return TG.R.canvasTex(256, 256, (c) => {
      c.fillStyle = '#a89679'; c.fillRect(0, 0, 256, 256);
      let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const x = i * 32 + (j % 2) * 16, y = j * 32;
        c.fillStyle = ['#c4b596', '#bcab8b', '#cbbd9f'][(rnd() * 3) | 0];
        c.beginPath(); c.roundRect ? c.roundRect(x + 2, y + 2, 28, 28, 7) : c.rect(x + 2, y + 2, 28, 28); c.fill();
        c.fillStyle = 'rgba(255,250,235,0.3)'; c.fillRect(x + 5, y + 4, 20, 3);
      }
    }, { repeat: true });
  }
  function grassTex() {
    return TG.R.canvasTex(256, 256, (c) => {
      c.fillStyle = '#86b266'; c.fillRect(0, 0, 256, 256);
      let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 220; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(80,130,60,0.3)' : 'rgba(160,200,115,0.3)'; c.beginPath(); c.arc(rnd() * 256, rnd() * 256, 3 + rnd() * 8, 0, 6.3); c.fill(); }
    }, { repeat: true });
  }
  function roofTex() {
    return TG.R.canvasTex(128, 128, (c) => {
      c.fillStyle = '#9a4337'; c.fillRect(0, 0, 128, 128);
      for (let col = 0; col < 4; col++) for (let row = 0; row < 5; row++) {
        const x = col * 32, y = row * 32;
        c.fillStyle = (row + col) % 3 ? '#bf5a48' : '#b55241';
        c.beginPath(); c.moveTo(x + 2, y); c.lineTo(x + 2, y + 18); c.quadraticCurveTo(x + 16, y + 34, x + 30, y + 18); c.lineTo(x + 30, y); c.fill();
        c.fillStyle = 'rgba(255,190,150,0.4)'; c.fillRect(x + 6, y + 2, 4, 14);
      }
    }, { repeat: true });
  }
  // 맨홀: 황동 뚜껑 + 리벳 8개 + 가운데 톱니 문양. 테두리는 그림 안에 굵은 짙은 선으로(가장자리 바깥은 투명 → 매끈)
  function manholeTex() {
    return TG.R.canvasTex(512, 512, (c) => {
      c.translate(256, 256);
      const ring = (r, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.stroke(); };
      c.fillStyle = '#2a1c20'; c.fillRect(-256, -256, 512, 512);                        // 굵은 바깥 선 (원판 가장자리까지 꽉 채움)
      c.fillStyle = '#a87b2c'; c.beginPath(); c.arc(0, 0, 234, 0, 6.3); c.fill();       // 테 (짙은 황동)
      c.fillStyle = '#d2a93e'; c.beginPath(); c.arc(0, 0, 226, 0, 6.3); c.fill();       // 테 윗면
      ring(184, 7, '#7c5a1e');
      c.fillStyle = '#c0962f'; c.beginPath(); c.arc(0, 0, 180, 0, 6.3); c.fill();       // 안쪽 판
      for (let i = 0; i < 8; i++) { // 리벳
        const a = (i / 8) * 6.2832 + 0.39, x = Math.cos(a) * 206, y = Math.sin(a) * 206;
        c.fillStyle = '#6b4a16'; c.beginPath(); c.arc(x + 1.5, y + 2.5, 13, 0, 6.3); c.fill();
        c.fillStyle = '#e6c25a'; c.beginPath(); c.arc(x, y, 11.5, 0, 6.3); c.fill();
        c.fillStyle = '#fff0b0'; c.beginPath(); c.arc(x - 3.5, y - 4, 4.5, 0, 6.3); c.fill();
      }
      // 미끄럼 방지 홈: 짧은 막대를 방사형으로 (나이테처럼 보이는 동심원은 쓰지 않음)
      c.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.2832, r0 = i % 2 ? 112 : 96, r1 = 160;
        c.strokeStyle = '#7c5a1e'; c.lineWidth = 15; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke();
        c.strokeStyle = '#dcb548'; c.lineWidth = 7; c.beginPath(); c.moveTo(Math.cos(a) * r0 - 2, Math.sin(a) * r0 - 3); c.lineTo(Math.cos(a) * r1 - 2, Math.sin(a) * r1 - 3); c.stroke();
      }
      // 가운데 톱니 문양 (구리)
      c.fillStyle = '#6b4a16'; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * 6.2832, r = (i % 4 < 2) ? 78 : 62; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
      c.fillStyle = '#c46a3a'; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * 6.2832, r = (i % 4 < 2) ? 71 : 56; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
      c.fillStyle = '#6b4a16'; c.beginPath(); c.arc(0, 0, 24, 0, 6.3); c.fill();
      c.fillStyle = '#e6c25a'; c.beginPath(); c.arc(0, 0, 17, 0, 6.3); c.fill();
      // 윗빛 한 줄
      c.strokeStyle = 'rgba(255,244,190,0.55)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 219, 3.5, 5.0); c.stroke();
    });
  }
  function ventTex() {
    return TG.R.canvasTex(256, 256, (c) => {
      c.translate(128, 128);
      c.fillStyle = '#2a1c20'; c.beginPath(); c.arc(0, 0, 126, 0, 6.3); c.fill();
      c.fillStyle = '#c9a23a'; c.beginPath(); c.arc(0, 0, 119, 0, 6.3); c.fill();
      c.fillStyle = '#2a2433'; c.beginPath(); c.arc(0, 0, 100, 0, 6.3); c.fill();
      c.strokeStyle = '#6e6480'; c.lineWidth = 12;
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 26, -Math.sqrt(10000 - i * i * 676)); c.lineTo(i * 26, Math.sqrt(10000 - i * i * 676)); c.stroke(); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; c.fillStyle = '#6b4a16'; c.beginPath(); c.arc(Math.cos(a) * 110, Math.sin(a) * 110, 6, 0, 6.3); c.fill(); }
    });
  }

  // ── 기하 도우미 ──
  // 단색 소품은 색을 정점에 넣어 한 덩이로 합친다 (그리기 횟수 ↓). near = 광장 안·둘레(그림자 O), far = 먼 배경(그림자 X)
  const PAL = { // 배경은 캐릭터보다 한 단계 낮은 채도·밝기
    stone: 0xc6b798, stone2: 0xad9c7e, brass: 0xba9a4c, copper: 0xb0714e, wall: 0xe2d8c2, wall2: 0xd4ba96, brick: 0xae6050,
    wood: 0x7a5538, leaf: 0x7fa862, leaf2: 0x689455, trunk: 0x72503c, iron: 0x4d4660, flowerR: 0xd27680, flowerY: 0xd9bd66, win: 0xffd27a,
  };
  const lists = { near: [], far: [], roof: [] };
  const colCache = {};
  function add(key, geo, x, y, z, ry, sx, sy, sz, rx, rz, grp) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const textured = key === 'roof';
    for (const k of Object.keys(g.attributes)) if (!(k === 'position' || k === 'normal' || (textured && k === 'uv'))) g.deleteAttribute(k);
    const m = new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new T.Vector3(sx || 1, sy || sx || 1, sz || sx || 1));
    g.applyMatrix4(m);
    if (textured) { lists.roof.push(g); return; }
    const c = colCache[key] || (colCache[key] = new T.Color(PAL[key]));
    const k = key === 'win' ? 1.7 : 1; // 창문은 밝게(은은한 불빛)
    const n = g.getAttribute('position').count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k; }
    g.setAttribute('color', new T.BufferAttribute(arr, 3));
    lists[grp || 'near'].push(g);
  }
  const addFar = (key, geo, x, y, z, ry, sx, sy, sz, rx, rz) => add(key, geo, x, y, z, ry, sx, sy, sz, rx, rz, 'far');
  function prism() { // 삼각 지붕 (밑변 0, 꼭대기 1, z 폭 ±1, x 길이 1)
    let g = new T.CylinderGeometry(1, 1, 1, 3, 1);
    g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); g.translate(0, 0.5, 0);
    g.scale(1, 1 / 1.5, 1 / 0.866);
    g = g.toNonIndexed(); g.computeVertexNormals();
    return g;
  }
  function gearGeo(R, r, teeth, depth) {
    const s = new T.Shape();
    const N = teeth * 4;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, k = i % 4;
      const rad = k === 0 || k === 3 ? r : R;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    const hole = new T.Path(); hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true); s.holes.push(hole);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.6, hp = new T.Path(); hp.absarc(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64, r * 0.19, 0, Math.PI * 2, true); s.holes.push(hp); }
    const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -depth / 2);
    return g;
  }

  // 바닥에 눕힌 납작 톱니 (윗면만, 바깥 반지름 1 기준). 이빨 하나가 각도 0 에 오게
  function flatGearGeo(teeth, root) {
    const s = new T.Shape(), p = (Math.PI * 2) / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = i * p;
      [[-0.27, root], [-0.17, 1], [0.17, 1], [0.27, root]].forEach(([k, rad], j) => { const x = Math.cos(a + k * p) * rad, y = Math.sin(a + k * p) * rad; if (i === 0 && j === 0) s.moveTo(x, y); else s.lineTo(x, y); });
    }
    s.closePath();
    const hole = new T.Path(); hole.absarc(0, 0, 0.24, 0, Math.PI * 2, true); s.holes.push(hole);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3, hp = new T.Path(); hp.absarc(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.15, 0, Math.PI * 2, true); s.holes.push(hp); }
    const g = new T.ShapeGeometry(s, 5);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  const tmpM = new T.Matrix4(), tmpQ = new T.Quaternion(), tmpE = new T.Euler(), tmpS = new T.Vector3(), tmpP = new T.Vector3();
  AR.gears = [];
  AR.lamps = [];

  // ── 인스턴스 소품 + 화면 밖 빼기 ──
  const culled = [];
  const frustum = new T.Frustum(), pm = new T.Matrix4(), sphere = new T.Sphere();
  function inst(src, list, o) {
    o = o || {};
    const im = new T.InstancedMesh(src.geo, src.mat, list.length);
    im.castShadow = o.shadow !== false; im.receiveShadow = true; im.frustumCulled = false;
    TG.R.scene.add(im); TG.R.addOutline(im, o.outline || 0.8);
    const rad = src.geo.boundingSphere.radius, cy = src.geo.boundingSphere.center.y;
    const e = { im, mats: [], ctr: [], rad: [], key: '', margin: o.margin != null ? o.margin : 2.5 };
    list.forEach((p) => {
      const sc = p[3] || 1;
      e.mats.push(new T.Matrix4().compose(tmpP.set(p[0], p[4] || 0, p[1]), tmpQ.setFromEuler(tmpE.set(0, p[2], 0)), tmpS.set(sc, sc, sc)));
      e.ctr.push(new T.Vector3(p[0], (p[4] || 0) + cy * sc, p[1])); e.rad.push(rad * sc);
    });
    culled.push(e);
    return im;
  }
  // 카메라에 안 보이는 인스턴스는 그리지 않는다 (렌더 직전에 한 번, render.js 에서 부름)
  AR.cull = function (cam) {
    cam.updateMatrixWorld();
    frustum.setFromProjectionMatrix(pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    for (const e of culled) {
      let n = 0, key = '';
      for (let i = 0; i < e.mats.length; i++) {
        sphere.center.copy(e.ctr[i]); sphere.radius = e.rad[i] + e.margin;
        if (!frustum.intersectsSphere(sphere)) continue;
        key += i + ',';
        if (e.dyn) e.dyn(i, tmpM); else tmpM.copy(e.mats[i]);
        e.im.setMatrixAt(n++, tmpM);
      }
      e.im.count = n; e.im.userData.outline.count = n;
      e.im.visible = e.im.userData.outline.visible = n > 0;
      if (e.dyn || key !== e.key) { e.im.instanceMatrix.needsUpdate = true; e.key = key; }
    }
  };

  AR.build = function (scene) {
    const R = TG.R;
    const box = new T.BoxGeometry(1, 1, 1), cyl = new T.CylinderGeometry(1, 1, 1, 8), cylBig = new T.CylinderGeometry(1, 1, 1, 36), sph = new T.SphereGeometry(1, 9, 6), ico = new T.IcosahedronGeometry(1, 1);
    const roof = prism();
    const flatMat = () => { const m = R.toon({ color: 0xffffff, rim: 0.28, sat: 0.92 }); m.vertexColors = true; return m; };

    // 바닥: 되풀이 타일 + 덧그림(원형 돌길·테두리)
    const tt = tileTex(); tt.repeat.set(W / TS / 8, D / TS / 8);
    // 판을 잘게 나눔: 아주 큰 삼각형 하나가 통째로 빠져 밑의 돌길이 드러나던 컷(v2e pc_boss_seq 5번째) 대비
    // 먼 쪽 타일은 평균색으로 섞어 체크 대비를 낮춤 (무아레 ↓)
    const floorMat = R.toon({ map: tt, rim: 0, fColor: '{ float fd = smoothstep(17.0, 44.0, length(vViewPosition)); diffuseColor.rgb = mix(diffuseColor.rgb, ' + TILE_FAR + ', fd * 0.62); }\n' });
    const floor = new T.Mesh(new T.PlaneGeometry(W, D, 10, 7), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const decoMat = R.toon({ map: floorDecoTex(), rim: 0 }); decoMat.transparent = true; decoMat.depthWrite = false; decoMat.polygonOffset = true; decoMat.polygonOffsetFactor = -1; decoMat.polygonOffsetUnits = -1;
    const deco = new T.Mesh(new T.PlaneGeometry(W, D, 10, 7), decoMat);
    deco.rotation.x = -Math.PI / 2; deco.position.y = 0.004; deco.receiveShadow = true; deco.renderOrder = 1; scene.add(deco);
    const ct = cobbleTex(); ct.repeat.set(30, 24);
    const walk = new T.Mesh(new T.PlaneGeometry(76, 60, 8, 6), R.toon({ map: ct, rim: 0 }));
    walk.rotation.x = -Math.PI / 2; walk.position.y = -0.03; walk.receiveShadow = true; scene.add(walk);
    const gt = grassTex(); gt.repeat.set(40, 40);
    const grass = new T.Mesh(new T.PlaneGeometry(240, 240, 12, 12), R.toon({ map: gt, rim: 0 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.08; scene.add(grass);

    // 맨홀(첫 번째는 시작 연출 때 움직임 → 따로) · 증기 분출구
    const disc = new T.CircleGeometry(1, 48); disc.rotateX(-Math.PI / 2);
    const mhMat = R.toon({ map: manholeTex(), rim: 0, spec: 0.12, sat: 1.05 });
    AR.manholeMeshes = [];
    { const [x, z] = AR.manholes[0]; const m = new T.Mesh(disc, mhMat); m.position.set(x, 0.015, z); m.scale.setScalar(1.05); m.receiveShadow = true; scene.add(m); AR.manholeMeshes.push(m); }
    // pts: [x, z, (y), (크기)] — 줄마다 높이·크기를 따로 줄 수 있음
    const flatInst = (geo, mat, pts, y, sc) => { const im = new T.InstancedMesh(geo, mat, pts.length); pts.forEach((q, i) => { const k = q[3] || sc; tmpM.compose(tmpP.set(q[0], q[2] != null ? q[2] : y, q[1]), tmpQ.identity(), tmpS.set(k, 1, k)); im.setMatrixAt(i, tmpM); }); im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; };
    flatInst(disc, mhMat, AR.manholes.slice(1), 0.015, 1.05);
    // 분출구: 구석 4(턱 위) + 안쪽 4(바닥에 붙음) 를 한 묶음으로
    flatInst(disc, R.toon({ map: ventTex(), rim: 0 }), AR.vents.concat(AR.vents2.map(([x, z]) => [x, z, 0.014, 0.95])), 0.145, 1.15);
    AR.vents.forEach(([x, z]) => {
      add('brass', cyl, x, 0.06, z, 0, 1.3, 0.14, 1.3);
      add('copper', new T.TorusGeometry(1.25, 0.12, 5, 16), x, 0.14, z, 0, 1, 1, 1, Math.PI / 2);
      AR.colliders.push({ x, z, r: 0.9 });
    });
    AR.ventAll = AR.vents.map(([x, z]) => [x, z, 1.3]).concat(AR.vents2.map(([x, z]) => [x, z, 1.05])); // [x, z, 김 크기]
    AR.ventT = AR.ventAll.map((v, i) => TG.rr(1, 5) + (i > 3 ? i - 3 : 0)); // 꾸밈용 난수(TG.rand) — 규칙 난수(TG.sr)와 따로

    // 바닥에 박힌 톱니 (윗면만·외곽선 X·충돌 X): 큰 것·작은 것 한 묶음씩, 그림자는 받기만
    const fgMat = R.toon({ color: 0xcfa63c, rim: 0, spec: 0, sat: 1.0 });
    fgMat.transparent = true; fgMat.depthWrite = false; fgMat.polygonOffset = true; fgMat.polygonOffsetFactor = -2; fgMat.polygonOffsetUnits = -2; // 바닥 덧그림(홈) 바로 다음, 접지 그림자·링보다 먼저 그림
    const fgBig = new T.InstancedMesh(flatGearGeo(FG.N, 0.86), fgMat, AR.floorGears.length);
    const fgSmall = new T.InstancedMesh(flatGearGeo(FG.n, 0.77), fgMat, AR.floorGears.length);
    [fgBig, fgSmall].forEach((m) => { m.receiveShadow = true; m.castShadow = false; m.frustumCulled = false; m.renderOrder = 1.5; scene.add(m); });
    AR.fgMesh = [fgBig, fgSmall];

    // 낮은 황동 파이프 난간 (엄폐): 기둥 3 + 가로 파이프 2줄
    BARS.forEach(([x0, z0, dx, dz]) => {
      for (let i = 0; i < 3; i++) {
        const x = x0 + dx * i * 1.2, z = z0 + dz * i * 1.2;
        add('brass', cyl, x, 0.6, z, 0, 0.15, 1.2, 0.15);
        add('copper', cyl, x, 0.12, z, 0, 0.26, 0.24, 0.26);
        add('brass', new T.SphereGeometry(1, 6, 4), x, 1.26, z, 0, 0.23, 0.2, 0.23);
      }
      const cx = x0 + dx * 1.2, cz = z0 + dz * 1.2;
      [0.5, 0.98].forEach((h) => { if (dx) add('brass', new T.CylinderGeometry(1, 1, 1, 6), cx, h, cz, 0, 0.09, 2.4, 0.09, 0, Math.PI / 2); else add('brass', new T.CylinderGeometry(1, 1, 1, 6), cx, h, cz, 0, 0.09, 2.4, 0.09, Math.PI / 2, 0); });
      for (let i = 0; i < 5; i++) AR.colliders.push({ x: x0 + dx * i * 0.6, z: z0 + dz * i * 0.6, r: 0.42, kind: 'bar' });
    });
    // 안쪽 엄폐물마다 톱니 기둥: 뒤쪽(-z)에 황동 기둥 + 돌아가는 톱니 (엄폐물 충돌 원 안이라 길을 더 막지 않음)
    INNER.forEach(([x, z], i) => {
      const gx = x + (i % 2 ? 0.5 : -0.5), gz = z - 0.72;
      add('brass', cyl, gx, 1.15, gz, 0, 0.1, 2.3, 0.1);
      add('copper', cyl, gx, 0.14, gz, 0, 0.24, 0.28, 0.24);
      AR.gears.push({ x: gx, y: 2.35, z: gz + 0.02, ry: 0, s: 0.56, sp: i % 2 ? 0.9 : -0.9 });
    });

    // 연석 + 황동 파이프 울타리 (사방)
    const cw = 0.9, ch = 0.35;
    add('stone2', box, 0, ch / 2, -(D / 2 + cw / 2), 0, W + cw * 2, ch, cw);
    add('stone2', box, 0, ch / 2, D / 2 + cw / 2, 0, W + cw * 2, ch, cw);
    add('stone2', box, -(W / 2 + cw / 2), ch / 2, 0, 0, cw, ch, D);
    add('stone2', box, W / 2 + cw / 2, ch / 2, 0, 0, cw, ch, D);
    const fx = W / 2 + cw / 2, fz = D / 2 + cw / 2;
    const knob = new T.SphereGeometry(1, 6, 4);
    const post = (x, z) => {
      add('brass', cyl, x, ch + 0.8, z, 0, 0.2, 1.6, 0.2);
      add('copper', cyl, x, ch + 0.15, z, 0, 0.31, 0.3, 0.31);
      add('brass', knob, x, ch + 1.7, z, 0, 0.3, 0.26, 0.3);
    };
    const STEP = 3;
    for (let x = -fx; x <= fx + 0.01; x += (2 * fx) / Math.round((2 * fx) / STEP)) { post(x, -fz); post(x, fz); }
    for (let z = -fz + (2 * fz) / Math.round((2 * fz) / STEP); z < fz - 0.01; z += (2 * fz) / Math.round((2 * fz) / STEP)) { post(-fx, z); post(fx, z); }
    const rail = new T.CylinderGeometry(1, 1, 1, 6);
    [[-fx, -fz, fx, -fz], [-fx, fz, fx, fz], [-fx, -fz, -fx, fz], [fx, -fz, fx, fz]].forEach((r) => {
      const len = Math.hypot(r[2] - r[0], r[3] - r[1]);
      const horizontalX = Math.abs(r[2] - r[0]) > 0.1;
      [0.7, 1.4].forEach((h) => {
        if (horizontalX) add('brass', rail, (r[0] + r[2]) / 2, ch + h, r[1], 0, 0.12, len, 0.12, 0, Math.PI / 2);
        else add('brass', rail, r[0], ch + h, (r[1] + r[3]) / 2, 0, 0.12, len, 0.12, Math.PI / 2, 0);
      });
    });

    // 박동탑 받침
    const tp = AR.towerPos;
    add('stone', cylBig, tp.x, 0.22, tp.z, 0, 4.7, 0.44, 4.7);
    add('stone2', cylBig, tp.x, 0.08, tp.z, 0, 5.1, 0.16, 5.1);
    add('brass', new T.TorusGeometry(4.7, 0.12, 5, 40), tp.x, 0.46, tp.z, 0, 1, 1, 1, Math.PI / 2);
    for (let i = 0; i < 10; i++) { // 낮은 화분 (탑 옆·뒤에만)
      const a = (i / 10) * Math.PI * 2 + 0.2, x = tp.x + Math.cos(a) * 4.2, z = tp.z + Math.sin(a) * 4.2;
      if (Math.sin(a) > 0.2) continue; // 앞쪽(시계 쪽)은 비워 둠
      add('copper', cyl, x, 0.68, z, 0, 0.4, 0.5, 0.4);
      add('leaf', ico, x, 1.1, z, 0, 0.52, 0.4, 0.52);
      add(i % 2 ? 'flowerR' : 'flowerY', sph, x + 0.2, 1.42, z + 0.15, 0, 0.14);
    }
    AR.colliders.push({ x: tp.x, z: tp.z, r: 4.3 });

    // 뒤쪽 원경 집 (절차 생성, 멀리)
    const house = (x, z, w, d, h, ry, wallKey) => {
      const c = Math.cos(ry), sn = Math.sin(ry);
      const L = (lx, ly, lz) => [x + lx * c + lz * sn, ly, z - lx * sn + lz * c];
      let p = L(0, h / 2, 0); addFar(wallKey, box, p[0], p[1], p[2], ry, w, h, d);
      const rh = Math.min(3, d * 0.6);
      p = L(0, h, 0); addFar('roof', roof, p[0], p[1], p[2], ry, w + 0.5, rh, d / 2 + 0.45);
      p = L(-w * 0.28, h + rh * 0.6, -d * 0.12); addFar('brick', box, p[0], p[1], p[2], ry, 0.7, rh * 1.2, 0.7);
      const nw = Math.max(1, Math.floor(w / 2.4));
      for (let i = 0; i < nw; i++) { // 위층 창만 (아래층은 앞집에 가림)
        const lx = -w / 2 + (i + 0.5) * (w / nw), ly = 4.8;
        p = L(lx, ly, d / 2 + 0.04); addFar('brass', box, p[0], p[1], p[2], ry, 1.2, 1.5, 0.12);
        p = L(lx, ly, d / 2 + 0.09); addFar('win', box, p[0], p[1], p[2], ry, 0.9, 1.2, 0.06);
      }
    };
    [-34, -24, -14, -5, 5, 14, 24, 34].forEach((x, i) => house(x, -33, 8, 6, 9 + (i % 3) * 2, 0, i % 2 ? 'wall' : 'wall2'));
    [-30, -20, 22, 32].forEach((z, i) => { house(-40, z * 0.5, 7, 6, 8 + i, Math.PI / 2, 'wall'); house(40, z * 0.5, 7, 6, 8 + i, -Math.PI / 2, 'wall2'); });

    // 나무·울타리 밖 덤불
    const tree = (x, z, s) => {
      addFar('trunk', cyl, x, 0.9 * s, z, 0, 0.22 * s, 1.8 * s, 0.22 * s);
      addFar('leaf', ico, x, 2.3 * s, z, TG.rr(0, 3), 1.15 * s);
      addFar('leaf2', ico, x + 0.6 * s, 1.9 * s, z + 0.3 * s, TG.rr(0, 3), 0.8 * s);
      addFar('leaf', ico, x - 0.5 * s, 2.0 * s, z - 0.4 * s, TG.rr(0, 3), 0.75 * s);
    };
    [[-31, -18, 1.5], [31, -18, 1.5], [-22.5, 17.5, 1.3], [22.5, 17.5, 1.3], [-34, 6, 1.6], [34, 6, 1.6], [-12.5, -19.5, 1.1], [12.5, -19.5, 1.1], [-3.5, -20, 1.0], [3.5, -20, 1.0]].forEach((t) => tree(t[0], t[1], t[2]));
    for (let x = -26; x <= 26; x += 3.2) { const z = 17.4 + Math.sin(x) * 0.4; addFar(x % 2 ? 'leaf' : 'leaf2', ico, x, 0.5, z, x, 1.0, 0.65, 0.9); }
    // 광장 가장자리 화분 (낮게)
    [[-17.6, -6], [17.6, 6], [-17.6, 6.5], [17.6, -6.5], [-9, 12.5], [9, 12.5], [-9, -12.5], [9, -12.5]].forEach(([x, z], i) => {
      add('copper', cyl, x, 0.4, z, 0, 0.5, 0.8, 0.5); add('brass', new T.TorusGeometry(0.5, 0.07, 5, 12), x, 0.8, z, 0, 1, 1, 1, Math.PI / 2);
      add(i % 2 ? 'leaf' : 'leaf2', ico, x, 1.15, z, i, 0.66, 0.5, 0.66);
      add(i % 2 ? 'flowerR' : 'flowerY', sph, x + 0.26, 1.52, z + 0.18, 0, 0.15);
      AR.colliders.push({ x, z, r: 0.7 });
    });

    // 벽면 톱니: 울타리 밖 벽돌 벽에 붙어 천천히 돎 (전투 영역 안에는 두지 않음)
    const wallPanel = (x, z, ry, w, h) => {
      const c = Math.cos(ry), sn = Math.sin(ry);
      addFar('brick', box, x, h / 2, z, ry, w, h, 0.6);
      addFar('stone2', box, x, h + 0.14, z, ry, w + 0.4, 0.28, 0.9);
      [-1, 1].forEach((k) => addFar('stone', box, x + k * (w / 2) * c, h / 2 + 0.2, z - k * (w / 2) * sn, ry, 0.7, h + 0.4, 0.8));
    };
    wallPanel(-13.4, -17.4, 0, 8.4, 3.6); wallPanel(13.4, -17.4, 0, 8.4, 3.6);
    wallPanel(-22.9, 0, Math.PI / 2, 7.4, 3.2); wallPanel(22.9, 0, -Math.PI / 2, 7.4, 3.2);
    [[-15, 1.95, -16.95, 0, 1.75, 0.3], [-12.15, 1.45, -16.95, 0, 1.18, -0.445], [-10.3, 2.45, -16.95, 0, 0.8, 0.66],
      [15, 1.95, -16.95, 0, 1.75, -0.3], [12.15, 1.45, -16.95, 0, 1.18, 0.445], [10.3, 2.45, -16.95, 0, 0.8, -0.66],
      [-22.45, 1.75, -1.2, Math.PI / 2, 1.5, 0.35], [-22.45, 1.4, 1.35, Math.PI / 2, 1.05, -0.5],
      [22.45, 1.75, 1.2, -Math.PI / 2, 1.5, -0.35], [22.45, 1.4, -1.35, -Math.PI / 2, 1.05, 0.5]].forEach(([x, y, z, ry, sc, sp]) => AR.gears.push({ x, y, z, ry, s: sc, sp }));

    // 정적 묶음 → 가까운 것(그림자 O)·먼 것(그림자 X)·지붕
    AR.static = [];
    const fm = flatMat();
    [['near', fm, true], ['far', fm, false], ['roof', R.toon({ map: roofTex(), color: 0xffffff, rim: 0.3, sat: 0.9 }), false]].forEach(([key, mat, shadow]) => {
      const geo = T.BufferGeometryUtils.mergeGeometries(lists[key], false);
      if (!geo) return;
      geo.computeBoundingSphere();
      const m = new T.Mesh(geo, mat);
      m.castShadow = shadow; m.receiveShadow = true;
      scene.add(m); R.addOutline(m, 0.9);
      AR.static.push(m);
    });
    lists.near.length = lists.far.length = lists.roof.length = 0;

    // 톱니 (인스턴스, 보이는 것만 돌림)
    const gg = gearGeo(1, 0.82, 10, 0.26); gg.computeBoundingSphere();
    AR.gearT = 0;
    const gm = inst({ geo: gg, mat: R.toon({ color: 0xb39445, rim: 0.4, spec: 0.3, sat: 0.9 }) }, AR.gears.map((g) => [g.x, g.z, g.ry, g.s, g.y]), { shadow: false, outline: 0.9, margin: 0.5 });
    AR.gearMesh = gm;
    culled[culled.length - 1].dyn = (i, out) => {
      const g = AR.gears[i];
      tmpQ.setFromEuler(tmpE.set(0, g.ry, AR.gearT * g.sp, 'YXZ'));
      out.compose(tmpP.set(g.x, g.y, g.z), tmpQ, tmpS.set(g.s, g.s, g.s));
    };

    // GLB: 박동탑·마을 가게/집·가로등·장애물
    const M = TG.M;
    const tower = (AR.tower = new T.Mesh(M.tower.geo, M.tower.mat));
    tower.position.copy(tp); tower.position.y = 0.42; tower.castShadow = tower.receiveShadow = true;
    scene.add(tower);
    const tol = R.addOutline(tower, 1.15);
    const tsrc = R.outlineMat(1.15, 0.0007); // 캐릭터와 같은 두께. 깊이 밀기는 작게 — 큰 모델은 선이 제 몸 뒤로 숨어 끊겼음
    tol.material = tsrc.clone(); tol.material.onBeforeCompile = tsrc.onBeforeCompile; tol.material.customProgramCacheKey = tsrc.customProgramCacheKey; // 탑만 따로 반투명하게 하려고 복제
    AR.towerFade = 1;
    buildClock(tower, M.tower);
    // 맥박: 탑 받침 둘레에서 은은하게 번지는 고리
    const pulse = (AR.pulse = new T.Mesh(new T.RingGeometry(4.95, 5.35, 48), new T.MeshBasicMaterial({ color: new T.Color(0xff7a52).multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false })));
    pulse.rotation.x = -Math.PI / 2; pulse.position.set(tp.x, 0.05, tp.z); pulse.renderOrder = 2; scene.add(pulse);

    // 둘레 마을: 북쪽(앞면 +z), 동·서(가운데를 봄) — 멀리 있어 그림자는 안 만듦
    const shops = [], homes = [];
    [[-27, 'h', 1.0, 0.12], [-18, 's', 0.95, -0.1], [-9.5, 'h', 0.9, 0.05], [0, 'h', 1.1, 0], [9.5, 's', 1.0, -0.06], [18, 'h', 0.95, 0.1], [27, 's', 1.05, -0.12]]
      .forEach(([x, k, sc, ry]) => (k === 's' ? shops : homes).push([x, -21.5 - (k === 'h' ? 0.5 : 0), ry, sc]));
    [[-12, 'h'], [-3, 's'], [6, 'h'], [14.5, 's']].forEach(([z, k], i) => {
      const sc = 0.9 + (i % 2) * 0.12;
      (k === 's' ? shops : homes).push([-27.5, z, Math.PI / 2 + (i % 2 ? 0.08 : -0.08), sc]);
      (k === 's' ? homes : shops).push([27.5, z, -Math.PI / 2 + (i % 2 ? -0.08 : 0.08), sc * 0.97]);
    });
    if (M.shop) AR.shopMesh = inst(M.shop, shops, { shadow: false, margin: 0.5 });
    if (M.house) AR.houseMesh = inst(M.house, homes, { shadow: false, margin: 0.5 });
    AR.houses = shops.concat(homes);
    // 가로등 (울타리 따라)
    const lamps = [[-14, -13.3, 0], [-5, -13.3, 0], [5, -13.3, 0], [14, -13.3, 0], [-19.3, -6.5, Math.PI / 2], [-19.3, 6.5, Math.PI / 2], [19.3, -6.5, -Math.PI / 2], [19.3, 6.5, -Math.PI / 2]];
    if (M.lamp) AR.lampMesh = inst(M.lamp, lamps.map((l) => [l[0], l[1], l[2], 1]));
    lamps.forEach(([x, z]) => { AR.lamps.push([x, z]); AR.colliders.push({ x, z, r: 0.6 }); });
    // 장애물(엄폐): 가장자리 + 안쪽 고리 모양으로 (시작점·보스 자리 둘레는 비움). 충돌·미니맵은 예전과 같은 등록 방식
    const crates = CRATES, speakers = SPEAKERS;
    AR.crateMesh = inst(M.crate, crates);
    AR.speakerMesh = inst(M.speaker, speakers);
    crates.forEach((p) => AR.colliders.push({ x: p[0], z: p[1], r: 1.0, kind: 'crate' }));
    speakers.forEach((p) => AR.colliders.push({ x: p[0], z: p[1], r: 1.05, kind: 'speaker' }));
    AR.speakers = speakers;
    AR.towerSteamT = 2;
  };

  // 박동탑 시계 바늘 (탑 메시의 자식 → 박자에 같이 들썩)
  function buildClock(tower, src) {
    const C = AR.CLOCK = { x: 0.066 * src.size.x, y: 0.568 * src.size.y, z: 0.5 * src.size.z, r: 0.2 * src.size.y };
    const mat = (AR.handMat = new T.MeshBasicMaterial({ color: 0x4a2f22 }));
    const hand = (len, w) => { const g = new T.BoxGeometry(w, len, 0.06); g.translate(0, len * 0.42, 0); const m = new T.Mesh(g, mat); m.position.set(C.x, C.y, C.z); tower.add(m); return m; };
    AR.handH = hand(C.r * 0.5, C.r * 0.13); AR.handM = hand(C.r * 0.78, C.r * 0.09);
    const hub = new T.Mesh(new T.CylinderGeometry(C.r * 0.1, C.r * 0.1, 0.1, 10), mat); hub.rotation.x = Math.PI / 2; hub.position.set(C.x, C.y, C.z + 0.02); tower.add(hub);
    AR.clockParts = [AR.handH, AR.handM, hub];
  }

  AR.updateGears = function (t) {
    AR.gearT = t;
    if (!AR.fgMesh) return;
    const [big, small] = AR.fgMesh, w = 0.22;
    AR.floorGears.forEach(([x, z, th], i) => {
      // 눕힌 톱니는 rotation.y = b 일 때 이빨이 방향 -b 를 봄 → 큰 것은 이빨, 작은 것은 틈이 서로를 보게 맞춤
      tmpM.compose(tmpP.set(x, 0.012, z), tmpQ.setFromEuler(tmpE.set(0, -th + t * w, 0)), tmpS.set(FG.R, 1, FG.R)); big.setMatrixAt(i, tmpM);
      tmpM.compose(tmpP.set(x + Math.cos(th) * FG.d, 0.012, z + Math.sin(th) * FG.d), tmpQ.setFromEuler(tmpE.set(0, -(th + Math.PI + Math.PI / FG.n) - t * w * (FG.N / FG.n), 0)), tmpS.set(FG.r, 1, FG.r)); small.setMatrixAt(i, tmpM);
    });
    big.instanceMatrix.needsUpdate = small.instanceMatrix.needsUpdate = true;
  };

  // 박동탑이 박자에 맞춰 살짝 들썩 + 받침 둘레 맥박 고리
  AR.beat = function (k) {
    if (AR.tower) { const s = 1 + 0.02 * k; AR.tower.scale.set(1 + 0.01 * k, s, 1 + 0.01 * k); AR.tower.userData.outline.scale.copy(AR.tower.scale); }
    if (AR.pulse) { AR.pulse.material.opacity = 0.3 * k; const s = 1.07 - 0.07 * k; AR.pulse.scale.set(s, s, 1); AR.pulse.visible = k > 0.02; }
  };

  // 원 충돌 밀어내기 (x,z,r) → 고친 위치
  AR.push = function (p, r) {
    for (const c of AR.colliders) {
      const dx = p.x - c.x, dz = p.z - c.z, d2 = dx * dx + dz * dz, rr = r + c.r;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += dx * k; p.z += dz * k; }
    }
    p.x = TG.clamp(p.x, -AR.bx, AR.bx); p.z = TG.clamp(p.z, -AR.bz, AR.bz);
  };
  AR.blocked = function (x, z, r) {
    if (Math.abs(x) > AR.bx || Math.abs(z) > AR.bz) return true;
    for (const c of AR.colliders) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return true; }
    return false;
  };

  AR.update = function (dt, t, player) {
    AR.updateGears(t);
    // 시계 바늘: 분침은 눈에 보일 만큼 천천히, 시침은 더 천천히
    if (AR.handM) { AR.handM.rotation.z = -t * 0.35; AR.handH.rotation.z = -t * 0.35 / 12 - 1.0; }
    // SEFO가 탑 뒤로 가면 탑을 반투명하게 (가리지 않게)
    const P = TG.PL, tp = AR.towerPos;
    if (AR.tower && P && P.root) {
      const dz = tp.z - P.rz, dx = Math.abs(P.rx - tp.x);
      const behind = P.root.visible && dz > 1.2 && dz < 12 && dx < 5.2 + dz * 0.12;
      AR.towerFade = TG.damp(AR.towerFade, behind ? 0.3 : 1, 7, dt || 0.016);
      const f = AR.towerFade, on = f < 0.985;
      const tm = AR.tower.material, om = AR.tower.userData.outline.material;
      if (tm.transparent !== on) { tm.transparent = on; om.transparent = on; AR.handMat.transparent = on; tm.needsUpdate = om.needsUpdate = AR.handMat.needsUpdate = true; }
      tm.opacity = om.opacity = AR.handMat.opacity = on ? f : 1;
      AR.tower.renderOrder = AR.tower.userData.outline.renderOrder = on ? 30 : 0; // 반투명일 땐 맨 나중에 (뒤쪽 링·이펙트가 먼저 그려지게)
    }
    AR.towerSteamT -= dt;
    if (AR.towerSteamT <= 0) { AR.towerSteamT = TG.rr(3, 5); TG.FX.steam(AR.towerPos.x + 0.6, AR.towerPos.z - 0.4, 8.9, 1.1); }
    // 증기 분출구: 가끔 짧게 「칙」
    AR.ventT.forEach((v, i) => {
      AR.ventT[i] -= dt;
      if (AR.ventT[i] <= 0) {
        AR.ventT[i] = TG.rr(4, 8);
        const [x, z, k] = AR.ventAll[i];
        TG.FX.steam(x, z, 0.2, k);
        if (player) { const d = Math.hypot(player.x - x, player.z - z); if (d < 16) TG.A.play('sfx_steam', { gain: (i > 3 ? 0.22 : 0.35) * (1 - d / 16), pan: TG.clamp((x - player.x) / 12, -1, 1) }); }
      }
    });
  };
})();
