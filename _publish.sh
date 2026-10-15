#!/bin/bash
# 사이트 자동 발행 — 변경이 있으면 GitHub에 올려 홈페이지에 반영한다.
cd "$(dirname "$0")" || exit 1
LOG="_publish.log"

git add -A 2>/dev/null
# 변경 없으면 조용히 종료
if git diff --cached --quiet 2>/dev/null; then exit 0; fi

# 안전장치: 핵심 파일이 비어 있으면 올리지 않는다
for f in index.html artists.html academy.html lineup.html dl/index.html; do
  if [ ! -s "$f" ]; then
    echo "$(date '+%F %T') 중단 — $f 가 비어 있음 (실수 방지)" >> "$LOG"
    git reset -q
    exit 1
  fi
done

MSG="사이트 수정 $(date '+%Y-%m-%d %H:%M')"
git commit -q -m "$MSG"
if git push -q origin main 2>>"$LOG"; then
  echo "$(date '+%F %T') 발행 완료 — $MSG" >> "$LOG"
else
  echo "$(date '+%F %T') 푸시 실패 (네트워크 확인)" >> "$LOG"
fi
