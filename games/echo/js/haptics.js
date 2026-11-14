// haptics.js — 그런트제로 게임 공용 진동(햅틱) 모듈 (2026-11-13, 세 게임 같은 모양)
// 쓰는 법: GZHaptics.init({ key:'저장이름', maxSeg:ms, maxTotal:ms, minGap:ms });  GZHaptics.play('사건이름', [패턴], 우선순위)
//  · 안드로이드 크롬 등: navigator.vibrate(패턴)  — 부를 때마다 navigator.vibrate 를 새로 찾음(시험에서 가짜로 바꿀 수 있게)
//  · 아이폰 사파리 17.4+/18: vibrate 가 없음 → 숨긴 <input type="checkbox" switch> 의 label 을 click() 하면 시스템 「톡」 햅틱.
//    사용자 터치 직후(활성화 중)에만 울리는 것으로 알려져 있어, 그때만 시도. 세기·길이 조절은 안 됨(톡 1~3번). 실패해도 조용히 넘어감
//  · 둘 다 없으면 아무 일 없음. 모든 호출은 try/catch — 오류 0
//  · 너무 자주 울리지 않게 최소 간격(minGap), 한 조각 최대 길이(maxSeg)·한 패턴 전체 최대 길이(maxTotal)
//  · 켜기/끄기는 localStorage(try/catch)에 저장 — 소리 끄기와 별개. 기본 켬
(function () {
  'use strict';
  const H = {
    on: true, key: 'gz_haptics', maxSeg: 120, maxTotal: 400, minGap: 50,
    last: -1e9, lastPrio: 0,
    stats: { calls: 0, played: 0, gap: 0, off: 0, none: 0, ios: 0, err: 0 },
    log: [],            // 최근 30개 { name, pattern, t } — 시험·디버그용
    forceIOS: false,    // 시험용: 아이폰 길 강제
  };
  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  function load() {
    try { const v = localStorage.getItem(H.key); if (v === '0') H.on = false; else if (v === '1') H.on = true; } catch (e) {}
  }
  H.init = function (o) {
    o = o || {};
    if (o.key) H.key = o.key;
    if (o.maxSeg) H.maxSeg = o.maxSeg;
    if (o.maxTotal) H.maxTotal = o.maxTotal;
    if (o.minGap) H.minGap = o.minGap;
    load();
    return H;
  };
  H.set = function (on) {
    H.on = !!on;
    try { localStorage.setItem(H.key, H.on ? '1' : '0'); } catch (e) {}
    if (!H.on) H.stop();
    return H.on;
  };
  H.toggle = function () { return H.set(!H.on); };

  // 패턴 다듬기: 숫자 또는 [울림, 쉼, 울림 …]. 조각마다 maxSeg, 합계 maxTotal 안으로 자름
  H.clamp = function (p) {
    let a = Array.isArray(p) ? p.slice() : [p];
    a = a.map(v => Math.max(0, Math.round(+v || 0)));
    const out = []; let tot = 0;
    for (let i = 0; i < a.length && i < 9; i++) {
      let v = a[i];
      if (i % 2 === 0) v = Math.min(v, H.maxSeg); else v = Math.min(v, 200);
      if (tot + v > H.maxTotal) { v = H.maxTotal - tot; if (v <= 0) break; }
      out.push(v); tot += v;
    }
    while (out.length && out.length % 2 === 0) out.pop(); // 쉼으로 끝나지 않게
    return out;
  };
  H.total = p => (Array.isArray(p) ? p : [p]).reduce((s, v) => s + (+v || 0), 0);

  function isIOS() {
    if (H.forceIOS) return true;
    try {
      const ua = navigator.userAgent || '';
      return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    } catch (e) { return false; }
  }
  let lab = null;
  function iosLabel() {
    if (lab && lab.isConnected) return lab;
    try {
      if (!document.body) return null;
      lab = document.createElement('label');
      lab.setAttribute('aria-hidden', 'true');
      lab.id = 'gzHapticSw';
      lab.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      const inp = document.createElement('input');
      inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
      lab.appendChild(inp);
      // 게임의 click/pointer 처리에 닿지 않게 여기서 멈춤
      const stopEv = e => { e.stopPropagation(); };
      lab.addEventListener('click', stopEv); inp.addEventListener('click', stopEv);
      document.body.appendChild(lab);
      return lab;
    } catch (e) { return null; }
  }
  function iosTick(n) {
    try {
      const ua = navigator.userActivation;
      if (!H.forceIOS && ua && ua.isActive === false) return false; // 터치 직후가 아니면 시도 안 함
      const l = iosLabel(); if (!l) return false;
      l.click(); H.stats.ios++;
      for (let i = 1; i < n; i++) setTimeout(() => { try { l.click(); H.stats.ios++; } catch (e) {} }, i * 70);
      return true;
    } catch (e) { H.stats.err++; return false; }
  }

  // name: 사건 이름(로그용), pattern: ms 또는 배열, prio: 클수록 중요(앞 진동이 덜 중요하면 간격 안이어도 덮어씀)
  H.play = function (name, pattern, prio) {
    H.stats.calls++;
    prio = prio || 1;
    if (!H.on) { H.stats.off++; return false; }
    const t = now();
    if (t - H.last < H.minGap && !(prio > H.lastPrio && t - H.last >= 20)) { H.stats.gap++; return false; }
    const p = H.clamp(pattern);
    if (!p.length || !p[0]) return false;
    let ok = false;
    try {
      const v = navigator.vibrate;
      if (typeof v === 'function') {
        ok = v.call(navigator, p.length === 1 ? p[0] : p) !== false;
      } else if (isIOS()) {
        let n = 0; for (let i = 0; i < p.length; i += 2) n++;
        ok = iosTick(Math.min(3, n));
      } else { H.stats.none++; }
    } catch (e) { H.stats.err++; ok = false; }
    H.last = t; H.lastPrio = prio;
    if (ok) H.stats.played++;
    H.log.push({ name: name, pattern: p, t: Math.round(t) }); if (H.log.length > 30) H.log.shift();
    return ok;
  };
  H.stop = function () { try { if (typeof navigator.vibrate === 'function') navigator.vibrate(0); } catch (e) {} };
  H.supported = function () { try { return typeof navigator.vibrate === 'function' || isIOS(); } catch (e) { return false; } };
  try { document.addEventListener('visibilitychange', () => { if (document.hidden) H.stop(); }); } catch (e) {}
  load();
  window.GZHaptics = H;
})();
