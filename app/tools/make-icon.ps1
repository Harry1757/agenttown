#requires -version 5
<#
  assets/icon-src/claudetown-<N>.png (npm run icons 로 변환한 것) 를
  assets/claudetown.ico 하나로 묶는다. clock-reminder/tools/pack-ico.js 와
  같은 방식(Vista+ 의 PNG-in-ICO 포맷)을 PowerShell로 옮긴 것 - 각 PNG를
  그대로 담으므로 System.Drawing.Icon 경유 변환에서 생기는 화질 손실이 없다.

  먼저 PNG 를 그린다:
      python3 tools/draw-icon.py
  그다음 이 스크립트로 묶는다:
      powershell -File tools/make-icon.ps1
#>
param(
  [string]$SrcDir = (Join-Path $PSScriptRoot '..\assets\icon-src'),
  [string]$OutFile = (Join-Path $PSScriptRoot '..\assets\claudetown.ico')
)

$ErrorActionPreference = 'Stop'

$images = Get-ChildItem -Path $SrcDir -Filter 'claudetown-*.png' | ForEach-Object {
  if ($_.BaseName -match 'claudetown-(\d+)$') {
    [pscustomobject]@{ Size = [int]$Matches[1]; Bytes = [System.IO.File]::ReadAllBytes($_.FullName) }
  }
} | Where-Object { $_.Size -le 256 } | Sort-Object Size

if (-not $images -or $images.Count -eq 0) {
  Write-Error "$SrcDir 에 claudetown-<size>.png 가 없다. 먼저 'python3 tools/draw-icon.py' 를 돌려야 한다."
}

$HEADER_LEN = 6
$ENTRY_LEN = 16

# BinaryWriter.Write(...) 오버로드를 필드마다 따로 부르면 이 환경의 Windows
# PowerShell 5.1 에서 종종 바이트가 통째로 빠졌다(재현됨, 원인 불명). 그래서
# little-endian 바이트를 손으로 만들어 리스트에 쌓고 마지막에 파일 하나로 쓴다.
function LE16([int]$v) { @([byte]($v -band 0xFF), [byte](($v -shr 8) -band 0xFF)) }
function LE32([long]$v) {
  @([byte]($v -band 0xFF), [byte](($v -shr 8) -band 0xFF),
    [byte](($v -shr 16) -band 0xFF), [byte](($v -shr 24) -band 0xFF))
}

$all = New-Object System.Collections.Generic.List[byte]
$all.AddRange([byte[]](LE16 0))              # reserved
$all.AddRange([byte[]](LE16 1))              # 1 = icon
$all.AddRange([byte[]](LE16 $images.Count))

$offset = $HEADER_LEN + $ENTRY_LEN * $images.Count
foreach ($src in $images) {
  $dim = if ($src.Size -ge 256) { 0 } else { $src.Size }   # 256 은 1바이트에 못 담아 0으로 적는다
  $all.Add([byte]$dim)                       # width
  $all.Add([byte]$dim)                       # height
  $all.Add([byte]0)                          # palette colors
  $all.Add([byte]0)                          # reserved
  $all.AddRange([byte[]](LE16 1))            # color planes
  $all.AddRange([byte[]](LE16 32))           # bits per pixel
  $all.AddRange([byte[]](LE32 $src.Bytes.Length))
  $all.AddRange([byte[]](LE32 $offset))
  $offset += $src.Bytes.Length
}
foreach ($src in $images) { $all.AddRange($src.Bytes) }

[System.IO.File]::WriteAllBytes($OutFile, $all.ToArray())

Write-Host ("묶었다: {0} ({1}px)" -f $OutFile, (($images | ForEach-Object { $_.Size }) -join ', '))
