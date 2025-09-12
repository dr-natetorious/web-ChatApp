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
    }

    detectScreenType() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const pixelRatio = window.devicePixelRatio || 1;
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Mobile devices
        if (width <= 768 || isTouch && width <= 1024) {
            return 'mobile';
        }
        
        // 14-16 inch laptops (common resolutions: 1366x768, 1440x900, 1536x864, 1600x900, 1680x1050)
        if (width <= 1680 && height <= 1050) {
            return 'laptop';
        }
        
        // Large desktop/multi-monitor (4K, ultrawide, etc.)
        if (width >= 2560 || height >= 1440) {
            return 'desktop-large';
        }
        
        // Standard desktop (1920x1080, etc.)
        return 'desktop';
    }

    getResponsiveDefaults() {
        const { screenType } = this;
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };

        switch (screenType) {
            case 'mobile':
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
                
            case 'laptop':
                return {
                    width: Math.min(480, viewport.width * 0.75),
                    height: Math.min(680, viewport.height * 0.8),
                    maxWidth: 550,
                    maxHeight: viewport.height * 0.85,
                    enableResize: true,
                    compactMode: false
                };
                
            case 'desktop':
                return {
                    width: 450,
                    height: 650,
                    maxWidth: 600,
                    maxHeight: viewport.height * 0.85,
                    enableResize: true,
                    compactMode: false
                };
                
            case 'desktop-large':
                return {
                    width: 500,
                    height: 700,
                    maxWidth: 800,
                    maxHeight: viewport.height * 0.8,
                    enableResize: true,
                    compactMode: false
                };
                
            default:
                return {
                    width: 400,
                    height: 600,
                    maxWidth: 500,
                    maxHeight: 700,
                    enableResize: true,
                    compactMode: false
                };
        }
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
        // Apply responsive styling to the component itself
        this.applyResponsiveStyles();
        
        this.innerHTML = `
            <div class="chitchat-container" data-theme="${this.options.theme}" data-screen-type="${this.screenType}">
                <!-- Chat Header -->
                <div class="chitchat-header ${this.options.compactMode ? 'compact' : ''}">
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
        
        // Set max dimensions
        if (typeof defaults.maxWidth === 'number') {
            this.style.maxWidth = defaults.maxWidth + 'px';
        } else if (defaults.maxWidth) {
            this.style.maxWidth = defaults.maxWidth;
        }
        
        if (typeof defaults.maxHeight === 'number') {
            this.style.maxHeight = defaults.maxHeight + 'px';
        } else if (defaults.maxHeight) {
            this.style.maxHeight = defaults.maxHeight;
        }
        
        // Apply border radius
        if (defaults.borderRadius) {
            this.style.borderRadius = defaults.borderRadius;
        }
        
        // Set z-index for mobile fullscreen
        if (this.screenType === 'mobile') {
            this.style.zIndex = '9999';
        }
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
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
            }

            /* Mobile fullscreen adjustments */
            .chitchat-container[data-screen-type="mobile"] {
                border: none;
                border-radius: 0;
                box-shadow: none;
                height: 100vh;
                width: 100vw;
            }

            /* Desktop adjustments */
            .chitchat-container[data-screen-type="desktop"], 
            .chitchat-container[data-screen-type="desktop-large"] {
                min-width: 400px;
                min-height: 500px;
            }

            /* Laptop adjustments */
            .chitchat-container[data-screen-type="laptop"] {
                min-width: 350px;
                min-height: 450px;
            }

            .chitchat-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                flex-shrink: 0;
            }

            .chitchat-header.compact {
                padding: 12px 16px;
            }

            .chitchat-header.compact h6 {
                font-size: 0.9rem;
            }

            .chitchat-header.compact small {
                font-size: 0.75rem;
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

            /* Resize Handle */
            .chitchat-resize-handle {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 20px;
                height: 20px;
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                cursor: nw-resize;
                z-index: 1001;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 10px;
                border-radius: 0 0 16px 0;
                opacity: 0.7;
                transition: opacity 0.2s;
            }

            .chitchat-resize-handle:hover {
                opacity: 1;
            }

            /* Mobile devices (phones) */
            @media (max-width: 767px) {
                .chitchat-container {
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    max-width: none !important;
                    max-height: none !important;
                }
                
                .chitchat-header {
                    padding: 12px 16px;
                }

                .chat-avatar .avatar-placeholder {
                    width: 32px;
                    height: 32px;
                    font-size: 14px;
                }

                .message-bubble {
                    max-width: 85%;
                    padding: 10px 14px;
                    font-size: 0.9rem;
                }

                .chitchat-resize-handle {
                    display: none !important;
                }
            }

            /* 14-16 inch laptops (1366x768 to 1680x1050) */
            @media (min-width: 768px) and (max-width: 1680px) {
                .chitchat-container {
                    min-width: 400px;
                    min-height: 500px;
                    max-width: 550px;
                    max-height: 85vh;
                }

                .message-bubble {
                    max-width: 70%;
                }

                .chitchat-header {
                    padding: 16px 20px;
                }

                .chitchat-messages {
                    padding: 16px;
                }

                .chitchat-input {
                    padding: 12px 20px;
                }

                /* Optimize for common laptop screen heights */
                @media (max-height: 900px) {
                    .chitchat-container {
                        max-height: 80vh;
                    }
                }
            }

            /* Large desktops and multi-monitor setups */
            @media (min-width: 1920px) {
                .chitchat-container {
                    min-width: 450px;
                    min-height: 550px;
                }

                .chitchat-header {
                    padding: 18px 24px;
                }

                .message-bubble {
                    max-width: 70%;
                    padding: 14px 18px;
                }
            }

            /* Ultra-wide and high-DPI displays */
            @media (min-width: 2560px) {
                .chitchat-container {
                    min-width: 500px;
                    min-height: 600px;
                }

                .chitchat-header {
                    padding: 20px 28px;
                }

                .message-bubble {
                    max-width: 65%;
                    padding: 16px 20px;
                    font-size: 1rem;
                }
            }

            /* Portrait orientation adjustments */
            @media (orientation: portrait) and (max-width: 1024px) {
                .chitchat-container[data-screen-type="mobile"] {
                    width: 100vw !important;
                    height: 100vh !important;
                }
            }

            /* Landscape phones */
            @media (max-height: 500px) and (orientation: landscape) {
                .chitchat-header {
                    padding: 8px 12px;
                }

                .chitchat-header h6 {
                    font-size: 0.85rem;
                }

                .message-bubble {
                    padding: 8px 12px;
                    font-size: 0.85rem;
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

        // Custom resize functionality
        this.setupCustomResize();
    }

    setupCustomResize() {
        // Check if resizing is enabled for this screen type
        if (!this.options.enableResize || this.screenType === 'mobile') return;

        const container = this.querySelector('.chitchat-container');
        if (!container) return;

        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        // Get responsive constraints
        const minWidth = this.screenType === 'laptop' ? 350 : 400;
        const minHeight = this.screenType === 'laptop' ? 450 : 500;
        const maxWidth = this.options.maxWidth || window.innerWidth * 0.9;
        const maxHeight = this.options.maxHeight || window.innerHeight * 0.9;

        // Create a better resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'chitchat-resize-handle';
        resizeHandle.innerHTML = '<i class="bi bi-grip-horizontal"></i>';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            cursor: nw-resize;
            z-index: 1001;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            border-radius: 0 0 16px 0;
            opacity: 0.7;
            transition: opacity 0.2s;
        `;

        container.appendChild(resizeHandle);

        // Mouse events for resize
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
            
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        });

        // Touch events for mobile/tablet resize
        resizeHandle.addEventListener('touchstart', (e) => {
            isResizing = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
            startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
            
            document.addEventListener('touchmove', handleTouchResize);
            document.addEventListener('touchend', stopResize);
            e.preventDefault();
        });

        // Hover effects
        resizeHandle.addEventListener('mouseenter', () => {
            resizeHandle.style.opacity = '1';
        });

        resizeHandle.addEventListener('mouseleave', () => {
            if (!isResizing) resizeHandle.style.opacity = '0.7';
        });

        const handleResize = (e) => {
            if (!isResizing) return;
            
            const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + e.clientX - startX));
            const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + e.clientY - startY));
            
            // Update component dimensions
            this.style.width = newWidth + 'px';
            this.style.height = newHeight + 'px';
        };

        const handleTouchResize = (e) => {
            if (!isResizing) return;
            const touch = e.touches[0];
            
            const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + touch.clientX - startX));
            const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + touch.clientY - startY));
            
            // Update component dimensions
            this.style.width = newWidth + 'px';
            this.style.height = newHeight + 'px';
        };

        const stopResize = () => {
            isResizing = false;
            resizeHandle.style.opacity = '0.7';
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchmove', handleTouchResize);
            document.removeEventListener('touchend', stopResize);
            
            // Dispatch resize event
            this.dispatchEvent(new CustomEvent('chitchat:resized', {
                detail: {
                    width: container.offsetWidth,
                    height: container.offsetHeight
                },
                bubbles: true
            }));
        };

        // Handle window resize to keep chat in bounds
        window.addEventListener('resize', () => {
            // Recalculate responsive constraints on window resize
            const updatedDefaults = this.getResponsiveDefaults();
            const newMaxWidth = typeof updatedDefaults.maxWidth === 'number' ? 
                updatedDefaults.maxWidth : window.innerWidth * 0.9;
            const newMaxHeight = typeof updatedDefaults.maxHeight === 'number' ? 
                updatedDefaults.maxHeight : window.innerHeight * 0.9;
            
            // Keep chat within new bounds
            if (this.offsetWidth > newMaxWidth) {
                this.style.width = newMaxWidth + 'px';
            }
            if (this.offsetHeight > newMaxHeight) {
                this.style.height = newMaxHeight + 'px';
            }
        });
    }

    registerDefaultMessageTypes() {
        // Message types are now registered via the MessageRegistry
        // This allows for extensibility and clean separation of concerns
        if (typeof window.ChitChatMessages !== 'undefined') {
            const registry = window.ChitChatMessages.registry;
            
            // Register message types with their handlers
            for (const type of registry.getRegisteredTypes()) {
                this.registerMessageType(type, (message) => {
                    const messageImpl = registry.getMessageImplementation(type, this);
                    
                    // Validate message before rendering
                    const validation = window.ChitChatMessages.MessageValidator.validate(message, messageImpl);
                    if (!validation.valid) {
                        console.warn(`Message validation failed for type ${type}:`, validation.errors);
                        // Fall back to text message
                        const textImpl = registry.getMessageImplementation('text', this);
                        return textImpl.render({
                            ...message,
                            content: `[Invalid ${type} message: ${validation.errors.join(', ')}]`
                        });
                    }
                    
                    return messageImpl.render(message);
                });
            }
        } else {
            console.warn('ChitChatMessages not loaded, using fallback text renderer');
            this.registerMessageType('text', (message) => this.escapeHtml(message.content || ''));
        }
    }

    registerMessageType(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    addMessage(messageData) {
        // Create and validate message
        const message = this.createMessage(messageData);

        this.messages.push(message);
        
        // Limit message history
        if (this.messages.length > this.options.maxMessages) {
            this.messages = this.messages.slice(-this.options.maxMessages);
        }

        this.renderMessage(message);
        
        if (this.options.autoScroll) {
            this.scrollToBottom();
        }

        // Emit message added event
        this.emit('message-added', { message });

        return message;
    }

    renderMessage(message) {
        const messagesContainer = this.querySelector('.messages-container');
        const messageElement = document.createElement('div');
        
        const senderClass = message.sender === this.options.currentUser.id ? 'sent' : 
                           message.type === 'system' ? 'system' : 'received';
        
        messageElement.className = `message ${senderClass}`;
        messageElement.dataset.messageId = message.id;
        messageElement.dataset.messageType = message.type;

        // Get the message handler and render content
        const handler = this.messageHandlers.get(message.type);
        let content;
        
        if (handler) {
            try {
                content = handler(message);
            } catch (error) {
                console.error(`Error rendering message type ${message.type}:`, error);
                content = this.escapeHtml(`[Error rendering ${message.type} message]`);
            }
        } else {
            console.warn(`No handler found for message type: ${message.type}`);
            content = this.escapeHtml(message.content || `[Unsupported message type: ${message.type}]`);
        }
        
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

        // Emit message rendered event
        this.emit('message-rendered', { message, element: messageElement });
    }

    // === MESSAGE TYPE EXTENSIBILITY API ===
    
    /**
     * Register a custom message type
     * @param {string} type - Message type name
     * @param {Function|BaseMessage} handler - Message handler function or BaseMessage instance
     */
    registerCustomMessageType(type, handler) {
        if (typeof handler === 'function') {
            // Function-based handler (legacy support)
            this.registerMessageType(type, handler);
        } else if (handler instanceof window.BaseMessage) {
            // BaseMessage instance
            this.registerMessageType(type, (message) => handler.render(message));
        } else if (typeof handler === 'object' && handler.render) {
            // Object with render method
            this.registerMessageType(type, (message) => handler.render(message));
        } else {
            throw new Error('Message handler must be a function, BaseMessage instance, or object with render method');
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

        // Validate message if validator is available
        if (typeof window.ChitChatMessages !== 'undefined' && this.supportsMessageType(message.type)) {
            const registry = window.ChitChatMessages.registry;
            const messageImpl = registry.getMessageImplementation(message.type, this);
            const validation = window.ChitChatMessages.MessageValidator.validate(message, messageImpl);
            
            if (!validation.valid) {
                console.warn(`Message validation failed:`, validation.errors);
                // Convert to error message
                message.type = 'system';
                message.content = `Invalid message: ${validation.errors.join(', ')}`;
                message.variant = 'error';
            }
        }

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
