/** 사과농장 주문앱 - Code.gs (구글 시트에 연결된 스크립트)
 *  화면은 GitHub Pages(SITE)에 있고, 이 스크립트는 doPost로 데이터만 주고받습니다. */
const VER = 'v11';
const SITE = 'https://andong-apple.github.io/';
const ORD = '현재주문', CFG = '설정', TZ = 'Asia/Seoul';
const HEAD = ['주문번호','주문시각','입금일자','입금자명','연락처','받는사람','받는사람연락처','배송지','옵션','수량','금액','상태'];
// v10 이전 주문표의 앞 10칸 (ensureHeader_에서 열 위치를 옮길 때 사용)
const LEGACY = ['주문번호','주문시각','입금일자','입금자명','연락처','배송지','옵션','수량','금액','상태'];
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
    .setTitle('사과농장')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- 화면(GitHub Pages)과 데이터를 주고받는 통로 ---------- */
const API = { getPublic: getPublic, submitOrder: submitOrder, login: login, adminData: adminData,
  saveConfig: saveConfig, setStatus: setStatus, newRound: newRound, changePw: changePw };
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

/* ---------- 비밀번호 (스크립트 속성에 저장: 시트 서식과 무관하게 항상 동일하게 동작) ---------- */
function hash_(p) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'apple:' + String(p == null ? '' : p).trim());
  return raw.map(function (b) { b = (b < 0 ? b + 256 : b).toString(16); return b.length === 1 ? '0' + b : b; }).join('');
}
function getPw_() {
  const P = PropertiesService.getScriptProperties();
  let v = P.getProperty('PW');
  if (!v) { v = hash_('1234'); P.setProperty('PW', v); }
  return v;
}
function setPw_(pw) { PropertiesService.getScriptProperties().setProperty('PW', hash_(pw)); }
/** 로그인이 안 될 때: Apps Script 편집기 상단에서 이 함수를 선택해 ▶ 실행하면 비밀번호가 1234로 초기화됩니다 */
function resetPassword() {
  setPw_('1234');
  Logger.log('완료: 비밀번호가 1234로 초기화되었습니다. (' + VER + ')');
}

/* ---------- 내부 유틸 ---------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function init_() {
  const s = ss_();
  let c = s.getSheetByName(CFG);
  if (!c) { c = s.insertSheet(CFG); c.getRange('A1:B1').setValues([['config', JSON.stringify(DEFAULT)]]); }
  let o = s.getSheetByName(ORD);
  if (!o) { o = s.insertSheet(ORD); o.setFrozenRows(1); }
  ensureHeader_(o);
  return { c: c, o: o };
}
/** 1행이 지정된 헤더와 다르면(비어있거나, 삭제됐거나, 주문이 1행에 들어간 경우) 자동으로 헤더 행을 복구/삽입 */
function ensureHeader_(o) {
  if (o.getMaxColumns() < HEAD.length) o.insertColumnsAfter(o.getMaxColumns(), HEAD.length - o.getMaxColumns());
  const n = o.getLastColumn();
  const first = n > 0 ? o.getRange(1, 1, 1, n).getValues()[0] : [];
  const ok = HEAD.every(function (h, i) { return first[i] === h; });
  if (!ok) {
    if (LEGACY.every(function (h, i) { return first[i] === h; })) {
      // 예전 주문표: 받는사람 열을 연락처 뒤(F:G)로 옮김. 열 통째로 옮기므로 기존 주문도 함께 이동
      if (first[10] === '받는사람' && first[11] === '받는사람연락처') o.moveColumns(o.getRange('K:L'), 6);
      else o.insertColumnsAfter(5, 2);
    } else if (o.getLastRow() > 0) {
      o.insertRowBefore(1); // 알 수 없는 내용(혹시 주문 데이터)은 한 칸 아래로 보존
    }
    o.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);
    o.setFrozenRows(1);
  }
  o.getRange('A:G').setNumberFormat('@'); // 날짜/전화번호 자동변환 방지
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
  c.getRange('B1').setValue(JSON.stringify(fresh));
  return fresh;
}
function clean_(v, n) {
  v = String(v == null ? '' : v).trim().slice(0, n || 100);
  return /^[=+\-@]/.test(v) ? "'" + v : v; // 시트 수식 주입 방지
}
function auth_(t) {
  if (!t || !CacheService.getScriptCache().get('t' + t)) throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
}
function withLock_(fn) {
  const l = LockService.getScriptLock();
  l.waitLock(20000);
  try { return fn(); } finally { l.releaseLock(); }
}

