/* ============================================
   qrcode.js — QR Code Model 2 encoder (byte mode)
   Exposes window.qrcode(text, opts) returning an SVG string.

   Scope (this implementation):
     - Byte mode (UTF-8) only.
     - Error correction levels L, M, Q, H (via opts.ecc).
     - Versions 1 .. 25.
     - Mask pattern chosen from the standard 8 by minimum penalty.

   Reference: ISO/IEC 18004:2015.
   ============================================ */

(function () {
  'use strict';

  // ---------- Galois Field GF(256) for Reed-Solomon ----------
  // Primitive polynomial: x^8 + x^4 + x^3 + x^2 + 1 = 0x11d
  var GF_EXP = new Uint8Array(512);
  var GF_LOG = new Uint8Array(256);

  (function initGF() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) GF_EXP[j] = GF_EXP[j - 255];
    GF_LOG[0] = 0; // unused, but keep defined
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
  }

  // Generate Reed-Solomon generator polynomial of degree `degree`.
  function rsGenerator(degree) {
    var coefs = [1];
    for (var i = 0; i < degree; i++) {
      // multiply by (x - alpha^i)
      var next = new Array(coefs.length + 1).fill(0);
      for (var j = 0; j < coefs.length; j++) {
        next[j] ^= coefs[j];
        next[j + 1] ^= gfMul(coefs[j], GF_EXP[i]);
      }
      coefs = next;
    }
    return coefs;
  }

  function rsEncode(data, eccLen) {
    var gen = rsGenerator(eccLen);
    // work buffer: data followed by eccLen zeros
    var buf = data.slice();
    for (var k = 0; k < eccLen; k++) buf.push(0);
    for (var i = 0; i < data.length; i++) {
      var coef = buf[i];
      if (coef !== 0) {
        for (var j = 0; j < gen.length; j++) {
          buf[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return buf.slice(data.length);
  }

  // ---------- Capacity tables ----------
  // For each version (1..40) and ECC level, total codewords, ECC codewords per block,
  // and the number of blocks in group 1 / group 2 (the latter only when two groups are used).
  // Source: ISO/IEC 18004 Annex, Tables 9–22.
  // Shape: [totalCodewords, ecPerBlock, g1Blocks, g1DataCodewords, g2Blocks, g2DataCodewords]
  // (g2 = 0 when only one group is used.)
  var ECC_TABLE = {
    // version: { 'L': [...], 'M': [...], 'Q': [...], 'H': [...] }
    1:  { L: [26,  7, 1, 19, 0, 0], M: [26, 10, 1, 16, 0, 0], Q: [26, 13, 1, 13, 0, 0], H: [26, 17, 1, 9,  0, 0] },
    2:  { L: [44, 10, 1, 34, 0, 0], M: [44, 16, 1, 28, 0, 0], Q: [44, 22, 1, 22, 0, 0], H: [44, 28, 1, 16, 0, 0] },
    3:  { L: [70, 15, 1, 55, 0, 0], M: [70, 26, 1, 44, 0, 0], Q: [70, 18, 2, 17, 0, 0], H: [70, 22, 2, 13, 0, 0] },
    4:  { L: [100, 20, 1, 80, 0, 0], M: [100, 18, 2, 32, 0, 0], Q: [100, 26, 2, 24, 0, 0], H: [100, 16, 4, 9,  0, 0] },
    5:  { L: [134, 26, 1, 108, 0, 0], M: [134, 24, 2, 43, 0, 0], Q: [134, 18, 2, 15, 2, 16], H: [134, 22, 2, 11, 2, 12] },
    6:  { L: [172, 18, 2, 68, 0, 0], M: [172, 16, 4, 27, 0, 0], Q: [172, 24, 4, 19, 0, 0], H: [172, 28, 4, 15, 0, 0] },
    7:  { L: [196, 20, 2, 78, 0, 0], M: [196, 18, 4, 31, 0, 0], Q: [196, 18, 2, 14, 4, 15], H: [196, 26, 4, 13, 1, 14] },
    8:  { L: [242, 24, 2, 97, 0, 0], M: [242, 22, 2, 38, 2, 39], Q: [242, 22, 4, 18, 2, 19], H: [242, 26, 4, 14, 2, 15] },
    9:  { L: [292, 30, 2, 116, 0, 0], M: [292, 22, 3, 36, 2, 37], Q: [292, 20, 4, 16, 4, 17], H: [292, 24, 4, 12, 4, 13] },
    10: { L: [346, 18, 2, 68, 2, 69], M: [346, 26, 4, 43, 1, 44], Q: [346, 24, 6, 19, 2, 20], H: [346, 28, 6, 15, 2, 16] },
    11: { L: [404, 20, 4, 81, 0, 0], M: [404, 30, 1, 50, 4, 51], Q: [404, 28, 4, 22, 4, 23], H: [404, 24, 3, 12, 8, 13] },
    12: { L: [466, 24, 2, 92, 2, 93], M: [466, 22, 6, 36, 2, 37], Q: [466, 26, 4, 20, 6, 21], H: [466, 28, 7, 14, 4, 15] },
    13: { L: [532, 26, 4, 107, 0, 0], M: [532, 22, 8, 37, 1, 38], Q: [532, 24, 8, 20, 4, 21], H: [532, 22, 12, 11, 4, 12] },
    14: { L: [581, 30, 3, 115, 1, 116], M: [581, 24, 4, 40, 5, 41], Q: [581, 20, 11, 16, 5, 17], H: [581, 30, 11, 12, 5, 13] },
    15: { L: [655, 22, 5, 87, 1, 88], M: [655, 24, 5, 41, 5, 42], Q: [655, 30, 5, 24, 7, 25], H: [655, 24, 11, 12, 7, 13] },
    16: { L: [733, 24, 5, 98, 1, 99], M: [733, 28, 7, 45, 3, 46], Q: [733, 24, 15, 19, 2, 20], H: [733, 30, 3, 15, 13, 16] },
    17: { L: [815, 28, 1, 107, 5, 108], M: [815, 28, 10, 46, 1, 47], Q: [815, 28, 1, 22, 15, 23], H: [815, 28, 2, 14, 17, 15] },
    18: { L: [901, 30, 5, 120, 1, 121], M: [901, 26, 9, 43, 4, 44], Q: [901, 28, 17, 22, 1, 23], H: [901, 28, 2, 14, 19, 15] },
    19: { L: [991, 28, 3, 113, 4, 114], M: [991, 26, 3, 44, 11, 45], Q: [991, 26, 17, 21, 4, 22], H: [991, 26, 9, 13, 16, 14] },
    20: { L: [1085, 28, 3, 107, 5, 108], M: [1085, 26, 3, 41, 13, 42], Q: [1085, 30, 15, 24, 5, 25], H: [1085, 28, 15, 15, 10, 16] },
    21: { L: [1156, 28, 4, 116, 4, 117], M: [1156, 26, 17, 42, 0, 0], Q: [1156, 28, 17, 22, 6, 23], H: [1156, 30, 19, 16, 6, 17] },
    22: { L: [1258, 28, 2, 111, 7, 112], M: [1258, 28, 17, 46, 0, 0], Q: [1258, 30, 7, 24, 16, 25], H: [1258, 24, 34, 13, 0, 0] },
    23: { L: [1364, 30, 4, 121, 5, 122], M: [1364, 28, 4, 47, 14, 48], Q: [1364, 30, 11, 24, 14, 25], H: [1364, 30, 16, 15, 14, 16] },
    24: { L: [1474, 30, 6, 117, 4, 118], M: [1474, 28, 6, 45, 14, 46], Q: [1474, 28, 11, 24, 16, 25], H: [1474, 30, 30, 16, 2, 17] },
    25: { L: [1588, 26, 8, 106, 4, 107], M: [1588, 28, 8, 47, 13, 48], Q: [1588, 30, 7, 24, 22, 25], H: [1588, 30, 22, 15, 13, 16] }
  };

  // ---------- Format and version info ----------
  // Format info: 5 bits data + 10 bits ECC, masked with 0x5412.
  // For ECC level: L=01, M=00, Q=11, H=10
  var ECC_BITS = { L: 0x01, M: 0x00, Q: 0x11, H: 0x10 };

  function bchFormat(data) {
    var d = data << 10;
    var g = 0x537; // generator
    for (var i = 14; i >= 10; i--) {
      if ((d >> i) & 1) d ^= g << (i - 10);
    }
    return ((data << 10) | d) ^ 0x5412;
  }

  function bchVersion(version) {
    var d = version << 12;
    var g = 0x1F25; // generator for 6-bit BCH
    for (var i = 17; i >= 12; i--) {
      if ((d >> i) & 1) d ^= g << (i - 12);
    }
    return (version << 12) | d;
  }

  // ---------- QR bit utilities ----------
  function versionSize(v) { return 17 + 4 * v; }

  function makeMatrix(size) {
    var m = new Array(size);
    var r = new Array(size);
    for (var i = 0; i < size; i++) {
      m[i] = new Uint8Array(size); // 0 = white, 1 = black
      r[i] = new Uint8Array(size); // reserved flag
    }
    return { m: m, r: r, size: size };
  }

  function placeFinder(matrix, row, col) {
    for (var dy = -1; dy <= 7; dy++) {
      for (var dx = -1; dx <= 7; dx++) {
        var y = row + dy, x = col + dx;
        if (y < 0 || y >= matrix.size || x < 0 || x >= matrix.size) continue;
        var onBorder = (dy === 0 || dy === 6) && dx >= 0 && dx <= 6;
        var onEdge = (dx === 0 || dx === 6) && dy >= 0 && dy <= 6;
        var inner = (dy >= 2 && dy <= 4) && (dx >= 2 && dx <= 4);
        var isBlack = onBorder || onEdge || inner;
        matrix.m[y][x] = isBlack ? 1 : 0;
        matrix.r[y][x] = 1;
      }
    }
  }

  function placeAlignment(matrix, cx, cy) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        var y = cy + dy, x = cx + dx;
        var isBorder = (Math.abs(dy) === 2) || (Math.abs(dx) === 2);
        var isCenter = (dy === 0 && dx === 0);
        matrix.m[y][x] = (isBorder || isCenter) ? 1 : 0;
        matrix.r[y][x] = 1;
      }
    }
  }

  // Alignment pattern center coordinates per version (1=no alignment, 2..40).
  // Source: ISO/IEC 18004 Annex E.
  var ALIGNMENT_CENTERS = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66],
    15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
    18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
    21: [6, 28, 50, 72, 94], 22: [6, 26, 50, 74, 98], 23: [6, 30, 54, 78, 102],
    24: [6, 28, 54, 80, 106], 25: [6, 32, 58, 84, 110], 26: [6, 30, 58, 86, 114],
    27: [6, 34, 62, 90, 118], 28: [6, 26, 50, 74, 98, 122], 29: [6, 30, 54, 78, 102, 126],
    30: [6, 26, 52, 78, 104, 130], 31: [6, 30, 56, 82, 108, 134],
    32: [6, 34, 60, 86, 112, 138], 33: [6, 30, 58, 86, 114, 142],
    34: [6, 34, 62, 90, 118, 146], 35: [6, 30, 54, 78, 102, 126, 150],
    36: [6, 24, 50, 76, 102, 128, 154], 37: [6, 28, 54, 80, 106, 132, 158],
    38: [6, 32, 58, 84, 110, 136, 162], 39: [6, 26, 54, 82, 110, 138, 166],
    40: [6, 30, 58, 86, 114, 142, 170]
  };

  function setupFunctionPatterns(matrix, version) {
    var size = matrix.size;
    // Three finder patterns + separators
    placeFinder(matrix, 0, 0);
    placeFinder(matrix, 0, size - 7);
    placeFinder(matrix, size - 7, 0);

    // Timing patterns
    for (var i = 8; i < size - 8; i++) {
      matrix.m[6][i] = (i % 2 === 0) ? 1 : 0;
      matrix.m[i][6] = (i % 2 === 0) ? 1 : 0;
      matrix.r[6][i] = 1;
      matrix.r[i][6] = 1;
    }
    // Reserve format info area
    for (var j = 0; j < 9; j++) {
      if (!matrix.r[8][j]) matrix.r[8][j] = 1;
      if (!matrix.r[j][8]) matrix.r[j][8] = 1;
    }
    for (var j2 = 0; j2 < 8; j2++) {
      if (!matrix.r[8][size - 1 - j2]) matrix.r[8][size - 1 - j2] = 1;
      if (!matrix.r[size - 1 - j2][8]) matrix.r[size - 1 - j2][8] = 1;
    }
    matrix.r[size - 8][8] = 1; // dark module
    matrix.m[size - 8][8] = 1;

    // Alignment patterns
    var centers = ALIGNMENT_CENTERS[version] || [];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var cx = centers[a], cy = centers[b];
        // Skip those overlapping finder patterns
        if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
        placeAlignment(matrix, cx, cy);
      }
    }

    // Version info area (>=7)
    if (version >= 7) {
      for (var y = 0; y < 6; y++) {
        for (var x = size - 11; x < size - 8; x++) {
          matrix.r[y][x] = 1;
          matrix.r[x][y] = 1;
        }
      }
    }
  }

  // ---------- Data placement (snake from bottom-right) ----------
  function placeData(matrix, bits, bitLen) {
    var size = matrix.size;
    var bitIdx = 0;
    var upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // skip vertical timing column
      for (var i = 0; i < size; i++) {
        var row = upward ? size - 1 - i : i;
        for (var k = 0; k < 2; k++) {
          var c = col - k;
          if (!matrix.r[row][c]) {
            var bit = 0;
            if (bitIdx < bitLen) bit = (bits[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
            matrix.m[row][c] = bit;
          }
        }
      }
      upward = !upward;
    }
    return bitIdx;
  }

  // ---------- Mask patterns ----------
  function maskFunc(idx, row, col) {
    switch (idx) {
      case 0: return (row + col) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return col % 3 === 0;
      case 3: return (row + col) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
      case 5: return (row * col) % 2 + (row * col) % 3 === 0;
      case 6: return ((row * col) % 2 + (row * col) % 3) % 2 === 0;
      case 7: return ((row + col) % 2 + (row * col) % 3) % 2 === 0;
    }
    return false;
  }

  function applyMask(matrix, maskIdx) {
    var size = matrix.size;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (matrix.r[r][c]) continue;
        if (maskFunc(maskIdx, r, c)) {
          matrix.m[r][c] ^= 1;
        }
      }
    }
  }

  function placeFormatInfo(matrix, maskIdx, eccLevel) {
    var bits = bchFormat((ECC_BITS[eccLevel] << 3) | maskIdx);
    var size = matrix.size;

    // Bits along top-left
    for (var i = 0; i < 6; i++) matrix.m[8][i] = (bits >> i) & 1;
    matrix.m[8][7] = (bits >> 6) & 1;
    matrix.m[8][8] = (bits >> 7) & 1;
    matrix.m[7][8] = (bits >> 8) & 1;
    for (var j = 9; j < 15; j++) matrix.m[14 - j][8] = (bits >> j) & 1;

    // Bits along top-right and bottom-left
    for (var i2 = 0; i2 < 8; i2++) matrix.m[size - 1 - i2][8] = (bits >> i2) & 1;
    for (var i3 = 8; i3 < 15; i3++) matrix.m[8][size - 15 + i3] = (bits >> i3) & 1;
    matrix.m[size - 8][8] = 1; // dark module
  }

  function placeVersionInfo(matrix, version) {
    if (version < 7) return;
    var bits = bchVersion(version);
    var size = matrix.size;
    for (var i = 0; i < 18; i++) {
      var bit = (bits >> i) & 1;
      var r1 = Math.floor(i / 3);
      var c1 = i % 3 + size - 11;
      matrix.m[r1][c1] = bit;
      matrix.m[c1][r1] = bit;
    }
  }

  // ---------- Penalty score ----------
  function penalty(matrix) {
    var size = matrix.size;
    var p = 0;

    // Rule 1: runs of 5+ same color in rows/cols
    for (var i = 0; i < size; i++) {
      var runRow = 1, runCol = 1;
      for (var j = 1; j < size; j++) {
        if (matrix.m[i][j] === matrix.m[i][j - 1]) runRow++;
        else { if (runRow >= 5) p += runRow - 2; runRow = 1; }
        if (matrix.m[j][i] === matrix.m[j - 1][i]) runCol++;
        else { if (runCol >= 5) p += runCol - 2; runCol = 1; }
      }
      if (runRow >= 5) p += runRow - 2;
      if (runCol >= 5) p += runCol - 2;
    }

    // Rule 2: 2x2 same-color blocks
    for (var y = 0; y < size - 1; y++) {
      for (var x = 0; x < size - 1; x++) {
        var v = matrix.m[y][x];
        if (matrix.m[y][x + 1] === v && matrix.m[y + 1][x] === v && matrix.m[y + 1][x + 1] === v) p += 3;
      }
    }

    // Rule 3: finder-like patterns
    // 1011101 with 4 white on either side in either direction
    for (var r = 0; r < size; r++) {
      for (var c = 0; c <= size - 7; c++) {
        if (matrix.m[r][c] === 1 && matrix.m[r][c + 1] === 0 && matrix.m[r][c + 2] === 1 &&
            matrix.m[r][c + 3] === 1 && matrix.m[r][c + 4] === 1 &&
            matrix.m[r][c + 5] === 0 && matrix.m[r][c + 6] === 1) {
          // check 4 white before/after
          var before = c >= 4 && matrix.m[r][c - 1] === 0 && matrix.m[r][c - 2] === 0 &&
                       matrix.m[r][c - 3] === 0 && matrix.m[r][c - 4] === 0;
          var after = c + 10 < size && matrix.m[r][c + 7] === 0 && matrix.m[r][c + 8] === 0 &&
                      matrix.m[r][c + 9] === 0 && matrix.m[r][c + 10] === 0;
          if (before) p += 40;
          if (after) p += 40;
        }
      }
    }
    for (var c2 = 0; c2 < size; c2++) {
      for (var r2 = 0; r2 <= size - 7; r2++) {
        if (matrix.m[r2][c2] === 1 && matrix.m[r2 + 1][c2] === 0 && matrix.m[r2 + 2][c2] === 1 &&
            matrix.m[r2 + 3][c2] === 1 && matrix.m[r2 + 4][c2] === 1 &&
            matrix.m[r2 + 5][c2] === 0 && matrix.m[r2 + 6][c2] === 1) {
          var before2 = r2 >= 4 && matrix.m[r2 - 1][c2] === 0 && matrix.m[r2 - 2][c2] === 0 &&
                        matrix.m[r2 - 3][c2] === 0 && matrix.m[r2 - 4][c2] === 0;
          var after2 = r2 + 10 < size && matrix.m[r2 + 7][c2] === 0 && matrix.m[r2 + 8][c2] === 0 &&
                       matrix.m[r2 + 9][c2] === 0 && matrix.m[r2 + 10][c2] === 0;
          if (before2) p += 40;
          if (after2) p += 40;
        }
      }
    }

    // Rule 4: balance of dark/light
    var dark = 0, total = size * size;
    for (var y2 = 0; y2 < size; y2++) {
      for (var x2 = 0; x2 < size; x2++) if (matrix.m[y2][x2]) dark++;
    }
    var ratio = (dark * 100) / total;
    var k = Math.floor(Math.abs(ratio - 50) / 5);
    p += k * 10;

    return p;
  }

  // ---------- Bit stream helpers ----------
  function appendBits(buf, n, val) {
    for (var i = n - 1; i >= 0; i--) {
      buf.push((val >> i) & 1);
    }
  }

  // UTF-8 encode a string into a Uint8Array
  function utf8Bytes(s) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(s);
    }
    // fallback (not exercised by modern browsers)
    var bytes = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
      else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
    }
    return new Uint8Array(bytes);
  }

  function packBits(arr) {
    var out = new Uint8Array(Math.ceil(arr.length / 8));
    for (var i = 0; i < arr.length; i++) {
      if (arr[i]) out[i >> 3] |= 1 << (7 - (i & 7));
    }
    return out;
  }

  // ---------- Build codewords ----------
  function buildBitStream(version, eccLevel, text) {
    var bytes = utf8Bytes(text);
    var table = ECC_TABLE[version][eccLevel];
    var totalDataCw = table[0] - (table[2] + (table[4] || 0)) * table[1];
    // total data capacity in bits
    var capacityBits = totalDataCw * 8;

    var bits = [];
    // Mode indicator: byte = 0100
    appendBits(bits, 4, 0x4);
    // Character count: for byte mode the indicator length depends on version range
    var countBits;
    if (version <= 9) countBits = 8;
    else if (version <= 26) countBits = 16;
    else countBits = 16;
    appendBits(bits, countBits, bytes.length);

    // Data bits
    for (var i = 0; i < bytes.length; i++) appendBits(bits, 8, bytes[i]);

    // Terminator: 0000 (or up to capacity)
    var termBits = Math.min(4, capacityBits - bits.length);
    if (termBits < 0) termBits = 0;
    for (var t = 0; t < termBits; t++) bits.push(0);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Pad with 0xEC, 0x11 alternating
    var padBytes = [0xEC, 0x11];
    var padIdx = 0;
    while (bits.length < capacityBits) {
      var pb = padBytes[padIdx++ % 2];
      for (var k = 7; k >= 0; k--) bits.push((pb >> k) & 1);
    }

    if (bits.length !== capacityBits) {
      throw new Error('Data overflow: needed ' + bits.length + ' bits, capacity ' + capacityBits);
    }

    return packBits(bits);
  }

  // Interleave blocks per ISO/IEC 18004 8.6
  function interleaveBlocks(version, eccLevel, dataCw) {
    var table = ECC_TABLE[version][eccLevel];
    var totalCw = table[0];
    var ecPerBlock = table[1];
    var g1Blocks = table[2], g1DataCw = table[3];
    var g2Blocks = table[4] || 0, g2DataCw = table[5] || 0;

    var blocks = [];
    var ecBlocks = [];
    var pos = 0;

    function processBlocks(blockCount, dataCwPerBlock) {
      for (var b = 0; b < blockCount; b++) {
        var block = [];
        for (var i = 0; i < dataCwPerBlock; i++) block.push(dataCw[pos++]);
        var ec = rsEncode(block, ecPerBlock);
        blocks.push(block);
        ecBlocks.push(ec);
      }
    }

    processBlocks(g1Blocks, g1DataCw);
    if (g2Blocks) processBlocks(g2Blocks, g2DataCw);

    // Interleave data codewords
    var maxData = Math.max(g1DataCw, g2DataCw || 0);
    var result = [];
    for (var col = 0; col < maxData; col++) {
      for (var b2 = 0; b2 < blocks.length; b2++) {
        if (col < blocks[b2].length) result.push(blocks[b2][col]);
      }
    }
    // Interleave ECC codewords
    for (var col2 = 0; col2 < ecPerBlock; col2++) {
      for (var b3 = 0; b3 < ecBlocks.length; b3++) {
        result.push(ecBlocks[b3][col2]);
      }
    }
    if (result.length !== totalCw) {
      throw new Error('Interleave length mismatch: ' + result.length + ' vs ' + totalCw);
    }
    return result;
  }

  // ---------- Find smallest version that fits the data ----------
  function smallestVersionFor(text, eccLevel) {
    var bytes = utf8Bytes(text);
    // Mode + count + data bits
    function dataBits(v) {
      var n = (v <= 9) ? 8 : 16;
      return 4 + n + 8 * bytes.length;
    }
    function dataCapacityCw(v) {
      var table = ECC_TABLE[v][eccLevel];
      return table[0] - (table[2] + (table[4] || 0)) * table[1];
    }
    function dataCapacityBits(v) { return dataCapacityCw(v) * 8; }

    for (var v = 1; v <= 40; v++) {
      if (dataBits(v) <= dataCapacityBits(v)) return v;
    }
    throw new Error('Data too large for any QR version (40)');
  }

  // ---------- Public entry point ----------
  // Returns an SVG string. opts: { ecc: 'L'|'M'|'Q'|'H', quiet: number }
  function qrcode(text, opts) {
    opts = opts || {};
    var eccLevel = (opts.ecc || 'L').toUpperCase();
    if (ECC_TABLE[1][eccLevel] === undefined) eccLevel = 'L';
    var quiet = opts.quiet;
    if (typeof quiet !== 'number' || quiet < 0) quiet = 4;

    if (typeof text !== 'string') text = String(text);
    var version = smallestVersionFor(text, eccLevel);
    var size = versionSize(version);

    var dataCw = buildBitStream(version, eccLevel, text);
    var finalCw = interleaveBlocks(version, eccLevel, Array.from(dataCw));

    // Convert codewords to bit buffer
    var bits = [];
    for (var i = 0; i < finalCw.length; i++) {
      for (var k = 7; k >= 0; k--) bits.push((finalCw[i] >> k) & 1);
    }

    var matrix = makeMatrix(size);
    setupFunctionPatterns(matrix, version);

    // Place data (matrix.r marks reserved cells)
    placeData(matrix, bits, bits.length);

    // Try all 8 masks; pick the one with lowest penalty
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var mCopy = {
        m: matrix.m.map(function (row) { return Uint8Array.from(row); }),
        r: matrix.r,
        size: matrix.size
      };
      applyMask(mCopy, mask);
      placeFormatInfo(mCopy, mask, eccLevel);
      if (version >= 7) placeVersionInfo(mCopy, version);
      var p = penalty(mCopy);
      if (best === null || p < best.p) best = { p: p, mask: mask, m: mCopy };
    }

    // Render SVG
    var total = size + quiet * 2;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 ' + total + ' ' + total + '" width="' + total + '" height="' + total + '">');
    parts.push('<rect width="' + total + '" height="' + total + '" fill="#ffffff"/>');

    // Build horizontal runs per row to minimize path complexity.
    var bg = best.m;
    for (var y = 0; y < size; y++) {
      var x = 0;
      while (x < size) {
        if (bg.m[y][x] === 1) {
          var startX = x;
          while (x < size && bg.m[y][x] === 1) x++;
          var w = x - startX;
          var sx = startX + quiet, sy = y + quiet;
          parts.push('<rect x="' + sx + '" y="' + sy + '" width="' + w + '" height="1"/>');
        } else {
          x++;
        }
      }
    }
    parts.push('</svg>');
    return parts.join('');
  }

  window.qrcode = qrcode;
})();
