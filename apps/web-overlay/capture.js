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
            
            // 契约检查：确保 HandState 有所有必需字段
            const requiredFields = ['hand_id', 'table_id', 'street', 'hero_pos', 'effective_stack_bb', 'pot_bb', 'action_line', 'timestamp'];
            const missingFields = requiredFields.filter(f => !(f in handState));
            
            if (missingFields.length > 0) {
                console.error('HandState contract violation - missing fields:', missingFields);
            } else {
                // Console 和 UI 数据一致（同一对象）
                const handStateJson = JSON.stringify(handState);
                console.log(handStateJson);
                this.updateHandStateDisplay(handState);
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
        return {
            fps: this.currentFps,
            capture_latency_ms: Math.round(this.lastLatency),
            is_capturing: this.isCapturing
        };
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
