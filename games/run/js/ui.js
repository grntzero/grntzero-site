// 화면(글자·버튼·그림 안내)과 조작 연결
(function () {
  const EK = window.EK, $ = EK.$, AU = EK.AU;
  const STICKERS = [
    ['⚡', '번개 배지', 1], ['🎧', '디제이 헤드폰', 3], ['⭐', '반짝 별', 5], ['🦈', '상어 친구', 8], ['🎵', '신나는 음표', 11], ['👟', '빨간 운동화', 14],
    ['🫧', '물방울', 17], ['🌈', '무지개 문', 20], ['🎁', '선물 상자', 24], ['🪩', '반짝 무대', 28], ['🏆', '에너지 컵', 32], ['💛', '세포 하트', 36],
  ];
  const PRAISE = { 0: ['여기까지 달린 것도 멋져요!', '한 번 더 하면 더 잘할 거예요!'], 1: ['끝까지 달렸어요! 멋져요!', '완주 성공! 대단해요!'], 2: ['에너지가 넘쳐요! 최고!', '구슬을 정말 많이 모았어요!'], 3: ['완벽해요! 에너지 대장!', '별 세 개! 정말 최고예요!'] };
  const sel = { char: 'raon', stage: EK.save.stage in EK.STAGES ? EK.save.stage : 'town', diff: EK.normDiff(EK.save.diff) };   // 보통 난이도: 옛 저장값(easy·hard)은 그대로, 처음이면 쉬움
  const cache = {};
  const set = (id, key, val, fn) => { const k = id + key; if (cache[k] === val) return; cache[k] = val; fn($(id)); };
  let popN = 0, fromResult = false, settingsMode = false;

  // ---------- 그림 (글을 못 읽어도 알 수 있게, 전부 코드로 그린 SVG) ----------
  const INK = '#2B1F57', YEL = '#FFD23A', SKY = '#6EC8FF';
  const svg = (vb, body) => '<svg viewBox="0 0 ' + vb + ' ' + vb + '" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  const HAND = svg(64, '<path d="M26 6c-3 0-5 2-5 5v22l-4-4c-2-2-5-2-7 0s-2 5 0 7l12 15c3 4 7 6 12 6h6c8 0 14-6 14-14V30c0-3-2-5-5-5s-4 1-4 3v-2c0-3-2-5-5-5s-4 1-4 3v-2c0-3-2-4-5-4-1 0-2 0-3 1V11c0-3-2-5-5-5z" fill="#fff" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"/>');
  const PALM = svg(64, '<g fill="#fff" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"><rect x="14" y="14" width="8.5" height="28" rx="4.2"/><rect x="23" y="7" width="8.5" height="32" rx="4.2"/><rect x="32" y="7" width="8.5" height="32" rx="4.2"/><rect x="41" y="13" width="8.5" height="28" rx="4.2"/><path d="M14 34h35.5v10c0 9-7 16-17.5 16S14 53 14 44z"/><path d="M15 46l-8-9c-2-3 1-7 4-5l5 4" /></g><circle cx="32" cy="46" r="5" fill="#FF8FB1"/>');
  const TRI = (up, c) => '<path d="' + (up ? 'M50 14 L88 80 H12 Z' : 'M50 86 L88 20 H12 Z') + '" fill="' + c + '" stroke="' + INK + '" stroke-width="9" stroke-linejoin="round"/>';
  const ARW = left => '<path d="' + (left ? 'M16 50 L78 14 V86 Z' : 'M84 50 L22 14 V86 Z') + '" fill="#fff" stroke="' + INK + '" stroke-width="9" stroke-linejoin="round"/>';
  // r7: 아래 ◀ ▶ 버튼과 같은 모양(흰 둥근 네모 + 보라 꺾쇠) — 체조 방향 그림·도움말에 같이 씀
  const BTN = left => '<rect x="5" y="9" width="90" height="82" rx="24" fill="#fff" stroke="' + INK + '" stroke-width="6"/><path d="' + (left ? 'M60 26 L36 50 L60 74' : 'M40 26 L64 50 L40 74') + '" fill="none" stroke="#6244BE" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>';
  // r7: ▲ 점프 버튼 모양(아래 버튼과 같음: 노란 둥근 네모 + 노란 세모 + 「점프」)
  const JBTN = '<rect x="5" y="5" width="90" height="90" rx="24" fill="#FFF0B4" stroke="' + INK + '" stroke-width="6"/><path d="M50 18 L76 60 H24 Z" fill="' + YEL + '" stroke="' + INK + '" stroke-width="6" stroke-linejoin="round"/><text x="50" y="84" text-anchor="middle" font-size="19" font-weight="900" fill="' + INK + '" font-family="sans-serif">점프</text>';
  // 체조 동작 그림: 팔을 올린·옆으로 기운·쪼그린 인형 + 작은 방향 표시(버튼 색과 같음)
  function fig(kind) {
    const tilt = kind === 'left' ? -24 : kind === 'right' ? 24 : 0, cr = kind === 'slide', hy = cr ? 46 : 28, by = cr ? 60 : 42, bh = cr ? 20 : 30;
    const limb = (x1, y1, x2, y2, c) => '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + INK + '" stroke-width="12" stroke-linecap="round"/><path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="' + c + '" stroke-width="6.5" stroke-linecap="round"/>';
    let arms, legs;
    if (kind === 'jump') arms = limb(39, by + 6, 24, by - 24, '#FFF0D8') + limb(61, by + 6, 76, by - 24, '#FFF0D8');
    else if (cr) arms = limb(39, by + 7, 22, by + 12, '#FFF0D8') + limb(61, by + 7, 78, by + 12, '#FFF0D8');
    else arms = limb(39, by + 7, 17, by - 6, '#FFF0D8') + limb(61, by + 7, 83, by - 6, '#FFF0D8');
    legs = cr ? limb(43, 80, 30, 90, '#232F55') + limb(57, 80, 70, 90, '#232F55') : kind === 'jump' ? limb(44, 72, 38, 86, '#232F55') + limb(56, 72, 62, 86, '#232F55') : limb(44, 72, 42, 91, '#232F55') + limb(56, 72, 58, 91, '#232F55');
    const body = '<g transform="rotate(' + tilt + ' 50 84)">' + legs + arms + '<rect x="35" y="' + by + '" width="30" height="' + bh + '" rx="10" fill="#E0322F" stroke="' + INK + '" stroke-width="4"/><circle cx="50" cy="' + hy + '" r="15" fill="#FFD9BF" stroke="' + INK + '" stroke-width="4"/><path d="M36 ' + (hy - 4) + ' a14 14 0 0 1 28 0 q-14 -8 -28 0z" fill="' + INK + '"/><circle cx="44.5" cy="' + (hy + 2) + '" r="2.2" fill="' + INK + '"/><circle cx="55.5" cy="' + (hy + 2) + '" r="2.2" fill="' + INK + '"/><path d="M45 ' + (hy + 8) + ' q5 4 10 0" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/></g>';
    return svg(100, body);
  }
  const BADGE = { jump: svg(100, TRI(true, YEL)), slide: svg(100, TRI(false, SKY)), left: svg(100, BTN(true)), right: svg(100, BTN(false)) };   // r7: 방향 그림 = 아래 버튼 모양
  const PICS = {
    orb: svg(100, '<circle cx="50" cy="50" r="34" fill="#FFCF3A" stroke="' + INK + '" stroke-width="8"/><circle cx="39" cy="38" r="9" fill="#fff"/>'),
    dodge: svg(100, '<path d="M8 50 L40 24 V76 Z" fill="#fff" stroke="' + INK + '" stroke-width="8" stroke-linejoin="round"/><path d="M92 50 L60 24 V76 Z" fill="#fff" stroke="' + INK + '" stroke-width="8" stroke-linejoin="round"/>'),
    gym: fig('jump'),
    flag: svg(100, '<path d="M24 12 V92" stroke="' + INK + '" stroke-width="9" stroke-linecap="round"/><path d="M28 16 H84 V56 H28 Z" fill="#fff" stroke="' + INK + '" stroke-width="7" stroke-linejoin="round"/><path d="M28 16h19v13H28zM66 16h18v13H66zM47 29h19v13H47zM28 42h19v14H28zM66 42h18v14H66z" fill="' + INK + '"/>'),
    tunnel: svg(100, '<path d="M10 88 V52 a40 40 0 0 1 80 0 V88 H68 V54 a18 18 0 0 0 -36 0 V88 Z" fill="#B9A4FF" stroke="' + INK + '" stroke-width="7" stroke-linejoin="round"/><circle cx="50" cy="26" r="6" fill="#FFF3B0" stroke="' + INK + '" stroke-width="4"/>'),
    hand: PALM,
    stop: svg(100, '<circle cx="50" cy="50" r="44" fill="#E8303A" stroke="' + INK + '" stroke-width="7"/><g transform="translate(20 18) scale(.95)"><g fill="#fff" stroke="' + INK + '" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"><rect x="14" y="14" width="8.5" height="28" rx="4.2"/><rect x="23" y="7" width="8.5" height="32" rx="4.2"/><rect x="32" y="7" width="8.5" height="32" rx="4.2"/><rect x="41" y="13" width="8.5" height="28" rx="4.2"/><path d="M14 34h35.5v10c0 9-7 16-17.5 16S14 53 14 44z"/></g></g>'),   // r8 운동장 카드: 빨간 동그라미 + 흰 손바닥
  };
  // 도움말 손가락 그림: lr 좌우로 밀기 / up 위로 밀기(또는 톡) / down 아래로 밀기 / r7 가로: tap 화면 왼쪽·오른쪽 반 톡 / jbtn ▲ 점프 버튼 톡
  const SCR = svg(100, '<rect x="4" y="16" width="92" height="68" rx="12" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="5"/><path d="M50 20 V80" stroke="#fff" stroke-width="4" stroke-dasharray="7 6"/><path d="M33 36 L19 50 L33 64" fill="none" stroke="#FFD873" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M67 36 L81 50 L67 64" fill="none" stroke="#FFD873" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>');
  const HINT = {
    tap: '<i class="hs">' + SCR + '</i><i class="hh mv-tap">' + HAND + '</i>',
    jbtn: '<i class="hb">' + svg(100, JBTN) + '</i><i class="hh mv-press">' + HAND + '</i>',
    lr: '<i class="ha l">' + svg(100, ARW(true)) + '</i><i class="hh mv-lr">' + HAND + '</i><i class="ha r">' + svg(100, ARW(false)) + '</i>',
    up: '<i class="ha t">' + svg(100, TRI(true, YEL)) + '</i><i class="hh mv-up">' + HAND + '</i>',
    down: '<i class="ha b">' + svg(100, TRI(false, SKY)) + '</i><i class="hh mv-down">' + HAND + '</i>',
  };

  // r6 가로형: 「시작하기」·「출발!」 같은 첫 터치 때 전체화면 + 가로 고정을 시도(안 되는 기기·iOS 는 조용히 넘어감). PC(마우스)는 안 함
  EK.landTry = { n: 0, err: 0 };
  EK.goLand = function () {
    try {
      const touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0; if (!touch) return;
      EK.landTry.n++;
      if (window.GZView) { GZView.request('start'); return; }   // 2026-11-13: 세 게임 공통 js/gzview.js (⛶ 버튼·풀린 뒤 다시 시도)
      const lock = () => { try { const o = screen.orientation; if (o && o.lock) { const q = o.lock('landscape'); if (q && q.catch) q.catch(() => { EK.landTry.err++; }); } } catch (e) { EK.landTry.err++; } };
      const d = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) return lock();
      if (d.requestFullscreen) { const q = d.requestFullscreen({ navigationUI: 'hide' }); if (q && q.then) q.then(lock, () => { EK.landTry.err++; lock(); }); else lock(); }
      else if (d.webkitRequestFullscreen) { d.webkitRequestFullscreen(); lock(); }
      else lock();
    } catch (e) { EK.landTry.err++; }
  };

  const UI = EK.UI = {
    thumbs: {}, ptrs: {}, sws: {}, TAP_MS: 400,   // 0.4초 안에 뗀 것만 톡(꾹은 무시)
    onHud(x, y) { for (const id of ['hudL', 'orbBox', 'prog']) { const r = $(id).getBoundingClientRect(); if (r.width && x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8) return true; } return false; },
    land() { return window.innerWidth > window.innerHeight; },
    init() {
      // 버튼
      document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act; AU.unlock(); AU.sfx('click'); if (/^(toSelect|play|again|restart|resume|toSelectFromResult)$/.test(a)) EK.goLand(); UI.act(a); });
      $('rotate').addEventListener('pointerdown', () => EK.goLand());   // 세로 안내를 톡 해도 가로 고정 시도
      document.addEventListener('pointerdown', e => {
        AU.unlock(); const G = EK.GM;
        UI.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };   // r8: 지금 닿아 있는 손가락 전부(멈춰 버튼이 뜰 때 이미 닿아 있던 손가락은 불인정)
        // r8 그대로 멈춰라(운동장): 빨간 손바닥 버튼을 톡(판정은 버튼보다 40px 넓게 — CSS ::before)
        if (e.target.closest('#stopBtn')) { e.preventDefault(); G.tapStop(true); return; }
        if (e.target.closest('#boostBtn')) { e.preventDefault(); G.tapBoost(); return; }   // 「부스트!」 버튼 톡
        const p = e.target.closest('[data-in]'); if (p) { e.preventDefault(); G.input(p.dataset.in); p.classList.add('on'); setTimeout(() => p.classList.remove('on'), 120); return; }
        const d = e.target.closest('[data-diff]'); if (d) { sel.diff = EK.normDiff(d.dataset.diff); AU.sfx('click'); UI.fillSelect(); return; }
        const sc = e.target.closest('[data-stage]'); if (sc) { sel.stage = sc.dataset.stage; AU.sfx('click'); UI.fillSelect(); return; }
        const cc = e.target.closest('[data-char]'); if (cc) { sel.char = cc.dataset.char; AU.sfx('click'); UI.fillSelect(); return; }
        const sb = e.target.closest('.soonBox'); if (sb) { AU.sfx('soft'); sb.animate([{ transform: 'rotate(-2deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(0)' }], { duration: 260 }); return; }
        // 밀기(스와이프) · 톡(= 점프)
        if (e.target.closest('button, input, .panel')) return;
        // r7: 손가락마다 따로 기억(두 엄지로 겹쳐 톡 해도 둘 다 먹음) · 위 하트·게이지·구슬 칸 위 톡은 무시
        UI.sws[e.pointerId] = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
      }, { passive: false });
      document.addEventListener('pointermove', e => {
        const q = UI.ptrs[e.pointerId]; if (q) { q.x = e.clientX; q.y = e.clientY; }
        const s = UI.sws[e.pointerId]; if (!s || s.fired) return; const dx = e.clientX - s.x, dy = e.clientY - s.y, ax = Math.abs(dx), ay = Math.abs(dy);
        if (Math.max(ax, ay) < 22) return;
        EK.GM.input(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'slide' : 'jump')); s.x = e.clientX; s.y = e.clientY; s.fired = true;
      });
      const end = e => {
        delete UI.ptrs[e.pointerId];
        const s = UI.sws[e.pointerId]; if (s) { delete UI.sws[e.pointerId];
          // 밀지 않고 짧게 톡: r6 가로 = 화면 왼쪽 반 톡 → 왼쪽 줄, 오른쪽 반 톡 → 오른쪽 줄 (두 손 엄지) / 세로(예비) = 점프
          if (e.type === 'pointerup' && !s.fired && performance.now() - s.at < UI.TAP_MS && EK.GM.phase === 'play' && !EK.GM.sub && !UI.onHud(s.x0, s.y0)) EK.GM.input(UI.land() ? (s.x0 < window.innerWidth / 2 ? 'left' : 'right') : 'jump'); }
      };
      document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
      document.addEventListener('touchend', () => AU.unlock(), { passive: true });
      document.addEventListener('keydown', e => {
        AU.unlock(); const k = e.key; const G = EK.GM;
        if (k === 'Escape' || k === 'p' || k === 'P') { if (G.phase === 'play') { if (settingsMode) return; EK.setPaused(!EK.paused); } return; }
        if (G.F && (k === ' ' || k === 'Enter')) { if (!e.repeat) G.tapStop(true); e.preventDefault(); return; }   // r8: 멈춰라 때 스페이스·엔터 = 버튼 톡(누르고 있던 키의 반복은 무시)
        if (G.phase === 'play' && (k === 'b' || k === 'B' || k === 'Enter' || k === 'Shift')) { if (!e.repeat) G.tapBoost(); return; }
        const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'slide', a: 'left', d: 'right', w: 'jump', s: 'slide', ' ': 'jump' }[k];
        if (m) { e.preventDefault(); if (!e.repeat) G.input(m); }
        else if (k === 'Enter') { if (G.phase === 'title') UI.act('toSelect'); else if (G.phase === 'select') UI.act('play'); else if (G.phase === 'result') UI.act('again'); }
      });
      const vm = $('volMusic'), vs = $('volSfx'); vm.value = EK.save.volMusic; vs.value = EK.save.volSfx;
      vm.addEventListener('input', () => { EK.save.volMusic = +vm.value; AU.applyVol(); EK.store(); });
      vs.addEventListener('input', () => { EK.save.volSfx = +vs.value; AU.applyVol(); EK.store(); });
      vs.addEventListener('change', () => { const c = AU.ctx; if (c && c.state !== 'running') c.resume().then(() => { AU.sfx('orb', 2); if (EK.paused) setTimeout(() => c.suspend(), 250); }); else AU.sfx('orb', 2); });
      UI.hapticBtn();
      GZView.onQuality(m => { const b = $('btnGq'); if (!b) return; b.setAttribute('aria-pressed', m === 'high' ? 'true' : 'false'); $('gqState').textContent = m === 'high' ? '높게' : '자동'; });
      GZView.initFs({ anchor: '#pauseBtn', appName: '붐붐 세포런', isPlay: () => EK.GM && EK.GM.phase === 'play' && !EK.paused,   // ⛶ 버튼(멈춤 버튼 아래)
        onHelp: () => { const G = EK.GM; if (G && (G.phase === 'play' || G.phase === 'finale') && !EK.paused) EK.setPaused(true); },   // r8f: 「홈 화면에 추가」 안내를 읽는 동안 판이 흐르지 않게
        onState: (on) => { const b = $('btnFs'); if (!b) return; b.setAttribute('aria-pressed', on ? 'true' : 'false'); $('fsState').textContent = on ? '끄기' : '전체화면'; } });   // r8f: 멈춤 창 「⛶ 전체화면」 단추
      GZView.initHud(() => ({ pr: __ek.state().pr, fps: EK.GM.fps, w: __ek.renderer.domElement.width, h: __ek.renderer.domElement.height, extra: 'AA ' + (__ek.renderer.getContext().getContextAttributes().antialias ? '켬' : '끔') }));
      $('stopPalm').innerHTML = PALM; $('bbHand').innerHTML = HAND;
    },
    hapticBtn() { const HP = window.GZHaptics, b = $('btnHaptic'); if (!b) return; const on = !HP || HP.on; b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); $('hapticState').textContent = on ? '켜짐' : '꺼짐'; },
    act(a) {
      const G = EK.GM;
      if (a === 'toSelect') { G.phase = 'select'; UI.fillSelect(); UI.show('select'); }
      else if (a === 'toTitle') { G.phase = 'title'; UI.show('title'); }
      else if (a === 'play') { G.charId = sel.char; G.startRun(sel.stage, sel.diff); }
      else if (a === 'pause') EK.setPaused(true);
      else if (a === 'resume') EK.setPaused(false);
      else if (a === 'restart') { EK.paused = false; AU.pause(false); G.startRun(G.stage.id, G.diff); }
      else if (a === 'quit') { EK.paused = false; AU.pause(false); G.toTitle(); }
      else if (a === 'again') G.startRun(G.stage.id, G.diff);
      else if (a === 'retry') G.retry();   // r8: 하트 0 카드 「다시 하기」(쉬움·보통 앞 구간 처음부터 · 도전 처음부터)
      else if (a === 'giveup') G.giveUp();
      else if (a === 'toSelectFromResult') { G.toTitle(); G.phase = 'select'; UI.fillSelect(); UI.show('select'); }
      else if (a === 'stickers') { fromResult = G.phase === 'result'; UI.fillStickers(); UI.show('stickers'); }
      else if (a === 'closeStickers') UI.show(fromResult ? 'result' : 'title');
      else if (a === 'settings') { settingsMode = true; $('pauseTitle').textContent = '소리 · 안내'; $('btnResume').classList.add('hide'); $('pauseRow').classList.add('hide'); $('btnCloseSet').classList.remove('hide'); UI.show('pause'); }
      else if (a === 'closeSettings') { UI.show('title'); }
      else if (a === 'gq') { GZView.toggleQuality(); }   // 화질 자동/높게 (기기에 저장 ek_quality)
      else if (a === 'fs') { GZView.toggle('menu'); }   // r8f: 멈춤 창에서 전체화면 켜기/끄기(안 되는 브라우저는 「홈 화면에 추가」 안내)
      else if (a === 'haptic') { const HP = window.GZHaptics; if (HP) { HP.toggle(); UI.hapticBtn(); if (HP.on) HP.play('toggle', 15, 5); } }   // 진동 켜기/끄기(소리와 따로, 기기에 저장)
      else if (a === 'restOk') { EK.save.sess = { sec: 0, at: Date.now() }; EK.store(); $('scrRest').classList.remove('show'); }
    },
    show(name, keep) {
      if (name === 'pause' && !settingsMode) { $('pauseTitle').textContent = '잠깐 쉬는 중'; $('btnResume').classList.remove('hide'); $('pauseRow').classList.remove('hide'); $('btnCloseSet').classList.add('hide'); }
      if (name !== 'pause') settingsMode = false;
      const map = { boot: 'scrBoot', title: 'scrTitle', select: 'scrSelect', pause: 'scrPause', result: 'scrResult', stickers: 'scrStickers', rest: 'scrRest', retry: 'scrRetry' };
      for (const k in map) { if (keep && k !== name) continue; $(map[k]).classList.toggle('show', k === name); }
      UI.cur = name;
    },
    hud(on) { $('hud').classList.toggle('hide', !on); if (!on) { UI.finale(false); UI.lose(false); } },
    resetHud() { for (const k in cache) delete cache[k]; UI.sws = {}; $('pop').innerHTML = ''; UI.card(null); UI.hint(null); UI.boost(false); UI.gym(null); UI.stop(null); UI.count(null); UI.padOn(true); UI.finale(false); UI.rest(false); UI.cue(null); UI.boostBtn(false); UI.boostEnding(false); UI.lose(false); UI.sticker(); },
    padOn(on, lrOnly) { $('pad').classList.toggle('hide', !on); $('pad').classList.toggle('lr', !!lrOnly); },   // r8: lrOnly = ◀▶만(멈춰라 구간엔 ▼▲ 숨김)
    setHearts(n) { set('hearts', 'n', n, el => { [...el.children].forEach((c, i) => c.classList.toggle('off', i >= n)); }); },
    setGauge(v, boost) { const w = Math.round(v * 100); set('gaugeFill', 'w', w, el => { el.style.width = w + '%'; }); set('gauge', 'f', boost || v >= 1, el => el.classList.toggle('full', boost || v >= 1)); },
    setOrbs(n) { set('orbN', 't', n, el => { el.textContent = n; }); },
    setProg(k) { const w = Math.round(k * 1000) / 10; set('progFill', 'w', w, el => { el.style.width = w + '%'; $('progDot').style.left = w + '%'; }); },
    // 미션 카드: 쎌 얼굴 + 짧은 글 + 그림
    card(a, b, pic) { const el = $('card'); if (!a) { el.classList.add('hide'); return; } $('cardT').textContent = a; $('cardS').textContent = b || ''; $('cardFace').src = UI.thumbs.ssel || ''; const p = $('cardPic'); p.innerHTML = PICS[pic] || ''; p.classList.toggle('hide', !PICS[pic]); el.classList.remove('hide'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; },
    // 도움말: 움직이는 손가락 그림 + 짧은 글. 해당 버튼도 같이 통통
    hint(t, icon) {
      const el = $('hint'); if (!t) { el.classList.add('hide'); UI.hintBtn(null); UI.halfTap(false); return; }
      $('hintT').textContent = t; const p = $('hintPic'); p.innerHTML = HINT[icon] || ''; p.classList.toggle('hide', !HINT[icon]); el.classList.remove('hide');
      UI.hintBtn(icon); UI.halfTap(icon === 'tap' && UI.land());
      if (window.innerHeight < 720 && !UI.land()) UI.card(null);   // 작은 세로 폰: 도움말이 카드 자리에 뜨므로 카드는 치움(r6 가로는 카드 = 위 가운데, 도움말 = 왼쪽이라 같이 떠도 됨)
    },
    hintBtn(icon) { document.querySelectorAll('.pbtn').forEach(b => { const k = b.dataset.in; b.classList.toggle('teach', !!icon && (icon === 'lr' || icon === 'tap' ? (k === 'left' || k === 'right') : icon === 'up' || icon === 'jbtn' ? k === 'jump' : k === 'slide')); }); },
    // r7 반쪽 톡 가르치기: 화면 왼쪽 반 「◀ 톡」·오른쪽 반 「톡 ▶」가 번갈아 깜빡(가로 연습 때)
    halfTap(on) { set('halfTap', 'on', !!on, e => e.classList.toggle('hide', !on)); },
    // 곧 닿을 장애물에 맞는 버튼(점프 ▲ / 숙이기 ▼)을 살짝 키워 알려 줌
    cue(kind) { set('pad', 'cue', kind || '', () => { document.querySelectorAll('.pbtn').forEach(b => b.classList.toggle('cue', !!kind && b.dataset.in === kind)); }); },
    // 부스트 준비: 게이지가 통통 + 큰 반짝 「부스트!」 버튼(손가락 그림이 톡톡)
    boostBtn(on) { set('gauge', 'chg', !!on, el => el.classList.toggle('charge', !!on)); set('boostBtn', 'on', !!on, el => el.classList.toggle('hide', !on)); },
    boostEnding(on) { set('gauge', 'end', !!on, el => el.classList.toggle('ending', !!on)); },
    lose(on) { $('loseMsg').classList.toggle('hide', !on); },
    // 모은 스티커 가운데 가장 새것을 달리는 화면에 배지로 보여 줌
    sticker() { const n = UI.unlockedCount(), el = $('stkBadge'); if (!n) { el.classList.add('hide'); return; } el.textContent = STICKERS[n - 1][0]; el.classList.remove('hide'); },
    rest(on) { set('restMsg', 'on', !!on, el => el.classList.toggle('hide', !on)); if (on) { UI.card(null); UI.hint(null); } },
    // r5: 큰 글자는 한 번에 하나만(줄 세우기). 앞 글자가 0.5초는 보이고 나서 다음 글자로 바뀜 → 「에너지 부스트!」와 「괜찮아요!」가 겹치지 않음
    pop(text, cls) {
      const now = performance.now(), cur = UI._pc;
      if (cur && cur.parentNode && now - cur._at < 500) {
        UI._pq = (UI._pq || []).filter(q => q.text !== text); UI._pq.push({ text, cls }); if (UI._pq.length > 2) UI._pq.shift();
        clearTimeout(UI._pt); UI._pt = setTimeout(() => { const q = UI._pq.shift(); if (q) UI.pop(q.text, q.cls); if (UI._pq.length) UI._pt = setTimeout(() => { const r = UI._pq.shift(); if (r) UI.pop(r.text, r.cls); }, 520); }, 500 - (now - cur._at) + 10);
        return;
      }
      const p = $('pop'); p.innerHTML = '';
      const b = document.createElement('b'); b.textContent = text; b.className = cls || ''; if (!UI.land()) b.style.top = /bst/.test(cls || '') ? '264px' : '34%'; /* r6 가로는 CSS(위 가운데 33%) */ b._at = now; p.appendChild(b); UI._pc = b;
      setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, /bst/.test(cls || '') ? 1350 : 950);
    },   // r3: 글자는 캐릭터 위쪽 빈 자리에(캐릭터를 가리지 않게)
    clearPop() { $('pop').innerHTML = ''; UI._pq = []; clearTimeout(UI._pt); UI._pc = null; },
    // 「에너지 부스트!」 꼬리표: 게이지 아래에 1.6초만(게이지 자체가 무지개로 바뀜)
    boost(on) { set('boostTag', 'on', !!on, el => { $('boostFx').classList.toggle('hide', !on); el.classList.toggle('hide', !on); clearTimeout(UI._bt); if (on) UI._bt = setTimeout(() => { el.classList.add('hide'); }, 1600); }); },
    count(t) { set('countIn', 't', t || '', el => { el.textContent = t || ''; el.classList.toggle('hide', !t); }); },
    gym(s) {
      if (!s) { set('gym', 'on', false, e => e.classList.add('hide')); return; }
      set('gym', 'on', true, e => e.classList.remove('hide'));
      set('gymTitle', 't', s.title, e => { e.textContent = s.title; });
      const dots = s.dots.join(','), ci = s.curI == null ? -1 : s.curI;
      set('gymDots', 'd', dots + '|' + ci, e => { if (e.children.length !== s.dots.length) e.innerHTML = s.dots.map(() => '<i></i>').join(''); [...e.children].forEach((c, i) => { c.className = s.dots[i] === 1 ? 'ok' : s.dots[i] === -1 ? 'no' : i === ci ? 'now' : ''; }); });
      set('gym', 'dn', !!s.done, e => e.classList.toggle('done', !!s.done));
      if (s.done) { set('gymIcon', 'v', 'rest', e => { e.className = 'rest'; }); return; }
      const word = s.good ? (s.praise || '좋아요!') : { jump: '점프!', right: '오른쪽!', slide: '숙여요!', left: '왼쪽!' }[s.kind];   // 맞추면 그 자리에서 칭찬(글자가 겹치지 않게 따로 띄우지 않음)
      set('gymIcon', 'v', s.kind + (s.good ? 'g' : ''), e => { e.className = (s.good ? 'good ' : '') + 'k-' + s.kind; });
      set('gymPic', 'k', s.kind, e => { e.innerHTML = fig(s.kind); $('gymBadge').innerHTML = BADGE[s.kind]; });
      set('gymWord', 't', word, e => { e.textContent = word; });
      const r = $('gymRing'); r.style.transform = 'scale(' + s.ring.toFixed(3) + ')'; r.style.opacity = s.good ? 0 : Math.min(1, 0.3 + (1.5 - s.ring) * 1.6);
    },
    // r8 그대로 멈춰라(운동장): 신호등 점 3개(초·노·빨) + 빨간 손바닥 버튼 「멈춰!」(판정 창 직전에 「통」 나타남) + 작은 글자. 성공하면 초록 「얼음!」
    stop(s) {
      if (!s) { set('stop', 'on', false, e => e.classList.add('hide')); set('stopBtn', 'b', false, e => { e.classList.add('off'); }); return; }
      set('stop', 'on', true, e => e.classList.remove('hide'));
      set('stopLight', 'l', s.light + (s.hold ? 'h' : ''), e => { [...e.children].forEach((c, i) => c.classList.toggle('on', s.hold || i <= s.light)); });
      set('stopMsg', 't', s.msg || '', e => { e.textContent = s.msg || ''; e.classList.toggle('hide', !s.msg); });
      set('stopBtn', 'b', !!s.btn, e => { e.classList.toggle('off', !s.btn); if (s.btn) { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; } });
      set('stopBtn', 'st', s.st, e => { e.classList.remove('st-wait', 'st-ok', 'st-no'); e.classList.add('st-' + s.st); $('stopLab').textContent = s.st === 'ok' ? '얼음!' : s.st === 'no' ? '앗!' : '멈춰!'; });   // r8c: 놓친 뒤 회색 「멈춰!」가 남지 않게(검토 B 4)
    },
    // 버튼이 뜨는 순간 그 자리(판정 넓이 포함)에 이미 닿아 있는 손가락이 있나
    stopPressedNow() { const r = $('stopBtn').getBoundingClientRect(); for (const k in UI.ptrs) { const q = UI.ptrs[k]; if (q.x >= r.left - 20 && q.x <= r.right + 20 && q.y >= r.top - 20 && q.y <= r.bottom + 20) return true; } return false; },
    finale(on) { $('finaleMsg').classList.toggle('hide', !on); $('hud').classList.toggle('fin', !!on); },   // r7: 결승 때 하트·게이지·구슬 칸은 치움(띠 글자가 안 가려지게)
    unlockedCount() { return STICKERS.filter(s => EK.save.stars >= s[2]).length; },
    result(r) {
      $('resHead').innerHTML = (r.win ? '참 잘했어요!' : '다시 힘내 보자!') + '<small class="dTag d-' + EK.normDiff(r.diff) + '">' + EK.DIFF[EK.normDiff(r.diff)].name + '</small>';   // 보통 난이도: 결과에 난이도 표시
      [...$('resStars').children].forEach((c, i) => c.classList.toggle('on', i < r.stars));
      const pr = PRAISE[r.stars]; $('resPraise').textContent = r.why === 'nostop' ? '멈춰라! 할 때 빨간 손바닥을 톡 해 봐요' : r.why === 'freeze' ? '다음엔 「멈춰라!」 때 톡 해 봐요!' : pr[(Math.random() * pr.length) | 0];
      $('resOrbs').textContent = r.orbs + ' / ' + r.total; $('resScore').textContent = r.score.toLocaleString('ko-KR'); $('resMission').textContent = r.missions + ' / ' + (r.missionN || 3); $('resDist').textContent = r.dist + ' m';
      const nx = STICKERS[UI.unlockedCount()], pv = UI.unlockedCount() ? STICKERS[UI.unlockedCount() - 1][2] : 0, ne = $('resNext');
      if (nx) { $('resNextT').textContent = nx[0] + ' 다음 스티커까지 별 ' + (nx[2] - EK.save.stars) + '개'; $('resNextFill').style.width = Math.round(100 * (EK.save.stars - pv) / (nx[2] - pv)) + '%'; ne.classList.remove('hide'); } else ne.classList.add('hide');
      const st = $('resSticker'); if (r.newSticker >= 0) { const s = STICKERS[r.newSticker]; st.innerHTML = '<em>' + s[0] + '</em>새 스티커 「' + s[1] + '」'; st.classList.remove('hide'); } else st.classList.add('hide');
      UI.show('result');
    },
    fillStickers() {
      const S = EK.save, n = UI.unlockedCount(), next = STICKERS[n];
      $('stSub').textContent = '모은 별 ' + S.stars + '개' + (next ? ' · 별 ' + (next[2] - S.stars) + '개 더 모으면 「' + next[1] + '」' : ' · 스티커를 다 모았어요!');
      $('stGrid').innerHTML = STICKERS.map((s, i) => '<div class="stk' + (i < n ? '' : ' lock') + '"><em>' + s[0] + '</em><span>' + (i < n ? s[1] : '별 ' + s[2] + '개') + '</span></div>').join('');
      $('famBox').innerHTML = '<b>우리 가족 기록</b><span>함께 달린 횟수 ' + S.plays + '번 · 완주 ' + S.clears + '번</span><span>성공한 미션 ' + S.missions + '개</span><span>모은 에너지 구슬 ' + S.orbs.toLocaleString('ko-KR') + '개</span><span>달린 거리 ' + S.dist.toLocaleString('ko-KR') + ' m</span>';   // r7: 가로에선 두 칸(작은 폰에서도 잘리지 않게)
    },
    // 고르기: 지금 달릴 수 있는 캐릭터(라온)는 큰 카드, 아직 못 고르는 친구들은 「친구들이 곧 와요」 한 칸으로 접음
    fillSelect() {
      const play = EK.CHARS.filter(c => c.play), soon = EK.CHARS.filter(c => !c.play);
      $('charRow').innerHTML = play.map(c => '<div class="cc' + (c.id === sel.char ? ' sel' : '') + '" data-char="' + c.id + '"><img alt="" src="' + (UI.thumbs[c.id] || '') + '"><b>' + c.name + '</b><span>' + c.sub + '</span></div>').join('')
        + '<div class="soonBox"><div class="soonFaces">' + soon.map(c => '<img alt="' + c.name + '" src="' + (UI.thumbs[c.id] || '') + '">').join('') + '</div><b>친구들이 곧 와요</b></div>';
      $('stageRow').innerHTML = Object.values(EK.STAGES).map(s => { const bs = EK.save.bestStars[s.id + '_' + sel.diff] || 0; return '<button class="sc ' + s.theme + (s.id === sel.stage ? ' sel' : '') + '" data-stage="' + s.id + '"><b>' + s.name + '</b><span>♪ ' + s.sub + '</span><em>' + '★'.repeat(bs) + '<i style="opacity:.35;font-style:normal">' + '★'.repeat(3 - bs) + '</i></em></button>'; }).join('');
      document.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('sel', b.dataset.diff === sel.diff));
    },
    // 캐릭터 얼굴 그림(고르기 화면·안내 카드용)을 인형으로 직접 찍어 둠
    makeThumbs() {
      try {
        const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(Math.min(3, Math.max(2, (window.devicePixelRatio || 1) * 1.25))); r.setSize(176, 208);   // 화질(갤럭시탭): 얼굴 그림을 2~3배 화소로 (태블릿에서 120px 로 커져 흐렸음)
        const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 176 / 208, 0.1, 50); cam.position.set(0, 0.95, 4.5); cam.lookAt(0, 0.86, 0);
        sc.add(new THREE.HemisphereLight(0xffffff, 0xffe2b0, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2.0); d.position.set(2, 5, 6); sc.add(d);
        const keep = EK.bendU.value.clone(); EK.bendU.value.set(0, 0);
        for (const c of EK.CHARS) { const doll = c.id === 'raon' ? EK.makeChar('raon') : new EK.Doll(c.id); doll.group.scale.setScalar(1); doll.group.rotation.y = -0.25; doll.shadow.visible = false; sc.add(doll.group); doll.update(0.5, { action: 'wave' }); doll.update(0.5, { action: 'wave' }); r.render(sc, cam); UI.thumbs[c.id] = r.domElement.toDataURL('image/png'); sc.remove(doll.group); EK.disposeChar(doll); }
        EK.bendU.value.copy(keep); r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
      } catch (e) { console.warn('thumb', e); }
    },
  };
  EK.start();
})();
