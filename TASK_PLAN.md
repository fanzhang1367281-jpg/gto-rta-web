# TASK_PLAN.md

## Sprint

- **Name**: WebRTC Screen Capture MVP
- **Date Range**: 2026-02-06
- **Owner (Orchestrator)**: OpenClaw

---

## Goals

1. 实现 WebRTC `getDisplayMedia()` 屏幕捕获原型
2. 每 200ms 捕获帧并提取简化 HandState
3. 实时显示策略建议到覆盖层
4. 收集 E2E Latency / Redis Hit Rate / Unsupported Rate 三项指标

---

## Task Breakdown

| ID | Task | OwnerAgent (A/B/C) | Scope(In) | Scope(Out) | DoD | Risk | ETA |
|---|---|---|---|---|---|---|---|
| T1 | WebRTC 屏幕捕获实现 | B(OpenCode) | getDisplayMedia, 权限处理, 帧捕获 | 视频编码, 多屏幕选择 | 成功捕获屏幕, 控制台输出帧率 | 浏览器兼容性 | 2h |
| T2 | HandState 简化提取 | B(OpenCode) | 固定 hero_pos/stack, 模拟识别 | 真实OCR, 牌面识别 | 每200ms生成有效HandState JSON | 数据结构变更 | 1h |
| T3 | 实时策略查询集成 | B(OpenCode) | 前端调用API, 显示结果 | 缓存优化, 批量查询 | 成功获取并显示策略建议 | API延迟 | 1h |
| T4 | 覆盖层渲染 | B(OpenCode) | 显示一行建议文字 | 169格矩阵, 动画 | 文字正确显示在屏幕指定位置 | 定位准确性 | 1h |
| T5 | 指标收集与上报 | B(OpenCode) | e2e_latency_ms, hit_rate, unsupported_rate | 持久化存储, 可视化 | 控制台输出3项指标 | 精度问题 | 1h |
| T6 | README 更新 | C(Copilot Agent) | 捕获功能说明, 启动步骤 | 架构文档修改 | PR合并 | - | 并行 |
| T7 | 测试补全 | C(Copilot Agent) | 捕获单元测试 | 集成测试 | PR合并 | - | 并行 |

---

## Dependencies

- T2 depends on: T1 (屏幕捕获)
- T3 depends on: T2 (HandState生成)
- T4 depends on: T3 (策略查询)
- T5 depends on: T4 (完整链路)

---

## Hard Gates (must pass)

- [ ] PR only (no direct push main)
- [ ] CI green
- [ ] Tests for changed scope
- [ ] Metrics/docs updated if KPI impacted

---

## Commands (reproducible)

```bash
# 启动服务
cd /Users/fanzhang/gto-rta-web
./start.sh

# 验证API健康
curl http://localhost:8000/health

# 运行测试
cd services/strategy-api
pytest tests/ -v

# 压测验证
python benchmark.py
```

---

## Acceptance Criteria (验收标准)

### 功能验收
- [ ] 点击"开始捕获"按钮，浏览器请求屏幕共享权限
- [ ] 授权后，控制台每 200ms 输出 "Frame captured"
- [ ] HandState JSON 包含: hero_pos, effective_stack_bb, pot_bb
- [ ] API 返回策略建议，前端显示 "BTN: Raise 2.5x"
- [ ] 控制台输出3项指标: e2e_latency_ms, hit_rate, unsupported_rate

### 性能验收
- [ ] E2E Latency P95 < 500ms (原型阶段宽松)
- [ ] 帧率稳定 5 FPS (200ms间隔)
- [ ] 无内存泄漏 (5分钟持续运行)

### 质量验收
- [ ] 代码通过 CI
- [ ] ESLint / Prettier 无错误
- [ ] 测试覆盖率 > 60%

---

## Risk & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 浏览器不支持 getDisplayMedia | Low | High | 降级方案: 文件上传模拟 |
| 跨域问题 (CORS) | Medium | Medium | 配置代理或同源部署 |
| API 延迟过高 | Medium | High | 本地缓存, 降级显示 |
| 屏幕定位偏移 | Medium | Medium | 可配置偏移量 |

---

## Output Artifacts

| Artifact | Path | Owner |
|---|---|---|
| TASK_PLAN.md | `/TASK_PLAN.md` | A(OpenClaw) |
| Capture Module | `apps/web-overlay/capture.js` | B(OpenCode) |
| Integration Code | `apps/web-overlay/app.js` | B(OpenCode) |
| Tests | `apps/web-overlay/tests/` | C(Copilot) |
| RUN_REPORT.md | `/RUN_REPORT.md` | A(OpenClaw) |

---

## Status

| ID | Status | Notes |
|---|---|---|
| T1 | ⏳ Pending | 等待执行 |
| T2 | ⏳ Pending | 等待执行 |
| T3 | ⏳ Pending | 等待执行 |
| T4 | ⏳ Pending | 等待执行 |
| T5 | ⏳ Pending | 等待执行 |
| T6 | ⏳ Pending | 等待 Issue 指派 |
| T7 | ⏳ Pending | 等待 Issue 指派 |

---

*Created: 2026-02-06*  
*Status: WAITING_FOR_APPROVAL*
