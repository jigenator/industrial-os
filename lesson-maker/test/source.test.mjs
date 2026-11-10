import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
test('imports: Node, local modules, exported design-system parts, Pi at run time; no colour copies', () => {
  const exports = JSON.parse(
    readFileSync(new URL('../../design-system/package.json', import.meta.url), 'utf8'),
  ).exports;
  const files = [
    ...readdirSync(join(project, 'src')).map((name) => join(project, 'src', name)),
    join(project, 'main.mjs'),
    join(project, 'sample-image.mjs'),
  ];
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    assert.ok(!/#[0-9a-f]{6}/i.test(source), path);
    // Only the Pi bridge reaches models, only documents.mjs runs a program (the tatsu CLI, for artifacts), and only
    // the lesson file module writes files.
    // speech.mjs alone calls Google's speech endpoint (Pi has no speech models) and runs afplay, with its audio in a
    // temporary folder.
    if (path.endsWith('documents.mjs'))
      assert.ok(!/fetch\(|http:/.test(source) && /execFile\('tatsu'/.test(source), path);
    else if (path.endsWith('speech.mjs'))
      assert.ok(
        [...source.matchAll(/https?:\/\/[^\s`'"/]+/g)].every(
          (m) => m[0] === 'https://generativelanguage.googleapis.com',
        ) &&
          /spawn\('afplay'/.test(source) &&
          !/exec\(|execFile|rename\(/.test(source),
        path,
      );
    else assert.ok(!/https?:|fetch\(|child_process/.test(source), path);
    if (!path.endsWith('lesson.mjs') && !path.endsWith('speech.mjs'))
      assert.ok(!/writeFile|rename\(/.test(source), path);
    if (!path.endsWith('pi.mjs')) assert.ok(!/import\(/.test(source), path);
    for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier.startsWith('@industrial-os/design-system/'))
        assert.ok(exports['./' + specifier.slice('@industrial-os/design-system/'.length)], specifier);
      else assert.ok(specifier.startsWith('node:') || specifier.startsWith('./'), specifier);
    }
  }
  assert.equal(readFileSync(join(project, 'CLAUDE.md'), 'utf8'), '@AGENTS.md\n');
  const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies, undefined);
});
