/**
 * WebRTC Screen Capture Module
 * Provides screen capture functionality using getDisplayMedia API
 */

class ScreenCapture {
    constructor() {
        this.mediaStream = null;
        this.captureInterval = null;
        this.isCapturing = false;
        this.isStarting = false; // 防重入锁
        this.captureIntervalMs = 200;
    }

    async startCapture() {
        // 防重入：如果正在启动或已在捕获中，直接返回
        if (this.isStarting || this.isCapturing) {
            console.warn('Capture is already starting or running');
            return false;
        }

        this.isStarting = true;
        this.updateButtonStates(); // 立即更新按钮状态

        try {
            this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });

            // 用户停止共享时的回调
            this.mediaStream.getVideoTracks()[0].onended = () => {
                console.log('Screen sharing was stopped by user (track ended)');
                this.stopCapture();
            };

            this.isCapturing = true;
            this.isStarting = false;
            console.log('Screen capture started');

            this.captureInterval = setInterval(() => {
                this.captureFrame();
            }, this.captureIntervalMs);

            this.updateButtonStates();
            return true;

        } catch (error) {
            console.error('Failed to start screen capture:', error);
            this.isCapturing = false;
            this.isStarting = false;
            this.updateButtonStates();
            return false;
        }
    }

    stopCapture() {
        if (!this.isCapturing) {
            return;
        }

        console.log('Stopping screen capture...');

        // 1. 清除定时器
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }

        // 2. 停止所有媒体轨道
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Track ${track.kind} stopped`);
            });
            this.mediaStream = null;
        }

        // 3. 重置状态
        this.isCapturing = false;
        this.isStarting = false;

        console.log('Screen capture stopped');
        this.updateButtonStates();
    }

    captureFrame() {
        if (!this.isCapturing || !this.mediaStream) {
            return;
        }

        console.log('Frame captured at', new Date().toISOString());
    }

    getIsCapturing() {
        return this.isCapturing;
    }

    updateButtonStates() {
        const startBtn = document.getElementById('startCaptureBtn');
        const stopBtn = document.getElementById('stopCaptureBtn');

        if (startBtn) {
            // 正在启动或已在捕获中，禁用开始按钮
            startBtn.disabled = this.isStarting || this.isCapturing;
        }
        if (stopBtn) {
            stopBtn.disabled = !this.isCapturing;
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
