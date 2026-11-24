const fs = require('fs');
const os = require('os');
const path = require('path');
const { PLATFORM } = require('../platform');
const { ICON } = require('../core/progress');
const { translateNlsMessagesFile } = require('./nls');
/**
 * clp 语言包缓存目录（跨平台，仿 storage.js getDbPath）。
 * Windows: %APPDATA%\Cursor\clp, macOS: ~/Library/Application Support/Cursor/clp,
 * Linux: ~/.config/Cursor/clp
 */
function getClpRoot() {
    const home = os.homedir();
    if (PLATFORM === 'win32') {
        return path.join(home, 'AppData', 'Roaming', 'Cursor', 'clp');
    }
    if (PLATFORM === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'Cursor', 'clp');
    }
    return path.join(home, '.config', 'Cursor', 'clp');
}

/**
 * 汉化语言包缓存（clp 目录下的 nls.messages.json）。
 * 当用户已安装官方 zh-hans 语言包时，Cursor 的实际界面文案来自
 * %APPDATA%\Cursor\clp\<hash>.<locale>\<commit>\nls.messages.json，
 * 而非 out/nls.messages.json（后者仅兜底）。官方包未翻译的
 * Cursor 新词条（浏览器右键菜单等）需在此缓存中补翻。
 */
function translateClpLanguagePacks() {
    const clpRoot = getClpRoot();
    if (!fs.existsSync(clpRoot)) {
        console.log(`\n${ICON.info} 未找到语言包缓存目录（clp），已跳过。`);
        return { processed: false };
    }

    let visited = 0;
    const dirs = fs.readdirSync(clpRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && /zh-cn|zh-hans|zh/i.test(d.name))
        .map(d => path.join(clpRoot, d.name));

    for (const dir of dirs) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const nlsPath = path.join(dir, entry.name, 'nls.messages.json');
            if (!fs.existsSync(nlsPath)) continue;
            visited++;
            // 备份原始语言包缓存（首次），供恢复英文时还原
            const backupPath = nlsPath + '.backup';
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(nlsPath, backupPath);
            }
            console.log(`\n${ICON.proc} 正在处理语言包缓存: ${path.relative(clpRoot, nlsPath)}`);
            translateNlsMessagesFile(nlsPath, { isSub: true });
        }
    }

    if (visited === 0) {
        console.log(`\n${ICON.info} 语言包缓存中未找到 nls.messages.json，已跳过。`);
    }
    return { processed: visited > 0 };
}

/**
 * 还原 clp 语言包缓存：从 .backup 恢复 nls.messages.json 并删除备份。
 * 反方向递归遍历，避免备份文件被误当作普通文件处理。
 * @returns {number} 还原数量
 */
function restoreClpLanguagePacks() {
    const clpRoot = getClpRoot();
    if (!fs.existsSync(clpRoot)) return 0;

    let restored = 0;
    const walk = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (e.name === 'nls.messages.json.backup') {
                const target = p.slice(0, -'.backup'.length);
                try {
                    fs.copyFileSync(p, target);
                    const rel = path.relative(clpRoot, target);
                    console.log(`  ${ICON.ok} 已还原 clp 语言包缓存: ${rel}`);
                    fs.unlinkSync(p);
                    restored++;
                } catch (err) {
                    console.log(`  ${ICON.warn} 还原 clp 缓存失败 ${p}: ${err.message}`);
                }
            }
        }
    };
    walk(clpRoot);
    return restored;
}

module.exports = { getClpRoot, translateClpLanguagePacks, restoreClpLanguagePacks };
