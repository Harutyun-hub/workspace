let currentUser = null;
let authSupabase = null;
let authSettling = false;
let authInitPromise = null;
let authInitialized = false;

const AUTH_CONTEXT = 'Auth';

async function initAuth() {
    if (authInitPromise) {
        Logger.info('Auth initialization already in progress, waiting...', AUTH_CONTEXT);
        return authInitPromise;
    }
    
    if (authInitialized && authSupabase) {
        Logger.info('Auth already initialized, returning existing session', AUTH_CONTEXT);
        const { data: { session } } = await authSupabase.auth.getSession();
        return session;
    }
    
    authInitPromise = _performAuthInit();
    
    try {
        const result = await authInitPromise;
        authInitialized = true;
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
            await ensureUserExists(session.user);
        } else {
            Logger.info('No existing session found', AUTH_CONTEXT);
        }
        
        authSupabase.auth.onAuthStateChange(async (event, session) => {
            Logger.info(`Auth state change: ${event}`, AUTH_CONTEXT, {
                hasSession: !!session,
                timestamp: new Date().toISOString()
            });
            
            if (session) {
                const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown';
                Logger.info(`Session expires at: ${expiresAt}`, AUTH_CONTEXT);
            }
            
            if (event === 'SIGNED_IN' && session) {
                Logger.info('User signed in successfully', AUTH_CONTEXT, { userId: session.user?.id });
                currentUser = session.user;
                await ensureUserExists(session.user);
            } else if (event === 'SIGNED_OUT') {
                Logger.info('User signed out', AUTH_CONTEXT);
                currentUser = null;
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
            }
            
            if (!session && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') {
                Logger.warn(`Session became null unexpectedly during event: ${event}`, AUTH_CONTEXT);
            }
            
            if (authSettling) {
                Logger.info(`Auth state settled after event: ${event}`, AUTH_CONTEXT);
                authSettling = false;
            }
        });
        
        Logger.info('Auth initialization complete', AUTH_CONTEXT, { hasSession: !!session });
        return session;
        
    } catch (error) {
        Logger.error(error, AUTH_CONTEXT, { operation: 'initAuth' });
        return null;
    }
}

function markAuthSettling() {
    authSettling = true;
    Logger.info('Marked auth as settling (visibility change)', AUTH_CONTEXT);
}

async function waitForAuthReady() {
    if (!authSettling) {
        return true;
    }
    
    Logger.info('Waiting for auth to settle...', AUTH_CONTEXT);
    
    const maxWait = 2000;
    const checkInterval = 100;
    let waited = 0;
    
    while (authSettling && waited < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
    }
    
    if (authSettling) {
        Logger.warn('Auth did not settle in time, forcing ready', AUTH_CONTEXT, { waitedMs: waited });
        authSettling = false;
    } else {
        Logger.info(`Auth settled after ${waited}ms`, AUTH_CONTEXT);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return true;
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

async function requireAuth() {
    Logger.info('Checking authentication requirement...', AUTH_CONTEXT);
    
    const session = await initAuth();
    
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
    waitForReady: waitForAuthReady,
    markSettling: markAuthSettling,
    ensureValidSession: ensureValidSession,
    requireAuth: requireAuth
};
