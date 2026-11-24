// 未翻译文案审计：扫描 glass / automations / desk / main.js
// 两类来源：
//   A. 索引式 nls 调用 A(192,"Undo") —— 对照 CLP 实际生效文案，仍为英文才算未翻译
//   B. UI 属性字面量（children/label/title/...）—— 排除已覆盖词条与噪声
// 用法: node scripts/audit-untranslated.js [app路径]
const fs = require('fs');
const path = require('path');

const APP = process.argv[2] || 'D:/Program Files/Cursor/resources/app';
const CLP_DIR = process.env.APPDATA + '/Cursor/clp';

const TARGETS = {
    glass: 'out/vs/workbench/workbench.glass.main.js',
    auto: 'out/vs/workbench/workbench.anysphere-ui-automations.js',
    desk: 'out/vs/workbench/workbench.desktop.main.js',
    main: 'out/main.js',
};

// ── 已覆盖词条（词典 + aux 列表的字面量）──
const dict = require('../src/dict.js');
const { auxiliaryInterfaceReplacements } = require(path.join(__dirname, '../dist/translate/auxiliary.js'));
const covered = new Set();
for (const [en] of auxiliaryInterfaceReplacements) {
    if (!en) continue;
    (en.match(/"[^"]*"/g) || []).forEach(m => covered.add(m.slice(1, -1)));
    if (!en.includes('"') && !en.includes("'")) covered.add(en);
}
for (const k of Object.keys(dict.safeGlobalDict || {})) covered.add(k);
for (const k of Object.keys(dict.riskyShortWords || {})) covered.add(k);

// ── CLP 实际生效文案（取当前 commit 目录）──
let clp = null;
try {
    const localeDirs = fs.readdirSync(CLP_DIR).filter(d => /zh-cn/i.test(d));
    for (const ld of localeDirs) {
        for (const cd of fs.readdirSync(path.join(CLP_DIR, ld))) {
            const p = path.join(CLP_DIR, ld, cd, 'nls.messages.json');
            if (fs.existsSync(p)) { clp = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
        }
        if (clp) break;
    }
} catch { /* 无 CLP 时索引调用全部按未翻译处理 */ }
console.log('CLP:', clp ? `${clp.length} 条` : '未找到（索引调用按未翻译计）');

const hasCJK = s => /[\u4e00-\u9fff]/.test(s);

// ── A. 索引式 nls：A(192,"Undo") / ft(4814,"...") / Te(9551,"...") / w(2132,"...") ──
const IDX_CALL = /(?:^|[^\w$])([AwfteTEW])\((\d{1,5}),\s*"((?:[^"\\]|\\.)*)"[^)]{0,40}\)/g;
function scanIndexNls(name, src) {
    const found = new Map();
    let m;
    IDX_CALL.lastIndex = 0;
    while ((m = IDX_CALL.exec(src)) !== null) {
        const [, fn, idxStr, fallback] = m;
        if (!fallback || fallback.length < 2 || !/[a-zA-Z]/.test(fallback)) continue;
        if (hasCJK(fallback)) continue;
        const idx = Number(idxStr);
        const effective = clp && clp[idx];
        // CLP 缺失或仍等于英文兜底 → 运行时显示英文
        if (typeof effective === 'string' && effective !== fallback && hasCJK(effective)) continue;
        const key = `${fallback}`;
        if (!found.has(key)) found.set(key, { count: 0, files: new Set(), idxs: new Set() });
        found.get(key).count++;
        found.get(key).files.add(name);
        found.get(key).idxs.add(idx);
    }
    return found;
}

