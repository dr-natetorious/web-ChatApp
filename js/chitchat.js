/**
 * ChitChat - Professional Chat Interface Web Component
 * A modern, extensible chat interface with rich message support
 * Built with vanilla JavaScript and Bootstrap 5.3
 */

class ChitChatComponent extends HTMLElement {
    constructor() {
        super();
        
        // Lightweight OTLC integration with safe fallbacks
        this.otlc = this.initObservability();
        
        // Define message components immediately
        this.defineMessageComponents();
        
        // Initialize properties
        this.messages = [];
        this.messageQueue = []; // Queue messages until component is ready
        this.messageHandlers = new Map();
        this.isTyping = false;
        this.eventListeners = {};
        this.isInitialized = false;
        
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
    }

    defineMessageComponents() {
        // Define message web components within this chat instance scope
        
        // Base Message Component
        if (!customElements.get('chitchat-base-message')) {
            class ChitChatBaseMessage extends HTMLElement {
                constructor() {
                    super();
                    this.messageData = {};
                }

                connectedCallback() {
                    if (this.hasAttribute('data-message')) {
                        try {
                            this.messageData = JSON.parse(this.getAttribute('data-message'));
                            this.render();
                        } catch (error) {
                            console.error('Failed to parse message data:', error);
                        }
                    }
                }

                render() {
                    this.innerHTML = '<div class="message-content">Base message component</div>';
                }

                escapeHtml(text) {
                    if (typeof text !== 'string') return '';
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
            }
            customElements.define('chitchat-base-message', ChitChatBaseMessage);
        }

        // Text Message Component
        if (!customElements.get('chitchat-text-message')) {
            class ChitChatTextMessage extends customElements.get('chitchat-base-message') {
                render() {
                    const content = this.messageData.content || '';
                    this.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
                }
            }
            customElements.define('chitchat-text-message', ChitChatTextMessage);
        }

        // Table Message Component with Professional Features
        if (!customElements.get('chitchat-table-message')) {
            class ChitChatTableMessage extends customElements.get('chitchat-base-message') {
                constructor() {
                    super();
                    this.sortColumn = null;
                    this.sortDirection = 'asc';
                    this.filterText = '';
                    this.originalRows = [];
                }

                render() {
                    const { title = '', headers = [], rows = [] } = this.messageData;
                    this.originalRows = [...rows];
                    
                    const titleHtml = title ? `<h6 class="table-title mb-3">${this.escapeHtml(title)}</h6>` : '';
                    const tableId = `table-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    this.innerHTML = `
                        <div class="table-message-container">
                            ${titleHtml}
                            
                            <!-- Table Controls -->
                            <div class="table-controls mb-3 d-flex justify-content-between align-items-center flex-wrap">
                                <div class="table-filter d-flex align-items-center">
                                    <label class="form-label me-2 mb-0 small text-muted">Filter:</label>
                                    <input type="text" class="form-control form-control-sm filter-input" 
                                           placeholder="Type to filter..." style="max-width: 200px;">
                                </div>
                                
                                <div class="table-actions">
                                    <div class="btn-group" role="group">
                                        <button class="btn btn-outline-secondary btn-sm clear-filter-btn" 
                                                title="Clear filter">
                                            <i class="bi bi-x-circle"></i>
                                        </button>
                                        <button class="btn btn-outline-success btn-sm export-excel-btn" 
                                                title="Export to Excel">
                                            <i class="bi bi-file-earmark-spreadsheet"></i>
                                            Excel
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Responsive Table Wrapper -->
                            <div class="table-responsive">
                                <table class="table table-hover table-sm sortable-table" id="${tableId}">
                                    <thead class="table-light">
                                        <tr>
                                            ${headers.map((header, index) => `
                                                <th scope="col" class="sortable-header position-relative" 
                                                    data-column="${index}" style="cursor: pointer; user-select: none;">
                                                    ${this.escapeHtml(header)}
                                                    <i class="bi bi-arrow-down-up sort-icon ms-1 text-muted small"></i>
                                                </th>
                                            `).join('')}
                                        </tr>
                                    </thead>
                                    <tbody class="table-body">
                                        ${this.renderTableRows(rows)}
                                    </tbody>
                                </table>
                            </div>
                            
                            <!-- Table Info -->
                            <div class="table-info mt-2">
                                <small class="text-muted">
                                    <span class="row-count">${rows.length}</span> rows
                                    <span class="filtered-info" style="display: none;">
                                        (filtered from <span class="total-rows">${rows.length}</span> total)
                                    </span>
                                </small>
                            </div>
                        </div>
                    `;

                    this.setupEventListeners();
                }

                renderTableRows(rows) {
                    return rows.map(row => `
                        <tr>
                            ${row.map(cell => `<td>${this.escapeHtml(String(cell))}</td>`).join('')}
                        </tr>
                    `).join('');
                }

                setupEventListeners() {
                    // Filter functionality
                    const filterInput = this.querySelector('.filter-input');
                    const clearFilterBtn = this.querySelector('.clear-filter-btn');
                    
                    if (filterInput) {
                        filterInput.addEventListener('input', (e) => {
                            this.filterText = e.target.value.toLowerCase();
                            this.applyFilter();
                        });
                    }

                    if (clearFilterBtn) {
                        clearFilterBtn.addEventListener('click', () => {
                            filterInput.value = '';
                            this.filterText = '';
                            this.applyFilter();
                        });
                    }

                    // Sort functionality
                    const sortHeaders = this.querySelectorAll('.sortable-header');
                    sortHeaders.forEach(header => {
                        header.addEventListener('click', () => {
                            const column = parseInt(header.dataset.column);
                            this.sortTable(column);
                        });
                    });

                    // Excel export functionality
                    const exportBtn = this.querySelector('.export-excel-btn');
                    if (exportBtn) {
                        exportBtn.addEventListener('click', () => this.exportToExcel());
                    }
                }

                applyFilter() {
                    const filteredRows = this.originalRows.filter(row => {
                        if (!this.filterText) return true;
                        return row.some(cell => 
                            String(cell).toLowerCase().includes(this.filterText)
                        );
                    });

                    const tbody = this.querySelector('.table-body');
                    if (tbody) {
                        tbody.innerHTML = this.renderTableRows(filteredRows);
                    }

                    this.updateRowCountInfo(filteredRows.length);
                }

                sortTable(column) {
                    if (this.sortColumn === column) {
                        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                    } else {
                        this.sortColumn = column;
                        this.sortDirection = 'asc';
                    }

                    this.updateSortIcons(column);

                    const tbody = this.querySelector('.table-body');
                    const currentRows = Array.from(tbody.querySelectorAll('tr'));
                    const rowsData = currentRows.map(tr => 
                        Array.from(tr.querySelectorAll('td')).map(td => td.textContent)
                    );

                    const sortedRows = rowsData.sort((a, b) => {
                        const aVal = a[column];
                        const bVal = b[column];
                        
                        const aNum = parseFloat(aVal.replace(/[$,]/g, ''));
                        const bNum = parseFloat(bVal.replace(/[$,]/g, ''));
                        
                        if (!isNaN(aNum) && !isNaN(bNum)) {
                            return this.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
                        }
                        
                        const result = aVal.localeCompare(bVal, undefined, { numeric: true });
                        return this.sortDirection === 'asc' ? result : -result;
                    });

                    tbody.innerHTML = this.renderTableRows(sortedRows);
                }

                updateSortIcons(activeColumn) {
                    const headers = this.querySelectorAll('.sortable-header');
                    headers.forEach((header, index) => {
                        const icon = header.querySelector('.sort-icon');
                        if (index === activeColumn) {
                            icon.className = `bi sort-icon ms-1 small ${this.sortDirection === 'asc' ? 'bi-sort-up text-primary' : 'bi-sort-down text-primary'}`;
                        } else {
                            icon.className = 'bi bi-arrow-down-up sort-icon ms-1 text-muted small';
                        }
                    });
                }

                updateRowCountInfo(filteredCount) {
                    const rowCountSpan = this.querySelector('.row-count');
                    const filteredInfo = this.querySelector('.filtered-info');
                    const totalRows = this.querySelector('.total-rows');

                    if (rowCountSpan) rowCountSpan.textContent = filteredCount;
                    if (totalRows) totalRows.textContent = this.originalRows.length;

                    if (filteredInfo) {
                        filteredInfo.style.display = filteredCount < this.originalRows.length ? 'inline' : 'none';
                    }
                }

                exportToExcel() {
                    const { title = 'Table Data', headers = [] } = this.messageData;
                    
                    const tbody = this.querySelector('.table-body');
                    const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => 
                        Array.from(tr.querySelectorAll('td')).map(td => td.textContent)
                    );

                    const csvContent = [
                        headers.join(','),
                        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                    ].join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    
                    if (link.download !== undefined) {
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        const btn = this.querySelector('.export-excel-btn');
                        if (btn) {
                            const originalHtml = btn.innerHTML;
                            btn.innerHTML = '<i class="bi bi-check-circle text-success"></i> Exported';
                            btn.disabled = true;
                            setTimeout(() => {
                                btn.innerHTML = originalHtml;
                                btn.disabled = false;
                            }, 2000);
                        }
                    }
                }
            }
            customElements.define('chitchat-table-message', ChitChatTableMessage);
        }

        // Quick Reply Message Component
        if (!customElements.get('chitchat-quick-reply-message')) {
            class ChitChatQuickReplyMessage extends customElements.get('chitchat-base-message') {
                render() {
                    const { content = '', replies = [] } = this.messageData;
                    
                    const contentHtml = content ? `<p class="mb-3">${this.escapeHtml(content)}</p>` : '';
                    const repliesHtml = replies.map(reply => 
                        `<button class="btn btn-outline-primary btn-sm quick-reply-btn me-2 mb-2" 
                                 data-reply="${this.escapeHtml(reply)}">
                            ${this.escapeHtml(reply)}
                        </button>`
                    ).join('');
                    
                    this.innerHTML = `
                        <div class="quick-reply-container">
                            ${contentHtml}
                            <div class="quick-replies">
                                ${repliesHtml}
                            </div>
                        </div>
                    `;

                    this.querySelectorAll('.quick-reply-btn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const reply = e.target.dataset.reply;
                            this.dispatchEvent(new CustomEvent('quick-reply-selected', {
                                detail: { reply },
                                bubbles: true
                            }));
                        });
                    });
                }
            }
            customElements.define('chitchat-quick-reply-message', ChitChatQuickReplyMessage);
        }

        // Image Message Component
        if (!customElements.get('chitchat-image-message')) {
            class ChitChatImageMessage extends customElements.get('chitchat-base-message') {
                render() {
                    const { url = '', caption = '', alt = 'Message image' } = this.messageData;
                    
                    const captionHtml = caption ? 
                        `<div class="image-caption mt-2">
                            <small class="text-muted">${this.escapeHtml(caption)}</small>
                        </div>` : '';
                    
                    this.innerHTML = `
                        <div class="image-message-container">
                            <img src="${this.escapeHtml(url)}" 
                                 alt="${this.escapeHtml(alt)}" 
                                 class="img-fluid rounded message-image"
                                 style="max-width: 100%; height: auto; cursor: pointer;"
                                 loading="lazy">
                            ${captionHtml}
                        </div>
                    `;

                    const img = this.querySelector('.message-image');
                    if (img) {
                        img.addEventListener('click', () => {
                            this.showImageModal(url, caption || alt);
                        });
                    }
                }

                showImageModal(url, caption) {
                    const modalId = `imageModal-${Date.now()}`;
                    const modalHtml = `
                        <div class="modal fade" id="${modalId}" tabindex="-1">
                            <div class="modal-dialog modal-lg modal-dialog-centered">
                                <div class="modal-content">
                                    <div class="modal-header">
                                        <h5 class="modal-title">${this.escapeHtml(caption)}</h5>
                                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                    </div>
                                    <div class="modal-body text-center">
                                        <img src="${this.escapeHtml(url)}" class="img-fluid" alt="${this.escapeHtml(caption)}">
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;

                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    const modal = new bootstrap.Modal(document.getElementById(modalId));
                    
                    document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
                        document.getElementById(modalId).remove();
                    });
                    
                    modal.show();
                }
            }
            customElements.define('chitchat-image-message', ChitChatImageMessage);
        }

