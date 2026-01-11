const SupabaseManager = (function() {
    'use strict';
    
    const MANAGER_CONTEXT = 'SupabaseManager';
    const CONFIG_CACHE_KEY = 'supabase_config_cache';
    const SESSION_CACHE_KEY = 'supabase_session_cache';
    const CONFIG_CACHE_TTL = 24 * 60 * 60 * 1000;
    
    let _instance = null;
    let _client = null;
    let _initPromise = null;
    let _config = null;
    let _initialized = false;
    let _initStartTime = null;
    
    const noOpLock = async (name, acquireTimeout, fn) => {
        return await fn();
    };

    function log(message, meta = null) {
        const timestamp = new Date().toISOString();
        console.log(
            `%c[INFO]%c ${timestamp} [${MANAGER_CONTEXT}] ${message}`,
            'color: #2196F3; font-weight: bold; background: #E3F2FD; padding: 2px 6px; border-radius: 3px;',
            'color: inherit;'
        );
        if (meta) console.log('  Meta:', meta);
    }

    function warn(message) {
        const timestamp = new Date().toISOString();
        console.warn(
            `%c[WARN]%c ${timestamp} [${MANAGER_CONTEXT}] ${message}`,
            'color: #FF9800; font-weight: bold; background: #FFF3E0; padding: 2px 6px; border-radius: 3px;',
            'color: inherit;'
        );
    }

    function getCachedConfig() {
        try {
            const cached = localStorage.getItem(CONFIG_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.timestamp && (Date.now() - parsed.timestamp) < CONFIG_CACHE_TTL) {
                    return parsed.config;
                }
            }
        } catch (e) {
            warn('Failed to read config cache: ' + e.message);
        }
        return null;
    }

    function setCachedConfig(config) {
        try {
            localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
                config: config,
                timestamp: Date.now()
            }));
        } catch (e) {
            warn('Failed to cache config: ' + e.message);
        }
    }

    function getEmbeddedConfig() {
        if (window.__SUPABASE_CONFIG__) {
            return window.__SUPABASE_CONFIG__;
        }
        return null;
    }

    async function fetchConfig() {
        const embeddedConfig = getEmbeddedConfig();
        if (embeddedConfig && embeddedConfig.url && embeddedConfig.anonKey) {
            log('Using embedded config (zero latency)');
            return embeddedConfig;
        }

        const cachedConfig = getCachedConfig();
        if (cachedConfig && cachedConfig.url && cachedConfig.anonKey) {
            log('Using cached config (instant)');
            return cachedConfig;
        }

        log('Fetching config from /api/config...');
        const startTime = Date.now();
        
        try {
            const response = await fetch('/api/config');
            const data = await response.json();
            const elapsed = Date.now() - startTime;
            
            const config = {
                url: data.SUPABASE_URL,
                anonKey: data.SUPABASE_ANON_KEY
            };
            
            log(`Config fetched in ${elapsed}ms`);
            setCachedConfig(config);
            
            return config;
        } catch (error) {
            warn('Failed to fetch config: ' + error.message);
            throw error;
        }
    }

    async function initialize() {
        if (_initialized && _client) {
            return _client;
        }

        if (_initPromise) {
            return _initPromise;
        }

        _initStartTime = Date.now();
        log('Initializing Supabase client...');

        _initPromise = (async () => {
            try {
                if (!window.supabase) {
                    throw new Error('Supabase library not loaded');
                }

                _config = await fetchConfig();
                
                if (!_config.url || !_config.anonKey) {
                    throw new Error('Missing Supabase configuration');
                }

                _client = window.supabase.createClient(_config.url, _config.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,  // Enable OAuth token detection from URL
                        storage: window.localStorage,
                        lock: noOpLock
                    },
                    global: {
                        headers: {
                            'x-client-info': 'supabase-manager/1.0'
                        }
                    }
                });

                _initialized = true;
                const elapsed = Date.now() - _initStartTime;
                log(`Supabase client initialized in ${elapsed}ms`);

                return _client;
            } catch (error) {
                warn('Initialization failed: ' + error.message);
                _initPromise = null;
                throw error;
            }
        })();

        return _initPromise;
    }

    function getClient() {
        if (!_client) {
            throw new Error('SupabaseManager not initialized. Call initialize() first.');
        }
        return _client;
    }

    function isInitialized() {
        return _initialized && _client !== null;
    }

    async function getSession() {
        const client = await initialize();
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
            warn('Failed to get session: ' + error.message);
            return null;
        }
        return session;
    }

    async function getUser() {
        const session = await getSession();
        return session?.user || null;
    }

    function onAuthStateChange(callback) {
        if (!_client) {
            warn('Cannot subscribe to auth changes before initialization');
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
        return _client.auth.onAuthStateChange(callback);
    }

    function getInitTime() {
        return _initStartTime ? Date.now() - _initStartTime : 0;
    }

    function clearCache() {
        try {
            localStorage.removeItem(CONFIG_CACHE_KEY);
            localStorage.removeItem(SESSION_CACHE_KEY);
            log('Cache cleared');
        } catch (e) {
            warn('Failed to clear cache: ' + e.message);
        }
    }

    async function reinitialize() {
        log('Force reinitializing Supabase client (deadlock recovery)...');
        
        try {
            if (_client) {
                try {
                    await _client.auth.signOut({ scope: 'local' });
                } catch (e) {
                    warn('SignOut during reinit failed (expected): ' + e.message);
                }
            }
        } catch (e) {
            warn('Client cleanup failed: ' + e.message);
        }
        
        _client = null;
        _initPromise = null;
        _initialized = false;
        _config = null;
        
        clearCache();
        
        log('State cleared, creating fresh client...');
        
        return await initialize();
    }

    return {
        initialize,
        reinitialize,
        getClient,
        isInitialized,
        getSession,
        getUser,
        onAuthStateChange,
        getInitTime,
        clearCache,
        
        get client() {
            return _client;
        }
    };
})();

if (typeof window !== 'undefined') {
    window.SupabaseManager = SupabaseManager;
}
