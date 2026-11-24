// 定位规则源中 EN 含中文的重译规则（真死规则）
// 这些规则只在"已部分汉化"的 bundle 上触发，英文全新包上永远不触发。
const { auxiliaryInterfaceReplacements: aux } = require('../dist/translate/auxiliary.js');
const { scopedReplacements: scoped } = require('../src/rules-loader');

const hasCJK = (s) => /[一-鿿]/.test(s);
const unescape = (s) => s.replace(/\\(['\\`$])/g, '$1');

for (const [name, entries] of [['auxiliaryInterfaceReplacements', aux], ['scopedReplacements', scoped]]) {
  const hits = entries.filter(([en]) => en && hasCJK(en));
  console.log(`\n${name}: EN 含中文 ${hits.length} 条`);
  hits.forEach(([en]) => console.log(`  ${unescape(en).slice(0, 70)}`));
}