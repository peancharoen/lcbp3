#!/usr/bin/env bash
# File: specs/100-Infrastructures/145-server-cli-tools/server-tools-setup.sh
# Change Log:
# - 2026-08-19: Initial creation — bootstrap CLI tools on np-dms-lcbp3 (Ubuntu 26.04)
#
# ติดตั้งและตั้งค่า CLI tools สำหรับ admin/ops บน np-dms-lcbp3 server
# ใช้ซ้ำได้เมื่อตั้ง server ใหม่ (idempotent — รันซ้ำได้ไม่พัง)
#
# การใช้งาน:
#   sudo bash server-tools-setup.sh            # ติดตั้งครบทุกขั้นตอน
#   bash server-tools-setup.sh --skip-apt      # ข้าม apt (สำหรับเครื่องที่ลงไว้แล้ว)
#   bash server-tools-setup.sh --skip-aliases  # ข้าม alias setup
#
# ต้องการ: Ubuntu 24.04+/26.04, apt, sudo, internet access
# ไม่กระทบ: services ที่รันอยู่, cron, systemd (alias มีผลเฉพาะ interactive shell)

set -euo pipefail

# --- config -----------------------------------------------------------------
TARGET_USER="${SUDO_USER:-$(logname 2>/dev/null || echo "$USER")}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
INSTALL_DIR="/usr/local/bin"
SKIP_APT=0
SKIP_ALIASES=0
SKIP_GIT_DELTA=0

# --- helpers ----------------------------------------------------------------
log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m   %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[err]\033[0m  %s\n' "$*" >&2; exit 1; }

# --- parse args -------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --skip-apt)        SKIP_APT=1 ;;
    --skip-aliases)    SKIP_ALIASES=1 ;;
    --skip-git-delta)  SKIP_GIT_DELTA=1 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) die "unknown arg: $arg (try --help)" ;;
  esac
done

[[ "$TARGET_HOME" == "/" || -z "$TARGET_HOME" ]] && die "cannot resolve target user home"
[[ "$(id -u)" -ne 0 && "$SKIP_APT" -eq 0 ]] && die "run with sudo (or use --skip-apt)"

log "target user: $TARGET_USER"
log "target home: $TARGET_HOME"
log "install dir: $INSTALL_DIR"

# --- step 1: apt packages ---------------------------------------------------
if [[ "$SKIP_APT" -eq 0 ]]; then
  log "step 1/4: apt update + install"
  apt update
  apt install -y \
    ripgrep bat fd-find duf fzf lnav procs eza \
    du-dust \
    jq tmux htop btop ncdu
  ok "apt packages installed"
else
  log "step 1/4: skipped (--skip-apt)"
fi

# --- step 2: symlinks for Ubuntu-renamed binaries ---------------------------
log "step 2/4: symlinks (batcat→bat, fdfind→fd)"
ln -sf /usr/bin/batcat "$INSTALL_DIR/bat"
ln -sf /usr/bin/fdfind "$INSTALL_DIR/fd"
ok "bat → $(bat --version 2>/dev/null || echo '?')"
ok "fd  → $(fd --version 2>/dev/null || echo '?')"

# --- step 3: GitHub-release binaries (lazydocker, delta, yq-go) -------------
log "step 3/4: GitHub-release binaries"

gh_latest() {  # $1 = owner/repo  → prints tag (without leading 'v')
  curl -fsSL "https://api.github.com/repos/$1/releases/latest" \
    | grep -oP '"tag_name":\s*"v?\K[^"]+'
}

# lazydocker
LD_VER=$(gh_latest jesseduffield/lazydocker)
log "  lazydocker v$LD_VER"
curl -fsSL "https://github.com/jesseduffield/lazydocker/releases/download/v${LD_VER}/lazydocker_${LD_VER}_Linux_x86_64.tar.gz" \
  | tar -xz -C "$INSTALL_DIR" lazydocker
ok "  lazydocker → $(lazydocker --version 2>/dev/null | head -1)"

