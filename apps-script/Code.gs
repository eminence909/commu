/**
 * ฝั่งเซิร์ฟเวอร์ของเว็บพัฒนาชุมชน (Google Apps Script)
 * ผูกกับ Google Sheet: เก็บข่าว โครงการ เรื่องแจ้งปัญหา และตั้งค่าเว็บ
 *
 * วิธีติดตั้ง ดูใน README.md ข้อ "เชื่อม Google Sheet"
 */

// ★ เปลี่ยนรหัสผ่านแอดมินตรงนี้ก่อนติดตั้ง (ใช้ตอนเข้า admin.html)
var ADMIN_PASSWORD = 'เปลี่ยนรหัสผ่านตรงนี้';

var SHEETS = {
  settings: ['key', 'value'],
  news: ['id', 'title', 'category', 'date', 'summary', 'content', 'image', 'published'],
  projects: ['id', 'title', 'status', 'progress', 'budget', 'startDate', 'endDate', 'location', 'description', 'image'],
  reports: ['code', 'createdAt', 'updatedAt', 'name', 'phone', 'category', 'location', 'lat', 'lng', 'detail', 'image', 'status', 'note', 'consent'],
  gallery: ['id', 'title', 'date', 'caption', 'image']
};
var ID_FIELD = { news: 'id', projects: 'id', reports: 'code', gallery: 'id' };
var IMAGE_FOLDER = 'community-web-images';
var MAX_REPORTS_PER_HOUR = 40;

/* ===== รันฟังก์ชันนี้หนึ่งครั้งหลังวางโค้ด เพื่อสร้างชีตและขออนุญาต ===== */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var cols = SHEETS[name];
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#d9f3ec');
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@'); // เก็บเป็นข้อความ กันวันที่เพี้ยน
    sh.setFrozenRows(1);
  });
  var st = ss.getSheetByName('settings');
  if (st.getLastRow() < 2) {
    var d = [['siteName', 'ชุมชนของเรา'], ['siteTagline', 'ร่วมกันพัฒนา เพื่ออนาคตที่ยั่งยืน'], ['heroEyebrow', 'เว็บไซต์พัฒนาชุมชน'],
      ['heroTitle', 'ชุมชนเข้มแข็ง|เริ่มต้นที่เราทุกคน'], ['heroSubtitle', 'ติดตามข่าวสาร โครงการพัฒนา และแจ้งปัญหาในชุมชนได้ในที่เดียว'],
      ['aboutTitle', 'เกี่ยวกับชุมชนของเรา'], ['aboutText', 'ใส่ประวัติและจุดเด่นของชุมชนที่นี่']];
    st.getRange(2, 1, d.length, 2).setValues(d);
  }
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  DriveApp.getRootFolder(); // ขออนุญาตใช้ Google Drive (สำหรับรูปภาพ)
}

function doGet() { return ContentService.createTextOutput('community-web API ทำงานปกติ'); }

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents), a = req.action;
    if (a === 'getPublic') return ok_(getPublic_());
    if (a === 'submitReport') return ok_(submitReport_(req.report));
    if (a === 'trackReport') return ok_(trackReport_(req.code));
    if (req.key !== ADMIN_PASSWORD) return fail_('รหัสผ่านไม่ถูกต้อง');
    switch (a) {
      case 'adminLogin': return ok_({});
      case 'adminGetAll': return ok_(adminGetAll_());
      case 'saveItem': return ok_(saveItem_(req.sheet, req.item));
      case 'deleteItem': return ok_(deleteItem_(req.sheet, req.id));
      case 'updateReport': return ok_(updateReport_(req));
      case 'saveSettings': return ok_(saveSettings_(req.settings));
      case 'uploadImage': return ok_({ url: saveImage_(req.dataUrl, req.name) });
    }
    return fail_('ไม่รู้จักคำสั่ง');
  } catch (err) { return fail_(String(err && err.message || err)); }
}

function ok_(data) { return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data })).setMimeType(ContentService.MimeType.JSON); }
function fail_(msg) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON); }

