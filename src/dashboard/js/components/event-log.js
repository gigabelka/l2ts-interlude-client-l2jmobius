/**
 * Event Log Component - Displays WebSocket events
 */

class EventLog {
    constructor() {
        this.container = document.getElementById('event-log');
        this.filterSelect = document.getElementById('event-filter');
        this.clearButton = document.getElementById('clear-events');
        this.maxEvents = 500;
        this.events = [];
        this.currentFilter = 'all';
        
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Filter change
        if (this.filterSelect) {
            this.filterSelect.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                this.render();
            });
        }
        
        // Clear button
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.clear();
            });
        }

        // WebSocket event listeners
        wsClient.addEventListener('message', (e) => {
            this.addEvent(e.detail);
        });

        // Specific channel events
        ['system', 'character', 'combat', 'chat', 'world'].forEach(channel => {
            wsClient.addEventListener(`channel:${channel}`, (e) => {
                this.addEvent(e.detail);
            });
        });
    }

    /**
     * Add event to log
     */
    addEvent(event) {
        const eventData = {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            type: event.type || 'unknown',
            channel: event.channel || 'system',
            data: event.data || event,
            raw: event
        };

        // Format message based on event type
        eventData.message = this.formatMessage(eventData);

        // Add to array
        this.events.push(eventData);

        // Trim if exceeds max
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Render if passes filter
        if (this.shouldShow(eventData)) {
            this.renderEvent(eventData);
            this.scrollToBottom();
        }
    }

    /**
     * Format event message
     */
    formatMessage(event) {
        const { type, data } = event;
        
        // System events
        if (type === 'system.connected') {
            return `Connected to game world. Phase: ${data?.phase || 'unknown'}`;
        }
        if (type === 'system.disconnected') {
            return `Disconnected. Reason: ${data?.reason || 'unknown'}`;
        }
        if (type === 'system.error') {
            return `Error: ${data?.message || 'unknown error'}`;
        }

        // Character events
        if (type === 'character.stats_changed') {
            const changes = [];
            if (data?.hp?.delta) changes.push(`HP: ${data.hp.delta > 0 ? '+' : ''}${data.hp.delta}`);
            if (data?.mp?.delta) changes.push(`MP: ${data.mp.delta > 0 ? '+' : ''}${data.mp.delta}`);
            return changes.join(', ') || 'Stats changed';
        }
        if (type === 'character.level_up') {
            return `Level up! ${data?.oldLevel} → ${data?.newLevel}`;
        }
        if (type === 'character.buff_added') {
            return `Buff: ${data?.name || 'Unknown'} (${data?.duration}s)`;
        }
        if (type === 'character.buff_removed') {
            return `Buff expired: ${data?.name || 'Unknown'}`;
        }
        if (type === 'character.died') {
            return `Died! Killer: ${data?.killerName || 'Unknown'}`;
        }
        if (type === 'character.revived') {
            return `Revived at ${data?.position?.x}, ${data?.position?.y}`;
        }

        // Combat events
        if (type === 'combat.attack') {
            return `Attack: ${data?.damage || 0} damage to ${data?.targetName || 'target'}`;
        }
        if (type === 'combat.hit') {
            return `Hit by ${data?.attackerName || 'unknown'} for ${data?.damage || 0}`;
        }
        if (type === 'combat.kill') {
            return `Killed: ${data?.targetName || 'target'}`;
        }
        if (type === 'combat.death') {
            return `Died to ${data?.killerName || 'unknown'}`;
        }

        // Chat events
        if (type === 'chat.message') {
            return `[${data?.channel || 'ALL'}] ${data?.sender || 'Unknown'}: ${data?.message || ''}`;
        }

        // World events
        if (type === 'world.npc_spawn') {
            return `NPC spawned: ${data?.name || 'Unknown'} (${data?.npcId || '?'})`;
        }
        if (type === 'world.npc_despawn') {
            return `NPC despawned: ${data?.name || 'Unknown'}`;
        }
        if (type === 'world.item_spawn') {
            return `Item dropped: ${data?.itemName || 'Unknown'}`;
        }

        // Default
        return `${type}: ${JSON.stringify(data).slice(0, 100)}`;
    }

    /**
     * Check if event should be shown based on filter
     */
    shouldShow(event) {
        if (this.currentFilter === 'all') return true;
        return event.channel === this.currentFilter;
    }

    /**
     * Render single event
     */
    renderEvent(event) {
        if (!this.container) return;

        const eventEl = document.createElement('div');
        eventEl.className = `event-item ${event.channel}`;
        eventEl.dataset.eventId = event.id;
        
        eventEl.innerHTML = `
            <span class="event-time">${Formatters.time(event.timestamp)}</span>
            <span class="event-channel">[${event.channel}]</span>
            <span class="event-message">${this.escapeHtml(event.message)}</span>
        `;

        this.container.appendChild(eventEl);

        // Remove old events from DOM if too many
        while (this.container.children.length > 100) {
            this.container.removeChild(this.container.firstChild);
        }
    }

    /**
     * Render all events (used when filter changes)
     */
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        const filteredEvents = this.events.filter(e => this.shouldShow(e));
        const eventsToShow = filteredEvents.slice(-100); // Show last 100
        
        eventsToShow.forEach(event => {
            this.renderEvent(event);
        });
        
        this.scrollToBottom();
    }

    /**
     * Scroll to bottom of log
     */
    scrollToBottom() {
        if (this.container) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }

    /**
     * Clear all events
     */
    clear() {
        this.events = [];
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.addSystemMessage('Event log cleared');
    }

    /**
     * Add system message
     */
    addSystemMessage(message) {
        this.addEvent({
            type: 'system.message',
            channel: 'system',
            data: { message }
        });
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const eventLog = new EventLog();
