/**
 * HandState Extractor Module
 * 生成简化的 HandState JSON 用于策略查询
 */

class HandStateExtractor {
    constructor() {
        this.handCounter = 0;
        this.currentHandId = null;
    }

    /**
     * 生成唯一的 hand_id
     * @returns {string} hand_id
     */
    generateHandId() {
        this.handCounter++;
        const timestamp = Date.now();
        return `h_${timestamp}_${this.handCounter}`;
    }

    /**
     * 提取 HandState
     * 使用固定值: hero_pos="BTN", stack=100, pot=1.5
     * @param {Object} options - 可选的覆盖参数
     * @returns {Object} HandState JSON
     */
    extractHandState(options = {}) {
        const startTime = performance.now();
        
        // 生成新的 hand_id 或复用当前的
        if (!this.currentHandId) {
            this.currentHandId = this.generateHandId();
        }

        const handState = {
            hand_id: this.currentHandId,
            table_id: options.table_id || 'table_001',
            street: options.street || 'preflop',
            hero_pos: options.hero_pos || 'BTN',
            effective_stack_bb: options.effective_stack_bb !== undefined ? options.effective_stack_bb : 100,
            pot_bb: options.pot_bb !== undefined ? options.pot_bb : 1.5,
            action_line: options.action_line || 'FOLD_FOLD_FOLD_FOLD',
            timestamp: new Date().toISOString()
        };

        const latency = performance.now() - startTime;
        
        return {
            handState,
            latency
        };
    }

    /**
     * 开始新的一手牌
     */
    startNewHand() {
        this.currentHandId = this.generateHandId();
        return this.currentHandId;
    }

    /**
     * 获取当前 hand_id
     * @returns {string|null}
     */
    getCurrentHandId() {
        return this.currentHandId;
    }

    /**
     * 重置状态
     */
    reset() {
        this.handCounter = 0;
        this.currentHandId = null;
    }
}

// 创建全局实例
const handStateExtractor = new HandStateExtractor();

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HandStateExtractor, handStateExtractor };
}
