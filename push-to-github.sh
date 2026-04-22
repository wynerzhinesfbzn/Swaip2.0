#!/bin/bash
# Запустите этот скрипт один раз: bash push-to-github.sh
# После успешного пуша файл можно удалить.

GH_TOKEN="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"
GH_REPO="https://github.com/wynerzhinesfbzn/Swaip2.0.git"

echo "Настройка remote origin..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://${GH_TOKEN}@${GH_REPO#https://}"

echo "Пуш в GitHub..."
git push -u origin main --force

# Убираем токен из remote URL после пуша
git remote set-url origin "$GH_REPO"
echo "Готово! Токен убран из конфигурации."

# Удаляем этот скрипт
rm -- "$0"
