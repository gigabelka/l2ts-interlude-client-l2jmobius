/**
 * @fileoverview GameClient Patch - пример интеграции новой архитектуры в GameClient
 * 
 * Этот файл показывает, какие изменения нужно внести в существующий GameClient
 * для использования новой архитектуры обработки пакетов.
 * 
 * ПРИМЕНЕНИЕ:
 * 1. Скопируйте изменения из этого файла в src/game/GameClient.ts
 * 2. Закомментируйте или удалите старую обработку пакетов постепенно
 * 3. Тестируйте каждое изменение
 * 
 * @module infrastructure/integration
 */

// ============================================================================
// ИЗМЕНЕНИЕ 1: Добавить импорт адаптера
// ============================================================================
// В начало файла src/game/GameClient.ts добавить:

// import { GameClientAdapter, setGlobalAdapter } from '../infrastructure/integration/GameClientAdapter';

// ============================================================================
// ИЗМЕНЕНИЕ 2: Добавить поле адаптера в класс
// ============================================================================
// В класс GameClient добавить:

/*
export class GameClient extends Connection {
    private state: GameState = GameState.IDLE;
    private crypt: GameCrypt = new GameCrypt();
    private handler: GamePacketHandler = new GamePacketHandler();
    
    // НОВОЕ: Адаптер для новой архитектуры
    private newArchitectureAdapter?: GameClientAdapter;
    
    // НОВОЕ: Флаг для включения/выключения новой архитектуры
    private useNewArchitecture = process.env.USE_NEW_ARCHITECTURE === 'true';
    
    // ... остальной код
}
*/

// ============================================================================
// ИЗМЕНЕНИЕ 3: Инициализация адаптера в onConnect
// ============================================================================

/*
protected onConnect(): void {
    Logger.info('GameClient', 'Connected to Game Server');
    Logger.logState(this.state, GameState.WAIT_CRYPT_INIT);
    this.state = GameState.WAIT_CRYPT_INIT;
    
    // НОВОЕ: Инициализация адаптера новой архитектуры
    if (this.useNewArchitecture) {
        this.newArchitectureAdapter = new GameClientAdapter(this);
        this.newArchitectureAdapter.initialize();
        setGlobalAdapter(this.newArchitectureAdapter);
        Logger.info('GameClient', 'New architecture adapter initialized');
    }
    
    const pv = new ProtocolVersion();
    this.sendPacketRawBuffer(pv.encode());
}
*/

// ============================================================================
// ИЗМЕНЕНИЕ 4: Модификация onRawPacket
// ============================================================================

/*
protected onRawPacket(fullPacket: Buffer): void {
    const encryptedBody = fullPacket.subarray(2);
    const body = this.crypt.decrypt(encryptedBody);
    
    const opcode = body[0];
    Logger.logPacket('RECV', opcode, fullPacket);
    
    // НОВОЕ: Пробуем обработать через новую архитектуру
    if (this.useNewArchitecture && this.newArchitectureAdapter) {
        const result = this.newArchitectureAdapter.processPacket(opcode, body, this.state);
        
        if (result.handled) {
            // Пакет обработан новой системой
            this.handleNewArchitecturePacket(opcode, result.data);
            return;
        }
        
        // Пакет не обработан - используем старую систему
        Logger.debug('GameClient', 
            `Packet 0x${opcode.toString(16)} not handled by new architecture, using legacy`
        );
    }
    
    // СТАРАЯ ОБРАБОТКА (сохраняем для fallback)
    const packet = this.handler.handle(opcode, body, this.state);
    if (packet !== null) {
        this.handlePacket(packet, opcode);
    } else {
        Logger.warn('GameClient', `Unknown opcode=0x${opcode.toString(16)}`);
    }
}
*/

// ============================================================================
// ИЗМЕНЕНИЕ 5: Добавить метод handleNewArchitecturePacket
// ============================================================================

/*
/**
 * Обработка пакетов из новой архитектуры
 * Сюда попадают пакеты, успешно обработанные новой системой
 */
