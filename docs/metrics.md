# Metrics Contract — GTO-RTA Runtime Export

> **Version**: 1.0.0
> **Purpose**: Paper citation & reproducible experiments
> **Cite as**: (gto-rta-web `v0.3.0`, metrics.version `1.0.0`, solution.version TBD)

---

## 1. Export Methods

| Method        | Trigger                               | Output                                  |
| ------------- | ------------------------------------- | --------------------------------------- |
| File Download | `Ctrl+E` or click "导出 metrics.json" | `metrics_<TIMESTAMP>.json`              |
| Console Print | `Ctrl+Shift+E`                        | Pretty-printed JSON in DevTools console |
| Programmatic  | `apiClient.exportMetricsSnapshot()`   | Same as file download                   |

---

## 2. Field Definitions & Units

### Top-level Metadata

| Field          | Type    | Description                     |
| -------------- | ------- | ------------------------------- |
| `version`      | string  | Metrics schema version (semver) |
| `timestamp`    | ISO8601 | Export moment (UTC)             |
| `timestamp_ms` | integer | Export moment (Unix ms)         |

### requests — Request Counts

| Field        | Definition                                   | Notes                               |
| ------------ | -------------------------------------------- | ----------------------------------- |
| `total`      | Total query attempts                         | Includes throttled, skipped, reused |
| `successful` | HTTP 200 + valid JSON + `success=true`       | Excludes stale fallback             |
| `failed`     | All non-success outcomes                     | See §3 Failed States                |
| `throttled`  | Requests that waited or returned cached      | Single-flight + skip-if-too-soon    |
| `skipped`    | Requests <1s interval, returned `lastResult` | Subset of throttled                 |
| `reused`     | Requests that returned `inFlightPromise`     | Subset of throttled                 |

### rates — Percentages & QPS

| Field                  | Unit  | Window     | Denominator  | Definition                             |
| ---------------------- | ----- | ---------- | ------------ | -------------------------------------- |
| `hit_rate_percent`     | %     | cumulative | `hit + miss` | Cache hits / total cacheable requests  |
| `stale_rate_percent`   | %     | cumulative | `total`      | Times stale data used / total requests |
| `error_rate_percent`   | %     | cumulative | `total`      | Failed requests / total requests       |
| `success_rate_percent` | %     | cumulative | `total`      | Successful requests / total requests   |
| `qps`                  | req/s | 60s        | N/A          | `requestTimestamps.length / 60`        |

**QPS Calculation**:

- Sliding window: last 60 seconds of `requestTimestamps`
- Cleaned every request: timestamps older than `now - 60000ms` removed
- Precision: 2 decimal places

### latency_ms — Latency Distribution

| Field         | Unit  | Window       | Calculation                           |
| ------------- | ----- | ------------ | ------------------------------------- |
| `p50`         | ms    | 100 samples  | Median of `latencyHistory`            |
| `p95`         | ms    | 100 samples  | 95th percentile of `latencyHistory`   |
| `p99`         | ms    | 100 samples  | 99th percentile of `latencyHistory`   |
| `avg`         | ms    | cumulative   | `totalLatencyMs / successfulRequests` |
| `last`        | ms    | last request | Most recent latency                   |
| `sample_size` | count | current      | `latencyHistory.length` (max 100)     |

**Latency History**:

- Circular buffer: max 100 samples
- Added on every successful request
- Sorted at export time for percentile calculation
- Unit: milliseconds (ms), rounded to integer

### cache — Cache Statistics

| Field        | Definition                                |
| ------------ | ----------------------------------------- |
| `hits`       | `cache_status === 'hit'` responses        |
| `misses`     | `cache_status !== 'hit'` responses        |
| `stale_uses` | Times error response included `staleData` |

### runtime — Runtime State

| Field                | Type           | Description                                            |
| -------------------- | -------------- | ------------------------------------------------------ |
| `last_error`         | string \| null | Last error message, or null if none                    |
| `current_status`     | enum           | Most recent status: SUCCESS/MISS/UNSUPPORTED/ERROR/... |
| `last_successful_at` | Unix ms        | Timestamp of last successful response                  |

