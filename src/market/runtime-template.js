/* CSSZH_PluginMarket — 插件市场汉化（浏览器端运行时，离线精确整句）
 *
 * 由 Cursor-zh 拼接进 workbench.html 在浏览器端执行：MutationObserver 监听工作台，
 * 对文本节点做「整句精确匹配」替换（词典来自 rules/plugin-market.json）。
 * 插件市场的插件名/描述是动态远程英文数据，静态改 bundle 覆盖不到，故在此运行时层处理；
 * 未收录的动态文案不做处理。已含中文的节点跳过，防重复/误翻。
 *
 * 关闭开关：控制台 localStorage.setItem('CSSZH_PluginMarket_Translate','0') 后重启；默认开启。
 *
 * 本文件是模板：CSSZH_*_JSON__ 占位符由 src/market/inject.ts 在注入时替换，词典权威在 rules/plugin-market.json。
 *
 * 词典由 rules/plugin-market.json 唯一提供（经 inject.ts 注入），由验证脚本做一致性断言。
 * 编辑约定：只补完整原文，不做片段替换，不收录品牌名。
 */
(function () {
    'use strict';

    var KEY = __CSSZH_TRANSLATE_KEY_JSON__;

    // ── 离线词典（需与 pluginDict.js 的 pluginNameDict/descriptionDict 保持一致）──
    var NAME_DICT = __CSSZH_NAME_DICT_JSON__;
    var DESC_DICT = __CSSZH_DESC_DICT_JSON__;

    // UI 动态文案词典：模型标语/参数名等来自服务端下发的运行时数据
    //（state.vscdb 写入会在 Cursor 启动联网后被服务端覆盖，故在此 DOM 层兜底）
    var UI_DICT = __CSSZH_UI_DICT_JSON__;

    var REPLACEMENTS = null;
    function getReplacements() {
        if (!REPLACEMENTS) {
            REPLACEMENTS = {};
            var k;
            for (k in DESC_DICT) REPLACEMENTS[k] = DESC_DICT[k];
            for (k in NAME_DICT) REPLACEMENTS[k] = NAME_DICT[k];
            for (k in UI_DICT) REPLACEMENTS[k] = UI_DICT[k];
        }
        return REPLACEMENTS;
    }

    // 读取开关：缺失/异常按默认开启
    var translateOn = true;
    try {
        var v = localStorage.getItem(KEY);
        if (v !== null) translateOn = v !== '0';
    } catch (e) {}
    if (!translateOn) return;

    // 本地片段规则：处理运行时动态拼装文案，如 ["Upgrade to ", 计划名()] → "升级到 Pro"。
    // 纯本地前缀替换、不联网；与离线词典整句精确匹配方式互补。
    var FRAGMENT_RULES = __CSSZH_FRAGMENT_RULES_JSON__;

    function fragmentFor(text) {
        for (var i = 0; i < FRAGMENT_RULES.length; i++) {
            var r = FRAGMENT_RULES[i];
            if (text.indexOf(r[0]) === 0) return r[1] + text.slice(r[0].length);
        }
        return null;
    }

    // 整句精确替换；已含中文则跳过（防重复/误翻/触碰中文 UI）
    function translateNode(node) {
        var text = node.nodeValue;
        if (!text) return false;
        if (/[\u4e00-\u9fff]/.test(text)) return false;
        var zh = getReplacements()[text];
        if (zh === undefined) {
            zh = fragmentFor(text);
            if (zh === null || zh === text) return false;
        }
        if (node.__original === undefined) node.__original = text;
        node.__translated = zh;
        if (node.nodeValue === text) node.nodeValue = zh;
        return true;
    }

    // 扫描：跳过编辑区/输入区，rAF 合并同帧 Mutation
    function scan() {
        scheduled = false;
        if (!document.body) return;
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        var node, list = [];
        while ((node = walker.nextNode())) {
            var parent = node.parentElement;
            if (!parent) continue;
            if (parent.closest('input, textarea, select, [contenteditable="true"]')) continue;
            list.push(node);
        }
        for (var i = 0; i < list.length; i++) translateNode(list[i]);
    }

    var scheduled = false;
    function scheduleScan() {
        if (scheduled) return;
        scheduled = true;
        (window.requestAnimationFrame || function (fn) { setTimeout(fn, 16); })(scan);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleScan);
    } else {
        scheduleScan();
    }
    if (window.MutationObserver) {
        var target = document.documentElement || document.body;
        if (target) {
            new MutationObserver(scheduleScan).observe(target, { childList: true, characterData: true, subtree: true });
        }
    }
})();