const chalk = require('chalk');
// 统一状态圆点图标（不同颜色区分语义）
const ICON = {
    ok: chalk.green('●'),
    warn: chalk.yellow('●'),
    err: chalk.red('●'),
    info: chalk.cyan('●'),
    proc: chalk.blue('●'),
    backup: chalk.magenta('●'),
    note: chalk.gray('●'),
};

// 辅助：转义正则特殊字符
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ═══════════════════════════════════════════════
// 终端进度展示
// ═══════════════════════════════════════════════

const PROGRESS_BAR_WIDTH = 24;

/**
 * 压缩并截断终端展示文本，避免正在替换的长模板撑满整行。
 * 这里保留“正在改什么”的关键信息，详细命中数量会在处理结束后汇总。
 */
function compactText(value, maxLength = 72) {
    const compact = String(value)
        .replace(/\s+/g, ' ')
        .replace(/\n/g, ' ')
        .trim();
    const chars = Array.from(compact);
    if (chars.length <= maxLength) return compact;
    return chars.slice(0, maxLength - 1).join('') + '…';
}

function formatReplacementDetail(from, to, count) {
    const suffix = count > 0 ? `（${count} 处）` : '';
    return `${compactText(from, 30)} → ${compactText(to, 30)}${suffix}`;
}

/**
 * 轻量进度条：TTY 下原地刷新，非 TTY 下只输出阶段完成行。
 * 这样既适合截图里的交互终端，也不会在日志文件里刷出大量重复行。
 */
function createProgress(totalPhases) {
    let current = 0;

    return {
        // update 仅作内部状态记录，不输出：避免每条替换刷一行
        update() {},
        step(label, detail) {
            current = Math.min(totalPhases, current + 1);
            console.log(`  ${ICON.ok} ${label}${detail ? `：${compactText(detail)}` : ''}`);
        },
        finish(label, detail) {
            current = totalPhases;
            console.log(`  ${ICON.ok} ${label}${detail ? `：${compactText(detail)}` : ''}`);
        },
    };
}

function applyReplacementString(template, args) {
    return template.replace(/\$(\d+)/g, (match, index) => {
        const value = args[Number(index)];
        return value === undefined ? match : value;
    });
}

function replaceRegexWithCount(content, regex, replacement) {
    let count = 0;
    const nextContent = content.replace(regex, (...args) => {
        count++;
        if (typeof replacement === 'function') {
            return replacement(...args);
        }
        return applyReplacementString(replacement, args);
    });
    return { content: nextContent, count };
}

function replaceStringWithCount(content, search, replacement) {
    // 预检：不包含直接返回，避免对 10MB+ 文件做无谓的 split/join 扫描
    if (!search || content.indexOf(search) === -1) return { content, count: 0 };
    // 单次 split 即可同时得到替换结果与命中次数，省掉一次独立计数扫描
    const parts = content.split(search);
    const count = parts.length - 1;
    if (count === 0) return { content, count };
    return { content: parts.join(replacement), count };
}

function createChangeTracker(maxSamples = 5) {
    const groupCounts = new Map();
    const samples = [];
    let totalRecorded = 0;

    return {
        record(group, from, to, count) {
            if (count <= 0) return;

            groupCounts.set(group, (groupCounts.get(group) || 0) + count);
            totalRecorded += count;
            if (samples.length < maxSamples) {
                samples.push({ group, from, to, count });
            }
        },
        print() {
            const total = [...groupCounts.values()].reduce((sum, count) => sum + count, 0);
            console.log(`  ${ICON.ok} 汉化替换完成，共修改 ${total} 处。`);

            if (groupCounts.size > 0) {
                console.log(`  ${ICON.note} 修改内容摘要：`);
                for (const [group, count] of groupCounts.entries()) {
                    console.log(`    - ${group}: ${count} 处`);
                }
            }

            if (samples.length > 0) {
                const more = totalRecorded - samples.length;
                console.log(`  ${ICON.info} 本次命中的部分内容${more > 0 ? `（另 ${more} 处省略）` : ''}：`);
                samples.forEach(({ group, from, to, count }) => {
                    console.log(`    - ${group}: ${formatReplacementDetail(from, to, count)}`);
                });
            }
        },
    };
}

module.exports = {
    ICON, PROGRESS_BAR_WIDTH, escapeRegExp, compactText, formatReplacementDetail,
    createProgress, applyReplacementString, replaceRegexWithCount, replaceStringWithCount, createChangeTracker,
};
