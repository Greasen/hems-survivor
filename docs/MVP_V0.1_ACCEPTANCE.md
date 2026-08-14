# HEMS Survivor MVP v0.1 验收记录

> 记录日期：2026-08-14
>
> 结论范围：自动化验收已执行并通过；真实物理手机标准对局、真机连续三局和新玩家观察尚未执行，不能以自动化结果代替这些人工证据。

## 验收证据

| 要求 | 自动化证据 | 当前记录 |
|---|---|---|
| 开始、暂停、继续和重开 | `src/App.test.tsx`：ready → running、暂停/继续、Game Over 重开流程 | 自动化通过 |
| 每秒稳定 Tick，非运行状态不结算 | `src/game/engine.test.ts`、`src/hooks/useGameController.test.tsx`：单 Tick、暂停/升级时停止、Strict Mode 单计时器 | 自动化通过 |
| Solar、Home、Battery、EV、Grid 完整结算 | `src/game/energy.test.ts`：Home 优先、Battery/EV/Grid 流向、能量守恒 | 自动化通过 |
| Money、Family、Score 实时一致 | `src/game/scoring.test.ts`、`src/game/engine.test.ts`：资源变化、原因和边界 | 自动化通过 |
| Battery 三种模式 | `src/game/energy.test.ts`：充电、自动储备线、放电及功率限制 | 自动化通过 |
| EV 暂停与充电 | `src/game/energy.test.ts`：Solar → Battery → Grid 顺序、容量边界 | 自动化通过 |
| Grid 买卖价格、开关和互斥 | `src/game/energy.test.ts`：余额不足、价格、不可用和同 Tick 买卖互斥 | 自动化通过 |
| 阴天事件 | `src/game/events.test.ts`：warning/active、Solar 倍率及生命周期 | 自动化通过 |
| 高峰电价事件 | `src/game/events.test.ts`：买卖价格倍率和生命周期 | 自动化通过 |
| 家庭负载事件 | `src/game/events.test.ts`：成功奖励、短缺无奖励和事件结束 | 自动化通过 |
| EV 紧急出行事件 | `src/game/events.test.ts`、`src/game/engine.test.ts`：目标、epsilon 边界、成功/失败 | 自动化通过 |
| 三次三选一和六个升级 | `src/game/upgrades.test.ts`、`src/game/engine.test.ts`、`src/App.test.tsx`：三候选、单次应用、Tick 90 暂停 | 自动化通过 |
| 事件和升级可由固定种子复现 | `src/game/random.test.ts`、`src/game/engine.test.ts`：随机序列与完整局面 replay | 自动化通过 |
| 300～359 秒电网危机 | `src/game/events.test.ts`：Tick 300 清理普通事件及危机周期；`src/components/ControlPanel.test.tsx`、`src/components/RiskPanel.test.tsx`：关闭倒计时 | 自动化通过 |
| 360 秒胜利 | `src/game/scoring.test.ts`：Tick 360 胜利与奖励；E2E `scenario=victory` 加速覆盖结局 | 自动化通过（测试配置） |
| Family 归零失败 | `src/game/scoring.test.ts`；E2E `shows Family depletion as the primary failure`（`scenario=family`） | 自动化通过（测试配置） |
| 连续断电失败 | `src/game/engine.test.ts`、`src/game/scoring.test.ts`；E2E `shows sustained outage after ten shortage Ticks`（`scenario=outage`） | 自动化通过（测试配置） |
| Game Over 原因和摘要 | `src/components/Overlays.test.tsx`：原因、能源值、升级和重开摘要 | 自动化通过 |
| 连续三局无需刷新 | `src/App.test.tsx`、E2E `can restart three consecutive runs without a page refresh` | 自动化通过（双视口） |
| 360×800 和 390×844 无横向滚动 | E2E `plays, pauses, upgrades, and restarts without horizontal overflow` | 自动化通过（双视口） |
| 核心控件在手机视口内且可触控 | E2E `keeps mobile controls and dialogs usable at touch size`、布局几何断言 | 自动化通过（双视口） |
| 页面后台自动暂停且不补算 | `src/hooks/useGameController.test.tsx`：visibility change、卸载清理和不追赶时间 | 自动化通过 |
| 构建和全部测试通过 | `npm test`：15 个测试文件、147/147 tests passed；`npm run e2e`：10/10 tests passed（mobile-360、mobile-390）；`npm run build`：TypeScript/Vite production build 通过 | 自动化通过 |
| production build 使用标准规则 | `src/game/runtimeConfig.test.ts`：非 DEV 始终返回 `standardConfig`；`npm run build` | 自动化通过 |
| `testMode` 仅 DEV 生效 | `src/game/runtimeConfig.test.ts`：production 忽略 `testMode`，DEV 才选择加速配置 | 自动化通过 |
| 刷新无存档并开启新局 | `src/App.test.tsx`、`src/hooks/useGameController.test.tsx`：restart 清理状态并生成新 seed | 自动化通过；真机刷新未执行 |
| 新玩家 30 秒内理解目标 | 规格要求无法完全自动化 | 未执行，待用户/发布前确认 |
| 玩家操作至少挽回一次局面 | `src/game/energy.test.ts`、`src/game/engine.test.ts`：控制改变流向与结算结果 | 自动化有规则证据；真机观察未执行 |
| 至少两种升级路线有可描述差异 | `src/game/upgrades.test.ts`：容量/功率/太阳能/负载/EV/Grid 升级效果 | 自动化有规则证据；真机观察未执行 |
| 未引入明确排除的系统 | 依赖、文件结构和范围审计：无后端、账号、联网、存档、EV 放电/V2H、组件库 | 文档/代码审计通过 |

