/**
 * ChitChat Message System
 * Extensible message type implementations and contracts
 */

/**
 * Base Message Interface
 * All message types should implement this contract
 */
class BaseMessage {
    constructor(chatComponent) {
        this.chatComponent = chatComponent;
    }

    /**
     * Render the message content
     * @param {Object} message - Message data
     * @returns {string} HTML content
     */
    render(message) {
        throw new Error('render() method must be implemented by message type');
    }

    /**
     * Validate message data
     * @param {Object} message - Message data to validate
     * @returns {boolean} True if valid
     */
    validate(message) {
        return message && typeof message.content !== 'undefined';
    }

    /**
     * Get required fields for this message type
     * @returns {Array<string>} Array of required field names
     */
    getRequiredFields() {
        return ['content'];
    }

    /**
     * Escape HTML content for security
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Text Message Implementation
 */
class TextMessage extends BaseMessage {
    render(message) {
        return this.escapeHtml(message.content);
    }

    validate(message) {
        return super.validate(message) && typeof message.content === 'string';
    }
}

/**
 * Image Message Implementation
 */
class ImageMessage extends BaseMessage {
    render(message) {
        return `
            <div class="message-rich-content">
                <img src="${this.escapeHtml(message.url)}" 
                     alt="${this.escapeHtml(message.alt || 'Image')}" 
                     class="message-image" 
                     onclick="window.open('${this.escapeHtml(message.url)}', '_blank')"
                     loading="lazy">
                ${message.caption ? `<div class="mt-2">${this.escapeHtml(message.caption)}</div>` : ''}
            </div>
        `;
    }

    validate(message) {
        return message && message.url && typeof message.url === 'string';
    }

