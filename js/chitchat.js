/**
 * ChitChat - Professional Chat Interface Web Component
 * A modern, extensible chat interface with rich message support
 * Built with vanilla JavaScript and Bootstrap 5.3
 */

console.log('[ChitChat] Main file loading...');

// Import component definitions
import './messages.js';
import './chitchat-components.js';
import './prompt-components.js';

console.log('[ChitChat] All imports completed');

import { ChatToolsRegistry } from './chat-tools.js';

class ChitChatComponent extends HTMLElement {
    constructor() {
        super();
        
        // Lightweight OTLC integration with safe fallbacks
        this.otlc = this.initObservability();
        
        // Initialize properties
        this.messages = [];
        this.messageQueue = []; // Queue messages until component is ready
        this.messageHandlers = new Map();
        this.isTyping = false;
        this.eventListeners = {};
        this.isInitialized = false;
        
        // Initialize chat tools registry - this component owns it
        this.toolsRegistry = new ChatToolsRegistry();
        
        // Initialize OpenAI client with our registry (endpoint will be set in initializeOptions)
        this.openaiClient = null;
        
        // Detect screen type and set responsive defaults
        this.screenType = this.detectScreenType();
        this.responsiveDefaults = this.getResponsiveDefaults();
        
        // Default options with responsive sizing
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
            currentUser: { id: 'user', name: 'You', avatar: null },
            ...this.responsiveDefaults
        };
        
        // Simple metrics tracking
        this.otlc.counter('chitchat.created');
        
