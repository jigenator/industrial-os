import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const config = fileURLToPath(new URL('../industrial-os.omp.json', import.meta.url));
const specimen = fileURLToPath(new URL('../examples/states.zsh', import.meta.url));
// SGR colors and OSC 8 hyperlinks (the upstream icon links to its remote).
const plain = (text) => text.replace(/\x1b\[[\d;]*m|\x1b\]8;;[^\x1b]*\x1b\\/g, '');
function zsh(args, options = {}) {
  const result = spawnSync('zsh', ['-f', ...args], { encoding: 'utf8', ...options });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stderr, '');
  return result.stdout;
}

const fields = zsh([specimen, '--machine']).split('\0');
assert.equal(fields.pop(), '');
assert.equal(fields.length, 6 * 2);
for (let i = 0; i < fields.length; i += 2) {
  const [state, prompt] = fields.slice(i, i + 2);
  test(`industrial-os: ${state}`, () => {
    const path = state === 'no-git' ? '~/plain' : '~/projects/demo';
    const branch = state === 'detached' ? 'detached at 108423c' : 'main';
    const word = state === 'modified' ? 'modified ?1' : 'clean';
    const git = state === 'no-git' ? '' : state === 'unavailable' ? '  status unavailable' : `  ⑂ ${branch} ${word}`;
    const failed = state === 'failed';
    assert.equal(plain(prompt), `${path}${git}  ${failed ? '✕ 127 ' : ''}› `);
    assert.match(prompt, /\x1b\[38;2;/, 'real truecolor ANSI');
    if (failed) assert.match(prompt, /\x1b\[38;2;242;71;35m/);
    if (state === 'modified') assert.match(prompt, /\x1b\[38;2;215;158;82mmodified/);
    if (state === 'unavailable') {
      assert.doesNotMatch(plain(prompt), /clean|⑂/);
      assert.match(prompt, /\x1b\[38;2;255;255;255mstatus unavailable/);
    }
  });
}

// Runs a zsh script in a fresh repository, with oh-my-posh's own zsh init loaded from the config.
// HOME sits outside the repository: oh-my-posh keeps its cache there, and a live shell's session must not leak in.
function isolated(script) {
  const root = mkdtempSync(join(tmpdir(), 'ios-omp-test-'));
  const home = join(root, 'home');
  const repo = join(root, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  const env = { ...process.env, HOME: home, CONFIG: config };
  for (const name of Object.keys(env)) if (/^(GIT|POSH)_/.test(name)) delete env[name];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' });
  try {
    return zsh(['-c', `
      setopt err_exit pipe_fail
      git init -q -b main --template= --object-format=sha1
      git config core.hooksPath /dev/null
      git config user.name Test
      git config user.email test@example.invalid
      print fixture > tracked
      git add tracked
      git commit -qm fixture
      eval "$(oh-my-posh init zsh --config "$CONFIG")"
      p() { oh-my-posh print primary --config "$CONFIG" --shell zsh --pwd "$PWD" --plain }
      ${script}
    `], { env, cwd: repo });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('the init hook captures command failure', () => {
  const output = isolated(`
    (( \${precmd_functions[(I)_omp_precmd]} )) || exit 9
    fail() { return 42; }
    fail || _omp_precmd
    print -P -- "$PS1"
  `);
  assert.match(plain(output), /\/repo {2}⑂ main clean {2}✕ 42 › \n$/);
  assert.match(output, /\x1b\[38;2;242;71;35m✕ 42 ›/);
});

test('modified counts unstaged, staged, untracked and submodule changes; ignored files do not count', () => {
  const output = isolated(`
    print change >> tracked; p; print
    git add tracked; p; print
    git commit -qm change; print new > untracked; p; print
    rm untracked
    git -c protocol.file.allow=always submodule add -q "$PWD" child
    git commit -qm submodule; p; print
    print change >> child/tracked; p; print
    git -C child checkout -q -- tracked
    mkdir -p .git/info; print ignored > .git/info/exclude; print ignored > ignored; p; print
  `);
  const words = output.replace(/\n$/, '').split('\n').map((line) => line.split('⑂ main ')[1]);
  assert.deepEqual(words, [
    'modified ~1  › ', 'modified staged ~1  › ', 'modified ?1  › ',
    'clean  › ', 'modified ~1  › ', 'clean  › ',
  ]);
});

test('unborn branches are clean; ahead and behind counts show against the upstream', () => {
  const output = isolated(`
    mkdir unborn; (cd unborn && git init -q -b unborn --template= && p); print
    git clone -q "$PWD" ../clone; cd ../clone
    git commit -q --allow-empty -m ahead; p; print
    git -C ../repo commit -q --allow-empty -m behind; git fetch -q; p; print
  `);
  const lines = output.replace(/\n$/, '').split('\n');
  assert.match(lines[0], /⑂ unborn clean {2}› $/);
  assert.match(lines[1], /⑂ main ↑1 clean {2}› $/);
  assert.match(lines[2], /⑂ main ↑1 ↓1 clean {2}› $/);
});

test('untrusted branch and directory text stays literal in the primary and transient prompts', () => {
  // A literal space is forbidden in Git refs, so use its executable IFS equivalent there.
  const output = isolated(`
    git checkout -qb '$(touch\${IFS}pwned)-%F{red}-\`touch\${IFS}pwned-backtick\`'
    directory='$(touch pwned)-%F{red}-\`touch pwned-backtick\`'
    mkdir -- "$directory"
    cd -- "$directory"
    _omp_precmd
    print -P -- "$PS1"
    eval "$(_omp_get_prompt transient --eval)"
    print -P -- "$PS1"
    [[ ! -e pwned && ! -e pwned-backtick ]] || exit 40
    [[ ! -e ../pwned && ! -e ../pwned-backtick ]] || exit 41
  `);
  const text = plain(output);
  assert.equal(text.split('$(touch pwned)').length - 1, 2);
  assert.equal(text.split('$(touch${IFS}pwned)').length - 1, 1);
  assert.equal(text.split('%F{red}').length - 1, 3);
  assert.equal(text.split('`touch pwned-backtick`').length - 1, 2);
  assert.equal(text.split('`touch${IFS}pwned-backtick`').length - 1, 1);
});

test('right prompt shows the clock and a project icon; secondary prompt is a grey double mark', () => {
  const output = isolated(`
    print '{}' > package.json
    oh-my-posh print right --config "$CONFIG" --shell zsh --pwd "$PWD" --plain; print
    oh-my-posh print secondary --config "$CONFIG" --shell zsh --plain; print
  `);
  const [right, secondary] = output.split('\n');
  assert.match(right, /^\ue718 \d\d:\d\d:\d\d$/);
  assert.equal(secondary, '›› ');
});
