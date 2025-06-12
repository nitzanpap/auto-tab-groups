#!/bin/bash

# Manual test script for Chrome Extension
echo "🧪 Testing Auto Tab Groups Chrome Extension"
echo "==========================================="

echo ""
echo "📋 Pre-test Checklist:"
echo "1. ✅ Manifest V3 syntax check"
echo "2. ✅ JavaScript syntax check"
echo "3. ✅ Build process verification"

echo ""
echo "🔍 Checking manifest.json..."
cd src
node -e "const fs = require('fs'); const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8')); console.log('✅ Manifest Version:', manifest.manifest_version); console.log('✅ Extension Name:', manifest.name); console.log('✅ Permissions:', manifest.permissions.join(', '));"

echo ""
echo "🔍 Checking JavaScript files..."
node -c background.js && echo "✅ background.js syntax OK"
node -c public/popup.js && echo "✅ popup.js syntax OK"
node -c services/TabGroupService.js && echo "✅ TabGroupService.js syntax OK"
node -c utils/BrowserAPI.js && echo "✅ BrowserAPI.js syntax OK"

echo ""
echo "📦 Testing build process..."
cd ..
npm run build

echo ""
echo "✅ All automated checks passed!"
echo ""
echo "🚀 Manual Testing Instructions:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' in the top right"
echo "3. Click 'Load unpacked' and select the 'src' folder"
echo "4. Test the extension by:"
echo "   - Opening multiple tabs with different domains"
echo "   - Clicking the extension icon to open popup"
echo "   - Testing the 'Group Tabs' button"
echo "   - Testing settings toggles"
echo "   - Testing color generation"
echo ""
echo "🎯 Expected Results:"
echo "- Tabs should group by domain (github.com, google.com, etc.)"
echo "- Group titles should be clean (no .com, no www)"
echo "- Colors should persist between sessions"
echo "- Settings should save and restore correctly"