        // Add API for external tool registration
        this.registerTool = (name, definition) => {
            this.toolsRegistry.registerTool(name, definition);
            // Re-initialize OpenAI client handlers when tools change
            this.openaiClient.updateToolsFromRegistry(this.toolsRegistry);
        };
    }

    // Message components are now defined in messages.js
    // This ensures clean separation of concerns and maintainability

    initObservability() {
        // Create lightweight logging and metrics fallback
        return {
            startSpan: (name, attrs = {}) => ({ 
                setStatus: () => {}, 
                addEvent: () => {}, 
                end: () => {} 
            }),
            counter: (name, value = 1) => {},
            gauge: (name, value) => {},
            histogram: (name, value) => {},
            debug: (msg, attrs = {}) => console.debug(`[ChitChat] ${msg}`, attrs),
            info: (msg, attrs = {}) => console.info(`[ChitChat] ${msg}`, attrs),
            warn: (msg, attrs = {}) => console.warn(`[ChitChat] ${msg}`, attrs),
            error: (msg, attrs = {}) => console.error(`[ChitChat] ${msg}`, attrs)
        };
    }

    detectScreenType() {
        const width = window.innerWidth;
        
        if (width <= 768) {
            return 'mobile';
        } else {
            return 'desktop';
        }
    }

    getResponsiveDefaults() {
        const { screenType } = this;
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        switch (screenType) {
            case 'mobile':
                // Mobile devices - fullscreen experience
                return {
                    width: '100vw',
                    height: '100vh',
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    borderRadius: '0',
                    enableResize: false,
                    compactMode: true
                };
                
            case 'desktop':
            default:
                // Desktop/Laptop - proper sizing based on viewport
                // For your 2560x1600: ~975px wide, ~1200px tall
                // For 1920x1080: ~730px wide, ~810px tall
                const width = Math.round(viewport.width * 0.38); // 38% of screen width
                const height = Math.round(viewport.height * 0.75); // 75% of screen height
                
                return {
                    width: width,
                    height: height,
                    enableResize: true,
                    compactMode: false
                };
        }
    }

    static get observedAttributes() {
        return [
            'endpoint',
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
        this.otlc.debug('ChitChat component connected to DOM');
        
        // Initialize the component properly
        this.createChatInterface();
        this.setupEventListeners();
        this.registerDefaultMessageTypes();
        
        // Mark as initialized
        this.isInitialized = true;
        
        // Process any queued messages
        this.processMessageQueue();
        
        this.otlc.info('ChitChat initialized successfully', { 
            messages: this.messages.length,
            queuedMessages: this.messageQueue.length,
            options: this.options 
        });
        
        // Dispatch ready event after everything is initialized
        this.dispatchEvent(new CustomEvent('chitchat:ready', {
            detail: { component: this },
            bubbles: true
        }));
    }

    disconnectedCallback() {
        try {
            this.cleanup();
            this.otlc.info('ChitChat disconnected');
        } catch (error) {
            this.otlc.error('ChitChat disconnection error', { error: error.message });
        }
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
        
        // Parse endpoint attribute and initialize OpenAI client
        const endpoint = this.getAttribute('endpoint') || '/v1';
        if (!this.openaiClient || this.endpoint !== endpoint) {
            this.endpoint = endpoint;
            this.openaiClient = new OpenAIClient(endpoint, null, this.toolsRegistry);
            console.log('[ChitChat] OpenAI client initialized with endpoint:', endpoint);
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
            case 'endpoint':
                // Reinitialize OpenAI client with new endpoint
                const endpoint = newValue || '/v1';
                if (this.endpoint !== endpoint) {
                    this.endpoint = endpoint;
                    this.openaiClient = new OpenAIClient(endpoint, null, this.toolsRegistry);
                }
                break;
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
        // Apply responsive styling to the component itself
        this.applyResponsiveStyles();
        
        console.log('[ChitChat] Creating interface with new component architecture');
        
        this.innerHTML = `
            <div class="chitchat-container" data-theme="${this.options.theme}" data-screen-type="${this.screenType}">
                <!-- Chat Header Component -->
                <chat-header 
                    title="SecureBank Support"
                    status="online"
                    show-help
                    show-clear
                    show-minimize>
                </chat-header>

                <!-- Chat Messages Component -->
                <chat-messages></chat-messages>

                <!-- Prompt Input Component (replacing old input) -->
                <div class="chitchat-input-container">
                    <!-- File Manager Component -->
                    <file-manager></file-manager>

                    <!-- Main Input Component -->
                    <prompt-input></prompt-input>
                </div>
                
                <!-- Controls Bar (separate container) -->
                <div class="chitchat-controls-container">
                    <div class="controls-bar">
                        <div class="controls-left">
                            <button type="button" class="btn-icon" id="addFileBtn" title="Add files" aria-label="Add files">
                                📎
                            </button>
                            <button type="button" class="btn-icon" id="clearBtn" title="Clear conversation" aria-label="Clear conversation">
                                🗑️
                            </button>
                        </div>
                        
                        <div class="controls-center">
                            <!-- Options Panel Component -->
                            <options-panel></options-panel>
                        </div>
                        
                        <div class="controls-right">
                            <button type="button" class="btn-control" id="deepThinkBtn" title="Enable deep thinking mode">
                                🧠 Think
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Chat Resizer Component -->
                <chat-resizer direction="both"></chat-resizer>
            </div>
        `;
    }

    applyResponsiveStyles() {
        const defaults = this.options;
        
        // Apply positioning and sizing based on screen type
        if (defaults.position) {
            this.style.position = defaults.position;
        }
        
        if (defaults.top) this.style.top = defaults.top;
        if (defaults.left) this.style.left = defaults.left;
        if (defaults.right) this.style.right = defaults.right;
        if (defaults.bottom) this.style.bottom = defaults.bottom;
        
        // Set dimensions
        if (typeof defaults.width === 'number') {
            this.style.width = defaults.width + 'px';
        } else if (defaults.width) {
            this.style.width = defaults.width;
        }
        
        if (typeof defaults.height === 'number') {
            this.style.height = defaults.height + 'px';
        } else if (defaults.height) {
            this.style.height = defaults.height;
        }
        
        // Clear any max dimensions - users can resize as they want
        this.style.maxWidth = '';
        this.style.maxHeight = '';
        
        // Apply border radius
        if (defaults.borderRadius) {
            this.style.borderRadius = defaults.borderRadius;
        }
        
        // Set z-index for mobile fullscreen
        if (this.screenType === 'mobile') {
            this.style.zIndex = '9999';
        }
    }

    setupEventListeners() {
        // Listen to events from new components
        this.addEventListener('header-action', this.handleHeaderAction.bind(this));
        this.addEventListener('message-send', this.handleMessageSend.bind(this));
        this.addEventListener('file-added', this.handleFileAdded.bind(this));
        this.addEventListener('file-removed', this.handleFileRemoved.bind(this));
        this.addEventListener('chat-resized', this.handleChatResized.bind(this));
        this.addEventListener('quick-reply-selected', this.handleQuickReplySelected.bind(this));
        this.addEventListener('option-changed', this.handleOptionChanged.bind(this));
        this.addEventListener('data-source-changed', this.handleDataSourceChanged.bind(this));

        // Setup control buttons
        this.setupControlButtons();

        // Quick reply handling (backward compatibility)
        this.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-reply-btn')) {
                this.sendMessage(e.target.textContent.trim());
            }
        });

        // Custom resize functionality
        this.setupCustomResize();
    }
    
    setupControlButtons() {
        // Add file button
        const addFileBtn = this.querySelector('#addFileBtn');
        if (addFileBtn) {
            addFileBtn.addEventListener('click', () => {
                const fileManager = this.querySelector('file-manager');
                if (fileManager) {
                    fileManager.openFileDialog();
                }
            });
        }
        
        // Clear conversation button  
        const clearBtn = this.querySelector('#clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clear();
            });
        }
        
        // Deep thinking mode button
        const deepThinkBtn = this.querySelector('#deepThinkBtn');
        if (deepThinkBtn) {
            deepThinkBtn.addEventListener('click', () => {
                this.toggleDeepThinking();
            });
        }
    }
    
    handleHeaderAction(e) {
        const { action } = e.detail;
        switch (action) {
            case 'minimize':
                this.minimize();
                break;
            case 'clear':
                this.clear();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'close':
                this.close();
                break;
        }
    }
    
    handleMessageSend(e) {
        const { value } = e.detail;
        this.sendMessage(value);
    }
    
    handleFileAdded(e) {
        // Handle file addition from file-manager
        const { file } = e.detail;
        this.addMessage({
            type: 'user',
            content: `📎 File attached: ${file.name}`,
            timestamp: new Date()
        });
    }
    
    handleFileRemoved(e) {
        // Handle file removal
        console.log('File removed:', e.detail);
    }
    
    handleChatResized(e) {
        // Handle resize events from chat-resizer
        const { width, height } = e.detail;
        this.otlc.debug('Chat resized', { width, height });
    }
    
    handleQuickReplySelected(e) {
        // Handle quick reply selection from chat-messages
        const { reply } = e.detail;
        this.handleQuickReply(reply);
    }
    
    handleOptionChanged(e) {
        const { property, value } = e.detail;
        console.log(`[ChitChat] Option changed: ${property} = ${value}`);
    }
    
    handleDataSourceChanged(e) {
        const { source, space, knowledgeBase } = e.detail;
        console.log(`[ChitChat] Data source changed:`, { source, space, knowledgeBase });
    }
    
    toggleDeepThinking() {
        const btn = this.querySelector('#deepThinkBtn');
        const isActive = btn.classList.toggle('active');
        
        // Update button appearance
        if (isActive) {
            btn.style.backgroundColor = 'var(--chat-accent, #007bff)';
            btn.style.color = 'white';
            btn.title = 'Disable deep thinking mode';
            btn.innerHTML = '🧠 Deep';
        } else {
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.title = 'Enable deep thinking mode';
            btn.innerHTML = '🧠 Think';
        }
        
        console.log(`[ChitChat] Deep thinking mode ${isActive ? 'enabled' : 'disabled'}`);
    }

    setupCustomResize() {
        try {
            // Check if resizing is enabled for this screen type
            if (!this.options.enableResize || this.screenType === 'mobile') {
                this.otlc.debug('Resize disabled', { reason: this.screenType === 'mobile' ? 'mobile' : 'disabled' });
                return;
            }

            const container = this.querySelector('.chitchat-container');
            if (!container) {
                throw new Error('Container not found for resize setup');
            }

            let isResizing = false;
            let startX, startY, startWidth, startHeight, startLeft, startTop;

            // Get responsive constraints for better sizing
            const minWidth = 450;
            const minHeight = 550;

            // Create resize handle in top-left corner
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'chitchat-resize-handle';
            resizeHandle.innerHTML = '<i class="bi bi-grip-diagonal"></i>';
            const handleSize = this.screenType === 'desktop' ? '24px' : '20px';
            const fontSize = this.screenType === 'desktop' ? '12px' : '10px';
            
            resizeHandle.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: ${handleSize};
                height: ${handleSize};
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                cursor: nw-resize;
                z-index: 1001;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: ${fontSize};
                border-radius: 16px 0 0 0;
                opacity: 0.8;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;

            container.appendChild(resizeHandle);

            // Mouse events for resize
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                
                const computedStyle = document.defaultView.getComputedStyle(this);
                startWidth = parseInt(computedStyle.width, 10);
                startHeight = parseInt(computedStyle.height, 10);
                startLeft = parseInt(computedStyle.left || this.offsetLeft, 10);
                startTop = parseInt(computedStyle.top || this.offsetTop, 10);
                
                document.addEventListener('mousemove', handleResize);
                document.addEventListener('mouseup', stopResize);
                e.preventDefault();
                
                this.otlc.counter('chitchat.resize.started');
            });

            // Touch events for mobile/tablet resize
            resizeHandle.addEventListener('touchstart', (e) => {
                isResizing = true;
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                
                const computedStyle = document.defaultView.getComputedStyle(this);
                startWidth = parseInt(computedStyle.width, 10);
                startHeight = parseInt(computedStyle.height, 10);
                startLeft = parseInt(computedStyle.left || this.offsetLeft, 10);
                startTop = parseInt(computedStyle.top || this.offsetTop, 10);
                
                document.addEventListener('touchmove', handleTouchResize);
                document.addEventListener('touchend', stopResize);
                e.preventDefault();
            });

            // Enhanced hover effects for better UX
            resizeHandle.addEventListener('mouseenter', () => {
                resizeHandle.style.opacity = '1';
                resizeHandle.style.transform = 'scale(1.1)';
                resizeHandle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            });

            resizeHandle.addEventListener('mouseleave', () => {
                if (!isResizing) {
                    resizeHandle.style.opacity = '0.8';
                    resizeHandle.style.transform = 'scale(1)';
                    resizeHandle.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                }
            });

            const handleResize = (e) => {
                if (!isResizing) return;
                
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                // Calculate new dimensions (growing in opposite direction for top-left)
                const newWidth = Math.max(minWidth, startWidth - deltaX);
                const newHeight = Math.max(minHeight, startHeight - deltaY);
                
                // Calculate new position to maintain bottom-right corner position
                const newLeft = startLeft + (startWidth - newWidth);
                const newTop = startTop + (startHeight - newHeight);
                
                // Update component dimensions and position
                this.style.width = newWidth + 'px';
                this.style.height = newHeight + 'px';
                this.style.left = newLeft + 'px';
                this.style.top = newTop + 'px';
            };

            const handleTouchResize = (e) => {
                if (!isResizing) return;
                const touch = e.touches[0];
                
                const deltaX = touch.clientX - startX;
                const deltaY = touch.clientY - startY;
                
                // Calculate new dimensions (growing in opposite direction for top-left)
                const newWidth = Math.max(minWidth, startWidth - deltaX);
                const newHeight = Math.max(minHeight, startHeight - deltaY);
                
                // Calculate new position to maintain bottom-right corner position
                const newLeft = startLeft + (startWidth - newWidth);
                const newTop = startTop + (startHeight - newHeight);
                
                // Update component dimensions and position
                this.style.width = newWidth + 'px';
                this.style.height = newHeight + 'px';
                this.style.left = newLeft + 'px';
                this.style.top = newTop + 'px';
            };

            const stopResize = () => {
                if (isResizing) {
                    isResizing = false;
                    resizeHandle.style.opacity = '0.8';
                    document.removeEventListener('mousemove', handleResize);
                    document.removeEventListener('mouseup', stopResize);
                    document.removeEventListener('touchmove', handleTouchResize);
                    document.removeEventListener('touchend', stopResize);
                    
                    this.otlc.counter('chitchat.resize.completed');
                    this.otlc.info('Chat resized', { width: this.offsetWidth, height: this.offsetHeight });
                    
                    // Dispatch resize event
                    this.dispatchEvent(new CustomEvent('chitchat:resized', {
                        detail: {
                            width: this.offsetWidth,
                            height: this.offsetHeight,
                            left: this.offsetLeft,
                            top: this.offsetTop
                        },
                        bubbles: true
                    }));
                }
            };

            // Handle window resize to keep chat in bounds
            window.addEventListener('resize', () => {
                // Keep chat within window bounds
                const rect = this.getBoundingClientRect();
                const maxX = window.innerWidth - this.offsetWidth;
                const maxY = window.innerHeight - this.offsetHeight;
                
                if (rect.left < 0) this.style.left = '0px';
                if (rect.top < 0) this.style.top = '0px';
                if (rect.left > maxX) this.style.left = maxX + 'px';
                if (rect.top > maxY) this.style.top = maxY + 'px';
            });
            
            this.otlc.debug('Resize setup complete');
            
        } catch (error) {
            this.otlc.error('Failed to setup resize', { error: error.message });
            throw error;
        }
    }

    registerDefaultMessageTypes() {
        // Register basic message handlers directly
        this.registerMessageType('text', (message) => this.escapeHtml(message.content || ''));
        
        this.registerMessageType('system', (message) => this.escapeHtml(message.content || ''));
        
        this.registerMessageType('image', (message) => {
            const caption = message.caption ? `<p class="mt-2 mb-0 small text-muted">${this.escapeHtml(message.caption)}</p>` : '';
            return `<img src="${this.escapeHtml(message.url)}" alt="${this.escapeHtml(message.caption || 'Image')}" class="message-image img-fluid rounded">${caption}`;
        });
        
        this.registerMessageType('table', (message) => {
            const title = message.title ? `<h6 class="mb-2">${this.escapeHtml(message.title)}</h6>` : '';
            const headers = message.headers ? message.headers.map(h => `<th>${this.escapeHtml(h)}</th>`).join('') : '';
            const rows = message.rows ? message.rows.map(row => 
                `<tr>${row.map(cell => `<td>${this.escapeHtml(cell)}</td>`).join('')}</tr>`
            ).join('') : '';
            
            return `${title}<table class="message-table table table-sm table-bordered">
                <thead><tr>${headers}</tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
        });
        
        this.registerMessageType('quick_reply', (message) => {
            const content = message.content ? `<p class="mb-2">${this.escapeHtml(message.content)}</p>` : '';
            const replies = message.replies ? message.replies.map(reply => 
                `<button class="quick-reply-btn btn btn-outline-primary btn-sm me-1 mb-1">${this.escapeHtml(reply)}</button>`
            ).join('') : '';
            
            return `${content}<div class="quick-replies">${replies}</div>`;
        });
        
        this.otlc.debug('Message handlers registered', { 
            types: Array.from(this.messageHandlers.keys()) 
        });
    }

    registerMessageType(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    processMessageQueue() {
        // Ensure messageQueue is initialized
        if (!this.messageQueue) {
            this.messageQueue = [];
            return;
        }
        
        if (this.messageQueue.length > 0) {
            this.otlc.debug('Processing queued messages', { count: this.messageQueue.length });
            
            // Process all queued messages
            const queuedMessages = [...this.messageQueue];
            this.messageQueue = []; // Clear the queue
            
            queuedMessages.forEach(messageData => {
                this.addMessage(messageData);
            });
        }
    }

    addMessage(messageData) {
        try {
            // Ensure messageQueue and messages are initialized (defensive programming)
            if (!this.messageQueue) {
                this.messageQueue = [];
            }
            if (!this.messages) {
                this.messages = [];
            }
            
            if (!this.isInitialized) {
                this.otlc.warn('Message queued before initialization', { type: messageData.type });
                // Queue the message until component is ready
                this.messageQueue.push(messageData);
                return null;
            }
            
            // Use the new chat-messages component
            const chatMessages = this.querySelector('chat-messages');
            if (!chatMessages) {
                this.otlc.warn('Chat messages component not found, queuing message', { type: messageData.type });
                this.messageQueue.push(messageData);
                return null;
            }
            
            // Create and validate message
            const message = this.createMessage(messageData);
            
            this.messages.push(message);
            
            // Limit message history
            if (this.messages.length > this.options.maxMessages) {
                this.messages = this.messages.slice(-this.options.maxMessages);
            }

            // Delegate to chat-messages component
            chatMessages.dispatchEvent(new CustomEvent('add-message', {
                detail: message
            }));
            
            // Emit message added event
            this.emit('message-added', { message });
            
            this.otlc.counter('chitchat.message.added');
            this.otlc.debug('Message added', { type: message.type, id: message.id });

            return message;
            
        } catch (error) {
            this.otlc.error('Failed to add message', { error: error.message, type: messageData.type });
            throw error;
        }
    }

    /**
     * Update an existing message by ID
     * @param {string} messageId - The message ID to update
     * @param {Object} updates - Properties to update
     */
    updateMessage(messageId, updates) {
        try {
            // Find the message in our array
            const messageIndex = this.messages.findIndex(msg => msg.id === messageId);
            if (messageIndex === -1) {
                console.warn('Message not found for update:', messageId);
                return false;
            }
            
            // Update the message data
            Object.assign(this.messages[messageIndex], updates);
            
            // Update the DOM element via chat-messages component
            const chatMessages = this.querySelector('chat-messages');
            if (chatMessages) {
                chatMessages.dispatchEvent(new CustomEvent('update-message', {
                    detail: { 
                        messageId,
                        message: this.messages[messageIndex],
                        updates
                    }
                }));
            }
            
            this.otlc.debug('Message updated', { id: messageId, updates });
            return true;
            
        } catch (error) {
            this.otlc.error('Failed to update message', { error: error.message, messageId });
            return false;
        }
    }

    renderMessage(message) {
        try {
            const messagesContainer = this.querySelector('.messages-container');
            const messageElement = document.createElement('div');
            
            const senderClass = message.sender === this.options.currentUser.id ? 'sent' : 
                               message.type === 'system' ? 'system' : 'received';
            
            messageElement.className = `message ${senderClass}`;
            messageElement.dataset.messageId = message.id;
            messageElement.dataset.messageType = message.type;

            // Create message bubble container
            const messageBubble = document.createElement('div');
            messageBubble.className = 'message-bubble';

            // Create web component for message
            const componentMap = {
                'text': 'chitchat-text-message',
                'table': 'chitchat-table-message', 
                'quick_reply': 'chitchat-quick-reply-message',
                'image': 'chitchat-image-message',
                'chart': 'chitchat-chart-message'
            };
            
            const componentName = componentMap[message.type];
            this.otlc.debug(`Creating component: ${componentName} for message type: ${message.type}`);
            
            if (componentName) {
                this.otlc.debug(`Creating element ${componentName}`);
                const messageComponent = document.createElement(componentName);
                messageComponent.setAttribute('data-message', JSON.stringify(message));
                
                // Handle quick reply events
                if (message.type === 'quick_reply') {
                    messageComponent.addEventListener('quick-reply-selected', (e) => {
                        this.handleQuickReply(e.detail.reply);
                    });
                }
                
                messageBubble.appendChild(messageComponent);
                
            } else {
                // Fallback to text content
                this.otlc.warn(`No web component mapping found for message type: ${message.type}, using fallback`);
                const fallbackDiv = document.createElement('div');
                fallbackDiv.className = 'message-content';
                fallbackDiv.textContent = message.content || `[Unsupported message type: ${message.type}]`;
                messageBubble.appendChild(fallbackDiv);
            }
            
            messageElement.appendChild(messageBubble);

            // Add timestamp if enabled
            if (this.options.showTimestamps) {
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'message-timestamp';
                timestampDiv.textContent = this.formatTimestamp(message.timestamp);
                messageElement.appendChild(timestampDiv);
            }

            messagesContainer.appendChild(messageElement);

            // Trigger animation
            requestAnimationFrame(() => {
                messageElement.style.animationDelay = '0s';
            });

            // Emit message rendered event
            this.emit('message-rendered', { message, element: messageElement });
            
            this.otlc.counter('chitchat.message.rendered');
            
        } catch (error) {
            this.otlc.error('Failed to render message', { error: error.message, id: message.id });
            throw error;
        }
    }

    // === MESSAGE TYPE EXTENSIBILITY API ===
    
    /**
     * Register a custom message type
     * @param {string} type - Message type name
     * @param {Function|Object} handler - Message handler function or object with render method
     */
    registerCustomMessageType(type, handler) {
        if (typeof handler === 'function') {
            // Function-based handler
            this.registerMessageType(type, handler);
        } else if (typeof handler === 'object' && handler.render) {
            // Object with render method
            this.registerMessageType(type, (message) => handler.render(message));
        } else {
            throw new Error('Message handler must be a function or object with render method');
        }
    }

    /**
     * Get available message types
     * @returns {Array<string>} Array of registered message type names
     */
    getAvailableMessageTypes() {
        return Array.from(this.messageHandlers.keys());
    }

    /**
     * Check if a message type is supported
     * @param {string} type - Message type to check
     * @returns {boolean}
     */
    supportsMessageType(type) {
        return this.messageHandlers.has(type);
    }

    /**
     * Create a message with validation
     * @param {Object} messageData - Message data
     * @returns {Object} Validated and normalized message
     */
    createMessage(messageData) {
        const message = {
            id: Date.now() + Math.random(),
            type: 'text',
            sender: null,
            timestamp: new Date(),
            ...messageData
        };

        return message;
    }

    // === UTILITY METHODS ===
    
    /**
     * Escape HTML for security
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format timestamp for display
     * @param {Date|string|number} timestamp - Timestamp to format
     * @returns {string} Formatted timestamp
     */
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

    sendMessage(content = null) {
        try {
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
            
            this.otlc.counter('chitchat.message.sent');
            this.otlc.debug('Message sent', { length: messageContent.length });
            
            // Simulate typing and response (for demo)
            if (this.options.showTypingIndicator) {
                this.showTypingIndicator();
                setTimeout(() => {
                    this.hideTypingIndicator();
                    this.simulateResponse(messageContent);
                }, 1000 + Math.random() * 2000);
            }
            
        } catch (error) {
            this.otlc.error('Failed to send message', { error: error.message });
            throw error;
        }
    }

    handleQuickReply(reply) {
        try {
            // Send the quick reply as a user message
            this.addMessage({
                type: 'text',
                content: reply,
                sender: this.options.currentUser.id
            });

            // Dispatch quick reply event
            this.dispatchEvent(new CustomEvent('chitchat:quick-reply-selected', {
                detail: { reply, user: this.options.currentUser },
                bubbles: true
            }));
            
            this.otlc.counter('chitchat.quick_reply.selected');
            this.otlc.debug('Quick reply selected', { reply });
            
            // Simulate response if enabled
            if (this.options.showTypingIndicator) {
                this.showTypingIndicator();
                setTimeout(() => {
                    this.hideTypingIndicator();
                    this.simulateResponse(reply);
                }, 1000 + Math.random() * 1500);
            }
            
        } catch (error) {
            this.otlc.error('Failed to handle quick reply', { error: error.message, reply });
            throw error;
        }
    }

    async simulateResponse(userMessage) {
        // Use real OpenAI API instead of demo responses
        this.showTypingIndicator();
        
        console.log('[ChitChat] Sending message to endpoint:', this.endpoint);
        
        try {
            // Build conversation history
            const messages = this.messages
                .filter(msg => msg.type === 'text') // Only include text messages
                .map(msg => ({
                    role: msg.sender === this.options.currentUser.id ? 'user' : 'assistant',
                    content: msg.content
                }));
            
            // Add the current user message
            messages.push({
                role: 'user',
                content: userMessage
            });
            
            let currentMessageContent = '';
            let currentMessageId = null;
            
            // Stream the response
            await this.openaiClient.streamChatCompletion(
                messages,
                { 
                    model: 'llama',
                    temperature: 0.7,
                    max_tokens: 1000
                },
                // Token callback - called for each token
                (token, isComplete) => {
                    if (token && !isComplete) {
                        currentMessageContent += token;
                        
                        // Create or update the streaming message
                        if (!currentMessageId) {
                            const message = this.addMessage({
                                type: 'text',
                                content: currentMessageContent,
                                sender: 'support',
                                streaming: true
                            });
                            currentMessageId = message ? message.id : null;
                        } else {
                            // Update existing message
                            this.updateMessage(currentMessageId, { 
                                content: currentMessageContent,
                                streaming: !isComplete
                            });
                        }
                    }
                    
                    if (isComplete) {
                        // Mark streaming as complete
                        if (currentMessageId) {
                            this.updateMessage(currentMessageId, { 
                                streaming: false 
                            });
                        }
                        this.hideTypingIndicator();
                    }
                },
                // Command callback - called for JSON-RPC commands
                (command) => {
                    // Use the registry to dispatch commands
                    const handler = this.toolsRegistry.getHandler(command.method);
                    if (handler) {
                        try {
                            handler(command.params, this);
                        } catch (error) {
                            console.error(`Error executing command ${command.method}:`, error);
                        }
                    } else {
                        console.warn(`No handler registered for method: ${command.method}`);
                    }
                }
            );
            
        } catch (error) {
            this.hideTypingIndicator();
            console.error('OpenAI API error:', error);
            
            // Fallback to simple response on error
            this.addMessage({
                type: 'text',
                content: 'I apologize, but I encountered an error. Please try again.',
                sender: 'support'
            });
        }
    }

    showTypingIndicator() {
        const chatMessages = this.querySelector('chat-messages');
        if (chatMessages) {
            chatMessages.dispatchEvent(new CustomEvent('show-typing'));
            this.isTyping = true;
        }
    }

    hideTypingIndicator() {
        const chatMessages = this.querySelector('chat-messages');
        if (chatMessages) {
            chatMessages.dispatchEvent(new CustomEvent('hide-typing'));
            this.isTyping = false;
        }
    }

    scrollToBottom() {
        const chatMessages = this.querySelector('chat-messages');
        if (chatMessages) {
            chatMessages.scrollToBottom();
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
        const input = this.querySelector('#chitchat-input');
        if (input && input.value.length > 0 && !this.isTyping) {
            // Could trigger typing indicator to other users
            this.otlc.debug('User typing', { length: input.value.length });
        }
    }



    minimize() {
        const container = this.querySelector('.chitchat-container');
        if (container) {
            container.style.transform = 'scale(0)';
            container.style.opacity = '0';
            container.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                this.style.display = 'none';
                
                // Dispatch minimize event
                this.dispatchEvent(new CustomEvent('chitchat:minimized', {
                    detail: { component: this },
                    bubbles: true
                }));
            }, 300);
            
            this.otlc.info('Chat minimized');
        }
    }

    close() {
        const container = this.querySelector('.chitchat-container');
        if (container) {
            container.style.transform = 'scale(0)';
            container.style.opacity = '0';
            container.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                this.style.display = 'none';
                
                // Dispatch close event
                this.dispatchEvent(new CustomEvent('chitchat:closed', {
                    detail: { component: this },
                    bubbles: true
                }));
            }, 300);
            
            this.otlc.info('Chat closed');
        }
    }

    showHelp() {
        // Show help message
        this.addMessage({
            type: 'system',
            content: 'Welcome to SecureBank Support! You can ask questions about your account, transactions, or banking services. Use the buttons below to get started.',
            sender: 'system'
        });

        // Add some quick help options
        this.addMessage({
            type: 'quick_reply',
            content: 'How can I help you today?',
            replies: [
                'Check Account Balance',
                'Transaction History', 
                'Transfer Funds',
                'Contact Support',
                'Security Help'
            ],
            sender: 'support'
        });

        this.otlc.info('Help shown');
        
        // Dispatch help event
        this.dispatchEvent(new CustomEvent('chitchat:help-shown', {
            detail: { component: this },
            bubbles: true
        }));
    }

    // Public API methods
    clear() {
        this.messages = [];
        
        // Clear via chat-messages component
        const chatMessages = this.querySelector('chat-messages');
        if (chatMessages) {
            chatMessages.dispatchEvent(new CustomEvent('clear-messages'));
        }
        
        this.otlc.info('Chat messages cleared');
        
        // Dispatch clear event
        this.dispatchEvent(new CustomEvent('chitchat:cleared', {
            detail: { component: this },
            bubbles: true
        }));
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

    addChart(title, chartType, chartData, chartOptions = {}) {
        return this.addMessage({
            type: 'chart',
            title: title,
            chartType: chartType,
            chartData: chartData,
            chartOptions: chartOptions,
            sender: 'support'
        });
    }

    // === VISIBILITY CONTROL METHODS ===
    
    show() {
        this.style.display = 'block';
        
        // Dispatch event to notify that chat is now visible
        this.dispatchEvent(new CustomEvent('chitchat:shown', {
            detail: { component: this },
            bubbles: true
        }));
        
        this.otlc.counter('chitchat.shown');
        return this;
    }
    
    hide() {
        this.style.display = 'none';
        
        // Dispatch event to notify that chat is now hidden
        this.dispatchEvent(new CustomEvent('chitchat:hidden', {
            detail: { component: this },
            bubbles: true
        }));
        
        this.otlc.counter('chitchat.hidden');
        return this;
    }

    // Web Component lifecycle methods
    cleanup() {
        try {
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
            
            this.otlc.debug('ChitChat cleaned up');
            
        } catch (error) {
            this.otlc.error('Error during cleanup', { error: error.message });
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
