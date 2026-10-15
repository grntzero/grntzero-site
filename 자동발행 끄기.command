#!/bin/bash
PLIST="$HOME/Library/LaunchAgents/com.gruntzero.sitepublish.plist"
launchctl unload "$PLIST" 2>/dev/null
rm -f "$PLIST"
echo ""
echo "  자동 발행이 꺼졌습니다."
echo "  다시 켜려면 '자동발행 켜기.command' 를 더블클릭하세요."
echo ""
