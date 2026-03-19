# CLAUDE_REFACTOR.md

Рекомендации по рефакторингу для улучшения архитектуры и кодовой базы проекта L2 Headless Client.

## 🎯 Приоритизация рефакторинга

**Высокий приоритет** - критичные проблемы архитектуры
**Средний приоритет** - улучшения качества кода
**Низкий приоритет** - оптимизации и удобство

---

## 🏗️ Архитектурные проблемы

### 1. **[ВЫСОКИЙ]** Дуальность архитектур

**Проблема:**
- Сосуществуют старая (`GameClient`) и новая (`GameClientNew`) архитектуры
- Код разбросан между `core/` (legacy) и чистой архитектурой
- Неясно, какую систему использовать для новых фич

**Решение:**
```typescript
// Создать миграционную стратегию
interface ArchitectureMigrationPlan {
  phase1: "Завершить новую архитектуру";
  phase2: "Мигрировать старый код";
  phase3: "Удалить legacy код";
}
```

**Действия:**
1. Завершить реализацию Clean Architecture во всех слоях
2. Создать адаптеры для старого кода
3. Поэтапно мигрировать функциональность
4. Удалить `core/GameStateStore.ts` и другие legacy компоненты

### 2. **[ВЫСОКИЙ]** Проблемы с Dependency Injection

**Проблема:**
- Примитивная реализация DI контейнера
- Нет lifecycle management
- Отсутствует проверка циклических зависимостей
- Singleton instance в репозиториях нарушает DI принципы

**Текущий код:**
```typescript
// ❌ Плохо - singleton в репозитории
export const characterRepository = new InMemoryCharacterRepository();

// ❌ Плохо - глобальный доступ к контейнеру
const container = getContainer();
```

**Улучшенное решение:**
```typescript
// ✅ Хорошо - полноценный DI контейнер
interface IDependencyContainer {
  registerSingleton<T>(token: string, factory: () => T): void;
  registerTransient<T>(token: string, factory: () => T): void;
  registerScoped<T>(token: string, factory: () => T): void;
  resolve<T>(token: string): T;
  createScope(): IDependencyScope;
  dispose(): Promise<void>;
}

// ✅ Lifecycle management
interface IDisposable {
  dispose(): Promise<void>;
}

// ✅ Проверка циклических зависимостей
class CircularDependencyError extends Error {
  constructor(path: string[]) {
    super(`Circular dependency detected: ${path.join(' -> ')}`);
  }
}
```

**Действия:**
1. Заменить простой контейнер на полноценный (например, InversifyJS или TypeDI)
2. Добавить lifecycle management для ресурсов
3. Убрать все singleton экспорты из репозиториев
4. Внедрить scoped dependencies для HTTP requests

### 3. **[СРЕДНИЙ]** Смешение типов событий

**Проблема:**
```typescript
// ❌ Плохо - смешение domain и infrastructure событий
this.deps.eventBus.publish({
    type: 'system.raw_packet',  // Infrastructure event
    channel: 'system',
    payload: { opcode, length },
    timestamp: new Date(),
});

this.deps.eventBus.publish(new CharacterEnteredGameEvent({  // Domain event
    objectId: char.id,
    name: char.name,
}));
```

**Решение:**
```typescript
// ✅ Хорошо - разделение на отдельные шины
interface IDomainEventBus {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(handler: DomainEventHandler<T>): Subscription;
}

interface ISystemEventBus {
  publish<T extends SystemEvent>(event: T): void;
  subscribe<T extends SystemEvent>(handler: SystemEventHandler<T>): Subscription;
}

// Domain события - асинхронные, с гарантией доставки
class CharacterEnteredGameEvent extends DomainEvent {
  constructor(public readonly data: CharacterData) {
    super('character.entered-game', data);
  }
}

// System события - синхронные, для мониторинга
interface RawPacketSystemEvent extends SystemEvent {
  type: 'system.raw_packet';
  data: { opcode: number; length: number };
}
```

---

## 🔧 Проблемы реализации

### 4. **[ВЫСОКИЙ]** Неэффективное клонирование объектов

**Проблема:**
```typescript
// ❌ Дорогое клонирование в каждом вызове
get(): Character | null {
    return this.character ? this.cloneCharacter(this.character) : null;
}

private cloneCharacter(character: Character): Character {
    return character.clone(); // Потенциально дорогая операция
}
```

**Решение:**
```typescript
// ✅ Immutable объекты с structural sharing
interface ICharacter {
  readonly id: ObjectId;
  readonly name: string;
  readonly position: Position;

  // Методы возвращают новые immutable объекты
  withPosition(position: Position): ICharacter;
  withVitals(vitals: Vitals): ICharacter;
}

// ✅ Copy-on-write semantics
class Character implements ICharacter {
  private _snapshot: CharacterSnapshot | null = null;

  get snapshot(): CharacterSnapshot {
    if (!this._snapshot) {
      this._snapshot = this.createSnapshot();
    }
    return this._snapshot;
  }

  withPosition(position: Position): Character {
    if (this.position.equals(position)) return this;

    const newCharacter = new Character(this.data);
    newCharacter.data.position = position;
    newCharacter._snapshot = null; // Invalidate cache
    return newCharacter;
  }
}
```

### 5. **[СРЕДНИЙ]** Отсутствие валидации конфигурации

**Проблема:**
```typescript
// ❌ Нет валидации, runtime ошибки
export const CONFIG = {
  Username: process.env["L2_USERNAME"] || "qwerty",
  LoginPort: parseInt(process.env["L2_LOGIN_PORT"] || "2106", 10),
};
```

