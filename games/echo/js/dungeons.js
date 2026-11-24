/* 에코 제로 — 던전·난이도 10단계 데이터 (2026-11-24 세포 「메아리 체조 돔」 + 공통 틀). 세계관 정본 v1.1 2·3장, 계획 v8 12·13-2쪽.
   · 던전 1개 = 이 표 한 줄. 허조교·모쉬·쎄니·베리는 open:false(「곧 열려요」) — 그 던전 날에 open:true 로 바꾸고 floors·music·cheer(확대 동작, game.js CHEER)만 더하면 됨.
   · music = 배경 음악 자리. 값은 js/pack_audio.js 의 TG_AUDIO 키(= assets/audio/<키>.mp3). 파일이 없으면 js/audio.js 가 임시 루프를 코드로 만들어 같은 키에 넣음(A.TEMP_LOOPS).
     → 대표 곡이 오면: assets/audio/bgm_dome_sefo.mp3 로 넣고 python3 tools/pack_assets.py → 이 파일은 안 고쳐도 됨(키가 같으면 임시 루프는 건너뜀).
   · 난이도 10단계(TG.LEVELS)는 모든 던전 공통. 숫자는 계획 v8 13-2쪽 표 그대로([추정] — 측정으로 맞춤). 단계 진행은 localStorage ez_lv_<던전> (깬 최고 단계).
   · 규칙 계산에 들어가는 값(hp·num·atk·floors)은 기록(G.rec.dun / G.rec.lv)에 같이 적혀 재생 때 같은 값으로 돎. */
