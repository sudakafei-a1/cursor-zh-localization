#!/usr/bin/env node
/**
 * 黄金快照回归：定格当前翻译管线行为，重构后逐字节比对。
 *   node scripts/golden.js capture  → restore→记输入hash→translate→记输出hash→写 test/golden/golden.json
 *   node scripts/golden.js check    → restore→比输入hash→translate→比输出hash（必须全一致）
 * 前置：Cursor 完全退出；对安装目录有写权限（无则用管理员终端）。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = findRoot(__dirname);
const GOLDEN_FILE = path.join(ROOT, 'test', 'golden', 'golden.json');
const CONFIG_FILE = path.join(os.homedir(), '.cursor-zh', 'config.json');

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function findRoot(start) {
    let d = path.resolve(start);
    while (d !== path.parse(d).root) {
        if (fs.existsSync(path.join(d, 'package.json'))) return d;
        d = path.dirname(d);
    }
    return path.resolve(start);
}

function hashFile(p) { return sha256(fs.readFileSync(p)); }

function snapshotArtifacts(pathsMap) {
    const out = {};
    for (const [name, p] of Object.entries(pathsMap)) {
        if (!fs.existsSync(p)) throw new Error(`产物不存在: ${p}`);
        out[name] = hashFile(p);
    }
    return out;
}

function diffHashes(actual, expected) {
    return Object.keys(expected).filter(k => actual[k] !== expected[k]);
}

// platform.js 保持 JS（src/）；dist/ 为 tsc 拷贝的简化结构。下面仅为保留回退的防御性分支
function resolvePlatform() {
    const src = path.join(ROOT, 'src', 'platform.js');
    if (fs.existsSync(src)) return src;
    const dist = path.join(ROOT, 'dist', 'src', 'platform.js');
    if (fs.existsSync(dist)) return dist;
    throw new Error('未找到 platform 模块（src/platform.js 或 dist/src/platform.js）');
}

function loadCtx() {
    if (!fs.existsSync(CONFIG_FILE)) {
        throw new Error('未找到 ~/.cursor-zh/config.json，请先运行一次 node index.js 完成路径配置');
    }
    let appPath;
    try { appPath = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).cursorAppPath; }
    catch { throw new Error('config.json 解析失败，请删除后重新运行 node index.js 生成'); }
    if (!appPath || !fs.existsSync(appPath)) throw new Error(`cursorAppPath 无效: ${appPath}`);
    const { buildPathsFromAppPath } = require(resolvePlatform());
    const p = buildPathsFromAppPath(appPath);
    const artifacts = {
        'workbench.desktop.main.js': p.mainJsPath,
        'workbench.glass.main.js': p.glassJsPath,
        'workbench.anysphere-ui-automations.js': p.automationsJsPath,
        'workbench.html': p.htmlPath,
    };
    return { appPath, artifacts };
}

function ensureCursorClosed() {
    const { isCursorRunning } = require(resolvePlatform());
    if (isCursorRunning()) throw new Error('Cursor 正在运行，请先完全退出（含托盘图标）');
}

function ensureWritable(appPath) {
    const probe = path.join(appPath, `.csszh-golden-probe-${process.pid}`);
    try { fs.writeFileSync(probe, ''); fs.unlinkSync(probe); }
    catch { throw new Error(`无写入权限: ${appPath}。请用管理员身份的终端运行本命令`); }
}

function runTool(action) {
    execSync(`node "${path.join(ROOT, 'index.js')}" --action=${action}`, { cwd: ROOT, stdio: 'inherit' });
}

function cmdCapture() {
    const { appPath, artifacts } = loadCtx();
    ensureCursorClosed(); ensureWritable(appPath);
    runTool('restore');
    const inputs = snapshotArtifacts(artifacts);
    runTool('translate');
    const outputs = snapshotArtifacts(artifacts);
    const golden = { capturedAt: new Date().toISOString(), node: process.version, inputs, outputs };
    fs.mkdirSync(path.dirname(GOLDEN_FILE), { recursive: true });
    fs.writeFileSync(GOLDEN_FILE, JSON.stringify(golden, null, 2));
    console.log(`✅ golden capture 完成 → ${path.relative(ROOT, GOLDEN_FILE)}（${Object.keys(inputs).length} 个产物）`);
}

function cmdCheck() {
    if (!fs.existsSync(GOLDEN_FILE)) {
        console.error('❌ 未找到快照，请先: node scripts/golden.js capture'); process.exit(1);
    }
    let golden;
    try { golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8')); }
    catch { console.error('❌ golden.json 损坏，请重新 capture'); process.exit(1); }
    const { appPath, artifacts } = loadCtx();
    ensureCursorClosed(); ensureWritable(appPath);
    runTool('restore');
    const inputDrift = diffHashes(snapshotArtifacts(artifacts), golden.inputs);
    if (inputDrift.length) {
        console.error(`❌ 输入漂移(${inputDrift.join(', ')}): Cursor 可能已升级，请重新 capture`);
        process.exit(1);
    }
    runTool('translate');
    const bad = diffHashes(snapshotArtifacts(artifacts), golden.outputs);
    for (const name of Object.keys(golden.outputs)) {
        console.log(`${bad.includes(name) ? '❌' : '✅'} ${name}`);
    }
    if (bad.length) { console.error(`❌ golden check 失败: ${bad.join(', ')}`); process.exit(1); }
    console.log('✅ golden check 全部通过（逐字节一致）');
}

if (require.main === module) {
    const cmd = process.argv[2];
    try {
        if (cmd === 'capture') cmdCapture();
        else if (cmd === 'check') cmdCheck();
        else { console.error('用法: node scripts/golden.js capture|check'); process.exit(1); }
    } catch (e) { console.error(`❌ ${e.message}`); process.exit(1); }
} else {
    module.exports = { sha256, findRoot, hashFile, snapshotArtifacts, diffHashes, loadCtx };
}
