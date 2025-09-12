/**
 * OTLC - Open Telemetry Lite Client
 * Micro observability framework for web applications
 * Provides 80% of OpenTelemetry value with 20% of the complexity
 */

class OTLC {
    constructor(config = {}) {
        this.config = {
            serviceName: config.serviceName || 'web-app',
            version: config.version || '1.0.0',
            environment: config.environment || 'development',
            endpoint: config.endpoint || null,
            enableConsole: config.enableConsole !== false,
            enableMetrics: config.enableMetrics !== false,
            enableTraces: config.enableTraces !== false,
            enableLogs: config.enableLogs !== false,
            sampleRate: config.sampleRate || 1.0,
            ...config
        };

        this.traces = [];
        this.metrics = new Map();
        this.logs = [];
        this.activeSpans = new Map();
        this.sessionId = this.generateId();
        this.startTime = Date.now();

        this.init();
    }

    init() {
        // Auto-capture page load metrics
        if (typeof window !== 'undefined') {
            this.capturePageLoadMetrics();
            this.captureUnhandledErrors();
        }

        this.log('info', 'OTLC initialized', {
            serviceName: this.config.serviceName,
            sessionId: this.sessionId,
            environment: this.config.environment
        });
    }

    // === TRACING ===
    
    startSpan(name, attributes = {}) {
        if (!this.config.enableTraces || Math.random() > this.config.sampleRate) {
            return new NoOpSpan();
        }

        const span = {
            traceId: this.generateId(),
            spanId: this.generateId(),
            name,
            startTime: Date.now(),
            attributes: {
                'service.name': this.config.serviceName,
                'service.version': this.config.version,
                'session.id': this.sessionId,
                ...attributes
            },
            events: [],
            status: 'ok'
        };

        this.activeSpans.set(span.spanId, span);
        
        if (this.config.enableConsole) {
            console.group(`🔍 [TRACE] ${name}`);
            console.log('Span started:', span.spanId);
            console.log('Attributes:', span.attributes);
        }

        return new Span(span, this);
    }

    finishSpan(span) {
        if (span.spanId) {
            span.endTime = Date.now();
            span.duration = span.endTime - span.startTime;
            
            this.traces.push(span);
            this.activeSpans.delete(span.spanId);

            if (this.config.enableConsole) {
                console.log(`⏱️ Duration: ${span.duration}ms`);
                console.log(`✅ Status: ${span.status}`);
                console.groupEnd();
            }

            this.exportTrace(span);
        }
    }

    // === METRICS ===

    counter(name, value = 1, labels = {}) {
        if (!this.config.enableMetrics) return;

        const key = this.getMetricKey(name, labels);
        const existing = this.metrics.get(key) || { type: 'counter', value: 0, labels, name };
        existing.value += value;
        existing.lastUpdated = Date.now();
        this.metrics.set(key, existing);

        if (this.config.enableConsole) {
            console.log(`📊 [COUNTER] ${name}: ${existing.value}`, labels);
        }
    }

    gauge(name, value, labels = {}) {
        if (!this.config.enableMetrics) return;

        const key = this.getMetricKey(name, labels);
        const metric = { type: 'gauge', value, labels, name, lastUpdated: Date.now() };
        this.metrics.set(key, metric);

        if (this.config.enableConsole) {
            console.log(`📈 [GAUGE] ${name}: ${value}`, labels);
        }
    }

    histogram(name, value, labels = {}) {
        if (!this.config.enableMetrics) return;

        const key = this.getMetricKey(name, labels);
        const existing = this.metrics.get(key) || { 
            type: 'histogram', 
            values: [], 
            count: 0, 
            sum: 0, 
            labels, 
            name 
        };
        
        existing.values.push(value);
        existing.count++;
        existing.sum += value;
        existing.lastUpdated = Date.now();
        
        // Keep only last 100 values for memory efficiency
        if (existing.values.length > 100) {
            existing.values.shift();
        }

        this.metrics.set(key, existing);

        if (this.config.enableConsole) {
            console.log(`📊 [HISTOGRAM] ${name}: ${value} (avg: ${(existing.sum / existing.count).toFixed(2)})`, labels);
        }
    }

    // === LOGGING ===