## 真机试玩记录

以下项目尚未在真实物理手机上执行，因此不填入设备、浏览器、种子或结果，避免把模拟视口测试误报为真机证据。

| 项目 | 记录 |
|---|---|
| 设备与浏览器 | 待用户/发布前确认 |
| 对局种子 | 待真机试玩 |
| 标准配置六分钟对局 | 待真机试玩 |
| 30 秒内识别的主要目标 | 待新玩家/用户试玩 |
| 改变局面的操作 | 待真机试玩 |
| 最终结果与原因 | 待真机试玩 |
| 连续三局无需刷新 | 待真机试玩；自动化双视口已通过 |
| 布局或点击问题 | 待真机试玩 |

## 最终命令记录

执行环境：Node `v24.8.0`，npm `11.6.0`，工作树分支 `feat/mvp-v0.1`，记录日期 2026-08-14。

| 命令 | 结果 | 证据摘要 |
|---|---|---|
| `npm test` | 通过 | 15 个测试文件通过，147/147 tests passed，退出码 0 |
| `npm run build` | 通过 | `tsc --noEmit && vite build` 完成，Vite 37 modules transformed，退出码 0 |
| `npm run e2e` | 通过（提升权限后） | 10 tests passed，覆盖 `mobile-360` 和 `mobile-390`，退出码 0 |
| `git diff --check` | 通过 | 退出码 0，无空白错误 |
| `git status --short` | 通过 | 仅有 `README.md` 与 `docs/MVP_V0.1_ACCEPTANCE.md` 两个预期文档变更 |

首次在受限沙箱执行 `npm run e2e` 时本地测试服务器监听被系统以 `EPERM` 拒绝；在获准启动本地服务器后重跑，10 项全部通过。该环境事实不影响测试结果，但保留在记录中以便复核。

## 结论

自动化双视口验收和规则/集成/build 审计已通过；根据设计规格的完成定义，MVP 仍不能宣称全部完成，原因是真实物理手机标准六分钟对局、真机连续三局和新玩家理解度尚无现场证据。发布前应使用 README 的同网访问方式完成上述人工项目，并补录设备、浏览器、种子、结果和问题。
