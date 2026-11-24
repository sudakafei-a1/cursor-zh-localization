#!/usr/bin/env node
/**
 * tsc 仅会发射/拷贝 .js，不会拷贝被运行时以 fs 绝对路径（__dirname 相对）读取的
 * 非 JS 资产。这里在 build 后把这些资产从 src/ 拷贝到 dist/ 对应位置，
 * 保证编译产物自包含（dev 与 pkg 均能从 dist/ 解析）。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

/** [源(src 相对), 目标(dist 相对)] */
const ASSETS = [
    ['src/markdown-language-features.zh-cn.json', 'markdown-language-features.zh-cn.json'],
];

let copied = 0;
for (const [srcRel, distRel] of ASSETS) {
    const src = path.join(root, srcRel);
    const dest = path.join(root, 'dist', distRel);
    if (!fs.existsSync(src)) {
        console.warn(`⚠ 缺少源资产，跳过: ${srcRel}`);
        continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
}
console.log(`✔ copy-dist-assets: 已同步 ${copied}/${ASSETS.length} 个运行时非 JS 资产到 dist/`);