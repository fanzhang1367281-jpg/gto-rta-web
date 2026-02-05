/**
 * WebRTC Screen Capture Module
 * Provides screen capture functionality using getDisplayMedia API
 */

class ScreenCapture {
    constructor() {
        this.mediaStream = null;
        this.captureInterval = null;
        this.isCapturing = false;
        this.captureIntervalMs = 200;
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
        console.log('Screen capture stopped');

        this.updateButtonStates();
    }

    captureFrame() {
        if (!this.isCapturing || !this.mediaStream) {
            return;
        }

        console.log('Frame captured');
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
