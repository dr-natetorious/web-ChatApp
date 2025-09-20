/**
 * ChitChat Messages - Web Component-based Message System
 * Professional message types with modern features
 * Built with vanilla JavaScript and Bootstrap 5.3
 */

// Base Message Web Component
class ChitChatBaseMessage extends HTMLElement {
    constructor() {
        super();
        this.messageData = {};
    }

    static get observedAttributes() {
        return ['data-message'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data-message' && newValue) {
            try {
                this.messageData = JSON.parse(newValue);
                this.render();
            } catch (error) {
                console.error('[ChitChat Messages] Failed to parse message data:', error);
            }
        }
    }

    connectedCallback() {
        if (this.hasAttribute('data-message')) {
            this.attributeChangedCallback('data-message', null, this.getAttribute('data-message'));
        }
    }

    render() {
        // Override in subclasses
        this.innerHTML = '<div class="message-content">Base message component</div>';
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Text Message Component
class ChitChatTextMessage extends ChitChatBaseMessage {
    render() {
        const content = this.messageData.content || '';
        this.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
    }
}

// Quick Reply Message Component
class ChitChatQuickReplyMessage extends ChitChatBaseMessage {
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

// Image Message Component
class ChitChatImageMessage extends ChitChatBaseMessage {
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
        img.addEventListener('click', () => {
            this.showImageModal(url, caption || alt);
        });
    }

    showImageModal(url, caption) {
        // Create modal overlay
        const modalHtml = `
            <div class="modal fade" id="imageModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Image Preview</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body text-center">
                            <img src="${this.escapeHtml(url)}" class="img-fluid" alt="${this.escapeHtml(caption)}">
                            ${caption ? `<p class="mt-3 text-muted">${this.escapeHtml(caption)}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('imageModal'));
        modal.show();

        // Clean up when modal is hidden
        document.getElementById('imageModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
}

// Enhanced Table Message Component with Professional Features
class ChitChatTableMessage extends ChitChatBaseMessage {
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
        
        filterInput.addEventListener('input', (e) => {
            this.filterText = e.target.value.toLowerCase();
            this.applyFilter();
        });

        clearFilterBtn.addEventListener('click', () => {
            filterInput.value = '';
            this.filterText = '';
            this.applyFilter();
        });

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
        exportBtn.addEventListener('click', () => this.exportToExcel());
    }

    applyFilter() {
        const filteredRows = this.originalRows.filter(row => {
            if (!this.filterText) return true;
            return row.some(cell => 
                String(cell).toLowerCase().includes(this.filterText)
            );
        });

        // Update table body
        const tbody = this.querySelector('.table-body');
        tbody.innerHTML = this.renderTableRows(filteredRows);

        // Update row count info
        this.updateRowCountInfo(filteredRows.length);
    }

    sortTable(column) {
        // Update sort state
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Update sort icons
        this.updateSortIcons(column);

        // Get current filtered rows
        const tbody = this.querySelector('.table-body');
        const currentRows = Array.from(tbody.querySelectorAll('tr'));
        const rowsData = currentRows.map(tr => 
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent)
        );

        // Sort the data
        const sortedRows = rowsData.sort((a, b) => {
            const aVal = a[column];
            const bVal = b[column];
            
            // Try numeric comparison first
            const aNum = parseFloat(aVal.replace(/[$,]/g, ''));
            const bNum = parseFloat(bVal.replace(/[$,]/g, ''));
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return this.sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
            }
            
            // Fall back to string comparison
            const result = aVal.localeCompare(bVal, undefined, { numeric: true });
            return this.sortDirection === 'asc' ? result : -result;
        });

        // Update table body
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

        rowCountSpan.textContent = filteredCount;
        totalRows.textContent = this.originalRows.length;
        filteredInfo.style.display = filteredCount < this.originalRows.length ? 'inline' : 'none';
    }

    exportToExcel() {
        const { title = 'Table Data', headers = [] } = this.messageData;
        
        // Get currently displayed (filtered/sorted) data
        const tbody = this.querySelector('.table-body');
        const rows = Array.from(tbody.querySelectorAll('tr')).map(tr => 
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent)
        );

        // Create CSV content
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Chart Message Component with Chart.js Integration
class ChitChatChartMessage extends ChitChatBaseMessage {
    constructor() {
        super();
        this.chartInstance = null;
    }

