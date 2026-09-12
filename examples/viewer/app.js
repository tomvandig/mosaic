var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a2, b) => (typeof require !== "undefined" ? require : a2)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/jszip/dist/jszip.min.js
var require_jszip_min = __commonJS({
  "node_modules/jszip/dist/jszip.min.js"(exports, module) {
    !(function(e) {
      if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
      else if ("function" == typeof define && define.amd) define([], e);
      else {
        ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
      }
    })(function() {
      return (function s(a2, o2, h) {
        function u2(r2, e2) {
          if (!o2[r2]) {
            if (!a2[r2]) {
              var t = "function" == typeof __require && __require;
              if (!e2 && t) return t(r2, true);
              if (l2) return l2(r2, true);
              var n = new Error("Cannot find module '" + r2 + "'");
              throw n.code = "MODULE_NOT_FOUND", n;
            }
            var i = o2[r2] = { exports: {} };
            a2[r2][0].call(i.exports, function(e3) {
              var t2 = a2[r2][1][e3];
              return u2(t2 || e3);
            }, i, i.exports, s, a2, o2, h);
          }
          return o2[r2].exports;
        }
        for (var l2 = "function" == typeof __require && __require, e = 0; e < h.length; e++) u2(h[e]);
        return u2;
      })({ 1: [function(e, t, r2) {
        "use strict";
        var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        r2.encode = function(e2) {
          for (var t2, r3, n, i, s, a2, o2, h = [], u2 = 0, l2 = e2.length, f = l2, c2 = "string" !== d.getTypeOf(e2); u2 < e2.length; ) f = l2 - u2, n = c2 ? (t2 = e2[u2++], r3 = u2 < l2 ? e2[u2++] : 0, u2 < l2 ? e2[u2++] : 0) : (t2 = e2.charCodeAt(u2++), r3 = u2 < l2 ? e2.charCodeAt(u2++) : 0, u2 < l2 ? e2.charCodeAt(u2++) : 0), i = t2 >> 2, s = (3 & t2) << 4 | r3 >> 4, a2 = 1 < f ? (15 & r3) << 2 | n >> 6 : 64, o2 = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a2) + p.charAt(o2));
          return h.join("");
        }, r2.decode = function(e2) {
          var t2, r3, n, i, s, a2, o2 = 0, h = 0, u2 = "data:";
          if (e2.substr(0, u2.length) === u2) throw new Error("Invalid base64 input, it looks like a data url.");
          var l2, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
          if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
          for (l2 = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o2 < e2.length; ) t2 = p.indexOf(e2.charAt(o2++)) << 2 | (i = p.indexOf(e2.charAt(o2++))) >> 4, r3 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o2++))) >> 2, n = (3 & s) << 6 | (a2 = p.indexOf(e2.charAt(o2++))), l2[h++] = t2, 64 !== s && (l2[h++] = r3), 64 !== a2 && (l2[h++] = n);
          return l2;
        };
      }, { "./support": 30, "./utils": 32 }], 2: [function(e, t, r2) {
        "use strict";
        var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a2 = e("./stream/DataLengthProbe");
        function o2(e2, t2, r3, n2, i2) {
          this.compressedSize = e2, this.uncompressedSize = t2, this.crc32 = r3, this.compression = n2, this.compressedContent = i2;
        }
        o2.prototype = { getContentWorker: function() {
          var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a2("data_length")), t2 = this;
          return e2.on("end", function() {
            if (this.streamInfo.data_length !== t2.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
          }), e2;
        }, getCompressedWorker: function() {
          return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
        } }, o2.createWorkerFrom = function(e2, t2, r3) {
          return e2.pipe(new s()).pipe(new a2("uncompressedSize")).pipe(t2.compressWorker(r3)).pipe(new a2("compressedSize")).withStreamInfo("compression", t2);
        }, t.exports = o2;
      }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t, r2) {
        "use strict";
        var n = e("./stream/GenericWorker");
        r2.STORE = { magic: "\0\0", compressWorker: function() {
          return new n("STORE compression");
        }, uncompressWorker: function() {
          return new n("STORE decompression");
        } }, r2.DEFLATE = e("./flate");
      }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t, r2) {
        "use strict";
        var n = e("./utils");
        var o2 = (function() {
          for (var e2, t2 = [], r3 = 0; r3 < 256; r3++) {
            e2 = r3;
            for (var n2 = 0; n2 < 8; n2++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t2[r3] = e2;
          }
          return t2;
        })();
        t.exports = function(e2, t2) {
          return void 0 !== e2 && e2.length ? "string" !== n.getTypeOf(e2) ? (function(e3, t3, r3, n2) {
            var i = o2, s = n2 + r3;
            e3 ^= -1;
            for (var a2 = n2; a2 < s; a2++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3[a2])];
            return -1 ^ e3;
          })(0 | t2, e2, e2.length, 0) : (function(e3, t3, r3, n2) {
            var i = o2, s = n2 + r3;
            e3 ^= -1;
            for (var a2 = n2; a2 < s; a2++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3.charCodeAt(a2))];
            return -1 ^ e3;
          })(0 | t2, e2, e2.length, 0) : 0;
        };
      }, { "./utils": 32 }], 5: [function(e, t, r2) {
        "use strict";
        r2.base64 = false, r2.binary = false, r2.dir = false, r2.createFolders = true, r2.date = null, r2.compression = null, r2.compressionOptions = null, r2.comment = null, r2.unixPermissions = null, r2.dosPermissions = null;
      }, {}], 6: [function(e, t, r2) {
        "use strict";
        var n = null;
        n = "undefined" != typeof Promise ? Promise : e("lie"), t.exports = { Promise: n };
      }, { lie: 37 }], 7: [function(e, t, r2) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a2 = e("./stream/GenericWorker"), o2 = n ? "uint8array" : "array";
        function h(e2, t2) {
          a2.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t2, this.meta = {};
        }
        r2.magic = "\b\0", s.inherits(h, a2), h.prototype.processChunk = function(e2) {
          this.meta = e2.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o2, e2.data), false);
        }, h.prototype.flush = function() {
          a2.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], true);
        }, h.prototype.cleanUp = function() {
          a2.prototype.cleanUp.call(this), this._pako = null;
        }, h.prototype._createPako = function() {
          this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
          var t2 = this;
          this._pako.onData = function(e2) {
            t2.push({ data: e2, meta: t2.meta });
          };
        }, r2.compressWorker = function(e2) {
          return new h("Deflate", e2);
        }, r2.uncompressWorker = function() {
          return new h("Inflate", {});
        };
      }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t, r2) {
        "use strict";
        function A(e2, t2) {
          var r3, n2 = "";
          for (r3 = 0; r3 < t2; r3++) n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
          return n2;
        }
        function n(e2, t2, r3, n2, i2, s2) {
          var a2, o2, h = e2.file, u2 = e2.compression, l2 = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
          t2 && !r3 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
          var S = 0;
          t2 && (S |= 8), l2 || !_ && !g || (S |= 2048);
          var z = 0, C = 0;
          w && (z |= 16), "UNIX" === i2 ? (C = 798, z |= (function(e3, t3) {
            var r4 = e3;
            return e3 || (r4 = t3 ? 16893 : 33204), (65535 & r4) << 16;
          })(h.unixPermissions, w)) : (C = 20, z |= (function(e3) {
            return 63 & (e3 || 0);
          })(h.dosPermissions)), a2 = k.getUTCHours(), a2 <<= 6, a2 |= k.getUTCMinutes(), a2 <<= 5, a2 |= k.getUTCSeconds() / 2, o2 = k.getUTCFullYear() - 1980, o2 <<= 4, o2 |= k.getUTCMonth() + 1, o2 <<= 5, o2 |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
          var E = "";
          return E += "\n\0", E += A(S, 2), E += u2.magic, E += A(a2, 2), E += A(o2, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
        }
        var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
        function s(e2, t2, r3, n2) {
          i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t2, this.zipPlatform = r3, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
        }
        I.inherits(s, i), s.prototype.push = function(e2) {
          var t2 = e2.meta.percent || 0, r3 = this.entriesCount, n2 = this._sources.length;
          this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r3 ? (t2 + 100 * (r3 - n2 - 1)) / r3 : 100 } }));
        }, s.prototype.openedSource = function(e2) {
          this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
          var t2 = this.streamFiles && !e2.file.dir;
          if (t2) {
            var r3 = n(e2, t2, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            this.push({ data: r3.fileRecord, meta: { percent: 0 } });
          } else this.accumulate = true;
        }, s.prototype.closedSource = function(e2) {
          this.accumulate = false;
          var t2 = this.streamFiles && !e2.file.dir, r3 = n(e2, t2, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
          if (this.dirRecords.push(r3.dirRecord), t2) this.push({ data: (function(e3) {
            return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
          })(e2), meta: { percent: 100 } });
          else for (this.push({ data: r3.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
          this.currentFile = null;
        }, s.prototype.flush = function() {
          for (var e2 = this.bytesWritten, t2 = 0; t2 < this.dirRecords.length; t2++) this.push({ data: this.dirRecords[t2], meta: { percent: 100 } });
          var r3 = this.bytesWritten - e2, n2 = (function(e3, t3, r4, n3, i2) {
            var s2 = I.transformTo("string", i2(n3));
            return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t3, 4) + A(r4, 4) + A(s2.length, 2) + s2;
          })(this.dirRecords.length, r3, e2, this.zipComment, this.encodeFileName);
          this.push({ data: n2, meta: { percent: 100 } });
        }, s.prototype.prepareNextSource = function() {
          this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
        }, s.prototype.registerPrevious = function(e2) {
          this._sources.push(e2);
          var t2 = this;
          return e2.on("data", function(e3) {
            t2.processChunk(e3);
          }), e2.on("end", function() {
            t2.closedSource(t2.previous.streamInfo), t2._sources.length ? t2.prepareNextSource() : t2.end();
          }), e2.on("error", function(e3) {
            t2.error(e3);
          }), this;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
        }, s.prototype.error = function(e2) {
          var t2 = this._sources;
          if (!i.prototype.error.call(this, e2)) return false;
          for (var r3 = 0; r3 < t2.length; r3++) try {
            t2[r3].error(e2);
          } catch (e3) {
          }
          return true;
        }, s.prototype.lock = function() {
          i.prototype.lock.call(this);
          for (var e2 = this._sources, t2 = 0; t2 < e2.length; t2++) e2[t2].lock();
        }, t.exports = s;
      }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t, r2) {
        "use strict";
        var u2 = e("../compressions"), n = e("./ZipFileWorker");
        r2.generateWorker = function(e2, a2, t2) {
          var o2 = new n(a2.streamFiles, t2, a2.platform, a2.encodeFileName), h = 0;
          try {
            e2.forEach(function(e3, t3) {
              h++;
              var r3 = (function(e4, t4) {
                var r4 = e4 || t4, n3 = u2[r4];
                if (!n3) throw new Error(r4 + " is not a valid compression method !");
                return n3;
              })(t3.options.compression, a2.compression), n2 = t3.options.compressionOptions || a2.compressionOptions || {}, i = t3.dir, s = t3.date;
              t3._compressWorker(r3, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t3.comment || "", unixPermissions: t3.unixPermissions, dosPermissions: t3.dosPermissions }).pipe(o2);
            }), o2.entriesCount = h;
          } catch (e3) {
            o2.error(e3);
          }
          return o2;
        };
      }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t, r2) {
        "use strict";
        function n() {
          if (!(this instanceof n)) return new n();
          if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
          this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
            var e2 = new n();
            for (var t2 in this) "function" != typeof this[t2] && (e2[t2] = this[t2]);
            return e2;
          };
        }
        (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.1", n.loadAsync = function(e2, t2) {
          return new n().loadAsync(e2, t2);
        }, n.external = e("./external"), t.exports = n;
      }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t, r2) {
        "use strict";
        var u2 = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a2 = e("./stream/Crc32Probe"), l2 = e("./nodejsUtils");
        function f(n2) {
          return new i.Promise(function(e2, t2) {
            var r3 = n2.decompressed.getContentWorker().pipe(new a2());
            r3.on("error", function(e3) {
              t2(e3);
            }).on("end", function() {
              r3.streamInfo.crc32 !== n2.decompressed.crc32 ? t2(new Error("Corrupted zip : CRC32 mismatch")) : e2();
            }).resume();
          });
        }
        t.exports = function(e2, o2) {
          var h = this;
          return o2 = u2.extend(o2 || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l2.isNode && l2.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u2.prepareContent("the loaded zip file", e2, true, o2.optimizedBinaryString, o2.base64).then(function(e3) {
            var t2 = new s(o2);
            return t2.load(e3), t2;
          }).then(function(e3) {
            var t2 = [i.Promise.resolve(e3)], r3 = e3.files;
            if (o2.checkCRC32) for (var n2 = 0; n2 < r3.length; n2++) t2.push(f(r3[n2]));
            return i.Promise.all(t2);
          }).then(function(e3) {
            for (var t2 = e3.shift(), r3 = t2.files, n2 = 0; n2 < r3.length; n2++) {
              var i2 = r3[n2], s2 = i2.fileNameStr, a3 = u2.resolve(i2.fileNameStr);
              h.file(a3, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o2.createFolders }), i2.dir || (h.file(a3).unsafeOriginalName = s2);
            }
            return t2.zipComment.length && (h.comment = t2.zipComment), h;
          });
        };
      }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t, r2) {
        "use strict";
        var n = e("../utils"), i = e("../stream/GenericWorker");
        function s(e2, t2) {
          i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t2);
        }
        n.inherits(s, i), s.prototype._bindStream = function(e2) {
          var t2 = this;
          (this._stream = e2).pause(), e2.on("data", function(e3) {
            t2.push({ data: e3, meta: { percent: 0 } });
          }).on("error", function(e3) {
            t2.isPaused ? this.generatedError = e3 : t2.error(e3);
          }).on("end", function() {
            t2.isPaused ? t2._upstreamEnded = true : t2.end();
          });
        }, s.prototype.pause = function() {
          return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
        }, t.exports = s;
      }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t, r2) {
        "use strict";
        var i = e("readable-stream").Readable;
        function n(e2, t2, r3) {
          i.call(this, t2), this._helper = e2;
          var n2 = this;
          e2.on("data", function(e3, t3) {
            n2.push(e3) || n2._helper.pause(), r3 && r3(t3);
          }).on("error", function(e3) {
            n2.emit("error", e3);
          }).on("end", function() {
            n2.push(null);
          });
        }
        e("../utils").inherits(n, i), n.prototype._read = function() {
          this._helper.resume();
        }, t.exports = n;
      }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t, r2) {
        "use strict";
        t.exports = { isNode: "undefined" != typeof Buffer, newBufferFrom: function(e2, t2) {
          if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(e2, t2);
          if ("number" == typeof e2) throw new Error('The "data" argument must not be a number');
          return new Buffer(e2, t2);
        }, allocBuffer: function(e2) {
          if (Buffer.alloc) return Buffer.alloc(e2);
          var t2 = new Buffer(e2);
          return t2.fill(0), t2;
        }, isBuffer: function(e2) {
          return Buffer.isBuffer(e2);
        }, isStream: function(e2) {
          return e2 && "function" == typeof e2.on && "function" == typeof e2.pause && "function" == typeof e2.resume;
        } };
      }, {}], 15: [function(e, t, r2) {
        "use strict";
        function s(e2, t2, r3) {
          var n2, i2 = u2.getTypeOf(t2), s2 = u2.extend(r3 || {}, f);
          s2.date = s2.date || /* @__PURE__ */ new Date(), null !== s2.compression && (s2.compression = s2.compression.toUpperCase()), "string" == typeof s2.unixPermissions && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
          var a3 = "string" === i2 && false === s2.binary && false === s2.base64;
          r3 && void 0 !== r3.binary || (s2.binary = !a3), (t2 instanceof c && 0 === t2.uncompressedSize || s2.dir || !t2 || 0 === t2.length) && (s2.base64 = false, s2.binary = true, t2 = "", s2.compression = "STORE", i2 = "string");
          var o3 = null;
          o3 = t2 instanceof c || t2 instanceof l2 ? t2 : p.isNode && p.isStream(t2) ? new m(e2, t2) : u2.prepareContent(e2, t2, s2.binary, s2.optimizedBinaryString, s2.base64);
          var h2 = new d(e2, o3, s2);
          this.files[e2] = h2;
        }
        var i = e("./utf8"), u2 = e("./utils"), l2 = e("./stream/GenericWorker"), a2 = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o2 = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e2) {
          "/" === e2.slice(-1) && (e2 = e2.substring(0, e2.length - 1));
          var t2 = e2.lastIndexOf("/");
          return 0 < t2 ? e2.substring(0, t2) : "";
        }, g = function(e2) {
          return "/" !== e2.slice(-1) && (e2 += "/"), e2;
        }, b = function(e2, t2) {
          return t2 = void 0 !== t2 ? t2 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t2 }), this.files[e2];
        };
        function h(e2) {
          return "[object RegExp]" === Object.prototype.toString.call(e2);
        }
        var n = { load: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, forEach: function(e2) {
          var t2, r3, n2;
          for (t2 in this.files) n2 = this.files[t2], (r3 = t2.slice(this.root.length, t2.length)) && t2.slice(0, this.root.length) === this.root && e2(r3, n2);
        }, filter: function(r3) {
          var n2 = [];
          return this.forEach(function(e2, t2) {
            r3(e2, t2) && n2.push(t2);
          }), n2;
        }, file: function(e2, t2, r3) {
          if (1 !== arguments.length) return e2 = this.root + e2, s.call(this, e2, t2, r3), this;
          if (h(e2)) {
            var n2 = e2;
            return this.filter(function(e3, t3) {
              return !t3.dir && n2.test(e3);
            });
          }
          var i2 = this.files[this.root + e2];
          return i2 && !i2.dir ? i2 : null;
        }, folder: function(r3) {
          if (!r3) return this;
          if (h(r3)) return this.filter(function(e3, t3) {
            return t3.dir && r3.test(e3);
          });
          var e2 = this.root + r3, t2 = b.call(this, e2), n2 = this.clone();
          return n2.root = t2.name, n2;
        }, remove: function(r3) {
          r3 = this.root + r3;
          var e2 = this.files[r3];
          if (e2 || ("/" !== r3.slice(-1) && (r3 += "/"), e2 = this.files[r3]), e2 && !e2.dir) delete this.files[r3];
          else for (var t2 = this.filter(function(e3, t3) {
            return t3.name.slice(0, r3.length) === r3;
          }), n2 = 0; n2 < t2.length; n2++) delete this.files[t2[n2].name];
          return this;
        }, generate: function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, generateInternalStream: function(e2) {
          var t2, r3 = {};
          try {
            if ((r3 = u2.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r3.type.toLowerCase(), r3.compression = r3.compression.toUpperCase(), "binarystring" === r3.type && (r3.type = "string"), !r3.type) throw new Error("No output type specified.");
            u2.checkSupport(r3.type), "darwin" !== r3.platform && "freebsd" !== r3.platform && "linux" !== r3.platform && "sunos" !== r3.platform || (r3.platform = "UNIX"), "win32" === r3.platform && (r3.platform = "DOS");
            var n2 = r3.comment || this.comment || "";
            t2 = o2.generateWorker(this, r3, n2);
          } catch (e3) {
            (t2 = new l2("error")).error(e3);
          }
          return new a2(t2, r3.type || "string", r3.mimeType);
        }, generateAsync: function(e2, t2) {
          return this.generateInternalStream(e2).accumulate(t2);
        }, generateNodeStream: function(e2, t2) {
          return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t2);
        } };
        t.exports = n;
      }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t, r2) {
        "use strict";
        t.exports = e("stream");
      }, { stream: void 0 }], 17: [function(e, t, r2) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
          for (var t2 = 0; t2 < this.data.length; t2++) e2[t2] = 255 & e2[t2];
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data[this.zero + e2];
        }, i.prototype.lastIndexOfSignature = function(e2) {
          for (var t2 = e2.charCodeAt(0), r3 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s) if (this.data[s] === t2 && this.data[s + 1] === r3 && this.data[s + 2] === n2 && this.data[s + 3] === i2) return s - this.zero;
          return -1;
        }, i.prototype.readAndCheckSignature = function(e2) {
          var t2 = e2.charCodeAt(0), r3 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
          return t2 === s[0] && r3 === s[1] && n2 === s[2] && i2 === s[3];
        }, i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2) return [];
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t, r2) {
        "use strict";
        var n = e("../utils");
        function i(e2) {
          this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
        }
        i.prototype = { checkOffset: function(e2) {
          this.checkIndex(this.index + e2);
        }, checkIndex: function(e2) {
          if (this.length < this.zero + e2 || e2 < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
        }, setIndex: function(e2) {
          this.checkIndex(e2), this.index = e2;
        }, skip: function(e2) {
          this.setIndex(this.index + e2);
        }, byteAt: function() {
        }, readInt: function(e2) {
          var t2, r3 = 0;
          for (this.checkOffset(e2), t2 = this.index + e2 - 1; t2 >= this.index; t2--) r3 = (r3 << 8) + this.byteAt(t2);
          return this.index += e2, r3;
        }, readString: function(e2) {
          return n.transformTo("string", this.readData(e2));
        }, readData: function() {
        }, lastIndexOfSignature: function() {
        }, readAndCheckSignature: function() {
        }, readDate: function() {
          var e2 = this.readInt(4);
          return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
        } }, t.exports = i;
      }, { "../utils": 32 }], 19: [function(e, t, r2) {
        "use strict";
        var n = e("./Uint8ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t, r2) {
        "use strict";
        var n = e("./DataReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
          return this.data.charCodeAt(this.zero + e2);
        }, i.prototype.lastIndexOfSignature = function(e2) {
          return this.data.lastIndexOf(e2) - this.zero;
        }, i.prototype.readAndCheckSignature = function(e2) {
          return e2 === this.readData(4);
        }, i.prototype.readData = function(e2) {
          this.checkOffset(e2);
          var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t, r2) {
        "use strict";
        var n = e("./ArrayReader");
        function i(e2) {
          n.call(this, e2);
        }
        e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
          if (this.checkOffset(e2), 0 === e2) return new Uint8Array(0);
          var t2 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
          return this.index += e2, t2;
        }, t.exports = i;
      }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t, r2) {
        "use strict";
        var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a2 = e("./StringReader"), o2 = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
        t.exports = function(e2) {
          var t2 = n.getTypeOf(e2);
          return n.checkSupport(t2), "string" !== t2 || i.uint8array ? "nodebuffer" === t2 ? new o2(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a2(e2);
        };
      }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t, r2) {
        "use strict";
        r2.LOCAL_FILE_HEADER = "PK", r2.CENTRAL_FILE_HEADER = "PK", r2.CENTRAL_DIRECTORY_END = "PK", r2.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r2.ZIP64_CENTRAL_DIRECTORY_END = "PK", r2.DATA_DESCRIPTOR = "PK\x07\b";
      }, {}], 24: [function(e, t, r2) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../utils");
        function s(e2) {
          n.call(this, "ConvertWorker to " + e2), this.destType = e2;
        }
        i.inherits(s, n), s.prototype.processChunk = function(e2) {
          this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t, r2) {
        "use strict";
        var n = e("./GenericWorker"), i = e("../crc32");
        function s() {
          n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
        }
        e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
          this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
        }, t.exports = s;
      }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t, r2) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
        }
        n.inherits(s, i), s.prototype.processChunk = function(e2) {
          if (e2) {
            var t2 = this.streamInfo[this.propName] || 0;
            this.streamInfo[this.propName] = t2 + e2.data.length;
          }
          i.prototype.processChunk.call(this, e2);
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t, r2) {
        "use strict";
        var n = e("../utils"), i = e("./GenericWorker");
        function s(e2) {
          i.call(this, "DataWorker");
          var t2 = this;
          this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
            t2.dataIsReady = true, t2.data = e3, t2.max = e3 && e3.length || 0, t2.type = n.getTypeOf(e3), t2.isPaused || t2._tickAndRepeat();
          }, function(e3) {
            t2.error(e3);
          });
        }
        n.inherits(s, i), s.prototype.cleanUp = function() {
          i.prototype.cleanUp.call(this), this.data = null;
        }, s.prototype.resume = function() {
          return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
        }, s.prototype._tickAndRepeat = function() {
          this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
        }, s.prototype._tick = function() {
          if (this.isPaused || this.isFinished) return false;
          var e2 = null, t2 = Math.min(this.max, this.index + 16384);
          if (this.index >= this.max) return this.end();
          switch (this.type) {
            case "string":
              e2 = this.data.substring(this.index, t2);
              break;
            case "uint8array":
              e2 = this.data.subarray(this.index, t2);
              break;
            case "array":
            case "nodebuffer":
              e2 = this.data.slice(this.index, t2);
          }
          return this.index = t2, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
        }, t.exports = s;
      }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t, r2) {
        "use strict";
        function n(e2) {
          this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
        }
        n.prototype = { push: function(e2) {
          this.emit("data", e2);
        }, end: function() {
          if (this.isFinished) return false;
          this.flush();
          try {
            this.emit("end"), this.cleanUp(), this.isFinished = true;
          } catch (e2) {
            this.emit("error", e2);
          }
          return true;
        }, error: function(e2) {
          return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
        }, on: function(e2, t2) {
          return this._listeners[e2].push(t2), this;
        }, cleanUp: function() {
          this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
        }, emit: function(e2, t2) {
          if (this._listeners[e2]) for (var r3 = 0; r3 < this._listeners[e2].length; r3++) this._listeners[e2][r3].call(this, t2);
        }, pipe: function(e2) {
          return e2.registerPrevious(this);
        }, registerPrevious: function(e2) {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
          var t2 = this;
          return e2.on("data", function(e3) {
            t2.processChunk(e3);
          }), e2.on("end", function() {
            t2.end();
          }), e2.on("error", function(e3) {
            t2.error(e3);
          }), this;
        }, pause: function() {
          return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
        }, resume: function() {
          if (!this.isPaused || this.isFinished) return false;
          var e2 = this.isPaused = false;
          return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
        }, flush: function() {
        }, processChunk: function(e2) {
          this.push(e2);
        }, withStreamInfo: function(e2, t2) {
          return this.extraStreamInfo[e2] = t2, this.mergeStreamInfo(), this;
        }, mergeStreamInfo: function() {
          for (var e2 in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
        }, lock: function() {
          if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
          this.isLocked = true, this.previous && this.previous.lock();
        }, toString: function() {
          var e2 = "Worker " + this.name;
          return this.previous ? this.previous + " -> " + e2 : e2;
        } }, t.exports = n;
      }, {}], 29: [function(e, t, r2) {
        "use strict";
        var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u2 = e("../base64"), n = e("../support"), a2 = e("../external"), o2 = null;
        if (n.nodestream) try {
          o2 = e("../nodejs/NodejsStreamOutputAdapter");
        } catch (e2) {
        }
        function l2(e2, o3) {
          return new a2.Promise(function(t2, r3) {
            var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a3 = e2._mimeType;
            e2.on("data", function(e3, t3) {
              n2.push(e3), o3 && o3(t3);
            }).on("error", function(e3) {
              n2 = [], r3(e3);
            }).on("end", function() {
              try {
                var e3 = (function(e4, t3, r4) {
                  switch (e4) {
                    case "blob":
                      return h.newBlob(h.transformTo("arraybuffer", t3), r4);
                    case "base64":
                      return u2.encode(t3);
                    default:
                      return h.transformTo(e4, t3);
                  }
                })(s2, (function(e4, t3) {
                  var r4, n3 = 0, i3 = null, s3 = 0;
                  for (r4 = 0; r4 < t3.length; r4++) s3 += t3[r4].length;
                  switch (e4) {
                    case "string":
                      return t3.join("");
                    case "array":
                      return Array.prototype.concat.apply([], t3);
                    case "uint8array":
                      for (i3 = new Uint8Array(s3), r4 = 0; r4 < t3.length; r4++) i3.set(t3[r4], n3), n3 += t3[r4].length;
                      return i3;
                    case "nodebuffer":
                      return Buffer.concat(t3);
                    default:
                      throw new Error("concat : unsupported type '" + e4 + "'");
                  }
                })(i2, n2), a3);
                t2(e3);
              } catch (e4) {
                r3(e4);
              }
              n2 = [];
            }).resume();
          });
        }
        function f(e2, t2, r3) {
          var n2 = t2;
          switch (t2) {
            case "blob":
            case "arraybuffer":
              n2 = "uint8array";
              break;
            case "base64":
              n2 = "string";
          }
          try {
            this._internalType = n2, this._outputType = t2, this._mimeType = r3, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
          } catch (e3) {
            this._worker = new s("error"), this._worker.error(e3);
          }
        }
        f.prototype = { accumulate: function(e2) {
          return l2(this, e2);
        }, on: function(e2, t2) {
          var r3 = this;
          return "data" === e2 ? this._worker.on(e2, function(e3) {
            t2.call(r3, e3.data, e3.meta);
          }) : this._worker.on(e2, function() {
            h.delay(t2, arguments, r3);
          }), this;
        }, resume: function() {
          return h.delay(this._worker.resume, [], this._worker), this;
        }, pause: function() {
          return this._worker.pause(), this;
        }, toNodejsStream: function(e2) {
          if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType) throw new Error(this._outputType + " is not supported by this method");
          return new o2(this, { objectMode: "nodebuffer" !== this._outputType }, e2);
        } }, t.exports = f;
      }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t, r2) {
        "use strict";
        if (r2.base64 = true, r2.array = true, r2.string = true, r2.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r2.nodebuffer = "undefined" != typeof Buffer, r2.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) r2.blob = false;
        else {
          var n = new ArrayBuffer(0);
          try {
            r2.blob = 0 === new Blob([n], { type: "application/zip" }).size;
          } catch (e2) {
            try {
              var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              i.append(n), r2.blob = 0 === i.getBlob("application/zip").size;
            } catch (e3) {
              r2.blob = false;
            }
          }
        }
        try {
          r2.nodestream = !!e("readable-stream").Readable;
        } catch (e2) {
          r2.nodestream = false;
        }
      }, { "readable-stream": 16 }], 31: [function(e, t, s) {
        "use strict";
        for (var o2 = e("./utils"), h = e("./support"), r2 = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u2 = new Array(256), i = 0; i < 256; i++) u2[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
        u2[254] = u2[254] = 1;
        function a2() {
          n.call(this, "utf-8 decode"), this.leftOver = null;
        }
        function l2() {
          n.call(this, "utf-8 encode");
        }
        s.utf8encode = function(e2) {
          return h.nodebuffer ? r2.newBufferFrom(e2, "utf-8") : (function(e3) {
            var t2, r3, n2, i2, s2, a3 = e3.length, o3 = 0;
            for (i2 = 0; i2 < a3; i2++) 55296 == (64512 & (r3 = e3.charCodeAt(i2))) && i2 + 1 < a3 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r3 = 65536 + (r3 - 55296 << 10) + (n2 - 56320), i2++), o3 += r3 < 128 ? 1 : r3 < 2048 ? 2 : r3 < 65536 ? 3 : 4;
            for (t2 = h.uint8array ? new Uint8Array(o3) : new Array(o3), i2 = s2 = 0; s2 < o3; i2++) 55296 == (64512 & (r3 = e3.charCodeAt(i2))) && i2 + 1 < a3 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r3 = 65536 + (r3 - 55296 << 10) + (n2 - 56320), i2++), r3 < 128 ? t2[s2++] = r3 : (r3 < 2048 ? t2[s2++] = 192 | r3 >>> 6 : (r3 < 65536 ? t2[s2++] = 224 | r3 >>> 12 : (t2[s2++] = 240 | r3 >>> 18, t2[s2++] = 128 | r3 >>> 12 & 63), t2[s2++] = 128 | r3 >>> 6 & 63), t2[s2++] = 128 | 63 & r3);
            return t2;
          })(e2);
        }, s.utf8decode = function(e2) {
          return h.nodebuffer ? o2.transformTo("nodebuffer", e2).toString("utf-8") : (function(e3) {
            var t2, r3, n2, i2, s2 = e3.length, a3 = new Array(2 * s2);
            for (t2 = r3 = 0; t2 < s2; ) if ((n2 = e3[t2++]) < 128) a3[r3++] = n2;
            else if (4 < (i2 = u2[n2])) a3[r3++] = 65533, t2 += i2 - 1;
            else {
              for (n2 &= 2 === i2 ? 31 : 3 === i2 ? 15 : 7; 1 < i2 && t2 < s2; ) n2 = n2 << 6 | 63 & e3[t2++], i2--;
              1 < i2 ? a3[r3++] = 65533 : n2 < 65536 ? a3[r3++] = n2 : (n2 -= 65536, a3[r3++] = 55296 | n2 >> 10 & 1023, a3[r3++] = 56320 | 1023 & n2);
            }
            return a3.length !== r3 && (a3.subarray ? a3 = a3.subarray(0, r3) : a3.length = r3), o2.applyFromCharCode(a3);
          })(e2 = o2.transformTo(h.uint8array ? "uint8array" : "array", e2));
        }, o2.inherits(a2, n), a2.prototype.processChunk = function(e2) {
          var t2 = o2.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
          if (this.leftOver && this.leftOver.length) {
            if (h.uint8array) {
              var r3 = t2;
              (t2 = new Uint8Array(r3.length + this.leftOver.length)).set(this.leftOver, 0), t2.set(r3, this.leftOver.length);
            } else t2 = this.leftOver.concat(t2);
            this.leftOver = null;
          }
          var n2 = (function(e3, t3) {
            var r4;
            for ((t3 = t3 || e3.length) > e3.length && (t3 = e3.length), r4 = t3 - 1; 0 <= r4 && 128 == (192 & e3[r4]); ) r4--;
            return r4 < 0 ? t3 : 0 === r4 ? t3 : r4 + u2[e3[r4]] > t3 ? r4 : t3;
          })(t2), i2 = t2;
          n2 !== t2.length && (h.uint8array ? (i2 = t2.subarray(0, n2), this.leftOver = t2.subarray(n2, t2.length)) : (i2 = t2.slice(0, n2), this.leftOver = t2.slice(n2, t2.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
        }, a2.prototype.flush = function() {
          this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
        }, s.Utf8DecodeWorker = a2, o2.inherits(l2, n), l2.prototype.processChunk = function(e2) {
          this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
        }, s.Utf8EncodeWorker = l2;
      }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t, a2) {
        "use strict";
        var o2 = e("./support"), h = e("./base64"), r2 = e("./nodejsUtils"), u2 = e("./external");
        function n(e2) {
          return e2;
        }
        function l2(e2, t2) {
          for (var r3 = 0; r3 < e2.length; ++r3) t2[r3] = 255 & e2.charCodeAt(r3);
          return t2;
        }
        e("setimmediate"), a2.newBlob = function(t2, r3) {
          a2.checkSupport("blob");
          try {
            return new Blob([t2], { type: r3 });
          } catch (e2) {
            try {
              var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
              return n2.append(t2), n2.getBlob(r3);
            } catch (e3) {
              throw new Error("Bug : can't construct the Blob.");
            }
          }
        };
        var i = { stringifyByChunk: function(e2, t2, r3) {
          var n2 = [], i2 = 0, s2 = e2.length;
          if (s2 <= r3) return String.fromCharCode.apply(null, e2);
          for (; i2 < s2; ) "array" === t2 || "nodebuffer" === t2 ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r3, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r3, s2)))), i2 += r3;
          return n2.join("");
        }, stringifyByChar: function(e2) {
          for (var t2 = "", r3 = 0; r3 < e2.length; r3++) t2 += String.fromCharCode(e2[r3]);
          return t2;
        }, applyCanBeUsed: { uint8array: (function() {
          try {
            return o2.uint8array && 1 === String.fromCharCode.apply(null, new Uint8Array(1)).length;
          } catch (e2) {
            return false;
          }
        })(), nodebuffer: (function() {
          try {
            return o2.nodebuffer && 1 === String.fromCharCode.apply(null, r2.allocBuffer(1)).length;
          } catch (e2) {
            return false;
          }
        })() } };
        function s(e2) {
          var t2 = 65536, r3 = a2.getTypeOf(e2), n2 = true;
          if ("uint8array" === r3 ? n2 = i.applyCanBeUsed.uint8array : "nodebuffer" === r3 && (n2 = i.applyCanBeUsed.nodebuffer), n2) for (; 1 < t2; ) try {
            return i.stringifyByChunk(e2, r3, t2);
          } catch (e3) {
            t2 = Math.floor(t2 / 2);
          }
          return i.stringifyByChar(e2);
        }
        function f(e2, t2) {
          for (var r3 = 0; r3 < e2.length; r3++) t2[r3] = e2[r3];
          return t2;
        }
        a2.applyFromCharCode = s;
        var c = {};
        c.string = { string: n, array: function(e2) {
          return l2(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.string.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return l2(e2, new Uint8Array(e2.length));
        }, nodebuffer: function(e2) {
          return l2(e2, r2.allocBuffer(e2.length));
        } }, c.array = { string: s, array: n, arraybuffer: function(e2) {
          return new Uint8Array(e2).buffer;
        }, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r2.newBufferFrom(e2);
        } }, c.arraybuffer = { string: function(e2) {
          return s(new Uint8Array(e2));
        }, array: function(e2) {
          return f(new Uint8Array(e2), new Array(e2.byteLength));
        }, arraybuffer: n, uint8array: function(e2) {
          return new Uint8Array(e2);
        }, nodebuffer: function(e2) {
          return r2.newBufferFrom(new Uint8Array(e2));
        } }, c.uint8array = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return e2.buffer;
        }, uint8array: n, nodebuffer: function(e2) {
          return r2.newBufferFrom(e2);
        } }, c.nodebuffer = { string: s, array: function(e2) {
          return f(e2, new Array(e2.length));
        }, arraybuffer: function(e2) {
          return c.nodebuffer.uint8array(e2).buffer;
        }, uint8array: function(e2) {
          return f(e2, new Uint8Array(e2.length));
        }, nodebuffer: n }, a2.transformTo = function(e2, t2) {
          if (t2 = t2 || "", !e2) return t2;
          a2.checkSupport(e2);
          var r3 = a2.getTypeOf(t2);
          return c[r3][e2](t2);
        }, a2.resolve = function(e2) {
          for (var t2 = e2.split("/"), r3 = [], n2 = 0; n2 < t2.length; n2++) {
            var i2 = t2[n2];
            "." === i2 || "" === i2 && 0 !== n2 && n2 !== t2.length - 1 || (".." === i2 ? r3.pop() : r3.push(i2));
          }
          return r3.join("/");
        }, a2.getTypeOf = function(e2) {
          return "string" == typeof e2 ? "string" : "[object Array]" === Object.prototype.toString.call(e2) ? "array" : o2.nodebuffer && r2.isBuffer(e2) ? "nodebuffer" : o2.uint8array && e2 instanceof Uint8Array ? "uint8array" : o2.arraybuffer && e2 instanceof ArrayBuffer ? "arraybuffer" : void 0;
        }, a2.checkSupport = function(e2) {
          if (!o2[e2.toLowerCase()]) throw new Error(e2 + " is not supported by this platform");
        }, a2.MAX_VALUE_16BITS = 65535, a2.MAX_VALUE_32BITS = -1, a2.pretty = function(e2) {
          var t2, r3, n2 = "";
          for (r3 = 0; r3 < (e2 || "").length; r3++) n2 += "\\x" + ((t2 = e2.charCodeAt(r3)) < 16 ? "0" : "") + t2.toString(16).toUpperCase();
          return n2;
        }, a2.delay = function(e2, t2, r3) {
          setImmediate(function() {
            e2.apply(r3 || null, t2 || []);
          });
        }, a2.inherits = function(e2, t2) {
          function r3() {
          }
          r3.prototype = t2.prototype, e2.prototype = new r3();
        }, a2.extend = function() {
          var e2, t2, r3 = {};
          for (e2 = 0; e2 < arguments.length; e2++) for (t2 in arguments[e2]) Object.prototype.hasOwnProperty.call(arguments[e2], t2) && void 0 === r3[t2] && (r3[t2] = arguments[e2][t2]);
          return r3;
        }, a2.prepareContent = function(r3, e2, n2, i2, s2) {
          return u2.Promise.resolve(e2).then(function(n3) {
            return o2.blob && (n3 instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3))) && "undefined" != typeof FileReader ? new u2.Promise(function(t2, r4) {
              var e3 = new FileReader();
              e3.onload = function(e4) {
                t2(e4.target.result);
              }, e3.onerror = function(e4) {
                r4(e4.target.error);
              }, e3.readAsArrayBuffer(n3);
            }) : n3;
          }).then(function(e3) {
            var t2 = a2.getTypeOf(e3);
            return t2 ? ("arraybuffer" === t2 ? e3 = a2.transformTo("uint8array", e3) : "string" === t2 && (s2 ? e3 = h.decode(e3) : n2 && true !== i2 && (e3 = (function(e4) {
              return l2(e4, o2.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
            })(e3))), e3) : u2.Promise.reject(new Error("Can't read the data of '" + r3 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
          });
        };
      }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t, r2) {
        "use strict";
        var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a2 = e("./zipEntry"), o2 = e("./support");
        function h(e2) {
          this.files = [], this.loadOptions = e2;
        }
        h.prototype = { checkSignature: function(e2) {
          if (!this.reader.readAndCheckSignature(e2)) {
            this.reader.index -= 4;
            var t2 = this.reader.readString(4);
            throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t2) + ", expected " + i.pretty(e2) + ")");
          }
        }, isSignature: function(e2, t2) {
          var r3 = this.reader.index;
          this.reader.setIndex(e2);
          var n2 = this.reader.readString(4) === t2;
          return this.reader.setIndex(r3), n2;
        }, readBlockEndOfCentral: function() {
          this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
          var e2 = this.reader.readData(this.zipCommentLength), t2 = o2.uint8array ? "uint8array" : "array", r3 = i.transformTo(t2, e2);
          this.zipComment = this.loadOptions.decodeFileName(r3);
        }, readBlockZip64EndOfCentral: function() {
          this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
          for (var e2, t2, r3, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; ) e2 = this.reader.readInt(2), t2 = this.reader.readInt(4), r3 = this.reader.readData(t2), this.zip64ExtensibleData[e2] = { id: e2, length: t2, value: r3 };
        }, readBlockZip64EndOfCentralLocator: function() {
          if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
        }, readLocalFiles: function() {
          var e2, t2;
          for (e2 = 0; e2 < this.files.length; e2++) t2 = this.files[e2], this.reader.setIndex(t2.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t2.readLocalPart(this.reader), t2.handleUTF8(), t2.processAttributes();
        }, readCentralDir: function() {
          var e2;
          for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); ) (e2 = new a2({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
          if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        }, readEndOfCentral: function() {
          var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
          if (e2 < 0) throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
          this.reader.setIndex(e2);
          var t2 = e2;
          if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
            if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
            if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
          }
          var r3 = this.centralDirOffset + this.centralDirSize;
          this.zip64 && (r3 += 20, r3 += 12 + this.zip64EndOfCentralSize);
          var n2 = t2 - r3;
          if (0 < n2) this.isSignature(t2, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
          else if (n2 < 0) throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
        }, prepareReader: function(e2) {
          this.reader = n(e2);
        }, load: function(e2) {
          this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
        } }, t.exports = h;
      }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t, r2) {
        "use strict";
        var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a2 = e("./crc32"), o2 = e("./utf8"), h = e("./compressions"), u2 = e("./support");
        function l2(e2, t2) {
          this.options = e2, this.loadOptions = t2;
        }
        l2.prototype = { isEncrypted: function() {
          return 1 == (1 & this.bitFlag);
        }, useUTF8: function() {
          return 2048 == (2048 & this.bitFlag);
        }, readLocalPart: function(e2) {
          var t2, r3;
          if (e2.skip(22), this.fileNameLength = e2.readInt(2), r3 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r3), -1 === this.compressedSize || -1 === this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
          if (null === (t2 = (function(e3) {
            for (var t3 in h) if (Object.prototype.hasOwnProperty.call(h, t3) && h[t3].magic === e3) return h[t3];
            return null;
          })(this.compressionMethod))) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
          this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t2, e2.readData(this.compressedSize));
        }, readCentralPart: function(e2) {
          this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
          var t2 = e2.readInt(2);
          if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
          e2.skip(t2), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
        }, processAttributes: function() {
          this.unixPermissions = null, this.dosPermissions = null;
          var e2 = this.versionMadeBy >> 8;
          this.dir = !!(16 & this.externalFileAttributes), 0 == e2 && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e2 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = true);
        }, parseZIP64ExtraField: function() {
          if (this.extraFields[1]) {
            var e2 = n(this.extraFields[1].value);
            this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
          }
        }, readExtraFields: function(e2) {
          var t2, r3, n2, i2 = e2.index + this.extraFieldsLength;
          for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; ) t2 = e2.readInt(2), r3 = e2.readInt(2), n2 = e2.readData(r3), this.extraFields[t2] = { id: t2, length: r3, value: n2 };
          e2.setIndex(i2);
        }, handleUTF8: function() {
          var e2 = u2.uint8array ? "uint8array" : "array";
          if (this.useUTF8()) this.fileNameStr = o2.utf8decode(this.fileName), this.fileCommentStr = o2.utf8decode(this.fileComment);
          else {
            var t2 = this.findExtraFieldUnicodePath();
            if (null !== t2) this.fileNameStr = t2;
            else {
              var r3 = s.transformTo(e2, this.fileName);
              this.fileNameStr = this.loadOptions.decodeFileName(r3);
            }
            var n2 = this.findExtraFieldUnicodeComment();
            if (null !== n2) this.fileCommentStr = n2;
            else {
              var i2 = s.transformTo(e2, this.fileComment);
              this.fileCommentStr = this.loadOptions.decodeFileName(i2);
            }
          }
        }, findExtraFieldUnicodePath: function() {
          var e2 = this.extraFields[28789];
          if (e2) {
            var t2 = n(e2.value);
            return 1 !== t2.readInt(1) ? null : a2(this.fileName) !== t2.readInt(4) ? null : o2.utf8decode(t2.readData(e2.length - 5));
          }
          return null;
        }, findExtraFieldUnicodeComment: function() {
          var e2 = this.extraFields[25461];
          if (e2) {
            var t2 = n(e2.value);
            return 1 !== t2.readInt(1) ? null : a2(this.fileComment) !== t2.readInt(4) ? null : o2.utf8decode(t2.readData(e2.length - 5));
          }
          return null;
        } }, t.exports = l2;
      }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t, r2) {
        "use strict";
        function n(e2, t2, r3) {
          this.name = e2, this.dir = r3.dir, this.date = r3.date, this.comment = r3.comment, this.unixPermissions = r3.unixPermissions, this.dosPermissions = r3.dosPermissions, this._data = t2, this._dataBinary = r3.binary, this.options = { compression: r3.compression, compressionOptions: r3.compressionOptions };
        }
        var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a2 = e("./utf8"), o2 = e("./compressedObject"), h = e("./stream/GenericWorker");
        n.prototype = { internalStream: function(e2) {
          var t2 = null, r3 = "string";
          try {
            if (!e2) throw new Error("No output type specified.");
            var n2 = "string" === (r3 = e2.toLowerCase()) || "text" === r3;
            "binarystring" !== r3 && "text" !== r3 || (r3 = "string"), t2 = this._decompressWorker();
            var i2 = !this._dataBinary;
            i2 && !n2 && (t2 = t2.pipe(new a2.Utf8EncodeWorker())), !i2 && n2 && (t2 = t2.pipe(new a2.Utf8DecodeWorker()));
          } catch (e3) {
            (t2 = new h("error")).error(e3);
          }
          return new s(t2, r3, "");
        }, async: function(e2, t2) {
          return this.internalStream(e2).accumulate(t2);
        }, nodeStream: function(e2, t2) {
          return this.internalStream(e2 || "nodebuffer").toNodejsStream(t2);
        }, _compressWorker: function(e2, t2) {
          if (this._data instanceof o2 && this._data.compression.magic === e2.magic) return this._data.getCompressedWorker();
          var r3 = this._decompressWorker();
          return this._dataBinary || (r3 = r3.pipe(new a2.Utf8EncodeWorker())), o2.createWorkerFrom(r3, e2, t2);
        }, _decompressWorker: function() {
          return this._data instanceof o2 ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
        } };
        for (var u2 = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l2 = function() {
          throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
        }, f = 0; f < u2.length; f++) n.prototype[u2[f]] = l2;
        t.exports = n;
      }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l2, t) {
        (function(t2) {
          "use strict";
          var r2, n, e2 = t2.MutationObserver || t2.WebKitMutationObserver;
          if (e2) {
            var i = 0, s = new e2(u2), a2 = t2.document.createTextNode("");
            s.observe(a2, { characterData: true }), r2 = function() {
              a2.data = i = ++i % 2;
            };
          } else if (t2.setImmediate || void 0 === t2.MessageChannel) r2 = "document" in t2 && "onreadystatechange" in t2.document.createElement("script") ? function() {
            var e3 = t2.document.createElement("script");
            e3.onreadystatechange = function() {
              u2(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
            }, t2.document.documentElement.appendChild(e3);
          } : function() {
            setTimeout(u2, 0);
          };
          else {
            var o2 = new t2.MessageChannel();
            o2.port1.onmessage = u2, r2 = function() {
              o2.port2.postMessage(0);
            };
          }
          var h = [];
          function u2() {
            var e3, t3;
            n = true;
            for (var r3 = h.length; r3; ) {
              for (t3 = h, h = [], e3 = -1; ++e3 < r3; ) t3[e3]();
              r3 = h.length;
            }
            n = false;
          }
          l2.exports = function(e3) {
            1 !== h.push(e3) || n || r2();
          };
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}], 37: [function(e, t, r2) {
        "use strict";
        var i = e("immediate");
        function u2() {
        }
        var l2 = {}, s = ["REJECTED"], a2 = ["FULFILLED"], n = ["PENDING"];
        function o2(e2) {
          if ("function" != typeof e2) throw new TypeError("resolver must be a function");
          this.state = n, this.queue = [], this.outcome = void 0, e2 !== u2 && d(this, e2);
        }
        function h(e2, t2, r3) {
          this.promise = e2, "function" == typeof t2 && (this.onFulfilled = t2, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r3 && (this.onRejected = r3, this.callRejected = this.otherCallRejected);
        }
        function f(t2, r3, n2) {
          i(function() {
            var e2;
            try {
              e2 = r3(n2);
            } catch (e3) {
              return l2.reject(t2, e3);
            }
            e2 === t2 ? l2.reject(t2, new TypeError("Cannot resolve promise with itself")) : l2.resolve(t2, e2);
          });
        }
        function c(e2) {
          var t2 = e2 && e2.then;
          if (e2 && ("object" == typeof e2 || "function" == typeof e2) && "function" == typeof t2) return function() {
            t2.apply(e2, arguments);
          };
        }
        function d(t2, e2) {
          var r3 = false;
          function n2(e3) {
            r3 || (r3 = true, l2.reject(t2, e3));
          }
          function i2(e3) {
            r3 || (r3 = true, l2.resolve(t2, e3));
          }
          var s2 = p(function() {
            e2(i2, n2);
          });
          "error" === s2.status && n2(s2.value);
        }
        function p(e2, t2) {
          var r3 = {};
          try {
            r3.value = e2(t2), r3.status = "success";
          } catch (e3) {
            r3.status = "error", r3.value = e3;
          }
          return r3;
        }
        (t.exports = o2).prototype.finally = function(t2) {
          if ("function" != typeof t2) return this;
          var r3 = this.constructor;
          return this.then(function(e2) {
            return r3.resolve(t2()).then(function() {
              return e2;
            });
          }, function(e2) {
            return r3.resolve(t2()).then(function() {
              throw e2;
            });
          });
        }, o2.prototype.catch = function(e2) {
          return this.then(null, e2);
        }, o2.prototype.then = function(e2, t2) {
          if ("function" != typeof e2 && this.state === a2 || "function" != typeof t2 && this.state === s) return this;
          var r3 = new this.constructor(u2);
          this.state !== n ? f(r3, this.state === a2 ? e2 : t2, this.outcome) : this.queue.push(new h(r3, e2, t2));
          return r3;
        }, h.prototype.callFulfilled = function(e2) {
          l2.resolve(this.promise, e2);
        }, h.prototype.otherCallFulfilled = function(e2) {
          f(this.promise, this.onFulfilled, e2);
        }, h.prototype.callRejected = function(e2) {
          l2.reject(this.promise, e2);
        }, h.prototype.otherCallRejected = function(e2) {
          f(this.promise, this.onRejected, e2);
        }, l2.resolve = function(e2, t2) {
          var r3 = p(c, t2);
          if ("error" === r3.status) return l2.reject(e2, r3.value);
          var n2 = r3.value;
          if (n2) d(e2, n2);
          else {
            e2.state = a2, e2.outcome = t2;
            for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; ) e2.queue[i2].callFulfilled(t2);
          }
          return e2;
        }, l2.reject = function(e2, t2) {
          e2.state = s, e2.outcome = t2;
          for (var r3 = -1, n2 = e2.queue.length; ++r3 < n2; ) e2.queue[r3].callRejected(t2);
          return e2;
        }, o2.resolve = function(e2) {
          if (e2 instanceof this) return e2;
          return l2.resolve(new this(u2), e2);
        }, o2.reject = function(e2) {
          var t2 = new this(u2);
          return l2.reject(t2, e2);
        }, o2.all = function(e2) {
          var r3 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
          var n2 = e2.length, i2 = false;
          if (!n2) return this.resolve([]);
          var s2 = new Array(n2), a3 = 0, t2 = -1, o3 = new this(u2);
          for (; ++t2 < n2; ) h2(e2[t2], t2);
          return o3;
          function h2(e3, t3) {
            r3.resolve(e3).then(function(e4) {
              s2[t3] = e4, ++a3 !== n2 || i2 || (i2 = true, l2.resolve(o3, s2));
            }, function(e4) {
              i2 || (i2 = true, l2.reject(o3, e4));
            });
          }
        }, o2.race = function(e2) {
          var t2 = this;
          if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
          var r3 = e2.length, n2 = false;
          if (!r3) return this.resolve([]);
          var i2 = -1, s2 = new this(u2);
          for (; ++i2 < r3; ) a3 = e2[i2], t2.resolve(a3).then(function(e3) {
            n2 || (n2 = true, l2.resolve(s2, e3));
          }, function(e3) {
            n2 || (n2 = true, l2.reject(s2, e3));
          });
          var a3;
          return s2;
        };
      }, { immediate: 36 }], 38: [function(e, t, r2) {
        "use strict";
        var n = {};
        (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
      }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t, r2) {
        "use strict";
        var a2 = e("./zlib/deflate"), o2 = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u2 = Object.prototype.toString, l2 = 0, f = -1, c = 0, d = 8;
        function p(e2) {
          if (!(this instanceof p)) return new p(e2);
          this.options = o2.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
          var t2 = this.options;
          t2.raw && 0 < t2.windowBits ? t2.windowBits = -t2.windowBits : t2.gzip && 0 < t2.windowBits && t2.windowBits < 16 && (t2.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
          var r3 = a2.deflateInit2(this.strm, t2.level, t2.method, t2.windowBits, t2.memLevel, t2.strategy);
          if (r3 !== l2) throw new Error(i[r3]);
          if (t2.header && a2.deflateSetHeader(this.strm, t2.header), t2.dictionary) {
            var n2;
            if (n2 = "string" == typeof t2.dictionary ? h.string2buf(t2.dictionary) : "[object ArrayBuffer]" === u2.call(t2.dictionary) ? new Uint8Array(t2.dictionary) : t2.dictionary, (r3 = a2.deflateSetDictionary(this.strm, n2)) !== l2) throw new Error(i[r3]);
            this._dict_set = true;
          }
        }
        function n(e2, t2) {
          var r3 = new p(t2);
          if (r3.push(e2, true), r3.err) throw r3.msg || i[r3.err];
          return r3.result;
        }
        p.prototype.push = function(e2, t2) {
          var r3, n2, i2 = this.strm, s2 = this.options.chunkSize;
          if (this.ended) return false;
          n2 = t2 === ~~t2 ? t2 : true === t2 ? 4 : 0, "string" == typeof e2 ? i2.input = h.string2buf(e2) : "[object ArrayBuffer]" === u2.call(e2) ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
          do {
            if (0 === i2.avail_out && (i2.output = new o2.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), 1 !== (r3 = a2.deflate(i2, n2)) && r3 !== l2) return this.onEnd(r3), !(this.ended = true);
            0 !== i2.avail_out && (0 !== i2.avail_in || 4 !== n2 && 2 !== n2) || ("string" === this.options.to ? this.onData(h.buf2binstring(o2.shrinkBuf(i2.output, i2.next_out))) : this.onData(o2.shrinkBuf(i2.output, i2.next_out)));
          } while ((0 < i2.avail_in || 0 === i2.avail_out) && 1 !== r3);
          return 4 === n2 ? (r3 = a2.deflateEnd(this.strm), this.onEnd(r3), this.ended = true, r3 === l2) : 2 !== n2 || (this.onEnd(l2), !(i2.avail_out = 0));
        }, p.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, p.prototype.onEnd = function(e2) {
          e2 === l2 && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o2.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r2.Deflate = p, r2.deflate = n, r2.deflateRaw = function(e2, t2) {
          return (t2 = t2 || {}).raw = true, n(e2, t2);
        }, r2.gzip = function(e2, t2) {
          return (t2 = t2 || {}).gzip = true, n(e2, t2);
        };
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t, r2) {
        "use strict";
        var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
        function a2(e2) {
          if (!(this instanceof a2)) return new a2(e2);
          this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
          var t2 = this.options;
          t2.raw && 0 <= t2.windowBits && t2.windowBits < 16 && (t2.windowBits = -t2.windowBits, 0 === t2.windowBits && (t2.windowBits = -15)), !(0 <= t2.windowBits && t2.windowBits < 16) || e2 && e2.windowBits || (t2.windowBits += 32), 15 < t2.windowBits && t2.windowBits < 48 && 0 == (15 & t2.windowBits) && (t2.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
          var r3 = c.inflateInit2(this.strm, t2.windowBits);
          if (r3 !== m.Z_OK) throw new Error(n[r3]);
          this.header = new s(), c.inflateGetHeader(this.strm, this.header);
        }
        function o2(e2, t2) {
          var r3 = new a2(t2);
          if (r3.push(e2, true), r3.err) throw r3.msg || n[r3.err];
          return r3.result;
        }
        a2.prototype.push = function(e2, t2) {
          var r3, n2, i2, s2, a3, o3, h = this.strm, u2 = this.options.chunkSize, l2 = this.options.dictionary, f = false;
          if (this.ended) return false;
          n2 = t2 === ~~t2 ? t2 : true === t2 ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e2 ? h.input = p.binstring2buf(e2) : "[object ArrayBuffer]" === _.call(e2) ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
          do {
            if (0 === h.avail_out && (h.output = new d.Buf8(u2), h.next_out = 0, h.avail_out = u2), (r3 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l2 && (o3 = "string" == typeof l2 ? p.string2buf(l2) : "[object ArrayBuffer]" === _.call(l2) ? new Uint8Array(l2) : l2, r3 = c.inflateSetDictionary(this.strm, o3)), r3 === m.Z_BUF_ERROR && true === f && (r3 = m.Z_OK, f = false), r3 !== m.Z_STREAM_END && r3 !== m.Z_OK) return this.onEnd(r3), !(this.ended = true);
            h.next_out && (0 !== h.avail_out && r3 !== m.Z_STREAM_END && (0 !== h.avail_in || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a3 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u2 - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a3)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = true);
          } while ((0 < h.avail_in || 0 === h.avail_out) && r3 !== m.Z_STREAM_END);
          return r3 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r3 = c.inflateEnd(this.strm), this.onEnd(r3), this.ended = true, r3 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
        }, a2.prototype.onData = function(e2) {
          this.chunks.push(e2);
        }, a2.prototype.onEnd = function(e2) {
          e2 === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
        }, r2.Inflate = a2, r2.inflate = o2, r2.inflateRaw = function(e2, t2) {
          return (t2 = t2 || {}).raw = true, o2(e2, t2);
        }, r2.ungzip = o2;
      }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t, r2) {
        "use strict";
        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
        r2.assign = function(e2) {
          for (var t2 = Array.prototype.slice.call(arguments, 1); t2.length; ) {
            var r3 = t2.shift();
            if (r3) {
              if ("object" != typeof r3) throw new TypeError(r3 + "must be non-object");
              for (var n2 in r3) r3.hasOwnProperty(n2) && (e2[n2] = r3[n2]);
            }
          }
          return e2;
        }, r2.shrinkBuf = function(e2, t2) {
          return e2.length === t2 ? e2 : e2.subarray ? e2.subarray(0, t2) : (e2.length = t2, e2);
        };
        var i = { arraySet: function(e2, t2, r3, n2, i2) {
          if (t2.subarray && e2.subarray) e2.set(t2.subarray(r3, r3 + n2), i2);
          else for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r3 + s2];
        }, flattenChunks: function(e2) {
          var t2, r3, n2, i2, s2, a2;
          for (t2 = n2 = 0, r3 = e2.length; t2 < r3; t2++) n2 += e2[t2].length;
          for (a2 = new Uint8Array(n2), t2 = i2 = 0, r3 = e2.length; t2 < r3; t2++) s2 = e2[t2], a2.set(s2, i2), i2 += s2.length;
          return a2;
        } }, s = { arraySet: function(e2, t2, r3, n2, i2) {
          for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r3 + s2];
        }, flattenChunks: function(e2) {
          return [].concat.apply([], e2);
        } };
        r2.setTyped = function(e2) {
          e2 ? (r2.Buf8 = Uint8Array, r2.Buf16 = Uint16Array, r2.Buf32 = Int32Array, r2.assign(r2, i)) : (r2.Buf8 = Array, r2.Buf16 = Array, r2.Buf32 = Array, r2.assign(r2, s));
        }, r2.setTyped(n);
      }, {}], 42: [function(e, t, r2) {
        "use strict";
        var h = e("./common"), i = true, s = true;
        try {
          String.fromCharCode.apply(null, [0]);
        } catch (e2) {
          i = false;
        }
        try {
          String.fromCharCode.apply(null, new Uint8Array(1));
        } catch (e2) {
          s = false;
        }
        for (var u2 = new h.Buf8(256), n = 0; n < 256; n++) u2[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
        function l2(e2, t2) {
          if (t2 < 65537 && (e2.subarray && s || !e2.subarray && i)) return String.fromCharCode.apply(null, h.shrinkBuf(e2, t2));
          for (var r3 = "", n2 = 0; n2 < t2; n2++) r3 += String.fromCharCode(e2[n2]);
          return r3;
        }
        u2[254] = u2[254] = 1, r2.string2buf = function(e2) {
          var t2, r3, n2, i2, s2, a2 = e2.length, o2 = 0;
          for (i2 = 0; i2 < a2; i2++) 55296 == (64512 & (r3 = e2.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r3 = 65536 + (r3 - 55296 << 10) + (n2 - 56320), i2++), o2 += r3 < 128 ? 1 : r3 < 2048 ? 2 : r3 < 65536 ? 3 : 4;
          for (t2 = new h.Buf8(o2), i2 = s2 = 0; s2 < o2; i2++) 55296 == (64512 & (r3 = e2.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r3 = 65536 + (r3 - 55296 << 10) + (n2 - 56320), i2++), r3 < 128 ? t2[s2++] = r3 : (r3 < 2048 ? t2[s2++] = 192 | r3 >>> 6 : (r3 < 65536 ? t2[s2++] = 224 | r3 >>> 12 : (t2[s2++] = 240 | r3 >>> 18, t2[s2++] = 128 | r3 >>> 12 & 63), t2[s2++] = 128 | r3 >>> 6 & 63), t2[s2++] = 128 | 63 & r3);
          return t2;
        }, r2.buf2binstring = function(e2) {
          return l2(e2, e2.length);
        }, r2.binstring2buf = function(e2) {
          for (var t2 = new h.Buf8(e2.length), r3 = 0, n2 = t2.length; r3 < n2; r3++) t2[r3] = e2.charCodeAt(r3);
          return t2;
        }, r2.buf2string = function(e2, t2) {
          var r3, n2, i2, s2, a2 = t2 || e2.length, o2 = new Array(2 * a2);
          for (r3 = n2 = 0; r3 < a2; ) if ((i2 = e2[r3++]) < 128) o2[n2++] = i2;
          else if (4 < (s2 = u2[i2])) o2[n2++] = 65533, r3 += s2 - 1;
          else {
            for (i2 &= 2 === s2 ? 31 : 3 === s2 ? 15 : 7; 1 < s2 && r3 < a2; ) i2 = i2 << 6 | 63 & e2[r3++], s2--;
            1 < s2 ? o2[n2++] = 65533 : i2 < 65536 ? o2[n2++] = i2 : (i2 -= 65536, o2[n2++] = 55296 | i2 >> 10 & 1023, o2[n2++] = 56320 | 1023 & i2);
          }
          return l2(o2, n2);
        }, r2.utf8border = function(e2, t2) {
          var r3;
          for ((t2 = t2 || e2.length) > e2.length && (t2 = e2.length), r3 = t2 - 1; 0 <= r3 && 128 == (192 & e2[r3]); ) r3--;
          return r3 < 0 ? t2 : 0 === r3 ? t2 : r3 + u2[e2[r3]] > t2 ? r3 : t2;
        };
      }, { "./common": 41 }], 43: [function(e, t, r2) {
        "use strict";
        t.exports = function(e2, t2, r3, n) {
          for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a2 = 0; 0 !== r3; ) {
            for (r3 -= a2 = 2e3 < r3 ? 2e3 : r3; s = s + (i = i + t2[n++] | 0) | 0, --a2; ) ;
            i %= 65521, s %= 65521;
          }
          return i | s << 16 | 0;
        };
      }, {}], 44: [function(e, t, r2) {
        "use strict";
        t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
      }, {}], 45: [function(e, t, r2) {
        "use strict";
        var o2 = (function() {
          for (var e2, t2 = [], r3 = 0; r3 < 256; r3++) {
            e2 = r3;
            for (var n = 0; n < 8; n++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
            t2[r3] = e2;
          }
          return t2;
        })();
        t.exports = function(e2, t2, r3, n) {
          var i = o2, s = n + r3;
          e2 ^= -1;
          for (var a2 = n; a2 < s; a2++) e2 = e2 >>> 8 ^ i[255 & (e2 ^ t2[a2])];
          return -1 ^ e2;
        };
      }, {}], 46: [function(e, t, r2) {
        "use strict";
        var h, c = e("../utils/common"), u2 = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l2 = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a2 = 30, o2 = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
        function R(e2, t2) {
          return e2.msg = n[t2], t2;
        }
        function T(e2) {
          return (e2 << 1) - (4 < e2 ? 9 : 0);
        }
        function D(e2) {
          for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
        }
        function F(e2) {
          var t2 = e2.state, r3 = t2.pending;
          r3 > e2.avail_out && (r3 = e2.avail_out), 0 !== r3 && (c.arraySet(e2.output, t2.pending_buf, t2.pending_out, r3, e2.next_out), e2.next_out += r3, t2.pending_out += r3, e2.total_out += r3, e2.avail_out -= r3, t2.pending -= r3, 0 === t2.pending && (t2.pending_out = 0));
        }
        function N(e2, t2) {
          u2._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t2), e2.block_start = e2.strstart, F(e2.strm);
        }
        function U(e2, t2) {
          e2.pending_buf[e2.pending++] = t2;
        }
        function P(e2, t2) {
          e2.pending_buf[e2.pending++] = t2 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t2;
        }
        function L(e2, t2) {
          var r3, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a3 = e2.prev_length, o3 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u3 = e2.window, l3 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u3[s2 + a3 - 1], p2 = u3[s2 + a3];
          e2.prev_length >= e2.good_match && (i2 >>= 2), o3 > e2.lookahead && (o3 = e2.lookahead);
          do {
            if (u3[(r3 = t2) + a3] === p2 && u3[r3 + a3 - 1] === d2 && u3[r3] === u3[s2] && u3[++r3] === u3[s2 + 1]) {
              s2 += 2, r3++;
              do {
              } while (u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && u3[++s2] === u3[++r3] && s2 < c2);
              if (n2 = S - (c2 - s2), s2 = c2 - S, a3 < n2) {
                if (e2.match_start = t2, o3 <= (a3 = n2)) break;
                d2 = u3[s2 + a3 - 1], p2 = u3[s2 + a3];
              }
            }
          } while ((t2 = f2[t2 & l3]) > h2 && 0 != --i2);
          return a3 <= e2.lookahead ? a3 : e2.lookahead;
        }
        function j(e2) {
          var t2, r3, n2, i2, s2, a3, o3, h2, u3, l3, f2 = e2.w_size;
          do {
            if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
              for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t2 = r3 = e2.hash_size; n2 = e2.head[--t2], e2.head[t2] = f2 <= n2 ? n2 - f2 : 0, --r3; ) ;
              for (t2 = r3 = f2; n2 = e2.prev[--t2], e2.prev[t2] = f2 <= n2 ? n2 - f2 : 0, --r3; ) ;
              i2 += f2;
            }
            if (0 === e2.strm.avail_in) break;
            if (a3 = e2.strm, o3 = e2.window, h2 = e2.strstart + e2.lookahead, u3 = i2, l3 = void 0, l3 = a3.avail_in, u3 < l3 && (l3 = u3), r3 = 0 === l3 ? 0 : (a3.avail_in -= l3, c.arraySet(o3, a3.input, a3.next_in, l3, h2), 1 === a3.state.wrap ? a3.adler = d(a3.adler, o3, l3, h2) : 2 === a3.state.wrap && (a3.adler = p(a3.adler, o3, l3, h2)), a3.next_in += l3, a3.total_in += l3, l3), e2.lookahead += r3, e2.lookahead + e2.insert >= x) for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); ) ;
          } while (e2.lookahead < z && 0 !== e2.strm.avail_in);
        }
        function Z(e2, t2) {
          for (var r3, n2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t2 === l2) return A;
              if (0 === e2.lookahead) break;
            }
            if (r3 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r3 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 !== r3 && e2.strstart - r3 <= e2.w_size - z && (e2.match_length = L(e2, r3)), e2.match_length >= x) if (n2 = u2._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
              for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r3 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, 0 != --e2.match_length; ) ;
              e2.strstart++;
            } else e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
            else n2 = u2._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
            if (n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
          }
          return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function W(e2, t2) {
          for (var r3, n2, i2; ; ) {
            if (e2.lookahead < z) {
              if (j(e2), e2.lookahead < z && t2 === l2) return A;
              if (0 === e2.lookahead) break;
            }
            if (r3 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r3 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, 0 !== r3 && e2.prev_length < e2.max_lazy_match && e2.strstart - r3 <= e2.w_size - z && (e2.match_length = L(e2, r3), e2.match_length <= 5 && (1 === e2.strategy || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
              for (i2 = e2.strstart + e2.lookahead - x, n2 = u2._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r3 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 != --e2.prev_length; ) ;
              if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            } else if (e2.match_available) {
              if ((n2 = u2._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, 0 === e2.strm.avail_out) return A;
            } else e2.match_available = 1, e2.strstart++, e2.lookahead--;
          }
          return e2.match_available && (n2 = u2._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
        }
        function M(e2, t2, r3, n2, i2) {
          this.good_length = e2, this.max_lazy = t2, this.nice_length = r3, this.max_chain = n2, this.func = i2;
        }
        function H() {
          this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a2 + 1)), this.bl_tree = new c.Buf16(2 * (2 * o2 + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
        }
        function G(e2) {
          var t2;
          return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t2 = e2.state).pending = 0, t2.pending_out = 0, t2.wrap < 0 && (t2.wrap = -t2.wrap), t2.status = t2.wrap ? C : E, e2.adler = 2 === t2.wrap ? 0 : 1, t2.last_flush = l2, u2._tr_init(t2), m) : R(e2, _);
        }
        function K(e2) {
          var t2 = G(e2);
          return t2 === m && (function(e3) {
            e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
          })(e2.state), t2;
        }
        function Y(e2, t2, r3, n2, i2, s2) {
          if (!e2) return _;
          var a3 = 1;
          if (t2 === g && (t2 = 6), n2 < 0 ? (a3 = 0, n2 = -n2) : 15 < n2 && (a3 = 2, n2 -= 16), i2 < 1 || y < i2 || r3 !== v || n2 < 8 || 15 < n2 || t2 < 0 || 9 < t2 || s2 < 0 || b < s2) return R(e2, _);
          8 === n2 && (n2 = 9);
          var o3 = new H();
          return (e2.state = o3).strm = e2, o3.wrap = a3, o3.gzhead = null, o3.w_bits = n2, o3.w_size = 1 << o3.w_bits, o3.w_mask = o3.w_size - 1, o3.hash_bits = i2 + 7, o3.hash_size = 1 << o3.hash_bits, o3.hash_mask = o3.hash_size - 1, o3.hash_shift = ~~((o3.hash_bits + x - 1) / x), o3.window = new c.Buf8(2 * o3.w_size), o3.head = new c.Buf16(o3.hash_size), o3.prev = new c.Buf16(o3.w_size), o3.lit_bufsize = 1 << i2 + 6, o3.pending_buf_size = 4 * o3.lit_bufsize, o3.pending_buf = new c.Buf8(o3.pending_buf_size), o3.d_buf = 1 * o3.lit_bufsize, o3.l_buf = 3 * o3.lit_bufsize, o3.level = t2, o3.strategy = s2, o3.method = r3, K(e2);
        }
        h = [new M(0, 0, 0, 0, function(e2, t2) {
          var r3 = 65535;
          for (r3 > e2.pending_buf_size - 5 && (r3 = e2.pending_buf_size - 5); ; ) {
            if (e2.lookahead <= 1) {
              if (j(e2), 0 === e2.lookahead && t2 === l2) return A;
              if (0 === e2.lookahead) break;
            }
            e2.strstart += e2.lookahead, e2.lookahead = 0;
            var n2 = e2.block_start + r3;
            if ((0 === e2.strstart || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), 0 === e2.strm.avail_out)) return A;
            if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), 0 === e2.strm.avail_out)) return A;
          }
          return e2.insert = 0, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
        }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r2.deflateInit = function(e2, t2) {
          return Y(e2, t2, v, 15, 8, 0);
        }, r2.deflateInit2 = Y, r2.deflateReset = K, r2.deflateResetKeep = G, r2.deflateSetHeader = function(e2, t2) {
          return e2 && e2.state ? 2 !== e2.state.wrap ? _ : (e2.state.gzhead = t2, m) : _;
        }, r2.deflate = function(e2, t2) {
          var r3, n2, i2, s2;
          if (!e2 || !e2.state || 5 < t2 || t2 < 0) return e2 ? R(e2, _) : _;
          if (n2 = e2.state, !e2.output || !e2.input && 0 !== e2.avail_in || 666 === n2.status && t2 !== f) return R(e2, 0 === e2.avail_out ? -5 : _);
          if (n2.strm = e2, r3 = n2.last_flush, n2.last_flush = t2, n2.status === C) if (2 === n2.wrap) e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
          else {
            var a3 = v + (n2.w_bits - 8 << 4) << 8;
            a3 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : 6 === n2.level ? 2 : 3) << 6, 0 !== n2.strstart && (a3 |= 32), a3 += 31 - a3 % 31, n2.status = E, P(n2, a3), 0 !== n2.strstart && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
          }
          if (69 === n2.status) if (n2.gzhead.extra) {
            for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); ) U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
          } else n2.status = 73;
          if (73 === n2.status) if (n2.gzhead.name) {
            i2 = n2.pending;
            do {
              if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                s2 = 1;
                break;
              }
              s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
            } while (0 !== s2);
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.gzindex = 0, n2.status = 91);
          } else n2.status = 91;
          if (91 === n2.status) if (n2.gzhead.comment) {
            i2 = n2.pending;
            do {
              if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                s2 = 1;
                break;
              }
              s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
            } while (0 !== s2);
            n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.status = 103);
          } else n2.status = 103;
          if (103 === n2.status && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), 0 !== n2.pending) {
            if (F(e2), 0 === e2.avail_out) return n2.last_flush = -1, m;
          } else if (0 === e2.avail_in && T(t2) <= T(r3) && t2 !== f) return R(e2, -5);
          if (666 === n2.status && 0 !== e2.avail_in) return R(e2, -5);
          if (0 !== e2.avail_in || 0 !== n2.lookahead || t2 !== l2 && 666 !== n2.status) {
            var o3 = 2 === n2.strategy ? (function(e3, t3) {
              for (var r4; ; ) {
                if (0 === e3.lookahead && (j(e3), 0 === e3.lookahead)) {
                  if (t3 === l2) return A;
                  break;
                }
                if (e3.match_length = 0, r4 = u2._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r4 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
              }
              return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            })(n2, t2) : 3 === n2.strategy ? (function(e3, t3) {
              for (var r4, n3, i3, s3, a4 = e3.window; ; ) {
                if (e3.lookahead <= S) {
                  if (j(e3), e3.lookahead <= S && t3 === l2) return A;
                  if (0 === e3.lookahead) break;
                }
                if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a4[i3 = e3.strstart - 1]) === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3]) {
                  s3 = e3.strstart + S;
                  do {
                  } while (n3 === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3] && n3 === a4[++i3] && i3 < s3);
                  e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                }
                if (e3.match_length >= x ? (r4 = u2._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r4 = u2._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r4 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
              }
              return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
            })(n2, t2) : h[n2.level].func(n2, t2);
            if (o3 !== O && o3 !== B || (n2.status = 666), o3 === A || o3 === O) return 0 === e2.avail_out && (n2.last_flush = -1), m;
            if (o3 === I && (1 === t2 ? u2._tr_align(n2) : 5 !== t2 && (u2._tr_stored_block(n2, 0, 0, false), 3 === t2 && (D(n2.head), 0 === n2.lookahead && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), 0 === e2.avail_out)) return n2.last_flush = -1, m;
          }
          return t2 !== f ? m : n2.wrap <= 0 ? 1 : (2 === n2.wrap ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), 0 !== n2.pending ? m : 1);
        }, r2.deflateEnd = function(e2) {
          var t2;
          return e2 && e2.state ? (t2 = e2.state.status) !== C && 69 !== t2 && 73 !== t2 && 91 !== t2 && 103 !== t2 && t2 !== E && 666 !== t2 ? R(e2, _) : (e2.state = null, t2 === E ? R(e2, -3) : m) : _;
        }, r2.deflateSetDictionary = function(e2, t2) {
          var r3, n2, i2, s2, a3, o3, h2, u3, l3 = t2.length;
          if (!e2 || !e2.state) return _;
          if (2 === (s2 = (r3 = e2.state).wrap) || 1 === s2 && r3.status !== C || r3.lookahead) return _;
          for (1 === s2 && (e2.adler = d(e2.adler, t2, l3, 0)), r3.wrap = 0, l3 >= r3.w_size && (0 === s2 && (D(r3.head), r3.strstart = 0, r3.block_start = 0, r3.insert = 0), u3 = new c.Buf8(r3.w_size), c.arraySet(u3, t2, l3 - r3.w_size, r3.w_size, 0), t2 = u3, l3 = r3.w_size), a3 = e2.avail_in, o3 = e2.next_in, h2 = e2.input, e2.avail_in = l3, e2.next_in = 0, e2.input = t2, j(r3); r3.lookahead >= x; ) {
            for (n2 = r3.strstart, i2 = r3.lookahead - (x - 1); r3.ins_h = (r3.ins_h << r3.hash_shift ^ r3.window[n2 + x - 1]) & r3.hash_mask, r3.prev[n2 & r3.w_mask] = r3.head[r3.ins_h], r3.head[r3.ins_h] = n2, n2++, --i2; ) ;
            r3.strstart = n2, r3.lookahead = x - 1, j(r3);
          }
          return r3.strstart += r3.lookahead, r3.block_start = r3.strstart, r3.insert = r3.lookahead, r3.lookahead = 0, r3.match_length = r3.prev_length = x - 1, r3.match_available = 0, e2.next_in = o3, e2.input = h2, e2.avail_in = a3, r3.wrap = s2, m;
        }, r2.deflateInfo = "pako deflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t, r2) {
        "use strict";
        t.exports = function() {
          this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
        };
      }, {}], 48: [function(e, t, r2) {
        "use strict";
        t.exports = function(e2, t2) {
          var r3, n, i, s, a2, o2, h, u2, l2, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
          r3 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a2 = s - (t2 - e2.avail_out), o2 = s + (e2.avail_out - 257), h = r3.dmax, u2 = r3.wsize, l2 = r3.whave, f = r3.wnext, c = r3.window, d = r3.hold, p = r3.bits, m = r3.lencode, _ = r3.distcode, g = (1 << r3.lenbits) - 1, b = (1 << r3.distbits) - 1;
          e: do {
            p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
            t: for (; ; ) {
              if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255)) C[s++] = 65535 & v;
              else {
                if (!(16 & y)) {
                  if (0 == (64 & y)) {
                    v = m[(65535 & v) + (d & (1 << y) - 1)];
                    continue t;
                  }
                  if (32 & y) {
                    r3.mode = 12;
                    break e;
                  }
                  e2.msg = "invalid literal/length code", r3.mode = 30;
                  break e;
                }
                w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                r: for (; ; ) {
                  if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                    if (0 == (64 & y)) {
                      v = _[(65535 & v) + (d & (1 << y) - 1)];
                      continue r;
                    }
                    e2.msg = "invalid distance code", r3.mode = 30;
                    break e;
                  }
                  if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                    e2.msg = "invalid distance too far back", r3.mode = 30;
                    break e;
                  }
                  if (d >>>= y, p -= y, (y = s - a2) < k) {
                    if (l2 < (y = k - y) && r3.sane) {
                      e2.msg = "invalid distance too far back", r3.mode = 30;
                      break e;
                    }
                    if (S = c, (x = 0) === f) {
                      if (x += u2 - y, y < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        x = s - k, S = C;
                      }
                    } else if (f < y) {
                      if (x += u2 + f - y, (y -= f) < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        if (x = 0, f < w) {
                          for (w -= y = f; C[s++] = c[x++], --y; ) ;
                          x = s - k, S = C;
                        }
                      }
                    } else if (x += f - y, y < w) {
                      for (w -= y; C[s++] = c[x++], --y; ) ;
                      x = s - k, S = C;
                    }
                    for (; 2 < w; ) C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                    w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                  } else {
                    for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); ) ;
                    w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                  }
                  break;
                }
              }
              break;
            }
          } while (n < i && s < o2);
          n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o2 ? o2 - s + 257 : 257 - (s - o2), r3.hold = d, r3.bits = p;
        };
      }, {}], 49: [function(e, t, r2) {
        "use strict";
        var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
        function L(e2) {
          return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
        }
        function s() {
          this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
        }
        function a2(e2) {
          var t2;
          return e2 && e2.state ? (t2 = e2.state, e2.total_in = e2.total_out = t2.total = 0, e2.msg = "", t2.wrap && (e2.adler = 1 & t2.wrap), t2.mode = P, t2.last = 0, t2.havedict = 0, t2.dmax = 32768, t2.head = null, t2.hold = 0, t2.bits = 0, t2.lencode = t2.lendyn = new I.Buf32(n), t2.distcode = t2.distdyn = new I.Buf32(i), t2.sane = 1, t2.back = -1, N) : U;
        }
        function o2(e2) {
          var t2;
          return e2 && e2.state ? ((t2 = e2.state).wsize = 0, t2.whave = 0, t2.wnext = 0, a2(e2)) : U;
        }
        function h(e2, t2) {
          var r3, n2;
          return e2 && e2.state ? (n2 = e2.state, t2 < 0 ? (r3 = 0, t2 = -t2) : (r3 = 1 + (t2 >> 4), t2 < 48 && (t2 &= 15)), t2 && (t2 < 8 || 15 < t2) ? U : (null !== n2.window && n2.wbits !== t2 && (n2.window = null), n2.wrap = r3, n2.wbits = t2, o2(e2))) : U;
        }
        function u2(e2, t2) {
          var r3, n2;
          return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r3 = h(e2, t2)) !== N && (e2.state = null), r3) : U;
        }
        var l2, f, c = true;
        function j(e2) {
          if (c) {
            var t2;
            for (l2 = new I.Buf32(512), f = new I.Buf32(32), t2 = 0; t2 < 144; ) e2.lens[t2++] = 8;
            for (; t2 < 256; ) e2.lens[t2++] = 9;
            for (; t2 < 280; ) e2.lens[t2++] = 7;
            for (; t2 < 288; ) e2.lens[t2++] = 8;
            for (T(D, e2.lens, 0, 288, l2, 0, e2.work, { bits: 9 }), t2 = 0; t2 < 32; ) e2.lens[t2++] = 5;
            T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
          }
          e2.lencode = l2, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
        }
        function Z(e2, t2, r3, n2) {
          var i2, s2 = e2.state;
          return null === s2.window && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t2, r3 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t2, r3 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t2, r3 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
        }
        r2.inflateReset = o2, r2.inflateReset2 = h, r2.inflateResetKeep = a2, r2.inflateInit = function(e2) {
          return u2(e2, 15);
        }, r2.inflateInit2 = u2, r2.inflate = function(e2, t2) {
          var r3, n2, i2, s2, a3, o3, h2, u3, l3, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
          if (!e2 || !e2.state || !e2.output || !e2.input && 0 !== e2.avail_in) return U;
          12 === (r3 = e2.state).mode && (r3.mode = 13), a3 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o3 = e2.avail_in, u3 = r3.hold, l3 = r3.bits, f2 = o3, c2 = h2, x = N;
          e: for (; ; ) switch (r3.mode) {
            case P:
              if (0 === r3.wrap) {
                r3.mode = 13;
                break;
              }
              for (; l3 < 16; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              if (2 & r3.wrap && 35615 === u3) {
                E[r3.check = 0] = 255 & u3, E[1] = u3 >>> 8 & 255, r3.check = B(r3.check, E, 2, 0), l3 = u3 = 0, r3.mode = 2;
                break;
              }
              if (r3.flags = 0, r3.head && (r3.head.done = false), !(1 & r3.wrap) || (((255 & u3) << 8) + (u3 >> 8)) % 31) {
                e2.msg = "incorrect header check", r3.mode = 30;
                break;
              }
              if (8 != (15 & u3)) {
                e2.msg = "unknown compression method", r3.mode = 30;
                break;
              }
              if (l3 -= 4, k = 8 + (15 & (u3 >>>= 4)), 0 === r3.wbits) r3.wbits = k;
              else if (k > r3.wbits) {
                e2.msg = "invalid window size", r3.mode = 30;
                break;
              }
              r3.dmax = 1 << k, e2.adler = r3.check = 1, r3.mode = 512 & u3 ? 10 : 12, l3 = u3 = 0;
              break;
            case 2:
              for (; l3 < 16; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              if (r3.flags = u3, 8 != (255 & r3.flags)) {
                e2.msg = "unknown compression method", r3.mode = 30;
                break;
              }
              if (57344 & r3.flags) {
                e2.msg = "unknown header flags set", r3.mode = 30;
                break;
              }
              r3.head && (r3.head.text = u3 >> 8 & 1), 512 & r3.flags && (E[0] = 255 & u3, E[1] = u3 >>> 8 & 255, r3.check = B(r3.check, E, 2, 0)), l3 = u3 = 0, r3.mode = 3;
            case 3:
              for (; l3 < 32; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              r3.head && (r3.head.time = u3), 512 & r3.flags && (E[0] = 255 & u3, E[1] = u3 >>> 8 & 255, E[2] = u3 >>> 16 & 255, E[3] = u3 >>> 24 & 255, r3.check = B(r3.check, E, 4, 0)), l3 = u3 = 0, r3.mode = 4;
            case 4:
              for (; l3 < 16; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              r3.head && (r3.head.xflags = 255 & u3, r3.head.os = u3 >> 8), 512 & r3.flags && (E[0] = 255 & u3, E[1] = u3 >>> 8 & 255, r3.check = B(r3.check, E, 2, 0)), l3 = u3 = 0, r3.mode = 5;
            case 5:
              if (1024 & r3.flags) {
                for (; l3 < 16; ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                r3.length = u3, r3.head && (r3.head.extra_len = u3), 512 & r3.flags && (E[0] = 255 & u3, E[1] = u3 >>> 8 & 255, r3.check = B(r3.check, E, 2, 0)), l3 = u3 = 0;
              } else r3.head && (r3.head.extra = null);
              r3.mode = 6;
            case 6:
              if (1024 & r3.flags && (o3 < (d = r3.length) && (d = o3), d && (r3.head && (k = r3.head.extra_len - r3.length, r3.head.extra || (r3.head.extra = new Array(r3.head.extra_len)), I.arraySet(r3.head.extra, n2, s2, d, k)), 512 & r3.flags && (r3.check = B(r3.check, n2, d, s2)), o3 -= d, s2 += d, r3.length -= d), r3.length)) break e;
              r3.length = 0, r3.mode = 7;
            case 7:
              if (2048 & r3.flags) {
                if (0 === o3) break e;
                for (d = 0; k = n2[s2 + d++], r3.head && k && r3.length < 65536 && (r3.head.name += String.fromCharCode(k)), k && d < o3; ) ;
                if (512 & r3.flags && (r3.check = B(r3.check, n2, d, s2)), o3 -= d, s2 += d, k) break e;
              } else r3.head && (r3.head.name = null);
              r3.length = 0, r3.mode = 8;
            case 8:
              if (4096 & r3.flags) {
                if (0 === o3) break e;
                for (d = 0; k = n2[s2 + d++], r3.head && k && r3.length < 65536 && (r3.head.comment += String.fromCharCode(k)), k && d < o3; ) ;
                if (512 & r3.flags && (r3.check = B(r3.check, n2, d, s2)), o3 -= d, s2 += d, k) break e;
              } else r3.head && (r3.head.comment = null);
              r3.mode = 9;
            case 9:
              if (512 & r3.flags) {
                for (; l3 < 16; ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                if (u3 !== (65535 & r3.check)) {
                  e2.msg = "header crc mismatch", r3.mode = 30;
                  break;
                }
                l3 = u3 = 0;
              }
              r3.head && (r3.head.hcrc = r3.flags >> 9 & 1, r3.head.done = true), e2.adler = r3.check = 0, r3.mode = 12;
              break;
            case 10:
              for (; l3 < 32; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              e2.adler = r3.check = L(u3), l3 = u3 = 0, r3.mode = 11;
            case 11:
              if (0 === r3.havedict) return e2.next_out = a3, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o3, r3.hold = u3, r3.bits = l3, 2;
              e2.adler = r3.check = 1, r3.mode = 12;
            case 12:
              if (5 === t2 || 6 === t2) break e;
            case 13:
              if (r3.last) {
                u3 >>>= 7 & l3, l3 -= 7 & l3, r3.mode = 27;
                break;
              }
              for (; l3 < 3; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              switch (r3.last = 1 & u3, l3 -= 1, 3 & (u3 >>>= 1)) {
                case 0:
                  r3.mode = 14;
                  break;
                case 1:
                  if (j(r3), r3.mode = 20, 6 !== t2) break;
                  u3 >>>= 2, l3 -= 2;
                  break e;
                case 2:
                  r3.mode = 17;
                  break;
                case 3:
                  e2.msg = "invalid block type", r3.mode = 30;
              }
              u3 >>>= 2, l3 -= 2;
              break;
            case 14:
              for (u3 >>>= 7 & l3, l3 -= 7 & l3; l3 < 32; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              if ((65535 & u3) != (u3 >>> 16 ^ 65535)) {
                e2.msg = "invalid stored block lengths", r3.mode = 30;
                break;
              }
              if (r3.length = 65535 & u3, l3 = u3 = 0, r3.mode = 15, 6 === t2) break e;
            case 15:
              r3.mode = 16;
            case 16:
              if (d = r3.length) {
                if (o3 < d && (d = o3), h2 < d && (d = h2), 0 === d) break e;
                I.arraySet(i2, n2, s2, d, a3), o3 -= d, s2 += d, h2 -= d, a3 += d, r3.length -= d;
                break;
              }
              r3.mode = 12;
              break;
            case 17:
              for (; l3 < 14; ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              if (r3.nlen = 257 + (31 & u3), u3 >>>= 5, l3 -= 5, r3.ndist = 1 + (31 & u3), u3 >>>= 5, l3 -= 5, r3.ncode = 4 + (15 & u3), u3 >>>= 4, l3 -= 4, 286 < r3.nlen || 30 < r3.ndist) {
                e2.msg = "too many length or distance symbols", r3.mode = 30;
                break;
              }
              r3.have = 0, r3.mode = 18;
            case 18:
              for (; r3.have < r3.ncode; ) {
                for (; l3 < 3; ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                r3.lens[A[r3.have++]] = 7 & u3, u3 >>>= 3, l3 -= 3;
              }
              for (; r3.have < 19; ) r3.lens[A[r3.have++]] = 0;
              if (r3.lencode = r3.lendyn, r3.lenbits = 7, S = { bits: r3.lenbits }, x = T(0, r3.lens, 0, 19, r3.lencode, 0, r3.work, S), r3.lenbits = S.bits, x) {
                e2.msg = "invalid code lengths set", r3.mode = 30;
                break;
              }
              r3.have = 0, r3.mode = 19;
            case 19:
              for (; r3.have < r3.nlen + r3.ndist; ) {
                for (; g = (C = r3.lencode[u3 & (1 << r3.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l3); ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                if (b < 16) u3 >>>= _, l3 -= _, r3.lens[r3.have++] = b;
                else {
                  if (16 === b) {
                    for (z = _ + 2; l3 < z; ) {
                      if (0 === o3) break e;
                      o3--, u3 += n2[s2++] << l3, l3 += 8;
                    }
                    if (u3 >>>= _, l3 -= _, 0 === r3.have) {
                      e2.msg = "invalid bit length repeat", r3.mode = 30;
                      break;
                    }
                    k = r3.lens[r3.have - 1], d = 3 + (3 & u3), u3 >>>= 2, l3 -= 2;
                  } else if (17 === b) {
                    for (z = _ + 3; l3 < z; ) {
                      if (0 === o3) break e;
                      o3--, u3 += n2[s2++] << l3, l3 += 8;
                    }
                    l3 -= _, k = 0, d = 3 + (7 & (u3 >>>= _)), u3 >>>= 3, l3 -= 3;
                  } else {
                    for (z = _ + 7; l3 < z; ) {
                      if (0 === o3) break e;
                      o3--, u3 += n2[s2++] << l3, l3 += 8;
                    }
                    l3 -= _, k = 0, d = 11 + (127 & (u3 >>>= _)), u3 >>>= 7, l3 -= 7;
                  }
                  if (r3.have + d > r3.nlen + r3.ndist) {
                    e2.msg = "invalid bit length repeat", r3.mode = 30;
                    break;
                  }
                  for (; d--; ) r3.lens[r3.have++] = k;
                }
              }
              if (30 === r3.mode) break;
              if (0 === r3.lens[256]) {
                e2.msg = "invalid code -- missing end-of-block", r3.mode = 30;
                break;
              }
              if (r3.lenbits = 9, S = { bits: r3.lenbits }, x = T(D, r3.lens, 0, r3.nlen, r3.lencode, 0, r3.work, S), r3.lenbits = S.bits, x) {
                e2.msg = "invalid literal/lengths set", r3.mode = 30;
                break;
              }
              if (r3.distbits = 6, r3.distcode = r3.distdyn, S = { bits: r3.distbits }, x = T(F, r3.lens, r3.nlen, r3.ndist, r3.distcode, 0, r3.work, S), r3.distbits = S.bits, x) {
                e2.msg = "invalid distances set", r3.mode = 30;
                break;
              }
              if (r3.mode = 20, 6 === t2) break e;
            case 20:
              r3.mode = 21;
            case 21:
              if (6 <= o3 && 258 <= h2) {
                e2.next_out = a3, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o3, r3.hold = u3, r3.bits = l3, R(e2, c2), a3 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o3 = e2.avail_in, u3 = r3.hold, l3 = r3.bits, 12 === r3.mode && (r3.back = -1);
                break;
              }
              for (r3.back = 0; g = (C = r3.lencode[u3 & (1 << r3.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l3); ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              if (g && 0 == (240 & g)) {
                for (v = _, y = g, w = b; g = (C = r3.lencode[w + ((u3 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l3); ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                u3 >>>= v, l3 -= v, r3.back += v;
              }
              if (u3 >>>= _, l3 -= _, r3.back += _, r3.length = b, 0 === g) {
                r3.mode = 26;
                break;
              }
              if (32 & g) {
                r3.back = -1, r3.mode = 12;
                break;
              }
              if (64 & g) {
                e2.msg = "invalid literal/length code", r3.mode = 30;
                break;
              }
              r3.extra = 15 & g, r3.mode = 22;
            case 22:
              if (r3.extra) {
                for (z = r3.extra; l3 < z; ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                r3.length += u3 & (1 << r3.extra) - 1, u3 >>>= r3.extra, l3 -= r3.extra, r3.back += r3.extra;
              }
              r3.was = r3.length, r3.mode = 23;
            case 23:
              for (; g = (C = r3.distcode[u3 & (1 << r3.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l3); ) {
                if (0 === o3) break e;
                o3--, u3 += n2[s2++] << l3, l3 += 8;
              }
              if (0 == (240 & g)) {
                for (v = _, y = g, w = b; g = (C = r3.distcode[w + ((u3 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l3); ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                u3 >>>= v, l3 -= v, r3.back += v;
              }
              if (u3 >>>= _, l3 -= _, r3.back += _, 64 & g) {
                e2.msg = "invalid distance code", r3.mode = 30;
                break;
              }
              r3.offset = b, r3.extra = 15 & g, r3.mode = 24;
            case 24:
              if (r3.extra) {
                for (z = r3.extra; l3 < z; ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                r3.offset += u3 & (1 << r3.extra) - 1, u3 >>>= r3.extra, l3 -= r3.extra, r3.back += r3.extra;
              }
              if (r3.offset > r3.dmax) {
                e2.msg = "invalid distance too far back", r3.mode = 30;
                break;
              }
              r3.mode = 25;
            case 25:
              if (0 === h2) break e;
              if (d = c2 - h2, r3.offset > d) {
                if ((d = r3.offset - d) > r3.whave && r3.sane) {
                  e2.msg = "invalid distance too far back", r3.mode = 30;
                  break;
                }
                p = d > r3.wnext ? (d -= r3.wnext, r3.wsize - d) : r3.wnext - d, d > r3.length && (d = r3.length), m = r3.window;
              } else m = i2, p = a3 - r3.offset, d = r3.length;
              for (h2 < d && (d = h2), h2 -= d, r3.length -= d; i2[a3++] = m[p++], --d; ) ;
              0 === r3.length && (r3.mode = 21);
              break;
            case 26:
              if (0 === h2) break e;
              i2[a3++] = r3.length, h2--, r3.mode = 21;
              break;
            case 27:
              if (r3.wrap) {
                for (; l3 < 32; ) {
                  if (0 === o3) break e;
                  o3--, u3 |= n2[s2++] << l3, l3 += 8;
                }
                if (c2 -= h2, e2.total_out += c2, r3.total += c2, c2 && (e2.adler = r3.check = r3.flags ? B(r3.check, i2, c2, a3 - c2) : O(r3.check, i2, c2, a3 - c2)), c2 = h2, (r3.flags ? u3 : L(u3)) !== r3.check) {
                  e2.msg = "incorrect data check", r3.mode = 30;
                  break;
                }
                l3 = u3 = 0;
              }
              r3.mode = 28;
            case 28:
              if (r3.wrap && r3.flags) {
                for (; l3 < 32; ) {
                  if (0 === o3) break e;
                  o3--, u3 += n2[s2++] << l3, l3 += 8;
                }
                if (u3 !== (4294967295 & r3.total)) {
                  e2.msg = "incorrect length check", r3.mode = 30;
                  break;
                }
                l3 = u3 = 0;
              }
              r3.mode = 29;
            case 29:
              x = 1;
              break e;
            case 30:
              x = -3;
              break e;
            case 31:
              return -4;
            case 32:
            default:
              return U;
          }
          return e2.next_out = a3, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o3, r3.hold = u3, r3.bits = l3, (r3.wsize || c2 !== e2.avail_out && r3.mode < 30 && (r3.mode < 27 || 4 !== t2)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r3.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r3.total += c2, r3.wrap && c2 && (e2.adler = r3.check = r3.flags ? B(r3.check, i2, c2, e2.next_out - c2) : O(r3.check, i2, c2, e2.next_out - c2)), e2.data_type = r3.bits + (r3.last ? 64 : 0) + (12 === r3.mode ? 128 : 0) + (20 === r3.mode || 15 === r3.mode ? 256 : 0), (0 == f2 && 0 === c2 || 4 === t2) && x === N && (x = -5), x);
        }, r2.inflateEnd = function(e2) {
          if (!e2 || !e2.state) return U;
          var t2 = e2.state;
          return t2.window && (t2.window = null), e2.state = null, N;
        }, r2.inflateGetHeader = function(e2, t2) {
          var r3;
          return e2 && e2.state ? 0 == (2 & (r3 = e2.state).wrap) ? U : ((r3.head = t2).done = false, N) : U;
        }, r2.inflateSetDictionary = function(e2, t2) {
          var r3, n2 = t2.length;
          return e2 && e2.state ? 0 !== (r3 = e2.state).wrap && 11 !== r3.mode ? U : 11 === r3.mode && O(1, t2, n2, 0) !== r3.check ? -3 : Z(e2, t2, n2, n2) ? (r3.mode = 31, -4) : (r3.havedict = 1, N) : U;
        }, r2.inflateInfo = "pako inflate (from Nodeca project)";
      }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t, r2) {
        "use strict";
        var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
        t.exports = function(e2, t2, r3, n, i, s, a2, o2) {
          var h, u2, l2, f, c, d, p, m, _, g = o2.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
          for (b = 0; b <= 15; b++) O[b] = 0;
          for (v = 0; v < n; v++) O[t2[r3 + v]]++;
          for (k = g, w = 15; 1 <= w && 0 === O[w]; w--) ;
          if (w < k && (k = w), 0 === w) return i[s++] = 20971520, i[s++] = 20971520, o2.bits = 1, 0;
          for (y = 1; y < w && 0 === O[y]; y++) ;
          for (k < y && (k = y), b = z = 1; b <= 15; b++) if (z <<= 1, (z -= O[b]) < 0) return -1;
          if (0 < z && (0 === e2 || 1 !== w)) return -1;
          for (B[1] = 0, b = 1; b < 15; b++) B[b + 1] = B[b] + O[b];
          for (v = 0; v < n; v++) 0 !== t2[r3 + v] && (a2[B[t2[r3 + v]]++] = v);
          if (d = 0 === e2 ? (A = R = a2, 19) : 1 === e2 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l2 = -1, f = (C = 1 << (x = k)) - 1, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
          for (; ; ) {
            for (p = b - S, _ = a2[v] < d ? (m = 0, a2[v]) : a2[v] > d ? (m = R[T + a2[v]], A[I + a2[v]]) : (m = 96, 0), h = 1 << b - S, y = u2 = 1 << x; i[c + (E >> S) + (u2 -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u2; ) ;
            for (h = 1 << b - 1; E & h; ) h >>= 1;
            if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
              if (b === w) break;
              b = t2[r3 + a2[v]];
            }
            if (k < b && (E & f) !== l2) {
              for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); ) x++, z <<= 1;
              if (C += 1 << x, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
              i[l2 = E & f] = k << 24 | x << 16 | c - s | 0;
            }
          }
          return 0 !== E && (i[c + E] = b - S << 24 | 64 << 16 | 0), o2.bits = k, 0;
        };
      }, { "../utils/common": 41 }], 51: [function(e, t, r2) {
        "use strict";
        t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
      }, {}], 52: [function(e, t, r2) {
        "use strict";
        var i = e("../utils/common"), o2 = 0, h = 1;
        function n(e2) {
          for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
        }
        var s = 0, a2 = 29, u2 = 256, l2 = u2 + 1 + a2, f = 30, c = 19, _ = 2 * l2 + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l2 + 2));
        n(z);
        var C = new Array(2 * f);
        n(C);
        var E = new Array(512);
        n(E);
        var A = new Array(256);
        n(A);
        var I = new Array(a2);
        n(I);
        var O, B, R, T = new Array(f);
        function D(e2, t2, r3, n2, i2) {
          this.static_tree = e2, this.extra_bits = t2, this.extra_base = r3, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
        }
        function F(e2, t2) {
          this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t2;
        }
        function N(e2) {
          return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
        }
        function U(e2, t2) {
          e2.pending_buf[e2.pending++] = 255 & t2, e2.pending_buf[e2.pending++] = t2 >>> 8 & 255;
        }
        function P(e2, t2, r3) {
          e2.bi_valid > d - r3 ? (e2.bi_buf |= t2 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t2 >> d - e2.bi_valid, e2.bi_valid += r3 - d) : (e2.bi_buf |= t2 << e2.bi_valid & 65535, e2.bi_valid += r3);
        }
        function L(e2, t2, r3) {
          P(e2, r3[2 * t2], r3[2 * t2 + 1]);
        }
        function j(e2, t2) {
          for (var r3 = 0; r3 |= 1 & e2, e2 >>>= 1, r3 <<= 1, 0 < --t2; ) ;
          return r3 >>> 1;
        }
        function Z(e2, t2, r3) {
          var n2, i2, s2 = new Array(g + 1), a3 = 0;
          for (n2 = 1; n2 <= g; n2++) s2[n2] = a3 = a3 + r3[n2 - 1] << 1;
          for (i2 = 0; i2 <= t2; i2++) {
            var o3 = e2[2 * i2 + 1];
            0 !== o3 && (e2[2 * i2] = j(s2[o3]++, o3));
          }
        }
        function W(e2) {
          var t2;
          for (t2 = 0; t2 < l2; t2++) e2.dyn_ltree[2 * t2] = 0;
          for (t2 = 0; t2 < f; t2++) e2.dyn_dtree[2 * t2] = 0;
          for (t2 = 0; t2 < c; t2++) e2.bl_tree[2 * t2] = 0;
          e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
        }
        function M(e2) {
          8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
        }
        function H(e2, t2, r3, n2) {
          var i2 = 2 * t2, s2 = 2 * r3;
          return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t2] <= n2[r3];
        }
        function G(e2, t2, r3) {
          for (var n2 = e2.heap[r3], i2 = r3 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t2, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t2, n2, e2.heap[i2], e2.depth)); ) e2.heap[r3] = e2.heap[i2], r3 = i2, i2 <<= 1;
          e2.heap[r3] = n2;
        }
        function K(e2, t2, r3) {
          var n2, i2, s2, a3, o3 = 0;
          if (0 !== e2.last_lit) for (; n2 = e2.pending_buf[e2.d_buf + 2 * o3] << 8 | e2.pending_buf[e2.d_buf + 2 * o3 + 1], i2 = e2.pending_buf[e2.l_buf + o3], o3++, 0 === n2 ? L(e2, i2, t2) : (L(e2, (s2 = A[i2]) + u2 + 1, t2), 0 !== (a3 = w[s2]) && P(e2, i2 -= I[s2], a3), L(e2, s2 = N(--n2), r3), 0 !== (a3 = k[s2]) && P(e2, n2 -= T[s2], a3)), o3 < e2.last_lit; ) ;
          L(e2, m, t2);
        }
        function Y(e2, t2) {
          var r3, n2, i2, s2 = t2.dyn_tree, a3 = t2.stat_desc.static_tree, o3 = t2.stat_desc.has_stree, h2 = t2.stat_desc.elems, u3 = -1;
          for (e2.heap_len = 0, e2.heap_max = _, r3 = 0; r3 < h2; r3++) 0 !== s2[2 * r3] ? (e2.heap[++e2.heap_len] = u3 = r3, e2.depth[r3] = 0) : s2[2 * r3 + 1] = 0;
          for (; e2.heap_len < 2; ) s2[2 * (i2 = e2.heap[++e2.heap_len] = u3 < 2 ? ++u3 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o3 && (e2.static_len -= a3[2 * i2 + 1]);
          for (t2.max_code = u3, r3 = e2.heap_len >> 1; 1 <= r3; r3--) G(e2, s2, r3);
          for (i2 = h2; r3 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r3, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r3] + s2[2 * n2], e2.depth[i2] = (e2.depth[r3] >= e2.depth[n2] ? e2.depth[r3] : e2.depth[n2]) + 1, s2[2 * r3 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; ) ;
          e2.heap[--e2.heap_max] = e2.heap[1], (function(e3, t3) {
            var r4, n3, i3, s3, a4, o4, h3 = t3.dyn_tree, u4 = t3.max_code, l3 = t3.stat_desc.static_tree, f2 = t3.stat_desc.has_stree, c2 = t3.stat_desc.extra_bits, d2 = t3.stat_desc.extra_base, p2 = t3.stat_desc.max_length, m2 = 0;
            for (s3 = 0; s3 <= g; s3++) e3.bl_count[s3] = 0;
            for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r4 = e3.heap_max + 1; r4 < _; r4++) p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r4]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u4 < n3 || (e3.bl_count[s3]++, a4 = 0, d2 <= n3 && (a4 = c2[n3 - d2]), o4 = h3[2 * n3], e3.opt_len += o4 * (s3 + a4), f2 && (e3.static_len += o4 * (l3[2 * n3 + 1] + a4)));
            if (0 !== m2) {
              do {
                for (s3 = p2 - 1; 0 === e3.bl_count[s3]; ) s3--;
                e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
              } while (0 < m2);
              for (s3 = p2; 0 !== s3; s3--) for (n3 = e3.bl_count[s3]; 0 !== n3; ) u4 < (i3 = e3.heap[--r4]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
            }
          })(e2, t2), Z(s2, u3, e2.bl_count);
        }
        function X(e2, t2, r3) {
          var n2, i2, s2 = -1, a3 = t2[1], o3 = 0, h2 = 7, u3 = 4;
          for (0 === a3 && (h2 = 138, u3 = 3), t2[2 * (r3 + 1) + 1] = 65535, n2 = 0; n2 <= r3; n2++) i2 = a3, a3 = t2[2 * (n2 + 1) + 1], ++o3 < h2 && i2 === a3 || (o3 < u3 ? e2.bl_tree[2 * i2] += o3 : 0 !== i2 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o3 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u3 = (o3 = 0) === a3 ? (h2 = 138, 3) : i2 === a3 ? (h2 = 6, 3) : (h2 = 7, 4));
        }
        function V(e2, t2, r3) {
          var n2, i2, s2 = -1, a3 = t2[1], o3 = 0, h2 = 7, u3 = 4;
          for (0 === a3 && (h2 = 138, u3 = 3), n2 = 0; n2 <= r3; n2++) if (i2 = a3, a3 = t2[2 * (n2 + 1) + 1], !(++o3 < h2 && i2 === a3)) {
            if (o3 < u3) for (; L(e2, i2, e2.bl_tree), 0 != --o3; ) ;
            else 0 !== i2 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o3--), L(e2, b, e2.bl_tree), P(e2, o3 - 3, 2)) : o3 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o3 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o3 - 11, 7));
            s2 = i2, u3 = (o3 = 0) === a3 ? (h2 = 138, 3) : i2 === a3 ? (h2 = 6, 3) : (h2 = 7, 4);
          }
        }
        n(T);
        var q = false;
        function J(e2, t2, r3, n2) {
          P(e2, (s << 1) + (n2 ? 1 : 0), 3), (function(e3, t3, r4, n3) {
            M(e3), n3 && (U(e3, r4), U(e3, ~r4)), i.arraySet(e3.pending_buf, e3.window, t3, r4, e3.pending), e3.pending += r4;
          })(e2, t2, r3, true);
        }
        r2._tr_init = function(e2) {
          q || ((function() {
            var e3, t2, r3, n2, i2, s2 = new Array(g + 1);
            for (n2 = r3 = 0; n2 < a2 - 1; n2++) for (I[n2] = r3, e3 = 0; e3 < 1 << w[n2]; e3++) A[r3++] = n2;
            for (A[r3 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++) for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++) E[i2++] = n2;
            for (i2 >>= 7; n2 < f; n2++) for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++) E[256 + i2++] = n2;
            for (t2 = 0; t2 <= g; t2++) s2[t2] = 0;
            for (e3 = 0; e3 <= 143; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (; e3 <= 255; ) z[2 * e3 + 1] = 9, e3++, s2[9]++;
            for (; e3 <= 279; ) z[2 * e3 + 1] = 7, e3++, s2[7]++;
            for (; e3 <= 287; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
            for (Z(z, l2 + 1, s2), e3 = 0; e3 < f; e3++) C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
            O = new D(z, w, u2 + 1, l2, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
          })(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
        }, r2._tr_stored_block = J, r2._tr_flush_block = function(e2, t2, r3, n2) {
          var i2, s2, a3 = 0;
          0 < e2.level ? (2 === e2.strm.data_type && (e2.strm.data_type = (function(e3) {
            var t3, r4 = 4093624447;
            for (t3 = 0; t3 <= 31; t3++, r4 >>>= 1) if (1 & r4 && 0 !== e3.dyn_ltree[2 * t3]) return o2;
            if (0 !== e3.dyn_ltree[18] || 0 !== e3.dyn_ltree[20] || 0 !== e3.dyn_ltree[26]) return h;
            for (t3 = 32; t3 < u2; t3++) if (0 !== e3.dyn_ltree[2 * t3]) return h;
            return o2;
          })(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a3 = (function(e3) {
            var t3;
            for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t3 = c - 1; 3 <= t3 && 0 === e3.bl_tree[2 * S[t3] + 1]; t3--) ;
            return e3.opt_len += 3 * (t3 + 1) + 5 + 5 + 4, t3;
          })(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r3 + 5, r3 + 4 <= i2 && -1 !== t2 ? J(e2, t2, r3, n2) : 4 === e2.strategy || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), (function(e3, t3, r4, n3) {
            var i3;
            for (P(e3, t3 - 257, 5), P(e3, r4 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++) P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
            V(e3, e3.dyn_ltree, t3 - 1), V(e3, e3.dyn_dtree, r4 - 1);
          })(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a3 + 1), K(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
        }, r2._tr_tally = function(e2, t2, r3) {
          return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t2 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t2, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r3, e2.last_lit++, 0 === t2 ? e2.dyn_ltree[2 * r3]++ : (e2.matches++, t2--, e2.dyn_ltree[2 * (A[r3] + u2 + 1)]++, e2.dyn_dtree[2 * N(t2)]++), e2.last_lit === e2.lit_bufsize - 1;
        }, r2._tr_align = function(e2) {
          P(e2, 2, 3), L(e2, m, z), (function(e3) {
            16 === e3.bi_valid ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
          })(e2);
        };
      }, { "../utils/common": 41 }], 53: [function(e, t, r2) {
        "use strict";
        t.exports = function() {
          this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
        };
      }, {}], 54: [function(e, t, r2) {
        (function(e2) {
          !(function(r3, n) {
            "use strict";
            if (!r3.setImmediate) {
              var i, s, t2, a2, o2 = 1, h = {}, u2 = false, l2 = r3.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r3);
              e3 = e3 && e3.setTimeout ? e3 : r3, i = "[object process]" === {}.toString.call(r3.process) ? function(e4) {
                process.nextTick(function() {
                  c(e4);
                });
              } : (function() {
                if (r3.postMessage && !r3.importScripts) {
                  var e4 = true, t3 = r3.onmessage;
                  return r3.onmessage = function() {
                    e4 = false;
                  }, r3.postMessage("", "*"), r3.onmessage = t3, e4;
                }
              })() ? (a2 = "setImmediate$" + Math.random() + "$", r3.addEventListener ? r3.addEventListener("message", d, false) : r3.attachEvent("onmessage", d), function(e4) {
                r3.postMessage(a2 + e4, "*");
              }) : r3.MessageChannel ? ((t2 = new MessageChannel()).port1.onmessage = function(e4) {
                c(e4.data);
              }, function(e4) {
                t2.port2.postMessage(e4);
              }) : l2 && "onreadystatechange" in l2.createElement("script") ? (s = l2.documentElement, function(e4) {
                var t3 = l2.createElement("script");
                t3.onreadystatechange = function() {
                  c(e4), t3.onreadystatechange = null, s.removeChild(t3), t3 = null;
                }, s.appendChild(t3);
              }) : function(e4) {
                setTimeout(c, 0, e4);
              }, e3.setImmediate = function(e4) {
                "function" != typeof e4 && (e4 = new Function("" + e4));
                for (var t3 = new Array(arguments.length - 1), r4 = 0; r4 < t3.length; r4++) t3[r4] = arguments[r4 + 1];
                var n2 = { callback: e4, args: t3 };
                return h[o2] = n2, i(o2), o2++;
              }, e3.clearImmediate = f;
            }
            function f(e4) {
              delete h[e4];
            }
            function c(e4) {
              if (u2) setTimeout(c, 0, e4);
              else {
                var t3 = h[e4];
                if (t3) {
                  u2 = true;
                  try {
                    !(function(e5) {
                      var t4 = e5.callback, r4 = e5.args;
                      switch (r4.length) {
                        case 0:
                          t4();
                          break;
                        case 1:
                          t4(r4[0]);
                          break;
                        case 2:
                          t4(r4[0], r4[1]);
                          break;
                        case 3:
                          t4(r4[0], r4[1], r4[2]);
                          break;
                        default:
                          t4.apply(n, r4);
                      }
                    })(t3);
                  } finally {
                    f(e4), u2 = false;
                  }
                }
              }
            }
            function d(e4) {
              e4.source === r3 && "string" == typeof e4.data && 0 === e4.data.indexOf(a2) && c(+e4.data.slice(a2.length));
            }
          })("undefined" == typeof self ? void 0 === e2 ? this : e2 : self);
        }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
      }, {}] }, {}, [10])(10);
    });
  }
});

// src/MosaicFile.ts
var import_jszip = __toESM(require_jszip_min(), 1);

// src/MosaicIndexFile.ts
var Convert = class {
  static toMosaicIndexFile(json) {
    return cast(JSON.parse(json), r("MosaicIndexFile"));
  }
  static mosaicIndexFileToJson(value) {
    return JSON.stringify(uncast(value, r("MosaicIndexFile")), null, 2);
  }
};
function invalidValue(typ, val, key, parent = "") {
  const prettyTyp = prettyTypeName(typ);
  const parentText = parent ? ` on ${parent}` : "";
  const keyText = key ? ` for key "${key}"` : "";
  throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}
function prettyTypeName(typ) {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === void 0) {
      return `an optional ${prettyTypeName(typ[1])}`;
    } else {
      return `one of [${typ.map((a2) => {
        return prettyTypeName(a2);
      }).join(", ")}]`;
    }
  } else if (typeof typ === "object" && typ.literal !== void 0) {
    return typ.literal;
  } else {
    return typeof typ;
  }
}
function jsonToJSProps(typ) {
  if (typ.jsonToJS === void 0) {
    const map = {};
    typ.props.forEach((p) => map[p.json] = { key: p.js, typ: p.typ });
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}
function jsToJSONProps(typ) {
  if (typ.jsToJSON === void 0) {
    const map = {};
    typ.props.forEach((p) => map[p.js] = { key: p.json, typ: p.typ });
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}
function transform(val, typ, getProps, key = "", parent = "") {
  function transformPrimitive(typ2, val2) {
    if (typeof typ2 === typeof val2) return val2;
    return invalidValue(typ2, val2, key, parent);
  }
  function transformUnion(typs, val2) {
    const l2 = typs.length;
    for (let i = 0; i < l2; i++) {
      const typ2 = typs[i];
      try {
        return transform(val2, typ2, getProps);
      } catch (_) {
      }
    }
    return invalidValue(typs, val2, key, parent);
  }
  function transformEnum(cases, val2) {
    if (cases.indexOf(val2) !== -1) return val2;
    return invalidValue(cases.map((a2) => {
      return l(a2);
    }), val2, key, parent);
  }
  function transformArray(typ2, val2) {
    if (!Array.isArray(val2)) return invalidValue(l("array"), val2, key, parent);
    return val2.map((el) => transform(el, typ2, getProps));
  }
  function transformDate(val2) {
    if (val2 === null) {
      return null;
    }
    const d = new Date(val2);
    if (isNaN(d.valueOf())) {
      return invalidValue(l("Date"), val2, key, parent);
    }
    return d;
  }
  function transformObject(props, additional, val2) {
    if (val2 === null || typeof val2 !== "object" || Array.isArray(val2)) {
      return invalidValue(l(ref || "object"), val2, key, parent);
    }
    const result = {};
    Object.getOwnPropertyNames(props).forEach((key2) => {
      const prop = props[key2];
      const v = Object.prototype.hasOwnProperty.call(val2, key2) ? val2[key2] : void 0;
      result[prop.key] = transform(v, prop.typ, getProps, key2, ref);
    });
    Object.getOwnPropertyNames(val2).forEach((key2) => {
      if (!Object.prototype.hasOwnProperty.call(props, key2)) {
        result[key2] = transform(val2[key2], additional, getProps, key2, ref);
      }
    });
    return result;
  }
  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val, key, parent);
  }
  if (typ === false) return invalidValue(typ, val, key, parent);
  let ref = void 0;
  while (typeof typ === "object" && typ.ref !== void 0) {
    ref = typ.ref;
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val) : typ.hasOwnProperty("arrayItems") ? transformArray(typ.arrayItems, val) : typ.hasOwnProperty("props") ? transformObject(getProps(typ), typ.additional, val) : invalidValue(typ, val, key, parent);
  }
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}
function cast(val, typ) {
  return transform(val, typ, jsonToJSProps);
}
function uncast(val, typ) {
  return transform(val, typ, jsToJSONProps);
}
function l(typ) {
  return { literal: typ };
}
function a(typ) {
  return { arrayItems: typ };
}
function u(...typs) {
  return { unionMembers: typs };
}
function o(props, additional) {
  return { props, additional };
}
function r(name) {
  return { ref: name };
}
var typeMap = {
  "MosaicIndexFile": o([
    { json: "componentTables", js: "componentTables", typ: a(r("ComponentTableElement")) },
    { json: "header", js: "header", typ: r("MosaicIndexFileHeader") },
    { json: "imports", js: "imports", typ: a(r("ImportElement")) },
    { json: "sections", js: "sections", typ: a(r("SectionElement")) }
  ], false),
  "ComponentTableElement": o([
    { json: "filename", js: "filename", typ: "" },
    { json: "schema", js: "schema", typ: "any" },
    { json: "type", js: "type", typ: r("Type") }
  ], false),
  "MosaicIndexFileHeader": o([
    { json: "MosaicVersion", js: "MosaicVersion", typ: "" }
  ], false),
  "ImportElement": o([
    { json: "integrity", js: "integrity", typ: u(void 0, "") },
    { json: "uri", js: "uri", typ: "" }
  ], false),
  "SectionElement": o([
    { json: "header", js: "header", typ: r("SectionHeader") },
    { json: "nodes", js: "nodes", typ: a(r("NodeElement")) }
  ], false),
  "SectionHeader": o([
    { json: "application", js: "application", typ: "" },
    { json: "author", js: "author", typ: "" },
    { json: "dataVersion", js: "dataVersion", typ: "" },
    { json: "id", js: "id", typ: "" },
    { json: "message", js: "message", typ: "" },
    { json: "timestamp", js: "timestamp", typ: "" }
  ], false),
  "NodeElement": o([
    { json: "components", js: "components", typ: u(void 0, a(r("ComponentElement"))) },
    { json: "id", js: "id", typ: "" }
  ], false),
  "ComponentElement": o([
    { json: "id", js: "id", typ: "" },
    { json: "index", js: "index", typ: u(void 0, 0) },
    { json: "operation", js: "operation", typ: u(void 0, r("Operation")) },
    { json: "type", js: "type", typ: "" }
  ], false),
  "Type": [
    "NDJSON",
    "PARQUET"
  ],
  "Operation": [
    "DELETE",
    "PASS_THROUGH",
    "VALUE"
  ]
};

// src/MosaicFile.ts
async function LoadMosaicFile(bytes) {
  const zip = new import_jszip.default();
  let output = await zip.loadAsync(bytes);
  let files = /* @__PURE__ */ new Map();
  for (let key in output.files) {
    let file = output.files[key];
    if (!file) continue;
    let arr2 = await file.async("uint8array");
    let name = key;
    files.set(name, arr2);
  }
  let mosaicFile = new MosaicFile();
  let arr = files.get("index.json");
  if (!arr) throw new Error(`No index file`);
  const decoder = new TextDecoder("utf-8");
  const str = decoder.decode(arr);
  mosaicFile.index = Convert.toMosaicIndexFile(str);
  for (let [filename, bytes2] of files) {
    if (filename.endsWith(".ndjson")) {
      let type = filename.replace(".ndjson", "");
      const decoder2 = new TextDecoder("utf-8");
      const str2 = decoder2.decode(bytes2);
      mosaicFile.serializedComponents.set(type, str2.split("\n"));
    }
  }
  return mosaicFile;
}
var MosaicFile = class {
  index;
  serializedComponents;
  constructor() {
    this.serializedComponents = /* @__PURE__ */ new Map();
    this.index = {
      header: {
        MosaicVersion: "post-alpha"
      },
      sections: [],
      imports: [],
      componentTables: []
    };
  }
  AddImport(imp) {
    this.index.imports.push(imp);
  }
  AddSection(section) {
    this.index.sections.push(section);
  }
  GetSerializedComponentsArray(identity) {
    if (!this.serializedComponents.has(identity.typeID)) {
      this.serializedComponents.set(identity.typeID, []);
      this.index.componentTables.push({
        type: "NDJSON" /* Ndjson */,
        filename: `${identity.typeID}.ndjson`,
        schema: JSON.parse(identity.originSchemaSrc)
      });
    }
    return this.serializedComponents.get(identity.typeID);
  }
  AddComponent(id, component) {
    let arr = this.GetSerializedComponentsArray(id);
    let index = arr.length;
    let indentedStr = id.toJSONString(component);
    arr.push(JSON.stringify(JSON.parse(indentedStr)));
    return index;
  }
  ReadComponent(id, index) {
    let arr = this.GetSerializedComponentsArray(id);
    let component = arr[index];
    if (component === void 0) {
      throw new Error(`No component with index ${index}`);
    }
    return id.fromJSONString(component);
  }
  addSerializedComponent(typeID, data) {
    if (!this.serializedComponents.has(typeID)) {
      this.serializedComponents.set(typeID, []);
    }
    const arr = this.serializedComponents.get(typeID);
    const index = arr.length;
    arr.push(data);
    return index;
  }
  readRawComponent(typeID, index) {
    const component = this.serializedComponents.get(typeID)?.[index];
    if (component === void 0) {
      throw new Error(`No component with index ${index}`);
    }
    return component;
  }
};

// src/ComponentReference.ts
var NO_COMPONENT_INDEX = -1;
function indexOf(reference) {
  return reference.index ?? NO_COMPONENT_INDEX;
}
function operationOf(reference) {
  return reference.operation ?? "VALUE" /* Value */;
}
function hasValue(reference) {
  return indexOf(reference) >= 0;
}

// src/MosaicFileOperations.ts
function mergeComponents(oldList, newList) {
  const positions = /* @__PURE__ */ new Map();
  for (const [index, existing] of oldList.entries()) {
    if (!positions.has(existing.id)) positions.set(existing.id, index);
  }
  const removed = /* @__PURE__ */ new Set();
  for (const item of newList) {
    const at = positions.get(item.id);
    const operation = operationOf(item);
    if (at === void 0) {
      if (operation === "VALUE" /* Value */) {
        positions.set(item.id, oldList.length);
        oldList.push({ ...item });
      }
    } else if (operation === "DELETE" /* Delete */) {
      removed.add(at);
      positions.delete(item.id);
    } else if (operation === "VALUE" /* Value */) {
      oldList[at] = { ...item };
    }
  }
  if (removed.size > 0) {
    let write = 0;
    for (let read = 0; read < oldList.length; read++) {
      if (!removed.has(read)) oldList[write++] = oldList[read];
    }
    oldList.length = write;
  }
  return oldList;
}
function merge(oldNode, newNode) {
  mergeComponents(oldNode.components ??= [], newNode.components ?? []);
}
function collapseNodesByPath(file) {
  const nodes = /* @__PURE__ */ new Map();
  for (const sec of file.index.sections) {
    for (const node of sec.nodes) {
      if (!nodes.has(node.id)) {
        nodes.set(node.id, { id: node.id, components: [] });
      }
      merge(nodes.get(node.id), node);
    }
  }
  return nodes;
}
function federate(oldFile, newFile, keepHistory) {
  const result = new MosaicFile();
  result.index.header = newFile.index.header;
  result.index.imports = newFile.index.imports;
  result.index.componentTables = [...oldFile.index.componentTables, ...newFile.index.componentTables];
  if (keepHistory) {
    for (const sec of oldFile.index.sections) {
      result.AddSection(sec);
    }
    for (const [typeID, components] of oldFile.serializedComponents) {
      for (const component of components) {
        result.addSerializedComponent(typeID, component);
      }
    }
    for (const sec of newFile.index.sections) {
      const newSection = { header: sec.header, nodes: [] };
      for (const node of sec.nodes) {
        const newNode = {
          id: node.id,
          components: []
        };
        for (const componentRef of node.components ?? []) {
          if (!hasValue(componentRef)) {
            newNode.components.push({ ...componentRef });
            continue;
          }
          const component = newFile.readRawComponent(componentRef.type, indexOf(componentRef));
          const newIndex = result.addSerializedComponent(componentRef.type, component);
          newNode.components.push({ ...componentRef, index: newIndex });
        }
        newSection.nodes.push(newNode);
      }
      result.AddSection(newSection);
    }
  } else {
    const pathToNodes = /* @__PURE__ */ new Map();
    for (const sec of oldFile.index.sections) {
      for (const node of sec.nodes) {
        if (!pathToNodes.has(node.id)) pathToNodes.set(node.id, []);
        pathToNodes.get(node.id).push({ fromNew: false, header: sec.header, node });
      }
    }
    for (const sec of newFile.index.sections) {
      for (const node of sec.nodes) {
        if (!pathToNodes.has(node.id)) pathToNodes.set(node.id, []);
        pathToNodes.get(node.id).push({ fromNew: true, header: sec.header, node });
      }
    }
    const idToSection = /* @__PURE__ */ new Map();
    for (const [, lineages] of pathToNodes) {
      const allComponents = [];
      for (let i = lineages.length - 1; i >= 0; i--) {
        const { fromNew, header, node } = lineages[i];
        const resultNode = { id: node.id, components: [] };
        for (const componentRef of node.components ?? []) {
          if (!allComponents.includes(componentRef.id)) {
            if (operationOf(componentRef) !== "PASS_THROUGH" /* PassThrough */) {
              if (operationOf(componentRef) === "VALUE" /* Value */ && hasValue(componentRef)) {
                const sourceFile = fromNew ? newFile : oldFile;
                const component = sourceFile.readRawComponent(componentRef.type, indexOf(componentRef));
                const newIndex = result.addSerializedComponent(componentRef.type, component);
                resultNode.components.push({ ...componentRef, index: newIndex });
              } else {
                resultNode.components.push(componentRef);
              }
            }
            allComponents.push(componentRef.id);
          }
        }
        if (!idToSection.has(header.id)) {
          idToSection.set(header.id, { header, nodes: [] });
        }
        idToSection.get(header.id).nodes.push(resultNode);
      }
    }
    for (const [, sec] of idToSection) {
      sec.nodes = sec.nodes.filter(
        (n) => (n.components?.length ?? 0) > 0
      );
      if (sec.nodes.length > 0) {
        result.AddSection(sec);
      }
    }
  }
  return result;
}

// src/core/schemas/child.schema.json
var child_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "core::child",
  title: "Child",
  description: "A parent-child link. The component carries no value: the reference's name is the id of the child node, so one node can hold many children and a later section can remove one with a DELETE on that name.",
  type: "object",
  additionalProperties: false,
  properties: {}
};

// src/core/schemas/name.schema.json
var name_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "core::name",
  title: "Name",
  description: "A human-readable name for the node. The component carries no value: the name of the reference is the name, the way a core::child reference names its child. A node may carry several, and a later section can drop one with a DELETE on that name.",
  type: "object",
  additionalProperties: false,
  properties: {}
};

// src/core/schemas/transform.schema.json
var transform_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "core::transform",
  title: "Transform",
  description: "The local transform of a node, as a translation/rotation/scale or as a matrix. The field names and defaults follow the glTF 2.0 node schema, but a transform is not specific to glTF, so it lives in the core namespace.",
  type: "object",
  additionalProperties: false,
  properties: {
    matrix: {
      type: "array",
      items: {
        type: "number"
      },
      minItems: 16,
      maxItems: 16,
      default: [
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1
      ],
      description: "A floating-point 4x4 transformation matrix stored in column-major order."
    },
    translation: {
      type: "array",
      items: {
        type: "number"
      },
      minItems: 3,
      maxItems: 3,
      default: [
        0,
        0,
        0
      ]
    },
    rotation: {
      type: "array",
      items: {
        type: "number",
        minimum: -1,
        maximum: 1
      },
      minItems: 4,
      maxItems: 4,
      default: [
        0,
        0,
        0,
        1
      ],
      description: "The node's unit quaternion rotation in the order (x, y, z, w), where w is the scalar."
    },
    scale: {
      type: "array",
      items: {
        type: "number"
      },
      minItems: 3,
      maxItems: 3,
      default: [
        1,
        1,
        1
      ]
    }
  }
};

// src/core/schemas/inherit.schema.json
var inherit_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "core::inherit",
  title: "Inherit",
  description: "An is-a link. The component carries no value: the name of the reference is the id of the node to inherit from, the way a core::child reference names its child. Composing gives the node every component of the node it inherits, except where it carries one under the same reference id, which wins. A node may inherit from several nodes, and from a node that itself inherits.",
  type: "object",
  additionalProperties: false,
  properties: {}
};

// src/core/schemas/edges.schema.json
var edges_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "core::edges",
  title: "Edges",
  description: "Whether the edges of a node's geometry are worth drawing. A drawing of a building wants the line where two faces meet at an angle -- a corner, a reveal, the lip of a slab -- because that is what makes it readable. A tree or a scanned prop does not: its faces meet at an angle everywhere, so every leaf earns a line and the result is a black smudge. Left off, edges are drawn. Set false on a node and nothing beneath it is edged either, so one component covers a whole model.",
  type: "object",
  additionalProperties: false,
  properties: {
    draw: {
      type: "boolean",
      default: true,
      description: "False to leave this node and everything under it unedged."
    }
  }
};

// src/core/schemas.ts
var CORE_TYPE = {
  /**
   * A parent-child link. The component has no value; the *name* of the reference is the
   * id of the child node, which lets one node carry many children and lets a later
   * section drop a single link with a DELETE on that name.
   */
  child: "core::child",
  /**
   * A human-readable name for a node, such as the one its source file gave it. Like
   * core::child, the component has no value; the *name* of the reference is the name.
   */
  name: "core::name",
  /**
   * The local transform of a node. Its shape follows the glTF node transform, but a
   * transform is not specific to glTF, so it belongs to the core namespace.
   */
  transform: "core::transform",
  /**
   * An is-a link. The component has no value; the *name* of the reference is the id of
   * the node to inherit from. Composing copies that node's components onto this one,
   * with this node's own components winning any clash.
   */
  inherit: "core::inherit",
  /**
   * Whether the edges of this node's geometry are drawn. A building reads by its edges
   * and a tree does not: every leaf meets its neighbour at an angle, so edging one draws
   * a black smudge. Absent, edges are drawn; false covers everything beneath the node.
   */
  edges: "core::edges"
};
var CORE_SCHEMAS = {
  [CORE_TYPE.child]: child_schema_default,
  [CORE_TYPE.name]: name_schema_default,
  [CORE_TYPE.transform]: transform_schema_default,
  [CORE_TYPE.inherit]: inherit_schema_default,
  [CORE_TYPE.edges]: edges_schema_default
};

// src/composition/Inheritance.ts
function resolveInheritance(nodes, warnings = []) {
  const resolved = /* @__PURE__ */ new Map();
  const resolving = [];
  function componentsOf2(id) {
    const done = resolved.get(id);
    if (done) return done;
    const loop = resolving.indexOf(id);
    if (loop !== -1) {
      throw new Error(`Inheritance forms a cycle: ${[...resolving.slice(loop), id].join(" -> ")}`);
    }
    const node = nodes.get(id);
    if (!node) return [];
    resolving.push(id);
    const own = node.components ?? [];
    const merged = [...own];
    const taken = new Set(own.map((ref) => ref.id));
    for (const link of own.filter((ref) => ref.type === CORE_TYPE.inherit)) {
      if (link.id === id) {
        warnings.push(`node ${id} inherits from itself; the link was ignored`);
        continue;
      }
      if (!nodes.has(link.id)) {
        warnings.push(`node ${id} inherits from ${link.id}, but no such node is present`);
        continue;
      }
      for (const inherited of componentsOf2(link.id)) {
        if (taken.has(inherited.id)) continue;
        merged.push({ ...inherited });
        taken.add(inherited.id);
      }
    }
    resolving.pop();
    resolved.set(id, merged);
    return merged;
  }
  const out = /* @__PURE__ */ new Map();
  for (const [id, node] of nodes) {
    const components = componentsOf2(id);
    out.set(id, components.length > 0 ? { ...node, components } : { ...node });
  }
  return out;
}

// src/Selection.ts
var UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function referencedIds(value, into) {
  if (typeof value === "string") {
    if (UUID.test(value)) into.add(value);
    return;
  }
  if (Array.isArray(value)) return value.forEach((entry) => referencedIds(entry, into));
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) referencedIds(entry, into);
  }
}
function selectNodes(source2, request) {
  const collapsed = collapseNodesByPath(source2);
  const wanted = request.componentTypes && request.componentTypes.length > 0 ? new Set(request.componentTypes) : void 0;
  const missing = request.nodes.filter((id) => !collapsed.has(id));
  const chosen = [];
  const seen = /* @__PURE__ */ new Set();
  const take = (id) => {
    if (seen.has(id) || !collapsed.has(id)) return;
    seen.add(id);
    chosen.push(id);
  };
  for (const id of request.nodes) take(id);
  if (request.includeChildren) {
    for (let at = 0; at < chosen.length; at++) {
      const node = collapsed.get(chosen[at]);
      for (const reference of node.components ?? []) {
        if (reference.type === CORE_TYPE.child) take(reference.id);
      }
    }
  }
  const ancestors = /* @__PURE__ */ new Set();
  if (request.compose) {
    for (let at = 0; at < chosen.length; at++) {
      const node = collapsed.get(chosen[at]);
      for (const reference of node.components ?? []) {
        if (reference.type !== CORE_TYPE.inherit || seen.has(reference.id)) continue;
        take(reference.id);
        if (seen.has(reference.id)) ancestors.add(reference.id);
      }
    }
  }
  const keptComponents = (node, filtered) => (node.components ?? []).filter((reference) => {
    if (!filtered || !wanted) return true;
    if (request.includeChildren && reference.type === CORE_TYPE.child) return true;
    return wanted.has(reference.type);
  });
  const asked2 = new Set(chosen);
  const pulledIn = [];
  for (let at = 0; at < chosen.length; at++) {
    const id = chosen[at];
    const node = collapsed.get(id);
    const references = /* @__PURE__ */ new Set();
    for (const reference of keptComponents(node, asked2.has(id))) {
      if (!hasValue(reference)) continue;
      try {
        referencedIds(JSON.parse(source2.readRawComponent(reference.type, indexOf(reference))), references);
      } catch {
      }
    }
    for (const referenced of references) {
      if (seen.has(referenced) || !collapsed.has(referenced)) continue;
      take(referenced);
      pulledIn.push(referenced);
    }
  }
  const file = new MosaicFile();
  file.index.header = { ...source2.index.header };
  const schemas = new Map(source2.index.componentTables.map((table) => [table.filename.replace(/\.ndjson$/i, ""), table]));
  const usedTypes = /* @__PURE__ */ new Set();
  const nodes = [];
  for (const id of chosen) {
    const node = collapsed.get(id);
    const components = [];
    for (const reference of keptComponents(node, asked2.has(id))) {
      usedTypes.add(reference.type);
      if (!hasValue(reference)) {
        components.push({ ...reference });
        continue;
      }
      const row = source2.readRawComponent(reference.type, indexOf(reference));
      components.push({ ...reference, index: file.addSerializedComponent(reference.type, row) });
    }
    nodes.push({ id, components });
  }
  for (const type of [...usedTypes].sort()) {
    const table = schemas.get(type);
    file.index.componentTables.push({
      filename: `${type}.ndjson`,
      type: table?.type ?? source2.index.componentTables[0]?.type ?? "NDJSON",
      schema: table?.schema ?? {}
    });
  }
  const provenance = source2.index.sections.at(-1)?.header;
  file.index.sections.push({
    header: {
      id: provenance?.id ?? "selection",
      message: `A selection of ${nodes.length} node(s)`,
      dataVersion: provenance?.dataVersion ?? "1.0.0",
      author: provenance?.author ?? "",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      application: "mosaic"
    },
    nodes
  });
  if (request.compose) {
    composeInPlace(file, ancestors);
    return {
      file,
      nodeIds: chosen.filter((id) => !ancestors.has(id)),
      missing,
      pulledIn: pulledIn.filter((id) => !ancestors.has(id))
    };
  }
  return { file, nodeIds: chosen, missing, pulledIn };
}
function composeInPlace(file, ancestors = /* @__PURE__ */ new Set()) {
  const section = file.index.sections[0];
  if (!section) return;
  const resolved = resolveInheritance(new Map(section.nodes.map((node) => [node.id, node])));
  section.nodes = section.nodes.map((node) => resolved.get(node.id) ?? node).filter((node) => !ancestors.has(node.id));
}

// src/gltf/schemas/buffer.schema.json
var buffer_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::buffer",
  title: "Buffer",
  description: "A buffer points to binary geometry, animation, or skins. Derived from the glTF 2.0 buffer schema. Indices refer to component rows in the matching Mosaic component table rather than to a glTF array.",
  type: "object",
  additionalProperties: false,
  properties: {
    uri: {
      type: "string",
      description: "The URI of the buffer, or a data: URI holding it inline."
    },
    byteLength: {
      type: "integer",
      minimum: 1,
      description: "The length of the buffer in bytes."
    },
    name: {
      type: "string"
    }
  },
  required: [
    "byteLength"
  ]
};

// src/gltf/schemas/bufferView.schema.json
var bufferView_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::bufferView",
  title: "BufferView",
  description: "A view into a buffer, generally representing a subset of the buffer. Derived from the glTF 2.0 bufferView schema, except that glTF's integer ids are replaced by the id of the Mosaic node carrying the referenced component, so a reference survives any change to component ordering.",
  type: "object",
  additionalProperties: false,
  properties: {
    buffer: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the buffer component."
    },
    byteOffset: {
      type: "integer",
      minimum: 0,
      default: 0
    },
    byteLength: {
      type: "integer",
      minimum: 1
    },
    byteStride: {
      type: "integer",
      minimum: 4,
      maximum: 252,
      multipleOf: 4
    },
    target: {
      type: "integer",
      enum: [
        34962,
        34963
      ],
      description: "The hint representing the intended GPU buffer type: 34962 ARRAY_BUFFER, 34963 ELEMENT_ARRAY_BUFFER."
    },
    name: {
      type: "string"
    }
  },
  required: [
    "buffer",
    "byteLength"
  ]
};

// src/gltf/schemas/accessor.schema.json
var accessor_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::accessor",
  title: "Accessor",
  description: "A typed view into a bufferView that contains raw binary data. Derived from the glTF 2.0 accessor schema, except that glTF's integer ids are replaced by the id of the Mosaic node carrying the referenced component, so a reference survives any change to component ordering.",
  type: "object",
  additionalProperties: false,
  properties: {
    bufferView: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the bufferView component."
    },
    byteOffset: {
      type: "integer",
      minimum: 0,
      default: 0
    },
    componentType: {
      type: "integer",
      enum: [
        5120,
        5121,
        5122,
        5123,
        5125,
        5126
      ],
      description: "The datatype of the accessor's components: 5120 BYTE, 5121 UNSIGNED_BYTE, 5122 SHORT, 5123 UNSIGNED_SHORT, 5125 UNSIGNED_INT, 5126 FLOAT."
    },
    normalized: {
      type: "boolean",
      default: false
    },
    count: {
      type: "integer",
      minimum: 1,
      description: "The number of elements referenced by this accessor."
    },
    type: {
      type: "string",
      enum: [
        "SCALAR",
        "VEC2",
        "VEC3",
        "VEC4",
        "MAT2",
        "MAT3",
        "MAT4"
      ],
      description: "Specifies if the accessor's elements are scalars, vectors, or matrices."
    },
    max: {
      type: "array",
      items: {
        type: "number"
      },
      minItems: 1,
      maxItems: 16
    },
    min: {
      type: "array",
      items: {
        type: "number"
      },
      minItems: 1,
      maxItems: 16
    },
    name: {
      type: "string"
    }
  },
  required: [
    "componentType",
    "count",
    "type"
  ]
};

// src/gltf/schemas/meshPrimitive.schema.json
var meshPrimitive_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::meshPrimitive",
  title: "MeshPrimitive",
  description: "Geometry to be rendered with the given material. Derived from the glTF 2.0 mesh.primitive schema, except that glTF's integer ids are replaced by the id of the Mosaic node carrying the referenced component, so a reference survives any change to component ordering.",
  type: "object",
  additionalProperties: false,
  properties: {
    attributes: {
      type: "object",
      minProperties: 1,
      additionalProperties: {
        type: "string",
        format: "uuid",
        pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        description: "The id of the Mosaic node carrying the accessor component for this attribute."
      },
      description: "Each key is a mesh attribute semantic (POSITION, NORMAL, ...) and each value the id of the Mosaic node carrying the accessor component holding it."
    },
    indices: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the accessor component with the vertex indices."
    },
    material: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the material component to apply when rendering."
    },
    mode: {
      type: "integer",
      enum: [
        0,
        1,
        2,
        3,
        4,
        5,
        6
      ],
      default: 4,
      description: "The topology type: 0 POINTS, 1 LINES, 2 LINE_LOOP, 3 LINE_STRIP, 4 TRIANGLES, 5 TRIANGLE_STRIP, 6 TRIANGLE_FAN."
    },
    name: {
      type: "string",
      description: "The name of the glTF mesh this primitive belonged to. Primitives of one mesh share it, and composing back to glTF regroups them under it."
    }
  },
  required: [
    "attributes"
  ]
};

// src/gltf/schemas/material.schema.json
var material_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::material",
  title: "Material",
  description: "The material appearance of a primitive. Derived from the glTF 2.0 material schema. Indices refer to component rows in the matching Mosaic component table rather than to a glTF array.",
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string"
    },
    pbrMetallicRoughness: {
      type: "object",
      additionalProperties: false,
      description: "A set of parameter values used to light a material with the metallic-roughness model.",
      properties: {
        baseColorFactor: {
          type: "array",
          items: {
            type: "number",
            minimum: 0,
            maximum: 1
          },
          minItems: 4,
          maxItems: 4,
          default: [
            1,
            1,
            1,
            1
          ]
        },
        metallicFactor: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 1
        },
        roughnessFactor: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 1
        },
        baseColorTexture: {
          type: "object",
          additionalProperties: false,
          description: "The base color texture, whose RGB is encoded with the sRGB transfer function.",
          properties: {
            index: {
              type: "string",
              format: "uuid",
              pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
              description: "The id of the Mosaic node carrying the texture component."
            },
            texCoord: {
              type: "integer",
              minimum: 0,
              default: 0,
              description: "The set index of the TEXCOORD attribute used for this texture."
            }
          },
          required: [
            "index"
          ]
        },
        metallicRoughnessTexture: {
          type: "object",
          additionalProperties: false,
          description: "Metalness sampled from the B channel and roughness from the G channel.",
          properties: {
            index: {
              type: "string",
              format: "uuid",
              pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
              description: "The id of the Mosaic node carrying the texture component."
            },
            texCoord: {
              type: "integer",
              minimum: 0,
              default: 0,
              description: "The set index of the TEXCOORD attribute used for this texture."
            }
          },
          required: [
            "index"
          ]
        }
      }
    },
    doubleSided: {
      type: "boolean",
      default: false
    },
    normalTexture: {
      type: "object",
      additionalProperties: false,
      description: "The tangent space normal texture.",
      properties: {
        index: {
          type: "string",
          format: "uuid",
          pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
          description: "The id of the Mosaic node carrying the texture component."
        },
        texCoord: {
          type: "integer",
          minimum: 0,
          default: 0,
          description: "The set index of the TEXCOORD attribute used for this texture."
        },
        scale: {
          type: "number",
          default: 1,
          description: "Scales the X and Y of the sampled normal."
        }
      },
      required: [
        "index"
      ]
    },
    occlusionTexture: {
      type: "object",
      additionalProperties: false,
      description: "The occlusion texture.",
      properties: {
        index: {
          type: "string",
          format: "uuid",
          pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
          description: "The id of the Mosaic node carrying the texture component."
        },
        texCoord: {
          type: "integer",
          minimum: 0,
          default: 0,
          description: "The set index of the TEXCOORD attribute used for this texture."
        },
        strength: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 1,
          description: "Scales the occlusion sampled from the R channel."
        }
      },
      required: [
        "index"
      ]
    },
    emissiveTexture: {
      type: "object",
      additionalProperties: false,
      description: "The emissive texture, whose RGB is encoded with the sRGB transfer function.",
      properties: {
        index: {
          type: "string",
          format: "uuid",
          pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
          description: "The id of the Mosaic node carrying the texture component."
        },
        texCoord: {
          type: "integer",
          minimum: 0,
          default: 0,
          description: "The set index of the TEXCOORD attribute used for this texture."
        }
      },
      required: [
        "index"
      ]
    },
    emissiveFactor: {
      type: "array",
      items: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      minItems: 3,
      maxItems: 3,
      default: [
        0,
        0,
        0
      ],
      description: "The factors for the emissive colour of the material."
    },
    alphaMode: {
      type: "string",
      enum: [
        "OPAQUE",
        "MASK",
        "BLEND"
      ],
      default: "OPAQUE",
      description: "How the alpha value is interpreted."
    },
    alphaCutoff: {
      type: "number",
      minimum: 0,
      default: 0.5,
      description: "The alpha cutoff value, used when alphaMode is MASK."
    }
  }
};

