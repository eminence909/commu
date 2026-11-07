/* ตัวสร้างคิวอาร์โค้ด (เขียนเองในโปรเจกต์ ไม่พึ่งไลบรารีภายนอก ใช้ได้แม้ไม่มีอินเทอร์เน็ต)
 * รองรับข้อความ UTF-8 ได้ประมาณ 213 ไบต์ (เวอร์ชัน 1-10) ระดับแก้ไขข้อผิดพลาด M (~15%)
 * ใช้งาน: var q = QR.make('https://...'); QR.toCanvas(q, 1024); QR.toSvg(q); */
(function () {
  'use strict';
  var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]; // ไบต์แก้ไขต่อบล็อก (ระดับ M) เวอร์ชัน 1-10
  var BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];           // จำนวนบล็อก
  var MAXV = 10;

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCap(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }
  function utf8(s) {
    if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(s));
    var b = unescape(encodeURIComponent(s)), o = [], i;
    for (i = 0; i < b.length; i++) o.push(b.charCodeAt(i));
    return o;
  }

  /* ---------- เข้ารหัสข้อมูล ---------- */
  function encode(text) {
    var bytes = utf8(text), v, cc;
    for (v = 1; v <= MAXV; v++) { cc = v < 10 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCap(v) * 8) break; }
    if (v > MAXV) throw new Error('too long');
    var bb = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, cc);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCap(v) * 8;
    put(0, Math.min(4, cap - bb.length));
    put(0, (8 - bb.length % 8) % 8);
    for (var pad = 0xEC; bb.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [], i, j, x;
    for (i = 0; i < bb.length; i += 8) { x = 0; for (j = 0; j < 8; j++) x = (x << 1) | bb[i + j]; data.push(x); }
    return { v: v, data: data };
  }

  /* ---------- Reed-Solomon (GF 256) ---------- */
  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; }
  function rsDivisor(deg) {
    var r = [], i, j, root = 1;
    for (i = 0; i < deg; i++) r.push(0);
    r[deg - 1] = 1;
    for (i = 0; i < deg; i++) {
      for (j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = gmul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= gmul(c, f); });
    });
    return r;
  }
  function interleave(data, v) {
    var nb = BLK[v], eccLen = ECC[v], raw = Math.floor(rawModules(v) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), blocks = [], div = rsDivisor(eccLen), k = 0, i;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var out = [];
    for (i = 0; i < blocks[0].length; i++) {
      blocks.forEach(function (b, j) { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
    }
    return out;
  }

  /* ---------- วาดเมทริกซ์ ---------- */
  function bit(x, i) { return ((x >>> i) & 1) !== 0; }
  function build(v, codewords) {
    var n = v * 4 + 17, mod = [], fn = [], i, j;
    for (i = 0; i < n; i++) { mod.push([]); fn.push([]); for (j = 0; j < n; j++) { mod[i].push(false); fn[i].push(false); } }
    function setFn(x, y, d) { mod[y][x] = d; fn[y][x] = true; }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < n && yy >= 0 && yy < n) setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    }
    function align(cx, cy) {
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function formatBits(mask) {
      var d = (0 << 3) | mask, rem = d, k; // ระดับ M = 0
      for (k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((d << 10) | rem) ^ 0x5412;
      for (k = 0; k <= 5; k++) setFn(8, k, bit(bits, k));
      setFn(8, 7, bit(bits, 6)); setFn(8, 8, bit(bits, 7)); setFn(7, 8, bit(bits, 8));
      for (k = 9; k < 15; k++) setFn(14 - k, 8, bit(bits, k));
      for (k = 0; k < 8; k++) setFn(n - 1 - k, 8, bit(bits, k));
      for (k = 8; k < 15; k++) setFn(8, n - 15 + k, bit(bits, k));
      setFn(8, n - 8, true);
    }
    // ลายตำแหน่งคงที่
    for (i = 0; i < n; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    var na = v === 1 ? 0 : Math.floor(v / 7) + 2, pos = [];
    if (na) {
      var step = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2;
      pos = [6];
      for (var p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
    }
    for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      align(pos[i], pos[j]);
    }
    formatBits(0);
    if (v >= 7) {
      var rem = v, k2;
      for (k2 = 0; k2 < 12; k2++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (v << 12) | rem;
      for (k2 = 0; k2 < 18; k2++) { var a = n - 11 + k2 % 3, b = Math.floor(k2 / 3); setFn(a, b, bit(vb, k2)); setFn(b, a, bit(vb, k2)); }
    }
    // วางข้อมูลแบบซิกแซก
    var idx = 0;
    for (var right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < n; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
        if (!fn[y][x] && idx < codewords.length * 8) { mod[y][x] = bit(codewords[idx >>> 3], 7 - (idx & 7)); idx++; }
      }
    }
    function mask(m) {
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var inv;
        switch (m) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = x * y % 2 + x * y % 3 === 0; break;
          case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
          default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
        }
        if (!fn[y][x] && inv) mod[y][x] = !mod[y][x];
      }
    }
    function penalty() {
      var r = 0, x, y, t, run, dark = 0;
      function g(tt, a, b) { return tt ? mod[b][a] : mod[a][b]; } // tt=0: แถว a คอลัมน์ b, tt=1: สลับ
      for (t = 0; t < 2; t++) for (y = 0; y < n; y++) {
        run = 1;
        for (x = 1; x < n; x++) {
          if (g(t, y, x) === g(t, y, x - 1)) { run++; if (run === 5) r += 3; else if (run > 5) r++; } else run = 1;
        }
        for (x = 0; x + 11 <= n; x++) {
          var w = '', q;
          for (q = 0; q < 11; q++) w += g(t, y, x + q) ? '1' : '0';
          if (w === '10111010000' || w === '00001011101') r += 40;
        }
      }
      for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) {
        var c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) r += 3;
      }
      for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (mod[y][x]) dark++;
      r += (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
      return r;
    }
    var best = 0, bestP = Infinity, m;
    for (m = 0; m < 8; m++) {
      mask(m); formatBits(m);
      var pp = penalty();
      if (pp < bestP) { bestP = pp; best = m; }
      mask(m);
    }
    mask(best); formatBits(best);
    return { size: n, version: v, modules: mod };
  }

  function make(text) {
    var e = encode(String(text));
    return build(e.v, interleave(e.data, e.v));
  }

  /* ---------- แสดงผล (เว้นขอบขาว 4 ช่องตามมาตรฐาน) ---------- */
  function toCanvas(q, px, fg, bg) {
    var n = q.size, m = Math.max(1, Math.floor((px || 512) / (n + 8))), c = document.createElement('canvas'), x, y;
    c.width = c.height = m * (n + 8);
    var ctx = c.getContext('2d');
    ctx.fillStyle = bg || '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = fg || '#06231f';
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (q.modules[y][x]) ctx.fillRect((x + 4) * m, (y + 4) * m, m, m);
    return c;
  }
  function toSvg(q, fg, bg) {
    var n = q.size, d = '', x, y;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (q.modules[y][x]) d += 'M' + (x + 4) + ',' + (y + 4) + 'h1v1h-1z';
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 8) + ' ' + (n + 8) + '" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="' + (bg || '#ffffff') + '"/><path d="' + d + '" fill="' + (fg || '#06231f') + '"/></svg>';
  }

  window.QR = { make: make, toCanvas: toCanvas, toSvg: toSvg };
})();
