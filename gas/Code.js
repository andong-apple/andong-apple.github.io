/** 하늘뫼농원 주문앱 - Code.gs (구글 시트에 연결된 스크립트)
 *  화면은 GitHub Pages(SITE)에 있고, 이 스크립트는 doPost로 데이터만 주고받습니다. */
const VER = 'v15';
const SITE = 'https://andong-apple.github.io/';
const ORD = '현재주문', CFG = '설정', TZ = 'Asia/Seoul';
// 한 주문에 받는 곳이 여러 개면 받는 곳마다 한 줄. 입금자·옵션·수량·금액·상태는 맨 윗줄에만 기록
const HEAD = ['주문번호','주문시각','입금일자','입금자명','연락처','받는사람','받는사람연락처','우편번호','배송지','보낼수량','옵션','수량','금액','상태'];
const DEFAULT = {
  name: '감홍사과',
  intro: '30년 경력 전문 농장에서 정성껏 키운 햇사과입니다.',
  hero: '',
  options: [
    { name: '감홍사과 2kg', tag: '대과', desc: '5 - 6입', price: 25000, stock: 50 },
    { name: '감홍사과 4kg', tag: '대과', desc: '10 - 12입', price: 48000, stock: 50 }
  ],
  sections: [
    { title: '이렇게 특별해요!', items: ['순수 국내 개발 프리미엄 품종', '산도가 낮아 누구에게나 호불호 없는 맛'] },
    { title: '얼마나 맛있게요?', items: ['꽃향기처럼 진하고 깊은 향미', '탄탄한 과육 속 넘치는 과즙'] }
  ],
  ship: '10월 6일부터 순차 발송 가능',
  bank: { bank: '', no: '', holder: '' },
  contact: '',
  maxQty: 10
};

/** 예전 주소(/exec)로 들어온 사람은 새 주문 페이지로 안내 */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:sans-serif;text-align:center;padding:60px 20px;font-size:18px">' +
    '<p>주문 페이지 주소가 바뀌었습니다.</p>' +
    '<p><a href="' + SITE + '" target="_top" style="display:inline-block;margin-top:16px;padding:14px 24px;' +
    'background:#ff7f00;color:#fff;border-radius:12px;text-decoration:none;font-weight:700">주문 페이지로 이동</a></p></div>')
    .setTitle('하늘뫼농원')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- 화면(GitHub Pages)과 데이터를 주고받는 통로 ---------- */
const API = { getPublic: getPublic, submitOrder: submitOrder, login: login, adminData: adminData,
  saveConfig: saveConfig, setStatus: setStatus, newRound: newRound, changePw: changePw,
  cancelOrder: cancelOrder, purgeOld: purgeOld };
