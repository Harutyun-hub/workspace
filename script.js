let currentConversationId = null;
let currentSessionId = null;
let isInitialized = false;
let chatDropdownListenerAttached = false;

function closeAllChatDropdowns(e) {
    if (e && (e.target.closest('.chat-item-menu-btn') || e.target.closest('.chat-item-dropdown'))) {
        return;
    }
    document.querySelectorAll('.chat-item-dropdown').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.chat-item-menu-btn').forEach(b => b.classList.remove('active'));
}

function cleanupChatDropdowns() {
    if (chatDropdownListenerAttached) {
        document.removeEventListener('click', closeAllChatDropdowns);
        chatDropdownListenerAttached = false;
    }
}

if (typeof window !== 'undefined') {
    window.cleanupChatDropdowns = cleanupChatDropdowns;
}

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

function addMessageToUI(role, content, isTyping = false, enableTypingEffect = false) {
    hideWelcomeMessage();
    const messagesContainer = document.getElementById('messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (role === 'user') {
        avatar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    } else {
        avatar.innerHTML = `<img src="attached_assets/nundu_ai_logo_1765627158270.png" alt="Nundu AI" class="message-avatar-logo">`;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isTyping) {
        contentDiv.innerHTML = `
            <div class="typing-indicator-container">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <div class="thinking-text">Thinking</div>
            </div>
        `;
    } else {
        if (role === 'ai') {
            if (enableTypingEffect) {
                contentDiv.innerHTML = '';
                messageDiv.appendChild(avatar);
                messageDiv.appendChild(contentDiv);
                messagesContainer.appendChild(messageDiv);
                
                showTypingEffect(content, contentDiv);
                return messageDiv;
            } else {
                contentDiv.innerHTML = renderMessage(content);
            }
        } else {
            contentDiv.textContent = content;
        }
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    if (role === 'user') {
        scrollToBottom(true);
    } else {
        scrollToBottom();
    }
    
    return messageDiv;
}

function showTypingEffect(content, contentDiv) {
    const renderedContent = renderMessage(content);
    contentDiv.innerHTML = renderedContent;
    
    const elementsToAnimate = [];
    const textNodes = [];
    
    function extractTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            textNodes.push(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList && (node.classList.contains('chart-container') || 
                node.classList.contains('data-table') || 
                node.classList.contains('media-gallery') ||
                node.tagName === 'CANVAS')) {
                return;
            }
            for (let child of node.childNodes) {
                extractTextNodes(child);
            }
        }
    }
    
    extractTextNodes(contentDiv);
    
    if (textNodes.length === 0) {
        return;
    }
    
    textNodes.forEach(node => {
        const originalText = node.textContent;
        const words = originalText.split(' ');
        elementsToAnimate.push({ node, words, originalText, currentIndex: 0 });
        node.textContent = '';
    });
    
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    
    if (textNodes.length > 0) {
        const lastNode = textNodes[textNodes.length - 1];
        lastNode.parentNode.insertBefore(cursor, lastNode.nextSibling);
    }
    
    let globalWordIndex = 0;
    const totalWords = elementsToAnimate.reduce((sum, item) => sum + item.words.length, 0);
    
    const typingInterval = setInterval(() => {
        for (let item of elementsToAnimate) {
            if (item.currentIndex < item.words.length) {
                const word = item.words[item.currentIndex];
                item.node.textContent += (item.currentIndex === 0 ? '' : ' ') + word;
                item.currentIndex++;
                globalWordIndex++;
                break;
            }
        }
        
        const chatContainer = document.getElementById('chatContainer');
        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
        
        if (isNearBottom) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        if (globalWordIndex >= totalWords) {
            clearInterval(typingInterval);
            cursor.remove();
        }
    }, 60);
}

