# AGENTS.md

## 0) Mission

本仓库采用"三层 AI 协作"开发模式，目标是：低成本、可复现、可审计地推进 GTO-RTA 实验。

---

## 1) Mandatory Multi-Agent Topology (MUST)

**禁止单代理端到端直接开发**。必须按以下三层执行：

### Layer A — Orchestrator (OpenClaw)

**职责**：
- 任务拆解与分配
- 里程碑与风险管理
- 验收门禁与日报/周报汇总

**输出物**：
- `TASK_PLAN.md`（任务树、Owner、DoD、风险、时间盒）
- `RUN_REPORT.md`（结果、指标、问题、下一步）

**限制**：
- 不直接提交核心业务代码（仅可改计划/文档模板）

---

### Layer B — Core Executor (OpenCode / OpenCode)

**职责**：
- 核心主链路代码实现与本地验证（capture/api/cache/overlay）
- 修复阻断性 bug
- 生成可复现运行命令

**执行方式**：
- 优先使用非交互脚本模式（`opencode run`）执行可复现任务

**输出物**：
- 代码变更 + 本地运行结果 + 测试结果
- 提交信息遵循 Conventional Commits

---

### Layer C — Parallel Agent (GitHub Copilot Coding Agent)

**职责**：
- 并行处理非核心任务（测试补全、README、CI、小重构）
- 通过 Issue 指派产出 PR

**执行规则**：
- 仅接收已定义 DoD 的 Issue
- 不得改动未在 Issue 范围内的核心逻辑
- 必须经 CI 通过后再评审

---

## 2) Workflow (MUST FOLLOW)

1. **Orchestrator** 先产出 `TASK_PLAN.md`
2. **Core Executor** 先打通核心路径最小闭环
3. **Parallel Agent** 并行完成边角任务（Issue -> PR）
4. 所有变更必须走 **PR + CI**
5. **Orchestrator** 汇总 `RUN_REPORT.md` 并给出下一周期计划

---

## 3) Definition of Done (DoD) Template

每个任务必须包含：

| 字段 | 说明 |
|------|------|
| **Goal** | 一句话目标 |
| **Scope** | in / out（明确边界） |
| **OwnerAgent** | A / B / C |
| **Files touched** | 涉及的文件 |
| **Tests required** | 需要哪些测试 |
| **Metrics impacted** | 影响哪些指标 |
| **Risks** | 风险点 |
| **Acceptance Criteria** | 可执行、可验证的验收标准 |

---

## 4) Branch & PR Rules

- **分支命名**：`feat/*` `fix/*` `chore/*` `docs/*`
- **提交规范**：Conventional Commits
- **PR 必须包含**：
  - 变更摘要
  - 风险与回滚方案
  - 测试证据（截图/日志/报告路径）
- **禁止**直接 push 到 `main`

---

## 5) Quality Gates (Hard)

**CI 未过禁止合并**。最小门禁：

1. 单元测试通过（命中/未命中/非法请求）
2. 接口契约检查通过（字段与错误码不漂移）
3. lint/format 通过
4. 指标文档更新（若影响指标口径）

---

## 6) Reproducibility Rules

- 所有策略键必须包含版本：`strat:{solution_version}:{scene_fingerprint}`
- 响应体必须返回 `solution_version`
- 压测报告必须记录：
  - 场景数据版本
  - 代码 commit hash
  - 时间窗口与机器配置

---

## 7) Security & Scope Constraints

- 默认只做研究/实验功能
- 不实现真实客户端控制与自动操作链路
- 发现越权需求时，必须先升级为 RFC 再执行

---

## 8) Current Project Priorities (Rolling)

**P0**:
- Screen Capture MVP（Start/Stop + 3项指标）
- API 稳定性与缓存一致性

**P1**:
- 场景覆盖率统计链路
- 回退策略可观测化

**P2**:
- 文档自动化与论文图表素材沉淀

---

## 9) Issue Writing Standard (for Parallel Agent)

Issue 必须写清：

- 背景与目标
- 完成定义
- 涉及文件
- 不得修改范围
- 验收命令

（把 Issue 当成"给代理的 prompt"来写）

---

## 附录：任务协议模板

```markdown
## 任务协议: [TASK-ID] - [简短描述]

### 1. Goal (目标)
- **一句话描述**: [例如：实现WebRTC屏幕捕获原型]
- **业务价值**: [为什么做这个？]

### 2. Scope (范围)
- **In**: [包含什么]
- **Out**: [明确不包含什么]

### 3. Owner Agent (执行代理)
- **主负责**: `Layer A` | `Layer B` | `Layer C`
- **协作方**: [其他代理]

### 4. Files Touched (涉及文件)
- `apps/web-overlay/capture.js`
- `services/strategy-api/main.py`

### 5. Tests Required (测试要求)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 手动验证步骤

### 6. Metrics Impacted (影响指标)
- E2E Latency
- Redis Hit Rate

### 7. Risks (风险)
- **技术风险**: [例如：浏览器兼容性]
- **依赖项**: [依赖的模块/版本]
- **回滚方案**: [如何回滚]

### 8. Acceptance Criteria (验收标准)
- [ ] 代码通过 CI
- [ ] 本地测试通过
- [ ] 指标符合预期

### 9. Cost Cap (成本上限)
- **时间预算**: [例如：2小时]
- **Token预算**: [例如：100k tokens]
```

---

*文档版本: v1.0*  
*更新日期: 2026-02-06*  
*生效状态: IMMEDIATE*
