// 소리: 곡 재생 + 「곡 시계」 + 효과음 합성(WebAudio). 게임의 모든 타이밍은 EK.AU.songTime() 하나만 봄.
(function () {
  const EK = window.EK;
  const AU = EK.AU = {
    ctx: null, master: null, mGain: null, sGain: null, bufs: {}, src: null, el: null, mode: 'none',
    t0: 0, held: false, heldPos: 0, resumeAt: 0, started: false, sim: EK.Q.has('sim'), simT: 0, mute: EK.Q.has('mute'),
    lat: 0, adj: 0, firstSound: -1, ended: false,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.connect(this.master);
      this.dGain = c.createGain(); this.dGain.connect(comp);   // r5: 목소리가 나올 때 곡을 살짝 낮춤(덕킹)
      this.mGain = c.createGain(); this.mGain.connect(this.dGain);
      this.sGain = c.createGain(); this.sGain.connect(comp);
      this.vGain = c.createGain(); this.vGain.connect(comp);   // r5: 목소리(효과음 크기·소리 끄기 설정을 따름)
      this.tGain = c.createGain(); this.tGain.gain.value = 0; this.tGain.connect(comp);   // 타이틀 화면의 작은 합성 반주
      this.applyVol();
      // 소리 없는 한 조각 — iOS 에서 소리 길 열기
      const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
    },
    unlock() { this.init(); if (this.ctx && this.ctx.state !== 'running' && !EK.paused) this.ctx.resume().catch(() => {}); },
    applyVol() {
      if (!this.ctx) return; const m = this.mute ? 0 : 1;
      this.mGain.gain.value = m * Math.pow(EK.save.volMusic / 100, 1.5) * 0.9;
      this.sGain.gain.value = m * Math.pow(EK.save.volSfx / 100, 1.5) * 0.5;
      this.vGain.gain.value = m * Math.pow(EK.save.volSfx / 100, 1.5) * 1.1;
      this._tVol = m * Math.pow(EK.save.volMusic / 100, 1.5) * 0.42; if (this._jg) this.tGain.gain.value = this._tVol;
      if (this.el) this.el.volume = m * EK.clamp(Math.pow(EK.save.volMusic / 100, 1.5) * 0.9, 0, 1);
    },
    // 곡 불러오기: http 면 통째로 풀어서(정확한 시계), file:// 처럼 fetch 가 안 되면 <audio> 로
    async load(st) {
      this.init();
      if (this.sim || !this.ctx) return 'sim';
      if (this.bufs[st.id]) return 'buffer';
      try {
        const r = await fetch(st.file); if (!r.ok) throw new Error('http ' + r.status);
        const ab = await r.arrayBuffer();
        this.stopMusic(); this.bufs = {};   // 한 곡만 풀어 둠(폰 메모리 아끼기)
        this.bufs[st.id] = await new Promise((ok, no) => this.ctx.decodeAudioData(ab, ok, no));
        // 브라우저마다 m4a 앞쪽 빈 조각(약 0.02초)을 다르게 풀어서, 「첫 소리가 나는 자리」로 맞춰 둠 (기준값 = 분석 때 잰 값)
        const d = this.bufs[st.id].getChannelData(0), sr = this.bufs[st.id].sampleRate; let fs = -1;
        for (let i = 0, n = Math.min(d.length, sr * 4); i < n; i++) if (d[i] > 0.02 || d[i] < -0.02) { fs = i / sr; break; }
        this.firstSound = fs; this.adj = (fs >= 0 && st.firstSound != null && Math.abs(fs - st.firstSound) < 0.06) ? fs - st.firstSound : 0;
        return 'buffer';
      } catch (e) {
        return await new Promise(ok => {
          const el = new Audio(); el.preload = 'auto'; el.src = st.file; this.els = this.els || {}; this.els[st.id] = el;
          let done = false; const fin = v => { if (!done) { done = true; ok(v); } };
          el.addEventListener('canplaythrough', () => fin('element'), { once: true });
          el.addEventListener('error', () => { delete this.els[st.id]; fin('silent'); }, { once: true });
          setTimeout(() => fin(el.readyState >= 2 ? 'element' : 'silent'), 6000); el.load();
        });
      }
    },
    // 소리 시계(ctx.currentTime)는 약 0.01초 단위로 뚝뚝 올라가서 그대로 쓰면 화면이 미세하게 덜컹거림
    // → 벽시계(performance.now)에 「소리 시계와의 차이」를 천천히 따라가게 얹어 매끈하게 읽음. 멈춤·다시 시작 때는 바로 다시 맞춤.
    now() {
      const p = performance.now() / 1000, c = this.ctx; if (!c) return p;
      if (c.state !== 'running') { this._off = null; return c.currentTime; }
      const off = c.currentTime - p;
      if (this._off == null || Math.abs(off - this._off) > 0.05) this._off = off; else this._off += (off - this._off) * 0.03;
      return p + this._off;
    },
    // 곡을 lead 초 뒤에 pos 초 지점부터 틀기(r8: 「다시 하기」는 앞 구간 처음부터). 그 전까지 songTime 은 pos 보다 작음(카운트).
    start(st, lead, pos) {
      pos = pos || 0; this._playAt = pos;
      this.stopMusic(); this.ended = false; this.held = false; this.started = true; this.cur = st;
      if (this.sim) { this.simT = pos - lead; this.mode = 'sim'; return; }
      const c = this.ctx; if (!c) { this.mode = 'none'; this.t0 = this.now() + lead - pos; return; }
      this.lat = EK.clamp((c.outputLatency || c.baseLatency || 0), 0, 0.25);
      const at = c.currentTime + lead;
      if (this.bufs[st.id]) { this.mode = 'buffer'; this.t0 = at - pos - (pos > 0 ? this.lat + this.adj : 0); this._play(at, pos > 0 ? Math.max(0, pos + this.lat + this.adj) : 0); if (pos <= 0) this.t0 = at; }
      else if (this.els && this.els[st.id]) {
        this.mode = 'element'; this.t0 = at - pos; const el = this.el = this.els[st.id]; el.currentTime = pos; this.applyVol();
        this._elTimer = setTimeout(() => { if (!EK.paused && !this.held) { el.play().catch(() => {}); } }, lead * 1000);
      } else { this.mode = 'silent'; this.t0 = at - pos; }
    },
    _play(when, pos) {
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.bufs[this.cur.id]; s.connect(this.mGain);
      s.onended = () => { if (this.src === s) { this.ended = true; } };
      s.start(when, pos); this.src = s;
    },
    stopMusic() {
      clearTimeout(this._elTimer);
      if (this.src) { try { this.src.onended = null; this.src.stop(); } catch (e) {} this.src = null; }
      if (this.el) { this.el.pause(); this.el = null; }
      this.started = false; this.held = false; this.resumeAt = 0;   // r8b: 멈춘 채로 끝나도 held 가 남지 않게
    },
    fadeOut(sec) {
      if (!this.ctx) return; const g = this.mGain.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + sec);
      if (this.el) { const el = this.el; setTimeout(() => el.pause(), sec * 1000); }
      setTimeout(() => { this.stopMusic(); this.applyVol(); }, sec * 1000 + 60);
    },
    // 지금 곡의 몇 초 지점이 「들리고」 있나
    songTime() {
      if (this.sim) return this.simT;
      if (this.held) {
        if (this.resumeAt && this.now() >= this.resumeAt) { this.held = false; this.resumeAt = 0; } else return this.heldPos;
      }
      if (this.mode === 'element' && this.el && !this.el.paused && this.el.currentTime > 0.05) {
        // <audio> 시계는 거칠어서, 정밀 시계에 맞춰 두고 많이 벌어질 때만 다시 맞춤
        const want = this.el.currentTime, have = this.now() - this.t0;
        if (Math.abs(want - have) > 0.07) this.t0 = this.now() - want;
      }
      return this.now() - this.t0 - (this.mode === 'buffer' ? this.lat + this.adj : 0);
    },
    simAdvance(dt) { if (!this.sim) return; if (this.held) { if (this.simResume > 0) { this.simResume -= dt; if (this.simResume <= 0) this.held = false; } } else this.simT += dt; },
    // 그대로 멈춰라: 곡을 그 자리에 세움 / 다시 이어 틀기
    hold() {
      if (this.held) return; this.heldPos = this.songTime(); this.held = true; this.resumeAt = 0; this.simResume = 0;
      if (this.sim) return;
      if (this.src) { const s = this.src; this.src = null; s.onended = null; try { s.stop(this.ctx.currentTime + 0.03); } catch (e) {} }
      if (this.el) this.el.pause();
    },
    release(delay) {
      if (!this.held) return;
      if (this.sim) { this.simResume = Math.max(delay, 1e-6); return; }
      const at = (this.ctx ? this.ctx.currentTime : this.now()) + delay; this.resumeAt = at; this.t0 = at - this.heldPos - (this.mode === 'buffer' ? this.lat + this.adj : 0);
      if (this.mode === 'buffer') this._play(at, Math.max(0, this.heldPos + this.lat + this.adj));
      else if (this.el) { const el = this.el; el.currentTime = Math.max(0, this.heldPos); clearTimeout(this._elTimer); this._elTimer = setTimeout(() => { if (!EK.paused) { this.held = false; this.resumeAt = 0; el.play().catch(() => {}); } }, delay * 1000); }
    },
    pause(on) {
      if (!this.ctx) return;
      if (on) { this.ctx.suspend(); if (this.el) this.el.pause(); }
      else { this.ctx.resume(); const st = this.songTime(); if (this.el && this.started && !this.held && st >= (this._playAt || 0) - 0.01) this.el.play().catch(() => {}); }   // r8b: songTime() 을 먼저 불러 재개 시각이 지났으면 held 를 풀고 틂(재개 0.35초 안에 멈춤 버튼 → 곡 안 나오던 것)
    },

    // ---------- r5 목소리: 짧은 대사 30개(js/pack_voice.js 에 묶음 — http·file:// 모두 바깥 요청 없이) ----------
    // 한 번에 한 마디만(겹치지 않게 줄 세움). 구령·멈춰라처럼 중요한 말(pri 2~3)은 덜 중요한 말을 끊고, 늦어진 말(칭찬 등)은 버림.
    VPRI: { freeze: 3, ready: 2, go: 2, count: 2, jump: 2, left: 2, right: 2, slide: 2, manse: 2, finish: 2, lose: 2, ice: 2, miss_stop: 2, moved: 2, retry_card: 2, good: 0, great: 0, match: 0, best: 0 },
    vo: {}, voQ: [], voCur: null, voLog: [], voPlayed: [],
    loadVoice() {
      if (this._voP) return this._voP;
      this._voP = (async () => {
        if (!EK.VOICE) await new Promise(ok => { const s = document.createElement('script'); s.src = 'js/pack_voice.js'; s.onload = s.onerror = ok; document.head.appendChild(s); });
        if (!EK.VOICE || !this.ctx) return 0;
        let n = 0;
        for (const k in EK.VOICE) { try { const bin = Uint8Array.from(atob(EK.VOICE[k]), c => c.charCodeAt(0)).buffer; this.vo[k] = await new Promise((ok, no) => this.ctx.decodeAudioData(bin, ok, no)); n++; } catch (e) {} }
        this.voN = n; return n;
      })();
      return this._voP;
    },
    voice(id, o) {
      o = o || {}; const pri = o.pri != null ? o.pri : (this.VPRI[id] != null ? this.VPRI[id] : 1);
      this.voLog.push(id); if (this.voLog.length > 300) this.voLog.shift();   // 시험용: 어떤 순간에 무슨 말을 하려 했는지(소리를 꺼도 남김)
      const c = this.ctx; if (this.sim || !c || this.mute || !EK.save.volSfx || !this.vo[id] || c.state !== 'running') return false;
      const it = { id, pri, at: c.currentTime, maxAge: o.maxAge != null ? o.maxAge : pri >= 2 ? 1.2 : pri === 1 ? 2.0 : 0.5 };
      if (o.cut) { this.voQ = []; this._voStop(); }
      else if (this.voCur && pri >= 2 && pri > this.voCur.pri) { this._voStop(); }   // 중요한 말이 오면 덜 중요한 말은 끊음
      if (this.voCur) { this.voQ = this.voQ.filter(q => q.id !== id); this.voQ.push(it); this.voQ.sort((a, b) => b.pri - a.pri || a.at - b.at); if (this.voQ.length > 3) this.voQ.length = 3; return true; }
      this._voPlay(it); return true;
    },
    _voPlay(it) {
      const c = this.ctx, s = c.createBufferSource(); s.buffer = this.vo[it.id]; s.connect(this.vGain);
      const t = c.currentTime; s.start(t); it.src = s; it.t0 = t; it.t1 = t + s.buffer.duration; this.voCur = it;
      this.voPlayed.push({ id: it.id, t0: +t.toFixed(3), t1: +it.t1.toFixed(3) }); if (this.voPlayed.length > 300) this.voPlayed.shift();
      const g = this.dGain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.62, t + 0.08);
      s.onended = () => { if (this.voCur !== it) return; this.voCur = null; this._voNext(); };
    },
    _voStop() { const it = this.voCur; if (!it) return; this.voCur = null; it.src.onended = null; try { it.src.stop(); } catch (e) {} const p = this.voPlayed[this.voPlayed.length - 1]; if (p && p.id === it.id) p.t1 = +this.ctx.currentTime.toFixed(3); },
    _voNext() {
      const c = this.ctx, t = c.currentTime;
      while (this.voQ.length) { const it = this.voQ.shift(); if (t - it.at <= it.maxAge) { this._voPlay(it); return; } }
      const g = this.dGain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1, t + 0.25);
    },
    voiceClear() { this.voQ = []; this._voStop(); if (this.ctx && this.dGain) { const t = this.ctx.currentTime, g = this.dGain.gain; g.cancelScheduledValues(t); g.setValueAtTime(1, t); } },

    // ---------- 효과음 (전부 합성, 작고 둥글게) ----------
    tone(f0, f1, dur, vol, type, delay, dest, abs) {
      const c = this.ctx; if (!c || this.sim || c.state !== 'running') return;
      const t = abs != null ? abs : c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sGain); o.start(t); o.stop(t + dur + 0.03);
    },
    // 타이틀·고르기 화면의 작은 반주(합성, 8마디 반복). 첫 손댐 뒤에만 남. 달리기 시작하면 꺼짐.
    jingle(on) {
      const c = this.ctx; if (!c || this.sim) return;
      if (!on) { if (this._jg) { clearInterval(this._jg); this._jg = null; const g = this.tGain.gain, t = c.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.25); } return; }
      if (this._jg || c.state !== 'running') return;
      const N = { C3: 130.81, F2: 87.31, G2: 98, A2: 110, G4: 392, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5 };
      const M = 'E5 - G5 - A5 G5 E5 - D5 - E5 - C5 - - - E5 - G5 - A5 C6 A5 - G5 - - - E5 - - - C6 - A5 - G5 E5 G5 - A5 - G5 - E5 - - - D5 E5 G5 - E5 D5 C5 - C5 - - - G4 - - -'.split(' ');
      const B = ['C3', 'G2', 'A2', 'F2', 'C3', 'A2', 'F2', 'C3'], step = 60 / 104 / 2;
      this._jn = 0; this._jt = c.currentTime + 0.12; const g = this.tGain.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0, c.currentTime); g.linearRampToValueAtTime(this._tVol || 0, c.currentTime + 0.6);
      this._jg = setInterval(() => {
        if (c.state !== 'running' || document.hidden) { this._jt = Math.max(this._jt, c.currentTime + 0.12); return; }
        if (this._jt < c.currentTime) this._jt = c.currentTime + 0.05;
        while (this._jt < c.currentTime + 0.4) { const i = this._jn % 64, m = M[i];
          if (m !== '-') this.tone(N[m], N[m], 0.26, 0.2, 'triangle', 0, this.tGain, this._jt);
          if (i % 4 === 0) this.tone(N[B[i >> 3]], N[B[i >> 3]], 0.34, 0.2, 'sine', 0, this.tGain, this._jt);
          this._jt += step; this._jn++; }
      }, 110);
    },
    noise(dur, vol, f0, f1, delay) {
      const c = this.ctx; if (!c || this.sim || c.state !== 'running') return;
      if (!this._nb) { const b = this._nb = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this._nb; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.sGain); s.start(t); s.stop(t + dur + 0.03);
    },
    sfx(name, a, delay) {
      const d = delay || 0;
      const P = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
      switch (name) {
        case 'orb': { const f = P[(a || 0) % 8]; this.tone(f, f * 1.5, 0.11, 0.16, 'sine', d); break; }   // d: 구슬의 박자 시각까지 남은 시간만큼 늦춰 예약
        case 'note': this.tone(880, 880, 0.1, 0.2, 'triangle', d); this.tone(1318.5, 1318.5, 0.2, 0.2, 'triangle', d + 0.08); break;
        case 'jump': this.tone(300, 620, 0.16, 0.16, 'sine'); break;
        case 'slide': this.noise(0.22, 0.14, 1800, 500); break;
        case 'move': this.tone(520, 640, 0.06, 0.07, 'sine'); break;
        case 'hit': this.tone(330, 150, 0.26, 0.22, 'sine'); this.tone(240, 300, 0.12, 0.12, 'triangle', 0.2); break;
        case 'pop': this.tone(420, 900, 0.12, 0.16, 'sine'); break;
        case 'boost': [0, 1, 2, 3, 5].forEach((n, i) => this.tone(P[n] , P[n], 0.22, 0.17, 'triangle', i * 0.07)); this.noise(0.6, 0.08, 500, 4000); break;
        case 'boostEnd': this.tone(880, 440, 0.3, 0.1, 'sine'); break;
        case 'tick': this.noise(0.05, 0.05, 5000, 6000); break;
        case 'good': this.tone(783.99, 783.99, 0.12, 0.2, 'triangle'); this.tone(1046.5, 1046.5, 0.22, 0.2, 'triangle', 0.09); break;
        case 'soft': this.tone(392, 330, 0.18, 0.1, 'sine'); break;
        case 'cue': this.tone(659.25, 659.25, 0.08, 0.1, 'sine'); break;
        case 'freeze': this.tone(700, 240, 0.4, 0.18, 'triangle'); break;
        case 'stop': this.tone(523.25, 523.25, 0.1, 0.18, 'triangle'); break;
        case 'win': [0, 2, 3, 5, 7].forEach((n, i) => this.tone(P[n], P[n], 0.3, 0.2, 'triangle', i * 0.1)); break;
        case 'click': this.tone(660, 880, 0.07, 0.12, 'sine'); break;
        case 'count': this.tone(a ? 1046.5 : 659.25, a ? 1046.5 : 659.25, a ? 0.3 : 0.12, 0.16, 'triangle'); break;
        case 'star': this.tone(1174.66, 1568, 0.25, 0.16, 'triangle'); break;
        // 쎌 등장 + 「세포 키즈! 그대로 멈춰라!」 박자를 흉내 낸 귀여운 삐약 소리(목소리 아님): 4음절 · 쉼 · 6음절
        case 'ssel': { this.tone(220, 760, 0.3, 0.14, 'sine'); if (this.vo.freeze) break;   // r5: 진짜 목소리가 있으면 삐약 흉내는 뺌
          const syl = [[0.34, 880, 0.09], [0.47, 990, 0.09], [0.60, 880, 0.09], [0.73, 1175, 0.16], [1.02, 784, 0.08], [1.14, 880, 0.08], [1.26, 784, 0.1], [1.44, 988, 0.09], [1.57, 1175, 0.09], [1.70, 1568, 0.3]];
          for (const s of syl) { this.tone(s[1], s[1] * 1.08, s[2], 0.17, 'triangle', s[0]); this.tone(s[1] * 2, s[1] * 2.1, s[2] * 0.7, 0.05, 'sine', s[0]); } break; }
        case 'hold': this.tone(392, 523.25, 0.14, 0.16, 'triangle'); break;
        case 'rest': this.tone(659.25, 523.25, 0.22, 0.14, 'sine'); this.tone(523.25, 392, 0.3, 0.14, 'sine', 0.2); break;
        case 'restEnd': this.tone(523.25, 523.25, 0.1, 0.16, 'triangle'); this.tone(783.99, 783.99, 0.2, 0.16, 'triangle', 0.1); break;
        case 'charge': this.tone(300, 1200, 0.45, 0.12, 'sine'); this.noise(0.45, 0.05, 600, 5000); break;
        case 'whistle': this.tone(2300, 2700, 0.16, 0.12, 'triangle'); this.tone(2600, 2100, 0.26, 0.11, 'triangle', 0.18); this.noise(0.4, 0.03, 2500, 3500); break;   // r8 쎌 호루라기 「삐익~」(짧고 귀엽게)
        case 'light': this.tone(a === 2 ? 880 : a === 1 ? 740 : 620, a === 2 ? 880 : a === 1 ? 740 : 620, 0.09, 0.12, 'triangle'); break;   // r8 신호등 점 초·노·빨
        case 'stopIn': this.tone(300, 520, 0.12, 0.16, 'sine'); this.tone(520, 520, 0.14, 0.12, 'triangle', 0.1); break;   // r8 빨간 버튼 「통」 나타남
        case 'ice': this.tone(1046.5, 1568, 0.18, 0.14, 'triangle'); this.tone(1568, 2093, 0.3, 0.1, 'sine', 0.12); this.noise(0.35, 0.04, 4000, 7000); break;   // r8 얼음 반짝
        case 'cheer': [3, 5, 7].forEach((n, i) => this.tone(P[n], P[n] * 1.06, 0.18, 0.13, 'triangle', i * 0.07)); this.noise(0.5, 0.06, 1500, 3500, 0.05); break;
      }
    },
  };
})();
