const PendingMessageQueue = (function() {
    'use strict';
    
    const QUEUE_KEY = 'pending_messages_queue';
    const CONTEXT = 'MessageQueue';
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;
    
    let isProcessing = false;
    let flushTimer = null;

    function getQueue() {
        try {
            const stored = localStorage.getItem(QUEUE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.warn('[MessageQueue] Failed to read queue:', e.message);
            return [];
        }
    }

    function saveQueue(queue) {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.warn('[MessageQueue] Failed to save queue:', e.message);
        }
    }

    function enqueue(message) {
        const queue = getQueue();
        const entry = {
            id: message.clientMessageId,
            conversationId: message.conversationId,
            userId: message.userId,
            role: message.role,
            content: message.content,
            attempts: 0,
            createdAt: Date.now(),
            lastAttempt: null
        };
        queue.push(entry);
        saveQueue(queue);
        
        if (typeof Logger !== 'undefined') {
            Logger.info(`Message queued: ${entry.id}`, CONTEXT, { queueSize: queue.length });
        }
        
        scheduleFlush();
        return entry.id;
    }

    function removeFromQueue(messageId) {
        const queue = getQueue();
        const filtered = queue.filter(m => m.id !== messageId);
        saveQueue(filtered);
    }

    function updateAttempt(messageId, success, error = null) {
        const queue = getQueue();
        const index = queue.findIndex(m => m.id === messageId);
        
        if (index === -1) return;
        
        if (success) {
            queue.splice(index, 1);
        } else {
            queue[index].attempts++;
            queue[index].lastAttempt = Date.now();
            queue[index].lastError = error;
            
            if (queue[index].attempts >= MAX_RETRIES) {
                queue[index].status = 'failed';
                if (typeof Logger !== 'undefined') {
                    Logger.error(new Error(`Message ${messageId} failed after ${MAX_RETRIES} attempts`), CONTEXT);
                }
            }
        }
        
        saveQueue(queue);
    }

    function getBackoffDelay(attempts) {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempts), MAX_DELAY_MS);
        return delay + Math.random() * 500;
    }

    async function processMessage(entry) {
        if (entry.status === 'failed' || entry.attempts >= MAX_RETRIES) {
            return false;
        }

        const timeSinceLastAttempt = entry.lastAttempt ? Date.now() - entry.lastAttempt : Infinity;
        const requiredDelay = getBackoffDelay(entry.attempts);
        
        if (timeSinceLastAttempt < requiredDelay) {
            return null;
        }

        try {
            if (typeof saveMessageToSupabase === 'undefined') {
                throw new Error('saveMessageToSupabase not available');
            }

            const result = await saveMessageToSupabase(
                entry.conversationId,
                entry.userId,
                entry.role,
                entry.content,
                entry.id
            );

            if (result.success) {
                updateAttempt(entry.id, true);
                if (typeof Logger !== 'undefined') {
                    Logger.info(`Message synced: ${entry.id}`, CONTEXT);
                }
                return true;
            } else {
                throw new Error(result.error?.message || 'Save failed');
            }
        } catch (error) {
            updateAttempt(entry.id, false, error.message);
            if (typeof Logger !== 'undefined') {
                Logger.warn(`Message sync failed (attempt ${entry.attempts + 1}): ${entry.id}`, CONTEXT);
            }
            return false;
        }
    }

    async function flush() {
        if (isProcessing) return;
        
        const queue = getQueue();
        const pending = queue.filter(m => m.status !== 'failed' && m.attempts < MAX_RETRIES);
        
        if (pending.length === 0) return;
        
        isProcessing = true;
        
        if (typeof Logger !== 'undefined') {
            Logger.info(`Flushing ${pending.length} pending messages`, CONTEXT);
        }

        for (const entry of pending) {
            const result = await processMessage(entry);
            if (result === null) {
                continue;
            }
        }

        isProcessing = false;
        
        const remaining = getQueue().filter(m => m.status !== 'failed' && m.attempts < MAX_RETRIES);
        if (remaining.length > 0) {
            scheduleFlush(5000);
        }
    }

    function scheduleFlush(delay = 100) {
        if (flushTimer) {
            clearTimeout(flushTimer);
        }
        flushTimer = setTimeout(() => {
            flush().catch(e => console.error('[MessageQueue] Flush error:', e));
        }, delay);
    }

    function init() {
        window.addEventListener('online', () => {
            if (typeof Logger !== 'undefined') {
                Logger.info('Network online - triggering flush', CONTEXT);
            }
            scheduleFlush();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                scheduleFlush();
            }
        });

        scheduleFlush(1000);
        
        if (typeof Logger !== 'undefined') {
            const queue = getQueue();
            Logger.info(`Initialized with ${queue.length} pending messages`, CONTEXT);
        }
    }

    function getStats() {
        const queue = getQueue();
        return {
            total: queue.length,
            pending: queue.filter(m => m.status !== 'failed' && m.attempts < MAX_RETRIES).length,
            failed: queue.filter(m => m.status === 'failed' || m.attempts >= MAX_RETRIES).length
        };
    }

    function retryFailed() {
        const queue = getQueue();
        queue.forEach(m => {
            if (m.status === 'failed') {
                m.status = 'pending';
                m.attempts = 0;
            }
        });
        saveQueue(queue);
        scheduleFlush();
    }

    function clearFailed() {
        const queue = getQueue();
        const filtered = queue.filter(m => m.status !== 'failed' && m.attempts < MAX_RETRIES);
        saveQueue(filtered);
    }

    return {
        enqueue,
        flush,
        init,
        getStats,
        retryFailed,
        clearFailed,
        getQueue
    };
})();

if (typeof window !== 'undefined') {
    window.PendingMessageQueue = PendingMessageQueue;
}
