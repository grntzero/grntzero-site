#!/bin/bash
PLIST="$HOME/Library/LaunchAgents/com.gruntzero.sitepublish.plist"
SCRIPT="$HOME/Desktop/1. GRUNT ZERO/_site/_publish.sh"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.gruntzero.sitepublish</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SCRIPT</string>
  </array>
  <key>StartInterval</key><integer>120</integer>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"
echo ""
echo "  자동 발행이 켜졌습니다."
echo "  _site 폴더 안의 파일을 고치고 저장하면, 2분 안에 홈페이지에 반영됩니다."
echo "  기록은 _site/_publish.log 에 남습니다."
echo ""
echo "  이 창은 닫아도 됩니다."
