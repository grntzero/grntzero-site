// 스테이지(곡) 정보와 박자표 만들기. 시간은 전부 「곡이 흐른 시간(초)」 기준 — 화면 프레임 수로 세지 않음.
// 마디 k 의 시작 = offset + k*4*(60/bpm). BPM 은 tools/analyze2.py(librosa), 첫 박(offset)·첫 소리(firstSound)는 tools/beat_in_browser.py 로
// 「브라우저가 실제로 푼 소리」에서 잰 값. 원본 wav 의 박은 정확히 0.000초에 있고, m4a 로 바꾸며 약 0.025초 밀림(크롬 기준).
(function () {
  const EK = window.EK;
  EK.SPEED = 16;            // 1초에 가는 거리 (곡 시간에 묶임)
  EK.LANE = 1.7;            // 줄 사이 거리
  EK.CHARS = [
    { id: 'raon', name: '라온', sub: '모험 대장', play: true },
    { id: 'haeon', name: '해온', sub: '곧 만나요' },
    { id: 'sefo', name: '세포', sub: '곧 만나요' },
    { id: 'ssel', name: '쎌', sub: '곧 만나요' },
    { id: 'sseni', name: '쎄니', sub: '곧 만나요' },
    { id: 'berri', name: '베리', sub: '곧 만나요' },
    { id: 'kids', name: '세포키즈', sub: '곧 만나요' },
  ];
  // zones: 한 곡 안에서 풍경·조명이 바뀌는 자리(마디). tunnel: 바닷속 터널 구간(마디). mover: 움직이는 장애물이 꼭 한 번 나오는 구간.
  EK.STAGES = {
    town: {
      id: 'town', name: '어린이클럽 마을', sub: '세포체조', theme: 'town', gymName: '세포체조!',
      file: 'assets/audio/sefo_gym.m4a', title: '세포체조 (SEFO, Geeni)', bpm: 160, offset: 0.026, firstSound: 1.138, dur: 116.3,
      zones: [{ bar: 0, name: '마을' }, { bar: 26, name: '공원' }, { bar: 52, name: '무대 앞' }],
      moverName: '무당벌레',
      sections: [
        { type: 'intro', from: 2, to: 14, card: ['에너지 모으기!', '에너지 구슬을 모아요!', 'orb'] },
        { type: 'run', from: 14, to: 18, level: 1, card: ['달려라!', '장애물을 피해요', 'dodge'] },
        { type: 'gym', from: 18, to: 26 },
        { type: 'run', from: 26, to: 41, level: 1, mover: true, card: ['공원 길', '구슬 줄을 따라가요', 'orb'] },
        { type: 'run', from: 41, to: 52, level: 2 },   // r8: 마을 「꾹 누르기」 멈춰라는 뺌(대표 결정 11-13) — 멈춰라는 운동장에만
        { type: 'gym', from: 52, to: 60 },
        { type: 'run', from: 60, to: 70, level: 3, card: ['마지막 달리기!', '무대가 보여요', 'flag'] },
        { type: 'finale', from: 70, to: 73 },
      ],
    },
    ocean: {
      id: 'ocean', name: '바닷속 모험', sub: '베이비샤크 리믹스', theme: 'ocean', gymName: '상어 체조!',
      file: 'assets/audio/shark_festival.m4a', title: 'Baby Shark (Festival Mix) (SEFO, Geeni)', bpm: 150, offset: 0.024, firstSound: 0.471, dur: 136.0,
      zones: [{ bar: 0, name: '얕은 바다' }, { bar: 24, name: '산호 숲' }, { bar: 54, name: '반짝이는 깊은 바다' }],
      moverName: '꽃게',
      sections: [
        { type: 'intro', from: 1, to: 13, card: ['바닷속으로!', '물방울 에너지를 모아요', 'orb'] },
        { type: 'run', from: 13, to: 25, level: 1, mover: true, card: ['상어 친구랑 달려요', '산호를 피해요', 'dodge'] },
        { type: 'gym', from: 25, to: 33 },
        { type: 'run', from: 33, to: 43, level: 1, card: ['산호 숲 길', '구슬 줄을 따라가요', 'orb'] },   // r8: 바다 멈춰라 뺌(대표 결정 11-13)
        { type: 'run', from: 43, to: 57, level: 2, tunnel: [46, 54], card: ['바닷속 터널!', '반짝반짝 지나가요', 'tunnel'] },
        { type: 'gym', from: 57, to: 65 },
        { type: 'run', from: 65, to: 78, level: 3, card: ['마지막 달리기!', '상어 무대가 보여요', 'flag'] },
        { type: 'finale', from: 78, to: 81 },
      ],
    },
    // r8 「옛날 학교 운동장 ♪ 그대로 멈춰라」: 곡 = 그대로멈춰라_Extended(완성본 앞에 무보컬 인트로 10마디). 박 b 시각 = offset + b×(60/155).
    // 타이밍 근거: ../SEFO_KIDS_ENERGY_RUN_멈춰라분석/멈춰라_타이밍.json (완성본 박 + 40 = Extended 박). 줄 첫 박 B 에서 「그대로」 B+8 · 「멈」 B+10 · 「라」 B+12 · 끝 B+12.5
    // offset: tools/beat_in_browser.py 로 잰 값(브라우저가 푼 m4a 의 킥 격자 0.000 — json 의 0.0587 은 약 0.06초 늦은 값, 킥 어택은 0.000 격자에 맞음)
    school: {
      id: 'school', name: '옛날 학교 운동장', sub: '그대로 멈춰라', theme: 'school', gymName: null,
      file: 'assets/audio/freeze_song.m4a', title: '그대로 멈춰라 (feat. 미지니) (SEFO, moshee, Geeni)', bpm: 155, offset: 0.0, firstSound: 0.4866, dur: 116.1,
      zones: [{ bar: 0, name: '운동장' }, { bar: 30, name: '놀이터 옆' }, { bar: 54, name: '구령대 앞' }],
      moverName: '큰 박 공',
      // 멈춰라 신호: line = 그 줄(16박)의 첫 박(Extended). r8d(대표 실기 11-14): 곡 안 「그대로 멈춰라」 6곳(F0~F5) + 「움직이지 마!」 2곳(M1·M2) **전부 세 난이도 같은 자리**.
      //   「그대로 멈춰라」: 「그대로」 B+8 · 「멈」 B+10 · 「라」 끝 B+12.5.  「(울지도 말고) 움직이지 마!」: sh 2 = 박을 2박 뒤로 — 「말고」 B+10(신호등) · 「움」 B+12 · 「마!」 B+14 · 끝 B+14.5
      //   (보컬 스템 음절 시작점으로 잰 값: 「움」 40.23·102.17초, 「마」 41.01·102.95초, 「마!」 끝 41.24·103.17초 — ../SEFO_KIDS_ENERGY_RUN_멈춰라분석/멈춤가사_r8d.json)
      //   guide = 쉬움에서는 「안내만(감점 X)」: r8 때 쉬움에서 뺐던 F1·F3 와 새 M1·M2 — 쉬움 1절에 멈춤이 4번 몰려(20초 안) 하트가 빨리 닳지 않게. 쉬움 감점 자리는 전과 같은 F2·F4·F5
      cues: [{ id: 'F0', line: 60, practice: true, text: '그대로 멈춰라' }, { id: 'F1', line: 76, guide: true, text: '그대로 멈춰라' }, { id: 'M1', line: 92, sh: 2, guide: true, text: '움직이지 마' }, { id: 'F2', line: 108, text: '그대로 멈춰라' },
        { id: 'F3', line: 220, guide: true, text: '그대로 멈춰라' }, { id: 'F4', line: 236, text: '그대로 멈춰라' }, { id: 'M2', line: 252, sh: 2, guide: true, text: '움직이지 마' }, { id: 'F5', line: 268, text: '그대로 멈춰라' }],
      sections: [
        { type: 'intro', from: 0, to: 12, card: ['에너지 모으기!', '에너지 구슬을 모아요!', 'orb'] },                           // 무보컬 인트로(15마디) 안에서 연습 12마디
        { type: 'verse', from: 12, to: 30, card: ['그대로 멈춰라!', '빨간 손바닥 버튼을 톡!', 'stop'] },   // 1절: F0·F1·M1·F2 (r8d: 멈춰라는 구간과 상관없이 st.cues 로만 — 드롭·후렴에 걸쳐도 빠지지 않음)
        { type: 'run', from: 30, to: 38, level: 1, mover: true, card: ['달려라!', '장애물을 피해요', 'dodge'] },                // 드롭 1
        { type: 'verse', from: 38, to: 46, dense: true, card: ['멈추지 말아요!', '계속 달려요!', 'orb'] },                     // 후렴 「멈추지 말아요」: 버튼 없음, 구슬 줄 따라 계속
        { type: 'run', from: 46, to: 54, level: 2, card: ['한 번 더 달려라!', '장애물을 피해요', 'dodge'] },                 // 드롭 2
        { type: 'verse', from: 54, to: 70, card: ['그대로 멈춰라!', '빨간 손바닥 버튼을 톡!', 'stop'] },   // 2절: F3·F4·M2·F5
        { type: 'finale', from: 71, to: 74 },                                                                              // 아웃트로 → 구령대 앞 결승
      ],
    },
  };
  // 보통 난이도(2026-11-13 대표 지시 「보통 난이도도 있으면 좋을 것 같아」): 쉬움·보통·도전 3단계. 값은 한 표에 모음.
  //   멈춰라(운동장) 값은 ../SEFO_KIDS_ENERGY_RUN_멈춰라분석/확정기획_v1.md 의 「보통」 그대로(B+10~14·조용히 2.5초·6번·움직이면 −1·하트 구슬 없음·다시 하기 = 앞 구간),
  //   문서에 없는 값은 쉬움과 도전의 중간(작업보고 「보통 난이도」 절 표). 속도(EK.SPEED)는 곡 박자에 묶여 세 난이도가 같음.
  //   gap = 달리기 단계(L1·L2·L3)별 장애물 간격(박), alt3 = 마지막 단계 2박·4박 번갈아, dense = 반 박 구슬 줄이 시작되는 단계
  // r8c: 칸 하나씩 줄을 나눔(값 고칠 때 틀리지 않게). ★ = 확정기획_v1 「보통」 값 · ☆ = 문서에 없어 쉬움·도전 중간 · ◆ = 대표 결정(r8c)
  //   보통 값 [easy, normal, hard] 순서. 값 자체는 r8b 와 같고, r8c 에서 바뀐 것은 보통 heartOrbs·heartGap·fzPractice 셋뿐.
  const DV = {
    gap:       [[8, 4, 4], [6, 4, 4], [4, 4, 4]],          // ☆ 달리기 L1·L2·L3 장애물 간격(박)
    alt3:      [false, false, true],                        //   마지막 단계 2박·4박 번갈아
    dense:     [2, 2, 0],                                   //   반 박 구슬 줄이 시작되는 단계
    pDouble:   [[0, 0.1, 0.18], [0, 0.16, 0.24], [0, 0.22, 0.3]],     // ☆ 두 줄 막기 확률
    pRow:      [[0, 0, 0.12], [0, 0.06, 0.17], [0.06, 0.12, 0.22]],   // ☆ 세 줄 묶음(넘기·숙이기) 확률
    moverFrom: [16, 12, 8],                                 // ☆ 움직이는 장애물 시작(박)
    moverP:    [0.07, 0.1, 0.12],                           // ☆ 움직이는 장애물 확률
    moverPer:  [8, 6, 4],                                   // ☆ 왕복 주기(박)
    moverNear: [false, false, true],
    moverHint: [true, true, false],
    weave:     [0.8, 0.7, 0.55],                            // ☆ 굽이치는 구슬 줄 확률
    noteP:     [0.4, 0.45, 0.5],                            // ☆ 음표 확률
    blockLow:  [false, false, true],
    dblAny:    [false, false, true],
    gymNeed:   [4, 4, 5],                                   // ☆ 체조 성공 동작 수
    gymWin:    [0.45, 0.38, 0.3],                           // ☆ 체조 판정 ±초
    fzGuide:   [true, false, false],                        // r8d: 멈춤 8곳은 세 난이도 같은 자리. 쉬움만 guide 표시(F1·F3·M1·M2)는 「안내만(감점 X)」 (옛 fzAll: 쉬움은 4번만 — 드롭 뒤 F3 가 빠진 원인)
    fzPractice:[true, true, false],                         // ◆ 첫 멈춰라 연습(하트 안 깎임): 쉬움·보통(r8c 대표 결정). 기획 v1 은 「보통 = 연습 없음」
    fzWin:     [[9, 15], [10, 14], [10, 13.5]],             // ★ 판정 창(B+). 연습 F0 는 세 난이도 모두 B+9~16
    quiet:     [3.0, 2.5, 2.5],                             // ★ 조용히(초)
    moved:     [false, true, true],                         // ★ 멈춘 동안 움직이면 하트 −1
    heartOrbs: [true, true, false],                         // ◆ 하트 구슬: 쉬움·보통(r8c 대표 OK). 기획 v1 은 「쉬움만」
    heartGap:  [0, 12, 0],                                  // ◆ 보통은 달리기 12마디마다(쉬움은 구간마다 6마디쯤 — 0 = 옛 방식 그대로)
    energy:    [0.013, 0.012, 0.011],                       // ☆ 구슬 에너지
    autoBoost: [3.0, 5.0, null],                            // ☆ 자동 부스트(초)
    retry:     ['section', 'section', 'start'],             // ★ 하트 0 → 다시 하기(도전 = 처음부터, r8c 대표 결정으로 유지)
  };
  EK.DIFF = {};
  [['easy', '쉬움'], ['normal', '보통'], ['hard', '도전']].forEach(([id, name], i) => { const d = { id, name }; for (const k in DV) d[k] = DV[k][i]; EK.DIFF[id] = d; });
  EK.DIFFS = ['easy', 'normal', 'hard'];
  EK.normDiff = d => (d && EK.DIFF[d]) ? d : 'easy';   // 모르는 값(옛 저장·주소)은 쉬움 — 옛 저장값 'easy'·'hard' 는 그대로
  // 체조: 6동작(4박마다). 체조 중엔 가운데 줄에 서서 따라 하기만 함(줄이 안 바뀜)
  const GYM_SETS = [['jump', 'left', 'right', 'slide', 'jump', 'jump'], ['left', 'right', 'jump', 'slide', 'left', 'right'], ['jump', 'slide', 'left', 'right', 'jump', 'slide'], ['right', 'left', 'jump', 'jump', 'slide', 'jump']];
  // 움직이는 장애물의 옆 위치: 곡 시간으로만 정해짐. 플레이어와 만나는 순간(o.t)에는 정확히 o.lane 줄 한가운데에 와서 잠깐 머묾.
  EK.moverX = function (o, t) { const a = (o.lane - 1) * EK.LANE, b = (o.lane2 - 1) * EK.LANE; return (a + b) / 2 + (a - b) / 2 * Math.cos((t - o.t) / o.period * Math.PI * 2); };

  // 박자표: 장애물·구슬·음표·체조·멈춰라·안내를 곡 시간으로 찍어 냄. 핵심 이벤트(체조·멈춰라·구간)는 고정, 장애물·구슬 무늬만 seed 로 달라짐.
  EK.buildChart = function (st, diff, seed) {
    const R = EK.rng(seed), per = 60 / st.bpm, T = b => st.offset + b * per, D = EK.DIFF[EK.normDiff(diff)], hard = D.id === 'hard';
    const C = { per, obs: [], orbs: [], notes: [], gyms: [], freezes: [], hints: [], cards: [], tunnels: [], sections: st.sections, finishT: 0, endT: 0, boostBeats: 16, practiceUntil: 0, secStarts: [] };
    C.zones = (st.zones || [{ bar: 0 }]).map((z, i) => ({ t: i ? T(z.bar * 4) : -99, name: z.name, i }));
    let path = 1;
    const orb = (b, lane, y) => C.orbs.push({ t: T(b), lane, y: y || 1.0, got: false });
    const ob = (b, lane, kind) => C.obs.push({ t: T(b), lane, kind, hit: false, v: (R() * 4) | 0 });
    const row = (b, kind) => { for (let l = 0; l < 3; l++) ob(b, l, kind); };
    const adj = l => l === 1 ? (R() < 0.5 ? 0 : 2) : 1;

    for (const s of st.sections) {
      if (s.card) C.cards.push({ t: T(s.from * 4) - 0.2, a: s.card[0], b: s.card[1], pic: s.card[2] });
      if (s.type !== 'finale') C.secStarts.push(T((s.from || 0) * 4));   // r8: 하트 0 → 「다시 하기」 가 돌아가는 구간 시작(쉬움·보통)
      const b0 = (s.from || 0) * 4, b1 = (s.to || 0) * 4;
      if (s.type === 'intro') {
        // 연습 구간(고정, r3: 12마디로 늘려 하나씩): 옆으로(구슬 줄이 굽이침) → 점프 → 숙이기
        const lanes = [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0, 1, 1];
        for (let i = 0; i < 14; i++) orb(b0 + 2 + i, lanes[i]);
        // r7 가로형: 도움말은 가로(L)·세로(P, 예비) 두 벌 — 가로는 화면 반쪽 톡 = 줄 바꾸기, ▲ 점프 버튼. 글자 = 목소리(vo)
        C.hints.push({ t: T(b0 + 2), d: 10 * per, text: '왼쪽·오른쪽을 톡!', icon: 'tap', vo: 'hint_tap', textP: '좌우로 밀어요', iconP: 'lr', voP: 'hint_lr' });
        // r7: 첫 장애물은 「반쪽 톡」으로 피하는 막힘(가운데 줄) 2개 — 구슬 줄이 오른쪽(→ 톡 ▶)·왼쪽(◀ 톡)으로 비켜 감. 연습이라 부딪혀도 하트 그대로
        ob(b0 + 7, 1, 'block'); ob(b0 + 12, 1, 'block');
        C.hints.push({ t: T(b0 + 16), d: 7 * per, text: '점프 버튼을 톡!', icon: 'jbtn', vo: 'hint_jbtn', textP: '위로 밀거나 톡! 점프', iconP: 'up', voP: 'hint_up' });
        row(b0 + 24, 'low'); for (let i = 16; i < 30; i++) orb(b0 + i, 1, i === 24 ? 2.4 : (i === 23 || i === 25) ? 1.5 : 1.0);
        C.hints.push({ t: T(b0 + 30), d: 7 * per, text: '아래로 밀면 숙이기!', icon: 'down', vo: 'hint_down' });
        row(b0 + 38, 'high'); for (let i = 30; i < 48; i++) orb(b0 + i, i >= 42 && i <= 45 ? 2 : 1, i >= 37 && i <= 39 ? 0.55 : 1.0);
        path = 1; C.practiceUntil = T(b1);
      } else if (s.type === 'run') {
        const L = s.level, Li = Math.max(0, Math.min(2, L - 1)), gap = L === 0 ? 4 : (D.alt3 && L >= 3) ? 2 : D.gap[Li];
        const dense = L >= D.dense;
        let prev = b0;
        const fill = (from, to, lane, switchAt, newLane) => {   // (from, to] 박마다 구슬
          const step = dense ? 0.5 : 1;
          for (let b = from + step; b <= to + 1e-6; b += step) orb(b, (switchAt != null && b >= switchAt) ? newLane : lane);
        };
        const tun = s.tunnel ? [s.tunnel[0] * 4, s.tunnel[1] * 4] : null;
        if (tun) C.tunnels.push({ t0: T(tun[0]), t1: T(tun[1]) });
        let s0 = b0 + gap; if (L === 0) s0 = b1 + 1;
        let slot = 0, movers = 0;
        // 도전 마지막 구간: 2박·4박을 번갈아(평균 3박) — 2박만 이어지면 너무 빽빽함
        const step = i => (D.alt3 && L >= 3) ? (i % 2 ? 4 : 2) : gap;
        for (let sb = s0; sb <= b1 - 4; sb += step(slot++)) {
          const r = R(); let np = path, pat;
          const inTun = tun && sb >= tun[0] - 2 && sb <= tun[1] + 2;
          // 세 줄을 한꺼번에 막는 줄(row)은 쉬움 1·2단계에서는 안 나옴
          const pDouble = inTun || L === 0 ? 0 : D.pDouble[Li], pRow = L === 0 ? 0 : D.pRow[Li];
          if (r < pDouble) pat = 'double'; else if (r < pDouble + pRow) pat = R() < 0.6 ? 'rowlow' : 'rowhigh';
          else { const q = R(); pat = q < 0.38 ? 'low' : q < 0.62 ? 'high' : 'block'; }
          // 움직이는 장애물: 표시된 구간의 세 번째 자리에 꼭 한 번(핵심 이벤트), 그 밖에는 가끔. 터널 안·체조 바로 앞에는 안 나옴
          const mv = !inTun && sb - b0 >= D.moverFrom && sb <= b1 - 8 && ((s.mover && slot === 2) || (L >= 1 && movers < 2 && R() < D.moverP));
          if (mv) pat = 'mover';
          // r3: 구슬 줄이 옆줄로 굽이침 — 가운데에 가만히 서 있으면 구슬을 놓침(장애물도 굽이친 줄 위에 놓임)
          if (pat !== 'mover' && pat !== 'block' && pat !== 'double' && sb - prev >= 3 && R() < D.weave) {
            const nl = adj(path), sw = prev + Math.max(1, Math.floor((sb - 1 - prev) / 2));
            fill(prev, sb - 1, path, sw, nl); prev = sb - 1; path = nl; np = nl;
          }
          if (pat === 'mover') {
            movers++;
            // 안전한 줄 하나는 늘 비워 둠: 가운데에 있었으면 옆줄로, 옆줄에 있었으면 그 줄 그대로. 무당벌레·꽃게는 나머지 두 줄을 천천히 오감
            const safe = path === 1 ? adj(path) : path, far = safe === 0 ? 2 : safe === 2 ? 0 : 1, near = 1;
            const lane = D.moverNear ? (safe === 1 ? 0 : near) : (safe === 1 ? 2 : far), lane2 = safe === 1 ? (lane === 0 ? 2 : 0) : (lane === far ? near : far);
            const sw = sb - Math.min(3, gap / 2 + 1);
            fill(prev, sb + 1, path, sw, safe);
            C.obs.push({ t: T(sb), lane, lane2, kind: 'mover', period: D.moverPer * per, hit: false, v: 0 });
            if (D.moverHint && movers === 1) C.hints.push({ t: T(sb - 7), d: 5 * per, text: st.moverName + '가 지나가요!', icon: 'jbtn', iconP: 'up' });
            np = safe; prev = sb + 1;
          } else if (pat === 'low' || pat === 'high') {
            fill(prev, sb - 1, path);
            ob(sb, path, pat);
            if (pat === 'low') { C.orbs[C.orbs.length - 1].y = 1.5; orb(sb, path, 2.4); orb(sb + (dense ? 0.5 : 1), path, 1.5); }
            else { orb(sb, path, 0.55); orb(sb + (dense ? 0.5 : 1), path); }
            const g = step(slot);
            if (g >= 4 && R() < D.noteP) { const nl = adj(path); C.notes.push({ t: T(sb + g / 2), lane: nl, got: false }); }
            prev = sb + (dense ? 0.5 : 1);
          } else if (pat === 'block') {
            np = adj(path); const sw = sb - Math.min(2, gap / 2);
            fill(prev, sb, path, sw, np); ob(sb, path, 'block');
            if (D.blockLow && L >= 2 && R() < 0.4) ob(sb, 3 - path - np, 'low');
            prev = sb;
          } else if (pat === 'double') {
            np = D.dblAny ? ((R() * 3) | 0) : (R() < 0.5 ? path : adj(path)); const sw = sb - Math.min(2, gap / 2);
            fill(prev, sb, path, sw, np);
            for (let l = 0; l < 3; l++) if (l !== np) ob(sb, l, 'block');
            prev = sb;
          } else {
            fill(prev, sb - 1, path); row(sb, pat === 'rowlow' ? 'low' : 'high');
            if (pat === 'rowlow') { C.orbs[C.orbs.length - 1].y = 1.5; orb(sb, path, 2.4); orb(sb + (dense ? 0.5 : 1), path, 1.5); }
            else { orb(sb, path, 0.55); orb(sb + (dense ? 0.5 : 1), path); }
            prev = sb + (dense ? 0.5 : 1);
          }
          path = np;
        }
        // 구간 끝까지 구슬, 가운데로 모이게
        if (L === 0) { for (let b = b0 + 1; b <= b1; b += 0.5) for (let l = 0; l < 3; l++) orb(b, l, 1.0); path = 1; }
        else { fill(prev, b1, path, path !== 1 ? b1 - 2 : null, 1); path = 1; }
      } else if (s.type === 'gym') {
        const set = GYM_SETS[(R() * GYM_SETS.length) | 0];
        const g = { t0: T(b0), t1: T(b1), name: st.gymName, need: D.gymNeed, moves: set.map((k, i) => ({ t: T(b0 + 8 + i * 4), kind: k, res: 0 })), done: false, ok: 0 };
        C.gyms.push(g);
        // r3: 체조 구슬은 동작을 맞췄을 때만 — 맞춘 동작 뒤 2박 동안 구슬 5개가 앞에 나타남(못 맞추면 안 나옴)
        for (let b = b0 + 4; b <= b0 + 7; b++) orb(b, 1);
        g.moves.forEach((m, i) => { for (const d of [1.5, 2, 2.5, 3, 3.5]) { orb(b0 + 8 + i * 4 + d, 1); const o = C.orbs[C.orbs.length - 1]; o.gym = true; o.mv = m; } });
        path = 1;
      } else if (s.type === 'verse') {
        // r8 운동장 노래 구간: 장애물 없이 굽이치는 구슬 줄만(후렴 「멈추지 말아요」는 반 박마다 촘촘히). 멈춰라 신호는 cues 에서
        const step = s.dense ? 0.5 : 1; let lane = path, prev = b0;
        for (let sb = b0 + 8; sb <= b1; sb += 8) { const nl = adj(lane); for (let b = prev + step; b <= Math.min(sb, b1) + 1e-6; b += step) orb(b, b >= sb - 3 ? nl : lane); prev = sb; lane = nl; }
        for (let b = prev + step; b <= b1 + 1e-6; b += step) orb(b, lane);
        path = lane;
      } else if (s.type === 'finale') {   // r8b: 옛 {type:'freeze'} 꾹 누르기 구간은 없앰 — 멈춰라는 verse.cues 로만
        C.finishT = T(b0 + 2); C.endT = Math.min(T(b1), st.dur - 0.5);
        for (let b = b0 - 3; b <= b0 + 2; b += 0.5) for (let l = 0; l < 3; l++) orb(b, l, 1.0);
      }
    }
    // r8d: 멈춰라는 구간(verse·run·후렴)과 상관없이 st.cues 전부 — 옛 판은 verse 의 cues 목록 + 쉬움 4번 제한이라, 구간 표·난이도에 따라 빠질 수 있었음
    for (const q of (st.cues || [])) {
      // t = 신호등 시작(「그대로」 B+8 / 「말고」 B+10) · meomT 「멈」/「움」 · holdT 「라」/「마!」 끝(곡이 멈춤) · 판정 창: 쉬움 B+9~B+15(연습 B+9~B+16), 보통 B+10~B+14, 도전 B+10~B+13.5 (움직이지 마는 +2박)
      const B = q.line + (q.sh || 0), prac = D.fzPractice && !!q.practice, guide = D.fzGuide && !!q.guide, win = prac ? [9, 16] : D.fzWin;
      C.freezes.push({ id: q.id, line: q.line, text: q.text || '그대로 멈춰라', t: T(B + 8), meomT: T(B + 10), holdT: T(B + 12.5), win: [T(B + win[0]), T(B + win[1])], quiet: D.quiet, practice: prac, guide, done: false, result: 0 });
    }
    // 겹친 구슬 정리 + 시간순
    const seen = new Set();
    C.orbs = C.orbs.filter(o => { const k = Math.round(o.t * 100) + '_' + o.lane; if (seen.has(k)) return false; seen.add(k); return true; });
    // 장애물 줄에 놓인 구슬은 못 먹으니 뺌(막힌 줄) · 음표가 장애물과 겹치면 뺌
    const blocked = (t, lane, kinds) => C.obs.some(o => o.lane === lane && Math.abs(o.t - t) < per * 0.7 && kinds.includes(o.kind));
    C.orbs = C.orbs.filter(o => !blocked(o.t, o.lane, ['block']));
    C.notes = C.notes.filter(n => !blocked(n.t, n.lane, ['block', 'low', 'high']) && !C.obs.some(o => o.kind === 'mover' && Math.abs(o.t - n.t) < per * 2.5));
    C.obs.sort((a, b) => a.t - b.t); C.orbs.sort((a, b) => a.t - b.t); C.notes.sort((a, b) => a.t - b.t);
    // 같은 자리 장애물 중복 제거
    C.obs = C.obs.filter((o, i) => !C.obs.some((p, j) => j < i && p.lane === o.lane && Math.abs(p.t - o.t) < 0.01));
    // 하트 구슬(쉬움 + r8c 보통 12마디마다 — 기획 v1 은 「쉬움만」, 대표 OK 로 보통 추가. 도전 없음): 달리기 구간에서 6마디쯤마다, 장애물과 떨어진 보통 높이 구슬 하나를 하트로
    C.hearts = [];
    let runOff = 0, lastHeart = -1e9;   // r8c: heartGap = 달리기 구간 마디(구간을 이어 붙여 셈) 간격. 쉬움(0)은 옛 방식 그대로
    if (D.heartOrbs) for (const s of st.sections) if (s.type === 'run' && s.level >= 1) { for (let bar = s.from + 3; bar < s.to - 1; bar += 6) {
      const rp = runOff + bar - s.from; if (D.heartGap && rp - lastHeart < D.heartGap) continue;
      const tt = T(bar * 4 + 2); let best = null;
      for (const o of C.orbs) { if (Math.abs(o.t - tt) > per * 3 || o.y < 0.8 || o.y > 1.2 || o.heart) continue; if (C.obs.some(b => Math.abs(b.t - o.t) < per * 1.2)) continue; if (!best || Math.abs(o.t - tt) < Math.abs(best.t - tt)) best = o; }
      if (best) { best.heart = true; C.hearts.push(best); lastHeart = rp; }
    } runOff += s.to - s.from; }
    for (const o of C.obs) if (o.t < C.practiceUntil) o.practice = true;   // 연습 구간 장애물은 부딪혀도 하트가 안 깎임
    // r8 멈춰라 앞 2마디(「멈」−8박)~뒤 1마디(끝+4박)엔 장애물·구슬·음표·하트 구슬 없음
    C.freezes.sort((a, b) => a.t - b.t);
    if (C.freezes.length && C.freezes[0].meomT != null) { const inF = t => C.freezes.some(f => t > f.meomT - per * 8 - 1e-6 && t < f.holdT + per * 4.5 + 1e-6);
      C.obs = C.obs.filter(o => !inF(o.t)); C.orbs = C.orbs.filter(o => !inF(o.t)); C.notes = C.notes.filter(n => !inF(n.t)); C.hearts = C.hearts.filter(h => !inF(h.t)); }
    C.total = C.orbs.length; C.missionN = C.gyms.length + C.freezes.length;   // r8: 결과 화면 「미션 n / N」
    return C;
  };
})();
