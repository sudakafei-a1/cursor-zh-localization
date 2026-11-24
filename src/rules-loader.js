/**
 * 规则装载器：rules/*.json 是词库唯一权威，本模块只负责读取与预编译。
 * 加载失败必须抛错（不允许静默降级成空词库）。
 */
const fs = require('fs');
const path = require('path');
const fnReplacements = require('./tricky-fn');

function findRoot(start) {
    let d = path.resolve(start);
    while (d !== path.parse(d).root) {
        if (fs.existsSync(path.join(d, 'package.json'))) return d;
        d = path.dirname(d);
    }
    return path.resolve(start);
}
const RULES_DIR = path.join(findRoot(__dirname), 'rules');

function readJson(name) {
    const p = path.join(RULES_DIR, name);
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { throw new Error(`规则文件加载失败 ${p}: ${e.message}`); }
}

const safeGlobalDict = readJson('safe-sentences.json');

// scopedReplacements: [[en, zh], ...]；JSON 数组重构成字符串二元组即可
const scopedReplacements = readJson('scoped-fragments.json').map(([en, zh]) => [en, zh]);

// trickyReplacements: 按 JSON 顺序重建，kind 区分字符串/函数
const trickyRaw = readJson('tricky-regex.json');
const fnList = fnReplacements;
let fnCursor = 0;
const trickyReplacements = trickyRaw.map(item => {
    const regex = new RegExp(item.pattern, item.flags);
    if (item.kind === 'fn') {
        const fn = fnList[item.fnIndex];
        if (!fn) throw new Error(`tricky fnIndex ${item.fnIndex} 缺失`);
        return { regex, zh: fn.zh };
    }
    return { regex, zh: item.zh };
});

const pluginMarket = readJson('plugin-market.json');

module.exports = { safeGlobalDict, scopedReplacements, trickyReplacements, pluginMarket, RULES_DIR };