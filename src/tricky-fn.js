/**
 * 函数式替换映射（zh 为函数）——由 trickyReplacements 中函数式条目迁移而来。
 * 下标顺序与 rules/tricky-regex.json 中 kind:"fn" 条目的 fnIndex 一一对应。
 * ⚠️ 此处只存 zh 函数：正则的权威来源是 rules/tricky-regex.json 的 pattern/flags
 * （rules-loader 以 fnIndex 取本文件的 zh），不要在两侧重复维护正则以免漂移。
 * 此文件为纯逻辑（函数无法序列化进 JSON），不可被迁移脚本修改。
 */
const fnReplacements = [
  { // fnIndex 0：glass 编辑菜单（Undo/Redo/Cut/...）
    zh: (m, key) => {
        const zh = { Undo: '撤销', Redo: '重做', Cut: '剪切', Copy: '复制', Paste: '粘贴', SelectAll: '全选' }[key];
        return zh ? `title:"${zh}"` : m;
    } },
  { // fnIndex 1：Agents Window 窗口标题
    zh: (m, id) => `${id}="智能体窗口"` },
  { // fnIndex 2：Cancel 兜底（|| 与 ?? 两种形态）
    zh: (m) => m === '||"Cancel"' ? '||"取消"' : '??"取消"' },
  { // fnIndex 3：正在使用图片
    zh: () => '正在使用图片' },
  { // fnIndex 4：正在使用视频
    zh: () => '正在使用视频' }
];
module.exports = fnReplacements;