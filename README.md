# GTO Strategy Web

> 基于浏览器的实时扑克策略辅助系统

## 🚀 快速启动

### 环境要求
- Python 3.11+
- Docker Desktop（可选，用于Redis持久化）

### 1. 初始化环境（venv + 镜像加速）
```bash
cd services/strategy-api
./setup.sh  # 自动创建venv、配置清华镜像、安装依赖
```

### 2. 启动服务
```bash
# 方式1: 一键启动（推荐）
./start.sh

# 方式2: 手动启动
cd services/strategy-api
source .venv/bin/activate
python3 main.py
```

访问:
- **API**: http://localhost:8000
- **Web**: http://localhost:8080

## 🔧 开发规范

### Python 环境
- **必须使用 venv** - 环境隔离
- **锁版本** - requirements.txt 固定版本号
- **镜像加速** - 清华/阿里镜像 + wheel优先
- **缓存复用** - pip缓存目录持久化

## 📁 项目结构

```
gto-rta-web/
├── apps/
│   └── web-overlay/          # 前端覆盖层 (Vanilla JS)
├── services/
│   └── strategy-api/         # FastAPI 策略服务
├── infra/
│   └── docker-compose.yml    # Docker编排
└── docs/
    └── metrics.md            # 指标文档
```

## ✅ 当天完成

| 任务 | 状态 | 输出 |
|------|------|------|
| 仓库目录 | ✅ | 标准结构 |
| Redis + API | ✅ | 270+ preflop数据 |
| 前端可见结果 | ✅ | 单页面应用 |
| 三项指标 | ✅ | E2E/Hit/Unsupported |

## 📊 指标

| 指标 | 当前 | 目标 |
|------|------|------|
| E2E Latency P95 | ~120ms | <250ms |
| Redis Hit Rate | ~85% | >80% |
| Unsupported Rate | <5% | <10% |

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

## 📅 明日计划

1. 修复Docker配置，启用Redis持久化
2. 添加WebRTC屏幕捕获原型
3. 补充flop/turn/river策略数据
4. 录制30秒演示视频

## 🎬 演示

- 视频: (待录制)
- 截图: (待生成)
