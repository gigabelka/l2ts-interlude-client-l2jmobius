/**
 * Combat Controls Component - Manages combat-related UI and actions
 */

class CombatControls {
    constructor() {
        this.isAttacking = false;
        this.currentTarget = null;
        this.combatLog = [];
        this.maxLogEntries = 100;
        
        this.setupEventListeners();
    }

    /**
     * Setup WebSocket and UI event listeners
     */
    setupEventListeners() {
        // Listen for combat events from WebSocket
        wsClient.addEventListener('combat.attack', (e) => this.handleAttackEvent(e.detail));
        wsClient.addEventListener('combat.hit', (e) => this.handleHitEvent(e.detail));
        wsClient.addEventListener('combat.kill', (e) => this.handleKillEvent(e.detail));
        wsClient.addEventListener('combat.death', (e) => this.handleDeathEvent(e.detail));
        
        // Listen for target changes
        wsClient.addEventListener('character.target_changed', (e) => {
            this.currentTarget = e.detail;
            this.updateTargetUI();
        });
    }

    /**
     * Handle attack event
     */
    handleAttackEvent(data) {
        const entry = {
            timestamp: new Date(),
            type: 'attack',
            damage: data.damage || 0,
            target: data.targetName || 'Unknown',
            skill: data.skillName,
            critical: data.critical || false
        };
        
        this.addCombatLogEntry(entry);
    }

    /**
     * Handle hit taken event
     */
    handleHitEvent(data) {
        const entry = {
            timestamp: new Date(),
            type: 'hit',
            damage: data.damage || 0,
            attacker: data.attackerName || 'Unknown',
            blocked: data.blocked || false,
            evaded: data.evaded || false
        };
        
        this.addCombatLogEntry(entry);
    }

    /**
     * Handle kill event
     */
    handleKillEvent(data) {
        const entry = {
            timestamp: new Date(),
            type: 'kill',
            target: data.targetName || 'Unknown',
            exp: data.expGained || 0,
            sp: data.spGained || 0
        };
        
        this.addCombatLogEntry(entry);
        this.isAttacking = false;
        this.updateAttackButton();
    }

    /**
     * Handle death event
     */
    handleDeathEvent(data) {
        const entry = {
            timestamp: new Date(),
            type: 'death',
            killer: data.killerName || 'Unknown'
        };
        
        this.addCombatLogEntry(entry);
        this.isAttacking = false;
        this.updateAttackButton();
    }

    /**
     * Add entry to combat log
     */
    addCombatLogEntry(entry) {
        this.combatLog.unshift(entry);
        
        // Trim log if too long
        if (this.combatLog.length > this.maxLogEntries) {
            this.combatLog = this.combatLog.slice(0, this.maxLogEntries);
        }
        
        // Update UI if combat tab is visible
        this.renderCombatLog();
    }

    /**
     * Render combat log to UI
     */
    renderCombatLog() {
        const container = document.getElementById('combat-log');
        if (!container) return;
        
        if (this.combatLog.length === 0) {
            container.innerHTML = '<p class="empty-message">No combat events yet</p>';
            return;
        }
        
        container.innerHTML = this.combatLog.map(entry => {
            const time = Formatters.time(entry.timestamp);
            let message = '';
            let cssClass = entry.type;
            
            switch (entry.type) {
                case 'attack':
                    const crit = entry.critical ? ' ⚔️ CRITICAL' : '';
                    const skill = entry.skill ? ` using ${entry.skill}` : '';
                    message = `You hit ${entry.target} for ${entry.damage} damage${skill}${crit}`;
                    break;
                case 'hit':
                    if (entry.evaded) {
                        message = `You evaded attack from ${entry.attacker}`;
                    } else if (entry.blocked) {
                        message = `You blocked ${entry.damage} damage from ${entry.attacker}`;
                    } else {
                        message = `You took ${entry.damage} damage from ${entry.attacker}`;
                    }
                    break;
                case 'kill':
                    const rewards = [];
                    if (entry.exp) rewards.push(`${entry.exp} EXP`);
                    if (entry.sp) rewards.push(`${entry.sp} SP`);
                    message = `You killed ${entry.target}${rewards.length ? ` (+${rewards.join(', ')})` : ''}`;
                    cssClass += ' kill';
                    break;
                case 'death':
                    message = `You died! Killer: ${entry.killer}`;
                    cssClass += ' death';
                    break;
            }
            
            return `
                <div class="combat-entry ${cssClass}">
                    <span class="combat-time">${time}</span>
                    <span class="combat-message">${this.escapeHtml(message)}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Update target UI
     */
    updateTargetUI() {
        const targetDetails = document.getElementById('target-details');
        const targetEmpty = document.querySelector('.target-empty');
        
        if (!this.currentTarget || !this.currentTarget.objectId) {
            if (targetEmpty) targetEmpty.classList.remove('hidden');
            if (targetDetails) targetDetails.classList.add('hidden');
            return;
        }
        
        if (targetEmpty) targetEmpty.classList.add('hidden');
        if (targetDetails) {
            targetDetails.classList.remove('hidden');
            
            // Update target info
            const nameEl = document.getElementById('target-name');
            const typeEl = document.getElementById('target-type');
            const levelEl = document.getElementById('target-level');
            const hpBar = document.getElementById('target-hp-bar');
            const hpValue = document.getElementById('target-hp-value');
            const distanceEl = document.getElementById('target-distance');
            
            if (nameEl) nameEl.textContent = this.currentTarget.name || 'Unknown';
            if (typeEl) typeEl.textContent = this.currentTarget.type || 'NPC';
            if (levelEl) levelEl.textContent = `Level ${this.currentTarget.level || '?'}`;
            
            if (this.currentTarget.hp && hpBar && hpValue) {
                const hpPercent = Formatters.percent(this.currentTarget.hp.current, this.currentTarget.hp.max);
                hpBar.value = hpPercent;
                hpValue.textContent = Formatters.stat(this.currentTarget.hp.current, this.currentTarget.hp.max);
            }
            
            if (distanceEl) {
                distanceEl.textContent = `Distance: ${Formatters.distance(this.currentTarget.distance)}`;
            }
        }
    }

    /**
     * Update attack button state
     */
    updateAttackButton() {
        const btnAttack = document.getElementById('btn-attack');
        if (btnAttack) {
            btnAttack.innerHTML = this.isAttacking 
                ? '<i data-lucide="square"></i> Stop'
                : '<i data-lucide="sword"></i> Attack';
            lucide.createIcons();
        }
    }

    /**
     * Toggle attack state
     */
    async toggleAttack() {
        try {
            if (this.isAttacking) {
                await apiClient.stopAttack();
                this.isAttacking = false;
                eventLog.addSystemMessage('Stopped attacking');
            } else {
                await apiClient.attack();
                this.isAttacking = true;
                eventLog.addSystemMessage('Started attacking');
            }
            this.updateAttackButton();
        } catch (error) {
            eventLog.addSystemMessage(`Attack error: ${error.message}`);
        }
    }

    /**
     * Use skill on target
     */
    async useSkill(skillId, level = 1) {
        try {
            await apiClient.useSkill(skillId, level, this.currentTarget?.objectId);
            eventLog.addSystemMessage(`Using skill ${skillId}`);
        } catch (error) {
            eventLog.addSystemMessage(`Skill error: ${error.message}`);
        }
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear combat log
     */
    clearLog() {
        this.combatLog = [];
        this.renderCombatLog();
    }
}

// Create global instance
const combatControls = new CombatControls();
