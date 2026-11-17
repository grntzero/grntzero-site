/* 톱니골 던전 — 주인공·보조 캐릭터 설정 (2026-11-16 베리·허조교·MOSHEE 추가, 11-16 오후 대표 지시로 밸런스·큰 소리 개편, 11-16 밤 5명 게임 넣기). 설정 파일과 그림(GLB)은 따로(기획서 0절 8)
   11-16 밤(5명_게임넣기_20261116): 모델 교체 — 세포 v0(2.3등신, GLB 안 확성기 sefo_mega_grip·등 34 그림) / 쎄니 v1(소리굽쇠 sseni_fork_grip, 주인공 「준비 중」 풀림) / 허조교 v2(2.38등신) / 베리 v2(2.34등신). 모쉬 그대로.
   키(height, 월드 ≈ ×1.2): 어른 세포 3.0(headScale 0.82)·허조교 2.78·모쉬 2.7 / 아이 쎄니·베리 2.32(어른의 약 84%, 캐릭터비율_20261116/비율_기준.md). 판정(안개 닿음 반지름·파형 범위)은 키와 무관(fogs.js hitR 고정, wave.js xz 판정)
   pose = 뼈 회전 덧칠(라디안, 매 프레임 동작 위에 더함, js/player.js) — 베리 편 손을 막대 쥐는 손처럼(손목 ±60° 안)
   쎄니: 기본 「퍼플팝」(보라 작은 별 파형, 범위는 WV.LV 공통) / 큰 소리 「퍼플팡팡!」(game.js bigPaint: 보라 물감 방울 부채꼴 → 닿은 안개 보라로 물들며 작아짐 → 별·반짝이로 퐁, 모두 잠깐 아주 빨라짐) / 응원 「빠르게」 그대로
   11-16 대표 지시(밸런스_대표지시_20261116.md):
   · 기본 소리 = 모두 파형(세포와 같은 범위·위력·간격, js/wave.js WV.LV 한 표) — 주인공마다 색(style.in/out)·소품 모션·곁 알갱이(style.cell)만 다름. 이름은 shotName(버튼에 표시)
   · 큰 소리(big): sefo 'dance' 「세포체조!」(시야 안 안개 3초 춤 → 전부 퐁) / gunner 'push' 「좌우로 밀착!」(둘레 안개 바깥으로 밀려 벽에 퐁) / moshee 'beam' 「픽셀 빔!」(큐브 4방향 빛줄기 → 회전 → 퐁) / berri 'flower' 「꽃 피었다!」(그대로)
   · ult = 큰 소리 목소리 파일 이름(assets/audio/<ult>.mp3 → js/pack_audio.js). 없으면 조용히 건너뜀(베리는 파일만 넣고 pack_assets.py 돌리면 됨)
   주인공 GLB 는 고른 것만 따로 받음(js/assets.js M.hero) — 설정은 여기, 묶음은 js/pack_hero_<model>.js
   고르는 법: 주인공이 베리면 보조는 쎄니만. 지금은 「없음」도 둠(끝까지 모드 전까지 — 기존 SEFO 한 판은 그대로).
   화면에 보이는 이름은 전부 한글(세포·허조교·모쉬·쎄니·베리) — 코드 키(sefo·gunner·moshee·sseni·berri)는 그대로. 타이틀 주인공 순서 세포·허조교·모쉬·쎄니·베리
   저장: localStorage tg_hero / tg_assist, 시험: ?hero=berri&assist=sseni */
