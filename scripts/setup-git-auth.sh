#!/usr/bin/env bash
# Настраивает git-аутентификацию через GITHUB_TOKEN
set -e

if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN is not set" >&2
  exit 1
fi

# Получаем текущий remote URL
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

# Если remote не настроен — выходим
if [ -z "$REMOTE_URL" ]; then
  echo "No git remote 'origin' found" >&2
  exit 1
fi

# Извлекаем хост и путь репозитория из URL
# Поддерживаем форматы: https://github.com/user/repo.git и https://TOKEN@github.com/user/repo.git
REPO_PATH=$(echo "$REMOTE_URL" | sed 's|https://[^/]*github.com/||')

# Устанавливаем remote с токеном
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO_PATH}"

# Настраиваем базовые параметры git если не установлены
git config user.email "agent@swaip.app" 2>/dev/null || true
git config user.name "SWAIP Agent" 2>/dev/null || true

echo "Git auth configured successfully"