        // Chart Message Component
        if (!customElements.get('chitchat-chart-message')) {
            class ChitChatChartMessage extends customElements.get('chitchat-base-message') {
                constructor() {
                    super();
                    this.chartInstance = null;
                    this.chartType = 'pie'; // Default chart type
                    this.chartData = null;
                    this.chartOptions = {};
                }

                static get observedAttributes() {
                    return ['data-chart-type', 'data-chart-data', 'data-chart-options', 'data-title'];
                }

                attributeChangedCallback(name, oldValue, newValue) {
                    if (oldValue !== newValue) {
                        switch (name) {
                            case 'data-chart-type':
                                this.chartType = newValue || 'pie';
                                break;
                            case 'data-chart-data':
                                try {
                                    this.chartData = JSON.parse(newValue);
                                } catch (e) {
                                    console.error('Invalid chart data JSON:', e);
                                    this.chartData = null;
                                }
                                break;
                            case 'data-chart-options':
                                try {
                                    this.chartOptions = JSON.parse(newValue);
                                } catch (e) {
                                    console.error('Invalid chart options JSON:', e);
                                    this.chartOptions = {};
                                }
                                break;
                            case 'data-title':
                                this.updateTitle(newValue);
                                break;
                        }
                        if (name.startsWith('data-chart-')) {
                            this.renderChart();
                        }
                    }
                }

                connectedCallback() {
                    super.connectedCallback();
                    // Extract chart data from messageData after base component processes it
                    if (this.messageData) {
                        this.chartType = this.messageData.chartType || 'pie';
                        this.chartData = this.messageData.chartData || null;
                        this.chartOptions = this.messageData.chartOptions || {};
                    }
                    
                    this.render();
                    
                    // Wait for Chart.js to be available
                    if (typeof Chart === 'undefined') {
                        this.showLoading();
                        this.waitForChart();
                    } else {
                        this.renderChart();
                    }
                }

                disconnectedCallback() {
                    if (this.chartInstance) {
                        this.chartInstance.destroy();
                        this.chartInstance = null;
                    }
                }

                async waitForChart() {
                    let attempts = 0;
                    const maxAttempts = 50; // 5 seconds max wait

                    const checkChart = () => {
                        if (typeof Chart !== 'undefined') {
                            this.renderChart();
                            return;
                        }

                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(checkChart, 100);
                        } else {
                            this.showError('Chart.js library not available');
                        }
                    };

                    checkChart();
                }

                render() {
                    const title = this.messageData?.title || 'Chart';
                    
                    this.innerHTML = `
                        <div class="chart-message-wrapper">
                            <div class="chart-message-header">
                                <h6 class="chart-message-title">
                                    <i class="bi bi-bar-chart"></i>
                                    ${this.escapeHtml(title)}
                                </h6>
                            </div>
                            <div class="chart-container">
                                <canvas class="chart-canvas" width="400" height="300"></canvas>
                            </div>
                        </div>
                    `;
                }

                showLoading() {
                    const container = this.querySelector('.chart-container');
                    if (container) {
                        container.innerHTML = `
                            <div class="chart-loading">
                                <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
                                Loading chart...
                            </div>
                        `;
                    }
                }

                showError(message) {
                    const container = this.querySelector('.chart-container');
                    if (container) {
                        container.innerHTML = `
                            <div class="chart-error">
                                <i class="bi bi-exclamation-triangle me-2"></i>
                                ${message}
                            </div>
                        `;
                    }
                }

                updateTitle(title) {
                    const titleElement = this.querySelector('.chart-message-title');
                    if (titleElement) {
                        titleElement.innerHTML = `
                            <i class="bi bi-bar-chart"></i>
                            ${title}
                        `;
                    }
                }

                renderChart() {
                    if (!this.chartData || typeof Chart === 'undefined') {
                        return;
                    }

                    const canvas = this.querySelector('.chart-canvas');
                    if (!canvas) {
                        return;
                    }

                    // Destroy existing chart if present
                    if (this.chartInstance) {
                        this.chartInstance.destroy();
                    }

                    const ctx = canvas.getContext('2d');
                    
                    // Default professional styling based on chart type
                    const defaultOptions = this.getDefaultOptions(this.chartType);
                    const mergedOptions = this.mergeOptions(defaultOptions, this.chartOptions);

                    try {
                        this.chartInstance = new Chart(ctx, {
                            type: this.chartType,
                            data: this.chartData,
                            options: mergedOptions
                        });
                    } catch (error) {
                        console.error('Error creating chart:', error);
                        this.showError('Failed to create chart');
                    }
                }

                getDefaultOptions(type) {
                    const commonOptions = {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 20,
                                    usePointStyle: true,
                                    font: {
                                        size: 12,
                                        family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                                    }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: '#3b82f6',
                                borderWidth: 1,
                                cornerRadius: 8,
                                padding: 12,
                                titleFont: {
                                    size: 14,
                                    weight: '600'
                                },
                                bodyFont: {
                                    size: 13
                                }
                            }
                        }
                    };