    log(level, message, attributes = {}) {
        if (!this.config.enableLogs) return;

        const logEntry = {
            timestamp: Date.now(),
            level,
            message,
            attributes: {
                'service.name': this.config.serviceName,
                'session.id': this.sessionId,
                ...attributes
            }
        };

        this.logs.push(logEntry);

        // Keep only last 1000 logs
        if (this.logs.length > 1000) {
            this.logs.shift();
        }

        if (this.config.enableConsole) {
            const emoji = this.getLogEmoji(level);
            console.log(`${emoji} [${level.toUpperCase()}] ${message}`, attributes);
        }

        this.exportLog(logEntry);
    }

    // Convenience methods
    info(message, attributes) { this.log('info', message, attributes); }
    warn(message, attributes) { this.log('warn', message, attributes); }
    error(message, attributes) { this.log('error', message, attributes); }
    debug(message, attributes) { this.log('debug', message, attributes); }

    // === UTILITIES ===

    generateId() {
        return Math.random().toString(36).substr(2, 16);
    }

    getMetricKey(name, labels) {
        const sortedLabels = Object.keys(labels).sort().map(k => `${k}=${labels[k]}`).join(',');
        return `${name}{${sortedLabels}}`;
    }

    getLogEmoji(level) {
        const emojis = {
            debug: '🐛',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
            fatal: '💀'
        };
        return emojis[level] || 'ℹ️';
    }

    // === AUTO-CAPTURE ===

