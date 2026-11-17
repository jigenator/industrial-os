import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const theme = fileURLToPath(new URL('../industrial-os.zsh-theme', import.meta.url));
const specimen = fileURLToPath(new URL('../examples/states.zsh', import.meta.url));
const plain = (text) => text.replace(/\x1b\[[\d;]*m/g, '');
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
    const branch = state === 'detached' ? 'detached @108423c' : 'main';
    const word = state === 'modified' ? 'modified' : state === 'unavailable' ? 'status unavailable' : 'clean';
    const git = state === 'no-git' ? '' : `  ⑂ ${branch} ${word}`;
    const failed = state === 'failed';
    assert.equal(plain(prompt), `${path}${git}  ${failed ? '✕ 127 ' : ''}› `);
    assert.match(prompt, /\x1b\[38;2;/, 'real truecolor ANSI');
    if (failed) assert.match(prompt, /\x1b\[38;2;242;71;35m/);
    if (state === 'modified') assert.match(prompt, /\x1b\[38;2;215;158;82m/);
    if (state === 'unavailable') {
      assert.doesNotMatch(plain(prompt), /clean/);
      assert.match(prompt, /\x1b\[38;2;255;255;255mstatus unavailable/);
    }
  });
}

function isolated(script) {
  const root = mkdtempSync(join(tmpdir(), 'ios-zsh-test-'));
  const env = { ...process.env, HOME: root };
  for (const name of Object.keys(env)) if (name.startsWith('GIT_')) delete env[name];
  Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' });
  try {
    return zsh(['-c', `
      setopt err_exit pipe_fail
      cd -- "$HOME"
      git init -q -b main --template= --object-format=sha1
      git config core.hooksPath /dev/null
      git config user.name Test
      git config user.email test@example.invalid
      print fixture > tracked
      git add tracked
      git commit -qm fixture
      source "$THEME"
      ${script}
    `], { env: { ...env, THEME: theme }, cwd: root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('re-source keeps the prompt hook unique and preserves other hooks', () => {
  const output = isolated(`
    [[ $_ios_path == '~' ]] || exit 8
    other_hook() { :; }
    add-zsh-hook precmd other_hook
    source "$THEME"
    [[ \${(j: :)precmd_functions} == '_ios_precmd other_hook' ]] || exit 15
    print ok
  `);
  assert.equal(output, 'ok\n');
});

test('precmd captures command failure before collection', () => {
  const output = isolated(`
    fail() { return 42; }
    fail || _ios_precmd
    print -P -- "$PROMPT"
  `);
  assert.match(plain(output), /✕ 42 › /);
  assert.match(output, /\x1b\[38;2;242;71;35m✕ 42 \x1b\[38;2;242;71;35m›/);
});

test('modified includes unstaged, staged, untracked and submodule worktree changes', () => {
  const output = isolated(`
    for kind in unstaged staged untracked; do
      git reset --hard -q
      rm -f untracked
      case $kind in
        unstaged) print change >> tracked ;;
        staged) print change >> tracked; git add tracked ;;
        untracked) print change > untracked ;;
      esac
      _ios_collect
      [[ $_ios_state == modified ]] || exit 30
    done
    rm -f untracked
    git -c protocol.file.allow=always submodule add -q "$HOME" child
    git commit -qm submodule
    _ios_collect
    [[ $_ios_state == clean ]] || exit 31
    print change >> child/tracked
    _ios_collect
    [[ $_ios_state == modified ]] || exit 32
    print ok
  `);
  assert.equal(output, 'ok\n');
});

test('untrusted branch and directory text stays literal under prompt_subst', () => {
  // A literal space is forbidden in Git refs, so use its executable IFS equivalent there.
  const output = isolated(`
    branch='$(touch\${IFS}pwned)-%F{red}-\`touch\${IFS}pwned-backtick\`'
    git checkout -qb "$branch"
    directory='$(touch pwned)-%F{red}-\`touch pwned-backtick\`'
    mkdir -- "$directory"
    cd -- "$directory"
    _ios_collect
    _ios_render 0
    print -P -- "$PROMPT"
    [[ ! -e pwned && ! -e pwned-backtick ]] || exit 40
    [[ ! -e "$HOME/pwned" && ! -e "$HOME/pwned-backtick" ]] || exit 41
  `);
  const text = plain(output);
  assert.equal(text.split('$(touch pwned)').length - 1, 1);
  assert.equal(text.split('$(touch${IFS}pwned)').length - 1, 1);
  assert.equal(text.split('%F{red}').length - 1, 2);
  assert.equal(text.split('`touch pwned-backtick`').length - 1, 1);
  assert.equal(text.split('`touch${IFS}pwned-backtick`').length - 1, 1);
});

test('controls and bidi overrides are replaced, Unicode and literal percent survive', () => {
  const output = isolated(`
    _ios_escape $'日本語%F{red}\\n\\e\\u202e\\u2066'
    print -P -- "$REPLY"
  `);
  assert.equal(output, '日本語%F{red}????\n');
});

test('unborn branch is clean; ignored files do not count', () => {
  const output = isolated(`
    mkdir empty
    cd empty
    git init -q -b unborn --template=
    _ios_collect
    [[ $_ios_branch == unborn && $_ios_state == clean ]] || exit 50
    mkdir -p .git/info
    print ignored > .git/info/exclude
    print ignored > ignored
    _ios_collect
    [[ $_ios_state == clean ]] || exit 51
    print ok
  `);
  assert.equal(output, 'ok\n');
});
