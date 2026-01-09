// ============================================
// GLOBAL ERROR BOUNDARY
// Catches all unhandled errors and rejections
// ============================================
window.onerror = function(message, source, lineno, colno, error) {
    Logger.error(error || new Error(message), 'GlobalError', {
        source,
        lineno,
        colno,
        type: 'uncaught_error'
    });
    return false;
};

window.onunhandledrejection = function(event) {
    const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
    Logger.error(error, 'GlobalError', {
        type: 'unhandled_rejection',
        reason: String(event.reason)
    });
};

// ============================================
// APPLICATION STATE
// ============================================
let currentConversationId = null;
let currentSessionId = null;
let isInitialized = false;
let isAppInitializing = false;
let chatDropdownListenerAttached = false;
let isLoadingConversation = false;
let pendingBackgroundTasks = 0;
let currentLoadId = 0;
let appLifecycleReady = false;

const APP_CONTEXT = 'App';
const CHAT_CONTEXT = 'Chat';

// Lifecycle management for cleanup
let currentTypingInterval = null;
let currentLoadAbortController = null;
let currentAIAbortController = null;
const AI_FETCH_TIMEOUT_MS = 300000;
const INPUT_UNLOCK_TIMEOUT_MS = 330000;
const TYPING_EFFECT_TIMEOUT_MS = 15000;

const SAVE_TIMEOUT_MS = 60000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ============================================
// CHAT STATE MACHINE - Enterprise Architecture
// ============================================
const ChatState = {
    IDLE: 'IDLE',
    SENDING: 'SENDING',
    AWAITING_AI: 'AWAITING_AI',
    RENDERING: 'RENDERING',
    ERROR: 'ERROR'
};

const ChatStateMachine = {
    currentState: ChatState.IDLE,
    listeners: [],
    stateHistory: [],
    
    setState(newState, reason = '') {
        const previousState = this.currentState;
        this.currentState = newState;
        this.stateHistory.push({ 
            from: previousState, 
            to: newState, 
            reason, 
            timestamp: Date.now() 
        });
        
        // Keep only last 20 state changes for debugging
        if (this.stateHistory.length > 20) {
            this.stateHistory.shift();
        }
        
        Logger.info(`${previousState} → ${newState}${reason ? ` (${reason})` : ''}`, 'ChatState');
        
        // Notify all listeners
        this.listeners.forEach(listener => {
            try {
                listener(newState, previousState);
            } catch (err) {
                Logger.error(err, 'ChatState', { operation: 'listener' });
            }
        });
        
        // Auto-sync UI on every state change
        this.syncUI();
    },
    
    getState() {
        return this.currentState;
    },
    
    isIdle() {
        return this.currentState === ChatState.IDLE;
    },
    
    canSendMessage() {
        return this.currentState === ChatState.IDLE;
    },
    
    onStateChange(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },
    
    syncUI() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (!input || !sendBtn) return;
        
        const shouldBeEnabled = this.currentState === ChatState.IDLE;
        
        input.disabled = !shouldBeEnabled;
        sendBtn.disabled = !shouldBeEnabled;
        
        if (shouldBeEnabled) {
            input.focus();
        }
        
        Logger.info(`UI sync: input/button ${shouldBeEnabled ? 'ENABLED' : 'DISABLED'}`, 'ChatState');
    },
    
    forceReset(reason = 'Force reset') {
        Logger.warn(`Force resetting state: ${reason}`, 'ChatState');
        
        // Cleanup all pending operations
        cleanupTypingEffect();
        cancelAIRequest();
        
        // Reset to IDLE
        this.setState(ChatState.IDLE, reason);
    },
    
    getDebugInfo() {
        return {
            currentState: this.currentState,
            recentHistory: this.stateHistory.slice(-5),
            pendingBackgroundTasks
        };
    }
};

// Global safety net - if stuck in non-IDLE state for too long, force reset
setInterval(() => {
    if (ChatStateMachine.currentState !== ChatState.IDLE) {
        const lastChange = ChatStateMachine.stateHistory[ChatStateMachine.stateHistory.length - 1];
        if (lastChange && Date.now() - lastChange.timestamp > INPUT_UNLOCK_TIMEOUT_MS) {
            ChatStateMachine.forceReset('Safety timeout - stuck in non-IDLE state');
        }
    }
}, 5000);

