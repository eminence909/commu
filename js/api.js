/* ชั้นข้อมูลของเว็บ
 * - ถ้า SITE_CONFIG.API_URL ว่าง  : โหมดสาธิต เก็บข้อมูลใน localStorage ของเบราว์เซอร์
 * - ถ้าใส่ API_URL แล้ว            : คุยกับ Google Apps Script / Google Sheet จริง
 * ทุกหน้าเรียกผ่าน window.API เหมือนกัน จึงสลับโหมดได้โดยไม่ต้องแก้โค้ดหน้าเว็บ */
(function () {
  'use strict';
  var cfg = window.SITE_CONFIG || {};
  var demo = !cfg.API_URL;
  var LS = 'cw_demo_v1';
  var KEY = 'cw_admin_key';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function persist(d) {
    try { localStorage.setItem(LS, JSON.stringify(d)); }
    catch (e) { throw new Error('พื้นที่เก็บข้อมูลในเบราว์เซอร์เต็ม (โหมดสาธิต) ลองใช้รูปที่เล็กลง'); }
  }
  function db() {
    try { var s = localStorage.getItem(LS); if (s) return JSON.parse(s); } catch (e) { /* ใช้ค่าเริ่มต้น */ }
    var d = clone(window.DEMO_DATA);
    persist(d);
    return d;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function byDateDesc(a, b) { return String(b.date).localeCompare(String(a.date)); }

  function getKey() { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } }

  function remote(action, payload, admin) {
    var body = Object.assign({ action: action }, payload || {});
    if (admin) body.key = getKey();
    // ใช้ text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow'
    }).then(function (res) {
      if (!res.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ (' + res.status + ')');
      return res.json();
    }).then(function (json) {
      if (!json || !json.ok) throw new Error((json && json.error) || 'เกิดข้อผิดพลาด');
      return json.data;
    }).catch(function (e) {
      if (e instanceof TypeError) throw new Error('เชื่อมต่ออินเทอร์เน็ตหรือเซิร์ฟเวอร์ไม่ได้');
      throw e;
    });
  }

  function makeCode() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var i = 0; i < 4; i++) r += abc[Math.floor(Math.random() * abc.length)];
    return 'RP-' + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + '-' + r;
  }

  function requireAuth() {
    if (!getKey()) throw new Error('กรุณาเข้าสู่ระบบแอดมินก่อน');
  }

  window.API = {
    demo: demo,

    /* ===== ฝั่งสาธารณะ ===== */
    getPublic: function () {
      if (!demo) return remote('getPublic');
      return wait(350).then(function () {
        var d = db();
        return {
          settings: d.settings,
          news: d.news.filter(function (n) { return n.published !== false; }).sort(byDateDesc),
          projects: d.projects,
          // ส่งเฉพาะสถานะและเวลา ไม่ส่งข้อมูลส่วนตัวของผู้แจ้ง
          reportStats: d.reports.map(function (r) { return { status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt }; })
        };
      });
    },

    submitReport: function (r) {
      if (!demo) return remote('submitReport', { report: r });
      return wait(700).then(function () {
        var d = db(), now = new Date().toISOString();
        var rec = {
          code: makeCode(), createdAt: now, updatedAt: now,
          name: r.name || '', phone: r.phone || '', category: r.category, location: r.location || '',
          lat: r.lat || '', lng: r.lng || '', detail: r.detail, image: r.image || '',
          status: 'new', note: '', consent: true
        };
        d.reports.unshift(rec);
        persist(d);
        return { code: rec.code };
      });
    },

    trackReport: function (code) {
      code = String(code || '').trim().toUpperCase();
      if (!demo) return remote('trackReport', { code: code });
      return wait(400).then(function () {
        var rec = db().reports.filter(function (x) { return x.code === code; })[0];
        if (!rec) return null;
        return { code: rec.code, category: rec.category, status: rec.status, createdAt: rec.createdAt, updatedAt: rec.updatedAt, note: rec.note };
      });
    },

    /* ===== แอดมิน ===== */
    isAuthed: function () { return !!getKey(); },

    login: function (password) {
      if (demo) {
        return wait(450).then(function () {
          if (password !== cfg.DEMO_PASSWORD) throw new Error('รหัสผ่านไม่ถูกต้อง');
          sessionStorage.setItem(KEY, password);
        });
      }
      sessionStorage.setItem(KEY, password);
      return remote('adminLogin', {}, true).catch(function (e) {
        sessionStorage.removeItem(KEY);
        throw e;
      });
    },

    logout: function () { try { sessionStorage.removeItem(KEY); } catch (e) { /* ไม่ต้องทำอะไร */ } },

    adminGetAll: function () {
      if (!demo) return remote('adminGetAll', {}, true);
      return wait(250).then(function () {
        requireAuth();
        var d = clone(db());
        d.news.sort(byDateDesc);
        d.reports.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
        return d;
      });
    },

    saveItem: function (sheet, item) {
      if (!demo) return remote('saveItem', { sheet: sheet, item: item }, true);
      return wait(250).then(function () {
        requireAuth();
        var d = db(), arr = d[sheet], idf = sheet === 'reports' ? 'code' : 'id';
        var i = arr.findIndex(function (x) { return x[idf] === item[idf]; });
        if (i >= 0) arr[i] = item; else arr.unshift(item);
        persist(d);
        return item;
      });
    },

    deleteItem: function (sheet, id) {
      if (!demo) return remote('deleteItem', { sheet: sheet, id: id }, true);
      return wait(250).then(function () {
        requireAuth();
        var d = db(), idf = sheet === 'reports' ? 'code' : 'id';
        d[sheet] = d[sheet].filter(function (x) { return x[idf] !== id; });
        persist(d);
        return true;
      });
    },

    updateReport: function (code, patch) {
      if (!demo) return remote('updateReport', { code: code, status: patch.status, note: patch.note }, true);
      return wait(250).then(function () {
        requireAuth();
        var d = db();
        var r = d.reports.filter(function (x) { return x.code === code; })[0];
        if (!r) throw new Error('ไม่พบเรื่องนี้');
        r.status = patch.status; r.note = patch.note || ''; r.updatedAt = new Date().toISOString();
        persist(d);
        return r;
      });
    },

    saveSettings: function (obj) {
      if (!demo) return remote('saveSettings', { settings: obj }, true);
      return wait(250).then(function () {
        requireAuth();
        var d = db();
        d.settings = Object.assign({}, d.settings, obj);
        persist(d);
        return d.settings;
      });
    },

    uploadImage: function (dataUrl, name) {
      if (!demo) return remote('uploadImage', { dataUrl: dataUrl, name: name || 'image.jpg' }, true).then(function (r) { return r.url; });
      return wait(200).then(function () { requireAuth(); return dataUrl; });
    },

    resetDemo: function () {
      if (!demo) return Promise.reject(new Error('ใช้ได้เฉพาะโหมดสาธิต'));
      persist(clone(window.DEMO_DATA));
      return Promise.resolve();
    }
  };
})();
