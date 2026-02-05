/**
 * WebRTC Screen Capture Module
 * Provides screen capture functionality using getDisplayMedia API
 * Integrated with HandState extraction and metrics collection
 */

class ScreenCapture {
    constructor() {
        this.mediaStream = null;
        this.captureInterval = null;
        this.isCapturing = false;
        this.captureIntervalMs = 200;
        this.frameCount = 0;
        this.lastFpsTime = 0;
        this.currentFps = 0;
        this.lastLatency = 0;
        this.handStateExtractor = null;
        this.apiClient = null;
        this.lastStrategyResult = null;
        this.lastApiError = null;
    }

    async startCapture() {
        if (this.isCapturing) {
            console.warn('Capture is already running');
            return false;
        }

        try {
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });

            this.mediaStream.getVideoTracks()[0].onended = () => {
                console.log('Screen sharing was stopped by user');
                this.stopCapture();
            };

            this.isCapturing = true;
            this.frameCount = 0;
            this.lastFpsTime = performance.now();
            
            if (typeof handStateExtractor !== 'undefined') {
                this.handStateExtractor = handStateExtractor;
                this.handStateExtractor.startNewHand();
            }

            if (typeof apiClient !== 'undefined') {
                this.apiClient = apiClient;
            }

            console.log('Screen capture started');

            this.captureInterval = setInterval(() => {
                this.captureFrame();
            }, this.captureIntervalMs);

            this.updateButtonStates();