// ── B. UI 属性字面量 ──
const ATTRS = ['children', 'label', 'title', 'placeholder', 'aria-label', 'tooltip', 'message', 'hintText', 'description', 'emptyTitle', 'emptyDescription', 'textActionLabel', 'heading', 'detail', 'prompt', 'primaryButton', 'secondaryButton', 'confirmText', 'cancelText'];
const ATTR_RE = new RegExp(`(?:${ATTRS.join('|')}):"([^]{3,160})"`, 'g');
function isNoise(v) {
    if (hasCJK(v)) return true;
    if (/^[\d\s%.,:+\-~]+$/.test(v)) return true;
    if (/[\\/<>{};=]|https?:|\.com|\.org|\.io|\.sh\b/.test(v)) return true;
    if (/^[a-z][A-Za-z0-9]*$/.test(v)) return true;          // camelCase 标识
    if (/^[A-Z][A-Z0-9_]+$/.test(v)) return true;            // 常量
    if (!/[A-Z]/.test(v[0]) && !/^[\u2026.]/.test(v)) return true; // 须大写开头
    if (!v.includes(' ')) return true;                        // 须含空格（句子/词组）
    if (/^[a-z]+ [a-z]+$/i.test(v) && v.length < 12) return true; // 两个小写短词多为属性值
    if (/\b(TODO|FIXME|test|Test|debug|spec|internal)\b/.test(v)) return true;
    if (covered.has(v)) return true;
    return false;
}
function scanAttrs(name, src) {
    const found = new Map();
    let m;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(src)) !== null) {
        const v = m[1];
        if (isNoise(v)) continue;
        if (!found.has(v)) found.set(v, { count: 0, files: new Set() });
        found.get(v).count++;
        found.get(v).files.add(name);
    }
    return found;
}

// ── 汇总 ──
const results = { indexNls: new Map(), attrs: new Map() };
for (const [name, rel] of Object.entries(TARGETS)) {
    const p = path.join(APP, rel);
    if (!fs.existsSync(p)) { console.log('跳过(不存在):', name); continue; }
    const src = fs.readFileSync(p, 'utf8');
    for (const [k, v] of scanIndexNls(name, src)) {
        if (!results.indexNls.has(k)) results.indexNls.set(k, { count: 0, files: new Set(), idxs: new Set() });
        const r = results.indexNls.get(k);
        r.count += v.count; v.files.forEach(f => r.files.add(f)); v.idxs.forEach(i => r.idxs.add(i));
    }
    for (const [k, v] of scanAttrs(name, src)) {
        if (!results.attrs.has(k)) results.attrs.set(k, { count: 0, files: new Set() });
        const r = results.attrs.get(k);
        r.count += v.count; v.files.forEach(f => r.files.add(f));
    }
}

// ── 输出 ──
const fmtFiles = s => [...s].join('/');
const lines = ['# 未翻译文案审计', '', `CLP: ${clp ? clp.length + ' 条' : '未找到'}`, ''];
lines.push('## 一、索引式 nls 兜底（CLP 未覆盖，运行时显示英文）');
const idxSorted = [...results.indexNls.entries()].sort((a, b) => b[1].count - a[1].count);
lines.push(`共 ${idxSorted.length} 条\n`);
for (const [k, v] of idxSorted) lines.push(`| ${v.count} | ${k.replace(/\|/g, '\\|').slice(0, 90)} | ${fmtFiles(v.files)} | idx ${[...v.idxs].slice(0, 3).join(',')} |`);
lines.push('\n## 二、UI 属性字面量（直接写死的英文）');
const attrSorted = [...results.attrs.entries()].sort((a, b) => b[1].count - a[1].count);
lines.push(`共 ${attrSorted.length} 条\n`);
for (const [k, v] of attrSorted) lines.push(`| ${v.count} | ${k.replace(/\|/g, '\\|').slice(0, 110)} | ${fmtFiles(v.files)} |`);

const md = lines.join('\n');
fs.writeFileSync(path.join(__dirname, 'untranslated-audit.md'), md, 'utf8');
console.log(`索引式 nls 未翻译: ${idxSorted.length} 条`);
console.log(`UI 属性字面量未翻译: ${attrSorted.length} 条`);
console.log('已写入 scripts/untranslated-audit.md');
