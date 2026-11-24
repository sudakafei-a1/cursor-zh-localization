const fs = require('fs');
const os = require('os');
const path = require('path');
const { ICON } = require('../core/progress');
const { backupFile, restoreFromBackup, writeFileSafe } = require('../core/backup');
// ═══════════════════════════════════════════════
// 用户扩展翻译（远程 SSH/WSL/容器命令面板）
// ═══════════════════════════════════════════════

const extensionCommandDict = {
    // Dev Containers
    "Open Folder in Container": "在容器中打开文件夹",
    "Show Dev Containers Log": "显示开发容器日志",
    "Attach to Running Container": "附加到正在运行的容器",
    "Open Container Configuration File": "打开容器配置文件",
    "Attach to Running Kubernetes Container...": "附加到正在运行的 Kubernetes 容器...",
    "Dev Containers": "开发容器",
    // Remote-SSH
    "Connect to Host...": "连接到主机...",
    "Connect Current Window to Host...": "将当前窗口连接到主机...",
    "Open SSH Configuration File...": "打开 SSH 配置文件...",
    "Connect to Host in New Window": "在新窗口中连接到主机",
    "Connect to Host in Current Window": "在当前窗口中连接到主机",
    "Remote-SSH": "远程 SSH",
    // WSL
    "Connect to WSL": "连接到 WSL",
    "Connect to WSL using Distro...": "使用指定发行版连接到 WSL...",
    "Connect to WSL in New Window": "在新窗口中连接到 WSL",
    "Connect to WSL using Distro in New Window...": "在新窗口中使用指定发行版连接到 WSL...",
    "Open Folder in WSL": "在 WSL 中打开文件夹",
};

function translateUserExtensions() {
    const homeDir = os.homedir();
    const extDir = path.join(homeDir, '.cursor', 'extensions');
    if (!fs.existsSync(extDir)) return { processed: 0 };

    console.log(`\n${ICON.proc} 正在处理用户扩展: 远程开发命令面板`);
    const remotePrefixes = ['anysphere.remote-containers', 'anysphere.remote-ssh', 'anysphere.remote-wsl'];
    let processed = 0;

    const entries = fs.readdirSync(extDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!remotePrefixes.some(p => entry.name.startsWith(p))) continue;

        const pkgPath = path.join(extDir, entry.name, 'package.json');
        if (!fs.existsSync(pkgPath)) continue;

        // 备份
        backupFile(pkgPath);

        let pkg;
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch {
            console.log(`  ${ICON.warn} 无法解析 ${entry.name}/package.json，已跳过`);
            continue;
        }

        let changed = false;
        const commands = pkg.contributes?.commands;
        if (Array.isArray(commands)) {
            for (const cmd of commands) {
                if (cmd.title && extensionCommandDict[cmd.title]) {
                    cmd.title = extensionCommandDict[cmd.title];
                    changed = true;
                }
                if (cmd.category && extensionCommandDict[cmd.category]) {
                    cmd.category = extensionCommandDict[cmd.category];
                    changed = true;
                }
            }
        }

        // viewsContainers/views 中的标题也可能包含英文
        const viewsContainers = pkg.contributes?.viewsContainers;
        if (viewsContainers) {
            for (const [, views] of Object.entries(viewsContainers)) {
                if (Array.isArray(views)) {
                    for (const v of views) {
                        if (v.title && extensionCommandDict[v.title]) {
                            v.title = extensionCommandDict[v.title];
                            changed = true;
                        }
                    }
                }
            }
        }

        if (changed) {
            writeFileSafe(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
            processed++;
        }
    }

    if (processed > 0) {
        console.log(`  ${ICON.ok} 已汉化 ${processed} 个远程扩展的命令面板条目`);
    } else {
        console.log(`  ${ICON.info} 未发现需要汉化的远程扩展（可能尚未安装）。`);
    }
    return { processed };
}

function restoreUserExtensions() {
    const homeDir = os.homedir();
    const extDir = path.join(homeDir, '.cursor', 'extensions');
    if (!fs.existsSync(extDir)) return 0;

    let restored = 0;
    const entries = fs.readdirSync(extDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.startsWith('anysphere.remote-')) continue;
        const pkgPath = path.join(extDir, entry.name, 'package.json');
        if (restoreFromBackup(pkgPath)) {
            restored++;
        }
    }
    return restored;
}


// ═══════════════════════════════════════════════
// 内置扩展本地化（md 预览等 UI 文案来自 app/extensions/*/package.nls.json）
// ═══════════════════════════════════════════════

/** 内置扩展 → 项目内中文语言文件映射 */
const BUILTIN_EXT_NLS = [
    {
        dirName: 'markdown-language-features',
        zhFile: path.join(__dirname, '..', 'markdown-language-features.zh-cn.json'),
    },
];

/**
 * 部署内置扩展中文语言包（package.nls.zh-cn.json）。
 * 界面语言为 zh-cn 时扩展自动加载该文件，不修改英文原版（英文包另存 .backup 备查）。
 * @param {string} appPath Cursor app 路径
 */
function translateBuiltinExtensions(appPath) {
    const extRoot = path.join(appPath, 'extensions');
    if (!fs.existsSync(extRoot)) return { processed: 0 };

    let processed = 0;
    for (const item of BUILTIN_EXT_NLS) {
        const extDir = path.join(extRoot, item.dirName);
        const enPath = path.join(extDir, 'package.nls.json');
        const zhPath = path.join(extDir, 'package.nls.zh-cn.json');
        if (!fs.existsSync(enPath) || !fs.existsSync(item.zhFile)) continue;

        // 备份英文原版（首次）
        const backupPath = enPath + '.backup';
        if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(enPath, backupPath);
        }
        fs.copyFileSync(item.zhFile, zhPath);
        processed++;
    }

    if (processed > 0) {
        console.log(`\n${ICON.proc} 正在部署内置扩展中文语言包（${processed} 个）...`);
        console.log(`  ${ICON.ok} 已部署 ${processed} 个扩展语言包（package.nls.zh-cn.json）`);
    }
    return { processed };
}

/**
 * 移除部署的内置扩展中文语言包，恢复英文显示。
 * @param {string} appPath Cursor app 路径
 * @returns {number} 移除数量
 */
function restoreBuiltinExtensions(appPath) {
    const extRoot = path.join(appPath, 'extensions');
    if (!fs.existsSync(extRoot)) return 0;

    let restored = 0;
    for (const item of BUILTIN_EXT_NLS) {
        const zhPath = path.join(extRoot, item.dirName, 'package.nls.zh-cn.json');
        if (fs.existsSync(zhPath)) {
            try {
                fs.unlinkSync(zhPath);
                restored++;
            } catch { /* ignore */ }
        }
    }
    if (restored > 0) {
        console.log(`  ${ICON.ok} 已移除内置扩展中文语言包 ${restored} 个`);
    }
    return restored;
}

module.exports = { translateUserExtensions, restoreUserExtensions, translateBuiltinExtensions, restoreBuiltinExtensions };
