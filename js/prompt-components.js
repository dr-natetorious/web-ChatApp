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
        this.availableOptions = {
            databricks: { enabled: false, spaces: [] },
            snowflake: { enabled: false, clusters: [], databases: [] },
            llm: { enabled: false, knowledgeBases: [] }
        };
        this.selectedOptions = {
            databricks: { enabled: false, spaces: [] },
            snowflake: { enabled: false, clusters: [], databases: [] },
            llm: { enabled: false, knowledgeBases: [] }
        };
    }

    static get observedAttributes() {
        return ['databricks-spaces', 'snowflake-clusters', 'llm-knowledge-bases'];
    }

    connectedCallback() {
        this.parseAttributes();
        this.render();
        this.setupEvents();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.parseAttributes();
            if (this.isConnected) {
                this.render();
            }
        }
    }

    parseAttributes() {
        // Parse databricks-spaces
        if (this.hasAttribute('databricks-spaces')) {
            try {
                const rawValue = this.getAttribute('databricks-spaces');
                if (rawValue && rawValue.trim()) {
                    const decodedValue = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    this.availableOptions.databricks.spaces = JSON.parse(decodedValue);
                    this.availableOptions.databricks.enabled = true;
                    console.log('[OptionsPanel] Parsed databricks-spaces:', this.availableOptions.databricks.spaces);
                }
            } catch (e) {
                console.warn('[OptionsPanel] Invalid databricks-spaces JSON:', e);
                this.availableOptions.databricks.spaces = [];
            }
        }

        // Parse snowflake-clusters
        if (this.hasAttribute('snowflake-clusters')) {
            try {
                const rawValue = this.getAttribute('snowflake-clusters');
                if (rawValue && rawValue.trim()) {
                    const decodedValue = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    this.availableOptions.snowflake.clusters = JSON.parse(decodedValue);
                    this.availableOptions.snowflake.enabled = true;
                    console.log('[OptionsPanel] Parsed snowflake-clusters:', this.availableOptions.snowflake.clusters);
                }
            } catch (e) {
                console.warn('[OptionsPanel] Invalid snowflake-clusters JSON:', e);
                this.availableOptions.snowflake.clusters = [];
            }
        }

        // Parse llm-knowledge-bases
        if (this.hasAttribute('llm-knowledge-bases')) {
            try {
                const rawValue = this.getAttribute('llm-knowledge-bases');
                if (rawValue && rawValue.trim()) {
                    const decodedValue = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                    this.availableOptions.llm.knowledgeBases = JSON.parse(decodedValue);
                    this.availableOptions.llm.enabled = true;
                    console.log('[OptionsPanel] Parsed llm-knowledge-bases:', this.availableOptions.llm.knowledgeBases);
                }
            } catch (e) {
                console.warn('[OptionsPanel] Invalid llm-knowledge-bases JSON:', e);
                this.availableOptions.llm.knowledgeBases = [];
            }
        }

        // Auto-enable services if they have resources available
        Object.keys(this.availableOptions).forEach(service => {
            const serviceConfig = this.availableOptions[service];
            const hasResources = Object.values(serviceConfig).some(value => 
                Array.isArray(value) && value.length > 0 || 
                (typeof value === 'object' && value !== null && Object.keys(value).length > 0)
            );
            
            if (hasResources && !this.selectedOptions[service].enabled) {
                this.selectedOptions[service].enabled = true;
                console.log(`[OptionsPanel] Auto-enabled ${service} service`);
            }
        });
    }
    
    render() {
        this.innerHTML = `
            <div class="dropdown">
                <button class="btn-options btn-icon dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="AI Services Configuration">
                    ⚙️
                </button>
                
                <ul class="dropdown-menu dropdown-menu-end policy-options-menu">
                    ${this.renderDatabricksSection()}
                    ${this.renderSnowflakeSection()}
                    ${this.renderLLMSection()}
                    
                </ul>
            </div>
        `;
    }
    
    renderDatabricksSection() {
        const spacesCount = Array.isArray(this.availableOptions.databricks.spaces) 
            ? this.availableOptions.databricks.spaces.length 
            : Object.keys(this.availableOptions.databricks.spaces).length;
            
        if (!spacesCount) {
            return '';
        }
        
        return `
            <!-- Databricks Genie -->
            <li>
                <div class="service-header">
                    <span>
                        <i class="bi bi-database"></i> Databricks Genie
                    </span>
                </div>
            </li>
            ${Array.isArray(this.availableOptions.databricks.spaces) 
                ? this.availableOptions.databricks.spaces.map(space => `
                    <li class="px-3">
                        <div class="service-item">
                            <label class="service-toggle">
                                <input class="databricks-space" type="checkbox" 
                                       id="space-${space}" value="${space}" checked>
                                <span class="slider"></span>
                            </label>
                            <span>${space}</span>
                        </div>
                    </li>
                `).join('')
                : Object.entries(this.availableOptions.databricks.spaces).map(([displayName, spaceId]) => `
                    <li class="px-3">
                        <div class="service-item">
                            <label class="service-toggle">
                                <input class="databricks-space" type="checkbox" 
                                       id="space-${spaceId}" value="${spaceId}" checked>
                                <span class="slider"></span>
                            </label>
                            <span>${displayName}</span>
                        </div>
                    </li>
                `).join('')
            }
        `;
    }
    
    renderSnowflakeSection() {
        const clustersCount = Array.isArray(this.availableOptions.snowflake.clusters)
            ? this.availableOptions.snowflake.clusters.length
            : Object.keys(this.availableOptions.snowflake.clusters || {}).length;
        const databasesCount = Array.isArray(this.availableOptions.snowflake.databases)
            ? this.availableOptions.snowflake.databases.length
            : Object.keys(this.availableOptions.snowflake.databases || {}).length;
            
        if (!clustersCount && !databasesCount) {
            return '';
        }
        
        return `
            <li><hr class="dropdown-divider"></li>
            
            <!-- Snowflake Cortex -->
            <li>
                <div class="service-header">
                    <span>
                        <i class="bi bi-snow"></i> Snowflake Cortex
                    </span>
                </div>
            </li>
            
            ${this.availableOptions.snowflake.clusters.length ? 
                (Array.isArray(this.availableOptions.snowflake.clusters)
                    ? this.availableOptions.snowflake.clusters.map(cluster => `
                        <li class="px-3">
                            <div class="service-item">
                                <label class="service-toggle">
                                    <input class="snowflake-cluster" type="checkbox" 
                                           id="cluster-${cluster}" value="${cluster}" checked>
                                    <span class="slider"></span>
                                </label>
                                <span>${cluster}</span>
                            </div>
                        </li>
                    `).join('')
                    : Object.entries(this.availableOptions.snowflake.clusters).map(([displayName, clusterId]) => `
                        <li class="px-3">
                            <div class="service-item">
                                <label class="service-toggle">
                                    <input class="snowflake-cluster" type="checkbox" 
                                           id="cluster-${clusterId}" value="${clusterId}" checked>
                                    <span class="slider"></span>
                                </label>
                                <span>${displayName}</span>
                            </div>
                        </li>
                    `).join('')
                ) : ''
            }
            
            ${this.availableOptions.snowflake.databases.length ? 
                this.availableOptions.snowflake.databases.map(database => `
                    <li class="px-3">
                        <div class="service-item">
                            <label class="service-toggle">
                                <input class="snowflake-database" type="checkbox" 
                                       id="database-${database}" value="${database}" checked>
                                <span class="slider"></span>
                            </label>
                            <span>${database}</span>
                        </div>
                    </li>
                `).join('') : ''
            }
        `;
    }
    
    renderLLMSection() {
        const kbCount = Array.isArray(this.availableOptions.llm.knowledgeBases)
            ? this.availableOptions.llm.knowledgeBases.length
            : Object.keys(this.availableOptions.llm.knowledgeBases || {}).length;
            
        if (!kbCount) {
            return '';
        }
        
        return `
            <li><hr class="dropdown-divider"></li>
            
            <!-- LLM Knowledge Bases -->
            <li>
                <div class="service-header">
                    <span>
                        <i class="bi bi-brain"></i> Knowledge Bases
                    </span>
                </div>
            </li>
            ${Array.isArray(this.availableOptions.llm.knowledgeBases)
                ? this.availableOptions.llm.knowledgeBases.map(kb => `
                    <li class="px-3">
                        <div class="service-item">
                            <label class="service-toggle">
                                <input class="llm-kb" type="checkbox" 
                                       id="kb-${kb}" value="${kb}" checked>
                                <span class="slider"></span>
                            </label>
                            <span>${kb}</span>
                        </div>
                    </li>
                `).join('')
                : Object.entries(this.availableOptions.llm.knowledgeBases).map(([displayName, kbId]) => `
                    <li class="px-3">
                        <div class="service-item">
                            <label class="service-toggle">
                                <input class="llm-kb" type="checkbox" 
                                       id="kb-${kbId}" value="${kbId}" checked>
                                <span class="slider"></span>
                            </label>
                            <span>${displayName}</span>
                        </div>
                    </li>
                `).join('')
            }
        `;
    }
    
    setupEvents() {
        // Prevent dropdown from closing when clicking inside
        const dropdown = this.querySelector('.dropdown-menu');
        if (dropdown) {
            this.addEventListenerTracked(dropdown, 'click', (e) => {
                e.stopPropagation();
            });
        }

        // Close dropdown when clicking outside
        this.addEventListenerTracked(document, 'click', (e) => {
            const dropdownButton = this.querySelector('.btn-options');
            const dropdownMenu = this.querySelector('.dropdown-menu');
            
            if (dropdownButton && dropdownMenu && 
                !this.contains(e.target) && 
                dropdownMenu.classList.contains('show')) {
                // Close the dropdown
                dropdownButton.click();
            }
        });

        // Databricks spaces
        this.querySelectorAll('.databricks-space').forEach(checkbox => {
            this.addEventListenerTracked(checkbox, 'change', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                const space = e.target.value;
                if (e.target.checked) {
                    if (!this.selectedOptions.databricks.spaces.includes(space)) {
                        this.selectedOptions.databricks.spaces.push(space);
                    }
                } else {
                    this.selectedOptions.databricks.spaces = 
                        this.selectedOptions.databricks.spaces.filter(s => s !== space);
                }
                this.notifyPolicyChange();
            });
        });
        
        // Snowflake clusters
        this.querySelectorAll('.snowflake-cluster').forEach(checkbox => {
            this.addEventListenerTracked(checkbox, 'change', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                const cluster = e.target.value;
                if (e.target.checked) {
                    if (!this.selectedOptions.snowflake.clusters.includes(cluster)) {
                        this.selectedOptions.snowflake.clusters.push(cluster);
                    }
                } else {
                    this.selectedOptions.snowflake.clusters = 
                        this.selectedOptions.snowflake.clusters.filter(c => c !== cluster);
                }
                this.notifyPolicyChange();
            });
        });
        
        // Snowflake databases
        this.querySelectorAll('.snowflake-database').forEach(checkbox => {
            this.addEventListenerTracked(checkbox, 'change', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                const database = e.target.value;
                if (e.target.checked) {
                    if (!this.selectedOptions.snowflake.databases.includes(database)) {
                        this.selectedOptions.snowflake.databases.push(database);
                    }
                } else {
                    this.selectedOptions.snowflake.databases = 
                        this.selectedOptions.snowflake.databases.filter(d => d !== database);
                }
                this.notifyPolicyChange();
            });
        });
        
        // LLM knowledge bases
        this.querySelectorAll('.llm-kb').forEach(checkbox => {
            this.addEventListenerTracked(checkbox, 'change', (e) => {
                e.stopPropagation(); // Prevent event bubbling
                const kb = e.target.value;
                if (e.target.checked) {
                    if (!this.selectedOptions.llm.knowledgeBases.includes(kb)) {
                        this.selectedOptions.llm.knowledgeBases.push(kb);
                    }
                } else {
                    this.selectedOptions.llm.knowledgeBases = 
                        this.selectedOptions.llm.knowledgeBases.filter(k => k !== kb);
                }
                this.notifyPolicyChange();
            });
        });
    }
    
    updateSubOptions(service, enabled) {
        if (!enabled) {
            // Clear all sub-options when service is disabled
            if (service === 'databricks') {
                this.selectedOptions.databricks.spaces = [];
            } else if (service === 'snowflake') {
                this.selectedOptions.snowflake.clusters = [];
                this.selectedOptions.snowflake.databases = [];
            } else if (service === 'llm') {
                this.selectedOptions.llm.knowledgeBases = [];
            }
        } else {
            // When enabling, start with all available options selected
            if (service === 'databricks') {
                const spaces = Array.isArray(this.availableOptions.databricks.spaces) 
                    ? [...this.availableOptions.databricks.spaces]
                    : Object.values(this.availableOptions.databricks.spaces);
                this.selectedOptions.databricks.spaces = spaces;
            } else if (service === 'snowflake') {
                const clusters = Array.isArray(this.availableOptions.snowflake.clusters)
                    ? [...this.availableOptions.snowflake.clusters] 
                    : Object.values(this.availableOptions.snowflake.clusters);
                const databases = Array.isArray(this.availableOptions.snowflake.databases)
                    ? [...this.availableOptions.snowflake.databases]
                    : Object.values(this.availableOptions.snowflake.databases);
                this.selectedOptions.snowflake.clusters = clusters;
                this.selectedOptions.snowflake.databases = databases;
            } else if (service === 'llm') {
                const knowledgeBases = Array.isArray(this.availableOptions.llm.knowledgeBases)
                    ? [...this.availableOptions.llm.knowledgeBases]
                    : Object.values(this.availableOptions.llm.knowledgeBases);
                this.selectedOptions.llm.knowledgeBases = knowledgeBases;
            }
        }
    }
    
    notifyPolicyChange() {
        this.dispatchEvent(new CustomEvent('policy-changed', {
            bubbles: true,
            detail: { 
                policy: this.generateOperationPolicy()
            }
        }));
    }
    
    generateOperationPolicy() {
        const policy = {};
        
        if (this.selectedOptions.databricks.enabled && this.selectedOptions.databricks.spaces.length) {
            policy.databricks = {
                enabled: true,
                spaces: this.selectedOptions.databricks.spaces
            };
        }
        
        if (this.selectedOptions.snowflake.enabled && 
            (this.selectedOptions.snowflake.clusters.length || this.selectedOptions.snowflake.databases.length)) {
            policy.snowflake = {
                enabled: true,
                clusters: this.selectedOptions.snowflake.clusters,
                databases: this.selectedOptions.snowflake.databases
            };
        }
        
        if (this.selectedOptions.llm.enabled && this.selectedOptions.llm.knowledgeBases.length) {
            policy.llm = {
                enabled: true,
                knowledgeBases: this.selectedOptions.llm.knowledgeBases
            };
        }
        
    }

    generatePolicy() {
        const policy = {
            databricks: {
                enabled: this.selectedOptions.databricks.enabled,
                token: this.selectedOptions.databricks.token,
                spaces: this.selectedOptions.databricks.spaces
            },
            snowflake: {
                enabled: this.selectedOptions.snowflake.enabled,
                token: this.selectedOptions.snowflake.token,
                clusters: this.selectedOptions.snowflake.clusters
            },
            llm: {
                enabled: this.selectedOptions.llm.enabled,
                knowledgeBases: this.selectedOptions.llm.knowledgeBases
            }
        };
        
        return policy;
    }

    getSelectedOptions() {
        return { ...this.selectedOptions };
    }

    closePanel() {
        this.isOpen = false;
        this.querySelector('.options-dropdown').style.display = 'none';
    }
}

// Register all components
customElements.define('prompt-input', PromptInput);
customElements.define('file-manager', FileManager);
customElements.define('model-selector', ModelSelector);
customElements.define('options-panel', OptionsPanel);
