const { execSync } = require('child_process');
const { PLATFORM } = require('../platform');
const { ICON } = require('../core/progress');
// ═══════════════════════════════════════════════
// Mac Gatekeeper 修复
// ═══════════════════════════════════════════════

function fixMacGatekeeper(appPath) {
    if (PLATFORM !== 'darwin') return;

    // 往上找到 .app 目录
    const appBundlePath = appPath.split('/Contents/')[0];
    if (!appBundlePath || !appBundlePath.endsWith('.app')) return;

    console.log(`${ICON.proc} 正在修复 macOS Gatekeeper 签名...`);

    // 1. 清除隔离属性
    try {
        execSync(`xattr -cr "${appBundlePath}"`, { stdio: 'pipe' });
        console.log(`  ${ICON.ok} 已清除隔离属性 (xattr -cr)`);
    } catch (e) {
        console.log(`  ${ICON.warn} 清除隔离属性失败: ${e.message}`);
    }

    // 2. 重签名（容错：用户可能未安装 Xcode 命令行工具）
    try {
        execSync(`codesign --force --deep --sign - "${appBundlePath}"`, { stdio: 'pipe' });
        console.log(`  ${ICON.ok} 已完成本地重签名 (codesign)`);
    } catch (e) {
        console.log(`  ${ICON.warn} codesign 重签名失败（可能未安装 Xcode 命令行工具），不影响使用: ${e.message}`);
    }
}

module.exports = { fixMacGatekeeper };
