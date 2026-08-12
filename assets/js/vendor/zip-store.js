/* ============================================
   zip-store.js — Story 3.11 (vendored)

   PKZIP STORE-only (no compression) archive
   builder. Reference: APPNOTE.TXT §4.3.7 (local
   file header), §4.3.12 (central directory),
   §4.3.16 (EOCD). Filenames are UTF-8 with the
   general-purpose bit 11 set (Language encoding
   flag = UTF-8 per APPNOTE.TXT §4.4.4).

   Exposes window.HT.zipStore(files) → Uint8Array
   where files is [{name, data}] and data is a
   Uint8Array or string.

   Zero external dependencies. ~120 LOC. AD-1
   compliant.

   Author: Handy Tools (Story 3.11)
   ============================================ */

(function () {
  'use strict';

  // -------------------------------------------------
  // CRC-32 (IEEE 802.3 / PKZIP) with table-driven
  // polynomial 0xEDB88320. Precomputed once at
  // module load time.
  // -------------------------------------------------

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var j = 0; j < 8; j++) {
        c = (c & 1) ? ((c >>> 1) ^ 0xEDB88320) : (c >>> 1);
      }
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) {
      c = (CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8Encode(str) {
    // Use TextEncoder when available; fall back to
    // encodeURIComponent escape for environments
    // without it (older file:// browsers).
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    var escaped = unescape(encodeURIComponent(str));
    var out = new Uint8Array(escaped.length);
    for (var i = 0; i < escaped.length; i++) {
      out[i] = escaped.charCodeAt(i) & 0xFF;
    }
    return out;
  }

  function bytesOf(data) {
    if (typeof data === 'string') return utf8Encode(data);
    if (data instanceof Uint8Array) return data;
    if (data && data.buffer instanceof ArrayBuffer) {
      return new Uint8Array(data.buffer);
    }
    return new Uint8Array(0);
  }

  // -------------------------------------------------
  // 4-byte little-endian write
  // -------------------------------------------------

  function writeU32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  function writeU16(view, offset, value) {
    view.setUint16(offset, value & 0xFFFF, true);
  }

  // -------------------------------------------------
  // Build the archive
  // -------------------------------------------------

  function zipStore(files) {
    if (!Array.isArray(files)) files = [];

    // Normalize files
    var items = files.map(function (f) {
      var nameBytes = utf8Encode(String(f.name || ''));
      var dataBytes = bytesOf(f.data);
      var crc = crc32(dataBytes);
      return {
        name: String(f.name || ''),
        nameBytes: nameBytes,
        data: dataBytes,
        crc: crc,
        size: dataBytes.length,
        offset: 0,   // filled below
        dt: (f && f.modDate) ? f.modDate : dosTime(2026, 1, 1, 0, 0, 0)
      };
    });

    // Local file header per item: 30 + name + data
    var localTotal = 0;
    var centralTotal = 0;
    for (var i = 0; i < items.length; i++) {
      items[i].offset = localTotal;
      localTotal += 30 + items[i].nameBytes.length + items[i].size;
      centralTotal += 46 + items[i].nameBytes.length;
    }
    var eocdSize = 22;
    var total = localTotal + centralTotal + eocdSize;

    var out = new Uint8Array(total);
    var view = new DataView(out.buffer);
    var p = 0;
    var dataStart = 0;

    // Local file headers + file data
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      // signature 0x04034b50
      writeU32(view, p, 0x04034b50); p += 4;
      // version needed: 20 (STORE)
      writeU16(view, p, 20); p += 2;
      // general purpose bit flag: bit 11 = UTF-8 filename
      writeU16(view, p, 0x0800); p += 2;
      // compression method: 0 (STORE)
      writeU16(view, p, 0); p += 2;
      // last mod file time + date
      writeU16(view, p, it.dt.time); p += 2;
      writeU16(view, p, it.dt.date); p += 2;
      // CRC-32
      writeU32(view, p, it.crc); p += 4;
      // compressed size (= uncompressed size for STORE)
      writeU32(view, p, it.size); p += 4;
      // uncompressed size
      writeU32(view, p, it.size); p += 4;
      // file name length
      writeU16(view, p, it.nameBytes.length); p += 2;
      // extra field length = 0
      writeU16(view, p, 0); p += 2;
      // file name
      out.set(it.nameBytes, p); p += it.nameBytes.length;
      // file data
      out.set(it.data, p);
      p += it.size;
    }

    dataStart = p;

    // Central directory
    for (var m = 0; m < items.length; m++) {
      var cd = items[m];
      // signature 0x02014b50
      writeU32(view, p, 0x02014b50); p += 4;
      // version made by (Unix: 0x0300 + 20 = 0x0314)
      writeU16(view, p, (3 << 8) | 20); p += 2;
      // version needed
      writeU16(view, p, 20); p += 2;
      // general purpose bit flag
      writeU16(view, p, 0x0800); p += 2;
      // compression method
      writeU16(view, p, 0); p += 2;
      // last mod file time + date
      writeU16(view, p, cd.dt.time); p += 2;
      writeU16(view, p, cd.dt.date); p += 2;
      // CRC
      writeU32(view, p, cd.crc); p += 4;
      // compressed size
      writeU32(view, p, cd.size); p += 4;
      // uncompressed size
      writeU32(view, p, cd.size); p += 4;
      // file name length
      writeU16(view, p, cd.nameBytes.length); p += 2;
      // extra field length
      writeU16(view, p, 0); p += 2;
      // file comment length
      writeU16(view, p, 0); p += 2;
      // disk number start
      writeU16(view, p, 0); p += 2;
      // internal file attributes
      writeU16(view, p, 0); p += 2;
      // external file attributes
      writeU32(view, p, 0); p += 4;
      // relative offset of local header
      writeU32(view, p, cd.offset); p += 4;
      // file name
      out.set(cd.nameBytes, p); p += cd.nameBytes.length;
    }

    var cdSize = p - dataStart;

    // End of central directory
    writeU32(view, p, 0x06054b50); p += 4;
    // disk number
    writeU16(view, p, 0); p += 2;
    // disk where CD starts
    writeU16(view, p, 0); p += 2;
    // # entries on this disk
    writeU16(view, p, items.length); p += 2;
    // total # entries
    writeU16(view, p, items.length); p += 2;
    // size of central directory
    writeU32(view, p, cdSize); p += 4;
    // offset of start of central directory
    writeU32(view, p, dataStart); p += 4;
    // comment length
    writeU16(view, p, 0); p += 2;

    return out;
  }

  // Convert (year, month, day, hour, min, sec) to MS-DOS
  // date (bits 0-4 = day, 5-8 = month, 9-15 = year-1980)
  // and time (bits 0-4 = sec/2, 5-10 = min, 11-15 = hour).
  function dosTime(y, mo, d, h, mi, s) {
    var year = (y >= 1980 ? y - 1980 : 0) & 0x7F;
    var month = mo & 0x0F;
    var day = d & 0x1F;
    var hour = h & 0x1F;
    var min = mi & 0x3F;
    var sec = (s & 0x3F) >>> 1;
    return {
      date: (year << 9) | (month << 5) | day,
      time: (hour << 11) | (min << 5) | sec
    };
  }

  // -------------------------------------------------
  // Public API
  // -------------------------------------------------

  window.HT_zipStore = zipStore;
  window.HT = window.HT || {};
  window.HT.zipStore = zipStore;
  window.HT._zipStoreCrc32 = crc32;
  // Expose CRC table for tests.
  window.HT._zipStoreCrcTable = CRC_TABLE;
})();
