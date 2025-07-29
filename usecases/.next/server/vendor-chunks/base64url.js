/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/base64url";
exports.ids = ["vendor-chunks/base64url"];
exports.modules = {

/***/ "(ssr)/./node_modules/base64url/dist/base64url.js":
/*!**************************************************!*\
  !*** ./node_modules/base64url/dist/base64url.js ***!
  \**************************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";
eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nvar pad_string_1 = __webpack_require__(/*! ./pad-string */ \"(ssr)/./node_modules/base64url/dist/pad-string.js\");\nfunction encode(input, encoding) {\n    if (encoding === void 0) { encoding = \"utf8\"; }\n    if (Buffer.isBuffer(input)) {\n        return fromBase64(input.toString(\"base64\"));\n    }\n    return fromBase64(Buffer.from(input, encoding).toString(\"base64\"));\n}\n;\nfunction decode(base64url, encoding) {\n    if (encoding === void 0) { encoding = \"utf8\"; }\n    return Buffer.from(toBase64(base64url), \"base64\").toString(encoding);\n}\nfunction toBase64(base64url) {\n    base64url = base64url.toString();\n    return pad_string_1.default(base64url)\n        .replace(/\\-/g, \"+\")\n        .replace(/_/g, \"/\");\n}\nfunction fromBase64(base64) {\n    return base64\n        .replace(/=/g, \"\")\n        .replace(/\\+/g, \"-\")\n        .replace(/\\//g, \"_\");\n}\nfunction toBuffer(base64url) {\n    return Buffer.from(toBase64(base64url), \"base64\");\n}\nvar base64url = encode;\nbase64url.encode = encode;\nbase64url.decode = decode;\nbase64url.toBase64 = toBase64;\nbase64url.fromBase64 = fromBase64;\nbase64url.toBuffer = toBuffer;\nexports[\"default\"] = base64url;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvYmFzZTY0dXJsL2Rpc3QvYmFzZTY0dXJsLmpzIiwibWFwcGluZ3MiOiJBQUFhO0FBQ2IsOENBQTZDLEVBQUUsYUFBYSxFQUFDO0FBQzdELG1CQUFtQixtQkFBTyxDQUFDLHVFQUFjO0FBQ3pDO0FBQ0EsK0JBQStCO0FBQy9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsK0JBQStCO0FBQy9CO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxrQkFBZSIsInNvdXJjZXMiOlsiL1VzZXJzL2FuZ2VsYWhlcnJhZG9ybG9wZXovRGVza3RvcC9DVEIvTVMzL3VzZWNhc2VzL25vZGVfbW9kdWxlcy9iYXNlNjR1cmwvZGlzdC9iYXNlNjR1cmwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHsgdmFsdWU6IHRydWUgfSk7XG52YXIgcGFkX3N0cmluZ18xID0gcmVxdWlyZShcIi4vcGFkLXN0cmluZ1wiKTtcbmZ1bmN0aW9uIGVuY29kZShpbnB1dCwgZW5jb2RpbmcpIHtcbiAgICBpZiAoZW5jb2RpbmcgPT09IHZvaWQgMCkgeyBlbmNvZGluZyA9IFwidXRmOFwiOyB9XG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihpbnB1dCkpIHtcbiAgICAgICAgcmV0dXJuIGZyb21CYXNlNjQoaW5wdXQudG9TdHJpbmcoXCJiYXNlNjRcIikpO1xuICAgIH1cbiAgICByZXR1cm4gZnJvbUJhc2U2NChCdWZmZXIuZnJvbShpbnB1dCwgZW5jb2RpbmcpLnRvU3RyaW5nKFwiYmFzZTY0XCIpKTtcbn1cbjtcbmZ1bmN0aW9uIGRlY29kZShiYXNlNjR1cmwsIGVuY29kaW5nKSB7XG4gICAgaWYgKGVuY29kaW5nID09PSB2b2lkIDApIHsgZW5jb2RpbmcgPSBcInV0ZjhcIjsgfVxuICAgIHJldHVybiBCdWZmZXIuZnJvbSh0b0Jhc2U2NChiYXNlNjR1cmwpLCBcImJhc2U2NFwiKS50b1N0cmluZyhlbmNvZGluZyk7XG59XG5mdW5jdGlvbiB0b0Jhc2U2NChiYXNlNjR1cmwpIHtcbiAgICBiYXNlNjR1cmwgPSBiYXNlNjR1cmwudG9TdHJpbmcoKTtcbiAgICByZXR1cm4gcGFkX3N0cmluZ18xLmRlZmF1bHQoYmFzZTY0dXJsKVxuICAgICAgICAucmVwbGFjZSgvXFwtL2csIFwiK1wiKVxuICAgICAgICAucmVwbGFjZSgvXy9nLCBcIi9cIik7XG59XG5mdW5jdGlvbiBmcm9tQmFzZTY0KGJhc2U2NCkge1xuICAgIHJldHVybiBiYXNlNjRcbiAgICAgICAgLnJlcGxhY2UoLz0vZywgXCJcIilcbiAgICAgICAgLnJlcGxhY2UoL1xcKy9nLCBcIi1cIilcbiAgICAgICAgLnJlcGxhY2UoL1xcLy9nLCBcIl9cIik7XG59XG5mdW5jdGlvbiB0b0J1ZmZlcihiYXNlNjR1cmwpIHtcbiAgICByZXR1cm4gQnVmZmVyLmZyb20odG9CYXNlNjQoYmFzZTY0dXJsKSwgXCJiYXNlNjRcIik7XG59XG52YXIgYmFzZTY0dXJsID0gZW5jb2RlO1xuYmFzZTY0dXJsLmVuY29kZSA9IGVuY29kZTtcbmJhc2U2NHVybC5kZWNvZGUgPSBkZWNvZGU7XG5iYXNlNjR1cmwudG9CYXNlNjQgPSB0b0Jhc2U2NDtcbmJhc2U2NHVybC5mcm9tQmFzZTY0ID0gZnJvbUJhc2U2NDtcbmJhc2U2NHVybC50b0J1ZmZlciA9IHRvQnVmZmVyO1xuZXhwb3J0cy5kZWZhdWx0ID0gYmFzZTY0dXJsO1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/base64url/dist/base64url.js\n");

