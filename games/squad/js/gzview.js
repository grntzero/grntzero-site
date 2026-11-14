/* 그런트제로 게임 3종 공통 — 화질(동적 해상도)·전체화면(⛶ 버튼·첫 터치 자동)·확인용 표시(?hud=1)
   같은 파일을 A 톱니골 던전·B GRUNT ZERO RE·SEFO KIDS ENERGY RUN 이 함께 씀 (2026-11-13 갤럭시탭 화질·전체화면)
   - 화질 「자동」(기본): 기기 화소 배율(dpr, 상한 2)로 시작. 4초 넘게 느리면(45fps 아래) 0.1씩 천천히 내리되 바닥 1.25,
     아주 느릴 때(32fps 아래 6초)만 1.0 까지. 내려도 빨라지지 않으면(화면 30Hz 고정·절전 등) 되돌리고 1분 동안 안 내림.
   - 화질 「높게」: 늘 기기 배율(상한 2), 안 내림.
   - 전체화면: 터치 기기에서 첫 손가락 떼기(pointerup) 때 전체화면 + 가로 고정 시도. ⛶ 버튼으로 켜기/끄기.
     뒤로가기·알림 등으로 저절로 풀리면 「게임 화면」에서 다음 터치 때 다시 시도(메뉴에선 안 함). ⛶ 로 직접 끄면 다시 안 켬.
     지원 안 되는 기기(아이폰 사파리 등)는 버튼을 숨기고 조용히 넘어감. PC 마우스는 자동 안 함(버튼은 있음).
   - 2026-11-14 r8f(러너): ⛶ 버튼을 크고 또렷하게(44px·보라 바탕·흰 테). 지원 안 되는 기기(아이폰 사파리 등)도 버튼을 보이고,
     누르면 「홈 화면에 추가」 안내 창(V.help). 홈 화면 앱으로 연 상태(standalone)면 이미 꽉 찬 화면이라 버튼 숨김. V.toggle() = 버튼과 같은 동작(메뉴 단추용).
   - 2026-11-14: 세 게임(러너·에코 제로·그런트 스쿼드) 같은 판. 안내 창은 연 뒤 0.45초 동안 닫힘 click 무시(누르는 순간 여는 B 멈춤 창 단추). */
