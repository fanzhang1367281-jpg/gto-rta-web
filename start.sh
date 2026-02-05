#!/bin/bash
# GTO Strategy Web 启动脚本（venv优化版）

set -e

echo "🚀 Starting GTO Strategy Web..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")"

# 检查venv是否存在
if [ ! -d "services/strategy-api/.venv" ]; then
    echo -e "${YELLOW}⚠️ Virtual environment not found. Running setup first...${NC}"
    cd services/strategy-api
    ./setup.sh
    cd ../..
fi

# 1. 启动后端API
echo -e "${YELLOW}Starting Strategy API on port 8000...${NC}"
cd services/strategy-api

# 激活venv并启动
source .venv/bin/activate
python main.py &
API_PID=$!
cd ../..

echo -e "${GREEN}✅ API started (PID: $API_PID)${NC}"

# 等待API启动
sleep 2

# 2. 启动前端
echo -e "${YELLOW}Starting Web UI on port 8080...${NC}"
cd apps/web-overlay

# 使用Python HTTP服务器
python3 -m http.server 8080 &
WEB_PID=$!
cd ../..

echo -e "${GREEN}✅ Web UI started (PID: $WEB_PID)${NC}"

# 3. 健康检查
echo ""
echo "🔍 Health Check:"
sleep 1

if curl -s http://localhost:8000/health | grep -q "ok"; then
    echo -e "${GREEN}✅ API Health: OK${NC}"
else
    echo -e "${RED}❌ API Health: Failed${NC}"
    kill $API_PID $WEB_PID 2>/dev/null
    exit 1
fi

echo ""
echo "🌐 Access URLs:"
echo -e "${GREEN}  API:  http://localhost:8000${NC}"
echo -e "${GREEN}  Web:  http://localhost:8080${NC}"
echo ""
echo "📊 Test API:"
echo "  curl -X POST http://localhost:8000/v1/strategy/query \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"hand_id\":\"test\",\"table_id\":\"t1\",\"street\":\"preflop\",\"hero_pos\":\"BTN\",\"effective_stack_bb\":100,\"pot_bb\":1.5,\"action_line\":\"FOLD_FOLD_FOLD_FOLD\"}'"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# 等待用户中断
trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT
wait
