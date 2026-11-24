const fs = require('fs');
const crypto = require('crypto');
const { writeFileSafe } = require('../core/backup');
// ═══════════════════════════════════════════════
// Hash 修复
// ═══════════════════════════════════════════════

function detectHashAlgo(hash) {
    const len = hash.length;
    if (len <= 24) return 'md5';
    if (len <= 44) return 'sha256';
    if (len <= 88) return 'sha512';
    return 'sha256';
}

/**
 * 使用内存中的文件内容更新 product.json 校验值（避免写回后立刻读盘失败）
 * @param {string | Buffer} fileContent
 */
function fixProductHash(fileContent, productJsonPath, checksumFileName = 'workbench.desktop.main.js') {
    const contentBuffer = Buffer.isBuffer(fileContent)
        ? fileContent
        : Buffer.from(fileContent, 'utf8');

    if (!fs.existsSync(productJsonPath)) {
        throw new Error(`找不到 product.json: ${productJsonPath}`);
    }

    const productJson = JSON.parse(fs.readFileSync(productJsonPath, 'utf8'));
    let hashUpdated = false;

    if (productJson.checksums) {
        for (const key in productJson.checksums) {
            if (key.endsWith(checksumFileName)) {
                const oldHash = productJson.checksums[key];
                const algo = detectHashAlgo(oldHash);
                const newHash = crypto.createHash(algo)
                    .update(contentBuffer)
                    .digest('base64')
                    .replace(/=+$/, '');
                productJson.checksums[key] = newHash;
                hashUpdated = true;
                break;
            }
        }
    }

    if (hashUpdated) {
        writeFileSafe(productJsonPath, JSON.stringify(productJson, null, '\t'), 'utf8');
    }
    return hashUpdated;
}

module.exports = { detectHashAlgo, fixProductHash };
