# Python 环境初始化指南

## 快速开始

### 1. 初始化项目环境
```bash
cd services/strategy-api
./setup.sh
```

### 2. 启动服务
```bash
./start.sh
```

---

## 优化详解

### ✅ 1. venv 环境隔离
```bash
python3 -m venv .venv
source .venv/bin/activate
```
- 避免系统包污染
- 每个项目独立环境
- 便于版本管理

### ✅ 2. 升级基础工具
```bash
python -m pip install -U pip setuptools wheel
```
- 减少 resolver 回溯
- 提升安装速度
- 确保兼容性

### ✅ 3. 锁定依赖版本
```txt
# requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
redis==5.0.1
```
- 固定版本号
- 避免意外升级
- 保证可复现性

### ✅ 4. 优先使用 wheel
```bash
pip install --prefer-binary -r requirements.txt
```
- 避免源码编译（无 C 编译器依赖）
- 缓存可复用
- 安装速度提升 5-10 倍

### ✅ 5. 镜像加速
```bash
# 清华镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple

# 阿里镜像
pip install -i https://mirrors.aliyun.com/pypi/simple
```
- 国内访问加速
- 提升稳定性
- 减少超时

---

## 添加新依赖

### 开发环境安装
```bash
source .venv/bin/activate
pip install new-package
```

### 锁定版本
```bash
pip freeze | grep new-package >> requirements.txt
# 或手动编辑，固定版本号
```

### 重新安装（验证）
```bash
pip install -r requirements.txt
```

---

## 故障排查

### 安装缓慢
```bash
# 检查镜像配置
pip config get global.index-url

# 手动指定镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple package-name
```

### 编译失败（缺少wheel）
```bash
# 确保安装了wheel
pip install wheel

# 使用prefer-binary
pip install --prefer-binary package-name
```

### 依赖冲突
```bash
# 查看依赖树
pipdeptree

# 重新创建venv
rm -rf .venv
./setup.sh
```
