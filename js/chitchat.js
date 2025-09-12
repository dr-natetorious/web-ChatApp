/**
 * ChitChat - Professional Chat Interface Web Component
 * A modern, extensible chat interface with rich message support
 * Built with vanilla JavaScript and Bootstrap 5.3
 */

class ChitChatComponent extends HTMLElement {
    constructor() {
        super();
        
        // Initialize properties
        this.messages = [];
        this.messageHandlers = new Map();
        this.isTyping = false;
        this.eventListeners = {};
        
        // Default options
        this.options = {
            theme: 'light',
            enableEmoji: true,
            enableFileUpload: true,
            enableRichMessages: true,
            maxMessages: 1000,
            autoScroll: true,
            showTimestamps: true,
            showTypingIndicator: true,
            animationDuration: 300,
            currentUser: { id: 'user', name: 'You', avatar: null }
        };
    }

    static get observedAttributes() {
        return [
            'theme', 
            'current-user', 
            'enable-emoji', 
            'enable-file-upload', 
            'enable-rich-messages',
            'max-messages',
            'auto-scroll',
            'show-timestamps',
            'show-typing-indicator'
        ];
    }

    connectedCallback() {
        this.parseAttributes();
        this.init();
    }

    disconnectedCallback() {
        this.cleanup();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.parseAttributes();
            if (this.isConnected) {
                this.updateFromAttributes(name, newValue);
            }
        }
    }

    parseAttributes() {
        // Parse boolean attributes
        this.options.enableEmoji = this.hasAttribute('enable-emoji');
        this.options.enableFileUpload = this.hasAttribute('enable-file-upload');
        this.options.enableRichMessages = this.hasAttribute('enable-rich-messages');
        this.options.autoScroll = this.hasAttribute('auto-scroll');
        this.options.showTimestamps = this.hasAttribute('show-timestamps');
        this.options.showTypingIndicator = this.hasAttribute('show-typing-indicator');
        
        // Parse string attributes
        if (this.hasAttribute('theme')) {
            this.options.theme = this.getAttribute('theme');
        }
        
        // Parse number attributes
        if (this.hasAttribute('max-messages')) {
            this.options.maxMessages = parseInt(this.getAttribute('max-messages')) || 1000;
        }
        
        // Parse JSON attributes
        if (this.hasAttribute('current-user')) {
            try {
                this.options.currentUser = JSON.parse(this.getAttribute('current-user'));
            } catch (e) {
                console.warn('Invalid current-user JSON:', e);
            }
        }
    }

    updateFromAttributes(name, newValue) {
        switch (name) {
            case 'theme':
                this.setTheme(newValue);
                break;
            case 'current-user':
                try {
                    this.options.currentUser = JSON.parse(newValue);
                } catch (e) {
                    console.warn('Invalid current-user JSON:', e);
                }
                break;
        }
    }

    init() {
        this.createChatInterface();
        this.setupEventListeners();
        this.registerDefaultMessageTypes();
        
        // Show welcome message
        this.addMessage({
            type: 'system',
            content: 'Chat initialized. Welcome to ChitChat!',
            timestamp: new Date()
        });

        // Dispatch custom event
        this.dispatchEvent(new CustomEvent('chitchat:initialized', {
            detail: { component: this },
            bubbles: true
        }));
    }

    createChatInterface() {
        this.innerHTML = `
            <div class="chitchat-container" data-theme="${this.options.theme}">
                <!-- Chat Header -->
                <div class="chitchat-header">
                    <div class="d-flex align-items-center">
                        <div class="chat-avatar me-3">
                            <div class="avatar-placeholder bg-primary text-white rounded-circle d-flex align-items-center justify-content-center">
                                <i class="bi bi-chat-dots-fill"></i>
                            </div>
                        </div>
                        <div class="flex-grow-1">
                            <h6 class="mb-0 fw-semibold">SecureBank Support</h6>
                            <small class="text-muted">
                                <span class="status-indicator online"></span>
                                Online - Typically replies instantly
                            </small>
                        </div>
                        <div class="chat-actions">
                            <button class="btn btn-sm btn-outline-secondary me-2" data-action="minimize">
                                <i class="bi bi-dash-lg"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-secondary" data-action="close">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Chat Messages Area -->
                <div class="chitchat-messages" id="chitchat-messages">
                    <div class="messages-container"></div>
                    <div class="typing-indicator" style="display: none;">
                        <div class="typing-animation">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <small class="text-muted ms-2">Support is typing...</small>
                    </div>
                </div>

                <!-- Chat Input Area -->
                <div class="chitchat-input">
                    <div class="input-group">
                        ${this.options.enableEmoji ? `
                        <button class="btn btn-outline-secondary" type="button" data-action="emoji">
                            <i class="bi bi-emoji-smile"></i>
                        </button>
                        ` : ''}
                        ${this.options.enableFileUpload ? `
                        <button class="btn btn-outline-secondary" type="button" data-action="attach">
                            <i class="bi bi-paperclip"></i>
                        </button>
                        ` : ''}
                        <input type="text" class="form-control" placeholder="Type your message..." 
                               id="chitchat-input" autocomplete="off">
                        <button class="btn btn-primary" type="button" data-action="send">
                            <i class="bi bi-send-fill"></i>
                        </button>
                    </div>
                    <div class="input-suggestions" style="display: none;"></div>
                </div>

                <!-- File Upload Modal -->
                ${this.options.enableFileUpload ? `
                <div class="file-upload-area" style="display: none;">
                    <div class="upload-zone">
                        <i class="bi bi-cloud-upload fs-1 text-muted"></i>
                        <p class="text-muted">Drop files here or click to upload</p>
                        <input type="file" id="file-input" multiple accept="image/*,.pdf,.doc,.docx">
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('chitchat-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'chitchat-styles';
        styles.textContent = `
            .chitchat-container {
                border: 1px solid var(--bs-border-color);
                border-radius: 16px;
                background: white;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                overflow: hidden;
                max-width: 400px;
                height: 600px;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .chitchat-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }

            .chat-avatar .avatar-placeholder {
                width: 40px;
                height: 40px;
                font-size: 18px;
            }

            .status-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 6px;
            }

            .status-indicator.online {
                background: #28a745;
                box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.3);
            }

            .chitchat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8f9fa;
                scroll-behavior: smooth;
            }

            .message {
                margin-bottom: 16px;
                opacity: 0;
                transform: translateY(20px);
                animation: messageSlideIn 0.3s ease-out forwards;
            }

            @keyframes messageSlideIn {
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .message-bubble {
                max-width: 80%;
                padding: 12px 16px;
                border-radius: 18px;
                word-wrap: break-word;
                position: relative;
            }

            .message.sent {
                text-align: right;
            }

            .message.sent .message-bubble {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                margin-left: auto;
                border-bottom-right-radius: 6px;
            }

            .message.received .message-bubble {
                background: white;
                color: #333;
                border: 1px solid #e9ecef;
                border-bottom-left-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }

            .message.system .message-bubble {
                background: #e3f2fd;
                color: #1976d2;
                text-align: center;
                border-radius: 12px;
                font-size: 0.875rem;
                margin: 0 auto;
            }

            .message-timestamp {
                font-size: 0.75rem;
                color: #6c757d;
                margin-top: 4px;
            }

            .message.sent .message-timestamp {
                text-align: right;
            }

            .typing-indicator {
                display: flex;
                align-items: center;
                padding: 8px 0;
            }

            .typing-animation {
                display: flex;
                gap: 4px;
            }

            .typing-animation span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #6c757d;
                animation: typingDot 1.4s infinite ease-in-out;
            }

            .typing-animation span:nth-child(1) { animation-delay: -0.32s; }
            .typing-animation span:nth-child(2) { animation-delay: -0.16s; }

            @keyframes typingDot {
                0%, 80%, 100% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            .chitchat-input {
                padding: 16px 20px;
                background: white;
                border-top: 1px solid #e9ecef;
            }

            .chitchat-input .form-control {
                border: 1px solid #e9ecef;
                border-radius: 24px;
                padding: 12px 16px;
                transition: all 0.2s ease;
            }

            .chitchat-input .form-control:focus {
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }

            .chitchat-input .btn {
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            }

            .chitchat-input .btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .file-upload-area {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
            }

            .upload-zone {
                border: 2px dashed #dee2e6;
                border-radius: 12px;
                padding: 40px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .upload-zone:hover {
                border-color: #667eea;
                background: rgba(102, 126, 234, 0.05);
            }

            .message-rich-content {
                margin-top: 8px;
            }

            .message-image {
                max-width: 100%;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s ease;
            }

            .message-image:hover {
                transform: scale(1.02);
            }

            .message-table {
                width: 100%;
                font-size: 0.875rem;
                margin-top: 8px;
            }

            .message-table th,
            .message-table td {
                padding: 8px 12px;
                border: 1px solid rgba(0,0,0,0.1);
            }

            .message-table th {
                background: rgba(0,0,0,0.05);
                font-weight: 600;
            }

            .quick-replies {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }

            .quick-reply-btn {
                background: rgba(255,255,255,0.9);
                border: 1px solid rgba(0,0,0,0.1);
                border-radius: 16px;
                padding: 6px 12px;
                font-size: 0.875rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .quick-reply-btn:hover {
                background: white;
                border-color: #667eea;
                color: #667eea;
                transform: translateY(-1px);
            }

            /* Dark theme support */
            .chitchat-container[data-theme="dark"] {
                background: #1a1a1a;
                color: white;
            }

            .chitchat-container[data-theme="dark"] .chitchat-messages {
                background: #2d2d2d;
            }

            .chitchat-container[data-theme="dark"] .message.received .message-bubble {
                background: #3a3a3a;
                color: white;
                border-color: #555;
            }

            /* Mobile responsiveness */
            @media (max-width: 768px) {
                .chitchat-container {
                    max-width: 100%;
                    height: 100vh;
                    border-radius: 0;
                }
                
                .message-bubble {
                    max-width: 85%;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    setupEventListeners() {
        const input = this.querySelector('#chitchat-input');
        const sendBtn = this.querySelector('[data-action="send"]');
        const attachBtn = this.querySelector('[data-action="attach"]');
        const emojiBtn = this.querySelector('[data-action="emoji"]');
        const fileInput = this.querySelector('#file-input');

        // Send message on Enter or button click
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Auto-resize input and show typing indicator
            input.addEventListener('input', () => {
                this.handleInputChange();
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // File attachment
        if (attachBtn) {
            attachBtn.addEventListener('click', () => this.toggleFileUpload());
        }
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // Emoji picker (placeholder)
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.toggleEmojiPicker());
        }

        // Header actions
        this.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'minimize') this.minimize();
            if (action === 'close') this.close();
        });

        // Quick reply handling
        this.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-reply-btn')) {
                this.sendMessage(e.target.textContent.trim());
            }
        });
    }

    registerDefaultMessageTypes() {
        // Register built-in message type handlers
        this.registerMessageType('text', this.renderTextMessage.bind(this));
        this.registerMessageType('image', this.renderImageMessage.bind(this));
        this.registerMessageType('table', this.renderTableMessage.bind(this));
        this.registerMessageType('system', this.renderSystemMessage.bind(this));
        this.registerMessageType('quick_reply', this.renderQuickReplyMessage.bind(this));
    }

    registerMessageType(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    addMessage(messageData) {
        const message = {
            id: Date.now() + Math.random(),
            type: 'text',
            sender: null,
            timestamp: new Date(),
            ...messageData
        };

        this.messages.push(message);
        
        // Limit message history
        if (this.messages.length > this.options.maxMessages) {
            this.messages = this.messages.slice(-this.options.maxMessages);
        }

        this.renderMessage(message);
        
        if (this.options.autoScroll) {
            this.scrollToBottom();
        }

        return message;
    }

    renderMessage(message) {
        const messagesContainer = this.querySelector('.messages-container');
        const messageElement = document.createElement('div');
        
        const senderClass = message.sender === this.options.currentUser.id ? 'sent' : 
                           message.type === 'system' ? 'system' : 'received';
        
        messageElement.className = `message ${senderClass}`;
        messageElement.dataset.messageId = message.id;

        const handler = this.messageHandlers.get(message.type) || this.renderTextMessage;
        const content = handler(message);
        
        messageElement.innerHTML = `
            <div class="message-bubble">
                ${content}
            </div>
            ${this.options.showTimestamps ? `
                <div class="message-timestamp">
                    ${this.formatTimestamp(message.timestamp)}
                </div>
            ` : ''}
        `;

        messagesContainer.appendChild(messageElement);

        // Trigger animation
        requestAnimationFrame(() => {
            messageElement.style.animationDelay = '0s';
        });

        // Dispatch message added event
        this.dispatchEvent(new CustomEvent('chitchat:message-added', {
            detail: { message, element: messageElement },
            bubbles: true
        }));
    }

    renderTextMessage(message) {
        return this.escapeHtml(message.content);
    }

    renderImageMessage(message) {
        return `
            <div class="message-rich-content">
                <img src="${message.url}" alt="${message.alt || 'Image'}" 
                     class="message-image" onclick="window.open('${message.url}', '_blank')">
                ${message.caption ? `<div class="mt-2">${this.escapeHtml(message.caption)}</div>` : ''}
            </div>
        `;
    }

    renderTableMessage(message) {
        const headers = message.headers || [];
        const rows = message.rows || [];
        
        return `
            <div class="message-rich-content">
                ${message.title ? `<strong>${this.escapeHtml(message.title)}</strong>` : ''}
                <table class="table table-sm message-table">
                    ${headers.length ? `
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('')}
                            </tr>
                        </thead>
                    ` : ''}
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                ${row.map(cell => `<td>${this.escapeHtml(cell)}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderSystemMessage(message) {
        return `<i class="bi bi-info-circle me-2"></i>${this.escapeHtml(message.content)}`;
    }

    renderQuickReplyMessage(message) {
        return `
            ${this.escapeHtml(message.content)}
            <div class="quick-replies">
                ${message.replies.map(reply => 
                    `<button class="quick-reply-btn">${this.escapeHtml(reply)}</button>`
                ).join('')}
            </div>
        `;
    }

    sendMessage(content = null) {
        const input = this.querySelector('#chitchat-input');
        const messageContent = content || input?.value.trim();
        
        if (!messageContent) return;

        // Add user message
        this.addMessage({
            type: 'text',
            content: messageContent,
            sender: this.options.currentUser.id
        });

        // Clear input
        if (input) input.value = '';
        
        // Dispatch message sent event
        this.dispatchEvent(new CustomEvent('chitchat:message-sent', {
            detail: { content: messageContent, user: this.options.currentUser },
            bubbles: true
        }));
        
        // Simulate typing and response (for demo)
        if (this.options.showTypingIndicator) {
            this.showTypingIndicator();
            setTimeout(() => {
                this.hideTypingIndicator();
                this.simulateResponse(messageContent);
            }, 1000 + Math.random() * 2000);
        }
    }

    simulateResponse(userMessage) {
        // Simple response simulation for demo
        const responses = [
            "Thank you for your message. How can I assist you today?",
            "I understand your concern. Let me help you with that.",
            "That's a great question! Here's what I can tell you...",
            "I'd be happy to help you resolve this issue."
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        this.addMessage({
            type: 'text',
            content: randomResponse,
            sender: 'support'
        });
    }

    showTypingIndicator() {
        const indicator = this.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
            this.scrollToBottom();
            this.isTyping = true;
        }
    }

    hideTypingIndicator() {
        const indicator = this.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
            this.isTyping = false;
        }
    }

    scrollToBottom() {
        const messagesArea = this.querySelector('.chitchat-messages');
        if (messagesArea) {
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }

    toggleFileUpload() {
        const fileArea = this.querySelector('.file-upload-area');
        if (fileArea) {
            const isVisible = fileArea.style.display !== 'none';
            fileArea.style.display = isVisible ? 'none' : 'flex';
        }
    }

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                // Handle image upload
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.addMessage({
                        type: 'image',
                        url: e.target.result,
                        caption: file.name,
                        sender: this.options.currentUser.id
                    });
                };
                reader.readAsDataURL(file);
            } else {
                // Handle other file types
                this.addMessage({
                    type: 'text',
                    content: `📎 Uploaded: ${file.name}`,
                    sender: this.options.currentUser.id
                });
            }
        });
        
        this.toggleFileUpload();
        event.target.value = ''; // Reset file input
    }

    toggleEmojiPicker() {
        // Placeholder for emoji picker
        console.log('Emoji picker would open here');
    }

    handleInputChange() {
        // Handle typing indicators, suggestions, etc.
        const input = this.container.querySelector('#chitchat-input');
        if (input.value.length > 0 && !this.isTyping) {
            // Could trigger typing indicator to other users
        }
    }

    formatTimestamp(timestamp) {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        
        return messageTime.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    minimize() {
        this.container.style.transform = 'scale(0.8)';
        this.container.style.opacity = '0.8';
        console.log('Chat minimized');
    }

    close() {
        this.container.style.transform = 'scale(0)';
        this.container.style.opacity = '0';
        setTimeout(() => {
            this.container.style.display = 'none';
        }, 300);
        console.log('Chat closed');
    }

    // Public API methods
    clear() {
        this.messages = [];
        this.container.querySelector('.messages-container').innerHTML = '';
    }

    setTheme(theme) {
        this.options.theme = theme;
        const container = this.querySelector('.chitchat-container');
        if (container) {
            container.dataset.theme = theme;
        }
    }

    // Public API methods for backward compatibility
    addQuickReply(content, replies) {
        return this.addMessage({
            type: 'quick_reply',
            content: content,
            replies: replies,
            sender: 'support'
        });
    }

    addTable(title, headers, rows) {
        return this.addMessage({
            type: 'table',
            title: title,
            headers: headers,
            rows: rows,
            sender: 'support'
        });
    }

    addImage(url, caption = '') {
        return this.addMessage({
            type: 'image',
            url: url,
            caption: caption,
            sender: 'support'
        });
    }

    // Web Component lifecycle methods
    cleanup() {
        // Clean up event listeners and references
        this.messages = [];
        this.messageHandlers.clear();
        this.eventListeners = {};
        
        // Remove styles if this was the last component
        const remainingComponents = document.querySelectorAll('chitchat-component');
        if (remainingComponents.length <= 1) {
            const styles = document.getElementById('chitchat-styles');
            if (styles) styles.remove();
        }
    }

    // Event system (enhanced for web components)
    on(event, callback) {
        this.addEventListener(`chitchat:${event}`, callback);
    }

    emit(event, data) {
        this.dispatchEvent(new CustomEvent(`chitchat:${event}`, {
            detail: data,
            bubbles: true
        }));
    }

    // Destroy method for backward compatibility
    destroy() {
        this.remove();
    }
}

// Register the custom element
customElements.define('chitchat-component', ChitChatComponent);

// Export for global use
window.ChitChat = ChitChatComponent;
