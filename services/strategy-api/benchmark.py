"""
压测脚本 - 100/300/500 RPS 三档测试
"""
import asyncio
import aiohttp
import time
import statistics
from concurrent.futures import ThreadPoolExecutor
import requests

API_URL = "http://localhost:8000/v1/strategy/query"
HEALTH_URL = "http://localhost:8000/health"

# 测试样本
TEST_SAMPLES = [
    {
        "hand_id": "load_test",
        "table_id": "table_001",
        "street": "preflop",
        "hero_pos": "BTN",
        "effective_stack_bb": 100,
        "pot_bb": 1.5,
        "action_line": "FOLD_FOLD_FOLD_FOLD"
    }
] * 100  # 100个样本

def check_health():
    """检查API健康状态"""
    try:
        r = requests.get(HEALTH_URL, timeout=5)
        return r.status_code == 200
    except:
        return False

def single_request(payload):
    """单次请求"""
    start = time.time()
    try:
        r = requests.post(API_URL, json=payload, timeout=10)
        latency = (time.time() - start) * 1000  # ms
        return {
            "status": r.status_code,
            "latency": latency,
            "success": r.status_code == 200 and r.json().get("success")
        }
    except Exception as e:
        return {
            "status": 0,
            "latency": (time.time() - start) * 1000,
            "success": False,
            "error": str(e)
        }

def run_load_test(rps, duration=30):
    """
    运行负载测试
    rps: 目标每秒请求数
    duration: 测试持续时间(秒)
    """
    print(f"\n{'='*60}")
    print(f"负载测试: {rps} RPS, {duration}秒")
    print(f"{'='*60}")
    
    if not check_health():
        print("❌ API 未启动，请先运行 ./start.sh")
        return
    
    results = []
    start_time = time.time()
    request_interval = 1.0 / rps
    
    with ThreadPoolExecutor(max_workers=rps*2) as executor:
        futures = []
        
        while time.time() - start_time < duration:
            for sample in TEST_SAMPLES[:rps]:
                future = executor.submit(single_request, sample)
                futures.append(future)
            
            time.sleep(request_interval)
            
            # 收集已完成的请求
            done = [f for f in futures if f.done()]
            for f in done:
                results.append(f.result())
                futures.remove(f)
        
        # 等待剩余请求完成
        for f in futures:
            try:
                results.append(f.result(timeout=5))
            except:
                results.append({"success": False, "latency": 0})
    
    # 计算指标
    total = len(results)
    successes = [r for r in results if r.get("success")]
    errors = total - len(successes)
    latencies = [r["latency"] for r in successes if r.get("latency", 0) > 0]
    
    if not latencies:
        print("❌ 没有成功的请求")
        return
    
    # 排序计算分位数
    latencies.sort()
    p50 = latencies[int(len(latencies) * 0.5)]
    p95 = latencies[int(len(latencies) * 0.95)]
    p99 = latencies[int(len(latencies) * 0.99)]
    
    actual_duration = time.time() - start_time
    actual_rps = total / actual_duration
    
    print(f"\n📊 测试结果:")
    print(f"  总请求数: {total}")
    print(f"  成功: {len(successes)} ({len(successes)/total*100:.1f}%)")
    print(f"  错误: {errors} ({errors/total*100:.1f}%)")
    print(f"  实际RPS: {actual_rps:.1f}")
    print(f"\n⏱️  延迟 (ms):")
    print(f"  P50: {p50:.1f}")
    print(f"  P95: {p95:.1f}")
    print(f"  P99: {p99:.1f}")
    print(f"  Min: {min(latencies):.1f}")
    print(f"  Max: {max(latencies):.1f}")
    print(f"  Avg: {statistics.mean(latencies):.1f}")
    
    return {
        "rps_target": rps,
        "rps_actual": actual_rps,
        "total_requests": total,
        "success_rate": len(successes)/total,
        "error_rate": errors/total,
        "latency_p50": p50,
        "latency_p95": p95,
        "latency_p99": p99
    }

def main():
    """主函数 - 运行三档压测"""
    print("🚀 GTO Strategy API 压测开始")
    print("请确保 API 已启动: ./start.sh")
    
    results = []
    
    # 100 RPS
    result_100 = run_load_test(100, duration=30)
    if result_100:
        results.append(result_100)
    
    time.sleep(5)  # 冷却
    
    # 300 RPS
    result_300 = run_load_test(300, duration=30)
    if result_300:
        results.append(result_300)
    
    time.sleep(5)  # 冷却
    
    # 500 RPS
    result_500 = run_load_test(500, duration=30)
    if result_500:
        results.append(result_500)
    
    # 生成报告
    generate_report(results)

def generate_report(results):
    """生成压测报告"""
    report = """# 压测报告

## 测试环境
- API: http://localhost:8000
- 测试时间: {timestamp}
- 测试工具: Python requests + ThreadPoolExecutor

## 测试场景
POST /v1/strategy/query
- Payload: preflop BTN 100BB standard open
- 每项测试持续 30 秒

## 结果汇总

| RPS | 实际RPS | 成功率 | P50 (ms) | P95 (ms) | P99 (ms) |
|-----|---------|--------|----------|----------|----------|
""".format(timestamp=time.strftime("%Y-%m-%d %H:%M:%S"))
    
    for r in results:
        report += f"| {r['rps_target']} | {r['rps_actual']:.1f} | {r['success_rate']*100:.1f}% | {r['latency_p50']:.1f} | {r['latency_p95']:.1f} | {r['latency_p99']:.1f} |\n"
    
    report += """
## 结论

"""
    
    # 检查是否满足目标
    for r in results:
        if r['latency_p95'] < 250:
            report += f"- ✅ {r['rps_target']} RPS: P95 {r['latency_p95']:.1f}ms < 250ms (达标)\n"
        else:
            report += f"- ❌ {r['rps_target']} RPS: P95 {r['latency_p95']:.1f}ms > 250ms (未达标)\n"
    
    report += """
## 建议

1. 若 P95 > 250ms，考虑：
   - 增加Redis连接池
   - 启用API缓存
   - 优化序列化逻辑

2. 若错误率 > 1%，检查：
   - 并发连接数限制
   - 超时配置
   - 资源使用（CPU/内存）
"""
    
    with open("docs/latency_report.md", "w") as f:
        f.write(report)
    
    print("\n✅ 报告已生成: docs/latency_report.md")
    print(report)

if __name__ == "__main__":
    main()
