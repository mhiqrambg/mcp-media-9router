#!/usr/bin/env bash
# mcp-media-9router uninstaller
# Usage: bash uninstall.sh [--yes] [--keep-config]

set -euo pipefail

INSTALL_DIR="$HOME/.mcp-media-9router"
BIN_PATH="$HOME/.local/bin/mm9"
CONFIG_DIR="$HOME/.config/mcp-media-9router"
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[1;33m'
cyan='\033[0;36m'
bold='\033[1m'
reset='\033[0m'

ASSUME_YES=0
KEEP_CONFIG=0
for argument in "$@"; do
  case "$argument" in
    --yes) ASSUME_YES=1 ;;
    --keep-config) KEEP_CONFIG=1 ;;
    *) printf '%b\n' "${red}Unknown option: ${argument}${reset}"; exit 1 ;;
  esac
done

confirm() {
  if [ "$ASSUME_YES" -eq 1 ]; then
    return
  fi
  local answer
  read -r -p "$1 [y/N]: " answer
  case "$answer" in
    y|Y|yes|YES) ;;
    *) printf 'Uninstall cancelled.\n'; exit 0 ;;
  esac
}

remove_opencode_entry() {
  if [ ! -f "$OPENCODE_CONFIG" ]; then
    return
  fi
  if ! command -v node >/dev/null 2>&1; then
    printf '%b\n' "${yellow}Warning: remove media-9router from ${OPENCODE_CONFIG} manually.${reset}"
    return
  fi
  node - "$OPENCODE_CONFIG" <<'NODE'
const fs = require("node:fs");
const path = process.argv[2];
const config = JSON.parse(fs.readFileSync(path, "utf8"));
if (config.mcp && Object.hasOwn(config.mcp, "media-9router")) {
  delete config.mcp["media-9router"];
  fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write("Removed media-9router from OpenCode configuration.\n");
}
NODE
}

printf '\n%b\n' "${bold}mcp-media-9router uninstaller${reset}"
printf '%b\n\n' "${cyan}--------------------------------${reset}"
printf 'This removes the installed source, mm9 launcher, saved configuration, and macOS Keychain API key.\n'
if [ "$KEEP_CONFIG" -eq 1 ]; then
  printf '%b\n' "${yellow}--keep-config preserves saved configuration and the macOS Keychain API key.${reset}"
fi

confirm "Continue"

if [ -e "$BIN_PATH" ]; then
  rm -f "$BIN_PATH"
  printf '%b\n' "${green}OK${reset} Removed ${BIN_PATH}"
fi

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  printf '%b\n' "${green}OK${reset} Removed ${INSTALL_DIR}"
fi

remove_opencode_entry

if [ "$KEEP_CONFIG" -eq 0 ]; then
  rm -rf "$CONFIG_DIR"
  printf '%b\n' "${green}OK${reset} Removed ${CONFIG_DIR}"
  if command -v security >/dev/null 2>&1; then
    security delete-generic-password -s "mcp-media-9router" -a "default" >/dev/null 2>&1 || true
    printf '%b\n' "${green}OK${reset} Removed macOS Keychain API key"
  fi
else
  printf '%b\n' "${yellow}Preserved${reset} ${CONFIG_DIR} and macOS Keychain API key"
fi

printf '\n%b\n' "${green}${bold}Uninstall complete.${reset}"
printf 'Quit and restart OpenCode if it is running.\n'
