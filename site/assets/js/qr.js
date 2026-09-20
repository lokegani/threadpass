/* ThreadPass — QR encoder
 * ---------------------------------------------------------------------------
 * A minimal but standards-correct QR Code generator: byte mode, error
 * correction level M, versions 1 to 10. That covers a verification URL
 * comfortably, which is the only thing this app encodes.
 *
 * Written by hand because there is no package manager on this machine. The
 * output is verified by decoding it with an independent decoder rather than by
 * looking at it — a QR code that is subtly wrong still looks exactly like a QR
 * code, so "it looks fine" is not evidence of anything.
 *
 * Reference: ISO/IEC 18004. The structure follows the well-known reference
 * implementations: Reed-Solomon over GF(256), BCH for the format and version
 * information, zigzag data placement, and all eight masks scored by the four
 * standard penalty rules.
 */
(function () {
  "use strict";

  var TP = (window.TP = window.TP || {});

  /* ---------------------------------------------------------------------
   * GF(256) arithmetic, primitive polynomial 0x11D
   * ------------------------------------------------------------------ */

  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* Generator polynomial for `degree` error-correction codewords:
     (x - a^0)(x - a^1)...(x - a^(degree-1)) */
  function rsGenerator(degree) {
    var poly = [1];
    for (var d = 0; d < degree; d++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var i = 0; i < poly.length; i++) {
        next[i] ^= poly[i];
        next[i + 1] ^= gfMul(poly[i], EXP[d]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLength) {
    var gen = rsGenerator(ecLength);
    var rem = new Array(ecLength).fill(0);

    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ rem[0];
      rem.shift();
      rem.push(0);
      for (var j = 0; j < ecLength; j++) rem[j] ^= gfMul(gen[j + 1], factor);
    }
    return rem;
  }

  /* ---------------------------------------------------------------------
   * Version tables — error correction level M only
   * ------------------------------------------------------------------ */

  /* [ blockCount, totalCodewords, dataCodewords ] per block group */
  var BLOCKS_M = {
    1:  [[1, 26, 16]],
    2:  [[1, 44, 28]],
    3:  [[1, 70, 44]],
    4:  [[2, 50, 32]],
    5:  [[2, 67, 43]],
    6:  [[4, 43, 27]],
    7:  [[4, 49, 31]],
    8:  [[2, 60, 38], [2, 61, 39]],
    9:  [[3, 58, 36], [2, 59, 37]],
    10: [[4, 69, 43], [1, 70, 44]]
  };

  var ALIGNMENT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function dataCapacity(version) {
    return BLOCKS_M[version].reduce(function (sum, group) {
      return sum + group[0] * group[2];
    }, 0);
  }

  /* ---------------------------------------------------------------------
   * BCH codes for format and version information
   * ------------------------------------------------------------------ */

  function formatInfo(maskPattern) {
    var data = (0x00 << 3) | maskPattern;   /* 00 = level M */
    var rem = data;
    for (var i = 0; i < 10; i++) {
      rem = (rem << 1) ^ (((rem >>> 9) & 1) ? 0x537 : 0);
    }
    return (((data << 10) | (rem & 0x3ff)) ^ 0x5412) & 0x7fff;
  }

  function versionInfo(version) {
    var rem = version;
    for (var i = 0; i < 12; i++) {
      rem = (rem << 1) ^ (((rem >>> 11) & 1) ? 0x1f25 : 0);
    }
    return ((version << 12) | (rem & 0xfff)) & 0x3ffff;
  }

  /* ---------------------------------------------------------------------
   * Masks
   * ------------------------------------------------------------------ */

  function maskAt(pattern, row, col) {
    switch (pattern) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return ((row * col) % 2) + ((row * col) % 3) === 0;
      case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
      case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    }
    return false;
  }

  /* The four standard penalty rules. Lower is better; the encoder tries every
     mask and keeps the least-penalised one, which is what stops a code from
     containing large blank areas or false finder patterns. */
  function penalty(modules, size) {
    var score = 0, i, j, run, dark;

    /* Rule 1: runs of five or more same-coloured modules in a line. */
    for (i = 0; i < size; i++) {
      run = 1;
      for (j = 1; j < size; j++) {
        if (modules[i][j] === modules[i][j - 1]) { run++; }
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);

      run = 1;
      for (j = 1; j < size; j++) {
        if (modules[j][i] === modules[j - 1][i]) { run++; }
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }

    /* Rule 2: 2x2 blocks of one colour. */
    for (i = 0; i < size - 1; i++) {
      for (j = 0; j < size - 1; j++) {
        var v = modules[i][j];
        if (v === modules[i][j + 1] && v === modules[i + 1][j] && v === modules[i + 1][j + 1]) {
          score += 3;
        }
      }
    }

    /* Rule 3: the 1:1:3:1:1 finder-like pattern with four light modules
       either side, which a scanner could mistake for a real finder. */
    var pattern = [true, false, true, true, true, false, true];
    function matchesAt(getter, start) {
      for (var k = 0; k < 7; k++) if (getter(start + k) !== pattern[k]) return false;
      return true;
    }
    function lightRun(getter, start, count, limit) {
      for (var k = 0; k < count; k++) {
        var idx = start + k;
        if (idx < 0 || idx >= limit) continue;   /* the quiet zone counts as light */
        if (getter(idx) !== false) return false;
      }
      return true;
    }
    for (i = 0; i < size; i++) {
      for (j = 0; j <= size - 7; j++) {
        /* horizontal */
        (function (rowIndex, colIndex) {
          var get = function (c) { return modules[rowIndex][c]; };
          if (matchesAt(get, colIndex) &&
              (lightRun(get, colIndex - 4, 4, size) || lightRun(get, colIndex + 7, 4, size))) {
            score += 40;
          }
          var getCol = function (r) { return modules[r][rowIndex]; };
          if (matchesAt(getCol, colIndex) &&
              (lightRun(getCol, colIndex - 4, 4, size) || lightRun(getCol, colIndex + 7, 4, size))) {
            score += 40;
          }
        })(i, j);
      }
    }

    /* Rule 4: deviation from a 50/50 balance of dark and light. */
    dark = 0;
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (modules[i][j]) dark++;
    var percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;

    return score;
  }

  /* ---------------------------------------------------------------------
   * Symbol construction
   * ------------------------------------------------------------------ */

  function blank(size) {
    var m = new Array(size);
    for (var i = 0; i < size; i++) m[i] = new Array(size).fill(null);
    return m;
  }

  function placeFinder(modules, size, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                 (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                 (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        modules[rr][cc] = on;
      }
    }
  }

  function buildFunctionPatterns(modules, size, version) {
    placeFinder(modules, size, 0, 0);
    placeFinder(modules, size, 0, size - 7);
    placeFinder(modules, size, size - 7, 0);

    /* Timing patterns */
    for (var i = 8; i < size - 8; i++) {
      var on = i % 2 === 0;
      if (modules[6][i] === null) modules[6][i] = on;
      if (modules[i][6] === null) modules[i][6] = on;
    }

    /* Alignment patterns, skipping the three finder corners */
    var centers = ALIGNMENT[version];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var row = centers[a], col = centers[b];
        if ((row === 6 && col === 6) ||
            (row === 6 && col === size - 7) ||
            (row === size - 7 && col === 6)) continue;
        for (var r = -2; r <= 2; r++) {
          for (var c = -2; c <= 2; c++) {
            modules[row + r][col + c] =
              Math.max(Math.abs(r), Math.abs(c)) !== 1;
          }
        }
      }
    }

    /* Reserve the format-information areas so data placement skips them. */
    for (var k = 0; k < 9; k++) {
      if (modules[8][k] === null) modules[8][k] = false;
      if (modules[k][8] === null) modules[k][8] = false;
    }
    for (var n = 0; n < 8; n++) {
      if (modules[8][size - 1 - n] === null) modules[8][size - 1 - n] = false;
      if (modules[size - 1 - n][8] === null) modules[size - 1 - n][8] = false;
    }
    modules[size - 8][8] = true;   /* the always-dark module */

    /* Version information, versions 7 and up */
    if (version >= 7) {
      var bits = versionInfo(version);
      for (var v = 0; v < 18; v++) {
        var bit = ((bits >>> v) & 1) === 1;
        modules[Math.floor(v / 3)][size - 11 + (v % 3)] = bit;
        modules[size - 11 + (v % 3)][Math.floor(v / 3)] = bit;
      }
    }
  }

  function applyFormatInfo(modules, size, maskPattern) {
    var bits = formatInfo(maskPattern);
    for (var i = 0; i < 15; i++) {
      var bit = ((bits >>> i) & 1) === 1;
      if (i < 6) modules[i][8] = bit;
      else if (i < 8) modules[i + 1][8] = bit;
      else modules[size - 15 + i][8] = bit;

      if (i < 8) modules[8][size - i - 1] = bit;
      else if (i < 9) modules[8][15 - i - 1 + 1] = bit;
      else modules[8][15 - i - 1] = bit;
    }
    modules[size - 8][8] = true;
  }

  function placeData(modules, size, bytes, maskPattern) {
    var bitIndex = 7, byteIndex = 0, inc = -1, row = size - 1;

    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;   /* the vertical timing column is never data */

      while (true) {
        for (var c = 0; c < 2; c++) {
          if (modules[row][col - c] === null) {
            var dark = false;
            if (byteIndex < bytes.length) {
              dark = ((bytes[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (maskAt(maskPattern, row, col - c)) dark = !dark;
            modules[row][col - c] = dark;

            bitIndex--;
            if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || row >= size) { row -= inc; inc = -inc; break; }
      }
    }
  }

  /* ---------------------------------------------------------------------
   * Encoding
   * ------------------------------------------------------------------ */

  function toUtf8Bytes(text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code < 0x80) out.push(code);
      else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return out;
  }

  function buildCodewords(bytes, version) {
    var countBits = version < 10 ? 8 : 16;
    var bits = [];

    function push(value, length) {
      for (var i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }

    push(0x4, 4);                 /* byte mode */
    push(bytes.length, countBits);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var capacityBits = dataCapacity(version) * 8;

    /* Terminator: up to four zero bits, but never past capacity. */
    var terminator = Math.min(4, capacityBits - bits.length);
    for (var t = 0; t < terminator; t++) bits.push(0);

    /* Pad to a whole byte, then alternate the two standard pad codewords. */
    while (bits.length % 8 !== 0) bits.push(0);

    var codewords = [];
    for (var b = 0; b < bits.length; b += 8) {
      var value = 0;
      for (var k = 0; k < 8; k++) value = (value << 1) | bits[b + k];
      codewords.push(value);
    }

    var pads = [0xec, 0x11], p = 0;
    while (codewords.length < dataCapacity(version)) {
      codewords.push(pads[p++ % 2]);
    }
    return codewords;
  }

  function interleave(codewords, version) {
    var groups = BLOCKS_M[version];
    var blocks = [], offset = 0;

    groups.forEach(function (group) {
      var count = group[0], total = group[1], dataLen = group[2];
      for (var i = 0; i < count; i++) {
        var slice = codewords.slice(offset, offset + dataLen);
        offset += dataLen;
        blocks.push({ data: slice, ec: rsEncode(slice, total - dataLen) });
      }
    });

    var maxData = Math.max.apply(null, blocks.map(function (b) { return b.data.length; }));
    var maxEc = Math.max.apply(null, blocks.map(function (b) { return b.ec.length; }));
    var out = [];

    for (var d = 0; d < maxData; d++) {
      blocks.forEach(function (b) { if (d < b.data.length) out.push(b.data[d]); });
    }
    for (var e = 0; e < maxEc; e++) {
      blocks.forEach(function (b) { if (e < b.ec.length) out.push(b.ec[e]); });
    }
    return out;
  }

  /* ---------------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------------ */

  TP.qrEncode = function (text) {
    var bytes = toUtf8Bytes(text);
    var version = 0;

    for (var v = 1; v <= 10; v++) {
      var countBits = v < 10 ? 8 : 16;
      var needed = Math.ceil((4 + countBits + bytes.length * 8) / 8);
      if (needed <= dataCapacity(v)) { version = v; break; }
    }
    if (!version) throw new Error("Text too long for this QR encoder (max version 10).");

    var size = 17 + 4 * version;
    var payload = interleave(buildCodewords(bytes, version), version);

    var best = null, bestScore = Infinity;

    for (var mask = 0; mask < 8; mask++) {
      var modules = blank(size);
      buildFunctionPatterns(modules, size, version);

      /* Function patterns must not be overwritten, so mark what is free by
         clearing only the cells data placement is allowed to touch. */
      var free = blank(size);
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) free[r][c] = modules[r][c];
      }

      placeData(free, size, payload, mask);
      applyFormatInfo(free, size, mask);

      var score = penalty(free, size);
      if (score < bestScore) { bestScore = score; best = free; }
    }

    return { size: size, version: version, modules: best };
  };

  /* Render as SVG. A single <path> of small squares keeps the markup compact
     and prints crisply at any size, unlike a canvas bitmap. */
  TP.qrSvg = function (text, options) {
    var opts = options || {};
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var code = TP.qrEncode(text);
    var total = code.size + quiet * 2;

    var parts = [];
    for (var r = 0; r < code.size; r++) {
      for (var c = 0; c < code.size; c++) {
        if (code.modules[r][c]) {
          parts.push("M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z");
        }
      }
    }

    return '<svg viewBox="0 0 ' + total + " " + total + '" ' +
      'width="' + (opts.width || 120) + '" height="' + (opts.width || 120) + '" ' +
      'shape-rendering="crispEdges" role="img" ' +
      'aria-label="' + TP.esc(opts.label || "QR code") + '">' +
      '<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>' +
      '<path d="' + parts.join("") + '" fill="#000000"/></svg>';
  };
})();