    getRequiredFields() {
        return ['url'];
    }
}

/**
 * Table Message Implementation
 */
class TableMessage extends BaseMessage {
    render(message) {
        const headers = message.headers || [];
        const rows = message.rows || [];
        
        return `
            <div class="message-rich-content">
                ${message.title ? `<strong class="table-title">${this.escapeHtml(message.title)}</strong>` : ''}
                <div class="table-responsive">
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
                                    ${(Array.isArray(row) ? row : Object.values(row)).map(cell => 
                                        `<td>${this.escapeHtml(String(cell))}</td>`
                                    ).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    validate(message) {
        return message && Array.isArray(message.rows);
    }

    getRequiredFields() {
        return ['rows'];
    }
}

/**
 * System Message Implementation
 */
class SystemMessage extends BaseMessage {
    render(message) {
        const icon = message.icon || 'info-circle';
        const variant = message.variant || 'info'; // info, warning, error, success
        
        return `
            <div class="system-message system-message-${variant}">
                <i class="bi bi-${icon} me-2"></i>
                ${this.escapeHtml(message.content)}
            </div>
        `;
    }

    validate(message) {
        return super.validate(message);
    }
}

/**
 * Quick Reply Message Implementation
 */
class QuickReplyMessage extends BaseMessage {
    render(message) {
        const replies = Array.isArray(message.replies) ? message.replies : [];
        
        return `
            <div class="quick-reply-message">
                ${this.escapeHtml(message.content)}
                <div class="quick-replies mt-2">
                    ${replies.map(reply => {
                        const replyText = typeof reply === 'string' ? reply : reply.text;
                        const replyValue = typeof reply === 'string' ? reply : reply.value;
                        return `<button class="quick-reply-btn btn btn-outline-primary btn-sm me-2 mb-2" 
                                       data-value="${this.escapeHtml(replyValue)}">
                                    ${this.escapeHtml(replyText)}
                                </button>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    validate(message) {
        return super.validate(message) && Array.isArray(message.replies) && message.replies.length > 0;
    }

    getRequiredFields() {
        return ['content', 'replies'];
    }
}

/**
 * File Message Implementation
 */
class FileMessage extends BaseMessage {
    render(message) {
        const fileSize = message.size ? this.formatFileSize(message.size) : '';
        const fileIcon = this.getFileIcon(message.name || message.url);
        
        return `
            <div class="message-rich-content file-message">
                <div class="file-attachment d-flex align-items-center p-3 border rounded">
                    <i class="bi bi-${fileIcon} fs-4 me-3 text-primary"></i>
                    <div class="file-info flex-grow-1">
                        <div class="file-name fw-semibold">${this.escapeHtml(message.name || 'Unnamed file')}</div>
                        ${fileSize ? `<small class="text-muted">${fileSize}</small>` : ''}
                    </div>
                    ${message.url ? `
                        <a href="${this.escapeHtml(message.url)}" 
                           class="btn btn-outline-primary btn-sm" 
                           target="_blank" 
                           download="${this.escapeHtml(message.name || '')}">
                            <i class="bi bi-download"></i>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }

    validate(message) {
        return message && (message.name || message.url);
    }

    getRequiredFields() {
        return ['name'];
    }

    getFileIcon(filename) {
        if (!filename) return 'file-earmark';
        
        const ext = filename.toLowerCase().split('.').pop();
        const iconMap = {
            pdf: 'file-earmark-pdf',
            doc: 'file-earmark-word',
            docx: 'file-earmark-word',
            xls: 'file-earmark-excel',
            xlsx: 'file-earmark-excel',
            ppt: 'file-earmark-ppt',
            pptx: 'file-earmark-ppt',
            jpg: 'file-earmark-image',
            jpeg: 'file-earmark-image',
            png: 'file-earmark-image',
            gif: 'file-earmark-image',
            mp4: 'file-earmark-play',
            mp3: 'file-earmark-music',
            zip: 'file-earmark-zip',
            txt: 'file-earmark-text'
        };
        
        return iconMap[ext] || 'file-earmark';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Loading Message Implementation
 */
class LoadingMessage extends BaseMessage {
    render(message) {
        return `
            <div class="loading-message d-flex align-items-center">
                <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                ${message.content ? this.escapeHtml(message.content) : 'Loading...'}
            </div>
        `;
    }

    validate(message) {
        return true; // Loading messages don't require content
    }

    getRequiredFields() {
        return [];
    }
}

/**
 * Message Registry - Central registry for all message types
 */
class MessageRegistry {
    constructor() {
        this.messageTypes = new Map();
        this.registerDefaultTypes();
    }

    /**
     * Register a message type
     * @param {string} type - Message type name
     * @param {BaseMessage} messageClass - Message implementation class
     */
    registerType(type, messageClass) {
        if (!(messageClass.prototype instanceof BaseMessage)) {
            throw new Error(`Message type ${type} must extend BaseMessage`);
        }
        this.messageTypes.set(type, messageClass);
    }

    /**
     * Get message implementation for type
     * @param {string} type - Message type
     * @param {Object} chatComponent - Chat component instance
     * @returns {BaseMessage} Message implementation instance
     */
    getMessageImplementation(type, chatComponent) {
        const MessageClass = this.messageTypes.get(type);
        if (!MessageClass) {
            console.warn(`Unknown message type: ${type}, falling back to text`);
            return new TextMessage(chatComponent);
        }
        return new MessageClass(chatComponent);
    }

    /**
     * Check if message type is registered
     * @param {string} type - Message type
     * @returns {boolean}
     */
    hasType(type) {
        return this.messageTypes.has(type);
    }

    /**
     * Get all registered message types
     * @returns {Array<string>}
     */
    getRegisteredTypes() {
        return Array.from(this.messageTypes.keys());
    }

    /**
     * Register default message types
     */
    registerDefaultTypes() {
        this.registerType('text', TextMessage);
        this.registerType('image', ImageMessage);
        this.registerType('table', TableMessage);
        this.registerType('system', SystemMessage);
        this.registerType('quick_reply', QuickReplyMessage);
        this.registerType('file', FileMessage);
        this.registerType('loading', LoadingMessage);
    }
}

/**
 * Message Validation Utilities
 */
class MessageValidator {
    /**
     * Validate a message against its type requirements
     * @param {Object} message - Message to validate
     * @param {BaseMessage} messageImpl - Message implementation
     * @returns {Object} Validation result
     */
    static validate(message, messageImpl) {
        const result = {
            valid: true,
            errors: []
        };

        // Check required fields
        const requiredFields = messageImpl.getRequiredFields();
        for (const field of requiredFields) {
            if (!(field in message) || message[field] === null || message[field] === undefined) {
                result.valid = false;
                result.errors.push(`Required field missing: ${field}`);
            }
        }

        // Use type-specific validation
        if (!messageImpl.validate(message)) {
            result.valid = false;
            result.errors.push(`Message failed type-specific validation for type: ${message.type}`);
        }

        return result;
    }
}

// Create global registry instance
const messageRegistry = new MessageRegistry();

// Export for use
window.ChitChatMessages = {
    BaseMessage,
    TextMessage,
    ImageMessage,
    TableMessage,
    SystemMessage,
    QuickReplyMessage,
    FileMessage,
    LoadingMessage,
    MessageRegistry,
    MessageValidator,
    registry: messageRegistry
};

// Also export individual classes for easier access
window.BaseMessage = BaseMessage;
window.TextMessage = TextMessage;
window.ImageMessage = ImageMessage;
window.TableMessage = TableMessage;
window.SystemMessage = SystemMessage;
window.QuickReplyMessage = QuickReplyMessage;
window.FileMessage = FileMessage;
window.LoadingMessage = LoadingMessage;