---

## 3. Failed States Definition

`requests.failed` includes these status codes:

| Status          | HTTP Code | Counted as Failed? | Notes                                |
| --------------- | --------- | ------------------ | ------------------------------------ |
| `ERROR`         | varies    | ✅ Yes             | Generic error                        |
| `TIMEOUT`       | —         | ✅ Yes             | AbortError after 5s                  |
| `NETWORK_ERROR` | —         | ✅ Yes             | fetch/network failure                |
| `SERVER_ERROR`  | 5xx       | ✅ Yes             | HTTP 500-599                         |
| `CLIENT_ERROR`  | 4xx       | ✅ Yes             | HTTP 400-499                         |
| `API_ERROR`     | 200       | ✅ Yes             | `success=false` in response          |
| `DATA_ERROR`    | 200       | ✅ Yes             | Missing `actions` array              |
| `PARSE_ERROR`   | 200       | ✅ Yes             | Invalid JSON                         |
| `UNSUPPORTED`   | 200       | ❌ No              | Valid response, unsupported scenario |
| `MISS`          | 200       | ❌ No              | Valid response, cache miss           |
| `SUCCESS`       | 200       | ❌ No              | Normal success                       |

**Key Rule**:

- ✅ Failed = technical failure (network, timeout, server error, parse error)
- ❌ Not Failed = business logic outcomes (MISS, UNSUPPORTED are valid responses)

---

## 4. Reproducibility Anchor

For paper citation and experiment reproduction, include this triplet:

```
(gto-rta-web <git_tag_or_commit>, metrics.version <semver>, solution.version <semver>)
```

**Current Values** (as of v0.3.0):

- `gto-rta-web`: `v0.3.0` or commit `be7e90f`
- `metrics.version`: `1.0.0`
- `solution.version`: **TBD** (future: inject from build)

**Example Citation**:

> "We measured API performance using GTO-RTA's runtime metrics export (v0.3.0, metrics v1.0.0), capturing p95 latency over a 100-sample sliding window..."

---

## 5. Version Strategy

| Schema  | Metrics Version | Breaking Changes                          |
| ------- | --------------- | ----------------------------------------- |
| Initial | 1.0.0           | —                                         |
| Future  | 1.x.x           | Additive fields only                      |
| Future  | 2.0.0           | Field removal/rename (requires migration) |

**Compatibility**:

- Minor/patch: backward compatible (new fields OK)
- Major: breaking change (new file format)

---

## 6. Example Export

```json
{
  "version": "1.0.0",
  "timestamp": "2026-02-06T20:25:00.000Z",
  "timestamp_ms": 1739382300000,
  "requests": {
    "total": 150,
    "successful": 142,
    "failed": 8,
    "throttled": 45,
    "skipped": 38,
    "reused": 7
  },
  "rates": {
    "hit_rate_percent": 65.49,
    "stale_rate_percent": 5.33,
    "error_rate_percent": 5.33,
    "success_rate_percent": 94.67,
    "qps": 2.5
  },
  "latency_ms": {
    "p50": 45,
    "p95": 120,
    "p99": 180,
    "avg": 52.3,
    "last": 38,
    "sample_size": 100
  },
  "cache": {
    "hits": 93,
    "misses": 49,
    "stale_uses": 8
  },
  "runtime": {
    "last_error": null,
    "current_status": "SUCCESS",
    "last_successful_at": 1739382298000
  }
}
```

---

## 7. Validation Checklist

Before citing metrics in a paper:

- [ ] Export timestamp recorded
- [ ] Git commit/tag documented
- [ ] `metrics.version` matches this contract
- [ ] Window definitions (QPS 60s, latency 100 samples) stated
- [ ] Failed states definition aligned with your analysis

---

_Document Version: 1.0.0_
_Last Updated: 2026-02-06_
_Corresponds to: gto-rta-web v0.3.0_
