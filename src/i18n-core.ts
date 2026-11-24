/**
 * 核心汉化编排器：翻译/还原流程 + Hash 修复 + Mac Gatekeeper 修复。
 * 具体实现已拆分到 src/core 与 src/translate 模块，本文件仅负责编排与再导出。
 */

const fs = require('fs');
const path = require('path');

const { safeGlobalDict, trickyReplacements, scopedReplacements } = require('./rules-loader');
const { translatePluginMarket: translatePluginMarketImpl } = require('./market/inject');

const {
    ICON, compactText, formatReplacementDetail, createProgress, createChangeTracker,
    replaceRegexWithCount, escapeRegExp,
} = require('./core/progress');
const { safeMegaRegex, longMegaRegex, applyRiskyShortWords, restoreComposerModeNames } = require('./core/substitution');
const { backupFile, restoreFromBackup, writeFileSafe } = require('./core/backup');
const { fixProductHash } = require('./core/hash');
const { fixMacGatekeeper } = require('./core/gatekeeper');
const { translateAuxiliaryJsFile } = require('./translate/auxiliary');
const { translateNlsMessagesFile } = require('./translate/nls');
const { getClpRoot, translateClpLanguagePacks, restoreClpLanguagePacks } = require('./translate/clp');
const { translateMainJsFile } = require('./translate/main-process');
const {
    translateUserExtensions, restoreUserExtensions,
    translateBuiltinExtensions, restoreBuiltinExtensions,
} = require('./translate/extensions');
const { translateUserStorage, restoreUserStorage } = require('./translate/user-storage');

// ═══════════════════════════════════════════════
// 插件市场运行时文案汉化（workbench.html 注入）
// 注入实现已迁移至 src/market/inject.ts（词典经模板占位符注入），
// 本地不再维护内联词典；对外 buildPluginMarketInjection/translatePluginMarket 仍由 inject 转发导出。
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// 核心汉化
// ═══════════════════════════════════════════════

/**
 * 执行汉化
 * @param {{ appPath: string, mainJsPath: string, glassJsPath?: string, nlsMessagesPath?: string, htmlPath: string, productJsonPath: string }} paths
 */
