const DB_CONTEXT = 'Database';
let dbRequestCounter = 0;

const CACHE_TTL = {
    CONVERSATIONS: 30 * 1000,
    MESSAGES: 60 * 1000,
    USER_DATA: 120 * 1000
};

function generateRequestId() {
    return `req_${++dbRequestCounter}_${Date.now()}`;
}

function withTimeout(promise, timeoutMs, requestId, operationName) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`[${requestId}] ${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

function createSuccessResult(data, fromCache = false) {
    return { success: true, data, error: null, fromCache };
}

function createErrorResult(error) {
    const errorMessage = error?.message || String(error);
    return { 
        success: false, 
        data: null, 
        error: {
            message: errorMessage,
            code: error?.code || 'UNKNOWN',
            details: error?.details || null
        }
    };
}

function invalidateConversationCache(conversationId = null, userId = null) {
    if (typeof QueryCache !== 'undefined') {
        if (conversationId) {
            QueryCache.invalidate(`conversations:${conversationId}`);
            QueryCache.invalidate(`messages:${conversationId}`);
        }
        if (userId) {
            QueryCache.invalidate(`user_conversations:${userId}`);
        }
    }
}

async function createConversation(userId, title = null, sessionId = null) {
    const requestId = generateRequestId();
    Logger.info(`Creating conversation for user: ${userId}`, DB_CONTEXT, { requestId });
    
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('conversations')
            .insert([{
                user_id: userId,
                title: title,
                session_id: sessionId
            }])
            .select()
            .single();
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'createConversation', requestId, userId });
            return createErrorResult(error);
        }
        
        invalidateConversationCache(null, userId);
        
        Logger.info(`Conversation created: ${data.id}`, DB_CONTEXT, { requestId });
        return createSuccessResult(data);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'createConversation', requestId, userId });
        return createErrorResult(err);
    }
}

async function getUserConversations(userId, limit = 50) {
    const requestId = generateRequestId();
    const cacheKey = `user_conversations:${userId}:${limit}`;
    
    if (typeof QueryCache !== 'undefined') {
        const cached = QueryCache.get(cacheKey, true);
        if (cached) {
            Logger.info(`Cache hit for user conversations`, DB_CONTEXT, { requestId, userId, fromCache: true });
            return createSuccessResult(cached, true);
        }
    }
    
    Logger.info(`Getting conversations for user: ${userId}`, DB_CONTEXT, { requestId, limit });
    
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(limit);
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'getUserConversations', requestId, userId });
            return createErrorResult(error);
        }
        
        const conversations = data || [];
        
        if (typeof QueryCache !== 'undefined') {
            QueryCache.set(cacheKey, conversations, { memoryTtl: CACHE_TTL.CONVERSATIONS, persist: true });
        }
        
        Logger.info(`Retrieved ${conversations.length} conversations`, DB_CONTEXT, { requestId });
        return createSuccessResult(conversations);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'getUserConversations', requestId, userId });
        return createErrorResult(err);
    }
}

async function getConversation(conversationId) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const cacheKey = `conversations:${conversationId}`;
    
    if (typeof QueryCache !== 'undefined') {
        const cached = QueryCache.get(cacheKey, true);
        if (cached) {
            Logger.info(`Cache hit for conversation`, DB_CONTEXT, { requestId, conversationId, fromCache: true });
            return createSuccessResult(cached, true);
        }
    }
    
    Logger.info(`Getting conversation: ${conversationId}`, DB_CONTEXT, { requestId });
    
    try {
        const supabase = getSupabase();
        
        const queryPromise = supabase
            .from('conversations')
            .select('*')
            .eq('id', conversationId)
            .single();
        
        const result = await withTimeout(queryPromise, 5000, requestId, 'getConversation');
        const { data, error, status, statusText } = result;
        const elapsed = Date.now() - startTime;
        
        Logger.info(`getConversation response`, DB_CONTEXT, {
            requestId,
            hasData: !!data,
            status,
            statusText,
            elapsedMs: elapsed
        });
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'getConversation', requestId, conversationId });
            return createErrorResult(error);
        }
        
        if (typeof QueryCache !== 'undefined' && data) {
            QueryCache.set(cacheKey, data, { memoryTtl: CACHE_TTL.CONVERSATIONS, persist: true });
        }
        
        return createSuccessResult(data);
        
    } catch (err) {
        const elapsed = Date.now() - startTime;
        Logger.error(err, DB_CONTEXT, { operation: 'getConversation', requestId, conversationId, elapsedMs: elapsed });
        return createErrorResult(err);
    }
}

async function updateConversationTitle(conversationId, title) {
    const requestId = generateRequestId();
    Logger.info(`Updating conversation title`, DB_CONTEXT, { requestId, conversationId, title });
    
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('conversations')
            .update({ title: title })
            .eq('id', conversationId)
            .select()
            .single();
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'updateConversationTitle', requestId, conversationId });
            return createErrorResult(error);
        }
        
        Logger.info('Title updated successfully', DB_CONTEXT, { requestId });
        return createSuccessResult(data);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'updateConversationTitle', requestId, conversationId });
        return createErrorResult(err);
    }
}

async function deleteConversation(conversationId, userId = null) {
    const requestId = generateRequestId();
    Logger.info(`Deleting conversation: ${conversationId}`, DB_CONTEXT, { requestId, userId });
    
    try {
        const supabase = getSupabase();
        
        let ownerId = userId;
        if (!ownerId) {
            const { data: conv } = await supabase
                .from('conversations')
                .select('user_id')
                .eq('id', conversationId)
                .single();
            ownerId = conv?.user_id || null;
        }
        
        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId);
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'deleteConversation', requestId, conversationId });
            return createErrorResult(error);
        }
        
        invalidateConversationCache(conversationId, ownerId);
        
        Logger.info('Conversation deleted successfully', DB_CONTEXT, { requestId, ownerId });
        return createSuccessResult(true);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'deleteConversation', requestId, conversationId });
        return createErrorResult(err);
    }
}

async function saveMessageToSupabase(conversationId, userId, role, content) {
    const requestId = generateRequestId();
    Logger.info(`Saving message`, DB_CONTEXT, { 
        requestId, 
        conversationId, 
        role, 
        contentLength: content?.length 
    });
    
    try {
        const supabase = getSupabase();
        
        let contentToSave = content;
        if (typeof content === 'object' && content !== null) {
            contentToSave = JSON.stringify(content);
        }
        
        const { data, error } = await supabase
            .from('messages')
            .insert([{
                conversation_id: conversationId,
                user_id: userId,
                role: role,
                content: contentToSave
            }])
            .select()
            .single();
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'saveMessageToSupabase', requestId, conversationId });
            return createErrorResult(error);
        }
        
        Logger.info(`Message saved: ${data.id}`, DB_CONTEXT, { requestId });
        
        invalidateConversationCache(conversationId, userId);
        
        supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
            .then(() => Logger.info('Conversation timestamp updated', DB_CONTEXT, { requestId }))
            .catch(err => Logger.warn('Failed to update conversation timestamp', DB_CONTEXT, { 
                requestId, 
                error: err.message 
            }));
        
        return createSuccessResult(data);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'saveMessageToSupabase', requestId, conversationId });
        return createErrorResult(err);
    }
}

async function loadMessagesFromSupabase(conversationId) {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const cacheKey = `messages:${conversationId}`;
    
    console.log(`[DEBUG] loadMessagesFromSupabase called with conversationId: ${conversationId}`);
    
    if (typeof QueryCache !== 'undefined') {
        const cached = QueryCache.get(cacheKey, false);
        if (cached) {
            console.log(`[DEBUG] Cache HIT for ${conversationId}, returning ${cached.length} messages`);
            Logger.info(`Cache hit for messages`, DB_CONTEXT, { requestId, conversationId, count: cached.length, fromCache: true });
            return createSuccessResult(cached, true);
        }
    }
    
    console.log(`[DEBUG] Cache MISS for ${conversationId}, fetching from Supabase...`);
    Logger.info(`Loading messages for conversation: ${conversationId}`, DB_CONTEXT, { requestId });
    
    try {
        const supabase = getSupabase();
        
        const queryPromise = supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        
        const result = await withTimeout(queryPromise, 5000, requestId, 'loadMessagesFromSupabase');
        const { data, error, status, statusText } = result;
        const elapsed = Date.now() - startTime;
        
        console.log(`[DEBUG] Supabase returned ${(data || []).length} messages for ${conversationId} in ${elapsed}ms`);
        Logger.info(`loadMessagesFromSupabase response`, DB_CONTEXT, {
            requestId,
            hasData: !!data,
            count: (data || []).length,
            status,
            statusText,
            elapsedMs: elapsed
        });
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'loadMessagesFromSupabase', requestId, conversationId });
            return createErrorResult(error);
        }
        
        const messages = (data || []).map(msg => {
            let content = msg.content;
            
            if (typeof content === 'string' && content.trim().startsWith('{')) {
                try {
                    content = JSON.parse(content);
                } catch (e) {
                    Logger.warn('Failed to parse message content as JSON', DB_CONTEXT, { requestId, messageId: msg.id });
                }
            }
            
            return {
                ...msg,
                content: content
            };
        });
        
        if (typeof QueryCache !== 'undefined') {
            QueryCache.set(cacheKey, messages, { memoryTtl: CACHE_TTL.MESSAGES, persist: false });
        }
        
        return createSuccessResult(messages);
        
    } catch (err) {
        const elapsed = Date.now() - startTime;
        Logger.error(err, DB_CONTEXT, { operation: 'loadMessagesFromSupabase', requestId, conversationId, elapsedMs: elapsed });
        return createErrorResult(err);
    }
}

async function deleteAllUserConversations(userId) {
    const requestId = generateRequestId();
    Logger.info(`Deleting all conversations for user: ${userId}`, DB_CONTEXT, { requestId });
    
    try {
        const supabase = getSupabase();
        
        const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('user_id', userId);
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'deleteAllUserConversations', requestId, userId });
            return createErrorResult(error);
        }
        
        Logger.info('All user conversations deleted', DB_CONTEXT, { requestId });
        return createSuccessResult(true);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'deleteAllUserConversations', requestId, userId });
        return createErrorResult(err);
    }
}

async function getMessageCount(conversationId) {
    const requestId = generateRequestId();
    Logger.info(`Getting message count for conversation: ${conversationId}`, DB_CONTEXT, { requestId });
    
    try {
        const supabase = getSupabase();
        
        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId);
        
        if (error) {
            Logger.error(error, DB_CONTEXT, { operation: 'getMessageCount', requestId, conversationId });
            return createErrorResult(error);
        }
        
        Logger.info(`Message count: ${count || 0}`, DB_CONTEXT, { requestId });
        return createSuccessResult(count || 0);
        
    } catch (err) {
        Logger.error(err, DB_CONTEXT, { operation: 'getMessageCount', requestId, conversationId });
        return createErrorResult(err);
    }
}