// src/gltf/schemas/image.schema.json
var image_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::image",
  title: "Image",
  description: "Image data used to create a texture. Derived from the glTF 2.0 image schema, except that glTF's integer ids are replaced by the id of the Mosaic node carrying the referenced component, so a reference survives any change to component ordering.",
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string"
    },
    uri: {
      type: "string",
      description: "The URI of the image, or a data: URI holding it inline. Mutually exclusive with bufferView."
    },
    mimeType: {
      type: "string",
      enum: [
        "image/jpeg",
        "image/png"
      ],
      description: "The image's media type. Required when bufferView is used."
    },
    bufferView: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the bufferView component holding the image bytes."
    }
  }
};

// src/gltf/schemas/sampler.schema.json
var sampler_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::sampler",
  title: "Sampler",
  description: "Texture sampler properties for filtering and wrapping modes. Derived from the glTF 2.0 sampler schema, except that glTF's integer ids are replaced by the id of the Mosaic node carrying the referenced component, so a reference survives any change to component ordering.",
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string"
    },
    magFilter: {
      type: "integer",
      enum: [
        9728,
        9729
      ],
      description: "Magnification filter: 9728 NEAREST, 9729 LINEAR."
    },
    minFilter: {
      type: "integer",
      enum: [
        9728,
        9729,
        9984,
        9985,
        9986,
        9987
      ],
      description: "Minification filter: 9728 NEAREST, 9729 LINEAR, 9984 NEAREST_MIPMAP_NEAREST, 9985 LINEAR_MIPMAP_NEAREST, 9986 NEAREST_MIPMAP_LINEAR, 9987 LINEAR_MIPMAP_LINEAR."
    },
    wrapS: {
      type: "integer",
      enum: [
        33071,
        33648,
        10497
      ],
      default: 10497,
      description: "S (U) wrapping mode: 33071 CLAMP_TO_EDGE, 33648 MIRRORED_REPEAT, 10497 REPEAT."
    },
    wrapT: {
      type: "integer",
      enum: [
        33071,
        33648,
        10497
      ],
      default: 10497,
      description: "T (V) wrapping mode: 33071 CLAMP_TO_EDGE, 33648 MIRRORED_REPEAT, 10497 REPEAT."
    }
  }
};

