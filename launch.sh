#!/bin/sh
# AgentTown browser mode. Desktop app: open /Applications/AgentTown.app
cd "$(dirname "$0")" || exit 1
exec "${CODEXTOWN_PYTHON:-python3}" codextown.py "$@"
