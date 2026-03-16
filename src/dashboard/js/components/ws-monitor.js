/**
 * WebSocket Monitor Component - Detailed WS connection monitoring and debugging
 */

class WSMonitor {
    constructor() {
        this.stats = {
            system: 0,
            character: 0,
            combat: 0,
            chat: 0,
            world: 0,
            total: 0,
            inbound: 0,
            outbound: 0
        };
        this.connectedAt = null;
        this.latency = 0;
        this.maxRawEntries = 500;
        this.autoScroll = true;
        this.rawFilter = 'all';
        this.latencyInterval = null;
        this.uptimeInterval = null;
        
        this.init();
    }

    /**
     * Initialize the monitor
     */
    init() {
        this.setupEventListeners();
        this.setupUIListeners();
        this.startUptimeTracking();
        this.updateDisplay();
    }

    /**
     * Setup WebSocket event listeners
     */
    setupEventListeners() {
        // Connection events
        wsClient.addEventListener('connected', () => {
            this.connectedAt = Date.now();
            this.addRawEntry('info', 'WebSocket connected');
            this.updateStatus('CONNECTED', 'connected');
            this.startLatencyTracking();
        });

        wsClient.addEventListener('disconnected', (e) => {
            this.addRawEntry('info', `WebSocket disconnected (code: ${e.detail?.code || 'unknown'})`);
            this.updateStatus('DISCONNECTED', 'disconnected');
            this.stopLatencyTracking();
        });

        wsClient.addEventListener('reconnecting', (e) => {
            const { delay, attempt } = e.detail;
            this.addRawEntry('info', `Reconnecting in ${delay}ms (attempt ${attempt})`);
            this.updateStatus('RECONNECTING...', 'reconnecting');
        });

        wsClient.addEventListener('error', (e) => {
            this.addRawEntry('error', `Error: ${JSON.stringify(e.detail)}`);
        });

        // Message events
        wsClient.addEventListener('message', (e) => {
            this.handleMessage(e.detail, 'in');
        });

        // Channel-specific events
        ['system', 'character', 'combat', 'chat', 'world'].forEach(channel => {
            wsClient.addEventListener(`channel:${channel}`, (e) => {
                this.stats[channel]++;
                this.stats.total++;
                this.stats.inbound++;
                this.updateStats();
            });
        });
    }