function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (!Object.prototype.hasOwnProperty.call(API, req.fn)) throw new Error('잘못된 요청입니다.');
    out = { ok: true, data: API[req.fn].apply(null, req.args || []) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- 비밀번호 (스크립트 속성에 저장: 시트 서식과 무관하게 항상 동일하게 동작) ----------
 * PWV=2: 무작위 소금(SALT) + 반복 해시로 저장된 8자 이상 비밀번호.
 * PWV가 없으면 예전 방식(또는 초기값 1234)이므로 로그인 후 비밀번호 변경을 강제함. */
const PROPS = function () { return PropertiesService.getScriptProperties(); };
function hex_(raw) {
  return raw.map(function (b) { b = (b < 0 ? b + 256 : b).toString(16); return b.length === 1 ? '0' + b : b; }).join('');
}
function hash_(p) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'apple:' + String(p == null ? '' : p).trim()));
}
function hash2_(p, salt) {
  let h = salt + ':' + String(p == null ? '' : p).trim();
  for (let i = 0; i < 300; i++) h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h));
  return h;
}
function getPw_() {
  const P = PROPS();
  let v = P.getProperty('PW');
  if (!v) { v = hash_('1234'); P.setProperty('PW', v); }
  return v;
}
function checkPw_(pw) {
  const P = PROPS();
  if (P.getProperty('PWV') === '2') return hash2_(pw, P.getProperty('SALT')) === P.getProperty('PW');
  return hash_(pw) === getPw_();
}
function weakPw_() { return PROPS().getProperty('PWV') !== '2'; }
const COMMON_PW = ['12345678', '123456789', '1234567890', '87654321', 'password', 'qwer1234', 'abcd1234', 'asdf1234', '1q2w3e4r', 'qwerty12'];
function validPw_(pw) {
  pw = String(pw == null ? '' : pw).trim();
  if (pw.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.');
  if (/^(.)\1+$/.test(pw) || COMMON_PW.indexOf(pw.toLowerCase()) >= 0) throw new Error('너무 쉬운 비밀번호입니다. 다른 비밀번호를 입력해 주세요.');
  return pw;
}
function setPw_(pw) {
  const salt = Utilities.getUuid();
  PROPS().setProperties({ PW: hash2_(pw, salt), SALT: salt, PWV: '2' });
}
/** 로그인이 안 될 때: Apps Script 편집기 상단에서 이 함수를 선택해 ▶ 실행하면 비밀번호가 1234로 초기화됩니다 */
function resetPassword() {
  const P = PROPS();
  P.setProperty('PW', hash_('1234')); P.deleteProperty('PWV'); P.deleteProperty('SALT');
  P.setProperty('GEN', String(Number(P.getProperty('GEN') || 0) + 1)); // 기존 로그인 모두 해제
  Logger.log('완료: 비밀번호가 1234로 초기화되었습니다. (' + VER + ')');
}

/* ---------- 내부 유틸 ---------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function init_() {
  const s = ss_();
  let c = s.getSheetByName(CFG);
  if (!c) { c = s.insertSheet(CFG); c.getRange('A1:B1').setValues([['config', JSON.stringify(DEFAULT)]]); }
  let o = s.getSheetByName(ORD);
  if (!o) { o = s.insertSheet(ORD); o.setFrozenRows(1); o.getRange('A:H').setNumberFormat('@'); }
  ensureHeader_(o);
  return { c: c, o: o };
}
/** 1행이 지정된 헤더와 다르면(비어있거나, 삭제됐거나, 주문이 1행에 들어간 경우) 자동으로 헤더 행을 복구/삽입 */
function ensureHeader_(o) {
  if (o.getMaxColumns() < HEAD.length) o.insertColumnsAfter(o.getMaxColumns(), HEAD.length - o.getMaxColumns());
  const row1 = function () { return o.getRange(1, 1, 1, o.getLastColumn() || 1).getValues()[0]; };
  let first = row1();
  if (!HEAD.every(function (h, i) { return first[i] === h; })) {
    if (first[0] === '주문번호') {
      // 예전 주문표: 열 이름을 기준으로 HEAD 순서에 맞게 열을 옮기거나 빈 열을 끼워 넣음 (기존 주문도 열째로 함께 이동)
      const added = [];
      HEAD.forEach(function (h, i) {
        const j = first.indexOf(h);
        if (j === i) return;
        if (j > i) o.moveColumns(o.getRange(1, j + 1), i + 1);
        else { o.insertColumnBefore(i + 1); added.push(h); }
        first = row1();
      });
      // 예전 주문은 받는 곳이 한 곳이므로 보낼수량 = 수량
      const last = o.getLastRow();
      if (added.indexOf('보낼수량') >= 0 && last > 1) {
        o.getRange(2, HEAD.indexOf('보낼수량') + 1, last - 1, 1)
          .setValues(o.getRange(2, HEAD.indexOf('수량') + 1, last - 1, 1).getValues());
      }
    } else if (o.getLastRow() > 0) {
      o.insertRowBefore(1); // 알 수 없는 내용(혹시 주문 데이터)은 한 칸 아래로 보존
    }
    o.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
    o.setFrozenRows(1);
    o.getRange('A:H').setNumberFormat('@'); // 날짜/전화번호/우편번호 자동변환 방지 (열 구조가 바뀔 때만)
  }
}
/** 설정은 시트(설정!B1)에 저장하고, 같은 값을 캐시에도 넣어 구매자 화면 응답을 빠르게 함 */
function writeCfg_(c, cfg) {
  const s = JSON.stringify(cfg);
  c.getRange('B1').setValue(s);
  try { CacheService.getScriptCache().put('cfg', s, 600); } catch (e) { /* 캐시 실패는 무시 */ }
}
function readCfg_(c) {
  const raw = c.getRange('B1').getValue();
  try {
    const cfg = JSON.parse(raw);
    if (cfg && Array.isArray(cfg.options) && cfg.options.length) {
      if (!('contact' in cfg)) cfg.contact = ''; // 이전 버전 호환
      if (!(Number(cfg.maxQty) > 0)) cfg.maxQty = 10; // 이전 버전 호환
      return cfg;
    }
  } catch (e) { /* 아래에서 복구 */ }
  // 설정 값이 비어 있거나 손상된 경우 기본값으로 복구 (주문 처리가 막히지 않도록)
  const fresh = JSON.parse(JSON.stringify(DEFAULT));
  writeCfg_(c, fresh);
  return fresh;
}
/** 주문표·택배 엑셀에 적는 옵션 이름. 같은 이름의 옵션(대과/중과 등)을 구분하려고 뱃지를 붙임 */
function optLabel_(o) { return o.tag ? o.name + ' (' + o.tag + ')' : o.name; }
function clean_(v, n) {
  v = String(v == null ? '' : v).trim().slice(0, n || 100);
  return /^[=+\-@]/.test(v) ? "'" + v : v; // 시트 수식 주입 방지
}
/** 로그인 토큰 값 = 비밀번호 세대(GEN) + 'w'(약한 비밀번호라 변경만 허용). 비밀번호를 바꾸면 GEN이 올라가 다른 기기 로그인은 끊김 */
function gen_() { return PROPS().getProperty('GEN') || '0'; }
function auth_(t, allowWeak) {
  const v = t ? CacheService.getScriptCache().get('t' + t) : null;
  if (!v || v.replace('w', '') !== gen_()) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  if (v.indexOf('w') >= 0 && !allowWeak) throw new Error('보안을 위해 비밀번호를 먼저 변경해 주세요.');
}
function withLock_(fn) {
  const l = LockService.getScriptLock();
  if (!l.tryLock(20000)) throw new Error('요청이 몰려 처리가 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.');
  try { return fn(); } finally { l.releaseLock(); }
}

/* ---------- 구매자용 ---------- */
function getPublic() {
  const cache = CacheService.getScriptCache(), hit = cache.get('cfg');
  if (hit) return { cfg: JSON.parse(hit), ver: VER };
  const cfg = readCfg_(init_().c);
  cache.put('cfg', JSON.stringify(cfg), 600);
  return { cfg: cfg, ver: VER };
}

function submitOrder(o) {
  const cache = CacheService.getScriptCache();
  if (!o || !o.rid) return { ok: false, msg: '잘못된 요청입니다.' };
  // 같은 주문(rid)이 다시 오면(두 번 누름, 응답 유실 후 재시도) 처음 결과를 그대로 돌려줌
  const done = function () { const v = cache.get('r' + o.rid); return v ? JSON.parse(v) : null; };
  if (done()) return done();
  // 재고가 꼬이지 않도록 주문은 한 번에 하나씩 처리. 몰리면 최대 25초 기다림
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return { ok: false, busy: true, msg: '주문이 몰려 처리가 늦어지고 있습니다. 잠시 후 다시 눌러 주세요.' };
  try {
    if (done()) return done();
    const t = init_(), cfg = readCfg_(t.c);
    const opt = cfg.options[o.optIdx], qty = Math.floor(Number(o.qty)), maxQty = Number(cfg.maxQty) || 10;
    if (!opt) return { ok: false, msg: '옵션을 선택해 주세요.' };
    if (!(qty >= 1 && qty <= maxQty)) return { ok: false, msg: '1인당 최대 ' + maxQty + '개까지 신청 가능합니다.' };
    if (!/^010-\d{4}-\d{4}$/.test(o.phone || '')) return { ok: false, msg: '연락처 11자리를 정확히 입력해 주세요.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) return { ok: false, msg: '입금일자를 확인해 주세요.' };
    const name = clean_(o.name, 30);
    if (!name) return { ok: false, msg: '입금자명을 입력해 주세요.' };
    // 받는 곳 목록. 받는 곳 목록이 없는 예전 화면(캐시)에서 온 주문은 한 곳으로 변환
    let recips = o.recips;
    if (!Array.isArray(recips)) {
      const old = o.rname === undefined;
      recips = [{ rname: old ? o.name : o.rname, rphone: old ? o.phone : o.rphone, zip: '', addr: o.addr, qty: qty }];
    }
    if (!recips.length || recips.length > qty) return { ok: false, msg: '받는 곳은 1곳 이상, 주문 수량 이하로 입력해 주세요.' };
    const rs = [];
    let sum = 0;
    for (let k = 0; k < recips.length; k++) {
      const r = recips[k] || {}, no = recips.length > 1 ? (k + 1) + '번째 받는 곳의 ' : '';
      const rn = clean_(r.rname, 30), q = Math.floor(Number(r.qty));
      const ad = clean_([r.addr, r.detail].map(function (x) { return String(x == null ? '' : x).trim(); }).filter(String).join(' '), 250);
      if (!rn) return { ok: false, msg: no + '받는 사람 이름을 입력해 주세요.' };
      if (!/^010-\d{4}-\d{4}$/.test(r.rphone || '')) return { ok: false, msg: no + '받는 사람 연락처 11자리를 정확히 입력해 주세요.' };
      if (!ad) return { ok: false, msg: no + '배송지 주소를 입력해 주세요.' };
      if (!(q >= 1)) return { ok: false, msg: no + '보낼 수량을 확인해 주세요.' };
      sum += q;
      rs.push([rn, r.rphone, /^\d{5}$/.test(r.zip || '') ? r.zip : '', ad, q]);
    }
    if (sum !== qty) return { ok: false, msg: '받는 곳별 수량 합계(' + sum + '개)가 주문 수량(' + qty + '개)과 다릅니다.' };
    opt.stock = Number(opt.stock) || 0;
    if (opt.stock <= 0) return { ok: false, msg: '품절된 옵션입니다.' };
    if (qty > opt.stock) return { ok: false, msg: '해당 옵션의 잔여 수량이 ' + opt.stock + '개뿐입니다.' };
    const id = Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '-' + (t.o.getLastRow());
    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), price = Number(opt.price) * qty;
    const rows = rs.map(function (r, k) {
      return k === 0 ? [id, now, o.date, name, o.phone].concat(r, [optLabel_(opt), qty, price, '접수'])
                     : [id, '', '', '', ''].concat(r, ['', '', '', '']);
    });
    const last = t.o.getLastRow(), need = last + rows.length - t.o.getMaxRows();
    if (need > 0) t.o.insertRowsAfter(t.o.getMaxRows(), need);
    t.o.getRange(last + 1, 1, rows.length, HEAD.length).setValues(rows);
    opt.stock -= qty;
    writeCfg_(t.c, cfg);
    const res = { ok: true, id: id, left: opt.stock, total: Number(opt.price) * qty };
    cache.put('r' + o.rid, JSON.stringify(res), 1800);
    return res;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 판매자용 ---------- */
function login(pw) {
  const cache = CacheService.getScriptCache(), P = PROPS();
  const fails = Number(cache.get('fail') || 0);
  if (fails >= 5) return { ok: false, msg: '비밀번호를 여러 번 틀려 잠겼습니다. 10분 뒤 다시 시도해 주세요.' };
  if (!checkPw_(pw || '')) {
    cache.put('fail', String(fails + 1), 600);
    P.setProperty('FAILS', String(Number(P.getProperty('FAILS') || 0) + 1)); // 판매자에게 알려줄 실패 횟수
    return { ok: false, msg: '비밀번호가 올바르지 않습니다. (남은 시도 ' + (4 - fails) + '회)' };
  }
  cache.remove('fail');
  const failed = Number(P.getProperty('FAILS') || 0);
  if (failed) P.deleteProperty('FAILS');
  const weak = weakPw_(), token = Utilities.getUuid();
  cache.put('t' + token, gen_() + (weak ? 'w' : ''), 21600);
  return { ok: true, token: token, mustChange: weak, failed: failed, data: weak ? null : adminData(token) };
}

function adminData(t) {
  auth_(t);
  const x = init_();
  const last = x.o.getLastRow();
  const rows = last > 1 ? x.o.getRange(2, 1, last - 1, HEAD.length).getDisplayValues() : [];
  return { cfg: readCfg_(x.c), head: HEAD, orders: rows, url: ss_().getUrl(), ver: VER, bankAt: PROPS().getProperty('BANKAT') || '' };
}

function saveConfig(t, cfg, pw) {
  auth_(t);
  const str = function (v, n) { return String(v == null ? '' : v).slice(0, n); };
  const clean = {
    name: str(cfg.name, 60), intro: str(cfg.intro, 500), hero: str(cfg.hero, 500), ship: str(cfg.ship, 100),
    contact: str(cfg.contact, 100), maxQty: Math.min(20, Math.max(1, Math.floor(Number(cfg.maxQty) || 10))),
    options: (cfg.options || []).slice(0, 20).map(function (o) {
      return {
        name: str(o.name, 60), tag: str(o.tag, 10), desc: str(o.desc, 100),
        price: Math.max(0, Number(o.price) || 0), stock: Math.max(0, Math.floor(Number(o.stock) || 0))
      };
    }),
    sections: (cfg.sections || []).slice(0, 10).map(function (s) {
      return { title: str(s.title, 60), items: (s.items || []).slice(0, 20).map(function (i) { return str(i, 120); }).filter(String) };
    }),
    bank: { bank: str(cfg.bank.bank, 30), no: str(cfg.bank.no, 40), holder: str(cfg.bank.holder, 30) }
  };
  if (!clean.options.length) throw new Error('옵션을 1개 이상 등록해 주세요.');
  return withLock_(function () {
    const c = init_().c, old = readCfg_(c).bank || {};
    const bankChanged = ['bank', 'no', 'holder'].some(function (k) { return String(old[k] || '') !== clean.bank[k]; });
    if (bankChanged) {
      if (!checkPw_(pw || '')) throw new Error('계좌 정보를 바꾸려면 비밀번호를 정확히 입력해 주세요.');
      PROPS().setProperty('BANKAT', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'));
    }
    writeCfg_(c, clean);
    return { ok: true, cfg: clean, bankAt: PROPS().getProperty('BANKAT') || '' };
  });
}

function setStatus(t, id, status) {
  auth_(t);
  return withLock_(function () {
    const o = init_().o, ids = o.getRange('A:A').getValues();
    for (let i = 1; i < ids.length; i++) {
      if (ids[i][0] === id) {
        const cell = o.getRange(i + 1, HEAD.indexOf('상태') + 1);
        if (cell.getValue() === '취소') return { ok: false };
        cell.setValue(status === '입금확인' ? '입금확인' : '접수');
        return { ok: true };
      }
    }
    return { ok: false };
  });
}

/** 새 판매 시작: 현재 주문을 '날짜_차수' 탭으로 보관하고 주문표를 비움. resetTo가 있으면 모든 옵션 재고를 그 값으로 초기화 */
function newRound(t, resetTo) {
  auth_(t);
  return withLock_(function () {
    const x = init_(), s = ss_();
    let base = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') + '_차수', name = base, n = 1;
    while (s.getSheetByName(name)) { n++; name = base + n; }
    x.o.copyTo(s).setName(name);
    if (x.o.getLastRow() > 1) x.o.deleteRows(2, x.o.getLastRow() - 1);
    if (resetTo !== null && resetTo !== '' && resetTo !== undefined) {
      const cfg = readCfg_(x.c), n2 = Math.max(0, Math.floor(Number(resetTo) || 0));
      cfg.options.forEach(function (o) { o.stock = n2; });
      writeCfg_(x.c, cfg);
    }
    return { ok: true, tab: name };
  });
}

function changePw(t, cur, nw) {
  auth_(t, true);
  if (!checkPw_(cur || '')) throw new Error('현재 비밀번호가 올바르지 않습니다.');
  nw = validPw_(nw);
  if (nw === String(cur).trim()) throw new Error('지금과 다른 비밀번호를 입력해 주세요.');
  setPw_(nw);
  const g = String(Number(gen_()) + 1);
  PROPS().setProperty('GEN', g); // 다른 기기의 로그인은 모두 해제
  CacheService.getScriptCache().put('t' + t, g, 21600); // 지금 기기는 그대로 유지
  return { ok: true };
}

/** 주문 취소: 상태를 '취소'로 바꾸고 그 주문 수량만큼 재고를 되돌림 */
function cancelOrder(t, id) {
  auth_(t);
  return withLock_(function () {
    const x = init_(), last = x.o.getLastRow();
    if (last < 2) return { ok: false, msg: '주문을 찾지 못했습니다.' };
    const rows = x.o.getRange(2, 1, last - 1, HEAD.length).getValues();
    const col = function (h) { return HEAD.indexOf(h); };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r[0] !== id || !r[col('주문시각')]) continue;
      if (r[col('상태')] === '취소') return { ok: false, msg: '이미 취소된 주문입니다.' };
      x.o.getRange(i + 2, col('상태') + 1).setValue('취소');
      const cfg = readCfg_(x.c), qty = Number(r[col('수량')]) || 0;
      // 옵션 이름(뱃지 포함)으로 찾음. 예전 주문(이름만 저장)은 같은 이름이 하나뿐일 때만 복구
      const label = r[col('옵션')];
      let opt = cfg.options.filter(function (o) { return optLabel_(o) === label; })[0];
      if (!opt) { const same = cfg.options.filter(function (o) { return o.name === label; }); if (same.length === 1) opt = same[0]; }
      if (opt && qty > 0) { opt.stock = (Number(opt.stock) || 0) + qty; writeCfg_(x.c, cfg); }
      return { ok: true, restored: !!opt, qty: qty, option: r[col('옵션')] };
    }
    return { ok: false, msg: '주문을 찾지 못했습니다. 새로고침해 주세요.' };
  });
}

/** 개인정보 보유 기간(6개월)이 지난 '날짜_차수' 보관 탭 삭제. dryRun이면 개수만 알려줌 */
function purgeOld(t, dryRun) {
  auth_(t);
  const limit = new Date(); limit.setMonth(limit.getMonth() - 6);
  const s = ss_(), old = s.getSheets().filter(function (sh) {
    const m = /^(\d{4})-(\d{2})-(\d{2})_차수\d*$/.exec(sh.getName());
    return m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) < limit;
  });
  if (!dryRun) withLock_(function () { old.forEach(function (sh) { s.deleteSheet(sh); }); });
  return { ok: true, count: old.length, names: old.map(function (sh) { return sh.getName(); }) };
}