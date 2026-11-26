/* 톱니골 던전 — 소리: TG_AUDIO 샘플 + Web Audio 합성(말렛·밝은 신스·황동 클릭), 동시 재생 제한, 덕킹, BGM 크로스페이드, 음량 재기 */
(function () {
  'use strict';
  const TG = window.TG;
  const A = (TG.A = {
    ctx: null, buffers: {}, ready: false, vol: { bgm: 0.8, sfx: 0.9 }, active: 0, per: {}, curBgm: null, bgmName: null,
  });
  const LIMIT = { sfx_pop: 6, sfx_pick: 4, sfx_wave: 3, sfx_tick: 2, sfx_steam: 2, sfx_bonk: 2, sfx_big: 2, sfx_ui: 3, sfx_bossend: 1 };
  const MAX_VOICES = 22;
  const COMP = { threshold: -14, knee: 10, ratio: 4, attack: 0.004, release: 0.18 };

  // 미리 풀기: OfflineAudioContext 로 디코딩(사용자 입력 전에도 경고 없이 가능)
  A.preload = function () {
    if (!window.TG_AUDIO) return Promise.resolve();
    let off;
    try { off = new OfflineAudioContext(2, 44100, 44100); } catch (e) { return Promise.resolve(); }
    const names = Object.keys(window.TG_AUDIO);
    return Promise.all(names.map((n) => off.decodeAudioData(TG.b64ToBuf(window.TG_AUDIO[n])).then((b) => { A.buffers[n] = b; }).catch(() => {})))
      .then(() => { A.fillTempLoops(); A.ready = true; });
  };

  // ── 11-24 던전 배경 음악 임시 루프(코드 합성) ──
  // 던전표(js/dungeons.js music.floor)의 키가 TG_AUDIO 에 없을 때만 여기서 만들어 같은 키(A.buffers[키])에 넣음 → A.bgm(키)는 그대로.
  // 대표 곡이 오면 assets/audio/<키>.mp3 를 넣고 tools/pack_assets.py → 이 합성은 자동으로 건너뜀(A.tempUsed 에 안 남음). 소리 크기는 bgm_battle 의 RMS 에 맞춤.
  A.tempUsed = {};
  A.TEMP_LOOPS = {
    bgm_dome_sefo: { bpm: 126, bars: 8, make: domeSefoLoop }, // 세포 「메아리 체조 돔」 — 밝은 체조 시간(C 장조, 어린이 전체이용가)
    bgm_camp_gunner: { bpm: 116, bars: 8, make: campGunnerLoop }, // 11-24 허조교 「연병장 지하」 — 씩씩한 행진·구령 느낌(F 장조, 북·스네어 행진·황동 화음·구령 스탭). 대표 〈Boot Camp〉 오면 assets/audio/bgm_camp_gunner.mp3 만
    bgm_mirror_moshee: { bpm: 128, bars: 8, make: mirrorMosheeLoop }, // 11-24 모쉬 「거울 네온 미로」 — 네온 클럽·일렉 느낌(A 단조 파스텔, 쿵쿵 네 박·엇박 햇·아르페지오·패드). 대표 「moshi moshi」 오면 assets/audio/bgm_mirror_moshee.mp3 만
    bgm_hall_sseni: { bpm: 124, bars: 8, make: hallSseniLoop }, // 11-24 쎄니 「별빛 댄스홀」 — 반짝반짝 별빛 댄스(D 장조, 종소리 아르페지오·통통 베이스·박수). AI 음악팀 신곡 오면 assets/audio/bgm_hall_sseni.mp3 만
    bgm_orchard_berri: { bpm: 108, bars: 8, make: orchardBerriLoop }, // 11-24 베리 「베리 과수원」 — 상큼한 과수원(G 장조, 우쿨렐레 느낌 플럭·마림바 가락·셰이커). 신곡 오면 assets/audio/bgm_orchard_berri.mp3 만
    bgm_boss_cute: { bpm: 132, bars: 8, make: bossCuteLoop }, // 11-24 귀여운 보스(쎄니·베리 공통) — 밝은 보스 음악(C 장조, 신나는 네 박·밝은 화음·높은 종소리, 무섭지 않게). 곡 오면 assets/audio/bgm_boss_cute.mp3 만
    // 한 번 소리(sfx: true, sec 길이 — 크기는 sfx_bonk 최대치에 맞춤): 확대 연출 끝 효과음 자리(던전표 music.end)
    sfx_whistle_gunner: { sfx: true, sec: 1.1, make: whistleDrumSfx }, // 허조교: 호루라기 삑 + 북 한 번
    sfx_drop_moshee: { sfx: true, sec: 1.3, make: dropMosheeSfx }, // 모쉬: 자체 음원 드롭 1초 자리(저음 쿵 + 올라가는 반짝 + 화음 스탭)
    sfx_twinkle_sseni: { sfx: true, sec: 1.1, make: twinkleSseniSfx }, // 11-24 쎄니: 반짝 효과음(올라가는 종소리)
    sfx_maraca_berri: { sfx: true, sec: 1.0, make: maracaBerriSfx }, // 11-24 베리: 마라카스 샤카샤카 두 번 + 톡
    // 11-25 유니크 ★ 목소리 **임시 자리**(js/unique.js U.DEFS[].voice): 녹음(대표 「필승!」·허조교·모쉬·쎄니·베리 보호자, 각 1~1.5초·−15 LUFS)이 오면 assets/audio/uq_<id>.mp3 넣고 tools/pack_assets.py → 이 합성은 자동으로 건너뜀. 사람 목소리 합성 X — 짧은 「부름」 효과음(말렛 두 음 + 북/반짝) + 말풍선 자막
    uq_sefo: { sfx: true, sec: 0.8, make: uqCallSefo },     // 세포 「필승!」: 밝은 기합 두 음(C→G) + 북 둥 한 번(고함 X)
    uq_gunner: { sfx: true, sec: 0.8, make: uqCallGunner }, // 허조교 「전원 집합!」: 호루라기 짧게 두 번 + 말렛 한 음
    uq_moshee: { sfx: true, sec: 0.8, make: uqCallMoshee }, // 모쉬 「픽셀 폭죽!」: 픽셀 아르페지오 올라감 + 작은 쿵
    uq_sseni: { sfx: true, sec: 0.8, make: uqCallSseni },   // 쎄니 「보라 세상!」: 종소리 세 음(위로) + 반짝
    uq_berri: { sfx: true, sec: 0.8, make: uqCallBerri },   // 베리 「베리 비!」: 마림바 두 음 + 마라카스 톡톡
    uq_sefo_kids: { sfx: true, sec: 0.9, make: uqCallSefoKids }, // 11-26 세포 「세포키즈 출동!」(2번째 연출): 호루라기 삑 짧게 + 박수 둘 + 말렛 세 음 올라감(아이 목소리 X — 효과음만). 대표 녹음 오면 assets/audio/uq_sefo_kids.mp3
    sfx_kids_stomp: { sfx: true, sec: 0.6, make: kidsStompSfx },   // 11-26 세포키즈 다 같이 「쿵!」: 낮은 북 둥 + 박수 한 번 + 반짝
  };
  A.fillTempLoops = function () {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!AC) return;
    let target = 0.16; // 기준 RMS(bgm_battle 이 없을 때)
    const ref = A.buffers.bgm_battle; if (ref) target = rmsOf(ref.getChannelData(0)) || target;
    const refS = A.buffers.sfx_bonk, peakRef = refS ? peakOf(refS.getChannelData(0)) || 0.7 : 0.7; // 한 번 소리 기준 최대치
    for (const name in A.TEMP_LOOPS) {
      if (A.buffers[name]) continue; // 진짜 파일이 있으면 건너뜀
      try {
        const L = A.TEMP_LOOPS[name], sr = 44100, len = L.sfx ? Math.round(L.sec * sr) : Math.round((60 / L.bpm) * 4 * L.bars * sr);
        const off = new AC(2, len, sr), buf = off.createBuffer(2, len, sr);
        const l = buf.getChannelData(0), r = buf.getChannelData(1);
        L.make(l, r, sr, L.bpm || 120, L.bars || 1);
        if (L.sfx) { // 한 번 소리: 최대치만 기준 효과음에 맞춤(끝 0.05초 페이드)
          const g = (peakRef * 0.95) / (peakOf(l) || 1), fd = Math.round(0.05 * sr);
          for (let i = 0; i < len; i++) { const f = i > len - fd ? (len - i) / fd : 1; l[i] = Math.tanh(l[i] * g) * f; r[i] = Math.tanh(r[i] * g) * f; }
          A.buffers[name] = buf; A.tempUsed[name] = { sfx: true, sec: +(len / sr).toFixed(2), peak: +peakOf(l).toFixed(2), ref: +peakRef.toFixed(2) };
          continue;
        }
        // 크기 맞추기: RMS 를 기준에, 최대치 0.9 안
        const g = Math.min(target / (rmsOf(l) || 1), 0.9 / (peakOf(l) || 1));
        for (let i = 0; i < len; i++) { l[i] = Math.tanh(l[i] * g * 1.15); r[i] = Math.tanh(r[i] * g * 1.15); }
        A.buffers[name] = buf; A.tempUsed[name] = { bpm: L.bpm, bars: L.bars, sec: +(len / sr).toFixed(2), rms: +(20 * Math.log10(rmsOf(l))).toFixed(1), ref: +(20 * Math.log10(target)).toFixed(1) };
      } catch (e) { /* 합성 실패면 음악 없이(효과음은 그대로) */ }
    }
  };
  function rmsOf(d) { let q = 0; for (let i = 0; i < d.length; i++) q += d[i] * d[i]; return Math.sqrt(q / Math.max(1, d.length)); }
  function peakOf(d) { let m = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > m) m = v; } return m; }
  // 합성 도구(세포·허조교·모쉬 임시 루프·한 번 소리 공통). 전부 수식 — 난수는 잡음(shape 3)에만, 고정 시드(같은 소리)
  function synthKit(l, r, sr, seed0) {
    const N = l.length, NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
    let seed = seed0 || 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const add = (t0, dur, f, amp, shape, pan, dec, slide) => { // shape: 0 사인 1 삼각 2 사각(순한) 3 잡음 4 톱니(순한). slide = 끝 진동수(있으면 f→slide 로 미끄러짐)
      const i0 = Math.max(0, Math.round(t0 * sr)), n = Math.min(Math.round(dur * sr), N), pl = 0.5 - pan * 0.5, pr = 0.5 + pan * 0.5; let hp = 0, ph = 0;
      for (let i = 0; i < n; i++) { const idx = (i0 + i) % N, t = i / sr, env = Math.min(1, t / 0.006) * Math.exp(-t * dec);
        const fq = slide ? f + (slide - f) * (i / n) : f; ph += fq / sr;
        let v; if (shape === 3) { const w = rnd() * 2 - 1; v = w - hp; hp = w * 0.7 + hp * 0.3; } else if (shape === 2) { const s = Math.sin(ph * 6.2832); v = Math.tanh(s * 3) * 0.6; } else if (shape === 1) { const x = ph - Math.floor(ph); v = 1 - 4 * Math.abs(x - 0.5); } else if (shape === 4) { const x = ph - Math.floor(ph); v = (2 * x - 1) * 0.7; } else v = Math.sin(ph * 6.2832);
        v *= env * amp; l[idx] += v * pl; r[idx] += v * pr; }
    };
    const kick = (t, a) => { const i0 = Math.round(t * sr), g = a == null ? 0.9 : a; for (let i = 0; i < sr * 0.22; i++) { const tt = i / sr, v = Math.sin(6.2832 * (46 * tt + 120 / 28 * (1 - Math.exp(-tt * 28)))) * Math.exp(-tt * 11) * g; const idx = (i0 + i) % N; l[idx] += v; r[idx] += v; } };
    const clap = (t, a) => add(t, 0.13, 0, a == null ? 0.32 : a, 3, 0, 26);
    const hat = (t, a) => add(t, 0.05, 0, a, 3, 0.25, 70);
    const snare = (t, a) => { add(t, 0.16, 0, (a == null ? 0.3 : a) * 0.8, 3, 0, 22); add(t, 0.12, 190, (a == null ? 0.3 : a) * 0.5, 0, 0, 30, 150); }; // 행진 스네어(잡음 + 낮은 북 울림)
    const drum = (t, a) => { add(t, 0.4, 95, a == null ? 0.7 : a, 0, 0, 7, 70); add(t, 0.08, 0, (a == null ? 0.7 : a) * 0.3, 3, 0, 40); }; // 큰 북 둥
    return { N, NOTE, rnd, add, kick, clap, hat, snare, drum };
  }
  // 세포 돔 임시 루프: 쿵·짝 드럼 + 통통 베이스 + 밝은 화음 스탭 + 체조 멜로디(8마디). 전부 수식(난수는 hat 잡음에만, 고정 시드)
  function domeSefoLoop(l, r, sr, bpm, bars) {
    const beat = 60 / bpm, K = synthKit(l, r, sr, 7), NOTE = K.NOTE, add = K.add, kick = K.kick, clap = K.clap, hat = K.hat;
    // 코드 진행(8마디): C · F · G · C · Am · F · G · C  (밝은 체조 시간)
    const CH = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67], [57, 60, 64], [65, 69, 72], [67, 71, 74], [60, 64, 67]];
    const BASS = [48, 53, 55, 48, 45, 53, 55, 48];
    // 멜로디(8분음표 단위, 0 = 쉼) — 「다 같이 손 머리 위로」 느낌의 단순한 체조 가락
    const MEL = [
      72, 74, 76, 72, 76, 0, 79, 0,  77, 76, 74, 77, 76, 0, 72, 0,
      79, 79, 81, 79, 77, 76, 74, 0,  72, 74, 76, 74, 72, 0, 0, 0,
      69, 72, 76, 72, 69, 0, 76, 0,  77, 76, 74, 72, 74, 0, 0, 0,
      79, 79, 81, 83, 84, 0, 79, 0,  76, 79, 76, 74, 72, 0, 0, 0];
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = CH[b % CH.length];
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        kick(t); if (q === 1 || q === 3) clap(t);
        hat(t, 0.11); hat(t + beat / 2, 0.17);
        add(t, beat * 0.45, NOTE(BASS[b % 8]), 0.5, 2, 0, 5);              // 통통 베이스(박마다)
        if (q === 1 || q === 3) add(t + beat * 0.5, beat * 0.3, NOTE(BASS[b % 8] + 7), 0.3, 2, 0, 8);
        ch.forEach((n, k) => add(t + beat / 2, beat * 0.4, NOTE(n), 0.17, 1, (k - 1) * 0.5, 7)); // 화음 스탭(엇박)
      }
      for (let e = 0; e < 8; e++) { const m = MEL[(b * 8 + e) % MEL.length]; if (m) { const t = t0 + e * beat / 2; add(t, beat * 0.55, NOTE(m), 0.34, 1, 0.1, 4.5); add(t, beat * 0.3, NOTE(m + 12), 0.08, 0, -0.1, 9); } }
    }
  }
  // 11-24 허조교 「연병장 지하」 임시 루프(116 BPM·F 장조·8마디 ≈ 16.55초): 행진 북(둥·탁 스네어 롤) + 황동 느낌 화음(F·C·Dm·Bb) + 구령 스탭(4박마다 두 음 「하나! 둘!」 느낌) + 씩씩한 가락. 총·사격 소리 X
  function campGunnerLoop(l, r, sr, bpm, bars) {
    const beat = 60 / bpm, K = synthKit(l, r, sr, 11), NOTE = K.NOTE, add = K.add, snare = K.snare, drum = K.drum, hat = K.hat;
    const CH = [[65, 69, 72], [67, 72, 76], [62, 65, 69], [58, 62, 65], [65, 69, 72], [67, 72, 76], [60, 64, 67], [65, 69, 72]]; // F · C · Dm · Bb · F · C · C · F
    const BASS = [41, 43, 38, 46, 41, 43, 36, 41];
    const MEL = [ // 8분음표, 0 = 쉼 — 씩씩한 행진 가락(F 장조)
      65, 0, 65, 67, 69, 0, 69, 0,  72, 0, 69, 0, 67, 65, 67, 0,
      62, 0, 62, 65, 69, 0, 65, 0,  70, 0, 69, 67, 65, 0, 0, 0,
      65, 0, 65, 67, 69, 0, 72, 0,  74, 0, 72, 0, 69, 67, 69, 0,
      72, 72, 74, 76, 77, 0, 76, 0,  74, 72, 69, 67, 65, 0, 0, 0];
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = CH[b % CH.length];
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        if (q === 0 || q === 2) drum(t, q === 0 ? 0.75 : 0.5); // 둥 (1·3박)
        snare(t + beat / 2, q === 1 || q === 3 ? 0.34 : 0.2); if (q === 3) { snare(t + beat * 0.75, 0.16); snare(t + beat * 0.875, 0.12); } // 탁 + 4박 뒤 짧은 롤(행진)
        hat(t, 0.09); hat(t + beat / 2, 0.12);
        add(t, beat * 0.5, NOTE(BASS[b % 8]), 0.5, 2, 0, 4); // 튜바 느낌 베이스
        if (q === 0 || q === 2) ch.forEach((n, k) => add(t, beat * 0.9, NOTE(n), 0.14, 4, (k - 1) * 0.4, 3)); // 황동 화음(톱니파 순하게) 1·3박
        if (b % 2 === 1 && q === 3) { add(t, beat * 0.22, NOTE(ch[0] + 12), 0.3, 2, -0.3, 12); add(t + beat / 2, beat * 0.22, NOTE(ch[0] + 12), 0.3, 2, 0.3, 12); } // 구령 스탭 「하나! 둘!」 느낌(짧은 두 음)
      }
      for (let e = 0; e < 8; e++) { const m = MEL[(b * 8 + e) % MEL.length]; if (m) { const t = t0 + e * beat / 2; add(t, beat * 0.5, NOTE(m), 0.3, 1, 0.1, 5); add(t, beat * 0.3, NOTE(m - 12), 0.1, 0, -0.1, 7); } }
    }
  }
  // 11-24 모쉬 「거울 네온 미로」 임시 루프(128 BPM·A 단조 파스텔·8마디 = 15초): 네 박 쿵 + 엇박 햇 + 사이드체인 느낌 베이스 + 아르페지오 플럭(Am·F·C·G) + 부드러운 패드. 거슬리지 않게(센 쇳소리·급한 스윕 X)
  function mirrorMosheeLoop(l, r, sr, bpm, bars) {
    const beat = 60 / bpm, K = synthKit(l, r, sr, 23), NOTE = K.NOTE, add = K.add, kick = K.kick, hat = K.hat, clap = K.clap;
    const CH = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am · F · C · G
    const BASS = [45, 41, 48, 43, 45, 41, 48, 43];
    const ARP = [0, 1, 2, 1, 0, 2, 1, 2]; // 16분음표 아르페지오 순서(화음 안)
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = CH[b % CH.length];
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        kick(t, 0.85); hat(t + beat / 2, 0.16); if (q === 1 || q === 3) clap(t, 0.2);
        for (let s = 0; s < 2; s++) add(t + s * beat / 2 + beat * 0.08, beat * 0.4, NOTE(BASS[b % 8]), 0.46, 4, 0, 6); // 베이스(쿵 뒤에 살짝 — 사이드체인 느낌)
        for (let s = 0; s < 4; s++) { const n = ch[ARP[(q * 4 + s) % 8]] + 12; add(t + s * beat / 4, beat * 0.22, NOTE(n), 0.2, 1, Math.sin((q * 4 + s) * 1.3) * 0.5, 14); } // 반짝 아르페지오 플럭
        if (q === 0) ch.forEach((n, k) => add(t, beat * 3.9, NOTE(n), 0.07, 0, (k - 1) * 0.6, 0.6)); // 패드(길게·작게)
      }
      if (b % 4 === 3) for (let e = 0; e < 4; e++) add(t0 + beat * 2 + e * beat / 2, beat * 0.4, NOTE(ch[e % 3] + 24), 0.14, 0, 0, 8); // 4마디마다 높은 종소리 응답
    }
  }
  // 11-24 허조교 확대 연출 끝: 호루라기 삑(두 음 겹친 떨림, 0.35초) + 북 한 번(0.5초 뒤)
  function whistleDrumSfx(l, r, sr) {
    const K = synthKit(l, r, sr, 5), add = K.add, drum = K.drum;
    add(0.02, 0.36, 2240, 0.5, 0, 0, 2.5); add(0.02, 0.36, 2300, 0.35, 0, 0, 2.5); add(0.02, 0.36, 3350, 0.12, 0, 0, 3); // 삑(두 진동수 겹침 → 떨림)
    for (let i = 0; i < 6; i++) add(0.02 + i * 0.06, 0.05, 2240, 0.12, 0, 0, 30); // 혀 떨림 느낌
    drum(0.55, 0.9); add(0.55, 0.3, 60, 0.5, 0, 0, 8, 40); // 북 한 번(둥)
  }
  // 11-24 모쉬 확대 연출 끝: 드롭 1초 — 올라가는 반짝(0~0.45초) → 쿵(0.45초) + 화음 스탭 두 번(Am → C)
  function dropMosheeSfx(l, r, sr) {
    const K = synthKit(l, r, sr, 9), NOTE = K.NOTE, add = K.add, kick = K.kick, hat = K.hat;
    for (let i = 0; i < 8; i++) add(i * 0.055, 0.08, NOTE(72 + i * 2), 0.22, 1, (i % 2 ? 0.4 : -0.4), 20); // 올라가는 반짝
    kick(0.45, 1.0); add(0.45, 0.35, 55, 0.6, 0, 0, 7, 38); // 쿵(저음)
    [57, 60, 64].forEach((n, k) => add(0.46, 0.3, NOTE(n + 12), 0.2, 4, (k - 1) * 0.5, 6)); // Am 스탭
    [60, 64, 67].forEach((n, k) => add(0.78, 0.4, NOTE(n + 12), 0.2, 4, (k - 1) * 0.5, 5)); // C 스탭
    hat(0.6, 0.15); hat(0.78, 0.15); hat(0.95, 0.12);
  }

  // 11-24 쎄니 「별빛 댄스홀」 임시 루프(124 BPM·D 장조·8마디 ≈ 15.5초): 쿵·짝 + 반짝 종소리 아르페지오(D·G·Bm·A) + 통통 베이스 + 밝은 가락. 어린이 전체이용가 — 센 소리 X
  function hallSseniLoop(l, r, sr, bpm, bars) {
    const beat = 60 / bpm, K = synthKit(l, r, sr, 31), NOTE = K.NOTE, add = K.add, kick = K.kick, hat = K.hat, clap = K.clap;
    const CH = [[62, 66, 69], [67, 71, 74], [59, 62, 66], [57, 61, 64], [62, 66, 69], [67, 71, 74], [57, 61, 64], [62, 66, 69]]; // D · G · Bm · A · D · G · A · D
    const BASS = [38, 43, 35, 33, 38, 43, 33, 38];
    const MEL = [ // 8분음표, 0 = 쉼 — 별빛 댄스 가락(D 장조, 통통 튀게)
      74, 0, 78, 0, 81, 78, 74, 0,  79, 0, 78, 76, 74, 0, 0, 0,
      71, 0, 74, 0, 78, 74, 71, 0,  73, 0, 76, 73, 69, 0, 0, 0,
      74, 74, 78, 0, 81, 0, 86, 0,  83, 81, 79, 78, 76, 0, 0, 0,
      73, 0, 76, 0, 81, 0, 85, 0,  86, 0, 83, 0, 86, 0, 0, 0];
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = CH[b % CH.length];
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        kick(t, 0.75); if (q === 1 || q === 3) clap(t, 0.26);
        hat(t + beat / 2, 0.14); hat(t + beat * 0.75, 0.07);
        add(t, beat * 0.4, NOTE(BASS[b % 8]), 0.48, 2, 0, 6); add(t + beat / 2, beat * 0.3, NOTE(BASS[b % 8] + 12), 0.26, 2, 0, 9); // 통통 베이스(옥타브)
        for (let s2 = 0; s2 < 4; s2++) { const n = ch[(q + s2) % 3] + 24; add(t + s2 * beat / 4, beat * 0.3, NOTE(n), 0.13, 0, Math.sin((q * 4 + s2) * 1.7) * 0.6, 12); add(t + s2 * beat / 4, beat * 0.15, NOTE(n + 12), 0.04, 0, 0, 20); } // 반짝 종소리 아르페지오(글로켄)
        if (q === 0 || q === 2) ch.forEach((n, k) => add(t, beat * 0.9, NOTE(n), 0.12, 1, (k - 1) * 0.45, 4)); // 밝은 화음 1·3박
      }
      for (let e = 0; e < 8; e++) { const m = MEL[(b * 8 + e) % MEL.length]; if (m) { const t = t0 + e * beat / 2; add(t, beat * 0.5, NOTE(m), 0.3, 1, 0.1, 5); add(t, beat * 0.3, NOTE(m + 12), 0.07, 0, -0.1, 10); } }
    }
  }
  // 11-24 베리 「베리 과수원」 임시 루프(108 BPM·G 장조·8마디 ≈ 17.8초): 둥·셰이커 + 우쿨렐레 느낌 엇박 플럭(G·C·Em·D) + 마림바 가락 + 포근한 베이스. 상큼·포근하게(센 소리 X)
  function orchardBerriLoop(l, r, sr, bpm, bars) {
    const beat = 60 / bpm, K = synthKit(l, r, sr, 41), NOTE = K.NOTE, add = K.add, kick = K.kick, hat = K.hat;
    const CH = [[67, 71, 74], [72, 76, 79], [64, 67, 71], [62, 66, 69], [67, 71, 74], [72, 76, 79], [62, 66, 69], [67, 71, 74]]; // G · C · Em · D · G · C · D · G
    const BASS = [43, 48, 40, 38, 43, 48, 38, 43];
    const MEL = [ // 8분음표, 0 = 쉼 — 열매 익는 과수원 가락(G 장조, 마림바)
      79, 0, 78, 79, 83, 0, 0, 0,  81, 0, 79, 81, 84, 0, 0, 0,
      83, 0, 81, 79, 76, 0, 79, 0,  78, 0, 81, 0, 79, 0, 0, 0,
      79, 79, 0, 78, 79, 0, 83, 0,  84, 0, 83, 81, 79, 0, 0, 0,
      76, 0, 79, 0, 81, 0, 83, 0,  86, 0, 83, 0, 79, 0, 0, 0];
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = CH[b % CH.length];
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        if (q === 0 || q === 2) kick(t, 0.6); else add(t, 0.07, 0, 0.14, 3, 0.2, 60); // 둥(1·3박) · 셰이커(2·4박)
        hat(t + beat / 2, 0.09); add(t + beat * 0.75, 0.05, 0, 0.06, 3, -0.2, 70); // 셰이커 8분·16분
        add(t, beat * 0.5, NOTE(BASS[b % 8]), 0.42, 1, 0, 4); // 포근한 베이스
        ch.forEach((n, k) => add(t + beat / 2, beat * 0.35, NOTE(n + 12), 0.14, 1, (k - 1) * 0.5, 9)); // 우쿨렐레 느낌 엇박 플럭
        if (q === 0) ch.forEach((n, k) => add(t, beat * 3.5, NOTE(n), 0.05, 0, (k - 1) * 0.6, 0.8)); // 패드(길게·작게)
      }
      for (let e = 0; e < 8; e++) { const m = MEL[(b * 8 + e) % MEL.length]; if (m) { const t = t0 + e * beat / 2; add(t, beat * 0.45, NOTE(m), 0.28, 0, 0.1, 7); add(t, beat * 0.25, NOTE(m + 24), 0.06, 0, -0.1, 14); add(t, beat * 0.1, NOTE(m + 36), 0.03, 0, 0, 30); } } // 마림바(기음 + 배음 두 겹)
    }
  }
  // 11-24 귀여운 보스 임시 루프(쎄니·베리 공통, 132 BPM·C 장조·8마디 ≈ 14.5초): 신나는 네 박 쿵·짝 + 밝은 화음 스탭(C·G·Am·F) + 높은 종소리 가락 — 「밝은 보스 음악」(v8 11쪽), 낮게 으르렁 X
  function bossCuteLoop(l, r, sr, bpm, bars) {
    const beat = 60 / bpm, K = synthKit(l, r, sr, 53), NOTE = K.NOTE, add = K.add, kick = K.kick, hat = K.hat, clap = K.clap;
    const CH = [[60, 64, 67], [67, 71, 74], [57, 60, 64], [65, 69, 72], [60, 64, 67], [67, 71, 74], [65, 69, 72], [67, 71, 74]]; // C · G · Am · F · C · G · F · G
    const BASS = [48, 43, 45, 41, 48, 43, 41, 43];
    const MEL = [ // 8분음표 — 밝고 씩씩한 종소리 가락
      84, 0, 84, 86, 88, 0, 86, 84,  83, 0, 83, 84, 86, 0, 0, 0,
      81, 0, 84, 0, 88, 0, 84, 0,  86, 0, 84, 83, 81, 0, 0, 0,
      84, 0, 84, 86, 88, 0, 91, 0,  89, 88, 86, 84, 83, 0, 0, 0,
      81, 0, 84, 0, 89, 0, 88, 0,  86, 0, 84, 0, 86, 0, 0, 0];
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = CH[b % CH.length];
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        kick(t, 0.85); if (q === 1 || q === 3) clap(t, 0.3);
        hat(t + beat / 2, 0.15); hat(t + beat * 0.25, 0.07); hat(t + beat * 0.75, 0.09);
        add(t, beat * 0.3, NOTE(BASS[b % 8]), 0.5, 2, 0, 8); add(t + beat / 2, beat * 0.3, NOTE(BASS[b % 8]), 0.4, 2, 0, 8); // 쿵쿵 베이스(8분)
        ch.forEach((n, k) => add(t + beat / 2, beat * 0.3, NOTE(n + 12), 0.15, 1, (k - 1) * 0.5, 9)); // 밝은 화음 스탭(엇박)
      }
      for (let e = 0; e < 8; e++) { const m = MEL[(b * 8 + e) % MEL.length]; if (m) { const t = t0 + e * beat / 2; add(t, beat * 0.45, NOTE(m), 0.26, 1, 0.1, 6); add(t, beat * 0.25, NOTE(m - 12), 0.1, 0, -0.1, 7); } }
    }
  }
  // 11-24 쎄니 확대 연출 끝: 반짝 효과음(올라가는 종소리 D5·F#5·A5·D6 + 반짝 잔향 + 작은 글리산도)
  function twinkleSseniSfx(l, r, sr) {
    const K = synthKit(l, r, sr, 13), NOTE = K.NOTE, add = K.add;
    [74, 78, 81, 86].forEach((n, i) => { add(0.02 + i * 0.11, 0.5, NOTE(n), 0.42, 0, (i - 1.5) * 0.3, 6); add(0.02 + i * 0.11, 0.25, NOTE(n + 12), 0.12, 0, 0, 12); });
    for (let i = 0; i < 10; i++) add(0.46 + i * 0.045, 0.12, NOTE(86 + (i % 3) * 3), 0.1, 0, (i % 2 ? 0.5 : -0.5), 18); // 반짝 잔향
    add(0.5, 0.45, NOTE(90), 0.18, 0, 0, 5, NOTE(98)); // 작은 글리산도(위로)
  }
  // 11-24 베리 확대 연출 끝: 마라카스 샤카샤카 두 번(잡음 짧게 4번) + 톡(나무 소리)
  function maracaBerriSfx(l, r, sr) {
    const K = synthKit(l, r, sr, 17), add = K.add;
    [0.02, 0.15, 0.36, 0.49].forEach((t, i) => { add(t, 0.09, 0, i % 2 ? 0.4 : 0.55, 3, i < 2 ? -0.3 : 0.3, 38); add(t + 0.01, 0.05, 0, 0.2, 3, 0, 60); }); // 샤카·샤카 ×2
    add(0.78, 0.12, 980, 0.6, 0, 0, 34, 620); add(0.78, 0.06, 0, 0.25, 3, 0, 70); // 톡(나무)
  }

  // 11-25 유니크 ★ 임시 「부름」 소리 5개(0.8초, 녹음 전 자리 — 위 TEMP_LOOPS 주석)
  function uqCallSefo(l, r, sr) { const K = synthKit(l, r, sr, 21), NOTE = K.NOTE, add = K.add, drum = K.drum;
    add(0.0, 0.22, NOTE(72), 0.5, 1, -0.2, 9); add(0.0, 0.22, NOTE(72) * 2.003, 0.1, 2, 0, 12); add(0.2, 0.3, NOTE(79), 0.55, 1, 0.2, 7); add(0.2, 0.3, NOTE(79) * 2.003, 0.1, 2, 0, 10); drum(0.42, 0.8); }
  function uqCallGunner(l, r, sr) { const K = synthKit(l, r, sr, 22), NOTE = K.NOTE, add = K.add;
    [0.0, 0.16].forEach((t) => { add(t, 0.11, 2240, 0.45, 0, 0, 14); add(t, 0.11, 2300, 0.3, 0, 0, 14); for (let i = 0; i < 3; i++) add(t + i * 0.035, 0.03, 2240, 0.1, 0, 0, 40); });
    add(0.36, 0.35, NOTE(67), 0.45, 0, -0.1, 7); add(0.36, 0.08, NOTE(67) * 4, 0.12, 0, 0, 30); }
  function uqCallMoshee(l, r, sr) { const K = synthKit(l, r, sr, 23), NOTE = K.NOTE, add = K.add, kick = K.kick;
    for (let i = 0; i < 6; i++) add(i * 0.06, 0.1, NOTE(69 + i * 3), 0.25, 2, (i % 2 ? 0.4 : -0.4), 16); kick(0.4, 0.7); add(0.42, 0.3, NOTE(81), 0.3, 2, 0, 8); add(0.42, 0.3, NOTE(88), 0.2, 2, 0, 8); }
  function uqCallSseni(l, r, sr) { const K = synthKit(l, r, sr, 24), NOTE = K.NOTE, add = K.add;
    [74, 78, 81].forEach((n, i) => { add(i * 0.14, 0.4, NOTE(n), 0.4, 0, (i - 1) * 0.35, 6); add(i * 0.14, 0.12, NOTE(n) * 4, 0.1, 0, 0, 24); }); for (let i = 0; i < 5; i++) add(0.45 + i * 0.05, 0.06, NOTE(93 + i * 2), 0.12, 0, (i % 2 ? 0.5 : -0.5), 30); }
  function uqCallSefoKids(l, r, sr) { const K = synthKit(l, r, sr, 26), NOTE = K.NOTE, add = K.add;
    add(0.0, 0.1, 2240, 0.4, 0, 0, 16); add(0.0, 0.1, 2300, 0.25, 0, 0, 16); for (let i = 0; i < 3; i++) add(i * 0.03, 0.03, 2240, 0.08, 0, 0, 40); // 호루라기 삑
    [0.16, 0.28].forEach((t, i) => { add(t, 0.07, 0, 0.42, 3, i ? 0.35 : -0.35, 45); add(t + 0.01, 0.04, 0, 0.2, 3, 0, 70); }); // 박수 둘
    [72, 76, 79].forEach((n, i) => { add(0.4 + i * 0.12, 0.3, NOTE(n), 0.45, 1, (i - 1) * 0.3, 8); add(0.4 + i * 0.12, 0.3, NOTE(n) * 2.003, 0.1, 2, 0, 12); }); } // 말렛 세 음 올라감
  function kidsStompSfx(l, r, sr) { const K = synthKit(l, r, sr, 27), NOTE = K.NOTE, add = K.add, drum = K.drum;
    drum(0.0, 1.0); add(0.0, 0.25, NOTE(36), 0.5, 1, 0, 10); add(0.02, 0.07, 0, 0.45, 3, 0, 45); add(0.03, 0.04, 0, 0.2, 3, 0.2, 70); // 둥 + 박수
    for (let i = 0; i < 4; i++) add(0.18 + i * 0.05, 0.08, NOTE(91 + i * 2), 0.14, 0, (i % 2 ? 0.5 : -0.5), 28); } // 반짝
  function uqCallBerri(l, r, sr) { const K = synthKit(l, r, sr, 25), NOTE = K.NOTE, add = K.add;
    add(0.0, 0.3, NOTE(72), 0.5, 0, -0.2, 8); add(0.0, 0.07, NOTE(72) * 4, 0.15, 0, 0, 30); add(0.18, 0.35, NOTE(76), 0.5, 0, 0.2, 7); add(0.18, 0.07, NOTE(76) * 4, 0.15, 0, 0, 30);
    [0.42, 0.52].forEach((t, i) => { add(t, 0.08, 0, 0.4, 3, i ? 0.3 : -0.3, 40); add(t + 0.01, 0.05, 0, 0.18, 3, 0, 60); }); }

  function makeComp(ctx) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = COMP.threshold; comp.knee.value = COMP.knee; comp.ratio.value = COMP.ratio; comp.attack.value = COMP.attack; comp.release.value = COMP.release;
    return comp;
  }

  A.makeComp = makeComp;   // 11-14 비서 목소리 크기 시험(TG.SV.measure)이 같은 압축기를 씀

  // 첫 터치/키 때 열기
  A.unlock = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended' && !A.paused) A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.master = ctx.createGain(); A.master.gain.value = TG.Q.mute ? 0 : 1;
    const comp = makeComp(ctx);
    A.master.connect(comp); comp.connect(ctx.destination);
    A.bgmBus = ctx.createGain(); A.bgmBus.gain.value = 0.5 * A.vol.bgm; // -6dB
    A.duckG = ctx.createGain(); A.duckG.gain.value = 1;
    // 11-14 비서 목소리: 쎌이 말하는 동안 음악·효과음을 살짝 낮추는 마디(A.vduck) + 목소리 버스(효과음 막대를 따름)
    A.vduckM = ctx.createGain(); A.vduckS = ctx.createGain();
    A.bgmBus.connect(A.duckG); A.duckG.connect(A.vduckM); A.vduckM.connect(A.master);
    A.sfxBus = ctx.createGain(); A.sfxBus.gain.value = A.vol.sfx;
    A.sfxBus.connect(A.vduckS); A.vduckS.connect(A.master);
    A.voiceBus = ctx.createGain(); A.voiceBus.gain.value = A.vol.sfx * A.VOICE_GAIN; A.voiceBus.connect(A.master);
    if (A.pendingBgm) { const p = A.pendingBgm; A.pendingBgm = null; A.bgm(p.name, p.fade, p.loop); }
  };

  A.setVol = function (bgm, sfx) {
    A.vol.bgm = bgm; A.vol.sfx = sfx;
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.bgmBus.gain.setTargetAtTime(0.5 * bgm, t, 0.05);
    A.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
    if (A.voiceBus) A.voiceBus.gain.setTargetAtTime(sfx * A.VOICE_GAIN, t, 0.05);
  };
  A.VOICE_GAIN = 0.32;   // 11-14 비서 쎌 목소리 크기(효과음 막대 × 이 값) — tools/test_assist_voice 「비서 목소리 크기」(가장 센 0.3초가 0.25초 넘는 효과음 중앙값보다 3~6dB 크게)
  // 11-14 비서 목소리 더킹: dur 초 동안 음악 m(기본 0.5 = −6dB)·효과음 k(기본 0.7 ≈ −3dB), 끝나면 0.25초에 걸쳐 돌아옴
  A.vduck = function (dur, m, k) {
    if (!ok() || !A.vduckM) return;
    const t = A.ctx.currentTime;
    [[A.vduckM.gain, m == null ? 0.5 : m], [A.vduckS.gain, k == null ? 0.7 : k]].forEach(([g, v]) => {
      try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(v, t, 0.03); g.setTargetAtTime(1, t + Math.max(0.05, dur), 0.08); } catch (e) { g.value = 1; }
    });
  };
  A.vduckLevel = () => (A.vduckM ? [A.vduckM.gain.value, A.vduckS.gain.value] : [1, 1]);

  function ok() { return A.ctx && A.ctx.state !== 'closed'; }

  A.play = function (name, o) {
    if (!ok()) return;
    const buf = A.buffers[name]; if (!buf) return;
    o = o || {};
    const lim = LIMIT[name] || 3;
    if ((A.per[name] || 0) >= lim || A.active >= MAX_VOICES) return;
    const ctx = A.ctx, src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.gain != null ? o.gain : 1;
    src.connect(g);
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = TG.clamp(o.pan, -1, 1); g.connect(p); p.connect(A.sfxBus); }
    else g.connect(A.sfxBus);
    A.per[name] = (A.per[name] || 0) + 1; A.active++;
    src.onended = () => { A.per[name]--; A.active--; };
    src.start(ctx.currentTime + (o.delay || 0));
  };

  // ── 합성 도구 (ctx·나갈 곳·시작 시각을 받아 실제 재생과 음량 재기에 똑같이 씀) ──
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(ctx, out, t, type, f0, f1, glide, a, peak, d) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    const g = ctx.createGain(); env(g, t, a, peak, d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.03);
    return o;
  }
  const noiseMap = new WeakMap();
  function noise(ctx) {
    let b = noiseMap.get(ctx);
    if (b) return b;
    const n = Math.floor(ctx.sampleRate * 0.25); b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    let s = 987654321; // 고정 잡음(재기 결과가 매번 같게)
    for (let i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 2147483648 - 1); }
    noiseMap.set(ctx, b);
    return b;
  }
  // 황동 클릭: 짧은 대역 잡음 + 금속 공명
  function click(ctx, out, t, f, peak, d) {
    const src = ctx.createBufferSource(); src.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 7;
    const g = ctx.createGain(); env(g, t, 0.001, peak, d || 0.04);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + (d || 0.04) + 0.03);
    tone(ctx, out, t, 'sine', f * 0.56, 0, 0, 0.001, peak * 0.35, (d || 0.04) * 2.5);
  }
  // 말렛(마림바·실로폰 느낌): 기본음 + 4배음 짧게 + 톡
  function mallet(ctx, out, t, f, peak, d) {
    tone(ctx, out, t, 'sine', f, 0, 0, 0.003, peak, d || 0.32);
    tone(ctx, out, t, 'sine', f * 4, 0, 0, 0.002, peak * 0.3, (d || 0.32) * 0.22);
    tone(ctx, out, t, 'triangle', f * 2, 0, 0, 0.002, peak * 0.18, (d || 0.32) * 0.5);
  }
  // 밝은 신스: 세모 + 살짝 어긋난 네모
  function bright(ctx, out, t, f, peak, d) {
    tone(ctx, out, t, 'triangle', f, 0, 0, 0.006, peak, d);
    tone(ctx, out, t, 'square', f * 2.003, 0, 0, 0.006, peak * 0.16, d * 0.7);
  }

  const SYN = (A.SYN = {});
  // 소리 파동: 짧은 톱니파 스윕 + 필터
  SYN.wave = function (ctx, out, t, o) {
    const level = o.level || 0;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const f0 = 180 + level * 40, f1 = 520 + level * 160;
    osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + 0.09); osc.frequency.exponentialRampToValueAtTime(f0 * 1.3, t + 0.2);
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.setValueAtTime(f0 * 0.5, t); o2.frequency.exponentialRampToValueAtTime(f1 * 0.5, t + 0.1);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(3200 + level * 900, t + 0.07); lp.frequency.exponentialRampToValueAtTime(600, t + 0.22);
    const g = ctx.createGain(); env(g, t, 0.008, 0.11 + level * 0.04, 0.2 + level * 0.06);
    osc.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    osc.start(t); o2.start(t); osc.stop(t + 0.35 + level * 0.1); o2.stop(t + 0.35 + level * 0.1);
    return 0.4;
  };
  // 둘레 링이 커질 때: 단계별 상승 웅웅
  SYN.charge = function (ctx, out, t, o) {
    const base = [0, 196, 262, 349][o.level || 1] || 196;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.setValueAtTime(base * 0.8, t); osc.frequency.exponentialRampToValueAtTime(base, t + 0.12);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 2.005;
    const trem = ctx.createOscillator(); trem.frequency.value = 9; const tg = ctx.createGain(); tg.gain.value = 0.35;
    const g = ctx.createGain(); env(g, t, 0.03, 0.16, 0.42);
    const am = ctx.createGain(); am.gain.value = 0.7; trem.connect(tg); tg.connect(am.gain);
    osc.connect(am); o2.connect(am); am.connect(g); g.connect(out);
    [osc, o2, trem].forEach((n) => { n.start(t); n.stop(t + 0.5); });
    return 0.5;
  };
  SYN.pop = function (ctx, out, t, o) { // 퐁 (합성 층)
    const f = (o.big ? 420 : 720) * (o.up || 1) * (o.jit || 1);
    tone(ctx, out, t, 'sine', f * 1.6, f * 0.6, 0.09, 0.004, o.big ? 0.22 : 0.13, 0.1);
    return 0.15;
  };
  SYN.shout = function (ctx, out, t, o) { // 11-18 세포 확성기 짧은 외침 「야!」: 톱니파 모음 스윕(아~ → 야!) + 밴드패스 포먼트, 0.16초. 사람 목소리 녹음 X(합성)
    const level = (o && o.level) || 0;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200 + level * 20, t); osc.frequency.exponentialRampToValueAtTime(330 + level * 40, t + 0.05); osc.frequency.exponentialRampToValueAtTime(240 + level * 20, t + 0.16);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(1500, t + 0.05); bp.frequency.exponentialRampToValueAtTime(900, t + 0.16);
    const g = ctx.createGain(); env(g, t, 0.006, 0.42 + level * 0.08, 0.14);
    osc.connect(bp); bp.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.22);
    return 0.22;
  };
  SYN.hitSmall = function (ctx, out, t, o) { // 맞힘 톡
    tone(ctx, out, t, 'square', 900 * (o.jit || 1), 300, 0.05, 0.002, 0.07, 0.05);
    return 0.08;
  };
  SYN.thud = function (ctx, out, t, o) { // 11-25 타격감: 「퍽」 — 낮은 사인 떨어지는 쿵(150 → 48Hz) + 둔탁한 저역 잡음 한 점. 단계(lv 0~3)가 높을수록 조금 더 낮고 큼
    const lv = o.lv || 0, k = 1 + lv * 0.18;
    tone(ctx, out, t, 'sine', 150 / (1 + lv * 0.12), 48, 0.07, 0.003, 0.34 * k, 0.09 + lv * 0.02);
    const src = ctx.createBufferSource(); src.buffer = noise(ctx);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520 + lv * 120; lp.Q.value = 1.2;
    const g = ctx.createGain(); env(g, t, 0.002, 0.3 * k, 0.045);
    src.connect(lp); lp.connect(g); g.connect(out); src.start(t); src.stop(t + 0.09);
    return 0.14;
  };
  SYN.boom = function (ctx, out, t) { // 큰 소리 저음 쿵 + 화음 반짝
    tone(ctx, out, t, 'sine', 140, 38, 0.5, 0.01, 0.5, 0.6);
    [523, 659, 784, 1046].forEach((f, i) => tone(ctx, out, t + 0.05 + i * 0.05, 'triangle', f, 0, 0, 0.01, 0.07, 0.5));
    return 0.9;
  };
  let tock = 0;
  SYN.tick = function (ctx, out, t, o) { // 째깍 딸깍
    tock ^= 1; const gain = o.gain || 0.5;
    click(ctx, out, t, tock ? 4200 : 3300, 0.5 * gain, 0.04);
    tone(ctx, out, t, 'sine', tock ? 2350 : 1870, 0, 0, 0.001, 0.08 * gain, 0.12);
    return 0.15;
  };
  SYN.ui = function (ctx, out, t, o) { // 버튼: 짧은 방울 톡
    const f = 520 * (o.pitch || 1);
    tone(ctx, out, t, 'sine', f, f * 2.2, 0.06, 0.004, 0.22, 0.09);
    return 0.14;
  };
  SYN.cheer = function (ctx, out, t, o) { // 연속 보상 아르페지오
    const notes = [[523, 659, 784], [587, 740, 880, 1175], [659, 831, 988, 1319, 1568]][o.lv || 0] || [523, 659, 784];
    notes.forEach((f, i) => tone(ctx, out, t + i * 0.07, 'triangle', f, 0, 0, 0.005, 0.12, 0.28));
    return 0.7;
  };
  SYN.countBeep = function (ctx, out, t, o) {
    tone(ctx, out, t, 'square', o.hi ? 880 : 523, 0, 0, 0.005, 0.12, o.hi ? 0.45 : 0.18);
    return 0.5;
  };
  // ── V2 새 효과음 ──
  let stepAlt = 0;
  SYN.step = function (ctx, out, t) { // 걷기: 통통 낮은 말렛 + 살짝 톡
    stepAlt ^= 1;
    const f = stepAlt ? 196 : 233;
    tone(ctx, out, t, 'sine', f * 1.5, f, 0.04, 0.003, 0.15, 0.09);
    click(ctx, out, t, 1500, 0.07, 0.02);
    return 0.12;
  };
  SYN.levelUp = function (ctx, out, t) { // 레벨업: 말렛 도미솔도 + 반짝
    [523, 659, 784, 1047].forEach((f, i) => mallet(ctx, out, t + i * 0.075, f, 0.2, 0.35));
    bright(ctx, out, t + 0.3, 1568, 0.1, 0.4);
    return 0.8;
  };
  SYN.cardPick = function (ctx, out, t) { // 카드 고름: 황동 클릭 + 말렛 두 음
    click(ctx, out, t, 3000, 0.3, 0.03);
    mallet(ctx, out, t + 0.02, 784, 0.2, 0.2);
    mallet(ctx, out, t + 0.1, 1047, 0.22, 0.32);
    return 0.45;
  };
  SYN.bigReady = function (ctx, out, t) { // 큰 소리 준비: 밝은 신스 두 음 상승 + 반짝
    bright(ctx, out, t, 659, 0.18, 0.16);
    bright(ctx, out, t + 0.11, 988, 0.22, 0.34);
    tone(ctx, out, t + 0.2, 'sine', 1976, 2637, 0.12, 0.004, 0.08, 0.25);
    return 0.5;
  };
  SYN.bossIn = function (ctx, out, t) { // 보스 등장: 낮은 황동 부풂 + 둥 + 톱니 클릭
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(98, t); osc.frequency.exponentialRampToValueAtTime(73, t + 0.9);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.setValueAtTime(147, t); o2.frequency.exponentialRampToValueAtTime(110, t + 0.9);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(260, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.35); lp.frequency.exponentialRampToValueAtTime(320, t + 1.1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    osc.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    [osc, o2].forEach((n) => { n.start(t); n.stop(t + 1.25); });
    tone(ctx, out, t, 'sine', 110, 45, 0.4, 0.008, 0.45, 0.5);
    [0.5, 0.62, 0.74].forEach((d, i) => click(ctx, out, t + d, 2400 + i * 300, 0.2, 0.03));
    return 1.3;
  };
  SYN.bossPhase = function (ctx, out, t) { // 보스 단계 변화: 내려오는 말렛 셋 + 둥
    [880, 698, 523].forEach((f, i) => mallet(ctx, out, t + i * 0.08, f, 0.22, 0.3));
    tone(ctx, out, t + 0.02, 'sine', 160, 60, 0.3, 0.008, 0.35, 0.35);
    return 0.6;
  };
  SYN.rescue = function (ctx, out, t) { // 주민 구조: 통통 올라가는 말렛 + 고마워 짹
    [659, 784, 988, 1319].forEach((f, i) => mallet(ctx, out, t + i * 0.085, f, 0.2, 0.28));
    tone(ctx, out, t + 0.36, 'sine', 1319, 1760, 0.08, 0.004, 0.13, 0.16);
    return 0.7;
  };
  SYN.covered = function (ctx, out, t) { // 폭 덮임: 뿌우~ 내려가는 부드러운 소리 + 푹
    tone(ctx, out, t, 'triangle', 440, 150, 0.45, 0.01, 0.26, 0.5);
    tone(ctx, out, t + 0.04, 'sine', 330, 110, 0.45, 0.01, 0.16, 0.5);
    tone(ctx, out, t + 0.42, 'sine', 120, 55, 0.2, 0.006, 0.3, 0.25);
    return 0.8;
  };
  SYN.gruntHelp = function (ctx, out, t) { // 비서 그런트 도움: 태엽 감는 클릭(점점 빨리) + 올라가는 말렛
    let d = 0;
    for (let i = 0; i < 8; i++) { click(ctx, out, t + d, 2200 + i * 180, 0.22, 0.025); d += 0.09 - i * 0.008; }
    [523, 784, 1047].forEach((f, i) => mallet(ctx, out, t + d + i * 0.07, f, 0.22, 0.35));
    return 1.1;
  };
  SYN.shelter = function (ctx, out, t) { // 쉼터 진입: 포근한 차임 두 음 + 부드러운 바탕
    mallet(ctx, out, t, 523, 0.2, 0.6);
    mallet(ctx, out, t + 0.16, 784, 0.2, 0.7);
    tone(ctx, out, t, 'sine', 262, 0, 0, 0.08, 0.1, 0.8);
    return 0.95;
  };
  SYN.echo = function (ctx, out, t) { // 메아리 튕김: 통~ 통~ 통 (점점 작게)
    [0, 0.11, 0.22].forEach((d, i) => tone(ctx, out, t + d, 'sine', 620 * (1 + i * 0.06), 900 * (1 + i * 0.06), 0.07, 0.003, 0.24 * Math.pow(0.55, i), 0.12));
    click(ctx, out, t, 3600, 0.12, 0.02);
    return 0.4;
  };
  SYN.boing = function (ctx, out, t) { // 뽀잉: 닿았을 때 통 튀는 소리
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t); osc.frequency.exponentialRampToValueAtTime(620, t + 0.08); osc.frequency.exponentialRampToValueAtTime(300, t + 0.2); osc.frequency.exponentialRampToValueAtTime(420, t + 0.28);
    const g = ctx.createGain(); env(g, t, 0.005, 0.28, 0.3);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + 0.36);
    return 0.36;
  };
  SYN.shield = function (ctx, out, t) { // 보호 방울이 대신 톡
    tone(ctx, out, t, 'sine', 880, 1320, 0.06, 0.003, 0.2, 0.14);
    click(ctx, out, t, 4000, 0.12, 0.02);
    return 0.2;
  };

  let synthCount = 0;
  function synthOk() { return ok() && synthCount < 12; }
  // 합성 효과음 실제 재생
  A.syn = function (name, o) {
    if (!synthOk() || !SYN[name]) return;
    const dur = SYN[name](A.ctx, A.sfxBus, A.ctx.currentTime + ((o && o.delay) || 0), o || {});
    synthCount++; setTimeout(() => synthCount--, dur * 1000 + 50);
  };

  // ── 예전 이름 그대로 (다른 파일에서 부름) ──
  A.wave = function (level) {
    A.syn('wave', { level });
    A.play('sfx_wave', { rate: 1 + level * 0.08 + TG.fra(-0.04, 0.04), gain: 0.55 + level * 0.12 });
  };
  A.charge = function (level) { A.syn('charge', { level }); };
  A.pop = function (combo, big) { // 퐁: 피치 랜덤 ±, 연속일 때 점점 올라감
    if (!ok()) return;
    const up = 1 + Math.min(combo || 0, 24) * 0.022;
    A.play('sfx_pop', { rate: (big ? 0.8 : 1) * up * TG.fra(0.92, 1.1), gain: big ? 0.95 : 0.7 });
    A.syn('pop', { big, up, jit: TG.fra(0.9, 1.12) });
  };
  let pickChain = 0, lastPick = 0;
  A.pick = function () { // 줍기: 연속이면 반음씩 올라감 (소리 층만의 시계 — 규칙 계산과 무관)
    if (!ok()) return;
    const now = A.ctx.currentTime;
    pickChain = now - lastPick < 0.45 ? Math.min(pickChain + 1, 14) : 0;
    lastPick = now;
    A.play('sfx_pick', { rate: Math.pow(2, pickChain / 12), gain: 0.8 });
  };
  A.hitSmall = function () { A.syn('hitSmall', { jit: TG.fra(0.9, 1.1) }); };
  A.boom = function () { A.syn('boom'); };
  A.tick = function (gain) { A.syn('tick', { gain }); };
  A.ui = function (pitch) { A.syn('ui', { pitch }); };
  A.cheer = function (lv) { A.syn('cheer', { lv }); };
  A.countBeep = function (hi) { A.syn('countBeep', { hi }); };

  // 덕킹: 큰 소리 순간 BGM 낮춤
  A.duck = function (amt, dur) {
    if (!ok()) return;
    const t = A.ctx.currentTime, g = A.duckG.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(amt, t + 0.04);
    g.linearRampToValueAtTime(1, t + 0.04 + dur);
  };

  // BGM 크로스페이드
  A.bgm = function (name, fade, loop) {
    fade = fade == null ? 1 : fade; loop = loop !== false;
    if (!ok()) { A.pendingBgm = { name, fade, loop }; return; }
    if (A.bgmName === name) return;
    const ctx = A.ctx, t = ctx.currentTime;
    if (A.curBgm) {
      const old = A.curBgm;
      old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t);
      old.g.gain.linearRampToValueAtTime(0.0001, t + fade);
      old.src.stop(t + fade + 0.05);
    }
    A.curBgm = null; A.bgmName = name;
    const buf = A.buffers[name]; if (!buf) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fade));
    src.connect(g); g.connect(A.bgmBus); src.start(t);
    A.curBgm = { src, g };
  };
  A.stopBgm = function (fade) {
    A.pendingBgm = null;
    if (!ok() || !A.curBgm) { A.bgmName = null; return; }
    const t = A.ctx.currentTime, c = A.curBgm;
    c.g.gain.cancelScheduledValues(t); c.g.gain.setValueAtTime(c.g.gain.value, t); c.g.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.5));
    c.src.stop(t + (fade || 0.5) + 0.05);
    A.curBgm = null; A.bgmName = null;
  };
  A.pause = function (p) { A.paused = p; if (A.ctx) { if (p) A.ctx.suspend(); else A.ctx.resume(); } };

  // ── 음량 재기 (시험용): 효과음마다 실제와 같은 길(효과음 크기 → 컴프레서)로 따로 렌더해 최대 음량(dBFS)을 잼 ──
  // 게임에서 실제로 쓰는 크기(샘플은 재생 gain, 합성은 기본 인자)
  const USE = {
    sfx_pop: { gain: 0.7 }, sfx_pick: { gain: 0.8 }, sfx_wave: { gain: 0.55 }, sfx_steam: { gain: 0.6 }, sfx_bonk: { gain: 0.8 }, sfx_big: { gain: 1 }, sfx_bossend: { gain: 1 },
  };
  const SYN_USE = { wave: { level: 0 }, charge: { level: 1 }, tick: { gain: 0.5 }, countBeep: { hi: true } };
  // 11-14: 가장 센 0.3초 RMS (효과음·비서 목소리 크기를 같은 잣대로 비교)
  A.max300 = function (d, sr) {
    const w = Math.round(sr * 0.3), hop = Math.round(sr * 0.05); let best = 0;
    for (let i = 0; i + 1 <= d.length; i += hop) { let q = 0; const e = Math.min(d.length, i + w); for (let j = i; j < e; j++) q += d[j] * d[j]; best = Math.max(best, Math.sqrt(q / w)); }
    return best;
  };
  A.measure = function (sfxVol) {
    const sr = 44100, vol = sfxVol != null ? sfxVol : 0.9;
    const one = (label, kind, build) => {
      const off = new OfflineAudioContext(1, sr * 2, sr);
      const bus = off.createGain(); bus.gain.value = vol;
      const comp = makeComp(off); bus.connect(comp); comp.connect(off.destination);
      build(off, bus);
      return off.startRendering().then((buf) => {
        const d = buf.getChannelData(0); let peak = 0, sq = 0, n = 0;
        for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; if (v > 0.001) { sq += v * v; n++; } }
        const db = (v) => (v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -120);
        return { name: label, kind, peakDb: db(peak), rmsDb: db(n ? Math.sqrt(sq / n) : 0), ms: Math.round((n / sr) * 1000), max300Db: db(A.max300(d, sr)) };
      });
    };
    const jobs = [];
    Object.keys(SYN).forEach((name) => jobs.push(one(name, '합성', (ctx, bus) => SYN[name](ctx, bus, 0.05, SYN_USE[name] || {}))));
    Object.keys(USE).forEach((name) => {
      if (!A.buffers[name]) { jobs.push(Promise.resolve({ name, kind: '샘플', peakDb: -120, rmsDb: -120, ms: 0, missing: true })); return; }
      jobs.push(one(name, '샘플', (ctx, bus) => { const s = ctx.createBufferSource(); s.buffer = A.buffers[name]; const g = ctx.createGain(); g.gain.value = USE[name].gain; s.connect(g); g.connect(bus); s.start(0.05); }));
    });
    return Promise.all(jobs);
  };
})();
