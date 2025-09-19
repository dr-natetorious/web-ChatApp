/**
 * ChitChat UI Components - Focused Web Components
 * Extracted from main ChitChatComponent for better maintainability
 */

console.log('[ChitChat Components] Loading components file...');

/**
 * Chat Header Component
 * Handles avatar, title, status, and action buttons
 */
class ChatHeader extends HTMLElement {
    constructor() {
        super();
        this.eventListeners = [];
    }
    
    connectedCallback() {
        this.render();
        this.setupEvents();
    }
    
    disconnectedCallback() {
        this.cleanup();
    }
    
    render() {
        const title = this.getAttribute('title') || 'Support Chat';
        const avatar = this.getAttribute('avatar') || null;
        const status = this.getAttribute('status') || 'online';
        const showHelp = this.hasAttribute('show-help');
        const showClear = this.hasAttribute('show-clear');
        const showMinimize = this.hasAttribute('show-minimize');
        
        this.innerHTML = `
            <div class="chitchat-header d-flex align-items-center justify-content-between">
                <div class="chat-info d-flex align-items-center">
                    ${avatar ? `
                        <img src="${avatar}" alt="Support" class="chat-avatar rounded-circle me-2" width="32" height="32">
                    ` : `
                        <div class="chat-avatar-placeholder rounded-circle me-2 d-flex align-items-center justify-content-center">
                            <i class="bi bi-person-fill"></i>
                        </div>
                    `}
                    <div>
                        <div class="chat-title fw-bold">${this.escapeHtml(title)}</div>
                        <div class="chat-status">
                            <span class="status-indicator status-${status}"></span>
                            <small class="text-muted">${status === 'online' ? 'Online' : 'Away'}</small>
                        </div>
                    </div>
                </div>
                
                <div class="chat-actions d-flex gap-1">
                    ${showHelp ? `
                        <button class="btn btn-sm btn-outline-secondary" data-action="help" title="Help">
                            <i class="bi bi-question-circle"></i>
                        </button>
                    ` : ''}
                    ${showClear ? `
                        <button class="btn btn-sm btn-outline-secondary" data-action="clear" title="Clear Chat">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                    ${showMinimize ? `
                        <button class="btn btn-sm btn-outline-secondary" data-action="minimize" title="Minimize">
                            <i class="bi bi-dash"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-secondary" data-action="close" title="Close">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    setupEvents() {
        const buttons = this.querySelectorAll('[data-action]');
        buttons.forEach(btn => {
            const handler = (e) => {
                const action = btn.getAttribute('data-action');
                this.dispatchEvent(new CustomEvent('header-action', {
                    bubbles: true,
                    detail: { action }
                }));
            };
            this.addEventListenerTracked(btn, 'click', handler);
        });
    }
    
    addEventListenerTracked(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }
    
    cleanup() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Chat Messages Component
 * Handles message display, scrolling, and typing indicator
 */
class ChatMessages extends HTMLElement {
    constructor() {
        super();
        this.eventListeners = [];
        this.messages = [];
        this.isTyping = false;
    }
    
    connectedCallback() {
        this.render();
        this.setupEvents();
    }
    
    disconnectedCallback() {
        this.cleanup();
    }
    
    render() {
        this.innerHTML = `
            <div class="chitchat-messages" style="flex: 1; overflow-y: auto; padding: 1rem;">
                <div class="messages-container"></div>
                <div class="typing-indicator" style="display: none;">
                    <div class="typing-animation d-flex align-items-center">
                        <div class="typing-dots me-2">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <small class="text-muted">Support is typing...</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupEvents() {
        // Listen for new messages
        this.addEventListenerTracked(this, 'add-message', this.handleAddMessage.bind(this));
        this.addEventListenerTracked(this, 'clear-messages', this.handleClearMessages.bind(this));
        this.addEventListenerTracked(this, 'show-typing', this.showTypingIndicator.bind(this));
        this.addEventListenerTracked(this, 'hide-typing', this.hideTypingIndicator.bind(this));
    }
    
    handleAddMessage(e) {
        const messageData = e.detail;
        this.addMessage(messageData);
    }
    
    handleClearMessages() {
        this.clear();
    }
    
    addMessage(messageData) {
        this.messages.push(messageData);
        
        const messageElement = this.createMessageElement(messageData);
        const container = this.querySelector('.messages-container');
        container.appendChild(messageElement);
        
        // Auto-scroll to bottom
        this.scrollToBottom();
        
        // Dispatch event for message added
        this.dispatchEvent(new CustomEvent('message-added', {
            bubbles: true,
            detail: { message: messageData, element: messageElement }
        }));
    }
    
    createMessageElement(message) {
        // Use the same rendering logic as the main ChitChat component
        // to support all message types (charts, tables, etc.)
        
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${message.type} ${message.sender || 'user'}`;
        messageElement.setAttribute('data-message-id', message.id);

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';

        // Create web component for message using the same mapping as ChitChat
        const componentMap = {
            'text': 'chitchat-text-message',
            'table': 'chitchat-table-message', 
            'quick_reply': 'chitchat-quick-reply-message',
            'image': 'chitchat-image-message',
            'chart': 'chitchat-chart-message'
        };
        
        const componentName = componentMap[message.type];
        
        if (componentName) {
            console.log(`[ChatMessages] Creating ${componentName} for message type: ${message.type}`);
            const messageComponent = document.createElement(componentName);
            messageComponent.setAttribute('data-message', JSON.stringify(message));
            
            // Handle quick reply events - bubble up to parent
            if (message.type === 'quick_reply') {
                messageComponent.addEventListener('quick-reply-selected', (e) => {
                    this.dispatchEvent(new CustomEvent('quick-reply-selected', {
                        bubbles: true,
                        detail: e.detail
                    }));
                });
            }
            
            messageBubble.appendChild(messageComponent);
            
        } else {
            // Fallback to text content
            console.warn(`[ChatMessages] No component mapping for type: ${message.type}, using fallback`);
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'message-content';
            fallbackDiv.textContent = message.content || `[Unsupported message type: ${message.type}]`;
            messageBubble.appendChild(fallbackDiv);
        }
        
        messageElement.appendChild(messageBubble);

        // Add timestamp if message has one
        if (message.timestamp) {
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'message-timestamp';
            timestampDiv.textContent = this.formatTimestamp(message.timestamp);
            messageElement.appendChild(timestampDiv);
        }

        return messageElement;
    }
    
    clear() {
        this.messages = [];
        const container = this.querySelector('.messages-container');
        if (container) {
            container.innerHTML = '';
        }
    }
    
    showTypingIndicator() {
        const indicator = this.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = 'block';
            this.scrollToBottom();
        }
    }
    
    hideTypingIndicator() {
        const indicator = this.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
    
    scrollToBottom() {
        const messagesArea = this.querySelector('.chitchat-messages');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
    
    addEventListenerTracked(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }
    
    cleanup() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

/**
 * Chat Resizer Component
 * Handles drag-to-resize functionality
 */
class ChatResizer extends HTMLElement {
    constructor() {
        super();
        this.eventListeners = [];
        this.isResizing = false;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
    }
    
    connectedCallback() {
        this.render();
        this.setupEvents();
    }
    
    disconnectedCallback() {
        this.cleanup();
    }
    
    render() {
        const direction = this.getAttribute('direction') || 'both'; // 'horizontal', 'vertical', 'both'
        
        this.innerHTML = `
            <div class="chat-resizer ${direction}" title="Drag to resize">
                ${direction === 'both' || direction === 'horizontal' ? '<div class="resize-handle-h"></div>' : ''}
                ${direction === 'both' || direction === 'vertical' ? '<div class="resize-handle-v"></div>' : ''}
                ${direction === 'both' ? '<div class="resize-handle-corner"></div>' : ''}
            </div>
        `;
    }
    
    setupEvents() {
        const handles = this.querySelectorAll('.resize-handle-h, .resize-handle-v, .resize-handle-corner');
        
        handles.forEach(handle => {
            this.addEventListenerTracked(handle, 'mousedown', this.startResize.bind(this));
            this.addEventListenerTracked(handle, 'touchstart', this.startResize.bind(this));
        });
        
        this.addEventListenerTracked(document, 'mousemove', this.handleResize.bind(this));
        this.addEventListenerTracked(document, 'touchmove', this.handleResize.bind(this));
        this.addEventListenerTracked(document, 'mouseup', this.stopResize.bind(this));
        this.addEventListenerTracked(document, 'touchend', this.stopResize.bind(this));
    }
    
    startResize(e) {
        this.isResizing = true;
        const event = e.touches ? e.touches[0] : e;
        
        this.startX = event.clientX;
        this.startY = event.clientY;
        
        // Find the chat container to resize
        const chatContainer = this.closest('chitchat-component');
        if (chatContainer) {
            const rect = chatContainer.getBoundingClientRect();
            this.startWidth = rect.width;
            this.startHeight = rect.height;
        }
        
        e.preventDefault();
    }
    
    handleResize(e) {
        if (!this.isResizing) return;
        
        const event = e.touches ? e.touches[0] : e;
        const deltaX = event.clientX - this.startX;
        const deltaY = event.clientY - this.startY;
        
        const chatContainer = this.closest('chitchat-component');
        if (chatContainer) {
            const newWidth = Math.max(300, this.startWidth + deltaX);
            const newHeight = Math.max(400, this.startHeight + deltaY);
            
            chatContainer.style.width = newWidth + 'px';
            chatContainer.style.height = newHeight + 'px';
            
            // Dispatch resize event
            this.dispatchEvent(new CustomEvent('chat-resized', {
                bubbles: true,
                detail: { width: newWidth, height: newHeight }
            }));
        }
        
        e.preventDefault();
    }
    
    stopResize() {
        this.isResizing = false;
    }
    
    addEventListenerTracked(element, event, handler) {
        element.addEventListener(event, handler);
        this.eventListeners.push({ element, event, handler });
    }
    
    cleanup() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
    }
}

// Register all components
customElements.define('chat-header', ChatHeader);
customElements.define('chat-messages', ChatMessages);
customElements.define('chat-resizer', ChatResizer);

// Debug: Log component registration
console.log('[ChitChat Components] Registered chat-header, chat-messages, chat-resizer components');