(function () {
  'use strict';
  const TG = window.TG;
  TG.HEROES = {
    sefo: {
      id: 'sefo', name: '세포', model: 'sefo', height: 3.0, kid: false, // 11-16 밤 v0: 머리가 커 headScale 0.82, 키 2.87→3.0(월드 약 3.3, 전과 같은 눈높이)
      color: 0xe5352b, colorCss: '#e5352b', xray: 0xf0483c, aim: 0xff6a4a, charge: [0xff8a5b, 0xe5352b, 0xffd966],
      prop: 'megaglb', propNode: 'sefo_mega_grip', badge: null, headScale: 0.82, faceCam: [2.6, 4.3, 2.3], // 확성기·등 34 는 GLB 안(코드 확성기 'mega'·등번호 판 끔)
      shot: 'wave', shotName: '소리 방울', style: { in: 0xff8a5b, out: 0xe5352b, edge: [0.62, 0.08, 0.08], cell: 'note', spark: [2.5, 1.2, 0.8] },
      big: 'dance', bigSay: '세포체조!', ult: 'ult_sefo',
    },
    berri: {
      id: 'berri', name: '베리', model: 'berri', height: 2.32, kid: true, // 11-16 밤 v2(2.34등신): 아이 키 2.32(어른의 약 84%)
      color: 0xff7fb6, colorCss: '#ff7fb6', xray: 0xff8fc4, aim: 0xff9ccb, charge: [0xffb3d6, 0xff7fb6, 0xfff0a8],
      prop: 'wand', propNode: 'berri_wand_grip', badge: null, headScale: 1.0, faceCam: [2.6, 4.4, 2.35],
      pose: { RightHand: [0.0, 0.0, -0.9] }, // 편 손 → 막대 쥐는 손처럼 손목만 안으로(약 52°, ±60° 안 — 뒷머리와 안 겹치게)
      shot: 'wave', shotName: '베리 방울', style: { in: 0xffc2dd, out: 0xff7fb6, edge: [0.55, 0.12, 0.3], cell: 'flower', spark: [2.4, 1.4, 1.8], flowers: true },
      big: 'flower', bigSay: '꽃 피었다!', ult: 'ult_berri',
      guide: { auto: '가까운 안개에 베리 방울이 저절로 퍼져요', man: '「베리 방울」 버튼을 꾹! 핑크 방울이 퐁퐁 퍼져요' },
    },
    gunner: { // 허조교(SGT.GUNNER): 호루라기는 GLB 안 Spine 뼈 자식(tools/build_gunner.py). 어른 — 쓰러짐·보스 연출은 SEFO 와 같음
      id: 'gunner', name: '허조교', model: 'gunner', height: 2.78, kid: false, // 11-16 밤 v2(2.38등신, 철모 글자 또렷 — 덧칠 없음)
      color: 0xa7b04f, colorCss: '#a7b04f', xray: 0xb9c25a, aim: 0xd8e26c, charge: [0xdce383, 0xa7b04f, 0xffe88a],
      prop: 'whistle', propNode: 'gunner_whistle_mount', badge: null, headScale: 1.0, faceCam: [2.7, 4.3, 2.4],
      shot: 'shout', shotName: '올려놔!', style: { in: 0xf3f7b8, out: 0xa7b04f, edge: [0.3, 0.33, 0.1], cell: 'note', spark: [2.0, 2.2, 1.0], shout: true }, // 11-17 고함: 처음 맞은 하나 피해+0.5초 멈춤, 둘레는 같이 멈춤(wave.js SHOUT)
      big: 'push', bigSay: '좌우로 밀착!', ult: 'ult_gunner',
      guide: { auto: '가까운 안개에 호루라기 「올려놔!」 고함이 저절로 나가요 — 맞은 안개는 뚱 멈춰요', man: '「올려놔!」 버튼을 꾹! 호루라기 고함에 맞은 안개가 뚱 멈춰요' },
    },
    moshee: { // MOSHEE: 큐브 머리 화면 표정 7종(tools/build_moshee.py 아틀라스, js/player.js PL.face), 붐박스는 GLB 안 RightHand 뼈 자식. 어른 — 쓰러짐·보스 연출은 SEFO 와 같음
      id: 'moshee', name: '모쉬', model: 'moshee', height: 2.7, kid: false,
      color: 0x2fe0f0, colorCss: '#2fe0f0', xray: 0x3de8f5, aim: 0x5df0ff, charge: [0x8ff4ff, 0x2fe0f0, 0xff5fb8],
      prop: 'boombox', propNode: 'moshee_boombox_grip', badge: null, headScale: 1.0, faceCam: [2.7, 4.6, 2.7], rimGlow: true,
      shot: 'bolt', shotName: '푸슝 빔', style: { in: 0xc6fbff, out: 0x2fe0f0, edge: [0.05, 0.3, 0.36], cell: 'dot', spark: [0.8, 2.2, 2.5], pixel: true, bolt: true }, // 11-17 단발 빔: 한 발 한 명(wave.js BOLT), 카드 「튕기는 빔」「지나는 빔」
      big: 'beam', bigSay: '픽셀 빔!', ult: 'ult_moshee',
      guide: { auto: '가까운 안개에 푸슝 빔이 저절로 나가요 — 한 발에 하나씩', man: '「푸슝 빔」 버튼을 꾹! 곧은 빛이 푸슝 푸슝 나가요' },
    },
    sseni: { // 쎄니(11-16 밤 3D): 소리굽쇠는 GLB 안 RightHand 뼈 자식. 아이 — 쓰러짐은 「꽃잎에 싸여 쉬는 중」(베리와 같음)
      id: 'sseni', name: '쎄니', model: 'sseni', height: 2.32, kid: true,
      color: 0xa46bff, colorCss: '#a46bff', xray: 0xb07fff, aim: 0xc39bff, charge: [0xd6c0ff, 0xa46bff, 0xfff0a8],
      prop: 'fork', propNode: 'sseni_fork_grip', badge: null, headScale: 1.0, faceCam: [2.6, 4.4, 2.35],
      shot: 'wave', shotName: '퍼플팝', style: { in: 0xe4d2ff, out: 0xa46bff, edge: [0.28, 0.12, 0.5], cell: 'star', spark: [1.8, 1.2, 2.6], stars: true },
      big: 'paint', bigSay: '퍼플팡팡!', ult: 'ult_sseni', // 목소리 녹음 없음 — assets/audio/ult_sseni.mp3 넣고 pack_assets.py 돌리면 재생
      guide: { auto: '가까운 안개에 퍼플팝 보라 별이 저절로 퍼져요', man: '「퍼플팝」 버튼을 꾹! 보라 작은 별들이 퍼져요' },
    },
  };
  TG.ASSISTS = {
    none: { id: 'none', name: '없음' },
    sseni: { id: 'sseni', name: '쎄니', color: 0xa46bff, cheer: 'star', model: 'sseni' },   // 11-16 밤: 3D(주인공과 같은 GLB 두 번째 사본). 기본 소리 퍼플팝(작은 별 1발)·큰 소리 「퍼플팡팡!」 함께
    berri: { id: 'berri', name: '베리', color: 0xff7fb6, cheer: 'flower', model: 'berri' },
  };
  const q = new URLSearchParams(location.search);
  let hero = q.get('hero'), assist = q.get('assist');
  try { if (!hero) hero = localStorage.getItem('tg_hero'); if (!assist) assist = localStorage.getItem('tg_assist'); } catch (e) { /* 없음 */ }
  TG.pickHero = function (h, a, noSave) {
    if (!TG.HEROES[h]) h = 'sefo';
    if (!TG.ASSISTS[a]) a = 'none';
    if (a === h) a = h === 'berri' ? 'sseni' : h === 'sseni' ? 'berri' : 'none'; // 같은 사람을 둘로 두지 않음 (주인공 베리 → 보조 쎄니 / 주인공 쎄니 → 보조 베리)
    TG.heroId = h; TG.assistId = a; TG.hero = TG.HEROES[h]; TG.assist = TG.ASSISTS[a];
    if (!noSave) try { localStorage.setItem('tg_hero', h); localStorage.setItem('tg_assist', a); } catch (e) { /* 저장 안 되는 곳 */ }
    return { hero: h, assist: a };
  };
  TG.pickHero(hero || 'sefo', assist || 'none');
})();