/***/ }),

/***/ "(ssr)/./node_modules/base64url/dist/pad-string.js":
/*!***************************************************!*\
  !*** ./node_modules/base64url/dist/pad-string.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, exports) => {

"use strict";
eval("\nObject.defineProperty(exports, \"__esModule\", ({ value: true }));\nfunction padString(input) {\n    var segmentLength = 4;\n    var stringLength = input.length;\n    var diff = stringLength % segmentLength;\n    if (!diff) {\n        return input;\n    }\n    var position = stringLength;\n    var padLength = segmentLength - diff;\n    var paddedStringLength = stringLength + padLength;\n    var buffer = Buffer.alloc(paddedStringLength);\n    buffer.write(input);\n    while (padLength--) {\n        buffer.write(\"=\", position++);\n    }\n    return buffer.toString();\n}\nexports[\"default\"] = padString;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvYmFzZTY0dXJsL2Rpc3QvcGFkLXN0cmluZy5qcyIsIm1hcHBpbmdzIjoiQUFBYTtBQUNiLDhDQUE2QyxFQUFFLGFBQWEsRUFBQztBQUM3RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWUiLCJzb3VyY2VzIjpbIi9Vc2Vycy9hbmdlbGFoZXJyYWRvcmxvcGV6L0Rlc2t0b3AvQ1RCL01TMy91c2VjYXNlcy9ub2RlX21vZHVsZXMvYmFzZTY0dXJsL2Rpc3QvcGFkLXN0cmluZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcbmZ1bmN0aW9uIHBhZFN0cmluZyhpbnB1dCkge1xuICAgIHZhciBzZWdtZW50TGVuZ3RoID0gNDtcbiAgICB2YXIgc3RyaW5nTGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuICAgIHZhciBkaWZmID0gc3RyaW5nTGVuZ3RoICUgc2VnbWVudExlbmd0aDtcbiAgICBpZiAoIWRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH1cbiAgICB2YXIgcG9zaXRpb24gPSBzdHJpbmdMZW5ndGg7XG4gICAgdmFyIHBhZExlbmd0aCA9IHNlZ21lbnRMZW5ndGggLSBkaWZmO1xuICAgIHZhciBwYWRkZWRTdHJpbmdMZW5ndGggPSBzdHJpbmdMZW5ndGggKyBwYWRMZW5ndGg7XG4gICAgdmFyIGJ1ZmZlciA9IEJ1ZmZlci5hbGxvYyhwYWRkZWRTdHJpbmdMZW5ndGgpO1xuICAgIGJ1ZmZlci53cml0ZShpbnB1dCk7XG4gICAgd2hpbGUgKHBhZExlbmd0aC0tKSB7XG4gICAgICAgIGJ1ZmZlci53cml0ZShcIj1cIiwgcG9zaXRpb24rKyk7XG4gICAgfVxuICAgIHJldHVybiBidWZmZXIudG9TdHJpbmcoKTtcbn1cbmV4cG9ydHMuZGVmYXVsdCA9IHBhZFN0cmluZztcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/base64url/dist/pad-string.js\n");

/***/ }),

/***/ "(ssr)/./node_modules/base64url/index.js":
/*!*****************************************!*\
  !*** ./node_modules/base64url/index.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("module.exports = __webpack_require__(/*! ./dist/base64url */ \"(ssr)/./node_modules/base64url/dist/base64url.js\")[\"default\"];\nmodule.exports[\"default\"] = module.exports;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvYmFzZTY0dXJsL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFBLDJIQUFvRDtBQUNwRCx5QkFBc0IiLCJzb3VyY2VzIjpbIi9Vc2Vycy9hbmdlbGFoZXJyYWRvcmxvcGV6L0Rlc2t0b3AvQ1RCL01TMy91c2VjYXNlcy9ub2RlX21vZHVsZXMvYmFzZTY0dXJsL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kaXN0L2Jhc2U2NHVybCcpLmRlZmF1bHQ7XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gbW9kdWxlLmV4cG9ydHM7XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/base64url/index.js\n");

/***/ })

};
;