// Expose for debugging
if (typeof window !== 'undefined') {
    window.ChatStateMachine = ChatStateMachine;
    window.ChatState = ChatState;
}

const NIMBUS_AVATAR_BASE64 = 'attached_assets/omb_(1)_1766684733796.png';

function withTimeout(promise, timeoutMs = SAVE_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Operation timed out'));
        }, timeoutMs);
        
        promise
            .then(result => {
                clearTimeout(timer);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timer);
                reject(error);
            });
    });
}

async function withRetry(fn, maxAttempts = MAX_RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
            }
        }
    }
    throw lastError;
}

function trackBackgroundTask(promise) {
    pendingBackgroundTasks++;
    updateBeforeUnloadHandler();
    
    const wrappedPromise = withTimeout(promise, SAVE_TIMEOUT_MS)
        .catch(error => {
            Logger.warn(`Background task failed or timed out: ${error.message}`, APP_CONTEXT);
        });
    
    return wrappedPromise.finally(() => {
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

// Note: Uses debounce from utils.js
const debouncedLoadConversation = debounce((conversationId) => {
    loadConversation(conversationId);
}, 300);

// Named handler for visibility change - enables proper removal
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        Logger.info(`Tab visible, current state: ${ChatStateMachine.getState()}`, 'Visibility');
        // Mark auth as potentially settling - Supabase may refresh token
        if (typeof markAuthSettling === 'function') {
            markAuthSettling();
        }
        // Re-sync UI in case it got out of sync
        ChatStateMachine.syncUI();
    }
}

// Track if visibility listener is attached
let visibilityListenerAttached = false;

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

// Cleanup typing effect interval
function cleanupTypingEffect() {
    if (currentTypingInterval) {
        clearInterval(currentTypingInterval);
        currentTypingInterval = null;
    }
    // Remove any lingering typing cursors
    document.querySelectorAll('.typing-cursor').forEach(cursor => cursor.remove());
}

// Cancel any ongoing conversation load
function cancelConversationLoad() {
    if (currentLoadAbortController) {
        currentLoadAbortController.abort();
        currentLoadAbortController = null;
    }
    isLoadingConversation = false;
}

// Cancel any ongoing AI request
function cancelAIRequest() {
    if (currentAIAbortController) {
        currentAIAbortController.abort();
        currentAIAbortController = null;
    }
}

// Force unlock input (safety mechanism) - now uses state machine
function forceUnlockInput() {
    Logger.info('Forcing input unlock via state machine', 'ForceUnlock');
    ChatStateMachine.forceReset('Manual force unlock');
}

// Master cleanup function for logout/navigation
function cleanupAllState() {
    Logger.info('Cleaning up all state', 'Cleanup');
    cleanupTypingEffect();
    cancelConversationLoad();
    cancelAIRequest();
    cleanupChatDropdowns();
    detachEventListeners();
    
    // Reset state machine to IDLE
    if (ChatStateMachine.currentState !== ChatState.IDLE) {
        ChatStateMachine.setState(ChatState.IDLE, 'Cleanup all state');
    }
    
    // Reset background tasks counter to prevent memory leaks
    pendingBackgroundTasks = 0;
    updateBeforeUnloadHandler();
    
    isLoadingConversation = false;
    isInitialized = false;
    isAppInitializing = false;
}

// ============================================
// EVENT LISTENER MANAGEMENT
// Centralized attachment/detachment to prevent memory leaks
// ============================================

function attachEventListeners() {
    Logger.info('Attaching event listeners...', 'EventListeners');
    
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    
    if (messageInput) {
        messageInput.removeEventListener('keypress', handleEnterKey);
        messageInput.addEventListener('keypress', handleEnterKey);
    } else {
        Logger.warn('Message input not found', 'EventListeners');
    }
    
    if (sendBtn) {
        sendBtn.removeEventListener('click', handleSendMessage);
        sendBtn.addEventListener('click', handleSendMessage);
    } else {
        Logger.warn('Send button not found', 'EventListeners');
    }
    
    if (newChatBtn) {
        newChatBtn.removeEventListener('click', handleNewChatClick);
        newChatBtn.addEventListener('click', handleNewChatClick);
    } else {
        Logger.warn('New chat button not found', 'EventListeners');
    }
    
    if (!visibilityListenerAttached) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        visibilityListenerAttached = true;
    }
    
    Logger.info('Event listeners attached successfully', 'EventListeners');
}

