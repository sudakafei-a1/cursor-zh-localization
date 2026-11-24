const fs = require('fs');
const path = require('path');
// 3.17.8 适配验证：Effort/Context/Fast 参数 + 索引状态 / Auto-review / 规则应用方式 / 等待状态
// 用法: node scripts/verify-effort.js [app 路径]
const APP_ROOT = process.argv[2] || 'D:/Program Files/cursor/resources/app';
const WB = path.join(APP_ROOT, 'out/vs/workbench');
const glass = fs.readFileSync(path.join(WB, 'workbench.glass.main.js'), 'utf8');
const desk = fs.readFileSync(path.join(WB, 'workbench.desktop.main.js'), 'utf8');

function cnt(src, kw) {
  let i = src.indexOf(kw), n = 0;
  while (i !== -1) { n++; i = src.indexOf(kw, i + kw.length); }
  return n;
}

let fail = 0;
function expect(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name.padEnd(46) + detail);
  if (!ok) fail++;
}
// 命中数断言：[名称, 文件, 搜索串, 期望次数(数组=任一满足)]
function hit(name, src, kw, want) {
  const n = cnt(src, kw);
  const ok = Array.isArray(want) ? want.includes(n) : n === want;
  expect(name, ok, 'hits:' + n + (ok ? '' : ' (期望 ' + want + ')'));
}

// ── 1. 新版不再包含旧参数名 ──
hit('glass 无 "Thinking intensity"', glass, 'Thinking intensity', 0);
hit('desk  无 "Thinking intensity"', desk, 'Thinking intensity', 0);

// ── 2. 模型参数规范化函数存在（持久翻译注入点）──
hit('glass M8y 规范化函数(完整签名)', glass, 'function M8y(t){const e=mCa(t);return e.variants=e.variants??[],e.parameterDefinitions=e.parameterDefinitions??[],e}', 1);
hit('desk  dzg 规范化函数(完整签名)', desk, 'function dzg(e){const t=p4s(e);return t.variants=t.variants??[],t.parameterDefinitions=t.parameterDefinitions??[],t}', 1);

// ── 3. Cycle 命令标签 / 悬浮提示模板（3.17.8 变量名）──
hit('glass Cycle 标签规则串 (Nb)', glass, 'label:`Cycle ${Nb}`', 1);
hit('glass Cycle 悬浮提示规则串 (Yn/$n)', glass, '\\xB7 Cycle ${Yn} (${$n})', 1);
hit('desk  Cycle 悬浮提示规则串 (hr/Oi)', desk, '\\xB7 Cycle ${hr} (${Oi})', 1);