# delta
DL_VER=$(gh_latest dandavison/delta)
log "  delta $DL_VER"
curl -fsSL "https://github.com/dandavison/delta/releases/download/${DL_VER}/delta-${DL_VER}-x86_64-unknown-linux-gnu.tar.gz" \
  | tar -xz --strip-components=1 --wildcards -C "$INSTALL_DIR" 'delta-*/delta'
ok "  delta → $(delta --version 2>/dev/null | head -1)"

# yq (go version — override apt python yq via /usr/local/bin priority)
YQ_VER=$(gh_latest mikefarah/yq)
log "  yq v$YQ_VER (go, overrides apt python yq)"
curl -fsSL "https://github.com/mikefarah/yq/releases/download/v${YQ_VER}/yq_linux_amd64" \
  -o "$INSTALL_DIR/yq"
chmod +x "$INSTALL_DIR/yq"
ok "  yq → $(yq --version 2>/dev/null | head -1)"

# --- step 4: git delta config + shell aliases -------------------------------
if [[ "$SKIP_GIT_DELTA" -eq 0 ]]; then
  log "step 4a: git delta config (for $TARGET_USER)"
  sudo -u "$TARGET_USER" git config --global core.pager 'delta'
  sudo -u "$TARGET_USER" git config --global interactive.diffFilter 'delta --color-only'
  sudo -u "$TARGET_USER" git config --global delta.navigate true
  sudo -u "$TARGET_USER" git config --global delta.line-numbers true
  ok "  git delta pager configured"
else
  log "step 4a: skipped (--skip-git-delta)"
fi

if [[ "$SKIP_ALIASES" -eq 0 ]]; then
  log "step 4b: shell aliases (~/.bash_aliases for $TARGET_USER)"
  ALIAS_FILE="$TARGET_HOME/.bash_aliases"
  cat > "$ALIAS_FILE" <<'EOF'
# np-dms-lcbp3 server tools — aliases
# Installed: bat, eza, fd, dust, lazydocker, delta, yq (go), lnav, duf, procs
# Override the default 'll' from ~/.bashrc (last definition wins in bash).

# cat → bat (no pager so it pipes cleanly)
alias cat='bat --paging=never'

# ls family → eza (group dirs first, show git status)
alias ls='eza --group-directories-first'
alias ll='eza -la --group-directories-first --git'
alias la='eza -a --group-directories-first'
alias l='eza --group-directories-first'
alias tree='eza --tree --level=2'

# Disk usage (du-dust package provides `dust`)
alias du='dust'

# df → duf (nicer table)
alias df='duf'

# ps → procs (tree view by default)
alias ps='procs'

# Docker TUI
alias lzd='lazydocker'

# Tail logs with lnav (handles Docker/NestJS/JSON formats)
alias lt='lnav'
EOF
  chown "$TARGET_USER":"$TARGET_USER" "$ALIAS_FILE"
  ok "  aliases written to $ALIAS_FILE"
  warn "  run 'source ~/.bashrc' in your shell to activate now"
else
  log "step 4b: skipped (--skip-aliases)"
fi

# --- summary ----------------------------------------------------------------
echo
ok "done. tools ready:"
echo "  ripgrep  $(rg --version 2>/dev/null | head -1)"
echo "  bat      $(bat --version 2>/dev/null)"
echo "  fd       $(fd --version 2>/dev/null)"
echo "  eza      $(eza --version 2>/dev/null | head -1)"
echo "  dust     $(dust --version 2>/dev/null)"
echo "  duf      $(duf --version 2>/dev/null | head -1)"
echo "  fzf      $(fzf --version 2>/dev/null | head -1)"
echo "  lnav     $(lnav --version 2>/dev/null | head -1)"
echo "  procs    $(procs --version 2>/dev/null | head -1)"
echo "  yq       $(yq --version 2>/dev/null | head -1)"
echo "  lazydocker $(lazydocker --version 2>/dev/null | head -1)"
echo "  delta    $(delta --version 2>/dev/null | head -1)"
echo
warn "note: aliases override cat/ls/du/df/ps — interactive shell only (scripts unaffected)"
warn "note: use \\cat / command cat / /usr/bin/cat to bypass alias when needed"