function detachEventListeners() {
    Logger.info('Detaching event listeners...', 'EventListeners');
    
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    
    if (messageInput) {
        messageInput.removeEventListener('keypress', handleEnterKey);
    }
    
    if (sendBtn) {
        sendBtn.removeEventListener('click', handleSendMessage);
    }
    
    if (newChatBtn) {
        newChatBtn.removeEventListener('click', handleNewChatClick);
    }
    
    if (visibilityListenerAttached) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        visibilityListenerAttached = false;
    }
    
    Logger.info('Event listeners detached successfully', 'EventListeners');
}

if (typeof window !== 'undefined') {
    window.cleanupChatDropdowns = cleanupChatDropdowns;
    window.cleanupAllState = cleanupAllState;
    window.attachEventListeners = attachEventListeners;
    window.detachEventListeners = detachEventListeners;
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
        Logger.error(new Error('No user or conversation'), CHAT_CONTEXT);
        return;
    }
    
    try {
        const result = await withRetry(
            async () => {
                const saveResult = await withTimeout(saveMessageToSupabase(convId, uId, role, content), SAVE_TIMEOUT_MS);
                if (!saveResult.success) {
                    throw new Error(saveResult.error?.message || 'Save failed');
                }
                return saveResult;
            },
            MAX_RETRY_ATTEMPTS,
            RETRY_DELAY_MS
        );
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'saveMessage' });
    }
}

async function loadMessages() {
    if (!currentConversationId) {
        return [];
    }
    
    try {
        const result = await loadMessagesFromSupabase(currentConversationId);
        if (!result.success) {
            Logger.error(new Error(result.error?.message || 'Failed to load messages'), CHAT_CONTEXT);
            return [];
        }
        return result.data;
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'loadMessages' });
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
        avatar.innerHTML = `<img src="${NIMBUS_AVATAR_BASE64}" alt="Nimbus AI" class="message-avatar-logo">`;
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
                
                // Attach typing promise to the element for awaiting
                messageDiv.typingPromise = showTypingEffect(content, contentDiv);
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
        Logger.error(err, CHAT_CONTEXT, { operation: 'copyMessageText' });
    });
}