private handleNewArchitecturePacket(opcode: number, data: unknown): void {
    switch (this.state) {
        case GameState.WAIT_USER_INFO:
            if (opcode === 0x04) {
                // UserInfo обработан новой системой
                // Обновляем состояние
                Logger.info('GameClient', 'ENTERED GAME WORLD (via new architecture)');
                Logger.logState(this.state, GameState.IN_GAME);
                this.state = GameState.IN_GAME;
                
                // Запрашиваем инвентарь
                this.sendPacket(new RequestInventoryOpen());
            }
            break;
            
        case GameState.IN_GAME:
            // Дополнительная обработка для специфических пакетов
            if (opcode === 0xD3) {
                // Ping
                const pingData = data as { pingId: number };
                this.sendPacketRawBuffer(Buffer.from([0xA8, pingData.pingId]));
            }
            break;
    }
}
*/

// ============================================================================
// ИЗМЕНЕНИЕ 6: Модификация onClose для очистки
// ============================================================================

/*
protected onClose(): void {
    Logger.info('GameClient', '*** GAME SERVER CONNECTION CLOSED ***');
    
    // НОВОЕ: Очистка адаптера
    if (this.newArchitectureAdapter) {
        this.newArchitectureAdapter.reset();
        this.newArchitectureAdapter = undefined;
    }
    
    // Остальная очистка...
    GameCommandManager.setGameClient(null);
    GameStateStore.clearSkills();
    GameStateStore.clearInventory();
}
*/

// ============================================================================
// ИЗМЕНЕНИЕ 7: Добавить метод для получения статистики
// ============================================================================

/*
/**
 * Получить статистику новой архитектуры
 */
getNewArchitectureStats(): object | undefined {
    if (this.newArchitectureAdapter) {
        return this.newArchitectureAdapter.getStats();
    }
    return undefined;
}

/**
 * Проверить, используется ли новая архитектура
 */
isUsingNewArchitecture(): boolean {
    return this.useNewArchitecture;
}

/**
 * Включить/выключить новую архитектуру (только для следующего подключения)
 */
setUseNewArchitecture(use: boolean): void {
    this.useNewArchitecture = use;
}
*/

// ============================================================================
// БЫСТРЫЙ СТАРТ - минимальные изменения
// ============================================================================

/**
 * МИНИМАЛЬНАЯ ИНТЕГРАЦИЯ (только добавить этот код в существующий handlePacket):
 * 
 * В метод handlePacket добавить в начало:
 * 
 * private handlePacket(packet: IncomingGamePacket, opcode: number): void {
 *     // Проверяем, обработан ли пакет новой системой
 *     if (this.newArchitectureAdapter?.isOpcodeSupported(opcode)) {
 *         Logger.debug('GameClient', `Packet 0x${opcode.toString(16)} handled by new architecture`);
 *         // Пакет уже обработан в onRawPacket, здесь только проверяем состояние
 *         if (opcode === 0x04 && this.state === GameState.WAIT_USER_INFO) {
 *             // UserInfo - вход в игру
 *             Logger.logState(this.state, GameState.IN_GAME);
 *             this.state = GameState.IN_GAME;
 *             this.sendPacket(new RequestInventoryOpen());
 *         }
 *         return;
 *     }
 *     
 *     // ... существующий код handlePacket
 * }
 */

// ============================================================================
// ПОЛНАЯ ЗАМЕНА handlePacket
// ============================================================================

/**
 * ПОЛНАЯ ЗАМЕНА - когда все пакеты мигрированы:
 * 
 * Заменить весь handlePacket на:
 * 
 * private handlePacket(opcode: number): void {
 *     // Вся логика теперь в стратегиях новой архитектуры
 *     // Здесь только управление состояниями FSM
 *     
 *     switch (this.state) {
 *         case GameState.WAIT_CRYPT_INIT:
 *             if (opcode === 0x00 || opcode === 0x2D) {
 *                 // Обработано в CryptInitHandler
 *                 this.sendPacket(new AuthRequest(this.session, CONFIG.Username));
 *                 this.state = GameState.WAIT_CHAR_LIST;
 *             }
 *             break;
 *             
 *         case GameState.WAIT_CHAR_LIST:
 *             if (opcode === 0x04 || opcode === 0x13 || opcode === 0x2C) {
 *                 // CharSelectInfo обработан в стратегии
 *                 this.sendPacket(new CharacterSelected(CONFIG.CharSlotIndex));
 *                 this.state = GameState.WAIT_CHAR_SELECTED;
 *             }
 *             break;
 *             
 *         // ... и так далее
 *     }
 * }
 */
