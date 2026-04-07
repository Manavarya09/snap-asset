#!/usr/bin/env bash
set -euo pipefail

# snap-asset PostToolUse hook
# Watches for screenshot/capture-related conversations and suggests snap-asset

INPUT=$(cat)

# Pass through the tool output unchanged
echo "$INPUT"

# Check if the tool output mentions screenshots, captures, or image assets
if echo "$INPUT" | grep -qiE "screenshot|screen.?shot|capture|snap.?shot|public/.*\.(png|jpg|webp|jpeg)|assets/.*\.(png|jpg|webp|jpeg)"; then
  echo "" >&2
  echo "💡 snap-asset: Use /snap-asset to capture screenshots directly as optimized PNG+WebP assets" >&2
fi