function showTypingEffect(content, contentDiv) {
    return new Promise((resolve) => {
        let resolved = false;
        let typingTimeout = null;
        
        const safeResolve = () => {
            if (resolved) return;
            resolved = true;
            if (typingTimeout) {
                clearTimeout(typingTimeout);
                typingTimeout = null;
            }
            cleanupTypingEffect();
            Logger.info('Resolved', 'TypingEffect');
            resolve();
        };
        
        // GUARANTEED RESOLUTION: Max 15 seconds for typing effect
        typingTimeout = setTimeout(() => {
            Logger.warn('Timeout - forcing completion', 'TypingEffect');
            // Show remaining content immediately
            try {
                const renderedContent = renderMessage(content);
                contentDiv.innerHTML = renderedContent;
            } catch (e) {
                contentDiv.textContent = typeof content === 'string' ? content : JSON.stringify(content);
            }
            safeResolve();
        }, TYPING_EFFECT_TIMEOUT_MS);
        
        // Cleanup any existing typing effect first
        cleanupTypingEffect();
        
        try {
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
                safeResolve();
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
            
            // Store interval globally for cleanup
            currentTypingInterval = setInterval(() => {
                if (resolved) {
                    clearInterval(currentTypingInterval);
                    currentTypingInterval = null;
                    return;
                }
                
                try {
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
                    if (chatContainer) {
                        const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
                        if (isNearBottom) {
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }
                    
                    if (globalWordIndex >= totalWords) {
                        cursor.remove();
                        safeResolve();
                    }
                } catch (err) {
                    Logger.error(err, 'TypingEffect', { operation: 'animation' });
                    cursor.remove();
                    safeResolve();
                }
            }, 60);
        } catch (err) {
            Logger.error(err, 'TypingEffect', { operation: 'render' });
            // Fallback: just show the content without animation
            contentDiv.textContent = typeof content === 'string' ? content : JSON.stringify(content);
            safeResolve();
        }
    });
}

function scrollToBottom(force = false) {
    const chatContainer = document.getElementById('chatContainer');
    const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
    
    if (force || isNearBottom) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

async function getAIResponse(userMessage, sessionId, userId) {
    // Cancel any existing AI request
    cancelAIRequest();
    
    // Create local abort controller for this request
    const localAbortController = new AbortController();
    currentAIAbortController = localAbortController;
    
    let timeoutId = null;
    let lastError = null;
    
    const cleanupController = () => {
        if (currentAIAbortController === localAbortController) {
            currentAIAbortController = null;
        }
    };
    
    try {
        // Retry loop for network instability
        for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                const companyFilter = document.getElementById('chatCompanyFilter');
                const selectedCompany = companyFilter ? companyFilter.value : '';
                
                const requestBody = {
                    message: userMessage,
                    sessionId: sessionId,
                    userId: userId,
                    companyKey: selectedCompany || null
                };
                
                // Create a timeout that aborts the local controller
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        // Only abort if this is still the current request
                        if (currentAIAbortController === localAbortController) {
                            localAbortController.abort();
                        }
                        reject(new Error('AI response timed out after 5 minutes'));
                    }, AI_FETCH_TIMEOUT_MS);
                });
                
                // Race between fetch and timeout
                const fetchPromise = fetch('https://wimedia.app.n8n.cloud/webhook/4c244caf-d1ff-42a1-82a2-917a51b2ca77', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: localAbortController.signal
                });
                
                const response = await Promise.race([fetchPromise, timeoutPromise]);
                
                // Clear timeout immediately on success
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const text = await response.text();
                
                if (!text || text.trim() === '') {
                    Logger.warn('Empty response from webhook', CHAT_CONTEXT);
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
                // Clear timeout on error
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                
                // Handle abort/cancellation - don't retry
                if (error.name === 'AbortError') {
                    Logger.info('AI request was cancelled', CHAT_CONTEXT);
                    throw new Error('Request was cancelled');
                }
                
                // Check if this is a network error that should be retried
                const isNetworkError = error.message.includes('network') || 
                                       error.message.includes('Network') ||
                                       error.message.includes('ERR_NETWORK') ||
                                       error.message.includes('Failed to fetch') ||
                                       error.name === 'TypeError';
                
                if (isNetworkError && attempt < MAX_RETRY_ATTEMPTS) {
                    Logger.warn(`Network error on attempt ${attempt}, retrying in ${RETRY_DELAY_MS}ms...`, CHAT_CONTEXT);
                    lastError = error;
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                    continue;
                }
                
                Logger.error(error, CHAT_CONTEXT, { operation: 'getAIResponse', attempt });
                throw error;
            }
        }
        
        // If we exhausted all retries, throw the last error
        if (lastError) {
            throw lastError;
        }
    } finally {
        // Clean up controller only after all retries are done
        cleanupController();
    }
}

