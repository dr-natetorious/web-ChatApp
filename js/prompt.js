/**
 * Prompt Interface - Simplified Main Component
 * Orchestrates smaller, focused web components
 */

/**
 * Main Chat Interface Component
 * Coordinates the smaller components
 */
class ChatInterface extends HTMLElement {
    constructor() {
        super();
        this.isInitialized = false;
        this.eventListeners = [];
    }
    
    connectedCallback() {
        this.init();
    }
    
    disconnectedCallback() {
        this.cleanup();
    }
    
    init() {
        if (this.isInitialized) return;
        
        this.render();
        this.setupEvents();
        this.setupAccessibility();
        
        this.isInitialized = true;
        this.announceToScreenReader('Chat interface loaded and ready');
        
        // Dispatch ready event
        this.dispatchEvent(new CustomEvent('chat:ready', {
            bubbles: true,
            detail: { component: this }
        }));
    }
    
    render() {
        // The HTML structure is already in the template
        // We just need to initialize the components
        const promptInput = this.querySelector('prompt-input');
        const fileManager = this.querySelector('file-manager');
        const modelSelector = this.querySelector('model-selector');
        const optionsPanel = this.querySelector('options-panel');
        
        if (!promptInput || !fileManager || !modelSelector || !optionsPanel) {
            console.error('Required components not found in template');
        }
    }
    
