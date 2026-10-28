// GRUNT 모션 조종 (2026-10-28) — 카메라 손동작으로 대시보드 조작
//   ✊ 주먹 0.5초        → 본화면 (goHome / #home), 확대도 원래대로
//   ✋✋ 두 손바닥 벌리기 → 확대, 모으기 → 축소, 두 손 같이 움직이면 화면 이동
//   👌 엄지·검지 집기     → 커서 자리 클릭 (커서 = 엄지·검지 사이)
// 카메라 영상은 이 기기 브라우저 안에서만 처리한다(밖으로 보내지 않음).
// 발송·승인·삭제·결제 같은 버튼은 손동작으로 누르지 않는다 — 직접 눌러야 함.
// 붙이는 법: 페이지 끝에 <script src="motion.js"></script>. 확대 대상은 #c 캔버스(없으면 [data-motion-zoom]).
(() => {
  if (window.__motion) return;
  const VER = '0.10.14';
  const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
  const BLOCK = /(발송|보내|전송|승인|결제|입금|지급|삭제|취소|계약|서명|\bOK\b|send|approve|delete|pay)/i;
  const CTL = 'button,a,[role=button],summary,input,select,textarea,label';
  const M = 0.12;          // 카메라 가장자리 여백 — 손을 화면 끝까지 안 뻗어도 되게
  const FIST_MS = 450, HOME_GAP = 1500, CLICK_GAP = 700, PINCH_MS = 120, ZOOM_MAX = 4;

  const S = {
    on: false, rec: null, video: null, stream: null, lastT: -1, aspect: 4 / 3, synth: false,
    scale: 1, tx: 0, ty: 0, ox: 0, oy: 0, zoom: null, zoomLost: 0,
    cur: null, pinch: false, pinchAt: null, pinchSince: 0, clicked: false, lastClick: 0,
    fistSince: 0, lastHome: 0, msg: '',
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();
  const target = () => document.querySelector('#c') || document.querySelector('[data-motion-zoom]');

  // ---------- 화면 요소 ----------
  const css = `
#mo-ui{position:fixed;left:10px;bottom:10px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-start;gap:6px;font:12px ui-monospace,'Apple SD Gothic Neo',sans-serif}
#mo-ui video{width:128px;border-radius:8px;transform:scaleX(-1);border:1px solid #3a5a8a;display:none;background:#000}
#mo-ui button{border:1px solid #3a5a8a;background:#0a1426cc;color:#cfe3ff;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit}
#mo-ui button.on{border-color:#4fd18b;color:#c9ffe0;box-shadow:0 0 10px rgba(79,209,139,.45)}
#mo-st{color:#9fb4d0;background:#0a1426cc;border-radius:6px;padding:2px 6px;display:none}
#mo-cur{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border:2px solid #7cc4ff;border-radius:50%;pointer-events:none;z-index:2147483001;display:none;box-shadow:0 0 12px rgba(124,196,255,.7);transition:border-color .1s,transform .1s}
#mo-cur.pinch{border-color:#4fd18b;transform:scale(.7);background:rgba(79,209,139,.25)}
#mo-cur.block{border-color:#ff6b6b;background:rgba(255,107,107,.25)}
#mo-toast{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:2147483002;background:#0a1426ee;color:#e6f0ff;border:1px solid #3a5a8a;border-radius:10px;padding:8px 14px;font:14px 'Apple SD Gothic Neo',sans-serif;display:none;pointer-events:none;max-width:86vw;text-align:center}`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const ui = document.createElement('div'); ui.id = 'mo-ui';
  const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.autoplay = true; video.setAttribute('playsinline', '');
  const stEl = document.createElement('span'); stEl.id = 'mo-st';
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = '✋ 모션 켜기'; btn.dataset.motion = 'self';
  ui.append(video, stEl, btn); document.body.append(ui);
  const curEl = document.createElement('div'); curEl.id = 'mo-cur'; document.body.append(curEl);
  const toastEl = document.createElement('div'); toastEl.id = 'mo-toast'; document.body.append(toastEl);
  S.video = video;
  let toastT = 0;
  function toast(s, ms = 1600) { toastEl.textContent = s; toastEl.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { toastEl.style.display = 'none'; }, ms); }
  function status(s) { if (s !== S.msg) { S.msg = s; stEl.textContent = s; } }
  btn.onclick = () => (S.on ? stop() : start());

  // ---------- 확대 ----------
  function applyZoom() {
    const t = target(); if (!t) return;
    if (S.scale === 1 && !S.tx && !S.ty) { t.style.transform = ''; t.style.transformOrigin = ''; return; }
    const r = S.base || { left: 0, top: 0 };
    t.style.transformOrigin = `${S.ox - r.left}px ${S.oy - r.top}px`;
    t.style.transform = `translate(${S.tx}px,${S.ty}px) scale(${S.scale})`;
  }
  function resetZoom() { S.scale = 1; S.tx = 0; S.ty = 0; S.zoom = null; applyZoom(); }
  // 화면 좌표 → 확대 전 좌표 (캔버스는 clientX 로 점을 찾으므로 되돌려 줘야 맞는 점이 눌린다)
  function toLayout(x, y) { return { x: S.ox + (x - S.ox - S.tx) / S.scale, y: S.oy + (y - S.oy - S.ty) / S.scale }; }
  const zoomed = () => S.scale !== 1 || S.tx || S.ty;

  function fire(t, type, p, pt = 'mouse') {
    S.synth = true;
    try {
      const o = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, view: window };
      t.dispatchEvent(type.startsWith('pointer') && window.PointerEvent ? new PointerEvent(type, { ...o, pointerType: pt, isPrimary: true, pointerId: 1 }) : new MouseEvent(type, o));
    } finally { S.synth = false; }
  }
  // 확대 중 실제 마우스·손가락 클릭도 맞는 점으로 가게 좌표를 바꿔 다시 보낸다
  for (const type of ['click', 'pointermove', 'pointerdown', 'pointerup', 'mousemove', 'mousedown', 'mouseup']) {
    addEventListener(type, e => {
      if (S.synth || !e.isTrusted || !zoomed()) return;
      const t = target(); if (!t || e.target !== t) return;
      e.stopImmediatePropagation();
      fire(t, type, toLayout(e.clientX, e.clientY), e.pointerType || 'mouse');
    }, true);
  }

  // ---------- 동작 ----------
  function home() {
    S.lastHome = now(); resetZoom();
    if (typeof window.goHome === 'function') window.goHome();
    else { const h = document.querySelector('#home,[data-motion-home]'); if (h) h.click(); else scrollTo({ top: 0, behavior: 'smooth' }); }
    toast('✊ 본화면');
  }
  function blocked(el) {
    if (el.closest('[data-motion=block]')) return true;
    const c = el.closest(CTL); if (!c) return false;
    const txt = `${c.getAttribute('aria-label') || ''} ${c.title || ''} ${c.value || ''} ${c.textContent || ''}`.slice(0, 120);
    return BLOCK.test(txt);
  }
  function clickAt(x, y) {
    S.lastClick = now();
    const el = document.elementFromPoint(x, y);
    if (!el || el.closest('#mo-ui')) return;
    if (blocked(el)) { curEl.classList.add('block'); setTimeout(() => curEl.classList.remove('block'), 600); toast('🚫 이 버튼은 손동작으로 안 눌러요 — 직접 눌러 주세요', 2200); return; }
    const t = target();
    if (t && el === t) {   // 캔버스: 좌표로 점을 찾는다
      const p = zoomed() ? toLayout(x, y) : { x, y };
      fire(t, 'pointerdown', p); fire(t, 'pointerup', p); fire(t, 'click', p);
      return;
    }
    const c = el.closest(CTL) || el;
    if (c.matches('input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),textarea,select')) c.focus();
    else c.click();
  }

  // ---------- 손 해석 ----------
  const scr = p => ({ x: clamp(((1 - p.x) - M) / (1 - 2 * M), 0, 1) * innerWidth, y: clamp((p.y - M) / (1 - 2 * M), 0, 1) * innerHeight });
  const d = (a, b) => Math.hypot((a.x - b.x) * S.aspect, a.y - b.y);
  // hands: [{lm:[21개 {x,y}], g:'Closed_Fist'|'Open_Palm'|…, s:점수}]
  function handle(hands) {
    const t = now();
    if (!hands.length) { curEl.style.display = 'none'; S.cur = null; S.pinch = false; S.fistSince = 0; endZoom(t); status('손 없음'); return; }

    // 두 손바닥 → 확대·이동
    const palms = hands.filter(h => h.g === 'Open_Palm' && h.s > 0.5);
    if (hands.length >= 2 && palms.length >= 2) {
      curEl.style.display = 'none'; S.pinch = false; S.fistSince = 0; S.zoomLost = 0;
      const a = scr(palms[0].lm[9]), b = scr(palms[1].lm[9]);
      const dist = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (!S.zoom) {
        if (!zoomed()) { const tg = target(); S.base = tg ? tg.getBoundingClientRect() : { left: 0, top: 0 }; S.ox = mid.x; S.oy = mid.y; }
        S.zoom = { d0: Math.max(dist, 40), s0: S.scale, m0: mid, tx0: S.tx, ty0: S.ty };
      }
      const z = S.zoom, want = clamp(z.s0 * dist / z.d0, 1, ZOOM_MAX);
      S.scale += (want - S.scale) * 0.35;
      if (S.scale < 1.03) { S.scale = 1; S.tx = 0; S.ty = 0; }
      else {
        const lim = (S.scale - 1) * Math.max(innerWidth, innerHeight);
        S.tx = clamp(z.tx0 + (mid.x - z.m0.x), -lim, lim); S.ty = clamp(z.ty0 + (mid.y - z.m0.y), -lim, lim);
      }
      applyZoom(); status(`✋✋ 확대 ×${S.scale.toFixed(1)}`); return;
    }
    endZoom(t);

    const h = hands[0], lm = h.lm;
    // 주먹 → 본화면
    if (h.g === 'Closed_Fist' && h.s > 0.7) {
      curEl.style.display = 'none'; S.pinch = false;
      if (!S.fistSince) S.fistSince = t;
      if (t - S.fistSince > FIST_MS && t - S.lastHome > HOME_GAP) home();
      status('✊ 주먹'); return;
    }
    S.fistSince = 0;

    // 커서 = 엄지·검지 사이 (집어도 위치가 덜 흔들림)
    const p = scr({ x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 });
    S.cur = S.cur ? { x: S.cur.x + (p.x - S.cur.x) * 0.45, y: S.cur.y + (p.y - S.cur.y) * 0.45 } : p;
    const size = Math.max(d(lm[0], lm[9]), 1e-3);
    const pd = d(lm[4], lm[8]) / size, middleOut = d(lm[0], lm[12]) > 1.5 * size;
    if (!S.pinch && pd < 0.35 && middleOut) { S.pinch = true; S.pinchSince = t; S.pinchAt = { ...S.cur }; S.clicked = false; }
    else if (S.pinch && pd > 0.5) S.pinch = false;

    const show = S.pinch ? S.pinchAt : S.cur;
    curEl.style.display = 'block'; curEl.style.transform = ''; curEl.style.left = show.x + 'px'; curEl.style.top = show.y + 'px';
    curEl.classList.toggle('pinch', S.pinch);
    if (S.pinch && !S.clicked && t - S.pinchSince >= PINCH_MS && t - S.lastClick > CLICK_GAP) { S.clicked = true; clickAt(show.x, show.y); status('👌 클릭'); return; }
    if (!S.pinch) { const tg = target(); if (tg && document.elementFromPoint(show.x, show.y) === tg) fire(tg, 'pointermove', zoomed() ? toLayout(show.x, show.y) : show); }
    status(S.pinch ? '👌 집음' : '☝️ 커서');
  }
  function endZoom(t) { if (!S.zoom) return; if (!S.zoomLost) S.zoomLost = t; else if (t - S.zoomLost > 250) { S.zoom = null; S.zoomLost = 0; } }

  // ---------- 카메라 ----------
  async function start() {
    btn.disabled = true; toast('카메라 준비 중…', 4000);
    try {
      if (!S.rec) {
        const v = await import(`${CDN}/vision_bundle.mjs`);
        const fs = await v.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
        const mk = dlg => v.GestureRecognizer.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: dlg }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
        try { S.rec = await mk('GPU'); } catch (e) { S.rec = await mk('CPU'); }
      }
      S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      video.srcObject = S.stream; await video.play();
      S.aspect = (video.videoWidth / video.videoHeight) || 4 / 3;
      S.on = true; btn.textContent = '✋ 모션 끄기'; btn.classList.add('on'); video.style.display = 'block'; stEl.style.display = 'inline-block';
      toast('✋ 모션 켜짐 — ✊본화면 · ✋✋확대 · 👌클릭'); loop();
    } catch (e) {
      const why = e && e.name === 'NotAllowedError' ? '카메라 허용이 필요해요'
        : e && e.name === 'NotFoundError' ? '카메라가 없어요 (맥미니는 웹캠이나 아이폰 연속성 카메라 필요)'
        : (e && e.message) || String(e);
      toast('모션을 켤 수 없어요: ' + why, 4000); console.warn('[motion]', e); stop();
    } finally { btn.disabled = false; }
  }
  function stop() {
    S.on = false; if (S.stream) S.stream.getTracks().forEach(tr => tr.stop()); S.stream = null; video.srcObject = null;
    video.style.display = 'none'; stEl.style.display = 'none'; curEl.style.display = 'none';
    btn.textContent = '✋ 모션 켜기'; btn.classList.remove('on'); resetZoom();
  }
  function loop() {
    if (!S.on) return; requestAnimationFrame(loop);
    if (document.hidden || video.readyState < 2 || video.currentTime === S.lastT) return;
    S.lastT = video.currentTime;
    let r; try { r = S.rec.recognizeForVideo(video, now()); } catch (e) { return; }
    handle((r.landmarks || []).map((lm, i) => { const g = (r.gestures && r.gestures[i] && r.gestures[i][0]) || {}; return { lm, g: g.categoryName || 'None', s: g.score || 0 }; }));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.on) { curEl.style.display = 'none'; S.zoom = null; } });

  window.__motion = { start, stop, feed: handle, state: S, home, resetZoom };
})();
