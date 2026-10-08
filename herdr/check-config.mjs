// Offline native-parser checks only. Never use an inherited live config path or Herdr socket command.
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const spaces = await readFile(new URL('./spaces.toml', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('./sidebar.toml', import.meta.url), 'utf8');
const [theme, rows] = spaces.split('[ui.sidebar.spaces]');
assert.ok(theme && rows);
const keys = theme.split('[theme.custom]')[1].trim();
const merged = sidebar.replace('[theme.custom]', '[theme.custom]\n' + keys) + '\n[ui.sidebar.spaces]' + rows;
const copies = { spaces, sidebar, merged, invalid: spaces.replace('"state_icon",', '{ token = "not_a_builtin" },') };
const dir = await mkdtemp(join(tmpdir(), 'spaces-config-'));
try {
  for (const [name, content] of Object.entries(copies)) {
    const path = join(dir, name + '.toml'); await writeFile(path, content);
    const result = spawnSync('herdr', ['config', 'check'], { env: { ...process.env, HERDR_CONFIG_PATH: path }, encoding: 'utf8', timeout: 5000 });
    if (name === 'invalid') {
      assert.equal(result.status, 1, 'invalid config must be rejected');
      assert.match(result.stdout + result.stderr, /unknown sidebar token/);
      console.log('invalid: rejected (exit 1, expected)');
    } else {
      assert.equal(result.status, 0, `${name} must parse and validate`);
      assert.match(result.stdout + result.stderr, /config: ok/);
      console.log(`${name}: config: ok (exit 0)`);
    }
  }
} finally { await rm(dir, { recursive: true, force: true }); }
