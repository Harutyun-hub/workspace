const PendingMessageQueue = (function() {
    'use strict';
    
    const QUEUE_KEY = 'pending_messages_queue';
    const CONTEXT = 'MessageQueue';
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30000;
    const SAVE_TIMEOUT_MS = 60000;
    
    let isProcessing = false;
    let flushTimer = null;
    let memoryQueue = [];
    let storageAvailable = true;
    
    // Callback registry for message save confirmations
    // Key: conversationId, Value: { callback, requiredCount, savedCount }
    const saveCallbacks = new Map();
    
    // Event emitter for queue flush events
    function emitQueueFlush(conversationId) {
        if (typeof window !== 'undefined') {
            const event = new CustomEvent('messageQueueFlush', { 
                detail: { conversationId } 
            });
            window.dispatchEvent(event);
        }
    }

    function checkStorageAvailable() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    function getQueue() {
        if (!storageAvailable) {
            return [...memoryQueue];
        }
        try {
            const stored = localStorage.getItem(QUEUE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.warn('[MessageQueue] Failed to read queue:', e.message);
            return [...memoryQueue];
        }
    }

    function saveQueue(queue) {
        if (!storageAvailable) {
            memoryQueue = queue;
            return true;
        }
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            return true;
        } catch (e) {
            console.warn('[MessageQueue] Failed to save queue, using memory fallback:', e.message);
            storageAvailable = false;
            memoryQueue = queue;
            return false;
        }
    }

    function withTimeout(promise, timeoutMs) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        
        return Promise.race([promise, timeoutPromise]).finally(() => {
            clearTimeout(timeoutId);
        });
    }

    function enqueue(message) {
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

        const queue = getQueue();
        queue.push(entry);
        const saved = saveQueue(queue);
        
        if (typeof Logger !== 'undefined') {
            Logger.info(`Message queued: ${entry.id}`, CONTEXT, { 
                queueSize: queue.length,
                storageType: storageAvailable ? 'localStorage' : 'memory'
            });
        }
        
        if (!saved && !storageAvailable) {
            processMessageDirect(entry);
        }
        
        scheduleFlush();
        return entry.id;
    }

    async function processMessageDirect(entry) {
        try {
            if (typeof saveMessageToSupabase !== 'undefined') {
                const result = await withTimeout(
                    saveMessageToSupabase(
                        entry.conversationId,
                        entry.userId,
                        entry.role,
                        entry.content
                    ),
                    SAVE_TIMEOUT_MS
                );
                if (result.success) {
                    const queue = getQueue();
                    const filtered = queue.filter(m => m.id !== entry.id);
                    saveQueue(filtered);
                    
                    // Trigger callback for this conversation (same as processMessage)
                    triggerSaveCallback(entry.conversationId);
                    
                    // Emit event for any listeners (e.g., title reconciliation)
                    emitQueueFlush(entry.conversationId);
                }
            }
        } catch (e) {
            console.warn('[MessageQueue] Direct save failed:', e.message);
        }
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

    /**
     * Register a callback to be called when messages for a conversation are saved.
     * The callback is invoked once requiredCount messages have been saved.
     * @param {string} conversationId - The conversation ID to watch
     * @param {number} requiredCount - Number of saves required before triggering callback
     * @param {Function} callback - Function to call when saves complete
     * @param {number} timeoutMs - Max time to wait before auto-cleanup (default 60s)
     */
    function registerSaveCallback(conversationId, requiredCount, callback, timeoutMs = 60000) {
        saveCallbacks.set(conversationId, {
            callback,
            requiredCount,
            savedCount: 0,
            createdAt: Date.now()
        });
        
        if (typeof Logger !== 'undefined') {
            Logger.info(`Registered save callback for ${conversationId}, waiting for ${requiredCount} saves`, CONTEXT);
        }
        
        // Auto-cleanup after timeout to prevent memory leaks
        setTimeout(() => {
            if (saveCallbacks.has(conversationId)) {
                const entry = saveCallbacks.get(conversationId);
                if (entry.savedCount < entry.requiredCount) {
                    if (typeof Logger !== 'undefined') {
                        Logger.warn(`Save callback timed out for ${conversationId} (${entry.savedCount}/${entry.requiredCount} saves)`, CONTEXT);
                    }
                }
                saveCallbacks.delete(conversationId);
            }
        }, timeoutMs);
    }

    /**
     * Trigger the save callback for a conversation if conditions are met.
     * @param {string} conversationId - The conversation ID
     */
    function triggerSaveCallback(conversationId) {
        if (!saveCallbacks.has(conversationId)) {
            return;
        }
        
        const entry = saveCallbacks.get(conversationId);
        entry.savedCount++;
        
        if (typeof Logger !== 'undefined') {
            Logger.info(`Save callback progress: ${entry.savedCount}/${entry.requiredCount} for ${conversationId}`, CONTEXT);
        }
        
        if (entry.savedCount >= entry.requiredCount) {
            // Invoke the callback
            try {
                entry.callback();
                if (typeof Logger !== 'undefined') {
                    Logger.info(`Save callback triggered for ${conversationId}`, CONTEXT);
                }
            } catch (e) {
                console.error('[MessageQueue] Save callback error:', e);
            }
            
            // Clean up
            saveCallbacks.delete(conversationId);
        }
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

            const result = await withTimeout(
                saveMessageToSupabase(
                    entry.conversationId,
                    entry.userId,
                    entry.role,
                    entry.content
                ),
                SAVE_TIMEOUT_MS
            );

            if (result.success) {
                updateAttempt(entry.id, true);
                if (typeof Logger !== 'undefined') {
                    Logger.info(`Message synced: ${entry.id}`, CONTEXT);
                }
                
                // Trigger callback if registered for this conversation
                triggerSaveCallback(entry.conversationId);
                
                // Emit event for any listeners (e.g., title reconciliation)
                emitQueueFlush(entry.conversationId);
                
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

        try {
            for (const entry of pending) {
                const result = await processMessage(entry);
                if (result === null) {
                    continue;
                }
            }
        } catch (e) {
            console.error('[MessageQueue] Flush error:', e);
        } finally {
            isProcessing = false;
        }
        
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
            flush().catch(e => {
                console.error('[MessageQueue] Flush error:', e);
                isProcessing = false;
            });
        }, delay);
    }

    function init() {
        storageAvailable = checkStorageAvailable();
        
        if (!storageAvailable && typeof Logger !== 'undefined') {
            Logger.warn('localStorage not available, using memory queue', CONTEXT);
        }

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
            Logger.info(`Initialized with ${queue.length} pending messages`, CONTEXT, {
                storageType: storageAvailable ? 'localStorage' : 'memory'
            });
        }
    }

    function getStats() {
        const queue = getQueue();
        return {
            total: queue.length,
            pending: queue.filter(m => m.status !== 'failed' && m.attempts < MAX_RETRIES).length,
            failed: queue.filter(m => m.status === 'failed' || m.attempts >= MAX_RETRIES).length,
            storageType: storageAvailable ? 'localStorage' : 'memory'
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
        getQueue,
        registerSaveCallback
    };
})();

if (typeof window !== 'undefined') {
    window.PendingMessageQueue = PendingMessageQueue;
}