                    switch (type) {
                        case 'pie':
                        case 'doughnut':
                            return {
                                ...commonOptions,
                                plugins: {
                                    ...commonOptions.plugins,
                                    legend: {
                                        ...commonOptions.plugins.legend,
                                        position: 'right'
                                    }
                                }
                            };

                        case 'bar':
                        case 'line':
                            return {
                                ...commonOptions,
                                scales: {
                                    x: {
                                        grid: {
                                            color: '#e5e7eb',
                                            lineWidth: 1
                                        },
                                        ticks: {
                                            color: '#6b7280',
                                            font: {
                                                size: 11
                                            }
                                        }
                                    },
                                    y: {
                                        grid: {
                                            color: '#e5e7eb',
                                            lineWidth: 1
                                        },
                                        ticks: {
                                            color: '#6b7280',
                                            font: {
                                                size: 11
                                            }
                                        }
                                    }
                                }
                            };

                        default:
                            return commonOptions;
                    }
                }

                mergeOptions(defaults, custom) {
                    // Deep merge options objects
                    const merge = (target, source) => {
                        for (const key in source) {
                            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                                target[key] = target[key] || {};
                                merge(target[key], source[key]);
                            } else {
                                target[key] = source[key];
                            }
                        }
                        return target;
                    };

                    return merge(JSON.parse(JSON.stringify(defaults)), custom);
                }

                // Helper method to set chart data programmatically
                setChartData(data, type = null, options = null) {
                    this.chartData = data;
                    if (type) this.chartType = type;
                    if (options) this.chartOptions = options;
                    this.renderChart();
                }

                // Helper method to update chart with animation
                updateChart(data) {
                    if (this.chartInstance && data) {
                        this.chartInstance.data = data;
                        this.chartInstance.update('active');
                    }
                }
            }
            customElements.define('chitchat-chart-message', ChitChatChartMessage);
        }

        this.otlc.debug('Message components defined', { 
            components: ['chitchat-text-message', 'chitchat-table-message', 'chitchat-quick-reply-message', 'chitchat-image-message', 'chitchat-chart-message'] 
        });
    }

    // Lightweight observability initialization
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

            /* Resize Handle - Top-left corner positioning */
            .chitchat-resize-handle {
                position: absolute;
                top: 0;
                left: 0;
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
                border-radius: 16px 0 0 0;
                opacity: 0.8;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }

            .chitchat-resize-handle:hover {
                opacity: 1;
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            /* Larger resize handle for laptops */
            @media (min-width: 769px) {
                .chitchat-resize-handle {
                    width: 24px;
                    height: 24px;
                    font-size: 12px;
                    opacity: 0.85;
                }
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

            /* Desktop/Laptop screens (769px and above) */
            @media (min-width: 769px) {
                .chitchat-container {
                    min-width: 450px;
                    min-height: 550px;
                    /* No max constraints - let users resize as they want */
                }

                .message-bubble {
                    max-width: 70%;
                }

                .chitchat-header {
                    padding: 18px 24px;
                }

                .chitchat-messages {
                    padding: 20px;
                }

                .chitchat-input {
                    padding: 16px 24px;
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
            
            // Ensure DOM is ready
            const messagesContainer = this.querySelector('.messages-container');
            if (!messagesContainer) {
                this.otlc.warn('Messages container not found, queuing message', { type: messageData.type });
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

            this.renderMessage(message);
            
            if (this.options.autoScroll) {
                this.scrollToBottom();
            }

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
