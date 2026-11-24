const fs = require('fs');
const path = require('path');

const { auxiliaryInterfaceReplacements: auxRules } = require(path.join(__dirname, '..', 'dist', 'translate', 'auxiliary.js'));
const { scopedReplacements: scopedRules } = require(path.join(__dirname, '..', 'src', 'rules-loader.js'));

// Cursor 安装根目录（默认 D: 盘，可用 argv[2] 覆盖）
const APP_ROOT = process.argv[2] || 'D:/Program Files/cursor/resources/app';
const WB = path.join(APP_ROOT, 'out/vs/workbench');
const glass = fs.readFileSync(path.join(WB, 'workbench.glass.main.js'), 'utf8');
const desk = fs.readFileSync(path.join(WB, 'workbench.desktop.main.js'), 'utf8');
require('./lib/bundle-state').checkBundle(path.join(WB, 'workbench.glass.main.js'), 'glass');
require('./lib/bundle-state').checkBundle(path.join(WB, 'workbench.desktop.main.js'), 'desk');

function count(src, en) {
  let i = src.indexOf(en), n = 0;
  while (i !== -1) { n++; i = src.indexOf(en, i + en.length); }
  return n;
}

// 重点验证本次新增的规则（按 en 关键词过滤）
const keywords = [
  'Filter By', '{value:"scope"', '{value:"author"', '{value:"name"',
  'Manage in Dashboard', 'Show ${k} more', '["Show ', 'Show ",g," more',
  'moreLabel:"Show more"', 'confirmLabel??', 'cancelLabel??', 'title??"Prompt"',
  'E(7683,null)', 'Enter Command Name',
  // New User Skill/Subagent 对话框与命令创建规则：用通用前缀，变量名无论怎么改都覆盖
  '==="skill"', 'New User ${', 'Enter a name for the new ${', 'my-custom-${',
  'User Rules apply',
  'p$m={light:', 'glassOsEdit',
];

console.log('===== aux 规则命中（glass） =====');
let auxHit = 0, auxTotal = 0;
for (const [en, zh] of auxRules) {
  if (!keywords.some(k => en.includes(k))) continue;
  auxTotal++;
  const c = count(glass, en);
  if (c === 0) { console.log('✗ 未命中'.padEnd(10), en.slice(0, 60)); }
  else { auxHit++; console.log('✓ ' + String(c).padEnd(3), en.slice(0, 60)); }
}
console.log('aux 关键规则命中率:', auxHit + '/' + auxTotal);

console.log('\n===== scoped 规则命中（desktop） =====');
let scHit = 0, scTotal = 0;
for (const [en, zh] of scopedRules) {
  if (!keywords.some(k => en.includes(k))) continue;
  scTotal++;
  const c = count(desk, en);
  if (c === 0) { console.log('✗ 未命中'.padEnd(10), en.slice(0, 60)); }
  else { scHit++; console.log('✓ ' + String(c).padEnd(3), en.slice(0, 60)); }
}
console.log('scoped 关键规则命中率:', scHit + '/' + scTotal);