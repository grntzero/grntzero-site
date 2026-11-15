/* 톱니골 던전 — 주인공·보조 캐릭터 설정 (2026-11-16 베리 추가). 설정 파일과 그림(GLB)은 따로(기획서 0절 8)
   주인공: SEFO(기본) · BERRI. 보조(쎄니·베리, 기획서 ⑦-A-4): 주인공 뒤를 따라다님, 판정 없음, 카드 적용 없음.
   고르는 법: 주인공이 베리면 보조는 쎄니만. 지금은 「없음」도 둠(끝까지 모드 전까지 — 기존 SEFO 한 판은 그대로).
   저장: localStorage tg_hero / tg_assist, 시험: ?hero=berri&assist=sseni */
(function () {
  'use strict';
  const TG = window.TG;
  TG.HEROES = {
    sefo: {
      id: 'sefo', name: 'SEFO', model: 'sefo', height: 2.87, kid: false,
      color: 0xe5352b, colorCss: '#e5352b', xray: 0xf0483c, aim: 0xff6a4a, charge: [0xff8a5b, 0xe5352b, 0xffd966],
      prop: 'mega', badge: '34', headScale: 0.93, shot: 'wave', shotName: '소리 방울', big: 'jump', bigSay: '다 같이 손 머리 위로!',
    },
    berri: {
      id: 'berri', name: 'BERRI', model: 'berri', height: 2.62, kid: true,
      color: 0xff7fb6, colorCss: '#ff7fb6', xray: 0xff8fc4, aim: 0xff9ccb, charge: [0xffb3d6, 0xff7fb6, 0xfff0a8],
      prop: 'wand', badge: null, headScale: 1.0, shot: 'berry', shotName: '베리 방울', big: 'flower', bigSay: '꽃 피었다!',
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
