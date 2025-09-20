/**
 * Tool metadata definitions for OpenAI function calling
 * This file contains the schemas for available functions
 */

export const toolMetadata = {
    render_table: {
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
    },
    
    render_chart: {
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
    },
    
    render_image: {
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
    },
    
    show_quick_replies: {
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
};

/**
 * Utility function to create tool metadata with JSDoc-style annotations
 * @param {string} name - Function name
 * @param {string} description - Function description
 * @param {Object} properties - Parameter properties
 * @param {Array<string>} required - Required parameter names
 * @returns {Object} OpenAI tool metadata
 */
export function createToolMetadata(name, description, properties, required = []) {
    return {
        type: "function",
        function: {
            name,
            description,
            parameters: {
                type: "object",
                properties,
                ...(required.length > 0 && { required })
            }
        }
    };
}

/**
 * Decorator function to attach metadata to handler functions
 * @param {Object} metadata - Tool metadata
 * @returns {Function} Decorator function
 */
export function withToolMetadata(metadata) {
    return function(target) {
        target.toolMetadata = metadata;
        return target;
    };
}

/**
 * JSDoc-style parameter helper
 * @param {string} type - Parameter type
 * @param {string} description - Parameter description
 * @param {boolean} required - Whether parameter is required
 * @returns {Object} Parameter definition
 */
export function param(type, description, required = true) {
    return { type, description, required };
}
