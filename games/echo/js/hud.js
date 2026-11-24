/* 톱니골 던전 — HUD (가로): 얼굴·「소리 크기」 말풍선 칸·소리 게이지(레벨), 층 안개 게이지, 미니맵, 큰 소리 버튼, 리믹스 카드, 쉼터, 비서 쎌 말풍선(진행자), 한 줄 안내, 결과 */
(function () {
  'use strict';
  const TG = window.TG, T = THREE;
  const H = (TG.H = {});
  const $ = (id) => document.getElementById(id);

  H.init = function () {
    ['hud', 'lives', 'lvTag', 'xpFill', 'noteN', 'progGear', 'map', 'bossBar', 'bossFill', 'bossGhost', 'combo', 'comboN', 'overPips',
      'speech', 'zoneVig', 'stick', 'stickKnob', 'stickBase', 'keyHint', 'btnBig', 'btnSnd', 'bigArc', 'banner', 'count', 'title', 'pause', 'result', 'rotate', 'loading', 'lfill',
      'resTitle', 'stars', 'rTime', 'rFog', 'rCombo', 'rNote', 'hint', 'grunt', 'gruntTxt', 'shelter', 'cards', 'cardRow', 'rerollBtn', 'skills', 'skHero', 'skList', 'skClose', 'face',
      'dunRow', 'dunBtn', 'dunPick', 'dunList', 'lvRow', 'lvInfo', 'dunGo', 'cuSkipBtn', 'rStamp'].forEach((k) => (H[k] = $(k))); // 11-24 던전 고르기·확대 건너뛰기·단계 도장
    H.dunBtn.addEventListener('click', (e) => { e.stopPropagation(); TG.A.unlock(); TG.A.ui(1.1); H.dunOpen(); });
    H.dunGo.addEventListener('click', (e) => { e.stopPropagation(); TG.A.ui(1.1); H.dunClose(); });
    H.dunPick.addEventListener('click', (e) => { if (e.target === H.dunPick) H.dunClose(); });
    H.cuSkipBtn.addEventListener('click', (e) => { e.stopPropagation(); TG.A.ui(0.8); if (TG.G && TG.G.skipCloseup) TG.G.skipCloseup(); });
    H.rerollBtn.addEventListener('click', (e) => { e.stopPropagation(); if (H.onReroll) H.onReroll(); }); // 11-18 다시 뽑기
    H.skClose.addEventListener('click', (e) => { e.stopPropagation(); if (H.onSkillsClose) H.onSkillsClose(); });
    H.skills.addEventListener('click', (e) => { if (e.target === H.skills && H.onSkillsClose) H.onSkillsClose(); }); // 바깥 누르면 닫힘
    H.face.addEventListener('click', (e) => { e.stopPropagation(); if (H.onFace) H.onFace(); }); // 11-18 얼굴 칸 → 내 리믹스 카드
    H.reviveCnt = document.createElement('div'); H.reviveCnt.id = 'reviveCnt'; H.reviveCnt.className = 'ol hide'; document.getElementById('ui').appendChild(H.reviveCnt); // 11-18 다시 일어나기 카운트
    H.mapCtx = H.map.getContext('2d');
    H.segs = Array.from(document.querySelectorAll('#progBar .seg'));
    H.fogs = H.segs.map((e) => e.querySelector('.fog'));
    if (TG.isTouch) document.body.classList.add('touch');
    H.comboShown = 0; H.mapTick = 0; H.lifeN = -1; H.lifeHp = -1; H.lifeSh = -1;
    H.mini = [];
    for (let i = 0; i < 18; i++) { const d = document.createElement('div'); d.className = 'mhp'; d.appendChild(document.createElement('i')); H.hud.insertBefore(d, H.hud.firstChild); H.mini.push(d); }
    H.sselInit();
    H.resize();
  };

  // ── 비서 쎌 (진행자) — 그림만 바꿔 끼움. 규칙 계산과 무관. 그림을 못 불러오면 조용히 숨김(말풍선 글은 그대로) ──
  const SSEL_DIR = 'assets/img/assistant/ssel/';
  const SSEL_FACES = ['front', 'basic', 'smile', 'wink', 'think', 'surprise', 'bow', 'cheer', 'ok'];
  const sselBad = {};
  H.sselInit = function () {
    H.sselPre = SSEL_FACES.map((f) => { const im = new Image(); im.onerror = () => { sselBad[f] = true; }; im.src = SSEL_DIR + f + '.webp'; return im; }); // 미리 불러 둠(표정 바꿀 때 깜빡임 없게)
    document.querySelectorAll('.ssel .sselImg').forEach((im) => {
      im.addEventListener('error', () => { im.classList.add('noimg'); });
      im.addEventListener('load', () => { im.classList.remove('noimg'); });
    });
    H.sselTitleStart();
    // 11-14 비서 쎌 목소리: 대사 묶음 → 목소리 엔진 차례로 (index.html 은 그대로). 못 불러오면 말풍선만
    ['js/pack_assist_voice.js', 'js/assist_voice.js'].forEach((u) => { const sc = document.createElement('script'); sc.src = u; sc.async = false; document.head.appendChild(sc); });
  };
  H.sselVoice = function (text) { try { return !!(TG.SV && TG.SV.say(text)); } catch (e) { return false; } };
  // el 안 쎌 그림을 face 표정으로. pop=true 면 통통 튀며 다시 등장
  H.sselFace = function (el, face, pop) {
    if (!el) return;
    const im = el.querySelector('.sselImg'); if (!im) return;
    if (!SSEL_FACES.includes(face)) face = 'basic';
    if (sselBad[face]) { im.classList.add('noimg'); return; }
    const src = SSEL_DIR + face + '.webp';
    if (im.getAttribute('src') !== src) im.setAttribute('src', src);
    im.dataset.face = face;
    if (pop) { im.classList.remove('pop'); void im.offsetWidth; im.classList.add('pop'); }
  };
  // 11-19 타이틀 = 톱니골 광장(모두의 출발지). tut = 튜토리얼(방송 파이프 굴) 끝냈나, back = 던전에서 막 돌아옴
  let hubTut = false, hubBack = false, hubNext = '';
  // 11-24 광장: 연습이 끝나면 「던전」 줄(지금 고른 던전·단계)과 던전 고르기 창. 연습 전엔 첫 던전 고정(줄 숨김)
  H.hubRefresh = function (tut, back) {
    hubTut = !!tut; hubBack = !!back;
    const DN = TG.DN, d = DN.get(DN.sel.dun), L = TG.LEVELS[DN.sel.lv];
    hubNext = DN.hasLevels(d.id) ? d.name + ' · ' + DN.levelName(DN.sel.lv, d.id) : d.name;
    const t = $('hubTag'); if (t) t.textContent = tut ? '톱니골 광장 · 다음 던전: ' + hubNext : '톱니골 광장 · 첫 던전 「방송 파이프 굴」에서 연습해요!';
    if (H.dunRow) { H.show(H.dunRow, tut); H.dunBtn.querySelector('span').textContent = hubNext; H.dunBtn.style.setProperty('--dc', d.color || '#e5352b'); }
    void L;
  };
  H.dunOpen = function () {
    if (!H.title || H.title.classList.contains('hide')) return false;
    H.dunRender(); H.show(H.dunPick, true); return true;
  };
  H.dunClose = function () { H.show(H.dunPick, false); H.hubRefresh(hubTut, hubBack); if (H.onDunPick) H.onDunPick(); };
  H.dunRender = function () {
    const DN = TG.DN, cur = DN.sel.dun;
    H.dunList.innerHTML = '';
    TG.DUNGEON_ORDER.forEach((id) => {
      const d = TG.DUNGEONS[id], b = document.createElement('button'); b.type = 'button'; b.className = 'dunB' + (d.open ? '' : ' lock') + (id === cur ? ' on' : ''); b.dataset.dun = id; b.style.setProperty('--dc', d.color);
      const done = d.tut ? 0 : DN.cleared(id);
      b.innerHTML = '<i></i><span class="tx"><b></b><small></small></span>'; // 이름 한 줄 · 설명 아래 줄(낱말 중간 끊김 X — 검수 지적)
      b.querySelector('b').textContent = d.name; b.querySelector('small').textContent = !d.open ? d.ownerName + ' · 곧 열려요' : d.tut ? '연습 던전 · 모두' : d.ownerName + ' 던전 · 도장 ' + done + '/' + TG.LEVEL_MAX;
      if (d.open) b.addEventListener('click', (e) => { e.stopPropagation(); TG.A.ui(1.0); DN.select(id, DN.sel.dun === id ? DN.sel.lv : DN.maxPick(id)); H.dunRender(); });
      H.dunList.appendChild(b);
    });
    // 단계 10칸(연습 던전은 단계 없음): 깬 칸 = 도장, 다음 칸 = 도전, 그 위는 잠김, 10단계는 깨기 전 「???」
    const d = DN.get(cur), lvs = DN.hasLevels(cur); H.show(H.lvRow, lvs); H.show(H.lvInfo, lvs); // 11-24 베타 깃발이면 연습 던전도 단계 10칸
    H.lvRow.innerHTML = '';
    if (lvs) {
      const done = DN.cleared(cur), can = DN.maxPick(cur);
      for (let n = 1; n <= TG.LEVEL_MAX; n++) {
        const L = TG.LEVELS[n], b = document.createElement('button'); b.type = 'button'; b.dataset.lv = n;
        b.className = 'lvB' + (n <= done ? ' done' : n === done + 1 ? ' next' : n <= can ? ' open' : ' lock') + (n === DN.sel.lv ? ' on' : ''); // open = 베타 깃발로 미리 열린 칸(점선 X·회색 X)
        b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = n; b.querySelector('small').textContent = DN.levelName(n, cur);
        if (n <= can) b.addEventListener('click', (e) => { e.stopPropagation(); TG.A.ui(1.0); DN.select(cur, n); H.dunRender(); });
        H.lvRow.appendChild(b);
      }
      const L = TG.LEVELS[DN.sel.lv], stars = Math.min(5, Math.ceil(DN.sel.lv / 2));
      H.lvInfo.textContent = (TG.beta() ? '베타 · 모든 단계 열림 · ' : '') + DN.levelName(DN.sel.lv, cur) + ' · ' + L.note + ' · 이쯤이면 편해요 ' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + ' (Lv ' + L.lv + '+)' + ' · 깨면 ' + L.gear;
    }
    H.dunGo.querySelector('span').textContent = (lvs ? d.name + ' · ' + DN.levelName(DN.sel.lv, cur) : d.name) + ' 가기';
  };
  H.cuSkip = function (on) { if (H.cuSkipBtn) H.show(H.cuSkipBtn, !!on); };
  // 타이틀: 쎌이 손 흔들며 차례로 안내 (타이틀이 보이는 동안만 돎)
  let titleTO = null, titleI = 0, titleSaid = {};
  H.sselTitleStart = function () {
    clearTimeout(titleTO); titleI = 0; titleSaid = {};
    const box = $('sselTitle'), txt = $('sselTitleTxt'); if (!box || !txt) return;
    const tick = () => {
      if (H.title && !H.title.classList.contains('hide')) {
        const auto = document.body.classList.contains('atkAuto'), touch = document.body.classList.contains('touch');
        const lines = [
          hubBack ? ['cheer', '어서 와! 여기는 톱니골 광장이야!'] : ['front', '안녕! 난 쎌이야. 내가 안내할게!'],
          hubTut ? ['ok', '다음은 「' + hubNext + '」! 「던전」을 누르면 바꿀 수 있어~'] : ['wink', '여긴 톱니골 광장! 첫 던전 「방송 파이프 굴」에서 연습하자!'],
          ['smile', touch ? '왼쪽 엄지로 슝슝 움직여 봐!' : 'WASD로 슝슝 움직여 봐!'],
          auto ? ['ok', '소리 방울은 저절로! 넌 음표만 주워~'] : ['wink', touch ? '「소리」 꾹! 끌면 그쪽으로 나가지!' : '마우스 꾹! 가리키는 쪽으로 나가지!'],
          ['cheer', '준비됐지? 「시작」 눌러 봐!'],
        ];
        const [f, s] = lines[titleI % lines.length];
        txt.textContent = s; H.sselFace(box, f, true);
        if (!titleSaid[s] && H.sselVoice(s)) titleSaid[s] = 1;   // 11-14 목소리: 타이틀이 보이는 동안 줄마다 한 번만 (소리 켜지기 전 줄은 다음 바퀴에)
        const g = box.querySelector('.gtxt'); if (g) { g.style.animation = 'none'; void g.offsetWidth; g.style.animation = ''; }
        titleI++;
      } else titleSaid = {};   // 타이틀을 떠나면 다음에 다시 들려줌
      titleTO = setTimeout(tick, 3200);
    };
    tick();
  };

  H.resize = function () {
    const vp = TG.vp ? TG.vp() : { w: innerWidth, h: innerHeight };
    const s = TG.clamp(Math.min(vp.h / 410, vp.w / 860), 0.78, 1.45);
    document.documentElement.style.setProperty('--s', s.toFixed(3));
    H.s = s;
    // 세로 화면 안내 (터치 기기)
    const portrait = vp.h > vp.w * 1.05;
    H.rotate.classList.toggle('hide', !(portrait && TG.isTouch));
    H.portrait = portrait && TG.isTouch;
  };

  // 큰 소리 버튼: 누른 즉시 눌림·번쩍 / 못 쓸 때(덜 참·공중) 흔들림 + 「아직!」
  let fireTO = null, denyTO = null;
  H.bigFire = function () { const b = H.btnBig; if (!b) return; b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); clearTimeout(fireTO); fireTO = setTimeout(() => b.classList.remove('fire'), 420); };
  H.bigDeny = function (txt) {
    const b = H.btnBig; if (!b) return;
    if (!H.bigNo) { H.bigNo = document.createElement('div'); H.bigNo.id = 'bigNo'; H.bigNo.className = 'ol'; b.appendChild(H.bigNo); }
    H.bigNo.textContent = txt;
    b.classList.remove('deny'); void b.offsetWidth; b.classList.add('deny'); clearTimeout(denyTO); denyTO = setTimeout(() => b.classList.remove('deny'), 520);
  };
  // 「소리」 버튼: 누르는 동안 눌린 모습, 끌면 알맹이가 그쪽으로 살짝 따라감
  let sndOn = false, sndKx = 0, sndKy = 0;
  H.sndBtn = function (on, kx, ky) {
    const b = H.btnSnd; if (!b) return;
    if (on !== sndOn) { sndOn = on; b.classList.toggle('held', on); }
    kx = on ? kx || 0 : 0; ky = on ? ky || 0 : 0;
    if (kx !== sndKx || ky !== sndKy) { sndKx = kx; sndKy = ky; const l = Math.hypot(kx, ky), k = (l > 1 ? 1 / l : 1) * 20 * H.s; b.style.setProperty('--kx', (kx * k).toFixed(1) + 'px'); b.style.setProperty('--ky', (ky * k).toFixed(1) + 'px'); }
  };
  H.loadProg = function (k) { H.lfill.style.width = Math.round(5 + k * 95) + '%'; };
  H.show = function (el, on) { el.classList.toggle('hide', !on); };

  // 주인공 얼굴 아이콘: 모델을 따로 렌더해 캔버스로 (SEFO 는 저지 번호 딱지까지). 이름표도 여기서 맞춤
  H.makeFace = function () {
    const R = TG.R, P = TG.PL, size = 384; // 화질(갤럭시탭): 192 → 384 (태블릿에서 얼굴 아이콘이 늘어나 흐렸음)
    const hero = P.hero || TG.HEROES.sefo, hk = P.hk || 1;
    { const nt = $('nameTag'); if (nt && nt.firstChild && nt.firstChild.nodeType === 3) nt.firstChild.nodeValue = hero.name + ' '; }
    const rt = new T.WebGLRenderTarget(size, size, { samples: 4 });
    const sc = new T.Scene();
    sc.add(new T.HemisphereLight(0xffffff, 0xd9a878, 2.2));
    const dl = new T.DirectionalLight(0xffffff, 2.6); dl.position.set(-1, 2, 3); sc.add(dl);
    const parent = P.root.parent;
    const saved = { x: P.root.position.x, y: P.root.position.y, z: P.root.position.z, ry: P.root.rotation.y };
    sc.add(P.root);
    P.root.position.set(0, 0, 0); P.root.rotation.y = 0.25;
    P.root.updateMatrixWorld(true);
    const cam = new T.PerspectiveCamera(26, 1, 0.1, 50);
    const fc = hero.faceCam || [2.5, 4.48, 2.2]; cam.position.set(0.14, fc[0] * hk, fc[1] * hk); cam.lookAt(0, fc[2] * hk, 0); // 얼굴 위주 (가슴 번호는 아래 딱지로 또렷하게 다시 그림). 키가 다른 주인공은 비율대로, heroes.js faceCam 으로 조정(허조교: 철모가 커서 더 아래를 봄)
    const old = R.renderer.getRenderTarget();
    const ring = P.ring.visible; P.ring.visible = false;
    R.renderer.setRenderTarget(rt);
    R.renderer.setClearColor(0x000000, 0); R.renderer.clear();
    R.renderer.render(sc, cam);
    const buf = new Uint8Array(size * size * 4);
    R.renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    R.renderer.setRenderTarget(old); R.renderer.setClearColor(0x9fd7f2, 1);
    parent.add(P.root);
    P.root.position.set(saved.x, saved.y, saved.z); P.root.rotation.y = saved.ry; P.ring.visible = ring;
    rt.dispose();
    const cv = $('faceCv'), ctx = cv.getContext('2d'), img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const si = ((size - 1 - y) * size + x) * 4, di = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) img.data[di + c] = Math.min(255, Math.pow(buf[si + c] / 255, 1 / 2.2) * 255 * 1.02);
      img.data[di + 3] = buf[si + 3];
    }
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = size; tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    { const k = cv.width / 160; ctx.drawImage(tmp, 0, 0, size, size, -6 * k, 4 * k, cv.width + 12 * k, cv.height + 12 * k); } // 캔버스를 키워도 자리는 그대로
    if (!hero.badge) return;
    // 저지 번호 딱지 「34」: 작은 초상화에서도 또렷하게 (검정 저지 + 빨간 테 + 흰 숫자)
    const W = cv.width, bw = W * 0.56, bh = W * 0.25, bx = (W - bw) / 2, by = W * 0.685, r = bh * 0.4;
    ctx.beginPath(); ctx.moveTo(bx + r, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r); ctx.arcTo(bx + bw, by + bh, bx, by + bh, r); ctx.arcTo(bx, by + bh, bx, by, r); ctx.arcTo(bx, by, bx + bw, by, r); ctx.closePath();
    ctx.fillStyle = '#1e1e24'; ctx.fill(); ctx.lineWidth = W * 0.035; ctx.strokeStyle = '#e5352b'; ctx.stroke();
    ctx.font = '900 italic ' + Math.round(bh * 0.92) + 'px Arial Black, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.fillText(hero.badge, W / 2, by + bh * 0.54);
  };

  const pv = new T.Vector3();
  function toScreen(v) { pv.copy(v).project(TG.R.camera); return [(pv.x * 0.5 + 0.5) * TG.R.w, (-pv.y * 0.5 + 0.5) * TG.R.h]; }
  H.toScreen = toScreen;

  // 「소리 크기」 말풍선 칸
  const LIFE_SVG = '<svg viewBox="0 0 40 38"><path class="bb" d="M8 3 h24 q6 0 6 6 v14 q0 6 -6 6 h-13 l-9 8 l2 -8 h-4 q-6 0 -6 -6 v-14 q0 -6 6 -6 z"/><path class="wv" d="M15 11 q5 5 0 10 M23 8 q8 8 0 16"/></svg>';
  function drawLives(P) {
    const n = P.maxHp, sh = P.shield || 0;
    if (H.lifeN !== n || H.lifeSh !== sh) {
      H.lives.innerHTML = '';
      for (let i = 0; i < n + sh; i++) { const d = document.createElement('div'); d.className = 'lf' + (i >= n ? ' shield' : ''); d.innerHTML = LIFE_SVG; H.lives.appendChild(d); }
      H.lifeN = n; H.lifeSh = sh; H.lifeHp = -1;
    }
    if (H.lifeHp !== P.hp) {
      const ch = H.lives.children;
      for (let i = 0; i < n; i++) {
        const on = i < P.hp, was = !ch[i].classList.contains('off');
        ch[i].classList.toggle('off', !on);
        if (H.lifeHp >= 0 && was && !on) { ch[i].classList.remove('gain'); ch[i].classList.add('lost'); }
        if (H.lifeHp >= 0 && !was && on) { ch[i].classList.remove('lost'); ch[i].classList.add('gain'); }
      }
      H.lifeHp = P.hp;
    }
  }

  // 매 프레임 (그리기 쪽)
  H.update = function (dt, G) {
    const P = TG.PL;
    drawLives(P);
    H.noteN.textContent = G.notes;
    H.lvTag.textContent = 'Lv.' + G.level;
    H.xpFill.style.width = (Math.min(1, G.xp / G.xpNeed) * 100).toFixed(1) + '%';
    // 층 안개 게이지: 지금 층의 안개가 줄어듦 (시간 표시 없음)
    const b = TG.F.boss;
    const cur = G.bossStarted ? 3 : G.floor - 1;
    const left = G.bossStarted ? (b ? b.hp / b.maxHp : 0) : G.fogLeft();
    H.segs.forEach((sg, i) => {
      const done = i < cur || (i === cur && left <= 0);
      sg.classList.toggle('done', done); sg.classList.toggle('now', i === cur && !done);
      H.fogs[i].style.width = done ? '0%' : i === cur ? (left * 100).toFixed(1) + '%' : '100%';
    });
    const gk = (Math.min(3, cur) + (cur === 3 ? (1 - left) * 0.9 : 1 - left)) / 3.9;
    H.progGear.style.left = (TG.clamp(gk, 0, 1) * 100).toFixed(1) + '%';
    // 보스 막대
    H.show(H.bossBar, !!(b && b.state !== 'gather' && !b.popped));
    if (b) { // 11-24 귀여운 보스(쎄니·베리): 막대가 「물감/꽃 게이지」 — 꾸며 줄수록 차오름(체력·HP 말 X). 보통 보스는 남은 양이 줄어듦
      const cute = !!b.cute, k = cute ? 1 - b.hp / b.maxHp : b.hp / b.maxHp, w = (k * 100).toFixed(1) + '%'; H.bossFill.style.width = w; H.bossGhost.style.width = w;
      const nm = cute ? (b.gauge || '꾸미기') + ' 게이지' : '큰 침묵 안개'; // 이름은 띠로 보였으니 짧게(진행 톱니 아이콘과 안 겹치게)
      if (H.bossNameShown !== nm) { H.bossNameShown = nm; const e = H.bossBar.querySelector('.bname'); if (e) e.textContent = nm; H.bossBar.classList.toggle('cute', cute); H.bossBar.classList.toggle('tree', cute && b.variant === 'tree'); }
    }
    // 연속
    if (G.combo >= 3) {
      H.show(H.combo, true);
      if (H.comboShown !== G.combo) { H.comboN.textContent = G.combo; H.combo.classList.remove('bump'); void H.combo.offsetWidth; H.combo.classList.add('bump'); H.comboShown = G.combo; }
      H.combo.style.opacity = G.comboT < 0.5 ? (G.comboT / 0.5).toFixed(2) : '1';
    } else H.show(H.combo, false);
    // 머리 위: 둘레 링 단계 점
    P.headPos(pv);
    const [hx, hy] = toScreen(pv);
    H.overPips.style.transform = 'translate(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px) translate(-50%,-50%)';
    const lv = P.charging ? P.chargeLevel : 0;
    H.overPips.classList.toggle('show', lv > 0);
    Array.from(H.overPips.children).forEach((e, i) => e.classList.toggle('on', i < lv));
    // 말풍선
    if (!H.speech.classList.contains('hide')) {
      P.headPos(pv); pv.y += 0.9;
      let [sx, sy] = toScreen(pv);
      if (document.body.classList.contains('closeup')) { sx += 130 * H.s; sy = Math.max(sy + 30 * H.s, 96 * H.s); } // 11-24 확대 연출: 머리가 화면 위쪽이라 말풍선을 머리 오른쪽 위·화면 안으로
      H.speech.style.left = sx.toFixed(1) + 'px'; H.speech.style.top = sy.toFixed(1) + 'px';
    }
    // 큰 소리 게이지 (버튼 둘레 충전 링, 다 차면 반짝)
    const g = G.gauge / 100;
    H.bigArc.setAttribute('stroke-dashoffset', (282.7 * (1 - g)).toFixed(1));
    H.btnBig.classList.toggle('ready', g >= 1);
    // 회색 구역
    // 회색 구역 테두리: 들어선 순간·구역에서 닿은 순간에만 0.3초 옅게 (화면이 계속 보라로 덮이지 않게). 구역 표시는 바닥 고리가 함
    const zin = !!P.inZone;
    if ((zin && !H.zWas) || (zin && P.lastHurt < 0.06)) { H.zoneVig.classList.remove('on'); void H.zoneVig.offsetWidth; H.zoneVig.classList.add('on'); }
    if (!zin) H.zoneVig.classList.remove('on');
    H.zWas = zin;
    // 뭉치·째깍이 위 작은 막대, 고치 풀림 막대
    let mi = 0;
    for (const u of TG.F.list) {
      if (mi >= H.mini.length) break;
      if (u.state !== 'live' || u.spawnT < 0.3) continue;
      const coc = u.kind === 'cocoon';
      if (!coc && u.kind !== 'clump' && u.kind !== 'tick') continue;
      if (coc && u.prog <= 0) continue;
      pv.set(u.x, u.y + (u.kind === 'clump' ? 2.7 : coc ? 3.2 : 2.4) * u.scale, u.z);
      const [mx, my] = toScreen(pv);
      if (mx < -50 || mx > TG.R.w + 50 || my < -20 || my > TG.R.h + 20) continue;
      const el = H.mini[mi++];
      el.style.display = 'block'; el.className = 'mhp' + (u.kind === 'tick' ? ' tick' : coc ? ' coc' : '');
      el.style.transform = 'translate(' + mx.toFixed(0) + 'px,' + my.toFixed(0) + 'px) translate(-50%,-50%)';
      el.firstChild.style.width = Math.max(0, (coc ? u.prog / 2 : u.hp / u.maxHp) * 100).toFixed(0) + '%';
    }
    for (; mi < H.mini.length; mi++) H.mini[mi].style.display = 'none';
    // 미니맵 (가볍게: 3프레임에 1번)
    if ((H.mapTick = (H.mapTick + 1) % 3) === 0) drawMap(G);
  };

  function drawMap(G) {
    const c = H.mapCtx, W = 220, Hh = 154; // 화질(갤럭시탭): 캔버스는 화소 2배(440×308), 그리는 좌표는 그대로
    c.setTransform(H.map.width / W, 0, 0, H.map.height / Hh, 0, 0);
    const AR = TG.AR, sx = W / (AR.W + 2), sz = Hh / (AR.D + 2);
    const X = (x) => W / 2 + x * sx, Z = (z) => Hh / 2 + z * sz;
    c.fillStyle = '#efdcb8'; c.fillRect(0, 0, W, Hh);
    // 체크 무늬
    c.fillStyle = 'rgba(217,84,63,0.35)';
    for (let i = 0; i < 20; i++) for (let j = 0; j < 14; j++) if ((i + j) % 2 === 0) c.fillRect(X(-20 + i * 2), Z(-14 + j * 2), 2 * sx + 0.5, 2 * sz + 0.5);
    c.strokeStyle = '#c9a23a'; c.lineWidth = 4; c.strokeRect(X(-20), Z(-14), 40 * sx, 28 * sz);
    // 회색 고리
    const zn = TG.F.zone;
    if (zn.on) {
      c.save(); c.fillStyle = 'rgba(94,90,122,0.55)'; c.beginPath(); c.rect(0, 0, W, Hh); c.arc(X(0), Z(0), zn.R * sx, 0, Math.PI * 2, true); c.fill('evenodd'); c.restore();
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(X(0), Z(0), zn.R * sx, 0, Math.PI * 2); c.stroke();
    }
    // 장애물·탑
    c.fillStyle = '#8a6420';
    for (const o of AR.colliders) { if (o.r > 2 || o.kind === 'bar') continue; // 난간 점은 뺌(점이 너무 많음)
      c.beginPath(); c.arc(X(o.x), Z(o.z), Math.max(2.5, o.r * sx), 0, 6.3); c.fill(); }
    c.fillStyle = '#b8433a'; c.strokeStyle = '#1b1424'; c.lineWidth = 2;
    c.beginPath(); c.arc(X(AR.towerPos.x), Z(AR.towerPos.z), 3 * sx, 0, 6.3); c.fill(); c.stroke();
    // 안개·째깍이
    const blink = G.arrowU && ((performance.now() / 220) | 0) % 2 === 0; // 11-16 남은 안개 화살표가 켜져 있으면 남은 안개 점 깜빡임(크고 밝게)
    for (const u of TG.F.list) {
      if (u.spawnT < 0) continue;
      const fog = u.kind !== 'tick' && u.kind !== 'cocoon' && u.state === 'live';
      c.fillStyle = blink && fog ? '#fff3b0' : u.kind === 'tick' ? (u.state === 'live' ? '#2fb7a8' : '#ffd23f') : u.kind === 'cocoon' ? '#ffb347' : u.kind === 'echo' ? '#5f8de0' : '#6e6a8e';
      const r = (u.kind === 'clump' ? 4 : 3) + (blink && fog ? 3 : 0);
      c.beginPath(); c.arc(X(u.x), Z(u.z), r, 0, 6.3); c.fill();
      if (blink && fog) { c.strokeStyle = '#e5352b'; c.lineWidth = 2; c.stroke(); }
    }
    const b = TG.F.boss;
    if (b && TG.F.bossObj.group.visible) { c.fillStyle = '#5e5a7a'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(X(b.x), Z(b.z), 9, 0, 6.3); c.fill(); c.stroke(); }
    // 보조 캐릭터 (작은 점)
    const AS = TG.AS;
    if (AS && AS.on) { c.fillStyle = '#' + (AS.def.color | 0).toString(16).padStart(6, '0'); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(X(AS.x), Z(AS.z), 4.5, 0, 6.3); c.fill(); c.stroke(); }
    // 주인공 (방향 삼각형, 대표색)
    const P = TG.PL;
    c.save(); c.translate(X(P.rx), Z(P.rz)); c.rotate(-P.yaw + Math.PI);
    c.fillStyle = (P.hero && P.hero.colorCss) || '#e5352b'; c.strokeStyle = '#fff'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(7, 6); c.lineTo(-7, 6); c.closePath(); c.fill(); c.stroke();
    c.restore();
  }

  // 배너
  let bannerTO = null;
  H.showBanner = function (text, sub, cls, dur) {
    const b = H.banner;
    b.querySelector('.inner').textContent = text;
    b.querySelector('.sub').textContent = sub || '';
    b.className = 'show ' + (cls || '');
    void b.offsetWidth;
    clearTimeout(bannerTO);
    bannerTO = setTimeout(() => b.classList.add('hide'), (dur || 2.2) * 1000);
  };
  H.countShow = function (txt, go) {
    const c = H.count;
    c.textContent = txt; c.className = 'ol show' + (go ? ' go' : '');
    void c.offsetWidth;
  };
  H.countHide = function () { H.count.className = 'ol hide'; };
  let speechTO = null;
  H.say = function (text, dur) {
    H.speech.textContent = text; H.show(H.speech, true);
    H.speech.style.animation = 'none'; void H.speech.offsetWidth; H.speech.style.animation = '';
    clearTimeout(speechTO); speechTO = setTimeout(() => H.show(H.speech, false), (dur || 1.6) * 1000);
  };

  H.showResult = function (r) {
    H.resTitle.textContent = r.clear ? '노래를 되찾았어요!' : '다음에 다시!\n모은 건 그대로예요'; // 긴 제목은 두 줄 (패널 밖으로 안 나가게)
    if (H.rStamp) { // 11-24 단계 도장: 던전 · 단계 깸 → 다음 단계 열림 · 첫 클리어 상자(글)
      const st = r.stamp; H.show(H.rStamp, !!(r.clear && r.lv && !r.tut && (r.dungeon !== 'pipe' || !!st))); // 베타 깃발이면 연습 던전 도장도
      if (r.clear && st) H.rStamp.textContent = r.dungeonName + ' · ' + r.lvName + ' 도장!' + (st.first && st.nextName ? ' 다음 「' + st.nextName + '」 열림' : st.first ? ' 금 도장!' : '') + (st.box ? '\n첫 클리어 상자: ' + st.box : '');
      else if (r.clear) H.rStamp.textContent = r.dungeonName + ' · ' + r.lvName + ' 도장!';
    }
    H.rTime.textContent = TG.fmtTime(r.time);
    H.rFog.textContent = r.fogs;
    H.rCombo.textContent = r.combo;
    H.rNote.textContent = r.notes;
    { const m = document.getElementById('rMode'); if (m) { m.textContent = r.atk === 'mixed' ? '자동 (일부)' : '자동'; H.show(m, r.atk === 'auto' || r.atk === 'mixed'); } } // 소리 방울 자동으로 한 판이면 표시
    const st = Array.from(H.stars.children);
    st.forEach((e) => { e.className = 'st'; });
    H.show(H.result, true);
    // 쎌: 깨면 cheer, 못 깨면 bow + 격려 → 별이 다 뜬 뒤 별 개수로 표정(1 smile · 2 ok · 3 wink)
    { const box = $('sselRes'), tx = $('sselResTxt');
      if (box && tx) {
        clearTimeout(H.resTO);
        tx.textContent = r.clear ? '해냈다! 노래가 돌아왔어!' : '괜찮아, 다음엔 꼭 될 거야!';
        H.sselFace(box, r.clear ? 'cheer' : 'bow', true);
        H.sselVoice(tx.textContent);
        H.resTO = setTimeout(() => {
          const n = r.stars | 0, L = { 3: ['wink', '별 세 개! 역시 내 친구지~'], 2: ['ok', '보스까지 갔잖아! 거의 다 왔어!'], 1: ['smile', '한 번 더 해 볼까? 금방 늘 거야!'] }[n] || ['smile', '한 번 더 해 볼까?'];
          if (H.result.classList.contains('hide')) return;
          tx.textContent = L[1]; H.sselFace(box, L[0], true); H.sselVoice(L[1]);
          if (r.tut) H.resTO = setTimeout(() => { if (H.result.classList.contains('hide')) return; tx.textContent = '연습 끝! 「광장으로」 눌러서 톱니골 광장에 가 보자!'; H.sselFace(box, 'smile', true); }, 2600); // 11-19 튜토리얼 판
        }, 2600);
      } }
    st.forEach((e, i) => setTimeout(() => { e.classList.add('show'); if (i < r.stars) { e.classList.add('on'); TG.A.play('sfx_pick', { rate: 1 + i * 0.25, gain: 0.8 }); } }, 380 + i * 280));
  };

  // 한 줄 안내 (긴 설명창 없이 그때그때)
  H.hintSet = function (text) {
    if (H.hintCur === text) return;
    H.hintCur = text;
    if (!text) { H.show(H.hint, false); return; }
    H.hint.textContent = text; H.show(H.hint, true);
    H.hint.style.animation = 'none'; void H.hint.offsetWidth; H.hint.style.animation = '';
  };
  // 비서 쎌 말풍선 (진행자). face = 표정(basic·smile·wink·think·surprise·bow·cheer·ok·front)
  let gruntTO = null, gruntLater = null;
  // delay(초) 를 주면 그만큼 뒤에 (층 이름 띠가 사라진 뒤 — 띠와 안 겹치게)
  H.gruntSay = function (text, dur, face, delay) {
    clearTimeout(gruntLater); gruntLater = null;
    if (delay > 0) { gruntLater = setTimeout(() => { gruntLater = null; H.gruntSay(text, dur, face); }, delay * 1000); return; }
    H.gruntTxt.textContent = text; H.show(H.grunt, true);
    H.grunt.style.animation = 'none'; void H.grunt.offsetWidth; H.grunt.style.animation = '';
    H.sselFace(H.grunt, face || 'basic', true);
    H.sselVoice(text);
    clearTimeout(gruntTO); gruntTO = setTimeout(() => H.show(H.grunt, false), (dur || 2.5) * 1000);
  };
  H.gruntHide = function () { clearTimeout(gruntTO); clearTimeout(gruntLater); gruntLater = null; H.show(H.grunt, false); if (TG.SV) TG.SV.stop(); };

  // 리믹스 카드 3장 (큰 그림 + 두 단어 이하). onPick(번호)
  H.showCards = function (opts, onPick, reroll) { // reroll = { left, onReroll } (11-18 다시 뽑기: 한 판 2번, 0이면 회색)
    const C = TG.C;
    H.cardRow.innerHTML = '';
    H.onReroll = reroll ? reroll.onReroll : null; H.setReroll(reroll ? reroll.left : 0);
    opts.forEach((id, i) => {
      const d = C.byId[id], lv = C.lv(id);
      const b = document.createElement('button'); b.className = 'card'; b.style.setProperty('--cc', d.col);
      const cv = document.createElement('canvas'); cv.width = cv.height = 320; C.icon(id, cv); b.appendChild(cv);
      const tag = document.createElement('div'); tag.className = 'ctag'; tag.textContent = d.tag ? 'with ' + d.tag : ''; b.appendChild(tag);
      const nm = document.createElement('div'); nm.className = 'cname' + (d.name.replace(/\s/g, '').length >= 6 ? ' long' : ''); nm.textContent = d.name; b.appendChild(nm); // 11-18: 긴 이름(호루라기 두 번·마라카스 샤카·다시 일어나기)은 글자 조금 작게
      const pp = document.createElement('div'); pp.className = 'pips';
      for (let k = 0; k < C.maxOf(id); k++) { const p = document.createElement('i'); if (k < lv) p.className = 'on'; else if (k === lv) p.className = 'new'; pp.appendChild(p); }
      b.appendChild(pp);
      const key = document.createElement('div'); key.className = 'k'; key.textContent = String(i + 1); b.appendChild(key);
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(i); });
      H.cardRow.appendChild(b);
    });
    H.show(H.cards, true);
    document.body.classList.add('cardsOpen'); // 카드가 떠 있는 동안 떠 있는 글자·안내 줄을 숨김 (카드 뒤로 비치지 않게)
  };
  H.setReroll = function (left) { H.rerollBtn.querySelector('span').textContent = '다시 뽑기 (' + Math.max(0, left | 0) + ')'; H.rerollBtn.classList.toggle('off', !(left > 0)); H.rerollBtn.disabled = !(left > 0); };
  H.reviveCount = function (n) { if (n == null) { H.reviveCnt.classList.add('hide'); return; } H.reviveCnt.classList.remove('hide'); H.reviveCnt.innerHTML = ''; H.reviveCnt.appendChild(document.createTextNode(String(n))); const s = document.createElement('small'); s.textContent = '다시 일어나요!'; H.reviveCnt.appendChild(s); };
  // 11-18 내 리믹스 카드 목록: data = { hero: {name, shot, big}, cards: [{id, name, lv, max, desc}] }
  H.showSkills = function (data) {
    const C = TG.C;
    H.skHero.textContent = data.hero.name + ' · 소리 「' + data.hero.shot + '」 · 큰 소리 「' + data.hero.big + '」';
    H.skList.innerHTML = '';
    if (!data.cards.length) { const e = document.createElement('div'); e.className = 'skEmpty ol'; e.textContent = '아직 고른 카드가 없어요'; H.skList.appendChild(e); }
    data.cards.forEach((c) => {
      const row = document.createElement('div'); row.className = 'skRow';
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; C.icon(c.id, cv); row.appendChild(cv);
      const tx = document.createElement('div'); tx.className = 'skTxt';
      const nm = document.createElement('div'); nm.className = 'skName'; nm.textContent = c.name + ' ' + c.lv + '단';
      const pp = document.createElement('span'); pp.className = 'pips'; for (let k = 0; k < c.max; k++) { const i = document.createElement('i'); if (k < c.lv) i.className = 'on'; pp.appendChild(i); } nm.appendChild(pp);
      const ds = document.createElement('div'); ds.className = 'skDesc'; ds.textContent = c.desc;
      tx.appendChild(nm); tx.appendChild(ds); row.appendChild(tx); H.skList.appendChild(row);
    });
    H.show(H.skills, true); H.skills.scrollTop = 0; document.body.classList.add('skillsOpen');
  };
  H.hideSkills = function () { H.show(H.skills, false); document.body.classList.remove('skillsOpen'); };
  H.markCard = function (i) { const b = H.cardRow.children[i]; if (b) b.classList.add('pick'); };
  H.hideCards = function () { H.show(H.cards, false); document.body.classList.remove('cardsOpen'); };

  // 쉼터 3택1 (회복·보호 방울·음표 선물). onPick(번호)
  H.showShelter = function (opts, onPick) {
    H.shelter.innerHTML = '';
    opts.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'sc';
      const cv = document.createElement('canvas'); cv.width = cv.height = 160; TG.C.icon(o.icon, cv); b.appendChild(cv);
      const t = document.createElement('span'); t.textContent = o.name; b.appendChild(t);
      const key = document.createElement('span'); key.className = 'k'; key.textContent = String(i + 1); b.appendChild(key);
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(i); });
      H.shelter.appendChild(b);
    });
    H.show(H.shelter, true);
  };
  H.markShelter = function (i) { const b = H.shelter.children[i]; if (b) b.classList.add('pick'); };
  H.hideShelter = function () { H.show(H.shelter, false); };

  // 화면에 보이는 글 모으기 (문구 규칙 시험용)
  H.allText = function () { return document.getElementById('ui').innerText; };

  // 스틱 표시
  // 남은 안개 방향 화살표(11-16): 화면 자리(px)·방향(라디안, 화면 x축 기준). 그림(svg)은 위를 보고 있어 +90°
  H.arrowAt = function (x, y, ang) {
    const a = document.getElementById('fogArrow'); if (!a) return;
    a.classList.remove('hide');
    a.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + (ang * 180 / Math.PI + 90).toFixed(1) + 'deg)';
  };
  H.arrowHide = function () { const a = document.getElementById('fogArrow'); if (a) a.classList.add('hide'); };
  H.stickAt = function (x, y, kx, ky, active) {
    H.stickBase.style.left = x + 'px'; H.stickBase.style.top = y + 'px';
    H.stickKnob.style.left = (x + kx) + 'px'; H.stickKnob.style.top = (y + ky) + 'px';
    H.stick.classList.toggle('idle', !active);
  };
})();