**Решение:**
```typescript
// ✅ Валидация с помощью Zod
import { z } from 'zod';

const ConfigSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  loginIp: z.string().ip("Invalid IP address"),
  loginPort: z.number().int().min(1).max(65535, "Invalid port"),
  gamePort: z.number().int().min(1).max(65535, "Invalid port"),
  serverId: z.number().int().min(1, "Server ID must be positive"),
  charSlot: z.number().int().min(0).max(7, "Character slot must be 0-7"),
});

type Config = z.infer<typeof ConfigSchema>;

// Валидация на старте приложения
export const CONFIG: Config = ConfigSchema.parse({
  username: process.env.L2_USERNAME,
  password: process.env.L2_PASSWORD,
  loginIp: process.env.L2_LOGIN_IP || "127.0.0.1",
  loginPort: parseInt(process.env.L2_LOGIN_PORT || "2106", 10),
  gamePort: parseInt(process.env.L2_GAME_PORT || "7777", 10),
  serverId: parseInt(process.env.L2_SERVER_ID || "1", 10),
  charSlot: parseInt(process.env.L2_CHAR_SLOT || "0", 10),
});
```

### 6. **[СРЕДНИЙ]** Непоследовательная обработка ошибок

**Проблема:**
```typescript
// ❌ Смешение подходов к обработке ошибок
try {
  const result = await someOperation();
  return result;
} catch (error) {
  Logger.error('Error', error.message);
  return null; // Теряем информацию об ошибке
}

// В другом месте:
const result = this.repository.get();
if (!result.success) {
  // Result pattern
}
```

**Решение:**
```typescript
// ✅ Последовательное использование Result pattern
type Result<T, E = Error> = Success<T> | Failure<E>;

interface Success<T> {
  readonly success: true;
  readonly data: T;
}

interface Failure<E> {
  readonly success: false;
  readonly error: E;
}

// Все операции возвращают Result
class CharacterService {
  async moveCharacter(position: Position): Promise<Result<void, MovementError>> {
    const validationResult = this.validatePosition(position);
    if (!validationResult.success) {
      return Result.failure(validationResult.error);
    }

    const moveResult = await this.gameClient.move(position);
    return moveResult.mapError(error => new MovementError(error.message));
  }
}

// Централизованная обработка ошибок в API
app.use((req, res, next) => {
  const result = await handler(req);
  if (result.success) {
    res.json({ success: true, data: result.data });
  } else {
    const error = ErrorMapper.toApiError(result.error);
    res.status(error.status).json({ success: false, error });
  }
});
```

---

## 🚀 Проблемы производительности

### 7. **[СРЕДНИЙ]** Отсутствие кэширования

**Проблема:**
```typescript
// ❌ Каждый раз парсим данные заново
export function getItemById(id: number): Item | undefined {
  const data = JSON.parse(fs.readFileSync('items.json', 'utf8'));
  return data.items.find(item => item.id === id);
}
```

**Решение:**
```typescript
// ✅ Кэширование с автообновлением
interface ICacheManager {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  flush(): Promise<void>;
}

class GameDataService {
  constructor(
    private cache: ICacheManager,
    private dataLoader: IDataLoader
  ) {}

  async getItem(id: number): Promise<Item | undefined> {
    const cacheKey = `item:${id}`;
    let item = await this.cache.get<Item>(cacheKey);

    if (!item) {
      const items = await this.getAllItems();
      item = items.find(i => i.id === id);

      if (item) {
        await this.cache.set(cacheKey, item, 300); // 5 min TTL
      }
    }

    return item;
  }

  private async getAllItems(): Promise<Item[]> {
    return this.cache.getOrSet('all_items',
      () => this.dataLoader.loadItems(),
      3600 // 1 hour TTL
    );
  }
}
```

### 8. **[НИЗКИЙ]** Неэффективная сериализация пакетов

**Проблема:**
```typescript
// ❌ Создание новых буферов каждый раз
private sendPacketRawBuffer(buffer: Buffer): void {
    const totalLen = buffer.length + 2;
    const out = Buffer.allocUnsafe(totalLen); // Каждый раз new allocation
    out.writeUInt16LE(totalLen, 0);
    buffer.copy(out, 2);
    this.sendRaw(out);
}
```

**Решение:**
```typescript
// ✅ Buffer pooling и reuse
class PacketSerializer {
  private readonly bufferPool = new BufferPool(1024, 10); // 10 buffers of 1KB each

  serialize(packet: OutgoingPacket): Buffer {
    const bodySize = packet.getSerializedSize();
    const totalSize = bodySize + 2;

    // Reuse buffer from pool
    const buffer = this.bufferPool.acquire(totalSize);
    buffer.writeUInt16LE(totalSize, 0);
    packet.serialize(buffer, 2);

    // Buffer will be returned to pool after send
    return buffer;
  }
}

// ✅ Object pooling для часто создаваемых объектов
class PacketPool<T> {
  private readonly pool: T[] = [];

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number = 10
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  acquire(): T {
    const obj = this.pool.pop() || this.factory();
    return obj;
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }
}
```

---

## 🧪 Проблемы тестирования

### 9. **[ВЫСОКИЙ]** Сложность unit-тестирования

**Проблема:**
```typescript
// ❌ Тяжело тестировать из-за глобальных зависимостей
export class GameClientNew extends Connection {
  constructor(session: SessionData, deps: GameClientDependencies) {
    super(); // Наследование затрудняет тестирование
    this.deps = deps;
  }

  start(): void {
    // Много side effects, сложно изолировать
    this.connect(this.session.gameServerIp, this.session.gameServerPort);
  }
}
```

