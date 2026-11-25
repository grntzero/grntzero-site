/* 에코 제로 — 카드 1단계: 카드 도감 80칸 · 카드 받기 · 바꾸기 · 장착 → 능력치 · 세트 · 올리기(1등급 톱니) (2026-11-25 게임팀, 계획 v8 5~7·13·14쪽, 11-19 회의 A안 1,040장)
   · 카드 1,040장 = 13명 × 80장(의상 4 × 배경 4 × 효과 5) + 유니크 13(80칸 밖 별 칸, 도감 완성 조건 X). 등급 1~4단은 같은 칸의 「틀 색」(종류 아님) — 더 높은 등급으로 또 받거나 1등급 톱니(3/6/12개)로 올리면 틀 색만 오름.
   · 받을 때 등급 확률(v8 5쪽, 천장 없음): 1단 59.9% · 2단 25% · 3단 12% · 4단 3% · 유니크 0.1%(그 아티스트 던전에서만). 난수는 규칙 계산(TG.sr)과 따로(Math.random) — 시드·기록 재생·해시에 안 들어감.
   · 얻는 법(결제 없음): 던전 깨면 그 던전 주인 카드 1장(하루 6장) · 첫 클리어 상자(짝수 단계) 카드 +1(하루 상한 밖) · 같은 카드 3장 → 새 카드로 바꾸기(없는 칸 우선). 「뽑기」 말 안 씀. 거래·선물·구매 없음.
   · 장착 3칸(어느 아티스트 카드든) → 능력치 5종(✨소리 크기 · 🌸범위 · 🎵줍기 자석 · ⭐이동 · 🌈큰 소리 충전), 상한 능력 하나 +10% · 합계 +15%(유니크 끼우면 15/20). 세트: 같은 아티스트 10장 칭호 「○○ 팬」 · 30장 응원 1개 켜짐(능력치, 상한 안) · 80장 도감 완성.
   · 끝까지 모드(?rank=1)·기록 재생은 능력치 끔(표준 수치 A안, v8 13-4) — game.js startPlay 가 G.eq 를 null 로. 카드 지급도 끝까지 모드는 서버 몫(12/3)이라 여기선 안 함 [대표 확인].
   · 저장 = 기기(localStorage) ez_w1_cards 하나(베타 판 번호 w1 → TG.W.wipe() 가 같이 지움). 서버(2단계 12/4)는 이 파일의 give/award 를 서버 결과로 바꾸면 됨.
   · 카드 그림(11-25 대표 「카드 그림 제대로」) = 겹쳐 그리기: 틀(등급 색, 코드) + 배경 그림 4(assets/cards/bg_*.webp) + 캐릭터(게임 3D 모델 헤드리스 렌더 ch_<id>_<의상>_<표정>.webp — 11-25 대표 「의상까지 바뀌는 걸로·표정도 여러 가지」: 의상 4 = 포즈 + 옷 색·소품(무대 원래 옷+마이크·별 배지 / 연습 트레이닝복·머리띠·수건·손목밴드 / 축제 축제옷·꽃 화관·망토 / 반짝 금빛·왕관·별), 표정 4(웃음·윙크·놀람·신남, 칸마다 정해진 규칙 K.exprOf) 전부 코드·텍스처 색 바꾸기(AI 얼굴 생성 0)) + 효과 오버레이 5(fx_*.webp) + 아이콘·이름 띠. 쎄니·베리도 게임 3D 모델 그대로(실제 얼굴·AI 얼굴 X). 주민 8명은 공통 실루엣 「곧 만나요」(대표 11-25 「주민은 나중에」). 유니크 A안 실제 사진은 유니크 날(12/1)에. */
