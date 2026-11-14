/* GRUNT ZERO RE — 비서 그런트 목소리 (2026-11-14, 확정 목소리 grunt 「묵직 큰형」(11-14 새 목소리, 옛 「비서 그런트 C」 바꿈))
   · 말풍선(브리핑·무전·결과) 글과 똑같은 대사를 미리 만든 m4a(assets/assist_voice → js/pack_assist_voice.js, base64 묶음, 바깥 요청 0)로 틀어 줌
   · 소리가 켜지는 순간(AU.init) 전부 미리 디코드. 켜지기 직전에 뜬 말(첫 터치로 고른 난이도 등)은 2초 안이면 디코드 뒤 들려줌
   · 허조교 목소리(구르기·차렷·전체 기상, GZ.VO)가 우선: 허조교가 말하는 중이면 비서는 건너뜀, 비서가 말하는 중에 허조교가 나오면 비서를 바로 줄여 멈춤
   · 한 번에 한 마디. 말하는 동안 음악 −6dB·효과음 −3dB (AU.vduck — 허조교 더킹과 따로)
   · 효과음 막대·소리 끄기(?mute)·일시 정지 창 「비서 목소리」(저장 gzre_asvoice)를 따름. 글이 목록에 없으면 말풍선만 (stats.miss) */
(function () {
  'use strict';
  const GZ = window.GZ, AU = GZ.AU;
  const SV = (GZ.ASV = { bufs: {}, ids: {}, ready: false, loading: false, cur: null, pend: null, log: [], err: 0, stats: { played: 0, skipped: 0, miss: 0, cut: 0, yield: 0, late: 0 } });
  const PK = window.GZASV || { lines: {}, data: {} };
  Object.keys(PK.lines).forEach((id) => { SV.ids[PK.lines[id]] = id; });
  SV.count = Object.keys(PK.data).length;
  SV.VOL = 0.6;   // 허조교 「차렷!」보다 살짝 작게(test_assist_voice 「크기」, 실측 비서 RMS ≤ 허조교) — 같은 목소리 버스(효과음 막대 × AU.VOICE_GAIN)
  SV.on = true;
  try { SV.on = localStorage.getItem('gzre_asvoice') !== '0'; } catch (e) { SV.on = true; }
  SV.setOn = function (v) { SV.on = !!v; try { localStorage.setItem('gzre_asvoice', SV.on ? '1' : '0'); } catch (e) { /* 저장 안 되는 곳 */ } if (!SV.on) SV.stop(); SV.sync(); return SV.on; };

  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  SV.load = function () {
    const ctx = AU.ctx;
    if (!ctx || SV.loading) return;
    SV.loading = true;
    const ids = Object.keys(PK.data); let left = ids.length;
    const done = () => {
      if (--left > 0) return;
      SV.ready = true;
      const p = SV.pend; SV.pend = null;
      if (p && performance.now() - p.at < 2000 && (!p.still || p.still())) { if (SV.say(p.text, p.still)) SV.stats.late++; }
    };
    if (!left) { SV.ready = true; return; }
    ids.forEach((id) => {
      const ok = (buf) => { SV.bufs[id] = buf; done(); };
      const bad = () => { SV.err++; done(); };
      try { const p = ctx.decodeAudioData(b64(PK.data[id]), ok, bad); if (p && p.catch) p.catch(() => {}); } catch (e) { bad(); }
    });
  };
  const init0 = AU.init;
  AU.init = function () { const r = init0.apply(this, arguments); if (AU.ctx && !SV.loading) SV.load(); return r; };
  if (AU.ctx) SV.load();

  // 허조교 우선: 허조교가 말을 시작하면 비서를 멈춤
  const VO = GZ.VO;
  if (VO && VO.say) {
    const say0 = VO.say;
    VO.say = function () { const r = say0.apply(this, arguments); if (r && SV.speaking()) { SV.stop(); SV.stats.yield++; } return r; };
  }
  // 일시 정지하면 비서 말도 끊음 (허조교 목소리와 같게)
  if (GZ.G && GZ.G.pause) {
    const pause0 = GZ.G.pause;
    GZ.G.pause = function (v) { const r = pause0.apply(this, arguments); if (v && GZ.G.paused) SV.stop(); return r; };
  }
  const hjgBusy =() => !!(VO && VO.cur && AU.ctx && AU.ctx.currentTime < VO.cur.end - 0.02);

  SV.stop = function () {
    const c = SV.cur, ctx = AU.ctx; if (!c || !ctx) return;
    const now = ctx.currentTime;
    if (now < c.end) { try { c.g.gain.cancelScheduledValues(now); c.g.gain.setTargetAtTime(0, now, 0.008); c.src.stop(now + 0.05); } catch (e) { /* 이미 멈춤 */ } if (AU.vduck) AU.vduck(0.05); }
    SV.cur = null;
  };
  SV.speaking = () => !!(SV.cur && AU.ctx && AU.ctx.currentTime < SV.cur.end);
  // 말풍선 글로 말하기. still: (선택) 늦게 틀 때 아직 그 말이 화면에 있는지. 돌려줌: true = 재생 시작
  SV.say = function (text, still) {
    const id = SV.ids[text];
    if (!id) { SV.stats.miss++; return false; }
    const ctx = AU.ctx;
    if (!SV.on || GZ.Q.mute || AU.vol.sfx <= 0.001) { SV.stats.skipped++; return false; }
    if (!ctx || !SV.bufs[id] || ctx.state !== 'running') { SV.pend = { text, still, at: performance.now() }; SV.stats.skipped++; return false; }
    if (hjgBusy()) { SV.stats.yield++; return false; }
    const now = ctx.currentTime, buf = SV.bufs[id];
    if (SV.cur && now < SV.cur.end) { SV.stop(); SV.stats.cut++; }
    let src, g;
    try {
      src = ctx.createBufferSource(); src.buffer = buf; g = ctx.createGain(); g.gain.value = SV.VOL;
      src.connect(g); g.connect(AU.voiceBus || AU.out); src.start(now);
    } catch (e) { SV.err++; return false; }
    const end = now + buf.duration;
    SV.cur = { id, src, g, start: now, end };
    src.onended = () => { if (SV.cur && SV.cur.src === src) SV.cur = null; };
    if (AU.vduck) AU.vduck(buf.duration - 0.1);
    SV.stats.played++;
    SV.log.push({ id, ctxT: +now.toFixed(3), dur: +buf.duration.toFixed(3) });
    if (SV.log.length > 200) SV.log.shift();
    return true;
  };

  // 일시 정지 창 「비서 목소리」 줄 — 「허조교 목소리」 줄 아래에 붙임 (index.html 은 그대로, 누름은 hud.js act 'asvoice')
  SV.sync = function () { const b = document.getElementById('optAsVoice'); if (b) b.classList.toggle('on', SV.on); };
  (function addRow() {
    const ref = document.getElementById('optVoice'), row0 = ref && ref.closest('.row');
    if (!row0 || document.getElementById('optAsVoice')) return;
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<span>비서 목소리</span><button id="optAsVoice" class="tog" data-act="asvoice" aria-label="비서 그런트 목소리 켜기/끄기"><i></i></button>';
    row0.parentNode.insertBefore(row, row0.nextSibling);
    SV.sync();
  })();
})();
