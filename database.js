async function createConversation(userId, title = null, sessionId = null) {
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
        console.error('Error creating conversation:', error);
        throw error;
    }
    
    console.log('Conversation created:', data);
    return data;
}

async function getUserConversations(userId, limit = 50) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        console.error('Error loading conversations:', error);
        throw error;
    }
    
    return data || [];
}

async function getConversation(conversationId) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();
    
    if (error) {
        console.error('Error loading conversation:', error);
        throw error;
    }
    
    return data;
}

async function updateConversationTitle(conversationId, title) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('conversations')
        .update({ title: title })
        .eq('id', conversationId)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating conversation title:', error);
        throw error;
    }
    
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
    
    console.log('Conversation deleted:', conversationId);
}

async function saveMessageToSupabase(conversationId, userId, role, content) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('messages')
        .insert([{
            conversation_id: conversationId,
            user_id: userId,
            role: role,
            content: content
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error saving message:', error);
        throw error;
    }
    
    await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    
    return data;
}

async function loadMessagesFromSupabase(conversationId) {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error loading messages:', error);
        throw error;
    }
    
    return data || [];
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
    
    console.log('All conversations deleted for user:', userId);
}

async function getMessageCount(conversationId) {
    const supabase = getSupabase();
    
    const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);
    
    if (error) {
        console.error('Error counting messages:', error);
        return 0;
    }
    
    return count || 0;
}
