#!/usr/bin/env python3
"""Compatibility entry point: package the approved AgentTown icon artwork.

Requires the app's existing npm dependencies (Electron); no Python packages.
The original is app/design/icon-source.png. Run `npm --prefix app run icons`
to regenerate all PNG sizes and the Windows ICO together.
"""
import shutil
import subprocess
from pathlib import Path

if __name__ == '__main__':
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    if not npm:
        raise SystemExit('Node.js/npm is required to build app icons.')
    raise SystemExit(subprocess.call([npm, 'run', 'icons'], cwd=Path(__file__).resolve().parent.parent))
