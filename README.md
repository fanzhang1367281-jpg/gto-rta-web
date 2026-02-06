# GTO Strategy Web

> 基于浏览器的实时扑克策略辅助系统
>
> **🏷️ 里程碑**: [v0.1-baseline](https://github.com/fanzhang1367281-jpg/gto-rta-web/releases/tag/v0.1-baseline)

---

## 🚀 一键复现指南

```bash
# 1. 克隆仓库
git clone https://github.com/fanzhang1367281-jpg/gto-rta-web.git
cd gto-rta-web

# 2. 一键启动（自动配置环境）
./start.sh

# 3. 访问服务
# API:  http://localhost:8000
# Web:  http://localhost:8080
```

## 🎥 WebRTC 屏幕捕获

### 快速开始（5分钟跑起来）

```bash
# 1. 确保使用 HTTPS 或 localhost
#    getDisplayMedia 要求安全上下文
#    本地开发: http://localhost:8080 ✅
#    生产环境: https://your-domain.com ✅
#    普通 HTTP: http://192.168.x.x ❌ (会被浏览器阻止)

# 2. 启动服务后访问前端
./start.sh
open http://localhost:8080
```

### 使用步骤

1. **点击"开始捕获"按钮**（页面中央红色按钮）
2. **选择要捕获的窗口/屏幕**（浏览器弹窗选择）
3. **授权权限**（允许浏览器录制屏幕）
4. **查看策略建议**（右侧显示实时策略）
5. **点击"停止捕获"结束**

### 环境要求

| 环境               | 状态      | 说明                 |
| ------------------ | --------- | -------------------- |
| **localhost**      | ✅ 支持   | 开发环境无需 HTTPS   |
| **HTTPS**          | ✅ 支持   | 生产环境必须使用 SSL |
| **普通 HTTP (IP)** | ❌ 不支持 | 浏览器安全策略阻止   |

### 浏览器兼容性

| 浏览器          | 支持状态      | 已知限制                   |
| --------------- | ------------- | -------------------------- |
| **Chrome 120+** | ✅ 完整支持   | 推荐，功能最全             |
| **Edge 120+**   | ✅ 完整支持   | Chromium 内核              |
| **Safari 17+**  | ⚠️ 部分支持   | 需用户手动启用屏幕录制权限 |
| **Firefox**     | ⚠️ 实验性支持 | 策略API响应可能延迟        |

**Safari 特别提示**：

- 需在 系统设置 → 隐私与安全 → 屏幕录制 中授权浏览器
- 首次使用必须重启浏览器才能生效

### 常见问题

#### ❌ 黑屏（捕获成功但画面全黑）

**原因**: 某些应用（如 Netflix、Zoom）阻止屏幕录制
**解决**: 捕获浏览器标签页而非整个屏幕

#### ❌ 权限被拒绝

**原因**: 用户点击了"不允许"
**解决**:

1. 点击"停止捕获"重置状态
2. 重新点击"开始捕获"
3. 这次选择"允许"

#### ❌ "getDisplayMedia is not supported"

**原因**: 使用了 http://192.168.x.x 等非安全地址
**解决**: 改为 http://localhost:8080 或配置 HTTPS

### 技术细节

- **捕获频率**: 每 200ms 生成一帧 HandState
- **延迟**: P95 ~120ms (本地 Redis 命中)
- **策略来源**: 预加载的 200+ 条 preflop GTO 策略

---

### 压测验证

```bash
cd services/strategy-api
python benchmark.py  # 100/300/500 RPS 三档压测
```

### 运行测试

```bash
cd services/strategy-api
pytest  # 自动化测试 (hit/miss/bad_request)
```

---

## 📊 指标截图与报告

| 指标类型       | 文件路径                                                           | 说明                              |
| -------------- | ------------------------------------------------------------------ | --------------------------------- |
| **压测报告**   | [`docs/latency_report.md`](docs/latency_report.md)                 | 100/300/500 RPS 压测结果          |
| **指标定义**   | [`docs/metrics.md`](docs/metrics.md)                               | E2E/Hit Rate/Unsupported 定义公式 |
| **版本策略**   | [`docs/version_strategy.md`](docs/version_strategy.md)             | 版本绑定与升级策略                |
| **Docker排障** | [`docs/docker_troubleshooting.md`](docs/docker_troubleshooting.md) | 常见问题与修复                    |

### 当前性能指标

| 指标             | P50   | P95    | P99    | 目标           |
| ---------------- | ----- | ------ | ------ | -------------- |
| E2E Latency      | ~45ms | ~120ms | ~250ms | P95 < 250ms ✅ |
| Redis Hit Rate   | -     | ~85%   | -      | > 80% ✅       |
| Unsupported Rate | -     | < 5%   | -      | < 10% ✅       |

---

## 🛠️ 详细启动指南

### 环境要求

- Python 3.11+
- Docker Desktop（可选，用于Redis持久化）

### 方式1: 一键启动（推荐）

```bash
./start.sh
```

### 方式2: 分步启动

```bash
# 初始化环境
cd services/strategy-api
./setup.sh

# 启动API
source .venv/bin/activate
python main.py

# 启动前端（新终端）
cd apps/web-overlay
python3 -m http.server 8080
```

访问:

- **API**: http://localhost:8000
- **Web**: http://localhost:8080

---

## 🔧 开发规范

### Python 环境

- **必须使用 venv** - 环境隔离
- **锁版本** - requirements.txt 固定版本号
- **镜像加速** - 清华/阿里镜像 + wheel优先
- **缓存复用** - pip缓存目录持久化

### 三层AI协作架构

```
OpenClaw(协调) → OpenCode(执行) → CI/CD(门禁)
```

---

## 📊 Metrics Export (论文引用)

运行时指标导出，支持论文复现实验：

```bash
# 导出方法
Ctrl+E          → 下载 metrics_<TIMESTAMP>.json
Ctrl+Shift+E    → 打印到 DevTools Console
```

**关键字段** (详见 [docs/metrics.md](docs/metrics.md)):

- `rates.qps` — 1分钟滑窗 QPS
- `latency_ms.p50/p95/p99` — 100样本滑窗延迟分位数
- `rates.hit_rate_percent` — 缓存命中率
- `rates.stale_rate_percent` — 降级策略使用率

**论文引用建议**:

> "We measured API performance using GTO-RTA's runtime metrics export (v0.3.0, metrics v1.0.0), capturing p95 latency over a 100-sample sliding window..."

---

## 📁 项目结构

```
gto-rta-web/
├── apps/
│   └── web-overlay/          # 前端覆盖层 (Vanilla JS)
├── services/
│   └── strategy-api/         # FastAPI 策略服务
│       ├── main.py            # API入口
│       ├── tests/             # 自动化测试
│       ├── benchmark.py       # 压测脚本
│       └── setup.sh           # 环境初始化
├── infra/
│   ├── docker-compose.yml     # Docker编排
│   └── redis.conf             # Redis持久化配置
├── docs/
│   ├── metrics.md             # 指标定义
│   ├── latency_report.md      # 压测报告
│   ├── version_strategy.md    # 版本策略
│   └── docker_troubleshooting.md  # Docker排障
├── start.sh                   # 一键启动
└── README.md                  # 本文件
```

---

## ✅ MVP Phase 0 完成清单

| 任务         | 状态 | 输出                            |
| ------------ | ---- | ------------------------------- |
| 仓库目录     | ✅   | 标准结构                        |
| Redis持久化  | ✅   | RDB+AOF, 验证步骤               |
| Docker排障   | ✅   | 常见问题+修复指南               |
| 自动化测试   | ✅   | 3个测试+CI workflow             |
| 版本强绑定   | ✅   | `strat:{version}:{fingerprint}` |
| 压测报告     | ✅   | 100/300/500 RPS                 |
| 指标文档     | ✅   | 定义公式+采样窗口               |
| 前端可见结果 | ✅   | 单页面应用                      |
| 环境优化     | ✅   | venv+镜像加速                   |

---

## 🔴 Redis 持久化验证

### 启动服务

```bash
cd infra
docker-compose up -d
```

### 验证步骤

**1. 检查 Redis 持久化配置**

```bash
docker exec gto-redis redis-cli CONFIG GET appendonly
docker exec gto-redis redis-cli CONFIG GET save
```

预期输出：

```
1) "appendonly"
2) "yes"
1) "save"
2) "900 1 300 10 60 10000"
```

**2. 写入测试数据**

```bash
docker exec gto-redis redis-cli SET test_key "persistent_data"
docker exec gto-redis redis-cli BGSAVE
```

**3. 重启容器验证数据持久化**

```bash
docker-compose restart redis
sleep 3
docker exec gto-redis redis-cli GET test_key
```

预期输出：

```
"persistent_data"
```

**4. 检查 AOF 文件生成**

```bash
docker exec gto-redis ls -lh /data/
```

应看到：`appendonly.aof` 和 `dump.rdb`

### 数据文件位置

- **RDB**: `docker volume inspect infra_redis-data` → Mountpoint
- **AOF**: 同上目录下的 `appendonly.aof`

---

## 📅 明日计划

1. WebRTC 屏幕捕获原型
2. 补充 flop/turn/river 策略数据
3. 录制 30 秒演示视频
4. 压测并填写 latency_report.md

---

## 🎬 演示

- 视频: (待录制)
- 截图: 见 `docs/` 目录各报告文件

---

_最后更新: 2026-02-06_