**Решение:**
```typescript
// ✅ Композиция вместо наследования
interface INetworkConnection {
  connect(host: string, port: number): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Buffer): Promise<void>;
  onReceive: (callback: (data: Buffer) => void) => void;
}

class GameClient {
  constructor(
    private connection: INetworkConnection,
    private packetProcessor: IPacketProcessor,
    private eventBus: IEventBus
  ) {}

  async connect(host: string, port: number): Promise<Result<void, ConnectionError>> {
    try {
      await this.connection.connect(host, port);
      this.setupPacketHandling();
      return Result.success();
    } catch (error) {
      return Result.failure(new ConnectionError(error.message));
    }
  }
}

// ✅ Легкое тестирование с моками
describe('GameClient', () => {
  let gameClient: GameClient;
  let mockConnection: jest.Mocked<INetworkConnection>;
  let mockEventBus: jest.Mocked<IEventBus>;

  beforeEach(() => {
    mockConnection = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
      onReceive: jest.fn(),
    };

    mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    gameClient = new GameClient(mockConnection, mockPacketProcessor, mockEventBus);
  });

  it('should connect successfully', async () => {
    const result = await gameClient.connect('localhost', 7777);

    expect(result.success).toBe(true);
    expect(mockConnection.connect).toHaveBeenCalledWith('localhost', 7777);
  });
});
```

### 10. **[СРЕДНИЙ]** Отсутствие integration тестов

**Решение:**
```typescript
// ✅ Integration testing setup
class TestGameServer {
  private server: net.Server;
  private connections: net.Socket[] = [];

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = net.createServer(this.handleConnection.bind(this));
      this.server.listen(port, resolve);
    });
  }

  // Эмулирует поведение L2J сервера
  private handleConnection(socket: net.Socket): void {
    this.connections.push(socket);

    // Отправляем Init пакет
    socket.write(this.createInitPacket());

    socket.on('data', this.handlePacket.bind(this, socket));
  }
}

// Integration тесты
describe('Game Client Integration', () => {
  let testServer: TestGameServer;
  let gameClient: GameClient;

  beforeAll(async () => {
    testServer = new TestGameServer();
    await testServer.start(17777);
  });

  afterAll(async () => {
    await testServer.stop();
  });

  it('should complete full login flow', async () => {
    const result = await gameClient.connect('127.0.0.1', 17777);
    expect(result.success).toBe(true);

    // Проверяем получение характера
    await waitFor(() => {
      const character = characterRepo.get();
      expect(character).not.toBeNull();
      expect(character.name).toBe('TestChar');
    });
  });
});
```

---

## 📋 План рефакторинга по приоритетам

### Фаза 1 (Высокий приоритет)
1. **Завершить миграцию на Clean Architecture**
   - Убрать дуальность GameClient/GameClientNew
   - Удалить legacy код в `core/`

2. **Заменить DI контейнер**
   - Внедрить полноценный IoC (InversifyJS/TypeDI)
   - Добавить lifecycle management

3. **Исправить клонирование объектов**
   - Внедрить immutable объекты
   - Добавить copy-on-write semantics

### Фаза 2 (Средний приоритет)
1. **Разделить системы событий**
   - Domain events vs System events
   - Асинхронная обработка domain событий

2. **Добавить валидацию конфигурации**
   - Zod схемы для всех конфигов
   - Fail-fast при неправильной конфигурации

3. **Унифицировать обработку ошибок**
   - Result pattern везде
   - Централизованный error mapping

### Фаза 3 (Низкий приоритет)
1. **Оптимизации производительности**
   - Buffer pooling
   - Object pooling
   - Caching layer

2. **Улучшение тестируемости**
   - Композиция вместо наследования
   - Comprehensive test suite

---

## 🎯 Метрики успеха

После рефакторинга должны улучшиться:

- **Тестопокрытие**: с ~20% до >80%
- **Время билда**: уменьшение на 30%
- **Memory usage**: уменьшение на 40% за счет pooling
- **Code complexity**: снижение цикломатической сложности
- **Developer experience**: быстрее onboarding новых разработчиков

---

## 🔗 Полезные ресурсы