async function handleSendMessage() {
    const input = document.getElementById('messageInput');
    
    // Early guard: Check state machine first to prevent double-submit
    if (!ChatStateMachine.canSendMessage()) {
        Logger.warn(`Cannot send - chat not in IDLE state: ${ChatStateMachine.getState()}`, 'SendMessage');
        return;
    }
    
    // Early guard: Validate input is not empty or whitespace
    const message = input ? input.value.trim() : '';
    if (!message) {
        Logger.info('Empty message, ignoring send request', 'SendMessage');
        return;
    }
    
    const user = getCurrentUser();
    if (!user) {
        showToast('Please log in to send messages', 'error');
        return;
    }
    
    // Transition to SENDING state (this disables input via state machine)
    ChatStateMachine.setState(ChatState.SENDING, 'User sent message');
    
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
        
        // Save user message (don't await, let it run in background with timeout)
        const userSavePromise = saveMessage('user', userMessage, convIdAtSend, userIdAtSend).catch(error => {
            Logger.error(error, 'SendMessage', { operation: 'saveUserMessage' });
            showToast('Failed to save message', 'error');
            return null;
        });
        
        const typingMessage = addMessageToUI('ai', '', true);
        
        // Transition to AWAITING_AI state
        ChatStateMachine.setState(ChatState.AWAITING_AI, 'Waiting for AI response');
        
        try {
            const sessionId = getOrCreateSessionId();
            const aiResponse = await getAIResponse(userMessage, sessionId, user.id);
            
            typingMessage.remove();
            
            // Transition to RENDERING state
            ChatStateMachine.setState(ChatState.RENDERING, 'Rendering AI response');
            
            // Handle async typing effect - await its completion (now has guaranteed timeout)
            const aiMessageDiv = addMessageToUI('ai', aiResponse, false, true);
            
            // Wait for typing effect to complete (guaranteed to resolve within 15s)
            if (aiMessageDiv && aiMessageDiv.typingPromise) {
                await aiMessageDiv.typingPromise;
            }
            
            const titleForConv = userMessage.length > 50 ? userMessage.substring(0, 50) + '...' : userMessage;
            
            // Save AI message (don't block on this)
            const aiSavePromise = saveMessage('ai', aiResponse, convIdAtSend, userIdAtSend).catch(error => {
                Logger.error(error, 'SendMessage', { operation: 'saveAIMessage' });
                return null;
            });
            
            // Wait for saves with timeout (don't let this block forever)
            await Promise.race([
                Promise.all([userSavePromise, aiSavePromise]),
                new Promise(resolve => setTimeout(resolve, 10000)) // Max 10s wait for saves
            ]);
            
            // Update title in background (non-blocking)
            updateConversationTitleIfNeeded(convIdAtSend, titleForConv).catch(err => {
                Logger.warn(`Title update failed: ${err.message}`, 'SendMessage');
            });
            
        } catch (error) {
            typingMessage.remove();
            cleanupTypingEffect();
            Logger.error(error, 'SendMessage', { operation: 'aiResponse' });
            
            ChatStateMachine.setState(ChatState.ERROR, 'AI response failed');
            
            const errorMessage = "I'm sorry, I'm having trouble connecting right now. Please try again.";
            addMessageToUI('ai', errorMessage);
            showToast('Failed to get AI response. Please check your connection and try again.', 'error');
            
            input.value = userMessage;
        }
    } catch (error) {
        handleError(error, 'Send message');
        showToast('Failed to send message. Please try again.', 'error');
        if (input) {
            input.value = message;
        }
        ChatStateMachine.setState(ChatState.ERROR, 'Send message failed');
    } finally {
        // ALWAYS return to IDLE state - this guarantees input is unlocked
        ChatStateMachine.setState(ChatState.IDLE, 'Message cycle complete');
        Logger.info('Cycle complete', 'SendMessage', { state: ChatStateMachine.getDebugInfo() });
    }
}

async function createNewConversation() {
    const user = getCurrentUser();
    if (!user) {
        Logger.error(new Error('No user logged in'), CHAT_CONTEXT);
        return null;
    }
    
    try {
        currentSessionId = generateUUID();
        const result = await createConversation(user.id, null, currentSessionId);
        if (!result.success) {
            Logger.error(new Error(result.error?.message || 'Failed to create conversation'), CHAT_CONTEXT);
            return null;
        }
        currentConversationId = result.data.id;
        return result.data;
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'createNewConversation' });
        return null;
    }
}

async function updateConversationTitleIfNeeded(conversationId, title) {
    try {
        const countResult = await withTimeout(getMessageCount(conversationId), 10000);
        const messageCount = countResult.success ? countResult.data : 0;
        
        if (messageCount === 2) {
            const updateResult = await withTimeout(updateConversationTitle(conversationId, title), 120000);
            if (updateResult.success) {
                const updated = updateSidebarTitleLocally(conversationId, title);
                if (!updated) {
                    loadConversationHistory().catch(() => {});
                }
            }
        }
    } catch (error) {
        Logger.warn(`Title update skipped: ${error.message}`, CHAT_CONTEXT);
    }
}

