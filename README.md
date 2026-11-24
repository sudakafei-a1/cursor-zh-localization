# Cursor-zh

Cursor-zh 是一个 Cursor 编辑器的本地汉化工具：把界面上的英文文案替换成中文，并自动修复文件校验值，避免出现「安装已损坏」提示。支持一键汉化、随时还原。

> ⚠️ 本工具**不是 Cursor 官方项目**，也不修改你的账号、模型、插件、项目代码或云端配置，只处理本机 Cursor 的应用资源文件。不上传任何数据，汉化流程**不需要联网**。
>
> Tips：搭配使用：Chinese (Simplified) (简体中文) Language Pack for Visual

---

## 特性

- **一键汉化 / 一键还原**：三步引导界面，也可命令行静默执行
- **覆盖全**：主窗口、Agent 窗口、原生提示、托盘菜单、用户存储、远程扩展、语言包缓存均覆盖
- **自动修复校验值**：避免「安装已损坏」警告
- **自动备份**：汉化前备份原版（`.backup` + 版本元数据），Cursor 升级后自动更新备份
- **插件市场动态文案汉化**：插件名/描述是运行时远程数据，通过注入浏览器运行时 + 本地词典处理
- **黄金快照回归（开发者）**：重构/改词条后逐字节校验翻译产物不变

---

## 快速开始（用户）

需要 **Node.js 18 或更高版本**。

```bash
npm install
npm start
```

启动后是三步引导界面：

1. **检测 Cursor**——自动定位安装路径，展示版本号、写入权限、是否在运行、是否已汉化
2. **确认操作**——展示将处理哪些文件，选择「一键汉化」「恢复英文」「查看常见问题」或退出
3. **执行 + 完成引导**——需要管理员权限时会先说明再请求；完成后提示重启、验证与备份信息

路径会自动搜索（Windows 注册表 / macOS 应用目录 / Linux 常见路径），找不到会引导手动输入，任何安装位置都能用。定位结果保存在 `~/.cursor-zh/config.json`。

### 命令行静默执行（适合脚本）

```bash
node index.js --action=translate   # 汉化（自动用已保存路径）
node index.js --action=restore     # 恢复英文

# 显式指定安装路径
node index.js --action=translate --cursor-path="C:\Program Files\cursor\resources\app"
node index.js --action=restore   --cursor-path="C:\Program Files\cursor\resources\app"
```

> 注：`node index.js` 是兼容入口（shim），真实 CLI 在 `dist/cli.js`，由 `npm run build` 生成。若自行克隆源码，请先 `npm install && npm run build`。

---

## 它翻译什么

| 范围                     | 说明                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| 主窗口                   | 菜单、设置页、右键菜单、聊天界面等                                 |
| Agent 窗口（Glass）      | 新版 Cursor 的独立智能体窗口                                       |
| 原生提示                 | 系统菜单、加载提示（`nls.messages.json`）                          |
| 托盘菜单                 | Electron 主进程的系统托盘                                          |
| 用户存储                 | 模式描述、模型参数（如 Effort，旧版为 Thinking intensity）         |
| 远程扩展                 | remote-ssh / remote-wsl / remote-containers 命令面板               |
| 语言包缓存               | 官方中文语言包未覆盖的 Cursor 新词条                               |
| **插件市场（动态文案）** | 插件流派/通用名、市场空态提示、`Upgrade to …` 前缀等运行时远程文案 |

### 插件市场汉化说明

插件市场的插件名/描述是**运行时动态拉取**的数据，无法靠静态改 bundle 覆盖，因此 Cursor-zh 向 `workbench.html` 注入一段**浏览器运行时脚本**（离线词典 + 整句精确替换），配合本地词典实现。默认开启，可在 Cursor 开发者工具控制台关闭：

```js
// 关闭插件市场汉化（改后重启 Cursor）
localStorage.setItem('CSSZH_PluginMarket_Translate', '0')
// 重新开启：
localStorage.setItem('CSSZH_PluginMarket_Translate', '1')
```

词典内容在 `rules/plugin-market.json`（见下方「加词条」）。

---

## 支持平台

- **Windows**：用户目录安装、Program Files 安装均支持（自动读注册表）
- **macOS**：`/Applications/Cursor.app` 及用户目录安装（自动签名修复）
- **Linux**：常见安装路径（`/opt`、`/usr/share` 等）；AppImage 或非标准路径建议指定 `--cursor-path`

> Cursor 更新会覆盖修改过的文件，需重新运行汉化；大版本更新后如有新英文，工具会随版本更新词库。

---

## 使用注意

- **汉化前请完全退出 Cursor**（含托盘与后台进程），否则用户存储步骤会跳过
- 汉化后**重启 Cursor 才能生效**
- 恢复英文**不会丢失对话历史**（用户存储是字段级还原，只回退汉化字段）

