/* 꼬마 쎌 — 비서 캐릭터(쎌의 작은 동생, 복숭아빛 젤리 세포 + 머리 새싹) (2026-11-13)
   게임 코드(game.js·ui.js)는 건드리지 않고, 화면 요소가 보이고 숨는 순간(class 바뀜)만 지켜보다가 옆에 작게 나와 한마디.
   - 메뉴(타이틀·고르기·결과·쉬어 가기): 화면 높이 23% 이하로 크게, 계속 떠 있음
   - 달리는 화면: 15% 이하·왼쪽 위 구석(도움말 상자 옆), 2.6초 뒤 저절로 들어감
   - 그림을 못 읽으면 조용히 숨김. 매 프레임 하는 일 없음(게임 루프 영향 0) */
(function () {
  'use strict';
  const EK = window.EK; if (!EK || !document.getElementById('ui')) return;
  const $ = id => document.getElementById(id);
  const DIR = 'assets/img/assistant/kkoma/';
  const RATIO = { front: 0.997, basic: 0.734, smile: 0.844, wink: 0.781, think: 0.833, surprise: 0.745, bow: 0.982, cheer: 0.911, ok: 0.888 };
  const K = (window.KKOMA = { ok: true, mode: null, pose: null, text: '', shows: 0 });
  let broken = false, timer = 0;

  // ---------- 그림 미리 읽기 ----------
  Object.keys(RATIO).forEach(n => { const im = new Image(); im.onerror = () => { broken = true; hide(); }; im.src = DIR + n + '.webp'; });

  const box = document.createElement('div'); box.id = 'kk'; box.className = 'hide'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = '<img id="kkImg" alt="" draggable="false"><div id="kkSay"></div>';
  $('ui').appendChild(box);
  const img = $('kkImg'), say = $('kkSay');
  img.onerror = () => { broken = true; hide(); };

  function hide() { clearTimeout(timer); timer = 0; box.classList.add('hide'); K.mode = null; K.pose = null; K.text = ''; }

  const vis = id => { const e = $(id); return !!e && !e.classList.contains('hide'); };
  const scr = id => { const e = $(id); return !!e && e.classList.contains('show'); };
  const rect = el => el && el.getBoundingClientRect();
  const H = () => window.innerHeight, Wd = () => window.innerWidth;

  // 말풍선 꼬리 방향: l = 왼쪽에 캐릭터, r = 오른쪽에 캐릭터, b = 아래에 캐릭터
  function place(mode) {
    const vh = H(), vw = Wd(), menu = mode !== 'run';
    const h = Math.round(menu ? Math.min(vh * 0.23, 150) : Math.min(vh * 0.15, 72));
    const w = Math.round(h * (RATIO[K.pose] || 0.9));
    const fs = Math.round(Math.max(13, Math.min(menu ? 20 : 17, vh * (menu ? 0.042 : 0.036))));
    img.style.height = h + 'px'; say.style.fontSize = fs + 'px';
    say.style.maxWidth = Math.round(Math.min(vw * 0.36, fs * 11)) + 'px';
    let x = 12, y = vh - h - 12, side = 'l';
    if (mode === 'title') {
      const s = rect(document.querySelector('#scrTitle .slogan'));
      x = 16; y = vh - h - 10; if (s && s.bottom + 6 > y) y = Math.min(vh - h, s.bottom + 6);
    } else if (mode === 'select') { const r = placeSelect(vw, vh, h, fs); if (r) return; } else if (mode === 'result' || mode === 'rest') {
      const p = rect(document.querySelector((mode === 'result' ? '#scrResult' : '#scrRest') + ' .panel'));
      if (p && mode === 'rest' && p.left >= w + 14) { x = p.left - w - 10; y = p.bottom - h; side = 'b'; }
      else if (p) { x = Math.max(4, p.left - w * 0.3); y = Math.max(2, p.top - h * 0.6); }
    } else {   // 달리는 화면: 도움말 상자 아래 → 자리 없으면 오른쪽 → 없으면 게이지 아래 구석
      const g = rect($('hudL')), pad = vis('pad') && getComputedStyle($('pad')).display !== 'none' ? rect($('pad')) : null;
      const floor = pad && pad.height ? pad.top - 4 : vh - 8;
      x = 12; y = (g ? g.bottom : 90) + 12;
      if (vis('hint')) {
        const t = rect($('hint'));
        if (floor - t.bottom >= h + 6) { x = t.left + 2; y = t.bottom + 4; }
        else { x = t.right + 6; y = t.top + 2; }   // 작은 폰: 도움말 오른쪽 위(아래 ◀ 톡 글자와 안 겹치게)
      }
    }
    img.style.left = Math.round(x) + 'px'; img.style.top = Math.round(y) + 'px';
    // 말풍선: 글자를 넣은 뒤 크기를 잼(보일 때 한 번만)
    const bw = say.offsetWidth, bh = say.offsetHeight;
    let sx, sy;
    if (side === 'r') { sx = x - bw - 4; sy = y + h * 0.05; }
    else if (side === 'b') { sx = Math.max(4, x + w - bw); sy = y - bh - 10; }
    else { sx = x + w + 4; sy = y + Math.max(0, h * 0.18 - (mode === 'run' ? 0 : 4)); }
    if (mode === 'result' || (mode === 'rest' && side === 'l')) sy = Math.max(4, y + 2);
    sx = Math.max(4, Math.min(vw - bw - 6, sx)); sy = Math.max(4, Math.min(vh - bh - 4, sy));
    say.style.left = Math.round(sx) + 'px'; say.style.top = Math.round(sy) + 'px';
    say.className = 's-' + side;
  }

  // r8c: 고르기 화면 — 카드·✓·난이도·「출발!」을 덮지 않는 빈 곳을 찾아 앉음(검토 B r8b 반드시 1).
  //   ① 판 오른쪽 바깥 여백(탭·PC) → ② 판 아래 여백 → ③ 판 안 「장소 카드 줄」과 「출발 줄」 사이 틈(가로 폰·작은 폰). 말풍선도 같은 칸 안에.
  function setPos(x, y, sx, sy, side) {
    img.style.left = Math.round(x) + 'px'; img.style.top = Math.round(y) + 'px';
    say.style.left = Math.round(sx) + 'px'; say.style.top = Math.round(sy) + 'px'; say.className = 's-' + side;
  }
  function placeSelect(vw, vh, h0, fs0) {
    const P = rect(document.querySelector('#scrSelect .panel')), go = rect(document.querySelector('#scrSelect .big.go'));
    const cards = [...document.querySelectorAll('#scrSelect [data-stage]')].map(rect);
    if (!P || !go || !cards.length || !P.width) return false;
    const ratio = RATIO[K.pose] || 0.9, fit = (h, fs, mw) => { img.style.height = Math.round(h) + 'px'; say.style.fontSize = Math.round(fs) + 'px'; say.style.maxWidth = Math.round(mw) + 'px'; return [say.offsetWidth, say.offsetHeight]; };
    // ① 오른쪽 바깥: 판 오른쪽 끝 ~ 화면 끝
    const M = vw - P.right - 12;
    if (M >= Math.max(h0 * ratio, 140) + 4) {
      const h = Math.min(h0, (vh - P.top) * 0.5), w = h * ratio, [bw, bh] = fit(h, fs0, M - 6);
      const x = P.right + 6 + (M - w) / 2, y = Math.min(vh - h - 8, P.bottom - h);
      setPos(x, y, Math.max(P.right + 8, Math.min(vw - bw - 6, x + w - bw)), Math.max(4, y - bh - 10), 'b'); K.spot = 'right'; return true;
    }
    // ② 아래 여백
    const B = vh - P.bottom - 10;
    if (B >= 64) {
      const h = Math.min(h0, B), w = h * ratio, [bw, bh] = fit(h, fs0, Math.min(vw * 0.36, fs0 * 11));
      const x = go.right - w, y = P.bottom + 4 + (B - h) / 2;
      setPos(x, y, Math.max(4, x - bw - 6), y + (h - bh) / 2, 'r'); K.spot = 'below'; return true;
    }
    // ③ 카드 줄 아래 ~ 출발 위 틈(오른쪽 칸 안). 몸은 오른쪽 끝, 말풍선은 그 왼쪽
    const top = Math.max(...cards.map(c => c.bottom)) + 3, bot = go.top - 3, gap = bot - top;
    const h = Math.max(24, Math.min(h0, gap)), w = h * ratio;
    const fs = Math.max(11, Math.min(fs0, (gap - 8) / 1.7));
    const [bw, bh] = fit(h, fs, Math.max(60, go.width - w - 12));
    const x = go.right - w, y = top + Math.max(0, (gap - h) / 2);
    setPos(x, y, Math.max(go.left, x - bw - 8), top + Math.max(0, (gap - bh) / 2), 'r'); K.spot = 'gap'; return true;
  }

  function show(mode, pose, text, ms) {
    if (broken) return;
    clearTimeout(timer); timer = 0;
    const same = K.mode === mode && K.pose === pose && K.text === text && !box.classList.contains('hide');
    K.mode = mode; K.pose = pose; K.text = text;
    if (!same) {
      img.src = DIR + pose + '.webp'; say.textContent = text; say.classList.toggle('hide', !text);
      box.className = 'm-' + (mode === 'run' ? 'run' : 'menu'); void box.offsetWidth; box.classList.add('pop'); K.shows++;
    }
    place(mode);
    if (ms) timer = setTimeout(() => { if (K.mode === mode) hide(); }, ms);
  }

  // ---------- 달리는 화면 한마디 ----------
  const RUN_MS = 2600;
  function hintLine() {
    const t = ($('hintT') && $('hintT').textContent) || '', ic = $('hintPic') && $('hintPic').querySelector('svg') ? true : false;
    if (/^괜찮아요/.test(t)) return ['smile', '괜찮아! 다시 해 보자'];
    if (/지나가요/.test(t)) return ['surprise', '조심! 폴짝 뛰어!'];
    if (/점프/.test(t)) return ['wink', '폴짝! 같이 뛰자'];
    if (/숙이기|숙여/.test(t)) return ['basic', '쏙! 숙여 볼까?'];
    if (/왼쪽|오른쪽|좌우|옆/.test(t)) return ['smile', '옆으로 톡! 할 수 있어'];
    return [ic ? 'basic' : 'smile', '잘하고 있어!'];
  }
  const prev = {};
  function runEvent(id, on) {
    const was = prev[id]; prev[id] = on; if (!on || was) return;
    if (!vis('hud') || scr('scrPause')) return;
    if (id !== 'stop' && id !== 'loseMsg' && vis('stop')) return;   // r8b: 멈춰라 동안은 다른 말풍선 안 띄움
    if (id === 'loseMsg') show('run', 'bow', '괜찮아! 다시 해 보자', 3000);
    else if (id === 'stop') { show('run', 'surprise', '톡! 그대로 멈춰!', RUN_MS); if (EK.AU && EK.AU.voice) EK.AU.voice('kk_stop'); }   // r8c: 말풍선 = 꼬마 쎌 목소리   // r8b: 운동장 멈춰라(#stop)
    else if (id === 'gym') show('run', 'wink', '그림처럼 따라 해!', RUN_MS);
    else if (id === 'restMsg') show('run', 'smile', '천천히 숨 쉬어 봐', RUN_MS);
    else if (id === 'countIn') { if (!(K.mode === 'run' && !box.classList.contains('hide'))) show('run', 'front', '같이 달려 볼까?', RUN_MS); }
    else if (id === 'hint') { if (vis('stop') || vis('loseMsg')) return; const L = hintLine(); show('run', L[0], L[1], RUN_MS); }
  }

  // ---------- 화면 바뀜 ----------
  const RES = { 3: ['cheer', '우와, 최고야!'], 2: ['smile', '우와, 잘했어!'], 1: ['ok', '끝까지 왔어! 멋져!'], 0: ['bow', '괜찮아, 또 해 보자!'] };
  function screens() {
    if (scr('scrBoot') || scr('scrPause') || scr('scrStickers')) { hide(); return; }
    if (scr('scrRest')) { show('rest', 'bow', '물 마시고 와! 기다릴게', 0); return; }
    if (scr('scrResult')) { const n = document.querySelectorAll('#resStars i.on').length; const r = RES[n] || RES[1]; show('result', r[0], r[1], 0); return; }
    if (scr('scrTitle')) { show('title', 'front', '안녕! 나는 꼬마 쎌!\n같이 달려 볼까?', 0); return; }
    if (scr('scrSelect')) { show('select', 'think', '누구랑, 어디로 갈까?', 0); return; }
    if (K.mode && K.mode !== 'run') hide();
  }

  const RUN_IDS = ['hint', 'countIn', 'stop', 'gym', 'loseMsg', 'restMsg'];
  const SCR_IDS = ['scrBoot', 'scrTitle', 'scrSelect', 'scrPause', 'scrResult', 'scrStickers', 'scrRest', 'hud'];
  RUN_IDS.forEach(id => { prev[id] = vis(id); });
  const mo = new MutationObserver(recs => {
    let s = false;
    for (const r of recs) {
      const id = r.target.id;
      if (id === 'hintT') { if (vis('hint') && prev.hint) { prev.hint = false; runEvent('hint', true); } continue; }
      if (RUN_IDS.includes(id)) runEvent(id, vis(id));
      else s = true;
    }
    if (s) { if (!vis('hud') && K.mode === 'run') hide(); screens(); }
  });
  try {
    RUN_IDS.concat(SCR_IDS).forEach(id => { const e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['class'] }); });
    if ($('hintT')) mo.observe($('hintT'), { childList: true, characterData: true, subtree: true });
    mo.observe($('resStars'), { attributes: true, subtree: true, attributeFilter: ['class'] });
  } catch (e) { K.ok = false; }
  window.addEventListener('resize', () => { if (K.mode && !box.classList.contains('hide')) place(K.mode); });
  screens();
})();
