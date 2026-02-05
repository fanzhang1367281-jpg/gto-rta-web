# 📊 指标文档

## 核心指标定义

### 1. E2E Latency (端到端延迟)

**定义**: 从请求发出到收到完整响应的时间间隔

**计算公式**:
```
E2E Latency = T_response_received - T_request_sent
```

**测量点**: 客户端 (浏览器/测试脚本)

**目标**:
| 分位 | MVP目标 | V2目标 |
|------|---------|--------|
| P50 | < 120ms | < 100ms |
| P95 | < 250ms | < 200ms |
| P99 | < 350ms | < 300ms |

**采样窗口**: 1分钟滚动窗口

**聚合口径**:
- 按 `street` 分层 (preflop/flop/turn/river)
- 按 `hero_pos` 分层
- 全局汇总

**排除规则**:
- 排除超时请求 (> 5s)
- 排除网络错误
- 排除客户端取消

---

### 2. Redis Hit Rate (缓存命中率)

**定义**: 从Redis缓存成功获取策略的查询比例

**计算公式**:
```
Hit Rate = Cache Hits / (Cache Hits + Cache Misses)
```

**测量点**: API服务端

**目标**:
| 阶段 | 目标 |
|------|------|
| 冷启动期 | > 30% |
| 稳定期 | > 80% |
| 优化期 | > 90% |

**采样窗口**: 5分钟滚动窗口

**聚合口径**:
- 按 `solution_version` 分组
- 按 `street` 分层
- 全局汇总

**排除规则**:
- 排除fallback场景 (预期miss)
- 排除首次查询 (预热期)

---

### 3. Unsupported Rate (不支持场景率)

**定义**: 触发fallback策略的查询比例

**计算公式**:
```
Unsupported Rate = Fallback Queries / Total Queries
```

**测量点**: API服务端

**目标**:
| 阶段 | 目标 |
|------|------|
| MVP | < 30% |
| V2 | < 10% |

**采样窗口**: 1小时滚动窗口

**聚合口径**:
- 按 `street` 分层
- 按 `fallback_reason` 分类
- 全局汇总

**排除规则**:
- 排除明确的不支持域 (如multiway)
- 排除测试数据

---

## 补充指标

### 4. Server Latency (服务端延迟)

**定义**: API内部处理时间 (不含网络传输)

**计算公式**:
```
Server Latency = T_response_ready - T_request_received
```

**目标**: P95 < 50ms

### 5. Retrieval Latency (检索延迟)

**定义**: 策略数据检索时间

**测量点**:
```python
retrieval_start = time.time()
cached_data = redis_client.get(cache_key)
retrieval_latency = time.time() - retrieval_start
```

**目标**: 
- 热数据: < 10ms
- 冷数据: < 100ms

### 6. Error Rate (错误率)

**定义**: 返回非200状态码的请求比例

**计算公式**:
```
Error Rate = Error Responses / Total Responses
```

**目标**: < 1%

---

## 指标采集与上报

### 客户端上报
```javascript
// 前端自动上报
const metrics = {
    e2e_latency_ms: performance.now() - startTime,
    redis_hit_rate: response.cache_status === 'hit' ? 1 : 0,
    unsupported_rate: response.source === 'fallback' ? 1 : 0,
    timestamp: Date.now()
};
```

### 服务端采集
```python
# API响应中包含
{
    "server_latency_ms": 45,
    "retrieval_latency_ms": 12,
    "cache_status": "hit",
    "source": "redis_hit"
}
```

### 聚合查询
```bash
# 获取服务端指标
curl http://localhost:8000/metrics
```

---

## 监控告警

| 指标 | 告警阈值 | 级别 |
|------|----------|------|
| E2E P95 > 300ms | 持续5分钟 | 🔴 Critical |
| Error Rate > 5% | 持续2分钟 | 🔴 Critical |
| Hit Rate < 70% | 持续10分钟 | 🟡 Warning |
| Unsupported Rate > 40% | 持续1小时 | 🟡 Warning |

---

## 指标可视化

### 推荐工具
- **Prometheus**: 指标收集
- **Grafana**: 可视化面板
- **Loki**: 日志聚合

### 关键面板
1. Latency Overview (P50/P95/P99)
2. Cache Performance (Hit/Miss)
3. Error Tracking (Rate/Trend)
4. Throughput (RPS/QPS)
