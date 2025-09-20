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
        
        console.log('[PromptInput] Send button clicked, message:', message);
        
        if (!message) {
            console.log('[PromptInput] No message content, ignoring send');
            return;
        }
        
        console.log('[PromptInput] Dispatching message-send event with message:', message);
        
        this.dispatchEvent(new CustomEvent('message-send', {
            bubbles: true,
            detail: { message }
        }));
        
        textarea.value = '';
        textarea.style.height = 'auto';
        this.updateSendButton();
        
        console.log('[PromptInput] Message sent, input cleared');
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
            </div>
        `;
    }
    
    setupEvents() {
        const fileInput = this.querySelector('.file-input');
        
        this.addEventListenerTracked(fileInput, 'change', this.handleFileSelect.bind(this));
        
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
            <div class="dropdown">
                <button class="btn-options btn-icon dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Data Sources">
                    ⚙️
                </button>
                
                <ul class="dropdown-menu dropdown-menu-end">
                    <!-- Databricks Genie -->
                    <li>
                        <h6 class="dropdown-header">
                            <i class="bi bi-database"></i> Databricks Genie
                        </h6>
                    </li>
                    <li><a class="dropdown-item" href="#" data-source="databricks" data-space="analytics-prod">
                        <span class="fw-medium">Analytics Production</span>
                        <small class="text-muted d-block">Main analytics workspace</small>
                    </a></li>
                    <li><a class="dropdown-item" href="#" data-source="databricks" data-space="ml-experiments">
                        <span class="fw-medium">ML Experiments</span>
                        <small class="text-muted d-block">Machine learning sandbox</small>
                    </a></li>
                    <li><a class="dropdown-item" href="#" data-source="databricks" data-space="data-engineering">
                        <span class="fw-medium">Data Engineering</span>
                        <small class="text-muted d-block">ETL and data pipelines</small>
                    </a></li>
                    
                    <li><hr class="dropdown-divider"></li>
                    
                    <!-- Snowflake Cortex -->
                    <li>
                        <h6 class="dropdown-header">
                            <i class="bi bi-snow"></i> Snowflake Cortex
                        </h6>
                    </li>
                    <li><a class="dropdown-item" href="#" data-source="snowflake">
                        <span class="fw-medium">Cortex Intelligence</span>
                        <small class="text-muted d-block">AI-powered analytics</small>
                    </a></li>
                    
                    <li><hr class="dropdown-divider"></li>
                    
                    <!-- LLM Suite -->
                    <li>
                        <h6 class="dropdown-header">
                            <i class="bi bi-brain"></i> LLM Suite
                        </h6>
                    </li>
                    <li><a class="dropdown-item" href="#" data-source="llm" data-kb="company-docs">
                        <span class="fw-medium">Company Documentation</span>
                        <small class="text-muted d-block">Internal knowledge base</small>
                    </a></li>
                    <li><a class="dropdown-item" href="#" data-source="llm" data-kb="technical-specs">
                        <span class="fw-medium">Technical Specifications</span>
                        <small class="text-muted d-block">API and system docs</small>
                    </a></li>
                    <li><a class="dropdown-item" href="#" data-source="llm" data-kb="customer-data">
                        <span class="fw-medium">Customer Analytics</span>
                        <small class="text-muted d-block">Customer insights and data</small>
                    </a></li>
                    
                    <li><hr class="dropdown-divider"></li>
                    
                    <!-- Project Context Toggle -->
                    <li class="px-3 py-2">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="projectContextToggle">
                            <label class="form-check-label" for="projectContextToggle">
                                Include Project Context
                            </label>
                        </div>
                    </li>
                </ul>
            </div>
        `;
    }
    
    setupEvents() {
        // Setup data source selection
        const dropdownItems = this.querySelectorAll('.dropdown-item[data-source]');
        dropdownItems.forEach(item => {
            this.addEventListenerTracked(item, 'click', (e) => {
                e.preventDefault();
                this.handleDataSourceSelect(e.target.closest('.dropdown-item'));
            });
        });
        
        // Setup project context toggle
        const contextToggle = this.querySelector('#projectContextToggle');
        if (contextToggle) {
            this.addEventListenerTracked(contextToggle, 'change', (e) => {
                this.options.useProjectContext = e.target.checked;
                this.dispatchEvent(new CustomEvent('option-changed', {
                    bubbles: true,
                    detail: { 
                        option: 'useProjectContext', 
                        value: e.target.checked 
                    }
                }));
            });
        }
    }
    
    handleDataSourceSelect(item) {
        const source = item.dataset.source;
        const space = item.dataset.space;
        const kb = item.dataset.kb;
        
        let selection = { source };
        if (space) selection.space = space;
        if (kb) selection.knowledgeBase = kb;
        
        // Update UI to show selection
        this.updateSelectedSource(item);
        
        // Dispatch event
        this.dispatchEvent(new CustomEvent('data-source-changed', {
            bubbles: true,
            detail: selection
        }));
    }
    
    updateSelectedSource(selectedItem) {
        // Remove previous selections
        this.querySelectorAll('.dropdown-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Mark current selection
        selectedItem.classList.add('active');
        
        // Update button icon based on source
        const button = this.querySelector('.btn-options');
        const source = selectedItem.dataset.source;
        
        switch(source) {
            case 'databricks':
                button.innerHTML = '🔥';
                button.title = `Databricks: ${selectedItem.querySelector('.fw-medium').textContent}`;
                break;
            case 'snowflake':
                button.innerHTML = '❄️';
                button.title = 'Snowflake Cortex';
                break;
            case 'llm':
                button.innerHTML = '🧠';
                button.title = `LLM Suite: ${selectedItem.querySelector('.fw-medium').textContent}`;
                break;
            default:
                button.innerHTML = '🔌';
                button.title = 'Data Sources';
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