    render() {
        const { title = '', chartType = 'pie', chartData = {}, chartOptions = {} } = this.messageData;
        
        // Destroy existing chart if it exists
        this.destroyChart();
        
        const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const titleHtml = title ? `<h6 class="chart-title mb-3">${this.escapeHtml(title)}</h6>` : '';
        
        this.innerHTML = `
            <div class="chart-message-container">
                ${titleHtml}
                <div class="chart-wrapper">
                    <canvas id="${chartId}" style="max-height: 400px;"></canvas>
                </div>
            </div>
        `;

        // Create chart immediately
        const canvas = this.querySelector(`#${chartId}`);
        const ctx = canvas.getContext('2d');
        
        this.chartInstance = new Chart(ctx, {
            type: chartType,
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                ...chartOptions
            }
        });
    }

    destroyChart() {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }

    disconnectedCallback() {
        this.destroyChart();
    }
}

// User Message Component
class UserMessage extends HTMLElement {
    constructor() {
        super();
        this.messageData = {};
    }

    static get observedAttributes() {
        return ['data-message'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data-message' && newValue) {
            try {
                this.messageData = JSON.parse(newValue);
                this.render();
            } catch (error) {
                console.error('[UserMessage] Failed to parse message data:', error);
            }
        }
    }

    connectedCallback() {
        if (this.hasAttribute('data-message')) {
            this.attributeChangedCallback('data-message', null, this.getAttribute('data-message'));
        }
    }

