// Source rules: no hex colour literal anywhere in the plugin (the design system owns colour values), and
// imports only from the plugin itself, the locked dependencies, Bun and Node built-ins, and exported
// design-system subpaths.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const REPO = resolve(ROOT, '..', '..');
const SKIP = new Set(['node_modules', 'bun.lock']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name) || name.startsWith('.')) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const all = files(ROOT);
const code = all.filter((f) => /\.(ts|mts|mjs|js)$/.test(f));

describe('source', () => {
  test('no hex colour literal in any file', () => {
    // Built from parts so this file does not match itself.
    const hex = new RegExp(['#', '[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?', '(?![0-9A-Za-z_-])'].join(''));
    const wide = new RegExp(['0', 'x[0-9a-fA-F]{6,}'].join(''));
    const found = all.flatMap((f) => readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (hex.test(line) || wide.test(line) ? [`${relative(ROOT, f)}:${i + 1}`] : [])));
    expect(found).toEqual([]);
  });

  test('imports stay inside the plugin, its locked dependencies, built-ins and exported design-system subpaths', () => {
    const exportsMap = (JSON.parse(readFileSync(join(REPO, 'design-system', 'package.json'), 'utf8')) as { exports: Record<string, string> }).exports;
    const deps = Object.keys((JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }).dependencies);
    const bad: string[] = [];
    let designSystem = 0;
    for (const f of code) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|declare module\s+)['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        const where = `${relative(ROOT, f)}: ${spec}`;
        if (spec.startsWith('.')) {
          if (relative(ROOT, resolve(dirname(f), spec)).startsWith('..')) bad.push(where);
        } else if (spec.startsWith('@industrial-os/design-system')) {
          designSystem++;
          if (!(`.${spec.slice('@industrial-os/design-system'.length)}` in exportsMap)) bad.push(where);
        } else if (!(spec.startsWith('node:') || spec.startsWith('bun:') || deps.some((d) => spec === d || spec.startsWith(`${d}/`)))) bad.push(where);
      }
    }
    expect(bad).toEqual([]);
    expect(designSystem).toBeGreaterThan(0);
  });

  test('the design system is not in the plugin manifest; Bun resolves it from the root', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) expect(pkg[field]?.['@industrial-os/design-system']).toBeUndefined();
    expect(pkg.dependencies).toEqual({ '@effect/platform-bun': '4.0.6', effect: '4.0.6' });
    expect(pkg.devDependencies).toEqual({ '@types/bun': '1.4.4', typescript: '7.0.2' });
  });

  test('only the reader runs tatsu and only the restore hook runs herdr', () => {
    const spawns = code.filter((f) => f.includes(`${ROOT}/src/`) || f.includes(`${ROOT}/bin/`))
      .filter((f) => /ChildProcess\.make|Bun\.spawn|child_process|execFile/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f)).sort();
    expect(spawns).toEqual(['src/reader.ts', 'src/restore.ts']);
    expect(readFileSync(join(ROOT, 'src/restore.ts'), 'utf8')).not.toMatch(/tatsu/i);
  });
});
