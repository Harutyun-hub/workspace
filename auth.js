let currentUser = null;
let authSupabase = null;
let authInitPromise = null;
let authInitialized = false;

const AUTH_CONTEXT = 'Auth';

// Store the last known session to avoid calling getSession() which can hang
let cachedSession = null;

// Auth state settlement tracking - resolves when auth state is determined
let authStateSettledPromise = null;
let authStateSettledResolver = null;
let authStateHasSettled = false;

async function initAuth() {
    if (authInitPromise) {
        Logger.info('Auth initialization already in progress, waiting...', AUTH_CONTEXT);
        return authInitPromise;
    }
    
    if (authInitialized && authSupabase) {
        // CRITICAL FIX: Return cached session instead of calling getSession()
        // getSession() can hang indefinitely due to Supabase deadlock bugs
        Logger.info('Auth already initialized, returning cached session', AUTH_CONTEXT);
        return cachedSession;
    }
    
    authInitPromise = _performAuthInit();
    
    try {
        const result = await authInitPromise;
        authInitialized = true;
        cachedSession = result;
        return result;
    } finally {
        authInitPromise = null;
    }
}

async function _performAuthInit() {
    Logger.info('Starting auth initialization...', AUTH_CONTEXT);
    
    try {
        authSupabase = await initSupabase();
        
        if (!authSupabase) {
            Logger.error(new Error('Failed to initialize Supabase client'), AUTH_CONTEXT);
            return null;
        }
        
        Logger.info('Supabase client initialized successfully', AUTH_CONTEXT);
        
        // Mark logger as ready to flush buffered logs
        if (typeof Logger !== 'undefined' && Logger.markSupabaseReady) {
            Logger.markSupabaseReady();
        }
        
        const { data: { session }, error } = await authSupabase.auth.getSession();
        
        if (error) {
            Logger.error(error, AUTH_CONTEXT, { operation: 'getSession' });
            return null;
        }
        
        if (session) {
            Logger.info('Existing session found', AUTH_CONTEXT, { 
                userId: session.user?.id,
                expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown'
            });
            currentUser = session.user;
            // CRITICAL FIX: Defer ensureUserExists to avoid blocking auth init
            // This prevents deadlocks per GitHub Issue #762
            setTimeout(() => {
                ensureUserExists(session.user).catch(err => 
                    Logger.error(err, AUTH_CONTEXT, { operation: 'deferred-ensureUserExists' })
                );
            }, 0);
        } else {
            Logger.info('No existing session found', AUTH_CONTEXT);
        }
        
        // CRITICAL FIX: onAuthStateChange callback must be SYNCHRONOUS
        // Using async/await inside causes deadlocks where all subsequent 
        // getSession() calls hang forever (GitHub Issue #762)
        // Solution: Use setTimeout(..., 0) to defer async work
        authSupabase.auth.onAuthStateChange((event, session) => {
            Logger.info(`Auth state change: ${event}`, AUTH_CONTEXT, {
                hasSession: !!session,
                timestamp: new Date().toISOString()
            });
            
            if (session) {
                const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown';
                Logger.info(`Session expires at: ${expiresAt}`, AUTH_CONTEXT);
            }
            
            // Always update cached session when we get a new one
            if (session) {
                cachedSession = session;
            }
            
            if (event === 'SIGNED_IN' && session) {
                Logger.info('User signed in successfully', AUTH_CONTEXT, { userId: session.user?.id });
                currentUser = session.user;
                
                // OAUTH FIX: Resolve auth state promise on successful sign-in
                // This allows requireAuth() to wait for OAuth completion
                if (authStateSettledResolver) {
                    Logger.info('Resolving auth state promise (SIGNED_IN)', AUTH_CONTEXT);
                    authStateSettledResolver(session);
                    authStateHasSettled = true;
                }
                
                // Defer async work to prevent deadlock
                setTimeout(() => {
                    ensureUserExists(session.user).catch(err => 
                        Logger.error(err, AUTH_CONTEXT, { operation: 'onAuthStateChange-ensureUserExists' })
                    );
                }, 0);
            } else if (event === 'SIGNED_OUT') {
                Logger.info('User signed out', AUTH_CONTEXT);
                currentUser = null;
                cachedSession = null;
                // Also settle on sign out
                if (authStateSettledResolver) {
                    authStateSettledResolver(null);
                    authStateHasSettled = true;
                }
            } else if (event === 'TOKEN_REFRESHED') {
                Logger.info('Token refreshed successfully', AUTH_CONTEXT);
                if (session) {
                    currentUser = session.user;
                }
            } else if (event === 'USER_UPDATED') {
                Logger.info('User data updated', AUTH_CONTEXT);
                if (session) {
                    currentUser = session.user;
                }
            } else if (event === 'INITIAL_SESSION') {
                // INITIAL_SESSION fires when Supabase finishes checking for existing session
                // This includes after OAuth token exchange
                if (authStateSettledResolver) {
                    Logger.info('Resolving auth state promise (INITIAL_SESSION)', AUTH_CONTEXT);
                    authStateSettledResolver(session);
                    authStateHasSettled = true;
                }
            }
            
            if (!session && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') {
                Logger.warn(`Session became null unexpectedly during event: ${event}`, AUTH_CONTEXT);
            }
        });
        
        Logger.info('Auth initialization complete', AUTH_CONTEXT, { hasSession: !!session });
        return session;
        
    } catch (error) {
        Logger.error(error, AUTH_CONTEXT, { operation: 'initAuth' });
        return null;
    }
}

