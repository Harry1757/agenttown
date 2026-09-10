#!/bin/sh
cd "$(dirname "$0")" || exit 1
if [ -d /Applications/CodexTown.app ]; then
  open /Applications/CodexTown.app
else
  exec ./launch.sh
fi