// src/gltf/schemas/texture.schema.json
var texture_schema_default = {
  $schema: "http://json-schema.org/draft-07/schema#",
  "x-mosaic-id": "khronos::gltf::texture",
  title: "Texture",
  description: "A texture and its sampler. Derived from the glTF 2.0 texture schema, except that glTF's integer ids are replaced by the id of the Mosaic node carrying the referenced component, so a reference survives any change to component ordering.",
  type: "object",
  additionalProperties: false,
  properties: {
    name: {
      type: "string"
    },
    sampler: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the sampler component used by this texture."
    },
    source: {
      type: "string",
      format: "uuid",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
      description: "The id of the Mosaic node carrying the image component this texture uses."
    }
  }
};

// src/gltf/schemas.ts
var GLTF_TYPE = {
  buffer: "khronos::gltf::buffer",
  bufferView: "khronos::gltf::bufferView",
  accessor: "khronos::gltf::accessor",
  meshPrimitive: "khronos::gltf::meshPrimitive",
  image: "khronos::gltf::image",
  sampler: "khronos::gltf::sampler",
  texture: "khronos::gltf::texture",
  material: "khronos::gltf::material"
};
var GLTF_SCHEMAS = {
  [GLTF_TYPE.buffer]: buffer_schema_default,
  [GLTF_TYPE.bufferView]: bufferView_schema_default,
  [GLTF_TYPE.accessor]: accessor_schema_default,
  [GLTF_TYPE.meshPrimitive]: meshPrimitive_schema_default,
  [GLTF_TYPE.image]: image_schema_default,
  [GLTF_TYPE.sampler]: sampler_schema_default,
  [GLTF_TYPE.texture]: texture_schema_default,
  [GLTF_TYPE.material]: material_schema_default
};

