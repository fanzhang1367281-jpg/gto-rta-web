"""
测试: 缓存命中场景
验证: Redis中存在策略数据时，API正确返回
"""
import pytest
import json
from fastapi.testclient import TestClient
from main import app, strategy_db

client = TestClient(app)

def test_query_hit():
    """测试缓存命中 - 已知策略场景"""
    # 准备: 确保策略数据在内存中
    test_fingerprint = "preflop|BTN|100|FOLD_FOLD_FOLD_FOLD"
    strategy_db[f"strat:v0.1:{test_fingerprint}"] = {
        "actions": [
            {"action": "raise_2.5x", "frequency": 0.55, "ev": 3.2},
            {"action": "fold", "frequency": 0.45, "ev": 0.0}
        ],
        "source": "preflop_db"
    }
    
    # 执行查询
    response = client.post("/v1/strategy/query", json={
        "hand_id": "test_hit_001",
        "table_id": "table_001",
        "street": "preflop",
        "hero_pos": "BTN",
        "effective_stack_bb": 100,
        "pot_bb": 1.5,
        "action_line": "FOLD_FOLD_FOLD_FOLD"
    })
    
    # 验证
    assert response.status_code == 200
    data = response.json()
    
    assert data["success"] is True
    assert data["data"]["cache_status"] == "hit"
    assert data["data"]["confidence"] > 0.9
    assert len(data["data"]["actions"]) > 0
    
    # 验证延迟
    assert data["server_latency_ms"] < 100  # 命中应该很快
    assert data["data"]["retrieval_latency_ms"] < 50
    
    print(f"✅ Hit test passed: latency={data['server_latency_ms']}ms")

if __name__ == "__main__":
    test_query_hit()
