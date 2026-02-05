#!/bin/bash
# GTO Strategy API - 环境初始化脚本（优化版）

set -e

echo "🔧 Initializing Python Environment (Optimized)..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")"

# 1. 创建venv（如果不存在）- 环境隔离
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Step 1/5: Creating virtual environment...${NC}"
    python3 -m venv .venv
    echo -e "${GREEN}✅ venv created${NC}"
else
    echo -e "${GREEN}✅ venv already exists${NC}"
fi

# 2. 激活venv
echo -e "${YELLOW}Step 2/5: Activating virtual environment...${NC}"
source .venv/bin/activate

# 3. 升级基础工具（减少 resolver 回溯）
echo -e "${YELLOW}Step 3/5: Upgrading pip/setuptools/wheel...${NC}"
python -m pip install -U pip setuptools wheel -i https://pypi.tuna.tsinghua.edu.cn/simple

# 4. 配置pip使用镜像（写入venv）
echo -e "${YELLOW}Step 4/5: Configuring pip mirror...${NC}"
mkdir -p .venv/pip
cat > .venv/pip/pip.conf << 'EOF'
[global]
index-url = https://pypi.tuna.tsinghua.edu.cn/simple
trusted-host = pypi.tuna.tsinghua.edu.cn
timeout = 120
retries = 5

[install]
prefer-binary = true
no-deps = false
EOF

# 5. 安装依赖（优先wheel + 镜像加速）
echo -e "${YELLOW}Step 5/5: Installing dependencies (prefer-binary)...${NC}"
pip install \
    --prefer-binary \
    -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

# 6. 验证安装
echo -e "${YELLOW}Verifying installation...${NC}"
python -c "import fastapi; print(f'✅ FastAPI {fastapi.__version__}')"
python -c "import redis; print(f'✅ Redis {redis.__version__}')"
python -c "import pydantic; print(f'✅ Pydantic {pydantic.__version__}')"

echo ""
echo -e "${GREEN}✅ Environment initialized successfully!${NC}"
echo ""
echo "📋 Environment Info:"
echo "  Python: $(python --version)"
echo "  Pip: $(pip --version | cut -d' ' -f1-2)"
echo "  Venv: $(which python)"
echo ""
echo "🚀 To start the API:"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo ""
