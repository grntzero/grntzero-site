/* 톱니골 던전 — 비서 쎌 목소리 (2026-11-14, 확정 목소리 ssel 「반짝 하이톤」(11-14 새 목소리, 옛 「쎌 B」 바꿈))
   · 말풍선 글과 똑같은 대사를 미리 만든 m4a(assets/assist_voice → js/pack_assist_voice.js, base64 묶음, 바깥 요청 0)로 틀어 줌
   · 소리가 켜지는 순간(첫 터치, TG.A.unlock) 전부 미리 디코드 → 말풍선이 뜨는 그 순간 재생
   · 한 번에 한 마디: 새 대사가 오면 앞 대사를 짧게 줄이고 멈춤
   · 말하는 동안 음악 −6dB·효과음 −3dB (TG.A.vduck). 효과음 막대·소리 끄기(?mute)·멈춤 창 「비서 목소리」(저장 tg_ssel_voice)를 따름
   · 글이 목록에 없으면 소리 없이 말풍선만 (SV.stats.miss) — 게임 규칙·숫자와 무관 */
(function () {
  'use strict';
  const TG = window.TG, A = TG.A;
  const SV = (TG.SV = { bufs: {}, ids: {}, ready: false, loading: false, cur: null, log: [], err: 0, stats: { played: 0, skipped: 0, miss: 0, cut: 0 } });
  const PK = window.TGASV || { lines: {}, data: {} };
  Object.keys(PK.lines).forEach((id) => { SV.ids[PK.lines[id]] = id; });
  SV.count = Object.keys(PK.data).length;
  SV.on = true;
  try { SV.on = localStorage.getItem('tg_ssel_voice') !== '0'; } catch (e) { SV.on = true; }
  SV.setOn = function (v) { SV.on = !!v; try { localStorage.setItem('tg_ssel_voice', SV.on ? '1' : '0'); } catch (e) { /* 저장 안 되는 곳 */ } if (!SV.on) SV.stop(); SV.sync(); return SV.on; };

  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  SV.load = function () {
    const ctx = A.ctx;
    if (!ctx || SV.loading) return;
    SV.loading = true;
    const ids = Object.keys(PK.data); let left = ids.length;
    if (!left) { SV.ready = true; return; }
    const done = () => { if (--left <= 0) SV.ready = true; };
    ids.forEach((id) => {
      const ok = (buf) => { SV.bufs[id] = buf; done(); };
      const bad = () => { SV.err++; done(); };
      try { const p = ctx.decodeAudioData(b64(PK.data[id]), ok, bad); if (p && p.catch) p.catch(() => {}); } catch (e) { bad(); }
    });
  };
  // 소리가 켜질 때 같이 디코드 (이미 켜져 있으면 바로)
  const unlock0 = A.unlock;
  A.unlock = function () { const r = unlock0.apply(this, arguments); if (A.ctx && !SV.loading) SV.load(); return r; };
  if (A.ctx) SV.load();

  SV.stop = function () {
    const c = SV.cur, ctx = A.ctx; if (!c || !ctx) return;
    const now = ctx.currentTime;
    if (now < c.end) { try { c.g.gain.cancelScheduledValues(now); c.g.gain.setTargetAtTime(0, now, 0.01); c.src.stop(now + 0.06); } catch (e) { /* 이미 멈춤 */ } A.vduck(0.06); }
    SV.cur = null;
  };
  // 말풍선 글로 말하기. 돌려줌: true = 재생 시작
  SV.say = function (text) {
    const id = SV.ids[text];
    if (!id) { SV.stats.miss++; return false; }
    const ctx = A.ctx;
    if (!SV.on || TG.Q.mute || !ctx || ctx.state !== 'running' || A.vol.sfx <= 0.001 || !SV.bufs[id]) { SV.stats.skipped++; return false; }
    const now = ctx.currentTime, buf = SV.bufs[id];
    if (SV.cur && now < SV.cur.end) { SV.stop(); SV.stats.cut++; }
    let src, g;
    try {
      src = ctx.createBufferSource(); src.buffer = buf; g = ctx.createGain(); g.gain.value = 1;
      src.connect(g); g.connect(A.voiceBus || A.master); src.start(now);
    } catch (e) { SV.err++; return false; }
    const end = now + buf.duration;
    SV.cur = { id, src, g, start: now, end };
    src.onended = () => { if (SV.cur && SV.cur.src === src) SV.cur = null; };
    A.vduck(buf.duration - 0.1);
    SV.stats.played++;
    SV.log.push({ id, ctxT: +now.toFixed(3), dur: +buf.duration.toFixed(3) });
    if (SV.log.length > 200) SV.log.shift();
    return true;
  };
  SV.speaking = () => !!(SV.cur && A.ctx && A.ctx.currentTime < SV.cur.end);
  // 시험용: 대사마다 실제와 같은 길(효과음 크기 × VOICE_GAIN → 압축기)로 따로 렌더해 음량을 잼 (A.measure 와 같은 방식)
  SV.measure = function (sfxVol) {
    const sr = 44100, vol = (sfxVol != null ? sfxVol : 0.9) * A.VOICE_GAIN;
    return Promise.all(Object.keys(SV.bufs).map((id) => {
      const b = SV.bufs[id], off = new OfflineAudioContext(1, Math.ceil(sr * (b.duration + 0.3)), sr);
      const bus = off.createGain(); bus.gain.value = vol;
      const comp = A.makeComp ? A.makeComp(off) : off.createGain(); bus.connect(comp); comp.connect(off.destination);
      const s = off.createBufferSource(); s.buffer = b; s.connect(bus); s.start(0.05);
      return off.startRendering().then((buf) => {
        const d = buf.getChannelData(0); let peak = 0, sq = 0, n = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.001) { sq += v * v; n++; } }
        const db = (v) => (v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -120);
        return { name: id, peakDb: db(peak), rmsDb: db(n ? Math.sqrt(sq / n) : 0), ms: Math.round(b.duration * 1000), max300Db: db(A.max300 ? A.max300(d, sr) : 0) };
      });
    }));
  };

  // 멈춤 창 「비서 목소리」 켜기/끄기 줄 — 「왼손잡이」 줄 아래에 붙임 (index.html 은 그대로)
  SV.sync = function () { const b = document.getElementById('optSselVoice'); if (b) b.classList.toggle('on', SV.on); };
  (function addRow() {
    const ref = document.getElementById('optLefty'), row0 = ref && ref.closest('.row');
    if (!row0 || document.getElementById('optSselVoice')) return;
    const row = document.createElement('label'); row.className = 'row';
    row.innerHTML = '<span>비서 목소리</span><button id="optSselVoice" class="tog" aria-label="비서 쎌 목소리 켜기/끄기"><i></i></button>';
    row0.parentNode.insertBefore(row, row0.nextSibling);
    // 줄 하나 늘어난 만큼 낮은 화면(가로 폰)에선 줄 간격을 조금 줄여 「계속하기」가 예전처럼 거의 보이게 (css 파일은 그대로)
    const st = document.createElement('style'); st.textContent = '@media (max-height: 460px) { #pause .row { padding: calc(1px * var(--s)) 0; } }'; document.head.appendChild(st);
    row.querySelector('button').addEventListener('click', (e) => { e.preventDefault(); A.unlock(); A.ui(1); SV.setOn(!SV.on); });
    SV.sync();
  })();
})();