(function () {
  'use strict';
  const TG = window.TG;
  // 10단계 (v8 13-2쪽): hp = 안개·보스 튼튼함 배율, num = 안개 수(층 게이지·동시 수) 배율, atk = 안개 빠르기 배율(계획표 「센 정도 ×」를 순한 말로 — 빠르기·나오는 간격에만 씀, 닿으면 1칸은 그대로)
  //   gear = 깰 때 톱니(1판), box = 첫 클리어 상자(던전·단계 1회, 짝수 단계만 카드 +1), lv = 추천 톱니 레벨(별 1~5, 입장 안 막음)
  TG.LEVELS = [null,
    { n: 1, name: '소풍', say: '소풍 가자!', note: '안개 순하고 천천히', hp: 1.0, num: 1.0, atk: 1.0, lv: 1, gear: '1등급 ×12', box: '1등급 톱니 ×20' },
    { n: 2, name: '나들이', say: '신나게 나들이!', note: '안개 조금 늘어남', hp: 1.2, num: 1.1, atk: 1.1, lv: 6, gear: '1등급 ×14 · 2등급 ×2', box: '1등급 ×14 · 2등급 ×8 + 카드 1' },
    { n: 3, name: '모험', say: '이제 모험이야!', note: '새 안개 섞임', hp: 1.4, num: 1.2, atk: 1.2, lv: 15, gear: '1등급 ×12 · 2등급 ×6', box: '2등급 톱니 ×10' },
    { n: 4, name: '용감', say: '용감한 친구네!', note: '안개가 가까이 몰려옴', hp: 1.7, num: 1.3, atk: 1.4, lv: 26, gear: '2등급 ×10 · 3등급 ×3', box: '2등급 ×10 · 3등급 ×6 + 카드 1' },
    { n: 5, name: '대모험', say: '와, 대모험!', note: '안개 더 빽빽·빨라짐', hp: 2.0, num: 1.4, atk: 1.6, lv: 38, gear: '2등급 ×8 · 3등급 ×6', box: '3등급 톱니 ×10' },
    { n: 6, name: '대탐험', say: '멀리까지 탐험해요!', note: '빠른 안개 섞임', hp: 2.3, num: 1.5, atk: 1.9, lv: 50, gear: '3등급 ×10 · 4등급 ×3', box: '3등급 ×10 · 4등급 ×5 + 카드 1' },
    { n: 7, name: '전설', say: '전설이 시작돼요', note: '안개 빽빽 · 보스 빠름', hp: 2.7, num: 1.65, atk: 2.2, lv: 63, gear: '4등급 ×10 · 5등급 ×2', box: '4등급 톱니 ×10' },
    { n: 8, name: '대전설', say: '대단한 전설이에요!', note: '안개 가득·더 빨라짐', hp: 3.0, num: 1.8, atk: 2.5, lv: 76, gear: '4등급 ×8 · 5등급 ×6', box: '4등급 ×10 · 5등급 ×5 + 카드 1' },
    { n: 9, name: '시끌벅적', say: '와글와글 시끌벅적!', note: '안개 가득 · 보스 두 단계', hp: 3.3, num: 1.9, atk: 2.8, lv: 88, gear: '5등급 ×8 · 6등급 ×1', box: '5등급 톱니 ×10' },
    { n: 10, name: '대소동', say: '대소동이다!', note: '가장 시끌시끌', hp: 3.6, num: 2.0, atk: 3.0, lv: 95, gear: '5등급 ×6 · 6등급 ×3', box: '5등급 ×6 · 6등급 ×6 + 카드 1 + 금 도장', hidden: true }, // 깨기 전엔 「???」
  ];
  TG.LEVEL_MAX = 10;
  // 계획표 「센 정도 ×」 → 빠르기로 옮기는 비율 [추정]: 안개 이동 1 + (atk−1)×0.35, 나오는 간격 ÷(1 + (atk−1)×0.25), 보스 빠르기 1 + (atk−1)×0.2 (10단계: 이동 ×1.7 · 간격 ÷1.5 · 보스 ×1.4)
  TG.levelK = function (n) {
    const L = TG.LEVELS[n] || TG.LEVELS[1];
    return { hp: L.hp, num: L.num, spd: 1 + (L.atk - 1) * 0.35, iv: 1 / (1 + (L.atk - 1) * 0.25), boss: 1 + (L.atk - 1) * 0.2 };
  };

  // 던전 표 (정본 2·3장). floors = 층 안내 글(규칙 숫자는 game.js FLOORS 공통 + 단계 배율). theme = 하늘·빛 색(그림만). beat = 박자 안개(박마다 반짝, 그림만)
  TG.DUNGEONS = {
    pipe: { id: 'pipe', name: '방송 파이프 굴', owner: null, ownerName: '모두', color: '#e5352b', open: true, tut: true,
      tag: '연습 던전 · 움직이기 · 줍기 · 큰 소리', again: '톱니골 광장 첫 던전',
      music: { floor: 'bgm_battle', boss: 'bgm_boss', end: null },
      floors: null, bossName: '큰 침묵 안개', bossSub: '노래를 꽁꽁 숨긴 안개예요', theme: null },
    sefo_dome: { id: 'sefo_dome', name: '메아리 체조 돔', owner: 'sefo', ownerName: '세포', color: '#e5352b', open: true, dir: '남',
      tag: '세포 던전 · 멈춘 체조 시간을 되찾자', again: '세포 던전 · 체조 시간',
      music: { floor: 'bgm_dome_sefo', boss: 'bgm_boss', end: 'sfx_gym' }, // floor = 임시 루프(대표 세포 체조 음원 오면 파일만 교체), end = 확대 연출 때 체조 음악 끝 2박
      floors: [null,
        { title: '1층 · 체조 시간이 멈췄어요!', sub: '박자 안개가 박에 맞춰 뛰어요' },
        { title: '2층 · 안개 뭉치도 박자에!', sub: '터지면 둘로 나뉘어요' },
        { title: '3층 · 메아리 안개 등장!', sub: '한 번은 통! 두 번째에 퐁' }],
      bossName: '큰 침묵 안개', bossSub: '체조 음악을 꽁꽁 숨긴 안개예요',
      theme: { bg: 0xffd6ae, sky: 0xfff0d8, ground: 0xe8a07a, pulse: 0xff5a3c }, beat: true,
      npc: '체조 반 꼬마 톱니 로봇' },
    // 11-24 허조교 「연병장 지하」(정본 3장: 좁은 지하 복도·가까운 벽·줄 안개·구령·기상 나팔 · 호루라기·구령·타이어만 — 정본 3장 안전 규칙). rule = 던전 고유 규칙(game.js/fogs.js 가 읽음, 규칙 계산에 들어가 기록 dun 으로 재생 때 같음)
    //  line: 안개가 줄지어(한 줄 행진) 나옴 · wallPop: 맞아 밀린 안개가 벽에 닿으면 바로 퐁(밀착 넉백) · beat: 구령 박자(그림·글만) · boss: 큰 침묵 안개 「구령 변형」(행진 굴러오기 많이·안개 비가 한 줄로·올리브 빛)
    gunner_camp: { id: 'gunner_camp', name: '연병장 지하', owner: 'gunner', ownerName: '허조교', color: '#a7b04f', open: true, dir: '북',
      tag: '허조교 던전 · 기상 나팔을 되찾자', again: '허조교 던전 · 기상 나팔',
      music: { floor: 'bgm_camp_gunner', boss: 'bgm_boss', end: 'sfx_whistle_gunner' }, // floor = 임시 루프(대표 〈Boot Camp〉 음원 오면 assets/audio/bgm_camp_gunner.mp3 만), end = 호루라기 삑 + 북 한 번(합성)
      floors: [null,
        { title: '1층 · 기상 나팔이 멈췄어요!', sub: '줄 안개가 줄지어 행진해요 — 벽에 밀리면 퐁!' },
        { title: '2층 · 안개 뭉치도 행진!', sub: '터지면 둘로 나뉘어요 · 벽에 밀어붙여요' },
        { title: '3층 · 메아리 안개 등장!', sub: '한 번은 통! 두 번째에 퐁' }],
      bossName: '큰 침묵 안개 · 구령 변형', bossSub: '찌그러진 헬멧을 쓰고 기상 나팔을 꽁꽁 숨긴 안개예요',
      theme: { bg: 0x9aa06a, sky: 0xe3e6b6, ground: 0x6f7538, pulse: 0xdce383 }, beat: { bpm: 116, call: ['하나!', '둘!', '셋!', '넷!'] },
      rule: { line: true, wallPop: true, boss: { var: 'drill', order: [['roll', 'roll', 'rain'], ['rolls', 'slam', 'roll', 'rain'], ['rolls', 'combo', 'rolls', 'rain']], rainLine: true, tint: 0x8a8f5a, sqY: 0.86 } },
      npc: '훈련병 톱니 로봇' },
    // 11-24 모쉬 「거울 네온 미로」(정본 3장: 거울·유리 벽 미로, 어둡지만 파스텔 · 거울 안개(되받기)·깜깜 안개(불 꺼짐) · 공방 불빛)
    //  mirror: 안개 3마리 중 1마리는 거울 안개 — 맞히면 가까운 다른 안개로 빔이 튕겨 같이 맞음(튕김 체인) · dark: 뭉치 대신 가끔 깜깜 안개(크고 튼튼함 2) — 살아 있으면 불이 어두워지고 퐁 하면 불이 켜짐(그림만) · boss: 「어둠 변형」(꺼진 큐브 😐 — 보스전 동안 어둑, 단계 바뀔 때·깰 때 불 켜짐 😊)
    moshee_mirror: { id: 'moshee_mirror', name: '거울 네온 미로', owner: 'moshee', ownerName: '모쉬', color: '#2fe0f0', open: true, dir: '북동',
      tag: '모쉬 던전 · 공방 불빛을 되찾자', again: '모쉬 던전 · 네온 불빛',
      music: { floor: 'bgm_mirror_moshee', boss: 'bgm_boss', end: 'sfx_drop_moshee' }, // floor = 임시 루프(대표 「moshi moshi」 음원 오면 assets/audio/bgm_mirror_moshee.mp3 만), end = 자체 음원 드롭 1초 자리(합성)
      floors: [null,
        { title: '1층 · 공방 불빛이 꺼졌어요!', sub: '거울 안개를 맞히면 옆 안개로 빔이 튕겨요' },
        { title: '2층 · 깜깜 안개가 불을 꺼요!', sub: '깜깜 안개를 퐁 하면 불이 켜져요' },
        { title: '3층 · 메아리 안개 등장!', sub: '한 번은 통! 두 번째에 퐁' }],
      bossName: '큰 침묵 안개 · 어둠 변형', bossSub: '꺼진 큐브처럼 공방 불빛을 꽁꽁 숨긴 안개예요',
      theme: { bg: 0x2a2f55, sky: 0x9fe8f6, ground: 0x4a4478, pulse: 0x2fe0f0 },
      rule: { mirror: 3, mirrorR: 6.5, dark: true, boss: { var: 'dark', order: [['rain', 'squeeze'], ['slam', 'rain', 'squeeze', 'roll'], ['combo', 'slam', 'rolls', 'rain']], tint: 0x3c4066, dim: 1.0 } },
      npc: '전자제품 로봇(토스터·선풍기)' },
    sseni_hall: { id: 'sseni_hall', name: '별빛 댄스홀', owner: 'sseni', ownerName: '쎄니', color: '#a46bff', open: false, dir: '북서' },
    berri_orchard: { id: 'berri_orchard', name: '베리 과수원', owner: 'berri', ownerName: '베리', color: '#ff7fb6', open: false, dir: '북서' },
  };
  TG.DUNGEON_ORDER = ['pipe', 'sefo_dome', 'gunner_camp', 'moshee_mirror', 'sseni_hall', 'berri_orchard'];

  // ★ 베타 깃발 (대표 11-24): 베타 테스터 기간엔 모든 던전의 1~10단계를 처음부터 고를 수 있음. false 로 바꾸면 원래 규칙(깬 단계 다음 단계만 열림). 시험용 URL ?beta=0 / ?beta=1 이 이 값을 덮음
  TG.BETA_OPEN_ALL = true;
  { const qb = new URLSearchParams(location.search).get('beta'); if (qb === '0' || qb === '1') TG.BETA_OPEN_ALL = qb === '1'; }
  TG.beta = () => !!TG.BETA_OPEN_ALL;

  // 진행 저장 (기기): 깬 최고 단계 · 받은 첫 클리어 상자
  const DN = (TG.DN = {});
  const key = (id) => 'ez_lv_' + id;
  DN.cleared = function (id) { try { return Math.max(0, Math.min(TG.LEVEL_MAX, parseInt(localStorage.getItem(key(id)) || '0', 10) || 0)); } catch (e) { return 0; } };
  DN.maxPick = function (id) { return TG.beta() ? TG.LEVEL_MAX : Math.min(TG.LEVEL_MAX, DN.cleared(id) + 1); }; // 고를 수 있는 가장 높은 단계 = 깬 단계 + 1 (베타 깃발 켜면 10까지 전부)
  DN.hasLevels = function (id) { const d = DN.get(id); return !d.tut || TG.beta(); }; // 연습 던전(방송 파이프 굴)은 단계 없음 — 베타 기간엔 열린 던전 전부(파이프 굴 포함)에 단계 10칸
  DN.markClear = function (id, n) { // 돌려줌: { newLevel(처음 깸), boxNew(상자 처음), next(다음 단계 번호 또는 null) }
    const was = DN.cleared(id), first = n > was;
    if (first) { try { localStorage.setItem(key(id), String(n)); } catch (e) { /* 무시 */ } }
    let boxNew = false;
    try { const bk = 'ez_box_' + id + '_' + n; if (!localStorage.getItem(bk)) { localStorage.setItem(bk, '1'); boxNew = true; } } catch (e) { /* 무시 */ }
    return { first, boxNew, next: n < TG.LEVEL_MAX ? n + 1 : null };
  };
  DN.reset = function (id) { try { for (let i = 1; i <= TG.LEVEL_MAX; i++) localStorage.removeItem('ez_box_' + id + '_' + i); localStorage.removeItem(key(id)); } catch (e) { /* 무시 */ } };
  // 지금 고른 던전·단계 (광장에서 고름, 저장은 던전만)
  DN.sel = { dun: 'pipe', lv: 1 };
  DN.get = (id) => TG.DUNGEONS[id] || TG.DUNGEONS.pipe;
  DN.levelName = (n, id) => { const L = TG.LEVELS[n]; if (!L) return ''; return L.hidden && DN.cleared(id || DN.sel.dun) < n ? '???' : L.name; };
  DN.select = function (id, lv) {
    const d = DN.get(id); if (!d.open) return false;
    DN.sel.dun = d.id; DN.sel.lv = Math.max(1, Math.min(DN.maxPick(d.id), lv | 0 || 1));
    try { localStorage.setItem('ez_dun', d.id); } catch (e) { /* 무시 */ }
    return true;
  };
  DN.load = function () { let id = null; try { id = localStorage.getItem('ez_dun'); } catch (e) { /* 무시 */ } const q = new URLSearchParams(location.search).get('dun'); if (q && TG.DUNGEONS[q]) id = q; if (!id || !TG.DUNGEONS[id] || !TG.DUNGEONS[id].open) id = 'pipe'; DN.sel.dun = id; DN.sel.lv = Math.min(DN.maxPick(id), parseInt(new URLSearchParams(location.search).get('lv') || '1', 10) || 1); };
  DN.load();
})();
