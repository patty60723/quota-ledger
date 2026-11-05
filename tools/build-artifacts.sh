#!/usr/bin/env bash
# Builds the two claude.ai artifact pages from index.html (see DEVNOTES.md「上線」):
#   OUT/ledger/index.html   正式版: index.html from <title> onwards (the platform supplies <head>), fonts alongside
#   OUT/ledger2/index.html  預覽版: same, titled「慢慢花手帳 預覽」, with the preview-only buttons in 設定 → 說明
#                           (載入示範資料 → demoLedger(), 試跑完整引導 → the onboarding dry run) in place of <!--ob-extra-->
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: tools/build-artifacts.sh OUTDIR}"
mkdir -p "$OUT/ledger/fonts" "$OUT/ledger2/fonts"
body() { awk 'f||/^<title>/{f=1;print}' "$ROOT/index.html" | sed '$d' | head -c -1; }
body > "$OUT/ledger/index.html"
EXTRA='<button class="setrow" data-act="demo-load"><div class="k"><b>載入示範資料</b><span>預覽版才有：用以今天為準的示範資料取代這裡的資料，方便試各種畫面</span></div><span class="chev" aria-hidden="true">${icon("chev")}</span></button><button class="setrow" data-act="ob-dry"><div class="k"><b>試跑完整引導</b><span>預覽版才有：從頭走一次第一次使用的設定，不會改到資料</span></div><span class="chev" aria-hidden="true">${icon("chev")}</span></button>'
body | python3 -c '
import sys
s = sys.stdin.read(); extra = sys.argv[1]
assert s.count("<!--ob-extra-->") == 1, "ob-extra marker missing"
assert s.startswith("<title>慢慢花手帳</title>"), "title line changed"
s = s.replace("<title>慢慢花手帳</title>", "<title>慢慢花手帳 預覽</title>", 1).replace("<!--ob-extra-->", extra)
sys.stdout.write(s)' "$EXTRA" > "$OUT/ledger2/index.html"
cp "$ROOT/fonts/figtree.woff2" "$OUT/ledger/fonts/"; cp "$ROOT/fonts/figtree.woff2" "$OUT/ledger2/fonts/"
echo "built $OUT/ledger/index.html and $OUT/ledger2/index.html"
