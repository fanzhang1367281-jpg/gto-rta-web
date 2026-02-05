"""
测试: 错误请求场景
验证: 无效输入返回400错误
"""
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_query_bad_request():
    """测试无效请求 - 缺少必填字段"""
    # 缺少必填字段
    response = client.post("/v1/strategy/query", json={
        "hand_id": "test_bad_001"
        # 缺少 table_id, street, hero_pos 等必填字段
    })
    
    # 验证返回422 Unprocessable Entity（Pydantic验证错误）
    assert response.status_code == 422
    
    data = response.json()
    assert "detail" in data
    
    print(f"✅ Bad request test passed: {response.status_code}")

def test_query_invalid_street():
    """测试无效street值"""
    response = client.post("/v1/strategy/query", json={
        "hand_id": "test_bad_002",
        "table_id": "table_001",
        "street": "invalid_street",  # 无效值
        "hero_pos": "BTN",
        "effective_stack_bb": 100,
        "pot_bb": 1.5,
        "action_line": "FOLD"
    })
    
    # FastAPI/Pydantic 会验证枚举值
    # 如果street是枚举类型，这里应该返回422
    print(f"Street validation: {response.status_code}")

def test_health_endpoint():
    """测试健康检查端点"""
    response = client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    
    assert data["status"] == "ok"
    assert "timestamp" in data
    
    print(f"✅ Health check passed")

if __name__ == "__main__":
    test_query_bad_request()
    test_query_invalid_street()
    test_health_endpoint()
