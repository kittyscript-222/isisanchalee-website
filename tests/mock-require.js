// tests/mock-require.js
// Minimal, dependency-free require() interceptor for tests.
// Lets us swap out modules like 'resend' and 'stripe' for fakes
// without touching the actual source files or installing new packages.

const Module = require('module');
const originalLoad = Module._load;

let mocks = {};

function setMocks(newMocks) {
  mocks = newMocks;
}

function clearMocks() {
  mocks = {};
}

Module._load = function (request, parent, isMain) {
  if (mocks[request]) {
    return mocks[request];
  }
  return originalLoad.apply(this, arguments);
};

module.exports = { setMocks, clearMocks };
