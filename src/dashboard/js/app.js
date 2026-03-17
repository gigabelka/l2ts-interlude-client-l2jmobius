/**
 * L2 Bot Dashboard - Main Application
 */

class DashboardApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.connectionStatus = 'DISCONNECTED';
        this.pingInterval = null;
        this.statusCheckInterval = null;
        this.lastWsActivity = 0;
        this.isInGame = false;
        // console.log('[DashboardApp] Constructor called');
    }

    /**
     * Initialize the dashboard
     */
    init() {
        // console.log('[DashboardApp] Initializing...');
        
        // Check dependencies
        if (typeof lucide === 'undefined') {
            console.error('[DashboardApp] Lucide not loaded!');
        }
        if (typeof apiClient === 'undefined') {
            console.error('[DashboardApp] apiClient not loaded!');
        }
        if (typeof wsClient === 'undefined') {
            console.error('[DashboardApp] wsClient not loaded!');
        }
        if (typeof statusPanel === 'undefined') {
            console.error('[DashboardApp] statusPanel not loaded!');
        }
        if (typeof eventLog === 'undefined') {
            console.error('[DashboardApp] eventLog not loaded!');
        }
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Setup navigation
        this.setupNavigation();
        
        // Setup quick action buttons
        this.setupQuickActions();
        
        // Start WebSocket connection
        this.setupWebSocket();
        
        // Start status polling (after a small delay to ensure all components ready)
        setTimeout(() => {
            this.startStatusPolling();
        }, 100);
        
        // Start ping monitoring
        this.startPingMonitor();
        
        // Initial status update
        this.updateConnectionStatus();
        
        // console.log('[DashboardApp] Initialization complete');
    }

    /**
     * Setup navigation tabs
     */
    setupNavigation() {
        // console.log('[DashboardApp] Setting up navigation');
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
        console.log('[DashboardApp] Switching to tab:', tab);
        
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
        
        // Re-initialize icons after tab switch
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Setup quick action buttons with enhanced functionality
     */
    setupQuickActions() {
        // console.log('[DashboardApp] Setting up quick actions');
        
        // Toggle Connect button (Connect/Disconnect)
        const btnToggleConnect = document.getElementById('btn-toggle-connect');
        if (btnToggleConnect) {
            btnToggleConnect.addEventListener('click', () => this.handleToggleConnect());
        } else {
            console.warn('[DashboardApp] Toggle Connect button not found');
        }
        
        // Attack button - toggle attack
        const btnAttack = document.getElementById('btn-attack');
        if (btnAttack) {
            btnAttack.addEventListener('click', () => this.handleAttack());
            // console.log('[DashboardApp] Attack button bound');
        } else {
            console.warn('[DashboardApp] Attack button not found');
        }
        
        // Next Target button
        const btnNextTarget = document.getElementById('btn-next-target');
        if (btnNextTarget) {
            btnNextTarget.addEventListener('click', () => this.handleNextTarget());
            console.log('[DashboardApp] Next Target button bound');
        } else {
            console.warn('[DashboardApp] Next Target button not found');
        }
        
        // Pickup button
        const btnPickup = document.getElementById('btn-pickup');
        if (btnPickup) {
            btnPickup.addEventListener('click', () => this.handlePickup());
            // console.log('[DashboardApp] Pickup button bound');
        } else {
            console.warn('[DashboardApp] Pickup button not found');
        }
        
        // Sit button - toggle sit/stand
        const btnSit = document.getElementById('btn-sit');
        if (btnSit) {
            btnSit.addEventListener('click', () => this.handleSit());
            // console.log('[DashboardApp] Sit button bound');
        } else {
            console.warn('[DashboardApp] Sit button not found');
        }
        
        // Chat button
        const btnChat = document.getElementById('btn-chat');
        if (btnChat) {
            btnChat.addEventListener('click', () => this.handleChat());
            // console.log('[DashboardApp] Chat button bound');
        } else {
            console.warn('[DashboardApp] Chat button not found');
        }
        
        // Target actions
        const btnTargetAttack = document.getElementById('btn-target-attack');
        if (btnTargetAttack) {
            btnTargetAttack.addEventListener('click', () => this.handleTargetAttack());
            // console.log('[DashboardApp] Target Attack button bound');
        } else {
            console.warn('[DashboardApp] Target Attack button not found');
        }
        
        const btnTargetSkill = document.getElementById('btn-target-skill');
        if (btnTargetSkill) {
            btnTargetSkill.addEventListener('click', () => this.handleTargetSkill());
            // console.log('[DashboardApp] Target Skill button bound');
        } else {
            console.warn('[DashboardApp] Target Skill button not found');
        }
        
        // Movement buttons
        this.setupMovementControls();
    }

    /**
     * Setup movement controls
     */
    setupMovementControls() {
        // Movement buttons
        const btnForward = document.getElementById('btn-move-forward');
        const btnBackward = document.getElementById('btn-move-backward');
        const btnLeft = document.getElementById('btn-move-left');
        const btnRight = document.getElementById('btn-move-right');
        const btnStop = document.getElementById('btn-move-stop');
        
        if (btnForward) {
            btnForward.addEventListener('click', () => this.handleMove('forward'));
        }
        if (btnBackward) {
            btnBackward.addEventListener('click', () => this.handleMove('backward'));
        }
        if (btnLeft) {
            btnLeft.addEventListener('click', () => this.handleMove('left'));
        }
        if (btnRight) {
            btnRight.addEventListener('click', () => this.handleMove('right'));
        }
        if (btnStop) {
            btnStop.addEventListener('click', () => this.handleStopMove());
        }
        
        // Keyboard controls for movement
        document.addEventListener('keydown', (e) => {
            if (!this.isInGame) return;
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    e.preventDefault();
                    this.handleMove('forward');
                    break;
                case 's':
                case 'arrowdown':
                    e.preventDefault();
                    this.handleMove('backward');
                    break;
                case 'a':
                case 'arrowleft':
                    e.preventDefault();
                    this.handleMove('left');
                    break;
                case 'd':
                case 'arrowright':
                    e.preventDefault();
                    this.handleMove('right');
                    break;
                case 'x':
                    e.preventDefault();
                    this.handleStopMove();
                    break;
            }
        });
        
        // Step size slider
        const stepSlider = document.getElementById('movement-step');
        const stepValue = document.getElementById('movement-step-value');
        if (stepSlider && stepValue) {
            stepSlider.addEventListener('input', (e) => {
                stepValue.textContent = e.target.value;
            });
        }
    }

    /**
     * Get current character position from UI
     */
    getCurrentPosition() {
        const posX = document.getElementById('pos-x');
        const posY = document.getElementById('pos-y');
        const posZ = document.getElementById('pos-z');
        
        if (!posX || !posY || !posZ) return null;
        
        const x = parseInt(posX.textContent);
        const y = parseInt(posY.textContent);
        const z = parseInt(posZ.textContent);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
        
        return { x, y, z };
    }

    /**
     * Get movement step size from slider
     */
    getMovementStep() {
        const slider = document.getElementById('movement-step');
        return slider ? parseInt(slider.value) : 100;
    }

    /**
     * Handle movement in a direction
     */
    async handleMove(direction) {
        if (!this.isInGame) {
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('⚠️ Not in game');
            }
            return;
        }
        
        const currentPos = this.getCurrentPosition();
        if (!currentPos) {
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('⚠️ Position unknown, cannot move');
            }
            return;
        }
        
        const step = this.getMovementStep();
        let newPos = { ...currentPos };
        let directionName = '';
        
        switch(direction) {
            case 'forward':
                newPos.y -= step;
                directionName = 'forward';
                break;
            case 'backward':
                newPos.y += step;
                directionName = 'backward';
                break;
            case 'left':
                newPos.x -= step;
                directionName = 'left';
                break;
            case 'right':
                newPos.x += step;
                directionName = 'right';
                break;
        }
        
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`🚶 Moving ${directionName} (${step} units)`);
            }
            
            await apiClient.moveTo(newPos.x, newPos.y, newPos.z);
        } catch (error) {
            console.error('[DashboardApp] Move error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Move failed: ${error.message}`);
            }
        }
    }

    /**
     * Handle stop movement
     */
    async handleStopMove() {
        if (!this.isInGame) return;
        
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            await apiClient.stopMove();
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('🛑 Stopped');
            }
        } catch (error) {
            console.error('[DashboardApp] Stop move error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Stop failed: ${error.message}`);
            }
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    setupWebSocket() {
        if (typeof wsClient === 'undefined') {
            console.error('[DashboardApp] wsClient not available');
            return;
        }
        
        // console.log('[DashboardApp] Setting up WebSocket handlers');
        
        wsClient.addEventListener('connected', () => {
            // console.log('[DashboardApp] WS connected');
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('WebSocket connected');
            }
            this.updateConnectionStatus();
        });
        
        wsClient.addEventListener('disconnected', () => {
            console.log('[DashboardApp] WS disconnected');
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('WebSocket disconnected');
            }
            this.updateConnectionStatus();
        });
        
        wsClient.addEventListener('error', (e) => {
            console.error('[DashboardApp] WS error:', e.detail);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`WebSocket error: ${e.detail}`);
            }
        });
        
        wsClient.addEventListener('any', () => {
            this.lastWsActivity = Date.now();
        });
        
        // System events for connection status
        wsClient.addEventListener('system.connected', (e) => {
            // console.log('[DashboardApp] System connected:', e.detail);
            this.connectionStatus = e.detail?.phase || 'IN_GAME';
            this.isInGame = this.connectionStatus === 'IN_GAME';
            this.updateConnectionStatus();
            this.updateActionButtons();
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`🎮 Connected to game: ${e.detail?.characterName || 'Unknown'}`);
            }
        });
        
        wsClient.addEventListener('system.disconnected', (e) => {
            console.log('[DashboardApp] System disconnected:', e.detail);
            this.connectionStatus = 'DISCONNECTED';
            this.isInGame = false;
            this.updateConnectionStatus();
            this.updateActionButtons();
        });

        // Initial connection
        // console.log('[DashboardApp] Connecting WebSocket...');
        wsClient.connect();
    }

    /**
     * Start status polling
     */
    startStatusPolling() {
        // console.log('[DashboardApp] Starting status polling');
        
        // Start character status polling
        if (typeof statusPanel !== 'undefined') {
            statusPanel.start();
        } else {
            console.error('[DashboardApp] statusPanel not available for polling');
        }
        
        // Poll general status
        this.updateStatus();
        this.statusCheckInterval = setInterval(() => this.updateStatus(), 5000);
    }

    /**
     * Start ping monitor
     */
    startPingMonitor() {
        // console.log('[DashboardApp] Starting ping monitor');
        this.pingInterval = setInterval(() => {
            this.measurePing();
        }, 5000);
    }

    /**
     * Update connection status display
     */
    async updateStatus() {
        try {
            if (typeof apiClient === 'undefined') {
                console.warn('[DashboardApp] apiClient not available');
                return;
            }
            
            const status = await apiClient.getStatus();
            // console.log('[DashboardApp] Status received:', status);
            
            this.connectionStatus = status.phase || 'DISCONNECTED';
            this.isInGame = this.connectionStatus === 'IN_GAME';
            this.updateConnectionStatus();
            
            // Update quick action buttons
            this.updateActionButtons();
            
            // Update target display if we have target info
            if (status.target) {
                this.updateTargetDisplay(status.target);
            }
        } catch (error) {
            console.error('[DashboardApp] Failed to get status:', error);
            this.connectionStatus = 'DISCONNECTED';
            this.isInGame = false;
            this.updateConnectionStatus();
            this.updateActionButtons();
        }
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) {
            console.warn('[DashboardApp] connection-status element not found');
            return;
        }
        
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
        const span = statusEl.querySelector('span');
        if (span) span.textContent = statusText;
        
        // console.log('[DashboardApp] Connection status updated:', statusText);
    }

    /**
     * Update action buttons state based on game status
     */
    updateActionButtons() {
        const isInGame = this.isInGame;
        const isDisconnected = this.connectionStatus === 'DISCONNECTED' || this.connectionStatus === 'ERROR';
        
        // console.log('[DashboardApp] Updating action buttons - inGame:', isInGame, 'disconnected:', isDisconnected);
        
        // Combat buttons - only enabled when in game
        const combatButtons = ['btn-attack', 'btn-next-target', 'btn-pickup', 'btn-sit', 'btn-chat'];
        combatButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = !isInGame;
                btn.classList.toggle('disabled', !isInGame);
            }
        });
        
        // Movement buttons - only enabled when in game
        const movementButtons = ['btn-move-forward', 'btn-move-backward', 'btn-move-left', 'btn-move-right', 'btn-move-stop'];
        movementButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = !isInGame;
            }
        });
        
        // Toggle Connect button
        const btnToggleConnect = document.getElementById('btn-toggle-connect');
        if (btnToggleConnect) {
            const isDisconnected = this.connectionStatus === 'DISCONNECTED' || this.connectionStatus === 'ERROR';
            if (isDisconnected) {
                btnToggleConnect.innerHTML = '<i data-lucide="log-in"></i> Connect';
                btnToggleConnect.classList.remove('secondary');
            } else {
                btnToggleConnect.innerHTML = '<i data-lucide="log-out"></i> Disconnect';
                btnToggleConnect.classList.add('secondary');
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
        
        // Target action buttons
        const targetDetails = document.getElementById('target-details');
        const hasTarget = targetDetails && !targetDetails.classList.contains('hidden');
        const btnTargetAttack = document.getElementById('btn-target-attack');
        const btnTargetSkill = document.getElementById('btn-target-skill');
        
        if (btnTargetAttack) btnTargetAttack.disabled = !isInGame || !hasTarget;
        if (btnTargetSkill) btnTargetSkill.disabled = !isInGame || !hasTarget;
    }

    /**
     * Set button loading state
     */
    setButtonLoading(buttonId, loading = true) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        
        if (loading) {
            btn.dataset.originalContent = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> ...';
            btn.disabled = true;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        } else {
            btn.innerHTML = btn.dataset.originalContent || btn.innerHTML;
            btn.disabled = false;
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    /**
     * Measure ping to server
     */
    async measurePing() {
        if (typeof apiClient === 'undefined') return;
        
        const start = Date.now();
        try {
            await apiClient.getStatus();
            const ping = Date.now() - start;
            
            const pingBadge = document.getElementById('ping-badge');
            if (pingBadge) {
                pingBadge.textContent = `${ping} ms`;
                pingBadge.classList.remove('ping-good', 'ping-medium', 'ping-bad');
                if (ping < 100) pingBadge.classList.add('ping-good');
                else if (ping < 300) pingBadge.classList.add('ping-medium');
                else pingBadge.classList.add('ping-bad');
            }
        } catch (error) {
            const pingBadge = document.getElementById('ping-badge');
            if (pingBadge) {
                pingBadge.textContent = '-- ms';
                pingBadge.classList.remove('ping-good', 'ping-medium', 'ping-bad');
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
            this.updateActionButtons();
            return;
        }
        
        if (targetEmpty) targetEmpty.classList.add('hidden');
        if (targetDetails) {
            targetDetails.classList.remove('hidden');
            
            const targetName = document.getElementById('target-name');
            const targetType = document.getElementById('target-type');
            const targetLevel = document.getElementById('target-level');
            
            if (targetName) targetName.textContent = target.name || 'Unknown';
            if (targetType) targetType.textContent = target.type || 'NPC';
            if (targetLevel) targetLevel.textContent = `Level ${target.level || '?'}`;
            
            const hpBar = document.getElementById('target-hp-bar');
            const hpValue = document.getElementById('target-hp-value');
            if (target.hp && hpBar && hpValue) {
                const hpPercent = Formatters.percent(target.hp.current, target.hp.max);
                hpBar.value = hpPercent;
                hpValue.textContent = Formatters.stat(target.hp.current, target.hp.max);
            }
            
            const targetDistance = document.getElementById('target-distance');
            if (targetDistance) {
                targetDistance.textContent = `Distance: ${Formatters.distance(target.distance)}`;
            }
        }
        
        this.updateActionButtons();
    }

    // ==================== Action Handlers ====================

    async handleToggleConnect() {
        const isDisconnected = this.connectionStatus === 'DISCONNECTED' || this.connectionStatus === 'ERROR';
        
        if (isDisconnected) {
            // Connect
            console.log('[DashboardApp] Handle Connect clicked');
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('🔄 Connecting to game server...');
            }
            
            this.setButtonLoading('btn-toggle-connect', true);
            try {
                if (typeof apiClient === 'undefined') {
                    throw new Error('API client not available');
                }
                const result = await apiClient.connect();
                console.log('[DashboardApp] Connect result:', result);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('✅ Connection initiated successfully');
                }
            } catch (error) {
                console.error('[DashboardApp] Connect error:', error);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage(`❌ Connection failed: ${error.message}`);
                }
            } finally {
                this.setButtonLoading('btn-toggle-connect', false);
            }
        } else {
            // Disconnect
            console.log('[DashboardApp] Handle Disconnect clicked');
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('🔄 Disconnecting...');
            }
            
            this.setButtonLoading('btn-toggle-connect', true);
            try {
                if (typeof apiClient === 'undefined') {
                    throw new Error('API client not available');
                }
                await apiClient.disconnect();
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('✅ Disconnected from game server');
                }
                this.isInGame = false;
                this.updateActionButtons();
            } catch (error) {
                console.error('[DashboardApp] Disconnect error:', error);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage(`❌ Disconnect error: ${error.message}`);
                }
            } finally {
                this.setButtonLoading('btn-toggle-connect', false);
            }
        }
    }

    async handleAttack() {
        console.log('[DashboardApp] Handle Attack clicked');
        const btnAttack = document.getElementById('btn-attack');
        const isAttacking = btnAttack?.classList.contains('active');
        
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            if (isAttacking) {
                await apiClient.stopAttack();
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('🛑 Stopped attacking');
                }
                if (btnAttack) {
                    btnAttack.classList.remove('active');
                    btnAttack.innerHTML = '<i data-lucide="sword"></i> Attack';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            } else {
                await apiClient.attack();
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('⚔️ Started attacking');
                }
                if (btnAttack) {
                    btnAttack.classList.add('active');
                    btnAttack.innerHTML = '<i data-lucide="square"></i> Stop';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }
        } catch (error) {
            console.error('[DashboardApp] Attack error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Attack failed: ${error.message}`);
            }
        }
    }

    async handleNextTarget() {
        console.log('[DashboardApp] Handle Next Target clicked');
        this.setButtonLoading('btn-next-target', true);
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            const target = await apiClient.nextTarget();
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`🎯 Target: ${target.name} (Lv.${target.level}, ${target.distance?.toFixed(1)}m)`);
            }
            
            // Update target UI
            this.updateTargetDisplay(target);
        } catch (error) {
            console.error('[DashboardApp] Next target error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Next target failed: ${error.message}`);
            }
        } finally {
            this.setButtonLoading('btn-next-target', false);
        }
    }

    async handlePickup() {
        console.log('[DashboardApp] Handle Pickup clicked');
        this.setButtonLoading('btn-pickup', true);
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            // Get nearby items first
            const result = await apiClient.getNearbyItems(200);
            const items = result?.items || [];
            if (items.length > 0) {
                // Pick up the closest item
                const item = items[0];
                await apiClient.pickupItem(item.objectId);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage(`📦 Moving to pickup ${item.name || 'item'} x${item.count || 1}`);
                }
            } else {
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('ℹ️ No items nearby to pickup');
                }
            }
        } catch (error) {
            console.error('[DashboardApp] Pickup error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Pickup failed: ${error.message}`);
            }
        } finally {
            this.setButtonLoading('btn-pickup', false);
        }
    }

    async handleSit() {
        console.log('[DashboardApp] Handle Sit clicked');
        const btnSit = document.getElementById('btn-sit');
        const isSitting = btnSit?.classList.contains('active');
        
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            await apiClient.toggleSit(isSitting); // true = stand, false = sit
            if (isSitting) {
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('🧍 Standing up');
                }
                if (btnSit) {
                    btnSit.classList.remove('active');
                    btnSit.innerHTML = '<i data-lucide="armchair"></i> Sit/Stand';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            } else {
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('💺 Sitting down');
                }
                if (btnSit) {
                    btnSit.classList.add('active');
                    btnSit.innerHTML = '<i data-lucide="user"></i> Sit/Stand';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }
        } catch (error) {
            console.error('[DashboardApp] Sit error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Sit/Stand failed: ${error.message}`);
            }
        }
    }

    async handleChat() {
        console.log('[DashboardApp] Handle Chat clicked');
        
        // Create a nicer modal for chat instead of prompt
        const result = await this.showChatDialog();
        if (result && result.message) {
            try {
                if (typeof apiClient === 'undefined') {
                    throw new Error('API client not available');
                }
                
                await apiClient.sendChat(result.channel, result.message);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage(`💬 [${result.channel}] ${result.message}`);
                }
            } catch (error) {
                console.error('[DashboardApp] Chat error:', error);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage(`❌ Chat failed: ${error.message}`);
                }
            }
        }
    }

    /**
     * Show chat input dialog
     */
    showChatDialog() {
        return new Promise((resolve) => {
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'chat-modal';
            modal.innerHTML = `
                <div class="chat-modal-content">
                    <h4>Send Message</h4>
                    <select id="chat-channel">
                        <option value="ALL">All</option>
                        <option value="TRADE">Trade</option>
                        <option value="SHOUT">Shout</option>
                        <option value="TELL">Tell</option>
                        <option value="CLAN">Clan</option>
                        <option value="ALLIANCE">Alliance</option>
                        <option value="PARTY">Party</option>
                    </select>
                    <input type="text" id="chat-message" placeholder="Enter your message..." maxlength="100">
                    <div class="chat-modal-actions">
                        <button id="chat-cancel" class="secondary">Cancel</button>
                        <button id="chat-send">Send</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const channelSelect = modal.querySelector('#chat-channel');
            const input = modal.querySelector('#chat-message');
            const sendBtn = modal.querySelector('#chat-send');
            const cancelBtn = modal.querySelector('#chat-cancel');
            
            input.focus();
            
            const cleanup = () => {
                if (modal.parentNode) {
                    document.body.removeChild(modal);
                }
            };
            
            const getResult = () => ({
                channel: channelSelect.value,
                message: input.value.trim()
            });
            
            sendBtn.addEventListener('click', () => {
                const result = getResult();
                cleanup();
                resolve(result);
            });
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const result = getResult();
                    cleanup();
                    resolve(result);
                }
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            });
            
            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(null);
                }
            });
        });
    }

    async handleTargetAttack() {
        console.log('[DashboardApp] Handle Target Attack clicked');
        const targetInfo = document.getElementById('target-details');
        if (targetInfo && !targetInfo.classList.contains('hidden')) {
            await this.handleAttack();
        } else {
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('⚠️ No target selected');
            }
        }
    }

    async handleTargetSkill() {
        console.log('[DashboardApp] Handle Target Skill clicked');
        const targetInfo = document.getElementById('target-details');
        if (!targetInfo || targetInfo.classList.contains('hidden')) {
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage('⚠️ No target selected');
            }
            return;
        }
        
        // Show skill selection dialog
        try {
            if (typeof apiClient === 'undefined') {
                throw new Error('API client not available');
            }
            
            const skills = await apiClient.getSkills();
            if (!skills || skills.length === 0) {
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage('ℹ️ No skills available');
                }
                return;
            }
            
            const skillId = await this.showSkillDialog(skills);
            if (skillId) {
                await apiClient.useSkill(skillId, 1);
                if (typeof eventLog !== 'undefined') {
                    eventLog.addSystemMessage(`✨ Using skill`);
                }
            }
        } catch (error) {
            console.error('[DashboardApp] Skill error:', error);
            if (typeof eventLog !== 'undefined') {
                eventLog.addSystemMessage(`❌ Skill error: ${error.message}`);
            }
        }
    }

    /**
     * Show skill selection dialog
     */
    showSkillDialog(skills) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'skill-modal';
            
            const skillsHtml = skills.map(s => `
                <div class="skill-item" data-skill-id="${s.id || s.skillId}">
                    <span class="skill-name">${s.name || `Skill ${s.id || s.skillId}`}</span>
                    <span class="skill-level">Lv.${s.level || 1}</span>
                </div>
            `).join('');
            
            modal.innerHTML = `
                <div class="skill-modal-content">
                    <h4>Select Skill</h4>
                    <div class="skills-list">
                        ${skillsHtml}
                    </div>
                    <div class="skill-modal-actions">
                        <button id="skill-cancel" class="secondary">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const cleanup = () => {
                if (modal.parentNode) {
                    document.body.removeChild(modal);
                }
            };
            
            modal.querySelectorAll('.skill-item').forEach(item => {
                item.addEventListener('click', () => {
                    const skillId = parseInt(item.dataset.skillId);
                    cleanup();
                    resolve(skillId);
                });
            });
            
            modal.querySelector('#skill-cancel').addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(null);
                }
            });
        });
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
console.log('[DashboardApp] Script loaded, waiting for DOM...');
document.addEventListener('DOMContentLoaded', () => {
    // console.log('[DashboardApp] DOM ready, initializing...');
    window.dashboard = new DashboardApp();
    window.dashboard.init();
    // console.log('[DashboardApp] Initialization finished');
});
