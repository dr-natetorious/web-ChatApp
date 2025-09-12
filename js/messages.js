/**
 * ChitChat Messages - Web Component-based Message System
 * Extensible message implementations using Web Components
 * Built with vanilla JavaScript and Bootstrap 5.3
 */

// Base Message Web Component
class BaseMessageComponent extends HTMLElement {
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
                console.error('Failed to parse message data:', error);
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
class TextMessageComponent extends BaseMessageComponent {
    render() {
        const content = this.messageData.content || '';
        this.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
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

// Enhanced Table Message Component with Professional Features
class TableMessageComponent extends BaseMessageComponent {
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

        // Update table body
        const tbody = this.querySelector('.table-body');
        if (tbody) {
            tbody.innerHTML = this.renderTableRows(filteredRows);
        }

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

        if (rowCountSpan) rowCountSpan.textContent = filteredCount;
        if (totalRows) totalRows.textContent = this.originalRows.length;

        if (filteredInfo) {
            filteredInfo.style.display = filteredCount < this.originalRows.length ? 'inline' : 'none';
        }
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
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success feedback
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

// Quick Reply Message Component
class QuickReplyMessageComponent extends BaseMessageComponent {
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

        // Add click handlers
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
class ImageMessageComponent extends BaseMessageComponent {
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

        // Add click handler for image preview
        const img = this.querySelector('.message-image');
        if (img) {
            img.addEventListener('click', () => {
                this.showImageModal(url, caption || alt);
            });
        }
    }

    showImageModal(url, caption) {
        // Create Bootstrap modal for image preview
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
        
        // Clean up modal after it's hidden
        document.getElementById(modalId).addEventListener('hidden.bs.modal', () => {
            document.getElementById(modalId).remove();
        });
        
        modal.show();
    }
}

// Register Web Components with proper error handling
const componentsToRegister = [
    { name: 'text-message', class: TextMessageComponent },
    { name: 'table-message', class: TableMessageComponent },
    { name: 'quick-reply-message', class: QuickReplyMessageComponent },
    { name: 'image-message', class: ImageMessageComponent }
];

componentsToRegister.forEach(({ name, class: ComponentClass }) => {
    try {
        if (!customElements.get(name)) {
            customElements.define(name, ComponentClass);
            console.log(`[ChitChat Messages] Successfully registered ${name} component`);
        } else {
            console.log(`[ChitChat Messages] Component ${name} already registered`);
        }
    } catch (error) {
        console.error(`[ChitChat Messages] Failed to register ${name}:`, error);
    }
});

// Verify all components are registered
setTimeout(() => {
    const registered = componentsToRegister.map(({ name }) => ({
        name,
        registered: !!customElements.get(name)
    }));
    
    console.log('[ChitChat Messages] Registration verification:', registered);
    
    if (registered.every(c => c.registered)) {
        console.log('[ChitChat Messages] All components successfully registered and verified');
    } else {
        console.error('[ChitChat Messages] Some components failed to register:', 
            registered.filter(c => !c.registered).map(c => c.name));
    }
}, 100);

// Export for use in main chat component
window.ChitChatMessageComponents = {
    TextMessageComponent,
    TableMessageComponent,
    QuickReplyMessageComponent,
    ImageMessageComponent,
    BaseMessageComponent
};
