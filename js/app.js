/* หน้าเว็บสาธารณะ: ระบบเปลี่ยนหน้าด้วย hash (#/news, #/projects ...) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var view = $('#view');
  var S = { ready: false, settings: {}, news: [], projects: [], gallery: [], reportStats: [] };
  var CODES = 'cw_my_codes';

  function set(k, fb) { var v = S.settings[k]; return (v === undefined || v === null || v === '') ? (fb || '') : String(v); }
  function toneOf(id) { return 'tone' + fallbackTone(id); }

  /* ---------- ส่วนประกอบย่อย ---------- */
  function pageHero(eb, title, sub, back) {
    return '<section class="page-hero"><div class="container">' +
      (back ? '<a class="back-link" href="' + back[0] + '">' + icon('arrow-left') + ' ' + esc(back[1]) + '</a><br>' : '') +
      '<span class="eyebrow">' + esc(eb) + '</span><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></section>';
  }
  function empty(msg) { return '<div class="empty" style="grid-column:1/-1">' + icon('inbox') + '<p>' + esc(msg) + '</p></div>'; }
  function emptyFilter(msg, clearId) {
    return '<div class="empty" style="grid-column:1/-1">' + icon('inbox') + '<p>' + esc(msg) + '</p>' + (clearId ? '<button type="button" class="btn btn-outline btn-sm" id="' + clearId + '">ล้างตัวกรอง</button>' : '') + '</div>';
  }
  function resetFilters(chipsId, inputId) {
    var c = $('#' + chipsId + ' .chip'); $('#' + inputId).value = ''; if (c) c.click();
  }
  function thumb(img) {
    img = safeUrl(img);
    return img ? '<div class="thumb"><img src="' + esc(img) + '" alt="" loading="lazy" decoding="async"></div>' : '';
  }
  function newsCard(n, d) {
    return '<a class="card reveal" style="--rd:' + (d || 0) + 's" href="#/news/' + encodeURIComponent(n.id) + '">' + thumb(n.image) +
      '<div class="card-b"><div class="meta"><span class="tag">' + esc(n.category) + '</span><span>' + fmtDate(n.date, 1) + '</span></div><h3>' + esc(n.title) + '</h3><p class="sum">' + esc(n.summary) + '</p></div></a>';
  }
  function projectCard(p, d) {
    var st = TH.PROJECT_STATUS[p.status] || TH.PROJECT_STATUS.plan;
    var facts = (p.location ? '<span>' + icon('pin') + ' ' + esc(p.location) + '</span>' : '') + (p.budget ? '<span>งบประมาณ ' + fmtNum(p.budget) + ' บาท</span>' : '');
    return '<a class="card reveal" style="--rd:' + (d || 0) + 's" href="#/projects/' + encodeURIComponent(p.id) + '">' + thumb(p.image) +
      '<div class="card-b"><div class="meta"><span class="badge ' + st.cls + '">' + st.label + '</span></div><h3>' + esc(p.title) + '</h3><p class="sum">' + esc(p.description) + '</p>' +
      (facts ? '<div class="facts">' + facts + '</div>' : '') +
      '<div style="margin-top:auto;padding-top:.6rem"><div class="pr-row"><span>ความคืบหน้า</span><b>' + p.progress + '%</b></div><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.progress + '" aria-label="ความคืบหน้า ' + esc(p.title) + '" style="--p:' + p.progress + '"><i></i></div></div></div></a>';
  }
  function searchBox(id, ph) {
    return '<label class="search">' + icon('search') + '<input type="search" id="' + id + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off"></label>';
  }
  function chips(items, id) {
    return '<div class="filters" id="' + id + '">' + items.map(function (c, i) {
      return '<button class="chip' + (i === 0 ? ' on' : '') + '" aria-pressed="' + (i === 0) + '" data-c="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
    }).join('') + '</div>';
  }
  function bindChips(id, draw) {
    $$('#' + id + ' .chip').forEach(function (b) {
      b.onclick = function () {
        $$('#' + id + ' .chip').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); draw(b.getAttribute('data-c'));
      };
    });
  }

  /* ---------- แผนที่โครงการ 3 มิติ (แสดงเฉพาะโครงการที่มีพิกัดจริง) ---------- */
  var cleanup3d = null, M3_V = '20261113c';
  function destroy3d() { if (cleanup3d) { try { cleanup3d(); } catch (e) { /* ข้าม */ } cleanup3d = null; } }
  function geoProjects() { return S.projects.filter(function (p) { return p.lat !== null && p.lng !== null && !(p.lat === 0 && p.lng === 0); }); }
  function mapSection(head) {
    var g = geoProjects(); if (!g.length) return '';
    var leg = [['plan', 'วางแผน'], ['doing', 'กำลังดำเนินการ'], ['done', 'เสร็จสิ้น']].map(function (x) { return '<span><i class="sw sw-' + x[0] + '"></i>' + x[1] + '</span>'; }).join('');
    return '<section class="section m3-sec"><div class="container">' + head('แผนที่โครงการ', 'โครงการอยู่ตรงไหน คืบหน้าแค่ไหน') +
      '<div class="m3" id="m3"><div class="m3-stage" id="m3-stage"><span class="m3-load">กำลังเตรียมแผนที่...</span></div><div class="m3-side"><ul class="m3-list">' + g.map(function (p) {
        var st = TH.PROJECT_STATUS[p.status] || TH.PROJECT_STATUS.plan;
        return '<li><button type="button" class="m3-i" data-id="' + esc(p.id) + '" aria-pressed="false"><b>' + esc(p.title) + '</b><span><span class="badge ' + st.cls + '">' + st.label + '</span> ' + p.progress + '%</span></button></li>';
      }).join('') + '</ul><div class="m3-card" id="m3-card" aria-live="polite"></div></div></div>' +
      '<div class="m3-foot"><div class="m3-legend">' + leg + '<span id="m3-key">ขนาดของจุด = ความคืบหน้า</span></div><button type="button" class="btn btn-outline btn-sm" id="m3-pause" hidden>หยุดหมุน</button></div>' +
      '<p class="m3-note" id="m3-note">ตำแหน่งและระยะห่างคำนวณจากพิกัดที่ผู้ดูแลกรอกไว้ ไม่ใช่แผนที่ถนน' + (g.length < S.projects.length ? ' · แสดง ' + g.length + ' จาก ' + S.projects.length + ' โครงการ (ที่มีพิกัด)' : '') + '</p></div></section>';
  }
  function loadMap3d() {
    if (window.Map3D) return Promise.resolve(window.Map3D);
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'js/map3d.js?v=' + M3_V;
      s.onload = function () { window.Map3D ? res(window.Map3D) : rej(new Error('map3d')); };
      s.onerror = function () { rej(new Error('map3d')); };
      document.head.appendChild(s);
    });
  }
  function initMap3d() {
    var root = $('#m3'); if (!root) return;
    var items = geoProjects(), handle = null, dead = false, io2 = null, card = $('#m3-card'), btns = $$('.m3-i', root);
    var prompt = '<p class="muted">เลือกโครงการจากรายการ หรือกดที่จุด/แท่งบนแผนที่ เพื่อดูรายละเอียด</p>';
    card.innerHTML = prompt;
    function select(id) {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === id)); });
      var p = items.filter(function (x) { return x.id === id; })[0];
      if (!p) { card.innerHTML = prompt; return; }
      var st = TH.PROJECT_STATUS[p.status] || TH.PROJECT_STATUS.plan;
      card.innerHTML = '<h3>' + esc(p.title) + '</h3><p><span class="badge ' + st.cls + '">' + st.label + '</span>' + (p.location ? ' <span class="muted">' + icon('pin') + ' ' + esc(p.location) + '</span>' : '') + '</p>' +
        '<div class="pr-row"><span>ความคืบหน้า</span><b>' + p.progress + '%</b></div><div class="bar in" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.progress + '" aria-label="ความคืบหน้า ' + esc(p.title) + '" style="--p:' + p.progress + '"><i></i></div>' +
        '<a class="btn btn-outline btn-sm" href="#/projects/' + encodeURIComponent(p.id) + '">ดูรายละเอียดโครงการ ' + icon('arrow-right') + '</a>';
      if (handle) handle.select(id);
    }
    btns.forEach(function (b) { b.onclick = function () { select(b.getAttribute('data-id')); }; });
    function ext(m) { return m >= 1000 ? (m / 1000).toFixed(1).replace(/\.0$/, '') + ' กิโลเมตร' : Math.round(m / 10) * 10 + ' เมตร'; }
    function start() {
      var st = $('#m3-stage'); if (!st) return;
      loadMap3d().then(function (M) {
        if (dead) return;
        var ld = $('.m3-load', st); if (ld) ld.remove();
        handle = M.mount(st, items, {
          reduced: prefersReduced, onPick: select,
          onMode: function (h) {
            var key = $('#m3-key'); if (key) key.textContent = h.mode === 'webgl' ? 'ความสูงของแท่ง = ความคืบหน้า (เส้นบางคือ 100%) · ลากเพื่อหมุนมุมมอง' : 'ขนาดของจุด = ความคืบหน้า';
            var pb = $('#m3-pause'); if (!pb) return;
            pb.hidden = !(h.mode === 'webgl' && h.canSpin); pb.textContent = 'หยุดหมุน';
            pb.onclick = function () { var on = !h.isSpinning(); h.setSpin(on); pb.textContent = on ? 'หยุดหมุน' : 'หมุนต่อ'; };
          }
        });
        var n = $('#m3-note'); if (n && handle.extentM) n.textContent += ' · พื้นที่ที่แสดงกว้างประมาณ ' + ext(handle.extentM);
      }).catch(function () { root.classList.add('m3-nostage'); });
    }
    if ('IntersectionObserver' in window) {
      io2 = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io2.disconnect(); start(); } }, { rootMargin: '300px' });
      io2.observe(root);
    } else start();
    cleanup3d = function () { dead = true; if (io2) io2.disconnect(); if (handle) handle.destroy(); };
  }

  /* ---------- หน้าแรก ---------- */
  function stats() {
    var P = S.projects, R = S.reportStats;
    return { doneR: R.filter(function (r) { return r.status === 'done'; }).length, totalR: R.length, total: P.length };
  }
  function homeView() {
    var st = stats(), photo = safeUrl(set('heroImage'));
    var lines = String(set('heroTitle', 'ชุมชนเข้มแข็ง|เริ่มต้นที่เราทุกคน')).split('|');
    var title = lines.map(function (l) { return '<span class="line">' + esc(l) + '</span>'; }).join('');
    var feat = S.projects.slice().sort(function (a, b) { return (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1); }).slice(0, 3);
    var svc = [
      ['01', 'แจ้งปัญหา', 'ถนนชำรุด ไฟดับ ขยะ น้ำท่วม แจ้งได้ทันที', '#/report', 1],
      ['02', 'ติดตามสถานะ', 'ใส่เลขติดตามเพื่อดูความคืบหน้าเรื่องที่แจ้ง', '#/track'],
      ['03', 'ข่าวและกิจกรรม', 'ประกาศและกิจกรรมล่าสุดของชุมชน', '#/news'],
      ['04', 'โครงการพัฒนา', 'ความคืบหน้าและงบประมาณของแต่ละโครงการ', '#/projects']
    ];
    /* ตัวเลขชุมชน: แสดงเฉพาะค่าที่มีจริง ไม่แสดงศูนย์หรือค่าสมมติ */
    var fig = [];
    [['population', 'ประชากร (คน)'], ['households', 'ครัวเรือน'], ['groups', 'กลุ่ม/ชมรมในชุมชน']].forEach(function (x) { var v = Number(set(x[0])) || 0; if (v > 0) fig.push([v, x[1]]); });
    if (st.total > 0) fig.push([st.total, 'โครงการพัฒนา']);
    if (st.totalR > 0) fig.push([st.doneR, 'เรื่องแจ้งที่แก้ไขแล้ว (จากทั้งหมด ' + fmtNum(st.totalR) + ' เรื่อง)']);
    var aboutImg = safeUrl(set('aboutImage'));
    var head = function (eb, h, link, href) {
      return '<div class="sec-head reveal"><div><span class="eyebrow">' + eb + '</span><h2>' + h + '</h2></div>' + (link ? '<a class="btn btn-outline btn-sm" href="' + href + '">' + link + ' ' + icon('arrow-right') + '</a>' : '') + '</div>';
    };
    var html = '<section class="hero">' + (photo ? '<div class="hero-photo" style="background-image:url(\'' + esc(photo) + '\')"></div>' : '') +
      '<div class="container hero-grid"><div><span class="eyebrow">' + esc(set('heroEyebrow', 'เว็บไซต์พัฒนาชุมชน')) + '</span><h1>' + title + '</h1>' +
      (set('heroSubtitle') ? '<p class="hero-sub">' + esc(set('heroSubtitle')) + '</p>' : '') +
      '<div class="hero-cta"><a class="btn btn-accent" href="#/report">แจ้งปัญหาในชุมชน ' + icon('arrow-right') + '</a><a class="btn btn-ghost" href="#/track">ติดตามสถานะ</a></div>' +
      '<p class="hero-note">' + icon('shield') + '<span>ทุกเรื่องที่แจ้งจะได้รับเลขติดตาม ชื่อและเบอร์โทรของผู้แจ้งเห็นได้เฉพาะเจ้าหน้าที่</span></p></div>' +
      '<nav class="qs-panel" aria-label="บริการที่ใช้บ่อย"><div class="qs-head">บริการที่ใช้บ่อย</div>' + svc.map(function (x) {
        return '<a class="qs' + (x[4] ? ' main' : '') + '" href="' + x[3] + '"><span class="qs-n">' + x[0] + '</span><span><b>' + x[1] + '</b><small>' + x[2] + '</small></span>' + icon('arrow-right') + '</a>';
      }).join('') + '</nav></div></section>' +

      mapSection(head) +

      (fig.length ? '<section class="section"><div class="container">' + head('ชุมชนในตัวเลข', 'ข้อมูลชุมชนโดยสรุป') + '<div class="figures">' + fig.map(function (x) {
        return '<div class="fig"><b>' + fmtNum(x[0]) + '</b><span>' + esc(x[1]) + '</span></div>';
      }).join('') + '</div></div></section>' : '') +

      '<section class="section"><div class="container">' + head('โครงการพัฒนา', 'สิ่งที่เรากำลังทำเพื่อชุมชน', 'ดูทั้งหมด', '#/projects') + '<div class="grid g3">' +
      (feat.length ? feat.map(function (p, i) { return projectCard(p, i * 0.08); }).join('') : empty('ยังไม่มีโครงการ')) + '</div></div></section>' +

      '<section class="section"><div class="container">' + head('ข่าวและกิจกรรม', 'ข่าวสารล่าสุด', 'ดูทั้งหมด', '#/news') + '<div class="grid g3">' +
      (S.news.length ? S.news.slice(0, 3).map(function (n, i) { return newsCard(n, i * 0.08); }).join('') : empty('ยังไม่มีข่าว')) + '</div></div></section>' +

      (S.gallery.length ? '<section class="section"><div class="container">' + head('แกลเลอรี่', 'ภาพกิจกรรมล่าสุด', 'ดูทั้งหมด', '#/gallery') + '<div class="gallery">' + galleryGrid(S.gallery.slice(0, 6)) + '</div></div></section>' : '') +

      '<section class="section"><div class="container"><div class="cta reveal"><div><h2>แจ้งปัญหาแล้ว อยากรู้ว่าไปถึงไหน?</h2><p>กรอกเลขติดตามที่ได้ตอนแจ้งเรื่อง เพื่อดูสถานะล่าสุด</p></div>' +
      '<form class="trk" id="homeTrk"><input id="homeCode" placeholder="เช่น RP-261106-AB12" aria-label="เลขติดตามเรื่อง" autocomplete="off"><button class="btn btn-dark" type="submit">ตรวจสอบ ' + icon('arrow-right') + '</button></form></div></div></section>' +

      (set('aboutText') ? '<section class="section"><div class="container"><div class="about' + (aboutImg ? '' : ' solo') + '"><div class="about-text reveal"><span class="eyebrow">เกี่ยวกับเรา</span><h2>' + esc(set('aboutTitle', 'เกี่ยวกับชุมชนของเรา')) + '</h2>' + paragraphs(set('aboutText')) + '<a class="btn btn-outline" href="#/about">อ่านเพิ่มเติม ' + icon('arrow-right') + '</a></div>' +
        (aboutImg ? '<img class="ab-img reveal" src="' + esc(aboutImg) + '" alt="" loading="lazy" decoding="async">' : '') + '</div></div></section>' : '');

    return {
      title: 'หน้าแรก', html: html, after: function () {
        bindGallery(S.gallery.slice(0, 6)); initMap3d();
        $('#homeTrk').onsubmit = function (e) { e.preventDefault(); var c = normCode($('#homeCode').value); if (c) location.hash = '#/track/' + encodeURIComponent(c); };
      }
    };
  }

  /* ---------- ข่าว ---------- */
  function newsView() {
    var cats = [['ทั้งหมด', 'ทั้งหมด']].concat(Array.from(new Set(S.news.map(function (n) { return n.category; }).filter(Boolean))).map(function (c) { return [c, c]; }));
    return {
      title: 'ข่าวและกิจกรรม',
      html: pageHero('ข่าวและกิจกรรม', 'ข่าวสารและกิจกรรมชุมชน', 'ติดตามประกาศ กิจกรรม และความเคลื่อนไหวล่าสุดของชุมชน') +
        '<section class="section"><div class="container"><div class="tools">' + chips(cats, 'nf') + searchBox('nq', 'ค้นหาข่าว...') + '</div><p class="count" id="nc" role="status" aria-live="polite"></p><div class="grid g3" id="ng"></div></div></section>',
      after: function () {
        var cat = 'ทั้งหมด';
        function draw() {
          var q = $('#nq').value.trim().toLowerCase();
          var l = S.news.filter(function (n) { return (cat === 'ทั้งหมด' || n.category === cat) && (!q || (n.title + ' ' + n.summary + ' ' + n.category).toLowerCase().indexOf(q) >= 0); });
          var on = !!q || cat !== 'ทั้งหมด';
          $('#nc').textContent = S.news.length ? (on ? 'พบ ' + l.length + ' จาก ' + S.news.length + ' ข่าว' : 'ทั้งหมด ' + S.news.length + ' ข่าว') : '';
          $('#ng').innerHTML = l.length ? l.map(function (n, i) { return newsCard(n, i * 0.06); }).join('') : (S.news.length ? emptyFilter('ไม่พบข่าวที่ตรงกับเงื่อนไข ลองเปลี่ยนคำค้นหรือหมวดหมู่', 'nclr') : empty('ยังไม่มีข่าวและกิจกรรม'));
          var cl = $('#nclr'); if (cl) cl.onclick = function () { resetFilters('nf', 'nq'); $('#nq').focus(); };
          observe();
        }
        bindChips('nf', function (c) { cat = c; draw(); }); $('#nq').oninput = draw; draw();
      }
    };
  }
  function newsDetail(id) {
    var n = S.news.filter(function (x) { return x.id === id; })[0];
    if (!n) return notFound();
    var img = safeUrl(n.image), more = S.news.filter(function (x) { return x.id !== id; }).slice(0, 3);
    return {
      title: n.title,
      html: pageHero(n.category + ' · ' + fmtDate(n.date), n.title, '', ['#/news', 'กลับไปข่าวทั้งหมด']) +
        '<div class="container"><div class="article">' + (img ? '<div class="art-img"><img src="' + esc(img) + '" alt=""></div>' : '') +
        '<div class="art-body">' + paragraphs(n.content || n.summary) + '<div class="share"><span>แชร์ข่าวนี้</span><a class="btn btn-outline btn-sm" id="sh-line" target="_blank" rel="noopener">' + icon('chat') + ' LINE</a><a class="btn btn-outline btn-sm" id="sh-fb" target="_blank" rel="noopener">' + icon('facebook') + ' Facebook</a><button class="btn btn-outline btn-sm" id="cp">' + icon('copy') + ' คัดลอกลิงก์</button></div></div></div>' +
        (more.length ? '<div class="section"><div class="sec-head"><h2 style="font-size:1.6rem">ข่าวอื่นๆ</h2></div><div class="grid g3">' + more.map(function (x, i) { return newsCard(x, i * 0.08); }).join('') + '</div></div>' : '') + '</div><div style="height:90px"></div>',
      after: function () {
        var u = encodeURIComponent(location.href);
        $('#sh-line').href = 'https://social-plugins.line.me/lineit/share?url=' + u;
        $('#sh-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + u;
        $('#cp').onclick = function () { copyText(location.href); };
      }
    };
  }

  /* ---------- โครงการ ---------- */
  function projectsView() {
    var f = [['all', 'ทั้งหมด'], ['doing', 'กำลังดำเนินการ'], ['plan', 'วางแผน'], ['done', 'เสร็จสิ้น']];
    return {
      title: 'โครงการพัฒนา',
      html: pageHero('โครงการพัฒนา', 'โครงการพัฒนาชุมชน', 'ติดตามความคืบหน้า งบประมาณ และผลลัพธ์ของทุกโครงการอย่างโปร่งใส') +
        '<section class="section"><div class="container"><div class="tools">' + chips(f, 'pf') + searchBox('pq', 'ค้นหาโครงการ...') + '</div><p class="count" id="pc" role="status" aria-live="polite"></p><div class="grid g3" id="pg"></div></div></section>',
      after: function () {
        var st = 'all';
        function draw() {
          var q = $('#pq').value.trim().toLowerCase();
          var l = S.projects.filter(function (p) { return (st === 'all' || p.status === st) && (!q || (p.title + ' ' + p.description + ' ' + p.location).toLowerCase().indexOf(q) >= 0); });
          var on = !!q || st !== 'all', sum = l.reduce(function (a, p) { return a + (p.budget || 0); }, 0);
          $('#pc').textContent = S.projects.length ? (on ? 'พบ ' + l.length + ' จาก ' + S.projects.length + ' โครงการ' : 'ทั้งหมด ' + S.projects.length + ' โครงการ') + (sum > 0 ? ' · งบประมาณรวม ' + fmtNum(sum) + ' บาท' : '') : '';
          $('#pg').innerHTML = l.length ? l.map(function (p, i) { return projectCard(p, i * 0.06); }).join('') : (S.projects.length ? emptyFilter('ไม่พบโครงการที่ตรงกับเงื่อนไข ลองเปลี่ยนคำค้นหรือสถานะ', 'pclr') : empty('ยังไม่มีโครงการ'));
          var cl = $('#pclr'); if (cl) cl.onclick = function () { resetFilters('pf', 'pq'); $('#pq').focus(); };
          observe();
        }
        bindChips('pf', function (c) { st = c; draw(); }); $('#pq').oninput = draw; draw();
      }
    };
  }
  function projectDetail(id) {
    var p = S.projects.filter(function (x) { return x.id === id; })[0];
    if (!p) return notFound();
    var st = TH.PROJECT_STATUS[p.status] || TH.PROJECT_STATUS.plan, img = safeUrl(p.image);
    var period = (p.startDate ? fmtDate(p.startDate, 1) : '-') + (p.endDate ? ' – ' + fmtDate(p.endDate, 1) : '');
    return {
      title: p.title,
      html: pageHero('โครงการพัฒนา', p.title, '', ['#/projects', 'กลับไปโครงการทั้งหมด']) +
        '<div class="container"><div class="article">' + (img ? '<div class="art-img"><img src="' + esc(img) + '" alt=""></div>' : '') +
        '<div class="art-body"><div class="kv"><div><small>สถานะ</small><span class="badge ' + st.cls + '">' + st.label + '</span></div><div><small>ช่วงเวลา</small><b>' + esc(period) + '</b></div>' +
        '<div><small>งบประมาณ</small><b>' + (p.budget ? fmtNum(p.budget) + ' บาท' : '-') + '</b></div><div><small>สถานที่</small><b>' + esc(p.location || '-') + '</b></div></div>' +
        '<div class="pr-row"><span>ความคืบหน้า</span><b>' + p.progress + '%</b></div><div class="bar reveal" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + p.progress + '" aria-label="ความคืบหน้าโครงการ" style="--p:' + p.progress + ';margin-bottom:1.4rem"><i></i></div>' + paragraphs(p.description) + '</div></div></div><div style="height:90px"></div>'
    };
  }

  /* ---------- แจ้งปัญหา ---------- */
  function saveCode(code) {
    try {
      var a = JSON.parse(localStorage.getItem(CODES) || '[]'); a.unshift(code);
      localStorage.setItem(CODES, JSON.stringify(Array.from(new Set(a)).slice(0, 8)));
    } catch (e) { /* ไม่เป็นไร */ }
  }
  function myCodes() { try { return JSON.parse(localStorage.getItem(CODES) || '[]'); } catch (e) { return []; } }

  /* รูปแบบเลขติดตาม: RP-YYMMDD-XXXX (รับได้ทั้งแบบพิมพ์ติดกัน เว้นวรรค หรือตัวพิมพ์เล็ก) */
  function normCode(c) {
    var raw = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    var m = /^RP(\d{6})([A-Z0-9]{4})$/.exec(raw);
    return m ? 'RP-' + m[1] + '-' + m[2] : String(c || '').trim().toUpperCase();
  }

  var VALID = {
    cat: function (v) { return v ? '' : 'กรุณาเลือกประเภทปัญหา'; },
    detail: function (v) { v = v.trim(); return v.length >= 10 ? '' : 'กรุณาอธิบายอย่างน้อย 10 ตัวอักษร (ตอนนี้ ' + v.length + ' ตัว)'; },
    phone: function (v) { v = v.replace(/[\s\-().]/g, ''); return (!v || /^(\+66|0)\d{8,9}$/.test(v)) ? '' : 'เบอร์โทรไม่ถูกต้อง ตัวอย่าง 081-234-5678'; },
    consent: function (v) { return v ? '' : 'กรุณาติ๊กยินยอมก่อนส่งเรื่อง'; }
  };

  function reportView() {
    var note = set('privacyNote');
    return {
      title: 'แจ้งปัญหา',
      html: pageHero('แจ้งปัญหา / ข้อเสนอแนะ', 'แจ้งปัญหาในชุมชน', 'กรอกรายละเอียด แล้วรับเลขติดตามไว้เช็คสถานะได้ทุกเมื่อ') +
        '<div class="container"><div class="form-wrap">' +
        '<div class="callout" role="note">' + icon('alert') + '<p><b>เหตุฉุกเฉินอย่ารอผ่านเว็บ</b> หากมีผู้บาดเจ็บหรืออันตรายถึงชีวิต โทร <a href="tel:191">191</a> (ตำรวจ) · <a href="tel:1669">1669</a> (แพทย์ฉุกเฉิน) · <a href="tel:199">199</a> (เหตุเพลิงไหม้)</p></div>' +
        '<div class="panel" id="rp"><form id="rf" novalidate><div class="fgrid">' +
        '<div class="field" id="g-cat"><label for="f-cat">ประเภทปัญหา <em>*</em></label><select id="f-cat" aria-describedby="e-cat" aria-required="true"><option value="">เลือกประเภท</option>' + TH.REPORT_CATS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select><p class="err" id="e-cat" hidden></p></div>' +
        '<div class="field"><label for="f-loc">สถานที่ / จุดสังเกต</label><input type="text" id="f-loc" maxlength="200" placeholder="เช่น หน้าซอย 3 ใกล้ศาลา" autocomplete="off"></div>' +
        '<div class="field full" id="g-detail"><label for="f-detail">รายละเอียด <em>*</em></label><textarea id="f-detail" maxlength="1500" aria-describedby="h-detail e-detail" aria-required="true" placeholder="อธิบายปัญหาที่พบ เกิดขึ้นเมื่อไร ผลกระทบเป็นอย่างไร"></textarea>' +
        '<div class="hint-row"><small id="h-detail">ยิ่งละเอียด เจ้าหน้าที่ยิ่งแก้ไขได้เร็ว (อย่างน้อย 10 ตัวอักษร)</small><small class="counter" id="c-detail" aria-hidden="true">0 / 1500</small></div><p class="err" id="e-detail" hidden></p></div>' +
        '<div class="field"><label for="f-name">ชื่อผู้แจ้ง (ไม่บังคับ)</label><input type="text" id="f-name" maxlength="80" autocomplete="name"></div>' +
        '<div class="field" id="g-phone"><label for="f-phone">เบอร์โทรติดต่อกลับ (ไม่บังคับ)</label><input type="tel" id="f-phone" inputmode="tel" maxlength="20" autocomplete="tel" aria-describedby="e-phone" placeholder="เช่น 081-234-5678"><p class="err" id="e-phone" hidden></p></div>' +
        '<div class="field full"><span class="lbl">รูปภาพและตำแหน่ง (ไม่บังคับ)</span><div class="upload"><button type="button" class="btn btn-outline btn-sm" id="f-pick">' + icon('image') + ' เลือก/ถ่ายรูป</button>' +
        '<input type="file" id="f-file" accept="image/*" hidden><span id="f-prev"></span><button type="button" class="btn btn-outline btn-sm" id="f-geo">' + icon('pin') + ' ปักตำแหน่งปัจจุบัน</button><span id="f-geo-ok" role="status" aria-live="polite"></span></div>' +
        '<small>ถ่ายเฉพาะจุดที่เป็นปัญหา และหลีกเลี่ยงการถ่ายติดใบหน้าหรือป้ายทะเบียนของบุคคลอื่น</small></div>' +
        '<div class="hp" aria-hidden="true"><input type="text" id="f-hp" tabindex="-1" autocomplete="off"></div>' +
        '<div class="field full"><dl class="privacy" aria-label="การใช้ข้อมูลส่วนบุคคล"><dt>ข้อมูลที่เก็บ</dt><dd>ประเภท รายละเอียด สถานที่ และ (ถ้าคุณใส่) ชื่อ เบอร์โทร รูปภาพ ตำแหน่ง GPS</dd>' +
        '<dt>ใช้เพื่อ</dt><dd>ตรวจสอบ แก้ไขปัญหาที่แจ้ง และติดต่อกลับเมื่อจำเป็น</dd>' +
        '<dt>ใครเห็นได้</dt><dd>ชื่อและเบอร์โทรเห็นได้เฉพาะผู้ดูแลระบบ ส่วนสถานะของเรื่องดูได้ด้วยเลขติดตาม</dd>' +
        '<dt>โปรดอย่ากรอก</dt><dd>ข้อมูลของบุคคลอื่น เลขบัตรประชาชน หรือข้อมูลการเงิน</dd>' + (note ? '<dt>หมายเหตุจากผู้ดูแล</dt><dd>' + esc(note) + '</dd>' : '') + '</dl></div>' +
        '<div class="field full" id="g-consent"><label class="consent"><input type="checkbox" id="f-consent" aria-describedby="e-consent"><span>ฉันยินยอมให้เก็บและใช้ข้อมูลที่กรอกตามรายการด้านบน เพื่อดำเนินการแก้ไขปัญหาของชุมชนเท่านั้น</span></label><p class="err" id="e-consent" hidden></p></div>' +
        '<div class="field full"><div class="alert" id="f-alert" role="alert" tabindex="-1" hidden></div><button class="btn btn-dark" type="submit" id="f-send">ส่งเรื่อง ' + icon('arrow-right') + '</button></div></div></form></div></div></div><div style="height:90px"></div>',
      after: reportAfter
    };
  }
  function reportAfter() {
    var t0 = Date.now(), img = '', lat = '', lng = '', busy = false;
    var touched = {};
    function val(k) {
      return k === 'cat' ? $('#f-cat').value : k === 'detail' ? $('#f-detail').value : k === 'phone' ? $('#f-phone').value : $('#f-consent').checked;
    }
    function ctl(k) { return $(k === 'cat' ? '#f-cat' : k === 'detail' ? '#f-detail' : k === 'phone' ? '#f-phone' : '#f-consent'); }
    function show(k) {
      var m = VALID[k](val(k)), e = $('#e-' + k), g = $('#g-' + k);
      e.hidden = !m; e.innerHTML = m ? icon('alert') + '<span>' + esc(m) + '</span>' : '';
      if (g) g.classList.toggle('bad', !!m);
      ctl(k).setAttribute('aria-invalid', m ? 'true' : 'false');
      return m;
    }
    ['cat', 'detail', 'phone', 'consent'].forEach(function (k) {
      var c = ctl(k), ev = (k === 'cat' || k === 'consent') ? 'change' : 'input';
      c.addEventListener('blur', function () { touched[k] = true; show(k); });
      c.addEventListener(ev, function () { if (touched[k] || k === 'cat' || k === 'consent') { touched[k] = true; show(k); } });
    });
    $('#f-detail').addEventListener('input', function () { $('#c-detail').textContent = this.value.length + ' / 1500'; });

    function alertMsg(msg) {
      var a = $('#f-alert'); a.textContent = msg; a.hidden = !msg; if (msg) a.focus();
    }
    $('#f-pick').onclick = function () { $('#f-file').click(); };
    $('#f-file').onchange = function () {
      var f = this.files[0]; if (!f) return;
      compressImage(f).then(function (d) {
        img = d;
        $('#f-prev').innerHTML = '<div class="upload-prev"><img src="' + d + '" alt="ตัวอย่างรูปที่แนบ"><button type="button" aria-label="ลบรูปที่แนบ">' + icon('x') + '</button></div>';
        $('#f-prev button').onclick = function () { img = ''; $('#f-prev').innerHTML = ''; $('#f-file').value = ''; $('#f-pick').focus(); };
      }).catch(function (e) { $('#f-file').value = ''; toast(e.message, 'err'); });
    };
    function geoDone(html) { $('#f-geo-ok').innerHTML = html; }
    $('#f-geo').onclick = function () {
      var b = this;
      if (!navigator.geolocation) return geoDone('<span class="geo-err">อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง กรุณาพิมพ์จุดสังเกตในช่อง “สถานที่”</span>');
      b.disabled = true; geoDone('<span class="muted">กำลังค้นหาตำแหน่ง...</span>');
      navigator.geolocation.getCurrentPosition(function (p) {
        b.disabled = false;
        lat = p.coords.latitude.toFixed(6); lng = p.coords.longitude.toFixed(6);
        var acc = Math.round(p.coords.accuracy || 0);
        geoDone('<span class="loc-ok">' + icon('check') + ' ปักตำแหน่งแล้ว' + (acc ? ' (คลาดเคลื่อนประมาณ ' + fmtNum(acc) + ' เมตร)' : '') + '</span> <button type="button" class="link-btn" id="f-geo-x">ลบตำแหน่ง</button>');
        $('#f-geo-x').onclick = function () { lat = ''; lng = ''; geoDone(''); b.focus(); };
      }, function (er) {
        b.disabled = false;
        geoDone('<span class="geo-err">' + (er && er.code === 1 ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง คุณพิมพ์จุดสังเกตในช่อง “สถานที่” แทนได้' : 'ระบุตำแหน่งไม่สำเร็จ ลองอีกครั้ง หรือพิมพ์จุดสังเกตในช่อง “สถานที่”') + '</span>');
      }, { timeout: 10000, enableHighAccuracy: true });
    };

    $('#rf').onsubmit = function (e) {
      e.preventDefault();
      if (busy) return;
      alertMsg('');
      var bad = ['cat', 'detail', 'phone', 'consent'].filter(function (k) { touched[k] = true; return show(k); });
      if (bad.length) { alertMsg('กรุณาแก้ไข ' + bad.length + ' รายการที่มีเครื่องหมายแจ้งเตือนด้านล่าง'); ctl(bad[0]).focus(); return; }
      if ($('#f-hp').value) return;
      if (navigator.onLine === false) { alertMsg('ขณะนี้ไม่มีการเชื่อมต่ออินเทอร์เน็ต ข้อมูลที่กรอกยังอยู่ครบ เมื่อสัญญาณกลับมาให้กดส่งเรื่องอีกครั้ง'); return; }
      busy = true;
      var btn = $('#f-send'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> กำลังส่ง...';
      var data = { category: $('#f-cat').value, location: $('#f-loc').value.trim(), detail: $('#f-detail').value.trim(), name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(), image: img, lat: lat, lng: lng, consent: true };
      // ระบบกันบอทต้องการให้ฟอร์มเปิดอยู่อย่างน้อย 2.5 วินาที: ถ้าส่งเร็วกว่านั้นจะรอให้อัตโนมัติ แทนที่จะปฏิเสธ
      sleep(Math.max(0, 2500 - (Date.now() - t0))).then(function () { return API.submitReport(data); })
        .then(function (r) {
          saveCode(r.code);
          $('#rp').innerHTML = '<div class="done-card"><svg class="check-anim" viewBox="0 0 92 92" aria-hidden="true"><circle cx="46" cy="46" r="42" pathLength="1"/><path d="M28 48l12 12 24-26" pathLength="1"/></svg>' +
            '<h2 id="ok-h" tabindex="-1">ส่งเรื่องเรียบร้อยแล้ว</h2><p class="muted">จดเลขติดตามนี้ไว้ เพื่อตรวจสอบสถานะภายหลัง (เครื่องนี้จะจำเลขไว้ให้ในหน้าติดตามสถานะด้วย)</p>' +
            '<div class="code-box"><span id="cc">' + esc(r.code) + '</span><button type="button" id="ccp" aria-label="คัดลอกเลขติดตาม">' + icon('copy') + '</button></div>' +
            '<div class="hero-cta" style="justify-content:center"><a class="btn btn-dark" href="#/track/' + encodeURIComponent(r.code) + '">ดูสถานะเรื่องนี้ ' + icon('arrow-right') + '</a><a class="btn btn-outline" href="#/">กลับหน้าแรก</a></div></div>';
          $('#ccp').onclick = function () { copyText(r.code); };
          window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }); $('#ok-h').focus({ preventScroll: true });
        }).catch(function (er) {
          busy = false; btn.disabled = false; btn.innerHTML = 'ส่งเรื่อง ' + icon('arrow-right');
          alertMsg((er && er.message ? er.message : 'ส่งเรื่องไม่สำเร็จ') + ' (ข้อมูลที่กรอกยังอยู่ครบ กดส่งอีกครั้งได้)');
        });
    };
  }

  /* ---------- ติดตามสถานะ ---------- */
  function daysAgo(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var n = Math.floor((Date.now() - d.getTime()) / 86400000);
    return n <= 0 ? 'แจ้งเมื่อวันนี้' : 'แจ้งมาแล้ว ' + fmtNum(n) + ' วัน';
  }
  function trackView(code) {
    var rec = myCodes();
    return {
      title: 'ติดตามสถานะ',
      html: pageHero('ติดตามสถานะ', 'ติดตามเรื่องที่แจ้ง', 'กรอกเลขติดตามที่ได้รับตอนแจ้งเรื่อง') +
        '<div class="container"><div class="form-wrap"><div class="panel"><form class="trk light" id="tf"><input id="tc" placeholder="เช่น RP-261106-AB12" value="' + esc(code) + '" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="เลขติดตามเรื่อง"><button class="btn btn-dark" type="submit">ตรวจสอบ ' + icon('search') + '</button></form>' +
        (rec.length ? '<p class="muted" style="margin-top:1rem;font-size:var(--fs-sm)">เรื่องที่คุณเคยแจ้งในเครื่องนี้</p><div class="recent">' + rec.map(function (c) { return '<a class="chip" href="#/track/' + encodeURIComponent(c) + '">' + esc(c) + '</a>'; }).join('') + '</div>' : '') +
        '</div><div id="tr" aria-live="polite"></div></div></div><div style="height:90px"></div>',
      after: function () {
        $('#tf').onsubmit = function (e) {
          e.preventDefault(); var c = normCode($('#tc').value); if (!c) { $('#tc').focus(); return; }
          var h = '#/track/' + encodeURIComponent(c);
          if (location.hash === h) load(); else location.hash = h;
        };
        if (!code) return;
        code = normCode(code);
        function fail(html) { $('#tr').innerHTML = html; var b = $('#tr-retry'); if (b) b.onclick = load; }
        function load() {
          $('#tr').innerHTML = '<div class="sk" style="height:260px;margin-top:1.2rem" role="status" aria-label="กำลังตรวจสอบสถานะ"></div>';
          API.trackReport(code).then(function (r) {
            if (!r) {
              var odd = /[OI01]/.test(code.replace(/^RP-\d{6}-/, ''));
              fail('<div class="empty" style="margin-top:1.2rem">' + icon('search') + '<p><b>ไม่พบเลขติดตาม ' + esc(code) + '</b></p><p>' + (odd ? 'เลขติดตามไม่มีตัวอักษร O, I และเลข 0, 1 ลองตรวจว่าสับสนกับ 0/O หรือ 1/I หรือไม่' : 'ตรวจตัวอักษรอีกครั้ง รูปแบบเลขคือ RP-ตัวเลข 6 หลัก-ตัวอักษร 4 ตัว') + '</p></div>');
              return;
            }
            var idx = { 'new': 0, doing: 1, done: 2 }[r.status] || 0, st = TH.REPORT_STATUS[r.status] || TH.REPORT_STATUS['new'];
            var steps = [
              ['inbox', 'รับเรื่องแล้ว', 'ระบบบันทึกเรื่องของคุณแล้ว รอเจ้าหน้าที่ตรวจสอบ', r.createdAt],
              ['clock', 'กำลังดำเนินการ', 'เจ้าหน้าที่กำลังดำเนินการแก้ไขเรื่องนี้', idx === 1 ? r.updatedAt : ''],
              ['check', 'แก้ไขเสร็จแล้ว', 'เจ้าหน้าที่แจ้งว่าดำเนินการเรียบร้อยแล้ว', idx === 2 ? r.updatedAt : '']
            ];
            var tl = steps.map(function (s, i) {
              var cls = i < idx ? 'past' : i === idx ? (idx === 2 ? 'past now' : 'now') : 'next';
              var sr = i < idx ? 'เสร็จแล้ว' : i === idx ? (idx === 2 ? 'เสร็จสิ้น' : 'ขั้นตอนปัจจุบัน') : 'ยังไม่ถึงขั้นตอนนี้';
              return '<li class="tl-i ' + cls + '"' + (i === idx && idx < 2 ? ' aria-current="step"' : '') + '><span class="tl-dot">' + icon(i < idx ? 'check' : s[0]) + '</span><div><b>' + s[1] + '<span class="vh"> — ' + sr + '</span></b>' +
                (s[3] ? '<small>' + fmtDateTime(s[3]) + '</small>' : '') + (i <= idx ? '<p>' + s[2] + '</p>' : '') + '</div></li>';
            }).join('');
            $('#tr').innerHTML = '<div class="panel" style="margin-top:1.2rem"><div class="meta"><span class="tag">' + esc(r.category) + '</span><span>' + icon('calendar') + ' ' + fmtDateTime(r.createdAt) + (daysAgo(r.createdAt) ? ' · ' + daysAgo(r.createdAt) : '') + '</span></div>' +
              '<h2 class="trk-h">เลขติดตาม <span class="code">' + esc(r.code) + '</span></h2>' +
              '<p class="trk-st">สถานะปัจจุบัน <span class="badge ' + st.cls + '">' + st.label + '</span></p>' +
              '<ol class="tl" aria-label="ขั้นตอนการดำเนินการ">' + tl + '</ol>' +
              (r.note ? '<div class="note"><small>ข้อความจากเจ้าหน้าที่</small>' + esc(r.note) + '</div>' : '') +
              '<div class="trk-acts"><button type="button" class="btn btn-outline btn-sm" id="tr-cp">' + icon('copy') + ' คัดลอกเลขติดตาม</button><button type="button" class="btn btn-outline btn-sm" id="tr-rf">' + icon('refresh') + ' ตรวจสอบอีกครั้ง</button></div>' +
              '<p class="muted trk-up">อัปเดตล่าสุด ' + fmtDateTime(r.updatedAt) + '</p></div>';
            $('#tr-cp').onclick = function () { copyText(r.code); };
            $('#tr-rf').onclick = load;
          }).catch(function (e) {
            fail('<div class="callout err" role="alert" style="margin-top:1.2rem">' + icon('alert') + '<div><p><b>' + (navigator.onLine === false ? 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต' : 'ตรวจสอบสถานะไม่สำเร็จ') + '</b></p><p>' + esc(e && e.message ? e.message : '') + '</p><button type="button" class="btn btn-outline btn-sm" id="tr-retry">ลองอีกครั้ง</button></div></div>');
          });
        }
        load();
      }
    };
  }

  /* ---------- แกลเลอรี่ ---------- */
  function galleryGrid(items) {
    return items.map(function (g, i) {
      var img = safeUrl(g.image);
      return '<button class="gl reveal" style="--rd:' + (i % 6) * 0.06 + 's" data-gi="' + i + '" aria-label="ดูภาพ ' + esc(g.title) + '">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(g.title) + '" loading="lazy">' : '<div class="ph ' + toneOf(g.id) + '">' + icon('image') + '</div>') +
        '<span class="gl-cap"><b>' + esc(g.title) + '</b><small>' + fmtDate(g.date, 1) + '</small></span></button>';
    }).join('');
  }
  function bindGallery(items) {
    $$('[data-gi]').forEach(function (b) { b.onclick = function () { openLightbox(items, Number(b.getAttribute('data-gi'))); }; });
  }
  function openLightbox(items, i) {
    var box = document.createElement('div'), x0 = 0, opener = document.activeElement;
    box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'ดูภาพกิจกรรม');
    box.innerHTML = '<button class="lb-x" aria-label="ปิด">' + icon('x') + '</button><button class="lb-n lb-prev" aria-label="ภาพก่อนหน้า">' + icon('arrow-left') + '</button><button class="lb-n lb-next" aria-label="ภาพถัดไป">' + icon('arrow-right') + '</button><figure class="lb-fig"></figure>';
    document.body.appendChild(box); document.body.style.overflow = 'hidden';
    function show(k) {
      i = (k + items.length) % items.length;
      var g = items[i], img = safeUrl(g.image), fig = $('.lb-fig', box);
      fig.classList.remove('swap'); void fig.offsetWidth; fig.classList.add('swap');
      fig.innerHTML = (img ? '<img src="' + esc(img) + '" alt="' + esc(g.title) + '">' : '<div class="ph ' + toneOf(g.id) + ' lb-ph">' + icon('image') + '</div>') +
        '<figcaption><b>' + esc(g.title) + '</b><span>' + fmtDate(g.date) + '</span>' + (g.caption ? '<p>' + esc(g.caption) + '</p>' : '') + '<small>' + (i + 1) + ' / ' + items.length + '</small></figcaption>';
    }
    function close() {
      document.removeEventListener('keydown', key); window.removeEventListener('hashchange', close);
      document.body.style.overflow = ''; box.classList.remove('in'); box.classList.add('out'); setTimeout(function () { box.remove(); }, 300);
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    function key(e) {
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'ArrowRight') show(i + 1);
      else if (e.key === 'Tab') { /* ให้โฟกัสวนอยู่ในหน้าต่างภาพ */
        var f = $$('button', box), a = document.activeElement;
        if (!f.length) return;
        if (e.shiftKey && (a === f[0] || !box.contains(a))) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (a === f[f.length - 1] || !box.contains(a))) { e.preventDefault(); f[0].focus(); }
      }
    }
    $('.lb-x', box).onclick = close; $('.lb-prev', box).onclick = function () { show(i - 1); }; $('.lb-next', box).onclick = function () { show(i + 1); };
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
    document.addEventListener('keydown', key); window.addEventListener('hashchange', close);
    show(i); requestAnimationFrame(function () { box.classList.add('in'); }); $('.lb-x', box).focus();
  }
  function galleryView() {
    return {
      title: 'แกลเลอรี่',
      html: pageHero('แกลเลอรี่', 'ภาพกิจกรรมของชุมชน', 'รวมภาพบรรยากาศกิจกรรมและความประทับใจของคนในชุมชน') +
        '<section class="section"><div class="container">' + (S.gallery.length ? '<div class="tools">' + searchBox('gq', 'ค้นหาภาพกิจกรรม...') + '</div><p class="count" id="gc" role="status" aria-live="polite"></p><div id="gg"></div>' : '<div class="grid">' + empty('ยังไม่มีภาพกิจกรรม') + '</div>') + '</div></section><div style="height:90px"></div>',
      after: function () {
        if (!S.gallery.length) return;
        function draw() {
          var q = $('#gq').value.trim().toLowerCase();
          var l = S.gallery.filter(function (g) { return !q || (g.title + ' ' + (g.caption || '')).toLowerCase().indexOf(q) >= 0; });
          $('#gc').textContent = q ? 'พบ ' + l.length + ' จาก ' + S.gallery.length + ' ภาพ' : 'ทั้งหมด ' + S.gallery.length + ' ภาพ';
          $('#gg').innerHTML = l.length ? '<div class="gallery">' + galleryGrid(l) + '</div>' : '<div class="grid">' + emptyFilter('ไม่พบภาพที่ตรงกับคำค้น', 'gclr') + '</div>';
          var cl = $('#gclr'); if (cl) cl.onclick = function () { $('#gq').value = ''; draw(); $('#gq').focus(); };
          bindGallery(l); observe();
        }
        $('#gq').oninput = draw; draw();
      }
    };
  }

  /* ---------- ติดต่อ ---------- */
  function lines(t) { return String(t || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function aboutView() {
    var vision = set('vision'), mission = lines(set('mission')), team = lines(set('team')).map(function (l) { var a = l.split('|'); return [a[0].trim(), (a[1] || '').trim()]; }), img = safeUrl(set('aboutImage'));
    var delay = function (i) { return ' style="--rd:' + i * 0.07 + 's"'; };
    return {
      title: 'เกี่ยวกับชุมชน',
      html: pageHero('เกี่ยวกับเรา', set('aboutTitle', 'เกี่ยวกับชุมชนของเรา'), set('siteTagline')) +
        '<section class="section"><div class="container"><div class="ab-story' + (img ? ' has-img' : '') + '"><div class="reveal">' + (paragraphs(set('aboutText')) || '<p class="muted">ยังไม่มีข้อมูล</p>') + '</div>' +
        (img ? '<img class="ab-img reveal" src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '') + '</div>' +
        (vision || mission.length ? '<div class="ab-vm">' +
          (vision ? '<div class="ab-card reveal">' + icon('sprout') + '<h3>วิสัยทัศน์</h3><p>' + esc(vision) + '</p></div>' : '') +
          (mission.length ? '<div class="ab-card reveal"' + delay(1) + '>' + icon('layers') + '<h3>พันธกิจ</h3><ul>' + mission.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>' : '') + '</div>' : '') +
        (team.length ? '<h2 class="ab-h reveal">คณะผู้บริหารและกรรมการชุมชน</h2><div class="team">' + team.map(function (t, i) {
          var ini = t[0].replace(/^(นางสาว|นาย|นาง|ดร\.|พระ|ว่าที่ร้อยตรี)\s*/, '').charAt(0) || t[0].charAt(0);
          return '<div class="team-card reveal"' + delay(i % 4) + '><span class="avatar">' + esc(ini) + '</span><b>' + esc(t[0]) + '</b><small>' + esc(t[1]) + '</small></div>';
        }).join('') + '</div>' : '') + '</div></section><div style="height:90px"></div>'
    };
  }
  function contactView() {
    var items = [['phone', 'โทรศัพท์', set('phone'), set('phone') ? 'tel:' + set('phone').replace(/[^0-9+]/g, '') : ''], ['mail', 'อีเมล', set('email'), set('email') ? 'mailto:' + set('email') : ''],
      ['pin', 'ที่อยู่', set('address'), ''], ['clock', 'เวลาทำการ', set('officeHours'), ''], ['chat', 'LINE', set('lineUrl') ? 'แอดไลน์ชุมชน' : '', safeUrl(set('lineUrl'))], ['facebook', 'Facebook', set('facebookUrl') ? 'เพจชุมชน' : '', safeUrl(set('facebookUrl'))]]
      .filter(function (x) { return x[2]; });
    var map = set('mapEmbed'), okMap = /^https:\/\/www\.google\.com\/maps\/embed/.test(map);
    return {
      title: 'ติดต่อ',
      html: pageHero('ติดต่อเรา', 'ติดต่อผู้ดูแลชุมชน', 'สอบถามข้อมูล เสนอแนะ หรือขอความช่วยเหลือ') +
        '<section class="section"><div class="container"><div class="contact-grid">' + items.map(function (x, i) {
          var inner = '<span class="svc-ic">' + icon(x[0]) + '</span><div><small>' + x[1] + '</small><b>' + esc(x[2]) + '</b></div>';
          return x[3] ? '<a class="cinfo reveal" style="--rd:' + i * 0.07 + 's" href="' + esc(x[3]) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="cinfo reveal" style="--rd:' + i * 0.07 + 's">' + inner + '</div>';
        }).join('') + '</div>' + (okMap ? '<div class="map reveal"><iframe src="' + esc(map) + '" loading="lazy" title="แผนที่"></iframe></div>' : '') + '</div></section><div style="height:90px"></div>'
    };
  }
  function notFound() {
    return { title: 'ไม่พบหน้า', html: pageHero('404', 'ไม่พบหน้าที่ต้องการ', 'ลิงก์อาจผิดหรือเนื้อหาถูกลบแล้ว') + '<div class="container section"><a class="btn btn-dark" href="#/">กลับหน้าแรก</a></div><div style="height:90px"></div>' };
  }

  /* ---------- ตัวช่วย ---------- */
  function copyText(t) {
    var done = function () { toast('คัดลอกแล้ว'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, done);
    else { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) { /* ข้าม */ } a.remove(); done(); }
  }
  var io;
  function observe() {
    var els = $$('.reveal:not(.in),[data-count]:not(.in),[data-io]:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); if (el.hasAttribute('data-count')) countUp(el); }); return; }
    if (!io) io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in'); if (e.target.hasAttribute('data-count')) countUp(e.target); io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  function setActive(p) {
    $$('.nav-links a, .mmenu a').forEach(function (a) { var on = a.getAttribute('data-p') === p; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  /* ---------- ระบบเปลี่ยนหน้า ---------- */
  var first = true;
  function closeMenu() {
    document.body.classList.remove('menu-open');
    var bg = $('#burger'); if (bg) { bg.setAttribute('aria-expanded', 'false'); bg.setAttribute('aria-label', 'เปิดเมนู'); }
    $('#mmenu').setAttribute('aria-hidden', 'true');
  }
  function route(nav) {
    if (!S.ready) return;
    var h = location.hash.replace(/^#\/?/, '').split('/');
    var page = h[0] || 'home', arg = h[1] ? decodeURIComponent(h.slice(1).join('/')) : '';
    var b = { home: homeView, news: function () { return arg ? newsDetail(arg) : newsView(); }, projects: function () { return arg ? projectDetail(arg) : projectsView(); },
      gallery: galleryView, about: aboutView, report: reportView, track: function () { return trackView(arg); }, contact: contactView }[page];
    closeMenu();
    view.classList.add('leaving');
    sleep(first || prefersReduced ? 0 : 170).then(function () {
      destroy3d();
      var r;
      try { r = b ? b() : notFound(); } catch (e) {
        if (window.console) console.error(e);
        r = { title: 'เกิดข้อผิดพลาด', html: pageHero('ขออภัย', 'แสดงหน้านี้ไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง หรือกลับไปหน้าแรก') + '<div class="container section"><a class="btn btn-dark" href="#/">กลับหน้าแรก</a></div><div style="height:90px"></div>' };
      }
      first = false;
      document.title = (page === 'home' ? set('siteName', 'เว็บไซต์พัฒนาชุมชน') : r.title + ' | ' + set('siteName', 'ชุมชน'));
      view.innerHTML = r.html;
      view.classList.remove('leaving'); view.classList.remove('entering'); void view.offsetWidth; view.classList.add('entering');
      window.scrollTo(0, 0); setActive(page); document.body.classList.toggle('no-dock', page === 'report');
      try { if (r.after) r.after(); } catch (e2) { if (window.console) console.error(e2); }
      observe();
      if (nav === true) { var h1 = $('h1', view); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } } /* ย้ายโฟกัสไปหัวข้อหน้าใหม่ ให้คนใช้คีย์บอร์ด/โปรแกรมอ่านจอรู้ว่าเปลี่ยนหน้าแล้ว */
    });
  }

  /* ---------- โครงหน้าเว็บ ---------- */
  function applySettings() {
    var name = set('siteName', 'ชุมชนของเรา');
    $('#brandName').textContent = name;
    var tel = set('phone'), line = safeUrl(set('lineUrl')), fb = safeUrl(set('facebookUrl'));
    $('#footer').innerHTML = '<div class="container"><div class="f-grid"><div><div class="brand"><span class="brand-mark">' + icon('sprout') + '</span><b style="max-width:none">' + esc(name) + '</b></div><p>' + esc(set('siteTagline')) + '</p>' +
      '<div class="social">' + (fb ? '<a href="' + esc(fb) + '" target="_blank" rel="noopener" aria-label="Facebook">' + icon('facebook') + '</a>' : '') + (line ? '<a href="' + esc(line) + '" target="_blank" rel="noopener" aria-label="LINE">' + icon('chat') + '</a>' : '') + '</div></div>' +
      '<div><h4>เมนู</h4><a href="#/report">แจ้งปัญหา</a><a href="#/track">ติดตามสถานะ</a><a href="#/news">ข่าวและกิจกรรม</a><a href="#/projects">โครงการพัฒนา</a><a href="#/gallery">แกลเลอรี่</a><a href="#/about">เกี่ยวกับชุมชน</a><a href="#/contact">ติดต่อ</a></div>' +
      '<div><h4>ติดต่อ</h4>' + (tel ? '<p>' + esc(tel) + '</p>' : '') + (set('email') ? '<p>' + esc(set('email')) + '</p>' : '') + (set('officeHours') ? '<p>' + esc(set('officeHours')) + '</p>' : '') + (set('address') ? '<p>' + esc(set('address')) + '</p>' : '') + '</div></div>' +
      '<div class="f-bottom"><span>© ' + (new Date().getFullYear() + 543) + ' ' + esc(name) + '</span><a href="admin.html">สำหรับผู้ดูแลระบบ</a></div></div>';
  }
  function initShell() {
    $('#brandMark').innerHTML = icon('sprout'); $('#ctaIc').innerHTML = icon('megaphone');
    var links = [['home', '#/', 'home', 'หน้าแรก'], ['report', '#/report', 'megaphone', 'แจ้งปัญหา'], ['track', '#/track', 'search', 'ติดตามสถานะ'], ['news', '#/news', 'newspaper', 'ข่าวและกิจกรรม'], ['projects', '#/projects', 'layers', 'โครงการพัฒนา'], ['gallery', '#/gallery', 'image', 'แกลเลอรี่'], ['about', '#/about', 'users', 'เกี่ยวกับชุมชน'], ['contact', '#/contact', 'phone', 'ติดต่อ']];
    $('#mmenu').innerHTML = links.map(function (l) { return '<a href="' + l[1] + '" data-p="' + l[0] + '">' + icon(l[2]) + l[3] + '</a>'; }).join('');
    $('#burger').setAttribute('aria-controls', 'mmenu');
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { closeMenu(); $('#burger').focus(); } });
    $('#burger').onclick = function () {
      var o = document.body.classList.toggle('menu-open'); this.setAttribute('aria-expanded', o); this.setAttribute('aria-label', o ? 'ปิดเมนู' : 'เปิดเมนู'); $('#mmenu').setAttribute('aria-hidden', !o);
    };
    $('.skip').onclick = function (e) { e.preventDefault(); view.setAttribute('tabindex', '-1'); view.focus(); };
    window.addEventListener('hashchange', function () { route(true); });
  }
  function loading(msg, err) {
    view.innerHTML = pageHero(err ? 'เกิดข้อผิดพลาด' : 'กำลังโหลด', err ? 'โหลดข้อมูลไม่สำเร็จ' : 'กรุณารอสักครู่...', err ? msg : '') +
      '<div class="container section">' + (err ? '<button class="btn btn-dark" id="retry">ลองอีกครั้ง</button>' : '<div class="grid g3"><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div></div>') + '</div>';
    if (err) $('#retry').onclick = boot;
  }
  function geoNum(v, max) {
    if (v === '' || v === null || v === undefined) return null;
    var n = Number(v); return (isFinite(n) && Math.abs(n) <= max) ? n : null;
  }
  function apply(d) {
    S.settings = d.settings || {}; S.news = d.news || []; S.gallery = (d.gallery || []).filter(function (g) { return safeUrl(g.image); }); S.reportStats = d.reportStats || [];
    S.projects = (d.projects || []).map(function (p) { return Object.assign({}, p, { progress: Math.max(0, Math.min(100, Number(p.progress) || 0)), budget: Number(p.budget) || 0, lat: geoNum(p.lat, 90), lng: geoNum(p.lng, 180) }); });
  }
  var KEY = 'cw_pub_cache_v1', lastRaw = '', stale = false, netbar = $('#netbar');
  function netState() {
    var off = navigator.onLine === false;
    if (!netbar) return;
    if (!S.ready || (!off && !stale)) { netbar.hidden = true; netbar.innerHTML = ''; return; }
    netbar.innerHTML = '<span>' + (off ? 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต กำลังแสดงข้อมูลที่บันทึกไว้ในเครื่อง' : 'อัปเดตข้อมูลล่าสุดไม่สำเร็จ กำลังแสดงข้อมูลที่บันทึกไว้ในเครื่อง') + '</span>' + (off ? '' : '<button type="button" id="netretry">ลองอีกครั้ง</button>');
    netbar.hidden = false;
    var b = $('#netretry'); if (b) b.onclick = function () { b.textContent = 'กำลังลองใหม่...'; refresh(false).catch(function () { /* netbar แสดงต่อ */ }); };
  }
  function safeToRerender() {
    var a = document.activeElement, t = a && a.tagName;
    return !(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') && !/^#\/report/.test(location.hash) && !document.querySelector('.lightbox, .lb');
  }
  function refresh(first) {
    return API.getPublic().then(function (d) {
      stale = false; netState();
      var now = JSON.stringify(d);
      try { localStorage.setItem(KEY, now); } catch (e) { /* ข้าม */ }
      if (now === lastRaw) return;
      lastRaw = now; apply(d); S.ready = true; applySettings();
      if (first || safeToRerender()) route(); // ถ้าผู้ใช้กำลังพิมพ์/กรอกฟอร์ม จะไม่รีเฟรชหน้า (ข้อมูลใหม่จะแสดงตอนเปลี่ยนหน้าถัดไป)
    }, function (e) { stale = true; netState(); throw e; });
  }
  function boot() {
    var cached = null;
    try { lastRaw = localStorage.getItem(KEY) || ''; cached = lastRaw ? JSON.parse(lastRaw) : null; } catch (e) { cached = null; lastRaw = ''; }
    if (cached && cached.news) { apply(cached); S.ready = true; applySettings(); route(); } else loading();
    refresh(!S.ready).catch(function (e) { if (!S.ready) loading(e.message, true); });
    // รีเฟรชข้อมูลเองทุก 90 วินาที (เฉพาะตอนเปิดหน้าเว็บอยู่) และทันทีเมื่อกลับมาที่แท็บ
    var tick = function () { if (!document.hidden && S.ready) refresh(false).catch(function () { /* ข้ามรอบนี้ */ }); };
    setInterval(tick, 90000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    window.addEventListener('offline', netState);
    window.addEventListener('online', function () { netState(); tick(); });
  }
  // ถ้ารูปโหลดไม่ได้ (ลิงก์เสีย) ให้แสดงกล่องสีแทน ไม่ให้เห็นไอคอนรูปแตก
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || !t.closest('.thumb, .gl, .art-img')) return;
    var ph = document.createElement('div');
    ph.className = 'ph tone' + fallbackTone(t.getAttribute('alt'));
    ph.innerHTML = icon('image');
    t.replaceWith(ph);
  }, true);
  initShell(); boot();
})();