/* ===== ตัวช่วยอ่าน/เขียนชีต ===== */
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('ยังไม่ได้สร้างชีต "' + name + '" (ให้รันฟังก์ชัน setup ก่อน)');
  return sh;
}
function cell_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', "yyyy-MM-dd") : (v == null ? '' : v); }
function rows_(name) {
  var sh = sheet_(name), cols = SHEETS[name], n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, cols.length).getValues().map(function (r) {
    var o = {}; cols.forEach(function (c, i) { o[c] = cell_(r[i]); }); return o;
  }).filter(function (o) { return o[cols[0]] !== ''; });
}
// อ่านชีตแบบไม่พัง ถ้ายังไม่มีชีตนั้น (เช่น ยังไม่ได้รัน setup หลังอัปเดต)
function safeRows_(name) { try { return rows_(name); } catch (e) { return []; } }
function findRow_(name, id) {
  var sh = sheet_(name), n = sh.getLastRow() - 1;
  if (n < 1) return -1;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function rowValues_(name, item) { return SHEETS[name].map(function (c) { var v = item[c]; return v == null ? '' : String(v); }); }
function settings_() {
  var o = {}; rows_('settings').forEach(function (r) { o[r.key] = r.value; }); return o;
}
function news_() { return rows_('news').map(function (n) { n.published = String(n.published).toLowerCase() !== 'false'; return n; }); }
function sortDesc_(arr, f) { return arr.sort(function (a, b) { return String(b[f]).localeCompare(String(a[f])); }); }

/* ===== ฝั่งสาธารณะ ===== */
function getPublic_() {
  return {
    settings: settings_(),
    news: sortDesc_(news_().filter(function (n) { return n.published; }), 'date'),
    projects: rows_('projects'),
    gallery: sortDesc_(safeRows_('gallery'), 'date'),
    reportStats: rows_('reports').map(function (r) { return { status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt }; })
  };
}

function submitReport_(r) {
  if (!r || !r.category || !r.detail || String(r.detail).length < 10) throw new Error('กรอกข้อมูลไม่ครบ');
  if (String(r.detail).length > 1600) throw new Error('รายละเอียดยาวเกินไป');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var all = rows_('reports'), hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
    var recent = all.filter(function (x) { return String(x.createdAt) > hourAgo; }).length;
    if (recent >= MAX_REPORTS_PER_HOUR) throw new Error('มีการส่งเรื่องจำนวนมากในช่วงนี้ กรุณาลองใหม่ภายหลัง');
    var used = {}; all.forEach(function (x) { used[x.code] = 1; });
    var code; do { code = makeCode_(); } while (used[code]);
    var img = r.image ? saveImage_(r.image, code + '.jpg') : '', now = new Date().toISOString();
    var rec = { code: code, createdAt: now, updatedAt: now, name: clip_(r.name, 80), phone: clip_(r.phone, 20), category: clip_(r.category, 60), location: clip_(r.location, 200),
      lat: clip_(r.lat, 20), lng: clip_(r.lng, 20), detail: clip_(r.detail, 1500), image: img, status: 'new', note: '', consent: 'true' };
    sheet_('reports').appendRow(rowValues_('reports', rec));
    return { code: code };
  } finally { lock.releaseLock(); }
}
function clip_(v, n) { return String(v == null ? '' : v).slice(0, n); }
function makeCode_() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
  for (var i = 0; i < 4; i++) r += abc.charAt(Math.floor(Math.random() * abc.length));
  return 'RP-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMdd') + '-' + r;
}
function trackReport_(code) {
  code = String(code || '').trim().toUpperCase();
  var r = rows_('reports').filter(function (x) { return x.code === code; })[0];
  return r ? { code: r.code, category: r.category, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt, note: r.note } : null; // ไม่ส่งข้อมูลส่วนตัวออกไป
}

/* ===== ฝั่งแอดมิน ===== */
function adminGetAll_() {
  return { settings: settings_(), news: sortDesc_(news_(), 'date'), projects: rows_('projects'), gallery: sortDesc_(safeRows_('gallery'), 'date'), reports: sortDesc_(rows_('reports'), 'createdAt') };
}
function saveItem_(name, item) {
  if (!ID_FIELD[name] || name === 'reports') throw new Error('ชีตไม่ถูกต้อง');
  var sh = sheet_(name), idf = ID_FIELD[name], row = findRow_(name, item[idf]), vals = rowValues_(name, item);
  if (row > 0) sh.getRange(row, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
  return item;
}
function deleteItem_(name, id) {
  if (!ID_FIELD[name]) throw new Error('ชีตไม่ถูกต้อง');
  var row = findRow_(name, id); if (row > 0) sheet_(name).deleteRow(row);
  return true;
}
function updateReport_(req) {
  var row = findRow_('reports', req.code); if (row < 0) throw new Error('ไม่พบเรื่องนี้');
  var cols = SHEETS.reports, sh = sheet_('reports'), now = new Date().toISOString();
  sh.getRange(row, cols.indexOf('status') + 1).setValue(String(req.status || 'new'));
  sh.getRange(row, cols.indexOf('note') + 1).setValue(clip_(req.note, 600));
  sh.getRange(row, cols.indexOf('updatedAt') + 1).setValue(now);
  return { status: req.status, note: clip_(req.note, 600), updatedAt: now };
}
function saveSettings_(obj) {
  var sh = sheet_('settings'), keys = Object.keys(obj || {});
  keys.forEach(function (k) {
    var row = findRow_('settings', k), v = String(obj[k] == null ? '' : obj[k]);
    if (row > 0) sh.getRange(row, 2).setValue(v); else sh.appendRow([k, v]);
  });
  return settings_();
}
function saveImage_(dataUrl, name) {
  var m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('รูปไม่ถูกต้อง');
  if (m[2].length > 2000000) throw new Error('รูปใหญ่เกินไป');
  var it = DriveApp.getFoldersByName(IMAGE_FOLDER), folder = it.hasNext() ? it.next() : DriveApp.createFolder(IMAGE_FOLDER);
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(name || 'image.jpg').replace(/[^\w.\-]/g, '_')));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}
