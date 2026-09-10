#!/usr/bin/env bash
# Kenney CC0 타일시트 3종을 assets/ 로 받는다.
# 다운로드 URL 에 해시가 있어 바뀌므로 에셋 페이지에서 매번 찾아낸다.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p assets .tmp

get() {  # $1=슬러그  $2=zip안 경로  $3=결과 파일명
  local url
  url=$(curl -sL "https://kenney.nl/assets/$1" \
        | grep -oE "https://kenney\.nl/media/[^']*\.zip" | head -1)
  [ -n "$url" ] || { echo "URL 못 찾음: $1" >&2; exit 1; }
  curl -sL -o ".tmp/$1.zip" "$url"
  python3 -c "
import zipfile,shutil,sys
z=zipfile.ZipFile('.tmp/$1.zip')
with z.open('$2') as s, open('assets/$3','wb') as d: shutil.copyfileobj(s,d)
"
}

get tiny-town        Tilemap/tilemap_packed.png                    town.png
get tiny-dungeon     Tilemap/tilemap_packed.png                    dungeon.png
get roguelike-indoors Tilesheets/roguelikeIndoor_transparent.png   indoor.png

python3 -c "
import zipfile
for pack in ('tiny-town', 'tiny-dungeon', 'roguelike-indoors'):
    print(zipfile.ZipFile('.tmp/' + pack + '.zip').read('License.txt').decode())
    print()
" > assets/LICENSE.txt
rm -rf .tmp
echo "에셋 설치 완료:"; ls -la assets/
