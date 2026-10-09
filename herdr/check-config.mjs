// Offline native-parser checks only. Never use an inherited live config path or Herdr socket command.
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const spaces = await readFile(new URL('./spaces.toml', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('./sidebar.toml', import.meta.url), 'utf8');
const theme = await readFile(new URL('./theme.toml', import.meta.url), 'utf8');
const [spacesTheme, rows] = spaces.split('[ui.sidebar.spaces]');
assert.ok(spacesTheme && rows);
const keys = spacesTheme.split('[theme.custom]')[1].trim();
const merged = sidebar.replace('[theme.custom]', '[theme.custom]\n' + keys) + '\n[ui.sidebar.spaces]' + rows;
// All three fragments in one config: theme.toml is only [theme.custom], so its keys join the same table.
const themeKeys = theme.split(/^\[theme\.custom\]$/m)[1].trim();
const all = merged.replace(/^\[theme\.custom\]$/m, '[theme.custom]\n' + themeKeys);
assert.equal(all.match(/^\[theme\.custom\]$/gm).length, 1, 'one [theme.custom] header');
const copies = { spaces, sidebar, theme, merged, all, invalid: spaces.replace('"state_icon",', '{ token = "not_a_builtin" },'),
  // A misspelled theme key must be reported, so the theme copy's ok means Herdr knows all 11 keys.
  invalidTheme: theme.replace(/^peach /m, 'peachy ') };
const dir = await mkdtemp(join(tmpdir(), 'spaces-config-'));
try {
  for (const [name, content] of Object.entries(copies)) {
    const path = join(dir, name + '.toml'); await writeFile(path, content);
    const result = spawnSync('herdr', ['config', 'check'], { env: { ...process.env, HERDR_CONFIG_PATH: path }, encoding: 'utf8', timeout: 5000 });
    if (name === 'invalid' || name === 'invalidTheme') {
      assert.equal(result.status, 1, `${name} config must be rejected`);
      assert.match(result.stdout + result.stderr, name === 'invalid' ? /unknown sidebar token/ : /unknown config key theme\.custom\.peachy/);
      console.log(`${name}: rejected (exit 1, expected)`);
    } else {
      assert.equal(result.status, 0, `${name} must parse and validate`);
      assert.match(result.stdout + result.stderr, /config: ok/);
      console.log(`${name}: config: ok (exit 0)`);
    }
  }
} finally { await rm(dir, { recursive: true, force: true }); }
