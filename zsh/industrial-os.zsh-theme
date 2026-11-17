# Industrial OS — Acid / Black. See README.md for installation and docs/design.md for layout.
# zsh cannot import the design system; test/palette.test.mjs checks these mirrored roles.
typeset -gA _ios_colors=(
  primary '#ffffff'
  secondary '#cfcfcf'
  accent '#c0fe04'
  warning '#d79e52'
  critical '#f24723'
)

# Substitute only this variable reference, never source text assembled from Git or PWD.
setopt prompt_subst prompt_percent no_prompt_bang
PROMPT='${_ios_prompt}'

_ios_escape() {
  emulate -L zsh
  # Controls and bidi overrides are not display text; percent is zsh prompt syntax.
  REPLY=${1//[[:cntrl:]$'\u202a'-$'\u202e'$'\u2066'-$'\u2069']/?}
  REPLY=${REPLY//\%/%%}
}

_ios_collect() {
  emulate -L zsh
  local display=$PWD branch revision changes
  if [[ $PWD == "$HOME" || $PWD == "$HOME/"* ]]; then
    display="~${PWD#"$HOME"}"
  fi
  _ios_escape "$display"; typeset -g _ios_path=$REPLY
  typeset -g _ios_branch='' _ios_state='' _ios_state_role=primary
  [[ $(command git --no-optional-locks rev-parse --is-inside-work-tree 2>/dev/null) == true ]] || return 0

  if branch=$(command git --no-optional-locks symbolic-ref --quiet --short HEAD 2>/dev/null); then
    _ios_escape "$branch"; _ios_branch=$REPLY
  elif [[ $? == 1 ]] && revision=$(command git --no-optional-locks rev-parse --verify --short HEAD 2>/dev/null); then
    _ios_branch="detached @$revision"
  else
    _ios_state='status unavailable'
    return 0
  fi
  # shortcut: synchronous status can delay huge repositories; upgrade to async after measured delays.
  if changes=$(command git --no-optional-locks -c core.fsmonitor=false status --porcelain=v1 -z --untracked-files=normal --ignore-submodules=none 2>/dev/null); then
    if [[ -n $changes ]]; then
      _ios_state=modified _ios_state_role=warning
    else
      _ios_state=clean _ios_state_role=accent
    fi
  else
    _ios_state='status unavailable'
  fi
}

# Collected text is escaped; expansion through PROMPT is deliberately nonrecursive.
_ios_render() {
  emulate -L zsh
  local code=$1
  local white="%F{$_ios_colors[primary]}" sec="%F{$_ios_colors[secondary]}"
  local acid="%F{$_ios_colors[accent]}" crit="%F{$_ios_colors[critical]}"
  local state='' git='' mark=$acid failure=''
  if [[ -n $_ios_state ]]; then
    state="%F{$_ios_colors[$_ios_state_role]}$_ios_state%f"
    [[ $_ios_state != 'status unavailable' ]] && state="%B$state%b"
    if [[ -n $_ios_branch ]]; then
      git="$sec⑂ $_ios_branch $state"
    else
      git=$state
    fi
  fi
  if (( code )); then
    mark=$crit
    failure="%B${crit}✕ $code "
  fi
  typeset -g _ios_prompt="%B$white$_ios_path%b"
  [[ -n $git ]] && _ios_prompt+="  $git"
  _ios_prompt+="  $failure${mark}›%b%f "
}

_ios_precmd() {
  local code=$?
  emulate -L zsh
  _ios_collect
  _ios_render "$code"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd _ios_precmd
_ios_precmd
