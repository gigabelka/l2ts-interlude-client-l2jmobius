# Login Protocol System

Централизованная система обработки пакетов Login Server с использованием паттернов Factory + Strategy + Registry.

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    LoginClientRefactored                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │  SessionManager │  │ PacketProcessor  │  │    Factory     │ │
│  │   (State Store) │  │  (Strategy)      │  │  (Factory)     │ │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬────────┘ │
│           │                    │                    │          │
│           └────────────────────┼────────────────────┘          │
│                                │                               │
└────────────────────────────────┼───────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │    PacketRegistry       │
                    │  (Centralized Config)   │
                    └────────────┬────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
    ┌──────┴──────┐     ┌────────┴────────┐    ┌──────┴──────┐
    │ InitHandler │     │ LoginFailHandler│    │  ...Handler │
    └─────────────┘     └─────────────────┘    └─────────────┘
```

## Паттерны

### 1. Factory Pattern (`LoginIncomingPacketFactory`)

Создание пакетов по опкоду без switch-case:

```typescript
const factory = new LoginIncomingPacketFactory();
factory.register(0x00, InitPacket, { name: 'InitPacket' });

const result = factory.create(0x00);
if (result.isOk()) {
    const packet = result.getOrThrow();
}
```

### 2. Strategy Pattern (`BaseLoginPacketHandler`)

Обработка пакетов через стратегии:

```typescript
class InitHandler extends BaseLoginPacketHandler<InitPacket> {
    canHandleInState(state: string): boolean {
        return state === 'WAIT_INIT';
    }
    
    handle(context: LoginPacketContext, reader: IPacketReader): void {
        const packet = this.decode(reader);
        // Обработка...
    }
}
```

### 3. Registry Pattern (`LoginPacketRegistry`)

Централизованная регистрация всех пакетов:

```typescript
// Все пакеты регистрируются в одном месте
const PACKET_REGISTRY: PacketConfig[] = [
    { opcode: 0x00, name: 'InitPacket', states: ['WAIT_INIT'] },
    { opcode: 0x01, name: 'LoginFailPacket', states: ['WAIT_INIT', 'WAIT_LOGIN_OK'] },
    // ...
];
```

## Использование

### Базовое использование

```typescript
import {
    SessionManager,
    configureLoginPacketFactory,
    configureLoginPacketProcessor,
    LoginPacketProcessor,
} from './protocol';

// 1. Создаем менеджер сессии
const sessionManager = SessionManager.getInstance();

// 2. Настраиваем фабрику (регистрирует все пакеты из Registry)
const factory = configureLoginPacketFactory();

// 3. Создаем и настраиваем процессор
const processor = new LoginPacketProcessor(factory, sessionManager);
configureLoginPacketProcessor(processor, sessionManager);

// 4. Обрабатываем пакет
const result = processor.process(opcode, data, currentState);

if (result.success) {
    console.log('Packet processed:', result.packet);
} else {
    console.error('Processing failed:', result.error);
}
```

### Использование в клиенте

```typescript
import { LoginClientRefactored } from './LoginClientRefactored';

const client = new LoginClientRefactored(config, (session) => {
    console.log('Auth complete:', session);
});

client.start();
```

## Добавление нового пакета

### Шаг 1: Добавить пакет в Registry

```typescript
// В LoginPacketRegistry.ts
const PACKET_REGISTRY: PacketConfig[] = [
    // ... существующие пакеты
    {
        opcode: 0xXX,  // Новый опкод
        name: 'NewPacket',
        description: 'Description of the packet',
        states: ['WAIT_SOME_STATE'],
    },
];
```

### Шаг 2: Создать класс пакета (опционально)

```typescript
// В packets/incoming/NewPacket.ts
export class NewPacket implements IncomingLoginPacket {
    public someField: number = 0;
    
    decode(reader: PacketReader): this {
        reader.readUInt8(); // opcode
        this.someField = reader.readInt32LE();
        return this;
    }
}
```

### Шаг 3: Создать обработчик

```typescript
// В protocol/handlers/NewHandler.ts
export class NewHandler extends BaseLoginPacketHandler<NewPacket> {
    constructor(sessionManager: SessionManager) {
        super(0xXX, sessionManager); // Опкод
    }

    protected canHandleInState(state: string): boolean {
        return state === 'WAIT_SOME_STATE';
    }

    handle(context: LoginPacketContext, reader: IPacketReader): void {
        const packet = this.decode(reader);
        // Логика обработки...
    }

    protected createPacket(): NewPacket {
        return new NewPacket();
    }
}
```

### Шаг 4: Зарегистрировать обработчик

```typescript
// В LoginPacketRegistry.ts
const HANDLER_REGISTRY: HandlerConfig[] = [
    // ... существующие обработчики
    {
        opcode: 0xXX,
        handlerClass: NewHandler,
        description: 'Handles New packet',
    },
];
```

**Готово!** Пакет автоматически зарегистрируется при вызове `configureLoginPacketFactory()` и `configureLoginPacketProcessor()`.

## SessionManager

Централизованное хранилище данных сессии:

```typescript
const session = SessionManager.getInstance();

// Установка данных
session.setInitData(sessionId, rsaKey, blowfishKey);
session.setLoginOk(id1, id2);
session.setPlayOk(id1, id2);

// Получение данных
const loginOk = session.getLoginOk();
const playOk = session.getPlayOk();

// Подписка на события
session.on('session.login_ok_received', (event) => {
    console.log('Login OK:', event.keys);
});
```

## Преимущества

1. **Open-Closed Principle**: Добавление пакета не требует изменения существующего кода
2. **Single Responsibility**: Каждый handler отвечает только за свой пакет
3. **Testability**: Легко тестировать отдельные компоненты
4. **Type Safety**: Полная типизация через TypeScript
5. **Centralized Configuration**: Все пакеты в одном месте (Registry)
