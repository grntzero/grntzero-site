#!/bin/bash
cd "$(dirname "$0")" || exit 1
echo ""
echo "  홈페이지에 반영 중…"
echo ""
bash _publish.sh
echo ""
tail -3 _publish.log 2>/dev/null
echo ""
echo "  1~2분 뒤 홈페이지에 보입니다. 이 창은 닫아도 됩니다."
echo ""
