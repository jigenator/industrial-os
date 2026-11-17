#!/usr/bin/env zsh
# Real theme, isolated repositories, deterministic commits. No user Git config or hooks.
emulate -LR zsh
setopt err_exit pipe_fail
if (( $# > 1 )) || [[ ${1:-} != (''|--machine) ]]; then
  print -u2 -- 'usage: zsh examples/states.zsh [--machine]'
  exit 2
fi
mode=${1:-}
theme=${0:A:h:h}/industrial-os.zsh-theme
root=$(mktemp -d)
trap 'cd /; rm -rf -- "$root"' EXIT
for name in ${(k)parameters}; do
  [[ $name == GIT_* ]] && unset "$name"
done
export HOME=$root GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Specimen GIT_AUTHOR_EMAIL=specimen@example.invalid
export GIT_COMMITTER_NAME=Specimen GIT_COMMITTER_EMAIL=specimen@example.invalid
export GIT_AUTHOR_DATE='2000-01-01T00:00:00Z' GIT_COMMITTER_DATE='2000-01-01T00:00:00Z'
mkdir -p "$root/projects/demo" "$root/plain" "$root/bin"
real_git=$(whence -p git)
# Only the unavailable specimen faults status; discovery and branch still use real Git.
cat > "$root/bin/git" <<'SH'
#!/bin/sh
for arg do
  if [ "$arg" = status ] && [ "${IOS_SPECIMEN_FAIL_STATUS:-0}" = 1 ]; then exit 128; fi
done
exec "$IOS_SPECIMEN_GIT" "$@"
SH
chmod +x "$root/bin/git"
export IOS_SPECIMEN_GIT=$real_git
export PATH="$root/bin:$PATH"
cd "$root/projects/demo"
git init -q -b main --template= --object-format=sha1
git config core.hooksPath /dev/null
print -r -- fixture > tracked
git add tracked
git commit -qm fixture
source "$theme"

for state in clean modified detached unavailable no-git failed; do
  cd "$root/projects/demo"
  export IOS_SPECIMEN_FAIL_STATUS=0
  git checkout -q main
  rm -f untracked
  code=0
  case $state in
    modified) print -r -- change > untracked ;;
    detached) git checkout -q --detach HEAD ;;
    unavailable) export IOS_SPECIMEN_FAIL_STATUS=1 ;;
    no-git) cd "$root/plain" ;;
    failed) code=127 ;;
  esac
  if (( code )); then
    (exit "$code") || _ios_precmd
  else
    true
    _ios_precmd
  fi
  if [[ $mode == --machine ]]; then
    printf '%s\0' "$state"
    print -Pn -- "$PROMPT"
    printf '\0'
  else
    print -r -- "--- $state / PROMPT ---"
    print -P -- "$PROMPT"
  fi
done
