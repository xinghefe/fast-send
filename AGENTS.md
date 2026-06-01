# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览
FastSend 是一个基于局域网的多端同步工具（PC, Browser），支持文本、文件、剪贴板的实时同步。采用 Monorepo 架构。

## 核心架构
- **Monorepo**: 使用 NPM Workspaces 管理。
  - `packages/server-go`: Go (Gin + Gorilla WebSocket) 后端，负责数据持久化 (SQLite) 和实时通信。
  - `packages/client`: React + Vite 前端，适配桌面端和 Web 端。
- **通信逻辑**: 
  - 自动发现: 局域网扫描。
  - 数据传输: WebSocket (文本/状态) + HTTP Chunked Upload (大文件)。
- **持久化**: SQLite 存储消息历史和应用设置，数据存储在用户目录 `~/.fastsend/fast-send.db`。

## 常用命令

### 开发命令
- `npm run dev`: 启动开发模式（同时启动 Client 和 Go Server）。
- `npm run client`: 仅启动前端开发服务器（`localhost:5574`）。
- `npm run server`: 仅运行 Go 后端服务。

### 构建与打包
- `npm run build`: 构建前端静态资源。
- `npm run build:go`: 打包生成 Go 后端可执行程序（输出至 `out/FastSend.exe`）。

### 检测与维护
- `npm run check`: TypeScript 类型检查。

## 关键技术规范
- **语言**: 沟通与代码注释必须使用 **简体中文**。
- **后端**: 使用 Go 语言开发，Gin 框架处理 HTTP，Gorilla 处理 WebSocket。
- **前端**: 
  - 模块化: 所有独立的功能模块（如弹窗、侧边栏、复杂列表项）必须封装为独立的 React 组件，禁止在 `App.tsx` 中编写长段的内联 UI 逻辑。
  - 组件存放: 统一存放在 `packages/client/src/components` 目录下。