// src/composition/MosaicToGltf.ts
var MOSAIC_COMPONENTS_EXTENSION = "MOSAIC_components";
var DATA_URI_BASE64 = /^data:[^;,]*;base64,/;
var GLTF_TYPES = new Set(Object.values(GLTF_TYPE));
var NATIVE_TYPES = /* @__PURE__ */ new Set([...GLTF_TYPES, CORE_TYPE.transform, CORE_TYPE.child]);
var MAX_NODES = 2e6;
function decodeDataUri(uri, what) {
  if (typeof uri !== "string") throw new Error(`${what} has no uri to read its bytes from`);
  if (!DATA_URI_BASE64.test(uri)) throw new Error(`${what} uri is not a base64 data URI`);
  const base64 = uri.slice(uri.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function align4(value) {
  return value + 3 & ~3;
}
function mediaTypeOf(uri) {
  const media = uri.slice("data:".length, uri.indexOf(";"));
  return media.length > 0 ? media : void 0;
}
function sniffImageType(bytes, at) {
  if (bytes[at] === 255 && bytes[at + 1] === 216 && bytes[at + 2] === 255) return "image/jpeg";
  if (bytes[at] === 137 && bytes[at + 1] === 80 && bytes[at + 2] === 78 && bytes[at + 3] === 71) return "image/png";
  return "image/png";
}
function mosaicToGltf(file) {
  const warnings = [];
  const nodes = [...resolveInheritance(collapseNodesByPath(file), warnings).values()];
  const byType = /* @__PURE__ */ new Map();
  const carriedBy = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const carried = [];
    for (const ref of node.components ?? []) {
      let row = {};
      if (hasValue(ref)) {
        try {
          row = JSON.parse(file.readRawComponent(ref.type, indexOf(ref)));
        } catch (cause) {
          throw new Error(`Node ${node.id} references ${ref.type}[${indexOf(ref)}], which cannot be read`, { cause });
        }
      }
      const entry = { node, ref, row };
      carried.push(entry);
      const group = byType.get(ref.type);
      if (group) group.push(entry);
      else byType.set(ref.type, [entry]);
    }
    carriedBy.set(node.id, carried);
  }
  const of = (typeID) => byType.get(typeID) ?? [];
  const bufferBase = /* @__PURE__ */ new Map();
  const blocks = [];
  let binaryLength = 0;
  for (const { node, row } of of(GLTF_TYPE.buffer)) {
    const bytes = decodeDataUri(row.uri, `Buffer on node ${node.id}`);
    const declared = typeof row.byteLength === "number" ? row.byteLength : bytes.byteLength;
    if (bytes.byteLength < declared) {
      throw new Error(`Buffer on node ${node.id} declares ${declared} bytes but its uri holds ${bytes.byteLength}`);
    }
    const padding = align4(binaryLength) - binaryLength;
    if (padding > 0) blocks.push(new Uint8Array(padding));
    binaryLength += padding;
    bufferBase.set(node.id, binaryLength);
    blocks.push(bytes.subarray(0, declared));
    binaryLength += declared;
  }
  const bufferBytes = new Uint8Array(align4(binaryLength));
  {
    let cursor = 0;
    for (const block of blocks) {
      bufferBytes.set(block, cursor);
      cursor += block.byteLength;
    }
  }
  binaryLength = bufferBytes.byteLength;
  const bufferViewIndex = /* @__PURE__ */ new Map();
  const bufferViews = [];
  for (const { node, row } of of(GLTF_TYPE.bufferView)) {
    const base = bufferBase.get(row.buffer);
    if (base === void 0) {
      throw new Error(`bufferView on node ${node.id} references node ${row.buffer}, which carries no buffer component`);
    }
    bufferViewIndex.set(node.id, bufferViews.length);
    bufferViews.push({
      ...row.name !== void 0 ? { name: row.name } : {},
      buffer: 0,
      byteOffset: base + (row.byteOffset ?? 0),
      byteLength: row.byteLength,
      ...row.byteStride !== void 0 ? { byteStride: row.byteStride } : {},
      ...row.target !== void 0 ? { target: row.target } : {}
    });
  }
  const accessorIndex = /* @__PURE__ */ new Map();
  const accessors = [];
  for (const { node, row } of of(GLTF_TYPE.accessor)) {
    const accessor = {
      ...row.name !== void 0 ? { name: row.name } : {},
      componentType: row.componentType,
      count: row.count,
      type: row.type
    };
    if (row.bufferView !== void 0) {
      const index = bufferViewIndex.get(row.bufferView);
      if (index === void 0) {
        throw new Error(`accessor on node ${node.id} references node ${row.bufferView}, which carries no bufferView component`);
      }
      accessor.bufferView = index;
      if (row.byteOffset) accessor.byteOffset = row.byteOffset;
    }
    if (row.normalized !== void 0) accessor.normalized = row.normalized;
    if (row.min !== void 0) accessor.min = row.min;
    if (row.max !== void 0) accessor.max = row.max;
    accessorIndex.set(node.id, accessors.length);
    accessors.push(accessor);
  }
  const imageIndex = /* @__PURE__ */ new Map();
  const images = [];
  const imageBlocks = [];
  for (const { node, row } of of(GLTF_TYPE.image)) {
    const image = {};
    if (row.name !== void 0) image.name = row.name;
    if (row.bufferView !== void 0) {
      const index = bufferViewIndex.get(row.bufferView);
      if (index === void 0) {
        throw new Error(`image on node ${node.id} references node ${row.bufferView}, which carries no bufferView component`);
      }
      image.bufferView = index;
      image.mimeType = row.mimeType ?? sniffImageType(bufferBytes, bufferViews[index].byteOffset ?? 0);
    } else if (typeof row.uri === "string" && DATA_URI_BASE64.test(row.uri)) {
      const bytes = decodeDataUri(row.uri, `Image on node ${node.id}`);
      const padding = align4(binaryLength) - binaryLength;
      if (padding > 0) imageBlocks.push(new Uint8Array(padding));
      binaryLength += padding;
      image.bufferView = bufferViews.length;
      image.mimeType = row.mimeType ?? mediaTypeOf(row.uri) ?? sniffImageType(bytes, 0);
      bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: bytes.byteLength });
      imageBlocks.push(bytes);
      binaryLength += bytes.byteLength;
    } else if (typeof row.uri === "string") {
      image.uri = row.uri;
    } else {
      throw new Error(`image on node ${node.id} has neither a uri nor a bufferView`);
    }
    imageIndex.set(node.id, images.length);
    images.push(image);
  }
  const samplerIndex = /* @__PURE__ */ new Map();
  const samplers = [];
  for (const { node, row } of of(GLTF_TYPE.sampler)) {
    const sampler = {};
    for (const key of ["name", "magFilter", "minFilter", "wrapS", "wrapT"]) {
      if (row[key] !== void 0) sampler[key] = row[key];
    }
    samplerIndex.set(node.id, samplers.length);
    samplers.push(sampler);
  }
  const textureIndex = /* @__PURE__ */ new Map();
  const textures = [];
  for (const { node, row } of of(GLTF_TYPE.texture)) {
    const texture = {};
    if (row.name !== void 0) texture.name = row.name;
    if (row.source !== void 0) {
      const index = imageIndex.get(row.source);
      if (index === void 0) {
        throw new Error(`texture on node ${node.id} references node ${row.source}, which carries no image component`);
      }
      texture.source = index;
    }
    if (row.sampler !== void 0) {
      const index = samplerIndex.get(row.sampler);
      if (index === void 0) {
        throw new Error(`texture on node ${node.id} references node ${row.sampler}, which carries no sampler component`);
      }
      texture.sampler = index;
    }
    textureIndex.set(node.id, textures.length);
    textures.push(texture);
  }
  function textureInfo(info, where) {
    if (info === void 0) return void 0;
    const index = textureIndex.get(info.index);
    if (index === void 0) {
      throw new Error(`${where} references node ${info.index}, which carries no texture component`);
    }
    const out = { index };
    if (info.texCoord !== void 0) out.texCoord = info.texCoord;
    if (info.scale !== void 0) out.scale = info.scale;
    if (info.strength !== void 0) out.strength = info.strength;
    return out;
  }
  const materialIndex = /* @__PURE__ */ new Map();
  const materials = [];
  for (const { node, row } of of(GLTF_TYPE.material)) {
    const material = {};
    for (const key of ["name", "doubleSided", "emissiveFactor", "alphaMode", "alphaCutoff"]) {
      if (row[key] !== void 0) material[key] = row[key];
    }
    const where = `material on node ${node.id}`;
    const normal = textureInfo(row.normalTexture, `${where} normalTexture`);
    if (normal) material.normalTexture = normal;
    const occlusion = textureInfo(row.occlusionTexture, `${where} occlusionTexture`);
    if (occlusion) material.occlusionTexture = occlusion;
    const emissive = textureInfo(row.emissiveTexture, `${where} emissiveTexture`);
    if (emissive) material.emissiveTexture = emissive;
    const pbr = row.pbrMetallicRoughness;
    if (pbr !== void 0) {
      const projected = {};
      for (const key of ["baseColorFactor", "metallicFactor", "roughnessFactor"]) {
        if (pbr[key] !== void 0) projected[key] = pbr[key];
      }
      const baseColor = textureInfo(pbr.baseColorTexture, `${where} baseColorTexture`);
      if (baseColor) projected.baseColorTexture = baseColor;
      const metallicRoughness = textureInfo(pbr.metallicRoughnessTexture, `${where} metallicRoughnessTexture`);
      if (metallicRoughness) projected.metallicRoughnessTexture = metallicRoughness;
      material.pbrMetallicRoughness = projected;
    }
    materialIndex.set(node.id, materials.length);
    materials.push(material);
  }
  const meshes = [];
  const meshByKey = /* @__PURE__ */ new Map();
  function meshFor(primitives) {
    const built = primitives.map(({ node, row }) => {
      const attributes = {};
      for (const [semantic, reference] of Object.entries(row.attributes ?? {})) {
        const index2 = accessorIndex.get(reference);
        if (index2 === void 0) {
          throw new Error(`mesh on node ${node.id} references node ${reference} for ${semantic}, which carries no accessor component`);
        }
        attributes[semantic] = index2;
      }
      const primitive = { attributes };
      if (row.indices !== void 0) {
        const index2 = accessorIndex.get(row.indices);
        if (index2 === void 0) {
          throw new Error(`mesh on node ${node.id} references node ${row.indices} for its indices, which carries no accessor component`);
        }
        primitive.indices = index2;
      }
      if (row.material !== void 0) {
        const index2 = materialIndex.get(row.material);
        if (index2 === void 0) {
          throw new Error(`mesh on node ${node.id} references node ${row.material} for its material, which carries no material component`);
        }
        primitive.material = index2;
      }
      if (row.mode !== void 0) primitive.mode = row.mode;
      return primitive;
    });
    const name = primitives.map((p) => p.row.name).find((n) => typeof n === "string");
    const key = JSON.stringify([name, built]);
    const existing = meshByKey.get(key);
    if (existing !== void 0) return existing;
    const index = meshes.length;
    meshes.push({
      ...name !== void 0 ? { name } : {},
      primitives: built
    });
    meshByKey.set(key, index);
    return index;
  }
  const known = new Set(nodes.map((node) => node.id));
  const childIds = /* @__PURE__ */ new Map();
  const referenced = /* @__PURE__ */ new Set();
  for (const node of nodes) {
    const links = [];
    for (const { ref } of (carriedBy.get(node.id) ?? []).filter((c) => c.ref.type === CORE_TYPE.child)) {
      const childId = ref.id;
      if (!known.has(childId)) {
        warnings.push(`node ${node.id} names ${childId} as a child, but no such node is present`);
        continue;
      }
      if (childId === node.id) {
        warnings.push(`node ${node.id} names itself as a child; the link was dropped`);
        continue;
      }
      links.push(childId);
      referenced.add(childId);
    }
    if (links.length > 0) childIds.set(node.id, links);
  }
  const gltfNodes = [];
  const extensionsUsed = /* @__PURE__ */ new Set();
  function templateFor(node) {
    const carried = carriedBy.get(node.id) ?? [];
    const gltfNode = { name: node.id };
    const primitives = carried.filter((c) => c.ref.type === GLTF_TYPE.meshPrimitive);
    if (primitives.length > 0) gltfNode.mesh = meshFor(primitives);
    const transforms = carried.filter((c) => c.ref.type === CORE_TYPE.transform);
    if (transforms.length > 1) warnings.push(`node ${node.id} carries ${transforms.length} transforms; using "${transforms[0].ref.id}"`);
    const transform2 = transforms[0]?.row;
    if (transform2) {
      if (transform2.matrix !== void 0) gltfNode.matrix = transform2.matrix;
      else {
        if (transform2.translation !== void 0) gltfNode.translation = transform2.translation;
        if (transform2.rotation !== void 0) gltfNode.rotation = transform2.rotation;
        if (transform2.scale !== void 0) gltfNode.scale = transform2.scale;
      }
    }
    const foreign = carried.filter((c) => !NATIVE_TYPES.has(c.ref.type));
    if (foreign.length > 0) {
      gltfNode.extensions = {
        [MOSAIC_COMPONENTS_EXTENSION]: {
          components: foreign.map(({ ref, row }) => ({ name: ref.id, type: ref.type, value: row }))
        }
      };
      extensionsUsed.add(MOSAIC_COMPONENTS_EXTENSION);
    }
    return gltfNode;
  }
  const templates = new Map(nodes.map((node) => [node.id, templateFor(node)]));
  const emitted = /* @__PURE__ */ new Set();
  function emit(id, ancestors) {
    const loop = ancestors.indexOf(id);
    if (loop !== -1) {
      throw new Error(`Child links form a cycle: ${[...ancestors.slice(loop), id].join(" -> ")}`);
    }
    if (gltfNodes.length >= MAX_NODES) {
      throw new Error(`Child links expand past ${MAX_NODES} nodes; check for a reference that repeats without end`);
    }
    const gltfNode = { ...templates.get(id) };
    const index = gltfNodes.length;
    gltfNodes.push(gltfNode);
    emitted.add(id);
    const children = childIds.get(id);
    if (children) {
      const beneath = [...ancestors, id];
      const drawn = children.map((child) => emit(child, beneath)).filter((at) => at !== void 0);
      if (drawn.length > 0) gltfNode.children = drawn;
    }
    if (gltfNode.mesh === void 0 && gltfNode.children === void 0 && gltfNode.extensions === void 0) {
      gltfNodes.pop();
      return void 0;
    }
    return index;
  }
  const roots = nodes.filter((node) => !referenced.has(node.id)).map((node) => emit(node.id, [])).filter((at) => at !== void 0);
  const unreachable = nodes.filter((node) => !emitted.has(node.id));
  if (unreachable.length > 0) {
    throw new Error(`Child links form a cycle among nodes nothing else names: ${unreachable.map((n) => n.id).join(", ")}`);
  }
  const binary = new Uint8Array(align4(binaryLength));
  binary.set(bufferBytes, 0);
  {
    let cursor = bufferBytes.byteLength;
    for (const block of imageBlocks) {
      binary.set(block, cursor);
      cursor += block.byteLength;
    }
  }
  for (const accessor of accessors) {
    if (accessor.type === "VEC3" && (accessor.min === void 0 || accessor.max === void 0)) {
      warnings.push(`accessor "${accessor.name ?? "?"}" has no min/max; glTF requires them for POSITION`);
    }
  }
  const document2 = {
    asset: { version: "2.0", generator: "mosaic compose" },
    scene: 0,
    scenes: [{ nodes: roots }],
    nodes: gltfNodes,
    ...meshes.length > 0 ? { meshes } : {},
    ...accessors.length > 0 ? { accessors } : {},
    ...bufferViews.length > 0 ? { bufferViews } : {},
    ...binaryLength > 0 ? { buffers: [{ byteLength: binary.byteLength }] } : {},
    ...materials.length > 0 ? { materials } : {},
    ...textures.length > 0 ? { textures } : {},
    ...images.length > 0 ? { images } : {},
    ...samplers.length > 0 ? { samplers } : {},
    ...extensionsUsed.size > 0 ? { extensionsUsed: [...extensionsUsed] } : {}
  };
  return { document: document2, binary, warnings };
}

