from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import time
import hashlib
from datetime import datetime

# 尝试连接Redis，否则使用内存存储
try:
    import redis
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    USE_REDIS = True
    print("✅ Connected to Redis")
except:
    USE_REDIS = False
    redis_client = {}
    print("⚠️ Using in-memory storage (Redis not available)")

app = FastAPI(title="GTO Strategy API", version="0.1.0")

# 全局版本配置
SOLUTION_VERSION = "v0.1.0"  # 策略版本，升级时更新

# 全局策略数据存储（内存模式）
strategy_db = {}

# 数据模型
class HandState(BaseModel):
    hand_id: str
    table_id: str
    street: str  # preflop, flop, turn, river
    hero_pos: str  # BTN, SB, BB, UTG, MP, CO
    effective_stack_bb: float
    pot_bb: float
    action_line: str
    hero_cards: Optional[List[str]] = None
    board: Optional[List[str]] = None

class StrategyAdvice(BaseModel):
    request_id: str
    scene_fingerprint: str
    solution_version: str  # 强制返回版本号
    actions: List[Dict]
    source: str  # redis_hit, fallback
    confidence: float
    retrieval_latency_ms: int
    cache_status: str

class QueryResponse(BaseModel):
    success: bool
    data: StrategyAdvice
    request_id: str
    server_latency_ms: int

# 生成场景指纹
def generate_fingerprint(hand_state: HandState) -> str:
    """基于手牌状态生成唯一指纹"""
    key_parts = [
        hand_state.street,
        hand_state.hero_pos,
        str(int(hand_state.effective_stack_bb / 10) * 10),  # 离散化
        hand_state.action_line
    ]
    key_string = "|".join(key_parts)
    return hashlib.sha256(key_string.encode()).hexdigest()[:16]

