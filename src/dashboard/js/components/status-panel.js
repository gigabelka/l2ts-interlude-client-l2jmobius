/**
 * Status Panel Component - Updates character status display
 */

class StatusPanel {
    constructor() {
        this.elements = {
            name: document.getElementById('char-name'),
            class: document.getElementById('char-class'),
            level: document.getElementById('char-level'),
            hpBar: document.getElementById('hp-bar'),
            hpValue: document.getElementById('hp-value'),
            mpBar: document.getElementById('mp-bar'),
            mpValue: document.getElementById('mp-value'),
            xpBar: document.getElementById('xp-bar'),
            xpValue: document.getElementById('xp-value'),
            cpBar: document.getElementById('cp-bar'),
            cpValue: document.getElementById('cp-value'),
            posX: document.getElementById('pos-x'),
            posY: document.getElementById('pos-y'),
            posZ: document.getElementById('pos-z')
        };
        
        this.lastData = null;
        this.pollingInterval = null;
    }

    /**
     * Start polling for character data
     */
    start() {
        this.update(); // Initial update
        this.pollingInterval = setInterval(() => this.update(), 2000);
    }

    /**
     * Stop polling
     */
    stop() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Fetch and update character data
     */
    async update() {
        try {
            const data = await apiClient.getCharacter();
            this.render(data);
            this.lastData = data;
        } catch (error) {
            console.error('Failed to update character status:', error);
            this.showDisconnected();
        }
    }

    /**
     * Render character data
     */
    render(data) {
        if (!data) return;

        // Basic info
        if (this.elements.name) this.elements.name.textContent = data.name || '--';
        if (this.elements.class) this.elements.class.textContent = 
            Formatters.className(data.classId) || '--';
        if (this.elements.level) this.elements.level.textContent = 
            `Level ${data.level || '--'}`;

        // HP
        if (data.hp && this.elements.hpBar && this.elements.hpValue) {
            const hpPercent = Formatters.percent(data.hp.current, data.hp.max);
            this.elements.hpBar.value = hpPercent;
            this.elements.hpBar.max = 100;
            this.elements.hpValue.textContent = Formatters.stat(data.hp.current, data.hp.max);
        }

        // MP
        if (data.mp && this.elements.mpBar && this.elements.mpValue) {
            const mpPercent = Formatters.percent(data.mp.current, data.mp.max);
            this.elements.mpBar.value = mpPercent;
            this.elements.mpBar.max = 100;
            this.elements.mpValue.textContent = Formatters.stat(data.mp.current, data.mp.max);
        }

        // XP
        if (data.exp !== undefined && this.elements.xpBar && this.elements.xpValue) {
            // Assuming expPercent from API, otherwise calculate roughly
            const xpPercent = data.expPercent || 0;
            this.elements.xpBar.value = xpPercent;
            this.elements.xpBar.max = 100;
            this.elements.xpValue.textContent = `${xpPercent.toFixed(1)}%`;
        }

        // CP (Combat Points)
        if (data.cp && this.elements.cpBar && this.elements.cpValue) {
            const cpPercent = Formatters.percent(data.cp.current, data.cp.max);
            this.elements.cpBar.value = cpPercent;
            this.elements.cpBar.max = 100;
            this.elements.cpValue.textContent = Formatters.stat(data.cp.current, data.cp.max);
        } else if (this.elements.cpBar && this.elements.cpValue) {
            // Hide CP if not available
            this.elements.cpBar.value = 0;
            this.elements.cpValue.textContent = '--/--';
        }

        // Position
        if (data.position) {
            if (this.elements.posX) this.elements.posX.textContent = Formatters.coord(data.position.x);
            if (this.elements.posY) this.elements.posY.textContent = Formatters.coord(data.position.y);
            if (this.elements.posZ) this.elements.posZ.textContent = Formatters.coord(data.position.z);
        }
    }

    /**
     * Show disconnected state
     */
    showDisconnected() {
        const fields = ['name', 'class', 'level'];
        fields.forEach(field => {
            if (this.elements[field]) this.elements[field].textContent = '--';
        });
        
        ['hp', 'mp', 'xp', 'cp'].forEach(stat => {
            if (this.elements[`${stat}Bar`]) {
                this.elements[`${stat}Bar`].value = 0;
            }
            if (this.elements[`${stat}Value`]) {
                this.elements[`${stat}Value`].textContent = '--/--';
            }
        });
        
        ['posX', 'posY', 'posZ'].forEach(pos => {
            if (this.elements[pos]) this.elements[pos].textContent = '--';
        });
    }

    /**
     * Get last cached data
     */
    getLastData() {
        return this.lastData;
    }
}

// Create global instance
const statusPanel = new StatusPanel();
