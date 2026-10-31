#!/usr/bin/env bash
# 部署到 Cloudflare Workers（含素材）。
#
# 為什麼需要這支：`pnpm build` 會清空 dist/，只留下程式碼；
# 素材要靠 scripts/build.sh 的 cp 步驟補進去。
# 直接跑 `pnpm build && wrangler deploy` 會把「只有程式碼」的資產集推上線，
# 所有圖片路徑就會被 SPA fallback 回傳 index.html（HTTP 200 + text/html），
# 前端拿到 HTML 當圖片解碼 → "加载图片失败"。
set -euo pipefail
shopt -s nullglob

cd "$(dirname "$0")/.."

echo "==> build（含素材複製）"
bash scripts/build.sh

IMG=$(find dist/img -type f 2>/dev/null | wc -l)
THUMB=$(find dist/thumbs -type f 2>/dev/null | wc -l)
DATA=$(find dist/data -type f 2>/dev/null | wc -l)
echo "==> dist 素材檢查: img=$IMG thumbs=$THUMB data=$DATA"

fail=0
[ "$IMG" -gt 1000 ] || { echo "ERROR: dist/img 只有 $IMG 個檔案，缺素材。先確認 sparse-checkout 有 img/（git sparse-checkout add img）"; fail=1; }
[ "$THUMB" -gt 1000 ] || { echo "ERROR: dist/thumbs 只有 $THUMB 個檔案，缺素材。"; fail=1; }
[ "$DATA" -gt 3 ] || { echo "ERROR: dist/data 只有 $DATA 個檔案；用 sparse-checkout add data 補回。"; fail=1; }
[ "$fail" -eq 0 ] || { echo "中止部署：素材不完整，強行部署會讓線上官網圖片全掛。"; exit 1; }

echo "==> 部署"
npx wrangler deploy

echo "==> 上線後驗證"
BASE=${VERIFY_BASE:-https://ai-pose-gallery-zh.tutumomo.workers.dev}
# 注意：不要用 `find ... | head -1`，head 提前關閉管道會讓腳本收到 SIGPIPE（exit 141）
SAMPLE_IMG=$(find dist/img -type f -print -quit 2>/dev/null | sed 's#^dist/##')
SAMPLE_THUMB=$(find dist/thumbs -type f -print -quit 2>/dev/null | sed 's#^dist/##')
for p in "$SAMPLE_IMG" "$SAMPLE_THUMB" "data/pose-zh.json"; do
  ct=$(curl -s -o /dev/null -D - --max-time 20 "$BASE/$p" | tr -d '\r' | awk 'tolower($1)=="content-type:"{print $2}')
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE/$p")
  echo "  $code  $(printf '%-40s' "$p") $ct"
  case "$ct" in
    text/html*) echo "  ^^ 這個路徑回了 HTML，代表資產沒上傳成功"; fail=1 ;;
  esac
done
[ "$fail" -eq 0 ] && echo "==> 完成" || { echo "==> 部署後驗證失敗"; exit 1; }