(function () {
  'use strict';
  const TG = window.TG;
  const K = (TG.K = {});
  K.KEY = 'ez_w1_cards';
  K.PER = 80; K.N_OUT = 4; K.N_PLACE = 4; K.N_EFF = 5;
  K.DAY_MAX = 6;                       // 하루 던전 카드 상한(v8 ⑦ 6+6 — 임무 카드 6은 임무가 생기면)
  K.SWAP_N = 3;                        // 같은 카드 3장 → 새 카드 1장(여분 2장 소비, 가진 1장은 그대로)
  K.UP_COST = [null, 3, 6, 12];        // 1→2단 3 · 2→3단 6 · 3→4단 12 (1등급 톱니, 「톱니 조각」은 없앰 — v8 ⑤)
  K.PROB = [59.9, 25, 12, 3, 0.1];     // 1·2·3·4단·유니크 (%) — 화면에 그대로 공개
  K.CAP = { one: 10, total: 15, oneU: 15, totalU: 20 }; // 상한 % (v8 13쪽)
  K.SETS = [10, 30, 80];
  K.UNIQUE_PCT = 8;
  K.GRADES = [null,
    { g: 1, name: '1단', pct: 1, col: '#cfd3dc', ink: '#5b6170' },
    { g: 2, name: '2단', pct: 2, col: '#4cc93a', ink: '#1f5a14' },
    { g: 3, name: '3단', pct: 3, col: '#ffd23f', ink: '#7a5a10' },
    { g: 4, name: '4단', pct: 5, col: '#e5352b', ink: '#7a1a14' }];
  K.UNIQUE = { g: 5, name: '유니크', pct: 8, col: '#7a5cff', ink: '#3a2a8a' };
  // 효과 5종(v8 13쪽 표 — 카드 그림의 표시) · stat = 화면 말 · key = game.js G.eq 칸
  K.EFFECTS = [
    { id: 'spark', name: '반짝', stat: '소리 크기', col: '#ffd23f' },
    { id: 'petal', name: '꽃잎', stat: '범위', col: '#ff8fc4' },
    { id: 'note', name: '음표', stat: '줍기 자석', col: '#4fc3f7' },
    { id: 'star', name: '별', stat: '이동', col: '#a46bff' },
    { id: 'rainbow', name: '무지개', stat: '큰 소리 충전', col: '#4cc93a' }];
  K.OUTFITS = ['무대 옷', '연습 옷', '축제 옷', '반짝 옷'];           // 의상 4(색·무늬) [대표 확인: 이름]
  K.PLACES = [                                                       // 배경 4 = 톱니골 장소 [대표 확인: 이름]
    { id: 'plaza', name: '박동탑 광장', c1: '#ffe9b8', c2: '#e0a860' },
    { id: 'grove', name: '톱니 숲', c1: '#d8f5c0', c2: '#5fae5a' },
    { id: 'neon', name: '네온 거리', c1: '#3a3f8e', c2: '#15163a' },
    { id: 'hill', name: '별빛 언덕', c1: '#6a4fb0', c2: '#2a1a4f' }];
  // 13명(v8 9쪽: 플레이 5 + 주민 8) · dun = 카드가 나오는 던전(주민은 던전이 생기면 적음, 지금은 연습 던전 「모두」 몫) · set = 30장 응원(능력치, v8 13쪽 예 「디제이 = 충전 +2% · 보컬 = 음표 +3%」) [대표 확인: 주민 역할]
  K.ARTISTS = [
    { id: 'sefo', name: '세포', col: '#e5352b', dun: 'sefo_dome', play: true, set: { eff: 'rainbow', pct: 2 } },
    { id: 'gunner', name: '허조교', col: '#a7b04f', dun: 'gunner_camp', play: true, set: { eff: 'spark', pct: 2 } },
    { id: 'moshee', name: '모쉬', col: '#2fe0f0', dun: 'moshee_mirror', play: true, set: { eff: 'rainbow', pct: 2 } },
    { id: 'sseni', name: '쎄니', col: '#a46bff', dun: 'sseni_hall', play: true, kid: true, set: { eff: 'star', pct: 2 } },
    { id: 'berri', name: '베리', col: '#ff7fb6', dun: 'berri_orchard', play: true, kid: true, set: { eff: 'petal', pct: 2 } },
    { id: 'poy', name: '포이', col: '#00c853', dun: null, set: { eff: 'rainbow', pct: 2 } },
    { id: 'loki', name: '로키', col: '#ff9f1c', dun: null, set: { eff: 'note', pct: 3 } },
    { id: 'killaton', name: '킬라톤', col: '#2e7d32', dun: null, set: { eff: 'note', pct: 3 } },
    { id: 'annaconda', name: '애나콘다', col: '#ff5fb8', dun: null, set: { eff: 'note', pct: 3 } },
    { id: 'haena', name: '해나', col: '#ffb300', dun: null, set: { eff: 'note', pct: 3 } },
    { id: 'deta', name: '데타', col: '#c6ff00', dun: null, set: { eff: 'petal', pct: 2 } },
    { id: 'rogun', name: '로건', col: '#3d7bff', dun: null, set: { eff: 'star', pct: 2 } },
    { id: 'woad', name: '오드', col: '#ff6f61', dun: null, set: { eff: 'spark', pct: 2 } }];
  K.byId = {}; K.ARTISTS.forEach((a) => (K.byId[a.id] = a));
  K.TOTAL = K.ARTISTS.length * K.PER; // 1,040
  K.ownerOf = (dun) => { const a = K.ARTISTS.find((x) => x.dun === dun); return a ? a.id : null; };

  // ── 칸 ↔ 의상·배경·효과 ──  idx 0~79: 의상 = idx÷20, 배경 = (idx÷5)%4, 효과 = idx%5
  K.parts = (idx) => ({ out: (idx / 20) | 0, place: ((idx / 5) | 0) % 4, eff: idx % 5 });
  K.cid = (artist, idx) => artist + ':' + idx;
  K.uid = (artist) => artist + ':U';
  K.split = (id) => { const i = id.indexOf(':'); return { artist: id.slice(0, i), idx: id.slice(i + 1) === 'U' ? 'U' : parseInt(id.slice(i + 1), 10) }; };
  K.isUnique = (id) => id.slice(-2) === ':U';
  K.name = (id) => { const s = K.split(id), a = K.byId[s.artist]; if (!a) return ''; if (s.idx === 'U') return a.name + ' 유니크'; const p = K.parts(s.idx); return a.name + ' · ' + K.OUTFITS[p.out] + ' · ' + K.PLACES[p.place].name; };
  K.effOf = (id) => { const s = K.split(id); if (s.idx === 'U') return K.EFFECTS.findIndex((e) => e.id === K.byId[s.artist].set.eff); return K.parts(s.idx).eff; }; // 유니크 능력치 = 그 아티스트 응원 종류 [대표 확인]

  // ── 저장 ──
  const blank = () => ({ v: 1, c: {}, u: {}, eq: [null, null, null], day: '', dayN: 0, got: 0, boxSeen: 0, swaps: 0, ups: 0, updated: 0 });
  K.data = blank();
  K.load = function () {
    let d = null; try { d = JSON.parse(localStorage.getItem(K.KEY) || 'null'); } catch (e) { d = null; }
    K.data = blank();
    if (d && typeof d === 'object' && d.v === 1) { for (const k of Object.keys(K.data)) if (d[k] != null) K.data[k] = d[k]; }
    if (!K.data.c || typeof K.data.c !== 'object') K.data.c = {}; if (!K.data.u || typeof K.data.u !== 'object') K.data.u = {};
    if (!Array.isArray(K.data.eq) || K.data.eq.length !== 3) K.data.eq = [null, null, null];
    K.data.eq = K.data.eq.map((id) => (id && K.has(id) ? id : null));
    K.syncBox();
    return K.data;
  };
  K.save = function () { K.data.updated = Date.now(); try { localStorage.setItem(K.KEY, JSON.stringify(K.data)); } catch (e) { /* 무시 */ } };
  K.reset = function () { try { localStorage.removeItem(K.KEY); } catch (e) { /* 무시 */ } K.data = blank(); if (TG.W) K.data.boxSeen = TG.W.data.cards | 0; return K.snap(); };
  // 지갑에 「받을 몫」으로만 세어 둔 첫 클리어 상자 카드(11-24, W.data.cards)를 실제 카드로 — 지갑 숫자(누적)는 그대로 두고 여기서 몇 장까지 바꿨는지(boxSeen) 기억
  K.syncBox = function () {
    const W = TG.W; if (!W) return [];
    const pending = (W.data.cards | 0) - (K.data.boxSeen | 0), out = [];
    for (let i = 0; i < pending; i++) out.push(K.give(K.ARTISTS[(K.rng() * K.ARTISTS.length) | 0].id, null, K.roll(false)));
    if (pending > 0) { K.data.boxSeen = W.data.cards | 0; K.save(); }
    return out;
  };
  K.today = () => (TG.W ? TG.W.today() : new Date().toISOString().slice(0, 10));
  K.dayN = () => (K.data.day === K.today() ? (K.data.dayN | 0) : 0);

  // ── 받기 ──
  K.rng = Math.random;                 // 규칙 난수(TG.sr)와 따로 — 시드·재생에 안 들어감
  K._force = [];                       // 시험용: 다음 등급 강제 큐 (1~4 또는 'U')
  K._cell = [];                        // 시험용: 다음 칸 강제 큐 (0~79)
  K.roll = function (uniqueOk) {       // 돌려줌 1~4 또는 'U'
    if (K._force.length) { const f = K._force.shift(); return f === 'U' && !uniqueOk ? 4 : f; }
    const r = K.rng() * 100; let acc = 0;
    for (let g = 0; g < 4; g++) { acc += K.PROB[g]; if (r < acc) return g + 1; }
    return uniqueOk ? 'U' : 4;        // 남은 0.1%: 그 아티스트 던전이면 유니크, 아니면 4단
  };
  K.has = (id) => (K.isUnique(id) ? !!K.data.u[K.split(id).artist] : !!K.data.c[id]);
  K.pickCell = function (artist, preferMissing) {
    if (K._cell.length) return K._cell.shift();
    if (preferMissing) { const miss = []; for (let i = 0; i < K.PER; i++) if (!K.data.c[K.cid(artist, i)]) miss.push(i); if (miss.length) return miss[(K.rng() * miss.length) | 0]; }
    return (K.rng() * K.PER) | 0;
  };
  // 카드 1장 넣기. idx null = 무작위 칸, g = 1~4 또는 'U'. 돌려줌 = 결과 화면용
  K.give = function (artist, idx, g, preferMissing) {
    const a = K.byId[artist]; if (!a) return null;
    if (g === 'U') {
      if (!K.data.u[artist]) { K.data.u[artist] = 1; K.data.got++; K.save(); return { id: K.uid(artist), artist, idx: 'U', g: 5, unique: true, isNew: true, up: false, n: 1 }; }
      g = 4; // 유니크를 또 받으면 4단 카드로 [대표 확인]
    }
    if (idx == null) idx = K.pickCell(artist, !!preferMissing);
    const id = K.cid(artist, idx); let c = K.data.c[id]; const isNew = !c;
    if (!c) c = K.data.c[id] = { g: g, n: 1 }; else { c.n += 1; }
    const up = !isNew && g > c.g; if (up) c.g = g;
    K.data.got++; K.save();
    return { id, artist, idx, g: c.g, got: g, unique: false, isNew, up, n: c.n };
  };
  // 한 판 깨면(game.js finish, 지갑 payout 뒤). o = { dun, lv, box(첫 클리어 상자 카드 +1 있음) }
  K.award = function (o) {
    const owner = K.ownerOf(o.dun), artist = owner || K.ARTISTS[(K.rng() * K.ARTISTS.length) | 0].id; // 주인 없는 연습 던전 = 13명 중 무작위 [대표 확인]
    const before = K.dayN(), capped = before >= K.DAY_MAX, cards = [];
    if (!capped) { cards.push(K.give(artist, null, K.roll(!!owner))); K.data.day = K.today(); K.data.dayN = before + 1; }
    let boxCard = null;
    if (o.box) { boxCard = K.give(artist, null, K.roll(!!owner)); cards.push(boxCard); boxCard.box = true; }
    if (TG.W) K.data.boxSeen = TG.W.data.cards | 0; // 상자 몫은 여기서 바로 실제 카드로 줬으니 지갑 누적 숫자와 맞춤
    K.save();
    return { artist, artistName: K.byId[artist].name, cards, capped, dayN: K.dayN(), dayMax: K.DAY_MAX, box: !!o.box, set: K.setInfo(artist) };
  };
  // 같은 카드 3장 → 새 카드 1장(같은 아티스트, 없는 칸 우선 — v8 ⑧). 가진 1장은 그대로, 여분 2장 소비
  K.canSwap = (id) => { const c = K.data.c[id]; return !!c && c.n >= K.SWAP_N; };
  K.swap = function (id) {
    if (!K.canSwap(id)) return null;
    const s = K.split(id); K.data.c[id].n -= (K.SWAP_N - 1); K.data.swaps++;
    const got = K.give(s.artist, null, K.roll(false), true); got.swapFrom = id; K.save(); return got;
  };
  // 1등급 톱니로 등급 올리기(3/6/12개, js/wallet.js W.spend). 4단·유니크는 못 올림
  K.upCost = (id) => { const c = K.data.c[id]; return !c || c.g >= 4 ? 0 : K.UP_COST[c.g]; };
  K.canUp = (id) => { const n = K.upCost(id); return n > 0 && !!TG.W && TG.W.data.g[1] >= n; };
  K.upgrade = function (id) {
    const n = K.upCost(id); if (!n || !TG.W || !TG.W.spend(1, n)) return false;
    K.data.c[id].g += 1; K.data.ups++; K.save(); return true;
  };
  // 장착 3칸(어느 아티스트 카드든) — 같은 카드는 한 칸만
  K.equip = function (slot, id) {
    slot |= 0; if (slot < 0 || slot > 2) return false;
    if (id == null) { K.data.eq[slot] = null; K.save(); return true; }
    if (!K.has(id)) return false;
    for (let i = 0; i < 3; i++) if (K.data.eq[i] === id) K.data.eq[i] = null;
    K.data.eq[slot] = id; K.save(); return true;
  };
  K.slotOf = (id) => K.data.eq.indexOf(id);
  K.cardPct = (id) => (K.isUnique(id) ? K.UNIQUE_PCT : K.GRADES[K.data.c[id] ? K.data.c[id].g : 1].pct);
  // 세트: 그 아티스트 80칸 중 가진 수(유니크는 안 셈 — 완성 조건 밖)
  K.count = (artist) => { let n = 0; for (let i = 0; i < K.PER; i++) if (K.data.c[K.cid(artist, i)]) n++; return n; };
  K.total = () => { let n = 0; for (const id in K.data.c) if (K.data.c[id]) n++; return n; };
  K.setInfo = (artist) => { const n = K.count(artist), a = K.byId[artist]; return { n, fan: n >= K.SETS[0], cheer: n >= K.SETS[1], full: n >= K.SETS[2], title: n >= K.SETS[0] ? a.name + ' 팬' : null, cheerEff: a.set.eff, cheerPct: a.set.pct }; };
  // 장착 능력치(%) — 카드 3칸 + 30장 세트 응원, 상한 능력 하나 10 · 합계 15(유니크 끼우면 15/20). 돌려줌 { spark, petal, note, star, rainbow, raw, total, hasU, cap }
  K.bonusPct = function () {
    const sum = {}; K.EFFECTS.forEach((e) => (sum[e.id] = 0)); let hasU = false;
    K.data.eq.forEach((id) => { if (!id || !K.has(id)) return; if (K.isUnique(id)) hasU = true; sum[K.EFFECTS[K.effOf(id)].id] += K.cardPct(id); });
    K.ARTISTS.forEach((a) => { if (K.count(a.id) >= K.SETS[1]) sum[a.set.eff] += a.set.pct; });
    const raw = Object.assign({}, sum), one = hasU ? K.CAP.oneU : K.CAP.one, totalCap = hasU ? K.CAP.totalU : K.CAP.total;
    let total = 0; K.EFFECTS.forEach((e) => { sum[e.id] = Math.min(one, sum[e.id]); total += sum[e.id]; });
    if (total > totalCap) { const k = totalCap / total; K.EFFECTS.forEach((e) => (sum[e.id] = +(sum[e.id] * k).toFixed(2))); total = totalCap; }
    sum.raw = raw; sum.total = +total.toFixed(2); sum.hasU = hasU; sum.cap = { one, total: totalCap };
    return sum;
  };
  K.bonus = function () { const b = K.bonusPct(); const o = {}; K.EFFECTS.forEach((e) => (o[e.id] = b[e.id] / 100)); o.total = b.total / 100; return o; }; // game.js G.eq (비율)
  K.snap = function () {
    const owned = {}; K.ARTISTS.forEach((a) => (owned[a.id] = K.count(a.id)));
    return { total: K.total(), max: K.TOTAL, owned, uniques: Object.keys(K.data.u), eq: K.data.eq.slice(), bonus: K.bonusPct(), dayN: K.dayN(), dayMax: K.DAY_MAX, got: K.data.got, swaps: K.data.swaps, ups: K.data.ups, boxSeen: K.data.boxSeen, key: K.KEY, cards: Object.keys(K.data.c).length };
  };
  K.card = (id) => { if (!K.has(id)) return null; const s = K.split(id); if (s.idx === 'U') return { id, artist: s.artist, idx: 'U', g: 5, n: 1, unique: true }; const c = K.data.c[id]; return { id, artist: s.artist, idx: s.idx, g: c.g, n: c.n, unique: false }; };

  // ── 그림(11-25 「카드 그림 제대로」): 겹쳐 그리기 = 틀(등급 색, 코드) + 배경 그림 4(assets/cards/bg_*.webp, 힉스필드) + 캐릭터(게임 3D 모델을 헤드리스로 렌더한 ch_<id>_<의상>_<표정>.webp — 의상 4 = 포즈 + 옷 색·소품, 표정 4 = 칸 규칙 K.exprOf, 실제 얼굴·AI 얼굴 X) + 효과 오버레이 5(fx_*.webp, 힉스필드 투명) + 효과 아이콘 + 이름 띠.
  //    주민 8명(포이~오드)은 캐릭터 그림이 아직 없음(대표 11-25 「나중에」) → 같은 틀·배경·효과에 공통 실루엣 + 「곧 만나요」. 잠긴 칸 = 배경 흐리게 + 캐릭터 어두운 실루엣 + ?. 같은 그림은 캐시. ──
  K.ASSET = 'assets/cards/';
  const EFF_PATH = { // 44×44 좌표계 가운데 (22,22)
    spark: '<path d="M22 6 L25 19 L38 22 L25 25 L22 38 L19 25 L6 22 L19 19 Z" fill="#fff"/>',
    petal: '<g fill="#fff"><ellipse cx="22" cy="12" rx="5" ry="8"/><ellipse cx="22" cy="32" rx="5" ry="8"/><ellipse cx="12" cy="22" rx="8" ry="5"/><ellipse cx="32" cy="22" rx="8" ry="5"/><circle cx="22" cy="22" r="4" fill="#ffd23f"/></g>',
    note: '<path d="M18 10 v20 a5 5 0 1 1 -3 -4.6 V10 h12 v14 a5 5 0 1 1 -3 -4.6 V14 Z" fill="#fff"/>',
    star: '<path d="M22 6 L26.5 17 L38 18 L29 25.5 L32 37 L22 30.5 L12 37 L15 25.5 L6 18 L17.5 17 Z" fill="#fff"/>',
    rainbow: '<g fill="none" stroke-width="3.2" stroke-linecap="round"><path d="M8 32 a14 14 0 0 1 28 0" stroke="#ff6a4a"/><path d="M12.5 32 a9.5 9.5 0 0 1 19 0" stroke="#ffd23f"/><path d="M17 32 a5 5 0 0 1 10 0" stroke="#4fc3f7"/></g>',
  };
  K.effIcon = (eff, size) => { const e = K.EFFECTS[eff]; return '<svg class="kEff" viewBox="0 0 44 44" aria-label="' + e.name + '" role="img"' + (size ? ' width="' + size + '" height="' + size + '"' : '') + '><circle cx="22" cy="22" r="20" fill="' + e.col + '" stroke="#1b1424" stroke-width="2"/>' + EFF_PATH[e.id] + '</svg>'; };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const OUT_GLOW = ['#fff3b0', '#bfe9ff', '#ffd0e8', '#fff9c4']; // 의상별 캐릭터 뒤 빛(무대 노랑 · 연습 하늘 · 축제 분홍 · 반짝 크림)
  // 파일 이름: 캐릭터 그림은 플레이 5명만(play:true). 주민은 null → 실루엣
  K.EXPRS = ['웃음', '윙크', '놀람', '신남'];                       // 표정 4(11-25 「표정도 여러 가지」) — 그림 파일 이름 ch_<id>_<의상>_<표정>.webp
  K.exprOf = (p) => (p.place + p.eff) % 4;                          // 칸마다 정해진 표정(배경+효과 번호, 저장 데이터·규칙과 무관 — 같은 칸은 늘 같은 표정, 의상 줄 20칸 안에 4표정이 섞임)
  K.artFiles = (id) => { const s = K.split(id), a = K.byId[s.artist]; if (!a) return null; const p = s.idx === 'U' ? { out: 3, place: 0, eff: K.effOf(id) } : K.parts(s.idx), ch = 'ch_' + a.id + '_' + p.out + '_' + K.exprOf(p);
    return { bg: K.ASSET + 'bg_' + K.PLACES[p.place].id + '.webp', bgS: K.ASSET + 'bg_' + K.PLACES[p.place].id + '_s.webp', ch: a.play ? K.ASSET + ch + '.webp' : null, chS: a.play ? K.ASSET + ch + '_s.webp' : null, fx: K.ASSET + 'fx_' + K.EFFECTS[p.eff].id + '.webp', expr: K.EXPRS[K.exprOf(p)] }; };
  // 주민 공통 실루엣(얼굴 없음): 둥근 머리 + 몸 + 음표, 아티스트 색 반투명
  const silArt = (a, dark) => { const c = dark ? '#2a2238' : shade(a.col, -0.15); return '<g opacity="' + (dark ? '0.8' : '0.85') + '"><ellipse cx="50" cy="112" rx="22" ry="4" fill="#1b1424" opacity="0.25"/><rect x="34" y="72" width="32" height="38" rx="12" fill="' + c + '"/><rect x="25" y="78" width="9" height="20" rx="4.5" fill="' + c + '"/><rect x="66" y="78" width="9" height="20" rx="4.5" fill="' + c + '"/><circle cx="50" cy="58" r="15" fill="' + c + '"/>' + (dark ? '' : '<path d="M56 86 v12 a3.5 3.5 0 1 1 -2.2 -3.2 V84 l9 -2 v10 a3.5 3.5 0 1 1 -2.2 -3.2 V85 z" fill="#fff" opacity="0.9"/>') + '</g>'; };
  let artN = 0; const artCache = {};
  // K.art(id, g, size) → SVG 글. g = 등급(1~4, 5 = 유니크). 모르는 칸(실루엣)은 K.art(id, 0)
  K.art = function (id, g, size) {
    const key = id + '/' + g + '/' + (size || 0); if (artCache[key]) return artCache[key];
    const s = K.split(id), a = K.byId[s.artist] || K.ARTISTS[0], unique = s.idx === 'U', p = unique ? { out: 3, place: 0, eff: K.effOf(id) } : K.parts(s.idx);
    const G = unique ? K.UNIQUE : K.GRADES[g || 1], uid = 'ka' + (artN++), locked = g === 0, F = K.artFiles(id);
    let h = '<svg class="kArt' + (locked ? ' lock' : '') + '" viewBox="0 0 100 140" role="img" aria-label="' + (locked ? '아직 없는 카드' : K.name(id)) + '"' + (size ? ' width="' + size + '" height="' + Math.round(size * 1.4) + '"' : '') + '>';
    h += '<defs><linearGradient id="' + uid + 'f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + shade(G.col, 0.55) + '"/><stop offset="0.45" stop-color="' + G.col + '"/><stop offset="1" stop-color="' + shade(G.col, -0.35) + '"/></linearGradient>'
      + (unique ? '<linearGradient id="' + uid + 'u" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="0.5" stop-color="#7a5cff"/><stop offset="1" stop-color="#2fe0f0"/></linearGradient>' : '')
      + '<radialGradient id="' + uid + 'g" cx="0.5" cy="0.62" r="0.5"><stop offset="0" stop-color="' + OUT_GLOW[p.out] + '" stop-opacity="0.85"/><stop offset="1" stop-color="' + OUT_GLOW[p.out] + '" stop-opacity="0"/></radialGradient>'
      + '<clipPath id="' + uid + 'c"><rect x="7" y="7" width="86" height="110" rx="6"/></clipPath>'
      + (locked ? '<filter id="' + uid + 's" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.22  0 0 0 0.85 0"/></filter>' : '') + '</defs>';
    // 틀(등급 색 그라데이션 / 유니크 무지개) + 안쪽 테두리 선
    h += '<rect x="1.5" y="1.5" width="97" height="137" rx="10" fill="' + (unique ? 'url(#' + uid + 'u)' : 'url(#' + uid + 'f)') + '" stroke="#1b1424" stroke-width="3"/>';
    h += '<rect x="5" y="5" width="90" height="114" rx="7.5" fill="none" stroke="' + (unique ? '#fff' : shade(G.col, 0.7)) + '" stroke-width="1.2" opacity="0.9"/>';
    // 안: 배경 그림 → 의상 빛 → 그림자 → 캐릭터(렌더 webp / 주민 실루엣) → 효과 오버레이
    h += '<g clip-path="url(#' + uid + 'c)">';
    h += '<image href="' + F.bg + '" x="7" y="7" width="86" height="110" preserveAspectRatio="xMidYMid slice"' + (locked ? ' opacity="0.4"' : '') + '/>';
    if (!locked) h += '<ellipse cx="50" cy="78" rx="40" ry="42" fill="url(#' + uid + 'g)"/>';
    if (!locked) h += '<ellipse cx="50" cy="113" rx="24" ry="4.5" fill="#1b1424" opacity="0.28"/>';
    if (F.ch) h += '<image href="' + F.ch + '" x="7" y="12" width="86" height="104" preserveAspectRatio="xMidYMax meet"' + (locked ? ' filter="url(#' + uid + 's)"' : '') + '/>';
    else h += silArt(a, locked);
    if (!locked) h += '<image href="' + F.fx + '" x="7" y="7" width="86" height="110" preserveAspectRatio="xMidYMid slice" opacity="0.95"/>';
    h += '</g>';
    if (locked) h += '<rect x="7" y="7" width="86" height="110" rx="6" fill="#2a2238" opacity="0.35"/><text x="50" y="72" text-anchor="middle" font-size="28" font-weight="900" fill="#fff" stroke="#1b1424" stroke-width="1.5" paint-order="stroke">?</text>';
    // 등급 3·4단·유니크: 네 귀퉁이 보석
    if (!locked && (unique || g >= 3)) { const gem = unique ? '#fff' : shade(G.col, 0.75); [[7.5, 7.5], [92.5, 7.5], [7.5, 116.5], [92.5, 116.5]].forEach((c) => { h += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="2.6" fill="' + gem + '" stroke="#1b1424" stroke-width="1"/>'; }); }
    h += '<g transform="translate(66 10) scale(0.6)">' + K.effIcon(p.eff).replace('<svg class="kEff" viewBox="0 0 44 44"', '<svg viewBox="0 0 44 44" width="44" height="44"') + '</g>';
    h += '<rect x="7" y="117" width="86" height="17" rx="4" fill="#fff6e0" stroke="#1b1424" stroke-width="1.5"/>';
    h += '<text x="50" y="129.5" text-anchor="middle" font-size="9.5" font-weight="900" fill="#1b1424">' + (locked ? '?' : unique ? a.name + ' 유니크' : F.ch ? a.name + ' · ' + K.OUTFITS[p.out] : a.name + ' · 곧 만나요') + '</text>';
    if (!locked) h += '<text x="12" y="19" font-size="9" font-weight="900" fill="' + G.ink + '" stroke="#fff" stroke-width="2.4" paint-order="stroke">' + (unique ? '★' : G.name) + '</text>';
    h += '</svg>';
    return (artCache[key] = h);
  };
  K.probText = () => '받을 때 등급: 1단 ' + K.PROB[0] + '% · 2단 ' + K.PROB[1] + '% · 3단 ' + K.PROB[2] + '% · 4단 ' + K.PROB[3] + '% · 유니크 ' + K.PROB[4] + '%(그 아티스트 던전에서만 · 보장 없음)';
  K.load();
})();
