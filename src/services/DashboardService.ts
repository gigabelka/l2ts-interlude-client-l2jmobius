/**
 * src/services/DashboardService.ts
 * Сервис дашборда для отображения инвентаря и экипировки
 * Выводит красивое форматирование в консоль (имитация UI)
 */

import type { IItem, IEquipment } from '../models/IEquipment';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../data/slotMasks';

/**
 * Опции отображения дашборда
 */
export interface DashboardOptions {
    /** Показывать ли заголовок */
    showHeader?: boolean;

    /** Ширина таблицы */
    width?: number;

    /** Показывать пустые слоты экипировки */
    showEmptySlots?: boolean;

    /** Цветной вывод */
    colored?: boolean;
}

/**
 * ANSI цвета для терминала
 */
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',

    // Цвета текста
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    // Фон
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
} as const;

/**
 * Символы для рисования рамок
 */
const BORDERS = {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    leftT: '╠',
    rightT: '╣',
} as const;

/**
 * Сервис дашборда для отображения инвентаря и экипировки
 */
export class DashboardService {
    private options: Required<DashboardOptions>;
    private currentInventory: IItem[] = [];
    private currentEquipment: IEquipment = {};

    constructor(options: DashboardOptions = {}) {
        this.options = {
            showHeader: options.showHeader ?? true,
            width: options.width ?? 60,
            showEmptySlots: options.showEmptySlots ?? true,
            colored: options.colored ?? true,
        };
    }

    /**
     * Применяет цвет к тексту если включен colored режим
     */
    private color(color: keyof typeof COLORS, text: string): string {
        if (!this.options.colored) return text;
        return `${COLORS[color]}${text}${COLORS.reset}`;
    }

    /**
     * Рисует горизонтальную линию
     */
    private drawLine(left: string, right: string, fill: string = BORDERS.horizontal): string {
        return left + fill.repeat(this.options.width - 2) + right;
    }

    /**
     * Центрирует текст в рамке
     */
    private center(text: string, padChar: string = ' '): string {
        const innerWidth = this.options.width - 4; // -2 для бордеров -2 для пробелов
        const padded = text.padStart((innerWidth + text.length) / 2, padChar);
        return `${BORDERS.vertical} ${padded.padEnd(innerWidth, padChar)} ${BORDERS.vertical}`;
    }

    /**
     * Форматирует строку с данными
     */
    private formatRow(label: string, value: string): string {
        const innerWidth = this.options.width - 4;
        const labelStr = `${label}:`.padEnd(20, ' ');
        const valueStr = value.padEnd(innerWidth - 20, ' ');
        return `${BORDERS.vertical} ${this.color('bright', labelStr)}${valueStr} ${BORDERS.vertical}`;
    }

    /**
     * Форматирует слот экипировки
     */
    private formatSlot(slot: EquipmentSlot, item: IItem | undefined): string {
        const innerWidth = this.options.width - 4;

        if (!item) {
            if (!this.options.showEmptySlots) return '';
            const slotName = `[${slot}]`.padEnd(12, ' ');
            return `${BORDERS.vertical} ${this.color('dim', slotName)}${this.color('dim', '(пусто)')} ${''.padEnd(innerWidth - 20, ' ')}${BORDERS.vertical}`;
        }

        const slotName = `[${slot}]`.padEnd(12, ' ');
        const enchantStr = item.enchantLevel > 0
            ? this.color('yellow', `(+${item.enchantLevel})`)
            : '';
        const itemStr = `ItemID: ${this.color('cyan', String(item.itemId))} ${enchantStr}`;

        return `${BORDERS.vertical} ${this.color('green', slotName)}${itemStr}${''.padEnd(innerWidth - 12 - itemStr.length + (item.enchantLevel > 0 ? 0 : 11), ' ')} ${BORDERS.vertical}`;
    }

    /**
     * Рисует заголовок секции
     */
    private drawSection(title: string): string {
        const lines: string[] = [];
        lines.push(this.drawLine(BORDERS.leftT, BORDERS.rightT));
        lines.push(this.center(title));
        lines.push(this.drawLine(BORDERS.leftT, BORDERS.rightT));
        return lines.join('\n');
    }