// ── 4. 3.17.8 补充词条：包内搜索串命中 ──
hit('glass Setting up indexing', glass, 'children:["Setting up indexing",', 1);
hit('desk  Setting up indexing', desk, 'children:["Setting up indexing",', 1);
hit('glass Auto-review(含沙盒)', glass, '"Auto-review (with Sandbox)"', [1, 2]);
hit('desk  Auto-review(含沙盒)', desk, '"Auto-review (with Sandbox)"', [1, 2]);
hit('glass Auto-review 描述(长)', glass, '"Automatically run operations that Auto-review classifies as safe, using sandboxing when possible"', 1);
hit('desk  Auto-review 描述(长)', desk, '"Automatically run operations that Auto-review classifies as safe, using sandboxing when possible"', 1);
hit('glass Auto-review 描述(短)', glass, '"Automatically run operations that Auto-review classifies as safe"', 1);
hit('desk  Auto-review 描述(短)', desk, '"Automatically run operations that Auto-review classifies as safe"', 1);
hit('glass Auto-review 三元分支', glass, ':"Auto-review";', 1);
hit('desk  Auto-review 三元分支', desk, ':"Auto-review";', 1);
hit('glass Auto-review 审批原因', glass, '"Auto-review requires approval"', [0, 1, 2]);
hit('glass Always Applied(0=已译)', glass, '"Always Applied"', [0]);
hit('desk  Always Applied', desk, '"Always Applied"', [2, 3, 4]);
hit('glass Agent Decides When to Apply', glass, '"Agent Decides When to Apply"', [1, 2]);
hit('desk  Agent Decides When to Apply', desk, '"Agent Decides When to Apply"', [1, 2]);
hit('glass 等待三元组', glass, '["Waiting","已等待","Wait skipped"]', 1);
hit('desk  等待三元组', desk, '["Waiting","已等待","Wait skipped"]', 1);
hit('glass Waiting action', glass, '{action:"Waiting",details:', [1, 2]);
hit('desk  Waiting action', desk, '{action:"Waiting",details:', [1, 2]);
hit('glass waiting case', glass, 'case"waiting":return"Waiting";', 1);
hit('desk  waiting case', desk, 'case"waiting":return"Waiting";', 1);
hit('glass Waiting/Wait 毫秒', glass, '?"Waiting":"Wait"', 1);
hit('desk  Waiting/Wait 毫秒', desk, '?"Waiting":"Wait"', 1);
hit('glass compact Waiting', glass, 'compact:"Waiting"', 1);
hit('desk  compact Waiting', desk, 'compact:"Waiting"', 1);
hit('glass for 模板(t/e 形参)', glass, 'return t?e&&e.length>0?`for ${e} in ${t}`:`for ${t}`:""', [0, 1]);
hit('desk  for 模板(t/e 形参)', desk, 'return t?e&&e.length>0?`for ${e} in ${t}`:`for ${t}`:""', [0, 1]);
hit('glass up to 模板(cAr)', glass, '`up to ${cAr(p)} ${d}`', 1);
hit('desk  up to 模板(syi)', desk, '`up to ${syi(g)} ${h}`', 1);
hit('desk  for 模板(e/t 形参)', desk, 'return e?t&&t.length>0?`for ${t} in ${e}`:`for ${e}`:""', 1);

// ── 5. i18n-core.js 已含全部新规则（glass+desktop 两节）──
const core = fs.readFileSync(path.join(__dirname, '..', 'dist', 'i18n-core.js'), 'utf8');
for (const [name, kw, want] of [
  ['core: M8y 注入规则', "['function M8y(t){const e=mCa(t)", 1],
  ['core: dzg 注入规则', "['function dzg(e){const t=p4s(e)", 1],
  ['core: 扩展映射体(6条注入规则)', 'function(p){if(!p)return p;if(p.name==="Effort"', 6],
  ['core: Setting up indexing 规则', 'children:["Setting up indexing",', 2],
  ['core: Auto-review(含沙盒) 规则', '"Auto-review (with Sandbox)"', 2],
  ['core: Auto-review 描述(长) 规则', '"Automatically run operations that Auto-review classifies as safe, using sandboxing when possible"', 2],
  ['core: Always Applied 规则', '"Always Applied"', 2],
  ['core: Agent Decides 规则', '"Agent Decides When to Apply"', 2],
  ['core: 等待三元组 规则', '["Waiting","已等待","Wait skipped"]', 2],
  ['core: Waiting action 规则', '{action:"Waiting",details:', 2],
  ['core: for 模板 规则', '`for ${e} in ${t}`', 2],
  ['core: desk for 模板 规则', '`for ${t} in ${e}`', 1],
  ['core: up to(cAr) 规则', '`up to ${cAr(p)} ${d}`', 2],
  ['core: up to(syi) 规则', '`up to ${syi(g)} ${h}`', 2],
]) {
  hit(name, core, kw, want);
}

// ── 6. 注入映射体可执行性冒烟测试 ──
try {
  const body = core.split('parameterDefinitions=(')[1]?.split('),')[0];
  const fn = eval('(function ' + body + '){const out=[];for(const p of list)out.push(map(p));return out})'
    .replace('function (function(p)', 'function map(p)'));
  console.log('SKIP  映射体冒烟测试（结构特殊，改为下方直接 eval）');
} catch (e) { /* 忽略，改用直接 eval */ }
try {
  const m = core.match(/function\(p\)\{if\(!p\)return p;.*?return p\}/);
  if (!m) throw new Error('映射体未找到');
  const mapFn = eval('(' + m[0] + ')');
  const out = [{ name: 'Effort', markdownTooltip: 'Effort the model uses to generate its response.' },
               { name: 'Context', markdownTooltip: 'Context size used to trigger conversation compaction.' },
               { name: 'Fast', markdownTooltip: 'Significantly faster but consumes more usage' },
               { name: 'Other' }].map(mapFn);
  const ok = out[0].name === '思考强度' && out[0].markdownTooltip === '模型生成回复时使用的思考强度。'
    && out[1].name === '上下文长度' && out[2].name === '快速'
    && out[3].name === 'Other';
  expect('映射体执行结果', ok, JSON.stringify(out.map(o => o.name)));
} catch (e) {
  expect('映射体执行结果', false, e.message);
}

