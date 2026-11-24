// 结构安全门禁：校验所有替换词条的引号结构不会破坏目标 JS 字符串字面量。
// 规则：若英文侧已处于字符串上下文（含双引号），中文侧不得新增更多双引号（ce > 0 且 cz > ce 视为危险）——
// 新增的半角直引号会提前终止 bundle 中的字符串字面量，导致整包语法崩溃（2026-09-11 灰屏事故根因）。
// 中文引号一律使用全角弯引号 “ ” 或「」。
const assert = require('assert');
const { auxiliaryInterfaceReplacements } = require('../dist/translate/auxiliary.js');
const safeSentences = require('../rules/safe-sentences.json');
const scopedFragments = require('../rules/scoped-fragments.json');
const pluginMarket = require('../rules/plugin-market.json');

const q = (s) => s.split('"').length - 1;
const bad = [];
const check = (en, zh, tag) => {
  const ce = q(en), cz = q(zh);
  if (ce > 0 && cz > ce) bad.push(`${tag} [+${cz - ce}"]: ${en.slice(0, 80)}`);
};

for (const [en, zh] of auxiliaryInterfaceReplacements) check(en, zh, 'auxiliary');
for (const [en, zh] of Object.entries(safeSentences)) check(en, zh, 'safe-sentences');
for (const pair of scopedFragments) {
  if (Array.isArray(pair) && pair.length === 2) check(pair[0], pair[1], 'scoped-fragments');
}
const fragRules = pluginMarket.fragmentRules ?? [];
for (const rule of fragRules) {
  if (Array.isArray(rule) && rule.length >= 2) check(rule[0], rule[1], 'plugin-market');
}

if (bad.length) {
  console.error(`❌ verify-structural: ${bad.length} 条词条会在字符串上下文中新增半角直引号：`);
  for (const b of bad) console.error('  -', b);
  process.exit(1);
}
console.log(`✅ verify-structural 全部通过（auxiliary ${auxiliaryInterfaceReplacements.length} 条 + safe ${Object.keys(safeSentences).length} 条 + scoped ${scopedFragments.length} 条）`);
