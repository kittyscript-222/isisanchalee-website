// tests/deps.test.js
// Catches the class of bug that broke the consultation form:
// a package being require()'d in source code but not declared in
// package.json, which works locally (because node_modules exists) but
// crashes on Vercel deploy (because Vercel only installs declared deps).
//
// This is a static analysis test — it reads source files and package.json
// directly rather than executing the code, so it runs in milliseconds with
// no mocking needed and no risk of side effects.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIRS = ['api', 'lib'];

// Node built-in modules — these are always available without being in
// package.json, so we exclude them from the check.
const NODE_BUILTINS = new Set([
  'assert', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http', 'http2',
  'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process',
  'punycode', 'querystring', 'readline', 'repl', 'stream', 'string_decoder',
  'sys', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util', 'v8',
  'vm', 'wasi', 'worker_threads', 'zlib',
  // node: prefix versions
  'node:assert', 'node:buffer', 'node:child_process', 'node:cluster',
  'node:console', 'node:crypto', 'node:dgram', 'node:dns', 'node:domain',
  'node:events', 'node:fs', 'node:http', 'node:http2', 'node:https',
  'node:module', 'node:net', 'node:os', 'node:path', 'node:perf_hooks',
  'node:process', 'node:querystring', 'node:readline', 'node:repl',
  'node:stream', 'node:string_decoder', 'node:timers', 'node:tls',
  'node:tty', 'node:url', 'node:util', 'node:v8', 'node:vm',
  'node:worker_threads', 'node:zlib',
  'node:assert/strict',
  'node:test',
]);

function extractRequires(source) {
  // Match require('pkg') and require("pkg") — capture only the package name,
  // not relative paths (./foo) or absolute paths (/foo).
  const pattern = /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g;
  const packages = new Set();
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // For scoped packages (@scope/pkg) and subpath imports (pkg/subpath),
    // we only need the root package name to check against package.json.
    const raw = match[1];
    const rootPkg = raw.startsWith('@')
      ? raw.split('/').slice(0, 2).join('/')  // @scope/package
      : raw.split('/')[0];                     // package or package/subpath
    if (!NODE_BUILTINS.has(raw) && !NODE_BUILTINS.has(rootPkg)) {
      packages.add(rootPkg);
    }
  }
  return packages;
}

function getAllSourceFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const entry of fs.readdirSync(fullDir)) {
      if (entry.endsWith('.js')) {
        files.push(path.join(fullDir, entry));
      }
    }
  }
  return files;
}

test('every package require()\'d in api/ and lib/ is declared in package.json', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json not found at project root');

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const declared = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);

  const sourceFiles = getAllSourceFiles(SOURCE_DIRS);
  assert.ok(sourceFiles.length > 0, `No .js files found in ${SOURCE_DIRS.join(', ')}`);

  const undeclared = []; // { file, package }

  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const required = extractRequires(source);
    const relPath = path.relative(ROOT, filePath);

    for (const pkg of required) {
      if (!declared.has(pkg)) {
        undeclared.push({ file: relPath, package: pkg });
      }
    }
  }

  assert.equal(
    undeclared.length,
    0,
    `The following packages are require()'d in source code but missing from package.json.\n` +
    `This works locally (node_modules exists) but crashes on Vercel deploy.\n` +
    `Run: npm install ${[...new Set(undeclared.map(u => u.package))].join(' ')}\n\n` +
    undeclared.map(u => `  ${u.file}  →  require('${u.package}')`).join('\n')
  );
});

test('package.json has a "test" script defined', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  assert.ok(
    pkg.scripts && pkg.scripts.test,
    'package.json is missing a "test" script — tests won\'t run in CI'
  );
});
