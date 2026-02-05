# 压测报告

## 测试环境
- API: http://localhost:8000
- 测试时间: 待运行
- 测试工具: Python requests + ThreadPoolExecutor

## 测试场景
POST /v1/strategy/query
- Payload: preflop BTN 100BB standard open
- 每项测试持续 30 秒

## 结果汇总

| RPS | 实际RPS | 成功率 | 错误率 | P50 (ms) | P95 (ms) | P99 (ms) | 吞吐 (req/s) |
|-----|---------|--------|--------|----------|----------|----------|--------------|
| 100 | - | - | - | - | - | - | - |
| 300 | - | - | - | - | - | - | - |
| 500 | - | - | - | - | - | - | - |

## 运行压测

```bash
cd services/strategy-api
python benchmark.py
```

## 预期结果

| 指标 | MVP目标 | 当前状态 |
|------|---------|----------|
| P95 Latency | < 250ms | 待测试 |
| Error Rate | < 1% | 待测试 |
| Success Rate | > 99% | 待测试 |

## 结论

待压测完成后更新...

## 建议

1. 若 P95 > 250ms，考虑：
   - 增加Redis连接池
   - 启用API缓存
   - 优化序列化逻辑

2. 若错误率 > 1%，检查：
   - 并发连接数限制
   - 超时配置
   - 资源使用（CPU/内存）
