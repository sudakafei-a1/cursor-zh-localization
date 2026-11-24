const fs = require('fs');
const path = require('path');
// ═══════════════════════════════════════════════
// 备份与还原
// ═══════════════════════════════════════════════

function backupFile(filePath, productJsonPath) {
    const backupPath = filePath + '.backup';
    const metaPath = backupPath + '.meta';
    const fileName = path.basename(filePath);

    // 读取当前 Cursor 版本（用于检测升级后备份是否陈旧）
    let currentVersion = null;
    if (productJsonPath && fs.existsSync(productJsonPath)) {
        try {
            const product = JSON.parse(fs.readFileSync(productJsonPath, 'utf8'));
            currentVersion = product.version || null;
        } catch { /* ignore */ }
    }

    if (fs.existsSync(backupPath)) {
        // 检测备份是否对应当前版本（Cursor 升级后旧备份需覆盖）
        let backupVersion = null;
        try {
            if (fs.existsSync(metaPath)) {
                backupVersion = JSON.parse(fs.readFileSync(metaPath, 'utf8')).version || null;
            }
        } catch { /* ignore */ }

        if (currentVersion && backupVersion && currentVersion !== backupVersion) {
            // 版本不一致 → Cursor 已升级，旧备份是陈旧原版，覆盖为新原版
            fs.copyFileSync(filePath, backupPath);
            if (currentVersion) {
                try { fs.writeFileSync(metaPath, JSON.stringify({ version: currentVersion }), 'utf8'); } catch { /* ignore */ }
            }
            return `${fileName}: 检测到 Cursor 升级（${backupVersion} → ${currentVersion}），已更新备份`;
        }
        return `${fileName}: 已发现原版备份，保留当前文件继续汉化`;
    } else if (fs.existsSync(filePath)) {
        // 首次运行 → 创建备份
        fs.copyFileSync(filePath, backupPath);
        if (currentVersion) {
            try { fs.writeFileSync(metaPath, JSON.stringify({ version: currentVersion }), 'utf8'); } catch { /* ignore */ }
        }
        return `${fileName}: 已备份纯净原版文件`;
    }
    return null;
}

function restoreFromBackup(filePath) {
    const backupPath = filePath + '.backup';
    const metaPath = backupPath + '.meta';
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, filePath);
        // 还原后删除备份和版本元数据，下次汉化重新创建
        try {
            fs.unlinkSync(backupPath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        } catch { /* ignore */ }
        return true;
    }
    return false;
}

/**
 * 安全写回大文件：优先临时文件替换；失败时回退为直接覆盖（兼容 Program Files 下文件被占用）
 */
function writeFileSafe(filePath, content, encoding = 'utf8') {
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, `.cursor-i18n-${path.basename(filePath)}.${process.pid}.tmp`);

    const verifyExists = () => {
        if (!fs.existsSync(filePath)) {
            throw new Error(`写入后无法找到文件: ${filePath}`);
        }
    };

    const cleanupTmp = () => {
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {
            // ignore
        }
    };

    try {
        fs.writeFileSync(tmpPath, content, encoding);
        try {
            // 用 copyFileSync 覆盖目标（避免先 unlink 再 rename 的窗口期，
            // 若原文件被占用 copyFileSync 会抛异常，原文件不受影响）
            fs.copyFileSync(tmpPath, filePath);
            cleanupTmp();
            verifyExists();
            return;
        } catch {
            cleanupTmp();
        }
    } catch {
        cleanupTmp();
    }

    fs.writeFileSync(filePath, content, encoding);
    verifyExists();
}

module.exports = { backupFile, restoreFromBackup, writeFileSafe };
