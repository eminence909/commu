/* แผนที่โครงการ 3 มิติ
 * - โหลดเมื่อผู้ใช้เลื่อนมาใกล้ส่วนนี้เท่านั้น (ไม่หน่วงหน้าแรก)
 * - แสดงเฉพาะโครงการที่ผู้ดูแลกรอกพิกัดไว้จริง ตำแหน่งและระยะห่างคำนวณจากพิกัดนั้น ไม่มีจุดสมมติ
 * - ความสูงของแท่ง = ความคืบหน้า (%) ของโครงการ
 * - วาดแผนผัง SVG จากข้อมูลชุดเดียวกันทันที แล้วค่อยอัปเกรดเป็น 3 มิติเมื่อ Three.js โหลดสำเร็จ
 *   ถ้าโหลดไม่ได้ / ไม่รองรับ WebGL / ผู้ใช้เปิดโหมดประหยัดข้อมูล จะคงแผนผัง SVG ไว้ */
(function () {
  'use strict';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var COL = { plan: 0xA8B6A7, doing: 0xB89A63, done: 0xF7F6F0 };
  var HEX = { plan: '#A8B6A7', doing: '#B89A63', done: '#F7F6F0' };
  var SPAN = 8, HMAX = 3, MIN_EXTENT_M = 200;

  function validGeo(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  }
  /* แปลงพิกัดจริงเป็นระยะบนพื้นราบ (เมตร) รอบจุดกึ่งกลางของกลุ่มโครงการ แล้วย่อให้พอดีกว้าง SPAN หน่วย */
  function layout(items) {
    var pts = items.filter(function (p) { return validGeo(p.lat, p.lng); });
    if (!pts.length) return { items: [], extentM: 0 };
    var la = pts.map(function (p) { return p.lat; }), lo = pts.map(function (p) { return p.lng; });
    var cLat = (Math.min.apply(null, la) + Math.max.apply(null, la)) / 2, cLng = (Math.min.apply(null, lo) + Math.max.apply(null, lo)) / 2;
    var kx = Math.cos(cLat * Math.PI / 180) * 111320, kz = 110540;
    var xs = pts.map(function (p) { return (p.lng - cLng) * kx; }), zs = pts.map(function (p) { return -(p.lat - cLat) * kz; });
    var ext = Math.max(MIN_EXTENT_M, Math.max.apply(null, xs) - Math.min.apply(null, xs), Math.max.apply(null, zs) - Math.min.apply(null, zs));
    var k = SPAN / ext;
    return {
      extentM: ext,
      items: pts.map(function (p, i) { return { id: p.id, title: p.title, status: p.status, progress: p.progress, x: xs[i] * k, z: zs[i] * k }; })
    };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function svgHtml(L) {
    var g = '';
    for (var i = 10; i <= 90; i += 10) g += '<path d="M' + i + ' 6V94M6 ' + i + 'H94"/>';
    return '<svg class="m3-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" focusable="false"><g class="gr">' + g + '</g>' +
      L.items.map(function (p) {
        var cx = (50 + p.x * 10.5).toFixed(2), cy = (50 + p.z * 10.5).toFixed(2), r = (2.2 + (p.progress || 0) / 100 * 2.8).toFixed(2);
        return '<g class="m3-pt" data-id="' + esc(p.id) + '"><circle class="halo" cx="' + cx + '" cy="' + cy + '" r="' + (Number(r) + 2) + '"/><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (HEX[p.status] || HEX.plan) + '"/></g>';
      }).join('') + '</svg>';
  }

  var threeP = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threeP) return threeP;
    threeP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = THREE_URL; s.async = true;
      s.onload = function () { window.THREE ? res(window.THREE) : rej(new Error('three')); };
      s.onerror = function () { threeP = null; rej(new Error('three')); };
      document.head.appendChild(s);
    });
    return threeP;
  }

  function build3d(T, stage, L, o) {
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var canvas = renderer.domElement;
    canvas.className = 'm3-canvas'; canvas.style.touchAction = 'pan-y'; canvas.setAttribute('aria-hidden', 'true');
    var scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
    var geos = [], mats = [], bars = {}, rings = {}, hits = [];
    function G(g) { geos.push(g); return g; }
    function M(m) { mats.push(m); return m; }

    scene.add(new T.AmbientLight(0xffffff, 0.75));
    var sun = new T.DirectionalLight(0xffffff, 0.7); sun.position.set(4, 8, 5); scene.add(sun);
    var plate = new T.Mesh(G(new T.CylinderGeometry(5.6, 5.6, 0.12, 64)), M(new T.MeshLambertMaterial({ color: 0x1A4A3E })));
    plate.position.y = -0.06; scene.add(plate);
    var grid = new T.GridHelper(10, 10, 0x3D6B5C, 0x2A5648); grid.position.y = 0.01; scene.add(grid);
    geos.push(grid.geometry); mats.push(grid.material);

    L.items.forEach(function (p) {
      var c = COL[p.status] || COL.plan, h = Math.max(0.08, HMAX * (p.progress || 0) / 100);
      var bar = new T.Mesh(G(new T.CylinderGeometry(0.2, 0.2, h, 20)), M(new T.MeshLambertMaterial({ color: c })));
      bar.position.set(p.x, h / 2, p.z); scene.add(bar); bars[p.id] = bar;
      var ghost = new T.LineSegments(G(new T.EdgesGeometry(new T.CylinderGeometry(0.2, 0.2, HMAX, 12))), M(new T.LineBasicMaterial({ color: 0xF7F6F0, transparent: true, opacity: 0.3 })));
      ghost.position.set(p.x, HMAX / 2, p.z); scene.add(ghost);
      var ring = new T.Mesh(G(new T.RingGeometry(0.32, 0.4, 32)), M(new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })));
      ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.02, p.z); scene.add(ring); rings[p.id] = ring;
      var hit = new T.Mesh(G(new T.CylinderGeometry(0.55, 0.55, HMAX + 0.4, 8)), M(new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
      hit.position.set(p.x, (HMAX + 0.4) / 2, p.z); hit.userData.id = p.id; scene.add(hit); hits.push(hit);
    });

    var az = 0.6, pol = 1.0, spin = !o.reduced, dragging = false, visible = true, raf = 0, last = 0, dirty = true, dead = false, sel = '';
    function radius() { var a = camera.aspect || 1.5; return Math.max(13, 11 / (a * 2 * Math.tan(19 * Math.PI / 180))); }
    function place() {
      var R = radius();
      camera.position.set(R * Math.sin(pol) * Math.sin(az), R * Math.cos(pol), R * Math.sin(pol) * Math.cos(az));
      camera.lookAt(0, 0.8, 0);
    }
    function resize() {
      var w = stage.clientWidth || 1, h = stage.clientHeight || 1;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
    }
    function running() { return spin && visible && !document.hidden && !dead; }
    function schedule() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
    function frame(t) {
      raf = 0; if (dead) return;
      var dt = Math.min(0.1, ((t - last) / 1000) || 0); last = t;
      if (running() && !dragging) { az += dt * 0.12; dirty = true; }
      if (dirty && visible) { place(); renderer.render(scene, camera); dirty = false; }
      if (running()) schedule();
    }
    function request() { dirty = true; schedule(); }

    var sx = 0, moved = 0;
    function down(e) { dragging = true; sx = e.clientX; moved = 0; try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ข้าม */ } }
    function move(e) { if (!dragging) return; var dx = e.clientX - sx; sx = e.clientX; moved += Math.abs(dx); az -= dx * 0.008; request(); }
    function up(e) { if (!dragging) return; dragging = false; if (moved < 5) pick(e); request(); }
    function cancel() { dragging = false; request(); }
    var ray = new T.Raycaster(), v2 = new T.Vector2();
    function pick(e) {
      var r = canvas.getBoundingClientRect();
      v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v2, camera);
      var hit = ray.intersectObjects(hits, false)[0];
      if (hit) o.onPick(hit.object.userData.id);
    }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
    function lost(e) { e.preventDefault(); o.onLost(); }
    canvas.addEventListener('webglcontextlost', lost);
    function vis() { if (!document.hidden) request(); }
    document.addEventListener('visibilitychange', vis);
    var ro = null, io = null, onWin = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { resize(); request(); }); ro.observe(stage); }
    else { onWin = function () { resize(); request(); }; window.addEventListener('resize', onWin); }
    if (window.IntersectionObserver) { io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) request(); }); io.observe(stage); }

    return {
      canvas: canvas,
      start: function () { resize(); request(); },
      select: function (id) {
        sel = id;
        Object.keys(bars).forEach(function (k) {
          var on = k === id;
          bars[k].scale.set(on ? 1.6 : 1, 1, on ? 1.6 : 1); bars[k].material.emissive.setHex(on ? 0x444444 : 0x000000);
          rings[k].scale.set(on ? 1.5 : 1, 1, on ? 1.5 : 1);
        });
        request();
      },
      setSpin: function (v) { spin = !!v; if (spin) request(); },
      isSpinning: function () { return spin; },
      destroy: function () {
        dead = true; if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); if (io) io.disconnect(); if (onWin) window.removeEventListener('resize', onWin);
        document.removeEventListener('visibilitychange', vis);
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('webglcontextlost', lost);
        geos.forEach(function (g) { g.dispose(); }); mats.forEach(function (m) { m.dispose(); });
        renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  /* stage: กล่องที่จะวาดแผนที่ / items: โครงการ [{id,title,status,progress,lat,lng}] (ค่า lat/lng เป็นตัวเลข)
   * opts: { reduced, onPick(id), onMode(handle) } */
  function mount(stage, items, opts) {
    opts = opts || {};
    var L = layout(items), three = null, dead = false, selId = '', pickCb = opts.onPick || function () {};
    var handle = { extentM: L.extentM, mode: 'svg', canSpin: false };
    function showSvg() {
      stage.classList.add('is-svg'); stage.innerHTML = svgHtml(L); handle.mode = 'svg'; handle.canSpin = false; svgSel();
    }
    function svgSel() {
      Array.prototype.forEach.call(stage.querySelectorAll('.m3-pt'), function (g) { g.classList.toggle('on', g.getAttribute('data-id') === selId); });
    }
    function onClick(e) {
      var g = e.target.closest && e.target.closest('.m3-pt');
      if (g && stage.classList.contains('is-svg')) pickCb(g.getAttribute('data-id'));
    }
    stage.addEventListener('click', onClick);
    showSvg();

    handle.select = function (id) { selId = id; svgSel(); if (three) three.select(id); };
    handle.setSpin = function (v) { if (three) three.setSpin(v); };
    handle.isSpinning = function () { return !!(three && three.isSpinning()); };
    handle.destroy = function () {
      dead = true; stage.removeEventListener('click', onClick);
      if (three) { try { three.destroy(); } catch (e) { /* ข้าม */ } three = null; }
      stage.innerHTML = '';
    };

    var saveData = navigator.connection && navigator.connection.saveData;
    if (!L.items.length || saveData) return handle;
    loadThree().then(function (T) {
      if (dead) return;
      var t = build3d(T, stage, L, {
        reduced: !!opts.reduced, onPick: pickCb,
        onLost: function () { if (three) { try { three.destroy(); } catch (e) { /* ข้าม */ } three = null; } if (!dead) { showSvg(); if (opts.onMode) opts.onMode(handle); } }
      });
      stage.classList.remove('is-svg'); stage.innerHTML = ''; stage.appendChild(t.canvas);
      three = t; handle.mode = 'webgl'; handle.canSpin = !opts.reduced;
      t.start(); if (selId) t.select(selId);
      if (opts.onMode) opts.onMode(handle);
    }).catch(function () { /* โหลด/สร้างฉากไม่สำเร็จ: คงแผนผัง SVG ไว้ */ });
    return handle;
  }

  window.Map3D = { mount: mount, layout: layout, validGeo: validGeo };
})();