// src/composition/GlbWriter.ts
var GLB_MAGIC = 1179937895;
var CHUNK_JSON = 1313821514;
var CHUNK_BIN = 5130562;
var HEADER_BYTES = 12;
var CHUNK_HEADER_BYTES = 8;
function pad(bytes, filler) {
  const padding = (4 - bytes.byteLength % 4) % 4;
  if (padding === 0) return bytes;
  const padded = new Uint8Array(bytes.byteLength + padding);
  padded.set(bytes);
  padded.fill(filler, bytes.byteLength);
  return padded;
}
function writeGlb(document2, binary) {
  const json = pad(new TextEncoder().encode(JSON.stringify(document2)), 32);
  const bin = binary && binary.byteLength > 0 ? pad(binary, 0) : void 0;
  const total = HEADER_BYTES + CHUNK_HEADER_BYTES + json.byteLength + (bin ? CHUNK_HEADER_BYTES + bin.byteLength : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(HEADER_BYTES, json.byteLength, true);
  view.setUint32(HEADER_BYTES + 4, CHUNK_JSON, true);
  out.set(json, HEADER_BYTES + CHUNK_HEADER_BYTES);
  if (bin) {
    const at = HEADER_BYTES + CHUNK_HEADER_BYTES + json.byteLength;
    view.setUint32(at, bin.byteLength, true);
    view.setUint32(at + 4, CHUNK_BIN, true);
    out.set(bin, at + CHUNK_HEADER_BYTES);
  }
  return out;
}

// src/viewer/ArchiveSource.ts
var ArchiveSource = class {
  kind = "archives";
  held = /* @__PURE__ */ new Map();
  constructor(loaded = []) {
    for (const tessera of loaded) this.held.set(tessera.id, tessera);
  }
  async tesserae() {
    return this.summaries();
  }
  summaries() {
    return [...this.held.values()].map((tessera) => ({
      id: tessera.id,
      name: tessera.name,
      versions: tessera.versions.map((version) => ({
        versionId: version.versionId,
        ...version.message !== void 0 ? { message: version.message } : {},
        ...version.author !== void 0 ? { author: version.author } : {}
      }))
    }));
  }
  /**
   * Takes an archive someone handed over, rather than one loaded from a folder.
   *
   * Its imports are not followed: a file dropped on the page came without the folder it
   * sat in, so there is nowhere to look for them. An archive that stands on its own
   * shows as it is, and one that does not shows what it has.
   */
  async add(name, bytes) {
    const file = await LoadMosaicFile(bytes);
    const own = /* @__PURE__ */ new Set();
    for (const section of file.index.sections) {
      for (const node of section.nodes) own.add(node.id);
    }
    return this.put(name.replace(/\.tsr$/i, ""), {
      versionId: crypto.randomUUID(),
      message: "dropped in",
      alone: file,
      file,
      own
    });
  }
  /** Adds a tessera, or another version of one already here under that name. */
  put(name, version) {
    const existing = [...this.held.values()].find((tessera2) => tessera2.name === name);
    const tessera = existing ?? { id: crypto.randomUUID(), name, versions: [] };
    tessera.versions.push(version);
    this.held.set(tessera.id, tessera);
    return this.summaries().find((summary) => summary.id === tessera.id);
  }
  // --- what is inside an archive ------------------------------------------
  /**
   * The files an archive is made of, as text.
   *
   * A .tsr is a zip of an index and one newline-delimited table per component type, and
   * that is exactly what comes back -- no view, no summary, the files themselves. What
   * is shown is the archive as written, without what it imports, since that is what
   * editing it would change.
   */
  filesOf(ref) {
    const tessera = this.held.get(ref.tesseraId);
    const version = tessera?.versions.find((one) => one.versionId === ref.versionId);
    if (!tessera || !version) return void 0;
    const files = {
      "index.json": JSON.stringify(version.alone.index, null, 4)
    };
    for (const [type, rows] of version.alone.serializedComponents) {
      files[type + ".ndjson"] = rows.join("\n");
    }
    return { name: tessera.name, files };
  }
  /**
   * Puts edited files back, in place of the archive they came from.
   *
   * The imports are merged again afterwards rather than kept: an edit can add one, or
   * change which node a component belongs to, and a stale merge would show the old
   * answer. What it cannot do is fetch a newly named import -- nothing here has a
   * network -- so a new import is reported rather than silently ignored.
   */
  replaceFiles(ref, files) {
    const tessera = this.held.get(ref.tesseraId);
    const version = tessera?.versions.find((one) => one.versionId === ref.versionId);
    if (!tessera || !version) throw new Error("that archive is not open");
    const index = files["index.json"];
    if (index === void 0) throw new Error("an archive needs an index.json");
    const edited = new MosaicFile();
    edited.index = Convert.toMosaicIndexFile(index);
    for (const [name, text] of Object.entries(files)) {
      if (!name.endsWith(".ndjson")) continue;
      edited.serializedComponents.set(name.replace(/\.ndjson$/, ""), text.split("\n"));
    }
    const warnings = [];
    const had = new Set((version.alone.index.imports ?? []).map((entry) => entry.uri));
    for (const entry of edited.index.imports ?? []) {
      if (!had.has(entry.uri)) {
        warnings.push(`import "${entry.uri}" was added; reload the example to fetch it`);
      }
    }
    version.alone = edited;
    version.file = version.beneath ? federate(version.beneath, edited, true) : edited;
    version.own = /* @__PURE__ */ new Set();
    for (const section of edited.index.sections) {
      for (const node of section.nodes) version.own.add(node.id);
    }
    return { warnings };
  }
  /** The versions named, in the order they were named, skipping any that are not here. */
  resolve(refs) {
    const found = [];
    for (const ref of refs) {
      const tessera = this.held.get(ref.tesseraId);
      const version = tessera?.versions.find((one) => one.versionId === ref.versionId);
      if (tessera && version) found.push({ ref, name: tessera.name, version });
    }
    return found;
  }
  /**
   * Everything asked for, as one file.
   *
   * Later versions layer over earlier ones, in the order the caller named them, which is
   * what makes several tesserae on show a single tree rather than several.
   */
  scopeOf(refs) {
    const parts = this.resolve(refs);
    let file;
    for (const part of parts) {
      file = file ? federate(file, part.version.file, true) : part.version.file;
    }
    return { file: file ?? new MosaicFile(), parts };
  }
  /**
   * The nodes nothing in scope holds as a child.
   *
   * Being a root is judged across the whole scope rather than inside one archive: a node
   * that is a root of the file it is written in stops being one as soon as something
   * shown beside it holds it as a child.
   */
  rootsOf(file) {
    const collapsed = collapseNodesByPath(file);
    const asChild = /* @__PURE__ */ new Set();
    for (const node of collapsed.values()) {
      for (const reference of node.components ?? []) {
        if (reference.type === CORE_TYPE.child) asChild.add(reference.id);
      }
    }
    return [...collapsed.keys()].filter((id) => !asChild.has(id));
  }
  /** The selection both answers are built from. */
  select(request) {
    const { file, parts } = this.scopeOf(request.versions);
    const asked2 = request.nodes && request.nodes.length > 0 ? request.nodes : void 0;
    const seeds = asked2 ?? this.rootsOf(file);
    const selection = selectNodes(file, {
      nodes: seeds,
      includeChildren: request.includeChildren ?? true,
      ...request.compose !== void 0 ? { compose: request.compose } : {},
      ...request.componentTypes ? { componentTypes: request.componentTypes } : {}
    });
    return { selection, parts, seeds, scope: file };
  }
  async glb(request) {
    const { selection } = this.select(request);
    const composed = mosaicToGltf(selection.file);
    return writeGlb(composed.document, composed.binary);
  }
  async scene(request) {
    const { selection, parts, seeds, scope } = this.select(request);
    const file = selection.file;
    const origin = /* @__PURE__ */ new Map();
    for (const part of parts) {
      for (const id of part.version.own) origin.set(id, { ref: part.ref, name: part.name });
    }
    const nodes = {};
    for (const node of file.index.sections[0]?.nodes ?? []) {
      const components = (node.components ?? []).map((reference) => {
        const index = reference.index ?? -1;
        return {
          type: reference.type,
          id: reference.id,
          index,
          value: index >= 0 ? JSON.parse(file.readRawComponent(reference.type, index)) : null
        };
      });
      const from = origin.get(node.id);
      nodes[node.id] = {
        id: node.id,
        name: components.find((component) => component.type === CORE_TYPE.name)?.id ?? null,
        children: components.filter((component) => component.type === CORE_TYPE.child).map((component) => component.id),
        components,
        tessera: from?.name ?? null,
        tesseraId: from?.ref.tesseraId ?? null,
        versionId: from?.ref.versionId ?? null
      };
    }
    const roots = request.nodes && request.nodes.length > 0 ? seeds : this.rootsOf(scope);
    return {
      versions: parts.map((part) => ({
        ...part.ref,
        name: part.name,
        roots: roots.filter((id) => origin.get(id)?.ref.versionId === part.ref.versionId && nodes[id] !== void 0)
      })),
      // Nothing arrives here by import that the caller did not name: imports are
      // resolved into the archive as it is loaded, so there is no second tessera to
      // report having dragged in.
      imported: [],
      roots: roots.filter((id) => nodes[id] !== void 0),
      nodes,
      warnings: []
    };
  }
};

// src/viewer/FetchArchives.ts
var fetchBytes = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return new Uint8Array(await response.arrayBuffer());
};
function normalise(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts;
}
function resolveWithin(root, fromDirectory, uri) {
  const cleaned = decodeURIComponent(uri.replace(/^file:\/*/i, ""));
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
    throw new Error(`import "${uri}" is not a path this can fetch`);
  }
  const base = normalise(root);
  const target = normalise(fromDirectory + "/" + cleaned);
  if (target.length === 0) throw new Error(`import "${uri}" names nothing`);
  const inside = base.every((part, at) => target[at] === part);
  if (!inside) throw new Error(`import "${uri}" points outside ${base.join("/")}`);
  return target.join("/");
}
async function loadArchive(directory, name, get = fetchBytes, warnings = []) {
  const visiting = /* @__PURE__ */ new Set();
  const sources = [];
  const top = directory.replace(/\/+$/, "") + "/" + name;
  let beneath;
  const already = /* @__PURE__ */ new Map();
  const fetchOnce = (url) => {
    const going = already.get(url) ?? get(url);
    already.set(url, going);
    return going;
  };
  async function load(url, importedBy) {
    if (visiting.has(url)) throw new Error(`Import cycle: ${url} is already being loaded`);
    visiting.add(url);
    let bytes;
    try {
      bytes = await fetchOnce(url);
    } catch (error) {
      throw new Error(importedBy ? `Import "${url}", referenced by ${importedBy}, could not be read: ${message(error)}` : `${url} could not be read: ${message(error)}`);
    }
    const file2 = await LoadMosaicFile(bytes);
    const here = url.slice(0, url.lastIndexOf("/"));
    let merged;
    for (const entry of file2.index.imports ?? []) {
      let target;
      try {
        target = resolveWithin(directory, here, entry.uri);
      } catch (error) {
        warnings.push(`skipped ${message(error)}`);
        continue;
      }
      const imported = await load(target, url);
      merged = merged ? federate(merged, imported, true) : imported;
    }
    visiting.delete(url);
    sources.push(url);
    if (url === top) beneath = merged;
    return merged ? federate(merged, file2, true) : file2;
  }
  const file = await load(top);
  const alone = await LoadMosaicFile(await fetchOnce(top));
  const own = /* @__PURE__ */ new Set();
  for (const section of alone.index.sections) {
    for (const node of section.nodes) own.add(node.id);
  }
  return { file, alone, beneath, own, sources };
}
async function loadExample(directory, manifest, get = fetchBytes) {
  const warnings = [];
  const tesserae = [];
  for (const name of manifest.archives) {
    const { file, alone, beneath, own } = await loadArchive(directory, name, get, warnings);
    const stem = name.replace(/\.[^./]+$/, "").split("/").pop() ?? name;
    const version = {
      versionId: idFor(directory + "/" + name),
      message: "as published",
      alone,
      ...beneath ? { beneath } : {},
      file,
      own
    };
    tesserae.push({ id: idFor(directory + "/" + name + "#tessera"), name: stem, versions: [version] });
  }
  return { tesserae, warnings };
}
function idFor(key) {
  let hash = 2166136261;
  for (let at = 0; at < key.length; at++) {
    hash ^= key.charCodeAt(at);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const hex = hash.toString(16).padStart(8, "0");
  const more = Math.imul(hash ^ key.length, 16777619) >>> 0;
  const tail = more.toString(16).padStart(8, "0");
  return `${hex}-${tail.slice(0, 4)}-4${tail.slice(4, 7)}-8${hex.slice(0, 3)}-${hex}${tail.slice(0, 4)}`;
}
function message(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/viewer/app/editor.ts
var MONACO = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min";
var loading;
function monacoReady() {
  loading ??= new Promise((resolve, reject) => {
    globalThis.MonacoEnvironment = {
      getWorkerUrl: () => URL.createObjectURL(new Blob([
        "self.MonacoEnvironment = { baseUrl: '" + MONACO + "/' };\nimportScripts('" + MONACO + "/vs/base/worker/workerMain.js');"
      ], { type: "text/javascript" }))
    };
    const script = document.createElement("script");
    script.src = MONACO + "/vs/loader.js";
    script.onload = () => {
      __require.config({ paths: { vs: MONACO + "/vs" } });
      __require(["vs/editor/editor.main"], () => resolve(), reject);
    };
    script.onerror = () => reject(new Error("could not load the editor"));
    document.head.append(script);
  });
  return loading;
}
async function mountEditor(options) {
  const { source: source2, onSaved, say: say3 } = options;
  const drawer = document.createElement("section");
  drawer.className = "editor";
  drawer.id = "editor";
  drawer.hidden = true;
  const bar = document.createElement("div");
  bar.className = "editor-bar";
  const which = document.createElement("select");
  which.className = "which";
  which.title = "Which archive to look inside";
  const files = document.createElement("select");
  files.className = "which";
  files.title = "Which file in it";
  const save = document.createElement("button");
  save.textContent = "Save";
  save.title = "Replace the archive with what is written here and draw it again";
  save.disabled = true;
  const revert = document.createElement("button");
  revert.className = "quiet";
  revert.textContent = "Revert";
  revert.disabled = true;
  const note = document.createElement("span");
  note.className = "editor-note";
  const close = document.createElement("button");
  close.className = "quiet close";
  close.textContent = "Hide";
  bar.append(which, files, save, revert, note, close);
  const host = document.createElement("div");
  host.className = "editor-host";
  drawer.append(bar, host);
  document.querySelector("main")?.after(drawer);
  const toggle = document.createElement("button");
  toggle.id = "files-toggle";
  toggle.textContent = "Files";
  toggle.title = "Look inside the archives, and edit them";
  const status = document.getElementById("status");
  if (status) status.before(toggle);
  else document.querySelector("header")?.append(toggle);
  let editor;
  let open = {};
  let openRef;
  let showing = "";
  let dirty = false;
  let filling = false;
  const languageOf = (name) => name.endsWith(".json") ? "json" : "plaintext";
  const markDirty = (is) => {
    dirty = is;
    save.disabled = !is;
    revert.disabled = !is;
    note.textContent = is ? "edited" : "";
  };
  async function fillArchives() {
    const tesserae = await source2.tesserae();
    which.innerHTML = "";
    for (const tessera of tesserae) {
      for (const version of tessera.versions) {
        const option = document.createElement("option");
        option.value = tessera.id + " " + version.versionId;
        option.textContent = tessera.versions.length > 1 ? tessera.name + " \xB7 " + (version.message ?? version.versionId.slice(0, 8)) : tessera.name;
        which.append(option);
      }
    }
    return tesserae;
  }
  function openArchive(value) {
    const [tesseraId, versionId] = value.split(" ");
    if (!tesseraId || !versionId) return;
    const held = source2.filesOf({ tesseraId, versionId });
    if (!held) {
      note.textContent = "that archive is not open";
      return;
    }
    openRef = { tesseraId, versionId };
    open = { ...held.files };
    const names = Object.keys(open).sort((a2, b) => a2 === "index.json" ? -1 : b === "index.json" ? 1 : a2.localeCompare(b));
    files.innerHTML = "";
    for (const name of names) {
      const option = document.createElement("option");
      option.value = name;
      const lines = open[name].split("\n").length;
      option.textContent = name + "  (" + lines + (lines === 1 ? " line)" : " lines)");
      files.append(option);
    }
    showFile(names[0] ?? "");
    markDirty(false);
  }
  function showFile(name) {
    if (!name || !editor) return;
    if (showing && open[showing] !== void 0) open[showing] = editor.getValue();
    showing = name;
    files.value = name;
    const model = editor.getModel();
    monaco.editor.setModelLanguage(model, languageOf(name));
    filling = true;
    editor.setValue(open[name] ?? "");
    filling = false;
  }
  which.onchange = () => openArchive(which.value);
  files.onchange = () => showFile(files.value);
  revert.onclick = () => {
    if (openRef) openArchive(openRef.tesseraId + " " + openRef.versionId);
  };
  save.onclick = async () => {
    if (!openRef) return;
    if (showing) open[showing] = editor.getValue();
    save.disabled = true;
    try {
      const { warnings } = source2.replaceFiles(openRef, open);
      markDirty(false);
      await onSaved();
      note.textContent = warnings.length > 0 ? warnings.join(" \xB7 ") : "saved";
      if (warnings.length > 0) say3(warnings.join(" \xB7 "), true);
    } catch (error) {
      const message2 = error instanceof Error ? error.message : String(error);
      note.textContent = message2;
      say3("could not save: " + message2, true);
      save.disabled = false;
    }
  };
  const setOpen = async (wanted) => {
    drawer.hidden = !wanted;
    toggle.setAttribute("aria-pressed", String(wanted));
    document.body.classList.toggle("editing", wanted);
    if (!wanted) return;
    if (!editor) {
      note.textContent = "loading the editor\u2026";
      try {
        await monacoReady();
      } catch (error) {
        note.textContent = error instanceof Error ? error.message : String(error);
        return;
      }
      editor = monaco.editor.create(host, {
        value: "",
        language: "json",
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        tabSize: 4,
        renderWhitespace: "none",
        // A component table is one object per line and lines get long; wrapping
        // them beats scrolling sideways through a hundred thousand of them.
        wordWrap: "on"
      });
      editor.onDidChangeModelContent(() => {
        if (!dirty && !filling) markDirty(true);
      });
      note.textContent = "";
    }
    const tesserae = await fillArchives();
    if (tesserae.length === 0) {
      note.textContent = "nothing to look inside yet";
      return;
    }
    if (!openRef) openArchive(which.value);
  };
  toggle.onclick = () => void setOpen(drawer.hidden);
  close.onclick = () => void setOpen(false);
  if (options.open) await setOpen(true);
}

// src/viewer/app/app.js
var $ = (id) => document.getElementById(id);
var GEOMETRY_COMPONENTS = [
  "khronos::gltf::buffer",
  "khronos::gltf::bufferView",
  "khronos::gltf::accessor",
  "khronos::gltf::meshPrimitive",
  "khronos::gltf::image",
  "khronos::gltf::sampler",
  "khronos::gltf::texture",
  "khronos::gltf::material",
  "core::transform",
  "core::child",
  // An SVG is drawable too, though a glb has nowhere native to put one: it rides on its
  // node as extension data and is turned into geometry in here.
  "w3c::svg",
  // Not geometry, but about how geometry is drawn, so it comes with it.
  "core::edges"
];
var state = {
  tesserae: [],
  // Which tesserae are on show, and which version of each.
  shown: /* @__PURE__ */ new Set(),
  version: /* @__PURE__ */ new Map(),
  scene: null,
  selected: null,
  expanded: /* @__PURE__ */ new Set(),
  // What a node carries, fetched when it is selected and kept for as long as the scene
  // it belongs to. Keyed by node id.
  components: /* @__PURE__ */ new Map(),
  // The glb the tree was read from, kept so that redrawing costs nothing.
  glb: null
};
function say(message2, isError = false) {
  $("status").textContent = message2;
  $("status").dataset.error = String(isError);
}
var source = null;
var canUpload = () => typeof source?.add === "function";
var compose = () => $("compose").checked;
function shownVersions() {
  const pairs = [];
  for (const tessera of state.tesserae) {
    if (!state.shown.has(tessera.id)) continue;
    const versionId = state.version.get(tessera.id);
    if (versionId) pairs.push({ tesseraId: tessera.id, versionId });
  }
  return pairs;
}
async function loadTesserae() {
  state.tesserae = await source.tesserae();
  for (const tessera of state.tesserae) {
    const versions = tessera.versions.map((version) => version.versionId);
    const chosen = state.version.get(tessera.id);
    if (!chosen || !versions.includes(chosen)) state.version.set(tessera.id, versions[versions.length - 1]);
  }
  drawTesserae();
}
function drawTesserae() {
  const panel = $("tesserae");
  panel.innerHTML = "";
  if (state.tesserae.length === 0) {
    panel.innerHTML = '<p class="empty">Upload a .tsr to begin.</p>';
    return;
  }
  const imported = new Map((state.scene?.imported ?? []).map((entry) => [entry.tesseraId, entry]));
  for (const tessera of state.tesserae) {
    const row = document.createElement("label");
    row.className = "tessera";
    row.title = tessera.id;
    const tick = document.createElement("input");
    tick.type = "checkbox";
    tick.checked = state.shown.has(tessera.id);
    tick.onchange = () => {
      tick.checked ? state.shown.add(tessera.id) : state.shown.delete(tessera.id);
      loadScene();
    };
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = tessera.name;
    const versions = document.createElement("select");
    for (const version of tessera.versions) {
      const option = document.createElement("option");
      option.value = version.versionId;
      option.textContent = version.message || version.versionId.slice(0, 8);
      versions.append(option);
    }
    versions.value = state.version.get(tessera.id) ?? "";
    versions.onchange = (event) => {
      state.version.set(tessera.id, event.target.value);
      if (state.shown.has(tessera.id) || imported.has(tessera.id)) loadScene();
    };
    versions.onclick = (event) => event.preventDefault();
    row.append(tick, name, versions);
    if (!state.shown.has(tessera.id) && imported.has(tessera.id)) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "via import";
      badge.title = "Something on show imports this, so it is being read too";
      row.append(badge);
    }
    panel.append(row);
  }
}
var TREE_FROM_GLB = [...GEOMETRY_COMPONENTS, "core::name"];
var GLB_MAGIC2 = 1179937895;
var GLB_JSON_CHUNK = 1313821514;
function gltfOf(bytes) {
  const view = new DataView(bytes);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC2) {
    throw new Error("the answer is not a glb");
  }
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== GLB_JSON_CHUNK) {
    throw new Error("the first chunk of a glb should be its json");
  }
  return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length)));
}
function sceneFromGltf(gltf, versions) {
  const gltfNodes = gltf.nodes ?? [];
  const nodes = {};
  for (let index = 0; index < gltfNodes.length; index++) {
    const node = gltfNodes[index];
    const carried = node.extensions?.MOSAIC_components?.components ?? [];
    const named = carried.find((component) => component.type === "core::name");
    nodes[String(index)] = {
      id: String(index),
      // The name of a glTF node is the id of the Mosaic node it was written from.
      nodeId: node.name ?? null,
      name: named?.name ?? null,
      children: (node.children ?? []).map(String),
      drawn: node.mesh !== void 0
    };
  }
  const scene = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? [];
  const roots = scene.map(String);
  return {
    // One glb is one answer over everything on show, so the tree is one group. Which
    // tessera each node came from is not written into a glb, so a node reached across an
    // import is drawn as an ordinary child here, without the badge naming where it lives.
    versions: [{
      tesseraId: versions[0]?.tesseraId ?? null,
      versionId: versions[0]?.versionId ?? null,
      name: versions.length === 1 ? state.tesserae.find((t) => t.id === versions[0].tesseraId)?.name ?? "" : "on show",
      roots
    }],
    imported: [],
    warnings: [],
    roots,
    nodes
  };
}
async function loadScene() {
  const versions = shownVersions();
  drawTesserae();
  if (versions.length === 0) {
    state.scene = null;
    state.selected = null;
    state.glb = null;
    $("tree").innerHTML = '<p class="empty">Tick a tessera to show it.</p>';
    $("components").innerHTML = '<p class="empty">Select a node.</p>';
    $("warnings").hidden = true;
    try {
      (await viewer()).clear();
    } catch {
    }
    say("");
    return;
  }
  say("reading\u2026");
  try {
    const answered = await source.glb({
      versions,
      nodes: null,
      includeChildren: true,
      compose: compose(),
      componentTypes: TREE_FROM_GLB
    });
    const bytes = answered.buffer.slice(
      answered.byteOffset,
      answered.byteOffset + answered.byteLength
    );
    state.glb = bytes;
    state.scene = sceneFromGltf(gltfOf(bytes), versions);
    state.selected = null;
    state.components.clear();
    drawTesserae();
    drawTree();
    drawWarnings();
    $("components").innerHTML = '<p class="empty">Select a node.</p>';
    const drawing = await viewer();
    const summary = await drawing.show(bytes);
    say(state.scene.roots.length + " roots, " + Object.keys(state.scene.nodes).length + " nodes, " + (bytes.byteLength / 1048576).toFixed(1) + " MB of glb \u2014 " + summary.text);
  } catch (error) {
    say(String(error.message ?? error), true);
  }
}
function drawWarnings() {
  const panel = $("warnings");
  const warnings = state.scene?.warnings ?? [];
  panel.hidden = warnings.length === 0;
  panel.textContent = warnings.join(" \xB7 ");
}
function labelOf(node) {
  return node.name ?? (node.nodeId ? node.nodeId.slice(0, 8) + "\u2026" : "node " + node.id);
}
function drawTree() {
  const tree = $("tree");
  tree.innerHTML = "";
  const groups = state.scene?.versions ?? [];
  if (groups.every((group) => group.roots.length === 0)) {
    tree.innerHTML = '<p class="empty">Nothing in what is on show.</p>';
    return;
  }
  const draw = (id, depth, seen, from) => {
    const node = state.scene.nodes[id];
    if (!node) return document.createDocumentFragment();
    const fragment = document.createDocumentFragment();
    const row = document.createElement("div");
    row.className = "node";
    row.style.paddingLeft = 12 + depth * 14 + "px";
    row.setAttribute("aria-selected", String(state.selected === id));
    row.title = id + (node.tessera ? " \xB7 " + node.tessera : "");
    const children = node.children ?? [];
    const open = state.expanded.has(id);
    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.dataset.leaf = String(children.length === 0);
    twisty.textContent = open ? "\u25BE" : "\u25B8";
    twisty.onclick = (event) => {
      event.stopPropagation();
      state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      drawTree();
    };
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = labelOf(node);
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = children.length ? String(children.length) : "";
    row.append(twisty, name, count);
    if (node.tessera && node.tessera !== from) {
      const badge = document.createElement("span");
      badge.className = "badge other";
      badge.textContent = node.tessera;
      row.append(badge);
    }
    row.onclick = () => select(id);
    fragment.append(row);
    if (open && !seen.has(id)) {
      const beneath = new Set(seen).add(id);
      const kids = document.createElement("div");
      kids.className = "kids";
      for (const child of children) kids.append(draw(child, depth + 1, beneath, node.tessera ?? from));
      fragment.append(kids);
    }
    return fragment;
  };
  for (const group of groups) {
    const heading = document.createElement("div");
    heading.className = "group";
    heading.textContent = group.name;
    heading.title = group.tesseraId + " \xB7 " + group.versionId;
    tree.append(heading);
    if (group.roots.length === 0) {
      heading.insertAdjacentHTML("afterend", '<p class="empty">Nothing in this version.</p>');
      continue;
    }
    for (const root of group.roots) tree.append(draw(root, 0, /* @__PURE__ */ new Set(), group.name));
  }
}
function select(id) {
  state.selected = id;
  state.expanded.add(id);
  drawTree();
  drawComponents(id);
  showNode(id);
}
async function componentsOf(id) {
  if (state.components.has(id)) return state.components.get(id);
  const versions = shownVersions();
  const node = state.scene?.nodes[id];
  if (versions.length === 0 || !node?.nodeId) return [];
  const answer = await source.scene({
    versions,
    nodes: [node.nodeId],
    includeChildren: false,
    compose: compose()
  });
  const carried = answer.nodes?.[node.nodeId]?.components ?? [];
  state.components.set(id, carried);
  return carried;
}
async function drawComponents(id) {
  const node = state.scene?.nodes[id];
  const panel = $("components");
  panel.innerHTML = "";
  if (!node) return;
  const header = document.createElement("div");
  header.className = "component";
  header.innerHTML = '<div class="type">' + labelOf(node) + '</div><div class="ref">' + node.id + "</div>";
  if (node.tessera) {
    const where = document.createElement("div");
    where.className = "ref";
    where.textContent = "in " + node.tessera;
    header.append(where);
  }
  panel.append(header);
  const waiting = document.createElement("p");
  waiting.className = "empty";
  waiting.textContent = "reading what it carries\u2026";
  panel.append(waiting);
  let carried;
  try {
    carried = await componentsOf(id);
  } catch (error) {
    waiting.textContent = String(error.message ?? error);
    return;
  }
  if (state.selected !== id) return;
  waiting.remove();
  if (carried.length === 0) {
    panel.insertAdjacentHTML("beforeend", '<p class="empty">This node carries nothing.</p>');
    return;
  }
  for (const component of carried) {
    const block = document.createElement("div");
    block.className = "component";
    const type = document.createElement("div");
    type.className = "type";
    type.textContent = component.type;
    const reference = document.createElement("div");
    reference.className = "ref";
    reference.textContent = component.id + (component.index >= 0 ? " \xB7 row " + component.index : " \xB7 no value");
    block.append(type, reference);
    if (component.value !== null && component.value !== void 0) {
      const pre = document.createElement("pre");
      pre.textContent = JSON.stringify(component.value, null, 2);
      block.append(pre);
    }
    panel.append(block);
  }
}
async function showNode(id) {
  const node = state.scene?.nodes[id];
  const [version] = shownVersions();
  if (!node?.nodeId || !version) return;
  await intoViewer(
    "asking the api for " + labelOf(node) + "\u2026",
    source.glb({
      versions: [version],
      nodes: [node.nodeId],
      includeChildren: true,
      compose: compose(),
      componentTypes: GEOMETRY_COMPONENTS
    })
  );
}
async function showEverything() {
  if (!state.glb) return;
  say("drawing " + (state.glb.byteLength / 1048576).toFixed(1) + " MB of glb\u2026");
  try {
    const summary = await (await viewer()).show(state.glb);
    say(Object.keys(state.scene?.nodes ?? {}).length + " nodes \u2014 " + summary.text);
  } catch (error) {
    say(String(error.message ?? error), true);
  }
}
var stage = null;
async function viewer() {
  if (stage) return stage;
  let parts;
  try {
    parts = await Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/environments/RoomEnvironment.js"),
      import("three/addons/utils/BufferGeometryUtils.js"),
      import("three/addons/loaders/SVGLoader.js")
    ]);
  } catch (error) {
    throw new Error("the 3D view needs three.js from the CDN, which did not load: " + (error.message ?? error));
  }
  stage = build(...parts);
  return stage;
}
function build(THREE, orbit, gltf, environment, utils, svg) {
  const canvas = $("viewer");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.AgXToneMapping ?? THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  const scene = new THREE.Scene();
  const paper = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim();
  scene.background = new THREE.Color(paper || "#efe9dc");
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1e3);
  const controls = new orbit.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new environment.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.22;
  const key = new THREE.DirectionalLight(16773596, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -4e-4;
  scene.add(key, key.target);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(new THREE.HemisphereLight(13623538, 10129277, 0.34));
  const content = new THREE.Group();
  scene.add(content);
  const loader = new gltf.GLTFLoader();
  const svgLoader = new svg.SVGLoader();
  const EDGE_ANGLE = 30;
  const EDGE_BUDGET = 4e6;
  const EDGE_COLOUR = 6249044;
  let pending = true;
  let drawn = 0;
  let triangles = 0;
  const invalidate = () => {
    pending = true;
  };
  controls.addEventListener("change", invalidate);
  function frame() {
    requestAnimationFrame(frame);
    controls.update();
    if (!pending) return;
    pending = false;
    renderer.render(scene, camera);
    $("stats").textContent = drawn + (drawn === 1 ? " draw \xB7 " : " draws \xB7 ") + triangles.toLocaleString() + " triangles";
  }
  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    renderer.setSize(box.width, box.height, false);
    camera.aspect = box.width / box.height;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);
  resize();
  frame();
  function release(object) {
    object.traverse((one) => {
      if (one.isBatchedMesh) one.dispose();
      if (one.geometry) one.geometry.dispose();
      for (const material of [].concat(one.material ?? [])) {
        for (const value of Object.values(material)) {
          if (value && value.isTexture) value.dispose();
        }
        material.dispose();
      }
    });
  }
  function clear() {
    for (const child of [...content.children]) {
      content.remove(child);
      release(child);
    }
    invalidate();
  }
  function foliage(material) {
    if (!material || !(material.alphaTest > 0)) return;
    material.alphaTest = Math.min(material.alphaTest, 0.15);
    material.alphaToCoverage = true;
    material.needsUpdate = true;
    const map = material.map;
    if (map && map.anisotropy < 4) {
      map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      map.needsUpdate = true;
    }
  }
  function wantsEdges(object) {
    for (let at = object; at; at = at.parent) {
      const carried = at.userData?.gltfExtensions?.MOSAIC_components?.components ?? [];
      const said = carried.find((component) => component.type === "core::edges");
      if (said) return said.value?.draw !== false;
    }
    return true;
  }
  function drawingsOn(object) {
    const carried = object.userData?.gltfExtensions?.MOSAIC_components?.components ?? [];
    const drawings = carried.filter((component) => component.type === "w3c::svg" && component.value?.svg);
    if (drawings.length === 0) return null;
    const groups = /* @__PURE__ */ new Map();
    const gather = (geometry, colour, opacity) => {
      if (!geometry || !geometry.attributes.position || geometry.attributes.position.count === 0) return;
      const layout = Object.keys(geometry.attributes).sort().join(",");
      const key2 = colour.getHexString() + "|" + opacity.toFixed(3) + "|" + layout + "|" + (geometry.index ? "indexed" : "flat");
      let group2 = groups.get(key2);
      if (!group2) {
        group2 = { colour, opacity, pieces: [] };
        groups.set(key2, group2);
      }
      group2.pieces.push(geometry);
    };
    for (const drawing of drawings) {
      let parsed;
      try {
        parsed = svgLoader.parse(drawing.value.svg);
      } catch (error) {
        console.warn(
          "mosaic: an svg on " + (object.name ?? "a node") + " could not be read:",
          error.message ?? error
        );
        continue;
      }
      for (const path of parsed.paths) {
        const style = path.userData?.style ?? {};
        if (style.fill !== void 0 && style.fill !== "none") {
          for (const shape of svg.SVGLoader.createShapes(path)) {
            gather(new THREE.ShapeGeometry(shape), path.color, style.fillOpacity ?? 1);
          }
        }
        if (style.stroke !== void 0 && style.stroke !== "none") {
          const colour = new THREE.Color().setStyle(style.stroke);
          for (const piece of path.subPaths) {
            gather(svg.SVGLoader.pointsToStroke(piece.getPoints(), style), colour, style.strokeOpacity ?? 1);
          }
        }
      }
    }
    const group = new THREE.Group();
    for (const { colour, opacity, pieces } of groups.values()) {
      const merged = pieces.length === 1 ? pieces[0] : utils.mergeGeometries(pieces);
      if (!merged) continue;
      if (pieces.length > 1) for (const piece of pieces) piece.dispose();
      group.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({
        color: colour,
        side: THREE.DoubleSide,
        // A drawing is a drawing: it is the colour it says it is, not the colour the
        // lighting would make of it.
        toneMapped: false,
        transparent: opacity < 1,
        opacity
      })));
    }
    if (group.children.length === 0) return null;
    group.scale.y = -1;
    group.applyMatrix4(object.matrixWorld);
    return group;
  }
  function collapse(root) {
    root.updateMatrixWorld(true);
    const groups = /* @__PURE__ */ new Map();
    const awkward = [];
    let instances = 0;
    const drawings = [];
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      const drawn2 = drawingsOn(object);
      if (drawn2) drawings.push(drawn2);
    });
    root.traverse((object) => {
      if (!object.isMesh || !object.geometry) return;
      instances++;
      if (object.isSkinnedMesh || object.morphTargetInfluences || Array.isArray(object.material)) {
        awkward.push(object);
        return;
      }
      const attributes = Object.keys(object.geometry.attributes).sort().join(",");
      const key2 = object.material.uuid + "|" + attributes + "|" + (object.geometry.index ? "indexed" : "flat");
      let group = groups.get(key2);
      if (!group) {
        group = { material: object.material, meshes: [] };
        groups.set(key2, group);
      }
      group.meshes.push(object);
    });
    const out = new THREE.Group();
    for (const group of groups.values()) {
      const distinct = /* @__PURE__ */ new Map();
      let vertices = 0;
      let indices = 0;
      for (const mesh of group.meshes) {
        if (distinct.has(mesh.geometry.uuid)) continue;
        distinct.set(mesh.geometry.uuid, mesh.geometry);
        vertices += mesh.geometry.attributes.position.count;
        indices += mesh.geometry.index ? mesh.geometry.index.count : 0;
      }
      try {
        const batch = new THREE.BatchedMesh(group.meshes.length, vertices, indices, group.material);
        const ids = /* @__PURE__ */ new Map();
        for (const [uuid, geometry] of distinct) ids.set(uuid, batch.addGeometry(geometry));
        for (const mesh of group.meshes) {
          batch.setMatrixAt(batch.addInstance(ids.get(mesh.geometry.uuid)), mesh.matrixWorld);
        }
        batch.perObjectFrustumCulled = false;
        batch.sortObjects = group.material.transparent === true;
        batch.computeBoundingBox();
        batch.computeBoundingSphere();
        batch.castShadow = true;
        batch.receiveShadow = true;
        out.add(batch);
      } catch (error) {
        for (const mesh of group.meshes) {
          const one = new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material);
          one.castShadow = true;
          one.receiveShadow = true;
          out.add(one);
        }
      }
    }
    for (const mesh of awkward) {
      const one = new THREE.Mesh(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material);
      one.castShadow = true;
      one.receiveShadow = true;
      for (const material of [].concat(one.material ?? [])) foliage(material);
      out.add(one);
    }
    for (const drawing of drawings) out.add(drawing);
    const edgesOf = /* @__PURE__ */ new Map();
    let placed = 0;
    const toEdge = [...groups.values()].flatMap((group) => group.meshes).concat(awkward).filter(wantsEdges);
    for (const mesh of toEdge) {
      let edges = edgesOf.get(mesh.geometry.uuid);
      if (edges === void 0) {
        edges = new THREE.EdgesGeometry(mesh.geometry, EDGE_ANGLE);
        edgesOf.set(mesh.geometry.uuid, edges);
      }
      placed += edges.attributes.position.count / 2;
    }
    let drawnEdges = 0;
    if (placed > 0 && placed <= EDGE_BUDGET) {
      const baked = [];
      for (const mesh of toEdge) {
        const edges = edgesOf.get(mesh.geometry.uuid);
        if (!edges || edges.attributes.position.count === 0) continue;
        baked.push(edges.clone().applyMatrix4(mesh.matrixWorld));
      }
      const merged = baked.length === 1 ? baked[0] : utils.mergeGeometries(baked);
      if (baked.length > 1) for (const one of baked) one.dispose();
      if (merged) {
        const lines = new THREE.LineSegments(merged, new THREE.LineBasicMaterial({
          color: EDGE_COLOUR,
          // Not tone mapped: the line is a drawn mark at a chosen weight, and it should be
          // that weight whatever the exposure is doing to the surfaces underneath it.
          toneMapped: false
        }));
        lines.frustumCulled = false;
        out.add(lines);
        drawnEdges = Math.round(merged.attributes.position.count / 2);
      }
    }
    for (const edges of edgesOf.values()) edges.dispose();
    for (const group of groups.values()) {
      group.material.polygonOffset = true;
      group.material.polygonOffsetFactor = 1;
      group.material.polygonOffsetUnits = 1;
      foliage(group.material);
    }
    root.traverse((object) => {
      if (object.isMesh && object.geometry) object.geometry.dispose();
    });
    let drawnTriangles = 0;
    for (const group of groups.values()) {
      for (const mesh of group.meshes) {
        const geometry = mesh.geometry;
        const count = geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0;
        drawnTriangles += count / 3;
      }
    }
    for (const drawing of drawings) {
      drawing.traverse((one) => {
        if (!one.isMesh || !one.geometry) return;
        const geometry = one.geometry;
        const count = geometry.index ? geometry.index.count : geometry.attributes.position?.count ?? 0;
        drawnTriangles += count / 3;
      });
    }
    out.userData.triangles = Math.round(drawnTriangles);
    out.userData.summary = instances.toLocaleString() + " meshes in " + out.children.length + (out.children.length === 1 ? " draw" : " draws") + (drawnEdges > 0 ? " \xB7 " + drawnEdges.toLocaleString() + " edges" : placed > EDGE_BUDGET ? " \xB7 edges left off, " + Math.round(placed).toLocaleString() + " is too many" : "") + (drawings.length > 0 ? " \xB7 " + drawings.length + (drawings.length === 1 ? " drawing" : " drawings") : "");
    return out;
  }
  function look(at) {
    const box = new THREE.Box3();
    at.updateMatrixWorld(true);
    at.traverse((object) => {
      if (object.isBatchedMesh) {
        if (object.boundingBox) box.union(object.boundingBox);
      } else if (object.isMesh && object.geometry) {
        object.geometry.computeBoundingBox();
        box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
      }
    });
    if (box.isEmpty()) return;
    const middle = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1e-4);
    camera.near = radius / 1e3;
    camera.far = radius * 100;
    const away = radius / Math.sin(camera.fov / 2 * Math.PI / 180);
    camera.position.copy(middle).add(new THREE.Vector3(1, 0.55, 1).normalize().multiplyScalar(away));
    camera.updateProjectionMatrix();
    controls.target.copy(middle);
    controls.update();
    key.target.position.copy(middle);
    key.position.copy(middle).add(new THREE.Vector3(-0.7, 0.62, 0.5).normalize().multiplyScalar(radius * 2.5));
    ground.position.set(middle.x, 36, middle.z);
    ground.scale.set(radius * 12, radius * 12, 1);
    const reach = radius * 2;
    const frustum = key.shadow.camera;
    frustum.left = -reach;
    frustum.right = reach;
    frustum.top = reach;
    frustum.bottom = -reach;
    frustum.near = radius * 0.1;
    frustum.far = radius * 6;
    frustum.updateProjectionMatrix();
    key.shadow.normalBias = radius * 0.01;
  }
  async function show2(bytes) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    clear();
    const file = await new Promise((resolve, reject) => loader.parse(bytes, "", resolve, reject));
    const model = collapse(file.scene);
    content.add(model);
    look(model);
    drawn = 0;
    model.traverse((one) => {
      if (one.isMesh || one.isLine || one.isLineSegments) drawn++;
    });
    triangles = model.userData.triangles ?? 0;
    invalidate();
    return { text: model.userData.summary, drawn };
  }
  return { show: show2, clear };
}
async function intoViewer(saying, pending) {
  say(saying);
  try {
    const response = await pending;
    const bytes = await response.arrayBuffer();
    const nodes = response.headers.get("x-mosaic-nodes");
    const meshes = response.headers.get("x-mosaic-meshes");
    const drawing = await viewer();
    say("drawing " + (bytes.byteLength / 1048576).toFixed(1) + " MB of glb\u2026");
    const summary = await drawing.show(bytes);
    if (summary.drawn === 0) {
      say((nodes ? nodes + " nodes, " : "") + "nothing to draw in the answer" + (compose() ? "" : " \u2014 tick compose if it comes from a type"), true);
      return;
    }
    say((nodes ? nodes + " nodes, " : "") + (meshes ? meshes + " meshes, " : "") + bytes.byteLength + " bytes of glb \u2014 " + summary.text);
  } catch (error) {
    say(String(error.message ?? error), true);
  }
}
$("file").onchange = async (event) => {
  const files = [...event.target.files];
  let last;
  for (const file of files) {
    say("uploading " + file.name + "\u2026");
    try {
      const added = await source.add(file.name, new Uint8Array(await file.arrayBuffer()));
      last = added;
      state.shown.add(added.id);
      state.version.set(added.id, added.versions[added.versions.length - 1].versionId);
    } catch (error) {
      say(file.name + ": " + (error.message ?? error), true);
      return;
    }
  }
  event.target.value = "";
  await loadTesserae();
  if (last) await loadScene();
};
$("compose").onchange = async () => {
  const selected = state.selected;
  await loadScene();
  if (selected && state.scene?.nodes[selected]) select(selected);
};
$("whole").onclick = () => showEverything();
async function reload() {
  const selected = state.selected;
  state.components.clear();
  state.glb = null;
  await loadScene();
  if (selected && state.scene?.nodes[selected]) select(selected);
}
async function start(from) {
  source = from;
  state.tesserae = [];
  state.shown.clear();
  state.version.clear();
  state.expanded.clear();
  state.components.clear();
  state.scene = null;
  state.selected = null;
  state.glb = null;
  const upload = $("file")?.closest("label");
  if (upload && !canUpload()) upload.hidden = true;
  await loadTesserae();
}