async function loadConversation(conversationId) {
    // Cancel any existing load operation and reset loading state
    cancelConversationLoad();
    
    // Create new abort controller and unique load ID for this operation
    currentLoadAbortController = new AbortController();
    currentLoadId++;
    const thisLoadId = currentLoadId;
    const loadRequestId = `load_${thisLoadId}_${Date.now()}`;
    isLoadingConversation = true;
    
    Logger.info(`START loading conversation: ${conversationId}`, 'LoadConv', { loadRequestId });
    
    // Wait for auth to settle if needed (after visibility change)
    if (typeof waitForAuthReady === 'function') {
        await waitForAuthReady();
    }
    
    // Verify session is valid before proceeding
    if (typeof ensureValidSession === 'function') {
        const session = await ensureValidSession();
        if (!session) {
            Logger.error(new Error('No valid session, aborting load'), 'LoadConv', { loadRequestId });
            isLoadingConversation = false;
            return;
        }
    }
    
    const messagesContainer = document.getElementById('messages');
    const previousConversationId = currentConversationId;
    
    // Add timeout for loading to prevent infinite loading state
    // Only trigger if this is still the active load
    const loadTimeout = setTimeout(() => {
        if (isLoadingConversation && thisLoadId === currentLoadId) {
            Logger.warn('Load timeout - resetting loading state', 'LoadConv');
            isLoadingConversation = false;
            messagesContainer.innerHTML = '<div class="error-message">Loading timed out. Click to try again.</div>';
        }
    }, 30000);
    
    try {
        hideWelcomeMessage();
        messagesContainer.innerHTML = `<div style="text-align: center; padding: 40px;"><div class="loading-spinner"><img src="${NIMBUS_AVATAR_BASE64}" alt="Loading"></div></div>`;
        
        // Check if this load is still current before making request
        if (thisLoadId !== currentLoadId || currentLoadAbortController?.signal.aborted) {
            throw new Error('Load cancelled');
        }
        
        Logger.info(`Calling getConversation...`, CHAT_CONTEXT, { loadRequestId });
        const result = await getConversation(conversationId);
        
        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to load conversation');
        }
        
        const conversation = result.data;
        Logger.info(`getConversation returned successfully`, CHAT_CONTEXT, { loadRequestId });
        
        // Check if this load is still current after getting conversation
        if (thisLoadId !== currentLoadId || currentLoadAbortController?.signal.aborted) {
            throw new Error('Load cancelled');
        }
        
        const loadedSessionId = conversation.session_id || generateUUID();
        
        currentConversationId = conversationId;
        currentSessionId = loadedSessionId;
        
        messagesContainer.innerHTML = '';
        
        Logger.info(`Calling loadMessages...`, 'LoadConv', { loadRequestId });
        const messages = await loadMessages();
        Logger.info(`loadMessages returned ${messages.length} messages`, 'LoadConv', { loadRequestId });
        
        // Check if this load is still current after loading messages
        if (thisLoadId !== currentLoadId || currentLoadAbortController?.signal.aborted) {
            throw new Error('Load cancelled');
        }
        
        if (messages.length === 0) {
            showWelcomeMessage();
        } else {
            hideWelcomeMessage();
            messages.forEach(msg => {
                addMessageToUI(msg.role, msg.content);
            });
        }
        
        Logger.info(`END - conversation loaded successfully`, 'LoadConv', { loadRequestId });
        
    } catch (error) {
        if (error.message === 'Load cancelled') {
            Logger.info(`Cancelled (load ID: ${thisLoadId})`, 'LoadConv', { loadRequestId });
            // Don't reset state here - a newer load may be in progress
            clearTimeout(loadTimeout);
            return;
        }
        Logger.error(error, 'LoadConv', { loadRequestId });
        // Only show error if this is still the current load
        if (thisLoadId === currentLoadId) {
            messagesContainer.innerHTML = '<div class="error-message">Failed to load conversation. Click to try again.</div>';
            showToast('Failed to load conversation', 'error');
            currentConversationId = previousConversationId;
        }
    } finally {
        clearTimeout(loadTimeout);
        // Only reset loading state if this is still the current load
        if (thisLoadId === currentLoadId) {
            isLoadingConversation = false;
            currentLoadAbortController = null;
        }
    }
}

