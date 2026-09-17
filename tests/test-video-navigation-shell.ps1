$ErrorActionPreference = 'Stop'

$indexPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'index.html'
$html = Get-Content -LiteralPath $indexPath -Raw

function Assert-Matches {
    param(
        [string]$Pattern,
        [string]$Message
    )

    if ($html -notmatch $Pattern) {
        throw $Message
    }
}

Assert-Matches "showPage\('videos', this\)[^>]*>.*?<span>总视频</span>" '左侧视频菜单应改名为“总视频”。'
Assert-Matches "(?s)showPage\('videos', this\).*?<span>总视频</span>.*?showPage\('self-videos', this\).*?<span>自营视频</span>" '“自营视频”菜单应紧跟在“总视频”菜单后。'
Assert-Matches '<div id="page-videos" class="page">\s*<div class="page-header">\s*<div class="page-title">🎬 总视频</div>' '总视频页面标题应同步改名。'
Assert-Matches '(?s)<div id="page-self-videos" class="page">.*?<div class="page-title">📱 自营视频</div>.*?等待你确认具体内容后再接入数据和功能' '应提供独立的自营视频空壳页面。'

Write-Host 'PASS: 总视频改名和自营视频空壳页面结构正确。'