    setupEvents() {
        // Listen to component events
        this.addEventListenerTracked(this, 'message-send', this.handleMessageSend.bind(this));
        this.addEventListenerTracked(this, 'file-added', this.handleFileAdded.bind(this));
        this.addEventListenerTracked(this, 'file-removed', this.handleFileRemoved.bind(this));
        this.addEventListenerTracked(this, 'file-error', this.handleFileError.bind(this));
        this.addEventListenerTracked(this, 'model-changed', this.handleModelChanged.bind(this));
        this.addEventListenerTracked(this, 'option-changed', this.handleOptionChanged.bind(this));
        this.addEventListenerTracked(this, 'data-source-changed', this.handleDataSourceChanged.bind(this));
        
        // Setup control buttons
        this.setupControlButtons();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    setupControlButtons() {
        // Add file button
        const addFileBtn = this.querySelector('#addFileBtn');
        if (addFileBtn) {
            this.addEventListenerTracked(addFileBtn, 'click', () => {
                const fileManager = this.querySelector('file-manager');
                if (fileManager) {
                    fileManager.openFileDialog();
                }
            });
        }
        
        // Clear conversation button
        const clearBtn = this.querySelector('#clearBtn');
        if (clearBtn) {
            this.addEventListenerTracked(clearBtn, 'click', this.clearChat.bind(this));
        }
        
        // Deep thinking mode button
        const deepThinkBtn = this.querySelector('#deepThinkBtn');
        if (deepThinkBtn) {
            this.addEventListenerTracked(deepThinkBtn, 'click', this.toggleDeepThinking.bind(this));
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
        this.isInitialized = false;
    }
    
    setupKeyboardShortcuts() {
        const keyboardHandler = (e) => {
            // Escape to close dropdowns
            if (e.key === 'Escape') {
                const optionsPanel = this.querySelector('options-panel');
                if (optionsPanel) {
                    optionsPanel.closePanel();
                }
            }
            
            // Ctrl/Cmd + K to focus prompt
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const promptInput = this.querySelector('prompt-input');
                if (promptInput) {
                    promptInput.focus();
                }
            }
        };
        
        this.addEventListenerTracked(document, 'keydown', keyboardHandler);
    }
    
    setupAccessibility() {
        this.announceToScreenReader('Chat interface loaded and ready');
    }
    
    async handleMessageSend(e) {
        const { message } = e.detail;
        const fileManager = this.querySelector('file-manager');
        const modelSelector = this.querySelector('model-selector');
        const optionsPanel = this.querySelector('options-panel');
        
        const files = fileManager ? fileManager.getFiles() : [];
        const model = modelSelector ? modelSelector.getModel() : 'claude-3-haiku';
        const options = optionsPanel ? optionsPanel.getOptions() : {};
        
        try {
            this.setLoading(true);
            
            // Prepare the request data
            const requestData = {
                message,
                model,
                options
            };
            
            // Handle file uploads if any
            if (files.length > 0) {
                requestData.files = await this.processFiles(files);
            }
            
            // Send to backend (placeholder - implement actual API call)
            console.log('Sending message:', requestData);
            
            // Dispatch message sent event
            this.dispatchEvent(new CustomEvent('chat:message-sent', {
                bubbles: true,
                detail: { message, model, files: files.length, options }
            }));
            
            // Clear the form
            if (fileManager) {
                fileManager.clearFiles();
            }
            
            this.announceToScreenReader('Message sent');
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }
    
    handleFileAdded(e) {
        this.announceToScreenReader(`File ${e.detail.file.name} added`);
    }
    
    handleFileRemoved(e) {
        this.announceToScreenReader(`File ${e.detail.fileName} removed`);
    }
    
    handleFileError(e) {
        this.showError(e.detail.error);
    }
    
    handleModelChanged(e) {
        const { modelInfo } = e.detail;
        this.announceToScreenReader(`Model changed to ${modelInfo?.label || e.detail.model}`);
    }
    
    handleOptionChanged(e) {
        const { property, value } = e.detail;
        this.announceToScreenReader(`${property} ${value ? 'enabled' : 'disabled'}`);
    }
    
    handleDataSourceChanged(e) {
        const { source, space, knowledgeBase } = e.detail;
        let message = `Data source changed to ${source}`;
        if (space) message += ` (${space})`;
        if (knowledgeBase) message += ` (${knowledgeBase})`;
        
        this.announceToScreenReader(message);
        console.log('Data source selected:', e.detail);
    }
    
    toggleDeepThinking() {
        const btn = this.querySelector('#deepThinkBtn');
        const isActive = btn.classList.toggle('active');
        
        // Update button appearance
        if (isActive) {
            btn.style.backgroundColor = 'var(--chat-accent)';
            btn.style.color = 'white';
            btn.title = 'Disable deep thinking mode';
        } else {
            btn.style.backgroundColor = '';
            btn.style.color = '';
            btn.title = 'Enable deep thinking mode';
        }
        
        this.announceToScreenReader(`Deep thinking mode ${isActive ? 'enabled' : 'disabled'}`);
        
        // Dispatch event
        this.dispatchEvent(new CustomEvent('deep-thinking-changed', {
            bubbles: true,
            detail: { enabled: isActive }
        }));
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear the conversation?')) {
            // Clear any existing conversation display
            console.log('Clearing chat...');
            this.announceToScreenReader('Conversation cleared');
            
            // Clear file manager
            const fileManager = this.querySelector('file-manager');
            if (fileManager) {
                fileManager.clearFiles();
            }
            
            // Clear prompt input
            const promptInput = this.querySelector('prompt-input');
            if (promptInput) {
                promptInput.clear();
            }
            
            // Dispatch custom event
            this.dispatchEvent(new CustomEvent('chat:conversation-cleared', {
                bubbles: true,
                detail: { timestamp: new Date().toISOString() }
            }));
        }
    }
    
    async processFiles(files) {
        const processedFiles = [];
        
        for (const file of files) {
            try {
                const content = await this.readFile(file);
                processedFiles.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    content: content
                });
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
            }
        }
        
        return processedFiles;
    }
    
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                if (file.type.startsWith('image/')) {
                    resolve(e.target.result); // Base64 for images
                } else {
                    resolve(e.target.result); // Text for other files
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            
            if (file.type.startsWith('image/')) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
        });
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear the conversation?')) {
            console.log('Clearing chat...');
            this.announceToScreenReader('Conversation cleared');
            
            this.dispatchEvent(new CustomEvent('chat:conversation-cleared', {
                bubbles: true,
                detail: { timestamp: new Date().toISOString() }
            }));
        }
    }
    
    setLoading(loading) {
        const promptInput = this.querySelector('prompt-input');
        if (promptInput) {
            const sendBtn = promptInput.querySelector('.btn-send');
            if (sendBtn) {
                sendBtn.disabled = loading;
                sendBtn.innerHTML = loading ? '⏳' : '↗';
            }
        }
    }
    
    showError(message) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        this.announceToScreenReader(`Error: ${message}`);
    }
    
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}

// Register the main component
customElements.define('chat-interface', ChatInterface);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // The chat-interface component is already in the HTML
    // Just set a global reference for debugging
    const chatInterface = document.querySelector('chat-interface');
    if (chatInterface) {
        window.chatInterface = chatInterface;
    }
});

// Add CSS for toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
