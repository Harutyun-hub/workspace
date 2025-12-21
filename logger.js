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

    static markSupabaseReady() {
        if (this._supabaseReady) return;
        
        this._supabaseReady = true;
        console.log('%c[Logger]%c Supabase ready - flushing log buffer...', this.STYLES.info, 'color: inherit;');
        this._flushBuffer();
    }

    static async _flushBuffer() {
        if (this._flushingBuffer || this._logBuffer.length === 0) return;
        
        this._flushingBuffer = true;
        
        const logsToFlush = [...this._logBuffer];
        this._logBuffer = [];
        
        for (const log of logsToFlush) {
            try {
                await this._persistLogDirect(log.level, log.message, log.context, log.meta);
            } catch (e) {
                console.warn('[Logger] Failed to flush buffered log:', e.message);
            }
        }
        
        this._flushingBuffer = false;
        console.log(`%c[Logger]%c Flushed ${logsToFlush.length} buffered logs`, this.STYLES.info, 'color: inherit;');
    }

    static async _getCurrentUserId() {
        try {
            if (typeof getSupabase === 'function') {
                const supabase = getSupabase();
                if (supabase) {
                    const { data: { user } } = await supabase.auth.getUser();
                    return user?.id || null;
                }
            }
        } catch (e) {
        }
        return null;
    }

    static async _persistLogDirect(level, message, context = null, meta = null) {
        if (typeof getSupabase === 'function') {
            const supabase = getSupabase();
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
    }

    static async _persistLog(level, message, context = null, meta = null) {
        if (!this._supabaseReady) {
            this._logBuffer.push({ level, message, context, meta, timestamp: Date.now() });
            return;
        }

        try {
            await this._persistLogDirect(level, message, context, meta);
        } catch (e) {
            console.warn('[Logger] Failed to persist log to database:', e.message);
        }
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
}