async function loadConversationHistory() {
    const user = getCurrentUser();
    if (!user) return [];
    
    const historyContainer = document.getElementById('chatHistory');
    
    try {
        historyContainer.innerHTML = '<div style="padding: 16px; text-align: center;"><div class="spinner"></div></div>';
        
        const result = await getUserConversations(user.id);
        historyContainer.innerHTML = '';
        
        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to load conversations');
        }
        
        const conversations = result.data;
        
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
                cancelConversationLoad();
                isLoadingConversation = false;
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
        Logger.error(error, CHAT_CONTEXT, { operation: 'loadConversationHistory' });
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
        
        const result = await updateConversationTitle(conversationId, newTitle.trim());
        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to rename conversation');
        }
        
        await loadConversationHistory();
        showToast('Chat renamed successfully', 'success');
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'handleRenameConversation' });
        showToast('Failed to rename chat', 'error');
    }
}

async function handleDeleteConversation(conversationId) {
    try {
        const confirmed = confirm('Are you sure you want to delete this conversation? This action cannot be undone.');
        if (!confirmed) return;
        
        document.querySelectorAll('.chat-item-dropdown').forEach(d => d.classList.remove('show'));
        document.querySelectorAll('.chat-item-menu-btn').forEach(b => b.classList.remove('active'));
        
        const result = await deleteConversation(conversationId);
        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to delete conversation');
        }
        
        if (conversationId === currentConversationId) {
            currentConversationId = null;
            currentSessionId = null;
            document.getElementById('messages').innerHTML = '<div style="text-align: center; padding: 40px; color: #9aa0a6;">Select a conversation or start a new chat</div>';
        }
        
        await loadConversationHistory();
        showToast('Conversation deleted successfully', 'success');
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'handleDeleteConversation' });
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
    Logger.info('Button clicked', 'NewChat');
    try {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';
        
        showWelcomeMessage();
        
        Logger.info('Creating new conversation...', 'NewChat');
        const result = await createNewConversation();
        Logger.info(`createNewConversation result, currentConversationId: ${currentConversationId}`, 'NewChat', { result });
        
        if (currentConversationId) {
            Logger.info('Loading conversation history...', 'NewChat');
            await loadConversationHistory();
            Logger.info('Conversation history loaded', 'NewChat');
        } else {
            throw new Error('Failed to create new conversation');
        }
    } catch (error) {
        Logger.error(error, 'NewChat');
        handleError(error, 'Create new chat');
    }
}

let chatCompaniesData = [];
const chatCompanyLogoMap = new Map();

async function populateChatCompanyFilter() {
    const companyFilter = document.getElementById('chatCompanyFilter');
    
    if (!companyFilter) return;
    
    try {
        const supabase = getSupabase();
        
        const { data, error } = await supabase
            .from('companies')
            .select('company_key, name, logo_url')
            .order('company_key', { ascending: true });
        
        if (error) {
            Logger.error(error, CHAT_CONTEXT, { operation: 'populateChatCompanyFilter' });
            return;
        }
        
        chatCompaniesData = data || [];
        
        chatCompanyLogoMap.clear();
        chatCompaniesData.forEach(company => {
            if (company.logo_url) {
                if (company.company_key) {
                    chatCompanyLogoMap.set(company.company_key.toLowerCase(), company.logo_url);
                }
                if (company.name) {
                    chatCompanyLogoMap.set(company.name.toLowerCase(), company.logo_url);
                }
            }
        });
        
        const currentValue = companyFilter.value;
        companyFilter.innerHTML = '<option value="">All Companies</option>';
        
        if (data && data.length > 0) {
            data.forEach(company => {
                if (company.company_key) {
                    const option = document.createElement('option');
                    option.value = company.company_key;
                    option.textContent = company.name || company.company_key;
                    option.dataset.logoUrl = company.logo_url || '';
                    companyFilter.appendChild(option);
                }
            });
        }
        
        if (currentValue) {
            companyFilter.value = currentValue;
        }
        
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'populateChatCompanyFilter' });
    }
}

