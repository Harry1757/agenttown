#!/usr/bin/env python3
"""AgentTown launcher for local Codex or Claude Code sessions."""
import argparse
import sys


def main():
    parser = argparse.ArgumentParser(description='AgentTown — 로컬 AI 세션 작업실')
    parser.add_argument('--provider', choices=('codex', 'claude'), default='codex',
                        help='읽을 세션 제공자 (기본: codex)')
    options, remaining = parser.parse_known_args()
    sys.argv = [sys.argv[0], *remaining]
    if options.provider == 'claude':
        from claudetown import main as serve
    else:
        from codextown import main as serve
    serve()


if __name__ == '__main__':
    main()
