/**
 * API Client Module
 * 提供策略查询功能，包含错误处理和指标追踪
 */

class ApiClient {
  constructor(baseUrl = "http://localhost:8000") {
    this.baseUrl = baseUrl;
    this.timeoutMs = 5000; // 5秒超时

    // 节流控制: 确保 API 请求间隔 ≥1s
    this.minQueryIntervalMs = 1000;
    this.lastQueryTime = 0;

    // 指标追踪
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
      lastError: null,
      throttledRequests: 0, // 被节流的请求数
    };
  }

  /**
   * 查询策略建议
   * @param {Object} handState - HandState 对象
   * @returns {Promise<Object>} 策略建议数据
   * @throws {Error} 网络错误、HTTP错误或超时
   */
  async queryStrategy(handState) {
    const requiredFields = [
      "hand_id",
      "table_id",
      "street",
      "hero_pos",
      "effective_stack_bb",
      "pot_bb",
      "action_line",
    ];

    // 校验必需字段
    const missingFields = requiredFields.filter((f) => !(f in handState));
    if (missingFields.length > 0) {
      const error = new Error(
        `HandState 缺少必需字段: ${missingFields.join(", ")}`,
      );
      this.metrics.lastError = error.message;
      throw error;
    }

    // ===== 节流控制: 确保请求间隔 ≥1s =====
    const now = performance.now();
    const elapsed = now - this.lastQueryTime;
    if (elapsed < this.minQueryIntervalMs) {
      const waitMs = this.minQueryIntervalMs - elapsed;
      this.metrics.throttledRequests++;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastQueryTime = performance.now();
    // ======================================

    this.metrics.totalRequests++;
    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(`${this.baseUrl}/v1/strategy/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(handState),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Math.round(performance.now() - startTime);
      this.metrics.lastLatencyMs = latencyMs;
      this.metrics.totalLatencyMs += latencyMs;

      if (!response.ok) {
        const error = new Error(
          `HTTP 错误: ${response.status} ${response.statusText}`,
        );
        this.metrics.failedRequests++;
        this.metrics.lastError = error.message;
        throw error;
      }

      const data = await response.json();

      // 校验响应结构
      if (!data || typeof data !== "object") {
        const error = new Error("API 响应格式错误: 不是有效的 JSON 对象");
        this.metrics.failedRequests++;
        this.metrics.lastError = error.message;
        throw error;
      }

      // 检查 API 返回的成功状态
      if (data.success === false) {
        const errorMsg = data.error || "API 返回失败状态";
        const error = new Error(`API 错误: ${errorMsg}`);
        this.metrics.failedRequests++;
        this.metrics.lastError = error.message;
        throw error;
      }

      // 校验响应数据中包含策略数据
      if (
        !data.data ||
        !data.data.actions ||
        !Array.isArray(data.data.actions)
      ) {
        const error = new Error("API 响应缺少策略数据(actions)");
        this.metrics.failedRequests++;
        this.metrics.lastError = error.message;
        throw error;
      }

      this.metrics.successfulRequests++;
      this.metrics.lastError = null;

      return {
        success: true,
        data: data.data,
        latencyMs: latencyMs,
        raw: data,
      };
    } catch (error) {
      this.metrics.failedRequests++;

      // 区分错误类型
      if (error.name === "AbortError") {
        const timeoutError = new Error("API 请求超时 (5秒)");
        this.metrics.lastError = timeoutError.message;
        throw timeoutError;
      }

      if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        const networkError = new Error("API 连接失败: 无法连接到服务器");
        this.metrics.lastError = networkError.message;
        throw networkError;
      }

      this.metrics.lastError = error.message;
      throw error;
    }
  }

  /**
   * 获取当前指标
   * @returns {Object} 指标数据
   */
  getMetrics() {
    const successRate =
      this.metrics.totalRequests > 0
        ? (
            (this.metrics.successfulRequests / this.metrics.totalRequests) *
            100
          ).toFixed(1)
        : 0;

    const avgLatency =
      this.metrics.successfulRequests > 0
        ? Math.round(
            this.metrics.totalLatencyMs / this.metrics.successfulRequests,
          )
        : 0;

    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate: parseFloat(successRate),
      avgLatencyMs: avgLatency,
      lastLatencyMs: this.metrics.lastLatencyMs,
      lastError: this.metrics.lastError,
    };
  }

  /**
   * 重置指标
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
      lastError: null,
    };
  }
}

// 创建全局实例
const apiClient = new ApiClient();

// 导出模块
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ApiClient, apiClient };
}