    capturePageLoadMetrics() {
        if (typeof window === 'undefined') return;

        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0];
            if (navigation) {
                this.histogram('page.load_time', navigation.loadEventEnd - navigation.fetchStart, {
                    page: window.location.pathname
                });
                this.histogram('page.dom_ready', navigation.domContentLoadedEventEnd - navigation.fetchStart, {
                    page: window.location.pathname
                });
            }
        });
    }

    captureUnhandledErrors() {
        if (typeof window === 'undefined') return;

        window.addEventListener('error', (event) => {
            this.error('Unhandled JavaScript error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
            this.counter('errors.unhandled');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled promise rejection', {
                reason: event.reason?.toString(),
                stack: event.reason?.stack
            });
            this.counter('errors.unhandled_promise');
        });
    }

    // === EXPORT ===

    exportTrace(trace) {
        if (this.config.endpoint) {
            // Send to external endpoint
            this.sendToEndpoint('traces', [trace]);
        }
    }

    exportLog(log) {
        if (this.config.endpoint) {
            this.sendToEndpoint('logs', [log]);
        }
    }

    exportMetrics() {
        if (this.config.endpoint && this.metrics.size > 0) {
            const metricsArray = Array.from(this.metrics.values());
            this.sendToEndpoint('metrics', metricsArray);
        }
    }

    sendToEndpoint(type, data) {
        if (!this.config.endpoint) return;

        fetch(`${this.config.endpoint}/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service: this.config.serviceName,
                version: this.config.version,
                environment: this.config.environment,
                sessionId: this.sessionId,
                timestamp: Date.now(),
                data
            })
        }).catch(err => {
            console.warn('Failed to export to endpoint:', err.message);
        });
    }

    // === DEBUGGING & INSPECTION ===

    getStats() {
        const activeSpansCount = this.activeSpans.size;
        const completedTraces = this.traces.length;
        const metricsCount = this.metrics.size;
        const logsCount = this.logs.length;
        const uptime = Date.now() - this.startTime;

        return {
            service: this.config.serviceName,
            sessionId: this.sessionId,
            uptime,
            activeSpansCount,
            completedTraces,
            metricsCount,
            logsCount,
            config: this.config
        };
    }

    inspect() {
        console.group('🔍 OTLC Inspection');
        console.log('Stats:', this.getStats());
        console.log('Active Spans:', Array.from(this.activeSpans.values()));
        console.log('Recent Traces:', this.traces.slice(-5));
        console.log('Metrics:', Array.from(this.metrics.values()));
        console.log('Recent Logs:', this.logs.slice(-10));
        console.groupEnd();
    }

    // Start periodic metric export
    startPeriodicExport(intervalMs = 60000) {
        if (this.exportInterval) {
            clearInterval(this.exportInterval);
        }

        this.exportInterval = setInterval(() => {
            this.exportMetrics();
        }, intervalMs);
    }

    shutdown() {
        if (this.exportInterval) {
            clearInterval(this.exportInterval);
        }
        this.exportMetrics(); // Final export
        this.log('info', 'OTLC shutdown');
    }
}

// Span implementation
class Span {
    constructor(spanData, otlc) {
        Object.assign(this, spanData);
        this.otlc = otlc;
    }

    setAttributes(attributes) {
        Object.assign(this.attributes, attributes);
        return this;
    }

    setAttribute(key, value) {
        this.attributes[key] = value;
        return this;
    }

    addEvent(name, attributes = {}) {
        this.events.push({
            name,
            timestamp: Date.now(),
            attributes
        });
        return this;
    }

    setStatus(status, message = '') {
        this.status = status;
        if (message) {
            this.statusMessage = message;
        }
        return this;
    }

    end() {
        this.otlc.finishSpan(this);
    }
}

// No-op span for when tracing is disabled
class NoOpSpan {
    setAttributes() { return this; }
    setAttribute() { return this; }
    addEvent() { return this; }
    setStatus() { return this; }
    end() { return this; }
}

// Factory function for easy initialization
function createOTLC(config = {}) {
    return new OTLC(config);
}

// Auto-detect environment and create default instance
const defaultConfig = {
    serviceName: 'web-chatapp',
    version: '1.0.0',
    environment: typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'development' : 'production',
    enableConsole: typeof window !== 'undefined' && window.location.hostname === 'localhost'
};

// Export default instance and factory
window.otlc = createOTLC(defaultConfig);

// Also export the class for custom instances
window.OTLC = OTLC;
window.createOTLC = createOTLC;

// Start periodic export in production
if (defaultConfig.environment === 'production') {
    window.otlc.startPeriodicExport();
}

// Development helpers
if (defaultConfig.environment === 'development') {
    // Add keyboard shortcut for inspection (Ctrl+Shift+O)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'O') {
            e.preventDefault();
            window.otlc.inspect();
        }
    });

    // Create a simple debug panel
    function createDebugPanel() {
        if (document.getElementById('otlc-debug-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'otlc-debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            max-height: 400px;
            background: rgba(0,0,0,0.9);
            color: white;
            border-radius: 8px;
            padding: 16px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
        `;

        const stats = window.otlc.getStats();
        panel.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 12px;">
                <strong>🔍 OTLC Debug Panel</strong>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">×</button>
            </div>
            <div><strong>Service:</strong> ${stats.service}</div>
            <div><strong>Session:</strong> ${stats.sessionId.substr(0, 8)}...</div>
            <div><strong>Uptime:</strong> ${Math.round(stats.uptime / 1000)}s</div>
            <div><strong>Traces:</strong> ${stats.completedTraces}</div>
            <div><strong>Active Spans:</strong> ${stats.activeSpansCount}</div>
            <div><strong>Metrics:</strong> ${stats.metricsCount}</div>
            <div><strong>Logs:</strong> ${stats.logsCount}</div>
            <hr style="border-color: #333; margin: 12px 0;">
            <button onclick="window.otlc.inspect()" style="width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 8px;">Full Inspection</button>
            <button onclick="console.clear()" style="width: 100%; padding: 8px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear Console</button>
        `;

        document.body.appendChild(panel);

        // Auto-refresh every 5 seconds
        const interval = setInterval(() => {
            if (!document.getElementById('otlc-debug-panel')) {
                clearInterval(interval);
                return;
            }
            const newStats = window.otlc.getStats();
            const elements = panel.querySelectorAll('div');
            if (elements[2]) elements[2].innerHTML = `<strong>Uptime:</strong> ${Math.round(newStats.uptime / 1000)}s`;
            if (elements[3]) elements[3].innerHTML = `<strong>Traces:</strong> ${newStats.completedTraces}`;
            if (elements[4]) elements[4].innerHTML = `<strong>Active Spans:</strong> ${newStats.activeSpansCount}`;
            if (elements[5]) elements[5].innerHTML = `<strong>Metrics:</strong> ${newStats.metricsCount}`;
            if (elements[6]) elements[6].innerHTML = `<strong>Logs:</strong> ${newStats.logsCount}`;
        }, 5000);
    }

    // Add keyboard shortcut for debug panel (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            createDebugPanel();
        }
    });

    // Expose debug panel creation globally
    window.showOTLCDebug = createDebugPanel;
}

console.log('🔍 OTLC (Open Telemetry Lite Client) loaded');
console.log('Development mode shortcuts:');
console.log('  Ctrl+Shift+O: Full inspection');
console.log('  Ctrl+Shift+D: Show debug panel');
