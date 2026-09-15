#!/bin/sh
cd "$(dirname "$0")" || exit 1
if [ -d /Applications/AgentTown.app ]; then
  open /Applications/AgentTown.app
else
  exec ./launch.sh
fi
