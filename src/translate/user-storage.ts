const fs = require('fs');
const path = require('path');
const { ICON } = require('../core/progress');
// ═══════════════════════════════════════════════
// 用户存储汉化 (state.vscdb → composerState.modes4)
// ═══════════════════════════════════════════════

/**
 * 通过 Cursor 内置 node 运行 storage.js，汉化 state.vscdb 中的 modes4 描述
 * @param {string} appPath Cursor app 路径（含 node_modules/@vscode/sqlite3）
 */
function translateUserStorage(appPath) {
    console.log(`\n${ICON.proc} 正在处理用户存储 (state.vscdb)...`);

    // 定位 Cursor 内置 node（仅 Windows/macOS 有）
    const nodeCandidates = process.platform === 'win32'
        ? [path.join(appPath, 'resources', 'helpers', 'node.exe')]
        : process.platform === 'darwin'
            ? [path.join(appPath, '..', 'Frameworks', 'Cursor Helper.app', 'Contents', 'MacOS', 'Cursor Helper')]
            : [];

    const nodeExe = nodeCandidates.find(p => fs.existsSync(p));
    if (!nodeExe) {
        console.log(`  ${ICON.info} 未找到 Cursor 内置 node，跳过用户存储汉化。`);
        return;
    }

    const storageScript = path.join(__dirname, 'storage.js');
    if (!fs.existsSync(storageScript)) {
        console.log(`  ${ICON.info} storage.js 不存在，跳过用户存储汉化。`);
        return;
    }

    const { spawnSync } = require('child_process');
    const result = spawnSync(nodeExe, [storageScript, '--action=translate', `--app-path=${appPath}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'inherit', 'inherit'],
        timeout: 30000
    });

    if (result.error) {
        console.log(`  ${ICON.warn} 用户存储汉化执行失败: ${result.error.message}`);
    } else if (result.status !== 0) {
        console.log(`  ${ICON.warn} 用户存储汉化异常退出（非致命）。`);
    }
}

/**
 * 还原 state.vscdb（字段级还原 modes4/参数定义，对话数据不受影响）
 * @param {string} appPath Cursor app 路径（加载 @vscode/sqlite3 需要）
 */
function restoreUserStorage(appPath) {
    const storageScript = path.join(__dirname, 'storage.js');
    if (!fs.existsSync(storageScript)) {
        return;
    }

    // 还原为字段级（仅改 applicationUser 内汉化字段），需 Cursor 内置 node 加载 @vscode/sqlite3
    if (appPath) {
        const { spawnSync } = require('child_process');
        const nodeCandidates = process.platform === 'win32'
            ? [path.join(appPath, 'resources', 'helpers', 'node.exe')]
            : process.platform === 'darwin'
                ? [path.join(appPath, '..', 'Frameworks', 'Cursor Helper.app', 'Contents', 'MacOS', 'Cursor Helper')]
                : [];
        const nodeExe = nodeCandidates.find(p => fs.existsSync(p));
        if (nodeExe) {
            const result = spawnSync(nodeExe, [storageScript, '--action=restore', `--app-path=${appPath}`], {
                encoding: 'utf8',
                stdio: ['ignore', 'inherit', 'inherit'],
                timeout: 30000
            });
            if (result.error) {
                console.log(`  ${ICON.warn} 用户存储还原执行失败: ${result.error.message}`);
            } else if (result.status !== 0) {
                console.log(`  ${ICON.warn} 用户存储还原异常退出（非致命）。`);
            }
            return;
        }
    }
    console.log(`  ${ICON.info} 未找到 Cursor 内置 node，跳过用户存储还原（字段级还原需加载 @vscode/sqlite3）。`);
}

module.exports = { translateUserStorage, restoreUserStorage };
