/* 톱니골 던전 — 주인공·보조 캐릭터 설정 (2026-11-16 베리·허조교·MOSHEE 추가). 설정 파일과 그림(GLB)은 따로(기획서 0절 8)
   주인공: SEFO(기본) · BERRI · 허조교(GUNNER, 기획서 ④ 2번: 삑! 직선 음표 / 열 맞춰! 한 줄 관통) · MOSHEE(회의록 추천안: 픽셀 빛줄 벽 한 번 튕김 / 픽셀 하트 날아가 벽에서 넷으로). 보조(쎄니·베리, 기획서 ⑦-A-4): 주인공 뒤를 따라다님, 판정 없음, 카드 적용 없음.
   주인공 GLB 는 고른 것만 따로 받음(js/assets.js M.hero) — 설정은 여기, 묶음은 js/pack_hero_<model>.js
   고르는 법: 주인공이 베리면 보조는 쎄니만. 지금은 「없음」도 둠(끝까지 모드 전까지 — 기존 SEFO 한 판은 그대로).
   11-16 대표: 화면에 보이는 이름은 전부 한글(세포·허조교·모쉬·베리·쎄니) — 코드 키(sefo·gunner·moshee·berri)는 그대로. 타이틀 주인공 순서 세포·허조교·모쉬·쎄니(3D 전 「준비 중」)·베리
   저장: localStorage tg_hero / tg_assist, 시험: ?hero=berri&assist=sseni */
(function () {
  'use strict';
  const TG = window.TG;
  TG.HEROES = {
    sefo: {
      id: 'sefo', name: '세포', model: 'sefo', height: 2.87, kid: false,
      color: 0xe5352b, colorCss: '#e5352b', xray: 0xf0483c, aim: 0xff6a4a, charge: [0xff8a5b, 0xe5352b, 0xffd966],
      prop: 'mega', propNode: null, badge: '34', headScale: 0.93, shot: 'wave', shotName: '소리 방울', big: 'jump', bigSay: '다 같이 손 머리 위로!',
    },
    berri: {
      id: 'berri', name: '베리', model: 'berri', height: 2.62, kid: true,
      color: 0xff7fb6, colorCss: '#ff7fb6', xray: 0xff8fc4, aim: 0xff9ccb, charge: [0xffb3d6, 0xff7fb6, 0xfff0a8],
      prop: 'wand', propNode: 'berri_wand_grip', badge: null, headScale: 1.0, shot: 'berry', shotName: '베리 방울', big: 'flower', bigSay: '꽃 피었다!',
      guide: { auto: '가까운 안개에 베리 방울이 저절로 굴러가요', man: '「소리」 버튼을 꾹! 베리 방울이 데굴데굴 굴러가요' },
    },
    gunner: { // 허조교(SGT.GUNNER): 호루라기는 GLB 안 Spine 뼈 자식(tools/build_gunner.py). 어른 — 쓰러짐·보스 연출은 SEFO 와 같음
      id: 'gunner', name: '허조교', model: 'gunner', height: 2.8, kid: false,
      color: 0xa7b04f, colorCss: '#a7b04f', xray: 0xb9c25a, aim: 0xd8e26c, charge: [0xdce383, 0xa7b04f, 0xffe88a],
      prop: 'whistle', propNode: 'gunner_whistle_mount', badge: null, headScale: 1.0, faceCam: [2.78, 3.75, 2.48], shot: 'whistle', shotName: '호루라기 음표', big: 'line', bigSay: '열 맞춰!',
      guide: { auto: '가까운 안개에 삑! 호루라기 음표가 저절로 날아가요', man: '「소리」 버튼을 꾹! 삑! 호루라기 음표가 쭉 날아가요' },
    },
    moshee: { // MOSHEE: 큐브 머리 화면 표정 7종(tools/build_moshee.py 아틀라스, js/player.js PL.face), 붐박스는 GLB 안 RightHand 뼈 자식. 어른 — 쓰러짐·보스 연출은 SEFO 와 같음
      id: 'moshee', name: '모쉬', model: 'moshee', height: 2.7, kid: false,
      color: 0x2fe0f0, colorCss: '#2fe0f0', xray: 0x3de8f5, aim: 0x5df0ff, charge: [0x8ff4ff, 0x2fe0f0, 0xff5fb8],
      prop: 'boombox', propNode: 'moshee_boombox_grip', badge: null, headScale: 1.0, faceCam: [2.7, 4.6, 2.7], rimGlow: true, shot: 'pixel', shotName: '픽셀 빛줄', big: 'heart', bigSay: '픽셀 하트!',
      guide: { auto: '가까운 안개에 픽셀 빛줄이 저절로 날아가요', man: '「소리」 버튼을 꾹! 픽셀 빛줄이 벽에 한 번 튕겨요' },
    },
  };
  TG.ASSISTS = {
    none: { id: 'none', name: '없음' },
    sseni: { id: 'sseni', name: '쎄니', color: 0xa46bff, cheer: 'star', model: null },      // 3D 전까지 보라 별 도형 (이름은 보호자 동의 있음)
    berri: { id: 'berri', name: '베리', color: 0xff7fb6, cheer: 'flower', model: 'berri' },
  };
  const q = new URLSearchParams(location.search);
  let hero = q.get('hero'), assist = q.get('assist');
  try { if (!hero) hero = localStorage.getItem('tg_hero'); if (!assist) assist = localStorage.getItem('tg_assist'); } catch (e) { /* 없음 */ }
  TG.pickHero = function (h, a, noSave) {
    if (!TG.HEROES[h]) h = 'sefo';
    if (!TG.ASSISTS[a]) a = 'none';
    if (a === h) a = h === 'berri' ? 'sseni' : 'none'; // 같은 사람을 둘로 두지 않음 (주인공 베리 → 보조 쎄니만)
    TG.heroId = h; TG.assistId = a; TG.hero = TG.HEROES[h]; TG.assist = TG.ASSISTS[a];
    if (!noSave) try { localStorage.setItem('tg_hero', h); localStorage.setItem('tg_assist', a); } catch (e) { /* 저장 안 되는 곳 */ }
    return { hero: h, assist: a };
  };
  TG.pickHero(hero || 'sefo', assist || 'none');
})();
