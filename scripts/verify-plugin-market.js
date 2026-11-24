// 验证插件市场汉化：规则源(rules/plugin-market.json) + 模板注入 + 运行时 + 词典一致性 + 注入拼接
const assert = require('assert');
const fs = require('fs');

const { pluginMarket } = require('../src/rules-loader');
const { buildMarketRuntime, buildPluginMarketInjection, TEMPLATE_PATH } = require('../dist/market/inject');

const { MARKET_TRANSLATE_KEY, pluginNameDict, descriptionDict, fragmentRules, uiDict } = pluginMarket;

// ── 1) 规则源词典：非空、键值均非空字符串、键为英文原文 ──
assert.ok(MARKET_TRANSLATE_KEY.length > 0, 'MARKET_TRANSLATE_KEY 不应为空');
assert.ok(uiDict && Object.keys(uiDict).length > 0, 'uiDict（运行时 UI 动态文案词典）不应为空');
const merged = Object.assign({}, descriptionDict, pluginNameDict, uiDict);
const entries = Object.entries(merged);
assert.ok(entries.length > 0, '词典至少应有一条词条');
for (const [en, zh] of entries) {
    assert.ok(en.length > 0, `英文键不应为空: ${zh}`);
    assert.ok(zh.length > 0, `中文值不应为空: ${en}`);
    // 键不该是已含中文的汉化值（防御性：键应为原文英文）
    assert.ok(!/[\u4e00-\u9fff]/.test(en), `插件词典键应为英文原文，出现中文键: ${en}`);
}

// ── 2) 模板文件：存在、IIFE、MutationObserver、localStorage 开关 ──
assert.ok(fs.existsSync(TEMPLATE_PATH), 'runtime-template.js 应存在');
const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
assert.ok(/\(function\s*\(\)/.test(tpl), '模板应为 IIFE');
assert.ok(tpl.includes('window.MutationObserver'), '模板应使用 MutationObserver');
assert.ok(tpl.includes('localStorage.getItem'), '模板应读取 localStorage 开关');
// 纯离线：不应再残留在线兜底痕迹（防历史在线代码误入）；FRAGMENT_RULES 为本地前缀规则，非 fetch
assert.ok(!tpl.includes('fetch') || tpl.includes('window.fetch'), '模板应为离线实现，不应含在线引擎');

// ── 3) 注入结果：与规则源完全一致（防双处漂移），无残留占位符 ──
const runtime = buildMarketRuntime();
for (const [en, zh] of entries) {
    // 模板对象：键以 JSON 字符串形态注入，值以字面量中文注入，二者均应出现
    assert.ok(
        runtime.includes(JSON.stringify(en)) && runtime.includes(zh),
        `注入运行时缺少词条: ${en} → ${zh}`
    );
}
// 开关 key 与片段规则值
assert.ok(runtime.includes(JSON.stringify(MARKET_TRANSLATE_KEY)), '注入运行时应含开关 key');
assert.ok(runtime.includes('Upgrade to') && runtime.includes('升级到 '), '注入运行时应含片段规则 Upgrade to / 升级到');
assert.ok(fragmentRules && fragmentRules.length > 0, 'fragmentRules 不应为空');
// 无残留占位符
assert.ok(!runtime.includes('__CSSZH_'), '注入结果不应残留 __CSSZH_ 占位符');

// ── 4) 注入拼接：能包成 <script> 且含哨兵标记 ──
const sample = buildPluginMarketInjection('/* 运行时内容 */');
assert.ok(sample.includes('<script>'), '拼接应含 <script> 开标签');
assert.ok(sample.includes('</script>'), '拼接应含 </script> 收标签');
assert.ok(sample.includes('CSSZH_PluginMarket'), '拼接应含哨兵标记');
// 注入内容原文完整保留
assert.ok(sample.includes('/* 运行时内容 */'), '拼接应完整保留运行时内容');

console.log('✅ verify-plugin-market 全部通过');