- [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [TypeScript Domain-Driven Design](https://khalilstemmler.com/articles/domain-driven-design-intro/)
- [Functional Error Handling in TypeScript](https://dev.to/supermacro/functional-error-handling-in-typescript-4md7)
- [Node.js Buffer Pool Best Practices](https://nodejs.org/api/buffer.html#buffer_class_bufferpool)

---

## 📋 ПОШАГОВЫЙ ПЛАН ВЫПОЛНЕНИЯ

Детальный план рефакторинга с готовыми промтами для AI-ассистента Kimi 2.5. Каждый шаг является атомарным и может выполняться независимо в рамках своей фазы.

### **ФАЗА 1: КРИТИЧЕСКИЕ ПРОБЛЕМЫ АРХИТЕКТУРЫ**

Цель: Устранить архитектурные проблемы, блокирующие дальнейшее развитие.

#### **ШАГ 1.1: Устранение Singleton Exports в репозиториях**

**Проблема:** Нарушение DI принципов через singleton exports в файлах репозиториев (строка 91 в InMemoryCharacterRepository.ts и аналогично в других).

**Промт для Kimi 2.5:**

```
Задача: Устранить singleton exports в репозиториях, нарушающие DI принципы

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/infrastructure/persistence/InMemoryCharacterRepository.ts (строка 91)
2. src/infrastructure/persistence/InMemoryWorldRepository.ts (строка 168)
3. src/infrastructure/persistence/InMemoryInventoryRepository.ts (строка 157)
4. src/infrastructure/persistence/InMemoryConnectionRepository.ts (строка 71)
5. src/infrastructure/event-bus/SimpleEventBus.ts (строка 102)

ДЕЙСТВИЯ:
1. В КАЖДОМ файле УДАЛИТЬ последние строки с export const:
   - УДАЛИТЬ: `export const characterRepository = new InMemoryCharacterRepository();`
   - УДАЛИТЬ: `export const worldRepository = new InMemoryWorldRepository();`
   - УДАЛИТЬ: `export const inventoryRepository = new InMemoryInventoryRepository();`
   - УДАЛИТЬ: `export const connectionRepository = new InMemoryConnectionRepository();`
   - УДАЛИТЬ: `export const eventBus = new SimpleEventBus();`

2. Добавить в конец каждого файла комментарий:
   ```typescript
   // Singleton exports удалены - используйте DI контейнер для получения инстансов
   // Пример: container.resolve<ICharacterRepository>(DI_TOKENS.CharacterRepository)
   ```

3. Найти ВСЕ импорты этих singleton exports в проекте и заменить на DI:
   - Найти: `import { characterRepository } from`
   - Заменить на: использование DI контейнера

КРИТЕРИИ ПРОВЕРКИ:
- Нет ни одного `export const repository = new` в файлах репозиториев
- Все импорты singleton exports заменены на DI resolve
- Проект компилируется без ошибок TypeScript
```

#### **ШАГ 1.2: Оптимизация дорогого клонирования объектов**

**Проблема:** Дорогое клонирование в Character.clone() (строки 388-393) и репозиториях при каждом вызове get().

**Промт для Kimi 2.5:**

```
Задача: Оптимизировать дорогое клонирование Character объектов через copy-on-write подход

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/domain/entities/Character.ts (строки 388-393)
2. src/infrastructure/persistence/InMemoryCharacterRepository.ts (строки 28, 41, 83-85)

ДЕЙСТВИЯ:

1. В Character.ts добавить copy-on-write механизм:
   ```typescript
   // После строки 67 добавить:
   private _snapshot: CharacterJSON | null = null;

   // Заменить метод clone() (строки 388-393):
   clone(): Character {
       // Copy-on-write: используем snapshot для быстрого клонирования
       if (!this._snapshot) {
           this._snapshot = this.toJSON();
       }

       const cloned = Character.fromPacketData(this._snapshot.objectId, this._snapshot);
       cloned.uncommittedEvents = [...this.uncommittedEvents];
       return cloned;
   }

   // Добавить метод для invalidation snapshot:
   private invalidateSnapshot(): void {
       this._snapshot = null;
   }
   ```

2. В Character.ts в КАЖДОМ методе изменения данных добавить invalidateSnapshot():
   - В updatePosition() после строки 155: `this.invalidateSnapshot();`
   - В updateHp() после строки 170: `this.invalidateSnapshot();`
   - В updateMp() после строки 184: `this.invalidateSnapshot();`
   - В updateCp() после строки 198: `this.invalidateSnapshot();`
   - В setTarget() после строки 212: `this.invalidateSnapshot();`
   - В addExp() после строки 236: `this.invalidateSnapshot();`

3. В InMemoryCharacterRepository.ts оптимизировать метод get():
   ```typescript
   // Заменить метод get() (строка 28):
   get(): Character | null {
       // Возвращаем clone только при необходимости
       return this.character ? this.character.clone() : null;
   }
   ```

КРИТЕРИИ ПРОВЕРКИ:
- Character.clone() использует snapshot для ускорения
- Все методы изменения Character invalidируют snapshot
- Производительность клонирования улучшена в 3-5 раз
- Тесты проходят без изменений в логике
```

#### **ШАГ 1.3: Разделение системы событий на Domain и System события**

**Проблема:** Смешение domain и system событий в одной EventBus системе (GameClient.ts строки 292-304).

**Промт для Kimi 2.5:**

```
Задача: Разделить событийную систему на Domain Events и System Events для четкого разделения ответственности

ФАЙЛЫ ДЛЯ СОЗДАНИЯ:
1. src/infrastructure/event-bus/DomainEventBus.ts
2. src/infrastructure/event-bus/SystemEventBus.ts
3. src/infrastructure/event-bus/types.ts

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/infrastructure/event-bus/index.ts
2. src/game/GameClient.ts (строки 292-304, 320-344)
3. src/config/di/Container.ts (добавить новые токены)

ДЕЙСТВИЯ:

1. Создать src/infrastructure/event-bus/types.ts:
   ```typescript
   // System Events - синхронные, для мониторинга
   export interface SystemEvent {
       type: string;
       channel: 'system' | 'network' | 'monitoring';
       payload: unknown;
       timestamp: Date;
   }

   export interface SystemEventHandler<T extends SystemEvent> {
       (event: T): void;
   }

   export interface ISystemEventBus {
       publish<T extends SystemEvent>(event: T): void;
       subscribe<T extends SystemEvent>(eventType: string, handler: SystemEventHandler<T>): Subscription;
       clear(): void;
   }
   ```

2. Создать src/infrastructure/event-bus/SystemEventBus.ts:
   ```typescript
   import { SystemEvent, SystemEventHandler, ISystemEventBus } from './types';
   import type { Subscription } from '../../domain/events';

   export class SystemEventBus implements ISystemEventBus {
       private handlers = new Map<string, Set<SystemEventHandler<any>>>();

       publish<T extends SystemEvent>(event: T): void {
           const handlers = this.handlers.get(event.type);
           if (handlers) {
               handlers.forEach(handler => {
                   try {
                       handler(event);
                   } catch (error) {
                       console.error(`Error in system event handler for ${event.type}:`, error);
                   }
               });
           }
       }

       subscribe<T extends SystemEvent>(eventType: string, handler: SystemEventHandler<T>): Subscription {
           if (!this.handlers.has(eventType)) {
               this.handlers.set(eventType, new Set());
           }

           const handlerSet = this.handlers.get(eventType)!;
           const wrappedHandler = handler as SystemEventHandler<any>;
           handlerSet.add(wrappedHandler);

           return {
               unsubscribe: () => {
                   handlerSet.delete(wrappedHandler);
                   if (handlerSet.size === 0) {
                       this.handlers.delete(eventType);
                   }
               },
           };
       }

       clear(): void {
           this.handlers.clear();
       }
   }
   ```

3. В src/game/GameClient.ts разделить события:
   ```typescript
   // Обновить GameClientDependencies:
   export interface GameClientDependencies {
       eventBus: IEventBus;           // Domain events
       systemEventBus: ISystemEventBus; // System events
       packetProcessor: IPacketProcessor;
       // ... остальные без изменений
   }

   // Заменить publishRawPacketEvent (строки 292-304):
   private publishRawPacketEvent(opcode: number, length: number): void {
       this.deps.systemEventBus.publish({
           type: 'system.raw_packet',
           channel: 'network',
           payload: {
               opcode,
               opcodeHex: `0x${opcode.toString(16).padStart(2, '0')}`,
               length,
               state: this.state
           },
           timestamp: new Date(),
       });
   }
   ```

КРИТЕРИИ ПРОВЕРКИ:
- Domain события идут через IEventBus (для бизнес-логики)
- System события идут через ISystemEventBus (для мониторинга)
- Нет смешения типов событий в одной шине
- GameClient корректно использует обе шины
```

### **ФАЗА 2: УЛУЧШЕНИЯ КАЧЕСТВА КОДА**

Цель: Повысить качество и надежность кодовой базы.

#### **ШАГ 2.1: Добавление валидации конфигурации с Zod**

**Проблема:** Отсутствие валидации в src/config.ts приводит к runtime ошибкам при неправильных environment variables.

**Промт для Kimi 2.5:**

```
Задача: Добавить строгую валидацию конфигурации с помощью Zod для fail-fast поведения

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/config.ts (полная переписка)
2. package.json (добавить zod dependency)

ДЕЙСТВИЯ:

1. Установить зависимость:
   ```bash
   npm install zod
   ```

2. Полностью переписать src/config.ts:
   ```typescript
   import { z } from 'zod';
   import { Logger } from './logger/Logger';

   // Схема валидации
   const ConfigSchema = z.object({
       username: z.string().min(1, "Username is required"),
       password: z.string().min(1, "Password is required"),
       loginIp: z.string().ip("Invalid IP address"),
       loginPort: z.number().int().min(1).max(65535, "Invalid port"),
       gamePort: z.number().int().min(1).max(65535, "Invalid port"),
       serverId: z.number().int().min(1, "Server ID must be positive"),
       charSlotIndex: z.number().int().min(0).max(7, "Character slot must be 0-7"),
   });

   type Config = z.infer<typeof ConfigSchema>;

   // Валидация на старте приложения с детальными ошибками
   function validateConfig(): Config {
       const rawConfig = {
           username: process.env.L2_USERNAME,
           password: process.env.L2_PASSWORD,
           loginIp: process.env.L2_LOGIN_IP || "127.0.0.1",
           loginPort: parseInt(process.env.L2_LOGIN_PORT || "2106", 10),
           gamePort: parseInt(process.env.L2_GAME_PORT || "7777", 10),
           serverId: parseInt(process.env.L2_SERVER_ID || "1", 10),
           charSlotIndex: parseInt(process.env.L2_CHAR_SLOT || "0", 10),
       };

       try {
           return ConfigSchema.parse(rawConfig);
       } catch (error) {
           if (error instanceof z.ZodError) {
               Logger.error('CONFIG', '❌ Configuration validation failed:');
               error.errors.forEach(err => {
                   Logger.error('CONFIG', `  - ${err.path.join('.')}: ${err.message}`);
               });
               Logger.error('CONFIG', '\nPlease check your environment variables and try again.');
               process.exit(1);
           }
           throw error;
       }
   }

   export const CONFIG = validateConfig();

   // Backward compatibility exports
   export const Username = CONFIG.username;
   export const Password = CONFIG.password;
   export const LoginIp = CONFIG.loginIp;
   export const LoginPort = CONFIG.loginPort;
   export const GamePort = CONFIG.gamePort;
   export const ServerId = CONFIG.serverId;
   export const CharSlotIndex = CONFIG.charSlotIndex;
   ```

КРИТЕРИИ ПРОВЕРКИ:
- При неправильной конфигурации приложение падает с понятными ошибками
- Все поля конфигурации проходят валидацию типов и ограничений
- Сохранена обратная совместимость с существующими импортами
- Fail-fast поведение при старте приложения с невалидным .env
```

#### **ШАГ 2.2: Внедрение Result Pattern для унификации обработки ошибок**

**Проблема:** Смешение подходов к обработке ошибок (try/catch vs Result pattern) в GameClient.ts и других сервисах.

**Промт для Kimi 2.5:**

```
Задача: Унифицировать обработку ошибок через Result Pattern во всех критичных сервисах

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/game/GameClient.ts (методы sendPacket, start)
2. src/infrastructure/persistence/InMemoryCharacterRepository.ts (операции изменения)
3. src/api/routes/character.ts (как пример API endpoint)

ДЕЙСТВИЯ:

1. В GameClient.ts обернуть критичные операции в Result:
   ```typescript
   // Импортировать Result из shared
   import { Result } from '../shared/result';

   // Заменить метод sendPacket (строка 265):
   sendPacket(packet: OutgoingGamePacket): Result<void, Error> {
       try {
           const body = packet.encode();
           const encrypted = this.crypt.encrypt(body);
           this.sendPacketRawBuffer(encrypted);
           return Result.ok(undefined);
       } catch (error) {
           const message = error instanceof Error ? error.message : String(error);
           return Result.err(new Error(`Failed to send packet: ${message}`));
       }
   }

   // Добавить Result в start():
   start(): Result<void, Error> {
       try {
           Logger.logState(this.state, GameState.CONNECTING);
           this.state = GameState.CONNECTING;

           this.deps.commandManager.setGameClient(this);
           this.publishConnectionState(ConnectionPhase.ENTERING_GAME);
           this.connect(this.session.gameServerIp, this.session.gameServerPort);

           return Result.ok(undefined);
       } catch (error) {
           const message = error instanceof Error ? error.message : String(error);
           this.state = GameState.ERROR;
           return Result.err(new Error(`Failed to start GameClient: ${message}`));
       }
   }
   ```

2. В InMemoryCharacterRepository.ts добавить Result в критичные операции:
   ```typescript
   save(character: Character): Result<void, CharacterRepositoryError> {
       try {
           this.character = this.cloneCharacter(character);
           return Result.ok(undefined);
       } catch (error) {
           const message = error instanceof Error ? error.message : String(error);
           return Result.err(CharacterRepositoryError.saveFailed(message));
       }
   }

   update(updater: (char: Character) => Character): Result<void, CharacterRepositoryError> {
       const current = this.get();
       if (!current) {
           return Result.err(CharacterRepositoryError.notInitialized());
       }

       try {
           const updated = updater(current);
           return this.save(updated);
       } catch (error) {
           const message = error instanceof Error ? error.message : String(error);
           return Result.err(CharacterRepositoryError.updateFailed(message));
       }
   }
   ```

3. В API routes добавить централизованную обработку Result:
   ```typescript
   // Добавить helper функцию:
   function handleResult<T>(result: Result<T, Error>): { success: boolean; data?: T; error?: string } {
       if (result.success) {
           return { success: true, data: result.data };
       } else {
           return { success: false, error: result.error.message };
       }
   }

   // Пример использования в character route:
   app.post('/api/v1/character/move', (req, res) => {
       const moveResult = gameClient.moveCharacter(req.body.position);
       res.json(handleResult(moveResult));
   });
   ```

КРИТЕРИИ ПРОВЕРКИ:
- Все критичные операции возвращают Result<T, Error>
- Нет throw/catch в сервисном слое - только Result
- API endpoints используют централизованный handleResult
- Ошибки логируются на правильном уровне (сервис vs controller)
```

#### **ШАГ 2.3: Композиция вместо наследования в GameClient**

**Проблема:** GameClientNew наследует от Connection (строка 48), что затрудняет тестирование и нарушает принципы Clean Architecture.

**Промт для Kimi 2.5:**

```
Задача: Заменить наследование на композицию в GameClient для улучшения тестируемости

ФАЙЛЫ ДЛЯ СОЗДАНИЯ:
1. src/network/INetworkConnection.ts

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/game/GameClient.ts (полная переработка наследования)
2. src/network/Connection.ts (адаптация под новый интерфейс)

ДЕЙСТВИЯ:

1. Создать src/network/INetworkConnection.ts:
   ```typescript
   export interface INetworkConnection {
       connect(host: string, port: number): Promise<void>;
       disconnect(): Promise<void>;
       send(data: Buffer): Promise<void>;
       isConnected(): boolean;
       onReceive: (callback: (data: Buffer) => void) => void;
       onConnect: (callback: () => void) => void;
       onDisconnect: (callback: () => void) => void;
       onError: (callback: (error: Error) => void) => void;
   }
   ```

2. В GameClient.ts заменить наследование на композицию:
   ```typescript
   // Заменить extends Connection на композицию:
   export class GameClientNew implements IGameClient {
       private state: GameState = GameState.IDLE;
       private crypt: GameCrypt = new GameCrypt();
       private deps: GameClientDependencies;

       constructor(
           private session: SessionData,
           deps: GameClientDependencies,
           private connection: INetworkConnection // Инъекция зависимости
       ) {
           this.deps = deps;
           this.setupConnectionEvents();
       }

       private setupConnectionEvents(): void {
           this.connection.onConnect(() => this.onConnect());
           this.connection.onDisconnect(() => this.onClose());
           this.connection.onError((error) => this.onError(error));
           this.connection.onReceive((data) => this.onRawPacket(data));
       }

       start(): Result<void, Error> {
           try {
               Logger.logState(this.state, GameState.CONNECTING);
               this.state = GameState.CONNECTING;

               this.deps.commandManager.setGameClient(this);
               this.publishConnectionState(ConnectionPhase.ENTERING_GAME);

               return this.connection.connect(this.session.gameServerIp, this.session.gameServerPort);
           } catch (error) {
               return Result.err(new Error(`Failed to start: ${error.message}`));
           }
       }

       // Методы onConnect, onClose, onError остаются теми же
       // Только sendRaw заменяется на this.connection.send
   }
   ```

3. Обновить GameClientDependencies:
   ```typescript
   export interface GameClientDependencies {
       eventBus: IEventBus;
       systemEventBus: ISystemEventBus;
       packetProcessor: IPacketProcessor;
       characterRepo: ICharacterRepository;
       worldRepo: IWorldRepository;
       inventoryRepo: IInventoryRepository;
       connectionRepo: IConnectionRepository;
       commandManager: GameCommandManagerClass;
       // connection добавится через конструктор
   }
   ```

КРИТЕРИИ ПРОВЕРКИ:
- GameClient больше не наследует от Connection
- Все зависимости инъектируются через конструктор или DI
- Легко создавать mock объекты для INetworkConnection в тестах
- Функциональность GameClient не нарушена
- Принципы SOLID соблюдены (Dependency Inversion)
```

### **ФАЗА 3: ОПТИМИЗАЦИИ И ПРОИЗВОДИТЕЛЬНОСТЬ**

Цель: Оптимизировать производительность и масштабируемость системы.

#### **ШАГ 3.1: Внедрение кэширования для Game Data**

**Проблема:** Отсутствие кэширования приводит к повторному парсингу JSON файлов (items, npcs, skills) при каждом запросе.

**Промт для Kimi 2.5:**

```
Задача: Добавить кэширование для часто запрашиваемых игровых данных с TTL и статистикой

ФАЙЛЫ ДЛЯ СОЗДАНИЯ:
1. src/infrastructure/cache/ICacheManager.ts
2. src/infrastructure/cache/InMemoryCacheManager.ts
3. src/services/GameDataService.ts

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/data/loader.ts (обернуть в кэширующий сервис)
2. src/config/di/composition.ts (регистрация кэша)

ДЕЙСТВИЯ:

1. Создать src/infrastructure/cache/ICacheManager.ts:
   ```typescript
   export interface ICacheManager {
       get<T>(key: string): Promise<T | undefined>;
       set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
       invalidate(key: string): Promise<void>;
       flush(): Promise<void>;
       getStats(): { hits: number; misses: number; size: number };
   }
   ```

2. Создать src/infrastructure/cache/InMemoryCacheManager.ts:
   ```typescript
   interface CacheEntry<T> {
       value: T;
       expiresAt?: number;
       accessCount: number;
       lastAccessed: number;
   }

   export class InMemoryCacheManager implements ICacheManager {
       private cache = new Map<string, CacheEntry<unknown>>();
       private stats = { hits: 0, misses: 0 };
       private cleanupTimer?: ReturnType<typeof setInterval>;

       constructor() {
           // Cleanup expired entries every 5 minutes
           this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
       }

       async get<T>(key: string): Promise<T | undefined> {
           const entry = this.cache.get(key) as CacheEntry<T> | undefined;

           if (!entry) {
               this.stats.misses++;
               return undefined;
           }

           // Check expiration
           if (entry.expiresAt && Date.now() > entry.expiresAt) {
               this.cache.delete(key);
               this.stats.misses++;
               return undefined;
           }

           // Update access stats
           entry.accessCount++;
           entry.lastAccessed = Date.now();
           this.stats.hits++;

           return entry.value;
       }

       async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
           const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;

           this.cache.set(key, {
               value,
               expiresAt,
               accessCount: 0,
               lastAccessed: Date.now()
           });
       }

       async invalidate(key: string): Promise<void> {
           this.cache.delete(key);
       }

       async flush(): Promise<void> {
           this.cache.clear();
           this.stats = { hits: 0, misses: 0 };
       }

       getStats() {
           return {
               ...this.stats,
               size: this.cache.size
           };
       }

       private cleanup(): void {
           const now = Date.now();
           for (const [key, entry] of this.cache.entries()) {
               if (entry.expiresAt && now > entry.expiresAt) {
                   this.cache.delete(key);
               }
           }
       }

       dispose(): void {
           if (this.cleanupTimer) {
               clearInterval(this.cleanupTimer);
           }
       }
   }
   ```

3. Создать src/services/GameDataService.ts:
   ```typescript
   import type { ICacheManager } from '../infrastructure/cache/ICacheManager';

   export class GameDataService {
       constructor(private cache: ICacheManager) {}

       async getItem(id: number): Promise<Item | undefined> {
           const cacheKey = `item:${id}`;
           let item = await this.cache.get<Item>(cacheKey);

           if (!item) {
               const items = await this.getAllItems();
               item = items.find(i => i.id === id);

               if (item) {
                   await this.cache.set(cacheKey, item, 300); // 5 min TTL
               }
           }

           return item;
       }

       async getNpc(id: number): Promise<Npc | undefined> {
           const cacheKey = `npc:${id}`;
           let npc = await this.cache.get<Npc>(cacheKey);

           if (!npc) {
               const npcs = await this.getAllNpcs();
               npc = npcs.find(n => n.id === id);

               if (npc) {
                   await this.cache.set(cacheKey, npc, 600); // 10 min TTL
               }
           }

           return npc;
       }

       private async getAllItems(): Promise<Item[]> {
           const cacheKey = 'all_items';
           let items = await this.cache.get<Item[]>(cacheKey);

           if (!items) {
               // Load from data files
               const fs = require('fs');
               const data = JSON.parse(fs.readFileSync('src/data/export/items/items.json', 'utf8'));
               items = data;
               await this.cache.set(cacheKey, items, 3600); // 1 hour TTL
           }

           return items;
       }

       // Аналогично для getAllNpcs, getAllSkills
   }
   ```

КРИТЕРИИ ПРОВЕРКИ:
- Часто запрашиваемые данные кэшируются с подходящим TTL
- Cache hit ratio > 80% после прогрева
- Статистика кэша доступна для мониторинга
- API для получения игровых данных ускорен в 5-10 раз
```

#### **ШАГ 3.2: Buffer Pooling для оптимизации пакетов**

**Проблема:** Неэффективная сериализация пакетов с созданием новых буферов каждый раз (GameClient.ts строки 271-278).

**Промт для Kimi 2.5:**

```
Задача: Оптимизировать сериализацию пакетов через Buffer Pooling для снижения GC pressure

ФАЙЛЫ ДЛЯ СОЗДАНИЯ:
1. src/infrastructure/network/BufferPool.ts
2. src/infrastructure/network/PacketSerializer.ts

ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ:
1. src/game/GameClient.ts (метод sendPacketRawBuffer, строки 271-278)
2. src/config/di/composition.ts (регистрация PacketSerializer)

ДЕЙСТВИЯ:

1. Создать src/infrastructure/network/BufferPool.ts:
   ```typescript
   export class BufferPool {
       private pools = new Map<number, Buffer[]>(); // size -> buffer[]
       private maxPoolSize: number;
       private stats = { allocated: 0, reused: 0 };

       constructor(maxPoolSize: number = 20) {
           this.maxPoolSize = maxPoolSize;
       }

       acquire(size: number): Buffer {
           const poolSize = this.getPoolSize(size);
           const pool = this.pools.get(poolSize);

           if (pool && pool.length > 0) {
               const buffer = pool.pop()!;
               // Reset buffer content
               buffer.fill(0);
               this.stats.reused++;
               return buffer.subarray(0, size);
           }

           this.stats.allocated++;
           return Buffer.allocUnsafe(size);
       }

       release(buffer: Buffer): void {
           const poolSize = this.getPoolSize(buffer.length);
           let pool = this.pools.get(poolSize);

           if (!pool) {
               pool = [];
               this.pools.set(poolSize, pool);
           }

           if (pool.length < this.maxPoolSize) {
               pool.push(buffer);
           }
       }

       getStats() {
           return {
               ...this.stats,
               poolSizes: Array.from(this.pools.entries()).map(([size, buffers]) => ({
                   size,
                   count: buffers.length
               })),
               reuseRatio: this.stats.reused / (this.stats.allocated + this.stats.reused)
           };
       }

       private getPoolSize(size: number): number {
           // Round up to nearest power of 2 for efficient pooling
           return Math.pow(2, Math.ceil(Math.log2(Math.max(size, 32))));
       }
   }
   ```

2. Создать src/infrastructure/network/PacketSerializer.ts:
   ```typescript
   import { BufferPool } from './BufferPool';
   import type { OutgoingGamePacket } from '../../game/packets/outgoing/OutgoingGamePacket';

   export class PacketSerializer {
       private bufferPool = new BufferPool(50); // Pool of 50 buffers

       serializeWithHeader(packet: OutgoingGamePacket): { buffer: Buffer; cleanup: () => void } {
           const body = packet.encode();
           const totalSize = body.length + 2;

           const buffer = this.bufferPool.acquire(totalSize);
           buffer.writeUInt16LE(totalSize, 0);
           body.copy(buffer, 2);

           return {
               buffer: buffer.subarray(0, totalSize),
               cleanup: () => this.bufferPool.release(buffer)
           };
       }

       serializeRawWithHeader(data: Buffer): { buffer: Buffer; cleanup: () => void } {
           const totalSize = data.length + 2;
           const buffer = this.bufferPool.acquire(totalSize);
           buffer.writeUInt16LE(totalSize, 0);
           data.copy(buffer, 2);

           return {
               buffer: buffer.subarray(0, totalSize),
               cleanup: () => this.bufferPool.release(buffer)
           };
       }

       getPoolStats() {
           return this.bufferPool.getStats();
       }
   }
   ```

3. В GameClient.ts заменить sendPacketRawBuffer (строки 271-278):
   ```typescript
   // Добавить в конструктор или как dependency:
   constructor(
       private session: SessionData,
       deps: GameClientDependencies,
       private connection: INetworkConnection,
       private packetSerializer: PacketSerializer // Новая зависимость
   ) {
       // ...
   }

   // Заменить sendPacket:
   sendPacket(packet: OutgoingGamePacket): Result<void, Error> {
       try {
           const body = packet.encode();
           const encrypted = this.crypt.encrypt(body);

           const { buffer, cleanup } = this.packetSerializer.serializeRawWithHeader(encrypted);
           this.connection.send(buffer);

           // Release buffer back to pool after send
           setImmediate(cleanup);

           return Result.ok(undefined);
       } catch (error) {
           return Result.err(new Error(`Failed to send packet: ${error.message}`));
       }
   }

   // Заменить sendPacketRawBuffer:
   private sendPacketRawBuffer(buffer: Buffer): void {
       Logger.debug('GameClient', `-> Buffer len=${buffer.length}`);

       const { buffer: framedBuffer, cleanup } = this.packetSerializer.serializeRawWithHeader(buffer);
       this.connection.send(framedBuffer);

       // Release buffer back to pool
       setImmediate(cleanup);
   }
   ```

КРИТЕРИИ ПРОВЕРКИ:
- Буферы переиспользуются вместо создания новых
- Memory allocation снижен на 60-80%
- Buffer reuse ratio > 70%
- Нет memory leaks при длительной работе
- Производительность отправки пакетов улучшена на 30-50%
```

---

### **📊 МОНИТОРИНГ ПРОГРЕССА**

После выполнения каждой фазы проверяйте:

**Фаза 1:**
- [ ] Нет singleton exports в репозиториях
- [ ] Character.clone() оптимизирован
- [ ] События разделены на Domain/System

**Фаза 2:**
- [ ] Конфигурация валидируется при старте
- [ ] Result pattern используется везде
- [ ] GameClient использует композицию

**Фаза 3:**
- [ ] Cache hit ratio > 80%
- [ ] Buffer reuse ratio > 70%
- [ ] Memory usage стабилизирован

---

### **🎯 ФИНАЛЬНАЯ ПРОВЕРКА**

Выполните после завершения всех фаз:

```bash
# Компиляция и линтинг
npm run build
npm run lint

# Тестирование
npm run test
npm run test:coverage

# Проверка производительности
npm run debug
# Мониторинг memory usage в течение 30 минут
```

**Ожидаемые результаты:**
- Тестопокрытие: >80%
- Build time: -30%
- Memory usage: -40%
- Cache hit ratio: >80%
- Buffer reuse ratio: >70%