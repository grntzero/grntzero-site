/* GRUNT ZERO RE — HUD·입력 (가상 스틱 + 누르고 있는 호각 버튼(끌면 조준) + 구르기·차렷·전체 기상 / PC 키보드·마우스) */
(function () {
  'use strict';
  const GZ = window.GZ;
  const HUD = (GZ.HUD = {});
  const I = (GZ.I = { mx: 0, mz: 0, fire: false, aim: null, rollP: false, skillP: false, ultP: false });
  const $ = (id) => document.getElementById(id);
  let el = {}, S = 1, lefty = GZ.Q.lefty;
  const ptr = { stick: null, fire: null };
  let fsPend = null;   // 11-14: 멈춤 창 「⛶ 전체화면」을 터치로 누른 손가락(뗄 때 켬)
  const keys = {};
  let mouse = { x: 0, y: 0, down: false, seen: false };
  const arrows = [];
  let lastHp = -1, lastBoss = -1, lastCombo = -1, lastGauge = -1, hintT = 0, bannerT = 0, shoutT = 0;
  let cardLock = 0, cardDown = null;
  // r3: 스틱·조준은 화면 기준 값으로 들고 있다가 매 프레임 세계 좌표로 바꿔 I 에 넣음 (카메라가 돌아도 맞고, 일시정지·보급 뒤에도 바로 되살아남)
  let stickV = null, aimS = null, aimKeep = 0, pendBanner = null, edgeEl = null, comboT = 0;
  // r4: 끌어 조준은 「세계 기준 각」(aimW)으로 저장 — 카메라가 돌아도 겨눈 곳이 그대로. 손가락이 움직일 때만 갱신. aimS/aimYaw 는 호각 위 흰 점을 그릴 때만 씀
  //     스틱도 방향을 잡은 순간의 카메라 각(stickYaw)으로 세계 방향을 정해 두고, 손가락이 17° 넘게 방향을 바꿀 때만 지금 화면 기준으로 다시 잡음 → 카메라가 도는 동안 진행 방향이 휘지 않음
  let aimD = null;   // r9b: 끈 손가락 방향(화면) — 카메라가 앞서 가며 옮겨져도 화면에 보이는 방향 그대로 다시 맞춤
  let aimW = null, aimYaw = 0, aimPrev = null, slideRoll = false, stickYaw = 0, stickRef = null, keyYaw = 0, keySig = '', padRect = null;
  const AIM_KEEP = 0.6;   // 손을 뗀 뒤 조준을 유지하는 시간(초)   // r2: 보급 카드 — 뜬 뒤 0.5초 입력 잠금, 누를 때가 아니라 뗄 때 확정

  HUD.init = function () {
    ['ui', 'hud', 'hpFill', 'hpGhost', 'hpNum', 'waveName', 'waveSub', 'bossBar', 'bossFill', 'bossGhost', 'bossPh', 'combo', 'comboN', 'hint', 'keyHint', 'stick', 'stickBase', 'stickKnob',
      'bFire', 'bRoll', 'bSkill', 'bUlt', 'ultArc', 'beatRing', 'aimKnob', 'banner', 'shout', 'title', 'cards', 'cardRow', 'pause', 'result', 'resTitle', 'resSub', 'grade', 'resRows', 'loading', 'vig', 'streak', 'arrows', 'edges', 'optBgm', 'optSfx', 'optShake', 'optVib', 'optAtk', 'optVoice', 'atkManual', 'atkAuto', 'resAuto', 'optLefty', 'optCam', 'optLead', 'optBeat', 'optBeatV', 'cutin', 'offs', 'diffEasy', 'diffNormal', 'stickHome', 'rotate'].forEach((k) => (el[k] = $(k)));
    // r5: 터치 기기에서만 터치 버튼을 보임 (PC 마우스·키보드에서는 숨기고 아래 키 안내만). 터치가 한 번이라도 들어오면 그때 켬
    if (GZ.isTouch) document.body.classList.add('touch');
    window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); GZ.isTouch = true; HUD.showHud(!el.hud.classList.contains('hide')); padRect = null; } }, { passive: true, once: true });
    for (let i = 0; i < 16; i++) { const a = document.createElement('div'); a.className = 'arw'; el.arrows.appendChild(a); arrows.push(a); }
    el.streakI = el.streak.querySelectorAll('i');
    edgeEl = { T: el.edges.querySelector('.eT'), B: el.edges.querySelector('.eB'), L: el.edges.querySelector('.eL'), R: el.edges.querySelector('.eR') };
    HUD.layout();
    if (GZ.AS) GZ.AS.init();   // 2026-11-13 비서 그런트
    bind();
    HUD.checkOrient();
    HUD.setLefty(lefty);
    const gq = document.getElementById('optGq');
    if (gq) GZView.onQuality((m) => { for (const b of gq.children) b.classList.toggle('on', b.dataset.act === 'gq_' + m); });
    GZView.initFs({ anchor: '#face', appName: '그런트 스쿼드', isPlay: () => !!(GZ.G && GZ.G.playing && GZ.G.playing() && !GZ.G.paused),
      onHelp: () => { if (GZ.G && GZ.G.playing && GZ.G.playing() && !GZ.G.paused) GZ.G.pause(true); },   // 11-14: 「홈 화면에 추가」 안내를 읽는 동안 판이 흐르지 않게
      onState: (on) => { const b = $('optFs'); if (!b) return; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.textContent = on ? '⛶ 전체화면 끄기' : '⛶ 전체화면'; } });   // 11-14: 멈춤 창 아래 단추 줄 「⛶ 전체화면」(설정 칸에 넣으면 한 줄 늘어 탭에서 「계속」이 화면 밖으로 밀림)   // ⛶ 버튼(왼쪽 위 얼굴 칸 아래 — 오른쪽 위는 멈춤·연속 숫자 자리)
    GZView.initHud(() => ({ pr: GZ.R.pr, fps: GZ.R.fps, w: GZ.R.renderer.domElement.width, h: GZ.R.renderer.domElement.height, extra: 'MSAA ' + GZ.R.composer.renderTarget1.samples }));
  };
  HUD.layout = function () {
    const w = GZ.vw(), h = GZ.vh();
    S = GZ.clamp(Math.min(w, h) / 390, 0.82, 1.45);
    if (w > h && h < 500) S = GZ.clamp(h / 420, 0.8, 1.1);
    document.documentElement.style.setProperty('--s', S.toFixed(3));
    HUD.S = S; padRect = null;
    HUD.checkOrient();
  };
  // r7: 가로형이 기본 — 터치 기기를 세로로 들면 「가로로 돌려 주세요」 안내(CSS)가 덮고 게임을 멈춤. 다시 가로로 돌리면 일시정지 창에서 「계속」
  HUD.portraitBlock = false;
  HUD.checkOrient = function () {
    HUD.portraitBlock = !!(GZ.isTouch && GZ.vh() > GZ.vw());
    if (HUD.portraitBlock && GZ.G && GZ.G.playing && GZ.G.playing()) GZ.G.pause(true);
    if (HUD.portraitBlock) { if (ptr.fire) dropFire(); if (ptr.stick) dropStick(); }
  };
  // r7: 폰에서 「점호 시작」·「전체 화면으로」를 누르면 전체 화면 + 가로 고정을 시도 (iOS 사파리 등 안 되는 곳은 조용히 넘어감)
  // 2026-11-13 전체화면: 공통 js/gzview.js 로 옮김. 버튼은 pointerdown 이라 안드로이드 크롬이 사용자 동작으로 안 쳐 거절되던 것 →
  //   여기서는 「원함」만 표시하고 같은 손가락을 뗄 때(pointerup) GZView 가 전체화면 + 가로 고정을 시도함
  HUD.tryLandscape = function () {
    if (!GZ.isTouch || GZ.Q.auto) return;
    if (window.GZView) { GZView.request('start'); return; }
    try {
      const d = document.documentElement, rq = d.requestFullscreen || d.webkitRequestFullscreen;
      const lock = () => { try { const o = screen.orientation; if (o && o.lock) { const p = o.lock('landscape'); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* 지원 안 함 */ } };
      if (rq && !(document.fullscreenElement || document.webkitFullscreenElement)) {
        const p = rq.call(d, { navigationUI: 'hide' });
        if (p && p.then) p.then(lock, () => {}); else lock();
      } else lock();
    } catch (e) { /* 지원 안 함 */ }
  };
  HUD.setLefty = function (v) { lefty = v; el.ui.classList.toggle('lefty', v); el.optLefty.classList.toggle('on', v); padRect = null; };

  function act(name, down, e) {
    const G = GZ.G;
    if (down) { GZ.AU.init(); GZ.AU.resume(); }
    switch (name) {
      case 'fire':
        if (down) {
          ptr.fire = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; I.fire = true; el.bFire.classList.add('down'); slideRoll = false;
          if (aimW != null && aimKeep > 0) { aimKeep = 9; showAim(); }       // 0.6초 안에 다시 누르면 같은 조준으로 이어 쏨
          else clearAim();
          aimPrev = aimW == null ? null : { w: aimW, s: aimS, y: aimYaw };
        }
        break;
      case 'roll': if (down && G.playing()) { I.rollP = true; flash(el.bRoll); if (G.pressNow) G.pressNow('roll'); } break;   // r9: 누른 순간 「구르기!」
      case 'skill': if (down && G.playing()) { I.skillP = true; flash(el.bSkill); if (G.pressNow) G.pressNow('skill'); } break;   // r9: 걸음을 기다리지 않고 누른 순간 시작(목소리·예비동작)
      case 'ult': if (down && G.playing()) { I.ultP = true; flash(el.bUlt); if (G.pressNow) G.pressNow('ult'); } break;
      case 'atkManual': if (down) G.setAtk('manual'); break;
      case 'atkAuto': if (down) G.setAtk('auto'); break;
      case 'atkTog': if (down) G.setAtk(G.atk === 'auto' ? 'manual' : 'auto'); break;
      case 'voice': if (down && GZ.VO) { const on = GZ.VO.setOn(!GZ.VO.on); el.optVoice.classList.toggle('on', on); if (on) setTimeout(() => GZ.VO.say('att'), 60); } break;   // 켜면 「차렷!」 한 번 들려줌
      case 'asvoice': if (down && GZ.ASV) GZ.ASV.setOn(!GZ.ASV.on); break;   // 11-14 「비서 목소리」 켜기/끄기 (줄은 js/assist_voice.js 가 붙임)
      case 'pause': if (down) G.pause(true); break;
      case 'resume': if (down) G.pause(false); break;
      case 'start': if (down) { HUD.tryLandscape(); G.start(); } break;
      case 'landscape': if (down) HUD.tryLandscape(); break;
      case 'diffEasy': if (down) { G.setDiff('easy'); HUD.diff('easy'); } break;
      case 'diffNormal': if (down) { G.setDiff('normal'); HUD.diff('normal'); } break;
      case 'retry': if (down) { HUD.tryLandscape(); G.start(); } break;
      case 'home': if (down) G.toTitle(); break;
      case 'shake': if (down) { GZ.R.opt.shake = !GZ.R.opt.shake; el.optShake.classList.toggle('on', GZ.R.opt.shake); } break;
      case 'vib': if (down && window.GZHaptics) { const on = GZHaptics.toggle(); el.optVib.classList.toggle('on', on); if (on && GZ.HAP) GZ.HAP('toggle'); } break;   // 진동 켜기/끄기 (소리와 별개, 저장)
      case 'fs':   // 11-14: 멈춤 창 「⛶ 전체화면」. 끄기·안내·마우스는 바로, 터치로 켜기는 손가락 뗄 때(안드로이드 크롬은 터치 pointerdown 을 사용자 동작으로 안 침)
        if (down) { if (!GZView.fsSupported() || GZView.isFs() || e.pointerType === 'mouse') GZView.toggle('menu'); else fsPend = e.pointerId; }
        break;
      case 'cam': if (down) { GZ.R.opt.camAuto = !GZ.R.opt.camAuto; el.optCam.classList.toggle('on', GZ.R.opt.camAuto); } break;
      case 'lefty': if (down) HUD.setLefty(!lefty); break;
      case 'lead_off': case 'lead_mid': case 'lead_strong': if (down) G.setCamLv(name.slice(5)); break;
      case 'gq_auto': case 'gq_high': if (down) GZView.setQuality(name.slice(3)); break;   // 화질 자동/높게 (저장 gzre_quality)   // r9b 카메라 따라가기 3단
      default:
        if (down && name && name.indexOf('card') === 0) {
          if (performance.now() < cardLock) return;          // 방금 뜬 카드는 무시 (스틱을 잡던 손가락에 눌리지 않게)
          cardDown = { id: e.pointerId, name };
          const c = e.target.closest('.card'); if (c) c.classList.add('down');
          return;
        }
    }
    if (down && name !== 'fire' && name !== 'roll' && name !== 'skill' && name !== 'ult') GZ.AU.ui(name === 'start');
  }
  function showAim() {   // 호각 위 흰 점: 세계 기준 조준을 지금 화면에 맞게 (카메라가 돌았으면 그만큼 옮겨 그림)
    const R = 40 * S, a = aimS + aimYaw - (GZ.R.yaw || 0); el.aimKnob.style.opacity = '0.9';
    el.aimKnob.style.transform = 'translate(' + (lefty ? -1 : 1) * Math.sin(a) * R + 'px,' + Math.cos(a) * R + 'px)';
  }
  function clearAim() { aimD = null; aimS = null; aimW = null; I.aim = null; if (el.aimKnob) el.aimKnob.style.opacity = '0'; }
  function dropFire() { ptr.fire = null; I.fire = false; el.bFire.classList.remove('down'); aimKeep = aimW != null ? AIM_KEEP : 0; }
  // 끈 방향(화면 px, y 는 아래로) → 화면에 「보이는 그대로」의 바닥 방향각: 주인공의 화면 자리와 끈 쪽으로 조금 옮긴 자리, 두 점을 바닥(가슴 높이 평면)에 쏘아 구함
  const pj0 = { x: 0, y: 0, behind: false };
  function dragToWorld(dx, dy) {
    const R = GZ.R, P = GZ.G.P, l = Math.hypot(dx, dy) || 1, flat = Math.atan2(dx, dy) + (R.yaw || 0);
    if (R.cine.k > 0.05) return flat;                       // 연출 카메라 중에는 단순 회전식
    R.project(P.x, 1, P.z, pj0);
    if (pj0.behind) return flat;
    v2.set(((pj0.x + (dx / l) * 44) / R.w) * 2 - 1, -((pj0.y + (dy / l) * 44) / R.h) * 2 + 1);
    ray.setFromCamera(v2, R.camera);
    if (!ray.ray.intersectPlane(plane, hit)) return flat;   // 지평선 위로 끌었으면 단순 회전식
    const hx = hit.x - P.x, hz = hit.z - P.z;
    if (hx * hx + hz * hz < 1e-6 || hx * hx + hz * hz > 900) return flat;
    return Math.atan2(hx, hz);
  }
  HUD.dragToWorld = dragToWorld;
  function rollRect() {
    if (!padRect) { const r = el.bRoll.getBoundingClientRect(); padRect = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }
    return padRect;
  }
  function dropStick() { ptr.stick = null; stickV = null; stickRef = null; I.mx = 0; I.mz = 0; el.stick.classList.add('hide'); if (el.stickHome) el.stickHome.classList.remove('on'); }
  function flash(b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 110); }

  function bind() {
    const ui = el.ui;
    ui.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      e.preventDefault();
      const t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (t) { act(t.dataset.act, true, e); try { ui.setPointerCapture(e.pointerId); } catch (_) {} return; }
      const G = GZ.G;
      if (!G || !G.playing()) return;
      if (e.pointerType === 'mouse') { if (e.button === 0) { mouse.down = true; GZ.AU.init(); GZ.AU.resume(); } return; }
      // 스틱: r7 가로(기본) — 버튼 반대쪽 절반(왼손, 위 HUD 줄 아래) 어디든 누른 자리에 뜸. 세로(예비) — 버튼 묶음 밖이면 어디든
      const VW = GZ.vw(), VH = GZ.vh(), land = VW > VH;
      const onPadSide = land ? (lefty ? e.clientX < VW * 0.5 : e.clientX > VW * 0.5)
        : (lefty ? e.clientX < VW * 0.42 && e.clientY > VH - 260 * S : e.clientX > VW * 0.58 && e.clientY > VH - 260 * S);
      if (!ptr.stick && !onPadSide && e.clientY > (land ? 64 * S : VH * 0.22)) {
        ptr.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; stickV = { x: 0, y: 0 }; stickRef = null; stickYaw = GZ.R.yaw || 0;
        el.stick.classList.remove('hide'); if (el.stickHome) el.stickHome.classList.add('on');
        el.stickBase.style.transform = el.stickKnob.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
        try { ui.setPointerCapture(e.pointerId); } catch (_) {}
      }
    }, { passive: false });
    ui.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true; }
      const s = ptr.stick, f = ptr.fire;
      if (s && e.pointerId === s.id) {
        let dx = e.clientX - s.x0, dy = e.clientY - s.y0; const R = 50 * S, d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        el.stickKnob.style.transform = 'translate(' + (s.x0 + dx) + 'px,' + (s.y0 + dy) + 'px)';
        const dead = 0.16, m = Math.min(1, Math.hypot(e.clientX - s.x0, e.clientY - s.y0) / R);
        if (m < dead || d < 0.001) { stickV.x = 0; stickV.y = 0; stickRef = null; }
        else {
          const mag = (m - dead) / (1 - dead); stickV.x = (dx / d) * mag; stickV.y = (dy / d) * mag;
          const a = Math.atan2(dx, dy);
          if (stickRef == null || Math.abs(GZ.angDiff(a, stickRef)) > 0.3) { stickRef = a; stickYaw = GZ.R.yaw || 0; }   // 방향을 새로 잡았을 때만 지금 화면 기준으로
        }
        applyTouch();
      } else if (f && e.pointerId === f.id) {
        const dx = e.clientX - f.x0, dy = e.clientY - f.y0, d = Math.hypot(dx, dy);
        // r4: 호각을 누른 채 엄지를 「구르기」 버튼으로 미끄러뜨리면 구르기 (발사는 안 끊김, 조준은 누르기 전 값으로 되돌림)
        const rr = rollRect(), inRoll = Math.hypot(e.clientX - rr.x, e.clientY - rr.y) < rr.r * 0.92;
        if (inRoll) {
          if (!slideRoll) {
            slideRoll = true; I.rollP = true; flash(el.bRoll); if (GZ.G.pressNow) GZ.G.pressNow('roll');
            aimD = null; if (aimPrev) { aimW = aimPrev.w; aimS = aimPrev.s; aimYaw = aimPrev.y; aimKeep = 9; showAim(); } else clearAim();
            applyTouch();
          }
        } else if (slideRoll) { if (d < 30 * S) slideRoll = false; }   // 호각으로 돌아오면 다시 끌어 조준 가능
        else if (d > 14 * S && G_playing()) {
          aimS = Math.atan2(dx, dy); aimYaw = GZ.R.yaw || 0; aimW = dragToWorld(dx, dy); aimD = { dx, dy }; aimKeep = 9;
          const R = 40 * S, k = Math.min(1, d / R) * R / d;
          el.aimKnob.style.opacity = '0.9'; el.aimKnob.style.transform = 'translate(' + (lefty ? -1 : 1) * dx * k + 'px,' + dy * k + 'px)';
          applyTouch();
        }
      }
    }, { passive: false });
    const up = (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) mouse.down = false;
      if (cardDown && e.pointerId === cardDown.id) {       // 같은 카드 위에서 떼면 확정, 밖으로 끌고 나가 떼면 취소
        const cd = cardDown; cardDown = null;
        el.cardRow.querySelectorAll('.card.down').forEach((c) => c.classList.remove('down'));
        const t = e.type === 'pointerup' && document.elementFromPoint(e.clientX, e.clientY);
        const c = t && t.closest ? t.closest('[data-act]') : null;
        if (c && c.dataset.act === cd.name && GZ.G.phase === 'cards') { GZ.AU.ui(true); GZ.G.pickCard(+cd.name.slice(4)); }
        return;
      }
      if (fsPend != null && e.pointerId === fsPend) { fsPend = null; if (e.type === 'pointerup') GZView.toggle('menu'); }   // 11-14 「⛶ 전체화면」 터치
      if (ptr.stick && e.pointerId === ptr.stick.id) dropStick();
      if (ptr.fire && e.pointerId === ptr.fire.id) dropFire();
    };
    ui.addEventListener('pointerup', up); ui.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; if (ptr.fire) { dropFire(); aimKeep = 0; clearAim(); } if (ptr.stick) dropStick(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && GZ.G && GZ.G.playing()) GZ.G.pause(true); });

    window.addEventListener('keydown', (e) => {
      const G = GZ.G; if (!G) return;
      if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
      keys[e.code] = true;
      GZ.AU.init(); GZ.AU.resume();
      const live = G.playing();   // r5: 멈춤·보급 창에서 누른 행동 키는 무시 (재개 순간 발동하던 버그)
      if (e.code === 'Space') { e.preventDefault(); if (G.phase === 'title' || G.phase === 'result') G.start(); else if (live) { I.rollP = true; if (G.pressNow) G.pressNow('roll'); } }
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { if (live) { I.rollP = true; if (G.pressNow) G.pressNow('roll'); } }
      else if (e.code === 'KeyE') { if (live) { I.skillP = true; if (G.pressNow) G.pressNow('skill'); } }
      else if (e.code === 'KeyQ' || e.code === 'KeyR') { if (live) { I.ultP = true; if (G.pressNow) G.pressNow('ult'); } }
      else if (e.code === 'Escape' || e.code === 'KeyP') G.pause(!G.paused);
      else if (e.code === 'Enter' && (G.phase === 'title' || G.phase === 'result')) G.start();
      else if (G.phase === 'cards' && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) { if (performance.now() >= cardLock) G.pickCard(+e.code.slice(5) - 1); }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    // iOS 사파리: 소리는 손가락을 뗄 때(touchend·click)의 사용자 동작으로 풀림
    const unlock = () => { if (GZ.G && GZ.G.phase !== 'loading') { GZ.AU.init(); if (!GZ.G.paused) GZ.AU.resume(); } };
    document.addEventListener('touchend', unlock, { passive: true }); document.addEventListener('click', unlock);
    el.optBgm.addEventListener('input', () => { GZ.AU.vol.bgm = el.optBgm.value / 100; GZ.AU.applyVol(); });
    el.optSfx.addEventListener('input', () => { GZ.AU.vol.sfx = el.optSfx.value / 100; GZ.AU.applyVol(); });
    if (el.optVib && window.GZHaptics) el.optVib.classList.toggle('on', GZHaptics.on);   // 진동 저장값 표시
    if (el.optVoice && GZ.VO) el.optVoice.classList.toggle('on', GZ.VO.on);   // r9 목소리 저장값
    HUD.atk(GZ.G ? GZ.G.atk : 'manual');
    HUD.camLv(GZ.G ? GZ.G.camLv : 'strong');   // r9b 카메라 따라가기 저장값
    if (el.optBeat) {   // r8: 박자 보정 칸
      const showB = () => { const v = Math.round(GZ.AU.userOff * 1000); el.optBeat.value = v; el.optBeatV.textContent = (v > 0 ? '+' : '') + v + 'ms'; };
      showB(); el.optBeat.addEventListener('input', () => { GZ.AU.setUserOff(+el.optBeat.value); showB(); });
    }
  }

  // PC 입력을 I 에 반영 (매 프레임). px,pz = 플레이어 자리
  const T = THREE; const ray = new T.Raycaster(), v2 = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -1.0), hit = new T.Vector3();
  // 화면 기준 스틱·조준 → 세계 좌표 (카메라가 도는 각 R.yaw 만큼 돌림). 일시정지·보급 창이 I 를 지워도 다음 프레임에 되살아남
  const G_playing = () => !!(GZ.G && GZ.G.playing());
  function applyTouch() {
    if (!G_playing()) return;
    if (ptr.stick && stickV) { const c = Math.cos(stickYaw), sn = Math.sin(stickYaw); I.mx = stickV.x * c + stickV.y * sn; I.mz = -stickV.x * sn + stickV.y * c; }
    if (aimW != null) I.aim = aimW;
  }
  HUD.touchState = () => ({ stick: !!ptr.stick, fire: !!ptr.fire, aimS, aimW, aimKeep, stickYaw });
  HUD.pollPC = function (px, pz) {
    applyTouch();
    if (ptr.stick || ptr.fire || aimW != null) return;
    if (GZ.isTouch && !mouse.seen && !Object.keys(keys).length) return;
    const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), z = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const sig = x + ',' + z; if (sig !== keySig) { keySig = sig; keyYaw = GZ.R.yaw || 0; }   // 누른 키 조합이 바뀔 때만 지금 화면 기준으로 (카메라가 도는 동안 진행 방향이 안 휨)
    const l = Math.hypot(x, z) || 1, c = Math.cos(keyYaw), sn = Math.sin(keyYaw);
    I.mx = (x * c + z * sn) / l; I.mz = (-x * sn + z * c) / l;
    I.fire = mouse.down || !!keys.KeyJ;
    if (mouse.seen) {
      v2.set((mouse.x / GZ.vw()) * 2 - 1, -(mouse.y / GZ.vh()) * 2 + 1);
      ray.setFromCamera(v2, GZ.R.camera);
      if (ray.ray.intersectPlane(plane, hit)) I.aim = Math.atan2(hit.x - px, hit.z - pz);
    }
  };

  HUD.screen = function (name) {
    ['title', 'cards', 'pause', 'result', 'loading'].forEach((k) => el[k].classList.toggle('hide', k !== name));
    if (name === 'title' && GZ.AS) GZ.AS.title();   // 비서 그런트 브리핑
  };
  HUD.showHud = function (v) {
    el.hud.classList.toggle('hide', !v);
    document.body.classList.toggle('pc', !GZ.isTouch);
    el.keyHint.classList.toggle('hide', GZ.isTouch || !v);
    if (!v) { el.banner.classList.add('hide'); el.shout.classList.add('hide'); }
  };
  // r9 공격 방식 표시: 타이틀 두 버튼·일시정지 토글·호각 버튼(자동이면 「자동」, 눌러도 안 쏨)
  HUD.atk = function (m) {
    const a = m === 'auto';
    document.body.classList.toggle('atkAuto', a);
    if (el.atkAuto) { el.atkAuto.classList.toggle('on', a); el.atkManual.classList.toggle('on', !a); }
    if (el.optAtk) el.optAtk.classList.toggle('on', a);
    if (el.bFire) { el.bFire.classList.toggle('auto', a); const sp = el.bFire.querySelector('.core span'); if (sp) sp.textContent = a ? '자동' : '호각'; }
    if (GZ.AS) GZ.AS.pick('atk', m);
    if (el.keyHint) el.keyHint.innerHTML = a ? '<b>WASD</b> 이동 · 호각 <b>자동</b> · <b>Space</b> 구르기 · <b>E</b> 차렷 · <b>Q</b> 전체 기상' : '<b>WASD</b> 이동 · <b>마우스 왼쪽</b> 꾹 호각 · <b>Space</b> 구르기 · <b>E</b> 차렷 · <b>Q</b> 전체 기상';
  };
  HUD.camLv = function (v) { if (el.optLead) for (const b of el.optLead.children) b.classList.toggle('on', b.dataset.act === 'lead_' + v); };
  HUD.diff = function (d) { if (el.diffEasy) { el.diffEasy.classList.toggle('on', d === 'easy'); el.diffNormal.classList.toggle('on', d !== 'easy'); } if (GZ.AS) GZ.AS.pick('diff', d); };
  HUD.loadProgress = function (k) { const b = el.loading.querySelector('i'); if (b) b.style.width = Math.round(k * 100) + '%'; };
  HUD.banner = function (main, sub, dur, red, low) {
    if (shoutT > 0) { pendBanner = [main, sub, dur, red, low]; return; }   // r3: 외침(「전체 기상!」)이 떠 있으면 끝난 뒤에 띄움 (글자 겹침 방지)
    const b = el.banner;
    b.classList.remove('hide'); b.classList.toggle('red', !!red); b.classList.toggle('low', !!low);   // r8: low = 화면 아래쪽 (보스 단계 배너)
    b.querySelector('.main').textContent = main; b.querySelector('.sub').textContent = sub || '';
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    bannerT = dur || 1.6;
  };
  HUD.shout = function (txt, dur, cls) {
    const s = el.shout; s.textContent = txt; s.classList.remove('hide'); s.classList.toggle('ult', cls === 'ult');   // r8: 「전체 기상!」은 왼쪽 위
    el.banner.classList.add('hide'); bannerT = 0;   // 외침과 띠 글자가 겹치지 않게
    s.style.animation = 'none'; void s.offsetWidth; s.style.animation = '';
    shoutT = dur || 0.9;
  };
  HUD.hint = function (txt, dur) { el.hint.textContent = txt; el.hint.classList.remove('hide'); hintT = dur || 4; };
  HUD.hintOff = function () { el.hint.classList.add('hide'); hintT = 0; };
  HUD.hurt = function () { el.vig.style.transition = 'none'; el.vig.style.opacity = '1'; requestAnimationFrame(() => { el.vig.style.transition = 'opacity .45s'; el.vig.style.opacity = '0'; }); };
  HUD.wave = function (name) { el.waveName.textContent = name; };

  HUD.cards = function (list) {
    el.cardRow.innerHTML = '';
    list.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'card'; b.dataset.act = 'card' + i;
      b.innerHTML = '<div class="ico">' + c.ico + '</div><div class="tx"><div class="nm">' + c.name + (c.lv ? '<small>' + c.lv + '단계</small>' : '') + '</div><div class="ds">' + c.desc + '</div></div>';
      el.cardRow.appendChild(b);
    });
    el.banner.classList.add('hide'); el.hint.classList.add('hide'); hintT = 0; pendBanner = null;
    if (GZ.AS) GZ.AS.radioOff();
    cardLock = performance.now() + 500; cardDown = null;
    el.cards.classList.add('locked'); setTimeout(() => el.cards.classList.remove('locked'), 500);
    HUD.screen('cards');
  };
  // 일시정지·보급 뒤: 손가락이 아직 호각 위에 있으면 발사를 되살림 (뗐다 다시 누르지 않아도 되게)
  HUD.restoreHeld = function () { if (ptr.fire) { I.fire = true; el.bFire.classList.add('down'); } else if (mouse.down) I.fire = true; applyTouch(); };
  let bbB = 0, bbT = -1;   // r8: 보스 막대 아래 끝(px) — 0.5초마다 다시 잼
  HUD.bossBarBottom = function () { const now = performance.now(); if (now - bbT > 500) { bbT = now; const r = el.bossBar.getBoundingClientRect(); bbB = r.height > 0 ? r.bottom : (12 + 30) * S; } return bbB; };
  HUD.paused = function (v) { el.ui.classList.toggle('paused', !!v); };
  let modeB = null, modeC = null;
  let modeU = null;
  HUD.mode = function (boss, cine, ultCine) {
    if (ultCine !== modeU) { modeU = ultCine; el.hud.classList.toggle('ultc', !!ultCine); }   // r7 (검토 A3): 「전체 기상!」 연출 동안 안내 글 숨김
    if (boss !== modeB) { modeB = boss; el.hud.classList.toggle('bossOn', boss); }
    if (cine !== modeC) { modeC = cine; el.hud.classList.toggle('cine', cine); }
  };
  HUD.result = function (d) {
    el.result.classList.toggle('lose', !d.win);
    el.resTitle.textContent = d.win ? '임무 완수' : '작전 실패';
    el.resSub.textContent = d.sub;
    el.grade.textContent = d.grade;
    el.grade.style.color = d.win ? '' : '#ff8a7a';
    if (el.resAuto) el.resAuto.classList.toggle('hide', !d.auto);   // r9: 자동 공격으로 한 판
    el.resRows.innerHTML = d.rows.map((r) => '<div><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    const rg = document.getElementById('resGoal'); if (rg) rg.textContent = d.goal || '';
    HUD.screen('result');
    if (GZ.AS) GZ.AS.result(d);   // 비서 그런트: 승리 cheer → 등급별 / 패배 bow
  };

  const pj = { x: 0, y: 0, behind: false };
  HUD.update = function (dt) {
    const G = GZ.G, P = G.P;
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.classList.add('hide'); }
    el.hint.classList.toggle('lowB', bannerT > 0 && el.banner.classList.contains('low'));
    if (shoutT > 0) { shoutT -= dt; if (shoutT <= 0) { el.shout.classList.add('hide'); if (pendBanner) { const a = pendBanner; pendBanner = null; if (G.phase !== 'cards' && G.phase !== 'result') HUD.banner(a[0], a[1], a[2], a[3], a[4]); } } }
    if (!ptr.fire && aimKeep > 0 && aimKeep < 5) { aimKeep -= dt; if (aimKeep <= 0) clearAim(); }
    // r9b: 웨이브에서 누르고 있는 동안 카메라가 앞서 가며 옮겨지면 (보스전은 카메라가 돌 수 있어 r4 대로 세계 기준 그대로) 끈 방향을 지금 화면으로 다시 맞춤 — 화면에 보이는 방향 = 끈 방향 그대로
    if (ptr.fire && aimD && !slideRoll && aimW != null && G.phase === 'play' && Math.abs((GZ.R.yaw || 0) - aimYaw) < 0.005) { aimW = dragToWorld(aimD.dx, aimD.dy); I.aim = aimW; }
    if (aimW != null && Math.abs((GZ.R.yaw || 0) - aimYaw) > 0.01 && Math.abs(GZ.R.yawV || 0) > 0.001) showAim();   // 카메라가 도는 동안: 흰 점만 화면에 맞게 옮김 (겨눈 곳은 그대로)
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) el.hint.classList.add('hide'); }
    if (GZ.AS && !G.paused) GZ.AS.update(dt, (bannerT > 0 && !el.banner.classList.contains('low')) || shoutT > 0 || G.phase === 'bossIntro' || modeU || !G.playing());   // 비서 무전: 띠 글자·외침·연출 중엔 기다림
    if (HUD.portraitBlock && G.playing()) G.pause(true);   // r7: 세로로 든 동안은 시작돼도 바로 멈춤
    if (G.nudgeSkill > 0) G.nudgeSkill -= dt; el.bSkill.classList.toggle('nudge', G.nudgeSkill > 0 && !el.hud.classList.contains('hide'));   // r5 마무리: 첫 방패병 — 「차렷!」 버튼 번쩍임
    if (el.hud.classList.contains('hide')) return;
    const hp = Math.max(0, Math.ceil(P.hp));
    if (hp !== lastHp || P.maxHp !== HUD._mx) {
      lastHp = hp; HUD._mx = P.maxHp;
      const k = hp / P.maxHp;
      el.hpFill.style.transform = el.hpGhost.style.transform = 'scaleX(' + k.toFixed(3) + ')';
      el.hpNum.textContent = hp;
      if (GZ.AS && G.playing()) GZ.AS.hp(k, G.t);   // 체력이 바뀔 때만
    }
    const b = GZ.EN.boss;
    const showBoss = !!b && !b.dead && G.phase !== 'bossIntro';   // r3: 등장 큰 제목이 사라진 뒤에 이름·막대가 나옴 (이름 두 번 겹침 방지)
    el.bossBar.classList.toggle('hide', !showBoss);
    if (showBoss) {
      const k = Math.max(0, b.hp / b.max);
      if (Math.abs(k - lastBoss) > 0.0005) { lastBoss = k; el.bossFill.style.transform = el.bossGhost.style.transform = 'scaleX(' + k.toFixed(4) + ')'; el.bossPh.textContent = b.phase + '단계'; }
    }
    if (G.combo !== lastCombo) {
      el.combo.classList.toggle('hide', G.combo < 3);
      if (G.combo > lastCombo && G.combo >= 3) { el.comboN.textContent = G.combo; el.combo.classList.remove('pop'); void el.combo.offsetWidth; el.combo.classList.add('pop'); }
      lastCombo = G.combo;
    }
    comboT -= dt; if (comboT <= 0) { comboT = 0.2; HUD.comboRect = G.combo >= 3 ? el.combo.getBoundingClientRect() : null; }
    const g = Math.round(P.gauge);
    if (g !== lastGauge) { lastGauge = g; el.ultArc.setAttribute('stroke-dashoffset', (282.7 * (1 - g / 100)).toFixed(1)); el.bUlt.classList.toggle('ready', g >= 100); }
    el.bUlt.classList.toggle('lock', !!G.ultBlocked);   // r5: 보스 단계 전환 중엔 잠김 표시 (게이지는 그대로)
    const rc = GZ.sat(P.rollCd / G.U.rollCd), sc = GZ.sat(P.skillCd / G.U.skillCd);
    el.bRoll.style.setProperty('--cd', rc.toFixed(3)); el.bRoll.classList.toggle('cool', rc > 0);
    el.bSkill.style.setProperty('--cd', sc.toFixed(3)); el.bSkill.classList.toggle('cool', sc > 0);
    for (let i = 0; i < el.streakI.length; i++) el.streakI[i].classList.toggle('on', i < P.streak);
    { const rm = G.remaining(); el.waveSub.textContent = G.phase === 'boss' || G.phase === 'bossIntro' || (GZ.EN.boss && !GZ.EN.boss.dead) ? '침묵 기관' : rm > 0 ? '남은 기계 ' + rm : ''; }   // r8 (검토 B): 0 이면 비움
    // 박자 고리: 박자가 다가올수록 버튼 테두리로 조여듦
    const ph = ((((G.bt - GZ.AU.latency()) / GZ.AU.BEAT) % 1) + 1) % 1;   // 0 = 정박 (소리 지연만큼 늦춰 귀에 들리는 박자와 맞춤)
    const sc2 = 1 + (1 - ph) * 0.16;   // r8 (검토 A3): 0.42 → 0.16 — 바깥 고리가 차렷·구르기·전체 기상 버튼 위로 지나가지 않게
    el.beatRing.style.transform = 'scale(' + sc2.toFixed(3) + ')';
    el.beatRing.style.opacity = (ph < 0.12 ? 1 : 0.15 + ph * 0.6).toFixed(2);
    el.beatRing.style.borderColor = ph < 0.16 || ph > 0.84 ? '#fff' : '';
    // 화면 밖 적 표시 (r3: 공격 준비 중이면 화살표 2배·깜빡임 + 공격이 오는 가장자리에 붉은 띠 + 경보음)
    let n = 0;
    const w = GZ.R.w, h = GZ.R.h, m = 24 * S, top = 78 * S, padL = lefty ? 236 * S : 0, padR = lefty ? 0 : 236 * S, padTop = h - 250 * S;
    const tnow = performance.now(), blink = 0.5 + 0.5 * Math.sin(tnow * 0.034);
    let eT = 0, eB = 0, eL = 0, eR = 0; const oc = { T: 0, B: 0, L: 0, R: 0 }; let offN = 0;
    for (const e of GZ.EN.list) {
      if (e.dead) continue;
      GZ.R.project(e.x, 1, e.z, pj);
      let x = pj.x, y = pj.y;
      if (pj.behind) { x = w - x; y = h + 200; }
      const hidden = y > padTop && (lefty ? x < padL : x > w - padR);   // 버튼 묶음 밑에 깔린 적도 표시
      if (x > 0 && x < w && y > 0 && y < h && !hidden) continue;
      offN++;
      const cx = w / 2, cy = h * 0.5, ang = Math.atan2(x - cx, -(y - cy));
      { const ax0 = Math.abs(Math.sin(ang)), ay0 = Math.abs(Math.cos(ang)); if (ax0 * h > ay0 * w) oc[Math.sin(ang) > 0 ? 'R' : 'L']++; else oc[Math.cos(ang) > 0 ? 'T' : 'B']++; }
      if (n >= arrows.length) continue;
      let ax = GZ.clamp(x, m, w - m), ay = GZ.clamp(y, top, h - m);
      if (ay > padTop - m && (lefty ? ax < padL + m : ax > w - padR - m)) ay = padTop - m;   // 화살표가 버튼 밑에 숨지 않게
      const a = arrows[n++];
      const hot = e.state === 'wind' || e.state === 'aim' || e.state === 'dash' || e.state === 'charge';
      const dist = Math.hypot(e.x - P.x, e.z - P.z), sc = hot ? 2.0 + 0.3 * blink : dist < 6 ? 1.5 : dist < 11 ? 1.2 : 1;
      if (hot && e.kind !== 'boss') { if (x <= 0) eL = 1; else if (x >= w) eR = 1; else if (y <= 0) eT = 1; else eB = 1; G.tipArrow(); }
      a.className = (e.kind === 'absorber' ? 'arw blue' : 'arw') + (hot ? ' hot' : '');
      a.style.opacity = hot ? (0.55 + 0.45 * blink).toFixed(2) : '0.95';
      a.style.transform = 'translate(' + ax.toFixed(0) + 'px,' + ay.toFixed(0) + 'px) rotate(' + ang.toFixed(2) + 'rad) scale(' + sc.toFixed(2) + ')';
    }
    for (let i = n; i < arrows.length; i++) arrows[i].style.opacity = '0';
    // r5: 화면 밖 적이 있는 쪽 가장자리에 옅은 금빛 띠 + 그쪽 적 수 (공격 준비 중이면 붉은 띠가 위에 덮임)
    HUD.offN = offN; HUD.offC = oc;
    if (el.offs) for (const k of ['T', 'B', 'L', 'R']) { const d = el.offs.querySelector('.o' + k), c = G.playing() ? oc[k] : 0; d.style.opacity = c ? Math.min(0.9, 0.35 + c * 0.14).toFixed(2) : '0'; const b = d.firstChild; if (b && b.textContent !== String(c)) b.textContent = c > 1 ? String(c) : ''; }
    const live = G.playing() && !P.down, ek = live ? (0.55 + 0.45 * blink).toFixed(2) : '0';
    edgeEl.T.style.opacity = eT ? ek : '0'; edgeEl.B.style.opacity = eB ? ek : '0'; edgeEl.L.style.opacity = eL ? ek : '0'; edgeEl.R.style.opacity = eR ? ek : '0';
    HUD.edge = live ? { T: eT, B: eB, L: eL, R: eR } : { T: 0, B: 0, L: 0, R: 0 };
    if (live && (eT || eB || eL || eR)) GZ.AU.alarm();
  };
  // r4: 뜨는 글자(피해 숫자·정박·막힘)가 피해야 할 화면 영역 — 외침(차렷!·전체 기상!), 띠 글자, 얼굴 컷인 창, 콤보, 안내
  const avoidL = [];
  HUD.avoid = function () {
    avoidL.length = 0;
    const add = (e, pad) => { const r = e.getBoundingClientRect(); if (r.width > 2 && r.height > 2) avoidL.push({ l: r.left - pad, r: r.right + pad, t: r.top - pad, b: r.bottom + pad }); };
    if (shoutT > 0) add(el.shout, 2);
    if (bannerT > 0) add(el.banner, 0);
    if (el.cutin && el.cutin.classList.contains('on')) add(el.cutin, 4);
    if (hintT > 0) add(el.hint, 2);
    if (HUD.comboRect) { const r = HUD.comboRect; avoidL.push({ l: r.left - 10, r: r.right + 4, t: r.top - 6, b: r.bottom + 6 }); }
    return avoidL;
  };
  HUD.reset = function () { if (GZ.AS) GZ.AS.reset(); clearAim(); aimKeep = 0; pendBanner = null; lastHp = lastBoss = lastCombo = lastGauge = -1; el.combo.classList.add('hide'); el.hint.classList.add('hide'); hintT = 0; el.bossBar.classList.add('hide'); };
})();
