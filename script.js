let currentConversationId = null;
let currentSessionId = null;
let isInitialized = false;
let chatDropdownListenerAttached = false;
let isLoadingConversation = false;
let pendingBackgroundTasks = 0;

function trackBackgroundTask(promise) {
    pendingBackgroundTasks++;
    updateBeforeUnloadHandler();
    return promise.finally(() => {
        pendingBackgroundTasks--;
        updateBeforeUnloadHandler();
    });
}

function updateBeforeUnloadHandler() {
    if (pendingBackgroundTasks > 0) {
        window.onbeforeunload = (e) => {
            const message = 'Work is still being saved in the background. Are you sure you want to leave?';
            e.returnValue = message;
            return message;
        };
    } else {
        window.onbeforeunload = null;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedLoadConversation = debounce((conversationId) => {
    loadConversation(conversationId);
}, 300);

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

async function saveMessage(role, content, conversationId = null, userId = null) {
    const user = getCurrentUser();
    const convId = conversationId || currentConversationId;
    const uId = userId || (user ? user.id : null);
    
    if (!uId || !convId) {
        console.error('No user or conversation');
        return;
    }
    
    try {
        await saveMessageToSupabase(convId, uId, role, content);
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
    if (!content || typeof content !== 'string') {
        return '';
    }

    const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    const lines = content.split('\n');
    let html = '';
    let inList = false;
    let listType = null;
    let currentParagraph = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            const text = currentParagraph.join(' ').trim();
            if (text) {
                html += `<p class="md-paragraph">${formatInlineText(text)}</p>`;
            }
            currentParagraph = [];
        }
    };

    const closeList = () => {
        if (inList) {
            html += listType === 'ul' ? '</ul>' : '</ol>';
            inList = false;
            listType = null;
        }
    };

    const formatInlineText = (text) => {
        let formatted = escapeHtml(text);
        
        const urlPattern = /(https?:\/\/[^\s<]+)/g;
        formatted = formatted.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
        
        return formatted;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        if (trimmedLine === '' && currentParagraph.length > 0) {
            closeList();
            flushParagraph();
            continue;
        }

        if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
            closeList();
            flushParagraph();
            html += '<hr class="md-hr">';
            continue;
        }

        const h1Match = trimmedLine.match(/^#\s+(.+)$/);
        if (h1Match) {
            closeList();
            flushParagraph();
            html += `<h1 class="md-h1">${formatInlineText(h1Match[1])}</h1>`;
            continue;
        }

        const h2Match = trimmedLine.match(/^##\s+(.+)$/);
        if (h2Match) {
            closeList();
            flushParagraph();
            html += `<h2 class="md-h2">${formatInlineText(h2Match[1])}</h2>`;
            continue;
        }

        const h3Match = trimmedLine.match(/^###\s+(.+)$/);
        if (h3Match) {
            closeList();
            flushParagraph();
            html += `<h3 class="md-h3">${formatInlineText(h3Match[1])}</h3>`;
            continue;
        }

        const h4Match = trimmedLine.match(/^####\s+(.+)$/);
        if (h4Match) {
            closeList();
            flushParagraph();
            html += `<h4 class="md-h4">${formatInlineText(h4Match[1])}</h4>`;
            continue;
        }

        const ulMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
        if (ulMatch) {
            flushParagraph();
            if (!inList || listType !== 'ul') {
                closeList();
                html += '<ul class="md-ul">';
                inList = true;
                listType = 'ul';
            }
            html += `<li class="md-li">${formatInlineText(ulMatch[1])}</li>`;
            continue;
        }

        const olMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
        if (olMatch) {
            flushParagraph();
            if (!inList || listType !== 'ol') {
                closeList();
                html += '<ol class="md-ol">';
                inList = true;
                listType = 'ol';
            }
            html += `<li class="md-li">${formatInlineText(olMatch[2])}</li>`;
            continue;
        }

        const blockquoteMatch = trimmedLine.match(/^>\s*(.*)$/);
        if (blockquoteMatch) {
            closeList();
            flushParagraph();
            html += `<blockquote class="md-blockquote">${formatInlineText(blockquoteMatch[1])}</blockquote>`;
            continue;
        }

        if (trimmedLine !== '') {
            closeList();
            currentParagraph.push(trimmedLine);
        }
    }

    closeList();
    flushParagraph();

    if (!html.trim()) {
        html = `<p class="md-paragraph">${formatInlineText(content)}</p>`;
    }

    return `<div class="md-content">${html}</div>`;
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
        avatar.innerHTML = `<img src="attached_assets/nundu_ai_logo_1765627158270.png" alt="Nimbus AI" class="message-avatar-logo">`;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'message-copy-btn';
    copyBtn.title = 'Copy text';
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    copyBtn.addEventListener('click', () => copyMessageText(contentDiv, copyBtn));
    
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
        copyBtn.style.display = 'none';
    } else {
        if (role === 'ai') {
            if (enableTypingEffect) {
                contentDiv.innerHTML = '';
                messageDiv.appendChild(copyBtn);
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
    
    messageDiv.appendChild(copyBtn);
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

function copyMessageText(contentDiv, copyBtn) {
    const textContent = contentDiv.innerText || contentDiv.textContent;
    navigator.clipboard.writeText(textContent).then(() => {
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
            copyBtn.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
    });
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
        
        if (!text || text.trim() === '') {
            console.warn('Empty response from webhook');
            throw new Error('Empty response from server');
        }
        
        const data = JSON.parse(text);
        
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
        
        const convIdAtSend = currentConversationId;
        const userIdAtSend = user.id;
        
        addMessageToUI('user', userMessage);
        
        trackBackgroundTask(
            saveMessage('user', userMessage, convIdAtSend, userIdAtSend).catch(error => {
                console.error('Failed to save user message:', error);
            })
        );
        
        const typingMessage = addMessageToUI('ai', '', true);
        
        try {
            const sessionId = getOrCreateSessionId();
            const aiResponse = await getAIResponse(userMessage, sessionId, user.id);
            
            typingMessage.remove();
            addMessageToUI('ai', aiResponse, false, true);
            
            const titleForConv = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
            
            trackBackgroundTask(
                saveMessage('ai', aiResponse, convIdAtSend, userIdAtSend)
                    .then(() => {
                        return getMessageCount(convIdAtSend);
                    })
                    .then(messageCount => {
                        if (!messageCount) return;
                        
                        if (messageCount === 2) {
                            updateConversationTitle(convIdAtSend, titleForConv)
                                .then(() => {
                                    const updated = updateSidebarTitleLocally(convIdAtSend, titleForConv);
                                    if (!updated) {
                                        loadConversationHistory().catch(() => {});
                                    }
                                })
                                .catch(() => {});
                        }
                    })
                    .catch(error => {
                        console.error('Failed to save AI response:', error);
                    })
            );
            
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
        return conversation;
    } catch (error) {
        console.error('Error creating conversation:', error);
        return null;
    }
}

let lastSuccessfulConversationId = null;

async function loadConversation(conversationId) {
    if (isLoadingConversation) {
        console.log('Already loading a conversation, skipping...');
        return;
    }
    
    if (conversationId === lastSuccessfulConversationId) {
        console.log('Same conversation already loaded successfully, skipping...');
        return;
    }
    
    isLoadingConversation = true;
    const messagesContainer = document.getElementById('messages');
    const previousConversationId = currentConversationId;
    
    try {
        hideWelcomeMessage();
        messagesContainer.innerHTML = '<div style="text-align: center; padding: 40px;"><div class="loading-spinner"><img src="attached_assets/nundu_ai_logo_1765627158270.png" alt="Loading"></div></div>';
        
        const conversation = await getConversation(conversationId);
        const loadedSessionId = conversation.session_id || generateUUID();
        
        currentConversationId = conversationId;
        currentSessionId = loadedSessionId;
        
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
        
        lastSuccessfulConversationId = conversationId;
        
    } catch (error) {
        console.error('Error loading conversation:', error);
        messagesContainer.innerHTML = '<div class="error-message">Failed to load conversation. Click to try again.</div>';
        showToast('Failed to load conversation', 'error');
        currentConversationId = previousConversationId;
    } finally {
        isLoadingConversation = false;
    }
}

async function loadConversationHistory() {
    const user = getCurrentUser();
    if (!user) return [];
    
    const historyContainer = document.getElementById('chatHistory');
    
    try {
        historyContainer.innerHTML = '<div style="padding: 16px; text-align: center;"><div class="spinner"></div></div>';
        
        const conversations = await getUserConversations(user.id);
        historyContainer.innerHTML = '';
        
        if (conversations.length === 0) {
            historyContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #9aa0a6; font-size: 13px;">No conversations yet</div>';
            return [];
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
                if (isLoadingConversation) return;
                document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
                chatItem.classList.add('active');
                debouncedLoadConversation(conv.id);
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
        
        return conversations;
    } catch (error) {
        console.error('Error loading conversation history:', error);
        historyContainer.innerHTML = '<div class="error-message" style="margin: 10px; font-size: 12px;">Failed to load history</div>';
        return [];
    }
}

function updateSidebarTitleLocally(conversationId, newTitle) {
    const historyContainer = document.getElementById('chatHistory');
    if (!historyContainer) return false;
    
    const chatItems = historyContainer.querySelectorAll('.chat-item');
    for (const chatItem of chatItems) {
        const textSpan = chatItem.querySelector('.chat-item-text');
        if (textSpan) {
            const clickHandler = textSpan.onclick || (() => {});
            const itemId = chatItem.dataset?.conversationId;
            
            if (chatItem.classList.contains('active') || 
                (currentConversationId && conversationId === currentConversationId)) {
                textSpan.textContent = newTitle;
                return true;
            }
        }
    }
    return false;
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
        
    } catch (error) {
        console.error('Error populating chat company filter:', error);
    }
}

async function initializeChat() {
    if (isInitialized) {
        return;
    }
    
    const user = getCurrentUser();
    if (!user) {
        console.error('User not authenticated');
        return;
    }
    
    
    try {
        await populateChatCompanyFilter();
        
        const conversations = await loadConversationHistory();
        
        if (conversations.length > 0) {
            await loadConversation(conversations[0].id);
        } else {
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
    
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.removeEventListener('click', handleSendMessage);
    sendBtn.addEventListener('click', handleSendMessage);
    
    const newChatBtn = document.querySelector('.new-chat-btn');
    if (newChatBtn) {
        newChatBtn.removeEventListener('click', handleNewChatClick);
        newChatBtn.addEventListener('click', handleNewChatClick);
    } else {
        console.error('New chat button not found');
    }
    
    isInitialized = true;
}
