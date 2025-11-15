let currentConversationId = null;
let currentSessionId = null;
let isInitialized = false;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getOrCreateSessionId() {
    if (!currentSessionId) {
        currentSessionId = generateUUID();
    }
    return currentSessionId;
}

async function saveMessage(role, content) {
    const user = getCurrentUser();
    if (!user || !currentConversationId) {
        console.error('No user or conversation');
        return;
    }
    
    try {
        await saveMessageToSupabase(currentConversationId, user.id, role, content);
    } catch (error) {
        console.error('Failed to save message:', error);
    }
}

async function loadMessages() {
    if (!currentConversationId) {
        return [];
    }
    
    try {
        const messages = await loadMessagesFromSupabase(currentConversationId);
        return messages;
    } catch (error) {
        console.error('Failed to load messages:', error);
        return [];
    }
}

function formatMessageContent(content) {
    let formatted = content;
    
    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    formatted = escapeHtml(formatted);
    
    // Convert URLs to clickable links
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *italic* to <em>
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Convert double breaks to paragraphs
    formatted = formatted.replace(/(<br>){2,}/g, '</p><p>');
    
    // Wrap in paragraph tags
    formatted = '<p>' + formatted + '</p>';
    
    // Clean up empty paragraphs
    formatted = formatted.replace(/<p><\/p>/g, '');
    formatted = formatted.replace(/<p><br><\/p>/g, '');
    
    return formatted;
}

function addMessageToUI(role, content, isTyping = false) {
    const messagesContainer = document.getElementById('messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isTyping) {
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
    } else {
        if (role === 'ai') {
            contentDiv.innerHTML = formatMessageContent(content);
        } else {
            contentDiv.textContent = content;
        }
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    scrollToBottom();
    
    return messageDiv;
}

function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function getAIResponse(userMessage, sessionId, userId) {
    try {
        const requestBody = {
            message: userMessage,
            sessionId: sessionId,
            userId: userId
        };
        
        console.log('Sending request with body:', requestBody);
        
        const response = await fetch('https://wimedia.app.n8n.cloud/webhook/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        
        console.log('Raw response text:', text);
        
        if (!text || text.trim() === '') {
            console.warn('Empty response from webhook');
            throw new Error('Empty response from server');
        }
        
        const data = JSON.parse(text);
        console.log('Parsed response data:', data);
        
        if (data.output) {
            return data.output;
        } else if (data.response) {
            return data.response;
        } else {
            console.warn('No output or response field found, returning raw text');
            return text;
        }
    } catch (error) {
        console.error('Error fetching AI response:', error);
        throw error;
    }
}

async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const message = input.value.trim();
    
    if (!message) return;
    
    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in to send messages', 'error');
        return;
    }
    
    input.disabled = true;
    sendBtn.disabled = true;
    
    try {
        if (!currentConversationId) {
            await createNewConversation();
            if (!currentConversationId) {
                throw new Error('Failed to create conversation');
            }
        }
        
        const userMessage = message;
        input.value = '';
        
        addMessageToUI('user', userMessage);
        
        saveMessage('user', userMessage).catch(error => {
            console.error('Failed to save user message:', error);
        });
        
        const typingMessage = addMessageToUI('ai', '', true);
        
        try {
            const sessionId = getOrCreateSessionId();
            const aiResponse = await getAIResponse(userMessage, sessionId, user.id);
            
            typingMessage.remove();
            addMessageToUI('ai', aiResponse);
            
            saveMessage('ai', aiResponse).catch(error => {
                console.error('Failed to save AI response:', error);
            });
            
            getMessageCount(currentConversationId).then(messageCount => {
                if (messageCount === 2) {
                    const title = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
                    updateConversationTitle(currentConversationId, title).then(() => {
                        loadConversationHistory().catch(error => {
                            console.error('Failed to load conversation history:', error);
                        });
                    }).catch(error => {
                        console.error('Failed to update conversation title:', error);
                    });
                }
            }).catch(error => {
                console.error('Failed to get message count:', error);
            });
            
        } catch (error) {
            typingMessage.remove();
            console.error('AI response error:', error);
            
            const errorMessage = "I'm sorry, I'm having trouble connecting right now. Please try again.";
            addMessageToUI('ai', errorMessage);
            showToast('Failed to get AI response. Please check your connection and try again.', 'error');
            
            input.value = userMessage;
        }
    } catch (error) {
        handleError(error, 'Send message');
        input.value = message;
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

async function createNewConversation() {
    const user = getCurrentUser();
    if (!user) {
        console.error('No user logged in');
        return null;
    }
    
    try {
        currentSessionId = generateUUID();
        const conversation = await createConversation(user.id, null, currentSessionId);
        currentConversationId = conversation.id;
        console.log('New conversation created:', conversation.id);
        return conversation;
    } catch (error) {
        console.error('Error creating conversation:', error);
        return null;
    }
}

async function loadConversation(conversationId) {
    const messagesContainer = document.getElementById('messages');
    
    try {
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading-spinner"></div></div>';
        
        currentConversationId = conversationId;
        const conversation = await getConversation(conversationId);
        currentSessionId = conversation.session_id || generateUUID();
        
        messagesContainer.innerHTML = '';
        
        const messages = await loadMessages();
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #9aa0a6;">No messages yet. Start a conversation!</div>';
        } else {
            messages.forEach(msg => {
                addMessageToUI(msg.role, msg.content);
            });
        }
        
        console.log('Conversation loaded:', conversationId);
    } catch (error) {
        console.error('Error loading conversation:', error);
        messagesContainer.innerHTML = '<div class="error-message">Failed to load conversation. Please try again.</div>';
        showToast('Failed to load conversation', 'error');
    }
}

async function loadConversationHistory() {
    const user = getCurrentUser();
    if (!user) return;
    
    const historyContainer = document.getElementById('chatHistory');
    
    try {
        historyContainer.innerHTML = '<div style="padding: 16px; text-align: center;"><div class="spinner"></div></div>';
        
        const conversations = await getUserConversations(user.id);
        historyContainer.innerHTML = '';
        
        if (conversations.length === 0) {
            historyContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #9aa0a6; font-size: 13px;">No conversations yet</div>';
            return;
        }
        
        conversations.forEach(conv => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            if (conv.id === currentConversationId) {
                chatItem.classList.add('active');
            }
            chatItem.textContent = conv.title || 'New chat';
            chatItem.addEventListener('click', () => {
                loadConversation(conv.id);
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                chatItem.classList.add('active');
            });
            historyContainer.appendChild(chatItem);
        });
    } catch (error) {
        console.error('Error loading conversation history:', error);
        historyContainer.innerHTML = '<div class="error-message" style="margin: 10px; font-size: 12px;">Failed to load history</div>';
    }
}

