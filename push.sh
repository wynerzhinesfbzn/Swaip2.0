#!/bin/bash
set -e

REPO="https://github.com/wynerzhinesfbzn/Swaip2.0.git"
BRANCH="main"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Введи GitHub токен:"
  read -s GITHUB_TOKEN
fi

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/wynerzhinesfbzn/Swaip2.0.git"

git remote set-url origin "$REMOTE_URL"
git add -A
git commit -m "Update: $(date '+%Y-%m-%d %H:%M')" || echo "Нечего коммитить"
git push origin "$BRANCH"

git remote set-url origin "$REPO"

echo "✅ Запушено в $REPO"