function onVisibilityChange() {
    // Fire-and-forget session refresh - NO await, NO blocking
    // This wakes up Supabase to refresh tokens in the background
    if (authSupabase) {
        authSupabase.auth.getSession().catch(() => {});
        Logger.info('Tab visible - triggered background session refresh', AUTH_CONTEXT);
    }
}

/**
 * Ensures the connection is ready before heavy database operations.
 * SIMPLIFIED: Only does a lightweight ping - avoids getSession() which can hang
 * due to Supabase deadlock bugs (GitHub Issues #762, #1594, #35754)
 * 
 * @param {number} timeoutMs - Maximum time to wait (default 3000ms)
 * @returns {Promise<{ready: boolean, session: object|null, error: string|null}>}
 */
async function ensureConnectionReady(timeoutMs = 3000) {
    const startTime = Date.now();
    Logger.info('Connection warm-up starting (ping-only mode)...', AUTH_CONTEXT);
    
    if (!authSupabase) {
        Logger.warn('ensureConnectionReady: No Supabase client available', AUTH_CONTEXT);
        return { ready: false, session: null, error: 'No Supabase client' };
    }
    
    // Get cached user without calling getSession (which can hang)
    const user = currentUser;
    if (!user) {
        Logger.warn('ensureConnectionReady: No cached user, skipping ping', AUTH_CONTEXT);
        // Return ready=false so callers can decide how to handle
        return { ready: false, session: null, error: 'No cached user' };
    }
    
    let timeoutId = null;
    
    try {
        // Create a promise that rejects on timeout
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Connection warm-up timeout'));
            }, timeoutMs);
        });
        
        // Simple ping query - no getSession() call (avoids deadlock)
        const pingPromise = (async () => {
            Logger.info('Warm-up: Pinging database...', AUTH_CONTEXT);
            const pingStart = Date.now();
            
            const { error: pingError } = await authSupabase
                .from('users')
                .select('id')
                .eq('id', user.id)
                .single();
            
            const pingDuration = Date.now() - pingStart;
            
            if (pingError && pingError.code !== 'PGRST116') {
                Logger.warn('Warm-up ping failed', AUTH_CONTEXT, { 
                    error: pingError.message,
                    duration: pingDuration 
                });
                return { ready: false, session: cachedSession, error: pingError.message };
            }
            
            Logger.info(`Warm-up ping SUCCESS in ${pingDuration}ms`, AUTH_CONTEXT);
            return { ready: true, session: cachedSession, error: null };
        })();
        
        const result = await Promise.race([pingPromise, timeoutPromise]);
        
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        const totalDuration = Date.now() - startTime;
        Logger.info(`Connection warm-up complete in ${totalDuration}ms`, AUTH_CONTEXT);
        
        return result;
        
    } catch (error) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        
        const duration = Date.now() - startTime;
        
        if (error.message === 'Connection warm-up timeout') {
            Logger.warn(`Connection warm-up TIMEOUT after ${duration}ms`, AUTH_CONTEXT);
            return { ready: false, session: cachedSession, error: 'Timeout - connection may be stale' };
        }
        
        Logger.error(error, AUTH_CONTEXT, { operation: 'ensureConnectionReady', duration });
        return { ready: false, session: cachedSession, error: error.message };
    }
}

