/**
 * Prompt Components - Simplified Web Components
 * Clean, focused components for chat interface
 */

/**
 * Prompt Input Component
 * Auto-resizing textarea with send functionality
 */
class PromptInput extends HTMLElement {
    constructor() {
        super();
        this.maxHeight = 300;
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
        this.innerHTML = `
            <div class="prompt-input-container">
                <textarea 
                    class="prompt-textarea form-control" 
                    placeholder="Message..." 
                    rows="1"
                    aria-label="Enter your message"
                ></textarea>
                <button 
                    class="btn-send" 
                    type="button" 
                    disabled
                    aria-label="Send message"
                >
                    ↗
                </button>
            </div>
        `;
    }
    
    setupEvents() {
        const textarea = this.querySelector('.prompt-textarea');
        const sendBtn = this.querySelector('.btn-send');
        
        this.addEventListenerTracked(textarea, 'input', this.handleInput.bind(this));
        this.addEventListenerTracked(textarea, 'keydown', this.handleKeyDown.bind(this));
        this.addEventListenerTracked(sendBtn, 'click', this.handleSend.bind(this));
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
    
    handleInput(e) {
        const textarea = e.target;
        
        // Auto-resize
        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, this.maxHeight);
        textarea.style.height = newHeight + 'px';
        
        // Update send button
        this.updateSendButton();
        
        // Dispatch input event
        this.dispatchEvent(new CustomEvent('prompt-input', {
            bubbles: true,
            detail: { value: textarea.value }
        }));
    }
    
    handleKeyDown(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.handleSend();
        }
    }
    
    handleSend() {
        const textarea = this.querySelector('.prompt-textarea');
        const message = textarea.value.trim();
        
        if (!message) return;
        
        this.dispatchEvent(new CustomEvent('message-send', {
            bubbles: true,
            detail: { message }
        }));
        
        textarea.value = '';
        textarea.style.height = 'auto';
        this.updateSendButton();
    }
    
    updateSendButton() {
        const textarea = this.querySelector('.prompt-textarea');
        const sendBtn = this.querySelector('.btn-send');
        const hasText = textarea.value.trim().length > 0;
        
        sendBtn.disabled = !hasText;
    }
    
    getValue() {
        return this.querySelector('.prompt-textarea').value;
    }
    
    setValue(value) {
        const textarea = this.querySelector('.prompt-textarea');
        textarea.value = value;
        this.updateSendButton();
    }
    
    clear() {
        this.setValue('');
    }
    
    focus() {
        this.querySelector('.prompt-textarea').focus();
    }
}

/**
 * File Manager Component
 * File selection, drag & drop, and file previews
 */