---

## 配置与备份

- 路径配置保存于 `~/.cursor-zh/config.json`
- 汉化前自动备份原版文件（`.backup` + 版本元数据），Cursor 升级后自动更新备份
- 恢复英文时优先用备份还原，还原后删除备份
- 恢复英文后，此期间的会话数据仍存在，仅回退翻译内容

## 权限说明

- 安装目录可写则直接执行
- 无权限时（如 Program Files）会请求管理员权限，Windows/macOS 走系统提权；Linux 可用 `sudo`
- 工具不上传任何文件或数据，汉化流程不需要联网

---

## 常见问题

**汉化后界面没变化？**
完全退出并重启 Cursor；确认定位的是正在使用的安装目录；Cursor 更新后需重新运行汉化。

**提示「安装已损坏」？**
工具已自动修复校验值。若仍出现，先恢复英文再重新汉化，或检查是否被安全软件阻止写入。

**macOS 提示无法打开或已损坏？**
工具会自动清理隔离属性并重新签名。若仍失败：

```bash
xattr -cr /Applications/Cursor.app
codesign --force --deep --sign - /Applications/Cursor.app
```

**插件市场里某些描述还是英文？**
插件市场文案是动态远程数据，只有收录进 `rules/plugin-market.json` 的整句/片段会被翻译；未收录的具体插件动态描述不在离线词典范围内（这是离线机制的边界）。

---

## 安全边界

- 使用前先退出 Cursor
- 保留 `.backup` 文件以便恢复
- 从可信来源获取工具或自行构建，不要运行来历不明的二进制

---

# 开发者指南

本工具已重构为「**规则单一权威 + TS 逻辑模块 + 黄金快照护闸**」的架构，目标之一是让**加词条 / 新增规则非常方便**。

## 技术栈与运行要求

- Node.js 18+，`npm`
- TypeScript（逻辑层）、CommonJS 输出、`@yao-pkg/pkg` 打包
- 无额外运行时依赖；浏览器运行时为内向 JS 模板

## 目录结构

```
index.js                 兼容入口（shim → dist/cli.js）
src/
  cli.ts                 CLI 入口（交互菜单 / 静默模式、参数解析）
  i18n-core.ts           翻译引擎编排：translate() / restore()
  core/
    progress.ts          进度/变更追踪、文本工具（ICON、createProgress…）
    substitution.ts      预编译大正则、短词保护、restoreComposerModeNames
    backup.ts            backupFile / restoreFromBackup / writeFileSafe
    hash.ts              校验值检测与修复（fixProductHash）
    gatekeeper.ts        macOS Gatekeeper 签名修复
  translate/
    auxiliary.ts         附加窗口 bundle（glass / automations）整段替换
    main-process.ts      主进程托盘菜单（main.js）
    nls.ts               原生提示 nls.messages.json
    clp.ts               语言包缓存补译
    extensions.ts        内置扩展中文语言包、远程扩展命令面板
    user-storage.ts      用户存储（state.vscdb）
    storage.js           ⚠️ 保持 JS，由 Cursor 内置 node 进程运行（不可 TS）
  market/
    inject.ts            插件市场注入：模板 + rules → 内联 <script>
    runtime-template.js  ⚠️ 浏览器运行时模板（数据，保持 JS）
  dict.js / platform.js / ui.js / rules-loader.js / tricky-fn.js
                         保持 JS 的门面 / 装载 / 平台层（被 scripts 直接 require）
  markdown-language-features.zh-cn.json
                         内置扩展(md 预览)中文语言包资产源，build 时拷入 dist
rules/
  safe-sentences.json       安全整句（en → zh）
  scoped-fragments.json     作用域片段对（[en, zh]）
  tricky-regex.json         正则规则（pattern/flags/zh，kind: str|fn）
  plugin-market.json        插件市场词典 + 片段前缀规则
scripts/
  golden.js                黄金快照 capture / check
  copy-dist-assets.js       build 后复制非 JS 资产到 dist/
  verify-ui.js / verify-plugin-market.js   纯脚本门禁
  (audit-* / gen-* / verify-* 系列为历史开发脚本，见「已知限制」)
test/
  golden.test.js            golden 纯函数单测
  golden/golden.json        黄金快照基线
```

**为何 TS / JS 混合？** 三处刻意保持 JS：

- `storage.js`：被 Cursor 内置 node `spawn` 执行，保持 JS 避免编译产物路径耦合
- `runtime-template.js`：浏览器注入的脚本模板（本质是数据）
- `dict.js / platform.js / ui.js / rules-loader.js`：被 `scripts/` 下工具直接 `require` 的门面/装载层

## 构建与门禁