function getChatCompanyLogo(companyIdentifier) {
    if (!companyIdentifier) return null;
    const normalizedKey = String(companyIdentifier).toLowerCase().trim();
    return chatCompanyLogoMap.get(normalizedKey) || null;
}

window.getChatCompanyLogo = getChatCompanyLogo;

async function initializeChat() {
    if (isInitialized) {
        Logger.info('Chat already initialized, skipping', CHAT_CONTEXT);
        return;
    }
    
    Logger.info('Initializing chat module...', CHAT_CONTEXT);
    
    const user = getCurrentUser();
    if (!user) {
        Logger.error(new Error('User not authenticated'), CHAT_CONTEXT);
        return;
    }
    
    Logger.info('User authenticated, loading chat data...', CHAT_CONTEXT, { userId: user.id });
    
    try {
        await populateChatCompanyFilter();
        Logger.info('Company filter populated', CHAT_CONTEXT);
        
        const conversations = await loadConversationHistory();
        Logger.info(`Loaded ${conversations.length} conversations`, CHAT_CONTEXT);
        
        if (conversations.length > 0) {
            await loadConversation(conversations[0].id);
        } else {
            await createNewConversation();
            showWelcomeMessage();
        }
    } catch (error) {
        Logger.error(error, CHAT_CONTEXT, { operation: 'initializeChat' });
        showToast('Failed to load chat. Please refresh the page.', 'error');
        return;
    }
    
    // Attach all event listeners using centralized function
    attachEventListeners();
    
    isInitialized = true;
    Logger.info('Chat initialization complete', CHAT_CONTEXT);
}

// ============================================
// LIFECYCLE MANAGER
// Ensures proper initialization order
// ============================================
const Chat = {
    initialize: initializeChat,
    isInitialized: () => isInitialized
};

async function initApp() {
    // Prevent double initialization
    if (isAppInitializing || appLifecycleReady) {
        Logger.info('App initialization already in progress or complete, skipping duplicate call', APP_CONTEXT);
        return;
    }
    
    isAppInitializing = true;
    Logger.info('Application lifecycle starting...', APP_CONTEXT);
    
    // Step 1: DOM is already ready (called from DOMContentLoaded)
    Logger.info('Step 1: DOM ready', APP_CONTEXT);
    
    // Step 2: Initialize authentication and wait for it
    Logger.info('Step 2: Initializing authentication...', APP_CONTEXT);
    
    try {
        // Use the Auth interface for initialization
        const session = await Auth.initialize();
        
        // Get user from Auth interface after initialization is complete
        const user = Auth.getCurrentUser();
        
        if (!session && !user) {
            Logger.warn('No active session found', APP_CONTEXT);
            if (!window.location.pathname.includes('login.html')) {
                Logger.info('Redirecting to login page...', APP_CONTEXT);
                window.location.href = '/login.html';
                return;
            }
            return;
        }
        
        Logger.info('Authentication confirmed', APP_CONTEXT, { 
            userId: user?.id,
            email: user?.email 
        });
        
        // Step 3: Initialize chat ONLY after auth is confirmed
        Logger.info('Step 3: Initializing chat module...', APP_CONTEXT);
        await Chat.initialize();
        
        appLifecycleReady = true;
        isAppInitializing = false;
        Logger.info('Application lifecycle complete - app is ready', APP_CONTEXT);
        
    } catch (error) {
        Logger.error(error, APP_CONTEXT, { operation: 'initApp' });
        showToast('Failed to initialize application. Please refresh the page.', 'error');
        isAppInitializing = false;
    }
}

// Start the application lifecycle when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Logger.info('DOMContentLoaded event fired', APP_CONTEXT);
        initApp();
    });
} else {
    Logger.info('DOM already ready, starting app...', APP_CONTEXT);
    initApp();
}

// Export for external access
if (typeof window !== 'undefined') {
    window.initApp = initApp;
    window.Chat = Chat;
    window.isAppReady = () => appLifecycleReady;
}
