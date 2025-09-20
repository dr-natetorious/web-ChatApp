/**
 * JSON-RPC 2.0 handlers extracted from existing ChitChat functionality
 * These handlers wrap the existing ChitChat methods for command dispatch
 */

import { toolMetadata, withToolMetadata, createToolMetadata } from './tool-metadata.js';

/**
 * Render a data table
 * @description Display a data table with headers and rows
 * @param {Object} params - Table parameters
 * @param {string} params.title - Title for the table
 * @param {Array<string>} params.headers - Array of column headers  
 * @param {Array<Array<string>>} params.rows - Array of rows, each row is an array of cell values
 * @param {Object} context - ChitChat component instance
 */
const renderTable = withToolMetadata(toolMetadata.render_table)(
    function(params, context) {
        if (!context || typeof context.addTable !== 'function') {
            console.warn('render_table: Invalid context or missing addTable method');
            return;
        }
        
        const { title, headers, rows } = params;
        if (!headers || !rows) {
            console.warn('render_table: Missing required parameters (headers, rows)');
            return;
        }
        
        context.addTable(title, headers, rows);
    }
);

/**
 * Render a chart
 * @description Display a chart (bar, line, pie, etc.) with data visualization
 * @param {Object} params - Chart parameters
 * @param {string} params.title - Title for the chart
 * @param {string} params.chartType - Type of chart to render
 * @param {Object} params.chartData - Chart.js compatible data object
 * @param {Object} params.chartOptions - Optional Chart.js options
 * @param {Object} context - ChitChat component instance
 */
const renderChart = withToolMetadata(toolMetadata.render_chart)(
    function(params, context) {
        if (!context || typeof context.addChart !== 'function') {
            console.warn('render_chart: Invalid context or missing addChart method');
            return;
        }
        
        const { title, chartType, chartData, chartOptions = {} } = params;
        if (!chartType || !chartData) {
            console.warn('render_chart: Missing required parameters (chartType, chartData)');
            return;
        }
        
        context.addChart(title, chartType, chartData, chartOptions);
    }
);

/**
 * Display an image
 * @description Display an image with optional caption
 * @param {Object} params - Image parameters
 * @param {string} params.url - URL of the image to display
 * @param {string} params.caption - Optional caption for the image
 * @param {Object} context - ChitChat component instance
 */
const renderImage = withToolMetadata(toolMetadata.render_image)(
    function(params, context) {
        if (!context || typeof context.addImage !== 'function') {
            console.warn('render_image: Invalid context or missing addImage method');
            return;
        }
        
        const { url, caption = '' } = params;
        if (!url) {
            console.warn('render_image: Missing required parameter (url)');
            return;
        }
        
        context.addImage(url, caption);
    }
);

/**
 * Show quick reply buttons
 * @description Display quick reply buttons for user interaction
 * @param {Object} params - Quick reply parameters
 * @param {string} params.content - Message content to display above buttons
 * @param {Array<string>} params.replies - Array of quick reply button texts
 * @param {Object} context - ChitChat component instance
 */
const showQuickReplies = withToolMetadata(toolMetadata.show_quick_replies)(
    function(params, context) {
        if (!context || typeof context.addQuickReply !== 'function') {
            console.warn('show_quick_replies: Invalid context or missing addQuickReply method');
            return;
        }
        
        const { content, replies } = params;
        if (!content || !replies || !Array.isArray(replies)) {
            console.warn('show_quick_replies: Missing or invalid parameters (content, replies array)');
            return;
        }
        
        context.addQuickReply(content, replies);
    }
);

/**
 * Collection of default handlers based on existing ChitChat methods
 */
export const defaultHandlers = {
    render_table: renderTable,
    render_chart: renderChart,
    render_image: renderImage,
    show_quick_replies: showQuickReplies,

    // Legacy handlers (without metadata decorators)
    add_message: (params, context) => {
        if (!context || typeof context.addMessage !== 'function') {
            console.warn('add_message: Invalid context or missing addMessage method');
            return;
        }
        
        const { content, sender = 'support' } = params;
        if (!content) {
            console.warn('add_message: Missing required parameter (content)');
            return;
        }
        
        context.addMessage({
            type: 'text',
            content,
            sender
        });
    },

    show_typing: (params, context) => {
        if (!context || typeof context.showTypingIndicator !== 'function') {
            console.warn('show_typing: Invalid context or missing showTypingIndicator method');
            return;
        }
        
        context.showTypingIndicator();
    },

    hide_typing: (params, context) => {
        if (!context || typeof context.hideTypingIndicator !== 'function') {
            console.warn('hide_typing: Invalid context or missing hideTypingIndicator method');
            return;
        }
        
        context.hideTypingIndicator();
    },

    scroll_to_bottom: (params, context) => {
        if (!context || typeof context.scrollToBottom !== 'function') {
            console.warn('scroll_to_bottom: Invalid context or missing scrollToBottom method');
            return;
        }
        
        context.scrollToBottom();
    }
};

/**
 * Utility function to register all default handlers with an OpenAI client
 * @param {OpenAIClient} client - OpenAI client instance
 */
export function registerDefaultHandlers(client) {
    Object.entries(defaultHandlers).forEach(([method, handler]) => {
        // The handler already has metadata attached if decorated
        client.registerHandler(method, handler);
    });
}

/**
 * Example JSON-RPC 2.0 command formats for documentation
 */
export const exampleCommands = {
    table: {
        jsonrpc: '2.0',
        method: 'render_table',
        params: {
            title: 'Sample Data',
            headers: ['Name', 'Value', 'Status'],
            rows: [
                ['Item 1', '100', 'Active'],
                ['Item 2', '200', 'Pending']
            ]
        }
    },
    
    chart: {
        jsonrpc: '2.0',
        method: 'render_chart',
        params: {
            title: 'Monthly Sales',
            chartType: 'bar',
            chartData: {
                labels: ['Jan', 'Feb', 'Mar'],
                datasets: [{
                    label: 'Sales',
                    data: [100, 150, 200],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)'
                }]
            }
        }
    },
    
    image: {
        jsonrpc: '2.0',
        method: 'render_image',
        params: {
            url: 'https://example.com/image.jpg',
            caption: 'Sample image'
        }
    },
    
    quickReplies: {
        jsonrpc: '2.0',
        method: 'show_quick_replies',
        params: {
            content: 'How can I help you?',
            replies: ['Account Balance', 'Transfer Money', 'Contact Support']
        }
    }
};
