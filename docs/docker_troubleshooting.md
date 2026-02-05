# Docker 排障记录

## 环境信息

### Docker 版本
```bash
docker --version
docker-compose --version
```

示例输出：
```
Docker version 27.4.0, build bde2b89
Docker Compose version v2.31.0-desktop.2
```

### Docker 系统信息
```bash
docker info
```

关键检查项：
- Server Version: 27.4.0
- Storage Driver: overlay2
- Logging Driver: json-file
- Cgroup Driver: cgroupfs
- Swarm: inactive
- Runtimes: io.containerd.runc.v2, runc
- Default Runtime: runc

## 常见问题与修复

### 问题1: Docker 守护进程未运行

**症状**:
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock. 
Is the docker daemon running?
```

**诊断**:
```bash
docker info 2>&1 | head -5
```

**修复**:
1. 启动 Docker Desktop (macOS)
2. 或命令行启动:
```bash
open -a Docker
```

**验证**:
```bash
docker ps
# 应显示容器列表（无错误）
```

### 问题2: 端口冲突

**症状**:
```
Bind for 0.0.0.0:6379 failed: port is already allocated
```

**诊断**:
```bash
lsof -i :6379
# 或
docker ps | grep 6379
```

**修复**:
```bash
# 停止占用端口的容器
docker stop <container_id>
# 或修改 docker-compose.yml 端口映射
```

**验证**:
```bash
docker-compose up -d
```

### 问题3: 权限不足

**症状**:
```
permission denied while trying to connect to the Docker daemon socket
```

**诊断**:
```bash
ls -la /var/run/docker.sock
```

**修复**:
```bash
# macOS: 确保当前用户在 docker 组
# 或使用 Docker Desktop 自带环境
```

**验证**:
```bash
docker ps
```

### 问题4: 卷挂载失败

**症状**:
```
Mount denied: ...
```

**诊断**:
```bash
docker inspect <container_id> | grep -A 10 Mounts
```

**修复**:
检查 docker-compose.yml 中的 volumes 路径是否正确。

**验证**:
```bash
docker-compose down
docker-compose up -d
docker logs gto-redis
```

## 修复前后对比

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| 守护进程 | `docker ps` 报错 | 容器列表正常显示 |
| 端口冲突 | 启动失败 | 服务正常启动 |
| 权限问题 | 访问拒绝 | 命令正常执行 |
| 卷挂载 | 数据丢失 | 数据持久化 |

## Desktop Troubleshoot 截图说明

### macOS Docker Desktop

1. **打开 Dashboard**: 点击菜单栏 Docker 图标 → Dashboard
2. **查看容器**: Containers 标签页
3. **查看日志**: 点击容器 → Logs 标签
4. **资源监控**: Stats 标签页查看 CPU/内存
5. **设置**: ⚙️ 图标 → Resources → File sharing

### 常用命令速查

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs redis
docker-compose logs -f redis  # 实时跟踪

# 进入容器
docker exec -it gto-redis sh

# 重启服务
docker-compose restart

# 完全重置
docker-compose down -v  # 删除卷
docker-compose up -d     # 重新创建
```

## 健康检查

```bash
# Redis 健康检查
docker exec gto-redis redis-cli ping
# 应返回: PONG

# API 健康检查
curl http://localhost:8000/health
# 应返回: {"status": "ok"}
```