function translate(paths) {
    const { appPath, mainJsPath, glassJsPath, automationsJsPath, nlsMessagesPath, htmlPath, productJsonPath, mainProcessJsPath } = paths;

    // 1. 备份
    console.log('');
    const msgs = [
        backupFile(htmlPath, productJsonPath),
        backupFile(mainJsPath, productJsonPath),
        glassJsPath && fs.existsSync(glassJsPath) ? backupFile(glassJsPath, productJsonPath) : null,
        automationsJsPath && fs.existsSync(automationsJsPath) ? backupFile(automationsJsPath, productJsonPath) : null,
        nlsMessagesPath && fs.existsSync(nlsMessagesPath) ? backupFile(nlsMessagesPath, productJsonPath) : null,
        mainProcessJsPath && fs.existsSync(mainProcessJsPath) ? backupFile(mainProcessJsPath, productJsonPath) : null,
        backupFile(productJsonPath, productJsonPath),
    ].filter(Boolean);
    const backedUp = msgs.filter(m => m.includes('已备份纯净原版文件')).length;
    const reused = msgs.filter(m => m.includes('已发现原版备份')).length;
    const upgraded = msgs.filter(m => m.includes('检测到 Cursor 升级')).length;
    const parts = [];
    if (backedUp) parts.push(`已备份纯净原版文件 ${backedUp} 个`);
    if (reused) parts.push(`复用已有备份 ${reused} 个`);
    if (upgraded) parts.push(`随 Cursor 升级更新备份 ${upgraded} 个`);
    console.log(`  ${ICON.backup} ${parts.join('，')}（.backup）`);

    // 2. 读取核心 JS（优先从 .backup 纯净原版读取，保证一键汉化幂等：
    //    删除词条后重新汉化即可清除旧规则残留，避免在已汉化文本上叠加翻译）
    console.log(`\n${ICON.proc} 正在读取并处理核心代码...`);
    const mainBackupPath = mainJsPath + '.backup';
    let jsContent = fs.readFileSync(fs.existsSync(mainBackupPath) ? mainBackupPath : mainJsPath, 'utf8');
    const progress = createProgress(6);
    const changes = createChangeTracker();
    progress.update('准备汉化词库', '正在扫描可替换文本');

    // 3. 安全长句：单次大正则替换
    let safeHitCount = 0;
    jsContent = jsContent.replace(safeMegaRegex, (match, quote, en) => {
        changes.record('安全长句', en, safeGlobalDict[en], 1);
        if (++safeHitCount % 100 === 0) progress.update('替换安全长句', formatReplacementDetail(en, safeGlobalDict[en], 1));
        return `${quote}${safeGlobalDict[en]}${quote}`;
    });
    progress.step('安全长句替换完成');

    // 4. 长句裸文本替换
    if (longMegaRegex) {
        let longHitCount = 0;
        jsContent = jsContent.replace(longMegaRegex, (match, en) => {
            changes.record('裸文本长句', en, safeGlobalDict[en], 1);
            if (++longHitCount % 100 === 0) progress.update('替换裸文本长句', formatReplacementDetail(en, safeGlobalDict[en], 1));
            return safeGlobalDict[en];
        });
    }
    progress.step('裸文本长句处理完成');

    // 5. 暴力正则破译：处理带标点、特殊转义、单双引号混用的顽固长句
    progress.update('处理顽固词条', '包含特殊符号、动态模板和 Unicode 转义');

    trickyReplacements.forEach(({ regex, zh }) => {
        const before = jsContent;
        const result = replaceRegexWithCount(jsContent, regex, zh);
        jsContent = result.content;
        changes.record('顽固词条', regex.source, zh, result.count);
        if (result.count > 0) {
            progress.update('替换顽固词条', formatReplacementDetail(regex.source, zh, result.count));
        } else if (before !== jsContent) {
            progress.update('替换顽固词条', compactText(regex.source));
        }
    });
    progress.step('顽固词条处理完成');

    // 5.1 设置侧边栏映射与部分编译模板片段

    // 合并大正则：单次扫描替代逐条替换（~1803条 → 1次扫描）
    const scopedLookup = new Map(scopedReplacements.filter(([en]) => en));
    const scopedMegaRegex = new RegExp(
        scopedReplacements
            .filter(([en]) => en)
            .sort((a, b) => b[0].length - a[0].length)
            .map(([en]) => escapeRegExp(en))
            .join('|'),
        'g'
    );

    let scopedCount = 0;
    jsContent = jsContent.replace(scopedMegaRegex, (match) => {
        scopedCount++;
        return scopedLookup.get(match);
    });
    if (scopedCount > 0) {
        progress.update('替换界面片段', `${scopedCount} 处`);
        changes.record('界面片段', '<合并大正则>', '<中文>', scopedCount);
    }
    progress.step('界面片段处理完成');

    const worktreeCountResult = replaceRegexWithCount(
        jsContent,
        /`\$\{d\.length\} worktree\$\{d\.length===1\?"":"s"\}`/g,
        '`${d.length} 个工作树`'
    );
    jsContent = worktreeCountResult.content;
    changes.record('动态模板', '`${d.length} worktree${d.length===1?"":"s"}`', '`${d.length} 个工作树`', worktreeCountResult.count);
    // 6. 危险短词：精准 UI 属性替换（跳过键盘扫描表等键位元数据）
    progress.update('处理短词', '仅替换可见 UI 属性，跳过键盘扫描表');
    jsContent = applyRiskyShortWords(jsContent, changes, progress);
    jsContent = restoreComposerModeNames(jsContent);
    progress.step('短词处理完成');

    progress.finish('核心代码处理完成');
    changes.print();

    // 7. 写回（Program Files 等目录下避免写后立刻读盘失败）
    try {
        writeFileSafe(mainJsPath, jsContent, 'utf8');
    } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            throw new Error(
                `无法写入 ${mainJsPath}：权限不足。请关闭 Cursor 后以管理员身份运行本工具，或将 Cursor 安装到用户目录。`
            );
        }
        throw err;
    }
    console.log(`${ICON.ok} 核心 JS 文件智能汉化完成！`);

    // 8. 修复 Hash（使用内存内容，不依赖写回后再次打开主 JS）
    console.log(`\n${ICON.proc} 正在重新计算指纹并修复文件完整性...`);
    const hashFixed = fixProductHash(jsContent, productJsonPath);
    if (hashFixed) {
        console.log(`${ICON.ok} 已更新 product.json 校验值，消除「安装已损坏」警告。`);
    } else {
        console.log(`${ICON.warn} 未找到对应的校验项，可能无需更新。`);
    }

    const auxiliaryResult = translateAuxiliaryJsFile(glassJsPath, productJsonPath);
    if (auxiliaryResult.processed) {
        if (auxiliaryResult.hashFixed) {
            console.log(`${ICON.ok} 已更新附加窗口 JS 校验值。`);
        } else {
            console.log(`${ICON.info} 附加窗口 JS 未发现校验项，已跳过 product.json 更新。`);
        }
    }

    // Automations 界面懒加载 bundle（Runs 页 / 模板分类 / 新建与编辑器，旧版本无此文件）
    const automationsResult = translateAuxiliaryJsFile(automationsJsPath, productJsonPath);
    if (automationsResult.processed && automationsResult.hashFixed) {
        console.log(`${ICON.ok} 已更新 Automations JS 校验值。`);
    }

    translateNlsMessagesFile(nlsMessagesPath);

    // 8.5 语言包缓存（官方 zh-hans 语言包的实际生效文案）
    translateClpLanguagePacks();

    // 8.6 主进程托盘菜单
    translateMainJsFile(mainProcessJsPath);

    // 9. Mac Gatekeeper 修复
    fixMacGatekeeper(appPath);

    // 10. 用户扩展（远程 SSH/WSL/容器命令面板）
    try {
        translateUserExtensions();
    } catch (e) {
        console.log(`  ${ICON.warn} 用户扩展汉化跳过: ${e.message}`);
    }

    // 10.5 内置扩展本地化（md 预览等 UI 文案来自 app/extensions/*/package.nls.json，
    //     部署 package.nls.zh-cn.json 后，中文界面 locale 会自动加载）
    try {
        translateBuiltinExtensions(appPath);
    } catch (e) {
        console.log(`  ${ICON.warn} 内置扩展本地化跳过: ${e.message}`);
    }

    // 11. 用户存储（state.vscdb 中的 modes4 描述，需 Cursor 已关闭）
    try {
        translateUserStorage(appPath);
    } catch (e) {
        console.log(`  ${ICON.warn} 用户存储汉化跳过: ${e.message}`);
    }

    // 11.5 插件市场运行时文案（动态远程数据，离线词典浏览器端注入 workbench.html）
    try {
        translatePluginMarketImpl(htmlPath, productJsonPath, {
            writeFileSafe,
            fixProductHash,
            log: (m) => console.log(`  ${ICON.proc} ${m}`),
        });
    } catch (e) {
        console.log(`  ${ICON.warn} 插件市场汉化注入跳过: ${e.message}`);
    }

    console.log(`\n${ICON.ok} 汉化完成！请重启 Cursor 查看中文设置页。`);
}


