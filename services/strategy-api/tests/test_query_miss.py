"""
测试: 缓存未命中场景
验证: Redis中不存在策略数据时，返回fallback策略
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_query_miss():
    """测试缓存未命中 - 未知策略场景"""
    # 执行查询（使用不存在的场景）
    response = client.post("/v1/strategy/query", json={
        "hand_id": "test_miss_001",
        "table_id": "table_001",
        "street": "preflop",
        "hero_pos": "UNKNOWN_POS",  # 不常见位置
        "effective_stack_bb": 999,   # 极端筹码
        "pot_bb": 1.5,
        "action_line": "WEIRD_ACTION_SEQUENCE"
    })
    
    # 验证
    assert response.status_code == 200
    data = response.json()
    
    assert data["success"] is True
    # 应该是fallback
    assert data["data"]["source"] == "fallback"
    assert data["data"]["cache_status"] == "miss"
    assert data["data"]["confidence"] < 0.7  # fallback置信度低
    
    # 验证有actions返回
    assert len(data["data"]["actions"]) > 0
    
    # fallback通常是fold优先
    actions = data["data"]["actions"]
    fold_action = next((a for a in actions if "fold" in a["action"]), None)
    if fold_action:
        assert fold_action["frequency"] > 0.5  # fold频率应该最高
    
    print(f"✅ Miss test passed: fallback returned")

if __name__ == "__main__":
    test_query_miss()