    /**
     * Обновляет данные инвентаря
     */
    public onInventoryUpdated(items: IItem[]): void {
        this.currentInventory = items;
        this.render();
    }

    /**
     * Обновляет данные экипировки
     */
    public onEquipmentUpdated(equipment: IEquipment): void {
        this.currentEquipment = equipment;
        this.render();
    }

    /**
     * Подписывается на события от эмиттера
     * @param emitter - объект EventEmitter или аналог
     */
    public subscribe(emitter: {
        on(event: 'inventory:updated', handler: (items: IItem[]) => void): void;
        on(event: 'equipment:updated', handler: (equipment: IEquipment) => void): void;
    }): void {
        emitter.on('inventory:updated', (items) => this.onInventoryUpdated(items));
        emitter.on('equipment:updated', (equipment) => this.onEquipmentUpdated(equipment));
    }

    /**
     * Рендерит полный дашборд в консоль
     */
    public render(): void {
        const lines: string[] = [];

        // Верхняя рамка
        lines.push(this.color('blue', this.drawLine(BORDERS.topLeft, BORDERS.topRight)));

        // Заголовок
        if (this.options.showHeader) {
            lines.push(this.color('bright', this.center('📦 ИНВЕНТАРЬ ПЕРСОНАЖА')));
            lines.push(this.color('blue', this.drawLine(BORDERS.leftT, BORDERS.rightT)));
        }

        // Общая информация
        const totalItems = this.currentInventory.length;
        const equippedItems = Object.keys(this.currentEquipment).length;
        const nonEquippedItems = totalItems - equippedItems;

        lines.push(this.formatRow('Всего предметов', String(totalItems)));
        lines.push(this.formatRow('Экипировано', this.color('green', String(equippedItems))));
        lines.push(this.formatRow('В инвентаре', String(nonEquippedItems)));

        // Разделитель
        lines.push(this.color('blue', this.drawLine(BORDERS.leftT, BORDERS.rightT)));

        // Экипировка
        lines.push(this.center('🛡️ ЭКИПИРОВКА'));
        lines.push(this.color('blue', this.drawLine(BORDERS.leftT, BORDERS.rightT)));

        // Слоты экипировки
        for (const slot of EQUIPMENT_SLOTS) {
            const line = this.formatSlot(slot, this.currentEquipment[slot]);
            if (line) lines.push(line);
        }

        // Нижняя рамка
        lines.push(this.color('blue', this.drawLine(BORDERS.bottomLeft, BORDERS.bottomRight)));

        // Выводим в консоль
        console.clear();
        console.log(lines.join('\n'));
    }

    /**
     * Быстрый вывод информации (без очистки экрана)
     */
    public printSummary(): void {
        console.log('\n' + this.color('bright', '=== 📦 ИНВЕНТАРЬ ==='));
        console.log(`Всего предметов: ${this.currentInventory.length}`);
        console.log(this.color('bright', '\n🛡️ Экипировка:'));

        let equippedCount = 0;
        for (const slot of EQUIPMENT_SLOTS) {
            const item = this.currentEquipment[slot];
            if (item) {
                const enchantStr = item.enchantLevel > 0 ? ` (+${item.enchantLevel})` : '';
                console.log(`  [${slot}] ItemID: ${item.itemId}${enchantStr}`);
                equippedCount++;
            }
        }

        if (equippedCount === 0) {
            console.log(this.color('dim', '  (экипировка отсутствует)'));
        }

        console.log('');
    }

    /**
     * Получает текущие данные инвентаря
     */
    public getInventory(): IItem[] {
        return [...this.currentInventory];
    }

    /**
     * Получает текущую экипировку
     */
    public getEquipment(): IEquipment {
        return { ...this.currentEquipment };
    }
}

/**
 * Создает и настраивает DashboardService с подпиской на события
 * @param emitter - эмиттер событий
 * @param options - опции дашборда
 */
export function createDashboard(
    emitter: {
        on(event: 'inventory:updated', handler: (items: IItem[]) => void): void;
        on(event: 'equipment:updated', handler: (equipment: IEquipment) => void): void;
    },
    options?: DashboardOptions,
): DashboardService {
    const dashboard = new DashboardService(options);
    dashboard.subscribe(emitter);
    return dashboard;
}
