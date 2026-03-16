/**
 * L2 Bot Dashboard - Main Application
 */

class DashboardApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.connectionStatus = 'DISCONNECTED';
        this.pingInterval = null;
        this.statusCheckInterval = null;
    }

    /**
     * Initialize the dashboard
     */
    init() {
        console.log('Initializing L2 Bot Dashboard...');
        
        // Initialize Lucide icons
        lucide.createIcons();
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup quick action buttons
        this.setupQuickActions();
        
        // Start WebSocket connection
        this.setupWebSocket();
        
        // Start status polling
        this.startStatusPolling();
        
        // Start ping monitoring
        this.startPingMonitor();
        
        // Initial status update
        this.updateConnectionStatus();
        
        console.log('Dashboard initialized');
    }

    /**
     * Setup navigation tabs
     */
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    /**
     * Switch to a different tab
     */
    switchTab(tab) {
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.tab === tab);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tab}`);
        });
        
        this.currentTab = tab;
        
        // Special handling for specific tabs
        if (tab === 'api-docs') {
            this.loadApiDocs();
        }
    }

    /**
     * Setup quick action buttons
     */
    setupQuickActions() {
        // Connect button
        const btnConnect = document.getElementById('btn-connect');
        if (btnConnect) {
            btnConnect.addEventListener('click', () => this.handleConnect());
        }
        
        // Disconnect button
        const btnDisconnect = document.getElementById('btn-disconnect');
        if (btnDisconnect) {
            btnDisconnect.addEventListener('click', () => this.handleDisconnect());
        }
        
        // Attack button
        const btnAttack = document.getElementById('btn-attack');
        if (btnAttack) {
            btnAttack.addEventListener('click', () => this.handleAttack());
        }
        
        // Pickup button
        const btnPickup = document.getElementById('btn-pickup');
        if (btnPickup) {
            btnPickup.addEventListener('click', () => this.handlePickup());
        }
        
        // Sit button
        const btnSit = document.getElementById('btn-sit');
        if (btnSit) {
            btnSit.addEventListener('click', () => this.handleSit());
        }
        
        // Chat button
        const btnChat = document.getElementById('btn-chat');
        if (btnChat) {
            btnChat.addEventListener('click', () => this.handleChat());
        }
        
        // Target actions
        const btnTargetAttack = document.getElementById('btn-target-attack');
        if (btnTargetAttack) {
            btnTargetAttack.addEventListener('click', () => this.handleTargetAttack());
        }
        
        const btnTargetSkill = document.getElementById('btn-target-skill');
        if (btnTargetSkill) {
            btnTargetSkill.addEventListener('click', () => this.handleTargetSkill());
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocket() {
        wsClient.addEventListener('connected', () => {
            eventLog.addSystemMessage('WebSocket connected');
            this.updateConnectionStatus();
        });
        
        wsClient.addEventListener('disconnected', () => {
            eventLog.addSystemMessage('WebSocket disconnected');
            this.updateConnectionStatus();
        });
        
        wsClient.addEventListener('error', (e) => {
            eventLog.addSystemMessage(`WebSocket error: ${e.detail}`);
        });
        
        // Initial connection
        wsClient.connect();
    }

    /**
     * Start status polling
     */
    startStatusPolling() {
        // Start character status polling
        statusPanel.start();
        
        // Poll general status
        this.updateStatus();
        this.statusCheckInterval = setInterval(() => this.updateStatus(), 5000);
    }

    /**
     * Start ping monitor
     */
    startPingMonitor() {
        this.pingInterval = setInterval(() => {
            this.measurePing();
        }, 5000);
    }

    /**
     * Update connection status display
     */
    async updateStatus() {
        try {
            const status = await apiClient.getStatus();
            this.connectionStatus = status.phase || 'DISCONNECTED';
            this.updateConnectionStatus();
            
            // Update quick action buttons
            this.updateActionButtons();
            
            // Update target display if we have target info
            if (status.target) {
                this.updateTargetDisplay(status.target);
            }
        } catch (error) {
            this.connectionStatus = 'DISCONNECTED';
            this.updateConnectionStatus();
        }
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;
        
        // Remove old status classes
        statusEl.classList.remove('connected', 'connecting', 'error');
        
        // Add appropriate class
        const phase = this.connectionStatus;
        let statusText = phase;
        let statusClass = '';
        
        if (phase === 'IN_GAME') {
            statusClass = 'connected';
            statusText = 'IN GAME';
        } else if (phase === 'DISCONNECTED' || phase === 'ERROR') {
            statusClass = 'error';
            statusText = phase === 'ERROR' ? 'ERROR' : 'OFFLINE';
        } else {
            statusClass = 'connecting';
            statusText = Formatters.phase(phase);
        }
        
        statusEl.classList.add(statusClass);
        statusEl.querySelector('span').textContent = statusText;
    }

    /**
     * Update action buttons state
     */
    updateActionButtons() {
        const isInGame = this.connectionStatus === 'IN_GAME';
        const isDisconnected = this.connectionStatus === 'DISCONNECTED';
        
        // Combat buttons - only enabled when in game
        const combatButtons = ['btn-attack', 'btn-pickup', 'btn-sit', 'btn-chat'];
        combatButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = !isInGame;
        });
        
        // Connect/Disconnect buttons
        const btnConnect = document.getElementById('btn-connect');
        const btnDisconnect = document.getElementById('btn-disconnect');
        
        if (btnConnect) btnConnect.disabled = !isDisconnected;
        if (btnDisconnect) btnDisconnect.disabled = isDisconnected;
    }

    /**
     * Measure ping to server
     */
    async measurePing() {
        const start = Date.now();
        try {
            await apiClient.getStatus();
            const ping = Date.now() - start;
            
            const pingBadge = document.getElementById('ping-badge');
            if (pingBadge) {
                pingBadge.textContent = `${ping} ms`;
            }
        } catch (error) {
            const pingBadge = document.getElementById('ping-badge');
            if (pingBadge) {
                pingBadge.textContent = '-- ms';
            }
        }
    }

    /**
     * Update target display
     */
    updateTargetDisplay(target) {
        const targetEmpty = document.querySelector('.target-empty');
        const targetDetails = document.getElementById('target-details');
        
        if (!target || !target.objectId) {
            if (targetEmpty) targetEmpty.classList.remove('hidden');
            if (targetDetails) targetDetails.classList.add('hidden');
            return;
        }
        
        if (targetEmpty) targetEmpty.classList.add('hidden');
        if (targetDetails) {
            targetDetails.classList.remove('hidden');
            
            document.getElementById('target-name').textContent = target.name || 'Unknown';
            document.getElementById('target-type').textContent = target.type || 'NPC';
            document.getElementById('target-level').textContent = `Level ${target.level || '?'}`;
            
            const hpBar = document.getElementById('target-hp-bar');
            const hpValue = document.getElementById('target-hp-value');
            if (target.hp && hpBar && hpValue) {
                const hpPercent = Formatters.percent(target.hp.current, target.hp.max);
                hpBar.value = hpPercent;
                hpValue.textContent = Formatters.stat(target.hp.current, target.hp.max);
            }
            
            document.getElementById('target-distance').textContent = 
                `Distance: ${Formatters.distance(target.distance)}`;
        }
    }

    // ==================== Action Handlers ====================

    async handleConnect() {
        eventLog.addSystemMessage('Connecting...');
        try {
            await apiClient.connect();
            eventLog.addSystemMessage('Connection initiated');
        } catch (error) {
            eventLog.addSystemMessage(`Connection failed: ${error.message}`);
        }
    }

    async handleDisconnect() {
        eventLog.addSystemMessage('Disconnecting...');
        try {
            await apiClient.disconnect();
            eventLog.addSystemMessage('Disconnected');
        } catch (error) {
            eventLog.addSystemMessage(`Disconnect error: ${error.message}`);
        }
    }

    async handleAttack() {
        try {
            await apiClient.attack();
            eventLog.addSystemMessage('Attack command sent');
        } catch (error) {
            eventLog.addSystemMessage(`Attack failed: ${error.message}`);
        }
    }

    async handlePickup() {
        try {
            // Get nearby items first
            const items = await apiClient.getNearbyItems(200);
            if (items.items && items.items.length > 0) {
                const item = items.items[0];
                await apiClient.pickupItem(item.objectId);
                eventLog.addSystemMessage(`Picking up ${item.name || 'item'}`);
            } else {
                eventLog.addSystemMessage('No items nearby to pickup');
            }
        } catch (error) {
            eventLog.addSystemMessage(`Pickup failed: ${error.message}`);
        }
    }

    async handleSit() {
        try {
            await apiClient.socialAction(0); // 0 = sit/stand
            eventLog.addSystemMessage('Sit/Stand command sent');
        } catch (error) {
            eventLog.addSystemMessage(`Sit failed: ${error.message}`);
        }
    }

    async handleChat() {
        const message = prompt('Enter message:');
        if (message) {
            try {
                await apiClient.sendChat('ALL', message);
                eventLog.addSystemMessage(`Chat sent: ${message}`);
            } catch (error) {
                eventLog.addSystemMessage(`Chat failed: ${error.message}`);
            }
        }
    }

    async handleTargetAttack() {
        const targetInfo = document.getElementById('target-details');
        if (!targetInfo.classList.contains('hidden')) {
            await this.handleAttack();
        }
    }

    async handleTargetSkill() {
        eventLog.addSystemMessage('Skill selection not implemented yet');
    }

    /**
     * Load API Documentation (Scalar)
     */
    loadApiDocs() {
        const container = document.getElementById('scalar-container');
        if (!container || container.dataset.loaded) return;
        
        // Load Scalar API reference
        const script = document.createElement('script');
        script.id = 'api-reference';
        script.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
        script.dataset.configuration = JSON.stringify({
            url: '/openapi.json',
            theme: 'kepler',
            layout: 'modern',
            hideDarkModeToggle: false,
            defaultHttpClient: {
                targetKey: 'js',
                clientKey: 'fetch'
            }
        });
        
        container.innerHTML = '';
        container.appendChild(script);
        container.dataset.loaded = 'true';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardApp();
    window.dashboard.init();
});