async function ensureValidSession() {
    if (!authSupabase) {
        Logger.warn('ensureValidSession: No Supabase client', AUTH_CONTEXT);
        return null;
    }
    
    try {
        const { data: { session }, error } = await authSupabase.auth.getSession();
        
        if (error) {
            Logger.error(error, AUTH_CONTEXT, { operation: 'ensureValidSession' });
            return null;
        }
        
        if (!session) {
            Logger.warn('ensureValidSession: No active session', AUTH_CONTEXT);
            return null;
        }
        
        Logger.info('Session validated', AUTH_CONTEXT, { 
            expiresAt: new Date(session.expires_at * 1000).toISOString() 
        });
        return session;
    } catch (err) {
        Logger.error(err, AUTH_CONTEXT, { operation: 'ensureValidSession' });
        return null;
    }
}

async function ensureUserExists(user) {
    if (!user) return;
    
    try {
        Logger.info('Checking if user exists in database...', AUTH_CONTEXT, { userId: user.id });
        
        const { data: existingUser, error: fetchError } = await authSupabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
            Logger.warn('Error fetching user record', AUTH_CONTEXT, { error: fetchError.message });
        }
        
        if (!existingUser) {
            Logger.info('Creating new user record...', AUTH_CONTEXT, { userId: user.id });
            
            const { error: insertError } = await authSupabase
                .from('users')
                .insert([{
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                    avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
                    google_id: user.user_metadata?.sub || ''
                }]);
            
            if (insertError) {
                Logger.error(insertError, AUTH_CONTEXT, { operation: 'createUser', userId: user.id });
            } else {
                Logger.info('User record created successfully', AUTH_CONTEXT, { userId: user.id });
            }
        } else {
            Logger.info('User record already exists', AUTH_CONTEXT, { userId: user.id });
        }
    } catch (error) {
        Logger.error(error, AUTH_CONTEXT, { operation: 'ensureUserExists', userId: user?.id });
    }
}

async function signInWithGoogle() {
    Logger.info('Starting Google sign-in flow...', AUTH_CONTEXT);
    
    try {
        if (!authSupabase) {
            Logger.info('Supabase not initialized, initializing now...', AUTH_CONTEXT);
            await initAuth();
        }
        
        if (!authSupabase) {
            const error = new Error('Authentication service not available');
            Logger.error(error, AUTH_CONTEXT);
            throw error;
        }
        
        Logger.info('Initiating OAuth with Google provider...', AUTH_CONTEXT, { 
            redirectTo: window.location.origin + '/index.html' 
        });
        
        const { data, error } = await authSupabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/index.html'
            }
        });
        
        if (error) {
            Logger.error(error, AUTH_CONTEXT, { operation: 'signInWithOAuth', provider: 'google' });
            throw error;
        }
        
        Logger.info('OAuth initiated successfully, redirecting...', AUTH_CONTEXT);
        return data;
        
    } catch (error) {
        Logger.error(error, AUTH_CONTEXT, { operation: 'signInWithGoogle' });
        if (typeof showToast !== 'undefined') {
            showToast('Failed to sign in with Google. Please try again.', 'error');
        }
        throw error;
    }
}

