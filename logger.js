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

    static async _getCurrentUserId() {
        try {
            if (typeof getSupabase === 'function') {
                const supabase = getSupabase();
                const { data: { user } } = await supabase.auth.getUser();
                return user?.id || null;
            }
        } catch (e) {
            // Silently fail - user might not be logged in
        }
        return null;
    }

    static async _persistLog(level, message, context = null, meta = null) {
        try {
            if (typeof getSupabase === 'function') {
                const supabase = getSupabase();
                const userId = await this._getCurrentUserId();
                
                await supabase.from('app_logs').insert({
                    level,
                    message: typeof message === 'string' ? message : JSON.stringify(message),
                    context,
                    user_id: userId,
                    meta: meta || {}
                });
            }
        } catch (e) {
            // Fail silently - don't crash the logger if Supabase is unavailable
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