// ── 7. storage.js 词典覆盖 ──
const st = fs.readFileSync(path.join(__dirname, '..', 'src', 'translate', 'storage.js'), 'utf8');
hit('storage: "Effort" 词条', st, '"Effort": "思考强度"', 1);
hit('storage: "Context" 词条', st, '"Context": "上下文长度"', 1);
hit('storage: "Fast" 词条', st, '"Fast": "快速"', 1);
hit('storage: Effort tooltip 词条', st, '"Effort the model uses to generate its response."', 1);
hit('storage: Context tooltip 词条', st, '"Context size used to trigger conversation compaction."', 1);
hit('storage: Fast tooltip 词条', st, '"Significantly faster but consumes more usage"', 1);
hit('storage: 旧词条保留(还原兼容)', st, '"Thinking intensity": "思考强度"', 1);

// ── 8. 第二批词条：包内命中 ──
hit('glass Asking questions', glass, '{action:"Asking questions",details:', 1);
hit('desk  Asking questions', desk, '{action:"Asking questions",details:', 1);
hit('glass Asked 状态', glass, '{action:"Asked",details:', [1, 2]);
hit('desk  Asked 状态', desk, '{action:"Asked",details:', [1, 2]);
hit('glass Add more details(返回形式)', glass, 'return"Add more optional details";', 1);
hit('desk  Add more details(返回形式)', desk, 'return"Add more optional details";', 1);
hit('glass Add more details(三元形式)', glass, '?"Add more optional details...":', 1);
hit('glass Retry 按钮(children)', glass, 'children:"Retry"', 12);
hit('desk  Retry 按钮(children)', desk, 'children:"Retry"', [0, 1]);
hit('glass Retry 按钮(label)', glass, 'label:"Retry"', [1, 2]);
hit('glass Open 按钮(审查三元)', glass, '?"审查":"Open"', 1);
hit('glass Open 按钮(确认框)', glass, 'primaryButton:"Open"', [1, 2]);
hit('desk  Taking longer than expected', desk, 'return"Taking longer than expected\\u2026";', 1);
hit('glass Context Window 能力名', glass, ']:"Context Window"', 1);
hit('desk  Context Window 能力名', desk, ']:"Context Window"', 1);
hit('glass 静态配置 context tooltip', glass, '"Maximum context window size"', 1);
hit('glass 静态配置 thinking tooltip', glass, '"Enable extended thinking for complex reasoning tasks"', 1);
hit('glass Claude 静态 tooltip ×4', glass, '"Claude 4.5 Sonnet with ', 4);

// ── 9. main.js 编辑菜单注入 ──
const mainJs = fs.readFileSync(path.join(APP_ROOT, 'out', 'main.js'), 'utf8');
hit('main  编辑菜单 createMenuItem 锚点', mainJs, 'Array.isArray(t)&&(d=t[0]),j&&(d==="editor.action.clipboardCutAction"', 1);

// ── 10. core 新规则落位 ──
hit('core: Asking questions 规则', core, '{action:"Asking questions",details:', 2);
hit('core: Retry 规则', core, "['children:\"Retry\"', 'children:\"重试\"'],", [2, 3]);
hit('core: Open 规则', core, "['?\"审查\":\"Open\"', '?\"审查\":\"打开\"'],", 2);
hit('core: Taking longer 规则', core, 'return"Taking longer than expected', [1, 2]);
hit('core: main 菜单标签规则', core, "d===\"undo\"?l.label=\"撤销\"", 1);

// ── 11. storage.js 词典覆盖 ──

console.log(fail === 0 ? '\n全部通过' : `\n${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