    render() {
        const { content = '', timestamp = null } = this.messageData;
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '';

        this.innerHTML = `
            <div class="message-wrapper user-message">
                <div class="message-content">
                    <div class="text-content">${this.escapeHtml(content)}</div>
                </div>
                ${timeStr ? `<div class="message-time">${timeStr}</div>` : ''}
            </div>
        `;
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Assistant Message Component with Tool Support
class AssistantMessage extends HTMLElement {
    constructor() {
        super();
        this.messageData = {};
        this.toolInvocations = new Map(); // Track active tool invocations
    }

    static get observedAttributes() {
        return ['data-message'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'data-message' && newValue) {
            try {
                this.messageData = JSON.parse(newValue);
                this.render();
            } catch (error) {
                console.error('[AssistantMessage] Failed to parse message data:', error);
            }
        }
    }

    connectedCallback() {
        if (this.hasAttribute('data-message')) {
            this.attributeChangedCallback('data-message', null, this.getAttribute('data-message'));
        }
    }

    render() {
        const { content = '', timestamp = null } = this.messageData;
        const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '';

        this.innerHTML = `
            <div class="message-wrapper assistant-message">
                <div class="message-content">
                    <div class="text-content">${this.escapeHtml(content)}</div>
                    <div class="tool-invocations-container"></div>
                </div>
                ${timeStr ? `<div class="message-time">${timeStr}</div>` : ''}
            </div>
        `;
    }

    // Add tool invocation as child element
    addToolInvocation(toolName, toolId = null) {
        const container = this.querySelector('.tool-invocations-container');
        const toolElement = document.createElement('chitchat-tool-invocation');
        
        const id = toolId || `tool-${Date.now()}-${Math.random()}`;
        toolElement.setAttribute('tool-name', toolName);
        toolElement.setAttribute('tool-id', id);
        toolElement.setAttribute('status', 'processing');
        
        container.appendChild(toolElement);
        this.toolInvocations.set(id, toolElement);
        
        console.log('[AssistantMessage] Added tool invocation:', toolName, id);
        return { element: toolElement, id };
    }

    // Update tool invocation status and result
    updateToolInvocation(toolId, status, resultElement = null) {
        const toolElement = this.toolInvocations.get(toolId);
        if (toolElement) {
            toolElement.setStatus(status);
            if (resultElement) {
                toolElement.setResult(resultElement);
            }
            console.log('[AssistantMessage] Updated tool invocation:', toolId, status);
        } else {
            console.warn('[AssistantMessage] Tool invocation not found:', toolId);
        }
    }

    // Update the main text content of the message
    updateContent(newContent) {
        const textElement = this.querySelector('.text-content');
        if (textElement) {
            textElement.innerHTML = this.escapeHtml(newContent);
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Tool Invocation Component (Simplified for nesting)
class ChitChatToolInvocation extends HTMLElement {
    constructor() {
        super();
        this.status = 'processing';
        this.toolName = '';
        this.toolId = '';
    }

    static get observedAttributes() {
        return ['tool-name', 'status', 'tool-id'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'tool-name' && newValue) {
            this.toolName = newValue;
            this.updateHeader();
        } else if (name === 'status' && newValue) {
            this.status = newValue;
            this.updateStatus();
        } else if (name === 'tool-id' && newValue) {
            this.toolId = newValue;
        }
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const toolName = this.toolName || this.getAttribute('tool-name') || 'Unknown Tool';
        const status = this.status || this.getAttribute('status') || 'processing';

        this.innerHTML = `
            <div class="tool-invocation ${status}">
                <div class="tool-header">
                    <span class="tool-icon">${this.getStatusIcon(status)}</span>
                    <span class="tool-title">Tool: ${this.escapeHtml(toolName)}</span>
                    <span class="tool-status-text">${status}</span>
                </div>
                <div class="tool-result">
                    <!-- Tool execution result goes here -->
                </div>
            </div>
        `;

        // Add CSS if not already added
        this.addToolInvocationStyles();
    }

    getStatusIcon(status) {
        const icons = {
            processing: '<i class="fas fa-spinner fa-spin text-primary"></i>',
            complete: '<i class="fas fa-check-circle text-success"></i>',
            success: '<i class="fas fa-check-circle text-success"></i>',
            error: '<i class="fas fa-exclamation-circle text-danger"></i>'
        };
        return icons[status] || icons.processing;
    }

    updateStatus() {
        const iconElement = this.querySelector('.tool-icon');
        const statusElement = this.querySelector('.tool-status-text');
        const containerElement = this.querySelector('.tool-invocation');
        
        if (iconElement) {
            iconElement.innerHTML = this.getStatusIcon(this.status);
        }
        if (statusElement) {
            statusElement.textContent = this.status;
        }
        if (containerElement) {
            containerElement.className = `tool-invocation ${this.status}`;
        }
    }

    updateHeader() {
        const titleElement = this.querySelector('.tool-title');
        if (titleElement) {
            titleElement.innerHTML = `Tool: ${this.escapeHtml(this.toolName)}`;
        }
    }

    setStatus(newStatus) {
        this.status = newStatus;
        this.setAttribute('status', newStatus);
    }

    setResult(resultElement) {
        const resultContainer = this.querySelector('.tool-result');
        if (resultContainer) {
            resultContainer.innerHTML = '';
            if (typeof resultElement === 'string') {
                resultContainer.innerHTML = resultElement;
            } else {
                resultContainer.appendChild(resultElement);
            }
            this.setStatus('complete');
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    addToolInvocationStyles() {
        // Check if styles are already added
        if (document.querySelector('#tool-invocation-styles')) return;

        const style = document.createElement('style');
        style.id = 'tool-invocation-styles';
        style.textContent = `
            .tool-invocation {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border: 1px solid #dee2e6;
                border-radius: 8px;
                padding: 8px 12px;
                margin: 8px 0;
                font-size: 0.9rem;
            }

            .tool-invocation.processing {
                border-left: 4px solid #007bff;
            }

            .tool-invocation.complete,
            .tool-invocation.success {
                border-left: 4px solid #28a745;
            }

            .tool-invocation.error {
                border-left: 4px solid #dc3545;
            }

            .tool-header {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #495057;
                font-weight: 500;
            }

            .tool-icon {
                width: 16px;
                text-align: center;
            }

            .tool-title {
                flex: 1;
                font-family: 'Courier New', monospace;
                color: #007bff;
            }

            .tool-status-text {
                font-size: 0.8rem;
                color: #6c757d;
                text-transform: capitalize;
            }

            .tool-result {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid #dee2e6;
                display: none;
            }

            .tool-invocation.complete .tool-result,
            .tool-invocation.success .tool-result {
                display: block;
            }

            .tool-result-summary {
                color: #28a745;
                font-weight: 500;
            }

            .tool-result-error {
                color: #dc3545;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
    }
}

// Register all message components
customElements.define('chitchat-base-message', ChitChatBaseMessage);
customElements.define('chitchat-text-message', ChitChatTextMessage);
customElements.define('chitchat-table-message', ChitChatTableMessage);
customElements.define('chitchat-quick-reply-message', ChitChatQuickReplyMessage);
customElements.define('chitchat-image-message', ChitChatImageMessage);
customElements.define('chitchat-chart-message', ChitChatChartMessage);
customElements.define('chitchat-tool-invocation', ChitChatToolInvocation);
customElements.define('user-message', UserMessage);
customElements.define('assistant-message', AssistantMessage);

console.log('[ChitChat Messages] All message components registered successfully');