// src/viewer/app/boot-static.ts
var EXAMPLES = "examples";
var say2 = (message2, isError = false) => {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message2;
  status.dataset["error"] = String(isError);
};
function picker(examples, onChoose) {
  const label = document.createElement("label");
  label.className = "examples";
  label.append("example ");
  const select2 = document.createElement("select");
  select2.id = "example";
  for (const example of examples) {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.name;
    if (example.description) option.title = example.description;
    select2.append(option);
  }
  select2.onchange = () => onChoose(select2.value);
  label.append(select2);
  const header = document.querySelector("header");
  const before = document.getElementById("status");
  if (before) header?.insertBefore(label, before);
  else header?.append(label);
  return select2;
}
function asked() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
  const files = raw.endsWith("/files");
  return { id: files ? raw.slice(0, -"/files".length) : raw, files };
}
async function show(example, openFiles) {
  const directory = EXAMPLES + "/" + example.id;
  say2("reading " + example.name + "\u2026");
  const { tesserae, warnings } = await loadExample(directory, example, void 0);
  const source2 = new ArchiveSource(tesserae);
  await start(source2);
  document.getElementById("files-toggle")?.remove();
  document.getElementById("editor")?.remove();
  document.body.classList.remove("editing");
  await mountEditor({ source: source2, onSaved: () => reload(), say: say2, open: openFiles });
  const wanted = example.shown ?? example.archives;
  const stems = new Set(wanted.map((name) => name.replace(/\.[^./]+$/, "").split("/").pop()));
  for (const tessera of await source2.tesserae()) {
    if (!stems.has(tessera.name)) continue;
    const tick = [...document.querySelectorAll(".tessera input[type=checkbox]")].find((box) => box.closest(".tessera")?.title === tessera.id);
    if (tick && !tick.checked) tick.click();
  }
  if (warnings.length > 0) {
    const panel = document.getElementById("warnings");
    if (panel) {
      panel.hidden = false;
      panel.textContent = warnings.join(" \xB7 ");
    }
  }
}
async function main() {
  let index;
  try {
    const response = await fetch(EXAMPLES + "/index.json");
    if (!response.ok) throw new Error(response.status + " reading the example list");
    index = await response.json();
  } catch (error) {
    say2("no examples to show: " + (error instanceof Error ? error.message : String(error)), true);
    await start(new ArchiveSource());
    return;
  }
  if (index.examples.length === 0) {
    say2("no examples to show", true);
    await start(new ArchiveSource());
    return;
  }
  const choose = async (id, openFiles = false) => {
    const example = index.examples.find((one) => one.id === id) ?? index.examples[0];
    location.hash = example.id + (openFiles ? "/files" : "");
    try {
      await show(example, openFiles);
    } catch (error) {
      say2(example.name + ": " + (error instanceof Error ? error.message : String(error)), true);
    }
  };
  const wanted = asked();
  const opening = index.examples.find((one) => one.id === wanted.id) ?? index.examples[0];
  const select2 = picker(index.examples, (id) => void choose(id));
  select2.value = opening.id;
  window.addEventListener("hashchange", () => {
    const now = asked();
    if (now.id && now.id !== select2.value && index.examples.some((one) => one.id === now.id)) {
      select2.value = now.id;
      void choose(now.id, now.files);
    }
  });
  await choose(opening.id, wanted.files);
}
await main();
