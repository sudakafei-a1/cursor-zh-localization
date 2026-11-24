const fs = require('fs');
const { ICON, createProgress, createChangeTracker, formatReplacementDetail, replaceStringWithCount } = require('../core/progress');
const { writeFileSafe } = require('../core/backup');
// ═══════════════════════════════════════════════
// 主进程 main.js：系统托盘菜单等原生 UI
// ═══════════════════════════════════════════════

// 托盘菜单等主进程 UI 词条。用精确片段替换，避免 Settings/Quit 等常见词污染全局词典。
const mainProcessReplacements = [
    ['label:"Loading agents..."', 'label:"正在加载 Agent..."'],
    ['label:"Recent Agents"', 'label:"最近的 Agent"'],
    ['label:"No recent agents"', 'label:"暂无最近 Agent"'],
    ['label:"Clear All Notifications"', 'label:"清除所有通知"'],
    ['label:"New Agent"', 'label:"新建 Agent"'],
    ['label:"Open Cursor"', 'label:"打开 Cursor"'],
    ['label:"Settings"', 'label:"设置"'],
    ['label:"Quit"', 'label:"退出"'],
    ['label:`View More (${i.length})`', 'label:`查看更多 (${i.length})`'],
    // ── 2026-08-24: 3.17.8 原生菜单走 createMenuItem（标签缺省时 Electron 角色回退英文），
    //    按命令 ID 注入中文标签兜底（渲染进程传来的 label 优先级更高，此处仅兜底）──
    ['Array.isArray(t)&&(d=t[0]),j&&(d==="editor.action.clipboardCutAction"', 'Array.isArray(t)&&(d=t[0]),d==="undo"?l.label="撤销":d==="redo"?l.label="重做":d==="editor.action.clipboardCutAction"||d==="glass.osEditCut"?l.label="剪切":d==="editor.action.clipboardCopyAction"||d==="glass.osEditCopy"?l.label="复制":d==="editor.action.clipboardPasteAction"||d==="glass.osEditPaste"?l.label="粘贴":(d==="glass.osEditSelectAll"||d==="editor.action.selectAll")&&(l.label="全选"),j&&(d==="editor.action.clipboardCutAction"'],
    // ── 2026-08-24 全面审计补充：Autopilot PR / 托盘与系统弹窗（仅存在于 main.js）──
    ['Fix CI, conflicts, and comments with full self driving', '全自动驾驶修复 CI、冲突和评论'],
    ['Autopilot PR runtime', 'Autopilot PR 运行时'],
    ['Run locally in a Worktree', '在工作树中本地运行'],
    ['Debug CI Failure', '调试 CI 失败'],
    ['Debug {count} CI Failures', '调试 {count} 个 CI 失败'],
    ['Debugging CI', '正在调试 CI'],
    ['Fix CI with FSD', '使用 FSD 修复 CI'],
    ['Fix {count} CI Failures with FSD', '使用 FSD 修复 {count} 个 CI 失败'],
    ['Desktop bridge failed to send through a window.', '桌面桥接未能通过窗口发送。'],
    ['Start onboarding', '开始引导'],
    ['Cloud agents', '云智能体'],
    ['Open External Link', '打开外部链接'],
    ['Do you want to open this link?', '要打开此链接吗？'],
];

/**
 * 汉化 Electron 主进程文件（系统托盘菜单等原生 UI）。
 * main.js 没有 product.json 校验值，改完无需更新 checksum。
 */
function translateMainJsFile(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return { processed: false };

    console.log(`\n${ICON.proc} 正在处理主进程文件: main.js（系统托盘菜单）`);

    let jsContent = fs.readFileSync(filePath, 'utf8');
    const progress = createProgress(2);
    const changes = createChangeTracker();
    progress.update('处理主进程 UI', '系统托盘菜单');

    for (const [en, zh] of mainProcessReplacements) {
        const result = replaceStringWithCount(jsContent, en, zh);
        jsContent = result.content;
        changes.record('托盘菜单', en, zh, result.count);
        if (result.count > 0) {
            progress.update('替换托盘菜单', formatReplacementDetail(en, zh, result.count));
        }
    }
    progress.step('托盘菜单处理完成');

    try {
        writeFileSafe(filePath, jsContent, 'utf8');
    } catch (err) {
        if (err.code === 'EACCES' || err.code === 'EPERM') {
            throw new Error(`无法写入 ${filePath}：权限不足。请关闭 Cursor 后以管理员身份运行本工具。`);
        }
        throw err;
    }

    progress.finish('主进程文件处理完成');
    changes.print();
    console.log(`${ICON.ok} main.js 汉化完成！`);

    return { processed: true };
}

module.exports = { translateMainJsFile };
