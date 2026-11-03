// Обгортка над shadcn-vue для цього проєкту.
//   npm run ui:add -- select dialog   → додає компоненти + фікси + типи
//   npm run ui:types                  → тільки перегенерувати *.vue.d.ts
//
// Що робить після add:
//  1. виправляє криво згенерований імпорт  `from "cn"` → `from "@/lib/utils"`
//  2. генерує components/ui/**/X.vue.d.ts — щоб Visual Studio бачила типи пропсів .vue
//  3. приводить закінчення рядків у components/ui до CRLF (як у .editorconfig)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const uiDir = path.join(root, 'components', 'ui');
const typesOut = path.join(root, 'node_modules', '.tmp', 'ui-types', 'components', 'ui');

const [cmd, ...args] = process.argv.slice(2);
const run = (c) => execSync(c, { cwd: root, stdio: 'inherit' });

const walk = (dir) => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

if (cmd === 'add') {
  if (!args.length) { console.error('Вкажи компоненти: npm run ui:add -- button select'); process.exit(1); }
  run(`npx shadcn-vue@latest add ${args.join(' ')}`);
}

// 1. фікс імпорту cn + 3. CRLF
for (const file of walk(uiDir).filter(f => /\.(vue|ts)$/.test(f))) {
  const src = fs.readFileSync(file, 'utf8');
  let out = src.replace(/from ["']cn["']/g, 'from "@/lib/utils"');
  out = out.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  if (out !== src) fs.writeFileSync(file, out);
}

// 2. типи для .vue
try { fs.rmSync(path.join(root, 'node_modules', '.tmp', 'ui-types'), { recursive: true, force: true }); } catch { /* не критично — файли перезапишуться */ }
run('npx vue-tsc -p tsconfig.ui-types.json');
for (const file of walk(typesOut).filter(f => f.endsWith('.vue.d.ts'))) {
  const target = path.join(uiDir, path.relative(typesOut, file));
  const content = '// Згенеровано scripts/ui.mjs (npm run ui:types) — не редагувати\r\n'
    + fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(target, content);
  console.log('types:', path.relative(root, target));
}
