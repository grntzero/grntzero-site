/* GRUNT ZERO RE — 비서 그런트 (2026-11-13)
   검정·골드 로봇 비서. 말풍선 + 11-14 확정 목소리 grunt 「묵직 큰형」(js/assist_voice.js — 허조교 목소리가 우선, 겹치면 비서가 건너뜀).
   · 타이틀: 왼쪽 아래에서 태블릿 들고 브리핑 (난이도·공격 고르면 말이 바뀜)
   · 경기 중: 오른쪽 위(웨이브 표시 아래) 작은 무전 — 웨이브 시작·보스·보스 단계·체력 낮음
   · 결과: 패널 왼쪽 — 승리 cheer → 등급별 smile/ok, 패배 bow 「다시 가 봐요」
   DOM 은 상태가 바뀔 때만 건드림. 매 프레임 update 는 숫자 몇 개만 봄. 그림이 하나라도 안 뜨면 조용히 전부 숨김. */
(function () {
  'use strict';
  const GZ = window.GZ;
  const AS = (GZ.AS = {});
  const POSES = ['front', 'basic', 'smile', 'wink', 'think', 'surprise', 'bow', 'cheer', 'ok'];
  const DIR = 'assets/img/assistant/grunt/';
  const src = (p) => DIR + p + '.webp';
  let ok = true, nT = null, nR = null, nA = null;
  let radioT = 0, radioQ = null, radioWait = 0, resTok = 0, lowT = -99;

  function make(cls, host) {
    if (!host) return null;
    const w = document.createElement('div');
    w.className = 'gt ' + cls + ' hide';
    w.innerHTML = '<div class="gtb"><span></span></div><img class="gti" alt="" draggable="false">';
    host.appendChild(w);
    return { w, b: w.querySelector('.gtb span'), i: w.querySelector('img') };
  }
  function setPose(n, pose) {
    if (n.pose !== pose) { n.pose = pose; n.i.src = src(pose); n.w.dataset.pose = pose; }
  }
  function pop(n) { n.w.classList.remove('pop'); void n.w.offsetWidth; n.w.classList.add('pop'); }
  function put(n, pose, txt, anim) {
    if (!ok || !n) return;
    setPose(n, pose);
    if (n.b.textContent !== txt) n.b.textContent = txt;
    n.w.classList.remove('hide');
    if (anim !== false) pop(n);
    try { if (GZ.ASV) GZ.ASV.say(txt, () => !n.w.classList.contains('hide') && n.b.textContent === txt); } catch (e) { /* 목소리는 없어도 됨 */ }
  }
  function hide(n) { if (n) n.w.classList.add('hide'); }

  AS.init = function () {
    const $ = (id) => document.getElementById(id);
    nT = make('gtTitle', $('title'));
    nR = make('gtRes', $('result'));
    nA = make('gtRadio', $('hud'));
    if (nA) nA.w.insertAdjacentHTML('afterbegin', '<i class="gtLbl">무전 · 비서 그런트</i>');
    // 미리 받아 둠 — 하나라도 실패하면 비서는 조용히 숨김 (게임은 그대로)
    let left = POSES.length;
    for (const p of POSES) {
      const im = new Image();
      im.onload = () => { left--; };
      im.onerror = () => { ok = false; document.body.classList.add('noGt'); };
      im.src = src(p);
    }
    AS.ready = () => ok && left === 0;
    // 11-14 비서 목소리: 대사 묶음 → 목소리 엔진 차례로 (index.html 은 그대로). 못 불러오면 말풍선만
    ['js/pack_assist_voice.js', 'js/assist_voice.js'].forEach((u) => { const sc = document.createElement('script'); sc.src = u; sc.async = false; document.head.appendChild(sc); });
  };

  // ---------- 타이틀 브리핑 ----------
  AS.title = function () {
    if (!nT) return;
    resTok++;
    put(nT, 'front', '브리핑 시작합니다. 난이도와 공격 방식을 골라 주세요');
  };
  // 고를 때만 바뀜 (타이틀이 보일 때만)
  AS.pick = function (what, v) {
    if (!nT || !GZ.G || GZ.G.phase !== 'title') return;
    if (what === 'diff') put(nT, v === 'easy' ? 'smile' : 'ok', v === 'easy' ? '훈련병이에요. 쓰러져도 두 번 더 일어날 수 있어요' : '정규 작전이에요. 무전으로 곁에서 도울게요');
    else put(nT, v === 'auto' ? 'wink' : 'basic', v === 'auto' ? '호각은 자동이에요. 이동과 구르기에 집중해요' : '발밑 고리가 번쩍일 때 누르면 「정박」이에요');
  };

  // ---------- 경기 중 무전 ----------
  // delay: 몇 초 뒤에. 띠 글자·외침이 떠 있으면 끝날 때까지 기다림 (6초 넘게 밀리면 버림)
  AS.radio = function (txt, pose, dur, delay) {
    if (!ok || !nA) return;
    radioQ = { txt, pose: pose || 'basic', dur: dur || 3.2 }; radioWait = delay || 0;
    radioQ.age = 0;
  };
  AS.radioOff = function () { radioQ = null; radioT = 0; hide(nA); if (GZ.ASV) GZ.ASV.stop(); };
  const WAVE_LINES = [
    ['1웨이브예요. 톱니 드론이 앞쪽에서 와요', 'basic'],
    ['2웨이브, 방패병엔 「차렷!」이 잘 들어요', 'ok'],
    ['3웨이브, 흡수기·메트로놈까지 나와요', 'think'],
  ];
  AS.wave = function (i) { const l = WAVE_LINES[i]; if (l) AS.radio(l[0], l[1], 3.4, 0.2); };
  AS.boss = function () { AS.radio('보스 등장! 붉은 고리는 제가 알려 드릴게요', 'surprise', 3.4, 0.7); };
  AS.bossPhase = function (ph) {
    const l = ph === 2 ? ['광선이 돌아요. 따라 돌면 괜찮아요', 'think'] : ph === 3 ? ['피스톤이 떨어져요. 멈추지 말아요', 'think'] : ['마지막 단계예요. 끝까지 함께해요', 'ok'];
    AS.radio(l[0], l[1], 3.0, 0.3);
  };
  // 체력이 바뀔 때만 HUD 가 부름
  AS.hp = function (k, t) {
    if (k > 0 && k < 0.3 && t - lowT > 25) { lowT = t; AS.radio('체력이 낮아요! 구르기로 거리를 벌려요', 'surprise', 2.8, 0); }
  };
  AS.update = function (dt, busy) {
    if (radioT > 0) { radioT -= dt; if (radioT <= 0) hide(nA); }
    if (!radioQ) return;
    radioQ.age += dt;
    if (radioWait > 0) { radioWait -= dt; return; }
    if (busy) { if (radioQ.age > 6) radioQ = null; return; }
    const q = radioQ; radioQ = null;
    put(nA, q.pose, q.txt); radioT = q.dur;
  };

  // ---------- 결과 ----------
  AS.result = function (d) {
    if (!nR) return;
    AS.radioOff(); lowT = -99;
    const tok = ++resTok;
    if (!d.win) { put(nR, 'bow', '수고하셨어요. 다시 가 봐요'); return; }
    put(nR, 'cheer', '해냈어요! 도시의 박동이 돌아왔어요');
    const g = d.grade;
    const next = g === 'S' ? ['cheer', 'S 등급! 완벽한 점호였어요'] : g === 'A' ? ['smile', 'A 등급, 훌륭해요. S까지 한 걸음이에요'] : ['ok', '임무 완수! 다음엔 한 등급 더 올려 봐요'];
    setTimeout(() => { if (tok === resTok && GZ.G && GZ.G.phase === 'result') put(nR, next[0], next[1]); }, 1900);
  };
  AS.reset = function () { AS.radioOff(); lowT = -99; resTok++; };
})();