(function () {
  'use strict';
  const V = (window.GZView = window.GZView || {});
  const q = new URLSearchParams(location.search);
  V.dpr = window.devicePixelRatio || 1;
  V.maxPR = Math.min(V.dpr, 2);
  V.SOFT = 1.25; V.HARD = 1.0;
  V.key = 'gz';

  // ---------------- 화질 ----------------
  V.quality = 'auto';
  V.loadQuality = function (key) {
    V.key = key || V.key;
    let m = 'auto';
    try { const v = localStorage.getItem(V.key + '_quality'); if (v === 'high' || v === 'auto') m = v; } catch (e) { /* 저장 안 되는 곳 */ }
    const qq = q.get('gq'); if (qq === 'high' || qq === 'auto') m = qq;   // 시험용 ?gq=high|auto (저장 안 함)
    V.quality = m;
    return m;
  };
  const qListeners = [];
  V.onQuality = function (fn) { qListeners.push(fn); fn(V.quality); };
  V.setQuality = function (m) {
    if (m !== 'auto' && m !== 'high') return V.quality;
    V.quality = m;
    try { localStorage.setItem(V.key + '_quality', m); } catch (e) { /* 저장 안 되는 곳 */ }
    if (V.dyn) V.dyn.setMode(m);
    qListeners.forEach((fn) => { try { fn(m); } catch (e) { /* 무시 */ } });
    return m;
  };
  V.toggleQuality = function () { return V.setQuality(V.quality === 'high' ? 'auto' : 'high'); };

  // 동적 해상도: 1초마다 feed(fps) → 배율이 바뀌면 true. o: {maxPR, soft, hard, enabled()}
  V.makeDyn = function (o) {
    const maxPR = o.maxPR != null ? o.maxPR : V.maxPR;
    const d = {
      maxPR, soft: Math.min(maxPR, o.soft != null ? o.soft : V.SOFT), hard: Math.min(maxPR, o.hard != null ? o.hard : V.HARD),
      pr: maxPR, mode: V.quality, slow: 0, vslow: 0, good: 0, hold: 3, lockUntil: 0, probe: null, steps: [],
    };
    const now = () => performance.now() / 1000;
    const round = (v) => Math.round(v * 100) / 100;
    d.setMode = function (m) { d.mode = m; d.hold = 2; d.slow = d.vslow = d.good = 0; d.probe = null; if (m === 'high') d.pr = d.maxPR; if (d.onChange) d.onChange(d.pr); };
    d.kick = function (s) { d.hold = Math.max(d.hold, s || 2); };   // 크기 바뀜·화면 전환 직후 몇 초는 판단 안 함
    d.feed = function (fps) {
      const old = d.pr;
      if (d.mode === 'high' || (o.enabled && !o.enabled())) { d.pr = d.mode === 'high' ? d.maxPR : d.pr; return d.pr !== old; }
      if (document.hidden) { d.hold = 2; return false; }
      if (d.hold > 0) { d.hold--; return false; }
      // 내린 뒤 3초 재 보고, 빨라지지 않았으면(5% 미만) 되돌리고 1분 동안 안 내림 — 화면이 30Hz 로 묶인 기기에서 쓸데없이 흐려지지 않게
      if (d.probe) {
        d.probe.n++; d.probe.sum += fps;
        if (d.probe.n >= 3) {
          const after = d.probe.sum / d.probe.n;
          if (after < d.probe.before * 1.05) { d.pr = d.probe.from; d.lockUntil = now() + 60; d.steps.push(['되돌림', d.pr, Math.round(d.probe.before), Math.round(after)]); d.hold = 2; }
          d.probe = null;
        }
        return d.pr !== old;
      }
      if (fps < 45) {
        d.good = 0; d.slow++; d.vslow = fps < 32 ? d.vslow + 1 : 0;
        if (now() < d.lockUntil) return false;
        let to = d.pr;
        if (d.slow >= 4 && d.pr > d.soft + 1e-3) to = Math.max(d.soft, d.pr - 0.1);
        else if (d.pr <= d.soft + 1e-3 && d.vslow >= 6 && d.pr > d.hard + 1e-3) to = Math.max(d.hard, d.pr - 0.1);
        if (to !== d.pr) { d.probe = { from: d.pr, before: fps, n: 0, sum: 0 }; d.pr = round(to); d.slow = 0; d.vslow = 0; d.hold = 1; d.steps.push(['내림', d.pr, Math.round(fps)]); }
      } else if (fps > 55) {
        d.slow = 0; d.vslow = 0; d.good++;
        if (d.good >= 3 && d.pr < d.maxPR - 1e-3) { d.pr = round(Math.min(d.maxPR, d.pr + 0.1)); d.good = 0; d.hold = 1; d.steps.push(['올림', d.pr, Math.round(fps)]); }
      } else { d.slow = Math.max(0, d.slow - 1); d.vslow = 0; d.good = 0; }
      return d.pr !== old;
    };
    d.setMode(V.quality);
    V.dyn = d;
    return d;
  };

  // ---------------- 전체화면 ----------------
  const D = document, DE = D.documentElement;
  const ua = navigator.userAgent || '';
  const iPhone = /iPhone|iPod/.test(ua);
  V.fsSupported = function () {
    if (iPhone) return false;
    const rq = DE.requestFullscreen || DE.webkitRequestFullscreen;
    const en = D.fullscreenEnabled != null ? D.fullscreenEnabled : D.webkitFullscreenEnabled;
    return !!rq && en !== false;
  };
  V.isFs = () => !!(D.fullscreenElement || D.webkitFullscreenElement);
  // 홈 화면 앱으로 연 상태(아이폰 「홈 화면에 추가」·안드로이드 앱 설치) — 이미 주소창 없이 꽉 찬 화면
  V.isStandalone = () => !!(navigator.standalone || (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)));
  V.isIOS = () => iPhone || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || /iPad/.test(ua);
  V.isTouchDev = () => (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  // 자동 시험 브라우저(navigator.webdriver)에서는 자동 전체화면(첫 터치·시작 버튼·다시 시도)을 끔 — 기존 시험의 화면 크기가 바뀌지 않게. ?fs=1 이면 켬(전체화면 시험용). ⛶ 버튼은 늘 됨
  V.autoOK = !navigator.webdriver || q.get('fs') === '1';
  V.fs = { tries: 0, ok: 0, err: 0, auto: 0, userOff: false, first: true, want: false, wasFs: false, pending: false, lock: 0 };
  V.cfg = { isPlay: () => false, anchor: '#pauseBtn' };

  function lockLand() {
    try { const o = screen.orientation; if (o && o.lock) { const p = o.lock('landscape'); if (p && p.catch) p.catch(() => {}); V.fs.lock++; } } catch (e) { /* 지원 안 함 */ }
  }
  V.enter = function (why) {
    if (!V.fsSupported()) { lockLand(); return false; }
    if (V.isFs()) { lockLand(); return true; }
    if (V.fs.pending) return false;
    V.fs.tries++; V.fs.pending = true; V.fs.last = why || '';
    try {
      const p = DE.requestFullscreen ? DE.requestFullscreen({ navigationUI: 'hide' }) : DE.webkitRequestFullscreen();
      const done = () => { V.fs.pending = false; };
      if (p && p.then) p.then(() => { done(); V.fs.ok++; lockLand(); }, () => { done(); V.fs.err++; });
      else { done(); lockLand(); }
    } catch (e) { V.fs.pending = false; V.fs.err++; }
    return true;
  };
  V.exit = function () {
    try { if (D.exitFullscreen) { const p = D.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } else if (D.webkitExitFullscreen) D.webkitExitFullscreen(); } catch (e) { /* 무시 */ }
  };
  // 게임 쪽 「시작」 버튼 등에서 부름: 지금 사용자 동작 안이면 바로, 아니면(pointerdown 등) 이어지는 손가락 떼기 때 시도
  V.request = function (why) {
    if (!V.autoOK) return;   // 자동 시험 브라우저: 기존 시험 화면 크기 보호 (?fs=1 이면 켬)
    if (!V.isTouchDev() || !V.fsSupported() || V.isFs()) { if (V.isTouchDev()) lockLand(); return; }
    V.fs.userOff = false; V.fs.want = true;
    const ua2 = navigator.userActivation;
    if (ua2 && ua2.isActive) { V.fs.want = false; V.enter(why || 'start'); }
  };
  function onUp(e) {
    if (e.pointerType === 'mouse' || !V.autoOK) return;
    if (e.target && e.target.closest && e.target.closest('#gzFsBtn')) return;
    if (!V.fsSupported() || V.isFs()) return;
    if (V.fs.err >= 4 && V.fs.ok === 0) return;   // 계속 거절되는 곳은 더 안 조름
    const play = (() => { try { return !!V.cfg.isPlay(); } catch (x) { return false; } })();
    let why = null;
    if (V.fs.want) why = 'start';
    else if (!V.fs.userOff && V.fs.first) why = 'first';
    else if (!V.fs.userOff && V.fs.wasFs && play) why = 'again';
    V.fs.first = false;
    if (!why) return;
    V.fs.want = false; V.fs.auto++;
    V.enter(why);
  }
  function onFsChange() {
    if (V.isFs()) V.fs.wasFs = true;
    paintBtn();
    if (V.dyn) V.dyn.kick(2);
  }

  // ⛶ 버튼: 멈춤 버튼 바로 아래(오른쪽 위 구석) — 조작 버튼(아래쪽)·글자와 떨어진 곳. 작고 옅게(아이 손가락 실수 줄임)
  let btn = null;
  function paintBtn() {
    if (!btn) return;
    const on = V.isFs();
    btn.classList.toggle('on', on);
    try { if (V.cfg.onState) V.cfg.onState(on, V.fsSupported()); } catch (e) { /* 무시 */ }
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '전체 화면 끄기' : '전체 화면');
  }
  // 버튼 자리에 겹치는 「보이는」 글자·버튼·그림 찾기 (글자는 실제 글자 상자만 — 가로로 긴 띠 칸 전체가 아니라)
  function textRects(e) {
    const out = [];
    for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { const rg = D.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) out.push(r); }
    return out;
  }
  function shown(e) {
    for (let n = e; n && n !== D.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; }
    return true;
  }
  V.hits = function (R, M) {
    M = M == null ? 3 : M;
    const W = innerWidth, H = innerHeight, out = [];
    const hit = (r) => r.width >= 2 && r.height >= 2 && Math.min(R.right + M, r.right) - Math.max(R.left - M, r.left) > 0 && Math.min(R.bottom + M, r.bottom) - Math.max(R.top - M, r.top) > 0;
    for (const e of D.querySelectorAll('body *')) {
      if (e === btn || (btn && btn.contains(e)) || e.id === 'gzHud' || e.id === 'c' || e.tagName === 'STYLE' || e.tagName === 'SCRIPT') continue;
      const tag = e.tagName, solid = tag === 'BUTTON' || tag === 'INPUT' || tag === 'IMG' || tag === 'CANVAS' || tag === 'svg' || e.hasAttribute('data-act');
      let rs = [];
      if (solid) { const r = e.getBoundingClientRect(); if (r.width * r.height < W * H * 0.4) rs.push(r); }
      else rs = textRects(e);
      if (rs.some(hit) && shown(e)) out.push(e);
    }
    return out;
  };
  V.place = function () {
    if (!btn || btn.classList.contains('hide')) return;
    const sz = btn.offsetWidth || 30, g = V.cfg.gap != null ? V.cfg.gap : 12;
    const a = V.cfg.anchor && D.querySelector(V.cfg.anchor);
    let r = a && a.getClientRects().length ? a.getBoundingClientRect() : null;
    if (r && (r.width < 2 || !shown(a))) r = null;
    const vw = innerWidth, vh = innerHeight;
    // 자리 후보: 기준 버튼 바로 아래 → 기준 왼쪽 → 오른쪽 위 구석 → 왼쪽 위 구석 → 위 가운데 조금 오른쪽. 글자·버튼과 안 겹치는 첫 자리
    const cand = [];
    if (r) { cand.push([r.left + r.width / 2 - sz / 2, r.bottom + g]); cand.push([r.left - g - sz, r.top + r.height / 2 - sz / 2]); }
    cand.push([vw - sz - 8, 8], [8, 8], [vw - sz - 8, Math.round(vh * 0.28)], [vw * 0.62, 6]);
    let pick = null;
    for (const [x0, y0] of cand) {
      const x = Math.round(Math.max(4, Math.min(vw - sz - 4, x0))), y = Math.round(Math.max(4, Math.min(vh - sz - 4, y0)));
      if (!V.hits({ left: x, top: y, right: x + sz, bottom: y + sz }).length) { pick = [x, y]; break; }
    }
    if (!pick) pick = [Math.round(Math.max(4, Math.min(vw - sz - 4, cand[0][0]))), Math.round(Math.max(4, cand[0][1]))];
    btn.style.left = pick[0] + 'px'; btn.style.top = pick[1] + 'px';
  };
  // r8f: ⛶ 버튼·메뉴 단추 공통. 전체화면이 안 되는 곳(아이폰 사파리 등)은 「홈 화면에 추가」 안내
  V.toggle = function (why) {
    V.fs.first = false;
    if (!V.fsSupported()) { V.help(); return 'help'; }
    if (V.isFs()) { V.fs.userOff = true; V.fs.wasFs = false; V.exit(); return 'off'; }
    V.fs.userOff = false; V.enter(why || 'button'); return 'on';
  };
  let help = null;
  V.helpShown = () => !!(help && !help.classList.contains('hide'));
  V.help = function () {
    try { if (V.cfg.onHelp) V.cfg.onHelp(); } catch (e) { /* 무시 */ }
    if (!help) {
      help = D.createElement('div'); help.id = 'gzFsHelp'; help.setAttribute('role', 'dialog');
      const stop = (e) => { e.stopPropagation(); };
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'keydown'].forEach((t) => help.addEventListener(t, stop));
      help.addEventListener('click', (e) => { if (performance.now() - (V.helpAt || 0) < 450) return;   // 11-14: 누르는 순간(pointerdown) 연 안내가 같은 손가락의 click 으로 바로 닫히지 않게(B 멈춤 창)
        if (e.target === help || (e.target.closest && e.target.closest('[data-close]'))) help.classList.add('hide'); });
      D.body.appendChild(help);
    }
    const name = V.cfg.appName || '게임';
    const steps = V.isIOS()
      ? ['사파리 아래(아이패드는 위) <b>공유 버튼</b>(네모에 위 화살표 □↑)을 눌러요', '<b>「홈 화면에 추가」</b>를 누르고 「추가」', '홈 화면에 생긴 <b>' + name + '</b> 아이콘으로 열면 주소창 없이 화면이 꽉 차요']
      : ['브라우저 오른쪽 위(또는 아래) <b>메뉴(⋮)</b>를 눌러요', '<b>「홈 화면에 추가」</b>(또는 「앱 설치」)를 눌러요', '홈 화면의 <b>' + name + '</b> 아이콘으로 열면 화면이 꽉 차요'];
    help.innerHTML = '<div class="box"><h3>화면을 꽉 차게 하려면</h3><p style="margin:0 0 6px">이 브라우저는 전체화면 버튼이 안 돼요. 대신 이렇게 해 보세요!</p><ol>' +
      steps.map((x) => '<li>' + x + '</li>').join('') + '</ol><button type="button" data-close="1">알겠어요</button></div>';
    help.classList.remove('hide'); V.helpAt = performance.now();
    return true;
  };
  V.initFs = function (cfg) {
    Object.assign(V.cfg, cfg || {});
    window.addEventListener('pointerup', onUp, true);
    D.addEventListener('fullscreenchange', onFsChange);
    D.addEventListener('webkitfullscreenchange', onFsChange);
    const st = D.createElement('style');
    st.textContent = '#gzFsBtn{position:fixed;z-index:2147483000;width:44px;height:44px;padding:0;margin:0;border:2.5px solid #fff;border-radius:13px;box-sizing:border-box;' +
      'background:rgba(98,68,190,.92);color:#fff;font:700 19px/30px system-ui,sans-serif;text-align:center;opacity:1;touch-action:manipulation;box-shadow:0 3px 8px rgba(30,20,60,.35);' +
      '-webkit-tap-highlight-color:transparent;cursor:pointer;user-select:none;-webkit-user-select:none}#gzFsBtn:active{transform:scale(.92)}' +
      '#gzFsBtn svg{width:24px;height:24px;display:block;margin:7.5px auto}#gzFsBtn.hide{display:none}' +
      '#gzFsHelp{position:fixed;inset:0;z-index:2147483002;display:flex;align-items:center;justify-content:center;background:rgba(20,14,40,.55);padding:12px}' +
      '#gzFsHelp.hide{display:none}#gzFsHelp .box{max-width:460px;width:100%;max-height:100%;overflow:auto;box-sizing:border-box;background:#FFFDF6;border-radius:22px;padding:16px 20px;color:#2B1F57;' +
      'font:600 16px/1.5 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)}#gzFsHelp h3{margin:0 0 8px;font-size:19px;color:#6244BE}#gzFsHelp ol{margin:0 0 10px;padding-left:22px}' +
      '#gzFsHelp li{margin:3px 0}#gzFsHelp button{display:block;width:100%;min-height:46px;border:0;border-radius:23px;background:#FFD23A;color:#2B1F57;font:800 18px system-ui,sans-serif;cursor:pointer}' +
      '#gzHud{position:fixed;left:4px;bottom:4px;z-index:2147483001;pointer-events:none;font:600 10px/1.25 ui-monospace,Menlo,monospace;' +
      'color:#fff;background:rgba(0,0,0,.55);padding:3px 5px;border-radius:5px;white-space:pre}.gzStandalone [data-gz-fsrow]{display:none!important}';
    D.head.appendChild(st);
    if (V.isStandalone() && !V.fsSupported()) D.documentElement.classList.add('gzStandalone');   // 11-14: 홈 화면 앱으로 연 아이폰 등 — 멈춤 창 「⛶ 전체화면」 줄([data-gz-fsrow])도 숨김
    btn = D.createElement('button');
    btn.id = 'gzFsBtn'; btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
    if (V.isStandalone() && !V.fsSupported()) btn.classList.add('hide');   // r8f: 홈 화면 앱으로 연 아이폰 등은 이미 꽉 찬 화면 → 숨김. 그 밖엔 늘 보임(지원 안 되면 누를 때 안내)
    const stop = (e) => { e.stopPropagation(); };
    ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach((t) => btn.addEventListener(t, stop));
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault();
      V.toggle('button');
    });
    D.body.appendChild(btn);
    paintBtn(); V.place();
    window.addEventListener('resize', () => { V.place(); setTimeout(V.place, 300); });
    setInterval(V.place, 400);   // HUD·안내 글자가 나타나고 사라질 때 따라감(겹치면 다른 자리로)
    // 11-14: 화면이 바뀌는 순간(타이틀 → 게임 등 class 바뀜)에도 바로 자리 다시 잡기 — 400ms 간격만으론 무거운 기기에서 멈춤 버튼 자리에 잠깐 겹쳐 있었음(B 폰)
    let mt = 0, ml = 0;   // 조용하다 바뀌면 30ms 뒤 바로, 계속 바뀌면 0.3초에 한 번까지만(V.hits 가 요소를 다 훑어 무거움)
    try { new MutationObserver((ms) => { if (mt || ms.every((m) => m.target === btn || m.target === help)) return; mt = setTimeout(() => { mt = 0; ml = performance.now(); V.place(); }, Math.max(30, 300 - (performance.now() - ml))); }).observe(D.body, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] }); } catch (e) { /* 무시 */ }
  };

  // ---------------- 확인용 표시 (?hud=1) ----------------
  V.hudOn = q.get('hud') === '1';
  V.initHud = function (get) {
    if (!V.hudOn) return;
    const el = D.createElement('div'); el.id = 'gzHud'; D.body.appendChild(el);
    const tick = () => {
      let s = '';
      try {
        const o = get();
        s = 'pr ' + (+o.pr).toFixed(2) + ' / dpr ' + V.dpr + '  fps ' + Math.round(o.fps) + '\n' +
          '그림 ' + o.w + '×' + o.h + '  화면 ' + innerWidth + '×' + innerHeight + '\n' +
          '화질 ' + (V.quality === 'high' ? '높게' : '자동') + (o.extra ? '  ' + o.extra : '') + '  전체 ' + (V.isFs() ? '켬' : '끔');
      } catch (e) { s = 'hud ' + e.message; }
      el.textContent = s;
    };
    tick(); setInterval(tick, 500);
  };
})();
