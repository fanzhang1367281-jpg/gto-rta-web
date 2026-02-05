# 版本策略与强绑定规范

## 版本格式

```
strat:{solution_version}:{scene_fingerprint}
```

示例：
```
strat:v0.1.0:a1b2c3d4e5f67890
```

## 版本升级策略

### 1. 向后兼容版本 (Patch)
- 版本号: `v0.1.0` → `v0.1.1`
- 变更: 修复bug，优化策略
- 行为: 新旧版本并存，渐进迁移

### 2. 功能版本 (Minor)
- 版本号: `v0.1.0` → `v0.2.0`
- 变更: 新增street支持，调整离散化
- 行为: 强制升级，旧版本标记为deprecated

### 3. 重大版本 (Major)
- 版本号: `v0.1.0` → `v1.0.0`
- 变更: 架构重构，API不兼容
- 行为: 完全隔离，独立部署

## API 版本协商

### 请求头支持
```http
POST /v1/strategy/query
X-Solution-Version: v0.1.0
```

### 响应格式
```json
{
  "solution_version": "v0.1.0",
  "actions": [...],
  "source": "redis_hit"
}
```

### 错误码

| 错误码 | 场景 | HTTP状态 |
|--------|------|----------|
| `VERSION_NOT_AVAILABLE` | 请求版本不存在 | 409 |
| `VERSION_DEPRECATED` | 版本已弃用 | 410 |
| `VERSION_MISMATCH` | 版本与指纹不匹配 | 422 |

## 版本冲突处理

### 场景1: 客户端请求旧版本
```json
{
  "success": false,
  "error": {
    "code": "VERSION_DEPRECATED",
    "message": "Version v0.1.0 is deprecated, please upgrade to v0.2.0",
    "details": {
      "requested_version": "v0.1.0",
      "latest_version": "v0.2.0",
      "sunset_date": "2026-03-01"
    }
  }
}
```

### 场景2: 版本与数据不匹配
```json
{
  "success": false,
  "error": {
    "code": "VERSION_MISMATCH",
    "message": "Strategy data version mismatch",
    "details": {
      "expected": "v0.2.0",
      "actual": "v0.1.0"
    }
  }
}
```

## 缺省版本策略

### 无版本请求
- 使用当前默认版本: `SOLUTION_VERSION`
- 响应中包含实际使用的版本号

### 版本查询端点
```http
GET /v1/version
```

响应：
```json
{
  "current_version": "v0.1.0",
  "supported_versions": ["v0.1.0"],
  "deprecated_versions": [],
  "latest_version": "v0.1.0"
}
```

## 实施检查清单

- [ ] Redis key 包含版本号
- [ ] API 响应强制返回 solution_version
- [ ] 版本升级时更新 SOLUTION_VERSION 常量
- [ ] 文档同步更新版本兼容性说明
- [ ] 监控版本分布和迁移进度
