/**
 * Unified Chat Tools Registry
 * Single source for message components, handlers, and tool metadata
 */
export class ChatToolsRegistry {
    constructor() {
        this.tools = new Map();
        this.registerBuiltInTools();
        console.log('[ChatToolsRegistry] Initialized with tools:', Array.from(this.tools.keys()));
    }
    
    /**
     * Register a complete tool with component, handler, and metadata
     * @param {string} name - Tool name
     * @param {Object} definition - Tool definition
     * @param {Function} definition.handler - Function to execute
     * @param {Object} definition.metadata - OpenAI tool schema
     * @param {Function} [definition.component] - Web component class (optional)
     */
    registerTool(name, definition) {
        this.tools.set(name, {
            handler: definition.handler,
            metadata: definition.metadata,
            component: definition.component || null,
            ...definition
        });
    }
    
    /**
     * Register built-in tools that work with existing ChitChat methods
     */
    registerBuiltInTools() {
        this.registerTool('render_table', {
            handler: (params, context) => {
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
            },
            metadata: {
                type: "function",
                function: {
                    name: "render_table",
                    description: "Display a data table with headers and rows",
                    parameters: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "Title for the table"
                            },
                            headers: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of column headers"
                            },
                            rows: {
                                type: "array",
                                items: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                description: "Array of rows, each row is an array of cell values"
                            }
                        },
                        required: ["headers", "rows"]
                    }
                }
            }
        });
        
        this.registerTool('render_chart', {
            handler: (params, context) => {
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
            },
            metadata: {
                type: "function",
                function: {
                    name: "render_chart",
                    description: "Display a chart (bar, line, pie, etc.) with data visualization",
                    parameters: {
                        type: "object",
                        properties: {
                            title: {
                                type: "string",
                                description: "Title for the chart"
                            },
                            chartType: {
                                type: "string",
                                enum: ["bar", "line", "pie", "doughnut", "radar", "scatter"],
                                description: "Type of chart to render"
                            },
                            chartData: {
                                type: "object",
                                description: "Chart.js compatible data object with labels and datasets",
                                properties: {
                                    labels: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "Array of labels for the chart"
                                    },
                                    datasets: {
                                        type: "array",
                                        description: "Array of dataset objects"
                                    }
                                },
                                required: ["labels", "datasets"]
                            },
                            chartOptions: {
                                type: "object",
                                description: "Optional Chart.js options object for customization"
                            }
                        },
                        required: ["chartType", "chartData"]
                    }
                }
            }
        });
        
        this.registerTool('render_image', {
            handler: (params, context) => {
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
            },
            metadata: {
                type: "function",
                function: {
                    name: "render_image",
                    description: "Display an image with optional caption",
                    parameters: {
                        type: "object",
                        properties: {
                            url: {
                                type: "string",
                                description: "URL of the image to display"
                            },
                            caption: {
                                type: "string",
                                description: "Optional caption for the image"
                            }
                        },
                        required: ["url"]
                    }
                }
            }
        });
        
        this.registerTool('show_quick_replies', {
            handler: (params, context) => {
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
            },
            metadata: {
                type: "function",
                function: {
                    name: "show_quick_replies",
                    description: "Display quick reply buttons for user interaction",
                    parameters: {
                        type: "object",
                        properties: {
                            content: {
                                type: "string",
                                description: "Message content to display above the quick reply buttons"
                            },
                            replies: {
                                type: "array",
                                items: { type: "string" },
                                description: "Array of quick reply button texts"
                            }
                        },
                        required: ["content", "replies"]
                    }
                }
            }
        });
        
        // Utility tools without OpenAI metadata (internal use only)
        this.registerTool('add_message', {
            handler: (params, context) => {
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
            }
        });
        
        this.registerTool('show_typing', {
            handler: (params, context) => {
                if (!context || typeof context.showTypingIndicator !== 'function') {
                    console.warn('show_typing: Invalid context or missing showTypingIndicator method');
                    return;
                }
                context.showTypingIndicator();
            }
        });
        
        this.registerTool('hide_typing', {
            handler: (params, context) => {
                if (!context || typeof context.hideTypingIndicator !== 'function') {
                    console.warn('hide_typing: Invalid context or missing hideTypingIndicator method');
                    return;
                }
                context.hideTypingIndicator();
            }
        });
    }
    
    /**
     * Get handler function for a tool
     * @param {string} name - Tool name
     * @returns {Function|null} Handler function
     */
    getHandler(name) {
        return this.tools.get(name)?.handler || null;
    }
    
    /**
     * Get all handlers as a Map
     * @returns {Map<string, Function>} Map of tool names to handlers
     */
    getHandlers() {
        const handlers = new Map();
        for (const [name, tool] of this.tools) {
            if (tool.handler) {
                handlers.set(name, tool.handler);
            }
        }
        return handlers;
    }
    
    /**
     * Get OpenAI tool metadata for all tools that have it
     * @returns {Array<Object>} Array of OpenAI tool definitions
     */
    getToolMetadata() {
        console.log('[ChatToolsRegistry] getToolMetadata called, tools count:', this.tools.size);
        console.log('[ChatToolsRegistry] Tools map:', this.tools);
        
        const metadata = [];
        for (const [name, tool] of this.tools.entries()) {
            console.log(`[ChatToolsRegistry] Checking tool "${name}":`, tool);
            console.log(`[ChatToolsRegistry] Tool "${name}" has metadata:`, !!tool.metadata);
            if (tool.metadata) {
                metadata.push(tool.metadata);
            }
        }
        console.log('[ChatToolsRegistry] Returning metadata:', metadata);
        return metadata;
    }
    
    /**
     * Get tool metadata for a specific tool
     * @param {string} name - Tool name
     * @returns {Object|null} Tool metadata
     */
    getToolMetadataByName(name) {
        return this.tools.get(name)?.metadata || null;
    }
    
    /**
     * Check if a tool is registered
     * @param {string} name - Tool name
     * @returns {boolean} True if tool exists
     */
    hasTool(name) {
        return this.tools.has(name);
    }
    
    /**
     * Get all registered tool names
     * @returns {Array<string>} Array of tool names
     */
    getToolNames() {
        return Array.from(this.tools.keys());
    }
    
    /**
     * Remove a tool
     * @param {string} name - Tool name
     * @returns {boolean} True if tool was removed
     */
    removeTool(name) {
        return this.tools.delete(name);
    }
}