/* ---------- 구매자용 ---------- */
function getPublic() {
  return { cfg: readCfg_(init_().c), ver: VER };
}

function submitOrder(o) {
  const cache = CacheService.getScriptCache();
  if (!o || !o.rid) return { ok: false, msg: '잘못된 요청입니다.' };
  if (cache.get('r' + o.rid)) return { ok: false, msg: '이미 접수된 주문입니다.' };
  return withLock_(function () {
    const t = init_(), cfg = readCfg_(t.c);
    const opt = cfg.options[o.optIdx], qty = Math.floor(Number(o.qty)), maxQty = Number(cfg.maxQty) || 10;
    if (!opt) return { ok: false, msg: '옵션을 선택해 주세요.' };
    if (!(qty >= 1 && qty <= maxQty)) return { ok: false, msg: '1인당 최대 ' + maxQty + '개까지 신청 가능합니다.' };
    if (!/^010-\d{4}-\d{4}$/.test(o.phone || '')) return { ok: false, msg: '연락처 11자리를 정확히 입력해 주세요.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || '')) return { ok: false, msg: '입금일자를 확인해 주세요.' };
    // 받는사람 칸이 없는 예전 화면(캐시)에서 온 주문은 입금자 정보로 채움
    if (o.rname === undefined) { o.rname = o.name; o.rphone = o.phone; }
    const name = clean_(o.name, 30), addr = clean_(o.addr, 200), rname = clean_(o.rname, 30);
    if (!name || !addr) return { ok: false, msg: '입금자명과 주소를 입력해 주세요.' };
    if (!rname) return { ok: false, msg: '받는 사람 이름을 입력해 주세요.' };
    if (!/^010-\d{4}-\d{4}$/.test(o.rphone || '')) return { ok: false, msg: '받는 사람 연락처 11자리를 정확히 입력해 주세요.' };
    opt.stock = Number(opt.stock) || 0;
    if (opt.stock <= 0) return { ok: false, msg: '품절된 옵션입니다.' };
    if (qty > opt.stock) return { ok: false, msg: '해당 옵션의 잔여 수량이 ' + opt.stock + '개뿐입니다.' };
    const id = Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '-' + (t.o.getLastRow());
    t.o.appendRow([id, Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), o.date, name,
      o.phone, rname, o.rphone, addr, opt.name, qty, Number(opt.price) * qty, '접수']);
    opt.stock -= qty;
    t.c.getRange('B1').setValue(JSON.stringify(cfg));
    cache.put('r' + o.rid, '1', 600);
    return { ok: true, id: id, left: opt.stock, total: Number(opt.price) * qty };
  });
}

/* ---------- 판매자용 ---------- */
function login(pw) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('fail') || 0);
  if (fails >= 5) return { ok: false, msg: '시도 횟수 초과. 10분 뒤 다시 시도해 주세요. (' + VER + ')' };
  const cur = getPw_();
  if (cur !== hash_(pw || '')) {
    cache.put('fail', String(fails + 1), 600);
    return { ok: false, msg: '비밀번호가 올바르지 않습니다. (' + VER + ', 남은 시도 ' + (4 - fails) + '회)' };
  }
  cache.remove('fail');
  const token = Utilities.getUuid();
  cache.put('t' + token, '1', 21600);
  return { ok: true, token: token, defaultPw: cur === hash_('1234') };
}

function adminData(t) {
  auth_(t);
  const x = init_();
  const last = x.o.getLastRow();
  const rows = last > 1 ? x.o.getRange(2, 1, last - 1, HEAD.length).getDisplayValues() : [];
  return { cfg: readCfg_(x.c), head: HEAD, orders: rows, url: ss_().getUrl(), ver: VER };
}

function saveConfig(t, cfg) {
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
    init_().c.getRange('B1').setValue(JSON.stringify(clean));
    return { ok: true };
  });
}

function setStatus(t, id, status) {
  auth_(t);
  return withLock_(function () {
    const o = init_().o, ids = o.getRange('A:A').getValues();
    for (let i = 1; i < ids.length; i++) {
      if (ids[i][0] === id) { o.getRange(i + 1, HEAD.indexOf('상태') + 1).setValue(status === '입금확인' ? '입금확인' : '접수'); return { ok: true }; }
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
      x.c.getRange('B1').setValue(JSON.stringify(cfg));
    }
    return { ok: true, tab: name };
  });
}

function changePw(t, pw) {
  auth_(t);
  if (!pw || String(pw).trim().length < 4) throw new Error('비밀번호는 4자 이상이어야 합니다.');
  setPw_(pw);
  return { ok: true };
}