# OC-Pad

OC-Pad 是一个基于 Tauri v2 的桌面配置管理工具，用于可视化维护 OpenCode / oh-my-opencode 配置方案（Profiles），支持激活、切换、预览与编辑配置，并将结果落盘到本地配置文件。

## 核心能力

- Profile 管理：创建、编辑、删除、激活配置方案
- 双配置联动：`opencode` 与 `oh-my-opencode` 关键字段联动
- 可视化配置：Provider、模型、核心模式参数集中编辑
- JSON 可编辑区：支持实时查看、手动编辑、格式化、应用
- 启动同步：从磁盘读取并同步全局/项目层配置
- 主题与语言：支持主题模式、强调色与多语言切换

## 技术栈

- 桌面框架：Tauri v2（Rust）
- 前端：React 19 + TypeScript + Vite
- 状态管理：Zustand
- UI：Tailwind CSS v4 + 组件封装
- i18n：i18next + react-i18next

## 环境要求

- Node.js 18+
- Rust stable（建议通过 `rustup` 安装）
- 平台构建依赖：
  - macOS：Xcode Command Line Tools

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动前端开发服务（仅前端）
pnpm dev
```

启动 Tauri 桌面开发模式：

```bash
pnpm tauri dev
```

如果本机没有全局 `pnpm`，可以用：

```bash
npx pnpm@latest install
npx pnpm@latest tauri dev
```

## 常用命令

```bash
# 类型检查 + 前端构建
pnpm build

# 本地预览前端产物
pnpm preview

# Tauri 打包（默认目标）
pnpm tauri build
```

## 生成 DMG（macOS）

推荐命令：

```bash
CI=true pnpm tauri build --bundles dmg
```

若遇到 `target` 目录权限问题，可指定本地可写目录：

```bash
CI=true CARGO_TARGET_DIR=src-tauri/target-local pnpm tauri build --bundles dmg
```

DMG 常见输出路径：

```text
src-tauri/target/release/bundle/dmg/
src-tauri/target-local/release/bundle/dmg/
```

## 项目结构（关键目录）

```text
oc-pad/
├─ src/                 # React 前端
│  ├─ components/       # 页面与组件
│  ├─ pages/            # 页面级容器
│  ├─ stores/           # Zustand 状态管理
│  ├─ i18n/             # 多语言资源
│  └─ schemas/          # 本地 schema 兜底
├─ src-tauri/           # Tauri/Rust 后端
│  ├─ src/              # 命令与配置读写逻辑
│  └─ tauri.conf.json   # 打包与应用配置
└─ docs/                # PRD 与阶段文档
```

## 常见问题

### 1) `pnpm: command not found`

使用 `npx pnpm@latest ...` 代替全局 `pnpm`。

### 2) 构建时报目录权限错误（如 `dist` 或 `target`）

- 避免使用 `sudo` 运行前端/构建命令
- 使用用户可写目录（如 `CARGO_TARGET_DIR=src-tauri/target-local`）
- 必要时清理或迁移历史 root 权限产物

## License

当前仓库未单独声明许可证，默认保留所有权利。若需开源发布，请补充 `LICENSE` 文件。
