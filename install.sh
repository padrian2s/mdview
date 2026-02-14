#!/bin/bash
# mdview installer - works standalone or called from claude_ide
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors (respect NO_COLOR and parent installer)
if [[ -z "$NO_COLOR" ]]; then
    R='\033[0;31m'
    G='\033[0;32m'
    C='\033[0;36m'
    DIM='\033[2m'
    BOLD='\033[1m'
    NC='\033[0m'
    CHECK="${G}✓${NC}"
    CROSS="${R}✗${NC}"
else
    R='' G='' C='' DIM='' BOLD='' NC=''
    CHECK="✓" CROSS="✗"
fi

# When called from claude_ide, use its status formatting (INDENT prefix)
PREFIX="${INDENT:-  }"

status() { printf "\r${PREFIX}${1} ${2}\n"; }

# Check Node.js
if ! command -v node &> /dev/null; then
    if [[ -z "$SKIP_NODE_INSTALL" ]]; then
        status "$CROSS" "Node.js not found"
        echo -e "${PREFIX}${DIM}Install Node.js first: brew install node${NC}"
        exit 1
    fi
    exit 1
fi

# Install npm dependencies
cd "$SCRIPT_DIR"
if npm install --silent 2>/dev/null; then
    :
else
    status "$CROSS" "npm install failed"
    exit 1
fi

# Link globally (makes 'mdview' command available)
if npm link --silent 2>/dev/null; then
    status "$CHECK" "mdview installed"
else
    # npm link can fail without sudo on some systems
    status "$CROSS" "npm link failed ${DIM}(try: sudo npm link)${NC}"
    exit 1
fi
