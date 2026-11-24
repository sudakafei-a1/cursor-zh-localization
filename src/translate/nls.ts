const fs = require('fs');
const { nativeNlsDict } = require('../dict');
const { safeGlobalDict } = require('../rules-loader');
const { ICON, createProgress, createChangeTracker, formatReplacementDetail } = require('../core/progress');
const { writeFileSafe } = require('../core/backup');
function translateNlsMessagesFile(filePath, { title = '正在处理原生提示文案: nls.messages.json', isSub = false } = {}) {
    if (!filePath || !fs.existsSync(filePath)) return { processed: false };

    console.log(isSub ? `  ↳ ${title}` : `\n${ICON.proc} ${title}`);

    let messages;
    try {
        messages = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        throw new Error(`无法解析 ${filePath}: ${err.message}`);
    }

    if (!Array.isArray(messages)) {
        console.log(`${ICON.info} nls.messages.json 不是数组格式，已跳过。`);
        return { processed: false };
    }

    const progress = createProgress(2);
    const changes = createChangeTracker();
    progress.update('准备汉化原生提示', '正在扫描 nls 消息');
    /**
     * NLS 词条查找策略（按优先级）：
     * 1. 精确匹配整个字符串
     * 2. 去除所有 &&（助记符标记）后匹配
     * 3. 去除 {0}/{1} 占位符后匹配基础模板
     */
    const lookupTranslation = (key) => {
        if (Object.prototype.hasOwnProperty.call(safeGlobalDict, key)) {
            return safeGlobalDict[key];
        }
        if (Object.prototype.hasOwnProperty.call(nativeNlsDict, key)) {
            return nativeNlsDict[key];
        }
        // 去除所有 && 后查找（如 "Give &&Feedback..." → "Give Feedback..."）
        const stripped = key.replace(/&&/g, '');
        if (stripped !== key) {
            if (Object.prototype.hasOwnProperty.call(safeGlobalDict, stripped)) {
                return safeGlobalDict[stripped];
            }
            if (Object.prototype.hasOwnProperty.call(nativeNlsDict, stripped)) {
                return nativeNlsDict[stripped];
            }
        }
        return null;
    };

    const translated = messages.map((value) => {
        if (typeof value !== 'string') return value;

        const directTranslation = lookupTranslation(value);
        if (directTranslation) {
            // 如果原文含 &&，翻译后在首字前加 && 以保留助记符快捷键
            let next = directTranslation;
            if (value.includes('&&') && !next.includes('&&')) {
                // 中文不需要字母助记符，去掉 && 避免乱码显示
                next = directTranslation;
            }
            changes.record('原生提示词条', value, next, 1);
            progress.update('替换原生提示', formatReplacementDetail(value, next, 1));
            return next;
        }

        // 半翻译残留清理：官方语言包已部分翻译（含中文）但保留 Agents Window 英文的词条
        // （如 "新建 Agents Window"），统一补全为"智能体窗口"（吞掉前后空格）。
        // 纯英文词条由词典完整翻译，不在此处理，避免中英混杂。
        if (/[一-鿿]/.test(value) && value.includes('Agents Window') && !value.includes('智能体窗口')) {
            const next = value.replace(/ ?Agents Window ?/g, '智能体窗口');
            changes.record('原生提示半译清理', value, next, 1);
            progress.update('清理半翻译残留', formatReplacementDetail(value, next, 1));
            return next;
        }

        return value;
    });

    progress.step('原生提示扫描完成');

    try {
        writeFileSafe(filePath, JSON.stringify(translated), 'utf8');
    } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            throw new Error(`无法写入 ${filePath}：权限不足。请关闭 Cursor 后以管理员身份运行本工具。`);
        }
        throw err;
    }

    progress.finish('原生提示处理完成');
    changes.print();
    console.log(isSub ? `  ${ICON.ok} 语言包缓存汉化完成！` : `${ICON.ok} nls.messages.json 汉化完成！`);

    return { processed: true };
}

module.exports = { translateNlsMessagesFile };
