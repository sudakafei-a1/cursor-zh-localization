// golden.js 纯函数单测（不触碰真实 Cursor 安装）
const crypto = require('crypto');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sha256, snapshotArtifacts, diffHashes, findRoot } = require('../scripts/golden.js');

// sha256 与 node 原生一致
assert.strictEqual(sha256(Buffer.from('abc')),
    crypto.createHash('sha256').update('abc').digest('hex'));

// snapshotArtifacts：对临时目录文件取哈希
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-'));
try {
    fs.writeFileSync(path.join(tmp, 'a.js'), 'AAA');
    fs.writeFileSync(path.join(tmp, 'b.js'), 'BBB');
    const snap = snapshotArtifacts({ 'a.js': path.join(tmp, 'a.js'), 'b.js': path.join(tmp, 'b.js') });
    assert.ok(/^[0-9a-f]{64}$/.test(snap['a.js']), 'hash 应为 sha256 hex');
    assert.strictEqual(snap['a.js'], sha256(Buffer.from('AAA')), 'hash 应与内容对应');

    // diffHashes：一致返回 []；不一致返回差异名列表
    assert.deepStrictEqual(diffHashes(snap, snap), []);
    assert.deepStrictEqual(diffHashes(snap, { 'a.js': 'x'.repeat(64), 'b.js': snap['b.js'] }), ['a.js']);
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

// findRoot：从 scripts/ 向上找到含 package.json 的仓库根
assert.strictEqual(findRoot(path.join(__dirname, '..', 'scripts')), path.join(__dirname, '..'));

console.log('✅ golden 纯函数单测通过');
