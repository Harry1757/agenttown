#!/bin/sh
# CodexTown browser mode. Desktop app: open /Applications/CodexTown.app
cd "$(dirname "$0")" || exit 1
exec "${CODEXTOWN_PYTHON:-python3}" codextown.py "$@"
