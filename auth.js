let currentUser = null;
let authSupabase = null;

async function initAuth() {
    authSupabase = await initSupabase();
    
    if (!authSupabase) {
        console.error('Failed to initialize Supabase');
        return null;
    }
    
    const { data: { session } } = await authSupabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await ensureUserExists(session.user);
    }
    
    authSupabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] onAuthStateChange event:', event, 'hasSession:', !!session, 'at', new Date().toISOString());
        
        if (session) {
            const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'unknown';
            console.log('[Auth] Session expires at:', expiresAt);
        }
        
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await ensureUserExists(session.user);
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('[Auth] Token refreshed successfully');
            if (session) {
                currentUser = session.user;
            }
        } else if (event === 'USER_UPDATED') {
            console.log('[Auth] User updated');
            if (session) {
                currentUser = session.user;
            }
        }
        
        if (!session && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') {
            console.warn('[Auth] Session became null unexpectedly during event:', event);
        }
    });
    
    return session;
}

async function ensureUserExists(user) {
    if (!user) return;
    
    const { data: existingUser, error: fetchError } = await authSupabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (!existingUser) {
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
            console.error('Error creating user:', insertError);
        }
    }
}

async function signInWithGoogle() {
    try {
        if (!authSupabase) {
            await initAuth();
        }
        
        if (!authSupabase) {
            throw new Error('Authentication service not available');
        }
        
        const { data, error } = await authSupabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/index.html'
            }
        });
        
        if (error) {
            console.error('Error signing in:', error);
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('Sign-in failed:', error);
        if (typeof showToast !== 'undefined') {
            showToast('Failed to sign in with Google. Please try again.', 'error');
        }
        throw error;
    }
}

async function signOut() {
    const { error } = await authSupabase.auth.signOut();
    
    if (error) {
        console.error('Error signing out:', error);
        throw error;
    }
    
    // Cleanup all chat state before navigating away
    if (typeof window.cleanupAllState === 'function') {
        window.cleanupAllState();
    } else if (typeof window.cleanupChatDropdowns === 'function') {
        window.cleanupChatDropdowns();
    }
    
    currentUser = null;
    window.location.href = '/login.html';
}

function getCurrentUser() {
    return currentUser;
}

async function requireAuth() {
    const session = await initAuth();
    
    if (!session && !window.location.pathname.includes('login.html')) {
        window.location.href = '/login.html';
        return null;
    }
    
    return session;
}
