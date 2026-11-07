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
    return '<section class="page-hero"><div class="hero-bg"><div class="aurora"></div></div><div class="container">' +
      (back ? '<a class="back-link" href="' + back[0] + '">' + icon('arrow-left') + ' ' + esc(back[1]) + '</a><br>' : '') +
      '<span class="eyebrow">' + esc(eb) + '</span><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div></section>';
  }
  function empty(msg) { return '<div class="empty" style="grid-column:1/-1">' + icon('inbox') + '<p>' + esc(msg) + '</p></div>'; }
  function thumb(id, img, ph) {
    img = safeUrl(img);
    return img ? '<img src="' + esc(img) + '" alt="" loading="lazy">' : '<div class="ph ' + toneOf(id) + '">' + icon(ph) + '</div>';
  }
  function newsCard(n, d) {
    return '<a class="card reveal" style="--rd:' + (d || 0) + 's" href="#/news/' + encodeURIComponent(n.id) + '"><div class="thumb">' +
      thumb(n.id, n.image, 'newspaper') + '<span class="tag">' + esc(n.category) + '</span></div><div class="card-b"><div class="meta"><span>' +
      icon('calendar') + fmtDate(n.date) + '</span></div><h3>' + esc(n.title) + '</h3><p class="sum">' + esc(n.summary) + '</p></div></a>';
  }
  function projectCard(p, d) {
    var st = TH.PROJECT_STATUS[p.status] || TH.PROJECT_STATUS.plan;
    return '<a class="card reveal" style="--rd:' + (d || 0) + 's" href="#/projects/' + encodeURIComponent(p.id) + '"><div class="thumb">' +
      thumb(p.id, p.image, 'layers') + '<span class="badge ' + st.cls + '">' + st.label + '</span></div><div class="card-b"><h3>' + esc(p.title) +
      '</h3><p class="sum">' + esc(p.description) + '</p><div style="margin-top:auto;padding-top:.5rem"><div class="pr-row"><span>ความคืบหน้า</span><b>' +
      p.progress + '%</b></div><div class="bar" style="--p:' + p.progress + '"><i></i></div></div></div></a>';
  }
  function searchBox(id, ph) {
    return '<label class="search">' + icon('search') + '<input type="search" id="' + id + '" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off"></label>';
  }
  function chips(items, id) {
    return '<div class="filters" id="' + id + '">' + items.map(function (c, i) {
      return '<button class="chip' + (i === 0 ? ' on' : '') + '" data-c="' + esc(c[0]) + '">' + esc(c[1]) + '</button>';
    }).join('') + '</div>';
  }
  function bindChips(id, draw) {
    $$('#' + id + ' .chip').forEach(function (b) {
      b.onclick = function () {
        $$('#' + id + ' .chip').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); draw(b.getAttribute('data-c'));
      };
    });
  }

  /* ---------- สถิติสำหรับการ์ดบนฮีโร่ ---------- */
  function stats() {
    var P = S.projects, R = S.reportStats, now = new Date(), pts = [], i;
    var avg = P.length ? Math.round(P.reduce(function (a, p) { return a + p.progress; }, 0) / P.length) : 0;
    for (i = 5; i >= 0; i--) {
      var end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      pts.push(R.filter(function (r) { return r.status === 'done' && new Date(r.updatedAt) < end; }).length);
    }
    return {
      avg: avg, total: P.length, doing: P.filter(function (p) { return p.status === 'doing'; }).length,
      doneR: R.filter(function (r) { return r.status === 'done'; }).length, totalR: R.length, pts: pts
    };
  }
  function spark(pts) {
    var max = Math.max.apply(null, pts.concat(1)), w = 300, h = 76, xs = [], ys = [], d, i;
    pts.forEach(function (v, k) { xs.push(6 + k * (w - 12) / (pts.length - 1)); ys.push(h - 8 - (v / max) * (h - 22)); });
    d = 'M' + xs[0] + ',' + ys[0];
    for (i = 1; i < pts.length; i++) { var cx = (xs[i - 1] + xs[i]) / 2; d += ' C' + cx + ',' + ys[i - 1] + ' ' + cx + ',' + ys[i] + ' ' + xs[i] + ',' + ys[i]; }
    return { line: d, area: d + ' L' + xs[xs.length - 1] + ',' + h + ' L' + xs[0] + ',' + h + 'Z' };
  }
  function sky() {
    var s = '', i;
    for (i = 0; i < 26; i++) s += '<span style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 55).toFixed(1) + '%;animation-delay:' + (Math.random() * 4).toFixed(1) + 's"></span>';
    var f = '';
    for (i = 0; i < 12; i++) f += '<span style="left:' + (Math.random() * 100).toFixed(1) + '%;bottom:' + (6 + Math.random() * 34).toFixed(1) + '%;animation-delay:' + (Math.random() * 9).toFixed(1) + 's;animation-duration:' + (7 + Math.random() * 6).toFixed(1) + 's"></span>';
    return '<div class="stars">' + s + '</div><div class="fireflies">' + f + '</div>';
  }

  /* ---------- หน้าแรก ---------- */
  function homeView() {
    var st = stats(), sp = spark(st.pts), photo = safeUrl(set('heroImage'));
    var lines = String(set('heroTitle', 'ชุมชนเข้มแข็ง|เริ่มต้นที่เราทุกคน')).split('|');
    var title = lines.map(function (l, i) {
      return '<span class="line"><span class="line-in' + (i ? ' grad' : '') + '" style="--d:' + (0.15 + i * 0.14) + 's">' + esc(l) + '</span></span>';
    }).join('');
    var feat = S.projects.slice().sort(function (a, b) { return (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1); }).slice(0, 3);
    var svc = [
      ['newspaper', 'ข่าวและกิจกรรม', 'ประกาศและกิจกรรมล่าสุดของชุมชน', '#/news'],
      ['layers', 'โครงการพัฒนา', 'ดูความคืบหน้าและงบประมาณของแต่ละโครงการ', '#/projects'],
      ['megaphone', 'แจ้งปัญหา', 'ถนนชำรุด ไฟดับ ขยะ น้ำท่วม แจ้งได้ทันที', '#/report'],
      ['search', 'ติดตามสถานะ', 'ใส่เลขติดตามเพื่อดูความคืบหน้าเรื่องที่แจ้ง', '#/track']
    ];
    var html = '<section class="hero"><div class="hero-bg">' + (photo ? '<div class="hero-photo" style="background-image:url(\'' + esc(photo) + '\')"></div>' : '') +
      '<div class="aurora"></div>' + sky() +
      '<svg class="mtn mtn-1" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice"><path fill="rgba(23,165,143,.22)" d="M0 220 120 150 230 200 360 110 480 190 610 130 740 205 880 120 1010 195 1150 140 1290 205 1440 160V360H0Z"/></svg>' +
      '<svg class="mtn mtn-2" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice"><path fill="rgba(10,58,51,.88)" d="M0 270 140 200 260 250 400 170 540 255 690 190 830 262 980 185 1120 255 1270 200 1440 250V360H0Z"/></svg>' +
      '<svg class="mtn mtn-3" viewBox="0 0 1440 360" preserveAspectRatio="xMidYMax slice"><path fill="#052520" d="M0 322C200 292 320 332 520 306 760 274 900 332 1120 302 1280 282 1380 312 1440 298V360H0Z"/></svg></div>' +
      '<div class="container hero-grid"><div><span class="eyebrow fade-up">' + esc(set('heroEyebrow', 'เว็บไซต์พัฒนาชุมชน')) + '</span><h1>' + title + '</h1>' +
      '<p class="hero-sub fade-up" style="--d:.5s">' + esc(set('heroSubtitle')) + '</p>' +
      '<div class="hero-cta fade-up" style="--d:.65s"><a class="btn btn-primary" href="#/report">แจ้งปัญหาในชุมชน ' + icon('arrow-right') + '</a><a class="btn btn-ghost" href="#/projects">ดูโครงการพัฒนา</a></div>' +
      '<div class="chips fade-up" style="--d:.8s"><span>' + icon('shield') + 'โปร่งใส ตรวจสอบได้</span><span>' + icon('search') + 'ทุกเรื่องมีเลขติดตาม</span><span>' + icon('users') + 'ทุกคนมีส่วนร่วม</span></div></div>' +
      '<div class="fade-up" style="--d:.55s"><div class="glass hero-card" data-io><div class="hc-top"><span>สรุปภาพรวมโครงการ</span><span class="hc-pill">' + st.total + ' โครงการ</span></div>' +
      '<div class="hc-main"><svg class="ring" viewBox="0 0 120 120" style="--v:' + st.avg + '"><circle class="bg" cx="60" cy="60" r="50" pathLength="100"/><circle class="fg" cx="60" cy="60" r="50" pathLength="100"/></svg>' +
      '<div><div class="hc-big" data-count="' + st.avg + '" data-suffix="%">0%</div><div class="hc-cap">ความคืบหน้าเฉลี่ยของโครงการ</div></div></div>' +
      '<svg class="spark" viewBox="0 0 300 76" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ff0d4" stop-opacity=".4"/><stop offset="1" stop-color="#8ff0d4" stop-opacity="0"/></linearGradient></defs><path class="ar" d="' + sp.area + '"/><path class="ln" pathLength="1" d="' + sp.line + '"/></svg>' +
      '<div class="hc-cap">เรื่องแจ้งที่แก้ไขแล้ว (สะสม 6 เดือน)</div><div class="hc-tiles">' +
      '<div class="hc-tile">' + icon('layers') + '<div><b data-count="' + st.doing + '">0</b></div><small>กำลังดำเนินการ</small></div>' +
      '<div class="hc-tile">' + icon('check') + '<div><b data-count="' + st.doneR + '">0</b></div><small>เรื่องที่แก้แล้ว</small></div>' +
      '<div class="hc-tile">' + icon('megaphone') + '<div><b data-count="' + st.totalR + '">0</b></div><small>เรื่องแจ้งทั้งหมด</small></div></div></div></div></div><div class="scroll-hint"></div></section>' +

      '<section class="section"><div class="container"><div class="grid g4">' + svc.map(function (s, i) {
        return '<a class="svc reveal" style="--rd:' + i * 0.08 + 's" href="' + s[3] + '"><span class="svc-ic">' + icon(s[0]) + '</span><h3>' + s[1] + '</h3><p>' + s[2] + '</p><span class="go">เปิดดู ' + icon('arrow-right') + '</span></a>';
      }).join('') + '</div></div></section>' +

      '<section class="section"><div class="container"><div class="sec-head reveal"><div><span class="eyebrow">โครงการพัฒนา</span><h2>สิ่งที่เรากำลังทำเพื่อชุมชน</h2></div><a class="btn btn-outline btn-sm" href="#/projects">ดูทั้งหมด ' + icon('arrow-right') + '</a></div><div class="grid g3">' +
      (feat.length ? feat.map(function (p, i) { return projectCard(p, i * 0.1); }).join('') : empty('ยังไม่มีโครงการ')) + '</div></div></section>' +

      '<section class="section"><div class="container"><div class="sec-head reveal"><div><span class="eyebrow">ข่าวและกิจกรรม</span><h2>ข่าวสารล่าสุด</h2></div><a class="btn btn-outline btn-sm" href="#/news">ดูทั้งหมด ' + icon('arrow-right') + '</a></div><div class="grid g3">' +
      (S.news.length ? S.news.slice(0, 3).map(function (n, i) { return newsCard(n, i * 0.1); }).join('') : empty('ยังไม่มีข่าว')) + '</div></div></section>' +

      (S.gallery.length ? '<section class="section"><div class="container"><div class="sec-head reveal"><div><span class="eyebrow">แกลเลอรี่</span><h2>ภาพกิจกรรมล่าสุด</h2></div><a class="btn btn-outline btn-sm" href="#/gallery">ดูทั้งหมด ' + icon('arrow-right') + '</a></div><div class="gallery">' + galleryGrid(S.gallery.slice(0, 6)) + '</div></div></section>' : '') +
      '<section class="section"><div class="container"><div class="cta reveal"><div><h2>แจ้งปัญหาแล้ว อยากรู้ว่าไปถึงไหน?</h2><p>กรอกเลขติดตามที่ได้ตอนแจ้งเรื่อง เพื่อดูสถานะล่าสุดได้ทันที</p></div>' +
      '<form class="trk" id="homeTrk"><input id="homeCode" placeholder="เช่น RP-261106-AB12" aria-label="เลขติดตามเรื่อง" autocomplete="off"><button class="btn btn-primary" type="submit">ตรวจสอบ ' + icon('arrow-right') + '</button></form></div></div></section>' +

      '<section class="section"><div class="container about"><div class="about-text reveal"><span class="eyebrow" style="color:var(--teal)">เกี่ยวกับเรา</span><h2 style="font-size:clamp(1.7rem,3.6vw,2.5rem);line-height:1.3;margin-top:.3rem">' + esc(set('aboutTitle', 'เกี่ยวกับชุมชนของเรา')) + '</h2>' + paragraphs(set('aboutText')) + '</div>' +
      '<div class="stats">' + [['users', 'population', 'ประชากร (คน)'], ['home', 'households', 'ครัวเรือน'], ['sprout', 'groups', 'กลุ่ม/ชมรมในชุมชน'], ['layers', null, 'โครงการทั้งหมด']].map(function (x, i) {
        var v = x[1] ? Number(set(x[1], 0)) || 0 : S.projects.length;
        return '<div class="stat reveal" style="--rd:' + i * 0.08 + 's">' + icon(x[0]) + '<b data-count="' + v + '">0</b><span>' + x[2] + '</span></div>';
      }).join('') + '</div></div></section>';

    return {
      title: 'หน้าแรก', html: html, after: function () {
        bindGallery(S.gallery.slice(0, 6));
        $('#homeTrk').onsubmit = function (e) { e.preventDefault(); var c = $('#homeCode').value.trim(); if (c) location.hash = '#/track/' + encodeURIComponent(c.toUpperCase()); };
      }
    };
  }

  /* ---------- ข่าว ---------- */
  function newsView() {
    var cats = [['ทั้งหมด', 'ทั้งหมด']].concat(Array.from(new Set(S.news.map(function (n) { return n.category; }).filter(Boolean))).map(function (c) { return [c, c]; }));
    return {
      title: 'ข่าวและกิจกรรม',
      html: pageHero('ข่าวและกิจกรรม', 'ข่าวสารและกิจกรรมชุมชน', 'ติดตามประกาศ กิจกรรม และความเคลื่อนไหวล่าสุดของชุมชน') +
        '<section class="section"><div class="container"><div class="tools">' + chips(cats, 'nf') + searchBox('nq', 'ค้นหาข่าว...') + '</div><div class="grid g3" id="ng"></div></div></section>',
      after: function () {
        var cat = 'ทั้งหมด';
        function draw() {
          var q = $('#nq').value.trim().toLowerCase();
          var l = S.news.filter(function (n) { return (cat === 'ทั้งหมด' || n.category === cat) && (!q || (n.title + ' ' + n.summary + ' ' + n.category).toLowerCase().indexOf(q) >= 0); });
          $('#ng').innerHTML = l.length ? l.map(function (n, i) { return newsCard(n, i * 0.06); }).join('') : empty('ไม่พบข่าวที่ตรงกับเงื่อนไข');
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
        '<section class="section"><div class="container"><div class="tools">' + chips(f, 'pf') + searchBox('pq', 'ค้นหาโครงการ...') + '</div><div class="grid g3" id="pg"></div></div></section>',
      after: function () {
        var st = 'all';
        function draw() {
          var q = $('#pq').value.trim().toLowerCase();
          var l = S.projects.filter(function (p) { return (st === 'all' || p.status === st) && (!q || (p.title + ' ' + p.description + ' ' + p.location).toLowerCase().indexOf(q) >= 0); });
          $('#pg').innerHTML = l.length ? l.map(function (p, i) { return projectCard(p, i * 0.06); }).join('') : empty('ไม่พบโครงการที่ตรงกับเงื่อนไข');
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
        '<div class="pr-row"><span>ความคืบหน้า</span><b>' + p.progress + '%</b></div><div class="bar reveal" style="--p:' + p.progress + ';margin-bottom:1.4rem"><i></i></div>' + paragraphs(p.description) + '</div></div></div><div style="height:90px"></div>'
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

  function reportView() {
    return {
      title: 'แจ้งปัญหา',
      html: pageHero('แจ้งปัญหา / ข้อเสนอแนะ', 'แจ้งปัญหาในชุมชน', 'กรอกรายละเอียด แล้วรับเลขติดตามไว้เช็คสถานะได้ทุกเมื่อ') +
        '<div class="container"><div class="form-wrap"><div class="panel" id="rp"><form id="rf" novalidate><div class="fgrid">' +
        '<div class="field" id="g-cat"><label for="f-cat">ประเภทปัญหา <em>*</em></label><select id="f-cat"><option value="">เลือกประเภท</option>' + TH.REPORT_CATS.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="f-loc">สถานที่ / จุดสังเกต</label><input type="text" id="f-loc" maxlength="200" placeholder="เช่น หน้าซอย 3 ใกล้ศาลา"></div>' +
        '<div class="field full" id="g-detail"><label for="f-detail">รายละเอียด <em>*</em></label><textarea id="f-detail" maxlength="1500" placeholder="อธิบายปัญหาที่พบ เกิดขึ้นเมื่อไร ผลกระทบเป็นอย่างไร"></textarea><small>ยิ่งละเอียด เจ้าหน้าที่ยิ่งแก้ไขได้เร็ว (อย่างน้อย 10 ตัวอักษร)</small></div>' +
        '<div class="field"><label for="f-name">ชื่อผู้แจ้ง (ไม่บังคับ)</label><input type="text" id="f-name" maxlength="80"></div>' +
        '<div class="field"><label for="f-phone">เบอร์โทรติดต่อกลับ (ไม่บังคับ)</label><input type="tel" id="f-phone" inputmode="tel" maxlength="20"></div>' +
        '<div class="field full"><label>รูปภาพและตำแหน่ง (ไม่บังคับ)</label><div class="upload"><button type="button" class="btn btn-outline btn-sm" id="f-pick">' + icon('image') + ' เลือก/ถ่ายรูป</button>' +
        '<input type="file" id="f-file" accept="image/*" hidden><span id="f-prev"></span><button type="button" class="btn btn-outline btn-sm" id="f-geo">' + icon('pin') + ' ปักตำแหน่งปัจจุบัน</button><span id="f-geo-ok"></span></div></div>' +
        '<div class="hp" aria-hidden="true"><input type="text" id="f-hp" tabindex="-1" autocomplete="off"></div>' +
        '<div class="field full"><label class="consent"><input type="checkbox" id="f-consent"><span>ฉันยินยอมให้เก็บและใช้ข้อมูลที่กรอกเพื่อดำเนินการแก้ไขปัญหาของชุมชนเท่านั้น ชื่อและเบอร์โทรจะมองเห็นได้เฉพาะผู้ดูแลระบบ</span></label></div>' +
        '<div class="field full"><button class="btn btn-dark" type="submit" id="f-send">ส่งเรื่อง ' + icon('arrow-right') + '</button></div></div></form></div></div></div><div style="height:90px"></div>',
      after: reportAfter
    };
  }
  function reportAfter() {
    var t0 = Date.now(), img = '', lat = '', lng = '';
    $('#f-pick').onclick = function () { $('#f-file').click(); };
    $('#f-file').onchange = function () {
      var f = this.files[0]; if (!f) return;
      compressImage(f).then(function (d) {
        img = d;
        $('#f-prev').innerHTML = '<div class="upload-prev"><img src="' + d + '" alt="ตัวอย่างรูป"><button type="button" aria-label="ลบรูป">' + icon('x') + '</button></div>';
        $('#f-prev button').onclick = function () { img = ''; $('#f-prev').innerHTML = ''; $('#f-file').value = ''; };
      }).catch(function (e) { toast(e.message, 'err'); });
    };
    $('#f-geo').onclick = function () {
      if (!navigator.geolocation) return toast('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง', 'err');
      $('#f-geo-ok').textContent = 'กำลังค้นหาตำแหน่ง...';
      navigator.geolocation.getCurrentPosition(function (p) {
        lat = p.coords.latitude.toFixed(6); lng = p.coords.longitude.toFixed(6);
        $('#f-geo-ok').innerHTML = '<span class="loc-ok">' + icon('check') + ' ปักตำแหน่งแล้ว</span>';
      }, function () { $('#f-geo-ok').textContent = ''; toast('ไม่สามารถระบุตำแหน่งได้ (กรุณาอนุญาตการเข้าถึงตำแหน่ง)', 'err'); }, { timeout: 10000 });
    };
    $('#rf').onsubmit = function (e) {
      e.preventDefault();
      var cat = $('#f-cat').value, detail = $('#f-detail').value.trim(), ok = true;
      $('#g-cat').classList.toggle('bad', !cat); $('#g-detail').classList.toggle('bad', detail.length < 10);
      if (!cat || detail.length < 10) ok = false;
      if (!$('#f-consent').checked) { toast('กรุณาติ๊กยินยอมการเก็บข้อมูลก่อนส่ง', 'err'); ok = false; }
      if (!ok) return;
      if ($('#f-hp').value) return;
      if (Date.now() - t0 < 2500) return toast('กรุณาตรวจสอบข้อมูลอีกครั้ง แล้วกดส่ง', 'err');
      var btn = $('#f-send'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> กำลังส่ง...';
      API.submitReport({ category: cat, location: $('#f-loc').value.trim(), detail: detail, name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(), image: img, lat: lat, lng: lng, consent: true })
        .then(function (r) {
          saveCode(r.code);
          $('#rp').innerHTML = '<div class="done-card"><svg class="check-anim" viewBox="0 0 92 92"><circle cx="46" cy="46" r="42" pathLength="1"/><path d="M28 48l12 12 24-26" pathLength="1"/></svg>' +
            '<h2>ส่งเรื่องเรียบร้อยแล้ว</h2><p style="color:var(--muted)">กรุณาจดเลขติดตามนี้ไว้ เพื่อตรวจสอบสถานะภายหลัง</p>' +
            '<div class="code-box"><span id="cc">' + esc(r.code) + '</span><button type="button" id="ccp" aria-label="คัดลอก">' + icon('copy') + '</button></div>' +
            '<div class="hero-cta" style="justify-content:center"><a class="btn btn-dark" href="#/track/' + encodeURIComponent(r.code) + '">ดูสถานะเรื่องนี้ ' + icon('arrow-right') + '</a><a class="btn btn-outline" href="#/">กลับหน้าแรก</a></div></div>';
          $('#ccp').onclick = function () { copyText(r.code); };
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }).catch(function (er) { toast(er.message, 'err'); btn.disabled = false; btn.innerHTML = 'ส่งเรื่อง ' + icon('arrow-right'); });
    };
  }

  /* ---------- ติดตามสถานะ ---------- */
  function trackView(code) {
    var rec = myCodes();
    return {
      title: 'ติดตามสถานะ',
      html: pageHero('ติดตามสถานะ', 'ติดตามเรื่องที่แจ้ง', 'กรอกเลขติดตามที่ได้รับตอนแจ้งเรื่อง') +
        '<div class="container"><div class="form-wrap"><div class="panel"><form class="trk light" id="tf"><input id="tc" placeholder="เช่น RP-261106-AB12" value="' + esc(code) + '" autocomplete="off" aria-label="เลขติดตาม"><button class="btn btn-dark" type="submit">ตรวจสอบ ' + icon('search') + '</button></form>' +
        (rec.length ? '<p style="margin-top:1rem;color:var(--muted);font-size:.9rem">เรื่องที่คุณเคยแจ้งในเครื่องนี้</p><div class="recent">' + rec.map(function (c) { return '<a class="chip" href="#/track/' + encodeURIComponent(c) + '">' + esc(c) + '</a>'; }).join('') + '</div>' : '') +
        '</div><div id="tr"></div></div></div><div style="height:90px"></div>',
      after: function () {
        $('#tf').onsubmit = function (e) { e.preventDefault(); var c = $('#tc').value.trim().toUpperCase(); if (c) location.hash = '#/track/' + encodeURIComponent(c); };
        if (!code) return;
        $('#tr').innerHTML = '<div class="sk" style="height:220px;margin-top:1.2rem"></div>';
        API.trackReport(code).then(function (r) {
          if (!r) { $('#tr').innerHTML = '<div class="empty" style="margin-top:1.2rem">' + icon('search') + '<p>ไม่พบเลขติดตามนี้ กรุณาตรวจสอบตัวอักษรอีกครั้ง</p></div>'; return; }
          var idx = { 'new': 0, doing: 1, done: 2 }[r.status] || 0, st = TH.REPORT_STATUS[r.status] || TH.REPORT_STATUS['new'];
          var steps = [['inbox', 'รับเรื่องแล้ว'], ['clock', 'กำลังดำเนินการ'], ['check', 'แก้ไขเสร็จแล้ว']];
          $('#tr').innerHTML = '<div class="panel" style="margin-top:1.2rem"><div class="meta"><span class="tag">' + esc(r.category) + '</span><span>' + icon('calendar') + 'แจ้งเมื่อ ' + fmtDateTime(r.createdAt) + '</span></div>' +
            '<h3 style="margin:.5rem 0 0">เลขติดตาม <span class="code">' + esc(r.code) + '</span></h3><div class="steps">' + steps.map(function (s, i) {
              return '<div class="step' + (i <= idx ? ' on' : '') + '" style="--i:' + i + '"><div class="dot">' + icon(s[0]) + '</div>' + s[1] + '</div>';
            }).join('') + '</div><p>สถานะปัจจุบัน <span class="badge ' + st.cls + '">' + st.label + '</span> <span style="color:var(--muted);font-size:.88rem">อัปเดตล่าสุด ' + fmtDateTime(r.updatedAt) + '</span></p>' +
            (r.note ? '<div class="note"><small>ข้อความจากเจ้าหน้าที่</small>' + esc(r.note) + '</div>' : '') + '</div>';
        }).catch(function (e) { $('#tr').innerHTML = ''; toast(e.message, 'err'); });
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
    var box = document.createElement('div'), x0 = 0;
    box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
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
    }
    function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'ArrowRight') show(i + 1); }
    $('.lb-x', box).onclick = close; $('.lb-prev', box).onclick = function () { show(i - 1); }; $('.lb-next', box).onclick = function () { show(i + 1); };
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); });
    document.addEventListener('keydown', key); window.addEventListener('hashchange', close);
    show(i); requestAnimationFrame(function () { box.classList.add('in'); });
  }
  function galleryView() {
    return {
      title: 'แกลเลอรี่',
      html: pageHero('แกลเลอรี่', 'ภาพกิจกรรมของชุมชน', 'รวมภาพบรรยากาศกิจกรรมและความประทับใจของคนในชุมชน') +
        '<section class="section"><div class="container">' + (S.gallery.length ? '<div class="gallery">' + galleryGrid(S.gallery) + '</div>' : '<div class="grid">' + empty('ยังไม่มีภาพกิจกรรม') + '</div>') + '</div></section><div style="height:90px"></div>',
      after: function () { bindGallery(S.gallery); }
    };
  }

  /* ---------- ติดต่อ ---------- */
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
  function moveInd() {
    var a = $('.nav-links a.active'), ind = $('.nav-ind');
    if (!a) { ind.style.width = '0'; return; }
    ind.style.left = (a.offsetLeft + 16) + 'px'; ind.style.width = (a.offsetWidth - 32) + 'px';
  }
  function setActive(p) {
    $$('.nav-links a, .mmenu a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-p') === p); });
    moveInd();
  }

  /* ---------- ระบบเปลี่ยนหน้า ---------- */
  var first = true;
  function route() {
    if (!S.ready) return;
    var h = location.hash.replace(/^#\/?/, '').split('/');
    var page = h[0] || 'home', arg = h[1] ? decodeURIComponent(h.slice(1).join('/')) : '';
    var b = { home: homeView, news: function () { return arg ? newsDetail(arg) : newsView(); }, projects: function () { return arg ? projectDetail(arg) : projectsView(); },
      gallery: galleryView, report: reportView, track: function () { return trackView(arg); }, contact: contactView }[page];
    document.body.classList.remove('menu-open');
    view.classList.add('leaving');
    sleep(first || prefersReduced ? 0 : 170).then(function () {
      var r;
      try { r = b ? b() : notFound(); } catch (e) {
        if (window.console) console.error(e);
        r = { title: 'เกิดข้อผิดพลาด', html: pageHero('ขออภัย', 'แสดงหน้านี้ไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง หรือกลับไปหน้าแรก') + '<div class="container section"><a class="btn btn-dark" href="#/">กลับหน้าแรก</a></div><div style="height:90px"></div>' };
      }
      first = false;
      document.title = (page === 'home' ? set('siteName', 'เว็บไซต์พัฒนาชุมชน') : r.title + ' | ' + set('siteName', 'ชุมชน'));
      view.innerHTML = r.html;
      view.classList.remove('leaving'); view.classList.remove('entering'); void view.offsetWidth; view.classList.add('entering');
      window.scrollTo(0, 0); setActive(page); $('#nav').classList.remove('hide');
      try { if (r.after) r.after(); } catch (e2) { if (window.console) console.error(e2); }
      observe();
    });
  }

  /* ---------- โครงหน้าเว็บ ---------- */
  function applySettings() {
    var name = set('siteName', 'ชุมชนของเรา');
    $('#brandName').textContent = name;
    var tel = set('phone'), line = safeUrl(set('lineUrl')), fb = safeUrl(set('facebookUrl'));
    $('#footer').innerHTML = '<div class="container"><div class="f-grid"><div><div class="brand"><span class="brand-mark">' + icon('sprout') + '</span><b style="max-width:none">' + esc(name) + '</b></div><p>' + esc(set('siteTagline')) + '</p>' +
      '<div class="social">' + (fb ? '<a href="' + esc(fb) + '" target="_blank" rel="noopener" aria-label="Facebook">' + icon('facebook') + '</a>' : '') + (line ? '<a href="' + esc(line) + '" target="_blank" rel="noopener" aria-label="LINE">' + icon('chat') + '</a>' : '') + '</div></div>' +
      '<div><h4>เมนู</h4><a href="#/news">ข่าวและกิจกรรม</a><a href="#/projects">โครงการพัฒนา</a><a href="#/gallery">แกลเลอรี่</a><a href="#/report">แจ้งปัญหา</a><a href="#/track">ติดตามสถานะ</a></div>' +
      '<div><h4>ติดต่อ</h4><p>' + esc(tel) + '</p><p>' + esc(set('email')) + '</p><p>' + esc(set('officeHours')) + '</p></div></div>' +
      '<div class="f-bottom"><span>© ' + (new Date().getFullYear() + 543) + ' ' + esc(name) + '</span><a href="admin.html">สำหรับผู้ดูแลระบบ</a></div></div>';
  }
  function initShell() {
    $('#brandMark').innerHTML = icon('sprout'); $('#ctaIc').innerHTML = icon('megaphone');
    var links = [['home', '#/', 'home', 'หน้าแรก'], ['news', '#/news', 'newspaper', 'ข่าวและกิจกรรม'], ['projects', '#/projects', 'layers', 'โครงการพัฒนา'], ['gallery', '#/gallery', 'image', 'แกลเลอรี่'], ['report', '#/report', 'megaphone', 'แจ้งปัญหา'], ['track', '#/track', 'search', 'ติดตามสถานะ'], ['contact', '#/contact', 'phone', 'ติดต่อ']];
    $('#mmenu').innerHTML = links.map(function (l, i) { return '<a href="' + l[1] + '" data-p="' + l[0] + '" style="--i:' + i + '">' + icon(l[2]) + l[3] + '</a>'; }).join('');
    $('#burger').onclick = function () {
      var o = document.body.classList.toggle('menu-open'); this.setAttribute('aria-expanded', o); $('#mmenu').setAttribute('aria-hidden', !o);
    };
    var last = 0, tick = false, nav = $('#nav'), bar = $('#progress');
    window.addEventListener('scroll', function () {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        var y = window.scrollY, hero = $('.hero'), max = document.documentElement.scrollHeight - innerHeight;
        nav.classList.toggle('scrolled', y > 40);
        if (y < 400 || y < last - 4) nav.classList.remove('hide'); else if (y > last + 4 && !document.body.classList.contains('menu-open')) nav.classList.add('hide');
        if (hero && y < innerHeight * 1.3) hero.style.setProperty('--sy', y);
        bar.style.width = (max > 0 ? y / max * 100 : 0) + '%'; last = y; tick = false;
      });
    }, { passive: true });
    window.addEventListener('resize', moveInd);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInd);
    window.addEventListener('hashchange', route);
  }
  function loading(msg, err) {
    view.innerHTML = pageHero(err ? 'เกิดข้อผิดพลาด' : 'กำลังโหลด', err ? 'โหลดข้อมูลไม่สำเร็จ' : 'กรุณารอสักครู่...', err ? msg : '') +
      '<div class="container section">' + (err ? '<button class="btn btn-dark" id="retry">ลองอีกครั้ง</button>' : '<div class="grid g3"><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div><div class="sk" style="height:300px"></div></div>') + '</div>';
    if (err) $('#retry').onclick = boot;
  }
  function apply(d) {
    S.settings = d.settings || {}; S.news = d.news || []; S.gallery = d.gallery || []; S.reportStats = d.reportStats || [];
    S.projects = (d.projects || []).map(function (p) { return Object.assign({}, p, { progress: Math.max(0, Math.min(100, Number(p.progress) || 0)), budget: Number(p.budget) || 0 }); });
  }
  var KEY = 'cw_pub_cache_v1', lastRaw = '';
  function safeToRerender() {
    var a = document.activeElement, t = a && a.tagName;
    return !(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') && !/^#\/report/.test(location.hash) && !document.querySelector('.lightbox, .lb');
  }
  function refresh(first) {
    return API.getPublic().then(function (d) {
      var now = JSON.stringify(d);
      try { localStorage.setItem(KEY, now); } catch (e) { /* ข้าม */ }
      if (now === lastRaw) return;
      lastRaw = now; apply(d); S.ready = true; applySettings();
      if (first || safeToRerender()) route(); // ถ้าผู้ใช้กำลังพิมพ์/กรอกฟอร์ม จะไม่รีเฟรชหน้า (ข้อมูลใหม่จะแสดงตอนเปลี่ยนหน้าถัดไป)
    });
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