class FileManager extends HTMLElement {
    constructor() {
        super();
        this.selectedFiles = new Map();
        this.eventListeners = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTypes = [
            'text/plain',
            'text/csv',
            'application/json',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ];
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
            <div class="file-manager-container">
                <div class="file-drop-zone" style="display: none;">
                    <div class="drop-zone-content">
                        <div class="drop-icon">📎</div>
                        <h4>Drop files here</h4>
                        <p>Support for text, images, and documents (max 10MB)</p>
                    </div>
                </div>
                
                <div class="file-previews"></div>
                
                <input type="file" class="file-input d-none" multiple 
                       accept=".txt,.csv,.json,.pdf,.jpg,.jpeg,.png,.gif,.webp">
                
                <button type="button" class="btn-attach btn-icon" title="Attach files">
                    📎
                </button>
            </div>
        `;
    }
    
    setupEvents() {
        const fileInput = this.querySelector('.file-input');
        const attachBtn = this.querySelector('.btn-attach');
        
        this.addEventListenerTracked(fileInput, 'change', this.handleFileSelect.bind(this));
        this.addEventListenerTracked(attachBtn, 'click', this.openFileDialog.bind(this));
        
        // Setup drag and drop
        this.setupDropZone();
    }
    
    setupDropZone() {
        const dropEvents = ['dragenter', 'dragover', 'dragleave', 'drop'];
        
        dropEvents.forEach(eventName => {
            this.addEventListenerTracked(this, eventName, this.preventDefaults.bind(this));
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            this.addEventListenerTracked(this, eventName, this.highlight.bind(this));
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.addEventListenerTracked(this, eventName, this.unhighlight.bind(this));
        });
        
        this.addEventListenerTracked(this, 'drop', this.handleDrop.bind(this));
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
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    highlight(e) {
        const dropZone = this.querySelector('.file-drop-zone');
        dropZone.style.display = 'block';
        dropZone.classList.add('dragover');
    }
    
    unhighlight(e) {
        const dropZone = this.querySelector('.file-drop-zone');
        dropZone.classList.remove('dragover');
        if (e.type === 'dragleave' || e.type === 'drop') {
            dropZone.style.display = 'none';
        }
    }
    
    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files);
        this.addFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFiles(files);
        e.target.value = ''; // Clear input
    }
    
    addFiles(files) {
        files.forEach(file => {
            if (this.isValidFile(file)) {
                const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.selectedFiles.set(fileId, file);
                this.renderFilePreview(fileId, file);
                
                this.dispatchEvent(new CustomEvent('file-added', {
                    bubbles: true,
                    detail: { fileId, file, totalFiles: this.selectedFiles.size }
                }));
            } else {
                this.dispatchEvent(new CustomEvent('file-error', {
                    bubbles: true,
                    detail: { error: `File ${file.name} is not supported or too large` }
                }));
            }
        });
    }
    
    isValidFile(file) {
        return file.size <= this.maxFileSize && this.allowedTypes.includes(file.type);
    }
    
    renderFilePreview(fileId, file) {
        const container = this.querySelector('.file-previews');
        
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        preview.innerHTML = `
            <div class="file-info">
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                <span class="file-size">(${this.formatFileSize(file.size)})</span>
            </div>
            <button type="button" class="btn-remove btn-icon" data-file-id="${fileId}" 
                    aria-label="Remove ${this.escapeHtml(file.name)}">
                ✕
            </button>
        `;
        
        const removeBtn = preview.querySelector('.btn-remove');
        this.addEventListenerTracked(removeBtn, 'click', () => this.removeFile(fileId));
        
        container.appendChild(preview);
    }
    
    removeFile(fileId) {
        const file = this.selectedFiles.get(fileId);
        if (file) {
            this.selectedFiles.delete(fileId);
            
            // Remove preview element
            const preview = this.querySelector(`[data-file-id="${fileId}"]`).closest('.file-preview');
            if (preview) {
                preview.remove();
            }
            
            this.dispatchEvent(new CustomEvent('file-removed', {
                bubbles: true,
                detail: { fileId, fileName: file.name, totalFiles: this.selectedFiles.size }
            }));
        }
    }
    
    openFileDialog() {
        this.querySelector('.file-input').click();
    }
    
    getFiles() {
        return Array.from(this.selectedFiles.values());
    }
    
    clearFiles() {
        this.selectedFiles.clear();
        this.querySelector('.file-previews').innerHTML = '';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
 * Model Selector Component
 * Model selection dropdown
 */
class ModelSelector extends HTMLElement {
    constructor() {
        super();
        this.currentModel = 'claude-3-haiku';
        this.models = [
            { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
            { value: 'claude-3-sonnet', label: 'Claude 3.5 Sonnet' },
            { value: 'claude-3-opus', label: 'Claude 3 Opus' }
        ];
        this.eventListeners = [];
    }
    
    static get observedAttributes() {
        return ['data-model'];
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data-model' && newValue !== oldValue) {
            this.currentModel = newValue;
            this.updateSelection();
        }
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
            <select class="model-dropdown" aria-label="Select AI model">
                ${this.models.map(model => 
                    `<option value="${model.value}" ${model.value === this.currentModel ? 'selected' : ''}>
                        ${model.label}
                    </option>`
                ).join('')}
            </select>
        `;
    }
    
    setupEvents() {
        const dropdown = this.querySelector('.model-dropdown');
        this.addEventListenerTracked(dropdown, 'change', this.handleModelChange.bind(this));
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
    
    handleModelChange(e) {
        this.currentModel = e.target.value;
        const selectedModel = this.models.find(m => m.value === this.currentModel);
        
        this.dispatchEvent(new CustomEvent('model-changed', {
            bubbles: true,
            detail: { model: this.currentModel, modelInfo: selectedModel }
        }));
    }
    
    updateSelection() {
        const dropdown = this.querySelector('.model-dropdown');
        if (dropdown) {
            dropdown.value = this.currentModel;
        }
    }
    
    getModel() {
        return this.currentModel;
    }
    
    setModel(model) {
        this.currentModel = model;
        this.updateSelection();
    }
}

/**
 * Options Panel Component
 * Settings toggles and options
 */
class OptionsPanel extends HTMLElement {
    constructor() {
        super();
        this.options = {
            useProjectContext: false,
            useArtifacts: false,
            useAnalysis: false,
            useLatex: false
        };
        this.eventListeners = [];
        this.isOpen = false;
    }
    
