#!/bin/bash
set -e

REPO="https://github.com/wynerzhinesfbzn/Swaip2.0.git"
BRANCH="main"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Введи GitHub токен:"
  read -s GITHUB_TOKEN
  echo ""
fi

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/wynerzhinesfbzn/Swaip2.0.git"

git remote set-url origin "$REMOTE_URL"

git add -A
git -c credential.helper="" -c core.askpass="" commit -m "Update: $(date '+%Y-%m-%d %H:%M')" || echo "Нечего коммитить"

GIT_ASKPASS=echo \
GIT_TERMINAL_PROMPT=0 \
GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0="credential.helper" \
GIT_CONFIG_VALUE_0="" \
  git push origin "$BRANCH"

git remote set-url origin "$REPO"
echo "✅ Запушено в $REPO"
