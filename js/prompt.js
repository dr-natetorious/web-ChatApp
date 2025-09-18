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
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
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