# 预加载示例数据
@app.on_event("startup")
async def load_sample_data():
    """加载200-500条preflop示例数据到Redis"""
    global strategy_db
    sample_data = [
        # BTN vs BB 场景
        {
            "fingerprint": "preflop|BTN|50|FOLD_FOLD_FOLD_FOLD_RAISE",
            "actions": [
                {"action": "raise_2.5x", "frequency": 0.45, "ev": 2.5},
                {"action": "fold", "frequency": 0.35, "ev": 0.0},
                {"action": "call", "frequency": 0.20, "ev": 1.8}
            ]
        },
        {
            "fingerprint": "preflop|BTN|100|FOLD_FOLD_FOLD_FOLD_RAISE",
            "actions": [
                {"action": "raise_2.5x", "frequency": 0.55, "ev": 3.2},
                {"action": "raise_3x", "frequency": 0.25, "ev": 3.0},
                {"action": "fold", "frequency": 0.20, "ev": 0.0}
            ]
        },
        # SB vs BTN 场景
        {
            "fingerprint": "preflop|SB|30|RAISE_CALL",
            "actions": [
                {"action": "3bet_9x", "frequency": 0.40, "ev": 4.5},
                {"action": "call", "frequency": 0.35, "ev": 2.1},
                {"action": "fold", "frequency": 0.25, "ev": 0.0}
            ]
        },
        # BB 防守场景
        {
            "fingerprint": "preflop|BB|40|RAISE",
            "actions": [
                {"action": "3bet_10x", "frequency": 0.30, "ev": 5.2},
                {"action": "call", "frequency": 0.50, "ev": 2.8},
                {"action": "fold", "frequency": 0.20, "ev": 0.0}
            ]
        },
        # UTG 开局场景
        {
            "fingerprint": "preflop|UTG|100|FOLD_FOLD_FOLD_FOLD",
            "actions": [
                {"action": "raise_2.5x", "frequency": 0.25, "ev": 1.8},
                {"action": "raise_3x", "frequency": 0.15, "ev": 1.6},
                {"action": "fold", "frequency": 0.60, "ev": 0.0}
            ]
        },
        # MP 场景
        {
            "fingerprint": "preflop|MP|80|FOLD_FOLD_FOLD",
            "actions": [
                {"action": "raise_2.5x", "frequency": 0.30, "ev": 2.1},
                {"action": "raise_3x", "frequency": 0.20, "ev": 1.9},
                {"action": "fold", "frequency": 0.50, "ev": 0.0}
            ]
        },
        # CO 场景
        {
            "fingerprint": "preflop|CO|60|FOLD_FOLD_FOLD_FOLD",
            "actions": [
                {"action": "raise_2.5x", "frequency": 0.40, "ev": 2.8},
                {"action": "raise_3x", "frequency": 0.20, "ev": 2.5},
                {"action": "fold", "frequency": 0.40, "ev": 0.0}
            ]
        }
    ]
    
    # 生成更多变体数据（达到200+条）
    positions = ["BTN", "SB", "BB", "UTG", "MP", "CO"]
    stacks = [20, 30, 40, 50, 60, 80, 100, 150, 200]
    
    count = 0
    for pos in positions:
        for stack in stacks:
            for action_seq in ["OPEN", "CALL", "RAISE", "FOLD_FOLD_RAISE", "RAISE_CALL"]:
                fingerprint = f"preflop|{pos}|{stack}|{action_seq}"
                
                # 基于位置调整策略
                if pos == "BTN":
                    actions = [
                        {"action": "raise_2.5x", "frequency": 0.45, "ev": 2.5 + stack/100},
                        {"action": "fold", "frequency": 0.30, "ev": 0.0},
                        {"action": "call", "frequency": 0.25, "ev": 1.8}
                    ]
                elif pos == "SB":
                    actions = [
                        {"action": "raise_3x", "frequency": 0.35, "ev": 2.0},
                        {"action": "fold", "frequency": 0.40, "ev": 0.0},
                        {"action": "call", "frequency": 0.25, "ev": 1.5}
                    ]
                elif pos == "BB":
                    actions = [
                        {"action": "call", "frequency": 0.40, "ev": 1.2},
                        {"action": "3bet_9x", "frequency": 0.25, "ev": 3.5},
                        {"action": "fold", "frequency": 0.35, "ev": 0.0}
                    ]
                else:  # UTG, MP, CO
                    actions = [
                        {"action": "raise_2.5x", "frequency": 0.25, "ev": 1.5},
                        {"action": "fold", "frequency": 0.55, "ev": 0.0},
                        {"action": "call", "frequency": 0.20, "ev": 1.0}
                    ]
                
                if USE_REDIS:
                    redis_client.setex(
                        f"strat:{SOLUTION_VERSION}:{fingerprint}",
                        86400,  # 24h TTL
                        json.dumps({"actions": actions, "source": "preflop_db"})
                    )
                else:
                    strategy_db[f"strat:{SOLUTION_VERSION}:{fingerprint}"] = {"actions": actions, "source": "preflop_db"}
                count += 1
    
    print(f"✅ Loaded {count} sample strategy records to {'Redis' if USE_REDIS else 'memory'}")

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.post("/v1/strategy/query", response_model=QueryResponse)
async def query_strategy(hand_state: HandState):
    """
    查询GTO策略建议
    
    - 生成场景指纹
    - 查询Redis缓存
    - 返回策略建议
    """
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"
    
    # 生成指纹
    fingerprint = generate_fingerprint(hand_state)
    cache_key = f"strat:{SOLUTION_VERSION}:{fingerprint}"  # 版本强绑定
    
    # 查询Redis或内存存储
    retrieval_start = time.time()
    if USE_REDIS:
        cached_data = redis_client.get(cache_key)
        cached_data = json.loads(cached_data) if cached_data else None
    else:
        cached_data = strategy_db.get(cache_key)
    retrieval_latency = int((time.time() - retrieval_start) * 1000)
    
    if cached_data:
        data = cached_data
        source = "redis_hit" if USE_REDIS else "memory_hit"
        cache_status = "hit"
        confidence = 0.95
    else:
            # 未命中 - 返回fallback策略
            data = {
                "actions": [
                    {"action": "fold", "frequency": 0.80, "ev": 0.0},
                    {"action": "call", "frequency": 0.15, "ev": 0.5},
                    {"action": "raise_2.5x", "frequency": 0.05, "ev": 1.2}
                ],
                "source": "fallback_safe"
            }
            source = "fallback"
            cache_status = "miss"
            confidence = 0.60
    
    # 获取最佳动作
    best_action = max(data["actions"], key=lambda x: x["ev"])
    
    server_latency = int((time.time() - start_time) * 1000)
    
    return QueryResponse(
        success=True,
        data=StrategyAdvice(
            request_id=request_id,
            scene_fingerprint=fingerprint,
            solution_version=SOLUTION_VERSION,  # 强制返回版本号
            actions=data["actions"],
            source=source,
            confidence=confidence,
            retrieval_latency_ms=retrieval_latency,
            cache_status=cache_status
        ),
        request_id=request_id,
        server_latency_ms=server_latency
    )

@app.get("/metrics")
async def get_metrics():
    """获取基础指标"""
    # 这里简化实现，实际应该从Redis或监控系统中获取
    return {
        "e2e_latency_ms": {"p50": 45, "p95": 120, "p99": 250},
        "redis_hit_rate": 0.85,
        "unsupported_rate": 0.05,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
