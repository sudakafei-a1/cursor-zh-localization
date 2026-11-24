const { riskyShortWords } = require('../dict');
const { safeGlobalDict } = require('../rules-loader');
const { escapeRegExp } = require('../core/progress');
// ═══════════════════════════════════════════════
// 预编译正则（模块加载时一次性构建，后续复用）
// ═══════════════════════════════════════════════

// 安全长句：按长度降序排列，确保长句优先匹配
const safeEntries = Object.entries(safeGlobalDict).sort((a, b) => b[0].length - a[0].length);
const safePattern = safeEntries.map(([en]) => escapeRegExp(en)).join('|');

// 单次大正则：匹配被引号包裹的安全长句
const safeMegaRegex = new RegExp(`(["'\`])(${safePattern})\\1`, 'g');

// 长句裸文本正则（>=20 字符，不会与代码变量冲突）
const longEntries = safeEntries.filter(([en]) => en.length >= 20);
const longPattern = longEntries.map(([en]) => escapeRegExp(en)).join('|');
const longMegaRegex = longPattern ? new RegExp(`(${longPattern})`, 'g') : null;

// 危险短词的 UI 属性列表（仅限可见 UI 文案，勿覆盖键位/扫描表）
const uiProps = [
    'children', 'title', 'label', 'placeholder', 'description', 'tooltip', 'text',
    'name', 'message', 'detail', 'heading',
    'markdownDescription', 'aria-label', 'ariaLabel', 'emptyStateText',
    'currentLabel', 'breadcrumbLabel',
];
const uiPropsPattern = uiProps.join('|');

/** 键盘扫描表动态正则缓存：避免每次命中都 new RegExp，短词命中量大时收益明显 */
const protectedRegexCache = new Map();
function getProtectedRegexes(word) {
    let cached = protectedRegexCache.get(word);
    if (!cached) {
        const escaped = escapeRegExp(word);
        cached = {
            // 键盘扫描表格式: [数字,数字,"词"]
            scanTable: new RegExp(`\\[\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*["']${escaped}["']`),
            // 扫描表另一形态: "词",数字,"词"
            scanTableAlt: new RegExp(`["']${escaped}["']\\s*,\\s*\\d+\\s*,\\s*["']${escaped}["']`),
        };
        protectedRegexCache.set(word, cached);
    }
    return cached;
}

/** 键盘扫描表、VK_*、KeyCode 等键位元数据 — 禁止汉化短词误伤 */
function isProtectedKeybindingContext(content, index, word) {
    // 只检查紧邻的小范围（80 字符），避免误伤附近恰好引用 keybindingService 的 UI 代码
    const radius = 80;
    const start = Math.max(0, index - radius);
    const end = Math.min(content.length, index + radius + word.length);
    const slice = content.slice(start, end);

    if (/VK_[A-Z0-9_]+/.test(slice)) return true;
    if (/\bKeyCode\b|\bScanCode\b/.test(slice)) return true;
    // 键盘扫描表格式: [数字,数字,"词"] 或 "词",数字,"词"
    const { scanTable, scanTableAlt } = getProtectedRegexes(word);
    if (scanTable.test(slice)) return true;
    if (scanTableAlt.test(slice)) return true;

    return false;
}

// 危险短词：按长度降序排列后合并为 3 个大正则，单次扫描覆盖全部短词。
// 旧实现为每个短词单独建 3 个正则并循环全量扫描（191 词 × 3 = 573 次 38MB 扫描，约 37s），
// 合并后仅 3 次扫描，实测提速 99%（37s → 0.27s），命中数完全一致。
const riskyWordsDesc = Object.keys(riskyShortWords).sort((a, b) => b.length - a.length);
const riskyWordsPattern = riskyWordsDesc.map(escapeRegExp).join('|');

// UI 属性赋值: children: "General"
const megaPropRegex = new RegExp(`(${uiPropsPattern})\\s*:\\s*(["'\`])(${riskyWordsPattern})\\2`, 'g');
// JSX 文本节点: React.createElement("div", null, "General")
const megaJsxRegex = new RegExp(`(null|}|\\w)\\s*,\\s*(["'\`])(${riskyWordsPattern})\\2\\s*(?=[,)])`, 'g');
// HTML 标签内文本: >General<
const megaHtmlRegex = new RegExp(`>\\s*(${riskyWordsPattern})\\s*<`, 'g');

/**
 * 用合并大正则处理危险短词：单次扫描替代 191 次循环。
 * 命中后通过 riskyShortWords[word] 查表得中文，并经 isProtectedKeybindingContext 跳过键位表。
 * @param {string} jsContent
 * @param {{ record: (group: string, from: string, to: string, count: number) => void }} changes
 * @param {{ update: (label: string, detail?: string) => void }} [progress]
 * @returns {string}
 */
function applyRiskyShortWords(jsContent, changes, progress) {
    let propCount = 0;
    jsContent = jsContent.replace(megaPropRegex, (match, prop, quote, word, offset) => {
        if (isProtectedKeybindingContext(jsContent, offset, word)) return match;
        propCount++;
        changes.record('UI 属性短词', word, riskyShortWords[word], 1);
        return `${prop}: ${quote}${riskyShortWords[word]}${quote}`;
    });
    if (propCount > 0 && progress) progress.update('替换短词', `UI 属性 ${propCount} 处`);

    let jsxCount = 0;
    jsContent = jsContent.replace(megaJsxRegex, (match, pre, quote, word, offset) => {
        if (isProtectedKeybindingContext(jsContent, offset, word)) return match;
        jsxCount++;
        changes.record('JSX 文本短词', word, riskyShortWords[word], 1);
        return `${pre}, ${quote}${riskyShortWords[word]}${quote}`;
    });
    if (jsxCount > 0 && progress) progress.update('替换短词', `JSX 文本 ${jsxCount} 处`);

    let htmlCount = 0;
    jsContent = jsContent.replace(megaHtmlRegex, (match, word, offset) => {
        if (isProtectedKeybindingContext(jsContent, offset, word)) return match;
        htmlCount++;
        changes.record('HTML 文本短词', word, riskyShortWords[word], 1);
        return `>${riskyShortWords[word]}<`;
    });
    if (htmlCount > 0 && progress) progress.update('替换短词', `HTML 文本 ${htmlCount} 处`);

    return jsContent;
}

/**
 * 还原 composer mode 名称。riskyShortWords 会把 modes4 里的 name:"Agent" 翻译成"智能体"，
 * 但用户要求 mode 下拉的 Agent 保持英文（Plan/Debug/Multitask/Ask 同理保持原名）。
 * 在短词替换后调用，只还原 mode 定义数组里的 name 字段，不影响其他"智能体"文案。
 * 注意：只匹配 id:"xxx",name:"中文" 的 mode 定义形态，避免误伤其他 UI。
 */
function restoreComposerModeNames(jsContent) {
    // mode id → 应显示的英文名（与 modes4 里的原名一致）
    const modeNames = {
        agent: "Agent",
        triage: "Triage",
        plan: "Plan",
        spec: "Spec",
        debug: "Debug",
        multitask: "Multitask",
        ask: "Ask",
        project: "Project",
    };
    // 容忍冒号后的空格：短词替换输出形如 name: "中文"，无空格则永远匹配不上
    return jsContent.replace(/id:"([a-z]+)",name:\s*"[^"]*"/g, (match, id) => {
        const name = modeNames[id];
        return name ? `id:"${id}",name:"${name}"` : match;
    });
}

module.exports = { safeMegaRegex, longMegaRegex, applyRiskyShortWords, restoreComposerModeNames };
