/* ระบบแอดมิน: จัดการข่าว โครงการ เรื่องแจ้งปัญหา และตั้งค่าเว็บ */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app'), A = null, cur = 'dash', rf = { st: 'all', q: '' }, mf = 'all';

  var NAV = [['dash', 'dashboard', 'ภาพรวม', 'ภาพรวม'], ['reports', 'megaphone', 'เรื่องแจ้งปัญหา', 'แจ้งปัญหา'], ['map', 'pin', 'แผนที่', 'แผนที่'], ['projects', 'layers', 'โครงการ', 'โครงการ'], ['news', 'newspaper', 'ข่าวและกิจกรรม', 'ข่าว'], ['gallery', 'image', 'แกลเลอรี่', 'ภาพ'], ['settings', 'settings', 'ตั้งค่าเว็บ', 'ตั้งค่า']];
  var uid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); };
  var opts = function (arr, sel) { return arr.map(function (o) { var v = o[0], l = o[1]; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join(''); };
  var stOpts = function (map) { return Object.keys(map).map(function (k) { return [k, map[k].label]; }); };

  /* ---------- หน้าต่างป๊อปอัพ ---------- */
  function modal(title, body, cls, mount) {
    var m = document.createElement('div');
    m.className = 'mask';
    m.innerHTML = '<div class="modal ' + (cls || '') + '" role="dialog" aria-modal="true"><div class="m-head"><h2>' + esc(title) + '</h2><button class="ib" aria-label="ปิด">' + icon('x') + '</button></div><div class="m-body">' + body + '</div></div>';
    document.body.appendChild(m);
    var close = function () { m.classList.add('out'); setTimeout(function () { m.remove(); }, 220); };
    m.querySelector('.ib').onclick = close;
    m.addEventListener('mousedown', function (e) { if (e.target === m) close(); });
    if (mount) mount(m, close);
    return close;
  }
  function confirmBox(msg, ok) {
    modal('ยืนยันการลบ', '<p>' + esc(msg) + '</p><div class="m-actions"><button class="btn btn-outline" data-x>ยกเลิก</button><button class="btn btn-dark" style="background:var(--danger)" data-ok>ลบ</button></div>', 'sm', function (m, close) {
      m.querySelector('[data-x]').onclick = close;
      m.querySelector('[data-ok]').onclick = function () { close(); ok(); };
    });
  }
  function busy(btn, on, label) { btn.disabled = on; btn.innerHTML = on ? '<span class="spin"></span> กำลังบันทึก...' : label; }

  /* ---------- ตัวสร้างฟอร์มจากรายการช่อง ---------- */
  function formHTML(fields, d) {
    return '<div class="fgrid">' + fields.map(function (f) {
      if (f.sec) return '<div class="form-sec">' + esc(f.sec) + '</div>';
      var v = d[f.k] == null ? '' : d[f.k], full = f.full || f.t === 'textarea' || f.t === 'image' || f.t === 'check' ? ' full' : '', lab = '<label>' + esc(f.l) + (f.req ? ' <em>*</em>' : '') + '</label>', inp;
      if (f.t === 'textarea') inp = '<textarea data-k="' + f.k + '" style="min-height:' + (f.h || 100) + 'px">' + esc(v) + '</textarea>';
      else if (f.t === 'select') inp = '<select data-k="' + f.k + '">' + opts(f.o, v) + '</select>';
      else if (f.t === 'check') return '<div class="field full"><label class="chk"><input type="checkbox" data-k="' + f.k + '"' + (v !== false && v !== 'false' ? ' checked' : '') + '><span>' + esc(f.l) + '</span></label></div>';
      else if (f.t === 'image') inp = '<div class="upload"><input type="url" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="วางลิงก์รูป หรือกดอัปโหลด" style="flex:1;min-width:180px"><button type="button" class="btn btn-outline btn-sm" data-up>' + icon('upload') + ' อัปโหลดรูป</button><input type="file" accept="image/*" hidden></div><div class="pv">' + (safeUrl(v) ? '<img src="' + esc(safeUrl(v)) + '" alt="">' : '') + '</div>';
      else inp = '<input type="' + (f.t || 'text') + '" data-k="' + f.k + '" value="' + esc(v) + '"' + (f.t === 'number' ? ' min="0"' + (f.max ? ' max="' + f.max + '"' : '') : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
      return '<div class="field' + full + '">' + lab + inp + (f.s ? '<small>' + esc(f.s) + '</small>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function bindForm(root) {
    $$('.upload', root).forEach(function (u) {
      var file = $('input[type=file]', u), url = $('input[type=url]', u), pv = u.nextElementSibling;
      $('[data-up]', u).onclick = function () { file.click(); };
      url.oninput = function () { pv.innerHTML = safeUrl(url.value) ? '<img src="' + esc(safeUrl(url.value)) + '" alt="">' : ''; };
      file.onchange = function () {
        if (!file.files[0]) return;
        var b = $('[data-up]', u); b.disabled = true; b.innerHTML = '<span class="spin"></span> กำลังอัปโหลด...';
        compressImage(file.files[0], 1400, 900000).then(function (d) { return API.uploadImage(d, 'img-' + Date.now() + '.jpg'); })
          .then(function (link) { url.value = link; url.oninput(); toast('อัปโหลดรูปแล้ว'); })
          .catch(function (e) { toast(e.message, 'err'); })
          .then(function () { b.disabled = false; b.innerHTML = icon('upload') + ' อัปโหลดรูป'; });
      };
    });
  }
  function readForm(fields, root) {
    var o = {};
    fields.forEach(function (f) {
      if (f.sec) return;
      var el = $('[data-k="' + f.k + '"]', root); if (!el) return;
      o[f.k] = f.t === 'check' ? el.checked : (f.t === 'number' ? Number(el.value) || 0 : el.value.trim());
    });
    return o;
  }

  /* ---------- เข้าสู่ระบบ ---------- */
  function loginView() {
    app.innerHTML = '<div class="login"><div class="hero-bg"><div class="aurora"></div></div><div class="glass"><span class="brand-mark" style="width:52px;height:52px;border-radius:17px;font-size:1.5rem">' + icon('lock') + '</span><h1>ระบบแอดมิน</h1><p>เข้าสู่ระบบเพื่อจัดการเนื้อหาของเว็บไซต์</p>' +
      '<form id="lf"><div class="field"><label for="pw">รหัสผ่านผู้ดูแล</label><input type="password" id="pw" autocomplete="current-password" autofocus></div><button class="btn btn-primary" type="submit">เข้าสู่ระบบ ' + icon('arrow-right') + '</button></form>' +
      (API.demo ? '<div class="hint">โหมดสาธิต: รหัสผ่านคือ <b>' + esc(window.SITE_CONFIG.DEMO_PASSWORD) + '</b></div>' : '') + '<p style="margin-top:1rem"><a href="index.html" style="color:var(--mint)">← กลับหน้าเว็บไซต์</a></p></div></div>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault();
      var b = $('#lf button'); b.disabled = true; b.innerHTML = '<span class="spin"></span> กำลังตรวจสอบ...';
      API.login($('#pw').value).then(load).catch(function (er) { toast(er.message, 'err'); b.disabled = false; b.innerHTML = 'เข้าสู่ระบบ ' + icon('arrow-right'); });
    };
  }
  function load() {
    return API.adminGetAll().then(function (d) {
      d.projects = d.projects.map(function (p) { return Object.assign({}, p, { progress: Number(p.progress) || 0, budget: Number(p.budget) || 0 }); });
      A = d; A.gallery = A.gallery || []; shell();
    });
  }

  /* ---------- โครงหน้าแอดมิน ---------- */
  function shell() {
    var nw = A.reports.filter(function (r) { return r.status === 'new'; }).length;
    app.innerHTML = '<div class="adm"><aside class="side"><div class="brand"><span class="brand-mark">' + icon('sprout') + '</span><b>แอดมิน</b></div><nav><span class="side-ind"></span>' +
      NAV.map(function (n) { return '<button data-v="' + n[0] + '">' + icon(n[1]) + '<span class="lg">' + n[2] + '</span><span class="sh">' + n[3] + '</span>' + (n[0] === 'reports' && nw ? '<i class="cnt">' + nw + '</i>' : '') + '</button>'; }).join('') + '</nav>' +
      '<div class="foot"><a href="index.html" target="_blank" rel="noopener">' + icon('eye') + ' ดูหน้าเว็บ</a><button id="lo">' + icon('logout') + '<span> ออกจากระบบ</span></button></div></aside><main class="main" id="mn"></main></div>';
    $$('.side nav button').forEach(function (b) { b.onclick = function () { cur = b.getAttribute('data-v'); render(); }; });
    $('#lo').onclick = function () { API.logout(); A = null; loginView(); };
    window.addEventListener('resize', moveInd);
    render();
  }
  function moveInd() {
    var b = $('.side nav button.on'), i = $('.side-ind');
    if (b && i) { i.style.height = b.offsetHeight + 'px'; i.style.transform = 'translateY(' + b.offsetTop + 'px)'; }
  }
  function head(t, sub, right) { return '<div class="top"><div><h1>' + t + '</h1><p>' + sub + '</p></div><div>' + (right || '') + '</div></div>'; }
  function render() {
    $$('.side nav button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === cur); });
    moveInd();
    var mn = $('#mn'), v = { dash: dash, reports: reports, map: mapView, projects: projects, news: news, gallery: gallery, settings: settings }[cur]();
    mn.innerHTML = '<div class="pane">' + (API.demo ? '<div class="banner"><span>โหมดสาธิต: ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น (ดูวิธีเชื่อม Google Sheet ใน README)</span><button class="btn btn-outline btn-sm" id="resetBtn">รีเซ็ตข้อมูลตัวอย่าง</button></div>' : '') + v.html + '</div>';
    if (API.demo) $('#resetBtn').onclick = function () { confirmBox('รีเซ็ตข้อมูลทั้งหมดกลับเป็นข้อมูลตัวอย่าง?', function () { API.resetDemo().then(load); }); };
    v.after && v.after();
    requestAnimationFrame(function () { $$('.bar', mn).forEach(function (b) { b.classList.add('in'); }); $$('[data-count]', mn).forEach(countUp); });
  }
  function status(map, s) { var x = map[s] || { label: s, cls: 's-new' }; return '<span class="badge ' + x.cls + '">' + x.label + '</span>'; }

  /* ---------- ภาพรวม ---------- */
  function dash() {
    var R = A.reports, c = function (s) { return R.filter(function (r) { return r.status === s; }).length; }, cats = {};
    R.forEach(function (r) { cats[r.category] = (cats[r.category] || 0) + 1; });
    var ks = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }), mx = Math.max.apply(null, ks.map(function (k) { return cats[k]; }).concat(1));
    var kp = [['inbox', c('new'), 'รอรับเรื่อง'], ['clock', c('doing'), 'กำลังดำเนินการ'], ['check', c('done'), 'แก้ไขแล้ว'], ['layers', A.projects.length, 'โครงการ'], ['newspaper', A.news.length, 'ข่าว/กิจกรรม']];
    return {
      html: head('ภาพรวม', 'สรุปสถานะล่าสุดของเว็บไซต์') + '<div class="kpis">' + kp.map(function (k) { return '<div class="kpi">' + icon(k[0]) + '<b data-count="' + k[1] + '">0</b><span>' + k[2] + '</span></div>'; }).join('') + '</div>' +
        '<div class="cols"><div class="box"><h3>เรื่องแจ้งแยกตามประเภท</h3>' + (ks.length ? ks.map(function (k) { return '<div class="hbar"><span>' + esc(k) + '</span><div class="bar" style="--p:' + Math.round(cats[k] / mx * 100) + '"><i></i></div><b>' + cats[k] + '</b></div>'; }).join('') : '<p style="color:var(--muted)">ยังไม่มีเรื่องแจ้ง</p>') + '</div>' +
        '<div class="box"><h3>เรื่องแจ้งล่าสุด</h3>' + (R.length ? '<table class="tbl"><tbody>' + R.slice(0, 5).map(function (r) { return '<tr class="click" data-r="' + esc(r.code) + '"><td><div class="t-main">' + esc(r.category) + '</div><div class="t-sub">' + esc(r.detail) + '</div></td><td>' + status(TH.REPORT_STATUS, r.status) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p style="color:var(--muted)">ยังไม่มีเรื่องแจ้ง</p>') + '</div></div>',
      after: function () { $$('[data-r]').forEach(function (t) { t.onclick = function () { reportModal(t.getAttribute('data-r')); }; }); }
    };
  }

  /* ---------- เรื่องแจ้งปัญหา ---------- */
  function reports() {
    var list = A.reports.filter(function (r) { return (rf.st === 'all' || r.status === rf.st) && (!rf.q || (r.code + r.category + r.detail + r.name + r.location).toLowerCase().indexOf(rf.q.toLowerCase()) >= 0); });
    var f = [['all', 'ทั้งหมด']].concat(stOpts(TH.REPORT_STATUS));
    return {
      html: head('เรื่องแจ้งปัญหา', 'คลิกที่แถวเพื่อดูรายละเอียดและเปลี่ยนสถานะ', '<button class="btn btn-outline btn-sm" id="csv">' + icon('download') + ' ส่งออก CSV</button>') +
        '<div class="toolbar"><div class="filters">' + f.map(function (x) { return '<button class="chip' + (rf.st === x[0] ? ' on' : '') + '" data-s="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><input type="search" id="rq" placeholder="ค้นหา..." value="' + esc(rf.q) + '"></div><div class="box" style="margin-top:0;padding:.6rem">' +
        (list.length ? '<table class="tbl"><thead><tr><th>เลขติดตาม</th><th>วันที่แจ้ง</th><th>เรื่อง</th><th>สถานะ</th></tr></thead><tbody>' + list.map(function (r) {
          return '<tr class="click" data-r="' + esc(r.code) + '"><td data-l="เลขติดตาม"><b class="code">' + esc(r.code) + '</b></td><td data-l="วันที่แจ้ง">' + fmtDate(r.createdAt, 1) + '</td><td data-l="เรื่อง"><div class="t-main">' + esc(r.category) + '</div><div class="t-sub">' + esc(r.detail) + '</div></td><td>' + status(TH.REPORT_STATUS, r.status) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty" style="border:0">' + icon('inbox') + '<p>ไม่พบเรื่องแจ้ง</p></div>') + '</div>',
      after: function () {
        $$('[data-s]').forEach(function (b) { b.onclick = function () { rf.st = b.getAttribute('data-s'); render(); }; });
        $('#rq').onchange = function () { rf.q = this.value.trim(); render(); };
        $$('[data-r]').forEach(function (t) { t.onclick = function () { reportModal(t.getAttribute('data-r')); }; });
        $('#csv').onclick = exportCsv;
      }
    };
  }
  function exportCsv() {
    var cols = ['code', 'createdAt', 'updatedAt', 'category', 'location', 'detail', 'name', 'phone', 'status', 'note', 'lat', 'lng'];
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var csv = '﻿' + cols.join(',') + '\n' + A.reports.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'reports.csv'; a.click(); URL.revokeObjectURL(a.href);
  }
  function reportModal(code) {
    var r = A.reports.filter(function (x) { return x.code === code; })[0]; if (!r) return;
    var map = r.lat && r.lng ? ' <a href="https://www.google.com/maps?q=' + encodeURIComponent(r.lat + ',' + r.lng) + '" target="_blank" rel="noopener" style="color:var(--teal)">เปิดแผนที่</a>' : '';
    var tel = r.phone ? '<a href="tel:' + esc(String(r.phone).replace(/[^0-9+]/g, '')) + '" style="color:var(--teal)">' + esc(r.phone) + '</a>' : '-';
    var img = safeUrl(r.image);
    modal(r.code, '<div class="kv"><div><small>ประเภท</small><b>' + esc(r.category) + '</b></div><div><small>แจ้งเมื่อ</small><b>' + fmtDateTime(r.createdAt) + '</b></div><div><small>สถานที่</small><b>' + esc(r.location || '-') + '</b>' + map + '</div><div><small>ผู้แจ้ง</small><b>' + esc(r.name || 'ไม่ระบุชื่อ') + '</b></div><div><small>เบอร์โทร</small><b>' + tel + '</b></div></div>' +
      '<div class="art-body" style="box-shadow:none;margin:0 0 1rem;padding:1rem 1.2rem">' + paragraphs(r.detail) + '</div>' + (img ? '<p><a href="' + esc(img) + '" target="_blank" rel="noopener"><img src="' + esc(img) + '" alt="รูปประกอบ" style="max-height:220px;border-radius:16px;border:1px solid var(--line)"></a></p>' : '') +
      '<div class="fgrid" style="margin-top:1rem"><div class="field full"><label>สถานะ</label><select id="rs">' + opts(stOpts(TH.REPORT_STATUS), r.status) + '</select></div><div class="field full"><label>ข้อความถึงผู้แจ้ง</label><textarea id="rn" placeholder="เช่น ส่งช่างเข้าตรวจสอบแล้ว">' + esc(r.note) + '</textarea><small>แสดงในหน้า "ติดตามสถานะ" ของผู้แจ้ง</small></div></div>' +
      '<div class="m-actions"><button class="btn btn-danger" data-del>' + icon('trash') + ' ลบเรื่องนี้</button><button class="btn btn-dark" data-save>บันทึก</button></div>', '', function (m, close) {
        $('[data-save]', m).onclick = function () {
          var b = this; busy(b, true);
          API.updateReport(code, { status: $('#rs', m).value, note: $('#rn', m).value.trim() }).then(function (u) {
            Object.assign(r, { status: u.status || $('#rs', m).value, note: u.note == null ? $('#rn', m).value.trim() : u.note, updatedAt: u.updatedAt || new Date().toISOString() });
            toast('บันทึกแล้ว'); close(); shell();
          }).catch(function (e) { toast(e.message, 'err'); busy(b, false, 'บันทึก'); });
        };
        $('[data-del]', m).onclick = function () { confirmBox('ลบเรื่อง ' + code + ' ถาวร?', function () { close(); del('reports', code); }); };
      });
  }
  function del(sheet, id) {
    API.deleteItem(sheet, id).then(function () { A[sheet] = A[sheet].filter(function (x) { return (x.code || x.id) !== id; }); toast('ลบแล้ว'); shell(); }).catch(function (e) { toast(e.message, 'err'); });
  }

  /* ---------- แผนที่จุดแจ้งปัญหา ---------- */
  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var COLORS = { 'new': '#2f55b3', doing: '#d99a00', done: '#0c9d63' };
  var leafletP = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise(function (ok, bad) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.css'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = LEAFLET + 'leaflet.js';
      s.onload = function () { if (window.L) ok(window.L); else { leafletP = null; bad(new Error('no L')); } };
      s.onerror = function () { leafletP = null; bad(new Error('โหลดแผนที่ไม่ได้')); };
      document.head.appendChild(s);
    });
    return leafletP;
  }
  function drawMap(L, pts) {
    var el = $('#map'); if (!el) return;
    var map = L.map(el, { scrollWheelZoom: false }).setView([+pts[0].lat, +pts[0].lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    var group = L.featureGroup(pts.map(function (r) {
      return L.circleMarker([+r.lat, +r.lng], { radius: 11, color: '#fff', weight: 3, fillColor: COLORS[r.status] || COLORS['new'], fillOpacity: 1 })
        .bindPopup('<b>' + esc(r.category) + '</b><br>' + esc(String(r.detail || '').slice(0, 90)) + '<br><button class="btn btn-dark btn-sm" style="margin-top:.5rem" data-open="' + esc(r.code) + '">เปิดรายละเอียด</button>');
    })).addTo(map);
    map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 17 });
    map.on('popupopen', function (e) { var b = e.popup.getElement().querySelector('[data-open]'); if (b) b.onclick = function () { reportModal(b.getAttribute('data-open')); }; });
    setTimeout(function () { map.invalidateSize(); }, 350);
  }
  function mapFallback(pts) {
    var el = $('#map'); if (!el) return;
    el.style.height = 'auto';
    el.innerHTML = '<div class="empty" style="border:0"><p>โหลดแผนที่ไม่ได้ (ตรวจสอบอินเทอร์เน็ต) เปิดดูทีละจุดผ่าน Google Maps แทน</p></div><table class="tbl"><tbody>' + pts.map(function (r) {
      return '<tr><td><b class="code">' + esc(r.code) + '</b></td><td>' + esc(r.category) + '</td><td>' + status(TH.REPORT_STATUS, r.status) + '</td><td><a href="https://www.google.com/maps?q=' + encodeURIComponent(r.lat + ',' + r.lng) + '" target="_blank" rel="noopener" style="color:var(--teal)">เปิดแผนที่</a></td></tr>';
    }).join('') + '</tbody></table>';
  }
  function mapView() {
    var all = A.reports.filter(function (r) { var la = parseFloat(r.lat), lo = parseFloat(r.lng); return isFinite(la) && isFinite(lo) && (la || lo); });
    var pts = all.filter(function (r) { return mf === 'all' || r.status === mf; });
    var cnt = function (s) { return all.filter(function (r) { return s === 'all' || r.status === s; }).length; };
    var f = [['all', 'ทั้งหมด']].concat(stOpts(TH.REPORT_STATUS));
    return {
      html: head('แผนที่จุดแจ้งปัญหา', 'แสดงเฉพาะเรื่องที่ผู้แจ้งกดปักตำแหน่ง (' + all.length + ' จาก ' + A.reports.length + ' เรื่อง)') +
        '<div class="toolbar"><div class="filters">' + f.map(function (x) { return '<button class="chip' + (mf === x[0] ? ' on' : '') + '" data-m="' + x[0] + '">' + (COLORS[x[0]] ? '<i class="dot" style="background:' + COLORS[x[0]] + '"></i>' : '') + x[1] + ' (' + cnt(x[0]) + ')</button>'; }).join('') + '</div></div>' +
        '<div class="box" style="margin-top:0;padding:.6rem">' + (pts.length ? '<div id="map"></div>' : '<div class="empty" style="border:0">' + icon('pin') + '<p>' + (all.length ? 'ไม่มีเรื่องในสถานะนี้' : 'ยังไม่มีเรื่องที่ปักตำแหน่ง (ผู้แจ้งต้องกดปุ่ม "ปักตำแหน่งปัจจุบัน" ในฟอร์มแจ้งปัญหา)') + '</p></div>') + '</div>',
      after: function () {
        $$('[data-m]').forEach(function (b) { b.onclick = function () { mf = b.getAttribute('data-m'); render(); }; });
        if (!pts.length) return;
        loadLeaflet().then(function (L) { drawMap(L, pts); }).catch(function () { mapFallback(pts); });
      }
    };
  }

  /* ---------- โครงการ / ข่าว (ใช้ตัวจัดการรายการร่วมกัน) ---------- */
  function listPage(o) {
    return {
      html: head(o.title, o.sub, '<button class="btn btn-dark btn-sm" id="add">' + icon('plus') + ' เพิ่มใหม่</button>') + '<div class="box" style="margin-top:0;padding:.6rem">' +
        (A[o.sheet].length ? '<table class="tbl"><thead><tr><th></th><th>' + o.col1 + '</th><th>' + o.col2 + '</th><th></th></tr></thead><tbody>' + A[o.sheet].map(function (x) {
          return '<tr class="' + (x.published === false ? 'off' : '') + '"><td>' + (safeUrl(x.image) ? '<img class="mini-thumb" src="' + esc(safeUrl(x.image)) + '" alt="">' : '<div class="mini-thumb"></div>') + '</td><td data-l="' + o.col1 + '"><div class="t-main">' + esc(x.title) + '</div><div class="t-sub">' + o.sub1(x) + '</div></td><td data-l="' + o.col2 + '">' + o.cell(x) + '</td><td><div class="acts"><button class="ib" data-e="' + esc(x.id) + '" aria-label="แก้ไข">' + icon('pencil') + '</button><button class="ib del" data-d="' + esc(x.id) + '" aria-label="ลบ">' + icon('trash') + '</button></div></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty" style="border:0">' + icon('inbox') + '<p>ยังไม่มีรายการ กด "เพิ่มใหม่" เพื่อเริ่มต้น</p></div>') + '</div>',
      after: function () {
        $('#add').onclick = function () { itemModal(o, null); };
        $$('[data-e]').forEach(function (b) { b.onclick = function () { itemModal(o, b.getAttribute('data-e')); }; });
        $$('[data-d]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-d'); confirmBox('ลบรายการนี้ถาวร?', function () { del(o.sheet, id); }); }; });
      }
    };
  }
  function itemModal(o, id) {
    var item = id ? A[o.sheet].filter(function (x) { return x.id === id; })[0] : o.blank();
    modal(id ? 'แก้ไข' + o.noun : 'เพิ่ม' + o.noun, formHTML(o.fields(), item) + '<div class="m-actions"><button class="btn btn-outline" data-x>ยกเลิก</button><button class="btn btn-dark" data-save>บันทึก</button></div>', '', function (m, close) {
      bindForm(m);
      $('[data-x]', m).onclick = close;
      $('[data-save]', m).onclick = function () {
        var b = this, v = readForm(o.fields(), m);
        if (!v.title) return toast('กรุณากรอกหัวข้อ', 'err');
        if (v.image && !safeUrl(v.image)) return toast('ลิงก์รูปต้องขึ้นต้นด้วย http:// หรือ https://', 'err');
        if (o.needImage && !v.image) return toast('กรุณาเพิ่มรูปภาพ', 'err');
        var rec = Object.assign({}, item, v, { id: item.id });
        busy(b, true);
        API.saveItem(o.sheet, rec).then(function () {
          var i = A[o.sheet].findIndex(function (x) { return x.id === rec.id; });
          if (i >= 0) A[o.sheet][i] = rec; else A[o.sheet].unshift(rec);
          if (o.sheet === 'news') A.news.sort(function (a, c) { return String(c.date).localeCompare(String(a.date)); });
          toast('บันทึกแล้ว'); close(); render();
        }).catch(function (e) { toast(e.message, 'err'); busy(b, false, 'บันทึก'); });
      };
    });
  }
  var today = function () { return new Date().toISOString().slice(0, 10); };
  function projects() {
    return listPage({
      sheet: 'projects', title: 'โครงการพัฒนา', sub: 'เพิ่ม แก้ไข และอัปเดตความคืบหน้าของโครงการ', noun: 'โครงการ', col1: 'โครงการ', col2: 'ความคืบหน้า',
      sub1: function (x) { return esc(x.location || ''); },
      cell: function (x) { return status(TH.PROJECT_STATUS, x.status) + '<div class="bar" style="--p:' + x.progress + ';margin-top:.4rem;width:140px"><i></i></div>'; },
      blank: function () { return { id: uid('p_'), status: 'plan', progress: 0, budget: 0, startDate: today(), endDate: '', location: '', description: '', image: '', title: '' }; },
      fields: function () { return [{ k: 'title', l: 'ชื่อโครงการ', req: 1, full: 1 }, { k: 'status', l: 'สถานะ', t: 'select', o: stOpts(TH.PROJECT_STATUS) }, { k: 'progress', l: 'ความคืบหน้า (%)', t: 'number', max: 100 }, { k: 'budget', l: 'งบประมาณ (บาท)', t: 'number' }, { k: 'location', l: 'สถานที่' }, { k: 'startDate', l: 'วันเริ่ม', t: 'date' }, { k: 'endDate', l: 'วันสิ้นสุด', t: 'date' }, { k: 'description', l: 'รายละเอียด', t: 'textarea', h: 130 }, { k: 'image', l: 'รูปภาพ', t: 'image' }]; }
    });
  }
  function news() {
    return listPage({
      sheet: 'news', title: 'ข่าวและกิจกรรม', sub: 'เขียนประกาศ ข่าว และกิจกรรมของชุมชน', noun: 'ข่าว', col1: 'หัวข้อ', col2: 'หมวด / วันที่',
      sub1: function (x) { return esc(x.summary || ''); },
      cell: function (x) { return '<span class="tag">' + esc(x.category) + '</span><div class="t-sub" style="margin-top:.3rem">' + fmtDate(x.date, 1) + (x.published === false ? ' · ฉบับร่าง' : '') + '</div>'; },
      blank: function () { return { id: uid('n_'), title: '', category: 'ประกาศ', date: today(), summary: '', content: '', image: '', published: true }; },
      fields: function () {
        var cats = Array.from(new Set(TH.NEWS_CATS.concat(A.news.map(function (n) { return n.category; }).filter(Boolean)))).map(function (c) { return [c, c]; });
        return [{ k: 'title', l: 'หัวข้อข่าว', req: 1, full: 1 }, { k: 'category', l: 'หมวดหมู่', t: 'select', o: cats }, { k: 'date', l: 'วันที่', t: 'date' }, { k: 'summary', l: 'สรุปสั้นๆ (แสดงบนการ์ด)', t: 'textarea', h: 70 }, { k: 'content', l: 'เนื้อหาเต็ม', t: 'textarea', h: 170, s: 'ขึ้นย่อหน้าใหม่ด้วยการกด Enter' }, { k: 'image', l: 'รูปปก', t: 'image' }, { k: 'published', l: 'เผยแพร่ข่าวนี้บนหน้าเว็บ (ไม่ติ๊ก = ฉบับร่าง)', t: 'check' }];
      }
    });
  }

  function gallery() {
    return listPage({
      sheet: 'gallery', title: 'แกลเลอรี่ภาพกิจกรรม', sub: 'เพิ่มภาพกิจกรรมพร้อมคำอธิบาย แสดงที่หน้า "แกลเลอรี่"', noun: 'ภาพ', col1: 'ภาพ', col2: 'วันที่', needImage: true,
      sub1: function (x) { return esc(x.caption || ''); },
      cell: function (x) { return fmtDate(x.date, 1); },
      blank: function () { return { id: uid('g_'), title: '', date: today(), caption: '', image: '' }; },
      fields: function () { return [{ k: 'title', l: 'ชื่อภาพ / กิจกรรม', req: 1, full: 1 }, { k: 'date', l: 'วันที่', t: 'date' }, { k: 'image', l: 'รูปภาพ', t: 'image', req: 1 }, { k: 'caption', l: 'คำอธิบายภาพ', t: 'textarea', h: 80 }]; }
    });
  }

  /* ---------- ตั้งค่าเว็บ ---------- */
  function settings() {
    var F = [{ sec: 'ชื่อและคำโปรย' }, { k: 'siteName', l: 'ชื่อเว็บ / ชื่อชุมชน' }, { k: 'siteTagline', l: 'คำโปรยท้ายเว็บ' }, { sec: 'หน้าแรก (ส่วนบนสุด)' }, { k: 'heroEyebrow', l: 'ข้อความเล็กเหนือหัวข้อ' }, { k: 'heroTitle', l: 'หัวข้อใหญ่', full: 1, s: 'ใช้เครื่องหมาย | เพื่อขึ้นบรรทัดใหม่ เช่น ชุมชนเข้มแข็ง|เริ่มต้นที่เราทุกคน' },
      { k: 'heroSubtitle', l: 'คำอธิบายใต้หัวข้อ', t: 'textarea', h: 80 }, { k: 'heroImage', l: 'รูปพื้นหลังหน้าแรก (ไม่บังคับ)', t: 'image' }, { sec: 'เกี่ยวกับชุมชน' }, { k: 'aboutTitle', l: 'หัวข้อ', full: 1 }, { k: 'aboutText', l: 'ข้อความแนะนำชุมชน', t: 'textarea', h: 130 },
      { k: 'population', l: 'ประชากร (คน)', t: 'number' }, { k: 'households', l: 'ครัวเรือน', t: 'number' }, { k: 'groups', l: 'จำนวนกลุ่ม/ชมรม', t: 'number' }, { sec: 'ข้อมูลติดต่อ' }, { k: 'phone', l: 'เบอร์โทรศัพท์' }, { k: 'email', l: 'อีเมล' }, { k: 'address', l: 'ที่อยู่', full: 1 }, { k: 'officeHours', l: 'เวลาทำการ', full: 1 },
      { k: 'lineUrl', l: 'ลิงก์ LINE', t: 'url', ph: 'https://line.me/...' }, { k: 'facebookUrl', l: 'ลิงก์ Facebook', t: 'url', ph: 'https://facebook.com/...' }, { k: 'mapEmbed', l: 'ลิงก์ฝังแผนที่ Google Maps', t: 'url', full: 1, s: 'Google Maps > แชร์ > ฝังแผนที่ แล้วคัดลอกเฉพาะลิงก์ใน src="..."' }];
    return {
      html: head('ตั้งค่าเว็บ', 'แก้ไขข้อความและข้อมูลติดต่อที่แสดงบนหน้าเว็บ') + '<div class="box" style="margin-top:0" id="sf">' + formHTML(F, A.settings) + '<div class="m-actions"><button class="btn btn-dark" id="ss">บันทึกการตั้งค่า</button></div></div>',
      after: function () {
        bindForm($('#sf'));
        $('#ss').onclick = function () {
          var b = this, v = readForm(F, $('#sf'));
          ['heroImage', 'lineUrl', 'facebookUrl', 'mapEmbed'].forEach(function (k) { if (v[k] && !safeUrl(v[k])) v[k] = ''; });
          busy(b, true);
          API.saveSettings(v).then(function () { A.settings = Object.assign({}, A.settings, v); toast('บันทึกการตั้งค่าแล้ว'); busy(b, false, 'บันทึกการตั้งค่า'); })
            .catch(function (e) { toast(e.message, 'err'); busy(b, false, 'บันทึกการตั้งค่า'); });
        };
      }
    };
  }

  /* ---------- เริ่มต้น ---------- */
  if (API.isAuthed()) load().catch(function () { API.logout(); loginView(); }); else loginView();
})();
