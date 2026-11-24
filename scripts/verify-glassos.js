const fs = require('fs');
const path = require('path');

// Cursor 安装根目录（默认 D: 盘，可用 argv[2] 覆盖）
const APP_ROOT = process.argv[2] || 'D:/Program Files/cursor/resources/app';
const glassPath = path.join(APP_ROOT, 'out/vs/workbench/workbench.glass.main.js');
const glass = fs.readFileSync(glassPath, 'utf8');
require('./lib/bundle-state').checkBundle(glassPath, 'glass');
const { trickyReplacements } = require(path.join(__dirname, '..', 'src', 'rules-loader.js'));

// 6 个 glass 原生编辑菜单条目。3.17 起改用通配函数名的正则规则
// （nls 函数名每版构建都变：旧版 E、3.15 T、3.17 A…，key 名 glassOsEditXXX 稳定）
const KEYS = ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'SelectAll'];
const ZH = { Undo: '撤销', Redo: '重做', Cut: '剪切', Copy: '复制', Paste: '粘贴', SelectAll: '全选' };

// 与 src/i18n-core.js trickyReplacements 首条规则保持一致
const ENGINE_REGEX = /title:\s*\w+\(\{key:"glassOsEdit(Undo|Redo|Cut|Copy|Paste|SelectAll)",comment:\["&& denotes a mnemonic"\]\},"[^"]*"\)/g;

let fail = 0;
// 1) rules/tricky-regex.json 源里通配正则规则必须存在（防 probe 与管线漂移）
const ruleExists = trickyReplacements.some(({ regex }) => regex.source.includes('glassOsEdit'));
console.log((ruleExists ? 'PASS' : 'FAIL') + '  tricky-regex.json 含 glassOsEdit 通配正则规则');
if (!ruleExists) fail++;
const staleRules = trickyReplacements.some(({ regex }) => /title:[ET]\(\{key:"glassOsEdit/.test(regex.source));
console.log((!staleRules ? 'PASS' : 'FAIL') + '  无旧版 E/T 精确匹配残留');
if (staleRules) fail++;

// 2) glass bundle 里 key 式形态的实际命中（与引擎同正则），并模拟替换结果
const hits = [...glass.matchAll(ENGINE_REGEX)];
console.log('总命中:', hits.length, '（期望 6，已汉化后为 0）');
if (hits.length === 6) {
  const keys = hits.map(m => m[1]).sort().join(',');
  const okKeys = keys === [...KEYS].sort().join(',');
  console.log((okKeys ? 'PASS' : 'FAIL') + '  key 覆盖: ' + keys);
  if (!okKeys) fail++;
  const replaced = glass.replace(ENGINE_REGEX, (m, k) => `title:"${ZH[k]}"`);
  const allZh = KEYS.every(k => replaced.includes(`title:"${ZH[k]}"`));
  console.log((allZh ? 'PASS' : 'FAIL') + '  替换结果含全部中文标签');
  if (!allZh) fail++;
} else if (hits.length === 0) {
  const anyZh = KEYS.every(k => glass.includes(`title:"${ZH[k]}"`));
  console.log((anyZh ? 'PASS' : 'FAIL') + '  bundle 已汉化（6 个中文菜单标签齐全）');
  if (!anyZh) fail++;
} else {
  console.log('FAIL  命中数异常（既非 6 也非 0），需人工检查');
  fail++;
}

console.log(fail === 0 ? '✅ verify-glassos 全部通过' : `⚠️ ${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
