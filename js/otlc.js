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
            traceId: this.generateTraceId(),
            spanId: this.generateSpanId(),
            parentId: null,
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
        // keep small hex id for session identifiers
        return this.hexId(8);
    }

    // return a hex id of `bytes` bytes (2*bytes hex chars)
    hexId(bytes) {
        try {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const arr = new Uint8Array(bytes);
                crypto.getRandomValues(arr);
                return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {
            // fall through to fallback
        }
        // fallback
        let s = '';
        for (let i = 0; i < bytes; i++) {
            s += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
        }
        return s;
    }

    generateTraceId() { return this.hexId(16); } // 32 hex chars
    generateSpanId() { return this.hexId(8); }   // 16 hex chars

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
    // convert attribute object to OTLP attribute list
    _attrsToOtlp(attrs) {
        const out = [];
        for (const k in attrs) {
            if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
            const v = attrs[k];
            out.push({ key: k, value: { stringValue: String(v) } });
        }
        return out;
    }

    exportTrace(span) {
        if (!this.config.endpoint) return;

        const resourceAttrs = [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.version } },
            { key: 'deployment.environment', value: { stringValue: this.config.environment } },
            { key: 'session.id', value: { stringValue: this.sessionId } }
        ];

        const otlpSpan = {
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentId || '',
            name: span.name,
            kind: 'SPAN_KIND_INTERNAL',
            startTimeUnixNano: Math.floor(span.startTime * 1e6),
            endTimeUnixNano: Math.floor((span.endTime || Date.now()) * 1e6),
            attributes: this._attrsToOtlp(span.attributes || {})
        };

        const payload = {
            resourceSpans: [
                {
                    resource: { attributes: resourceAttrs },
                    scopeSpans: [
                        { scope: {}, spans: [otlpSpan] }
                    ]
                }
            ]
        };

        this.sendToEndpoint('traces', payload);
    }

    exportLog(log) {
        if (!this.config.endpoint) return;

        const resourceAttrs = [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.version } },
            { key: 'deployment.environment', value: { stringValue: this.config.environment } },
            { key: 'session.id', value: { stringValue: this.sessionId } }
        ];

        const record = {
            timeUnixNano: Math.floor(log.timestamp * 1e6),
            body: { stringValue: log.message },
            severityText: (log.level || 'INFO').toUpperCase(),
            attributes: this._attrsToOtlp(log.attributes || {})
        };

        const payload = {
            resourceLogs: [
                {
                    resource: { attributes: resourceAttrs },
                    scopeLogs: [
                        { scope: {}, logRecords: [record] }
                    ]
                }
            ]
        };

        this.sendToEndpoint('logs', payload);
    }

    exportMetrics() {
        if (!this.config.endpoint || this.metrics.size === 0) return;

        const resourceAttrs = [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'service.version', value: { stringValue: this.config.version } },
            { key: 'deployment.environment', value: { stringValue: this.config.environment } },
            { key: 'session.id', value: { stringValue: this.sessionId } }
        ];

        const metricsArray = Array.from(this.metrics.values());
        const otlpMetrics = [];

        metricsArray.forEach(metric => {
            const name = metric.name;
            if (metric.type === 'counter') {
                otlpMetrics.push({
                    name,
                    sum: {
                        dataPoints: [
                            {
                                asDouble: Number(metric.value || 0),
                                timeUnixNano: Math.floor((metric.lastUpdated || Date.now()) * 1e6),
                                attributes: this._attrsToOtlp(metric.labels || {})
                            }
                        ]
                    }
                });
            } else if (metric.type === 'gauge') {
                otlpMetrics.push({
                    name,
                    gauge: {
                        dataPoints: [
                            {
                                asDouble: Number(metric.value || 0),
                                timeUnixNano: Math.floor((metric.lastUpdated || Date.now()) * 1e6),
                                attributes: this._attrsToOtlp(metric.labels || {})
                            }
                        ]
                    }
                });
            } else if (metric.type === 'histogram') {
                const avg = metric.count ? metric.sum / metric.count : 0;
                const attrs = Object.assign({}, metric.labels || {}, { count: metric.count, sum: metric.sum });
                otlpMetrics.push({
                    name,
                    gauge: {
                        dataPoints: [
                            {
                                asDouble: Number(avg),
                                timeUnixNano: Math.floor((metric.lastUpdated || Date.now()) * 1e6),
                                attributes: this._attrsToOtlp(attrs)
                            }
                        ]
                    }
                });
            } else {
                otlpMetrics.push({
                    name,
                    gauge: {
                        dataPoints: [
                            {
                                asDouble: Number(metric.value || 0),
                                timeUnixNano: Math.floor((metric.lastUpdated || Date.now()) * 1e6),
                                attributes: this._attrsToOtlp(metric.labels || {})
                            }
                        ]
                    }
                });
            }
        });

        const payload = {
            resourceMetrics: [
                {
                    resource: { attributes: resourceAttrs },
                    scopeMetrics: [
                        { scope: {}, metrics: otlpMetrics }
                    ]
                }
            ]
        };

        this.sendToEndpoint('metrics', payload);

        // optional: clear metrics after export
        // this.metrics.clear();
    }

    sendToEndpoint(type, payload) {
        if (!this.config.endpoint) return;

        const url = `${this.config.endpoint.replace(/\/$/, '')}/${type}`;
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => {
            console.warn('Failed to export to endpoint:', err && err.message ? err.message : err);
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

// No factory; consumers should instantiate OTLC directly via `new OTLC(config)`

// Auto-detect environment and create default instance
const defaultConfig = {
    serviceName: 'web-chatapp',
    version: '1.0.0',
    environment: typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'development' : 'production',
    enableConsole: typeof window !== 'undefined' && window.location.hostname === 'localhost',
    // default endpoint: server receiver that accepts OTLP-shaped payloads
    endpoint: '/v1'
};

// Create a module-scoped default instance (no globals)
const defaultOTLC = new OTLC(defaultConfig);

// Export the class for consumers to import and instantiate
export { OTLC };

// Export a (possibly undefined) debug helper binder that will be set in dev mode below
export let showOTLCDebug;

// Start periodic export in production (best-effort)
if (defaultConfig.environment === 'production') {
    try {
        defaultOTLC.startPeriodicExport();
    } catch (e) {
        console.warn('Failed to start OTLC periodic export:', e && e.message ? e.message : e);
    }
}

// Development helpers
if (defaultConfig.environment === 'development') {
    // Add keyboard shortcut for inspection (Ctrl+Shift+O)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'O') {
            e.preventDefault();
            defaultOTLC.inspect();
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

    const stats = defaultOTLC.getStats();
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
            <button id="otlc-inspect-btn" style="width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-bottom: 8px;">Full Inspection</button>
            <button id="otlc-clear-btn" style="width: 100%; padding: 8px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Clear Console</button>
        `;
        document.body.appendChild(panel);

        // Hook up buttons to module-scoped default instance
        const inspectBtn = panel.querySelector('#otlc-inspect-btn');
        const clearBtn = panel.querySelector('#otlc-clear-btn');
        if (inspectBtn) inspectBtn.addEventListener('click', () => defaultOTLC.inspect());
        if (clearBtn) clearBtn.addEventListener('click', () => console.clear());

        // Auto-refresh every 5 seconds
        const interval = setInterval(() => {
            if (!document.getElementById('otlc-debug-panel')) {
                clearInterval(interval);
                return;
            }
            const newStats = defaultOTLC.getStats();
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

    // Bind the debug panel creation helper for consumers (exported top-level)
    showOTLCDebug = createDebugPanel;
}

console.log('🔍 OTLC (Open Telemetry Lite Client) loaded');
console.log('Development mode shortcuts:');
console.log('  Ctrl+Shift+O: Full inspection');
console.log('  Ctrl+Shift+D: Show debug panel');