```bash
npm install
npm run build        # tsc 编译 + 复制非 JS 资产到 dist/
npm run verify       # build + verify-ui + verify-plugin-market（提交门禁）
npm test             # golden 纯函数单测
npm run build:pkg    # pkg 打包单文件可执行（win/mac/linux）
```

> 行为保真的最终闸门是 **golden check**（需管理员权限 + Cursor 已退出，因此不在 `npm run verify` 内，见下）。

## 词库系统（规则单一权威）

所有翻译词条都集中在 `rules/*.json`，**四处互不重复**，加词条只改一个文件：

| 文件                    | 存什么                                                  | 怎么加                                                    |
| ----------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `safe-sentences.json`   | 安全整句（完整短语 en→zh）                              | 加一行 `"English sentence": "中文句子",`                  |
| `scoped-fragments.json` | 作用域片段（`["raw", "中文"]`，程序内出现的确切字面量） | 加一对 `["...", "..."]`                                   |
| `tricky-regex.json`     | 正则规则（`{pattern, flags, zh}`），用于动态/带变量文案 | 加一个 `{"pattern":"\\b...\\b","flags":"g","zh":"..."}`   |
| `plugin-market.json`    | 插件市场词典 + `fragmentRules` 片段前缀                 | 加整句到 `pluginNameDict`/`descriptionDict`，或加前缀规则 |

加载由 `src/rules-loader.js` 负责，失败即抛错（不静默降级成空词库）。

> 编辑纪律：**只补完整原文 / 精确片段，不臆造原文；不收录品牌名**。改完跑 `npm run build && npm run verify`。

## 加词条后的验证工作流（推荐）

```
1. 编辑 rules/*.json
2. npm run build && npm run verify        # 结构/一致性门禁
3. cursor 退出后，管理员终端：
   node scripts/golden.js capture          # 先定格当前安装行为（首次）
   node scripts/golden.js check            # 或核对未改坏其它产物
4. node index.js --action=translate → 重启 Cursor 实测
```

## 黄金快照回归（golden）

作用：**确保任何重构或改词条都不改变翻译产物的既有字节行为**。

```bash
node scripts/golden.js capture   # restore → 记输入哈希 → translate → 记输出哈希 → 写 test/golden/golden.json
node scripts/golden.js check     # restore → 比输入 → translate → 比输出（必须逐字节一致）
```

- 前置：Cursor 完全退出（含托盘）、终端对安装目录有写权限
- 4 个关键产物：`workbench.desktop.main.js`、`workbench.glass.main.js`、`workbench.anysphere-ui-automations.js`、`workbench.html`
- `check` 若报「输入漂移」说明 Cursor 已升级，需重新 `capture`
- 基线 `test/golden/golden.json` 已入库；改动了产物格式（如注入了新的浏览器运行时）需重新 capture 刷新基线

## 插件市场汉化机制（开发者）

浏览器端运行时在 `src/market/runtime-template.js`，含占位符 `__CSSZH_*_JSON__`；`src/market/inject.js` 在汉化时把 `rules/plugin-market.json` 的词典注入占位符生成内联 `<script>`，写入 `workbench.html` 并在其后修复 `product.json` 校验值。已注入过则原位替换旧脚本（幂等、可升级）。

- 词典权威：`rules/plugin-market.json`
- 关闭开关：控制台 `localStorage.setItem('CSSZH_PluginMarket_Translate','0')`
- 逻辑：MutationObserver 监听文本节点 → 整句精确替换；已含中文的节点跳过（防误翻/防叠加）

## 发布（打包）

`pkg` 入口指向 `dist/cli.js`；`pkg.assets` 显式包含 `rules/**/*.json`、`market/runtime-template.js`、`translate/storage.js`，保证打包后 JSON 词库与运行时模板随单文件分发。

## 已知限制 / 遗留

- **开发脚本已适配**：`scripts/audit-*`、`scripts/gen-*`、`scripts/verify-*` 已从旧的"解析 `src/i18n-core.js` 源码内嵌数组"改为读取统一数据源（`src/rules-loader` 词库 + `dist/translate/auxiliary.js` 附加片段 + `dist/i18n-core.js` 导出）。**运行前需先 `npm run build`**。
- `verify-effort.js` 需在**英文全新 bundle** 下才有有效命中断言（是对 3.17.8 特定规则落位的验证）。
- `npm run verify`（提交门禁）**不含** golden check（golden 需管理员权限 + Cursor 已退出），行为保真闸门是手动的。
- 插件市场仅做离线词典覆盖；未收录的动态描述不强翻。

---

## 致谢

基于 [rongwei-lab/cursor-chinese](https://github.com/rongwei-lab/cursor-chinese)（MIT License）改进；插件市场运行时汉化思路吸收自 `cursor-localization-zh` 项目（一个 Python 写就的 Cursor 汉化工具，其运行时注入与本工具设计互补）。

## 许可证

MIT License。