    /**
     * Setup UI event listeners
     */
    setupUIListeners() {
        // Connect/Disconnect buttons
        const btnConnect = document.getElementById('ws-btn-connect');
        const btnDisconnect = document.getElementById('ws-btn-disconnect');
        
        if (btnConnect) {
            btnConnect.addEventListener('click', () => {
                wsClient.shouldReconnect = true;
                wsClient.resetReconnectDelay();
                wsClient.connect();
            });
        }
        
        if (btnDisconnect) {
            btnDisconnect.addEventListener('click', () => {
                wsClient.disconnect();
            });
        }

        // Reset stats
        const btnReset = document.getElementById('ws-reset-stats');
        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetStats());
        }

        // Channel subscription
        const btnSubscribe = document.getElementById('ws-subscribe-btn');
        const btnUnsubscribe = document.getElementById('ws-unsubscribe-btn');
        const channelInput = document.getElementById('ws-channel-input');
        
        if (btnSubscribe && channelInput) {
            btnSubscribe.addEventListener('click', () => {
                const channel = channelInput.value.trim();
                if (channel) {
                    wsClient.subscribe([channel]);
                    this.addRawEntry('out', `Subscribe to: ${channel}`);
                    this.updateChannelsList();
                    channelInput.value = '';
                }
            });
        }
        
        if (btnUnsubscribe && channelInput) {
            btnUnsubscribe.addEventListener('click', () => {
                const channel = channelInput.value.trim();
                if (channel) {
                    wsClient.unsubscribe([channel]);
                    this.addRawEntry('out', `Unsubscribe from: ${channel}`);
                    this.updateChannelsList();
                    channelInput.value = '';
            }
            });
        }

        // Test message
        const btnSend = document.getElementById('ws-send-btn');
        const testType = document.getElementById('ws-test-type');
        const testData = document.getElementById('ws-test-data');
        
        if (btnSend && testType) {
            btnSend.addEventListener('click', () => {
                this.sendTestMessage(testType.value, testData?.value);
            });
        }

        // Raw log controls
        const autoScrollToggle = document.getElementById('ws-auto-scroll');
        const rawFilter = document.getElementById('ws-raw-filter');
        const btnClearRaw = document.getElementById('ws-clear-raw');
        
        if (autoScrollToggle) {
            autoScrollToggle.addEventListener('change', (e) => {
                this.autoScroll = e.target.checked;
            });
        }
        
        if (rawFilter) {
            rawFilter.addEventListener('change', (e) => {
                this.rawFilter = e.target.value;
                this.filterRawLog();
            });
        }
        
        if (btnClearRaw) {
            btnClearRaw.addEventListener('click', () => this.clearRawLog());
        }
    }

    /**
     * Handle incoming/outgoing message
     */
    handleMessage(message, direction) {
        const type = message.type || 'unknown';
        const channel = message.channel || 'unknown';
        
        // Add to raw log
        this.addRawEntry(direction, JSON.stringify(message), type, channel);
        
        // Update stats if outbound
        if (direction === 'out') {
            this.stats.outbound++;
            this.updateStats();
        }
    }

    /**
     * Send test message
     */
    sendTestMessage(type, data) {
        let message;
        
        switch (type) {
            case 'ping':
                message = { type: 'ping' };
                break;
            case 'subscribe':
                message = { type: 'subscribe', channels: ['test'] };
                break;
            case 'unsubscribe':
                message = { type: 'unsubscribe', channels: ['test'] };
                break;
            case 'custom':
                try {
                    message = data ? JSON.parse(data) : { type: 'custom' };
                } catch (e) {
                    this.addRawEntry('error', `Invalid JSON: ${e.message}`);
                    return;
                }
                break;
        }
        
        if (message) {
            wsClient.ws?.send(JSON.stringify(message));
            this.handleMessage(message, 'out');
        }
    }

    /**
     * Add entry to raw log
     */
    addRawEntry(direction, data, type = '', channel = '') {
        const container = document.getElementById('ws-raw-log');
        if (!container) return;

        const time = Formatters.time(new Date());
        const entry = document.createElement('div');
        entry.className = `ws-raw-entry ${direction}`;
        entry.dataset.direction = direction;
        entry.dataset.type = type;
        entry.dataset.channel = channel;
        
        const directionLabel = direction === 'in' ? '← IN' : direction === 'out' ? '→ OUT' : '● INFO';
        const directionClass = direction === 'in' ? 'inbound' : direction === 'out' ? 'outbound' : 'info';
        
        // Truncate long data
        const displayData = data.length > 200 ? data.substring(0, 200) + '...' : data;
        
        entry.innerHTML = `
            <span class="ws-raw-time">${time}</span>
            <span class="ws-raw-direction ${directionClass}">${directionLabel}</span>
            ${type ? `<span class="ws-raw-type">[${type}]</span>` : ''}
            <span class="ws-raw-data" title="${this.escapeHtml(data)}">${this.escapeHtml(displayData)}</span>
        `;

        container.appendChild(entry);
        
        // Remove old entries
        while (container.children.length > this.maxRawEntries) {
            container.removeChild(container.firstChild);
        }
        
        // Auto-scroll
        if (this.autoScroll) {
            container.scrollTop = container.scrollHeight;
        }
        
        // Apply current filter
        this.applyFilterToEntry(entry);
    }

    /**
     * Filter raw log based on current filter
     */
    filterRawLog() {
        const container = document.getElementById('ws-raw-log');
        if (!container) return;
        
        Array.from(container.children).forEach(entry => {
            this.applyFilterToEntry(entry);
        });
    }

    /**
     * Apply filter to single entry
     */
    applyFilterToEntry(entry) {
        if (this.rawFilter === 'all') {
            entry.style.display = '';
        } else {
            const direction = entry.dataset.direction;
            entry.style.display = direction === this.rawFilter ? '' : 'none';
        }
    }

    /**
     * Clear raw log
     */
    clearRawLog() {
        const container = document.getElementById('ws-raw-log');
        if (container) {
            container.innerHTML = '';
        }
    }

    /**
     * Update connection status display
     */
    updateStatus(text, cssClass) {
        const statusEl = document.getElementById('ws-status-text');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = `ws-badge ${cssClass}`;
        }
        
        // Update URL
        const urlEl = document.getElementById('ws-url');
        if (urlEl) {
            urlEl.textContent = wsClient.url;
        }
    }

    /**
     * Update statistics display
     */
    updateStats() {
        // Update channel counts
        ['system', 'character', 'combat', 'chat', 'world'].forEach(channel => {
            const el = document.getElementById(`ws-count-${channel}`);
            if (el) el.textContent = this.stats[channel].toLocaleString();
        });
        
        // Update total
        const totalEl = document.getElementById('ws-count-total');
        if (totalEl) totalEl.textContent = this.stats.total.toLocaleString();
        
        // Update message count in status
        const msgEl = document.getElementById('ws-msg-count');
        if (msgEl) msgEl.textContent = this.stats.total.toLocaleString();
    }

    /**
     * Update channels list display
     */
    updateChannelsList() {
        const container = document.getElementById('ws-channels');
        if (!container) return;
        
        container.innerHTML = wsClient.subscribedChannels
            .map(ch => `<div class="ws-channel-tag">${ch}</div>`)
            .join('');
    }

    /**
     * Start latency tracking (ping)
     */
    startLatencyTracking() {
        this.latencyInterval = setInterval(() => {
            const start = Date.now();
            wsClient.ping();
            
            // One-time listener for pong
            const pongHandler = () => {
                this.latency = Date.now() - start;
                const latencyEl = document.getElementById('ws-latency');
                if (latencyEl) {
                    latencyEl.textContent = `${this.latency} ms`;
                    latencyEl.className = this.latency > 500 ? 'high' : this.latency > 100 ? 'medium' : 'low';
                }
                wsClient.removeEventListener('pong', pongHandler);
            };
            wsClient.addEventListener('pong', pongHandler);
        }, 5000);
    }

    /**
     * Stop latency tracking
     */
    stopLatencyTracking() {
        if (this.latencyInterval) {
            clearInterval(this.latencyInterval);
            this.latencyInterval = null;
        }
        const latencyEl = document.getElementById('ws-latency');
        if (latencyEl) latencyEl.textContent = '-- ms';
    }

    /**
     * Start uptime tracking
     */
    startUptimeTracking() {
        this.uptimeInterval = setInterval(() => {
            this.updateUptime();
            this.updateReconnectCount();
        }, 1000);
    }

    /**
     * Update uptime display
     */
    updateUptime() {
        const uptimeEl = document.getElementById('ws-uptime');
        if (!uptimeEl || !this.connectedAt) {
            if (uptimeEl) uptimeEl.textContent = '--';
            return;
        }
        
        const seconds = Math.floor((Date.now() - this.connectedAt) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const hours = Math.floor(mins / 60);
        
        if (hours > 0) {
            uptimeEl.textContent = `${hours}h ${mins % 60}m ${secs}s`;
        } else if (mins > 0) {
            uptimeEl.textContent = `${mins}m ${secs}s`;
        } else {
            uptimeEl.textContent = `${secs}s`;
        }
    }

    /**
     * Update reconnect count display
     */
    updateReconnectCount() {
        const countEl = document.getElementById('ws-reconnect-count');
        if (countEl) {
            countEl.textContent = wsClient.connectionAttempts;
        }
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            system: 0,
            character: 0,
            combat: 0,
            chat: 0,
            world: 0,
            total: 0,
            inbound: 0,
            outbound: 0
        };
        this.updateStats();
        this.addRawEntry('info', 'Statistics reset');
    }

    /**
     * Update all displays
     */
    updateDisplay() {
        this.updateStatus(wsClient.status.toUpperCase(), wsClient.isConnected ? 'connected' : 'disconnected');
        this.updateStats();
        this.updateChannelsList();
        this.updateUptime();
        this.updateReconnectCount();
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const wsMonitor = new WSMonitor();
