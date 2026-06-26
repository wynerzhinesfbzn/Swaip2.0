import { createInterface } from 'readline';
import { execSync } from 'child_process';

const rl = createInterface({ input: process.stdin, output: process.stdout });

const REPO = 'https://github.com/wynerzhinesfbzn/Swaip2.0.git';
const USER = 'wynerzhinesfbzn';

process.stdout.write('\n🔐 Вставь GitHub токен и нажми Enter:\n> ');

rl.once('line', (token) => {
  token = token.trim();
  rl.close();

  if (!token) {
    console.error('❌ Токен пустой');
    process.exit(1);
  }

  const url = `https://${USER}:${token}@github.com/wynerzhinesfbzn/Swaip2.0.git`;

  try {
    console.log('\n⏳ Подключаюсь к GitHub...');
    execSync(`git remote remove github 2>/dev/null; git remote add github "${url}"`, { stdio: 'pipe' });

    console.log('📦 Пушу ветку main...');
    const out = execSync('git push github main --force', { stdio: 'pipe' });
    console.log('✅ Готово! Код загружен на GitHub:');
    console.log(`   ${REPO.replace('git', 'https').replace('.git', '')}\n`);
  } catch (e) {
    const msg = e.stderr?.toString() || e.message;
    console.error('❌ Ошибка:', msg);
  }

  execSync('git remote remove github 2>/dev/null; true', { stdio: 'pipe' });
});
