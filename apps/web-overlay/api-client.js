/**
 * API Client Module
 * 提供策略查询功能，包含错误处理和指标追踪
 */

class ApiClient {
  constructor(baseUrl = "http://localhost:8000") {
    this.baseUrl = baseUrl;
    this.timeoutMs = 5000; // 5秒超时

    // 节流控制: 确保 API 请求间隔 ≥1s (非阻塞实现)
    this.minQueryIntervalMs = 1000;
    this.lastQueryTime = 0;
    this.lastResult = null; // 缓存上次结果
    this.inFlightPromise = null; // single-flight: 当前在途请求

    // 状态与缓存管理
    this.lastSuccessfulStrategy = null; // 上次成功策略数据
    this.lastSuccessfulAt = 0; // 上次成功时间戳
    this.currentStatus = "INIT"; // INIT | SUCCESS | MISS | UNSUPPORTED | ERROR | NETWORK_ERROR

    // 指标追踪
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
      lastError: null,
      throttledRequests: 0, // 被节流的请求数 (跳过 + 复用)
      skippedRequests: 0, // 因间隔太短被跳过的请求数
      reusedRequests: 0, // 复用 in-flight 的请求数
    };
  }

  /**
   * 查询策略建议 (single-flight + 非阻塞节流)
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

    // ===== Single-Flight: 复用在途请求 =====
    if (this.inFlightPromise) {
      this.metrics.throttledRequests++;
      this.metrics.reusedRequests++;
      return this.inFlightPromise;
    }

    // ===== 非阻塞节流: 未到1s直接返回缓存结果 =====
    const now = performance.now();
    const elapsed = now - this.lastQueryTime;
    if (elapsed < this.minQueryIntervalMs && this.lastResult) {
      this.metrics.throttledRequests++;
      this.metrics.skippedRequests++;
      return Promise.resolve(this.lastResult);
    }
    // ==========================================

    // 创建实际请求 Promise
    this.inFlightPromise = this._doQuery(handState);

    // 请求完成后清理 inFlightPromise
    this.inFlightPromise.finally(() => {
      this.inFlightPromise = null;
    });

    return this.inFlightPromise;
  }

  /**
   * 实际执行查询 (内部方法)
   * @returns {Promise<Object>} 统一响应格式: { status, source, data?, error?, staleAgeSec? }
   */
  async _doQuery(handState) {
    this.metrics.totalRequests++;
    this.lastQueryTime = performance.now();
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

      // HTTP 错误处理 (4xx/5xx)
      if (!response.ok) {
        this.metrics.failedRequests++;
        const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        this.metrics.lastError = errorMsg;
        this.currentStatus =
          response.status >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR";

        return this._buildErrorResponse(errorMsg, this.currentStatus);
      }

      const data = await response.json();

      // 校验响应结构
      if (!data || typeof data !== "object") {
        this.metrics.failedRequests++;
        const errorMsg = "API 响应格式错误";
        this.metrics.lastError = errorMsg;
        this.currentStatus = "PARSE_ERROR";
        return this._buildErrorResponse(errorMsg, "PARSE_ERROR");
      }

      // API 返回的成功状态检查
      if (data.success === false) {
        this.metrics.failedRequests++;
        const errorMsg = data.error || "API 返回失败";
        this.metrics.lastError = errorMsg;

        // 判断错误类型
        if (errorMsg.includes("unsupported") || errorMsg.includes("不支持")) {
          this.currentStatus = "UNSUPPORTED";
        } else if (errorMsg.includes("miss") || errorMsg.includes("未命中")) {
          this.currentStatus = "MISS";
        } else {
          this.currentStatus = "API_ERROR";
        }

        return this._buildErrorResponse(errorMsg, this.currentStatus);
      }

      // 校验响应数据中包含策略数据
      if (
        !data.data ||
        !data.data.actions ||
        !Array.isArray(data.data.actions)
      ) {
        this.metrics.failedRequests++;
        const errorMsg = "API 响应缺少策略数据";
        this.metrics.lastError = errorMsg;
        this.currentStatus = "DATA_ERROR";
        return this._buildErrorResponse(errorMsg, "DATA_ERROR");
      }

      // 成功响应
      this.metrics.successfulRequests++;
      this.metrics.lastError = null;
      this.currentStatus = "SUCCESS";

      const result = {
        success: true,
        data: data.data,
        latencyMs: latencyMs,
        raw: data,
      };

      // 缓存成功结果和策略数据
      this.lastResult = result;
      this.lastSuccessfulStrategy = data.data;
      this.lastSuccessfulAt = Date.now();

      return {
        status: "SUCCESS",
        source: data.data.cache_status || "api",
        data: data.data,
        latencyMs: latencyMs,
      };
    } catch (error) {
      this.metrics.failedRequests++;

      // 区分错误类型
      if (error.name === "AbortError") {
        const errorMsg = "请求超时 (5秒)";
        this.metrics.lastError = errorMsg;
        this.currentStatus = "TIMEOUT";
        return this._buildErrorResponse(errorMsg, "TIMEOUT");
      }

      if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        const errorMsg = "网络连接失败";
        this.metrics.lastError = errorMsg;
        this.currentStatus = "NETWORK_ERROR";
        return this._buildErrorResponse(errorMsg, "NETWORK_ERROR");
      }

      this.metrics.lastError = error.message;
      this.currentStatus = "ERROR";
      return this._buildErrorResponse(error.message, "ERROR");
    }
  }

  /**
   * 构建错误响应 (包含 stale 数据)
   */
  _buildErrorResponse(errorMessage, status) {
    const result = {
      status: status,
      source: "error",
      error: errorMessage,
      data: null,
    };

    // 如果有缓存的成功策略，附加 stale 数据
    if (this.lastSuccessfulStrategy) {
      const now = Date.now();
      const staleAgeSec = Math.round((now - this.lastSuccessfulAt) / 1000);
      result.staleData = this.lastSuccessfulStrategy;
      result.staleAgeSec = staleAgeSec;
    }

    return result;
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
      throttledRequests: this.metrics.throttledRequests,
      skippedRequests: this.metrics.skippedRequests,
      reusedRequests: this.metrics.reusedRequests,
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
      throttledRequests: 0,
      skippedRequests: 0,
      reusedRequests: 0,
    };
    this.lastResult = null;
  }
}

// 创建全局实例
const apiClient = new ApiClient();

// 导出模块
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ApiClient, apiClient };
}
