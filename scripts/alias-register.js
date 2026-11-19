// Lets ts-node resolve the app's "@/..." imports when running scripts/*.test.ts.
const Module = require("module");
const path = require("path");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@/")) request = path.join(__dirname, "..", "src", request.slice(2));
  return orig.call(this, request, ...rest);
};
