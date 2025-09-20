/**
 * OpenAI-compatible client with JSON-RPC 2.0 command dispatch
 * Supports both streaming and non-streaming chat completions
 */
class OpenAIClient {
    constructor(baseUrl = '/v1', apiKey = null, toolsRegistry = null) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.apiKey = apiKey;
        this.toolsRegistry = toolsRegistry;
        this.dispatchTable = new Map();
        
        if (this.toolsRegistry) {
            this.setupHandlersFromRegistry();
        } else {
            this.setupDefaultHandlers();
        }
    }

    /**
     * Setup handlers from the provided tools registry
     */
    setupHandlersFromRegistry() {
        if (!this.toolsRegistry) return;
        
        const handlers = this.toolsRegistry.getHandlers();
        for (const [name, handler] of handlers) {
            this.dispatchTable.set(name, {
                handler,
                metadata: this.toolsRegistry.getToolMetadataByName(name)
            });
        }
    }

    /**
     * Update tools from registry (called when tools are added/removed)
     * @param {ChatToolsRegistry} registry - Updated registry
     */
    updateToolsFromRegistry(registry) {
        this.toolsRegistry = registry;
        this.dispatchTable.clear();
        this.setupHandlersFromRegistry();
    }

    /**
     * Register a command handler for JSON-RPC 2.0 dispatch
     * @param {string} method - The RPC method name
     * @param {Function} handler - Handler function (params, context) => void
     * @param {Object} metadata - Optional tool metadata for OpenAI function calling
     */
    registerHandler(method, handler, metadata = null) {
        this.dispatchTable.set(method, {
            handler,
            metadata: metadata || this.inferToolMetadata(method, handler)
        });
    }

    /**
     * Infer tool metadata from handler function and method name
     * @param {string} method - The method name
     * @param {Function} handler - The handler function
     * @returns {Object|null} Inferred tool metadata
     */
    inferToolMetadata(method, handler) {
        // Check if handler has metadata attached
        if (handler.toolMetadata) {
            return handler.toolMetadata;
        }

        // Check function comments/JSDoc for metadata
        const functionString = handler.toString();
        const jsdocMatch = functionString.match(/\/\*\*([\s\S]*?)\*\//);
        
        if (jsdocMatch) {
            try {
                return this.parseJSDocMetadata(method, jsdocMatch[1]);
            } catch (e) {
                console.warn(`Failed to parse JSDoc for ${method}:`, e);
            }
        }

        // Try to infer from parameter names
        const paramMatch = functionString.match(/function\s*\([^)]*\)|(?:async\s+)?(?:\w+\s*=>|\([^)]*\)\s*=>)/);
        if (paramMatch) {
            return this.inferFromParameters(method, handler);
        }

        return null;
    }

    /**
     * Parse JSDoc comments for tool metadata
     * @param {string} method - Method name
     * @param {string} jsdoc - JSDoc content
     * @returns {Object} Parsed metadata
     */
    parseJSDocMetadata(method, jsdoc) {
        const description = jsdoc.match(/@description\s+(.+)/)?.[1]?.trim() ||
                          jsdoc.split('\n')[0].replace(/\*\s*/, '').trim();
        
        const params = {};
        const required = [];
        
        const paramMatches = jsdoc.matchAll(/@param\s+\{([^}]+)\}\s+(\w+)(?:\s*-\s*(.+))?/g);
        for (const match of paramMatches) {
            const [, type, name, desc] = match;
            params[name] = {
                type: this.mapJSDocType(type),
                description: desc?.trim() || `${name} parameter`
            };
            
            if (!type.includes('?') && !desc?.includes('optional')) {
                required.push(name);
            }
        }
        
        return {
            type: "function",
            function: {
                name: method,
                description: description || `Execute ${method} command`,
                parameters: {
                    type: "object",
                    properties: params,
                    ...(required.length > 0 && { required })
                }
            }
        };
    }

    /**
     * Map JSDoc types to JSON Schema types
     * @param {string} jsdocType - JSDoc type annotation
     * @returns {string} JSON Schema type
     */
    mapJSDocType(jsdocType) {
        const typeMap = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'array': 'array',
            'object': 'object',
            'Array': 'array',
            'Object': 'object',
            'String': 'string',
            'Number': 'number',
            'Boolean': 'boolean'
        };
        
        const cleanType = jsdocType.replace(/[?|]/g, '').trim();
        return typeMap[cleanType] || 'string';
    }

    /**
     * Infer basic metadata from function parameters
     * @param {string} method - Method name  
     * @param {Function} handler - Handler function
     * @returns {Object} Basic inferred metadata
     */
    inferFromParameters(method, handler) {
        const params = this.getFunctionParameters(handler);
        const properties = {};
        
        params.forEach(param => {
            if (param !== 'context') {
                properties[param] = {
                    type: 'string',
                    description: `${param} parameter for ${method}`
                };
            }
        });
        
        return {
            type: "function",
            function: {
                name: method,
                description: `Execute ${method} command`,
                parameters: {
                    type: "object",
                    properties,
                    required: Object.keys(properties)
                }
            }
        };
    }

    /**
     * Extract parameter names from function
     * @param {Function} func - Function to analyze
     * @returns {Array<string>} Parameter names
     */
    getFunctionParameters(func) {
        const funcStr = func.toString();
        const match = funcStr.match(/(?:function\s*)?(?:\w+\s*)?\(([^)]*)\)/);
        if (!match) return [];
        
        return match[1]
            .split(',')
            .map(param => param.trim().split('=')[0].trim())
            .filter(param => param && param !== 'context');
    }

    /**
     * Setup default handlers based on existing ChitChat functionality
     */
    setupDefaultHandlers() {
        // Only register handlers that already exist in ChitChat
        this.registerHandler('render_table', this.handleRenderTable.bind(this));
        this.registerHandler('render_chart', this.handleRenderChart.bind(this));
        this.registerHandler('render_image', this.handleRenderImage.bind(this));
        this.registerHandler('show_quick_replies', this.handleQuickReplies.bind(this));
    }

    /**
     * Generate OpenAI tools array from registered handlers
     * @returns {Array} OpenAI-compatible tools array
     */
    generateTools() {
        console.log('[OpenAIClient] generateTools called');
        console.log('[OpenAIClient] toolsRegistry:', this.toolsRegistry);
        
        // If we have a tools registry, use it
        if (this.toolsRegistry) {
            const metadata = this.toolsRegistry.getToolMetadata();
            console.log('[OpenAIClient] Registry metadata:', metadata);
            return metadata || [];
        }
        
        // Fallback: generate tools from registered handlers with metadata
        const tools = [];
        for (const [method, handlerData] of this.dispatchTable) {
            if (handlerData.metadata) {
                tools.push(handlerData.metadata);
            } else {
                // Fallback: create basic tool definition
                tools.push({
                    type: "function",
                    function: {
                        name: method,
                        description: `Execute ${method} command`,
                        parameters: {
                            type: "object",
                            properties: {},
                            required: []
                        }
                    }
                });
            }
        }
        
        console.log('[OpenAIClient] Generated tools:', tools);
        return tools;
    }

    /**
     * Non-streaming chat completion
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Request options
     * @returns {Promise<Object>} OpenAI-compatible response
     */
    async chatCompletion(messages, options = {}) {
        const tools = this.generateTools();
        
        const requestBody = {
            messages: messages,
            model: options.model || 'llama',
            max_tokens: options.max_tokens || 1000,
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 1.0,
            stream: false,
            ...(tools.length > 0 && { tools }),
            ...options
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Streaming chat completion with SSE
     * @param {Array} messages - Array of message objects  
     * @param {Object} options - Request options
     * @param {Function} onToken - Callback for each token (token, isComplete) => void
     * @param {Function} onCommand - Callback for JSON-RPC commands (command) => void
     * @returns {Promise<void>}
     */
    async streamChatCompletion(messages, options = {}, onToken = null, onCommand = null) {
        console.log('[OpenAIClient] streamChatCompletion called');
        console.log('[OpenAIClient] baseUrl:', this.baseUrl);
        console.log('[OpenAIClient] messages:', messages);
        console.log('[OpenAIClient] options:', options);
        
        const tools = this.generateTools() || [];
        console.log('[OpenAIClient] Generated tools:', tools);
        console.log('[OpenAIClient] Tools length:', tools.length);
        
        const requestBody = {
            messages: messages,
            model: options.model || 'llama',
            max_tokens: options.max_tokens || 1000,
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 1.0,
            stream: true,
            ...options
        };
        
        // Always include tools if we have any, even if empty array for debugging
        if (tools.length > 0) {
            requestBody.tools = tools;
            console.log('[OpenAIClient] Adding tools to request:', tools);
        } else {
            console.log('[OpenAIClient] No tools to add - tools array is empty');
        }

        const url = `${this.baseUrl}/chat/completions`;
        console.log('[OpenAIClient] Making request to:', url);
        console.log('[OpenAIClient] Request body:', requestBody);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            },
            body: JSON.stringify(requestBody)
        });

        console.log('[OpenAIClient] Response status:', response.status);
        console.log('[OpenAIClient] Response headers:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[OpenAIClient] API error response:', errorText);
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        console.log('[OpenAIClient] Starting to read streaming response...');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let toolBuffer = ''; // Buffer for detecting TOOL_START/TOOL_END patterns

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[OpenAIClient] Stream reading complete');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        console.log('[OpenAIClient] Received SSE data:', data);
                        
                        if (data === '[DONE]') {
                            console.log('[OpenAIClient] Stream completed with [DONE]');
                            if (onToken) onToken('', true);
                            // Commands are already processed in real-time during streaming
                            return fullContent;
                        }

                        try {
                            const chunk = JSON.parse(data);
                            const choice = chunk.choices?.[0];
                            
                            // Handle text content
                            const content = choice?.delta?.content || '';
                            if (content) {
                                fullContent += content;
                                toolBuffer += content; // Add to tool buffer for real-time detection
                                
                                // Check for complete TOOL_START/TOOL_END blocks in real-time
                                toolBuffer = this.processToolBuffer(toolBuffer, onCommand);
                                
                                if (onToken) onToken(content, false);
                            }
                            
                            // Handle function calls
                            const toolCalls = choice?.delta?.tool_calls;
                            if (toolCalls && onCommand) {
                                for (const toolCall of toolCalls) {
                                    if (toolCall.function) {
                                        try {
                                            const functionCall = {
                                                jsonrpc: '2.0',
                                                method: toolCall.function.name,
                                                params: JSON.parse(toolCall.function.arguments || '{}')
                                            };
                                            onCommand(functionCall);
                                            // Removed this.dispatchCommand(functionCall) to prevent duplication
                                        } catch (e) {
                                            console.warn('Failed to parse function call:', toolCall, e);
                                        }
                                    }
                                }
                            }
                            
                        } catch (e) {
                            console.warn('Failed to parse SSE chunk:', data, e);
                        }
                    }
                }
            }

            // Note: Commands are already processed in real-time during streaming,
            // so no need to process them again here to avoid duplication

            return fullContent;

        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Process tool buffer for real-time TOOL_START/TOOL_END detection
     * @param {string} buffer - Current tool buffer content
     * @param {Function} onCommand - Command callback
     * @returns {string} Updated buffer with processed tools removed
     */
    processToolBuffer(buffer, onCommand) {
        const toolPattern = /TOOL_START\s*([\s\S]*?)\s*TOOL_END/g;
        let match;
        let lastIndex = 0;
        let newBuffer = buffer;

        while ((match = toolPattern.exec(buffer)) !== null) {
            const toolData = this.parseFlexibleJson(match[1].trim());
            if (toolData && toolData.name && toolData.arguments) {
                const command = {
                    jsonrpc: '2.0',
                    method: toolData.name,
                    params: toolData.arguments
                };
                console.log('[OpenAIClient] Found TOOL block in real-time:', command);
                onCommand(command);
                // Removed this.dispatchCommand(command) to prevent duplication
                
                // Remove processed tool from buffer
                newBuffer = newBuffer.replace(match[0], '');
            } else {
                console.warn('Failed to parse real-time TOOL block or missing required fields:', match[1]);
            }
        }

        return newBuffer;
    }

    /**
     * Parse JSON-like content that might contain JavaScript object literal syntax
     * @param {string} content - Content to parse
     * @returns {Object|null} Parsed object or null if parsing fails
     */
    parseFlexibleJson(content) {
        // First try standard JSON parsing
        try {
            return JSON.parse(content);
        } catch (e) {
            // If that fails, try to fix common JavaScript object literal issues
            try {
                // Replace unquoted property names with quoted ones
                let fixed = content
                    // Replace unquoted property names (word: ) with quoted ones ("word": )
                    .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
                    // Replace single quotes with double quotes
                    .replace(/'/g, '"')
                    // Fix trailing commas (remove them)
                    .replace(/,(\s*[}\]])/g, '$1');
                
                return JSON.parse(fixed);
            } catch (e2) {
                // If all else fails, try to evaluate as JavaScript (dangerous but controlled)
                try {
                    // Only allow if it looks like a safe object literal
                    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
                        // Use Function constructor to safely evaluate
                        return new Function('return ' + content)();
                    }
                } catch (e3) {
                    console.warn('All JSON parsing attempts failed:', e, e2, e3);
                }
            }
        }
        return null;
    }

    /**
     * Process JSON-RPC 2.0 commands and TOOL_START/TOOL_END blocks embedded in response text
     * @param {string} content - Full response content
     * @param {Function} onCommand - Command callback
     */
    processCommands(content, onCommand) {
        // Look for TOOL_START/TOOL_END blocks first
        const toolPattern = /TOOL_START\s*([\s\S]*?)\s*TOOL_END/g;
        let match;

        while ((match = toolPattern.exec(content)) !== null) {
            const toolData = this.parseFlexibleJson(match[1].trim());
            if (toolData && toolData.name && toolData.arguments) {
                const command = {
                    jsonrpc: '2.0',
                    method: toolData.name,
                    params: toolData.arguments
                };
                console.log('[OpenAIClient] Found TOOL block:', command);
                onCommand(command);
                // Removed this.dispatchCommand(command) to prevent duplication
            } else {
                console.warn('Failed to parse TOOL block or missing required fields:', match[1]);
            }
        }
        
        // Look for JSON-RPC blocks in the content
        const jsonRpcPattern = /```json-rpc\s*([\s\S]*?)\s*```/g;

        while ((match = jsonRpcPattern.exec(content)) !== null) {
            try {
                const command = JSON.parse(match[1]);
                if (this.isValidJsonRpc(command)) {
                    console.log('[OpenAIClient] Found JSON-RPC block:', command);
                    onCommand(command);
                    // Removed this.dispatchCommand(command) to prevent duplication
                }
            } catch (e) {
                console.warn('Failed to parse JSON-RPC command:', match[1], e);
            }
        }
    }

    /**
     * Validate JSON-RPC 2.0 format
     * @param {Object} command - Command object to validate
     * @returns {boolean}
     */
    isValidJsonRpc(command) {
        return command && 
               command.jsonrpc === '2.0' && 
               typeof command.method === 'string' &&
               command.params !== undefined;
    }

    /**
     * Dispatch a JSON-RPC command to registered handlers
     * @param {Object} command - JSON-RPC 2.0 command
     * @param {Object} context - Optional context object
     */
    dispatchCommand(command, context = null) {
        const handlerData = this.dispatchTable.get(command.method);
        if (handlerData) {
            try {
                const handler = handlerData.handler || handlerData; // Support both old and new format
                if (typeof handler === 'function') {
                    handler(command.params, context);
                } else if (handler.handler && typeof handler.handler === 'function') {
                    handler.handler(command.params, context);
                }
            } catch (error) {
                console.error(`Error executing command ${command.method}:`, error);
            }
        } else {
            console.warn(`No handler registered for method: ${command.method}`);
        }
    }

    // === DEFAULT COMMAND HANDLERS ===
    // These map to existing ChitChat methods

    handleRenderTable(params, context) {
        if (context && typeof context.addTable === 'function') {
            context.addTable(params.title, params.headers, params.rows);
        }
    }

    handleRenderChart(params, context) {
        if (context && typeof context.addChart === 'function') {
            context.addChart(params.title, params.chartType, params.chartData, params.chartOptions);
        }
    }

    handleRenderImage(params, context) {
        if (context && typeof context.addImage === 'function') {
            context.addImage(params.url, params.caption);
        }
    }

    handleQuickReplies(params, context) {
        if (context && typeof context.addQuickReply === 'function') {
            context.addQuickReply(params.content, params.replies);
        }
    }

    /**
     * Get available models
     * @returns {Promise<Object>} Models list
     */
    async getModels() {
        const response = await fetch(`${this.baseUrl}/models`, {
            headers: {
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
            }
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Health check
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const response = await fetch(`${this.baseUrl}/health`);
        if (!response.ok) {
            throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
}

// Make it available globally
window.OpenAIClient = OpenAIClient;
