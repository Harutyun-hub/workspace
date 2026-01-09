class Logger {
    static LEVELS = {
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error'
    };

    static STYLES = {
        info: 'color: #2196F3; font-weight: bold; background: #E3F2FD; padding: 2px 6px; border-radius: 3px;',
        warn: 'color: #FF9800; font-weight: bold; background: #FFF3E0; padding: 2px 6px; border-radius: 3px;',
        error: 'color: #F44336; font-weight: bold; background: #FFEBEE; padding: 2px 6px; border-radius: 3px;'
    };

    static _logBuffer = [];
    static _supabaseReady = false;
    static _flushingBuffer = false;
    static _flushTimer = null;
    static _lastFlushTime = 0;
    static _persistenceDisabled = false;
    static _consecutiveFailures = 0;
    static _maxConsecutiveFailures = 3;

    static BATCH_SIZE = 20;
    static FLUSH_INTERVAL = 30000;
    static ERROR_FLUSH_DELAY = 1000;

    static markSupabaseReady() {
        if (this._supabaseReady) return;
        
        this._supabaseReady = true;
        console.log('%c[Logger]%c Supabase ready - starting batch logger...', this.STYLES.info, 'color: inherit;');
        
        this._startFlushTimer();
        this._setupUnloadHandler();
        
        if (this._logBuffer.length > 0) {
            this._scheduleFlush(100);
        }
    }

    static _startFlushTimer() {
        if (this._flushTimer) {
            clearInterval(this._flushTimer);
        }
        this._flushTimer = setInterval(() => {
            if (this._logBuffer.length > 0) {
                this._flushBuffer();
            }
        }, this.FLUSH_INTERVAL);
    }

    static _setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            if (this._logBuffer.length > 0) {
                this._flushBufferSync();
            }
        });

        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this._logBuffer.length > 0) {
                this._flushBuffer();
            }
        });
    }

    static _scheduleFlush(delay = 0) {
        setTimeout(() => this._flushBuffer(), delay);
    }

    static async _flushBuffer() {
        if (this._flushingBuffer || this._logBuffer.length === 0) return;
        
        if (this._persistenceDisabled) {
            this._logBuffer = [];
            return;
        }
        
        this._flushingBuffer = true;
        this._lastFlushTime = Date.now();
        
        const logsToFlush = this._logBuffer.splice(0, this.BATCH_SIZE);
        
        try {
            await this._batchPersistLogs(logsToFlush);
            this._consecutiveFailures = 0;
            console.log(`%c[Logger]%c Flushed ${logsToFlush.length} logs in batch`, this.STYLES.info, 'color: inherit;');
        } catch (e) {
            this._consecutiveFailures++;
            
            if (e.message && (e.message.includes('row-level security') || e.message.includes('RLS'))) {
                console.warn('[Logger] RLS policy error - disabling remote logging to prevent interference');
                this._persistenceDisabled = true;
                this._logBuffer = [];
            } else if (this._consecutiveFailures >= this._maxConsecutiveFailures) {
                console.warn(`[Logger] ${this._consecutiveFailures} consecutive failures - disabling remote logging`);
                this._persistenceDisabled = true;
                this._logBuffer = [];
            } else {
                console.warn('[Logger] Batch flush failed:', e.message);
            }
        } finally {
            this._flushingBuffer = false;
            
            if (!this._persistenceDisabled && this._logBuffer.length >= this.BATCH_SIZE) {
                this._scheduleFlush(100);
            }
        }
    }

    static _flushBufferSync() {
        if (this._logBuffer.length === 0) return;

        try {
            const supabase = this._getSupabaseClient();
            if (!supabase) return;

            const logs = this._logBuffer.splice(0, 50).map(log => ({
                level: log.level,
                message: typeof log.message === 'string' ? log.message : JSON.stringify(log.message),
                context: log.context,
                user_id: null,
                meta: log.meta || {}
            }));

            const url = supabase.supabaseUrl + '/rest/v1/app_logs';
            const key = supabase.supabaseKey;

            navigator.sendBeacon(url, JSON.stringify(logs));
        } catch (e) {
            console.warn('[Logger] Sync flush failed:', e.message);
        }
    }

    static async _batchPersistLogs(logs) {
        const supabase = this._getSupabaseClient();
        if (!supabase) return;

        const userId = await this._getCurrentUserId();
        
        const records = logs.map(log => ({
            level: log.level,
            message: typeof log.message === 'string' ? log.message : JSON.stringify(log.message),
            context: log.context,
            user_id: userId,
            meta: log.meta || {}
        }));

        const { error } = await supabase.from('app_logs').insert(records);
        
        if (error) {
            throw error;
        }
    }

    static _getSupabaseClient() {
        try {
            if (typeof SupabaseManager !== 'undefined' && SupabaseManager.isInitialized()) {
                return SupabaseManager.getClient();
            }
            if (typeof getSupabase === 'function') {
                return getSupabase();
            }
        } catch (e) {
        }
        return null;
    }

    static async _getCurrentUserId() {
        try {
            const supabase = this._getSupabaseClient();
            if (supabase) {
                const { data: { user } } = await supabase.auth.getUser();
                return user?.id || null;
            }
        } catch (e) {
        }
        return null;
    }

    static async _persistLogDirect(level, message, context = null, meta = null) {
        const supabase = this._getSupabaseClient();
        if (supabase) {
            const userId = await this._getCurrentUserId();
            
            await supabase.from('app_logs').insert({
                level,
                message: typeof message === 'string' ? message : JSON.stringify(message),
                context,
                user_id: userId,
                meta: meta || {}
            });
        }
    }

    static _addToBuffer(level, message, context = null, meta = null) {
        this._logBuffer.push({ 
            level, 
            message, 
            context, 
            meta, 
            timestamp: Date.now() 
        });

        if (this._logBuffer.length >= this.BATCH_SIZE && this._supabaseReady) {
            this._scheduleFlush(0);
        }
    }

    static async _persistLog(level, message, context = null, meta = null) {
        if (!this._supabaseReady) {
            this._addToBuffer(level, message, context, meta);
            return;
        }

        if (level === this.LEVELS.ERROR) {
            try {
                await this._persistLogDirect(level, message, context, meta);
            } catch (e) {
                console.warn('[Logger] Failed to persist error log:', e.message);
                this._addToBuffer(level, message, context, meta);
            }
            return;
        }

        this._addToBuffer(level, message, context, meta);
    }

    static info(message, context = null, meta = null) {
        const timestamp = new Date().toISOString();
        console.log(
            `%c[INFO]%c ${timestamp} ${context ? `[${context}]` : ''} ${message}`,
            this.STYLES.info,
            'color: inherit;'
        );
        
        this._persistLog(this.LEVELS.INFO, message, context, meta);
    }

    static warn(message, context = null, meta = null) {
        const timestamp = new Date().toISOString();
        console.warn(
            `%c[WARN]%c ${timestamp} ${context ? `[${context}]` : ''} ${message}`,
            this.STYLES.warn,
            'color: inherit;'
        );
        
        this._persistLog(this.LEVELS.WARN, message, context, meta);
    }

    static error(error, context = null, meta = null) {
        const timestamp = new Date().toISOString();
        const errorMessage = error?.message || String(error);
        const stack = error?.stack || null;
        
        console.error(
            `%c[ERROR]%c ${timestamp} ${context ? `[${context}]` : ''} ${errorMessage}`,
            this.STYLES.error,
            'color: inherit;'
        );
        
        if (stack) {
            console.error('Stack trace:', stack);
        }
        
        const errorMeta = {
            ...(meta || {}),
            stack,
            errorName: error?.name || 'Error',
            timestamp
        };
        
        this._persistLog(this.LEVELS.ERROR, errorMessage, context, errorMeta);
    }

    static getBufferSize() {
        return this._logBuffer.length;
    }

    static forceFlush() {
        if (this._supabaseReady && this._logBuffer.length > 0) {
            this._flushBuffer();
        }
    }
}
