# HEMS Survivor / 电量守卫

一款以家庭能源管理为主题的轻量级 Roguelike 生存小游戏。

玩家需要在不断变化的太阳能、家庭负载、电池、车辆与电网之间做出决策，在有限资源和随机事件中尽可能维持系统稳定。

## 当前状态

MVP v0.1 游戏实现已在仓库并可本地运行，规则单元测试、React 集成测试、Playwright 双手机视口测试和 production build 已有自动化记录。真实物理手机试玩仍需在发布前确认，详见 [MVP v0.1 验收记录](docs/MVP_V0.1_ACCEPTANCE.md)。

## 目标体验

- 第一次玩 30 秒内理解基本操作。
- 一局目标时长约 5～8 分钟。
- 第三局开始理解不同升级路线和 Build 组合。
- 失败原因清晰，并自然产生“换一种策略再试一次”的冲动。

## 文档入口

- [开发路线图](docs/ROADMAP.md)
- [游戏设计](docs/GAME_DESIGN.md)
- [MVP v0.1 范围](docs/MVP_V0.1.md)
- [MVP v0.1 执行计划](docs/MVP_V0.1_PLAN.md)
- [MVP v0.1 完整设计规格](docs/superpowers/specs/2026-08-14-mvp-v0.1-design.md)
- [MVP v0.1 开发计划](docs/superpowers/plans/2026-08-14-mvp-v0.1.md)
- [Codex 实现说明](docs/CODEX_INSTRUCTIONS.md)

## 本地运行

需要 Node.js `20.19.0+` 或 `22.12.0+`。

```bash
npm install
npm run dev -- --host 0.0.0.0
```

电脑与手机连接同一网络后，在手机浏览器打开终端显示的 `Network` 地址。游戏没有后端服务；手机和电脑只需能访问同一台开发机。

## 验证

```bash
npm test
npm run build
npm run e2e
```

`npm run e2e` 会启动本地测试服务器，并覆盖 360×800 与 390×844 两种手机视口。

固定对局可使用 `?seed=12345`。`testMode=1` 及 `scenario=victory|family|outage` 只在开发环境生效，用于加速自动化胜利和失败场景；production build 始终使用标准规则并忽略这些测试参数。

MVP 不提供对局中途存档或云存档；刷新页面会创建新局，结局页的“重新开始”也会创建全新的种子、状态、事件队列和计时器。

## 后续原则

先验证核心循环，再扩充内容；先保证可玩，再打磨视觉；每次增加系统都必须服务于“能源调度决策—风险反馈—升级选择—再次挑战”的循环。