            return true;
        } catch (error) {
            console.error('Failed to start screen capture:', error);
            this.isCapturing = false;
            return false;
        }
    }

    stopCapture() {
        if (!this.isCapturing) {
            return;
        }

        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
            });
            this.mediaStream = null;
        }

        this.isCapturing = false;
        this.frameCount = 0;
        this.currentFps = 0;
        this.lastLatency = 0;
        console.log('Screen capture stopped');

        this.updateButtonStates();
        this.updateMetricsDisplay();
    }

    captureFrame() {
        if (!this.isCapturing || !this.mediaStream) {
            return;
        }

        this.frameCount++;
        
        const now = performance.now();
        if (now - this.lastFpsTime >= 1000) {
            this.currentFps = Math.round(this.frameCount * 1000 / (now - this.lastFpsTime));
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        if (this.handStateExtractor) {
            const { handState, latency } = this.handStateExtractor.extractHandState();
            this.lastLatency = latency;

            const requiredFields = ['hand_id', 'table_id', 'street', 'hero_pos', 'effective_stack_bb', 'pot_bb', 'action_line', 'timestamp'];
            const missingFields = requiredFields.filter(f => !(f in handState));

            if (missingFields.length > 0) {
                console.error('HandState contract violation - missing fields:', missingFields);
            } else {
                const handStateJson = JSON.stringify(handState);
                console.log(handStateJson);
                this.updateHandStateDisplay(handState);

                if (this.apiClient) {
                    this.queryStrategyAsync(handState);
                }
            }

            this.updateMetricsDisplay();
        } else {
            console.log('Frame captured (no HandState extractor)');
        }
    }

    updateHandStateDisplay(handState) {
        const elements = {
            handId: document.getElementById('captureHandId'),
            tableId: document.getElementById('captureTableId'),
            street: document.getElementById('captureStreet'),
            heroPos: document.getElementById('captureHeroPos'),
            stack: document.getElementById('captureStack'),
            pot: document.getElementById('capturePot'),
            actionLine: document.getElementById('captureActionLine'),
            timestamp: document.getElementById('captureTimestamp')
        };

        if (elements.handId) elements.handId.textContent = handState.hand_id;
        if (elements.tableId) elements.tableId.textContent = handState.table_id;
        if (elements.street) elements.street.textContent = handState.street;
        if (elements.heroPos) elements.heroPos.textContent = handState.hero_pos;
        if (elements.stack) elements.stack.textContent = handState.effective_stack_bb;
        if (elements.pot) elements.pot.textContent = handState.pot_bb;
        if (elements.actionLine) elements.actionLine.textContent = handState.action_line;
        if (elements.timestamp) elements.timestamp.textContent = handState.timestamp;
    }

    updateMetricsDisplay() {
        const fpsElement = document.getElementById('captureFps');
        const latencyElement = document.getElementById('captureLatency');

        if (fpsElement) {
            fpsElement.textContent = this.isCapturing ? this.currentFps : '-';
        }
        if (latencyElement) {
            latencyElement.textContent = this.isCapturing ? `${Math.round(this.lastLatency)} ms` : '-';
        }
    }

    getIsCapturing() {
        return this.isCapturing;
    }

    updateButtonStates() {
        const startBtn = document.getElementById('startCaptureBtn');
        const stopBtn = document.getElementById('stopCaptureBtn');

        if (startBtn) {
            startBtn.disabled = this.isCapturing;
        }
        if (stopBtn) {
            stopBtn.disabled = !this.isCapturing;
        }
    }

    getMetrics() {
        const apiMetrics = this.apiClient ? this.apiClient.getMetrics() : null;

        return {
            fps: this.currentFps,
            capture_latency_ms: Math.round(this.lastLatency),
            is_capturing: this.isCapturing,
            api_latency_ms: apiMetrics ? apiMetrics.lastLatencyMs : 0,
            api_success_rate: apiMetrics ? apiMetrics.successRate : 0,
            api_total_requests: apiMetrics ? apiMetrics.totalRequests : 0
        };
    }

    async queryStrategyAsync(handState) {
        try {
            const result = await this.apiClient.queryStrategy(handState);
            this.lastStrategyResult = result;
            this.lastApiError = null;
            this.updateStrategyDisplay(result.data);
        } catch (error) {
            this.lastApiError = error.message;
            console.error('Strategy query failed:', error.message);
            this.updateStrategyError(error.message);
        }
        this.updateApiMetricsDisplay();
    }

    updateStrategyDisplay(strategyData) {
        const strategyAdvice = document.getElementById('strategyAdvice');
        const strategyActions = document.getElementById('strategyActions');

        if (!strategyAdvice) return;

        if (strategyData.actions && strategyData.actions.length > 0) {
            const bestAction = strategyData.actions.reduce((a, b) => (a.ev > b.ev ? a : b));
            const position = strategyData.hero_pos || 'BTN';
            strategyAdvice.textContent = `${position}: ${bestAction.action.toUpperCase()} ${bestAction.sizing || ''}`;
            strategyAdvice.className = 'advice-line';
        } else {
            strategyAdvice.textContent = '无策略数据';
            strategyAdvice.className = 'advice-line error';
        }

        if (strategyActions && strategyData.actions) {
            const actionsHtml = strategyData.actions
                .sort((a, b) => b.frequency - a.frequency)
                .map(
                    (a) => `
                    <div class="action-item">
                        <span class="action-name">${a.action}</span>
                        <span class="action-freq">${Math.round(a.frequency * 100)}%</span>
                    </div>
                `
                )
                .join('');
            strategyActions.innerHTML = actionsHtml;
        }
    }

    updateStrategyError(errorMessage) {
        const strategyAdvice = document.getElementById('strategyAdvice');
        if (strategyAdvice) {
            if (errorMessage.includes('超时')) {
                strategyAdvice.textContent = 'API 请求超时';
            } else if (errorMessage.includes('连接失败')) {
                strategyAdvice.textContent = 'API 连接失败';
            } else {
                strategyAdvice.textContent = '策略查询错误';
            }
            strategyAdvice.className = 'advice-line error';
        }
    }

    updateApiMetricsDisplay() {
        if (!this.apiClient) return;

        const metrics = this.apiClient.getMetrics();

        const apiLatencyEl = document.getElementById('apiLatency');
        const apiSuccessRateEl = document.getElementById('apiSuccessRate');
        const apiStatusEl = document.getElementById('apiStatus');

        if (apiLatencyEl) {
            apiLatencyEl.textContent = metrics.lastLatencyMs > 0 ? `${metrics.lastLatencyMs} ms` : '-';
        }

        if (apiSuccessRateEl) {
            apiSuccessRateEl.textContent = metrics.totalRequests > 0 ? `${metrics.successRate}%` : '-';
        }

        if (apiStatusEl) {
            if (metrics.lastError) {
                apiStatusEl.textContent = '错误';
                apiStatusEl.style.color = '#e74c3c';
            } else if (metrics.totalRequests > 0) {
                apiStatusEl.textContent = '正常';
                apiStatusEl.style.color = '#00d4aa';
            } else {
                apiStatusEl.textContent = '等待中';
                apiStatusEl.style.color = '#a0a0a0';
            }
        }
    }
}

const screenCapture = new ScreenCapture();

function startCapture() {
    screenCapture.startCapture();
}

function stopCapture() {
    screenCapture.stopCapture();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScreenCapture, startCapture, stopCapture };
}
