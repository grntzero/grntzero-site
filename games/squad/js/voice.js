/* GRUNT ZERO RE — r9 허조교 실제 목소리 (대표 녹음 3개에서 고른 말 조각, assets/voice_hjg → js/pack_voice.js)
   · AudioContext 가 생기는 순간(첫 터치) 전부 미리 디코드해 둠 → 누른 그 순간(입력 처리 안에서) source.start(지금)
   · AAC 앞 여백: 디코드한 소리에서 실제 말 시작(−50dBFS 넘는 첫 자리)을 찾아 그 4ms 앞부터 재생 → 말 시작 전 여백 ≤ 10ms
   · 한 번에 한 마디: 새 말이 오면 앞 말을 짧게(시정수 4ms) 줄이고 30ms 뒤 멈춤. 더 중요한 말(전체 기상 > 차렷 > 구르기)이 나오는 중이면 덜 중요한 말은 건너뜀
   · 말하는 동안 음악 −6dB (AU.duck). 효과음 막대·소리 끄기(?mute)·「허조교 목소리」 끄기(저장 gzre_voice)를 따름 */
(function () {
  'use strict';
  const GZ = window.GZ, AU = GZ.AU;
  const VO = (GZ.VO = { bufs: {}, onset: {}, lead: {}, ready: false, loading: false, cur: null, log: [], lastT: {}, err: 0, stats: { played: 0, skipped: 0, cut: 0, blocked: 0, overlap: 0 } });
  // 이름: 파일(여럿이면 차례로 돌려 씀)·우선순위·같은 말 쿨다운(초)·음량
  // 대표 정정(11-13): 목소리는 「구르기」·「차렷!」·「전체 기상!」 세 버튼에만 (호각·시작·승리·패배·콤보엔 없음)
  const LINES = {
    roll: { files: ['rollA', 'rollB', 'rollC'], pri: 2, cd: 0, vol: 0.85 },   // 「구르기!」 — 누른 순간 바로, 짧게 (0.57~0.65초, 3개를 돌려 씀)
    att: { files: ['att'], pri: 3, cd: 0, vol: 1.0 },                         // 「차렷!」 — 누른 순간 시작, 「렷」이 발 쾅(0.13초)에
    ult: { files: ['ult'], pri: 5, cd: 0, vol: 1.0 },                         // 「전~체~ 기상!」 — 「상」이 터지는 순간(0.75초)에
  };
  VO.LINES = LINES;
  // 말 안의 「맞춰야 할 음절」 시각(초, 파일 처음부터 — tools/voice_cut.py 측정): 「전체 기상」의 「상」 모음 · 「차렷」의 「렷」
  VO.MARK = { ult: 0.74, att: 0.143 };
  VO.on = true;
  try { VO.on = localStorage.getItem('gzre_voice') !== '0'; } catch (e) { VO.on = true; }
  VO.setOn = function (v) { VO.on = !!v; try { localStorage.setItem('gzre_voice', VO.on ? '1' : '0'); } catch (e) { /* 저장 안 되는 곳 */ } if (!VO.on) VO.stop(); return VO.on; };
  const rot = {};

  function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  function findOnset(buf) {   // 실제 말 시작(초): 1ms 창 RMS 가 −50dBFS(0.00316)를 처음 넘는 자리
    const d = buf.getChannelData(0), w = Math.max(1, Math.round(buf.sampleRate * 0.001)), th = 0.00316 * 0.00316;
    for (let i = 0; i + w <= d.length; i += w) { let q = 0; for (let j = i; j < i + w; j++) q += d[j] * d[j]; if (q / w > th) return i / buf.sampleRate; }
    return 0;
  }
  VO.load = function () {
    const ctx = AU.ctx, src = window.GZVOICE;
    if (!ctx || !src || VO.loading) return;
    VO.loading = true;
    const names = Object.keys(src); let left = names.length;
    const done = () => { if (--left <= 0) { VO.ready = true; VO.readyAt = performance.now(); } };
    names.forEach((n) => {
      const ok = (buf) => { VO.bufs[n] = buf; const on = findOnset(buf); VO.onset[n] = Math.max(0, on - 0.004); VO.lead[n] = +((on - VO.onset[n]) * 1000).toFixed(1); done(); };
      const bad = () => { VO.err++; done(); };
      try { const p = ctx.decodeAudioData(b64(src[n]), ok, bad); if (p && p.catch) p.catch(() => {}); } catch (e) { bad(); }   // 옛 사파리는 콜백 방식만 됨
    });
  };
  VO.has = (name) => { const L = LINES[name]; return !!(L && L.files.some((f) => VO.bufs[f])); };
  // 합성 목소리(AU.voice)를 내도 되는가: 목소리 끄기면 안 됨, 실제 목소리가 있으면 그쪽이 이미 말했으므로 안 됨
  const SYN = { skill: 'att', ult: 'ult' };
  VO.synthOK = (name) => VO.on && !GZ.Q.mute && !VO.has(SYN[name] || name);
  VO.stop = function (t) {
    const c = VO.cur, ctx = AU.ctx; if (!c || !ctx) return;
    const now = t == null ? ctx.currentTime : t;
    if (now < c.end) { try { c.g.gain.cancelScheduledValues(now); c.g.gain.setTargetAtTime(0, now, 0.004); c.src.stop(now + 0.03); } catch (e) { /* 이미 멈춤 */ } c.end = now + 0.03; c.cutAt = now; }
    VO.cur = null;
  };
  // 말하기. 돌려줌: true = 재생 시작 / false = 안 함 (꺼짐·준비 전·쿨다운·더 중요한 말이 나오는 중)
  VO.say = function (name) {
    const L = LINES[name], ctx = AU.ctx;
    if (!L) return false;
    if (!VO.on || GZ.Q.mute || !ctx || ctx.state !== 'running' || AU.vol.sfx <= 0.001) { VO.stats.skipped++; return false; }
    const now = ctx.currentTime;
    if (L.cd && VO.lastT[name] != null && now - VO.lastT[name] < L.cd) { VO.stats.blocked++; return false; }
    const c = VO.cur;
    if (c && now < c.end - 0.04 && c.pri > L.pri) { VO.stats.blocked++; return false; }   // 더 중요한 말이 아직 나오는 중
    const fs = L.files.filter((f) => VO.bufs[f]); if (!fs.length) return false;
    const file = fs[(rot[name] = ((rot[name] || 0) + 1) % fs.length)], buf = VO.bufs[file];
    let cut = false;
    if (c && now < c.end) { VO.stop(now); cut = true; VO.stats.cut++; }
    let src, g;
    try {
      src = ctx.createBufferSource(); src.buffer = buf; g = ctx.createGain(); g.gain.value = L.vol;
      src.connect(g); g.connect(AU.voiceBus || AU.out);
      src.start(now, VO.onset[file]);
    } catch (e) { VO.err++; return false; }
    const end = now + buf.duration - VO.onset[file];
    // 겹침 검사: 앞 말이 아직 제 음량으로 남아 있으면(끊지 못했으면) 겹침
    if (c && !cut && now < c.end) VO.stats.overlap++;
    VO.cur = { name, file, src, g, pri: L.pri, start: now, end };
    src.onended = () => { if (VO.cur && VO.cur.src === src) VO.cur = null; };
    VO.lastT[name] = now; VO.stats.played++;
    AU.duck(end - now, 0.5);
    VO.log.push({ name, file, ctxT: +now.toFixed(4), perf: +performance.now().toFixed(2), off: +VO.onset[file].toFixed(4), lead: VO.lead[file], dur: +(end - now).toFixed(3), cutPrev: cut });
    if (VO.log.length > 200) VO.log.shift();
    return true;
  };
})();
