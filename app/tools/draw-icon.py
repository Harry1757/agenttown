#!/usr/bin/env python3
"""ClaudeTown 앱 아이콘을 그린다. 외부 의존성 없음(stdlib PNG 인코더).

16x16 격자에 한 번만 그리고, 정수배로 확대해 ICO 에 필요한 각 크기를
그대로 뽑는다 (16→x1, 32→x2, 48→x3, 256→x16). 256px 소스를 나중에
보간(bicubic 등)으로 줄이면 창 픽셀아트가 뭉개지므로, 축소 대신
"애초에 그 크기로 그린 결과"를 정수배 확대로 재현한다.

출력:
  assets/claudetown.png              (256px, 문서·BrowserWindow 아이콘용)
  assets/icon.png                    (1024px, electron-builder 가 .icns 로 굽는다)
  assets/icon-src/claudetown-N.png   (16/32/48/256/1024, tools/make-icon.ps1 이 묶는다)
"""
import struct
import zlib
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
ASSETS = APP_DIR / "assets"
ICON_SRC = ASSETS / "icon-src"

SIZES = (16, 32, 48, 256, 1024)
GRID = 16  # 디자인 격자 한 변

TRANSPARENT = (0, 0, 0, 0)
OUTLINE = (0x14, 0x10, 0x1a, 255)      # 실루엣 테두리
ROOF = (0x9a, 0x64, 0x38, 255)          # 따뜻한 나무색 지붕/처마
ROOF_DARK = (0x6b, 0x44, 0x26, 255)     # 처마 밑 그림자 라인
WALL = (0x25, 0x20, 0x30, 255)          # 어두운 벽
WINDOW = (0x6d, 0xe5, 0xe8, 255)        # 켜진 모니터/창 - 시안
DOOR = (0x55, 0x38, 0x20, 255)          # 나무 문


def build_grid():
    g = [[TRANSPARENT] * GRID for _ in range(GRID)]
    for r in range(GRID):
        for c in range(GRID):
            edge_r, edge_c = r in (0, GRID - 1), c in (0, GRID - 1)
            if edge_r and edge_c:
                continue  # 네 모서리는 투명 - 살짝 둥근 느낌
            if edge_r or edge_c:
                g[r][c] = OUTLINE
            elif r == 4:
                g[r][c] = ROOF_DARK
            elif 1 <= r <= 3:
                g[r][c] = ROOF
            else:
                g[r][c] = WALL
    for r0, c0 in ((7, 3), (7, 11)):
        for dr in range(2):
            for dc in range(2):
                g[r0 + dr][c0 + dc] = WINDOW
    for r in range(11, 15):
        for c in (7, 8):
            g[r][c] = DOOR
    return g


def upscale(grid, factor):
    px = []
    for row in grid:
        wide = []
        for cell in row:
            wide.extend([cell] * factor)
        for _ in range(factor):
            px.append(wide)
    return px


def write_png(path, pixels):
    h = len(pixels)
    w = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter: None
        for (r, g, b, a) in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    path.write_bytes(png)


def main():
    grid = build_grid()
    ICON_SRC.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        factor = size // GRID
        pixels = upscale(grid, factor)
        out = ICON_SRC / f"claudetown-{size}.png"
        write_png(out, pixels)
        print(f"그림: {out} ({size}x{size})")
        if size == 256:
            write_png(ASSETS / "claudetown.png", pixels)
            print(f"그림: {ASSETS / 'claudetown.png'} ({size}x{size})")
        if size == 1024:
            # electron-builder 는 mac 아이콘 원본이 512px 이상이어야 .icns 를 굽는다.
            write_png(ASSETS / "icon.png", pixels)
            print(f"그림: {ASSETS / 'icon.png'} ({size}x{size})")


if __name__ == "__main__":
    main()