function scrollToBottom(force = false) {
    const chatContainer = document.getElementById('chatContainer');
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    
    if (force || isNearBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

async function getAIResponse(userMessage, sessionId, userId) {
    try {
        const companyFilter = document.getElementById('chatCompanyFilter');
        const selectedCompany = companyFilter ? companyFilter.value : '';
        
        const requestBody = {
            message: userMessage,
            sessionId: sessionId,
            userId: userId,
            companyKey: selectedCompany || null
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
            return data;
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
            addMessageToUI('ai', aiResponse, false, true);
            
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
        hideWelcomeMessage();
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading-spinner"><img src="attached_assets/nundu_ai_logo_1765627158270.png" alt="Loading"></div></div>';
        
        currentConversationId = conversationId;
        const conversation = await getConversation(conversationId);
        currentSessionId = conversation.session_id || generateUUID();
        
        messagesContainer.innerHTML = '';
        
        const messages = await loadMessages();
        
        if (messages.length === 0) {
            showWelcomeMessage();
        } else {
            hideWelcomeMessage();
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
            
            const chatText = document.createElement('span');
            chatText.className = 'chat-item-text';
            chatText.textContent = conv.title || 'New chat';
            chatText.addEventListener('click', () => {
                loadConversation(conv.id);
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                chatItem.classList.add('active');
            });
            
            const menuBtn = document.createElement('button');
            menuBtn.className = 'chat-item-menu-btn';
            menuBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="5" r="2" fill="currentColor"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor"/>
                    <circle cx="12" cy="19" r="2" fill="currentColor"/>
                </svg>
            `;
            
            const dropdown = document.createElement('div');
            dropdown.className = 'chat-item-dropdown';
            dropdown.innerHTML = `
                <button class="chat-item-dropdown-item rename">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                    </svg>
                    Rename
                </button>
                <button class="chat-item-dropdown-item delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Delete
                </button>
            `;
            
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                document.querySelectorAll('.chat-item-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.remove('show');
                });
                document.querySelectorAll('.chat-item-menu-btn').forEach(b => {
                    if (b !== menuBtn) b.classList.remove('active');
                });
                
                dropdown.classList.toggle('show');
                menuBtn.classList.toggle('active');
            });
            
            const renameBtn = dropdown.querySelector('.rename');
            renameBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleRenameConversation(conv.id, conv.title || 'New chat');
            });
            
            const deleteBtn = dropdown.querySelector('.delete');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleDeleteConversation(conv.id);
            });
            
            chatItem.appendChild(chatText);
            chatItem.appendChild(menuBtn);
            chatItem.appendChild(dropdown);
            historyContainer.appendChild(chatItem);
        });
        
        if (!chatDropdownListenerAttached) {
            document.addEventListener('click', closeAllChatDropdowns);
            chatDropdownListenerAttached = true;
        }
    } catch (error) {
        console.error('Error loading conversation history:', error);
        historyContainer.innerHTML = '<div class="error-message" style="margin: 10px; font-size: 12px;">Failed to load history</div>';
    }
}

async function handleRenameConversation(conversationId, currentTitle) {
    try {
        document.querySelectorAll('.chat-item-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.chat-item-menu-btn').forEach(b => b.classList.remove('active'));
        
        const newTitle = prompt('Enter new name for this chat:', currentTitle);
        if (newTitle === null || newTitle.trim() === '') return;
        
        await updateConversationTitle(conversationId, newTitle.trim());
        await loadConversationHistory();
        showToast('Chat renamed successfully', 'success');
    } catch (error) {
        console.error('Error renaming conversation:', error);
        showToast('Failed to rename chat', 'error');
    }
}

async function handleDeleteConversation(conversationId) {
    try {
        const confirmed = confirm('Are you sure you want to delete this conversation? This action cannot be undone.');
        if (!confirmed) return;
        
        document.querySelectorAll('.chat-item-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.chat-item-menu-btn').forEach(b => b.classList.remove('active'));
        
        await deleteConversation(conversationId);
        
        if (conversationId === currentConversationId) {
            currentConversationId = null;
            currentSessionId = null;
            document.getElementById('messages').innerHTML = '<div style="text-align: center; padding: 40px; color: #9aa0a6;">Select a conversation or start a new chat</div>';
        }
        
        await loadConversationHistory();
        showToast('Conversation deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting conversation:', error);
        showToast('Failed to delete conversation', 'error');
    }
}

function handleEnterKey(e) {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
}

function showWelcomeMessage() {
    const welcomeMessage = document.getElementById('welcomeMessage');
    const welcomeName = document.getElementById('welcomeName');
    const user = getCurrentUser();
    
    if (welcomeMessage) {
        if (user) {
            const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
            const firstName = fullName.split(' ')[0] || 'there';
            welcomeName.textContent = firstName;
        }
        welcomeMessage.classList.remove('hidden');
    }
}

function hideWelcomeMessage() {
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.classList.add('hidden');
    }
}

async function handleNewChatClick(e) {
    e.preventDefault();
    console.log('New chat button clicked');
    try {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        
        showWelcomeMessage();
        
        await createNewConversation();
        
        if (currentConversationId) {
            await loadConversationHistory();
        } else {
            throw new Error('Failed to create new conversation');
        }
    } catch (error) {
        console.error('New chat error:', error);
        handleError(error, 'Create new chat');
    }
}

async function populateChatCompanyFilter() {
    const companyFilter = document.getElementById('chatCompanyFilter');
    
    if (!companyFilter) return;
    
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('companies')
            .select('company_key')
            .order('company_key', { ascending: true });
        
        if (error) {
            console.error('Error loading companies for chat:', error);
            return;
        }
        
        const currentValue = companyFilter.value;
        companyFilter.innerHTML = '<option value="">All Companies</option>';
        
        if (data && data.length > 0) {
            data.forEach(company => {
                if (company.company_key) {
                    const option = document.createElement('option');
                    option.value = company.company_key;
                    option.textContent = company.company_key;
                    companyFilter.appendChild(option);
                }
            });
        }
        
        if (currentValue) {
            companyFilter.value = currentValue;
        }
        
        console.log('✓ Chat company filter populated');
    } catch (error) {
        console.error('Error populating chat company filter:', error);
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
        console.log('Populating company filter...');
        await populateChatCompanyFilter();
        
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
            showWelcomeMessage();
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
