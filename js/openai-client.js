/**
 * OpenAI-compatible HTTP client for chat completions
 * Focuses on HTTP communication and tools schema for API requests
 */
class OpenAIClient {
    constructor(baseUrl = '/v1', apiKey = null, toolsRegistry = null) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        this.apiKey = apiKey;
        this.toolsRegistry = toolsRegistry;
        this.policyHeaders = {}; // Store policy headers for requests
    }

    /**
     * Update tools registry reference
     * @param {ChatToolsRegistry} registry - Tools registry instance
     */
    updateToolsFromRegistry(registry) {
        this.toolsRegistry = registry;
    }

    /**
     * Set policy headers for requests
     * @param {Object} headers - Policy headers to include in requests
     */
    setPolicyHeaders(headers) {
        this.policyHeaders = headers || {};
        console.log('[OpenAIClient] Policy headers updated:', this.policyHeaders);
    }

    /**
     * Get tools schema for OpenAI API request
     * @returns {Array} OpenAI-compatible tools array
     */
    getToolsSchema() {
        return this.toolsRegistry ? this.toolsRegistry.getToolMetadata() : [];
    }

    /**
     * Non-streaming chat completion
     * @param {Array} messages - Array of message objects
     * @param {Object} options - Request options
     * @returns {Promise<Object>} OpenAI-compatible response
     */
    async chatCompletion(messages, options = {}) {
        const tools = this.getToolsSchema();
        
        const requestBody = {
            model: options.model || 'gpt-3.5-turbo',
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 1000,
            stream: false,
            ...options
        };

        if (tools.length > 0) {
            requestBody.tools = tools;
            console.log('[OpenAIClient] Adding tools to request:', tools);
        }

        const headers = {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            ...this.policyHeaders
        };

        console.log('[OpenAIClient] Request headers:', headers);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Streaming chat completion with real-time command detection
     * @param {Array} messages - Array of message objects  
     * @param {Object} options - Request options
     * @param {Function} onToken - Token callback (token, isComplete) => void
     * @param {Function} onCommand - Command callback (command) => void
     * @returns {Promise<string>} Complete response text
     */
    async streamChatCompletion(messages, options = {}, onToken = null, onCommand = null) {
        const tools = this.getToolsSchema();
        
        const requestBody = {
            model: options.model || 'gpt-3.5-turbo',
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.max_tokens || 1000,
            stream: true,
            ...options
        };

        if (tools.length > 0) {
            requestBody.tools = tools;
            console.log('[OpenAIClient] Adding tools to request:', tools);
        }

        const headers = {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            ...this.policyHeaders
        };

        console.log('[OpenAIClient] Streaming request headers:', headers);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
            let fullContent = '';
            let toolBuffer = ''; // Buffer for detecting TOOL_START/TOOL_END patterns

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

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
        if (!this.toolsRegistry || !onCommand) {
            return buffer;
        }
        
        // Use the registry's command parsing capabilities
        const commands = this.toolsRegistry.parseCommands(buffer);
        
        let newBuffer = buffer;
        for (const command of commands) {
            console.log('[OpenAIClient] Found command in real-time:', command);
            onCommand(command);
            
            // Remove the processed TOOL block from buffer
            const toolPattern = /TOOL_START\s*([\s\S]*?)\s*TOOL_END/;
            const match = newBuffer.match(toolPattern);
            if (match) {
                newBuffer = newBuffer.replace(match[0], '');
            }
        }

        return newBuffer;
    }

    /**
     * Get available models
     * @returns {Promise<Object>} Models list
     */
    async getModels() {
        const response = await fetch(`${this.baseUrl}/models`, {
            headers: {
                ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
                ...this.policyHeaders
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
