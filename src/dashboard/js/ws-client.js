/**
 * WebSocket Client for L2 Bot Dashboard
 */

class L2WsClient extends EventTarget {
    constructor(url = null) {
        super();
        this.url = url || `ws://${window.location.host}/ws?token=demo`;
        this.ws = null;
        this.reconnectInterval = 5000;
        this.reconnectTimer = null;
        this.subscribedChannels = ['system', 'character', 'combat'];
        this.isConnected = false;
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        console.log('Connecting to WebSocket:', this.url);
        
        try {
            this.ws = new WebSocket(this.url);
            
            this.ws.onopen = (event) => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.clearReconnectTimer();
                
                // Subscribe to channels
                this.subscribe(this.subscribedChannels);
                
                // Dispatch event
                this.dispatchEvent(new CustomEvent('connected', { detail: event }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.dispatchEvent(new CustomEvent('error', { detail: error }));
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.isConnected = false;
                this.dispatchEvent(new CustomEvent('disconnected', { detail: event }));
                
                // Auto-reconnect
                if (!this.reconnectTimer) {
                    this.scheduleReconnect();
                }
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    /**
     * Handle incoming message
     */
    handleMessage(message) {
        // Dispatch event for all messages
        this.dispatchEvent(new CustomEvent('message', { detail: message }));
        
        // Dispatch typed event
        if (message.type) {
            this.dispatchEvent(new CustomEvent(message.type, { detail: message.data }));
        }
        
        // Dispatch channel event
        if (message.channel) {
            this.dispatchEvent(new CustomEvent(`channel:${message.channel}`, { 
                detail: message 
            }));
        }
    }

    /**
     * Send message to server
     */
    send(type, data = null) {
        if (!this.isConnected) {
            console.warn('WebSocket not connected');
            return false;
        }

        const message = { type };
        if (data) Object.assign(message, data);

        try {
            this.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }

    /**
     * Subscribe to channels
     */
    subscribe(channels) {
        // Merge with existing subscriptions
        this.subscribedChannels = [...new Set([...this.subscribedChannels, ...channels])];
        
        if (this.isConnected) {
            this.send('subscribe', { channels });
        }
    }

    /**
     * Unsubscribe from channels
     */
    unsubscribe(channels) {
        this.subscribedChannels = this.subscribedChannels.filter(c => !channels.includes(c));
        
        if (this.isConnected) {
            this.send('unsubscribe', { channels });
        }
    }

    /**
     * Send ping
     */
    ping() {
        return this.send('ping');
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        this.clearReconnectTimer();
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
    }

    /**
     * Schedule reconnect
     */
    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        console.log(`Scheduling reconnect in ${this.reconnectInterval}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectInterval);
    }

    /**
     * Clear reconnect timer
     */
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Check connection status
     */
    get status() {
        if (!this.ws) return 'DISCONNECTED';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'CONNECTED';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }
}

// Create global instance
const wsClient = new L2WsClient();
