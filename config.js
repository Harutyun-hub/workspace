let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
let supabaseClient = null;

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        SUPABASE_URL = config.SUPABASE_URL;
        SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
        
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase configuration');
            throw new Error('Supabase configuration not found. Please check environment variables.');
        }
        
        return config;
    } catch (error) {
        console.error('Failed to load configuration:', error);
        throw error;
    }
}

async function initSupabase() {
    if (!window.supabase) {
        console.error('Supabase library not loaded');
        throw new Error('Supabase library not loaded');
    }
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        await loadConfig();
    }
    
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
    }
    
    return supabaseClient;
}

function getSupabase() {
    if (!supabaseClient) {
        throw new Error('Supabase not initialized. Call initSupabase() first.');
    }
    return supabaseClient;
}