    static get observedAttributes() {
        return ['data-options'];
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data-options' && newValue) {
            try {
                const options = JSON.parse(newValue);
                Object.assign(this.options, options);
                this.updateToggles();
            } catch (error) {
                console.error('Failed to parse options:', error);
            }
        }
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
            <div class="options-container">
                <button type="button" class="btn-options btn-icon" title="Options">
                    ⚙️
                </button>
                
                <div class="options-dropdown" style="display: none;">
                    <div class="option-section">
                        <div class="option-header">Context</div>
                        <div class="option-toggle">
                            <div class="toggle-info">
                                <span>Project Context</span>
                                <small>Include workspace files</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="projectContextToggle">
                            </div>
                        </div>
                    </div>
                    
                    <div class="option-section">
                        <div class="option-header">Features</div>
                        <div class="option-toggle">
                            <div class="toggle-info">
                                <span>Artifacts</span>
                                <small>Code and documents</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="artifactsToggle">
                            </div>
                        </div>
                        <div class="option-toggle">
                            <div class="toggle-info">
                                <span>Analysis</span>
                                <small>Deep thinking mode</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="analysisToggle">
                            </div>
                        </div>
                        <div class="option-toggle">
                            <div class="toggle-info">
                                <span>LaTeX</span>
                                <small>Math rendering</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="latexToggle">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    setupEvents() {
        const optionsBtn = this.querySelector('.btn-options');
        this.addEventListenerTracked(optionsBtn, 'click', this.togglePanel.bind(this));
        
        // Setup toggles
        const toggles = {
            'projectContextToggle': 'useProjectContext',
            'artifactsToggle': 'useArtifacts',
            'analysisToggle': 'useAnalysis',
            'latexToggle': 'useLatex'
        };
        
        Object.entries(toggles).forEach(([id, property]) => {
            const toggle = this.querySelector(`#${id}`);
            if (toggle) {
                this.addEventListenerTracked(toggle, 'change', (e) => {
                    this.options[property] = e.target.checked;
                    this.dispatchEvent(new CustomEvent('option-changed', {
                        bubbles: true,
                        detail: { property, value: e.target.checked, options: { ...this.options } }
                    }));
                });
            }
        });
        
        // Close panel when clicking outside
        this.addEventListenerTracked(document, 'click', (e) => {
            if (this.isOpen && !this.contains(e.target)) {
                this.closePanel();
            }
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
    
    togglePanel() {
        const dropdown = this.querySelector('.options-dropdown');
        this.isOpen = !this.isOpen;
        dropdown.style.display = this.isOpen ? 'block' : 'none';
        
        this.dispatchEvent(new CustomEvent('panel-toggled', {
            bubbles: true,
            detail: { isOpen: this.isOpen }
        }));
    }
    
    closePanel() {
        const dropdown = this.querySelector('.options-dropdown');
        this.isOpen = false;
        dropdown.style.display = 'none';
    }
    
    updateToggles() {
        const toggles = {
            'projectContextToggle': 'useProjectContext',
            'artifactsToggle': 'useArtifacts',
            'analysisToggle': 'useAnalysis',
            'latexToggle': 'useLatex'
        };
        
        Object.entries(toggles).forEach(([id, property]) => {
            const toggle = this.querySelector(`#${id}`);
            if (toggle) {
                toggle.checked = this.options[property];
            }
        });
    }
    
    getOptions() {
        return { ...this.options };
    }
    
    setOptions(options) {
        Object.assign(this.options, options);
        this.updateToggles();
    }
}

// Register all components
customElements.define('prompt-input', PromptInput);
customElements.define('file-manager', FileManager);
customElements.define('model-selector', ModelSelector);
customElements.define('options-panel', OptionsPanel);
