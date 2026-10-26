import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const here = (path) => new URL(path, import.meta.url);

test('the package is private, unpublished ESM with only an exports map', () => {
  assert.equal(pkg.name, '@industrial-os/design-system');
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dependencies, undefined, 'the design system has no dependencies');
  assert.equal(pkg.main, undefined, 'consumers import named subpaths, not a root entry');
});

test('every export names an existing module, and no test, example, or motion seam is exported', () => {
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    assert.match(subpath, /^\.\/(foundation|elements|motions)\/[a-z-]+$/, subpath);
    assert.ok(existsSync(here(target)), `${subpath} -> ${target}`);
    assert.doesNotMatch(target, /\.test\.mjs$|^\.\/examples\/|\/frame\.mjs$/, target);
  }
});

test('every foundation module, element, and motion primitive is exported', () => {
  const expected = [
    ...readdirSync(here('./foundation/')).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => `./foundation/${f.slice(0, -4)}`),
    ...readdirSync(here('./elements/')).map((e) => `./elements/${e}`),
    ...readdirSync(here('./motions/')).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && f !== 'frame.mjs').map((f) => `./motions/${f.slice(0, -4)}`),
  ];
  assert.deepEqual(Object.keys(pkg.exports).sort(), expected.sort());
});

test('every export loads through the package name and exposes the same module as its file', async () => {
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    const byName = await import(`@industrial-os/design-system/${subpath.slice(2)}`);
    const byFile = await import(here(target).href);
    assert.equal(byName, byFile, subpath);
    assert.ok(Object.keys(byName).length > 0, `${subpath} exports something`);
  }
  await assert.rejects(import('@industrial-os/design-system/motions/frame'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
});

// Planned Lunalee public imports; new element families are admitted with their DS-2 implementation.
const lunaleeModules = [
  'foundation/cells', 'foundation/palette', 'foundation/signal-colors', 'foundation/industrialos-colors',
  'foundation/seeded', 'foundation/surface', 'foundation/surface-palette',
  'elements/label-plate', 'elements/lamp', 'elements/state-chip', 'elements/transcript-marker',
  'motions/flash', 'motions/ping', 'motions/wipe', 'motions/fade', 'motions/latch',
  'motions/reveal', 'motions/cycle', 'motions/beacon', 'motions/draw-in',
  'elements/tab-rule', 'elements/action-label', 'elements/popup-header', 'elements/notice-row',
  'elements/scope-meter', 'elements/sounding-meter', 'motions/scope-trace', 'motions/sounding-sweep',
  'elements/callout', 'elements/document-block', 'elements/sheet-card', 'elements/desk-tray', 'elements/operation-row', 'motions/callout-entrance', 'motions/phosphor-head',
  'elements/feed-bezel', 'elements/input-frame', 'motions/feed-scan', 'motions/corner-snap',
];

test('every planned Lunalee module is public and ships colocated declarations', () => {
  for (const subpath of lunaleeModules) {
    const target = pkg.exports[`./${subpath}`];
    assert.equal(typeof target, 'string', subpath);
    assert.ok(existsSync(here(target.replace(/\.mjs$/, '.d.mts'))), `${subpath} needs .d.mts`);
  }
});

test('root-package physical public paths resolve without loading a Pi extension or host', async () => {
  const { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { spawnSync } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'industrial-os-public-paths-'));
  try {
    mkdirSync(join(dir, 'node_modules'));
    symlinkSync(fileURLToPath(new URL('../', import.meta.url)), join(dir, 'node_modules/industrial-os'), 'dir');
    const imports = lunaleeModules.map((subpath) => `await import('industrial-os/design-system/${pkg.exports[`./${subpath}`].slice(2)}');`).join('\n');
    writeFileSync(join(dir, 'imports.mjs'), imports);
    const result = spawnSync(process.execPath, [join(dir, 'imports.mjs')], { encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
