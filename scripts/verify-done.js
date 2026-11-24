const fs = require('fs');
const path = require('path');
const { auxiliaryInterfaceReplacements: auxDone } = require(path.join(__dirname, '..', 'dist', 'translate', 'auxiliary.js'));
const { scopedReplacements: scopedDone } = require(path.join(__dirname, '..', 'src', 'rules-loader.js'));
// Cursor 安装根目录（默认 D: 盘，可用 argv[2] 覆盖）
const APP_ROOT = process.argv[2] || 'D:/Program Files/cursor/resources/app';
const WB = path.join(APP_ROOT, 'out/vs/workbench');
const glass = fs.readFileSync(path.join(WB, 'workbench.glass.main.js'), 'utf8');
const desk = fs.readFileSync(path.join(WB, 'workbench.desktop.main.js'), 'utf8');
require('./lib/bundle-state').checkBundle(path.join(WB, 'workbench.glass.main.js'), 'glass');
require('./lib/bundle-state').checkBundle(path.join(WB, 'workbench.desktop.main.js'), 'desk');
function cnt(s, k) { let i = s.indexOf(k), n = 0; while (i !== -1) { n++; i = s.indexOf(k, i + k.length); } return n; }
// 从统一规则源提取含 Done 的规则（aux + scoped）
const doneRules = [...auxDone, ...scopedDone].filter(([en]) => en && en.includes('Done'));
const seen = new Set();
for (const [en, zh] of doneRules) {
  if (seen.has(en)) continue;
  seen.add(en);
  const g = cnt(glass, en), d = cnt(desk, en);
  if (g > 0 || d > 0) console.log((g ? 'G' : '.') + (d ? 'D' : '.') + '  ' + JSON.stringify(en) + '  glass:' + g + ' desk:' + d);
}