/**
 * 恢复英文原版
 * @param {{ mainJsPath: string, glassJsPath?: string, nlsMessagesPath?: string, htmlPath: string, productJsonPath: string }} paths
 */
function restore(paths) {
    const { mainJsPath, glassJsPath, automationsJsPath, nlsMessagesPath, htmlPath, productJsonPath, mainProcessJsPath, appPath } = paths;

    console.log('');
    let restored = 0;
    const coreRestored = [];
    for (const filePath of [htmlPath, mainJsPath, glassJsPath, automationsJsPath, nlsMessagesPath, mainProcessJsPath, productJsonPath].filter(Boolean)) {
        if (restoreFromBackup(filePath)) {
            coreRestored.push(path.basename(filePath));
            restored++;
        }
    }
    if (coreRestored.length > 0) {
        console.log(`  ${ICON.ok} 已还原核心文件 ${coreRestored.length} 个`);
    }

    // 还原用户扩展
    const extRestored = restoreUserExtensions();
    restored += extRestored;
    if (extRestored > 0) {
        console.log(`  ${ICON.ok} 已还原远程开发扩展 ${extRestored} 个`);
    }

    // 还原内置扩展中文语言包
    restored += restoreBuiltinExtensions(appPath);

    // 还原用户存储（state.vscdb，字段级：仅改汉化字段，对话不受影响）
    restoreUserStorage(paths.appPath);

    // 还原 clp 语言包缓存（官方 zh-hans 包补译过的 nls.messages.json）
    const clpRestored = restoreClpLanguagePacks();
    restored += clpRestored;

    if (restored > 0) {
        console.log(`\n${ICON.ok} 已恢复英文原版！请重启 Cursor 生效。`);
    } else {
        console.log(`\n${ICON.warn} 未找到备份文件，无法还原。请确认之前是否执行过汉化。`);
    }
}

module.exports = {
    translate, restore, backupFile, restoreFromBackup, fixProductHash, getClpRoot,
    translatePluginMarket: (...a) => translatePluginMarketImpl(...a),
    buildPluginMarketInjection: (...a) => require('./market/inject').buildPluginMarketInjection(...a),
};