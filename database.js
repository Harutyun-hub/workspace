async function createConversation(userId, title = null, sessionId = null) {
    const supabase = getSupabase();
    console.log('[DB] Creating conversation for user:', userId);
    
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
        console.error('[DB] Error creating conversation:', error);
        throw error;
    }
    
    console.log('[DB] Conversation created:', data.id);
    return data;
}

async function getUserConversations(userId, limit = 50) {
    const supabase = getSupabase();
    console.log('[DB] getUserConversations START:', userId, 'at', new Date().toISOString());
    
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error('[DB] getUserConversations ERROR:', error, 'at', new Date().toISOString());
        throw error;
    }
    
    console.log('[DB] getUserConversations END:', userId, 'count:', (data || []).length, 'at', new Date().toISOString());
    return data || [];
}

async function getConversation(conversationId) {
    const supabase = getSupabase();
    console.log('[DB] getConversation START:', conversationId, 'at', new Date().toISOString());
    
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
    
    if (error) {
        console.error('[DB] getConversation ERROR:', error, 'at', new Date().toISOString());
        throw error;
    }
    
    console.log('[DB] getConversation END:', conversationId, 'at', new Date().toISOString());
    return data;
}

async function updateConversationTitle(conversationId, title) {
    const supabase = getSupabase();
    console.log('[DB] Updating conversation title:', { conversationId, title });
    
    const { data, error } = await supabase
        .from('conversations')
        .update({ title: title })
        .eq('id', conversationId)
        .select()
        .single();
    
    if (error) {
        console.error('[DB] Error updating conversation title:', error);
        throw error;
    }
    
    console.log('[DB] Title updated successfully');
    return data;
}

async function deleteConversation(conversationId) {
    const supabase = getSupabase();
    
    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
    
    if (error) {
        console.error('Error deleting conversation:', error);
        throw error;
    }
    
}

async function saveMessageToSupabase(conversationId, userId, role, content) {
    const supabase = getSupabase();
    console.log('[DB] Saving message:', { conversationId, role, contentLength: content?.length });
    
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
        console.error('[DB] Error saving message:', error);
        throw error;
    }
    
    console.log('[DB] Message saved successfully:', data.id);
    
    supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .then(() => console.log('[DB] Conversation timestamp updated'))
        .catch(err => console.error('[DB] Error updating conversation timestamp:', err));
    
    return data;
}

async function loadMessagesFromSupabase(conversationId) {
    const supabase = getSupabase();
    console.log('[DB] loadMessagesFromSupabase START:', conversationId, 'at', new Date().toISOString());
    
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('[DB] loadMessagesFromSupabase ERROR:', error, 'at', new Date().toISOString());
        throw error;
    }
    
    console.log('[DB] loadMessagesFromSupabase END:', conversationId, 'count:', (data || []).length, 'at', new Date().toISOString());
    const messages = data || [];
    
    return messages.map(msg => {
        let content = msg.content;
        
        if (typeof content === 'string' && content.trim().startsWith('{')) {
            try {
                content = JSON.parse(content);
            } catch (e) {
                console.warn('Failed to parse message content as JSON:', e);
            }
        }
        
        return {
            ...msg,
            content: content
        };
    });
}

async function deleteAllUserConversations(userId) {
    const supabase = getSupabase();
    
    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error deleting all conversations:', error);
        throw error;
    }
    
}

async function getMessageCount(conversationId) {
    const supabase = getSupabase();
    console.log('[DB] Getting message count for conversation:', conversationId);
    
    const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);
    
    if (error) {
        console.error('[DB] Error counting messages:', error);
        return 0;
    }
    
    console.log('[DB] Message count:', count);
    return count || 0;
}
