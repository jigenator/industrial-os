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