async function signOut() {
    Logger.info('Starting sign-out flow...', AUTH_CONTEXT);
    
    try {
        const { error } = await authSupabase.auth.signOut();
        
        if (error) {
            Logger.error(error, AUTH_CONTEXT, { operation: 'signOut' });
            throw error;
        }
        
        Logger.info('Supabase sign-out successful', AUTH_CONTEXT);
        
        if (typeof window.cleanupAllState === 'function') {
            Logger.info('Cleaning up all state...', AUTH_CONTEXT);
            window.cleanupAllState();
        } else if (typeof window.cleanupChatDropdowns === 'function') {
            Logger.info('Cleaning up chat dropdowns...', AUTH_CONTEXT);
            window.cleanupChatDropdowns();
        }
        
        currentUser = null;
        authInitialized = false;
        
        Logger.info('Sign-out complete, redirecting to login...', AUTH_CONTEXT);
        window.location.href = '/login.html';
        
    } catch (error) {
        Logger.error(error, AUTH_CONTEXT, { operation: 'signOut' });
        throw error;
    }
}

function getCurrentUser() {
    return currentUser;
}

function isAuthInitialized() {
    return authInitialized;
}

/**
 * Waits for auth state to settle after OAuth redirect.
 * This prevents the race condition where we check session before OAuth tokens are exchanged.
 * @param {number} timeoutMs - Maximum time to wait for auth state
 * @returns {Promise<object|null>} - The session or null
 */
async function waitForAuthState(timeoutMs = 5000) {
    // If auth state already settled, return cached session
    if (authStateHasSettled) {
        Logger.info('Auth state already settled', AUTH_CONTEXT);
        return cachedSession;
    }
    
    // Check if we're coming from OAuth (tokens in URL)
    const hasOAuthTokens = window.location.hash.includes('access_token') || 
                           window.location.search.includes('code=');
    
    if (!hasOAuthTokens) {
        // No OAuth callback, no need to wait
        Logger.info('No OAuth tokens in URL, skipping wait', AUTH_CONTEXT);
        return cachedSession;
    }
    
    Logger.info('OAuth tokens detected in URL, waiting for auth state to settle...', AUTH_CONTEXT);
    
    // Create promise if not exists
    if (!authStateSettledPromise) {
        authStateSettledPromise = new Promise((resolve) => {
            authStateSettledResolver = resolve;
        });
    }
    
    // Race between auth state settling and timeout
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            Logger.warn(`Auth state wait timeout after ${timeoutMs}ms`, AUTH_CONTEXT);
            resolve(cachedSession);
        }, timeoutMs);
    });
    
    const session = await Promise.race([authStateSettledPromise, timeoutPromise]);
    Logger.info('Auth state settled', AUTH_CONTEXT, { hasSession: !!session });
    
    return session;
}

async function requireAuth() {
    Logger.info('Checking authentication requirement...', AUTH_CONTEXT);
    
    // First, initialize auth (this sets up onAuthStateChange listener)
    await initAuth();
    
    // Wait for auth state to settle (handles OAuth callback race condition)
    const session = await waitForAuthState(5000);
    
    // Update cached session if we got one from waiting
    if (session) {
        cachedSession = session;
        currentUser = session.user;
    }
    
    if (!session && !window.location.pathname.includes('login.html')) {
        Logger.warn('No session found, redirecting to login', AUTH_CONTEXT);
        window.location.href = '/login.html';
        return null;
    }
    
    Logger.info('Authentication verified', AUTH_CONTEXT, { hasSession: !!session });
    return session;
}

const Auth = {
    initialize: initAuth,
    signIn: signInWithGoogle,
    signOut: signOut,
    getCurrentUser: getCurrentUser,
    isInitialized: isAuthInitialized,
    onVisibilityChange: onVisibilityChange,
    ensureValidSession: ensureValidSession,
    ensureConnectionReady: ensureConnectionReady,
    requireAuth: requireAuth
};