function handleEnterKey(e) {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
}

async function handleNewChatClick(e) {
    e.preventDefault();
    console.log('New chat button clicked');
    try {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        
        await createNewConversation();
        
        if (currentConversationId) {
            await loadConversationHistory();
            showToast('New conversation started!', 'success');
        } else {
            throw new Error('Failed to create new conversation');
        }
    } catch (error) {
        console.error('New chat error:', error);
        handleError(error, 'Create new chat');
    }
}

async function initializeChat() {
    if (isInitialized) {
        console.log('Chat already initialized, skipping');
        return;
    }
    
    const user = getCurrentUser();
    if (!user) {
        console.error('User not authenticated');
        return;
    }
    
    console.log('Initializing chat for user:', user.id);
    
    try {
        console.log('Loading conversation history...');
        await loadConversationHistory();
        console.log('Conversation history loaded');
        
        console.log('Getting user conversations...');
        const conversations = await getUserConversations(user.id, 1);
        console.log(`Found ${conversations.length} conversations`);
        
        if (conversations.length > 0) {
            console.log('Loading first conversation...');
            await loadConversation(conversations[0].id);
        } else {
            console.log('Creating new conversation...');
            await createNewConversation();
        }
    } catch (error) {
        console.error('Error during chat initialization:', error);
        showToast('Failed to load chat. Please refresh the page.', 'error');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    messageInput.removeEventListener('keypress', handleEnterKey);
    messageInput.addEventListener('keypress', handleEnterKey);
    console.log('✓ Enter key listener attached');
    
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.removeEventListener('click', handleSendMessage);
    sendBtn.addEventListener('click', handleSendMessage);
    console.log('✓ Send button listener attached');
    
    const newChatBtn = document.querySelector('.new-chat-btn');
    if (newChatBtn) {
        newChatBtn.removeEventListener('click', handleNewChatClick);
        newChatBtn.addEventListener('click', handleNewChatClick);
        console.log('✓ New chat button listener attached');
    } else {
        console.error('New chat button not found');
    }
    
    isInitialized = true;
    console.log('✓ Chat initialization complete');
}
