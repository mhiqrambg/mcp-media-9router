#!/usr/bin/env bash
# mcp-media-9router installer
# Usage: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/mhiqrambg/mcp-media-9router/main/install.sh)"

set -euo pipefail

INSTALL_DIR="$HOME/.mcp-media-9router"
BIN_DIR="$HOME/.local/bin"
REPO_URL="https://github.com/mhiqrambg/mcp-media-9router.git"
BRANCH="main"

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[1;33m'
cyan='\033[0;36m'
bold='\033[1m'
reset='\033[0m'

say() {
  printf '%b\n' "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    say "${red}Error: '$1' is required but was not found.${reset}"
    exit 1
  fi
}

shell_rc_file() {
  case "$(basename "${SHELL:-}")" in
    zsh) printf '%s' "$HOME/.zshrc" ;;
    bash) printf '%s' "$HOME/.bashrc" ;;
    fish) printf '%s' "$HOME/.config/fish/config.fish" ;;
    *) printf '%s' "$HOME/.profile" ;;
  esac
}

add_path_to_shell() {
  if [[ ":$PATH:" == *":$BIN_DIR:"* ]]; then
    return
  fi

  local rc_file shell_name path_line
  rc_file="$(shell_rc_file)"
  shell_name="$(basename "${SHELL:-}")"
  mkdir -p "$(dirname "$rc_file")"

  if [[ "$shell_name" == "fish" ]]; then
    path_line='fish_add_path $HOME/.local/bin'
  else
    path_line='export PATH="$HOME/.local/bin:$PATH"'
  fi

  if ! grep -qF "$path_line" "$rc_file" 2>/dev/null; then
    {
      printf '\n# mcp-media-9router\n'
      printf '%s\n' "$path_line"
    } >> "$rc_file"
    PATH_UPDATED=1
    RC_FILE="$rc_file"
  fi
}

printf '\n'
say "${bold}mcp-media-9router installer${reset}"
say "${cyan}--------------------------------${reset}"

say "${bold}[1/5]${reset} Checking prerequisites"
require_command git
require_command node
require_command npm

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 22 ]; then
  say "${red}Error: Node.js 22 or newer is required; found $(node --version).${reset}"
  exit 1
fi
say "  ${green}OK${reset} Node.js $(node --version)"
say "  ${green}OK${reset} npm $(npm --version)"
say "  ${green}OK${reset} git $(git --version | cut -d' ' -f3)"

say "${bold}[2/5]${reset} Installing source to ${cyan}${INSTALL_DIR}${reset}"
if [ -d "$INSTALL_DIR/.git" ]; then
  if git -C "$INSTALL_DIR" diff --quiet && git -C "$INSTALL_DIR" diff --cached --quiet; then
    git -C "$INSTALL_DIR" pull --ff-only origin "$BRANCH"
    say "  ${green}OK${reset} Repository updated"
  else
    say "  ${yellow}Warning:${reset} Local changes detected; repository was not updated"
  fi
elif [ -e "$INSTALL_DIR" ]; then
  say "${red}Error: ${INSTALL_DIR} exists but is not a Git repository.${reset}"
  say "Remove or rename it, then run this installer again."
  exit 1
else
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
  say "  ${green}OK${reset} Repository cloned"
fi

say "${bold}[3/5]${reset} Installing Node.js dependencies"
npm --prefix "$INSTALL_DIR" ci
npm --prefix "$INSTALL_DIR" run build
say "  ${green}OK${reset} Build completed"

say "${bold}[4/5]${reset} Creating mm9 command"
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/mm9" <<EOF
#!/usr/bin/env bash
exec "$(command -v node)" "$INSTALL_DIR/dist/cli.js" "\$@"
EOF
chmod 755 "$BIN_DIR/mm9"
say "  ${green}OK${reset} ${BIN_DIR}/mm9"

say "${bold}[5/5]${reset} Configuring PATH"
PATH_UPDATED=0
RC_FILE=""
add_path_to_shell
if [ "$PATH_UPDATED" -eq 1 ]; then
  say "  ${green}OK${reset} Added ${BIN_DIR} to ${RC_FILE}"
else
  say "  ${green}OK${reset} PATH already includes ${BIN_DIR}"
fi

printf '\n'
say "${cyan}--------------------------------${reset}"
say "${green}${bold}Installation complete.${reset}"
say ""
say "Quick start:"
say "  ${cyan}mm9 setup --opencode${reset}  Configure 9router and register OpenCode"
say "  ${cyan}mm9 check${reset}        Validate configuration"
say "  ${cyan}mm9 list${reset}         Show active provider policy"
say ""
if [ "$PATH_UPDATED" -eq 1 ]; then
  say "Open a new terminal or run: ${cyan}source ${RC_FILE}${reset}"
fi
