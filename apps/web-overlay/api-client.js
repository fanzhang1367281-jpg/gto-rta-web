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
      // 新增: 运行时分档统计
      hitCount: 0, // cache hit
      missCount: 0, // cache miss
      staleCount: 0, // 使用 stale 数据的次数
      // 新增: 滑动窗口（用于 p50/p95 近似）
      latencyHistory: [], // 最近 100 次延迟
      requestTimestamps: [], // 最近 1 分钟的请求时间戳
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

      // 记录延迟到滑动窗口
      this._recordLatency(latencyMs);

      // 记录 cache hit/miss
      if (data.data.cache_status === "hit") {
        this.metrics.hitCount++;
      } else {
        this.metrics.missCount++;
      }

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
   * 记录延迟到滑动窗口 (保留最近 100 次)
   */
  _recordLatency(latencyMs) {
    this.metrics.latencyHistory.push(latencyMs);
    if (this.metrics.latencyHistory.length > 100) {
      this.metrics.latencyHistory.shift();
    }
    // 记录请求时间戳 (用于 QPS 计算)
    const now = Date.now();
    this.metrics.requestTimestamps.push(now);
    // 清理超过 1 分钟的旧记录
    const oneMinuteAgo = now - 60000;
    this.metrics.requestTimestamps = this.metrics.requestTimestamps.filter(
      (t) => t > oneMinuteAgo,
    );
  }

  /**
   * 获取运行时指标快照 (用于论文/复现实验)
   * @returns {Object} 完整的指标快照
   */
  getMetricsSnapshot() {
    const now = Date.now();
    const total = this.metrics.totalRequests;
    const success = this.metrics.successfulRequests;
    const failed = this.metrics.failedRequests;

    // 计算 hit rate
    const totalCacheRequests = this.metrics.hitCount + this.metrics.missCount;
    const hitRate =
      totalCacheRequests > 0
        ? (this.metrics.hitCount / totalCacheRequests) * 100
        : 0;

    // 计算 stale rate (stale 使用次数 / 总请求数)
    const staleRate = total > 0 ? (this.metrics.staleCount / total) * 100 : 0;

    // 计算 error rate
    const errorRate = total > 0 ? (failed / total) * 100 : 0;

    // 计算 QPS (最近 1 分钟)
    const qps = this.metrics.requestTimestamps.length / 60;

    // 计算延迟分位数 (p50/p95)
    const latencies = [...this.metrics.latencyHistory].sort((a, b) => a - b);
    const p50 =
      latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p95 =
      latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 =
      latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;

    return {
      // 元数据
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      timestamp_ms: now,

      // 基础统计
      requests: {
        total: total,
        successful: success,
        failed: failed,
        throttled: this.metrics.throttledRequests,
        skipped: this.metrics.skippedRequests,
        reused: this.metrics.reusedRequests,
      },

      // 比率指标
      rates: {
        hit_rate_percent: parseFloat(hitRate.toFixed(2)),
        stale_rate_percent: parseFloat(staleRate.toFixed(2)),
        error_rate_percent: parseFloat(errorRate.toFixed(2)),
        success_rate_percent:
          total > 0 ? parseFloat(((success / total) * 100).toFixed(2)) : 0,
        qps: parseFloat(qps.toFixed(2)),
      },

      // 延迟指标 (ms)
      latency_ms: {
        p50: p50,
        p95: p95,
        p99: p99,
        avg:
          success > 0
            ? parseFloat((this.metrics.totalLatencyMs / success).toFixed(2))
            : 0,
        last: this.metrics.lastLatencyMs,
        sample_size: latencies.length,
      },

      // 缓存统计
      cache: {
        hits: this.metrics.hitCount,
        misses: this.metrics.missCount,
        stale_uses: this.metrics.staleCount,
      },

      // 运行时状态
      runtime: {
        last_error: this.metrics.lastError,
        current_status: this.currentStatus,
        last_successful_at: this.lastSuccessfulAt,
      },
    };
  }

  /**
   * 导出指标快照为 JSON 文件 (浏览器下载)
   */
  exportMetricsSnapshot(filename = null) {
    const snapshot = this.getMetricsSnapshot();
    const defaultFilename = `metrics_${snapshot.timestamp_ms}.json`;
    const finalFilename = filename || defaultFilename;

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("[Metrics] Snapshot exported:", finalFilename, snapshot);
    return snapshot;
  }

  /**
   * 打印指标快照到 console (供复制)
   */
  printMetricsSnapshot() {
    const snapshot = this.getMetricsSnapshot();
    console.log(
      "%c[Metrics Snapshot]",
      "color: #00d4aa; font-size: 14px; font-weight: bold;",
    );
    console.log(JSON.stringify(snapshot, null, 2));
    return snapshot;
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
      hitCount: 0,
      missCount: 0,
      staleCount: 0,
      latencyHistory: [],
      requestTimestamps: [],
    };
    this.lastResult = null;
    this.lastSuccessfulStrategy = null;
    this.lastSuccessfulAt = 0;
  }
}

// 创建全局实例
const apiClient = new ApiClient();

// 导出模块
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ApiClient, apiClient };
}
